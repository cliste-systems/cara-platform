-- Additive setup metadata; historical classifications and customer records are retained.
alter table public.organizations add column if not exists service_starter_state jsonb;
alter table public.organizations add constraint organizations_service_starter_state_shape check (
 service_starter_state is null or (
  jsonb_typeof(service_starter_state)='object'
  and service_starter_state @> '{"version":1,"catalogueVersion":1}'::jsonb
  and jsonb_typeof(service_starter_state->'classificationKey')='string'
  and service_starter_state->>'mode' in ('suggested','fresh')
  and jsonb_typeof(service_starter_state->'profiles')='object'
  and jsonb_typeof(service_starter_state->'removed')='array'
  and octet_length(service_starter_state::text)<=30000
 ));
comment on column public.organizations.service_starter_state is 'Owner-saved starter mode, profile answers and removals. Suggestions are not confirmed services; only agent_services_departments supplies offered services.';

-- Authenticated self-service updates cannot introduce an excluded or invented
-- classification through direct REST. Service-role/admin provisioning remains
-- team-managed. Keeping an existing historical ID never changes its eligibility
-- or deactivates an existing customer.
create or replace function public.guard_setup_classification_admission()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
 allowed jsonb := '{"trades":["electrician","plumber","heating_engineer","carpenter_joiner","builder","roofer","painter_decorator","plasterer","tiler","flooring_installer","locksmith","windows_glazing","groundwork","multi_trade"],"home_services":["cleaning","gardening_landscaping","property_maintenance","pest_control","appliance_repair","removals_storage","waste_removal"],"beauty":["hair_salon","barber","nail_salon","beauty_salon","lashes_brows","waxing","makeup_artist","spa"],"fitness":["gym","personal_trainer","yoga","pilates","sports_coaching"],"hospitality":["restaurant","caf","takeaway","pub_bar","catering","hotel","guesthouse_b_b","holiday_accommodation"],"automotive":["garage_mechanic","tyre_centre","body_repair","vehicle_dealership","vehicle_recovery","valeting_detailing","vehicle_rental"],"professional":["consultant","recruitment_agency"],"property":["estate_agent","letting_agent","property_management","accommodation_management"],"education":["tutor","language_school","driving_instructor","training_provider","music_teacher","dance_school"],"pets":["pet_groomer","boarding_kennels_cattery","dog_walker","animal_trainer","equestrian_services"],"events":["event_planner","event_venue","photographer","videographer","entertainment","equipment_hire","designer"],"technology":["it_support","computer_phone_repair","software_business","web_agency","telecoms_provider"],"transport":["taxi_chauffeur","courier","haulage","passenger_transport","delivery_service"],"agriculture":["farm_business","agricultural_contractor","agricultural_machinery_repair","forestry_services"],"community":["charity","community_organisation","sports_club","membership_organisation"]}'::jsonb;
 category text;
 ids jsonb;
 item jsonb;
begin
 if auth.uid() is null or new.business_classification is not distinct from old.business_classification then return new; end if;
 category := new.business_classification->>'categoryId';
 ids := new.business_classification->'specialtyIds';
 if new.business_classification is null or new.business_classification->>'version' is distinct from '1'
    or category is null or not (allowed ? category) or jsonb_typeof(ids) is distinct from 'array' then
  raise exception 'This business type needs a separate setup review.' using errcode='23514';
 end if;
 if jsonb_array_length(ids) not between 1 and 8 then
  raise exception 'Choose between one and eight supported specialities.' using errcode='23514';
 end if;
 for item in select value from jsonb_array_elements(ids) loop
  if jsonb_typeof(item) is distinct from 'string' or not ((allowed->category) ? (item#>>'{}')) then
   raise exception 'This business type needs a separate setup review.' using errcode='23514';
  end if;
 end loop;
 if (select count(*) from jsonb_array_elements(ids)) <> (select count(distinct value) from jsonb_array_elements(ids)) then
  raise exception 'Choose each speciality once.' using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function public.guard_setup_classification_admission() from public,anon,authenticated;
create trigger guard_setup_classification_admission before update of business_classification
on public.organizations for each row execute function public.guard_setup_classification_admission();
