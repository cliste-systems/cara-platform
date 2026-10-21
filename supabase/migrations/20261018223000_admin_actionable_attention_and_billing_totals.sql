-- Operational attention is independent of today's activity window.
create or replace function public.admin_attention_queue(p_filter text default 'all',p_page integer default 0,p_size integer default 3)
returns jsonb language sql stable security invoker set search_path=public as $$
with issues as (
 select 'call-'||h.call_id::text id,h.call_id "callId",h.reasons[1] title,h.name detail,
 '/admin/call-analysis/'||h.call_id::text href,h.at,h.priority,h.signature,h.reasons,'calls' category
 from admin_overview_call_health() h join call_logs c on c.id=h.call_id
 left join organizations o on o.id=c.organization_id
 left join admin_overview_issue_reviews r on r.call_log_id=h.call_id and r.signature=h.signature
 where cardinality(h.reasons)>0 and r.call_log_id is null
 and not coalesce(c.engineer_test_call,false) and not coalesce(c.is_test_call,false) and not coalesce(c.verification_call,false)
 and coalesce(o.name,'') !~* '^\[smoke test\]' and coalesce(o.slug,'') !~* '^(smoke-test-|rt-test-)'
 union all
 select 'support-'||s.id::text,null::uuid,coalesce(nullif(s.subject,''),'Open support ticket'),coalesce(o.name,'Support inbox'),
 '/admin/support/'||s.id::text,s.created_at,2,null::text,array['Support ticket'],'support'
 from support_tickets s left join organizations o on o.id=s.organization_id
 where s.status='open' and coalesce(o.name,'') !~* '^\[smoke test\]' and coalesce(o.slug,'') !~* '^(smoke-test-|rt-test-)'
 union all
 select 'customer-'||o.id::text,null::uuid,
 case when a.status in ('past_due','unpaid','suspended') then 'Review billing'
 when not exists(select 1 from admin_invites ai where ai.organization_id=o.id) and a.status='onboarding' then 'Signup incomplete'
 when not exists(select 1 from account_memberships m where m.account_id=a.id) then 'Check customer access'
 when o.phone_number is null then 'Assign phone number' else 'Review launch readiness' end,
 o.name,'/admin/customers/'||o.id::text,o.created_at,4,null::text,array['Customer readiness'],'customers'
 from organizations o join accounts a on a.id=o.account_id
 where not coalesce(o.is_active,false) and a.status not in ('canceled','cancelled','closed')
 and o.name !~* '^\[smoke test\]' and o.slug !~* '^(smoke-test-|rt-test-)'
), filtered as (
 select * from issues where p_filter='all' or p_filter=category or
 (p_filter='reviews' and category='calls' and exists(select 1 from unnest(reasons) reason where reason ilike '%quality review%'))
)
select jsonb_build_object('total',(select count(*) from filtered),
 'issues',coalesce((select jsonb_agg(to_jsonb(x) order by priority,at,id) from
 (select * from filtered order by priority,at,id offset greatest(p_page,0)*least(greatest(p_size,1),50) limit least(greatest(p_size,1),50)) x),'[]'::jsonb));
$$;
revoke all on function public.admin_attention_queue(text,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_attention_queue(text,integer,integer) to service_role;

-- Full-ledger totals; row lists remain a separately labelled recent activity view.
create or replace function public.admin_billing_totals(p_live boolean default true)
returns jsonb language sql stable security invoker set search_path=public as $$
with currencies as (
 select currency from billing_payments where livemode=p_live
 union select currency from billing_invoices where livemode=p_live
), payments as (
 select currency,sum(amount_received) filter(where status='succeeded') gross,
 sum(refunded_amount) filter(where status='succeeded') refunds,
 count(*) filter(where status in ('requires_payment_method','requires_action')) failures
 from billing_payments where livemode=p_live group by currency
), invoices as (
 select currency,sum(amount_remaining) filter(where status in ('open','past_due')) outstanding,
 count(*) filter(where status in ('open','past_due')) open
 from billing_invoices where livemode=p_live group by currency
)
select coalesce(jsonb_agg(jsonb_build_object('currency',c.currency,'gross',coalesce(p.gross,0),'refunds',coalesce(p.refunds,0),
 'net',coalesce(p.gross,0)-coalesce(p.refunds,0),'failures',coalesce(p.failures,0),'outstanding',coalesce(i.outstanding,0),'open',coalesce(i.open,0))),'[]'::jsonb)
from currencies c left join payments p using(currency) left join invoices i using(currency);
$$;
revoke all on function public.admin_billing_totals(boolean) from public,anon,authenticated;
grant execute on function public.admin_billing_totals(boolean) to service_role;