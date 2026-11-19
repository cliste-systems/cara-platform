"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DashboardSelect } from "@/components/dashboard/dashboard-select";
import { motion, useReducedMotion } from "motion/react";

import { onboardingSpring } from "@/components/onboarding/onboarding-motion";
import { DASHBOARD_LEGAL_PAGES } from "@/lib/legal-pages";
import { cn } from "@/lib/utils";

export function DashboardLegalTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  return (
    <>
    <div className="sm:hidden"><DashboardSelect aria-label="Legal document" value={pathname} onValueChange={(href) => router.push(href)} options={DASHBOARD_LEGAL_PAGES.map(page => ({value: page.href, label: page.label}))} /></div>
    <nav
      aria-label="Legal sections"
      className="no-scrollbar hidden sm:flex w-full min-w-0 items-stretch overflow-x-auto overflow-y-hidden rounded-xl border border-[#d9e2dd] bg-white/70 p-1 backdrop-blur"
    >
      {DASHBOARD_LEGAL_PAGES.map((page) => {
        const active = pathname === page.href;
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-11 shrink-0 min-w-max flex-1 items-center justify-center rounded-lg px-3 py-2.5 text-center text-[13px] font-medium whitespace-nowrap transition-colors sm:min-w-0 sm:px-4",
              active
                ? "text-white"
                : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]",
            )}
          >
            {active && !reduceMotion ? (
              <motion.span
                layoutId="legal-tab-pill"
                className="absolute inset-0 rounded-lg bg-[#0b1220] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                transition={onboardingSpring}
              />
            ) : active ? (
              <span className="absolute inset-0 rounded-lg bg-[#0b1220] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />
            ) : null}
            <span className="relative z-[1]">{page.label}</span>
          </Link>
        );
      })}
    </nav>
    </>
  );
}
