# ImmoAdv

ImmoAdv is maintained separately from ToyBite.

- GitHub: YY121s/ImmoAdv
- Vercel: immoadv
- Production domain: immoadv.de

ToyBite repositories and deployments are intentionally not used by this project.

## Designregeln

- **Bezahl-Knöpfe** (Jetzt buchen, Weiter zur Bezahlung, Tarif buchen, Testkauf) immer mit Klasse `btn-pay`: schwarz mit weißer Schrift im Stil von Apple Pay. Auf der Stripe-Bezahlseite: Stripe → Einstellungen → Branding → Akzent-/Buttonfarbe `#000000` (Test- und Live-Modus).
- **Rechnungen für die Steuerkanzlei**: nur als ZIP-Download (Web-Admin → Rechnungen-ZIP), Dateiname beginnt mit dem Rechnungsdatum `JJJJ-MM-TT_Rechnungsnummer_Kunde.pdf`; kein automatischer E-Mail-Versand.
