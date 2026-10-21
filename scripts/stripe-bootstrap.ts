/**
 * scripts/stripe-bootstrap.ts — one-off script to seed Stripe with the Cliste
 * platform Products + Prices defined in src/lib/cliste-plans.ts, then cache
 * the resulting IDs into `public.stripe_platform_prices` so the wizard can
 * build Checkout Sessions without hardcoded env vars.
 *
 * Run with:
 *   STRIPE_SECRET_KEY=sk_test_... SUPABASE_SERVICE_ROLE_KEY=... \
 *   NEXT_PUBLIC_SUPABASE_URL=... npx tsx scripts/stripe-bootstrap.ts
 *
 * Idempotent: re-runs update prices rather than duplicate them. Safe to run
 * against sandbox AND live; the Stripe Product lookup_key is the idempotency
 * key.
 *
 * Creates, per plan (starter / pro / business / enterprise):
 *   - Product   "Cliste <Name>"   lookup_key = cliste_plan_<tier>
 *   - Price     monthly flat      lookup_key = cliste_plan_<tier>_monthly
 *   - Price     annual flat       lookup_key = cliste_plan_<tier>_annual
 *   - Price     metered overage   lookup_key = cliste_plan_<tier>_overage_min
 *   - Price     metered SMS       lookup_key = cliste_plan_<tier>_overage_sms
 *
 * And per launch tier (diy / remote / onsite_dublin / onsite_rest_ie):
 *   - Product   "Cliste <Name>"   lookup_key = cliste_setup_<tier>
 *   - Price     one-off           lookup_key = cliste_setup_<tier>_once
 *
 * Then upserts each ID into the stripe_platform_prices cache.
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import {
  LAUNCHES,
  LOCATION_ADDON_MONTHLY_CENTS,
  LOCATION_ADDON_STRIPE_KEY,
  PLANS,
} from "../src/lib/cliste-plans.data";

type UpsertRow = {
  key: string;
  plan_tier: string | null;
  interval: string;
  stripe_product_id: string;
  stripe_price_id: string;
  unit_amount_cents: number | null;
  currency: string;
};

async function main() {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) {
    throw new Error("STRIPE_SECRET_KEY is required.");
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2026-03-25.dahlia",
    appInfo: { name: "Cliste Bootstrap", url: "https://hellocara.ie" },
  });
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rows: UpsertRow[] = [];

  // Stripe API 2025-03-31+ requires metered prices to be backed by a
  // billing.meter. One meter is shared across every plan tier — Stripe
  // computes per-customer charges from whichever subscription item (i.e.
  // plan tier's overage price) is active.
  const meter = await upsertCallMinutesMeter(stripe);
  console.log(
    `[ok] billing meter ${meter.id} (event_name=${meter.event_name}) ready`,
  );

  const smsMeter = await upsertSmsMeter(stripe);
  console.log(
    `[ok] billing meter ${smsMeter.id} (event_name=${smsMeter.event_name}) ready`,
  );

  for (const plan of Object.values(PLANS)) {
    const productLookup = `cliste_plan_${plan.tier}`;
    const product = await upsertProduct(stripe, {
      lookupKey: productLookup,
      name: `Cliste ${plan.name}`,
      description: plan.tagline,
      metadata: { cliste_plan_tier: plan.tier },
    });

    const monthly = await upsertPrice(stripe, {
      lookupKey: `cliste_plan_${plan.tier}_monthly`,
      product: product.id,
      unitAmount: plan.monthlyCents,
      currency: "eur",
      interval: "month",
      nickname: `${plan.name} (monthly)`,
      metadata: { cliste_plan_tier: plan.tier, cliste_interval: "month" },
    });

    const annual = await upsertPrice(stripe, {
      lookupKey: `cliste_plan_${plan.tier}_annual`,
      product: product.id,
      unitAmount: plan.annualCents,
      currency: "eur",
      interval: "year",
      nickname: `${plan.name} (annual — 2 months free)`,
      metadata: { cliste_plan_tier: plan.tier, cliste_interval: "year" },
    });

    const overage = await upsertPrice(stripe, {
      lookupKey: `cliste_plan_${plan.tier}_overage_min`,
      product: product.id,
      unitAmount: plan.overageRateCents,
      currency: "eur",
      interval: "month",
      nickname: `${plan.name} overage per minute`,
      metered: true,
      meterId: meter.id,
      metadata: {
        cliste_plan_tier: plan.tier,
        cliste_kind: "overage_minute",
        cliste_meter_event: meter.event_name ?? "cliste_call_minute",
      },
    });

    const smsOverage = await upsertPrice(stripe, {
      lookupKey: `cliste_plan_${plan.tier}_overage_sms`,
      product: product.id,
      unitAmount: plan.smsOverageRateCents,
      currency: "eur",
      interval: "month",
      nickname: `${plan.name} overage per SMS`,
      metered: true,
      meterId: smsMeter.id,
      metadata: {
        cliste_plan_tier: plan.tier,
        cliste_kind: "overage_sms",
        cliste_meter_event: smsMeter.event_name ?? "cliste_sms",
      },
    });

    rows.push(
      row(`cliste_plan_${plan.tier}_monthly`, plan.tier, "month", product.id, monthly.id, plan.monthlyCents),
      row(`cliste_plan_${plan.tier}_annual`, plan.tier, "year", product.id, annual.id, plan.annualCents),
      row(`cliste_plan_${plan.tier}_overage_min`, plan.tier, "metered", product.id, overage.id, plan.overageRateCents),
      row(`cliste_plan_${plan.tier}_overage_sms`, plan.tier, "metered", product.id, smsOverage.id, plan.smsOverageRateCents),
    );
  }

  const locationProduct = await upsertProduct(stripe, {
    lookupKey: "cliste_location_addon",
    name: "Cliste extra location",
    description: "Monthly fee for each additional business location on Business+ plans.",
    metadata: { cliste_kind: "location_addon" },
  });
  const locationAddon = await upsertPrice(stripe, {
    lookupKey: LOCATION_ADDON_STRIPE_KEY,
    product: locationProduct.id,
    unitAmount: LOCATION_ADDON_MONTHLY_CENTS,
    currency: "eur",
    interval: "month",
    nickname: "Extra location (monthly)",
    metadata: { cliste_kind: "location_addon" },
  });
  rows.push(
    row(
      LOCATION_ADDON_STRIPE_KEY,
      null,
      "month",
      locationProduct.id,
      locationAddon.id,
      LOCATION_ADDON_MONTHLY_CENTS,
    ),
  );

  for (const launch of Object.values(LAUNCHES)) {
    if (launch.priceCents === 0) continue; // Nothing to charge for DIY.
    const productLookup = `cliste_setup_${launch.tier}`;
    const product = await upsertProduct(stripe, {
      lookupKey: productLookup,
      name: `Cliste ${launch.name}`,
      description: launch.description,
      metadata: { cliste_launch_tier: launch.tier },
    });

    const once = await upsertPrice(stripe, {
      lookupKey: `cliste_setup_${launch.tier}_once`,
      product: product.id,
      unitAmount: launch.priceCents,
      currency: "eur",
      oneTime: true,
      nickname: `${launch.name} (one-off)`,
      metadata: { cliste_launch_tier: launch.tier, cliste_kind: "setup_fee" },
    });

    rows.push(
      row(
        `cliste_setup_${launch.tier}_once`,
        null,
        "one_time",
        product.id,
        once.id,
        launch.priceCents,
      ),
    );
  }

  if (process.env.STRIPE_BOOTSTRAP_SKIP_DB === "1") {
    console.log(`[ok] ${rows.length} sandbox prices ready; shared database catalogue unchanged`);
    return;
  }
  for (const r of rows) {
    const { error } = await supabase
      .from("stripe_platform_prices")
      .upsert(
        {
          key: r.key,
          plan_tier: r.plan_tier,
          interval: r.interval,
          stripe_product_id: r.stripe_product_id,
          stripe_price_id: r.stripe_price_id,
          unit_amount_cents: r.unit_amount_cents,
          currency: r.currency,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    if (error) {
      throw new Error(`Upsert ${r.key} failed: ${error.message}`);
    }
    console.log(
      `[ok] ${r.key.padEnd(40)} ${r.stripe_product_id}  ${r.stripe_price_id}`,
    );
  }

  console.log("\nAll Cliste Stripe plans + setup fees synced.");
}

function row(
  key: string,
  planTier: string | null,
  interval: string,
  productId: string,
  priceId: string,
  amount: number | null,
): UpsertRow {
  return {
    key,
    plan_tier: planTier,
    interval,
    stripe_product_id: productId,
    stripe_price_id: priceId,
    unit_amount_cents: amount,
    currency: "eur",
  };
}

async function upsertProduct(
  stripe: Stripe,
  opts: {
    lookupKey: string;
    name: string;
    description: string;
    metadata: Record<string, string>;
  },
): Promise<Stripe.Product> {
  const existing = await stripe.products.search({
    query: `metadata['cliste_lookup_key']:'${opts.lookupKey}'`,
    limit: 1,
  });
  if (existing.data[0]) {
    const p = existing.data[0];
    return stripe.products.update(p.id, {
      name: opts.name,
      description: opts.description,
      metadata: { ...opts.metadata, cliste_lookup_key: opts.lookupKey },
      active: true,
    });
  }
  return stripe.products.create({
    name: opts.name,
    description: opts.description,
    metadata: { ...opts.metadata, cliste_lookup_key: opts.lookupKey },
  });
}

async function upsertCallMinutesMeter(
  stripe: Stripe,
): Promise<Stripe.Billing.Meter> {
  return upsertBillingMeter(stripe, {
    eventName: "cliste_call_minute",
    displayName: "Cliste AI call minutes",
  });
}

async function upsertSmsMeter(
  stripe: Stripe,
): Promise<Stripe.Billing.Meter> {
  return upsertBillingMeter(stripe, {
    eventName: "cliste_sms",
    displayName: "Cliste outbound SMS",
  });
}

async function upsertBillingMeter(
  stripe: Stripe,
  opts: { eventName: string; displayName: string },
): Promise<Stripe.Billing.Meter> {
  const existing = await stripe.billing.meters.list({ limit: 100 });
  const active = existing.data.find(
    (m) => m.event_name === opts.eventName && m.status !== "inactive",
  );
  if (active) {
    return active;
  }
  return stripe.billing.meters.create({
    display_name: opts.displayName,
    event_name: opts.eventName,
    default_aggregation: { formula: "sum" },
    customer_mapping: {
      event_payload_key: "stripe_customer_id",
      type: "by_id",
    },
    value_settings: { event_payload_key: "value" },
  });
}

async function upsertPrice(
  stripe: Stripe,
  opts: {
    lookupKey: string;
    product: string;
    unitAmount: number;
    currency: string;
    interval?: "month" | "year";
    oneTime?: boolean;
    metered?: boolean;
    meterId?: string;
    nickname: string;
    metadata: Record<string, string>;
  },
): Promise<Stripe.Price> {
  const existing = await stripe.prices.list({
    lookup_keys: [opts.lookupKey],
    limit: 1,
    active: true,
  });

  const current = existing.data[0];
  if (current) {
    const sameAmount = current.unit_amount === opts.unitAmount;
    const sameCurrency = current.currency === opts.currency;
    const sameInterval =
      opts.oneTime
        ? current.type === "one_time"
        : current.recurring?.interval === opts.interval;
    const sameUsageType = opts.metered
      ? current.recurring?.usage_type === "metered"
      : opts.oneTime
        ? true
        : current.recurring?.usage_type === "licensed";
    const sameMeter = opts.metered
      ? (current.recurring as { meter?: string } | undefined)?.meter ===
        opts.meterId
      : true;

    if (sameAmount && sameCurrency && sameInterval && sameUsageType && sameMeter) {
      return stripe.prices.update(current.id, {
        nickname: opts.nickname,
        metadata: { ...opts.metadata, cliste_lookup_key: opts.lookupKey },
      });
    }
    // Rate / interval changed — deactivate the old price and create a new one
    // with the same lookup_key. Stripe auto-moves the lookup_key to the
    // newest active price so subscriptions created from now on use the new
    // amount; existing subscriptions keep the old one until renewal.
    await stripe.prices.update(current.id, {
      active: false,
      lookup_key: `${opts.lookupKey}_archived_${Date.now()}`,
    });
  }

  return stripe.prices.create({
    product: opts.product,
    currency: opts.currency,
    unit_amount: opts.unitAmount,
    lookup_key: opts.lookupKey,
    nickname: opts.nickname,
    metadata: { ...opts.metadata, cliste_lookup_key: opts.lookupKey },
    ...(opts.oneTime
      ? { /* one-time price */ }
      : {
          recurring: {
            interval: opts.interval ?? "month",
            // Meter-backed metered price (Stripe API 2025-03-31+). The meter
            // itself owns the aggregation formula, so don't set
            // aggregate_usage here.
            ...(opts.metered && opts.meterId
              ? { meter: opts.meterId, usage_type: "metered" as const }
              : { usage_type: "licensed" as const }),
          },
        }),
    transfer_lookup_key: true,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
