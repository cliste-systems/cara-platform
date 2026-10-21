import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";
import { assignFromPoolForOrg, findAssignedNumberForOrg } from "@/lib/phone-pool-assign";
/** Reserve existing inventory only. No purchase, placeholder creation or activation. */
export async function reserveSignupPoolNumber(organizationId:string){
 const admin=createAdminClient();
 const existing=await findAssignedNumberForOrg(admin,organizationId);
 if(existing)return existing;
 return assignFromPoolForOrg(admin,organizationId,"IE",{twilioOnly:true});
}
