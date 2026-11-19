"use client";

import { useEffect, useState } from "react";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

import {
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import styles from "./service-privacy-dialog.module.css";

const deletionReasons = [
  {value:"Customer requested deletion",label:"Customer requested deletion"},
  {value:"Wrong number",label:"Wrong number"},
  {value:"Duplicate caller record",label:"Duplicate caller record"},
  {value:"Spam or abusive caller",label:"Spam or abusive caller"},
  {value:"Data no longer needed",label:"Data no longer needed"},
  {value:"other",label:"Other — enter a reason"},
];

type CallerDataEraseDialogProps = {
  serviceTheme?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneDisplay: string;
  callerName?: string | null;
  pending?: boolean;
  onConfirm: (input: { reason: string; performedBy: string; confirm: string }) => void;
};

export function ErasureReviewCard({
  phoneDisplay,
  callerName,
  performedByName,
  reason,
}: {
  phoneDisplay: string;
  callerName?: string | null;
  performedByName: string;
  reason: string;
}) {
  const name = callerName?.trim();

  return (
    <div className="rounded-2xl border border-[#dfe7e2] bg-[#f6faf7] px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7c75]">
        Erasure summary
      </p>
      <dl className="mt-3 space-y-3 text-[14px]">
        {name ? (
          <div>
            <dt className="text-[12px] font-medium text-[#6b7c75]">Name</dt>
            <dd className="mt-0.5 font-medium text-[#11181d]">{name}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[12px] font-medium text-[#6b7c75]">Phone</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-[#11181d]">{phoneDisplay}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-medium text-[#6b7c75]">Reason</dt>
          <dd className="mt-0.5 whitespace-pre-wrap leading-relaxed text-[#11181d]">
            {reason}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] font-medium text-[#6b7c75]">Erased by</dt>
          <dd className="mt-0.5 font-medium text-[#11181d]">{performedByName}</dd>
        </div>
      </dl>
    </div>
  );
}

export function CallerDataEraseDialog({
  open,
  serviceTheme = false,
  onOpenChange,
  phoneDisplay,
  callerName = null,
  pending = false,
  onConfirm,
}: CallerDataEraseDialogProps) {
  const [step, setStep] = useState<"details" | "confirm">("details");
  const [reason, setReason] = useState("");
  const [reasonChoice, setReasonChoice] = useState<string | null>(null);
  const [performedBy, setPerformedBy] = useState("");
  const [eraseConfirmText, setEraseConfirmText] = useState("");

  const [previousOpen, setPreviousOpen] = useState(open);
  if (previousOpen !== open) {
    setPreviousOpen(open);
    if (!open) {
      setStep("details");
      setReason("");
      setReasonChoice(null);
      setPerformedBy("");
      setEraseConfirmText("");
    }
  }

  const trimmedReason = reason.trim();
  const trimmedPerformedBy = performedBy.trim();
  const canContinue = trimmedReason.length > 0 && trimmedPerformedBy.length > 0;
  const canDelete = eraseConfirmText.trim().toUpperCase() === "ERASE";

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setStep("details");
      setReason("");
      setReasonChoice(null);
      setPerformedBy("");
      setEraseConfirmText("");
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton
        overlayClassName={serviceTheme ? styles.backdrop : undefined}
        className={cn("gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-xl", serviceTheme && styles.popup)}
      >
        <DialogHeader className="space-y-0 border-b border-slate-100 px-6 pb-5 pt-6 text-left sm:px-8">
          <DialogTitle className="pr-8 text-[18px] font-semibold tracking-tight text-[#0b1220]">
            {step === "details" ? "Delete caller data?" : "Confirm deletion"}
          </DialogTitle>
          <DialogDescription className="mt-2.5 max-w-prose text-[14px] leading-relaxed text-slate-600">
            {step === "details" ? (
              <>
                This permanently redacts{" "}
                <span className="font-semibold tabular-nums text-[#11181d]">
                  {phoneDisplay}
                </span>{" "}
                across your account — call transcripts, summaries, recordings, and department
                tickets. Call log entries stay visible with an audit record.
              </>
            ) : (
              "Review the summary below, then type ERASE to permanently delete this caller's personal data."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-6 sm:px-8">
          {step === "details" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="erase-caller-performed-by" className="text-[13px] text-slate-700">
                  Erased by
                </Label>
                <Input
                  id="erase-caller-performed-by"
                  type="text"
                  value={performedBy}
                  onChange={(event) => setPerformedBy(event.target.value)}
                  placeholder="Staff member name"
                  className={cn(DASHBOARD_INPUT_CLASS, "h-11")}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="erase-caller-reason" className="text-[13px] text-slate-700">
                  Reason for deletion
                </Label>
                {serviceTheme && <Select.Root value={reasonChoice} items={deletionReasons} onValueChange={value => { setReasonChoice(value); setReason(value && value !== "other" ? value : ""); }}>
                  <Select.Trigger id="erase-caller-reason" className={styles.reasonTrigger} aria-label="Reason for deletion"><Select.Value placeholder="Choose a reason"/><Select.Icon><ChevronDown aria-hidden="true"/></Select.Icon></Select.Trigger>
                  <Select.Portal><Select.Positioner sideOffset={8} collisionPadding={14} alignItemWithTrigger={false} className={styles.reasonPositioner}><Select.Popup className={styles.reasonPopup}><Select.List>
                    {deletionReasons.map(option => <Select.Item key={option.value} value={option.value} className={styles.reasonItem}><Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator><Check aria-hidden="true"/></Select.ItemIndicator></Select.Item>)}
                  </Select.List></Select.Popup></Select.Positioner></Select.Portal>
                </Select.Root>}
                {(!serviceTheme || reasonChoice === "other") && <>
                  {serviceTheme && <Label htmlFor="erase-caller-custom-reason" className="text-[13px] text-slate-700">Your reason</Label>}
                  <Textarea
                  id={serviceTheme ? "erase-caller-custom-reason" : "erase-caller-reason"}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Enter the reason for deletion"
                  rows={4}
                  className={cn(
                    DASHBOARD_INPUT_CLASS,
                    "min-h-[6.5rem] resize-y bg-[#fbfcfb] px-3.5 py-3 text-[14px] leading-relaxed",
                  )}
                  required
                />
                </>}

              </div>
            </div>
          ) : (
            <>
              <ErasureReviewCard
                phoneDisplay={phoneDisplay}
                callerName={callerName}
                performedByName={trimmedPerformedBy}
                reason={trimmedReason}
              />
              <div className="space-y-2">
                <Label htmlFor="erase-caller-confirm" className="text-[13px] text-slate-700">
                  Type ERASE to confirm
                </Label>
                <Input
                  id="erase-caller-confirm"
                  type="text"
                  value={eraseConfirmText}
                  onChange={(event) => setEraseConfirmText(event.target.value)}
                  placeholder="ERASE"
                  className={cn(DASHBOARD_INPUT_CLASS, "h-11 uppercase")}
                  autoComplete="off"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-3 border-t border-slate-100 bg-[#fbfcfb] px-6 py-5 sm:px-8 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (step === "confirm") {
                setStep("details");
                setEraseConfirmText("");
                return;
              }
              handleClose(false);
            }}
            className={DASHBOARD_SECONDARY_BUTTON_CLASS}
          >
            {step === "confirm" ? "Back" : "Cancel"}
          </Button>
          <Button
            type="button"
            disabled={
              pending || (step === "details" ? !canContinue : !canDelete)
            }
            onClick={() => {
              if (step === "details") {
                if (!canContinue) return;
                setStep("confirm");
                return;
              }
              onConfirm({
                reason: trimmedReason,
                performedBy: trimmedPerformedBy,
                confirm: eraseConfirmText,
              });
            }}
            className={cn(
              step === "confirm"
                ? "h-10 rounded-xl bg-red-700 px-5 text-[13px] font-medium text-white hover:bg-red-800 disabled:opacity-50"
                : DASHBOARD_PRIMARY_BUTTON_CLASS,
            )}
          >
            {pending ? "Working…" : step === "details" ? "Continue" : "Delete caller data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
