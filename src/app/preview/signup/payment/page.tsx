import { notFound } from "next/navigation";
import { PaymentPreview } from "./payment-preview";
export const dynamic = "force-dynamic";
export default async function LocalPaymentPreview({searchParams}:{searchParams:Promise<{setup?:string;error?:string}>}) {
  if (process.env.NODE_ENV !== "development" || !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim().startsWith("pk_test_")) notFound();
  const {setup,error}=await searchParams;
  return <PaymentPreview cardDeclined={error === "card-declined"} setupTier={setup === "remote" || setup === "onsite_dublin" ? setup : "diy"} />;
}
