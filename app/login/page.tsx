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
    <div className="wrap narrow" style={{ maxWidth: "26rem", paddingTop: "4rem" }}>
      <div className="card">
        <div className="logo" style={{ marginBottom: "1rem" }}><span className="mark" />LAUNCHPAD</div>
        <h1 className="page">Sign in</h1>
        <p className="sub">Use the email address the program has on file.</p>

        {set && (
          <div className="banner good" style={{ marginBottom: ".8rem" }}>
            Your password is set. Sign in with it below.
          </div>
        )}

        <form action={signIn}>
          <div className="formrow">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" name="email" autoComplete="email" required />
          </div>
          <div className="formrow">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" name="password" autoComplete="current-password" required />
          </div>
          {error && <p className="meta" style={{ color: "var(--crit)" }}>{error}</p>}
          <button className="btn" type="submit">Sign in</button>
        </form>

        {googleEnabled() && (
          <>
            <p className="meta" style={{ textAlign: "center", margin: "1rem 0 .6rem" }}>or</p>
            <form action={signInWithGoogle}>
              <button className="btn ghost" type="submit">Continue with Google</button>
            </form>
            <p className="meta" style={{ marginTop: ".5rem" }}>
              Use the Google account that matches your program email.
            </p>
          </>
        )}

        <div className="notice">
          Accounts are created by the Launchpad team. If you have not set a password yet, use the invite link the program sent you. Lost it, or forgotten your password? Ask the program staff for a new one.
        </div>
      </div>
    </div>
  );
}
