# Admin team and sessions

Implemented 28 September 2026. Application changes are included in the reviewed 30 September production release; the staff/session migration is applied to the connected HelloCara database.

## Owner and staff access

The requested `brendan@hellocara.ie` account is an active workspace owner. Its generated password is handed directly to the user, never stored in the repository or invitation emails. First sign-in requires authenticator enrollment. The existing development admin was preserved and can be disabled by another owner in Team.

Owners can invite staff, resend pending invitations, choose access areas, change permissions, disable/restore access, and sign out another member's sessions. Staff use their own credentials and MFA. Customer identities cannot silently become staff through this flow. Existing staff passwords are preserved.

Access areas include both viewing and changes:

- Customers: store onboarding, contacts/settings, Cara training and phone provisioning.
- Calls & rehearsals: call recordings/analysis, demo calls and text rehearsals.
- Support: read, reply to and close support tickets.
- Inbox: shared mailbox reading and sending.
- Billing: platform income/spend, invoices and plan changes.

Overview, team management, customer deletion and client-dashboard impersonation remain owner-only. All staff can manage their own security settings. Permissions apply across the whole staff workspace, not to a subset of client stores.

## Enforcement

`admin_staff` is service-role-only with RLS and no customer policies. Every protected admin entry point checks the live staff record, MFA and a verified JWT's live Auth session. Navigation reflects these checks; hiding links is not the access control. Missing records, disabled staff, database failures and revoked sessions fail closed. Invitation acceptance is recorded after password setup and MFA.

Session RPCs are callable only by the application server. They list safe metadata and revoke only sessions for the requested staff identity; they never expose tokens. Removing an Auth session also deletes its refresh tokens. Role changes take effect on the next request, even with an old access token. Already delivered browser data cannot be recalled.

Security & sessions offers per-device and other-device sign-out, masked IPs, refresh times and password changes. A password change also signs out other sessions. The configured Supabase reauthentication policy remains in force. Browser labels for new password sign-ins use a sanitised User-Agent; some older/provider sessions may be unidentified.

The status-change RPC rejects self-disable and serialises owner management. Sensitive staff lifecycle/session actions write existing security audit events without secrets.

## Verification

Disposable staff accounts exercised password setup → MFA → assigned workspace, desktop/mobile forms, direct route/API denial, permissions changing on existing sessions, owner-driven sign-out, cross-user revocation isolation and rejected refresh tokens after revocation. No invitation emails were sent during verification. All 976 repository tests pass after the 30 September cleanup, full TypeScript checking passes, and scoped lint/diff checks pass. Regression tests cover access checks, invitation retry/failure, existing credentials, audit boundaries, session-target validation and concurrent first-login activation. The 3 disposable staff accounts, their sessions and temporary credentials were removed.

The Supabase advisor reports the intentional service-only table without customer policies. Existing unrelated database warnings remain. See [RLS advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Session checks follow [Supabase session guidance](https://supabase.com/docs/guides/auth/sessions).
