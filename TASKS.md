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

- [x] Quote conversion service
- [x] Line-item editor
- [x] Totals validation
- [x] Printable quote
- [x] Status transitions
- [x] Acceptance/rejection recording
- [x] Expiration handling
- [ ] Scheduled sweep to expire overdue quotes without an operator

## Epic 6 — Jobs

- [x] Idempotent quote-to-job conversion
- [x] Job list and detail
- [x] Scheduling and arrival windows
- [x] Crew/truck requirement fields
- [x] Status transitions
- [x] Upcoming schedule view
- [ ] Crew assignment to named staff (crew size is a count today)

## Epic 7 — Dashboard

- [x] KPI queries
- [x] Conversion calculations
- [x] Booked revenue
- [x] Upcoming jobs
- [x] Empty/error/loading states

## Epic 8 — Release hardening

- [x] E2E happy path
- [x] Static migration security tests
- [x] Negative authorization tests
- [x] RLS verification
- [x] Accessibility checks
- [x] Error and logging review
- [x] Production smoke test script
- [x] Documentation verification
- [ ] Run the smoke test against the first real deployment
- [ ] Content Security Policy beyond frame-ancestors (needs a nonce strategy)
