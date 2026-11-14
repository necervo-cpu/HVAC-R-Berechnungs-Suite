/**
 * Modul: Kältemittel Druck-Temperatur & SH/SC-Rechner (apps/kaeltemittel/app.js)
 * Zweck: Berechnet Sättigungstemperatur, Sättigungsdruck sowie Überhitzung (SH) und
 *   Unterkühlung (SC) für gängige HVAC-R-Kältemittel anhand der Antoine-Dampfdruckgleichung.
 * Verantwortlichkeit: Kältemittel-Koeffizienten, Druckbezug (bar ü / bar abs),
 *   Plausibilitäts- und SH/SC-Bewertung sowie Live-Ergebnis mit Zahlenanimation.
 * Sicherheits- & Stabilitätsrelevanz: Eingabe-Clamping gegen negative Absolutdrücke
 *   und Schutz vor NaN/Infinity bei Logarithmen.
 */

import {
  applyThemeMode,
  createNumberAnimator,
  getCurrentThemeMode,
  prefersReducedMotion,
  updateAllPills,
} from "../../assets/js/shared.js";

const ATM_BAR = 1.01325;

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

const state = {
  view: "calc",
  mode: "p2t",
  refrigerant: "R32",
  pressureRef: "gauge", // 'gauge' | 'abs'
  shscType: "sh", // 'sh' | 'sc'
  p2tValue: 7.1,
  t2pValue: 0,
  shscPressure: 7.1,
  shscTemp: 6.5,
};

function sanitizeNumber(raw, fallback, min = -100, max = 200) {
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

function toAbsBar(inputBar) {
  const pAbs = state.pressureRef === "gauge" ? inputBar + ATM_BAR : inputBar;
  return Math.max(0.05, pAbs);
}

function fromAbsBar(pAbs) {
  return state.pressureRef === "gauge" ? pAbs - ATM_BAR : pAbs;
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
  const spec = REFRIGERANTS[state.refrigerant] || REFRIGERANTS.R32;
  const labelEl = document.getElementById("result-label");
  const unitEl = document.getElementById("result-unit");
  const subEl = document.getElementById("result-sub");
  const badgeEl = document.getElementById("result-badge");
  const meterEl = document.getElementById("result-meter-fill");

  let numericValue = 0;
  let unit = "°C";
  let label = "Sättigungstemperatur";
  let sub = "";
  let badgeText = "Plausibel";
  let badgeState = "ok";
  let meterPct = 50;

  if (state.mode === "p2t") {
    const pAbs = toAbsBar(state.p2tValue);
    const satT = calcSatTempC(state.refrigerant, pAbs);
    activeDecimals = 1;
    numericValue = satT;
    unit = "°C";
    label = "Sättigungstemperatur";
    sub = `${spec.label} · p_abs = ${formatDe(pAbs, 2)} bar · p_ü = ${formatDe(pAbs - ATM_BAR, 2)} bar`;
    meterPct = ((satT + 40) / 110) * 100;

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
    unit = state.pressureRef === "gauge" ? "bar ü" : "bar";
    label = "Sättigungsdruck";
    sub = `${spec.label} · p_abs = ${formatDe(pAbs, 2)} bar · ${formatDe(state.t2pValue, 1)} °C`;
    meterPct = (pAbs / 45) * 100;

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
    sub = `${spec.label} · T_satt = ${formatDe(satT, 1)} °C · T_rohr = ${formatDe(state.shscTemp, 1)} °C`;
    meterPct = (Math.max(0, diff) / 16) * 100;

    if (diff < 0) {
      badgeText = state.shscType === "sh" ? "Nassdampf / Flüssigkeit!" : "Keine Unterkühlung!";
      badgeState = "bad";
    } else if (diff < 3) {
      badgeText = state.shscType === "sh" ? "Zu gering (Flüssigkeitsschlag)" : "Sehr gering (Dampfblasen)";
      badgeState = "warn";
    } else if (diff <= 8) {
      badgeText = "Optimal (5–8 K Ziel)";
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
  if (subEl) subEl.textContent = sub;
  if (badgeEl) {
    badgeEl.textContent = badgeText;
    badgeEl.setAttribute("data-state", badgeState);
  }
  if (meterEl) {
    meterEl.style.width = `${Math.min(100, Math.max(6, meterPct))}%`;
    meterEl.setAttribute("data-state", badgeState);
  }

  resultNumberAnimator.update(numericValue, `${state.mode}:${state.shscType}`, animate);
  triggerResultPop();
}

function syncPressureUnitLabels() {
  const unitText = state.pressureRef === "gauge" ? "bar ü" : "bar";
  const p2tUnit = document.getElementById("p2t-unit-label");
  const shscUnit = document.getElementById("shsc-p-unit");
  if (p2tUnit) p2tUnit.textContent = unitText;
  if (shscUnit) shscUnit.textContent = unitText;
}

function switchMode(newMode) {
  if (!["p2t", "t2p", "shsc"].includes(newMode)) return;
  state.mode = newMode;
  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.mode === newMode));
  });
  ["p2t", "t2p", "shsc"].forEach((m) => {
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
  document.getElementById("brand-title").textContent = "Kältemittel";
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

  document.querySelectorAll("#refrigerant-group [data-ref]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ref = btn.dataset.ref;
      if (!REFRIGERANTS[ref]) return;
      state.refrigerant = ref;
      document.querySelectorAll("#refrigerant-group [data-ref]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.ref === ref));
      });
      const hint = document.getElementById("ref-meta-hint");
      if (hint) hint.textContent = REFRIGERANTS[ref].meta;
      calculateAndRender(true);
    });
  });

  document.querySelectorAll("#pressure-ref-tabs [data-pref]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pref = btn.dataset.pref;
      if (pref !== "gauge" && pref !== "abs") return;
      state.pressureRef = pref;
      document.querySelectorAll("#pressure-ref-tabs [data-pref]").forEach((b) => {
        b.setAttribute("aria-selected", String(b.dataset.pref === pref));
      });
      syncPressureUnitLabels();
      updateAllPills();
      calculateAndRender(true);
    });
  });

  document.querySelectorAll("#shsc-type-tabs [data-shsc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.shsc;
      if (t !== "sh" && t !== "sc") return;
      state.shscType = t;
      document.querySelectorAll("#shsc-type-tabs [data-shsc]").forEach((b) => {
        b.setAttribute("aria-selected", String(b.dataset.shsc === t));
      });
      const tLabel = document.getElementById("shsc-t-label");
      if (tLabel) tLabel.textContent = t === "sh" ? "Sauggas-Temp" : "Flüssig-Temp";
      updateAllPills();
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

  window.addEventListener("resize", updateAllPills);
  syncPressureUnitLabels();
  updateAllPills();
  calculateAndRender(false);
}

init();
