import { RequireAuth } from "@/components/auth/require-auth";
import { PosHeader } from "@/components/layout/pos-header";

export default function PosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <RequireAuth>
      <PosHeader />
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </RequireAuth>
  );
}
