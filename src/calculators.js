/**
 * Modul: HVAC-R Fachberechnungen (calculators.js)
 * Zweck: Validierte physikalische Berechnungen für Kälte- und Lüftungstechnik
 *   (Sättigungstemperatur, Überhitzung, Unterkühlung, Luftkanal-Dimensionierung).
 * Verantwortlichkeit: Reine, zustandsfreie Rechenfunktionen mit Grenzprüfung gegen NaN/Infinity.
 * Sicherheits- & Stabilitätsrelevanz: Alle Eingaben werden auf plausible physikalische Bereiche
 *   begrenzt (Clamping), sodass keine unmöglichen Werte angezeigt werden.
 */

/**
 * Druck-Temperatur-Stützstellen (Relativdruck in bar ü -> Sättigungstemperatur in °C)
 * Basis: Standard-Dampfdruckkurven für gängige HVAC-R-Kältemittel.
 */
const REFRIGERANT_PT = {
  R32: [
    [-0.5, -62.0],
    [0.0, -51.7],
    [1.0, -37.2],
    [2.0, -26.5],
    [3.0, -18.0],
    [4.0, -10.8],
    [5.0, -4.5],
    [6.0, 1.1],
    [7.0, 6.1],
    [8.0, 10.7],
    [10.0, 18.8],
    [12.0, 25.8],
    [15.0, 34.8],
    [18.0, 42.5],
    [22.0, 51.3],
    [26.0, 58.9],
    [30.0, 65.7],
  ],
  R410A: [
    [-0.5, -61.8],
    [0.0, -51.4],
    [1.0, -36.8],
    [2.0, -26.1],
    [3.0, -17.5],
    [4.0, -10.3],
    [5.0, -4.0],
    [6.0, 1.6],
    [7.0, 6.7],
    [8.0, 11.3],
    [10.0, 19.4],
    [12.0, 26.5],
    [15.0, 35.6],
    [18.0, 43.3],
    [22.0, 52.1],
    [26.0, 59.7],
    [30.0, 66.5],
  ],
  R290: [
    [-0.5, -54.8],
    [0.0, -42.1],
    [1.0, -25.6],
    [2.0, -13.5],
    [3.0, -3.9],
    [4.0, 4.1],
    [5.0, 11.0],
    [6.0, 17.2],
    [7.0, 22.8],
    [8.0, 27.9],
    [10.0, 36.9],
    [12.0, 44.7],
    [15.0, 54.9],
    [18.0, 63.8],
    [22.0, 74.1],
  ],
  R134a: [
    [-0.5, -40.5],
    [0.0, -26.1],
    [0.5, -16.8],
    [1.0, -10.1],
    [1.5, -4.5],
    [2.0, 0.3],
    [3.0, 8.6],
    [4.0, 15.6],
    [5.0, 21.6],
    [6.0, 27.0],
    [8.0, 36.2],
    [10.0, 44.0],
    [12.0, 50.8],
    [15.0, 59.7],
  ],
};

const STANDARD_DN = [80, 100, 125, 160, 200, 250, 315, 355, 400, 450, 500, 630];

export function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

/**
 * Interpoliert die Sättigungstemperatur (°C) aus dem Überdruck (bar ü).
 */
export function getSaturationTempC(refrigerant, gaugeBar) {
  const table = REFRIGERANT_PT[refrigerant] || REFRIGERANT_PT.R32;
  const p = clampNumber(gaugeBar, table[0][0], table[table.length - 1][0], 6.0);

  for (let i = 0; i < table.length - 1; i += 1) {
    const [p1, t1] = table[i];
    const [p2, t2] = table[i + 1];
    if (p >= p1 && p <= p2) {
      const ratio = (p - p1) / (p2 - p1);
      return t1 + ratio * (t2 - t1);
    }
  }
  return table[table.length - 1][1];
}

/**
 * Berechnet Überhitzung (superheat) oder Unterkühlung (subcooling) inkl. Bewertung.
 */
export function calculateRefrigerationDelta({ refrigerant, mode, gaugeBar, measuredTempC }) {
  const safeBar = clampNumber(gaugeBar, -0.5, 30, 6.5);
  const safeTemp = clampNumber(measuredTempC, -50, 95, 10.0);
  const tSat = getSaturationTempC(refrigerant, safeBar);

  // Überhitzung = T_Saugleitung - T_0 | Unterkühlung = T_c - T_Flüssigkeitsleitung
  const deltaK = mode === "subcooling" ? tSat - safeTemp : safeTemp - tSat;

  let statusState = "ok";
  let statusText = "Optimal";

  if (mode === "superheat") {
    if (deltaK < 4) {
      statusState = "bad";
      statusText = "Zu niedrig · Flüssigschlag-Gefahr";
    } else if (deltaK <= 10) {
      statusState = "ok";
      statusText = "Optimal (4–10 K)";
    } else {
      statusState = "warn";
      statusText = "Hoch · Kältemittelmangel?";
    }
  } else {
    if (deltaK < 2) {
      statusState = "bad";
      statusText = "Zu niedrig · Dampfblasen";
    } else if (deltaK <= 8) {
      statusState = "ok";
      statusText = "Optimal (2–8 K)";
    } else {
      statusState = "warn";
      statusText = "Hoch · Überfüllung?";
    }
  }

  return {
    tSat,
    deltaK,
    statusState,
    statusText,
  };
}

/**
 * Dimensioniert Rundrohre (DN) oder Rechteckkanäle (B × H) aus Volumenstrom und Zielgeschwindigkeit.
 */
export function calculateDuctSizing({ flowM3h, maxVelocityMs, shape, widthMm, heightMm }) {
  const flow = clampNumber(flowM3h, 20, 25000, 320);
  const maxV = clampNumber(maxVelocityMs, 0.5, 15, 4.0);
  const flowM3s = flow / 3600;

  if (shape === "rect") {
    const b = clampNumber(widthMm, 100, 2000, 300);
    const h = clampNumber(heightMm, 100, 1500, 150);
    const areaM2 = (b / 1000) * (h / 1000);
    const actualV = flowM3s / areaM2;
    const equivDn = Math.round((1.3 * Math.pow((b * h), 0.625)) / Math.pow(b + h, 0.25));

    let statusState = "ok";
    let statusText = "Ruhige Strömung";
    if (actualV > maxV) {
      statusState = "bad";
      statusText = `Über Zielwert (${maxV.toFixed(1)} m/s)`;
    } else if (actualV > 5.5) {
      statusState = "warn";
      statusText = "Hörbare Strömung";
    }

    return {
      primaryLabel: `${b} × ${h}`,
      primaryUnit: "mm",
      actualVelocity: actualV,
      subInfo: `dn_eq ≈ ${equivDn} mm · A = ${Math.round(areaM2 * 10000)} cm²`,
      statusState,
      statusText,
    };
  }

  // Rundrohr: kleinsten Normdurchmesser wählen, bei dem v <= maxV bleibt
  let chosenDn = STANDARD_DN[STANDARD_DN.length - 1];
  let actualV = 0;

  for (const dn of STANDARD_DN) {
    const radiusM = dn / 2000;
    const areaM2 = Math.PI * radiusM * radiusM;
    const v = flowM3s / areaM2;
    chosenDn = dn;
    actualV = v;
    if (v <= maxV) break;
  }

  const areaCm2 = Math.round(Math.PI * Math.pow(chosenDn / 20, 2));
  let statusState = "ok";
  let statusText = "Leise · Wohnbau-tauglich";
  if (actualV > 6.0) {
    statusState = "bad";
    statusText = "Technikbereich · Laut";
  } else if (actualV > 3.5) {
    statusState = "warn";
    statusText = "Standard · Büro / Gewerbe";
  }

  return {
    primaryLabel: `DN ${chosenDn}`,
    primaryUnit: "",
    actualVelocity: actualV,
    subInfo: `v = ${actualV.toFixed(2).replace(".", ",")} m/s · A = ${areaCm2} cm²`,
    statusState,
    statusText,
  };
}
