"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="cl-stack-3">
      <input type="hidden" name="next" value={next} />
      <div className="cl-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="cl-input" />
      </div>
      <div className="cl-field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="cl-input" />
      </div>
      {state.error ? <div className="cl-pill is-rose">{state.error}</div> : null}
      <button type="submit" disabled={pending} className="cl-btn is-primary is-block is-lg">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
