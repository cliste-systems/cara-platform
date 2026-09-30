-- One read snapshot; public aggregate data only, restricted to the service role.
create or replace function public.supervalu_public_department_audit()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
with products as (
  select case when category_breadcrumb ilike 'Grocery/%' then split_part(category_breadcrumb,'/',2) else 'Unclassified' end department,
    count(*) observed_products,count(*) filter(where is_national) cross_store_products,
    count(*) filter(where is_national and fulfilment='counter') counter_products
  from public.retail_catalog_products where retail_banner='supervalu' group by 1
), offers as (
  select case when category_breadcrumb ilike 'Grocery/%' then split_part(category_breadcrumb,'/',2) else 'Unclassified' end department,
    count(*) current_offer_rows,count(distinct sku) current_offer_products,
    count(*) filter(where synced_at>=now()-interval '48 hours') fresh_offer_rows,
    count(*) filter(where discount_label ~* '\m[0-9]+\s+for\M|mix.*match|buy.*get') multibuy_rows,
    count(*) filter(where discount_label ~* 'rewards') rewards_offer_rows,
    count(*) filter(where discount_label ~* '[0-9]+%|half\s+price') percentage_or_half_price_rows
  from public.retail_weekly_offers where retail_banner='supervalu' and is_national
    and offer_week_start<=(now() at time zone 'Europe/Dublin')::date
    and offer_week_end>=(now() at time zone 'Europe/Dublin')::date group by 1
), departments as (
  select p.*,coalesce(o.current_offer_rows,0) current_offer_rows,coalesce(o.current_offer_products,0) current_offer_products,
    coalesce(o.fresh_offer_rows,0) fresh_offer_rows,coalesce(o.multibuy_rows,0) multibuy_rows,
    coalesce(o.rewards_offer_rows,0) rewards_offer_rows,coalesce(o.percentage_or_half_price_rows,0) percentage_or_half_price_rows
  from products p left join offers o using(department)
), sources as (
  select r.source_store_id,max(completed_at) filter(where status='completed' and metadata->>'refresh_kind'='full') last_full_completed_at,
    max(completed_at) filter(where status='completed') last_completed_at,
    count(*) filter(where status='running') running_runs
  from public.retail_catalog_sync_runs r where retail_banner='supervalu' group by 1
)
select jsonb_build_object('checked_at',now(),'departments',(select jsonb_agg(to_jsonb(d) order by department) from departments d),
  'observed_products',(select sum(observed_products) from products),'cross_store_products',(select sum(cross_store_products) from products),
  'current_offer_rows',(select sum(current_offer_rows) from offers),'current_offer_products',(select sum(current_offer_products) from offers),
  'fresh_offer_rows',(select sum(fresh_offer_rows) from offers),
  'scheduler_enabled',(select enabled from public.retail_catalog_refresh_config where retail_banner='supervalu'),
  'sources',(select jsonb_agg(to_jsonb(s) order by source_store_id) from sources s),
  'failed_categories',(select coalesce(jsonb_agg(jsonb_build_object('store',source_store_id,'category',category_name,'error',last_error)),'[]'::jsonb) from public.retail_catalog_category_queue where status='failed'),
  'authoritative_national_range_complete',false,'every_offer_type_verified',false);
$$;
revoke all on function public.supervalu_public_department_audit() from public,anon,authenticated;
grant execute on function public.supervalu_public_department_audit() to service_role;
