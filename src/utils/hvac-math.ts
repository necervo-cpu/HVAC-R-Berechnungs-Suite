import {
  CalculationMode,
  RoomGeometry,
  ThermalTemperatures,
  EnvelopeSurface,
  VentilationData,
  CoolingSpecificData,
  CalculationResult
} from '../types/hvac';

export function computeHVACLoad(
  mode: CalculationMode,
  geometry: RoomGeometry,
  temperatures: ThermalTemperatures,
  surfaces: EnvelopeSurface[],
  ventilation: VentilationData,
  coolingData: CoolingSpecificData
): CalculationResult {
  const length = Math.max(0, Number(geometry.length) || 0);
  const width = Math.max(0, Number(geometry.width) || 0);
  const height = Math.max(0, Number(geometry.height) || 0);

  const roomArea = length * width;
  const roomVolume = roomArea * height;

  const tOut = Number(temperatures.outsideTemp) || 0;
  const tIn = Number(temperatures.insideTemp) || 0;

  const rawDeltaT = mode === 'heating' ? (tIn - tOut) : (tOut - tIn);
  const deltaT = Math.max(0, rawDeltaT);

  // 1. Transmission heat load: Q_T = sum(A * U * f_x) * deltaT
  const qTransmissionWatts = surfaces.reduce((sum, s) => {
    const area = Math.max(0, Number(s.area) || 0);
    const u = Math.max(0, Number(s.uValue) || 0);
    const factor = Math.max(0, Number(s.tempFactor) || 1);
    return sum + (area * u * factor * deltaT);
  }, 0);

  // 2. Ventilation heat load: Q_V = V * n * 0.34 W*h/(m3*K) * deltaT
  const n = Math.max(0, Number(ventilation.airChangeRate) || 0);
  const qVentilationWatts = roomVolume * n * 0.34 * deltaT;

  // 3. Internal loads: People, lighting, fans
  const peopleCount = Math.max(0, Number(ventilation.peopleCount) || 0);
  const heatPerPerson = Math.max(0, Number(ventilation.heatPerPersonWatt) || 0);
  const peopleWatts = peopleCount * heatPerPerson;

  let qInternalWatts = 0;
  let qProductWatts = 0;

  if (mode === 'cooling') {
    const lightW = Math.max(0, Number(coolingData.lightingWatts) || 0);
    const lightH = Math.min(24, Math.max(0, Number(coolingData.lightingHours) || 0));
    const avgLightWatts = (lightW * lightH) / 24;

    const fanW = Math.max(0, Number(coolingData.fanPowerWatts) || 0);
    const fanH = Math.min(24, Math.max(0, Number(coolingData.fanHours) || 0));
    const avgFanWatts = (fanW * fanH) / 24;

    qInternalWatts = peopleWatts + avgLightWatts + avgFanWatts;

    // Product load: Q = (m * c * deltaT_ware * 1000) / (duration_h * 3600)
    const mass = Math.max(0, Number(coolingData.goodsMassKg) || 0);
    const tEntry = Number(coolingData.goodsEntryTemp) || tOut;
    const c = Math.max(0, Number(coolingData.goodsSpecificHeatKJ) || 0);
    const coolHours = Math.max(0.1, Number(coolingData.coolingDurationHours) || 24);
    const deltaTGoods = Math.max(0, tEntry - tIn);

    if (mass > 0 && deltaTGoods > 0) {
      qProductWatts = (mass * c * 1000 * deltaTGoods) / (coolHours * 3600);
    }
  }

  const qBaseTotalWatts = qTransmissionWatts + qVentilationWatts + qInternalWatts + qProductWatts;
  const safetyFactor = 1 + (Math.max(0, Number(coolingData.safetyMarginPercent) || 0) / 100);
  const qTotalWatts = qBaseTotalWatts * safetyFactor;
  const qTotalKilowatts = qTotalWatts / 1000;

  const qSpecificPerM2 = roomArea > 0 ? (qTotalWatts / roomArea) : 0;
  const qSpecificPerM3 = roomVolume > 0 ? (qTotalWatts / roomVolume) : 0;

  // Compressor runtime scaling for refrigeration
  const runHours = Math.min(24, Math.max(4, Number(coolingData.compressorRunHours) || 16));
  const effectiveMachineryKW = mode === 'cooling'
    ? (qTotalKilowatts * (24 / runHours))
    : qTotalKilowatts;

  return {
    deltaT,
    roomArea,
    roomVolume,
    qTransmissionWatts,
    qVentilationWatts,
    qInternalWatts,
    qProductWatts,
    qTotalWatts,
    qTotalKilowatts,
    qSpecificPerM2,
    qSpecificPerM3,
    effectiveMachineryKW
  };
}

export function generateDefaultSurfaces(geometry: RoomGeometry): EnvelopeSurface[] {
  const l = Number(geometry.length) || 5;
  const w = Number(geometry.width) || 4;
  const h = Number(geometry.height) || 2.5;

  const wallAreaLong = l * h;
  const wallAreaShort = w * h;
  const floorCeilingArea = l * w;

  return [
    { id: 'wall-n', name: 'Außenwand Nord', area: wallAreaLong, uValue: 0.28, tempFactor: 1.0 },
    { id: 'wall-s', name: 'Außenwand Süd', area: wallAreaLong - 3.5, uValue: 0.28, tempFactor: 1.0 },
    { id: 'wall-e', name: 'Außenwand Ost', area: wallAreaShort, uValue: 0.28, tempFactor: 1.0 },
    { id: 'wall-w', name: 'Außenwand West', area: wallAreaShort, uValue: 0.28, tempFactor: 1.0 },
    { id: 'window', name: 'Fenster/Türen', area: 3.5, uValue: 1.10, tempFactor: 1.0 },
    { id: 'ceiling', name: 'Decke / Dach', area: floorCeilingArea, uValue: 0.20, tempFactor: 1.0 },
    { id: 'floor', name: 'Bodenplatte / Keller', area: floorCeilingArea, uValue: 0.35, tempFactor: 0.6 }
  ];
}
