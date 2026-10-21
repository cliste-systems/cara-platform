alter table public.customer_first_call_setup add column twilio_bundle_sid text;
create function public.review_first_call_business(p_org uuid,p_reviewer uuid,p_status text,p_note text,p_bundle text,p_submitted_at timestamptz)
returns void language plpgsql security invoker set search_path=public as $$
declare v_ticket uuid;
begin
 if p_status not in ('verified','needs_information') then raise exception 'Invalid review status'; end if;
 select verification_ticket_id into v_ticket from customer_first_call_setup
 where organization_id=p_org and submitted_at=p_submitted_at for update;
 if not found or v_ticket is null then raise exception 'Submission changed; refresh before reviewing'; end if;
 update customer_first_call_setup set verification_status=p_status,review_note=p_note,reviewed_by=p_reviewer,reviewed_at=now(),twilio_bundle_sid=p_bundle,updated_at=now() where organization_id=p_org;
 insert into support_ticket_messages(ticket_id,author_kind,body,created_by)
 values(v_ticket,'admin',p_note,p_reviewer);
 update support_tickets set status=case when p_status='verified' then 'closed' else 'open' end,updated_at=now() where id=v_ticket;
end $$;
revoke all on function public.review_first_call_business(uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.review_first_call_business(uuid,uuid,text,text,text,timestamptz) to service_role;

create or replace function public.submit_first_call_business(p_org uuid, p_user uuid, p_details jsonb, p_body text)
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
   insert into support_ticket_messages(ticket_id,author_kind,body,created_by) values(v_ticket,'salon',p_body,p_user);
   update support_tickets set status='open',updated_at=now() where id=v_ticket;
 end if;
 insert into customer_first_call_setup(organization_id,business_details,verification_status,verification_ticket_id,submitted_by,submitted_at)
 values(p_org,p_details,'submitted',v_ticket,p_user,now())
 on conflict(organization_id) do update set business_details=excluded.business_details,verification_status='submitted',verification_ticket_id=v_ticket,submitted_by=p_user,submitted_at=now(),reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now();
 return v_ticket;
end $$;
revoke all on function public.submit_first_call_business(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_first_call_business(uuid,uuid,jsonb,text) to service_role;
