"use client";

import type { CheckoutFeedback as Feedback } from "@/lib/checkout-feedback";
import { FormFeedback } from "@/components/ui/form-feedback";

/** Billing uses the same feedback layout and motion as signup and setup. */
export function CheckoutFeedback({ feedback }: {
  feedback: Feedback | null;
  cardSaved: boolean;
  onEditPayment?: () => void;
}) {
  return <FormFeedback title={feedback?.title} message={feedback?.message} focusOnError/>;
}
