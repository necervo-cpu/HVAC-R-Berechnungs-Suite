/**
 * Modul: Permanentes Ergebnis-Dock für Heiz- & Kühllast (MobileBottomBar)
 * Zweck: Zeigt die berechnete Heiz- bzw. Kälteleistung beim Scrollen dauerhaft am unteren Bildschirmrand
 * Sicherheitsrelevanz: Reine Anzeige-Komponente mit tabular-nums
 */

import React from 'react';
import { CalculationMode, CalculationResult } from '../types/hvac';
import { AnimatedNumber } from './AnimatedNumber';
import { Flame, Snowflake, ArrowUp } from 'lucide-react';

interface MobileBottomBarProps {
  mode: CalculationMode;
  results: CalculationResult;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({ mode, results }) => {
  const isHeat = mode === 'heating';

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <aside
      aria-label="Ergebnis-Schnellansicht am unteren Rand"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d10]/95 border-t border-[#DCCC4B]/35 backdrop-blur-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.85)] safe-area-bottom"
    >
      <div className="gold-divider" />
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 pt-2.5 pb-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#DCCC4B] flex items-center justify-center text-[#111111] gold-glow shrink-0">
              {isHeat ? (
                <Flame className="w-5 h-5 text-[#111111]" />
              ) : (
                <Snowflake className="w-5 h-5 text-[#111111]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-xs uppercase font-bold text-[#9a9999] tracking-wider truncate">
                {isHeat ? 'Norm-Gesamtheizlast (Q̇_H)' : 'Auslegungs-Kälteleistung (Q̇_0)'}
              </div>
              <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
                <span className="text-xl sm:text-2xl font-extrabold text-[#DCCC4B]">
                  <AnimatedNumber value={results.effectiveMachineryKW} decimals={2} />
                </span>
                <span className="text-xs sm:text-sm font-bold text-white">kW</span>
                <span className="text-xs text-[#9a9999] ml-1">
                  (<AnimatedNumber value={results.qSpecificPerM2} decimals={0} /> W/m²)
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="px-3 py-2 rounded-xl logbook-well text-[#DCCC4B] active:scale-[0.94] apple-spring flex items-center gap-1.5 text-xs font-bold shrink-0"
            aria-label="Nach oben scrollen"
          >
            <ArrowUp className="w-4 h-4" />
            <span className="hidden sm:inline">Nach oben</span>
          </button>
        </div>

        {/* Zusatzzeile mit den Teil-Lasten */}
        <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-3 gap-2 text-[11px] font-mono tabular-nums">
          <div className="truncate">
            <span className="text-[#9a9999]">Transm.: </span>
            <span className="text-white font-bold">
              <AnimatedNumber value={results.qTransmissionWatts} decimals={0} /> W
            </span>
          </div>
          <div className="truncate">
            <span className="text-[#9a9999]">Lüftung: </span>
            <span className="text-white font-bold">
              <AnimatedNumber value={results.qVentilationWatts} decimals={0} /> W
            </span>
          </div>
          <div className="truncate">
            <span className="text-[#9a9999]">ΔT: </span>
            <span className="text-white font-bold">
              <AnimatedNumber value={results.deltaT} decimals={1} /> K
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
