export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-semibold">Staff sign in</h1>
      <p className="mt-3 text-neutral-700">
        Supabase Auth is configured at the server boundary. The interactive
        email sign-in flow will be connected when operator accounts are
        provisioned.
      </p>
    </main>
  );
}
