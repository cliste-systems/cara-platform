"use client";

import { useEffect, useState, useTransition } from "react";

import {
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BUSINESS_FILE_KINDS,
  BUSINESS_FILE_KIND_LABELS,
  caraDescriptionPlaceholder,
  defaultBusinessFileTitle,
  isBusinessFileKind,
  whenToUsePlaceholder,
  type BusinessFileKind,
  type BusinessFileListItem,
} from "@/lib/business-files";
import { cn } from "@/lib/utils";

type SetupContext = {
  file: BusinessFileListItem;
  isNewUpload: boolean;
};

type Props = {
  context: SetupContext | null;
  onOpenChange: (open: boolean) => void;
  onSave: (
    fileId: string,
    patch: {
      title: string;
      documentKind: BusinessFileKind;
      caraDescription: string;
      whenToUse: string;
    },
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  onCancelUpload?: (fileId: string) => Promise<void>;
};

export function BusinessFileSetupDialog({
  context,
  onOpenChange,
  onSave,
  onCancelUpload,
}: Props) {
  const [title, setTitle] = useState("");
  const [documentKind, setDocumentKind] = useState<BusinessFileKind | "">("");
  const [caraDescription, setCaraDescription] = useState("");
  const [whenToUse, setWhenToUse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fileToEdit = context;
  const [lastFileToEdit, setLastFileToEdit] = useState<typeof fileToEdit | undefined>(undefined);
  if (lastFileToEdit !== fileToEdit) {
    setLastFileToEdit(fileToEdit);
    if (context) {
      const { file } = context;
      const kind =
        file.documentKind && isBusinessFileKind(file.documentKind)
          ? file.documentKind
          : "";
      setTitle(file.title?.trim() || defaultBusinessFileTitle(file.fileName));
      setDocumentKind(kind);
      setCaraDescription(
        file.caraDescription?.trim() || caraDescriptionPlaceholder(kind || null),
      );
      setWhenToUse(file.whenToUse?.trim() || whenToUsePlaceholder(kind || null));
      setError(null);
    }
  }

  if (!context) return null;

  const { file, isNewUpload } = context;
  const kind = documentKind || null;

  function handleDocumentKindChange(next: BusinessFileKind) {
    const previousKind =
      file.documentKind && isBusinessFileKind(file.documentKind)
        ? file.documentKind
        : null;
    setDocumentKind(next);
    setCaraDescription((current) => {
      const previousPlaceholder = caraDescriptionPlaceholder(previousKind);
      if (!current.trim() || current.trim() === previousPlaceholder.trim()) {
        return caraDescriptionPlaceholder(next);
      }
      return current;
    });
    setWhenToUse((current) => {
      const previousPlaceholder = whenToUsePlaceholder(previousKind);
      if (!current.trim() || current.trim() === previousPlaceholder.trim()) {
        return whenToUsePlaceholder(next);
      }
      return current;
    });
  }

  function handleSave() {
    setError(null);
    if (!documentKind) {
      setError("Choose what type of document this is.");
      return;
    }
    startTransition(async () => {
      const result = await onSave(file.id, {
        title: title.trim(),
        documentKind,
        caraDescription: caraDescription.trim(),
        whenToUse: whenToUse.trim(),
      });
      if (result.ok) {
        onOpenChange(false);
      } else {
        setError(result.message);
      }
    });
  }

  function handleCancelUpload() {
    if (!isNewUpload || !onCancelUpload) {
      onOpenChange(false);
      return;
    }
    startTransition(async () => {
      await onCancelUpload(file.id);
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={context !== null}
      onOpenChange={(open) => {
        if (!open && isNewUpload) return;
        onOpenChange(open);
      }}
    >
      <DialogContent
        className="gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-lg"
        showCloseButton={!isNewUpload}
      >
        <DialogHeader className="space-y-0 border-b border-slate-100 px-5 py-4 text-left">
          <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
            {isNewUpload ? "Set up your file for Cara" : "Edit file details"}
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
            {isNewUpload
              ? "Confirm the document type and tell Cara how to use it — you need to save before it goes live."
              : "Update how Cara understands and uses this file."}
          </DialogDescription>
          <p className="mt-2 truncate text-[12px] text-slate-500">{file.fileName}</p>
        </DialogHeader>

        <div className="max-h-[min(28rem,65vh)] space-y-4 overflow-y-auto px-5 py-4">
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#0b1220]">
              Document type
            </span>
            <select
              value={documentKind}
              onChange={(event) => {
                const value = event.target.value;
                if (isBusinessFileKind(value)) {
                  handleDocumentKindChange(value);
                } else {
                  setDocumentKind("");
                }
              }}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-[13px] text-[#0b1220]"
            >
              <option value="">Choose type…</option>
              {BUSINESS_FILE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {BUSINESS_FILE_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
            <p className="text-[11.5px] leading-relaxed text-slate-500">
              {isNewUpload
                ? "Check this matches your file — change it here if you picked the wrong type before uploading."
                : "Helps Cara know what kind of information to expect."}
            </p>
          </label>

          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#0b1220]">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-[13px] text-[#0b1220]"
              placeholder="Summer price list"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#0b1220]">
              What is this for Cara?
            </span>
            <textarea
              value={caraDescription}
              onChange={(event) => setCaraDescription(event.target.value)}
              maxLength={500}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] leading-relaxed text-[#0b1220]"
              placeholder={caraDescriptionPlaceholder(kind)}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#0b1220]">
              When should Cara use it?
            </span>
            <textarea
              value={whenToUse}
              onChange={(event) => setWhenToUse(event.target.value)}
              maxLength={300}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] leading-relaxed text-[#0b1220]"
              placeholder={whenToUsePlaceholder(kind)}
            />
          </label>

          {error ? (
            <p className="text-[12px] text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:justify-end">
          {isNewUpload ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={handleCancelUpload}
              className="h-10 w-full rounded-xl border-slate-300 bg-white px-4 text-[13px] sm:w-auto"
            >
              Cancel upload
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={pending || !documentKind}
            onClick={handleSave}
            className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "w-full sm:w-auto")}
          >
            {pending ? "Saving…" : isNewUpload ? "Save file" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
