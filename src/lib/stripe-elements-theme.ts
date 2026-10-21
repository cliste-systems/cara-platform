import type { Appearance } from "@stripe/stripe-js";

export const CLISTE_STRIPE_FONT_FAMILY =
  "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif";

/** Load Geist inside Stripe iframes (CSS variables don't cross the boundary). */
export const CLISTE_STRIPE_FONTS = [
  {
    cssSrc:
      "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap",
  },
];

/** Cliste onboarding / billing — Stripe Elements appearance. */
export const CLISTE_STRIPE_APPEARANCE: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#0b1220",
    colorBackground: "#ffffff",
    colorText: "#0b1220",
    colorTextSecondary: "#64748b",
    colorTextPlaceholder: "#64748b",
    colorDanger: "#a13d35",
    fontFamily: CLISTE_STRIPE_FONT_FAMILY,
    fontSizeBase: "16px",
    fontWeightNormal: "400",
    fontWeightMedium: "500",
    borderRadius: "10px",
    spacingUnit: "3px",
    focusBoxShadow: "0 0 0 2px rgba(11, 18, 32, 0.1)",
  },
  rules: {
    ".Input": {
      border: "1px solid rgba(226, 232, 240, 0.95)",
      boxShadow: "none",
      padding: "10px 12px",
      fontSize: "16px",
      fontFamily: CLISTE_STRIPE_FONT_FAMILY,
    },
    ".Input:focus": {
      border: "1px solid rgba(11, 18, 32, 0.3)",
    },
    ".Label": {
      fontSize: "11px",
      fontWeight: "500",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#637075",
      marginBottom: "4px",
      fontFamily: CLISTE_STRIPE_FONT_FAMILY,
    },
    ".Tab": {
      border: "1px solid rgba(226, 232, 240, 0.95)",
      borderRadius: "10px",
      boxShadow: "none",
      padding: "8px 10px",
    },
    ".Tab:hover": {
      border: "1px solid rgba(148, 163, 184, 0.9)",
    },
    ".Tab--selected": {
      border: "1px solid rgba(11, 18, 32, 0.22)",
      backgroundColor: "rgba(11, 18, 32, 0.04)",
      boxShadow: "none",
    },
    ".TabLabel": {
      fontSize: "13px",
      fontWeight: "500",
      fontFamily: CLISTE_STRIPE_FONT_FAMILY,
    },
    ".AccordionItem": {
      border: "1px solid rgba(226, 232, 240, 0.95)",
      borderRadius: "10px",
      boxShadow: "none",
    },
    ".AccordionItem:hover": {
      borderColor: "rgba(148, 163, 184, 0.9)",
    },
    ".AccordionItem--selected": {
      borderColor: "rgba(11, 18, 32, 0.3)",
      boxShadow: "none",
    },
    ".AccordionItem:focus-visible": {
      outline: "2px solid rgba(11, 18, 32, 0.45)",
      outlineOffset: "2px",
    },
    ".Block": {
      borderRadius: "12px",
      border: "none",
      boxShadow: "none",
      padding: "0",
    },
    ".TermsText": {
      fontSize: "11px",
      lineHeight: "1.45",
      color: "#637075",
      fontFamily: CLISTE_STRIPE_FONT_FAMILY,
    },
    ".Text": {
      fontFamily: CLISTE_STRIPE_FONT_FAMILY,
    },
    ".PickerItem": {
      fontFamily: CLISTE_STRIPE_FONT_FAMILY,
    },
  },
};
