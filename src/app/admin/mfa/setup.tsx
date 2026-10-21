"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Loader2,
  ScanLine,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";


import { cn } from "@/lib/utils";
import { adminPrimaryButtonClass } from "@/components/admin/admin-interactive";
import { createClient } from "@/utils/supabase/client";

type Mode = "loading" | "enroll" | "verify" | "done";

export function AdminMfaSetup({ returnTo = "/admin" }: { returnTo?: string }) {
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      const supabase = createClient();

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) {
        if (!cancelled) {
          setError("Could not check MFA status. Refresh and try again.");
          setMode("verify");
        }
        return;
      }

      if (aal.currentLevel === "aal2") {
        if (!cancelled) {
          setMode("done");
          window.location.replace(returnTo);
        }
        return;
      }

      const { data: factors, error: factorError } =
        await supabase.auth.mfa.listFactors();

      if (factorError) {
        if (!cancelled) {
          setError("Could not load your MFA factors.");
          setMode("verify");
        }
        return;
      }

      const totpFactors = factors.totp ?? [];
      const verifiedTotp = totpFactors.find(
        (factor) => factor.status === "verified",
      );

      if (verifiedTotp) {
        if (!cancelled) {
          setFactorId(verifiedTotp.id);
          setMode("verify");
        }
        return;
      }

      const prepareResponse = await fetch("/api/admin/mfa/prepare", {
        method: "POST",
        cache: "no-store",
      });

      if (!prepareResponse.ok) {
        const prepareBody = (await prepareResponse.json().catch(() => null)) as
          | { error?: string; code?: string }
          | null;

        if (prepareBody?.code === "session_required") {
          window.location.assign("/authenticate");
          return;
        }

        if (!cancelled) {
          setError(
            prepareBody?.error ||
              "Could not reset the unfinished authenticator setup.",
          );
          setMode("verify");
        }
        return;
      }

      const enrollmentSuffix =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID().slice(0, 8)
          : Date.now().toString(36);

      const { data: enrolled, error: enrollError } =
        await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Cliste Systems Admin ${enrollmentSuffix}`,
        });

      if (enrollError || !enrolled?.totp) {
        if (!cancelled) {
          setError(
            enrollError?.message ||
              "Could not start authenticator setup. Check Supabase MFA settings.",
          );
          setMode("verify");
        }
        return;
      }

      if (!cancelled) {
        setFactorId(enrolled.id);
        setQrCode(enrolled.totp.qr_code);
        setSecret(enrolled.totp.secret);
        setMode("enroll");
      }
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, [returnTo]);

  useEffect(() => {
    if (mode === "verify") {
      codeInputRef.current?.focus();
    }
  }, [mode]);

  async function verify(codeOverride?: string) {
    if (submitting || mode === "done") return;

    const verificationCode = (codeOverride ?? code).trim();

    if (!factorId || !/^\d{6}$/.test(verificationCode)) {
      setError("Enter the 6-digit code from your authenticator app.");
      codeInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: verifyError } =
        await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: verificationCode,
        });

      if (verifyError) {
        setError(
          verifyError.message || "That verification code was not accepted.",
        );
        return;
      }

      setMode("done");
      window.location.replace(returnTo);
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "loading") {
    return (
      <div role="status" className="py-3">
        <span className="mb-4 inline-flex items-center text-[#697078]">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold tracking-tight">Checking your security</h1>
        <p className="mt-2 text-[13px] text-[#697078]">Preparing your authenticator…</p>
      </div>
    );
  }

  const complete = mode === "done";
  const digits = Array.from({ length: 6 }, (_, index) => code[index] ?? "");

  return (
    <div>
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.7px]">
        {complete ? "You’re verified" : mode === "enroll" ? "Set up your authenticator" : "Verify it’s you"}
      </h1>
      <p id="admin-mfa-instructions" className="mt-2.5 min-h-12 text-sm leading-6 text-[#697078]">
        {complete ? "Taking you to the admin workspace." : mode === "enroll" ? "Scan this QR code with your authenticator app, then enter its 6-digit code below." : "Enter the 6-digit code from your authenticator app."}
      </p>

      {mode === "enroll" || (complete && qrCode) ? (
        <div className="mt-6 rounded-lg border border-[#e0e3e6] bg-[#f7f8f9] p-4">
          <p className="flex items-center justify-center gap-2 text-xs font-medium text-[#353d42]"><ScanLine className="size-4" aria-hidden />Scan to connect your authenticator</p>
          {qrCode ? (
            <div className="mt-4 flex justify-center">
              <div className="rounded-lg border border-[#e0e3e6] bg-white p-3">
                {/* Supabase returns the QR code as a data URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="Authenticator setup QR code" className="size-40" />
              </div>
            </div>
          ) : null}
          {secret ? (
            <details className="group mt-4 rounded-md border border-[#e0e3e6] bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-xs font-medium text-[#353d42]">
                Can’t scan the QR code?
                <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="border-t border-[#e6edf3] p-3">
                <p className="text-xs leading-5 text-[#697078]">Enter this setup key manually in your authenticator app.</p>
                <p className="mt-2 break-all rounded-lg bg-[#f0f2f4] p-3 font-mono text-xs text-[#353d42]">{secret}</p>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="mt-7">
        <label htmlFor="admin-mfa-code" className="mb-3 block text-[13px] font-medium text-[#353d42]">{complete ? "Authenticator" : "Authenticator code"}</label>
        {complete ? (
          <div role="status" className="flex h-14 items-center gap-3 rounded-md border border-[#dce7df] bg-[#f0f5f2] px-4 text-[13px] font-medium text-[#38654f]">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            Code accepted
          </div>
        ) : (
        <div className="group relative cursor-text" onClick={() => codeInputRef.current?.focus()}>
          <input
            ref={codeInputRef}
            id="admin-mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            disabled={submitting}
            onChange={(event) => {
              const nextCode = event.target.value.replace(/\D/g, "").slice(0, 6);
              setError(null);
              setCode(nextCode);
              if (nextCode.length === 6 && factorId && !submitting) void verify(nextCode);
            }}
            onKeyDown={(event) => { if (event.key === "Enter") void verify(); }}
            className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0 disabled:cursor-wait"
            aria-label="6-digit authenticator code"
            aria-describedby={`admin-mfa-instructions${error ? " admin-mfa-error" : ""}`}
            aria-invalid={Boolean(error)}
          />
          <div className="grid grid-cols-6 gap-2 sm:gap-2.5" aria-hidden>
            {digits.map((digit, index) => (
              <div key={index} className={[
                "flex h-14 min-w-0 items-center justify-center rounded-md border bg-white font-mono text-2xl font-medium text-[#11181d] transition-colors",
                error ? "border-[#e7b9b0]" : code.length === index ? "border-[#e0e3e6] group-focus-within:border-[#697078] group-focus-within:ring-2 group-focus-within:ring-[#e0e3e6]" : "border-[#e0e3e6]",
              ].join(" ")}>
                {digit || <span className="size-1 rounded-full bg-[#aeb5bb]" />}
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {error ? <div id="admin-mfa-error" role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-700">{error}</div> : null}

      <button
        type="button"
        disabled={complete || submitting || code.length !== 6 || !factorId}
        onClick={() => void verify()}
        className={cn(adminPrimaryButtonClass, "mt-6 min-h-12 w-full", complete && "disabled:opacity-100")}
      >
        {submitting || complete ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {complete ? "Opening admin…" : submitting ? "Verifying…" : "Continue"}
        {!submitting && !complete ? <ArrowRight className="size-4" aria-hidden /> : null}
      </button>
    </div>
  );
}
