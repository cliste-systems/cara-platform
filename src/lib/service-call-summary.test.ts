import assert from "node:assert/strict";
import { test } from "node:test";
import { serviceCallSummary } from "./service-call-summary";

test("expands a short summary with actual caller details and Cara's final response", () => {
  const result = serviceCallSummary("Requested a callback.", "Assistant: How can I help today?\n\nCaller: Could someone call me back about service availability?\n\n[Tool result] internal data\n\nAssistant: I will pass your request to the team.");
  assert.equal(result.caller, null);
  assert.equal(result.response, null);
  assert.equal(result.overview, "Requested a callback. Cara said she would pass the request to the team.");
  assert.ok(!JSON.stringify(result).includes("internal data"));
});

test("does not invent detail when no transcript is available or only greetings exist", () => {
  assert.deepEqual(serviceCallSummary("Answered."), {overview:"Answered.",caller:null,response:null});
  assert.equal(serviceCallSummary("Answered.", "Assistant: Hello, how can I help?").response, null);
});

test("recognises Cara-labelled turns without attributing the response to the caller", () => {
  const result = serviceCallSummary("Callback requested.", "Cara: How can I help today?\n\nCaller: Please call me back.\n\nCara: I will pass your request to the team.");
  assert.equal(result.caller,null);
  assert.equal(result.response,null);
  assert.equal(result.overview,"Callback requested. Cara said she would pass the request to the team.");
});

test("bounds long summaries and does not repeat a detailed summary as transcript excerpts", () => {
  const result = serviceCallSummary(Array(150).fill("detail").join(" "), "Caller: A request\nAssistant: A response");
  assert.equal(result.overview.split(/\s+/).length,100);
  assert.ok(result.overview.endsWith("…"));
  assert.equal(result.caller,null);
  assert.equal(result.response,null);
});
