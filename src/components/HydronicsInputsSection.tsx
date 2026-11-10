/**
 * Modul: Abgespecktes, praxisgerechtes Hydronik-Eingabeformular (HydronicsInputsSection)
 * Zweck: Konzentriert alle relevanten Eingaben (Zielgröße, Leistung/Volumenstrom, Temperaturen, Wasser/Frostschutz) in einer klaren Karte
 * Sicherheitsrelevanz: Nutzt NumberInput für reibungslose Zahleneingabe ohne NaN/0-Blockade
 */

import React from 'react';
import { HydronicInputs, HydronicTarget } from '../types/hydronics';
import { NumberInput } from './NumberInput';
import { Droplets, Zap, Thermometer, ShieldCheck } from 'lucide-react';

const TARGET_OPTIONS: ReadonlyArray<{
  id: HydronicTarget;
  shortLabel: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'flowRate', shortLabel: 'Volumen', label: 'Volumenstrom', icon: Droplets },
  { id: 'power', shortLabel: 'Leistung', label: 'Leistung', icon: Zap },
  { id: 'deltaT', shortLabel: 'Spreizung', label: 'Spreizung ΔT', icon: Thermometer },
];

interface HydronicsInputsSectionProps {
  inputs: HydronicInputs;
  freezingPointC: number;
  onUpdateField: <K extends keyof HydronicInputs>(key: K, value: HydronicInputs[K]) => void;
}

interface FieldBlockProps {
  id: string;
  label: string;
  sub?: string;
  unit: string;
  value: number;
  min?: number;
  placeholder: string;
  onChange: (v: number) => void;
}

const FieldBlock: React.FC<FieldBlockProps> = ({
  id,
  label,
  sub,
  unit,
  value,
  min,
  placeholder,
  onChange,
}) => (
  <div>
    <div className="flex items-baseline justify-between mb-1.5">
      <label htmlFor={id} className="text-sm font-bold text-theme-primary">
        {label}
      </label>
      {sub && <span className="text-xs font-mono text-theme-accent">{sub}</span>}
    </div>
    <div className="relative flex items-center">
      <NumberInput
        id={id}
        value={value}
        min={min}
        placeholder={placeholder}
        onChange={onChange}
        className="w-full px-3.5 py-3 logbook-input rounded-2xl font-mono text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#DCCC4B] pr-14 min-h-[48px]"
      />
      <span className="absolute right-3.5 text-xs font-mono font-bold text-theme-secondary pointer-events-none">
        {unit}
      </span>
    </div>
  </div>
);

export const HydronicsInputsSection: React.FC<HydronicsInputsSectionProps> = ({
  inputs,
  freezingPointC,
  onUpdateField,
}) => {
  const activeTargetIndex = Math.max(0, TARGET_OPTIONS.findIndex((t) => t.id === inputs.target));
  const hasGlycol = inputs.fluidType !== 'water';

  const toggleGlycol = () => {
    onUpdateField('fluidType', hasGlycol ? 'water' : 'propylene-glycol');
  };

  return (
    <section aria-label="Hydronik-Eingaben" className="space-y-4">
      {/* 1. Kompakte Auswahl: Was wird gesucht? */}
      <div className="logbook-card rounded-2xl sm:rounded-3xl p-3.5 sm:p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-theme-secondary mb-2 px-0.5">
          Gesuchte Größe
        </div>
        <div className="relative grid grid-cols-3 p-1 logbook-well rounded-xl">
          <span
            aria-hidden="true"
            style={{ transform: `translateX(${activeTargetIndex * 100}%)` }}
            className="pill-slider pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/3)] rounded-lg bg-[#DCCC4B] gold-glow"
          />
          {TARGET_OPTIONS.map((item) => {
            const Icon = item.icon;
            const active = inputs.target === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onUpdateField('target', item.id)}
                className={`relative z-10 flex items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-lg text-xs font-bold apple-spring active:scale-[0.97] min-h-[42px] min-w-0 ${
                  active ? 'text-[#111111]' : 'text-theme-secondary'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="sm:hidden truncate">{item.shortLabel}</span>
                <span className="hidden sm:inline truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Relevante Praxiseingaben in einer aufgeräumten Karte */}
      <div className="logbook-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4">
        {inputs.target !== 'power' && (
          <FieldBlock
            id="hyd-power"
            label="Leistung"
            sub="Heizen / Kühlen"
            unit="kW"
            value={inputs.powerKW}
            min={0}
            placeholder="12,5"
            onChange={(val) => onUpdateField('powerKW', val)}
          />
        )}

        {inputs.target !== 'flowRate' && (
          <FieldBlock
            id="hyd-flow"
            label="Volumenstrom"
            sub={`${(inputs.flowRateM3H * 1000).toFixed(0)} l/h`}
            unit="m³/h"
            value={inputs.flowRateM3H}
            min={0}
            placeholder="1,54"
            onChange={(val) => onUpdateField('flowRateM3H', val)}
          />
        )}

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
          <FieldBlock
            id="hyd-supply"
            label="Vorlauf"
            unit="°C"
            value={inputs.supplyTempC}
            placeholder="35"
            onChange={(val) => onUpdateField('supplyTempC', val)}
          />

          {inputs.target !== 'deltaT' ? (
            <FieldBlock
              id="hyd-return"
              label="Rücklauf"
              sub={`ΔT ${Math.abs(inputs.supplyTempC - inputs.returnTempC).toFixed(1)} K`}
              unit="°C"
              value={inputs.returnTempC}
              placeholder="28"
              onChange={(val) => onUpdateField('returnTempC', val)}
            />
          ) : (
            <div className="flex flex-col justify-end pb-1">
              <div className="p-3 rounded-2xl logbook-well text-xs text-theme-secondary">
                Spreizung ΔT & Rücklauf werden unten live berechnet.
              </div>
            </div>
          )}
        </div>

        {/* 3. Kompakter Schalter: Wasser / Frostschutz (Glykol) */}
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-theme-secondary flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#DCCC4B] shrink-0" />
              <span>Medium</span>
            </span>

            <div className="inline-grid grid-cols-2 p-1 logbook-well rounded-xl">
              <button
                type="button"
                onClick={() => onUpdateField('fluidType', 'water')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold apple-spring active:scale-[0.97] ${
                  !hasGlycol ? 'bg-[#DCCC4B] text-[#111111] gold-glow' : 'text-theme-secondary'
                }`}
              >
                Wasser
              </button>
              <button
                type="button"
                onClick={toggleGlycol}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold apple-spring active:scale-[0.97] ${
                  hasGlycol ? 'bg-[#DCCC4B] text-[#111111] gold-glow' : 'text-theme-secondary'
                }`}
              >
                Frostschutz
              </button>
            </div>
          </div>

          <div className={`collapse-grid ${hasGlycol ? 'is-open' : ''}`}>
            <div className="collapse-inner">
              <div className="p-3.5 mt-3 logbook-well rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="glycol-slider" className="text-theme-secondary font-semibold">
                    Glykol-Anteil
                  </label>
                  <span className="font-mono font-bold text-theme-accent tabular-nums">
                    {inputs.glycolPercent} % (Frostschutz bis {freezingPointC.toFixed(1)} °C)
                  </span>
                </div>
                <input
                  id="glycol-slider"
                  type="range"
                  min="20"
                  max="50"
                  step="5"
                  value={inputs.glycolPercent}
                  onChange={(e) => onUpdateField('glycolPercent', parseInt(e.target.value, 10) || 30)}
                  className="w-full accent-[#DCCC4B] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
