create or replace function public.publish_service_catalog(
 p_organization_id uuid, p_expected_updated_at timestamptz, p_services jsonb,
 p_excluded text, p_quote_prices boolean, p_prompt text, p_warnings jsonb
) returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare current_version timestamptz; item jsonb; saved_at timestamptz := clock_timestamp(); boundary text;
begin
 -- Separate branches avoid planning private helper access for the service role.
 if coalesce(auth.role(), '') <> 'service_role' then
   if not private.current_user_is_account_owner() then
     raise exception 'Owner access required' using errcode='42501';
   end if;
 end if;
 select updated_at into current_version from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'Business not found' using errcode='42501'; end if;
 if current_version is distinct from p_expected_updated_at then
   raise exception 'Business details changed. Reload before saving.' using errcode='40001';
 end if;
 if p_services is null or jsonb_typeof(p_services) <> 'array' or jsonb_array_length(p_services)>120 or coalesce(length(p_prompt),0)<10 then
   raise exception 'Invalid service catalogue';
 end if;
 for item in select value from jsonb_array_elements(p_services) loop
   if exists(select 1 from public.services where id=(item->>'id')::uuid and organization_id<>p_organization_id) then
     raise exception 'Service does not belong to this business' using errcode='42501';
   end if;
   insert into public.services(id,organization_id,name,category,price,duration_minutes,description,ai_voice_notes,policy_flags,source,details,updated_at)
   values((item->>'id')::uuid,p_organization_id,item->>'name',nullif(item->>'category',''),
     (item->>'price')::numeric,(item->>'durationMinutes')::integer,nullif(item->>'description',''),
     nullif(item->>'aiVoiceNotes',''),coalesce(item->'policyFlags','[]'::jsonb),
     (item->>'source')::public.service_catalog_source,coalesce(item->'details','{}'::jsonb),saved_at)
   on conflict(id) do update set name=excluded.name,category=excluded.category,price=excluded.price,
     duration_minutes=excluded.duration_minutes,description=excluded.description,ai_voice_notes=excluded.ai_voice_notes,
     policy_flags=excluded.policy_flags,details=excluded.details,updated_at=saved_at
   where public.services.organization_id=p_organization_id;
 end loop;
 select string_agg(value->>'name', E'\n' order by value->>'name') into boundary
 from jsonb_array_elements(p_services) where coalesce(value->'details'->>'status','available')<>'archived';
 update public.organizations set agent_services_departments=nullif(boundary,''),
   agent_services_not_offered=nullif(p_excluded,''),quote_prices_on_calls=p_quote_prices,
   custom_prompt=p_prompt,prompt_compile_warnings=p_warnings,updated_at=saved_at
 where id=p_organization_id;
 return saved_at;
end $$;
revoke all on function public.publish_service_catalog(uuid,timestamptz,jsonb,text,boolean,text,jsonb) from public,anon;
grant execute on function public.publish_service_catalog(uuid,timestamptz,jsonb,text,boolean,text,jsonb) to authenticated,service_role;

-- Keep future setup edits and approved service training in the same catalogue.
create or replace function public.sync_approved_service_names() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if coalesce(new.niche,'other') = 'retail' then return new; end if;
 -- A catalogue publication already contains structured, complete service rows.
 -- Avoid splitting punctuation in names or rewriting their availability.
 if new.agent_services_departments is not distinct from (
   select string_agg(s.name, E'\n' order by s.name) from public.services s
   where s.organization_id=new.id and coalesce(s.details->>'status','available')<>'archived'
 ) then return new; end if;
 insert into public.services(organization_id,name,price,duration_minutes,source,details)
 select distinct new.id,left(trim(regexp_replace(v,'^[\s•–—-]+','')),120),0,0,'manual'::public.service_catalog_source,
 '{"priceMode":"unset","durationMode":"unset","status":"available"}'::jsonb
 from regexp_split_to_table(coalesce(new.agent_services_departments,''), E'[\n,;]+') v
 where trim(regexp_replace(v,'^[\s•–—-]+',''))<>''
 and not exists(select 1 from public.services s where s.organization_id=new.id
 and lower(s.name)=lower(left(trim(regexp_replace(v,'^[\s•–—-]+','')),120)));
 update public.services s set details=jsonb_set(s.details,'{status}',
 case when exists(select 1 from regexp_split_to_table(coalesce(new.agent_services_departments,''), E'[\n,;]+') v
 where lower(s.name)=lower(left(trim(regexp_replace(v,'^[\s•–—-]+','')),120)))
 then to_jsonb(case when coalesce(s.details->>'status','available')='archived' then 'available' else coalesce(s.details->>'status','available') end)
 else '"archived"'::jsonb end),updated_at=clock_timestamp()
 where s.organization_id=new.id;
 return new;
end $$;
revoke all on function public.sync_approved_service_names() from public,anon;
