-- Additive, nullable metadata. Existing niches, retail packs and organization RLS remain unchanged.
alter table public.organizations add column if not exists business_classification jsonb;
alter table public.organizations add constraint organizations_business_classification_shape check (
 business_classification is null or (
 jsonb_typeof(business_classification)='object'
 and business_classification ?& array['version','categoryId','specialtyIds']
 and business_classification @> '{"version":1}'::jsonb
 and jsonb_typeof(business_classification->'categoryId')='string'
 and jsonb_typeof(business_classification->'specialtyIds')='array'
 and jsonb_array_length(business_classification->'specialtyIds') between 1 and 8
 ));
comment on column public.organizations.business_classification is 'Owner-confirmed category and speciality IDs from the versioned self-service catalogue; retail remains team-managed.';
