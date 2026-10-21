"use server";
import {prepareAdminElementsCheckoutPreview} from "@/lib/dev-stripe-checkout-preview";
export async function updateAdminCheckoutSetup(orgId:string,plan:string,setup:string) {
 const checkout=await prepareAdminElementsCheckoutPreview({plan,setup});
 if(!checkout.ok)return checkout;
 const destination=`/admin/customers/${encodeURIComponent(orgId)}/setup-preview?screen=confirmation`;
 return {...checkout,returnUrl:new URL(destination,checkout.returnUrl).toString()};
}
