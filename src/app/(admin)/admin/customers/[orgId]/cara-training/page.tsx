import { requireAdminPermission } from "@/lib/admin-session";
import { notFound } from "next/navigation";
import { BookOpenCheck } from "lucide-react";

import { adminCustomerPath } from "@/lib/admin-route-paths";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { loadAdminClientDetail } from "@/lib/load-admin-clients";

import { loadCaraTrainingData } from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";
import { CaraTrainingShell } from "./cara-training-shell";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function ClientCaraTrainingPage({ params }: PageProps) {
  await requireAdminPermission("customers");
  const { orgId } = await params;

  const client = await loadAdminClientDetail(orgId);
  if (!client) notFound();
  if (client.provisionSource !== "managed") notFound();

  const data = await loadCaraTrainingData(orgId);
  if (!data) {
    return (
      <AdminPageShell icon={BookOpenCheck} title={`Train Cara — ${client.name}`} backHref={adminCustomerPath(orgId)} backLabel="Back to customer">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Could not load Cara training data.</p>
          <p className="mt-1">Refresh to try again. If the problem continues, check the training service connection.</p>
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      icon={BookOpenCheck}
      title={`Train Cara — ${data.name}`}
      description="Configure what Cara knows, how she speaks and when she transfers calls."
      backHref={adminCustomerPath(orgId)}
      backLabel="Back to customer"
    >
      <CaraTrainingShell initial={data} />
    </AdminPageShell>
  );
}
