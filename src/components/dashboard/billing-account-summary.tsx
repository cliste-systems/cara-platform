import Link from "next/link";
import { DASHBOARD_SECONDARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";
import type { DashboardBillingDetails } from "@/lib/dashboard-billing-details";
import { FormFeedback } from "@/components/ui/form-feedback";
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-IE", { dateStyle: "medium" })
    : "—";
export function BillingAccountSummary({
  details,
  planName,
  setupChoice,
}: {
  details: DashboardBillingDetails;
  planName: string;
  setupChoice: string;
}) {
  return (
    <>
      <FormFeedback message={details.error} />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-[#d9e2dd] bg-white p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="font-semibold">{planName} plan</h2>
            <span className="rounded-full bg-[#eef3ef] px-3 py-1 text-xs">
              {details.status}
            </span>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight">
            {details.recurringPrice ?? "See your billing account"}
          </p>
          <p className="mt-2 text-sm text-[#5b6b65]">
            {details.cancelAtPeriodEnd
              ? "Ends"
              : details.status === "Free trial"
                ? "Trial ends"
                : "Next billing date"}
            : {date(details.renewsAt)}
          </p>
          <p className="mt-3 text-xs leading-5 text-[#6b7c75]">
            Usage above your allowance and applicable tax may affect your
            invoice. Manage billing to change your plan, payment details or
            cancellation.
          </p>
          {details.paymentMethod && (
            <p className="mt-4 border-t border-[#d9e2dd] pt-4 text-sm capitalize">
              {details.paymentMethod}
            </p>
          )}
        </section>
        <section className="rounded-xl border border-[#d9e2dd] bg-white p-5">
          <p className="text-xs font-medium text-[#6b7c75]">SETUP ASSISTANCE</p>
          <h2 className="mt-3 font-semibold">{setupChoice}</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b6b65]">
            {setupChoice === "Not selected"
              ? "No setup assistance has been selected."
              : setupChoice === "Self-service"
                ? "Your setup choice does not include an engineer session."
                : "Engineer setup is a separate, one-off service. It is not part of your recurring plan price. Any setup charge appears on your invoice."}
          </p>
          <Link
            className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "mt-4 inline-flex items-center no-underline")}
            href="/dashboard/support"
          >
            Get help with your setup →
          </Link>
        </section>
      </div>
      {details.invoices.length > 0 && (
        <section className="rounded-xl border border-[#d9e2dd] bg-white p-5">
          <h2 className="font-semibold">Recent invoices</h2>
          <div className="mt-3 divide-y divide-[#e3e9e5]">
            {details.invoices.map((i) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                key={i.id}
              >
                <div>
                  <p className="font-medium">{i.number}</p>
                  <p className="mt-1 text-xs text-[#6b7c75]">
                    {date(i.date)} · {i.status}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span>{i.amount}</span>
                  {i.url && (
                    <a
                      className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "inline-flex items-center no-underline")}
                      target="_blank"
                      rel="noopener noreferrer"
                      href={i.url}
                    >
                      View invoice
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
