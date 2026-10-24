# ImmoAdv API v1

REST-Schnittstelle der ImmoAdv-Plattform für Makler-CRM, Finanzierungsvermittler, bankennahe Systeme, ERP- und Partnerportale:
Fälle übergeben, die **Vorprüfung** (Plausibilität, Unterlagen, Bank-Readiness) abrufen, Unterlagen hochladen, Berichte erzeugen und Ereignisse per Webhook empfangen.

> Die API liefert eine Vorprüfung, Plausibilitätsprüfung und strukturierte Fallanalyse. Sie trifft **keine Kreditentscheidung** und gibt keine Zusage. Die Kreditentscheidung liegt allein beim finanzierenden Institut.

| | |
|---|---|
| Basis-URL | `https://immoadv.de/api/v1` (über `API_BASE_URL` änderbar, z. B. `https://api.immoadv.de/api/v1` nach Einrichtung der Subdomain) |
| Testumgebung | gleiche Basis-URL, Schlüssel `test_…` – Testdaten sind strikt von Live-Daten getrennt |
| Format | JSON (UTF-8), Zeitangaben ISO 8601 UTC, Beträge in Euro |
| Spezifikation | [`/openapi/immoadv-api.yaml`](../../openapi/immoadv-api.yaml), [`/openapi/immoadv-api.json`](../../openapi/immoadv-api.json), live unter `/api/v1/openapi.json` |
| Status | `GET /api/v1/health` (öffentlich) |

## Tarife

| Tarif | API | Rate-Limit | Umfang |
|---|---|---|---|
| Basic | nein (CSV-Export) | – | – |
| Pro | ja | 60 Anfragen/Minute | Fälle anlegen/lesen, Vorprüfung, Schnell-Check, Unterlagenprüfung, Berichte (ImmoAdv-Branding) |
| Enterprise | voll | vertraglich (Standard 300/Minute) | zusätzlich Webhooks, White-Label-Berichte, Mandanten- und Berater-Routing |

Die Tarifprüfung erfolgt ausschließlich serverseitig (`lib/api/entitlements.ts`: `hasEntitlement`, `getTenantApiPolicy`). Zusätzlich muss die API je Mandant im Web-Admin freigeschaltet sein; Live-Schlüssel erfordern eine eigene Freigabe.

## Dokumente

- [QUICKSTART.md](QUICKSTART.md) – in zehn Minuten vom Schlüssel zum Bericht
- [AUTHENTICATION.md](AUTHENTICATION.md) – Schlüssel, Scopes, IP-Allowlist, Rotation
- [WEBHOOKS.md](WEBHOOKS.md) – Ereignisse, Signatur, Wiederholungen
- [ERRORS.md](ERRORS.md) – Fehlermodell und Codes
- [SECURITY.md](SECURITY.md) – Mandantentrennung, Datenschutz, Sicherheitsprüfung
- [CHANGELOG.md](CHANGELOG.md)
- [ARCHITECTURE.md](ARCHITECTURE.md) – Aufbau, Datenmodell, Betrieb

## Endpunkte

| Methode | Pfad | Scope |
|---|---|---|
| POST | `/cases` | `cases:write` |
| GET | `/cases` | `cases:read` |
| GET / PATCH / DELETE | `/cases/{id}` | `cases:read` / `cases:write` |
| GET | `/cases/{id}/validate` | `validation:execute` |
| POST / GET | `/cases/{id}/validations` | `validation:execute` / `validation:read` |
| GET | `/cases/{id}/validations/{validationId}` | `validation:read` |
| POST / GET | `/cases/{id}/documents` | `documents:write` / `documents:read` |
| GET / DELETE | `/cases/{id}/documents/{documentId}` | `documents:read` / `documents:write` |
| POST / GET | `/cases/{id}/reports` | `reports:create` / `reports:read` |
| GET | `/cases/{id}/reports/{reportId}` | `reports:read` |
| POST / GET | `/webhooks` | `webhooks:write` / `webhooks:read` (Enterprise) |
| GET / PATCH / DELETE | `/webhooks/{id}` | `webhooks:read` / `webhooks:write` |
| POST | `/webhooks/{id}/test` | `webhooks:test` |
| GET | `/webhooks/{id}/deliveries` | `webhooks:read` |
| GET | `/usage` | `usage:read` |
| GET / POST | `/api-keys` | `api_keys:read` / `api_keys:write` |
| GET | `/api-keys/{id}` | `api_keys:read` |
| POST | `/api-keys/{id}/rotate`, `/api-keys/{id}/revoke` | `api_keys:write` |
| GET | `/health` | – |

Listen verwenden Cursor-Paginierung: `?limit=1–100&cursor=…` → `{ "object": "list", "data": [...], "pagination": { "has_more", "next_cursor" } }`.

## Verwaltung im Web-Admin

`/intern/web-admin` → Bereich **B2B** → **API Management**: Overview, Get Started, Access, API Keys, Usage, Requests, Webhooks, Playground, Documentation, Sandbox, Health, Changelog, Settings.
