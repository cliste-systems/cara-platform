"use client";
import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { UnsavedDraftGuard } from "@/components/dashboard/unsaved-draft-guard";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, RefreshCw } from "lucide-react";
import { WorkspaceSectionNav } from "@/components/dashboard/workspace-section-nav";
import { IrishForwardingGuide } from "@/components/dashboard/irish-forwarding-guide";
import { DashboardSelect } from "@/components/dashboard/dashboard-select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/dashboard/field";
import { FormFeedback } from "@/components/ui/form-feedback";
import {
  CALL_ROUTING_MODES,
  CALL_ROUTING_MODE_META,
  type CallRoutingMode,
} from "@/lib/call-routing";
import { savePhoneConnection } from "./service-phone-actions";
export function ServicePhoneView({
  number,
  enabled,
  initialMode,
  initialTransfer,
  version,
  canManage,
  verifiedAt,
}: {
  number: string | null;
  enabled: boolean;
  initialMode: CallRoutingMode;
  initialTransfer: string;
  version: string;
  canManage: boolean;
  verifiedAt: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode),
    [transfer, setTransfer] = useState(initialTransfer),
    [saved, setSaved] = useState({
      mode: initialMode,
      transfer: initialTransfer,
      version,
    }),
    [instructions, setInstructions] = useState(false),
    [error, setError] = useState<string | null>(null),
    [pending, start] = useTransition();
  const dirty = mode !== saved.mode || transfer !== saved.transfer;
  return (
    <div className="space-y-5 pb-6">
      <UnsavedDraftGuard dirty={dirty && !pending} />
      <ClistePageHeader tone="business" icon={Phone} title="Phone connection" description="Your Cara number, call handling and forwarding instructions." />
      <WorkspaceSectionNav group="business" />
      <FormFeedback message={error} />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <section className="rounded-xl border border-[#d9e2dd] bg-white p-5">
            <p className="text-xs text-[#6b7c75]">YOUR CARA NUMBER</p>
            <h2 className="mt-3 break-words text-2xl font-semibold">
              {number ?? "No number connected"}
            </h2>
            <p className="mt-2 text-sm text-[#5b6b65]">
              {number && enabled
                ? "Cara is enabled on this number."
                : "Your number is not active. Contact us for help connecting it."}
            </p>
            {number && enabled && (
              <a
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#353d42] px-5 text-sm text-white"
                href={`tel:${number}`}
              >
                <Phone className="size-4" />
                Call Cara to test
              </a>
            )}
            <p className="mt-4 text-xs leading-5 text-[#6b7c75]">
              Ask about a service and your opening hours, then leave a message.
              Check the result in{" "}
              <Link href="/dashboard/calls" className="no-underline">
                Calls
              </Link>
              .
            </p>
            {verifiedAt && (
              <p className="mt-3 text-xs text-[#6b7c75]">
                Forwarding last checked:{" "}
                {new Date(verifiedAt).toLocaleDateString("en-IE")}
              </p>
            )}
          </section>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              start(async () => {
                try {
                  const r = await savePhoneConnection({
                    mode,
                    transfer,
                    version: saved.version,
                  });
                  if (!r.ok) {
                    setError(r.message);
                    return;
                  }
                  setSaved({ mode, transfer: r.transfer, version: r.version });
                  setTransfer(r.transfer);
                  router.refresh();
                } catch {
                  setError(
                    "We couldn’t save your call handling. Your edits are still here. Please try again.",
                  );
                }
              });
            }}
            className="space-y-4 rounded-xl border border-[#d9e2dd] bg-white p-5"
          >
            <h2 className="font-semibold">How calls reach Cara</h2>
            <fieldset disabled={!canManage || pending} className="space-y-4">
              <Field label="Connection" htmlFor="connection-mode">
                <DashboardSelect
                  id="connection-mode"
                  value={mode}
                  onValueChange={setMode}
                  options={CALL_ROUTING_MODES.map((value) => ({
                    value,
                    label: CALL_ROUTING_MODE_META[value].title.replace(
                      "Cliste",
                      "Cara",
                    ),
                  }))}
                />
              </Field>
              <p className="text-sm leading-6 text-[#5b6b65]">
                {mode === "cliste_number" ? "Share your Cara number with customers. Cara answers enquiries and records messages for your team." : CALL_ROUTING_MODE_META[mode].description.replaceAll("Cliste", "Cara")}
              </p>
            </fieldset>
            {canManage && (
              <Button type="submit" disabled={pending || !dirty}>
                {pending ? "Updating…" : "Save call handling"}
              </Button>
            )}
            <p className="text-xs leading-5 text-[#6b7c75]">
              Saving here updates Cara’s call handling. Forwarding itself is
              controlled by your phone or provider.
            </p>
          </form>
        </div>
        <section className="space-y-4">
          <h2 className="font-semibold">Connect your existing number</h2>
          {instructions && (
            <Button variant="outline" onClick={() => setInstructions(false)}>
              ← Change phone or provider
            </Button>
          )}
          <IrishForwardingGuide
            number={enabled ? number : null}
            displayNumber={number}
            instructions={instructions}
            onReadyChange={setInstructions}
          />
          <Link
            className="inline-flex min-h-11 items-center text-sm no-underline"
            href="/dashboard/support"
          >
            Get forwarding help →
          </Link>
        </section>
      </div>
      <Button variant="outline" onClick={() => router.refresh()}>
        <RefreshCw className="size-4" />
        Refresh line status
      </Button>
    </div>
  );
}
