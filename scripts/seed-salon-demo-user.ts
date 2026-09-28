/**
 * Dev-only: create a fully onboarded Salon & Beauty account you can sign in with.
 *
 *   npx tsx scripts/seed-salon-demo-user.ts
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { randomBytes } from "node:crypto";

import { PLANS } from "../src/lib/cliste-plans.data";
import { LEGAL_DOCUMENT_VERSIONS } from "../src/lib/legal-documents";
import { CLISTE_DEFAULT_ELEVENLABS_VOICE_ID } from "../src/lib/onboarding-voice-presets";
import {
  buildDefaultVoiceGreeting,
  VOICE_ASSISTANT_DEFAULT_NAME,
} from "../src/lib/voice-greeting";
import { createAdminClient } from "../src/utils/supabase/admin";
import { readTestSeedCredentials } from "../src/lib/test-seed-credentials";

const SALON_NAME = "Bloom Beauty Studio";
const OWNER_FIRST = "Sarah";
const OWNER_LAST = "Murphy";
const OWNER_NAME = `${OWNER_FIRST} ${OWNER_LAST}`;
const ADDRESS = "14 Grafton Street, Dublin 2";
const EIRCODE = "D02 VF65";
const OWNER_PHONE = "+353871234567";
const PLAN_TIER = "starter" as const;

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);
}

async function uniqueSlug(
  admin: ReturnType<typeof createAdminClient>,
  base: string,
): Promise<string> {
  let candidate = base || "salon";
  for (let i = 0; i < 25; i++) {
    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${base.slice(0, 36)}-${randomBytes(2).toString("hex")}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function assignPoolPhone(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
): Promise<string | null> {
  const { data: row } = await admin
    .from("phone_numbers")
    .select("id, e164")
    .is("organization_id", null)
    .eq("status", "available")
    .limit(1)
    .maybeSingle();

  if (!row?.e164) return null;

  const now = new Date().toISOString();
  await admin
    .from("phone_numbers")
    .update({
      organization_id: organizationId,
      status: "assigned",
      assigned_at: now,
      updated_at: now,
    })
    .eq("id", row.id);

  await admin
    .from("organizations")
    .update({ phone_number: row.e164, updated_at: now })
    .eq("id", organizationId);

  return row.e164 as string;
}

async function main() {
  const { email, password } = readTestSeedCredentials();
  const slug = await uniqueSlug(createAdminClient(), slugify(SALON_NAME));
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const plan = PLANS[PLAN_TIER];
  const greeting = buildDefaultVoiceGreeting(
    SALON_NAME,
    VOICE_ASSISTANT_DEFAULT_NAME,
    "How can I help you today?",
  );

  const businessDescription =
    "Full-service hair and beauty salon in Dublin city centre — cuts, colour, balayage, blow-dries, gel nails, lash lifts, and express facials.";
  const knowledgeSummary =
    "Bloom Beauty Studio is a busy city-centre salon focused on appointment-based hair and beauty services. Walk-ins are welcome when a stylist is free, but booking is recommended for colour and longer treatments.";
  const services =
    "Haircuts, blow-dries, full colour, balayage, root touch-ups, gel manicures, pedicures, lash lifts, brow shaping, express facials";
  const hours =
    "Tuesday–Friday 9:00–18:00, Saturday 9:00–17:00. Closed Sunday and Monday.";
  const faqs = [
    {
      question: "Do you take walk-ins?",
      answer:
        "Yes when a stylist is free, but we recommend booking for colour or longer appointments.",
    },
    {
      question: "Is there parking nearby?",
      answer:
        "Street parking on Grafton Street and paid car parks on Stephen's Green within a few minutes' walk.",
    },
    {
      question: "What is your cancellation policy?",
      answer:
        "Please give at least 24 hours notice so we can offer the slot to another client.",
    },
  ];

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: OWNER_NAME,
      first_name: OWNER_FIRST,
      last_name: OWNER_LAST,
      phone: OWNER_PHONE,
      source: "dev_seed",
    },
    app_metadata: {
      cliste_signup_source: "dev_seed",
    },
  });

  if (authError || !authData.user?.id) {
    throw new Error(authError?.message ?? "Could not create auth user.");
  }

  const userId = authData.user.id;

  const billingPatch = {
    plan_tier: PLAN_TIER,
    billing_interval: "month" as const,
    launch_tier: "diy" as const,
    application_fee_bps: plan.applicationFeeBps,
    platform_subscription_id: "dev_seed_skipped",
    status: "active",
    launch_status: "completed",
    billing_period_start: now.slice(0, 10),
    updated_at: now,
  };

  const { data: accountRow, error: accountErr } = await admin
    .from("accounts")
    .insert({
      name: SALON_NAME,
      slug,
      ...billingPatch,
    })
    .select("id")
    .single();

  if (accountErr || !accountRow?.id) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    throw new Error(accountErr?.message ?? "Could not create account.");
  }

  const accountId = accountRow.id as string;

  const orgPatch = {
    account_id: accountId,
    is_primary_location: true,
    name: SALON_NAME,
    slug,
    tier: "native",
    niche: "beauty",
    agent_business_type: "Salon & Beauty — hair, nails and lashes",
    is_active: true,
    onboarding_step: 7,
    address: ADDRESS,
    storefront_eircode: EIRCODE,
    agent_location_address: ADDRESS,
    agent_location_eircode: EIRCODE,
    notification_email: email,
    notification_phone: OWNER_PHONE,
    raw_business_description: businessDescription,
    business_knowledge_summary: knowledgeSummary,
    agent_services_departments: services,
    agent_opening_hours: hours,
    agent_service_area: "Dublin city centre and surrounding suburbs",
    agent_faqs: faqs,
    assistant_display_name: VOICE_ASSISTANT_DEFAULT_NAME,
    agent_voice_id: CLISTE_DEFAULT_ELEVENLABS_VOICE_ID,
    greeting,
    caller_privacy_acknowledged_at: now,
    train_cara_step: "done",
    ...billingPatch,
    updated_at: now,
  };

  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .insert(orgPatch)
    .select("id")
    .single();

  if (orgErr || !orgRow?.id) {
    await admin.from("accounts").delete().eq("id", accountId);
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    throw new Error(orgErr?.message ?? "Could not create organization.");
  }

  const organizationId = orgRow.id as string;

  const { error: profileErr } = await admin.from("profiles").insert({
    id: userId,
    account_id: accountId,
    organization_id: organizationId,
    active_organization_id: organizationId,
    role: "admin",
    name: OWNER_NAME,
    updated_at: now,
  });

  if (profileErr) {
    await admin.from("organizations").delete().eq("id", organizationId);
    await admin.from("accounts").delete().eq("id", accountId);
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    throw new Error(profileErr.message);
  }

  await admin.from("account_memberships").insert({
    user_id: userId,
    account_id: accountId,
    role: "admin",
  });

  await admin.from("onboarding_applications").insert({
    organization_id: organizationId,
    review_status: "auto_approved",
    fraud_score: 0,
    reasons: ["dev_seed"],
  });

  const legalRows = (["terms", "privacy", "dpa"] as const).map((documentType) => ({
    user_id: userId,
    organization_id: organizationId,
    document_type: documentType,
    document_version: LEGAL_DOCUMENT_VERSIONS[documentType],
    ip_hash: null,
    user_agent: "scripts/seed-salon-demo-user.ts",
  }));

  await admin.from("legal_acceptances").insert(legalRows);

  const assignedPhone = await assignPoolPhone(admin, organizationId);

  console.log("\n✓ Salon demo account ready\n");
  console.log(`  Sign in:  http://localhost:3001/authenticate`);
  console.log(`  Email:    ${email}`);
  console.log("  Password: use the unique value supplied through CLISTE_SEED_PASSWORD.");
  console.log(`  Salon:    ${SALON_NAME} (niche: beauty / Salon & Beauty)`);
  console.log(`  Org ID:   ${organizationId}`);
  if (assignedPhone) {
    console.log(`  Cliste #: ${assignedPhone}`);
  } else {
    console.log("  Cliste #: (none in pool — assign via admin if needed)");
  }
  console.log("\n  After sign-in you should land on /dashboard directly.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
