import type { ComponentType, ReactNode } from "react";

import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_HINT_CLASS,
  DASHBOARD_ICON_CHIP_MD,
  DASHBOARD_ICON_GLYPH_MD,
  DASHBOARD_SECTION_TITLE_CLASS,
  type AccentTone,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type SectionCardProps = {
  title: string;
  description?: string;
  icon?: IconType;
  /** @deprecated Ignored — icons use one shared colour. */
  accent?: AccentTone;
  action?: ReactNode;
  children: ReactNode;
  /** Drop the card's own border/shadow (use inside a form stack). */
  flat?: boolean;
  id?: string;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
};

/**
 * The single titled section primitive for the dashboard: optional icon chip,
 * title + description, optional header action, and a body. Use `flat` when the
 * card lives inside a `DASHBOARD_FORM_STACK`.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  accent: _accent = "slate",
  action,
  children,
  flat = false,
  id,
  className,
  headerClassName,
  bodyClassName,
}: SectionCardProps) {
  return (
    <section
      id={id}
      className={cn(
        "flex min-w-0 flex-col",
        !flat && DASHBOARD_CARD_SURFACE,
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-start justify-between gap-3 px-5 py-4",
          !flat && "border-b border-slate-100",
          flat && description && "pb-4",
          headerClassName,
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className={cn("mt-0.5", DASHBOARD_ICON_CHIP_MD)}>
              <Icon className={DASHBOARD_ICON_GLYPH_MD} aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className={DASHBOARD_SECTION_TITLE_CLASS}>{title}</h2>
            {description ? (
              <p className={cn("mt-0.5", DASHBOARD_HINT_CLASS)}>{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div
        className={cn(
          flat ? "space-y-5 px-5 pb-5" : "min-h-0 flex-1 px-5 py-5",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
