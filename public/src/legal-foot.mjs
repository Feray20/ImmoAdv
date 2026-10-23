// Einheitliche Fußzeile für Privatbereich (B2C) und Unternehmensportal (B2B): Hinweis + rechtliche Links.
export function legalFoot(area = 'b2c') {
  const biz = area === 'b2b';
  return `<footer class="ia-legal" role="contentinfo"><div class="ia-legal-in">
    <nav class="ia-legal-links" aria-label="Rechtliches"><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a><a href="/nutzungsbedingungen${biz ? '#b2b' : ''}">${biz ? 'AGB für Unternehmen' : 'Nutzungsbedingungen'}</a>${biz ? '' : '<a href="/kuendigen">Verträge kündigen</a><a href="/widerrufen">Vertrag widerrufen</a>'}<a href="mailto:support@immoadv.de">Kontakt</a></nav>
    <small>Technisches Analyse-, Informations- und Vorbereitungsinstrument. Keine Kreditvermittlung, keine Anlage-, Rechts-, Steuer- oder Finanzierungsberatung. <span class="ia-copy">© 2026 ImmoAdv</span></small>
  </div></footer>`;
}
