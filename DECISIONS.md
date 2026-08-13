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
