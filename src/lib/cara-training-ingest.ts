import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { classifyActionCategory } from "@/app/(dashboard)/dashboard/action-inbox/categories";
import { redactCallText } from "@/lib/transcript-redaction";

import {
  classifyTrainingAdmission,
  hasReusableQuestionEvidence,
  isGenericCaraQuestion,
} from "./cara-training-admission";
import { actionInboxTrainingQuestion } from "./cara-training-draft";
import { createTrainingItem } from "./cara-training";
import {
  isKnowledgeEnquiryHandoff,
  isRoutineHandoff,
  isStructuredHoursTopic,
  isCakePolicyKnowledge,
  type KnowledgeGapPayload,
} from "./cara-training-types";

function defaultQuestionForGap(gap: KnowledgeGapPayload): string {
  const q = gap.cara_question?.trim();
  if (q && !isGenericCaraQuestion(q)) return q;
  const topic = gap.topic.trim();
  const admission = classifyTrainingAdmission({
    gapSummary: topic,
    callerContext: gap.caller_context,
    caraQuestion: q,
    source: "call_gap",
  });
  if (admission.admit) return admission.displayQuestion;
  return `What should Cara tell callers about ${topic}?`;
}

function orgHasStructuredBusinessHours(raw: unknown): boolean {
  if (raw == null) return false;
  if (typeof raw === "string") return raw.trim().length > 0;
  if (typeof raw === "object") return Object.keys(raw as object).length > 0;
  return false;
}

/**
 * Ingest knowledge gaps reported by the voice worker after call-complete.
 */
export async function ingestCallKnowledgeGaps(
  admin: SupabaseClient,
  organizationId: string,
  callLogId: string,
  gaps: KnowledgeGapPayload[],
): Promise<void> {
  if (gaps.length === 0) return;
  const { data: call, error: callError } = await admin.from("call_logs").select("caller_data_erased_at").eq("id", callLogId).eq("organization_id", organizationId).single();
  if (callError) throw new Error("Knowledge source call could not be loaded.");
  if (call.caller_data_erased_at) return;

  const { data: org } = await admin
    .from("organizations")
    .select("business_hours, niche, retail_banner")
    .eq("id", organizationId)
    .maybeSingle();

  const hasStructuredHours = orgHasStructuredBusinessHours(org?.business_hours);

  for (const gap of gaps) {
    const topic = String(gap.topic ?? "").trim();
    if (!topic) continue;

    const callerContextRaw = String(gap.caller_context ?? "").trim();
    const combined = [topic, callerContextRaw].filter(Boolean).join(" ");
    if (hasStructuredHours && isStructuredHoursTopic(combined)) {
      continue;
    }

    const callerContext = callerContextRaw
      ? redactCallText(callerContextRaw).text
      : null;

    const admission = classifyTrainingAdmission({
      gapSummary: topic,
      callerContext,
      caraQuestion: gap.cara_question,
      source: "call_gap",
      niche: String(org?.niche ?? ""),
    });
    if (!admission.admit) continue;

    const result = await createTrainingItem(admin, {
      organizationId,
      source: "call_gap",
      gapSummary: topic,
      caraQuestion: admission.displayQuestion,
      callerContext,
      callLogId,
      notify: true,
    });
    if (!result.ok) throw new Error(result.message);
  }
}

/**
 * Create a training item from a genuine unanswered Action Inbox question
 * (e.g. "asked if we offer X"). Routine booking/callback handoffs are skipped.
 */
export async function ingestActionInboxTraining(
  admin: SupabaseClient,
  organizationId: string,
  actionTicketId: string,
  summary: string,
): Promise<void> {
  const category = classifyActionCategory(summary);
  const knowledgeEnquiry = isKnowledgeEnquiryHandoff(summary);
  if (!knowledgeEnquiry && category !== "unclear" && category !== "follow_up") {
    return;
  }
  if (isRoutineHandoff(summary)) {
    return;
  }
  if (!hasReusableQuestionEvidence(summary)) {
    return;
  }

  const { data: org } = await admin
    .from("organizations")
    .select("niche")
    .eq("id", organizationId)
    .maybeSingle();

  const { gapSummary, caraQuestion } = actionInboxTrainingQuestion(summary);
  const admission = classifyTrainingAdmission({
    gapSummary,
    callerContext: summary,
    caraQuestion,
    source: "action_inbox",
    niche: String(org?.niche ?? ""),
  });
  if (!admission.admit) return;

  await createTrainingItem(admin, {
    organizationId,
    source: "action_inbox",
    gapSummary,
    caraQuestion: admission.displayQuestion,
    callerContext: summary.trim().slice(0, 500) || null,
    actionTicketId,
    notify: true,
  });
}
