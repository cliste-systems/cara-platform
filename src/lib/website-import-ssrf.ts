import dns from "node:dns/promises";
import net from "node:net";

/** Reject non-global addresses, including IPv4 hidden in an IPv6 address. */
export function isPrivateIp(ip: string): boolean {
  const address = ip.replace(/^\[|\]$/g, "");
  const kind = net.isIP(address);
  if (kind === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113);
  }
  if (kind !== 6 || address.includes("%")) return true;
  // URL canonicalization expands dotted IPv4 suffixes to hexadecimal words.
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase();
  if (canonical.startsWith("::ffff:")) {
    const words = canonical.slice(7).split(":");
    if (words.length !== 2) return true;
    const high = parseInt(words[0], 16);
    const low = parseInt(words[1], 16);
    return isPrivateIp(`${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`);
  }
  // Only global unicast is accepted. Exclude documentation and transition
  // prefixes that can conceal IPv4 destinations (Teredo / 6to4).
  const [firstWord, secondWord] = canonical.split(":");
  const first = parseInt(firstWord || "0", 16);
  const second = parseInt(secondWord || "0", 16);
  return first < 0x2000 || first > 0x3fff ||
    (first === 0x2001 && (second === 0 || second === 2 || second === 0xdb8 ||
      (second & 0xfff0) === 0x10 || (second & 0xfff0) === 0x20)) ||
    first === 0x2002 || (first === 0x3fff && second < 0x1000);
}

export async function resolvePublicAddresses(
  hostname: string,
  signal: AbortSignal = AbortSignal.timeout(18_000),
) {
  signal.throwIfAborted();
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host === "metadata.google.internal" || (!host.includes(".") && !net.isIP(host))) {
    throw new Error("Website address is not public");
  }
  const family = net.isIP(host);
  const records = family ? [{ address: host, family }] : await new Promise<Array<{ address: string; family: number }>>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    dns.lookup(host, { all: true }).then((addresses) => {
      signal.removeEventListener("abort", onAbort);
      resolve(addresses);
    }, (error: unknown) => {
      signal.removeEventListener("abort", onAbort);
      reject(error);
    });
  });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) {
    throw new Error("Website address is not public");
  }
  return records;
}

export async function hostResolvesToPublic(hostname: string, signal?: AbortSignal): Promise<boolean> {
  try {
    await resolvePublicAddresses(hostname, signal);
    return true;
  } catch {
    return false;
  }
}

export async function normalisePublicWebsiteUrl(raw: string, signal?: AbortSignal): Promise<URL | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try { url = new URL(withScheme); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!(await hostResolvesToPublic(url.hostname, signal))) return null;
  return url;
}
