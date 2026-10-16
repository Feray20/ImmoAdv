// Admin-Zentrale (nur ADMIN_EMAILS, mit zweitem Faktor): Finanz-Cockpit, Partner, Rechnungsarchiv,
// Steuer-Export, Anfragen und Codes, Protokoll, Betreiber-Kennzahlen sowie Objektsuche und Analyse.
import { mountObjekt } from './objekt-ui.mjs';
import { api, download, dt, dtt, esc, eur, session, setSession, supa, token } from './sess.mjs';

const root = document.getElementById('intern');
const $ = (s, el = document) => el.querySelector(s);
const TIER = { BASIC: 'Basic', PRO: 'Pro', ENTERPRISE: 'Enterprise' };
const PAY = { PAID: 'bezahlt', PENDING: 'offen', OVERDUE: 'überfällig', CANCELLED: 'storniert' };
const msg = (t, bad = false) => { const el = $('#adMsg'); if (el) { el.textContent = t; el.className = 'form-note ' + (bad ? 'st bad' : ''); } };

// ---------- Zugang ----------
async function gate() {
  if (!token()) { root.innerHTML = '<h1>Interner Bereich</h1><p>Bitte zuerst <a class="ck-link" href="/auth/login?next=/intern/objektsuche">anmelden</a>.</p>'; return false; }
  const r = await api('/api/admin/check');
  if (r.status === 401) { root.innerHTML = '<h1>Interner Bereich</h1><p>Sitzung abgelaufen. Bitte neu <a class="ck-link" href="/auth/login?next=/intern/objektsuche">anmelden</a>.</p>'; return false; }
  if (r.data?.ipBlocked) { root.innerHTML = '<h1>Kein Zugriff</h1><p>Zugriff von dieser IP-Adresse ist nicht freigegeben (ADMIN_IP_ALLOWLIST in Vercel).</p>'; return false; }
  if (!r.data?.admin) {
    root.innerHTML = `<h1>Kein Zugriff</h1><p>Dieser Bereich ist nur für Administratoren.${r.data?.configured === false ? ' (In Vercel ist noch keine Administrator-Adresse hinterlegt: Variable ADMIN_EMAILS.)' : ''}</p>`;
    return false;
  }
  if (!r.data.mfaOk) { await mfa(); return false; }
  return true;
}

// Zweiter Faktor über Supabase MFA (TOTP-App wie Google Authenticator, 1Password).
async function mfa() {
  const auth = { Authorization: 'Bearer ' + token() };
  const u = await supa('/auth/v1/user', { headers: auth }).then((x) => x.json()).catch(() => ({}));
  const verified = (u.factors || []).find((f) => f.factor_type === 'totp' && f.status === 'verified');
  let factorId = verified?.id;
  let enrollHtml = '';
  if (!factorId) {
    // Unbestätigte Altfaktoren entfernen, dann neu einrichten.
    for (const f of (u.factors || []).filter((x) => x.status !== 'verified')) await supa(`/auth/v1/factors/${f.id}`, { method: 'DELETE', headers: auth });
    const e = await supa('/auth/v1/factors', { method: 'POST', headers: auth, body: JSON.stringify({ factor_type: 'totp', friendly_name: 'ImmoAdv Admin ' + new Date().toISOString().slice(0, 10) }) });
    const ej = await e.json().catch(() => ({}));
    if (!e.ok) { root.innerHTML = `<h1>Zweiter Faktor</h1><p>Einrichtung nicht möglich: ${esc(ej.msg || ej.error_description || e.status)}. In Supabase unter Authentication → Multi-Factor muss TOTP aktiviert sein.</p>`; return; }
    factorId = ej.id;
    enrollHtml = `<p>1. Diesen Code mit einer Authenticator-App scannen (Google Authenticator, 1Password, Authy):</p>
      <img src="${esc(ej.totp.qr_code)}" alt="QR-Code für die Authenticator-App" width="200" height="200">
      <p class="form-note">Oder Schlüssel manuell eingeben: <code>${esc(ej.totp.secret)}</code></p><p>2. Den 6-stelligen Code aus der App eingeben:</p>`;
  }
  root.innerHTML = `<div class="ad-mfa pt-card"><h1>Zweiter Faktor</h1>${enrollHtml || '<p>Bitte den 6-stelligen Code aus Ihrer Authenticator-App eingeben.</p>'}
    <form id="mfaF" class="pt-row"><input id="mfaC" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required aria-label="Code" style="font-size:22px;letter-spacing:.2em;width:9ch;padding:8px 10px;border:1px solid #CBD5E1;border-radius:6px"><button class="btn btn-dark" type="submit">Bestätigen</button></form>
    <p class="form-note" id="mfaMsg" role="status"></p></div>`;
  $('#mfaF').onsubmit = async (ev) => {
    ev.preventDefault();
    const c = await supa(`/auth/v1/factors/${factorId}/challenge`, { method: 'POST', headers: auth });
    const cj = await c.json().catch(() => ({}));
    if (!c.ok) { $('#mfaMsg').textContent = cj.msg || 'Fehler beim Anfordern.'; return; }
    const v = await supa(`/auth/v1/factors/${factorId}/verify`, { method: 'POST', headers: auth, body: JSON.stringify({ challenge_id: cj.id, code: $('#mfaC').value.trim() }) });
    const vj = await v.json().catch(() => ({}));
    if (!v.ok || !vj.access_token) { $('#mfaMsg').textContent = vj.msg || 'Code falsch oder abgelaufen.'; return; }
    setSession({ ...session(), ...vj });
    location.reload();
  };
}

// ---------- Rahmen ----------
const TABS = [['cockpit', 'Finanz-Cockpit'], ['sicherheit', 'Sicherheit'], ['partner', 'Partner'], ['rechnungen', 'Rechnungen'], ['steuer', 'Steuer-Export'], ['anfragen', 'Anfragen & Codes'], ['protokoll', 'Protokoll'], ['kennzahlen', 'Kennzahlen'], ['objekt', 'Objektsuche']];

function frame() {
  root.innerHTML = `<h1>Admin-Zentrale</h1><p class="form-note">Nur für Administratoren · angemeldet mit zweitem Faktor · alle Aktionen werden protokolliert.</p>
    <div class="ad-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-t="${k}">${l}</button>`).join('')}</div>
    <p id="adMsg" class="form-note" role="status"></p><div id="adView"></div>`;
  root.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { location.hash = b.dataset.t; });
}

function show() {
  const t = TABS.find(([k]) => k === location.hash.slice(1))?.[0] || 'cockpit';
  root.querySelectorAll('[data-t]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === t)));
  const v = $('#adView');
  v.innerHTML = '<p class="form-note">Wird geladen …</p>';
  msg('');
  ({ cockpit, sicherheit, partner, rechnungen, steuer, anfragen, protokoll, kennzahlen, objekt })[t](v);
}

// ---------- Finanz-Cockpit ----------
async function cockpit(v, zeitraum = 'monat', von = '', bis = '') {
  const r = await api(`/api/admin/finance?zeitraum=${zeitraum}&von=${von}&bis=${bis}`);
  if (!r.ok) { v.innerHTML = `<p class="form-note">${esc(r.data?.error)}</p>`; return; }
  const d = r.data;
  const tile = (l, x, s = '') => `<div class="pt-kpi"><small>${l}</small><strong>${x}</strong>${s ? `<span class="form-note">${s}</span>` : ''}</div>`;
  v.innerHTML = `<div class="pt-row" style="margin-bottom:12px"><div class="seg" role="tablist">${[['heute', 'Heute'], ['woche', 'Woche'], ['monat', 'Monat'], ['jahr', 'Jahr'], ['gesamt', 'Gesamt']].map(([k, l]) => `<button type="button" data-z="${k}" aria-selected="${k === zeitraum}">${l}</button>`).join('')}</div>
      <label class="form-note">von <input type="date" id="zv" value="${esc(von)}"></label><label class="form-note">bis <input type="date" id="zb" value="${esc(bis)}"></label><button class="btn btn-ghost" id="zf" type="button">Zeitraum</button></div>
    <h2>${esc(d.range.label)}</h2>
    <div class="pt-kpis">${tile('Umsatz netto', eur(d.revenue.net), `${d.revenue.count} Rechnungen${d.revenue.stornos ? `, ${d.revenue.stornos} Korrekturen` : ''}`)}${tile('Umsatzsteuer 19 %', eur(d.revenue.vat))}${tile('Umsatz brutto', eur(d.revenue.gross))}${tile('Offene Posten', String(d.openItems.length), eur(d.openItems.reduce((s, x) => s + Number(x.gross_cents), 0)))}</div>
    <div class="pt-kpis">${tile('MRR netto', eur(d.recurring.mrrNet), 'aus Stripe-Abos zum Listenpreis')}${tile('ARR netto', eur(d.recurring.arrNet))}${tile('Aktive Tarife', String(d.recurring.activeAccounts), `Basic ${d.recurring.byTier.BASIC} · Pro ${d.recurring.byTier.PRO} · Enterprise ${d.recurring.byTier.ENTERPRISE}${d.recurring.manualWithoutPrice ? ` · ${d.recurring.manualWithoutPrice} manuell` : ''}`)}${tile('Abgelaufen im Zeitraum', String(d.recurring.expiredInRange))}</div>
    <h2>Netto-Umsatz der letzten 12 Monate</h2>${monthsChart(d.months || [])}
    <h2>Weiterempfehlung über Kreditmappen</h2>
    <div class="pt-kpis">${tile('Kreditmappen von Unternehmen', String(d.viral.partnerDossiers))}${tile('Aufrufe der Prüfseite', String(d.viral.verifyViews))}${tile('Neue Unternehmenskonten', String(d.viral.newAccounts), `davon über Prüfseite: ${d.viral.viaVerify}`)}${tile('Endkunden-Anfragen', String(d.viral.leads))}</div>
    <h2>Offene Posten</h2>${d.openItems.length ? `<div class="ad-wrap"><table class="ad-table"><thead><tr><th>Ampel</th><th>Nummer</th><th>Kunde</th><th>Fällig</th><th>Brutto</th><th></th></tr></thead><tbody>
      ${d.openItems.map((x) => `<tr><td><span class="ad-amp ${x.ampel}"></span>${x.daysOverdue > 0 ? `${x.daysOverdue} Tage` : 'fristgerecht'}</td><td>${esc(x.invoice_number)}</td><td>${esc(x.buyer?.company)}</td><td>${dt(x.due_date)}</td><td>${eur(x.gross_cents)}</td><td class="ad-actions"><button data-paid="${x.id}" type="button">Als bezahlt markieren</button><button data-remind="${x.id}" type="button">Zahlungserinnerung senden</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="form-note">Keine offenen Posten.</p>'}
    <h2>Rechnungen im Zeitraum</h2>${invTable(d.invoices)}`;
  v.querySelectorAll('[data-z]').forEach((b) => b.onclick = () => cockpit(v, b.dataset.z));
  $('#zf').onclick = () => cockpit(v, 'frei', $('#zv').value, $('#zb').value);
  bindInv(v, () => cockpit(v, zeitraum, von, bis));
}

// Einfache Balken mit Wertbeschriftung; Monate ohne Umsatz bleiben sichtbar (0 €).
function monthsChart(months) {
  const max = Math.max(1, ...months.map((x) => x.net));
  const lab = (m) => new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' }).format(new Date(m + '-01T12:00:00Z'));
  return `<div class="ad-bars" role="list">${months.map((x) => `<div class="ad-bar" role="listitem" aria-label="${lab(x.m)}: ${eur(x.net, 0)}"><span class="ad-bar-v">${x.net ? eur(x.net, 0) : ''}</span><span class="ad-bar-f" style="height:${Math.max(x.net > 0 ? 3 : 0, Math.round((x.net / max) * 100))}%"></span><span class="ad-bar-l">${lab(x.m)}</span></div>`).join('')}</div>`;
}

const invTable = (rows) => rows.length ? `<div class="ad-wrap"><table class="ad-table"><thead><tr><th>Nummer</th><th>Art</th><th>Datum</th><th>Kunde</th><th>Netto</th><th>USt</th><th>Brutto</th><th>Status</th><th></th></tr></thead><tbody>
  ${rows.map((x) => `<tr><td>${esc(x.invoice_number)}</td><td>${{ invoice: 'Rechnung', storno: 'Storno', credit: 'Gutschrift' }[x.kind]}${x.source === 'stripe' ? ' · Stripe' : ''}</td><td>${dt(x.issue_date)}</td><td>${esc(x.buyer?.company)}</td><td>${eur(x.net_cents)}</td><td>${eur(x.vat_cents)}</td><td>${eur(x.gross_cents)}</td><td>${PAY[x.payment_status]}</td>
  <td class="ad-actions"><button data-pdf="${x.id}" type="button">PDF</button>${x.kind === 'invoice' && x.source === 'manual' && x.payment_status !== 'CANCELLED' ? `<button data-storno="${x.id}" type="button">Stornieren</button>` : ''}${['PENDING', 'OVERDUE'].includes(x.payment_status) ? `<button data-paid="${x.id}" type="button">Bezahlt</button><button data-remind="${x.id}" type="button">Erinnern</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="form-note">Keine Rechnungen.</p>';

function bindInv(v, reload) {
  v.querySelectorAll('[data-pdf]').forEach((b) => b.onclick = async () => {
    try { const res = await download('/api/admin/invoices?id=' + b.dataset.pdf, {}, 'Rechnung.pdf'); if (res.headers.get('x-integrity') === 'mismatch') msg('Achtung: Prüfsumme des PDFs weicht ab!', true); else msg('PDF geladen, Prüfsumme in Ordnung.'); } catch (e) { msg(e.message, true); }
  });
  v.querySelectorAll('[data-storno]').forEach((b) => b.onclick = async () => {
    if (!confirm('Stornorechnung ausstellen? Die ursprüngliche Rechnung bleibt unverändert im Archiv.')) return;
    const r = await api('/api/admin/invoices', { method: 'POST', body: JSON.stringify({ action: 'storno', invoiceId: b.dataset.storno }) });
    if (r.ok) { msg(`Storno ${r.data.invoice.invoice_number} ausgestellt.`); reload(); } else msg(r.data?.error || 'Fehler', true);
  });
  v.querySelectorAll('[data-remind]').forEach((b) => b.onclick = async () => {
    if (!confirm('Zahlungserinnerung mit Rechnung als PDF an das Unternehmen senden?')) return;
    b.disabled = true;
    const r = await api('/api/admin/invoices', { method: 'POST', body: JSON.stringify({ action: 'remind', invoiceId: b.dataset.remind }) });
    b.disabled = false;
    if (r.ok) msg(`Erinnerung versendet (${r.data.stufe}. Erinnerung).`); else msg(r.data?.error || 'Fehler', true);
  });
  v.querySelectorAll('[data-paid]').forEach((b) => b.onclick = async () => {
    const r = await api('/api/admin/invoices', { method: 'POST', body: JSON.stringify({ action: 'paid', invoiceId: b.dataset.paid }) });
    if (r.ok) { msg('Als bezahlt markiert.'); reload(); } else msg(r.data?.error || 'Fehler', true);
  });
}

// ---------- Sicherheit ----------
async function sicherheit(v) {
  const r = await api('/api/admin/check');
  const p = r.data?.panic || { active: false };
  v.innerHTML = `<section class="pt-card"><h2>Not-Aus</h2>
    ${p.active ? `<div class="pt-alert bad"><strong>Aktiv seit ${dtt(p.since)}</strong> (${esc(p.by || '')}${p.reason ? ': ' + esc(p.reason) : ''}). Alle Nutzer außer Administratoren sind abgemeldet; Partnerseiten, Widget und Anfragen sind abgeschaltet.</div><button class="btn btn-dark" id="pOff" type="button">Not-Aus beenden</button>`
      : `<p>Schaltet sofort alle angemeldeten Zugänge außer Administratoren ab (Anfragen an die Schnittstellen werden abgewiesen, Sitzungen wirken beendet) und stoppt Partnerseiten, Widget und Anfrage-Eingang. Für den Fall eines Sicherheitsvorfalls.</p><button class="btn btn-dark" id="pOn" type="button" style="background:#991B1B;border-color:#991B1B">Not-Aus auslösen</button>`}
    <p class="form-note">Die Anmelde-Tokens selbst laufen nach spätestens einer Stunde ab. Für einen vollständigen Schlüsseltausch zusätzlich in Supabase den JWT-Schlüssel rotieren.</p></section>
    <section class="pt-card"><h2>Zugangsschutz Admin</h2><ul class="plain-list">
      <li>Zweiter Faktor: ${r.data?.mfaRequired ? '<span class="st ok">Pflicht</span>' : '<span class="st bad">abgeschaltet (ADMIN_MFA=off)</span>'}</li>
      <li>IP-Freigabeliste: in Vercel als ADMIN_IP_ALLOWLIST (z. B. 203.0.113.7, 198.51.100.0/24). Ohne Eintrag ist jede IP zugelassen.</li>
      <li>Anmeldeversuche: Supabase begrenzt fehlgeschlagene Anmeldungen automatisch; zusätzlich sind alle Schnittstellen je Nutzer und IP gedrosselt.</li>
      <li>Alle Admin-Aktionen stehen im Reiter Protokoll.</li></ul></section>
    <section class="pt-card"><h2>Sicherheitsprotokoll</h2><p class="form-note">Gedrosselte Zugriffe (zu viele Anfragen je Nutzer oder IP) und abgewiesene Zugriffe auf den Admin-Bereich. Gespeichert werden nur Bereich und ein gekürzter Hash, keine IP-Adressen; Löschung nach 30 Tagen. Die Zählung erfolgt je Serverinstanz, Spitzen können sich verteilen.</p><div id="secLog"><p class="form-note">Wird geladen …</p></div><button class="btn btn-ghost" id="secRe" type="button">Aktualisieren</button></section>`;
  const KIND = { rate_limit: 'Gedrosselt', admin_denied: 'Admin verweigert', admin_ip_blocked: 'IP nicht freigegeben', admin_mfa_missing: 'Zweiter Faktor fehlt', panic: 'Not-Aus', honeypot: 'Bot (Honigtopf)', too_fast: 'Bot (zu schnell)', disposable_email: 'Wegwerf-Adresse', email_no_mx: 'Domain ohne Mailempfang', content_flagged: 'Spam-Verdacht' };
  const loadLog = async () => {
    const l = await api('/api/admin/support?log=1');
    if (!l.ok) { $('#secLog').innerHTML = `<p class="form-note">${esc(l.data?.error)}</p>`; return; }
    const top = Object.entries(l.data.counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    $('#secLog').innerHTML = `${top.length ? `<p><strong>Letzte 24 Stunden:</strong> ${top.map(([k, n]) => { const [kind, bucket] = k.split(':'); return `${esc(KIND[kind] || kind)} (${esc(bucket)}): ${n}`; }).join(' · ')}</p>` : '<p class="form-note">Keine Auffälligkeiten in den letzten 24 Stunden.</p>'}
      ${l.data.events.length ? `<div class="ad-wrap"><table class="ad-table"><thead><tr><th>Zeit</th><th>Ereignis</th><th>Bereich</th><th>Kennung</th></tr></thead><tbody>${l.data.events.slice(0, 60).map((e) => `<tr><td>${dtt(e.created_at)}</td><td>${esc(KIND[e.kind] || e.kind)}</td><td>${esc(e.bucket || '')}</td><td><code>${esc(e.subject || '')}</code></td></tr>`).join('')}</tbody></table></div>` : ''}`;
  };
  loadLog();
  $('#secRe').onclick = loadLog;
  const go = async (on) => {
    const reason = on ? prompt('Grund (für das Protokoll):', 'Sicherheitsvorfall') : '';
    if (on && reason === null) return;
    if (!confirm(on ? 'Not-Aus jetzt auslösen?' : 'Not-Aus beenden?')) return;
    const x = await api('/api/admin/support', { method: 'POST', body: JSON.stringify({ panic: on, reason }) });
    if (x.ok) { msg(on ? 'Not-Aus aktiv (wirkt binnen 15 Sekunden überall).' : 'Not-Aus beendet.'); sicherheit(v); } else msg(x.data?.error || 'Fehler', true);
  };
  if ($('#pOn')) $('#pOn').onclick = () => go(true);
  if ($('#pOff')) $('#pOff').onclick = () => go(false);
}

// ---------- Partner ----------
async function partner(v) {
  const r = await api('/api/admin/b2b');
  if (!r.ok) { v.innerHTML = `<p class="form-note">${esc(r.data?.error)}</p>`; return; }
  const list = r.data.accounts;
  const pend = list.filter((a) => a.verification_status === 'eingereicht').length;
  v.innerHTML = `${pend ? `<p class="auth-message" style="margin-bottom:10px"><strong>${pend} Unternehmen</strong> ${pend === 1 ? 'wartet' : 'warten'} auf Prüfung und Freischaltung. Filter „Zur Prüfung eingereicht“ wählen und „Prüfen“ öffnen.</p>` : ''}<div class="pt-row" style="margin-bottom:10px"><input id="pq" aria-label="Unternehmen suchen" placeholder="Suchen (Firma, Ort, Kundennummer)" style="flex:1;min-width:220px;border:1px solid #CBD5E1;border-radius:6px;padding:8px 10px"><select id="ps" aria-label="Status filtern" style="border:1px solid #CBD5E1;border-radius:6px;padding:8px"><option value="">Alle</option><option value="active">Aktiv</option><option value="locked">Gesperrt</option><option value="unverified">Ungeprüft</option><option value="pruefen">Zur Prüfung eingereicht</option></select><button class="btn btn-ghost" id="pCsv" type="button">CSV</button></div>
    ${list.length ? `<div class="ad-wrap"><table class="ad-table"><thead><tr><th>Unternehmen</th><th>Art</th><th>Register / Steuer</th><th>Tarif</th><th>Status</th><th>Anfragen</th><th>Aktionen</th></tr></thead><tbody>
    ${list.map((a) => `<tr data-row="${a.id}" data-s="${a.status}${a.verified_at ? '' : ' unverified'}${a.verification_status === 'eingereicht' ? ' pruefen' : ''}" data-q="${esc((a.company_name + ' ' + a.city + ' ' + a.customer_number + ' ' + a.email).toLowerCase())}">
      <td><strong>${esc(a.company_name)}</strong> ${esc(a.legal_form)}<br><small>${esc(a.customer_number)} · ${esc(a.postal_code)} ${esc(a.city)} · ${esc(a.email)}</small></td>
      <td>${esc(a.institution_type)}</td><td><small>${esc(a.register_number || '–')}<br>${esc(a.tax_id || '–')}</small></td>
      <td>${a.tier ? TIER[a.tier] : '–'}${a.plan_source === 'manual' ? ' (manuell)' : ''}${a.plan_until ? `<br><small>bis ${dt(a.plan_until)}</small>` : ''}${a.dossier_bonus ? `<br><small>+${a.dossier_bonus} Mappen</small>` : ''}</td>
      <td>${a.status === 'locked' ? `<span class="st bad">gesperrt</span><br><small>${esc(a.lock_reason)}</small>` : '<span class="st ok">aktiv</span>'}<br>${a.verified_at ? '<small>geprüft</small>' : a.verification_status === 'eingereicht' ? '<small class="st warn">zur Prüfung eingereicht</small>' : a.verification_status === 'abgelehnt' ? '<small class="st bad">abgelehnt – wartet auf Unterlagen</small>' : '<small class="st warn">noch keine Unterlagen</small>'}${a.has_whitelabel ? '<br><small>Whitelabel frei</small>' : ''}${a.allow_invoice_payment ? '<br><small>Kauf auf Rechnung</small>' : ''}</td>
      <td>${a.leads}</td>
      <td class="ad-actions">
        ${a.verified_at ? `<button data-a="verify" data-on="false" data-id="${a.id}" type="button">Freischaltung zurücknehmen</button>` : `<button data-a="details" data-id="${a.id}" type="button"${a.verification_status === 'eingereicht' ? ' class="ad-primary"' : ''}>Prüfen</button>`}
        ${a.status === 'locked' ? `<button data-a="unlock" data-id="${a.id}" type="button">Entsperren</button>` : `<button data-a="lock" data-id="${a.id}" type="button">Sperren</button>`}
        <button data-a="plan" data-id="${a.id}" type="button">Tarif setzen</button>
        <button data-a="whitelabel" data-on="${!a.has_whitelabel}" data-id="${a.id}" type="button">${a.has_whitelabel ? 'Whitelabel entziehen' : 'Whitelabel freischalten'}</button>
        <button data-a="invoicePayment" data-on="${!a.allow_invoice_payment}" data-id="${a.id}" type="button">${a.allow_invoice_payment ? 'Rechnungskauf aus' : 'Rechnungskauf an'}</button>
        <button data-a="credits" data-id="${a.id}" type="button">Kontingent +</button>
        <button data-a="invoice" data-id="${a.id}" data-name="${esc(a.company_name)}" type="button">Rechnung</button>
        <button data-a="details" data-id="${a.id}" type="button">Details</button>
      </td></tr>`).join('')}</tbody></table></div>` : '<p class="form-note">Noch keine Unternehmenskonten.</p>'}
    <div id="invForm"></div>`;
  const filter = () => {
    const q = $('#pq').value.toLowerCase(), s = $('#ps').value;
    v.querySelectorAll('[data-row]').forEach((tr) => { tr.hidden = (q && !tr.dataset.q.includes(q)) || (s && !tr.dataset.s.split(' ').includes(s)); });
  };
  $('#pq').oninput = filter; $('#ps').onchange = filter;
  $('#pCsv').onclick = () => {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`;
    const head = ['Kundennummer', 'Firma', 'Rechtsform', 'Art', 'Registernummer', 'Steuernummer', 'Ansprechpartner', 'E-Mail', 'PLZ', 'Ort', 'Tarif', 'Quelle', 'Status', 'Geprüft', 'Anfragen', 'Angelegt'];
    const rows = list.map((a) => [a.customer_number, a.company_name, a.legal_form, a.institution_type, a.register_number, a.tax_id, a.advisor_name, a.email, a.postal_code, a.city, a.tier || '', a.plan_source || '', a.status, a.verified_at ? 'ja' : 'nein', a.leads, a.created_at.slice(0, 10)]);
    const blob = new Blob(['\uFEFF' + [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = 'ImmoAdv_Unternehmen.csv'; document.body.append(el); el.click(); el.remove();
  };
  v.querySelectorAll('[data-a]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.id, a = b.dataset.a;
    let body = { action: a, id };
    if (a === 'invoice') return invoiceForm(id, b.dataset.name);
    if (a === 'details') return details(id);
    if (a === 'verify' || a === 'whitelabel') body.on = b.dataset.on === 'true';
    if (a === 'lock') { const reason = prompt('Grund der Sperre (wird dem Unternehmen angezeigt):'); if (!reason) return; body.reason = reason; }
    if (a === 'unlock' && !confirm('Konto entsperren?')) return;
    if (a === 'invoicePayment') {
      body.on = b.dataset.on === 'true';
      if (body.on) { const lim = prompt('Kreditlimit in Euro (leer = ohne Limit):', ''); const days = prompt('Zahlungsziel in Tagen:', '14'); if (days === null) return; body.limitCents = lim ? Math.round(Number(lim.replace(',', '.')) * 100) : null; body.termsDays = Number(days) || 14; }
    }
    if (a === 'credits') { const n = prompt('Zusätzliche Kreditmappen pro Monat (negativ zum Abziehen):', '10'); if (!n) return; body.add = Math.trunc(Number(n)); }
    if (a === 'plan') {
      const t = prompt('Tarif: BASIC, PRO, ENTERPRISE oder leer zum Entfernen', 'PRO'); if (t === null) return;
      const until = t ? prompt('Gültig bis (JJJJ-MM-TT, leer = unbefristet):', '') : '';
      body.tier = t ? t.trim().toUpperCase() : null; body.until = until || null;
    }
    const r = await api('/api/admin/b2b', { method: 'POST', body: JSON.stringify(body) });
    if (r.ok) { msg('Gespeichert.'); partner(v); } else msg(r.data?.error || 'Fehler', true);
  });
}

// Nur lesende Detailansicht eines Unternehmens (kein Einloggen als Partner).
async function details(id) {
  const box = $('#invForm');
  box.innerHTML = '<p class="form-note">Wird geladen …</p>';
  const r = await api('/api/admin/b2b?id=' + id);
  if (!r.ok) { box.innerHTML = `<p class="form-note">${esc(r.data?.error)}</p>`; return; }
  const { account: a, members, leads, invoices, verificationDocs: vd = [] } = r.data;
  const rows = [['Kundennummer', a.customer_number], ['Unternehmen', `${a.company_name} (${a.legal_form})`], ['Art', a.institution_type], ['Registernummer', a.register_number || '–'], ['Steuer-/USt-IdNr.', a.tax_id || '–'],
    ['Ansprechpartner', a.advisor_name], ['E-Mail', a.email], ['Telefon', a.phone || '–'], ['Anschrift', `${a.street || ''}, ${a.postal_code} ${a.city}`], ['Partnerseite', a.slug ? `/p/${a.slug}` : '–'],
    ['Tarif', `${a.tier ? TIER[a.tier] : '–'}${a.plan_source ? ` (${a.plan_source === 'manual' ? 'manuell' : 'Stripe'})` : ''}`], ['Kreditmappen diesen Monat', String(a.dossiersThisMonth)],
    ['§ 14 BGB bestätigt', dtt(a.unternehmer_confirmed_at)], ['AVV', `${a.avv_version || '–'} am ${dtt(a.avv_accepted_at)}`], ['Herkunft', a.referral || '–'], ['Erlaubte Domains', (a.allowed_domains || []).join(', ') || 'alle'], ['Angelegt', dtt(a.created_at)]];
  box.innerHTML = `<section class="pt-card" style="margin-top:16px"><h2>${esc(a.company_name)}</h2>
    <dl class="pt-dl">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <h3>Verifizierung</h3>
    <p>Status: <strong>${{ offen: 'noch keine Unterlagen eingereicht', eingereicht: 'zur Prüfung eingereicht', geprueft: 'geprüft und freigeschaltet', abgelehnt: 'abgelehnt' }[a.verification_status] || (a.verified_at ? 'geprüft' : 'offen')}</strong>${a.verification_submitted_at ? ` · eingereicht ${dtt(a.verification_submitted_at)}` : ''}${a.verification_note ? `<br><small>Begründung: ${esc(a.verification_note)}</small>` : ''}</p>
    ${vd.length ? `<ul class="plain-list">${vd.map((d) => `<li>${d.url ? `<a class="ck-link" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc({ gewerbe: 'Gewerbeanmeldung', handelsregister: 'Handelsregisterauszug', erlaubnis: 'Erlaubnis § 34c/§ 34i', sonstiges: 'Sonstiger Nachweis' }[d.kind] || d.kind)}: ${esc(d.file_name)}</a>` : esc(d.file_name)} <small>(${Math.max(1, Math.round(d.byte_size / 1024))} KB · ${dtt(d.created_at)} · SHA ${esc(d.sha256.slice(0, 10))}…)</small></li>`).join('')}</ul><p class="form-note">Links sind 5 Minuten gültig (Abruf wird protokolliert). Prüfen: Firmenname, Anschrift und Register-/Steuernummer stimmen mit den Angaben überein; bei Maklern/Vermittlern ggf. Erlaubnis.</p>` : '<p class="form-note">Noch keine Nachweise hochgeladen.</p>'}
    ${a.verified_at ? '' : `<p><button class="btn btn-dark" id="vApprove" type="button"${vd.length ? '' : ' disabled'}>Freischalten</button> <button class="btn btn-outline" id="vReject" type="button">Ablehnen mit Begründung</button></p>`}
    <h3>Team</h3><p>${members.map((m) => `${esc(m.email)} (${m.role === 'owner' ? 'Inhaber' : 'Berater'})`).join(' · ') || '–'}</p>
    <h3>Anfragen (nur Anzahl und Status, Inhalte gehören dem Unternehmen)</h3><p>${leads.length} insgesamt · ${['neu', 'in_bearbeitung', 'abgeschlossen', 'abgelehnt'].map((s) => `${s.replace('_', ' ')}: ${leads.filter((l) => l.status === s).length}`).join(' · ')}</p>
    <h3>Rechnungen</h3>${invoices.length ? `<table class="ad-table"><tbody>${invoices.map((i) => `<tr><td>${esc(i.invoice_number)}</td><td>${dt(i.issue_date)}</td><td>${eur(i.gross_cents)}</td><td>${PAY[i.payment_status]}</td></tr>`).join('')}</tbody></table>` : '<p class="form-note">Keine.</p>'}
    <h3>Support-Ansicht</h3><p class="form-note">${a.support_access_until && new Date(a.support_access_until) > new Date() ? `Vom Unternehmen freigegeben bis ${dtt(a.support_access_until)}.` : 'Nicht freigegeben. Das Unternehmen kann den lesenden Support-Zugriff im Portal unter Profil erteilen.'}</p>
    ${a.support_access_until && new Date(a.support_access_until) > new Date() ? '<button class="btn btn-ghost" id="supView" type="button">Portal lesend ansehen (wird protokolliert)</button><div id="supOut"></div>' : ''}
    <button class="text-btn" id="detClose" type="button">Schließen</button></section>`;
  if ($('#supView')) $('#supView').onclick = async () => {
    const s = await api('/api/admin/support?id=' + id);
    if (!s.ok) { $('#supOut').innerHTML = `<p class="form-note">${esc(s.data?.error)}</p>`; return; }
    const d = s.data;
    $('#supOut').innerHTML = `<p class="form-note">Tarif ${d.account.tier ? TIER[d.account.tier] : '–'} · Widget ${d.account.widgetActive ? 'aktiv' : 'aus'} · Domains: ${esc((d.account.allowedDomains || []).join(', ') || 'alle')}</p>
      <div class="ad-wrap"><table class="ad-table"><thead><tr><th>Eingang</th><th>Quelle</th><th>Status</th><th>Kontakt</th><th>Objekt</th></tr></thead><tbody>${d.leads.map((l) => `<tr><td>${dtt(l.created_at)}</td><td>${esc(l.source)}</td><td>${esc(l.status)}</td><td>${esc(l.client_name)}<br><small>${esc(l.client_email)}</small></td><td>${esc(l.property_data?.address || l.property_data?.ref || '–')}</td></tr>`).join('') || '<tr><td colspan="5">Keine Anfragen.</td></tr>'}</tbody></table></div>`;
  };
  if ($('#vApprove')) $('#vApprove').onclick = async () => {
    if (!confirm(`${a.company_name} freischalten? Das Unternehmen erhält eine E-Mail.`)) return;
    const x = await api('/api/admin/b2b', { method: 'POST', body: JSON.stringify({ action: 'approve', id }) });
    if (x.ok) { await partner($('#adView')); msg('Freigeschaltet.'); details(id); } else msg(x.data?.error || 'Fehler', true);
  };
  if ($('#vReject')) $('#vReject').onclick = async () => {
    const reason = prompt('Begründung (wird dem Unternehmen per E-Mail mitgeteilt), z. B. „Gewerbeanmeldung unleserlich“:');
    if (!reason || reason.trim().length < 5) return;
    const x = await api('/api/admin/b2b', { method: 'POST', body: JSON.stringify({ action: 'reject', id, reason: reason.trim() }) });
    if (x.ok) { await partner($('#adView')); msg('Abgelehnt, Unternehmen informiert.'); details(id); } else msg(x.data?.error || 'Fehler', true);
  };
  $('#detClose').onclick = () => { box.innerHTML = ''; };
  box.scrollIntoView({ behavior: 'smooth' });
}

function invoiceForm(accountId, name) {
  const box = $('#invForm');
  const row = () => '<div class="row"><input placeholder="Leistung" class="d"><input placeholder="Menge" class="q" value="1" inputmode="decimal"><input placeholder="Einzelpreis netto €" class="p" inputmode="decimal"><button type="button" class="text-btn del x">×</button></div>';
  box.innerHTML = `<section class="pt-card" style="margin-top:16px"><h2>Rechnung an ${esc(name)}</h2>
    <div class="ad-items" id="items">${row()}</div><button class="text-btn" id="addRow" type="button">+ Position</button>
    <div class="pt-row ad-form" style="margin-top:10px"><label class="form-note">Zahlungsart <select id="pm"><option value="INVOICE_BANK_TRANSFER">Überweisung (mit GiroCode)</option><option value="SEPA_B2B">SEPA-Firmenlastschrift</option><option value="STRIPE_CARD">Karte (bereits bezahlt)</option></select></label>
    <label class="form-note">Leistungszeitraum <input id="sp" placeholder="z. B. 01.10.2026–31.10.2026"></label><label class="form-note"><input type="checkbox" id="paid"> bereits bezahlt</label></div>
    <p id="sum" class="form-note"></p><button class="btn btn-dark" id="issue" type="button">Rechnung ausstellen (unveränderbar)</button></section>`;
  const items = () => [...box.querySelectorAll('.row')].map((r) => ({ description: r.querySelector('.d').value.trim(), quantity: Number(r.querySelector('.q').value.replace(',', '.')), unitNetCents: Math.round(Number(r.querySelector('.p').value.replace(/\./g, '').replace(',', '.')) * 100) })).filter((i) => i.description && i.quantity > 0 && i.unitNetCents >= 0);
  const sum = () => { const n = items().reduce((s, i) => s + Math.round(i.quantity * i.unitNetCents), 0); const vat = Math.round(n * 0.19); $('#sum').textContent = `Netto ${eur(n)} · USt 19 % ${eur(vat)} · Brutto ${eur(n + vat)}`; };
  box.oninput = sum;
  box.onclick = (e) => { if (e.target.classList.contains('x') && box.querySelectorAll('.row').length > 1) { e.target.parentElement.remove(); sum(); } };
  $('#addRow').onclick = () => { $('#items').insertAdjacentHTML('beforeend', row()); };
  $('#issue').onclick = async () => {
    const it = items();
    if (!it.length) return msg('Bitte mindestens eine Position mit Preis angeben.', true);
    if (!confirm('Rechnung jetzt ausstellen? Sie erhält die nächste fortlaufende Nummer und kann danach nur storniert werden.')) return;
    const r = await api('/api/admin/invoices', { method: 'POST', body: JSON.stringify({ action: 'create', accountId, items: it, paymentMethod: $('#pm').value, servicePeriod: $('#sp').value || undefined, paid: $('#paid').checked }) });
    if (!r.ok) return msg(r.data?.error || 'Fehler', true);
    msg(`Rechnung ${r.data.invoice.invoice_number} ausgestellt und archiviert.${r.data.mailed ? ' PDF per E-Mail an das Unternehmen gesendet.' : ' (Kein E-Mail-Versand eingerichtet: PDF bitte selbst senden; im Portal ist sie abrufbar.)'}`);
    box.innerHTML = '';
  };
  box.scrollIntoView({ behavior: 'smooth' });
}

// ---------- Rechnungsarchiv ----------
async function rechnungen(v, q = '') {
  const r = await api('/api/admin/invoices' + (q ? '?q=' + encodeURIComponent(q) : ''));
  if (!r.ok) { v.innerHTML = `<p class="form-note">${esc(r.data?.error)}</p>`; return; }
  v.innerHTML = `<p class="form-note">GoBD-Archiv: Rechnungen sind in der Datenbank gegen Ändern und Löschen gesperrt; jede PDF-Datei wird beim Abruf gegen ihre SHA-256-Prüfsumme geprüft. Korrekturen nur per Storno.${r.data.bankConfigured ? '' : ' <strong>Bankverbindung fehlt:</strong> INVOICE_IBAN, INVOICE_BIC, INVOICE_BANK_NAME in Vercel setzen, sonst sind Überweisungsrechnungen gesperrt.'}</p>
    <div class="pt-row" style="margin-bottom:10px"><input id="iq" aria-label="Rechnungsnummer suchen" value="${esc(q)}" placeholder="Rechnungsnummer" style="border:1px solid #CBD5E1;border-radius:6px;padding:8px 10px"><button class="btn btn-ghost" id="is" type="button">Suchen</button></div>${invTable(r.data.invoices)}
    <p class="form-note">Neue Rechnung: unter „Partner“ beim Unternehmen auf „Rechnung“ klicken.</p>`;
  $('#is').onclick = () => rechnungen(v, $('#iq').value.trim());
  bindInv(v, () => rechnungen(v, q));
}

// ---------- Steuer-Export ----------
function steuer(v) {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const m = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  v.innerHTML = `<section class="pt-card"><h2>Monatsarchiv für die Steuerkanzlei</h2>
    <p>ZIP mit allen Rechnungen (Ordner <code>Rechnungen</code>), Stornos und Gutschriften (<code>Korrekturen</code>), <code>DATEV_Buchungsstapel.csv</code> und <code>Monatsjournal_Umsatzsteuer.csv</code> (Kennzahl 81).</p>
    <div class="pt-row ad-form"><label class="form-note">Monat <input type="month" id="mon" value="${m}"></label><label class="form-note">Kontenrahmen <select id="skr"><option value="SKR03">SKR03 (1400 / 8400)</option><option value="SKR04">SKR04 (1200 / 4400)</option></select></label><button class="btn btn-dark" id="zip" type="button">ZIP herunterladen</button></div>
    <p class="form-note" id="taxAuto">Automatischer Versand wird geprüft …</p>
    <p class="form-note">Bitte die Übernahme in die Umsatzsteuer-Voranmeldung von der Kanzlei prüfen lassen.</p></section>`;
  api('/api/admin/datev?info=1').then((r) => {
    const i = r.data || {};
    $('#taxAuto').innerHTML = i.advisorEmail && i.mail && i.cron
      ? `<strong>Automatischer Versand aktiv:</strong> am ${i.workday}. Werktag jedes Monats geht das Archiv des Vormonats (${esc(i.skr)}) an ${esc(i.advisorEmail)}. Versand und Fehler stehen im Protokoll.`
      : `<strong>Automatischer Versand aus.</strong> Dafür in Vercel setzen: ${[!i.advisorEmail && 'TAX_ADVISOR_EMAIL (Adresse der Kanzlei)', !i.mail && 'RESEND_API_KEY und NOTIFY_FROM_EMAIL', !i.cron && 'CRON_SECRET'].filter(Boolean).join(', ')}. Optional: TAX_DISPATCH_WORKDAY (Standard 3), TAX_SKR (SKR03/SKR04).`;
  });
  $('#zip').onclick = async (e) => {
    e.target.disabled = true;
    const r = await api(`/api/admin/datev?monat=${$('#mon').value}&skr=${$('#skr').value}`); if (r.ok) { location.href = r.data.url; msg(`Export mit ${r.data.count} Belegen erstellt.${r.data.problems.length ? ' Hinweise: ' + r.data.problems.join(' · ') : ''}`, r.data.problems.length > 0); } else msg(r.data?.error || 'Fehler', true);
    e.target.disabled = false;
  };
}

// ---------- Anfragen & Codes ----------
async function anfragen(v) {
  const r = await api('/api/admin/misc');
  if (!r.ok) { v.innerHTML = `<p class="form-note">${esc(r.data?.error)}</p>`; return; }
  const { contacts, codes } = r.data;
  v.innerHTML = `<section class="pt-card"><h2>B2B-Anfragen (Demo, Enterprise, Kooperation)</h2>${contacts.length ? `<div class="ad-wrap"><table class="ad-table"><thead><tr><th>Eingang</th><th>Anliegen</th><th>Kontakt</th><th>Nachricht</th><th></th></tr></thead><tbody>
    ${contacts.map((c) => `<tr><td>${dtt(c.created_at)}</td><td>${esc(c.kind)}</td><td><strong>${esc(c.company)}</strong><br>${esc(c.name)}<br><a href="mailto:${esc(c.email)}">${esc(c.email)}</a> ${esc(c.phone || '')}</td><td>${esc(c.message || '')}</td><td>${c.status === 'offen' ? `<button class="text-btn" data-done="${c.id}" type="button">Erledigt</button>` : 'erledigt'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="form-note">Keine Anfragen.</p>'}</section>
    <section class="pt-card"><h2>Partnercodes</h2><p class="form-note">Kampagnen-Codes für die Registrierung von Unternehmen. Der Code wird am Konto gespeichert; Rabatte vergibt Stripe über Aktionscodes im Bezahlvorgang.</p>
    <div class="pt-row ad-form"><input id="cc" aria-label="Code" placeholder="CODE-2026" style="text-transform:uppercase"><input id="cd" aria-label="Beschreibung" placeholder="Beschreibung"><input id="cm" aria-label="Maximale Einlösungen" placeholder="max. Einlösungen" inputmode="numeric" style="width:150px"><button class="btn btn-dark" id="cAdd" type="button">Anlegen</button></div>
    ${codes.length ? `<table class="ad-table" style="margin-top:10px"><thead><tr><th>Code</th><th>Beschreibung</th><th>Eingelöst</th><th>Quote</th><th></th></tr></thead><tbody>${codes.map((c) => `<tr><td>${esc(c.code)}</td><td>${esc(c.description || '')}</td><td>${c.redeemed}${c.max_redemptions ? ' / ' + c.max_redemptions : ''}</td><td>${c.max_redemptions ? Math.round((c.redeemed / c.max_redemptions) * 100) + ' %' : '–'}</td><td><button class="text-btn" data-code="${esc(c.code)}" data-on="${!c.active}" type="button">${c.active ? 'Deaktivieren' : 'Aktivieren'}</button></td></tr>`).join('')}</tbody></table>` : ''}</section>`;
  v.querySelectorAll('[data-done]').forEach((b) => b.onclick = async () => { await api('/api/admin/misc', { method: 'POST', body: JSON.stringify({ action: 'contactDone', id: b.dataset.done }) }); anfragen(v); });
  v.querySelectorAll('[data-code]').forEach((b) => b.onclick = async () => { await api('/api/admin/misc', { method: 'POST', body: JSON.stringify({ action: 'codeActive', code: b.dataset.code, on: b.dataset.on === 'true' }) }); anfragen(v); });
  $('#cAdd').onclick = async () => {
    const r2 = await api('/api/admin/misc', { method: 'POST', body: JSON.stringify({ action: 'codeCreate', code: $('#cc').value, description: $('#cd').value, maxRedemptions: $('#cm').value ? Number($('#cm').value) : null }) });
    if (r2.ok) anfragen(v); else msg(r2.data?.error || 'Fehler', true);
  };
}

async function protokoll(v) {
  const r = await api('/api/admin/misc');
  if (!r.ok) { v.innerHTML = `<p class="form-note">${esc(r.data?.error)}</p>`; return; }
  v.innerHTML = r.data.audit.length ? `<div class="ad-wrap"><table class="ad-table"><thead><tr><th>Zeit</th><th>Wer</th><th>Aktion</th><th>Ziel</th><th>Details</th></tr></thead><tbody>${r.data.audit.map((a) => `<tr><td>${dtt(a.created_at)}</td><td>${esc(a.actor_email)}</td><td>${esc(a.action)}</td><td><small>${esc(a.target || '')}</small></td><td><small>${esc(JSON.stringify(a.meta))}</small></td></tr>`).join('')}</tbody></table></div>` : '<p class="form-note">Noch keine Einträge.</p>';
}

async function kennzahlen(v) {
  const r = await api('/api/admin/stats');
  if (!r.ok) { v.innerHTML = `<p class="form-note">${esc(r.data?.error)}</p>`; return; }
  const j = r.data;
  const n = (x) => (x == null ? '–' : x.toLocaleString('de-DE'));
  const tile = (l, x) => `<div class="an-chip"><small>${l}</small><strong>${x}</strong></div>`;
  const on = (b) => (b ? '<span class="st ok">aktiv</span>' : '<span class="st bad">fehlt</span>');
  v.innerHTML = `<div class="an-chips">${tile('Konten', n(j.users))}${tile('Neu (7 Tage)', n(j.users7))}${tile('Objekte', n(j.objects))}${tile('Dokumente', n(j.docs))}${tile('Freigaben aktiv', `${n(j.sharesActive)} / ${n(j.shares)}`)}${tile('Kreditmappen', n(j.versions))}${tile('Erinnerungen an', n(j.reminders))}${tile('Offene Unterlagen-Anforderungen', n(j.requestsOpen))}${tile('Unternehmenskonten', `${n(j.b2bActive)} aktiv / ${n(j.b2b)}`)}${tile('Endkunden-Anfragen', n(j.leads))}${tile('Offene B2B-Anfragen', n(j.contactsOpen))}</div>
    <p class="form-note">Einstellungen: Bezahlung ${on(j.config.billing)} · E-Mail-Versand ${on(j.config.mail)} · Täglicher Lauf ${on(j.config.cron)} · Aktive Co-Branding-Partner (alt): ${n(j.partners)}</p>`;
}

function objekt(v) { v.innerHTML = ''; mountObjekt(v, { pdf: true }); }

(async () => {
  if (!(await gate())) return;
  frame();
  show();
  window.addEventListener('hashchange', show);
})();
