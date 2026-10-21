"use server";
import {prepareAdminElementsCheckoutPreview} from "@/lib/dev-stripe-checkout-preview";
export async function updateAdminCheckoutSetup(orgId:string,plan:string,setup:string) {
 const checkout=await prepareAdminElementsCheckoutPreview({plan,setup});
 if(!checkout.ok)return checkout;
 const destination=`/preview/signup/${encodeURIComponent(orgId)}/welcome`;
 return {...checkout,returnUrl:new URL(destination,checkout.returnUrl).toString()};
}
