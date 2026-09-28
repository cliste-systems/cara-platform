import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  customerCallFilters, customerUsageFilters, customerTrainingFilters, CUSTOMER_TRAINING_JOINS,
  customerKnowledgeEventFilters, CUSTOMER_KNOWLEDGE_EVENT_JOINS, customerTemporalFilters, CUSTOMER_TEMPORAL_JOINS,
  ENGINEER_CALL_FILTER,
} from "./dashboard-customer-data";

// Run by engineer-metrics.yml against a disposable Postgres/PostgREST service.
const endpoint = process.env.ENGINEER_METRICS_REST_URL;
function client(tenant = "mixed") {
  return createClient(endpoint ?? "http://127.0.0.1:54321", "fixture-only", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      url.pathname = url.pathname.replace(/^\/rest\/v1/, "");
      const headers = new Headers(init?.headers);
      headers.delete("authorization");
      headers.delete("apikey");
      headers.set("x-metrics-tenant", tenant);
      return fetch(url, { ...init, headers });
    } },
  });
}

describe("real PostgREST engineer isolation", { skip: !endpoint }, () => {
  it("counts an engineer-only day as zero", async () => {
    const res = await customerCallFilters(client("engineer-only").from("call_logs").select("id", { count: "exact", head: true }));
    assert.equal(res.error, null, JSON.stringify(res.error));
    assert.equal(res.count, 0);
  });
  it("keeps customer counts and durations independent of flagged/legacy/QA calls", async () => {
    const res = await customerCallFilters(client().from("call_logs").select("id,duration_seconds", { count: "exact" }))
      .gte("created_at", "2026-09-27T23:00:00Z").lt("created_at", "2026-09-28T23:00:00Z").order("id");
    assert.equal(res.error, null, JSON.stringify(res.error));
    assert.equal(res.count, 2);
    assert.deepEqual(res.data?.map(row => row.id), ["c1", "c2"]);
    assert.equal(res.data!.reduce((sum, row) => sum + row.duration_seconds, 0) / res.data!.length, 60);
  });
  it("paginates customers separately from the single engineer notice", async () => {
    const db = client();
    const customers = await customerCallFilters(db.from("call_logs").select("id", { count: "exact" })).order("id").range(1,1);
    const notice = await db.from("call_logs").select("id").eq("is_test_call", false).or(ENGINEER_CALL_FILTER).order("id").limit(1);
    assert.equal(customers.error, null, JSON.stringify(customers.error));
    assert.equal(notice.error, null, JSON.stringify(notice.error));
    assert.equal(customers.count, 2);
    assert.deepEqual(customers.data, [{ id: "c2" }]);
    assert.equal(notice.data?.length, 1);
  });
  it("does not leak another tenant through empty source embeds", async () => {
    const res = await customerCallFilters(client().from("call_logs").select("id")).eq("organization_id", "other");
    assert.equal(res.error, null, JSON.stringify(res.error));
    assert.deepEqual(res.data, []);
  });
  it("anti-joins test training via calls, tickets and a ticket's source call", async () => {
    const res = await customerTrainingFilters(client().from("cara_training_items").select(`id,${CUSTOMER_TRAINING_JOINS}`, { count: "exact" })).order("id");
    assert.equal(res.error, null, JSON.stringify(res.error));
    assert.equal(res.count, 2);
    assert.deepEqual(res.data?.map(row => row.id), ["customer", "manual"]);
  });
  it("anti-joins all optional event sources without discarding manual history", async () => {
    const res = await customerKnowledgeEventFilters(client().from("cara_knowledge_events").select(`id,${CUSTOMER_KNOWLEDGE_EVENT_JOINS}`, { count: "exact" })).order("id");
    assert.equal(res.error, null, JSON.stringify(res.error));
    assert.equal(res.count, 2);
    assert.deepEqual(res.data?.map(row => row.id), ["customer-event", "manual-event"]);
  });
  it("keeps test-linked temporary updates out of counts and history", async () => {
    const res = await customerTemporalFilters(client().from("cara_knowledge_temporal_updates").select(`id,${CUSTOMER_TEMPORAL_JOINS}`, { count: "exact" })).order("id");
    assert.equal(res.error, null, JSON.stringify(res.error));
    assert.equal(res.count, 2);
    assert.deepEqual(res.data?.map(row => row.id), ["customer-temporary", "manual-temporary"]);
  });
  it("excludes every test usage reason and legacy marker while keeping normal nulls", async () => {
    const res = await customerUsageFilters(client().from("usage_records").select("id,minutes_billable", { count: "exact" })).order("id");
    assert.equal(res.error, null, JSON.stringify(res.error));
    assert.equal(res.count, 2);
    assert.deepEqual(res.data?.map(row => row.id), ["u1", "u2"]);
    assert.equal(res.data?.reduce((sum, row) => sum + Number(row.minutes_billable), 0), 2);
  });
});
