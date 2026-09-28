import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCallAnalysis } from "./call-analysis-openai";
import { CALL_ANALYSIS_QUESTIONS, type CallAnalysisInput } from "./call-analysis-simple";

const input: CallAnalysisInput = { transcript: "Caller: Goodbye.\nAssistant: Goodbye.", diagnostics: null, context: {}, call: { durationSeconds: 3, outcome: "resolved", postCallStatus: "complete", postCallErrors: [], expectedTicket: false, hasLinkedTicket: false, transferConnected: null } };
const valid = { summary: "The call ended.", improvement: "No clear improvement from the verified transcript.", checks: CALL_ANALYSIS_QUESTIONS.map(q => ({ id: q.id, answer: "unverified", reason: "Insufficient evidence.", evidence: [] })) };

async function withProvider(body: unknown, status: number, run: (request: () => RequestInit | undefined) => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  let request: RequestInit | undefined;
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  globalThis.fetch = (async (_url: unknown, options?: RequestInit) => { request = options; return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }) as typeof fetch;
  try { await run(() => request); } finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; }
}

test("sends a strict, non-stored review with no model tools", async () => {
  await withProvider({ status: "completed", model: "test-model", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(valid) }] }], usage: { input_tokens: 1, output_tokens: 2 } }, 200, async request => {
    const r = await evaluateCallAnalysis(input);
    const body = JSON.parse(String(request()!.body));
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.reasoning.effort, "medium");
    assert.equal(body.tools, undefined);
    assert.equal(r.result.verdict, "review");
    assert.deepEqual(r.usage, { inputTokens: 1, outputTokens: 2 });
  });
});
test("incomplete output never becomes a completed verdict", async () => {
  await withProvider({ status: "incomplete", output: [] }, 200, async () => { await assert.rejects(evaluateCallAnalysis(input), /did not complete/); });
});
test("model refusal remains an analysis error", async () => {
  await withProvider({ status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] }, 200, async () => { await assert.rejects(evaluateCallAnalysis(input), /manual review/); });
});
test("malformed structured output cannot produce a green call", async () => {
  await withProvider({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "{bad" }] }] }, 200, async () => { await assert.rejects(evaluateCallAnalysis(input), /unreadable/); });
});
test("provider bodies are not exposed in saved error messages", async () => {
  await withProvider({ error: { message: "private caller transcript and secret" } }, 429, async () => {
    await assert.rejects(evaluateCallAnalysis(input), error => error instanceof Error && /rate limited/.test(error.message) && !/private caller|secret/.test(error.message));
  });
});
test("exhausted credits are distinct from temporary rate limits", async () => {
  await withProvider({ error: { code: "credit_balance_exhausted", message: "private provider detail" } }, 429, async () => {
    await assert.rejects(evaluateCallAnalysis(input), error => error instanceof Error && /credits are exhausted/.test(error.message) && !/private provider detail/.test(error.message));
  });
});
test("oversized evidence is rejected without a paid request or silent truncation", async () => {
  await withProvider({}, 200, async request => {
    await assert.rejects(evaluateCallAnalysis({ ...input, transcript: "x".repeat(300_001) }), /exceeds/);
    assert.equal(request(), undefined);
  });
});
