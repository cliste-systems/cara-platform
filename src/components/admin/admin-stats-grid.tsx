import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Responsive stats row shared by list pages and Overview. */
export function AdminStatsGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("grid gap-3", className)}
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))" }}
    >
      {children}
    </section>
  );
}
