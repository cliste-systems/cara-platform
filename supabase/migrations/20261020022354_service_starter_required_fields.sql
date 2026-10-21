alter table public.organizations add constraint organizations_service_starter_required_fields check (
 service_starter_state is null or (
  service_starter_state ?& array['version','catalogueVersion','classificationKey','mode','profiles','removed']
  and length(service_starter_state->>'classificationKey') between 1 and 500
  and jsonb_array_length(service_starter_state->'removed') <= 500
 ));
