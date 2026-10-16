// Startseite: Immobiliensuche öffnet die Trefferlisten der Portale (keine Inhalte von Portalen auf ImmoAdv).
import { portalLinks } from './calc.mjs';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const IDS = ['h_art', 'h_ort', 'h_land', 'h_pmin', 'h_price', 'h_area', 'h_rooms'];
const form = $('homeSearch'), box = $('homePortals');
if (form && box) {
  try { const s = JSON.parse(localStorage.getItem('ia-home-search') || '{}'); IDS.forEach((id) => { if (s[id] != null && $(id)) $(id).value = s[id]; }); } catch { /* ohne Speicher */ }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ort = $('h_ort').value.trim();
    if (!ort) { $('h_ort').focus(); return; }
    try { localStorage.setItem('ia-home-search', JSON.stringify(Object.fromEntries(IDS.map((id) => [id, $(id).value])))); } catch { /* ohne Speicher */ }
    const links = portalLinks({ land: $('h_land').value, kreis: '', ort, art: $('h_art').value, minPrice: Number($('h_pmin').value) || 0, maxPrice: Number($('h_price').value) || 0, minArea: Number($('h_area').value) || 0, minRooms: Number($('h_rooms').value) || 0 });
    const q = new URLSearchParams({ ort, land: $('h_land').value, art: $('h_art').value, ...Object.fromEntries([['preisab', 'h_pmin'], ['preis', 'h_price'], ['flaeche', 'h_area'], ['zimmer', 'h_rooms']].filter(([, id]) => $(id).value).map(([k, id]) => [k, $(id).value])) });
    box.innerHTML = links.map((l) => `<a class="hp-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer nofollow"><strong>${l.name} ↗</strong><span>Übergeben: ${esc(l.filters)}</span></a>`).join('') +
      `<a class="hp-link hp-app" href="/app/dashboard?${q}#suche"><strong>Mehr Filter und Analyse</strong><span>in der Anwendung →</span></a>`;
    box.hidden = false;
    box.querySelector('a')?.focus();
  });
}
