"use server";
import {businessSetupIssue} from '@/lib/business-onboarding-scope';
import {revalidatePath} from 'next/cache';
import {requireDashboardAdmin} from '@/lib/dashboard-admin';
import {classificationFromFields,classificationBusinessType,classificationNiche} from '@/lib/business-classification';
import {regenerateCaraCustomPrompt} from '@/lib/cara-prompt-from-org';

export async function saveBusinessClassification(serialized:string){
 const session=await requireDashboardAdmin();
 const classification=classificationFromFields({businessClassification:serialized});
 if(!classification)return {ok:false,message:'Choose a valid industry and at least one speciality.'};
 const scopeIssue=businessSetupIssue(classification);if(scopeIssue)return {ok:false,message:scopeIssue};
 const {data:org,error}=await session.supabase.from('organizations').select('niche,business_classification,agent_business_type,updated_at').eq('id',session.organizationId).single();
 if(error||!org)return {ok:false,message:'Your business settings could not be loaded.'};
 if(org.niche==='retail')return {ok:false,message:'Retail setup is managed by our team.'};
 const stamp=new Date().toISOString();
 let query=session.supabase.from('organizations').update({business_classification:classification,niche:classificationNiche(classification),agent_business_type:classificationBusinessType(classification),updated_at:stamp}).eq('id',session.organizationId);
 if(org.updated_at)query=query.eq('updated_at',org.updated_at);
 const {error:writeError}=await query.select('id').single();
 if(writeError)return {ok:false,message:'Settings changed while you were editing. Refresh and try again.'};
 let compiled=false;
 try{compiled=(await regenerateCaraCustomPrompt(session.supabase,session.organizationId)).ok;}catch{}
 if(!compiled){
  const {error:rollbackError}=await session.supabase.from('organizations').update({business_classification:org.business_classification,niche:org.niche,agent_business_type:org.agent_business_type,updated_at:new Date().toISOString()}).eq('id',session.organizationId).eq('updated_at',stamp);
  return {ok:false,message:rollbackError?'Cara’s instructions could not be rebuilt. Refresh your settings and retry.':'Cara’s instructions could not be rebuilt. Your previous classification has been restored.'};
 }
 revalidatePath('/dashboard');revalidatePath('/dashboard/business/profile');
 return {ok:true,message:'Business type saved. Existing services and exclusions are unchanged—review them if your scope has changed.'};
}
