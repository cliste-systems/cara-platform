import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Transform } from "node:stream";
import { resolvePublicAddresses } from "./website-import-ssrf";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

type PublicWebsiteResponse = { status: number; headers: Headers; text: () => Promise<string> };

/** One HTTP hop. The socket uses the validated address, never a second DNS result. */
export async function requestPublicWebsite(
  url: URL,
  options: { signal: AbortSignal; userAgent: string },
): Promise<PublicWebsiteResponse> {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Invalid website URL");
  }
  const addresses = await resolvePublicAddresses(url.hostname, options.signal);
  options.signal.throwIfAborted();
  const address = addresses[0];
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  return new Promise((resolve, reject) => {
    let settled = false;
    let response: http.IncomingMessage | undefined;
    let decoder: Transform | undefined;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      response?.destroy();
      decoder?.destroy();
      reject(error);
    };
    const finish = (result: PublicWebsiteResponse) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const request = (url.protocol === "https:" ? https : http).request(url, {
      method: "GET",
      signal: options.signal,
      agent: false,
      // The URL retains the original Host header; TLS verifies that same host.
      ...(url.protocol === "https:" && !isIP(hostname) ? { servername: hostname } : {}),
      // All address families use the validated snapshot, including Node's
      // multi-address connection mode. Do not call the resolver from here.
      lookup: (_host, lookupOptions, callback) => {
        if (lookupOptions.all) callback(null, addresses);
        else callback(null, address.address, address.family);
      },
      headers: { "User-Agent": options.userAgent, "Accept-Encoding": "identity" },
    }, (incoming) => {
      response = incoming;
      response.on("error", fail);
      response.on("aborted", () => fail(new Error("Website response was interrupted")));
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (value != null) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      const status = response.statusCode ?? 502;
      // Redirect bodies are irrelevant. Close them immediately so a redirect
      // cannot leave an unbounded stream running after its timer is cleared.
      if (status >= 300 && status < 400) {
        finish({ status, headers, text: async () => "" });
        response.destroy();
        return;
      }
      if (Number(headers.get("content-length")) > MAX_RESPONSE_BYTES) {
        fail(new Error("Website response too large"));
        return;
      }
      const encoding = headers.get("content-encoding")?.trim().toLowerCase();
      decoder = encoding === "gzip" ? createGunzip() : encoding === "br" ? createBrotliDecompress() : encoding === "deflate" ? createInflate() : undefined;
      if (encoding && encoding !== "identity" && !decoder) {
        fail(new Error("Unsupported website response encoding"));
        return;
      }
      let receivedBytes = 0;
      response.on("data", (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_RESPONSE_BYTES) fail(new Error("Website response too large"));
      });
      const stream = decoder ? response.pipe(decoder) : response;
      stream.on("error", fail);
      let decodedBytes = 0;
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => {
        if (settled) return;
        decodedBytes += chunk.length;
        if (decodedBytes > MAX_RESPONSE_BYTES) fail(new Error("Website response too large"));
        else chunks.push(chunk);
      });
      stream.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        finish({ status, headers, text: async () => body });
      });
    });
    request.on("error", fail);
    request.end();
  });
}
