import {
  ACTION_CATEGORY_LABELS,
  classifyActionCategory,
} from "@/app/(dashboard)/dashboard/action-inbox/categories";

export type HomeTopTopicRow = {
  id: string;
  label: string;
  count: number;
};

const RETAIL_TOPIC_PATTERNS: ReadonlyArray<{ id: string; label: string; re: RegExp }> = [
  { id: "offers", label: "Offers & promotions", re: /\b(offer|promotion|special|deal|reduced|sale|weekly)\b/i },
  { id: "butcher", label: "Butcher & deli", re: /\b(butcher|deli|meat|steak|bacon|rashers|counter)\b/i },
  { id: "hours", label: "Opening hours", re: /\b(open(?:ing)?|close|hours|today|sunday trading)\b/i },
  { id: "rewards", label: "Real Rewards", re: /\b(real rewards|loyalty|points|app)\b/i },
  { id: "orders", label: "Orders & click & collect", re: /\b(order|click.?&.?collect|collection|pickup|pick up)\b/i },
  { id: "delivery", label: "Delivery", re: /\b(deliver|delivery|driver)\b/i },
  { id: "stock", label: "Stock & availability", re: /\b(in stock|out of stock|have you got|do you sell|availability)\b/i },
];

const SKIP_TOPIC_RE =
  /\b(hung up|hang up|disconnected|no specific request|without any action|ended without|right after cara'?s greeting)\b/i;

function normalizeTopicKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, "-");
}

function truncateTopicLabel(text: string, max = 42): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function inferTopicLabel(summary: string | null | undefined): string {
  const text = String(summary ?? "").replace(/\s+/g, " ").trim();
  if (!text || SKIP_TOPIC_RE.test(text)) return "";

  for (const pattern of RETAIL_TOPIC_PATTERNS) {
    if (pattern.re.test(text)) return pattern.label;
  }

  const category = classifyActionCategory(text);
  if (category === "failed" || category === "unclear") return "";
  return ACTION_CATEGORY_LABELS[category];
}

function bumpTopic(
  counts: Map<string, HomeTopTopicRow>,
  label: string,
  id?: string,
  count = 1,
): void {
  const normalized = label.trim();
  if (!normalized) return;
  const key = id ?? normalizeTopicKey(normalized);
  const existing = counts.get(key);
  if (existing) {
    existing.count += count;
    return;
  }
  counts.set(key, { id: key, label: normalized, count });
}

export function buildHomeTopTopicRows(input: {
  callSummaries: (string | null | undefined)[];
  ticketSummaries: (string | null | undefined)[];
  trainingGaps: (string | null | undefined)[];
  limit?: number;
  weightedCallSummaries?: { summary: string; count: number }[];
}): HomeTopTopicRow[] {
  const limit = input.limit ?? 3;
  const counts = new Map<string, HomeTopTopicRow>();

  for (const row of input.weightedCallSummaries ?? []) {
    bumpTopic(counts, inferTopicLabel(row.summary), undefined, Number(row.count));
  }
  for (const summary of input.callSummaries) {
    bumpTopic(counts, inferTopicLabel(summary));
  }
  for (const summary of input.ticketSummaries) {
    bumpTopic(counts, inferTopicLabel(summary));
  }
  for (const gap of input.trainingGaps) {
    bumpTopic(counts, truncateTopicLabel(String(gap ?? "")));
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}
