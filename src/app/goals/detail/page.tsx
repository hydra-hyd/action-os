import { Suspense } from "react";
import { GoalDetail } from "./GoalDetail";

export default function GoalDetailPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <GoalDetail />
    </Suspense>
  );
}
