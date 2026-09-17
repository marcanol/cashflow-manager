import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeNextPath } from "@/lib/auth/redirect";

const requestCookies = (request: Request) => request.headers.get("cookie")?.split(/;\s*/).filter(Boolean).map((value) => { const [name, ...parts] = value.split("="); return { name, value: parts.join("=") }; }) ?? [];
export async function GET(request: Request) {
  const requestUrl = new URL(request.url); const code = requestUrl.searchParams.get("code"); const next = safeNextPath(requestUrl.searchParams.get("next"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const response = NextResponse.redirect(new URL(code ? next : "/login", requestUrl.origin));
  if (!code || !url || !key) return response;
  const supabase = createServerClient(url, key, { cookies: { getAll: () => requestCookies(request), setAll: (values) => values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? NextResponse.redirect(new URL("/login", requestUrl.origin)) : response;
}
