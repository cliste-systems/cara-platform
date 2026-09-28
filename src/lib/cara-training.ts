import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import {
  cleanAgentFaqs,
  type AgentFaq,
} from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  cleanBusinessRules,
  normalizeBusinessRuleKey,
  parseAgentBusinessRules,
} from "@/lib/agent-business-rules";
import {
  formatAgentKnowledgeList,
  parseAgentKnowledgeList,
} from "@/lib/agent-knowledge-format";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import {
  listServicesForOrg,
  syncServiceNamesToBoundary,
  upsertServiceForOrg,
} from "@/lib/service-catalog";
import { verticalPackForNiche } from "@/lib/verticals";
import {
  dedupeCaraSetupChips,
  normalizeCaraSetupChip,
} from "@/lib/cara-setup-chips";
import { assignFolderForAppliedTraining } from "@/lib/cara-knowledge-folder-assignments";
import {
  activateTemporalDraftForTrainingItem,
  shouldSkipPermanentPatchForTemporal,
} from "@/lib/cara-knowledge-temporal-store";
import { parseTemporalDraft } from "@/lib/cara-knowledge-temporal";

import {
  draftTrainingPatchFromOwnerAnswer,
  type CaraTrainingKnowledgeSnapshot,
} from "./cara-training-draft";
import {
  assessTrainingPatchSafetyForOrg,
  formatTrainingSafetyBlockMessage,
  type TrainingSafetyIssue,
} from "./cara-training-safety";
import { ownerInitiatedTeachMetadata } from "./cara-training-owner-initiated";
import { notifyCaraTrainingOwner } from "./cara-training-notify";
import { inferPatchHistoryCategory } from "@/lib/cara-knowledge-history-labels";
import { recordCaraKnowledgeEvent } from "./cara-knowledge-events";
import {
  AGENT_CONFIG_REVALIDATE_PATHS,
  CARA_KNOWLEDGE_REVALIDATE_PATHS,
  DASHBOARD_ROUTES,
} from "@/lib/dashboard-routes";
import {
  normalizeTrainingTopic,
  parseCaraTrainingPatch,
  parseOwnerMessages,
  targetSectionForPatch,
  type CaraTrainingItemRow,
  type CaraTrainingOwnerMessage,
  type CaraTrainingPatch,
  type CaraTrainingSource,
  type CaraTrainingStatus,
} from "./cara-training-types";
import { TRAINING_DEFERRED_MESSAGE } from "@/app/(dashboard)/dashboard/cara-training/cara-training-helpers";
import {
  TRAINING_DISMISS_REASON_LABELS,
  trainingQuestionDedupeKey,
  type TrainingDismissReason,
} from "./cara-training-admission";

export const CARA_TRAINING_OPEN_STATUSES: CaraTrainingStatus[] = [
  "awaiting_answer",
  "draft_ready",
];

export type { TrainingSafetyIssue } from "./cara-training-safety";

async function ensureTrainingPatchSafe(
  supabase: SupabaseClient,
  organizationId: string,
  patch: CaraTrainingPatch,
): Promise<
  | { ok: true }
  | { ok: false; safetyBlocked: true; issues: TrainingSafetyIssue[]; message: string }
> {
  const safety = await assessTrainingPatchSafetyForOrg(
    supabase,
    organizationId,
    patch,
  );
  if (safety.ok) return { ok: true };
  return {
    ok: false,
    safetyBlocked: true,
    issues: safety.issues,
    message: formatTrainingSafetyBlockMessage(safety.issues),
  };
}

export async function checkTrainingDraftSafety(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; issues: TrainingSafetyIssue[] }> {
  const { data: row, error } = await supabase
    .from("cara_training_items")
    .select("status, proposed_patch, temporal_draft")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !row) {
    return {
      ok: false,
      issues: [{ id: "missing-item", message: "Training item not found." }],
    };
  }

  const status = String(row.status ?? "");
  const patch = parseCaraTrainingPatch(row.proposed_patch);
  if (status !== "draft_ready" || !patch) {
    return { ok: true };
  }

  const temporalDraft = parseTemporalDraft(row.temporal_draft);
  if (shouldSkipPermanentPatchForTemporal(temporalDraft)) {
    return { ok: true };
  }

  const safety = await assessTrainingPatchSafetyForOrg(
    supabase,
    organizationId,
    patch,
  );
  if (safety.ok) return { ok: true };
  return { ok: false, issues: safety.issues };
}

const TRAINING_REVALIDATE_PATHS = [
  ...CARA_KNOWLEDGE_REVALIDATE_PATHS,
  ...AGENT_CONFIG_REVALIDATE_PATHS,
] as const;

function revalidateCaraTraining() {
  for (const path of TRAINING_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

function patchEventTitle(patch: CaraTrainingPatch): string {
  if (patch.kind === "faq") return patch.question;
  if (patch.kind === "service_offered" || patch.kind === "service_not_offered") {
    return patch.label;
  }
  return patch.rule;
}

function patchEventCategory(patch: CaraTrainingPatch): string {
  return inferPatchHistoryCategory(patch);
}

async function recordTrainingLearnedEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    itemId: string;
    patch: CaraTrainingPatch;
    source: CaraTrainingSource;
    actorId: string;
    callLogId?: string | null;
  },
): Promise<void> {
  await recordCaraKnowledgeEvent(supabase, {
    organizationId: input.organizationId,
    eventType: "learned",
    category: patchEventCategory(input.patch),
    title: patchEventTitle(input.patch),
    source: input.source,
    actorId: input.actorId,
    callLogId: input.callLogId ?? null,
    trainingItemId: input.itemId,
  });
}

async function recordTrainingUnlearnedEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    itemId: string;
    patch: CaraTrainingPatch;
    source: CaraTrainingSource;
    actorId?: string | null;
    callLogId?: string | null;
  },
): Promise<void> {
  await recordCaraKnowledgeEvent(supabase, {
    organizationId: input.organizationId,
    eventType: "unlearned",
    category: patchEventCategory(input.patch),
    title: patchEventTitle(input.patch),
    source: "unlearn",
    actorId: input.actorId ?? null,
    callLogId: input.callLogId ?? null,
    trainingItemId: input.itemId,
    payload: { training_source: input.source },
  });
}

function rowToItem(row: Record<string, unknown>): CaraTrainingItemRow {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    status: row.status as CaraTrainingItemRow["status"],
    source: row.source as CaraTrainingItemRow["source"],
    call_log_id: row.call_log_id ? String(row.call_log_id) : null,
    action_ticket_id: row.action_ticket_id
      ? String(row.action_ticket_id)
      : null,
    gap_summary: String(row.gap_summary ?? ""),
    caller_context: row.caller_context ? String(row.caller_context) : null,
    cara_question: String(row.cara_question ?? ""),
    owner_messages: parseOwnerMessages(row.owner_messages),
    proposed_patch: parseCaraTrainingPatch(row.proposed_patch),
    applied_patch: parseCaraTrainingPatch(row.applied_patch),
    target_section: (row.target_section as CaraTrainingItemRow["target_section"]) ?? null,
    applied_at: row.applied_at ? String(row.applied_at) : null,
    applied_by: row.applied_by ? String(row.applied_by) : null,
    dismissed_at: row.dismissed_at ? String(row.dismissed_at) : null,
    occurrence_count:
      typeof row.occurrence_count === "number" && row.occurrence_count > 0
        ? row.occurrence_count
        : 1,
    last_seen_at: row.last_seen_at
      ? String(row.last_seen_at)
      : String(row.created_at ?? new Date().toISOString()),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    knowledge_folder_id: row.knowledge_folder_id
      ? String(row.knowledge_folder_id)
      : null,
    knowledge_department_ids: Array.isArray(row.knowledge_department_ids)
      ? row.knowledge_department_ids.map(String)
      : [],
    knowledge_topic_labels: Array.isArray(row.knowledge_topic_labels)
      ? row.knowledge_topic_labels.map(String)
      : [],
  };
}

async function loadKnowledgeSnapshot(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CaraTrainingKnowledgeSnapshot> {
  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, agent_faqs, agent_services_departments, agent_services_not_offered, agent_business_rules, routing_links, fallback_number",
    )
    .eq("id", organizationId)
    .maybeSingle();

  const name = String(org?.name ?? "").trim() || "the business";
  const faqs = cleanAgentFaqs(org?.agent_faqs);
  return {
    businessName: name,
    faqs,
    servicesOffered: parseAgentKnowledgeList(
      String(org?.agent_services_departments ?? ""),
    ),
    servicesNotOffered: parseAgentKnowledgeList(
      String(org?.agent_services_not_offered ?? ""),
    ),
    businessRules: parseAgentBusinessRules(org?.agent_business_rules),
  };
}

type OrgKnowledgeFields = {
  agent_faqs: AgentFaq[];
  agent_services_departments: string;
  agent_services_not_offered: string;
  agent_business_rules: string[];
  agent_services_not_offered_raw?: string | null;
  niche?: string | null;
};

function patchDedupeKey(patch: CaraTrainingPatch): string {
  switch (patch.kind) {
    case "faq":
      return `faq:${patch.question.trim().toLowerCase()}`;
    case "service_offered":
      return `service:${normalizeCaraSetupChip(patch.label).toLowerCase()}`;
    case "service_not_offered":
      return `excluded:${normalizeCaraSetupChip(patch.label).toLowerCase()}`;
    case "business_rule":
      return `rule:${normalizeBusinessRuleKey(patch.rule)}`;
  }
}

function removePatchFromOrgFields(
  current: OrgKnowledgeFields,
  patch: CaraTrainingPatch,
): OrgKnowledgeFields {
  switch (patch.kind) {
    case "faq": {
      const key = patch.question.trim().toLowerCase();
      return {
        ...current,
        agent_faqs: current.agent_faqs.filter(
          (faq) => faq.question.trim().toLowerCase() !== key,
        ),
      };
    }
    case "service_offered": {
      const key = normalizeCaraSetupChip(patch.label).toLowerCase();
      const chips = parseAgentKnowledgeList(current.agent_services_departments).filter(
        (chip) => normalizeCaraSetupChip(chip).toLowerCase() !== key,
      );
      return {
        ...current,
        agent_services_departments: formatAgentKnowledgeList(chips),
      };
    }
    case "service_not_offered": {
      const key = normalizeCaraSetupChip(patch.label).toLowerCase();
      const chips = parseAgentKnowledgeList(
        current.agent_services_not_offered,
      ).filter((chip) => normalizeCaraSetupChip(chip).toLowerCase() !== key);
      return {
        ...current,
        agent_services_not_offered: formatAgentKnowledgeList(chips),
      };
    }
    case "business_rule": {
      const key = normalizeBusinessRuleKey(patch.rule);
      return {
        ...current,
        agent_business_rules: current.agent_business_rules.filter(
          (rule) => normalizeBusinessRuleKey(rule) !== key,
        ),
      };
    }
  }
}

function orgKnowledgeFieldsEqual(
  left: OrgKnowledgeFields,
  right: OrgKnowledgeFields,
): boolean {
  return (
    left.agent_services_departments === right.agent_services_departments &&
    left.agent_services_not_offered === right.agent_services_not_offered &&
    left.agent_business_rules.length === right.agent_business_rules.length &&
    left.agent_business_rules.every(
      (rule, index) => rule === right.agent_business_rules[index],
    ) &&
    left.agent_faqs.length === right.agent_faqs.length &&
    left.agent_faqs.every(
      (faq, index) =>
        faq.question === right.agent_faqs[index]?.question &&
        faq.answer === right.agent_faqs[index]?.answer,
    )
  );
}

function mergePatchIntoOrgFields(
  current: OrgKnowledgeFields,
  patch: CaraTrainingPatch,
): OrgKnowledgeFields {
  switch (patch.kind) {
    case "faq": {
      const nextFaqs = cleanAgentFaqs([
        ...current.agent_faqs,
        { question: patch.question.trim(), answer: patch.answer.trim() },
      ]);
      return { ...current, agent_faqs: nextFaqs };
    }
    case "service_offered": {
      const chips = dedupeCaraSetupChips([
        ...parseAgentKnowledgeList(current.agent_services_departments),
        normalizeCaraSetupChip(patch.label),
      ]);
      return {
        ...current,
        agent_services_departments: formatAgentKnowledgeList(chips),
      };
    }
    case "service_not_offered": {
      const chips = dedupeCaraSetupChips([
        ...parseAgentKnowledgeList(current.agent_services_not_offered),
        normalizeCaraSetupChip(patch.label),
      ]);
      return {
        ...current,
        agent_services_not_offered: formatAgentKnowledgeList(chips),
      };
    }
    case "business_rule": {
      const rules = cleanBusinessRules([
        ...current.agent_business_rules,
        patch.rule.trim(),
      ]);
      return { ...current, agent_business_rules: rules };
    }
  }
}

export type CreateTrainingItemInput = {
  organizationId: string;
  source: CaraTrainingSource;
  gapSummary: string;
  caraQuestion: string;
  callerContext?: string | null;
  callLogId?: string | null;
  actionTicketId?: string | null;
  notify?: boolean;
  knowledgeFolderId?: string | null;
  knowledgeDepartmentIds?: string[];
  knowledgeTopicLabels?: string[];
};

export async function createTrainingItem(
  admin: SupabaseClient,
  input: CreateTrainingItemInput,
): Promise<
  { ok: true; itemId: string } | { ok: false; message: string; skipped?: boolean }
> {
  const gapSummary = input.gapSummary.trim();
  const caraQuestion = input.caraQuestion.trim();
  if (!gapSummary || !caraQuestion) {
    return { ok: false, message: "gap_summary and cara_question are required." };
  }

  if (input.actionTicketId) {
    const { data: existing } = await admin
      .from("cara_training_items")
      .select("id")
      .eq("action_ticket_id", input.actionTicketId)
      .maybeSingle();
    if (existing?.id) {
      return { ok: true, itemId: String(existing.id) };
    }
  }

  const normalizedTopic = trainingQuestionDedupeKey({
    gapSummary,
    caraQuestion,
  });
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentOpen } = await admin
    .from("cara_training_items")
    .select("id, gap_summary, caller_context, occurrence_count")
    .eq("organization_id", input.organizationId)
    .in("status", CARA_TRAINING_OPEN_STATUSES)
    .gte("created_at", weekAgo);

  for (const row of recentOpen ?? []) {
    const rowKey = trainingQuestionDedupeKey({
      gapSummary: String(row.gap_summary ?? ""),
      caraQuestion: String((row as { cara_question?: string }).cara_question ?? ""),
    });
    if (rowKey === normalizedTopic) {
      const now = new Date().toISOString();
      const priorCount =
        typeof row.occurrence_count === "number" && row.occurrence_count > 0
          ? row.occurrence_count
          : 1;
      const callerContext = input.callerContext?.trim() || null;
      const patch: Record<string, unknown> = {
        occurrence_count: priorCount + 1,
        last_seen_at: now,
        updated_at: now,
      };
      if (callerContext) {
        patch.caller_context = callerContext;
      }
      if (input.callLogId?.trim()) {
        patch.call_log_id = input.callLogId.trim();
      }
      const { error: bumpErr } = await admin
        .from("cara_training_items")
        .update(patch)
        .eq("id", row.id);
      if (bumpErr) {
        console.error("[cara-training] bump occurrence", bumpErr);
        return { ok: false, message: "Failed to update training item." };
      }
      revalidateCaraTraining();
      return { ok: true, itemId: String(row.id) };
    }
  }

  const { data: inserted, error } = await admin
    .from("cara_training_items")
    .insert({
      organization_id: input.organizationId,
      status: "awaiting_answer",
      source: input.source,
      gap_summary: gapSummary,
      caller_context: input.callerContext?.trim() || null,
      cara_question: caraQuestion,
      call_log_id: input.callLogId ?? null,
      action_ticket_id: input.actionTicketId ?? null,
      knowledge_folder_id: input.knowledgeFolderId ?? null,
      knowledge_department_ids: input.knowledgeDepartmentIds ?? [],
      knowledge_topic_labels: input.knowledgeTopicLabels ?? [],
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    console.error("[cara-training] insert", error);
    return { ok: false, message: "Failed to create training item." };
  }

  const itemId = String(inserted.id);

  if (input.notify !== false) {
    try {
      await notifyCaraTrainingOwner(admin, input.organizationId, {
        itemId,
        gapSummary,
      });
    } catch (e) {
      console.error("[cara-training] notify failed", e);
    }
  }

  revalidateCaraTraining();
  return { ok: true, itemId };
}

export async function prepareTemporalTrainingForConfirm(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  ownerAnswer: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row, error } = await supabase
    .from("cara_training_items")
    .select("*")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: "Training item not found." };
  }

  const item = rowToItem(row as Record<string, unknown>);
  if (item.status !== "awaiting_answer") {
    return { ok: false, message: "This item is not waiting for an answer." };
  }

  const answer = ownerAnswer.trim();
  if (!answer) {
    return { ok: false, message: "Enter an answer." };
  }

  const temporalDraft = parseTemporalDraft(
    (row as { temporal_draft?: unknown }).temporal_draft,
  );
  if (!temporalDraft) {
    return { ok: false, message: "No temporary update is configured." };
  }

  const proposedPatch: CaraTrainingPatch =
    temporalDraft.subjectType === "opening_hours"
      ? {
          kind: "faq",
          question: "What are today's opening hours?",
          answer: temporalDraft.body.trim() || answer,
        }
      : {
          kind: "faq",
          question: temporalDraft.title.trim() || item.gap_summary,
          answer: temporalDraft.body.trim() || answer,
        };

  const messages: CaraTrainingOwnerMessage[] = [
    ...item.owner_messages,
    { role: "user", content: answer, at: new Date().toISOString() },
  ];

  const { error: updateError } = await supabase
    .from("cara_training_items")
    .update({
      status: "draft_ready",
      owner_messages: messages,
      proposed_patch: proposedPatch,
      target_section: "faq",
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidateCaraTraining();
  return { ok: true };
}

export async function submitOwnerAnswer(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  answerText: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row, error } = await supabase
    .from("cara_training_items")
    .select("*")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: "Training item not found." };
  }

  const item = rowToItem(row as Record<string, unknown>);
  if (item.status !== "awaiting_answer") {
    return { ok: false, message: "This item is not waiting for an answer." };
  }

  const answer = answerText.trim();
  if (!answer) {
    return { ok: false, message: "Enter an answer." };
  }

  const knowledge = await loadKnowledgeSnapshot(supabase, organizationId);
  const draft = await draftTrainingPatchFromOwnerAnswer({
    gapSummary: item.gap_summary,
    callerContext: item.caller_context,
    caraQuestion: item.cara_question,
    ownerAnswer: answer,
    knowledge,
  });

  if (!draft.ok) {
    if ("needsClarification" in draft) {
      return { ok: false, message: draft.needsClarification };
    }
    return { ok: false, message: draft.message };
  }

  const temporalDraft = parseTemporalDraft(
    (row as { temporal_draft?: unknown }).temporal_draft,
  );
  const skipPermanentPatch = shouldSkipPermanentPatchForTemporal(temporalDraft);
  if (!skipPermanentPatch) {
    const safety = await ensureTrainingPatchSafe(
      supabase,
      organizationId,
      draft.patch,
    );
    if (!safety.ok) {
      return safety;
    }
  }

  const now = new Date().toISOString();
  const understoodAnswer =
    draft.patch.kind === "faq" ? draft.patch.answer : answer;
  const { formatTrainingUnderstandingAssistantMessage } = await import(
    "./cara-training-understanding-guards"
  );
  const messages: CaraTrainingOwnerMessage[] = [
    ...item.owner_messages,
    { role: "user", content: answer, at: now },
    {
      role: "assistant",
      content: formatTrainingUnderstandingAssistantMessage(understoodAnswer),
      at: now,
    },
  ];

  const targetSection = targetSectionForPatch(draft.patch);
  const { error: updateError } = await supabase
    .from("cara_training_items")
    .update({
      status: "draft_ready",
      owner_messages: messages,
      proposed_patch: draft.patch,
      target_section: targetSection,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidateCaraTraining();
  return { ok: true };
}

export async function previewOwnerInitiatedTeach(
  supabase: SupabaseClient,
  organizationId: string,
  ownerDescription: string,
  teachingContext?: import("./cara-training-understanding").TeachUnderstandingContext | null,
): Promise<
  | { ok: true; patch: CaraTrainingPatch }
  | { ok: false; safetyBlocked: true; issues: TrainingSafetyIssue[]; patch: CaraTrainingPatch }
  | { ok: false; needsClarification: string }
  | { ok: false; message: string }
> {
  const trimmed = ownerDescription.trim();
  if (!trimmed) {
    return { ok: false, message: "Describe what Cara should know." };
  }

  const { gapSummary, caraQuestion } = ownerInitiatedTeachMetadata({
    ownerDescription: trimmed,
  });
  const knowledge = await loadKnowledgeSnapshot(supabase, organizationId);

  const draft = await draftTrainingPatchFromOwnerAnswer({
    gapSummary,
    callerContext: null,
    caraQuestion,
    ownerAnswer: trimmed,
    knowledge,
    teachingContext,
  });

  if (!draft.ok) {
    if ("needsClarification" in draft) {
      return { ok: false, needsClarification: draft.needsClarification };
    }
    return { ok: false, message: draft.message };
  }

  const safety = await ensureTrainingPatchSafe(
    supabase,
    organizationId,
    draft.patch,
  );
  if (!safety.ok) {
    return {
      ok: false,
      safetyBlocked: true,
      issues: safety.issues,
      patch: draft.patch,
    };
  }

  return { ok: true, patch: draft.patch };
}

export async function confirmTrainingItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  appliedByUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row, error } = await supabase
    .from("cara_training_items")
    .select("*")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: "Training item not found." };
  }

  const item = rowToItem(row as Record<string, unknown>);
  if (item.status !== "draft_ready" || !item.proposed_patch) {
    return { ok: false, message: "No draft is ready to confirm." };
  }

  const temporalDraft = parseTemporalDraft(
    (row as { temporal_draft?: unknown }).temporal_draft,
  );
  const skipPermanentPatch = shouldSkipPermanentPatchForTemporal(temporalDraft);
  const ownerAnswer =
    [...item.owner_messages].reverse().find((message) => message.role === "user")
      ?.content ?? null;

  if (!skipPermanentPatch) {
    const safety = await ensureTrainingPatchSafe(
      supabase,
      organizationId,
      item.proposed_patch,
    );
    if (!safety.ok) {
      return safety;
    }
  }

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "agent_faqs, agent_services_departments, agent_services_not_offered, agent_business_rules",
    )
    .eq("id", organizationId)
    .maybeSingle();

  const now = new Date().toISOString();

  if (!skipPermanentPatch) {
    const current: OrgKnowledgeFields = {
      agent_faqs: cleanAgentFaqs(org?.agent_faqs),
      agent_services_departments: String(org?.agent_services_departments ?? ""),
      agent_services_not_offered: String(org?.agent_services_not_offered ?? ""),
      agent_business_rules: parseAgentBusinessRules(org?.agent_business_rules),
    };

    const merged = mergePatchIntoOrgFields(current, item.proposed_patch);

    const { error: orgError } = await supabase
      .from("organizations")
      .update({
        agent_faqs: merged.agent_faqs,
        agent_services_departments: merged.agent_services_departments,
        agent_services_not_offered: merged.agent_services_not_offered,
        agent_business_rules: merged.agent_business_rules,
        updated_at: now,
      })
      .eq("id", organizationId);

    if (orgError) {
      return { ok: false, message: orgError.message };
    }
  }

  if (temporalDraft) {
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const admin = createAdminClient();
    const activated = await activateTemporalDraftForTrainingItem(
      supabase,
      admin,
      {
        organizationId,
        itemId,
        actorId: appliedByUserId,
        ownerAnswer,
      },
    );
    if (!activated.ok) {
      return activated;
    }
  } else {
    const regen = await regenerateCaraCustomPrompt(supabase, organizationId);
    if (!regen.ok) {
      return { ok: false, message: regen.message };
    }
  }

  const { error: itemError } = await supabase
    .from("cara_training_items")
    .update({
      status: "applied",
      applied_patch: item.proposed_patch,
      applied_at: now,
      applied_by: appliedByUserId,
      updated_at: now,
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (itemError) {
    return { ok: false, message: itemError.message };
  }

  if (!temporalDraft) {
    await recordTrainingLearnedEvent(supabase, {
      organizationId,
      itemId,
      patch: item.proposed_patch,
      source: item.source,
      actorId: appliedByUserId,
      callLogId: item.call_log_id,
    });
  }

  await assignFolderForAppliedTraining(supabase, {
    organizationId,
    itemId,
    patch: item.proposed_patch,
    folderId: (row as { knowledge_folder_id?: string | null }).knowledge_folder_id,
    departmentIds:
      (row as { knowledge_department_ids?: string[] | null }).knowledge_department_ids ??
      [],
    topicLabels:
      (row as { knowledge_topic_labels?: string[] | null }).knowledge_topic_labels ??
      [],
    actorId: appliedByUserId,
  });

  revalidateCaraTraining();
  return { ok: true };
}

export async function dismissTrainingItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  reason?: TrainingDismissReason,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row } = await supabase
    .from("cara_training_items")
    .select("owner_messages")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  const now = new Date().toISOString();
  const ownerMessages = parseOwnerMessages(row?.owner_messages);
  if (reason) {
    ownerMessages.push({
      role: "assistant",
      content: `Dismissed (${reason}): ${TRAINING_DISMISS_REASON_LABELS[reason]}`,
      at: now,
    });
  }

  const { error } = await supabase
    .from("cara_training_items")
    .update({
      status: "dismissed",
      dismissed_at: now,
      updated_at: now,
      owner_messages: ownerMessages,
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .in("status", ["awaiting_answer", "draft_ready"]);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCaraTraining();
  return { ok: true };
}

async function loadOpenTrainingItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
): Promise<
  { ok: true; item: CaraTrainingItemRow } | { ok: false; message: string }
> {
  const { data: row, error } = await supabase
    .from("cara_training_items")
    .select("*")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: "Training item not found." };
  }

  const item = rowToItem(row as Record<string, unknown>);
  if (item.status !== "awaiting_answer") {
    return { ok: false, message: "This item is not waiting for an answer." };
  }

  return { ok: true, item };
}

async function loadCallGapItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
): Promise<
  { ok: true; item: CaraTrainingItemRow } | { ok: false; message: string }
> {
  const loaded = await loadOpenTrainingItem(supabase, organizationId, itemId);
  if (!loaded.ok) return loaded;
  if (loaded.item.source !== "call_gap") {
    return { ok: false, message: "This quick action is only for call gaps." };
  }
  return loaded;
}

async function applyCallGapPatch(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  patch: CaraTrainingPatch,
  appliedByUserId: string,
  extraOrgUpdate?: { agent_services_not_offered_raw?: string | null },
  eventMeta?: { source: CaraTrainingSource; callLogId?: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const safety = await ensureTrainingPatchSafe(supabase, organizationId, patch);
  if (!safety.ok) {
    return { ok: false, message: safety.message };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "agent_faqs, agent_services_departments, agent_services_not_offered, agent_business_rules, agent_services_not_offered_raw, niche",
    )
    .eq("id", organizationId)
    .maybeSingle();

  let current: OrgKnowledgeFields = {
    agent_faqs: cleanAgentFaqs(org?.agent_faqs),
    agent_services_departments: String(org?.agent_services_departments ?? ""),
    agent_services_not_offered: String(org?.agent_services_not_offered ?? ""),
    agent_business_rules: parseAgentBusinessRules(org?.agent_business_rules),
    agent_services_not_offered_raw: String(org?.agent_services_not_offered_raw ?? "").trim() || null,
    niche: (org?.niche as string | null) ?? null,
  };

  if (patch.kind === "service_offered") {
    const label = normalizeCaraSetupChip(patch.label);
    const pack = verticalPackForNiche(String(current.niche ?? ""));
    if (pack.capabilities.usesServiceCatalog) {
      try {
        await upsertServiceForOrg(supabase, organizationId, {
          name: label,
          source: "manual",
          category: null,
          price: 0,
          durationMinutes: 0,
          description: null,
          policyFlags: [],
          aiVoiceNotes: null,
        });
        const catalog = await listServicesForOrg(supabase, organizationId);
        current = {
          ...current,
          agent_services_departments: syncServiceNamesToBoundary(catalog),
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to add service.";
        return { ok: false, message };
      }
    } else {
      current = mergePatchIntoOrgFields(current, patch);
    }
  } else {
    current = mergePatchIntoOrgFields(current, patch);
  }

  const now = new Date().toISOString();
  const orgUpdate: Record<string, unknown> = {
    agent_faqs: current.agent_faqs,
    agent_services_departments: current.agent_services_departments,
    agent_services_not_offered: current.agent_services_not_offered,
    agent_business_rules: current.agent_business_rules,
    updated_at: now,
  };
  if (extraOrgUpdate?.agent_services_not_offered_raw !== undefined) {
    orgUpdate.agent_services_not_offered_raw =
      extraOrgUpdate.agent_services_not_offered_raw;
  }

  const { error: orgError } = await supabase
    .from("organizations")
    .update(orgUpdate)
    .eq("id", organizationId);

  if (orgError) {
    return { ok: false, message: orgError.message };
  }

  const regen = await regenerateCaraCustomPrompt(supabase, organizationId);
  if (!regen.ok) {
    return { ok: false, message: regen.message };
  }

  const { error: itemError } = await supabase
    .from("cara_training_items")
    .update({
      status: "applied",
      proposed_patch: patch,
      applied_patch: patch,
      target_section: targetSectionForPatch(patch),
      applied_at: now,
      applied_by: appliedByUserId,
      updated_at: now,
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (itemError) {
    return { ok: false, message: itemError.message };
  }

  if (eventMeta) {
    await recordTrainingLearnedEvent(supabase, {
      organizationId,
      itemId,
      patch,
      source: eventMeta.source,
      actorId: appliedByUserId,
      callLogId: eventMeta.callLogId ?? null,
    });
  }

  revalidateCaraTraining();
  return { ok: true };
}

export async function resolveCallGapYes(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  appliedByUserId: string,
  details?: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return submitExistenceQuickAnswer(supabase, organizationId, itemId, appliedByUserId, {
    choice: "yes",
    details,
  });
}

export async function resolveCallGapNo(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  appliedByUserId: string,
  details?: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return submitExistenceQuickAnswer(supabase, organizationId, itemId, appliedByUserId, {
    choice: "no",
    details,
  });
}

export async function submitExistenceQuickAnswer(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  userId: string,
  input: {
    choice: "yes" | "no" | "depends";
    details?: string | null;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const loaded = await loadOpenTrainingItem(supabase, organizationId, itemId);
  if (!loaded.ok) return loaded;

  const question =
    loaded.item.cara_question.trim() || loaded.item.gap_summary.trim();
  const { formatExistenceOwnerMessage } = await import(
    "@/app/(dashboard)/dashboard/cara-training/cara-training-helpers"
  );
  const rawOwnerContent = formatExistenceOwnerMessage({
    choice: input.choice,
    details: input.details,
  });
  const ownerAnswerForDraft =
    input.choice === "depends"
      ? input.details?.trim() || "It depends."
      : input.details?.trim() || (input.choice === "yes" ? "Yes." : "No.");

  const knowledge = await loadKnowledgeSnapshot(supabase, organizationId);
  const { draftTrainingUnderstandingFromAnswer, formatTrainingUnderstandingAssistantMessage } =
    await import("./cara-training-understanding");
  const draft = await draftTrainingUnderstandingFromAnswer({
    gapSummary: loaded.item.gap_summary,
    callerContext: loaded.item.caller_context,
    caraQuestion: question,
    ownerAnswer: ownerAnswerForDraft,
    quickChoice: input.choice,
    knowledge,
  });

  if (!draft.ok) {
    if ("needsClarification" in draft) {
      return { ok: false, message: draft.needsClarification };
    }
    return { ok: false, message: draft.message };
  }

  const patch = draft.patch;
  const safety = await ensureTrainingPatchSafe(supabase, organizationId, patch);
  if (!safety.ok) return safety;

  const now = new Date().toISOString();
  const ownerMessages: CaraTrainingOwnerMessage[] = [
    ...loaded.item.owner_messages,
    {
      role: "user",
      content: rawOwnerContent,
      at: now,
    },
    {
      role: "assistant",
      content: formatTrainingUnderstandingAssistantMessage(draft.understoodAnswer),
      at: now,
    },
  ];

  const { error } = await supabase
    .from("cara_training_items")
    .update({
      status: "draft_ready",
      proposed_patch: patch,
      target_section: targetSectionForPatch(patch),
      owner_messages: ownerMessages,
      updated_at: now,
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCaraTraining();
  return { ok: true };
}

export async function deferTrainingItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row } = await supabase
    .from("cara_training_items")
    .select("owner_messages, status")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!row || row.status !== "awaiting_answer") {
    return { ok: false, message: "Training item not found." };
  }

  const ownerMessages = parseOwnerMessages(row.owner_messages);
  if (
    ownerMessages.some(
      (message) =>
        message.role === "assistant" &&
        message.content.startsWith("Deferred —"),
    )
  ) {
    return { ok: true };
  }

  const now = new Date().toISOString();
  ownerMessages.push({
    role: "assistant",
    content: TRAINING_DEFERRED_MESSAGE,
    at: now,
  });

  const { error } = await supabase
    .from("cara_training_items")
    .update({
      owner_messages: ownerMessages,
      last_seen_at: now,
      updated_at: now,
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCaraTraining();
  return { ok: true };
}

export async function clearDeferredTrainingItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row } = await supabase
    .from("cara_training_items")
    .select("owner_messages, status")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!row || row.status !== "awaiting_answer") {
    return { ok: false, message: "Training item not found." };
  }

  const ownerMessages = parseOwnerMessages(row.owner_messages).filter(
    (message) =>
      !(
        message.role === "assistant" &&
        message.content.startsWith("Deferred —")
      ),
  );

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("cara_training_items")
    .update({
      owner_messages: ownerMessages,
      last_seen_at: now,
      updated_at: now,
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCaraTraining();
  return { ok: true };
}

export async function resetTrainingItemToAnswer(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("cara_training_items")
    .update({
      status: "awaiting_answer",
      proposed_patch: null,
      target_section: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .eq("status", "draft_ready");

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCaraTraining();
  return { ok: true };
}

export async function revertTrainingItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  actorId?: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row, error } = await supabase
    .from("cara_training_items")
    .select("*")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: "Training item not found." };
  }

  const item = rowToItem(row as Record<string, unknown>);
  if (item.status !== "applied" || !item.applied_patch) {
    return { ok: false, message: "Only applied items can be reverted." };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "agent_faqs, agent_services_departments, agent_services_not_offered, agent_business_rules",
    )
    .eq("id", organizationId)
    .maybeSingle();

  const patch = item.applied_patch;
  const current: OrgKnowledgeFields = {
    agent_faqs: cleanAgentFaqs(org?.agent_faqs),
    agent_services_departments: String(org?.agent_services_departments ?? ""),
    agent_services_not_offered: String(org?.agent_services_not_offered ?? ""),
    agent_business_rules: parseAgentBusinessRules(org?.agent_business_rules),
  };

  const { data: siblingRows } = await supabase
    .from("cara_training_items")
    .select("applied_patch")
    .eq("organization_id", organizationId)
    .eq("status", "applied")
    .neq("id", itemId);

  const patchKey = patchDedupeKey(patch);
  const hasSiblingWithSamePatch = (siblingRows ?? []).some((row) => {
    const siblingPatch = parseCaraTrainingPatch(
      (row as { applied_patch?: unknown }).applied_patch,
    );
    return siblingPatch !== null && patchDedupeKey(siblingPatch) === patchKey;
  });

  const reverted = hasSiblingWithSamePatch
    ? current
    : removePatchFromOrgFields(current, patch);
  const orgChanged = !orgKnowledgeFieldsEqual(current, reverted);
  const now = new Date().toISOString();

  if (orgChanged) {
    const { error: orgError } = await supabase
      .from("organizations")
      .update({
        agent_faqs: reverted.agent_faqs,
        agent_services_departments: reverted.agent_services_departments,
        agent_services_not_offered: reverted.agent_services_not_offered,
        agent_business_rules: reverted.agent_business_rules,
        updated_at: now,
      })
      .eq("id", organizationId);

    if (orgError) {
      return { ok: false, message: orgError.message };
    }

    const regen = await regenerateCaraCustomPrompt(supabase, organizationId);
    if (!regen.ok) {
      return { ok: false, message: regen.message };
    }
  }

  const { error: itemError } = await supabase
    .from("cara_training_items")
    .update({
      status: "dismissed",
      dismissed_at: now,
      updated_at: now,
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (itemError) {
    return { ok: false, message: itemError.message };
  }

  await recordTrainingUnlearnedEvent(supabase, {
    organizationId,
    itemId,
    patch,
    source: item.source,
    actorId,
    callLogId: item.call_log_id,
  });

  revalidateCaraTraining();
  return { ok: true };
}
