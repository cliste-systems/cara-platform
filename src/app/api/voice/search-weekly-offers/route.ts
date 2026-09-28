import { NextResponse } from "next/server";

import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import {
  inferWeeklyOffersListIntent,
  loadLatestRetailOfferWeekEnd,
  RETAIL_WEEKLY_OFFERS_SEARCH_MAX_QUERY_CHARS,
  searchRetailWeeklyOffers,
} from "@/lib/retail-weekly-offers-search";
import { RETAIL_OFFERS_UNVERIFIED_MESSAGE } from "@/lib/retail-offer-freshness";
import { buildProductClarificationHint } from "@/lib/retail-product-clarification";
import type {
  SupervaluFulfilment,
  SupervaluOfferChannel,
  SupervaluServiceArea,
} from "@/lib/supervalu-offers-types";
import {
  authorizeVoiceWebhook,
  voiceWebhookNoSecretResponse,
  voiceWebhookUnauthorizedResponse,
} from "@/lib/voice-webhook-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

type SearchWeeklyOffersBody = {
  called_number?: string;
  query?: string;
  channel?: SupervaluOfferChannel;
  service_area?: SupervaluServiceArea;
  fulfilment?: SupervaluFulfilment;
};

/**
 * Voice worker: search synced national SuperValu weekly offers.
 * Cara quotes only rows returned here — never from memory.
 */
export async function POST(request: Request) {
  const auth = await authorizeVoiceWebhook(request);
  if (auth === "no_secret") return voiceWebhookNoSecretResponse();
  if (auth === "bad") return voiceWebhookUnauthorizedResponse();

  let body: SearchWeeklyOffersBody;
  try {
    body = (await request.json()) as SearchWeeklyOffersBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const calledNumberRaw = String(body.called_number ?? "").trim();
  if (!calledNumberRaw) {
    return NextResponse.json(
      { ok: false, error: "called_number is required" },
      { status: 400 },
    );
  }

  const query = String(body.query ?? "").trim();
  if (!query) {
    return NextResponse.json(
      { ok: false, error: "query is required" },
      { status: 400 },
    );
  }
  if (query.length > RETAIL_WEEKLY_OFFERS_SEARCH_MAX_QUERY_CHARS) {
    return NextResponse.json(
      {
        ok: false,
        error: `query must be at most ${RETAIL_WEEKLY_OFFERS_SEARCH_MAX_QUERY_CHARS} characters`,
      },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Server configuration error",
      },
      { status: 503 },
    );
  }

  const calledE164 =
    normalizeCustomerPhoneE164(calledNumberRaw) || calledNumberRaw;
  const { data: phoneRow, error: phoneErr } = await admin
    .from("phone_numbers")
    .select("organization_id")
    .eq("e164", calledE164)
    .maybeSingle();

  if (phoneErr) {
    console.error("[voice/search-weekly-offers] phone lookup", phoneErr);
    return NextResponse.json(
      { ok: false, error: "Database error" },
      { status: 500 },
    );
  }
  if (!phoneRow?.organization_id) {
    return NextResponse.json(
      {
        ok: false,
        error: `called_number ${calledE164} is not assigned to any organization`,
      },
      { status: 404 },
    );
  }

  const orgId = phoneRow.organization_id as string;

  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("is_active, niche, retail_banner")
    .eq("id", orgId)
    .maybeSingle();
  if (orgErr) {
    console.error("[voice/search-weekly-offers] org lookup", orgErr);
    return NextResponse.json(
      { ok: false, error: "Database error" },
      { status: 500 },
    );
  }
  if (!orgRow?.is_active) {
    return NextResponse.json(
      { ok: false, code: "org_suspended", error: "Organization is not active" },
      { status: 403 },
    );
  }
  if (String(orgRow.niche ?? "") !== "retail") {
    return NextResponse.json(
      { ok: false, error: "Weekly offers lookup is only available for retail orgs" },
      { status: 403 },
    );
  }
  const retailBanner = String(orgRow.retail_banner ?? "").trim();
  if (retailBanner !== "supervalu") {
    return NextResponse.json(
      { ok: false, error: "Weekly offers lookup is not enabled for this banner" },
      { status: 403 },
    );
  }

  const channel =
    body.channel === "butcher_counter" || body.channel === "prepack"
      ? body.channel
      : undefined;

  const serviceArea =
    body.service_area === "butcher" ||
    body.service_area === "deli" ||
    body.service_area === "fish" ||
    body.service_area === "produce" ||
    body.service_area === "bakery" ||
    body.service_area === "dairy" ||
    body.service_area === "off_licence" ||
    body.service_area === "grocery"
      ? body.service_area
      : undefined;

  const fulfilment =
    body.fulfilment === "counter" || body.fulfilment === "prepack"
      ? body.fulfilment
      : undefined;

  const reference = new Date();
  const [matches, latestOfferWeekEnd] = await Promise.all([
    searchRetailWeeklyOffers(admin, retailBanner, query, { channel, serviceArea, fulfilment, reference }),
    loadLatestRetailOfferWeekEnd(admin, retailBanner, reference),
  ]);

  const mappedMatches = matches.map((match) => ({
    id: match.id,
    product_name: match.productName,
    department: match.department,
    offer_channel: match.offerChannel,
    service_area: match.serviceArea,
    fulfilment: match.fulfilment,
    is_alcohol: match.isAlcohol,
    campaign_names: match.campaignNames,
    current_price_eur: match.currentPriceEur,
    was_price_eur: match.wasPriceEur,
    discount_label: match.discountLabel,
    price_per_unit: match.pricePerUnit,
    score: match.score,
    quote_text: match.quoteText,
  }));
  const clarificationHint = buildProductClarificationHint(query, mappedMatches);

  return NextResponse.json({
    ok: true,
    channel: channel ?? null,
    service_area: serviceArea ?? null,
    fulfilment: fulfilment ?? null,
    list: inferWeeklyOffersListIntent(query),
    clarification_hint: clarificationHint,
    offers_freshness: latestOfferWeekEnd == null ? RETAIL_OFFERS_UNVERIFIED_MESSAGE : null,
    no_match_quote: mappedMatches.length === 0
      ? "I couldn't verify a current national offer matching that request. A team member can check the offers in store."
      : null,
    matches: clarificationHint ? [] : mappedMatches,
  });
}
