import "server-only";

import { MARKETING_SITE_URL } from "@/lib/company-details";
import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import type {
  WebsiteImportFaq,
  WebsiteImportLocation,
} from "@/lib/website-import-types";
import {
  asLocations,
  finalizeImportLocations,
  mergeMultiLocationFaq,
} from "@/lib/website-import-locations";
import { normalisePublicWebsiteUrl } from "@/lib/website-import-ssrf";
import { requestPublicWebsite } from "@/lib/public-website-request";
import { isRegulatedBusinessText } from "@/lib/classify-business-description";

export type {
  WebsiteImportFaq,
  WebsiteImportLocation,
} from "@/lib/website-import-types";

export type WebsiteImportData = {
  businessDescription: string;
  services: string[];
  servicesNotOffered: string[];
  openingHours: string;
  serviceArea: string;
  faqs: WebsiteImportFaq[];
  /** Primary location address — empty when multiple locations need user pick. */
  address: string;
  /** Primary location eircode — empty when multiple locations need user pick. */
  eircode: string;
  locations: WebsiteImportLocation[];
  regulated: boolean;
};

export type WebsiteImportResult =
  | { ok: true; data: WebsiteImportData }
  | { ok: false; message: string; reason?: string };

export type PageFetchFailure =
  | "timeout"
  | "connection_failed"
  | "http_error"
  | "unsupported_content_type"
  | "redirect_loop"
  | "empty_body";

type PageFetchResult =
  | { ok: true; text: string }
  | { ok: false; failure: PageFetchFailure; httpStatus?: number };

const FETCH_TIMEOUT_MS = 18_000;
const MAX_TEXT_CHARS = 7000;
const EXTRA_PATHS = [
  "about",
  "about-us",
  "contact",
  "contact-us",
  "services",
];

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPublicPageHtmlDetailed(
  url: string,
  hops = 0,
  deadline = Date.now() + FETCH_TIMEOUT_MS,
): Promise<{ ok: true; html: string } | { ok: false; failure: PageFetchFailure; httpStatus?: number }> {
  if (hops > 5) {
    return { ok: false, failure: "redirect_loop" };
  }
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) return { ok: false, failure: "timeout" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remainingMs);
  try {
    const parsed = await normalisePublicWebsiteUrl(url, controller.signal);
    controller.signal.throwIfAborted();
    if (!parsed) {
      return { ok: false, failure: "connection_failed" };
    }
    const res = await requestPublicWebsite(parsed, {
      signal: controller.signal,
      userAgent: `HelloCaraBot/1.0 (+${MARKETING_SITE_URL})`,
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        return { ok: false, failure: "http_error", httpStatus: res.status };
      }
      const next = new URL(location, parsed).toString();
      return fetchPublicPageHtmlDetailed(next, hops + 1, deadline);
    }
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, failure: "http_error", httpStatus: res.status };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return { ok: false, failure: "unsupported_content_type" };
    }
    const html = await res.text();
    if (!html.trim()) {
      return { ok: false, failure: "empty_body" };
    }
    return { ok: true, html };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, failure: "timeout" };
    }
    return { ok: false, failure: "connection_failed" };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPublicPageHtml(url: string, hops = 0): Promise<string | null> {
  const result = await fetchPublicPageHtmlDetailed(url, hops);
  return result.ok ? result.html : null;
}

async function fetchPublicPageTextDetailed(
  url: string,
  hops = 0,
): Promise<PageFetchResult> {
  const htmlResult = await fetchPublicPageHtmlDetailed(url, hops);
  if (!htmlResult.ok) {
    return htmlResult;
  }
  const text = htmlToText(htmlResult.html);
  if (!text.trim()) {
    return { ok: false, failure: "empty_body" };
  }
  return { ok: true, text };
}

function parseWebsiteImportJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pageFetchFailureMessage(
  failure: PageFetchFailure,
  httpStatus?: number,
): { message: string; reason?: string } {
  switch (failure) {
    case "timeout":
      return {
        message:
          "Your website took too long to load. Slow sites are common — try again in a minute, or type your details in below.",
        reason: "Timed out after 18 seconds",
      };
    case "connection_failed":
      return {
        message:
          "We couldn't open that website. Check the address is right, or type your details in below.",
        reason: "Could not connect",
      };
    case "http_error":
      return {
        message: httpStatus
          ? `That page isn't available right now. The website returned error ${httpStatus} — try again later, or fill in below.`
          : "That page isn't available right now. Try again later, or fill in your details below.",
        reason: httpStatus ? `Website error ${httpStatus}` : "Website error",
      };
    case "unsupported_content_type":
      return {
        message:
          "That link doesn't look like a normal web page. Check the address, or fill in your details below.",
        reason: "Not a readable web page",
      };
    case "redirect_loop":
      return {
        message:
          "That website kept redirecting and we couldn't reach the page. Try again, or fill in below.",
        reason: "Too many redirects",
      };
    case "empty_body":
      return {
        message:
          "The page opened but was blank. Fill in your address and services below.",
        reason: "Empty page",
      };
  }
}

function invalidWebsiteUrlMessage(raw: string): { message: string; reason?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { message: "Paste your website address above to import." };
  }
  try {
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    new URL(withScheme);
    return {
      message:
        "That address isn't a public website we can open. Check the link, or fill in below.",
      reason: "Address not allowed",
    };
  } catch {
    return {
      message: "That doesn't look like a website address. Try something like yourbusiness.ie",
      reason: "Invalid address",
    };
  }
}

function aiExtractionFailureMessage(err: unknown): { message: string; reason?: string } {
  if (err instanceof Error) {
    const lower = err.message.toLowerCase();
    if (lower.includes("not configured")) {
      return {
        message: "Website import isn't turned on here. Fill in your details below.",
        reason: "Import not available",
      };
    }
    if (lower.includes("ai review failed")) {
      return {
        message:
          "We opened your site but couldn't finish the import. Try again in a moment, or fill in below.",
        reason: "Import service busy",
      };
    }
    if (lower.includes("empty response")) {
      return {
        message:
          "We opened your site but didn't get anything useful back. Try again, or fill in below.",
        reason: "Nothing to import",
      };
    }
  }
  return {
    message:
      "We opened your site but couldn't copy your details automatically. Fill in your address and services below.",
    reason: "Import didn't complete",
  };
}

export { fetchPublicPageHtml };

export async function fetchPublicPageText(
  url: string,
  hops = 0,
): Promise<string | null> {
  const html = await fetchPublicPageHtml(url, hops);
  return html ? htmlToText(html) : null;
}

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const s = String(entry ?? "").trim();
    if (s) out.push(s.slice(0, 200));
    if (out.length >= max) break;
  }
  return out;
}

function asFaqs(value: unknown, max: number): WebsiteImportFaq[] {
  if (!Array.isArray(value)) return [];
  const out: WebsiteImportFaq[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const rec = entry as Record<string, unknown>;
    const question = String(rec.question ?? "").trim().slice(0, 300);
    const answer = String(rec.answer ?? "").trim().slice(0, 800);
    if (question) out.push({ question, answer });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Fetch a business website and use AI to extract the bits onboarding needs.
 * Best-effort: returns ok:false with a friendly message on any failure so the
 * caller can fall back to manual entry.
 */
export async function importBusinessFromWebsite(
  rawUrl: string,
): Promise<WebsiteImportResult> {
  const url = await normalisePublicWebsiteUrl(rawUrl);
  if (!url) {
    const invalid = invalidWebsiteUrlMessage(rawUrl);
    return { ok: false, ...invalid };
  }

  const base = `${url.protocol}//${url.host}`;
  const pages: string[] = [];

  const homeResult = await fetchPublicPageTextDetailed(url.toString());
  if (!homeResult.ok) {
    const failure = pageFetchFailureMessage(homeResult.failure, homeResult.httpStatus);
    return { ok: false, ...failure };
  }
  pages.push(homeResult.text);

  const extras = await Promise.all(
    EXTRA_PATHS.map((path) => fetchPublicPageTextDetailed(`${base}/${path}`)),
  );
  for (const extra of extras) {
    if (extra.ok) pages.push(extra.text);
    if (pages.join(" ").length > MAX_TEXT_CHARS) break;
  }

  const text = pages.join("\n\n").slice(0, MAX_TEXT_CHARS).trim();
  if (text.length < 80) {
    return {
      ok: false,
      message:
        "Your homepage didn't have much text we could read — some sites hide content behind images or pop-ups. Fill in your details below.",
      reason: "Very little text on the page",
    };
  }

  try {
    const raw = await completeOpenRouterChat({
      temperature: 0.2,
      maxTokens: 1200,
      messages: [
        {
          role: "system",
          content: `You extract structured business details from website text for an Irish phone-assistant setup.
Return JSON only with this exact shape:
{"businessDescription":"1-2 sentence plain description of what the business does","services":["service",...],"servicesNotOffered":["thing not offered",...],"openingHours":"hours as written, or empty","serviceArea":"towns/areas served, or empty","faqs":[{"question":"...","answer":"..."}],"locations":[{"label":"branch name or town","address":"street address","eircode":"A65 F4E2","phone":"optional","email":"optional"}],"address":"primary street address if one site, else empty","eircode":"single Irish Eircode for primary site, else empty"}
Rules:
- Only use facts present in the text. Never invent prices, hours, or services.
- When the business lists multiple branches/salons, put each in locations with its own address and exactly one eircode per entry. Never combine multiple eircodes into one string.
- Omit future or "coming soon" locations.
- address/eircode top-level fields: only the primary/first listed location when multiple exist; leave both empty when several active branches are listed.
- services / servicesNotOffered: short noun phrases, max 12 each.
- faqs: max 6, real Q&As a caller might ask (booking, hours, pricing policy, location).
- Keep everything concise.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const json = parseWebsiteImportJson(raw);
    if (!json) {
      console.warn("[website-import] json parse failed", raw.slice(0, 240));
      return {
        ok: false,
        message:
          "We opened your site but couldn't copy your details automatically. Fill in your address and services below.",
        reason: "Couldn't read the page content",
      };
    }

    const businessDescription = String(json.businessDescription ?? "")
      .trim()
      .slice(0, 600);

    if (businessDescription.length < 5) {
      return {
        ok: false,
        message:
          "We couldn't tell what your business does from that site. Add a short description on the next steps.",
        reason: "No business description found",
      };
    }

    const flatAddress = String(json.address ?? "").trim().slice(0, 200);
    const flatEircodeRaw = String(json.eircode ?? "").trim();
    const aiLocations = asLocations(json.locations);
    const { locations, address, eircode } = finalizeImportLocations({
      aiLocations,
      flatAddress,
      flatEircode: flatEircodeRaw,
      pageText: text,
    });

    const faqs = mergeMultiLocationFaq(asFaqs(json.faqs, 6), locations);

    const data: WebsiteImportData = {
      businessDescription,
      services: asStringArray(json.services, 12),
      servicesNotOffered: asStringArray(json.servicesNotOffered, 12),
      openingHours: String(json.openingHours ?? "").trim().slice(0, 400),
      serviceArea: String(json.serviceArea ?? "").trim().slice(0, 300),
      faqs,
      address,
      eircode,
      locations,
      regulated: isRegulatedBusinessText(`${businessDescription} ${text.slice(0, 2000)}`),
    };

    return { ok: true, data };
  } catch (err) {
    console.warn("[website-import] extract failed", err);
    const failure = aiExtractionFailureMessage(err);
    return { ok: false, ...failure };
  }
}
