import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import { CLISTE_COMPANY } from "@/lib/company-details";
import { LegalAcceptForm } from "./legal-accept-form";
import { loadLegalAcceptPageData } from "./load-legal-accept-page-data";

export const dynamic = "force-dynamic";

export default async function DashboardLegalAcceptPage() {
  const data = await loadLegalAcceptPageData();
  const otherLocations = data.storeNames.filter((name) => name !== data.organizationName);
  return <div className="fixed inset-0 z-20 overflow-y-auto bg-white text-[#0b1220] antialiased">
    <main className="mx-auto flex min-h-dvh w-[calc(100%-32px)] max-w-[1320px] flex-col justify-center border-x border-slate-200/70 py-6 sm:w-[calc(100%-64px)]">
      <div className="border-y border-slate-200/70">
        <div className="border-b border-slate-200/70 px-5 py-3 text-xs text-slate-500 sm:px-9">Account agreements</div>
        <div className="grid lg:grid-cols-2">
          <header className="border-b border-slate-200/70 px-5 py-8 sm:px-9 lg:border-b-0 lg:border-r lg:px-14 lg:py-12">
            <ClisteLogoMark size={48} priority />
            <h1 className="mt-7 text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[36px]">Review your agreements</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">Review and accept the outstanding agreements to continue to your HelloCara workspace.</p>
            <div className="mt-8 border-y border-slate-200/70 py-5">
              <p className="text-xs text-slate-500">Your organisation</p>
              <p className="mt-2 font-semibold">{data.organizationName}</p>
              {otherLocations.length ? <p className="mt-2 text-sm leading-6 text-slate-500">{otherLocations.join(" · ")}</p> : null}
              {data.invoiceBilling ? <p className="mt-4 text-sm leading-6 text-slate-500">Your organisation pays by invoice{data.billingEmail ? <>, sent to <strong className="font-medium text-slate-700">{data.billingEmail}</strong></> : ""}. No card details are needed. Fees and payment terms follow your agreed proposal.</p> : null}
            </div>
            <p className="mt-5 max-w-sm text-xs leading-5 text-slate-500">Organisation details incorrect, or unable to agree on its behalf? Contact <a className="text-slate-700 underline underline-offset-2" href={`mailto:${CLISTE_COMPANY.supportEmail}`}>{CLISTE_COMPANY.supportEmail}</a>.</p>
          </header>
          <section aria-label="Outstanding agreements" className="px-5 py-8 sm:px-9 lg:px-14 lg:py-12">
            <LegalAcceptForm missing={data.missing} organizationName={data.organizationName} accountId={data.accountId} signatoryName={data.signatoryName} />
          </section>
        </div>
      </div>
    </main>
  </div>;
}
