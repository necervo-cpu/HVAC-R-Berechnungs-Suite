/**
 * Modul: Globale Hilfsfunktionen & 3-Stufen-Theme-Steuerung (assets/js/shared.js)
 * Zweck: Stellt allen Seiten (Dashboard & Einzel-Apps) die FOUC-freie Dual-Theme-Initialisierung
 *   ('dark' #000000 | 'light' #F2F2F7 via ag-theme & prefers-color-scheme), UI-Helfer für
 *   Segmented-Pills, Toast-Meldungen und Reduced-Motion-Abfrage bereit.
 * Verantwortlichkeit: Dual-Theme-Persistenz ('ag-theme'), Header-Umschalter (#themeToggleBtn),
 *   Statusbar-Meta-Sync und gemeinsame DOM-Interaktionshelfer.
 * Sicherheits- & Stabilitätsrelevanz: Whitelist-Validierung für Theme-Werte und
 *   try/catch-Kapselung von localStorage für den iOS Safari Privatmodus.
 */

export const APP_VERSION = "1.5.4";
export const BUILD_DATE = "2026-11-15";

export const THEME_STORAGE_KEY = "ag-theme";
const TOP_LIGHT = "#F2F2F7";
const TOP_DARK = "#000000";
const ROOT_URL = new URL("../../", import.meta.url);
const SW_URL = new URL("sw.js", ROOT_URL).href;
const VERSION_URL = new URL("version.json", ROOT_URL).href;

let toastTimer = null;
let swRegistration = null;
let isReloading = false;
let lastCheckTimestamp = 0;
let memoryThemeOverride = null;

export function isValidThemeMode(value) {
  return value === "auto" || value === "light" || value === "dark";
}

export function resolveEffectiveTheme(mode) {
  if (mode === "light" || mode === "dark") return mode;
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }
  return "dark";
}

export function getStoredThemeMode() {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark") {
      return raw;
    }
    return "auto";
  } catch {
    return memoryThemeOverride || "auto";
  }
}

function syncStatusBarMeta(effectiveTheme) {
  const effective = resolveEffectiveTheme(effectiveTheme);
  const targetColor = effective === "dark" ? TOP_DARK : TOP_LIGHT;

  document.querySelectorAll('meta[name="theme-color"]').forEach((tag) => {
    tag.setAttribute("content", targetColor);
  });
}

function syncThemeUI(safeMode, effective) {
  if (typeof document === "undefined") return;
  const toggleIcon = document.getElementById("themeToggleIcon");
  if (toggleIcon) {
    toggleIcon.textContent = effective === "dark" ? "light_mode" : "dark_mode";
  }
  const toggleBtn = document.getElementById("themeToggleBtn");
  if (toggleBtn) {
    const label = effective === "dark" ? "Hellmodus aktivieren" : "Dunkelmodus aktivieren";
    toggleBtn.setAttribute("aria-label", label);
    toggleBtn.setAttribute("title", label);
  }
  const modeGroup = document.getElementById("theme-mode-group");
  if (modeGroup) {
    modeGroup.querySelectorAll("[data-theme-mode]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.themeMode === safeMode));
    });
  }
}

export function applyThemeMode(mode) {
  const safeMode = isValidThemeMode(mode) ? mode : "auto";
  const effective = resolveEffectiveTheme(safeMode);
  const root = document.documentElement;
  root.setAttribute("data-theme", effective);
  memoryThemeOverride = safeMode;

  try {
    if (safeMode === "auto") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, safeMode);
    }
  } catch {
    // Im iOS Safari Privatmodus wird nur der Arbeitsspeicher-/DOM-Zustand verwendet.
  }

  syncStatusBarMeta(effective);
  syncThemeUI(safeMode, effective);
  return safeMode;
}

export function toggleTheme() {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  const current = root && root.getAttribute("data-theme") === "light" ? "light" : "dark";
  const next = current === "dark" ? "light" : "dark";
  return applyThemeMode(next);
}

export function getCurrentThemeMode() {
  return getStoredThemeMode();
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
  const text = toast.querySelector("#toast-text");
  if (text) text.textContent = message;
  else toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
}

/**
 * Überblenden innerhalb einer Seite: alte Fläche kurz aus-, neue weich einblenden.
 */
export function fadeThrough(from, to, between) {
  const reduced = prefersReducedMotion();
  if (!from || !to || from === to) {
    if (to) to.hidden = false;
    if (between) between();
    return;
  }
  const out = from.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: reduced ? 1 : 90,
    easing: "linear",
    fill: "forwards",
  });
  out.onfinish = () => {
    from.hidden = true;
    out.cancel();
    to.hidden = false;
    if (between) between();
    to.animate(
      [
        { opacity: 0, transform: "scale(0.98)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: reduced ? 1 : 210, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
    );
  };
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
      showToast("Kopiert");
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
    showToast(ok ? "Kopiert" : "Kopieren nicht möglich. Text markieren und von Hand kopieren.");
    return ok;
  } catch {
    showToast("Kopieren nicht möglich. Text markieren und von Hand kopieren.");
    return false;
  }
}

export function wireCopyResultButton(btnId, getTextFn) {
  const btn = document.getElementById(btnId);
  if (!btn || typeof getTextFn !== "function") return;
  btn.addEventListener("click", async () => {
    const text = getTextFn();
    const ok = await copyTextToClipboard(text);
    if (ok) {
      const icon = btn.querySelector(".material-symbols-rounded");
      if (icon) {
        const prevIcon = icon.textContent;
        const prevColor = icon.style.color;
        icon.textContent = "check";
        icon.style.color = "var(--system-green)";
        setTimeout(() => {
          icon.textContent = prevIcon;
          icon.style.color = prevColor;
        }, 1800);
      }
    }
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

/**
 * Baustellen-Ergonomie für Zahleneingaben:
 * 1. Automatisches .select() bei focus/click, damit Werte sofort überschrieben werden können.
 * 2. Automatische Komma-zu-Punkt-Konvertierung beim Tippen oder Einfügen.
 */
function initInputErgonomics() {
  const isNumericField = (el) =>
    el instanceof HTMLInputElement &&
    (el.type === "number" ||
      el.inputMode === "decimal" ||
      el.inputMode === "numeric" ||
      el.classList.contains("value-input") ||
      el.classList.contains("glass-input"));

  // Auto-Select bei Fokus / Klick (für sofortiges Überschreiben ohne Backspace)
  document.addEventListener("focusin", (e) => {
    if (isNumericField(e.target)) {
      setTimeout(() => {
        try {
          e.target.select();
        } catch {}
      }, 0);
    }
  });

  document.addEventListener("click", (e) => {
    if (isNumericField(e.target) && document.activeElement === e.target) {
      try {
        e.target.select();
      } catch {}
    }
  });

  // Komma (,) automatisch in Punkt (.) umwandeln
  document.addEventListener("input", (e) => {
    const target = e.target;
    if (isNumericField(target) && target.type !== "number") {
      if (typeof target.value === "string" && target.value.includes(",")) {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        target.value = target.value.replace(/,/g, ".");
        if (start !== null && end !== null) {
          try {
            target.setSelectionRange(start, end);
          } catch {}
        }
      }
    }
  });
}

export async function applyAppUpdate(targetVersion = "") {
  if (isReloading) return;
  isReloading = true;
  showToast(targetVersion ? `Update auf v${targetVersion} wird geladen` : "Update wird geladen");

  try {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
    if (swRegistration) {
      await swRegistration.update();
    }
  } catch {
    // Auch falls Cache-Bereinigung blockiert ist, erzwingt reload() den Neustart.
  }

  // Wichtig: localStorage (ag-theme und Rechnerdaten) wird NIEMALS gelöscht!
  window.location.reload();
}

export function setSettingsUpdateIndicator(visible) {
  const settingsBtn = document.getElementById("settings-toggle-btn");
  if (!settingsBtn) return;
  let dot = settingsBtn.querySelector(".settings-update-dot");
  if (visible) {
    if (!dot) {
      dot = document.createElement("span");
      dot.className = "status-dot settings-update-dot";
      dot.style.color = "var(--system-cyan)";
      dot.setAttribute("role", "img");
      dot.setAttribute("aria-label", "Update verfügbar");
      settingsBtn.appendChild(dot);
    }
  } else if (dot) {
    dot.remove();
  }
}

export async function checkForAppUpdate({ manual = false } = {}) {
  const now = Date.now();
  if (!manual && now - lastCheckTimestamp < 15000) return false;
  lastCheckTimestamp = now;

  try {
    if (swRegistration) {
      await swRegistration.update();
      if (swRegistration.waiting) {
        setSettingsUpdateIndicator(true);
        setSettingsUpdateIndicator(true);
        if (manual) {
          await applyAppUpdate();
        }
        return true;
      }
    }

    const res = await fetch(`${VERSION_URL}?t=${now}`, { cache: "no-store" });
    if (!res.ok) {
      if (manual) showToast("Update-Prüfung nicht möglich oder offline");
      return false;
    }

    const data = await res.json();
    const remoteVersion = typeof data?.version === "string" ? data.version.trim() : "";

    if (remoteVersion && remoteVersion !== APP_VERSION) {
      setSettingsUpdateIndicator(true);
      if (manual) {
        await applyAppUpdate(remoteVersion);
      } else {
        setSettingsUpdateIndicator(true);
      }
      return true;
    }

    setSettingsUpdateIndicator(false);
    if (manual) {
      showToast(`Aktuellste Version v${APP_VERSION} ist installiert`);
    }
    return false;
  } catch {
    if (manual) {
      showToast("Update-Prüfung nicht möglich oder offline");
    }
    return false;
  }
}

function initServiceWorkerAndUpdates() {
  const startBackgroundTasks = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(SW_URL, { scope: ROOT_URL.href, updateViaCache: "none" })
        .then((reg) => {
          swRegistration = reg;
          if (reg.waiting) {
            setSettingsUpdateIndicator(true);
          }
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                setSettingsUpdateIndicator(true);
              }
            });
          });

          // Unterseiten erst 3 Sekunden nach komplettem Seitenaufbau gedrosselt im Hintergrund vorcachen
          window.setTimeout(() => {
            const activeWorker = reg.active || navigator.serviceWorker.controller;
            if (activeWorker) {
              activeWorker.postMessage({ type: "PREFETCH_SUB_APPS" });
            }
          }, 3000);
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

    window.setTimeout(() => {
      void checkForAppUpdate();
    }, 1500);
  };

  if (document.readyState === "complete") {
    startBackgroundTasks();
  } else {
    window.addEventListener("load", startBackgroundTasks, { once: true });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void checkForAppUpdate();
    }
  });
}

/**
 * Auswahl als Dropdown: Mehr als 3 Optionen oder Optionen, die breiter sind als der Bildschirm,
 * erscheinen als Auswahlfeld. Die Original-Schaltflächen bleiben (versteckt) bestehen und werden
 * bei Änderung angeklickt, die App-Logik bleibt dadurch unverändert.
 */
const CHOICE_SELECTOR = ".tab-strip:not([data-choice-keep]), .segmented-control:not([data-choice-keep])";
const choiceFields = new WeakMap();

function choiceLabel(btn) {
  const clone = btn.cloneNode(true);
  clone.querySelectorAll(".material-symbols-rounded").forEach((n) => n.remove());
  return clone.textContent.replace(/\s+/g, " ").trim();
}

function choiceActiveIndex(buttons) {
  return buttons.findIndex(
    (b) => b.getAttribute("aria-selected") === "true" || b.getAttribute("aria-pressed") === "true",
  );
}

function syncChoice(container) {
  const buttons = Array.from(container.querySelectorAll("button"));
  let field = choiceFields.get(container);
  if (buttons.length < 2) {
    if (field) field.wrap.hidden = true;
    return;
  }

  let needDropdown = buttons.length > 3;
  if (!needDropdown && container.offsetParent !== null) {
    const wasHidden = container.hidden;
    container.hidden = false;
    needDropdown = container.scrollWidth > container.clientWidth + 1;
    container.hidden = wasHidden;
  } else if (!needDropdown && field && !field.wrap.hidden) {
    needDropdown = true;
  }

  if (!needDropdown) {
    container.hidden = false;
    if (field) field.wrap.hidden = true;
    return;
  }

  if (!field) {
    const wrap = document.createElement("div");
    wrap.className = container.dataset.choiceAction ? "choice-select choice-select--action" : "choice-select";
    const select = document.createElement("select");
    select.className = "choice-select-input";
    const label = container.getAttribute("aria-label");
    if (label) select.setAttribute("aria-label", label);
    const icon = document.createElement("span");
    icon.className = "material-symbols-rounded";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "expand_more";
    wrap.append(select, icon);
    container.after(wrap);
    select.addEventListener("change", () => {
      if (select.value === "") return;
      const current = Array.from(container.querySelectorAll("button"));
      const target = current[Number(select.value)];
      if (container.dataset.choiceAction) select.value = "";
      if (target) target.click();
    });
    field = { wrap, select, signature: "" };
    choiceFields.set(container, field);
  }

  const action = container.dataset.choiceAction || "";
  const labels = buttons.map(choiceLabel);
  const signature = `${action}\u0002${labels.join("\u0001")}`;
  if (field.signature !== signature) {
    field.signature = signature;
    const options = labels.map((text, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = text;
      return opt;
    });
    if (action) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = action;
      options.unshift(placeholder);
    }
    field.select.replaceChildren(...options);
  }
  if (action) {
    if (field.select.value !== "") field.select.value = "";
  } else {
    const active = choiceActiveIndex(buttons);
    if (active >= 0 && field.select.value !== String(active)) field.select.value = String(active);
  }
  field.wrap.hidden = false;
  container.hidden = true;
}

function syncAllChoices() {
  document.querySelectorAll(CHOICE_SELECTOR).forEach(syncChoice);
}

/**
 * Zahlenfelder mit Einheit: gleicher Innenabstand links und rechts, damit der Wert mittig steht.
 */
function syncUnitPadding(wrapper) {
  const unit = wrapper.querySelector(".input-unit-addon");
  const input = wrapper.querySelector(".glass-input");
  if (!unit || !input) return;
  const pad = `${Math.ceil(unit.getBoundingClientRect().width) + 20}px`;
  input.style.paddingInline = pad;
}

function initUnitPadding() {
  if (typeof ResizeObserver !== "function") return;
  const observer = new ResizeObserver((entries) => {
    entries.forEach((e) => {
      const wrapper = e.target.closest(".input-wrapper");
      if (wrapper) syncUnitPadding(wrapper);
    });
  });
  const attach = () => {
    document.querySelectorAll(".input-wrapper .input-unit-addon").forEach((u) => {
      if (u.dataset.padBound) return;
      u.dataset.padBound = "true";
      observer.observe(u);
    });
  };
  attach();
  new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
}

function initChoiceDropdowns() {
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      syncAllChoices();
    });
  };
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-selected", "aria-pressed", "class"],
  });
  window.addEventListener("resize", schedule);
  syncAllChoices();
}

/**
 * Initialisiert Header-Theme-Button (#themeToggleBtn) und System-Preference-Listener.
 */
export function initThemeControls() {
  const mode = getStoredThemeMode();
  syncThemeUI(mode, resolveEffectiveTheme(mode));

  const toggleBtn = document.getElementById("themeToggleBtn");
  if (toggleBtn && !toggleBtn.dataset.themeBound) {
    toggleBtn.dataset.themeBound = "true";
    toggleBtn.addEventListener("click", () => {
      toggleTheme();
    });
  }

  if (typeof window !== "undefined") {
    window.toggleTheme = toggleTheme;
    if (window.matchMedia && !window.__agThemeMediaBound) {
      window.__agThemeMediaBound = true;
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      const onSystemThemeChange = () => {
        if (getStoredThemeMode() === "auto") {
          applyThemeMode("auto");
        }
      };
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onSystemThemeChange);
      } else if (typeof mq.addListener === "function") {
        mq.addListener(onSystemThemeChange);
      }
    }
  }
}

if (typeof document !== "undefined") {
  // Zoom gesperrt: iOS ignoriert user-scalable=no, daher Pinch-Gesten abfangen
  ["gesturestart", "gesturechange", "gestureend"].forEach((name) =>
    document.addEventListener(name, (e) => e.preventDefault(), { passive: false }),
  );
  applyThemeMode(getStoredThemeMode());
  initServiceWorkerAndUpdates();
  const initDomFeatures = () => {
    initThemeControls();
    initInputErgonomics();
    initChoiceDropdowns();
    initUnitPadding();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDomFeatures, { once: true });
  } else {
    initDomFeatures();
  }
}
