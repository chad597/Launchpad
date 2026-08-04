"use client";

import { useActionState } from "react";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";

export function SetPasswordForm({
  token, action,
}: {
  token: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <div className="formrow">
        <label htmlFor="password">New password</label>
        <input type="password" id="password" name="password" autoComplete="new-password"
          minLength={10} required />
        <p className="help">At least 10 characters.</p>
      </div>
      <div className="formrow">
        <label htmlFor="confirm">Type it again</label>
        <input type="password" id="confirm" name="confirm" autoComplete="new-password" required />
      </div>
      {state.error && <p className="meta" style={{ color: "var(--crit)" }}>{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Saving..." : "Set password and sign in"}
      </button>
    </form>
  );
}
