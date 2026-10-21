-- Approved shared timeout adjustment: allow schema introspection to finish.
-- Preserve the existing API request timeouts for anon/authenticated/service_role.
ALTER ROLE service_role SET statement_timeout = '8s';
ALTER ROLE authenticator SET statement_timeout = '30s';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
