"use client";

import { useCallback, useState, useTransition } from "react";
import { ArrowRight, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";

import { createSupportDashboardLink } from "../../actions";

type OpenDashboardButtonProps = {
  organizationId: string;
  appearance?: "default" | "setup";
};

/** Signs support in as a member so config can be checked end-to-end. */
export function OpenDashboardButton({
  organizationId,
  appearance="default",
}: OpenDashboardButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = useCallback(() => {
    setError(null);
    // Setup completion continues in the current pane; admin tools keep their separate client tab.
    const popup = appearance==="setup"?null:window.open("about:blank", "_blank");
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
  }, [organizationId,appearance]);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={appearance==="setup"?"default":"outline"}
        className={appearance==="setup"?"min-h-11 gap-3 rounded-full bg-[#11181d] px-6 text-sm font-medium text-white hover:bg-[#243136]":"gap-2"}
        disabled={pending}
        onClick={open}
      >
        {appearance!=="setup"&&<LogIn className="size-4" aria-hidden />}
        {pending ? "Opening…" : appearance==="setup"?"Open dashboard":"Open client dashboard"}
        {appearance==="setup"&&<ArrowRight className="size-4" aria-hidden />}
      </Button>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
