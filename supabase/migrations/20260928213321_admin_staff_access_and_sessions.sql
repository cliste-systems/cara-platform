-- Staff authorisation is checked from live records, never editable user metadata.
create table public.admin_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(trim(email)) and length(email) between 3 and 320),
  display_name text not null default '' check (length(display_name) <= 160),
  role text not null default 'member' check (role in ('owner','member')),
  permissions text[] not null default '{}' check (permissions <@ array['customers','calls','support','inbox','billing']::text[]),
  status text not null default 'invited' check (status in ('invited','active','disabled')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  invitation_sent_at timestamptz,
  invitation_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_staff enable row level security;
revoke all on public.admin_staff from public, anon, authenticated;
grant select,insert,update,delete on public.admin_staff to service_role;

-- Preserve current staff identities while moving access into manageable records.
insert into public.admin_staff (user_id,email,display_name,role,status,accepted_at)
select id,lower(trim(email)),coalesce(raw_user_meta_data->>'full_name',''), 'owner','active',now()
from auth.users
where email is not null and (raw_app_meta_data->>'cliste_admin_console'='true' or lower(email)='brendan@clistesystems.ie')
on conflict do nothing;

comment on table public.admin_staff is 'HelloCara platform staff. Service-role only; server entry points enforce active membership, scoped permissions, MFA and live session validity.';

-- Serialise staff status changes and keep at least one active owner.
create or replace function public.admin_staff_set_status(
  p_actor_user_id uuid, p_target_user_id uuid, p_enabled boolean
) returns text language plpgsql security definer set search_path = '' as $$
declare
  target public.admin_staff%rowtype;
  next_status text;
begin
  perform pg_catalog.pg_advisory_xact_lock(728391650124::bigint);
  if p_enabled is null or p_actor_user_id is null or p_target_user_id is null or p_actor_user_id = p_target_user_id then
    raise exception 'You cannot change your own access' using errcode='42501';
  end if;
  if not exists(select 1 from public.admin_staff where user_id=p_actor_user_id and role='owner' and status='active') then
    raise exception 'An active owner is required' using errcode='42501';
  end if;
  select * into target from public.admin_staff where user_id=p_target_user_id for update;
  if not found then raise exception 'Staff member not found'; end if;
  if not p_enabled and target.role='owner' and target.status='active' and
    (select count(*) from public.admin_staff where role='owner' and status='active') <= 1 then
    raise exception 'Keep at least one active owner' using errcode='42501';
  end if;
  next_status := case when not p_enabled then 'disabled' when target.accepted_at is null then 'invited' else 'active' end;
  update public.admin_staff set status=next_status,updated_at=now() where user_id=p_target_user_id;
  return next_status;
end;
$$;
revoke all on function public.admin_staff_set_status(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_staff_set_status(uuid,uuid,boolean) to service_role;
-- Only the application server can inspect or revoke Auth sessions. No tokens are exposed.
create or replace function public.admin_auth_session_active(p_user_id uuid, p_session_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.sessions s
    join public.admin_staff staff on staff.user_id = s.user_id
    where s.user_id = p_user_id and s.id = p_session_id
      and (s.not_after is null or s.not_after > now())
  );
$$;

create or replace function public.admin_list_auth_sessions(p_user_id uuid)
returns table (id uuid, created_at timestamptz, refreshed_at timestamptz, user_agent text, ip text, aal text, not_after timestamptz)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.created_at, coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at),
    s.user_agent, host(s.ip), s.aal::text, s.not_after
  from auth.sessions s
  join public.admin_staff staff on staff.user_id = s.user_id
  where s.user_id = p_user_id and (s.not_after is null or s.not_after > now())
  order by coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at) desc;
$$;

create or replace function public.admin_revoke_auth_sessions(
  p_user_id uuid,
  p_session_id uuid default null,
  p_except_session_id uuid default null
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare removed_count integer;
begin
  if p_session_id is not null and p_except_session_id is not null then
    raise exception 'Choose one session or all other sessions, not both.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.admin_staff where user_id = p_user_id) then
    raise exception 'Staff member not found.' using errcode = '22023';
  end if;
  -- Supabase sign-out removes sessions. refresh_tokens_session_id_fkey cascades
  -- to remove the matching refresh tokens, preventing the session from returning.
  delete from auth.sessions s where s.user_id = p_user_id
    and (p_session_id is null or s.id = p_session_id)
    and (p_except_session_id is null or s.id <> p_except_session_id);
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

revoke all on function public.admin_auth_session_active(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_list_auth_sessions(uuid) from public, anon, authenticated;
revoke all on function public.admin_revoke_auth_sessions(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_auth_session_active(uuid, uuid) to service_role;
grant execute on function public.admin_list_auth_sessions(uuid) to service_role;
grant execute on function public.admin_revoke_auth_sessions(uuid, uuid, uuid) to service_role;
