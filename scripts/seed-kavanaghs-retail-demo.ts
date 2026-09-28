/**
 * Provision Kavanaghs SuperValu Donegal Town for the retail phone-to-dashboard demo.
 *
 *   npx tsx scripts/seed-kavanaghs-retail-demo.ts
 *   npx tsx scripts/seed-kavanaghs-retail-demo.ts --manager-phone +35387...
 *
 * Assigns +353749759508, compiles custom_prompt, and creates presenter login.
 */

import "./mock-server-only.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

import { randomBytes } from "node:crypto";

import { PLANS } from "../src/lib/cliste-plans.data";
import { LEGAL_DOCUMENT_VERSIONS } from "../src/lib/legal-documents";
import { CLISTE_DEFAULT_ELEVENLABS_VOICE_ID } from "../src/lib/onboarding-voice-presets";
import { buildRetailRoutePack } from "../src/lib/retail-route-pack";
import {
  buildDefaultVoiceGreeting,
  VOICE_ASSISTANT_DEFAULT_NAME,
} from "../src/lib/voice-greeting";
import { createAdminClient } from "../src/utils/supabase/admin";
import { readTestSeedCredentials } from "../src/lib/test-seed-credentials";
import { regenerateCaraCustomPrompt } from "../src/lib/cara-prompt-from-org";

const SHOP_NAME = "Kavanaghs SuperValu Donegal Town";
const SHOP_SLUG = "kavanaghs-supervalu-donegal-town";
const RETAIL_LINE_E164 = "+353749759508";
const ADDRESS = "Quay Street, Donegal Town, Co. Donegal";
const EIRCODE = "F94 E8N2";
const { email: PRESENTER_EMAIL, password: PRESENTER_PASSWORD } = readTestSeedCredentials();
const PRESENTER_NAME = "Garreth Ferry";
const STORE_MANAGER_NAME = "Garreth Ferry";
const FRESH_FOOD_MANAGER_NAME = "Mark O'Toole";
const DEFAULT_MANAGER_PHONE = "+353872715938";

const BUSINESS_HOURS = {
  monday: { open: true, start: "08:00", end: "21:00" },
  tuesday: { open: true, start: "08:00", end: "21:00" },
  wednesday: { open: true, start: "08:00", end: "21:00" },
  thursday: { open: true, start: "08:00", end: "21:00" },
  friday: { open: true, start: "08:00", end: "21:00" },
  saturday: { open: true, start: "08:00", end: "21:00" },
  sunday: { open: true, start: "09:00", end: "18:00" },
  _bankHolidaysConfigured: true,
  _bankHolidaysOpen: false,
};

function parseArgs(): { managerPhone: string; managerName: string } {
  const args = process.argv.slice(2);
  let managerPhone = process.env.KAVANAGHS_MANAGER_PHONE?.trim() || DEFAULT_MANAGER_PHONE;
  let managerName = STORE_MANAGER_NAME;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--manager-phone" && args[i + 1]) managerPhone = args[++i];
    if (args[i] === "--manager-name" && args[i + 1]) managerName = args[++i];
  }
  return { managerPhone, managerName };
}

function buildKavanaghsCustomPrompt(
  storeManagerName: string,
  freshFoodManagerName: string,
): string {
  return [
    "You are Cara, the AI phone assistant for Kavanaghs SuperValu Donegal Town on Quay Street.",
    "Answer opening hours from the structured hours block when callers ask when the shop is open.",
    "Never quote prices or confirm stock on the phone — take a message for the team instead.",
    "",
    "Store departments — message-taking only:",
    `• Bakery (birthday cakes, custom cakes, pick-up times, celebration orders) — I take their name, number, and what they need, and pass it to Bakery.`,
    `• Customer Service (complaints, speak-to-manager requests, general store enquiries) — manager: ${storeManagerName} — I take their name, number, and what they need, and pass it to Customer Service.`,
    `• Fresh Food (bakery, deli, butcher counters — fresh food manager enquiries) — manager: ${freshFoodManagerName} — I take their name, number, and what they need, and pass it to Fresh Food.`,
    "• Deli (hot food, party platters, deli counter) — I take their name, number, and what they need, and pass it to Deli.",
    "• Butcher (meat orders, Sunday roasts, special cuts) — I take their name, number, and what they need, and pass it to Butcher.",
    "• Off-licence (wine and spirits counter) — off-licence: I never sell alcohol or take ID details; I send callers to the counter.",
    "",
    "Birthday cake and bakery orders: capture name, callback number, cake type, date needed, servings, and any message on the cake. Never quote price — log it for the bakery team.",
    "When someone asks to speak to the manager, use transferToTeam or takeCallbackMessage with full details.",
    "Real Rewards loyalty cards, click and collect, deli platters, and complaints should be logged for the right department.",
  ].join("\n");
}

function bakeryCakeRoute() {
  return {
    id: "retail-bakery-cake",
    label: "Birthday cake, bakery order",
    intent: "birthday cake, bakery order, custom cake",
    targetType: "callback" as const,
    url:
      "Name, phone number, cake type, date needed, number of servings, and any message on the cake. Never quote price on the call.",
    presetId: "quote",
    keywords:
      "birthday cake, bakery, custom cake, sponge, celebration cake, order a cake, christening cake",
    active: true,
  };
}

async function deleteUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const existing = list.users.find((user) => user.email?.trim().toLowerCase() === normalized);
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id);
    console.log(`Removed existing auth user ${normalized}`);
  }
}

async function findOrgBySlug(
  admin: ReturnType<typeof createAdminClient>,
  slug: string,
): Promise<{ id: string; accountId: string } | null> {
  const { data, error } = await admin
    .from("organizations")
    .select("id, account_id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id || !data.account_id) return null;
  return { id: data.id as string, accountId: data.account_id as string };
}

async function assignRetailLine(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
): Promise<void> {
  const now = new Date().toISOString();

  const { data: phoneRow, error: phoneErr } = await admin
    .from("phone_numbers")
    .select("id, organization_id")
    .eq("e164", RETAIL_LINE_E164)
    .maybeSingle();
  if (phoneErr || !phoneRow?.id) {
    throw new Error(`${RETAIL_LINE_E164} not found in phone_numbers pool.`);
  }

  if (phoneRow.organization_id && phoneRow.organization_id !== organizationId) {
    await admin
      .from("phone_numbers")
      .update({ organization_id: null, status: "available", updated_at: now })
      .eq("organization_id", phoneRow.organization_id)
      .eq("e164", RETAIL_LINE_E164);
  }

  await admin
    .from("phone_numbers")
    .update({
      organization_id: organizationId,
      status: "assigned",
      assigned_at: now,
      updated_at: now,
    })
    .eq("id", phoneRow.id);

  await admin
    .from("organizations")
    .update({ phone_number: RETAIL_LINE_E164, updated_at: now })
    .eq("id", organizationId);
}

async function upsertDepartments(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  storeManagerName: string,
  freshFoodManagerName: string,
): Promise<void> {
  await admin.from("store_departments").delete().eq("organization_id", organizationId);

  const departments = [
    {
      organization_id: organizationId,
      name: "Bakery",
      sort_order: 0,
      transfer_enabled: false,
      active: true,
      handles_text: "birthday cakes, custom cakes, pick-up times, celebration orders",
      manager_name: null,
      is_off_licence: false,
      is_an_post: false,
    },
    {
      organization_id: organizationId,
      name: "Customer Service",
      sort_order: 1,
      transfer_enabled: false,
      active: true,
      handles_text: "complaints, speak-to-manager requests, general store enquiries",
      manager_name: storeManagerName,
      is_off_licence: false,
      is_an_post: false,
    },
    {
      organization_id: organizationId,
      name: "Fresh Food",
      sort_order: 2,
      transfer_enabled: false,
      active: true,
      handles_text: "fresh food manager enquiries, bakery, deli, and butcher counter oversight",
      manager_name: freshFoodManagerName,
      is_off_licence: false,
      is_an_post: false,
    },
    {
      organization_id: organizationId,
      name: "Deli",
      sort_order: 3,
      transfer_enabled: false,
      active: true,
      handles_text: "hot food, party platters, deli counter",
      manager_name: null,
      is_off_licence: false,
      is_an_post: false,
    },
    {
      organization_id: organizationId,
      name: "Butcher",
      sort_order: 4,
      transfer_enabled: false,
      active: true,
      handles_text: "meat orders, Sunday roasts, special cuts",
      manager_name: null,
      is_off_licence: false,
      is_an_post: false,
    },
    {
      organization_id: organizationId,
      name: "Off-licence",
      sort_order: 5,
      transfer_enabled: false,
      active: true,
      handles_text: "wine and spirits counter",
      is_off_licence: true,
      is_an_post: false,
      manager_name: null,
    },
  ];

  const { error } = await admin.from("store_departments").insert(departments);
  if (error) throw error;
}

async function main() {
  const { managerPhone, managerName } = parseArgs();
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const plan = PLANS.starter;
  const greeting = buildDefaultVoiceGreeting(
    SHOP_NAME,
    VOICE_ASSISTANT_DEFAULT_NAME,
    "How can I help you today?",
  );
  const routingLinks = [...buildRetailRoutePack({}), bakeryCakeRoute()];

  let organizationId: string;
  let accountId: string;

  const existing = await findOrgBySlug(admin, SHOP_SLUG);
  if (existing) {
    organizationId = existing.id;
    accountId = existing.accountId;
    console.log(`Reusing existing org ${organizationId}`);
  } else {
    await deleteUserByEmail(admin, PRESENTER_EMAIL);

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: PRESENTER_EMAIL,
      password: PRESENTER_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: PRESENTER_NAME,
        source: "kavanaghs_retail_demo_seed",
      },
      app_metadata: {
        cliste_signup_source: "kavanaghs_retail_demo_seed",
      },
    });
    if (authError || !authData.user?.id) {
      throw new Error(authError?.message ?? "Could not create presenter auth user.");
    }
    const userId = authData.user.id;

    const billingPatch = {
      plan_tier: "starter" as const,
      billing_interval: "month" as const,
      launch_tier: "diy" as const,
      application_fee_bps: plan.applicationFeeBps,
      platform_subscription_id: "kavanaghs_demo_seed",
      status: "active",
      launch_status: "completed",
      billing_period_start: now.slice(0, 10),
      updated_at: now,
    };

    const { data: accountRow, error: accountErr } = await admin
      .from("accounts")
      .insert({
        name: SHOP_NAME,
        slug: `${SHOP_SLUG}-${randomBytes(2).toString("hex")}`.slice(0, 48),
        ...billingPatch,
      })
      .select("id")
      .single();
    if (accountErr || !accountRow?.id) {
      throw new Error(accountErr?.message ?? "Could not create account.");
    }
    accountId = accountRow.id as string;

    const { data: orgRow, error: orgErr } = await admin
      .from("organizations")
      .insert({
        account_id: accountId,
        is_primary_location: true,
        name: SHOP_NAME,
        slug: SHOP_SLUG,
        tier: "native",
        niche: "retail",
        retail_banner: "supervalu",
        store_code: "KAV-DG-001",
        store_public_number: "+353749722977",
        agent_business_type: "Retail & Grocery — local supermarket",
        is_active: true,
        onboarding_step: 7,
        address: ADDRESS,
        storefront_eircode: EIRCODE,
        agent_location_address: ADDRESS,
        agent_location_eircode: EIRCODE,
        agent_location_county: "Donegal",
        retail_facilities: ["parking", "atm"],
        retail_loyalty_program: "Real Rewards",
        notification_email: PRESENTER_EMAIL,
        notification_phone: managerPhone,
        fallback_number: managerPhone,
        call_routing_mode: "cliste_number",
        raw_business_description:
          "Independent SuperValu supermarket in Donegal Town — grocery, deli, butcher, bakery, and off-licence.",
        business_knowledge_summary:
          "Kavanaghs SuperValu Donegal Town is the local supermarket on Quay Street. Cara answers opening hours, department questions, and takes messages for the shop team.",
        agent_services_departments: "Bakery, Deli, Butcher, Customer Service, Off-licence",
        agent_opening_hours:
          "Monday–Saturday 8:00–21:00, Sunday 9:00–18:00. Closed on bank holidays.",
        business_hours: BUSINESS_HOURS,
        agent_faqs: [
          {
            question: "Where is the bakery?",
            answer: "Near the front of the shop beside Customer Service.",
          },
          {
            question: "Do you do birthday cakes?",
            answer:
              "Yes — the bakery team take orders. Cara logs the details for a callback; she does not quote prices on the phone.",
          },
        ],
        assistant_display_name: VOICE_ASSISTANT_DEFAULT_NAME,
        agent_voice_id: CLISTE_DEFAULT_ELEVENLABS_VOICE_ID,
        greeting,
        routing_links: routingLinks,
        quote_prices_on_calls: false,
        caller_privacy_acknowledged_at: now,
        train_cara_step: "done",
        ...billingPatch,
        updated_at: now,
      })
      .select("id")
      .single();
    if (orgErr || !orgRow?.id) {
      throw new Error(orgErr?.message ?? "Could not create organization.");
    }
    organizationId = orgRow.id as string;

    const { error: profileErr } = await admin.from("profiles").insert({
      id: userId,
      account_id: accountId,
      organization_id: organizationId,
      active_organization_id: organizationId,
      role: "admin",
      name: PRESENTER_NAME,
      updated_at: now,
    });
    if (profileErr) throw profileErr;

    await admin.from("account_memberships").insert({
      user_id: userId,
      account_id: accountId,
      role: "admin",
    });

    await admin.from("onboarding_applications").insert({
      organization_id: organizationId,
      review_status: "auto_approved",
      fraud_score: 0,
      reasons: ["kavanaghs_retail_demo_seed"],
    });

    const legalRows = (["terms", "privacy", "dpa"] as const).map((documentType) => ({
      user_id: userId,
      organization_id: organizationId,
      document_type: documentType,
      document_version: LEGAL_DOCUMENT_VERSIONS[documentType],
      ip_hash: null,
      user_agent: "scripts/seed-kavanaghs-retail-demo.ts",
    }));
    await admin.from("legal_acceptances").insert(legalRows);
  }

  await admin
    .from("organizations")
    .update({
      name: SHOP_NAME,
      greeting,
      notification_phone: managerPhone,
      notification_email: PRESENTER_EMAIL,
      fallback_number: managerPhone,
      call_routing_mode: "cliste_number",
      business_hours: BUSINESS_HOURS,
      routing_links: routingLinks,
      is_active: true,
      niche: "retail",
      updated_at: now,
    })
    .eq("id", organizationId);

  await upsertDepartments(
    admin,
    organizationId,
    managerName,
    FRESH_FOOD_MANAGER_NAME,
  );
  await assignRetailLine(admin, organizationId);

  const promptResult = await regenerateCaraCustomPrompt(admin, organizationId);
  if (!promptResult.ok) {
    throw new Error(promptResult.message);
  }

  console.log("\n✓ Kavanaghs retail demo ready\n");
  console.log(`  Shop:       ${SHOP_NAME}`);
  console.log(`  Org ID:     ${organizationId}`);
  console.log(`  Cliste #:   ${RETAIL_LINE_E164}`);
  console.log(`  Manager SMS:${managerPhone}`);
  console.log(`  Dashboard:  sign in as ${PRESENTER_EMAIL}`);
  console.log("  Password: use the unique value supplied through CLISTE_SEED_PASSWORD.");
  console.log("\n  Next: npx tsx scripts/seed-kavanaghs-dashboard-activity.ts\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
