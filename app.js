/* ===================== Speicher mit Rückfallebene ===================== */
/* Alle Schlüssel tragen den Präfix „kasse." — die Spanisch-App liegt auf derselben Adresse
   (philippwirtz.github.io) und teilt sich localStorage mit dieser App. */
const mem={};
const P='kasse.';
const raw={
  get(k){try{return localStorage.getItem(k)}catch(e){return mem[k]??null}},
  set(k,v){try{localStorage.setItem(k,v)}catch(e){mem[k]=v}},
  del(k){try{localStorage.removeItem(k)}catch(e){delete mem[k]}}
};
const store={ get:k=>raw.get(P+k), set:(k,v)=>raw.set(P+k,v) };
function loadJ(k,d){ try{ const v=store.get(k); return v===null?d:JSON.parse(v); }catch(e){ return d; } }
const saveJ=(k,v)=>store.set(k,JSON.stringify(v));

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const isoDay=(d=new Date())=>new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const initial=n=>(String(n||'?').trim()[0]||'?').toUpperCase();

/* ===================== Thema ===================== */
const html=document.documentElement;
const savedTheme=store.get('theme');
if(savedTheme) html.dataset.theme=savedTheme;
function themeMeta(){
  const cur=html.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
  document.querySelector('meta[name=theme-color]').content=cur==='dark'?'#0F1C16':'#F1F3EE';
}
$('theme').onclick=()=>{
  const cur=html.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
  const next=cur==='dark'?'light':'dark';
  html.dataset.theme=next; store.set('theme',next); themeMeta();
};
themeMeta();

/* ===================== Geld ===================== */
const CURS=['EUR','USD','CRC','CHF','GBP','CAD','MXN','DKK','SEK','NOK','PLN','CZK','HUF','JPY','THB','AUD'];
const fmtCache={};
function money(cents,cur){
  const f=fmtCache[cur]||(fmtCache[cur]=new Intl.NumberFormat('de-DE',{style:'currency',currency:cur,minimumFractionDigits:2,maximumFractionDigits:2}));
  return f.format((cents||0)/100).replace(/ /g,' ');
}
const moneyAbs=(c,cur)=>money(Math.abs(c),cur);
/* Eingabe lesen: „12,50", „12.50", „1.234,56", „1,234.56", auch „12+8,50" für Belege mit mehreren Posten */
function parseNum(s){
  s=String(s||'').replace(/[\s €$]/g,'');
  if(!s) return NaN;
  if(/[+]/.test(s)) return s.split('+').reduce((a,x)=>a+parseNum(x),0);
  const hasC=s.includes(','), hasD=s.includes('.');
  if(hasC&&hasD){ if(s.lastIndexOf(',')>s.lastIndexOf('.')) s=s.replace(/\./g,'').replace(',','.'); else s=s.replace(/,/g,''); }
  else if(hasC) s=s.replace(/\.(?=\d{3})/g,'').replace(',','.');
  else if(hasD && /^\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
  const n=Number(s); return isFinite(n)?n:NaN;
}
const toCents=s=>{ const n=parseNum(s); return isNaN(n)?NaN:Math.round(n*100); };
const centsStr=c=>(c/100).toFixed(2).replace('.',',');
const numStr=(n,d=4)=>String(+n.toFixed(d)).replace('.',',');

/* Betrag T auf Gewichte verteilen — Rest-Cent nach größtem Bruchteil, Summe stimmt immer exakt */
function allocate(T,weights){
  const ids=Object.keys(weights).filter(k=>weights[k]>0), W=ids.reduce((a,k)=>a+weights[k],0);
  const out={}; if(!ids.length||W<=0) return out;
  let used=0; const fr=[];
  ids.forEach((k,i)=>{ const exact=T*weights[k]/W, f=Math.floor(exact); out[k]=f; used+=f; fr.push([exact-f,i,k]); });
  fr.sort((a,b)=>b[0]-a[0]||a[1]-b[1]);
  for(let i=0;i<T-used;i++) out[fr[i%fr.length][2]]++;
  return out;
}

/* ===================== Kategorien ===================== */
const CATS=[
  ['food','🍽','Essen'],['shop','🛒','Einkauf'],['home','🏠','Wohnen'],['util','💡','Nebenkosten'],
  ['trans','🚕','Transport'],['car','⛽','Auto'],['hotel','🏨','Unterkunft'],['travel','✈️','Reise'],
  ['fun','🎟','Freizeit'],['gift','🎁','Geschenke'],['health','🩺','Gesundheit'],['other','📦','Sonstiges']
];
const CAT=Object.fromEntries(CATS.map(c=>[c[0],{ico:c[1],lbl:c[2]}]));
const CAT_GUESS=[
  [/essen|restaurant|abend|mittag|frühstück|pizza|café|cafe|kaffee|bar|soda|bier|cerveza|brunch|döner|sushi/i,'food'],
  [/rewe|edeka|aldi|lidl|einkauf|supermarkt|dm\b|rossmann|markt|lebensmittel|automercado|walmart/i,'shop'],
  [/miete|wohnung|möbel|ikea|haushalt/i,'home'],
  [/strom|gas|wasser|internet|handy|netflix|spotify|abo|versicherung|rundfunk/i,'util'],
  [/taxi|uber|bus|bahn|zug|ticket|fähre|transfer|shuttle|parken|maut/i,'trans'],
  [/tank|benzin|sprit|mietwagen|auto|werkstatt/i,'car'],
  [/hotel|airbnb|unterkunft|hostel|lodge|übernachtung|booking/i,'hotel'],
  [/flug|flight|gepäck|visum/i,'travel'],
  [/kino|tour|eintritt|museum|ausflug|rafting|zipline|surf|park|konzert|tickets/i,'fun'],
  [/geschenk|hochzeit|geburtstag|blumen/i,'gift'],
  [/apotheke|arzt|medikament/i,'health']
];

/* ===================== Daten ===================== */
/* Jede Gruppe, jedes Mitglied, jede Ausgabe und jeder Ausgleich ist ein eigener Datensatz mit
   Änderungszeit u. Beim Abgleich gewinnt pro Datensatz der neuere Stand; Löschen setzt del:true
   (Grabstein), damit es sich auf alle Geräte überträgt. */
let DB=loadJ('db',null); if(!DB||typeof DB.recs!=='object') DB={recs:{}};
let DEV=loadJ('dev',null);
if(!DEV){ DEV={id:uid(),name:/iPhone/.test(navigator.userAgent)?'iPhone':/iPad/.test(navigator.userAgent)?'iPad':'Browser'}; saveJ('dev',DEV); }
let ME=loadJ('me',{});              // pro Gruppe: welches Mitglied bin ich auf diesem Gerät
let MYNAME=store.get('name')||'';
const saveDB=()=>saveJ('db',DB);
function put(rec){
  const old=DB.recs[rec.id], now=Date.now();
  rec.c=rec.c||(old&&old.c)||now;
  rec.u=Math.max(now,((old&&old.u)||0)+1);
  rec.by=MYNAME||DEV.name; rec.dev=DEV.id;
  DB.recs[rec.id]=rec; saveDB(); scheduleSync();
  return rec;
}
const del=id=>{ const r=DB.recs[id]; if(r) put({...r,del:true}); };
const recs=t=>Object.values(DB.recs).filter(r=>r.t===t&&!r.del);
const groups=()=>recs('g').sort((a,b)=>lastAct(b.id)-lastAct(a.id)||a.c-b.c);
const membersOf=g=>recs('m').filter(m=>m.g===g).sort((a,b)=>(a.ord??a.c)-(b.ord??b.c)||a.c-b.c);
const allMembersOf=g=>Object.values(DB.recs).filter(r=>r.t==='m'&&r.g===g);   // auch entfernte, für alte Ausgaben
const expensesOf=g=>recs('e').filter(e=>e.g===g);
const paymentsOf=g=>recs('p').filter(p=>p.g===g);
function lastAct(g){ let t=0; for(const r of Object.values(DB.recs)) if((r.g===g||r.id===g)&&r.u>t) t=r.u; return t; }
function nameOf(mid){ const m=DB.recs[mid]; return m?m.name+(m.del?' (entfernt)':''):'?'; }
const meIn=g=>{ const id=ME[g]; return id&&DB.recs[id]&&!DB.recs[id].del?id:null; };
function autoMe(g){                  // Mitglied mit meinem Namen automatisch zuordnen
  if(meIn(g)||!MYNAME) return meIn(g);
  const hit=membersOf(g).filter(m=>m.name.trim().toLowerCase()===MYNAME.trim().toLowerCase());
  if(hit.length===1){ ME[g]=hit[0].id; saveJ('me',ME); }
  return meIn(g);
}

/* ===================== Rechnen ===================== */
/* Anteile einer Ausgabe in Gruppenwährung (Cent). Ergebnis wird beim Speichern berechnet und mit abgelegt. */
function computeOwe(e){
  const w={};
  if(e.mode==='exact'){ for(const [k,v] of Object.entries(e.parts)) if(v>0) w[k]=v; }
  else for(const [k,v] of Object.entries(e.parts)) if(v>0) w[k]=e.mode==='eq'?1:v;
  return allocate(e.base,w);
}
function balances(g){
  const bal={}; membersOf(g).forEach(m=>bal[m.id]=0);
  for(const e of expensesOf(g)){
    bal[e.payer]=(bal[e.payer]||0)+e.base;
    for(const [k,v] of Object.entries(e.owe||{})) bal[k]=(bal[k]||0)-v;
  }
  for(const p of paymentsOf(g)){ bal[p.from]=(bal[p.from]||0)+p.amt; bal[p.to]=(bal[p.to]||0)-p.amt; }
  return bal;
}
/* Schulden vereinfachen: größter Schuldner zahlt an größten Gläubiger — höchstens n−1 Überweisungen */
function settle(bal){
  const cr=[],db=[];
  for(const [k,v] of Object.entries(bal)){ if(v>0) cr.push([k,v]); else if(v<0) db.push([k,-v]); }
  const out=[];
  while(cr.length&&db.length){
    cr.sort((a,b)=>b[1]-a[1]); db.sort((a,b)=>b[1]-a[1]);
    const c=cr[0],d=db[0],x=Math.min(c[1],d[1]);
    out.push({from:d[0],to:c[0],amt:x});
    c[1]-=x; d[1]-=x; if(!c[1]) cr.shift(); if(!d[1]) db.shift();
  }
  return out;
}
function myEffect(e,me){              // was diese Ausgabe für mich bedeutet: + bekomme ich, − schulde ich
  if(!me) return null;
  const owe=(e.owe&&e.owe[me])||0;
  return (e.payer===me?e.base:0)-owe;
}

/* ===================== Tabs & Bildschirme ===================== */
let TAB='groups', CURG=null, GVIEW='list';
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
function tab(t){
  TAB=t;
  document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t));
  $('tab-groups').hidden=t!=='groups'; $('tab-act').hidden=t!=='act'; $('tab-set').hidden=t!=='set';
  if(t==='groups'){ if(!$('home').hidden) renderHome(); else if(!$('group').hidden) renderGroup(); }
  if(t==='act') renderAct();
  if(t==='set') renderSet();
  scrollTo(0,0);
}
const SCREENS=['home','group','edit','pay','gform'];
function show(id){ SCREENS.forEach(s=>$(s).hidden=s!==id); scrollTo(0,0); }
function rerender(){                   // nach Abgleich: sichtbaren Stand neu zeichnen, Formulare nicht anfassen
  if(TAB==='act') renderAct();
  if(TAB==='set') renderSet();
  if(TAB==='groups'){
    if(!$('home').hidden) renderHome();
    else if(!$('group').hidden){ if(!DB.recs[CURG]||DB.recs[CURG].del){ show('home'); renderHome(); } else renderGroup(); }
  }
}

/* ---------- Übersicht ---------- */
function renderHome(){
  const G=groups(), tot={}, get={}, owe={};
  const L=$('groupList'); L.innerHTML='';
  G.forEach(g=>{
    const me=autoMe(g.id), bal=balances(g.id), mine=me?bal[me]||0:null;
    const n=membersOf(g.id).length, ne=expensesOf(g.id).length;
    if(mine!==null){ tot[g.cur]=(tot[g.cur]||0)+mine; if(mine>0) get[g.cur]=(get[g.cur]||0)+mine; if(mine<0) owe[g.cur]=(owe[g.cur]||0)-mine; }
    const b=document.createElement('button'); b.className='grow';
    b.innerHTML='<span class="gico"></span><span class="gt"><b></b><small></small></span><span class="amt"><small></small><b></b></span>';
    b.querySelector('.gico').textContent=initial(g.name);
    b.querySelector('.gico').style.background=hue(g.id);
    b.querySelector('.gt b').textContent=g.name;
    b.querySelector('.gt small').textContent=n+(n===1?' Mitglied':' Mitglieder')+' · '+ne+(ne===1?' Ausgabe':' Ausgaben');
    const [lbl,cls,val]=mine===null?['wer bist du?','zero','']:mine>0?['du bekommst','pos',moneyAbs(mine,g.cur)]:mine<0?['du schuldest','neg',moneyAbs(mine,g.cur)]:['ausgeglichen','zero','✓'];
    b.querySelector('.amt small').textContent=lbl; const ab=b.querySelector('.amt b'); ab.textContent=val; ab.className=cls;
    b.onclick=()=>openGroup(g.id);
    L.appendChild(b);
  });
  const H=$('homeHero'), curs=Object.keys(tot);
  if(!G.length){
    H.innerHTML='<div class="hlbl">Willkommen</div><div class="hsub" style="margin-top:6px;font-size:14px;color:var(--ink)">Lege eine Gruppe an — zum Beispiel „Haushalt" oder „Costa Rica" — und trage dort ein, wer was bezahlt hat. Die App rechnet aus, wer wem wie viel schuldet.</div>';
  }else{
    const main=curs.length?curs.sort((a,b)=>Math.abs(tot[b])-Math.abs(tot[a]))[0]:'EUR', t=tot[main]||0;
    H.innerHTML='<div class="hlbl">Gesamtsaldo</div><div class="hbig '+(t>0?'pos':t<0?'neg':'zero')+'">'+(t>0?'+':t<0?'−':'')+esc(moneyAbs(t,main))+'</div>'+
      '<div class="hsub">'+(t>0?'Du bekommst unterm Strich Geld zurück.':t<0?'Du schuldest unterm Strich.':'Alles ausgeglichen.')+'</div>'+
      '<div class="kpis"><div class="kpi"><b class="pos">'+esc(money(get[main]||0,main))+'</b><span>du bekommst</span></div><div class="kpi"><b class="neg">'+esc(money(owe[main]||0,main))+'</b><span>du schuldest</span></div></div>'+
      (curs.length>1?'<p class="shint">Weitere Währungen: '+curs.filter(c=>c!==main).map(c=>esc((tot[c]>=0?'+':'−')+moneyAbs(tot[c],c))).join(' · ')+'</p>':'');
  }
  $('homeHint').textContent=!SYNC||!SYNC.gist?'Tipp: Unter Einstellungen mit GitHub verbinden, dann siehst du Ausgaben vom anderen iPhone automatisch.':'';
}
function hue(id){ let h=0; for(const ch of id) h=(h*31+ch.charCodeAt(0))%360;
  const dark=getComputedStyle(html).getPropertyValue('--bg').trim().toLowerCase()==='#0f1c16';
  return 'hsl('+h+' '+(dark?'45%':'48%')+' '+(dark?'62%':'34%')+')'; }

/* ---------- Gruppe ---------- */
function syncIfStale(){ if(SYNC&&SYNC.gist&&(!SYNC.last||Date.now()-SYNC.last>3e4)) syncNow(); }
function openGroup(id){ syncIfStale(); CURG=id; GVIEW='list'; $('q').value=''; $('clear').style.display='none'; show('group'); renderGroup(); }
$('gBack').onclick=()=>{ show('home'); renderHome(); };
$('gEdit').onclick=()=>openGroupForm(CURG);
document.querySelectorAll('#gSeg button').forEach(b=>b.onclick=()=>{ GVIEW=b.dataset.v; renderGroup(); });
$('q').oninput=()=>{ $('clear').style.display=$('q').value?'block':'none'; renderList(); };
$('clear').onclick=()=>{ $('q').value=''; $('clear').style.display='none'; renderList(); $('q').focus(); };
$('addExp').onclick=()=>openExpense(CURG,null);
$('addPay').onclick=()=>openPayment(CURG,null);

function renderGroup(){
  const g=DB.recs[CURG]; if(!g) return;
  const M=membersOf(g.id), me=autoMe(g.id), bal=balances(g.id);
  $('gTitle').textContent=g.name;
  $('gMembersTop').textContent=M.map(m=>m.name).join(', ');
  const spent=expensesOf(g.id).reduce((a,e)=>a+e.base,0), myShare=me?expensesOf(g.id).reduce((a,e)=>a+((e.owe||{})[me]||0),0):null;
  const mine=me?bal[me]||0:null;
  $('gHero').innerHTML=(mine===null
      ?'<div class="hlbl">Gruppe</div><div class="hbig zero">'+esc(money(spent,g.cur))+'</div><div class="hsub">Ausgaben gesamt</div>'
      :'<div class="hlbl">'+(mine>0?'Du bekommst':mine<0?'Du schuldest':'Dein Saldo')+'</div><div class="hbig '+(mine>0?'pos':mine<0?'neg':'zero')+'">'+esc(mine?moneyAbs(mine,g.cur):'ausgeglichen')+'</div>'+
       '<div class="kpis"><div class="kpi"><b>'+esc(money(spent,g.cur))+'</b><span>Ausgaben gesamt</span></div><div class="kpi"><b>'+esc(money(myShare,g.cur))+'</b><span>dein Anteil</span></div></div>')+
    flowHtml(g,bal,me,true);
  $('gHero').querySelectorAll('[data-settle]').forEach(b=>b.onclick=()=>{ const [f,t,a]=b.dataset.settle.split('|'); openPayment(g.id,null,{from:f,to:t,amt:+a}); });
  // Wer bin ich?
  const W=$('whoami');
  if(!me&&M.length){
    W.hidden=false; W.innerHTML='<b>Wer bist du in dieser Gruppe?</b> Dann zeigt die App, was du bekommst oder schuldest.<div class="chips"></div>';
    M.forEach(m=>{ const c=document.createElement('button'); c.className='chipbtn'; c.textContent=m.name;
      c.onclick=()=>{ ME[g.id]=m.id; saveJ('me',ME); if(!MYNAME){ MYNAME=m.name; store.set('name',MYNAME); } renderGroup(); };
      W.querySelector('.chips').appendChild(c); });
  }else W.hidden=true;
  document.querySelectorAll('#gSeg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===GVIEW));
  $('gView-list').hidden=GVIEW!=='list'; $('gView-bal').hidden=GVIEW!=='bal'; $('gView-stat').hidden=GVIEW!=='stat';
  $('addExp').disabled=$('addPay').disabled=M.length<1;
  if(GVIEW==='list') renderList();
  if(GVIEW==='bal') renderBal();
  if(GVIEW==='stat') renderStat();
}
function flowHtml(g,bal,me,onlyMine){
  let S=settle(bal); if(onlyMine&&me) S=S.filter(s=>s.from===me||s.to===me); else if(onlyMine) return '';
  if(!S.length) return '';
  return '<ul class="flow">'+S.map(s=>{
    const t=s.from===me?'Du zahlst <b>'+esc(nameOf(s.to))+'</b>':s.to===me?'<b>'+esc(nameOf(s.from))+'</b> zahlt dir':'<b>'+esc(nameOf(s.from))+'</b> → <b>'+esc(nameOf(s.to))+'</b>';
    return '<li><span class="t">'+t+'</span><span class="num '+(s.to===me?'pos':s.from===me?'neg':'')+'">'+esc(money(s.amt,g.cur))+'</span>'+
      '<button class="chipbtn" data-settle="'+s.from+'|'+s.to+'|'+s.amt+'">Ausgleichen</button></li>';
  }).join('')+'</ul>';
}
const MON=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const MONL=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
function renderList(){
  const g=DB.recs[CURG]; if(!g) return;
  const me=meIn(g.id), q=$('q').value.trim().toLowerCase();
  let items=[...expensesOf(g.id).map(e=>({k:'e',r:e})),...paymentsOf(g.id).map(p=>({k:'p',r:p}))];
  if(q) items=items.filter(({k,r})=>{
    const hay=(k==='e'?[r.title,r.note,nameOf(r.payer),CAT[r.cat]?.lbl,centsStr(r.amt),r.cur]:['ausgleich',nameOf(r.from),nameOf(r.to),r.note,centsStr(r.amt)]).join(' ').toLowerCase();
    return q.split(/\s+/).every(w=>hay.includes(w)); });
  items.sort((a,b)=>b.r.date.localeCompare(a.r.date)||b.r.c-a.r.c);
  const L=$('expList'); L.innerHTML='';
  if(!items.length){ L.innerHTML='<div class="empty">'+(q?'Nichts gefunden.':membersOf(g.id).length?'Noch keine Ausgaben. Unten auf „+ Ausgabe" tippen.':'Erst Mitglieder hinzufügen — oben rechts auf den Stift.')+'</div>'; return; }
  let curM=null, box=null;
  for(const {k,r} of items){
    const ym=r.date.slice(0,7);
    if(ym!==curM){
      curM=ym; const [y,m]=ym.split('-');
      const sum=items.filter(x=>x.k==='e'&&x.r.date.startsWith(ym)).reduce((a,x)=>a+x.r.base,0);
      const h=document.createElement('div'); h.className='month';
      h.innerHTML='<span>'+MONL[+m-1]+' '+y+'</span><span>'+esc(money(sum,g.cur))+'</span>'; L.appendChild(h);
      box=document.createElement('div'); box.className='elist'; L.appendChild(box);
    }
    const b=document.createElement('button'); b.className='erow'+(k==='p'?' payrow':'');
    const d=r.date.split('-');
    b.innerHTML='<span class="edate"><small>'+MON[+d[1]-1]+'</small><b>'+(+d[2])+'</b></span><span class="ecat"></span><span class="et"><b></b><small></small></span><span class="amt"><small></small><b></b></span>';
    if(k==='e'){
      b.querySelector('.ecat').textContent=(CAT[r.cat]||CAT.other).ico;
      b.querySelector('.et b').textContent=r.title;
      b.querySelector('.et small').textContent=(r.payer===me?'Du hast ':nameOf(r.payer)+' hat ')+money(r.base,g.cur)+' bezahlt'+(r.cur!==g.cur?' · '+money(r.amt,r.cur):'');
      const x=myEffect(r,me), [lbl,cls,val]=x===null?['gesamt','',money(r.base,g.cur)]:x>0?['du bekommst','pos',moneyAbs(x,g.cur)]:x<0?['du schuldest','neg',moneyAbs(x,g.cur)]:['nicht beteiligt','zero','–'];
      b.querySelector('.amt small').textContent=lbl; const ab=b.querySelector('.amt b'); ab.textContent=val; ab.className=cls;
      b.onclick=()=>openExpense(g.id,r.id);
    }else{
      b.querySelector('.ecat').textContent='💸';
      b.querySelector('.et b').textContent=(r.from===me?'Du':nameOf(r.from))+' → '+(r.to===me?'dich':nameOf(r.to));
      b.querySelector('.et small').textContent='Ausgleich'+(r.note?' · '+r.note:'');
      b.querySelector('.amt b').textContent=money(r.amt,g.cur);
      b.onclick=()=>openPayment(g.id,r.id);
    }
    box.appendChild(b);
  }
}
function renderBal(){
  const g=DB.recs[CURG], me=meIn(g.id), bal=balances(g.id), V=$('gView-bal');
  const ids=Object.keys(bal).sort((a,b)=>bal[b]-bal[a]), mx=Math.max(1,...ids.map(k=>Math.abs(bal[k])));
  const paid={},share={};
  expensesOf(g.id).forEach(e=>{ paid[e.payer]=(paid[e.payer]||0)+e.base; for(const [k,v] of Object.entries(e.owe||{})) share[k]=(share[k]||0)+v; });
  let h='<div class="parthead" style="margin-top:4px">Salden</div><div class="card">';
  ids.forEach(k=>{ const v=bal[k], w=Math.round(Math.abs(v)/mx*50);
    h+='<div class="brow"><span class="ava'+(k===me?' me':'')+'">'+esc(initial(nameOf(k)))+'</span><span class="bn">'+esc(nameOf(k))+(k===me?' (du)':'')+
      '<small>bezahlt '+esc(money(paid[k]||0,g.cur))+' · Anteil '+esc(money(share[k]||0,g.cur))+'</small>'+
      '<div class="bbar"><i style="'+(v>=0?'left:50%;width:'+w+'%;background:var(--tico)':'right:50%;width:'+w+'%;background:var(--alert)')+'"></i></div></span>'+
      '<span class="amt"><small>'+(v>0?'bekommt':v<0?'schuldet':'')+'</small><b class="'+(v>0?'pos':v<0?'neg':'zero')+'">'+(v?esc(moneyAbs(v,g.cur)):'±0')+'</b></span></div>'; });
  h+='</div><div class="parthead">So wird ausgeglichen</div><div class="card">';
  const S=settle(bal);
  if(!S.length) h+='<div class="allsettled">✓ Alles ausgeglichen</div>';
  S.forEach(s=>{ h+='<div class="srow"><span class="ava'+(s.from===me?' me':'')+'">'+esc(initial(nameOf(s.from)))+'</span><span class="t"><b>'+esc(s.from===me?'Du':nameOf(s.from))+'</b> → <b>'+esc(s.to===me?'dich':nameOf(s.to))+'</b><small>'+esc(money(s.amt,g.cur))+'</small></span>'+
    '<button class="chipbtn" data-settle="'+s.from+'|'+s.to+'|'+s.amt+'">Ausgleichen</button></div>'; });
  h+='</div><p class="shint">Die Schulden sind vereinfacht: so wenige Überweisungen wie möglich, auch über Ecken. „Ausgleichen" trägt die Zahlung ein, wenn sie erfolgt ist.</p>';
  V.innerHTML=h;
  V.querySelectorAll('[data-settle]').forEach(b=>b.onclick=()=>{ const [f,t,a]=b.dataset.settle.split('|'); openPayment(g.id,null,{from:f,to:t,amt:+a}); });
}
function renderStat(){
  const g=DB.recs[CURG], me=meIn(g.id), E=expensesOf(g.id), V=$('gView-stat');
  if(!E.length){ V.innerHTML='<div class="empty">Noch keine Ausgaben.</div>'; return; }
  const by={}, byMe={}; let tot=0, totMe=0;
  E.forEach(e=>{ by[e.cat]=(by[e.cat]||0)+e.base; tot+=e.base; if(me){ const s=(e.owe||{})[me]||0; byMe[e.cat]=(byMe[e.cat]||0)+s; totMe+=s; } });
  const rows=Object.keys(by).sort((a,b)=>by[b]-by[a]), mx=by[rows[0]];
  let h='<div class="parthead" style="margin-top:4px">Nach Kategorie</div><div class="card">';
  rows.forEach(c=>{ const k=CAT[c]||CAT.other;
    h+='<div class="statrow"><span>'+k.ico+'</span><span>'+k.lbl+' <small style="color:var(--soft)">'+Math.round(by[c]/tot*100)+' %</small></span><span class="num">'+esc(money(by[c],g.cur))+'</span>'+
      '<span class="bar"><i style="width:'+(by[c]/mx*100).toFixed(1)+'%"></i></span>'+
      (me?'<small style="grid-column:2/4;color:var(--soft);font-size:11.5px;margin-top:-2px">dein Anteil '+esc(money(byMe[c]||0,g.cur))+'</small>':'')+'</div>'; });
  h+='</div>';
  // Monate
  const mon={}; E.forEach(e=>{ const k=e.date.slice(0,7); mon[k]=(mon[k]||0)+e.base; });
  const keys=Object.keys(mon).sort().slice(-12);
  if(keys.length>1){
    const m2=Math.max(...keys.map(k=>mon[k]));
    h+='<div class="parthead">Nach Monat</div><div class="card"><div class="months">'+keys.map(k=>'<div title="'+esc(money(mon[k],g.cur))+'"><i style="height:'+Math.max(2,mon[k]/m2*90)+'%"></i><span>'+MON[+k.slice(5)-1]+'</span></div>').join('')+'</div></div>';
  }
  // Tage / Durchschnitt (für Reisen)
  const days=[...new Set(E.map(e=>e.date))].sort(), span=Math.round((new Date(days[days.length-1])-new Date(days[0]))/864e5)+1;
  h+='<div class="card"><div class="strow" style="display:flex;justify-content:space-between;font-size:13.5px;padding:3px 0"><span style="color:var(--soft)">Zeitraum</span><span>'+span+(span===1?' Tag':' Tage')+'</span></div>'+
    '<div style="display:flex;justify-content:space-between;font-size:13.5px;padding:3px 0"><span style="color:var(--soft)">pro Tag (Gruppe)</span><span class="num">'+esc(money(Math.round(tot/span),g.cur))+'</span></div>'+
    (me?'<div style="display:flex;justify-content:space-between;font-size:13.5px;padding:3px 0"><span style="color:var(--soft)">pro Tag (dein Anteil)</span><span class="num">'+esc(money(Math.round(totMe/span),g.cur))+'</span></div>':'')+'</div>';
  V.innerHTML=h;
}

/* ---------- Ausgabe bearbeiten ---------- */
let ED=null;   // Arbeitsstand des Formulars
function openExpense(gid,eid){
  const g=DB.recs[gid], M=membersOf(gid), me=meIn(gid), e=eid?DB.recs[eid]:null;
  const lastCur=loadJ('lastcur',{})[gid];
  ED={gid,eid,cat:e?e.cat:null,catTouched:!!e,mode:e?e.mode:'eq',inv:false,
      parts:e?{...e.parts}:Object.fromEntries(M.map(m=>[m.id,1])), vals:{}};
  // entfernte Mitglieder, die an dieser Ausgabe beteiligt sind, weiter anzeigen
  ED.members=[...M]; if(e) Object.keys(e.parts).concat([e.payer]).forEach(k=>{ if(!ED.members.some(m=>m.id===k)&&DB.recs[k]) ED.members.push(DB.recs[k]); });
  $('eGroup').textContent=g.name;
  $('eTitle').value=e?e.title:''; $('eNote').value=e?e.note||'':'';
  $('eAmt').value=e?centsStr(e.amt):'';
  $('eCur').innerHTML=[...new Set([g.cur,...CURS])].map(c=>'<option>'+c+'</option>').join('');
  $('eCur').value=e?e.cur:(lastCur||g.cur);
  $('eDate').value=e?e.date:isoDay();
  $('ePayer').innerHTML=ED.members.map(m=>'<option value="'+m.id+'">'+esc(m.name)+(m.id===me?' (du)':'')+'</option>').join('');
  $('ePayer').value=e?e.payer:(me||(M[0]&&M[0].id));
  const rates=loadJ('rates',{});
  ED.rate=e?e.rate:(rates[$('eCur').value+'>'+g.cur]||null);
  if(e&&e.mode!=='eq') for(const [k,v] of Object.entries(e.parts)) ED.vals[k]=e.mode==='exact'?centsStr(v):numStr(v,2);
  $('eDel').hidden=!e;
  $('eMeta').textContent=e?'Erfasst von '+e.by+' am '+new Date(e.c).toLocaleDateString('de-DE')+(e.u-e.c>2000?' · zuletzt geändert '+new Date(e.u).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):''):'';
  renderCats(); renderRate(); renderMode(); renderSplit();
  show('edit');
  if(!e) setTimeout(()=>$('eTitle').focus(),50);
}
function renderCats(){
  const C=$('eCats'); C.innerHTML='';
  CATS.forEach(([k,ico,lbl])=>{ const b=document.createElement('button'); b.textContent=ico+' '+lbl; b.setAttribute('aria-pressed',ED.cat===k);
    b.onclick=()=>{ ED.cat=k; ED.catTouched=true; renderCats(); }; C.appendChild(b);
    if(ED.cat===k) requestAnimationFrame(()=>{ C.scrollLeft=b.offsetLeft-C.clientWidth/2+b.offsetWidth/2; }); });
}
$('eTitle').oninput=()=>{
  if(ED.catTouched) return;
  const t=$('eTitle').value, hit=CAT_GUESS.find(([re])=>re.test(t));
  const nc=hit?hit[1]:null; if(nc!==ED.cat){ ED.cat=nc; renderCats(); }
};
function renderRate(){
  const g=DB.recs[ED.gid], cur=$('eCur').value, foreign=cur!==g.cur;
  $('eRateRow').hidden=!foreign; $('eRateHint').hidden=!foreign;
  if(!foreign) return;
  ED.inv=ED.rate?ED.rate<0.05:['CRC','JPY','HUF','THB','MXN','CZK'].includes(cur);
  $('eRateL').textContent=ED.inv?'1 '+g.cur+' =':'1 '+cur+' =';
  $('eRate').value=ED.rate?numStr(ED.inv?1/ED.rate:ED.rate,ED.inv?2:5):'';
  $('eRate').placeholder='Kurs';
  $('eRateRow').querySelector('.chipbtn').textContent='Tageskurs';
  const after=document.createElement('span'); // Einheit hinter dem Feld
  [...$('eRateRow').querySelectorAll('.unit')].forEach(x=>x.remove());
  after.className='unit'; after.textContent=ED.inv?cur:g.cur; $('eRate').after(after);
  updateRateHint();
}
function updateRateHint(){
  const g=DB.recs[ED.gid], cur=$('eCur').value, amt=toCents($('eAmt').value);
  const h=$('eRateHint');
  if(!ED.rate){ h.textContent='Kurs eintragen oder „Tageskurs" holen (braucht Netz). Der Kurs wird mit der Ausgabe gespeichert.'; return; }
  h.textContent=amt>0?money(amt,cur)+' ≙ '+money(Math.round(amt*ED.rate),g.cur)+' — damit wird gerechnet.':'Wird in '+g.cur+' umgerechnet.';
}
$('eCur').onchange=()=>{ const g=DB.recs[ED.gid]; ED.rate=$('eCur').value===g.cur?1:(loadJ('rates',{})[$('eCur').value+'>'+g.cur]||null); renderRate(); renderSplit(); };
$('eRate').oninput=()=>{ const n=parseNum($('eRate').value); ED.rate=n>0?(ED.inv?1/n:n):null; updateRateHint(); renderSplit(); };
$('eRateGet').onclick=async()=>{
  const g=DB.recs[ED.gid], cur=$('eCur').value, b=$('eRateGet'); b.textContent='…';
  try{
    const r=await fetch('https://open.er-api.com/v6/latest/'+cur,{cache:'no-store'}); const j=await r.json();
    const v=j&&j.rates&&j.rates[g.cur]; if(!v) throw new Error();
    ED.rate=v; const R=loadJ('rates',{}); R[cur+'>'+g.cur]=v; saveJ('rates',R);
    renderRate(); renderSplit();
    $('eRateHint').textContent+=' Kurs vom '+new Date((j.time_last_update_unix||Date.now()/1000)*1000).toLocaleDateString('de-DE')+'.';
  }catch(e){ b.textContent='Tageskurs'; $('eRateHint').textContent='Kurs konnte nicht geladen werden (offline?). Bitte von Hand eintragen.'; }
};
$('eAmt').oninput=()=>{ updateRateHint(); renderSplit(true); };
document.querySelectorAll('#eMode button').forEach(b=>b.onclick=()=>{
  if(ED.mode===b.dataset.m) return;
  const prev=ED.mode; ED.mode=b.dataset.m;
  // beteiligte Personen in den neuen Modus mitnehmen
  const inc=ED.members.filter(m=>prev==='eq'?ED.parts[m.id]>0:parseNum(ED.vals[m.id])>0).map(m=>m.id);
  ED.vals={}; const n=inc.length||1, amt=toCents($('eAmt').value);
  inc.forEach(k=>{ ED.vals[k]=ED.mode==='pct'?numStr(100/n,2):ED.mode==='shares'?'1':ED.mode==='exact'&&amt>0?'':''; });
  if(ED.mode==='exact'&&amt>0){ const a=allocate(amt,Object.fromEntries(inc.map(k=>[k,1]))); inc.forEach(k=>ED.vals[k]=centsStr(a[k])); }
  if(ED.mode==='eq'){ ED.parts={}; (inc.length?inc:ED.members.map(m=>m.id)).forEach(k=>ED.parts[k]=1); }
  renderMode(); renderSplit();
});
function renderMode(){ document.querySelectorAll('#eMode button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===ED.mode)); }
/* Formularwerte in parts übersetzen (für Vorschau und Speichern) */
function readParts(){
  const p={};
  if(ED.mode==='eq'){ ED.members.forEach(m=>{ if(ED.parts[m.id]>0) p[m.id]=1; }); return p; }
  ED.members.forEach(m=>{ const v=ED.vals[m.id];
    const n=ED.mode==='exact'?toCents(v):parseNum(v); if(n>0) p[m.id]=ED.mode==='exact'?n:+n.toFixed(4); });
  return p;
}
function previewOwe(){
  const g=DB.recs[ED.gid], amt=toCents($('eAmt').value), cur=$('eCur').value, rate=cur===g.cur?1:ED.rate;
  if(!(amt>0)||!rate) return null;
  return computeOwe({mode:ED.mode,parts:readParts(),base:Math.round(amt*rate)});
}
function renderSplit(onlyNums){
  const g=DB.recs[ED.gid], me=meIn(ED.gid), S=$('eSplit'), amt=toCents($('eAmt').value), cur=$('eCur').value;
  const owe=previewOwe()||{};
  if(!onlyNums){
    S.innerHTML='';
    ED.members.forEach(m=>{
      const r=document.createElement('div'); r.className='sprow'; r.dataset.id=m.id;
      if(ED.mode==='eq'){
        r.innerHTML='<label><input type="checkbox"><span class="ava'+(m.id===me?' me':'')+'"></span><span class="nm"></span></label><span class="share"></span>';
        const cb=r.querySelector('input'); cb.checked=ED.parts[m.id]>0;
        cb.onchange=()=>{ ED.parts[m.id]=cb.checked?1:0; renderSplit(true); };
      }else{
        r.innerHTML='<label><span class="ava'+(m.id===me?' me':'')+'"></span><span class="nm"></span></label><span class="share"></span><input type="text" inputmode="decimal" autocomplete="off">';
        const inp=r.querySelector('input'); inp.value=ED.vals[m.id]||'';
        inp.placeholder=ED.mode==='exact'?'0,00':ED.mode==='pct'?'0 %':'0';
        inp.oninput=()=>{ ED.vals[m.id]=inp.value; renderSplit(true); };
      }
      r.querySelector('.ava').textContent=initial(m.name); r.querySelector('.nm').textContent=m.name+(m.id===me?' (du)':'');
      S.appendChild(r);
    });
  }
  S.querySelectorAll('.sprow').forEach(r=>{ const k=r.dataset.id, v=owe[k]||0;
    r.querySelector('.share').textContent=ED.mode==='exact'?(cur!==g.cur&&v?'≙ '+money(v,g.cur):''):(v?money(v,g.cur):'–');
    r.classList.toggle('off',!v&&!(ED.mode==='eq'&&ED.parts[k]>0)); });
  // Prüfung
  const C=$('eCheck'), p=readParts(), n=Object.keys(p).length;
  let msg='',cls='';
  if(!n){ msg='Niemand ausgewählt.'; cls='bad'; }
  else if(ED.mode==='eq') msg=n+(n===1?' Person':' Personen')+' teilen gleich'+(amt>0&&owe[Object.keys(p)[0]]?' · je ca. '+money(Math.round((Object.values(owe).reduce((a,b)=>a+b,0))/n),g.cur):'');
  else if(ED.mode==='exact'){ const s=Object.values(p).reduce((a,b)=>a+b,0), d=(amt||0)-s;
    msg=d===0?'✓ Beträge gehen auf':d>0?'Noch '+money(d,cur)+' zu verteilen':money(-d,cur)+' zu viel verteilt'; cls=d===0?'ok':'bad'; }
  else if(ED.mode==='pct'){ const s=Object.values(p).reduce((a,b)=>a+b,0), d=+(100-s).toFixed(2);
    msg=Math.abs(d)<0.01?'✓ 100 %':d>0?'Noch '+numStr(d,2)+' % zu verteilen':numStr(-d,2)+' % zu viel'; cls=Math.abs(d)<0.01?'ok':'bad'; }
  else{ const s=Object.values(p).reduce((a,b)=>a+b,0); msg=numStr(s,2)+' Anteile insgesamt'; }
  C.textContent=msg; C.className='splitcheck '+cls;
}
$('eBack').onclick=()=>{ show('group'); renderGroup(); };
$('eSave').onclick=()=>{
  const g=DB.recs[ED.gid], amt=toCents($('eAmt').value), cur=$('eCur').value, rate=cur===g.cur?1:ED.rate;
  const bad=el=>{ el.classList.add('bad'); el.focus(); setTimeout(()=>el.classList.remove('bad'),1600); };
  if(!(amt>0)) return bad($('eAmt'));
  if(!(rate>0)) return bad($('eRate'));
  const parts=readParts(); if(!Object.keys(parts).length) return renderSplit(true);
  if(ED.mode==='exact'&&Object.values(parts).reduce((a,b)=>a+b,0)!==amt) return bad($('eSplit').querySelector('input')||$('eAmt'));
  if(ED.mode==='pct'&&Math.abs(Object.values(parts).reduce((a,b)=>a+b,0)-100)>0.01) return bad($('eSplit').querySelector('input')||$('eAmt'));
  const title=$('eTitle').value.trim()||(ED.cat?CAT[ED.cat].lbl:'Ausgabe');
  const base=Math.round(amt*rate);
  const e={...(ED.eid?DB.recs[ED.eid]:{}),id:ED.eid||uid(),t:'e',g:ED.gid,title,cat:ED.cat||'other',amt,cur,rate,base,
    date:$('eDate').value||isoDay(),payer:$('ePayer').value,mode:ED.mode,parts,note:$('eNote').value.trim()};
  e.owe=computeOwe(e); delete e.del;
  put(e);
  const lc=loadJ('lastcur',{}); lc[ED.gid]=cur; saveJ('lastcur',lc);
  if(cur!==g.cur){ const R=loadJ('rates',{}); R[cur+'>'+g.cur]=rate; saveJ('rates',R); }
  show('group'); GVIEW='list'; renderGroup();
};
$('eDel').onclick=async()=>{
  if(!await ask('Ausgabe löschen?','„'+DB.recs[ED.eid].title+'" wird auf allen Geräten gelöscht.','Löschen')) return;
  del(ED.eid); show('group'); renderGroup();
};

/* ---------- Ausgleich ---------- */
let PD=null;
function openPayment(gid,pid,pre){
  const g=DB.recs[gid], M=membersOf(gid), me=meIn(gid), p=pid?DB.recs[pid]:null;
  PD={gid,pid}; syncIfStale();
  const opts=M.map(m=>'<option value="'+m.id+'">'+esc(m.name)+(m.id===me?' (du)':'')+'</option>').join('');
  $('pFrom').innerHTML=opts; $('pTo').innerHTML=opts;
  $('pGroup').textContent=g.name; $('pCur').textContent=g.cur;
  const S=settle(balances(gid)), first=S.find(s=>s.from===me||s.to===me)||S[0];
  const src=p||pre||first||{from:me||(M[0]&&M[0].id),to:(M.find(m=>m.id!==me)||M[0]||{}).id,amt:0};
  $('pFrom').value=src.from; $('pTo').value=src.to; $('pAmt').value=src.amt?centsStr(src.amt):'';
  $('pDate').value=p?p.date:isoDay(); $('pNote').value=p?p.note||'':'';
  $('pDel').hidden=!p;
  $('pMeta').textContent=p?'Erfasst von '+p.by+' am '+new Date(p.c).toLocaleDateString('de-DE'):'';
  show('pay');
}
$('pBack').onclick=()=>{ show('group'); renderGroup(); };
$('pSave').onclick=()=>{
  const amt=toCents($('pAmt').value);
  if(!(amt>0)){ $('pAmt').classList.add('bad'); $('pAmt').focus(); return setTimeout(()=>$('pAmt').classList.remove('bad'),1600); }
  if($('pFrom').value===$('pTo').value){ $('pTo').classList.add('bad'); return setTimeout(()=>$('pTo').classList.remove('bad'),1600); }
  put({...(PD.pid?DB.recs[PD.pid]:{}),id:PD.pid||uid(),t:'p',g:PD.gid,from:$('pFrom').value,to:$('pTo').value,amt,date:$('pDate').value||isoDay(),note:$('pNote').value.trim(),del:undefined});
  show('group'); renderGroup();
};
$('pDel').onclick=async()=>{ if(!await ask('Ausgleich löschen?','Die Zahlung wird auf allen Geräten entfernt.','Löschen')) return; del(PD.pid); show('group'); renderGroup(); };

/* ---------- Gruppe anlegen / bearbeiten ---------- */
let GF=null;
function openGroupForm(gid){
  const g=gid?DB.recs[gid]:null, me=gid?meIn(gid):null;
  GF={gid,rows:g?membersOf(gid).map(m=>({id:m.id,name:m.name,me:m.id===me})):[{id:null,name:MYNAME,me:true}]};
  $('gfHead').textContent=g?'Gruppe bearbeiten':'Neue Gruppe';
  $('gfName').value=g?g.name:'';
  $('gfCur').innerHTML=CURS.map(c=>'<option>'+c+'</option>').join('');
  $('gfCur').value=g?g.cur:'EUR';
  const used=g&&(expensesOf(gid).length||paymentsOf(gid).length);
  $('gfCur').disabled=!!used;
  $('gfCurHint').textContent=used?'Währung ist fest, weil schon Beträge erfasst sind.':'In dieser Währung werden Salden geführt. Einzelne Ausgaben können in anderer Währung erfasst werden (z. B. USD oder Colones mit Kurs).';
  $('gfDel').hidden=$('gfCsv').hidden=!g;
  $('gfNew').value='';
  renderGfMembers(); show('gform');
  if(!g) setTimeout(()=>$('gfName').focus(),50);
}
function involved(gid,mid){
  return expensesOf(gid).some(e=>e.payer===mid||(e.parts&&e.parts[mid]>0))||paymentsOf(gid).some(p=>p.from===mid||p.to===mid);
}
function renderGfMembers(){
  const L=$('gfMembers'); L.innerHTML='';
  GF.rows.forEach((r,i)=>{ if(r.del) return;
    const d=document.createElement('div'); d.className='mrow';
    d.innerHTML='<span class="ava'+(r.me?' me':'')+'"></span><input type="text" autocomplete="off"><button aria-label="Entfernen">✕</button>';
    const inp=d.querySelector('input'); inp.value=r.name; inp.placeholder=r.me?'Dein Name':'Name';
    d.querySelector('.ava').textContent=initial(r.name);
    inp.oninput=()=>{ r.name=inp.value; d.querySelector('.ava').textContent=initial(r.name); };
    if(r.me){ const s=document.createElement('small'); s.textContent='du'; d.insertBefore(s,d.lastChild); }
    const b=d.querySelector('button');
    if(r.id&&GF.gid&&involved(GF.gid,r.id)){ b.disabled=true; b.style.opacity=.3; b.title='Hat Ausgaben – kann nicht entfernt werden'; }
    b.onclick=()=>{ if(r.id) r.del=true; else GF.rows.splice(i,1); renderGfMembers(); };
    L.appendChild(d);
  });
}
$('gfAdd').onclick=()=>{ const n=$('gfNew').value.trim(); if(!n) return $('gfNew').focus();
  GF.rows.push({id:null,name:n,me:false}); $('gfNew').value=''; renderGfMembers(); $('gfNew').focus(); };
$('gfNew').onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); $('gfAdd').click(); } };
$('gfBack').onclick=()=>{ if(GF.gid){ show('group'); renderGroup(); } else { show('home'); renderHome(); } };
$('gfSave').onclick=()=>{
  const name=$('gfName').value.trim(); if(!name){ $('gfName').classList.add('bad'); $('gfName').focus(); return setTimeout(()=>$('gfName').classList.remove('bad'),1600); }
  const live=GF.rows.filter(r=>!r.del&&r.name.trim());
  if(!live.length){ $('gfNew').focus(); return; }
  const g=put({...(GF.gid?DB.recs[GF.gid]:{}),id:GF.gid||uid(),t:'g',name,cur:$('gfCur').value});
  let ord=0;
  GF.rows.forEach(r=>{
    if(r.del&&r.id){ del(r.id); return; }
    if(!r.name.trim()) return;
    const old=r.id&&DB.recs[r.id];
    if(old&&old.name===r.name.trim()&&old.ord===ord){ ord++; return; }
    const m=put({...(old||{}),id:r.id||uid(),t:'m',g:g.id,name:r.name.trim(),ord:ord++});
    if(r.me){ ME[g.id]=m.id; saveJ('me',ME); if(!MYNAME){ MYNAME=m.name; store.set('name',MYNAME); } }
  });
  CURG=g.id; show('group'); renderGroup();
};
$('gfDel').onclick=async()=>{
  const g=DB.recs[GF.gid];
  if(!await ask('Gruppe „'+g.name+'" löschen?','Alle Ausgaben und Ausgleiche dieser Gruppe verschwinden auf allen Geräten. Über die Wiederherstellungspunkte lässt sich das zurückholen.','Gruppe löschen')) return;
  snapshot('vor Löschen „'+g.name+'"');
  del(GF.gid); show('home'); renderHome();
};
$('gfCsv').onclick=()=>{
  const g=DB.recs[GF.gid], M=allMembersOf(g.id).filter(m=>!m.del||involved(g.id,m.id));
  const n=c=>(c/100).toFixed(2).replace('.',','), q=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
  const rows=[['Datum','Art','Beschreibung','Kategorie','Betrag','Währung','Kurs','Betrag '+g.cur,'Bezahlt von',...M.map(m=>'Anteil '+m.name),'Notiz']];
  [...expensesOf(g.id)].sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>rows.push([e.date,'Ausgabe',e.title,(CAT[e.cat]||CAT.other).lbl,n(e.amt),e.cur,String(e.rate).replace('.',','),n(e.base),nameOf(e.payer),...M.map(m=>n((e.owe||{})[m.id]||0)),e.note||'']));
  [...paymentsOf(g.id)].sort((a,b)=>a.date.localeCompare(b.date)).forEach(p=>rows.push([p.date,'Ausgleich',nameOf(p.from)+' an '+nameOf(p.to),'',n(p.amt),g.cur,'1',n(p.amt),nameOf(p.from),...M.map(()=>''),p.note||'']));
  const bal=balances(g.id); rows.push([]); rows.push(['','Saldo','','','','','','','',...M.map(m=>n(bal[m.id]||0)),'']);
  const text='﻿'+rows.map(r=>r.map(q).join(';')).join('\r\n');
  shareFile(text,'kasse-'+slug(g.name)+'-'+isoDay()+'.csv','text/csv',g.name);
};

/* ---------- Aktivität ---------- */
function renderAct(){
  const L=$('actList'); L.innerHTML='';
  const list=Object.values(DB.recs).filter(r=>(r.t==='e'||r.t==='p'||r.t==='g')&&DB.recs[r.g||r.id]&&(r.t==='g'||!DB.recs[r.g].del)).sort((a,b)=>b.u-a.u).slice(0,150);
  if(!list.length){ L.innerHTML='<div class="empty">Noch nichts passiert.</div>'; return; }
  const box=document.createElement('div'); box.className='elist'; L.appendChild(box);
  list.forEach(r=>{
    const g=DB.recs[r.g||r.id], me=meIn(g.id), verb=r.del?'gelöscht':(r.u-r.c<2000?'hinzugefügt':'geändert');
    const who=(r.dev===DEV.id?'Du':r.by)+' ';
    const d=document.createElement('div'); d.className='arow'+(r.del?' del':'');
    let ico,txt,sub='';
    if(r.t==='e'){ ico=(CAT[r.cat]||CAT.other).ico; txt=who+(r.dev===DEV.id?'hast':'hat')+' <b>'+esc(r.title)+'</b> in „'+esc(g.name)+'" '+verb+'.';
      const x=myEffect(r,me); sub=money(r.base,g.cur)+(x>0?' · du bekommst '+moneyAbs(x,g.cur):x<0?' · du schuldest '+moneyAbs(x,g.cur):''); }
    else if(r.t==='p'){ ico='💸'; txt=who+(r.dev===DEV.id?'hast':'hat')+' einen Ausgleich <b>'+esc(nameOf(r.from))+' → '+esc(nameOf(r.to))+'</b> in „'+esc(g.name)+'" '+verb+'.'; sub=money(r.amt,g.cur); }
    else { ico='👥'; txt=who+(r.dev===DEV.id?'hast':'hat')+' die Gruppe <b>'+esc(r.name)+'</b> '+(r.del?'gelöscht':r.u-r.c<2000?'angelegt':'geändert')+'.'; }
    d.innerHTML='<span class="ecat">'+ico+'</span><span class="at">'+txt+'<small>'+esc(sub)+(sub?' · ':'')+esc(rel(r.u))+'</small></span>';
    if(!r.del&&!g.del) d.onclick=()=>{ tab('groups'); if(r.t==='g') openGroup(g.id); else { CURG=g.id; if(r.t==='e') openExpense(g.id,r.id); else openPayment(g.id,r.id); } };
    box.appendChild(d);
  });
}
function rel(t){ const m=Math.round((Date.now()-t)/6e4);
  return m<1?'gerade eben':m<60?'vor '+m+' Min.':m<1440?'vor '+Math.round(m/60)+' Std.':m<2880?'gestern':new Date(t).toLocaleDateString('de-DE',{day:'numeric',month:'short',year:m>5e5?'numeric':undefined}); }

/* ---------- Bestätigen ---------- */
function ask(title,text,ok){
  return new Promise(res=>{
    const S=$('sheet'), B=$('sbox');
    B.innerHTML='<h3></h3><p></p><div class="stack"><button class="act warn"></button><button class="act">Abbrechen</button></div>';
    B.querySelector('h3').textContent=title; B.querySelector('p').textContent=text;
    const [y,n]=B.querySelectorAll('button'); y.textContent=ok;
    const done=v=>{ S.hidden=true; res(v); };
    y.onclick=()=>done(true); n.onclick=()=>done(false); S.onclick=e=>{ if(e.target===S) done(false); };
    S.hidden=false;
  });
}

/* ===================== Einstellungen ===================== */
function renderSet(){
  $('myName').value=MYNAME; $('devName').value=DEV.name;
  askPersist(); syncStatus(); renderSnaps(); bkStatus(); renderDiag();
}
$('myName').onchange=()=>{ MYNAME=$('myName').value.trim(); store.set('name',MYNAME); };
$('devName').onchange=()=>{ DEV.name=$('devName').value.trim()||DEV.name; saveJ('dev',DEV); scheduleSync(); };

/* 1. Dauerhaften Speicher anfordern, damit iOS die Daten nicht bei Platzmangel räumt */
async function askPersist(){
  const el=$('stPersist');
  try{
    if(!(navigator.storage&&navigator.storage.persist)){ el.textContent='nicht abfragbar'; return; }
    const p=(await navigator.storage.persisted())||(await navigator.storage.persist());
    el.textContent=p?'dauerhaft geschützt':'kann bei Platzmangel geräumt werden'; el.className=p?'ok':'warn';
  }catch(e){ el.textContent='nicht abfragbar'; }
}

/* 2. Wiederherstellungspunkte: automatisch, lokal, die letzten 10 */
const SNAP_MAX=10;
const liveCount=()=>Object.values(DB.recs).filter(r=>(r.t==='e'||r.t==='p')&&!r.del).length;
function snapshot(reason){
  const list=loadJ('snaps',[]);
  list.unshift({t:Date.now(),r:reason,n:liveCount(),s:JSON.stringify(DB)});
  for(let keep=SNAP_MAX;keep>=1;keep--){ try{ localStorage.setItem(P+'snaps',JSON.stringify(list.slice(0,keep))); return; }catch(e){} }
}
function renderSnaps(){
  const list=loadJ('snaps',[]), sel=$('snapSel');
  $('snapN').textContent=list.length?list.length+' gespeichert':'noch keine';
  sel.innerHTML=list.map((x,i)=>'<option value="'+i+'">'+new Date(x.t).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' · '+esc(x.r)+' · '+x.n+' Einträge</option>').join('');
  sel.hidden=$('snapGo').hidden=!list.length;
}
$('snapGo').onclick=async()=>{
  const list=loadJ('snaps',[]), x=list[+$('snapSel').value]; if(!x) return;
  if(!await ask('Zurücksetzen?','Stand vom '+new Date(x.t).toLocaleString('de-DE')+' wiederherstellen. Der jetzige Stand wird vorher gesichert. Mit Cloud-Sync gilt das auch für die anderen Geräte.','Zurücksetzen')) return;
  snapshot('vor Zurücksetzen');
  restoreDB(JSON.parse(x.s)); renderSnaps();
};
/* Ein alter Stand wird als neue Änderung eingespielt: Datensätze, die es damals gab, bekommen eine frische Zeit,
   alles danach Hinzugekommene wird gelöscht — so überschreibt er beim Abgleich auch die anderen Geräte. */
function restoreDB(old){
  const now=Date.now();
  for(const [id,r] of Object.entries(old.recs||{})) DB.recs[id]={...r,u:now,dev:DEV.id,by:MYNAME||DEV.name};
  for(const [id,r] of Object.entries(DB.recs)) if(!(id in (old.recs||{}))&&!r.del) DB.recs[id]={...r,del:true,u:now,dev:DEV.id,by:MYNAME||DEV.name};
  saveDB(); scheduleSync(true); rerender();
}
function dailySnap(){
  const list=loadJ('snaps',[]);
  if(liveCount()&&(!list.length||isoDay(new Date(list[0].t))!==isoDay())) snapshot('täglich');
}

/* 3. Cloud-Sync über ein geheimes GitHub-Gist — eine Datei pro Gerät, zusammengeführt pro Datensatz */
const GH='https://api.github.com', FILE_RE=/^kasse-.*\.json$/;
const slug=n=>String(n).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'x';
const myFile=()=>'kasse-'+DEV.id+'.json';
const payload=()=>JSON.stringify({app:'geteilte-kasse',v:1,dev:DEV.name,by:MYNAME,saved:new Date().toISOString(),recs:DB.recs});
let SYNC=loadJ('sync',null), syncTimer=null, syncing=false, CLOUD=[];
async function gh(path,opt={}){
  const r=await fetch(GH+path,{...opt,cache:'no-store',headers:{Authorization:'Bearer '+SYNC.token,Accept:'application/vnd.github+json',
    ...(opt.body?{'Content-Type':'application/json'}:{})}});
  if(r.status===401) throw new Error('Token ungültig oder abgelaufen');
  if(r.status===404) throw new Error('Gist nicht gefunden');
  if(!r.ok) throw new Error('GitHub antwortet '+r.status);
  if(r.status===204) return null;
  return r.json();
}
function mergeRecs(rem){              // pro Datensatz gewinnt der neuere Stand; bei Gleichstand entscheidet die Geräte-ID
  let n=0;
  for(const [id,r] of Object.entries(rem||{})){
    if(!r||!r.id||!r.t) continue;
    const l=DB.recs[id];
    if(!l||r.u>l.u||(r.u===l.u&&String(r.dev)>String(l.dev))){ DB.recs[id]=r; n++; }
  }
  return n;
}
function setDot(state){ const d=$('syncDot'); d.hidden=!(SYNC&&SYNC.gist); d.className='syncdot '+state; }
function syncStatus(msg,err){
  const el=$('syStat'), on=!!(SYNC&&SYNC.gist);
  $('syOffBox').hidden=on; $('syOnBox').hidden=!on;
  if(msg){ el.textContent=msg; el.className=err?'warn':''; setDot(err?'err':'busy'); return; }
  if(!on){
    el.textContent='aus'; el.className=''; setDot('');
    let shared=null; try{shared=JSON.parse(raw.get('app.gh')||'null')}catch(e){}     // Zugang der Spanisch-App auf diesem Gerät
    if(shared&&shared.token&&!$('syToken').value){ $('syToken').value=shared.token; $('syReuse').hidden=false; }
    return;
  }
  const m=SYNC.last?Math.round((Date.now()-SYNC.last)/6e4):null;
  el.textContent=m===null?'verbunden':'abgeglichen '+(m<1?'gerade eben':m<60?'vor '+m+' Min.':m<1440?'vor '+Math.round(m/60)+' Std.':'vor '+Math.round(m/1440)+' Tagen');
  el.className=SYNC.pending?'warn':'ok';
  if(SYNC.pending) el.textContent+=' · Änderungen offen';
  setDot(SYNC.pending?'':'ok');
}
async function syncNow(){
  if(!SYNC||!SYNC.gist||syncing) return;
  syncing=true; syncStatus('gleiche ab …');
  try{
    const g=await gh('/gists/'+SYNC.gist); let changed=0; CLOUD=[];
    for(const [fn,v] of Object.entries(g.files||{})){
      if(!FILE_RE.test(fn)) continue;
      let txt=v.content;
      if(v.truncated){ try{ txt=await (await fetch(v.raw_url,{cache:'no-store'})).text(); }catch(e){ continue; } }
      let d=null; try{ d=JSON.parse(txt); }catch(e){ continue; }
      if(!d||d.app!=='geteilte-kasse') continue;
      CLOUD.push({file:fn,dev:d.dev,by:d.by,saved:d.saved,n:Object.keys(d.recs||{}).length});
      if(fn!==myFile()) changed+=mergeRecs(d.recs);
    }
    if(changed){ saveDB(); rerender(); }
    await gh('/gists/'+SYNC.gist,{method:'PATCH',body:JSON.stringify({files:{[myFile()]:{content:payload()}}})});
    SYNC.last=Date.now(); SYNC.pending=false; saveJ('sync',SYNC); syncStatus();
    if(TAB==='set') renderDiag();
  }catch(e){
    SYNC.pending=true; saveJ('sync',SYNC);
    syncStatus(navigator.onLine===false?'offline · wird nachgeholt':e.message,true);
  }finally{ syncing=false; }
}
function scheduleSync(now){
  if(!SYNC||!SYNC.gist) return;
  SYNC.pending=true; saveJ('sync',SYNC); setDot('');
  clearTimeout(syncTimer); syncTimer=setTimeout(syncNow,now?0:2000);
}
const isKasse=x=>x.files&&Object.keys(x.files).some(f=>FILE_RE.test(f));
$('syConnect').onclick=async()=>{
  const token=$('syToken').value.trim(); if(!token) return $('syToken').focus();
  SYNC={token}; syncStatus('verbinde …');
  try{
    const list=await gh('/gists?per_page=100'); let hit=list.find(isKasse);
    if(!hit){                                       // erstes Gerät überhaupt: Gist anlegen
      const g=await gh('/gists',{method:'POST',body:JSON.stringify({description:'Geteilte Kasse – Daten',public:false,files:{[myFile()]:{content:payload()}}})});
      const dup=(await gh('/gists?per_page=100')).filter(x=>x.id!==g.id&&isKasse(x)).sort((p,q)=>(p.created_at+p.id<q.created_at+q.id?-1:1))[0];
      if(dup&&(dup.created_at+dup.id)<(g.created_at+g.id)){ await gh('/gists/'+g.id,{method:'DELETE'}); hit=dup; }   // anderes Gerät war schneller
      else hit=g;
    }
    if(liveCount()) snapshot('vor erstem Abgleich');
    SYNC.gist=hit.id; saveJ('sync',SYNC); $('syToken').value=''; $('syReuse').hidden=true;
    await syncNow(); renderDiag();
  }catch(e){ SYNC=null; saveJ('sync',null); syncStatus(e.message,true); $('syOffBox').hidden=false; }
};
$('syNow').onclick=()=>syncNow();
$('syOff').onclick=async()=>{
  if(!await ask('Cloud-Sync trennen?','Das Gist bleibt auf GitHub erhalten, dieses Gerät gleicht nur nicht mehr ab. Die Daten auf dem Gerät bleiben.','Trennen')) return;
  SYNC=null; saveJ('sync',null); syncStatus(); renderDiag();
};
const APP_VERSION='2026-10-09 · 1';
function renderDiag(){
  $('verInfo').textContent='App '+APP_VERSION;
  if(window.caches&&caches.keys) caches.keys().then(k=>{ k=k.filter(x=>x.startsWith('kasse-')); if(k.length) $('verInfo').textContent='App '+APP_VERSION+' · Offline-Speicher '+k.join(', '); }).catch(()=>{});
  const on=!!(SYNC&&SYNC.gist); if(!on) return;
  const L=$('diagList'); L.innerHTML='';
  $('diagN').textContent=CLOUD.length?CLOUD.length+(CLOUD.length===1?' Gerät':' Geräte'):'–';
  CLOUD.slice().sort((a,b)=>(b.file===myFile())-(a.file===myFile())).forEach(c=>{
    const me=c.file===myFile(), r=document.createElement('div'); r.className='drow2'+(me?' me':'');
    r.innerHTML='<span class="ava"></span><span class="dn"><b></b><small></small></span>';
    r.querySelector('.ava').textContent=initial(c.by||c.dev); r.querySelector('b').textContent=(c.by?c.by+' · ':'')+(c.dev||'Gerät')+(me?' (dieses)':'');
    r.querySelector('small').textContent=c.n+' Datensätze · '+(c.saved?rel(new Date(c.saved).getTime()):'');
    L.appendChild(r);
  });
  if(CLOUD.length<2){ const p=document.createElement('p'); p.className='shint'; p.textContent='Noch kein zweites Gerät. Auf dem anderen iPhone die App öffnen und denselben Token eingeben.'; L.appendChild(p); }
}
// Abgleich beim Öffnen, beim Zurückkehren in die App und wenn das Netz wiederkommt
document.addEventListener('visibilitychange',()=>{
  if(!SYNC||!SYNC.gist) return;
  if(document.visibilityState==='visible'&&(!SYNC.last||Date.now()-SYNC.last>3e4||SYNC.pending)) syncNow();
  if(document.visibilityState==='hidden'&&SYNC.pending) syncNow();
});
addEventListener('online',()=>{ if(SYNC&&SYNC.pending) syncNow(); });

/* 4. Alles als Datei sichern / wiederherstellen */
async function shareFile(text,name,type,title){
  try{
    const file=new File([text],name,{type});
    if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title}); return true; }
    const a=document.createElement('a'); a.href=URL.createObjectURL(file); a.download=name; document.body.appendChild(a); a.click(); a.remove(); return true;
  }catch(e){
    if(e&&e.name==='AbortError') return false;
    try{ await navigator.clipboard.writeText(text); return 'clip'; }catch(_){ throw e; }
  }
}
function bkStatus(){
  const last=loadJ('backup',null), el=$('bkLast');
  const days=last===null?null:Math.round((new Date(isoDay())-new Date(last))/864e5);
  el.textContent=last===null?'noch nie gesichert':days===0?'heute gesichert':'vor '+days+(days===1?' Tag':' Tagen');
  const synced=SYNC&&SYNC.last&&Date.now()-SYNC.last<14*864e5;
  el.className=liveCount()>=10&&!synced&&(last===null||days>=14)?'warn':'';
}
function bkMsg(t,err){ const m=$('bkMsg'); m.textContent=t; m.className='bkmsg'+(err?' err':''); m.hidden=false; }
$('bkOut').onclick=async()=>{
  const text=JSON.stringify({app:'geteilte-kasse',v:1,saved:new Date().toISOString(),db:DB,me:ME,name:MYNAME});
  const name='kasse-sicherung-'+isoDay()+'.json';
  try{
    const r=await shareFile(text,name,'application/json','Geteilte Kasse – Sicherung'); if(!r) return;
    saveJ('backup',isoDay()); bkStatus();
    bkMsg(r==='clip'?'Als Text in die Zwischenablage kopiert.':'Gesichert. Am besten in „Dateien" oder iCloud Drive ablegen.');
  }catch(e){ bkMsg('Sichern nicht möglich: '+(e&&e.message||e),true); }
};
const readText=f=>f.text?f.text():new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsText(f)});
$('bkIn').onclick=()=>$('bkFile').click();
$('bkFile').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  try{
    const d=JSON.parse(await readText(f));
    if(d.app!=='geteilte-kasse'||!d.db||typeof d.db.recs!=='object') throw new Error('keine gültige Sicherung');
    const n=Object.values(d.db.recs).filter(r=>(r.t==='e'||r.t==='p')&&!r.del).length;
    if(!await ask('Sicherung laden?','Stand vom '+new Date(d.saved).toLocaleDateString('de-DE')+' mit '+n+' Einträgen. Der aktuelle Stand wird ersetzt und vorher als Wiederherstellungspunkt gesichert.','Laden')) return;
    snapshot('vor Laden einer Datei');
    if(d.me){ ME={...d.me,...ME}; saveJ('me',ME); }
    if(d.name&&!MYNAME){ MYNAME=d.name; store.set('name',MYNAME); }
    restoreDB(d.db); bkStatus(); renderSnaps();
    bkMsg('Sicherung vom '+new Date(d.saved).toLocaleDateString('de-DE')+' geladen ('+n+' Einträge).');
  }catch(err){ bkMsg('Datei konnte nicht gelesen werden: '+err.message,true); }
};

/* ===================== Start ===================== */
$('newGroup').onclick=()=>openGroupForm(null);
renderHome();
dailySnap();
if(SYNC&&SYNC.gist){ setDot(SYNC.pending?'':'ok'); setTimeout(syncNow,600); }

/* ===================== Offline ===================== */
if('serviceWorker' in navigator){
  const hadCtl=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{    // neue Version hat übernommen: Neustart anbieten
    if(!hadCtl) return;
    const u=document.createElement('div'); u.className='upd';
    u.innerHTML='<span>Neue Version geladen</span><button>Neu starten</button>';
    u.querySelector('button').onclick=()=>location.reload(); document.body.appendChild(u);
  });
  addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
    // Falls eine andere App auf derselben Adresse unseren Offline-Speicher geräumt hat: neu befüllen
    if(window.caches&&navigator.onLine!==false) caches.keys().then(k=>{
      if(!k.some(x=>x.startsWith('kasse-'))) navigator.serviceWorker.ready.then(r=>r.active&&r.active.postMessage('recache'));
    }).catch(()=>{});
  });
}
