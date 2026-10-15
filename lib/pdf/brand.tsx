// Einheitliches PDF-Branding: Logo, Kopfzeile, Fußzeile, Wasserzeichen.
import { Defs, LinearGradient, Polygon, Stop, Svg, Text, View, StyleSheet, G } from '@react-pdf/renderer';

export const BRAND = {
  navy: '#0F2C59', blue: '#0284C7', sky: '#38BDF8', text: '#334155', muted: '#64748B', hair: '#CBD5E1',
};

export const PDF_DISCLAIMER =
  'Reine technische Modellberechnung. Keine Kreditzusage, keine Kreditwürdigkeitsprüfung gem. § 505a BGB, keine Darlehensvermittlung gem. § 34i GewO, keine Rechts- oder Steuerberatung.';

const s = StyleSheet.create({
  header: { position: 'absolute', top: 14, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 5, borderBottomWidth: 1.2, borderBottomColor: BRAND.navy },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  word: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginLeft: 5 },
  meta: { fontSize: 7, color: BRAND.muted, textAlign: 'right', lineHeight: 1.3 },
  metaStrong: { fontFamily: 'Helvetica-Bold', color: BRAND.navy, fontSize: 7.5 },
  footer: { position: 'absolute', bottom: 14, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderTopWidth: 0.5, borderTopColor: BRAND.hair, paddingTop: 4, fontSize: 6.5, color: BRAND.muted },
  fLeft: { width: '22%' }, fMid: { width: '50%', textAlign: 'center' }, fRight: { width: '24%', textAlign: 'right' },
  wm: { position: 'absolute', top: 380, left: -60, width: 720, textAlign: 'center', fontSize: 34, fontFamily: 'Helvetica-Bold', color: BRAND.navy, opacity: 0.05, transform: 'rotate(-45deg)' },
});

// Bildmarke als Vektor (dieselben Polygone wie /brand/immoadv-icon.svg).
export function LogoMark({ size = 18 }: { size?: number }) {
  return (
    <Svg viewBox="-2 -2 104 88" style={{ width: size * 1.18, height: size }}>
      <Defs>
        <LinearGradient id="iag" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={BRAND.navy} />
          <Stop offset="0.55" stopColor={BRAND.blue} />
          <Stop offset="1" stopColor={BRAND.sky} />
        </LinearGradient>
      </Defs>
      <G fill="url(#iag)">
        <Polygon points="50,8.3 63.1,19.4 62.6,22.5 49,34 45.2,31.1 5.3,68.9 2.5,70 3.1,51.7" />
        <Polygon points="98.8,0.7 93.4,37.3 83.6,29.8 50.8,62.3 43.7,57.9 17.2,82.6 0.2,82.6 42.2,38.4 50.3,40.1 69.6,19.5 64.6,8.1" />
        <Polygon points="82.3,37.6 99.5,53.6 99.6,84 88.6,83.6 62.5,57" />
      </G>
    </Svg>
  );
}

export function Logo({ size = 16 }: { size?: number }) {
  return (
    <View style={s.logoRow}>
      <LogoMark size={size} />
      <Text style={[s.word, { fontSize: size * 0.72 }]}><Text style={{ color: BRAND.navy }}>Immo</Text><Text style={{ color: BRAND.blue }}>Adv</Text></Text>
    </View>
  );
}

// Datum/Uhrzeit in deutscher Zeit mit Zonenkürzel (MEZ/MESZ).
export function stamp(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const zone = get('timeZoneName').replace('GMT+2', 'MESZ').replace('GMT+1', 'MEZ');
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')} ${zone}`;
}

export function BrandHeader({ reportType, reportId, createdAt }: { reportType: string; reportId?: string; createdAt: string }) {
  return (
    <View style={s.header} fixed>
      <Logo />
      <View>
        <Text style={[s.meta, s.metaStrong]}>{reportType}</Text>
        <Text style={s.meta}>{stamp(createdAt)}{reportId ? ` · ID ${reportId}` : ''}</Text>
      </View>
    </View>
  );
}

export function BrandFooter({ hash }: { hash?: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.fLeft}>immoadv.de | support@immoadv.de</Text>
      <Text style={s.fMid}>{PDF_DISCLAIMER}</Text>
      <Text style={s.fRight} render={({ pageNumber, totalPages }) => `${hash ? `Daten-SHA-256: ${hash.slice(0, 16)}\n` : ''}Seite ${pageNumber} von ${totalPages}`} />
    </View>
  );
}

export function Watermark({ text }: { text: string }) {
  return <Text style={s.wm} fixed>{text}</Text>;
}
