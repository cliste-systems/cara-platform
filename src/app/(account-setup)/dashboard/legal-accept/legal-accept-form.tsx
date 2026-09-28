"use client";

import { useActionState } from "react";
import { ArrowRight, FileText, ShieldCheck, Eye } from "lucide-react";
import { LegalAcceptanceCheckbox, LegalDocLink } from "@/components/legal/legal-acceptance-checkbox";
import { LEGAL_DOCUMENT_LABELS, LEGAL_DOCUMENT_PATHS, LEGAL_DOCUMENT_VERSIONS, type LegalDocumentType } from "@/lib/legal-documents";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptLegalDocuments, type AcceptLegalDocumentsResult } from "./actions";

const INITIAL: AcceptLegalDocumentsResult = { ok: false, message: "" };
const DETAILS = {
  terms: { icon: FileText, summary: "How the service works, your responsibilities, fees and cancellation." },
  dpa: { icon: ShieldCheck, summary: "How we process caller data for your organisation, including security and sub-processors." },
  privacy: { icon: Eye, summary: "How account and service information is used, retained and protected." },
};

export function LegalAcceptForm({ missing, organizationName, accountId, signatoryName }: {
  missing: LegalDocumentType[]; organizationName: string; accountId: string; signatoryName: string;
}) {
  const [state, formAction, pending] = useActionState(acceptLegalDocuments, INITIAL);
  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="account_id" value={accountId} />
      <input type="hidden" name="organisation_name" value={organizationName} />
      <div className="space-y-3">
        {(["terms", "dpa", "privacy"] as LegalDocumentType[]).filter((doc) => missing.includes(doc)).map((doc) => {
          const Icon = DETAILS[doc].icon;
          return <div key={doc} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <input type="hidden" name={`version_${doc}`} value={LEGAL_DOCUMENT_VERSIONS[doc]} />
            <div className="mb-3 flex items-start gap-3">
              <span className="rounded-lg bg-[#eef4f1] p-2 text-[#31594b]"><Icon size={18} aria-hidden="true" /></span>
              <div>
                <LegalDocLink href={LEGAL_DOCUMENT_PATHS[doc]}>{LEGAL_DOCUMENT_LABELS[doc]}</LegalDocLink>
                <p className="mt-1 text-sm leading-6 text-slate-500">{DETAILS[doc].summary}</p>
                <p className="mt-1 text-xs text-slate-400">Version {LEGAL_DOCUMENT_VERSIONS[doc]} · Opens in a new tab</p>
              </div>
            </div>
            <LegalAcceptanceCheckbox id={`accept_${doc}`} name={`accept_${doc}`} className="border-0 bg-slate-50 shadow-none">
              {doc === "terms" && <>I agree to the Terms of service on behalf of <strong>{organizationName}</strong>.</>}
              {doc === "dpa" && <>I accept the Data Processing Agreement on behalf of <strong>{organizationName}</strong> for the stores covered by this account.</>}
              {doc === "privacy" && <>I acknowledge that I have read the Privacy notice. This is an acknowledgment, not consent to marketing.</>}
            </LegalAcceptanceCheckbox>
          </div>;
        })}
      </div>
      <fieldset className="space-y-4">
        <legend className="mb-3 text-sm font-semibold text-slate-900">Your authority to agree</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="signatory_name">Full name</Label><Input id="signatory_name" name="signatory_name" autoComplete="name" defaultValue={signatoryName} minLength={2} maxLength={160} required /></div>
          <div className="space-y-2"><Label htmlFor="signatory_role">Role in the organisation</Label><Input id="signatory_role" name="signatory_role" autoComplete="organization-title" placeholder="e.g. Director or authorised manager" maxLength={160} required /></div>
        </div>
        <LegalAcceptanceCheckbox id="authority" name="authority">
          I am authorised to enter into these agreements for <strong>{organizationName}</strong> and give processing instructions for its stores.
        </LegalAcceptanceCheckbox>
      </fieldset>
      {!state.ok && state.message ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{state.message}</p> : null}
      <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#243f35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#315548] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#315548] disabled:cursor-wait disabled:opacity-60">
        {pending ? "Saving your agreements…" : "Agree and open dashboard"}<ArrowRight size={17} aria-hidden="true" />
      </button>
      <p className="text-center text-xs leading-5 text-slate-500">We record your name, role, organisation, document versions and the time of your agreement.</p>
    </form>
  );
}
