"use client";

import { adminIconButtonClass } from "@/components/admin/admin-interactive";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogIn, MoreHorizontal, Settings2, Trash2 } from "lucide-react";

import { adminCustomerPath } from "@/lib/admin-route-paths";

import {
  createSupportDashboardLink,
  deleteOrganization,
} from "./actions";

type TenantRowActionsProps = {
  organizationId: string;
  organizationName: string;
  customerHref?: string;
  allowOwnerActions?: boolean;
};

export function TenantRowActions({
  organizationId,
  organizationName,
  allowOwnerActions = false,
  customerHref = adminCustomerPath(organizationId),
}: TenantRowActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [loginPending, startLoginTransition] = useTransition();

  const openSupportDashboard = useCallback(() => {
    setRowError(null);
    startLoginTransition(async () => {
      const result = await createSupportDashboardLink(
        organizationId,
        typeof window !== "undefined" ? window.location.origin : null,
      );
      if (!result.ok) {
        setRowError(result.message);
        return;
      }
      const w = window.open(result.url, "_blank", "noopener,noreferrer");
      if (!w) {
        window.location.assign(result.url);
      }
    });
  }, [organizationId]);

  const confirmDelete = useCallback(() => {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteOrganization(organizationId);
      if (!result.ok) {
        setDeleteError(result.message);
        return;
      }
      setDeleteOpen(false);
    });
  }, [organizationId]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`${adminIconButtonClass} size-8`}
          aria-label={`Actions for ${organizationName}`}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => router.push(customerHref)}>
            <Settings2 className="size-4" aria-hidden />
            Open customer
          </DropdownMenuItem>
          {allowOwnerActions ? <>
          <DropdownMenuItem disabled={loginPending} onClick={openSupportDashboard}>
            <LogIn className="size-4" aria-hidden />
            {loginPending ? "Opening…" : "Open dashboard"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={deletePending}
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete tenant
          </DropdownMenuItem>
          </> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {rowError ? (
        <p className="mt-1 text-right text-xs leading-snug text-red-600">
          {rowError}
        </p>
      ) : null}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete tenant</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="text-foreground font-medium">
                {organizationName}
              </span>
              ? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p className="text-destructive text-sm" role="alert">
              {deleteError}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={deletePending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletePending}
              onClick={confirmDelete}
            >
              {deletePending ? "Deleting…" : "Delete tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
