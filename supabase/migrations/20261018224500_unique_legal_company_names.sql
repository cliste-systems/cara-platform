-- Legal company names belong to billing accounts, separately from trading/location names.
create or replace function public.company_name_key(p_name text)
returns text language sql immutable strict set search_path=public as $$
 select btrim(regexp_replace(regexp_replace(regexp_replace(replace(lower(btrim(p_name)),'&',' and '),'[''’]','','g'),'\m(limited|ltd)\M','ltd','g'),'[^[:alnum:]]+',' ','g'));
$$;
alter table public.accounts add column if not exists company_name_key text;
-- Preserve ambiguous legacy duplicates; do not merge customer/billing records.
with candidates as (
 select id,public.company_name_key(name) key,count(*) over(partition by public.company_name_key(name)) copies from public.accounts
) update public.accounts a set company_name_key=c.key from candidates c where a.id=c.id and c.copies=1 and c.key<>'';
create unique index if not exists accounts_company_name_key_unique on public.accounts(company_name_key);
create or replace function public.enforce_account_company_name()
returns trigger language plpgsql security definer set search_path=public as $$
declare key text;
begin
 key:=public.company_name_key(new.name);
 if key is null or key='' then raise exception using errcode='23514',message='Enter the legal company name.'; end if;
 if tg_op='UPDATE' then
   if new.name is not distinct from old.name then
     new.company_name_key:=old.company_name_key;
     return new;
   end if;
 end if;
 if exists(select 1 from public.accounts a where a.id is distinct from new.id and public.company_name_key(a.name)=key) then
   raise exception using errcode='23505',message='An organisation with this legal company name already exists.',constraint='accounts_company_name_key_unique';
 end if;
 new.company_name_key:=key;
 return new;
end $$;
drop trigger if exists enforce_account_company_name on public.accounts;
create trigger enforce_account_company_name before insert or update of name,company_name_key on public.accounts
for each row execute function public.enforce_account_company_name();

revoke all on function public.enforce_account_company_name() from public,anon,authenticated;
create or replace function public.company_name_exists(p_name text) returns boolean language sql stable security invoker set search_path=public as $$
 select exists(select 1 from accounts a where public.company_name_key(a.name)=public.company_name_key(p_name));
$$;
revoke all on function public.company_name_exists(text) from public,anon,authenticated;
grant execute on function public.company_name_exists(text) to service_role;
