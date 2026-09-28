import assert from "node:assert/strict";
import test from "node:test";
import { readTestSeedCredentials } from "./test-seed-credentials";

const local = {
  NODE_ENV: "test",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  CLISTE_SEED_TARGET_URL: "http://127.0.0.1:54321",
  CLISTE_SEED_ENVIRONMENT: "local",
  CLISTE_SEED_EMAIL: "fixture@example.test",
  CLISTE_SEED_PASSWORD: "test-fixture-only-not-a-real-password",
};

test("seed credentials require an explicit matching target before accepting a password", () => {
  for (const override of [
    { CLISTE_SEED_TARGET_URL: undefined },
    { CLISTE_SEED_TARGET_URL: "http://localhost:54321" },
    { CLISTE_SEED_ENVIRONMENT: undefined },
    { NODE_ENV: "production" },
    { VERCEL_ENV: "production" },
  ]) assert.throws(() => readTestSeedCredentials({ ...local, ...override }));
  assert.equal(readTestSeedCredentials(local).email, "fixture@example.test");
});

test("hosted targets need an exact HTTPS test-project selection", () => {
  const hosted = {
    ...local,
    NEXT_PUBLIC_SUPABASE_URL: "https://designated-test.supabase.co",
    CLISTE_SEED_TARGET_URL: "https://designated-test.supabase.co",
    CLISTE_SEED_ENVIRONMENT: "test",
  };
  assert.throws(() => readTestSeedCredentials(hosted));
  assert.throws(() => readTestSeedCredentials({ ...hosted, CLISTE_SEED_TEST_PROJECT_REF: "different" }));
  assert.equal(readTestSeedCredentials({ ...hosted, CLISTE_SEED_TEST_PROJECT_REF: "designated-test" }).email, local.CLISTE_SEED_EMAIL);
  for (const url of ["http://designated-test.supabase.co", "https://designated-test.supabase.co.evil.test", "https://designated-test.supabase.co/path", "https://user:pass@designated-test.supabase.co"]) {
    assert.throws(() => readTestSeedCredentials({ ...hosted, CLISTE_SEED_TEST_PROJECT_REF: "designated-test", NEXT_PUBLIC_SUPABASE_URL: url, CLISTE_SEED_TARGET_URL: url }));
  }
});

test("seed accounts have no fallback email or password", () => {
  for (const override of [
    { CLISTE_SEED_EMAIL: undefined },
    { CLISTE_SEED_PASSWORD: undefined },
    { CLISTE_SEED_PASSWORD: "short" },
    { CLISTE_SEED_PASSWORD: ` ${local.CLISTE_SEED_PASSWORD}` },
  ]) assert.throws(() => readTestSeedCredentials({ ...local, ...override }));
});
