/**
 * Modul: Dashboard / App-Launcher Steuerung (assets/js/dashboard.js)
 * Zweck: Steuert die Startseiten-Übersicht (Suche, Zeilen zu den Einzel-Apps unter
 *   ./apps/<app-name>/) und die Einstellungs-Karte (Darstellung, Updates).
 * Verantwortlichkeit: Filterung der Zeilen, Prefetch am Desktop und Theme-Segment.
 */

import {
  APP_VERSION,
  BUILD_DATE,
  applyThemeMode,
  checkForAppUpdate,
  forceCacheReset,
  getCurrentThemeMode,
  showToast,
} from "./shared.js";

const MODULES = [
  { id: "heizkurve", title: "Heizkurve", sub: "Simulator mit drei Einstellpunkten nach Lambda", keywords: "heizkurve vorlauf außentemperatur lambda wärmepumpe fußbodenheizung heizkörper offset steilheit kurve" },
  { id: "sensor", title: "PTC / NTC Sensoren", sub: "Ohm ↔ °C für NTC, PT100, PT1000 und KTY81", keywords: "ntc ptc pt100 pt1000 kty81 2k 5k 10k 12k 20k ohm fühler sensor temperatur" },
  { id: "waermeleistung", title: "Wärmeleistung (Q̇)", sub: "Volumenstrom, Spreizung und Heizlast", keywords: "wärmeleistung heizleistung leistung q volumenstrom spreizung heizlast wasser glykol kw" },
  { id: "rohrnetz", title: "Rohrnetz & Druckverlust", sub: "Fließgeschwindigkeit v (m/s) und R (mbar/m)", keywords: "rohrnetz rohr dimension dn kupfer verbund pex c-stahl gewinderohr druckverlust geschwindigkeit reibung" },
  { id: "kaeltemittel", title: "Kältemittel & SH / SC", sub: "Druck ↔ °C, Überhitzung und Unterkühlung", keywords: "kältemittel r32 r410a r290 r134a r404a r449a r1234yf r744 co2 druck temperatur überhitzung unterkühlung sh sc" },
  { id: "taupunkt", title: "Taupunkt & Feuchte", sub: "Taupunkt, Absolutfeuchte, Enthalpie und Tauwasser", keywords: "taupunkt luftfeuchte feuchte tauwasser kondensation enthalpie kühldecke schimmel magnus" },
  { id: "mag", title: "MAG & Vordruck", sub: "Stickstoff-Vordruck p₀, pₐ und Gefäßgröße (l)", keywords: "mag ausdehnungsgefäß vordruck fülldruck en 12828 sicherheitsventil statische höhe liter" },
  { id: "luftkanal", title: "Luftkanal & RLT", sub: "Geschwindigkeit v (m/s), DN und Luftwechsel", keywords: "luftkanal rlt lüftung wickelfalzrohr rechteckkanal geschwindigkeit luftwechsel volumenstrom leistung" },
];

const state = {
  query: "",
};

const prefetchedUrls = new Set();

function prefetchAppHref(href) {
  if (!href || prefetchedUrls.has(href) || typeof document === "undefined") return;
  prefetchedUrls.add(href);

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "document";
  link.href = href;
  document.head.appendChild(link);
}

function wireTilePrefetch(container) {
  if (!container) return;
  container.querySelectorAll("a.row[href]").forEach((tile) => {
    if (tile.dataset.prefetchBound) return;
    tile.dataset.prefetchBound = "true";
    const href = tile.getAttribute("href");
    const triggerPrefetch = () => prefetchAppHref(href);
    tile.addEventListener("pointerenter", triggerPrefetch, { passive: true });
  });
}
function renderSettingsTheme() {
  const mode = getCurrentThemeMode();
  const group = document.getElementById("theme-mode-group");
  if (!group) return;
  group.querySelectorAll("[data-theme-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.getAttribute("data-theme-mode") === mode));
  });
}

function renderHubGrid() {
  const grid = document.getElementById("hub-grid");
  const empty = document.getElementById("hub-empty");
  if (!grid || !empty) return;

  const q = state.query.trim().toLowerCase();
  const moduleMap = new Map(MODULES.map((m) => [m.id, m]));
  let totalVisible = 0;

  grid.querySelectorAll(".hub-section").forEach((section) => {
    let sectionVisible = 0;

    section.querySelectorAll(".row[data-module-id]").forEach((row) => {
      const mod = moduleMap.get(row.dataset.moduleId);
      const matches =
        !q ||
        (mod &&
          (mod.title.toLowerCase().includes(q) ||
            mod.sub.toLowerCase().includes(q) ||
            mod.keywords.includes(q)));

      row.hidden = !matches;
      if (matches) {
        sectionVisible += 1;
        totalVisible += 1;
      }
    });

    const countEl = section.querySelector(".section-count");
    if (countEl) countEl.textContent = String(sectionVisible);
    section.hidden = sectionVisible === 0;
  });

  empty.hidden = totalVisible > 0;
  wireTilePrefetch(grid);
}

let lastFocus = null;

function setSettingsOpen(open) {
  const modal = document.getElementById("settingsModal");
  const shell = document.getElementById("appShell");
  if (!modal) return;
  modal.classList.toggle("is-open", open);
  if (shell) shell.inert = open;
  if (open) {
    lastFocus = document.activeElement;
    renderSettingsTheme();
    const first = modal.querySelector("button");
    if (first) first.focus();
  } else if (lastFocus) {
    lastFocus.focus();
  }
}

function wireEvents() {
  const searchInput = document.getElementById("hub-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.query = searchInput.value;
      renderHubGrid();
    });
  }

  const settingsBtn = document.getElementById("settings-toggle-btn");
  if (settingsBtn) settingsBtn.addEventListener("click", () => setSettingsOpen(true));
  const closeBtn = document.getElementById("settingsCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", () => setSettingsOpen(false));
  const modal = document.getElementById("settingsModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) setSettingsOpen(false);
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setSettingsOpen(false);
  });

  const themeModeGroup = document.getElementById("theme-mode-group");

  if (themeModeGroup) {
    themeModeGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-theme-mode]");
      if (!btn) return;
      applyThemeMode(btn.getAttribute("data-theme-mode"));
      renderSettingsTheme();
    });
  }

  const checkUpdateBtn = document.getElementById("check-update-btn");
  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener("click", async () => {
      checkUpdateBtn.disabled = true;
      await checkForAppUpdate({ manual: true });
      checkUpdateBtn.disabled = false;
    });
  }

  const forceCacheResetBtn = document.getElementById("force-cache-reset-btn");
  if (forceCacheResetBtn) {
    forceCacheResetBtn.addEventListener("click", async () => {
      forceCacheResetBtn.disabled = true;
      showToast("Cache wird geleert");
      await forceCacheReset();
    });
  }
}

function init() {
  const versionLabel = document.getElementById("app-version-label");
  if (versionLabel) versionLabel.textContent = `v${APP_VERSION}`;
  const buildDateLabel = document.getElementById("app-build-date");
  if (buildDateLabel) buildDateLabel.textContent = BUILD_DATE;
  wireEvents();
  renderSettingsTheme();
  const grid = document.getElementById("hub-grid");
  if (grid && grid.children.length > 0 && !state.query) {
    wireTilePrefetch(grid);
  } else {
    renderHubGrid();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
