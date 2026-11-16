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
  clearAppStorage,
  createNumberAnimator,
  fadeThrough,
  getCurrentThemeMode,
  loadAppParams,
  parseLocaleNumber,
  saveAppParams,
  showToast,
} from "../../assets/js/shared.js";

const LUFT_PARAMS_KEY = "hvacr-params-luftkanal";
const luftParams = loadAppParams(LUFT_PARAMS_KEY, {
  airRho: 1.204,
  vQuietMax: 4.0,
});

const AIR_RHO = 1.204; // kg/m³ bei 20 °C
const AIR_CP = 1.005; // kJ/(kg·K)

const LUFT_STATE_KEY = "hvacr-state-luftkanal";
const DEFAULT_STATE = {
  mode: "duct",
  shape: "round",
  flowM3h: 400,
  dnMm: 200,
  rectWmm: 300,
  rectHmm: 150,
  roomVolM3: 120,
  airDtK: 8,
};

function sanitizeLuftState(raw) {
  const validDn = [100, 125, 160, 200, 250, 315, 400, 500];
  const dnMm = parseLocaleNumber(raw.dnMm, 200, 50, 1500);
  return {
    mode: raw.mode === "room" ? "room" : "duct",
    shape: raw.shape === "rect" ? "rect" : "round",
    flowM3h: parseLocaleNumber(raw.flowM3h, 400, 0, 50000),
    dnMm: validDn.includes(dnMm) ? dnMm : 200,
    rectWmm: parseLocaleNumber(raw.rectWmm, 300, 50, 2000),
    rectHmm: parseLocaleNumber(raw.rectHmm, 150, 50, 2000),
    roomVolM3: parseLocaleNumber(raw.roomVolM3, 120, 1, 50000),
    airDtK: parseLocaleNumber(raw.airDtK, 8, 0, 60),
  };
}

const state = sanitizeLuftState(loadAppParams(LUFT_STATE_KEY, DEFAULT_STATE));

function persistState() {
  saveAppParams(LUFT_STATE_KEY, state);
}

function sanitizeNumber(raw, fallback, min, max) {
  return parseLocaleNumber(raw, fallback, min, max);
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

function calculateAndRender(animate = true) {
  persistState();
  const labelEl = document.getElementById("result-label");
  const unitEl = document.getElementById("result-unit");
  const rowsEl = document.getElementById("result-rows");
  const badgeEl = document.getElementById("result-badge");
  const badgeTextEl = document.getElementById("result-badge-text");

  const flowM3s = state.flowM3h / 3600;
  const flowLs = flowM3s * 1000;

  let numericValue = 0;
  let label = "Luftgeschwindigkeit v";
  let unit = "m/s";
  let badgeText = "Leise";
  let badgeState = "ok";
  let sub = "";
  let rows = [];

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
    sub = `${infoLabel} · Querschnitt ${formatDe(areaCm2, 0)} cm² · ${formatDe(flowLs, 0)} l/s`;
    rows = [
      ["Kanal", infoLabel],
      ["Querschnitt", `${formatDe(areaCm2, 0)} cm²`],
      ["Volumenstrom", `${formatDe(flowLs, 0)} l/s`],
    ];

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
    sub = `Sensible Leistung Q̇ = ${formatDe(qKw, 2)} kW · ${formatDe(flowLs, 0)} l/s`;
    rows = [
      ["Sensible Leistung Q̇", `${formatDe(qKw, 2)} kW`],
      ["Volumenstrom", `${formatDe(flowLs, 0)} l/s`],
    ];

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
  if (rowsEl) {
    rowsEl.replaceChildren();
    rows.forEach(([name, value]) => {
      const row = document.createElement("div");
      row.className = "info-row";
      const l = document.createElement("span");
      l.className = "info-row-label";
      l.textContent = name;
      const v = document.createElement("span");
      v.className = "info-row-value numeric";
      v.textContent = value;
      row.append(l, v);
      rowsEl.appendChild(row);
    });
  }
  if (badgeEl) {
    badgeEl.setAttribute("data-state", badgeState);
    badgeEl.classList.remove("status-pill--green", "status-pill--orange", "status-pill--red");
    badgeEl.classList.add(
      badgeState === "ok" ? "status-pill--green" : badgeState === "warn" ? "status-pill--orange" : "status-pill--red",
    );
  }
  if (badgeTextEl) badgeTextEl.textContent = badgeText;

  resultNumberAnimator.update(numericValue, state.mode, animate);
}

function setPressed(selector, attr, value) {
  document.querySelectorAll(selector).forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset[attr] === value));
  });
}

function switchMode(newMode) {
  if (newMode !== "duct" && newMode !== "room") return;
  const oldMode = state.mode;
  state.mode = newMode;
  setPressed("#mode-tabs [data-mode]", "mode", newMode);
  const from = document.getElementById(`panel-${oldMode}`);
  const to = document.getElementById(`panel-${newMode}`);
  if (from && to && from !== to && !from.hidden) {
    fadeThrough(from, to);
  } else if (to) {
    ["duct", "room"].forEach((m) => {
      const panel = document.getElementById(`panel-${m}`);
      if (panel) panel.hidden = m !== newMode;
    });
  }
  calculateAndRender(true);
}

function switchShape(newShape) {
  if (newShape !== "round" && newShape !== "rect") return;
  const oldShape = state.shape;
  state.shape = newShape;
  setPressed("#duct-shape-tabs [data-shape]", "shape", newShape);
  const roundWell = document.getElementById("duct-round-well");
  const rectWell = document.getElementById("duct-rect-well");
  if (oldShape !== newShape) {
    fadeThrough(newShape === "round" ? rectWell : roundWell, newShape === "round" ? roundWell : rectWell);
  }
  calculateAndRender(true);
}

function wireStepper(minusId, plusId, inputId, step, min, max, onUpdate) {
  const minus = document.getElementById(minusId);
  const plus = document.getElementById(plusId);
  const input = document.getElementById(inputId);
  const range = document.getElementById(`${inputId}-range`);
  if (!minus || !plus || !input) return;

  const syncRange = (v) => {
    if (range) range.value = String(v);
  };

  minus.addEventListener("click", () => {
    const cur = sanitizeNumber(input.value, min, min, max);
    const next = Math.max(min, Number((cur - step).toFixed(1)));
    input.value = String(next);
    syncRange(next);
    onUpdate(next);
  });

  plus.addEventListener("click", () => {
    const cur = sanitizeNumber(input.value, min, min, max);
    const next = Math.min(max, Number((cur + step).toFixed(1)));
    input.value = String(next);
    syncRange(next);
    onUpdate(next);
  });

  input.addEventListener("input", () => {
    const v = sanitizeNumber(input.value, min, min, max);
    syncRange(v);
    onUpdate(v);
  });

  if (range) {
    range.addEventListener("input", () => {
      const v = sanitizeNumber(range.value, min, min, max);
      input.value = String(v);
      onUpdate(v);
    });
  }
}

function renderSettingsTheme() {
  const mode = getCurrentThemeMode();
  document.querySelectorAll("#theme-mode-group [data-theme-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.getAttribute("data-theme-mode") === mode));
  });
}

function setSettingsOpen(open) {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;
  modal.classList.toggle("is-open", open);
  if (open) renderSettingsTheme();
}

function syncStateToUI() {
  setPressed("#mode-tabs [data-mode]", "mode", state.mode);
  ["duct", "room"].forEach((m) => {
    const panel = document.getElementById(`panel-${m}`);
    if (panel) panel.hidden = m !== state.mode;
  });

  setPressed("#duct-shape-tabs [data-shape]", "shape", state.shape);
  const roundWell = document.getElementById("duct-round-well");
  const rectWell = document.getElementById("duct-rect-well");
  if (roundWell) roundWell.hidden = state.shape !== "round";
  if (rectWell) rectWell.hidden = state.shape !== "rect";

  document.querySelectorAll("#dn-group [data-dn]").forEach((btn) => {
    const dn = parseLocaleNumber(btn.dataset.dn, 200, 50, 1500);
    btn.setAttribute("aria-selected", String(dn === state.dnMm));
  });

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = String(val);
    const range = document.getElementById(`${id}-range`);
    if (range) range.value = String(val);
  };
  setVal("air-flow-input", state.flowM3h);
  setVal("rect-w-input", state.rectWmm);
  setVal("rect-h-input", state.rectHmm);
  setVal("room-vol-input", state.roomVolM3);
  setVal("air-dt-input", state.airDtK);
}

function init() {
  document.getElementById("settings-toggle-btn")?.addEventListener("click", () => setSettingsOpen(true));
  document.getElementById("settingsCloseBtn")?.addEventListener("click", () => setSettingsOpen(false));
  document.getElementById("settingsModal")?.addEventListener("click", (e) => {
    if (e.target.id === "settingsModal") setSettingsOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setSettingsOpen(false);
  });

  document.getElementById("reset-calc-btn")?.addEventListener("click", () => {
    Object.assign(state, DEFAULT_STATE);
    clearAppStorage(LUFT_STATE_KEY);
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

  document.querySelectorAll("#duct-shape-tabs [data-shape]").forEach((btn) => {
    btn.addEventListener("click", () => switchShape(btn.dataset.shape));
  });

  document.querySelectorAll("#dn-group [data-dn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.dnMm = sanitizeNumber(btn.dataset.dn, 200, 50, 1500);
      document.querySelectorAll("#dn-group [data-dn]").forEach((b) => {
        b.setAttribute("aria-selected", String(b === btn));
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
  const rhoRange = document.getElementById("param-air-rho-input-range");
  const vqRange = document.getElementById("param-vquiet-input-range");
  if (rhoRange) rhoRange.value = String(luftParams.airRho);
  if (vqRange) vqRange.value = String(luftParams.vQuietMax);

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

  syncStateToUI();
  calculateAndRender(false);
}

init();
