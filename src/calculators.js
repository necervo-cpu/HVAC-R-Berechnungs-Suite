/**
 * Modul: HVAC-R Sensor-Berechnungen (calculators.js)
 * Zweck: Physikalische Umrechnung zwischen Widerstand (Ohm) und Temperatur (°C)
 *   für gängige HVAC-R-Sensoren (NTC 2k/5k/10k/12k/20k/Eigen sowie PTC PT100, PT1000, KTY81-210).
 * Verantwortlichkeit: Reine, zustandsfreie Rechenfunktionen nach B-Parameter-Gleichung (NTC),
 *   Callendar-Van-Dusen / DIN EN 60751 (PT100/PT1000) und Silizium-Polynom (KTY81-210).
 * Sicherheits- & Stabilitätsrelevanz: Eingabe-Clamping und Schutz vor Division durch Null / NaN.
 */

export const NTC_SENSORS = {
  ntc2k: { id: "ntc2k", label: "2k", fullLabel: "NTC 2 kΩ", r25: 2000, b: 3435, note: "z. B. Danfoss EKS" },
  ntc5k: { id: "ntc5k", label: "5k", fullLabel: "NTC 5 kΩ", r25: 5000, b: 3977, note: "Standard-Fühler" },
  ntc10k_3435: { id: "ntc10k_3435", label: "10k · 3435", fullLabel: "NTC 10 kΩ (B=3435)", r25: 10000, b: 3435, note: "z. B. Carel / Kälteregler" },
  ntc10k_3977: { id: "ntc10k_3977", label: "10k · 3977", fullLabel: "NTC 10 kΩ (B=3977)", r25: 10000, b: 3977, note: "Standard-NTC" },
  ntc12k: { id: "ntc12k", label: "12k", fullLabel: "NTC 12 kΩ", r25: 12000, b: 3977, note: "Split / Wärmepumpe" },
  ntc20k: { id: "ntc20k", label: "20k", fullLabel: "NTC 20 kΩ", r25: 20000, b: 3977, note: "z. B. Honeywell / Siemens" },
  ntc_custom: { id: "ntc_custom", label: "Eigen", fullLabel: "Eigener NTC", r25: 10000, b: 3950, note: "Freier R₂₅ & B-Wert" },
};

export const PTC_SENSORS = {
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

export function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
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
    // Exakte quadratische Inversion für T >= 0 °C
    const disc = CVD_A * CVD_A - 4 * CVD_B * (1 - ratio);
    return (-CVD_A + Math.sqrt(Math.max(0, disc))) / (2 * CVD_B);
  }
  // Newton-Raphson für T < 0 °C (konvergiert in < 8 Schritten auf 10^-8 K)
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

/**
 * Formatiert Widerstandswerte praxisgerecht in Ω oder kΩ.
 */
export function formatOhm(ohm) {
  if (!Number.isFinite(ohm) || ohm < 0) return { num: "—", unit: "Ω" };
  if (ohm >= 10000) {
    return { num: (ohm / 1000).toFixed(2).replace(".", ","), unit: "kΩ" };
  }
  if (ohm >= 1000) {
    return { num: ohm.toFixed(1).replace(".", ","), unit: "Ω" };
  }
  return { num: ohm.toFixed(2).replace(".", ","), unit: "Ω" };
}

/**
 * Berechnet Sensor-Umrechnung (Ohm <-> °C) inkl. Statusbewertung und Referenzpunkten.
 */
export function calculateSensorConversion({
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

  // Plausibilitätsprüfung (Fühlerbruch / Kurzschluss / Messbereich)
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
