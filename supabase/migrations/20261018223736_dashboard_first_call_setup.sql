-- Server-owned progress: customers cannot approve verification or invent a phone number.
create table public.customer_first_call_setup (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 business_details jsonb not null default '{}'::jsonb,
 verification_status text not null default 'not_submitted' check (verification_status in ('not_submitted','submitted','needs_information','verified')),
 verification_ticket_id uuid references public.support_tickets(id) on delete set null,
 submitted_by uuid references auth.users(id) on delete set null,
 submitted_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 review_note text,
 welcome_seen_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.customer_first_call_setup enable row level security;
revoke all on public.customer_first_call_setup from anon, authenticated;
grant all on public.customer_first_call_setup to service_role;

-- One submission and ticket per business, including concurrent retries.
create function public.submit_first_call_business(p_org uuid, p_user uuid, p_details jsonb, p_body text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_ticket uuid; v_status text;
begin
 perform 1 from organizations where id=p_org for update;
 if not found then raise exception 'Business not found'; end if;
 select verification_ticket_id,verification_status into v_ticket,v_status from customer_first_call_setup where organization_id=p_org;
 if v_status='verified' then raise exception 'Contact support to change verified details'; end if;
 if v_ticket is null then
   insert into support_tickets(organization_id,created_by,subject,body,status)
   values(p_org,p_user,'Business verification · first call setup',p_body,'open') returning id into v_ticket;
 else
   update support_tickets set body=p_body,status='open',updated_at=now() where id=v_ticket;
 end if;
 insert into customer_first_call_setup(organization_id,business_details,verification_status,verification_ticket_id,submitted_by,submitted_at)
 values(p_org,p_details,'submitted',v_ticket,p_user,now())
 on conflict(organization_id) do update set business_details=excluded.business_details,verification_status='submitted',verification_ticket_id=v_ticket,submitted_by=p_user,submitted_at=now(),reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now();
 return v_ticket;
end $$;
revoke all on function public.submit_first_call_business(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_first_call_business(uuid,uuid,jsonb,text) to service_role;
