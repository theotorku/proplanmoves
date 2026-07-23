# Deterministic Estimation Engine

## Principle

The engine produces a preliminary operational recommendation and price range. It does not autonomously establish the final customer price.

## Inputs

- Move type
- Bedroom count or office-size proxy
- Origin and destination access
- Elevator availability
- Floors/stairs
- Estimated boxes
- Packing requirement
- Specialty items
- Travel time or distance
- Requested date/day type
- Configured pricing-rule version

## Outputs

- Suggested crew size
- Suggested truck count
- Estimated labor hours
- Travel allowance
- Line items
- Low/high price range
- Confidence level
- Assumptions
- Warnings

## Baseline model

The first implementation should use transparent lookup tables and additive adjustments.

Example sequence:

1. Determine base labor hours from move type and size.
2. Determine crew size and truck count from size thresholds.
3. Add origin/destination access adjustments.
4. Add packing labor/material allowance.
5. Add specialty item allowances.
6. Apply minimum billable hours.
7. Calculate hourly labor subtotal.
8. Add travel/truck/fuel/date adjustments.
9. Produce low/high range using configurable uncertainty margins.

## Required configurable rules

- Hourly rates by crew size
- Minimum billable hours
- Base hours by bedroom count/move type
- Truck fee
- Travel fee calculation
- Stair adjustment
- Packing labor rate
- Box/material allowance
- Specialty-item surcharge matrix
- Weekend and peak-date adjustment
- Fuel surcharge
- Uncertainty margin

## Confidence

Suggested levels:

- `high`: complete details, ordinary access, no unresolved specialty items
- `medium`: one or two assumptions materially affect labor
- `low`: incomplete inventory, unknown access, unusual item, or uncertain travel input

## Warnings

Examples:

- piano or safe requires manual review
- origin/destination floor unknown
- elevator reservation not confirmed
- box estimate missing
- requested date may be peak demand
- route distance unavailable

## Calculation integrity

- Use decimal-safe arithmetic or integer cents.
- Store every line item and rule version.
- Recompute totals on the server.
- Reject mismatched client-submitted totals.
- Unit tests must cover each rule and interaction.
