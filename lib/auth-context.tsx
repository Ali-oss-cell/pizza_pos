"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  AUTH_EXPIRED_EVENT,
  apiFetch,
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  setAuthSession,
} from "@/lib/api";
import { getDeviceStoreSlug } from "@/lib/store-session";
import type { AuthResponse, PosUser } from "@/types/auth";
import { canAccessPos, normalizePosUser } from "@/types/auth";

export const POS_ENTRY_CODE_KEY = "pos_entry_code";

interface AuthContextValue {
  user: PosUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithPosCode: (code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const router = useRouter();
  const [user, setUser] = useState<PosUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restoreSession(): Promise<void> {
      const token = getAuthToken();
      const storedUser = getStoredUser();

      if (!token || !storedUser || !canAccessPos(storedUser.role)) {
        if (token || storedUser) {
          clearAuthSession();
        }
        setIsLoading(false);
        return;
      }

      try {
        const profile = await apiFetch<PosUser>("/auth/me");
        const nextUser = normalizePosUser(profile);
        setAuthSession(token, nextUser);
        setUser(nextUser);
      } catch {
        clearAuthSession();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    void restoreSession();
  }, []);

  useEffect(() => {
    const onAuthExpired = (): void => {
      setUser(null);
      router.replace("/login");
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
  }, [router]);

  const logout = useCallback(() => {
    clearAuthSession();
    sessionStorage.removeItem(POS_ENTRY_CODE_KEY);
    setUser(null);
    router.replace("/login");
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
    );

    if (!response.ok) {
      let message = "Login failed";

      try {
        const body = (await response.json()) as { message?: string };
        if (body.message) {
          message = body.message;
        }
      } catch {
        // ignore
      }

      throw new ApiError(message, response.status);
    }

    const data = (await response.json()) as AuthResponse;
    const nextUser = normalizePosUser(data.user);

    if (!canAccessPos(nextUser.role)) {
      throw new ApiError(
        "This account cannot access POS. Use a Staff, Manager, or Admin login.",
        403,
      );
    }

    setAuthSession(data.accessToken, nextUser);
    setUser(nextUser);
  }, []);

  const loginWithPosCode = useCallback(async (code: string) => {
    const storeSlug = getDeviceStoreSlug();
    if (!storeSlug) {
      throw new ApiError(
        "This register isn't set up yet. A manager must sign in with email once.",
        400,
      );
    }
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/auth/pos-code`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, storeSlug }),
      },
    );

    if (!response.ok) {
      let message = "That code is not recognised.";
      try {
        const body = (await response.json()) as { message?: string | string[] };
        if (Array.isArray(body.message)) {
          message = body.message[0] ?? message;
        } else if (body.message) {
          message = body.message;
        }
      } catch {
        // ignore
      }
      throw new ApiError(message, response.status);
    }

    const data = (await response.json()) as AuthResponse;
    const nextUser = normalizePosUser(data.user);

    if (!canAccessPos(nextUser.role)) {
      throw new ApiError("This code cannot open the register.", 403);
    }

    if (nextUser.posPinMustChange) {
      sessionStorage.setItem(POS_ENTRY_CODE_KEY, code);
    } else {
      sessionStorage.removeItem(POS_ENTRY_CODE_KEY);
    }

    setAuthSession(data.accessToken, nextUser);
    setUser(nextUser);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, loginWithPosCode, logout }),
    [user, isLoading, login, loginWithPosCode, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
