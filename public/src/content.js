/* ImmoAdv – Inhalte der Wissenszentrale und Rechtsseiten.
   Struktur ist maschinenlesbar (window.IA_CONTENT), damit sie auch als JSON exportiert werden kann.
   Alle Beispielzahlen sind fiktiv und dienen nur der Erklärung. */
window.IA_CONTENT = {
  disclaimer: 'Reines technisches Analyse-, Informations- und Vorbereitungsinstrument. Keine Rechts-, Steuer- oder Finanzierungsberatung gem. § 34i GewO / KWG.',
  faq: [
    // 1. Orientierung & Leistbarkeit
    { cat: 'Orientierung & Leistbarkeit', q: 'Wie viel Immobilie kann ich mir leisten?',
      l1: 'Entscheidend ist nicht der Kaufpreis, sondern die monatliche Rate, die nach allen Lebenshaltungskosten dauerhaft übrig bleibt. Banken rechnen dafür mit Pauschalen, nicht mit Ihrem Wunschbudget.',
      next: 'Nettoeinkommen und Eigenkapital im kostenlosen Konto hinterlegen; die Haushaltsrechnung der Mustermappe zeigt das Schema.',
      l2: 'Bankpraxis: Nettoeinkommen minus Lebenshaltungspauschale (häufig 800–1.200 € für die erste Person, 300–400 € je weitere Person), minus Warmmiete bzw. künftige Bewirtschaftungskosten, minus bestehende Raten = maximal tragbare Rate. Daraus ergibt sich über die Annuität das Darlehen: Darlehen = Rate × 12 ÷ (Sollzins + anfängliche Tilgung). Beispiel (fiktiv): 900 € Rate, 3,8 % Zins, 2 % Tilgung → 900 × 12 ÷ 0,058 ≈ 186.207 € Darlehen. Die genauen Pauschalen legt jede Bank selbst fest.' },
    { cat: 'Orientierung & Leistbarkeit', q: 'Wie viel Eigenkapital brauche ich?',
      l1: 'Als Faustregel sollten mindestens die Kaufnebenkosten aus Eigenkapital bezahlt werden, besser zusätzlich 10–20 % des Kaufpreises. Eine Notfallreserve von 3–6 Monatsausgaben gehört nicht in die Finanzierung.',
      next: 'Eigenkapital im Rechner auf der Startseite eintragen und die Reserve getrennt einplanen.',
      l2: 'Je höher der Beleihungsauslauf (Darlehen ÷ Beleihungswert), desto höher meist der Zinsaufschlag. Vollfinanzierungen (110 %) sind möglich, verlangen aber in der Regel sehr gute Bonität und kosten spürbar mehr Zins. ImmoAdv-Scorecard: Grün nur, wenn Nebenkosten + 10 % Kaufpreis gedeckt sind und die Reserve erhalten bleibt.' },
    { cat: 'Orientierung & Leistbarkeit', q: 'Welche Nebenkosten kommen zum Kaufpreis dazu?',
      l1: 'Grunderwerbsteuer, Notar und Grundbuch sowie ggf. Maklerprovision. Je nach Bundesland sind das zusammen rund 7–15 % des Kaufpreises.',
      next: 'Den Nebenkosten-Prozentsatz Ihres Bundeslands im Rechner auf der Startseite eintragen.',
      l2: 'Grunderwerbsteuer: 3,5–6,5 % je nach Bundesland (z. B. Hessen 6,0 %, Bayern 3,5 %). Notar und Grundbuch: rund 1,5–2,0 %. Maklerprovision bei Wohnungen und Einfamilienhäusern für Verbraucher: höchstens hälftige Teilung (§§ 656a ff. BGB), üblich bis 3,57 % inkl. USt je Seite. Beispiel (fiktiv, Hessen, ohne Makler): 300.000 € × (6,0 % + 1,8 %) = 23.400 €.' },
    { cat: 'Orientierung & Leistbarkeit', q: 'Was bedeuten Zins, Tilgung, Annuität und Zinsbindung?',
      l1: 'Die Annuität ist Ihre gleichbleibende Rate aus Zins und Tilgung. Mit jeder Rate sinkt die Restschuld, dadurch wird der Zinsanteil kleiner und der Tilgungsanteil größer.',
      next: 'Zins und Tilgung im Rechner auf der Startseite variieren.',
      l2: 'Jahresrate = Darlehen × (Sollzins + anfängliche Tilgung). Die Zinsbindung (z. B. 10 oder 15 Jahre) legt fest, wie lange der Zins fest ist; danach wird die Restschuld zu neuen Konditionen weiterfinanziert. Restschuld nach n Jahren (monatlich): K·(1+i)^m − R·((1+i)^m − 1)/i mit i = Monatszins, m = Monate, R = Monatsrate.' },
    { cat: 'Orientierung & Leistbarkeit', q: 'Warum unterscheidet die Bank nach Beruf und Einkommensart?',
      l1: 'Die Bank bewertet, wie sicher Ihr Einkommen in den nächsten Jahren ist. Beamte und unbefristet Angestellte gelten als planbar, Selbstständige und Befristete als schwankender.',
      next: 'In der Unterlagen-Checkliste nach Ihrem Erwerbsstatus filtern.',
      l2: 'Angestellte: Probezeit beendet, variable Anteile nur mit Historie. Befristete: oft zweiter Darlehensnehmer nötig. Beamte: PKV-Beiträge werden abgezogen. Selbstständige: in der Regel 2–3 Jahresabschlüsse/Steuerbescheide und aktuelle BWA, Mindestbestehensdauer meist 2–3 Jahre. Studierende/Arbeitslose: ohne solventen Mitantragsteller in der Regel nicht finanzierbar. Rentner: Altersgrenzen und Restlaufzeit begrenzen Laufzeit und Höhe.' },
    { cat: 'Orientierung & Leistbarkeit', q: 'Was ist eine Haushaltsrechnung und was gehört hinein?',
      l1: 'Eine Gegenüberstellung aller monatlichen Einnahmen und Ausgaben nach Bankschema. Sie zeigt, ob die neue Rate dauerhaft tragbar ist.',
      next: 'Haushaltsrechnung der Mustermappe als Vorlage nutzen.',
      l2: 'Einnahmen: Nettogehälter (12 oder 13/14 Gehälter laut Bank), Kindergeld, künftige Mieteinnahmen (meist nur 70–80 % angesetzt). Ausgaben: Lebenshaltungspauschale, Warmmiete oder Hausgeld, Versicherungen, PKV, Kfz, bestehende Kredite, neue Rate. Der Überschuss sollte deutlich positiv bleiben; die genaue Mindestgröße legt jede Bank selbst fest.' },
    { cat: 'Orientierung & Leistbarkeit', q: 'Wie hoch darf die monatliche Belastung sein?',
      l1: 'Als grobe Orientierung gilt: Die Rate sollte nicht mehr als etwa 35–40 % des Haushaltsnettos betragen. Entscheidend bleibt aber der Überschuss nach der Haushaltsrechnung.',
      next: 'Rate im Rechner ermitteln und durch Ihr Haushaltsnetto teilen.',
      l2: 'Belastungsquote = Monatsrate ÷ Haushaltsnetto. Eine Quote ist nur eine Faustregel; bei hohem Einkommen ist mehr tragbar, bei Familien mit Kindern weniger. Banken prüfen zusätzlich den Anschlusszins (siehe Anschlusszins-Kipp-Punkt).' },
    // 2. Objektauswahl & Kaufentscheidung
    { cat: 'Objektauswahl & Kaufentscheidung', q: 'Was ist der Beleihungswert?',
      l1: 'Der Wert, den die Bank dauerhaft für sicher hält. Er liegt meist unter dem Kaufpreis und bestimmt, wie viel Kredit zu guten Konditionen möglich ist.',
      next: 'Darlehen und Beleihungswert im Cockpit eintragen – der Beleihungsauslauf wird berechnet.',
      l2: 'Grundlage ist die Beleihungswertermittlungsverordnung (BelWertV) bzw. bankinterne Verfahren. Typisch sind Abschläge von 10–20 % auf den Marktwert. Beleihungsauslauf = Darlehen ÷ Beleihungswert. Bis 60 % gilt als erstrangig (Pfandbrief-fähig), darüber wird es teurer; der Teil über dem Beleihungswert heißt Blankoanteil.' },
    { cat: 'Objektauswahl & Kaufentscheidung', q: 'Eigentumswohnung: Was sagen Teilungserklärung, Protokolle und Rücklage?',
      l1: 'Diese Unterlagen zeigen, was Ihnen gehört, welche Sanierungen anstehen und ob genug Geld dafür da ist. Sie sind für die Bank und für Sie Pflichtlektüre.',
      next: 'WEG-Unterlagen in der Checkliste abhaken.',
      l2: 'Teilungserklärung: Sondereigentum, Sondernutzungsrechte, Kostenverteilung. Protokolle der letzten 3 Eigentümerversammlungen: beschlossene Sonderumlagen, Streit, Sanierungsstau. Wirtschaftsplan und Erhaltungsrücklage: Als grobe Orientierung gelten mindestens 1,00–1,50 € je m² Wohnfläche und Monat, bei älteren Gebäuden mehr.' },
    { cat: 'Objektauswahl & Kaufentscheidung', q: 'Wie prüfe ich eine Eigentumswohnung?',
      l1: 'In drei Schritten: Lage und Miete, Zustand von Wohnung und Gemeinschaftseigentum, Zahlen der Eigentümergemeinschaft. Erst danach lohnt die Finanzierungsanfrage.',
      next: 'Objektunterlagen in der Checkliste abhaken (Filter „Eigentumswohnung“).',
      l2: 'Lage: Mietspiegel, Leerstand, Infrastruktur. Zustand: Baujahr, Dach, Fenster, Heizung, Energieausweis (seit 29.07.2026 nach dem Gebäudemodernisierungsgesetz, zuvor GEG). WEG: Rücklage, Hausgeld, Sonderumlagen, Protokolle. Rechtliches: Grundbuch Abt. II (Lasten, Wegerechte) und Abt. III (Grundpfandrechte).' },
    { cat: 'Objektauswahl & Kaufentscheidung', q: 'Wie kann ich mehrere Objekte vergleichen?',
      l1: 'Vergleichen Sie nie nur Kaufpreise, sondern Kaufpreis je m², Mietrendite und Cashflow nach allen Kosten. Erfassen Sie alle Objekte mit denselben Annahmen.',
      next: 'Bis zu 3 Objekte im kostenlosen Konto speichern und jeweils im Rechner prüfen.',
      l2: 'Vergleichsgrößen: Kaufpreis je m², Kaufpreisfaktor (Kaufpreis ÷ Jahreskaltmiete), Nettomietrendite, Cashflow vor/nach Steuern, Instandhaltungsbedarf, Rücklage je m². Gleiche Annahmen für Zins, Leerstand und Instandhaltung sind Voraussetzung für einen fairen Vergleich.' },
    { cat: 'Objektauswahl & Kaufentscheidung', q: 'Welche Unterlagen fehlen typischerweise?',
      l1: 'Am häufigsten fehlen aktuelle Grundbuchauszüge, Wohnflächenberechnungen, WEG-Protokolle und bei Selbstständigen die aktuelle BWA. Fehlende Unterlagen verzögern die Bankprüfung.',
      next: 'Unterlagen-Checkliste nach Ihrem Erwerbsstatus filtern.',
      l2: 'Die Checkliste unterscheidet „erforderlich“ und „fallweise“. Grundbuchauszug: meist nicht älter als 3 Monate. Gehaltsnachweise: die letzten 3 Monate. Steuerbescheide: die letzten 2–3 Jahre. Was eine Bank konkret verlangt, entscheidet sie selbst.' },
    // 3. Kapitalanlage & Vermögensaufbau
    { cat: 'Kapitalanlage & Vermögensaufbau', q: 'Brutto-, Netto- und Eigenkapitalrendite: Was ist der Unterschied?',
      l1: 'Die Bruttorendite schaut nur auf Miete und Kaufpreis. Die Nettorendite zieht Kosten ab, die Eigenkapitalrendite zeigt, was Ihr eingesetztes Geld verdient.',
      next: 'Alle drei Werte im Rechner vergleichen.',
      l2: 'Bruttomietrendite = Jahreskaltmiete ÷ Kaufpreis. Nettomietrendite = (Jahreskaltmiete − nicht umlagefähige Kosten − Instandhaltung − Mietausfall) ÷ (Kaufpreis + Nebenkosten). Eigenkapitalrendite = jährlicher Überschuss nach Zins (ggf. nach Steuern, ggf. inkl. Tilgung) ÷ eingesetztes Eigenkapital.' },
    { cat: 'Kapitalanlage & Vermögensaufbau', q: 'Was ist die Nettomietrendite?',
      l1: 'Die Rendite nach den Kosten, die Sie als Vermieter selbst tragen. Sie liegt immer unter der Bruttorendite aus dem Exposé.',
      next: 'Bewirtschaftungskosten und Leerstand im Rechner auf der Startseite eintragen.',
      l2: 'Formel: (Jahreskaltmiete − nicht umlagefähige Bewirtschaftungskosten − Instandhaltung − Mietausfallwagnis) ÷ Gesamtinvestition inkl. Nebenkosten. Beispiel (fiktiv): (9.360 − 576 − 1.020 − 187) ÷ 189.783 ≈ 3,99 %.' },
    { cat: 'Kapitalanlage & Vermögensaufbau', q: 'Was bedeutet Cashflow vor und nach Steuern?',
      l1: 'Cashflow vor Steuern ist, was nach Miete, Kosten und Kreditrate monatlich übrig bleibt oder fehlt. Nach Steuern kommt die Steuerwirkung aus AfA und Zinsen hinzu.',
      next: 'Grenzsteuersatz, Gebäudeanteil und AfA-Satz im Rechner eintragen.',
      l2: 'Cashflow v. St. = Miete − Bewirtschaftung − Instandhaltung − Mietausfall − Zins − Tilgung. Steuerliches Ergebnis = Miete − Werbungskosten (Zins, Bewirtschaftung, AfA). Ist es negativ, mindert es das zu versteuernde Einkommen. Cashflow n. St. = Cashflow v. St. − (steuerliches Ergebnis × persönlicher Grenzsteuersatz). Tilgung ist nicht steuerlich abziehbar, AfA nicht liquiditätswirksam.' },
    { cat: 'Kapitalanlage & Vermögensaufbau', q: 'Wie funktioniert die AfA?',
      l1: 'Die Absetzung für Abnutzung verteilt die Gebäudekosten über die Nutzungsdauer und mindert jährlich Ihre Steuerlast. Grund und Boden wird nicht abgeschrieben.',
      next: 'Gebäudeanteil und AfA-Satz im Rechner eintragen; Details mit Steuerberatung klären.',
      l2: 'Linear nach § 7 Abs. 4 EStG: 3 % bei Fertigstellung ab 2023, 2 % bei Fertigstellung 1925–2022, 2,5 % vor 1925. Degressiv nach § 7 Abs. 5a EStG: 5 % vom Restwert für neue Wohngebäude mit Baubeginn zwischen 01.10.2023 und 30.09.2029. Bemessungsgrundlage ist nur der Gebäudeanteil; die Aufteilung kann mit der Arbeitshilfe des BMF erfolgen. Die steuerliche Wirkung hängt vom persönlichen Steuersatz ab – bitte mit Steuerberatung abstimmen.' },
    { cat: 'Kapitalanlage & Vermögensaufbau', q: 'Was ist die 15-%-Grenze bei Renovierungen?',
      l1: 'Wer innerhalb von drei Jahren nach dem Kauf mehr als 15 % des Gebäudewerts netto renoviert, kann diese Kosten nicht sofort absetzen. Sie werden dann über die AfA verteilt.',
      next: 'Grenze im Rechner unter „Kaufpreisaufteilung und 15-%-Grenze“ berechnen.',
      l2: 'Anschaffungsnahe Herstellungskosten nach § 6 Abs. 1 Nr. 1a EStG: Instandsetzungs- und Modernisierungskosten innerhalb von 3 Jahren nach Anschaffung, die ohne USt 15 % der Gebäude-Anschaffungskosten übersteigen. Beispiel (fiktiv, Mustermappe): Gebäude-Anschaffungskosten 151.826,40 € (80 % von 189.783 €) → Grenze 22.773,96 € netto.' },
    { cat: 'Kapitalanlage & Vermögensaufbau', q: 'Wann ist ein Verkauf steuerfrei?',
      l1: 'Bei vermieteten Immobilien ist der Gewinn aus einem Verkauf nach mehr als zehn Jahren zwischen Kauf und Verkauf in der Regel steuerfrei. Selbstgenutzte Immobilien haben eigene Regeln.',
      next: 'Kaufdatum unter „Fristen“ eintragen und die Termine als Kalenderdatei speichern.',
      l2: 'Private Veräußerungsgeschäfte nach § 23 Abs. 1 Nr. 1 EStG. Ausnahme bei Selbstnutzung im Verkaufsjahr und den beiden Vorjahren. Bei Verkauf innerhalb der Frist wird der Gewinn mit dem persönlichen Steuersatz versteuert; die AfA erhöht dabei den Gewinn.' },
    { cat: 'Kapitalanlage & Vermögensaufbau', q: 'Wie funktioniert die Mietpreisbremse?',
      l1: 'In ausgewiesenen Gebieten darf die Miete bei Neuvermietung höchstens 10 % über der ortsüblichen Vergleichsmiete liegen. Es gibt Ausnahmen, etwa für Neubauten und umfassend modernisierte Wohnungen.',
      next: 'Ortsübliche Vergleichsmiete im Mietspiegel Ihrer Gemeinde nachschlagen.',
      l2: '§ 556d BGB; Ausnahmen in §§ 556e, 556f BGB (höhere Vormiete, Modernisierung, Erstbezug nach dem 01.10.2014). Welche Gemeinden betroffen sind, legen die Landesregierungen per Verordnung fest. Die Grenze ist rechtlich bindend, eine zu hohe Miete kann zurückgefordert werden.' },
    { cat: 'Kapitalanlage & Vermögensaufbau', q: 'Was ist die Kappungsgrenze?',
      l1: 'Bei bestehenden Mietverhältnissen darf die Miete innerhalb von drei Jahren um höchstens 20 % steigen, in angespannten Märkten um höchstens 15 %. Zusätzlich gilt die ortsübliche Vergleichsmiete als Obergrenze.',
      next: 'Kappungsgrenze, Index- und Staffelmiete im Rechner prüfen.',
      l2: '§ 558 Abs. 3 BGB. Die abgesenkte Grenze von 15 % gilt in Gebieten, die die Länder per Verordnung bestimmen. Modernisierungsmieterhöhungen nach § 559 BGB folgen eigenen Regeln.' },
    { cat: 'Kapitalanlage & Vermögensaufbau', q: 'Wie funktioniert eine Staffelmiete?',
      l1: 'Die künftigen Mieterhöhungen werden schon im Mietvertrag mit festen Beträgen und Terminen vereinbart. Dazwischen sind weitere Erhöhungen auf die Vergleichsmiete ausgeschlossen.',
      next: 'Staffeln aus dem Mietvertrag mit dem Mietspiegel abgleichen.',
      l2: '§ 557a BGB: Die Miete muss jeweils mindestens ein Jahr unverändert bleiben und die Erhöhung als Geldbetrag ausgewiesen sein. In Gebieten mit Mietpreisbremse muss jede Staffel für sich die Grenze des § 556d BGB einhalten.' },
    { cat: 'Kapitalanlage & Vermögensaufbau', q: 'Was ist ein Mietausfallwagnis?',
      l1: 'Ein kalkulatorischer Abschlag für Leerstand und ausbleibende Mietzahlungen. Er gehört in jede seriöse Renditerechnung, auch wenn die Wohnung aktuell vermietet ist.',
      next: 'Leerstand in Prozent im Rechner auf der Startseite eintragen.',
      l2: 'Üblich sind 2 % der Jahresnettokaltmiete für Wohnraum (angelehnt an § 29 II. BV), bei schwierigen Lagen oder Gewerbe mehr. Beispiel (fiktiv): 9.360 € × 2 % = 187,20 € pro Jahr.' },
    { cat: 'Kapitalanlage & Vermögensaufbau', q: 'Wie bewerte ich ein Portfolio?',
      l1: 'Ein Portfolio bewerten Sie über Gesamt-Cashflow, gesamte Restschuld und die Termine, an denen Zinsbindungen auslaufen. Ein einzelnes schwaches Objekt kann die ganze Finanzierungsfähigkeit belasten.',
      next: 'Objekte im Konto speichern; die Portfolio-Übersicht zeigt Summen und das Zins-Szenario.',
      l2: 'Kennzahlen: Summe Cashflow v./n. St., gewichteter Zins, Gesamt-LTV (Restschuld ÷ Marktwerte), DSCR (Überschuss vor Kapitaldienst ÷ Kapitaldienst), Fälligkeitsprofil der Zinsbindungen. Banken bewerten bei Folgefinanzierungen die Gesamtverschuldung.' },
    // 4. Finanzierung, Bankenpraxis & Clearing
    { cat: 'Finanzierung & Bankenpraxis', q: 'Was passiert, wenn die Zinsbindung endet?',
      l1: 'Die Restschuld muss zu den dann gültigen Zinsen weiterfinanziert werden. Steigen die Zinsen, steigt Ihre Rate oder die Laufzeit verlängert sich.',
      next: 'Anschlusszins-Tabelle in der Mustermappe ansehen.',
      l2: 'Optionen: Prolongation bei der bisherigen Bank, Umschuldung zu einer anderen Bank, Forward-Darlehen (bis zu ca. 5 Jahre vorher gegen Zinsaufschlag). Nach 10 Jahren ab Vollauszahlung besteht ein gesetzliches Kündigungsrecht mit 6 Monaten Frist (§ 489 Abs. 1 Nr. 2 BGB).' },
    { cat: 'Finanzierung & Bankenpraxis', q: 'Was ist ein Anschlusszins-Kipp-Punkt?',
      l1: 'Der Zinssatz, ab dem Ihr Objekt nach Ende der Zinsbindung keinen positiven Cashflow mehr erwirtschaftet. Je weiter er über dem heutigen Zins liegt, desto robuster ist die Finanzierung.',
      next: 'Stresstest im Cockpit nutzen.',
      l2: 'Berechnung: Restschuld nach Zinsbindung × (Anschlusszins + Tilgung) = verfügbarer Überschuss vor Kapitaldienst, aufgelöst nach dem Zins. In der fiktiven Mustermappe kippt der Cashflow zwischen 4 % und 5 %.' },
    { cat: 'Finanzierung & Bankenpraxis', q: 'Was ist die Kreditmappe?',
      l1: 'Ein strukturiertes PDF mit Vorhaben, Objektdaten, Haushaltsrechnung, Kennzahlen und Unterlagenstatus. Sie hilft Ihnen, gut vorbereitet ins Bankgespräch zu gehen.',
      next: 'Mustermappe ansehen.',
      l2: 'Die Mappe enthält Rechenwege und den Status jeder Unterlage (liegt vor, angefordert, fehlt, ungeprüft). Sie ist keine Finanzierungszusage und ersetzt nicht die Prüfung durch die Bank. Die Kreditmappe ist technisch fertig und wird buchbar, sobald die Zahlungsabwicklung startet (geplant: Einsteiger-Kreditmappe 39,00 €, Profi-Kreditmappe 49,00 € je Objekt, inkl. 19 % USt; im Profi-Abo enthalten). Heute verfügbar sind die fiktive Mustermappe und, nach Anmeldung, eine kostenfreie Vorschau der eigenen Kreditmappe (mit Wasserzeichen, ohne Echtheits-QR).' },
    { cat: 'Finanzierung & Bankenpraxis', q: 'Was gehört in eine Kreditmappe?',
      l1: 'Selbstauskunft, Einkommens- und Eigenkapitalnachweise sowie alle Objektunterlagen. Je vollständiger, desto schneller kann die Bank prüfen.',
      next: 'Unterlagen-Checkliste durchgehen.',
      l2: 'Person: Ausweis, Selbstauskunft, Gehaltsnachweise, Steuerbescheide, Eigenkapitalnachweis, bestehende Kredite. Objekt: Exposé, Grundbuchauszug, Flurkarte, Grundrisse, Wohnflächenberechnung, Energieausweis, bei ETW Teilungserklärung, Protokolle, Wirtschaftsplan, Rücklagenstand, Kaufvertragsentwurf.' },
    { cat: 'Finanzierung & Bankenpraxis', q: 'Was macht der Banken-Ready-Score?',
      l1: 'Er fasst zusammen, wie vollständig und plausibel Ihr Fall für ein Bankgespräch vorbereitet ist. Er ist eine interne ImmoAdv-Einstufung, keine Bankbewertung und keine Zusage.',
      next: 'Score im Cockpit prüfen und offene Punkte abarbeiten.',
      l2: 'Gewichtet werden Kapitaldienstdeckung (DSCR), Zinsdeckung, Beleihungsauslauf, Dokumentationsstand, rechtliche und technische Risiken sowie die Liquiditätsreserve. Liegt der DSCR unter 1,00 (die Miete deckt den Kapitaldienst nicht), wird der Score gedeckelt und ein Veto angezeigt.' },
    { cat: 'Finanzierung & Bankenpraxis', q: 'Vermittelt ImmoAdv Kredite?',
      l1: 'Nein. ImmoAdv ist ein technisches Analyse- und Vorbereitungswerkzeug und hat keine Erlaubnis nach § 34i oder § 34c GewO. Wir vermitteln keine Darlehen und sagen keine Konditionen zu.',
      next: 'Mit der vorbereiteten Mappe zur Bank oder zum Berater Ihrer Wahl gehen.',
      l2: 'ImmoAdv erhält keine erfolgsabhängigen Provisionen von Banken. Mögliche Kooperationen mit Banken beschränken sich auf Empfehlungen (Co-Branding) oder feste technische Servicepauschalen für die Aufbereitung von Unterlagen. Es bestehen keine Partnerschaften mit Plattformen wie Europace, eHyp oder Finmas.' },
    // 5. Produkt, Preise, Sicherheit & DSGVO
    { cat: 'Produkt, Sicherheit & Datenschutz', q: 'Welche Daten speichert ImmoAdv?',
      l1: 'Mit Konto speichern wir E-Mail, Passwort-Hash sowie die Finanz- und Objektwerte, die Sie eingeben. Dateien werden nur gespeichert, wenn Sie sie selbst im Konto hochladen.',
      next: 'Details auf der Seite „Sicherheit“ ansehen.',
      l2: 'Hosting über Vercel, Konto und Daten über Supabase. Für künftige Zahlungen ist Stripe vorgesehen; Kartendaten würden ImmoAdv dabei nie erreichen. Fortschritt von Checkliste und Pro-Begleiter wird ohne Konto nur im Speicher Ihres Browsers abgelegt. Einzelheiten in der Datenschutzerklärung.' },
    { cat: 'Produkt, Sicherheit & Datenschutz', q: 'Wer kann meine Daten sehen?',
      l1: 'Nur Sie. Banken oder Berater sehen nur, was Sie selbst weitergeben: die Kreditmappe oder eine befristete Freigabe ausgewählter Unterlagen.',
      next: 'Datenschutzerklärung lesen.',
      l2: 'Technische Dienstleister (Hosting, Datenbank, Zahlung) verarbeiten Daten nur im Auftrag. Mit einem befristeten Freigabelink können Sie ausgewählte Kategorien für eine Bank oder einen Berater öffnen; jeder Abruf wird protokolliert, ein Widerruf wirkt sofort. Eine Ende-zu-Ende-Verschlüsselung besteht nicht: Dateien sind verschlüsselt gespeichert, für den Betrieb aber technisch zugänglich.' },
    { cat: 'Produkt, Sicherheit & Datenschutz', q: 'Was kostet ImmoAdv?',
      l1: 'Suche, Analyse und alle Rechner sind kostenlos. Geplant sind zwei Stufen: Einsteiger-Begleitung 9,90 € pro Monat oder 99,00 € für 12 Monate, Einsteiger-Kreditmappe 39,00 € je Objekt; Profi 29,00 € pro Monat oder 290,00 € für 12 Monate, Profi-Kreditmappe 49,00 € je Objekt. Noch nicht buchbar; alle Preise inkl. 19 % USt.',
      next: 'Angebote ansehen.',
      l2: 'Die Monats-Abos sind jederzeit zum Ende des Abrechnungsmonats kündbar, ohne Anmeldung über „Verträge hier kündigen“; 12-Monats-Zugänge enden automatisch. Einsteiger zahlen weniger und erhalten Lernpfad und Begleitung für den ersten Kauf; Profi enthält unbegrenzt Objekte und Kreditmappen, Portfolio, Datenraum und Stresstests. Den Modus wählen Sie frei und können ihn jederzeit wechseln.' },
    { cat: 'Produkt, Sicherheit & Datenschutz', q: 'Wie lösche ich meine Daten?',
      l1: 'Gespeicherte Objekte löschen Sie direkt in Ihrem Konto. Für die Löschung des gesamten Kontos genügt eine E-Mail an support@immoadv.de.',
      next: 'E-Mail an support@immoadv.de senden.',
      l2: 'Recht auf Löschung nach Art. 17 DSGVO und auf Datenübertragbarkeit nach Art. 20 DSGVO. Gesetzliche Aufbewahrungspflichten (z. B. Rechnungen, 10 Jahre nach § 147 AO) bleiben unberührt. Browser-Daten löschen Sie über die Einstellungen Ihres Browsers.' }
  ],

  legal: {
    impressum: `
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>Feray Korkmaz<br>ImmoAdv<br>Georg-August-Zinn-Str. 25<br>64354 Reinheim<br>Deutschland</p>
      <h2>Kontakt</h2>
      <p>E-Mail: <a href="mailto:support@immoadv.de">support@immoadv.de</a><br>Telefon: +49 151 67661554</p>
      <h2>Umsatzsteuer-ID</h2>
      <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE348036700</p>
      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>Feray Korkmaz, Anschrift wie oben</p>
      <h2>Verbraucherstreitbeilegung</h2>
      <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      <h2>Hinweis zur Tätigkeit</h2>
      <p>ImmoAdv ist ein technisches Analyse-, Informations- und Vorbereitungsinstrument. ImmoAdv verfügt über keine Erlaubnis nach § 34c oder § 34i GewO, vermittelt keine Darlehen und erbringt keine Rechts-, Steuer- oder Finanzierungsberatung.</p>`,

    datenschutz: `
      <h2>1. Verantwortliche</h2>
      <p>Feray Korkmaz, ImmoAdv, Georg-August-Zinn-Str. 25, 64354 Reinheim, E-Mail: <a href="mailto:support@immoadv.de">support@immoadv.de</a></p>
      <h2>2. Hosting und Server-Logdateien</h2>
      <p>Die Website wird bei Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA, gehostet. Beim Aufruf werden technisch notwendige Daten verarbeitet (IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browser-Typ). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (sicherer und stabiler Betrieb). Vercel ist unter dem EU-US Data Privacy Framework zertifiziert; zusätzlich bestehen Standardvertragsklauseln.</p>
      <h2>3. Nutzerkonto und Analysedaten</h2>
      <p>Wenn Sie ein Konto anlegen, verarbeiten wir Ihre E-Mail-Adresse, einen Passwort-Hash sowie die Finanz- und Objektwerte, die Sie eingeben. Die Speicherung erfolgt bei Supabase Inc. als Auftragsverarbeiter. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertrag). Die Daten werden gelöscht, sobald Sie Ihr Konto löschen, soweit keine gesetzlichen Aufbewahrungspflichten bestehen.</p>
      <h2>4. Zahlungen</h2>
      <p>Kostenpflichtige Angebote sind derzeit nicht buchbar. Sobald sie verfügbar sind, werden Zahlungen über Stripe Payments Europe Ltd., 1 Grand Canal Street Lower, Dublin 2, Irland, abgewickelt. Zahlungsdaten (z. B. Kartennummer) gibt ImmoAdv weder ein noch speichert es sie. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Rechnungsdaten bewahren wir nach § 147 AO und § 257 HGB bis zu 10 Jahre auf (Art. 6 Abs. 1 lit. c DSGVO).</p>
      <h2>5. Hochgeladene Dokumente und Datenraum</h2>
      <p>Wenn Sie Dokumente hochladen, speichern wir die Datei, Dateiname, Kategorie, Größe und eine SHA-256-Prüfsumme bei Supabase (Serverstandort Frankfurt am Main) als Auftragsverarbeiter. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Erstellen Sie eine Freigabe, können Empfänger mit dem Link die gewählten Kategorien bis zum Ablauf oder Widerruf abrufen. Dabei protokollieren wir Zeitpunkt, Aktion, Browserkennung und eine gekürzte, gehashte IP-Adresse (Art. 6 Abs. 1 lit. f DSGVO, Nachvollziehbarkeit und Missbrauchsschutz). Protokolle löschen wir spätestens 12 Monate nach Ablauf der Freigabe. Sie können Dokumente jederzeit selbst löschen. Laden Sie bitte nur Unterlagen hoch, zu deren Weitergabe Sie berechtigt sind; enthalten Unterlagen Daten Dritter (z. B. Mieter), sind Sie dafür verantwortlich.</p>
      <h3>Unterlagen-Anforderungen</h3><p>Empfänger eines Freigabelinks können fehlende Unterlagen anfordern. Gespeichert werden Kategorie, optionaler Hinweistext (max. 300 Zeichen), Zeitpunkt und Bearbeitungsstatus; im Zugriffsprotokoll zusätzlich die gekürzte, gehashte IP-Adresse. Ist der E-Mail-Versand eingerichtet, erhalten Sie eine Benachrichtigung über den Dienstleister Resend (Resend Inc., USA; Übermittlung auf Grundlage von EU-Standardvertragsklauseln). Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Erledigte Anfragen werden mit dem Konto gelöscht. Ebenso erhalten Sie eine E-Mail, wenn ein Freigabelink zum ersten Mal geöffnet wird (Sicherheitshinweis).</p><h3>Fristen-Erinnerungen</h3><p>Nur wenn Sie im Konto „Fristen-Erinnerungen per E-Mail“ aktivieren, berechnen wir täglich aus Kaufdatum, Auszahlungsdatum und Zinsbindung Ihrer Objekte anstehende Termine und senden Ihnen dazu eine E-Mail über Resend. Gespeichert wird, welche Erinnerung wann versendet wurde, damit keine doppelt kommt. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung, jederzeit im Konto widerrufbar). Die Daten werden mit dem Konto gelöscht.</p><h3>Empfehlung durch Partner</h3><p>Rufen Sie ImmoAdv über den Link eines Partners (z. B. einer Bank) auf und registrieren sich, speichern wir die Kennung dieses Partners in Ihrem Konto, um Empfehlungen zuordnen zu können. Der Partner erhält dadurch keine personenbezogenen Daten. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Auswertung von Kooperationen). Sie können der Zuordnung jederzeit per E-Mail an support@immoadv.de widersprechen.</p><h3>Werkzeuge ohne Konto</h3><p>Eingaben in Rechner, Fristen und Szenarien werden nur in Ihrem Browser (localStorage) gespeichert, damit sie beim nächsten Besuch erhalten bleiben; sie werden nicht übertragen. Sie können sie über die Browser-Einstellungen löschen.</p>
      <h2>6. Speicherung im Browser</h2>
      <p>Der Fortschritt von Checkliste und Pro-Begleiter wird im lokalen Speicher (localStorage) Ihres Browsers abgelegt und nicht an uns übertragen. Die Speicherung ist für die von Ihnen gewünschte Funktion erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Sie können diese Daten jederzeit über Ihren Browser löschen.</p>
      <h2>7. Kein Tracking, keine Werbung, kein KI-Training</h2>
      <p>Wir setzen keine Analyse- oder Werbe-Tracker von Drittanbietern ein. Ihre Finanzdaten werden nicht zum Training von KI-Modellen verwendet.</p>
      <h2>8. Kontakt per E-Mail</h2>
      <p>Wenn Sie uns schreiben, verarbeiten wir Ihre Angaben zur Bearbeitung der Anfrage (Art. 6 Abs. 1 lit. b bzw. f DSGVO) und löschen sie, wenn sie nicht mehr erforderlich sind. Automatische E-Mails (Kündigungsbestätigung, Benachrichtigung über Unterlagen-Anforderungen) versenden wir über Resend (Resend Inc., USA) auf Grundlage eines Auftragsverarbeitungsvertrags und der EU-Standardvertragsklauseln.</p>
      <h2>8a. Unternehmenskonten, Partnerseiten und Widget</h2>
      <p><strong>Unternehmenskonto:</strong> Für Makler, Vermittler und Banken speichern wir Firmenangaben, Register- bzw. Steuernummer, Ansprechpartner, Anschrift, Bestätigungen (§ 14 BGB, AVV) mit Zeitpunkt sowie Tarif- und Rechnungsdaten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b und c DSGVO; Rechnungen bewahren wir nach § 147 AO und § 14b UStG zehn Jahre auf.</p>
      <p><strong>Anfragen über Partnerseite, Widget oder QR-Code:</strong> Senden Sie über die Seite eines Partners eine Anfrage, ist der jeweils genannte Partner Verantwortlicher; ImmoAdv verarbeitet Ihre Angaben (Name, Kontaktdaten, Objekt- und Finanzierungswerte, Nachricht, Zeitpunkt und Wortlaut Ihrer Einwilligung sowie eine gekürzte, gehashte IP-Adresse zur Missbrauchsabwehr) nur in dessen Auftrag (Art. 28 DSGVO). Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die Sie jederzeit gegenüber dem Partner widerrufen können. Das Widget setzt keine Cookies.</p>
      <p><strong>Echtheitsprüfung von Kreditmappen:</strong> Beim Aufruf von /verify speichern wir die geprüfte Kennung, den Zeitpunkt und eine gekürzte, gehashte IP-Adresse (Art. 6 Abs. 1 lit. f DSGVO; berechtigtes Interesse an Missbrauchsabwehr und Nutzungsstatistik). Die Prüfseite zeigt keine personen- oder objektbezogenen Daten.</p>
      <p><strong>Kontaktformular für Unternehmen:</strong> Angaben aus dem Formular auf /b2b verarbeiten wir zur Bearbeitung der Anfrage (Art. 6 Abs. 1 lit. b DSGVO) und löschen sie nach Abschluss, sofern kein Vertrag zustande kommt.</p>
      <h2>9. Ihre Rechte</h2>
      <p>Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Datenexport und Kontolöschung können Sie im Konto unter „Daten &amp; Konto“ selbst auslösen. Eine Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen. Sie können sich bei einer Aufsichtsbehörde beschweren, z. B. beim Hessischen Beauftragten für Datenschutz und Informationsfreiheit, Gustav-Stresemann-Ring 1, 65189 Wiesbaden.</p>
      <p>Stand: Oktober 2026</p>`,

    nutzungsbedingungen: `
      <h2>1. Geltungsbereich</h2>
      <p>Diese Bedingungen gelten für die Nutzung von immoadv.de und der ImmoAdv-Anwendung, angeboten von Feray Korkmaz, ImmoAdv, Georg-August-Zinn-Str. 25, 64354 Reinheim.</p>
      <h2>2. Leistung</h2>
      <p>ImmoAdv ist ein technisches Analyse-, Informations- und Vorbereitungsinstrument. Es strukturiert die von Ihnen eingegebenen Daten und stellt Rechenwege dar. ImmoAdv vermittelt keine Darlehen, gibt keine Konditionszusagen und erbringt keine Rechts-, Steuer- oder Finanzierungsberatung. Ob und zu welchen Bedingungen eine Bank finanziert, entscheidet allein die Bank.</p>
      <h2>3. Preise und Zahlung</h2>
      <p>Die Analyse ist kostenfrei. Kostenpflichtige Angebote (Einsteiger-Begleitung 9,90 € pro Monat oder 99,00 € für 12 Monate, Einsteiger-Kreditmappe 39,00 € je Objekt; Profi 29,00 € pro Monat oder 290,00 € für 12 Monate, Profi-Kreditmappe 49,00 € je Objekt; 12-Monats-Zugänge einmalig ohne Verlängerung; jeweils Endpreise inkl. 19 % Umsatzsteuer) sind in Vorbereitung und derzeit nicht buchbar. Sobald sie buchbar sind, erfolgt die Zahlung über Stripe; die Regelungen unter Nr. 4 und 5 gelten dann für diese Verträge.</p>
      <h2>4. Laufzeit und Kündigung (Pro)</h2>
      <p>Pro monatlich läuft monatlich und verlängert sich jeweils um einen Monat, wenn es nicht gekündigt wird. Pro 12 Monate endet automatisch nach zwölf Monaten und verlängert sich nicht. Sie können jederzeit zum Ende des laufenden Abrechnungsmonats kündigen – ohne Anmeldung über den Button „Verträge hier kündigen“ unter <a href="/kuendigen">immoadv.de/kuendigen</a> oder per E-Mail.</p>
      <h2>5. Widerrufsbelehrung</h2>
      <p><strong>Widerrufsrecht:</strong> Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses. Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Feray Korkmaz, ImmoAdv, Georg-August-Zinn-Str. 25, 64354 Reinheim, support@immoadv.de, +49 151 67661554) mittels einer eindeutigen Erklärung (z. B. E-Mail) über Ihren Entschluss informieren. Sie können dafür das unten stehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Zur Wahrung der Frist reicht es aus, dass Sie die Mitteilung vor Ablauf der Frist absenden.</p>
      <p><strong>Folgen des Widerrufs:</strong> Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf bei uns eingegangen ist. Für die Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben. Haben Sie verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zum Widerruf bereits erbrachten Leistungen entspricht.</p>
      <p><strong>Vorzeitiges Erlöschen:</strong> Bei digitalen Inhalten (z. B. der als PDF erstellten Kreditmappe) erlischt das Widerrufsrecht, wenn wir mit der Ausführung begonnen haben, nachdem Sie ausdrücklich zugestimmt und Ihre Kenntnis davon bestätigt haben, dass Sie Ihr Widerrufsrecht dadurch verlieren (§ 356 Abs. 5 BGB).</p>
      <p><strong>Muster-Widerrufsformular:</strong> An Feray Korkmaz, ImmoAdv, Georg-August-Zinn-Str. 25, 64354 Reinheim, support@immoadv.de: Hiermit widerrufe(n) ich/wir den von mir/uns abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung / die Bereitstellung der folgenden digitalen Inhalte (*) – Bestellt am (*) – Name – Anschrift – Datum. (*) Unzutreffendes streichen.</p>
      <h2>6. Pflichten der Nutzer</h2>
      <p>Sie sind für die Richtigkeit Ihrer Eingaben selbst verantwortlich. Laden Sie nur Unterlagen hoch, zu deren Weitergabe Sie berechtigt sind.</p>
      <h2>7. Haftung</h2>
      <p>Wir haften unbeschränkt bei Vorsatz, grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit. Bei leichter Fahrlässigkeit haften wir nur bei Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren, vertragstypischen Schaden. Ergebnisse der Berechnungen beruhen auf Ihren Eingaben und allgemeinen Annahmen; sie ersetzen keine individuelle Beratung.</p>
      <h2>8. Schlussbestimmungen</h2>
      <p>Es gilt deutsches Recht. Gegenüber Verbrauchern gilt diese Rechtswahl nur, soweit dadurch nicht zwingende Schutzvorschriften des Staates ihres gewöhnlichen Aufenthalts entzogen werden.</p>
      <h2 id="b2b">9. Zusatzbedingungen für Unternehmenskonten</h2>
      <p><strong>9.1 Vertragspartner.</strong> Unternehmenskonten und B2B-Tarife (Makler &amp; Vermittler Basic, Kanzlei &amp; Baufi Pro, Bank &amp; Filiale Enterprise) stehen ausschließlich Unternehmern im Sinne des § 14 BGB offen. Mit der Registrierung bestätigt der Kunde, in Ausübung seiner gewerblichen oder selbständigen beruflichen Tätigkeit zu handeln. Ein Widerrufsrecht nach § 312g BGB besteht nicht. Abschnitt 5 gilt für Unternehmenskonten nicht.</p>
      <p><strong>9.2 Preise.</strong> Alle Preise für Unternehmenskonten sind Nettopreise zuzüglich der gesetzlichen Umsatzsteuer (derzeit 19 %). Monatstarife werden monatlich im Voraus, Jahrestarife jährlich im Voraus berechnet. Kauf auf Rechnung nur nach Freischaltung; Zahlungsziel laut Rechnung (Standard 14 Tage netto).</p>
      <p><strong>9.3 Laufzeit.</strong> Monatstarife sind zum Ende des laufenden Abrechnungsmonats kündbar, Jahrestarife zum Ende der Jahreslaufzeit; sie verlängern sich jeweils um die gleiche Laufzeit, wenn nicht gekündigt wird. Die Kündigung ist im Portal („Abo verwalten“), unter „Verträge hier kündigen“ oder per E-Mail möglich.</p>
      <p><strong>9.4 Kontingente.</strong> Im Tarif Basic sind je Kalendermonat Kreditmappen für bis zu 20 verschiedene Objekte enthalten; Neuerstellungen für ein bereits erfasstes Objekt im selben Monat zählen nicht erneut. Nicht genutzte Kontingente verfallen am Monatsende.</p>
      <p><strong>9.5 Anfragen von Endkunden.</strong> Anfragen über Partnerseite, Widget und QR-Codes verarbeitet ImmoAdv im Auftrag des Kunden nach dem im Portal geschlossenen Auftragsverarbeitungsvertrag. Der Kunde ist Verantwortlicher und informiert die Betroffenen in seiner Datenschutzerklärung. ImmoAdv nutzt diese Daten nicht für eigene Zwecke.</p>
      <p><strong>9.6 Berufsrecht.</strong> Der Kunde bleibt für die Einhaltung seiner berufsrechtlichen Pflichten (insbesondere §§ 34c, 34i GewO, Wohnimmobilienkreditrichtlinie) selbst verantwortlich. Die Ergebnisse von ImmoAdv sind rechnerische Orientierungswerte nach einem strukturierten Datenmodell und ersetzen weder die Kreditwürdigkeitsprüfung des Kreditgebers noch eine Beratung.</p>
      <p><strong>9.7 Sperrung.</strong> Bei Zahlungsverzug von mehr als 30 Tagen oder schwerwiegendem Verstoß gegen diese Bedingungen kann ImmoAdv das Unternehmenskonto nach vorheriger Ankündigung in Textform sperren. Rechnungen und der AVV bleiben abrufbar.</p>
      <p><strong>9.8 Haftung.</strong> Abschnitt 7 gilt mit der Maßgabe, dass die Haftung bei leichter Fahrlässigkeit je Vertragsjahr auf die im Vertragsjahr gezahlte Vergütung begrenzt ist.</p>
      <p><strong>9.9 Gerichtsstand</strong> für Kaufleute, juristische Personen des öffentlichen Rechts und öffentlich-rechtliche Sondervermögen ist Darmstadt.</p>
      <p>Stand: Oktober 2026</p>`
  }
};
