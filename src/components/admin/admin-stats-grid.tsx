import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Responsive stats row shared by list pages and Overview. */
export function AdminStatsGrid({
  children,
  className,
  columns,
}: {
  children: ReactNode;
  className?: string;
  columns?: number;
}) {
  return (
    <section
      className={cn("grid shrink-0 gap-3", className)}
      style={{ gridTemplateColumns: columns ? `repeat(${columns}, minmax(0, 1fr))` : "repeat(auto-fit, minmax(min(100%, 130px), 1fr))" }}
    >
      {children}
    </section>
  );
}
