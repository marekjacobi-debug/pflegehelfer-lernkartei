// Rendert die Lerngrafiken (SVG aus inhalte.json → themen[].grafiken[].svg, oder aus grafiken.json) als PNG
// Aufruf: node render_grafiken.js <inhalte.json|grafiken.json> <zielordner>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [quelle, ziel] = process.argv.slice(2);
const D = JSON.parse(fs.readFileSync(quelle, 'utf8'));
const liste = [];
if (D.lernfelder) { for (const lf of D.lernfelder) for (const e of lf.einheiten) for (const t of e.themen) for (const g of (t.grafiken || [])) liste.push(g); }
else for (const [id, g] of Object.entries(D)) liste.push({ id, ...g });
(async () => {
  fs.mkdirSync(ziel, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  for (const g of liste) {
    await p.setContent('<html><body style="margin:0">' + g.svg + '</body></html>'); await p.waitForTimeout(100);
    await p.screenshot({ path: path.join(ziel, g.id + '.png'), clip: { x: 0, y: 0, width: 1600, height: 900 } });
  }
  await b.close(); console.log(liste.length, 'PNG');
})();
