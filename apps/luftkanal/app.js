/**
 * Modul: Luftkanal & RLT-Luftleistung-Rechner (apps/luftkanal/app.js)
 * Zweck: Berechnet Luftgeschwindigkeit in Rundrohren und Rechteckkanälen (inkl. Gleichwert-
 *   Durchmesser d_eq) sowie Luftwechselrate n und sensible Luftleistung Q̇.
 * Verantwortlichkeit: Kanalgeometrie, Luftwechsel-/Leistungsberechnung und Zahlenanimation.
 * Sicherheits- & Stabilitätsrelevanz: Schutz vor Division durch Null bei Querschnitts- und
 *   Raumvolumen-Berechnungen; ausschließlich sichere DOM-Updates.
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

const LUFT_PARAMS_KEY = "hvacr-params-luftkanal";
const luftParams = loadAppParams(LUFT_PARAMS_KEY, {
  airRho: 1.204,
  vQuietMax: 4.0,
});

const AIR_RHO = 1.204; // kg/m³ bei 20 °C
const AIR_CP = 1.005; // kJ/(kg·K)

const state = {
  mode: "duct", // 'duct' | 'room'
  shape: "round", // 'round' | 'rect'
  flowM3h: 400,
  dnMm: 200,
  rectWmm: 300,
  rectHmm: 150,
  roomVolM3: 120,
  airDtK: 8,
};

function sanitizeNumber(raw, fallback, min, max) {
  const normalized = typeof raw === "string" ? raw.replace(",", ".") : raw;
  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function formatDe(value, decimals = 2) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const resultNumberAnimator = createNumberAnimator({
  duration: 220,
  epsilon: 0.01,
  render: (val) => {
    const numEl = document.getElementById("result-number");
    if (numEl) numEl.textContent = formatDe(val, 2);
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

function calculateAndRender(animate = true) {
  const labelEl = document.getElementById("result-label");
  const unitEl = document.getElementById("result-unit");
  const subEl = document.getElementById("result-sub");
  const badgeEl = document.getElementById("result-badge");
  const meterEl = document.getElementById("result-meter-fill");

  const flowM3s = state.flowM3h / 3600;
  const flowLs = flowM3s * 1000;

  let numericValue = 0;
  let label = "Luftgeschwindigkeit v";
  let unit = "m/s";
  let badgeText = "Leise";
  let badgeState = "ok";
  let meterPct = 40;
  let sub = "";

  if (state.mode === "duct") {
    let areaM2 = 0;
    let infoLabel = "";
    if (state.shape === "round") {
      const dM = state.dnMm / 1000;
      areaM2 = (Math.PI * dM * dM) / 4;
      infoLabel = `DN ${state.dnMm}`;
    } else {
      const bM = state.rectWmm / 1000;
      const hM = state.rectHmm / 1000;
      areaM2 = bM * hM;
      // Hydraulischer Gleichwertdurchmesser nach Huebscher
      const dEqMm = 1.3 * Math.pow(Math.pow(state.rectWmm * state.rectHmm, 5) / Math.pow(state.rectWmm + state.rectHmm, 2), 0.125);
      infoLabel = `${state.rectWmm}×${state.rectHmm} mm (d_eq ${formatDe(dEqMm, 0)} mm)`;
    }

    const v = areaM2 > 0 ? flowM3s / areaM2 : 0;
    const areaCm2 = areaM2 * 10000;
    numericValue = v;
    meterPct = (v / 8) * 100;
    sub = `${infoLabel} · Querschnitt ${formatDe(areaCm2, 0)} cm² · ${formatDe(flowLs, 0)} l/s`;

    if (v <= 0) {
      badgeText = "Kein Luftstrom";
      badgeState = "warn";
    } else if (v <= luftParams.vQuietMax) {
      badgeText = `Leise (≤ ${formatDe(luftParams.vQuietMax, 1)} m/s)`;
      badgeState = "ok";
    } else if (v <= 6.0) {
      badgeText = `Verteilkanal (${formatDe(luftParams.vQuietMax, 1)}–6 m/s)`;
      badgeState = "warn";
    } else {
      badgeText = "Zu schnell / laut (> 6 m/s)";
      badgeState = "bad";
    }
  } else {
    const nRate = state.roomVolM3 > 0 ? state.flowM3h / state.roomVolM3 : 0;
    const qKw = flowM3s * luftParams.airRho * AIR_CP * state.airDtK;
    numericValue = nRate;
    label = "Luftwechselrate n";
    unit = "1/h";
    meterPct = (nRate / 10) * 100;
    sub = `Sensible Leistung Q̇ = ${formatDe(qKw, 2)} kW · ${formatDe(flowLs, 0)} l/s`;

    if (nRate <= 0) {
      badgeText = "Nullwert";
      badgeState = "warn";
    } else if (nRate < 0.5) {
      badgeText = "Gering (< 0,5 /h)";
      badgeState = "warn";
    } else if (nRate <= 6) {
      badgeText = "Standard-RLT";
      badgeState = "ok";
    } else {
      badgeText = "Hoher Luftwechsel";
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
  if (newMode !== "duct" && newMode !== "room") return;
  state.mode = newMode;
  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.mode === newMode));
  });
  ["duct", "room"].forEach((m) => {
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
  calculateAndRender(true);
}

function switchShape(newShape) {
  if (newShape !== "round" && newShape !== "rect") return;
  state.shape = newShape;
  document.querySelectorAll("#duct-shape-tabs [data-shape]").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.shape === newShape));
  });
  document.getElementById("duct-round-well").hidden = newShape !== "round";
  document.getElementById("duct-rect-well").hidden = newShape !== "rect";
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
  document.getElementById("brand-title").textContent = "Luftkanal";
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

  document.querySelectorAll("#duct-shape-tabs [data-shape]").forEach((btn) => {
    btn.addEventListener("click", () => switchShape(btn.dataset.shape));
  });

  document.querySelectorAll("#dn-group [data-dn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.dnMm = sanitizeNumber(btn.dataset.dn, 200, 50, 1500);
      document.querySelectorAll("#dn-group [data-dn]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      calculateAndRender(true);
    });
  });

  wireStepper("air-flow-minus", "air-flow-plus", "air-flow-input", 50, 0, 50000, (v) => {
    state.flowM3h = v;
    calculateAndRender(true);
  });
  wireStepper("rect-w-minus", "rect-w-plus", "rect-w-input", 50, 50, 2000, (v) => {
    state.rectWmm = v;
    calculateAndRender(true);
  });
  wireStepper("rect-h-minus", "rect-h-plus", "rect-h-input", 50, 50, 2000, (v) => {
    state.rectHmm = v;
    calculateAndRender(true);
  });
  wireStepper("room-vol-minus", "room-vol-plus", "room-vol-input", 10, 1, 50000, (v) => {
    state.roomVolM3 = v;
    calculateAndRender(true);
  });
  wireStepper("air-dt-minus", "air-dt-plus", "air-dt-input", 1, 0, 60, (v) => {
    state.airDtK = v;
    calculateAndRender(true);
  });

  const rhoIn = document.getElementById("param-air-rho-input");
  const vqIn = document.getElementById("param-vquiet-input");
  if (rhoIn) rhoIn.value = String(luftParams.airRho);
  if (vqIn) vqIn.value = String(luftParams.vQuietMax);

  wireStepper("param-air-rho-minus", "param-air-rho-plus", "param-air-rho-input", 0.01, 0.9, 1.4, (v) => {
    luftParams.airRho = v;
    saveAppParams(LUFT_PARAMS_KEY, luftParams);
    calculateAndRender(true);
  });
  wireStepper("param-vquiet-minus", "param-vquiet-plus", "param-vquiet-input", 0.5, 2, 8, (v) => {
    luftParams.vQuietMax = v;
    saveAppParams(LUFT_PARAMS_KEY, luftParams);
    calculateAndRender(true);
  });

  window.addEventListener("resize", updateAllPills);
  updateAllPills();
  calculateAndRender(false);
}

init();
