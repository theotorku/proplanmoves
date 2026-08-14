"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/domains/auth/server";
import { logger } from "@/lib/logger";

export type LoginActionState = {
  message?: string;
};

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export async function signInAction(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const credentials = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  // Never say which half was wrong: that turns the form into a way to find out
  // which email addresses have staff accounts.
  if (!credentials.success) {
    return { message: "Enter your email address and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.data.email.toLowerCase(),
    password: credentials.data.password
  });

  if (error) {
    // Recorded without the address: Supabase Auth already keeps the detailed
    // attempt log, and this file should not become a list of staff emails.
    logger.warn("staff sign-in rejected");
    return { message: "Those credentials did not match an account." };
  }

  redirect("/admin/dashboard");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
