"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function HomeRedirect(): React.ReactElement | null {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (user) {
      const from = searchParams.get("from");
      router.replace(
        from && from.startsWith("/") ? from : "/select-store",
      );
      return;
    }

    router.replace("/login");
  }, [isLoading, user, router, searchParams]);

  return null;
}
