-- Release only abandoned, unverified self-serve reservations; retain customer records.
create table public.expired_signup_name_reservations (
 account_id uuid primary key references public.accounts(id) on delete cascade,
 released_at timestamptz not null default now()
);
alter table public.expired_signup_name_reservations enable row level security;
revoke all on public.expired_signup_name_reservations from public,anon,authenticated;
grant all on public.expired_signup_name_reservations to service_role;

create or replace function public.enforce_account_company_name()
returns trigger language plpgsql security definer set search_path='' as $$
declare key text; released boolean;
begin
 key:=public.company_name_key(new.name);
 if key is null or key='' then raise exception 'Enter the legal company name.'; end if;
 select exists(select 1 from public.expired_signup_name_reservations where account_id=new.id) into released;
 if released and new.status='onboarding' and tg_op='UPDATE' and new.name is not distinct from old.name then
   new.company_name_key:=null; return new;
 end if;
 if tg_op='UPDATE' and not released and new.name is not distinct from old.name then
   new.company_name_key:=old.company_name_key; return new;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(key,0));
 if exists(select 1 from public.accounts a where a.id is distinct from new.id and public.company_name_key(a.name)=key
   and not exists(select 1 from public.expired_signup_name_reservations r where r.account_id=a.id)) then
   raise exception using errcode='23505',message='An organisation with this legal company name already exists.',constraint='accounts_company_name_key_unique';
 end if;
 delete from public.expired_signup_name_reservations where account_id=new.id;
 new.company_name_key:=key;
 return new;
end $$;
drop trigger enforce_account_company_name on public.accounts;
create trigger enforce_account_company_name before insert or update of name,company_name_key,status on public.accounts
for each row execute function public.enforce_account_company_name();

create or replace function public.company_name_exists(p_name text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare candidate uuid; key text:=public.company_name_key(p_name);
begin
 for candidate in
   select a.id from public.accounts a
   where public.company_name_key(a.name)=key and a.status='onboarding'
     and a.created_at < now()-interval '24 hours' and a.platform_subscription_id is null
     and not exists(select 1 from public.signup_billing_eligibility e where e.account_id=a.id)
     and exists(select 1 from public.profiles p join auth.users u on u.id=p.id
       where p.account_id=a.id and p.role='owner' and u.email_confirmed_at is null
         and u.raw_app_meta_data->>'cliste_signup_flow'='simple_v1')
     and not exists(select 1 from public.profiles p join auth.users u on u.id=p.id
       where p.account_id=a.id and (u.email_confirmed_at is not null or u.raw_app_meta_data->>'cliste_signup_flow' is distinct from 'simple_v1'))
   for update of a
 loop
   insert into public.expired_signup_name_reservations(account_id) values(candidate) on conflict do nothing;
   update public.accounts set company_name_key=null where id=candidate;
 end loop;
 return exists(select 1 from public.accounts a where public.company_name_key(a.name)=key
   and not exists(select 1 from public.expired_signup_name_reservations r where r.account_id=a.id));
end $$;
revoke all on function public.company_name_exists(text) from public,anon,authenticated;
grant execute on function public.company_name_exists(text) to service_role;
