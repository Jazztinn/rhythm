import type { Metadata } from "next";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { safeNextPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; setup?: string; next?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  return <main className="login-page">
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-mark" aria-hidden="true"><LockKeyhole size={21} /></div>
      <span className="section-kicker">Private workspace</span>
      <h1 id="login-title">Welcome back.</h1>
      <p>Your tasks, rhythms, and planning context stay behind this sign-in.</p>
      {params.setup ? <div className="login-message" role="alert">Authentication needs configuration before sign-in is available.</div> : null}
      {params.error ? <div className="login-message" role="alert">That username or password did not match.</div> : null}
      <form className="login-form" action="/api/auth/login" method="post">
        <input type="hidden" name="next" value={next} />
        <label><span>Username</span><input name="username" autoComplete="username" required autoFocus maxLength={120} /></label>
        <label><span>Password</span><input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
        <button type="submit">Enter Rhythm <ArrowRight size={17} aria-hidden="true" /></button>
      </form>
      <small>Session expires after seven days.</small>
    </section>
  </main>;
}
