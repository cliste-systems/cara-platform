import { CheckCircle2, CircleHelp, Clock3, MinusCircle, XCircle } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import type { CallAnalysisCheck } from "@/lib/call-analysis";
import type { AnalysisRecord } from "./load-call-analysis";
import { CALL_ANALYSIS_VERSION } from "@/lib/call-analysis-simple";

type AnalysisStatusRecord = Pick<AnalysisRecord, "status" | "verdict" | "checklist_version">;

export type AnalysisDisplayStatus = "pass" | "fail" | "review" | "outdated" | "pending" | "error" | "queued" | "unreviewed";

export function analysisDisplayStatus(analysis: AnalysisStatusRecord | null): AnalysisDisplayStatus {
  if (!analysis) return "unreviewed";
  if (analysis.status === "pending") return "queued";
  if (analysis.status === "error") return "error";
  if (analysis.status !== "completed") return "pending";
  if (analysis.checklist_version !== CALL_ANALYSIS_VERSION) return "outdated";
  return analysis.verdict ?? "review";
}

export const ANALYSIS_STATUS_LABELS: Record<AnalysisDisplayStatus, string> = {
  pass: "Pass", fail: "Fail", review: "Needs review", outdated: "Needs update", pending: "Analysing", error: "Analysis error", queued: "Queued", unreviewed: "Not scheduled",
};

export function AnalysisStatusBadge({ analysis }: { analysis: AnalysisStatusRecord | null }) {
  const status = analysisDisplayStatus(analysis);
  const tone = status === "pass" ? "success" : status === "fail" || status === "error" ? "danger" : status === "review" ? "warning" : "neutral";
  const Icon = status === "pass" ? CheckCircle2 : status === "fail" || status === "error" ? XCircle : status === "review" ? CircleHelp : Clock3;
  return <AdminBadge tone={tone} className="gap-1.5 whitespace-nowrap"><Icon className="size-3.5" aria-hidden />{ANALYSIS_STATUS_LABELS[status]}</AdminBadge>;
}

const CHECK_STATUS = {
  pass: { label: "Pass", icon: CheckCircle2, className: "text-emerald-700" },
  fail: { label: "Fail", icon: XCircle, className: "text-red-700" },
  unverified: { label: "Unverified", icon: CircleHelp, className: "text-amber-700" },
  not_applicable: { label: "Not applicable", icon: MinusCircle, className: "text-gray-400" },
};

export function CheckStatus({ status }: { status: CallAnalysisCheck["status"] }) {
  const { label, icon: Icon, className } = CHECK_STATUS[status];
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${className}`}><Icon className="size-4" aria-hidden />{label}</span>;
}
