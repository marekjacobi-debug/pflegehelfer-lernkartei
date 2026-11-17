"""Tests: python3 -m unittest discover -s tests -v

Die Beispiel-Lehrkräfte hier ("Frau Ahorn", "Herr Birke") sind ausgedacht.
"""
import json
import pathlib
import sys
import tempfile
import unittest

WURZEL = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WURZEL))

from anonymisieren import alle_themen, anonymisieren, namen_im_text, namensliste_lesen, pruefe_oeffentlich  # noqa: E402
from bauen import seite_bauen  # noqa: E402

BEISPIEL = WURZEL / "tests" / "beispiel"


def beispiel_daten():
    return json.loads((BEISPIEL / "beispiel_mit_namen.json").read_text(encoding="utf-8"))


class Anonymisieren(unittest.TestCase):
    def setUp(self):
        # "Birke" steht nur im Text -> kommt über die private Namensliste dazu
        self.daten, self.bericht = anonymisieren(beispiel_daten(), {"Birke"})
        self.text = json.dumps(self.daten, ensure_ascii=False)

    def test_keine_namen_mehr(self):
        self.assertEqual(namen_im_text(self.text, {"Ahorn", "Birke"}), [])
        self.assertEqual(self.bericht["namen"], 2)

    def test_felder_bereinigt(self):
        self.assertEqual(pruefe_oeffentlich(self.daten), [])
        self.assertNotIn("dateien", self.daten)
        thema = next(alle_themen(self.daten))
        self.assertEqual(thema["lehrkraft"], "")
        self.assertEqual(thema["quellen"], ["Lagerung.docx"])

    def test_formulierungen(self):
        thema = next(alle_themen(self.daten))
        self.assertIn("Quelle: Unterricht (Lagerung)", thema["grafiken"][0]["svg"])
        self.assertEqual(thema["zettel"][0]["punkte"][0], "Laut der Lehrkraft alle 2 Stunden umlagern.")
        self.assertEqual(thema["zettel"][0]["punkte"][1], "Lehrkraft hat das vorgemacht.")
        self.assertEqual(thema["hinweis"], "Ergänzt nach Rücksprache mit der Lehrkraft.")

    def test_unbekannter_name_wird_gemeldet(self):
        _, bericht = anonymisieren(beispiel_daten())
        self.assertEqual(bericht["verdacht"], ["Birke"])  # Frau Schulz (Fallbeispiel) wird nicht gemeldet
        _, bericht = anonymisieren(beispiel_daten(), ausgedacht={"Birke"})
        self.assertEqual(bericht["verdacht"], [])

    def test_name_der_auch_ein_wort_ist(self):
        daten, _ = anonymisieren(beispiel_daten(), {"Birke"}, nur_titel={"Birke"})
        thema = next(alle_themen(daten))
        self.assertEqual(thema["hinweis"], "Ergänzt nach Rücksprache mit der Lehrkraft.")
        self.assertIn("Eine Birke biegt sich", thema["karten"][1]["a"])

    def test_namensliste(self):
        with tempfile.TemporaryDirectory() as tmp:
            datei = pathlib.Path(tmp) / "lehrkraefte_privat.txt"
            datei.write_text("# Kommentar\nFrau Ahorn\ntitel: Herr Birke\nok: Schulz, Meier\n", encoding="utf-8")
            self.assertEqual(namensliste_lesen(datei), ({"Ahorn", "Birke"}, {"Schulz", "Meier"}, {"Birke"}))

    def test_ausgedachte_patientennamen_bleiben(self):
        thema = next(alle_themen(self.daten))
        self.assertIn("Frau Schulz (82)", thema["faelle"][0]["situation"])

    def test_original_unveraendert(self):
        original = beispiel_daten()
        anonymisieren(original)
        self.assertIn("Frau Ahorn", json.dumps(original, ensure_ascii=False))


class Bauen(unittest.TestCase):
    def test_beispiel_seite(self):
        daten, _ = anonymisieren(beispiel_daten())
        with tempfile.TemporaryDirectory() as tmp:
            inhalte = pathlib.Path(tmp) / "inhalte.json"
            inhalte.write_text(json.dumps(daten, ensure_ascii=False), encoding="utf-8")
            ziel, _ = seite_bauen(BEISPIEL / "vorlage.html", inhalte, pathlib.Path(tmp) / "index.html")
            seite = ziel.read_text(encoding="utf-8")
        self.assertTrue(seite.startswith("<!doctype html>"))
        self.assertNotIn("/*INHALTE*/null", seite)
        self.assertIn('"titel":"Lagerung"', seite)

    def test_unbereinigte_daten_werden_abgelehnt(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(SystemExit):
                seite_bauen(BEISPIEL / "vorlage.html", BEISPIEL / "beispiel_mit_namen.json", pathlib.Path(tmp) / "x.html")


@unittest.skipUnless((WURZEL / "daten" / "inhalte.json").exists(), "noch keine echten Daten im Repo")
class EchteDaten(unittest.TestCase):
    def setUp(self):
        self.daten = json.loads((WURZEL / "daten" / "inhalte.json").read_text(encoding="utf-8"))

    def test_bereinigt(self):
        self.assertEqual(pruefe_oeffentlich(self.daten), [])

    def test_seite_baut(self):
        with tempfile.TemporaryDirectory() as tmp:
            seite_bauen(WURZEL / "vorlage.html", WURZEL / "daten" / "inhalte.json", pathlib.Path(tmp) / "index.html")

    def test_ids_eindeutig(self):
        ids = []
        for thema in alle_themen(self.daten):
            ids.append(thema["id"])
            for art in ("karten", "quiz", "luecken", "zuordnen", "faelle", "grafiken"):
                ids += [x["id"] for x in thema.get(art, []) if "id" in x]
        doppelt = sorted({i for i in ids if ids.count(i) > 1})
        self.assertEqual(doppelt, [], "doppelte IDs")


if __name__ == "__main__":
    unittest.main()
