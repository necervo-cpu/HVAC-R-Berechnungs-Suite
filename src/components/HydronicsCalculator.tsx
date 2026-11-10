/**
 * Modul: Hydronik-Rechner (Volumenstrom, Heiz-/Kühlleistung & Spreizung)
 * Zweck: Schlanke, praxisgerechte Ein-Spalten-Ansicht mit permanentem Ergebnis-Dock am unteren Rand
 * Sicherheitsrelevanz: Validierte numerische Eingaben mit Fallback-Schutz vor NaN/Infinity
 */

import React, { useState, useMemo } from 'react';
import { HydronicInputs } from '../types/hydronics';
import { calculateHydronics } from '../utils/hydronics-math';
import { initialHydronicInputs } from '../utils/hydronics-presets';
import { HydronicsInputsSection } from './HydronicsInputsSection';
import { HydronicsBottomSheet } from './HydronicsBottomSheet';
import { RotateCcw } from 'lucide-react';

export const HydronicsCalculator: React.FC = () => {
  const [inputs, setInputs] = useState<HydronicInputs>(initialHydronicInputs);

  const result = useMemo(() => calculateHydronics(inputs), [inputs]);

  const updateField = <K extends keyof HydronicInputs>(key: K, value: HydronicInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="view-enter max-w-xl mx-auto space-y-4 pb-32">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-theme-primary tracking-tight">
            Volumenstrom, Leistung & ΔT
          </h2>
          <p className="text-xs text-theme-secondary">
            Hydronik-Schnellrechner für Vor-Ort-Einsatz
          </p>
        </div>

        <button
          type="button"
          onClick={() => setInputs(initialHydronicInputs)}
          className="px-3 py-2 rounded-xl logbook-card text-theme-primary active:scale-[0.96] apple-spring flex items-center gap-1.5 text-xs font-bold shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#DCCC4B] shrink-0" />
          <span>Reset</span>
        </button>
      </div>

      <HydronicsInputsSection
        inputs={inputs}
        freezingPointC={result.freezingPointC}
        onUpdateField={updateField}
      />

      {/* Permanentes, abgespecktes Live-Ergebnis-Dock am unteren Bildschirmrand */}
      <HydronicsBottomSheet target={inputs.target} result={result} />
    </div>
  );
};
