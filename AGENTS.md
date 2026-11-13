# Projekt-Architektur & KI-Arbeitsregeln (`AGENTS.md`)

> **Geltungsbereich:** Verbindliche Architektur-, Design- und Arbeitsregeln für das Projekt **HVAC·R Rechner**. Ergänzt die globale `AGENTS.md` und [DESIGN.md](./DESIGN.md).

---

## 1. System-Architektur (Multi-Page ohne Build-Step)

Dieses Projekt ist ein modulares Web-App-Portal (**Vanilla HTML5, CSS3, ES6 JavaScript**), das direkt auf GitHub Pages lauffähig ist. Es werden **keine** Frameworks oder Bundler (kein React, Vite, npm) verwendet.

### Ordnerstruktur
- `/index.html` → Zentrales Dashboard / App-Launcher (Übersicht aller Tools als Cards).
- `/assets/css/global.css` → Zentrales Design-System für alle Apps.
- `/assets/js/shared.js` → Globale Hilfsfunktionen (3-Stufen-Theme-Steuerung, Segmented-Pills, Toast, Reduced-Motion).
- `/assets/js/dashboard.js` → Dashboard-Steuerung (Suche, Kategorie-Filter, Modul-Karten-Rendering, Einstellungen).
- `/apps/<app-name>/` → Vollständig isolierte Einzel-Apps. Jede App besitzt:
  - `index.html` (UI der App, bindet `../../assets/css/global.css` und `../../assets/js/shared.js` ein)
  - `app.js` (gesamte Berechnungs-, Formel- und UI-Logik dieser spezifischen App)
  - `style.css` (optional: nur falls App-spezifisches CSS nötig ist, das nicht in `global.css` liegt)

---

## 2. Design-System & UI-Vorgaben (gemäß `DESIGN.md`)

- **Stil:** Apple Human Interface Guidelines (HIG) & Apple Liquid Glass („Graphit & Signal-Orange“).
- **Darstellungsmodi:** Verbindliches **3-Stufen-System (`Auto` / `Hell` / `Dunkel`)** über `shared.js` und `global.css` (`#F2F2F4` im Hell-Modus, `#18181B` im Dunkel-Modus).
- **Flächen & Geometrie:** Transluzente Glas-Karten (`backdrop-filter: blur()`) mit konzentrischen Radien (`10px–12px` Buttons/Tabs, `14px` Inputs/Wells, `24px` Karten, `28px` Hero/Modals) gemäß [DESIGN.md](./DESIGN.md).
- **Typografie (DSGVO-konform ohne externe CDNs):**
  - UI & Fließtext: `--font-sans` (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif`)
  - Zahlen, Messwerte & Formeln: `--font-mono` mit `font-variant-numeric: tabular-nums`
- **Navigation:** Jede Teil-App unter `/apps/<app-name>/index.html` besitzt im Header einen klaren „Zurück zum Dashboard“-Button (`href="../../index.html"`).
- **Pfad-Regel:** Ausschließlich **relative Pfade** (`./`, `../../`) verwenden, damit alles lokal und in einem GitHub-Pages-Unterverzeichnis (`/repo-name/`) fehlerfrei lädt.

---

## 3. Strikte Arbeitsregeln für die KI (Token- & Kontext-Schutz)

1. **Isoliertes Arbeiten:** Bei Aufträgen für eine spezifische App unter `/apps/<app-name>/` werden **nur** die Dateien in diesem Unterordner (sowie bei Bedarf `DESIGN.md` und `/assets/css/global.css`) gelesen und bearbeitet. Keine fremden `/apps/*`-Ordner einlesen oder verändern. Auch Prüf-Skripte (z. B. `static-truncation-scan.py`) gezielt nur auf den betroffenen App-Ordner ausführen.
2. **Neue App anlegen:**
   - Neuen Ordner `/apps/<neuer-name>/` mit `index.html` und `app.js` (sowie optional `style.css`) anlegen.
   - Klassen und CSS-Variablen aus `../../assets/css/global.css` nutzen.
   - Im `MODULES`-Array von `/assets/js/dashboard.js` lediglich einen neuen Eintrag mit `live: true` und `href: "./apps/<neuer-name>/index.html"` hinzufügen (damit Suche und Kategorie-Filter direkt funktionieren).
3. **Code-Disziplin:** Sauberen, direkt ausführbaren Code ohne Platzhalter-Kommentare (wie `// restlicher Code hier`) schreiben. Globale Sicherheits-, iOS-Safari-PWA- und A11y-Vorgaben (z. B. `font-size >= 16px` für Inputs, `min-height: 44px`, kein `black-translucent`) bleiben verbindlich.
