import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-semibold">Staff sign in</h1>
      <p className="mt-3 text-neutral-700">
        Use the email address and password for your ProPlan Moves operator account.
      </p>
      <LoginForm />
    </main>
  );
}
