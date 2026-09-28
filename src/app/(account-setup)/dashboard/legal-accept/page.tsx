import { Building2, ReceiptText } from "lucide-react";
import { OnboardingShell } from "@/components/dashboard/onboarding-shell";
import { CLISTE_COMPANY } from "@/lib/company-details";
import { LegalAcceptForm } from "./legal-accept-form";
import { loadLegalAcceptPageData } from "./load-legal-accept-page-data";

export const dynamic = "force-dynamic";

export default async function DashboardLegalAcceptPage() {
  const data = await loadLegalAcceptPageData();
  return <OnboardingShell step={2} title="A few things before we begin" description="Review the agreements for your organisation. Once you’re ready, your stores’ dashboard is one step away." organizationName={data.organizationName}>
    <section className="mb-6 rounded-2xl border border-[#dce8e1] bg-[#f3f7f4] p-5">
      <div className="flex items-start gap-3"><Building2 size={20} className="mt-0.5 shrink-0 text-[#31594b]" aria-hidden="true" /><div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Your organisation</p><h2 className="mt-1 font-semibold text-slate-900">{data.organizationName}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{data.storeNames.join(" · ")}</p></div></div>
      {data.invoiceBilling ? <div className="mt-4 flex items-start gap-3 border-t border-[#dce8e1] pt-4"><ReceiptText size={18} className="mt-0.5 shrink-0 text-[#31594b]" aria-hidden="true" /><p className="text-sm leading-6 text-slate-600">Your organisation pays by invoice{data.billingEmail ? <>, sent to <strong className="font-medium text-slate-800">{data.billingEmail}</strong></> : ""}. No card details are needed. Fees and payment terms follow your agreed proposal.</p></div> : null}
    </section>
    <LegalAcceptForm missing={data.missing} organizationName={data.organizationName} accountId={data.accountId} signatoryName={data.signatoryName} />
    <p className="mt-6 text-center text-xs leading-5 text-slate-500">If the organisation is incorrect or you cannot agree on its behalf, contact <a className="font-medium underline underline-offset-2" href={`mailto:${CLISTE_COMPANY.supportEmail}`}>{CLISTE_COMPANY.supportEmail}</a> before continuing.</p>
  </OnboardingShell>;
}
