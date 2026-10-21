"use server";
import twilio from "twilio";
import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/admin-session";
import { createAdminClient } from "@/utils/supabase/admin";
export async function reviewFirstCallBusiness(orgId:string,form:FormData){
 const user=await requireAdminPermission("customers"); await requireAdminPermission("support");
 if(!/^[0-9a-f-]{36}$/i.test(orgId)) return {ok:false,message:"Invalid business."};
 const status=String(form.get("status")??""),note=String(form.get("note")??"").trim(),bundleSid=String(form.get("bundle")??"").trim();
 if(!["verified","needs_information"].includes(status)||note.length<10||note.length>2000) return {ok:false,message:"Select an outcome and enter a customer-facing note (10–2,000 characters)."};
 if(status==="verified"){
  if(form.get("confirm")!=="on"||!/^BU[0-9a-f]{32}$/i.test(bundleSid)) return {ok:false,message:"Confirm this bundle belongs to this business and enter its Twilio bundle SID."};
  const sid=process.env.TWILIO_ACCOUNT_SID?.trim(),token=process.env.TWILIO_AUTH_TOKEN?.trim();
  if(!sid||!token) return {ok:false,message:"Twilio verification is not configured. Approval has not been saved."};
  try {const bundle=await twilio(sid,token).numbers.v2.regulatoryCompliance.bundles(bundleSid).fetch();if(bundle.status!=="twilio-approved")return {ok:false,message:"Twilio has not approved this bundle. Approval has not been saved."};}catch{return {ok:false,message:"The Twilio bundle could not be checked. Approval has not been saved."};}
 }
 const {error}=await createAdminClient().rpc("review_first_call_business",{p_org:orgId,p_reviewer:user.id,p_status:status,p_note:note,p_bundle:status==="verified"?bundleSid:null,p_submitted_at:String(form.get("submittedAt")??"")});
 if(error)return {ok:false,message:"The review could not be saved. Refresh to check whether the customer updated their submission."};
 revalidatePath(`/admin/customers/${orgId}`);revalidatePath("/dashboard");revalidatePath("/admin/support");
 return {ok:true,message:"Review saved and added to the customer’s verification conversation."};
}
