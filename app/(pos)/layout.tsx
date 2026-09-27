import { RequireAuth } from "@/components/auth/require-auth";
import { ChangePosCodeScreen } from "@/components/auth/change-pos-code-screen";
import { RequireStore } from "@/components/auth/require-store";
import { StaffLockScreen } from "@/components/register/manager-pin-modal";
import { PosShell } from "@/components/layout/pos-shell";
import { StaffPinProvider } from "@/lib/staff-pin-context";

export default function PosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <RequireAuth>
      <RequireStore>
        <StaffPinProvider>
          <PosShell>{children}</PosShell>
          <ChangePosCodeScreen />
          <StaffLockScreen />
        </StaffPinProvider>
      </RequireStore>
    </RequireAuth>
  );
}
