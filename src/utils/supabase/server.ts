import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { supabaseFetch } from "./fetch-with-timeout";

export async function createClient(options: { userAgent?: string | null } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();
  // Informational only: preserve the browser label when a server action signs in.
  // Never forward an arbitrary header map or use this value for authorization.
  const userAgent = options.userAgent?.replace(/[\r\n]/g, "").slice(0, 512).trim();

  return createServerClient(url, anonKey, {
    global: {
      fetch: supabaseFetch,
      ...(userAgent ? { headers: { "User-Agent": userAgent } } : {}),
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component; session refresh is handled in
          // Middleware or Route Handlers when you add them.
        }
      },
    },
  });
}

/**
 * Session lookup that never throws — auth pages must still render if
 * Supabase is misconfigured or unreachable.
 */
export async function getAuthUserOrNull(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch (err) {
    console.error("[auth] getUser failed", err);
    return null;
  }
}
