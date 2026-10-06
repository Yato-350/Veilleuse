import { STORAGE_PREFIX } from './constants';

/** Minimal key/value storage wrapper that never throws (private mode, quota, disabled storage). */
export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

class MemoryKV implements KV {
  private m = new Map<string, string>();
  get(k: string) {
    return this.m.get(k) ?? null;
  }
  set(k: string, v: string) {
    this.m.set(k, v);
  }
  remove(k: string) {
    this.m.delete(k);
  }
}

class LocalKV implements KV {
  private fallback = new MemoryKV();
  get(k: string) {
    try {
      return localStorage.getItem(STORAGE_PREFIX + k) ?? this.fallback.get(k);
    } catch {
      return this.fallback.get(k);
    }
  }
  set(k: string, v: string) {
    this.fallback.set(k, v);
    try {
      localStorage.setItem(STORAGE_PREFIX + k, v);
    } catch {
      /* storage unavailable: keep in memory */
    }
  }
  remove(k: string) {
    this.fallback.remove(k);
    try {
      localStorage.removeItem(STORAGE_PREFIX + k);
    } catch {
      /* ignore */
    }
  }
}

export let storage: KV = typeof localStorage === 'undefined' ? new MemoryKV() : new LocalKV();

/** For tests. */
export function useMemoryStorage(): void {
  storage = new MemoryKV();
}

export function loadJSON<T>(key: string, fallback: T): T {
  const raw = storage.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}
