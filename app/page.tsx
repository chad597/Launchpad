import { redirect } from "next/navigation";
import { currentUser, homeForRole } from "@/lib/session";

export default async function Home() {
  const user = await currentUser();
  redirect(homeForRole(user.role));
}
