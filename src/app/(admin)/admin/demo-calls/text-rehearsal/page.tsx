import { requireAdminPermission } from "@/lib/admin-session";
import type { Metadata } from "next";
import { MessageSquareText } from "lucide-react";

import { AdminErrorCard, AdminPageShell } from "@/components/admin/admin-page-shell";
import { loadAdminDemoCallLines } from "@/lib/admin-demo-call";
import { PRODUCT_NAME } from "@/lib/company-details";

import { TextRehearsalView } from "../text-rehearsal-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Text rehearsal`,
};

export default async function TextRehearsalAdminPage() {
  await requireAdminPermission("calls");
  let loadError: string | null = null;
  let lines: Awaited<ReturnType<typeof loadAdminDemoCallLines>> = [];

  try {
    lines = await loadAdminDemoCallLines();
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load demo call lines.";
  }

  return (
    <AdminPageShell icon={MessageSquareText} title="Text rehearsal" fillViewport>
      {loadError ? (
        <AdminErrorCard message="Could not load demo lines" hint={loadError} />
      ) : (
        <TextRehearsalView lines={lines} />
      )}
    </AdminPageShell>
  );
}
