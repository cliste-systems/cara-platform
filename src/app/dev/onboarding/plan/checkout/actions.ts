"use server";
import { prepareDevElementsCheckoutPreview } from "@/lib/dev-stripe-checkout-preview";
export async function updateDevCheckoutSetup(plan: string, setup: string) {
  return prepareDevElementsCheckoutPreview({plan,setup});
}
