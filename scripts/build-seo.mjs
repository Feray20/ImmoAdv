// SEO-Build für die statischen Seiten in public/:
// Titel, Beschreibung, Canonical, Robots, Open Graph, Twitter, JSON-LD (Organization, WebSite, WebApplication,
// FAQPage, HowTo, BreadcrumbList), Kaufnebenkosten-Seiten je Bundesland, sitemap.xml und robots.txt.
// Idempotent: ersetzt nur <title> und den Block zwischen <!--seo:start--> und <!--seo:end-->; vorgerenderter Inhalt bleibt.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { GREST } from '../public/src/calc.mjs';

const ORIGIN = 'https://immoadv.de';
const pub = new URL('../public/', import.meta.url);
const read = (p) => readFileSync(new URL(p, pub), 'utf8');
const write = (p, s) => { const u = new URL(p, pub); mkdirSync(new URL('.', u), { recursive: true }); writeFileSync(u, s); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const today = new Date().toISOString().slice(0, 10);

const ORG = {
  '@type': 'Organization', '@id': `${ORIGIN}/#org`, name: 'ImmoAdv', url: `${ORIGIN}/`,
  logo: `${ORIGIN}/brand/immoadv-icon.svg`, email: 'support@immoadv.de',
  address: { '@type': 'PostalAddress', streetAddress: 'Georg-August-Zinn-Str. 25', postalCode: '64354', addressLocality: 'Reinheim', addressCountry: 'DE' },
};
const APP = {
  '@type': 'WebApplication', '@id': `${ORIGIN}/#app`, name: 'ImmoAdv', url: `${ORIGIN}/`, applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web', inLanguage: 'de-DE', publisher: { '@id': `${ORIGIN}/#org` },
  description: 'Technisches Analysewerkzeug für Kapitalanleger: Cashflow, DSCR, Stresstest, Fristen und Kreditmappe. Keine Finanzierungs-, Rechts- oder Steuerberatung.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', description: 'Analyse kostenfrei' },
};

// Seitenliste: Pfad, Datei, Titel, Beschreibung, Brotkrumen, Indexierung, Zusatz-JSON-LD.
const PAGES = [
  { path: '/', file: 'index.html', title: 'Immobilie als Kapitalanlage durchrechnen | ImmoAdv', desc: 'Cashflow, DSCR, Stresstest und Haushaltsrechnung für Kapitalanleger in Deutschland – mit Kreditmappe für das Bankgespräch. Analyse kostenfrei.', crumbs: [], extra: ['website', 'app', 'howto', 'homefaq'] },
  { path: '/wissen', title: 'Immobilienfinanzierung verständlich erklärt – 33 Antworten | ImmoAdv', desc: 'Eigenkapital, Nebenkosten, Beleihungswert, AfA, 15-%-Grenze, Anschlusszins: Antworten in zwei Ebenen mit Formel und Rechtsgrundlage.', crumbs: ['Wissen'], extra: ['faq'] },
  { path: '/cockpit', file: null, skip: true, title: '', desc: '' },
  { path: '/wissen/glossar', title: 'Glossar Immobilienfinanzierung: Begriffe von A bis Z | ImmoAdv', desc: 'Annuität, Beleihungswert, Zinsbindung, Kappungsgrenze, Grundschuld und mehr: die wichtigsten Begriffe zu Kauf, Finanzierung, Miete und Steuer kurz erklärt.', crumbs: ['Wissen', 'Glossar'], extra: ['glossar'] },
  { path: '/start', title: 'Meine erste Immobilie durchrechnen – in drei Schritten | ImmoAdv', desc: 'Kaufpreis, Miete, Eigenkapital: Rate, Tilgungshebel, Cashflow, Notgroschen und das Bild nach zehn Jahren – mit Erklärungen aller Fachbegriffe.', crumbs: ['Meine erste Immobilie'], extra: ['app'] },
  { path: '/rechner', title: 'Mietrecht- und Steuerrechner: Mietpreisbremse, AfA, Indexmiete | ImmoAdv', desc: 'Mietpreisbremse, Kappungsgrenze, Index- und Staffelmiete, AfA linear und degressiv, Kaufpreisaufteilung und 15-%-Grenze – mit offengelegter Formel.', crumbs: ['Rechner'], extra: ['app'] },
  { path: '/fristen', title: 'Fristen nach dem Immobilienkauf berechnen | ImmoAdv', desc: 'Spekulationsfrist (§ 23 EStG), 15-%-Grenze, Zinsbindung, Kündigungsrecht nach § 489 BGB und Mieterhöhung – als Liste und Kalenderdatei.', crumbs: ['Fristen'], extra: ['app'] },
  { path: '/szenarien', title: 'Anschlussfinanzierung und Verkauf durchrechnen | ImmoAdv', desc: 'Restschuld, neue Rate und Kipp-Punkt nach der Zinsbindung; Verkaufsszenario mit Veräußerungsgewinn und Spekulationsfrist.', crumbs: ['Szenarien'], extra: ['app'] },
  { path: '/rechner/tilgungsplan', file: 'rechner/tilgungsplan/index.html', title: 'Tilgungsplan mit Sondertilgung berechnen | ImmoAdv', desc: 'Tilgungsplan für Ihr Annuitätendarlehen: Zinsen, Tilgung und Restschuld je Jahr, Restschuld nach Zinsbindung, Sondertilgung und CSV-Export.', crumbs: ['Rechner', 'Tilgungsplan'] },
  { path: '/rechner/kaufnebenkosten', file: 'rechner/kaufnebenkosten/index.html', title: 'Kaufnebenkosten nach Bundesland 2026 | ImmoAdv', desc: 'Grunderwerbsteuer von 3,5 % bis 6,5 %: alle 16 Bundesländer im Vergleich, mit Rechner für Notar, Grundbuch und Makler.', crumbs: ['Rechner', 'Kaufnebenkosten'] },
  { path: '/checkliste', title: 'Unterlagen-Checkliste für die Baufinanzierung | ImmoAdv', desc: '21 Unterlagen, die Banken bei Kapitalanlegern typischerweise sehen wollen – gefiltert nach Erwerbsstatus und Objektart, druckbar.', crumbs: ['Checkliste'] },
  { path: '/mustermappe', title: 'Muster-Kreditmappe: DSCR, Stresstest, Haushaltsrechnung | ImmoAdv', desc: 'Fiktiver Beispielfall einer Kreditmappe mit Finanzierung, Anschlusszins-Szenarien, Haushaltsrechnung und Unterlagenindex – als PDF.', crumbs: ['Mustermappe'] },
  { path: '/pro-begleiter', title: '12-Monats-Programm für Kapitalanleger | ImmoAdv', desc: 'Vom Kassensturz bis zum verwalteten Bestand: ein Thema pro Monat mit Aufgaben, Werkzeug und Gesetzestext zum Nachlesen.', crumbs: ['Pro-Begleiter'] },
  { path: '/profiler', title: 'Investor-Profiler: Welche Strategie passt zu Ihnen? | ImmoAdv', desc: 'Sechs Fragen zu Eigenkapital, Cashflow, Steuer und Horizont – mit den Kennzahlen, auf die Sie besonders achten sollten.', crumbs: ['Investor-Profiler'] },
  { path: '/angebote', title: 'Preise und Angebote | ImmoAdv', desc: 'Analyse kostenfrei. Kreditmappe 49,00 € je Objekt, Pro 29,00 € pro Monat – Endpreise inkl. 19 % USt, monatlich kündbar.', crumbs: ['Angebote'] },
  { path: '/fuer-banken', title: 'Für Banken und Finanzierungsberater | ImmoAdv', desc: 'Vorbereitete Finanzierungsanfragen mit Kreditmappe, Prüf-QR und Datenraum. Keine Vermittlung, keine Provision – Pilotpartner gesucht.', crumbs: ['Für Banken'] },
  { path: '/sicherheit', title: 'Sicherheit und Datenschutz | ImmoAdv', desc: 'Speicherung in Frankfurt, Prüfsummen, befristete Freigabelinks und Zugriffsprotokoll – und was noch geplant ist.', crumbs: ['Sicherheit'] },
  { path: '/impressum', title: 'Impressum | ImmoAdv', desc: 'Anbieterkennzeichnung nach § 5 DDG.', crumbs: ['Impressum'] },
  { path: '/datenschutz', title: 'Datenschutzerklärung | ImmoAdv', desc: 'Welche Daten ImmoAdv verarbeitet, wo sie gespeichert werden und welche Rechte Sie haben.', crumbs: ['Datenschutz'] },
  { path: '/nutzungsbedingungen', title: 'Nutzungsbedingungen und Widerrufsbelehrung | ImmoAdv', desc: 'Nutzungsbedingungen, Preise, Laufzeit, Kündigung und Widerrufsbelehrung von ImmoAdv.', crumbs: ['Nutzungsbedingungen'] },
  { path: '/kuendigen', title: 'Verträge hier kündigen | ImmoAdv', desc: 'Kündigung Ihres ImmoAdv-Pro-Vertrags ohne Anmeldung nach § 312k BGB.', crumbs: ['Verträge kündigen'] },
  // Nicht indexieren: persönliche oder tokengebundene Seiten
  { path: '/datenraum', title: 'Datenraum | ImmoAdv', desc: 'Freigegebene Unterlagen.', noindex: true },
  { path: '/pruefen', title: 'Kreditmappe prüfen | ImmoAdv', desc: 'Echtheitsprüfung einer ImmoAdv-Kreditmappe.', noindex: true },
  { path: '/partner', title: 'Partner | ImmoAdv', desc: 'Partnerseite.', noindex: true },
  { path: '/app/dashboard', file: 'auth-login.html', title: 'Konto | ImmoAdv', desc: 'Ihr ImmoAdv-Konto.', noindex: true, noCanonical: true },
  { path: '/offline', file: 'offline.html', title: 'Offline | ImmoAdv', desc: 'Keine Verbindung.', noindex: true, noCanonical: true },
];
for (const [slug, g] of Object.entries(GREST)) {
  PAGES.push({
    path: `/rechner/kaufnebenkosten/${slug}`, file: `rechner/kaufnebenkosten/${slug}/index.html`,
    title: `Kaufnebenkosten ${g.name} 2026: Grunderwerbsteuer ${String(g.pct).replace('.', ',')} % | ImmoAdv`,
    desc: `Kaufnebenkosten in ${g.name} berechnen: Grunderwerbsteuer ${String(g.pct).replace('.', ',')} %, Notar, Grundbuch und Makler – mit eigenem Kaufpreis. Stand Oktober 2026.`,
    crumbs: ['Rechner', 'Kaufnebenkosten', g.name],
  });
}

const CRUMB_PATH = { Rechner: '/rechner', Kaufnebenkosten: '/rechner/kaufnebenkosten', Wissen: '/wissen' };
function breadcrumb(p) {
  if (!p.crumbs?.length) return null;
  const items = [{ name: 'Start', item: `${ORIGIN}/` }];
  p.crumbs.forEach((c, i) => items.push({ name: c, item: i === p.crumbs.length - 1 ? `${ORIGIN}${p.path}` : `${ORIGIN}${CRUMB_PATH[c] || p.path}` }));
  return { '@type': 'BreadcrumbList', itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: x.item })) };
}
function faqLd() {
  const faq = JSON.parse(read('data/faq.json'));
  const list = Array.isArray(faq) ? faq : faq.entries;
  return { '@type': 'FAQPage', mainEntity: list.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: `${q.level1} ${q.level2}`.trim() } })) };
}
function homeFaqLd(html) {
  const qs = [...html.matchAll(/<details[^>]*><summary>(.*?)<span>\+<\/span><\/summary><p>(.*?)<\/p><\/details>/g)];
  return { '@type': 'FAQPage', mainEntity: qs.map((m) => ({ '@type': 'Question', name: m[1].replace(/<[^>]+>/g, ''), acceptedAnswer: { '@type': 'Answer', text: m[2].replace(/<[^>]+>/g, '') } })) };
}
function glossarLd() {
  const src = read('src/routes.js');
  const m = src.match(/const GLOSSAR=(\{.*?\});/);
  const g = new Function(`return ${m[1]}`)();
  return { '@type': 'DefinedTermSet', '@id': `${ORIGIN}/wissen/glossar#set`, name: 'Glossar Immobilienfinanzierung', inLanguage: 'de-DE',
    hasDefinedTerm: Object.entries(g).map(([k, v]) => ({ '@type': 'DefinedTerm', name: k, description: v, inDefinedTermSet: `${ORIGIN}/wissen/glossar#set` })) };
}
const HOWTO = {
  '@type': 'HowTo', name: 'In drei Schritten zur bankfertigen Kreditmappe',
  step: [
    { '@type': 'HowToStep', position: 1, name: 'Profil und Haushaltsrechnung', text: 'Einkommen, Ausgaben, Eigenkapital und Haushaltsgröße im Konto erfassen.' },
    { '@type': 'HowToStep', position: 2, name: 'Objekt und Wirtschaftlichkeit', text: 'Kaufpreis, Miete, Kosten und Finanzierung eintragen; Cashflow, DSCR und Stresstest prüfen.' },
    { '@type': 'HowToStep', position: 3, name: 'Unterlagen und Kreditmappe', text: 'Unterlagen hochladen, Kreditmappe als PDF erzeugen und per befristetem Link freigeben.' },
  ],
};

function headBlock(p, html) {
  const url = `${ORIGIN}${p.path === '/' ? '/' : p.path}`;
  const lines = [
    `<meta name="description" content="${esc(p.desc)}">`,
    `<meta name="robots" content="${p.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}">`,
  ];
  if (!p.noCanonical) lines.push(`<link rel="canonical" href="${url}">`);
  if (!p.noindex) {
    lines.push(
      '<meta property="og:type" content="website">', '<meta property="og:site_name" content="ImmoAdv">', '<meta property="og:locale" content="de_DE">',
      `<meta property="og:title" content="${esc(p.title)}">`, `<meta property="og:description" content="${esc(p.desc)}">`, `<meta property="og:url" content="${url}">`,
      `<meta property="og:image" content="${ORIGIN}/og-image.png">`, '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
      '<meta property="og:image:alt" content="ImmoAdv – Immobilie als Kapitalanlage durchrechnen">',
      '<meta name="twitter:card" content="summary_large_image">', `<meta name="twitter:title" content="${esc(p.title)}">`,
      `<meta name="twitter:description" content="${esc(p.desc)}">`, `<meta name="twitter:image" content="${ORIGIN}/og-image.png">`,
    );
    const graph = [ORG];
    const ex = p.extra || [];
    if (ex.includes('website')) graph.push({ '@type': 'WebSite', '@id': `${ORIGIN}/#site`, url: `${ORIGIN}/`, name: 'ImmoAdv', inLanguage: 'de-DE', publisher: { '@id': `${ORIGIN}/#org` } });
    if (ex.includes('app')) graph.push(APP);
    if (ex.includes('howto')) graph.push(HOWTO);
    if (ex.includes('faq')) graph.push(faqLd());
    if (ex.includes('homefaq')) graph.push(homeFaqLd(html));
    if (ex.includes('glossar')) graph.push(glossarLd());
    const bc = breadcrumb(p);
    if (bc) graph.push(bc);
    lines.push(`<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`);
  }
  return `<!--seo:start-->${lines.join('')}<!--seo:end-->`;
}

const template = read('rechner/index.html').replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, '');
const results = [];
for (const p of PAGES) {
  if (p.skip) { results.push(p); continue; } // Next.js-Seite: Metadaten in app/layout.tsx
  const file = p.file || `${p.path.slice(1)}/index.html`;
  let html = existsSync(new URL(file, pub)) ? read(file) : template;
  html = html.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, '');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`);
  if (!html.includes(`<title>${esc(p.title)}</title>`)) throw new Error(`Kein <title> in ${file}`);
  // vorhandene Einzelangaben ersetzen statt doppeln
  html = html.replace(/<meta name="description"[^>]*>/g, '');
  html = html.replace(`<title>${esc(p.title)}</title>`, `<title>${esc(p.title)}</title>${headBlock(p, html)}`);
  write(file, html);
  results.push(p);
}

// Sitemap und robots.txt
const indexable = results.filter((p) => !p.noindex);
const prio = (p) => (p.path === '/' ? '1.0' : p.path.split('/').length > 3 ? '0.6' : ['/impressum', '/datenschutz', '/nutzungsbedingungen', '/kuendigen'].includes(p.path) ? '0.3' : '0.8');
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((p) => `  <url><loc>${ORIGIN}${p.path === '/' ? '/' : p.path}</loc><lastmod>${today}</lastmod><priority>${prio(p)}</priority></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /app/\nDisallow: /auth/\nDisallow: /datenraum\nDisallow: /pruefen\nDisallow: /verify/\nDisallow: /p/\nDisallow: /partner\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
console.log(`SEO: ${results.length} Seiten, ${indexable.length} in der Sitemap`);
