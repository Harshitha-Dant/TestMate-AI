import type { ThemePreference } from "@testmate/shared";

const KEY = "testmate.theme";

/** The theme is a per-browser convenience, so it lives in localStorage (guarded: storage can be unavailable). */
export function readTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(pref: ThemePreference): void {
  document.documentElement.dataset.theme = resolveTheme(pref);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolveTheme(pref) === "light" ? "#f3f2ee" : "#17191D");
}

export function saveTheme(pref: ThemePreference): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // Not persisted; still applied for this session.
  }
  applyTheme(pref);
}

/** Applies the saved theme at startup and follows OS changes while "system" is selected. */
export function initTheme(): void {
  applyTheme(readTheme());
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (readTheme() === "system") applyTheme("system");
  });
}
