// Fußzeile für Seiten ohne menu.js (Datenraum, Prüfansicht): ab Tablet-Breite alle Spalten offen, am Handy nur eine.
(function(){var mq=window.matchMedia&&matchMedia('(min-width:761px)');if(!mq)return;
var all=function(){return document.querySelectorAll('footer .foot-col')};
var set=function(){all().forEach(function(d){if(mq.matches)d.setAttribute('open','');else d.removeAttribute('open')})};
document.addEventListener('toggle',function(e){var d=e.target;if(mq.matches||!d.classList||!d.classList.contains('foot-col')||!d.open)return;all().forEach(function(x){if(x!==d)x.open=false})},true);
document.addEventListener('click',function(e){if(mq.matches&&e.target.closest&&e.target.closest('footer .foot-col>summary'))e.preventDefault()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',set);else set();if(mq.addEventListener)mq.addEventListener('change',set)})();
