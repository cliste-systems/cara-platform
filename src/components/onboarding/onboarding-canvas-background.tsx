"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { PUBLIC_ASSETS } from "@/lib/public-assets";

import { useOnboardingAnimateIn } from "./onboarding-enter";
import {
  normalizeOnboardingPath,
  ONBOARDING_STEP_PATHS,
} from "./onboarding-steps";
import {
  ONBOARDING_EASE,
  onboardingProfileBgEnterTransition,
} from "./onboarding-motion";

const DEFAULT_BACKGROUND_WEBP = PUBLIC_ASSETS.onboarding.default2x.webp;
const DEFAULT_BACKGROUND_JPG = PUBLIC_ASSETS.onboarding.default2x.jpg;

const PROFILE_BACKGROUND_WEBP = PUBLIC_ASSETS.onboarding.heroProfile.webp;
const PROFILE_BACKGROUND_JPG = PUBLIC_ASSETS.onboarding.heroProfile.jpg;

const VOICE_BACKGROUND_WEBP = PUBLIC_ASSETS.onboarding.heroVoice.webp;
const VOICE_BACKGROUND_JPG = PUBLIC_ASSETS.onboarding.heroVoice.jpg;

const KNOWLEDGE_BACKGROUND_WEBP = PUBLIC_ASSETS.onboarding.heroKnowledge.webp;
const KNOWLEDGE_BACKGROUND_JPG = PUBLIC_ASSETS.onboarding.heroKnowledge.jpg;

type BackgroundAssets = {
  webp: string;
  fallback: string;
};

type BackgroundLayout = "sharp-width" | "cover" | "solid";
type OverlayStyle = "default" | "profile" | "none";

type BackgroundConfig = {
  assets: BackgroundAssets | null;
  layout: BackgroundLayout;
  /** Edge color behind the photo — avoids white hairlines when the asset does not quite fill. */
  edgeColor: string;
  overlayStyle: OverlayStyle;
  objectPosition: string;
  kenBurns: boolean;
};

const DEFAULT_BACKGROUND: BackgroundAssets = {
  webp: DEFAULT_BACKGROUND_WEBP,
  fallback: DEFAULT_BACKGROUND_JPG,
};

const PROFILE_BACKGROUND: BackgroundAssets = {
  webp: PROFILE_BACKGROUND_WEBP,
  fallback: PROFILE_BACKGROUND_JPG,
};

const VOICE_BACKGROUND: BackgroundAssets = {
  webp: VOICE_BACKGROUND_WEBP,
  fallback: VOICE_BACKGROUND_JPG,
};

const KNOWLEDGE_BACKGROUND: BackgroundAssets = {
  webp: KNOWLEDGE_BACKGROUND_WEBP,
  fallback: KNOWLEDGE_BACKGROUND_JPG,
};

const ACTIONS_ONWARD_BACKGROUND: BackgroundAssets = {
  webp: PUBLIC_ASSETS.onboarding.heroActionsOnward.webp,
  fallback: PUBLIC_ASSETS.onboarding.heroActionsOnward.jpg,
};

const PLAN_BACKGROUND: BackgroundAssets = {
  webp: PUBLIC_ASSETS.onboarding.heroPlan.webp,
  fallback: PUBLIC_ASSETS.onboarding.heroPlan.jpg,
};

const NUMBER_ONWARD_INDEX = ONBOARDING_STEP_PATHS.indexOf("/onboarding/number");
const PLAN_INDEX = ONBOARDING_STEP_PATHS.indexOf("/onboarding/plan");

function usesNumberOnwardBackground(pathname: string): boolean {
  const base = pathname.split("?")[0]?.replace(/\/$/, "") ?? "";
  if (base === "/onboarding/payments") return true;

  const normalized = normalizeOnboardingPath(pathname);
  if (!normalized) return false;
  const idx = ONBOARDING_STEP_PATHS.indexOf(normalized);
  return idx >= NUMBER_ONWARD_INDEX && idx >= 0 && idx < PLAN_INDEX;
}

function heroBackgroundConfig(
  assets: BackgroundAssets,
  objectPosition = "72% 38%",
): BackgroundConfig {
  return {
    assets,
    layout: "cover",
    edgeColor: "#f6f5f3",
    overlayStyle: "profile",
    objectPosition,
    kenBurns: true,
  };
}

function backgroundAssetKey(config: BackgroundConfig): string {
  if (config.layout === "solid") return "solid";
  if (!config.assets) return config.layout;
  return config.assets.fallback;
}

function normalizeBackgroundPath(pathname: string): string {
  const base = pathname.split("?")[0]?.replace(/\/$/, "") ?? "";
  if (base.startsWith("/dev/onboarding/")) {
    return `/onboarding/${base.slice("/dev/onboarding/".length)}`;
  }
  return base;
}

function backgroundForPath(pathname: string): BackgroundConfig {
  const path = pathname === "/signup/voice" ? "/onboarding/voice" : pathname.startsWith("/signup/plan") ? "/onboarding/plan" : normalizeBackgroundPath(pathname);

  if (path === "/onboarding/profile") {
    return heroBackgroundConfig(PROFILE_BACKGROUND, "42% 48%");
  }

  if (path === "/onboarding/voice") {
    return heroBackgroundConfig(VOICE_BACKGROUND, "72% 38%");
  }

  if (path === "/onboarding/knowledge") {
    return heroBackgroundConfig(KNOWLEDGE_BACKGROUND, "50% 45%");
  }

  if (path === "/onboarding/plan" || path.startsWith("/onboarding/plan/")) {
    return heroBackgroundConfig(PLAN_BACKGROUND, "50% 45%");
  }

  if (usesNumberOnwardBackground(pathname)) {
    return heroBackgroundConfig(ACTIONS_ONWARD_BACKGROUND, "50% 45%");
  }

  return {
    assets: DEFAULT_BACKGROUND,
    layout: "sharp-width",
    edgeColor: "#ffffff",
    overlayStyle: "default",
    objectPosition: "center",
    kenBurns: false,
  };
}

/**
 * Swapping onboarding background art
 * ───────────────────────────────────
 * 1. Export 3840×2160 (16:9), save to public/, then:
 *      npm run onboarding:background -- public/your-file.jpg
 * 2. Always serve @2x — 1x looks soft on Retina MacBooks.
 * 3. Two-layer layout (sharp + blur fill):
 *    • Sharp img at full viewport width (no extra upscale).
 *    • Blurred cover behind fills 16:10 gaps — never use cover alone on
 *      the sharp layer (adds ~15% upscale and looks soft).
 * 4. Wrapper: overflow-hidden + -inset-px to kill edge hairlines.
 * 5. Tune object-position on the fill layer for focal framing.
 */
const SHARP_IMG_CLASS =
  "absolute left-0 top-1/2 z-[1] w-full max-w-none -translate-y-1/2";

/** Full-bleed sharp cover — used when the asset should fill the viewport with no blur layer. */
const COVER_IMG_BASE_CLASS = "absolute inset-0 h-full w-full object-cover";

/** Slightly oversized blurred cover — seamless gap fill, not meant to be read */
const FILL_IMG_CLASS =
  "absolute inset-0 h-full w-full scale-110 object-cover object-[65%_center] blur-2xl";

const HORIZONTAL_FADE =
  "linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 32%, rgba(255,255,255,0.28) 58%, transparent 100%)";

const VERTICAL_FADE =
  "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.45) 100%)";

const MOBILE_WASH =
  "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.82) 100%)";

/** Soft center wash — keeps the centered form readable without bleaching the photo. */
const PROFILE_CENTER_READABILITY =
  "radial-gradient(ellipse 72% 88% at 50% 44%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.18) 52%, transparent 76%)";

const PROFILE_TOP_BOTTOM_SOFTEN =
  "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 16%, transparent 84%, rgba(255,255,255,0.08) 100%)";

const PROFILE_MOBILE_WASH =
  "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.5) 58%, rgba(255,255,255,0.32) 100%)";

const profilePhotoVariants: Variants = {
  hidden: { opacity: 0, scale: 1.16 },
  enter: {
    opacity: 1,
    scale: 1,
    transition: onboardingProfileBgEnterTransition,
  },
};

/** Full-bleed hero enter — opacity + scale zoom (profile / voice / knowledge steps). */
export function HeroPhotoEnter({
  src,
  objectPosition,
  animateIn,
  resetKey,
}: {
  src: string;
  objectPosition: string;
  animateIn: boolean;
  resetKey: string;
}) {
  const [phase, setPhase] = useState<"hidden" | "enter">("hidden");

  useEffect(() => {
    if (!animateIn) return;
    const id = requestAnimationFrame(() => setPhase("enter"));
    return () => cancelAnimationFrame(id);
  }, [animateIn, resetKey]);

  return (
    <motion.img
      key={`${resetKey}-${animateIn ? "in" : "out"}`}
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={COVER_IMG_BASE_CLASS}
      style={{ objectPosition }}
      decoding="async"
      fetchPriority="high"
      variants={profilePhotoVariants}
      initial="hidden"
      animate={animateIn ? phase : "hidden"}
    />
  );
}

function BackgroundPhoto({
  config,
  className,
  animateIn,
  reduceMotion,
  resetKey,
}: {
  config: BackgroundConfig;
  className?: string;
  animateIn: boolean;
  reduceMotion: boolean;
  resetKey: string;
}) {
  const { assets, layout, edgeColor, objectPosition, kenBurns } = config;

  if (!assets) {
    return null;
  }

  if (layout === "cover") {
    const imgStyle = { objectPosition };
    const imgClass = COVER_IMG_BASE_CLASS;

    return (
      <div
        className={`absolute -inset-px overflow-hidden ${className ?? ""}`}
        style={{ backgroundColor: edgeColor }}
      >
        {kenBurns && !reduceMotion ? (
          <HeroPhotoEnter
            src={assets.fallback}
            objectPosition={objectPosition}
            animateIn={animateIn}
            resetKey={resetKey}
          />
        ) : (
          <picture>
            <source srcSet={assets.webp} type="image/webp" />
            <img
              src={assets.fallback}
              alt=""
              aria-hidden
              draggable={false}
              className={imgClass}
              style={imgStyle}
              decoding="async"
              fetchPriority="high"
            />
          </picture>
        )}
      </div>
    );
  }

  return (
    <div
      className={`absolute -inset-px overflow-hidden ${className ?? ""}`}
      style={{ backgroundColor: edgeColor }}
    >
      <picture>
        <source srcSet={assets.webp} type="image/webp" />
        <img
          src={assets.fallback}
          alt=""
          aria-hidden
          draggable={false}
          className={FILL_IMG_CLASS}
          decoding="async"
        />
      </picture>
      <picture>
        <source srcSet={assets.webp} type="image/webp" />
        <img
          src={assets.fallback}
          alt=""
          aria-hidden
          draggable={false}
          className={SHARP_IMG_CLASS}
          decoding="async"
          fetchPriority="high"
        />
      </picture>
    </div>
  );
}

function BackgroundOverlays({ style }: { style: OverlayStyle }) {
  if (style === "none") {
    return null;
  }

  if (style === "profile") {
    return (
      <>
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
      </>
    );
  }

  return (
    <>
      <div className="absolute inset-0 md:hidden" style={{ background: MOBILE_WASH }} />
      <div
        className="absolute inset-0 hidden md:block"
        style={{ background: HORIZONTAL_FADE }}
      />
      <div
        className="absolute inset-0 hidden md:block"
        style={{ background: VERTICAL_FADE }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(15,23,42,0.1)_0%,transparent_58%)]" />
    </>
  );
}

/**
 * Full-viewport onboarding photo — sharp asset, gradient readability overlays.
 */
export function OnboardingCanvasBackground() {
  const pathname = usePathname();
  const config = backgroundForPath(pathname);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const ready = useOnboardingAnimateIn();
  const animationKey = `${backgroundAssetKey(config)}-${ready ? "on" : "off"}`;
  const signupPath=pathname.replace(/^\/dev\/onboarding/,"/signup");
  const scene=signupPath==="/signup/voice" ? PUBLIC_ASSETS.signupScenes.voice : signupPath.startsWith("/signup/plan/checkout") ? PUBLIC_ASSETS.signupScenes.billing : signupPath==="/signup/plan" ? PUBLIC_ASSETS.signupScenes.plans : null;
  if(scene) return <div aria-hidden className="absolute inset-0 bg-white" />;


  if (config.layout === "solid") {
    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ backgroundColor: config.edgeColor }}
        aria-hidden
      />
    );
  }

  if (prefersReducedMotion) {
    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ backgroundColor: config.edgeColor }}
        aria-hidden
      >
        <BackgroundPhoto
          config={config}
          animateIn={ready}
          reduceMotion={prefersReducedMotion}
          resetKey={animationKey}
        />
        <BackgroundOverlays style={config.overlayStyle} />
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ backgroundColor: config.edgeColor }}
      aria-hidden
    >
      {config.kenBurns ? (
        <BackgroundPhoto
          config={config}
          animateIn={ready}
          reduceMotion={prefersReducedMotion}
          resetKey={animationKey}
        />
      ) : (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={ready ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.95, ease: ONBOARDING_EASE }}
        >
          <BackgroundPhoto
            config={config}
            animateIn={ready}
            reduceMotion={prefersReducedMotion}
            resetKey={animationKey}
          />
        </motion.div>
      )}

      <BackgroundOverlays style={config.overlayStyle} />
    </div>
  );
}
