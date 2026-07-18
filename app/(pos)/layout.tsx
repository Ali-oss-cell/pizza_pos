import { RequireAuth } from "@/components/auth/require-auth";
import { RequireStore } from "@/components/auth/require-store";
import { PosShell } from "@/components/layout/pos-shell";

export default function PosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <RequireAuth>
      <RequireStore>
        <PosShell>{children}</PosShell>
      </RequireStore>
    </RequireAuth>
  );
}
