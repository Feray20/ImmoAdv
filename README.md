# ImmoAdv

ImmoAdv is maintained separately from ToyBite.

- GitHub: YY121s/ImmoAdv
- Vercel: immoadv
- Production domain: immoadv.de

ToyBite repositories and deployments are intentionally not used by this project.

## Designregeln

- **Bezahl-Knöpfe** (Jetzt buchen, Weiter zur Bezahlung, Tarif buchen, Testkauf) immer mit Klasse `btn-pay`: schwarz mit weißer Schrift im Stil von Apple Pay, mit Warenkorb-Symbol (automatisch per CSS) bzw. Schloss im Kaufdialog. Angebotskarten tragen ein farbiges Symbol je Tarif (`planIcon` in buy.mjs). In Werkzeugen keine Werbeblöcke – höchstens ein dezenter Einzeiler. Auf der Stripe-Bezahlseite: Stripe → Einstellungen → Branding → Akzent-/Buttonfarbe `#000000` (Test- und Live-Modus).
- **Rechnungen für die Steuerkanzlei**: nur als ZIP-Download (Web-Admin → Rechnungen-ZIP), Dateiname beginnt mit dem Rechnungsdatum `JJJJ-MM-TT_Rechnungsnummer_Kunde.pdf`; kein automatischer E-Mail-Versand.
- **Angemeldet keine Beispielzahlen**: Software-Tools, Suche und Analyse starten mit den Werten aus Objekt und Finanzprofil; ohne Daten bleiben Felder leer (mit Hinweis). Fiktive Zahlen gibt es nur auf öffentlichen Seiten und in den Muster-PDFs (`/api/mustermappe`), dort für Kreditmappe und Objekt-Analyse identisch.
- **Tarifstufen sichtbar unterscheiden**: Privat – Kostenlos (3 Basis-Tools), Käufer-Pass (Kauf-Tools, Druck, Vorlagen), Investor Pro (Portfolio, Anschluss & Forward, Betriebskosten). B2B – Basic, Pro („Alles aus Basic, plus“), Enterprise. Leistungsvergleich je Bereich in `preise.json` unter `vergleich`.
- **Einsteiger und Profi** unterscheiden sich in Reihenfolge, Erklärtiefe und Fachlogik (Profi: Beleihungsauslauf, normierter Angebotsvergleich, Steuerwirkung der Sondertilgung, Portfolio-Stresstest, Bestandskennzahlen im Cockpit) – keine 1:1 gleichen Texte.
- **Unternehmensportal**: Navigation gruppiert (Tagesgeschäft · Werkzeuge & Wissen · Konto), kein Link „Zur Anwendung“; Fachwissen heißt „Beratungskompass“.
