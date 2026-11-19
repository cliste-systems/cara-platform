"use client";
import { FormFeedback } from "@/components/ui/form-feedback";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import {
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { replyToSupportTicket } from "./actions";
import { TicketCloseButton } from "./ticket-close-button";

type TicketReplyFormProps = {
  ticketId: string;
  ticketStatus: string;
};

export function TicketReplyForm({ ticketId, ticketStatus }: TicketReplyFormProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isClosed = ticketStatus.toLowerCase() === "closed";

  const submit = useCallback(() => {
    setMsg(null);
    startTransition(async () => {
      const result = await replyToSupportTicket({ ticketId, body });
      if (result.ok) {
        setBody("");
        router.refresh();
      } else {
        setMsg(result.message);
      }
    });
  }, [ticketId, body, router]);

  if (isClosed) {
    return (
      <p className="text-[13px] leading-relaxed text-slate-600">
        This ticket is closed. Send a reply to reopen it, or open a new ticket
        for a different issue.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`reply-${ticketId}`} className="text-[12px] text-[#0b1220]">
          Reply
        </Label>
        <TicketCloseButton ticketId={ticketId} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea
          id={`reply-${ticketId}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Send a follow-up to Cliste…"
          className={cn(
            DASHBOARD_INPUT_CLASS,
            "min-h-[3.25rem] flex-1 resize-none py-2 sm:min-h-[2.75rem]",
          )}
          rows={2}
          maxLength={8000}
        />
        <Button
          type="button"
          disabled={pending || !body.trim()}
          onClick={submit}
          className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "shrink-0 sm:mb-0.5")}
        >
          {pending ? "Sending…" : "Send reply"}
        </Button>
      </div>
      {msg ? (
        <FormFeedback message={msg} />
      ) : null}
    </div>
  );
}
