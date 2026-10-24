// Alle E-Mails, die ImmoAdv verschicken kann – mit Beispieldaten, für den Test „Alle Vorlagen an mich“ im Web-Admin.
// Texte entsprechen den echten Vorlagen in den jeweiligen Routen (Datei steht bei jedem Eintrag). Anhänge (PDF) werden im
// Test nicht mitgeschickt. Bei Änderungen an einer Vorlage bitte hier mitziehen.
import type { MailOptions } from '@/lib/notify/mail';
import { readyMail, reminderMail } from '@/lib/creator/mails';

export type SampleMail = { group: string; label: string; subject: string; text: string; opts?: MailOptions };

const S = 'https://immoadv.de';
const N = 'Max Mustermann', F = 'Max', CO = 'Musterberatung GmbH', MAIL = 'kunde@example.com', PW = 'Beispiel-Passwort-123';
const LINK = `${S}/auth/confirm?th=BEISPIEL&type=magiclink`;
const AT = '23. Oktober 2026 um 21:00:00 Uhr (MEZ/MESZ)';

const kuendText = ['Kündigungserklärung', '', `Eingang: ${AT}`, `Name: ${N}`, `E-Mail: ${MAIL}`, 'Vertrag: ImmoAdv Pro (monatlich)', 'Art: ordentliche Kündigung, zum nächstmöglichen Zeitpunkt'].join('\n');
const widerrufText = ['Widerrufserklärung', '', 'Hiermit widerrufe ich den von mir abgeschlossenen Vertrag.', '', `Eingang: ${AT}`, `Name: ${N}`, `E-Mail: ${MAIL}`, 'Vertrag: Kreditmappe', 'Rechnungs-/Bestellnummer: IA-2026-0042'].join('\n');

const CREATOR_STATUS: [string, string, string, string][] = [
  ['Freigabe', 'Willkommen als ImmoAdv Creator Partner', 'Du bist freigeschaltet', 'deine Bewerbung als ImmoAdv Creator Partner wurde freigegeben. Dein Creator-Portal ist ab sofort aktiv:\n\nhttps://immoadv.de/creator'],
  ['Rückfrage', 'ImmoAdv benötigt noch eine Information von dir', 'Angabe ergänzen', 'für deine Creator-Bewerbung benötigen wir noch eine Information:\n\nBitte ergänze den Link zu deinem Instagram-Profil.\n\nBitte ergänze die Angabe im Creator-Bereich und reiche die Bewerbung erneut ein:\n\nhttps://immoadv.de/creator'],
  ['Ablehnung', 'Deine Bewerbung als ImmoAdv Creator', 'Bewerbung nicht freigegeben', 'vielen Dank für dein Interesse. Wir können deine Bewerbung als Creator Partner derzeit leider nicht freigeben.\n\nBeispielbegründung.'],
  ['Pausiert', 'Dein ImmoAdv Creator-Zugang wurde pausiert', 'Zugang pausiert', 'dein Creator-Zugang wurde vorübergehend pausiert.\n\nBeispielbegründung.\n\nBei Fragen: support@immoadv.de'],
  ['Wieder aktiv', 'Dein ImmoAdv Creator-Zugang ist wieder aktiv', 'Zugang wieder aktiv', 'dein Creator-Zugang ist wieder aktiv:\n\nhttps://immoadv.de/creator'],
];

export function sampleMails(): SampleMail[] {
  const out: SampleMail[] = [];
  const add = (group: string, label: string, subject: string, text: string, opts?: MailOptions) => out.push({ group, label, subject, text, opts });

  // ---------- Privatkunden: Konto (app/api/auth/mail) ----------
  for (const biz of [false, true]) {
    const g = biz ? 'Unternehmen · Konto' : 'Privatkunden · Konto', area = biz ? 'b2b' as const : 'b2c' as const, sfx = biz ? ' – ImmoAdv Unternehmensportal' : ' – ImmoAdv';
    add(g, 'Registrierung bestätigen', `Bitte bestätigen Sie Ihre E-Mail-Adresse${sfx}`,
      biz ? 'Willkommen im ImmoAdv-Unternehmensportal!\n\nBitte bestätigen Sie Ihre E-Mail-Adresse. Danach richten Sie Ihr Unternehmenskonto ein: Unternehmensdaten, Auftragsverarbeitungsvertrag und Gewerbenachweis.'
        : 'Willkommen bei ImmoAdv!\n\nBitte bestätigen Sie Ihre E-Mail-Adresse, damit wir Ihr Konto freischalten können. Danach können Sie sofort loslegen: Lernbereich, Rechner, RenditeRadar und BankReady.',
      { area, title: 'E-Mail-Adresse bestätigen', button: { label: 'E-Mail-Adresse bestätigen', url: LINK }, note: 'Der Link ist 24 Stunden gültig und kann nur einmal verwendet werden. Wenn Sie sich nicht registriert haben, ignorieren Sie diese E-Mail einfach.' });
    add(g, 'Konto besteht bereits', 'Sie haben bereits ein ImmoAdv-Konto',
      'Guten Tag,\n\njemand (vermutlich Sie) wollte mit dieser E-Mail-Adresse ein neues ImmoAdv-Konto anlegen. Für diese Adresse besteht bereits ein Konto.\n\nMelden Sie sich einfach an – oder setzen Sie Ihr Passwort zurück, falls Sie es vergessen haben.',
      { area, title: 'Ihr Konto besteht bereits', button: { label: 'Zur Anmeldung', url: biz ? `${S}/b2b-portal` : `${S}/auth/login` }, note: `Passwort vergessen? ${S}/auth/forgot${biz ? '?bereich=b2b' : ''} – Wenn Sie das nicht waren, können Sie diese E-Mail ignorieren.` });
    add(g, 'Passwort zurücksetzen', `Passwort zurücksetzen${sfx}`,
      biz ? 'Guten Tag,\n\nSie haben angefordert, Ihr Passwort für das ImmoAdv-Unternehmensportal zurückzusetzen. Über den Knopf legen Sie ein neues Passwort fest und gelangen danach direkt ins Portal.'
        : 'Guten Tag,\n\nSie haben angefordert, Ihr ImmoAdv-Passwort zurückzusetzen. Über den Knopf legen Sie ein neues Passwort fest.',
      { area, title: 'Neues Passwort festlegen', button: { label: 'Neues Passwort festlegen', url: LINK }, note: 'Der Link ist nur kurze Zeit gültig und kann einmal verwendet werden. Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail – Ihr Passwort bleibt unverändert.' });
    add(g, 'Anmeldelink', `Ihr Anmeldelink${sfx}`,
      biz ? 'Guten Tag,\n\nhier ist Ihr Anmeldelink für das ImmoAdv-Unternehmensportal. Ein Klick genügt – ganz ohne Passwort.' : 'Guten Tag,\n\nhier ist Ihr Anmeldelink für ImmoAdv. Ein Klick genügt – ganz ohne Passwort.',
      { area, title: 'Jetzt anmelden', button: { label: 'Bei ImmoAdv anmelden', url: LINK }, note: 'Der Link ist nur kurze Zeit gültig und kann einmal verwendet werden. Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail – Ihr Konto bleibt geschützt.' });
    add(g, 'Bestätigungslink erneut', `Ihr Bestätigungslink${sfx}`,
      biz ? 'Guten Tag,\n\nhier ist Ihr neuer Link. Er bestätigt Ihre E-Mail-Adresse und meldet Sie direkt im Unternehmensportal an.' : 'Guten Tag,\n\nhier ist Ihr neuer Link. Er bestätigt Ihre E-Mail-Adresse und meldet Sie direkt bei ImmoAdv an.',
      { area, title: 'E-Mail-Adresse bestätigen', button: { label: 'Bestätigen und anmelden', url: LINK }, note: 'Der Link ist nur kurze Zeit gültig und kann einmal verwendet werden.' });
  }

  // ---------- Privatkunden: Verträge, Datenraum, Erinnerungen ----------
  const P = 'Privatkunden';
  add(P, 'Kündigung – Bestätigung an Kunden', 'Bestätigung Ihrer Kündigung bei ImmoAdv', `Guten Tag ${N},\n\nwir haben Ihre Kündigung erhalten. Diese E-Mail ist Ihre Eingangsbestätigung.\n\n${kuendText}`, { title: 'Ihre Kündigung ist eingegangen' });
  add(P, 'Widerruf – Bestätigung an Kunden', 'Eingangsbestätigung Ihres Widerrufs bei ImmoAdv',
    `Guten Tag ${N},\n\nwir haben Ihren Widerruf erhalten. Diese E-Mail ist Ihre Eingangsbestätigung (§ 356a BGB). Bereits gezahlte Beträge erstatten wir unverzüglich, spätestens binnen 14 Tagen, über das ursprüngliche Zahlungsmittel.\n\n${widerrufText}`, { title: 'Ihr Widerruf ist eingegangen' });
  add(P, 'Datenraum geöffnet', 'ImmoAdv: Ihr Datenraum wurde geöffnet',
    'Ihr Freigabelink für „Musterstraße 12, Darmstadt“ wurde soeben zum ersten Mal geöffnet.\n\nGültig bis: 30.10.2026, 21:00:00\nVerbleibende Aufrufe: 4\n\nAlle Zugriffe sehen Sie im Konto unter „Unterlagen & Datenraum“. Dort können Sie den Link jederzeit sofort widerrufen:\nhttps://immoadv.de/app/dashboard\n\nWaren Sie das nicht oder haben Sie den Link nicht weitergegeben? Widerrufen Sie ihn bitte umgehend.\n\nDiese Nachricht wurde automatisch versendet.');
  add(P, 'Unterlage angefordert', 'ImmoAdv: Unterlage angefordert',
    'Über Ihren Freigabelink wurde eine Unterlage angefordert:\n\nKategorie: Einkommensnachweise\nHinweis: Bitte die letzten drei Gehaltsabrechnungen.\n\nSie können die Unterlage in Ihrem Konto unter „Unterlagen & Datenraum“ hochladen und die Anfrage dort als erledigt markieren:\nhttps://immoadv.de/app/dashboard\n\nDiese Nachricht wurde automatisch versendet.');
  add(P, 'Fristen-Erinnerung', 'Erinnerung: Ende der Zinsbindung (01.03.2027)', ['Guten Tag,', '', 'für Ihre Objekte bei ImmoAdv stehen folgende Termine an:', '',
    '• Musterstraße 12: Ende der Zinsbindung am 01.03.2027 (in 129 Tagen)\n  Anschlussfinanzierung rechtzeitig vergleichen. Grundlage: Ihre Angaben zum Darlehen.', '',
    `Alle Fristen im Überblick: ${S}/fristen`, `Anschlusszins durchrechnen: ${S}/szenarien`, '',
    `Sie erhalten diese Nachricht, weil Sie Fristen-Erinnerungen im Konto aktiviert haben. Abschalten: ${S}/app/dashboard → „Daten & Konto“.`,
    'Die Termine beruhen auf Ihren eigenen Angaben und sind ohne Gewähr; maßgeblich sind Ihre Verträge. Keine Rechts- oder Steuerberatung.', '', 'ImmoAdv · immoadv.de'].join('\n'));
  add(P, 'Export (PDF) zugeschickt', 'Ihre Kreditmappe von ImmoAdv', 'Guten Tag,\n\nanbei Ihre Kreditmappe als PDF. (Im Test ohne Anhang.)\n\nSie haben diese E-Mail selbst in Ihrem ImmoAdv-Konto angefordert.\nImmoAdv · immoadv.de');
  add(P, 'Bewertungsbitte nach Kauf', 'Danke für Ihren Kauf – hat Ihnen ImmoAdv geholfen?',
    'Vielen Dank, dass Sie ImmoAdv nutzen!\n\nWenn Ihnen ImmoAdv gefallen hat, freuen wir uns über eine kurze, ehrliche Bewertung bei Google. Sie dauert nur eine Minute und hilft anderen Käufern bei der Entscheidung.\n\nWenn etwas nicht gepasst hat, antworten Sie einfach auf diese E-Mail – wir kümmern uns darum.\n\nDiese einmalige E-Mail erhalten Sie, weil Sie beim Kauf eingewilligt haben. Weitere Bitten um Bewertungen senden wir nicht.',
    { title: 'Wie zufrieden sind Sie?', button: { label: 'Kurz bei Google bewerten', url: 'https://g.page/r/immoadv/review' } });
  add(P, 'Newsletter bestätigen', 'Bitte bestätigen: Neuigkeiten von ImmoAdv', `Guten Tag ${N},\n\nbitte bestätigen Sie, dass Sie Neuigkeiten von ImmoAdv per E-Mail erhalten möchten. Ohne Bestätigung senden wir Ihnen nichts.`,
    { title: 'Anmeldung bestätigen', button: { label: 'Anmeldung bestätigen', url: `${S}/api/newsletter?confirm=BEISPIEL` }, note: 'Sie haben sich nicht angemeldet? Dann ignorieren Sie diese E-Mail einfach.' });
  add(P, 'Newsletter / Werbung (Beispiel)', 'Neu bei ImmoAdv: Beispiel-Newsletter', 'Guten Tag,\n\ndas ist ein Beispiel für einen Newsletter aus dem Web-Admin → Werbung.',
    { title: 'Neu bei ImmoAdv: Beispiel-Newsletter', button: { label: 'Jetzt ansehen', url: S }, note: `Sie erhalten diese E-Mail, weil Sie Neuigkeiten von ImmoAdv bestellt haben. Abmelden: ${S}/api/newsletter/unsub?t=BEISPIEL` });
  add(P, 'Konto vom Admin angelegt', 'Ihr ImmoAdv-Konto ist eingerichtet',
    `Guten Tag ${N},\n\nIhr persönliches ImmoAdv-Konto ist eingerichtet.\n\nAnmeldung: https://immoadv.de/auth/login\nBenutzername: ${MAIL}\nPasswort: ${PW}\n\nBei der ersten Anmeldung legen Sie ein eigenes Passwort fest. Das Startpasswort ist danach ungültig.`,
    { title: 'Ihr Konto ist eingerichtet', button: { label: 'Jetzt anmelden', url: `${S}/auth/login` }, note: 'Bitte geben Sie das Startpasswort nicht weiter. Fragen: support@immoadv.de' });
  add(P, 'Einladung vom Berater', `${CO} lädt Sie zu ImmoAdv ein`,
    `Guten Tag ${N},\n\n${CO} begleitet Sie bei Ihrer Immobilienfinanzierung und lädt Sie zu ImmoAdv ein. Dort bereiten Sie Finanzprofil, Objekt und Unterlagen vor – Schritt für Schritt bis zur bankfertigen Kreditmappe.\n\nWenn Sie zustimmen, sieht Ihr Berater nur Ihren Fortschritt (Stufe, Bankreife in Prozent, Anzahl der Unterlagen) – keine Dokumente und keine Inhalte. Sie können die Verbindung jederzeit trennen.\n\nDer Link ist 14 Tage gültig.`,
    { title: `Einladung von ${CO}`, button: { label: 'Einladung ansehen', url: `${S}/einladung?t=BEISPIEL` }, note: 'Kostenlos für Sie. Ohne Ihre Zustimmung wird nichts geteilt.', sender: CO });
  add(P, 'Berater bittet um Unterlagen', `${CO} bittet um Ihre Unterlagen`,
    `Guten Tag ${N},\n\nIhr Berater bei ${CO} bittet Sie, die noch fehlenden Unterlagen in ImmoAdv zu ergänzen – damit Ihre Finanzierung zügig weitergehen kann.\n\nNoch offen:\n• Einkommensnachweise\n• Grundbuchauszug\n\nNachricht Ihres Beraters:\nBitte bis Freitag hochladen.`,
    { title: 'Fehlende Unterlagen ergänzen', button: { label: 'Unterlagen ergänzen', url: `${S}/app/dashboard#objekte` }, note: 'Ihre Dokumente sieht Ihr Berater nicht – nur, welche Arten noch fehlen. Die Verbindung können Sie im Konto unter „Berater-Freigaben“ trennen.' });
  add(P, 'Eingangsbestätigung Finanzierungsanfrage', `Ihre Anfrage an ${CO}`,
    `Guten Tag ${N},\n\nIhre Finanzierungsanfrage ist bei ${CO} (64283 Darmstadt) eingegangen. ${CO} meldet sich direkt bei Ihnen.\n\nVerantwortlich für Ihre Daten ist ${CO}; ImmoAdv verarbeitet sie nur im Auftrag. Ihre Einwilligung können Sie jederzeit gegenüber ${CO} widerrufen (Kontakt: info@musterberatung.de).\n\nDie angezeigten Werte sind rechnerische Orientierungswerte, keine Kreditzusage.\n\nDiese E-Mail wurde automatisch versendet.`);

  // ---------- Unternehmen ----------
  const B = 'Unternehmen', b2b = { area: 'b2b' as const };
  add(B, 'Zugang vom Admin angelegt', 'Ihr Zugang zum ImmoAdv-Unternehmensportal',
    `Guten Tag ${N},\n\nIhr Unternehmenskonto für ${CO} ist eingerichtet (Kundennummer K-10042).\n\nPortal: https://partner.immoadv.de\nBenutzername: ${MAIL}\nPasswort: ${PW}\n\nBei der ersten Anmeldung legen Sie ein eigenes Passwort fest und bestätigen die Vertragsunterlagen (Unternehmereigenschaft, Auftragsverarbeitungsvertrag). Das Startpasswort ist danach ungültig.`,
    { area: 'b2b', title: 'Ihr Zugang ist eingerichtet', button: { label: 'Zum Unternehmensportal', url: 'https://partner.immoadv.de' }, note: 'Bitte geben Sie das Startpasswort nicht weiter. Fragen: support@immoadv.de' });
  add(B, 'Registrierung – Nachweis', 'Ihre Registrierung bei ImmoAdv – Nachweis RN-BEISPIEL',
    `Guten Tag ${N},\n\nIhr Unternehmenskonto für ${CO} ist angelegt (Kundennummer K-10042). Im Anhang finden Sie den Nachweis über Ihre Angaben und Erklärungen. Bitte prüfen Sie ihn; falsche Angaben teilen Sie uns bitte umgehend an support@immoadv.de mit.\n\nNächster Schritt: Gewerbenachweis im Portal hochladen (https://immoadv.de/b2b-portal#verifizierung). Den Auftragsverarbeitungsvertrag können Sie jederzeit unter https://immoadv.de/b2b-portal#profil herunterladen.\n\n(Im Test ohne Anhang und ohne Nachweistext.)\n\nImmoAdv · Head of Operations: Feray Korkmaz`, b2b);
  add(B, 'Konto freigeschaltet', 'Ihr ImmoAdv-Unternehmenskonto ist freigeschaltet',
    `Guten Tag ${N},\n\nwir haben Ihre Unterlagen geprüft und Ihr Unternehmenskonto für ${CO} freigeschaltet. Partnerseite, Widget, Anfragen, Kreditmappen und Tarife stehen Ihnen jetzt zur Verfügung:\nhttps://immoadv.de/b2b-portal\n\nImmoAdv · support@immoadv.de`, b2b);
  add(B, 'Unterlagen ergänzen', 'Ihr ImmoAdv-Unternehmenskonto: Unterlagen bitte ergänzen',
    `Guten Tag ${N},\n\nwir konnten Ihr Unternehmenskonto für ${CO} noch nicht freischalten.\n\nBegründung: Der Gewerbenachweis ist nicht lesbar.\n\nBitte laden Sie die fehlenden Unterlagen im Portal unter „Verifizierung“ hoch und reichen Sie erneut ein:\nhttps://immoadv.de/b2b-portal#verifizierung\n\nImmoAdv · support@immoadv.de`, b2b);
  add(B, 'Berater-Zugang (Team)', `Ihr Zugang für ${CO} auf ImmoAdv`,
    `Guten Tag,\n\n${N} hat für Sie einen Berater-Zugang im ImmoAdv-Unternehmensportal von ${CO} eingerichtet.\n\nPortal: https://partner.immoadv.de\nBenutzername: ${MAIL}\nStartpasswort: ${PW}\n\nBei der ersten Anmeldung legen Sie ein eigenes Passwort fest.`,
    { area: 'b2b', title: 'Ihr Berater-Zugang', button: { label: 'Zum Unternehmensportal', url: 'https://partner.immoadv.de' }, note: 'Bitte das Startpasswort nicht weitergeben.' });
  add(B, 'Neue Finanzierungsanfrage', 'Neue Finanzierungsanfrage über ImmoAdv (Widget)',
    `Neue Anfrage für ${CO}\n\nName: ${N}\nE-Mail: ${MAIL}\nTelefon: 0151 1234567\nObjekt: Musterstraße 12, Darmstadt\nKaufpreis: 350.000 € · Kaltmiete: 1.100 € · Eigenkapital: 70.000 €\nGesamtkosten: 389.000 € · Darlehen: 319.000 € · DSCR: 1,12\n\nNachricht: Bitte um Rückruf.\n\nAlle Angaben im Portal: https://immoadv.de/b2b-portal#anfragen\n\nRechnerische Orientierungswerte, keine Kreditentscheidung.`, b2b);
  add(B, 'Neue Einreichung (an Bank)', `Neue Einreichung von ${CO}`,
    `Guten Tag,\n\n${CO} hat eine Kreditmappe zur Vorprüfung eingereicht: Musterstraße 12, Darmstadt.\nHinweis: Bitte um kurze Einschätzung.\n\nIm Postkorb ansehen: https://immoadv.de/b2b-portal#einreichungen\n\nDie Kreditmappe ist eine rechnerische Aufbereitung; die Kreditentscheidung trifft Ihr Institut.`, b2b);
  add(B, 'Status einer Einreichung', 'Einreichung „Musterstraße 12“: In Prüfung',
    'Guten Tag,\n\nMusterbank eG hat den Status Ihrer Einreichung „Musterstraße 12“ auf „In Prüfung“ gesetzt.\n\nNachricht: Wir melden uns bis Mittwoch.\n\nhttps://immoadv.de/b2b-portal#einreichungen', b2b);
  add(B, 'Rechnung', 'Rechnung IA-2026-0042',
    `Guten Tag ${N},\n\nanbei erhalten Sie unsere Rechnung IA-2026-0042 über 119,00 €.\nZahlbar bis 06.11.2026. Den GiroCode auf der Rechnung können Sie mit Ihrer Banking-App scannen.\n\nAlle Rechnungen finden Sie auch im Unternehmensportal: https://immoadv.de/b2b-portal#tarif\n\n(Im Test ohne PDF.)\n\nMit freundlichen Grüßen\nImmoAdv`, b2b);
  add(B, 'Zahlungserinnerung', 'Zahlungserinnerung: Rechnung IA-2026-0042',
    `Guten Tag ${N},\n\nbei der Durchsicht unserer Buchhaltung haben wir festgestellt, dass die Rechnung IA-2026-0042 vom 23.10.2026 über 119,00 € (fällig am 06.11.2026) noch offen ist.\nSicher handelt es sich um ein Versehen. Bitte überweisen Sie den Betrag in den nächsten 7 Tagen; die Rechnung liegt erneut bei.\nSollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.\n\nMit freundlichen Grüßen\nImmoAdv`, b2b);
  add(B, 'Bestandskunden-Radar', 'Bestandskunden-Radar 2026-11: 2 Anschlussfinanzierungen in Sicht',
    `Guten Tag ${N},\n\nbei diesen Kunden endet die Zinsbindung demnächst (nur Kunden, die dem Radar zugestimmt haben):\n\n• Anna Beispiel – Zinsbindung endet 03/2027\n• Ben Muster – Zinsbindung endet 05/2027\n\nAlle Details im Portal unter „Kunden“.\n\nDiese E-Mail wurde automatisch erstellt.`,
    { area: 'b2b', title: 'Bestandskunden-Radar', button: { label: 'Kunden im Portal öffnen', url: `${S}/b2b-portal#kunden` } });

  // ---------- Creator ----------
  const C = 'Creator';
  add(C, 'Registrierung bestätigen', 'Bitte bestätige deine E-Mail-Adresse – ImmoAdv Creator', 'Willkommen im ImmoAdv Creator-Bereich!\n\nBitte bestätige deine E-Mail-Adresse. Danach kannst du direkt deine Bewerbung ausfüllen.',
    { title: 'E-Mail-Adresse bestätigen', button: { label: 'E-Mail-Adresse bestätigen', url: LINK }, note: 'Der Link ist 24 Stunden gültig und kann nur einmal verwendet werden. Wenn du dich nicht registriert hast, ignoriere diese E-Mail einfach.' });
  add(C, 'Konto besteht bereits', 'Du hast bereits ein Creator-Konto', 'Hallo,\n\njemand (vermutlich du) wollte mit dieser E-Mail-Adresse ein neues Creator-Konto bei ImmoAdv anlegen. Für diese Adresse gibt es im Creator-Bereich bereits ein Konto.\n\nMelde dich einfach an – oder setze dein Passwort zurück, falls du es vergessen hast.',
    { title: 'Dein Creator-Konto besteht bereits', button: { label: 'Zur Anmeldung', url: `${S}/creator/anmelden` }, note: 'Wenn du das nicht warst, kannst du diese E-Mail ignorieren.' });
  add(C, 'Passwort zurücksetzen', 'Passwort zurücksetzen – ImmoAdv Creator', 'Hallo,\n\ndu hast ein neues Passwort für deinen ImmoAdv Creator-Zugang angefordert.',
    { title: 'Neues Passwort festlegen', button: { label: 'Neues Passwort festlegen', url: LINK }, note: 'Der Link ist nur kurze Zeit gültig und kann nur einmal verwendet werden. Wenn du das nicht angefordert hast, ignoriere diese E-Mail.' });
  add(C, 'Zugang vom Admin angelegt', 'Dein Zugang zum ImmoAdv Creator-Bereich',
    `Hallo ${F},\n\ndein Zugang zum ImmoAdv Creator-Bereich ist eingerichtet.\n\nAnmeldung: ${S}/creator/anmelden\nBenutzername: ${MAIL}\nPasswort: ${PW}\n\nNach der Anmeldung füllst du deine Bewerbung aus; danach prüfen wir sie.\n\nDein Passwort kannst du jederzeit über „Passwort vergessen“ ändern.`,
    { title: 'Dein Creator-Zugang ist eingerichtet', button: { label: 'Jetzt anmelden', url: `${S}/creator/anmelden` }, note: 'Bitte gib dein Passwort nicht weiter. Fragen: support@immoadv.de' });
  add(C, 'Bewerbung eingegangen', 'Deine Bewerbung als ImmoAdv Creator ist eingegangen',
    `Hallo ${F},\n\ndanke für deine Bewerbung als ImmoAdv Creator Partner. Wir prüfen deine Angaben und melden uns per E-Mail, sobald die Prüfung abgeschlossen ist.\n\nDeinen Stand siehst du jederzeit im Creator-Bereich: https://immoadv.de/creator`, { title: 'Bewerbung eingegangen' });
  for (const [l, subject, title, text] of CREATOR_STATUS) add(C, `Status: ${l}`, subject, `Hallo ${F},\n\n${text}`, { title });
  add(C, 'Anmerkung zu Beitrag', 'Anmerkung zu deinem Beitrag',
    `Hallo ${F},\n\nzu deinem Beitrag https://instagram.com/p/BEISPIEL hat ImmoAdv eine Anmerkung:\n\nBitte den Werbehinweis „Anzeige“ ergänzen.\n\nDu kannst den Beitrag im Creator Studio anpassen: https://immoadv.de/creator#studio`, { title: 'Anmerkung zu deinem Beitrag' });
  add(C, 'Zahlungsdaten geändert', 'Deine Zahlungsdaten bei ImmoAdv wurden geändert',
    `Hallo ${F},\n\nim ImmoAdv Creator-Portal wurden soeben deine Zahlungsdaten geändert. Neues Konto: DE•• •••• •••• •••• ••12 34.\n\nWenn du das nicht selbst warst, antworte bitte sofort auf diese E-Mail oder schreibe an support@immoadv.de. Ausstehende Auszahlungen halten wir bis zur Klärung an.`, { title: 'Zahlungsdaten geändert' });
  for (const mode of ['INVOICE', 'CREDIT_NOTE'] as const) { const m = readyMail(mode, '2026-09', 12450, F); add(C, mode === 'INVOICE' ? 'Abrechnung bereit (Rechnung)' : 'Abrechnung bereit (Gutschrift)', m.subject, m.text, { title: m.title }); }
  { const m = reminderMail('2026-09', F); add(C, 'Erinnerung: Rechnung fehlt', m.subject, m.text, { title: m.title }); }
  add(C, 'Auszahlung überwiesen', 'Deine Auszahlung von ImmoAdv',
    `Hallo ${F},\n\nwir haben 124,50 € an dein Konto DE•• •••• •••• •••• ••12 34 überwiesen (Verwendungszweck: IA-CR-2026-09-0001). Je nach Bank ist der Betrag in 1–2 Bankarbeitstagen gutgeschrieben.\n\nDeine Abrechnungen findest du im Creator-Portal: ${S}/creator#abrechnung`, { title: 'Auszahlung überwiesen' });
  add(C, 'Auszahlung zurückgekommen', 'Deine Auszahlung ist zurückgekommen',
    `Hallo ${F},\n\ndeine Auszahlung über 124,50 € wurde von der Bank zurückgegeben. Bitte prüfe im Creator-Portal deine Zahlungsdaten (Kontoinhaber und IBAN) und ändere sie bei Bedarf. Sobald sie geprüft sind, zahlen wir erneut aus – an deiner Abrechnung ändert sich nichts.\n\n${S}/creator#auszahlung`, { title: 'Auszahlung zurückgekommen' });

  // ---------- An ImmoAdv (Benachrichtigungen an dich) ----------
  const I = 'An ImmoAdv';
  add(I, 'Neue Kündigung', `Kündigung: ImmoAdv Pro (monatlich) – ${N}`, kuendText, { title: 'Neue Kündigung' });
  add(I, 'Neuer Widerruf', `Widerruf: Kreditmappe – ${N}`, widerrufText, { title: 'Neuer Widerruf' });
  add(I, 'Kontaktformular', 'Kontakt Privatkunde: Frage zum Produkt', `${N} · ${MAIL}\nThema: Frage zum Produkt\nSeite: /angebote\n\nBeispielnachricht aus dem Kontaktformular.`, { replyTo: MAIL, title: 'Neue Kontaktanfrage' });
  add(I, 'B2B-Anfrage', `B2B-Anfrage (Zugang): ${CO}`, `${N}, ${CO}\n${MAIL} · 0151 1234567\n\nBeispielnachricht aus der Unternehmensanfrage.`);
  add(I, 'Neue B2B-Registrierung', `Neue B2B-Registrierung: ${CO} (Finanzierungsberatung)`, `${CO} hat sich registriert. (Im Test ohne Nachweis und Anhang.)\n\nPrüfen und freischalten: https://immoadv.de/intern/web-admin#partner`);
  add(I, 'Verifizierung eingereicht', `Verifizierung: ${CO}`, `Neue Verifizierung zur Prüfung\n\n${CO} (GmbH)\nKundennummer: K-10042\nArt: finanzierungsberater\nRegister/USt: HRB 12345 / DE123456789\nAnsprechpartner: ${N}, ${MAIL}\nAnschrift: Musterweg 1, 64283 Darmstadt\nNachweise: Gewerbeanmeldung\n\nPrüfen: https://immoadv.de/intern/web-admin#partner`);
  add(I, 'Verbesserungsvorschlag', 'Neuer Verbesserungsvorschlag (B2C)', 'Ein neuer Verbesserungsvorschlag ist eingegangen.\n\nBereich: Privatkunden (B2C)\nThema: Rechner\nWichtigkeit für den Kunden: 4 von 5',
    { title: 'Neuer Verbesserungsvorschlag', button: { label: 'Im Web-Admin ansehen', url: `${S}/intern/web-admin#vorschlaege` } });
  add(I, 'Sicherheitsalarm', '⚠ Sicherheitsalarm: Viele fehlgeschlagene Anmeldungen (Beispiel)', 'Beispiel: In den letzten 15 Minuten gab es auffällig viele fehlgeschlagene Anmeldungen am Web-Admin.',
    { title: 'Viele fehlgeschlagene Anmeldungen', button: { label: 'Im Web-Admin ansehen', url: `${S}/intern/web-admin#sicherheit` }, note: 'Diese E-Mail wird automatisch gesendet, höchstens alle 15 Minuten je Art.' });
  return out;
}
