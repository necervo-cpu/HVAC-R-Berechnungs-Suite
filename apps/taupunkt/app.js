/**
 * Modul: Taupunkt, Luftfeuchte & Kondensations-Check (apps/taupunkt/app.js)
 * Zweck: Berechnet Taupunkttemperatur, absolute Feuchte (g/m³, g/kg) und Enthalpie
 *   feuchter Luft nach Magnus-Formel sowie den Sicherheitsabstand gegen Tauwasser.
 * Verantwortlichkeit: Feuchteluft-Formeln, Tauwasser-Ampel und Zahlenanimation.
 * Sicherheits- & Stabilitätsrelevanz: Clamping der relativen Feuchte (1–100 %) gegen
 *   Logarithmus von Null; ausschließlich sichere DOM-Updates.
 */

import {
  applyThemeMode,
  createNumberAnimator,
  getCurrentThemeMode,
  loadAppParams,
  prefersReducedMotion,
  saveAppParams,
  updateAllPills,
} from "../../assets/js/shared.js";

const TAUPUNKT_PARAMS_KEY = "hvacr-params-taupunkt";
const taupunktParams = loadAppParams(TAUPUNKT_PARAMS_KEY, {
  pAtmHpa: 1013,
  safetyMarginK: 2.0,
});

const state = {
  mode: "dewpoint", // 'dewpoint' | 'condensation'
  tempC: 22,
  rhPct: 50,
  surfaceC: 16,
};

function sanitizeNumber(raw, fallback, min, max) {
  const normalized = typeof raw === "string" ? raw.replace(",", ".") : raw;
  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function formatDe(value, decimals = 1) {
  if (!Number.isFinite(value)) return "0";
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

function triggerResultPop() {
  if (prefersReducedMotion()) return;
  const main = document.getElementById("result-main");
  if (!main) return;
  main.classList.remove("is-popping");
  void main.offsetWidth;
  main.classList.add("is-popping");
  window.setTimeout(() => main.classList.remove("is-popping"), 180);
}

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

function calculateAndRender(animate = true) {
  const air = calcMoistAir(state.tempC, state.rhPct);
  const labelEl = document.getElementById("result-label");
  const unitEl = document.getElementById("result-unit");
  const subEl = document.getElementById("result-sub");
  const badgeEl = document.getElementById("result-badge");
  const meterEl = document.getElementById("result-meter-fill");

  let numericValue = air.dewPointC;
  let label = "Taupunkttemperatur";
  let unit = "°C";
  let badgeText = "Behaglich";
  let badgeState = "ok";
  let meterPct = ((air.dewPointC + 10) / 40) * 100;
  let sub = `${formatDe(air.absHumidityGm3, 1)} g/m³ · ${formatDe(air.xGKg, 1)} g/kg · ${formatDe(
    air.enthalpyKjKg,
    1
  )} kJ/kg`;

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
    sub = `Taupunkt ${formatDe(air.dewPointC, 1)} °C · Oberfläche ${formatDe(state.surfaceC, 1)} °C`;
    meterPct = Math.max(6, Math.min(100, ((marginK + 2) / 12) * 100));

    if (marginK <= 0) {
      badgeText = "Tauwasserbildung!";
      badgeState = "bad";
    } else if (marginK < taupunktParams.safetyMarginK) {
      badgeText = `Kritisch (< ${formatDe(taupunktParams.safetyMarginK, 1)} K Reserve)`;
      badgeState = "warn";
    } else {
      badgeText = `Sicher (≥ ${formatDe(taupunktParams.safetyMarginK, 1)} K Reserve)`;
      badgeState = "ok";
    }
  }

  if (labelEl) labelEl.textContent = label;
  if (unitEl) unitEl.textContent = unit;
  if (subEl) subEl.textContent = sub;
  if (badgeEl) {
    badgeEl.textContent = badgeText;
    badgeEl.setAttribute("data-state", badgeState);
  }
  if (meterEl) {
    meterEl.style.width = `${Math.min(100, Math.max(6, meterPct))}%`;
    meterEl.setAttribute("data-state", badgeState);
  }

  resultNumberAnimator.update(numericValue, state.mode, animate);
  triggerResultPop();
}

function switchMode(newMode) {
  if (newMode !== "dewpoint" && newMode !== "condensation") return;
  state.mode = newMode;
  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.mode === newMode));
  });
  const surfaceWell = document.getElementById("surface-temp-well");
  if (surfaceWell) surfaceWell.hidden = newMode !== "condensation";
  updateAllPills();
  calculateAndRender(true);
}

function wireStepper(minusId, plusId, inputId, step, min, max, onUpdate) {
  const minus = document.getElementById(minusId);
  const plus = document.getElementById(plusId);
  const input = document.getElementById(inputId);
  if (!minus || !plus || !input) return;

  minus.addEventListener("click", () => {
    const cur = sanitizeNumber(input.value, min, min, max);
    const next = Math.max(min, Number((cur - step).toFixed(1)));
    input.value = String(next);
    onUpdate(next);
  });

  plus.addEventListener("click", () => {
    const cur = sanitizeNumber(input.value, min, min, max);
    const next = Math.min(max, Number((cur + step).toFixed(1)));
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
    btn.setAttribute("aria-checked", String(btn.getAttribute("data-theme-mode") === mode));
  });
}

function openSettings() {
  document.getElementById("view-calc").hidden = true;
  const sv = document.getElementById("view-settings");
  sv.hidden = false;
  sv.classList.remove("is-entering");
  void sv.offsetWidth;
  sv.classList.add("is-entering");
  document.getElementById("nav-home-link").hidden = true;
  document.getElementById("nav-back-btn").hidden = false;
  document.getElementById("brand-title").textContent = "Einstellungen";
  renderSettingsTheme();
}

function openCalc() {
  document.getElementById("view-settings").hidden = true;
  const cv = document.getElementById("view-calc");
  cv.hidden = false;
  cv.classList.remove("is-entering");
  void cv.offsetWidth;
  cv.classList.add("is-entering");
  document.getElementById("nav-back-btn").hidden = true;
  document.getElementById("nav-home-link").hidden = false;
  document.getElementById("brand-title").textContent = "Taupunkt";
  updateAllPills();
}

function init() {
  document.getElementById("settings-toggle-btn")?.addEventListener("click", openSettings);
  document.getElementById("nav-back-btn")?.addEventListener("click", openCalc);

  document.querySelectorAll("#theme-mode-group [data-theme-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyThemeMode(btn.getAttribute("data-theme-mode"));
      renderSettingsTheme();
    });
  });

  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => switchMode(btn.dataset.mode));
  });

  wireStepper("tp-temp-minus", "tp-temp-plus", "tp-temp-input", 0.5, -30, 60, (v) => {
    state.tempC = v;
    calculateAndRender(true);
  });
  wireStepper("tp-rh-minus", "tp-rh-plus", "tp-rh-input", 2, 1, 100, (v) => {
    state.rhPct = v;
    calculateAndRender(true);
  });
  wireStepper("tp-surface-minus", "tp-surface-plus", "tp-surface-input", 0.5, -30, 60, (v) => {
    state.surfaceC = v;
    calculateAndRender(true);
  });

  document.querySelectorAll("#climate-preset-group [data-t]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = sanitizeNumber(btn.dataset.t, 22, -30, 60);
      const rh = sanitizeNumber(btn.dataset.rh, 50, 1, 100);
      state.tempC = t;
      state.rhPct = rh;
      document.getElementById("tp-temp-input").value = String(t);
      document.getElementById("tp-rh-input").value = String(rh);
      document.querySelectorAll("#climate-preset-group [data-t]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      calculateAndRender(true);
    });
  });

  const pAtmIn = document.getElementById("param-patm-hpa-input");
  const marginIn = document.getElementById("param-margin-input");
  if (pAtmIn) pAtmIn.value = String(taupunktParams.pAtmHpa);
  if (marginIn) marginIn.value = String(taupunktParams.safetyMarginK);

  wireStepper("param-patm-hpa-minus", "param-patm-hpa-plus", "param-patm-hpa-input", 5, 700, 1100, (v) => {
    taupunktParams.pAtmHpa = v;
    saveAppParams(TAUPUNKT_PARAMS_KEY, taupunktParams);
    calculateAndRender(true);
  });
  wireStepper("param-margin-minus", "param-margin-plus", "param-margin-input", 0.5, 0.5, 6, (v) => {
    taupunktParams.safetyMarginK = v;
    saveAppParams(TAUPUNKT_PARAMS_KEY, taupunktParams);
    calculateAndRender(true);
  });

  window.addEventListener("resize", updateAllPills);
  updateAllPills();
  calculateAndRender(false);
}

init();
