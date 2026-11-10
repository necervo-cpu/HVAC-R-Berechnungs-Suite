/**
 * Modul: Flüssige Zahlen-Interpolation (AnimatedNumber)
 * Zweck: Interpoliert numerische Ergebnisse über 220ms mit Ease-Out-Kurve und tabular-nums
 * Sicherheitsrelevanz: Fängt NaN/Infinity ab und respektiert prefers-reduced-motion
 */

import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 2,
  className = '',
}) => {
  const safeTarget = Number.isFinite(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState<number>(safeTarget);
  const previousValueRef = useRef<number>(safeTarget);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplayValue(safeTarget);
      previousValueRef.current = safeTarget;
      return;
    }

    const startValue = previousValueRef.current;
    const delta = safeTarget - startValue;

    if (Math.abs(delta) < 0.0001) {
      setDisplayValue(safeTarget);
      previousValueRef.current = safeTarget;
      return;
    }

    const durationMs = 220;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Starke Ease-Out-Kurve: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + delta * eased;

      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(safeTarget);
        previousValueRef.current = safeTarget;
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      previousValueRef.current = safeTarget;
    };
  }, [safeTarget]);

  const formatted = displayValue.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return <span className={`tabular-nums ${className}`}>{formatted}</span>;
};
