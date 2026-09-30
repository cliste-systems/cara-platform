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
          <p className="mt-1">
            If you just pulled this branch, apply migration{" "}
            <code className="rounded bg-amber-100 px-1">089_store_phone_system.sql</code>{" "}
            to your local Supabase, then restart the dev server.
          </p>
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      icon={BookOpenCheck}
      title={`Train Cara — ${data.name}`}
      description="Structured training fields compile into the worker prompt."
      backHref={adminCustomerPath(orgId)}
      backLabel="Back to customer"
    >
      <CaraTrainingShell initial={data} />
    </AdminPageShell>
  );
}
