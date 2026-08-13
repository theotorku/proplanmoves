import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const bootstrapOwnerInputSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().trim().min(2).max(120)
});

export type BootstrapOwnerResult =
  | { ok: true }
  | {
      ok: false;
      error: "BOOTSTRAP_NOT_CONFIGURED" | "FORBIDDEN" | "CONFLICT" | "INTERNAL_ERROR";
      message: string;
    };

export async function bootstrapInitialOwner(
  input: z.infer<typeof bootstrapOwnerInputSchema>
): Promise<BootstrapOwnerResult> {
  const parsed = bootstrapOwnerInputSchema.parse(input);
  const env = getServerEnv();
  const allowedEmail = env.BOOTSTRAP_OWNER_EMAIL?.toLowerCase();

  if (!allowedEmail) {
    return {
      ok: false,
      error: "BOOTSTRAP_NOT_CONFIGURED",
      message: "BOOTSTRAP_OWNER_EMAIL must be configured before owner bootstrap."
    };
  }

  if (parsed.email.toLowerCase() !== allowedEmail) {
    return {
      ok: false,
      error: "FORBIDDEN",
      message: "Signed-in user is not allowed to bootstrap the owner role."
    };
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("bootstrap_initial_owner", {
    p_user_id: parsed.userId,
    p_email: parsed.email,
    p_full_name: parsed.fullName
  });

  if (error) {
    return { ok: false, error: "INTERNAL_ERROR", message: error.message };
  }

  const result = z
    .discriminatedUnion("ok", [
      z.object({ ok: z.literal(true) }),
      z.object({
        ok: z.literal(false),
        code: z.enum(["FORBIDDEN", "CONFLICT", "INTERNAL_ERROR"]),
        message: z.string()
      })
    ])
    .parse(data);

  if (!result.ok) {
    return { ok: false, error: result.code, message: result.message };
  }

  return result;
}
