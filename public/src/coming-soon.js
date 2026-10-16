// Rückmeldung für das Zugang-Passwort auf der „Coming soon“-Seite (CSP: externes Skript statt inline).
(function () {
  var p = new URLSearchParams(location.search).get('zugang');
  var m = document.getElementById('accMsg');
  if (m) {
    if (p === 'falsch') m.textContent = 'Passwort falsch. Bitte erneut versuchen.';
    else if (p === 'gesperrt') m.textContent = 'Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.';
  }
  if (p) { try { history.replaceState(null, '', '/'); } catch (e) { /* egal */ } }
  var pw = document.getElementById('pw');
  if (pw) pw.focus();
})();
