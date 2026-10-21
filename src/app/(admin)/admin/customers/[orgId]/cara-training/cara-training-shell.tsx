"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";

import { CaraTrainingFeedLegend } from "@/components/admin/cara-training-field";
import { cn } from "@/lib/utils";

import type { CaraTrainingData } from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";
import { reloadCaraTrainingPrompt } from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { BoundariesSection } from "./sections/boundaries-section";
import { WeeklyOffersSection } from "./sections/weekly-offers-section";
import { FallbackCaptureSection } from "./sections/fallback-capture-section";
import { FaqsSection } from "./sections/faqs-section";
import { FilesLinkSection } from "./sections/files-link-section";
import { IdentityVoiceSection } from "./sections/identity-voice-section";
import { KnowledgeGapsSection } from "./sections/knowledge-gaps-section";
import { PeopleEscalationSection } from "./sections/people-escalation-section";
import { PhoneSystemSection } from "./sections/phone-system-section";
import { ReviewPublishSection } from "./sections/review-publish-section";
import { StoreFactsSection } from "./sections/store-facts-section";
import { DepartmentsSection } from "./sections/departments-section";

type Props = {
  initial: CaraTrainingData;
};

export function CaraTrainingShell({ initial }: Props) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [selected, setSelected] = useState("identity");
  const [, startRefresh] = useTransition();

  const refreshPrompt = useCallback(async () => {
    const result = await reloadCaraTrainingPrompt(data.organizationId);
    if (!result.ok) return;
    setData((d) => ({
      ...d,
      customPrompt: result.customPrompt,
      promptCompileWarnings: result.promptCompileWarnings,
      sectionChecks: result.sectionChecks,
    }));
    startRefresh(() => router.refresh());
  }, [data.organizationId, router]);

  const patch = useCallback(
    (partial: Partial<CaraTrainingData>) => {
      setData((d) => ({ ...d, ...partial }));
    },
    [],
  );

  const sections = [
    { id: "identity", label: "Identity & voice", content: <IdentityVoiceSection data={data} onChange={patch} onSaved={refreshPrompt} /> },
    { id: "storeFacts", label: "Business facts", content: <StoreFactsSection data={data} onChange={patch} onSaved={refreshPrompt} /> },
    { id: "departments", label: "Departments", content: <DepartmentsSection data={data} onChange={patch} onSaved={refreshPrompt} /> },
    { id: "people", label: "People & escalation", content: <PeopleEscalationSection data={data} onChange={patch} onSaved={refreshPrompt} /> },
    { id: "phoneSystem", label: "Phone & transfers", content: <PhoneSystemSection data={data} onChange={patch} onSaved={refreshPrompt} /> },
    { id: "boundaries", label: "Boundaries", content: <BoundariesSection data={data} onChange={patch} onSaved={refreshPrompt} /> },
    { id: "offers", label: "Weekly offers", content: <WeeklyOffersSection data={data} onChange={patch} onSaved={refreshPrompt} /> },
    { id: "faqs", label: "FAQs", content: <FaqsSection data={data} onChange={patch} onSaved={refreshPrompt} /> },
    { id: "fallback", label: "Fallback capture", content: <FallbackCaptureSection data={data} onChange={patch} onSaved={refreshPrompt} /> },
    { id: "gaps", label: "Knowledge gaps", content: <KnowledgeGapsSection gaps={data.trainingGaps} organizationId={data.organizationId} /> },
    { id: "files", label: "Files & links", content: <FilesLinkSection organizationId={data.organizationId} /> },
    { id: "review", label: "Review & publish", content: <ReviewPublishSection data={data} onChange={patch} onSaved={refreshPrompt} /> },
  ];
  const complete = data.sectionChecks.filter(check => check.complete).length;
  return <div className="flex min-h-0 flex-1 gap-5 overflow-hidden">
    <nav aria-label="Training sections" className="w-56 shrink-0 overflow-y-auto border-r border-[#e0e3e6] pr-4">
      <p className="mb-3 text-xs text-[#697078]">{complete} of {data.sectionChecks.length} checks complete</p>
      <div className="space-y-1">{sections.map(section => { const check = data.sectionChecks.find(item => item.id === section.id); return <button key={section.id} type="button" aria-current={selected === section.id ? "page" : undefined} onClick={() => setSelected(section.id)} className={cn("flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-[13px]", selected === section.id ? "bg-[#f0f2f4] font-medium text-[#11181d]" : "text-[#697078] hover:bg-[#f7f8f9]")}><span>{section.label}</span>{check ? check.complete ? <CheckCircle2 className="size-3.5 shrink-0 text-[#697078]" aria-label="Complete" /> : <Circle className="size-3.5 shrink-0 text-amber-600" aria-label={check.detail} /> : null}</button>; })}</div>
    </nav>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3"><CaraTrainingFeedLegend />{sections.map(section => <section key={section.id} aria-label={section.label} hidden={selected !== section.id} className="min-h-0 flex-1 overflow-y-auto">{section.content}</section>)}</div>
  </div>;
}
