"use client";

import { useActionState } from "react";
import { bootstrapOwnerAction, type BootstrapActionState } from "./actions";

const initialState: BootstrapActionState = {};

export function BootstrapOwnerForm() {
  const [state, formAction, isPending] = useActionState(
    bootstrapOwnerAction,
    initialState
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-neutral-800">Full name</span>
        <input
          className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
          name="fullName"
          required
          minLength={2}
          maxLength={120}
        />
      </label>
      {state.message ? <p className="text-sm text-amber-700">{state.message}</p> : null}
      <button
        className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Bootstrapping..." : "Bootstrap owner"}
      </button>
    </form>
  );
}
