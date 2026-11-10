/**
 * Modul: Heiz- & Kühllast-Rechner (DIN EN 12831 & Kältehandwerk)
 * Zweck: Kapselt die Raumgeometrie-, Hüllflächen-, Lüftungs- und Kühllast-Berechnung ohne Beispiel-Vorlagen
 * Sicherheitsrelevanz: Reine Client-Side-Berechnung ohne externe Datenübertragung
 */

import React, { useState, useMemo } from 'react';
import {
  CalculationMode,
  RoomGeometry,
  ThermalTemperatures,
  EnvelopeSurface,
  VentilationData,
  CoolingSpecificData,
} from '../types/hvac';
import { computeHVACLoad, generateDefaultSurfaces } from '../utils/hvac-math';
import { KPISummary } from './KPISummary';
import { GeometryInputs } from './GeometryInputs';
import { BuildingEnvelopeInputs } from './BuildingEnvelopeInputs';
import { VentilationInputs } from './VentilationInputs';
import { CoolingSpecificInputs } from './CoolingSpecificInputs';
import { MobileBottomBar } from './MobileBottomBar';
import { Flame, Snowflake, RotateCcw } from 'lucide-react';

const initialGeometry: RoomGeometry = {
  length: 6,
  width: 4,
  height: 2.8,
};

const initialTemperatures: ThermalTemperatures = {
  outsideTemp: -12,
  insideTemp: 20,
};

const initialVentilation: VentilationData = {
  airChangeRate: 0.8,
  peopleCount: 2,
  heatPerPersonWatt: 90,
};

const initialCoolingData: CoolingSpecificData = {
  goodsMassKg: 250,
  goodsEntryTemp: 18,
  goodsSpecificHeatKJ: 3.2,
  coolingDurationHours: 16,
  lightingWatts: 60,
  lightingHours: 4,
  fanPowerWatts: 120,
  fanHours: 24,
  compressorRunHours: 16,
  safetyMarginPercent: 10,
};

export const HeatLoadCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalculationMode>('heating');
  const [geometry, setGeometry] = useState<RoomGeometry>(initialGeometry);
  const [temperatures, setTemperatures] = useState<ThermalTemperatures>(initialTemperatures);
  const [surfaces, setSurfaces] = useState<EnvelopeSurface[]>(() =>
    generateDefaultSurfaces(initialGeometry)
  );
  const [ventilation, setVentilation] = useState<VentilationData>(initialVentilation);
  const [coolingData, setCoolingData] = useState<CoolingSpecificData>(initialCoolingData);

  const results = useMemo(() => {
    return computeHVACLoad(mode, geometry, temperatures, surfaces, ventilation, coolingData);
  }, [mode, geometry, temperatures, surfaces, ventilation, coolingData]);

  const handleReset = () => {
    setMode('heating');
    setGeometry(initialGeometry);
    setTemperatures(initialTemperatures);
    setSurfaces(generateDefaultSurfaces(initialGeometry));
    setVentilation(initialVentilation);
    setCoolingData(initialCoolingData);
  };

  return (
    <div className="view-enter space-y-6 pb-40 sm:pb-44">
      {/* Aufgeräumte Modul-Kopfzeile mit gleitendem Modus-Umschalter */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">
            Heizlast & Kühlraum-Kälteleistung
          </h2>
          <p className="text-xs text-[#9a9999]">
            Raumweise Transmissions-, Lüftungs- und Warenwärmeberechnung
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative inline-grid grid-cols-2 p-1 bg-[#111111] border border-white/10 rounded-2xl">
            <span
              aria-hidden="true"
              style={{ transform: `translateX(${mode === 'heating' ? '0%' : '100%'})` }}
              className="pill-slider pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl bg-[#DCCC4B] shadow-md"
            />
            <button
              type="button"
              onClick={() => setMode('heating')}
              className={`relative z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold apple-spring active:scale-[0.98] ${
                mode === 'heating' ? 'text-[#111111]' : 'text-[#9a9999]'
              }`}
            >
              <Flame className="w-3.5 h-3.5 shrink-0" />
              <span>Heizlast</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('cooling')}
              className={`relative z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold apple-spring active:scale-[0.98] ${
                mode === 'cooling' ? 'text-[#111111]' : 'text-[#9a9999]'
              }`}
            >
              <Snowflake className="w-3.5 h-3.5 shrink-0" />
              <span>Kühllast</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#9a9999] hover-subtle bg-[#111111] border border-white/10 rounded-xl active:scale-[0.96] apple-spring min-h-[40px]"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Zurücksetzen</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section aria-label="Eingabeparameter" className="lg:col-span-7 space-y-6">
          <GeometryInputs
            mode={mode}
            geometry={geometry}
            temperatures={temperatures}
            onGeometryChange={setGeometry}
            onTemperaturesChange={setTemperatures}
          />

          <BuildingEnvelopeInputs
            mode={mode}
            surfaces={surfaces}
            onSurfacesChange={setSurfaces}
          />

          <VentilationInputs data={ventilation} onChange={setVentilation} />

          {mode === 'cooling' && (
            <CoolingSpecificInputs data={coolingData} onChange={setCoolingData} />
          )}
        </section>

        <section
          aria-label="Berechnungsergebnisse"
          className="lg:col-span-5 lg:sticky lg:top-24 space-y-5"
        >
          <KPISummary mode={mode} results={results} />
        </section>
      </div>

      <MobileBottomBar mode={mode} results={results} />
    </div>
  );
};
