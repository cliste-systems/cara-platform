import Link from "next/link";
import type { InputHTMLAttributes } from "react";
import { publicLegalUrl } from "@/lib/public-legal-url";

import { cn } from "@/lib/utils";

type Props = {
  inputProps?: Pick<InputHTMLAttributes<HTMLInputElement>, "aria-invalid" | "aria-describedby">;
  id: string;
  name: string;
  required?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  /** Tighter padding for dense layouts (e.g. plan picker). */
  compact?: boolean;
  children: React.ReactNode;
};

export function LegalAcceptanceCheckbox({
  inputProps,
  id,
  name,
  required = true,
  checked,
  onCheckedChange,
  className,
  compact = false,
  children,
}: Props) {
  return (
    <label
      data-legal-acceptance
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 text-left text-slate-600 shadow-sm",
        compact
          ? "rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-3 text-[12px] leading-[1.45]"
          : "rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[13px] leading-relaxed",
        className,
      )}
    >
      <input
        {...inputProps}
        id={id}
        name={name}
        type="checkbox"
        required={required}
        checked={checked}
        onChange={
          onCheckedChange
            ? (event) => onCheckedChange(event.target.checked)
            : undefined
        }
        className={cn(
          "mt-0.5 shrink-0 rounded border-slate-300 text-[#0b1220] focus:ring-[#0b1220]/20 size-4",
        )}
      />
      <span>{children}</span>
    </label>
  );
}

export function LegalDocLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href.startsWith("/legal/") ? publicLegalUrl(href) : href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-[#0b1220] underline underline-offset-2"
    >
      {children}
    </Link>
  );
}
