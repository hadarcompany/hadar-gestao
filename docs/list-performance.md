# List loading and persistent VPS connections

The active task screen requests `GET /api/tasks?scope=active`, excluding completed/cancelled records in the database. Existing status, client, priority, assignee and ownership rules still apply. The history screen keeps its existing completed/cancelled queries; the default API response remains compatible.

`GET /api/clients?view=lookup` returns only id/name/status for selectors after the existing authorization guard. `view=list` returns the client list fields, task count and logo links for users who can view clients. Full briefings, interactions and services remain on the client detail endpoint. Default API responses are unchanged. Task-only users retain their existing minimal client projection.

Task filters no longer reload both selector lists. The authentication provider coalesces concurrent profile reads, and `/api/users/me` reuses the account already read and verified by `getServerAuth`. Authentication and current database permissions remain mandatory. The notification endpoint runs independent generation and read operations in parallel, with the existing deduplication and visibility rules.

Prisma is shared through one process singleton in production as well as development. This prevents separately loaded route bundles from creating their own connection pools.

For the single persistent Insider container, the measured configuration uses the Supabase shared session pooler on port 5432, a four-connection application limit and TLS. The `pgbouncer=true` transaction compatibility option is removed only for that instance's session-mode URL. Vercel/serverless connection settings remain unchanged. Keep backups, credentials, schema and trial settings intact; save the old environment and release for rollback. No database migration is required.

Validate with `npx tsx --test tests/list-performance.test.ts tests/security.test.ts tests/team-members.test.ts`, TypeScript and build. After deployment compare real sequential and simultaneous HTTP requests, verify active vs historical counts and full client details, and confirm the imported data/account fingerprints remain unchanged.

## Permission-aware entry

Successful sign-in goes to `/`, which chooses an accessible destination using the current account read from the database. Administrators keep the Dashboard; members without that permission open Meu Trabalho or another permitted page. Accounts with no modules can still open their personal settings. The authenticated layout redirects bookmarks to inaccessible pages before rendering their children. This is a navigation safeguard; API authorization remains unchanged.

Dashboard responses are checked before entering render state. HTTP errors and incomplete payloads display an error while preserving the last valid state. Authenticated pages also provide a retry/home fallback for rendering failures. Regression tests are in `tests/page-access.test.ts`.
