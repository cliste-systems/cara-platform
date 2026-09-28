type SeedEnvironment = Record<string, string | undefined>;

/** Reject accidental production seeding before a service-role client is created. */
export function readTestSeedCredentials(env: SeedEnvironment = process.env): {
  email: string;
  password: string;
} {
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    throw new Error("Test account seed scripts cannot run in production.");
  }

  const mode = env.CLISTE_SEED_ENVIRONMENT?.trim();
  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const acknowledgedUrl = env.CLISTE_SEED_TARGET_URL?.trim();
  if (!rawUrl || !acknowledgedUrl || rawUrl.replace(/\/$/, "") !== acknowledgedUrl.replace(/\/$/, "")) {
    throw new Error("Set CLISTE_SEED_TARGET_URL to the exact intended local/test Supabase URL.");
  }
  const target = new URL(rawUrl);
  if (target.username || target.password || target.search || target.hash || target.pathname !== "/") {
    throw new Error("The seed target must be a plain Supabase origin.");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
  if (loopback) {
    if (mode !== "local" || !["http:", "https:"].includes(target.protocol)) {
      throw new Error("Local test seeding requires CLISTE_SEED_ENVIRONMENT=local.");
    }
  } else {
    const testProject = env.CLISTE_SEED_TEST_PROJECT_REF?.trim();
    if (
      mode !== "test" ||
      !testProject ||
      !/^[a-z0-9-]+$/.test(testProject) ||
      target.protocol !== "https:" ||
      target.port ||
      ![`${testProject}.supabase.co`, `${testProject}.supabase.in`].includes(target.hostname)
    ) {
      throw new Error("Hosted seeding requires an explicitly selected test project and CLISTE_SEED_ENVIRONMENT=test.");
    }
  }

  const email = env.CLISTE_SEED_EMAIL?.trim().toLowerCase();
  const password = env.CLISTE_SEED_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Set CLISTE_SEED_EMAIL to the intended test account address.");
  }
  if (!password || password.length < 24 || password.length > 128 || password.trim() !== password) {
    throw new Error("Supply a unique password-manager-generated CLISTE_SEED_PASSWORD of 24–128 characters.");
  }
  return { email, password };
}
