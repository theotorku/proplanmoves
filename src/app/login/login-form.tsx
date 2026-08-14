"use client";

import { useActionState } from "react";
import { signInAction, type LoginActionState } from "./actions";

const initialState: LoginActionState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="mt-6 grid gap-4">
      <label>
        <span className="text-sm font-medium">Email</span>
        <input
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          name="email"
          required
          type="email"
        />
      </label>
      <label>
        <span className="text-sm font-medium">Password</span>
        <input
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          name="password"
          required
          type="password"
        />
      </label>
      {state.message ? (
        <p aria-live="polite" className="text-sm text-amber-700" role="status">
          {state.message}
        </p>
      ) : null}
      <button
        className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
