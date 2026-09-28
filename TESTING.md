# Testing Strategy

## Test pyramid

### Unit tests

- Money arithmetic
- Reference generation
- Customer normalization and deduplication
- Status transition policies
- Crew/truck recommendations
- Minimum-hour enforcement
- Access adjustments
- Packing and specialty surcharges
- Discount and tax calculations
- Confidence and warning generation

### Integration tests

Use a disposable Supabase test environment or local Supabase instance.

Database tests are pgTAP files under `supabase/tests/database`. Run them against
the local stack:

```bash
npm run db:start
npm run db:reset
npm run test:db
npm run db:stop
```

Required scenarios:
- public lead submission
- duplicate customer handling
- role-restricted record access
- lead qualification
- estimate persistence with rule version
- estimate-to-quote conversion
- quote acceptance
- accepted quote to job conversion
- dashboard aggregation
- audit-event creation

### End-to-end tests

Mandatory happy path:

1. Submit public quote request.
2. Authenticate as admin.
3. Open the new lead.
4. Qualify it.
5. Generate estimate.
6. Approve estimate.
7. Create and mark quote sent.
8. Accept quote.
9. Schedule job.
10. Verify dashboard changes.

Mandatory negative paths:
- invalid public form
- viewer attempts mutation
- quote acceptance from invalid status
- duplicate job creation from one quote
- client total tampering

## Quality gates

Every pull request/build must pass:

```bash
npm run lint
npm run typecheck
npm run test
npm run db:start
npm run db:reset
npm run env:local
npm run test:db
npm run test:e2e
npm run build
```

CI runs all of these on every pull request, E2E included: the workflow spans
nine roles-and-status transitions, and it has already caught a server/client
boundary bug that unit tests and typecheck both passed.

Database tests cover negative authorization for every protected mutation and
verify RLS as the `authenticated` role rather than as the superuser, which
bypasses policies entirely.

## Fixtures

Seed:
- one user per role
- one active pricing version
- representative local moves
- one specialty-item case
- one incomplete-information case

Fixtures must be deterministic and contain no real personal information.

## Public landing page regression coverage

`e2e/app-shell.spec.ts` covers the landing CTA, service preset selection and invalid-preset fallback, expandable FAQs, mobile navigation/overflow, and preservation/focus of submitted values after server validation failure. The existing workflow test exercises real public submission through scheduled-job creation. `e2e/accessibility.spec.ts` scans the homepage and quote form along with internal screens.
