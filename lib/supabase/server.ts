import { createClient } from "@supabase/supabase-js";

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  return { url, anonKey };
}

export function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(url, anonKey);
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
