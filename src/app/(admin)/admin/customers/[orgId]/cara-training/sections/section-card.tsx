import type { ReactNode } from "react";

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] p-5 shadow-[0_1px_0_rgba(17,24,29,0.05),0_14px_34px_-28px_rgba(17,24,29,0.32)] sm:p-6">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-[#11181d]">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-[#6b7c75]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
