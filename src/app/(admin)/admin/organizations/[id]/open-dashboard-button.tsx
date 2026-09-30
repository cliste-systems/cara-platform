"use client";

import { useCallback, useState, useTransition } from "react";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";

import { createSupportDashboardLink } from "../../actions";

type OpenDashboardButtonProps = {
  organizationId: string;
};

/** Signs support in as a member so config can be checked end-to-end. */
export function OpenDashboardButton({
  organizationId,
}: OpenDashboardButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = useCallback(() => {
    setError(null);
    // Open during the click gesture so browsers do not block an async popup.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    startTransition(async () => {
      try {
        const result = await createSupportDashboardLink(organizationId, window.location.origin);
        if (!result.ok) { popup?.close(); setError(result.message); return; }
        if (popup) popup.location.replace(result.url);
        else window.location.assign(result.url);
      } catch {
        popup?.close();
        setError("Client dashboard could not be opened. Please try again.");
      }
    });
  }, [organizationId]);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        disabled={pending}
        onClick={open}
      >
        <LogIn className="size-4" aria-hidden />
        {pending ? "Opening…" : "Open client dashboard"}
      </Button>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
