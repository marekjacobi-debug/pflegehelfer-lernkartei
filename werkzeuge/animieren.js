// Fügt den von build_praesentationen.js erzeugten Präsentationen Animationen hinzu:
// - jede Folie: sanftes Überblenden (Fade) als Folienübergang
// - Inhaltsfolien: Karten/Felder/Punkte, Merksätze und Fragen erscheinen einzeln per Klick (Einblenden)
// - Gliederung und Kernaussage: Punkte blenden nach dem Folienwechsel automatisch nacheinander ein
// Gruppen werden über die objectName-Präfixe erkannt ("Feld 3", "Feld 3 Nummer", "Feld 3 Text" …).
const fs = require("fs");

function loadJSZip() {
  return require(require.resolve("jszip", { paths: [require.resolve("pptxgenjs")] }));
}

const KLICK = /^(Karte|Feld|Punkt|Merksatz|Frage) (\d+)\b/;
const AUTO = /^(Gliederung) (\d+)\b|^(Kernaussage)\b/;

function effekt(spid, ids, typ, delay) {
  const a = ids.next(), b = ids.next(), c = ids.next();
  return `<p:par><p:cTn id="${a}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="${typ}"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst>` +
    `<p:set><p:cBhvr><p:cTn id="${b}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>` +
    `<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${c}" dur="450"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:animEffect>` +
    `</p:childTnLst></p:cTn></p:par>`;
}

function animiereFolie(xml) {
  // pptxgenjs vergibt die Foliennummer-ID doppelt – doppelte IDs neu nummerieren
  let max = 0;
  xml.replace(/<p:cNvPr id="(\d+)"/g, (_, id) => { max = Math.max(max, +id); return _; });
  const gesehen = new Set();
  xml = xml.replace(/<p:cNvPr id="(\d+)"/g, (m, id) => {
    if (gesehen.has(id)) return `<p:cNvPr id="${++max}"`;
    gesehen.add(id); return m;
  });

  // Gruppen sammeln (Reihenfolge wie auf der Folie)
  const gruppen = new Map(); let modus = null;
  for (const m of xml.matchAll(/<p:cNvPr id="(\d+)" name="([^"]*)"/g)) {
    const [, id, name] = m;
    let k = name.match(KLICK), schluessel = null;
    if (k) { schluessel = `${k[1]} ${k[2]}`; modus = modus || "klick"; }
    else if ((k = name.match(AUTO))) { schluessel = k[1] ? `${k[1]} ${k[2]}` : k[3]; modus = modus || "auto"; }
    if (!schluessel) continue;
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, []);
    gruppen.get(schluessel).push(id);
  }

  const uebergang = `<p:transition spd="med"><p:fade/></p:transition>`;
  let timing = "";
  if (gruppen.size) {
    let n = 2; const ids = { next: () => ++n };
    let inner = "";
    const liste = [...gruppen.values()];
    if (modus === "klick") {
      for (const g of liste) {
        const aussen = ids.next(), mitte = ids.next();
        const eff = g.map((spid, i) => effekt(spid, ids, i === 0 ? "clickEffect" : "withEffect", 0)).join("");
        inner += `<p:par><p:cTn id="${aussen}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${mitte}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${eff}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`;
      }
    } else {
      const aussen = ids.next(), mitte = ids.next();
      const eff = liste.map((g, gi) => g.map((spid) => effekt(spid, ids, "withEffect", 300 + gi * 250)).join("")).join("");
      inner = `<p:par><p:cTn id="${aussen}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="${mitte}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${eff}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`;
    }
    const bld = liste.flat().map((spid) => `<p:bldP spid="${spid}" grpId="0" animBg="1"/>`).join("");
    timing = `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
      `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${inner}</p:childTnLst></p:cTn>` +
      `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>` +
      `</p:childTnLst></p:cTn></p:par></p:tnLst><p:bldLst>${bld}</p:bldLst></p:timing>`;
  }
  if (!xml.includes("</p:clrMapOvr>")) throw new Error("Folie ohne <p:clrMapOvr> – Animation nicht möglich");
  return xml.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + uebergang + timing);
}

async function animiere(datei) {
  const JSZip = loadJSZip();
  const zip = await JSZip.loadAsync(fs.readFileSync(datei));
  for (const name of Object.keys(zip.files)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) continue;
    const xml = await zip.file(name).async("string");
    if (xml.includes("<p:timing>") || xml.includes("<p:transition")) continue;
    zip.file(name, animiereFolie(xml));
  }
  fs.writeFileSync(datei, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

module.exports = { animiere };
