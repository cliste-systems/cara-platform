import { redirect } from "next/navigation";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { hasAccountOwnerAccess } from "@/lib/account-owner-access";
import { customerCallFilters } from "@/lib/dashboard-customer-data";
import { serviceFollowUpFilters } from "@/lib/service-follow-ups";
import { formatCallsPageDateParam, getCallsPageDayBoundsIso, parseCallsPageDateParam } from "@/lib/calls-page-date";
import { SERVICE_CALL_COLUMNS, SERVICE_CALL_OUTCOMES, SERVICE_CALL_PAGE_SIZE, serviceCallSearchFilter, serviceCallsHref, type ServiceCall } from "@/lib/service-calls";
import { loadServiceCallKnowledge } from "@/lib/service-call-knowledge";
import { fetchCallHistoryDetail } from "./actions";
import { ServiceCallsView } from "./service-calls-view";

export type ServiceCallsParams = { call?: string; filter?: string; status?: string; followUp?: string; ticket?: string; date?: string; range?: string; page?: string; q?: string; outcome?: string };

export async function ServiceCallsPage({ params }: { params: ServiceCallsParams }) {
  const session = await requireDashboardSession();
  const { supabase, organizationId } = session;
  const followUps = params.filter === "follow_up" || Boolean(params.followUp || params.ticket);
  const completed = params.status === "resolved";
  const selectedId = params.call || params.followUp || params.ticket;
  const safeId = selectedId && /^[0-9a-f-]{36}$/i.test(selectedId) ? selectedId : null;
  const query = (params.q ?? "").trim().slice(0, 120);
  const outcome = SERVICE_CALL_OUTCOMES.some(o => o.value === params.outcome) ? params.outcome : "";
  const requestedPage = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? "1", 10) || 1));
  const today = formatCallsPageDateParam(new Date());
  const [chosen, knowledge] = await Promise.all([
    safeId ? customerCallFilters(supabase.from("call_logs").select(SERVICE_CALL_COLUMNS)).eq("organization_id", organizationId).eq("id", safeId).maybeSingle() : Promise.resolve(null),
    loadServiceCallKnowledge(supabase, organizationId),
  ]);
  const annotate = (call: ServiceCall): ServiceCall => ({ ...call, knowledge_question: knowledge.questions.get(call.id)?.question ?? null, knowledge_needs_input: knowledge.questions.get(call.id)?.needsInput ?? false });
  const chosenCall = chosen?.data ? annotate(chosen.data as ServiceCall) : null;
  const openKnowledgeIds = [...knowledge.questions].filter(([, value]) => value.needsInput).map(([id]) => id);
  const queueKnowledgeIds = completed ? [...knowledge.questions.keys()] : openKnowledgeIds;
  const date = formatCallsPageDateParam(parseCallsPageDateParam(params.date || (!followUps && chosenCall ? formatCallsPageDateParam(new Date(chosenCall.created_at)) : undefined)));
  const bounds = getCallsPageDayBoundsIso(parseCallsPageDateParam(date));
  let list = supabase.from("call_logs").select(SERVICE_CALL_COLUMNS, { count: "exact" }).eq("organization_id", organizationId);
  list = followUps ? serviceFollowUpFilters(list, completed ? "resolved" : "open", queueKnowledgeIds) : customerCallFilters(list).gte("created_at", bounds.lowerInclusive).lt("created_at", bounds.upperExclusive);
  const searchFilter = serviceCallSearchFilter(query);
  if (searchFilter) list = list.or(searchFilter);
  if (outcome && !followUps) {
    if (outcome === "marked_complete") list = list.not("follow_up_completed_at", "is", null);
    else if (outcome === "knowledge_question") {
      const ids = [...knowledge.questions.keys()];
      list = ids.length ? list.in("id", ids) : list.eq("id", "00000000-0000-0000-0000-000000000000");
    } else list = list.eq("outcome", outcome);
  }
  const [result, followUpCount, allCallsCount, blocked, canManage] = await Promise.all([
    list.order("created_at", { ascending: false }).range((requestedPage - 1) * SERVICE_CALL_PAGE_SIZE, requestedPage * SERVICE_CALL_PAGE_SIZE - 1),
    serviceFollowUpFilters(supabase.from("call_logs").select("id", { count: "exact", head: true }), "open", openKnowledgeIds).eq("organization_id", organizationId),
    customerCallFilters(supabase.from("call_logs").select("id", { count: "exact", head: true })).eq("organization_id", organizationId).gte("created_at", bounds.lowerInclusive).lt("created_at", bounds.upperExclusive),
    supabase.from("blocked_callers").select("caller_e164").eq("organization_id", organizationId),
    hasAccountOwnerAccess(supabase, { userId: session.user.id, accountId: session.accountId, profileRole: session.profile.role }),
  ]);
  const total = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / SERVICE_CALL_PAGE_SIZE));
  if (!result.error && requestedPage > totalPages) {
    redirect(serviceCallsHref(new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")), { page: totalPages > 1 ? String(totalPages) : null }));
  }
  const initialCall = chosenCall;
  const initialDetail = initialCall ? await fetchCallHistoryDetail(initialCall.id).catch(() => null) : null;
  const initialTranscript = initialCall ? { id: initialCall.id, text: initialDetail?.transcriptVerbatim ?? "", error: !initialDetail } : null;
  return <ServiceCallsView
    initialTranscript={initialTranscript}
    calls={((result.data ?? []) as ServiceCall[]).map(annotate)} selectedCall={chosenCall}
    initialSelectedId={safeId} organizationId={organizationId} canManage={canManage}
    blockedNumbers={(blocked.data ?? []).map(row => row.caller_e164 as string)}
    followUps={followUps} completed={completed} date={date} today={today}
    query={query} outcome={outcome ?? ""} page={requestedPage} total={total} totalPages={totalPages}
    allCallsCount={allCallsCount.error ? null : allCallsCount.count ?? 0}
    followUpCount={followUpCount.error ? null : followUpCount.count ?? 0}
    error={Boolean(result.error || chosen?.error || blocked.error || knowledge.error)}
  />;
}
