"use client";

import { FormFeedback } from "@/components/ui/form-feedback";
import type { CheckoutFeedback as Feedback } from "@/lib/checkout-feedback";

export function CheckoutFeedback({ feedback }: {feedback: Feedback; cardSaved: boolean}) {
  return <FormFeedback message={feedback.message} title={feedback.title} focusOnError/>;
}
