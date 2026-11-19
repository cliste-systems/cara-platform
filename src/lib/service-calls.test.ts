import test from "node:test";
import assert from "node:assert/strict";
import { isServiceFollowUp, serviceCallStatus, serviceCallSearchFilter, serviceCallsHref, type ServiceCall } from "./service-calls";

const base: ServiceCall = {
  id: "call", caller_number: "+353871234567", caller_name: "Caller", created_at: "2026-10-26T12:00:00Z",
  duration_seconds: 60, outcome: "answered", ai_summary: "Asked for a callback", call_resolution: "needs_follow_up",
  post_call_status: "complete", audio_storage_path: null, caller_data_erased_at: null,
  caller_data_erased_by_label: null, caller_data_erased_reason: null,
  follow_up_completed_at: null, is_urgent: false, post_call_expected_ticket: false,
};
test("service completion overrides original callback outcome and can reopen", () => {
  const call = { ...base, outcome: "callback_requested" };
  assert.equal(serviceCallStatus(call), "Follow-up needed");
  assert.equal(serviceCallStatus({ ...call, follow_up_completed_at: "2026-10-26T13:00:00Z" }), "Completed");
  assert.equal(serviceCallStatus({ ...call, follow_up_completed_at: null }), "Follow-up needed");
});
test("pending and erased calls are never actionable follow-ups", () => {
  assert.equal(isServiceFollowUp({ ...base, post_call_status: "pending" }), false);
  assert.equal(isServiceFollowUp({ ...base, caller_data_erased_at: "2026-10-26T13:00:00Z" }), false);
  assert.equal(serviceCallStatus({ ...base, post_call_status: "pending" }), "Processing");
  assert.equal(serviceCallStatus({ ...base, caller_data_erased_at: "2026-10-26T13:00:00Z" }), "Data erased");
});
test("urgent and expected follow-ups follow the existing service queue rules", () => {
  assert.equal(isServiceFollowUp({ ...base, call_resolution: null, post_call_expected_ticket: true }), true);
  assert.equal(serviceCallStatus({ ...base, is_urgent: true }), "Urgent follow-up");
  assert.equal(isServiceFollowUp({ ...base, call_resolution: null }), false);
});
test("search quotes filter punctuation and supports formatted local phone numbers", () => {
  assert.equal(serviceCallSearchFilter(""), null);
  assert.equal(serviceCallSearchFilter("%_*"), null);
  assert.equal(serviceCallSearchFilter('x\",id.neq.fake'), 'caller_name.ilike."*x\\\",id.neq.fake*",caller_number.ilike."*x\\\",id.neq.fake*"');
  assert.match(serviceCallSearchFilter("087 123 4567")!, /caller_number\.ilike\."\*871234567\*"/);
});
test("navigation retains search and date while clearing selected call for pagination", () => {
  const params = new URLSearchParams("date=2026-10-25&q=Emily&call=old&filter=follow_up");
  const href = serviceCallsHref(params, { page: "2", call: null });
  assert.equal(href, "/dashboard/calls?date=2026-10-25&q=Emily&filter=follow_up&page=2");
  assert.equal(params.get("call"), "old");
});

test("compact purposes use the actual callback topic and keep answered calls simple", async () => {
  const { serviceCallPurpose, serviceCallTone } = await import("./service-calls");
  assert.equal(serviceCallPurpose({ ...base, ai_summary: "Requested a callback about service availability." }), "Callback about service availability");
  assert.equal(serviceCallPurpose({ ...base, ai_summary: "Boiler service callback" }), "Callback about boiler service");
  assert.equal(serviceCallPurpose({ ...base, call_resolution: null, outcome: "answered", ai_summary: "Cara answered a question about business hours." }), "Answered");
  const knowledge = { ...base, call_resolution: null, knowledge_question: "Do we offer weekend call-outs?", knowledge_needs_input: true };
  assert.equal(serviceCallPurpose(knowledge), "Cara’s knowledge: Do we offer weekend call-outs?");
  assert.equal(serviceCallTone(knowledge), "knowledge");
  assert.equal(serviceCallTone({ ...knowledge, follow_up_completed_at: "2026-10-26T13:00:00Z" }), "complete");
  assert.equal(serviceCallTone({ ...knowledge, follow_up_completed_at: null }), "knowledge");
});

test("row purposes summarise long topics as complete phrases without trailing dots", async () => {
  const { serviceCallRowPurpose } = await import("./service-calls");
  assert.equal(serviceCallRowPurpose({...base,ai_summary:"Requested a callback about service availability."}),"Callback: Availability");
  assert.equal(serviceCallRowPurpose({...base,ai_summary:"Requested a callback about a complicated request involving several different properties and services."}),"Callback requested");
  assert.equal(serviceCallRowPurpose({...base,knowledge_question:"Do we offer weekend call-outs?",knowledge_needs_input:true}),"Knowledge question");
});
