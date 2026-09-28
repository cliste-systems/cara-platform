import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Strict-by-default Content Security Policy.
 *
 * - `script-src 'self'` — block inline scripts. Next.js needs `'unsafe-inline'`
 *   for some legacy paths and Stripe.js for Payment Element; we allow both
 *   explicitly. We do NOT allow `'unsafe-eval'` outside dev.
 * - `frame-src` allows Stripe (Checkout / 3DS challenge iframes) and Supabase
 *   auth UI when used.
 * - `connect-src` allows Supabase + Stripe API + our own origin.
 * - `img-src` allows data: + https: so user uploads / Stripe receipts render.
 * - `frame-ancestors 'none'` is the modern replacement for X-Frame-Options.
 *
 * Override at deploy time with CLISTE_CSP_EXTRA_CONNECT_SRC if you bring on a
 * new third-party API (e.g. analytics) without redeploying code changes.
 */
function buildContentSecurityPolicy(): string {
  const extraConnect =
    process.env.CLISTE_CSP_EXTRA_CONNECT_SRC?.trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(" ") ?? "";

  // In dev, Next needs 'unsafe-eval' for fast refresh & React DevTools.
  // In prod we additionally allow Cloudflare Turnstile (bot challenge on the
  // public booking forms) and Google Maps JS (storefront map embed).
  const stripeScript = "https://js.stripe.com https://*.stripe.com";
  const turnstileScript = "https://challenges.cloudflare.com";
  const mapsScript =
    "https://maps.googleapis.com https://maps.gstatic.com";
  const scriptSrc = isProd
    ? `'self' 'unsafe-inline' ${stripeScript} ${turnstileScript} ${mapsScript}`
    : `'self' 'unsafe-inline' 'unsafe-eval' ${stripeScript} ${turnstileScript} ${mapsScript}`;

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Maps loads webfonts/CSS from gstatic; allow as a style source.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.gstatic.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com https://*.gstatic.com",
    [
      "connect-src 'self'",
      "https://api.stripe.com",
      "https://*.supabase.co",
      "https://*.supabase.in",
      "wss://*.supabase.co",
      // Admin demo calls + LiveKit voice sessions.
      "wss://*.livekit.cloud",
      "https://*.livekit.cloud",
      // Turnstile siteverify + telemetry beacons.
      "https://challenges.cloudflare.com",
      // Maps tile/route XHRs.
      "https://maps.googleapis.com",
      "https://*.googleapis.com",
      "https://*.gstatic.com",
      extraConnect,
    ]
      .filter(Boolean)
      .join(" "),
    [
      "frame-src 'self'",
      "https://js.stripe.com",
      "https://hooks.stripe.com",
      "https://*.stripe.com",
      // Turnstile renders an iframe for the bot challenge.
      "https://challenges.cloudflare.com",
      // Embedded Google Maps iframe (storefront directions widget).
      "https://www.google.com",
      "https://maps.google.com",
    ].join(" "),
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // X-Frame-Options is superseded by CSP frame-ancestors but we keep it for
  // older browsers / legacy crawlers that don't grok CSP.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Tightened: we only ask for geolocation on first-party pages (none today)
  // and allow Stripe.js to invoke the Payment Request API for Apple/Google Pay.
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "ambient-light-sensor=()",
      "autoplay=(self)",
      "battery=()",
      "browsing-topics=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "geolocation=(self)",
      "gyroscope=()",
      "interest-cohort=()",
      "magnetometer=()",
      "microphone=(self)",
      "midi=()",
      "payment=(self \"https://js.stripe.com\" \"https://hooks.stripe.com\")",
      "publickey-credentials-get=(self)",
      "screen-wake-lock=()",
      "sync-xhr=(self)",
      "usb=()",
      "xr-spatial-tracking=()",
    ].join(", "),
  },
  // COOP/COEP harden against side-channel attacks. We use COOP only because
  // COEP requires every embedded resource (Stripe) to send CORP, which they
  // don't — turning COEP on would break the Payment Element.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          // 2 years + preload — required for the HSTS preload list. Keep
          // includeSubDomains; remove only if you knowingly serve a subdomain
          // that must stay HTTP (you don't).
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "Content-Security-Policy",
          value: buildContentSecurityPolicy(),
        },
      ]
    : [
        // Report-Only in dev so we can see violations without breaking local
        // workflows (e.g. Next.js fast refresh).
        {
          key: "Content-Security-Policy-Report-Only",
          value: buildContentSecurityPolicy(),
        },
      ]),
];

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // Don't advertise we're a Next.js app to every visitor. Trivial change but
  // removes a fingerprinting datapoint that helps attackers pick exploits.
  poweredByHeader: false,
  serverExternalPackages: ["unpdf"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // The Stripe webhook is server-to-server only — no browser ever loads
        // it, so override CSP isn't needed but make sure no caching layer
        // touches the request body either.
        source: "/api/stripe/webhook",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
      {
        // Authenticated surfaces should never be cached by intermediaries
        // or by the browser back/forward navigation cache. Without this, a
        // user logging out on a shared device can press Back and see the
        // last rendered HTML (with their salon's customer list etc.).
        source: "/dashboard/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/authenticate",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/login",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
});
