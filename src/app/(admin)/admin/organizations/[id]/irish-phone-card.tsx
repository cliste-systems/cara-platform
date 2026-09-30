"use client";

import { useCallback, useState, useTransition } from "react";
import { Phone, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  type AssignPoolPhoneResult,
  type ReleasePoolPhoneResult,
  assignPoolPhoneToOrganization,
  releasePoolPhoneFromOrganization,
} from "../../actions";

type IrishPhoneCardProps = {
  organizationId: string;
  phoneNumber: string | null;
  phoneAssignedComplete?: boolean;
};

/** Assigns or releases the tenant's Irish HelloCara number from the Twilio pool. */
export function IrishPhoneCard({
  organizationId,
  phoneNumber,
  phoneAssignedComplete,
}: IrishPhoneCardProps) {
  const [pending, startTransition] = useTransition();
  const [releasePending, startReleaseTransition] = useTransition();
  const [result, setResult] = useState<AssignPoolPhoneResult | null>(null);
  const [releaseResult, setReleaseResult] = useState<ReleasePoolPhoneResult | null>(
    null,
  );
  const [confirmRelease, setConfirmRelease] = useState(false);

  const assign = useCallback(() => {
    setResult(null);
    startTransition(async () => {
      const r = await assignPoolPhoneToOrganization(organizationId);
      setResult(r);
    });
  }, [organizationId]);

  const release = useCallback(() => {
    setReleaseResult(null);
    startReleaseTransition(async () => {
      const r = await releasePoolPhoneFromOrganization(organizationId);
      setReleaseResult(r);
      if (r.ok) setConfirmRelease(false);
    });
  }, [organizationId]);

  const hasNumber = Boolean(phoneNumber?.trim());

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Assigned number</CardTitle>
            <CardDescription>
              The business forwards its published phone line to this HelloCara number.
            </CardDescription>
          </div>
          {phoneAssignedComplete ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-200/80 ring-inset">
              Assigned
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-border bg-card rounded-lg border px-3 py-2 shadow-sm">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            HelloCara number
          </p>
          <p className="text-foreground mt-1 font-mono text-sm font-semibold tabular-nums">
            {hasNumber ? phoneNumber : "— none assigned —"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="gap-2"
            disabled={pending || hasNumber}
            onClick={assign}
          >
            <Phone className="size-4" aria-hidden />
            {pending
              ? "Assigning…"
              : hasNumber
                ? "Number assigned"
                : "Assign Irish number"}
          </Button>

          {hasNumber ? (
            confirmRelease ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={releasePending}
                  onClick={release}
                >
                  {releasePending ? "Releasing…" : "Confirm release to pool"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={releasePending}
                  onClick={() => setConfirmRelease(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setConfirmRelease(true)}
              >
                <Undo2 className="size-4" aria-hidden />
                Release to pool
              </Button>
            )
          ) : null}
        </div>

        {result?.ok ? (
          <p className="text-sm font-medium text-emerald-700" role="status">
            Assigned {result.e164}.
          </p>
        ) : null}
        {result && !result.ok ? (
          <p className="text-destructive text-sm" role="alert">
            {result.message}
          </p>
        ) : null}
        {releaseResult?.ok ? (
          <p className="text-sm font-medium text-emerald-700" role="status">
            Number released to pool cooldown.
          </p>
        ) : null}
        {releaseResult && !releaseResult.ok ? (
          <p className="text-destructive text-sm" role="alert">
            {releaseResult.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
