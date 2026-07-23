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
- [ ] Add rate limiting

## Epic 3 — Admin leads

- [ ] Lead table with filters
- [ ] Lead detail page
- [ ] Status changes
- [ ] Assignment
- [ ] Notes
- [ ] Contact activities
- [ ] Lost/disqualified reasons
- [ ] Audit timeline

## Epic 4 — Estimation

- [ ] Pricing rule schema and admin seed
- [ ] Calculation service
- [ ] Crew/truck/hour recommendations
- [ ] Surcharges and minimums
- [ ] Confidence, assumptions, warnings
- [ ] Estimate editor and review
- [ ] Calculation test matrix

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
- [ ] Negative authorization tests
- [ ] RLS verification
- [ ] Accessibility checks
- [ ] Error and logging review
- [ ] Production smoke test
- [ ] Documentation verification
