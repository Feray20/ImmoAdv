# ImmoAdv Creator Hub

Stand: Phase 1 (Fundament) und Phase 2 (Attribution, Kampagnen, Asset Library, Community-Vorteil, Creator Studio, Performance).

## Einrichtung (einmalig, vor dem Livegang)

1. **Migration anwenden**: `docs/sql/2026-10-22_creator_hub.sql` im Supabase SQL Editor ausführen (idempotent).
   Danach empfohlen: `docs/sql/tests/creator_hub_rls_test.sql` ausführen – es rollt am Ende alles zurück und
   endet mit `ALL CREATOR HUB RLS TESTS PASSED`.
2. **Schlüssel für Zahlungsdaten** in Vercel (Production + Preview, *nicht* als `NEXT_PUBLIC_…`):
   ```
   CREATOR_PII_KEY = v1:<32 zufällige Bytes, Base64>
   ```
   Erzeugen: `node -e "console.log('v1:'+require('crypto').randomBytes(32).toString('base64'))"`.
   Ohne diesen Schlüssel nimmt das Portal keine Zahlungsdaten an (Antwort 503) – es gibt keinen unverschlüsselten Rückfall.
   Den Schlüssel zusätzlich sicher offline verwahren: Ohne ihn sind gespeicherte IBANs nicht mehr lesbar.
3. **Vereinbarung ersetzen**: Die Migration legt eine als *Entwurf* gekennzeichnete Platzhalter-Fassung an.
   Vor dem Start eine rechtlich geprüfte Fassung als neue Version einfügen (siehe unten).
4. **Rollen** (optional): Web-Admin → B2B → Creator Operations → „Rollen“.

### Zusätzlich für Phase 2
5. `docs/sql/2026-10-23_creator_hub_phase2.sql` ausführen (legt auch den privaten Bucket `creator-assets` an), danach `docs/sql/tests/creator_hub_phase2_test.sql`.
6. **Stripe-Webhook**: Ereignis `charge.refunded` zusätzlich abonnieren (Stripe → Entwickler → Webhooks), damit Erstattungen Conversions automatisch zurücknehmen.
7. **Community-Vorteil**: Für jeden Creator-Code in Stripe einen gleichnamigen *Aktionscode* (Promotion Code) mit dem gewünschten Rabatt anlegen. Die Bezahlseite erlaubt Aktionscodes bereits.
8. Optional zum Testen im Stripe-Testmodus: `CREATOR_COUNT_TEST_PAYMENTS=1` (nur Preview). Ohne diese Variable zählen Testzahlungen nie.

Einstieg für Creator: `https://immoadv.de/creator` (nicht verlinkt, noindex, nicht in der Sitemap, in robots.txt gesperrt).
Admin: Web-Admin → Bereich **B2B** → **Creator Operations**.

## Ablauf

```
Bewerbung beginnen → E-Mail bestätigt → Konto → Profil → Social Media → Rechnungsdaten → Auszahlung → Vereinbarung
→ Einreichen (SUBMITTED) → Prüfung (UNDER_REVIEW) → Freigabe (ACTIVE) | Rückfrage (INFO_REQUESTED) | Ablehnung (REJECTED)
ACTIVE ↔ SUSPENDED
```

- Während SUBMITTED/UNDER_REVIEW sind alle Angaben gesperrt – freigegeben wird genau das, was eingereicht wurde.
- Freigabe prüft die Vollständigkeit serverseitig erneut und vergibt einen zufälligen Attributions-Code (10 Zeichen, ohne personenbezogene Anteile).
- Status-Übergänge nutzen eine optimistische Sperre: zwei Admins können nicht gleichzeitig widersprüchlich entscheiden.

## Attribution (Phase 2)

| Schritt | Umsetzung |
|---|---|
| Link | `https://immoadv.de/<ziel>?ref=<code>[&utm_campaign=<kampagne>]`. Der Code ist zufällig, ohne Personenbezug, und kollidiert nie mit Partner-Slugs. |
| Besuch | Bestehende cookielose Reichweitenmessung (`immo_analytics`, Quelle `partner<code>`). Bei „Do Not Track“/GPC wird nichts gezählt. |
| Weg zur Registrierung | Das Messskript merkt sich `ref` und Kampagne **nur für die Sitzung** (`sessionStorage`, nicht bei DNT/GPC). Die Registrierung übernimmt sie. |
| Registrierung | Eine Zuordnung je Kundenkonto (`immo_creator_attributions`), erster Creator gewinnt. Für Google-Anmeldungen wird die Zuordnung beim ersten Kauf aus den Kontodaten nachgetragen. |
| Kauf | Stripe-Webhook: je bezahlter Checkout-Sitzung höchstens eine Conversion (Netto nach Rabatt). Eingelöster Creator-Code hat Vorrang vor dem Link. Zuordnungsfenster 90 Tage ab Registrierung (`immo_settings.creator_attribution_window_days`). |
| Ausschlüsse | Eigenkäufe des Creators, nicht aktive Creator, Testkäufe, Stripe-Testmodus, Unternehmenskäufe (B2B). |
| Erstattung | `charge.refunded` (vollständig) → Conversion `REVERSED`. Manuelle Rücknahme durch Finance/Super Admin mit Grund. |
| Datenschutz | Creator sehen nur Summen. Admins sehen Kunden nur als gekürzte Kennung. Bei Kontolöschung des Kunden bleibt die Conversion ohne Personenbezug für die Abrechnung erhalten. |

Fehler in der Creator-Zuordnung lassen Registrierung und Zahlungs-Webhook nie scheitern (abgefangen und protokolliert).

## Sicherheit (umgesetzt)

| Maßnahme | Umsetzung |
|---|---|
| Server-seitige Autorisierung | Jede Route prüft Anmeldung (Supabase-Token, serverseitig verifiziert) und lädt den Creator **nur** über die Nutzer-ID des Tokens. |
| Admin-Zugang | Bestehender Web-Admin: `ADMIN_EMAILS`, zweiter Faktor (aal2), IP-Freigabe, Drosselung. |
| RBAC | `immo_creator_admin_roles`, Matrix in `lib/creator/roles.ts`. Verweigerte Zugriffe → `ACCESS_DENIED` im Audit. |
| RLS | Alle Tabellen RLS aktiv; Creator dürfen höchstens eigene, nicht sensible Zeilen **lesen**. Zahlungsdaten, Audit, Rollen: kein Client-Zugriff. |
| IBAN-Verschlüsselung | AES-256-GCM in der Anwendung, gebunden an die Creator-ID (Associated Data), Schlüsselrotation über `CREATOR_PII_KEY_OLD`. |
| Maskierung | Überall `DE••••••••••4821` (Länge nicht erkennbar). Vollanzeige nur per POST, nur Super/Finance, 60 s, vorher protokolliert. |
| Kontowechsel | Atomar in der DB (`immo_creator_payout_replace`), alte Daten bleiben als SUPERSEDED erhalten; Änderung bei aktivem Creator → „Prüfung erforderlich“; Hinweis-Mail an den Creator. Gleiche IBAN bei anderem Creator → immer Prüfung. |
| Unveränderbarkeit | Trigger: Audit (kein UPDATE/DELETE/TRUNCATE), Zustimmungen, Prüfverlauf, veröffentlichte Vereinbarungen, Kontodaten. |
| Bot-Schutz / Drosselung | Honigtopf + Zeitfalle beim Start, Drosselung je Nutzer und je (anonymisierter) IP, bestehende Middleware-Sperrliste. |
| CSRF | Schnittstellen nutzen Bearer-Token aus dem Speicher statt Cookies – klassische CSRF-Angriffe greifen nicht. |
| XSS | Alle Ausgaben escaped, CSP `script-src 'self'`, nur `https://`-Links. |
| Datensparsamkeit im Audit | Akteure pseudonymisiert (bestehendes `pseudo()`), Metadaten-Filter blockiert IBAN, Nachrichten, Kontaktdaten. |

Die Sicherheitstexte im Portal beschreiben **nur** diese umgesetzten Maßnahmen und versprechen keinen absoluten Schutz.

## Rollen

| Recht | Super | Finance | Creator Mgr | Support | Read only |
|---|:-:|:-:|:-:|:-:|:-:|
| Liste, Profil, Social | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kontaktdaten | ✓ | ✓ | ✓ | ✓ | – |
| Business-/Rechnungsdaten | ✓ | ✓ | ✓ | – | – |
| Prüfen / Freigeben / Ablehnen | ✓ | – | ✓ | – | – |
| Pausieren / Reaktivieren | ✓ | – | ✓ | – | – |
| Zahlungsdaten maskiert | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zahlungsdaten vollständig | ✓ | ✓ | – | – | – |
| Zahlungsdaten als geprüft markieren | ✓ | ✓ | – | – | – |
| Audit lesen | ✓ | ✓ | ✓ | – | – |
| Kampagnen, Assets, Vorteile pflegen | ✓ | – | ✓ | – | – |
| Beiträge prüfen | ✓ | – | ✓ | – | – |
| Attribution, Conversions, Umsatz sehen | ✓ | ✓ | ✓ | – | ✓ |
| Conversion zurücknehmen | ✓ | ✓ | – | – | – |
| Rollen vergeben | ✓ | – | – | – | – |

Admins ohne Eintrag gelten als Super Admin (wie im übrigen Web-Admin). Die eigene Rolle kann niemand selbst ändern.

## Neue Vereinbarungsfassung veröffentlichen

```sql
insert into public.immo_creator_agreements (version, title, body, body_sha256, is_draft, published_at)
values ('2026-11', 'ImmoAdv Creator-Partnervereinbarung', $txt$…geprüfter Text…$txt$,
        encode(sha256(convert_to($txt$…geprüfter Text…$txt$, 'UTF8')), 'hex'), false, now());
```
Aktive Creator sehen danach „Vereinbarung bestätigen“ als nächste Aufgabe.

## Tests

- Unit: `npm test` (u. a. `tests/creator.test.ts`: IBAN, Tresor, Rollen, Status, Audit-Filter).
- Unit Phase 2: `tests/creator-attribution.test.ts` (Vorrang Code vor Link, Fenster, Eigenkauf, Ausschlüsse, Netto, Link-Aufbau).
- Datenbank lokal: `PGHOST=… PGPORT=… PGUSER=postgres bash docs/sql/tests/run_local.sh` (leere PostgreSQL ≥ 15; beide Phasen inkl. Rückbau).
- Datenbank Supabase: `docs/sql/tests/creator_hub_rls_test.sql` und `docs/sql/tests/creator_hub_phase2_test.sql` (rollen zurück).

## Nächste Phasen (noch nicht umgesetzt)

- **Phase 3 – Provision & Abrechnung**: versionierte Provisionsregeln (Prozent/fix/hybrid/gestaffelt/Bonus/kampagnenbezogen), serverseitige Berechnung, Monatsabschluss, Gutschrift/Rechnung als PDF (an `immo_invoices` + GoBD-Schutz anlehnen), Statements.
- **Phase 4 – Auszahlung**: Payout Center, Freigabe-Workflow (Vier-Augen), Zahlungsbestätigung, Export.
Die Audit-Ereignisse dieser Phasen sind in der Tabelle bereits zugelassen. Grundlage der Provision sind die Conversions aus Phase 2 (Status `PENDING` → künftig freigegeben/ausgezahlt). Teilerstattungen werden mit der Provisionsabrechnung behandelt.
