/**
 * Dev-only: create a fully onboarded retail shop account for /dashboard.
 *
 *   npx tsx scripts/seed-retail-demo-user.ts
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

const SHOP_NAME = "Murphy's SuperValu";
const OWNER_NAME = "Pat Murphy";
const ADDRESS = "Main Street, Killarney, Co. Kerry";
const EIRCODE = "V93 X7P2";
const OWNER_PHONE = "+353871234567";
const PLAN_TIER = "starter" as const;
const { email: EMAIL, password: PASSWORD } = readTestSeedCredentials();

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
  let candidate = base || "shop";
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

const INTERNAL_QA_LINE_E164 = "+353109307440";

async function assignPoolPhone(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
): Promise<string | null> {
  const { data: row } = await admin
    .from("phone_numbers")
    .select("id, e164")
    .eq("e164", INTERNAL_QA_LINE_E164)
    .eq("status", "available")
    .maybeSingle();

  if (!row?.e164) {
    throw new Error(
      `${INTERNAL_QA_LINE_E164} is not available in phone_numbers — release it or seed the pool first.`,
    );
  }

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

async function deleteUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const existing = list.users.find(
    (user) => user.email?.trim().toLowerCase() === normalized,
  );
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id);
    console.log(`Removed existing auth user ${normalized}`);
  }
}

async function main() {
  const admin = createAdminClient();
  const email = EMAIL;
  const password = PASSWORD;
  const slug = await uniqueSlug(admin, slugify(SHOP_NAME));
  const now = new Date().toISOString();
  const plan = PLANS[PLAN_TIER];
  const greeting = buildDefaultVoiceGreeting(
    SHOP_NAME,
    VOICE_ASSISTANT_DEFAULT_NAME,
    "How can I help you today?",
  );

  await deleteUserByEmail(admin, email);

  const businessDescription =
    "Independent supermarket — grocery, deli, butcher, bakery, and off-licence.";
  const knowledgeSummary =
    "Murphy's SuperValu is a local supermarket. Cara answers opening hours, department questions, and takes messages for the shop team.";
  const departments = "Deli, Butcher, Bakery, Customer Service, Off-licence";
  const hours =
    "Monday–Saturday 8:00–21:00, Sunday 9:00–18:00. Bank holidays may vary.";
  const faqs = [
    {
      question: "Do you have click and collect?",
      answer: "Yes — ask at Customer Service and we'll point you to the right team.",
    },
    {
      question: "Where is the deli counter?",
      answer: "At the back of the shop, next to the bakery.",
    },
  ];

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: OWNER_NAME,
      phone: OWNER_PHONE,
      source: "dev_retail_seed",
    },
    app_metadata: {
      cliste_signup_source: "dev_retail_seed",
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
      name: SHOP_NAME,
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
    name: SHOP_NAME,
    slug,
    tier: "native",
    niche: "retail",
    retail_banner: "supervalu",
    store_code: "DEMO-001",
    store_public_number: "+353641234567",
    agent_business_type: "Retail & Grocery — local supermarket",
    is_active: true,
    onboarding_step: 7,
    address: ADDRESS,
    storefront_eircode: EIRCODE,
    agent_location_address: ADDRESS,
    agent_location_eircode: EIRCODE,
    agent_location_county: "Kerry",
    retail_facilities: ["parking", "atm", "pharmacy"],
    retail_loyalty_program: "Real Rewards",
    notification_email: email,
    notification_phone: OWNER_PHONE,
    raw_business_description: businessDescription,
    business_knowledge_summary: knowledgeSummary,
    agent_services_departments: departments,
    agent_opening_hours: hours,
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

  await admin.from("store_departments").insert([
    { organization_id: organizationId, name: "Customer service", sort_order: 0, transfer_enabled: true, active: true },
    { organization_id: organizationId, name: "Deli / hot food", sort_order: 1, transfer_enabled: true, active: true },
    { organization_id: organizationId, name: "Butcher", sort_order: 2, transfer_enabled: true, active: true },
  ]);

  await admin.from("store_contacts").insert({
    organization_id: organizationId,
    name: OWNER_NAME,
    role: "store_manager",
    phone_e164: OWNER_PHONE,
    email,
    is_notification_target: true,
    active: true,
  });

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
    reasons: ["dev_retail_seed"],
  });

  const legalRows = (["terms", "privacy", "dpa"] as const).map((documentType) => ({
    user_id: userId,
    organization_id: organizationId,
    document_type: documentType,
    document_version: LEGAL_DOCUMENT_VERSIONS[documentType],
    ip_hash: null,
    user_agent: "scripts/seed-retail-demo-user.ts",
  }));

  await admin.from("legal_acceptances").insert(legalRows);

  const assignedPhone = await assignPoolPhone(admin, organizationId);

  console.log("\n✓ Retail shop account ready\n");
  console.log("  Sign in:  http://localhost:3001/authenticate");
  console.log("  Dashboard: http://localhost:3001/dashboard");
  console.log(`  Email:    ${email}`);
  console.log("  Password: use the unique value supplied through CLISTE_SEED_PASSWORD.");
  console.log(`  Shop:     ${SHOP_NAME} (niche: retail)`);
  console.log(`  Org ID:   ${organizationId}`);
  if (assignedPhone) {
    console.log(`  Cliste #: ${assignedPhone}`);
  } else {
    console.log("  Cliste #: (none in pool — assign via admin if needed)");
  }
  console.log("\n  After sign-in you should land on /dashboard.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
