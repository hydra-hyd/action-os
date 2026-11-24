import type { AppState, Goal } from "@/lib/domain/types";
import type { TabKey } from "../GoalDetail";

export interface SectionProps {
  s: AppState;
  dispatch: (fn: (s: AppState) => AppState) => void;
  goal: Goal;
  now: Date;
  goTab: (t: TabKey) => void;
}

/** dispatch 内で投げられた検証エラーを画面に出すためのヘルパー */
export function tryDispatch(dispatch: SectionProps["dispatch"], fn: (s: AppState) => AppState, onError: (m: string) => void): boolean {
  try {
    dispatch(fn);
    onError("");
    return true;
  } catch (e) {
    onError((e as Error).message);
    return false;
  }
}
