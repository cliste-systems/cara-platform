import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { customerIncomingCallDetail } from "./dashboard-customer-events";
import { customerUsageFilters, customerKnowledgeEventFilters, CUSTOMER_KNOWLEDGE_EVENT_JOINS, customerTemporalFilters, CUSTOMER_TEMPORAL_JOINS } from "./dashboard-customer-data";
import { readCallsIncomingPlaceholderSession, writeCallsIncomingPlaceholderSession, mergeCallsIncomingPlaceholderSession } from "./calls-incoming-placeholder-session";
import { upsertIncomingCallPlaceholder, shouldClearCallsIncomingPlaceholder, shouldShowCallsIncomingPlaceholder } from "./calls-incoming-placeholder";

const startedAt = "2026-09-28T10:00:00Z";
const customer = { phase: "in_progress" as const, callLogId: null, callerNumber: "+353871234567", startedAt, usageRecordId: "usage-1" };

describe("customer-only incoming call events", () => {
  it("rejects explicit test flags, the simulator number, rooms and QA SIDs before projection", () => {
    for (const marker of [
      { engineer_test_call: true }, { caller_number: "+353870000001", engineer_test_call: false },
      { room_name: "admin-demo-live", engineer_test_call: false }, { is_test_call: true },
      { room_name: "text-rehearsal-test" }, { call_sid: "RT-TEST-USAGE-1" },
      { call_sid: "KAV-TEST-USAGE-1" }, { call_sid: "DEMO-5PART-1" },
    ]) {
      assert.equal(customerIncomingCallDetail({ id: "test", ...marker }, "call_log"), null);
      assert.equal(customerIncomingCallDetail({ id: "test", ...marker }, "usage"), null);
    }
  });
  it("rejects all terminal test reasons even without another marker", () => {
    for (const sync_skip_reason of ["engineer_test_call", "test_data", "test_call"]) {
      assert.equal(customerIncomingCallDetail({ id: "test", sync_skip_reason }, "usage"), null);
    }
  });
  it("does not restore a finished usage row as Live", () => {
    assert.equal(customerIncomingCallDetail({ ended_at: startedAt }, "usage"), null);
  });
  it("preserves a real customer's loading event", () => {
    assert.deepEqual(customerIncomingCallDetail({ id: "call", caller_number: customer.callerNumber, created_at: startedAt, engineer_test_call: false, is_test_call: false }, "call_log"), {
      phase: "loading", callLogId: "call", callerNumber: customer.callerNumber, startedAt,
    });
  });
  it("preserves anonymous customer usage with null metadata", () => {
    assert.deepEqual(customerIncomingCallDetail({ id: "usage", started_at: startedAt, caller_number: null, room_name: null, call_sid: null, sync_skip_reason: null }, "usage"), {
      phase: "in_progress", usageRecordId: "usage", callerNumber: null, startedAt,
    });
  });
  it("replaces the Live entry with Loading rather than adding a duplicate", () => {
    const rows = upsertIncomingCallPlaceholder([customer], { phase: "loading", callLogId: "call-1", callerNumber: customer.callerNumber, startedAt });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.callLogId, "call-1");
    assert.equal(rows[0]?.usageRecordId, "usage-1");
  });
  it("keeps simultaneous calls from different customers separate", () => {
    const rows = upsertIncomingCallPlaceholder([customer], { phase: "in_progress", usageRecordId: "usage-2", callerNumber: "+353879999999", startedAt });
    assert.equal(rows.length, 2);
  });
  it("does not insert an engineer window event or retain stale engineer cards", () => {
    const engineer = { ...customer, callerNumber: "+353870000001", usageRecordId: "test" };
    assert.deepEqual(upsertIncomingCallPlaceholder([customer, engineer], engineer), [customer]);
    assert.equal(shouldShowCallsIncomingPlaceholder({ viewingToday: true, page: 1, placeholder: engineer }), false);
  });
  it("does not clear a live customer because an informational engineer row arrived", () => {
    assert.equal(shouldClearCallsIncomingPlaceholder(customer, [{ id: "engineer", createdAt: startedAt, engineerTestCall: true }]), false);
  });
  it("clears cached engineer placeholders while retaining a customer's session", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    } } });
    try {
      store.set("cliste:calls-incoming:tenant", JSON.stringify({ ...customer, callerNumber: "+353870000001" }));
      assert.equal(readCallsIncomingPlaceholderSession("tenant"), null);
      assert.equal(store.size, 0);
      writeCallsIncomingPlaceholderSession("tenant", customer);
      mergeCallsIncomingPlaceholderSession("tenant", { ...customer, callerNumber: "+353870000001" });
      assert.deepEqual(readCallsIncomingPlaceholderSession("tenant"), customer);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });
});

describe("review regressions", () => {
  function recorder(urls: URL[]) {
    return createClient("https://customer-metrics.test", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (input) => {
        urls.push(new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url));
        return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
      } },
    });
  }
  it("serializes exclusion of the terminal test_call reason", async () => {
    const urls: URL[] = [];
    await customerUsageFilters(recorder(urls).from("usage_records").select("minutes_billable"));
    assert.match(urls[0]!.searchParams.getAll("or")[0]!, /sync_skip_reason\.neq\.test_call/);
  });
  it("anti-joins direct, training and nested ticket sources in event history", async () => {
    const urls: URL[] = [];
    await customerKnowledgeEventFilters(recorder(urls).from("cara_knowledge_events").select(`*,${CUSTOMER_KNOWLEDGE_EVENT_JOINS}`))
      .eq("organization_id", "tenant-a").limit(100);
    const p = urls[0]!.searchParams;
    for (const key of ["test_call", "test_training_call", "test_training_ticket", "test_training_ticket_call"]) assert.equal(p.get(key), "is.null");
    assert.match(p.get("test_training_ticket_call.test_ticket.test_call.or") ?? "", /engineer_test_call\.eq\.true/);
    assert.equal(p.get("organization_id"), "eq.tenant-a");
    assert.equal(p.get("limit"), "100");
  });
  it("filters source-linked temporary knowledge before the limit", async () => {
    const urls: URL[] = [];
    await customerTemporalFilters(recorder(urls).from("cara_knowledge_temporal_updates").select(`*,${CUSTOMER_TEMPORAL_JOINS}`)).limit(200);
    assert.equal(urls[0]!.searchParams.get("test_training_call"), "is.null");
    assert.equal(urls[0]!.searchParams.get("test_training_ticket_call"), "is.null");
  });
  it("uses the raw-row classifier in every live producer and filters both restore queries", () => {
    for (const path of ["src/components/dashboard-live-refresh.tsx", "src/app/(dashboard)/dashboard/call-history/use-calls-live-updates.ts", "src/lib/use-home-live-incoming-calls.ts"]) {
      const text = readFileSync(path, "utf8");
      assert.match(text, /customerIncomingCallDetail\(payload\.new, "usage"\)/, path);
      assert.match(text, /customerIncomingCallDetail\(payload\.new, "call_log"\)/, path);
    }
    for (const path of ["src/app/(dashboard)/dashboard/call-history/use-calls-live-updates.ts", "src/lib/use-home-live-incoming-calls.ts"]) {
      assert.match(readFileSync(path, "utf8"), /customerUsageFilters\(supabase/, path);
    }
  });
});
