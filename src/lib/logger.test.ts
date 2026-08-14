import { afterEach, describe, expect, it, vi } from "vitest";
import { describeError, logger } from "./logger";

const originalLevel = process.env.LOG_LEVEL;

afterEach(() => {
  process.env.LOG_LEVEL = originalLevel;
  vi.restoreAllMocks();
});

function captureConsole(method: "log" | "warn" | "error") {
  return vi.spyOn(console, method).mockImplementation(() => undefined);
}

describe("logger", () => {
  it("writes structured JSON with its context", () => {
    process.env.LOG_LEVEL = "info";
    const spy = captureConsole("log");

    logger.info("lead intake accepted", { leadReference: "LEAD-2026-00001" });

    expect(spy).toHaveBeenCalledTimes(1);
    const record = JSON.parse(spy.mock.calls[0][0] as string);
    expect(record).toMatchObject({
      level: "info",
      message: "lead intake accepted",
      leadReference: "LEAD-2026-00001"
    });
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(record.environment).toBeTruthy();
  });

  it("drops records below the configured level", () => {
    process.env.LOG_LEVEL = "warn";
    const log = captureConsole("log");
    const warn = captureConsole("warn");

    logger.info("routine");
    logger.warn("worth noticing");

    expect(log).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("routes errors to console.error", () => {
    process.env.LOG_LEVEL = "debug";
    const spy = captureConsole("error");

    logger.error("rate limit backend unavailable");

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("keeps logging alive when the environment is unreadable", () => {
    process.env.LOG_LEVEL = "not-a-level";
    const spy = captureConsole("log");

    logger.info("still recorded");

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("describeError", () => {
  it("reduces thrown values to a message", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
    expect(describeError("plain string")).toBe("plain string");
    expect(describeError({ weird: true })).toBe("Unknown error");
  });
});
