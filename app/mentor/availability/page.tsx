import { currentUser } from "@/lib/session";
import { pairingsForUser } from "@/lib/data";
import { saveAvailability } from "../../actions";

export default async function AvailabilityPage() {
  const user = await currentUser();
  if (user.role !== "mentor") {
    return <div className="wrap narrow"><p className="meta">This page is for mentors.</p></div>;
  }
  const pairs = await pairingsForUser(user.id);

  return (
    <div className="wrap narrow">
      <h1 className="page">Availability and capacity</h1>
      <p className="sub">Founders see your windows when they book, so keep this current. Tell us early if it changes and we&rsquo;ll adjust rather than leave a founder waiting.</p>
      <div className="card">
        <form action={saveAvailability}>
          <div className="formrow">
            <label htmlFor="availability">When you&rsquo;re usually free</label>
            <input type="text" id="availability" name="availability"
              defaultValue={user.availability ?? ""}
              placeholder="Tuesday and Thursday afternoons" />
          </div>
          <div className="formrow">
            <label htmlFor="capacity">How many founders you can take at once</label>
            <input type="text" inputMode="numeric" id="capacity" name="capacity"
              defaultValue={String(user.capacity ?? 1)} />
            <p className="meta" style={{ margin: ".3rem 0 0" }}>
              You currently have {pairs.length} active pairing{pairs.length === 1 ? "" : "s"}. Set this to 0 to pause new matches without leaving the pool.
            </p>
          </div>
          <button className="btn" type="submit">Save</button>
        </form>
      </div>
    </div>
  );
}
