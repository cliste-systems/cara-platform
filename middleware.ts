import { NextRequest, NextResponse } from "next/server";
import { userNeedsPassword } from "./src/lib/invite-onboarding";

import { DEFAULT_APP_SITE_URL } from "./src/lib/company-details";
import { LEGACY_AUTH_REDIRECTS } from "./src/lib/auth-routes";
import { LEGACY_DASHBOARD_REDIRECTS } from "./src/lib/dashboard-routes";
import { DASHBOARD_LEGAL_ACCEPT_PATH } from "./src/lib/legal-documents";
import { dashboardPathNeedsLegalAcceptance } from "./src/lib/legal-acceptance-middleware";
import { onboardingPathNeedsLegalAcceptance } from "./src/lib/onboarding-legal-middleware";
import { isPublicSignupEnabled } from "./src/lib/public-signup";
import { createAdminClient } from "./src/utils/supabase/admin";
import { updateSession } from "./src/utils/supabase/middleware";

const LEGACY_APP_HOSTS = new Set(["app.clistesystems.ie"]);

function legacyAppHostRedirect(request: NextRequest): NextResponse | null {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!host || !LEGACY_APP_HOSTS.has(host)) return null;
  const destination = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    DEFAULT_APP_SITE_URL,
  );
  return NextResponse.redirect(destination, 308);
}

function copySessionCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, c);
  }
}

function rootToLoginRedirect(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (request.nextUrl.pathname !== "/") return response;
  const redirectRes = NextResponse.redirect(new URL("/authenticate", request.url));
  copySessionCookies(response, redirectRes);
  return redirectRes;
}

/** Mistyped sign-in URLs (e.g. `/signin`) must not match `/[salonSlug]`. */
function legacyAuthPathRedirect(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const path = request.nextUrl.pathname;
  const target = LEGACY_AUTH_REDIRECTS[path];
  if (!target) return response;
  const url = new URL(target, request.url);
  url.search = request.nextUrl.search;
  const redirectRes = NextResponse.redirect(url);
  copySessionCookies(response, redirectRes);
  return redirectRes;
}

/** Canonical dashboard URLs (Calls, Contacts, Usage, Cara Setup). */
function legacyDashboardPathRedirect(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const path = request.nextUrl.pathname;
  const target = LEGACY_DASHBOARD_REDIRECTS[path];
  if (!target) return response;
  const url = new URL(target, request.url);
  url.search = request.nextUrl.search;
  const redirectRes = NextResponse.redirect(url);
  copySessionCookies(response, redirectRes);
  return redirectRes;
}

/**
 * Retail pilot: public self-serve signup is frozen. `/signup` is closed for
 * everyone; `/onboarding` is closed for signed-out visitors (a signed-in
 * account that is mid-wizard may still finish it). Admin-invited users never
 * touch these paths — they land on /auth/callback and set a password.
 */
function signupGateRedirect(
  request: NextRequest,
  response: NextResponse,
  userId: string | undefined,
): NextResponse | null {
  if (isPublicSignupEnabled()) return null;
  const path = request.nextUrl.pathname;
  const isSignup = path === "/signup" || path.startsWith("/signup/");
  const isOnboarding =
    path === "/onboarding" || path.startsWith("/onboarding/");
  if (!isSignup && !(isOnboarding && !userId)) return null;
  const redirectRes = NextResponse.redirect(
    new URL("/authenticate", request.url),
  );
  copySessionCookies(response, redirectRes);
  return redirectRes;
}

/** Legacy URL — extra dashboard password gate was removed for v1 pilot. */
function dashboardUnlockRedirect(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const path = request.nextUrl.pathname;
  if (path !== "/dashboard-unlock" && !path.startsWith("/dashboard-unlock/")) {
    return response;
  }
  const redirectRes = NextResponse.redirect(new URL("/dashboard", request.url));
  copySessionCookies(response, redirectRes);
  return redirectRes;
}

/** Legacy internal-admin URL now uses the same account sign-in as everyone else. */
function legacyAdminUnlockRedirect(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const path = request.nextUrl.pathname;
  if (path !== "/admin-unlock" && !path.startsWith("/admin-unlock/")) {
    return response;
  }
  const url = new URL("/authenticate", request.url);
  url.search = request.nextUrl.search;
  const redirectRes = NextResponse.redirect(url);
  copySessionCookies(response, redirectRes);
  return redirectRes;
}

function buildForwardRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return headers;
}

async function legalAcceptRedirect(
  request: NextRequest,
  response: NextResponse,
  userId: string | undefined,
): Promise<NextResponse | null> {
  if (!userId) return null;

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/")) return null;

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id, active_organization_id")
      .eq("id", userId)
      .maybeSingle();

    const organizationId = profile?.active_organization_id ?? profile?.organization_id;
    if (!organizationId) return null;

    const onboardingNeeds = await onboardingPathNeedsLegalAcceptance({
      pathname,
      userId,
      organizationId,
    });
    if (onboardingNeeds) {
      const redirectRes = NextResponse.redirect(
        new URL("/onboarding/legal", request.url),
      );
      copySessionCookies(response, redirectRes);
      return redirectRes;
    }

    const dashboardNeeds = await dashboardPathNeedsLegalAcceptance({
      pathname,
      userId,
      organizationId,
    });
    if (dashboardNeeds) {
      const redirectRes = NextResponse.redirect(
        new URL(DASHBOARD_LEGAL_ACCEPT_PATH, request.url),
      );
      copySessionCookies(response, redirectRes);
      return redirectRes;
    }
  } catch (err) {
    // Missing service-role key or a Supabase timeout must not 500 sign-in.
    console.error("[middleware] legal acceptance check failed", err);
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const legacyHostRedirect = legacyAppHostRedirect(request);
  if (legacyHostRedirect) return legacyHostRedirect;

  const forwardHeaders = buildForwardRequestHeaders(request);
  const { response, user } = await updateSession(request, forwardHeaders);

  const gatedSignup = signupGateRedirect(request, response, user?.id);
  if (gatedSignup) return gatedSignup;

  if (user && userNeedsPassword(user) && request.nextUrl.pathname.startsWith("/dashboard") && request.nextUrl.pathname !== "/dashboard/set-password") {
    const passwordRedirect = NextResponse.redirect(new URL("/dashboard/set-password", request.url));
    copySessionCookies(response, passwordRedirect);
    return passwordRedirect;
  }

  const legalRedirect = await legalAcceptRedirect(request, response, user?.id);
  if (legalRedirect) return legalRedirect;

  const maybeRootRedirect = rootToLoginRedirect(request, response);
  if (maybeRootRedirect !== response) return maybeRootRedirect;
  const authAliasRedirect = legacyAuthPathRedirect(request, response);
  if (authAliasRedirect !== response) return authAliasRedirect;
  const legacyNavRedirect = legacyDashboardPathRedirect(request, response);
  if (legacyNavRedirect !== response) return legacyNavRedirect;
  const unlockRedirect = dashboardUnlockRedirect(request, response);
  if (unlockRedirect !== response) return unlockRedirect;
  const legacyAdminRedirect = legacyAdminUnlockRedirect(request, response);
  if (legacyAdminRedirect !== response) return legacyAdminRedirect;
  return response;
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
