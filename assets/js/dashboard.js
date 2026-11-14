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
  applyThemeMode,
  checkForAppUpdate,
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
    icon: `<span class="ag-icon ag-icon--sm" aria-hidden="true">thermostat</span>`,
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
    icon: `<span class="ag-icon ag-icon--sm" aria-hidden="true">local_fire_department</span>`,
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
    icon: `<span class="ag-icon ag-icon--sm" aria-hidden="true">plumbing</span>`,
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
    icon: `<span class="ag-icon ag-icon--sm" aria-hidden="true">ac_unit</span>`,
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
    icon: `<span class="ag-icon ag-icon--sm" aria-hidden="true">water_drop</span>`,
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
    icon: `<span class="ag-icon ag-icon--sm" aria-hidden="true">compress</span>`,
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
    icon: `<span class="ag-icon ag-icon--sm" aria-hidden="true">air</span>`,
  },
];

const state = {
  view: "home",
  query: "",
};

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
  const filtered = MODULES.filter((mod) => {
    return (
      !q ||
      mod.title.toLowerCase().includes(q) ||
      mod.sub.toLowerCase().includes(q) ||
      mod.keywords.includes(q)
    );
  });

  if (filtered.length === 0) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  grid.innerHTML = filtered
    .map((mod, index) => {
      const inner = `
        <div class="hub-tile-main">
          <span class="hub-tile-icon">${mod.icon}</span>
          <div class="hub-tile-body">
            <div class="hub-tile-title-row">
              <span class="hub-tile-title">${mod.title}</span>
              <span class="hub-tile-badge" data-live="${String(mod.live)}">
                ${mod.live ? "Aktiv" : "Geplant"}
              </span>
            </div>
            <span class="hub-tile-sub">${mod.sub}</span>
          </div>
        </div>
        <span class="ag-icon ag-icon--sm hub-tile-chevron" aria-hidden="true">chevron_right</span>
      `;

      if (mod.live && mod.href) {
        return `
          <a
            href="${mod.href}"
            class="hub-tile press-card"
            role="listitem"
            style="--stagger:${index}"
            data-module-id="${mod.id}"
            data-tone="${mod.tone}"
            data-planned="false"
          >${inner}</a>
        `;
      }

      return `
        <button
          type="button"
          class="hub-tile press-card"
          role="listitem"
          style="--stagger:${index}"
          data-module-id="${mod.id}"
          data-tone="${mod.tone}"
          data-planned="true"
        >${inner}</button>
      `;
    })
    .join("");

  grid.querySelectorAll('button.hub-tile[data-planned="true"]').forEach((tile) => {
    tile.addEventListener("click", () => {
      const mod = MODULES.find((m) => m.id === tile.dataset.moduleId);
      if (mod) showToast(`${mod.title}: Modul folgt als Nächstes`);
    });
  });
}

function openSettings() {
  state.view = "settings";
  const topBar = document.getElementById("top-bar");
  const homeView = document.getElementById("view-home");
  const settingsView = document.getElementById("view-settings");

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
  const topBar = document.getElementById("top-bar");
  const homeView = document.getElementById("view-home");
  const settingsView = document.getElementById("view-settings");

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
}

function init() {
  const versionLabel = document.getElementById("app-version-label");
  if (versionLabel) versionLabel.textContent = `v${APP_VERSION}`;
  wireEvents();
  renderSettingsTheme();
  renderHubGrid();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
