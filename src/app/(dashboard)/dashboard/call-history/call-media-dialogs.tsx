"use client";

import { formatServiceCallDate, formatServiceCallTime } from "@/lib/service-call-format";

import { useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowUpRight, Check, Copy, Download, Loader2, FileText, Headphones, Pause, Play, RotateCcw, X } from "lucide-react";
import { CallAudioPlayer } from "@/components/dashboard/call-audio-player";
import { isCallMediaRetentionExpired } from "@/lib/call-media-retention";
import { parseTranscriptTurns } from "@/lib/transcript-display";
import type { ServiceCall } from "@/lib/service-calls";
import { fetchCallRecordingPlaybackUrl } from "./actions";
import { callRecordingDownloadFilename } from "@/lib/call-recording-download-filename";
import shared from "./calls-date-picker.module.css";
import styles from "./call-media-dialogs.module.css";

type Transcript = { text: string; error: boolean } | null;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function MediaHeaderArt({ recording = false }: { recording?: boolean }) {
  return <div className={`${styles.headerArt} ${styles.caraArt}`} data-kind={recording ? "recording" : "transcript"} aria-hidden="true"/>;
}

function SampleRecordingPlayer() {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState(false);
  async function toggle() {
    if (!audio.current) return;
    try { if (audio.current.paused) await audio.current.play(); else audio.current.pause(); }
    catch { setError(true); }
  }
  return <div className={styles.samplePlayer}>
    <audio ref={audio} src="/cara-sample-call.wav" preload="metadata" onLoadedMetadata={event => setDuration(event.currentTarget.duration)} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setError(true)}/>
    <p className={styles.sampleLabel}>Sample recording</p>
    <p className={styles.muted}>A short example for this preview call.</p>
    <div className={styles.playback}>
      <button className={styles.play} onClick={() => void toggle()} disabled={error || !duration} aria-label={playing ? "Pause recording" : "Play recording"}>{playing ? <Pause/> : <Play/>}</button>
      <div className={styles.timeline}><input aria-label="Recording position" type="range" min={0} max={duration || 0} step={0.1} value={time} disabled={error || !duration} onChange={event => { if (audio.current) audio.current.currentTime = Number(event.target.value); setTime(Number(event.target.value)); }}/><div><span>{clock(time)}</span><span>{clock(duration)}</span></div></div>
    </div>
    <div className={styles.playerTools}><button aria-label="Rewind ten seconds" disabled={!duration || error} onClick={() => { if (audio.current) audio.current.currentTime = Math.max(0, audio.current.currentTime - 10); }}><RotateCcw/>10s</button><button aria-label="Change playback speed" disabled={error} onClick={() => { const next = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : 1; setSpeed(next); if (audio.current) audio.current.playbackRate = next; }}>{speed}× speed</button></div>
    {error && <p role="alert">The sample recording couldn’t load. Please refresh and try again.</p>}
  </div>;
}

export function CallMediaDialogs({ call, name, transcript, onRetry }: { call: ServiceCall; name: string; transcript: Transcript; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const erased = Boolean(call.caller_data_erased_at);
  const expired = isCallMediaRetentionExpired(call.created_at);
  const sample = process.env.NODE_ENV === "development" && Boolean(call.room_name?.startsWith("calls-ui-")) && !call.audio_storage_path;
  const recordingAvailable = !erased && !expired && Boolean(call.audio_storage_path || sample);
  const turns = parseTranscriptTurns((transcript?.text ?? "").replace(/^Cara:\s*/gm, "Assistant: "));
  const date = formatServiceCallDate(call.created_at);
  const time = formatServiceCallTime(call.created_at);
  const metadata = <dl className={styles.headerMeta}><div className={styles.metaCaller}><dt>Caller</dt><dd>{name}</dd></div><div><dt>Date</dt><dd>{date}</dd></div><div><dt>Time</dt><dd>{time}</dd></div></dl>;
  async function copyTranscript() {
    try { await navigator.clipboard.writeText(transcript?.text ?? ""); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  async function exportRecording() {
    if (!recordingAvailable || exporting) return;
    setExporting(true); setExportError(null);
    try {
      const result = sample ? { ok: true as const, url: "/cara-sample-call.wav" } : await fetchCallRecordingPlaybackUrl(call.id);
      if (!result.ok) throw new Error(result.message);
      const response = await fetch(result.url);
      if (!response.ok) throw new Error("The recording couldn’t be exported. Please try again.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = sample ? "hellocara-sample-call.wav" : callRecordingDownloadFilename({ createdAt: call.created_at, callerNumber: call.caller_number, callerName: call.caller_name });
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setExportError(error instanceof Error ? error.message : "The recording couldn’t be exported. Please try again."); }
    finally { setExporting(false); }
  }
  return <section className={styles.media} aria-label="Call recording and transcript">
    <h3>Call media</h3>
    <div className={styles.mediaButtons}>
      <Dialog.Root>
        <Dialog.Trigger className={styles.mediaButton} disabled={!recordingAvailable}><Headphones/><span><strong>Recording</strong><small>{erased ? "Data removed" : expired ? "Retention period ended" : recordingAvailable ? "Listen to the call" : "Not available"}</small></span><ArrowUpRight/></Dialog.Trigger>
        <Dialog.Portal><Dialog.Backdrop className={shared.backdrop}/><Dialog.Popup data-calls-media-dialog className={styles.popup}>
          <header className={styles.header}><MediaHeaderArt recording/><div><Dialog.Title>Recording</Dialog.Title><Dialog.Description className={styles.srOnly}>{name}, {date} at {time}.</Dialog.Description>{metadata}</div><Dialog.Close className={styles.close} aria-label="Close recording"><X/></Dialog.Close></header>
          <div className={styles.body}>{sample ? <SampleRecordingPlayer/> : recordingAvailable ? <div className={styles.recordingPlayer}><CallAudioPlayer callLogId={call.id} createdAt={call.created_at} callerNumber={call.caller_number} callerName={call.caller_name} hasRecording embedded/></div> : <p className={styles.muted}>No recording available for this call.</p>}</div>
          <footer className={styles.footer}><Dialog.Close>Close</Dialog.Close><button className={styles.primary} onClick={() => void exportRecording()} disabled={!recordingAvailable || exporting}>{exporting ? <Loader2 className={styles.spin}/> : <Download/>}{exporting ? "Exporting…" : "Export"}</button>{exportError && <span className={styles.copyStatus} role="alert">{exportError}</span>}</footer>
        </Dialog.Popup></Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root onOpenChange={open => { if (open) { setCopied(false); setCopyError(false); } }}>
        <Dialog.Trigger className={styles.mediaButton} disabled={erased || expired}><FileText/><span><strong>Transcript</strong><small>{erased ? "Data removed" : expired ? "Retention period ended" : "View transcript"}</small></span><ArrowUpRight/></Dialog.Trigger>
        <Dialog.Portal><Dialog.Backdrop className={shared.backdrop}/><Dialog.Popup data-calls-media-dialog className={styles.popup}>
          <header className={styles.header}><MediaHeaderArt/><div><Dialog.Title>Transcript</Dialog.Title><Dialog.Description className={styles.srOnly}>{name}, {date} at {time}.</Dialog.Description>{metadata}</div><Dialog.Close className={styles.close} aria-label="Close transcript"><X/></Dialog.Close></header>
          <div className={styles.body} tabIndex={0} aria-label="Transcript conversation">
            {!transcript ? <p role="status" className={styles.muted}>Loading transcript…</p> : transcript.error ? <div role="alert"><p>We couldn’t load the transcript.</p><button onClick={onRetry}>Try again</button></div> : turns.length ? <div className={styles.conversation}>{turns.map((turn, index) => <div key={index} data-speaker={turn.speaker === "Assistant" ? "cara" : "caller"}><span>{turn.speaker === "Assistant" ? "Cara" : turn.speaker || "Caller"}</span><p>{turn.text.trim()}</p></div>)}</div> : <p className={styles.muted}>No transcript available.</p>}
          </div>
          <footer className={styles.footer}><Dialog.Close>Close</Dialog.Close><button className={styles.primary} onClick={() => void copyTranscript()} disabled={!transcript?.text || transcript.error}>{copied ? <Check/> : <Copy/>}{copied ? "Copied" : "Copy transcript"}</button><span className={styles.copyStatus} role="status">{copyError ? "Couldn’t copy. Please try again." : copied ? "Transcript copied." : ""}</span></footer>
        </Dialog.Popup></Dialog.Portal>
      </Dialog.Root>
    </div>
  </section>;
}
