# Security and Privacy

## Threat model

Protect customer personal information, operational records, pricing controls, and privileged actions from unauthorized access, data leakage, tampering, and accidental exposure.

## Authentication

Use Supabase Auth. Public quote submission is anonymous but rate-limited. All administrative actions require an authenticated user.

## Authorization

Roles:

- Owner: full control
- Admin: broad operational control except ownership/security-critical settings
- Estimator: leads, customers, estimates, quotes
- Dispatcher: customers, accepted quotes, jobs, assignments
- Viewer: read-only permitted records

Authorization must be enforced in:

1. application/server policy checks
2. Supabase Row-Level Security
3. database constraints where applicable

## RLS requirements

- Enable RLS on every operational table.
- Deny by default.
- Public lead intake uses a server action and service-role RPC; anonymous users
  do not receive direct table access.
- Public role must not select inserted customer or lead records.
- Authenticated users receive only permissions required by role.
- Authenticated clients cannot update leads directly; lifecycle mutations run
  through role-checking transactional functions.
- Public rate-limit state and its mutation function are service-role-only.
- Initial owner bootstrap is service-role-only, serialized, and atomic.
- Audit events are append-only to authorized server paths and read-limited.

## Sensitive data

Treat names, phones, emails, addresses, notes, and move dates as sensitive personal data.

Controls:
- Do not log full request payloads.
- Mask contact details in non-production logs where practical.
- Avoid exposing sequential database IDs.
- Do not include private notes in customer-facing documents.
- Define retention and deletion procedures before public launch.

## Input protection

- Zod validation
- length limits
- allow-listed enum values
- server-side sanitation where rendered as rich text
- file uploads deferred until malware scanning and content restrictions are designed

## Abuse prevention

- Rate-limit public intake through a shared PostgreSQL counter before the
  service-role persistence path is called. Hash the platform-derived client
  fingerprint before storage.
- Use an accessible honeypot field on public intake to discard basic bot
  submissions before persistence.
- Add managed bot protection after observing abuse; preserve accessibility.
- Detect repeated duplicate submissions.
- Enforce request body limits.

## Secrets

- Use environment variables and platform secret stores.
- Never expose Supabase service-role credentials to the browser.
- Rotate compromised credentials immediately.

## Audit

Record privileged changes, lifecycle transitions, pricing changes, quote acceptance, job scheduling, and role changes.

## Security release gate

Before deployment:
- test anonymous access against every table
- test each role against expected actions
- verify service-role key is server-only
- inspect generated client bundles for secrets
- run dependency and static checks
