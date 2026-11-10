import React from 'react';
import { CalculationMode, CalculationResult } from '../types/hvac';
import { Activity, Gauge, Zap, Thermometer } from 'lucide-react';

interface KPISummaryProps {
  mode: CalculationMode;
  results: CalculationResult;
}

export const KPISummary: React.FC<KPISummaryProps> = ({ mode, results }) => {
  const isHeat = mode === 'heating';
  const totalWatts = Math.max(0.1, results.qTotalWatts);

  const pctTrans = Math.round((results.qTransmissionWatts / totalWatts) * 100);
  const pctVent = Math.round((results.qVentilationWatts / totalWatts) * 100);
  const pctInternal = Math.round((results.qInternalWatts / totalWatts) * 100);
  const pctProduct = Math.round((results.qProductWatts / totalWatts) * 100);

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
      {/* Apple Section Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9a9999] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#DCCC4B]" />
            {isHeat ? 'Norm-Gesamtheizlast (Q̇_H)' : 'Auslegungs-Kälteleistung (Q̇_0)'}
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-4xl sm:text-5xl font-extrabold font-mono tabular-nums tracking-tight text-[#DCCC4B]">
              {results.effectiveMachineryKW.toFixed(2)}
            </span>
            <span className="text-xl font-bold text-white">kW</span>
            <span className="text-xs text-[#9a9999] font-mono tabular-nums ml-2">
              ({(results.effectiveMachineryKW * 1000).toLocaleString('de-DE', { maximumFractionDigits: 0 })} W)
            </span>
          </div>
        </div>

        {/* ΔT Pill */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#111111] border border-white/10">
          <Thermometer className="w-4 h-4 text-[#DCCC4B]" />
          <div className="text-xs font-mono">
            <span className="text-[#9a9999]">ΔT: </span>
            <span className="text-white font-bold tabular-nums">{results.deltaT.toFixed(1)} K</span>
          </div>
        </div>
      </div>

      {/* Sub KPIs Grid - Apple Grouped Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 my-4">
        <div className="p-3.5 bg-[#111111] rounded-2xl border border-white/5">
          <div className="flex items-center gap-1 text-[#9a9999] text-xs mb-1 font-medium">
            <Gauge className="w-3 h-3 text-[#DCCC4B]" />
            <span>Spez. Fläche</span>
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-white">
            {results.qSpecificPerM2.toFixed(1)} <span className="text-xs text-[#9a9999] font-normal">W/m²</span>
          </div>
        </div>

        <div className="p-3.5 bg-[#111111] rounded-2xl border border-white/5">
          <div className="flex items-center gap-1 text-[#9a9999] text-xs mb-1 font-medium">
            <Zap className="w-3 h-3 text-[#DCCC4B]" />
            <span>Spez. Volumen</span>
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-white">
            {results.qSpecificPerM3.toFixed(1)} <span className="text-xs text-[#9a9999] font-normal">W/m³</span>
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 p-3.5 bg-[#111111] rounded-2xl border border-white/5">
          <div className="text-[#9a9999] text-xs mb-1 font-medium">
            {isHeat ? 'Basis-Wärmebedarf' : '24h-Dauerlast'}
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-white">
            {results.qTotalKilowatts.toFixed(2)} <span className="text-xs text-[#9a9999] font-normal">kW</span>
          </div>
        </div>
      </div>

      {/* Load Split Progress Bar (Apple Segmented Bar) */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between text-xs text-[#9a9999] mb-2 font-medium">
          <span>Thermodynamische Lastaufteilung</span>
          <span className="font-mono text-[11px] text-[#DCCC4B]">Summe: 100%</span>
        </div>
        
        {/* Apple Segmented Bar with website palette */}
        <div className="h-3 w-full bg-[#111111] rounded-full overflow-hidden flex border border-white/10 p-0.5 gap-0.5">
          <div
            style={{ width: `${pctTrans}%` }}
            className="bg-[#DCCC4B] h-full rounded-full transition-all duration-300"
            title={`Transmission: ${pctTrans}%`}
          />
          <div
            style={{ width: `${pctVent}%` }}
            className="bg-[#f0e68c] h-full rounded-full transition-all duration-300"
            title={`Lüftung: ${pctVent}%`}
          />
          {pctProduct > 0 && (
            <div
              style={{ width: `${pctProduct}%` }}
              className="bg-[#c4b53e] h-full rounded-full transition-all duration-300"
              title={`Warenwärme: ${pctProduct}%`}
            />
          )}
          {pctInternal > 0 && (
            <div
              style={{ width: `${pctInternal}%` }}
              className="bg-[#706F6F] h-full rounded-full transition-all duration-300"
              title={`Interne Lasten: ${pctInternal}%`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DCCC4B] inline-block" />
            <span className="text-[#9a9999]">Transmission:</span>
            <span className="font-mono font-semibold text-white tabular-nums">{results.qTransmissionWatts.toFixed(0)} W</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f0e68c] inline-block" />
            <span className="text-[#9a9999]">Lüftung:</span>
            <span className="font-mono font-semibold text-white tabular-nums">{results.qVentilationWatts.toFixed(0)} W</span>
          </div>
          {mode === 'cooling' && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c4b53e] inline-block" />
              <span className="text-[#9a9999]">Ware:</span>
              <span className="font-mono font-semibold text-white tabular-nums">{results.qProductWatts.toFixed(0)} W</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#706F6F] inline-block" />
            <span className="text-[#9a9999]">Intern:</span>
            <span className="font-mono font-semibold text-white tabular-nums">{results.qInternalWatts.toFixed(0)} W</span>
          </div>
        </div>
      </div>
    </div>
  );
};
