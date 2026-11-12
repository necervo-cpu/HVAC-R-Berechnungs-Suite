/**
 * Modul: Startseite & PTC/NTC Sensor-Rechner Steuerung (app.js)
 * Zweck: Steuert die Startseiten-Übersicht (Suche, Kategorie-Dropdown, Modul-Karten),
 *   den PTC/NTC Sensor-Rechner mit Kennlinien-Dropdown und flüssiger Zahlen-Zähl-Animation
 *   sowie den 3-Stufen-Theme-Button.
 * Verantwortlichkeit: View-Routing, Dropdown-Synchronisation, rAF-Zahleninterpolation und Prüfpunkte.
 */

import { cycleThemeMode, getCurrentThemeMode } from "./theme.js";
import {
  NTC_SENSORS,
  PTC_SENSORS,
  calculateSensorConversion,
  clampNumber,
  formatOhm,
} from "./calculators.js";

const THEME_LABELS = {
  auto: "Auto",
  light: "Hell",
  dark: "Dunkel",
};

const THEME_ICONS = {
  auto: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 8l4 4-4 4"/></svg>`,
  light: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
  dark: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
};

const MODULES = [
  {
    id: "sensor",
    title: "PTC / NTC Sensoren",
    sub: "Ohm ↔ °C · NTC 2k–20k, PT100/1000, KTY81",
    category: "kaelte",
    tone: "cool",
    live: true,
    keywords: "ntc ptc pt100 pt1000 kty81 2k 5k 10k 12k 20k ohm fühler sensor temperatur",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`,
  },
  {
    id: "refrig",
    title: "Kältekreis (ΔT)",
    sub: "Überhitzung & Unterkühlung · Dampfdruck",
    category: "kaelte",
    tone: "cool",
    live: false,
    keywords: "r32 r410a r290 r134a druck überhitzung unterkühlung kältemittel",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>`,
  },
  {
    id: "duct",
    title: "Luftkanal (DN)",
    sub: "Rundrohr & Rechteck · Volumenstrom m³/h",
    category: "klima",
    tone: "cool",
    live: false,
    keywords: "luft kanal rundrohr rechteck volumenstrom geschwindigkeit dn lüftung",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>`,
  },
  {
    id: "dewpoint",
    title: "Taupunkt & Luft",
    sub: "Rel. Feuchte, Taupunkt & Enthalpie (h,x)",
    category: "klima",
    tone: "cool",
    live: false,
    keywords: "taupunkt feuchte luft enthalpie hx kondensat",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  },
  {
    id: "pipe",
    title: "Rohrnetz (Δp)",
    sub: "Druckverlust & Fließgeschwindigkeit",
    category: "heizung",
    tone: "warm",
    live: false,
    keywords: "rohr druckverlust kupfer stahl heizung wasser",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h7a4 4 0 0 1 4 4v6h7"/><path d="M18 14l3 3-3 3"/></svg>`,
  },
  {
    id: "heatpump",
    title: "Wärmepumpe",
    sub: "COP / JAZ, Heizlast & Spreizung",
    category: "heizung",
    tone: "warm",
    live: false,
    keywords: "wärmepumpe cop jaz heizlast spreizung leistung",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  },
];

const state = {
  view: "home",
  category: "all",
  query: "",
  sensor: {
    family: "ntc",
    sensorId: "ntc10k_3435",
    direction: "ohmToTemp",
    inputValue: 10000,
    customR25: 10000,
    customB: 3950,
  },
};

let toastTimer = null;
let countRafId = null;
let lastDisplayedValue = null;
let lastDisplayedDirection = null;

function formatDE(num, decimals = 1) {
  return num.toFixed(decimals).replace(".", ",");
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function showToast(message) {
  const toast = document.getElementById("toast-pill");
  if (!toast) return;
  toast.textContent = message;
  toast.setAttribute("data-visible", "true");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.setAttribute("data-visible", "false");
  }, 2200);
}

function updateSegmentedPill(container) {
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

function updateAllPills() {
  document.querySelectorAll(".segmented").forEach((seg) => updateSegmentedPill(seg));
}

/**
 * Zählt das Hauptergebnis flüssig hoch oder herunter (rAF mit kubischem Ease-Out).
 */
function animateResultNumber(element, targetVal, direction, animate) {
  if (!element) return;

  const renderExact = (val) => {
    if (direction === "ohmToTemp") {
      element.innerHTML = `${formatDE(val, 1)}<span class="result-unit">°C</span>`;
    } else {
      const f = formatOhm(val);
      element.innerHTML = `${f.num}<span class="result-unit">${f.unit}</span>`;
    }
  };

  if (countRafId !== null) {
    window.cancelAnimationFrame(countRafId);
    countRafId = null;
  }

  if (
    !animate ||
    prefersReducedMotion() ||
    lastDisplayedValue === null ||
    lastDisplayedDirection !== direction ||
    Math.abs(targetVal - lastDisplayedValue) < 0.01
  ) {
    lastDisplayedValue = targetVal;
    lastDisplayedDirection = direction;
    renderExact(targetVal);
    return;
  }

  const startVal = lastDisplayedValue;
  const startTime = performance.now();
  const duration = 220;

  const tick = (now) => {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = startVal + (targetVal - startVal) * eased;
    lastDisplayedValue = current;
    renderExact(current);

    if (t < 1) {
      countRafId = window.requestAnimationFrame(tick);
    } else {
      lastDisplayedValue = targetVal;
      lastDisplayedDirection = direction;
      renderExact(targetVal);
      countRafId = null;
    }
  };

  countRafId = window.requestAnimationFrame(tick);
}

function renderThemeButton(animateSwap = false) {
  const mode = getCurrentThemeMode();
  const iconEl = document.getElementById("theme-icon");
  const labelEl = document.getElementById("theme-label");
  if (!iconEl || !labelEl) return;

  if (animateSwap) {
    iconEl.classList.add("is-swapping");
    window.setTimeout(() => {
      iconEl.innerHTML = THEME_ICONS[mode];
      labelEl.textContent = THEME_LABELS[mode];
      iconEl.classList.remove("is-swapping");
    }, 110);
  } else {
    iconEl.innerHTML = THEME_ICONS[mode];
    labelEl.textContent = THEME_LABELS[mode];
  }
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
    .map(
      (mod, index) => `
      <button
        type="button"
        class="hub-tile press-card"
        role="listitem"
        style="--stagger:${index}"
        data-module-id="${mod.id}"
        data-tone="${mod.tone}"
        data-planned="${String(!mod.live)}"
      >
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
      </button>
    `
    )
    .join("");

  grid.querySelectorAll(".hub-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const mod = MODULES.find((m) => m.id === tile.dataset.moduleId);
      if (!mod) return;
      if (!mod.live) {
        showToast(`${mod.title}: Modul folgt als Nächstes`);
        return;
      }
      openCalculator();
    });
  });
}

function openCalculator() {
  state.view = "calculator";
  const homeView = document.getElementById("view-home");
  const calcView = document.getElementById("view-calculator");
  const backBtn = document.getElementById("nav-back-btn");
  const brandDot = document.getElementById("brand-dot");
  const brandTitle = document.getElementById("brand-title");
  const panel = document.getElementById("panel-sensor");

  if (homeView) homeView.hidden = true;
  if (calcView) calcView.hidden = false;
  if (backBtn) backBtn.hidden = false;
  if (brandDot) brandDot.hidden = true;
  if (brandTitle) brandTitle.textContent = "PTC / NTC Sensoren";
  if (panel) {
    panel.classList.remove("is-entering");
    void panel.offsetWidth;
    panel.classList.add("is-entering");
  }

  requestAnimationFrame(updateAllPills);
}

function openHome() {
  state.view = "home";
  const homeView = document.getElementById("view-home");
  const calcView = document.getElementById("view-calculator");
  const backBtn = document.getElementById("nav-back-btn");
  const brandDot = document.getElementById("brand-dot");
  const brandTitle = document.getElementById("brand-title");

  if (calcView) calcView.hidden = true;
  if (homeView) {
    homeView.hidden = false;
    homeView.classList.remove("is-entering");
    void homeView.offsetWidth;
    homeView.classList.add("is-entering");
  }
  if (backBtn) backBtn.hidden = true;
  if (brandDot) brandDot.hidden = false;
  if (brandTitle) brandTitle.textContent = "HVAC·R";

  requestAnimationFrame(updateAllPills);
}

function getStepDelta() {
  if (state.sensor.direction === "tempToOhm") return 1.0;
  if (state.sensor.family === "ptc") {
    return state.sensor.sensorId === "pt100" ? 5 : 25;
  }
  return 100;
}

function getDefaultOhmForSensor(family, sensorId) {
  if (family === "ptc") {
    if (sensorId === "pt100") return 109.73;
    if (sensorId === "pt1000") return 1097.3;
    return 2000;
  }
  const spec = NTC_SENSORS[sensorId] || NTC_SENSORS.ntc10k_3435;
  return sensorId === "ntc_custom" ? state.sensor.customR25 : spec.r25;
}

function renderSensorSelect() {
  const select = document.getElementById("sensor-select");
  const selectLabel = document.getElementById("sensor-select-label");
  const noteHint = document.getElementById("sensor-note-hint");
  if (!select) return;

  const map = state.sensor.family === "ntc" ? NTC_SENSORS : PTC_SENSORS;
  select.innerHTML = Object.values(map)
    .map(
      (s) => `<option value="${s.id}">${s.fullLabel}</option>`
    )
    .join("");
  select.value = state.sensor.sensorId;

  const activeSpec = map[state.sensor.sensorId];
  if (selectLabel && activeSpec) {
    selectLabel.textContent = activeSpec.fullLabel;
  }
  if (noteHint && activeSpec) {
    noteHint.textContent = activeSpec.note;
  }
}

function renderSensorResult(animate = true) {
  const customPanel = document.getElementById("custom-ntc-panel");
  if (customPanel) {
    const showCustom =
      state.sensor.family === "ntc" && state.sensor.sensorId === "ntc_custom";
    customPanel.setAttribute("data-open", String(showCustom));
  }

  const map = state.sensor.family === "ntc" ? NTC_SENSORS : PTC_SENSORS;
  const activeSpec = map[state.sensor.sensorId];
  const noteHint = document.getElementById("sensor-note-hint");
  if (noteHint && activeSpec) noteHint.textContent = activeSpec.note;

  const res = calculateSensorConversion(state.sensor);

  const titleEl = document.getElementById("sensor-result-title");
  const valEl = document.getElementById("sensor-result-val");
  const subEl = document.getElementById("sensor-result-sub");
  const badgeEl = document.getElementById("sensor-status-badge");
  const inputLabelEl = document.getElementById("sensor-input-label");
  const inputUnitEl = document.getElementById("sensor-input-unit");
  const stepHintEl = document.getElementById("sensor-step-hint");
  const refGridEl = document.getElementById("sensor-ref-grid");

  if (titleEl) titleEl.textContent = res.sensorName;
  if (subEl) subEl.textContent = res.sensorMeta;
  if (badgeEl) {
    badgeEl.setAttribute("data-state", res.statusState);
    badgeEl.textContent = res.statusText;
  }

  const targetNum = state.sensor.direction === "ohmToTemp" ? res.tempC : res.ohm;
  animateResultNumber(valEl, targetNum, state.sensor.direction, animate);

  const delta = getStepDelta();
  if (state.sensor.direction === "ohmToTemp") {
    if (inputLabelEl) inputLabelEl.textContent = "Gemessener Widerstand";
    if (inputUnitEl) inputUnitEl.textContent = "Ω";
    if (stepHintEl) stepHintEl.textContent = `Schritt ±${delta} Ω`;
  } else {
    if (inputLabelEl) inputLabelEl.textContent = "Soll-/Ist-Temperatur";
    if (inputUnitEl) inputUnitEl.textContent = "°C";
    if (stepHintEl) stepHintEl.textContent = `Schritt ±${delta} °C`;
  }

  if (refGridEl) {
    refGridEl.innerHTML = res.refPoints
      .map(
        (p) => `
        <div class="ref-cell">
          <span class="ref-temp">${p.tempC} °C</span>
          <span class="ref-ohm">${p.formattedOhm.num} ${p.formattedOhm.unit}</span>
        </div>
      `
      )
      .join("");
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

  // Richtung: Ohm -> °C / °C -> Ohm
  const dirSeg = document.getElementById("sensor-dir-switcher");
  if (dirSeg) {
    dirSeg.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextDir = btn.dataset.dir;
        if (nextDir === state.sensor.direction) return;
        const prev = calculateSensorConversion(state.sensor);
        state.sensor.direction = nextDir;

        dirSeg.querySelectorAll(".tab-btn").forEach((b) => b.setAttribute("aria-selected", "false"));
        btn.setAttribute("aria-selected", "true");
        updateSegmentedPill(dirSeg);

        const input = document.getElementById("input-sensor-val");
        if (nextDir === "tempToOhm") {
          state.sensor.inputValue = Math.round(prev.tempC * 10) / 10;
        } else {
          state.sensor.inputValue = Math.round(prev.ohm * 100) / 100;
        }
        if (input) input.value = String(state.sensor.inputValue);
        renderSensorResult(true);
      });
    });
  }

  // Sensortyp: NTC vs. PTC
  const famSeg = document.getElementById("sensor-family-switcher");
  if (famSeg) {
    famSeg.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextFamily = btn.dataset.family;
        if (nextFamily === state.sensor.family) return;
        state.sensor.family = nextFamily;
        state.sensor.sensorId = nextFamily === "ntc" ? "ntc10k_3435" : "pt1000";

        famSeg.querySelectorAll(".tab-btn").forEach((b) => b.setAttribute("aria-selected", "false"));
        btn.setAttribute("aria-selected", "true");
        updateSegmentedPill(famSeg);

        if (state.sensor.direction === "ohmToTemp") {
          state.sensor.inputValue = getDefaultOhmForSensor(
            state.sensor.family,
            state.sensor.sensorId
          );
          const input = document.getElementById("input-sensor-val");
          if (input) input.value = String(state.sensor.inputValue);
        }
        renderSensorSelect();
        renderSensorResult(true);
      });
    });
  }

  // Kennlinien-Dropdown
  const sensorSelect = document.getElementById("sensor-select");
  const sensorSelectLabel = document.getElementById("sensor-select-label");
  if (sensorSelect) {
    sensorSelect.addEventListener("change", () => {
      state.sensor.sensorId = sensorSelect.value;
      if (sensorSelectLabel && sensorSelect.selectedOptions[0]) {
        sensorSelectLabel.textContent = sensorSelect.selectedOptions[0].textContent;
      }
      if (state.sensor.direction === "ohmToTemp") {
        state.sensor.inputValue = getDefaultOhmForSensor(
          state.sensor.family,
          state.sensor.sensorId
        );
        const input = document.getElementById("input-sensor-val");
        if (input) input.value = String(state.sensor.inputValue);
      }
      renderSensorResult(true);
    });
  }

  const valInput = document.getElementById("input-sensor-val");
  if (valInput) {
    valInput.addEventListener("input", () => {
      const parsed = Number(valInput.value.replace(",", "."));
      if (Number.isFinite(parsed)) {
        state.sensor.inputValue = parsed;
        renderSensorResult(true);
      }
    });
  }

  const minusBtn = document.getElementById("sensor-step-minus");
  const plusBtn = document.getElementById("sensor-step-plus");
  const handleStep = (sign) => {
    const delta = getStepDelta() * sign;
    const next = Math.round((state.sensor.inputValue + delta) * 100) / 100;
    state.sensor.inputValue =
      state.sensor.direction === "ohmToTemp"
        ? clampNumber(next, 0.1, 500000, 1000)
        : clampNumber(next, -60, 200, 25);
    if (valInput) valInput.value = String(state.sensor.inputValue);
    renderSensorResult(true);
  };
  if (minusBtn) minusBtn.addEventListener("click", () => handleStep(-1));
  if (plusBtn) plusBtn.addEventListener("click", () => handleStep(1));

  const r25Input = document.getElementById("input-custom-r25");
  const bInput = document.getElementById("input-custom-b");
  if (r25Input) {
    r25Input.addEventListener("input", () => {
      state.sensor.customR25 = clampNumber(r25Input.value, 100, 500000, 10000);
      renderSensorResult(true);
    });
  }
  if (bInput) {
    bInput.addEventListener("input", () => {
      state.sensor.customB = clampNumber(bInput.value, 1500, 6500, 3950);
      renderSensorResult(true);
    });
  }

  const refTrigger = document.getElementById("ref-acc-trigger");
  const refPanel = document.getElementById("ref-acc-panel");
  if (refTrigger && refPanel) {
    refTrigger.addEventListener("click", () => {
      const isOpen = refPanel.getAttribute("data-open") === "true";
      refPanel.setAttribute("data-open", String(!isOpen));
      refTrigger.setAttribute("aria-expanded", String(!isOpen));
    });
  }

  const themeBtn = document.getElementById("theme-toggle-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      cycleThemeMode(getCurrentThemeMode());
      renderThemeButton(true);
    });
  }
}

function init() {
  wireEvents();
  renderThemeButton(false);
  renderHubGrid();
  renderSensorSelect();
  renderSensorResult(false);

  requestAnimationFrame(updateAllPills);
  window.addEventListener("resize", updateAllPills);
}

document.addEventListener("DOMContentLoaded", init);
