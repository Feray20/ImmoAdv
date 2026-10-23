// Web-Admin → Creator Operations: Bewerbungen prüfen, Creator 360, Zahlungsdaten (maskiert / geschützt anzeigen), Rollen.
// Rechte prüft ausschließlich der Server (Rolle im Creator-Bereich). Die Oberfläche blendet nur aus, was die Rolle nicht darf.
import { api, dt, dtt, esc } from './sess.mjs';

const ST = {
  DRAFT: ['', 'Entwurf'], SUBMITTED: ['warn', 'Eingereicht'], UNDER_REVIEW: ['warn', 'In Prüfung'], INFO_REQUESTED: ['warn', 'Rückfrage offen'],
  ACTIVE: ['ok', 'Aktiv'], REJECTED: ['bad', 'Abgelehnt'], SUSPENDED: ['bad', 'Pausiert'],
};
const PAY = { PROVIDED: ['ok', 'Hinterlegt'], VERIFIED: ['ok', 'Geprüft'], VERIFICATION_REQUIRED: ['warn', 'Prüfung nötig'], MISSING: ['bad', 'Fehlt'] };
const ACT = {
  START_REVIEW: ['Prüfung starten', 'btn-outline'], APPROVE: ['Freigeben', 'btn-dark'], REQUEST_INFO: ['Information anfordern', 'btn-outline'],
  REJECT: ['Ablehnen', 'btn-outline'], SUSPEND: ['Pausieren', 'btn-outline'], REACTIVATE: ['Reaktivieren', 'btn-dark'],
};
const EV = {
  CREATOR_CREATED: 'Bewerbung begonnen', APPLICATION_SUBMITTED: 'Bewerbung eingereicht', REVIEW_STARTED: 'Prüfung gestartet', CREATOR_APPROVED: 'Freigegeben',
  CREATOR_INFO_REQUESTED: 'Information angefordert', CREATOR_REJECTED: 'Abgelehnt', CREATOR_SUSPENDED: 'Pausiert', CREATOR_REACTIVATED: 'Reaktiviert',
  AGREEMENT_ACCEPTED: 'Vereinbarung bestätigt', BANK_DATA_ADDED: 'Zahlungsdaten hinterlegt', BANK_DATA_CHANGED: 'Zahlungsdaten geändert',
  BANK_DETAILS_VIEWED: 'Zahlungsdaten angezeigt', BANK_DATA_VERIFIED: 'Zahlungsdaten geprüft', ACCESS_DENIED: 'Zugriff verweigert', ADMIN_ROLE_CHANGED: 'Rolle geändert',
};
const CAT = { immobilien: 'Immobilien', finanzen: 'Finanzen', business: 'Business', entrepreneurship: 'Entrepreneurship', lifestyle: 'Lifestyle', technology: 'Technology', education: 'Education', other: 'Sonstiges' };
const PL = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', x: 'X', linkedin: 'LinkedIn', other: 'Andere' };
const VAT = { small_business: 'Kleinunternehmer (§ 19 UStG)', vat_registered: 'Umsatzsteuerpflichtig', not_applicable: 'Nicht anwendbar / Ausland' };
const chip = (map, k) => `<span class="st ${map[k]?.[0] || ''}" style="margin:0">${esc(map[k]?.[1] || k)}</span>`;
const dl = (rows) => `<dl class="pt-dl">${rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
const safeUrl = (u) => (/^https:\/\//i.test(u || '') ? esc(u) : '#');
let filter = 'REVIEW';

export async function creatorOps(v) {
  const id = (location.hash.match(/^#creator-([0-9a-f-]{36})$/) || [])[1];
  if (id) return detail(v, id);
  if (location.hash === '#creator-rollen') return roles(v);
  return list(v);
}

async function list(v, q = '') {
  const r = await api(`/api/admin/creators?status=${filter === 'ALL' ? '' : filter}&q=${encodeURIComponent(q)}`);
  if (!r.ok) { v.innerHTML = `<div class="ad-state err" role="alert"><strong>Creator konnten nicht geladen werden.</strong><span>${esc(r.data?.error || '')}</span></div>`; return; }
  const d = r.data, c = d.counts;
  const kpi = (k, label, n, sub) => `<button type="button" data-f="${k}"><div class="pt-kpi" aria-pressed="${filter === k}"><small>${label}</small><strong>${n}</strong><small>${sub}</small></div></button>`;
  v.innerHTML = `<section class="pt-card"><div class="ad-h-row"><h2>Creator Operations</h2><span class="form-note" style="margin:0">Ihre Rolle: <strong>${esc(d.me.role_label)}</strong>${d.me.permissions.includes('roles.manage') ? ' · <a href="#creator-rollen" class="ck-link">Rollen verwalten</a>' : ''}</span></div>
      <p class="form-note">Wer braucht Aufmerksamkeit? ${d.attention ? `<strong>${d.attention}</strong> offene Vorgänge` : 'Keine offenen Vorgänge.'}</p></section>
    <div class="co-kpis">
      ${kpi('REVIEW', 'Neue Bewerbungen', c.SUBMITTED + c.UNDER_REVIEW, `${c.UNDER_REVIEW} in Prüfung`)}
      ${kpi('INFO_REQUESTED', 'Rückfrage offen', c.INFO_REQUESTED, 'wartet auf Creator')}
      ${kpi('ACTIVE', 'Aktive Creator', c.ACTIVE, `${c.SUSPENDED} pausiert`)}
      ${kpi('ALL', 'Alle', Object.values(c).reduce((a, b) => a + b, 0), d.bank_review != null ? `${d.bank_review} Zahlungsdaten prüfen` : `${c.DRAFT} Entwürfe`)}
    </div>
    <form class="ad-search" id="coQ"><input type="search" name="q" placeholder="Nach Creator-Name suchen …" value="${esc(q)}" aria-label="Creator suchen" autocomplete="off"><button class="btn btn-dark" type="submit">Suchen</button></form>
    <div class="co-list">${d.creators.length ? d.creators.map((x) => `<button type="button" class="co-row" data-id="${esc(x.id)}">
        <span><strong>${esc(x.display_name || 'Ohne Namen')}</strong><small>${esc(x.name || '')}${x.name && x.country ? ' · ' : ''}${esc(x.country || '')}</small></span>
        <span class="co-hide-m"><small>${esc(x.platforms.map((p) => PL[p] || p).join(', ') || '–')}</small><br><small>${esc((x.categories || []).map((k) => CAT[k] || k).join(', '))}</small></span>
        <span class="co-hide-m">${x.payout ? `${chip(PAY, x.payout.status)} ${x.payout.iban_masked ? `<small class="cr-mask">${esc(x.payout.iban_masked)}</small>` : ''}` : ''}<br><small>${x.submitted_at ? `eingereicht ${dt(x.submitted_at)}` : `geändert ${dt(x.updated_at)}`}</small></span>
        <span>${chip(ST, x.status)}</span></button>`).join('') : '<div class="ad-state"><strong>Keine Creator in dieser Ansicht.</strong><span>Neue Bewerbungen erscheinen hier automatisch.</span></div>'}</div>`;
  v.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { filter = b.dataset.f; list(v, q); });
  v.querySelector('#coQ').onsubmit = (e) => { e.preventDefault(); list(v, e.target.elements.q.value.trim()); };
  v.querySelectorAll('[data-id]').forEach((b) => b.onclick = () => { location.hash = `creator-${b.dataset.id}`; });
}

async function detail(v, id) {
  const r = await api(`/api/admin/creators/${id}`);
  if (!r.ok) { v.innerHTML = `<p><a href="#creator" class="ck-link">← Alle Creator</a></p><div class="ad-state err" role="alert"><strong>Creator konnte nicht geladen werden.</strong><span>${esc(r.data?.error || '')}</span></div>`; return; }
  const d = r.data, c = d.creator, b = d.business, p = d.payout;
  const steps = { account: 'Konto', profile: 'Profil', social: 'Social', business: 'Business', payout: 'Zahlungsdaten', agreement: 'Vereinbarung' };
  v.innerHTML = `<p><a href="#creator" class="ck-link">← Alle Creator</a></p>
    <section class="pt-card"><div class="ad-h-row"><h2>${esc(c.display_name || 'Ohne Namen')} ${chip(ST, c.status)}</h2></div>
      ${c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW' ? '<p class="form-note" style="margin:4px 0 0">Neue Creator-Bewerbung</p>' : ''}
      <ul class="cr-done" style="display:flex;flex-wrap:wrap;gap:6px 16px">${Object.entries(steps).map(([k, l]) => `<li class="${d.completeness[k] ? '' : 'miss'}"><span aria-hidden="true">${d.completeness[k] ? '✓' : '!'}</span>${esc(l)}</li>`).join('')}</ul>
      ${c.info_request ? `<div class="pt-alert warn"><strong>Offene Rückfrage:</strong> ${esc(c.info_request)}</div>` : ''}
      <div class="co-actions" id="coAct">${d.actions.map((a) => `<button type="button" class="btn ${ACT[a][1]}" data-a="${a}">${ACT[a][0]}</button>`).join('') || '<span class="form-note">Keine Aktion in diesem Status bzw. für Ihre Rolle.</span>'}</div></section>
    <div class="pt-grid2 co-360">
      <section class="pt-card"><h3>Profil</h3>${dl([
        ['Name', c.first_name !== undefined ? esc([c.first_name, c.last_name].filter(Boolean).join(' ')) : '<span class="form-note">für Ihre Rolle ausgeblendet</span>'],
        ['E-Mail', c.email ? `${esc(c.email)} ${c.email_confirmed ? '<span class="st ok" style="margin:0">bestätigt</span>' : '<span class="st warn" style="margin:0">unbestätigt</span>'}` : null],
        ['Telefon', c.phone ? esc(c.phone) : null], ['Land', esc(c.country || '')], ['Unternehmen', esc(c.company || '')],
        ['Website', c.website ? `<a href="${safeUrl(c.website)}" target="_blank" rel="noopener noreferrer">${esc(c.website)}</a>` : null],
        ['Kategorien', esc((c.categories || []).map((k) => CAT[k] || k).join(', '))], ['Attributions-Code', c.ref_code ? `<code>${esc(c.ref_code)}</code>` : null],
        ['Bewerbung begonnen', dt(c.created_at)], ['Eingereicht', c.submitted_at ? dt(c.submitted_at) : null], ['Freigegeben', c.approved_at ? dt(c.approved_at) : null],
      ])}${c.bio ? `<p style="white-space:pre-wrap;margin:8px 0 0">${esc(c.bio)}</p>` : ''}</section>
      <section class="pt-card"><h3>Social Media</h3><p class="form-note" style="margin:0 0 8px">Nur öffentliche Angaben, keine Konto-Verbindung.</p>${d.socials.length ? `<ul class="co-social">${d.socials.map((s) => `<li><strong>${esc(s.platform === 'other' ? s.platform_label || 'Andere' : PL[s.platform])}</strong> ${esc(s.handle || s.channel_name || '')}<br><a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url)}</a>${s.follower_range ? ` <small class="form-note">· ${esc(s.follower_range.replace(/_/g, '–'))}</small>` : ''}</li>`).join('')}</ul>` : '<p class="form-note">Keine Angaben.</p>'}</section>
      ${b !== undefined ? `<section class="pt-card"><h3>Business und Rechnung</h3>${b ? dl([
        ['Art', b.entity_type === 'company' ? 'Unternehmen' : 'Privatperson / Einzelunternehmen'], ['Name / Firma', esc(b.legal_name)], ['Rechtsform', esc(b.legal_form || '')],
        ['Anschrift', `${esc(b.street)}<br>${esc(b.postal_code)} ${esc(b.city)}, ${esc(b.country)}`], ['Umsatzsteuer', esc(VAT[b.vat_status] || b.vat_status)],
        ['Steuernummer', esc(b.tax_number || '')], ['USt-IdNr.', esc(b.vat_id || '')], ['Rechnungs-E-Mail', esc(b.billing_email)],
      ]) : '<p class="form-note">Noch nicht hinterlegt.</p>'}</section>` : ''}
      ${p !== undefined ? `<section class="pt-card"><h3>Zahlungsdaten</h3>${p ? `${dl([['Kontoinhaber', esc(p.holder_name)], ['IBAN', `<span class="cr-mask">${esc(p.iban_masked)}</span>`], ['BIC', esc(p.bic || '')], ['Status', chip(PAY, p.status)], ['Hinterlegt', dtt(p.created_at)], ['Geprüft', p.verified_at ? dtt(p.verified_at) : null]])}
        <div class="co-actions">${d.can.reveal ? '<button type="button" class="btn btn-outline" id="coReveal">Geschützte Zahlungsdaten anzeigen</button>' : ''}${d.can.verify && p.status !== 'VERIFIED' ? '<button type="button" class="btn btn-outline" id="coVerify">Als geprüft markieren</button>' : ''}</div><div id="coRevealBox"></div>
        ${d.can.reveal ? '<p class="form-note">Das Anzeigen der vollständigen Zahlungsdaten wird mit Ihrer Kennung protokolliert.</p>' : ''}` : '<p class="form-note">Noch nicht hinterlegt.</p>'}</section>` : ''}
      <section class="pt-card"><h3>Vereinbarung</h3>${dl([['Aktuelle Fassung', d.agreement.current ? `${esc(d.agreement.current.version)}${d.agreement.current.is_draft ? ' <span class="st warn" style="margin:0">Entwurf</span>' : ''}` : '–'], ['Bestätigt', d.agreement.accepted_current ? '<span class="st ok" style="margin:0">ja</span>' : '<span class="st bad" style="margin:0">nein</span>']])}
        ${d.agreement.history.length ? `<p class="form-note">Zustimmungen: ${d.agreement.history.map((h) => `${esc(h.immo_creator_agreements?.version || '')} am ${dtt(h.accepted_at)}`).join(' · ')}</p>` : ''}</section>
      <section class="pt-card"><h3>Prüfverlauf</h3>${d.reviews.length ? `<ul class="pt-check">${d.reviews.map((x) => `<li><strong>${esc(ACT[x.action]?.[0] || x.action)}</strong> · ${dtt(x.created_at)}${x.visible_to_creator ? ' <small class="form-note">(an Creator gesendet)</small>' : ''}${x.message ? `<br><span style="white-space:pre-wrap">${esc(x.message)}</span>` : ''}</li>`).join('')}</ul>` : '<p class="form-note">Noch keine Entscheidungen.</p>'}</section>
    </div>
    ${d.audit ? `<section class="pt-card"><h3>Audit</h3><p class="form-note">Unveränderbares Protokoll. Akteure pseudonymisiert, keine Zahlungsdaten.</p><div style="overflow-x:auto"><table class="ad-table co-audit"><thead><tr><th>Zeit</th><th>Ereignis</th><th>Wer</th><th>Ergebnis</th></tr></thead><tbody>${d.audit.map((a) => `<tr><td>${dtt(a.created_at)}</td><td>${esc(EV[a.event_type] || a.event_type)}</td><td>${esc(a.actor_kind === 'creator' ? 'Creator' : `${a.actor_role || ''} ${a.actor_ref}`)}</td><td>${a.result === 'SUCCESS' ? '<span class="st ok" style="margin:0">ok</span>' : `<span class="st bad" style="margin:0">${esc(a.result)}</span>`}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;

  v.querySelectorAll('[data-a]').forEach((btn) => btn.onclick = () => decide(v, id, btn.dataset.a, c));
  v.querySelector('#coVerify')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    const x = await api(`/api/admin/creators/${id}/bank`, { method: 'POST', body: JSON.stringify({ action: 'verify' }) });
    if (!x.ok) { alert(x.data?.error || 'Nicht möglich.'); e.target.disabled = false; return; }
    detail(v, id);
  });
  v.querySelector('#coReveal')?.addEventListener('click', async (e) => {
    if (!confirm('Vollständige Zahlungsdaten anzeigen? Der Zugriff wird protokolliert.')) return;
    e.target.disabled = true;
    const x = await api(`/api/admin/creators/${id}/bank`, { method: 'POST', body: JSON.stringify({ action: 'reveal' }) });
    const box = v.querySelector('#coRevealBox');
    if (!x.ok) { box.innerHTML = `<div class="pt-alert bad">${esc(x.data?.error || 'Nicht möglich.')}</div>`; e.target.disabled = false; return; }
    box.innerHTML = `<div class="co-reveal" role="status"><strong>Geschützte Zahlungsdaten</strong> <small class="form-note">· wird in <span id="coT">${x.data.hide_after_seconds}</span> s ausgeblendet</small>${dl([['Kontoinhaber', esc(x.data.holder_name)], ['IBAN', `<span class="cr-mask">${esc(x.data.iban)}</span>`], ['BIC', esc(x.data.bic || '')]])}<button type="button" class="btn btn-outline btn-sm" id="coHide">Jetzt ausblenden</button></div>`;
    let left = x.data.hide_after_seconds;
    const hide = () => { clearInterval(tm); box.innerHTML = ''; e.target.disabled = false; };
    const tm = setInterval(() => { left -= 1; const t = v.querySelector('#coT'); if (t) t.textContent = String(left); if (left <= 0 || !document.body.contains(box)) hide(); }, 1000);
    box.querySelector('#coHide').onclick = hide;
  });
}

function decide(v, id, action, c) {
  const needs = ['REQUEST_INFO', 'REJECT', 'SUSPEND'].includes(action);
  const d = document.createElement('dialog');
  d.className = 'ad-dlg';
  const title = { START_REVIEW: 'Prüfung starten', APPROVE: 'Creator freigeben', REQUEST_INFO: 'Information anfordern', REJECT: 'Bewerbung ablehnen', SUSPEND: 'Creator pausieren', REACTIVATE: 'Creator reaktivieren' }[action];
  const hint = {
    APPROVE: 'Bei Freigabe wird der Creator aktiv: Creator-Portal, Zahlungsdaten und Vereinbarung stehen ihm sofort zur Verfügung. Er erhält eine E-Mail.',
    REQUEST_INFO: 'Der Creator erhält diese Nachricht per E-Mail und im Portal („ImmoAdv benötigt noch eine Information von dir.“) und kann seine Angaben ergänzen.',
    REJECT: 'Der Creator erhält diese Begründung per E-Mail.', SUSPEND: 'Der Creator erhält diese Begründung per E-Mail. Der Zugang wird pausiert.',
    START_REVIEW: 'Der Status wechselt auf „In Prüfung“. Der Creator kann seine Angaben weiterhin nicht ändern.', REACTIVATE: 'Der Creator ist wieder aktiv und erhält eine E-Mail.',
  }[action];
  d.innerHTML = `<form class="ad-dlg-in" method="dialog"><h2 style="margin:0;color:#0F2C59">${esc(title)}</h2><p>${esc(c.display_name || '')}</p><p class="form-note">${esc(hint)}</p>
    ${needs ? '<label class="pt-field">Nachricht an den Creator*<textarea name="message" rows="5" maxlength="2000" required></textarea></label>' : ''}
    <p class="pt-alert bad" id="coErr" hidden></p>
    <div class="wiz-nav"><button type="button" class="btn btn-outline" data-x>Abbrechen</button><button type="submit" class="btn btn-dark">${esc(title)}</button></div></form>`;
  document.body.append(d);
  d.querySelector('[data-x]').onclick = () => d.close();
  d.addEventListener('close', () => d.remove());
  d.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const message = e.target.elements.message?.value.trim() || null;
    const err = d.querySelector('#coErr');
    if (needs && !message) { err.hidden = false; err.textContent = 'Bitte eine Nachricht an den Creator angeben.'; return; }
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
    const r = await api(`/api/admin/creators/${id}`, { method: 'POST', body: JSON.stringify({ action, message }) });
    if (!r.ok) { err.hidden = false; err.textContent = r.data?.error || 'Nicht möglich.'; btn.disabled = false; return; }
    d.close();
    detail(v, id);
  };
  d.showModal();
}

async function roles(v) {
  const r = await api('/api/admin/creators/roles');
  if (!r.ok) { v.innerHTML = `<p><a href="#creator" class="ck-link">← Creator Operations</a></p><div class="ad-state err"><strong>${esc(r.data?.error || 'Nicht möglich.')}</strong></div>`; return; }
  const OPTS = [['', 'Standard (Super Admin)'], ['SUPER_ADMIN', 'Super Admin'], ['FINANCE_ADMIN', 'Finance Admin'], ['CREATOR_MANAGER', 'Creator Manager'], ['SUPPORT', 'Support'], ['READ_ONLY', 'Nur lesen']];
  v.innerHTML = `<p><a href="#creator" class="ck-link">← Creator Operations</a></p><section class="pt-card"><h2>Rollen im Creator-Bereich</h2>
    <p class="form-note">Rollen schränken den Creator-Bereich ein – sie geben keinen zusätzlichen Zugang zum Web-Admin. Zugang haben weiterhin nur Adressen aus ADMIN_EMAILS mit zweitem Faktor. Vollständige Zahlungsdaten sehen nur Super Admin und Finance Admin.</p>
    <div style="overflow-x:auto"><table class="ad-table"><thead><tr><th>Administrator</th><th>Rolle</th></tr></thead><tbody>${r.data.admins.map((a) => `<tr><td>${esc(a.email)}${a.self ? ' <small class="form-note">(Sie)</small>' : ''}</td><td>${a.self ? esc(a.role_label) : `<select data-email="${esc(a.email)}" aria-label="Rolle für ${esc(a.email)}">${OPTS.map(([k, l]) => `<option value="${k}"${(a.explicit ? a.role : '') === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`}</td></tr>`).join('')}</tbody></table></div>
    <p class="form-note" id="coRoleMsg" role="status"></p></section>`;
  v.querySelectorAll('select[data-email]').forEach((s) => s.onchange = async () => {
    const m = v.querySelector('#coRoleMsg');
    const x = await api('/api/admin/creators/roles', { method: 'POST', body: JSON.stringify({ email: s.dataset.email, role: s.value || null }) });
    m.textContent = x.ok ? 'Gespeichert und protokolliert.' : (x.data?.error || 'Nicht möglich.');
  });
}
