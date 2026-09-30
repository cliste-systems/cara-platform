import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";

import { adminSecondaryButtonClass } from "@/components/admin/admin-interactive";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminErrorCard, AdminPageShell } from "@/components/admin/admin-page-shell";
import { requireAdminPermission } from "@/lib/admin-session";
import { adminCallAnalysisPath } from "@/lib/admin-route-paths";
import { CALL_ANALYSIS_QUESTIONS, isNegativeAnswer, CALL_ANALYSIS_VERSION, deriveCallAnalysisVerdict } from "@/lib/call-analysis-simple";
import { formatDurationLabel, formatE164ForDisplay } from "@/lib/call-history-types";
import { PRODUCT_NAME } from "@/lib/company-details";
import { AnalysisRecording, AnalysisRefresh, RetryAnalysisButton } from "../analysis-controls";
import { ReviewOutcome, ReviewPanel, type ReviewItem } from "../review-panel";
import { buildCallTechnicalHealth } from "@/lib/call-technical-health";
import { loadCallAnalysisDetail } from "../load-call-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata: Metadata = { title: `${PRODUCT_NAME} Admin — Call Analysis` };

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Dublin" });
}

export default async function CallAnalysisDetailPage({ params }: { params: Promise<{ callLogId: string }> }) {
  await requireAdminPermission("calls");
  const { callLogId } = await params;
  let call: Awaited<ReturnType<typeof loadCallAnalysisDetail>>;
  try { call = await loadCallAnalysisDetail(callLogId); } catch {
    return <AdminPageShell icon={ClipboardCheck} title="Call analysis" backHref={adminCallAnalysisPath()} backLabel="All call analyses"><AdminErrorCard message="This call analysis could not be loaded. Please try again." /></AdminPageShell>;
  }
  if (!call) notFound();
  const analysis = call.analysis;
  const running = analysis?.status === "pending" || analysis?.status === "running";
  const refreshActive = running || (analysis?.status === "error" && Boolean(analysis.next_attempt_at));
  const oldReview = analysis?.status === "completed" && analysis.checklist_version !== CALL_ANALYSIS_VERSION;
  const canRetry = (analysis?.status === "error" && !analysis.next_attempt_at) || oldReview;
  const result = analysis?.status === "completed" && !oldReview ? analysis.result : null;
  const savedDiagnostics = result?.evidenceSnapshot?.diagnostics ?? analysis?.source_diagnostics;
  const sourceDiagnostics = analysis?.source_diagnostics;
  const diagnostics = {
    ...(savedDiagnostics && typeof savedDiagnostics === "object" && !Array.isArray(savedDiagnostics) ? savedDiagnostics : {}),
    // Final timing can arrive after the conversation review was completed.
    ...(sourceDiagnostics && typeof sourceDiagnostics === "object" && "latency" in sourceDiagnostics ? { latency: sourceDiagnostics.latency } : {}),
    ...call.technicalDiagnostics,
  };
  const resolved = result?.checks.find(check => check.id === "resolved_request");
  const outcome: ReviewItem = { id: "outcome", label: "Caller outcome", value: resolved?.answer === "yes" ? "Resolved" : resolved?.answer === "no" ? "Not resolved" : "Unverified", status: resolved?.answer === "yes" ? "pass" : resolved?.answer === "no" ? "fail" : "unknown", detail: resolved?.reason || "Review not yet available." };
  const conversation: ReviewItem[] = CALL_ANALYSIS_QUESTIONS.filter(question => question.id !== "resolved_request").map(question => {
    const check = result?.checks.find(item => item.id === question.id);
    return { id: question.id, label: question.label, value: !check || check.answer === "unverified" ? "Unverified" : check.answer === "yes" ? "Yes" : "No", status: !check || check.answer === "unverified" ? "unknown" : isNegativeAnswer(check) ? "fail" : "pass", detail: check ? [check.reason, ...check.evidence.map(item => item.quote)].join("\n\n") : "Review pending." };
  });
  const technical = buildCallTechnicalHealth(diagnostics, call.post_call_status, call.transportSamples, call.transportComplete);
  const transportIds = new Set(["connection", "packet_loss", "jitter", "rtt", "concealment", "buffer"]);
  const priority = (check: typeof technical[number]) => check.status === "fail" ? 0 : transportIds.has(check.id) && check.value !== "Not captured" ? 1 : check.status === "pass" ? 2 : check.value !== "Not captured" ? 3 : 4;
  technical.sort((a, b) => priority(a) - priority(b));
  const wholeCallResult = result ? deriveCallAnalysisVerdict({ ...result, technicalChecks: technical }) : null;
  const recoveredTransport = call.transportSamples.some(sample => sample && typeof sample === "object" && "recoveredFrom" in sample && sample.recoveredFrom === "next-development-log");
  const summary = result?.summary || (oldReview ? "An updated review is available." : analysis?.status === "error" ? "Review could not finish." : "Review pending.");
  return <AdminPageShell compact fillViewport icon={ClipboardCheck} title="Call analysis"
    description={`${call.organization_name} · ${formatWhen(call.created_at)} · ${formatDurationLabel(call.duration_seconds)}`}
    actions={<><Link href={adminCallAnalysisPath()} className={adminSecondaryButtonClass}>All calls</Link><AnalysisRefresh active={refreshActive} />{canRetry ? <RetryAnalysisButton callLogId={call.id} label={oldReview ? "Update review" : undefined} /> : null}</>}>
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0 space-y-2">
        <div className="flex items-center gap-3 text-sm font-medium"><span>Overall call result</span><AdminBadge tone={wholeCallResult?.verdict === "fail" ? "danger" : wholeCallResult?.verdict === "pass" ? "success" : "warning"}>{wholeCallResult?.verdict === "fail" ? "Fail" : wholeCallResult?.verdict === "pass" ? "Pass" : "Needs review"}</AdminBadge>{wholeCallResult ? <span className="text-xs font-normal text-[#63766b]">{wholeCallResult.failedCount} failed checks · {wholeCallResult.unverifiedCount} unverified</span> : null}</div>
        <ReviewOutcome item={outcome} summary={summary} /></div>
      {analysis?.status === "error" ? <p className="shrink-0 text-xs text-red-700" role="alert">{analysis.error_message || "Analysis unavailable."}</p> : null}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <ReviewPanel title="What happened on this call?" items={conversation} improvement={result?.improvement} />
        <ReviewPanel title="Technical health" items={technical} note={recoveredTransport ? "Recovered browser samples · partial coverage" : call.transportSamples.length ? "LiveKit → browser · received audio" : "No saved browser samples for this call"} />
      </div>
      <details id="review-transcript" className="shrink-0 rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] px-5 py-3 text-xs">
        <summary className="cursor-pointer font-medium">Original captured conversation</summary>
        <p className="mt-2 text-[#63766b]">Saved speech text with personal details redacted. Generated replies do not prove every word played to the caller; use the recording for audio review.</p>
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-sm leading-6">{analysis?.source_transcript || call.transcript || "No conversation text was captured."}</pre>
      </details>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-[#6b7c75]">
        <span>{formatE164ForDisplay(call.caller_number)} · <span title={call.id}>Ref {call.id.slice(0, 8)}</span></span>
        <div className="flex items-center gap-3"><Link href={`${adminCallAnalysisPath(call.id)}#review-transcript`} className="underline underline-offset-4">View transcript</Link>{call.audio_storage_path ? <AnalysisRecording callLogId={call.id} /> : null}</div>
      </footer>
    </div>
  </AdminPageShell>;
}
