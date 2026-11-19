import { redirect } from "next/navigation";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { hasAccountOwnerAccess } from "@/lib/account-owner-access";
import { listServicesForOrg } from "@/lib/service-catalog";
import { ServicesWorkspace } from "./services-workspace";
export const dynamic = "force-dynamic";
export default async function ServicesPage() {
  const s = await requireDashboardSession();
  const [{ data: org, error }, services, canManage] = await Promise.all([
    s.supabase
      .from("organizations")
      .select(
        "niche,updated_at,agent_services_not_offered,quote_prices_on_calls",
      )
      .eq("id", s.organizationId)
      .single(),
    listServicesForOrg(s.supabase, s.organizationId),
    hasAccountOwnerAccess(s.supabase, {
      userId: s.user.id,
      accountId: s.accountId,
      profileRole: s.profile.role,
    }),
  ]);
  if (error || !org) throw new Error("Could not load services.");
  if (org.niche === "retail") redirect("/dashboard/products");
  return (
    <ServicesWorkspace
      initialServices={services}
      initialVersion={org.updated_at}
      initialExcluded={org.agent_services_not_offered ?? ""}
      initialQuotePrices={org.quote_prices_on_calls !== false}
      canManage={canManage}
    />
  );
}
