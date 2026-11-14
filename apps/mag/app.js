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
  applyThemeMode,
  createNumberAnimator,
  getCurrentThemeMode,
  prefersReducedMotion,
  updateAllPills,
} from "../../assets/js/shared.js";

const STANDARD_MAG_SIZES = [8, 12, 18, 25, 35, 50, 80, 100, 140, 200, 250, 300, 400, 500, 600, 800, 1000];

// Volumenausdehnung n [%] bezogen auf Kaltwasser 10 °C
const EXPANSION_WATER = { 40: 0.78, 55: 1.45, 70: 2.27, 85: 3.24 };
const EXPANSION_GLYCOL30 = { 40: 1.35, 55: 2.2, 70: 3.15, 85: 4.25 };

const state = {
  mode: "pressure", // 'pressure' | 'volume'
  heightM: 9,
  svBar: 3.0,
  volumeL: 250,
  tMaxC: 70,
  medium: "water",
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

let activeDecimals = 2;

const resultNumberAnimator = createNumberAnimator({
  duration: 220,
  epsilon: 0.01,
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
  // p0 = statische Höhe [bar] + 0,3 bar Dampfdruck-/Entlüftungsreserve (mind. 0,8 bar)
  const pStat = state.heightM / 10;
  const p0 = Math.max(0.8, Number((pStat + 0.3).toFixed(2)));
  const pa = Number((p0 + 0.3).toFixed(2));
  const pe = state.svBar <= 3.0 ? Number((state.svBar - 0.5).toFixed(2)) : Number((state.svBar * 0.9).toFixed(2));

  const labelEl = document.getElementById("result-label");
  const unitEl = document.getElementById("result-unit");
  const subEl = document.getElementById("result-sub");
  const badgeEl = document.getElementById("result-badge");
  const meterEl = document.getElementById("result-meter-fill");

  let numericValue = p0;
  let label = "Stickstoff-Vordruck p₀";
  let unit = "bar";
  let badgeText = "EN 12828";
  let badgeState = "ok";
  let meterPct = (p0 / pe) * 100;
  let sub = `Fülldruck kalt pₐ = ${formatDe(pa, 2)} bar · Enddruck pₑ = ${formatDe(pe, 2)} bar`;

  if (pa >= pe) {
    badgeText = "SV-Druck zu niedrig!";
    badgeState = "bad";
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
      badgeText = "Druckdifferenz zu klein!";
      badgeState = "bad";
      sub = "Sicherheitsventil größer wählen oder statische Höhe prüfen";
      meterPct = 100;
    } else {
      // Vn = (Ve + Vv) * (pe + 1) / (pe - p0)
      const vn = ((ve + vv) * (pe + 1)) / (pe - p0);
      const nextStd = STANDARD_MAG_SIZES.find((s) => s >= vn) || STANDARD_MAG_SIZES[STANDARD_MAG_SIZES.length - 1];
      numericValue = vn;
      badgeText = `Empfehlung: ${nextStd} l MAG`;
      badgeState = "ok";
      sub = `Ausdehnung Vₑ = ${formatDe(ve, 1)} l · p₀ = ${formatDe(p0, 2)} bar · pₑ = ${formatDe(pe, 2)} bar`;
      meterPct = Math.min(100, Math.max(8, (vn / 300) * 100));
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
  if (newMode !== "pressure" && newMode !== "volume") return;
  state.mode = newMode;
  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.mode === newMode));
  });
  const volPanel = document.getElementById("panel-volume");
  if (volPanel) {
    volPanel.hidden = newMode !== "volume";
    if (newMode === "volume") {
      volPanel.classList.remove("is-entering");
      void volPanel.offsetWidth;
      volPanel.classList.add("is-entering");
    }
  }
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
  document.getElementById("brand-title").textContent = "MAG & Vordruck";
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
      document.querySelectorAll("#sv-group [data-sv]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      calculateAndRender(true);
    });
  });

  document.querySelectorAll("#tmax-group [data-tmax]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tMaxC = sanitizeNumber(btn.dataset.tmax, 70, 30, 100);
      document.querySelectorAll("#tmax-group [data-tmax]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      calculateAndRender(true);
    });
  });

  document.querySelectorAll("#mag-medium-group [data-med]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.medium = btn.dataset.med === "glycol" ? "glycol" : "water";
      document.querySelectorAll("#mag-medium-group [data-med]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      calculateAndRender(true);
    });
  });

  window.addEventListener("resize", updateAllPills);
  updateAllPills();
  calculateAndRender(false);
}

init();
