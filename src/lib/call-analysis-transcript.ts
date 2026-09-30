import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
const MAX_TURNS = 10000;

/** Page explicitly: the database API can cap a larger limit at 1,000 rows. */
export async function loadOriginalCallDialogue(admin: SupabaseClient, captureId: string) {
  const turns: { seq: number; speaker: string; text: string | null }[] = [];
  let expected = 0;
  for (let from = 0; from < MAX_TURNS; from += PAGE_SIZE) {
    const page = await admin.from("call_transcript_events")
      .select("seq,speaker,text", {count: "exact"}).eq("capture_id", captureId)
      .eq("source", "formatted_turn").in("speaker", ["caller", "assistant"])
      .order("seq").range(from, from + PAGE_SIZE - 1);
    if (page.error) return { data: turns, count: expected, error: page.error, complete: false };
    if (page.count == null) return { data: turns, count: expected, error: null, complete: false };
    if (from > 0 && page.count !== expected) return { data: turns, count: page.count, error: null, complete: false };
    expected = page.count;
    turns.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < PAGE_SIZE || turns.length >= expected) break;
  }
  return { data: turns, count: expected, error: null, complete: turns.length === expected };
}
