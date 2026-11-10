/**
 * Modul: Dezimale Zahleneingabe ohne "0"-Blockade (NumberInput)
 * Zweck: Erlaubt vollständiges Löschen des Eingabefelds sowie Komma- und Punkt-Eingabe auf Mobile/Desktop
 * Sicherheitsrelevanz: Bereinigt Eingaben auf gültige Dezimalzahlen und verhindert NaN-Weitergabe
 */

import React, { useState, useEffect } from 'react';

interface NumberInputProps {
  id?: string;
  value: number;
  onChange: (num: number) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | string;
  className?: string;
  ariaLabel?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  id,
  value,
  onChange,
  placeholder = '0',
  min,
  max,
  step,
  className = '',
  ariaLabel,
}) => {
  const [rawText, setRawText] = useState<string>(() => String(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Synchronisiere Anzeige, wenn sich der Wert von außen ändert (z. B. durch Reset-Button)
  useEffect(() => {
    if (!isFocused) {
      setRawText(Number.isFinite(value) ? String(value) : '');
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    setRawText(inputVal);

    const normalized = inputVal.replace(',', '.').trim();
    if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') {
      onChange(0);
      return;
    }

    const parsed = parseFloat(normalized);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      onChange(parsed);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Markiert den gesamten Wert beim Antippen, damit man sofort darüber tippen kann
    e.target.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    const normalized = rawText.replace(',', '.').trim();
    const parsed = parseFloat(normalized);

    if (normalized === '' || Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      const fallback = min !== undefined && min > 0 ? min : 0;
      setRawText(String(fallback));
      onChange(fallback);
      return;
    }

    let clamped = parsed;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;

    setRawText(String(clamped));
    if (clamped !== value) {
      onChange(clamped);
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      step={step}
      value={rawText}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
    />
  );
};
