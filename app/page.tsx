import { Suspense } from "react";
import HomeRedirect from "./home-redirect";

export default function HomePage(): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <HomeRedirect />
    </Suspense>
  );
}
