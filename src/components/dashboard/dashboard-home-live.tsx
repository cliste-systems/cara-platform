"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useDashboardVertical } from "@/app/(dashboard)/dashboard/dashboard-vertical-context";
import { ServiceBusinessOverview } from "./service-business-overview";
import { FormFeedback } from "@/components/ui/form-feedback";
import type { DashboardHomeSnapshot } from "@/lib/dashboard-home-snapshot";
import { DASHBOARD_ACTIVITY_EVENT } from "@/lib/dashboard-live-events";
import type { DashboardMetricRangeKey } from "@/lib/dashboard-metric-range";

import { DashboardHomeCardsGrid } from "@/components/dashboard/dashboard-home-cards-grid";
import { DashboardHomeEnter } from "@/components/dashboard/dashboard-home-enter";
import { DashboardHomeHero } from "@/components/dashboard/dashboard-home-hero";

/** Re-format relative timestamps without a full refetch. */
const RELATIVE_TIME_TICK_MS = 60_000;

const REFRESH_DEBOUNCE_MS = 400;

type DashboardHomeLiveProps = {
  metricRange: DashboardMetricRangeKey;
  organizationId: string;
  initialSnapshot: DashboardHomeSnapshot;
  heroClassName?: string;
  cardsClassName?: string;
  enterClassName?: string;
  greeting?: {intro:string;closing:string};
};

export function DashboardHomeLive({
  metricRange,
  organizationId,
  initialSnapshot,
  heroClassName,
  cardsClassName,
  enterClassName,
  greeting,
}: DashboardHomeLiveProps) {
  const {vertical} = useDashboardVertical();
  const [refreshError,setRefreshError] = useState<string|null>(null);
  const [loaded, setLoaded] = useState({ source: initialSnapshot, value: initialSnapshot });
  const snapshot = loaded.source === initialSnapshot ? loaded.value : initialSnapshot;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  const fetchSnapshot = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch(
        `/api/dashboard/home?range=${encodeURIComponent(metricRange)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Refresh failed");
      const next = (await res.json()) as DashboardHomeSnapshot;
      setLoaded({ source: initialSnapshot, value: next });
      setRefreshError(null);
    } catch {
      setRefreshError("Your dashboard couldn’t refresh. The last loaded information is still shown.");
    } finally {
      inFlightRef.current = false;
    }
  }, [metricRange, initialSnapshot]);

  const scheduleRefresh = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void fetchSnapshot();
    }, REFRESH_DEBOUNCE_MS);
  }, [fetchSnapshot]);

  useEffect(() => {
    window.addEventListener(DASHBOARD_ACTIVITY_EVENT, scheduleRefresh);
    const relativeTick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetchSnapshot();
    }, RELATIVE_TIME_TICK_MS);

    return () => {
      window.removeEventListener(DASHBOARD_ACTIVITY_EVENT, scheduleRefresh);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearInterval(relativeTick);
    };
  }, [fetchSnapshot, scheduleRefresh]);

  if (vertical.id !== "retail") return <ServiceBusinessOverview snapshot={snapshot} refreshError={refreshError} onRetry={()=>void fetchSnapshot()} greeting={greeting}/>;
  return (
    <DashboardHomeEnter className={enterClassName}>
      <FormFeedback message={refreshError || snapshot.error}/>
      <DashboardHomeHero
        className={heroClassName}
        greeting={snapshot.greeting}
        subheading={snapshot.subheading}
        stats={snapshot.stats}
      />

      <DashboardHomeCardsGrid
        className={cardsClassName}
        organizationId={organizationId}
        activity={snapshot.activity}
        needsAttention={snapshot.needsAttention}
        openActions={snapshot.openActions}
        caraTraining={snapshot.caraTraining}
        openTrainingCount={snapshot.openTrainingCount}
        topTopics={snapshot.topTopics}
        callsToReview={snapshot.callsToReview}
        callsToReviewCount={snapshot.callsToReviewCount}
        callTimes={snapshot.callTimes}
      />
    </DashboardHomeEnter>
  );
}
