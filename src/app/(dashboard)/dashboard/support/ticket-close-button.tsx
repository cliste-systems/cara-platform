"use client";
import { FormFeedback } from "@/components/ui/form-feedback";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { cn } from "@/lib/utils";

import { closeSupportTicket } from "./actions";

type TicketCloseButtonProps = {
  ticketId: string;
  className?: string;
};

export function TicketCloseButton({ ticketId, className }: TicketCloseButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function handleConfirm() {
    setMsg(null);
    startTransition(async () => {
      const result = await closeSupportTicket(ticketId);
      if (result.ok) {
        setConfirmOpen(false);
        router.refresh();
      } else {
        setMsg(result.message);
      }
    });
  }

  return (
    <>
      <span className={cn("inline-flex flex-col items-end gap-0.5", className)}>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
          className="cursor-pointer text-[12px] font-medium text-slate-500 transition-colors hover:text-[#0b1220] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Closing…" : "Close ticket"}
        </button>
        {msg ? (
          <FormFeedback message={msg} />
        ) : null}
      </span>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Close this ticket?"
        description="You can reopen it by sending another reply."
        confirmLabel="Close ticket"
        onConfirm={handleConfirm}
        pending={pending}
      />
    </>
  );
}
