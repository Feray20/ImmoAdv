// Web-Admin → Postfach: E-Mails empfangen, lesen, beantworten und im ImmoAdv-Design senden (support@immoadv.de).
import { api, dtt, esc } from './sess.mjs?v=c6ddf5c2';

const $ = (s, r = document) => r.querySelector(s);
const FOLDERS = [
  ['inbox', 'Posteingang', '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>'],
  ['starred', 'Markiert', '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>'],
  ['sent', 'Gesendet', '<path d="M4 12l16-8-6 16-3-6z"/><path d="M11 14l9-10"/>'],
  ['drafts', 'Entwürfe', '<path d="M4 20h4L19 9l-4-4L4 16z"/>'],
  ['archive', 'Archiv', '<path d="M3 5h18v4H3z"/><path d="M5 9v10h14V9M10 13h4"/>'],
  ['spam', 'Spam', '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16v.5"/>'],
  ['trash', 'Papierkorb', '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'],
];
const S = { folder: 'inbox', q: '', items: [], open: null, sel: new Set(), data: null };
const toast = (t, bad) => { let el = $('#pfToast'); if (!el) { el = document.createElement('div'); el.id = 'pfToast'; el.className = 'pt-toast'; document.body.append(el); } el.textContent = t; el.style.background = bad ? '#991B1B' : ''; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 3400); };
const icon = (p, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const when = (m) => { const d = new Date(m.received_at || m.sent_at || m.created_at); const t = new Date(); return d.toDateString() === t.toDateString() ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: d.getFullYear() === t.getFullYear() ? undefined : '2-digit' }); };
const who = (m) => (m.direction === 'in' ? (m.from_name || m.from_email) : `An: ${(m.to_emails || []).join(', ') || '–'}`);
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export async function postfach(v) {
  v.innerHTML = `<section class="pf"><aside class="pf-side"><button class="btn btn-dark pf-new" type="button" id="pfNew">${icon('<path d="M12 5v14M5 12h14"/>')}Neue E-Mail</button><nav class="pf-nav" id="pfNav"></nav><div class="pf-box" id="pfBox"></div></aside>
    <div class="pf-main"><div class="pf-bar"><input id="pfQ" type="search" placeholder="E-Mails durchsuchen" value="${esc(S.q)}"><button type="button" class="btn btn-outline btn-sm" id="pfSync" title="Neue E-Mails abrufen">${icon('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', 16)} Abrufen</button><div class="pf-acts" id="pfActs"></div></div><div class="pf-cols"><div class="pf-list" id="pfList" aria-live="polite"></div><div class="pf-read" id="pfRead"></div></div></div></section>`;
  $('#pfNew').onclick = () => compose({});
  $('#pfSync').onclick = () => { S.sync = true; load(v); };
  let t; $('#pfQ').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value; load(v); }, 300); };
  await load(v);
}

async function load(v) {
  const r = await api(`/api/admin/mail?folder=${S.folder}${S.q ? `&q=${encodeURIComponent(S.q)}` : ''}${S.sync ? '&sync=1' : ''}`); const manual = S.sync; S.sync = false;
  if (!r.ok) { $('#pfList').innerHTML = `<p class="form-note pf-empty">${esc(r.data?.error || 'Nicht verfügbar.')}</p>`; return; }
  S.data = r.data; S.items = r.data.items || []; S.sel.clear();
  if (r.data.imported) toast(`${r.data.imported} vorbereitete E-Mails liegen jetzt unter Entwürfe.`);
  else if (r.data.fetched) toast(`${r.data.fetched} neue E-Mail(s) empfangen.`);
  else if (manual) toast('Keine neuen E-Mails.');
  const c = r.data.counts || {};
  $('#pfNav').innerHTML = FOLDERS.map(([k, l, p]) => `<button type="button" class="pf-f${S.folder === k ? ' on' : ''}" data-f="${k}">${icon(p)}<span>${l}</span>${c[k] ? `<b>${c[k]}</b>` : ''}</button>`).join('');
  $('#pfNav').querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { S.folder = b.dataset.f; S.open = null; $('#pfRead').innerHTML = ''; v.querySelector('.pf')?.classList.remove('reading'); load(v); });
  $('#pfBox').innerHTML = `<p><strong>${esc(r.data.mailbox)}</strong></p><p class="${r.data.receiving ? 'pf-ok' : 'pf-warn'}">${r.data.receiving ? `Empfang aktiv${r.data.webhook ? ' (sofort)' : ' (Abruf beim Öffnen)'}` : 'Empfang noch nicht eingerichtet – Senden funktioniert bereits.'}</p>
    <form id="pfBook"><label>Terminbuchung (leer = immoadv.de/termin)<input name="url" type="url" placeholder="https://immoadv.de/termin" value="${esc(r.data.booking || '')}"></label><button class="btn btn-outline btn-sm" type="submit">Speichern</button></form>`;
  $('#pfBook').onsubmit = async (e) => { e.preventDefault(); const rr = await api('/api/admin/mail', { method: 'POST', body: JSON.stringify({ action: 'booking', url: new FormData(e.target).get('url') || '' }) }); toast(rr.ok ? 'Terminlink gespeichert.' : rr.data?.error || 'Fehler', !rr.ok); };
  drawList(v);
}

function drawList(v) {
  const L = S.items;
  $('#pfActs').innerHTML = S.sel.size ? `<span class="form-note">${S.sel.size} ausgewählt</span>
    <button class="btn btn-ghost btn-sm" data-bulk="read" type="button">Gelesen</button><button class="btn btn-ghost btn-sm" data-bulk="archive" type="button">Archivieren</button>
    ${S.folder === 'trash' ? '<button class="btn btn-ghost btn-sm" data-bulk="purge" type="button">Endgültig löschen</button>' : '<button class="btn btn-ghost btn-sm" data-bulk="trash" type="button">Löschen</button>'}${S.folder === 'spam' ? '<button class="btn btn-ghost btn-sm" data-bulk="inbox" type="button">Kein Spam</button>' : ''}` : '';
  $('#pfActs').querySelectorAll('[data-bulk]').forEach((b) => b.onclick = () => bulk(v, b.dataset.bulk, [...S.sel]));
  $('#pfList').innerHTML = L.length ? L.map((m) => `<div class="pf-row${m.direction === 'in' && !m.read_at ? ' unread' : ''}${S.open === m.id ? ' on' : ''}" data-id="${m.id}" role="button" tabindex="0">
      <input type="checkbox" data-ck="${m.id}" aria-label="Auswählen"${S.sel.has(m.id) ? ' checked' : ''}>
      <button type="button" class="pf-star${m.starred ? ' on' : ''}" data-star="${m.id}" aria-label="Markieren">${icon(FOLDERS[1][2], 16)}</button>
      <div class="pf-row-t"><div class="pf-row-h"><strong>${esc(who(m))}</strong><time>${when(m)}</time></div>
      <div class="pf-row-s">${esc(m.subject || '(ohne Betreff)')}${(m.attachments || []).filter((a) => !a.inline).length ? ` ${icon('<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>', 14)}` : ''}</div>
      <div class="pf-row-p">${m.status === 'fehler' ? `<span class="st bad">Fehler</span> ${esc(m.error || '')}` : m.status === 'gesperrt' ? '<span class="st bad">Gesperrt</span> ' : ''}${esc(m.snippet || '')}</div></div></div>`).join('')
    : `<p class="form-note pf-empty">${S.q ? 'Keine Treffer.' : { inbox: 'Keine E-Mails im Posteingang.', drafts: 'Keine Entwürfe.', sent: 'Noch nichts gesendet.' }[S.folder] || 'Leer.'}</p>`;
  $('#pfList').querySelectorAll('.pf-row').forEach((row) => {
    const go = (e) => { if (e.target.closest('input,button')) return; openMsg(v, row.dataset.id); };
    row.onclick = go; row.onkeydown = (e) => { if (e.key === 'Enter') go(e); };
  });
  $('#pfList').querySelectorAll('[data-ck]').forEach((x) => x.onchange = () => { x.checked ? S.sel.add(x.dataset.ck) : S.sel.delete(x.dataset.ck); drawList(v); });
  $('#pfList').querySelectorAll('[data-star]').forEach((b) => b.onclick = async () => { const m = L.find((y) => y.id === b.dataset.star); m.starred = !m.starred; drawList(v); await api('/api/admin/mail', { method: 'POST', body: JSON.stringify({ action: 'mark', ids: [m.id], starred: m.starred }) }); });
}

async function bulk(v, what, ids) {
  if (!ids.length) return;
  if (what === 'purge' && !confirm(`${ids.length} E-Mail(s) endgültig löschen?`)) return;
  const body = what === 'purge' ? { action: 'purge', ids } : what === 'read' ? { action: 'mark', ids, read: true } : { action: 'mark', ids, folder: what };
  const r = await api('/api/admin/mail', { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok) { toast(r.data?.error || 'Fehler', true); return; }
  if (ids.includes(S.open)) { S.open = null; $('#pfRead').innerHTML = ''; v.querySelector('.pf')?.classList.remove('reading'); }
  load(v);
}

async function openMsg(v, id) {
  const it = S.items.find((x) => x.id === id);
  if (it && it.direction === 'out' && it.status !== 'gesendet' && it.design === 'frei') { compose({ id }); return; }
  S.open = id; drawList(v);
  const rd = $('#pfRead'); rd.innerHTML = '<p class="ia-ld" role="status">Lädt …</p>';
  v.querySelector('.pf')?.classList.add('reading');
  const r = await api('/api/admin/mail?id=' + id);
  if (!r.ok) { rd.innerHTML = `<p class="form-note">${esc(r.data?.error || 'Fehler')}</p>`; return; }
  const { message: m, thread, contact } = r.data;
  if (it && !it.read_at) { it.read_at = new Date().toISOString(); drawList(v); }
  const draft = m.direction === 'out' && m.status !== 'gesendet';
  rd.innerHTML = `<div class="pf-rh"><button type="button" class="btn btn-ghost btn-sm pf-back" id="pfBack">← Zurück</button><h2>${esc(m.subject || '(ohne Betreff)')}</h2>
      ${contact ? `<p class="form-note">Akquise-Kontakt: <strong>${esc(contact.company)}</strong>${contact.contact_name ? ` · ${esc(contact.contact_name)}` : ''} · Status ${esc(contact.status)}</p>` : ''}
      <div class="pf-ra">${draft ? `<button class="btn btn-dark btn-sm" id="pfSend" type="button">Senden an ${esc(m.to_emails.join(', '))}</button>` : `<button class="btn btn-dark btn-sm" id="pfReply" type="button">Antworten</button><button class="btn btn-outline btn-sm" id="pfFwd" type="button">Weiterleiten</button>`}
      <button class="btn btn-ghost btn-sm" data-mv="archive" type="button">Archivieren</button><button class="btn btn-ghost btn-sm" data-mv="${m.folder === 'trash' ? 'inbox' : 'trash'}" type="button">${m.folder === 'trash' ? 'Wiederherstellen' : 'Löschen'}</button>${m.folder === 'spam' ? '<button class="btn btn-ghost btn-sm" data-mv="inbox" type="button">Kein Spam</button>' : m.direction === 'in' ? '<button class="btn btn-ghost btn-sm" data-mv="spam" type="button">Spam</button>' : ''}</div></div>
    ${thread.map((x) => `<article class="pf-msg${x.id === m.id ? ' cur' : ''}"><header><strong>${esc(x.direction === 'in' ? (x.from_name ? `${x.from_name} <${x.from_email}>` : x.from_email) : `ImmoAdv <${x.from_email}>`)}</strong><span>an ${esc((x.to_emails || []).join(', '))}${(x.cc_emails || []).length ? `, Cc ${esc(x.cc_emails.join(', '))}` : ''}</span><time>${esc(dtt(x.received_at || x.sent_at || x.created_at))}</time>${x.status && x.direction === 'out' ? `<span class="st ${x.status === 'gesendet' ? 'ok' : x.status === 'entwurf' ? '' : 'bad'}">${esc({ gesendet: 'Gesendet', entwurf: 'Entwurf', fehler: 'Fehler', gesperrt: 'Gesperrt' }[x.status] || x.status)}</span>` : ''}${x.error ? `<small class="pf-err">${esc(x.error)}</small>` : ''}</header>
      ${(x.attachments || []).filter((a) => !a.inline || x.direction === 'out').length ? `<div class="pf-att">${x.attachments.map((a, i) => (a.inline && x.direction === 'in' ? '' : `<button type="button" class="pf-chip" data-file="${x.id}:${i}">${icon('<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>', 14)}${esc(a.name)} <small>${kb(a.size)}</small></button>`)).join('')}</div>` : ''}
      <iframe class="pf-frame" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin" title="E-Mail-Inhalt"></iframe></article>`).join('')}
    ${m.direction === 'in' ? '<p class="form-note pf-note">Externe Bilder in empfangenen E-Mails werden aus Datenschutzgründen nicht geladen.</p>' : ''}`;
  rd.querySelectorAll('.pf-frame').forEach((f, i) => {
    f.srcdoc = thread[i].view;
    f.onload = () => fit(f);
  });
  $('#pfBack').onclick = () => { S.open = null; v.querySelector('.pf')?.classList.remove('reading'); drawList(v); };
  rd.querySelectorAll('[data-mv]').forEach((b) => b.onclick = () => bulk(v, b.dataset.mv, [m.id]));
  rd.querySelectorAll('[data-file]').forEach((b) => b.onclick = async () => { const rr = await api('/api/admin/mail?file=' + encodeURIComponent(b.dataset.file)); if (rr.ok) window.open(rr.data.url, '_blank', 'noopener'); else toast(rr.data?.error || 'Fehler', true); });
  $('#pfSend')?.addEventListener('click', async (e) => {
    if (!confirm(`Jetzt senden an ${m.to_emails.join(', ')}?\n\n„${m.subject}“`)) return;
    e.target.disabled = true; e.target.textContent = 'Sendet …';
    const rr = await api('/api/admin/mail', { method: 'POST', body: JSON.stringify({ action: 'send', id: m.id }) });
    toast(rr.ok ? 'Gesendet.' : rr.data?.error || 'Senden fehlgeschlagen.', !rr.ok);
    S.open = null; load(v); rd.innerHTML = '';
  });
  const last = thread.filter((x) => x.direction === 'in').pop() || m;
  $('#pfReply')?.addEventListener('click', () => compose({ replyTo: last.id, to: [last.direction === 'in' ? last.from_email : (last.to_emails || [])[0]].filter(Boolean), subject: /^(re|aw):/i.test(m.subject) ? m.subject : `Re: ${m.subject}` }));
  $('#pfFwd')?.addEventListener('click', () => compose({ forward: m.id, subject: /^(wg|fwd?):/i.test(m.subject) ? m.subject : `WG: ${m.subject}`, body: `<p><br></p><p>---------- Weitergeleitete Nachricht ----------<br>Von: ${esc(m.from_name ? `${m.from_name} <${m.from_email}>` : m.from_email)}<br>Betreff: ${esc(m.subject)}</p>${String(m.text_body || '').split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}` }));
}

// E-Mail immer vollständig zeigen: zu breite Inhalte auf die Rahmenbreite verkleinern, Höhe an den Inhalt anpassen.
function fit(f) {
  try {
    const doc = f.contentDocument, root = doc.documentElement;
    root.style.zoom = '1';
    const w = f.clientWidth, sw = Math.max(root.scrollWidth, doc.body?.scrollWidth || 0);
    const z = sw > w + 2 ? Math.max(0.3, (w - 2) / sw) : 1;
    root.style.zoom = String(z);
    const h = doc.body ? doc.body.getBoundingClientRect().height : root.scrollHeight;
    f.style.height = Math.min(8000, Math.ceil(Math.max(h, root.getBoundingClientRect().height)) + 16) + 'px';
  } catch { f.style.height = '900px'; }
}
window.addEventListener('resize', () => document.querySelectorAll('.pf-frame').forEach((f) => fit(f)));

// ---------- Verfassen ----------
const TOOLS = [['bold', 'B', 'Fett'], ['italic', 'I', 'Kursiv'], ['underline', 'U', 'Unterstrichen'], ['h2', 'Ü', 'Überschrift'], ['insertUnorderedList', '•', 'Liste'], ['insertOrderedList', '1.', 'Nummerierte Liste'], ['blockquote', '❝', 'Hervorhebung'], ['link', '🔗', 'Link']];
async function compose(o) {
  let cur = { id: o.id || null, to: o.to || [], cc: [], subject: o.subject || '', body: o.body || '', withUnsub: o.replyTo ? false : true, attachments: [] };
  if (o.id) {
    const r = await api('/api/admin/mail?id=' + o.id);
    if (!r.ok) { toast(r.data?.error || 'Fehler', true); return; }
    const m = r.data.message;
    cur = { id: m.id, to: m.to_emails, cc: m.cc_emails, subject: m.subject, body: m.html || '', withUnsub: m.with_unsub, attachments: m.attachments || [] };
  }
  let d = document.getElementById('pfCompose');
  if (!d) { d = document.createElement('dialog'); d.id = 'pfCompose'; d.className = 'ad-dlg pf-dlg'; document.body.append(d); }
  d.innerHTML = `<form class="ad-dlg-in pf-c" id="pfC"><div class="ad-dlg-h"><h2>${o.replyTo ? 'Antworten' : o.forward ? 'Weiterleiten' : cur.id ? 'Entwurf' : 'Neue E-Mail'}</h2><button class="stage-x" type="button" data-x aria-label="Schließen">×</button></div>
    <label class="pf-fld"><span>Von</span><input value="Support | ImmoAdv <${esc(S.data?.mailbox || 'support@immoadv.de')}>" disabled></label>
    <label class="pf-fld"><span>An</span><input name="to" value="${esc(cur.to.join(', '))}" placeholder="name@firma.de, …" autocomplete="off" required></label>
    <label class="pf-fld"><span>Cc</span><input name="cc" value="${esc(cur.cc.join(', '))}" autocomplete="off"></label>
    <label class="pf-fld"><span>Betreff</span><input name="subject" value="${esc(cur.subject)}" maxlength="300" required></label>
    <div class="pf-tb" role="toolbar" aria-label="Formatierung">${TOOLS.map(([c, l, t]) => `<button type="button" data-cmd="${c}" title="${t}" aria-label="${t}">${l}</button>`).join('')}</div>
    <div class="pf-ed" id="pfEd" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Nachricht">${cur.body || '<p>Guten Tag,</p><p><br></p>'}</div>
    <p class="form-note pf-sig">Darunter automatisch: „Viele Grüße“, Foto, Unterschrift, Kontaktdaten, Impressum – im ImmoAdv-Design.</p>
    <div class="pf-att" id="pfAtt"></div>
    <div class="pf-cf"><label class="pf-file btn btn-outline btn-sm">${icon('<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>', 16)}Anhang<input type="file" id="pfFile" multiple hidden></label>
      <label class="pf-un"><input type="checkbox" name="unsub"${cur.withUnsub ? ' checked' : ''}> Abmeldelink anhängen</label><span class="pf-sp"></span>
      <button class="btn btn-ghost btn-sm" type="button" id="pfPrev">Vorschau</button><button class="btn btn-outline btn-sm" type="button" id="pfSave">Entwurf speichern</button><button class="btn btn-dark" type="submit">Senden</button></div></form>`;
  if (!d.open) d.showModal();
  const ed = $('#pfEd', d), f = $('#pfC', d);
  const drawAtt = () => { $('#pfAtt', d).innerHTML = cur.attachments.map((a, i) => `<span class="pf-chip">${esc(a.name)} <small>${kb(a.size)}</small><button type="button" data-rm="${i}" aria-label="Entfernen">×</button></span>`).join(''); $('#pfAtt', d).querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => { const rr = await api('/api/admin/mail', { method: 'POST', body: JSON.stringify({ action: 'detach', id: cur.id, index: Number(b.dataset.rm) }) }); if (rr.ok) { cur.attachments = rr.data.attachments; drawAtt(); } }); };
  drawAtt();
  const list = (s) => String(s || '').split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const payload = (extra = {}) => ({ action: 'save', id: cur.id || undefined, to: list(f.to.value), cc: list(f.cc.value), subject: f.subject.value, body: ed.innerHTML, withUnsub: f.unsub.checked, ...(cur.id ? {} : { replyTo: o.replyTo, forward: o.forward }), ...extra });
  const save = async (extra) => { const r = await api('/api/admin/mail', { method: 'POST', body: JSON.stringify(payload(extra)) }); if (r.data?.id) cur.id = r.data.id; return r; };
  d.querySelectorAll('[data-cmd]').forEach((b) => b.onclick = () => {
    ed.focus(); const c = b.dataset.cmd;
    if (c === 'link') { const u = prompt('Link-Adresse (https://…)', 'https://'); if (u && /^(https?:|mailto:)/.test(u)) document.execCommand('createLink', false, u); }
    else if (c === 'h2' || c === 'blockquote') document.execCommand('formatBlock', false, c);
    else document.execCommand(c);
  });
  ed.addEventListener('paste', (e) => { const t = e.clipboardData?.getData('text/plain'); if (t != null && !e.clipboardData.types.includes('text/html')) return; e.preventDefault(); document.execCommand('insertText', false, t || ''); });
  $('[data-x]', d).onclick = async () => { if (ed.textContent.trim().length > 20 || cur.id) { const r = await save(); if (r.ok) toast('Entwurf gespeichert.'); } d.close(); if (S.folder === 'drafts') load(document.querySelector('.pf')?.parentElement); };
  $('#pfSave', d).onclick = async () => { const r = await save(); toast(r.ok ? 'Entwurf gespeichert.' : r.data?.error || 'Fehler', !r.ok); };
  $('#pfPrev', d).onclick = async () => {
    const r = await api('/api/admin/mail', { method: 'POST', body: JSON.stringify(payload({ preview: true })) });
    if (!r.ok) { toast(r.data?.error || 'Fehler', true); return; }
    let p = document.getElementById('pfPv'); if (!p) { p = document.createElement('dialog'); p.id = 'pfPv'; p.className = 'ad-dlg'; document.body.append(p); }
    p.innerHTML = `<div class="ad-dlg-in mk-pv"><div class="ad-dlg-h"><h2>Vorschau</h2><button class="stage-x" data-x aria-label="Schließen">×</button></div><div class="mk-pv-sw" role="group" aria-label="Ansicht"><button type="button" class="on" data-w="390">Handy</button><button type="button" data-w="680">Desktop</button></div><iframe class="mk-pv-if" title="Vorschau" sandbox="allow-popups allow-popups-to-escape-sandbox" style="width:390px"></iframe></div>`;
    p.querySelector('iframe').srcdoc = r.data.preview; p.showModal();
    p.querySelector('[data-x]').onclick = () => p.close();
    p.querySelectorAll('[data-w]').forEach((x) => x.onclick = () => { p.querySelectorAll('[data-w]').forEach((y) => y.classList.toggle('on', y === x)); p.querySelector('iframe').style.width = x.dataset.w + 'px'; });
  };
  $('#pfFile', d).onchange = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    if (!cur.id) { const r = await save(); if (!r.ok) { toast(r.data?.error || 'Bitte zuerst Empfänger und Betreff angeben.', true); return; } }
    for (const file of files) {
      const u = await api('/api/admin/mail', { method: 'POST', body: JSON.stringify({ action: 'uploadUrl', id: cur.id, name: file.name, size: file.size }) });
      if (!u.ok) { toast(u.data?.error || 'Upload nicht möglich.', true); continue; }
      const put = await fetch(u.data.url, { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream', 'x-upsert': 'true' }, body: file }).catch(() => null);
      if (!put?.ok) { toast(`„${file.name}“ konnte nicht hochgeladen werden.`, true); continue; }
      const a = await api('/api/admin/mail', { method: 'POST', body: JSON.stringify({ action: 'attach', id: cur.id, path: u.data.path, name: file.name, type: file.type || 'application/octet-stream', size: file.size }) });
      if (a.ok) { cur.attachments = a.data.attachments; drawAtt(); }
    }
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const to = list(f.to.value);
    if (!to.length) { toast('Bitte einen Empfänger angeben.', true); return; }
    if (!confirm(`Jetzt senden an ${to.join(', ')}?`)) return;
    const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Sendet …';
    const r = await save({ send: true });
    btn.disabled = false; btn.textContent = 'Senden';
    if (!r.ok) { toast(r.data?.error || 'Senden fehlgeschlagen.', true); return; }
    toast('Gesendet.'); d.close();
    const v = document.querySelector('.pf')?.parentElement; if (v) load(v);
  };
}
