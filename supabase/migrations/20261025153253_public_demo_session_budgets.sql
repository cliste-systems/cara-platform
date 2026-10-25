-- Backend-only, bounded public-demo reservations. No customer-call admission uses these functions.
create table private.public_demo_daily_budgets (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  budget_day date not null,
  starts integer not null default 0 check (starts >= 0),
  reserved_seconds integer not null default 0 check (reserved_seconds >= 0),
  primary key (organization_id, budget_day)
);
create table private.public_demo_sessions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_key text not null check (session_key ~ '^[a-f0-9]{64}$'),
  budget_day date not null,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  ended_at timestamptz,
  primary key (organization_id, session_key)
);
create index public_demo_active_sessions on private.public_demo_sessions(organization_id, expires_at) where ended_at is null;
alter table private.public_demo_daily_budgets enable row level security;
alter table private.public_demo_sessions enable row level security;
revoke all on private.public_demo_daily_budgets, private.public_demo_sessions from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.public_demo_daily_budgets, private.public_demo_sessions to service_role;

create function public.reserve_public_demo_session(p_organization_id uuid, p_session_key text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  stamp timestamptz;
  day_key date;
  lease private.public_demo_sessions%rowtype;
  budget private.public_demo_daily_budgets%rowtype;
  active_count integer;
  earliest_end timestamptz;
begin
  if p_organization_id is null or p_session_key is null or p_session_key !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid demo reservation';
  end if;
  -- This lock spans day boundaries and all workers for this one organisation.
  perform pg_advisory_xact_lock(hashtextextended('public_demo:' || p_organization_id::text, 0));
  stamp := clock_timestamp();
  day_key := (stamp at time zone 'UTC')::date;
  -- Crashed sessions consume their full reserved duration, but never hold concurrency forever.
  update private.public_demo_sessions set ended_at = expires_at
    where organization_id = p_organization_id and ended_at is null and expires_at <= stamp;
  select * into lease from private.public_demo_sessions
    where organization_id = p_organization_id and session_key = p_session_key;
  if found then
    if lease.ended_at is null and lease.expires_at > stamp then
      return jsonb_build_object('allowed', true, 'reason', 'allowed', 'expires_at', lease.expires_at, 'retry_after_seconds', 0);
    end if;
    return jsonb_build_object('allowed', false, 'reason', 'ended', 'retry_after_seconds', 1);
  end if;
  select count(*), min(expires_at) into active_count, earliest_end from private.public_demo_sessions
    where organization_id = p_organization_id and ended_at is null and expires_at > stamp;
  if active_count >= 3 then
    return jsonb_build_object('allowed', false, 'reason', 'busy', 'retry_after_seconds', greatest(1,ceil(extract(epoch from earliest_end - stamp))::integer));
  end if;
  insert into private.public_demo_daily_budgets(organization_id,budget_day)
    values (p_organization_id,day_key) on conflict do nothing;
  select * into budget from private.public_demo_daily_budgets
    where organization_id = p_organization_id and budget_day = day_key for update;
  if budget.starts >= 60 or budget.reserved_seconds + 480 > 7200 then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'retry_after_seconds', greatest(1,ceil(extract(epoch from ((day_key + 1)::timestamp at time zone 'UTC') - stamp))::integer));
  end if;
  insert into private.public_demo_sessions(organization_id,session_key,budget_day,started_at,expires_at)
    values (p_organization_id,p_session_key,day_key,stamp,stamp + interval '8 minutes') returning * into lease;
  update private.public_demo_daily_budgets set starts = starts + 1, reserved_seconds = reserved_seconds + 480
    where organization_id = p_organization_id and budget_day = day_key;
  -- Bound metadata retained by this feature; no caller number or speech is stored.
  delete from private.public_demo_sessions where organization_id = p_organization_id and ended_at < stamp - interval '7 days';
  delete from private.public_demo_daily_budgets where organization_id = p_organization_id and budget_day < day_key - 7;
  return jsonb_build_object('allowed', true, 'reason', 'allowed', 'expires_at', lease.expires_at, 'retry_after_seconds', 0);
end $$;

create function public.release_public_demo_session(p_organization_id uuid, p_session_key text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  stamp timestamptz;
  lease private.public_demo_sessions%rowtype;
  used_seconds integer;
begin
  if p_organization_id is null or p_session_key is null or p_session_key !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid demo reservation';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('public_demo:' || p_organization_id::text, 0));
  stamp := clock_timestamp();
  select * into lease from private.public_demo_sessions
    where organization_id = p_organization_id and session_key = p_session_key for update;
  if not found or lease.ended_at is not null then return; end if;
  used_seconds := least(480,greatest(0,ceil(extract(epoch from stamp - lease.started_at))::integer));
  update private.public_demo_sessions set ended_at = stamp
    where organization_id = p_organization_id and session_key = p_session_key;
  -- Refund unused reserved seconds to the original day, even when release crosses midnight.
  update private.public_demo_daily_budgets set reserved_seconds = greatest(0,reserved_seconds - (480 - used_seconds))
    where organization_id = p_organization_id and budget_day = lease.budget_day;
end $$;
revoke all on function public.reserve_public_demo_session(uuid,text) from public, anon, authenticated;
revoke all on function public.release_public_demo_session(uuid,text) from public, anon, authenticated;
grant execute on function public.reserve_public_demo_session(uuid,text) to service_role;
grant execute on function public.release_public_demo_session(uuid,text) to service_role;
notify pgrst, 'reload schema';
