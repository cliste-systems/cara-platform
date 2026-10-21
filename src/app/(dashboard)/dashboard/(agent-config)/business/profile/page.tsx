import {BusinessProfileTab} from "../../../cara-setup/business-profile-tab";
import {requireDashboardSession} from "@/lib/dashboard-session";
import {hasAccountOwnerAccess} from "@/lib/account-owner-access";
import {parseBusinessClassification} from "@/lib/business-classification";
export default async function BusinessProfilePage(){
 const session=await requireDashboardSession();
 const [{data,error},canManage]=await Promise.all([
  session.supabase.from("organizations").select("business_classification").eq("id",session.organizationId).single(),
  hasAccountOwnerAccess(session.supabase,{userId:session.user.id,accountId:session.accountId,profileRole:session.profile.role}),
 ]);
 if(error)throw new Error("Your business classification could not be loaded.");
 return <BusinessProfileTab classification={parseBusinessClassification(data.business_classification)} canManage={canManage}/>;
}
