import { Suspense } from "react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import {
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";

import {
  CaraKnowledgePageView,
  type CaraKnowledgeTab,
} from "./cara-knowledge-page-view";
import { loadCaraKnowledgePageData } from "./load-cara-knowledge-data";

type CaraKnowledgePageProps = {
  searchParams?: Promise<{
    tab?: string;
    item?: string;
    teach?: string;
    q?: string;
  }>;
};

function parseTab(value: string | undefined): CaraKnowledgeTab {
  if (
    value === "needs-input" ||
    value === "temporary" ||
    value === "history"
  ) {
    return value;
  }
  return "knows";
}

export default async function CaraKnowledgePage({
  searchParams,
}: CaraKnowledgePageProps) {
  const sp = searchParams ? await searchParams : {};
  const data = await loadCaraKnowledgePageData();

  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <DashboardAnimatedPageSections>
          <Suspense fallback={null}>
            <CaraKnowledgePageView
              faqs={data.faqs} version={data.version}
              folders={data.folders}
              index={data.index}
              trainingItems={data.trainingItems}
              historyItems={data.historyItems}
              temporalUpdates={data.temporalUpdates}
              activeTemporalCount={data.activeTemporalCount}
              openInputCount={data.openInputCount}
              canManage={data.canManage}
              loadError={data.loadError}
              initialTab={parseTab(sp.tab)}
              initialItemId={sp.item?.trim() || null}
              initialTeachOpen={sp.teach === "1"}
              initialSearchQuery={sp.q?.trim() ?? ""}
              businessTimezone={data.businessTimezone}
              businessHours={data.businessHours}
              openingHoursText={data.openingHoursText}
            />
          </Suspense>
        </DashboardAnimatedPageSections>
      </div>
    </div>
  );
}
