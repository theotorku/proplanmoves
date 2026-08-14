"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Admin routes read through RLS, so a failure here is usually a permission or
 * connectivity problem rather than something the operator did. Show them what
 * to do next and keep the underlying message in the console for support.
 */
export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("admin route error", error);
  }, [error]);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-2xl rounded-md border border-neutral-300 bg-white p-6">
        <h1 className="text-2xl font-semibold">This page could not be loaded</h1>
        <p className="mt-2 text-neutral-700">
          The data behind this page did not come back. This is usually temporary.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-neutral-500">Reference {error.digest}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
          <Link
            className="rounded-md border border-neutral-300 px-4 py-2 font-medium"
            href="/admin/dashboard"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
