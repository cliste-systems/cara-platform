import { redirect } from "next/navigation";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { CaraSetupTabServices } from "../../../cara-setup/cara-setup-tab-services";

export default async function BusinessServicesPage() {
  const org = await getCachedDashboardOrganizationRow();
  if (org?.niche !== "retail") redirect("/dashboard/services");
  return <CaraSetupTabServices />;
}
