/**
 * Modul: Kältetechnik & Kühlgut (CoolingSpecificInputs)
 * Zweck: Erfasst Warenabkühlung, Beleuchtung, Ventilatoren und Verdichterlaufzeit ohne störende 0-Blockade
 * Sicherheitsrelevanz: Kontrollierte Eingaben über NumberInput
 */

import React from 'react';
import { CoolingSpecificData } from '../types/hvac';
import { NumberInput } from './NumberInput';
import { Package, Lightbulb, Fan, Clock } from 'lucide-react';

interface CoolingSpecificInputsProps {
  data: CoolingSpecificData;
  onChange: (data: CoolingSpecificData) => void;
}

export const CoolingSpecificInputs: React.FC<CoolingSpecificInputsProps> = ({
  data,
  onChange,
}) => {
  return (
    <div className="bg-[#1a1a1a] border border-[#DCCC4B]/30 rounded-3xl p-5 sm:p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-[#DCCC4B]/10 text-[#DCCC4B]">
          <Package className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-bold text-white">
          4. Kühlgut & Laufzeiten
        </h2>
      </div>

      {/* Warenabkühlung */}
      <div className="p-4 bg-[#111111] rounded-2xl border border-white/5 mb-4">
        <div className="mb-3">
          <span className="text-xs font-semibold text-white">Täglicher Wareneinschub</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#9a9999] mb-1">
              Masse (kg/Tag)
            </label>
            <NumberInput
              value={data.goodsMassKg}
              min={0}
              placeholder="250"
              ariaLabel="Warenmasse in kg pro Tag"
              onChange={(val) => onChange({ ...data, goodsMassKg: val })}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#DCCC4B] min-h-[40px]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#9a9999] mb-1">
              Eintrittstemp. (°C)
            </label>
            <NumberInput
              value={data.goodsEntryTemp}
              placeholder="18"
              ariaLabel="Wareneintrittstemperatur"
              onChange={(val) => onChange({ ...data, goodsEntryTemp: val })}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#DCCC4B] min-h-[40px]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#9a9999] mb-1">
              Wärmekap. c (kJ/kgK)
            </label>
            <NumberInput
              value={data.goodsSpecificHeatKJ}
              min={0.5}
              placeholder="3,2"
              ariaLabel="Spezifische Wärmekapazität der Ware"
              onChange={(val) => onChange({ ...data, goodsSpecificHeatKJ: val })}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#DCCC4B] min-h-[40px]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#9a9999] mb-1">
              Abkühlzeit (h)
            </label>
            <NumberInput
              value={data.coolingDurationHours}
              min={1}
              max={24}
              placeholder="16"
              ariaLabel="Abkühlzeit in Stunden"
              onChange={(val) => onChange({ ...data, coolingDurationHours: val })}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#DCCC4B] min-h-[40px]"
            />
          </div>
        </div>
      </div>

      {/* Interne Lasten & Maschinenlaufzeit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-[#111111] rounded-2xl border border-white/5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-2">
            <Lightbulb className="w-3.5 h-3.5 text-[#DCCC4B]" />
            <span>Beleuchtung</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-[#9a9999] font-medium">Watt</label>
              <NumberInput
                value={data.lightingWatts}
                min={0}
                ariaLabel="Beleuchtungsleistung in Watt"
                onChange={(val) => onChange({ ...data, lightingWatts: val })}
                className="w-full px-2.5 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-xs font-mono font-bold text-white focus:outline-none min-h-[38px]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#9a9999] font-medium">h/Tag</label>
              <NumberInput
                value={data.lightingHours}
                min={0}
                max={24}
                ariaLabel="Beleuchtungsdauer pro Tag"
                onChange={(val) => onChange({ ...data, lightingHours: val })}
                className="w-full px-2.5 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-xs font-mono font-bold text-white focus:outline-none min-h-[38px]"
              />
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-[#111111] rounded-2xl border border-white/5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-2">
            <Fan className="w-3.5 h-3.5 text-[#f0e68c]" />
            <span>Ventilatoren</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-[#9a9999] font-medium">Watt</label>
              <NumberInput
                value={data.fanPowerWatts}
                min={0}
                ariaLabel="Ventilatorleistung in Watt"
                onChange={(val) => onChange({ ...data, fanPowerWatts: val })}
                className="w-full px-2.5 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-xs font-mono font-bold text-white focus:outline-none min-h-[38px]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#9a9999] font-medium">h/Tag</label>
              <NumberInput
                value={data.fanHours}
                min={0}
                max={24}
                ariaLabel="Ventilatorlaufzeit pro Tag"
                onChange={(val) => onChange({ ...data, fanHours: val })}
                className="w-full px-2.5 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-xs font-mono font-bold text-white focus:outline-none min-h-[38px]"
              />
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-[#111111] rounded-2xl border border-white/5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-2">
            <Clock className="w-3.5 h-3.5 text-[#DCCC4B]" />
            <span>Verdichterlauf</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-[#9a9999] font-medium">Laufzeit h</label>
              <NumberInput
                value={data.compressorRunHours}
                min={4}
                max={24}
                ariaLabel="Tägliche Verdichterlaufzeit"
                onChange={(val) => onChange({ ...data, compressorRunHours: val })}
                className="w-full px-2.5 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-xs font-mono font-bold text-white focus:outline-none min-h-[38px]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#9a9999] font-medium">Sicherh. %</label>
              <NumberInput
                value={data.safetyMarginPercent}
                min={0}
                max={30}
                ariaLabel="Sicherheitszuschlag in Prozent"
                onChange={(val) => onChange({ ...data, safetyMarginPercent: val })}
                className="w-full px-2.5 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-xs font-mono font-bold text-white focus:outline-none min-h-[38px]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
