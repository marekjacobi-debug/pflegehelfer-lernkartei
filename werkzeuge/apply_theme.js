// Give a deck pptxgenjs wrote its own theme colors and theme name. pptxgenjs sets the theme's
// two fonts (pres.theme) but hard-codes Office's palette, so scheme colors resolve to Office
// blue and orange until the deck's colors are written into ppt/theme/theme1.xml.
//
//   const { applyTheme } = require("./apply_theme.js");
//   await pres.writeFile({ fileName: "deck.pptx" });
//   await applyTheme("deck.pptx", { name: "Northwind", colors: { dk1, lt1, dk2, lt2, accent1..accent6, hlink, folHlink } });
//
//   node apply_theme.js deck.pptx theme.json [out.pptx]     # the same, from a shell
//
// Colors are six hex digits, no "#". The deck is rewritten in place unless a third argument
// names another file. It throws, changing nothing, if a color anywhere in the deck is not six hex digits.
const fs = require("fs");

function loadJSZip() {
	try {
		return require(require.resolve("jszip", { paths: [require.resolve("pptxgenjs")] }));
	} catch {
		throw new Error(`pptxgenjs and the jszip that comes with it cannot be found from ${__filename}. If pptxgenjs is installed beside your own script, run node with NODE_PATH set to that node_modules folder. Nothing was changed.`);
	}
}

const SLOTS = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];

function themeXml(xml, theme) {
	if (!theme || !theme.name) throw new Error("theme.name is required. Nothing was changed.");
	const name = String(theme.name).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	const colors = theme.colors || theme;
	for (const k of SLOTS) {
		if (!/^[0-9A-Fa-f]{6}$/.test(String(colors[k]))) throw new Error(`theme.colors.${k} is ${JSON.stringify(colors[k])}; it must be six hex digits with no "#" (slots: ${SLOTS.join(" ")}). Nothing was changed.`);
	}
	const scheme = `<a:clrScheme name="${name}">` + SLOTS.map((k) => `<a:${k}><a:srgbClr val="${String(colors[k]).toUpperCase()}"/></a:${k}>`).join("") + "</a:clrScheme>";
	const out = xml
		.replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, () => scheme)
		.replace(/(<a:(?:theme|fontScheme)\b[^>]*?\bname=")[^"]*"/g, (_, head) => `${head}${name}"`);
	if (!out.includes(scheme)) throw new Error("ppt/theme/theme1.xml has no <a:clrScheme> to replace; this script expects the theme part pptxgenjs writes. Nothing was changed.");
	return out;
}

async function applyTheme(deckPath, theme, outPath = deckPath) {
	const zip = await loadJSZip().loadAsync(fs.readFileSync(deckPath));
	const part = "ppt/theme/theme1.xml";
	if (!zip.file(part)) throw new Error(`${deckPath} has no ${part}; this script is for decks pptxgenjs wrote. Nothing was changed.`);
	zip.file(part, themeXml(await zip.file(part).async("string"), theme));
	for (const name of Object.keys(zip.files)) {
		if (!name.endsWith(".xml")) continue;
		const bad = (await zip.file(name).async("string")).match(/<a:srgbClr val="((?![0-9A-Fa-f]{6}")[^"]*)"/);
		if (bad) throw new Error(`${name} has an <a:srgbClr> whose val is "${bad[1]}", not six hex digits. Usually a scheme color was given to an option that takes hex only (valGridLine.color, catGridLine.color, shadow.color, or chartColors / invertedColors on a one-series bar chart). Pass the six-digit hex from your theme object there and rebuild. Nothing was changed.`);
	}
	fs.writeFileSync(outPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

module.exports = { applyTheme };

if (require.main === module) {
	const [deck, themeFile, out] = process.argv.slice(2);
	if (!deck || !themeFile) {
		console.error("usage: node apply_theme.js deck.pptx theme.json [out.pptx]");
		process.exit(2);
	}
	let theme;
	try {
		theme = JSON.parse(fs.readFileSync(themeFile, "utf8"));
	} catch (e) {
		console.error(`Error: cannot read ${themeFile} as JSON (${e.message}). Nothing was changed.`);
		process.exit(1);
	}
	applyTheme(deck, theme, out || deck).then(
		() => console.log(`Theme written to ${out || deck}`),
		(e) => { console.error(`Error: ${e.message}`); process.exit(1); }
	);
}
