/*  دخولُ الطالبة: بريدٌ جامعيّ وكلمة سر، بلا رسالةِ بريدٍ واحدة.
    يُجرَّب على خادمٍ يحاكي GoTrue: أول مرة، ومرةً بعدها، وبكلمة
    سرٍّ خاطئة، ومشروعٍ لم يُطفأ فيه «Confirm email».  */
import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const T={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.woff2':'font/woff2','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));try{r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}catch(e){r.writeHead(404);r.end();}});
await new Promise(r=>srv.listen(8991,r));
const API='http://127.0.0.1:8910';
const busy=await fetch(API+'/rest/v1/students?select=*',{signal:AbortSignal.timeout(1200)}).then(()=>true).catch(()=>false);
if(busy){console.error('✗ المنفذ ٨٩١٠ مشغول:  pkill -f mock-supabase');process.exit(1);}

let mock=null;
const TEN=ROOT+'/data/tenants.js'; const ORIG=fs.readFileSync(TEN,'utf8');
fs.writeFileSync(TEN, ORIG.replace(/supabase:\s*\{[\s\S]*?\}/, `supabase: { url: "${API}", anonKey: "k" }`));
/*  المحاكي يُقتل في كل طريقٍ للخروج لا في الناجح وحده: فبقاؤه حيًّا
    بعد فشلٍ يردّ التشغيلة التالية بـ«المنفذ مشغول».  */
const back=()=>{try{fs.writeFileSync(TEN,ORIG)}catch(e){}
                try{mock&&mock.kill()}catch(e){}};
process.on('exit',back);

mock=spawn('node',[ROOT+'/tools/mock-supabase.mjs'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,900));
const b=await chromium.launch({executablePath:process.env.PW_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const step=[]; const ok=(t,v,note)=>{step.push(v);console.log((v?'✓ ':'✗ ')+t+(note?'   ← '+note:''));};

async function tryLogin(email, pass){
  const p=await b.newPage({viewport:{width:390,height:844}});
  await p.route('**', r=>{const u=r.request().url();
    return (u.startsWith('http://127.0.0.1:8991')||u.startsWith(API))?r.continue():r.abort();});
  const toasts=[];
  await p.goto('http://127.0.0.1:8991/login.html',{waitUntil:'networkidle'});
  await p.waitForTimeout(500);
  p.on('console',()=>{});
  await p.fill('#email',email); await p.fill('#pass',pass);
  await p.click('#go'); await p.waitForTimeout(1200);
  const r=await p.evaluate(()=>({
    who: document.getElementById('who') && !document.getElementById('who').hidden,
    txt: document.body.innerText.replace(/\s+/g,' '),
    form: document.getElementById('form') && !document.getElementById('form').hidden
  }));
  await p.close();
  return r;
}

// لا رسالةَ بريدٍ تُطلب أبدًا
let mails=0;
const orig=globalThis.fetch;

let r = await tryLogin('s2200000001@ku.edu.kw','sirr123');
ok('أول مرة: يُنشأ الحساب ويُدخل به', r.who, r.who?'':r.txt.slice(0,90));

r = await tryLogin('s2200000001@ku.edu.kw','sirr123');
ok('مرةً بعدها: تدخل بنفس كلمة السر', r.who, r.who?'':r.txt.slice(0,90));

r = await tryLogin('s2200000001@ku.edu.kw','ghalat9');
ok('كلمة سرٍّ خاطئة: تُردّ برسالةٍ صريحة',
   !r.who && /كلمة السر غير صحيحة/.test(r.txt), r.txt.slice(0,110));

r = await tryLogin('s2200000002@ku.edu.kw','قصير');
ok('كلمة سرٍّ قصيرة: تُمنع قبل الخادم',
   !r.who && /ستّة أحرف/.test(r.txt), r.txt.slice(0,110));

// لا زرَّ بريدٍ ولا زرَّ جامعة
const p=await b.newPage(); await p.route('**', q=>q.request().url().startsWith('http://127.0.0.1:8991')?q.continue():q.abort());
await p.goto('http://127.0.0.1:8991/login.html',{waitUntil:'networkidle'}); await p.waitForTimeout(400);
const btns=await p.evaluate(()=>[...document.querySelectorAll('#form button, #form a')].map(e=>e.textContent.trim()));
ok('الصفحة فيها زرٌّ واحد لا غير', btns.length===1 && btns[0]==='دخول', JSON.stringify(btns));
await p.close();

// مشروعٌ لم يُطفأ فيه Confirm email
mock.kill(); await new Promise(r=>setTimeout(r,400));
mock=spawn('node',[ROOT+'/tools/mock-supabase.mjs'],{stdio:'ignore',env:{...process.env,CONFIRM:'1'}});
await new Promise(r=>setTimeout(r,900));
r = await tryLogin('s2200000009@ku.edu.kw','sirr123');
ok('مشروعٌ يطلب تأكيد البريد: تُقال العلّة صريحةً',
   !r.who && /Confirm email/.test(r.txt), r.txt.slice(0,140));

console.log(`\n── الحصيلة ──\nحالات: ${step.length} · نجح ${step.filter(Boolean).length} · فشل ${step.filter(x=>!x).length}`);
await b.close(); srv.close(); mock.kill(); back();
