import { Check, Minus, X } from "lucide-react";
import { buildCallTechnicalHealth } from "@/lib/call-technical-health";

export function TechnicalHealth({ diagnostics, postCallStatus }: { diagnostics: unknown; postCallStatus: string | null }) {
  const checks = buildCallTechnicalHealth(diagnostics, postCallStatus);
  const counts = checks.reduce((all, check) => { all[check.status]++; return all; }, { pass: 0, fail: 0, unknown: 0 });
  return <>
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-[#e3e9e5] px-5 py-3 text-xs text-[#6b7c75]">
      <span className={counts.fail ? "font-medium text-red-700" : ""}>{counts.fail} need attention</span><span>{counts.pass} passed</span><span>{counts.unknown} unverified</span>
    </div>
    <div className="divide-y divide-[#e3e9e5]">
      {checks.map(check => {
        const Icon = check.status === "pass" ? Check : check.status === "fail" ? X : Minus;
        return <details key={check.id} className="group">
          <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_20px] items-center gap-3 px-5 py-2 hover:bg-[#f2f5f3] [&::-webkit-details-marker]:hidden">
            <span className="min-w-0"><span className="block text-[13px] font-medium text-[#11181d]">{check.label}</span><span className="mt-0.5 block text-[11px] text-[#6b7c75]">{check.expected}</span></span>
            <span className={`text-xs tabular-nums ${check.status === "unknown" ? "text-[#819087]" : "font-medium text-[#353d42]"}`}>{check.value}</span>
            <span className={check.status === "pass" ? "text-emerald-700" : check.status === "fail" ? "text-red-700" : "text-[#819087]"}><Icon className="size-4" aria-hidden /><span className="sr-only">{check.status === "unknown" ? "Unverified" : check.status}</span></span>
          </summary>
          <p className="border-t border-[#e3e9e5] bg-[#f5f8f6] px-5 py-3 text-xs leading-5 text-[#5f6f68]">{check.detail}</p>
        </details>;
      })}
    </div>
  </>;
}
