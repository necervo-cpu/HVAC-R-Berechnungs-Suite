/**
 * Modul: Dashboard / App-Launcher Steuerung (assets/js/dashboard.js)
 * Zweck: Steuert ausschließlich die Startseiten-Übersicht (Suche, Kategorie-Filter,
 *   Verlinkungs-Kacheln zu den Einzel-Apps unter ./apps/<app-name>/) sowie die
 *   Darstellungs-Einstellungen (Auto / Hell / Dunkel).
 * Verantwortlichkeit: Filterung der Tool-Karten, Navigation zu Einzel-Apps über relative Pfade
 *   und Synchronisation des 3-Stufen-Theme-Umschalters.
 */

import {
  applyThemeMode,
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
];

const state = {
  view: "home",
  category: "all",
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
    const matchesCat = state.category === "all" || mod.category === state.category;
    const matchesQuery =
      !q ||
      mod.title.toLowerCase().includes(q) ||
      mod.sub.toLowerCase().includes(q) ||
      mod.keywords.includes(q);
    return matchesCat && matchesQuery;
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
        <div class="hub-tile-top">
          <span class="hub-tile-icon">${mod.icon}</span>
          <span class="hub-tile-badge" data-live="${String(mod.live)}">
            ${mod.live ? "Aktiv" : "Geplant"}
          </span>
        </div>
        <div class="hub-tile-body">
          <span class="hub-tile-title">${mod.title}</span>
          <span class="hub-tile-sub">${mod.sub}</span>
        </div>
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
  const homeView = document.getElementById("view-home");
  const settingsView = document.getElementById("view-settings");
  const backBtn = document.getElementById("nav-back-btn");
  const brandDot = document.getElementById("brand-dot");
  const brandTitle = document.getElementById("brand-title");

  if (homeView) homeView.hidden = true;
  if (settingsView) {
    settingsView.hidden = false;
    settingsView.classList.remove("is-entering");
    void settingsView.offsetWidth;
    settingsView.classList.add("is-entering");
  }
  if (backBtn) backBtn.hidden = false;
  if (brandDot) brandDot.hidden = true;
  if (brandTitle) brandTitle.textContent = "Einstellungen";

  renderSettingsTheme();
}

function openHome() {
  state.view = "home";
  const homeView = document.getElementById("view-home");
  const settingsView = document.getElementById("view-settings");
  const backBtn = document.getElementById("nav-back-btn");
  const brandDot = document.getElementById("brand-dot");
  const brandTitle = document.getElementById("brand-title");

  if (settingsView) settingsView.hidden = true;
  if (homeView) {
    homeView.hidden = false;
    homeView.classList.remove("is-entering");
    void homeView.offsetWidth;
    homeView.classList.add("is-entering");
  }
  if (backBtn) backBtn.hidden = true;
  if (brandDot) brandDot.hidden = false;
  if (brandTitle) brandTitle.textContent = "HVAC·R";
}

function wireEvents() {
  const searchInput = document.getElementById("hub-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.query = searchInput.value;
      renderHubGrid();
    });
  }

  const catSelect = document.getElementById("hub-category-select");
  const catLabel = document.getElementById("hub-category-label");
  if (catSelect) {
    catSelect.addEventListener("change", () => {
      state.category = catSelect.value;
      if (catLabel && catSelect.selectedOptions[0]) {
        catLabel.textContent = catSelect.selectedOptions[0].textContent;
      }
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
}

function init() {
  wireEvents();
  renderSettingsTheme();
  renderHubGrid();
}

document.addEventListener("DOMContentLoaded", init);
