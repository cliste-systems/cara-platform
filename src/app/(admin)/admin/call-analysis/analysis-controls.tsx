"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, RefreshCw } from "lucide-react";

import { adminPrimaryButtonClass, adminSecondaryButtonClass } from "@/components/admin/admin-interactive";
import { fetchAdminCallRecording, retryCallAnalysis } from "./actions";

export function AnalysisRefresh({ active = false }: { active?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    }, 8000);
    return () => window.clearInterval(timer);
  }, [active, router]);
  return <button type="button" className={adminSecondaryButtonClass} onClick={() => startTransition(() => router.refresh())} disabled={pending}><RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden />Refresh</button>;
}

export function RetryAnalysisButton({ callLogId, label = "Retry analysis" }: { callLogId: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  return <div className="space-y-2">
    <button type="button" disabled={pending} className={adminPrimaryButtonClass} onClick={() => {
      setFeedback(null);
      startTransition(async () => {
        try {
          const result = await retryCallAnalysis(callLogId);
          setFeedback(result);
          if (result.ok) router.refresh();
        } catch {
          setFeedback({ ok: false, message: "Could not retry analysis. Please try again." });
        }
      });
    }}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
      {pending ? "Queueing…" : label}
    </button>
    {feedback ? <p role={feedback.ok ? "status" : "alert"} className={`max-w-sm text-xs ${feedback.ok ? "text-gray-600" : "text-red-700"}`}>{feedback.message}</p> : null}
  </div>;
}

export function AnalysisRecording({ callLogId }: { callLogId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return <div className="space-y-3">
    {url ? <audio aria-label="Call recording" controls preload="metadata" src={url} className="h-10 w-full" onError={() => { setUrl(null); setMessage("Recording link expired or could not load. Load it again to retry."); }}>Your browser does not support audio playback.</audio> : <button type="button" disabled={pending} className={adminSecondaryButtonClass} onClick={() => {
      setMessage(null);
      startTransition(async () => {
        try {
          const result = await fetchAdminCallRecording(callLogId);
          setUrl(result.url);
          if (!result.url) setMessage("Recording is no longer available for this call.");
        } catch { setMessage("Could not load the recording. Please try again."); }
      });
    }}>{pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}{pending ? "Loading recording…" : "Load call recording"}</button>}
    {message ? <p className="text-xs text-gray-500" role="status">{message}</p> : null}
  </div>;
}
