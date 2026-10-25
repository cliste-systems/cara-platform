/** Internal file instructions and prompt assembly. Do not import from client components. */
import { splitExtractedLines } from "./business-file-preview";

// Preserve the existing server/test API while clients import the preview module directly.
export {
  BUSINESS_FILE_PROMPT_CHAR_BUDGET,
  BUSINESS_FILE_PREVIEW_ITEM_COUNT,
  buildFileExtractionPreview,
  extractedContentLooksLikePii,
  sliceFileTextForPrompt,
  splitExtractedLines,
  type FileExtractionPreview,
  type FilePromptSlice,
} from "./business-file-preview";

export const BUSINESS_FILE_PROMPT_INDEX_SAMPLE_LINES = 5;
export const BUSINESS_FILE_LOOKUP_INSTRUCTION =
  "Uploaded files: look up specific items with search_business_file during the call. Quote only what matches the caller's question — never read the whole document aloud.";

export function buildLargeFilePromptIndex(
  extractedText: string,
  fileName: string,
  kindLabel: string,
  sampleLineCount = BUSINESS_FILE_PROMPT_INDEX_SAMPLE_LINES,
  metadata?: {
    title?: string | null;
    caraDescription?: string | null;
    whenToUse?: string | null;
  },
): string {
  const lines = splitExtractedLines(extractedText);
  const sample =
    lines.length > 0
      ? lines.slice(0, sampleLineCount).join("\n")
      : extractedText.trim().slice(0, 240);
  const lineLabel =
    lines.length === 1 ? "1 line" : `${lines.length} lines`;
  const displayName = metadata?.title?.trim() || fileName;

  const metaLines = [
    metadata?.caraDescription?.trim()
      ? `What it is: ${metadata.caraDescription.trim()}`
      : null,
    metadata?.whenToUse?.trim()
      ? `When to use: ${metadata.whenToUse.trim()}`
      : null,
  ].filter(Boolean);

  return [
    `${kindLabel} (${displayName}) — ${lineLabel}, ${extractedText.length.toLocaleString("en-IE")} characters total.`,
    ...metaLines,
    sample ? `Sample:\n${sample}` : null,
    "Use search_business_file to look up specific items from this file on the call.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildBusinessFileMetadataBlock(file: {
  title?: string | null;
  caraDescription?: string | null;
  whenToUse?: string | null;
}): string {
  const parts: string[] = [];
  if (file.caraDescription?.trim()) {
    parts.push(`What it is: ${file.caraDescription.trim()}`);
  }
  if (file.whenToUse?.trim()) {
    parts.push(`When to use: ${file.whenToUse.trim()}`);
  }
  return parts.join("\n");
}
