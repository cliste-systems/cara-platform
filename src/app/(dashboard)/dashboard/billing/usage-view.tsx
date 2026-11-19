import {WorkspaceSectionNav} from "@/components/dashboard/workspace-section-nav";
import {BillingAccountSummary} from "@/components/dashboard/billing-account-summary";
import {FormFeedback} from "@/components/ui/form-feedback";
import { AlertTriangle, Gauge } from "lucide-react";
import type { ReactNode } from "react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { DashboardPageScrollBody } from "@/components/dashboard/dashboard-form-scroll-region";
import { DashboardInlineSummary } from "@/components/dashboard/dashboard-inline-summary";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import {
  DASHBOARD_HOME_CARD,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

import { OpenBillingPortalButton } from "./portal-button";
import { SetupBillingButton } from "./setup-billing-button";
import {
  buildUsageSummary,

  formatDate,
  formatDateTime,
  formatEuroFromCents,
  formatMinutes,
  type UsagePageData,
} from "./usage-helpers";

type UsageViewProps = {
  data: UsagePageData;
  className?: string;
  billingReady?: boolean;
  billingPending?: boolean;
  checkoutCancelled?: boolean;
};

export function UsageView({
  data,
  className,
  billingReady = false,
  billingPending = false,
  checkoutCancelled = false,
}: UsageViewProps) {
  const summary = buildUsageSummary(data);
  const renewalDate = formatDate(data.periodEnd);
  const estimatedExtra = formatEuroFromCents(data.projectedOverageCents);

  const portalButtonClass =
    "w-full sm:w-auto";

  return (
    <div
      className={cn(
        DASHBOARD_PAGE_SHELL_FILL_WHITE,
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      <DashboardAnimatedPageSections className="min-h-0 flex-1 overflow-hidden">
      <div className="shrink-0">
      <DashboardPageHeader
        eyebrow="Usage"
        title="Plan & billing"
        icon={Gauge}
        description="Your plan, payment details and usage in one place."
        actions={
          data.canManageBilling ? (
            <OpenBillingPortalButton className={portalButtonClass} />
          ) : null
        }
      />

      <div className="mt-4"><WorkspaceSectionNav group="account"/></div>
      </div>

      <DashboardPageScrollBody scrollClassName="flex flex-col gap-4 pt-4">

      <FormFeedback message={data.loadError}/>
      {data.billingDetails&&<BillingAccountSummary details={data.billingDetails} planName={data.planName} setupChoice={data.setupChoice??"Self-service"}/>}
      {data.suspended ? (
        <UsageAlert tone="warning" icon={AlertTriangle}>
          <p className="font-semibold">Your subscription is paused.</p>
          <p className="mt-1 leading-relaxed opacity-90">
            {data.suspendedReason ??
              "The last invoice could not be charged. Update your billing details to bring Cara back online."}
          </p>
        </UsageAlert>
      ) : null}

      {billingPending ? <UsageAlert tone="neutral">Payment confirmation is still pending. Refresh shortly or contact support if it does not update.</UsageAlert> : null}

      {billingReady ? (
        <UsageAlert tone="success">
          <p className="font-semibold">Billing is connected.</p>
          <p className="mt-1 leading-relaxed opacity-90">
            Your payment details and invoices are ready to view.
          </p>
        </UsageAlert>
      ) : null}

      {checkoutCancelled ? (
        <UsageAlert tone="neutral">
          Checkout was cancelled. You can try again when you are ready.
        </UsageAlert>
      ) : null}

      {!data.loadError&&<>
      <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section className={DASHBOARD_HOME_CARD}>
            <h2 className="shrink-0 text-[15px] font-semibold tracking-tight text-[#0b1220]">
              Minutes this period
            </h2>

            <div className="mt-4">
              <div className="flex items-end gap-2">
                <p className="text-[40px] font-semibold leading-none tracking-tight tabular-nums text-[#0b1220] sm:text-[48px]">
                  {formatMinutes(data.usedMinutes)}
                </p>
                {data.includedMinutes > 0 ? (
                  <p className="mb-1.5 text-[16px] font-medium tabular-nums text-slate-400">
                    / {formatMinutes(data.includedMinutes)}
                  </p>
                ) : null}
              </div>
              <p className="mt-2 text-[14px] font-medium text-[#0b1220]">
                {summary.primary}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-slate-500">
                {summary.secondary}
                <span className="text-slate-400">
                  {" "}
                  Talk time is billed to the second.
                </span>
              </p>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-2 text-[12px]">
                  <span className="font-medium text-slate-600">Period usage</span>
                  <span className="tabular-nums text-slate-500">
                    {data.progressPct}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width]",
                      data.progressPct >= 90
                        ? "bg-amber-600"
                        : "bg-[#0b1220]",
                    )}
                    style={{
                      width: `${Math.max(data.progressPct, data.usedMinutes > 0 ? 2 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
              <PeriodFact label="Period start" value={formatDate(data.periodStart)} />
              <PeriodFact label="Renews" value={renewalDate} />
              <PeriodFact
                label="Last call counted"
                value={formatDateTime(data.lastCallAt)}
              />
            </dl>

            <div className="mt-4 border-t border-slate-100 pt-3 space-y-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Calls & minutes
                </p>
                <DashboardInlineSummary
                  className="mt-1"
                  segments={[
                    { value: formatMinutes(data.usedMinutes), label: "used" },
                    {
                      value:
                        data.includedMinutes > 0
                          ? formatMinutes(data.includedMinutes)
                          : "—",
                      label: "included",
                    },
                    {
                      value:
                        data.includedMinutes > 0
                          ? formatMinutes(data.remainingMinutes)
                          : "—",
                      label: "remaining",
                    },
                    {
                      value: formatMinutes(data.extraMinutes),
                      label: "extra",
                    },
                    { value: String(data.callsCounted), label: "calls" },
                  ]}
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  SMS
                </p>
                <DashboardInlineSummary
                  className="mt-1"
                  segments={[
                    { value: String(data.usedSms), label: "sent" },
                    {
                      value:
                        data.includedSms > 0 ? String(data.includedSms) : "—",
                      label: "included",
                    },
                    { value: String(data.extraSms), label: "extra" },
                  ]}
                />
              </div>
            </div>
          </section>

        <section className={DASHBOARD_HOME_CARD}>
          <h2 className="shrink-0 text-[15px] font-semibold tracking-tight text-[#0b1220]">
            Allowances & extra usage
          </h2>

          {data.plan ? (
            <>
              <dl className="mt-3 space-y-2.5">
                <PlanRow
                  label="Included minutes"
                  value={`${data.plan.includedMinutes.toLocaleString("en-IE")} / month`}
                />
                <PlanRow
                  label="Included SMS"
                  value={`${data.plan.includedSms.toLocaleString("en-IE")} / month`}
                />
                <PlanRow
                  label="Extra minute rate"
                  value={`${formatEuroFromCents(data.plan.overageRateCents)} / min`}
                />
                <PlanRow
                  label="Extra SMS rate"
                  value={`${formatEuroFromCents(data.plan.smsOverageRateCents)} / SMS`}
                />
                <PlanRow
                  label="Estimated extra cost"
                  value={estimatedExtra}
                />
              </dl>
            </>
          ) : (
            <p className="mt-3 shrink-0 text-[13px] leading-relaxed text-slate-600">
              No plan is active yet. Choose a plan to get included minutes and
              call handling.
            </p>
          )}

          {!data.canManageBilling && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              {data.canSetUpBilling ? <SetupBillingButton label="Set up billing" /> :
                <p className="text-sm text-slate-600">The account owner manages payment details and invoices.</p>}
            </div>
          )}
        </section>
      </div>

      {data.locationCount > 1 && data.locationBreakdown.length > 0 ? (
        <section className={cn(DASHBOARD_HOME_CARD, "shrink-0")}>
          <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
            Usage by location
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Minutes and SMS are pooled on your account. This breakdown shows
            where usage came from.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th className="py-2 pr-4 font-medium">Location</th>
                  <th className="py-2 pr-4 font-medium">Minutes</th>
                  <th className="py-2 pr-4 font-medium">SMS</th>
                  <th className="py-2 font-medium">Calls</th>
                </tr>
              </thead>
              <tbody>
                {data.locationBreakdown.map((row) => (
                  <tr key={row.organizationId} className="border-b border-slate-50">
                    <td className="py-2.5 pr-4 font-medium text-[#0b1220]">
                      {row.locationName}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">
                      {formatMinutes(row.usedMinutes)}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">{row.usedSms}</td>
                    <td className="py-2.5 tabular-nums">{row.callsCounted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      </>}
      </DashboardPageScrollBody>
      </DashboardAnimatedPageSections>
    </div>
  );
}

function UsageAlert({
  children,
  tone,
  icon: Icon,
}: {
  children: ReactNode;
  tone: "warning" | "success" | "neutral";
  icon?: typeof AlertTriangle;
}) {
  const styles = {
    warning: "border-amber-200 bg-amber-50/80 text-amber-950",
    success: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
    neutral: "border-slate-200 bg-white text-slate-700",
  }[tone];

  return (
    <section
      className={cn(
        "flex shrink-0 gap-3 rounded-2xl border px-4 py-3.5 text-[13px] sm:px-5",
        styles,
      )}
    >
      {Icon ? (
        <Icon className="mt-0.5 size-5 shrink-0 opacity-80" aria-hidden />
      ) : null}
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function PeriodFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium tabular-nums text-[#0b1220]">
        {value}
      </dd>
    </div>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
      <dt className="text-[13px] text-slate-600">{label}</dt>
      <dd className="shrink-0 text-[13px] font-medium tabular-nums text-[#0b1220]">
        {value}
      </dd>
    </div>
  );
}
