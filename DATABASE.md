# Database Design

## Core principles

- UUID primary keys
- Separate human-readable references
- Integer cents for money
- Normalized phone and email for deduplication
- Foreign keys and check constraints for invariants
- Immutable audit history
- Soft deletion only where business records should remain recoverable

## Tables

### profiles

`id`, `full_name`, `phone`, `is_active`, timestamps. The `id` references the Supabase auth user.

### roles

`id`, `code`, `name`.

### profile_roles

`profile_id`, `role_id`, unique pair.

Initial role codes: `owner`, `admin`, `estimator`, `dispatcher`, `viewer`.

### customers

`id`, `reference`, `first_name`, `last_name`, `email`, `email_normalized`, `phone`, `phone_normalized`, `preferred_contact_method`, `marketing_consent`, timestamps, `deleted_at`.

Constraints:
- at least one of email or phone is present
- partial unique indexes on normalized email and normalized phone where non-null

### addresses

`id`, customer ownership where relevant, address lines, city, state, postal code, access notes, latitude/longitude placeholders, timestamps.

### leads

`id`, `reference`, `customer_id`, `status`, `move_type`, origin/destination address IDs, requested/flexible date fields, property/access fields, service flags, specialty items JSONB, box estimate, notes, lead source, assigned profile, lost reason, timestamps.

### lead_notes

`id`, `lead_id`, `author_id`, `body`, timestamps.

### lead_activities

`id`, `lead_id`, `activity_type`, `outcome`, `occurred_at`, `created_by`, metadata JSONB.

### pricing_rules

Logical rule set identity: `id`, `name`, `is_active`, timestamps.

### pricing_rule_versions

`id`, `pricing_rule_id`, `version_number`, effective dates, `rules_json`, `created_by`, timestamps. Once referenced by an estimate, a version is immutable.

### estimates

`id`, `reference`, `lead_id`, `customer_id`, `pricing_rule_version_id`, `status`, crew/truck/hour recommendations, travel allowance, low/high totals in cents, confidence, assumptions JSONB, warnings JSONB, review metadata, timestamps.

### estimate_line_items

`id`, `estimate_id`, `code`, description, quantity numeric, unit, unit amount cents, total amount cents, category, sort order.

### quotes

`id`, `reference`, `estimate_id`, `lead_id`, `customer_id`, `status`, subtotal/discount/tax/total/deposit cents, currency, expiration date, terms version, customer notes, internal notes, sent/viewed/accepted/rejected timestamps, timestamps.

### quote_line_items

Same monetary structure as estimate line items, plus optional source estimate-line-item ID.

### jobs

`id`, `reference`, related customer/lead/estimate/quote IDs, status, scheduled date, arrival window, origin/destination addresses, crew/truck requirements, estimated duration minutes, estimated revenue cents, operational/customer notes, timestamps.

### crews

`id`, `name`, `is_active`, timestamps.

### crew_members

`id`, `crew_id`, optional profile linkage, display name, role, active flag, timestamps.

### trucks

`id`, `unit_number`, name, capacity class, active flag, timestamps.

### job_assignments

`id`, `job_id`, optional crew/truck/profile IDs, assignment type, timestamps.

### audit_events

`id`, actor profile ID, entity type, entity ID, event type, previous values JSONB, new values JSONB, request correlation ID, timestamp.

## Required indexes

- lead status, created date, move date, source, assigned user
- quote status, expiration date, accepted date
- job status, scheduled date
- customer normalized email and phone
- audit entity type/entity ID/timestamp

## Reference generation

Use a database-backed sequence or transaction-safe counter per entity/year. Formats:

- `LEAD-YYYY-00001`
- `EST-YYYY-00001`
- `QUO-YYYY-00001`
- `JOB-YYYY-00001`

Do not generate these by counting rows.

## Migration requirements

Every schema change must be represented by an ordered migration. Migrations must include RLS enablement, policies, indexes, constraints, and rollback notes where destructive changes are unavoidable.
