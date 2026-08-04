import { redirect } from "next/navigation";
import { isDemo } from "@/lib/supabase/server";
import { signIn } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  if (isDemo()) redirect("/");
  const { sent, error } = await searchParams;

  return (
    <div className="wrap narrow" style={{ maxWidth: "26rem", paddingTop: "4rem" }}>
      <div className="card">
        <div className="logo" style={{ marginBottom: "1rem" }}><span className="mark" />LAUNCHPAD</div>
        <h1 className="page">Sign in</h1>
        <p className="sub">Use the email address the program has on file. We&rsquo;ll send you a sign-in link, no password needed.</p>
        {sent ? (
          <>
            <p style={{ fontSize: ".95rem", fontWeight: 700 }}>Check your email</p>
            <p className="meta">The sign-in link is on its way. It expires in one hour.</p>
          </>
        ) : (
          <form action={signIn}>
            <div className="formrow">
              <label htmlFor="email">Email</label>
              <input type="text" id="email" name="email" autoComplete="email" required />
            </div>
            {error && <p className="meta" style={{ color: "var(--crit)" }}>{error}</p>}
            <button className="btn" type="submit">Send sign-in link</button>
          </form>
        )}
        <div className="notice">New here? Your account is created by the Launchpad team when your cohort starts. If your email isn&rsquo;t recognized, reach out to the program staff.</div>
      </div>
    </div>
  );
}
