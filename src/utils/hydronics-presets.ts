/**
 * Modul: Hydronik-Standardwerte
 * Zweck: Definiert die Startwerte beim Öffnen oder Zurücksetzen des Hydronik-Rechners
 * Sicherheitsrelevanz: Reine statische Konfigurationsdaten
 */

import { HydronicInputs } from '../types/hydronics';

export const initialHydronicInputs: HydronicInputs = {
  target: 'flowRate',
  mode: 'heating',
  fluidType: 'water',
  glycolPercent: 30,
  supplyTempC: 35,
  returnTempC: 28,
  powerKW: 12.5,
  flowRateM3H: 1.54,
};
