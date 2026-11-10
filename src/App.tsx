/**
 * Modul: Hauptanwendung (HVAC-R Praxisrechner)
 * Zweck: Startet direkt im Hydronik-Rechner und verwaltet den Hell-/Dunkel-Modus (Dark / Light Theme)
 * Sicherheitsrelevanz: Vollständig lokale Ausführung im Browser ohne Übertragung von Anlagendaten
 */

import React, { useState, useEffect } from 'react';
import { ActiveToolId } from './types/hydronics';
import { Header } from './components/Header';
import { ToolHub } from './components/ToolHub';
import { HydronicsCalculator } from './components/HydronicsCalculator';
import { HeatLoadCalculator } from './components/HeatLoadCalculator';

export const App: React.FC = () => {
  // Startet direkt im Hydronik-Rechner (Volumenstrom, Leistung & Spreizung)
  const [activeTool, setActiveTool] = useState<ActiveToolId>('hydronics');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    const metaTheme = document.getElementById('meta-theme-color');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'light' ? '#f5f4ef' : '#0a0a0c');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="relative min-h-dvh flex flex-col font-sans selection:bg-[#DCCC4B]/30 selection:text-[#DCCC4B] overflow-x-hidden">
      {/* Atmosphärische Hintergrund-Lichtquellen (im Dark Mode kräftiger, im Light Mode subtil) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className={`absolute -top-24 left-[-10%] w-[75vw] h-[320px] rounded-full transition-opacity duration-300 ${
            theme === 'dark' ? 'opacity-90' : 'opacity-45'
          }`}
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(220, 204, 75, 0.18) 0%, rgba(220, 204, 75, 0.05) 45%, transparent 75%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className={`absolute top-[28%] right-[-18%] w-[340px] h-[340px] rounded-full transition-opacity duration-300 ${
            theme === 'dark' ? 'opacity-75' : 'opacity-25'
          }`}
          style={{
            background:
              'radial-gradient(circle at center, rgba(59, 92, 196, 0.14) 0%, transparent 72%)',
            filter: 'blur(50px)',
          }}
        />
      </div>

      <Header
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-3.5 py-4 sm:p-6">
        {activeTool === 'hydronics' && <HydronicsCalculator />}
        {activeTool === 'heat-load' && <HeatLoadCalculator />}
        {activeTool === 'hub' && <ToolHub onSelectTool={setActiveTool} />}
      </main>
    </div>
  );
};
