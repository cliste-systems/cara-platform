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
        "overflow-hidden rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] shadow-[0_1px_0_rgba(17,24,29,0.05),0_14px_34px_-28px_rgba(17,24,29,0.32)]",
        className,
      )}
    >
      {title ? (
        <header className="border-b border-[#e3e9e5] px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-[#11181d]">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-[#6b7c75]">{description}</p>
          ) : null}
        </header>
      ) : null}
      <div className={cn(padded && "p-5 sm:p-6", contentClassName)}>{children}</div>
    </section>
  );
}
