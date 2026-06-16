import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-outline">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
