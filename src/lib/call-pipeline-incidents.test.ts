import "../../scripts/mock-server-only.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadCallPipelineIncidents } from "./call-pipeline-incidents";

function clientFor(respond: (url: URL) => Response) {
  return createClient("https://incidents.example.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => respond(new URL(input instanceof Request ? input.url : String(input))) },
  });
}

test("successful empty incident queries verify zero and stay scoped to this call", async () => {
  const requests: URL[] = [];
  const client = clientFor(url => { requests.push(url); return Response.json([]); });
  const result = await loadCallPipelineIncidents(client, { organization_id: "org-a", room_name: "room-a", call_sid: "call-a" });
  assert.equal(result.complete, true);
  assert.deepEqual(result.data, []);
  assert.equal(requests.length, 2);
  assert.ok(requests.every(url => url.searchParams.get("organization_id") === "eq.org-a"));
  assert.deepEqual(requests.map(url => [url.searchParams.get("call_sid"), url.searchParams.get("room_name")]), [["eq.call-a", null], [null, "eq.room-a"]]);
});

test("missing identifiers never query organization-wide or verify zero", async () => {
  const client = clientFor(() => { throw new Error("No query should be made"); });
  const result = await loadCallPipelineIncidents(client, { organization_id: "org-a" });
  assert.equal(result.complete, false);
  assert.deepEqual(result.data, []);
});

test("failed or capped queries cannot certify complete coverage", async () => {
  const failed = await loadCallPipelineIncidents(clientFor(() => Response.json({ message: "Denied", code: "42501" }, { status: 403 })), { organization_id: "org-a", room_name: "room-a" });
  assert.equal(failed.complete, false);
  assert.ok(failed.error);
  const capped = await loadCallPipelineIncidents(clientFor(() => Response.json(Array.from({ length: 101 }, (_, id) => ({ id })))), { organization_id: "org-a", room_name: "room-a" });
  assert.equal(capped.complete, false);
});

test("an incident matched by both identifiers is counted once", async () => {
  const result = await loadCallPipelineIncidents(clientFor(() => Response.json([{ id: "incident-a", stage: "tts" }])), { organization_id: "org-a", room_name: "room-a", call_sid: "call-a" });
  assert.equal(result.complete, true);
  assert.equal(result.data.length, 1);
});
