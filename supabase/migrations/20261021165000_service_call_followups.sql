-- Follow-up completion belongs to the live call, independent of Cara's analysis.
-- The retired action_tickets table and retail workflows are retained.
alter table public.call_logs add column if not exists follow_up_completed_at timestamptz;
alter table public.call_logs add column if not exists follow_up_completed_by uuid references auth.users(id) on delete set null;
create index if not exists call_logs_followups_by_org on public.call_logs (organization_id, created_at desc)
where not is_test_call and not engineer_test_call and caller_data_erased_at is null
and (call_resolution='needs_follow_up' or outcome in ('action_created','callback_requested') or is_urgent or post_call_expected_ticket);

create or replace function public.set_call_follow_up(p_organization_id uuid,p_call_id uuid,p_completed boolean)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(auth.role(),'') <> 'service_role' then
  if not private.current_user_is_account_owner() then
   raise exception 'Owner access required' using errcode='42501';
  end if;
 end if;
 if p_completed is null then raise exception 'Choose a follow-up status'; end if;
 update public.call_logs c set
  follow_up_completed_at=case when p_completed then coalesce(c.follow_up_completed_at,clock_timestamp()) else null end,
  follow_up_completed_by=case when p_completed then coalesce(c.follow_up_completed_by,auth.uid()) else null end
 where c.id=p_call_id and c.organization_id=p_organization_id
 and not c.is_test_call and not c.engineer_test_call and c.caller_data_erased_at is null
 and c.post_call_status <> 'pending'
 and (c.call_resolution='needs_follow_up' or c.outcome in ('action_created','callback_requested') or c.is_urgent or c.post_call_expected_ticket)
 and exists(select 1 from public.organizations o where o.id=p_organization_id and coalesce(o.niche,'other')<>'retail');
 if not found then raise exception 'Follow-up unavailable' using errcode='42501'; end if;
 return true;
end $$;
revoke all on function public.set_call_follow_up(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_call_follow_up(uuid,uuid,boolean) to authenticated,service_role;
