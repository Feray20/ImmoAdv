// Mobiles Menü für alle Seiten: Vollbild-Blatt unter der Kopfzeile.
// Ereignis-Delegation, damit es auch auf Seiten funktioniert, die ihren Inhalt erst per Skript aufbauen.
(() => {
  const label = (btn, open) => {
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    const t = btn.querySelector('.mm-text');
    if (t) t.textContent = open ? 'Schließen' : 'Menü';
  };
  const setOpen = (open) => {
    const btn = document.querySelector('.mobile-menu');
    const nav = document.querySelector('.mobile-nav');
    if (!btn || !nav) return;
    // Blatt direkt unter der Kopfzeile beginnen lassen (Höhe je nach Breite verschieden).
    const head = btn.closest('header');
    if (open && head) nav.style.top = Math.max(0, Math.round(head.getBoundingClientRect().bottom)) + 'px';
    nav.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    label(btn, open);
    if (open) nav.querySelector('a')?.focus({ preventScroll: true });
  };
  const mark = () => {
    const here = location.pathname.replace(/\/+$/, '') || '/';
    document.querySelectorAll('.mobile-nav a, .desktop-nav a').forEach((a) => {
      if ((a.getAttribute('href') || '').replace(/\/+$/, '') === here) a.setAttribute('aria-current', 'page');
    });
    const btn = document.querySelector('.mobile-menu');
    if (btn && !btn.querySelector('.mm-text')) {
      btn.innerHTML = '<span class="mm-icon" aria-hidden="true"></span><span class="mm-text">Menü</span>';
      btn.setAttribute('aria-expanded', 'false');
    }
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.mobile-menu');
    if (btn) {
      e.preventDefault();
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
      return;
    }
    if (e.target.closest('.mobile-nav a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
      setOpen(false);
      document.querySelector('.mobile-menu')?.focus();
    }
  });
  // Beim Wechsel auf Desktopbreite Menü schließen.
  matchMedia('(min-width: 901px)').addEventListener?.('change', (m) => m.matches && setOpen(false));
  // Seiten, die ihren Kopf erst per Skript schreiben: nach dem Aufbau markieren.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mark, 0));
  else setTimeout(mark, 0);
  new MutationObserver(() => { if (document.querySelector('.mobile-menu:not(:has(.mm-text))')) mark(); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
