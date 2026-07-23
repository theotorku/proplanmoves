# Architecture

## Architectural style

Use a modular monolith deployed as one Next.js application with Supabase as the system of record. This minimizes operational overhead while preserving domain boundaries for later extraction.

## Logical layers

```text
Public UI / Admin UI
        ↓
Server Actions / Route Handlers
        ↓
Application Services
        ↓
Domain Rules and Policies
        ↓
Data Access Layer
        ↓
Supabase PostgreSQL / Auth / Storage
```

## Domain modules

```text
src/
  app/
  components/
  domains/
    auth/
    customers/
    leads/
    estimating/
    quotes/
    jobs/
    dashboard/
    audit/
  lib/
    db/
    validation/
    money/
    dates/
    logging/
  supabase/
    migrations/
    seed.sql
```

Each domain should contain its schemas, policies, services, repository functions, and tests. UI components may call application-layer actions but must not contain pricing or lifecycle rules.

## Request flow

1. Validate input with Zod.
2. Authenticate where required.
3. Authorize action using server-side role/policy checks.
4. Execute domain service in a database transaction when multiple records change.
5. Write audit event.
6. Return typed result or explicit error.
7. Revalidate affected pages or queries.

## Integration boundaries

Define interfaces for future providers:

- `NotificationProvider`
- `DistanceProvider`
- `DocumentRenderer`
- `PaymentProvider`
- `AIEnrichmentProvider`

Use no-op or local implementations only where the core workflow does not depend on external delivery.

## Data ownership

PostgreSQL is authoritative for all operational records. UI state, generated summaries, caches, and external provider metadata must never become the only source of truth.

## Transaction boundaries

Use transactions for:

- customer upsert plus lead creation
- estimate plus line-item creation
- quote plus line-item creation
- quote acceptance plus audit event
- quote-to-job conversion

## Time and money

- Store timestamps in UTC.
- Present using the configured business timezone.
- Store money as integer cents and currency code.
- Never use floating point for monetary totals.

## Error model

Return typed errors such as:

- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `INVALID_TRANSITION`
- `CONFLICT`
- `CALCULATION_ERROR`
- `INTERNAL_ERROR`

Log internal context without exposing secrets or sensitive personal information to clients.
