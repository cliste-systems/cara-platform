import { splitExtractedLines } from "@/lib/business-file-preview";
import {
  isBusinessFileKind,
  type BusinessFileKind,
  type BusinessFileListItem,
} from "@/lib/business-files";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BUSINESS_FILE_SEARCH_SELECT_LEGACY,
  businessFileSearchSelectColumns,
  isMissingBusinessFileMetadataColumnError,
  markBusinessFileMetadataColumnsAvailable,
  markBusinessFileMetadataColumnsUnavailable,
  businessFileMetadataColumnsAvailable,
} from "@/lib/business-files-select";

const PRICE_LINE_PATTERN =
  /(?:€|£|\$)\s*\d+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s*(?:€|£|\$|eur|euro)\b/i;

const SEARCH_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "is",
  "it",
  "do",
  "you",
  "we",
  "i",
  "me",
  "my",
  "your",
  "how",
  "much",
  "what",
  "about",
  "with",
  "from",
  "that",
  "this",
  "are",
  "be",
  "can",
  "have",
  "has",
  "does",
  "did",
  "will",
  "would",
  "please",
  "cost",
  "price",
  "much",
]);

export const BUSINESS_FILE_SEARCH_MAX_QUERY_CHARS = 500;
export const BUSINESS_FILE_SEARCH_MAX_EXCERPTS = 5;
export const BUSINESS_FILE_SEARCH_MAX_RESPONSE_CHARS = 2_500;
export const BUSINESS_FILE_SEARCH_MIN_SCORE = 0.15;

export type TextChunk = {
  text: string;
  startLine: number;
  endLine: number;
};

export type FileSearchExcerpt = {
  text: string;
  score: number;
  startLine: number;
  endLine: number;
};

export type BusinessFileSearchMatch = {
  fileId: string;
  fileName: string;
  documentKind: string | null;
  excerpts: FileSearchExcerpt[];
};

export type SearchBusinessFileTextInput = {
  text: string;
  query: string;
  maxChunks?: number;
  maxChars?: number;
  minScore?: number;
};

export type SearchOrgBusinessFilesInput = {
  query: string;
  fileId?: string;
  documentKind?: BusinessFileKind;
  maxExcerpts?: number;
  maxChars?: number;
};

function tokenizeSearchQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9€£$]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !SEARCH_STOPWORDS.has(token));
}

function chunkHasPriceLine(text: string): boolean {
  return splitExtractedLines(text).some((line) => PRICE_LINE_PATTERN.test(line));
}

export function chunkExtractedText(
  text: string,
  opts?: { targetChars?: number; overlapLines?: number },
): TextChunk[] {
  const targetChars = opts?.targetChars ?? 500;
  const overlapLines = opts?.overlapLines ?? 2;
  const lines = splitExtractedLines(text);
  if (lines.length === 0) {
    const trimmed = text.trim();
    return trimmed
      ? [{ text: trimmed, startLine: 1, endLine: 1 }]
      : [];
  }

  const chunks: TextChunk[] = [];
  let index = 0;

  while (index < lines.length) {
    const startIndex = index;
    const chunkLines: string[] = [];
    let charCount = 0;

    while (index < lines.length) {
      const line = lines[index]!;
      const nextCount = charCount + line.length + (chunkLines.length > 0 ? 1 : 0);
      if (chunkLines.length > 0 && nextCount > targetChars) break;
      chunkLines.push(line);
      charCount = nextCount;
      index += 1;
      if (charCount >= targetChars) break;
    }

    if (chunkLines.length === 0) break;

    chunks.push({
      text: chunkLines.join("\n"),
      startLine: startIndex + 1,
      endLine: startIndex + chunkLines.length,
    });

    if (index >= lines.length) break;

    index = Math.max(startIndex + 1, index - overlapLines);
  }

  return chunks;
}

function scoreChunk(chunk: TextChunk, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  const haystack = chunk.text.toLowerCase();
  let hits = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) hits += 1;
  }

  let score = hits / queryTokens.length;
  if (chunkHasPriceLine(chunk.text)) {
    score += 0.1;
  }
  return Math.min(score, 1);
}

export function searchBusinessFileText(
  input: SearchBusinessFileTextInput,
): FileSearchExcerpt[] {
  const query = input.query.trim();
  if (!query) return [];

  const queryTokens = tokenizeSearchQuery(query);
  if (queryTokens.length === 0) return [];

  const maxChunks = input.maxChunks ?? BUSINESS_FILE_SEARCH_MAX_EXCERPTS;
  const maxChars = input.maxChars ?? BUSINESS_FILE_SEARCH_MAX_RESPONSE_CHARS;
  const minScore = input.minScore ?? BUSINESS_FILE_SEARCH_MIN_SCORE;

  const ranked = chunkExtractedText(input.text)
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, queryTokens),
    }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score);

  const excerpts: FileSearchExcerpt[] = [];
  let usedChars = 0;

  for (const entry of ranked) {
    if (excerpts.length >= maxChunks) break;
    const text = entry.chunk.text.trim();
    if (!text) continue;
    const nextChars = usedChars + text.length + (excerpts.length > 0 ? 2 : 0);
    if (excerpts.length > 0 && nextChars > maxChars) break;

    excerpts.push({
      text,
      score: Number(entry.score.toFixed(2)),
      startLine: entry.chunk.startLine,
      endLine: entry.chunk.endLine,
    });
    usedChars = nextChars;
  }

  return excerpts;
}

export function searchBusinessFilesInList(
  files: BusinessFileListItem[],
  input: SearchOrgBusinessFilesInput,
): BusinessFileSearchMatch[] {
  const query = input.query.trim().slice(0, BUSINESS_FILE_SEARCH_MAX_QUERY_CHARS);
  if (!query) return [];

  const maxExcerpts = input.maxExcerpts ?? BUSINESS_FILE_SEARCH_MAX_EXCERPTS;
  const maxChars = input.maxChars ?? BUSINESS_FILE_SEARCH_MAX_RESPONSE_CHARS;

  let candidates = files.filter(
    (file) =>
      file.answerEnabled &&
      file.processingStatus === "ready" &&
      Boolean(file.extractedText?.trim()),
  );

  if (input.fileId) {
    candidates = candidates.filter((file) => file.id === input.fileId);
  }
  if (input.documentKind) {
    candidates = candidates.filter(
      (file) => file.documentKind === input.documentKind,
    );
  }

  const matches: BusinessFileSearchMatch[] = [];

  for (const file of candidates) {
    const excerpts = searchBusinessFileText({
      text: file.extractedText ?? "",
      query,
      maxChunks: maxExcerpts,
      maxChars,
    });
    if (excerpts.length === 0) continue;

    matches.push({
      fileId: file.id,
      fileName: file.fileName,
      documentKind: file.documentKind,
      excerpts,
    });
  }

  return matches.sort((a, b) => {
    const aScore = a.excerpts[0]?.score ?? 0;
    const bScore = b.excerpts[0]?.score ?? 0;
    return bScore - aScore;
  });
}

export async function searchOrgBusinessFiles(
  supabase: SupabaseClient,
  organizationId: string,
  input: SearchOrgBusinessFilesInput,
): Promise<BusinessFileSearchMatch[]> {
  const runQuery = (select: string) => {
    let query = supabase
      .from("business_files")
      .select(select)
      .eq("organization_id", organizationId)
      .eq("answer_enabled", true)
      .eq("processing_status", "ready")
      .not("extracted_text", "is", null);

    if (input.fileId) {
      query = query.eq("id", input.fileId);
    }
    if (input.documentKind) {
      query = query.eq("document_kind", input.documentKind);
    }

    return query;
  };

  let select = businessFileSearchSelectColumns();
  let { data, error } = await runQuery(select);

  if (
    error &&
    isMissingBusinessFileMetadataColumnError(error.message) &&
    businessFileMetadataColumnsAvailable() !== false
  ) {
    markBusinessFileMetadataColumnsUnavailable();
    select = BUSINESS_FILE_SEARCH_SELECT_LEGACY;
    ({ data, error } = await runQuery(select));
  } else if (!error) {
    markBusinessFileMetadataColumnsAvailable();
  }

  if (error || !data) return [];

  const files: BusinessFileListItem[] = (
    data as unknown as Record<string, unknown>[]
  ).map((row) => ({
      id: String(row.id),
      fileName: String(row.file_name),
      fileType: "other",
      mimeType: null,
      sizeBytes: null,
      answerEnabled: Boolean(row.answer_enabled),
      sendEnabled: false,
      documentKind: row.document_kind ? String(row.document_kind) : null,
      title: row.title ? String(row.title) : null,
      caraDescription: row.cara_description ? String(row.cara_description) : null,
      whenToUse: row.when_to_use ? String(row.when_to_use) : null,
      processingStatus: String(
        row.processing_status,
      ) as BusinessFileListItem["processingStatus"],
      extractedText: row.extracted_text ? String(row.extracted_text) : null,
      createdAt: "",
      updatedAt: "",
    }),
  );

  return searchBusinessFilesInList(files, input);
}

export function parseBusinessFileSearchDocumentKind(
  value: unknown,
): BusinessFileKind | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  return isBusinessFileKind(raw) ? raw : undefined;
}
