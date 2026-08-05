import { redirect } from "next/navigation";
import { isDemo } from "@/lib/supabase/server";
import { googleEnabled } from "@/lib/supabase/admin";
import { signIn, signInWithGoogle } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; error?: string }>;
}) {
  if (isDemo()) redirect("/");
  const { set, error } = await searchParams;

  return (
    <div className="wrap" style={{ maxWidth: "440px", minHeight: "80vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div className="logo" style={{ marginBottom: "clamp(28px,5cqw,44px)" }}><span className="mark" />LAUNCHPAD</div>
      <div className="card">
        <h1 className="page" style={{ fontSize: "var(--lp-size-title)", lineHeight: "var(--lp-leading-heading)" }}>Sign in</h1>
        <p className="sub" style={{ margin: "0 0 26px" }}>Use the email address the program has on file.</p>

        {set && <div className="banner ok">Your password is set. Sign in with it below.</div>}

        <form action={signIn} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="formrow" style={{ margin: 0 }}>
            <label htmlFor="email">Email</label>
            <input type="email" id="email" name="email" autoComplete="email" required />
          </div>
          <div className="formrow" style={{ margin: 0 }}>
            <label htmlFor="password">Password</label>
            <input type="password" id="password" name="password" autoComplete="current-password" required />
          </div>
          {error && <p className="meta" style={{ margin: 0, color: "var(--crit)" }}>{error}</p>}
          <button className="btn" style={{ width: "100%" }} type="submit">Sign in</button>
        </form>

        {googleEnabled() && (
          <>
            <div className="meta" style={{ display: "flex", alignItems: "center", gap: "12px", margin: "16px 0" }}>
              <span style={{ flex: 1, height: "1px", background: "var(--lp-line)" }} />
              <span>or</span>
              <span style={{ flex: 1, height: "1px", background: "var(--lp-line)" }} />
            </div>
            <form action={signInWithGoogle}>
              <button className="btn ghost" style={{ width: "100%" }} type="submit">Continue with Google</button>
            </form>
          </>
        )}

        <p className="meta" style={{ margin: "22px 0 0", maxWidth: "46ch" }}>
          Accounts are created by the Launchpad team. If you have not set a password yet, use the invite link the program sent you. Lost it, or forgotten your password? Ask the program staff for a new one.
        </p>
      </div>
    </div>
  );
}
