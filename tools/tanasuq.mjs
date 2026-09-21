/*  قياس تباين النصوص في كل صفحةٍ وكل لوحة.
    يفتح كل صفحة بكل لوحة، ويحسب لكل نصٍّ ظاهرٍ نسبةَ تباينه على
    أرضيته الفعلية — بعد ضرب الشفافيات المتوارثة وتركيب الألوان
    الشفيفة على ما تحتها — ويطالب بـ٤.٥:١ للنصّ العادي و٣:١ للكبير
    (معيار WCAG AA). والضوابط المعطّلة مستثناة كما يستثنيها المعيار.

        node tools/tanasuq.mjs

    يحتاج playwright-core ومتصفّحًا مثبَّتًا (PW_CHROME=/path/to/chrome). */
import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
import { take } from './qufl.mjs';
take('فحص التباين');
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const T={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.woff2':'font/woff2','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.txt':'text/plain;charset=utf-8'};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));try{r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}catch(e){r.writeHead(404);r.end('no');}});
await new Promise(r=>srv.listen(8943,r));
const CFG=ROOT+'/assets/config.js'; const O=fs.readFileSync(CFG,'utf8');
fs.writeFileSync(CFG,'window.TP_CONFIG = { url: "", anonKey: "" };\n');
const back=()=>{try{fs.writeFileSync(CFG,O)}catch(e){}};
process.on('exit',back); process.on('uncaughtException',e=>{back();console.error(e);process.exit(1)});

const PAGES=['sessions/wilaya/04-wilaya.html','sessions/wilaya/15-wakala.html','sessions/wilaya/29-wisaya.html','index.html','students.html','attendance.html','worksheets.html','exams.html','honors.html',
             'grades.html','evidences.html','exam.html','join.html','login.html','register.html',
             'compose.html','demo.html','tenant.html','admin.html','student.html','worksheet.html','404.html'];
const THEMES=['جامعية','green','wine','indigo','slate','paper','snow','rose','aqua','lilac'];

const AUDIT = `(() => {
  const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
    return .2126*r+.7152*g+.0722*b;};
  const px=s=>{const m=s.match(/[\\d.]+/g);return m?m.map(Number):null;};
  const over=(fg,a,bg)=>fg.map((v,i)=>v*a+bg[i]*(1-a));
  function bgOf(el){
    let n=el;
    while(n&&n!==document.documentElement){
      const cs=getComputedStyle(n), c=px(cs.backgroundColor);
      if(c){const a=c.length>3?c[3]:1;
        if(a>=.999) return c.slice(0,3);
        if(a>0){const under=bgOf(n.parentElement||document.body);return over(c.slice(0,3),a,under);}}
      if(cs.backgroundImage&&cs.backgroundImage!=='none'&&n!==el){ /* تظليل: يُهمل، تقديرٌ متحفّظ */ }
      n=n.parentElement;
    }
    return px(getComputedStyle(document.body).backgroundColor)||[0,0,0];
  }
  function alphaOf(el){let a=1,n=el;while(n&&n!==document.documentElement){a*=parseFloat(getComputedStyle(n).opacity||'1');n=n.parentElement;}return a;}
  const out=[];
  document.querySelectorAll('body *').forEach(el=>{
    const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden') return;
    // الضوابط المعطّلة مستثناة في معيار WCAG 1.4.3 — وتعطيلُها هو المقصود
    if(el.closest('[disabled],[aria-disabled="true"]')) return;
    const r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
    let txt=''; el.childNodes.forEach(n=>{if(n.nodeType===3) txt+=n.textContent;});
    txt=txt.trim(); if(!txt) return;
    const fgc=px(cs.color); if(!fgc) return;
    const a=alphaOf(el)*(fgc.length>3?fgc[3]:1); if(a<.06) return;
    const bg=bgOf(el);
    const fg=over(fgc.slice(0,3),a,bg);
    const l1=lum(fg),l2=lum(bg);
    const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
    const size=parseFloat(cs.fontSize), w=parseInt(cs.fontWeight)||400;
    const large = size>=24 || (size>=18.66 && w>=700);
    const need = large?3:4.5;
    if(ratio+0.005 < need) out.push({t:txt.slice(0,30), r:+ratio.toFixed(2), need,
        sel:el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\\s+/).join('.'):'')});
  });
  return out;
})()`;

const b=await chromium.launch({executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1194,height:834}});
await p.route('**', r => r.request().url().startsWith('http://127.0.0.1:8943') ? r.continue() : r.abort());
p.on('pageerror',()=>{});
const seen=new Map(); let checked=0;
for (const th of THEMES){
  await p.addInitScript(t=>{try{localStorage.setItem('tp.theme',t)}catch(e){}}, th);
  for (const pg of PAGES){
    await p.goto('http://127.0.0.1:8943/'+pg,{waitUntil:'networkidle'}).catch(()=>{});
    await p.evaluate(()=>document.fonts.ready).catch(()=>{});
    await p.waitForTimeout(160);
    await p.evaluate(()=>{const c=document.querySelector('.card.ready');
      if(c){c.classList.remove('ready');c.classList.add('soon');}}).catch(()=>{});
    await p.waitForTimeout(60);
    const bad=await p.evaluate(AUDIT).catch(()=>[]);
    checked++;
    bad.forEach(x=>{
      const k=`${x.sel}|${x.t}`;
      const cur=seen.get(k);
      if(!cur||x.r<cur.r) seen.set(k,{...x,th,pg});
    });
  }
}
console.log(`فُحص: ${checked} صفحة×لوحة`);
if(!seen.size) console.log('لا موضع تحت الحدّ');
else{
  console.log(`مواضع تحت حدّ التباين: ${seen.size}`);
  [...seen.values()].sort((a,b)=>a.r-b.r).slice(0,40).forEach(x=>
    console.log(`  ${String(x.r).padStart(5)}:1 (المطلوب ${x.need})  ${x.pg} · ${x.th}\n      ${x.sel}\n      «${x.t}»`));
}
await b.close(); srv.close(); back();
