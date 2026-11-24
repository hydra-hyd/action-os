import { Suspense } from "react";
import { StuckFlow } from "./StuckFlow";

export default function StuckPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <StuckFlow />
    </Suspense>
  );
}
