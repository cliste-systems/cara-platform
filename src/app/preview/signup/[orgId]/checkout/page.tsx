import {requireAdminPermission} from "@/lib/admin-session";
import {prepareAdminElementsCheckoutPreview} from "@/lib/dev-stripe-checkout-preview";
import {SignupBillingCheckout} from "@/components/billing/signup-billing-checkout";
import {updateAdminCheckoutSetup} from "./actions";
export const dynamic="force-dynamic";
export default async function CheckoutPreview({params,searchParams}:{params:Promise<{orgId:string}>;searchParams:Promise<{plan?:string}>}) {
 await requireAdminPermission("customers");
 const {orgId}=await params,selection=await searchParams;
 const checkout=await prepareAdminElementsCheckoutPreview(selection);
 if(!checkout.ok)return <p role="alert" className="p-8">{checkout.message}</p>;
 const destination=`/preview/signup/${orgId}/welcome`;
 return <SignupBillingCheckout initialCheckout={{...checkout,returnUrl:new URL(destination,checkout.returnUrl).toString()}} onSetupChange={updateAdminCheckoutSetup.bind(null,orgId,selection.plan??"pro")} preview previewContinueHref={destination}/>;
}
