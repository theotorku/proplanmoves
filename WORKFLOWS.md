# Workflows and State Machines

## Lead lifecycle

```text
new → contacting → qualified → estimate_pending → quote_pending → won
  ↘ unresponsive
  ↘ disqualified
  ↘ lost
```

Rules:
- `won` requires an accepted quote.
- `disqualified` requires a reason.
- `lost` requires a reason when a quote existed.
- Reopening a terminal lead requires owner/admin permission and an audit event.

## Estimate lifecycle

```text
draft → generated → under_review → approved
                    ↘ rejected
```

Rules:
- Only approved estimates can produce a normal quote.
- Manual quote creation without approval requires owner/admin override and reason.
- Recalculation creates a new estimate revision or records the exact changed values.

## Quote lifecycle

```text
draft → ready → sent → viewed → accepted
                     ↘ rejected
                     ↘ expired
                     ↘ cancelled
```

Rules:
- Only `ready` can become `sent`.
- Only `sent` or `viewed` can become `accepted` or `rejected`.
- Expiration is date-driven but must be recorded explicitly.
- Accepted quotes cannot be cancelled without owner/admin override.

## Job lifecycle

```text
unscheduled → scheduled → confirmed → in_progress → completed
                    ↘ cancelled
```

Rules:
- Creation requires an accepted quote.
- Completion requires a valid start path unless owner/admin override is recorded.
- Cancellation requires a reason.

## Public lead submission

1. Public customer submits `/quote-request`.
2. Server action discards honeypot submissions and enforces rate limits.
3. Server action validates the payload with Zod.
4. Server action normalizes email and phone.
5. Service-role server client calls `submit_public_lead_request(payload)`.
6. Database function finds or creates the customer in one transaction. A public
   dedupe match links the lead but does not rewrite the matched customer.
7. Database function creates origin and destination addresses.
8. Database function creates a lead with `new` status and generated reference.
9. Database function writes `lead.created` audit event.
10. Page returns confirmation reference without exposing customer or lead rows.

## Lead-to-estimate

1. Verify lead is qualified or privileged override exists.
2. Load active pricing rule version.
3. Compute recommendation.
4. Store estimate and line items.
5. Store assumptions and warnings.
6. Change lead to `estimate_pending`.
7. Write audit events.

## Admin lead qualification

1. Staff open `/admin/leads` and filter by status or lead reference.
2. Staff open a lead detail page.
3. Staff record notes or status changes from server actions.
4. Status changes are checked against the lead lifecycle rules.
5. Lost or disqualified transitions require a reason.
6. Each status change records a lead activity and audit event.
7. Reopening terminal leads requires owner/admin role.

## Quote-to-job

1. Verify quote is accepted and not already converted.
2. Create job in `unscheduled` or `scheduled` state.
3. Copy commercial and move facts as a historical snapshot.
4. Link job to source records.
5. Change lead to `won`.
6. Write job and lead audit events.
