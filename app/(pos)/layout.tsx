import { RequireAuth } from "@/components/auth/require-auth";
import { PosShell } from "@/components/layout/pos-shell";

export default function PosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <RequireAuth>
      <PosShell>{children}</PosShell>
    </RequireAuth>
  );
}
