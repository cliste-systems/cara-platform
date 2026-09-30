-- Avoid a queue of 27 publishers exhausting the API statement timeout.
create or replace function public.finalize_supervalu_catalog_run(p_sync_batch_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_run public.retail_catalog_sync_runs%rowtype;
  v_kind text; v_queue integer; v_done integer; v_expected integer;
  v_products integer; v_promotions integer; v_previous_full integer; v_reason text;
  v_publication jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('supervalu-national-publication')) then
    return jsonb_build_object('ok',true,'published',false,'deferred',true,'reason','Another source is publishing; the minute scheduler will retry');
  end if;
  select * into strict v_run from public.retail_catalog_sync_runs where sync_batch_id=p_sync_batch_id for update;
  if v_run.retail_banner<>'supervalu' then raise exception 'Not a SuperValu run'; end if;
  perform pg_advisory_xact_lock(hashtext('supervalu-finalize-'||v_run.source_store_id));
  if v_run.status='completed' then
    return jsonb_build_object('ok',true,'already_completed',true,'product_count',v_run.product_count,'promotion_count',v_run.promotion_count);
  end if;
  v_kind:=coalesce(v_run.metadata->>'refresh_kind','full');
  select count(*),count(*) filter(where status='completed') into v_queue,v_done
    from public.retail_catalog_category_queue where sync_batch_id=p_sync_batch_id and source_store_id=v_run.source_store_id;
  v_expected:=case when coalesce(v_run.metadata->>'category_count','') ~ '^[0-9]+$' then (v_run.metadata->>'category_count')::integer else v_queue end;
  select count(*) into v_products from public.retail_store_products
    where source_store_id=v_run.source_store_id and is_listed and last_seen_at>=v_run.started_at
      and source_price_source='supervalu_public_storefront';
  -- Product cards alone do not prove the promotions payload was parsed correctly.
  -- Inspect this run's observed, date-current offers before any destructive cleanup.
  select count(*) into v_promotions from public.retail_promotions rp join public.retail_store_products sp on sp.id=rp.store_product_id
    where sp.source_store_id=v_run.source_store_id and sp.is_listed
      and sp.source_price_source='supervalu_public_storefront' and sp.last_seen_at>=v_run.started_at
      and rp.synced_at>=v_run.started_at
      and rp.valid_from<=(now() at time zone 'Europe/Dublin')::date and rp.valid_to>=(now() at time zone 'Europe/Dublin')::date;
  select product_count into v_previous_full from public.retail_catalog_sync_runs
    where retail_banner='supervalu' and source_store_id=v_run.source_store_id and status='completed'
      and coalesce(metadata->>'refresh_kind','full')='full' and sync_batch_id<>p_sync_batch_id
    order by completed_at desc limit 1;
  if v_queue=0 or v_queue<>v_expected or v_done<>v_queue then
    v_reason:=format('Incomplete category queue: %s completed of %s present, %s expected',v_done,v_queue,v_expected);
  elsif v_products < (case when v_kind='full' then 1000 else 100 end) then
    v_reason:=format('Source coverage too small for %s refresh: %s products',v_kind,v_products);
  elsif v_promotions<100 then
    v_reason:=format('Current promotion coverage too small for %s refresh: %s promotions',v_kind,v_promotions);
  elsif v_kind='full' and coalesce(v_previous_full,0)>0 and v_products<v_previous_full*0.7 then
    v_reason:=format('Full source coverage fell below 70 percent of prior complete full run: %s of %s',v_products,v_previous_full);
  end if;
  if v_reason is not null then
    update public.retail_catalog_sync_runs set status='failed',completed_at=now(),error_message=v_reason where sync_batch_id=p_sync_batch_id;
    return jsonb_build_object('ok',false,'published',false,'error',v_reason,'product_count',v_products,'promotion_count',v_promotions);
  end if;
  -- Take the global publication lock before changing rows publication also updates.
  -- Otherwise concurrent store finalizations can deadlock while waiting to publish.
  perform pg_advisory_xact_lock(hashtext('supervalu-national-publication'));
  if v_kind='full' then
    update public.retail_store_products set is_listed=false,updated_at=now()
      where source_store_id=v_run.source_store_id and source_price_source='supervalu_public_storefront'
        and is_listed and last_seen_at<v_run.started_at;
  end if;
  delete from public.retail_promotions rp using public.retail_store_products sp
    where rp.store_product_id=sp.id and sp.source_store_id=v_run.source_store_id
      and sp.source_price_source='supervalu_public_storefront' and rp.synced_at<v_run.started_at;
  -- A zero-item campaign is authoritative only after its fully paginated queue job
  -- succeeds. Missing/failed discovery must not erase prior campaign evidence.
  delete from public.retail_campaign_memberships cm
    where cm.retail_banner=v_run.retail_banner and cm.source_store_id=v_run.source_store_id
      and cm.sync_batch_id<>p_sync_batch_id and cm.observed_at<v_run.started_at
      and exists(select 1 from public.retail_catalog_category_queue q
        where q.sync_batch_id=p_sync_batch_id and q.source_store_id=v_run.source_store_id
          and q.retail_banner=v_run.retail_banner and q.status='completed'
          and q.category_id='CAMPAIGN:'||cm.campaign_key);
  update public.retail_catalog_sync_runs set status='completed',completed_at=now(),error_message=null,
    product_count=v_products,promotion_count=v_promotions where sync_batch_id=p_sync_batch_id;
  -- An exception here rolls back retirement, cleanup, and run completion together.
  select public.refresh_supervalu_national_scope() into v_publication;
  return jsonb_build_object('ok',true,'product_count',v_products,'promotion_count',v_promotions,'national_refresh',v_publication);
end $$;
revoke all on function public.finalize_supervalu_catalog_run(uuid) from public,anon,authenticated;
grant execute on function public.finalize_supervalu_catalog_run(uuid) to service_role;

