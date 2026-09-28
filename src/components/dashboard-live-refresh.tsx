"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { createClient } from "@/utils/supabase/client";
import { mergeCallsIncomingPlaceholderSession } from "@/lib/calls-incoming-placeholder-session";
import {
  dispatchDashboardActivityEvent,
  dispatchDashboardIncomingCallEvent,
} from "@/lib/dashboard-live-events";
import { customerIncomingCallDetail } from "@/lib/dashboard-customer-events";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Supabase Realtime on activity tables (migration 034) is the primary path — events
 * arrive in ~1s. Migration 062 sets REPLICA IDENTITY FULL so org-scoped filters work.
 * Polling is a fallback when Realtime is down (12s dev / 30s prod).
 */
const POLL_INTERVAL_MS = IS_DEV ? 12_000 : 30_000;

/** Coalesce Realtime bursts (insert + enrichment update) into one RSC refresh. */
const REALTIME_DEBOUNCE_MS = 400;

/** Coalesce interval + focus refreshes so RSC fetches don’t overlap. */
const MIN_MS_BETWEEN_POLL_REFRESH = 4_000;

/** On home, layout refresh is throttled — content updates via client snapshot fetch. */
const MIN_MS_BETWEEN_HOME_LAYOUT_REFRESH = 10_000;

function isDashboardHomePath(pathname: string | null): boolean {
  return pathname === DASHBOARD_ROUTES.home;
}

/**
 * Realtime is event-driven (no cost unless data actually changes) and the
 * sidebar badges live on every dashboard page, so we subscribe everywhere
 * under `/dashboard`. The only exclusion is `/dashboard/set-password`,
 * where the session is mid-bootstrap and we don't want stray refreshes.
 */
function shouldEnableRealtime(pathname: string | null): boolean {
  if (!pathname?.startsWith("/dashboard")) return false;
  if (pathname.startsWith("/dashboard/set-password")) return false;
  return true;
}

/**
 * Fallback polling runs on all dashboard pages (sidebar badges + activity feeds).
 * Settings is excluded — it does not show live call/ticket streams.
 */
function shouldPoll(pathname: string | null): boolean {
  if (!shouldEnableRealtime(pathname)) return false;
  if (!pathname) return false;
  if (pathname === "/dashboard/settings") return false;
  return true;
}

function isRealtimeHealthyStatus(status: string): boolean {
  return status === "SUBSCRIBED";
}

function handleUsageRecordInsert(
  organizationId: string,
  payload: { new: Record<string, unknown> },
) {
  const detail = customerIncomingCallDetail(payload.new, "usage");
  if (!detail) return;
  mergeCallsIncomingPlaceholderSession(organizationId, detail);
  dispatchDashboardIncomingCallEvent(detail);
}

function handleCallLogInsert(
  organizationId: string,
  payload: { new: Record<string, unknown> },
) {
  const detail = customerIncomingCallDetail(payload.new, "call_log");
  if (!detail) return;
  mergeCallsIncomingPlaceholderSession(organizationId, detail);
  dispatchDashboardIncomingCallEvent(detail);
}


type DashboardLiveRefreshProps = {
  organizationId: string;
};

/**
 * Keeps the dashboard current: Supabase Realtime on relevant tables (near–instant
 * when enabled in the project), plus timed `router.refresh()` only when Realtime
 * is not connected.
 */
export function DashboardLiveRefresh({
  organizationId,
}: DashboardLiveRefreshProps) {
  const pathname = usePathname();
  const router = useRouter();
  const lastPollRefreshAt = useRef(0);
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const realtimeHealthyRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const pollRefresh = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }
    const now = Date.now();
    if (now - lastPollRefreshAt.current < MIN_MS_BETWEEN_POLL_REFRESH) {
      return;
    }
    lastPollRefreshAt.current = now;
    router.refresh();
  }, [router]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    if (!shouldPoll(pathnameRef.current)) return;
    lastPollRefreshAt.current = Date.now();
    pollIntervalRef.current = setInterval(pollRefresh, POLL_INTERVAL_MS);
  }, [pollRefresh]);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }
    if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    realtimeDebounceRef.current = setTimeout(() => {
      realtimeDebounceRef.current = null;
      if (pathnameRef.current === "/dashboard/settings") return;

      const now = Date.now();
      const onHome = isDashboardHomePath(pathnameRef.current);

      if (onHome) {
        dispatchDashboardActivityEvent();
        if (now - lastPollRefreshAt.current < MIN_MS_BETWEEN_HOME_LAYOUT_REFRESH) {
          return;
        }
      } else if (now - lastPollRefreshAt.current < MIN_MS_BETWEEN_POLL_REFRESH) {
        return;
      }

      lastPollRefreshAt.current = now;
      router.refresh();
    }, REALTIME_DEBOUNCE_MS);
  }, [router]);

  useEffect(() => {
    stopPolling();
    realtimeHealthyRef.current = false;
    if (shouldPoll(pathname)) {
      startPolling();
    }
    return () => stopPolling();
  }, [pathname, startPolling, stopPolling]);

  useEffect(() => {
    if (!shouldPoll(pathname)) return;
    const FOCUS_REFRESH_THRESHOLD_MS = 15_000;
    const onResume = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastPollRefreshAt.current < FOCUS_REFRESH_THRESHOLD_MS) {
        return;
      }
      if (realtimeHealthyRef.current) {
        scheduleRealtimeRefresh();
        return;
      }
      pollRefresh();
    };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    return () => {
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
    };
  }, [pathname, pollRefresh, scheduleRealtimeRefresh]);

  useEffect(() => {
    if (!organizationId) return;
    if (!shouldEnableRealtime(pathname)) return;

    realtimeHealthyRef.current = false;
    startPolling();

    const supabase = createClient();
    const filter = `organization_id=eq.${organizationId}`;

    const channel = supabase
      .channel(`dashboard-activity-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_logs",
          filter,
        },
        (payload) => {
          handleCallLogInsert(organizationId, payload);
          scheduleRealtimeRefresh();
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
        scheduleRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter,
        },
        scheduleRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter,
        },
        scheduleRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cara_training_items",
          filter,
        },
        scheduleRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cara_training_items",
          filter,
        },
        scheduleRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "usage_records",
          filter,
        },
        (payload) => {
          handleUsageRecordInsert(organizationId, payload);
          scheduleRealtimeRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "usage_records",
          filter,
        },
        scheduleRealtimeRefresh,
      )
      .subscribe((status) => {
        const healthy = isRealtimeHealthyStatus(status);
        realtimeHealthyRef.current = healthy;
        if (shouldPoll(pathnameRef.current)) {
          startPolling();
        }
        if (IS_DEV && (status === "CHANNEL_ERROR" || status === "TIMED_OUT")) {
          console.warn(
            "[DashboardLiveRefresh] Realtime unavailable — check Supabase Realtime is enabled and migrations 034 + 062 are applied; polling fallback every",
            POLL_INTERVAL_MS,
            "ms.",
          );
        }
      });

    return () => {
      realtimeHealthyRef.current = false;
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [organizationId, pathname, scheduleRealtimeRefresh, startPolling, stopPolling]);

  return null;
}
