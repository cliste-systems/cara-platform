"use client";

import interactions from "@/components/onboarding/signup-interactions.module.css";
import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { Loader2, Play, Square } from "lucide-react";
import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import styles from "./signup-voice-card.module.css";

export function SignupVoiceCard({ greeting, playing, loading, error, elapsed, onPlay, sample = false, disabled = false }: {
  greeting: ReactNode; playing: boolean; loading: boolean; error: string | null;
  elapsed: number; onPlay: () => void; sample?: boolean; disabled?: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [samplePlaying, setSamplePlaying] = useState(false);
  const [sampleTime, setSampleTime] = useState(0);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const active = sample ? samplePlaying : playing;
  const seconds = Math.floor(sample ? sampleTime : elapsed);
  async function toggle() {
    if (!sample) return onPlay();
    const player = audio.current;
    if (!player) return;
    if (samplePlaying) { player.pause(); player.currentTime = 0; return; }
    setSampleError(null);
    try { await player.play(); } catch { setSampleError("The sample couldn’t play. Please try again."); }
  }
  return (
    <section aria-label="Cara voice preview" className={styles.card}>
      <div className={styles.portrait}>
        <Image src="/cara-voice-portrait.webp" alt="Cara smiling, wearing her headset" fill sizes="(max-width: 767px) 100vw, 280px" preload unoptimized />
      </div>
      <div className={styles.player}>
        <p className={styles.eyebrow}>{sample ? "A hello from Cara" : "Your callers’ first hello"}</p>
        <blockquote className={styles.quote}>“{sample ? <>Hiya, you’re through to <strong>HelloCara</strong>. I’m Cara, your AI receptionist. How can I help?</> : greeting}”</blockquote>
        <div className={styles.controls}>
          <div aria-hidden className={styles.wave} data-playing={active}>
            {Array.from({length:32},(_,i)=><span key={i} style={{height: `${[12,24,18,36,28,16,32,22][i%8]}px`,animationDelay:`${i%7*-.11}s`}} />)}
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={() => void toggle()} disabled={loading || disabled} aria-busy={loading} className={`${styles.play} ${interactions.primary}`}>
              {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : active ? <Square size={13} aria-hidden /> : <Play size={15} aria-hidden />}
              {loading ? "Preparing…" : active ? "Stop playback" : error || sampleError ? "Try again" : "Hear Cara"}
            </button>
            <span className={styles.time} aria-label="Elapsed playback time">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")}</span>
          </div>
          <p className={styles.note} role="status">{loading ? "Preparing your personalised greeting." : active ? "Cara is speaking." : sample ? "Voice sample · Your greeting will use your business name." : "Listen when you’re ready, or continue below."}</p>
          <AuthFormAlert title="Audio unavailable" message={sample ? sampleError : error} />
        </div>
      </div>
      {sample && <audio ref={audio} src="/cara-signup-sample.mp3" preload="none" onPlaying={()=>setSamplePlaying(true)} onPause={()=>setSamplePlaying(false)} onEnded={()=>setSamplePlaying(false)} onTimeUpdate={()=>setSampleTime(audio.current?.currentTime ?? 0)} onError={()=>{setSamplePlaying(false);setSampleError("The sample couldn’t load. Please try again.");}} />}
    </section>
  );
}
