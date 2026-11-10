/**
 * Modul: Lüftung & Personenlast (VentilationInputs)
 * Zweck: Erfasst Luftwechselrate und Personenwärme ohne störende 0-Blockade oder Beispiel-Buttons
 * Sicherheitsrelevanz: Kontrollierte Eingaben über NumberInput
 */

import React from 'react';
import { VentilationData } from '../types/hvac';
import { NumberInput } from './NumberInput';
import { Wind, Users } from 'lucide-react';

interface VentilationInputsProps {
  data: VentilationData;
  onChange: (data: VentilationData) => void;
}

export const VentilationInputs: React.FC<VentilationInputsProps> = ({ data, onChange }) => {
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-[#DCCC4B]/10 text-[#DCCC4B]">
          <Wind className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-bold text-white">
          3. Lüftung & Personen
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#111111] rounded-2xl border border-white/5 p-4">
          <label htmlFor="vent-rate" className="block text-xs font-semibold text-[#9a9999] mb-2">
            Luftwechselrate n (1/h)
          </label>
          <NumberInput
            id="vent-rate"
            value={data.airChangeRate}
            min={0}
            placeholder="0,5"
            onChange={(val) => onChange({ ...data, airChangeRate: val })}
            className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-base font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#DCCC4B] min-h-[44px]"
          />
          <span className="text-[11px] text-[#9a9999] block mt-1.5">
            Wie oft das Raumvolumen pro Stunde getauscht wird
          </span>
        </div>

        <div className="bg-[#111111] rounded-2xl border border-white/5 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#9a9999] mb-2">
            <Users className="w-3.5 h-3.5 text-[#f0e68c]" />
            <span>Personen im Raum</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <NumberInput
                value={data.peopleCount}
                min={0}
                placeholder="0"
                ariaLabel="Anzahl Personen"
                onChange={(val) => onChange({ ...data, peopleCount: val })}
                className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#DCCC4B] min-h-[44px]"
              />
              <span className="text-[11px] text-[#9a9999] block mt-1">Anzahl</span>
            </div>
            <div>
              <NumberInput
                value={data.heatPerPersonWatt}
                min={0}
                placeholder="90"
                ariaLabel="Wärmeabgabe pro Person in Watt"
                onChange={(val) => onChange({ ...data, heatPerPersonWatt: val })}
                className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#DCCC4B] min-h-[44px]"
              />
              <span className="text-[11px] text-[#9a9999] block mt-1">Watt / Person</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
