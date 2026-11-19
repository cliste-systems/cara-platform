import { parseTranscriptTurns, stripToolLinesFromTranscript } from "./transcript-display";

function excerpt(text: string, limit: number) {
  const words = text.trim().split(/\s+/);
  return words.length > limit ? `${words.slice(0, limit).join(" ")}…` : words.join(" ");
}

/** Ground the expanded summary in the stored summary and actual conversation. */
export function serviceCallSummary(summary: string, transcript?: string | null) {
  const turns = parseTranscriptTurns(stripToolLinesFromTranscript(transcript).replace(/^Cara:\s*/gim, "Assistant: "));
  const lastResponse = turns.filter(turn => turn.speaker === "Assistant").at(-1)?.text.trim() ?? "";
  const overview = excerpt(summary, 100);
  // Only restate a clearly recorded next step; never invent a promise from an outcome flag.
  const passedToTeam = /^I will pass your request to the team[.!]?$/i.test(lastResponse);
  const alreadyCovered = /pass|forward|team|relay/i.test(summary);
  return {
    overview: passedToTeam && !alreadyCovered && summary.trim().split(/\s+/).length < 80
      ? `${overview.replace(/[.!?]+$/, "")}. Cara said she would pass the request to the team.`
      : overview,
    caller: null,
    response: null,
  };
}
