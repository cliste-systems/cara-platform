<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Product surfaces

Ship **real behaviour only**: no demo niches, fake filters, “coming soon” controls, or copy that implies a feature works when it does not. Lists and search must reflect **live data** (e.g. directory options from the database). If a control is not wired end-to-end yet, **omit it** or implement it—do not leave placeholder UI.

See [docs/VERTICALS.md](docs/VERTICALS.md) for how to add a new business vertical (pack object + copy registries).

# Act via tools — don’t ask

Use MCP, CLIs (`vercel`, `supabase`, `gh`, `lk`), and project scripts to complete infra and ops work. **Do not ask the user** to run SQL, open dashboards, or paste commands you can run yourself.

# Supabase access

You have the Supabase MCP attached to this repo. When a task needs database work (applying a migration, inserting test rows, smoke-testing Realtime, querying state to confirm a fix, etc.) **just do it via MCP**. Do not ask the user to run SQL for you, and do not ask for permission before inserting clearly-marked test rows into dev data. Test rows must carry an obvious marker (e.g. `[smoke test]` in a text field, a caller number like `+1-555-SMOKE-TEST`, or a `RT-TEST-*` booking reference) so they are trivial to clean up afterwards, and you should offer cleanup once the user has confirmed the behaviour.

When acting against Supabase, prefer `apply_migration` for DDL (so it is captured in `supabase/migrations/`) and `execute_sql` for reads and for one-off test inserts. Never hardcode generated IDs from one migration into another.

**Auth URL config** (site URL, redirect allow list) is not exposed on the hosted MCP database tools. Run `npx tsx scripts/patch-supabase-auth-urls.ts` using `SUPABASE_ACCESS_TOKEN` or a `supabase login` token — do not send the user to the dashboard for this.

**Supabase MCP disconnected:** run `npm run supabase:mcp-reconnect` (writes `.cursor/mcp.json` from `SUPABASE_ACCESS_TOKEN` in `.env.local`). See `docs/ops/ENV.md`.
