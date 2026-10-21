import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {parseBusinessHoursBundle} from './business-hours';
import * as policy from './outside-hours-policy';

type Row=Record<string,any>;
function fixture(options:{sms?:string;test?:boolean;urgent?:boolean;result?:any}={}) {
 const calls:Row[]=[{id:'call-1',organization_id:'org-1',outcome:'callback_requested',ai_summary:'Caller has a burst pipe; private details',transcript:'Caller: A burst pipe is flooding my kitchen.',is_test_call:options.test??false,is_urgent:options.urgent??false}];
 const orgs:Row[]=[{id:'org-1',is_active:true,business_hours:{_outsideHours:{version:2,availability:'urgent_only',sms:options.sms??'urgent',phone:'+353871234567'}}}];
 const jobs:Row[]=[],sent:Row[]=[];
 let response=options.result??{ok:true};
 const tables:Record<string,Row[]>={call_logs:calls,organizations:orgs,owner_call_sms_alerts:jobs};
 class Query {
  filters:((row:Row)=>boolean)[]=[];patch:Row|null=null;upsertRow:Row|null=null;
  constructor(readonly table:string){}
  select(){return this;}
  eq(key:string,value:unknown){this.filters.push(row=>row[key]===value);return this;}
  is(key:string,value:unknown){this.filters.push(row=>(row[key]??null)===value);return this;}
  lt(key:string,value:string){this.filters.push(row=>row[key]!=null&&row[key]<value);return this;}
  update(patch:Row){this.patch=patch;return this;}
  upsert(row:Row){this.upsertRow=row;return this;}
  run(){let rows=tables[this.table].filter(row=>this.filters.every(filter=>filter(row)));if(this.upsertRow){if(jobs.some(job=>job.call_log_id===this.upsertRow!.call_log_id))rows=[];else{const job={...this.upsertRow,status:'pending',attempts:0,next_attempt_at:new Date().toISOString()};jobs.push(job);rows=[job];}}if(this.patch)for(const row of rows)Object.assign(row,this.patch);return {data:rows,error:null};}
  async single(){const result=this.run();return {...result,data:result.data[0]??null};}
  then(resolve:any,reject:any){return Promise.resolve(this.run()).then(resolve,reject);}
 }
 const admin={from:(table:string)=>new Query(table),rpc:async(_name:string,args:Row)=>{const selected=jobs.filter(job=>['pending','failed'].includes(job.status)&&job.attempts<3&&job.next_attempt_at&&job.next_attempt_at<=new Date().toISOString()&&(!args.p_call_id||job.call_log_id===args.p_call_id));for(const job of selected)Object.assign(job,{status:'sending',attempts:job.attempts+1,lease_token:'lease-'+job.attempts,lease_expires_at:new Date(Date.now()+120_000).toISOString()});return {data:selected.map(job=>({...job})),error:null};}};
 const imports:Record<string,unknown>={'server-only':{},'@/utils/supabase/admin':{createAdminClient:()=>admin},'./business-hours':{parseBusinessHoursBundle},'./outside-hours-policy':policy,'./booking-site-origin':{resolveAppSiteOrigin:()=>({origin:'https://app.example.com'})},'./booking-confirmation-sms':{sendTwilioBookingSms:async(to:string,body:string)=>{sent.push({to,body});if(response instanceof Error)throw response;return response;}}};
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./owner-call-sms-alerts.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:(name:string)=>{if(!imports[name])throw new Error(name);return imports[name];},Date,Error});
 const methods=mod.exports as {queueOwnerCallAlert:(admin:any,id:string,options?:{deliver?:boolean})=>Promise<void>;processOwnerCallAlerts:(options:{admin:any})=>Promise<void>};
 return {calls,orgs,jobs,sent,queue:()=>methods.queueOwnerCallAlert(admin,'call-1',{deliver:true}),process:()=>methods.processOwnerCallAlerts({admin}),setResult:(result:any)=>{response=result;}};
}
test('urgent calls are flagged even with SMS off',async()=>{const f=fixture({sms:'off'});await f.queue();assert.equal(f.calls[0].is_urgent,true);assert.equal(f.jobs.length,0);assert.equal(f.sent.length,0);});
test('duplicate completion webhooks do not send a second alert',async()=>{const f=fixture();await f.queue();await f.queue();assert.equal(f.sent.length,1);assert.equal(f.jobs[0].status,'sent');assert.equal(f.calls[0].owner_sms_status,'sent');assert.doesNotMatch(f.sent[0].body,/private details|353871234567|burst pipe/);assert.match(f.sent[0].body,/Urgent enquiry.*call-1/);});
test('test and erased calls never queue alerts',async()=>{for(const key of ['is_test_call','engineer_test_call','caller_data_erased_at']){const f=fixture();f.calls[0][key]=key==='caller_data_erased_at'?'2026-10-19':true;await f.queue();assert.equal(f.sent.length,0);assert.equal(f.jobs.length,0);}});
test('delivery rechecks current opt-out rather than using a stale destination',async()=>{const f=fixture();f.jobs.push({call_log_id:'call-1',organization_id:'org-1',status:'pending',attempts:0,next_attempt_at:new Date().toISOString()});f.orgs[0].business_hours._outsideHours.sms='off';await f.process();assert.equal(f.sent.length,0);assert.equal(f.jobs[0].status,'skipped');});
test('explicit transient rejections retry, but successful sends stop retries',async()=>{const f=fixture({result:{ok:false,retryable:true}});await f.queue();assert.equal(f.jobs[0].status,'failed');assert.ok(f.jobs[0].next_attempt_at);await f.process();assert.equal(f.sent.length,1);f.jobs[0].next_attempt_at='2000-01-01';f.setResult({ok:true});await f.process();assert.equal(f.sent.length,2);assert.equal(f.jobs[0].status,'sent');});
test('ambiguous provider results and thrown sends never resend automatically',async()=>{for(const result of [{ok:false,uncertain:true},new Error('Socket closed')]){const f=fixture({result});await f.queue();await f.process();assert.equal(f.sent.length,1);assert.equal(f.jobs[0].status,'unknown');assert.equal(f.jobs[0].next_attempt_at,null);}});
test('expired in-flight jobs become uncertain rather than duplicated',async()=>{const f=fixture();f.jobs.push({call_log_id:'call-1',organization_id:'org-1',status:'sending',attempts:1,lease_expires_at:'2000-01-01'});await f.process();assert.equal(f.jobs[0].status,'unknown');assert.equal(f.sent.length,0);});
test('routine calls are not texted by an urgent-only policy',async()=>{const f=fixture();Object.assign(f.calls[0],{outcome:'answered',ai_summary:'Asked about hours',transcript:'Caller: When do you open?'});await f.queue();assert.equal(f.calls[0].is_urgent,false);assert.equal(f.sent.length,0);});
test('wrong-tenant queue rows cannot send another organization’s call',async()=>{const f=fixture();f.jobs.push({call_log_id:'call-1',organization_id:'foreign',status:'pending',attempts:0,next_attempt_at:new Date().toISOString()});await f.process();assert.equal(f.sent.length,0);assert.equal(f.jobs[0].status,'skipped');});
test('transient failures stop after three delivery attempts',async()=>{const f=fixture({result:{ok:false,retryable:true}});await f.queue();for(let n=0;n<5;n++){f.jobs[0].next_attempt_at='2000-01-01';await f.process();}assert.equal(f.sent.length,3);assert.equal(f.jobs[0].attempts,3);});
