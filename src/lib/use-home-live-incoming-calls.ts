"use client";

import { useCallback, useEffect, useState } from "react";
import {
  filterActiveIncomingCallPlaceholders,
  type CallsIncomingPlaceholder,
  upsertIncomingCallPlaceholder,
} from "@/lib/calls-incoming-placeholder";
import { DASHBOARD_INCOMING_CALL_EVENT, type DashboardIncomingCallDetail } from "@/lib/dashboard-live-events";
import { customerUsageFilters } from "@/lib/dashboard-customer-data";
import { customerIncomingCallDetail } from "@/lib/dashboard-customer-events";
import { isEngineerTestCallerNumber } from "@/lib/engineer-test-call";
import { createClient } from "@/utils/supabase/client";

const MAX_LIVE_CALLS = 5;
const PLACEHOLDER_TIMEOUT_MS = 120_000;

type UseHomeLiveIncomingCallsOptions = {
  organizationId: string;
  activityCalls: ReadonlyArray<{ id: string; createdAt: string }>;
};

export function useHomeLiveIncomingCalls({
  organizationId,
  activityCalls,
}: UseHomeLiveIncomingCallsOptions): CallsIncomingPlaceholder[] {
  // Bind pending UI to the tenant that produced it, including async restore results.
  const [state, setState] = useState<{ organizationId: string; rows: CallsIncomingPlaceholder[] }>({
    organizationId, rows: [],
  });
  const applyIncomingDetail = useCallback((detail: DashboardIncomingCallDetail) => {
    if (!organizationId.trim() || !detail?.phase || isEngineerTestCallerNumber(detail.callerNumber)) return;
    setState((current) => ({
      organizationId,
      rows: upsertIncomingCallPlaceholder(current.organizationId === organizationId ? current.rows : [], detail)
        .slice(0, MAX_LIVE_CALLS),
    }));
  }, [organizationId]);

  useEffect(() => {
    const onIncomingCall = (event: Event) => {
      applyIncomingDetail((event as CustomEvent<DashboardIncomingCallDetail>).detail);
    };
    window.addEventListener(DASHBOARD_INCOMING_CALL_EVENT, onIncomingCall);
    return () => window.removeEventListener(DASHBOARD_INCOMING_CALL_EVENT, onIncomingCall);
  }, [applyIncomingDetail]);

  useEffect(() => {
    if (!organizationId.trim()) return;
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await customerUsageFilters(supabase.from("usage_records")
        .select("id, caller_number, started_at, room_name, call_sid, sync_skip_reason, ended_at"))
        .eq("organization_id", organizationId).is("ended_at", null)
        .order("started_at", { ascending: false }).limit(MAX_LIVE_CALLS);
      if (cancelled || !data?.length) return;
      for (const row of data) {
        const detail = customerIncomingCallDetail(row, "usage");
        if (detail) applyIncomingDetail(detail);
      }
    })();
    return () => { cancelled = true; };
  }, [organizationId, applyIncomingDetail]);

  useEffect(() => {
    if (!organizationId.trim()) return;
    const supabase = createClient();
    const filter = `organization_id=eq.${organizationId}`;
    const channel = supabase.channel(`home-live-calls-${organizationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "usage_records", filter }, (payload) => {
        const detail = customerIncomingCallDetail(payload.new, "usage");
        if (detail) applyIncomingDetail(detail);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "usage_records", filter }, (payload) => {
        if (customerIncomingCallDetail(payload.new, "usage")) return;
        const id = typeof payload.new.id === "string" ? payload.new.id : null;
        // Ended or subsequently classified as test: remove only this pending call.
        if (!id) return;
        setState((current) => current.organizationId !== organizationId ? current : {
          organizationId,
          rows: current.rows.filter((row) => row.usageRecordId !== id),
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_logs", filter }, (payload) => {
        const detail = customerIncomingCallDetail(payload.new, "call_log");
        if (detail) applyIncomingDetail(detail);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "call_logs", filter }, (payload) => {
        if (customerIncomingCallDetail(payload.new, "call_log")) return;
        const id = typeof payload.new.id === "string" ? payload.new.id : null;
        if (!id) return;
        setState((current) => current.organizationId !== organizationId ? current : {
          organizationId,
          rows: current.rows.filter((row) => row.callLogId !== id),
        });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [applyIncomingDetail, organizationId]);

  useEffect(() => {
    if (state.organizationId !== organizationId || state.rows.length === 0) return;
    const nextExpiry = Math.min(...state.rows.map((row) => Date.parse(row.startedAt) + PLACEHOLDER_TIMEOUT_MS));
    const timeout = window.setTimeout(() => {
      const cutoff = Date.now() - PLACEHOLDER_TIMEOUT_MS;
      setState((current) => ({ ...current, rows: current.rows.filter((row) => Date.parse(row.startedAt) > cutoff) }));
    }, Math.max(0, nextExpiry - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [state, organizationId]);

  return state.organizationId === organizationId
    ? filterActiveIncomingCallPlaceholders(state.rows, activityCalls).slice(0, MAX_LIVE_CALLS)
    : [];
}
