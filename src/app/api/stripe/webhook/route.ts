import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";

import {
  activatePlatformSubscriptionGoLive,
  assertWebhookPlatformCheckoutSessionComplete,
} from "@/lib/platform-billing-checkout";
import {
  activateElementsOnboardingIfReady,
  isDevPreviewBillingMetadata,
} from "@/lib/platform-billing-elements";
import {
  patchAccountAndLocations,
  resolveAccountIdFromBillingMetadata,
} from "@/lib/account-billing";
import { captureObservedError } from "@/lib/observability";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook for **Cliste platform billing** (salon subscriptions).
 * Customer booking PaymentIntents and Connect account sync were removed in v1.
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  const rawBody = await req.text();

  let event: Stripe.Event;
  const stripe = getStripeClient();
  if (secret) {
    if (!sig) {
      console.warn(
        "[stripe webhook] STRIPE_WEBHOOK_SECRET set but stripe-signature header missing — rejecting.",
      );
      return new NextResponse("missing stripe-signature", { status: 400 });
    }
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "invalid signature";
      console.warn("[stripe webhook] signature verification failed", msg);
      return new NextResponse("invalid signature", { status: 400 });
    }
  } else {
    const allowUnsignedDevOnly =
      process.env.NODE_ENV !== "production" &&
      process.env.CLISTE_ALLOW_UNSIGNED_STRIPE_WEBHOOKS === "1";
    if (!allowUnsignedDevOnly) {
      console.error(
        "[stripe webhook] STRIPE_WEBHOOK_SECRET not set — rejecting. Set CLISTE_ALLOW_UNSIGNED_STRIPE_WEBHOOKS=1 for local fixture testing only (non-production).",
      );
      return new NextResponse("webhook secret not configured", { status: 500 });
    }
    try {
      event = JSON.parse(rawBody) as Stripe.Event;
    } catch {
      return new NextResponse("invalid json", { status: 400 });
    }
  }

  const admin = createAdminClient();

  const { error: dedupeErr } = await admin
    .from("stripe_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
      status: "pending",
      livemode: event.livemode,
      payload: event,
    })
    .select("event_id, status")
    .maybeSingle();
  if (dedupeErr) {
    if (dedupeErr.code === "23505") {
      const { data: existing } = await admin
        .from("stripe_webhook_events")
        .select("status")
        .eq("event_id", event.id)
        .maybeSingle();
      if (existing?.status === "completed") {
        return NextResponse.json({ received: true, duplicate: true });
      }
    }
    if (dedupeErr.code !== "23505") {
      await captureObservedError(dedupeErr, {
        route: "stripe/webhook",
        eventId: event.id,
      });
      return new NextResponse("dedupe error", { status: 500 });
    }
  }

  const { data: claimedEvent, error: claimErr } = await admin
    .from("stripe_webhook_events")
    .update({
      status: "processing",
      attempts: 1,
      processing_started_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("event_id", event.id)
    .in("status", ["pending", "failed"])
    .select("event_id")
    .maybeSingle();
  if (claimErr) {
    await captureObservedError(claimErr, { route: "stripe/webhook", eventId: event.id });
    return new NextResponse("webhook claim error", { status: 500 });
  }
  if (!claimedEvent) {
    return NextResponse.json({ received: true, in_progress: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await handlePlatformCheckoutCompleted(session);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handlePlatformSubscriptionChange(admin, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handlePlatformSubscriptionDeleted(admin, sub);
        break;
      }
      case "setup_intent.succeeded": {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        await handleSetupIntentSucceeded(setupIntent);
        break;
      }
      case "invoice.created":
      case "invoice.finalized":
      case "invoice.finalization_failed":
      case "invoice.updated":
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.voided":
      case "invoice.marked_uncollectible": {
        await syncBillingInvoice(admin, event.data.object as Stripe.Invoice, event.livemode);
        break;
      }
      case "payment_intent.succeeded":
      case "payment_intent.processing":
      case "payment_intent.payment_failed": {
        await syncBillingPaymentIntent(
          admin,
          event.data.object as Stripe.PaymentIntent,
          event.livemode,
        );
        break;
      }
      case "charge.refunded":
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed": {
        await syncBillingAdjustment(admin, event.data.object as Stripe.Charge | Stripe.Dispute, event.type, event.livemode);
        break;
      }
      default:
        break;
    }
    await admin
      .from("stripe_webhook_events")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        processing_started_at: null,
      })
      .eq("event_id", event.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown webhook error";
    await admin
      .from("stripe_webhook_events")
      .update({
        status: "failed",
        last_error: message.slice(0, 2000),
        next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
      })
      .eq("event_id", event.id);
    await captureObservedError(err, {
      route: "stripe/webhook",
      eventType: event.type,
      eventId: event.id,
    });
    return new NextResponse("handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "stripe-webhook" });
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function resolveProjectionAccountId(
  admin: AdminClient,
  metadata: Stripe.Metadata | null | undefined,
  customerId: string | null,
) {
  const metadataAccountId = metadata?.cliste_account_id?.trim();
  if (metadataAccountId) return metadataAccountId;
  if (!customerId) return null;
  const { data } = await admin
    .from("accounts")
    .select("id")
    .eq("platform_customer_id", customerId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

function stripeId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

async function syncBillingInvoice(
  admin: AdminClient,
  invoice: Stripe.Invoice,
  livemode: boolean,
) {
  const customerId = stripeId(invoice.customer);
  const accountId = await resolveProjectionAccountId(admin, invoice.metadata, customerId);
  await admin.from("billing_invoices").upsert(
    {
      account_id: accountId,
      stripe_invoice_id: invoice.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: invoice.metadata?.cliste_subscription_id ?? null,
      livemode,
      status: invoice.status ?? "draft",
      collection_method: invoice.collection_method,
      currency: invoice.currency,
      amount_due: invoice.amount_due ?? 0,
      amount_paid: invoice.amount_paid ?? 0,
      amount_remaining: invoice.amount_remaining ?? 0,
      subtotal: invoice.subtotal ?? 0,
      total: invoice.total ?? 0,
      due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
      period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
      period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
      number: invoice.number,
      attempted: invoice.attempted ?? false,
      last_finalization_error: invoice.last_finalization_error?.message ?? null,
      metadata: invoice.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_invoice_id,livemode" },
  );
}

async function syncBillingPaymentIntent(
  admin: AdminClient,
  intent: Stripe.PaymentIntent,
  livemode: boolean,
) {
  const customerId = stripeId(intent.customer);
  const accountId = await resolveProjectionAccountId(admin, intent.metadata, customerId);
  const latestCharge = stripeId(intent.latest_charge);
  await admin.from("billing_payments").upsert(
    {
      account_id: accountId,
      stripe_payment_intent_id: intent.id,
      stripe_charge_id: latestCharge,
      stripe_invoice_id: intent.metadata?.stripe_invoice_id ?? null,
      livemode,
      status: intent.status,
      currency: intent.currency,
      amount: intent.amount,
      amount_received: intent.amount_received,
      failure_code: intent.last_payment_error?.code ?? null,
      failure_message: intent.last_payment_error?.message ?? null,
      captured_at: intent.status === "succeeded" ? new Date().toISOString() : null,
      metadata: intent.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_payment_intent_id,livemode" },
  );
}

async function syncBillingAdjustment(
  admin: AdminClient,
  object: Stripe.Charge | Stripe.Dispute,
  eventType: string,
  livemode: boolean,
) {
  const charge = "amount_refunded" in object ? object : null;
  const dispute = charge ? null : (object as Stripe.Dispute);
  const source = charge ?? dispute;
  if (!source) return;
  const metadata = charge?.metadata;
  const customerId = charge ? stripeId(charge.customer) : null;
  const accountId = await resolveProjectionAccountId(admin, metadata, customerId);
  const kind = eventType.startsWith("charge.dispute") ? "dispute" : "refund";
  await admin.from("billing_adjustments").upsert(
    {
      account_id: accountId,
      stripe_object_id: source.id,
      stripe_payment_intent_id: charge ? stripeId(charge.payment_intent) : null,
      livemode,
      kind,
      status: eventType.endsWith("closed") ? "closed" : "succeeded",
      currency: source.currency,
      amount: charge?.amount_refunded ?? charge?.amount ?? dispute?.amount ?? 0,
      reason: dispute?.reason ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_object_id,livemode" },
  );
}

async function handlePlatformCheckoutCompleted(
  session: Stripe.Checkout.Session,
) {
  assertWebhookPlatformCheckoutSessionComplete(session);

  const orgId =
    (session.metadata?.cliste_organization_id ?? "").trim() || null;
  const accountId = await resolveAccountIdFromBillingMetadata({
    accountId: session.metadata?.cliste_account_id,
    organizationId: orgId,
  });
  if (!accountId || !orgId) return;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  await patchAccountAndLocations(
    accountId,
    {
      platform_subscription_id: subscriptionId,
      platform_customer_id: customerId,
      updated_at: new Date().toISOString(),
    },
    { primaryOrganizationId: orgId },
  );

  try {
    await activatePlatformSubscriptionGoLive(orgId);
  } catch (err) {
    await captureObservedError(err, {
      route: "stripe/webhook",
      sideEffect: "platform_go_live",
      orgId,
    });
  }
}

async function handlePlatformSubscriptionChange(
  admin: AdminClient,
  sub: Stripe.Subscription,
) {
  const orgId = (sub.metadata?.cliste_organization_id ?? "").trim() || null;
  const accountId = await resolveAccountIdFromBillingMetadata({
    accountId: sub.metadata?.cliste_account_id,
    organizationId: orgId,
  });
  if (!accountId) return;

  await admin.from("billing_subscriptions").upsert(
    {
      account_id: accountId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: stripeId(sub.customer),
      livemode: Boolean(sub.livemode),
      status: sub.status,
      collection_method: sub.collection_method,
      currency: sub.items.data[0]?.price.currency ?? null,
      current_period_start: sub.items.data[0]?.current_period_start
        ? new Date(sub.items.data[0].current_period_start * 1000).toISOString()
        : null,
      current_period_end: sub.items.data[0]?.current_period_end
        ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
        : null,
      cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      service_access_role: sub.metadata?.cliste_service_access_role === "supplemental" ? "supplemental" : "core",
      metadata: sub.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id,livemode" },
  );

  const isHealthy =
    sub.status === "active" ||
    sub.status === "trialing" ||
    sub.status === "past_due";
  const shouldSuspend =
    sub.status === "unpaid" ||
    sub.status === "incomplete_expired" ||
    sub.status === "canceled";

  const { data: account } = await admin
    .from("accounts")
    .select("status")
    .eq("id", accountId)
    .maybeSingle();
  const currentStatus = (account?.status as string | undefined) ?? "active";

  const patch: Record<string, unknown> = {
    platform_subscription_id: sub.id,
    platform_customer_id:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    updated_at: new Date().toISOString(),
  };

  if (shouldSuspend && currentStatus === "active") {
    patch.status = "suspended";
    patch.suspended_reason = `stripe_subscription_${sub.status}`;
    patch.suspended_at = new Date().toISOString();
  } else if (isHealthy && currentStatus === "suspended") {
    patch.status = "active";
    patch.suspended_reason = null;
    patch.suspended_at = null;
  }

  await patchAccountAndLocations(accountId, patch);
  if (shouldSuspend && currentStatus === "active") {
    await admin
      .from("organizations")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("account_id", accountId);
  } else if (isHealthy && currentStatus === "suspended") {
    await admin
      .from("organizations")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("account_id", accountId);
  }

  const defaultPm =
    typeof sub.default_payment_method === "string"
      ? sub.default_payment_method
      : sub.default_payment_method?.id;
  if (
    orgId &&
    defaultPm &&
    isHealthy &&
    !(
      process.env.NODE_ENV === "production" &&
      isDevPreviewBillingMetadata(sub.metadata)
    )
  ) {
    try {
      await activateElementsOnboardingIfReady({
        organizationId: orgId,
        subscriptionId: sub.id,
        accountId,
      });
    } catch (err) {
      await captureObservedError(err, {
        route: "stripe/webhook",
        sideEffect: "elements_go_live",
        orgId,
      });
    }
  }
}

async function handlePlatformSubscriptionDeleted(
  admin: AdminClient,
  sub: Stripe.Subscription,
) {
  const orgId = (sub.metadata?.cliste_organization_id ?? "").trim() || null;
  const accountId = await resolveAccountIdFromBillingMetadata({
    accountId: sub.metadata?.cliste_account_id,
    organizationId: orgId,
  });
  if (!accountId) return;
  await patchAccountAndLocations(accountId, {
    status: "churned",
    suspended_reason: "platform_subscription_cancelled",
    suspended_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await admin
    .from("organizations")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", accountId);
}

async function handleSetupIntentSucceeded(
  setupIntent: Stripe.SetupIntent,
) {
  if (
    process.env.NODE_ENV === "production" &&
    isDevPreviewBillingMetadata(setupIntent.metadata)
  ) {
    return;
  }

  const orgId = (setupIntent.metadata?.cliste_organization_id ?? "").trim();
  const subscriptionId = (
    setupIntent.metadata?.cliste_subscription_id ?? ""
  ).trim();
  if (!orgId || !subscriptionId) return;

  const accountId = await resolveAccountIdFromBillingMetadata({
    accountId: setupIntent.metadata?.cliste_account_id,
    organizationId: orgId,
  });
  if (!accountId) return;

  try {
    await activateElementsOnboardingIfReady({
      organizationId: orgId,
      subscriptionId,
      accountId,
    });
  } catch (err) {
    await captureObservedError(err, {
      route: "stripe/webhook",
      sideEffect: "elements_go_live",
      orgId,
      setupIntentId: setupIntent.id,
    });
  }
}
