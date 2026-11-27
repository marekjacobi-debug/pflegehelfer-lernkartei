// Öffentliche Fassung (ohne Namen). Original im privaten Repo.
// Erzeugt pro Thema eine PowerPoint-Präsentation zum Vortragen (mit Sprechernotizen).
// Aufruf: node build_praesentationen.js inhalte.json vortraege_alle.json <Zielordner> [themen-id ...]
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(path.join(__dirname, "apply_theme.js"));
const { animiere } = require(path.join(__dirname, "animieren.js"));

const [inhaltePfad, vortragPfad, ziel, ...nur] = process.argv.slice(2);
const DATA = JSON.parse(fs.readFileSync(inhaltePfad, "utf8"));
const VORTRAG = JSON.parse(fs.readFileSync(vortragPfad, "utf8"));
const AUTOR = process.env.AUTOR || ""; // öffentliche Fassung: kein Name
// Lerngrafiken (themen[].grafiken): PNGs vorher mit render_grafiken.js erzeugen, Ordner = <Ordner von inhalte.json>/grafiken
const GRAFIKEN = process.env.GRAFIKEN || path.join(path.dirname(path.resolve(inhaltePfad)), "grafiken");

const THEME = {
  name: "Pflegehelfer Liquid Glass",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1D1D1F", lt1: "FFFFFF", dk2: "0B2A4A", lt2: "EAF3FF",
    accent1: "0066CC", accent2: "E5710F", accent3: "6AC4DC", accent4: "FFC933",
    accent5: "5856D6", accent6: "6E6E73", hlink: "0066CC", folHlink: "5856D6",
  },
};
// Liquid Glass: weiche Farbverläufe als Hintergrund, Karten als helles Glas mit weicher Kante
const HG_HELL = path.join(__dirname, "hintergrund_hell.png");
const HG_DUNKEL = path.join(__dirname, "hintergrund_dunkel.png");
// jedes Mal ein neues Objekt – pptxgenjs verändert die übergebenen Optionen
const glas = (farbe) => ({
  fill: { color: farbe, transparency: 22 },
  line: { color: farbe, width: 1.25 },
  shadow: { type: "outer", color: "1E3264", opacity: 0.16, blur: 14, offset: 4, angle: 90 },
});
const W = 10, H = 5.625, M = 0.55;

function linesFor(text, wIn, pt) {
  const cpl = Math.max(8, Math.floor((wIn * 72) / (pt * 0.47)));
  let lines = 0;
  for (const para of String(text).split("\n")) {
    let cur = 0, l = 1;
    for (const word of para.split(/\s+/)) {
      const len = word.length + (cur ? 1 : 0);
      if (cur + len > cpl) { l++; cur = word.length; } else cur += len;
    }
    lines += l;
  }
  return lines;
}
function fitPt(texts, wIn, hIn, sizes) {
  for (const pt of sizes) {
    const maxWort = Math.floor((wIn * 72) / (pt * 0.53));
    if (texts.every((t) => linesFor(t, wIn, pt) * pt * 1.22 / 72 <= hIn && String(t).split(/[\s\/]+/).every((w) => w.replace(/[()„“",.:;]/g, "").length <= maxWort))) return pt;
  }
  return sizes[sizes.length - 1];
}
function sauber(s) { return String(s).replace(/Kein bloße/g, "Keine bloße"); }
function dateiname(s) { return s.replace(/[\/\\:*?"<>|]/g, "-").replace(/\s+/g, " ").trim(); }

function baueDeck(lf, e, t, v) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = AUTOR || "Pflegehelfer-Lernkartei";
  pres.title = t.titel;
  pres.subject = `${lf.titel} · ${e.titel}`;
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;
  const fuss = `${t.titel} · ${e.titel}`;

  pres.defineSlideMaster({
    title: "Titel dunkel",
    background: { path: HG_DUNKEL },
    objects: [
      { text: { text: "", options: { shape: pres.shapes.ROUNDED_RECTANGLE, x: M - 0.27, y: 0.72, w: 7.0, h: 4.25, rectRadius: 0.28, fill: { color: "FFFFFF", transparency: 90 }, line: { color: "FFFFFF", width: 1, transparency: 65 } } } },
      { placeholder: { options: { name: "kicker", type: "body", x: M, y: 1.05, w: 6.2, h: 0.4, fontSize: 13, color: C.accent3, bold: true, charSpacing: 1, margin: 0 }, text: "" } },
      { placeholder: { options: { name: "title", type: "title", x: M, y: 1.5, w: 6.4, h: 1.9, fontSize: 36, bold: true, color: C.background1, valign: "top", align: "left", margin: 0, fontFace: THEME.headFontFace }, text: "" } },
      { placeholder: { options: { name: "untertitel", type: "body", x: M, y: 3.75, w: 6.2, h: 0.9, fontSize: 15, color: C.background2, valign: "top", margin: 0 }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "Inhalt",
    background: { path: HG_HELL },
    margin: [0.5, 0.55, 0.55, 0.55],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: M, y: 0.35, w: W - 2 * M, h: 0.75, fontSize: 28, bold: true, color: C.text2, valign: "middle", align: "left", margin: 0, fontFace: THEME.headFontFace }, text: "" } },
      { text: { text: fuss, options: { x: M, y: H - 0.42, w: 7, h: 0.28, fontSize: 9, color: C.accent6, margin: 0 } } },
    ],
    slideNumber: { x: W - M - 0.5, y: H - 0.42, w: 0.5, h: 0.28, fontSize: 9, color: C.accent6, align: "right" },
  });

  function kreis(slide, x, y, d, nummer, fill, farbe, name) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: name });
    slide.addText(String(nummer), { x, y, w: d, h: d, align: "center", valign: "middle", fontSize: Math.round(d * 30), bold: true, color: farbe, margin: 0, isTextBox: true, fontFace: THEME.headFontFace, objectName: name + " Zahl" });
  }
  function deko(slide) {
    slide.addShape(pres.shapes.OVAL, { x: 6.9, y: 0.6, w: 4.2, h: 4.2, fill: { color: C.accent1, transparency: 35 }, line: { color: "FFFFFF", width: 1.25, transparency: 45 }, objectName: "Deko Kreis groß" });
    slide.addShape(pres.shapes.OVAL, { x: 7.6, y: 3.3, w: 1.6, h: 1.6, fill: { color: C.accent2, transparency: 12 }, line: { color: "FFFFFF", width: 1.25, transparency: 45 }, objectName: "Deko Kreis klein" });
    slide.addShape(pres.shapes.OVAL, { x: 8.75, y: 0.25, w: 0.75, h: 0.75, fill: { color: C.accent4, transparency: 5 }, line: { color: "FFFFFF", width: 1.25, transparency: 45 }, objectName: "Deko Punkt" });
  }

  // 1 Titel
  pres.addSection({ title: "Einstieg" });
  let s = pres.addSlide({ masterName: "Titel dunkel", sectionTitle: "Einstieg" });
  deko(s);
  s.addText(`${lf.titel.toUpperCase()} · ${e.titel.toUpperCase()}`, { placeholder: "kicker" });
  s.addText(t.titel, { placeholder: "title", fontSize: t.titel.length > 34 ? 30 : 36 });
  s.addText([AUTOR ? `Referat von ${AUTOR}` : "Pflegehelfer-Ausbildung", t.lehrkraft && t.lehrkraft !== "Unterricht" ? `Unterricht ${t.lehrkraft}` : "Unterrichtsthema"].join("\n"), { placeholder: "untertitel" });
  s.addNotes(v.einleitung);

  // 2 Gliederung
  s = pres.addSlide({ masterName: "Inhalt", sectionTitle: "Einstieg" });
  s.addText("Gliederung", { placeholder: "title" });
  const n = t.zettel.length, zweiSp = n > 4, proSp = zweiSp ? Math.ceil(n / 2) : n;
  const spW = zweiSp ? (W - 2 * M - 0.4) / 2 : 5.4;
  if (!zweiSp) {
    s.addShape(pres.shapes.OVAL, { x: 6.55, y: 1.35, w: 2.9, h: 2.9, ...glas(C.background1), objectName: "Gliederung Kreis" });
    s.addText([{ text: String(n), options: { fontSize: 66, bold: true, color: C.accent1, fontFace: THEME.headFontFace, breakLine: true } }, { text: "Abschnitte", options: { fontSize: 16, color: C.text2 } }], { x: 6.55, y: 1.35, w: 2.9, h: 2.9, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "Gliederung Anzahl" });
  }
  const zeileH = Math.min(0.78, 3.6 / proSp);
  t.zettel.forEach((z, i) => {
    const sp = zweiSp && i >= proSp ? 1 : 0, r = sp ? i - proSp : i;
    const x = M + sp * (spW + 0.4), y = 1.35 + r * zeileH, d = Math.min(0.5, zeileH - 0.12);
    kreis(s, x, y + (zeileH - d) / 2 - 0.04, d, i + 1, C.accent1, C.background1, `Gliederung ${i + 1}`);
    s.addText(sauber(z.h), { x: x + d + 0.2, y, w: spW - d - 0.2, h: zeileH - 0.08, fontSize: zeileH < 0.5 ? 15 : 19, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: `Gliederung ${i + 1} Text` });
  });
  s.addNotes("Kurz die Gliederung vorstellen: " + t.zettel.map((z, i) => `${i + 1}. ${z.h}`).join(", ") + ".");

  // 3 Abschnitte
  pres.addSection({ title: "Inhalt" });
  t.zettel.forEach((z, i) => {
    s = pres.addSlide({ masterName: "Inhalt", sectionTitle: "Inhalt" });
    s.addText([{ text: `${i + 1}  `, options: { color: C.accent2 } }, { text: sauber(z.h) }], { placeholder: "title" });
    const P = z.punkte.map(sauber), k = P.length, top = 1.3, bottom = H - 0.6, hAll = bottom - top;
    if (k === 1) {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: top + 0.2, w: W - 2 * M, h: hAll - 0.5, ...glas(C.background1), rectRadius: 0.24, objectName: "Kernaussage Fläche" });
      kreis(s, M + 0.35, top + 0.2 + (hAll - 0.5) / 2 - 0.4, 0.8, "!", C.accent2, C.background1, "Kernaussage Symbol");
      const pt = fitPt(P, W - 2 * M - 1.8, hAll - 0.9, [24, 22, 20, 18, 16]);
      s.addText(P[0], { x: M + 1.45, y: top + 0.4, w: W - 2 * M - 1.8, h: hAll - 0.9, fontSize: pt, color: C.text2, valign: "middle", margin: 0, isTextBox: true, objectName: "Kernaussage" });
    } else if (k <= 3) {
      const gap = 0.3, cw = (W - 2 * M - gap * (k - 1)) / k, ch = hAll - 0.15;
      const pt = fitPt(P, cw - 0.5, ch - 1.15, [22, 20, 18, 16, 15, 14, 13, 12]);
      P.forEach((p, j) => {
        const x = M + j * (cw + gap);
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: top, w: cw, h: ch, ...glas(C.background1), rectRadius: 0.2, objectName: `Karte ${j + 1}` });
        kreis(s, x + 0.25, top + 0.25, 0.6, j + 1, j % 2 ? C.accent2 : C.accent1, C.background1, `Karte ${j + 1} Nummer`);
        s.addText(p, { x: x + 0.25, y: top + 1.05, w: cw - 0.5, h: ch - 1.2, fontSize: pt, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: `Karte ${j + 1} Text` });
      });
    } else if (k <= 6) {
      const rows = Math.ceil(k / 2), gap = 0.22, cw = (W - 2 * M - 0.3) / 2, ch = (hAll - gap * (rows - 1)) / rows;
      const d = Math.min(0.48, ch - 0.2), tw = cw - d - 0.5;
      const pt = fitPt(P, tw, ch - 0.16, [19, 18, 17, 16, 15, 14, 13, 12, 11]);
      P.forEach((p, j) => {
        const c = j % 2, r = Math.floor(j / 2), x = M + c * (cw + 0.3), y = top + r * (ch + gap);
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, ...glas(C.background1), rectRadius: 0.16, objectName: `Feld ${j + 1}` });
        kreis(s, x + 0.18, y + (ch - d) / 2, d, j + 1, C.accent1, C.background1, `Feld ${j + 1} Nummer`);
        s.addText(p, { x: x + d + 0.33, y: y + 0.08, w: tw, h: ch - 0.16, fontSize: pt, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: `Feld ${j + 1} Text` });
      });
    } else {
      const half = Math.ceil(k / 2), cw = (W - 2 * M - 0.4) / 2, rh = hAll / half, d = Math.min(0.36, rh - 0.1), tw = cw - d - 0.2;
      const pt = fitPt(P, tw, rh - 0.06, [18, 17, 16, 15, 14, 13, 12, 11]);
      P.forEach((p, j) => {
        const c = j < half ? 0 : 1, r = c ? j - half : j, x = M + c * (cw + 0.4), y = top + r * rh;
        kreis(s, x, y + 0.04, d, j + 1, c ? C.accent2 : C.accent1, C.background1, `Punkt ${j + 1} Nummer`);
        s.addText(p, { x: x + d + 0.2, y, w: tw, h: rh - 0.06, fontSize: pt, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: `Punkt ${j + 1} Text` });
      });
    }
    s.addNotes(v.abschnitte[i]);
    for (const g of (t.grafiken || []).filter((g) => g.nach === z.h)) {
      const png = path.join(GRAFIKEN, g.id + ".png");
      if (!fs.existsSync(png)) throw new Error(`Grafik fehlt: ${png} – zuerst render_grafiken.js ausführen`);
      const gs = pres.addSlide({ sectionTitle: "Inhalt" });
      gs.background = { color: "FFFFFF" };
      gs.addImage({ path: png, x: 0, y: 0, w: W, h: H, altText: g.titel, objectName: "Grafik" });
      gs.addNotes(g.notiz || ("Grafik erklären: " + g.titel));
    }
  });

  // 4 Das Wichtigste
  pres.addSection({ title: "Abschluss" });
  s = pres.addSlide({ masterName: "Inhalt", sectionTitle: "Abschluss" });
  s.addText("Das Wichtigste in Kürze", { placeholder: "title" });
  {
    const cw = (W - 2 * M - 0.6) / 3, ch = 3.25, y = 1.35;
    const pt = fitPt(v.merksaetze, cw - 0.5, ch - 1.4, [18, 17, 16, 15, 14]);
    v.merksaetze.forEach((m, j) => {
      const x = M + j * (cw + 0.3);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, ...glas(C.background1), rectRadius: 0.2, objectName: `Merksatz ${j + 1} Karte` });
      s.addText(String(j + 1), { x: x + 0.25, y: y + 0.15, w: 1, h: 0.9, fontSize: 48, bold: true, color: [C.accent1, C.accent2, C.accent5][j], margin: 0, isTextBox: true, fontFace: THEME.headFontFace, objectName: `Merksatz ${j + 1} Zahl` });
      s.addText(m, { x: x + 0.25, y: y + 1.15, w: cw - 0.5, h: ch - 1.35, fontSize: pt, color: C.text2, bold: true, valign: "top", margin: 0, isTextBox: true, objectName: `Merksatz ${j + 1}` });
    });
  }
  s.addNotes("Zum Abschluss die drei wichtigsten Punkte: " + v.merksaetze.join(" "));

  // 5 Fragen an die Klasse
  const qs = t.quiz.slice(0, 3);
  if (qs.length) {
    s = pres.addSlide({ masterName: "Inhalt", sectionTitle: "Abschluss" });
    s.addText("Fragen an die Klasse", { placeholder: "title" });
    const rh = 3.5 / qs.length;
    const pt = fitPt(qs.map((q) => q.f), W - 2 * M - 1.0, rh - 0.2, [20, 18, 16, 15, 14]);
    qs.forEach((q, j) => {
      const y = 1.35 + j * rh;
      kreis(s, M, y + 0.05, 0.55, "?", j % 2 ? C.accent2 : C.accent1, C.background1, `Frage ${j + 1} Symbol`);
      s.addText(q.f, { x: M + 0.8, y, w: W - 2 * M - 1.0, h: rh - 0.15, fontSize: pt, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: `Frage ${j + 1}` });
    });
    s.addNotes("Diese Fragen der Klasse stellen und kurz Zeit zum Überlegen geben. Lösungen: " + qs.map((q, j) => `Frage ${j + 1}: ${q.optionen[0]}. ${q.erklaerung}`).join(" "));
  }

  // 6 Schluss
  s = pres.addSlide({ masterName: "Titel dunkel", sectionTitle: "Abschluss" });
  deko(s);
  s.addText(t.titel.toUpperCase(), { placeholder: "kicker" });
  s.addText("Vielen Dank für eure Aufmerksamkeit!", { placeholder: "title" });
  s.addText("Habt ihr Fragen?\nQuelle: Unterrichtsmitschriften – " + t.quellen.map((q) => q.split("/").pop().replace(/\.\w+$/, "")).join(", "), { placeholder: "untertitel", fontSize: 13 });
  s.addNotes(v.schluss);

  return pres;
}

(async () => {
  let anzahl = 0;
  for (const lf of DATA.lernfelder) for (const e of lf.einheiten) for (const t of e.themen) {
    if (nur.length && !nur.includes(t.id)) continue;
    const v = VORTRAG[t.id];
    if (!v) { console.log("ÜBERSPRUNGEN (keine Sprechernotizen):", t.id); continue; }
    if (v.abschnitte.length !== t.zettel.length) throw new Error(`${t.id}: ${v.abschnitte.length} Notizen, aber ${t.zettel.length} Abschnitte`);
    const ordner = path.join(ziel, lf.titel);
    fs.mkdirSync(ordner, { recursive: true });
    const datei = path.join(ordner, dateiname(`${e.id} ${t.titel}`) + ".pptx");
    const pres = baueDeck(lf, e, t, v);
    await pres.writeFile({ fileName: datei });
    await applyTheme(datei, THEME);
    await animiere(datei);
    console.log("geschrieben:", datei);
    anzahl++;
  }
  console.log(anzahl, "Präsentationen");
})().catch((err) => { console.error(err); process.exit(1); });
