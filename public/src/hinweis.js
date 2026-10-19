// Datenschutz-Hinweis (DSGVO / § 25 TDDDG): ImmoAdv setzt keine Tracking-, Analyse- oder Werbe-Cookies.
// Gespeichert wird nur, was technisch unbedingt nötig ist (Anmeldung, Fortschritt) – dafür ist keine Einwilligung
// erforderlich. Deshalb ein kurzer, nicht blockierender Hinweis statt eines Einwilligungs-Banners.
// Einmal geschlossen, erscheint er auf diesem Gerät nicht wieder (Merkmal im lokalen Speicher, unbedingt erforderlich).
(() => {
  if (window.__iaHinweis) return;
  window.__iaHinweis = true;
  const KEY = 'ia-privacy-ok';
  const P = location.pathname;
  if (/^\/(intern|datenschutz|impressum)/.test(P) || navigator.webdriver) return;
  try { if (localStorage.getItem(KEY)) return; } catch { return; }
  const show = () => {
    if (document.getElementById('iaPriv')) return;
    const el = document.createElement('div');
    el.id = 'iaPriv';
    el.className = 'ia-priv';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Datenschutz-Hinweis');
    el.setAttribute('data-noklapp', '');
    el.innerHTML = '<p><strong>Keine Tracking-Cookies.</strong> ImmoAdv speichert nur, was für Anmeldung und Fortschritt technisch nötig ist – ohne Werbung, ohne Google Analytics, Server in Frankfurt. <a href="/datenschutz">Datenschutzerklärung</a></p><button type="button" class="ia-priv-ok">Verstanden</button>';
    el.querySelector('button').onclick = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ohne Speicher */ } el.remove(); };
    document.body.appendChild(el);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(show, 600)); else setTimeout(show, 600);
})();
