/**
 * Modul: Kältemittel Druck-Temperatur & SH/SC-Rechner (apps/kaeltemittel/app.js)
 * Zweck: Berechnet Sättigungstemperatur, Sättigungsdruck sowie Überhitzung (SH) und
 *   Unterkühlung (SC) für gängige HVAC-R-Kältemittel anhand der Antoine-Dampfdruckgleichung.
 * Verantwortlichkeit: Kältemittel-Koeffizienten, Druckbezug (Überdruck / Absolutdruck),
 *   Plausibilitäts- und SH/SC-Bewertung sowie Live-Ergebnis mit Zahlenanimation.
 * Sicherheits- & Stabilitätsrelevanz: Eingabe-Clamping gegen negative Absolutdrücke
 *   und Schutz vor NaN/Infinity bei Logarithmen.
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

const KAELTE_PARAMS_KEY = "hvacr-params-kaeltemittel";
const kaelteParams = loadAppParams(KAELTE_PARAMS_KEY, {
  atmBar: 1.013,
  shMaxK: 8.0,
});

// Antoine-Gleichung: log10(p_bar_abs) = A - B / (T_C + C)
const REFRIGERANTS = {
  R32: { label: "R32", meta: "GWP 675 · A2L", a: 4.3556, b: 840.2, c: 243.3, tMin: -50, tMax: 75 },
  R410A: { label: "R410A", meta: "GWP 2088 · A1", a: 4.3531, b: 841.9, c: 244.8, tMin: -50, tMax: 70 },
  R290: { label: "R290", meta: "GWP 3 · A3 (Propan)", a: 4.0116, b: 834.3, c: 250.2, tMin: -50, tMax: 90 },
  R134a: { label: "R134a", meta: "GWP 1430 · A1", a: 4.1859, b: 928.5, c: 248.0, tMin: -40, tMax: 95 },
  R404A: { label: "R404A", meta: "GWP 3922 · A1", a: 4.241, b: 844.5, c: 247.5, tMin: -50, tMax: 70 },
  R449A: { label: "R449A", meta: "GWP 1397 · A1", a: 4.252, b: 866.8, c: 248.4, tMin: -45, tMax: 75 },
  R1234yf: { label: "R1234yf", meta: "GWP 4 · A2L", a: 4.1422, b: 896.8, c: 247.2, tMin: -40, tMax: 90 },
  R744: { label: "R744", meta: "GWP 1 · A1 (CO₂)", a: 4.685, b: 647.5, c: 246.0, tMin: -50, tMax: 30 },
};

const KAELTE_STATE_KEY = "hvacr-state-kaeltemittel";
const DEFAULT_STATE = {
  mode: "p2t",
  refrigerant: "R32",
  pressureRef: "gauge",
  shscType: "sh",
  p2tValue: 7.1,
  t2pValue: 0,
  shscPressure: 7.1,
  shscTemp: 6.5,
};

function sanitizeKaelteState(raw) {
  const mode = ["p2t", "t2p", "shsc"].includes(raw.mode) ? raw.mode : "p2t";
  const refrigerant = REFRIGERANTS[raw.refrigerant] ? raw.refrigerant : "R32";
  const pressureRef = raw.pressureRef === "abs" ? "abs" : "gauge";
  const shscType = raw.shscType === "sc" ? "sc" : "sh";
  return {
    view: "calc",
    mode,
    refrigerant,
    pressureRef,
    shscType,
    p2tValue: parseLocaleNumber(raw.p2tValue, 7.1, -0.9, 120),
    t2pValue: parseLocaleNumber(raw.t2pValue, 0, -50, 90),
    shscPressure: parseLocaleNumber(raw.shscPressure, 7.1, -0.9, 120),
    shscTemp: parseLocaleNumber(raw.shscTemp, 6.5, -50, 120),
  };
}

const state = sanitizeKaelteState(loadAppParams(KAELTE_STATE_KEY, DEFAULT_STATE));

function persistState() {
  const { view: _view, ...toSave } = state;
  saveAppParams(KAELTE_STATE_KEY, toSave);
}

function sanitizeNumber(raw, fallback, min = -100, max = 200) {
  return parseLocaleNumber(raw, fallback, min, max);
}

function formatDe(value, decimals = 1) {
  if (!Number.isFinite(value)) return "–";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function toAbsBar(inputBar) {
  const pAbs = state.pressureRef === "gauge" ? inputBar + kaelteParams.atmBar : inputBar;
  return Math.max(0.05, pAbs);
}

function fromAbsBar(pAbs) {
  return state.pressureRef === "gauge" ? pAbs - kaelteParams.atmBar : pAbs;
}

function calcSatTempC(refKey, pAbsBar) {
  const spec = REFRIGERANTS[refKey] || REFRIGERANTS.R32;
  const logP = Math.log10(Math.max(0.05, pAbsBar));
  const denom = spec.a - logP;
  if (Math.abs(denom) < 0.01) return spec.tMax;
  return spec.b / denom - spec.c;
}

function calcSatPressureAbs(refKey, tempC) {
  const spec = REFRIGERANTS[refKey] || REFRIGERANTS.R32;
  const clampedT = Math.min(spec.tMax + 10, Math.max(spec.tMin - 10, tempC));
  const exp = spec.a - spec.b / (clampedT + spec.c);
  return Math.pow(10, exp);
}

let activeDecimals = 1;

const resultNumberAnimator = createNumberAnimator({
  duration: 220,
  epsilon: 0.02,
  render: (val) => {
    const numEl = document.getElementById("result-number");
    if (numEl) numEl.textContent = formatDe(val, activeDecimals);
  },
});

function makeRow(label, value, unit) {
  const row = document.createElement("div");
  row.className = "info-row";
  const l = document.createElement("span");
  l.className = "info-row-label";
  l.textContent = label;
  const v = document.createElement("span");
  v.className = "info-row-value numeric";
  v.append(document.createTextNode(value));
  if (unit) {
    const u = document.createElement("span");
    u.className = "metric-unit";
    u.textContent = unit;
    v.append(u);
  }
  row.append(l, v);
  return row;
}

function renderRows(rows) {
  const host = document.getElementById("result-rows");
  if (!host) return;
  host.replaceChildren(...rows.map((r) => makeRow(r[0], r[1], r[2])));
}

function metaRows(spec) {
  const parts = String(spec.meta).split(" · ");
  const rows = [];
  if (parts[0]) rows.push(["GWP", parts[0].replace(/^GWP\s*/, ""), ""]);
  if (parts[1]) rows.push(["Sicherheitsklasse", parts[1], ""]);
  return rows;
}

function setBadge(text, badgeState) {
  const badgeEl = document.getElementById("result-badge");
  const textEl = document.getElementById("result-badge-text");
  if (textEl) textEl.textContent = text;
  if (badgeEl) {
    const cls = badgeState === "bad" ? "red" : badgeState === "warn" ? "orange" : "green";
    badgeEl.className = `status-pill status-pill--${cls}`;
  }
}

function calculateAndRender(animate = true) {
  persistState();
  const spec = REFRIGERANTS[state.refrigerant] || REFRIGERANTS.R32;
  const labelEl = document.getElementById("result-label");
  const unitEl = document.getElementById("result-unit");
  const subEl = document.getElementById("result-label");

  let numericValue = 0;
  let unit = "°C";
  let label = "Sättigungstemperatur";
  let sub = "";
  let badgeText = "Plausibel";
  let badgeState = "ok";
  let rows = [];

  if (state.mode === "p2t") {
    const pAbs = toAbsBar(state.p2tValue);
    const satT = calcSatTempC(state.refrigerant, pAbs);
    activeDecimals = 1;
    numericValue = satT;
    unit = "°C";
    label = "Sättigungstemperatur";
    sub = `${spec.label}, Absolutdruck ${formatDe(pAbs, 2)} bar, Überdruck ${formatDe(pAbs - kaelteParams.atmBar, 2)} bar`;
    rows = [
      ["Absolutdruck", formatDe(pAbs, 2), "bar"],
      ["Überdruck (Manometer)", formatDe(pAbs - kaelteParams.atmBar, 2), "bar"],
      ...metaRows(spec),
    ];

    if (satT < spec.tMin || satT > spec.tMax) {
      badgeText = "Außerhalb Standardbereich";
      badgeState = "warn";
    } else {
      badgeText = satT < 10 ? "Verdampfung" : "Kondensation";
      badgeState = "ok";
    }
  } else if (state.mode === "t2p") {
    const pAbs = calcSatPressureAbs(state.refrigerant, state.t2pValue);
    const pOut = fromAbsBar(pAbs);
    activeDecimals = 2;
    numericValue = pOut;
    unit = state.pressureRef === "gauge" ? "bar Überdruck" : "bar absolut";
    label = "Sättigungsdruck";
    sub = `${spec.label}, Absolutdruck ${formatDe(pAbs, 2)} bar, Überdruck ${formatDe(pAbs - kaelteParams.atmBar, 2)} bar, ${formatDe(state.t2pValue, 1)} °C`;
    rows = [
      ["Absolutdruck", formatDe(pAbs, 2), "bar"],
      ["Überdruck (Manometer)", formatDe(pAbs - kaelteParams.atmBar, 2), "bar"],
      ["Sättigungstemperatur", formatDe(state.t2pValue, 1), "°C"],
      ...metaRows(spec),
    ];

    if (state.t2pValue < spec.tMin || state.t2pValue > spec.tMax) {
      badgeText = "Grenzbereich";
      badgeState = "warn";
    } else {
      badgeText = "Dampfdruckkurve";
      badgeState = "ok";
    }
  } else {
    const pAbs = toAbsBar(state.shscPressure);
    const satT = calcSatTempC(state.refrigerant, pAbs);
    const diff = state.shscType === "sh" ? state.shscTemp - satT : satT - state.shscTemp;
    activeDecimals = 1;
    numericValue = diff;
    unit = "K";
    label = state.shscType === "sh" ? "Überhitzung (SH)" : "Unterkühlung (SC)";
    sub = `${spec.label}, T_satt = ${formatDe(satT, 1)} °C, T_rohr = ${formatDe(state.shscTemp, 1)} °C`;
    rows = [
      ["Absolutdruck", formatDe(pAbs, 2), "bar"],
      ["Überdruck (Manometer)", formatDe(pAbs - kaelteParams.atmBar, 2), "bar"],
      ["Sättigungstemperatur T_satt", formatDe(satT, 1), "°C"],
      ["Rohrtemperatur T_rohr", formatDe(state.shscTemp, 1), "°C"],
      ...metaRows(spec),
    ];

    if (diff < 0) {
      badgeText = state.shscType === "sh" ? "Nassdampf / Flüssigkeit!" : "Keine Unterkühlung!";
      badgeState = "bad";
    } else if (diff < 3) {
      badgeText = state.shscType === "sh" ? "Zu gering (Flüssigkeitsschlag)" : "Sehr gering (Dampfblasen)";
      badgeState = "warn";
    } else if (diff <= kaelteParams.shMaxK) {
      badgeText = `Optimal (3–${formatDe(kaelteParams.shMaxK, 0)} K Ziel)`;
      badgeState = "ok";
    } else if (diff <= 14) {
      badgeText = "Erhöht";
      badgeState = "warn";
    } else {
      badgeText = state.shscType === "sh" ? "Zu hoch (Mangel / EEV)" : "Stark unterkühlt";
      badgeState = "warn";
    }
  }

  if (labelEl) labelEl.textContent = label;
  if (unitEl) unitEl.textContent = unit;
  if (subEl) subEl.dataset.sub = sub;
  setBadge(badgeText, badgeState);
  renderRows(rows);

  resultNumberAnimator.update(numericValue, `${state.mode}:${state.shscType}`, animate);
}

function syncPressureUnitLabels() {
  const unitText = state.pressureRef === "gauge" ? "bar Überdruck" : "bar absolut";
  const p2tUnit = document.getElementById("p2t-unit-label");
  const shscUnit = document.getElementById("shsc-p-unit");
  if (p2tUnit) p2tUnit.textContent = unitText;
  if (shscUnit) shscUnit.textContent = unitText;
}

function switchMode(newMode) {
  if (!["p2t", "t2p", "shsc"].includes(newMode)) return;
  state.mode = newMode;
  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.mode === newMode));
  });
  const panels = ["p2t", "t2p", "shsc"].map((m) => document.getElementById(`panel-${m}`));
  const target = document.getElementById(`panel-${newMode}`);
  const current = panels.find((p) => p && !p.hidden);
  panels.forEach((p) => {
    if (p && p !== target && p !== current) p.hidden = true;
  });
  fadeThrough(current, target);
  calculateAndRender(true);
}

function wireStepper(minusId, plusId, inputId, step, min, max, onUpdate) {
  const minus = document.getElementById(minusId);
  const plus = document.getElementById(plusId);
  const input = document.getElementById(inputId);
  if (!minus || !plus || !input) return;

  minus.addEventListener("click", () => {
    const cur = sanitizeNumber(input.value, 0, min, max);
    const next = Math.max(min, Number((cur - step).toFixed(2)));
    input.value = String(next);
    onUpdate(next);
  });

  plus.addEventListener("click", () => {
    const cur = sanitizeNumber(input.value, 0, min, max);
    const next = Math.min(max, Number((cur + step).toFixed(2)));
    input.value = String(next);
    onUpdate(next);
  });

  input.addEventListener("input", () => {
    onUpdate(sanitizeNumber(input.value, min, min, max));
  });
}

function renderSettingsTheme() {
  const mode = getCurrentThemeMode();
  document.querySelectorAll("#theme-mode-group [data-theme-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.getAttribute("data-theme-mode") === mode));
  });
}

function openSettings() {
  renderSettingsTheme();
  document.getElementById("settings-modal")?.classList.add("is-open");
  document.getElementById("settings-close-btn")?.focus();
}

function closeSettings() {
  document.getElementById("settings-modal")?.classList.remove("is-open");
  document.getElementById("settings-toggle-btn")?.focus();
}

function syncStateToUI() {
  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.mode === state.mode));
  });
  ["p2t", "t2p", "shsc"].forEach((m) => {
    const panel = document.getElementById(`panel-${m}`);
    if (panel) panel.hidden = m !== state.mode;
  });

  document.querySelectorAll("#refrigerant-group [data-ref]").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.ref === state.refrigerant));
  });

  document.querySelectorAll("#pressure-ref-tabs [data-pref]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.pref === state.pressureRef));
  });
  document.querySelectorAll("#shsc-type-tabs [data-shsc]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.shsc === state.shscType));
  });
  const tLabel = document.getElementById("shsc-t-label");
  if (tLabel) tLabel.textContent = state.shscType === "sh" ? "Sauggas-Temp" : "Flüssig-Temp";

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = String(val);
  };
  setVal("p2t-input", state.p2tValue);
  setVal("t2p-input", state.t2pValue);
  setVal("shsc-p-input", state.shscPressure);
  setVal("shsc-t-input", state.shscTemp);

  syncPressureUnitLabels();
}

function init() {
  document.getElementById("settings-toggle-btn")?.addEventListener("click", openSettings);
  document.getElementById("settings-close-btn")?.addEventListener("click", closeSettings);
  document.getElementById("settings-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeSettings();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSettings();
  });

  document.getElementById("reset-calc-btn")?.addEventListener("click", () => {
    Object.assign(state, DEFAULT_STATE, { view: "calc" });
    clearAppStorage(KAELTE_STATE_KEY);
    syncStateToUI();
    calculateAndRender(true);
    showToast("Standardwerte wiederhergestellt");
  });

  document.querySelectorAll("#theme-mode-group [data-theme-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyThemeMode(btn.getAttribute("data-theme-mode"));
      renderSettingsTheme();
    });
  });

  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => switchMode(btn.dataset.mode));
  });

  document.querySelectorAll("#refrigerant-group [data-ref]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ref = btn.dataset.ref;
      if (!REFRIGERANTS[ref]) return;
      state.refrigerant = ref;
      document.querySelectorAll("#refrigerant-group [data-ref]").forEach((b) => {
        b.setAttribute("aria-selected", String(b.dataset.ref === ref));
      });
      calculateAndRender(true);
    });
  });

  document.querySelectorAll("#pressure-ref-tabs [data-pref]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pref = btn.dataset.pref;
      if (pref !== "gauge" && pref !== "abs") return;
      state.pressureRef = pref;
      document.querySelectorAll("#pressure-ref-tabs [data-pref]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.pref === pref));
      });
      syncPressureUnitLabels();
      calculateAndRender(true);
    });
  });

  document.querySelectorAll("#shsc-type-tabs [data-shsc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.shsc;
      if (t !== "sh" && t !== "sc") return;
      state.shscType = t;
      document.querySelectorAll("#shsc-type-tabs [data-shsc]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.shsc === t));
      });
      const tLabel = document.getElementById("shsc-t-label");
      if (tLabel) tLabel.textContent = t === "sh" ? "Sauggas-Temp" : "Flüssig-Temp";
      calculateAndRender(true);
    });
  });

  wireStepper("p2t-minus", "p2t-plus", "p2t-input", 0.2, -0.9, 120, (v) => {
    state.p2tValue = v;
    calculateAndRender(true);
  });
  wireStepper("t2p-minus", "t2p-plus", "t2p-input", 1, -50, 90, (v) => {
    state.t2pValue = v;
    calculateAndRender(true);
  });
  wireStepper("shsc-p-minus", "shsc-p-plus", "shsc-p-input", 0.2, -0.9, 120, (v) => {
    state.shscPressure = v;
    calculateAndRender(true);
  });
  wireStepper("shsc-t-minus", "shsc-t-plus", "shsc-t-input", 0.5, -50, 120, (v) => {
    state.shscTemp = v;
    calculateAndRender(true);
  });

  const pAtmIn = document.getElementById("param-patm-input");
  const shMaxIn = document.getElementById("param-shmax-input");
  if (pAtmIn) pAtmIn.value = String(kaelteParams.atmBar);
  if (shMaxIn) shMaxIn.value = String(kaelteParams.shMaxK);

  wireStepper("param-patm-minus", "param-patm-plus", "param-patm-input", 0.01, 0.7, 1.1, (v) => {
    kaelteParams.atmBar = v;
    saveAppParams(KAELTE_PARAMS_KEY, kaelteParams);
    calculateAndRender(true);
  });
  wireStepper("param-shmax-minus", "param-shmax-plus", "param-shmax-input", 0.5, 4, 15, (v) => {
    kaelteParams.shMaxK = v;
    saveAppParams(KAELTE_PARAMS_KEY, kaelteParams);
    calculateAndRender(true);
  });

  syncStateToUI();
  calculateAndRender(false);
}

init();
