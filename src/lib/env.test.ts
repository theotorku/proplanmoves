import { describe, expect, it } from "vitest";
import { getPublicEnv, getServerEnv } from "./env";

const baseEnv = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service-role"
};

describe("environment validation", () => {
  it("validates public env without server-only secrets", () => {
    expect(getPublicEnv(baseEnv).NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("defaults server runtime settings", () => {
    const env = getServerEnv(baseEnv);

    expect(env.BUSINESS_TIMEZONE).toBe("America/Chicago");
    expect(env.DEFAULT_CURRENCY).toBe("USD");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("rejects missing Supabase public config", () => {
    expect(() => getPublicEnv({ ...baseEnv, NEXT_PUBLIC_SUPABASE_URL: "" })).toThrow();
  });
});
