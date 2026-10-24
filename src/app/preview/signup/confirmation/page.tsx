import { notFound } from "next/navigation";
import { SignupConfirmation } from "@/components/onboarding/signup-confirmation";

export default function ConfirmationPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SignupConfirmation />;
}
