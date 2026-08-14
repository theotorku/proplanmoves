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
- Owner, admin, and estimator can prepare and submit; only owner and admin can
  approve or reject, and a rejection requires a reason.
- A rejected estimate can be reworked and resubmitted. An approved one is final.
- Line-item overrides are allowed until the review decision, and each one
  recomputes the estimate total from the stored lines.

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
- Expiration is date-driven but must be recorded explicitly: the transition is
  refused until the quote is actually past its valid-until date.
- Accepted quotes cannot be cancelled without owner/admin override and a reason.
- A quote is editable while `draft` or `ready`. Once sent, its numbers are what
  the customer is looking at, so changes mean issuing a new quote.
- Recording a rejection requires a reason. The lead stays open so it can be
  re-quoted; losing it is a separate decision.
- An estimate can have only one live quote at a time.

## Job lifecycle

```text
unscheduled → scheduled → confirmed → in_progress → completed
                    ↘ cancelled
```

Rules:
- Creation requires an accepted quote.
- Completion requires a valid start path unless owner/admin override is recorded.
  Completing a job that was never `in_progress` takes an owner or admin and a
  reason.
- Cancellation requires a reason.
- Scheduling requires a date and both ends of an arrival window.
- Changing the date or window of a `confirmed` job returns it to `scheduled`,
  because the customer confirmed the old window.
- Unscheduling clears the date and window.
- Jobs belong to dispatch: owner, admin, and dispatcher.

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
2. Load active pricing rule version and validate its rules document.
3. Compute the recommendation deterministically from the lead facts and that
   version: crew, trucks, billable minutes, line items, range, confidence,
   assumptions, and warnings.
4. Store estimate and line items in one transaction, re-checking in the
   database that the lead is qualified, the pricing version is still current,
   and the line items add up to the stored total.
5. Store assumptions and warnings.
6. Change lead to `estimate_pending`.
7. Write audit events.
8. A refused calculation writes nothing: no estimate, no line items, and no
   lead transition.

## Admin lead qualification

1. Staff open `/admin/leads` and filter by status or lead reference.
2. Staff open a lead detail page.
3. Staff record notes or status changes from server actions.
4. Status changes are checked against the lead lifecycle rules.
5. Lost or disqualified transitions require a reason.
6. Each status change records a lead activity and audit event.
7. Reopening terminal leads requires owner/admin role.

## Lead assignment

1. Staff filter the queue by owner, including an unassigned bucket.
2. Owners and admins assign any lead to any active operational staff member.
3. Estimators claim an unassigned lead or release one they already own.
4. The server action submits the assignment it displayed; a changed owner is
   rejected as stale rather than overwritten.
5. The assignee must be active and hold an operational role.
6. Each assignment change records a lead activity and audit event.

## Estimate-to-quote

1. Verify the estimate is approved and has no live quote.
2. Copy its line items onto a new draft quote; the caller supplies no amounts.
3. Derive the subtotal and total from the copied lines.
4. Default the valid-until date to 14 days out.
5. Change lead to `quote_pending`.
6. Write quote activity and audit events.

## Quote-to-job

1. Verify quote is accepted. A quote that is already converted returns its
   existing job rather than creating a second one.
2. Create job in `unscheduled` or `scheduled` state.
3. Copy commercial and move facts as a historical snapshot: crew, trucks,
   duration, booked value, and both addresses.
4. Link job to source records.
5. Change lead to `won`.
6. Write job and lead audit events.
