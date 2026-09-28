"use client";

import { useMemo } from "react";
import { Phone } from "lucide-react";

import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { resolveCustomerCallHistoryMetrics } from "@/lib/customer-call-history-metrics";

import { DashboardHeaderDateControls } from "../dashboard-header-date-controls";
import {
  callHistorySummarySegments,
  type CallHistoryListItem,
  type CallHistoryMetrics,
} from "./call-history-helpers";
import {
  CallHistoryView,
  type CallHistoryPagination,
} from "./call-history-view";

type CallHistoryPageContentProps = {
  greetingSubline: string;
  metrics: CallHistoryMetrics;
  calls: CallHistoryListItem[];
  organizationId: string;
  initialSelectedCallId?: string | null;
  blockedCallerE164s: string[];
  businessName: string;
  pagination: CallHistoryPagination;
  className?: string;
};

export function CallHistoryPageContent({
  greetingSubline,
  metrics,
  calls,
  organizationId,
  initialSelectedCallId,
  blockedCallerE164s,
  businessName,
  pagination,
  className,
}: CallHistoryPageContentProps) {
  const liveMetrics = useMemo(
    () =>
      resolveCustomerCallHistoryMetrics({
        calls,
        serverMetrics: metrics,
        totalCount: pagination.totalCount,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    [calls, metrics, pagination.page, pagination.pageSize, pagination.totalCount],
  );

  return (
    <>
      <ClistePageHeader
        tone="calls"
        icon={Phone}
        title="Calls"
        description={greetingSubline}
        actions={<DashboardHeaderDateControls />}
        summary={callHistorySummarySegments(liveMetrics)}
      />

      <CallHistoryView
        className={className}
        calls={calls}
        metrics={liveMetrics}
        organizationId={organizationId}
        initialSelectedCallId={initialSelectedCallId}
        blockedCallerE164s={blockedCallerE164s}
        businessName={businessName}
        pagination={pagination}
      />
    </>
  );
}
