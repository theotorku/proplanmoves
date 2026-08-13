import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { hasAnyRole, type RoleCode } from "./roles";

type ProfileRoleRow = {
  roles: {
    code: RoleCode;
  } | null;
};

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      }
    }
  });
}

export async function requireAnyRole(allowedRoles: readonly RoleCode[]) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("profile_roles")
    .select("roles(code)")
    .eq("profile_id", user.id)
    .returns<ProfileRoleRow[]>();

  if (error) {
    throw new Error(`Unable to load profile roles: ${error.message}`);
  }

  const roles = (data ?? [])
    .map((row) => row.roles?.code)
    .filter((role): role is RoleCode => Boolean(role));

  if (!hasAnyRole(roles, allowedRoles)) {
    redirect("/login");
  }

  return user;
}

export async function requireUserWithRoles(allowedRoles: readonly RoleCode[]) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("profile_roles")
    .select("roles(code)")
    .eq("profile_id", user.id)
    .returns<ProfileRoleRow[]>();

  if (error) {
    throw new Error(`Unable to load profile roles: ${error.message}`);
  }

  const roles = (data ?? [])
    .map((row) => row.roles?.code)
    .filter((role): role is RoleCode => Boolean(role));

  if (!hasAnyRole(roles, allowedRoles)) {
    redirect("/login");
  }

  return { user, roles };
}
