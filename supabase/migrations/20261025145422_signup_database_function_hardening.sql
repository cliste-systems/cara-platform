-- All four functions use only built-ins; an empty search path is safe.
alter function public.tg_touch_updated_at() set search_path='';
alter function public.organizations_sync_app_fee_bps() set search_path='';
alter function public.organizations_sync_cara_online_since() set search_path='';
alter function public.repair_corrupted_routing_links(jsonb) set search_path='';
-- Trigger functions cannot be invoked as RPCs and need no customer grants.
revoke execute on function public.phone_numbers_sync_org_cache(),public.profiles_sync_active_organization(),public.rls_auto_enable(),public.store_phone_systems_protect_verification(),public.tg_appointments_update_client_counts() from public,anon,authenticated;
grant execute on function public.phone_numbers_sync_org_cache(),public.profiles_sync_active_organization(),public.rls_auto_enable(),public.store_phone_systems_protect_verification(),public.tg_appointments_update_client_counts() to service_role;
-- RLS helpers remain callable by signed-in users; no anonymous caller needs them.
revoke execute on function public.current_user_account_id(),public.current_user_organization_id(),public.user_can_access_organization(uuid) from public,anon;
grant execute on function public.current_user_account_id(),public.current_user_organization_id(),public.user_can_access_organization(uuid) to authenticated,service_role;
