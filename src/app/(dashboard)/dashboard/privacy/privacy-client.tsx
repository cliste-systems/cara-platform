"use client";
import { FormFeedback } from "@/components/ui/form-feedback";

import { useState, useTransition } from "react";
import { Download, FileJson, Trash2 } from "lucide-react";

import { ErasureReviewCard } from "@/components/dashboard/caller-data-erase-dialog";
import { DashboardAnimatedGroup } from "@/components/dashboard/dashboard-animated-group";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import { formatE164ForDisplay } from "@/lib/call-history-types";
import { cn } from "@/lib/utils";

import {
  eraseCustomerData,
  exportCustomerData,
  exportOrganizationPortabilityData,
  type GdprErasureCounts,
  type GdprExportPayload,
  type GdprPortabilityPayload,
} from "./actions";
import { portabilityPayloadToCsv } from "@/lib/gdpr-portability";

type ExportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; data: GdprExportPayload; phoneE164: string };

type EraseState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; counts: GdprErasureCounts; phoneE164: string };

type PrivacyToolsClientProps = {
  includesAppointments?: boolean;
};

function formatPhoneForDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    return formatE164ForDisplay(normalizeCustomerPhoneE164(trimmed)) || trimmed;
  } catch {
    return trimmed;
  }
}

export function PrivacyToolsClient({
  includesAppointments = true,
}: PrivacyToolsClientProps) {
  const [exportPhone, setExportPhone] = useState("");
  const [exportState, setExportState] = useState<ExportState>({ status: "idle" });
  const [exportPending, startExport] = useTransition();

  const [erasePhone, setErasePhone] = useState("");
  const [erasePerformedBy, setErasePerformedBy] = useState("");
  const [eraseReason, setEraseReason] = useState("");
  const [eraseConfirm, setEraseConfirm] = useState("");
  const [eraseStep, setEraseStep] = useState<"details" | "confirm">("details");
  const [eraseState, setEraseState] = useState<EraseState>({ status: "idle" });
  const [erasePending, startErase] = useTransition();

  const [portabilityState, setPortabilityState] = useState<
    | { status: "idle" }
    | { status: "error"; message: string }
    | { status: "ready"; data: GdprPortabilityPayload }
  >({ status: "idle" });
  const [portabilityPending, startPortability] = useTransition();

  const fieldClass = cn(DASHBOARD_INPUT_CLASS, "text-[13px] text-[#0b1220]");

  function onExport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("phone", exportPhone);
    startExport(async () => {
      const r = await exportCustomerData(fd);
      if (!r.ok) {
        setExportState({ status: "error", message: r.message });
      } else {
        setExportState({ status: "ready", data: r.data, phoneE164: r.phoneE164 });
      }
    });
  }

  function downloadExport() {
    if (exportState.status !== "ready") return;
    const blob = new Blob([JSON.stringify(exportState.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hellocara-data-export-${exportState.phoneE164.replace(/\D/g, "")}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onPortabilityExport(format: "json" | "csv") {
    startPortability(async () => {
      const r = await exportOrganizationPortabilityData();
      if (!r.ok) {
        setPortabilityState({ status: "error", message: r.message });
        return;
      }
      setPortabilityState({ status: "ready", data: r.data });
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "json") {
        const blob = new Blob([JSON.stringify(r.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hellocara-portability-export-${stamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([portabilityPayloadToCsv(r.data)], {
          type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hellocara-portability-export-${stamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  function onErase(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (eraseStep === "details") {
      if (!erasePhone.trim() || !erasePerformedBy.trim() || !eraseReason.trim()) return;
      setEraseStep("confirm");
      setEraseConfirm("");
      return;
    }
    const fd = new FormData();
    fd.set("phone", erasePhone);
    fd.set("performedBy", erasePerformedBy);
    fd.set("reason", eraseReason);
    fd.set("confirm", eraseConfirm);
    startErase(async () => {
      const r = await eraseCustomerData(fd);
      if (!r.ok) {
        setEraseState({ status: "error", message: r.message });
      } else {
        setEraseState({ status: "done", counts: r.affected, phoneE164: r.phoneE164 });
        setErasePhone("");
        setErasePerformedBy("");
        setEraseReason("");
        setEraseConfirm("");
        setEraseStep("details");
      }
    });
  }

  const trimmedEraseReason = eraseReason.trim();
  const trimmedErasePerformedBy = erasePerformedBy.trim();
  const erasePhoneDisplay = formatPhoneForDisplay(erasePhone);
  const canContinueErase =
    erasePhone.trim().length > 0 &&
    trimmedErasePerformedBy.length > 0 &&
    trimmedEraseReason.length > 0;
  const canSubmitErase = eraseConfirm.trim().toUpperCase() === "ERASE";

  return (
    <DashboardAnimatedGroup>
      <SectionCard
        flat
        icon={Download}
        title="Export a customer's data"
        description="GDPR Article 15 — right of access. Search by phone, then download everything we hold for that customer. The file is JSON — a standard export you can open in Notes or TextEdit, or send to a solicitor or IT helper if they ask for it."
      >
        <form
          onSubmit={onExport}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="gdpr-export-phone">Customer phone</Label>
            <Input
              id="gdpr-export-phone"
              type="tel"
              inputMode="tel"
              placeholder="+353 87 123 4567"
              value={exportPhone}
              onChange={(e) => setExportPhone(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={exportPending}
            className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "w-full sm:w-auto")}
          >
            {exportPending ? "Searching…" : "Search records"}
          </Button>
        </form>
        {exportState.status === "error" ? (
          <FormFeedback message={exportState.message} />
        ) : null}
        {exportState.status === "ready" ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-[13px] leading-relaxed text-slate-700">
            <p>
              Found{" "}
              {includesAppointments ? (
                <>
                  <strong className="text-[#0b1220]">
                    {exportState.data.appointments.length}
                  </strong>{" "}
                  appointments,{" "}
                </>
              ) : null}
              <strong className="text-[#0b1220]">
                {exportState.data.call_logs.length}
              </strong>{" "}
              call logs,{" "}
              <strong className="text-[#0b1220]">
                {exportState.data.action_tickets.length}
              </strong>{" "}
              action tickets for{" "}
              <strong className="text-[#0b1220]">{exportState.phoneE164}</strong>.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={downloadExport}
              className={cn("mt-3", DASHBOARD_SECONDARY_BUTTON_CLASS)}
            >
              Download JSON
            </Button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        flat
        icon={FileJson}
        title="Export all customer records (Article 20)"
        description={
          includesAppointments
            ? "GDPR Article 20 — data portability. Download every appointment, call log, and action ticket for your business in a structured JSON or CSV bundle."
            : "GDPR Article 20 — data portability. Download every call log and action ticket for your business in a structured JSON or CSV bundle."
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            disabled={portabilityPending}
            onClick={() => onPortabilityExport("json")}
            className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "w-full sm:w-auto")}
          >
            {portabilityPending ? "Preparing…" : "Download JSON bundle"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={portabilityPending}
            onClick={() => onPortabilityExport("csv")}
            className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "w-full sm:w-auto")}
          >
            Download CSV bundle
          </Button>
        </div>
        {portabilityState.status === "error" ? (
          <FormFeedback message={portabilityState.message} />
        ) : null}
        {portabilityState.status === "ready" ? (
          <p className="text-[13px] text-slate-600">
            Last export:{" "}
            {includesAppointments
              ? `${portabilityState.data.appointments.length} appointments, `
              : ""}
            {portabilityState.data.call_logs.length} call logs,{" "}
            {portabilityState.data.action_tickets.length} action tickets.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        flat
        icon={Trash2}
        title="Erase a customer's data"
        description="GDPR Article 17 — erasure. Cannot be undone."
      >
        <form onSubmit={onErase} className="space-y-4">
          {eraseStep === "details" ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="gdpr-erase-phone">Customer phone</Label>
                  <Input
                    id="gdpr-erase-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="+353 87 123 4567"
                    value={erasePhone}
                    onChange={(e) => setErasePhone(e.target.value)}
                    className={fieldClass}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gdpr-erase-performed-by">Erased by</Label>
                  <Input
                    id="gdpr-erase-performed-by"
                    type="text"
                    placeholder="Staff member name"
                    value={erasePerformedBy}
                    onChange={(e) => setErasePerformedBy(e.target.value)}
                    className={fieldClass}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gdpr-erase-reason">Reason for deletion</Label>
                <Textarea
                  id="gdpr-erase-reason"
                  value={eraseReason}
                  onChange={(e) => setEraseReason(e.target.value)}
                  placeholder="e.g. Customer requested erasure by phone"
                  rows={4}
                  className={cn(
                    fieldClass,
                    "min-h-[6.5rem] w-full resize-y bg-[#fbfcfb] px-3.5 py-3 text-[13px] leading-relaxed",
                  )}
                  required
                />
              </div>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                <Button
                  type="submit"
                  disabled={erasePending || !canContinueErase}
                  className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "w-full sm:w-auto")}
                >
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <>
              <ErasureReviewCard
                phoneDisplay={erasePhoneDisplay || erasePhone.trim()}
                performedByName={trimmedErasePerformedBy}
                reason={trimmedEraseReason}
              />
              <div className="space-y-1.5">
                <Label htmlFor="gdpr-erase-confirm">Type ERASE to confirm</Label>
                <Input
                  id="gdpr-erase-confirm"
                  type="text"
                  placeholder="ERASE"
                  value={eraseConfirm}
                  onChange={(e) => setEraseConfirm(e.target.value)}
                  className={cn(fieldClass, "uppercase")}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  disabled={erasePending}
                  onClick={() => {
                    setEraseStep("details");
                    setEraseConfirm("");
                  }}
                  className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "w-full sm:w-auto")}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={erasePending || !canSubmitErase}
                  className={cn(
                    "h-10 w-full rounded-xl bg-red-700 px-5 text-[13px] font-medium text-white hover:bg-red-800 disabled:opacity-50 sm:w-auto",
                  )}
                >
                  {erasePending ? "Erasing…" : "Erase customer data"}
                </Button>
              </div>
            </>
          )}
        </form>
        {eraseState.status === "error" ? (
          <FormFeedback message={eraseState.message} />
        ) : null}
        {eraseState.status === "done" ? (
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4 text-[13px] leading-relaxed text-slate-700">
            <p>
              Erased data for{" "}
              <strong className="text-[#0b1220]">{eraseState.phoneE164}</strong>:{" "}
              {includesAppointments && eraseState.counts.appointments_anonymised > 0
                ? `${eraseState.counts.appointments_anonymised} appointments, `
                : ""}
              {eraseState.counts.call_logs_redacted} call logs,{" "}
              {eraseState.counts.action_tickets_redacted} action tickets
              {eraseState.counts.blocked_callers_deleted > 0
                ? `, ${eraseState.counts.blocked_callers_deleted} blocklist entries`
                : ""}
              .
            </p>
          </div>
        ) : null}
      </SectionCard>
    </DashboardAnimatedGroup>
  );
}
