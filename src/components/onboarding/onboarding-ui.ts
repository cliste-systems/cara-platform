/** Cliste logo mark — same size on every onboarding step. */
export const ONBOARDING_LOGO_SIZE = 44;

/** Small label above a step title (e.g. Train Cara). */
export const ONBOARDING_STEP_EYEBROW =
  "text-center text-[11px] font-medium tracking-[0.06em] text-slate-500 uppercase";

/** Vertical gap between logo and step title. */
export const ONBOARDING_SHELL_LOGO_GAP = "gap-3";

/** Vertical gap between the title block and step content. */
export const ONBOARDING_SHELL_SECTION_GAP = "gap-5 sm:gap-6";

export const ONBOARDING_HEADLINE =
  "text-center text-[1.625rem] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[1.75rem]";

/** Personal name inside a greeting headline — lighter than the semibold title. */
export const ONBOARDING_HEADLINE_NAME =
  "font-normal italic text-slate-500";

export const ONBOARDING_SUBHEADLINE =
  "mx-auto max-w-sm text-center text-[13px] leading-relaxed text-slate-500";

/** Form field boxes — solid white cards for readability on photo background. */
export const ONBOARDING_FIELD_BOX =
  "rounded-2xl border border-slate-200/75 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.06)] transition-[border-color,background-color,box-shadow] duration-200";

export const ONBOARDING_FIELD_BOX_INVALID =
  "border-red-300/90 bg-red-50/60 shadow-[0_8px_32px_rgba(220,38,38,0.08)] ring-1 ring-red-200";

export const ONBOARDING_FIELD_ERROR =
  "mt-1.5 text-[12px] font-medium leading-snug text-[#a13d35]";

export const ONBOARDING_FIELD_LABEL =
  "text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500";

export const ONBOARDING_FIELD_HINT =
  "mt-1 text-[11px] leading-snug text-slate-500";

export const ONBOARDING_FIELD_INPUT =
  "mt-1.5 w-full border-0 bg-transparent p-0 text-[15px] text-[#0b1220] shadow-none outline-none ring-0 placeholder:text-slate-500 focus-visible:ring-0";

export const ONBOARDING_FIELD_TEXTAREA =
  "mt-1.5 min-h-[56px] w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-relaxed text-[#0b1220] shadow-none outline-none ring-0 placeholder:text-slate-500 focus-visible:ring-0";

/** Selection / panel cards (plan tiles, phone result). */
export const ONBOARDING_SELECTION_CARD =
  "cursor-pointer rounded-2xl border border-slate-200/75 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)] transition-[border-color,box-shadow,transform] duration-150";

export const ONBOARDING_SELECTION_CARD_ACTIVE =
  "border-[#0b1220]/25 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.1)] ring-1 ring-[#0b1220]/10";

export const ONBOARDING_PRIMARY_BUTTON =
  "group relative inline-flex h-11 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full border border-[#0b1220] bg-[#0b1220] px-8 text-[14px] font-medium text-white shadow-[0_8px_24px_rgba(11,18,32,0.22)] transition-[color,background-color,box-shadow,transform] duration-200 ease-out hover:bg-[#151515] hover:text-white hover:shadow-[0_10px_32px_rgba(11,18,32,0.14)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:bg-[#0b1220] disabled:hover:text-white [&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:ease-out group-hover:[&_svg]:translate-x-1";

export const ONBOARDING_PRIMARY_BUTTON_SHIMMER =
  "pointer-events-none absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 ease-out group-hover:translate-x-full";

export const ONBOARDING_SECONDARY_BUTTON =
  "inline-flex h-11 min-w-[7.5rem] cursor-pointer items-center justify-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-5 text-[14px] font-medium text-slate-700 shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-[color,background-color,border-color,box-shadow] duration-200 hover:border-slate-300 hover:bg-slate-100 hover:text-[#0b1220] hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:border-slate-200/90 disabled:hover:bg-white/90 disabled:hover:text-slate-700";

/** Frosted surface for steps over the landscape photo (Framer-style glass). */
export const ONBOARDING_GLASS_CARD =
  "border border-white/55 bg-white/50 shadow-[0_16px_56px_rgba(15,23,42,0.09),inset_0_1px_0_rgba(255,255,255,0.82)] ring-1 ring-white/35 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/38";

/** Primary floating composer / input capsule — one visible surface, no box-in-box. */
export const ONBOARDING_GLASS_FLOAT =
  "border border-black/[0.07] bg-white/75 shadow-[0_28px_90px_-20px_rgba(15,23,42,0.28),0_0_0_1px_rgba(255,255,255,0.75)_inset] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/58";

/** Cara preview / notes panel on glass. */
export const ONBOARDING_GLASS_PREVIEW =
  "border border-black/[0.06] bg-white/62 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/48";

/** Profile step — frosted fields over the Cara hero photo. */
export const ONBOARDING_PROFILE_FIELD_BOX =
  "rounded-2xl border border-white/65 bg-white/48 px-4 py-3 shadow-[0_10px_40px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.92)] ring-1 ring-white/45 backdrop-blur-xl supports-[backdrop-filter]:bg-white/36 transition-[border-color,background-color,box-shadow,transform] duration-300";

export const ONBOARDING_PROFILE_FIELD_BOX_INVALID =
  "border-red-300/80 bg-red-50/55 shadow-[0_10px_40px_rgba(220,38,38,0.1)] ring-1 ring-red-200/80";

export const ONBOARDING_PROFILE_FIELD_BOX_LOCKED =
  "rounded-2xl border border-dashed border-white/55 bg-white/30 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_28px_rgba(15,23,42,0.05)] ring-1 ring-white/35 backdrop-blur-xl supports-[backdrop-filter]:bg-white/24";

export const ONBOARDING_PROFILE_FIELD_BOX_PREVIEW =
  "rounded-2xl border border-white/55 bg-white/42 px-4 py-3.5 shadow-[0_12px_40px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.88)] ring-1 ring-white/40 backdrop-blur-xl supports-[backdrop-filter]:bg-white/32";

export const ONBOARDING_PROFILE_HEADLINE =
  "text-left text-[1.75rem] font-semibold leading-[1.15] tracking-tight text-[#0b1220] sm:text-[2rem]";

export const ONBOARDING_PROFILE_SUBHEADLINE =
  "max-w-md text-left text-[14px] leading-relaxed text-slate-600/90";

export const ONBOARDING_PROFILE_EYEBROW =
  "text-left text-[11px] font-medium tracking-[0.08em] text-slate-500/90 uppercase";
