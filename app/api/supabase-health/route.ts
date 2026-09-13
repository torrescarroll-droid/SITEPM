import { checkSupabaseConnection } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await checkSupabaseConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
