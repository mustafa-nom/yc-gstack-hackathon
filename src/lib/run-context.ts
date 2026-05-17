const KEY = "brainpost.runId";
const listeners = new Set<() => void>();

export function getStoredRunId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setStoredRunId(runId: string): void {
  if (typeof window === "undefined") return;
  try {
    const prev = window.localStorage.getItem(KEY);
    if (prev === runId) return;
    window.localStorage.setItem(KEY, runId);
    listeners.forEach((fn) => fn());
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function subscribeStoredRunId(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}
