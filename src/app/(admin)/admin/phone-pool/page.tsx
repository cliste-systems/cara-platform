import { Phone } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminStatsGrid } from "@/components/admin/admin-stats-grid";
import {
  adminTableBodyClass,
  adminTableClass,
  adminTableEmptyClass,
  adminTableHeadClass,
  adminTableRowClass,
  adminTableTdClass,
  adminTableThClass,
} from "@/components/admin/admin-table";
import Link from "next/link";

import { adminCustomerPath } from "@/lib/admin-route-paths";
import { adminTextLinkClass } from "@/components/admin/admin-interactive";
import { poolHealthCheck, twilioIsConfigured } from "@/lib/phone-pool";
import { createAdminClient } from "@/utils/supabase/admin";

import { PhonePoolListCard } from "./phone-pool-list-card";

export const dynamic = "force-dynamic";

type PoolRow = {
  id: string;
  e164: string;
  country_code: string;
  provider: string;
  status: string;
  organization_id: string | null;
  assigned_at: string | null;
  cooldown_until: string | null;
  notes: string | null;
};

export default async function PhonePoolAdminPage() {
  const health = await poolHealthCheck();
  const admin = createAdminClient();

  const { data } = await admin
    .from("phone_numbers")
    .select(
      "id, e164, country_code, provider, status, organization_id, assigned_at, cooldown_until, notes",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as PoolRow[];

  const orgIds = [
    ...new Set(rows.map((r) => r.organization_id).filter(Boolean) as string[]),
  ];
  const orgNameIndex = new Map<string, string>();
  if (orgIds.length > 0) {
    const { data: orgs } = await admin
      .from("organizations")
      .select("id, name")
      .in("id", orgIds);
    for (const o of orgs ?? []) {
      orgNameIndex.set(o.id as string, (o.name as string | null) ?? "(unnamed)");
    }
  }

  const twilioReady = twilioIsConfigured();
  const countLabel = `${rows.length} number${rows.length === 1 ? "" : "s"}`;

  const stats = (
    <AdminStatsGrid>
      <AdminStatCard label="Available (IE)" value={health.availableIE.toLocaleString("en-IE")} />
      <AdminStatCard
        label="Available (other)"
        value={health.availableOther.toLocaleString("en-IE")}
      />
      <AdminStatCard label="Assigned" value={health.assigned.toLocaleString("en-IE")} />
      <AdminStatCard label="Cooldown" value={health.cooldown.toLocaleString("en-IE")} />
      <AdminStatCard
        label="Low-water mark"
        value={health.lowWaterMark.toLocaleString("en-IE")}
        muted
      />
    </AdminStatsGrid>
  );

  const notice = !twilioReady ? (
    <p className="text-sm text-gray-700">
      Twilio credentials are not configured — pool refill is a no-op. Set{" "}
      <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
        TWILIO_ACCOUNT_SID
      </code>{" "}
      and{" "}
      <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
        TWILIO_AUTH_TOKEN
      </code>{" "}
      to enable automated purchases.
    </p>
  ) : undefined;

  return (
    <AdminPageShell
      icon={Phone}
      title="Phone pool"
      description="Irish DIDs Cliste owns. Pool refills nightly when IE-available drops below the low-water mark."
    >
      <PhonePoolListCard countLabel={countLabel} stats={stats} notice={notice}>
        <table className={`${adminTableClass} text-sm`}>
          <thead className={adminTableHeadClass}>
            <tr>
              <th className={adminTableThClass}>Number</th>
              <th className={adminTableThClass}>Provider</th>
              <th className={adminTableThClass}>Status</th>
              <th className={adminTableThClass}>Assigned to</th>
              <th className={adminTableThClass}>Since</th>
            </tr>
          </thead>
          <tbody className={adminTableBodyClass}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className={adminTableEmptyClass}>
                  Pool is empty. Trigger a refill or seed numbers manually.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className={adminTableRowClass}>
                  <td className={`font-mono text-sm ${adminTableTdClass}`}>
                    {r.e164}
                    <span className="ml-2 inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                      {r.country_code}
                    </span>
                  </td>
                  <td className={`text-gray-600 ${adminTableTdClass}`}>
                    {r.provider}
                  </td>
                  <td className={adminTableTdClass}>
                    <AdminBadge className="capitalize">{r.status}</AdminBadge>
                  </td>
                  <td className={`text-gray-600 ${adminTableTdClass}`}>
                    {r.organization_id ? (
                      <Link
                        href={adminCustomerPath(r.organization_id)}
                        className={adminTextLinkClass}
                      >
                        {orgNameIndex.get(r.organization_id) ?? "(linked)"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`whitespace-nowrap text-gray-500 ${adminTableTdClass}`}>
                    {formatAgeLabel(r)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </PhonePoolListCard>
    </AdminPageShell>
  );
}

function formatAgeLabel(r: PoolRow): string {
  const iso = r.status === "cooldown" ? r.cooldown_until : r.assigned_at;
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IE", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
