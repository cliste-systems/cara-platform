/** Sub-processor list version — bump when SUB_PROCESSORS changes; triggers customer email notice. */
export const SUB_PROCESSOR_LIST_VERSION = "2026-09-23b";

/** Sub-processor registry — update here; legal pages import this source. */

export type SubProcessorGroup = "eea-hosting" | "us-voice" | "global-services";

export type SubProcessor = {
  name: string;
  purpose: string;
  data: string;
  location: string;
  transferMechanism: string;
  url: string;
  group: SubProcessorGroup;
};

/** Named vendors (required in DPA / customer annex — Art 28 GDPR, SCC Module 3). */
export const SUB_PROCESSORS: SubProcessor[] = [
  {
    name: "Supabase (Supabase, Inc.)",
    purpose: "Database, authentication, server-side operations.",
    data: "Business and caller data (encrypted at rest), including call recordings in private Storage (30 days).",
    location: "EEA — AWS eu-west-1 (Ireland). Primary data store.",
    transferMechanism: "No third-country transfer for primary database.",
    url: "https://supabase.com/privacy",
    group: "eea-hosting",
  },
  {
    name: "Vercel (Vercel Inc.)",
    purpose: "Application hosting (Next.js dashboard and APIs).",
    data: "Server logs, request metadata.",
    location: "EEA — production functions in dub1 (Dublin, Ireland).",
    transferMechanism:
      "Primary compute in EU; global CDN / DDoS edge may see request metadata (SCCs).",
    url: "https://vercel.com/legal/privacy-policy",
    group: "eea-hosting",
  },
  {
    name: "LiveKit Cloud (LiveKit, Inc.)",
    purpose: "Realtime voice infrastructure and AI agent worker hosting.",
    data: "Call audio streams, agent observability (traces/logs when enabled), call-handling metadata.",
    location:
      "EEA — agent compute eu-central (Frankfurt); project data region EU (Frankfurt); SIP EU endpoint.",
    transferMechanism:
      "EU project data region + eu-central agent hosting; inference region restriction enabled.",
    url: "https://livekit.io/privacy",
    group: "eea-hosting",
  },
  {
    name: "Stripe (Stripe Payments Europe Ltd)",
    purpose: "Platform subscription billing and customer portal.",
    data: "Billing contact, payment method tokens, invoice metadata.",
    location: "EU (Ireland) entity; global processing for fraud detection.",
    transferMechanism: "Stripe DPA + SCCs.",
    url: "https://stripe.com/legal/privacy-center",
    group: "global-services",
  },
  {
    name: "Twilio (Twilio Ireland Ltd)",
    purpose:
      "Irish phone numbers (SIP ingress), outbound SMS (e.g. Action Inbox alerts).",
    data: "Caller/callee numbers, message body, delivery status, SIP metadata.",
    location: "EU entity; carrier routing may leave EEA.",
    transferMechanism: "Twilio DPA + SCCs.",
    url: "https://www.twilio.com/legal/privacy",
    group: "global-services",
  },
  {
    name: "Resend (Resend, Inc.)",
    purpose: "Transactional email (e.g. Action Inbox, account notices).",
    data: "Recipient email, message body.",
    location: "United States (global API).",
    transferMechanism: "SCCs (Module 3) under Resend DPA.",
    url: "https://resend.com/legal/privacy-policy",
    group: "global-services",
  },
  {
    name: "Cloudflare (Cloudflare Ireland Ltd)",
    purpose: "DNS, CDN, WAF, Turnstile on login.",
    data: "Request metadata, IP, challenge tokens.",
    location: "EU entity; global edge network.",
    transferMechanism: "Cloudflare DPA + SCCs.",
    url: "https://www.cloudflare.com/privacypolicy",
    group: "global-services",
  },
  {
    name: "LiveKit Cloud (LiveKit, Inc.)",
    purpose:
      "Real-time SIP / WebRTC, in-call speech recognition (LiveKit Agents), and voice agent runtime.",
    data: "Audio in transit; call recordings (MP3, up to 30 days in Supabase Storage via egress), call metadata, caller number, transient transcripts.",
    location:
      "Inbound telephony: EU SIP (Frankfurt) via Twilio trunk. WebRTC / agent media: global routing until LiveKit protocol region pinning is enabled.",
    transferMechanism:
      "EU SIP path stays in EEA; SCCs (Module 3) for WebRTC traffic routed outside EEA until protocol pinning is enabled.",
    url: "https://livekit.io/privacy",
    group: "us-voice",
  },
  {
    name: "ElevenLabs (ElevenLabs Inc.)",
    purpose: "Text-to-speech for the voice agent and onboarding voice preview.",
    data: "Generated speech text (transient).",
    location:
      "United States (global API). EU data residency available on Enterprise plans.",
    transferMechanism:
      "SCCs (Module 3) under ElevenLabs DPA; EU data residency available on Enterprise plans.",
    url: "https://elevenlabs.io/privacy",
    group: "us-voice",
  },
  {
    name: "OpenRouter (OpenRouter, Inc.)",
    purpose:
      "LLM routing for the voice agent and dashboard AI helpers (onboarding, knowledge).",
    data: "Conversation / business text (no audio). Underlying model providers vary.",
    location:
      "United States. EU in-region routing available for enterprise accounts (eu.openrouter.ai).",
    transferMechanism:
      "SCCs (Module 3) under OpenRouter DPA; ZDR and provider allowlists as supplementary measures.",
    url: "https://openrouter.ai/privacy",
    group: "us-voice",
  },
  {
    name: "Google (Google Ireland Ltd) — optional",
    purpose: "Geocoding Irish service-area addresses when a Maps API key is set.",
    data: "Address / Eircode text sent for geocoding.",
    location: "EU entity; processing may occur globally.",
    transferMechanism: "Google Cloud DPA + SCCs.",
    url: "https://policies.google.com/privacy",
    group: "global-services",
  },
  {
    name: "Sentry (Functional Software, Inc.)",
    purpose: "Error monitoring and performance traces for the dashboard and APIs.",
    data: "Stack traces, request metadata — no intentional caller audio or transcripts.",
    location:
      "United States (default). EU data residency available on Business plans.",
    transferMechanism:
      "SCCs (Module 3) under Sentry DPA; EU residency when enabled.",
    url: "https://sentry.io/privacy/",
    group: "global-services",
  },
];

/** Category summary for public privacy pages (Art 13/14 — categories of recipients). */
export const SUB_PROCESSOR_CATEGORIES_PUBLIC = [
  {
    category: "Cloud database & authentication",
    purpose: "Store business accounts, caller records, transcripts, call recordings, and dashboard data.",
    location: "EEA (Ireland)",
    transfers: "None for primary storage.",
  },
  {
    category: "Application & worker hosting",
    purpose: "Run the dashboard, APIs, and real-time voice worker.",
    location: "EEA (Ireland / EU West)",
    transfers: "CDN edge metadata may leave EEA (SCCs).",
  },
  {
    category: "Real-time voice & speech recognition",
    purpose:
      "Connect phone calls to the AI agent; in-call speech recognition via LiveKit Agents; call recording egress to Supabase Storage (30 days).",
    location: "EU SIP (Frankfurt) for inbound calls; WebRTC global until pinned",
    transfers: "None on SIP path; SCCs for unpinned WebRTC.",
  },
  {
    category: "Speech & language AI",
    purpose: "Text-to-speech and LLM conversation (transient).",
    location: "United States (EU options for some vendors)",
    transfers: "SCCs (Module 3).",
  },
  {
    category: "Payments, messaging, security & observability",
    purpose: "Billing, SMS/email alerts, DDoS protection, error monitoring.",
    location: "EU entity; some US / global processing",
    transfers: "Vendor DPAs + SCCs.",
  },
] as const;

export const SUB_PROCESSOR_GROUP_LABELS: Record<SubProcessorGroup, string> = {
  "eea-hosting": "EEA hosting — primary data & compute",
  "us-voice": "Voice AI — transient processing (US today; EU options noted)",
  "global-services": "Payments, messaging & security",
};
