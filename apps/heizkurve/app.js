/**
 * Modul: Heizkurve-Simulator (apps/heizkurve/app.js)
 * Zweck: Lambda-Heizkurve mit drei Einstellpunkten (+22 / 0 / −22 °C) und Offset.
 * Quelle: Lambda Reglerbeschreibung Endkunden V 2.1, Abschnitt 12.2.2 (drei Punkte, Offset = Parallelverschiebung);
 * Lambda Quick Start Guide Endkunde 1.1, Abschnitt 3.3 (Standardwerte, 0,5-K-Schritte). Interpolation und Randwerte: Annahme.
 */

import { fadeThrough, parseLocaleNumber, showToast } from "../../assets/js/shared.js";

/* CALC-START */
/* Vorlauf-Soll: lineare Interpolation zwischen den Punkten, außerhalb ±22 °C Randwert, plus Offset, auf 0,1 K gerundet. */
function vorlauf(p, ta) {
  let v;
  if (ta >= 22) v = p.tw;
  else if (ta >= 0) v = p.tm + ((p.tw - p.tm) * ta) / 22;
  else if (ta > -22) v = p.tm + ((p.tk - p.tm) * -ta) / 22;
  else v = p.tk;
  return Math.round((v + p.o) * 10) / 10;
}
/* CALC-END */

const WP_GRENZE = 55;
const STORE = "ag-calc-heizkurve-";
const PRESETS = { fbh: [25, 30, 35], hk: [35, 45, 55] };
const CONTROLS = [
  { key: "ta", min: -22, max: 22, step: 1, dec: 0, start: 0 },
  { key: "tw", min: 20, max: 75, step: 0.5, dec: 1, start: 25 },
  { key: "tm", min: 20, max: 75, step: 0.5, dec: 1, start: 30 },
  { key: "tk", min: 20, max: 75, step: 0.5, dec: 1, start: 35 },
  { key: "o", min: -10, max: 10, step: 0.5, dec: 1, start: 0 },
];

const $ = (id) => document.getElementById(id);
const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Speicher nicht verfügbar */
    }
  },
};
const fmt = (value, dec) =>
  Number.isFinite(value)
    ? value.toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : "–";
const fmtSigned = (value, dec) => (Number.isFinite(value) ? (value > 0 ? "+" : "") + fmt(value, dec) : "–");

const state = {};
const fields = {};
let ref = null;
let shown = "curve";

CONTROLS.forEach((c) => {
  const saved = parseLocaleNumber(store.get(STORE + c.key), c.start, c.min, c.max);
  state[c.key] = Number(saved.toFixed(c.dec));
  const input = $("f-" + c.key);
  const range = $("r-" + c.key);
  range.min = String(c.min);
  range.max = String(c.max);
  range.step = String(c.step);
  fields[c.key] = { input, range, cfg: c };
  input.addEventListener("focus", () => input.select());
  input.addEventListener("click", () => input.select());
  input.addEventListener("change", () => setValue(c.key, parseLocaleNumber(input.value, state[c.key], c.min, c.max)));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
  });
  range.addEventListener("input", () => setValue(c.key, parseFloat(range.value)));
});
document.querySelectorAll(".stepper[data-key]").forEach((b) =>
  b.addEventListener("click", () => {
    const c = fields[b.dataset.key].cfg;
    setValue(c.key, state[c.key] + Number(b.dataset.dir) * c.step);
  })
);

function setValue(key, raw) {
  const c = fields[key].cfg;
  const stepped = Math.round(raw / c.step) * c.step;
  state[key] = Number(Math.min(c.max, Math.max(c.min, stepped)).toFixed(c.dec));
  store.set(STORE + key, String(state[key]));
  render();
}

/* Diagramm: x = Außentemperatur +22 links bis −22 rechts, y = Vorlauf 15 bis 80 °C */
const G = { L: 36, R: 322, T: 12, B: 176, tMin: 15, tMax: 80 };
const X = (ta) => G.L + ((22 - ta) / 44) * (G.R - G.L);
const Y = (t) => G.B - ((Math.min(G.tMax, Math.max(G.tMin, t)) - G.tMin) / (G.tMax - G.tMin)) * (G.B - G.T);

(function drawGrid() {
  let g = "";
  [20, 40, 60, 80].forEach((t) => {
    g +=
      `<line class="chart-grid-line" x1="${G.L}" x2="${G.R}" y1="${Y(t)}" y2="${Y(t)}"/>` +
      `<text x="${G.L - 6}" y="${Y(t) + 4}" text-anchor="end">${t}</text>`;
  });
  [20, 10, 0, -10, -20].forEach((a) => {
    g += `<text x="${X(a)}" y="193" text-anchor="middle">${a < 0 ? "−" + Math.abs(a) : a}</text>`;
  });
  g += `<text x="${(G.L + G.R) / 2}" y="210" text-anchor="middle">Außentemperatur in °C</text>`;
  $("chart-grid").innerHTML = g;
})();

function curvePath(p) {
  return [22, 0, -22].map((a, i) => `${i ? "L" : "M"}${X(a).toFixed(1)} ${Y(vorlauf(p, a)).toFixed(1)}`).join(" ");
}

const chart = $("chart");
let dragging = false;
function taFromPointer(e) {
  const r = chart.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 340;
  return 22 - ((x - G.L) / (G.R - G.L)) * 44;
}
chart.addEventListener("pointerdown", (e) => {
  dragging = true;
  chart.setPointerCapture(e.pointerId);
  setValue("ta", taFromPointer(e));
});
chart.addEventListener("pointermove", (e) => {
  if (dragging) setValue("ta", taFromPointer(e));
});
["pointerup", "pointercancel"].forEach((ev) =>
  chart.addEventListener(ev, () => {
    dragging = false;
  })
);

$("ref-btn").addEventListener("click", () => {
  ref = ref ? null : { tw: state.tw, tm: state.tm, tk: state.tk, o: state.o };
  showToast(ref ? "Kurve gemerkt" : "Vergleich gelöscht");
  render();
});

$("reset-btn").addEventListener("click", () => {
  const [w, m, k] = PRESETS.fbh;
  state.tw = w;
  state.tm = m;
  state.tk = k;
  state.o = 0;
  state.ta = 0;
  CONTROLS.forEach((c) => store.set(STORE + c.key, String(state[c.key])));
  showToast("Standardwerte wiederhergestellt");
  render();
});

$("preset-segment").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-preset]");
  if (!btn) return;
  const [w, m, k] = PRESETS[btn.dataset.preset];
  state.tw = w;
  state.tm = m;
  state.tk = k;
  ["tw", "tm", "tk"].forEach((key) => store.set(STORE + key, String(state[key])));
  render();
});

const panes = { curve: $("pane-curve"), table: $("pane-table") };
$("view-segment").addEventListener("click", (e) => {
  const btn = e.target.closest(".segmented-option");
  if (!btn || btn.dataset.show === shown) return;
  $("view-segment")
    .querySelectorAll(".segmented-option")
    .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
  const from = panes[shown];
  shown = btn.dataset.show;
  fadeThrough(from, panes[shown], render);
});

function render() {
  const vl = vorlauf(state, state.ta);

  CONTROLS.forEach((c) => {
    const f = fields[c.key];
    if (document.activeElement !== f.input) f.input.value = fmt(state[c.key], c.dec);
    f.range.value = String(state[c.key]);
  });

  $("hero-ta").textContent = fmt(state.ta, 0);
  $("hero-vl").textContent = fmt(vl, 1);
  const high = vl > WP_GRENZE;
  $("hero-pill").className = "status-pill " + (high ? "status-pill--orange" : "status-pill--green");
  $("hero-pill-icon").textContent = high ? "warning" : "check_circle";
  $("hero-pill-text").textContent = high ? "Über 55 °C: COP sinkt stark" : "Wärmepumpen-gerecht";

  $("slope-upper").textContent = fmt((state.tm - state.tw) / 22, 2) + " K/K";
  $("slope-lower").textContent = fmt((state.tk - state.tm) / 22, 2) + " K/K";
  $("diff-row").hidden = !ref;
  if (ref) $("diff-value").innerHTML = fmtSigned(vl - vorlauf(ref, state.ta), 1) + ' <span class="metric-unit">K</span>';

  $("ref-label").textContent = ref ? "Vergleich löschen" : "Kurve merken";
  $("ref-icon").textContent = ref ? "close" : "push_pin";

  $("chart-line").setAttribute("d", curvePath(state));
  const topY = Math.min(...[22, 0, -22].map((t) => Y(vorlauf(state, t))));
  $("chart-fill-grad").setAttribute("y1", topY.toFixed(1));
  $("chart-fill").setAttribute("d", `${curvePath(state)} L${X(-22).toFixed(1)} ${G.B} L${X(22).toFixed(1)} ${G.B} Z`);
  $("chart-ref").setAttribute("visibility", ref ? "visible" : "hidden");
  if (ref) $("chart-ref").setAttribute("d", curvePath(ref));
  $("chart-pts").innerHTML = [22, 0, -22]
    .map(
      (a) =>
        `<circle cx="${X(a).toFixed(1)}" cy="${Y(vorlauf(state, a)).toFixed(1)}" r="4" fill="var(--bg-elevated)" stroke="var(--system-red)" stroke-width="2"/>`
    )
    .join("");
  const x = X(state.ta);
  const y = Y(vl);
  $("chart-dot").setAttribute("cx", x);
  $("chart-dot").setAttribute("cy", y);
  $("guide-x").setAttribute("x1", x);
  $("guide-x").setAttribute("x2", x);
  $("guide-x").setAttribute("y1", y);
  $("guide-x").setAttribute("y2", G.B);
  $("guide-y").setAttribute("x1", G.L);
  $("guide-y").setAttribute("x2", x);
  $("guide-y").setAttribute("y1", y);
  $("guide-y").setAttribute("y2", y);
  chart.setAttribute("aria-label", `Heizkurve. Bei ${fmt(state.ta, 0)} Grad Außentemperatur ${fmt(vl, 1)} Grad Vorlauf.`);

  if (shown === "table") {
    const temps = [22, 18, 14, 10, 6, 2, 0, -2, -6, -10, -14, -18, -22].sort((a, b) => b - a);
    $("table-body").innerHTML = temps
      .map(
        (a) =>
          `<div class="info-row"><span class="info-row-label numeric">${fmt(a, 0)} °C Außentemperatur</span><span class="info-row-value numeric">` +
          (ref ? fmt(vorlauf(ref, a), 1) + " → " : "") +
          `${fmt(vorlauf(state, a), 1)} <span class="metric-unit">°C</span></span></div>`
      )
      .join("");
  }

  document.querySelectorAll("[data-preset]").forEach((b) => {
    const [w, m, k] = PRESETS[b.dataset.preset];
    b.setAttribute("aria-pressed", String(state.tw === w && state.tm === m && state.tk === k));
  });
}

render();
