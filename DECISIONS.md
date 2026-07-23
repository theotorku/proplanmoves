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
