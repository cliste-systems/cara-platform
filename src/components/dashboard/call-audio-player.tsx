"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  Loader2,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";

import { fetchCallRecordingPlaybackUrl } from "@/app/(dashboard)/dashboard/call-history/actions";
import {
  DASHBOARD_HINT_CLASS,
  DASHBOARD_ICON_CHIP_MD,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { callRecordingDownloadFilename } from "@/lib/call-recording-download-filename";
import { cn } from "@/lib/utils";

type CallAudioPlayerProps = {
  callLogId: string;
  createdAt: string;
  callerNumber: string;
  callerName?: string | null;
  /** Hint only — playback is always resolved from the server for this call id. */
  hasRecording?: boolean;
  /** Drop outer bordered shell when nested inside a detail section row. */
  embedded?: boolean;
};

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5] as const;

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function playbackSpeedLabel(rate: number): string {
  if (rate === 1) return "Normal";
  return `${rate}×`;
}

type BrandedPlayerProps = {
  signedUrl: string;
  downloadFilename: string;
  onPlaybackError: () => void;
  embedded?: boolean;
};

function BrandedCallRecordingPlayer({
  signedUrl,
  downloadFilename,
  onPlaybackError,
  embedded = false,
}: BrandedPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [seeking, setSeeking] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = playbackRate;

    const onTimeUpdate = () => {
      if (!seeking) setCurrentTime(audio.currentTime);
    };
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onDurationChange = () => setDuration(audio.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    const onError = () => onPlaybackError();

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [onPlaybackError, playbackRate, seeking, signedUrl]);

  const progress =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const seekToClientX = useCallback((clientX: number) => {
    const audio = audioRef.current;
    const track = trackRef.current;
    if (!audio || !track || !Number.isFinite(audio.duration) || audio.duration <= 0) {
      return;
    }

    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const nextTime = ratio * audio.duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        onPlaybackError();
      }
      return;
    }

    audio.pause();
  };

  const handleDownload = async () => {
    if (downloading) return;

    setDownloading(true);
    try {
      const response = await fetch(signedUrl);
      if (!response.ok) throw new Error("download failed");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = downloadFilename;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      onPlaybackError();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={cn(
        embedded
          ? "py-0.5"
          : "rounded-lg border border-[#d9e2dd] bg-[#f6faf7] p-3 shadow-[0_1px_0_rgba(17,24,29,0.04)]",
      )}
    >
      <audio ref={audioRef} preload="metadata" src={signedUrl} className="hidden" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlayback()}
          aria-label={playing ? "Pause recording" : "Play recording"}
          className={cn(
            DASHBOARD_ICON_CHIP_MD,
            "size-9 shrink-0 cursor-pointer transition-colors hover:bg-white",
            playing && "border-[#35443f]/30 bg-[#35443f] text-white hover:bg-[#243136]",
          )}
        >
          {playing ? (
            <Pause className="size-4 shrink-0" aria-hidden />
          ) : (
            <Play className="size-4 shrink-0 translate-x-px" aria-hidden />
          )}
        </button>

        <div
          ref={trackRef}
          role="slider"
          aria-label="Recording progress"
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration) || 0}
          aria-valuenow={Math.floor(currentTime)}
          tabIndex={0}
          className="group relative h-2 min-w-0 flex-1 cursor-pointer rounded-full bg-[#dfe7e2]"
          onPointerDown={(event) => {
            event.preventDefault();
            setSeeking(true);
            seekToClientX(event.clientX);

            const onMove = (moveEvent: PointerEvent) => {
              seekToClientX(moveEvent.clientX);
            };
            const onUp = () => {
              setSeeking(false);
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };

            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          }}
          onKeyDown={(event) => {
            const audio = audioRef.current;
            if (!audio || !Number.isFinite(audio.duration)) return;

            if (event.key === "ArrowRight") {
              event.preventDefault();
              audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              audio.currentTime = Math.max(0, audio.currentTime - 5);
            }
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#35443f] transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#35443f]/20 bg-white shadow-sm transition-opacity group-hover:opacity-100"
            style={{ left: `${progress}%`, opacity: seeking || playing ? 1 : 0.85 }}
          />
        </div>

        <span className="shrink-0 text-[12px] tabular-nums text-[#6b7c75]">
          {formatAudioTime(currentTime)}
          <span className="text-[#9da9a4]"> / </span>
          {formatAudioTime(duration)}
        </span>

        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                DASHBOARD_SECONDARY_BUTTON_CLASS,
                "inline-flex h-9 min-w-[4.5rem] items-center justify-center px-2.5 text-[12px]",
              )}
            >
              {playbackSpeedLabel(playbackRate)}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[7.5rem] border-[#d9e2dd] bg-[#fbfcfb] p-1 shadow-[0_8px_24px_-12px_rgba(17,24,29,0.28)]"
            >
              {PLAYBACK_SPEEDS.map((speed) => (
                <DropdownMenuItem
                  key={speed}
                  onClick={() => setPlaybackRate(speed)}
                  className="cursor-pointer rounded-md text-[13px] text-[#35443f] focus:bg-[#f6faf7]"
                >
                  <span className="flex-1">{playbackSpeedLabel(speed)}</span>
                  {playbackRate === speed ? (
                    <Check className="size-3.5 text-[#35443f]" aria-hidden />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading}
            aria-label="Download recording"
            className={cn(
              DASHBOARD_SECONDARY_BUTTON_CLASS,
              "inline-flex size-9 items-center justify-center p-0",
            )}
          >
            {downloading ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4 shrink-0" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CallAudioPlayer(props: CallAudioPlayerProps) {
  return <CallRecording key={props.callLogId} {...props} />;
}

function CallRecording({
  callLogId,
  createdAt,
  callerNumber,
  callerName = null,
  hasRecording: _hasRecording = false,
  embedded = false,
}: CallAudioPlayerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadUrl = useCallback(() =>
    fetchCallRecordingPlaybackUrl(callLogId).then((result) => {
      if (!result.ok) {
        setUnavailable(true);
        setSignedUrl(null);
        setMessage(result.message);
        return;
      }
      setUnavailable(false);
      setSignedUrl(result.url);
    }).catch(() => {
      setUnavailable(true);
      setSignedUrl(null);
      setMessage("Could not load recording. Try again.");
    }).finally(() => setLoading(false)), [callLogId]);

  useEffect(() => {
    void loadUrl();
  }, [callLogId, loadUrl]);

  function retry() {
    setLoading(true);
    setMessage(null);
    setSignedUrl(null);
    void loadUrl();
  }

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2",
          !embedded &&
            "rounded-lg border border-[#d9e2dd] bg-[#f6faf7] px-3 py-3",
        )}
      >
        <Loader2 className="size-4 animate-spin text-[#6b7c75]" aria-hidden />
        <span className={DASHBOARD_HINT_CLASS}>Loading recording…</span>
      </div>
    );
  }

  if (unavailable || !signedUrl) {
    return (
      <div
        className={cn(
          "space-y-3",
          !embedded &&
            "rounded-lg border border-[#d9e2dd] bg-[#f6faf7] px-4 py-4",
        )}
      >
        <p className={DASHBOARD_HINT_CLASS}>
          {message ?? "Recording not available for this call."}
        </p>
        <button
          type="button"
          onClick={retry}
          className={cn(
            DASHBOARD_SECONDARY_BUTTON_CLASS,
            "inline-flex min-h-9 items-center gap-2 px-3 text-[13px]",
          )}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Check for recording
        </button>
      </div>
    );
  }

  return (
    <BrandedCallRecordingPlayer
      signedUrl={signedUrl}
      embedded={embedded}
      downloadFilename={callRecordingDownloadFilename({
        createdAt,
        callerNumber,
        callerName,
      })}
      onPlaybackError={retry}
    />
  );
}
