import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Demo mode is the default until the Supabase env vars exist (they're injected
// by the Vercel <-> Supabase integration in production). DEMO_MODE=true forces
// demo mode even with a database configured.
export function isDemo(): boolean {
  if (process.env.DEMO_MODE === "true") return true;
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            // Called from a Server Component; middleware refreshes sessions.
          }
        },
      },
    }
  );
}
