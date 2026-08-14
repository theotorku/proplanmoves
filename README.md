# ProPlan Moves OS

ProPlan Moves OS is the operational platform for ProPlan Moves and the reference implementation for reusable ProPlan Solutions modules.

## Release objective

Build one reliable vertical workflow:

`lead submitted → lead qualified → estimate generated → quote issued → quote accepted → job scheduled`

The first release supports local residential, apartment, office, labor-only, and packing-service moves. Interstate authority, advanced routing, payroll, live GPS, claims adjudication, and autonomous AI pricing are explicitly out of scope.

## Recommended stack

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase PostgreSQL, Auth, Storage, Row-Level Security
- Zod for input validation
- Vitest for unit and integration tests
- Playwright for end-to-end tests
- Vercel for deployment
- GitHub Actions for continuous integration

## Documentation map

- `AGENTS.md` — Codex operating instructions
- `PRD.md` — product requirements and acceptance criteria
- `PRODUCT_SCOPE.md` — release boundaries
- `ARCHITECTURE.md` — system design and module boundaries
- `DATABASE.md` — data model and invariants
- `WORKFLOWS.md` — lifecycle and state transitions
- `ESTIMATION_ENGINE.md` — deterministic pricing model
- `SECURITY.md` — authorization, RLS, audit, and privacy controls
- `TESTING.md` — test strategy and mandatory scenarios
- `DEPLOYMENT.md` — environments and release process
- `ENVIRONMENT.md` — configuration contract
- `DESIGN_SYSTEM.md` — UI direction and accessibility
- `OBSERVABILITY.md` — logs, metrics, and audit events
- `DECISIONS.md` — architecture decision records
- `ROADMAP.md` — 60-day delivery sequence
- `TASKS.md` — actionable implementation backlog
- `DEFINITION_OF_DONE.md` — release gate
- `VISION.md` — long-term product direction
- `COMPETITOR_ANALYSIS.md` — market comparison notes
- `LESSONS_LEARNED.md` — implementation learnings

## Local setup

```bash
npm install
npm run db:start          # local Supabase (Docker required)
npm run db:reset          # apply migrations and seed
npm run env:local         # write .env.local from the running stack
npm run dev
```

`npm run env:local` reads the keys from the stack that is actually running, so
the file cannot drift from it. It never overwrites an existing `.env.local`
unless you pass `--force`.

To sign in, create an operator: add a user in Supabase Studio (or via the auth
admin API) whose email matches `BOOTSTRAP_OWNER_EMAIL`, then visit
`/admin/bootstrap` to grant the first owner role.

## Commands

```bash
npm run lint
npm run typecheck
npm run test              # unit tests
npm run test:db           # pgTAP against the local stack
npm run test:e2e          # Playwright, including the full workflow and a11y scans
npm run build
npm run smoke -- https://app.example.com   # post-deploy checks
```

## Initial success criteria

The release is successful when a public visitor can submit a request and an authenticated operator can convert it into a scheduled job using real database records, enforced permissions, deterministic calculations, and a passing end-to-end test.
