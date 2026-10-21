import '../../scripts/mock-server-only.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {archiveServiceConfiguration,previousServiceConfiguration} from './service-configuration-history';
import type {SupabaseClient} from '@supabase/supabase-js';
function fixture(rows:unknown[]=[],error:unknown=null){
 const writes:Record<string,unknown>[]=[],filters:unknown[][]=[];
 const client={from:(table:string)=>{assert.equal(table,'cara_knowledge_events');return {insert:async(value:Record<string,unknown>)=>{writes.push(value);return {error};},select(){return this;},eq(...args:unknown[]){filters.push(args);return this;},order(){return this;},limit:async()=>({data:rows,error})};}} as unknown as SupabaseClient;
 return {client,writes,filters};
}
test('service backups preserve the previous version and use the owner-session tenant',async()=>{
 const f=fixture();const old={services:'Rewiring',notOffered:'Solar repairs'};
 assert.equal(await archiveServiceConfiguration(f.client,'session-org','session-owner',old,{services:'Lighting',notOffered:''}),true);
 assert.equal(f.writes[0].organization_id,'session-org');assert.equal(f.writes[0].actor_id,'session-owner');
 assert.deepEqual(f.writes[0].payload,{version:1,...old});
});
test('empty and unchanged configurations are not backed up; backup failures are reported',async()=>{
 const f=fixture();await archiveServiceConfiguration(f.client,'org','owner',{services:'',notOffered:''},{services:'Lighting',notOffered:''});
 await archiveServiceConfiguration(f.client,'org','owner',{services:'Lighting',notOffered:''},{services:'Lighting',notOffered:''});assert.equal(f.writes.length,0);
 const failed=fixture([],new Error('offline'));assert.equal(await archiveServiceConfiguration(failed.client,'org','owner',{services:'Lighting',notOffered:''},{services:'Rewiring',notOffered:''}),false);
});
test('recovery loads a different valid snapshot from the same tenant and backup source',async()=>{
 const f=fixture([{payload:{version:99,services:'Invalid',notOffered:''}},{payload:{version:1,services:'Lighting',notOffered:''}},{payload:{version:1,services:'Rewiring',notOffered:'Solar repairs'}}]);
 assert.deepEqual(await previousServiceConfiguration(f.client,'session-org',{services:'Lighting',notOffered:''}),{services:'Rewiring',notOffered:'Solar repairs'});
 assert.ok(f.filters.some(v=>v[0]==='organization_id'&&v[1]==='session-org'));
 assert.ok(f.filters.some(v=>v[0]==='source'&&v[1]==='service_configuration_backup'));
});
