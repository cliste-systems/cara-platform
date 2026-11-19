"use client";
import { FaqEditor } from "./faq-editor";
import { useDashboardVertical } from "../dashboard-vertical-context";
import { FormFeedback } from "@/components/ui/form-feedback";
import type { AgentFaq } from "../agent-setup/agent-faqs";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  BookOpen,
  Loader2,
  MessageCircleQuestionMark,
  Plus,
  Search,
} from "lucide-react";

import { CaraTrainingView } from "@/app/(dashboard)/dashboard/cara-training/cara-training-view";
import type { CaraTrainingListItem } from "@/app/(dashboard)/dashboard/cara-training/cara-training-helpers";
import {
  previewOwnerInitiatedTeach,
  startOwnerInitiatedTraining,
  type TrainingSafetyIssue,
} from "@/app/(dashboard)/dashboard/cara-training/actions";
import { TrainingSafetyPanel } from "@/app/(dashboard)/dashboard/cara-training/training-safety-panel";
import { CaraTrainingPatchPreview } from "@/app/(dashboard)/dashboard/cara-training/cara-training-patch-preview";
import {
  TrainingAnswerCelebration,
  TrainingDraftReveal,
} from "@/app/(dashboard)/dashboard/cara-training/training-answer-celebration";
import {
  endTemporalKnowledgeUpdate,
  unlearnKnowledgeEntry,
} from "@/app/(dashboard)/dashboard/cara-knowledge/actions";
import { CaraKnowledgeKnowsPanel } from "@/app/(dashboard)/dashboard/cara-knowledge/cara-knowledge-knows-panel";
import { CaraKnowledgeTemporaryPanel } from "@/app/(dashboard)/dashboard/cara-knowledge/cara-knowledge-temporary-panel";
import {
  KnowledgeTemporalOverridePreview,
  KnowledgeTemporalStatusLine,
} from "@/components/cara-knowledge/knowledge-temporal-chrome";
import {
  DEFAULT_TEACH_TEMPORAL_DURATION,
  TeachTemporalDurationFields,
  teachTemporalDurationIsValid,
  type TeachTemporalDurationState,
} from "@/components/cara-knowledge/teach-temporal-duration-fields";
import { buildTemporalDraftFromTeach } from "@/lib/cara-knowledge-temporal-subjects";
import {
  buildTemporalWindow,
  formatTemporalWindowSummary,
} from "@/lib/cara-knowledge-temporal";
import type { CaraTrainingPatch } from "@/lib/cara-training-types";
import { CaraKnowledgeHistoryPanel } from "@/app/(dashboard)/dashboard/cara-knowledge/cara-knowledge-history-panel";
import type { CaraKnowledgeHistoryItem } from "@/app/(dashboard)/dashboard/cara-knowledge/load-cara-knowledge-history";
import type { CaraKnowledgeFolderPageData } from "@/lib/load-cara-knowledge-folders";
import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_EYEBROW_CLASS,
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { EntryClassification } from "@/lib/cara-knowledge-classification";
import {
  suggestKnowledgeAssignment,
} from "@/lib/cara-knowledge-classification";
import type { TemporalUpdateRecord } from "@/lib/cara-knowledge-temporal";
import {
  type CaraKnowledgeEntry,
  type CaraKnowledgeIndex,
} from "@/lib/cara-knowledge-index";
import { entryHasQuestionAndAnswer } from "@/lib/cara-knowledge-folders";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

export type CaraKnowledgeTab = "knows" | "needs-input" | "temporary" | "history";

type TeachStep = "content" | "duration" | "clarify" | "preview" | "success";

const TEACH_STEPS: { id: Exclude<TeachStep, "success" | "clarify">; label: string }[] = [
  { id: "content", label: "What to teach" },
  { id: "duration", label: "How long" },
  { id: "preview", label: "Review" },
];

function teachStepDescription(step: TeachStep): string {
  switch (step) {
    case "content":
      return "Tell Cara what she should know. Plain English is fine.";
    case "duration":
      return "Choose how long this should apply on calls.";
    case "clarify":
      return "Answer Cara's follow-up so she saves the right fact.";
    case "preview":
      return "Check what Cara understood before you save it.";
    case "success":
      return "Cara will use this on future calls.";
  }
}

function teachStepIndex(step: TeachStep): number {
  if (step === "success") return TEACH_STEPS.length;
  if (step === "clarify") return 2;
  return TEACH_STEPS.findIndex((item) => item.id === step);
}

function teachStepLabel(step: TeachStep): string {
  if (step === "clarify") return "Clarify";
  return TEACH_STEPS[Math.min(teachStepIndex(step), TEACH_STEPS.length - 1)]
    ?.label;
}

function buildTeachUnderstandingText(
  baseText: string,
  clarificationAnswer: string,
): string {
  const base = baseText.trim();
  const extra = clarificationAnswer.trim();
  if (!extra) return base;
  return `${base}\n\nAdditional detail: ${extra}`;
}

function teachReviewLines(patch: CaraTrainingPatch): string[] {
  switch (patch.kind) {
    case "faq":
      return [`Question: ${patch.question}`, `Answer: ${patch.answer}`];
    case "service_not_offered":
      return [`I'll tell callers you don't offer: ${patch.label}`];
    case "service_offered":
      return [`I'll tell callers you offer: ${patch.label}`];
    case "business_rule":
      return [`Business rule: ${patch.rule}`];
  }
}

const TABS: { id: CaraKnowledgeTab; label: string }[] = [
  { id: "knows", label: "What Cara knows" },
  { id: "needs-input", label: "Needs your input" },
  { id: "temporary", label: "For now" },
  { id: "history", label: "History" },
];

function parseTab(value: string | null): CaraKnowledgeTab {
  if (value === "needs-input" || value === "temporary" || value === "history") {
    return value;
  }
  return "knows";
}

function formatKnowledgeDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CaraKnowledgePageView({
  faqs=[],version="",
  index,
  folders: folderData,
  trainingItems,
  historyItems,
  temporalUpdates,
  activeTemporalCount,
  openInputCount,
  canManage,
  loadError,
  initialTab = "knows",
  initialItemId = null,
  initialTeachOpen = false,
  initialSearchQuery = "",
  businessTimezone = "Europe/Dublin",
  businessHours = null,
  openingHoursText = null,
}: {
  faqs?:AgentFaq[];version?:string;
  index: CaraKnowledgeIndex;
  folders: CaraKnowledgeFolderPageData;
  trainingItems: CaraTrainingListItem[];
  historyItems: CaraKnowledgeHistoryItem[];
  temporalUpdates: TemporalUpdateRecord[];
  activeTemporalCount: number;
  openInputCount: number;
  canManage: boolean;
  loadError: string | null;
  initialTab?: CaraKnowledgeTab;
  initialItemId?: string | null;
  initialTeachOpen?: boolean;
  initialSearchQuery?: string;
  businessTimezone?: string;
  businessHours?: unknown;
  openingHoursText?: string | null;
}) {
  const {copy}=useDashboardVertical();
  const general=copy.vertical.id!=="retail";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<CaraKnowledgeTab>(initialTab);
  const [query, setQuery] = useState(initialSearchQuery);
  const [teachOpen, setTeachOpen] = useState(initialTeachOpen);
  const [teachText, setTeachText] = useState(initialSearchQuery);
  const [teachError, setTeachError] = useState<string | null>(null);
  const [teachStep, setTeachStep] = useState<TeachStep>("content");
  const [teachDuration, setTeachDuration] = useState<TeachTemporalDurationState>(
    DEFAULT_TEACH_TEMPORAL_DURATION,
  );
  const [teachPreviewPatch, setTeachPreviewPatch] =
    useState<CaraTrainingPatch | null>(null);
  const [teachSafetyIssues, setTeachSafetyIssues] = useState<
    TrainingSafetyIssue[]
  >([]);
  const [teachSuccessMeta, setTeachSuccessMeta] = useState<{
    taughtText: string;
    isTemporal: boolean;
  } | null>(null);
  const [teachClarificationQuestion, setTeachClarificationQuestion] =
    useState<string | null>(null);
  const [teachClarificationAnswer, setTeachClarificationAnswer] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<CaraKnowledgeEntry | null>(
    null,
  );
  const [unlearnEntry, setUnlearnEntry] = useState<CaraKnowledgeEntry | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [teachPending, startTeachTransition] = useTransition();
  const [previewPending, startPreviewTransition] = useTransition();
  const [unlearnPending, startUnlearnTransition] = useTransition();
  const [historyMounted, setHistoryMounted] = useState(initialTab === "history");
  const [trainingMounted, setTrainingMounted] = useState(initialTab === "needs-input");
  const [temporaryMounted, setTemporaryMounted] = useState(initialTab === "temporary");

  const teachUnderstandingText = useMemo(
    () => buildTeachUnderstandingText(teachText, teachClarificationAnswer),
    [teachClarificationAnswer, teachText],
  );

  const teachClassification = useMemo(() => {
    const suggestion = suggestKnowledgeAssignment(
      teachUnderstandingText,
      folderData.folders,
    );
    return {
      folderId: suggestion.folderId,
      departmentIds: suggestion.departmentIds,
      topicLabels: suggestion.topicLabels,
    };
  }, [folderData.folders, teachUnderstandingText]);

  const selectedTrainingItemId =
    searchParams.get("item")?.trim() || initialItemId;

  const syncUrl = useCallback(
    (next: {
      tab?: CaraKnowledgeTab;
      item?: string | null;
      teach?: boolean;
      q?: string;
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextTab = next.tab ?? tab;
      params.set("tab", nextTab);
      if (next.item) params.set("item", next.item);
      else params.delete("item");
      if (next.teach) params.set("teach", "1");
      else params.delete("teach");
      const nextQuery = next.q ?? query;
      if (nextQuery.trim() && nextTab === "knows") {
        params.set("q", nextQuery.trim());
      } else {
        params.delete("q");
      }
      params.delete("group");
      params.delete("topic");
      params.delete("folder");
      router.replace(`${DASHBOARD_ROUTES.caraKnowledge}?${params.toString()}`, {
        scroll: false,
      });
    },
    [query, router, searchParams, tab],
  );

  const navigationQuery = searchParams.toString();
  const [lastNavigationQuery, setLastNavigationQuery] = useState<typeof navigationQuery | undefined>(undefined);
  if (lastNavigationQuery !== navigationQuery) {
    setLastNavigationQuery(navigationQuery);
    setTab(parseTab(searchParams.get("tab")));
    const item = searchParams.get("item");
    if (item && parseTab(searchParams.get("tab")) === "needs-input") {
      // CaraTrainingView handles selection via initialSelectedItemId prop from server
    }
    setTeachOpen(searchParams.get("teach") === "1");
    const q = searchParams.get("q");
    const currentTab = parseTab(searchParams.get("tab"));
    if (q && currentTab === "knows") {
      setQuery(q);
      setTeachText(q);
    }
  }

  if (tab === "history" && !historyMounted) setHistoryMounted(true);
  if (tab === "needs-input" && !trainingMounted) setTrainingMounted(true);
  if (tab === "temporary" && !temporaryMounted) setTemporaryMounted(true);

  const selectTab = (nextTab: CaraKnowledgeTab) => {
    setTab(nextTab);
    syncUrl({
      tab: nextTab,
      item: nextTab === "needs-input" ? selectedTrainingItemId : null,
      q: nextTab === "knows" ? query : "",
    });
  };

  const openTeach = (seedText?: string) => {
    const nextText = seedText?.trim() || query.trim();
    setTeachText(nextText);
    setTeachOpen(true);
    setTeachError(null);
    setTeachStep("content");
    setTeachPreviewPatch(null);
    setTeachSafetyIssues([]);
    setTeachSuccessMeta(null);
    setTeachClarificationQuestion(null);
    setTeachClarificationAnswer("");
    setTeachDuration(DEFAULT_TEACH_TEMPORAL_DURATION);
    syncUrl({ teach: true });
  };

  const closeTeach = () => {
    setTeachOpen(false);
    setTeachStep("content");
    setTeachPreviewPatch(null);
    setTeachSafetyIssues([]);
    setTeachSuccessMeta(null);
    setTeachClarificationQuestion(null);
    setTeachClarificationAnswer("");
    setTeachDuration(DEFAULT_TEACH_TEMPORAL_DURATION);
    syncUrl({ teach: false });
  };

  const finishTeach = () => {
    if (!teachSuccessMeta) {
      closeTeach();
      return;
    }
    closeTeach();
    if (teachSuccessMeta.isTemporal) {
      setTemporaryMounted(true);
      setTab("temporary");
      syncUrl({ tab: "temporary", item: null, teach: false, q: "" });
    } else {
      setQuery(teachSuccessMeta.taughtText);
      setTab("knows");
      syncUrl({
        tab: "knows",
        item: null,
        teach: false,
        q: teachSuccessMeta.taughtText,
      });
    }
  };

  const temporalDraftForTeach = useMemo(() => {
    if (teachDuration.durationMode === "standard" || !teachUnderstandingText) {
      return null;
    }
    return buildTemporalDraftFromTeach({
      text: teachUnderstandingText,
      classification: teachClassification,
      durationMode: teachDuration.durationMode,
      startChoice: teachDuration.startChoice,
      startAt: teachDuration.startAt || null,
      endChoice: teachDuration.endChoice,
      endAt: teachDuration.endAt || null,
      reviewReminderChoice: teachDuration.reviewReminderChoice,
      businessHours,
      openingHoursText,
      timezone: businessTimezone,
    });
  }, [
    businessHours,
    businessTimezone,
    openingHoursText,
    teachClassification,
    teachDuration,
    teachUnderstandingText,
  ]);

  const teachDurationSummary = useMemo(() => {
    if (teachDuration.durationMode === "standard") {
      return "Until you change it — ordinary knowledge.";
    }
    const window = buildTemporalWindow(
      {
        durationMode: teachDuration.durationMode,
        startChoice: teachDuration.startChoice,
        startAt: teachDuration.startAt || null,
        endChoice: teachDuration.endChoice,
        endAt: teachDuration.endAt || null,
        reviewReminderChoice: teachDuration.reviewReminderChoice,
      },
      businessTimezone,
    );
    return formatTemporalWindowSummary(window, businessTimezone);
  }, [businessTimezone, teachDuration]);

  const loadTeachPreview = () => {
    setTeachError(null);
    if (
      teachDuration.durationMode !== "standard" &&
      !teachTemporalDurationIsValid(teachDuration, businessTimezone)
    ) {
      setTeachError("Check the start and end times before continuing.");
      return;
    }
    const text = teachUnderstandingText.trim();
    if (!text) {
      setTeachError("Describe what Cara should know.");
      return;
    }
    startPreviewTransition(async () => {
      const result = await previewOwnerInitiatedTeach(text, {
        durationMode: teachDuration.durationMode,
        durationSummary: teachDurationSummary,
      });
      if (!result.ok) {
        if ("needsClarification" in result) {
          setTeachClarificationQuestion(result.needsClarification);
          setTeachStep("clarify");
          return;
        }
        if ("safetyBlocked" in result) {
          setTeachClarificationQuestion(null);
          setTeachPreviewPatch(result.patch);
          setTeachSafetyIssues(result.issues);
          setTeachStep("preview");
          return;
        }
        setTeachError(result.message);
        return;
      }
      setTeachClarificationQuestion(null);
      setTeachPreviewPatch(result.patch);
      setTeachSafetyIssues([]);
      setTeachStep("preview");
    });
  };

  const submitTeachClarification = () => {
    if (!teachClarificationAnswer.trim()) {
      setTeachError("Add a bit more detail so Cara knows what you mean.");
      return;
    }
    loadTeachPreview();
  };

  const submitTeach = () => {
    if (!teachPreviewPatch) return;
    setTeachError(null);
    if (
      teachDuration.durationMode !== "standard" &&
      !teachTemporalDurationIsValid(teachDuration, businessTimezone)
    ) {
      setTeachError("Check the start and end times before continuing.");
      return;
    }
    const taughtText = teachUnderstandingText.trim();
    startTeachTransition(async () => {
      const result = await startOwnerInitiatedTraining(
        taughtText,
        teachClassification,
        temporalDraftForTeach,
      );
      if (!result.ok) {
        setTeachError(result.message);
        return;
      }
      setTeachSuccessMeta({
        taughtText,
        isTemporal: Boolean(temporalDraftForTeach),
      });
      setTeachStep("success");
      setTeachError(null);
      router.refresh();
    });
  };

  const confirmUnlearn = () => {
    if (!unlearnEntry) return;
    setActionError(null);
    startUnlearnTransition(async () => {
      const result = unlearnEntry.temporal
        ? await endTemporalKnowledgeUpdate(unlearnEntry.temporal.updateId)
        : await unlearnKnowledgeEntry(unlearnEntry.id);
      if (!result.ok) {
        setActionError(result.message);
        return;
      }
      setUnlearnEntry(null);
      setSelectedEntry(null);
      router.refresh();
    });
  };

  const openLinkedTemporalEntry = useCallback(
    (updateId: string) => {
      const linked = index.entries.find(
        (entry) => entry.temporal?.updateId === updateId,
      );
      if (linked) setSelectedEntry(linked);
    },
    [index.entries],
  );

  const handleKnowledgeSearchChange = (value: string) => {
    setQuery(value);
    if (tab !== "knows") {
      setTab("knows");
      syncUrl({ q: value, tab: "knows" });
      return;
    }
    syncUrl({ q: value, tab: "knows" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <ClistePageHeader
        tone="knowledge"
        icon={BookOpen}
        title={general ? "Cara’s knowledge" : "Cara's Knowledge"}
        description="Everything Cara knows about your business."
        className="shrink-0"
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">{general&&<FaqEditor initialFaqs={faqs} initialVersion={version}/>}<Button
              type="button"
              onClick={() => openTeach()}
              className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "gap-1.5")}
            >
              <Plus className="size-4" aria-hidden />
              Teach Cara
            </Button></div>
          ) : null
        }
      />

      <FormFeedback message={loadError?"We couldn’t load Cara’s knowledge. Please refresh and try again.":null}/>


      <section
        className={cn(
          DASHBOARD_CARD_SURFACE,
          "flex min-h-0 flex-col overflow-hidden",
        )}
      >
        <div className="flex shrink-0 flex-col gap-3 border-b border-[#dfe7e2] px-4 py-3 sm:px-5">
          <div
            className="grid grid-cols-2 gap-1 sm:flex w-full rounded-lg border border-[#d9e2dd] bg-[#f6faf7] p-0.5"
            role="tablist"
            aria-label="Cara knowledge sections"
          >
            {TABS.map((item) => {
              const active = tab === item.id;
              const badge =
                item.id === "needs-input" && openInputCount > 0
                  ? openInputCount
                  : item.id === "temporary" && activeTemporalCount > 0
                    ? activeTemporalCount
                    : null;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTab(item.id)}
                  className={cn(
                    "inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-md px-2 py-2 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11181d] focus-visible:ring-offset-2 sm:px-3 sm:text-[13px]",
                    active
                      ? "bg-[#11181d] text-white shadow-sm"
                      : "text-[#5b6b65] hover:bg-white hover:text-[#11181d]",
                  )}
                >
                  <span>{general?({knows:"Knowledge", "needs-input":"Needs answers",temporary:"Temporary updates",history:"History"}[item.id]):item.label}</span>
                  {badge ? (
                    <span
                      className={cn(
                        "ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                        general && item.id === "needs-input"
                          ? active ? "bg-[#a8b4e0]/15 text-[#a8b4e0]" : "bg-[#a8b4e0]/15 text-[#56638c]"
                          : active ? "bg-white/15 text-white" : "bg-[#11181d]/8 text-[#11181d]",
                      )}
                    >
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {tab === "knows" ? (
            <div
              role="tabpanel"
              aria-label="What Cara knows"
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="shrink-0 border-b border-[#dfe7e2] px-4 py-3 sm:px-5">
                <div className="relative w-full">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={query}
                    onChange={(event) =>
                      handleKnowledgeSearchChange(event.target.value)
                    }
                    placeholder="Search what Cara knows…"
                    aria-label="Search what Cara knows"
                    className={cn(
                      DASHBOARD_INPUT_CLASS,
                      "h-10 w-full bg-white py-1 pl-9 text-[13px] placeholder:text-slate-400",
                    )}
                  />
                </div>
              </div>
              <CaraKnowledgeKnowsPanel
                index={index}
                canManage={canManage}
                query={query}
                onOpenEntry={setSelectedEntry}
                onUnlearnEntry={setUnlearnEntry}
                onOpenLinkedTemporal={(updateId) => {
                  setTemporaryMounted(true);
                  setTab("temporary");
                  syncUrl({ tab: "temporary", q: "" });
                  openLinkedTemporalEntry(updateId);
                }}
                onTeachSuggestion={(text) => openTeach(text)}
              />
            </div>
          ) : tab === "needs-input" && trainingMounted ? (
            <div
              role="tabpanel"
              aria-label="Needs your input"
              className="flex min-h-0 flex-1 flex-col"
            >
              <CaraTrainingView
                embedded
                className="min-h-0 flex-1"
                items={trainingItems}
                canManage={canManage}
                knowledgeFolders={folderData.folders}
                initialSelectedItemId={selectedTrainingItemId}
              />
            </div>
          ) : tab === "temporary" && temporaryMounted ? (
            <div
              role="tabpanel"
              aria-label="For now"
              className="flex min-h-0 flex-1 flex-col"
            >
              <CaraKnowledgeTemporaryPanel
                updates={temporalUpdates}
                timezone={businessTimezone}
                canManage={canManage}
                onOpenEntry={setSelectedEntry}
                onEndUpdate={setUnlearnEntry}
              />
            </div>
          ) : tab === "history" && historyMounted ? (
            <div
              role="tabpanel"
              aria-label="History"
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
            >
              <CaraKnowledgeHistoryPanel items={historyItems} />
            </div>
          ) : null}
        </div>
        </section>

      <Dialog
        open={teachOpen}
        onOpenChange={(open) => {
          if (open) {
            openTeach();
            return;
          }
          if (teachStep === "success") {
            finishTeach();
            return;
          }
          closeTeach();
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-hidden border-[#cfd9d3] bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <div className="border-b border-[#dfe7e2] bg-white px-6 pb-5 pt-6">
            <DialogHeader className="text-left">
              <DialogTitle className="text-[20px] tracking-tight text-[#0b1220]">
                {teachStep === "success" ? "Cara's got it" : "Teach Cara"}
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-relaxed text-[#5b6b65]">
                {teachStepDescription(teachStep)}
              </DialogDescription>
            </DialogHeader>

            {teachStep !== "success" ? (
              <div className="mt-4 space-y-2">
                <div className="flex gap-1.5" aria-hidden>
                  {TEACH_STEPS.map((step, index) => {
                    const activeIndex = teachStepIndex(teachStep);
                    return (
                      <span
                        key={step.id}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors",
                          index <= activeIndex ? "bg-[#11181d]" : "bg-[#d9e2dd]",
                        )}
                      />
                    );
                  })}
                </div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6b7c75]">
                  Step {Math.min(teachStepIndex(teachStep) + 1, TEACH_STEPS.length)} of{" "}
                  {TEACH_STEPS.length} · {teachStepLabel(teachStep)}
                </p>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            {teachStep === "content" ? (
              <div className="rounded-xl border border-[#dfe7e2] bg-[#f8fafb] p-4">
                <label
                  htmlFor="teach-cara-content"
                  className={cn(DASHBOARD_EYEBROW_CLASS, "mb-2 block")}
                >
                  What should Cara know?
                </label>
                <Textarea
                  id="teach-cara-content"
                  value={teachText}
                  onChange={(event) => setTeachText(event.target.value)}
                  placeholder="Example: We're closing at 5pm today."
                  className={cn(
                    DASHBOARD_INPUT_CLASS,
                    "min-h-[140px] border-[#dfe7e2] bg-white text-[14px]",
                  )}
                />
              </div>
            ) : null}

            {teachStep === "duration" ? (
              <div className="rounded-xl border border-[#dfe7e2] bg-[#f8fafb] p-4">
                <TeachTemporalDurationFields
                  idPrefix="teach-knowledge-duration"
                  timezone={businessTimezone}
                  value={teachDuration}
                  onChange={setTeachDuration}
                />
              </div>
            ) : null}

            {teachStep === "clarify" ? (
              previewPending ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-[#dfe7e2] bg-[#f8fafb] py-8 text-center">
                  <Loader2 className="size-5 animate-spin text-[#11181d]" aria-hidden />
                  <p className="text-[13px] text-[#475569]">
                    Cara is checking your answer…
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900">
                        <MessageCircleQuestionMark className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className={cn(DASHBOARD_EYEBROW_CLASS, "text-amber-900")}>
                          Cara needs to check
                        </p>
                        <p className="mt-2 text-[14px] leading-relaxed text-[#0b1220]">
                          {teachClarificationQuestion}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#dfe7e2] bg-[#f8fafb] p-4">
                    <label
                      htmlFor="teach-cara-clarify"
                      className={cn(DASHBOARD_EYEBROW_CLASS, "mb-2 block")}
                    >
                      Your answer
                    </label>
                    <Textarea
                      id="teach-cara-clarify"
                      value={teachClarificationAnswer}
                      onChange={(event) => {
                        setTeachClarificationAnswer(event.target.value);
                        setTeachError(null);
                      }}
                      placeholder="Add the missing detail Cara asked for."
                      className={cn(
                        DASHBOARD_INPUT_CLASS,
                        "min-h-[100px] border-[#dfe7e2] bg-white text-[14px]",
                      )}
                    />
                  </div>
                  <div className="rounded-xl border border-[#dfe7e2] bg-white px-4 py-3">
                    <p className="text-[12px] font-medium text-[#35443f]">
                      What you told Cara
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#475569]">
                      {teachText.trim()}
                    </p>
                  </div>
                </div>
              )
            ) : null}

            {teachStep === "preview" ? (
              previewPending && !teachPreviewPatch ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-[#dfe7e2] bg-[#f8fafb] py-8 text-center">
                  <Loader2 className="size-5 animate-spin text-[#11181d]" aria-hidden />
                  <p className="text-[13px] text-[#475569]">
                    Cara is working out what you mean…
                  </p>
                </div>
              ) : teachPreviewPatch ? (
                <div className="space-y-4">
                  <TrainingDraftReveal
                    revealKey={`${teachUnderstandingText}-${teachPreviewPatch.kind}`}
                  >
                    <CaraTrainingPatchPreview
                      lines={teachReviewLines(teachPreviewPatch)}
                      applied={false}
                      heading="What Cara understood"
                    />
                  </TrainingDraftReveal>
                  <div className="rounded-xl border border-[#dfe7e2] bg-[#f8fafb] px-4 py-3">
                    <p className="text-[12px] font-medium text-[#35443f]">Applies</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-[#475569]">
                      {teachDurationSummary}
                    </p>
                  </div>
                  {temporalDraftForTeach?.overridePreview ? (
                    <div className="space-y-2 rounded-xl border border-[#dfe7e2] bg-[#f8fafb] p-4">
                      <p className="text-[12px] font-medium text-[#35443f]">
                        Temporarily replaces
                      </p>
                      <KnowledgeTemporalOverridePreview
                        preview={temporalDraftForTeach.overridePreview}
                      />
                    </div>
                  ) : null}
                  <TrainingSafetyPanel issues={teachSafetyIssues} />
                </div>
              ) : null
            ) : null}

            {teachStep === "success" && teachPreviewPatch ? (
              <div className="space-y-4">
                <TrainingAnswerCelebration choice="saved" />
                <CaraTrainingPatchPreview
                  lines={teachReviewLines(teachPreviewPatch)}
                  applied
                  heading="Saved to Cara's knowledge"
                />
                <div className="rounded-xl border border-[#dfe7e2] bg-[#f8fafb] px-4 py-3">
                  <p className="text-[12px] font-medium text-[#35443f]">Applies</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#475569]">
                    {teachDurationSummary}
                  </p>
                </div>
              </div>
            ) : null}

            {teachError ? (
              <FormFeedback message={teachError} />
            ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 mt-0 shrink-0 flex-row justify-between rounded-none border-t border-[#dfe7e2] bg-white px-6 pb-6 pt-4 sm:justify-between">
            {teachStep === "success" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={finishTeach}
                  className={DASHBOARD_SECONDARY_BUTTON_CLASS}
                >
                  Done
                </Button>
                <Button
                  type="button"
                  onClick={finishTeach}
                  className={DASHBOARD_PRIMARY_BUTTON_CLASS}
                >
                  {teachSuccessMeta?.isTemporal
                    ? "View in For now"
                    : "View in What Cara knows"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={
                    teachStep === "content"
                      ? closeTeach
                      : () => {
                          setTeachError(null);
                          if (teachStep === "preview") {
                            setTeachPreviewPatch(null);
                            setTeachStep(
                              teachClarificationQuestion ? "clarify" : "duration",
                            );
                            return;
                          }
                          if (teachStep === "clarify") {
                            setTeachStep("duration");
                            return;
                          }
                          setTeachStep("content");
                        }
                  }
                  className={DASHBOARD_SECONDARY_BUTTON_CLASS}
                >
                  {teachStep === "content" ? "Cancel" : "Back"}
                </Button>
                <Button
                  type="button"
                  disabled={
                    teachPending ||
                    previewPending ||
                    !teachText.trim() ||
                    (teachStep === "clarify" &&
                      !teachClarificationAnswer.trim()) ||
                    (teachStep === "duration" &&
                      teachDuration.durationMode !== "standard" &&
                      !teachTemporalDurationIsValid(
                        teachDuration,
                        businessTimezone,
                      )) ||
                    (teachStep === "preview" &&
                      (!teachPreviewPatch || teachSafetyIssues.length > 0))
                  }
                  onClick={() => {
                    if (teachStep === "content") {
                      setTeachStep("duration");
                      return;
                    }
                    if (teachStep === "duration") {
                      loadTeachPreview();
                      return;
                    }
                    if (teachStep === "clarify") {
                      submitTeachClarification();
                      return;
                    }
                    submitTeach();
                  }}
                  className={DASHBOARD_PRIMARY_BUTTON_CLASS}
                >
                  {teachPending || previewPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : teachStep === "preview" ? (
                    "Confirm & teach Cara"
                  ) : (
                    "Continue"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedEntry !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEntry(null);
        }}
      >
        {selectedEntry ? (
          <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedEntry.title}</DialogTitle>
              <DialogDescription className="sr-only">
                Knowledge detail
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedEntry.temporal ? (
                <KnowledgeTemporalStatusLine entry={selectedEntry} />
              ) : null}
              {entryHasQuestionAndAnswer(selectedEntry) ? (
                <div className="space-y-4">
                  <div>
                    <p className={DASHBOARD_EYEBROW_CLASS}>Question</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#0b1220]">
                      {selectedEntry.title}
                    </p>
                  </div>
                  <div>
                    <p className={DASHBOARD_EYEBROW_CLASS}>Answer</p>
                    <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-[#35443f]">
                      {selectedEntry.body}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#35443f]">
                  {selectedEntry.body || selectedEntry.title}
                </p>
              )}
              {selectedEntry.temporal?.overridePreview ? (
                <div className="space-y-2">
                  <p className="text-[12px] font-medium text-[#35443f]">
                    Temporarily replaces
                  </p>
                  <KnowledgeTemporalOverridePreview
                    preview={selectedEntry.temporal.overridePreview}
                  />
                </div>
              ) : null}
              {selectedEntry.activeTemporalSummary ? (
                <p className="text-[12px] text-[#6b7c75]">
                  Temporary update active · {selectedEntry.activeTemporalSummary}
                </p>
              ) : null}
              {formatKnowledgeDate(selectedEntry.updatedAt) ? (
                <p className="text-[12px] text-[#6b7c75]">
                  Updated {formatKnowledgeDate(selectedEntry.updatedAt)}
                </p>
              ) : null}
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  className={DASHBOARD_SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    setUnlearnEntry(selectedEntry);
                    setSelectedEntry(null);
                  }}
                >
                  {selectedEntry.temporal ? "End now" : "Unlearn"}
                </Button>
              ) : (
                <span />
              )}
              {selectedEntry.editHref ? (
                <Button
                  render={<Link href={selectedEntry.editHref} />}
                  className={DASHBOARD_PRIMARY_BUTTON_CLASS}
                >
                  {selectedEntry.editLabel ?? "Edit"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  className={DASHBOARD_SECONDARY_BUTTON_CLASS}
                >
                  Close
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={unlearnEntry !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUnlearnEntry(null);
            setActionError(null);
          }
        }}
      >
        {unlearnEntry ? (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {unlearnEntry.temporal ? "End this temporary update?" : "Unlearn this?"}
              </DialogTitle>
              <DialogDescription>
                {unlearnEntry.temporal
                  ? `Cara will stop using the temporary update for “${unlearnEntry.title}”. The usual information will apply again.`
                  : `Cara will stop using “${unlearnEntry.title}” on calls. This cannot be undone from here.`}
              </DialogDescription>
            </DialogHeader>
            {actionError ? (
              <FormFeedback message={actionError} />
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setUnlearnEntry(null)}
                className={DASHBOARD_SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={unlearnPending}
                onClick={confirmUnlearn}
                className="h-10 rounded-lg bg-[#11181d] px-4 text-[13px] font-medium text-white hover:bg-[#243136]"
              >
                {unlearnPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : unlearnEntry.temporal ? (
                  "End now"
                ) : (
                  "Unlearn"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
