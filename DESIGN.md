# Projekt-Design-Guideline (`DESIGN.md`)

> **Design-System:** Apple Human Interface Guidelines (HIG) & Apple Liquid Glass  
> **Gewählte Design-Richtung:** **„Kupfer & Kälte“** *(Verbindliche Projekt-Richtlinie)*  
> **Darstellungsmodi:** 3-Stufen-System (`Auto` / `Hell` / `Dunkel`)

---

## 1. Farben (Color Palette – „Kupfer & Kälte“)

### Marken- & Akzentfarben
- **Primär- / Kälte-Akzent (`--brand-accent`):** `#0071E3` (Hell) / `#389BFF` (Dunkel)
- **Sekundär- / Kupfer-Akzent (`--brand-warm`):** `#C86D3B` (Hell) / `#E08A58` (Dunkel)
- **Akzent-Text / Kontrast (`--brand-accent-text`):** `#0051A8` (Hell) / `#74B9FF` (Dunkel)
- **Tonal Tile / Badge (`--tile`):** `rgba(0, 113, 227, 0.10)` (Hell) / `rgba(56, 155, 255, 0.16)` (Dunkel)

### Semantische Status-Farben
- **Optimal (`--status-ok`):** `#1B8A4B` (Hell) / `#34D37D` (Dunkel)
- **Warnung (`--status-warn`):** `#B86E00` (Hell) / `#F5A623` (Dunkel)
- **Kritisch (`--status-bad`):** `#C9342D` (Hell) / `#FF6961` (Dunkel)

### Oberflächen & Glas-Schichten (Hell-Modus)
- **Basis-Hintergrund (`--bg`):** `#F4F6F9`
- **Glas-Karte (`--glass`):** `rgba(255, 255, 255, 0.74)`
- **Hero- / Header-Glas (`--glass-hero`):** `rgba(255, 255, 255, 0.86)`
- **Eingabefeld / Sub-Well (`--input-bg`):** `rgba(255, 255, 255, 0.58)`
- **Primärtext (`--ink`):** `#16181D`
- **Sekundärtext (`--muted`):** `#525866`

### Oberflächen & Glas-Schichten (Dunkel-Modus)
- **Basis-Hintergrund (`--bg`):** `#0D0F12`
- **Glas-Karte (`--glass`):** `rgba(24, 27, 34, 0.70)`
- **Hero- / Header-Glas (`--glass-hero`):** `rgba(16, 18, 23, 0.84)`
- **Eingabefeld / Sub-Well (`--input-bg`):** `rgba(15, 17, 22, 0.68)`
- **Primärtext (`--ink`):** `#F4F6F9`
- **Sekundärtext (`--muted`):** `#9AA2B1`

---

## 2. Schriften (Typography – DSGVO-konform ohne externe CDNs)

- **UI- & Fließtext (`--font-sans`):** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif`
- **Display-Überschriften & Ergebniswerte (`--font-display`):** `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif`
- **Zahlen, Messwerte & Formeln (`--font-mono`):** `"SF Mono", ui-monospace, SFMono-Regular, Menlo, monospace`
- **Zahlen-Formatierung:** Alle berechneten Werte nutzen zwingend `font-variant-numeric: tabular-nums` (`tabular-nums`), um Layout-Springen bei Live-Änderungen zu verhindern.

---

## 3. Geometrie, Motion & iPhone-PWA-Standards

- **Konzentrische Radien:** Hero/Modal (`28px`) -> Glas-Karte (`24px`) -> Input/Well (`14px`) -> Buttons/Tabs (`11px`)
- **Motion-Tokens:** `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-spring: cubic-bezier(0.22, 1, 0.36, 1)`, Press-Scale (`.press-card` `0.99`, `.press-btn` `0.97`, `.press-icon` `0.95`)
- **Touch & iOS Safari:** Mindest-Tippfläche `44px`, Inputs mindestens `16px` Schriftgröße (kein Auto-Zoom), `viewport-fit=cover` + `env(safe-area-inset-*)`, synchroner iOS-Reflow-Schutz, kein `black-translucent` Meta-Tag.
- **Minimalismus:** Content First – die aktiven HVAC-R-Rechner stehen ohne visuellen Ballast im Fokus.
