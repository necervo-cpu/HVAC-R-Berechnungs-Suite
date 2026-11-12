/**
 * Modul: 3-Stufen-Theme-Steuerung (theme.js)
 * Zweck: FOUC-freie Initialisierung und Umschaltung des Darstellungsmodus
 *   ('auto' | 'light' | 'dark') gemäß DESIGN.md ("Kupfer & Kälte").
 * Verantwortlichkeit: Synchronisiert data-theme auf <html>, aktualisiert
 *   meta[name="theme-color"] für die iOS-Statusleiste und persistiert fehlerresistent.
 * Sicherheits- & Stabilitätsrelevanz: Whitelist-Validierung gegen DOM-Manipulation und
 *   try/catch-Kapselung für den iOS Safari Privatmodus.
 */

const THEME_STORAGE_KEY = "hvacr-theme-mode";
const TOP_LIGHT = "#f4f6f9";
const TOP_DARK = "#0d0f12";

export function isValidThemeMode(value) {
  return value === "auto" || value === "light" || value === "dark";
}

export function getStoredThemeMode() {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidThemeMode(raw) ? raw : "auto";
  } catch {
    return "auto";
  }
}

function syncStatusBarMeta(mode) {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode === "auto" && prefersDark);
  const targetColor = isDark ? TOP_DARK : TOP_LIGHT;

  document.querySelectorAll('meta[name="theme-color"]').forEach((tag) => {
    tag.setAttribute("content", targetColor);
  });
}

export function applyThemeMode(mode) {
  const safeMode = isValidThemeMode(mode) ? mode : "auto";
  const root = document.documentElement;
  if (safeMode === "auto") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", safeMode);
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, safeMode);
  } catch {
    // Im iOS Safari Privatmodus wird nur der DOM-Zustand verwendet.
  }

  syncStatusBarMeta(safeMode);
  return safeMode;
}

export function getCurrentThemeMode() {
  const attr = document.documentElement.getAttribute("data-theme");
  return isValidThemeMode(attr) ? attr : "auto";
}

export function cycleThemeMode(current) {
  const next = current === "auto" ? "light" : current === "light" ? "dark" : "auto";
  return applyThemeMode(next);
}

if (typeof document !== "undefined") {
  applyThemeMode(getStoredThemeMode());
}
