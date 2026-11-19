"use client";

import { formatServiceCallDate } from "@/lib/service-call-format";

import { useRef, useState, type KeyboardEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import styles from "./calls-date-picker.module.css";

const dateFromKey = (key: string) => new Date(`${key}T12:00:00Z`);
const keyFromDate = (date: Date) => date.toISOString().slice(0, 10);
const label = (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IE", { ...options, timeZone: "UTC" }).format(date);

export function CallsDatePicker({ value, today, onChange }: { value: string; today: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const selectedRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const first = dateFromKey(`${month}-01`);
  const offset = (first.getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(index - offset + 1);
    return { date, key: keyFromDate(date) };
  });
  function moveMonth(amount: number) {
    const date = new Date(first);
    date.setUTCMonth(date.getUTCMonth() + amount);
    setMonth(keyFromDate(date).slice(0, 7));
  }
  function choose(key: string) { onChange(key); setOpen(false); }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, key: string) {
    const amount = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (amount === undefined) return;
    event.preventDefault();
    const date = dateFromKey(key);
    date.setUTCDate(date.getUTCDate() + amount);
    const next = keyFromDate(date);
    if (next > today) return;
    if (next.slice(0, 7) !== month) setMonth(next.slice(0, 7));
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus());
  }
  return <Dialog.Root open={open} onOpenChange={next => { if (next) setMonth(value.slice(0, 7)); setOpen(next); }}>
    <Dialog.Trigger className={styles.trigger} aria-label={`Call date, ${label(dateFromKey(value), { day: "numeric", month: "long", year: "numeric" })}`}>
      <CalendarDays aria-hidden="true"/><span>{formatServiceCallDate(value)}</span>
    </Dialog.Trigger>
    <Dialog.Portal><Dialog.Backdrop className={styles.backdrop}/>
      <Dialog.Popup data-calls-calendar className={styles.calendar} initialFocus={selectedRef}>
        <header><Dialog.Title>{label(first, { month: "long", year: "numeric" })}</Dialog.Title><div><button aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft/></button><button aria-label="Next month" disabled={month >= today.slice(0, 7)} onClick={() => moveMonth(1)}><ChevronRight/></button><Dialog.Close className={styles.close} aria-label="Close date picker"><X/></Dialog.Close></div></header>
        <Dialog.Description className={styles.description}>Choose a day to view its calls.</Dialog.Description>
        <div className={styles.weekdays} aria-hidden="true">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={index}>{day}</span>)}</div>
        <div ref={gridRef} className={styles.days} role="group" aria-label="Days">
          {days.map(({ date, key }) => <button key={key} ref={key === value ? selectedRef : undefined} data-day={key} data-outside={key.slice(0, 7) !== month} data-today={key === today} aria-label={label(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} aria-pressed={key === value} disabled={key > today} onKeyDown={event => keyboard(event, key)} onClick={() => choose(key)}>{date.getUTCDate()}</button>)}
        </div>
        <footer><span/><button onClick={() => choose(today)}>Today</button></footer>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
