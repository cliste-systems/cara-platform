"use client";

import { useEffect, useState } from "react";

const TICK_MS = 60_000;

type Listener = () => void;

const listeners = new Set<Listener>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function ensureInterval() {
  if (intervalId != null || typeof window === "undefined") return;
  intervalId = setInterval(() => {
    for (const listener of listeners) {
      listener();
    }
  }, TICK_MS);
}

function clearIntervalIfIdle() {
  if (listeners.size > 0 || intervalId == null) return;
  clearInterval(intervalId);
  intervalId = null;
}

/** Shared minute-level ticker for temporal countdown rows. */
export function useKnowledgeTemporalTicker(enabled = true): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    ensureInterval();

    const onFocus = () => setTick((value) => value + 1);
    window.addEventListener("focus", onFocus);

    return () => {
      listeners.delete(listener);
      clearIntervalIfIdle();
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled]);

  return tick;
}
