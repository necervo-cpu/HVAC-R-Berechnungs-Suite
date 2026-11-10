/**
 * Modul: Interaktive Rohrströmungs- & Temperaturspreizungs-Visualisierung (PipeFlowVisualizer)
 * Zweck: Veranschaulicht Vorlauf-/Rücklauftemperatur, Strömungsgeschwindigkeit und empfohlene Nennweite in Echtzeit
 * Sicherheitsrelevanz: Reine SVG-Darstellung mit begrenzten Animationsgeschwindigkeiten
 */

import React from 'react';
import { HydronicMode, HydronicResult } from '../types/hydronics';

interface PipeFlowVisualizerProps {
  mode: HydronicMode;
  result: HydronicResult;
}

export const PipeFlowVisualizer: React.FC<PipeFlowVisualizerProps> = ({ mode, result }) => {
  const bestPipe = result.recommendedPipes.find((p) => p.status === 'optimal') || result.recommendedPipes[0];
  const velocity = bestPipe ? bestPipe.velocityMs : 0.75;

  const flowDurationSec =
    result.flowRateM3H <= 0.01
      ? 0
      : Math.min(2.6, Math.max(0.4, 1.1 / Math.max(0.2, velocity)));

  const isHeating = mode === 'heating';
  const supplyColor = isHeating ? '#EA580C' : '#0284C7';
  const returnColor = isHeating ? '#DCCC4B' : '#38BDF8';

  return (
    <div className="logbook-card rounded-3xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-bold text-white">
          Strömungs- & Spreizungs-Monitor
        </span>
        <span className="font-mono text-[#DCCC4B] tabular-nums">
          {bestPipe ? `${bestPipe.dnLabel} · v = ${bestPipe.velocityMs.toFixed(2)} m/s` : 'Kein Standardrohr'}
        </span>
      </div>

      {/* Animierter Rohrquerschnitt (SVG) */}
      <div className="relative logbook-well rounded-2xl p-3.5 overflow-hidden">
        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
              style={{ backgroundColor: supplyColor }}
            />
            <span className="text-[#9a9999]">VL:</span>
            <span className="font-bold text-white">{result.supplyTempC.toFixed(1)} °C</span>
          </div>

          <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#DCCC4B] font-bold">
            ΔT = {result.deltaTK.toFixed(1)} K
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#9a9999]">RL:</span>
            <span className="font-bold text-white">{result.returnTempC.toFixed(1)} °C</span>
            <span
              className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
              style={{ backgroundColor: returnColor }}
            />
          </div>
        </div>

        <svg
          viewBox="0 0 360 44"
          className="w-full h-11 block"
          role="img"
          aria-label="Rohrströmung von Vorlauf zu Rücklauf"
        >
          <defs>
            <linearGradient id="pipeThermalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={supplyColor} stopOpacity="0.85" />
              <stop offset="50%" stopColor="#DCCC4B" stopOpacity="0.75" />
              <stop offset="100%" stopColor={returnColor} stopOpacity="0.85" />
            </linearGradient>
          </defs>

          <rect
            x="4"
            y="6"
            width="352"
            height="32"
            rx="16"
            fill="#141417"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.5"
          />

          <rect
            x="8"
            y="10"
            width="344"
            height="24"
            rx="12"
            fill="url(#pipeThermalGrad)"
            opacity="0.28"
          />

          {flowDurationSec > 0 && (
            <g
              style={{ '--flow-duration': `${flowDurationSec.toFixed(2)}s` } as React.CSSProperties}
            >
              <line
                x1="16"
                y1="17"
                x2="344"
                y2="17"
                stroke="url(#pipeThermalGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="pipe-flow-line"
              />
              <line
                x1="16"
                y1="27"
                x2="344"
                y2="27"
                stroke="#ffffff"
                strokeOpacity="0.7"
                strokeWidth="2"
                strokeLinecap="round"
                className="pipe-flow-line"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
