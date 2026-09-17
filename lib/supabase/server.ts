import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component where cookies cannot be set.
        }
      },
    },
  });
}

export async function checkSupabaseConnection() {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    return { ok: false as const, detail: "Environment variables are not loaded." };
  }

  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return { ok: false as const, detail: "Supabase did not accept the project credentials." };
  }

  return { ok: true as const, detail: "SITEPM reached the Supabase project." };
}
