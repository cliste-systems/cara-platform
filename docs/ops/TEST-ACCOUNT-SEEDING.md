# Test account seeding

The account seed and presenter reset scripts are restricted to explicitly selected local or isolated test Supabase projects. For customer or production accounts, use the application invitation and password-reset flows.

Before running a seed script, supply the following through your protected local environment or password manager. Never put passwords in commands, repository files, runbooks, or shared logs.

- `NEXT_PUBLIC_SUPABASE_URL` and the matching service-role credential identify the local/test database.
- `CLISTE_SEED_TARGET_URL` must exactly acknowledge that Supabase URL.
- For a local loopback Supabase instance, set `CLISTE_SEED_ENVIRONMENT=local`.
- For an isolated hosted test project, set `CLISTE_SEED_ENVIRONMENT=test` and `CLISTE_SEED_TEST_PROJECT_REF` to that test project's exact reference. The script only accepts its HTTPS Supabase origin. Never select a production project here.
- `CLISTE_SEED_EMAIL` identifies the intended test account. There is no default account address.
- `CLISTE_SEED_PASSWORD` must be a unique password-manager-generated value of 24–128 characters. There is no default password, and scripts do not print it.

Scripts reject production-marked Node/Vercel environments, missing target acknowledgements, mismatched hosted project references, and missing credentials before creating a service-role client. Keep test projects separate from production; these environment variables acknowledge the operator's selection and do not discover the project's purpose automatically.

This applies to `seed-admin-dev-user.ts`, `seed-retail-demo-user.ts`, `seed-salon-demo-user.ts`, `seed-kavanaghs-retail-demo.ts`, and `reset-kavanaghs-demo-password.ts`.

Previously seeded accounts used reusable credentials. Remove or rotate any such account still present in a hosted project and revoke its sessions. Removing a password from source does not revoke an existing login or erase Git history. Existing production accounts should receive an invitation/recovery flow instead of being recreated by test seed scripts.
