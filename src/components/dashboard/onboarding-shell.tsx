import type { ReactNode } from "react";
import { ArrowUpRight, Check, LockKeyhole, Store } from "lucide-react";

import { ClisteLogoMark } from "@/components/cliste-logo-mark";

export function OnboardingShell({ step, title, description, organizationName, children }: {
  step: 1 | 2;
  title: string;
  description: string;
  organizationName?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-8 flex items-center justify-between gap-4 sm:mb-12">
        <div className="flex items-center gap-2.5"><ClisteLogoMark size={32} priority /><span className="text-xl font-semibold tracking-tight text-[#20392c]">HelloCara</span></div>
        <a href="mailto:support@hellocara.ie" className="inline-flex min-h-11 items-center gap-1 text-sm text-[#52685c] transition-colors hover:text-[#20392c]">Need a hand?<ArrowUpRight className="size-3.5" /></a>
      </header>
      <div className="grid gap-8 lg:grid-cols-[.82fr_1.18fr] lg:gap-16">
        <aside className="lg:pt-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d8e3dc] bg-white px-3 py-1.5 text-xs font-medium text-[#476550]"><Store className="size-3.5" />Your store workspace</span>
          <h2 className="mt-5 max-w-sm text-3xl font-semibold leading-tight tracking-[-.035em] text-[#20392c] sm:text-4xl">A warm welcome.<br />A simple start.</h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-[#617367]">Your HelloCara team has prepared your workspace. Finish these steps to make it yours.</p>
          {organizationName ? <p className="mt-5 max-w-sm rounded-xl border border-[#dbe5de] bg-white/60 px-4 py-3 text-sm font-medium text-[#304b3b]">{organizationName}</p> : null}
          <ol aria-label="Account setup progress" className="mt-7 flex flex-wrap gap-4 lg:flex-col lg:gap-5">
            {["Secure your account", "Review your agreements", "Your dashboard"].map((label, index) => (
              <li key={label} aria-current={index + 1 === step ? "step" : undefined} className="flex items-center gap-3 text-sm">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${index + 1 <= step ? "bg-[#294c37] text-white" : "border border-[#d5dfd8] text-[#849187]"}`}>{index + 1 < step ? <Check className="size-3.5" /> : index + 1}</span>
                <span className={index + 1 === step ? "font-semibold text-[#20392c]" : "text-[#617367]"}>{label}</span>
              </li>
            ))}
          </ol>
        </aside>
        <main className="rounded-2xl border border-[#dce5df] bg-white p-6 shadow-[0_12px_45px_-25px_rgba(30,64,45,.3)] sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#617a68]">Step {step} of 2</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#20392c]">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-[#617367]">{description}</p>
          <div className="mt-7">{children}</div>
        </main>
      </div>
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#dbe5de] pt-5 text-xs leading-6 text-[#617367]"><span>HelloCara · Cliste Systems Limited</span><span className="flex items-center gap-1.5"><LockKeyhole className="size-3" />Secure account setup</span></footer>
    </div>
  );
}
