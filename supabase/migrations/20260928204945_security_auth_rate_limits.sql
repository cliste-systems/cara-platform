-- Atomic login counters; a lock remains effective even after its counting window expires.
create table if not exists public.auth_rate_limit_counters (
  scope text not null,
  fingerprint text not null,
  failure_count integer not null default 0,
  last_failure_at timestamptz not null default now(),
  locked_until timestamptz,
  primary key (scope, fingerprint)
);
alter table public.auth_rate_limit_counters enable row level security;
revoke all on public.auth_rate_limit_counters from public, anon, authenticated;
grant select, insert, update, delete on public.auth_rate_limit_counters to service_role;

create or replace function public.auth_rate_limit_get_status(
  p_scope text, p_fingerprint text, p_window_seconds integer,
  p_max_failures integer, p_lock_seconds integer, p_captcha_after integer
) returns table(failure_count integer, locked_until timestamptz, retry_after_seconds integer, requires_captcha boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.auth_rate_limit_counters%rowtype;
  v_count integer := 0;
  v_locked timestamptz;
  v_retry integer := 0;
begin
  if p_window_seconds < 1 or p_max_failures < 1 or p_lock_seconds < 1 or p_captcha_after < 1 then
    raise exception 'Invalid rate limit configuration';
  end if;
  select c.* into v_row from public.auth_rate_limit_counters c
  where c.scope = p_scope and c.fingerprint = p_fingerprint;
  if found then
    if v_row.locked_until > v_now then
      v_count := v_row.failure_count;
      v_locked := v_row.locked_until;
      v_retry := greatest(1, ceil(extract(epoch from (v_locked - v_now)))::integer);
    elsif v_row.locked_until is null and v_row.last_failure_at >= v_now - make_interval(secs => p_window_seconds) then
      v_count := v_row.failure_count;
    end if;
  end if;
  return query select v_count, v_locked, v_retry, v_count >= p_captcha_after;
end;
$$;

create or replace function public.auth_rate_limit_record_failure(
  p_scope text, p_fingerprint text, p_window_seconds integer,
  p_max_failures integer, p_lock_seconds integer, p_captcha_after integer
) returns table(failure_count integer, locked_until timestamptz, retry_after_seconds integer, requires_captcha boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_now timestamptz;
  v_row public.auth_rate_limit_counters%rowtype;
  v_count integer;
  v_locked timestamptz;
begin
  if p_window_seconds < 1 or p_max_failures < 1 or p_lock_seconds < 1 or p_captcha_after < 1 then
    raise exception 'Invalid rate limit configuration';
  end if;
  insert into public.auth_rate_limit_counters(scope, fingerprint)
  values (p_scope, p_fingerprint) on conflict do nothing;
  select c.* into v_row from public.auth_rate_limit_counters c
  where c.scope = p_scope and c.fingerprint = p_fingerprint for update;
  v_now := clock_timestamp();
  -- Requests already in flight cannot shorten or continually extend a live lock.
  if v_row.locked_until is null or v_row.locked_until <= v_now then
    if v_row.locked_until is not null or v_row.last_failure_at < v_now - make_interval(secs => p_window_seconds) then
      v_count := 1;
    else
      v_count := least(v_row.failure_count, p_max_failures) + 1;
    end if;
    if v_count >= p_max_failures then
      v_locked := v_now + make_interval(secs => p_lock_seconds);
    end if;
    update public.auth_rate_limit_counters c
    set failure_count = v_count, last_failure_at = v_now, locked_until = v_locked
    where c.scope = p_scope and c.fingerprint = p_fingerprint;
  end if;
  return query select * from public.auth_rate_limit_get_status(
    p_scope, p_fingerprint, p_window_seconds, p_max_failures, p_lock_seconds, p_captcha_after
  );
end;
$$;

create or replace function public.auth_rate_limit_clear(p_scope text, p_fingerprint text)
returns void language sql security invoker set search_path = '' as $$
  delete from public.auth_rate_limit_counters where scope = p_scope and fingerprint = p_fingerprint;
$$;

revoke all on function public.auth_rate_limit_get_status(text,text,integer,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.auth_rate_limit_record_failure(text,text,integer,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.auth_rate_limit_clear(text,text) from public, anon, authenticated;
grant execute on function public.auth_rate_limit_get_status(text,text,integer,integer,integer,integer) to service_role;
grant execute on function public.auth_rate_limit_record_failure(text,text,integer,integer,integer,integer) to service_role;
grant execute on function public.auth_rate_limit_clear(text,text) to service_role;
