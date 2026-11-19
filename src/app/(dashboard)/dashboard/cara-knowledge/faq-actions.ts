"use server";
import { recordCaraKnowledgeEvent } from "@/lib/cara-knowledge-events";
import { revalidatePath } from "next/cache";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import {
  parseAgentFaqs,
  MAX_FAQS,
  type AgentFaq,
} from "../agent-setup/agent-faqs";
import {
  detectCanonicalQuestion,
  canonicalQuestionNotice,
} from "@/lib/answers-boundary";
import { detectPromptInjectionViolation } from "@/lib/prompt-injection-guard";
export async function saveKnowledgeFaq(input: {
  version: string;
  originalQuestion?: string;
  faq?: AgentFaq;
  remove?: boolean;
}) {
  const s = await requireDashboardAdmin();
  const { data: org, error } = await s.supabase
    .from("organizations")
    .select("agent_faqs,updated_at")
    .eq("id", s.organizationId)
    .single();
  if (error || !org)
    return {
      ok: false as const,
      message: "We couldn’t load your answers. Please try again.",
    };
  if (org.updated_at !== input.version)
    return {
      ok: false as const,
      message:
        "Your business information changed in another tab. Reload before saving. Your draft is still here.",
    };
  const faqs = parseAgentFaqs(org.agent_faqs);
  const at = input.originalQuestion
    ? faqs.findIndex((f) => f.question === input.originalQuestion)
    : -1;
  if (input.originalQuestion && at < 0)
    return {
      ok: false as const,
      message: "This answer has changed. Reload before saving.",
    };
  if (input.remove) {
    if (at < 0)
      return { ok: false as const, message: "Choose an answer to remove." };
    faqs.splice(at, 1);
  } else {
    const faq = {
      question: input.faq?.question.trim() ?? "",
      answer: input.faq?.answer.trim() ?? "",
    };
    if (
      !faq.question ||
      !faq.answer ||
      faq.question.length > 1000 ||
      faq.answer.length > 1000
    )
      return {
        ok: false as const,
        message: "Add a question and answer, each under 1,000 characters.",
      };
    const canonical = detectCanonicalQuestion(faq.question);
    if (canonical)
      return {
        ok: false as const,
        message: canonicalQuestionNotice(canonical),
        href: canonical.setupHref,
      };
    const unsafe = detectPromptInjectionViolation(
      `${faq.question}\n${faq.answer}`,
    );
    if (unsafe) return { ok: false as const, message: unsafe.message };
    if (
      faqs.some(
        (f, i) =>
          i !== at && f.question.toLowerCase() === faq.question.toLowerCase(),
      )
    )
      return {
        ok: false as const,
        message:
          "This question already has an answer. Edit that answer instead.",
      };
    if (at < 0 && faqs.length >= MAX_FAQS)
      return {
        ok: false as const,
        message: `You can have up to ${MAX_FAQS} approved answers. Edit an existing answer or remove one first.`,
      };
    if (at < 0) faqs.push(faq);
    else faqs[at] = faq;
  }
  const compiled = await regenerateCaraCustomPrompt(
    s.supabase,
    s.organizationId,
    { dryRun: true, orgPatch: { agent_faqs: faqs } },
  );
  if (!compiled.ok || !compiled.prompt)
    return {
      ok: false as const,
      message:
        "Cara’s answers could not be updated. Your current answers are unchanged.",
    };
  const { data: saved, error: saveError } = await s.supabase
    .from("organizations")
    .update({
      agent_faqs: faqs,
      custom_prompt: compiled.prompt,
      prompt_compile_warnings: compiled.warnings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", s.organizationId)
    .eq("updated_at", input.version)
    .select("updated_at")
    .maybeSingle();
  if (saveError || !saved)
    return {
      ok: false as const,
      message:
        "We couldn’t save this answer. Your draft is still here; refresh if another person has changed it.",
    };
  await recordCaraKnowledgeEvent(s.supabase, {
    organizationId: s.organizationId,
    eventType: "edited",
    title: input.remove ? "Answer removed" : "Answer updated",
    source: "business_setup",
    actorId: s.user.id,
    payload: {
      question: input.faq?.question ?? input.originalQuestion,
      faq_count: faqs.length,
    },
  });
  for (const path of [
    "/dashboard",
    "/dashboard/cara-knowledge",
    "/dashboard/business/answers",
  ])
    revalidatePath(path);
  return { ok: true as const, faqs, version: saved.updated_at };
}
