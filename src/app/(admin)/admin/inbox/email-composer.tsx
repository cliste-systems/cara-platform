"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Mail,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ComposeIdentity = {
  key: "hello" | "billing" | "cliste";
  label: string;
  email: string;
  name: string;
};

type EmailComposerProps = {
  identities: ComposeIdentity[];
  identity: ComposeIdentity;
  to: string;
  subject: string;
  body: string;
  busy: boolean;
  sending: boolean;
  checkingGrammar: boolean;
  onIdentityChange: (key: ComposeIdentity["key"]) => void;
  onToChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onClose: () => void;
  onDiscard: () => void;
  onCheckGrammar: () => void;
  onSend: () => void;
};

const quietButtonClass =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40";

export function EmailComposer({
  identities,
  identity,
  to,
  subject,
  body,
  busy,
  sending,
  checkingGrammar,
  onIdentityChange,
  onToChange,
  onSubjectChange,
  onBodyChange,
  onClose,
  onDiscard,
  onCheckGrammar,
  onSend,
}: EmailComposerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const hasDraft = Boolean(to || subject || body);
  const tooLong = body.length > 20_000;
  const canSend =
    Boolean(to.trim() && subject.trim() && body.trim()) && !tooLong;

  return (
    <form
      ref={formRef}
      className="flex min-h-0 flex-1 flex-col bg-white"
      aria-label="New email"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && canSend) onSend();
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          if (!busy && canSend) formRef.current?.requestSubmit();
        } else if (
          event.key === "Enter" &&
          event.target instanceof HTMLInputElement
        ) {
          // Enter moves through addressing fields; only Send or the explicit
          // keyboard shortcut submits a completed message.
          event.preventDefault();
          if (!event.target.reportValidity()) return;
          const nextField =
            event.target.name === "to"
              ? "#compose-subject"
              : "#compose-message";
          formRef.current?.querySelector<HTMLElement>(nextField)?.focus();
        }
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className={cn(quietButtonClass, "size-9 p-0")}
            aria-label="Back to inbox"
            title="Back to inbox"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            New email
          </h2>
          {hasDraft ? (
            <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 sm:inline">
              Unsent draft
            </span>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className={quietButtonClass}
        >
          Close
        </button>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        data-email-compose-canvas
      >
        <div className="mx-auto flex h-full min-h-[360px] w-full max-w-5xl flex-col px-5 sm:px-8 lg:px-10">
          <div className="shrink-0 divide-y divide-slate-100 border-b border-slate-200">
            <div className="flex min-h-14 items-center gap-3">
              <span className="w-14 shrink-0 text-sm text-slate-500">From</span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={busy}
                  aria-label={`Send from ${identity.email}`}
                  className="-ml-2 flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="hidden size-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 sm:flex">
                    <Mail className="size-3.5" aria-hidden />
                  </span>
                  <span className="hidden shrink-0 text-sm font-medium text-slate-800 sm:inline">
                    {identity.label}
                  </span>
                  <span className="min-w-0 truncate text-sm text-slate-600">
                    {identity.email}
                  </span>
                  <ChevronDown
                    className="size-3.5 shrink-0 text-slate-400"
                    aria-hidden
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-64">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Send from</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {identities.map((mailbox) => (
                      <DropdownMenuItem
                        key={mailbox.key}
                        className="gap-3 px-3 py-3"
                        onClick={() => onIdentityChange(mailbox.key)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {mailbox.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {mailbox.email}
                          </span>
                        </span>
                        {mailbox.key === identity.key ? (
                          <Check className="size-4 text-blue-600" aria-hidden />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div>
              <div className="flex min-h-14 items-center gap-3">
                <label
                  htmlFor="compose-recipient"
                  className="w-14 shrink-0 text-sm text-slate-500"
                >
                  To
                </label>
                <input
                  id="compose-recipient"
                  name="to"
                  type="email"
                  pattern={String.raw`[^\s@]+@[^\s@]+\.[^\s@]+`}
                  autoFocus
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={busy}
                  value={to}
                  onChange={(event) => {
                    onToChange(event.target.value);
                    setRecipientError(null);
                  }}
                  onBlur={(event) => {
                    if (to.trim() && !event.target.validity.valid) {
                      setRecipientError(
                        "Enter one valid email address, such as name@example.com.",
                      );
                    }
                  }}
                  onInvalid={() =>
                    setRecipientError(
                      "Enter one valid email address, such as name@example.com.",
                    )
                  }
                  aria-invalid={Boolean(recipientError)}
                  aria-describedby={
                    recipientError ? "compose-recipient-error" : undefined
                  }
                  placeholder="name@example.com"
                  className={cn(
                    "min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-3 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-100",
                    recipientError && "text-red-700",
                  )}
                />
              </div>
              {recipientError ? (
                <p
                  id="compose-recipient-error"
                  className="pb-3 pl-[4.25rem] text-xs leading-5 text-red-600"
                  role="alert"
                >
                  {recipientError}
                </p>
              ) : null}
            </div>
            <div className="flex min-h-14 items-center gap-3">
              <label
                htmlFor="compose-subject"
                className="w-14 shrink-0 text-sm text-slate-500"
              >
                Subject
              </label>
              <input
                id="compose-subject"
                name="subject"
                type="text"
                required
                maxLength={500}
                disabled={busy}
                value={subject}
                onChange={(event) => onSubjectChange(event.target.value)}
                placeholder="Add a subject"
                className="min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-3 text-[15px] font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-100"
              />
            </div>
          </div>
          <label htmlFor="compose-message" className="sr-only">
            Message
          </label>
          <textarea
            id="compose-message"
            name="message"
            required
            value={body}
            disabled={busy}
            onChange={(event) => onBodyChange(event.target.value)}
            maxLength={20_000}
            spellCheck
            aria-invalid={tooLong}
            aria-describedby={tooLong ? "compose-body-count" : undefined}
            placeholder="Write your message…"
            className="my-1 min-h-40 w-full flex-1 resize-none rounded-lg border-0 bg-transparent px-1 py-5 text-[15px] leading-7 text-slate-800 outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-100 sm:text-base sm:leading-8"
          />
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-8 sm:py-4 lg:px-10">
        <div className="mx-auto flex max-w-[944px] flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-1 sm:gap-3">
            <button
              type="submit"
              disabled={busy || !canSend}
              title="Send email (⌘ Enter or Ctrl Enter)"
              aria-label={sending ? "Sending email" : "Send email"}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:px-5"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {sending ? (
                "Sending…"
              ) : (
                <>
                  <span className="sm:hidden">Send</span>
                  <span className="hidden sm:inline">Send email</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={busy || !body.trim() || tooLong}
              onClick={onCheckGrammar}
              className={cn(quietButtonClass, "px-2 sm:px-3")}
              aria-label={
                checkingGrammar ? "Checking grammar" : "Check grammar"
              }
              title="Correct spelling, grammar and punctuation"
            >
              {checkingGrammar ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {checkingGrammar ? (
                "Checking…"
              ) : (
                <>
                  <span className="sm:hidden">Grammar</span>
                  <span className="hidden sm:inline">Check grammar</span>
                </>
              )}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span
              id="compose-body-count"
              className={cn(
                "hidden text-xs tabular-nums sm:inline",
                tooLong ? "font-medium text-red-600" : "text-slate-400",
                tooLong && "inline",
              )}
            >
              {body.length.toLocaleString()} / 20,000
            </span>
            <button
              type="button"
              disabled={busy || !hasDraft}
              onClick={() => {
                if (
                  window.confirm(
                    "Discard this draft? The recipient, subject and message will be cleared.",
                  )
                )
                  onDiscard();
              }}
              aria-label="Discard draft"
              title="Discard draft"
              className={cn(
                quietButtonClass,
                "size-10 px-0 hover:bg-red-50 hover:text-red-700",
              )}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </footer>
    </form>
  );
}
