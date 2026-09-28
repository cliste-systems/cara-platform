"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";

import type { AdminCaraTrainingSectionCheck } from "@/lib/admin-cara-training-readiness";
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

function CompletenessRail({ checks }: { checks: AdminCaraTrainingSectionCheck[] }) {
  return (
    <nav
      aria-label="Training completeness"
      className="sticky top-4 rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] p-5 shadow-[0_1px_0_rgba(17,24,29,0.05),0_14px_34px_-28px_rgba(17,24,29,0.32)]"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Completeness
      </p>
      <ul className="mt-3 space-y-2">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2 text-sm">
            {check.complete ? (
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-emerald-600"
                aria-hidden
              />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" aria-hidden />
            )}
            <div>
              <p
                className={cn(
                  "font-medium",
                  check.complete ? "text-slate-800" : "text-slate-600",
                )}
              >
                {check.label}
              </p>
              {!check.complete ? (
                <p className="text-muted-foreground text-xs">{check.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function CaraTrainingShell({ initial }: Props) {
  const router = useRouter();
  const [data, setData] = useState(initial);
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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-6">
        <CaraTrainingFeedLegend />
        <IdentityVoiceSection data={data} onChange={patch} onSaved={refreshPrompt} />
        <StoreFactsSection data={data} onChange={patch} onSaved={refreshPrompt} />
        <DepartmentsSection data={data} onChange={patch} onSaved={refreshPrompt} />
        <PeopleEscalationSection data={data} onChange={patch} onSaved={refreshPrompt} />
        <PhoneSystemSection data={data} onChange={patch} onSaved={refreshPrompt} />
        <BoundariesSection data={data} onChange={patch} onSaved={refreshPrompt} />
        <WeeklyOffersSection data={data} onChange={patch} onSaved={refreshPrompt} />
        <FaqsSection data={data} onChange={patch} onSaved={refreshPrompt} />
        <FallbackCaptureSection data={data} onChange={patch} onSaved={refreshPrompt} />
        <KnowledgeGapsSection gaps={data.trainingGaps} organizationId={data.organizationId} />
        <FilesLinkSection organizationId={data.organizationId} />
        <ReviewPublishSection data={data} onChange={patch} onSaved={refreshPrompt} />
      </div>

      <aside className="hidden xl:block">
        <CompletenessRail checks={data.sectionChecks} />
      </aside>
    </div>
  );
}
