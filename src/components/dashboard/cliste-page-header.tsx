import type { ComponentType, ReactNode } from "react";

import type { InlineSummarySegment } from "@/components/dashboard/dashboard-inline-summary";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const HEADER_BACKGROUND = PUBLIC_ASSETS.dashboard.homeHero.png;

const HEADER_TONES = {
  activity: {
    eyebrow: "Activity log",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  calls: {
    eyebrow: "Phone line",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  inbox: {
    eyebrow: "Triage desk",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  training: {
    eyebrow: "Learning loop",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  knowledge: {
    eyebrow: "Knowledge hub",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  clients: {
    eyebrow: "Client dossier",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  routing: {
    eyebrow: "Route map",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  cara: {
    eyebrow: "Cara setup",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  business: {
    eyebrow: "Business profile",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  account: {
    eyebrow: "Account",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
} as const;

export type ClistePageHeaderTone = keyof typeof HEADER_TONES;

type ClistePageHeaderProps = {
  tone: ClistePageHeaderTone;
  icon: IconType;
  title: string;
  description: ReactNode;
  summary?: InlineSummarySegment[];
  /** Optional key or legend shown beside the summary chips (e.g. call status colours). */
  summaryAside?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Hide the uppercase eyebrow label above the title. */
  hideEyebrow?: boolean;
  /** Use a flat header without the decorative background image. */
  plain?: boolean;
};

export function ClistePageHeader({
  tone,
  icon: Icon,
  title,
  description,
  summary,
  summaryAside,
  actions,
  className,
  hideEyebrow = true,
  plain = true,
}: ClistePageHeaderProps) {
  const t = HEADER_TONES[tone];

  return (
    <header
      className={cn(
        "dashboard-page-heading relative shrink-0 text-[#11181d]",
        plain
          ? "border-b border-[#d9e2dd] pb-4"
          : "rounded-xl border border-[#d9e2dd] bg-[#fbfcfb] px-4 py-4 sm:px-5 bg-cover bg-right bg-no-repeat shadow-[0_1px_0_rgba(17,24,29,0.05),0_16px_42px_-30px_rgba(17,24,29,0.28)] before:absolute before:inset-y-0 before:left-0 before:w-1.5",
        !plain && t.accent,
        className,
      )}
      style={plain ? undefined : { backgroundImage: `url('${HEADER_BACKGROUND}')` }}
    >
      {!plain ? (
        <>
          <div className="absolute inset-0 bg-white/54" aria-hidden />
          <div
            className="absolute inset-y-0 left-0 w-[42%] bg-gradient-to-r from-white via-white/88 to-white/0"
            aria-hidden
          />
        </>
      ) : null}
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          {!plain ? (
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-lg border",
                t.icon,
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            {!hideEyebrow ? (
              <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", t.text)}>
                {t.eyebrow}
              </p>
            ) : null}
            <h1
              className={cn(
                "font-semibold leading-tight tracking-tight text-[#0b1220]",
                hideEyebrow
                  ? "text-[24px] sm:text-[28px]"
                  : "mt-1 text-[25px] sm:text-[28px]",
              )}
            >
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-600">
              {description}
            </p>
          </div>
        </div>

        {actions ? <div className="dashboard-heading-actions shrink-0 sm:pt-0.5">{actions}</div> : null}
      </div>

      {summary && summary.length > 0 ? (
        <div
          className={cn(
            "relative mt-4 flex flex-col gap-3 border-t pt-3 lg:flex-row lg:items-start lg:justify-between",
            t.rule,
          )}
        >
          <div
            className="flex flex-wrap gap-2"
            aria-label="Page summary"
          >
            {summary.map((segment) => (
              <span
                key={segment.label}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-white/80 bg-white/78 px-2.5 py-1 text-[12px] text-slate-600 shadow-[0_1px_0_rgba(17,24,29,0.04)] tabular-nums backdrop-blur-sm"
              >
                <span className={cn("font-semibold", t.text)}>
                  {segment.value}
                </span>
                <span>{segment.label}</span>
              </span>
            ))}
          </div>
          {summaryAside ? (
            <div className="min-w-0 lg:max-w-[min(100%,42rem)] lg:text-right">
              {summaryAside}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
