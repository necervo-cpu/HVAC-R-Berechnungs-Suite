/**
 * Modul: Gebäudehülle & U-Werte (BuildingEnvelopeInputs)
 * Zweck: Erfasst Bauteilflächen, U-Werte und Temperaturfaktoren ohne störende 0-Blockade
 * Sicherheitsrelevanz: Kontrollierte Eingaben über NumberInput
 */

import React from 'react';
import { EnvelopeSurface, CalculationMode } from '../types/hvac';
import { NumberInput } from './NumberInput';
import { Layers, Plus, Trash2 } from 'lucide-react';

interface BuildingEnvelopeInputsProps {
  mode: CalculationMode;
  surfaces: EnvelopeSurface[];
  onSurfacesChange: (surfaces: EnvelopeSurface[]) => void;
}

export const BuildingEnvelopeInputs: React.FC<BuildingEnvelopeInputsProps> = ({
  mode,
  surfaces,
  onSurfacesChange,
}) => {
  const handleUpdate = (id: string, field: keyof EnvelopeSurface, value: number | string) => {
    const updated = surfaces.map((s) => {
      if (s.id !== id) return s;
      if (field === 'name') return { ...s, name: String(value) };
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      return { ...s, [field]: Number.isNaN(num) ? 0 : num };
    });
    onSurfacesChange(updated);
  };

  const handleAddSurface = () => {
    const newSurface: EnvelopeSurface = {
      id: `custom-${Date.now()}`,
      name: 'Zusatzfläche / Wand',
      area: 10,
      uValue: mode === 'cooling' ? 0.24 : 0.28,
      tempFactor: 1.0,
    };
    onSurfacesChange([...surfaces, newSurface]);
  };

  const handleRemove = (id: string) => {
    onSurfacesChange(surfaces.filter((s) => s.id !== id));
  };

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#DCCC4B]/10 text-[#DCCC4B]">
            <Layers className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-white">
            2. Bauteile & U-Werte
          </h2>
        </div>
      </div>

      {/* Spaltenüberschriften für Desktop */}
      <div className="hidden sm:grid grid-cols-12 gap-2 px-3 pb-2 text-[11px] font-semibold text-[#9a9999]">
        <div className="col-span-5">Bauteil</div>
        <div className="col-span-2 text-center">Fläche (m²)</div>
        <div className="col-span-2 text-center">U-Wert</div>
        <div className="col-span-2">Lage (f_x)</div>
        <div className="col-span-1" />
      </div>

      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {surfaces.map((s) => (
          <div
            key={s.id}
            className="grid grid-cols-12 gap-2 items-center p-3 bg-[#111111] border border-white/5 rounded-2xl text-xs"
          >
            <div className="col-span-12 sm:col-span-5">
              <input
                type="text"
                value={s.name}
                aria-label="Bauteilbezeichnung"
                onChange={(e) => handleUpdate(s.id, 'name', e.target.value)}
                className="w-full bg-transparent border-b border-transparent focus:border-[#DCCC4B] focus:outline-none text-white font-semibold py-1 px-1"
              />
            </div>

            <div className="col-span-4 sm:col-span-2">
              <label className="text-[10px] text-[#9a9999] block sm:hidden font-medium mb-0.5">
                Fläche (m²)
              </label>
              <NumberInput
                value={s.area}
                min={0}
                placeholder="m²"
                ariaLabel={`Fläche für ${s.name}`}
                onChange={(val) => handleUpdate(s.id, 'area', val)}
                className="w-full px-2.5 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-white font-mono font-bold tabular-nums text-center focus:ring-2 focus:ring-[#DCCC4B] focus:outline-none min-h-[38px]"
              />
            </div>

            <div className="col-span-4 sm:col-span-2">
              <label className="text-[10px] text-[#9a9999] block sm:hidden font-medium mb-0.5">
                U-Wert
              </label>
              <NumberInput
                value={s.uValue}
                min={0}
                placeholder="U-Wert"
                ariaLabel={`U-Wert für ${s.name}`}
                onChange={(val) => handleUpdate(s.id, 'uValue', val)}
                className="w-full px-2.5 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-white font-mono font-bold tabular-nums text-center focus:ring-2 focus:ring-[#DCCC4B] focus:outline-none min-h-[38px]"
              />
            </div>

            <div className="col-span-3 sm:col-span-2">
              <label className="text-[10px] text-[#9a9999] block sm:hidden font-medium mb-0.5">
                Lage
              </label>
              <select
                aria-label={`Temperaturfaktor für ${s.name}`}
                value={s.tempFactor}
                onChange={(e) => handleUpdate(s.id, 'tempFactor', parseFloat(e.target.value))}
                className="w-full px-2 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-[11px] text-[#9a9999] focus:outline-none min-h-[38px]"
              >
                <option value={1.0}>1,0 Außen</option>
                <option value={0.7}>0,7 Keller</option>
                <option value={0.6}>0,6 Boden</option>
                <option value={0.5}>0,5 Innen</option>
              </select>
            </div>

            <div className="col-span-1 flex justify-end">
              <button
                type="button"
                onClick={() => handleRemove(s.id)}
                className="p-2 text-[#9a9999] hover:text-red-400 rounded-xl active:scale-95"
                title="Bauteil entfernen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddSurface}
        className="mt-4 w-full py-3 flex items-center justify-center gap-2 text-xs font-semibold text-[#DCCC4B] bg-[#111111] border border-dashed border-[#DCCC4B]/30 rounded-2xl active:scale-[0.98] apple-spring min-h-[44px]"
      >
        <Plus className="w-4 h-4" />
        <span>Weitere Fläche hinzufügen</span>
      </button>
    </div>
  );
};
