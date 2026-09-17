"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthFormState } from "@/app/auth/actions";

const initialState: AuthFormState = { error: null };

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <main className="w-full max-w-md rounded-2xl border border-stone-200 bg-white px-8 py-10 shadow-sm">
      <p className="text-xs font-medium tracking-[0.18em] text-stone-500 uppercase">
        SITEPM
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-stone-600">
        AI Operating Layer for Construction
      </p>
      <form action={action} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
          />
        </label>
        {state.error ? (
          <p className="text-sm text-orange-800">{state.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-xl bg-stone-900 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-stone-600">
        New contractor?{" "}
        <Link href="/signup" className="font-medium text-stone-950">
          Sign up
        </Link>
      </p>
    </main>
  );
}
