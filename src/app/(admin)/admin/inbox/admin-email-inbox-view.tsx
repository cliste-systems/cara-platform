"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArchiveRestore,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Reply,
  MousePointerClick,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-interactive";
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

import { EmailMessageBody } from "./email-message-body";
import { EmailComposer } from "./email-composer";

type Folder = "inbox" | "archived" | "sent";
type GrammarTarget = "reply" | "compose";
type EmailIdentityKey = "hello" | "billing" | "cliste";
type DeliveryStatus =
  | "sent"
  | "delayed"
  | "delivered"
  | "opened"
  | "clicked"
  | "complained"
  | "suppressed"
  | "bounced"
  | "failed"
  | "unknown";

type DeliveryEvent = {
  id: string;
  type: string;
  occurredAt: string;
  detail: string | null;
};

type EmailIdentity = {
  key: EmailIdentityKey;
  label: string;
  email: string;
  name: string;
};

type EmailListItem = {
  id: string;
  direction: "inbound" | "outbound";
  parentResendEmailId: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  subject: string;
  preview: string;
  occurredAt: string;
  readAt: string | null;
  archivedAt: string | null;
  deliveryStatus: DeliveryStatus | null;
  deliveryStatusAt: string | null;
};

type EmailMessage = EmailListItem & {
  messageId: string | null;
  replyToAddresses: string[];
  ccAddresses: string[];
  textBody: string;
  htmlBody: string | null;
  senderBlocked: boolean;
  attachments: Array<Record<string, unknown>>;
  replies: EmailListItem[];
  deliveryEvents: DeliveryEvent[];
};

const FOLDERS: Array<{ value: Folder; label: string; icon: typeof Inbox }> = [
  { value: "inbox", label: "Inbox", icon: Inbox },
  { value: "archived", label: "Archived", icon: Archive },
  { value: "sent", label: "Sent", icon: Send },
];

function whenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("en-IE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("en-IE", {
    day: "2-digit",
    month: "short",
  });
}

function fullWhenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function displaySender(item: EmailListItem): string {
  return item.fromName?.trim() || item.fromAddress;
}

function deliveryStatusLabel(status: DeliveryStatus | null): string {
  switch (status) {
    case "delivered":
      return "Delivered";
    case "opened":
      return "Opened";
    case "clicked":
      return "Clicked";
    case "delayed":
      return "Delayed";
    case "bounced":
      return "Bounced";
    case "failed":
      return "Failed";
    case "suppressed":
      return "Suppressed";
    case "complained":
      return "Complaint";
    case "sent":
      return "Sent";
    default:
      return "Sent";
  }
}

function DeliveryStatusBadge({
  status,
  compact = false,
}: {
  status: DeliveryStatus | null;
  compact?: boolean;
}) {
  const normalized = status ?? "sent";
  const failure = ["bounced", "failed", "suppressed", "complained"].includes(
    normalized,
  );
  const Icon =
    normalized === "opened"
      ? Eye
      : normalized === "clicked"
        ? MousePointerClick
        : normalized === "delayed"
          ? Clock3
          : failure
            ? TriangleAlert
            : CheckCircle2;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        failure
          ? "border-red-200 bg-red-50 text-red-700"
          : normalized === "opened" || normalized === "clicked"
            ? "border-slate-300 bg-slate-100 text-slate-800"
            : "border-slate-200 bg-white text-slate-600",
      )}
      title={
        normalized === "opened"
          ? "Open tracking can be affected by image blocking and mail privacy features."
          : undefined
      }
    >
      <Icon className={compact ? "size-2.5" : "size-3"} aria-hidden />
      {deliveryStatusLabel(status)}
    </span>
  );
}

function deliveryStages(message: EmailMessage): Array<{
  label: "Sent" | "Delivered" | "Opened";
  complete: boolean;
}> {
  const eventTypes = new Set(message.deliveryEvents.map((event) => event.type));
  const opened =
    message.deliveryStatus === "opened" ||
    message.deliveryStatus === "clicked" ||
    eventTypes.has("email.opened") ||
    eventTypes.has("email.clicked");
  const delivered =
    opened ||
    message.deliveryStatus === "delivered" ||
    eventTypes.has("email.delivered");

  return [
    { label: "Sent", complete: true },
    { label: "Delivered", complete: delivered },
    { label: "Opened", complete: opened },
  ];
}

function deliveryFailed(status: DeliveryStatus | null): boolean {
  return ["failed", "bounced", "suppressed", "complained"].includes(
    status ?? "",
  );
}

const toolbarButtonClass =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg px-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40";
const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

async function apiJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data = (await response.json()) as T & {
    error?: string;
    code?: string;
  };
  if (!response.ok) {
    if (typeof window !== "undefined") {
      if (data.code === "gate_required") {
        window.location.assign("/admin/login");
        throw new Error("Admin gate authentication is required.");
      }
      if (data.code === "mfa_required") {
        window.location.assign("/admin/mfa");
        throw new Error("Multi-factor authentication is required.");
      }
      if (data.code === "session_required") {
        window.location.assign("/authenticate");
        throw new Error("Admin sign-in is required.");
      }
    }
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

export function AdminEmailInboxView({
  identities,
}: {
  identities: EmailIdentity[];
}) {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [identityKey, setIdentityKey] = useState<EmailIdentityKey>(
    identities[0]?.key ?? "hello",
  );
  const [messages, setMessages] = useState<EmailListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const messageCacheRef = useRef<Map<string, EmailMessage>>(new Map());
  const messageRequestRef = useRef(0);
  const listRequestRef = useRef(0);
  const listPendingRef = useRef(false);
  const replyDraftsRef = useRef(new Map<string, string>());
  const [readerOpen, setReaderOpen] = useState(false);
  const [expandedReader, setExpandedReader] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [composing, setComposing] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [sending, setSending] = useState(false);
  const [checkingGrammar, setCheckingGrammar] = useState<GrammarTarget | null>(
    null,
  );
  const [changingState, setChangingState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const navigationBusy = sending || changingState || checkingGrammar !== null;

  const activeIdentity = identities.find(
    (identity) => identity.key === identityKey,
  ) ??
    identities[0] ?? {
      key: "hello" as const,
      label: "Hello",
      email: "hello@hellocara.ie",
      name: "HelloCara",
    };

  const loadFolder = useCallback(
    async (nextFolder: Folder, preserveSelection = false, silent = false) => {
      if (silent && listPendingRef.current) return;
      const requestId = ++listRequestRef.current;
      listPendingRef.current = true;
      if (!silent) {
        setLoadingList(true);
        setError(null);
      }
      try {
        const data = await apiJson<{ messages: EmailListItem[] }>(
          `/api/admin/inbox?folder=${nextFolder}&identity=${identityKey}`,
        );
        if (requestId !== listRequestRef.current) return;
        for (const message of data.messages) {
          const cached = messageCacheRef.current.get(message.id);
          if (
            cached &&
            (cached.readAt !== message.readAt ||
              cached.archivedAt !== message.archivedAt)
          ) {
            messageCacheRef.current.delete(message.id);
          }
        }
        setMessages(data.messages);
        if (
          !preserveSelection &&
          !window.matchMedia("(min-width: 1024px)").matches
        ) {
          setReaderOpen(false);
        }
        setSelectedId((current) => {
          // A full reply can be opened from another folder. Background refreshes
          // must not replace it, or reopen a message just marked unread.
          if (preserveSelection) return current;
          return window.matchMedia("(min-width: 1024px)").matches
            ? (data.messages[0]?.id ?? null)
            : null;
        });
      } catch (loadError) {
        if (requestId !== listRequestRef.current) return;
        if (!silent) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load inbox.",
          );
        }
      } finally {
        if (requestId === listRequestRef.current) {
          listPendingRef.current = false;
          setLoadingList(false);
        }
      }
    },
    [identityKey],
  );

  const refreshDeliveryStatus = useCallback(async (id: string) => {
    try {
      const delivery = await apiJson<{
        ok: true;
        status: DeliveryStatus;
        statusAt: string | null;
      }>(`/api/admin/inbox/${encodeURIComponent(id)}/delivery`, {
        method: "POST",
      });

      setSelected((current) =>
        current?.id === id
          ? {
              ...current,
              deliveryStatus: delivery.status,
              deliveryStatusAt: delivery.statusAt,
            }
          : current,
      );
      setMessages((current) =>
        current.map((message) =>
          message.id === id
            ? {
                ...message,
                deliveryStatus: delivery.status,
                deliveryStatusAt: delivery.statusAt,
              }
            : message,
        ),
      );
    } catch {
      // Keep the last known state visible if the live status check fails.
    }
  }, []);

  const loadMessage = useCallback(
    async (id: string) => {
      const requestId = ++messageRequestRef.current;
      const cached = messageCacheRef.current.get(id);

      if (cached && cached.direction !== "outbound") {
        setSelected(cached);
        setLoadingMessage(false);
        return;
      }

      setLoadingMessage(true);
      setSelected(null);
      setError(null);

      try {
        const data = await apiJson<{ message: EmailMessage }>(
          `/api/admin/inbox/${encodeURIComponent(id)}`,
        );
        if (requestId !== messageRequestRef.current) return;

        const openedAt =
          data.message.direction === "inbound" && !data.message.readAt
            ? new Date().toISOString()
            : data.message.readAt;
        const openedMessage = { ...data.message, readAt: openedAt };

        if (openedMessage.direction !== "outbound") {
          messageCacheRef.current.set(id, openedMessage);
          if (messageCacheRef.current.size > 30) {
            const oldest = messageCacheRef.current.keys().next().value as
              string | undefined;
            if (oldest) messageCacheRef.current.delete(oldest);
          }
        }

        setSelected(openedMessage);
        setMessages((current) =>
          current.map((message) =>
            message.id === id
              ? {
                  ...message,
                  readAt: openedAt,
                  preview: openedMessage.preview || message.preview,
                }
              : message,
          ),
        );

        if (data.message.direction === "outbound") {
          void refreshDeliveryStatus(id);
        }

        if (data.message.direction === "inbound" && !data.message.readAt) {
          void apiJson<{ ok: true }>(
            `/api/admin/inbox/${encodeURIComponent(id)}`,
            {
              method: "PATCH",
              body: JSON.stringify({ read: true }),
            },
          ).catch(() => {
            // Reading the message should never wait on the read-receipt write.
          });
        }
      } catch (loadError) {
        if (requestId !== messageRequestRef.current) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not open email.",
        );
      } finally {
        if (requestId === messageRequestRef.current) {
          setLoadingMessage(false);
        }
      }
    },
    [refreshDeliveryStatus],
  );

  useEffect(() => {
    void loadFolder(folder);
  }, [folder, loadFolder]);

  useEffect(() => {
    setReplyOpen(false);
    setReply(selectedId ? (replyDraftsRef.current.get(selectedId) ?? "") : "");
    if (selectedId && !composing) {
      void loadMessage(selectedId);
    } else {
      ++messageRequestRef.current;
      setSelected(null);
      setLoadingMessage(false);
    }
  }, [selectedId, composing, loadMessage]);

  useEffect(() => {
    if (folder !== "inbox" && folder !== "sent") return;

    const refreshFolder = () => {
      if (document.visibilityState !== "visible") return;

      void loadFolder(folder, true, true);

      if (folder === "sent" && selectedId && !composing) {
        // Refresh only the delivery/open state. Never remount the email body.
        void refreshDeliveryStatus(selectedId);
      }
    };

    const timer = window.setInterval(refreshFolder, 5_000);
    window.addEventListener("focus", refreshFolder);
    document.addEventListener("visibilitychange", refreshFolder);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshFolder);
      document.removeEventListener("visibilitychange", refreshFolder);
    };
  }, [folder, selectedId, composing, loadFolder, refreshDeliveryStatus]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return messages;
    return messages.filter((message) =>
      [
        message.fromAddress,
        message.fromName ?? "",
        message.subject,
        message.preview,
        message.toAddresses.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [messages, query]);

  const unreadCount = useMemo(
    () =>
      messages.filter(
        (message) => message.direction === "inbound" && !message.readAt,
      ).length,
    [messages],
  );

  const checkGrammar = async (target: GrammarTarget) => {
    const draft = target === "reply" ? reply : composeBody;
    if (!draft.trim()) return;

    const draftMessageRequest = messageRequestRef.current;
    setCheckingGrammar(target);
    setError(null);
    setNotice(null);
    try {
      const data = await apiJson<{
        ok: true;
        suggested: string;
        changed: boolean;
      }>("/api/admin/inbox/grammar", {
        method: "POST",
        body: JSON.stringify({ text: draft }),
      });

      if (target === "reply") {
        if (selectedId) replyDraftsRef.current.set(selectedId, data.suggested);
        if (draftMessageRequest !== messageRequestRef.current) return;
        setReply(data.suggested);
      } else {
        setComposeBody(data.suggested);
      }
      setNotice(
        data.changed
          ? "Grammar corrected. Review it before sending."
          : "No grammar issues found.",
      );
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "AI grammar check failed.",
      );
    } finally {
      setCheckingGrammar(null);
    }
  };

  const sendReply = async () => {
    if (!selected || selected.direction !== "inbound" || !reply.trim()) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      await apiJson<{ ok: true; id: string }>(
        `/api/admin/inbox/${encodeURIComponent(selected.id)}/reply`,
        {
          method: "POST",
          body: JSON.stringify({ text: reply }),
        },
      );
      setReply("");
      replyDraftsRef.current.delete(selected.id);
      setReplyOpen(false);
      setNotice("Reply sent.");
      messageCacheRef.current.delete(selected.id);
      await loadMessage(selected.id);
      await loadFolder(folder, true, true);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send reply.",
      );
    } finally {
      setSending(false);
    }
  };

  const sendNewEmail = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      setError("Add a recipient, subject and message before sending.");
      return;
    }

    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiJson<{ ok: true; id: string }>(
        "/api/admin/inbox/send",
        {
          method: "POST",
          body: JSON.stringify({
            to: composeTo,
            subject: composeSubject,
            text: composeBody,
            identity: identityKey,
          }),
        },
      );

      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setComposing(false);
      setFolder("sent");
      setSelectedId(data.id);
      setNotice("Email sent.");
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send email.",
      );
    } finally {
      setSending(false);
    }
  };

  const updateSelectedState = async (change: {
    read?: boolean;
    archived?: boolean;
  }) => {
    if (!selected) return;
    setChangingState(true);
    setError(null);
    setNotice(null);
    try {
      await apiJson<{ ok: true }>(
        `/api/admin/inbox/${encodeURIComponent(selected.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(change),
        },
      );
      messageCacheRef.current.delete(selected.id);
      if (change.archived !== undefined) {
        await loadFolder(folder);
      } else {
        if (change.read === false) {
          setSelectedId(null);
          setSelected(null);
          setReaderOpen(false);
        } else {
          setSelected((current) =>
            current
              ? { ...current, readAt: new Date().toISOString() }
              : current,
          );
        }
        await loadFolder(folder, true);
      }
    } catch (stateError) {
      setError(
        stateError instanceof Error
          ? stateError.message
          : "Could not update email.",
      );
    } finally {
      setChangingState(false);
    }
  };

  const updateSenderBlocked = async () => {
    if (!selected || selected.direction !== "inbound") return;

    const block = !selected.senderBlocked;
    if (
      block &&
      !window.confirm(
        `Block ${selected.fromAddress}? Future emails from this exact address will go straight to Archived.`,
      )
    ) {
      return;
    }

    setChangingState(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiJson<{
        ok: true;
        senderEmail: string | null;
      }>(`/api/admin/inbox/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ blocked: block }),
      });

      setNotice(
        block
          ? `${data.senderEmail || selected.fromAddress} blocked. Future mail from this address will go to Archived.`
          : `${data.senderEmail || selected.fromAddress} unblocked.`,
      );
      messageCacheRef.current.clear();

      if (block && folder === "inbox") {
        await loadFolder("inbox");
      } else {
        await loadMessage(selected.id);
        await loadFolder(folder, true, true);
      }
    } catch (stateError) {
      setError(
        stateError instanceof Error
          ? stateError.message
          : "Could not update blocked sender.",
      );
    } finally {
      setChangingState(false);
    }
  };

  const selectMessage = (id: string) => {
    setComposing(false);
    setSelectedId(id);
    setReaderOpen(true);
    setNotice(null);
    setError(null);
  };

  const resetMailboxView = () => {
    ++listRequestRef.current;
    ++messageRequestRef.current;
    setMessages([]);
    setLoadingList(true);
    setSelectedId(null);
    setSelected(null);
    setComposing(false);
    setReaderOpen(false);
    setExpandedReader(false);
    setQuery("");
    setNotice(null);
    setError(null);
  };

  const selectedIndex = filtered.findIndex(
    (message) => message.id === selectedId,
  );
  const folderLabel =
    FOLDERS.find((item) => item.value === folder)?.label ?? "Inbox";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-inset [&_button]:focus-visible:ring-blue-500">
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 py-3 sm:px-5",
          composing && "hidden",
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg py-1 pr-3 text-left outline-none hover:bg-slate-50"
            aria-label={`Choose mailbox, ${activeIdentity.label}`}
            disabled={navigationBusy}
          >
            <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 sm:flex">
              <Mail className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-950">
                {activeIdentity.label}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {activeIdentity.email}
              </span>
            </span>
            <ChevronDown
              className="size-4 shrink-0 text-slate-400"
              aria-hidden
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Mailboxes</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {identities.map((identity) => (
                <DropdownMenuItem
                  key={identity.key}
                  className="gap-3 px-3 py-3"
                  onClick={() => {
                    if (identity.key === identityKey) return;
                    resetMailboxView();
                    setIdentityKey(identity.key);
                    setFolder("inbox");
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {identity.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {identity.email}
                    </span>
                  </span>
                  {identity.key === identityKey ? (
                    <Check className="size-4 text-blue-600" aria-hidden />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          disabled={navigationBusy}
          onClick={() => {
            setComposing(true);
            setReaderOpen(true);
            setError(null);
            setNotice(null);
          }}
          className={cn(
            adminPrimaryButtonClass,
            "shrink-0 rounded-lg px-3 py-2.5 sm:px-4",
          )}
        >
          <Plus className="size-4" aria-hidden />
          {composeTo || composeSubject || composeBody
            ? "Continue draft"
            : "New email"}
        </button>
      </div>

      {error || notice ? (
        <div
          role={error ? "alert" : "status"}
          className={cn(
            "flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 text-sm",
            error
              ? "border-red-100 bg-red-50 text-red-700"
              : "border-emerald-100 bg-emerald-50 text-emerald-800",
          )}
        >
          <span>{error || notice}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => {
              setError(null);
              setNotice(null);
            }}
            className="shrink-0 rounded p-0.5"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1">
        <aside
          aria-label="Email list"
          className={cn(
            "min-h-0 w-full shrink-0 flex-col border-r border-slate-200 bg-white lg:w-[300px] xl:w-[340px] 2xl:w-[380px]",
            readerOpen || composing ? "hidden lg:flex" : "flex",
            (expandedReader || composing) && "lg:hidden",
          )}
        >
          <div className="shrink-0 border-b border-slate-200 px-3 pt-3">
            <div
              className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1"
              aria-label="Email folders"
            >
              {FOLDERS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  disabled={navigationBusy}
                  aria-pressed={folder === value}
                  onClick={() => {
                    if (folder === value) {
                      setReaderOpen(false);
                      setComposing(false);
                      return;
                    }
                    resetMailboxView();
                    setFolder(value);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                    folder === value
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-900",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <div className="relative mt-3">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                aria-label={`Search ${folderLabel.toLowerCase()}`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${folderLabel.toLowerCase()}…`}
                className={cn(fieldClass, "bg-slate-50 py-2 pr-3 pl-9 text-sm")}
              />
            </div>
            <div className="flex min-h-11 items-center justify-between gap-2 px-1 text-xs text-slate-500">
              <span aria-live="polite">
                {query.trim()
                  ? `${filtered.length} of ${messages.length}`
                  : messages.length}{" "}
                {messages.length === 1 ? "email" : "emails"}
                {folder === "inbox" && unreadCount > 0 ? (
                  <span className="ml-2 font-medium text-blue-600">
                    {unreadCount} unread
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                disabled={loadingList}
                onClick={() => void loadFolder(folder, true)}
                aria-label="Refresh emails"
                title="Refresh emails"
                className={cn(toolbarButtonClass, "h-8 px-2")}
              >
                <RefreshCw
                  className={cn("size-3.5", loadingList && "animate-spin")}
                  aria-hidden
                />
              </button>
            </div>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
            data-inbox-list
          >
            {loadingList && messages.length === 0 ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Loading
                emails…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Inbox className="mx-auto size-8 text-slate-300" aria-hidden />
                <p className="mt-3 text-sm font-medium text-slate-700">
                  {query.trim()
                    ? "No matching emails"
                    : folder === "archived"
                      ? "No archived emails"
                      : folder === "sent"
                        ? "No sent emails yet"
                        : "Your inbox is empty"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {query.trim()
                    ? "Try another sender, subject or phrase."
                    : folder === "archived"
                      ? "Emails you archive will appear here."
                      : folder === "sent"
                        ? "Emails you send will appear here."
                        : "New messages will appear here."}
                </p>
                {query.trim() ? (
                  <button
                    type="button"
                    className="mt-3 cursor-pointer text-sm font-medium text-blue-600 hover:underline"
                    onClick={() => setQuery("")}
                  >
                    Clear search
                  </button>
                ) : null}
              </div>
            ) : (
              filtered.map((message) => {
                const active = selectedId === message.id && !composing;
                const unread =
                  message.direction === "inbound" && !message.readAt;
                return (
                  <button
                    key={message.id}
                    type="button"
                    disabled={navigationBusy}
                    aria-current={active ? "true" : undefined}
                    onClick={() => selectMessage(message.id)}
                    className={cn(
                      "relative block w-full cursor-pointer border-b border-slate-100 px-4 py-4 text-left transition-colors hover:bg-slate-50",
                      active &&
                        "bg-blue-50/80 shadow-[inset_3px_0_0_#2563eb] hover:bg-blue-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          "min-w-0 truncate text-[13px] text-slate-700",
                          unread && "font-semibold text-slate-950",
                        )}
                        title={
                          folder === "sent"
                            ? message.toAddresses.join(", ")
                            : message.fromAddress
                        }
                      >
                        {folder === "sent"
                          ? message.toAddresses[0] || "Recipient"
                          : displaySender(message)}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                        {whenLabel(message.occurredAt)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-start gap-2">
                      {unread ? (
                        <span
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-600"
                          aria-label="Unread"
                        />
                      ) : null}
                      <p
                        className={cn(
                          "line-clamp-2 min-w-0 text-sm leading-5 text-slate-800",
                          unread ? "font-semibold" : "font-medium",
                        )}
                      >
                        {message.subject || "(no subject)"}
                      </p>
                    </div>
                    {message.preview ? (
                      <p className="mt-1.5 line-clamp-2 break-words text-[13px] leading-5 text-slate-500">
                        {message.preview}
                      </p>
                    ) : null}
                    {folder === "sent" ? (
                      <div className="mt-2">
                        <DeliveryStatusBadge
                          status={message.deliveryStatus}
                          compact
                        />
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
            {filtered.length > 0 ? (
              <p className="px-4 py-4 text-center text-[11px] text-slate-400">
                {query.trim()
                  ? "End of search results"
                  : `All ${messages.length} emails shown`}
              </p>
            ) : null}
          </div>
        </aside>

        <section
          aria-label={composing ? "Compose email" : "Email reader"}
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col bg-slate-50/70",
            readerOpen || composing ? "flex" : "hidden lg:flex",
          )}
        >
          {composing ? (
            <EmailComposer
              identities={identities}
              identity={activeIdentity}
              to={composeTo}
              subject={composeSubject}
              body={composeBody}
              busy={navigationBusy}
              sending={sending}
              checkingGrammar={checkingGrammar === "compose"}
              onIdentityChange={(key) => {
                if (key === identityKey) return;
                ++listRequestRef.current;
                ++messageRequestRef.current;
                setIdentityKey(key);
                setMessages([]);
                setSelectedId(null);
                setSelected(null);
                setNotice(null);
                setError(null);
              }}
              onToChange={setComposeTo}
              onSubjectChange={setComposeSubject}
              onBodyChange={setComposeBody}
              onClose={() => {
                setComposing(false);
                setReaderOpen(Boolean(selectedId));
              }}
              onDiscard={() => {
                setComposeTo("");
                setComposeSubject("");
                setComposeBody("");
                setComposing(false);
                setReaderOpen(Boolean(selectedId));
                setNotice(null);
                setError(null);
              }}
              onCheckGrammar={() => void checkGrammar("compose")}
              onSend={() => void sendNewEmail()}
            />
          ) : (
            <>
              <div className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setReaderOpen(false);
                      setExpandedReader(false);
                    }}
                    className={cn(toolbarButtonClass, "lg:hidden")}
                    aria-label="Back to email list"
                  >
                    <ArrowLeft className="size-4" aria-hidden />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                  {selected?.direction === "inbound" ? (
                    <>
                      <button
                        type="button"
                        disabled={
                          navigationBusy ||
                          (selected.senderBlocked &&
                            Boolean(selected.archivedAt))
                        }
                        onClick={() =>
                          void updateSelectedState({
                            archived: !selected.archivedAt,
                          })
                        }
                        className={toolbarButtonClass}
                        title={
                          selected.senderBlocked && selected.archivedAt
                            ? "Unblock the sender before restoring"
                            : undefined
                        }
                      >
                        {selected.archivedAt ? (
                          <ArchiveRestore className="size-4" aria-hidden />
                        ) : (
                          <Archive className="size-4" aria-hidden />
                        )}
                        {selected.archivedAt ? "Restore" : "Archive"}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          disabled={navigationBusy}
                          aria-label="More email actions"
                          className={toolbarButtonClass}
                        >
                          <MoreHorizontal className="size-5" aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-48">
                          <DropdownMenuItem
                            className="p-2.5"
                            onClick={() =>
                              void updateSelectedState({
                                read: !selected.readAt,
                              })
                            }
                          >
                            {selected.readAt ? (
                              <Mail className="size-4" aria-hidden />
                            ) : (
                              <MailOpen className="size-4" aria-hidden />
                            )}
                            {selected.readAt ? "Mark unread" : "Mark read"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="p-2.5"
                            variant={
                              selected.senderBlocked ? "default" : "destructive"
                            }
                            onClick={() => void updateSenderBlocked()}
                          >
                            <Ban className="size-4" aria-hidden />
                            {selected.senderBlocked
                              ? "Unblock sender"
                              : "Block sender"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  ) : (
                    <span className="px-2 text-xs text-slate-500">
                      {selected ? "Sent email" : "Select an email"}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {selectedIndex >= 0 ? (
                    <span className="mr-2 text-xs tabular-nums text-slate-500">
                      {selectedIndex + 1} of {filtered.length}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    disabled={selectedIndex <= 0 || navigationBusy}
                    onClick={() =>
                      selectMessage(filtered[selectedIndex - 1].id)
                    }
                    aria-label="Previous email"
                    title="Previous email"
                    className={toolbarButtonClass}
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={
                      selectedIndex < 0 ||
                      selectedIndex >= filtered.length - 1 ||
                      navigationBusy
                    }
                    onClick={() =>
                      selectMessage(filtered[selectedIndex + 1].id)
                    }
                    aria-label="Next email"
                    title="Next email"
                    className={toolbarButtonClass}
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedReader(!expandedReader)}
                    aria-label={
                      expandedReader ? "Show email list" : "Expand email"
                    }
                    title={expandedReader ? "Show email list" : "Expand email"}
                    className={cn(
                      toolbarButtonClass,
                      "ml-1 hidden lg:inline-flex",
                    )}
                  >
                    {expandedReader ? (
                      <Minimize2 className="size-4" aria-hidden />
                    ) : (
                      <Maximize2 className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {loadingMessage ? (
                <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  Opening email…
                </div>
              ) : selected ? (
                <>
                  <div
                    key={selected.id}
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
                    data-inbox-reader
                  >
                    <article className="mx-auto w-full max-w-[1000px] px-4 py-5 sm:px-6 sm:py-6">
                      <header className="mb-6">
                        <h2 className="break-words text-xl font-semibold leading-snug tracking-tight text-slate-950 sm:text-2xl">
                          {selected.subject || "(no subject)"}
                        </h2>
                        <div className="mt-5 flex items-start gap-3">
                          <span
                            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-600"
                            aria-hidden
                          >
                            {(selected.fromName || selected.fromAddress || "?")
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                              <p className="break-all text-sm font-semibold text-slate-900">
                                {selected.fromName || selected.fromAddress}
                              </p>
                              <time
                                dateTime={selected.occurredAt}
                                className="text-xs text-slate-500"
                              >
                                {fullWhenLabel(selected.occurredAt)}
                              </time>
                            </div>
                            <details className="mt-1 text-xs text-slate-500">
                              <summary className="cursor-pointer break-words leading-5 [overflow-wrap:anywhere]">
                                To{" "}
                                {selected.toAddresses.join(", ") ||
                                  activeIdentity.email}
                              </summary>
                              <dl className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 [overflow-wrap:anywhere]">
                                <div>
                                  <dt className="inline font-medium text-slate-700">
                                    From:{" "}
                                  </dt>
                                  <dd className="inline">
                                    {selected.fromName
                                      ? `${selected.fromName} <${selected.fromAddress}>`
                                      : selected.fromAddress}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="inline font-medium text-slate-700">
                                    To:{" "}
                                  </dt>
                                  <dd className="inline">
                                    {selected.toAddresses.join(", ")}
                                  </dd>
                                </div>
                                {selected.ccAddresses.length > 0 ? (
                                  <div>
                                    <dt className="inline font-medium text-slate-700">
                                      Cc:{" "}
                                    </dt>
                                    <dd className="inline">
                                      {selected.ccAddresses.join(", ")}
                                    </dd>
                                  </div>
                                ) : null}
                                {selected.replyToAddresses.length > 0 ? (
                                  <div>
                                    <dt className="inline font-medium text-slate-700">
                                      Reply to:{" "}
                                    </dt>
                                    <dd className="inline">
                                      {selected.replyToAddresses.join(", ")}
                                    </dd>
                                  </div>
                                ) : null}
                              </dl>
                            </details>
                          </div>
                        </div>
                        {selected.senderBlocked ? (
                          <p className="mt-3 text-xs text-red-700">
                            This sender is blocked. New emails from this address
                            go to Archived.
                          </p>
                        ) : null}
                      </header>
                      {selected.direction === "outbound" ? (
                        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-center gap-4">
                            {deliveryStages(selected).map((stage) => (
                              <span
                                key={stage.label}
                                className={cn(
                                  "flex items-center gap-1.5 text-xs",
                                  stage.complete
                                    ? "font-medium text-slate-700"
                                    : "text-slate-400",
                                )}
                              >
                                <CheckCircle2
                                  className={cn(
                                    "size-4",
                                    stage.complete && "text-emerald-600",
                                  )}
                                  aria-hidden
                                />
                                {stage.label}
                              </span>
                            ))}
                            <DeliveryStatusBadge
                              status={selected.deliveryStatus}
                            />
                          </div>
                          {deliveryFailed(selected.deliveryStatus) ? (
                            <p className="mt-3 text-sm text-red-700">
                              This email was not delivered successfully.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      <EmailMessageBody
                        key={selected.id}
                        html={selected.htmlBody}
                        text={selected.textBody}
                        stripOpenTrackingPixel={
                          selected.direction === "outbound"
                        }
                      />
                      {selected.attachments.length > 0 ? (
                        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                          <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                            <Paperclip className="size-4" aria-hidden />
                            {selected.attachments.length} attachment
                            {selected.attachments.length === 1 ? "" : "s"}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selected.attachments.map((attachment, index) => (
                              <span
                                key={String(attachment.id ?? index)}
                                className="max-w-full break-all rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600"
                              >
                                {String(
                                  attachment.filename ??
                                    attachment.name ??
                                    `Attachment ${index + 1}`,
                                )}
                              </span>
                            ))}
                          </div>
                          <p className="mt-3 text-xs leading-5 text-slate-500">
                            Attachments are quarantined until their file type
                            and malware scan are cleared.
                          </p>
                        </div>
                      ) : null}
                      {selected.replies.length > 0 ? (
                        <section
                          className="mt-7 border-t border-slate-200 pt-5"
                          aria-label="Sent replies"
                        >
                          <h3 className="text-sm font-semibold text-slate-800">
                            Sent replies{" "}
                            <span className="ml-1 font-normal text-slate-400">
                              {selected.replies.length}
                            </span>
                          </h3>
                          <div className="mt-3 space-y-3">
                            {selected.replies.map((sent) => (
                              <button
                                type="button"
                                key={sent.id}
                                disabled={navigationBusy}
                                onClick={() => selectMessage(sent.id)}
                                className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300"
                              >
                                <span className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                                  <span className="font-medium text-slate-700">
                                    {sent.fromName || activeIdentity.name} →{" "}
                                    {sent.toAddresses[0] || "recipient"}
                                  </span>
                                  <span>{fullWhenLabel(sent.occurredAt)}</span>
                                </span>
                                <span className="mt-2 block line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                  {sent.preview}
                                </span>
                                <span className="mt-2 block text-xs font-medium text-blue-600">
                                  Read full reply →
                                </span>
                              </button>
                            ))}
                          </div>
                        </section>
                      ) : null}
                    </article>
                  </div>
                  {selected.direction === "inbound" && !selected.archivedAt ? (
                    <div className="max-h-[50%] shrink-0 overflow-y-auto border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                      {replyOpen ? (
                        <div className="mx-auto max-w-[950px]">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <label
                              htmlFor="inbox-reply"
                              className="min-w-0 truncate text-xs font-medium text-slate-600"
                            >
                              Reply to{" "}
                              {selected.replyToAddresses[0] ||
                                selected.fromAddress}
                            </label>
                            <button
                              type="button"
                              className={cn(toolbarButtonClass, "h-7 px-1")}
                              onClick={() => setReplyOpen(false)}
                              aria-label="Minimize reply"
                            >
                              <ChevronDown className="size-4" aria-hidden />
                            </button>
                          </div>
                          <textarea
                            id="inbox-reply"
                            autoFocus
                            value={reply}
                            disabled={sending || checkingGrammar === "reply"}
                            onChange={(event) => {
                              setReply(event.target.value);
                              replyDraftsRef.current.set(
                                selected.id,
                                event.target.value,
                              );
                            }}
                            maxLength={20_000}
                            rows={4}
                            placeholder="Write your reply…"
                            className={cn(
                              fieldClass,
                              "min-h-24 resize-y leading-6",
                            )}
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              disabled={
                                checkingGrammar !== null ||
                                navigationBusy ||
                                !reply.trim()
                              }
                              onClick={() => void checkGrammar("reply")}
                              className={toolbarButtonClass}
                            >
                              {checkingGrammar === "reply" ? (
                                <Loader2
                                  className="size-4 animate-spin"
                                  aria-hidden
                                />
                              ) : (
                                <Sparkles className="size-4" aria-hidden />
                              )}
                              {checkingGrammar === "reply"
                                ? "Checking…"
                                : "Check grammar"}
                            </button>
                            <button
                              type="button"
                              disabled={navigationBusy || !reply.trim()}
                              onClick={() => void sendReply()}
                              className={cn(
                                adminPrimaryButtonClass,
                                "rounded-lg py-2",
                              )}
                            >
                              <Send className="size-4" aria-hidden />
                              {sending ? "Sending…" : "Send reply"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setReplyOpen(true)}
                            className={cn(
                              adminSecondaryButtonClass,
                              "rounded-lg px-4 py-2",
                            )}
                          >
                            <Reply className="size-4" aria-hidden />
                            {reply.trim() ? "Continue reply" : "Reply"}
                          </button>
                          <p className="min-w-0 truncate text-xs text-slate-500">
                            Reply as {activeIdentity.email}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
                  <div>
                    <span className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400">
                      <MailOpen className="size-7" aria-hidden />
                    </span>
                    <p className="mt-5 text-base font-semibold text-slate-700">
                      Select an email to read
                    </p>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                      Choose an email from the list, or start a new
                      conversation.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
