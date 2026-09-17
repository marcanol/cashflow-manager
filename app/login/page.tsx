"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(null);
    try {
      const { error } = await createSupabaseBrowserClient().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` } });
      setMessage(error ? error.message : "Check your email for your secure sign-in link.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start sign in."); }
  }
  return <main><header><p className="eyebrow">Cashflow</p><h1>Sign in</h1><p className="muted">Use a household member email address. Access is granted only through household membership.</p></header><form className="login" onSubmit={submit}><label htmlFor="email">Email address</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /><button type="submit">Email me a sign-in link</button>{message && <p className="muted">{message}</p>}</form></main>;
}
