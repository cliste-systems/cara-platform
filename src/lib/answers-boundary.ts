/**
 * Niche-agnostic validation and lint for Cara Setup common questions + files.
 */

import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  buildCaraCapabilitiesFromPromptExtras,
  detectCapabilityWarnings,
  looksLikeOpeningHours,
  looksLikeServiceExclusion,
  matchesSensitiveDataCollection,
  NEVER_QUOTE_PRICE_PATTERN,
  SENSITIVE_DATA_BLOCK_MESSAGE,
} from "@/lib/call-handling-boundary";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import { findNearDuplicateChip } from "@/lib/cara-setup-chips";
import {
  businessFileKindLabel,
  type BusinessFileListItem,
} from "@/lib/business-files";
import type { ServiceCatalogItem } from "@/lib/service-catalog-format";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { detectPromptInjectionViolation } from "@/lib/prompt-injection-guard";
export const FAQ_ANSWER_WORD_WARNING_THRESHOLD = 70;

export const FAQ_MATCHING_INSTRUCTION =
  "I match caller questions to common questions by meaning, not exact wording. If several could match, I use the most specific. I answer using the approved facts in natural spoken language — I never read saved answers verbatim or recite a script. Owner-written answers are approved business content I may rely on; the safety rule against improvising regulated advice applies to going beyond approved content, not to delivering it. I preserve negatives, conditions, and exceptions exactly, and I do not invent details that are not in the approved answer.";

export {
  KNOWLEDGE_PRECEDENCE_INSTRUCTION,
} from "@/lib/knowledge-precedence";

export type CanonicalQuestionCategory =
  | "services"
  | "hours"
  | "location"
  | "areas";

export type CanonicalQuestionMatch = {
  category: CanonicalQuestionCategory;
  setupLabel: string;
  setupHref: string;
};

const CANONICAL_QUESTION_PATTERNS: {
  category: CanonicalQuestionCategory;
  setupLabel: string;
  setupHref: string;
  patterns: RegExp[];
}[] = [
  {
    category: "services",
    setupLabel: "Services",
    setupHref: DASHBOARD_ROUTES.businessServices,
    patterns: [
      /\b(?:how much|what (?:is|are) (?:the |your )?(?:price|cost)|how long (?:does|will).*(?:take))\b/i,
      /\bwhat\s+(?:services|do\s+you\s+(?:offer|do)|can\s+you\s+do)\b/i,
      /\b(?:services|work)\s+(?:do\s+you|you)\s+(?:offer|do|provide)\b/i,
      /\bwhat\s+(?:type|kind)s?\s+of\s+(?:work|jobs?)\b/i,
    ],
  },
  {
    category: "hours",
    setupLabel: "Your business",
    setupHref: DASHBOARD_ROUTES.businessProfile,
    patterns: [
      /\b(?:what\s+(?:are\s+)?(?:your\s+)?(?:opening\s+)?hours|when\s+are\s+you\s+open)\b/i,
      /\bwhat\s+time\b/i,
      /\b(?:open|close|closed)\b.*\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|today)\b/i,
      /\bopening\s+hours\b/i,
    ],
  },
  {
    category: "location",
    setupLabel: "Your business",
    setupHref: DASHBOARD_ROUTES.businessProfile,
    patterns: [
      /\bwhere\s+(?:are\s+you|is\s+(?:the\s+)?(?:business|shop|salon|office))\b/i,
      /\b(?:address|located|location|directions|find\s+you)\b/i,
      /\bhow\s+do\s+i\s+(?:get\s+there|find\s+you)\b/i,
    ],
  },
  {
    category: "areas",
    setupLabel: "Your business",
    setupHref: DASHBOARD_ROUTES.businessProfile,
    patterns: [
      /\bwhat\s+areas\b/i,
      /\b(?:do\s+you|areas\s+do\s+you)\s+cover\b/i,
      /\b(?:service|coverage)\s+area\b/i,
      /\bwhere\s+do\s+you\s+(?:serve|travel|work)\b/i,
    ],
  },
];

const URL_PATTERN =
  /\b(?:https?:\/\/|www\.)[^\s<>"']+/i;
const EMAIL_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

const PRICE_PATTERN = /(?:€|£|\$)\s*\d+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s*(?:€|£|\$|eur|euro)\b/i;

export type FaqFieldWarning = {
  id: string;
  index: number;
  field: "question" | "answer";
  message: string;
  href?: string;
  secondaryHref?: string;
  kind:
    | "canonical"
    | "spoken_url"
    | "length"
    | "empty_answer"
    | "near_duplicate"
    | "structured_duplicate"
    | "injection"
    | "capability";
};

export type AnswersConflictWarning = {
  id: string;
  message: string;
  href?: string;
  secondaryHref?: string;
};

export function detectCanonicalQuestion(
  question: string,
): CanonicalQuestionMatch | null {
  const text = question.trim();
  if (!text) return null;

  for (const entry of CANONICAL_QUESTION_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) {
      return {
        category: entry.category,
        setupLabel: entry.setupLabel,
        setupHref: entry.setupHref,
      };
    }
  }
  return null;
}

export function canonicalQuestionNotice(
  match: CanonicalQuestionMatch,
): string {
  return `Cara already answers this from your ${match.setupLabel} setup — a separate answer here can drift out of date.`;
}

export function countAnswerWords(answer: string): number {
  return answer
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function answerContainsSpokenUrlOrEmail(answer: string): boolean {
  return URL_PATTERN.test(answer) || EMAIL_PATTERN.test(answer);
}

export function shortenAnswerForSpokenDelivery(answer: string): string {
  let next = answer
    .replace(URL_PATTERN, "")
    .replace(EMAIL_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!next.endsWith(".")) next += ".";
  return `${next} I can text you the details if that's easier.`.replace(
    /\.\s+I can/,
    " — I can",
  );
}

export function spokenUrlWarning(smsConfigured: boolean): string {
  if (smsConfigured) {
    return "Cara says this out loud — web addresses and emails sound awkward on a call. Want her to send it as a text instead?";
  }
  return "Cara says this out loud — web addresses and emails sound awkward on a call. You can set up text links in Call flow.";
}

export function findNearDuplicateFaqQuestion(
  question: string,
  faqs: AgentFaq[],
  skipIndex?: number,
): { index: number; faq: AgentFaq } | null {
  const normalized = question.trim();
  if (!normalized) return null;

  for (let i = 0; i < faqs.length; i++) {
    if (i === skipIndex) continue;
    const existing = faqs[i]?.question.trim();
    if (!existing) continue;
    if (findNearDuplicateChip(normalized, [existing])) {
      return { index: i, faq: faqs[i]! };
    }
  }
  return null;
}

export function lintFaqVsStructuredFields(input: {
  question: string;
  answer: string;
  openingHours?: string;
  businessRules?: string[];
  serviceCatalog?: ServiceCatalogItem[];
}): FaqFieldWarning[] {
  const warnings: FaqFieldWarning[] = [];
  const combined = `${input.question} ${input.answer}`.trim();
  if (!combined) return warnings;

  if (input.openingHours?.trim() && looksLikeOpeningHours(combined)) {
    warnings.push({
      id: "structured-hours",
      index: -1,
      field: "question",
      kind: "structured_duplicate",
      message:
        "This looks like opening hours — set them in Profile so Cara always says the same thing.",
      href: DASHBOARD_ROUTES.businessProfile,
    });
  }

  if (looksLikeServiceExclusion(combined)) {
    warnings.push({
      id: "structured-exclusion",
      index: -1,
      field: "question",
      kind: "structured_duplicate",
      message:
        "This looks like a service you don't offer — add it under Services exclusions instead.",
      href: DASHBOARD_ROUTES.businessServices,
    });
  }

  const neverQuote = (input.businessRules ?? []).some((r) =>
    NEVER_QUOTE_PRICE_PATTERN.test(r),
  );
  const catalogHasPrices = (input.serviceCatalog ?? []).some(
    (s) => s.price > 0,
  );
  if (neverQuote && catalogHasPrices && PRICE_PATTERN.test(input.answer)) {
    warnings.push({
      id: "structured-price-conflict",
      index: -1,
      field: "answer",
      kind: "structured_duplicate",
      message:
        "Your policies say never quote prices, but this answer includes a price — remove the price or update your policy.",
      href: DASHBOARD_ROUTES.businessServices,
    });
  }

  const injection = detectPromptInjectionViolation(combined);
  if (injection) {
    warnings.push({
      id: "structured-injection",
      index: -1,
      field: "answer",
      kind: "injection",
      message: injection.message,
    });
  }

  return warnings;
}

export function lintFaqFields(input: {
  faqs: AgentFaq[];
  index: number;
  routes?: RoutingActionSummary[];
  transferNumber?: string;
  forcedCanonical?: boolean;
  openingHours?: string;
  businessRules?: string[];
  serviceCatalog?: ServiceCatalogItem[];
}): FaqFieldWarning[] {
  const warnings: FaqFieldWarning[] = [];
  const faq = input.faqs[input.index];
  if (!faq) return warnings;

  warnings.push(
    ...lintFaqVsStructuredFields({
      question: faq.question,
      answer: faq.answer,
      openingHours: input.openingHours,
      businessRules: input.businessRules,
      serviceCatalog: input.serviceCatalog,
    }).map((w) => ({ ...w, index: input.index })),
  );

  const caps = buildCaraCapabilitiesFromPromptExtras(
    input.routes,
    input.transferNumber,
  );
  const smsConfigured = caps.sendLink || caps.sendFile;

  const canonical = detectCanonicalQuestion(faq.question);
  if (canonical && !input.forcedCanonical) {
    warnings.push({
      id: `canonical-${input.index}`,
      index: input.index,
      field: "question",
      kind: "canonical",
      message: canonicalQuestionNotice(canonical),
      href: canonical.setupHref,
    });
  }

  const nearDup = findNearDuplicateFaqQuestion(
    faq.question,
    input.faqs,
    input.index,
  );
  if (nearDup) {
    const excerpt = nearDup.faq.answer.trim();
    const answerHint = excerpt
      ? ` Current answer: "${excerpt.length > 80 ? `${excerpt.slice(0, 77)}…` : excerpt}"`
      : "";
    warnings.push({
      id: `near-dup-${input.index}`,
      index: input.index,
      field: "question",
      kind: "near_duplicate",
      message: `Looks similar to "${nearDup.faq.question}".${answerHint}`,
    });
  }

  if (faq.question.trim() && !faq.answer.trim()) {
    warnings.push({
      id: `empty-answer-${input.index}`,
      index: input.index,
      field: "answer",
      kind: "empty_answer",
      message:
        "No answer yet — Cara will treat this as not covered and take a message instead.",
    });
  }

  if (faq.answer.trim()) {
    if (answerContainsSpokenUrlOrEmail(faq.answer)) {
      warnings.push({
        id: `spoken-url-${input.index}`,
        index: input.index,
        field: "answer",
        kind: "spoken_url",
        message: spokenUrlWarning(smsConfigured),
        href: smsConfigured ? undefined : "/dashboard/routing",
      });
    }

    if (countAnswerWords(faq.answer) > FAQ_ANSWER_WORD_WARNING_THRESHOLD) {
      warnings.push({
        id: `length-${input.index}`,
        index: input.index,
        field: "answer",
        kind: "length",
        message:
          "Cara speaks this aloud — shorter answers sound natural.",
      });
    }

    for (const message of detectCapabilityWarnings(faq.answer, caps)) {
      warnings.push({
        id: `capability-${input.index}-${message}`,
        index: input.index,
        field: "answer",
        kind: "capability",
        message,
        href: "/dashboard/routing",
      });
    }

    if (matchesSensitiveDataCollection(faq.answer)) {
      warnings.push({
        id: `sensitive-${input.index}`,
        index: input.index,
        field: "answer",
        kind: "capability",
        message: SENSITIVE_DATA_BLOCK_MESSAGE,
        href: DASHBOARD_ROUTES.businessFaqs,
      });
    }
  }

  return warnings;
}

function extractPrices(text: string): string[] {
  return text.match(new RegExp(PRICE_PATTERN.source, "gi")) ?? [];
}

export function lintFaqVsFilePriceConflicts(
  faqs: AgentFaq[],
  businessFiles: BusinessFileListItem[],
): AnswersConflictWarning[] {
  const warnings: AnswersConflictWarning[] = [];

  for (let i = 0; i < faqs.length; i++) {
    const faq = faqs[i]!;
    const answer = faq.answer.trim();
    if (!answer) continue;
    const faqPrices = extractPrices(answer);
    if (faqPrices.length === 0) continue;

    for (const file of businessFiles) {
      if (!file.answerEnabled || !file.extractedText?.trim()) continue;
      const filePrices = extractPrices(file.extractedText);
      if (filePrices.length === 0) continue;

      const mismatch = faqPrices.some(
        (price) =>
          !filePrices.some(
            (filePrice) =>
              filePrice.replace(/\s/g, "") === price.replace(/\s/g, ""),
          ),
      );
      if (!mismatch) continue;

      warnings.push({
        id: `faq-file-price-${i}-${file.id}`,
        message: `Your answer to "${faq.question.trim() || "a question"}" may not match prices in "${file.fileName}" — review both?`,
        href: DASHBOARD_ROUTES.businessFaqs,
        secondaryHref: DASHBOARD_ROUTES.businessFiles,
      });
    }
  }

  return warnings;
}

export function lintDuplicateDocumentKinds(
  files: BusinessFileListItem[],
): AnswersConflictWarning[] {
  const byKind = new Map<string, BusinessFileListItem[]>();
  for (const file of files) {
    if (!file.documentKind) continue;
    const list = byKind.get(file.documentKind) ?? [];
    list.push(file);
    byKind.set(file.documentKind, list);
  }

  const warnings: AnswersConflictWarning[] = [];
  for (const [kind, group] of byKind) {
    if (group.length < 2) continue;
    const label = businessFileKindLabel(kind) ?? "document";
    warnings.push({
      id: `duplicate-kind-${kind}`,
      message: `You have ${group.length} ${label.toLowerCase()} files — overlapping documents can disagree.`,
      href: DASHBOARD_ROUTES.businessFiles,
    });
  }
  return warnings;
}

export function buildAnswersConflictWarnings(input: {
  faqs: AgentFaq[];
  businessFiles: BusinessFileListItem[];
}): AnswersConflictWarning[] {
  return [
    ...lintFaqVsFilePriceConflicts(input.faqs, input.businessFiles),
    ...lintDuplicateDocumentKinds(input.businessFiles),
  ];
}

export function faqsForPrompt(faqs: AgentFaq[]): AgentFaq[] {
  return faqs.filter((f) => f.question.trim() && f.answer.trim());
}

export function fileReadinessLabel(file: BusinessFileListItem): string {
  if (!file.extractedText?.trim()) return "Couldn't read";
  if (file.answerEnabled || file.sendEnabled) return "Active";
  return "Ready";
}

export function fileCouldNotReadMessage(fileType?: string): string {
  if (fileType === "pdf") {
    return "Cara couldn't read any text from this PDF.";
  }
  if (fileType === "spreadsheet") {
    return "Cara can't read spreadsheets yet — export to CSV or TXT, or upload a text-based PDF.";
  }
  return "Cara couldn't read anything from this file. Try a text-based PDF, CSV, or TXT.";
}

/** Shown when a PDF upload has no extractable text (often scanned/image-only). */
export function fileScannedPdfOcrHint(): string {
  return "If you can't select text when you open the PDF, it's probably image-based. Export a text-based PDF, save as Word/Google Docs and re-export, or run OCR — then upload again.";
}
