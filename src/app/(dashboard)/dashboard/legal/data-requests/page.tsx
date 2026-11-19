import Link from "next/link";

import { DashboardAnimatedStack } from "@/components/dashboard/dashboard-animated-group";
import { CLISTE_COMPANY, PRODUCT_NAME } from "@/lib/company-details";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { verticalPackForNiche } from "@/lib/verticals";

import { PrivacyToolsClient } from "../../privacy/privacy-client";

export const metadata = {
  title: `Data requests — Legal — ${PRODUCT_NAME}`,
};

export default async function LegalDataRequestsPage() {
  const org = await getCachedDashboardOrganizationRow();
  const includesAppointments = verticalPackForNiche(org?.niche ?? "").capabilities
    .autoEnsureBookingRoute;

  return (
    <DashboardAnimatedStack embedded>
      <PrivacyToolsClient includesAppointments={includesAppointments} />

      <section className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-slate-100">
        <div className="space-y-3 px-5 py-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
            What is included?
          </h2>
          <p className="text-[13px] text-slate-500">
            Actions apply to your business only and are recorded in the security
            audit log.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-slate-600">
            <li>
              <strong className="font-medium text-[#0b1220]">Export all records</strong>{" "}
              — Article 20 portability bundle (JSON or CSV) for every customer record
              in your account.
            </li>
            <li>
              <strong className="font-medium text-[#0b1220]">Export</strong> —
              {includesAppointments ? (
                <>
                  every appointment, call log (including transcripts, AI summaries,
                  and time-limited call recording playback links where still retained),
                  and action-inbox ticket for that phone number in your account.
                </>
              ) : (
                <>
                  every call log (including transcripts, AI summaries, and
                  time-limited call recording playback links where still retained)
                  and action-inbox ticket for that phone number in your account.
                </>
              )}
            </li>
            <li>
              <strong className="font-medium text-[#0b1220]">Erase</strong> —
              name, phone, and email are redacted; transcripts, AI summaries,
              and call recordings are removed.
            </li>
            <li>
              Customers can also email{" "}
              <a
                href={`mailto:${CLISTE_COMPANY.privacyEmail}`}
                className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
              >
                {CLISTE_COMPANY.privacyEmail}
              </a>
              . You remain the data controller; we act as processor.
            </li>
          </ul>

          <h3 className="pt-2 text-[14px] font-semibold tracking-tight text-[#0b1220]">
            Call transcription &amp; personal details
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-slate-600">
            <li>
              Do not configure Cara to <strong>ask</strong> for medical history,
              pregnancy, allergies, PPS, or bank details — calls are transcribed.
            </li>
            <li>
              If a caller <strong>volunteers</strong> sensitive information, use{" "}
              <strong>Erase</strong> above when they ask for deletion.
            </li>
            <li>
              Mention AI answering and transcription in your own website privacy
              notice (see snippet on the right).
            </li>
          </ul>
        </div>

        <div className="space-y-3 border-t border-slate-100 px-5 py-5 lg:border-t-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
            Website wording for your customers
          </h2>
          <p className="text-[13px] text-slate-500">
            Add something like this to your site — swap in your business name and
            contact details.
          </p>
          <blockquote className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[12px] leading-relaxed text-slate-700">
            When you call [Business name], your call may be answered by our AI
            phone assistant provided by {CLISTE_COMPANY.legalName}. Calls may be recorded and
            transcribed to handle your request; call audio is kept for up to 30 days,
            then deleted.
            We use {CLISTE_COMPANY.legalName} to process this data on our behalf. For privacy requests,
            contact us directly or email {CLISTE_COMPANY.privacyEmail}.
          </blockquote>
          <p className="text-[12px] text-slate-500">
            <Link
              href={DASHBOARD_ROUTES.legalCallerNotice}
              className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
            >
              Full caller-notice templates
            </Link>{" "}
            (website, signage, social). Full legal documents are in the tabs above.
            Need help?{" "}
            <Link
              href={DASHBOARD_ROUTES.support}
              className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
            >
              Support
            </Link>
          </p>
        </div>
      </section>
    </DashboardAnimatedStack>
  );
}
