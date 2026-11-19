import "server-only";
import { getStripeClient } from "./stripe";
export type DashboardBillingDetails = {
  status: string;
  trialEnd: string | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  recurringPrice: string | null;
  paymentMethod: string | null;
  invoices: {
    id: string;
    number: string;
    date: string;
    amount: string;
    status: string;
    url: string | null;
  }[];
  error: string | null;
};
const date = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000).toISOString() : null;
export async function loadDashboardBillingDetails(
  subscriptionId: string | null,
  customerId: string | null,
): Promise<DashboardBillingDetails> {
  const result: DashboardBillingDetails = {
    status: "Not connected",
    trialEnd: null,
    renewsAt: null,
    cancelAtPeriodEnd: false,
    recurringPrice: null,
    paymentMethod: null,
    invoices: [],
    error: null,
  };
  if (!subscriptionId && !customerId) return result;
  try {
    const stripe = getStripeClient();
    const options = { timeout: 10000, maxNetworkRetries: 0 };
    const money = (cents: number, currency: string) =>
      new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: currency.toUpperCase(),
      }).format(cents / 100);
    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(
        subscriptionId,
        { expand: ["default_payment_method"] },
        options,
      );
      const waitingForConnection=sub.metadata.cliste_trial_activation==="forwarded_call"&&!sub.metadata.cliste_connection_verified_at;
      result.status = waitingForConnection ? "Connection pending" :
        {
          trialing: "Free trial",
          active: "Active",
          past_due: "Payment overdue",
          canceled: "Cancelled",
          unpaid: "Payment required",
          incomplete: "Payment incomplete",
          incomplete_expired: "Expired",
          paused: "Paused",
        }[sub.status] ?? sub.status;
      result.trialEnd = waitingForConnection?null:date(sub.trial_end);
      result.cancelAtPeriodEnd = sub.cancel_at_period_end;
      const licensed = sub.items.data.filter(
        (item) => item.price.recurring?.usage_type !== "metered",
      );
      const first = licensed[0];
      result.renewsAt = waitingForConnection?null:date(
        sub.status === "trialing" ? sub.trial_end : first?.current_period_end,
      );
      if (
        first &&
        licensed.every(
          (item) =>
            item.price.unit_amount != null &&
            item.price.currency === first.price.currency &&
            item.price.recurring?.interval === first.price.recurring?.interval,
        )
      ) {
        const interval = first.price.recurring;
        result.recurringPrice = `${money(
          licensed.reduce(
            (sum, item) =>
              sum + (item.price.unit_amount ?? 0) * (item.quantity ?? 1),
            0,
          ),
          first.price.currency,
        )} / ${interval?.interval_count && interval.interval_count > 1 ? `${interval.interval_count} ` : ""}${interval?.interval ?? "month"}`;
      }
      const pm = sub.default_payment_method;
      if (pm && typeof pm !== "string" && pm.card)
        result.paymentMethod = `${pm.card.brand} •••• ${pm.card.last4} · expires ${pm.card.exp_month}/${pm.card.exp_year}`;
    }
    if (customerId) {
      const [customer, invoices] = await Promise.all([
        stripe.customers.retrieve(
          customerId,
          { expand: ["invoice_settings.default_payment_method"] },
          options,
        ),
        stripe.invoices.list({ customer: customerId, limit: 10 }, options),
      ]);
      if (
        !result.paymentMethod &&
        !("deleted" in customer && customer.deleted)
      ) {
        const pm = customer.invoice_settings.default_payment_method;
        if (pm && typeof pm !== "string" && pm.card)
          result.paymentMethod = `${pm.card.brand} •••• ${pm.card.last4} · expires ${pm.card.exp_month}/${pm.card.exp_year}`;
      }
      result.invoices = invoices.data.map((i) => ({
        id: i.id,
        number: i.number ?? "Invoice",
        date: date(i.created)!,
        amount: money(i.total, i.currency),
        status: i.status ?? "Draft",
        url: i.hosted_invoice_url ?? i.invoice_pdf ?? null,
      }));
    }
  } catch (error) {
    console.error(
      "[billing] subscription details unavailable",
      error instanceof Error ? error.message : "unknown",
    );
    result.error =
      "We couldn’t load the latest billing details. You can still open Manage billing to check your account.";
  }
  return result;
}
