# Implementation Backlog

## Epic 1 — Foundation

- [x] Initialize Next.js TypeScript application
- [x] Configure Tailwind and component primitives
- [x] Add lint, typecheck, test, build scripts
- [x] Add environment validation
- [x] Configure Supabase clients safely
- [x] Create migrations and seed data
- [x] Implement auth and bootstrap owner flow
- [x] Implement role policies and RLS
- [x] Add CI workflow

## Epic 2 — Public lead intake

- [x] Create public service pages
- [x] Build quote request schema and form
- [x] Add server submission endpoint/action
- [x] Normalize email and phone
- [x] Upsert customer transactionally
- [x] Create addresses and lead
- [x] Generate reference
- [x] Add confirmation page
- [x] Add rate limiting

## Epic 3 — Admin leads

- [x] Lead table with filters
- [x] Lead detail page
- [x] Status changes
- [x] Assignment
- [x] Notes
- [x] Contact activities
- [x] Lost/disqualified reasons
- [x] Audit timeline

## Epic 4 — Estimation

- [x] Pricing rule schema and admin seed
- [x] Calculation service
- [x] Crew/truck/hour recommendations
- [x] Surcharges and minimums
- [x] Confidence, assumptions, warnings
- [x] Estimate editor and review
- [x] Estimate persistence against a pricing rule version
- [ ] Add and remove estimate line items (overrides are amount-only today)
- [x] Calculation test matrix

## Epic 5 — Quotes

- [ ] Quote conversion service
- [ ] Line-item editor
- [ ] Totals validation
- [ ] Printable quote
- [ ] Status transitions
- [ ] Acceptance/rejection recording
- [ ] Expiration handling

## Epic 6 — Jobs

- [ ] Idempotent quote-to-job conversion
- [ ] Job list and detail
- [ ] Scheduling and arrival windows
- [ ] Crew/truck requirement fields
- [ ] Status transitions
- [ ] Upcoming schedule view

## Epic 7 — Dashboard

- [ ] KPI queries
- [ ] Conversion calculations
- [ ] Booked revenue
- [ ] Upcoming jobs
- [ ] Empty/error/loading states

## Epic 8 — Release hardening

- [ ] E2E happy path
- [x] Static migration security tests
- [ ] Negative authorization tests
- [ ] RLS verification
- [ ] Accessibility checks
- [ ] Error and logging review
- [ ] Production smoke test
- [ ] Documentation verification
