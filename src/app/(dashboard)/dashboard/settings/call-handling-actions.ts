"use server";
import {revalidatePath} from 'next/cache';
import {requireDashboardAdmin} from '@/lib/dashboard-admin';
import {firstCallConfigPatch} from '@/lib/first-call-config';
import {parseBusinessHoursBundle} from '@/lib/business-hours';
import {regenerateCaraCustomPrompt} from '@/lib/cara-prompt-from-org';

export async function saveCallHandlingPreferences(raw:Record<string,string>):Promise<{ok:true}|{ok:false;message:string}> {
 const {supabase,organizationId}=await requireDashboardAdmin();
 const parsed=firstCallConfigPatch('hours',{outsideAvailability:raw?.outsideAvailability??'',smsAlerts:raw?.smsAlerts??'',alertPhone:raw?.alertPhone??''},'');
 if(!parsed.ok)return parsed;
 const policy=parseBusinessHoursBundle(parsed.patch.business_hours).meta.outsideHours;
 const {data:org,error}=await supabase.from('organizations').select('business_hours,updated_at').eq('id',organizationId).single();
 if(error||!org)return {ok:false,message:'Your settings could not be loaded.'};
 const stamp=new Date().toISOString();
 const {error:writeError}=await supabase.from('organizations').update({business_hours:{...(org.business_hours??{}),_outsideHours:policy},updated_at:stamp}).eq('id',organizationId).eq('updated_at',org.updated_at).select('id').single();
 if(writeError)return {ok:false,message:'Your settings changed. Refresh and try again.'};
 let compiled=false;
 try{compiled=(await regenerateCaraCustomPrompt(supabase,organizationId)).ok;}catch{}
 if(!compiled){await supabase.from('organizations').update({business_hours:org.business_hours,updated_at:new Date().toISOString()}).eq('id',organizationId).eq('updated_at',stamp);return {ok:false,message:'Cara’s instructions could not be updated. Please retry.'};}
 revalidatePath('/dashboard/settings');revalidatePath('/dashboard');
 return {ok:true};
}
