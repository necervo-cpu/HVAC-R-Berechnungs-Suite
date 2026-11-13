/**
 * Modul: PTC / NTC Sensor-Rechner (apps/sensor/app.js)
 * Zweck: Vollständig isolierte Berechnungslogik und UI-Steuerung für die Umrechnung
 *   zwischen Widerstand (Ohm) und Temperatur (°C) gängiger HVAC-R-Sensoren.
 * Verantwortlichkeit: B-Parameter-Gleichung (NTC), Callendar-Van-Dusen / DIN EN 60751
 *   (PT100/PT1000), Silizium-Polynom (KTY81-210), Plausibilitätsprüfung, rAF-Zähl-Animation
 *   und Event-Listener dieser Einzel-App.
 * Sicherheits- & Stabilitätsrelevanz: Eingabe-Clamping und Schutz vor Division durch Null / NaN.
 */

import {
  prefersReducedMotion,
  updateAllPills,
  updateSegmentedPill,
} from "../../assets/js/shared.js";

const NTC_SENSORS = {
  ntc2k: { id: "ntc2k", label: "2k", fullLabel: "NTC 2 kΩ", r25: 2000, b: 3435, note: "z. B. Danfoss EKS" },
  ntc5k: { id: "ntc5k", label: "5k", fullLabel: "NTC 5 kΩ", r25: 5000, b: 3977, note: "Standard-Fühler" },
  ntc10k_3435: { id: "ntc10k_3435", label: "10k · 3435", fullLabel: "NTC 10 kΩ (B=3435)", r25: 10000, b: 3435, note: "z. B. Carel / Kälteregler" },
  ntc10k_3977: { id: "ntc10k_3977", label: "10k · 3977", fullLabel: "NTC 10 kΩ (B=3977)", r25: 10000, b: 3977, note: "Standard-NTC" },
  ntc12k: { id: "ntc12k", label: "12k", fullLabel: "NTC 12 kΩ", r25: 12000, b: 3977, note: "Split / Wärmepumpe" },
  ntc20k: { id: "ntc20k", label: "20k", fullLabel: "NTC 20 kΩ", r25: 20000, b: 3977, note: "z. B. Honeywell / Siemens" },
  ntc_custom: { id: "ntc_custom", label: "Eigen", fullLabel: "Eigener NTC", r25: 10000, b: 3950, note: "Freier R₂₅ & B-Wert" },
};

const PTC_SENSORS = {
  pt100: { id: "pt100", label: "PT100", fullLabel: "PT100 (DIN EN 60751)", r0: 100, note: "R₀ = 100,0 Ω" },
  pt1000: { id: "pt1000", label: "PT1000", fullLabel: "PT1000 (DIN EN 60751)", r0: 1000, note: "R₀ = 1000,0 Ω" },
  kty81_210: { id: "kty81_210", label: "KTY81-210", fullLabel: "KTY81-210 (2 kΩ)", r25: 2000, note: "R₂₅ = 2000 Ω" },
};

const T25_K = 298.15;
const T0_K = 273.15;

// Callendar-Van-Dusen Konstanten (DIN EN 60751)
const CVD_A = 3.9083e-3;
const CVD_B = -5.775e-7;
const CVD_C = -4.183e-12;

// KTY81-210 Silizium-Polynom um 25 °C
const KTY_A = 7.874e-3;
const KTY_B = 1.874e-5;

const state = {
  family: "ntc",
  sensorId: "ntc10k_3435",
  direction: "ohmToTemp",
  inputValue: 10000,
  customR25: 10000,
  customB: 3950,
};

let countRafId = null;
let lastDisplayedValue = null;
let lastDisplayedDirection = null;

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function formatDE(num, decimals = 1) {
  return num.toFixed(decimals).replace(".", ",");
}

function formatOhm(ohm) {
  if (!Number.isFinite(ohm) || ohm < 0) return { num: "—", unit: "Ω" };
  if (ohm >= 10000) {
    return { num: (ohm / 1000).toFixed(2).replace(".", ","), unit: "kΩ" };
  }
  if (ohm >= 1000) {
    return { num: ohm.toFixed(1).replace(".", ","), unit: "Ω" };
  }
  return { num: ohm.toFixed(2).replace(".", ","), unit: "Ω" };
}

function ntcTempToOhm(tempC, r25, b) {
  const tK = tempC + T0_K;
  return r25 * Math.exp(b * (1 / tK - 1 / T25_K));
}

function ntcOhmToTemp(ohm, r25, b) {
  const safeOhm = Math.max(0.1, ohm);
  const invT = 1 / T25_K + Math.log(safeOhm / r25) / b;
  return 1 / invT - T0_K;
}

function ptTempToOhm(tempC, r0) {
  if (tempC >= 0) {
    return r0 * (1 + CVD_A * tempC + CVD_B * tempC * tempC);
  }
  return r0 * (1 + CVD_A * tempC + CVD_B * tempC * tempC + CVD_C * (tempC - 100) * Math.pow(tempC, 3));
}

function ptOhmToTemp(ohm, r0) {
  const ratio = ohm / r0;
  if (ratio >= 1) {
    const disc = CVD_A * CVD_A - 4 * CVD_B * (1 - ratio);
    return (-CVD_A + Math.sqrt(Math.max(0, disc))) / (2 * CVD_B);
  }
  let t = (ratio - 1) / CVD_A;
  for (let i = 0; i < 10; i += 1) {
    const f = 1 + CVD_A * t + CVD_B * t * t + CVD_C * (t - 100) * Math.pow(t, 3) - ratio;
    const df = CVD_A + 2 * CVD_B * t + CVD_C * (4 * Math.pow(t, 3) - 300 * t * t);
    if (Math.abs(df) < 1e-12) break;
    t -= f / df;
  }
  return t;
}

function ktyTempToOhm(tempC) {
  const dt = tempC - 25;
  return 2000 * (1 + KTY_A * dt + KTY_B * dt * dt);
}

function ktyOhmToTemp(ohm) {
  const ratio = ohm / 2000;
  const disc = KTY_A * KTY_A - 4 * KTY_B * (1 - ratio);
  if (disc < 0) return -60;
  const dt = (-KTY_A + Math.sqrt(disc)) / (2 * KTY_B);
  return 25 + dt;
}

function calculateSensorConversion({
  family,
  sensorId,
  direction,
  inputValue,
  customR25 = 10000,
  customB = 3950,
}) {
  const isNtc = family === "ntc";
  const r25 = clampNumber(customR25, 100, 500000, 10000);
  const bVal = clampNumber(customB, 1500, 6500, 3950);

  let tempC = 25;
  let ohm = 10000;
  let sensorName = "";
  let sensorMeta = "";

  const convertTtoR = (t) => {
    if (isNtc) {
      const spec = NTC_SENSORS[sensorId] || NTC_SENSORS.ntc10k_3435;
      const useR25 = sensorId === "ntc_custom" ? r25 : spec.r25;
      const useB = sensorId === "ntc_custom" ? bVal : spec.b;
      return ntcTempToOhm(t, useR25, useB);
    }
    if (sensorId === "pt100") return ptTempToOhm(t, 100);
    if (sensorId === "pt1000") return ptTempToOhm(t, 1000);
    return ktyTempToOhm(t);
  };

  if (isNtc) {
    const spec = NTC_SENSORS[sensorId] || NTC_SENSORS.ntc10k_3435;
    const useR25 = sensorId === "ntc_custom" ? r25 : spec.r25;
    const useB = sensorId === "ntc_custom" ? bVal : spec.b;
    sensorName = spec.fullLabel;
    sensorMeta = `R₂₅ = ${useR25.toLocaleString("de-DE")} Ω · B = ${useB} K`;

    if (direction === "ohmToTemp") {
      ohm = clampNumber(inputValue, 0.1, 2000000, useR25);
      tempC = ntcOhmToTemp(ohm, useR25, useB);
    } else {
      tempC = clampNumber(inputValue, -60, 180, 25);
      ohm = ntcTempToOhm(tempC, useR25, useB);
    }
  } else {
    const spec = PTC_SENSORS[sensorId] || PTC_SENSORS.pt1000;
    sensorName = spec.fullLabel;
    sensorMeta = spec.note;

    if (direction === "ohmToTemp") {
      ohm = clampNumber(inputValue, 1, 50000, sensorId === "pt100" ? 100 : 1000);
      if (sensorId === "pt100") tempC = ptOhmToTemp(ohm, 100);
      else if (sensorId === "pt1000") tempC = ptOhmToTemp(ohm, 1000);
      else tempC = ktyOhmToTemp(ohm);
    } else {
      tempC = clampNumber(inputValue, -100, 300, 25);
      ohm = convertTtoR(tempC);
    }
  }

  let statusState = "ok";
  let statusText = "Plausibel · Arbeitsbereich";

  if (direction === "ohmToTemp" && inputValue <= 1) {
    statusState = "bad";
    statusText = "Kurzschluss-Verdacht (≤ 1 Ω)";
  } else if (isNtc && ohm > 500000) {
    statusState = "bad";
    statusText = "Fühlerbruch-Verdacht (> 500 kΩ)";
  } else if (tempC < -50 || tempC > 150) {
    statusState = "warn";
    statusText = "Außerhalb Standard-Bereich (−50…+150 °C)";
  }

  const refPoints = [0, 20, 25, 50].map((t) => ({
    tempC: t,
    formattedOhm: formatOhm(convertTtoR(t)),
  }));

  return {
    tempC,
    ohm,
    formattedOhm: formatOhm(ohm),
    sensorName,
    sensorMeta,
    statusState,
    statusText,
    refPoints,
  };
}

function animateResultNumber(element, targetVal, direction, animate) {
  if (!element) return;

  const renderExact = (val) => {
    if (direction === "ohmToTemp") {
      element.innerHTML = `${formatDE(val, 1)}<span class="result-unit">°C</span>`;
    } else {
      const f = formatOhm(val);
      element.innerHTML = `${f.num}<span class="result-unit">${f.unit}</span>`;
    }
  };

  if (countRafId !== null) {
    window.cancelAnimationFrame(countRafId);
    countRafId = null;
  }

  if (
    !animate ||
    prefersReducedMotion() ||
    lastDisplayedValue === null ||
    lastDisplayedDirection !== direction ||
    Math.abs(targetVal - lastDisplayedValue) < 0.01
  ) {
    lastDisplayedValue = targetVal;
    lastDisplayedDirection = direction;
    renderExact(targetVal);
    return;
  }

  const startVal = lastDisplayedValue;
  const startTime = performance.now();
  const duration = 220;

  const tick = (now) => {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = startVal + (targetVal - startVal) * eased;
    lastDisplayedValue = current;
    renderExact(current);

    if (t < 1) {
      countRafId = window.requestAnimationFrame(tick);
    } else {
      lastDisplayedValue = targetVal;
      lastDisplayedDirection = direction;
      renderExact(targetVal);
      countRafId = null;
    }
  };

  countRafId = window.requestAnimationFrame(tick);
}

function getStepDelta() {
  if (state.direction === "tempToOhm") return 1.0;
  if (state.family === "ptc") {
    return state.sensorId === "pt100" ? 5 : 25;
  }
  return 100;
}

function getDefaultOhmForSensor(family, sensorId) {
  if (family === "ptc") {
    if (sensorId === "pt100") return 109.73;
    if (sensorId === "pt1000") return 1097.3;
    return 2000;
  }
  const spec = NTC_SENSORS[sensorId] || NTC_SENSORS.ntc10k_3435;
  return sensorId === "ntc_custom" ? state.customR25 : spec.r25;
}

function renderSensorSelect() {
  const select = document.getElementById("sensor-select");
  const selectLabel = document.getElementById("sensor-select-label");
  if (!select) return;

  const map = state.family === "ntc" ? NTC_SENSORS : PTC_SENSORS;
  select.innerHTML = Object.values(map)
    .map((s) => `<option value="${s.id}">${s.fullLabel}</option>`)
    .join("");
  select.value = state.sensorId;

  const activeSpec = map[state.sensorId];
  if (selectLabel && activeSpec) {
    selectLabel.textContent = activeSpec.fullLabel;
  }
}

function renderSensorResult(animate = true) {
  const customPanel = document.getElementById("custom-ntc-panel");
  if (customPanel) {
    const showCustom = state.family === "ntc" && state.sensorId === "ntc_custom";
    customPanel.setAttribute("data-open", String(showCustom));
  }

  const inputEl = document.getElementById("input-sensor-val");
  if (inputEl) {
    const len = Math.max(2, String(inputEl.value).length);
    inputEl.style.width = `${len + 0.4}ch`;
  }

  const res = calculateSensorConversion(state);

  const titleEl = document.getElementById("sensor-result-title");
  const valEl = document.getElementById("sensor-result-val");
  const subEl = document.getElementById("sensor-result-sub");
  const badgeEl = document.getElementById("sensor-status-badge");
  const inputLabelEl = document.getElementById("sensor-input-label");
  const inputUnitEl = document.getElementById("sensor-input-unit");
  const stepHintEl = document.getElementById("sensor-step-hint");
  const refGridEl = document.getElementById("sensor-ref-grid");

  if (titleEl) titleEl.textContent = res.sensorName;
  if (subEl) subEl.textContent = res.sensorMeta;
  if (badgeEl) {
    badgeEl.setAttribute("data-state", res.statusState);
    badgeEl.textContent = res.statusText;
  }

  const targetNum = state.direction === "ohmToTemp" ? res.tempC : res.ohm;
  animateResultNumber(valEl, targetNum, state.direction, animate);

  const delta = getStepDelta();
  if (state.direction === "ohmToTemp") {
    if (inputLabelEl) inputLabelEl.textContent = "Gemessener Widerstand";
    if (inputUnitEl) inputUnitEl.textContent = "Ω";
    if (stepHintEl) stepHintEl.textContent = `Schritt ±${delta} Ω`;
  } else {
    if (inputLabelEl) inputLabelEl.textContent = "Soll-/Ist-Temperatur";
    if (inputUnitEl) inputUnitEl.textContent = "°C";
    if (stepHintEl) stepHintEl.textContent = `Schritt ±${delta} °C`;
  }

  if (refGridEl) {
    refGridEl.innerHTML = res.refPoints
      .map(
        (p) => `
        <div class="ref-cell">
          <span class="ref-temp">${p.tempC} °C</span>
          <span class="ref-ohm">${p.formattedOhm.num} ${p.formattedOhm.unit}</span>
        </div>
      `
      )
      .join("");
  }
}

function wireEvents() {
  const dirSeg = document.getElementById("sensor-dir-switcher");
  if (dirSeg) {
    dirSeg.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextDir = btn.dataset.dir;
        if (nextDir === state.direction) return;
        const prev = calculateSensorConversion(state);
        state.direction = nextDir;

        dirSeg.querySelectorAll(".tab-btn").forEach((b) => b.setAttribute("aria-selected", "false"));
        btn.setAttribute("aria-selected", "true");
        updateSegmentedPill(dirSeg);

        const input = document.getElementById("input-sensor-val");
        if (nextDir === "tempToOhm") {
          state.inputValue = Math.round(prev.tempC * 10) / 10;
        } else {
          state.inputValue = Math.round(prev.ohm * 100) / 100;
        }
        if (input) input.value = String(state.inputValue);
        renderSensorResult(true);
      });
    });
  }

  const famSeg = document.getElementById("sensor-family-switcher");
  if (famSeg) {
    famSeg.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextFamily = btn.dataset.family;
        if (nextFamily === state.family) return;
        state.family = nextFamily;
        state.sensorId = nextFamily === "ntc" ? "ntc10k_3435" : "pt1000";

        famSeg.querySelectorAll(".tab-btn").forEach((b) => b.setAttribute("aria-selected", "false"));
        btn.setAttribute("aria-selected", "true");
        updateSegmentedPill(famSeg);

        if (state.direction === "ohmToTemp") {
          state.inputValue = getDefaultOhmForSensor(state.family, state.sensorId);
          const input = document.getElementById("input-sensor-val");
          if (input) input.value = String(state.inputValue);
        }
        renderSensorSelect();
        renderSensorResult(true);
      });
    });
  }

  const sensorSelect = document.getElementById("sensor-select");
  const sensorSelectLabel = document.getElementById("sensor-select-label");
  if (sensorSelect) {
    sensorSelect.addEventListener("change", () => {
      state.sensorId = sensorSelect.value;
      if (sensorSelectLabel && sensorSelect.selectedOptions[0]) {
        sensorSelectLabel.textContent = sensorSelect.selectedOptions[0].textContent;
      }
      if (state.direction === "ohmToTemp") {
        state.inputValue = getDefaultOhmForSensor(state.family, state.sensorId);
        const input = document.getElementById("input-sensor-val");
        if (input) input.value = String(state.inputValue);
      }
      renderSensorResult(true);
    });
  }

  const valInput = document.getElementById("input-sensor-val");
  if (valInput) {
    valInput.addEventListener("input", () => {
      const parsed = Number(valInput.value.replace(",", "."));
      if (Number.isFinite(parsed)) {
        state.inputValue = parsed;
        renderSensorResult(true);
      }
    });
  }

  const minusBtn = document.getElementById("sensor-step-minus");
  const plusBtn = document.getElementById("sensor-step-plus");
  const handleStep = (sign) => {
    const delta = getStepDelta() * sign;
    const next = Math.round((state.inputValue + delta) * 100) / 100;
    state.inputValue =
      state.direction === "ohmToTemp"
        ? clampNumber(next, 0.1, 500000, 1000)
        : clampNumber(next, -60, 200, 25);
    if (valInput) valInput.value = String(state.inputValue);
    renderSensorResult(true);
  };
  if (minusBtn) minusBtn.addEventListener("click", () => handleStep(-1));
  if (plusBtn) plusBtn.addEventListener("click", () => handleStep(1));

  const r25Input = document.getElementById("input-custom-r25");
  const bInput = document.getElementById("input-custom-b");
  if (r25Input) {
    r25Input.addEventListener("input", () => {
      state.customR25 = clampNumber(r25Input.value, 100, 500000, 10000);
      renderSensorResult(true);
    });
  }
  if (bInput) {
    bInput.addEventListener("input", () => {
      state.customB = clampNumber(bInput.value, 1500, 6500, 3950);
      renderSensorResult(true);
    });
  }

  const refTrigger = document.getElementById("ref-acc-trigger");
  const refPanel = document.getElementById("ref-acc-panel");
  if (refTrigger && refPanel) {
    refTrigger.addEventListener("click", () => {
      const isOpen = refPanel.getAttribute("data-open") === "true";
      refPanel.setAttribute("data-open", String(!isOpen));
      refTrigger.setAttribute("aria-expanded", String(!isOpen));
    });
  }
}

function init() {
  wireEvents();
  renderSensorSelect();
  renderSensorResult(false);

  requestAnimationFrame(updateAllPills);
  window.addEventListener("resize", updateAllPills);
}

document.addEventListener("DOMContentLoaded", init);
