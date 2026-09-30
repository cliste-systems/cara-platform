-- Fully qualified relation references preserve safe invoker access while
-- allowing PostgreSQL to inline and optimize the constant banner query.
create or replace function public.current_retail_campaign_consensus(p_retail_banner text)
returns table(sku text,campaign_names text[],campaigns jsonb,source_observed_at timestamptz)
language sql stable parallel safe security invoker as $$
  with verified as (
    select cm.sku,cm.campaign_key,cm.campaign_name,min(cm.source_url) source_url,
      count(distinct cm.source_store_id)::integer source_store_count,min(cm.observed_at) observed_at
    from public.retail_campaign_memberships cm
    join public.retail_catalog_sync_runs r on r.sync_batch_id=cm.sync_batch_id
      and r.source_store_id=cm.source_store_id and r.retail_banner=cm.retail_banner
      and r.status='completed' and r.completed_at<=now()
    where cm.retail_banner=p_retail_banner
      -- Public CMS can switch to next Thursday's WK listings before prices do.
      -- Apply the retailer's Thursday week, not the Monday ISO changeover.
      and (cm.campaign_name !~* '\mwk\s*[0-9]{1,2}\M'
        or substring(cm.campaign_name from '(?i)\mwk\s*([0-9]{1,2})\M')::integer
          = extract(week from ((now() at time zone 'Europe/Dublin')::date
            - ((extract(isodow from now() at time zone 'Europe/Dublin')::integer+3)%7)))::integer)
      and cm.observed_at>=now()-interval '48 hours' and cm.observed_at<=now()
      and cm.observed_at>=r.started_at and cm.observed_at<=r.completed_at
      -- Completed sync runs are the durable proof that every queue job succeeded.
      -- Queue rows are reused by new runs, so joining them would prematurely hide
      -- the previous completed membership while the next batch is still building.
    group by cm.sku,cm.campaign_key,cm.campaign_name
    having count(distinct cm.source_store_id)>=3
  )
  select v.sku,array_agg(distinct v.campaign_name order by v.campaign_name),
    jsonb_agg(jsonb_build_object('key',v.campaign_key,'name',v.campaign_name,'source_url',v.source_url,
      'source_store_count',v.source_store_count,'source_observed_at',v.observed_at) order by v.campaign_key,v.campaign_name,v.source_url),
    min(v.observed_at)
  from verified v group by v.sku;
$$;
revoke all on function public.current_retail_campaign_consensus(text) from public,anon,authenticated;
grant execute on function public.current_retail_campaign_consensus(text) to service_role;


notify pgrst, 'reload schema';
