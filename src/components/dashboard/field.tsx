import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  htmlFor?: string;
  /** Helper line under the control. */
  hint?: ReactNode;
  /** Greyed example shown under the hint (e.g. "e.g. Mon–Fri 9–5"). */
  example?: string;
  children: ReactNode;
  className?: string;
};

/** Consistent label + control + hint block. Keeps forms readable, not dense. */
export function Field({
  label,
  htmlFor,
  hint,
  example,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px] font-medium text-slate-800">
        {label}
      </Label>
      {children}
      {hint ? (
        <p className="text-[12.5px] leading-relaxed text-slate-500">{hint}</p>
      ) : null}
      {example ? (
        <p className="text-[12px] leading-relaxed text-slate-400">{example}</p>
      ) : null}
    </div>
  );
}
