import { createAdminClient } from "@/utils/supabase/admin";

export {
  emailRateLimitFingerprint,
  hashRateLimitIdentifier,
  rateLimitFingerprint,
} from "./rate-limit-identifiers";

type Scope = "authenticate" | "admin_login" | "dashboard_unlock";

type ScopeConfig = {
  windowMs: number;
  maxFailures: number;
  lockMs: number;
  captchaAfterFailures: number;
};

export type RateLimitStatus = {
  allowed: boolean;
  requiresCaptcha: boolean;
  retryAfterSeconds: number;
  failuresInWindow: number;
};

const CONFIG: Record<Scope, ScopeConfig> = {
  authenticate: {
    windowMs: 10 * 60 * 1000,
    maxFailures: 6,
    lockMs: 15 * 60 * 1000,
    captchaAfterFailures: 2,
  },
  admin_login: {
    windowMs: 15 * 60 * 1000,
    maxFailures: 5,
    lockMs: 30 * 60 * 1000,
    captchaAfterFailures: 1,
  },
  dashboard_unlock: {
    windowMs: 15 * 60 * 1000,
    maxFailures: 8,
    lockMs: 15 * 60 * 1000,
    captchaAfterFailures: 3,
  },
};

type CounterStatus = {
  failure_count: number;
  locked_until: string | null;
  retry_after_seconds: number;
  requires_captcha: boolean;
};

function unavailableStatus(scope: Scope): RateLimitStatus {
  return {
    allowed: false,
    requiresCaptcha: true,
    retryAfterSeconds: 60,
    failuresInWindow: CONFIG[scope].maxFailures,
  };
}

async function counterStatus(
  operation: "auth_rate_limit_get_status" | "auth_rate_limit_record_failure",
  scope: Scope,
  fingerprint: string,
): Promise<RateLimitStatus> {
  const cfg = CONFIG[scope];
  try {
    const { data, error } = await createAdminClient().rpc(operation, {
      p_scope: scope,
      p_fingerprint: fingerprint,
      p_window_seconds: cfg.windowMs / 1000,
      p_max_failures: cfg.maxFailures,
      p_lock_seconds: cfg.lockMs / 1000,
      p_captcha_after: cfg.captchaAfterFailures,
    });
    const row = Array.isArray(data) ? data[0] as CounterStatus | undefined : undefined;
    if (error || !row || !Number.isInteger(row.failure_count) || row.failure_count < 0 ||
        !Number.isInteger(row.retry_after_seconds) || row.retry_after_seconds < 0 ||
        typeof row.requires_captcha !== "boolean") {
      console.warn("[auth-rate-limit] counter unavailable", { operation, code: error?.code });
      return unavailableStatus(scope);
    }
    return {
      allowed: row.retry_after_seconds === 0,
      requiresCaptcha: row.requires_captcha,
      retryAfterSeconds: row.retry_after_seconds,
      failuresInWindow: row.failure_count,
    };
  } catch {
    console.warn("[auth-rate-limit] counter unavailable", { operation });
    return unavailableStatus(scope);
  }
}

export async function getRateLimitStatus(scope: Scope, fingerprint: string): Promise<RateLimitStatus> {
  return counterStatus("auth_rate_limit_get_status", scope, fingerprint);
}

/** The database serializes increments so concurrent failures cannot overwrite each other. */
export async function recordRateLimitFailure(scope: Scope, fingerprint: string): Promise<RateLimitStatus> {
  return counterStatus("auth_rate_limit_record_failure", scope, fingerprint);
}

export async function clearRateLimit(scope: Scope, fingerprint: string): Promise<void> {
  try {
    const { error } = await createAdminClient().rpc("auth_rate_limit_clear", {
      p_scope: scope,
      p_fingerprint: fingerprint,
    });
    if (error) console.warn("[auth-rate-limit] clear failed", { code: error.code });
  } catch {
    // A failed clear keeps the limiter in place; it never grants extra attempts.
    console.warn("[auth-rate-limit] clear failed");
  }
}
