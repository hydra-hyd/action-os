"use client";

import { useCallback, useSyncExternalStore } from "react";
import { emptyState } from "./domain/actions";
import type { AppState } from "./domain/types";

/**
 * ローカル保存（この端末のブラウザ内 localStorage）。
 * 現時点ではクラウド同期・ユーザー認証は未実装。Supabase 連携時はこの層を差し替える。
 */
const KEY = "action-os:v1";

let state: AppState | null = null;
const listeners = new Set<() => void>();
const SERVER_STATE = emptyState();

export function loadState(raw: string | null): AppState {
  const base = emptyState();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== 1) return base;
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}), weights: { ...base.settings.weights, ...(parsed.settings?.weights ?? {}) } },
    } as AppState;
  } catch {
    return base;
  }
}

function read(): AppState {
  if (state) return state;
  state = typeof window === "undefined" ? SERVER_STATE : loadState(window.localStorage.getItem(KEY));
  return state;
}

export function setState(next: AppState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 容量超過など。状態はメモリ上で保持する
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = loadState(e.newValue);
      cb();
    }
  };
  window.addEventListener("storage", onStorage); // 別タブとの同期
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppState() {
  const s = useSyncExternalStore(subscribe, read, () => SERVER_STATE);
  const dispatch = useCallback((fn: (s: AppState) => AppState) => {
    setState(fn(read()));
  }, []);
  return [s, dispatch] as const;
}

/** SSR 時と区別するためのフラグ（初回描画でのチラつき防止） */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function exportJson(): string {
  return JSON.stringify(read(), null, 2);
}

export function resetAll() {
  setState(emptyState());
}
