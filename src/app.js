document.addEventListener('DOMContentLoaded',()=>{
  const $=s=>document.querySelector(s);
  const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
  const pct=n=>`${n.toFixed(2).replace('.',',')} %`;

  function calculate(){
    const form=$('#calcForm');
    if(!form)return;
    const f=new FormData(form);const v=Object.fromEntries(f.entries());
    const price=+v.price||0,rent=+v.rent||0,costs=+v.purchaseCosts||0,maint=+v.maintenance||0,equity=+v.equity||0,interest=(+v.interest||0)/100,repayment=(+v.repayment||0)/100,ltv=(+v.ltv||0)/100,tax=(+v.tax||0)/100,afa=(+v.afa||0)/100,afaRate=(+v.afaRate||0)/100,vacancy=(+v.vacancy||0)/100;
    const effectiveRent=rent*(1-vacancy),grossYield=price?rent/price:0,loan=price*ltv,debt=loan*(interest+repayment),building=price*afa,depreciation=building*afaRate,deductibleInterest=loan*interest,taxable=Math.max(0,effectiveRent-maint-deductibleInterest-depreciation),taxAmount=taxable*tax,cashAfterTax=effectiveRent-maint-debt-taxAmount,netYield=price?(effectiveRent-maint)/price:0,invested=Math.max(1,equity+price*costs/100),equityReturn=cashAfterTax/invested,dscr=debt?Math.max(0,effectiveRent-maint)/debt:0;
    let score=50;if(grossYield>=.06)score+=12;else if(grossYield>=.05)score+=7;if(dscr>=1.25)score+=18;else if(dscr>=1.1)score+=10;if(ltv<=.8)score+=10;if(equity/Math.max(1,price)>=.2)score+=10;score=Math.min(100,Math.round(score));
    $('#afterTax')?.replaceChildren(document.createTextNode(euro(cashAfterTax/12)));
    $('#cashflowHint')?.replaceChildren(document.createTextNode(cashAfterTax>=0?'positiver modellierter Jahres-Cashflow':'negativer modellierter Jahres-Cashflow'));
    $('#yield')?.replaceChildren(document.createTextNode(pct(grossYield*100)));$('#netYield')?.replaceChildren(document.createTextNode(pct(netYield*100)));$('#debtService')?.replaceChildren(document.createTextNode(euro(debt)));$('#equityReturn')?.replaceChildren(document.createTextNode(pct(equityReturn*100)));$('#dscr')?.replaceChildren(document.createTextNode(dscr.toFixed(2).replace('.',',')));$('#bankScore')?.replaceChildren(document.createTextNode(`${score} / 100`));
    const note=$('#resultNote');if(note)note.textContent=`Modelliert mit ${euro(loan)} Darlehen, ${euro(depreciation)} AfA p.a. und ${pct(tax*100)} Grenzsteuersatz. Keine Kredit- oder Steuerzusage.`;
  }

  const form=$('#calcForm');
  form?.addEventListener('input',calculate);form?.addEventListener('submit',e=>{e.preventDefault();calculate()});
  $('#printBtn')?.addEventListener('click',()=>window.print());
  document.querySelectorAll('[data-scroll]').forEach(b=>b.addEventListener('click',()=>document.querySelector(b.dataset.scroll)?.scrollIntoView({behavior:'smooth'})));
  const toast=$('#toast');let toastTimer;
  document.querySelectorAll('[data-toast]').forEach(b=>b.addEventListener('click',()=>{if(!toast)return;toast.textContent=b.dataset.toast;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3200)}));
  const menu=$('.mobile-menu'),nav=$('.mobile-nav');
  menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));if(nav)nav.hidden=open});
  nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.hidden=true;menu?.setAttribute('aria-expanded','false')}));
  calculate();
});
