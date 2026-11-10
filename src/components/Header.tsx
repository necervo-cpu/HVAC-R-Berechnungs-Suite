/**
 * Modul: Kompakte App-Kopfzeile mit Rechner-Umschalter & Hell-/Dunkel-Modus
 * Zweck: Ermöglicht schnellen Wechsel zwischen Hydronik, Heiz-/Kühllast und Übersicht sowie Theme-Wechsel (Sonne/Mond)
 * Sicherheitsrelevanz: Reine Navigations- und Darstellungs-Komponente
 */

import React from 'react';
import { ActiveToolId } from '../types/hydronics';
import { Droplets, Flame, LayoutGrid, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  activeTool: ActiveToolId;
  onSelectTool: (tool: ActiveToolId) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const NAV_ITEMS: ReadonlyArray<{
  id: ActiveToolId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'hydronics', label: 'Hydronik', icon: Droplets },
  { id: 'heat-load', label: 'Heiz-/Kühllast', icon: Flame },
  { id: 'hub', label: 'Rechner', icon: LayoutGrid },
];

export const Header: React.FC<HeaderProps> = ({
  activeTool,
  onSelectTool,
  theme,
  onToggleTheme,
}) => {
  const activeIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => item.id === activeTool)
  );

  return (
    <header className="sticky top-0 z-30 logbook-header safe-area-top">
      <div className="max-w-3xl mx-auto px-3.5 py-2.5 sm:px-6 flex items-center justify-between gap-2.5">
        {/* Links: App-Icon & Titel */}
        <button
          type="button"
          onClick={() => onSelectTool('hydronics')}
          className="flex items-center gap-2.5 text-left active:scale-[0.98] apple-spring min-w-0"
        >
          <div className="w-9 h-9 rounded-[10px] bg-[#DCCC4B] flex items-center justify-center text-[#111111] font-extrabold text-sm gold-glow shrink-0">
            <Droplets className="w-4 h-4 text-[#111111]" />
          </div>
          <div className="min-w-0 hidden xs:block sm:block">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-theme-primary truncate">
              HVAC-R Praxisrechner
            </h1>
          </div>
        </button>

        {/* Mitte/Rechts: Kompakte Rechner-Auswahl + Hell/Dunkel-Schalter */}
        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end min-w-0">
          <nav
            aria-label="Rechner-Auswahl"
            className="relative grid grid-cols-3 p-1 logbook-well rounded-xl flex-1 sm:w-80 max-w-[290px]"
          >
            <span
              aria-hidden="true"
              style={{
                transform: `translateX(${activeIndex * 100}%)`,
              }}
              className="pill-slider pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/3)] rounded-lg bg-[#DCCC4B] gold-glow"
            />

            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTool(item.id)}
                  className={`relative z-10 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold apple-spring active:scale-[0.97] min-w-0 min-h-[36px] ${
                    active ? 'text-[#111111]' : 'text-theme-secondary'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Hell / Dunkel Umschalter (wie der Mond-Button im Anlagenlogbuch-Screenshot) */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Hellen Modus aktivieren' : 'Dunklen Modus aktivieren'}
            title={theme === 'dark' ? 'Heller Modus (Baustelle / Sonne)' : 'Dunkler Modus (Technikraum)'}
            className="w-10 h-10 rounded-xl logbook-well flex items-center justify-center text-theme-primary active:scale-[0.94] apple-spring shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[#DCCC4B]" />
            ) : (
              <Moon className="w-4 h-4 text-[#141417]" />
            )}
          </button>
        </div>
      </div>

      <div className="gold-divider" />
    </header>
  );
};
