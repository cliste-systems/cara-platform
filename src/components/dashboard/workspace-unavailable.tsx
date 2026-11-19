"use client";

import { RefreshCw } from "lucide-react";
import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { DASHBOARD_PRIMARY_BUTTON_CLASS } from "./dashboard-surface";

export function WorkspaceUnavailable({ retry, embedded = false }: { retry?: () => void; embedded?: boolean }) {
  return <main className={`flex ${embedded ? "min-h-0 flex-1" : "min-h-dvh"} items-center justify-center bg-[#f3f6f4] p-4 text-[#11181d]`}>
    <section className="w-full max-w-md rounded-2xl border border-[#d9e2dd] bg-white p-6 sm:p-8">
      <ClisteLogoMark size={36} />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Let’s reconnect your workspace</h1>
      <p className="mt-2 text-sm leading-6 text-[#5b6b65]">Cara couldn’t load this page just now. Try again to pick up where you left off.</p>
      <FormFeedback className="mt-5" title="Connection interrupted" message="Your saved information hasn’t changed." />
      <Button className={`${DASHBOARD_PRIMARY_BUTTON_CLASS} mt-5 w-full`} onClick={() => retry ? retry() : window.location.reload()}><RefreshCw className="size-4" />Try again</Button>
    </section>
  </main>;
}
