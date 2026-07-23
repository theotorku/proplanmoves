# AGENTS.md — Codex Execution Contract

## Mission

Implement ProPlan Moves OS as a production-capable operational core. Prioritize a complete, tested workflow over broad feature coverage.

## Non-negotiable workflow

1. Public customer submits a quote request.
2. The request creates or links a customer and creates a lead.
3. Staff qualify the lead.
4. Staff generate and review a deterministic estimate.
5. Staff create and mark a quote as sent.
6. Staff record acceptance.
7. Staff create and schedule a job.
8. Dashboard KPIs update from live data.

## Working method

- Inspect the repository before changing it.
- Preserve useful existing code.
- Work in vertical slices.
- Keep the application runnable after each milestone.
- Run relevant tests after each material change.
- Record architecture choices in `DECISIONS.md`.
- Update documentation when behavior changes.
- Do not stop after producing plans; implement working software.

## Priority order

1. Data integrity and authorization
2. Critical workflow correctness
3. Deterministic estimation accuracy
4. Clear operator UX
5. Tests and observability
6. Visual polish
7. Optional automation

## Prohibited shortcuts

- No mock data in production paths.
- No client-only authorization.
- No scattered pricing formulas.
- No LLM-generated final pricing.
- No silent failures.
- No committed secrets.
- No broad refactor without a concrete need.
- No speculative microservices.
- No interstate-move claims or regulated workflows in v1.

## Required checkpoints

### Checkpoint 1 — Foundation

Report:
- proposed directory structure
- schema summary
- role model
- RLS approach
- implementation risks

Then implement authentication, migrations, seed data, CI, and the application shell.

### Checkpoint 2 — Lead intake

Demonstrate:
- valid public submission
- validation failure behavior
- customer deduplication
- lead visible in admin
- audit event emitted

### Checkpoint 3 — Estimation

Demonstrate:
- versioned pricing rules
- calculation tests
- assumptions and warnings
- editable reviewed estimate

### Checkpoint 4 — Quote to job

Demonstrate:
- quote creation
- valid state transitions
- printable quote
- acceptance recording
- scheduled job creation

### Checkpoint 5 — Release readiness

Report:
- test results
- security/RLS verification
- environment requirements
- deployment steps
- known limitations

## Implementation conventions

- Strict TypeScript.
- Zod validation at trust boundaries.
- Domain logic outside React components.
- Server-side authorization for every protected action.
- Database constraints for critical invariants.
- UUID primary keys; separate human-readable references.
- UTC storage; explicit business timezone presentation.
- Money stored as integer cents.
- Distances stored in miles using numeric precision appropriate to routing inputs.
- Immutable pricing rule versions once used by an estimate.

## Completion behavior

At the end of each milestone:

1. Run lint, type checks, tests, and build.
2. Fix failures attributable to the milestone.
3. Summarize files changed.
4. State verified behavior.
5. State remaining risks and next task.
