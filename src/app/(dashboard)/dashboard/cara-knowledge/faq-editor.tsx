"use client";
import { UnsavedDraftGuard } from "@/components/dashboard/unsaved-draft-guard";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ArrowLeft, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/dashboard/field";
import { FormFeedback } from "@/components/ui/form-feedback";
import type { AgentFaq } from "../agent-setup/agent-faqs";
import { saveKnowledgeFaq } from "./faq-actions";
export function FaqEditor({
  initialFaqs,
  initialVersion,
}: {
  initialFaqs: AgentFaq[];
  initialVersion: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [faqs, setFaqs] = useState(initialFaqs),
    [version, setVersion] = useState(initialVersion),
    [draft, setDraft] = useState<AgentFaq | null>(null),
    [original, setOriginal] = useState<string | undefined>(),
    [error, setError] = useState<string | null>(null),
    [href, setHref] = useState<string | null>(null),
    [pending, start] = useTransition(),
    [discard, setDiscard] = useState(false),
    [deleting, setDeleting] = useState(false);

  const originalFaq = faqs.find((f) => f.question === original);
  const dirty = Boolean(
    draft &&
      JSON.stringify(draft) !==
        JSON.stringify(originalFaq ?? { question: "", answer: "" }),
  );
  function close() {
    if (pending) return;
    if (dirty) {
      setDiscard(true);
      return;
    }
    setOpen(false);
    setDraft(null);
  }
  function save(remove = false) {
    setError(null);
    setHref(null);
    start(async () => {
      try {
        const r = await saveKnowledgeFaq({
          version,
          originalQuestion: original,
          faq: draft ?? undefined,
          remove,
        });
        if (!r.ok) {
          setDeleting(false);
          setError(r.message);
          setHref("href" in r ? (r.href ?? null) : null);
          return;
        }
        setFaqs(r.faqs);
        setVersion(r.version);
        setDraft(null);
        setOriginal(undefined);
        setDeleting(false);
        router.refresh();
      } catch {
        setDeleting(false);
        setError("We couldn’t save this answer. Please try again.");
      }
    });
  }
  return (
    <>
      <UnsavedDraftGuard dirty={dirty && !pending} />
      <Button
        variant="outline"
        className="min-h-11"
        onClick={() => {
          setFaqs(initialFaqs);
          setVersion(initialVersion);
          setOpen(true);
          setError(null);
        }}
      >
        FAQs & policies
      </Button>
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[90dvh] flex-col sm:max-w-xl"
        >
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close answers"
              onClick={close}
            >
              <ArrowLeft />
            </Button>
            <div>
              <DialogTitle>FAQs & policies</DialogTitle>
              <DialogDescription className="mt-2">
                Approved answers Cara can use on calls. Keep prices and
                durations in Services, and hours in Your business.
              </DialogDescription>
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto">
            <FormFeedback message={error} focusOnError />
            {href && (
              <Link className="my-3 block text-sm no-underline" href={href}>
                Open the relevant section →
              </Link>
            )}
            {draft ? (
              <form
                id="faq-editor"
                className="mt-4 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  save();
                }}
              >
                <fieldset disabled={pending} className="space-y-4">
                  <Field label="Question" htmlFor="faq-question">
                    <Textarea
                      id="faq-question"
                      rows={2}
                      maxLength={1000}
                      value={draft.question}
                      onChange={(e) => {
                        setDraft({ ...draft, question: e.target.value });
                        setError(null);
                      }}
                    />
                  </Field>
                  <Field label="Answer for callers" htmlFor="faq-answer">
                    <Textarea
                      id="faq-answer"
                      rows={5}
                      maxLength={1000}
                      value={draft.answer}
                      onChange={(e) => {
                        setDraft({ ...draft, answer: e.target.value });
                        setError(null);
                      }}
                    />
                  </Field>
                  <p className="text-xs leading-5 text-[#6b7c75]">
                    State the facts, conditions and exceptions clearly. This
                    answer will be available on future calls.
                  </p>
                </fieldset>
              </form>
            ) : (
              <div className="mt-4 space-y-2">
                {faqs.map((f) => (
                  <button
                    key={f.question}
                    className="w-full rounded-xl border border-[#d9e2dd] p-4 text-left text-sm hover:bg-[#f5f8f6]"
                    onClick={() => {
                      setDraft(f);
                      setOriginal(f.question);
                      setError(null);
                    }}
                  >
                    <p className="font-semibold">{f.question}</p>
                    <p className="mt-1 line-clamp-2 text-[#5b6b65]">
                      {f.answer}
                    </p>
                  </button>
                ))}
                {!faqs.length && (
                  <p className="py-5 text-sm text-[#5b6b65]">
                    Add the questions customers regularly ask, including your
                    business policies.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap justify-between gap-3 border-t border-[#d9e2dd] pt-4">
            {draft ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDeleting(true)}
                  disabled={pending || !original}
                >
                  <Trash2 className="size-4" />
                  Remove answer
                </Button>
                <Button
                  key="save-faq"
                  form="faq-editor"
                  type="submit"
                  disabled={pending}
                >
                  {pending ? "Updating Cara…" : "Save answer"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={close}>
                  Done
                </Button>
                <Button
                  key="add-faq"
                  type="button"
                  onClick={() => {
                    setDraft({ question: "", answer: "" });
                    setOriginal(undefined);
                    setError(null);
                  }}
                >
                  <Plus className="size-4" />
                  Add answer
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={discard || deleting}
        onOpenChange={() => {
          setDiscard(false);
          setDeleting(false);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {deleting ? "Remove this answer?" : "Discard these edits?"}
          </DialogTitle>
          <DialogDescription>
            {deleting
              ? "Cara will no longer use this FAQ on future calls."
              : "Your saved answers will stay as they are."}
          </DialogDescription>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setDiscard(false);
                setDeleting(false);
              }}
            >
              Keep editing
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                if (deleting) {
                  save(true);
                } else {
                  setDiscard(false);
                  setOpen(false);
                  setDraft(null);
                }
              }}
            >
              {deleting ? "Remove" : "Discard edits"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
