export type ServiceState = "operational" | "degraded" | "outage" | "maintenance" | "unknown";
export type ServiceReport = { name: string; purpose: string; url: string; state: ServiceState; checkedAt: string; reportedAt?: string; details: string[]; monitored?: string[] };
export const SERVICE_PROVIDERS = [
  ["Supabase", "Database, auth & storage", "https://status.supabase.com"],
  ["Vercel", "Dashboard & APIs", "https://www.vercel-status.com"],
  ["LiveKit", "EU voice sessions, SIP & agents", "https://status.livekit.io"],
  ["Twilio", "Ireland voice, SIP & SMS", "https://status.twilio.com"],
  ["OpenAI", "Conversation & analysis", "https://status.openai.com"],
  ["Stripe", "Payments", "https://www.stripestatus.com"],
  ["Resend", "Email", "https://resend-status.com"],
  ["Cloudflare", "DNS & Turnstile", "https://www.cloudflarestatus.com"],
] as const;
type RecordValue = Record<string, unknown>;
const record = (v: unknown): RecordValue => v && typeof v === "object" ? v as RecordValue : {};
const array = (v: unknown): RecordValue[] => Array.isArray(v) ? v.map(record) : [];
const string = (v: unknown) => typeof v === "string" ? v : "";
export function parseServiceStatus(input: unknown, provider?: string): Pick<ServiceReport, "state" | "details" | "monitored" | "reportedAt"> {
  const data = record(input);
  const flatten = (items: RecordValue[]): RecordValue[] => items.flatMap(c => Array.isArray(c.components) && c.components.some(child => child && typeof child === "object") ? flatten(array(c.components)) : [c]);
  const allComponents = flatten(array(data.components));
  const scope = provider ? SERVICE_COMPONENTS[provider] : undefined;
  const components = scope ? allComponents.filter(c => scope.test(string(c.name)) && !(provider === "Vercel" && c.name === "Builds" && c.group_id !== "47ltvgp4g9fb")) : allComponents;
  const relevantIds = new Set(components.map(c => string(c.id)).filter(Boolean));
  const relevantIncident = (i: RecordValue) => {
    if (!scope) return true;
    const title = string(i.name || i.title);
    if (provider === "Twilio" && /\b(MMS|WhatsApp|SendGrid|Australia|Brazil|United States|North America|APAC|Latin America|United Kingdom|Vodafone UK)\b/i.test(title) && !/\b(Ireland|Irish|IE1|global|worldwide)\b/i.test(title)) return false;
    if (provider === "Twilio" && /\b(Ireland|Irish|IE1)\b/i.test(title) && /\b(voice|calls?|SIP|SMS)\b/i.test(title) && !/\bMMS\b/i.test(title)) return true;
    const linked = [...array(i.components), ...array(i.componentsAffected)];
    if (linked.length) return linked.some(c => relevantIds.has(string(c.id)) || scope.test(string(c.name)));
    // Unscoped announcements are not evidence that a product we use is affected.
    return scope.test(title);
  };
  const incidents = array(data.incidents).filter(relevantIncident).filter(i => i.resolved !== true && !["resolved", "postmortem", "completed"].includes(string(i.status || i.currentStatus)));
  const maintenance = array(data.scheduled_maintenances ?? data.maintenances).filter(relevantIncident).filter(m => ["in_progress", "verifying"].includes(string(m.status || m.currentStatus)));
  const affected = components.filter(c => c.status !== "operational");
  // Vendor-wide rollups include products and regions outside our deployment.
  const indicator = scope ? "" : string(record(data.status).indicator);
  const details = [...maintenance.map(m => string(m.name || m.title)), ...incidents.map(i => string(i.name || i.title)), ...affected.map(c => `${string(c.name)} · ${string(c.status).replaceAll("_", " ") || "status unavailable"}`)].filter(Boolean);
  let state: ServiceState = "unknown";
  if (["critical", "major"].includes(indicator) || affected.some(c => c.status === "major_outage")) state = "outage";
  else if (indicator === "minor" || incidents.length || affected.some(c => ["degraded_performance", "partial_outage"].includes(string(c.status)))) state = "degraded";
  else if (indicator === "maintenance" || maintenance.length || affected.some(c => c.status === "under_maintenance")) state = "maintenance";
  else if (components.length && !affected.length && (!indicator || indicator === "none")) state = "operational";
  const incidentTimes = [...incidents, ...maintenance].map(i => [i.started_at, i.created_at, i.publishedDate].map(string).find(value => value && Number.isFinite(Date.parse(value)))).filter((value): value is string => Boolean(value));
  const reportedAt = incidentTimes.length ? new Date(Math.min(...incidentTimes.map(Date.parse))).toISOString() : undefined;
  return { state, details: details.slice(0, 20), ...(reportedAt ? { reportedAt } : {}), ...(scope ? { monitored: components.map(c => string(c.name)) } : {}) };
}

// Exact product scopes, based on the deployed HelloCara routes and regions.
// Do not select aggregate groups (e.g. Cloudflare Europe or Twilio Messaging):
// their child services can be unrelated to our application.
export const SERVICE_COMPONENTS: Record<string, RegExp> = {
  Supabase: /^(API Gateway|Auth|Connection Pooler|Database|Edge Functions|Realtime|Storage|eu-central-1)$/i,
  Vercel: /^(API|Functions|Cron Jobs|Data Cache|Routing Middleware|TLS Certificates|DUB1 - Dublin, Ireland|Builds|Git Integrations|Deploy Hooks)$/i,
  LiveKit: /^Europe Central - (Real Time Communication|SIP|TURN|Cloud Agents)$/i,
  Twilio: /^(Origination IE1|Termination IE1|SIP Interface IE1|PSTN IE1|Voice REST API IE1|TwiML IE1|SMS)$/i,
  OpenAI: /^(Realtime|Responses)$/i,
  Stripe: /^(Stripe API|Global payments|Revenue and finance automation)$/i,
  Resend: /^(General API|Single Email|Batch Emails|Webhooks|Email Events)$/i,
  Cloudflare: /^(Authoritative DNS|DNS Updates|Turnstile)$/i,
};
