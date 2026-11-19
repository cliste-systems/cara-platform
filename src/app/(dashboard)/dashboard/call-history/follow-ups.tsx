import Link from "next/link";
import { Phone } from "lucide-react";
import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { hasAccountOwnerAccess } from "@/lib/account-owner-access";
import {
  serviceFollowUpFilters,
  SERVICE_FOLLOW_UP_COLUMNS,
} from "@/lib/service-follow-ups";

import { buildCallsPageHref } from "@/lib/calls-page-href";
import { FormFeedback } from "@/components/ui/form-feedback";
import { FollowUpList } from "./follow-up-list";
export async function FollowUps({
  selectedId,
  page = 1,
  status = "open",
}: {
  selectedId?: string;
  page?: number;
  status?: "open" | "resolved";
}) {
  const s = await requireDashboardSession();
  const limit = 10;
  const current = Math.max(1, Math.min(10000, page));
  const [{ data, error, count }, canManage] = await Promise.all([
    serviceFollowUpFilters(
      s.supabase
        .from("call_logs")
        .select(SERVICE_FOLLOW_UP_COLUMNS, { count: "exact" }),
      status,
    )
      .eq("organization_id", s.organizationId)
      .order("created_at", { ascending: false })
      .range((current - 1) * limit, current * limit - 1),
    hasAccountOwnerAccess(s.supabase, {
      userId: s.user.id,
      accountId: s.accountId,
      profileRole: s.profile.role,
    }),
  ]);
  const rows = data ?? [];
  if (selectedId && !rows.some((row) => row.id === selectedId)) {
    const { data: chosen } = await serviceFollowUpFilters(
      s.supabase.from("call_logs").select(SERVICE_FOLLOW_UP_COLUMNS),
    )
      .eq("organization_id", s.organizationId)
      .eq("id", selectedId)
      .maybeSingle();
    if (chosen) rows.unshift(chosen);
  }
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-5">
      <div>
        <ClistePageHeader tone="calls" icon={Phone} title="Calls" description="Messages and enquiries that need a response from your team." />
        <nav className="mt-4 flex gap-2">
          <Link
            className="rounded-lg border border-[#d9e2dd] bg-white px-4 py-3 text-sm"
            href="/dashboard/calls"
          >
            Call log
          </Link>
          <Link
            aria-current="page"
            className="rounded-lg bg-[#353d42] px-4 py-3 text-sm text-white"
            href="/dashboard/calls?filter=follow_up"
          >
            Follow-ups{count != null ? ` (${count})` : ""}
          </Link>
        </nav>
      </div>
      <nav aria-label="Follow-up status" className="flex gap-3 text-sm">
        <Link
          href="/dashboard/calls?filter=follow_up"
          aria-current={status === "open" ? "page" : undefined}
          className={`rounded-full px-4 py-2.5 ${status === "open" ? "bg-white font-semibold ring-1 ring-[#d9e2dd]" : "text-[#6b7c75]"}`}
        >
          To do
        </Link>
        <Link
          href="/dashboard/calls?filter=follow_up&status=resolved"
          aria-current={status === "resolved" ? "page" : undefined}
          className={`rounded-full px-4 py-2.5 ${status === "resolved" ? "bg-white font-semibold ring-1 ring-[#d9e2dd]" : "text-[#6b7c75]"}`}
        >
          Completed
        </Link>
      </nav>
      <FormFeedback
        message={
          error
            ? "We couldn’t load your follow-ups. Refresh to try again."
            : null
        }
      />
      {!error && (
        <FollowUpList
          status={status}
          canManage={canManage}
          selectedId={selectedId}
          items={rows.map((row) => ({
            id: row.id,
            caller_name: row.caller_name,
            caller_number: row.caller_number,
            summary:
              row.ai_summary ||
              "A caller asked your team to follow up. Open the call for details.",
            status: row.follow_up_completed_at ? "resolved" : "open",
            created_at: row.created_at,
            callHref: buildCallsPageHref({
              callLogId: row.id,
              callCreatedAt: row.created_at,
            }),
          }))}
        />
      )}
      <div className="flex items-center justify-between text-sm">
        {current > 1 ? (
          <Link
            className="inline-flex min-h-11 items-center rounded-lg border border-[#d9e2dd] bg-white px-4"
            href={`/dashboard/calls?filter=follow_up&status=${status}&page=${current - 1}`}
          >
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {(count ?? 0) > current * limit && (
          <Link
            className="inline-flex min-h-11 items-center rounded-lg border border-[#d9e2dd] bg-white px-4"
            href={`/dashboard/calls?filter=follow_up&status=${status}&page=${current + 1}`}
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
