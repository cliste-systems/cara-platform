"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  History,
  Loader2,
  Play,
  RefreshCcw,
  RotateCcw,
  TestTube2,
  XCircle,
} from "lucide-react";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-interactive";
import type { AdminDemoCallLine } from "@/lib/admin-demo-call-lines";
import { formatIrishE164Display } from "@/lib/admin-demo-call-lines";
import {
  formatRetailRegressionReport,
  gradeRetailRegressionScenario,
  type RetailRegressionExecution,
  type RetailRegressionGrade,
  type RetailRegressionScenario,
} from "@/lib/retail-regression";
import {
  runIsolatedTextRehearsalConversation,
  startTextRehearsalSession,
} from "@/lib/text-rehearsal-client";
import { cn } from "@/lib/utils";

type SuiteResponse = {
  storeLabel: string;
  organizationId: string;
  scenarios: RetailRegressionScenario[];
  recentRuns: Array<Record<string, unknown>>;
  error?: string;
};

type RunResult = RetailRegressionExecution &
  RetailRegressionGrade & {
    issueKind: "new_failure" | "recurring" | "regression_returned" | null;
    occurrenceCount: number;
  };

type CategoryFilter = "all" | RetailRegressionScenario["category"];
type StatusFilter = "all" | "passing" | "failing" | "recurring" | "not_run";

const API_PATH = "/api/admin/demo-call/text-rehearsal/regression";

async function apiPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Regression request failed.");
  return data;
}

function humanCategory(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function historyLabel(scenario: RetailRegressionScenario): string | null {
  const history = scenario.history;
  if (!history || history.totalRuns === 0) return null;
  if (history.consecutiveFailures >= 2) {
    return `Failed ${history.consecutiveFailures} runs in a row`;
  }
  if (history.lastStatus === "fail" || history.lastStatus === "error") {
    return "Failed last run";
  }
  if (history.totalFailures > 0) {
    return `Passed last run · ${history.totalFailures} earlier failure${history.totalFailures === 1 ? "" : "s"}`;
  }
  return `Passed ${history.totalRuns} recorded run${history.totalRuns === 1 ? "" : "s"}`;
}

function issueLabel(result: RunResult | undefined): string | null {
  if (!result?.issueKind) return null;
  if (result.issueKind === "new_failure") return "New failure";
  if (result.issueKind === "regression_returned") return "Regression returned";
  return `Recurring issue · occurrence ${result.occurrenceCount}`;
}

export function DemoRetailRegressionPanel({ line }: { line: AdminDemoCallLine }) {
  const [suite, setSuite] = useState<SuiteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, RunResult>>(new Map());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [concurrency, setConcurrency] = useState<1 | 3 | 5>(3);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const [runCompletedAt, setRunCompletedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const stopRequested = useRef(false);

  const loadSuite = useCallback(() =>
    fetch(
        `${API_PATH}?calledNumber=${encodeURIComponent(line.e164)}`,
        { cache: "no-store" },
      ).then(async (res) => {
      const data = (await res.json()) as SuiteResponse;
      if (!res.ok) throw new Error(data.error ?? "Failed to load regression suite.");
      setSuite(data);
    }).catch((error: unknown) => {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load regression suite.",
      );
    }).finally(() => setLoading(false)), [line.e164]);

  useEffect(() => {
    void loadSuite();
  }, [loadSuite]);

  const categories = useMemo(() => {
    const values = new Set(suite?.scenarios.map((scenario) => scenario.category) ?? []);
    return [...values].sort();
  }, [suite]);

  const filteredScenarios = useMemo(() => {
    const scenarios = suite?.scenarios ?? [];
    return scenarios.filter((scenario) => {
      if (category !== "all" && scenario.category !== category) return false;

      const current = results.get(scenario.id);
      if (statusFilter === "passing") {
        return current?.status === "pass" || (!current && scenario.history?.lastStatus === "pass");
      }
      if (statusFilter === "failing") {
        return (
          current?.status === "fail" ||
          current?.status === "error" ||
          (!current &&
            (scenario.history?.lastStatus === "fail" ||
              scenario.history?.lastStatus === "error"))
        );
      }
      if (statusFilter === "recurring") {
        return (
          current?.issueKind === "recurring" ||
          current?.issueKind === "regression_returned" ||
          (!current && (scenario.history?.consecutiveFailures ?? 0) >= 2)
        );
      }
      if (statusFilter === "not_run") {
        return !current && (scenario.history?.totalRuns ?? 0) === 0;
      }
      return true;
    });
  }, [category, results, statusFilter, suite]);

  const currentSummary = useMemo(() => {
    const values = [...results.values()];
    return {
      passed: values.filter((row) => row.status === "pass").length,
      failed: values.filter((row) => row.status === "fail").length,
      errored: values.filter((row) => row.status === "error").length,
      recurring: values.filter(
        (row) =>
          row.issueKind === "recurring" || row.issueKind === "regression_returned",
      ).length,
    };
  }, [results]);

  const executeScenario = async (
    scenario: RetailRegressionScenario,
    activeRunId: string,
  ): Promise<RunResult> => {
    const started = performance.now();
    let execution: RetailRegressionExecution;

    try {
      const session = await startTextRehearsalSession(line.e164);
      const turnResults = await runIsolatedTextRehearsalConversation({
        session,
        callerTurns: scenario.turns.map((turn) => turn.caller),
      });
      execution = {
        durationMs: Math.max(0, Math.round(performance.now() - started)),
        turns: turnResults.map((turn) => ({
          caller: turn.caller,
          assistant: turn.assistant,
          tools: turn.tools,
          transcriptLines: turn.transcriptLines,
          error: turn.error ?? null,
        })),
        error: turnResults.find((turn) => turn.error)?.error ?? null,
      };
    } catch (error) {
      execution = {
        durationMs: Math.max(0, Math.round(performance.now() - started)),
        turns: scenario.turns.map((turn) => ({
          caller: turn.caller,
          assistant: "",
          tools: [],
          transcriptLines: [`Caller: ${turn.caller}`],
          error: null,
        })),
        error: error instanceof Error ? error.message : "Scenario execution failed.",
      };
    }

    const grade = gradeRetailRegressionScenario(scenario, execution);
    let recurrence: {
      issueKind: RunResult["issueKind"];
      occurrenceCount: number;
    } = { issueKind: null, occurrenceCount: 0 };

    try {
      recurrence = await apiPost<{
        issueKind: RunResult["issueKind"];
        occurrenceCount: number;
      }>({
        action: "record_result",
        runId: activeRunId,
        scenarioId: scenario.id,
        grade,
        execution,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save regression result.";
      if (grade.status === "pass") {
        grade.status = "error";
        grade.reasons.push(message);
        grade.failureSignature = grade.reasons.join(" || ").toLowerCase();
      } else {
        grade.reasons.push(message);
      }
    }

    return { ...execution, ...grade, ...recurrence };
  };

  const runScenarios = async (scenarios: RetailRegressionScenario[]) => {
    if (running || scenarios.length === 0) return;

    stopRequested.current = false;
    setRunning(true);
    setResults(new Map());
    setProgress({ done: 0, total: scenarios.length });
    setRunCompletedAt(null);
    const startedAt = new Date().toISOString();
    setRunStartedAt(startedAt);

    let activeRunId: string | null = null;
    const localResults = new Map<string, RunResult>();
    let nextIndex = 0;

    try {
      const start = await apiPost<{ runId: string }>({
        action: "start_run",
        calledNumber: line.e164,
        total: scenarios.length,
      });
      activeRunId = start.runId;
      setRunId(start.runId);

      const worker = async () => {
        while (!stopRequested.current) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= scenarios.length) return;

          const scenario = scenarios[index]!;
          const result = await executeScenario(scenario, start.runId);
          localResults.set(scenario.id, result);
          setResults(new Map(localResults));
          setProgress({ done: localResults.size, total: scenarios.length });
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(concurrency, scenarios.length) },
          () => worker(),
        ),
      );

      const values = [...localResults.values()];
      const passed = values.filter((row) => row.status === "pass").length;
      const failed = values.filter((row) => row.status === "fail").length;
      const errored = values.filter((row) => row.status === "error").length;
      const finalStatus = stopRequested.current ? "cancelled" : "completed";

      await apiPost({
        action: "finish_run",
        runId: start.runId,
        status: finalStatus,
        passed,
        failed,
        errored,
      });

      setRunCompletedAt(new Date().toISOString());
      setLoading(true);
      setLoadError(null);
      await loadSuite();
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Regression run failed.",
      );
      if (activeRunId) {
        const values = [...localResults.values()];
        await apiPost({
          action: "finish_run",
          runId: activeRunId,
          status: "error",
          passed: values.filter((row) => row.status === "pass").length,
          failed: values.filter((row) => row.status === "fail").length,
          errored: values.filter((row) => row.status === "error").length,
        }).catch(() => undefined);
      }
    } finally {
      setRunning(false);
    }
  };

  const previousFailures = useMemo(
    () =>
      (suite?.scenarios ?? []).filter(
        (scenario) =>
          scenario.history?.lastStatus === "fail" ||
          scenario.history?.lastStatus === "error" ||
          (scenario.history?.consecutiveFailures ?? 0) > 0,
      ),
    [suite],
  );

  const copyReport = async () => {
    if (!suite) return;
    const report = formatRetailRegressionReport({
      storeLabel: suite.storeLabel,
      calledNumber: line.e164,
      runId,
      startedAt: runStartedAt ?? new Date().toISOString(),
      completedAt: runCompletedAt,
      scenarios: suite.scenarios,
      results,
    });
    await navigator.clipboard.writeText(report);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <AdminSectionCard title="Retail regression suite">
        <div className="flex items-center gap-2 p-5 text-sm text-gray-600">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading and seeding the 200-call QA bank…
        </div>
      </AdminSectionCard>
    );
  }

  if (loadError && !suite) {
    return (
      <AdminSectionCard title="Retail regression suite">
        <div className="space-y-3 p-5">
          <p className="text-sm text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); setLoadError(null); void loadSuite(); }}
            className={adminSecondaryButtonClass}
          >
            <RefreshCcw className="size-3.5" aria-hidden />
            Retry
          </button>
        </div>
      </AdminSectionCard>
    );
  }

  const scenarios = suite?.scenarios ?? [];

  return (
    <AdminSectionCard
      title="Retail regression suite"
      description={`${suite?.storeLabel ?? line.orgName} · ${formatIrishE164Display(line.e164)} · ${scenarios.length} saved scenarios`}
      className="flex min-h-0 flex-1 flex-col"
      contentClassName="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
        <div className="grid shrink-0 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Passed</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{currentSummary.passed}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Failed</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{currentSummary.failed}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Errors</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{currentSummary.errored}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Recurring</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{currentSummary.recurring}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={running || scenarios.length === 0}
            onClick={() => void runScenarios(scenarios)}
            className={adminPrimaryButtonClass}
          >
            {running ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Play className="size-3.5" aria-hidden />
            )}
            Run all {scenarios.length}
          </button>

          <button
            type="button"
            disabled={running || previousFailures.length === 0}
            onClick={() => void runScenarios(previousFailures)}
            className={adminSecondaryButtonClass}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Run previous failures ({previousFailures.length})
          </button>

          {running ? (
            <button
              type="button"
              onClick={() => {
                stopRequested.current = true;
              }}
              className={adminSecondaryButtonClass}
            >
              Stop after active tests
            </button>
          ) : null}

          <label className="ml-auto flex items-center gap-2 text-xs text-gray-600">
            Parallel
            <select
              value={concurrency}
              disabled={running}
              onChange={(event) =>
                setConcurrency(Number(event.target.value) as 1 | 3 | 5)
              }
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900"
            >
              <option value={1}>1</option>
              <option value={3}>3</option>
              <option value={5}>5</option>
            </select>
          </label>

          <button
            type="button"
            disabled={results.size === 0}
            onClick={() => void copyReport()}
            className={adminSecondaryButtonClass}
          >
            <Clipboard className="size-3.5" aria-hidden />
            {copied ? "Copied" : "Copy full report"}
          </button>
        </div>

        {running || progress.total > 0 ? (
          <div className="shrink-0">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>
                {running ? "Running" : "Last run"} · {progress.done}/{progress.total}
              </span>
              <span>
                {progress.total > 0
                  ? `${Math.round((progress.done / progress.total) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-gray-900 transition-[width]"
                style={{
                  width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {loadError ? (
          <p className="shrink-0 text-sm text-red-700">{loadError}</p>
        ) : null}

        <div className="flex shrink-0 flex-wrap gap-2">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as CategoryFilter)}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {humanCategory(item)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="all">All status</option>
            <option value="passing">Passing</option>
            <option value="failing">Failing</option>
            <option value="recurring">Recurring</option>
            <option value="not_run">Never run</option>
          </select>
          <span className="self-center text-xs text-gray-500">
            Showing {filteredScenarios.length} of {scenarios.length}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200">
          {filteredScenarios.map((scenario) => {
            const result = results.get(scenario.id);
            const history = historyLabel(scenario);
            const currentIssue = issueLabel(result);
            const status = result?.status ?? scenario.history?.lastStatus ?? null;

            return (
              <details
                key={scenario.id}
                className="group border-b border-gray-200 last:border-b-0"
              >
                <summary className="flex cursor-pointer list-none items-start gap-3 p-3 hover:bg-gray-50">
                  <div className="mt-0.5 shrink-0">
                    {status === "pass" ? (
                      <CheckCircle2 className="size-4 text-emerald-700" aria-hidden />
                    ) : status === "fail" ? (
                      <XCircle className="size-4 text-red-700" aria-hidden />
                    ) : status === "error" ? (
                      <AlertTriangle className="size-4 text-amber-700" aria-hidden />
                    ) : (
                      <TestTube2 className="size-4 text-gray-400" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{scenario.title}</p>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                        {humanCategory(scenario.category)}
                      </span>
                      {currentIssue ? (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                            result?.issueKind === "new_failure"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800",
                          )}
                        >
                          {currentIssue}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-gray-600">
                      Caller: {scenario.turns[0]?.caller}
                    </p>
                    {history ? (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
                        <History className="size-3" aria-hidden />
                        {history}
                      </p>
                    ) : null}
                  </div>
                  {result ? (
                    <span className="shrink-0 text-xs text-gray-500">
                      {(result.durationMs / 1000).toFixed(1)}s
                    </span>
                  ) : null}
                </summary>

                <div className="space-y-3 border-t border-gray-100 bg-gray-50 p-4 text-xs">
                  <div>
                    <p className="font-medium text-gray-900">Expected</p>
                    <p className="mt-1 text-gray-600">{scenario.expectations.summary}</p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900">Conversation</p>
                    <div className="mt-1 space-y-2 font-mono">
                      {scenario.turns.map((turn, index) => {
                        const actual = result?.turns[index];
                        return (
                          <div key={`${scenario.id}-turn-${index}`}>
                            <p className="text-blue-900">Caller: {turn.caller}</p>
                            {actual ? (
                              <>
                                <p className="whitespace-pre-wrap text-gray-900">
                                  Cara: {actual.assistant || "(no reply)"}
                                </p>
                                {actual.tools.map((tool, toolIndex) => (
                                  <p
                                    key={`${scenario.id}-tool-${index}-${toolIndex}`}
                                    className="whitespace-pre-wrap text-violet-800"
                                  >
                                    [Tool] {tool.name} {JSON.stringify(tool.args)}
                                  </p>
                                ))}
                              </>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {result?.reasons.length ? (
                    <div>
                      <p className="font-medium text-red-800">Why it failed</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-red-700">
                        {result.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {scenario.history && scenario.history.totalRuns > 0 ? (
                    <p className="text-gray-500">
                      Historical memory: {scenario.history.totalRuns} runs ·{" "}
                      {scenario.history.totalFailures} failures · last five{" "}
                      {scenario.history.recentStatuses.join(" → ")}
                    </p>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </AdminSectionCard>
  );
}
