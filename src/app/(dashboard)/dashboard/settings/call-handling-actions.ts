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
 const businessHours={...(org.business_hours??{}),_outsideHours:policy};
 const compiled=await regenerateCaraCustomPrompt(supabase,organizationId,{dryRun:true,orgPatch:{business_hours:businessHours}});
 if(!compiled.ok||!compiled.prompt)return {ok:false,message:'Cara’s call information could not be updated. Your current settings are unchanged.'};
 const {data:saved,error:writeError}=await supabase.from('organizations').update({business_hours:businessHours,custom_prompt:compiled.prompt,prompt_compile_warnings:compiled.warnings??null,updated_at:new Date().toISOString()}).eq('id',organizationId).eq('updated_at',org.updated_at).select('id').maybeSingle();
 if(writeError||!saved)return {ok:false,message:'Your settings changed. Refresh and try again.'};
 revalidatePath('/dashboard/settings');revalidatePath('/dashboard');
 return {ok:true};
}
