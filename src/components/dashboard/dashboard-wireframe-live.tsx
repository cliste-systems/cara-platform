"use client";

import { useEffect, useState } from "react";
import type { DashboardHomeSnapshot } from "@/lib/dashboard-home-snapshot";
import type { DashboardMetricRangeKey } from "@/lib/dashboard-metric-range";
import { DASHBOARD_ACTIVITY_EVENT } from "@/lib/dashboard-live-events";
import { DashboardWireframe } from "./dashboard-wireframe";

export function DashboardWireframeLive({ initialSnapshot, businessName, metricRange, organizationId, phoneConnection }: {
  phoneConnection?: import("@/lib/phone-connection").PhoneConnection | null;
  initialSnapshot: DashboardHomeSnapshot;
  businessName?: string | null;
  metricRange: DashboardMetricRangeKey;
  organizationId: string;
}) {
  const [loaded, setLoaded] = useState({ source: initialSnapshot, value: initialSnapshot });
  const [error, setError] = useState<string | null>(null);
  const snapshot = loaded.source === initialSnapshot ? loaded.value : initialSnapshot;

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let queued = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    async function refresh() {
      if (disposed || document.visibilityState !== "visible" || !navigator.onLine) return;
      if (inFlight) { queued = true; return; }
      inFlight = true;
      try {
        const response = await fetch(`/api/dashboard/home?range=${encodeURIComponent(metricRange)}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Dashboard refresh failed");
        const next = await response.json() as DashboardHomeSnapshot;
        if (next.error) throw new Error("Dashboard data unavailable");
        if (!disposed) {
          setLoaded({ source: initialSnapshot, value: next });
          setError(null);
        }
      } catch {
        if (!disposed) setError("Updates are temporarily unavailable. Showing the last loaded information.");
      } finally {
        inFlight = false;
        if (queued && !disposed) { queued = false; schedule(); }
      }
    }
    function schedule() {
      clearTimeout(debounce);
      debounce = setTimeout(() => { void refresh(); }, 250);
    }
    const resume = () => { if (document.visibilityState === "visible") schedule(); };
    window.addEventListener(DASHBOARD_ACTIVITY_EVENT, schedule);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    const interval = setInterval(() => { void refresh(); }, 30_000);
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(debounce);
      clearInterval(interval);
      window.removeEventListener(DASHBOARD_ACTIVITY_EVENT, schedule);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [initialSnapshot, metricRange, organizationId]);

  return <>
    {error ? <p role="status" className="mb-3 text-xs text-neutral-600">{error}</p> : null}
    <DashboardWireframe phoneConnection={phoneConnection} snapshot={snapshot} businessName={businessName} />
  </>;
}
