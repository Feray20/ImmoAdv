// Klapptexte: Lange Erklärtexte bleiben vollständig vorhanden, werden aber auf 2 Zeilen eingeklappt
// und lassen sich mit „Mehr anzeigen“ aufklappen. Gilt auf allen Seiten und in allen Bereichen
// (Privatbereich, Unternehmensportal, Web-Admin, Rechner) – auch für Inhalte, die erst per Skript entstehen.
// Ausgenommen: Rechtstexte und Wissens-Artikel (dort ist der Text der Inhalt), Fehlermeldungen und Hinweise,
// die sofort vollständig sichtbar sein müssen (role=alert/status, aria-live), Formulare, Tabellen, Navigation.
// Einzelne Blöcke lassen sich mit data-noklapp ausnehmen.
(() => {
  if (window.__iaKlapp) return;
  window.__iaKlapp = true;
  const P = location.pathname.replace(/\/+$/, '') || '/';
  if (/^\/(impressum|datenschutz|nutzungsbedingungen|widerrufen|kuendigen|sicherheit)$/.test(P)) return;
  if (/^\/wissen\/(?!glossar$|erwerbsstatus$)[a-z0-9-]+$/.test(P)) return;

  const MIN = 140; // ab dieser Textlänge einklappen
  const BLOCK = new Set(['P', 'DIV', 'UL', 'OL', 'DL', 'TABLE', 'FORM', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'DETAILS', 'SECTION', 'ARTICLE', 'ASIDE', 'NAV', 'HEADER', 'FOOTER', 'LABEL', 'FIGURE', 'IMG', 'SVG', 'CANVAS', 'IFRAME', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'FIELDSET', 'VIDEO', 'A']);
  const SKIP = 'nav,header,footer,summary,label,button,table,form,dialog form,pre,code,[contenteditable],[role=alert],[role=status],[aria-live],.toast,.auth-message,.ia-legal,.mobile-nav,[class*=hero],[data-noklapp],.ia-kl-btn,.ia-kl';
  const leaf = (el) => { for (const c of el.children) { if (BLOCK.has(c.tagName) && !(c.tagName === 'A' && c.textContent.length < 80)) return false; } return true; };
  const toggle = (el, btn, open) => {
    el.classList.toggle('ia-kl-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.firstChild.textContent = open ? 'Weniger anzeigen' : 'Mehr anzeigen';
  };
  let n = 0;
  const scan = () => {
    const root = document.querySelector('main') || document.body;
    for (const el of root.querySelectorAll('p, div, blockquote')) {
      if (el.dataset.kl) continue;
      const len = (el.textContent || '').replace(/\s+/g, ' ').trim().length;
      if (len < MIN) { continue; }
      if (!leaf(el) || el.parentElement?.closest(SKIP) || el.matches(SKIP)) { el.dataset.kl = 'x'; continue; }
      if (!el.offsetParent || !el.clientWidth) continue; // noch unsichtbar – später erneut prüfen
      // Text in einen inneren Block legen: der wird eingeklappt, Rahmen/Abstände des Kastens bleiben unberührt,
      // und der Knopf steht im Kasten direkt unter dem Text.
      const t = document.createElement('span');
      t.className = 'ia-kl';
      while (el.firstChild) t.appendChild(el.firstChild);
      el.appendChild(t);
      if (t.scrollHeight <= t.clientHeight + 4) { while (t.firstChild) el.insertBefore(t.firstChild, t); t.remove(); el.dataset.kl = 'x'; continue; }
      el.dataset.kl = '1';
      el.classList.add('ia-kl-host');
      const id = t.id = 'ia-kl-' + (++n);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ia-kl-btn';
      btn.setAttribute('aria-controls', id);
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = 'Mehr anzeigen<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      el.appendChild(btn);
    }
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('.ia-kl-btn');
    if (btn) { const el = document.getElementById(btn.getAttribute('aria-controls')); if (el) toggle(el, btn, !el.classList.contains('ia-kl-open')); return; }
    // Tippen auf den eingeklappten Text klappt ihn ebenfalls auf (Links im Text funktionieren weiter).
    const el = e.target.closest?.('.ia-kl:not(.ia-kl-open)');
    if (el && !e.target.closest('a,button,input,select,textarea')) { const b = el.nextElementSibling; if (b?.classList.contains('ia-kl-btn')) toggle(el, b, true); }
  });
  let t = 0;
  const later = () => { clearTimeout(t); t = setTimeout(() => requestAnimationFrame(scan), 120); };
  const start = () => {
    scan();
    new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
    addEventListener('hashchange', later);
    document.addEventListener('click', later); // aufgeklappte Bereiche (z. B. Tool geöffnet) nachträglich prüfen
    addEventListener('resize', later);
    addEventListener('load', later);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('beforeprint', () => document.querySelectorAll('.ia-kl').forEach((el) => el.classList.add('ia-kl-open')));
})();
