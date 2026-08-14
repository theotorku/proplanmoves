import { describe, expect, it } from "vitest";
import { canTransitionJob, isJobOnSchedule, isJobOpen, type JobStatus } from "./status";

describe("canTransitionJob", () => {
  it("walks the documented happy path", () => {
    const path: [JobStatus, JobStatus][] = [
      ["unscheduled", "scheduled"],
      ["scheduled", "confirmed"],
      ["confirmed", "in_progress"],
      ["in_progress", "completed"]
    ];

    for (const [currentStatus, nextStatus] of path) {
      expect(
        canTransitionJob({
          currentStatus,
          nextStatus,
          actorRoles: ["dispatcher"],
          hasSchedule: true
        })
      ).toEqual({ allowed: true });
    }
  });

  it("will not schedule a job that has no date", () => {
    expect(
      canTransitionJob({
        currentStatus: "unscheduled",
        nextStatus: "scheduled",
        actorRoles: ["dispatcher"],
        hasSchedule: false
      })
    ).toEqual({
      allowed: false,
      reason: "Give the job a date and arrival window before scheduling it."
    });
  });

  it("requires an owner or admin with a reason to complete a job that never started", () => {
    expect(
      canTransitionJob({
        currentStatus: "confirmed",
        nextStatus: "completed",
        actorRoles: ["dispatcher"],
        reason: "Crew forgot to start it in the app"
      })
    ).toEqual({
      allowed: false,
      reason: "Only an owner or admin can complete a job that was never started."
    });

    expect(
      canTransitionJob({
        currentStatus: "confirmed",
        nextStatus: "completed",
        actorRoles: ["admin"]
      })
    ).toEqual({
      allowed: false,
      reason: "Completing a job that was never started requires a reason."
    });

    expect(
      canTransitionJob({
        currentStatus: "confirmed",
        nextStatus: "completed",
        actorRoles: ["admin"],
        reason: "Crew forgot to start it in the app"
      })
    ).toEqual({ allowed: true });
  });

  it("completes a started job without ceremony", () => {
    expect(
      canTransitionJob({
        currentStatus: "in_progress",
        nextStatus: "completed",
        actorRoles: ["dispatcher"]
      })
    ).toEqual({ allowed: true });
  });

  it("requires a reason to cancel", () => {
    expect(
      canTransitionJob({
        currentStatus: "scheduled",
        nextStatus: "cancelled",
        actorRoles: ["dispatcher"]
      })
    ).toEqual({ allowed: false, reason: "Cancelling a job requires a reason." });

    expect(
      canTransitionJob({
        currentStatus: "scheduled",
        nextStatus: "cancelled",
        actorRoles: ["dispatcher"],
        reason: "Customer postponed"
      })
    ).toEqual({ allowed: true });
  });

  it("lets dispatch pull a job back off the calendar", () => {
    expect(
      canTransitionJob({
        currentStatus: "scheduled",
        nextStatus: "unscheduled",
        actorRoles: ["dispatcher"]
      })
    ).toEqual({ allowed: true });
    expect(
      canTransitionJob({
        currentStatus: "confirmed",
        nextStatus: "scheduled",
        actorRoles: ["dispatcher"],
        hasSchedule: true
      })
    ).toEqual({ allowed: true });
  });

  it("keeps completed and cancelled jobs final", () => {
    for (const status of ["completed", "cancelled"] as JobStatus[]) {
      expect(
        canTransitionJob({
          currentStatus: status,
          nextStatus: "scheduled",
          actorRoles: ["owner"],
          hasSchedule: true
        }).allowed
      ).toBe(false);
    }
  });

  it("keeps roles without dispatch rights out", () => {
    for (const role of ["estimator", "viewer"] as const) {
      expect(
        canTransitionJob({
          currentStatus: "unscheduled",
          nextStatus: "scheduled",
          actorRoles: [role],
          hasSchedule: true
        }).allowed
      ).toBe(false);
    }
  });
});

describe("job predicates", () => {
  it("counts every job before completion or cancellation as open", () => {
    expect(isJobOpen("unscheduled")).toBe(true);
    expect(isJobOpen("in_progress")).toBe(true);
    expect(isJobOpen("completed")).toBe(false);
    expect(isJobOpen("cancelled")).toBe(false);
  });

  it("puts dated work on the schedule board", () => {
    expect(isJobOnSchedule("scheduled")).toBe(true);
    expect(isJobOnSchedule("confirmed")).toBe(true);
    expect(isJobOnSchedule("in_progress")).toBe(true);
    expect(isJobOnSchedule("unscheduled")).toBe(false);
    expect(isJobOnSchedule("completed")).toBe(false);
  });
});
