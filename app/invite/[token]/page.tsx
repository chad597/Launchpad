import { checkInvite } from "@/lib/invites";
import { setPasswordFromInvite } from "../../actions";
import { SetPasswordForm } from "../set-password-form";

// Reached from a link an admin sent by hand. No session yet, so the middleware
// allows it through.
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const check = await checkInvite(token);

  return (
    <div className="wrap narrow" style={{ maxWidth: "26rem", paddingTop: "4rem" }}>
      <div className="card">
        <div className="logo" style={{ marginBottom: "1rem" }}><span className="mark" />LAUNCHPAD</div>
        {check.ok ? (
          <>
            <h1 className="page">{check.purpose === "reset" ? "Choose a new password" : "Set your password"}</h1>
            <p className="sub">
              {check.name?.split(" ")[0]}, this signs you in as {check.email}. Pick something you will remember; you will use it every time.
            </p>
            <SetPasswordForm token={token} action={setPasswordFromInvite} />
          </>
        ) : (
          <>
            <h1 className="page">This link will not work</h1>
            <p className="sub">{check.reason}</p>
            <div className="notice">
              Links are single use and expire. Ask the Launchpad team for a fresh one and it will work straight away.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
