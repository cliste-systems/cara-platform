"use client";

import type { ReactNode } from "react";

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
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";
import styles from "./service-privacy-dialog.module.css";

type ConfirmDialogProps = {
  serviceTheme?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Extra body copy or blocks between description and footer. */
  children?: ReactNode;
  contentClassName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
  destructive?: boolean;
  /** When set, Cancel runs this instead of closing (e.g. wizard back step). */
  onCancel?: () => void;
  confirmDisabled?: boolean;
};

export function ConfirmDialog({
  open,
  serviceTheme = false,
  onOpenChange,
  title,
  description,
  children,
  contentClassName,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  pending = false,
  destructive = false,
  onCancel,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName={serviceTheme ? styles.backdrop : undefined}
        className={cn("gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-md", serviceTheme && styles.popup)}
      >
        <DialogHeader className="space-y-0 px-5 pt-5 text-left">
          <DialogTitle className="text-[17px] font-semibold tracking-tight text-[#0b1220]">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
              {description}
            </DialogDescription>
          ) : null}
          {children ? (
            <div className={cn("mt-4 pb-1", contentClassName)}>{children}</div>
          ) : null}
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2 border-t border-slate-100 bg-white px-5 py-5 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (onCancel) {
                onCancel();
                return;
              }
              onOpenChange(false);
            }}
            className={DASHBOARD_SECONDARY_BUTTON_CLASS}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={pending || confirmDisabled}
            onClick={onConfirm}
            className={cn(
              destructive
                ? "h-10 rounded-xl bg-red-700 px-4 text-[13px] font-medium text-white hover:bg-red-800 disabled:opacity-50"
                : DASHBOARD_PRIMARY_BUTTON_CLASS,
            )}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
