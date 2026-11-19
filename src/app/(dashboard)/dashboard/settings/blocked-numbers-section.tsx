"use client";
import { FormFeedback } from "@/components/ui/form-feedback";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldOff } from "lucide-react";

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatE164ForDisplay } from "@/lib/call-history-types";
import { cn } from "@/lib/utils";

import {
  addBlockedCaller,
  removeBlockedCaller,
  saveBlockAnonymousCallers,
  type BlockedNumbersInitial,
} from "./blocked-numbers-actions";
import { SettingsSection } from "./settings-section";

type BlockedNumbersSectionProps = {
  initial: BlockedNumbersInitial;
};

export function BlockedNumbersSection({ initial }: BlockedNumbersSectionProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initial.rows);
  const [blockAnonymous, setBlockAnonymous] = useState(
    initial.blockAnonymousCallers,
  );
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const blockedSet = useMemo(
    () => new Set(rows.map((row) => row.caller_e164)),
    [rows],
  );

  useEffect(() => {
    setRows(initial.rows);
    setBlockAnonymous(initial.blockAnonymousCallers);
  }, [initial]);

  const fieldClass = cn(DASHBOARD_INPUT_CLASS, "text-[13px] text-[#0b1220]");

  function refreshAfterMutation() {
    router.refresh();
  }

  function onAdd() {
    setMsg(null);
    startTransition(async () => {
      const result = await addBlockedCaller({ phone, reason });
      if (!result.ok) {
        setMsg(result.message);
        return;
      }
      setPhone("");
      setReason("");
      setMsg("Number blocked.");
      refreshAfterMutation();
    });
  }

  function onConfirmRemove() {
    if (!removeId) return;
    const id = removeId;
    setMsg(null);
    startTransition(async () => {
      const result = await removeBlockedCaller({ id });
      setRemoveId(null);
      if (!result.ok) {
        setMsg(result.message);
        return;
      }
      setRows((prev) => prev.filter((row) => row.id !== id));
      setMsg("Number unblocked.");
      refreshAfterMutation();
    });
  }

  function onToggleAnonymous(enabled: boolean) {
    setBlockAnonymous(enabled);
    setMsg(null);
    startTransition(async () => {
      const result = await saveBlockAnonymousCallers({ enabled });
      if (!result.ok) {
        setBlockAnonymous(!enabled);
        setMsg(result.message);
        return;
      }
      setMsg(enabled ? "Anonymous callers will be blocked." : "Anonymous blocking turned off.");
      refreshAfterMutation();
    });
  }

  return (
    <SettingsSection title="Blocked numbers" id="blocked-numbers">
      <div className="space-y-4">
        <div className="rounded-xl border border-[#d9e2dd] bg-[#fbfcfb] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="block-anonymous" className="text-[13px] font-semibold text-[#0b1220]">
                Block withheld / anonymous callers
              </Label>
              <p className="text-[12px] leading-relaxed text-slate-600">
                Opt-in only. Withheld numbers are sent as{" "}
                <span className="font-mono text-slate-700">+anonymous</span>. Some
                genuine customers withhold their number — only enable if you are
                getting spam from withheld lines.
              </p>
            </div>
            <Switch
              id="block-anonymous"
              checked={blockAnonymous}
              disabled={pending}
              onCheckedChange={onToggleAnonymous}
              aria-describedby="block-anonymous-hint"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
          <p className="text-[13px] font-semibold text-[#0b1220]">Add a number</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="block-phone">Phone number</Label>
              <Input
                id="block-phone"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+353…"
                className={fieldClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-reason">Reason (optional)</Label>
              <Input
                id="block-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. repeated robocalls"
                className={fieldClass}
              />
            </div>
          </div>
          <Button
            type="button"
            disabled={pending || !phone.trim()}
            onClick={onAdd}
            className={DASHBOARD_PRIMARY_BUTTON_CLASS}
          >
            <Ban className="size-3.5" aria-hidden />
            Block number
          </Button>
        </div>

        <FormFeedback message={msg} tone={msg === "Number blocked." || msg === "Number unblocked." || msg === "Anonymous callers will be blocked." || msg === "Anonymous blocking turned off." ? "success" : "error"} />

        {rows.length === 0 ? (
          <EmptyState
            icon={ShieldOff}
            title="No blocked numbers"
            description="Numbers you block will hear a short message and hang up before Cara answers."
          />
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold tabular-nums text-[#0b1220]">
                    {formatE164ForDisplay(row.caller_e164) || row.caller_e164}
                  </p>
                  {row.reason?.trim() ? (
                    <p className="mt-0.5 text-[12px] text-slate-500">{row.reason}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setRemoveId(row.id)}
                  className={DASHBOARD_SECONDARY_BUTTON_CLASS}
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}

        {blockedSet.size > 0 ? (
          <p className="text-[12px] text-slate-500">
            {blockedSet.size} number{blockedSet.size === 1 ? "" : "s"} blocked for
            this location.
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={removeId != null}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null);
        }}
        title="Unblock this number?"
        description="They will be able to reach Cara again on your line."
        confirmLabel="Unblock"
        onConfirm={onConfirmRemove}
        pending={pending}
        destructive
      />
    </SettingsSection>
  );
}
