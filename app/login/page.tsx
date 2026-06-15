"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch, setAuthToken } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AuthResponse {
  accessToken: string;
}

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setAuthToken(response.accessToken);
      router.push("/register");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Login failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl bg-surface-container p-6">
      <h2 className="text-2xl font-semibold">Staff login</h2>
      <p className="mt-2 text-sm text-outline">
        Use your staff or admin account. POS requires STAFF role or higher.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Email</span>
          <input
            className="min-h-touch w-full rounded-lg border border-white/10 bg-surface px-4"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Password</span>
          <input
            className="min-h-touch w-full rounded-lg border border-white/10 bg-surface px-4"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <button
          className={cn(
            "min-h-touch w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white",
            loading && "opacity-70",
          )}
          type="submit"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
