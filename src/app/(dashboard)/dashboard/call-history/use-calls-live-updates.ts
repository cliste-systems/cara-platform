"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  mergeIncomingCallEvent,
  shouldClearCallsIncomingPlaceholder,
  type CallsIncomingPlaceholder,
} from "@/lib/calls-incoming-placeholder";
import {
  clearCallsIncomingPlaceholderSessionIfLoaded,
  mergeCallsIncomingPlaceholderSession,
  readCallsIncomingPlaceholderSession,
  writeCallsIncomingPlaceholderSession,
} from "@/lib/calls-incoming-placeholder-session";
import {
  DASHBOARD_INCOMING_CALL_EVENT,
  dispatchDashboardIncomingCallEvent,
  type DashboardIncomingCallDetail,
} from "@/lib/dashboard-live-events";
import { customerUsageFilters } from "@/lib/dashboard-customer-data";
import { customerIncomingCallDetail } from "@/lib/dashboard-customer-events";
import { isEngineerTestCallerNumber } from "@/lib/engineer-test-call";
import { createClient } from "@/utils/supabase/client";

const PLACEHOLDER_TIMEOUT_MS = 120_000;
const CALLS_POLL_INTERVAL_MS = 10_000;
const REFRESH_DEBOUNCE_MS = 400;

type UseCallsLiveUpdatesOptions = {
  organizationId: string;
  calls: ReadonlyArray<{ id: string; createdAt: string }>;
  viewingToday: boolean;
  page: number;
  /** When false, skip list polling/router refresh (e.g. dashboard home). Default true. */
  refreshList?: boolean;
};

export function useCallsLiveUpdates({
  organizationId,
  calls,
  viewingToday,
  page,
  refreshList = true,
}: UseCallsLiveUpdatesOptions): CallsIncomingPlaceholder | null {
  const router = useRouter();
  const [placeholder, setPlaceholder] = useState<CallsIncomingPlaceholder | null>(
    null,
  );
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const liveEnabled = Boolean(organizationId) && viewingToday && page <= 1;

  const persistPlaceholder = useCallback(
    (next: CallsIncomingPlaceholder | null) => {
      writeCallsIncomingPlaceholderSession(organizationId, next);
    },
    [organizationId],
  );

  const applyIncomingDetail = useCallback(
    (detail: DashboardIncomingCallDetail) => {
      if (!detail.phase || isEngineerTestCallerNumber(detail.callerNumber)) return;
      setPlaceholder((current) => {
        const merged = mergeIncomingCallEvent(current, detail);
        persistPlaceholder(merged);
        return merged;
      });
    },
    [persistPlaceholder],
  );

  const scheduleRefresh = useCallback(() => {
    if (!refreshList) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(() => {
      refreshDebounceRef.current = null;
      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }, [refreshList, router]);

  const handleIncomingDetail = useCallback(
    (detail: DashboardIncomingCallDetail) => {
      applyIncomingDetail(detail);
      scheduleRefresh();
    },
    [applyIncomingDetail, scheduleRefresh],
  );

  useEffect(() => {
    const onIncomingCall = (event: Event) => {
      const detail = (event as CustomEvent<DashboardIncomingCallDetail>).detail;
      applyIncomingDetail(detail);
    };

    window.addEventListener(DASHBOARD_INCOMING_CALL_EVENT, onIncomingCall);
    return () => {
      window.removeEventListener(DASHBOARD_INCOMING_CALL_EVENT, onIncomingCall);
    };
  }, [applyIncomingDetail]);

  useEffect(() => {
    if (!liveEnabled) {
      restoredRef.current = false;
      return;
    }

    const saved = readCallsIncomingPlaceholderSession(organizationId);
    if (saved && !shouldClearCallsIncomingPlaceholder(saved, calls)) {
      setPlaceholder(saved);
    } else if (saved) {
      persistPlaceholder(null);
      setPlaceholder(null);
    }

    if (!restoredRef.current) {
      restoredRef.current = true;
      if (refreshList) {
        router.refresh();
      }
    }

    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await customerUsageFilters(supabase
        .from("usage_records")
        .select("id, caller_number, started_at, room_name, call_sid, sync_skip_reason"))
        .eq("organization_id", organizationId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled || !data?.started_at) return;
      const detail = customerIncomingCallDetail(data, "usage");
      if (detail) handleIncomingDetail(detail);
    })();

    return () => {
      cancelled = true;
    };
    // Restore once when returning to Today's calls list — not on every poll refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEnabled, organizationId]);

  useEffect(() => {
    if (!liveEnabled) return;
    clearCallsIncomingPlaceholderSessionIfLoaded(organizationId, calls);
    if (!placeholder) return;
    if (shouldClearCallsIncomingPlaceholder(placeholder, calls)) {
      persistPlaceholder(null);
      setPlaceholder(null);
    }
  }, [calls, liveEnabled, organizationId, persistPlaceholder, placeholder]);

  useEffect(() => {
    if (!liveEnabled) return;

    const supabase = createClient();
    const filter = `organization_id=eq.${organizationId}`;

    const channel = supabase
      .channel(`calls-live-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "usage_records",
          filter,
        },
        (payload) => {
          const detail = customerIncomingCallDetail(payload.new, "usage");
          if (!detail) return;
          mergeCallsIncomingPlaceholderSession(organizationId, detail);
          dispatchDashboardIncomingCallEvent(detail);
          handleIncomingDetail(detail);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_logs",
          filter,
        },
        (payload) => {
          const detail = customerIncomingCallDetail(payload.new, "call_log");
          if (!detail) {
            // Refresh the single engineer notice without a customer-call banner.
            scheduleRefresh();
            return;
          }
          mergeCallsIncomingPlaceholderSession(organizationId, detail);
          dispatchDashboardIncomingCallEvent(detail);
          handleIncomingDetail(detail);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "call_logs",
          filter,
        },
        () => {
          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "action_tickets",
          filter,
        },
        () => {
          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "action_tickets",
          filter,
        },
        () => {
          scheduleRefresh();
        },
      )
      .subscribe();

    return () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [handleIncomingDetail, liveEnabled, organizationId, scheduleRefresh]);

  useEffect(() => {
    if (!liveEnabled || !refreshList) return;

    const poll = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      router.refresh();
    };

    const interval = window.setInterval(poll, CALLS_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [liveEnabled, refreshList, router]);

  useEffect(() => {
    if (!placeholder) return;
    const timeout = window.setTimeout(() => {
      persistPlaceholder(null);
      setPlaceholder(null);
    }, PLACEHOLDER_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [persistPlaceholder, placeholder]);

  return placeholder;
}
