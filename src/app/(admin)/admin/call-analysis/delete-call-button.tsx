"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { adminSecondaryButtonClass } from "@/components/admin/admin-interactive";
import { deleteCallHistory } from "./actions";

export function DeleteCallButton({ callId, label, returnToList = false }: { callId: string; label: string; returnToList?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return <Dialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); setError(null); } }}>
    <DialogTrigger className={`${adminSecondaryButtonClass} text-red-700!`} aria-label={`Delete call: ${label}`}><Trash2 size={15} aria-hidden />Delete</DialogTrigger>
    <DialogContent className="bg-white sm:max-w-md" showCloseButton={!pending}>
      <DialogHeader><DialogTitle>Delete this call?</DialogTitle><DialogDescription>This permanently deletes the recording, transcript, review, diagnostics and linked call notes or action tickets. It cannot be undone.</DialogDescription></DialogHeader>
      <p className="rounded-md border border-[#e0e3e6] bg-[#f6f7f8] p-3 text-sm">{label}<span className="mt-1 block text-xs text-[#697078]">Ref {callId.slice(0, 8)}</span></p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <DialogFooter><button type="button" className={adminSecondaryButtonClass} disabled={pending} onClick={() => setOpen(false)}>Cancel</button><button type="button" disabled={pending} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-red-700 px-3 text-[13px] font-medium text-white hover:bg-red-800 disabled:opacity-50" onClick={() => {
        setError(null);
        startTransition(async () => {
          try {
            const result = await deleteCallHistory(callId);
            if (!result.ok) { setError(result.message); return; }
            setOpen(false);
            if (returnToList) router.replace("/admin/call-analysis");
            router.refresh();
          } catch { setError("Could not delete this call. Please try again."); }
        });
      }}>{pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Trash2 size={15} aria-hidden />}{pending ? "Deleting…" : "Delete call"}</button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
