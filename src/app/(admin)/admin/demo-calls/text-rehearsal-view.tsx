"use client";

import { useCallback, useState } from "react";
import { FlaskConical, Loader2, MessageSquareText, Rows3, Sparkles } from "lucide-react";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminSegmentedTabButtonClass,
} from "@/components/admin/admin-interactive";
import type { AdminDemoCallLine } from "@/lib/admin-demo-call-lines";
import { cn } from "@/lib/utils";

import { useDemoCallEngineeringLog } from "./demo-call-engineering-log";
import { DemoRetailDiscoveryPanel } from "./demo-retail-discovery-panel";
import { DemoRetailRegressionPanel } from "./demo-retail-regression-panel";
import { DemoTextRehearsalBatchPanel } from "./demo-text-rehearsal-batch-panel";
import {
  DemoCallLinePicker,
  resolveSelectedDemoLine,
} from "./demo-call-line-picker";
import { DemoTextRehearsalPanel } from "./demo-text-rehearsal-panel";

type TextRehearsalSession = {
  livekitUrl: string;
  roomName: string;
  token: string;
  calledNumber: string;
  callerNumber: string;
  orgName: string;
};

type SessionPhase = "idle" | "connecting" | "in_session" | "ended" | "error";
type RehearsalMode = "single" | "batch" | "regression" | "discovery";

type TextRehearsalViewProps = {
  lines: AdminDemoCallLine[];
};

function friendlyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Failed to start text rehearsal.";
}

export function TextRehearsalView({ lines }: TextRehearsalViewProps) {
  const [mode, setMode] = useState<RehearsalMode>("single");
  const [selectedE164, setSelectedE164] = useState<string | null>(
    lines[0]?.e164 ?? null,
  );
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<TextRehearsalSession | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);

  const selectedLine = resolveSelectedDemoLine(lines, selectedE164);

  const engineeringLog = useDemoCallEngineeringLog({
    roomName: session?.roomName ?? null,
    sessionStartedAt,
    enabled: phase === "connecting" || phase === "in_session" || phase === "ended",
    pollSessionLog: false,
  });

  const startSession = async () => {
    if (!selectedLine || mode !== "single") return;
    const startedAt = Date.now();
    setError(null);
    engineeringLog.reset();
    setSessionStartedAt(startedAt);
    setPhase("connecting");

    try {
      const res = await fetch("/api/admin/demo-call/text-rehearsal/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calledNumber: selectedLine.e164 }),
      });
      const data = (await res.json()) as TextRehearsalSession & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start text rehearsal.");
      }
      setSession(data);
      setPhase("in_session");
    } catch (err) {
      setSession(null);
      setSessionStartedAt(null);
      setPhase("error");
      const message = friendlyError(err);
      setError(message);
      engineeringLog.append("error", "dashboard", message);
    }
  };

  const endSession = useCallback(() => {
    setPhase("ended");
  }, []);

  const reset = () => {
    setSession(null);
    setSessionStartedAt(null);
    setError(null);
    engineeringLog.reset();
    setPhase("idle");
  };

  const singleSessionActive =
    mode === "single" &&
    (phase === "connecting" || phase === "in_session" || phase === "ended");
  const pickerDisabled = singleSessionActive;

  const switchMode = (next: RehearsalMode) => {
    if (next === mode) return;
    if (singleSessionActive) {
      reset();
    }
    setMode(next);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={() => switchMode("single")}
          className={cn(
            adminSegmentedTabButtonClass,
            "inline-flex items-center gap-2 border px-3 py-1.5 shadow-sm disabled:cursor-not-allowed disabled:opacity-60",
            mode === "single"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
          )}
        >
          <MessageSquareText className="size-3.5" aria-hidden />
          Single turn
        </button>
        <button
          type="button"
          onClick={() => switchMode("batch")}
          className={cn(
            adminSegmentedTabButtonClass,
            "inline-flex items-center gap-2 border px-3 py-1.5 shadow-sm disabled:cursor-not-allowed disabled:opacity-60",
            mode === "batch"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
          )}
        >
          <Rows3 className="size-3.5" aria-hidden />
          Variant batch
        </button>
        <button
          type="button"
          onClick={() => switchMode("regression")}
          className={cn(
            adminSegmentedTabButtonClass,
            "inline-flex items-center gap-2 border px-3 py-1.5 shadow-sm disabled:cursor-not-allowed disabled:opacity-60",
            mode === "regression"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
          )}
        >
          <FlaskConical className="size-3.5" aria-hidden />
          Regression suite
        </button>
        <button
          type="button"
          onClick={() => switchMode("discovery")}
          className={cn(
            adminSegmentedTabButtonClass,
            "inline-flex items-center gap-2 border px-3 py-1.5 shadow-sm disabled:cursor-not-allowed disabled:opacity-60",
            mode === "discovery"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
          )}
        >
          <Sparkles className="size-3.5" aria-hidden />
          Discovery / Stress
        </button>
      </div>

      {phase === "connecting" ? (
        <AdminSectionCard
          title="Starting session"
          description={selectedLine?.orgName ?? "Text rehearsal"}
        >
          <div className="flex items-center gap-2 p-5 text-sm text-gray-600">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Creating LiveKit room and dispatching voice worker…
          </div>
        </AdminSectionCard>
      ) : null}

      {phase === "in_session" && session && sessionStartedAt && mode === "single" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <DemoTextRehearsalPanel
            session={session}
            sessionStartedAt={sessionStartedAt}
            onEnd={endSession}
            log={engineeringLog}
          />
        </div>
      ) : null}

      {phase === "ended" && session && mode === "single" ? (
        <AdminSectionCard title="Session ended">
          <div className="space-y-3 p-5">
            <p className="text-sm text-gray-600">
              Start another session to try a different store or phrasing.
            </p>
            <button
              type="button"
              onClick={reset}
              className={adminSecondaryButtonClass}
            >
              <MessageSquareText className="size-3.5" aria-hidden />
              Start another session
            </button>
          </div>
        </AdminSectionCard>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {mode === "single" && (phase === "idle" || phase === "error") ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <DemoCallLinePicker
            lines={lines}
            selectedE164={selectedE164}
            onSelectedE164Change={setSelectedE164}
            disabled={pickerDisabled}
            toolbarAction={
              <button
                type="button"
                disabled={!selectedLine || pickerDisabled}
                onClick={() => void startSession()}
                className={adminPrimaryButtonClass}
              >
                <MessageSquareText className="size-3.5" aria-hidden />
                Start text rehearsal
              </button>
            }
          />
        </div>
      ) : null}

      {mode === "batch" && selectedLine && !singleSessionActive ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <DemoCallLinePicker
            lines={lines}
            selectedE164={selectedE164}
            onSelectedE164Change={setSelectedE164}
            disabled={false}
          />
          <DemoTextRehearsalBatchPanel line={selectedLine} />
        </div>
      ) : null}

      {mode === "regression" && selectedLine && !singleSessionActive ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <DemoCallLinePicker
            lines={lines}
            selectedE164={selectedE164}
            onSelectedE164Change={setSelectedE164}
            disabled={false}
          />
          <DemoRetailRegressionPanel key={selectedLine.e164} line={selectedLine} />
        </div>
      ) : null}

      {mode === "discovery" && selectedLine && !singleSessionActive ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <DemoCallLinePicker
            lines={lines}
            selectedE164={selectedE164}
            onSelectedE164Change={setSelectedE164}
            disabled={false}
            compact
          />
          <DemoRetailDiscoveryPanel line={selectedLine} />
        </div>
      ) : null}
    </div>
  );
}
