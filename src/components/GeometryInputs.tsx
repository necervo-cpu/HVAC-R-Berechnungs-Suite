/**
 * Modul: Raumgeometrie & Auslegungstemperaturen (GeometryInputs)
 * Zweck: Erfasst Raummaße (Länge, Breite, Höhe) und Außen-/Innentemperaturen ohne störende 0-Blockade
 * Sicherheitsrelevanz: Kontrollierte Zahleneingabe via NumberInput
 */

import React from 'react';
import { RoomGeometry, ThermalTemperatures, CalculationMode } from '../types/hvac';
import { NumberInput } from './NumberInput';
import { Box, ThermometerSun, ThermometerSnowflake } from 'lucide-react';

interface GeometryInputsProps {
  mode: CalculationMode;
  geometry: RoomGeometry;
  temperatures: ThermalTemperatures;
  onGeometryChange: (geom: RoomGeometry) => void;
  onTemperaturesChange: (temps: ThermalTemperatures) => void;
}

export const GeometryInputs: React.FC<GeometryInputsProps> = ({
  geometry,
  temperatures,
  onGeometryChange,
  onTemperaturesChange,
}) => {
  const area = (Number(geometry.length) || 0) * (Number(geometry.width) || 0);
  const volume = area * (Number(geometry.height) || 0);

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-[#DCCC4B]/10 text-[#DCCC4B]">
          <Box className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-bold text-white">
          1. Raummaße & Temperaturen
        </h2>
      </div>

      {/* Raumgeometrie */}
      <div className="bg-[#111111] rounded-2xl border border-white/5 p-4 mb-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="geom-length" className="block text-xs font-semibold text-[#9a9999] mb-1.5">
              Länge (m)
            </label>
            <NumberInput
              id="geom-length"
              value={geometry.length}
              min={0}
              placeholder="6,0"
              onChange={(val) => onGeometryChange({ ...geometry, length: val })}
              className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#DCCC4B] min-h-[44px]"
            />
          </div>

          <div>
            <label htmlFor="geom-width" className="block text-xs font-semibold text-[#9a9999] mb-1.5">
              Breite (m)
            </label>
            <NumberInput
              id="geom-width"
              value={geometry.width}
              min={0}
              placeholder="4,0"
              onChange={(val) => onGeometryChange({ ...geometry, width: val })}
              className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#DCCC4B] min-h-[44px]"
            />
          </div>

          <div>
            <label htmlFor="geom-height" className="block text-xs font-semibold text-[#9a9999] mb-1.5">
              Höhe (m)
            </label>
            <NumberInput
              id="geom-height"
              value={geometry.height}
              min={0}
              placeholder="2,8"
              onChange={(val) => onGeometryChange({ ...geometry, height: val })}
              className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#DCCC4B] min-h-[44px]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-xs font-mono">
          <div>
            <span className="text-[#9a9999]">Grundfläche: </span>
            <span className="text-white font-bold tabular-nums">{area.toFixed(1)} m²</span>
          </div>
          <div>
            <span className="text-[#9a9999]">Raumvolumen: </span>
            <span className="text-white font-bold tabular-nums">{volume.toFixed(1)} m³</span>
          </div>
        </div>
      </div>

      {/* Temperaturen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-[#111111] rounded-2xl border border-white/5 p-4">
          <label htmlFor="temp-outside" className="flex items-center gap-1.5 text-xs font-semibold text-[#9a9999] mb-2">
            <ThermometerSun className="w-3.5 h-3.5 text-[#DCCC4B]" />
            <span>Außentemperatur (°C)</span>
          </label>
          <NumberInput
            id="temp-outside"
            value={temperatures.outsideTemp}
            placeholder="-12"
            onChange={(val) => onTemperaturesChange({ ...temperatures, outsideTemp: val })}
            className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-base font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#DCCC4B] min-h-[44px]"
          />
        </div>

        <div className="bg-[#111111] rounded-2xl border border-white/5 p-4">
          <label htmlFor="temp-inside" className="flex items-center gap-1.5 text-xs font-semibold text-[#9a9999] mb-2">
            <ThermometerSnowflake className="w-3.5 h-3.5 text-[#f0e68c]" />
            <span>Raum-Solltemperatur (°C)</span>
          </label>
          <NumberInput
            id="temp-inside"
            value={temperatures.insideTemp}
            placeholder="20"
            onChange={(val) => onTemperaturesChange({ ...temperatures, insideTemp: val })}
            className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-base font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#DCCC4B] min-h-[44px]"
          />
        </div>
      </div>
    </div>
  );
};
