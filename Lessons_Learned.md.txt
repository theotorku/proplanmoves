# LESSONS_LEARNED.md

> "Every move teaches the platform."

---

# Purpose

This document captures operational knowledge gained from running ProPlan Moves.

Unlike the Architecture Decision Log (ADR), which records engineering decisions, this document records what the business itself has taught us.

Its purpose is to:

- Improve operations
- Improve customer experience
- Improve pricing
- Improve AI recommendations
- Improve future ProPlan OS products

Every lesson should result in either:

- a product improvement
- a process improvement
- a documentation update
- a new feature
- a feature removal

---

# Lesson Format

## LL-XXXX

### Date

### Category

Examples

- Sales
- Marketing
- Dispatch
- Estimating
- Customer Service
- Crew
- Finance
- Software
- AI
- Operations

### Observation

What happened?

### Evidence

Data supporting the observation.

Examples

- CRM
- Customer interviews
- Analytics
- Revenue reports
- Crew feedback
- Support tickets

### Root Cause

Why did this happen?

### Action Taken

What changed?

### Result

What happened after the change?

### Product Impact

Which ProPlan OS module should improve?

### Status

Open

Testing

Implemented

Validated

Archived

---

# LL-0001

## Customers Want Speed More Than Perfect Quotes

Date

2026-07-22

Category

Sales

Observation

Customers prefer receiving a preliminary estimate within minutes instead of waiting hours for a perfectly detailed quote.

Evidence

Initial customer interviews and industry research indicate that response time strongly influences booking decisions.

Root Cause

Customers are often contacting several moving companies simultaneously.

The first credible response gains an advantage.

Action

Build deterministic preliminary estimates immediately after lead submission.

Allow staff review before final pricing.

Product Impact

Estimate Engine

CRM

Customer Portal

Status

Accepted

---

# LL-0002

## Operational Data Is More Valuable Than Assumptions

Category

AI

Observation

Real completed jobs provide better training data than hypothetical pricing spreadsheets.

Evidence

Every completed move captures:

- actual labor
- travel time
- profit
- customer satisfaction
- crew utilization

Root Cause

Actual operations reveal patterns that planning cannot.

Action

Capture structured operational data for every completed job.

Product Impact

Analytics

AI Models

Pricing Engine

Executive Dashboard

Status

Accepted

---

# LL-0003

## Simplicity Wins

Category

Software

Observation

Dispatchers prefer one screen showing today's work instead of navigating multiple dashboards.

Evidence

Field-service software consistently rewards low-friction workflows.

Root Cause

Dispatchers make rapid operational decisions.

Action

Prioritize a unified operations dashboard.

Product Impact

Dispatch

UI

Operations

Status

Accepted

---

# LL-0004

## Every Manual Step Is Automation Debt

Category

Operations

Observation

If staff repeatedly perform the same task, the platform should eventually automate or simplify it.

Examples

Repeated follow-up emails

Repeated estimate formatting

Repeated customer reminders

Repeated status updates

Action

Track repetitive workflows and evaluate them for automation.

Status

Ongoing

---

# LL-0005

## AI Must Earn Trust

Category

AI

Observation

Users are more likely to trust AI that explains its recommendations.

Action

Every AI recommendation should include:

- confidence
- reasoning
- supporting data
- editable output

Status

Accepted

---

# Metrics to Monitor

Every month review:

Sales

- Quote response time
- Close rate
- Revenue
- Referral rate

Operations

- Jobs completed
- Crew utilization
- Truck utilization
- Average move duration

Finance

- Gross margin
- Profit per move
- Outstanding invoices

Customer Experience

- Review score
- NPS
- Complaint rate
- Repeat customers

AI

- Recommendation acceptance
- Time saved
- Manual overrides
- AI confidence
- AI error rate

---

# Monthly Review Questions

What surprised us?

What frustrated customers?

What frustrated employees?

What created unnecessary work?

What feature saved the most time?

What feature was ignored?

Which workflow should disappear?

What should AI do next?

What should humans always control?

---

# Quarterly Product Review

Every quarter ask:

If we started over today...

Would we build this feature again?

Would customers pay for it?

Should it become part of ProPlan OS?

Can another industry use it?

Can AI improve it?

Should it be removed?

---

# Knowledge Flywheel

Every completed move

↓

New operational data

↓

Business insight

↓

Document lesson

↓

Improve workflow

↓

Improve software

↓

Improve AI

↓

Better customer experience

↓

More completed moves

↓

Repeat

---

# Final Principle

The codebase records what we built.

The decision log records why we built it.

The lessons learned record what reality taught us.

Together, they ensure ProPlan Moves continuously improves through experience rather than assumptions.