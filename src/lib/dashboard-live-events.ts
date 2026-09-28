/** Fired when activity tables change — home listens for a lightweight client refetch. */
export const DASHBOARD_ACTIVITY_EVENT = "cliste:dashboard-activity";

/** Fired when a live call starts or a finished call is being loaded into the Calls list. */
export const DASHBOARD_INCOMING_CALL_EVENT = "cliste:dashboard-incoming-call";

export type DashboardIncomingCallPhase = "in_progress" | "loading";

export type DashboardIncomingCallDetail = {
  phase: DashboardIncomingCallPhase;
  callerNumber?: string | null;
  callLogId?: string | null;
  usageRecordId?: string | null;
  /** Stable identity shared by the usage ledger and completed call log. */
  callSid?: string | null;
  startedAt?: string;
};

export function dispatchDashboardActivityEvent(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_ACTIVITY_EVENT));
}

export function dispatchDashboardIncomingCallEvent(
  detail: DashboardIncomingCallDetail,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DashboardIncomingCallDetail>(DASHBOARD_INCOMING_CALL_EVENT, {
      detail,
    }),
  );
}
