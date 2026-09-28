import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { CallHistoryListItem } from "@/app/(dashboard)/dashboard/call-history/call-history-helpers";
import type { ActionInboxItem } from "@/app/(dashboard)/dashboard/action-inbox/action-inbox-helpers";
import {
  buildDepartmentOverviewMetrics,
  buildDepartmentInboxMetrics,
  type DepartmentTicketRow,
} from "@/app/(dashboard)/dashboard/departments/department-helpers";
import { resolveCustomerCallHistoryMetrics } from "./customer-call-history-metrics";
import { buildDashboardActivityFeed, buildHomeLiveActivityFeed } from "./dashboard-activity-feed";
import { fetchDashboardNavBadges } from "./dashboard-nav-badges";
import {
  customerCallFilters,
  customerTicketFilters,
  customerTrainingFilters,
  customerUsageFilters,
  CUSTOMER_TRAINING_JOINS,
  isCustomerCallRow,
} from "./dashboard-customer-data";

const engineerNumber = "+353870000001";
const customerNumber = "+353871234567";
const emptyMetrics = { totalCalls: 0, needsAttentionCount: 0, avgDurationLabel: "—" };

function call(overrides: Partial<CallHistoryListItem> = {}): CallHistoryListItem {
  return {
    id: "customer", createdAt: "2026-09-28T10:00:00Z", dateTimeLabel: "today",
    callerId: customerNumber, callerDisplay: customerNumber, callerName: null,
    durationSeconds: 30, durationLabel: "30s", outcome: "answered", outcomeLabel: "Answered",
    intentLabel: "General", summaryPreview: null, transcriptVerbatim: "", transcriptReview: null,
    aiSummary: null, hasOpenAction: false, followUp: null, postCallStatus: "complete",
    hasRecording: false, departmentLink: null, attentionLevel: "routine", actionCategory: null,
    callResolution: null, callerDataErasedAt: null, callerDataErasedByLabel: null,
    callerDataErasedReason: null, engineerTestCall: false, ...overrides,
  };
}

function engineer(overrides: Partial<CallHistoryListItem> = {}) {
  return call({
    id: "engineer", callerId: engineerNumber, engineerTestCall: true,
    durationSeconds: 999, outcome: "failed", postCallStatus: "failed", hasOpenAction: true,
    ...overrides,
  });
}

function apiRecorder() {
  const requests: { url: URL; method: string }[] = [];
  const client = createClient("https://customer-metrics.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        const method = init?.method ?? "GET";
        requests.push({ url, method });
        return new Response(method === "HEAD" ? null : "[]", {
          status: 200, headers: { "content-type": "application/json", "content-range": "*/0" },
        });
      },
    },
  });
  return { client, requests };
}

describe("engineer calls never become customer metrics", () => {
  it("keeps an engineer-only day at zero, with no average or attention count", () => {
    const result = resolveCustomerCallHistoryMetrics({
      calls: Array.from({ length: 6 }, (_, i) => engineer({ id: `e${i}` })),
      serverMetrics: emptyMetrics, totalCount: 0, page: 1, pageSize: 25,
    });
    assert.deepEqual(result, emptyMetrics);
  });

  it("ignores the informational row when recalculating a mixed day client-side", () => {
    const result = resolveCustomerCallHistoryMetrics({
      calls: [engineer(), call({ id: "c1", durationSeconds: 30 }), call({ id: "c2", durationSeconds: 90 })],
      serverMetrics: { ...emptyMetrics, totalCalls: 2 }, totalCount: 2, page: 1, pageSize: 25,
    });
    assert.deepEqual(result, { totalCalls: 2, needsAttentionCount: 0, avgDurationLabel: "1m 00s" });
  });

  it("does not count legacy simulator rows with a missing engineer flag", () => {
    assert.deepEqual(resolveCustomerCallHistoryMetrics({
      calls: [engineer({ engineerTestCall: false })], serverMetrics: emptyMetrics,
      totalCount: 0, page: 1, pageSize: 25,
    }), emptyMetrics);
  });

  it("keeps whole-day server metrics on a later customer page", () => {
    const metrics = { totalCalls: 80, needsAttentionCount: 3, avgDurationLabel: "42s" };
    assert.deepEqual(resolveCustomerCallHistoryMetrics({
      calls: [engineer(), call()], serverMetrics: metrics, totalCount: 80, page: 2, pageSize: 25,
    }), metrics);
  });

  it("retains the empty day without inventing a call", () => {
    assert.deepEqual(resolveCustomerCallHistoryMetrics({
      calls: [], serverMetrics: emptyMetrics, totalCount: 0, page: 1, pageSize: 25,
    }), emptyMetrics);
  });

  it("recognises explicit flags, legacy numbers, rooms and ordinary QA calls", () => {
    assert.equal(isCustomerCallRow({ engineer_test_call: true }), false);
    assert.equal(isCustomerCallRow({ caller_number: engineerNumber, engineer_test_call: false }), false);
    assert.equal(isCustomerCallRow({ caller_number: customerNumber, room_name: "admin-demo-test", engineer_test_call: false }), false);
    assert.equal(isCustomerCallRow({ caller_number: customerNumber, is_test_call: true }), false);
    assert.equal(isCustomerCallRow({ caller_number: customerNumber, engineer_test_call: false, is_test_call: false, room_name: null }), true);
  });
});

describe("single informational activity entry", () => {
  it("collapses six tests to the latest entry without losing customers", () => {
    const tests = Array.from({ length: 6 }, (_, i) => ({
      id: `e${i}`, created_at: `2026-09-28T10:00:0${i}Z`, outcome: "callback_requested",
      caller_number: engineerNumber, engineer_test_call: i % 2 === 0,
    }));
    const rows = buildDashboardActivityFeed({
      calls: [
        ...tests,
        { id: "c1", created_at: "2026-09-28T10:01:00Z", outcome: "answered", caller_number: customerNumber },
        { id: "c2", created_at: "2026-09-28T09:00:00Z", outcome: "answered", caller_number: customerNumber },
      ],
      tickets: [], formatTime: () => "now", limit: 3,
    });
    assert.deepEqual(rows.map((row) => row.id), ["c1-call", "e5-call", "c2-call"]);
    assert.equal(rows.filter((row) => row.title === "HelloCara Engineer").length, 1);
    assert.equal(rows[1]?.subtitle, "Test call · not billed");
    assert.equal(rows[1]?.badge, "HelloCara Engineer");
  });

  it("uses room metadata and excludes separate QA records and engineer requests", () => {
    const rows = buildDashboardActivityFeed({
      calls: [
        { id: "room-test", created_at: "2026-09-28T10:00:00Z", outcome: "link_sent", caller_number: customerNumber, room_name: "admin-demo-room" },
        { id: "qa", created_at: "2026-09-28T10:01:00Z", outcome: "answered", caller_number: customerNumber, is_test_call: true },
      ],
      tickets: [
        { id: "engineer-ticket", created_at: "2026-09-28T10:00:01Z", engineer_test_call: true },
        { id: "legacy-ticket", created_at: "2026-09-28T10:00:02Z", caller_number: engineerNumber },
        { id: "customer-ticket", created_at: "2026-09-28T10:00:03Z", caller_number: customerNumber },
      ], formatTime: () => "now",
    });
    assert.deepEqual(rows.map((row) => row.id), ["customer-ticket-ticket", "room-test-call"]);
    assert.equal(rows[1]?.title, "HelloCara Engineer");
  });

  it("keeps home activity chronological after collapse and ignores invalid dates", () => {
    const rows = buildHomeLiveActivityFeed({ calls: [
      { id: "invalid", created_at: "invalid", outcome: "answered", caller_number: engineerNumber },
      { id: "e1", created_at: "2026-09-28T09:00:00Z", outcome: "answered", caller_number: engineerNumber },
      { id: "c", created_at: "2026-09-28T11:00:00Z", outcome: "answered", caller_number: customerNumber },
      { id: "e2", created_at: "2026-09-28T10:00:00Z", outcome: "answered", caller_number: engineerNumber },
    ], formatTime: () => "now" });
    assert.deepEqual(rows.map((row) => row.id), ["c-call", "e2-call"]);
  });
});

describe("database filters precede customer counts and pagination", () => {
  it("serialises call exclusions while preserving tenant, date, and range", async () => {
    const { client, requests } = apiRecorder();
    await customerCallFilters(client.from("call_logs").select("id", { count: "exact" })
      .eq("organization_id", "tenant-a"))
      .gte("created_at", "2026-09-27T23:00:00Z").lt("created_at", "2026-09-28T23:00:00Z")
      .order("created_at", { ascending: false }).range(25, 49);
    const params = requests[0]!.url.searchParams;
    assert.equal(params.get("organization_id"), "eq.tenant-a");
    assert.equal(params.get("is_test_call"), "eq.false");
    assert.equal(params.get("engineer_test_call"), "eq.false");
    assert.equal(params.get("caller_number"), `neq.${engineerNumber}`);
    assert.match(params.get("or") ?? "", /room_name\.is\.null,room_name\.not\.like\.admin-demo-\*/);
    assert.equal(params.get("offset"), "25");
    assert.equal(params.get("limit"), "25");
    assert.equal(params.getAll("created_at").length, 2);
  });

  it("serialises exact request counts without counting engineer artifacts", async () => {
    const { client, requests } = apiRecorder();
    await customerTicketFilters(client.from("action_tickets").select("id", { count: "exact", head: true }))
      .in("organization_id", ["tenant-a", "tenant-b"]);
    const params = requests[0]!.url.searchParams;
    assert.equal(requests[0]!.method, "HEAD");
    assert.equal(params.get("engineer_test_call"), "eq.false");
    assert.equal(params.get("caller_number"), `neq.${engineerNumber}`);
    assert.equal(params.get("organization_id"), "in.(tenant-a,tenant-b)");
  });

  it("excludes legacy and marked usage while preserving null metadata", async () => {
    const { client, requests } = apiRecorder();
    await customerUsageFilters(client.from("usage_records").select("minutes_billable"));
    const filters = requests[0]!.url.searchParams.getAll("or");
    assert.equal(filters.length, 4);
    assert.match(filters[0]!, /sync_skip_reason\.is\.null/);
    assert.match(filters[0]!, /engineer_test_call/);
    assert.match(filters[0]!, /test_data/);
    assert.ok(filters[1]!.includes(`caller_number.neq.${engineerNumber}`));
    assert.match(filters[1]!, /caller_number\.is\.null/);
    assert.match(filters[2]!, /room_name\.is\.null/);
    assert.match(filters[2]!, /admin-demo-/);
    assert.match(filters[2]!, /text-rehearsal-/);
    assert.match(filters[3]!, /RT-TEST-/);
  });

  it("anti-joins source-linked training without dropping manually taught items", async () => {
    const { client, requests } = apiRecorder();
    await customerTrainingFilters(client.from("cara_training_items")
      .select(`id,${CUSTOMER_TRAINING_JOINS}`, { count: "exact", head: true }))
      .eq("organization_id", "tenant-a");
    const params = requests[0]!.url.searchParams;
    assert.equal(params.get("test_call"), "is.null");
    assert.equal(params.get("test_ticket"), "is.null");
    assert.match(params.get("test_call.or") ?? "", /is_test_call\.eq\.true/);
    assert.match(params.get("test_ticket.or") ?? "", /engineer_test_call\.eq\.true/);
    assert.ok(params.get("select")?.includes("test_call:call_logs()"));
    assert.equal(params.get("organization_id"), "eq.tenant-a");
  });

  it("uses the same exclusions for both initial and refreshed sidebar badges", async () => {
    const { client, requests } = apiRecorder();
    const badges = await fetchDashboardNavBadges(client, "tenant-a", null);
    assert.equal(badges["/dashboard/calls"], 0);
    assert.equal(badges["/dashboard/call-history"], 0);
    const callRequest = requests.find(({ url }) => url.pathname.endsWith("/call_logs"))!;
    assert.equal(callRequest.url.searchParams.get("engineer_test_call"), "eq.false");
    assert.equal(callRequest.url.searchParams.get("is_test_call"), "eq.false");
    const trainingRequest = requests.find(({ url }) => url.pathname.endsWith("/cara_training_items"))!;
    assert.equal(trainingRequest.url.searchParams.get("test_call"), "is.null");
  });
});

describe("department metrics", () => {
  it("excludes engineer and legacy tickets from department totals", () => {
    const base: DepartmentTicketRow = {
      id: "c", caller_number: customerNumber, caller_name: null, summary: "Please call back",
      brief_summary: null, department_slug: "management", status: "open", created_at: "2026-09-28T10:00:00Z",
    };
    const metrics = buildDepartmentOverviewMetrics([
      base, { ...base, id: "e", engineer_test_call: true }, { ...base, id: "legacy", caller_number: engineerNumber },
    ]);
    assert.equal(metrics.totalOpen, 1);
    assert.equal(metrics.totalUrgent, 0);
    assert.equal(metrics.departments.find((row) => row.slug === "management")?.openCount, 1);
  });

  it("excludes engineer open, urgent, callback and resolved counts", () => {
    const items = [
      { status: "open", category: "urgent", engineerTestCall: true, callerNumber: customerNumber },
      { status: "resolved", category: "callback", engineerTestCall: false, callerNumber: engineerNumber },
      { status: "open", category: "callback", engineerTestCall: false, callerNumber: customerNumber },
    ] as ActionInboxItem[];
    assert.deepEqual(buildDepartmentInboxMetrics(items), {
      openCount: 1, urgentCount: 0, callbackCount: 1, resolvedCount: 0,
    });
  });
});
