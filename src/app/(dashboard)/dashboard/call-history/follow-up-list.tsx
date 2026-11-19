"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { updateFollowUp } from "./follow-up-actions";
function FollowUpSummary({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return;
    const measure = () => setClipped(element.scrollHeight > element.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [text, expanded]);
  return <>
    <p ref={textRef} className={`mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#475b52] ${expanded ? "max-h-60 overflow-y-auto" : "line-clamp-3"}`}>{text}</p>
    {(clipped || expanded) && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="mt-2 min-h-11 cursor-pointer rounded-lg border border-[#d9e2dd] px-3 text-xs font-medium transition-colors hover:bg-[#f3f6f4]">{expanded ? "Show less" : "Read full summary"}</button>}
  </>;
}

export function FollowUpList({
  items,
  selectedId,
  canManage,
  status: filterStatus,
}: {
  items: {
    id: string;
    caller_name: string | null;
    caller_number: string;
    summary: string;
    status: string;
    created_at: string;
    callHref: string | null;
  }[];
  selectedId?: string;
  canManage: boolean;
  status: "open" | "resolved";
}) {
  const [error, setError] = useState<string | null>(null),
    [pending, start] = useTransition(),
    [changed, setChanged] = useState<Record<string, string>>({});
  const router = useRouter();
  return (
    <div className="space-y-3">
      <FormFeedback message={error} />
      {items.length === 0 && (
        <div className="rounded-xl border border-[#d9e2dd] bg-white p-10 text-center">
          <Check className="mx-auto mb-3 size-6" />
          <h2 className="font-semibold">
            {filterStatus === "resolved"
              ? "No completed follow-ups yet"
              : "You’re up to date"}
          </h2>
          <p className="mt-2 text-sm text-[#5b6b65]">
            {filterStatus === "resolved"
              ? "Completed enquiries stay here so you can review or reopen them."
              : "New enquiries that need a response will appear here."}
          </p>
        </div>
      )}
      {items.map((item) => {
        const status = changed[item.id] ?? item.status;
        return (
          <article
            key={item.id}
            id={`ticket-${item.id}`}
            className={`rounded-xl border bg-white p-5 ${selectedId === item.id ? "border-[#657b71] ring-1 ring-[#657b71]" : "border-[#d9e2dd]"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="min-w-0 break-words font-semibold">
                {item.caller_name || item.caller_number || "Caller"}
              </h2>
              <time className="text-xs text-[#6b7c75]">
                {new Date(item.created_at).toLocaleString("en-IE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </div>
            <FollowUpSummary text={item.summary} />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {item.callHref && (
                <Link
                  className="min-h-11 rounded-lg border border-[#d9e2dd] px-4 py-3 text-sm"
                  href={item.callHref}
                >
                  <Phone className="mr-2 inline size-4" />
                  View call
                </Link>
              )}
              {canManage && (
                <Button
                  disabled={pending}
                  variant="outline"
                  className="min-h-11 rounded-lg px-4"
                  onClick={() => {
                    setError(null);
                    start(async () => {
                      try {
                        const result = await updateFollowUp(
                          item.id,
                          status === "open" ? "resolved" : "open",
                        );
                        if (!result.ok) {
                          setError(result.message);
                          return;
                        }
                        setChanged((previous) => ({
                          ...previous,
                          [item.id]: status === "open" ? "resolved" : "open",
                        }));
                        router.refresh();
                      } catch {
                        setError(
                          "We couldn’t update this follow-up. Please try again.",
                        );
                      }
                    });
                  }}
                >
                  {status === "open" ? (
                    <Check className="size-4" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  {status === "open" ? "Mark as done" : "Reopen"}
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
