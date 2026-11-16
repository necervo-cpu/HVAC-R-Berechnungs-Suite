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
  clearAppStorage,
  createNumberAnimator,
  fadeThrough,
  getCurrentThemeMode,
  loadAppParams,
  parseLocaleNumber,
  saveAppParams,
  showToast,
} from "../../assets/js/shared.js";

const WAERME_PARAMS_KEY = "hvacr-params-waermeleistung";
const waermeParams = loadAppParams(WAERME_PARAMS_KEY, {
  waterRho: 992,
  waterCp: 4.184,
});

const MEDIA = {
  water: {
    label: "Wasser",
    get rho() {
      return waermeParams.waterRho;
    },
    get cp() {
      return waermeParams.waterCp;
    },
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

const WAERME_STATE_KEY = "hvacr-state-waermeleistung";
const DEFAULT_STATE = {
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

function sanitizeWaermeState(raw) {
  const mode = ["hydraulik", "volumenstrom", "heizlast"].includes(raw.mode) ? raw.mode : "hydraulik";
  const medium = ["water", "glycol", "air"].includes(raw.medium) ? raw.medium : "water";
  const flowUnit = FLOW_UNIT_CONFIG[raw.flowUnit] ? raw.flowUnit : "m3h";
  return {
    view: "calc",
    mode,
    medium,
    glycolPct: parseLocaleNumber(raw.glycolPct, 30, 0, 60),
    flowUnit,
    flowM3h: parseLocaleNumber(raw.flowM3h, 1.5, 0, 100000),
    hydDt: parseLocaleNumber(raw.hydDt, 10, 0, 150),
    volPowerKw: parseLocaleNumber(raw.volPowerKw, 15, 0, 100000),
    volDt: parseLocaleNumber(raw.volDt, 10, 0.1, 150),
    hlArea: parseLocaleNumber(raw.hlArea, 140, 0, 100000),
    hlSpec: parseLocaleNumber(raw.hlSpec, 40, 0, 500),
    hlDt: parseLocaleNumber(raw.hlDt, 5, 0.1, 150),
  };
}

const state = sanitizeWaermeState(loadAppParams(WAERME_STATE_KEY, DEFAULT_STATE));

function persistState() {
  const { view: _view, ...toSave } = state;
  saveAppParams(WAERME_STATE_KEY, toSave);
}

function sanitizeNumber(raw, min = 0, max = 1_000_000, fallback = 0) {
  return parseLocaleNumber(raw, fallback, min, max);
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

function setActive(btn, isActive) {
  const attr = btn.classList.contains("tab-pill") ? "aria-selected" : "aria-pressed";
  btn.setAttribute(attr, String(isActive));
}

function renderSettingsTheme() {
  const mode = getCurrentThemeMode();
  const group = document.getElementById("theme-mode-group");
  if (!group) return;

  group.querySelectorAll("[data-theme-mode]").forEach((btn) => {
    const isActive = btn.getAttribute("data-theme-mode") === mode;
    btn.setAttribute("aria-pressed", String(isActive));
  });
}

function openSettings() {
  state.view = "settings";
  const overlay = document.getElementById("settings-overlay");
  if (overlay) {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
  }
  renderSettingsTheme();
  document.getElementById("settings-close-btn")?.focus();
}

function openCalc() {
  state.view = "calc";
  const overlay = document.getElementById("settings-overlay");
  if (overlay) {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
  }
  document.getElementById("settings-toggle-btn")?.focus();
}

function syncMediumChips() {
  document.querySelectorAll("[data-medium]").forEach((btn) => {
    setActive(btn, btn.dataset.medium === state.medium);
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
    setActive(btn, Math.abs(val - activeValue) < 0.001);
  });
}

let activeResultFormatter = (val) => (val > 0 ? formatDe(val, 2) : "–");

const resultNumberAnimator = createNumberAnimator({
  duration: 220,
  epsilon: 0.001,
  render: (val) => {
    const numEl = document.getElementById("result-number");
    if (numEl) numEl.textContent = Number.isFinite(val) ? activeResultFormatter(val) : "–";
  },
});

const BADGE_CLASS = { ok: "status-pill--green", warn: "status-pill--orange", bad: "status-pill--red" };

function renderResultRows(rows) {
  const host = document.getElementById("result-rows");
  if (!host) return;
  host.replaceChildren(
    ...rows.map(([label, value]) => {
      const row = document.createElement("div");
      row.className = "info-row";
      const l = document.createElement("span");
      l.className = "info-row-label";
      l.textContent = label;
      const v = document.createElement("span");
      v.className = "info-row-value numeric";
      v.textContent = value;
      row.append(l, v);
      return row;
    })
  );
}

function fmtUnit(value, decimals, unit) {
  return Number.isFinite(value) && value > 0 ? `${formatDe(value, decimals)} ${unit}` : "–";
}

function setResult({
  label,
  numericValue,
  formatValue,
  unit,
  rows,
  badgeText,
  badgeState,
  note = "",
  animate = true,
}) {
  const labelEl = document.getElementById("result-label");
  const unitEl = document.getElementById("result-unit");
  const badgeEl = document.getElementById("result-badge");
  const badgeTextEl = document.getElementById("result-badge-text");
  const noteEl = document.getElementById("result-note");

  if (labelEl) labelEl.textContent = label;
  if (typeof formatValue === "function") {
    activeResultFormatter = formatValue;
  }
  resultNumberAnimator.update(numericValue, state.mode, animate);
  if (unitEl) unitEl.textContent = unit;
  renderResultRows(rows);
  if (badgeEl) {
    badgeEl.className = `status-pill ${BADGE_CLASS[badgeState] || BADGE_CLASS.ok}`;
  }
  if (badgeTextEl) badgeTextEl.textContent = badgeText;
  if (noteEl) {
    noteEl.textContent = note;
    noteEl.hidden = !note;
  }
}

function calculateHydraulik() {
  const med = getActiveMedium();
  // Q̇ [kW] = (V̇ [m³/h] / 3600) * ρ [kg/m³] * cₚ [kJ/(kg·K)] * ΔT [K]
  const massFlowKgH = state.flowM3h * med.rho;
  const qKw = (state.flowM3h / 3600) * med.rho * med.cp * state.hydDt;
  const qWatt = qKw * 1000;

  let badgeText = "Plausibel";
  let badgeState = "ok";
  let note = "";
  if (state.flowM3h <= 0 || state.hydDt <= 0) {
    badgeText = "Nullwert";
    badgeState = "warn";
    note = "Volumenstrom und Spreizung müssen größer als 0 sein.";
  } else if (state.medium !== "air" && state.hydDt < 3) {
    badgeText = "ΔT sehr klein";
    badgeState = "warn";
    note = "Spreizung unter 3 K: Messfehler wirken stark. Messwerte prüfen oder Volumenstrom verringern.";
  } else if (state.medium !== "air" && state.hydDt > 25) {
    badgeText = "ΔT hoch";
    badgeState = "warn";
    note = "Spreizung über 25 K: für Heizkreise unüblich. Eingaben prüfen.";
  }

  setResult({
    label: "Wärmeleistung Q̇",
    numericValue: qKw,
    formatValue: (v) => (v > 0 ? formatDe(v, v >= 100 ? 1 : 2) : "–"),
    unit: "kW",
    rows: [
      ["Leistung", fmtUnit(qWatt, 0, "W")],
      ["Massenstrom", fmtUnit(massFlowKgH, 0, "kg/h")],
    ],
    badgeText,
    badgeState,
    note,
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
  let note = "";
  if (state.volPowerKw <= 0 || state.volDt <= 0) {
    badgeText = "Ungültig";
    badgeState = "bad";
    note = "Wärmeleistung und Spreizung müssen größer als 0 sein.";
  } else if (state.medium !== "air" && state.volDt < 3) {
    badgeText = "Hoher Durchfluss";
    badgeState = "warn";
    note = "Spreizung unter 3 K ergibt sehr hohe Volumenströme. Spreizung erhöhen.";
  }

  setResult({
    label: "Volumenstrom V̇",
    numericValue: flowM3h,
    formatValue: (v) => (v > 0 ? formatDe(v, v >= 10 ? 2 : 3) : "–"),
    unit: "m³/h",
    rows: [
      ["Volumenstrom", fmtUnit(flowLh, 0, "l/h")],
      ["Volumenstrom", fmtUnit(flowLmin, 1, "l/min")],
    ],
    badgeText,
    badgeState,
    note,
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
  let note = "";
  if (state.hlArea <= 0 || state.hlSpec <= 0) {
    badgeText = "Nullwert";
    badgeState = "warn";
    note = "Fläche und spezifische Heizlast müssen größer als 0 sein.";
  } else if (state.hlSpec > 130) {
    badgeText = "Sehr hoher Bedarf";
    badgeState = "warn";
    note = "Über 130 W/m²: Wert prüfen oder Gebäudestandard anpassen.";
  }

  setResult({
    label: "Gebäude-Heizlast Q̇",
    numericValue: qKw,
    formatValue: (v) => (v > 0 ? formatDe(v, v >= 100 ? 1 : 2) : "–"),
    unit: "kW",
    rows: [
      ["Leistung", fmtUnit(qWatt, 0, "W")],
      [`Volumenstrom bei ${formatDe(state.hlDt, 1)} K`, fmtUnit(flowLh, 0, "l/h")],
      [`Volumenstrom bei ${formatDe(state.hlDt, 1)} K`, fmtUnit(flowM3h, 2, "m³/h")],
    ],
    badgeText,
    badgeState,
    note,
  });
}

function renderActiveMode() {
  persistState();
  if (state.mode === "hydraulik") calculateHydraulik();
  else if (state.mode === "volumenstrom") calculateVolumenstrom();
  else calculateHeizlast();
}

function switchMode(newMode) {
  if (!["hydraulik", "volumenstrom", "heizlast"].includes(newMode)) return;
  const previous = state.mode;
  state.mode = newMode;

  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    setActive(btn, btn.dataset.mode === newMode);
  });

  const from = document.getElementById(`panel-${previous}`);
  const to = document.getElementById(`panel-${newMode}`);
  ["hydraulik", "volumenstrom", "heizlast"].forEach((m) => {
    const panel = document.getElementById(`panel-${m}`);
    if (panel && panel !== from && panel !== to) panel.hidden = true;
  });
  if (to) {
    if (from && from !== to && !from.hidden) fadeThrough(from, to);
    else to.hidden = false;
  }

  renderActiveMode();
}

function switchFlowUnit(newUnit) {
  if (!FLOW_UNIT_CONFIG[newUnit]) return;
  state.flowUnit = newUnit;
  const cfg = FLOW_UNIT_CONFIG[newUnit];

  document.querySelectorAll("#flow-unit-tabs [data-flow-unit]").forEach((btn) => {
    setActive(btn, btn.dataset.flowUnit === newUnit);
  });

  const input = document.getElementById("hyd-flow-input");
  const unitLabel = document.getElementById("hyd-flow-unit-label");
  if (input) input.value = formatInputVal(state.flowM3h / cfg.factorToM3h, cfg.decimals);
  if (unitLabel) unitLabel.textContent = cfg.label;

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
  // Einstellungen: mittige Karte, schließt über Knopf, Hintergrund und Escape
  const settingsBtn = document.getElementById("settings-toggle-btn");
  const closeBtn = document.getElementById("settings-close-btn");
  const overlay = document.getElementById("settings-overlay");
  const themeModeGroup = document.getElementById("theme-mode-group");

  if (settingsBtn) settingsBtn.addEventListener("click", openSettings);
  if (closeBtn) closeBtn.addEventListener("click", openCalc);
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) openCalc();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.view === "settings") openCalc();
  });

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
      persistState();
      calculateHydraulik();
    }
  );

  wireStepper("hyd-dt-minus", "hyd-dt-plus", "hyd-dt-input", 0.5, (val) => {
    state.hydDt = val;
    syncPresetChips("#dt-preset-group", "data-dt", val);
    persistState();
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
      persistState();
      calculateHydraulik();
    });
  }

  // Volumenstrom-Stepper & Presets
  wireStepper("vol-power-minus", "vol-power-plus", "vol-power-input", 0.5, (val) => {
    state.volPowerKw = val;
    persistState();
    calculateVolumenstrom();
  });

  wireStepper("vol-dt-minus", "vol-dt-plus", "vol-dt-input", 0.5, (val) => {
    state.volDt = Math.max(0.1, val);
    syncPresetChips("#vol-dt-preset-group", "data-dt", state.volDt);
    persistState();
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
      persistState();
      calculateVolumenstrom();
    });
  }

  // Heizlast-Stepper & Presets
  wireStepper("hl-area-minus", "hl-area-plus", "hl-area-input", 5, (val) => {
    state.hlArea = val;
    persistState();
    calculateHeizlast();
  });

  wireStepper("hl-spec-minus", "hl-spec-plus", "hl-spec-input", 5, (val) => {
    state.hlSpec = val;
    syncPresetChips("#hl-preset-group", "data-q", val);
    persistState();
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
      persistState();
      calculateHeizlast();
    });
  }

  wireStepper("hl-dt-minus", "hl-dt-plus", "hl-dt-input", 0.5, (val) => {
    state.hlDt = Math.max(0.1, val);
    syncPresetChips("#hl-dt-preset-group", "data-dt", state.hlDt);
    persistState();
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
      persistState();
      calculateHeizlast();
    });
  }

  wireStepper("param-rho-minus", "param-rho-plus", "param-rho-input", 1, (val) => {
    waermeParams.waterRho = Math.min(1050, Math.max(900, val));
    saveAppParams(WAERME_PARAMS_KEY, waermeParams);
    renderActiveMode();
  });

  wireStepper("param-cp-minus", "param-cp-plus", "param-cp-input", 0.01, (val) => {
    waermeParams.waterCp = Math.min(5, Math.max(2, val));
    saveAppParams(WAERME_PARAMS_KEY, waermeParams);
    renderActiveMode();
  });

}

function syncStateToUI() {
  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    setActive(btn, btn.dataset.mode === state.mode);
  });
  ["hydraulik", "volumenstrom", "heizlast"].forEach((m) => {
    const panel = document.getElementById(`panel-${m}`);
    if (panel) panel.hidden = m !== state.mode;
  });

  syncMediumChips();
  syncGlycolInputs(state.glycolPct);

  const cfg = FLOW_UNIT_CONFIG[state.flowUnit] || FLOW_UNIT_CONFIG.m3h;
  document.querySelectorAll("#flow-unit-tabs [data-flow-unit]").forEach((btn) => {
    setActive(btn, btn.dataset.flowUnit === state.flowUnit);
  });
  const flowInput = document.getElementById("hyd-flow-input");
  const flowUnitLabel = document.getElementById("hyd-flow-unit-label");
  if (flowInput) flowInput.value = formatInputVal(state.flowM3h / cfg.factorToM3h, cfg.decimals);
  if (flowUnitLabel) flowUnitLabel.textContent = cfg.label;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = String(val);
  };
  setVal("hyd-dt-input", state.hydDt);
  setVal("vol-power-input", state.volPowerKw);
  setVal("vol-dt-input", state.volDt);
  setVal("hl-area-input", state.hlArea);
  setVal("hl-spec-input", state.hlSpec);
  setVal("hl-dt-input", state.hlDt);

  syncPresetChips("#dt-preset-group", "data-dt", state.hydDt);
  syncPresetChips("#vol-dt-preset-group", "data-dt", state.volDt);
  syncPresetChips("#hl-preset-group", "data-q", state.hlSpec);
  syncPresetChips("#hl-dt-preset-group", "data-dt", state.hlDt);
}

function init() {
  const rhoIn = document.getElementById("param-rho-input");
  const cpIn = document.getElementById("param-cp-input");
  if (rhoIn) rhoIn.value = String(waermeParams.waterRho);
  if (cpIn) cpIn.value = String(waermeParams.waterCp);
  renderSettingsTheme();
  wireEvents();

  document.getElementById("reset-calc-btn")?.addEventListener("click", () => {
    Object.assign(state, DEFAULT_STATE, { view: "calc" });
    clearAppStorage(WAERME_STATE_KEY);
    syncStateToUI();
    renderActiveMode();
    showToast("Standardwerte wiederhergestellt");
  });

  syncStateToUI();
  renderActiveMode();
}

document.addEventListener("DOMContentLoaded", init);
