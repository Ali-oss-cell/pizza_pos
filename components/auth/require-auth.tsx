"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement | null {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, user, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-outline">
        Loading…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
