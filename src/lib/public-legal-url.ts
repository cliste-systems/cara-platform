import { MARKETING_SITE_URL } from "@/lib/company-details";

/** Public documents live on the marketing site; dashboard documents stay in the app. */
export function publicLegalUrl(path: string): string {
  const origin = process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim() ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : MARKETING_SITE_URL);
  return `${origin.replace(/\/$/, "")}${path}`;
}
