"use client";

import { useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DASHBOARD_EYEBROW_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  dashboardQuickEnterVariants,
  dashboardStaggerVariants,
} from "@/components/dashboard/dashboard-motion";
import {
  knowledgeEntriesForBrowse,
  searchCaraKnowledge,
  sortKnowledgeEntries,
  type CaraKnowledgeEntry,
  type CaraKnowledgeIndex,
} from "@/lib/cara-knowledge-index";
import { cn } from "@/lib/utils";

import { KnowledgeEntryRow } from "./cara-knowledge-browse-view";

export function CaraKnowledgeKnowsPanel({
  index,
  canManage,
  query,
  onOpenEntry,
  onUnlearnEntry,
  onOpenLinkedTemporal,
  onTeachSuggestion,
}: {
  index: CaraKnowledgeIndex;
  canManage: boolean;
  query: string;
  onOpenEntry: (entry: CaraKnowledgeEntry) => void;
  onUnlearnEntry: (entry: CaraKnowledgeEntry) => void;
  onOpenLinkedTemporal?: (updateId: string) => void;
  onTeachSuggestion?: (text: string) => void;
}) {
  const trimmed = query.trim();
  const results = useMemo(
    () => searchCaraKnowledge(index, query),
    [index, query],
  );
  const saved = useMemo(
    () =>
      sortKnowledgeEntries(
        knowledgeEntriesForBrowse(trimmed ? [...results.knows, ...results.related] : index.entries),
      ),
    [results.knows, results.related, trimmed, index.entries],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {!trimmed && saved.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center px-4 py-10 sm:px-5">
            <EmptyState
              icon={Sparkles}
              title="Build Cara’s knowledge"
              description="Add FAQs or teach Cara an answer. Your saved knowledge will appear here."
              className="max-w-md py-8"
            />
          </div>
        ) : saved.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={Search}
              title={`Nothing saved for “${trimmed}”`}
              description="Cara doesn’t have a saved answer for this yet."
              className="py-8"
            />
            {canManage && onTeachSuggestion ? (
              <p className="text-center">
                <button
                  type="button"
                  onClick={() => onTeachSuggestion(trimmed)}
                  className="min-h-11 cursor-pointer rounded-lg border border-[#d9e2dd] bg-white px-4 text-[13px] font-medium text-[#11181d] hover:bg-[#f0f4f1]"
                >
                  Teach Cara about this
                </button>
              </p>
            ) : null}
          </div>
        ) : (
          <KnowsSearchResults
            key={trimmed}
            saved={saved}
            canManage={canManage}
            onOpenEntry={onOpenEntry}
            onUnlearnEntry={onUnlearnEntry}
            onOpenLinkedTemporal={onOpenLinkedTemporal}
          />
        )}
      </div>
    </div>
  );
}

function KnowsSearchResults({
  saved,
  canManage,
  onOpenEntry,
  onUnlearnEntry,
  onOpenLinkedTemporal,
}: {
  saved: CaraKnowledgeEntry[];
  canManage: boolean;
  onOpenEntry: (entry: CaraKnowledgeEntry) => void;
  onUnlearnEntry: (entry: CaraKnowledgeEntry) => void;
  onOpenLinkedTemporal?: (updateId: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(saved.length / 10));
  const currentPage = Math.min(page, pages);
  const SavedList = reduceMotion ? "ul" : motion.ul;
  const SavedItem = reduceMotion ? "li" : motion.li;
  const listMotion = reduceMotion
    ? {}
    : {
        variants: dashboardStaggerVariants,
        initial: "hidden" as const,
        animate: "show" as const,
      };
  const itemMotion = reduceMotion ? {} : { variants: dashboardQuickEnterVariants };

  return (
    <section>
      <p
        className={cn(
          DASHBOARD_EYEBROW_CLASS,
          "border-b border-[#e3e9e5] px-4 py-2.5 sm:px-5",
        )}
      >
        What Cara knows
      </p>
      <SavedList className="divide-y divide-[#e3e9e5]" {...listMotion}>
        {saved.slice((currentPage - 1) * 10, currentPage * 10).map((entry) => (
          <SavedItem key={entry.id} {...itemMotion}>
            <KnowledgeEntryRow
              entry={entry}
              canManage={canManage}
              onOpen={() => onOpenEntry(entry)}
              onUnlearn={() => onUnlearnEntry(entry)}
              onOpenLinkedTemporal={onOpenLinkedTemporal}
            />
          </SavedItem>
        ))}
      </SavedList>
      {pages > 1 && <nav aria-label="Knowledge pages" className="flex items-center justify-between gap-2 border-t border-[#d9e2dd] p-4 text-sm">
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="min-h-11 rounded-lg border border-[#d9e2dd] bg-white px-3 disabled:opacity-40">Previous</button>
        <span>{currentPage} / {pages}</span>
        <button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="min-h-11 rounded-lg border border-[#d9e2dd] bg-white px-3 disabled:opacity-40">Next</button>
      </nav>}
    </section>
  );
}
