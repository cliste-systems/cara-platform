"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { requireAdminPermission } from "@/lib/admin-session";
import { adminCallAnalysisPath } from "@/lib/admin-route-paths";
import { enqueueCallAnalysis, runCallAnalysis } from "@/lib/call-analysis-server";
import { CALL_ANALYSIS_VERSION } from "@/lib/call-analysis-simple";
import { createCallRecordingSignedUrl } from "@/lib/call-recordings-server";
import { CALL_ANALYSIS_ID_RE, loadCallAnalysisDetail } from "./load-call-analysis";

export async function retryCallAnalysis(callLogId: string): Promise<{ ok: boolean; message: string }> {
  await requireAdminPermission("calls");
  if (!CALL_ANALYSIS_ID_RE.test(callLogId)) return { ok: false, message: "This call could not be found." };
  try {
    const call = await loadCallAnalysisDetail(callLogId);
    if (!call) return { ok: false, message: "This call could not be found." };
    const oldReview = call.analysis?.status === "completed" && call.analysis.checklist_version !== CALL_ANALYSIS_VERSION;
    if (!oldReview && (call.analysis?.status !== "error" || call.analysis.next_attempt_at)) {
      return { ok: false, message: "This call is reviewed automatically. A retry is only needed after automatic attempts have stopped." };
    }
    const result = await enqueueCallAnalysis({ callLogId, force: true });
    if (!result.queued) return { ok: false, message: "This call cannot be queued right now. It may already be running or its review data may have expired." };
    after(async () => {
      try {
        await runCallAnalysis(callLogId);
      } catch (error) {
        console.error("[admin-call-analysis] review failed", error instanceof Error ? error.message : "Unknown error");
      }
    });
    revalidatePath(adminCallAnalysisPath());
    revalidatePath(adminCallAnalysisPath(callLogId));
    return { ok: true, message: "Analysis retry queued. The page will update as the review finishes." };
  } catch {
    return { ok: false, message: "Could not queue the analysis. Please try again." };
  }
}

export async function fetchAdminCallRecording(callLogId: string): Promise<{ url: string | null }> {
  await requireAdminPermission("calls");
  const call = await loadCallAnalysisDetail(callLogId);
  if (!call?.audio_storage_path) return { url: null };
  const url = await createCallRecordingSignedUrl({
    organizationId: call.organization_id,
    callLogId: call.id,
    storagePath: call.audio_storage_path,
  });
  return { url };
}
