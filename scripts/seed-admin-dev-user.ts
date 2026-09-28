/**
 * Local/test-only: grant platform admin console access with explicitly supplied credentials.
 *
 *   npx tsx scripts/seed-admin-dev-user.ts
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { createAdminClient } from "../src/utils/supabase/admin";
import { readTestSeedCredentials } from "../src/lib/test-seed-credentials";

const { email: EMAIL, password: PASSWORD } = readTestSeedCredentials();

async function main() {
  const admin = createAdminClient();
  const normalized = EMAIL.toLowerCase();

  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = listed?.users.find(
    (u) => u.email?.toLowerCase() === normalized,
  );

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      app_metadata: {
        ...((existing.app_metadata as Record<string, unknown>) ?? {}),
        cliste_admin_console: true,
      },
    });
    if (error) throw error;
    console.log(`Updated ${EMAIL} with admin console access.`);
  } else {
    const { error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { cliste_admin_console: true },
      user_metadata: { full_name: "Cliste Admin (dev)" },
    });
    if (error) throw error;
    console.log(`Created ${EMAIL} with admin console access.`);
  }

  console.log("\nAdmin sign-in:");
  console.log("  Gate:        http://localhost:3001/admin/login");
  console.log("  Console:     http://localhost:3001/admin");
  console.log("  Auth:        http://localhost:3001/authenticate");
  console.log(`  Email:       ${EMAIL}`);
  console.log("  Password: use the unique value supplied through CLISTE_SEED_PASSWORD.");
  console.log("\nUse CLISTE_ADMIN_SECRET from .env.local at the gate.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
