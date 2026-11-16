/**
 * Modul: Taupunkt, Luftfeuchte & Kondensations-Check (apps/taupunkt/app.js)
 * Zweck: Berechnet Taupunkttemperatur, absolute Feuchte (g/m³, g/kg) und Enthalpie
 *   feuchter Luft nach Magnus-Formel sowie den Sicherheitsabstand gegen Tauwasser.
 * Verantwortlichkeit: Feuchteluft-Formeln, Tauwasser-Ampel und Zahlenanimation.
 * Sicherheits- & Stabilitätsrelevanz: Clamping der relativen Feuchte (1–100 %) gegen
 *   Logarithmus von Null; ausschließlich sichere DOM-Updates.
 */

import {
  clearAppStorage,
  createNumberAnimator,
  loadAppParams,
  parseLocaleNumber,
  saveAppParams,
  showToast,
} from "../../assets/js/shared.js";

const TAUPUNKT_PARAMS_KEY = "hvacr-params-taupunkt";
const taupunktParams = loadAppParams(TAUPUNKT_PARAMS_KEY, {
  pAtmHpa: 1013,
  safetyMarginK: 2.0,
});

const TAUPUNKT_STATE_KEY = "hvacr-state-taupunkt";
const DEFAULT_STATE = {
  mode: "dewpoint",
  tempC: 22,
  rhPct: 50,
  surfaceC: 16,
};

function sanitizeTaupunktState(raw) {
  return {
    mode: raw.mode === "condensation" ? "condensation" : "dewpoint",
    tempC: parseLocaleNumber(raw.tempC, 22, -30, 60),
    rhPct: parseLocaleNumber(raw.rhPct, 50, 1, 100),
    surfaceC: parseLocaleNumber(raw.surfaceC, 16, -30, 60),
  };
}

const state = sanitizeTaupunktState(loadAppParams(TAUPUNKT_STATE_KEY, DEFAULT_STATE));

function persistState() {
  saveAppParams(TAUPUNKT_STATE_KEY, state);
}

function sanitizeNumber(raw, fallback, min, max) {
  return parseLocaleNumber(raw, fallback, min, max);
}

const invalidFields = new Set();

function formatDe(value, decimals = 1) {
  if (!Number.isFinite(value)) return "–";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const resultNumberAnimator = createNumberAnimator({
  duration: 220,
  epsilon: 0.02,
  render: (val) => {
    const numEl = document.getElementById("result-number");
    if (numEl) numEl.textContent = formatDe(val, 1);
  },
});

function calcMoistAir(tempC, rhPct) {
  const rh = Math.min(100, Math.max(1, rhPct));
  // Magnus-Formel (über Wasser, für HVAC-R Standardbereich -30 bis +60 °C)
  const a = 17.62;
  const b = 243.12;
  const gamma = Math.log(rh / 100) + (a * tempC) / (b + tempC);
  const dewPointC = (b * gamma) / (a - gamma);

  // Sättigungsdampfdruck [hPa] und Partialdruck [hPa]
  const eSatHpa = 6.112 * Math.exp((a * tempC) / (b + tempC));
  const eHpa = (rh / 100) * eSatHpa;

  // Absolute Feuchte [g/m³] über ideale Gasgleichung für Wasserdampf
  const absHumidityGm3 = (216.7 * eHpa) / (tempC + 273.15);

  // Feuchtegrad x [g/kg] bei einstellbarem Luftdruck
  const pAtmHpa = taupunktParams.pAtmHpa || 1013;
  const xGKg = 622 * (eHpa / Math.max(1, pAtmHpa - eHpa));

  // Spezifische Enthalpie h [kJ/kg]
  const xKgKg = xGKg / 1000;
  const enthalpyKjKg = 1.006 * tempC + xKgKg * (2501 + 1.86 * tempC);

  return { dewPointC, absHumidityGm3, xGKg, enthalpyKjKg };
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function calculateAndRender(animate = true) {
  persistState();
  const air = calcMoistAir(state.tempC, state.rhPct);
  const pill = document.getElementById("result-pill");
  const hint = document.getElementById("input-hint");

  let numericValue = air.dewPointC;
  let label = "Taupunkttemperatur";
  let unit = "°C";
  let badgeText = "Behaglich";
  let badgeState = "ok";
  let rows = [
    ["Absolute Feuchte", `${formatDe(air.absHumidityGm3, 1)} g/m³`],
    ["Feuchtegrad", `${formatDe(air.xGKg, 1)} g/kg`],
    ["Enthalpie", `${formatDe(air.enthalpyKjKg, 1)} kJ/kg`],
  ];

  if (state.mode === "dewpoint") {
    if (state.rhPct < 30) {
      badgeText = "Sehr trocken (< 30 %)";
      badgeState = "warn";
    } else if (state.rhPct <= 60) {
      badgeText = "Behaglich (30–60 %)";
      badgeState = "ok";
    } else if (state.rhPct <= 75) {
      badgeText = "Erhöhte Feuchte";
      badgeState = "warn";
    } else {
      badgeText = "Kritisch feucht (> 75 %)";
      badgeState = "bad";
    }
  } else {
    const marginK = state.surfaceC - air.dewPointC;
    numericValue = marginK;
    label = "Abstand zum Taupunkt";
    unit = "K";
    rows = [
      ["Taupunkt", `${formatDe(air.dewPointC, 1)} °C`],
      ["Oberfläche", `${formatDe(state.surfaceC, 1)} °C`],
      ["Absolute Feuchte", `${formatDe(air.absHumidityGm3, 1)} g/m³`],
    ];

    if (marginK <= 0) {
      badgeText = "Tauwasserbildung";
      badgeState = "bad";
    } else if (marginK < taupunktParams.safetyMarginK) {
      badgeText = `Kritisch (< ${formatDe(taupunktParams.safetyMarginK, 1)} K Reserve)`;
      badgeState = "warn";
    } else {
      badgeText = `Sicher (≥ ${formatDe(taupunktParams.safetyMarginK, 1)} K Reserve)`;
      badgeState = "ok";
    }
  }

  const invalid = invalidFields.size > 0;
  if (hint) hint.hidden = !invalid;
  if (pill) pill.hidden = invalid;
  if (invalid) {
    numericValue = NaN;
    rows = rows.map(([name]) => [name, "–"]);
  }

  setText("result-label", label);
  setText("result-unit", unit);
  rows.forEach(([name, value], i) => {
    setText(`row${i + 1}-label`, name);
    setText(`row${i + 1}-value`, value);
  });
  if (pill) {
    pill.classList.remove("status-pill--green", "status-pill--orange", "status-pill--red");
    pill.classList.add(
      badgeState === "ok" ? "status-pill--green" : badgeState === "warn" ? "status-pill--orange" : "status-pill--red"
    );
  }
  setText("result-badge", badgeText);

  resultNumberAnimator.update(numericValue, state.mode, animate);
}

function switchMode(newMode) {
  if (newMode !== "dewpoint" && newMode !== "condensation") return;
  state.mode = newMode;
  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.mode === newMode));
  });
  const surfaceWell = document.getElementById("surface-temp-well");
  if (surfaceWell) surfaceWell.hidden = newMode !== "condensation";
  calculateAndRender(true);
}

function isParsable(raw) {
  const str = String(raw ?? "").replace(/\s+/g, "").replace(",", ".");
  return str !== "" && Number.isFinite(Number(str));
}

function wireInput(inputId, min, max, onUpdate) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener("input", () => {
    if (!isParsable(input.value)) {
      invalidFields.add(inputId);
      calculateAndRender(false);
      return;
    }
    invalidFields.delete(inputId);
    onUpdate(sanitizeNumber(input.value, min, min, max));
  });
  input.addEventListener("blur", () => {
    if (!invalidFields.has(inputId)) {
      const num = sanitizeNumber(input.value, min, min, max);
      input.value = String(num).replace(".", ",");
    }
  });
}

function syncStateToUI() {
  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.mode === state.mode));
  });
  const surfaceWell = document.getElementById("surface-temp-well");
  if (surfaceWell) surfaceWell.hidden = state.mode !== "condensation";

  invalidFields.clear();
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = String(val);
  };
  setVal("tp-temp-input", state.tempC);
  setVal("tp-rh-input", state.rhPct);
  setVal("tp-surface-input", state.surfaceC);

  document.querySelectorAll("#climate-preset-group [data-t]").forEach((btn) => {
    const t = parseLocaleNumber(btn.dataset.t, 22, -30, 60);
    const rh = parseLocaleNumber(btn.dataset.rh, 50, 1, 100);
    const match = Math.abs(t - state.tempC) < 0.01 && Math.abs(rh - state.rhPct) < 0.01;
    btn.setAttribute("aria-pressed", String(match));
  });
}

function init() {
  document.getElementById("reset-calc-btn")?.addEventListener("click", () => {
    Object.assign(state, DEFAULT_STATE);
    clearAppStorage(TAUPUNKT_STATE_KEY);
    syncStateToUI();
    calculateAndRender(true);
    showToast("Standardwerte wiederhergestellt");
  });

  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => switchMode(btn.dataset.mode));
  });

  wireInput("tp-temp-input", -30, 60, (v) => {
    state.tempC = v;
    calculateAndRender(true);
  });
  wireInput("tp-rh-input", 1, 100, (v) => {
    state.rhPct = v;
    calculateAndRender(true);
  });
  wireInput("tp-surface-input", -30, 60, (v) => {
    state.surfaceC = v;
    calculateAndRender(true);
  });

  document.querySelectorAll("#climate-preset-group [data-t]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = sanitizeNumber(btn.dataset.t, 22, -30, 60);
      const rh = sanitizeNumber(btn.dataset.rh, 50, 1, 100);
      state.tempC = t;
      state.rhPct = rh;
      invalidFields.delete("tp-temp-input");
      invalidFields.delete("tp-rh-input");
      document.getElementById("tp-temp-input").value = String(t);
      document.getElementById("tp-rh-input").value = String(rh);
      document.querySelectorAll("#climate-preset-group [data-t]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      calculateAndRender(true);
    });
  });

  const accHead = document.getElementById("params-acc-head");
  accHead?.addEventListener("click", () => {
    const acc = document.getElementById("params-acc");
    const open = acc.classList.toggle("is-open");
    accHead.setAttribute("aria-expanded", String(open));
  });

  const pAtmIn = document.getElementById("param-patm-hpa-input");
  const marginIn = document.getElementById("param-margin-input");
  if (pAtmIn) pAtmIn.value = String(taupunktParams.pAtmHpa);
  if (marginIn) marginIn.value = String(taupunktParams.safetyMarginK);

  wireInput("param-patm-hpa-input", 700, 1100, (v) => {
    taupunktParams.pAtmHpa = v;
    saveAppParams(TAUPUNKT_PARAMS_KEY, taupunktParams);
    calculateAndRender(true);
  });
  wireInput("param-margin-input", 0.5, 6, (v) => {
    taupunktParams.safetyMarginK = v;
    saveAppParams(TAUPUNKT_PARAMS_KEY, taupunktParams);
    calculateAndRender(true);
  });

  syncStateToUI();
  calculateAndRender(false);
}

init();
