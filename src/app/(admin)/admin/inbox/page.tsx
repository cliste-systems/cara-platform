import type { Metadata } from "next";
import { Mail } from "lucide-react";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { adminInboxIdentities } from "@/lib/resend-admin-inbox";
import { PRODUCT_NAME } from "@/lib/company-details";

import { AdminEmailInboxView } from "./admin-email-inbox-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Inbox`,
};

export default function AdminInboxPage() {
  const identities = adminInboxIdentities();

  return (
    <AdminPageShell
      icon={Mail}
      title="Inbox"
      fillViewport
    >
      <AdminEmailInboxView identities={identities} />
    </AdminPageShell>
  );
}
