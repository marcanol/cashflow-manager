import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  if (!url || !key) return response;
  const getAll = () => request.headers.get("cookie")?.split(/;\s*/).filter(Boolean).map((value) => { const [name, ...parts] = value.split("="); return { name, value: parts.join("=") }; }) ?? [];
  const supabase = createServerClient(url, key, { cookies: { getAll, setAll: (values) => values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } });
  await supabase.auth.signOut(); return response;
}
