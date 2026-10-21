export type CheckoutFeedback = { title: string; message: string; retryLabel: string };

/** Customer-safe recovery copy; never expose raw server errors in checkout. */
export function checkoutFeedback(stage: "details" | "confirmation" | "connection" | "workspace", error?: {code?:string;type?:string;message?:string}): CheckoutFeedback {
  if (stage === "workspace") return {title:"Your card is saved",message:"We couldn’t finish setting up your workspace. Try again to complete your signup.",retryLabel:"Finish setting up"};
  if (stage === "details") return {title:"Check your payment details",message:error?.message || "Complete the highlighted fields, then try again.",retryLabel:"Try again"};
  if (stage === "connection" || error?.type === "api_connection_error" || error?.type === "api_error") return {title:"We couldn’t connect to Stripe",message:"Please check your connection and try again. Your details are still on this page.",retryLabel:"Try again"};
  if (error?.code === "card_declined") return {title:"Your card wasn’t accepted",message:"Try another card, or contact your bank before trying again.",retryLabel:"Try again"};
  return {title:"Your payment method wasn’t confirmed",message:error?.type === "card_error" || error?.type === "validation_error" ? error.message || "Check your payment details and try again." : "Please try again, or choose another payment method.",retryLabel:"Try again"};
}
