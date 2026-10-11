"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthFormState } from "@/app/auth/actions";

const initialState: AuthFormState = { error: null };

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, initialState);

  return (
    <main className="auth-card">
      <p className="text-xs font-medium tracking-[0.18em] text-stone-500 uppercase">
        LINEHORSE
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Create account
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Creates your company and owner profile. You will only see your company’s
        data.
      </p>
      <form action={action} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Full name
          <input
            name="full_name"
            type="text"
            autoComplete="name"
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Company name
          <input
            name="company_name"
            type="text"
            required
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
            placeholder="Ridge Line Construction"
          />
        </label>
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
            minLength={6}
            autoComplete="new-password"
            className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3"
          />
        </label>
        {state.error ? (
          <p className="text-sm text-orange-800">{state.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="button-primary w-full disabled:opacity-60"
        >
          {pending ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="mt-6 text-sm text-stone-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-stone-950">
          Sign in
        </Link>
      </p>
    </main>
  );
}
