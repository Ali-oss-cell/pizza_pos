import { Suspense } from "react";
import SelectStorePage from "./select-store-client";

export default function Page(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-outline">
          Loading…
        </div>
      }
    >
      <SelectStorePage />
    </Suspense>
  );
}
