import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AdminSectionCardProps = {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  padded?: boolean;
};

export function AdminSectionCard({
  title,
  description,
  children,
  className,
  contentClassName,
  padded = false,
}: AdminSectionCardProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-[#e0e3e6] bg-[#ffffff]",
        className,
      )}
    >
      {title ? (
        <header className="border-b border-[#e5e7eb] px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-[#11181d]">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-[#697078]">{description}</p>
          ) : null}
        </header>
      ) : null}
      <div className={cn(padded && "p-5 sm:p-6", contentClassName)}>{children}</div>
    </section>
  );
}
