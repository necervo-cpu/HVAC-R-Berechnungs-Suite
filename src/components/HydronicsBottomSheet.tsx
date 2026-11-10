/**
 * Modul: Kompaktes Live-Ergebnis-Dock am unteren Bildschirmrand (HydronicsBottomSheet)
 * Zweck: Zeigt Hauptergebnis (m³/h + l/min) und empfohlene Rohrgröße (DN) dauerhaft am unteren Rand ohne Schnickschnack
 * Sicherheitsrelevanz: Reine Anzeige-Komponente mit numerischer Formatierung (tabular-nums)
 */

import React from 'react';
import { HydronicResult, HydronicTarget } from '../types/hydronics';
import { AnimatedNumber } from './AnimatedNumber';
import { Droplets, Zap, Thermometer, AlertTriangle } from 'lucide-react';

interface HydronicsBottomSheetProps {
  target: HydronicTarget;
  result: HydronicResult;
}

export const HydronicsBottomSheet: React.FC<HydronicsBottomSheetProps> = ({
  target,
  result,
}) => {
  const bestPipe =
    result.recommendedPipes.find((p) => p.status === 'optimal') || result.recommendedPipes[0];

  return (
    <aside
      aria-label="Live-Berechnungsergebnis am unteren Bildschirmrand"
      className="fixed bottom-0 left-0 right-0 z-40 logbook-dock safe-area-bottom"
    >
      <div className="gold-divider" />

      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 pt-2.5 pb-1">
        {/* Dezent eingeblendeter Warnhinweis nur wenn nötig (z. B. Frostgefahr) */}
        {result.warnings.length > 0 && (
          <div className="mb-2 px-3 py-1.5 rounded-xl bg-[#DCCC4B]/15 border border-[#DCCC4B]/40 flex items-center gap-2 text-[11px] text-theme-primary">
            <AlertTriangle className="w-3.5 h-3.5 text-[#DCCC4B] shrink-0" />
            <span className="truncate">{result.warnings[0]}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          {/* Links: Hauptergebnis klar und groß */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#DCCC4B] flex items-center justify-center text-[#111111] gold-glow shrink-0">
              {target === 'flowRate' && <Droplets className="w-5 h-5" />}
              {target === 'power' && <Zap className="w-5 h-5" />}
              {target === 'deltaT' && <Thermometer className="w-5 h-5" />}
            </div>

            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-theme-secondary truncate">
                {target === 'flowRate' && 'Volumenstrom'}
                {target === 'power' && 'Heiz- / Kälteleistung'}
                {target === 'deltaT' && 'Spreizung ΔT'}
              </div>

              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono tabular-nums">
                {target === 'flowRate' && (
                  <>
                    <span className="text-xl sm:text-2xl font-extrabold text-theme-accent">
                      <AnimatedNumber value={result.flowRateM3H} decimals={2} /> m³/h
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-theme-primary">
                      · <AnimatedNumber value={result.flowRateLMin} decimals={1} /> l/min
                    </span>
                    <span className="text-[11px] text-theme-secondary">
                      (<AnimatedNumber value={result.flowRateLH} decimals={0} /> l/h)
                    </span>
                  </>
                )}

                {target === 'power' && (
                  <>
                    <span className="text-xl sm:text-2xl font-extrabold text-theme-accent">
                      <AnimatedNumber value={result.powerKW} decimals={2} /> kW
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-theme-primary">
                      · <AnimatedNumber value={result.flowRateLMin} decimals={1} /> l/min
                    </span>
                  </>
                )}

                {target === 'deltaT' && (
                  <>
                    <span className="text-xl sm:text-2xl font-extrabold text-theme-accent">
                      <AnimatedNumber value={result.deltaTK} decimals={1} /> K
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-theme-primary">
                      · Rücklauf <AnimatedNumber value={result.returnTempC} decimals={1} /> °C
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Rechts: Empfohlene Rohrgröße (DN) */}
          {bestPipe && (
            <div className="px-3 py-2 sm:px-4 sm:py-2 rounded-2xl bg-[#DCCC4B] text-[#111111] gold-glow text-right shrink-0">
              <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                Rohr ({bestPipe.velocityMs.toFixed(2)} m/s)
              </div>
              <div className="text-xs sm:text-sm font-extrabold font-mono tabular-nums">
                {bestPipe.dnLabel}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
