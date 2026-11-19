"use client";
import { FormFeedback } from "@/components/ui/form-feedback";
import {detectCanonicalQuestion} from "@/lib/answers-boundary";

import { useRouter } from "next/navigation";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DetailActionButton,
  DetailPanelBody,
  DetailPanelFooter,
  DetailPanelShell,
  ListDetailLayout,
} from "@/components/dashboard/list-detail";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { StatusPill } from "@/components/dashboard/status-pill";
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
import {
  trainingItemClassificationDraft,
} from "@/lib/cara-knowledge-classification";
import {
  type KnowledgeFolder,
} from "@/lib/cara-knowledge-folders";
import {
  applyDemoTrainingAnswer,
  applyDemoTrainingBackToEdit,
  applyDemoTrainingConfirm,
  applyDemoTrainingDismiss,
  applyDemoTrainingRevert,
  readDemoTrainingItemOverrides,
  isDemoTrainingItemId,
  writeDemoTrainingItemOverrides,
} from "@/lib/cara-training-demo-items";
import { cn } from "@/lib/utils";

import {
  answerTrainingItem,
  checkTrainingDraftSafetyAction,
  clearDeferredTrainingItemAction,
  confirmTrainingDraft,
  deferTrainingItemAction,
  dismissTrainingDraft,
  editTrainingAnswer,
  revertAppliedTraining,
  startOwnerInitiatedTraining,
  type TrainingSafetyIssue,
} from "./actions";
import { TrainingSafetyPanel } from "./training-safety-panel";
import { CaraTrainingPatchPreview } from "./cara-training-patch-preview";
import { TrainingAnswerField } from "./training-answer-field";
import {
  TrainingCallFactsBar,
  TrainingCallerExcerpt,
} from "./training-call-context";
import {
  TrainingAnswerCelebration,
  TrainingDraftReveal,
  type TrainingAnswerCelebrateChoice,
} from "./training-answer-celebration";
import {
  formatTrainingDateTime,
  isOpenTrainingStatus,
  patchPreviewLines,
  restoreOwnerAnswerForEdit,
  sortOpenTrainingItems,
  toggleTrainingItemDeferred,
  trainingDisplayQuestion,
  trainingItemCallHref,
  trainingItemIsDeferred,
  trainingListSubtitle,
  trainingSourceExcerpt,
  trainingStatusLabel,
  trainingStatusVariant,
  understoodPreviewLines,
  type CaraTrainingListItem,
} from "./cara-training-helpers";

type CaraTrainingViewProps = {
  items: CaraTrainingListItem[];
  canManage: boolean;
  initialSelectedItemId?: string | null;
  className?: string;
  knowledgeFolders?: KnowledgeFolder[];
  embedded?: boolean;
  externalListSearchQuery?: string;
};

type ListTab = "open" | "learned";

function nextSelectionId(
  tabItems: CaraTrainingListItem[],
  currentId: string,
): string | null {
  const remaining = tabItems.filter((item) => item.id !== currentId);
  if (remaining.length === 0) return null;
  const index = tabItems.findIndex((item) => item.id === currentId);
  return remaining[Math.min(Math.max(index, 0), remaining.length - 1)]?.id ?? null;
}


export function CaraTrainingView({
  items,
  canManage,
  initialSelectedItemId = null,
  className,
  knowledgeFolders = [],
  embedded = false,
  externalListSearchQuery,
}: CaraTrainingViewProps) {
  const router = useRouter();
  const [listTab, setListTab] = useState<ListTab>(() => {
    if (embedded) return "open";
    if (
      initialSelectedItemId &&
      items.some(
        (item) =>
          item.id === initialSelectedItemId && item.status === "applied",
      )
    ) {
      return "learned";
    }
    return items.some((item) => isOpenTrainingStatus(item.status))
      ? "open"
      : "learned";
  });
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedItemId,
  );
  const [answerText, setAnswerText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(
    Boolean(initialSelectedItemId),
  );
  const [dismissOpen, setDismissOpen] = useState(false);
  const [teachText, setTeachText] = useState("");
  const [teachOpen, setTeachOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedDraft, setCheckedDraft] = useState<{ key: string; issues: TrainingSafetyIssue[] } | null>(null);
  const [celebrateAnswer, setCelebrateAnswer] = useState<{
    itemId: string;
    choice: TrainingAnswerCelebrateChoice;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [localItemOverrides, setLocalItemOverrides] = useState<
    Record<string, CaraTrainingListItem>
  >({});
  const answerDraftByItemRef = useRef<Record<string, string>>({});
  const previousSelectionRef = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();

  const hydrated = useHydrated();
  const [restoredOverrides, setRestoredOverrides] = useState(false);
  if (hydrated && !restoredOverrides) {
    setRestoredOverrides(true);
    const stored = readDemoTrainingItemOverrides();
    if (Object.keys(stored).length) setLocalItemOverrides(current => ({ ...stored, ...current }));
  }

  const displayItems = useMemo(
    () => items.map((item) => localItemOverrides[item.id] ?? item),
    [items, localItemOverrides],
  );

  const persistDemoOverrides = useCallback(
    (next: Record<string, CaraTrainingListItem>) => {
      writeDemoTrainingItemOverrides(next);
    },
    [],
  );

  const setItemOverride = useCallback(
    (itemId: string, nextItem: CaraTrainingListItem | null) => {
      setLocalItemOverrides((current) => {
        const next = { ...current };
        if (nextItem) {
          next[itemId] = nextItem;
        } else {
          delete next[itemId];
        }
        if (isDemoTrainingItemId(itemId)) {
          persistDemoOverrides(next);
        }
        return next;
      });
    },
    [persistDemoOverrides],
  );

  const [previousItems, setPreviousItems] = useState(items);
  if (items !== previousItems) {
    setPreviousItems(items);
    setLocalItemOverrides((current) => {
      let changed = false;
      const next = { ...current };
      for (const item of items) {
        if (!current[item.id] || isDemoTrainingItemId(item.id)) continue;
        if (trainingItemIsDeferred(item)) {
          delete next[item.id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }

  const openItems = useMemo(
    () =>
      sortOpenTrainingItems(
        displayItems.filter((item) => isOpenTrainingStatus(item.status)),
      ),
    [displayItems],
  );
  const appliedItems = useMemo(
    () => displayItems.filter((item) => item.status === "applied"),
    [displayItems],
  );

  const tabItems = listTab === "open" ? openItems : appliedItems;
  const isOpenQueue = listTab === "open";
  const useExternalSearch = embedded && externalListSearchQuery !== undefined;
  const effectiveSearchQuery = useExternalSearch
    ? externalListSearchQuery
    : searchQuery;

  const filteredItems = useMemo(() => {
    const q = effectiveSearchQuery.trim().toLowerCase();
    if (!q) return tabItems;
    return tabItems.filter((item) => {
      const haystack = [
        trainingDisplayQuestion(item),
        item.gap_summary,
        item.caller_context,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [effectiveSearchQuery, tabItems]);

  const resolvedSelectedId = useMemo(() => {
    if (selectedId && tabItems.some((item) => item.id === selectedId)) {
      return selectedId;
    }
    return filteredItems[0]?.id ?? tabItems[0]?.id ?? null;
  }, [selectedId, filteredItems, tabItems]);

  const selected = useMemo(
    () => displayItems.find((item) => item.id === resolvedSelectedId) ?? null,
    [displayItems, resolvedSelectedId],
  );

  const draftId = selected?.status === "draft_ready" && !isDemoTrainingItemId(selected.id) ? selected.id : null;
  const draftKey = JSON.stringify([draftId, selected?.updated_at, selected?.proposed_patch]);
  const draftSafetyChecking = Boolean(draftId) && checkedDraft?.key !== draftKey;
  const draftSafetyIssues = checkedDraft?.key === draftKey ? checkedDraft.issues : [];

  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    void checkTrainingDraftSafetyAction(draftId).then(result => {
      if (!cancelled) setCheckedDraft({ key: draftKey, issues: result.ok ? [] : result.issues });
    });
    return () => { cancelled = true; };
  }, [draftId, draftKey]);

  useEffect(() => {
    const item =
      displayItems.find((entry) => entry.id === resolvedSelectedId) ?? null;
    const selectionChanged = previousSelectionRef.current !== resolvedSelectedId;
    previousSelectionRef.current = resolvedSelectedId;

    if (selectionChanged) {
      const cached =
        resolvedSelectedId != null
          ? answerDraftByItemRef.current[resolvedSelectedId]
          : undefined;
      setAnswerText(
        cached ??
          (item?.status === "draft_ready" ? restoreOwnerAnswerForEdit(item) : ""),
      );
      setError(null);
      setCelebrateAnswer(null);
      return;
    }

    if (item?.status === "draft_ready") {
      setAnswerText(restoreOwnerAnswerForEdit(item));
    }
  }, [resolvedSelectedId, displayItems]);

  const handleAnswerTextChange = useCallback(
    (value: string) => {
      if (resolvedSelectedId) {
        answerDraftByItemRef.current[resolvedSelectedId] = value;
      }
      setAnswerText(value);
    },
    [resolvedSelectedId],
  );

  const clearAnswerDraft = useCallback((itemId: string) => {
    delete answerDraftByItemRef.current[itemId];
  }, []);

  useEffect(() => {
    if (!celebrateAnswer) return;
    const timer = window.setTimeout(() => {
      setCelebrateAnswer((current) =>
        current?.itemId === celebrateAnswer.itemId ? null : current,
      );
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [celebrateAnswer]);

  const refreshAfterAction = useCallback(() => {
    router.refresh();
  }, [router]);

  const runAction = useCallback(
    (
      fn: () => Promise<{ ok: boolean; message?: string }>,
      onSuccess?: () => void,
    ) => {
      setError(null);
      startTransition(async () => {
        const res = await fn();
        if (!res.ok) {
          setError(res.message ?? "Something went wrong.");
          return;
        }
        onSuccess?.();
        if (resolvedSelectedId) {
          clearAnswerDraft(resolvedSelectedId);
        }
        setAnswerText("");
        refreshAfterAction();
      });
    },
    [clearAnswerDraft, refreshAfterAction, resolvedSelectedId],
  );

  const selectItem = (id: string) => {
    setMobileDetailOpen(true);
    setSelectedId(id);
    setMobileDetailOpen(true);
  };

  const handleAnswer = () => {
    if (!selected || !canManage) return;
    const itemId = selected.id;
    if (isDemoTrainingItemId(itemId)) {
      const result = applyDemoTrainingAnswer(selected, answerText);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      clearAnswerDraft(itemId);
      setAnswerText("");
      setItemOverride(itemId, result.item);
      return;
    }
    runAction(() => answerTrainingItem(selected.id, answerText));
  };

  const handleConfirm = () => {
    if (!selected || !canManage) return;
    const itemId = selected.id;
    if (isDemoTrainingItemId(itemId)) {
      const result = applyDemoTrainingConfirm(selected);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setItemOverride(itemId, result.item);
      setAnswerText("");
      setCelebrateAnswer({
        itemId,
        choice: "saved",
      });
      setListTab("learned");
      setSelectedId(itemId);
      return;
    }
    const classification = trainingItemClassificationDraft(
      selected,
      knowledgeFolders,
    );
    setError(null);
    startTransition(async () => {
      const res = await confirmTrainingDraft(itemId, classification);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setAnswerText("");
      setCelebrateAnswer({
        itemId,
        choice: "saved",
      });
      setListTab("learned");
      setSelectedId(itemId);
      refreshAfterAction();
    });
  };

  const handleDismiss = () => {
    if (!selected || !canManage) return;
    const itemId = selected.id;
    const nextId = nextSelectionId(filteredItems, itemId);
    setDismissOpen(false);
    if (isDemoTrainingItemId(itemId)) {
      const result = applyDemoTrainingDismiss(selected);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setItemOverride(itemId, result.item);
      setAnswerText("");
      setSelectedId(nextId);
      setMobileDetailOpen(Boolean(nextId));
      clearAnswerDraft(itemId);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await dismissTrainingDraft(itemId);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setAnswerText("");
      setSelectedId(nextId);
      setMobileDetailOpen(Boolean(nextId));
      clearAnswerDraft(itemId);
      refreshAfterAction();
    });
  };

  const handleBackToEdit = () => {
    if (!selected || !canManage) return;
    const itemId = selected.id;
    const restoredAnswer = restoreOwnerAnswerForEdit(selected);
    if (isDemoTrainingItemId(itemId)) {
      const result = applyDemoTrainingBackToEdit(selected);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setItemOverride(itemId, result.item);
      setAnswerText(restoredAnswer);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await editTrainingAnswer(selected.id);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setAnswerText(restoredAnswer);
      refreshAfterAction();
    });
  };

  const handleDefer = () => {
    if (!selected || !canManage) return;
    const itemId = selected.id;
    const wasDeferred = trainingItemIsDeferred(selected);
    const nextItem = toggleTrainingItemDeferred(selected);

    if (isDemoTrainingItemId(itemId)) {
      setError(null);
      setItemOverride(itemId, nextItem);
      return;
    }

    setError(null);
    setItemOverride(itemId, nextItem);
    startTransition(async () => {
      const res = wasDeferred
        ? await clearDeferredTrainingItemAction(itemId)
        : await deferTrainingItemAction(itemId);
      if (!res.ok) {
        setItemOverride(itemId, null);
        setError(res.message ?? "Something went wrong.");
        return;
      }
      refreshAfterAction();
    });
  };

  const handleRevert = () => {
    if (!selected || !canManage) return;
    const itemId = selected.id;
    const nextId = nextSelectionId(filteredItems, itemId);
    if (isDemoTrainingItemId(itemId)) {
      const result = applyDemoTrainingRevert(selected);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setItemOverride(itemId, result.item);
      setSelectedId(nextId);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await revertAppliedTraining(itemId);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setSelectedId(nextId);
      refreshAfterAction();
    });
  };

  const handleTeach = () => {
    if (!canManage) return;
    setError(null);
    startTransition(async () => {
      const res = await startOwnerInitiatedTraining(teachText);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setTeachOpen(false);
      setTeachText("");
      setListTab("open");
      setSelectedId(res.itemId);
      setMobileDetailOpen(true);
      refreshAfterAction();
    });
  };

  const fieldClass = cn(DASHBOARD_INPUT_CLASS, "resize-none text-[13px]");

  const listPanel = (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden border-[#e2e8e4] bg-[#f8f9fa] max-xl:border-b xl:border-r",
        mobileDetailOpen && "max-lg:hidden",
      )}
    >
      {!embedded ? (
        <div className="shrink-0 border-b border-[#e2e8e4] bg-white px-4 py-4 sm:px-5">
          <h2 className="text-[15px] font-semibold text-[#11181d]">
            {isOpenQueue ? "Needs input" : "Learned"}
          </h2>
          {isOpenQueue && filteredItems.length > 1 ? (
            <label className="relative mt-3 block">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#94a3b8]"
                aria-hidden
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search questions"
                autoComplete="off"
                aria-label="Search questions"
                className={cn(
                  DASHBOARD_INPUT_CLASS,
                  "h-9 w-full pl-9 text-[13px]",
                )}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2 pb-3 sm:px-3",
          embedded && "pt-3",
          filteredItems.length === 0 && "flex items-center justify-center",
        )}
      >
        {filteredItems.length === 0 ? (
          <EmptyState
            icon={isOpenQueue ? Sparkles : BookOpen}
            title={
              useExternalSearch &&
              effectiveSearchQuery.trim() &&
              tabItems.length > 0
                ? `Nothing needs input for “${effectiveSearchQuery.trim()}”`
                : isOpenQueue
                  ? "All caught up"
                  : "Nothing learned yet"
            }
            description={
              useExternalSearch &&
              effectiveSearchQuery.trim() &&
              tabItems.length > 0
                ? "Try different wording, or check What Cara knows if you already taught this."
                : isOpenQueue
                  ? "When Cara cannot answer a reusable question on a call, it will appear here."
                  : "Confirmed answers will appear here."
            }
            className="w-full py-10"
          />
        ) : (
              <ul
                className="space-y-1.5"
                role="listbox"
                aria-label="Training questions"
              >
                {filteredItems.map((item) => {
                  const row = (
                    <TrainingListRow
                      item={item}
                      selected={item.id === resolvedSelectedId}
                      onSelect={() => selectItem(item.id)}
                    />
                  );
                  if (reduceMotion) {
                    return <li key={item.id}>{row}</li>;
                  }
                  return (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28 }}
                    >
                      {row}
                    </motion.li>
                  );
                })}
              </ul>
        )}
      </div>
    </div>
  );

  const detailPanel = (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-white",
        !mobileDetailOpen && "max-lg:hidden",
      )}
    >
      <TrainingDetailWorkspace
        item={selected}
        canManage={canManage}
        error={error}
        answerText={answerText}
        pending={pending}
        draftSafetyIssues={draftSafetyIssues}
        draftSafetyChecking={draftSafetyChecking}
        knowledgeFolders={knowledgeFolders}
        showBackButton={mobileDetailOpen}
        onBack={() => setMobileDetailOpen(false)}
        onAnswerTextChange={handleAnswerTextChange}
        celebrateAnswer={
          celebrateAnswer?.itemId === selected?.id ? celebrateAnswer?.choice ?? null : null
        }
        onAnswer={handleAnswer}
        onConfirm={handleConfirm}
        onDismissRequest={() => setDismissOpen(true)}
        onDefer={handleDefer}
        onBackToEdit={handleBackToEdit}
        onRevert={handleRevert}
      />
    </div>
  );

  const queuePanel = (
    <ListDetailLayout hideDetail={!selected} mobileDetailOpen={mobileDetailOpen}
      className="min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]"
      list={listPanel}
      detail={detailPanel}
    />
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-hidden", className)}>
      {!embedded ? (
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div
            className="inline-flex w-full max-w-md rounded-lg border border-[#d9e2dd] bg-white p-0.5"
            role="tablist"
            aria-label="Training queue"
          >
            {(
              [
                { id: "open" as const, label: "Needs input", count: openItems.length },
                { id: "learned" as const, label: "Learned", count: appliedItems.length },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={listTab === tab.id}
                onClick={() => {
                  setListTab(tab.id);
                  setSelectedId(null);
                  setMobileDetailOpen(false);
                }}
                className={cn(
                  "min-w-0 flex-1 rounded-md px-4 py-2 text-[13px] font-medium transition-colors",
                  listTab === tab.id
                    ? "bg-[#11181d] text-white shadow-sm"
                    : "text-[#5b6b65] hover:bg-[#f8f9fa] hover:text-[#11181d]",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "ml-1.5 tabular-nums",
                    listTab === tab.id ? "text-white/80" : "text-slate-400",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {canManage ? (
            <Button
              type="button"
              className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "h-9 shrink-0 gap-1.5")}
              onClick={() => setTeachOpen(true)}
            >
              <Plus className="size-4" aria-hidden />
              Teach Cara
            </Button>
          ) : null}
        </div>
      ) : null}

      {embedded ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{queuePanel}</div>
      ) : (
        <section
          className={cn(
            DASHBOARD_CARD_SURFACE,
            "flex min-h-0 flex-1 flex-col overflow-hidden",
          )}
        >
          {queuePanel}
        </section>
      )}

      <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Not a learning question</DialogTitle>
            <DialogDescription>
              Are you sure? This removes the item from your queue. It won&apos;t change call records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className={DASHBOARD_SECONDARY_BUTTON_CLASS}
              disabled={pending}
              onClick={() => setDismissOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={DASHBOARD_PRIMARY_BUTTON_CLASS}
              disabled={pending}
              onClick={handleDismiss}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                "Yes, remove it"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!embedded ? (
        <Dialog open={teachOpen} onOpenChange={setTeachOpen}>
          <DialogContent className="sm:max-w-md" showCloseButton>
            <DialogHeader>
              <DialogTitle>Teach Cara something</DialogTitle>
              <DialogDescription>
                Describe what callers keep asking — Cara will draft an update for you to review.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={teachText}
              onChange={(event) => setTeachText(event.target.value)}
              placeholder="e.g. Callers keep asking how much notice we need for celebration cakes…"
              rows={4}
              className={fieldClass}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className={DASHBOARD_SECONDARY_BUTTON_CLASS}
                disabled={pending}
                onClick={() => setTeachOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={DASHBOARD_PRIMARY_BUTTON_CLASS}
                disabled={pending || !teachText.trim()}
                onClick={handleTeach}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  "Start"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function TrainingAnswerActionsFooter({
  pending,
  reviewDisabled,
  onReview,
  onDismiss,
  onDefer,
  deferred = false,
  error = null,
}: {
  pending: boolean;
  reviewDisabled: boolean;
  onReview: () => void;
  onDismiss: () => void;
  onDefer?: () => void;
  deferred?: boolean;
  error?: string | null;
}) {
  return (
    <div className="shrink-0 border-t border-[#e2e8e4] bg-white px-4 py-3 sm:px-6">
      {error ? (
        <FormFeedback message={error} />
      ) : null}
      <div className="flex w-full flex-col gap-2">
        <Button
          type="button"
          className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "h-10 w-full")}
          disabled={reviewDisabled}
          onClick={onReview}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            "Review answer"
          )}
        </Button>
        {onDefer ? (
          <button
            type="button"
            disabled={pending}
            aria-pressed={deferred}
            onClick={onDefer}
            className={cn(
              "h-10 w-full rounded-lg border px-3 text-[13px] font-medium transition-colors disabled:opacity-40",
              deferred
                ? "border-amber-400 bg-amber-100 text-amber-950 shadow-sm"
                : "border-[#e2e8e4] bg-[#f8f9fa] text-[#5b6b65] hover:border-[#b9c8c1] hover:text-[#11181d]",
            )}
          >
            {deferred ? "Ready to answer" : "I'll check later"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={onDismiss}
          className={cn(
            "h-10 w-full rounded-lg border border-red-200 bg-red-50 px-3 text-[13px] font-medium text-red-900 transition-colors hover:bg-red-100 disabled:opacity-40",
          )}
        >
          Not a learning question
        </button>
      </div>
    </div>
  );
}

function TrainingListRow({
  item,
  selected,
  onSelect,
}: {
  item: CaraTrainingListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const deferred = trainingItemIsDeferred(item);

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border px-3 py-3 text-left transition-colors",
        deferred
          ? selected
            ? "border-amber-400 bg-amber-50 shadow-[inset_3px_0_0_#f59e0b]"
            : "border-amber-200 bg-amber-50/80 hover:border-amber-300"
          : selected
            ? "border-[#353D42] bg-white shadow-[inset_3px_0_0_#353D42]"
            : "border-[#e2e8e4] bg-white hover:border-[#b9c8c1]",
      )}
    >
      <span
        className={cn(
          "block text-[13px] font-semibold leading-snug [overflow-wrap:anywhere]",
          deferred ? "text-amber-950" : "text-[#11181d]",
        )}
      >
        {trainingDisplayQuestion(item)}
      </span>
      <span
        className={cn(
          "mt-1 block text-[12px] leading-snug [overflow-wrap:anywhere]",
          deferred ? "text-amber-800/80" : "text-[#6b7c75]",
        )}
      >
        {trainingListSubtitle(item)}
      </span>
    </button>
  );
}

function TrainingDetailWorkspace({
  item,
  canManage,
  error,
  answerText,
  pending,
  draftSafetyIssues,
  draftSafetyChecking,
  knowledgeFolders,
  showBackButton,
  onBack,
  onAnswerTextChange,
  onAnswer,
  onConfirm,
  onDismissRequest,
  onDefer,
  onBackToEdit,
  onRevert,
  celebrateAnswer,
}: {
  item: CaraTrainingListItem | null;
  canManage: boolean;
  error: string | null;
  answerText: string;
  pending: boolean;
  draftSafetyIssues: TrainingSafetyIssue[];
  draftSafetyChecking: boolean;
  knowledgeFolders: KnowledgeFolder[];
  showBackButton: boolean;
  onBack: () => void;
  onAnswerTextChange: (value: string) => void;
  onAnswer: () => void;
  onConfirm: () => void;
  onDismissRequest: () => void;
  onDefer: () => void;
  onBackToEdit: () => void;
  onRevert: () => void;
  celebrateAnswer: TrainingAnswerCelebrateChoice | null;
}) {
  if (!item) {
    return (
      <DetailPanelShell surface="embedded">
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <EmptyState
            icon={Sparkles}
            title="Select a question"
            description="Choose something from the list to review the caller context and answer it."
            className="w-full py-10"
          />
        </div>
      </DetailPanelShell>
    );
  }

  const previewPatch = item.proposed_patch ?? item.applied_patch;
  const isApplied = item.status === "applied";
  const isDraft = item.status === "draft_ready";
  const isAwaiting = item.status === "awaiting_answer";
  const excerpt = trainingSourceExcerpt(item);
  const question = trainingDisplayQuestion(item);
  const canonical = detectCanonicalQuestion(question);
  const deferred = trainingItemIsDeferred(item);
  const callViewHref = trainingItemCallHref(item.call_log_id);

  return (
    <DetailPanelShell surface="embedded" layout="grid">
      <div className="shrink-0 border-b border-[#e2e8e4] bg-white px-4 py-4 sm:px-6">
        {showBackButton ? (
            <button
              type="button"
              onClick={onBack}
              className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#475569] xl:hidden"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to questions
            </button>
          ) : null}

          {isApplied ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusPill variant={trainingStatusVariant(item.status)}>
                {trainingStatusLabel(item.status)}
              </StatusPill>
            </div>
          ) : null}

          <h2 className="text-[20px] font-semibold leading-snug tracking-tight text-[#11181d] [overflow-wrap:anywhere]">
            {question}
          </h2>

          {isApplied && item.occurrence_count > 1 ? (
            <p className="mt-2 text-[12px] text-[#6b7c75]">
              Asked on {item.occurrence_count} calls · last seen{" "}
              {formatTrainingDateTime(item.last_seen_at || item.created_at)}
            </p>
          ) : null}

          {(isAwaiting || isDraft) && excerpt ? (
            <div className="mt-3">
              <TrainingCallerExcerpt excerpt={excerpt} />
            </div>
          ) : null}
      </div>

      <DetailPanelBody
        className={cn(
          "min-h-0 bg-[#fbfcfb] px-4 sm:px-6",
          isAwaiting && canManage
            ? "flex flex-col overflow-hidden py-3"
            : "space-y-5 overflow-y-auto py-4 sm:py-5",
        )}
      >
        <AnimatePresence>
          {celebrateAnswer ? (
            <TrainingAnswerCelebration choice={celebrateAnswer} />
          ) : null}
        </AnimatePresence>

        {(isAwaiting || isDraft) && (callViewHref || item.call_facts) ? (
          <TrainingCallFactsBar
            callViewHref={callViewHref}
            callFacts={item.call_facts ?? null}
          />
        ) : null}

        {canonical && (isAwaiting || isDraft) ? <a href={canonical.setupHref} className="mb-3 block shrink-0 rounded-xl border border-[#d9e2dd] bg-white p-4 text-sm leading-6">Keep this answer consistent with your saved business details. <span className="font-semibold no-underline">Update {canonical.setupLabel} →</span></a> : null}

        {isApplied && previewPatch ? (
          <CaraTrainingPatchPreview lines={patchPreviewLines(previewPatch)} applied />
        ) : null}

        {isDraft && previewPatch ? (
          <TrainingDraftReveal revealKey={`${item.id}-${item.updated_at}`}>
            <CaraTrainingPatchPreview
              lines={understoodPreviewLines(previewPatch)}
              applied={false}
              heading="What Cara understood"
            />
            <p className="mt-3 text-[13px] leading-relaxed text-[#475569]">
              Cara may phrase this differently on calls, while keeping these facts.
            </p>
          </TrainingDraftReveal>
        ) : null}

        {isDraft && draftSafetyChecking ? (
          <div className="flex items-center gap-2 text-[13px] text-[#475569]">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Checking this update is safe to save…
          </div>
        ) : null}

        {isDraft ? (
          <TrainingSafetyPanel issues={draftSafetyIssues} />
        ) : null}

        {isAwaiting && canManage ? (
          <TrainingAnswerField
            item={item}
            value={answerText}
            onChange={onAnswerTextChange}
          />
        ) : null}

        {error && !(isAwaiting && canManage) ? (
          <FormFeedback message={error} />
        ) : null}

        {!canManage ? (
          <p className="text-[12px] text-[#6b7c75]">
            View only — ask an owner to answer or confirm training items.
          </p>
        ) : null}
      </DetailPanelBody>

      {isAwaiting && canManage ? (
        <TrainingAnswerActionsFooter
          pending={pending}
          reviewDisabled={pending || deferred || !answerText.trim()}
          onReview={onAnswer}
          onDismiss={onDismissRequest}
          onDefer={onDefer}
          deferred={deferred}
          error={error}
        />
      ) : null}

      {isDraft && canManage ? (
        <DetailPanelFooter>
          <div className="flex w-full flex-col gap-2">
            <Button
              type="button"
              className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "h-10 w-full gap-1.5")}
              disabled={
                pending ||
                draftSafetyChecking ||
                draftSafetyIssues.length > 0
              }
              onClick={onConfirm}
            >
              <Check className="size-4" aria-hidden />
              Save to Cara&apos;s knowledge
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DetailActionButton type="button" onClick={onBackToEdit} disabled={pending}>
                Back to edit
              </DetailActionButton>
              <button
                type="button"
                disabled={pending}
                onClick={onDismissRequest}
                className="h-10 rounded-lg border border-red-200 bg-red-50 px-3 text-[13px] font-medium text-red-900 transition-colors hover:bg-red-100 disabled:opacity-40"
              >
                Not a learning question
              </button>
            </div>
          </div>
        </DetailPanelFooter>
      ) : null}

      {isApplied && canManage ? (
        <DetailPanelFooter>
          <p className="mr-auto text-[12px] text-[#6b7c75]">
            Revert removes this from Cara&apos;s setup.
          </p>
          <DetailActionButton type="button" onClick={onRevert} disabled={pending}>
            <RotateCcw className="size-3.5" aria-hidden />
            Revert
          </DetailActionButton>
        </DetailPanelFooter>
      ) : null}
    </DetailPanelShell>
  );
}
