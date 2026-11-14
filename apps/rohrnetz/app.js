/**
 * Modul: Rohrnetz-Dimensionierung & Druckverlust-Rechner (apps/rohrnetz/app.js)
 * Zweck: Berechnet Fließgeschwindigkeit (v in m/s) und spezifischen Rohrreibungsdruckverlust
 *   (R in mbar/m und Pa/m) nach Darcy-Weisbach und Colebrook-White für gängige HVAC-R-Rohre.
 * Verantwortlichkeit: Rohr-/Mediumdaten, Colebrook-Iteration, Volumenstrom- und Leistungs-Modus,
 *   Live-Ergebnis mit gemeinsamer Zahlenanimation aus shared.js.
 * Sicherheits- & Stabilitätsrelevanz: Numerische Eingabe-Validierung ohne NaN/Infinity;
 *   ausschließlich sichere DOM-Updates über textContent bzw. statische Rohrtabellen.
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

const ROHR_PARAMS_KEY = "hvacr-params-rohrnetz";
const rohrParams = loadAppParams(ROHR_PARAMS_KEY, {
  vOptMax: 0.8,
  fittingPct: 0,
});

// Rohrmaterialien mit absoluter Wandrauhigkeit k [mm] und gängigen Nennweiten (Innendurchmesser di [mm])
const PIPE_MATERIALS = {
  copper: {
    label: "Kupfer",
    roughnessMm: 0.0015,
    sizes: [
      { id: "cu12", label: "12×1", diMm: 10.0 },
      { id: "cu15", label: "15×1", diMm: 13.0 },
      { id: "cu18", label: "18×1", diMm: 16.0 },
      { id: "cu22", label: "22×1", diMm: 20.0 },
      { id: "cu28", label: "28×1,5", diMm: 25.0 },
      { id: "cu35", label: "35×1,5", diMm: 32.0 },
      { id: "cu42", label: "42×1,5", diMm: 39.0 },
      { id: "cu54", label: "54×2", diMm: 50.0 },
    ],
  },
  pex: {
    label: "Verbund",
    roughnessMm: 0.007,
    sizes: [
      { id: "pex16", label: "16×2", diMm: 12.0 },
      { id: "pex20", label: "20×2", diMm: 16.0 },
      { id: "pex26", label: "26×3", diMm: 20.0 },
      { id: "pex32", label: "32×3", diMm: 26.0 },
      { id: "pex40", label: "40×3,5", diMm: 33.0 },
      { id: "pex50", label: "50×4", diMm: 42.0 },
      { id: "pex63", label: "63×4,5", diMm: 54.0 },
    ],
  },
  steel_press: {
    label: "C-Stahl",
    roughnessMm: 0.015,
    sizes: [
      { id: "st15", label: "15×1,2", diMm: 12.6 },
      { id: "st18", label: "18×1,2", diMm: 15.6 },
      { id: "st22", label: "22×1,2", diMm: 19.6 },
      { id: "st28", label: "28×1,5", diMm: 25.0 },
      { id: "st35", label: "35×1,5", diMm: 32.0 },
      { id: "st42", label: "42×1,5", diMm: 39.0 },
      { id: "st54", label: "54×1,5", diMm: 51.0 },
    ],
  },
  steel_thread: {
    label: "Gewinde",
    roughnessMm: 0.15,
    sizes: [
      { id: "dn15", label: "DN 15", diMm: 16.1 },
      { id: "dn20", label: "DN 20", diMm: 21.7 },
      { id: "dn25", label: "DN 25", diMm: 27.3 },
      { id: "dn32", label: "DN 32", diMm: 36.0 },
      { id: "dn40", label: "DN 40", diMm: 41.9 },
      { id: "dn50", label: "DN 50", diMm: 53.1 },
    ],
  },
};

// Stoffwerte: Dichte rho [kg/m³], kinematische Viskosität nu [m²/s], spez. Wärmekapazität cp [kJ/(kg·K)]
const FLUIDS = {
  water_50: { label: "Heizung 50 °C", rho: 988.1, nu: 0.553e-6, cp: 4.181 },
  water_35: { label: "WP 35 °C", rho: 994.0, nu: 0.724e-6, cp: 4.178 },
  water_10: { label: "Kalt 10 °C", rho: 999.7, nu: 1.307e-6, cp: 4.192 },
  glycol_30: { label: "Glykol 30 %", rho: 1038.0, nu: 2.35e-6, cp: 3.75 },
};

const FLOW_UNIT_CONFIG = {
  m3h: { label: "m³/h", factorToM3h: 1, step: 0.1, decimals: 2 },
  lh: { label: "l/h", factorToM3h: 0.001, step: 100, decimals: 0 },
  lmin: { label: "l/min", factorToM3h: 0.06, step: 2, decimals: 1 },
};

const state = {
  view: "calc",
  mode: "flow",
  material: "copper",
  sizeId: "cu28",
  fluid: "water_50",
  flowUnit: "m3h",
  flowM3h: 1.5,
  powerKw: 15,
  dtK: 10,
};

function sanitizeNumber(raw, fallback, min = 0, max = 100000) {
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

function formatInputVal(value, decimals = 2) {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(decimals)).toString();
}

const resultNumberAnimator = createNumberAnimator({
  duration: 220,
  epsilon: 0.005,
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

/**
 * Berechnet den Rohrreibungsbeiwert lambda (laminar: 64/Re, turbulent: Colebrook-White).
 */
function calcFrictionFactor(re, relRoughness) {
  if (re <= 0) return 0;
  if (re < 2300) return 64 / re;

  // Startwert nach Haaland für schnelle Konvergenz
  const term = Math.pow(relRoughness / 3.7, 1.11) + 6.9 / re;
  let lambda = Math.pow(-1.8 * Math.log10(term), -2);

  for (let i = 0; i < 6; i += 1) {
    const invSqrt = -2 * Math.log10(relRoughness / 3.7 + 2.51 / (re * Math.sqrt(lambda)));
    lambda = 1 / (invSqrt * invSqrt);
  }
  return lambda;
}

function getActivePipeSpec() {
  const mat = PIPE_MATERIALS[state.material] || PIPE_MATERIALS.copper;
  const size = mat.sizes.find((s) => s.id === state.sizeId) || mat.sizes[0];
  return { mat, size };
}

function renderSizeChips() {
  const container = document.getElementById("size-group");
  if (!container) return;
  const { mat, size } = getActivePipeSpec();

  container.innerHTML = mat.sizes
    .map(
      (s) =>
        `<button type="button" class="chip-btn press-btn" data-size-id="${s.id}" aria-pressed="${String(
          s.id === size.id
        )}">${s.label}</button>`
    )
    .join("");

  container.querySelectorAll("[data-size-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.sizeId = btn.dataset.sizeId;
      renderSizeChips();
      calculateAndRender();
    });
  });

  const roughHint = document.getElementById("pipe-roughness-hint");
  const diHint = document.getElementById("pipe-di-hint");
  if (roughHint) roughHint.textContent = `k = ${formatDe(mat.roughnessMm, mat.roughnessMm < 0.01 ? 4 : 2)} mm`;
  if (diHint) diHint.textContent = `dᵢ = ${formatDe(size.diMm, 1)} mm`;
}

function calculateAndRender(animate = true) {
  const { mat, size } = getActivePipeSpec();
  const fluid = FLUIDS[state.fluid] || FLUIDS.water_50;

  let flowM3h = state.flowM3h;
  if (state.mode === "power") {
    const denom = fluid.rho * fluid.cp * state.dtK;
    flowM3h = denom > 0 ? (state.powerKw * 3600) / denom : 0;
  }

  const diM = size.diMm / 1000;
  const areaM2 = (Math.PI * diM * diM) / 4;
  const flowM3s = flowM3h / 3600;
  const velocity = areaM2 > 0 ? flowM3s / areaM2 : 0;

  const re = (velocity * diM) / fluid.nu;
  const relRoughness = mat.roughnessMm / size.diMm;
  const lambda = calcFrictionFactor(re, relRoughness);

  // Druckverlust R [Pa/m] = lambda * (1 / d_i) * (rho / 2) * v² (inkl. Formteil-Zuschlag)
  const rBasePaM = diM > 0 && velocity > 0 ? (lambda / diM) * (fluid.rho / 2) * velocity * velocity : 0;
  const rPaM = rBasePaM * (1 + rohrParams.fittingPct / 100);
  const rMbarM = rPaM / 100;
  const flowLh = flowM3h * 1000;

  let badgeText = "Optimal";
  let badgeState = "ok";
  if (velocity <= 0) {
    badgeText = "Kein Durchfluss";
    badgeState = "warn";
  } else if (velocity < 0.2) {
    badgeText = "Sehr langsam (< 0,2 m/s)";
    badgeState = "warn";
  } else if (velocity <= rohrParams.vOptMax) {
    badgeText = "Optimal (leise)";
    badgeState = "ok";
  } else if (velocity <= 1.2) {
    badgeText = "Grenzwertig (Rauschgefahr)";
    badgeState = "warn";
  } else {
    badgeText = "Zu schnell (> 1,2 m/s)";
    badgeState = "bad";
  }

  resultNumberAnimator.update(velocity, state.mode, animate);

  const subEl = document.getElementById("result-sub");
  const badgeEl = document.getElementById("result-badge");
  const meterEl = document.getElementById("result-meter-fill");

  if (subEl) {
    subEl.textContent = `R = ${formatDe(rMbarM, 2)} mbar/m (${formatDe(rPaM, 0)} Pa/m) · ${formatDe(
      flowLh,
      0
    )} l/h · dᵢ ${formatDe(size.diMm, 1)} mm`;
  }
  if (badgeEl) {
    badgeEl.textContent = badgeText;
    badgeEl.setAttribute("data-state", badgeState);
  }
  if (meterEl) {
    const pct = Math.min(100, Math.max(6, (velocity / 1.5) * 100));
    meterEl.style.width = `${pct}%`;
    meterEl.setAttribute("data-state", badgeState);
  }

  triggerResultPop();
}

function renderSettingsTheme() {
  const mode = getCurrentThemeMode();
  const group = document.getElementById("theme-mode-group");
  if (!group) return;
  group.querySelectorAll("[data-theme-mode]").forEach((btn) => {
    btn.setAttribute("aria-checked", String(btn.getAttribute("data-theme-mode") === mode));
  });
}

function openSettings() {
  state.view = "settings";
  document.getElementById("view-calc").hidden = true;
  const settingsView = document.getElementById("view-settings");
  settingsView.hidden = false;
  settingsView.classList.remove("is-entering");
  void settingsView.offsetWidth;
  settingsView.classList.add("is-entering");
  document.getElementById("nav-home-link").hidden = true;
  document.getElementById("nav-back-btn").hidden = false;
  document.getElementById("brand-title").textContent = "Einstellungen";
  renderSettingsTheme();
}

function openCalc() {
  state.view = "calc";
  document.getElementById("view-settings").hidden = true;
  const calcView = document.getElementById("view-calc");
  calcView.hidden = false;
  calcView.classList.remove("is-entering");
  void calcView.offsetWidth;
  calcView.classList.add("is-entering");
  document.getElementById("nav-back-btn").hidden = true;
  document.getElementById("nav-home-link").hidden = false;
  document.getElementById("brand-title").textContent = "Rohrnetz";
  updateAllPills();
}

function switchMode(newMode) {
  if (newMode !== "flow" && newMode !== "power") return;
  state.mode = newMode;

  document.querySelectorAll("#mode-tabs [data-mode]").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.mode === newMode));
  });

  ["flow", "power"].forEach((m) => {
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

function switchFlowUnit(newUnit) {
  if (!FLOW_UNIT_CONFIG[newUnit]) return;
  state.flowUnit = newUnit;
  const cfg = FLOW_UNIT_CONFIG[newUnit];

  document.querySelectorAll("#flow-unit-tabs [data-flow-unit]").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.flowUnit === newUnit));
  });

  const input = document.getElementById("flow-input");
  const label = document.getElementById("flow-unit-label");
  if (input) input.value = formatInputVal(state.flowM3h / cfg.factorToM3h, cfg.decimals);
  if (label) label.textContent = cfg.label;

  updateAllPills();
  calculateAndRender(true);
}

function wireStepper(minusId, plusId, inputId, getStep, onUpdate) {
  const minus = document.getElementById(minusId);
  const plus = document.getElementById(plusId);
  const input = document.getElementById(inputId);
  if (!minus || !plus || !input) return;

  minus.addEventListener("click", () => {
    const step = getStep();
    const current = sanitizeNumber(input.value, 0, -100000, 100000);
    const minVal = input.min !== "" ? Number(input.min) : -Infinity;
    const next = Math.max(minVal, Number((current - step).toFixed(4)));
    input.value = String(next);
    onUpdate(next);
  });

  plus.addEventListener("click", () => {
    const step = getStep();
    const current = sanitizeNumber(input.value, 0, -100000, 100000);
    const maxVal = input.max !== "" ? Number(input.max) : Infinity;
    const next = Math.min(maxVal, Number((current + step).toFixed(4)));
    input.value = String(next);
    onUpdate(next);
  });

  input.addEventListener("input", () => {
    const minVal = input.min !== "" ? Number(input.min) : 0;
    const maxVal = input.max !== "" ? Number(input.max) : 100000;
    onUpdate(sanitizeNumber(input.value, minVal, minVal, maxVal));
  });
}

function syncDtPresetChips() {
  document.querySelectorAll("#dt-preset-group [data-dt]").forEach((btn) => {
    const val = Number.parseFloat(btn.dataset.dt || "");
    btn.setAttribute("aria-pressed", String(Math.abs(val - state.dtK) < 0.001));
  });
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

  document.querySelectorAll("#flow-unit-tabs [data-flow-unit]").forEach((btn) => {
    btn.addEventListener("click", () => switchFlowUnit(btn.dataset.flowUnit));
  });

  document.querySelectorAll("#material-group [data-material]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextMat = btn.dataset.material;
      if (!PIPE_MATERIALS[nextMat]) return;
      state.material = nextMat;
      // Passende Standard-Nennweite je Material wählen (~DN 25)
      state.sizeId = PIPE_MATERIALS[nextMat].sizes[Math.min(3, PIPE_MATERIALS[nextMat].sizes.length - 1)].id;
      document.querySelectorAll("#material-group [data-material]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.material === nextMat));
      });
      renderSizeChips();
      calculateAndRender(true);
    });
  });

  document.querySelectorAll("#medium-group [data-fluid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextFluid = btn.dataset.fluid;
      if (!FLUIDS[nextFluid]) return;
      state.fluid = nextFluid;
      document.querySelectorAll("#medium-group [data-fluid]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.fluid === nextFluid));
      });
      calculateAndRender(true);
    });
  });

  wireStepper(
    "flow-minus",
    "flow-plus",
    "flow-input",
    () => FLOW_UNIT_CONFIG[state.flowUnit].step,
    (val) => {
      state.flowM3h = val * FLOW_UNIT_CONFIG[state.flowUnit].factorToM3h;
      calculateAndRender(true);
    }
  );

  wireStepper(
    "power-minus",
    "power-plus",
    "power-input",
    () => 0.5,
    (val) => {
      state.powerKw = val;
      calculateAndRender(true);
    }
  );

  wireStepper(
    "dt-minus",
    "dt-plus",
    "dt-input",
    () => 0.5,
    (val) => {
      state.dtK = Math.max(0.1, val);
      syncDtPresetChips();
      calculateAndRender(true);
    }
  );

  document.querySelectorAll("#dt-preset-group [data-dt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dtVal = sanitizeNumber(btn.dataset.dt, 10, 0.1, 100);
      state.dtK = dtVal;
      const dtInput = document.getElementById("dt-input");
      if (dtInput) dtInput.value = formatInputVal(dtVal, 1);
      syncDtPresetChips();
      calculateAndRender(true);
    });
  });

  const voptIn = document.getElementById("param-vopt-input");
  const fitIn = document.getElementById("param-fitting-input");
  if (voptIn) voptIn.value = String(rohrParams.vOptMax);
  if (fitIn) fitIn.value = String(rohrParams.fittingPct);

  wireStepper(
    "param-vopt-minus",
    "param-vopt-plus",
    "param-vopt-input",
    () => 0.1,
    (val) => {
      rohrParams.vOptMax = Math.min(1.5, Math.max(0.3, val));
      saveAppParams(ROHR_PARAMS_KEY, rohrParams);
      calculateAndRender(true);
    }
  );

  wireStepper(
    "param-fitting-minus",
    "param-fitting-plus",
    "param-fitting-input",
    () => 5,
    (val) => {
      rohrParams.fittingPct = Math.min(100, Math.max(0, val));
      saveAppParams(ROHR_PARAMS_KEY, rohrParams);
      calculateAndRender(true);
    }
  );

  window.addEventListener("resize", updateAllPills);
  renderSizeChips();
  updateAllPills();
  calculateAndRender(false);
}

init();
