import {processOwnerCallAlerts} from './owner-call-sms-alerts';
const state=globalThis as typeof globalThis & {__ownerAlertWorker?:boolean};
export function startDevelopmentOwnerAlertWorker(){
 if(process.env.NODE_ENV!=='development'||state.__ownerAlertWorker||!process.env.SUPABASE_SERVICE_ROLE_KEY)return;
 state.__ownerAlertWorker=true;
 const poll=async()=>{try{await processOwnerCallAlerts();}catch{console.error('[owner-call-alerts] Queue check failed.');}finally{setTimeout(()=>void poll(),30_000).unref();}};
 setTimeout(()=>void poll(),1000).unref();
}
