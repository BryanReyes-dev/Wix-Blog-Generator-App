import type { Preferences } from "../types";

export function loadPreferences(storageKey: string | null): Partial<Preferences> {
  if (!storageKey) return {};

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const value = JSON.parse(raw) as Partial<Preferences>;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function savePreferences(storageKey: string | null, preferences: Preferences): void {
  if (!storageKey) return;

  try {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // Browser privacy settings or storage quotas must not block article generation.
  }
}
