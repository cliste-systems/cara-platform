"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { ClisteLogoMark } from "@/components/cliste-logo-mark";

import { createSupabaseCallbackClient } from "@/utils/supabase/callback-client";

const EMAIL_OTP_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function mergeAuthParamsFromUrl(href: string): Record<string, string> {
  const out: Record<string, string> = {};
  const url = new URL(href);
  if (url.hash.startsWith("#")) {
    new URLSearchParams(url.hash.slice(1)).forEach((value, key) => {
      out[key] = value;
    });
  }
  url.searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

const CALLBACK_CLAIM_PREFIX = "cliste_auth_cb:";
const callbacksInFlight = new Set<string>();

/** One-time Supabase params; React Strict Mode runs this effect twice in dev and would consume the link twice. */
function getCallbackClaimKey(params: Record<string, string>): string | null {
  if (params.token_hash && params.type) {
    return `${CALLBACK_CLAIM_PREFIX}otp:${params.type}:${params.token_hash}`;
  }
  const code = params.code;
  if (code) {
    return `${CALLBACK_CLAIM_PREFIX}pkce:${code}`;
  }
  if (params.access_token && params.refresh_token) {
    return `${CALLBACK_CLAIM_PREFIX}implicit:${params.access_token.slice(0, 64)}`;
  }
  return null;
}

type CallbackGate = "proceed" | "skip_wait" | "skip_done";

function tryBeginAuthCallback(claimKey: string | null): CallbackGate {
  if (!claimKey) return "proceed";
  try {
    const state = sessionStorage.getItem(claimKey);
    if (state === "done") return "skip_done";
    if (callbacksInFlight.has(claimKey)) return "skip_wait";
  } catch {
    /* private mode / blocked storage — still try once */
  }
  callbacksInFlight.add(claimKey);
  return "proceed";
}

function finishAuthCallback(claimKey: string | null, success: boolean) {
  if (!claimKey) return;
  callbacksInFlight.delete(claimKey);
  try {
    if (success) {
      sessionStorage.setItem(claimKey, "done");
    } else {
      sessionStorage.removeItem(claimKey);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Finishes Supabase email flows (invite, magic link, confirm signup).
 * Handles token_hash + type, PKCE ?code=, and implicit hash tokens (invite
 * often cannot use PKCE when the link is opened outside the tab that started
 * the flow — we recover via setSession from hash params).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("We’re confirming your invitation and preparing your account.");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let claimKey: string | null = null;
    void (async () => {
      try {
        const supabase = createSupabaseCallbackClient();

        const href = window.location.href;
        const params = mergeAuthParamsFromUrl(href);

        if (params.error || params.error_description) {
          const msg =
            params.error_description ||
            params.error ||
            "Sign-in link is invalid or expired.";
          setMessage(String(msg));
          setFailed(true);
          return;
        }

        claimKey = getCallbackClaimKey(params);
        const gate = tryBeginAuthCallback(claimKey);
        if (gate === "skip_done") {
          router.replace("/auth/post-login");
          router.refresh();
          return;
        }
        if (gate === "skip_wait") {
          return;
        }

        await supabase.auth.getSession();

        const tokenHash = params.token_hash;
        const otpType = params.type;
        if (
          tokenHash &&
          otpType &&
          EMAIL_OTP_TYPES.has(otpType)
        ) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as
              | "signup"
              | "invite"
              | "magiclink"
              | "recovery"
              | "email_change"
              | "email",
          });
          if (error) {
            finishAuthCallback(claimKey, false);
            setMessage(error.message);
            setFailed(true);
            return;
          }
          finishAuthCallback(claimKey, true);
          window.history.replaceState(window.history.state, "", window.location.pathname);
          router.replace("/auth/post-login");
          router.refresh();
          return;
        }

        const search = window.location.search;
        if (search.includes("code=")) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(params.code);
          if (error) {
            finishAuthCallback(claimKey, false);
            setMessage(error.message);
            setFailed(true);
            return;
          }
          finishAuthCallback(claimKey, true);
          window.history.replaceState(window.history.state, "", window.location.pathname);
          router.replace("/auth/post-login");
          router.refresh();
          return;
        }

        const accessToken = params.access_token;
        const refreshToken = params.refresh_token;
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            finishAuthCallback(claimKey, false);
            setMessage(error.message);
            setFailed(true);
            return;
          }
          finishAuthCallback(claimKey, true);
          window.history.replaceState(
            window.history.state,
            "",
            `${window.location.pathname}${window.location.search}`
          );
          router.replace("/auth/post-login");
          router.refresh();
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          router.replace("/auth/post-login");
          router.refresh();
          return;
        }

        finishAuthCallback(claimKey, false);
        setMessage("Could not complete sign-in.");
        setFailed(true);
      } catch {
        finishAuthCallback(claimKey, false);
        setMessage("Something went wrong.");
        setFailed(true);
      }
    })();
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f3f6f4] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#dce5df] bg-white p-8 text-center shadow-sm">
        <div className="mb-7 flex items-center justify-center gap-2.5"><ClisteLogoMark size={32} priority /><span className="text-xl font-semibold tracking-tight text-[#20392c]">HelloCara</span></div>
        {failed ? <ShieldCheck className="mx-auto mb-5 size-8 text-[#617367]" /> : <LoaderCircle className="mx-auto mb-5 size-7 animate-spin text-[#294c37]" />}
        <h1 className="text-2xl font-semibold tracking-tight text-[#20392c]">{failed ? "Let’s get you a fresh link" : "You’re in the right place"}</h1>
        <p role="status" className="mt-3 text-sm leading-6 text-[#617367]">{failed ? "This invitation may have expired or already been used. Your account details are safe." : message}</p>
        {failed ? <div className="mt-6 space-y-4"><a href="mailto:support@hellocara.ie?subject=Please%20resend%20my%20HelloCara%20invitation" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#294c37] px-5 py-3 text-sm font-medium text-white">Request a new invitation<ArrowRight className="size-4" /></a><Link href="/authenticate" className="inline-block py-2 text-sm font-medium text-[#294c37] underline-offset-4 hover:underline">Already set a password? Sign in</Link></div> : <p className="mt-6 text-xs text-[#617367]">Secure account setup</p>}
      </div>
    </main>
  );
}
