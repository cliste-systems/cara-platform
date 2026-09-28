import assert from "node:assert/strict";
import test from "node:test";

import { isSameOriginRequest } from "./request-origin";

function request(headers: Record<string, string>, url = "http://0.0.0.0:3001/api/transport") {
  return new Request(url, { headers });
}

test("accepts the public localhost origin when Next uses its listen address", () => {
  assert.equal(isSameOriginRequest(request({ origin: "http://localhost:3001", host: "localhost:3001" })), true);
  assert.equal(isSameOriginRequest(request({ origin: "http://127.0.0.1:3001", host: "127.0.0.1:3001" })), true);
});

test("accepts HTTPS and IPv6 origins with matching hosts", () => {
  assert.equal(isSameOriginRequest(request({ origin: "https://admin.example.com", host: "admin.example.com:443" }, "https://internal.example/api/transport")), true);
  assert.equal(isSameOriginRequest(request({ origin: "http://[::1]:3001", host: "[::1]:3001" })), true);
});

test("rejects cross-origin hosts, ports, schemes, and missing origin or host", () => {
  const cases: Record<string, string>[] = [
    { origin: "http://elsewhere.example:3001", host: "localhost:3001" },
    { origin: "http://localhost:3002", host: "localhost:3001" },
    { origin: "https://localhost:3001", host: "localhost:3001" },
    { origin: "null", host: "localhost:3001" },
    { host: "localhost:3001" },
    { origin: "http://localhost:3001" },
  ];
  for (const headers of cases) assert.equal(isSameOriginRequest(request(headers)), false);
});

test("does not trust forwarded hosts or forwarded protocol", () => {
  assert.equal(isSameOriginRequest(request({ origin: "https://elsewhere.example", host: "localhost:3001", "x-forwarded-host": "elsewhere.example", "x-forwarded-proto": "https" })), false);
  assert.equal(isSameOriginRequest(request({ origin: "http://localhost:3001", "x-forwarded-host": "localhost:3001" })), false);
});

test("rejects malformed authority headers and non-origin URLs", () => {
  for (const host of ["localhost:3001/", "localhost:3001,elsewhere.example", "user@localhost:3001", "localhost:3001#fragment", "localhost:3001?query", "localhost:3001\\path"]) {
    assert.equal(isSameOriginRequest(request({ origin: "http://localhost:3001", host })), false);
  }
  for (const origin of ["http://localhost:3001/", "http://localhost:3001/path", "http://user@localhost:3001", "not-a-url"]) {
    assert.equal(isSameOriginRequest(request({ origin, host: "localhost:3001" })), false);
  }
});
