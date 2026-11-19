/** Browser-safe file preview helpers. Internal call instructions live in business-file-prompt.ts. */
export const BUSINESS_FILE_PROMPT_CHAR_BUDGET = 12_000;
export const BUSINESS_FILE_PREVIEW_ITEM_COUNT = 10;

export type FileExtractionPreview = {
  items: string[];
  totalCount: number;
  summary: string;
};

export type FilePromptSlice = {
  text: string;
  wasTruncated: boolean;
  totalChars: number;
};

export function splitExtractedLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildFileExtractionPreview(
  extractedText: string | null | undefined,
): FileExtractionPreview | null {
  const raw = extractedText?.trim();
  if (!raw) return null;

  const lines = splitExtractedLines(raw);
  const items =
    lines.length > 0
      ? lines.slice(0, BUSINESS_FILE_PREVIEW_ITEM_COUNT)
      : raw
          .split(/\s{2,}/)
          .map((part) => part.trim())
          .filter(Boolean)
          .slice(0, BUSINESS_FILE_PREVIEW_ITEM_COUNT);

  const totalCount = lines.length > 0 ? lines.length : items.length;
  const summary =
    totalCount > BUSINESS_FILE_PREVIEW_ITEM_COUNT
      ? `${totalCount} lines read`
      : totalCount === 1
        ? "1 line read"
        : `${totalCount} lines read`;

  return { items, totalCount, summary };
}

export function sliceFileTextForPrompt(
  extractedText: string | null | undefined,
  budget = BUSINESS_FILE_PROMPT_CHAR_BUDGET,
): FilePromptSlice | null {
  const raw = extractedText?.trim();
  if (!raw) return null;

  if (raw.length <= budget) {
    return { text: raw, wasTruncated: false, totalChars: raw.length };
  }

  const truncated = `${raw.slice(0, budget).trimEnd()}…`;
  return {
    text: truncated,
    wasTruncated: true,
    totalChars: raw.length,
  };
}

const PII_EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PII_PHONE_PATTERN =
  /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b/g;

export function extractedContentLooksLikePii(text: string): boolean {
  const emails = text.match(PII_EMAIL_PATTERN) ?? [];
  const phones = text.match(PII_PHONE_PATTERN) ?? [];
  return emails.length >= 3 || phones.length >= 5;
}
