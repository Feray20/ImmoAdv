// Web-Admin → Verbesserungsvorschläge: Eingang je Bereich (B2C oder B2B), Bewertung mit Sternen, Status, Antwort.
import { api, dtt, esc } from './sess.mjs';

const TOPICS = { bedienung: 'Bedienung & Navigation', rechner: 'Rechner & Kennzahlen', kreditmappe: 'Kreditmappe & Dokumente', inhalte: 'Inhalte & Erklärungen', neue_funktion: 'Neue Funktion', fehler: 'Fehler gefunden', sonstiges: 'Sonstiges' };
const STATUS = { neu: 'Neu', in_pruefung: 'In Prüfung', geplant: 'Geplant', umgesetzt: 'Umgesetzt', abgelehnt: 'Nicht geplant' };
const stars = (n, name = '') => `<span class="fb-stars"${name ? ` role="radiogroup" aria-label="${name}"` : ''}>${[1, 2, 3, 4, 5].map((k) => name ? `<button type="button" data-star="${k}" aria-label="${k} von 5" aria-checked="${k === n}" role="radio" class="${k <= (n || 0) ? 'on' : ''}">★</button>` : `<i class="${k <= n ? 'on' : ''}">★</i>`).join('')}</span>`;

export async function vorschlaege(v, seg) {
  const r = await api('/api/admin/feedback');
  if (!r.ok) { v.innerHTML = `<p class="form-note">${esc(r.data?.error || 'Nicht verfügbar.')}</p>`; return; }
  const items = r.data.items || [];
  let filter = 'offen';
  const paint = () => {
    const list = items.filter((x) => filter === 'alle' ? true : filter === 'offen' ? ['neu', 'in_pruefung'].includes(x.status) : x.status === filter);
    const cnt = (f) => items.filter((x) => f === 'alle' ? true : f === 'offen' ? ['neu', 'in_pruefung'].includes(x.status) : x.status === f).length;
    v.innerHTML = `<section class="pt-card"><h2>Verbesserungsvorschläge · ${seg === 'b2b' ? 'Unternehmen' : 'Privatkunden'}</h2>
      <p class="form-note">Vorschläge aus dem ${seg === 'b2b' ? 'Unternehmensportal' : 'Privatbereich'}. Die Wichtigkeit gibt der Kunde an; Ihre Bewertung und Notiz sind nur hier sichtbar. Eine Antwort sieht der Kunde bei seinen Vorschlägen.</p>
      <div class="pc-chips" role="group" aria-label="Filter">${[['offen', 'Offen'], ['geplant', 'Geplant'], ['umgesetzt', 'Umgesetzt'], ['abgelehnt', 'Nicht geplant'], ['alle', 'Alle']].map(([k, l]) => `<button type="button" data-fbf="${k}" aria-pressed="${k === filter}">${l} <b>${cnt(k)}</b></button>`).join('')}</div>
      ${list.length ? `<div class="fb-list">${list.map((x) => `<article class="fb-card" data-id="${x.id}">
        <header><div><strong>${esc(TOPICS[x.topic] || x.topic)}</strong><small>${dtt(x.created_at)} · ${esc(x.company ? `${x.company} · ` : '')}${esc(x.email || 'Konto')}${x.page ? ` · ${esc(x.page)}` : ''}</small></div><span class="st ${x.status === 'umgesetzt' ? 'ok' : x.status === 'abgelehnt' ? 'bad' : x.status === 'neu' ? 'warn' : ''}">${STATUS[x.status]}</span></header>
        <p class="fb-text">${esc(x.text)}</p>
        <div class="fb-meta"><span>Wichtigkeit für den Kunden ${stars(x.importance)}</span></div>
        <div class="fb-admin"><label>Ihre Bewertung ${stars(x.admin_rating, 'Ihre Bewertung')}</label>
          <label>Status<select data-fbs>${Object.entries(STATUS).map(([k, l]) => `<option value="${k}"${k === x.status ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="fb-wide">Interne Notiz<textarea data-fbn rows="2" maxlength="2000" placeholder="z. B. Aufwand, Idee zur Umsetzung">${esc(x.admin_note || '')}</textarea></label>
          <label class="fb-wide">Antwort an den Kunden (optional)<textarea data-fba rows="2" maxlength="2000" placeholder="Wird beim Kunden unter seinen Vorschlägen angezeigt">${esc(x.answer || '')}</textarea></label>
          <button class="btn btn-dark" type="button" data-fbsave>Speichern</button><span class="form-note" data-fbmsg role="status"></span></div>
      </article>`).join('')}</div>` : '<div class="pt-empty"><strong>Keine Vorschläge in dieser Auswahl.</strong></div>'}</section>`;
    v.querySelectorAll('[data-fbf]').forEach((b) => b.onclick = () => { filter = b.dataset.fbf; paint(); });
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
