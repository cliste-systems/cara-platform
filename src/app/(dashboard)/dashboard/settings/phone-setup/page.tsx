import {ServicePhoneView} from "./service-phone-view";
import {hasAccountOwnerAccess} from "@/lib/account-owner-access";
import {parseCallRoutingMode} from "@/lib/call-routing";
import { loadTenantPhoneSetup } from "@/lib/load-tenant-phone-setup";
import { requireDashboardSession } from "@/lib/dashboard-session";

import { PhoneSetupView } from "./phone-setup-view";

export const dynamic = "force-dynamic";

export default async function PhoneSetupPage() {
  const { supabase, organizationId, user, accountId, profile } = await requireDashboardSession();

  const { data: org } = await supabase
    .from("organizations")
    .select("niche,phone_number,is_active,call_routing_mode,fallback_number,divert_verified_at,updated_at")
    .eq("id", organizationId)
    .maybeSingle();

  if (org?.niche !== "retail") {
    const canManage=await hasAccountOwnerAccess(supabase,{userId:user.id,accountId,profileRole:profile.role});
    return <ServicePhoneView number={org?.phone_number??null} enabled={org?.is_active===true} initialMode={parseCallRoutingMode(org?.call_routing_mode)} initialTransfer={org?.fallback_number??""} version={org?.updated_at??""} verifiedAt={org?.divert_verified_at??null} canManage={canManage}/>;
  }

  const setup = await loadTenantPhoneSetup(supabase, organizationId);

  return (
    <PhoneSetupView
      storeName={setup.storeName}
      verdict={setup.verdict}
      activeDepartments={setup.activeDepartments}
      transferVerifiedAt={setup.transferVerifiedAt}
      clisteNumber={setup.clisteReadiness.clisteNumber}
      clisteDetail={setup.clisteReadiness.detail}
    />
  );
}
