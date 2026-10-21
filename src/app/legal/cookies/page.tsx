import { redirect } from "next/navigation";
import { publicLegalUrl } from "@/lib/public-legal-url";

export default function PublicLegalRedirect() {
  redirect(publicLegalUrl("/legal/cookies"));
}
