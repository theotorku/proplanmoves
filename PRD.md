# Product Requirements Document

## Product

**Name:** ProPlan Moves OS  
**Release:** Operational Core v0.1  
**Primary user:** Owner/operator of ProPlan Moves  
**Secondary users:** Admin, estimator, dispatcher, viewer

## Problem

A dormant moving company needs a coherent operating system that captures demand, standardizes estimating, improves follow-up, converts accepted work into scheduled jobs, and produces reliable operating data. Existing field-service systems are often generic, expensive, or poorly aligned with a mover's sales-to-dispatch workflow.

## Product thesis

A narrow, trustworthy workflow creates more value than a broad but fragmented platform. The first version must make every inbound opportunity visible and move it through a controlled commercial and operational lifecycle.

## Goals

- Capture every structured web lead.
- Respond operationally without relying on spreadsheets.
- Standardize preliminary estimates using explicit rules.
- Produce professional, reviewable quotes.
- Convert accepted quotes into scheduled jobs.
- Give the owner live pipeline and booking visibility.
- Create a reusable foundation for later ProPlan Solutions modules.

## Non-goals

- Autonomous final pricing
- Interstate household-goods compliance
- Route optimization
- Live GPS tracking
- Payroll processing
- Full accounting
- Damage-claim adjudication
- Native mobile applications
- Marketplace functionality
- Multi-tenant SaaS administration

## Personas

### Owner

Needs pipeline, conversion, revenue, schedule, accountability, and configuration control.

### Estimator

Needs complete move details, deterministic recommendations, assumptions, editable line items, and quote generation.

### Dispatcher

Needs accepted work converted into accurate jobs with dates, arrival windows, crew/truck requirements, and notes.

### Viewer

Needs read-only operational visibility without permission to change records.

### Prospective customer

Needs a fast, trustworthy request experience and clear confirmation.

## Functional requirements

### Public intake

Capture customer identity, contact preference, move type, addresses, dates, property characteristics, access constraints, services, specialty items, boxes, notes, source, and marketing consent.

Acceptance criteria:
- Required fields are validated server-side.
- Submission creates a unique lead reference.
- Customer is deduplicated by normalized email and/or phone.
- User receives a clear confirmation.
- Internal users can see the lead immediately.

### Lead management

Operators can search, filter, assign, annotate, record contact attempts, change status, and convert a qualified lead into an estimate.

### Estimating

The system recommends crew size, truck count, labor hours, travel allowance, surcharges, price range, confidence, assumptions, and warnings from versioned deterministic rules.

### Quotes

Operators can create, edit, preview, send-status, accept, reject, expire, or cancel quotes. Quote totals must be reproducible from stored line items.

### Jobs

Accepted quotes can become jobs with schedule, arrival window, operational requirements, notes, and status.

### Dashboard

Show live counts and values for new leads, pending contact, estimates, quotes, accepted quotes, upcoming jobs, booked revenue, and conversion rate.

## Business rules

- Final quote creation requires a reviewed estimate or an explicit manual override recorded in audit history.
- A job cannot be created from a rejected, expired, or cancelled quote.
- A job scheduled date cannot precede the current business date without privileged override.
- Quote line items and totals use integer cents.
- Estimates preserve the pricing-rule version used.
- Accepted quotes become immutable except through a controlled amendment flow; v0.1 may restrict editing entirely after acceptance.

## Key metrics

- Median lead response time
- Lead-to-qualified conversion
- Qualified-to-quote conversion
- Quote acceptance rate
- Average booked revenue
- Days from lead to booked job
- Upcoming job count
- Lost lead reason distribution

## Release acceptance

See `DEFINITION_OF_DONE.md`.
