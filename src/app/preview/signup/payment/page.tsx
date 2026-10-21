import { notFound } from "next/navigation";
import { PaymentPreview } from "./payment-preview";
export const dynamic = "force-dynamic";
export default async function LocalPaymentPreview({searchParams}:{searchParams:Promise<{setup?:string}>}) {
  if (process.env.NODE_ENV !== "development" || !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim().startsWith("pk_test_")) notFound();
  const {setup}=await searchParams;
  return <PaymentPreview setupTier={setup === "remote" || setup === "onsite_dublin" ? setup : "diy"} />;
}
