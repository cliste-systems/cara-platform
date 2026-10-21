begin;
do $$
declare org uuid; cid uuid:=gen_random_uuid(); tid uuid:=gen_random_uuid(); before_net numeric; after_net numeric; sig text; snapshot jsonb;
begin
 select id into org from organizations where name !~* '^\[smoke test\]' and slug !~* '^(smoke-test-|rt-test-)' order by created_at limit 1;
 if org is null then raise exception 'No organisation available for rollback-only checks'; end if;
 insert into support_tickets(id,organization_id,subject,body,status,created_at) values(tid,org,'[smoke test] persistent attention','Rollback-only regression fixture','open',now()-interval '3 days');
 snapshot:=admin_attention_queue('support',0,50);
 if not exists(select 1 from jsonb_array_elements(snapshot->'issues') x where x->>'id'='support-'||tid::text) then raise exception 'Older open ticket missing'; end if;
 update support_tickets set status='closed' where id=tid;
 if exists(select 1 from jsonb_array_elements(admin_attention_queue('support',0,50)->'issues') x where x->>'id'='support-'||tid::text) then raise exception 'Closed ticket remains'; end if;
 insert into call_logs(id,organization_id,caller_number,caller_name,created_at,duration_seconds,outcome,engineer_test_call,is_test_call,verification_call,post_call_status,room_name)
 values(cid,org,'+1-555-SMOKE-TEST','[smoke test] retained attention',now()-interval '2 days',60,'other',false,false,false,'failed','RT-TEST-attention-'||cid::text);
 snapshot:=admin_attention_queue('calls',0,50);
 if not exists(select 1 from jsonb_array_elements(snapshot->'issues') x where x->>'callId'=cid::text) then raise exception 'Older call issue missing'; end if;
 select signature into sig from admin_overview_call_health() h where h.call_id=cid;
 if not admin_review_overview_issue(cid,sig,null) then raise exception 'Review rejected'; end if;
 if exists(select 1 from jsonb_array_elements(admin_attention_queue('calls',0,50)->'issues') x where x->>'callId'=cid::text) then raise exception 'Reviewed issue remains'; end if;
 update call_logs set post_call_status='partial' where id=cid;
 if not exists(select 1 from jsonb_array_elements(admin_attention_queue('calls',0,50)->'issues') x where x->>'callId'=cid::text) then raise exception 'Changed issue did not resurface'; end if;
 update call_logs set engineer_test_call=true where id=cid;
 if exists(select 1 from jsonb_array_elements(admin_attention_queue('calls',0,50)->'issues') x where x->>'callId'=cid::text) then raise exception 'Test call not excluded'; end if;
 select coalesce((x->>'net')::numeric,0) into before_net from jsonb_array_elements(admin_billing_totals(false)) x where x->>'currency'='eur';
 insert into billing_payments(stripe_payment_intent_id,livemode,status,currency,amount,amount_received,refunded_amount,metadata)
 select 'pi_smoke_test_'||gen_random_uuid()::text,false,'succeeded','eur',100,100,20,'{"fixture":"RT-TEST-admin-billing"}'::jsonb from generate_series(1,60);
 select (x->>'net')::numeric into after_net from jsonb_array_elements(admin_billing_totals(false)) x where x->>'currency'='eur';
 if after_net-coalesce(before_net,0)<>4800 then raise exception 'Full-ledger totals truncated or refunds incorrect'; end if;
 if has_function_privilege('anon','public.admin_attention_queue(text,integer,integer)','execute') or has_function_privilege('authenticated','public.admin_billing_totals(boolean)','execute') then raise exception 'Reporting function exposed'; end if;
end $$;
rollback;
select 'PASS: old support persists, closed support disappears, retained calls persist, reviews hide unchanged issues, changed issues resurface, tests excluded, 60-payment totals include refunds, server-only access; all fixtures rolled back' result;