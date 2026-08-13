import { createHash } from "node:crypto";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export type RateLimitRepository = {
  consume(params: {
    bucketKey: string;
    limit: number;
    windowSeconds: number;
  }): Promise<RateLimitDecision>;
};

const rateLimitDecisionSchema = z.discriminatedUnion("allowed", [
  z.object({
    allowed: z.literal(true),
    remaining: z.number().int().min(0)
  }),
  z.object({
    allowed: z.literal(false),
    retryAfterSeconds: z.number().int().positive()
  })
]);

export function hashRateLimitKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function checkRateLimit(
  rawKey: string,
  { limit, windowMs }: RateLimitOptions,
  repository: RateLimitRepository = createSupabaseRateLimitRepository()
): Promise<RateLimitDecision> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Rate-limit count must be a positive integer.");
  }

  const windowSeconds = Math.ceil(windowMs / 1000);
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error("Rate-limit window must be at least one second.");
  }

  return repository.consume({
    bucketKey: hashRateLimitKey(rawKey),
    limit,
    windowSeconds
  });
}

function createSupabaseRateLimitRepository(): RateLimitRepository {
  return {
    async consume({ bucketKey, limit, windowSeconds }) {
      const supabase = getSupabaseServiceClient();
      const { data, error } = await supabase.rpc("consume_public_rate_limit", {
        p_bucket_key: bucketKey,
        p_limit: limit,
        p_window_seconds: windowSeconds
      });

      if (error) {
        throw new Error(`Unable to enforce public rate limit: ${error.message}`);
      }

      return rateLimitDecisionSchema.parse(data);
    }
  };
}
