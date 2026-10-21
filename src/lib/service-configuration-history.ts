import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {serviceItems} from './service-selection';

export type ServiceConfiguration = {services:string; notOffered:string};
const SOURCE='service_configuration_backup';
function same(a:ServiceConfiguration,b:ServiceConfiguration) {
 return serviceItems(a.services).join('\n')===serviceItems(b.services).join('\n') && serviceItems(a.notOffered).join('\n')===serviceItems(b.notOffered).join('\n');
}
/** Caller derives organization/actor from an authenticated owner session. */
export async function archiveServiceConfiguration(admin:SupabaseClient,organizationId:string,actorId:string,previous:ServiceConfiguration,next:ServiceConfiguration):Promise<boolean> {
 if(!(previous.services.trim()||previous.notOffered.trim())||same(previous,next))return true;
 const {error}=await admin.from('cara_knowledge_events').insert({organization_id:organizationId,event_type:'edited',category:'services',title:'Previous services saved',source:SOURCE,actor_id:actorId,payload:{version:1,services:previous.services,notOffered:previous.notOffered}});
 return !error;
}
export async function previousServiceConfiguration(admin:SupabaseClient,organizationId:string,current:ServiceConfiguration):Promise<ServiceConfiguration|null> {
 const {data,error}=await admin.from('cara_knowledge_events').select('payload').eq('organization_id',organizationId).eq('source',SOURCE).order('created_at',{ascending:false}).limit(10);
 if(error)return null;
 for(const row of data??[]) {
  const p=row.payload;
  if(p?.version!==1||typeof p.services!=='string'||typeof p.notOffered!=='string'||p.services.length>3000||p.notOffered.length>3000)continue;
  const previous={services:p.services,notOffered:p.notOffered};
  if((previous.services.trim()||previous.notOffered.trim())&&!same(previous,current))return previous;
 }
 return null;
}
