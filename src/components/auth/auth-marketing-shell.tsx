"use client";

import Image from "next/image";
import { SignupBrandFrame } from "@/components/onboarding/signup-brand-frame";
import { SignupSceneBackground } from "@/components/onboarding/signup-scene-background";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { PRODUCT_NAME } from "@/lib/company-details";
import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import { HeroPhotoEnter } from "@/components/onboarding/onboarding-canvas-background";
import {
  OnboardingEnter,
  OnboardingEnterProvider,
  useOnboardingAnimateIn,
} from "@/components/onboarding/onboarding-enter";
import {
  ONBOARDING_GLASS_CARD,
  ONBOARDING_HEADLINE,
  ONBOARDING_LOGO_SIZE,
  ONBOARDING_SHELL_LOGO_GAP,
  ONBOARDING_SHELL_SECTION_GAP,
  ONBOARDING_SUBHEADLINE,
} from "@/components/onboarding/onboarding-ui";
import { ONBOARDING_EASE } from "@/components/onboarding/onboarding-motion";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import { cn } from "@/lib/utils";

import { AuthFormAlert } from "./auth-form-alert";
import { AUTH_CARD, AUTH_PAGE_BG } from "./auth-ui";

type PageBackground = {
  jpg: string;
  webp: string;
  smallWebp?: string;
  mobileWebp?: string;
  ruled?: true;
  blend?: true;
};

type Props = {
  title: string;
  subtitle?: string;
  marketingHeadline?: ReactNode;
  marketingBody?: string;
  marketingBullets?: string[];
  pageBackground?: PageBackground;
  /** Tighter card padding and header spacing (signup). */
  compact?: boolean;
  /** Fade the glass panel out before client navigation (signup success). */
  contentExiting?: boolean;
  urlError?: string | null;
  children: ReactNode;
};

const PROFILE_CENTER_READABILITY =
  "radial-gradient(ellipse 72% 88% at 50% 44%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.18) 52%, transparent 76%)";

const PROFILE_TOP_BOTTOM_SOFTEN =
  "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 16%, transparent 84%, rgba(255,255,255,0.08) 100%)";

const PROFILE_MOBILE_WASH =
  "linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.24) 58%, rgba(255,255,255,0.12) 100%)";

function AuthPageBackground({ assets }: { assets: PageBackground }) {
  const ready = useOnboardingAnimateIn();
  const reduceMotion = useReducedMotion() ?? false;
  const animationKey = `${assets.jpg}-${ready ? "on" : "off"}`;
  const objectPosition = "50% 42%";
  if (assets.blend && assets.smallWebp) return <SignupSceneBackground portraitHeader asset={{jpg:assets.jpg,webp:assets.webp,smallWebp:assets.smallWebp,blend:true}} />;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ backgroundColor: "#f6f5f3" }}
      aria-hidden
    >
      <picture className="absolute inset-0 block">
      {assets.mobileWebp ? <source media="(max-width: 767px)" srcSet={assets.mobileWebp} type="image/webp" /> : null}
      <source srcSet={assets.webp} type="image/webp" />
      {reduceMotion ? (
        <img
          src={assets.jpg}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition }}
          decoding="async"
          fetchPriority="high"
        />
      ) : (
        <HeroPhotoEnter
          src={assets.jpg}
          objectPosition={objectPosition}
          animateIn={ready}
          resetKey={animationKey}
        />
      )}
      </picture>
      <div
        className="absolute inset-0 md:hidden"
        style={{ background: PROFILE_MOBILE_WASH }}
      />
      <div
        className="absolute inset-0 hidden md:block"
        style={{ background: PROFILE_CENTER_READABILITY }}
      />
      <div
        className="absolute inset-0 hidden md:block"
        style={{ background: PROFILE_TOP_BOTTOM_SOFTEN }}
      />
    </div>
  );
}

function SignupGlassShell({
  title,
  subtitle,
  urlError,
  children,
  assets,
  compact = false,
  contentExiting = false,
}: {
  title: string;
  subtitle?: string;
  urlError?: string | null;
  children: ReactNode;
  assets: PageBackground;
  compact?: boolean;
  contentExiting?: boolean;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  if (assets.ruled) return (
    <div className="min-h-0 flex-1 bg-white text-[#0b1220] antialiased">
      <main className="mx-auto flex min-h-dvh w-[calc(100%-32px)] max-w-[1320px] flex-col justify-center border-x border-slate-200/70 py-6 sm:w-[calc(100%-64px)] sm:py-10">
        <OnboardingEnterProvider>
          <div className="grid border-y border-slate-200/70 lg:min-h-[min(744px,calc(100dvh-80px))] lg:grid-cols-2">
            <section className="order-2 flex items-center px-5 py-8 sm:px-9 sm:py-12 lg:order-1 lg:px-14">
              <motion.div className="mx-auto w-full max-w-md" animate={contentExiting && !reduceMotion ? { opacity: 0, y: -16 } : { opacity: 1, y: 0 }} transition={{ duration: 0.52, ease: ONBOARDING_EASE }}>
                <OnboardingEnter className="mb-8 text-center lg:text-left">
                  <div className="mb-6 flex justify-center lg:justify-start"><ClisteLogoMark size={48} priority /></div>
                  <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[36px]">{title}</h1>
                  {subtitle ? <p className="mt-3 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
                </OnboardingEnter>
                {urlError ? <div className="mb-4"><AuthFormAlert message={urlError} /></div> : null}
                {children}
              </motion.div>
            </section>
            <div aria-hidden="true" className="relative order-2 hidden overflow-hidden border-l border-slate-200/70 bg-[#f3f0eb] lg:block lg:min-h-[560px]">
              <motion.div className="absolute inset-0" initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: ONBOARDING_EASE }}>
                <Image src={assets.webp} alt="" fill sizes="(max-width: 1023px) 100vw, 660px" className="object-cover object-[50%_25%]" priority />
              </motion.div>
            </div>
          </div>
        </OnboardingEnterProvider>
      </main>
    </div>
  );
  if (assets.blend) return <SignupBrandFrame stage="signup" title={title} description={subtitle}><div className="space-y-5">{urlError ? <AuthFormAlert message={urlError} /> : null}{children}</div></SignupBrandFrame>;
  const panel = (
    <div
      className={cn(
        ONBOARDING_GLASS_CARD,
        compact
          ? "w-full rounded-[24px] px-5 py-5 sm:px-7 sm:py-6"
          : "w-full rounded-[28px] px-6 py-8 sm:px-9 sm:py-10",
      )}
    >
      <OnboardingEnterProvider>
        <motion.div
          className={cn(
            "mx-auto flex w-full max-w-md flex-col items-center",
            compact ? "gap-3.5 sm:gap-4" : ONBOARDING_SHELL_SECTION_GAP,
          )}
          animate={
            contentExiting && !reduceMotion
              ? { opacity: 0, y: -16, scale: 0.985, filter: "blur(6px)" }
              : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
          }
          transition={{ duration: 0.52, ease: ONBOARDING_EASE }}
        >
          <div
            className={cn(
              "flex w-full flex-col items-center",
              compact ? "gap-2" : ONBOARDING_SHELL_LOGO_GAP,
            )}
          >
            <OnboardingEnter tone="profile" className="flex justify-center">
              <ClisteLogoMark
                size={compact ? 40 : ONBOARDING_LOGO_SIZE}
                priority
              />
            </OnboardingEnter>
            <OnboardingEnter tone="profile" className="w-full text-center">
              <h1
                className={cn(
                  ONBOARDING_HEADLINE,
                  compact && "text-[1.5rem] sm:text-[1.625rem]",
                )}
              >
                {title}
              </h1>
              {subtitle ? (
                <p
                  className={cn(
                    ONBOARDING_SUBHEADLINE,
                    compact ? "mt-1 text-[12px] leading-snug" : "mt-2",
                  )}
                >
                  {subtitle}
                </p>
              ) : null}
            </OnboardingEnter>
          </div>

          <div className="w-full">
            {urlError ? (
              <div className="mb-4">
                <AuthFormAlert message={urlError} />
              </div>
            ) : null}
            {children}
          </div>
        </motion.div>
      </OnboardingEnterProvider>
    </div>
  );

  return (
    <div className={cn("relative flex min-h-[100dvh] items-center justify-center overflow-hidden p-4 antialiased sm:p-6", assets.ruled ? "bg-white" : "bg-[#f6f5f3]")}>
      <AuthPageBackground assets={assets} />
      <main className="relative z-10 w-full max-w-lg">{panel}</main>
    </div>
  );
}

function LegacyAuthCard({
  title,
  subtitle,
  marketingHeadline,
  marketingBody,
  marketingBullets,
  urlError,
  children,
}: Omit<Props, "pageBackground">) {
  return (
    <main className={AUTH_CARD}>
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#030406] via-[#07090d] to-[#0a0c10] p-12 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/[0.06] via-transparent to-transparent" />
        <div className="relative z-10">
          <div className="mb-16 flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm">
            <Image
              src={PUBLIC_ASSETS.logo}
              alt={PRODUCT_NAME}
              width={30}
              height={30}
              className="h-7 w-7 object-contain"
              priority
            />
          </div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 backdrop-blur-md">
            {PRODUCT_NAME}
          </div>
          <h2 className="mb-6 text-3xl leading-[1.12] font-light tracking-tight text-white lg:text-4xl">
            {marketingHeadline}
          </h2>
          <p className="max-w-sm text-sm leading-relaxed font-light text-zinc-300/85">
            {marketingBody}
          </p>
          {marketingBullets && marketingBullets.length > 0 ? (
            <ul className="mt-8 max-w-sm space-y-3 text-sm font-light text-zinc-300/85">
              {marketingBullets.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="relative z-10 mt-16 flex items-center gap-3 pt-6 text-xs text-zinc-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-400 opacity-20" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-300" />
          </span>
          All systems operational
        </div>
      </section>

      <section className="relative flex flex-col justify-center bg-white p-8 sm:p-12">
        <div className="mb-10 flex flex-col lg:hidden">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
            <Image
              src={PUBLIC_ASSETS.logo}
              alt={PRODUCT_NAME}
              width={30}
              height={30}
              className="h-7 w-7 object-contain"
              priority
            />
          </div>
          <h1 className="mb-1.5 text-2xl font-light tracking-tight text-slate-900">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm font-light text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        <div className="mb-10 hidden lg:block">
          <h1 className="mb-1.5 text-2xl font-light tracking-tight text-slate-900">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm font-light text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        {urlError ? (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-700">
            {urlError}
          </p>
        ) : null}

        {children}
      </section>
    </main>
  );
}

export function AuthMarketingShell({
  title,
  subtitle,
  marketingHeadline,
  marketingBody,
  marketingBullets,
  pageBackground,
  compact = false,
  contentExiting = false,
  urlError,
  children,
}: Props) {
  if (pageBackground) {
    return (
      <SignupGlassShell
        title={title}
        subtitle={subtitle}
        urlError={urlError}
        assets={pageBackground}
        compact={compact}
        contentExiting={contentExiting}
      >
        {children}
      </SignupGlassShell>
    );
  }

  return (
    <div className={AUTH_PAGE_BG}>
      <LegacyAuthCard
        title={title}
        subtitle={subtitle}
        marketingHeadline={marketingHeadline}
        marketingBody={marketingBody}
        marketingBullets={marketingBullets}
        urlError={urlError}
      >
        {children}
      </LegacyAuthCard>
    </div>
  );
}
