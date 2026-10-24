import type { Appearance } from "@stripe/stripe-js";

export const CLISTE_STRIPE_FONT_FAMILY =
  "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif";

/** Load Inter inside Stripe iframes (CSS variables don't cross the boundary). */
export const CLISTE_STRIPE_FONTS = [
  {
    cssSrc:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
  },
];

/** Cliste onboarding / billing — Stripe Elements appearance. */
export const CLISTE_STRIPE_APPEARANCE: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#292929",
    colorBackground: "#ffffff",
    colorText: "#292929",
    colorTextSecondary: "#737373",
    colorTextPlaceholder: "#737373",
    colorDanger: "#69504b",
    fontFamily: CLISTE_STRIPE_FONT_FAMILY,
    fontSizeBase: "16px",
    fontWeightNormal: "400",
    fontWeightMedium: "500",
    borderRadius: "10px",
    spacingUnit: "3px",
    focusBoxShadow: "0 0 0 2px rgba(41, 41, 41, 0.12)",
  },
  rules: {
    ".Input": {
      border: "1px solid #dedede",
      boxShadow: "none",
      padding: "10px 12px",
      fontSize: "16px",
      fontFamily: CLISTE_STRIPE_FONT_FAMILY,
    },
    ".Input:focus": {
      border: "1px solid #292929",
    },
    ".Label": {
      fontSize: "11px",
      fontWeight: "500",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#626262",
      marginBottom: "4px",
      fontFamily: CLISTE_STRIPE_FONT_FAMILY,
    },
    ".Tab": {
      border: "1px solid #dedede",
      borderRadius: "10px",
      boxShadow: "none",
      padding: "8px 10px",
    },
    ".Tab:hover": {
      border: "1px solid #929292",
    },
    ".Tab--selected": {
      border: "1px solid #292929",
      backgroundColor: "#f5f5f5",
      boxShadow: "none",
    },
    ".TabLabel": {
      fontSize: "13px",
      fontWeight: "500",
      fontFamily: CLISTE_STRIPE_FONT_FAMILY,
    },
    ".AccordionItem": {
      border: "1px solid #dedede",
      borderRadius: "10px",
      boxShadow: "none",
    },
    ".AccordionItem:hover": {
      borderColor: "#929292",
    },
    ".AccordionItem--selected": {
      borderColor: "#292929",
      boxShadow: "none",
    },
    ".AccordionItem:focus-visible": {
      outline: "2px solid rgba(41, 41, 41, 0.45)",
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
      color: "#626262",
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
