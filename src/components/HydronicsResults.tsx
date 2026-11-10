/**
 * Modul: Hydronik-Ergebnis-Panel (KPI-Übersicht, Live-Strömung & Rohrnetz-Check)
 * Zweck: Zeigt berechneten Volumenstrom, Leistung, Spreizung, Stoffdaten und Rohrdimensionen im Logbuch-Stil
 * Sicherheitsrelevanz: Reine Anzeige-Komponente mit numerischer Formatierung (tabular-nums)
 */

import React from 'react';
import { HydronicMode, HydronicResult, HydronicTarget } from '../types/hydronics';
import { AnimatedNumber } from './AnimatedNumber';
import { PipeFlowVisualizer } from './PipeFlowVisualizer';
import { Droplets, Zap, Thermometer, AlertTriangle, Gauge, Layers } from 'lucide-react';

interface HydronicsResultsProps {
  mode: HydronicMode;
  target: HydronicTarget;
  result: HydronicResult;
}

export const HydronicsResults: React.FC<HydronicsResultsProps> = ({ mode, target, result }) => {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="px-1">
        <span className="text-[11px] sm:text-xs font-semibold tracking-wider text-[#9a9999]">
          BERECHNUNGSERGEBNIS
        </span>
      </div>

      {/* Warnmeldungen (Frostschutz / Spreizung) */}
      {result.warnings.length > 0 && (
        <div
          role="alert"
          className="view-enter bg-[#DCCC4B]/10 border border-[#DCCC4B]/40 rounded-2xl p-3.5 sm:p-4 text-xs text-[#f0e68c] space-y-1.5"
        >
          {result.warnings.map((warn, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#DCCC4B] shrink-0 mt-0.5" />
              <span className="min-w-0 leading-relaxed break-words">{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Haupt-KPI-Karte mit Rolling Numbers */}
      <div className="logbook-card rounded-2xl sm:rounded-3xl p-4 sm:p-6">
        <div className="pb-3.5 sm:pb-4 border-b border-white/10">
          <span className="text-xs font-semibold text-[#9a9999] flex items-center gap-1.5">
            {target === 'flowRate' && (
              <>
                <Droplets className="w-4 h-4 text-[#DCCC4B] shrink-0" />
                <span>Berechneter Volumenstrom (V̇)</span>
              </>
            )}
            {target === 'power' && (
              <>
                <Zap className="w-4 h-4 text-[#DCCC4B] shrink-0" />
                <span>Berechnete thermische Leistung (Q̇)</span>
              </>
            )}
            {target === 'deltaT' && (
              <>
                <Thermometer className="w-4 h-4 text-[#DCCC4B] shrink-0" />
                <span>Berechnete Temperaturspreizung (ΔT)</span>
              </>
            )}
          </span>

          <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            {target === 'flowRate' && (
              <>
                <AnimatedNumber
                  value={result.flowRateM3H}
                  decimals={2}
                  className="text-3xl sm:text-5xl font-extrabold font-mono tracking-tight text-[#DCCC4B]"
                />
                <span className="text-lg sm:text-xl font-bold text-white">m³/h</span>
                <span className="text-xs text-[#9a9999] font-mono tabular-nums ml-1">
                  (<AnimatedNumber value={result.flowRateLH} decimals={0} /> l/h)
                </span>
              </>
            )}

            {target === 'power' && (
              <>
                <AnimatedNumber
                  value={result.powerKW}
                  decimals={2}
                  className="text-3xl sm:text-5xl font-extrabold font-mono tracking-tight text-[#DCCC4B]"
                />
                <span className="text-lg sm:text-xl font-bold text-white">kW</span>
                <span className="text-xs text-[#9a9999] font-mono tabular-nums ml-1">
                  (<AnimatedNumber value={result.powerWatts} decimals={0} /> W)
                </span>
              </>
            )}

            {target === 'deltaT' && (
              <>
                <AnimatedNumber
                  value={result.deltaTK}
                  decimals={1}
                  className="text-3xl sm:text-5xl font-extrabold font-mono tracking-tight text-[#DCCC4B]"
                />
                <span className="text-lg sm:text-xl font-bold text-white">K</span>
                <span className="text-xs text-[#9a9999] font-mono tabular-nums ml-1">
                  (Rücklauf: <AnimatedNumber value={result.returnTempC} decimals={1} /> °C)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Einheiten-Konvertierung & Dreiecks-Werte */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 my-3.5 sm:my-4">
          <div className="p-2.5 sm:p-3 logbook-well rounded-xl sm:rounded-2xl min-w-0">
            <div className="text-[#9a9999] text-[11px] sm:text-xs mb-0.5">Liter / Minute</div>
            <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-white truncate">
              <AnimatedNumber value={result.flowRateLMin} decimals={1} />{' '}
              <span className="text-[11px] text-[#9a9999] font-normal">l/min</span>
            </div>
          </div>

          <div className="p-2.5 sm:p-3 logbook-well rounded-xl sm:rounded-2xl min-w-0">
            <div className="text-[#9a9999] text-[11px] sm:text-xs mb-0.5">Liter / Sekunde</div>
            <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-white truncate">
              <AnimatedNumber value={result.flowRateLS} decimals={2} />{' '}
              <span className="text-[11px] text-[#9a9999] font-normal">l/s</span>
            </div>
          </div>

          <div className="p-2.5 sm:p-3 logbook-well rounded-xl sm:rounded-2xl min-w-0">
            <div className="text-[#9a9999] text-[11px] sm:text-xs mb-0.5">Massenstrom (ṁ)</div>
            <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-white truncate">
              <AnimatedNumber value={result.massFlowKgH} decimals={0} />{' '}
              <span className="text-[11px] text-[#9a9999] font-normal">kg/h</span>
            </div>
          </div>

          <div className="p-2.5 sm:p-3 logbook-well rounded-xl sm:rounded-2xl min-w-0">
            <div className="text-[#9a9999] text-[11px] sm:text-xs mb-0.5">Leistung (Q̇)</div>
            <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-white truncate">
              <AnimatedNumber value={result.powerKW} decimals={2} />{' '}
              <span className="text-[11px] text-[#9a9999] font-normal">kW</span>
            </div>
          </div>

          <div className="p-2.5 sm:p-3 logbook-well rounded-xl sm:rounded-2xl min-w-0">
            <div className="text-[#9a9999] text-[11px] sm:text-xs mb-0.5">Spreizung (ΔT)</div>
            <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-white truncate">
              <AnimatedNumber value={result.deltaTK} decimals={1} />{' '}
              <span className="text-[11px] text-[#9a9999] font-normal">K</span>
            </div>
          </div>

          <div className="p-2.5 sm:p-3 logbook-well rounded-xl sm:rounded-2xl min-w-0">
            <div className="text-[#9a9999] text-[11px] sm:text-xs mb-0.5">Mitteltemp. (θ_m)</div>
            <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-white truncate">
              <AnimatedNumber value={result.meanTempC} decimals={1} />{' '}
              <span className="text-[11px] text-[#9a9999] font-normal">°C</span>
            </div>
          </div>
        </div>

        {/* Stoffdaten-Zeile */}
        <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] sm:text-xs text-[#9a9999]">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#DCCC4B] shrink-0" />
            <span>Stoffdaten bei {result.meanTempC.toFixed(1)} °C:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 font-mono tabular-nums text-white">
            <span>ρ = {result.densityKgM3.toFixed(1)} kg/m³</span>
            <span>c = {result.specificHeatKJ.toFixed(2)} kJ/(kg·K)</span>
            {result.freezingPointC < 0 && (
              <span className="text-[#DCCC4B]">Frost: {result.freezingPointC.toFixed(1)} °C</span>
            )}
          </div>
        </div>
      </div>

      {/* Animierte Rohrströmungs- & Temperaturspreizungs-Visualisierung */}
      <PipeFlowVisualizer mode={mode} result={result} />

      {/* Rohrdimensionierungs-Orientierung */}
      <div className="logbook-card rounded-2xl sm:rounded-3xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Gauge className="w-4 h-4 text-[#DCCC4B] shrink-0" />
            <span>Empfohlene Rohrdimension (0,5 – 1,0 m/s)</span>
          </div>
        </div>

        {result.recommendedPipes.length === 0 ? (
          <p className="text-xs text-[#9a9999]">
            Für diesen Volumenstrom liegt keine Standard-Nennweite (DN 15 – DN 100) im Zielbereich.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {result.recommendedPipes.map((pipe) => (
              <div
                key={pipe.dnLabel}
                className={`p-3 rounded-xl sm:rounded-2xl border flex items-center justify-between apple-spring ${
                  pipe.status === 'optimal'
                    ? 'bg-[#DCCC4B]/12 border-[#DCCC4B]/45'
                    : 'logbook-well'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{pipe.dnLabel}</div>
                  <div className="text-[11px] text-[#9a9999] font-mono tabular-nums">
                    d_i = {pipe.innerDiameterMm} mm
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div
                    className={`text-sm font-bold font-mono tabular-nums ${
                      pipe.status === 'optimal' ? 'text-[#DCCC4B]' : 'text-white'
                    }`}
                  >
                    <AnimatedNumber value={pipe.velocityMs} decimals={2} /> m/s
                  </div>
                  <div className="text-[10px] text-[#9a9999]">
                    {pipe.status === 'optimal' ? 'Optimal' : 'Grenzbereich'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
