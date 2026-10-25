"use client";

import Link from "next/link";
import { FileText, Pencil, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { BusinessFileSetupDialog } from "./business-file-setup-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DASHBOARD_ICON_CHIP_MD,
  DASHBOARD_ICON_GLYPH_MD,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  BUSINESS_FILE_KINDS,
  BUSINESS_FILE_KIND_LABELS,
  businessFileDisplayTitle,
  formatBusinessFileDate,
  formatBusinessFileSize,
  businessFileKindLabel,
  fileSupportsAnswerToggle,
  isBusinessFileKind,
  isSpreadsheetFileType,
  type BusinessFileKind,
  type BusinessFileListItem,
} from "@/lib/business-files";
import {
  extractedContentLooksLikePii,
  sliceFileTextForPrompt,
} from "@/lib/business-file-preview";
import {
  fileCouldNotReadMessage,
  fileReadinessLabel,
  fileScannedPdfOcrHint,
} from "@/lib/answers-boundary";
import { cn } from "@/lib/utils";
import {
  SEND_ONLY_CATALOG_OVERLAP_NOTE,
  SEND_ONLY_FAQ_OVERLAP_NOTE,
  showSendOnlyOverlapNote,
} from "@/lib/knowledge-precedence";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

type UploadResult =
  | { ok: true; file?: BusinessFileListItem; overlapSendOnlyDefault?: boolean }
  | { ok: false; message: string };

type ActionResult =
  | { ok: true; file?: BusinessFileListItem }
  | { ok: false; message: string };

function FileUnreadableNotice({ fileType }: { fileType: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[12.5px] leading-relaxed text-amber-900">
        {fileCouldNotReadMessage(fileType)}
      </p>
      {fileType === "pdf" ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-[12px] leading-relaxed text-amber-950">
          {fileScannedPdfOcrHint()}
        </p>
      ) : null}
    </div>
  );
}

type BusinessFilesSectionProps = {
  initialFiles: BusinessFileListItem[];
  variant?: "dashboard" | "onboarding";
  hasServiceCatalog?: boolean;
  hasFaqs?: boolean;
  /** Call flow has send-link or send-file — required to enable "send to callers". */
  sendConfigured?: boolean;
  onUpload: (formData: FormData) => Promise<UploadResult>;
  onToggle: (
    id: string,
    patch: { answerEnabled?: boolean; sendEnabled?: boolean },
  ) => Promise<ActionResult>;
  onUpdateMetadata: (
    fileId: string,
    patch: {
      title: string;
      documentKind: BusinessFileKind;
      caraDescription: string;
      whenToUse: string;
    },
  ) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
  /** Notified whenever the file list changes (upload, toggle, delete). */
  onFilesChange?: (files: BusinessFileListItem[]) => void;
};

export function BusinessFilesSection({
  initialFiles,
  variant = "dashboard",
  hasServiceCatalog = false,
  hasFaqs = false,
  sendConfigured = false,
  onUpload,
  onToggle,
  onUpdateMetadata,
  onDelete,
  onFilesChange,
}: BusinessFilesSectionProps) {
  const [files, setFiles] = useState(initialFiles);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [setupContext, setSetupContext] = useState<{
    file: BusinessFileListItem;
    isNewUpload: boolean;
  } | null>(null);
  const [replacePrompt, setReplacePrompt] = useState<{
    file: File;
    existing: BusinessFileListItem;
  } | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [documentKind, setDocumentKind] = useState<BusinessFileKind | "">("");
  const [piiDismissed, setPiiDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onboarding = variant === "onboarding";

  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  function runUpload(file: File, options?: { skipReplaceCheck?: boolean }) {
    setMessage(null);

    if (!documentKind) {
      setMessage("Choose a document type before uploading.");
      return;
    }

    const existing = files.find((f) => f.documentKind === documentKind);
    if (existing && !options?.skipReplaceCheck) {
      setReplacePrompt({ file, existing });
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("documentKind", documentKind);
    startTransition(async () => {
      const res = await onUpload(formData);
      if (res.ok && res.file) {
        const uploaded = res.file;
        setFiles((prev) => {
          const next = [uploaded, ...prev];
          onFilesChange?.(next);
          return next;
        });

        const hasText = Boolean(uploaded.extractedText?.trim());
        if (
          hasText &&
          !piiDismissed &&
          extractedContentLooksLikePii(uploaded.extractedText ?? "")
        ) {
          setMessage(
            "This file may contain personal contact details — only upload what Cara genuinely needs on calls.",
          );
        } else {
          setMessage(null);
        }

        setSetupContext({ file: uploaded, isNewUpload: true });
      } else if (!res.ok) {
        setMessage(res.message);
      }
    });
  }

  function toggle(
    id: string,
    patch: { answerEnabled?: boolean; sendEnabled?: boolean },
  ) {
    setMessage(null);
    startTransition(async () => {
      const res = await onToggle(id, patch);
      if (res.ok) {
        setFiles((prev) => {
          const next = prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  answerEnabled: patch.answerEnabled ?? f.answerEnabled,
                  sendEnabled: patch.sendEnabled ?? f.sendEnabled,
                }
              : f,
          );
          onFilesChange?.(next);
          return next;
        });
      } else {
        setMessage(res.message);
      }
    });
  }

  function confirmRemove() {
    if (!removeId) return;
    const id = removeId;
    setMessage(null);
    startTransition(async () => {
      const res = await onDelete(id);
      if (res.ok) {
        setFiles((prev) => {
          const next = prev.filter((f) => f.id !== id);
          onFilesChange?.(next);
          return next;
        });
        setRemoveId(null);
      } else {
        setMessage(res.message);
      }
    });
  }

  const uploadControls = (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div
          className={cn(
            "w-full shrink-0",
            onboarding ? "min-w-0 sm:max-w-xs" : "sm:w-44",
          )}
        >
          <label className="block space-y-1">
            <span
              className={cn(
                "text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400",
                onboarding && "text-[12px] normal-case tracking-normal text-[#0b1220]",
              )}
            >
              Document type
            </span>
            <select
              id="documentKind"
              value={documentKind}
              onChange={(event) => {
                const value = event.target.value;
                setDocumentKind(isBusinessFileKind(value) ? value : "");
              }}
              className={cn(
                "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-[#0b1220]",
                onboarding && "h-10 px-3",
              )}
            >
              <option value="">Choose type…</option>
              {BUSINESS_FILE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {BUSINESS_FILE_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".pdf,.csv,.xlsx,.xls,.txt,application/pdf,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) runUpload(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            disabled={pending || !documentKind}
            onClick={() => inputRef.current?.click()}
            className="h-9 w-fit shrink-0 rounded-xl bg-[#0b1220] px-3 text-[12px] font-medium text-white hover:bg-[#0b1220]/90 disabled:opacity-50"
          >
            <Upload className="size-3.5" aria-hidden />
            Upload file
          </Button>
          <p className="text-[12px] text-slate-500">
            {documentKind
              ? "PDF, CSV, XLSX, or TXT · max 10 MB"
              : "Choose a document type first"}
          </p>
        </div>
      </div>
      <p className="text-[12px] leading-relaxed text-slate-500">
        Don&apos;t upload documents containing customer or staff personal details
        — Cara may read from this on calls.
      </p>
    </div>
  );

  return (
    <div className={cn("space-y-3", onboarding && "space-y-4")}>
      {onboarding ? (
        <div className="rounded-xl border border-slate-200/75 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.06)]">
          <p className="text-[13px] font-semibold text-[#0b1220]">How files are used</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
            {hasServiceCatalog || hasFaqs ? (
              <>
                Upload brochures, stock sheets, or other documents Cara can send to
                callers. For services, prices, and common questions, use your{" "}
                {hasServiceCatalog ? (
                  <Link
                    href={DASHBOARD_ROUTES.businessServices}
                    className="font-medium underline underline-offset-2"
                  >
                    Services menu
                  </Link>
                ) : null}
                {hasServiceCatalog && hasFaqs ? " and " : null}
                {hasFaqs ? (
                  <Link
                    href={DASHBOARD_ROUTES.businessFaqs}
                    className="font-medium underline underline-offset-2"
                  >
                    FAQ answers
                  </Link>
                ) : null}{" "}
                instead of duplicating them in files.
              </>
            ) : (
              <>
                Upload price lists, menus, brochures, stock sheets, service sheets, or
                FAQ documents. Each file can help Cara answer questions, be sent to
                callers, or both.
              </>
            )}
          </p>
        </div>
      ) : null}

      {uploadControls}

      {message ? (
        <p className="text-[12px] text-red-600" role="alert">
          {message}
        </p>
      ) : null}

      {files.length === 0 ? (
        <div
          className={cn(
            "rounded-xl border border-dashed px-4",
            onboarding
              ? "border-slate-300/90 bg-white/80 py-6 text-center"
              : "border-slate-300 bg-slate-50/40 py-4",
          )}
        >
          <p className="text-[13px] font-medium text-[#0b1220]">No files uploaded yet</p>
          <p
            className={cn(
              "mt-1 text-[12px] leading-relaxed text-slate-500",
              !onboarding && "max-w-xl",
            )}
          >
            {hasServiceCatalog || hasFaqs ? (
              <>
                Upload brochures, stock sheets, or other documents. For services and
                prices, use your{" "}
                <Link
                  href={DASHBOARD_ROUTES.businessServices}
                  className="font-medium underline underline-offset-2"
                >
                  Services menu
                </Link>
                {hasFaqs ? (
                  <>
                    ; for common questions, use{" "}
                    <Link
                      href={DASHBOARD_ROUTES.businessFaqs}
                      className="font-medium underline underline-offset-2"
                    >
                      FAQs
                    </Link>
                  </>
                ) : null}
                .
              </>
            ) : (
              <>
                Add a price list, menu, brochure, stock sheet, service sheet, or FAQ
                document.
              </>
            )}
          </p>
        </div>
      ) : (
        <ul
          className={cn(
            "space-y-2",
            onboarding && "space-y-3",
          )}
        >
          {files.map((file) => (
            <BusinessFileRow
              key={file.id}
              file={file}
              pending={pending}
              sendConfigured={sendConfigured}
              hasServiceCatalog={hasServiceCatalog}
              hasFaqs={hasFaqs}
              onToggle={toggle}
              onEdit={() => setSetupContext({ file, isNewUpload: false })}
              onRemove={setRemoveId}
            />
          ))}
        </ul>
      )}

      <BusinessFileSetupDialog
        context={setupContext}
        onOpenChange={(open) => {
          if (!open) setSetupContext(null);
        }}
        onSave={async (fileId, patch) => {
          const result = await onUpdateMetadata(fileId, patch);
          if (result.ok) {
            setFiles((prev) => {
              const next = prev.map((file) => {
                if (file.id !== fileId) return file;
                if ("file" in result && result.file) return result.file;
                return {
                  ...file,
                  title: patch.title,
                  documentKind: patch.documentKind,
                  caraDescription: patch.caraDescription || null,
                  whenToUse: patch.whenToUse || null,
                };
              });
              onFilesChange?.(next);
              return next;
            });
          }
          return result;
        }}
        onCancelUpload={async (fileId) => {
          const result = await onDelete(fileId);
          if (result.ok) {
            setFiles((prev) => {
              const next = prev.filter((file) => file.id !== fileId);
              onFilesChange?.(next);
              return next;
            });
            setSetupContext(null);
          } else {
            setMessage(result.message);
          }
        }}
      />

      <Dialog
        open={replacePrompt !== null}
        onOpenChange={(open) => !open && setReplacePrompt(null)}
      >
        <DialogContent className="gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-md">
          <DialogHeader className="space-y-0 px-5 pt-5 text-left">
            <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
              {replacePrompt?.existing.documentKind
                ? `Replace your existing ${businessFileKindLabel(replacePrompt.existing.documentKind as BusinessFileKind)?.toLowerCase() ?? "file"}?`
                : "Replace existing file?"}
            </DialogTitle>
            <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
              Replace removes the older file from Cara&apos;s knowledge, or keep
              both if you need overlapping documents.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (!replacePrompt) return;
                const { file } = replacePrompt;
                setReplacePrompt(null);
                runUpload(file, { skipReplaceCheck: true });
              }}
              className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
            >
              Keep both
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!replacePrompt) return;
                const { file, existing } = replacePrompt;
                setReplacePrompt(null);
                startTransition(async () => {
                  const del = await onDelete(existing.id);
                  if (!del.ok) {
                    setMessage(del.message);
                    return;
                  }
                  setFiles((prev) => prev.filter((f) => f.id !== existing.id));
                  runUpload(file, { skipReplaceCheck: true });
                });
              }}
              className={DASHBOARD_PRIMARY_BUTTON_CLASS}
            >
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeId !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null);
        }}
        title="Remove this file?"
        description="Routes using it will need a new file."
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        pending={pending}
        destructive
      />
    </div>
  );
}

function BusinessFileRow({
  file,
  pending,
  sendConfigured,
  hasServiceCatalog,
  hasFaqs,
  onToggle,
  onEdit,
  onRemove,
}: {
  file: BusinessFileListItem;
  pending: boolean;
  sendConfigured: boolean;
  hasServiceCatalog: boolean;
  hasFaqs: boolean;
  onToggle: (
    id: string,
    patch: { answerEnabled?: boolean; sendEnabled?: boolean },
  ) => void;
  onEdit: () => void;
  onRemove: (id: string) => void;
}) {
  const canAnswer = fileSupportsAnswerToggle(file);
  const status = fileReadinessLabel(file);
  const promptSlice = sliceFileTextForPrompt(file.extractedText);
  const truncated = promptSlice?.wasTruncated;
  const kindLabel = businessFileKindLabel(file.documentKind);
  const displayTitle = businessFileDisplayTitle(file);
  const needsSetup = !file.title?.trim();
  const sendOnlyOverlap = showSendOnlyOverlapNote({
    file,
    hasServiceCatalog,
    hasFaqs,
  });
  const showFileName =
    displayTitle.toLowerCase() !==
    file.fileName.replace(/\.[^.]+$/, "").trim().toLowerCase();

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <span className={DASHBOARD_ICON_CHIP_MD}>
          <FileText className={DASHBOARD_ICON_GLYPH_MD} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[#0b1220]">
                {displayTitle}
              </p>
              {showFileName ? (
                <p className="truncate text-[11.5px] text-slate-500">
                  {file.fileName}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={onEdit}
                aria-label={`Edit ${displayTitle}`}
                className="size-8 p-0 text-slate-500 hover:text-slate-800"
              >
                <Pencil className="size-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => onRemove(file.id)}
                aria-label={`Remove ${displayTitle}`}
                className="size-8 p-0 text-slate-500 hover:text-slate-800"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {kindLabel ? (
              <StatusPill className="border-slate-300/70 bg-white text-[10px]">
                {kindLabel}
              </StatusPill>
            ) : null}
            {needsSetup ? (
              <StatusPill className="border-amber-300/80 bg-amber-50 text-[10px] text-amber-900">
                Needs setup
              </StatusPill>
            ) : null}
            <StatusPill className="border-slate-300/70 bg-white text-[10px]">
              {file.fileType.toUpperCase()}
            </StatusPill>
            <StatusPill className="border-slate-300/70 bg-white text-[10px]">
              {status}
            </StatusPill>
            {truncated ? (
              <StatusPill className="border-slate-300/70 bg-slate-50 text-[10px] text-slate-600">
                Lookup on calls
              </StatusPill>
            ) : null}
            <span className="text-[11px] text-slate-400">
              {formatBusinessFileDate(file.createdAt)} ·{" "}
              {formatBusinessFileSize(file.sizeBytes)}
            </span>
          </div>

          {file.whenToUse?.trim() ? (
            <p className="mt-1.5 line-clamp-1 text-[11.5px] text-slate-600">
              {file.whenToUse.trim()}
            </p>
          ) : null}

          {!canAnswer ? (
            <div className="mt-2 text-[11px] leading-relaxed">
              <FileUnreadableNotice fileType={file.fileType} />
            </div>
          ) : null}

          {sendOnlyOverlap ? (
            <p className="mt-2 rounded-lg border border-sky-200/80 bg-sky-50/70 px-3 py-2 text-[11.5px] leading-relaxed text-sky-950">
              {sendOnlyOverlap === "faqs"
                ? SEND_ONLY_FAQ_OVERLAP_NOTE
                : SEND_ONLY_CATALOG_OVERLAP_NOTE}
            </p>
          ) : null}

          {isSpreadsheetFileType(file.fileType) ? (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Re-upload when stock or prices change often.
            </p>
          ) : null}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label
              className={cn(
                "flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2",
                !canAnswer && "opacity-60",
              )}
            >
              <Switch
                checked={file.answerEnabled}
                disabled={pending || !canAnswer}
                onCheckedChange={(checked) =>
                  onToggle(file.id, { answerEnabled: checked })
                }
                aria-label="Cara can answer from this"
                className="data-checked:bg-[#0b1220]"
              />
              <span className="text-[11.5px] leading-snug text-slate-700">
                <span className="font-medium text-[#0b1220]">Cara reads from this</span>
              </span>
            </label>
            <label
              className={cn(
                "flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2",
                !sendConfigured && "opacity-60",
              )}
            >
              <Switch
                checked={file.sendEnabled}
                disabled={pending || !sendConfigured || !canAnswer}
                onCheckedChange={(checked) =>
                  onToggle(file.id, { sendEnabled: checked })
                }
                aria-label="Cara can send this to callers"
                className="data-checked:bg-[#0b1220]"
              />
              <span className="text-[11.5px] leading-snug text-slate-700">
                <span className="font-medium text-[#0b1220]">Send to callers</span>
                {!sendConfigured ? (
                  <>
                    {" · "}
                    <Link
                      href="/dashboard/routing"
                      className="font-medium text-[#0b1220] underline underline-offset-2"
                    >
                      Call flow
                    </Link>
                  </>
                ) : null}
              </span>
            </label>
          </div>
        </div>
      </div>
    </li>
  );
}
