/**
 * Modul: Globale Hilfsfunktionen & 3-Stufen-Theme-Steuerung (assets/js/shared.js)
 * Zweck: Stellt allen Seiten (Dashboard & Einzel-Apps) die FOUC-freie Theme-Initialisierung,
 *   UI-Helfer für Segmented-Pills, Toast-Meldungen und Reduced-Motion-Abfrage bereit.
 * Verantwortlichkeit: Theme-Persistenz ('auto' | 'light' | 'dark'), Statusbar-Meta-Sync
 *   und gemeinsame DOM-Interaktionshelfer.
 * Sicherheits- & Stabilitätsrelevanz: Whitelist-Validierung für Theme-Werte und
 *   try/catch-Kapselung von localStorage für den iOS Safari Privatmodus.
 */

export const APP_VERSION = "1.1.0";

const THEME_STORAGE_KEY = "hvacr-theme-mode";
const TOP_LIGHT = "#000000";
const TOP_DARK = "#000000";
const ROOT_URL = new URL("../../", import.meta.url);
const SW_URL = new URL("sw.js", ROOT_URL).href;
const VERSION_URL = new URL("version.json", ROOT_URL).href;

let toastTimer = null;
let swRegistration = null;
let updateDismissed = false;
let isReloading = false;
let lastCheckTimestamp = 0;

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

export function clearAppStorage(storageKey) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Im iOS Safari Privatmodus wird nur der Arbeitsspeicher verwendet.
  }
}

/**
 * Zentraler Input-Parser für Baustellen-Zahleneingaben (DE Komma & EN Punkt).
 * Verhindert zuverlässig NaN/Infinity bei leeren oder unvollständigen Eingaben.
 */
export function parseLocaleNumber(raw, fallback = 0, min = -Infinity, max = Infinity) {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return fallback;
    return Math.min(max, Math.max(min, raw));
  }
  const str = String(raw ?? "").replace(/\s+/g, "").trim();
  if (!str || str === "-" || str === "+" || str === "," || str === ".") {
    return fallback;
  }

  let normalized = str;
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Letztes Trennzeichen bestimmt das Dezimaltrennzeichen; das andere ist Tausenderpunkt/-komma.
    if (lastComma > lastDot) {
      normalized = str.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = str.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    normalized = str.replace(",", ".");
  }

  const num = Number(normalized);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

/**
 * Kopiert Text in die Zwischenablage (mit Fallback für ältere Browser/WebViews)
 * und zeigt eine kurze Rückmeldung im globalen Toast-Banner.
 */
export async function copyTextToClipboard(text) {
  const value = String(text ?? "").trim();
  if (!value) return false;

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(value);
      showToast("In Zwischenablage kopiert");
      return true;
    }
  } catch {
    // Fallback über temporäres Textarea nutzen
  }

  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.pointerEvents = "none";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    showToast(ok ? "In Zwischenablage kopiert" : "Kopieren fehlgeschlagen");
    return ok;
  } catch {
    showToast("Kopieren fehlgeschlagen");
    return false;
  }
}

export function wireCopyResultButton(btnId, getTextFn) {
  const btn = document.getElementById(btnId);
  if (!btn || typeof getTextFn !== "function") return;
  btn.addEventListener("click", () => {
    void copyTextToClipboard(getTextFn());
  });
}

/**
 * Deregistriert aktive Service Worker, leert den gesamten Cache Storage und lädt die App neu.
 */
export async function forceCacheReset() {
  if (isReloading) return;
  isReloading = true;

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch {
    // Auch falls Cache-Bereinigung blockiert ist, erzwingt reload() den Neustart.
  }

  window.location.reload();
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

async function applyAppUpdate() {
  if (isReloading) return;
  isReloading = true;

  try {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch {
    // Auch falls Cache-Bereinigung blockiert ist, erzwingt reload() den Neustart.
  }

  window.location.reload();
}

function showUpdateBanner(remoteVersion) {
  if (updateDismissed || !document.body) return;
  let banner = document.getElementById("app-update-banner");

  if (!banner) {
    banner = document.createElement("aside");
    banner.id = "app-update-banner";
    banner.className = "liquid-glass update-banner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "App-Aktualisierung");

    const icon = document.createElement("span");
    icon.className = "material-symbols-rounded update-banner-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "system_update";

    const textWrap = document.createElement("div");
    textWrap.className = "update-banner-text";

    const title = document.createElement("strong");
    title.className = "update-banner-title";
    title.textContent = "Neue Version verfügbar";

    const sub = document.createElement("span");
    sub.className = "update-banner-sub";

    textWrap.append(title, sub);

    const actions = document.createElement("div");
    actions.className = "update-banner-actions";

    const reloadBtn = document.createElement("button");
    reloadBtn.type = "button";
    reloadBtn.className = "update-banner-btn press-btn";
    reloadBtn.textContent = "Aktualisieren";
    reloadBtn.addEventListener("click", () => {
      reloadBtn.disabled = true;
      reloadBtn.textContent = "Lädt …";
      void applyAppUpdate();
    });

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "update-banner-close press-icon";
    closeBtn.setAttribute("aria-label", "Hinweis schließen");
    const closeIcon = document.createElement("span");
    closeIcon.className = "material-symbols-rounded";
    closeIcon.setAttribute("aria-hidden", "true");
    closeIcon.textContent = "close";
    closeBtn.appendChild(closeIcon);
    closeBtn.addEventListener("click", () => {
      updateDismissed = true;
      banner.setAttribute("data-visible", "false");
    });

    actions.append(reloadBtn, closeBtn);
    banner.append(icon, textWrap, actions);
    document.body.appendChild(banner);
  }

  const subEl = banner.querySelector(".update-banner-sub");
  if (subEl) {
    subEl.textContent = remoteVersion
      ? `Version ${remoteVersion} steht bereit`
      : "Änderungen sind bereit zum Laden";
  }

  window.requestAnimationFrame(() => {
    banner.setAttribute("data-visible", "true");
  });
}

export async function checkForAppUpdate({ manual = false } = {}) {
  const now = Date.now();
  if (!manual && now - lastCheckTimestamp < 15000) return false;
  lastCheckTimestamp = now;

  try {
    if (swRegistration) {
      await swRegistration.update();
      if (swRegistration.waiting) {
        if (manual) updateDismissed = false;
        showUpdateBanner("");
        return true;
      }
    }

    const res = await fetch(`${VERSION_URL}?t=${now}`, { cache: "no-store" });
    if (!res.ok) {
      if (manual) showToast("Update-Prüfung fehlgeschlagen");
      return false;
    }

    const data = await res.json();
    const remoteVersion = typeof data?.version === "string" ? data.version.trim() : "";

    if (remoteVersion && remoteVersion !== APP_VERSION) {
      if (manual) updateDismissed = false;
      showUpdateBanner(remoteVersion);
      return true;
    }

    if (manual) {
      showToast(`Aktuell (v${APP_VERSION})`);
    }
    return false;
  } catch {
    if (manual) {
      showToast("Offline – Update-Prüfung nicht möglich");
    }
    return false;
  }
}

function initServiceWorkerAndUpdates() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register(SW_URL, { scope: ROOT_URL.href, updateViaCache: "none" })
      .then((reg) => {
        swRegistration = reg;
        if (reg.waiting) {
          showUpdateBanner("");
        }
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateBanner("");
            }
          });
        });
      })
      .catch(() => {
        // Fallback: Versionsprüfung über version.json funktioniert auch ohne Service Worker.
      });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!isReloading) {
        isReloading = true;
        window.location.reload();
      }
    });
  }

  const runCheck = () => {
    void checkForAppUpdate();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runCheck, { once: true });
  } else {
    runCheck();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      runCheck();
    }
  });
}

// Theme beim Laden sofort anwenden, um Flackern (FOUC) zu vermeiden
export function initFloatingNav() {
  const nav = document.querySelector(".floating-nav");
  if (!nav) return;

  const viewSettings = document.getElementById("view-settings");
  const backBtn = document.getElementById("nav-back-btn");
  const settingsBtn = document.getElementById("settings-toggle-btn");

  const syncState = () => {
    const inSettings = Boolean(viewSettings && !viewSettings.hidden);
    const items = nav.querySelectorAll("[data-nav-action]");
    items.forEach((btn) => {
      const action = btn.dataset.navAction;
      let isActive = false;
      if (action === "settings") isActive = inSettings;
      else if (action === "home" || action === "calc") isActive = !inSettings;
      btn.classList.toggle("active", isActive);
      const icon = btn.querySelector(".material-symbols-rounded");
      if (icon) icon.classList.toggle("is-active", isActive);
    });
  };

  nav.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-nav-action]");
    if (!btn) return;
    const action = btn.dataset.navAction;
    if (action === "settings") {
      if (viewSettings && viewSettings.hidden && settingsBtn) {
        settingsBtn.click();
      }
    } else if (action === "home" || action === "calc") {
      if (viewSettings && !viewSettings.hidden && backBtn) {
        backBtn.click();
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else if (action === "print") {
      window.print();
    }
  });

  if (viewSettings && typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver(syncState);
    observer.observe(viewSettings, { attributes: true, attributeFilter: ["hidden"] });
  }
  syncState();
}

if (typeof document !== "undefined") {
  applyThemeMode(getStoredThemeMode());
  initNumInputSizingFallback();
  initServiceWorkerAndUpdates();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFloatingNav, { once: true });
  } else {
    initFloatingNav();
  }
}
