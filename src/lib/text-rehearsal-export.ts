import type { DemoCallLogEntry } from "@/app/(admin)/admin/demo-calls/demo-call-engineering-log";

export type TextRehearsalExportTurn = {
  caller: string;
  assistant?: string | null;
  tools?: { name: string; args: Record<string, unknown> }[];
  error?: string | null;
  roomName?: string;
};

export type TextRehearsalExportBatchRow = TextRehearsalExportTurn & {
  index: number;
  variant: string;
};

export function formatTextRehearsalExport(input: {
  mode: "single" | "batch";
  storeLabel: string;
  calledNumber: string;
  seed?: string;
  turns?: TextRehearsalExportTurn[];
  batchRows?: TextRehearsalExportBatchRow[];
  issues: DemoCallLogEntry[];
}): string {
  const lines: string[] = [
    "# Text rehearsal export",
    "",
    `Store: ${input.storeLabel}`,
    `Called number: ${input.calledNumber}`,
    `Mode: ${input.mode}`,
    `Exported: ${new Date().toISOString()}`,
  ];

  if (input.seed?.trim()) {
    lines.push(`Seed phrase: ${input.seed.trim()}`);
  }

  lines.push("");

  if (input.mode === "batch" && input.batchRows?.length) {
    lines.push("## Variant batch results");
    for (const row of input.batchRows) {
      lines.push("");
      lines.push(`### ${row.index}. Caller variant`);
      lines.push(row.variant);
      if (row.roomName) lines.push(`Room: ${row.roomName}`);
      if (row.error) {
        lines.push(`Error: ${row.error}`);
      } else {
        lines.push(`Assistant: ${row.assistant?.trim() || "(empty)"}`);
        if (row.tools?.length) {
          for (const tool of row.tools) {
            lines.push(`Tool: ${tool.name} ${JSON.stringify(tool.args)}`);
          }
        }
      }
    }
  } else if (input.turns?.length) {
    lines.push("## Transcript");
    for (const turn of input.turns) {
      lines.push("");
      lines.push(`Caller: ${turn.caller}`);
      if (turn.error) {
        lines.push(`Error: ${turn.error}`);
      } else {
        lines.push(`Assistant: ${turn.assistant?.trim() || "(empty)"}`);
        if (turn.tools?.length) {
          for (const tool of turn.tools) {
            lines.push(`Tool: ${tool.name} ${JSON.stringify(tool.args)}`);
          }
        }
      }
    }
  }

  if (input.issues.length) {
    lines.push("");
    lines.push("## Issues");
    for (const entry of input.issues) {
      const offset =
        entry.atMs >= 0 ? `+${(entry.atMs / 1000).toFixed(1)}s` : "";
      lines.push(`${offset} [${entry.tag}] ${entry.message}`);
    }
  }

  return `${lines.join("\n").trim()}\n`;
}
