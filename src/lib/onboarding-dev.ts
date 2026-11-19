import "server-only";

/**
 * Dev-only onboarding bypass — jump to any `/onboarding/*` step without guards.
 *
 * Enable locally: `CLISTE_ONBOARDING_FREE_NAV=true` in `.env.local`
 *
 * **Never set in production.** This flag is ignored when `NODE_ENV=production`.
 */
export function isOnboardingFreeNavEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.CLISTE_ONBOARDING_FREE_NAV === "true";
}

/**
 * Dev-only: relax signup + onboarding friction for local QA.
 *
 * Skips Turnstile, auth rate limits, fraud review queue, and voice API rate
 * limits. Pair with:
 *   CLISTE_ONBOARDING_FREE_NAV=true  — jump between onboarding steps
 *   CLISTE_ONBOARDING_PREVIEW=true   — unauthenticated plan/checkout preview
 *
 * Enable: `CLISTE_SIGNUP_ONBOARDING_DEV=true` in `.env.local`
 * Never set in production.
 */
export function isSignupOnboardingDevRelaxed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.CLISTE_SIGNUP_ONBOARDING_DEV === "true";
}

/** When false, onboarding pages enforce subscription + step-order redirects. */
export function enforceOnboardingStepOrder(): boolean {
  return !isOnboardingFreeNavEnabled();
}

/**
 * Local-only unauthenticated preview of onboarding screens (plan, Stripe checkout).
 *
 * Enable: `CLISTE_ONBOARDING_PREVIEW=true` in `.env.local`
 * Routes: `/dev/onboarding/plan`, `/dev/onboarding/plan/checkout`
 *
 * **Never set in production.** Ignored when `NODE_ENV=production`.
 */
export function isDevOnboardingPreviewEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.CLISTE_ONBOARDING_PREVIEW === "true";
}

/** Local code-screen rehearsal requires a real signed-in test account. */
export function isLocalSignupCodePreview(h: Pick<Headers,"get">): boolean {
  if(process.env.NODE_ENV!=="development"||process.env.CLISTE_LOCAL_SIGNUP_CODES!=="true"||process.env.VERCEL||process.env.RAILWAY_ENVIRONMENT_ID)return false;
  const host=h.get("host")??"";
  if(!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))return false;
  const origin=h.get("origin");
  if(origin){try{if(new URL(origin).host!==host)return false;}catch{return false;}}
  return true;
}

/** Explicit local rehearsal only. Never enabled on a deployed server. */
export function isLocalSetupTestEnabled(h: Pick<Headers,"get">): boolean {
  if(process.env.NODE_ENV!=="development"||process.env.CLISTE_LOCAL_SETUP_TESTS!=="true"||process.env.VERCEL||process.env.RAILWAY_ENVIRONMENT_ID)return false;
  const host=h.get("host")??"";
  if(!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))return false;
  const origin=h.get("origin");
  if(origin){try{if(new URL(origin).host!==host)return false;}catch{return false;}}
  return true;
}
export const LOCAL_SETUP_COMPLETION_COOKIE="cara_local_setup_complete";
export function localSetupCompletionValue(userId:string,organizationId:string){return `${userId}:${organizationId}`;}
