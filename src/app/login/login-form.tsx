"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

import {
  OnboardingFieldBox,
  OnboardingFieldSurfaceProvider,
} from "@/components/onboarding/onboarding-form-card";
import { OnboardingEnter } from "@/components/onboarding/onboarding-enter";
import { ONBOARDING_EASE } from "@/components/onboarding/onboarding-motion";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import {
  ONBOARDING_FIELD_INPUT,
} from "@/components/onboarding/onboarding-ui";
import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { cn } from "@/lib/utils";

import { passwordSignIn } from "./actions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SIGN_IN_SUCCESS_HOLD_MS = 360;
const SIGN_IN_EXIT_MS = 520;

type FieldErrors = Partial<Record<"email" | "password" | "captcha", string>>;

type LoginFormProps = {
  onTransitionStart?: () => void;
};

export function LoginForm({ onTransitionStart }: LoginFormProps) {
  const reduceMotion = useReducedMotion();
  const transitionStartedRef = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [signInSuccess, setSignInSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function resetSecurityCheck() {
    // Tokens are single-use: reset the visible widget as well as its saved response.
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  }

  function beginSuccessTransition() {
    if (transitionStartedRef.current) return;
    transitionStartedRef.current = true;
    setSignInSuccess(true);

    const holdMs = reduceMotion ? 0 : SIGN_IN_SUCCESS_HOLD_MS;
    const exitMs = reduceMotion ? 0 : SIGN_IN_EXIT_MS;

    window.setTimeout(() => {
      onTransitionStart?.();
    }, holdMs);

    window.setTimeout(() => {
      window.location.assign("/auth/post-login");
    }, holdMs + exitMs + 40);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || signInSuccess) return;
    setError(null);

    const errors: FieldErrors = {};
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      errors.email = "Enter a valid email address.";
    }
    if (!password) {
      errors.password = "Enter your password.";
    }
    if (requiresCaptcha && turnstileSiteKey && !turnstileToken) {
      errors.captcha = "Please complete the security check.";
      resetSecurityCheck();
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setPending(true);
    try {
      const result = await passwordSignIn({
        email: trimmedEmail,
        password,
        turnstileToken: turnstileToken ?? null,
      });
      if (!result.ok) {
        setPending(false);
        setError(result.message);
        setRequiresCaptcha(result.requiresCaptcha);
        resetSecurityCheck();
        return;
      }
      beginSuccessTransition();
    } catch {
      setPending(false);
      resetSecurityCheck();
      setError("Something went wrong signing in. Please try again.");
    }
  }

  const fieldsLocked = pending || signInSuccess;

  return (
    <OnboardingFieldSurfaceProvider surface="default">
      <motion.form
        onSubmit={handleSubmit}
        noValidate
        className="w-full space-y-3"
        animate={
          reduceMotion
            ? undefined
            : {
                opacity: pending && !signInSuccess ? 0.9 : 1,
                y: pending && !signInSuccess ? 2 : 0,
              }
        }
        transition={{ duration: 0.32, ease: ONBOARDING_EASE }}
      >
        <OnboardingFieldBox
          label="Email address"
          static
          className="rounded-xl border-slate-200 bg-white px-3.5 py-2.5 shadow-none focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100"
          htmlFor="login-email"
          error={fieldErrors.email}
        >
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@business.ie"
            value={email}
            disabled={fieldsLocked}
            aria-invalid={Boolean(fieldErrors.email)}
            onChange={(event) => {
              setEmail(event.target.value);
              clearFieldError("email");
            }}
            className={cn(ONBOARDING_FIELD_INPUT, fieldsLocked && "opacity-80")}
          />
        </OnboardingFieldBox>

        <OnboardingFieldBox
          label="Password"
          static
          className="rounded-xl border-slate-200 bg-white px-3.5 py-2.5 shadow-none focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100"
          htmlFor="login-password"
          error={fieldErrors.password}
        >
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              disabled={fieldsLocked}
              aria-invalid={Boolean(fieldErrors.password)}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError("password");
              }}
              className={cn(ONBOARDING_FIELD_INPUT, "pr-12", fieldsLocked && "opacity-80")}
            />
            <button
              type="button"
              disabled={fieldsLocked}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:text-[#0b1220] disabled:opacity-50"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </OnboardingFieldBox>

        {requiresCaptcha ? (
          <OnboardingEnter tone="profile">
            <div className="rounded-2xl border border-slate-200/75 bg-white px-4 py-3.5">
              <p className="text-[12px] leading-relaxed text-slate-600">
                Extra security check is required after failed attempts.
              </p>
              {fieldErrors.captcha ? (
                <p role="alert" className="mt-2 text-[12px] text-red-600">
                  {fieldErrors.captcha}
                </p>
              ) : null}
              {turnstileSiteKey ? (
                <div className="mt-3 flex justify-center">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={turnstileSiteKey}
                    onSuccess={(token) => {
                      setTurnstileToken(token);
                      clearFieldError("captcha");
                    }}
                    onExpire={() => setTurnstileToken(null)}
                    onTimeout={() => setTurnstileToken(null)}
                    onError={() => {
                      setTurnstileToken(null);
                      setFieldErrors((current) => ({
                        ...current,
                        captcha: "The security check could not load. Please try again.",
                      }));
                    }}
                    options={{ theme: "light", size: "normal" }}
                  />
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-amber-700">
                  Captcha site key missing (
                  <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>).
                </p>
              )}
            </div>
          </OnboardingEnter>
        ) : null}

        <AuthFormAlert message={error} />

        <OnboardingEnter tone="profile" className="flex justify-center pt-2">
          <OnboardingPrimaryButton
            type="submit"
            pending={pending && !signInSuccess}
            disabled={signInSuccess}
            className="w-full max-w-none sm:min-w-[14rem]"
          >
            {signInSuccess
              ? "Opening dashboard…"
              : pending
                ? "Signing in…"
                : "Sign in"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </OnboardingPrimaryButton>
        </OnboardingEnter>
      </motion.form>
    </OnboardingFieldSurfaceProvider>
  );
}
