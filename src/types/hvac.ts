export type CalculationMode = 'heating' | 'cooling';

export interface RoomGeometry {
  length: number;
  width: number;
  height: number;
}

export interface ThermalTemperatures {
  outsideTemp: number;
  insideTemp: number;
  adjacentUnheatedTemp?: number;
}

export interface EnvelopeSurface {
  id: string;
  name: string;
  area: number;
  uValue: number;
  tempFactor: number;
}

export interface VentilationData {
  airChangeRate: number;
  peopleCount: number;
  heatPerPersonWatt: number;
}

export interface CoolingSpecificData {
  goodsMassKg: number;
  goodsEntryTemp: number;
  goodsSpecificHeatKJ: number;
  coolingDurationHours: number;
  lightingWatts: number;
  lightingHours: number;
  fanPowerWatts: number;
  fanHours: number;
  compressorRunHours: number;
  safetyMarginPercent: number;
}

export interface CalculationResult {
  deltaT: number;
  roomArea: number;
  roomVolume: number;
  qTransmissionWatts: number;
  qVentilationWatts: number;
  qInternalWatts: number;
  qProductWatts: number;
  qTotalWatts: number;
  qTotalKilowatts: number;
  qSpecificPerM2: number;
  qSpecificPerM3: number;
  effectiveMachineryKW: number;
}
