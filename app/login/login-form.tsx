"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

export default function LoginForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, login, loginWithPosCode } = useAuth();
  const [code, setCode] = useState("");
  const [ownerMode, setOwnerMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      const from = searchParams.get("from");
      router.replace(from && from.startsWith("/") ? from : "/select-store");
    }
  }, [isLoading, user, router, searchParams]);

  function goNext(): void {
    const from = searchParams.get("from");
    router.push(from && from.startsWith("/") ? from : "/select-store");
  }

  async function submitCode(event?: FormEvent) {
    event?.preventDefault();
    if (code.length < 4) return;
    setSubmitting(true);
    setError(null);
    try {
      await loginWithPosCode(code);
      goNext();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Sign in failed",
      );
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOwner(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      goNext();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Sign in failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <section className="glass-panel w-full max-w-sm rounded-3xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Marina Pizzas
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-50">
          {ownerMode ? "Owner sign in" : "Enter your POS code"}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          {ownerMode
            ? "Store owners who already have an email login can use it here."
            : "Use the code your manager gave you. The first time, you will choose your own."}
        </p>

        {ownerMode ? (
          <form className="mt-6 space-y-4" onSubmit={(event) => void submitOwner(event)}>
            <label className="block text-sm text-zinc-300">
              Email
              <input
                autoComplete="username"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-zinc-50 outline-none focus:ring-2 focus:ring-rose-500/40"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Password
              <input
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-zinc-50 outline-none focus:ring-2 focus:ring-rose-500/40"
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            <button
              className="w-full rounded-2xl bg-pay-gradient py-3 text-sm font-semibold text-white disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form className="mt-6" onSubmit={(event) => void submitCode(event)}>
            <input
              autoFocus
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-center font-mono text-3xl tracking-[0.45em] text-zinc-50 outline-none focus:ring-2 focus:ring-rose-500/40"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••"
              type="password"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {KEYS.slice(0, 9).map((key) => (
                <button
                  key={key}
                  className="rounded-xl border border-white/10 bg-white/5 py-3 font-mono text-lg text-zinc-50"
                  type="button"
                  onClick={() => setCode((current) => (current + key).slice(0, 6))}
                >
                  {key}
                </button>
              ))}
              <button
                className="rounded-xl border border-white/10 py-3 text-sm text-zinc-400"
                type="button"
                onClick={() => setCode((current) => current.slice(0, -1))}
              >
                Delete
              </button>
              <button
                className="rounded-xl border border-white/10 bg-white/5 py-3 font-mono text-lg text-zinc-50"
                type="button"
                onClick={() => setCode((current) => (current + "0").slice(0, 6))}
              >
                0
              </button>
              <button
                className="rounded-xl bg-pay-gradient py-3 text-sm font-semibold text-white disabled:opacity-50"
                disabled={submitting || code.length < 4}
                type="submit"
              >
                {submitting ? "…" : "Go"}
              </button>
            </div>
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          </form>
        )}

        <button
          className="mt-5 w-full text-center text-sm text-zinc-500"
          type="button"
          onClick={() => {
            setOwnerMode((current) => !current);
            setError(null);
          }}
        >
          {ownerMode ? "Use a POS code" : "Owner email sign in"}
        </button>
      </section>
    </div>
  );
}
