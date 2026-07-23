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
  const { count: ownerCount, error: countError } = await supabase
    .from("profile_roles")
    .select("roles!inner(code)", { count: "exact", head: true })
    .eq("roles.code", "owner");

  if (countError) {
    return { ok: false, error: "INTERNAL_ERROR", message: countError.message };
  }

  if ((ownerCount ?? 0) > 0) {
    return {
      ok: false,
      error: "CONFLICT",
      message: "An owner has already been bootstrapped."
    };
  }

  const { data: ownerRole, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("code", "owner")
    .single();

  if (roleError || !ownerRole) {
    return {
      ok: false,
      error: "INTERNAL_ERROR",
      message: roleError?.message ?? "Owner role does not exist."
    };
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: parsed.userId,
      full_name: parsed.fullName,
      is_active: true
    },
    { onConflict: "id" }
  );

  if (profileError) {
    return { ok: false, error: "INTERNAL_ERROR", message: profileError.message };
  }

  const { error: roleAssignError } = await supabase.from("profile_roles").upsert(
    {
      profile_id: parsed.userId,
      role_id: ownerRole.id
    },
    { onConflict: "profile_id,role_id" }
  );

  if (roleAssignError) {
    return { ok: false, error: "INTERNAL_ERROR", message: roleAssignError.message };
  }

  await supabase.from("audit_events").insert({
    actor_profile_id: parsed.userId,
    entity_type: "profile",
    entity_id: parsed.userId,
    event_type: "auth.owner_bootstrapped",
    new_values: { email: parsed.email }
  });

  return { ok: true };
}
