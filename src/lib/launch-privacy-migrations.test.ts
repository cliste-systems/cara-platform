import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
test('launch migrations preserve erasure and safely lease notifications', async () => {
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;
create table organizations(id uuid primary key);
create table call_logs(id uuid primary key,organization_id uuid,caller_number text,caller_name text,transcript text,transcript_review text,ai_summary text,audio_storage_path text,caller_data_erased_at timestamptz,caller_data_erased_by uuid,caller_data_erased_by_label text,caller_data_erased_reason text);
create table cara_training_items(id uuid primary key,organization_id uuid references organizations(id),call_log_id uuid references call_logs(id),caller_context text,status text);`);
for(const name of ['20261104000000_protect_erased_call_content.sql','20261104000001_knowledge_delivery_retries.sql'])await db.exec(readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url),'utf8'));
const org='00000000-0000-4000-8000-000000000001',call='00000000-0000-4000-8000-000000000002',item='00000000-0000-4000-8000-000000000003';
await db.query('insert into organizations values($1)',[org]);
await db.query('insert into call_logs(id,organization_id,caller_number,transcript) values($1,$2,$3,$4)',[call,org,'+353871234567','private']);
await db.query(`insert into cara_training_items(id,organization_id,call_log_id,caller_context,status,notify_owner) values($1,$2,$3,'private context','awaiting_answer',true)`,[item,org,call]);
assert.equal((await db.query('select * from knowledge_notifications')).rows.length,2);
assert.equal((await db.query('select * from claim_knowledge_notifications()')).rows.length,2);
assert.equal((await db.query('select * from claim_knowledge_notifications()')).rows.length,0,'concurrent/repeated claim does not redeliver');
await db.exec(`update knowledge_notifications set lease_expires_at=now()-interval '1 minute'`);
await db.query('select * from claim_knowledge_notifications()');
assert.equal((await db.query(`select * from knowledge_notifications where status='unknown'`)).rows.length,2,'uncertain sends do not retry');
await db.query('update call_logs set audio_storage_path=$1 where id=$2',[`${org}/${call}.mp3`,call]);
await db.query(`update call_logs set caller_data_erased_at=now(),caller_data_erased_by_label='Alice',pending_knowledge_gaps='[{"topic":"private"}]' where id=$1`,[call]);
await db.query(`update call_logs set transcript='restored',ai_summary='restored',audio_storage_path='restored',caller_name='restored',caller_number='+353871234567',caller_data_erased_at=null,caller_data_erased_by_label='overwritten',pending_knowledge_gaps='[{"topic":"restored"}]' where id=$1`,[call]);
const row=(await db.query('select * from call_logs')).rows[0];
for(const field of ['transcript','ai_summary','audio_storage_path','caller_name','pending_knowledge_gaps'])assert.equal(row[field],null,field);
assert.equal((await db.query('select * from call_recording_cleanup')).rows.length,1,'removed object reference survives for confirmed cleanup');
assert.ok(row.caller_data_erased_at);assert.equal(row.caller_data_erased_by_label,'Alice');
assert.equal((await db.query('select caller_context from cara_training_items')).rows[0].caller_context,null);
await db.query(`update cara_training_items set caller_context='late private context' where id=$1`,[item]);
assert.equal((await db.query('select caller_context from cara_training_items')).rows[0].caller_context,null,'late knowledge write stays erased');

await db.close();

});
