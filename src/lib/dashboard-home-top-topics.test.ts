import assert from "node:assert/strict";
import test from "node:test";
import { buildHomeTopTopicRows } from "./dashboard-home-top-topics";

test("grouped summaries preserve topic counts beyond the API row limit", () => {
  const summaries = Array.from({ length: 1505 }, (_, i) => i < 1201 ? "Opening hours today" : "Delivery driver enquiry");
  assert.deepEqual(
    buildHomeTopTopicRows({callSummaries: [], ticketSummaries: [], trainingGaps: [], weightedCallSummaries: [{summary: "Opening hours today", count: 1201}, {summary: "Delivery driver enquiry", count: 304}]}),
    buildHomeTopTopicRows({callSummaries: summaries, ticketSummaries: [], trainingGaps: []}),
  );
});
