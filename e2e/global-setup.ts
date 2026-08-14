/**
 * Provisions the operator account the happy path signs in with, using the same
 * two steps a real deployment uses: create the auth user, then run the
 * service-role bootstrap RPC that grants the first owner. Both steps are
 * idempotent so the suite can be re-run without resetting the database.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const OPERATOR_EMAIL = process.env.BOOTSTRAP_OWNER_EMAIL ?? "owner@proplanmoves.test";
export const OPERATOR_PASSWORD = "e2e-operator-password";

export default async function globalSetup() {
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Run `node scripts/write-local-env.mjs --force` first."
    );
  }

  const userId = await createOperatorUser();
  await bootstrapOwner(userId);
}

async function createOperatorUser(): Promise<string> {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: OPERATOR_EMAIL,
      password: OPERATOR_PASSWORD,
      email_confirm: true
    })
  });

  if (response.ok) {
    const created = await response.json();
    return created.id;
  }

  const body = await response.text();

  // Already provisioned by an earlier run: look the account up instead.
  if (response.status === 422 || body.includes("already been registered")) {
    const existing = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        }
      }
    );

    const { users } = await existing.json();
    const match = users?.find(
      (user: { email?: string; id: string }) =>
        user.email?.toLowerCase() === OPERATOR_EMAIL.toLowerCase()
    );

    if (!match) {
      throw new Error(`Could not find or create the operator account: ${body}`);
    }

    return match.id;
  }

  throw new Error(`Could not create the operator account: ${response.status} ${body}`);
}

async function bootstrapOwner(userId: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/bootstrap_initial_owner`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_email: OPERATOR_EMAIL,
      p_full_name: "E2E Operator"
    })
  });

  const result = await response.json();

  // CONFLICT means an owner already exists, which is the desired end state.
  if (!response.ok || (result?.ok === false && result?.code !== "CONFLICT")) {
    throw new Error(`Could not bootstrap the owner: ${JSON.stringify(result)}`);
  }
}
