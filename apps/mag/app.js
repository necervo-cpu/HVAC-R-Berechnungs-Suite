/**
 * Modul: Ausdehnungsgefäß (MAG) & Vordruck-Rechner (apps/mag/app.js)
 * Zweck: Berechnet Stickstoff-Vordruck p₀, Anlagenfülldruck pₐ und das erforderliche
 *   MAG-Nennvolumen Vₙ nach DIN EN 12828 inkl. nächstgrößerer Standardgröße.
 * Verantwortlichkeit: Druckreserven, Ausdehnungskoeffizienten (Wasser / Glykol 30 %),
 *   Plausibilitätsprüfung (Enddruck > Vordruck) und Zahlenanimation.
 * Sicherheits- & Stabilitätsrelevanz: Schutz vor Division durch Null bei unzulässiger
 *   statischer Höhe (p₀ >= pₑ) mit eindeutiger deutscher Warnmeldung.
 */

import {
  clearAppStorage,
  createNumberAnimator,
  loadAppParams,
  parseLocaleNumber,
  prefersReducedMotion,
  saveAppParams,
  showToast,
} from "../../assets/js/shared.js";

const MAG_PARAMS_KEY = "hvacr-params-mag";
const magParams = loadAppParams(MAG_PARAMS_KEY, {
  safetyBar: 0.3,
  p0MinBar: 0.8,
});
// Altlasten aus früherer Speicherung mit reserveBar auf safetyBar übernehmen
if (typeof magParams.safetyBar !== "number" || !Number.isFinite(magParams.safetyBar)) {
  magParams.safetyBar = Number.isFinite(magParams.reserveBar) ? magParams.reserveBar : 0.3;
}

const STANDARD_MAG_SIZES = [8, 12, 18, 25, 35, 50, 80, 100, 140, 200, 250, 300, 400, 500, 600, 800, 1000];

// Volumenausdehnung n [%] bezogen auf Kaltwasser 10 °C
const EXPANSION_WATER = { 40: 0.78, 55: 1.45, 70: 2.27, 85: 3.24 };
const EXPANSION_GLYCOL30 = { 40: 1.35, 55: 2.2, 70: 3.15, 85: 4.25 };

const MAG_STATE_KEY = "hvacr-state-mag";
const DEFAULT_STATE = {
  mode: "pressure",
  heightM: 9,
  svBar: 3.0,
  volumeL: 250,
  tMaxC: 70,
  medium: "water",
};

function sanitizeMagState(raw) {
  const validSv = [2.5, 3.0, 4.0, 6.0];
  const svBar = parseLocaleNumber(raw.svBar, 3.0, 1.5, 10);
  const validTmax = [40, 55, 70, 85];
  const tMaxC = parseLocaleNumber(raw.tMaxC, 70, 30, 100);
  return {
    mode: raw.mode === "volume" ? "volume" : "pressure",
    heightM: parseLocaleNumber(raw.heightM, 9, 0, 60),
    svBar: validSv.includes(svBar) ? svBar : 3.0,
    volumeL: parseLocaleNumber(raw.volumeL, 250, 10, 10000),
    tMaxC: validTmax.includes(tMaxC) ? tMaxC : 70,
    medium: raw.medium === "glycol" ? "glycol" : "water",
  };
}

const state = sanitizeMagState(loadAppParams(MAG_STATE_KEY, DEFAULT_STATE));

function persistState() {
  saveAppParams(MAG_STATE_KEY, state);
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

let activeDecimals = 2;
let resultInvalid = false;

const resultNumberAnimator = createNumberAnimator({
  duration: 220,
  epsilon: 0.01,
  render: (val) => {
    const numEl = document.getElementById("result-number");
    if (numEl) numEl.textContent = resultInvalid ? "–" : formatDe(val, activeDecimals);
  },
});

function renderRows(rows) {
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
      v.className = "info-row-value";
      v.textContent = value;
      row.append(l, v);
      return row;
    }),
  );
}

function calculateAndRender(animate = true) {
  persistState();
  const pStat = state.heightM / 10;
  const safety = sanitizeNumber(magParams.safetyBar, 0.3, 0, 1.0);
  const p0 = Math.max(magParams.p0MinBar, Number((pStat + safety).toFixed(2)));
  const pa = Number((p0 + 0.3).toFixed(2));
  const pe = state.svBar <= 3.0 ? Number((state.svBar - 0.5).toFixed(2)) : Number((state.svBar * 0.9).toFixed(2));

  const labelEl = document.getElementById("result-label");
  const unitEl = document.getElementById("result-unit");
  const noteEl = document.getElementById("result-note");
  const badgeEl = document.getElementById("result-badge");
  const badgeTextEl = document.getElementById("result-badge-text");

  let numericValue = p0;
  let label = "Stickstoff-Vordruck p₀";
  let unit = "bar";
  let badgeText = "EN 12828";
  let badgeState = "ok";
  let note = "";
  resultInvalid = false;
  let rows = [
    ["Statischer Druck pₛₜ", `${formatDe(pStat, 2)} bar`],
    ["Sicherheitszuschlag", `${formatDe(safety, 2)} bar`],
    ["Fülldruck pₐ", `${formatDe(pa, 2)} bar`],
    ["Enddruck pₑ", `${formatDe(pe, 2)} bar`],
  ];

  if (pa >= pe) {
    badgeText = "Ventildruck zu niedrig";
    badgeState = "bad";
    note = "Der Fülldruck liegt über dem Enddruck. Sicherheitsventil mit höherem Ansprechdruck wählen oder statische Höhe prüfen.";
  }

  if (state.mode === "pressure") {
    activeDecimals = 2;
    numericValue = p0;
  } else {
    activeDecimals = 0;
    label = "Erforderliches MAG-Volumen";
    unit = "l";

    const expMap = state.medium === "glycol" ? EXPANSION_GLYCOL30 : EXPANSION_WATER;
    const expPct = expMap[state.tMaxC] || 2.27;
    const ve = state.volumeL * (expPct / 100);
    const vv = Math.max(state.volumeL * 0.005, 3); // Wasservorlage mind. 0,5 % bzw. 3 l

    if (pe <= p0 + 0.2) {
      numericValue = 0;
      resultInvalid = true;
      badgeText = "Druckdifferenz zu klein";
      badgeState = "bad";
      note = "Druckdifferenz zwischen Vordruck und Enddruck zu klein. Sicherheitsventil größer wählen oder statische Höhe prüfen.";
    } else {
      // Vn = (Ve + Vv) * (pe + 1) / (pe - p0)
      const vn = ((ve + vv) * (pe + 1)) / (pe - p0);
      const nextStd = STANDARD_MAG_SIZES.find((s) => s >= vn) || STANDARD_MAG_SIZES[STANDARD_MAG_SIZES.length - 1];
      numericValue = vn;
      badgeText = `Empfehlung: ${nextStd} l MAG`;
      badgeState = "ok";
      rows = [
        ["Ausdehnung Vₑ", `${formatDe(ve, 1)} l`],
        ["Vordruck p₀", `${formatDe(p0, 2)} bar`],
        ["Enddruck pₑ", `${formatDe(pe, 2)} bar`],
        ["Sicherheitszuschlag", `${formatDe(safety, 2)} bar`],
      ];
    }
  }

  if (labelEl) labelEl.textContent = label;
  if (unitEl) unitEl.textContent = unit;
  if (noteEl) {
    noteEl.textContent = note;
    noteEl.hidden = !note;
  }
  if (badgeEl) {
    badgeEl.className = `status-pill ${badgeState === "ok" ? "status-pill--green" : "status-pill--orange"}`;
  }
  if (badgeTextEl) badgeTextEl.textContent = badgeText;
  renderRows(resultInvalid ? [] : rows);

  const valueText = resultInvalid ? "–" : `${formatDe(numericValue, activeDecimals)} ${unit}`;
  const rowText = rows.map(([l, v]) => `${l} = ${v}`).join(", ");

  resultNumberAnimator.update(numericValue, state.mode, animate);
}

function setPressed(group, attr, matcher) {
  document.querySelectorAll(`${group} [${attr}]`).forEach((btn) => {
    btn.setAttribute("aria-pressed", String(matcher(btn)));
  });
}

function switchMode(newMode) {
  if (newMode !== "pressure" && newMode !== "volume") return;
  state.mode = newMode;
  setPressed("#mode-tabs", "data-mode", (btn) => btn.dataset.mode === newMode);
  const volPanel = document.getElementById("panel-volume");
  if (volPanel) {
    const wasHidden = volPanel.hidden;
    volPanel.hidden = newMode !== "volume";
    if (newMode === "volume" && wasHidden && !prefersReducedMotion()) {
      volPanel.animate(
        [
          { opacity: 0, transform: "scale(0.98)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        { duration: 210, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
      );
    }
  }
  calculateAndRender(true);
}

function wireStepper(minusId, plusId, inputId, step, min, max, onUpdate) {
  const minus = document.getElementById(minusId);
  const plus = document.getElementById(plusId);
  const input = document.getElementById(inputId);
  if (!minus || !plus || !input) return;

  minus.addEventListener("click", () => {
    const cur = sanitizeNumber(input.value, min, min, max);
    const next = Math.max(min, Number((cur - step).toFixed(2)));
    input.value = String(next);
    onUpdate(next);
  });

  plus.addEventListener("click", () => {
    const cur = sanitizeNumber(input.value, min, min, max);
    const next = Math.min(max, Number((cur + step).toFixed(2)));
    input.value = String(next);
    onUpdate(next);
  });

  input.addEventListener("input", () => {
    onUpdate(sanitizeNumber(input.value, min, min, max));
  });
}

function syncStateToUI() {
  setPressed("#mode-tabs", "data-mode", (btn) => btn.dataset.mode === state.mode);
  const volPanel = document.getElementById("panel-volume");
  if (volPanel) volPanel.hidden = state.mode !== "volume";

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = String(val);
  };
  setVal("mag-height-input", state.heightM);
  setVal("mag-vol-input", state.volumeL);

  setPressed("#sv-group", "data-sv", (btn) => Math.abs(parseLocaleNumber(btn.dataset.sv, 3.0, 1.5, 10) - state.svBar) < 0.01);
  setPressed("#tmax-group", "data-tmax", (btn) => Math.abs(parseLocaleNumber(btn.dataset.tmax, 70, 30, 100) - state.tMaxC) < 0.01);
  setPressed("#mag-medium-group", "data-med", (btn) => btn.dataset.med === state.medium);
}

function init() {
  const paramsToggle = document.getElementById("params-toggle");
  paramsToggle?.addEventListener("click", () => {
    const box = document.getElementById("params-expander");
    const open = box.classList.toggle("is-open");
    paramsToggle.setAttribute("aria-expanded", String(open));
  });

  document.getElementById("reset-calc-btn")?.addEventListener("click", () => {
    Object.assign(state, DEFAULT_STATE);
    clearAppStorage(MAG_STATE_KEY);
    syncStateToUI();
    calculateAndRender(true);
    showToast("Standardwerte wiederhergestellt");
  });

  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => switchMode(btn.dataset.mode));
  });

  wireStepper("mag-height-minus", "mag-height-plus", "mag-height-input", 1, 0, 60, (v) => {
    state.heightM = v;
    calculateAndRender(true);
  });

  wireStepper("mag-vol-minus", "mag-vol-plus", "mag-vol-input", 20, 10, 10000, (v) => {
    state.volumeL = v;
    calculateAndRender(true);
  });

  document.querySelectorAll("#sv-group [data-sv]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.svBar = sanitizeNumber(btn.dataset.sv, 3.0, 1.5, 10);
      setPressed("#sv-group", "data-sv", (b) => b === btn);
      calculateAndRender(true);
    });
  });

  document.querySelectorAll("#tmax-group [data-tmax]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tMaxC = sanitizeNumber(btn.dataset.tmax, 70, 30, 100);
      setPressed("#tmax-group", "data-tmax", (b) => b === btn);
      calculateAndRender(true);
    });
  });

  document.querySelectorAll("#mag-medium-group [data-med]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.medium = btn.dataset.med === "glycol" ? "glycol" : "water";
      setPressed("#mag-medium-group", "data-med", (b) => b === btn);
      calculateAndRender(true);
    });
  });

  const safetyIn = document.getElementById("param-safety-input");
  const p0In = document.getElementById("param-p0min-input");
  if (safetyIn) safetyIn.value = String(magParams.safetyBar);
  if (p0In) p0In.value = String(magParams.p0MinBar);

  wireStepper("param-safety-minus", "param-safety-plus", "param-safety-input", 0.1, 0, 1.0, (v) => {
    magParams.safetyBar = v;
    saveAppParams(MAG_PARAMS_KEY, magParams);
    calculateAndRender(true);
  });
  wireStepper("param-p0min-minus", "param-p0min-plus", "param-p0min-input", 0.1, 0.5, 1.5, (v) => {
    magParams.p0MinBar = v;
    saveAppParams(MAG_PARAMS_KEY, magParams);
    calculateAndRender(true);
  });

  syncStateToUI();
  calculateAndRender(false);
}

init();
