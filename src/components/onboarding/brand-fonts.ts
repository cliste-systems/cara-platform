import localFont from "next/font/local";

// Self-hosted Latin font files shared with the marketing website.
export const signupBody = localFont({
  src: "./fonts/inter.woff2",
  variable: "--font-signup-body",
  weight: "300 700",
  display: "swap",
});
export const signupDisplay = localFont({
  src: "./fonts/mona_sans.woff2",
  variable: "--font-signup-display",
  weight: "500 900",
  display: "swap",
});
