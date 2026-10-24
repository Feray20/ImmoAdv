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

// Warte-Signal: Ein Knopf, der während eines Vorgangs gesperrt ist und „… “ zeigt (z. B. „Wird gesendet …“),
// bekommt automatisch den drehenden ImmoAdv-Ring – überall auf der Website, ohne Änderungen an den einzelnen Formularen.
(() => {
  if (window.__iaBusy) return;
  window.__iaBusy = true;
  const css = '.ia-busy{position:relative;cursor:progress!important;opacity:.9!important}.ia-busy::after{content:"";display:inline-block;width:1em;height:1em;margin-left:.55em;vertical-align:-.15em;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;opacity:.75;animation:iaBusySpin .75s linear infinite}@keyframes iaBusySpin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.ia-busy::after{animation-duration:2s}}';
  const st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);
  const check = (b) => { const on = b.disabled && /…\s*$/.test(b.textContent || ''); b.classList.toggle('ia-busy', on); if (on) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy'); };
  const scan = (root) => { if (root.nodeType !== 1) return; if (root.matches('button, .btn')) check(root); root.querySelectorAll?.('button:disabled').forEach(check); };
  const start = () => new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'attributes') check(m.target); else if (m.type === 'characterData') { const b = m.target.parentElement?.closest('button'); if (b) check(b); } else { const b = m.target.closest?.('button'); if (b) check(b); m.addedNodes.forEach(scan); } } })
    .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['disabled'] });
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
