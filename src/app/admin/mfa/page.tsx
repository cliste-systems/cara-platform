import { adminReturnPath } from "@/lib/admin-return-path";
import { redirect } from "next/navigation";
import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import { adminMfaAssuranceLevel, requireAdminMfaSetupSessionUser } from "@/lib/admin-session";
import { AdminMfaSetup } from "./setup";

export const dynamic = "force-dynamic";

export default async function AdminMfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const returnTo = adminReturnPath((await searchParams).next);
  await requireAdminMfaSetupSessionUser();
  if (await adminMfaAssuranceLevel() === "aal2") redirect(returnTo);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f7f8f9] px-5 py-12 text-[#11181d] sm:py-16">
      <section aria-label="Admin verification" className="w-full max-w-[480px]">
        <header aria-label="HelloCara" className="mb-8 flex justify-center">
          <ClisteLogoMark size={64} priority />
        </header>
        <div className="rounded-lg border border-[#e0e3e6] bg-white p-6 sm:p-8">
          <AdminMfaSetup returnTo={returnTo} />
        </div>
      </section>
    </main>
  );
}
