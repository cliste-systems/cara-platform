"use client";

import { useServiceTheme } from "@/components/dashboard/service-theme-context";
import { FormFeedback } from "@/components/ui/form-feedback";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { LifeBuoy, Plus, Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import {
  DashboardAnimatedGroup,
  DashboardAnimatedPageSections,
} from "@/components/dashboard/dashboard-animated-group";
import { dashboardQuickEnterVariants } from "@/components/dashboard/dashboard-motion";
import { onboardingPageVariants } from "@/components/onboarding/onboarding-motion";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DetailPanelBody,
  DetailPanelShell,
  ListDetailLayout,
} from "@/components/dashboard/list-detail";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { SupportThreadMessages } from "@/components/support/support-thread-messages";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { createSupportTicket } from "./actions";
import {
  buildSupportMetrics,
  formatSupportDate,
  hasAdminReply,
  lastActivityAt,
  matchesSupportFilter,
  ticketListPreview,
  type SupportStatusFilter,
  type SupportTicketRow,
} from "./support-helpers";
import { TicketReplyForm } from "./ticket-reply-form";

type SupportViewProps = {
  initialTickets: SupportTicketRow[];
  className?: string;
};

function statusVariant(status: string): "success" | "muted" {
  return status.toLowerCase() === "open" ? "success" : "muted";
}

export function SupportView({ initialTickets, className }: SupportViewProps) {
  const serviceTheme = useServiceTheme();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = prefersReducedMotion || serviceTheme;
  const [statusFilter, setStatusFilter] = useState<SupportStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const metrics = useMemo(() => buildSupportMetrics(initialTickets), [initialTickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialTickets.filter((t) => {
      if (!matchesSupportFilter(t, statusFilter)) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        (t.support_ticket_messages ?? []).some((m) =>
          m.body.toLowerCase().includes(q),
        )
      );
    });
  }, [initialTickets, statusFilter, search]);

  const resolvedSelectedId = useMemo(() => {
    if (selectedId && filtered.some((t) => t.id === selectedId)) {
      return selectedId;
    }
    return serviceTheme ? null : filtered[0]?.id ?? null;
  }, [selectedId, filtered, serviceTheme]);

  const selected = useMemo(
    () => filtered.find((t) => t.id === resolvedSelectedId) ?? null,
    [filtered, resolvedSelectedId],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setFormMsg(null);
      startTransition(async () => {
        try {
        const result = await createSupportTicket({ subject, body });
        if (result.ok) {
          setSubject("");
          setBody("");
          setFormMsg(null);
          setNewOpen(false);
          setStatusFilter("all");
          setSelectedId(result.ticketId);
          router.refresh();
        } else {
          setFormMsg(result.message);
        }
        } catch { setFormMsg("We couldn’t send your request. Your message is still here — please try again."); }
      });
    },
    [subject, body, router],
  );

  const onNewOpenChange = useCallback((open: boolean) => {
    setNewOpen(open);
    if (!open) {
      setFormMsg(null);
    }
  }, []);

  const fieldClass = cn(DASHBOARD_INPUT_CLASS, "text-[13px]");

  const filterTabs: { id: SupportStatusFilter; label: string; count: number }[] =
    [
      { id: "all", label: "All", count: metrics.total },
      { id: "open", label: "Open", count: metrics.open },
      { id: "closed", label: "Closed", count: metrics.closed },
    ];

  return (
    <>
      <DashboardAnimatedPageSections className={className}>
      <div className="shrink-0">
        <DashboardPageHeader
          eyebrow="Support"
          title={serviceTheme ? "Help & support" : "Support"}
          icon={LifeBuoy}
          description="Ask a question or get help from the Cara team."

          summary={[
            { value: String(metrics.open), label: "open" },
            { value: String(metrics.closed), label: "closed" },
            { value: String(metrics.total), label: "total" },
          ]}
          actions={
            <Button
              type="button"
              onClick={() => setNewOpen(true)}
              className={DASHBOARD_PRIMARY_BUTTON_CLASS}
            >
              <Plus className="size-4" aria-hidden />
              New ticket
            </Button>
          }
        />
      </div>

      <section
        className={cn(
          DASHBOARD_CARD_SURFACE,
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          !mobileDetailOpen && "max-lg:max-h-[60dvh] max-lg:flex-none",
        )}
      >
        <ListDetailLayout hideDetail={!selected}
          mobileDetailOpen={mobileDetailOpen}
          onMobileBack={() => setMobileDetailOpen(false)}
          className="min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(280px,0.75fr)_minmax(360px,1fr)]"
          list={
            <div className="flex h-full min-h-0 flex-col overflow-hidden border-slate-100 bg-white max-xl:border-b xl:border-r">
              <div className="flex shrink-0 flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
                <div
                  className="inline-flex w-full rounded-full border border-slate-200 bg-slate-50/90 p-0.5"
                  role="tablist"
                  aria-label="Ticket status"
                >
                  {filterTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={statusFilter === tab.id}
                      onClick={() => setStatusFilter(tab.id)}
                      className={cn(
                        "min-w-0 flex-1 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                        statusFilter === tab.id
                          ? "bg-[#353D42] text-white shadow-sm"
                          : "text-slate-600 hover:bg-white hover:text-[#0b1220]",
                      )}
                    >
                      {tab.label}
                      <span
                        className={cn(
                          "ml-1 tabular-nums",
                          statusFilter === tab.id
                            ? "text-white/80"
                            : "text-slate-400",
                        )}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tickets"
                    aria-label="Search tickets"
                    className="h-11 border-slate-300 bg-white py-1 pl-8 text-[13px] placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={LifeBuoy}
                    title={
                      initialTickets.length === 0 ? "No tickets yet" : "No matches"
                    }
                    description={
                      initialTickets.length === 0
                        ? "Use New ticket when you need help from the HelloCara team."
                        : "Try a different filter or search term."
                    }
                    className="py-12"
                  />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    <AnimatePresence initial={false}>
                      {filtered.map((t) => {
                        const active = t.id === resolvedSelectedId;
                        const replied = hasAdminReply(t);
                        const row = (
                          <button
                            type="button"
                            onClick={() => {setSelectedId(t.id); setMobileDetailOpen(true);}}
                            className={cn(
                              "grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3.5 text-left transition-colors sm:px-5",
                              "hover:bg-slate-50/90",
                              active && "bg-slate-100/80",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-[14px] font-semibold text-[#0b1220]">
                                  {t.subject}
                                </span>
                                {replied ? (
                                  <StatusPill
                                    variant="info"
                                    className="h-5 px-1.5 py-0 text-[10px]"
                                  >
                                    Reply
                                  </StatusPill>
                                ) : null}
                              </span>
                              <span className="mt-1 line-clamp-2 block text-[12.5px] leading-snug text-slate-600">
                                {ticketListPreview(t)}
                              </span>
                              <span className="mt-1.5 block text-[11px] tabular-nums text-slate-500">
                                {formatSupportDate(lastActivityAt(t))}
                              </span>
                            </span>
                            <StatusPill
                              variant={statusVariant(t.status)}
                              dot
                              className="mt-0.5 shrink-0 capitalize"
                            >
                              {t.status}
                            </StatusPill>
                          </button>
                        );

                        if (reduceMotion) {
                          return <li key={t.id}>{row}</li>;
                        }

                        return (
                          <motion.li
                            key={t.id}
                            variants={dashboardQuickEnterVariants}
                            initial="hidden"
                            animate="show"
                          >
                            {row}
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
            </div>
          }
          detail={
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={selected.id}
                  className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
                  variants={reduceMotion ? undefined : onboardingPageVariants}
                  initial={reduceMotion ? false : "initial"}
                  animate={reduceMotion ? undefined : "animate"}
                  exit={reduceMotion ? undefined : "exit"}
                >
                  <DetailPanelShell surface="embedded">
                    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
                          Ticket
                        </p>
                        <h2 className="mt-0.5 truncate text-[16px] font-semibold tracking-tight text-[#0b1220]">
                          {selected.subject}
                        </h2>
                        <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                          {formatSupportDate(selected.created_at)}
                        </p>
                      </div>
                      <StatusPill
                        variant={statusVariant(selected.status)}
                        dot
                        className="shrink-0 capitalize"
                      >
                        {selected.status}
                      </StatusPill>
                    </div>
                    <DetailPanelBody
                      data-support-thread-scroll
                      className="min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-y-contain px-4 py-3"
                    >
                      <SupportThreadMessages
                        openedAt={selected.created_at}
                        initialBody={selected.body}
                        messages={selected.support_ticket_messages ?? []}
                        perspective="salon"
                      />
                    </DetailPanelBody>
                    <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
                      <TicketReplyForm
                        ticketId={selected.id}
                        ticketStatus={selected.status}
                      />
                      {selected.status.toLowerCase() === "open" &&
                      !hasAdminReply(selected) ? (
                        <p className="mt-2 text-[11px] leading-snug text-slate-500">
                          The Cliste team typically replies within one business day.
                        </p>
                      ) : null}
                    </div>
                  </DetailPanelShell>
                </motion.div>
              ) : (
                <motion.div
                  key="support-empty-detail"
                  className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
                  variants={reduceMotion ? undefined : onboardingPageVariants}
                  initial={reduceMotion ? false : "initial"}
                  animate={reduceMotion ? undefined : "animate"}
                  exit={reduceMotion ? undefined : "exit"}
                >
                  <DetailPanelShell surface="embedded">
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                      <EmptyState
                        icon={LifeBuoy}
                        title="Select a ticket"
                        description="Choose a ticket from the list to read the thread and reply."
                      />
                    </div>
                  </DetailPanelShell>
                </motion.div>
              )}
            </AnimatePresence>
          }
        />
      </section>
      </DashboardAnimatedPageSections>

      <Dialog open={newOpen} onOpenChange={onNewOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>New ticket</DialogTitle>
            <DialogDescription>
              Describe your question or issue. We will reply in this thread.
            </DialogDescription>
          </DialogHeader>
          <form noValidate onSubmit={handleSubmit}>
            <DashboardAnimatedGroup className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="support-subject">Subject</Label>
                <Input
                  id="support-subject"
                  value={subject}
                  onChange={(e) => { setSubject(e.target.value); setFormMsg(null); }}
                  placeholder="e.g. Call audio quality on inbound calls"
                  maxLength={200}
                  autoComplete="off"
                  className={fieldClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support-body">Message</Label>
                <Textarea
                  id="support-body"
                  value={body}
                  onChange={(e) => { setBody(e.target.value); setFormMsg(null); }}
                  placeholder="Include what happened, when, and anything that helps us help you."
                  className={cn(fieldClass, "min-h-32 resize-y")}
                  maxLength={8000}
                />
              </div>
              <FormFeedback message={formMsg} focusOnError />
            </DashboardAnimatedGroup>
            <DialogFooter className="mt-4 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className={DASHBOARD_SECONDARY_BUTTON_CLASS}
                onClick={() => onNewOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className={DASHBOARD_PRIMARY_BUTTON_CLASS}
                disabled={pending}
              >
                {pending ? "Sending…" : "Submit ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
