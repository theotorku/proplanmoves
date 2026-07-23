"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bootstrapInitialOwner } from "@/domains/auth/bootstrap";
import { createSupabaseServerClient } from "@/domains/auth/server";

export type BootstrapActionState = {
  message?: string;
};

export async function bootstrapOwnerAction(
  _previousState: BootstrapActionState,
  formData: FormData
): Promise<BootstrapActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login");
  }

  const result = await bootstrapInitialOwner({
    userId: user.id,
    email: user.email,
    fullName: String(formData.get("fullName") ?? "")
  });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard");
}
