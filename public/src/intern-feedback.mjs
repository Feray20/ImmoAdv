// Web-Admin → Verbesserungsvorschläge: Eingang je Bereich (B2C oder B2B), Bewertung mit Sternen, Status, Antwort.
import { api, dtt, esc } from './sess.mjs?v=b1a55645';

const TOPICS = { bedienung: 'Bedienung & Navigation', rechner: 'Rechner & Kennzahlen', kreditmappe: 'Kreditmappe & Dokumente', inhalte: 'Inhalte & Erklärungen', neue_funktion: 'Neue Funktion', fehler: 'Fehler gefunden', sonstiges: 'Sonstiges' };
const STATUS = { neu: 'Neu', in_pruefung: 'In Prüfung', geplant: 'Geplant', umgesetzt: 'Umgesetzt', abgelehnt: 'Nicht geplant' };
const stars = (n, name = '') => `<span class="fb-stars"${name ? ` role="radiogroup" aria-label="${name}"` : ''}>${[1, 2, 3, 4, 5].map((k) => name ? `<button type="button" data-star="${k}" aria-label="${k} von 5" aria-checked="${k === n}" role="radio" class="${k <= (n || 0) ? 'on' : ''}">★</button>` : `<i class="${k <= n ? 'on' : ''}">★</i>`).join('')}</span>`;

export async function vorschlaege(v, seg) {
  const r = await api('/api/admin/feedback');
  if (!r.ok) { v.innerHTML = `<div class="ad-state err" role="alert"><strong>Die Vorschläge konnten nicht geladen werden.</strong><span>${esc(r.data?.error || '')}</span><button type="button" class="btn btn-outline" data-retry>Erneut versuchen</button></div>`; v.querySelector('[data-retry]').onclick = () => vorschlaege(v, seg); return; }
  const items = r.data.items || [];
  let filter = 'offen', sort = 'neu';
  const SORTS = { neu: (a, b) => String(b.created_at).localeCompare(String(a.created_at)), wichtig: (a, b) => (b.importance || 0) - (a.importance || 0), bewertung: (a, b) => (b.admin_rating || 0) - (a.admin_rating || 0), aktualisiert: (a, b) => String(b.updated_at).localeCompare(String(a.updated_at)) };
  const paint = () => {
    const list = items.filter((x) => filter === 'alle' ? true : filter === 'offen' ? ['neu', 'in_pruefung'].includes(x.status) : x.status === filter).sort(SORTS[sort]);
    const cnt = (f) => items.filter((x) => f === 'alle' ? true : f === 'offen' ? ['neu', 'in_pruefung'].includes(x.status) : x.status === f).length;
    v.innerHTML = `<section class="pt-card"><h2>Verbesserungsvorschläge · ${seg === 'b2b' ? 'Unternehmen' : 'Privatkunden'}</h2>
      <p class="form-note">Vorschläge aus dem ${seg === 'b2b' ? 'Unternehmensportal' : 'Privatbereich'}. Die Wichtigkeit gibt der Kunde an; Ihre Bewertung und Notiz sind nur hier sichtbar. Eine Antwort sieht der Kunde bei seinen Vorschlägen.</p>
      <div class="pc-chips" role="group" aria-label="Filter">${[['offen', 'Offen'], ['geplant', 'Geplant'], ['umgesetzt', 'Umgesetzt'], ['abgelehnt', 'Nicht geplant'], ['alle', 'Alle']].map(([k, l]) => `<button type="button" data-fbf="${k}" aria-pressed="${k === filter}">${l} <b>${cnt(k)}</b></button>`).join('')}</div>
      <label class="us-sort fb-sort">Sortieren<select data-fbsort>${[['neu', 'Neueste zuerst'], ['wichtig', 'Wichtigkeit für den Kunden'], ['bewertung', 'Ihre Bewertung'], ['aktualisiert', 'Zuletzt bearbeitet']].map(([k, l]) => `<option value="${k}"${k === sort ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      ${list.length ? `<div class="fb-list">${list.map((x) => `<article class="fb-card" data-id="${x.id}">
        <header><div><strong>${esc(TOPICS[x.topic] || x.topic)}</strong><small>Eingegangen ${dtt(x.created_at)}${x.updated_at && x.updated_at !== x.created_at ? ` · bearbeitet ${dtt(x.updated_at)}` : ''} · ${esc(x.company ? `${x.company} · ` : '')}${esc(x.email || 'Konto')}${x.page ? ` · ${esc(x.page)}` : ''}</small></div><span class="st ${x.status === 'umgesetzt' ? 'ok' : x.status === 'abgelehnt' ? 'bad' : x.status === 'neu' ? 'warn' : ''}">${STATUS[x.status]}</span></header>
        <p class="fb-text">${esc(x.text)}</p>
        <div class="fb-meta"><span>Wichtigkeit für den Kunden ${stars(x.importance)}</span></div>
        <div class="fb-admin"><label>Ihre Bewertung ${stars(x.admin_rating, 'Ihre Bewertung')}</label>
          <label>Status<select data-fbs>${Object.entries(STATUS).map(([k, l]) => `<option value="${k}"${k === x.status ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="fb-wide">Interne Notiz<textarea data-fbn rows="2" maxlength="2000" placeholder="z. B. Aufwand, Idee zur Umsetzung">${esc(x.admin_note || '')}</textarea></label>
          <label class="fb-wide">Antwort an den Kunden (optional)<textarea data-fba rows="2" maxlength="2000" placeholder="Wird beim Kunden unter seinen Vorschlägen angezeigt">${esc(x.answer || '')}</textarea></label>
          <button class="btn btn-dark" type="button" data-fbsave>Speichern</button><span class="form-note" data-fbmsg role="status"></span></div>
      </article>`).join('')}</div>` : '<div class="pt-empty"><strong>Keine Vorschläge in dieser Auswahl.</strong></div>'}</section>`;
    v.querySelectorAll('[data-fbf]').forEach((b) => b.onclick = () => { filter = b.dataset.fbf; paint(); });
    v.querySelector('[data-fbsort]')?.addEventListener('change', (e) => { sort = e.target.value; paint(); });
    v.querySelectorAll('.fb-card').forEach((card) => {
      const it = items.find((x) => x.id === card.dataset.id);
      card.querySelectorAll('[data-star]').forEach((b) => b.onclick = () => {
        const n = Number(b.dataset.star); it.admin_rating = it.admin_rating === n ? null : n;
        card.querySelectorAll('[data-star]').forEach((s) => { s.classList.toggle('on', Number(s.dataset.star) <= (it.admin_rating || 0)); s.setAttribute('aria-checked', String(Number(s.dataset.star) === it.admin_rating)); });
      });
      card.querySelector('[data-fbsave]').onclick = async (e) => {
        const m = card.querySelector('[data-fbmsg]'); e.target.disabled = true;
        const body = { id: it.id, status: card.querySelector('[data-fbs]').value, adminRating: it.admin_rating ?? null, adminNote: card.querySelector('[data-fbn]').value, answer: card.querySelector('[data-fba]').value };
        const x = await api('/api/admin/feedback', { method: 'PATCH', body: JSON.stringify(body) });
        e.target.disabled = false;
        if (x.ok) { Object.assign(it, { status: body.status, admin_note: body.adminNote, answer: body.answer }); m.textContent = 'Gespeichert.'; setTimeout(paint, 600); } else m.textContent = x.data?.error || 'Fehler';
      };
    });
  };
  paint();
}

// System → Google-Bewertungen: Bewertungslink und Place-ID eintragen (Durchschnitt und Anzahl kommen live von Google).
export async function reviewsAdmin(v) {
  const r = await api('/api/admin/reviews');
  if (!r.ok) return;
  const d = r.data;
  const box = document.createElement('section');
  box.className = 'pt-card'; box.id = 'rvAdmin';
  box.innerHTML = `<h2>Google-Bewertungen</h2>
    <ol class="ad-steps"><li>Google-Unternehmensprofil anlegen: <a href="https://business.google.com" target="_blank" rel="noopener">business.google.com</a> (Dienstleistungsunternehmen ohne Ladengeschäft, Adresse ausblenden möglich).</li>
      <li>Im Profil „Nach Rezensionen fragen“ wählen und den Link (https://g.page/r/…) hier eintragen – dann erscheint im Konto und im Unternehmensportal „Bei Google bewerten“.</li>
      <li>Optional für Sterne auf der Website: Place-ID eintragen (<a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener">Place-ID-Finder</a>) und in Vercel GOOGLE_PLACES_API_KEY setzen.</li></ol>
    <form id="rvF" class="ad-grid2"><label>Bewertungslink<input name="reviewUrl" type="url" value="${esc(d.reviewUrl || '')}" placeholder="https://g.page/r/…"></label><label>Place-ID (optional)<input name="placeId" value="${esc(d.placeId || '')}" placeholder="ChIJ…"></label>
      <div><button class="btn btn-dark" type="submit">Speichern</button> <span class="form-note" id="rvMsg" role="status"></span></div></form>
    <p class="form-note">Stand: ${d.rating ? `★ ${String(d.rating).replace('.', ',')} aus ${d.count} Google-Bewertungen` : d.placeId ? (d.apiKey ? 'Google liefert noch keine Bewertungen.' : 'GOOGLE_PLACES_API_KEY fehlt in Vercel.') : 'Noch keine Place-ID – auf der Website erscheinen keine Sterne.'} · Regeln: keine Gegenleistung für Bewertungen, alle Kunden gleich fragen, keine eigenen oder gekauften Bewertungen.</p>`;
  v.append(box);
  box.querySelector('#rvF').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const x = await api('/api/admin/reviews', { method: 'POST', body: JSON.stringify(f) });
    box.querySelector('#rvMsg').textContent = x.ok ? 'Gespeichert.' : x.data?.error || 'Fehler';
  };
}

// Nutzer (B2C) → „Zugriff freischalten“: Werkzeuge unabhängig vom bezahlten Tarif freigeben, befristet oder dauerhaft.
export async function accessDialog(userId, mail, msg = () => {}) {
  const r = await api('/api/admin/access?user=' + encodeURIComponent(userId));
  if (!r.ok) { msg(r.data?.error || 'Nicht verfügbar.', true); return; }
  const g = r.data.grant;
  let d = document.getElementById('accDlg');
  if (!d) { d = document.createElement('dialog'); d.id = 'accDlg'; d.className = 'ad-dlg'; document.body.append(d); }
  const until = g?.valid_until ? String(g.valid_until).slice(0, 10) : '';
  d.innerHTML = `<form method="dialog" class="acc-f">
    <h2>Zugriff freischalten</h2><p class="form-note">${esc(mail)} · ${g ? `aktuell: <b>${g.tier === 'pro' ? 'Alle Werkzeuge (wie Investor Pro)' : 'Kauf-Werkzeuge (wie Käufer-Pass)'}</b>, seit ${dtt(g.updated_at)} von ${esc(g.granted_by)}` : 'bisher nur der bezahlte Tarif'}</p>
    <fieldset class="acc-t"><legend>Freigeschaltete Werkzeuge</legend>
      <label class="chk"><input type="radio" name="tier" value="starter"${g?.tier !== 'pro' ? ' checked' : ''}> <span><b>Kauf-Werkzeuge</b> – wie Käufer-Pass: Objekte unbegrenzt, Bankangebote vergleichen, Bankgespräch, Druck/PDF</span></label>
      <label class="chk"><input type="radio" name="tier" value="pro"${g?.tier === 'pro' ? ' checked' : ''}> <span><b>Alle Werkzeuge</b> – wie Investor Pro: zusätzlich Portfolio, Anschluss & Forward, Betriebskosten, Kreditmappen unbegrenzt</span></label></fieldset>
    <div class="ad-grid2"><label>Zusätzliche Kreditmappen<input name="creditMaps" type="number" min="0" max="1000" value="${Number(g?.credit_maps || 0)}"></label>
      <label>Gültig bis (leer = unbefristet)<input name="validUntil" type="date" value="${esc(until)}"></label></div>
    <label class="chk"><input type="checkbox" name="leitfaden"${g?.leitfaden ? ' checked' : ''}> Notar-Checkliste & Verhandlungsleitfaden freischalten</label>
    <label>Interne Notiz (z. B. Grund)<textarea name="note" rows="2" maxlength="500">${esc(g?.note || '')}</textarea></label>
    <p class="form-note">Der Kunde sieht die Werkzeuge nach dem nächsten Neuladen. Bezahlte Tarife bleiben unberührt; es gilt die höhere Stufe. Jede Änderung wird protokolliert.</p>
    <div class="pt-row"><button class="btn btn-dark" type="button" id="accSave">Speichern</button>${g ? '<button class="btn btn-outline" type="button" id="accDel">Freischaltung entfernen</button>' : ''}<button class="btn btn-ghost" value="x">Abbrechen</button></div>
    <p class="form-note" id="accMsg" role="status"></p></form>`;
  const f = d.querySelector('form');
  d.querySelector('#accSave').onclick = async () => {
    const fd = new FormData(f);
    const body = { user: userId, tier: fd.get('tier'), creditMaps: Number(fd.get('creditMaps') || 0), leitfaden: fd.get('leitfaden') === 'on', validUntil: fd.get('validUntil') || null, note: String(fd.get('note') || '') };
    const x = await api('/api/admin/access', { method: 'POST', body: JSON.stringify(body) });
    if (x.ok) { d.close(); msg(`Zugriff für ${mail} gespeichert.`); } else d.querySelector('#accMsg').textContent = x.data?.error || 'Fehler';
  };
  d.querySelector('#accDel')?.addEventListener('click', async () => {
    if (!confirm('Manuelle Freischaltung entfernen? Es gilt dann nur noch der bezahlte Tarif.')) return;
    const x = await api('/api/admin/access?user=' + encodeURIComponent(userId), { method: 'DELETE' });
    if (x.ok) { d.close(); msg(`Freischaltung für ${mail} entfernt.`); } else d.querySelector('#accMsg').textContent = x.data?.error || 'Fehler';
  });
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
}
