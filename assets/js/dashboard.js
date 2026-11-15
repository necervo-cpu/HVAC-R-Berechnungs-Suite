/**
 * Modul: Dashboard / App-Launcher Steuerung (assets/js/dashboard.js)
 * Zweck: Steuert ausschließlich die Startseiten-Übersicht (Suche, Kategorie-Filter,
 *   Verlinkungs-Kacheln zu den Einzel-Apps unter ./apps/<app-name>/) sowie die
 *   Darstellungs-Einstellungen (Auto / Hell / Dunkel).
 * Verantwortlichkeit: Filterung der Tool-Karten, Navigation zu Einzel-Apps über relative Pfade
 *   und Synchronisation des 3-Stufen-Theme-Umschalters.
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
  {
    id: "sensor",
    title: "PTC / NTC Sensoren",
    sub: "Ohm ↔ °C · NTC 2k–20k, PT100/1000, KTY81",
    category: "kaelte",
    tone: "cool",
    live: true,
    href: "./apps/sensor/index.html",
    keywords: "ntc ptc pt100 pt1000 kty81 2k 5k 10k 12k 20k ohm fühler sensor temperatur",
    icon: `<span class="material-symbols-rounded" aria-hidden="true">thermostat</span>`,
  },
  {
    id: "waermeleistung",
    title: "Wärmeleistung (Q̇)",
    sub: "Hydraulik (V̇·ΔT), Volumenstrom & Heizlast",
    category: "heizung",
    tone: "warm",
    live: true,
    href: "./apps/waermeleistung/index.html",
    keywords: "wärmeleistung heizleistung leistung q volumenstrom spreizung heizlast wasser glykol kw",
    icon: `<span class="material-symbols-rounded" aria-hidden="true">local_fire_department</span>`,
  },
  {
    id: "rohrnetz",
    title: "Rohrnetz & Druckverlust",
    sub: "Fließgeschwindigkeit v (m/s) & R (mbar/m)",
    category: "heizung",
    tone: "cool",
    live: true,
    href: "./apps/rohrnetz/index.html",
    keywords: "rohrnetz rohr dimension dn kupfer verbund pex c-stahl gewinderohr druckverlust geschwindigkeit reibung",
    icon: `<span class="material-symbols-rounded" aria-hidden="true">plumbing</span>`,
  },
  {
    id: "kaeltemittel",
    title: "Kältemittel & SH / SC",
    sub: "Druck ↔ °C · Überhitzung & Unterkühlung",
    category: "kaelte",
    tone: "cool",
    live: true,
    href: "./apps/kaeltemittel/index.html",
    keywords: "kältemittel r32 r410a r290 r134a r404a r449a r1234yf r744 co2 druck temperatur überhitzung unterkühlung sh sc",
    icon: `<span class="material-symbols-rounded" aria-hidden="true">ac_unit</span>`,
  },
  {
    id: "taupunkt",
    title: "Taupunkt & Feuchte",
    sub: "Taupunkt °C, g/m³, Enthalpie & Tauwasser",
    category: "lueftung",
    tone: "cool",
    live: true,
    href: "./apps/taupunkt/index.html",
    keywords: "taupunkt luftfeuchte feuchte tauwasser kondensation enthalpie kühldecke schimmel magnus",
    icon: `<span class="material-symbols-rounded" aria-hidden="true">water_drop</span>`,
  },
  {
    id: "mag",
    title: "MAG & Vordruck",
    sub: "Stickstoff-Vordruck p₀, pₐ & Gefäßgröße (l)",
    category: "heizung",
    tone: "warm",
    live: true,
    href: "./apps/mag/index.html",
    keywords: "mag ausdehnungsgefäß vordruck fülldruck en 12828 sicherheitsventil statische höhe liter",
    icon: `<span class="material-symbols-rounded" aria-hidden="true">compress</span>`,
  },
  {
    id: "luftkanal",
    title: "Luftkanal & RLT",
    sub: "Geschwindigkeit v (m/s), DN & Luftwechsel",
    category: "lueftung",
    tone: "cool",
    live: true,
    href: "./apps/luftkanal/index.html",
    keywords: "luftkanal rlt lüftung wickelfalzrohr rechteckkanal geschwindigkeit luftwechsel volumenstrom leistung",
    icon: `<span class="material-symbols-rounded" aria-hidden="true">air</span>`,
  },
];

const state = {
  view: "home",
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
  container.querySelectorAll("a.row[href], a.hub-tile[href]").forEach((tile) => {
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
    const isActive = btn.getAttribute("data-theme-mode") === mode;
    btn.setAttribute("aria-checked", String(isActive));
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
    let firstVisibleSeen = false;

    section.querySelectorAll(".row[data-module-id]").forEach((row) => {
      const mod = moduleMap.get(row.dataset.moduleId);
      const matches =
        !q ||
        (mod &&
          (mod.title.toLowerCase().includes(q) ||
            mod.sub.toLowerCase().includes(q) ||
            mod.keywords.includes(q)));

      row.hidden = !matches;
      row.classList.remove("row--visible-after-hidden");
      if (matches) {
        if (!firstVisibleSeen) {
          row.classList.add("row--visible-after-hidden");
          firstVisibleSeen = true;
        }
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

function openSettings() {
  state.view = "settings";
  const heroHome = document.getElementById("hero-home");
  const topBar = document.getElementById("top-bar");
  const homeView = document.getElementById("view-home");
  const settingsView = document.getElementById("view-settings");

  if (heroHome) heroHome.hidden = true;
  if (topBar) topBar.hidden = false;
  if (homeView) homeView.hidden = true;
  if (settingsView) {
    settingsView.hidden = false;
    settingsView.classList.remove("is-entering");
    void settingsView.offsetWidth;
    settingsView.classList.add("is-entering");
  }

  renderSettingsTheme();
}

function openHome() {
  state.view = "home";
  const heroHome = document.getElementById("hero-home");
  const topBar = document.getElementById("top-bar");
  const homeView = document.getElementById("view-home");
  const settingsView = document.getElementById("view-settings");

  if (heroHome) heroHome.hidden = false;
  if (topBar) topBar.hidden = true;
  if (settingsView) settingsView.hidden = true;
  if (homeView) {
    homeView.hidden = false;
    homeView.classList.remove("is-entering");
    void homeView.offsetWidth;
    homeView.classList.add("is-entering");
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

  const backBtn = document.getElementById("nav-back-btn");
  if (backBtn) backBtn.addEventListener("click", openHome);

  const settingsBtn = document.getElementById("settings-toggle-btn");
  const themeModeGroup = document.getElementById("theme-mode-group");

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      if (state.view === "settings") {
        openHome();
      } else {
        openSettings();
      }
    });
  }

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
      showToast("Cache wird geleert …");
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
