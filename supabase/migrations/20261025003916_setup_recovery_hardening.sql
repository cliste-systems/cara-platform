alter table public.customer_phone_connections
 add column activation_lease_until timestamptz,
 add column activation_attempts integer not null default 0,
 add column activation_next_attempt_at timestamptz not null default now(),
 add column activation_last_error text,
 add column setup_invoice_item_id text,
 add column trial_ends_at timestamptz,
 add column assisted_by uuid references auth.users(id),
 add column assisted_reason text;
create index phone_connection_retry_due on public.customer_phone_connections(activation_next_attempt_at) where verified_at is not null and trial_activated_at is null;

create function public.claim_connection_activation(p_org uuid) returns timestamptz
 language sql set search_path=public as $$
 with claimed as (update customer_phone_connections set activation_lease_until=now()+interval '5 minutes',activation_attempts=activation_attempts+1,activation_next_attempt_at=now()+interval '5 minutes'
 where organization_id=p_org and verified_at is not null and trial_activated_at is null and (activation_lease_until is null or activation_lease_until<now()) returning activation_lease_until) select activation_lease_until from claimed;
$$;

-- Compile before entering this transaction, then commit the exact version and receipts together.
create function public.save_first_call_configuration(p_org uuid,p_version timestamptz,p_section text,p_patch jsonb) returns boolean
 language plpgsql set search_path=public as $$
declare o organizations; s customer_first_call_setup; v organizations; receipts jsonb; stamp timestamptz:=clock_timestamp();
begin
 select * into o from organizations where id=p_org for update;
 if not found or o.updated_at is distinct from p_version then return false; end if;
 select * into s from customer_first_call_setup where organization_id=p_org for update;
 if not found or s.completed_sections ? 'dashboard' or s.verification_status not in ('submitted','needs_information','verified') then return false; end if;
 if p_section not in ('profile','hours','services','greeting') then return false; end if;
 if p_section<>'profile' and not (s.completed_sections ? 'profile') then return false; end if;
 if p_section in ('services','greeting') and not (s.completed_sections ? 'hours') then return false; end if;
 if exists(select from jsonb_object_keys(p_patch) k where k not in ('business_classification','niche','agent_business_type','raw_business_description','business_hours','agent_opening_hours','agent_services_departments','agent_services_not_offered','service_starter_state','greeting','business_knowledge_summary','custom_prompt','prompt_compile_warnings')) then raise exception 'Unexpected configuration field'; end if;
 v:=jsonb_populate_record(o,p_patch);
 update organizations set business_classification=v.business_classification,niche=v.niche,agent_business_type=v.agent_business_type,raw_business_description=v.raw_business_description,business_hours=v.business_hours,agent_opening_hours=v.agent_opening_hours,agent_services_departments=v.agent_services_departments,agent_services_not_offered=v.agent_services_not_offered,service_starter_state=v.service_starter_state,greeting=v.greeting,business_knowledge_summary=v.business_knowledge_summary,custom_prompt=v.custom_prompt,prompt_compile_warnings=v.prompt_compile_warnings,updated_at=stamp where id=p_org;
 receipts:=coalesce(s.completed_sections,'{}'::jsonb)-'dashboard'-'forwarding';
 if p_section='profile' then receipts:=receipts-'hours'-'services'-'greeting';
 elsif p_section='hours' then receipts:=receipts-'services'-'greeting';
 elsif p_section='services' then receipts:=receipts-'greeting'; end if;
 update customer_first_call_setup set completed_sections=receipts||jsonb_build_object(p_section,stamp),updated_at=stamp where organization_id=p_org;
 return true;
end $$;

create function public.unlock_first_call_dashboard(p_org uuid) returns boolean
 language plpgsql set search_path=public as $$
declare s customer_first_call_setup;
begin
 perform 1 from organizations where id=p_org for update;
 select * into s from customer_first_call_setup where organization_id=p_org for update;
 if s.completed_sections ? 'dashboard' then return true; end if;
 if not (s.completed_sections ?& array['profile','hours','greeting']) then return false; end if;
 if not exists(select from call_logs where organization_id=p_org and created_at>=(s.completed_sections->>'greeting')::timestamptz and duration_seconds>10 and outcome in ('answered','link_sent','callback_requested','action_created','transferred') and engineer_test_call is distinct from true) then return false; end if;
 update customer_first_call_setup set welcome_seen_at=now(),completed_sections=completed_sections||jsonb_build_object('dashboard',now()),updated_at=now() where organization_id=p_org;
 return true;
end $$;

create function public.request_connection_support(p_org uuid,p_user uuid) returns uuid
 language plpgsql set search_path=public as $$
declare c customer_phone_connections; ticket uuid;
begin
 select * into c from customer_phone_connections where organization_id=p_org for update;
 if not found then raise exception 'Connection details required'; end if;
 if c.support_ticket_id is not null then
  select id into ticket from support_tickets where id=c.support_ticket_id and status not in ('closed','resolved');
  if ticket is not null then return ticket; end if;
 end if;
 insert into support_tickets(organization_id,created_by,subject,body,status) values(p_org,p_user,'Help connecting my business number',format('Please help connect %s to Cara. Phone: %s. Provider: %s. Verify an actual forwarded call before activation.',c.business_number,c.phone_type,c.provider),'open') returning id into ticket;
 update customer_phone_connections set support_ticket_id=ticket where organization_id=p_org;
 return ticket;
end $$;

revoke all on function public.claim_connection_activation(uuid),public.save_first_call_configuration(uuid,timestamptz,text,jsonb),public.unlock_first_call_dashboard(uuid),public.request_connection_support(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_connection_activation(uuid),public.save_first_call_configuration(uuid,timestamptz,text,jsonb),public.unlock_first_call_dashboard(uuid),public.request_connection_support(uuid,uuid) to service_role;
