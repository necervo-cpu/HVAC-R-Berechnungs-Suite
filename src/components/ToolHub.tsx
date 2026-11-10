/**
 * Modul: Schlanke Rechner-Auswahl (ToolHub)
 * Zweck: Übersichtliche Schnellwahl der aktiven Praxisrechner ohne überladene Roadmap-Karten
 * Sicherheitsrelevanz: Reine Navigations-Komponente ohne externe Datenabfragen
 */

import React from 'react';
import { ActiveToolId } from '../types/hydronics';
import { Droplets, Flame, ChevronRight } from 'lucide-react';

interface ToolCardItem {
  id: ActiveToolId;
  category: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ACTIVE_TOOLS: ReadonlyArray<ToolCardItem> = [
  {
    id: 'hydronics',
    category: 'Hydronik & Rohrnetz',
    title: 'Volumenstrom, Leistung & Spreizung (ΔT)',
    description: 'Schnellberechnung von m³/h, l/min, kW, ΔT und passender Rohrdimension (DN).',
    icon: Droplets,
  },
  {
    id: 'heat-load',
    category: 'Gebäude & Kühlraum',
    title: 'Heizlast & Kühlraum-Kälteleistung',
    description: 'Raumweise Transmissions-, Lüftungs- und Warenwärmeberechnung.',
    icon: Flame,
  },
];

interface ToolHubProps {
  onSelectTool: (tool: ActiveToolId) => void;
}

export const ToolHub: React.FC<ToolHubProps> = ({ onSelectTool }) => {
  return (
    <div className="view-enter max-w-xl mx-auto space-y-4 pb-12">
      <div className="px-0.5">
        <h2 className="text-lg sm:text-xl font-extrabold text-theme-primary tracking-tight">
          Verfügbare Praxisrechner
        </h2>
        <p className="text-xs text-theme-secondary">
          Wähle ein Werkzeug für den direkten Vor-Ort-Einsatz
        </p>
      </div>

      <div className="space-y-3">
        {ACTIVE_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              className="w-full text-left logbook-card rounded-2xl p-4 flex items-center justify-between gap-3.5 active:scale-[0.98] apple-spring"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#DCCC4B] text-[#111111] flex items-center justify-center shrink-0 gold-glow mt-0.5">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-theme-accent">
                    {tool.category}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-theme-primary truncate">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-theme-secondary mt-0.5 leading-relaxed">
                    {tool.description}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-theme-secondary shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
