/**
 * Modul: Hydronik-Berechnungs-Engine (Wasser & Wasser-Glykol-Gemische)
 * Zweck: Physikalische Dreiecksberechnung (Q = m * c * dT) inkl. Stoffdaten und Rohrdimensionierung
 * Sicherheitsrelevanz: Defensive Berechnungen fangen Division durch Null, NaN und unphysikalische Werte ab
 */

import {
  FluidType,
  HydronicInputs,
  HydronicResult,
  PipeRecommendation,
} from '../types/hydronics';

const STANDARD_PIPES: ReadonlyArray<{ dnLabel: string; innerDiameterMm: number }> = [
  { dnLabel: 'DN 15 (1/2")', innerDiameterMm: 16.0 },
  { dnLabel: 'DN 20 (3/4")', innerDiameterMm: 21.6 },
  { dnLabel: 'DN 25 (1")', innerDiameterMm: 27.2 },
  { dnLabel: 'DN 32 (1 1/4")', innerDiameterMm: 35.9 },
  { dnLabel: 'DN 40 (1 1/2")', innerDiameterMm: 41.8 },
  { dnLabel: 'DN 50 (2")', innerDiameterMm: 53.0 },
  { dnLabel: 'DN 65', innerDiameterMm: 68.8 },
  { dnLabel: 'DN 80', innerDiameterMm: 80.8 },
  { dnLabel: 'DN 100', innerDiameterMm: 105.3 },
];

/**
 * Berechnet Dichte, spezifische Wärmekapazität und Frostschutzgrenze des Wärmeträgermediums
 * auf Basis der mittleren Medientemperatur und der Glykolkonzentration.
 */
export function computeFluidProperties(
  fluidType: FluidType,
  glycolPercentRaw: number,
  meanTempC: number
): { densityKgM3: number; specificHeatKJ: number; freezingPointC: number } {
  const t = Math.min(110, Math.max(-35, Number.isFinite(meanTempC) ? meanTempC : 20));
  const conc = fluidType === 'water'
    ? 0
    : Math.min(60, Math.max(10, Number.isFinite(glycolPercentRaw) ? glycolPercentRaw : 30));

  if (fluidType === 'water' || conc === 0) {
    // Näherungsformel für reines Wasser zwischen 0 °C und 100 °C
    const densityKgM3 = 1000.2 - 0.065 * t - 0.0036 * t * t;
    const specificHeatKJ = 4.21 - 0.0012 * t + 0.000014 * t * t;
    return {
      densityKgM3: Math.round(densityKgM3 * 10) / 10,
      specificHeatKJ: Math.round(specificHeatKJ * 1000) / 1000,
      freezingPointC: 0,
    };
  }

  if (fluidType === 'ethylene-glycol') {
    const densityKgM3 = 1000 + conc * 1.45 - 0.42 * t;
    const specificHeatKJ = 4.185 - conc * 0.0175 + 0.0018 * t;
    const freezingPointC = -0.35 * conc - 0.0085 * conc * conc;
    return {
      densityKgM3: Math.round(densityKgM3 * 10) / 10,
      specificHeatKJ: Math.round(specificHeatKJ * 1000) / 1000,
      freezingPointC: Math.round(freezingPointC * 10) / 10,
    };
  }

  // Propylenglykol (lebensmittelecht / umweltfreundlich)
  const densityKgM3 = 1000 + conc * 1.15 - 0.45 * t;
  const specificHeatKJ = 4.185 - conc * 0.0145 + 0.002 * t;
  const freezingPointC = -0.28 * conc - 0.0082 * conc * conc;
  return {
    densityKgM3: Math.round(densityKgM3 * 10) / 10,
    specificHeatKJ: Math.round(specificHeatKJ * 1000) / 1000,
    freezingPointC: Math.round(freezingPointC * 10) / 10,
  };
}

/**
 * Führt die vollständige Hydronik-Berechnung nach Zielgröße durch.
 */
export function calculateHydronics(inputs: HydronicInputs): HydronicResult {
  const warnings: string[] = [];

  const safeSupply = Number.isFinite(inputs.supplyTempC) ? inputs.supplyTempC : 20;
  let safeReturn = Number.isFinite(inputs.returnTempC) ? inputs.returnTempC : 15;

  const rawDeltaT = Math.abs(safeSupply - safeReturn);
  let deltaTK = Math.max(0.5, rawDeltaT);

  const meanTempC = (safeSupply + safeReturn) / 2;
  const { densityKgM3, specificHeatKJ, freezingPointC } = computeFluidProperties(
    inputs.fluidType,
    inputs.glycolPercent,
    meanTempC
  );

  // Volumetrischer Wärmekapazitätsfaktor in kWh/(m³·K)
  const volumetricHeatFactor = (densityKgM3 * specificHeatKJ) / 3600;

  let powerKW = Math.max(0, Number.isFinite(inputs.powerKW) ? inputs.powerKW : 0);
  let flowRateM3H = Math.max(0, Number.isFinite(inputs.flowRateM3H) ? inputs.flowRateM3H : 0);

  if (inputs.target === 'flowRate') {
    if (rawDeltaT < 0.5) {
      warnings.push('Spreizung ΔT ist kleiner als 0,5 K. Berechnung nutzt Mindestspreizung von 0,5 K.');
    }
    flowRateM3H = volumetricHeatFactor > 0 ? powerKW / (volumetricHeatFactor * deltaTK) : 0;
  } else if (inputs.target === 'power') {
    if (rawDeltaT < 0.5) {
      warnings.push('Spreizung ΔT ist kleiner als 0,5 K. Bitte Vor- und Rücklauftemperatur prüfen.');
    }
    powerKW = flowRateM3H * volumetricHeatFactor * deltaTK;
  } else if (inputs.target === 'deltaT') {
    if (flowRateM3H <= 0.001) {
      warnings.push('Volumenstrom muss größer als 0 m³/h sein, um die Spreizung zu berechnen.');
      deltaTK = 0;
    } else {
      deltaTK = powerKW / (flowRateM3H * volumetricHeatFactor);
      safeReturn = inputs.mode === 'heating'
        ? safeSupply - deltaTK
        : safeSupply + deltaTK;
    }
  }

  const minSystemTemp = Math.min(safeSupply, safeReturn);
  if (minSystemTemp <= freezingPointC + 3) {
    warnings.push(
      `Vereisungsgefahr: Niedrigste Systemtemperatur (${minSystemTemp.toFixed(1)} °C) liegt nahe oder unter dem Gefrierpunkt (${freezingPointC.toFixed(1)} °C).`
    );
  }

  if (inputs.mode === 'heating' && safeSupply < safeReturn && inputs.target !== 'deltaT') {
    warnings.push('Hinweis: Im Heizbetrieb sollte die Vorlauftemperatur höher als die Rücklauftemperatur sein.');
  }
  if (inputs.mode === 'cooling' && safeSupply > safeReturn && inputs.target !== 'deltaT') {
    warnings.push('Hinweis: Im Kühlbetrieb sollte die Vorlauftemperatur niedriger als die Rücklauftemperatur sein.');
  }

  const flowRateLH = flowRateM3H * 1000;
  const flowRateLMin = flowRateLH / 60;
  const flowRateLS = flowRateLH / 3600;
  const massFlowKgH = flowRateM3H * densityKgM3;

  // Rohrdimensionierungs-Empfehlung nach Fließgeschwindigkeit (Zielkorridor: 0,4 bis 1,2 m/s)
  const recommendedPipes: PipeRecommendation[] = STANDARD_PIPES.map((pipe) => {
    const radiusM = (pipe.innerDiameterMm / 1000) / 2;
    const areaM2 = Math.PI * radiusM * radiusM;
    const flowM3S = flowRateM3H / 3600;
    const velocityMs = areaM2 > 0 ? flowM3S / areaM2 : 0;

    let status: PipeRecommendation['status'] = 'optimal';
    if (velocityMs < 0.3 || velocityMs > 1.5) {
      status = 'critical';
    } else if (velocityMs < 0.45 || velocityMs > 1.1) {
      status = 'warning';
    }

    return {
      dnLabel: pipe.dnLabel,
      innerDiameterMm: pipe.innerDiameterMm,
      velocityMs,
      status,
    };
  })
    .filter((p) => p.velocityMs >= 0.2 && p.velocityMs <= 2.4)
    .slice(0, 3);

  return {
    powerKW,
    powerWatts: powerKW * 1000,
    flowRateM3H,
    flowRateLH,
    flowRateLMin,
    flowRateLS,
    deltaTK,
    supplyTempC: safeSupply,
    returnTempC: safeReturn,
    meanTempC: (safeSupply + safeReturn) / 2,
    densityKgM3,
    specificHeatKJ,
    freezingPointC,
    massFlowKgH,
    recommendedPipes,
    warnings,
  };
}
