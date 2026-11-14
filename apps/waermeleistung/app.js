/**
 * Modul: Wärmeleistung-Rechner (apps/waermeleistung/app.js)
 * Zweck: Berechnet im Prototyp-Status die hydraulische Wärmeleistung (Q̇ = V̇ · ρ · cₚ · ΔT),
 *   den erforderlichen Volumenstrom (V̇) sowie die überschlägige Gebäude-Heizlast (A · q).
 * Verantwortlichkeit: Zustandsverwaltung, Eingabe-Validierung, Einheitenumrechnung,
 *   Live-Ergebnis-Rendering und Sync mit den gemeinsamen UI-Helfern aus shared.js.
 * Sicherheits- & Stabilitätsrelevanz: Strikte numerische Sanitisierung (kein NaN/Infinity),
 *   ausschließlich textContent-Updates ohne unsicheres innerHTML.
 */

import {
  applyThemeMode,
  getCurrentThemeMode,
  prefersReducedMotion,
  updateAllPills,
} from "../../assets/js/shared.js";

const MEDIA = {
  water: {
    label: "Wasser",
    rho: 992, // kg/m³ bei ca. 40 °C Heizwasser
    cp: 4.184, // kJ/(kg·K)
  },
  air: {
    label: "Luft",
    rho: 1.204, // kg/m³ bei 20 °C
    cp: 1.005, // kJ/(kg·K)
  },
};

// Stützstellen Ethylenglykol-Wasser-Gemisch (0–60 %) bei ca. 20–40 °C
const GLYCOL_TABLE = [
  { pct: 0, rho: 992, cp: 4.184 },
  { pct: 20, rho: 1026, cp: 3.9 },
  { pct: 30, rho: 1042, cp: 3.72 },
  { pct: 40, rho: 1055, cp: 3.52 },
  { pct: 50, rho: 1068, cp: 3.32 },
  { pct: 60, rho: 1080, cp: 3.12 },
];

function interpolateGlycol(pct) {
  const clamped = Math.min(60, Math.max(0, pct));
  for (let i = 0; i < GLYCOL_TABLE.length - 1; i++) {
    const a = GLYCOL_TABLE[i];
    const b = GLYCOL_TABLE[i + 1];
    if (clamped >= a.pct && clamped <= b.pct) {
      const t = (clamped - a.pct) / (b.pct - a.pct);
      return {
        label: `Glykol ${formatDe(clamped, 0)}%`,
        rho: a.rho + t * (b.rho - a.rho),
        cp: a.cp + t * (b.cp - a.cp),
      };
    }
  }
  const last = GLYCOL_TABLE[GLYCOL_TABLE.length - 1];
  return { label: `Glykol ${last.pct}%`, rho: last.rho, cp: last.cp };
}

function getActiveMedium() {
  if (state.medium === "glycol") return interpolateGlycol(state.glycolPct);
  return MEDIA[state.medium] || MEDIA.water;
}

const FLOW_UNIT_CONFIG = {
  m3h: { label: "m³/h", factorToM3h: 1, step: 0.1, decimals: 2 },
  lh: { label: "l/h", factorToM3h: 0.001, step: 50, decimals: 0 },
  lmin: { label: "l/min", factorToM3h: 0.06, step: 1, decimals: 1 },
};

const state = {
  view: "calc",
  mode: "hydraulik",
  medium: "water",
  glycolPct: 30,
  flowUnit: "m3h",
  flowM3h: 1.5,
  hydDt: 10,
  volPowerKw: 15,
  volDt: 10,
  hlArea: 140,
  hlSpec: 40,
  hlDt: 5,
};

function sanitizeNumber(raw, min = 0, max = 1_000_000) {
  const normalized = String(raw ?? "").replace(",", ".").trim();
  if (!normalized) return 0;
  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num)) return 0;
  return Math.min(max, Math.max(min, num));
}

function formatDe(value, decimals = 2) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatInputVal(value, decimals = 2) {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(decimals)).toString();
}

function triggerResultPop() {
  if (prefersReducedMotion()) return;
  const main = document.getElementById("result-main");
  if (!main) return;
  main.classList.remove("is-popping");
  void main.offsetWidth;
  main.classList.add("is-popping");
  window.setTimeout(() => main.classList.remove("is-popping"), 180);
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

function openSettings() {
  state.view = "settings";
  const calcView = document.getElementById("view-calc");
  const settingsView = document.getElementById("view-settings");
  const homeLink = document.getElementById("nav-home-link");
  const backBtn = document.getElementById("nav-back-btn");
  const brandTitle = document.getElementById("brand-title");

  if (calcView) calcView.hidden = true;
  if (settingsView) {
    settingsView.hidden = false;
    settingsView.classList.remove("is-entering");
    void settingsView.offsetWidth;
    settingsView.classList.add("is-entering");
  }
  if (homeLink) homeLink.hidden = true;
  if (backBtn) backBtn.hidden = false;
  if (brandTitle) brandTitle.textContent = "Einstellungen";

  renderSettingsTheme();
}

function openCalc() {
  state.view = "calc";
  const calcView = document.getElementById("view-calc");
  const settingsView = document.getElementById("view-settings");
  const homeLink = document.getElementById("nav-home-link");
  const backBtn = document.getElementById("nav-back-btn");
  const brandTitle = document.getElementById("brand-title");

  if (settingsView) settingsView.hidden = true;
  if (calcView) {
    calcView.hidden = false;
    calcView.classList.remove("is-entering");
    void calcView.offsetWidth;
    calcView.classList.add("is-entering");
  }
  if (backBtn) backBtn.hidden = true;
  if (homeLink) homeLink.hidden = false;
  if (brandTitle) brandTitle.textContent = "Wärmeleistung";

  updateAllPills();
}

function syncMediumChips() {
  document.querySelectorAll("[data-medium]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.medium === state.medium));
  });
  const isGlycol = state.medium === "glycol";
  const hydWell = document.getElementById("hyd-glycol-well");
  const volWell = document.getElementById("vol-glycol-well");
  if (hydWell) hydWell.hidden = !isGlycol;
  if (volWell) volWell.hidden = !isGlycol;
}

function syncGlycolInputs(pct) {
  state.glycolPct = pct;
  const formatted = formatInputVal(pct, 1);
  const hydIn = document.getElementById("hyd-glycol-input");
  const volIn = document.getElementById("vol-glycol-input");
  if (hydIn && document.activeElement !== hydIn) hydIn.value = formatted;
  if (volIn && document.activeElement !== volIn) volIn.value = formatted;
}

function syncPresetChips(groupSelector, attr, activeValue) {
  const group = document.querySelector(groupSelector);
  if (!group) return;
  group.querySelectorAll(`[${attr}]`).forEach((btn) => {
    const val = Number.parseFloat(btn.getAttribute(attr) || "");
    btn.setAttribute("aria-pressed", String(Math.abs(val - activeValue) < 0.001));
  });
}

function setResult({ label, value, unit, sub, badgeText, badgeState, meterPct = 40 }) {
  const labelEl = document.getElementById("result-label");
  const numEl = document.getElementById("result-number");
  const unitEl = document.getElementById("result-unit");
  const subEl = document.getElementById("result-sub");
  const badgeEl = document.getElementById("result-badge");
  const meterEl = document.getElementById("result-meter-fill");

  if (labelEl) labelEl.textContent = label;
  if (numEl) numEl.textContent = value;
  if (unitEl) unitEl.textContent = unit;
  if (subEl) subEl.textContent = sub;
  if (badgeEl) {
    badgeEl.textContent = badgeText;
    badgeEl.setAttribute("data-state", badgeState);
  }
  if (meterEl) {
    const safePct = Math.min(100, Math.max(6, Number.isFinite(meterPct) ? meterPct : 40));
    meterEl.style.width = `${safePct}%`;
    meterEl.setAttribute("data-state", badgeState);
  }
  triggerResultPop();
}

function calculateHydraulik() {
  const med = getActiveMedium();
  // Q̇ [kW] = (V̇ [m³/h] / 3600) * ρ [kg/m³] * cₚ [kJ/(kg·K)] * ΔT [K]
  const massFlowKgH = state.flowM3h * med.rho;
  const qKw = (state.flowM3h / 3600) * med.rho * med.cp * state.hydDt;
  const qWatt = qKw * 1000;

  let badgeText = "Plausibel";
  let badgeState = "ok";
  if (state.flowM3h <= 0 || state.hydDt <= 0) {
    badgeText = "Nullwert";
    badgeState = "warn";
  } else if (state.medium !== "air" && state.hydDt < 3) {
    badgeText = "ΔT sehr klein (< 3 K)";
    badgeState = "warn";
  } else if (state.medium !== "air" && state.hydDt > 25) {
    badgeText = "ΔT hoch (> 25 K)";
    badgeState = "warn";
  }

  setResult({
    label: "Wärmeleistung Q̇",
    value: formatDe(qKw, qKw >= 100 ? 1 : 2),
    unit: "kW",
    sub: `${formatDe(qWatt, 0)} W · ${formatDe(massFlowKgH, 0)} kg/h`,
    badgeText,
    badgeState,
    meterPct: (state.hydDt / 25) * 100,
  });
}

function calculateVolumenstrom() {
  const med = getActiveMedium();
  const denom = med.rho * med.cp * state.volDt;
  const flowM3h = denom > 0 ? (state.volPowerKw * 3600) / denom : 0;
  const flowLh = flowM3h * 1000;
  const flowLmin = flowLh / 60;

  let badgeText = "Erforderlich";
  let badgeState = "ok";
  if (state.volPowerKw <= 0 || state.volDt <= 0) {
    badgeText = "Ungültig";
    badgeState = "bad";
  } else if (state.medium !== "air" && state.volDt < 3) {
    badgeText = "Hoher Durchfluss (ΔT < 3 K)";
    badgeState = "warn";
  }

  setResult({
    label: "Volumenstrom V̇",
    value: formatDe(flowM3h, flowM3h >= 10 ? 2 : 3),
    unit: "m³/h",
    sub: `${formatDe(flowLh, 0)} l/h · ${formatDe(flowLmin, 1)} l/min`,
    badgeText,
    badgeState,
    meterPct: (state.volDt / 25) * 100,
  });
}

function calculateHeizlast() {
  const qWatt = state.hlArea * state.hlSpec;
  const qKw = qWatt / 1000;
  const denom = MEDIA.water.rho * MEDIA.water.cp * state.hlDt;
  const flowM3h = denom > 0 ? (qKw * 3600) / denom : 0;
  const flowLh = flowM3h * 1000;

  let badgeText = "Richtwert";
  let badgeState = "ok";
  if (state.hlArea <= 0 || state.hlSpec <= 0) {
    badgeText = "Nullwert";
    badgeState = "warn";
  } else if (state.hlSpec > 130) {
    badgeText = "Sehr hoher Bedarf";
    badgeState = "warn";
  }

  setResult({
    label: "Gebäude-Heizlast Q̇",
    value: formatDe(qKw, qKw >= 100 ? 1 : 2),
    unit: "kW",
    sub: `${formatDe(qWatt, 0)} W · ${formatDe(flowLh, 0)} l/h (${formatDe(flowM3h, 2)} m³/h bei ${formatDe(state.hlDt, 1)} K)`,
    badgeText,
    badgeState,
    meterPct: (state.hlSpec / 150) * 100,
  });
}

function renderActiveMode() {
  if (state.mode === "hydraulik") calculateHydraulik();
  else if (state.mode === "volumenstrom") calculateVolumenstrom();
  else calculateHeizlast();
}

function switchMode(newMode) {
  if (!["hydraulik", "volumenstrom", "heizlast"].includes(newMode)) return;
  state.mode = newMode;

  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.mode === newMode));
  });

  ["hydraulik", "volumenstrom", "heizlast"].forEach((m) => {
    const panel = document.getElementById(`panel-${m}`);
    if (!panel) return;
    const isTarget = m === newMode;
    panel.hidden = !isTarget;
    if (isTarget) {
      panel.classList.remove("is-entering");
      void panel.offsetWidth;
      panel.classList.add("is-entering");
    }
  });

  updateAllPills();
  renderActiveMode();
}

function switchFlowUnit(newUnit) {
  if (!FLOW_UNIT_CONFIG[newUnit]) return;
  state.flowUnit = newUnit;
  const cfg = FLOW_UNIT_CONFIG[newUnit];

  document.querySelectorAll("#flow-unit-tabs [data-flow-unit]").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.flowUnit === newUnit));
  });

  const input = document.getElementById("hyd-flow-input");
  const unitLabel = document.getElementById("hyd-flow-unit-label");
  if (input) input.value = formatInputVal(state.flowM3h / cfg.factorToM3h, cfg.decimals);
  if (unitLabel) unitLabel.textContent = cfg.label;

  updateAllPills();
  calculateHydraulik();
}

function wireStepper(minusId, plusId, inputId, getStep, onUpdate) {
  const minus = document.getElementById(minusId);
  const plus = document.getElementById(plusId);
  const input = document.getElementById(inputId);
  if (!input) return;

  const applyDelta = (dir) => {
    const step = typeof getStep === "function" ? getStep() : getStep;
    const minVal = Number.parseFloat(input.min || "0") || 0;
    const maxVal = input.max !== "" ? Number.parseFloat(input.max) : 1_000_000;
    const current = sanitizeNumber(input.value, minVal, maxVal);
    const next = Math.min(maxVal, Math.max(minVal, current + dir * step));
    input.value = formatInputVal(next, step < 1 ? 2 : step % 1 !== 0 ? 1 : 2);
    onUpdate(next);
  };

  if (minus) minus.addEventListener("click", () => applyDelta(-1));
  if (plus) plus.addEventListener("click", () => applyDelta(1));
  input.addEventListener("input", () => {
    const minVal = Number.parseFloat(input.min || "0") || 0;
    const maxVal = input.max !== "" ? Number.parseFloat(input.max) : 1_000_000;
    onUpdate(sanitizeNumber(input.value, minVal, maxVal));
  });
}

function wireEvents() {
  // Einstellungen-Umschalter (Zahnrad) & Zurück-Button
  const settingsBtn = document.getElementById("settings-toggle-btn");
  const backBtn = document.getElementById("nav-back-btn");
  const themeModeGroup = document.getElementById("theme-mode-group");

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      if (state.view === "settings") {
        openCalc();
      } else {
        openSettings();
      }
    });
  }

  if (backBtn) backBtn.addEventListener("click", openCalc);

  if (themeModeGroup) {
    themeModeGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-theme-mode]");
      if (!btn) return;
      applyThemeMode(btn.getAttribute("data-theme-mode"));
      renderSettingsTheme();
    });
  }

  // Haupt-Tabs
  const modeTabs = document.getElementById("mode-tabs");
  if (modeTabs) {
    modeTabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mode]");
      if (btn) switchMode(btn.dataset.mode);
    });
  }

  // Einheiten-Tabs für Volumenstrom
  const flowUnitTabs = document.getElementById("flow-unit-tabs");
  if (flowUnitTabs) {
    flowUnitTabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-flow-unit]");
      if (btn) switchFlowUnit(btn.dataset.flowUnit);
    });
  }

  // Medium-Auswahl (synchron zwischen Hydraulik & Volumenstrom)
  document.querySelectorAll("[data-medium]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const med = btn.dataset.medium;
      if (!["water", "glycol", "air"].includes(med)) return;
      state.medium = med;
      syncMediumChips();
      renderActiveMode();
    });
  });

  wireStepper("hyd-glycol-minus", "hyd-glycol-plus", "hyd-glycol-input", 5, (val) => {
    syncGlycolInputs(val);
    renderActiveMode();
  });

  wireStepper("vol-glycol-minus", "vol-glycol-plus", "vol-glycol-input", 5, (val) => {
    syncGlycolInputs(val);
    renderActiveMode();
  });

  // Hydraulik-Stepper & Presets
  wireStepper(
    "hyd-flow-minus",
    "hyd-flow-plus",
    "hyd-flow-input",
    () => FLOW_UNIT_CONFIG[state.flowUnit].step,
    (val) => {
      state.flowM3h = val * FLOW_UNIT_CONFIG[state.flowUnit].factorToM3h;
      calculateHydraulik();
    }
  );

  wireStepper("hyd-dt-minus", "hyd-dt-plus", "hyd-dt-input", 0.5, (val) => {
    state.hydDt = val;
    syncPresetChips("#dt-preset-group", "data-dt", val);
    calculateHydraulik();
  });

  const dtPresetGroup = document.getElementById("dt-preset-group");
  if (dtPresetGroup) {
    dtPresetGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-dt]");
      if (!btn) return;
      const dt = sanitizeNumber(btn.dataset.dt, 0.1, 150);
      state.hydDt = dt;
      const input = document.getElementById("hyd-dt-input");
      if (input) input.value = String(dt);
      syncPresetChips("#dt-preset-group", "data-dt", dt);
      calculateHydraulik();
    });
  }

  // Volumenstrom-Stepper & Presets
  wireStepper("vol-power-minus", "vol-power-plus", "vol-power-input", 0.5, (val) => {
    state.volPowerKw = val;
    calculateVolumenstrom();
  });

  wireStepper("vol-dt-minus", "vol-dt-plus", "vol-dt-input", 0.5, (val) => {
    state.volDt = Math.max(0.1, val);
    syncPresetChips("#vol-dt-preset-group", "data-dt", state.volDt);
    calculateVolumenstrom();
  });

  const volDtGroup = document.getElementById("vol-dt-preset-group");
  if (volDtGroup) {
    volDtGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-dt]");
      if (!btn) return;
      const dt = sanitizeNumber(btn.dataset.dt, 0.1, 150);
      state.volDt = dt;
      const input = document.getElementById("vol-dt-input");
      if (input) input.value = String(dt);
      syncPresetChips("#vol-dt-preset-group", "data-dt", dt);
      calculateVolumenstrom();
    });
  }

  // Heizlast-Stepper & Presets
  wireStepper("hl-area-minus", "hl-area-plus", "hl-area-input", 5, (val) => {
    state.hlArea = val;
    calculateHeizlast();
  });

  wireStepper("hl-spec-minus", "hl-spec-plus", "hl-spec-input", 5, (val) => {
    state.hlSpec = val;
    syncPresetChips("#hl-preset-group", "data-q", val);
    calculateHeizlast();
  });

  const hlPresetGroup = document.getElementById("hl-preset-group");
  if (hlPresetGroup) {
    hlPresetGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-q]");
      if (!btn) return;
      const q = sanitizeNumber(btn.dataset.q, 1, 500);
      state.hlSpec = q;
      const input = document.getElementById("hl-spec-input");
      if (input) input.value = String(q);
      syncPresetChips("#hl-preset-group", "data-q", q);
      calculateHeizlast();
    });
  }

  wireStepper("hl-dt-minus", "hl-dt-plus", "hl-dt-input", 0.5, (val) => {
    state.hlDt = Math.max(0.1, val);
    syncPresetChips("#hl-dt-preset-group", "data-dt", state.hlDt);
    calculateHeizlast();
  });

  const hlDtGroup = document.getElementById("hl-dt-preset-group");
  if (hlDtGroup) {
    hlDtGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-dt]");
      if (!btn) return;
      const dt = sanitizeNumber(btn.dataset.dt, 0.1, 150);
      state.hlDt = dt;
      const input = document.getElementById("hl-dt-input");
      if (input) input.value = String(dt);
      syncPresetChips("#hl-dt-preset-group", "data-dt", dt);
      calculateHeizlast();
    });
  }

  window.addEventListener("resize", updateAllPills);
}

function init() {
  renderSettingsTheme();
  syncMediumChips();
  wireEvents();
  updateAllPills();
  renderActiveMode();
}

document.addEventListener("DOMContentLoaded", init);
