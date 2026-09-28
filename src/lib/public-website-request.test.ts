import "../../scripts/mock-server-only.ts";
import assert from "node:assert/strict";
import dns from "node:dns/promises";
import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import { PassThrough } from "node:stream";
import { test, type TestContext } from "node:test";
import { gzipSync } from "node:zlib";

import { requestPublicWebsite } from "./public-website-request";
import { fetchPublicPageHtml } from "./website-import";
import { isPrivateIp, normalisePublicWebsiteUrl, resolvePublicAddresses } from "./website-import-ssrf";

const PUBLIC_IP = "93.184.216.34";
const MAX_BYTES = 2 * 1024 * 1024;
const requestOptions = () => ({ signal: new AbortController().signal, userAgent: "SecurityTest" });
type Address = { address: string; family: number };
type FakeResponse = PassThrough & { statusCode: number; headers: http.IncomingHttpHeaders };
type CapturedRequest = { url: URL; options: https.RequestOptions; destinations: Address[] };

function mockTransport(
  t: TestContext,
  respond: (response: FakeResponse, index: number) => void,
  allAddresses = true,
) {
  const requests: CapturedRequest[] = [];
  const responses: FakeResponse[] = [];
  const implementation = (url: URL, options: https.RequestOptions, callback: (response: http.IncomingMessage) => void) => {
    const request = new EventEmitter() as EventEmitter & { end: () => void };
    const captured: CapturedRequest = { url, options, destinations: [] };
    requests.push(captured);
    options.signal?.addEventListener("abort", () => {
      request.emit("error", new DOMException("Request aborted", "AbortError"));
    }, { once: true });
    request.end = () => {
      const lookup = options.lookup as unknown as (
        host: string,
        options: { all: boolean },
        done: (error: Error | null, address: Address[] | string, family?: number) => void,
      ) => void;
      lookup(url.hostname, { all: allAddresses }, (error, addresses, family) => {
        assert.equal(error, null);
        captured.destinations = typeof addresses === "string"
          ? [{ address: addresses, family: family! }]
          : addresses;
        queueMicrotask(() => {
          const response = Object.assign(new PassThrough(), {
            statusCode: 200,
            headers: { "content-type": "text/html" } as http.IncomingHttpHeaders,
          });
          responses.push(response);
          respond(response, requests.indexOf(captured));
          callback(response as unknown as http.IncomingMessage);
        });
      });
    };
    return request as unknown as http.ClientRequest;
  };
  t.mock.method(http, "request", implementation as typeof http.request);
  t.mock.method(https, "request", implementation as typeof https.request);
  return { requests, responses };
}

function publicDns(t: TestContext) {
  return t.mock.method(dns, "lookup", async () => [{ address: PUBLIC_IP, family: 4 }]);
}

test("rejects private and disguised address literals without overblocking adjacent public ranges", () => {
  for (const address of [
    "::", "::1", "[::1]", "::127.0.0.1", "::7f00:1", "::ffff:127.0.0.1",
    "::ffff:7f00:1", "0:0:0:0:0:ffff:a00:1", "::ffff:a9fe:a9fe",
    "fe80::1", "fd00::1", "fc00::1", "fe80::1%lo0", "64:ff9b::7f00:1",
    "2002:7f00:1::", "2001::1", "2001:db8::1", "3fff::1",
    "0.0.0.0", "10.0.0.1", "127.0.0.1", "169.254.169.254", "100.64.0.1",
    "192.168.1.1", "192.0.0.1", "192.0.2.1", "198.18.0.1", "198.19.1.1",
    "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255", "garbage",
  ]) assert.equal(isPrivateIp(address), true, address);
  for (const address of [
    PUBLIC_IP, "8.8.8.8", "::ffff:8.8.8.8", "2606:4700:4700::1111",
    "192.0.3.1", "198.51.101.1", "203.0.114.1", "198.17.1.1", "100.128.0.1",
  ]) assert.equal(isPrivateIp(address), false, address);
});

test("URL parsing rejects alternate loopback spellings and embedded credentials", async () => {
  for (const raw of [
    "http://2130706433/", "http://0x7f000001/", "http://127.1/",
    "http://[::ffff:127.0.0.1]/", "https://localhost./", "https://internal.local/",
    "https://user:password@example.com/",
  ]) assert.equal(await normalisePublicWebsiteUrl(raw), null, raw);
});

test("a single private DNS answer rejects the entire response before opening a socket", async (t) => {
  const transport = mockTransport(t, (response) => response.end("unexpected"));
  t.mock.method(dns, "lookup", async () => [
    { address: PUBLIC_IP, family: 4 }, { address: "::ffff:127.0.0.1", family: 6 },
  ]);
  await assert.rejects(requestPublicWebsite(new URL("https://mixed.example/"), requestOptions()), /not public/);
  assert.equal(transport.requests.length, 0);
});

test("pins both lookup modes to checked addresses while preserving HTTPS host and certificate identity", async (t) => {
  for (const all of [false, true]) {
    let dnsCalls = 0;
    t.mock.method(dns, "lookup", async () => {
      dnsCalls++;
      return [{ address: dnsCalls === 1 ? PUBLIC_IP : "127.0.0.1", family: 4 }];
    });
    const { requests } = mockTransport(t, (response) => response.end("<html>safe</html>"), all);
    const response = await requestPublicWebsite(new URL("https://rebinding.example:8443/path"), requestOptions());
    assert.equal(await response.text(), "<html>safe</html>");
    assert.equal(dnsCalls, 1, "the connection must not do another DNS lookup");
    assert.equal(requests[0]?.url.host, "rebinding.example:8443");
    assert.equal(requests[0]?.options.servername, "rebinding.example");
    assert.equal(requests[0]?.options.agent, false);
    assert.notEqual(requests[0]?.options.rejectUnauthorized, false);
    assert.deepEqual(requests[0]?.destinations, [{ address: PUBLIC_IP, family: 4 }]);
    t.mock.restoreAll();
  }
});

test("redirects cannot reach a private destination and their bodies are closed immediately", async (t) => {
  publicDns(t);
  const { requests, responses } = mockTransport(t, (response) => {
    response.statusCode = 302;
    response.headers.location = "http://[::ffff:127.0.0.1]/private";
    // Deliberately never finish this body: following must not drain it.
  });
  assert.equal(await fetchPublicPageHtml("https://public.example/"), null);
  assert.equal(requests.length, 1);
  assert.equal(responses[0]?.destroyed, true);
});

test("each public redirect hop resolves and pins its own destination", async (t) => {
  const lookup = publicDns(t);
  const { requests } = mockTransport(t, (response, index) => {
    if (index === 0) {
      response.statusCode = 302;
      response.headers.location = "https://second.example/about";
    } else response.end("<html>final public page</html>");
  });
  assert.equal(await fetchPublicPageHtml("https://first.example/"), "<html>final public page</html>");
  assert.deepEqual(requests.map((request) => request.url.hostname), ["first.example", "second.example"]);
  assert.ok(lookup.mock.calls.some((call) => call.arguments[0] === "second.example"));
  assert.ok(requests.every((request) => request.destinations[0]?.address === PUBLIC_IP));
});

test("DNS waits honor aborts without opening a socket", async (t) => {
  t.mock.method(dns, "lookup", () => new Promise<Address[]>(() => {}));
  const { requests } = mockTransport(t, (response) => response.end("unexpected"));
  const controller = new AbortController();
  const pending = requestPublicWebsite(new URL("https://slow-dns.example/"), { ...requestOptions(), signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(requests.length, 0);
});

test("socket aborts close an unfinished response body", async (t) => {
  publicDns(t);
  const { responses } = mockTransport(t, () => {});
  const controller = new AbortController();
  const pending = requestPublicWebsite(new URL("https://slow-body.example/"), { ...requestOptions(), signal: controller.signal });
  const timer = setTimeout(() => controller.abort(), 5);
  try {
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(responses[0]?.destroyed, true);
  } finally { clearTimeout(timer); }
});

test("rejects declared and streamed oversized response bodies", async (t) => {
  publicDns(t);
  const { responses } = mockTransport(t, (response, index) => {
    if (index === 0) response.headers["content-length"] = String(MAX_BYTES + 1);
    else response.end(Buffer.alloc(MAX_BYTES + 1, "x"));
  });
  for (let index = 0; index < 2; index++) {
    await assert.rejects(requestPublicWebsite(new URL("https://large.example/"), requestOptions()), /too large/);
    assert.equal(responses[index]?.destroyed, true);
  }
});

test("caps decompressed content even when the gzip wire body is small", async (t) => {
  publicDns(t);
  const { responses } = mockTransport(t, (response) => {
    response.headers["content-encoding"] = "gzip";
    response.end(gzipSync(Buffer.alloc(MAX_BYTES + 1, "x")));
  });
  await assert.rejects(requestPublicWebsite(new URL("https://compressed.example/"), requestOptions()), /too large/);
  assert.equal(responses[0]?.destroyed, true);
});

test("decodes a bounded gzip page and rejects unknown encodings", async (t) => {
  publicDns(t);
  mockTransport(t, (response, index) => {
    response.headers["content-encoding"] = index === 0 ? "gzip" : "unknown";
    response.end(gzipSync(Buffer.from("<html>compressed page</html>")));
  });
  const response = await requestPublicWebsite(new URL("https://compressed.example/"), requestOptions());
  assert.equal(await response.text(), "<html>compressed page</html>");
  await assert.rejects(requestPublicWebsite(new URL("https://compressed.example/"), requestOptions()), /Unsupported/);
});

test("empty DNS answers fail closed", async (t) => {
  t.mock.method(dns, "lookup", async () => []);
  await assert.rejects(resolvePublicAddresses("empty.example"), /not public/);
});


test("the timeout budget spans the complete redirect chain", async (t) => {
  let now = 1_000;
  t.mock.method(Date, "now", () => now);
  publicDns(t);
  const { requests } = mockTransport(t, (response) => {
    response.statusCode = 302;
    response.headers.location = "https://second.example/";
    now += 18_001;
  });
  assert.equal(await fetchPublicPageHtml("https://first.example/"), null);
  assert.equal(requests.length, 1);
});

test("caps gzip wire bytes even when decompressed content is tiny", async (t) => {
  publicDns(t);
  const gzip = gzipSync(Buffer.from("tiny"));
  const header = Buffer.from(gzip.subarray(0, 10));
  header[3] = header[3]! | 0x08; // Gzip FNAME metadata, terminated by a zero byte.
  const wireBody = Buffer.concat([header, Buffer.alloc(MAX_BYTES + 1, "n"), Buffer.from([0]), gzip.subarray(10)]);
  mockTransport(t, (response) => {
    response.headers["content-encoding"] = "gzip";
    response.end(wireBody);
  });
  await assert.rejects(requestPublicWebsite(new URL("https://large-header.example/"), requestOptions()), /too large/);
});
