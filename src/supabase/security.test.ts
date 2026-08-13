import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");

function readMigration(name: string) {
  return readFileSync(join(migrationsDir, name), "utf8");
}

describe("Supabase security migrations", () => {
  it("enables RLS on operational tables", () => {
    const foundation = readMigration("0001_foundation.sql");

    for (const table of [
      "customers",
      "addresses",
      "leads",
      "estimates",
      "quotes",
      "jobs",
      "audit_events"
    ]) {
      expect(foundation).toContain(`alter table ${table} enable row level security;`);
    }
  });

  it("keeps public lead intake executable only by service_role", () => {
    const hardening = readMigration("0003_harden_public_lead_intake.sql");

    expect(hardening).toContain(
      "revoke all on function submit_public_lead_request(jsonb) from anon;"
    );
    expect(hardening).toContain(
      "revoke all on function submit_public_lead_request(jsonb) from authenticated;"
    );
    expect(hardening).toContain(
      "grant execute on function submit_public_lead_request(jsonb) to service_role;"
    );
  });

  it("does not update an existing customer from public dedupe matches", () => {
    const hardening = readMigration("0003_harden_public_lead_intake.sql");
    const foundBranch = hardening.slice(
      hardening.indexOf("if found then"),
      hardening.indexOf("else", hardening.indexOf("if found then"))
    );

    expect(foundBranch).not.toContain("update customers");
  });

  it("requires protected transactional mutation functions", () => {
    const adminLeads = readMigration("0004_admin_leads.sql");

    expect(adminLeads).toContain("revoke update on leads from authenticated;");
    expect(adminLeads).toContain("create or replace function transition_lead_status");
    expect(adminLeads).toContain("create or replace function bootstrap_initial_owner");
  });

  it("keeps lead assignment behind an authenticated-only definer function", () => {
    const assignment = readMigration("0005_lead_assignment.sql");

    expect(assignment).toContain("create or replace function assign_lead");
    expect(assignment).toContain("security definer");
    expect(assignment).toContain(
      "revoke all on function assign_lead(uuid, uuid, uuid) from public, anon;"
    );
    expect(assignment).toContain(
      "grant execute on function assign_lead(uuid, uuid, uuid) to authenticated;"
    );
    expect(assignment).toContain(
      "revoke all on function list_assignable_staff() from public, anon;"
    );
  });

  it("keeps estimate writes behind transactional functions", () => {
    const estimates = readMigration("0006_estimates.sql");
    const review = readMigration("0007_estimate_review.sql");

    expect(estimates).toContain(
      "revoke insert, update on estimates, estimate_line_items from authenticated;"
    );
    expect(estimates).toContain("create or replace function create_estimate_from_calculation");
    expect(estimates).toContain(
      "revoke all on function create_estimate_from_calculation(uuid, uuid, jsonb)"
    );
    expect(review).toContain("create or replace function review_estimate");
    expect(review).toContain("create or replace function update_estimate_line_item");
    expect(review).toContain(
      "revoke all on function update_estimate_line_item(uuid, numeric, integer)"
    );
  });
});
