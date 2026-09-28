import { LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import {
  adminMfaAssuranceLevel,
  requireAdminMfaSetupSessionUser,
} from "@/lib/admin-session";

import { AdminMfaSetup } from "./setup";

export const dynamic = "force-dynamic";

export default async function AdminMfaPage() {
  await requireAdminMfaSetupSessionUser();
  const level = await adminMfaAssuranceLevel();

  if (level === "aal2") {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] px-4 py-4 text-slate-950 sm:px-5">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-4xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)] lg:max-h-[calc(100dvh-2rem)] lg:grid-cols-[0.82fr_1.18fr]">
          <aside className="relative hidden overflow-hidden border-r border-slate-200 bg-[#eef2f6] p-7 lg:flex lg:flex-col">
            <div className="absolute -left-20 top-10 size-64 rounded-full bg-white/70 blur-3xl" />
            <div className="absolute -bottom-24 right-0 size-72 rounded-full bg-slate-200/70 blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <ClisteLogoMark size={38} priority />
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    Cliste Systems
                  </p>
                  <p className="text-xs text-slate-500">Admin Console</p>
                </div>
              </div>

              <div className="mt-10 max-w-sm">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  Protected admin access
                </div>

                <h1 className="mt-4 text-[2.05rem] font-semibold leading-[1.08] tracking-[-0.035em] text-slate-950">
                  One final check before you’re in.
                </h1>
              </div>
            </div>

            <div className="relative z-10 mt-auto pt-10">
              <div className="grid gap-2">
                {[
                  ["01", "Scan your QR code"],
                  ["02", "Enter the 6-digit code"],
                  ["03", "Continue securely"],
                ].map(([step, label]) => (
                  <div
                    key={step}
                    className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/65 px-3 py-2.5 backdrop-blur"
                  >
                    <span className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-semibold text-white">
                      {step}
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
                <LockKeyhole className="size-3.5" aria-hidden />
                Secure admin verification
              </div>
            </div>
          </aside>

          <section className="px-5 py-6 sm:px-7 sm:py-7 lg:px-9 lg:py-7">
            <div className="mx-auto max-w-lg">
              <div className="flex items-center gap-3 lg:hidden">
                <ClisteLogoMark size={38} priority />
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    Cliste Systems
                  </p>
                  <p className="text-xs text-slate-500">Admin Console</p>
                </div>
              </div>

              <div className="mt-7 lg:mt-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Security check
                </p>
                <h2 className="mt-1.5 text-[1.75rem] font-semibold tracking-[-0.025em] text-slate-950">
                  Verify it’s you
                </h2>
                <p className="mt-1.5 max-w-md text-sm leading-5 text-slate-600">
                  Set up or confirm your authenticator to continue to the
                  Cliste Systems admin console.
                </p>
              </div>

              <div className="mt-5">
                <AdminMfaSetup />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
