-- Run inside a transaction with the prepared migration, and always ROLLBACK.
-- All synthetic rows are marked QA_POS_; no customer rows are changed.
do $$
declare scenario text; product uuid; listing uuid; batch uuid; source text; n integer; price numeric; observed timestamptz; begin
 foreach scenario in array array['good','expired','future','failed','two','conflict','stale'] loop
  insert into public.retail_catalog_products(retail_banner,sku,product_name,department,search_text,service_area,fulfilment,sell_by,price_unit_type)
   values('supervalu','QA_POS_'||scenario,'[smoke test] QA_POS_'||scenario,'Beef Steaks','qa_pos_'||scenario,'butcher','counter','weight','kilogram') returning id into product;
  for n in 1..(case when scenario='two' then 2 when scenario='conflict' then 6 else 3 end) loop
   source:='QA_POS_'||scenario||'_'||n; batch:=gen_random_uuid();
   observed:=now()-case when scenario='stale' then interval '49 hours' else interval '1 minute' end;
   price:=case when scenario='conflict' and n>3 then 24.99 else 22.77 end;
   insert into public.retail_catalog_sync_runs(retail_banner,source_store_id,sync_batch_id,status,started_at)
    values('supervalu',source,batch,case when scenario='failed' then 'failed' else 'running' end,observed-interval '1 minute');
   insert into public.retail_store_products(product_id,source_store_id,sync_batch_id,regular_price_eur,display_price_eur,source_price_source,synced_at,last_seen_at)
    values(product,source,batch,33.99,price,'supervalu_public_storefront',observed,observed) returning id into listing;
   insert into public.retail_promotions(store_product_id,promotion_key,promotion_type,loyalty_required,offer_price_eur,regular_price_eur,label,valid_from,valid_to,synced_at)
    values(listing,'qa','percentage',false,price,33.99,'Save 33%',
      case when scenario='future' then current_date+7 else current_date-7 end,
      case when scenario='expired' then current_date-1 else current_date+14 end,observed);
  end loop;
 end loop;
 insert into public.retail_weekly_offers(retail_banner,sku,product_name,department,current_price_eur,discount_label,offer_week_start,offer_week_end,search_text,synced_at,sync_batch_id,is_national,national_store_count)
  values('supervalu','QA_POS_preserved','[smoke test] previously published offer','Beef Steaks',10,'Only €10',current_date-1,current_date+7,'qa_pos_preserved',now()-interval '1 hour',gen_random_uuid(),true,3);
 perform public.publish_supervalu_positive_consensus();
 if (select count(*) from public.retail_weekly_offers where sku='QA_POS_good' and current_price_eur=22.77 and national_store_count=3)<>1 then raise exception 'Running-source positive evidence was not published'; end if;
 if exists(select 1 from public.retail_weekly_offers where sku in ('QA_POS_expired','QA_POS_future','QA_POS_failed','QA_POS_two','QA_POS_conflict','QA_POS_stale')) then raise exception 'Invalid or conflicting evidence was published'; end if;
 if not exists(select 1 from public.retail_weekly_offers where sku='QA_POS_preserved') then raise exception 'Partial scan retired unrelated offer'; end if;
 perform public.publish_supervalu_positive_consensus();
 if (select count(*) from public.retail_weekly_offers where sku='QA_POS_good')<>1 then raise exception 'Repeated publication duplicated evidence'; end if;
end $$;
select jsonb_build_object('passed',9,'synthetic_rows','rolled back','striploin',(select jsonb_agg(jsonb_build_object('price',current_price_eur,'stores',national_store_count)) from public.retail_weekly_offers where sku='1023229001')) as verification;
