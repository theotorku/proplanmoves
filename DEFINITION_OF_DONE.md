# Definition of Done

The v0.1 release is complete only when all items below are true.

## Functional

- [ ] Public lead submission works with server-side validation.
- [ ] Customer deduplication works for normalized email/phone.
- [ ] Lead is visible and manageable in admin.
- [ ] Qualified lead produces a deterministic estimate.
- [ ] Estimate stores its pricing-rule version.
- [ ] Approved estimate produces an editable quote.
- [ ] Quote totals are server-verified.
- [ ] Quote acceptance is recorded with audit history.
- [ ] Accepted quote converts once into a job.
- [ ] Job can be scheduled with an arrival window.
- [ ] Dashboard reads live data.

## Security

- [ ] Authentication is implemented.
- [ ] Server-side role checks exist.
- [ ] RLS is enabled and verified on operational tables.
- [ ] Anonymous users cannot read submitted records.
- [ ] Service-role credentials are server-only.
- [ ] Public intake is rate-limited.

## Quality

- [ ] Strict TypeScript passes.
- [ ] Lint passes.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Critical E2E flow passes.
- [ ] Production build passes.
- [ ] No production path depends on mock data.
- [ ] Empty, loading, validation, and error states exist.

## Operations

- [ ] Migrations reproduce the database.
- [ ] Seed/bootstrap instructions work.
- [ ] Environment variables are documented.
- [ ] Deployment steps are documented and tested.
- [ ] Structured logs and audit events exist.
- [ ] Known limitations are documented.

## Product

- [ ] Scope matches `PRODUCT_SCOPE.md`.
- [ ] UI is usable on mobile and desktop.
- [ ] Preliminary-estimate disclaimer is visible.
- [ ] Internal and customer-facing notes cannot be confused.
- [ ] Owner can operate the full lead-to-job workflow without database access.
