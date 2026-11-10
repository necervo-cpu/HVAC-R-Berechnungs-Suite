/**
 * Modul: Hydronik-Typdefinitionen
 * Zweck: Definiert Datenstrukturen für Volumenstrom-, Heiz-/Kühlleistungs- und Spreizungsberechnungen
 * Sicherheitsrelevanz: Strikte Typisierung verhindert Laufzeitfehler und ungültige Zustände
 */

export type ActiveToolId = 'hub' | 'hydronics' | 'heat-load';

export type HydronicTarget = 'flowRate' | 'power' | 'deltaT';

export type FluidType = 'water' | 'ethylene-glycol' | 'propylene-glycol';

export type HydronicMode = 'heating' | 'cooling';

export interface HydronicInputs {
  target: HydronicTarget;
  mode: HydronicMode;
  fluidType: FluidType;
  glycolPercent: number;
  supplyTempC: number;
  returnTempC: number;
  powerKW: number;
  flowRateM3H: number;
}

export interface PipeRecommendation {
  dnLabel: string;
  innerDiameterMm: number;
  velocityMs: number;
  status: 'optimal' | 'warning' | 'critical';
}

export interface HydronicResult {
  powerKW: number;
  powerWatts: number;
  flowRateM3H: number;
  flowRateLH: number;
  flowRateLMin: number;
  flowRateLS: number;
  deltaTK: number;
  supplyTempC: number;
  returnTempC: number;
  meanTempC: number;
  densityKgM3: number;
  specificHeatKJ: number;
  freezingPointC: number;
  massFlowKgH: number;
  recommendedPipes: PipeRecommendation[];
  warnings: string[];
}
