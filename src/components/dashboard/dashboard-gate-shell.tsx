import type { ReactNode } from "react";

/** No dashboard navigation or tenant data is rendered during account setup. */
export function DashboardGateShell({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 z-10 overflow-y-auto bg-[#f3f6f4] px-4 py-6 text-[#20392c] sm:px-8 sm:py-10"><div className="mx-auto w-full max-w-5xl">{children}</div></div>;
}
