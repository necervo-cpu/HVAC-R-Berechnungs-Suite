/**
 * Modul: Interaktive App-Steuerung & Animationen (app.js)
 * Zweck: Verbindet Design-Richtungs-Switcher, 3-Stufen-Theme, gleitende Segmented-Pills,
 *   taktile Stepper, Live-HVAC-R-Rechner und das aufklappbare Info-Accordion.
 * Verantwortlichkeit: DOM-Events, animierte Pill-Geometrie und Live-Aktualisierung aller Werte.
 */

import {
  cycleThemeMode,
  getCurrentThemeMode,
} from "./theme.js";
import {
  calculateDuctSizing,
  calculateRefrigerationDelta,
  clampNumber,
} from "./calculators.js";

const THEME_LABELS = {
  auto: "Auto",
  light: "Hell",
  dark: "Dunkel",
};

const THEME_ICONS = {
  auto: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 8l4 4-4 4"/></svg>`,
  light: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
  dark: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
};

const state = {
  activeCalc: "refrig",
  refrig: {
    refrigerant: "R32",
    mode: "superheat",
    gaugeBar: 7.2,
    measuredTempC: 14.0,
  },
  duct: {
    shape: "round",
    flowM3h: 320,
    maxVelocityMs: 3.5,
    widthMm: 300,
    heightMm: 150,
  },
};

function formatDE(num, decimals = 1) {
  return num.toFixed(decimals).replace(".", ",");
}

/**
 * Positioniert die gleitende Segmented-Pill exakt unter dem aktiven Tab.
 */
function updateSegmentedPill(container) {
  if (!container) return;
  const pill = container.querySelector(".t-tabs-pill");
  const buttons = Array.from(container.querySelectorAll(".tab-btn"));
  const activeIdx = buttons.findIndex((btn) => btn.getAttribute("aria-selected") === "true");
  if (!pill || activeIdx < 0) return;

  const activeBtn = buttons[activeIdx];
  const pad = container.classList.contains("segmented--compact") ? 2 : 3;
  const width = activeBtn.offsetWidth;
  const x = activeBtn.offsetLeft - pad;

  pill.style.width = `${width}px`;
  pill.style.transform = `translateX(${x}px)`;
}

function updateAllPills() {
  document.querySelectorAll(".segmented").forEach((seg) => updateSegmentedPill(seg));
}

function pulseResult(element) {
  if (!element) return;
  element.classList.remove("is-popping");
  void element.offsetWidth;
  element.classList.add("is-popping");
  window.setTimeout(() => element.classList.remove("is-popping"), 180);
}

function renderThemeButton(animateSwap = false) {
  const mode = getCurrentThemeMode();
  const iconEl = document.getElementById("theme-icon");
  const labelEl = document.getElementById("theme-label");
  if (!iconEl || !labelEl) return;

  if (animateSwap) {
    iconEl.classList.add("is-swapping");
    window.setTimeout(() => {
      iconEl.innerHTML = THEME_ICONS[mode];
      labelEl.textContent = THEME_LABELS[mode];
      iconEl.classList.remove("is-swapping");
    }, 110);
  } else {
    iconEl.innerHTML = THEME_ICONS[mode];
    labelEl.textContent = THEME_LABELS[mode];
  }
}

function renderTokenInfo() {
  const computed = getComputedStyle(document.documentElement);
  const accentHex = computed.getPropertyValue("--brand-accent").trim();
  const bgHex = computed.getPropertyValue("--bg").trim();
  const tokenAccentEl = document.getElementById("token-accent-val");
  const tokenBgEl = document.getElementById("token-bg-val");
  if (tokenAccentEl) tokenAccentEl.textContent = accentHex;
  if (tokenBgEl) tokenBgEl.textContent = bgHex;
}

function renderRefrigCalculator(animate = false) {
  const res = calculateRefrigerationDelta(state.refrig);

  const titleEl = document.getElementById("refrig-result-title");
  const valueEl = document.getElementById("refrig-result-val");
  const subEl = document.getElementById("refrig-result-sub");
  const badgeEl = document.getElementById("refrig-status-badge");
  const satHintEl = document.getElementById("refrig-sat-hint");
  const tempLabelEl = document.getElementById("refrig-temp-label");

  if (titleEl) {
    titleEl.textContent =
      state.refrig.mode === "subcooling" ? "Unterkühlung (ΔT)" : "Überhitzung (ΔT)";
  }
  if (tempLabelEl) {
    tempLabelEl.textContent =
      state.refrig.mode === "subcooling" ? "Flüssigkeitsleitung" : "Saugleitung";
  }
  if (valueEl) {
    valueEl.innerHTML = `${formatDE(res.deltaK, 1)}<span class="result-unit">K</span>`;
    if (animate) pulseResult(valueEl);
  }
  if (subEl) {
    const tLabel = state.refrig.mode === "subcooling" ? "Tc" : "T₀";
    subEl.textContent = `${tLabel} = ${formatDE(res.tSat, 1)} °C`;
  }
  if (satHintEl) {
    satHintEl.textContent = `Sättigung ${formatDE(res.tSat, 1)} °C`;
  }
  if (badgeEl) {
    badgeEl.setAttribute("data-state", res.statusState);
    badgeEl.textContent = res.statusText;
  }
}

function renderDuctCalculator(animate = false) {
  const res = calculateDuctSizing(state.duct);

  const valueEl = document.getElementById("duct-result-val");
  const subEl = document.getElementById("duct-result-sub");
  const badgeEl = document.getElementById("duct-status-badge");
  const rectFieldsEl = document.getElementById("duct-rect-fields");

  if (rectFieldsEl) {
    rectFieldsEl.hidden = state.duct.shape !== "rect";
  }
  if (valueEl) {
    valueEl.innerHTML = `${res.primaryLabel}${
      res.primaryUnit ? `<span class="result-unit">${res.primaryUnit}</span>` : ""
    }`;
    if (animate) pulseResult(valueEl);
  }
  if (subEl) subEl.textContent = res.subInfo;
  if (badgeEl) {
    badgeEl.setAttribute("data-state", res.statusState);
    badgeEl.textContent = res.statusText;
  }
}

function wireSegmentedControls() {
  // 1. Rechner-Tabs (Kälte vs. Lüftung)
  const calcSeg = document.getElementById("calc-switcher");
  if (calcSeg) {
    calcSeg.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.calc;
        if (target === state.activeCalc) return;
        state.activeCalc = target;

        calcSeg.querySelectorAll(".tab-btn").forEach((b) => b.setAttribute("aria-selected", "false"));
        btn.setAttribute("aria-selected", "true");
        updateSegmentedPill(calcSeg);

        const refrigPanel = document.getElementById("panel-refrig");
        const ductPanel = document.getElementById("panel-duct");
        if (refrigPanel && ductPanel) {
          refrigPanel.hidden = target !== "refrig";
          ductPanel.hidden = target !== "duct";
          const activePanel = target === "refrig" ? refrigPanel : ductPanel;
          activePanel.classList.remove("is-entering");
          void activePanel.offsetWidth;
          activePanel.classList.add("is-entering");
        }
        updateAllPills();
      });
    });
  }

  // 3. Kälte-Modus (Überhitzung vs. Unterkühlung)
  const modeSeg = document.getElementById("refrig-mode-switcher");
  if (modeSeg) {
    modeSeg.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        modeSeg.querySelectorAll(".tab-btn").forEach((b) => b.setAttribute("aria-selected", "false"));
        btn.setAttribute("aria-selected", "true");
        state.refrig.mode = btn.dataset.mode;

        // Sinnvolle Standard-Messwerte je Modus setzen, damit der Test sofort realistisch wirkt
        if (state.refrig.mode === "subcooling") {
          state.refrig.gaugeBar = 22.0;
          state.refrig.measuredTempC = 46.5;
        } else {
          state.refrig.gaugeBar = 7.2;
          state.refrig.measuredTempC = 14.0;
        }
        const barInput = document.getElementById("input-bar");
        const tempInput = document.getElementById("input-temp");
        if (barInput) barInput.value = String(state.refrig.gaugeBar);
        if (tempInput) tempInput.value = String(state.refrig.measuredTempC);

        updateSegmentedPill(modeSeg);
        renderRefrigCalculator(true);
      });
    });
  }

  // 4. Kanalform (Rund vs. Rechteck)
  const shapeSeg = document.getElementById("duct-shape-switcher");
  if (shapeSeg) {
    shapeSeg.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        shapeSeg.querySelectorAll(".tab-btn").forEach((b) => b.setAttribute("aria-selected", "false"));
        btn.setAttribute("aria-selected", "true");
        state.duct.shape = btn.dataset.shape;
        updateSegmentedPill(shapeSeg);
        renderDuctCalculator(true);
      });
    });
  }
}

function wireRefrigInputs() {
  // Kältemittel Chips
  const chips = document.querySelectorAll("#refrigerant-chips .chip-btn");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
      chip.setAttribute("aria-pressed", "true");
      state.refrig.refrigerant = chip.dataset.ref;
      renderRefrigCalculator(true);
    });
  });

  const barInput = document.getElementById("input-bar");
  const tempInput = document.getElementById("input-temp");

  if (barInput) {
    barInput.addEventListener("input", () => {
      state.refrig.gaugeBar = clampNumber(barInput.value.replace(",", "."), -0.5, 30, 7.2);
      renderRefrigCalculator(false);
    });
  }

  if (tempInput) {
    tempInput.addEventListener("input", () => {
      state.refrig.measuredTempC = clampNumber(tempInput.value.replace(",", "."), -50, 95, 14.0);
      renderRefrigCalculator(false);
    });
  }

  // Stepper Buttons
  document.querySelectorAll("[data-step-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.stepTarget;
      const step = Number(btn.dataset.stepDelta);
      const input = document.getElementById(targetId);
      if (!input) return;

      const current = Number(input.value.replace(",", ".")) || 0;
      const next = Math.round((current + step) * 10) / 10;

      if (targetId === "input-bar") {
        state.refrig.gaugeBar = clampNumber(next, -0.5, 30, 7.2);
        input.value = state.refrig.gaugeBar.toFixed(1);
        renderRefrigCalculator(true);
      } else if (targetId === "input-temp") {
        state.refrig.measuredTempC = clampNumber(next, -50, 95, 14.0);
        input.value = state.refrig.measuredTempC.toFixed(1);
        renderRefrigCalculator(true);
      } else if (targetId === "input-flow") {
        state.duct.flowM3h = clampNumber(Math.round(current + step), 20, 25000, 320);
        input.value = String(state.duct.flowM3h);
        renderDuctCalculator(true);
      } else if (targetId === "input-width") {
        state.duct.widthMm = clampNumber(Math.round(current + step), 100, 2000, 300);
        input.value = String(state.duct.widthMm);
        renderDuctCalculator(true);
      } else if (targetId === "input-height") {
        state.duct.heightMm = clampNumber(Math.round(current + step), 100, 1500, 150);
        input.value = String(state.duct.heightMm);
        renderDuctCalculator(true);
      }
    });
  });
}

function wireDuctInputs() {
  const flowInput = document.getElementById("input-flow");
  const widthInput = document.getElementById("input-width");
  const heightInput = document.getElementById("input-height");

  if (flowInput) {
    flowInput.addEventListener("input", () => {
      state.duct.flowM3h = clampNumber(flowInput.value, 20, 25000, 320);
      renderDuctCalculator(false);
    });
  }
  if (widthInput) {
    widthInput.addEventListener("input", () => {
      state.duct.widthMm = clampNumber(widthInput.value, 100, 2000, 300);
      renderDuctCalculator(false);
    });
  }
  if (heightInput) {
    heightInput.addEventListener("input", () => {
      state.duct.heightMm = clampNumber(heightInput.value, 100, 1500, 150);
      renderDuctCalculator(false);
    });
  }

  // Geschwindigkeits-Presets
  const vChips = document.querySelectorAll("#velocity-chips .chip-btn");
  vChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      vChips.forEach((c) => c.setAttribute("aria-pressed", "false"));
      chip.setAttribute("aria-pressed", "true");
      state.duct.maxVelocityMs = Number(chip.dataset.velocity);
      renderDuctCalculator(true);
    });
  });
}

function wireAccordionAndTheme() {
  const themeBtn = document.getElementById("theme-toggle-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      cycleThemeMode(getCurrentThemeMode());
      renderThemeButton(true);
      renderTokenInfo();
    });
  }

  const accTrigger = document.getElementById("info-acc-trigger");
  const accPanel = document.getElementById("info-acc-panel");
  if (accTrigger && accPanel) {
    accTrigger.addEventListener("click", () => {
      const isOpen = accPanel.getAttribute("data-open") === "true";
      accPanel.setAttribute("data-open", String(!isOpen));
      accTrigger.setAttribute("aria-expanded", String(!isOpen));
    });
  }

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      renderTokenInfo();
    });
  }
}

function init() {
  wireSegmentedControls();
  wireRefrigInputs();
  wireDuctInputs();
  wireAccordionAndTheme();

  renderThemeButton(false);
  renderTokenInfo();
  renderRefrigCalculator(false);
  renderDuctCalculator(false);

  // Pills nach Layout-Berechnung initial positionieren
  requestAnimationFrame(updateAllPills);
  window.addEventListener("resize", updateAllPills);
}

document.addEventListener("DOMContentLoaded", init);
