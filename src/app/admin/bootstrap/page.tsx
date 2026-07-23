import { BootstrapOwnerForm } from "./bootstrap-form";

export const dynamic = "force-dynamic";

export default function BootstrapOwnerPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
        Initial setup
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Bootstrap owner access</h1>
      <p className="mt-3 text-neutral-700">
        This action is available only to the signed-in email configured as
        `BOOTSTRAP_OWNER_EMAIL` and only before an owner exists.
      </p>
      <BootstrapOwnerForm />
    </main>
  );
}
