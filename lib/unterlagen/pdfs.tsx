import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { BRAND, Logo } from '@/lib/pdf/brand';

const C = { navy: BRAND.navy, text: '#334155', muted: '#64748B', hair: '#CBD5E1', bg: '#F8FAFC', okBg: '#DCFCE7', ok: '#166534', noneBg: '#F1F5F9', none: '#64748B' };
const DISCLAIMER = 'Reines technisches Analyse-, Informations- und Vorbereitungsinstrument. Keine Rechts-, Steuer- oder Finanzierungsberatung gem. § 34i GewO / KWG.';
const CONTACT = 'ImmoAdv · Feray Korkmaz · Georg-August-Zinn-Str. 25 · 64354 Reinheim · support@immoadv.de · immoadv.de';

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 36, paddingHorizontal: 36, fontFamily: 'Helvetica', fontSize: 8.5, color: C.text, lineHeight: 1.35 },
  bar: { backgroundColor: C.navy, color: '#FFFFFF', padding: 12, marginBottom: 12 },
  barKicker: { fontSize: 7, letterSpacing: 1.2, color: '#CBD5E1' },
  barTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  h2: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: C.navy, marginTop: 10, marginBottom: 4 },
  p: { marginBottom: 4 },
  cols: { flexDirection: 'row' },
  col: { flex: 1, borderWidth: 0.5, borderColor: C.hair, padding: 8, marginRight: 8 },
  colLast: { flex: 1, borderWidth: 0.5, borderColor: C.hair, padding: 8 },
  colTitle: { fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 3 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.hair, paddingVertical: 2.5, paddingHorizontal: 4 },
  zebra: { backgroundColor: '#F1F3F7' },
  head: { flexDirection: 'row', backgroundColor: C.navy, paddingVertical: 3, paddingHorizontal: 4 },
  headText: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  badge: { fontSize: 7, fontFamily: 'Helvetica-Bold', paddingVertical: 1, paddingHorizontal: 4, borderRadius: 2 },
  footer: { position: 'absolute', bottom: 18, left: 36, right: 36, fontSize: 6.5, color: C.muted, borderTopWidth: 0.5, borderTopColor: C.hair, paddingTop: 4 },
});

const Footer = () => (
  <View style={s.footer} fixed>
    <Text>{DISCLAIMER}</Text>
    <Text>{CONTACT} · Stand: Oktober 2026</Text>
  </View>
);

export function BankOnePager() {
  const status: [string, string, boolean][] = [
    ['Rechner, Cockpit, Stresstest, Banken-Ready-Score', 'Verfügbar', true],
    ['Kreditmappe als PDF mit SHA-256-Prüfsumme', 'Verfügbar', true],
    ['Dokument-Upload (Dateityp- und Prüfsummenprüfung, unveränderbare Originale)', 'Verfügbar', true],
    ['Berater-Datenraum mit QR-Freigabe, Ablauf, Widerruf, Zugriffsprotokoll', 'Verfügbar', true],
    ['Inhaltliche Auswertung (OCR) mit Quellenangabe je Wert', 'In Entwicklung', false],
    ['Co-Branding-Link für Partnerbanken (immoadv.de/p/…)', 'Verfügbar, Einrichtung auf Anfrage', true],
  ];
  return (
    <Document title="ImmoAdv – Information für Banken und Finanzierungsberater" author="ImmoAdv" language="de">
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><Logo size={14} /><Text style={{ fontSize: 7, color: C.muted }}>immoadv.de · Stand Oktober 2026</Text></View>
        <View style={s.bar}>
          <Text style={s.barKicker}>INFORMATION FÜR BANKEN, SPARKASSEN UND FINANZIERUNGSBERATER</Text>
          <Text style={s.barTitle}>Ihre Kunden kommen vorbereitet ins Erstgespräch.</Text>
        </View>
        <Text style={s.p}>
          ImmoAdv strukturiert Haushalts-, Bonitäts- und Objektdaten vor dem ersten Bankgespräch: Kennzahlen mit offengelegtem Rechenweg, Stresstest, Unterlagenstatus und eine Kreditmappe als PDF. Kunden können ausgewählte Unterlagen über einen befristeten, widerrufbaren Link mit QR-Code freigeben.
        </Text>

        <Text style={s.h2}>Was Sie erhalten</Text>
        <View style={s.cols}>
          <View style={s.col}><Text style={s.colTitle}>Kreditmappe</Text><Text>Vorhaben, Finanzierung, Objekt, NOI, CFADS, DSCR, ICR, LTV, vierstufiger Stresstest, Haushaltsrechnung, Prüfpunkte, Unterlagenindex.</Text></View>
          <View style={s.col}><Text style={s.colTitle}>Datenraum</Text><Text>Nur freigegebene Kategorien (z. B. Objekt, WEG, Grundbuch), Ablauf nach 48 Stunden, 7 oder 30 Tagen, Abrufzähler, sofortiger Widerruf durch den Kunden.</Text></View>
          <View style={s.colLast}><Text style={s.colTitle}>Nachvollziehbarkeit</Text><Text>Jede Datei mit SHA-256-Prüfsumme; Zugriffe werden protokolliert (IP gekürzt und gehasht). Kennzahlen sind als ImmoAdv-Risikopolitik gekennzeichnet.</Text></View>
        </View>

        <Text style={s.h2}>Kooperationsmodelle (Pilotphase)</Text>
        <View style={s.cols}>
          <View style={s.col}>
            <Text style={s.colTitle}>Modell A: Empfehlung</Text>
            <Text>Kostenfrei für die Bank. Sie empfehlen ImmoAdv Interessenten zur Vorbereitung; die Kunden nutzen die regulären Angebote.</Text>
          </View>
          <View style={s.colLast}>
            <Text style={s.colTitle}>Modell B: Technische Servicepauschale</Text>
            <Text>Feste Pauschale je aufbereitetem Dossier oder als Kontingent, nach individueller Pilotvereinbarung. Keine erfolgsabhängige Vergütung.</Text>
          </View>
        </View>

        <Text style={s.h2}>Entwicklungsstand</Text>
        <View>
          <View style={s.head}><Text style={[s.headText, { flex: 4 }]}>Funktion</Text><Text style={[s.headText, { flex: 1, textAlign: 'right' }]}>Status</Text></View>
          {status.map(([f, st, on], i) => (
            <View key={f} style={[s.row, i % 2 ? s.zebra : {}]}>
              <Text style={{ flex: 4 }}>{f}</Text>
              <View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={[s.badge, on ? { color: C.ok, backgroundColor: C.okBg } : { color: C.none, backgroundColor: C.noneBg }]}>{st}</Text></View>
            </View>
          ))}
        </View>

        <Text style={s.h2}>Rechtlicher Rahmen</Text>
        <Text style={s.p}>ImmoAdv hat keine Erlaubnis nach § 34c oder § 34i GewO, vermittelt keine Darlehen, gibt keine Konditionszusagen und trifft keine Kreditentscheidungen. Kooperationen beschränken sich auf Empfehlungen oder feste technische Servicepauschalen, nicht auf Provisionen. Es bestehen keine Partnerschaften mit Plattformen wie Europace, eHyp oder Finmas. Die Kreditentscheidung liegt allein bei der Bank.</Text>
        <Text style={s.p}>Die Kennzahlen beruhen auf Angaben der Kunden; hochgeladene Unterlagen werden formal (Dateityp, Prüfsumme), aber nicht inhaltlich geprüft.</Text>

        <Text style={s.h2}>Kontakt für einen Pilot</Text>
        <Text>support@immoadv.de · immoadv.de/fuer-banken · Muster-Kreditmappe: immoadv.de/api/mustermappe</Text>
        <Footer />
      </Page>
    </Document>
  );
}

const DOCS: [string, string, string, string][] = [
  // Unterlage, Angestellt/Beamte, Selbstständig, Hinweis
  ['Personalausweis oder Reisepass (Kopie)', 'erforderlich', 'erforderlich', 'gültig'],
  ['Selbstauskunft der Bank', 'erforderlich', 'erforderlich', 'vollständig, unterschrieben'],
  ['Gehaltsabrechnungen der letzten 3 Monate', 'erforderlich', '–', 'inkl. Dezember-Abrechnung bei Boni'],
  ['Arbeitsvertrag', 'erforderlich', '–', 'Probezeit beendet?'],
  ['Einkommensteuerbescheide der letzten 2–3 Jahre', 'fallweise', 'erforderlich', 'bei Selbstständigen zwingend'],
  ['Jahresabschlüsse / EÜR der letzten 2–3 Jahre', '–', 'erforderlich', 'mit aktueller BWA und Summen- und Saldenliste'],
  ['Eigenkapitalnachweis', 'erforderlich', 'erforderlich', 'Kontoauszüge oder Depotauszüge'],
  ['Bestehende Kredite und Leasingverträge', 'fallweise', 'fallweise', 'Restschuld und Rate'],
  ['Nachweis private Krankenversicherung', 'fallweise', 'fallweise', 'wird bei Beamten abgezogen'],
  ['Exposé und Objektbeschreibung', 'erforderlich', 'erforderlich', ''],
  ['Grundbuchauszug', 'erforderlich', 'erforderlich', 'nicht älter als 3 Monate; Abt. II und III prüfen'],
  ['Flurkarte', 'erforderlich', 'erforderlich', ''],
  ['Grundrisse und Wohnflächenberechnung', 'erforderlich', 'erforderlich', 'nach WoFlV'],
  ['Energieausweis', 'erforderlich', 'erforderlich', 'Pflicht nach GModG (bis 28.07.2026 GEG)'],
  ['Teilungserklärung (ETW)', 'fallweise', 'fallweise', 'nur Eigentumswohnung'],
  ['Protokolle der letzten 3 Eigentümerversammlungen (ETW)', 'fallweise', 'fallweise', 'Sonderumlagen, Sanierungen'],
  ['Wirtschaftsplan, Hausgeldabrechnung, Rücklagenstand (ETW)', 'fallweise', 'fallweise', ''],
  ['Mietvertrag (bei Vermietung)', 'fallweise', 'fallweise', 'Miethöhe, Staffel/Index'],
  ['Gebäudeversicherung', 'fallweise', 'fallweise', ''],
  ['Kaufvertragsentwurf', 'erforderlich', 'erforderlich', 'vor dem Notartermin'],
];

export function BeraterCheckliste() {
  return (
    <Document title="ImmoAdv – Unterlagen-Checkliste Baufinanzierung" author="ImmoAdv" language="de">
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><Logo size={14} /><Text style={{ fontSize: 7, color: C.muted }}>immoadv.de · Stand Oktober 2026</Text></View>
        <View style={s.bar}>
          <Text style={s.barKicker}>CHECKLISTE FÜR BERATUNG UND KUNDEN</Text>
          <Text style={s.barTitle}>Unterlagen für die Baufinanzierung</Text>
        </View>
        <Text style={s.p}>Typische Anforderungen nach Erwerbsstatus. Welche Unterlagen eine Bank konkret verlangt, legt sie selbst fest.</Text>
        <View>
          <View style={s.head}>
            <Text style={[s.headText, { flex: 3.2 }]}>Unterlage</Text>
            <Text style={[s.headText, { flex: 1.2 }]}>Angestellt / Beamte</Text>
            <Text style={[s.headText, { flex: 1.2 }]}>Selbstständig</Text>
            <Text style={[s.headText, { flex: 2.2 }]}>Hinweis</Text>
            <Text style={[s.headText, { flex: 0.6, textAlign: 'center' }]}>Liegt vor</Text>
          </View>
          {DOCS.map(([d, a, b, h], i) => (
            <View key={d} style={[s.row, i % 2 ? s.zebra : {}]}>
              <Text style={{ flex: 3.2 }}>{d}</Text>
              <Text style={{ flex: 1.2 }}>{a}</Text>
              <Text style={{ flex: 1.2 }}>{b}</Text>
              <Text style={{ flex: 2.2, color: C.muted }}>{h}</Text>
              <View style={{ flex: 0.6, alignItems: 'center' }}><View style={{ width: 8, height: 8, borderWidth: 0.75, borderColor: C.navy }} /></View>
            </View>
          ))}
        </View>
        <Text style={s.h2}>Hinweise nach Erwerbsstatus</Text>
        <Text style={s.p}>Befristet Angestellte: häufig zweiter Darlehensnehmer oder zusätzliche Sicherheiten. Berufseinsteiger: Fokus auf Eigenkapital und Kaufpreisgrenze. Selbstständige: meist mindestens 2–3 Jahre Geschäftstätigkeit. Rentner: Altersgrenzen und Restlaufzeit beachten.</Text>
        <Footer />
      </Page>
    </Document>
  );
}
