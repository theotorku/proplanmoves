import { describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  hashRateLimitKey,
  type RateLimitRepository
} from "./rate-limit";

describe("rate limit", () => {
  it("hashes identifiers before persistence", () => {
    const key = "quote-request:203.0.113.2:test-agent";
    expect(hashRateLimitKey(key)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRateLimitKey(key)).not.toContain("203.0.113.2");
  });

  it("uses the shared repository with a whole-second window", async () => {
    const consume = vi.fn(async () => ({ allowed: true as const, remaining: 4 }));
    const repository: RateLimitRepository = { consume };

    await expect(
      checkRateLimit(
        "quote-request:client",
        { limit: 5, windowMs: 15_001 },
        repository
      )
    ).resolves.toEqual({ allowed: true, remaining: 4 });

    expect(consume).toHaveBeenCalledWith({
      bucketKey: hashRateLimitKey("quote-request:client"),
      limit: 5,
      windowSeconds: 16
    });
  });

  it("returns a shared-store rejection", async () => {
    const repository: RateLimitRepository = {
      async consume() {
        return { allowed: false, retryAfterSeconds: 59 };
      }
    };

    await expect(
      checkRateLimit("quote-request:client", { limit: 1, windowMs: 60_000 }, repository)
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 59
    });
  });

  it("rejects invalid limiter configuration", async () => {
    const repository: RateLimitRepository = {
      async consume() {
        return { allowed: true, remaining: 0 };
      }
    };

    await expect(
      checkRateLimit("quote-request:client", { limit: 0, windowMs: 60_000 }, repository)
    ).rejects.toThrow("positive integer");
  });
});
