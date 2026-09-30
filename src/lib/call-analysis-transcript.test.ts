import assert from "node:assert/strict";
import { it } from "node:test";
import { loadOriginalCallDialogue } from "./call-analysis-transcript";

function journal(total: number, reported = total) {
 const ranges: number[] = [];
 const rows = Array.from({length: total}, (_, seq) => ({seq, speaker: seq % 2 ? "assistant" : "caller", text: `Turn ${seq}`}));
 const admin = {from() { return {select() {return this;}, eq() {return this;}, in() {return this;}, order() {return this;}, async range(from: number, to: number) {ranges.push(from);return {data: rows.slice(from, to + 1), count: reported, error: null};}};}};
 return {admin: admin as never, ranges};
}

it("loads all original dialogue beyond the database row cap", async () => {
 const db = journal(1505);const result = await loadOriginalCallDialogue(db.admin, "synthetic");
 assert.equal(result.complete, true);assert.equal(result.data.length, 1505);assert.equal(result.data.at(-1)?.text, "Turn 1504");assert.deepEqual(db.ranges, [0,1000]);
});
it("never certifies a truncated or over-limit dialogue as complete", async () => {
 for (const db of [journal(1000,1505),journal(10001)]) {const result = await loadOriginalCallDialogue(db.admin,"synthetic");assert.equal(result.complete,false);}
});
