# Projekt-Design-Guideline (`DESIGN.md`)

> **Verbindliche Farbquelle:** [FARBPALETTE.md](file:///Users/necervo/.gemini/config/plugins/master-instructions/rules/FARBPALETTE.md) (**„Pastell auf Schwarz“**)  
> **Darstellungsmodi:** 3-Stufen-System (`Auto` / `Hell` / `Dunkel` — Dunkel-Modus ist Standard)

---

## 1. Farben („Pastell auf Schwarz“)

- **Hintergrund (`--bg`):** `#000000` (Dunkel, Standard) / `#F2F2F7` (Hell über `data-theme="light"`)
- **Neutrale Flächen (einfarbig ohne Verlauf):**
  - Karte (`--surface-card`): `#1C1C1E` (Dunkel, Rand `1px solid var(--border)`) / `#FFFFFF` (Hell, `var(--shadow-card)`)
  - Feld (`--surface-field`): `#2C2C2E` (Dunkel) / `#F2F2F7` (Hell)
  - Hover (`--surface-hover`): `#3A3A3C` (Dunkel) / `#E5E5EA` (Hell)
  - Gedrückt (`--surface-active`): `#48484A` (Dunkel) / `#D1D1D6` (Hell)
- **Text:** `--text-primary` (`#FFFFFF` / `#000000`), `--text-secondary` (`rgba(235,235,245,0.6)` / `rgba(60,60,67,0.7)`), `--text-on-accent` (`#1C1C1E` auf jeder Pastell-/Verlaufsfläche)
- **Hauptakzent (Verlauf):** `--gradient-ocean` (`#A0E3E0` → `#B3BDF7`, `135deg`) für aktive Akzent-Buttons und hervorgehobene Messwerte im Dunkel-Modus (`--accent-text-sky` im Hell-Modus)
- **Status-Plaketten:**
  - Optimal: `--pastel-mint` / `--accent-text-mint`
  - Warnung: `--pastel-peach` / `--accent-text-peach`
  - Kritisch: `--pastel-rose` / `--accent-text-rose`

---

## 2. Schriften (DSGVO-konforme Systemschriften)

- **Überschriften & Messwerte (`--font-display`):** `-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif` (Gewicht `600`)
- **Fließtext & Bedienelemente (`--font-sans`):** `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif` (Gewicht `400 / 500`)
- **Zahlen & Code (`--font-mono`):** `ui-monospace, "SF Mono", Menlo, Consolas, monospace` mit `font-variant-numeric: tabular-nums`

---

## 3. Geometrie, Motion & iPhone-PWA-Standards

- **Konzentrische Radien:** Hero/Modal (`28px`) -> Karte (`24px`) -> Feld/Well (`14px`) -> Buttons/Tabs (`11px`)
- **Motion-Tokens:** `--ease-out: cubic-bezier(0.32, 0.72, 0, 1)`, `--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.1)`, `--dur-fast: 120ms`, `--dur-normal: 280ms`, Press-Scale (`.press-card` `0.99`, `.press-btn` `0.97`, `.press-icon` `0.94`)
- **Touch & iOS Safari:** Mindest-Tippfläche `44px`, Inputs mindestens `16px` Schriftgröße, `viewport-fit=cover` + `env(safe-area-inset-*)`, synchroner iOS-Reflow-Schutz, kein `black-translucent` Meta-Tag.
