import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";
import type { Database } from "./database.types";

type SupabaseServiceClient = SupabaseClient<Database>;

let serviceClient: SupabaseServiceClient | null = null;

export function getSupabaseServiceClient() {
  if (!serviceClient) {
    const env = getServerEnv();
    serviceClient = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
  }

  return serviceClient;
}
