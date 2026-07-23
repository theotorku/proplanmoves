# Observability

## Structured logs

Log events with:
- timestamp
- environment
- severity
- request/correlation ID
- authenticated actor ID when available
- operation name
- entity type and ID
- outcome
- duration
- error code

Do not log full personal data or secrets.

## Business events

Track:
- lead created
- lead assigned
- first contact recorded
- lead qualified/lost/disqualified
- estimate generated/approved
- quote sent/viewed/accepted/rejected/expired
- job created/scheduled/completed/cancelled

## Initial operational metrics

- lead submissions per day
- form failure rate
- median lead response time
- estimate-generation failure rate
- quote acceptance rate
- booked revenue
- upcoming jobs
- server error rate and latency

## Error handling

Every unexpected failure should have a correlation ID visible to operators and available in logs. User-facing messages should be safe and actionable without exposing implementation details.
