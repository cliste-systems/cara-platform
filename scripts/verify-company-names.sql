begin;
do $$
declare aid uuid:=gen_random_uuid(); aid2 uuid:=gen_random_uuid(); oid uuid:=gen_random_uuid(); n text:='RT-TEST legal company '||gen_random_uuid()::text||' Limited'; rejected boolean:=false;
begin
 if company_name_key('  O’Toole & Sons LIMITED. ')<>company_name_key('OToole and Sons ltd') then raise exception 'Legal suffix/case/punctuation normalisation failed'; end if;
 insert into accounts(id,name,slug,status) values(aid,n,'rt-test-'||aid::text,'onboarding');
 begin
 insert into accounts(id,name,slug,status) values(aid2,replace(upper(n),'LIMITED','LTD.'),'rt-test-'||aid2::text,'onboarding');
 exception when unique_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Duplicate accepted'; end if;
 insert into accounts(id,name,slug,status) values(aid2,'RT-TEST different '||aid2::text,'rt-test-'||aid2::text,'onboarding');
 rejected:=false;
 begin
 update accounts set name=upper(n) where id=aid2;
 exception when unique_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Duplicate rename accepted'; end if;
 insert into organizations(id,account_id,name,slug,tier,is_active,status,onboarding_step,is_primary_location)
 values(oid,aid,'[smoke test] Separate trading name','rt-test-'||oid::text,'native',false,'onboarding',1,true);
 if not exists(select 1 from accounts a join organizations o on o.account_id=a.id where o.id=oid and a.name=n and o.name='[smoke test] Separate trading name') then raise exception 'Legal/trading names not separately linked'; end if;
 if not company_name_exists(n) then raise exception 'Signup duplicate precheck missed legal name'; end if;
 if has_function_privilege('anon','public.company_name_exists(text)','execute') then raise exception 'Name lookup exposed'; end if;
end $$;
rollback;
select 'PASS: normalised company name duplicates and renames rejected; legal organisation linked to separate trading-name business; duplicate lookup server-only; all fixtures rolled back' result;