import { notFound } from "next/navigation";
import { LifeBuoy } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import {
  AdminErrorCard,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { SupportThreadMessages } from "@/components/support/support-thread-messages";
import { createAdminClient } from "@/utils/supabase/admin";

import { CloseSupportButton } from "../close-support-button";
import { TicketAdminReplyForm } from "../ticket-admin-reply-form";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OrgJoin = { name: string; slug: string };

type MessageRow = {
  id: string;
  author_kind: string;
  body: string;
  created_at: string;
};

type TicketDetail = {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  organization_id: string;
  organizations: OrgJoin | OrgJoin[] | null;
  support_ticket_messages: MessageRow[] | null;
};

function orgLabel(ticket: TicketDetail): string {
  const o = ticket.organizations;
  if (!o) return "—";
  const one = Array.isArray(o) ? o[0] : o;
  return one?.name?.trim() || "—";
}

function orgSlug(ticket: TicketDetail): string | null {
  const o = ticket.organizations;
  if (!o) return null;
  const one = Array.isArray(o) ? o[0] : o;
  const s = one?.slug?.trim();
  return s || null;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function TicketStatusChip({ status }: { status: string }) {
  return <AdminBadge className="capitalize">{status}</AdminBadge>;
}

export default async function AdminSupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  if (!UUID_RE.test(ticketId)) notFound();

  let ticket: TicketDetail | null = null;
  let loadError: string | null = null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("support_tickets")
      .select(
        `id, subject, body, status, created_at, organization_id,
         organizations ( name, slug ),
         support_ticket_messages ( id, author_kind, body, created_at )`
      )
      .eq("id", ticketId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    ticket = data as TicketDetail | null;
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Failed to load ticket.";
  }

  if (loadError) {
    return (
      <AdminPageShell
        icon={LifeBuoy}
        title="Support tickets"
        description="Ticket detail"
        backHref="/admin/support"
        backLabel="Support tickets"
      >
        <AdminErrorCard message={loadError} />
      </AdminPageShell>
    );
  }

  if (!ticket) notFound();

  const rawMessages = ticket.support_ticket_messages ?? [];
  const messages = [...rawMessages].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const slug = orgSlug(ticket);
  const description = (
    <>
      {orgLabel(ticket)}
      {slug ? (
        <span className="ml-2 font-mono text-xs text-gray-400">{slug}</span>
      ) : null}
      <span className="mt-1 block text-xs tabular-nums">
        Opened {formatWhen(ticket.created_at)}
      </span>
    </>
  );

  return (
    <AdminPageShell
      icon={LifeBuoy}
      title={ticket.subject}
      description={description}
      backHref="/admin/support"
      backLabel="Support tickets"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <TicketStatusChip status={ticket.status} />
          {ticket.status === "open" ? (
            <CloseSupportButton ticketId={ticket.id} />
          ) : null}
        </div>
      }
    >
      <AdminSectionCard
        title="Conversation"
        description="Original request and all replies. The client sees this on Support."
        padded
      >
        <SupportThreadMessages
          openedAt={ticket.created_at}
          initialBody={ticket.body}
          messages={messages}
          perspective="admin"
        />
      </AdminSectionCard>

      <AdminSectionCard title="Add reply" padded>
        <TicketAdminReplyForm ticketId={ticket.id} />
      </AdminSectionCard>
    </AdminPageShell>
  );
}
