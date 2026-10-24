begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); company text; failed boolean;
begin
 company:='[smoke test] reservation '||a;
 insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(u,u||'@example.invalid','{"cliste_signup_flow":"simple_v1"}','{}',now(),now());
 insert into public.accounts(id,name,slug,status,created_at) values(a,company,'reservation-'||a,'onboarding',now()-interval '25 hours');
 insert into public.organizations(id,account_id,name,slug,status,is_active,tier) values(o,a,company,'reservation-'||o,'onboarding',false,'native');
 insert into public.profiles(id,account_id,organization_id,role) values(u,a,o,'owner') on conflict(id) do update set account_id=a,organization_id=o,role='owner';
 if public.company_name_exists(company) then raise exception 'Unverified abandoned name not released'; end if;
 if not exists(select 1 from public.accounts where id=a and name=company and company_name_key is null) then raise exception 'Record not retained or key not released'; end if;
 insert into public.accounts(id,name,slug,status) values(b,company,'reservation-'||b,'onboarding');
 failed:=false;
 begin update public.accounts set status='active' where id=a; exception when unique_violation then failed:=true; end;
 if not failed then raise exception 'Expired account reclaimed another company name'; end if;
 if not public.company_name_exists(company) then raise exception 'New reservation not protected'; end if;
end $$;
rollback;
