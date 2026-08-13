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
npm run test:db
npm run build
```

Run E2E tests for release candidates and critical workflow changes.

## Fixtures

Seed:
- one user per role
- one active pricing version
- representative local moves
- one specialty-item case
- one incomplete-information case

Fixtures must be deterministic and contain no real personal information.
