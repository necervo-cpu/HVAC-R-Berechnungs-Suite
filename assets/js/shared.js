/**
 * Modul: Globale Hilfsfunktionen & 3-Stufen-Theme-Steuerung (assets/js/shared.js)
 * Zweck: Stellt allen Seiten (Dashboard & Einzel-Apps) die FOUC-freie Theme-Initialisierung,
 *   UI-Helfer für Segmented-Pills, Toast-Meldungen und Reduced-Motion-Abfrage bereit.
 * Verantwortlichkeit: Theme-Persistenz ('auto' | 'light' | 'dark'), Statusbar-Meta-Sync
 *   und gemeinsame DOM-Interaktionshelfer.
 * Sicherheits- & Stabilitätsrelevanz: Whitelist-Validierung für Theme-Werte und
 *   try/catch-Kapselung von localStorage für den iOS Safari Privatmodus.
 */

const THEME_STORAGE_KEY = "hvacr-theme-mode";
const TOP_LIGHT = "#f2f2f7";
const TOP_DARK = "#000000";

let toastTimer = null;

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

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function showToast(message) {
  const toast = document.getElementById("toast-pill");
  if (!toast) return;
  toast.textContent = message;
  toast.setAttribute("data-visible", "true");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.setAttribute("data-visible", "false");
  }, 2200);
}

export function updateSegmentedPill(container) {
  if (!container) return;
  const pill = container.querySelector(".t-tabs-pill");
  const buttons = Array.from(container.querySelectorAll(".tab-btn"));
  const activeIdx = buttons.findIndex((btn) => btn.getAttribute("aria-selected") === "true");
  if (!pill || activeIdx < 0) return;

  const activeBtn = buttons[activeIdx];
  const pad = container.classList.contains("segmented--compact") ? 2 : 3;
  pill.style.width = `${activeBtn.offsetWidth}px`;
  pill.style.transform = `translateX(${activeBtn.offsetLeft - pad}px)`;
}

export function updateAllPills() {
  document.querySelectorAll(".segmented").forEach((seg) => updateSegmentedPill(seg));
}

export function loadAppParams(storageKey, defaults) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...defaults };
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

export function saveAppParams(storageKey, params) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(params));
  } catch {
    // Im iOS Safari Privatmodus wird nur der Arbeitsspeicher verwendet.
  }
}

/**
 * Erzeugt einen wiederverwendbaren Zahlen-Animator (Count-Up / Count-Down) für Live-Ergebnisse.
 * Respektiert prefers-reduced-motion und springt bei Kontext-/Einheitenwechsel direkt.
 */
export function createNumberAnimator({ duration = 220, epsilon = 0.001, render }) {
  let rafId = null;
  let lastValue = null;
  let lastContext = null;

  return {
    update(targetValue, context = null, animate = true) {
      if (typeof render !== "function") return;

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (
        !Number.isFinite(targetValue) ||
        !animate ||
        prefersReducedMotion() ||
        lastValue === null ||
        lastContext !== context ||
        Math.abs(targetValue - lastValue) < epsilon
      ) {
        lastValue = targetValue;
        lastContext = context;
        render(targetValue, context);
        return;
      }

      const startValue = lastValue;
      const startTime = performance.now();

      const tick = (now) => {
        const progress = Math.min(1, (now - startTime) / duration);
        // easeOutCubic für schnellen Antritt und weiches Einrasten
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startValue + (targetValue - startValue) * eased;
        lastValue = current;
        render(current, context);

        if (progress < 1) {
          rafId = window.requestAnimationFrame(tick);
        } else {
          lastValue = targetValue;
          lastContext = context;
          render(targetValue, context);
          rafId = null;
        }
      };

      rafId = window.requestAnimationFrame(tick);
    },
  };
}

function syncNumInputWidth(input) {
  const len = String(input.value ?? "").length || 1;
  input.style.width = `${Math.max(2, len + 0.4)}ch`;
}

// Fallback für Browser ohne CSS field-sizing: content (z. B. iOS Safari)
function initNumInputSizingFallback() {
  if (typeof CSS !== "undefined" && CSS.supports && CSS.supports("field-sizing", "content")) {
    return;
  }

  const syncAll = () => {
    document.querySelectorAll(".num-value-wrap .num-input").forEach(syncNumInputWidth);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncAll);
  } else {
    syncAll();
  }

  document.addEventListener("input", (e) => {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.closest(".num-value-wrap")) {
      syncNumInputWidth(target);
    }
  });

  // Synchronisiert Breite auch nach JS-Wertänderungen durch Stepper-Buttons oder Chips
  document.addEventListener("click", () => {
    window.requestAnimationFrame(syncAll);
  });
}

// Theme beim Laden sofort anwenden, um Flackern (FOUC) zu vermeiden
if (typeof document !== "undefined") {
  applyThemeMode(getStoredThemeMode());
  initNumInputSizingFallback();
}
