# Architecture Decision Records

## ADR-001 — Modular monolith

**Decision:** Build one Next.js application with domain modules.  
**Reason:** Fast delivery, simple deployment, transactional consistency, and lower operating complexity.  
**Revisit when:** Independent scaling, separate teams, or integration boundaries justify service extraction.

## ADR-002 — Supabase as system of record

**Decision:** Use Supabase PostgreSQL, Auth, Storage, and RLS.  
**Reason:** Aligns with existing ProPlan stack preferences and provides a fast production foundation.  
**Consequence:** RLS design and migration discipline are mandatory.

## ADR-003 — Deterministic estimation

**Decision:** Pricing recommendations are rules-based and versioned.  
**Reason:** Auditability, reproducibility, safety, and operator trust.  
**Consequence:** AI may explain or enrich estimates but cannot set final price.

## ADR-004 — Server-side domain logic

**Decision:** Business logic lives in application/domain services, not UI components.  
**Reason:** Testability and reuse.

## ADR-005 — Integer-cents money model

**Decision:** Store monetary amounts as integer cents.  
**Reason:** Avoid floating-point errors and preserve exact totals.

## ADR-006 — Single-company before multi-tenant

**Decision:** v0.1 serves ProPlan Moves only.  
**Reason:** Validate the workflow before adding tenant isolation and SaaS administration.  
**Revisit when:** The internal system is stable and at least one external mover is ready to pilot.

## ADR-007 — Checkpoint 1 foundation scope

**Decision:** Start with a single Next.js App Router application, lazy Supabase server clients, strict environment validation, an ordered Supabase migration, seed data, and CI checks.  
**Reason:** This satisfies the foundation requirements while preserving the documented modular-monolith direction.  
**Consequence:** Public intake and owner bootstrap remain explicit follow-on slices rather than being hidden behind placeholder production paths.

## ADR-008 — Public intake transaction boundary

**Decision:** Public quote requests are validated in a Next.js server action and persisted through a service-role-only PostgreSQL RPC.  
**Reason:** Customer deduplication, address creation, lead creation, reference generation, and audit emission must succeed or fail together.  
**Consequence:** Anonymous users do not receive direct table permissions; rate limiting remains a separate server-edge concern before launch.

## ADR-009 — Public intake abuse controls

**Decision:** Add a server-side rate limiter and honeypot before the service-role RPC, and avoid mutating existing customers on public dedupe matches.  
**Reason:** The public form is unauthenticated and must not allow spam amplification through the service-role key or customer record tampering by contact-knowledge alone.  
**Consequence:** Rate-limit counters are stored and incremented atomically in PostgreSQL through a service-role-only RPC. Client identifiers are SHA-256 hashed before persistence, and only platform-controlled forwarding headers are accepted.

## ADR-010 — Admin lead operations stay server-authorized

**Decision:** Lead status changes and notes are submitted through server actions that reload the authenticated user's database-backed roles before mutating records.  
**Reason:** Operator UX needs fast workflow controls, but lifecycle correctness and authorization cannot live only in React components.  
**Consequence:** Lead detail pages can render read-only for broad staff roles. Mutations execute through restricted transactional PostgreSQL functions, and direct lead updates are not granted to authenticated clients.

## ADR-011 — Database-enforced workflow identity

**Decision:** Enforce customer, lead, estimate, quote, job, and address lineage with composite foreign keys.  
**Reason:** Independent foreign keys prove that records exist but do not prove they belong to the same operational workflow.  
**Consequence:** Invalid cross-customer or cross-workflow combinations are rejected even if application authorization or validation regresses.

## ADR-012 — Immutable used pricing versions

**Decision:** A database trigger blocks updates and deletes of pricing rule versions once any estimate references them.  
**Reason:** Historical estimates must remain reproducible and auditable.  
**Consequence:** Pricing changes require a new version; unused draft versions may still be corrected.

## ADR-013 — Supabase-native local verification

**Decision:** Keep migrations, seed data, configuration, and pgTAP tests in the standard project-root `supabase/` layout and pin the CLI version.  
**Reason:** The schema must be recreated and tested locally before it is applied to a hosted project.  
**Consequence:** CI runs a local Supabase stack, resets it from migrations, and executes database integrity and privilege tests before application E2E/build checks.

## ADR-014 — Lead ownership is queue-scoped

**Decision:** Owners and admins assign any lead to any operational staff member. Estimators may only claim an unassigned lead or release one they already own, and assignment runs through the same transactional definer-function pattern as status changes.  
**Reason:** Assignment decides who works a lead, so silently taking a teammate's work is a coordination failure, and the activity plus audit trail must move with the row.  
**Consequence:** `assign_lead` re-checks the expected assignee and rejects stale writes. `list_assignable_staff` exposes only active staff holding an operational role, so viewer accounts never appear as owners.

## ADR-015 — Pricing rule versions carry a validated document

**Decision:** `pricing_rule_versions.rules_json` is parsed against a strict Zod schema before any calculation, and the seeded active version is asserted against the same schema in tests.  
**Reason:** Versions become immutable once an estimate references them (ADR-012), so a malformed or partial document must be rejected before it can be used and frozen.  
**Consequence:** Adding a pricing input means changing the schema, the seed, and the calculation together. The calculation service reads no clock and no environment, so the same lead and version always produce the same estimate.

## ADR-016 — Estimates are priced in the application and created only by the server

**Decision:** TypeScript computes the estimate, and `create_estimate_from_calculation` is executable only by the service role. The server action authorizes the staff member, derives the payload from the calculation service, and passes the actor explicitly; the database re-checks that the actor may create estimates, the lead is qualified, the pricing version is still current, and the line items add up to the stored total.  
**Reason:** Pricing logic belongs in a testable domain service (ADR-004). While the RPC was callable by any authenticated estimator, a staff member could post internally consistent but arbitrary amounts straight to the Data API and attach them to a pricing version, so "priced by version X" was a claim the data could not support.  
**Consequence:** The deterministic calculation is the only way an estimate comes into existence. A refused calculation writes nothing at all — no estimate, no line items, no lead transition. Because the service role has no `auth.uid()`, this function writes its own lead transition rather than delegating to `transition_lead_status`.

## ADR-017 — Estimate approval is a separate pair of hands

**Decision:** An estimator prepares an estimate and submits it for review; only an owner or admin approves or rejects it, and a rejection needs a reason. Approved and rejected estimates are frozen — a new estimate supersedes them.  
**Reason:** The price is the commercial commitment, so the person who produced it should not be the only person who accepts it.  
**Consequence:** Overrides are allowed while an estimate is draft, generated, or under review, and each one is audited with its previous and new amounts. An overridden estimate is flagged with `has_manual_adjustment`, so a total that no longer follows from the pricing rules says so. Reworking a rejected estimate means resubmitting it for review.

## ADR-018 — No direct client writes to workflow records

**Decision:** `authenticated` holds read grants on operational tables but no insert or update grant on leads, estimates, estimate line items, quotes, quote line items, jobs, or audit events. Every lifecycle mutation goes through a transactional definer function.  
**Reason:** RLS decides which rows a role may touch, not which column combinations are coherent. With direct grants, a client could mark a quote accepted or a job scheduled without the controlled transition, the acceptance record, or the audit event — and could write audit rows that never happened.  
**Consequence:** Each new workflow stage ships with its own RPC before its UI. The grants were removed ahead of the quote and job work so no client path can predate the transactional one.

## ADR-019 — Quote money is derived, quote terms are entered

**Decision:** A quote's subtotal and total are always recomputed from its stored line items by an internal function no client can call. Discount, tax, deposit, and validity are entered by staff and validated against that subtotal. Conversion copies an approved estimate, so the caller supplies no amounts and can run as a normal staff member rather than the service role.  
**Reason:** The distinction that matters is whether the caller supplies money. Estimate creation had to move to the server because the payload *was* the price (ADR-016); quote conversion derives everything it stores, so the same protection comes free.  
**Consequence:** Removing or reducing a line clamps the discount and deposit so the table's arithmetic and deposit constraints keep holding. A quote stops being editable once it is sent, since its numbers are what the customer is looking at.

## ADR-020 — Acceptance records the customer's answer; the job closes the lead

**Decision:** Accepting a quote timestamps the acceptance and records the decision on the quote alone. The lead becomes `won` during quote-to-job conversion, not at acceptance. A rejected quote likewise leaves the lead open.  
**Reason:** This is what WORKFLOWS.md specifies, and it matches how the work actually goes: a customer saying yes is not the same event as the company committing a crew, and a rejected price often becomes a revised one rather than a lost customer.  
**Consequence:** A rejection needs a reason for the record, but losing the lead stays an explicit, separate decision with its own reason.

## ADR-021 — Conversion is idempotent and jobs are a snapshot

**Decision:** `create_job_from_quote` returns the existing job when one already exists for the quote instead of failing or creating a second, and it copies crew, trucks, duration, revenue, and addresses onto the job rather than reading them through the quote at display time.  
**Reason:** Booking is the step most likely to be double-submitted — a slow request, a second dispatcher, a retried action — and a unique constraint alone turns that into an error the operator has to interpret. Dispatch also needs a stable record of what was sold: a later estimate revision must not silently change what the crew was told.  
**Consequence:** Callers check `created` to tell a booking from a no-op. Job requirements are edited on the job, so dispatch can send four movers on a three-mover quote without altering the customer's price.

## ADR-022 — Booking closes the lead, and dispatch owns jobs

**Decision:** Jobs are read and written by owner, admin, and dispatcher; estimators have no access. Moving the lead to `won` happens inside job creation rather than through `transition_lead_status`.  
**Reason:** WORKFLOWS.md puts the lead's close at the conversion step, but lead transitions are an estimator/manager action a dispatcher cannot perform. Delegating would have forced dispatchers into lead-editing rights they should not have.  
**Consequence:** The lead move is written inside the conversion with the same activity and audit records the shared function would have produced. Marking a job complete that was never started is an owner/admin correction with a reason, since it contradicts the recorded history.

## ADR-023 — Cancellation unwinds in dispatch order

**Decision:** A quote cannot be cancelled while a job exists for it that is not cancelled. The database refuses with `JOB_EXISTS` and names the job; the quote page hides the control and says why. Cancelling the job first, then the quote, is the supported order.  
**Reason:** Cancelling the commercial record while a crew is still committed produces a cancelled quote and a scheduled job at the same time — the two halves of the business disagreeing about whether the work is happening. Silently cancelling the job from the quote page would fix the data by overwriting dispatch's record from outside dispatch, which ADR-022 exists to prevent.  
**Consequence:** Unwinding a booked move takes two deliberate steps, each with its own reason and audit event. The lead stays `won` afterwards: it was won, and whether a cancelled move becomes a lost lead or a rebooking is a judgement an operator makes explicitly.

## ADR-024 — Work cannot be dated into the past by accident

**Decision:** `create_job_from_quote` and `schedule_job` refuse a date before today. Owners and admins may override, and the audit event records `backdated: true`. The date picker enforces the same floor for everyone who cannot override.  
**Reason:** The upcoming board only shows work from today onward, so a mistyped year silently removes a real move from the schedule everyone works from. Backfilling a historical job is a genuine need, so it is allowed but attributable.  
**Consequence:** Dispatchers cannot create the failure mode at all. A backdated job is traceable to the manager who recorded it.
