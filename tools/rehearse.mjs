/*  بروفةُ يومٍ دراسيّ: رحلة الطالبة كاملةً عبر صفحات المنصة نفسها،
    على خادمٍ يطبّق عقد PostgREST الذي يتكلّمه المحوّل.

    تُشغَّل قبل كل إطلاق: تُثبت أن الدكتورة تحفظ الكشف، وأن الطالبة
    ترى محاضراتها وتسلّم ورقتها ويُسجَّل حضورها بالباركود، وأن ما
    فعلته يصل إلى شاشة الدكتورة. ثماني خطوات، إن سقطت واحدة سقط
    يومٌ في القاعة.

        cd tools && npm i && node rehearse.mjs

    تحتاج mock-supabase.mjs بجانبها (محاكي الخادم).  */
import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { spawn } from 'child_process';

const ROOT=path.dirname(path.dirname(new URL(import.meta.url).pathname));
const T={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.woff2':'font/woff2','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.sql':'text/plain;charset=utf-8'};

// ١) خادم الملفات
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  try{r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}
  catch(e){r.writeHead(404);r.end('no');}});
await new Promise(r=>srv.listen(8961,r));

// ٢) خادم البيانات
const mock=spawn('node',['mock-supabase.mjs'],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
await new Promise(r=>setTimeout(r,900));
const API='http://127.0.0.1:8910';
const as=u=>fetch(API+'/__as/'+encodeURIComponent(u));

// ٣) اربط السجلّ بالخادم الوهمي (يُرجَع في النهاية)
const TEN=ROOT+'/data/tenants.js'; const ORIG=fs.readFileSync(TEN,'utf8');
fs.writeFileSync(TEN, ORIG.replace('supabase: { url: "", anonKey: "" }',
  `supabase: { url: "${API}", anonKey: "test-anon-key" }`));
const back=()=>{try{fs.writeFileSync(TEN,ORIG)}catch(e){}};
process.on('exit',back); process.on('uncaughtException',e=>{back();console.error(e);process.exit(1)});

const b=await chromium.launch({executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const errs=[];
async function page(){
  const p=await b.newPage({viewport:{width:1194,height:834}});
  await p.route('**', r=>{const u=r.request().url();
    return (u.startsWith('http://127.0.0.1:8961')||u.startsWith(API)) ? r.continue() : r.abort();});
  p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  // جلسةٌ صالحة في المتصفّح
  await p.addInitScript(k=>{try{localStorage.setItem(k,JSON.stringify(
    {access_token:'tok',refresh_token:'r',expires_at:Date.now()/1000+3600,user:{id:'x'}}))}catch(e){}},
    'tp.sb.suad.session');
  return p;
}
const U='http://127.0.0.1:8961/';
const step=[]; const ok=(t,v)=>{step.push([t,!!v]); console.log((v?'✓ ':'✗ ')+t);};

// ═══ الدكتورة: كشف الطالبات وجدول المحاضرة ═══
await as('owner-1');
let p=await page();
await p.goto(U+'students.html',{waitUntil:'networkidle'}); await p.waitForTimeout(400);
const saved=await p.evaluate(async()=>{
  await Store.saveStudent({no:1,sectionId:'wilaya:1',name:'الطالبة الأولى',uid:'0000000001'});
  await Store.saveStudent({no:2,sectionId:'wilaya:1',name:'الطالبة الثانية',uid:'0000000002'});
  const all=await Store.students('wilaya:1');
  return all.filter(s=>!s.placeholder).length;
});
ok('الدكتورة تحفظ كشف الطالبات على الخادم ('+saved+')', saved===2);

const sid=await p.evaluate(async()=>(await Store.students('wilaya:1')).find(s=>s.no===1).id);
// اربط حساب الطالبة الأولى
await p.evaluate(async(id)=>{const s=(await Store.students('wilaya:1')).find(x=>x.id===id);
  await Store.saveStudent(Object.assign({},s,{authUid:'sara-uid'}));}, sid);
await p.evaluate(async()=>{ await Store.saveSchedule('wilaya:1',[{session:1,day:new Date().toISOString().slice(0,10)}]); }).catch(()=>{});
await p.close();

// ═══ الطالبة: تفتح المنصة وترى محاضراتها ═══
await as('sara-uid');
p=await page();
await p.goto(U+'index.html?section=wilaya:1',{waitUntil:'networkidle'}); await p.waitForTimeout(500);
const cards=await p.evaluate(()=>document.querySelectorAll('.card').length);
ok('الطالبة ترى المحاضرات الثلاثين ('+cards+')', cards>=30);

// ═══ الطالبة: تحلّ ورقة عمل وتسلّمها ═══
await p.goto(U+'worksheet.html?w=wilaya:h1&section=wilaya:1',{waitUntil:'networkidle'});
await p.waitForTimeout(600);
const sub=await p.evaluate(async()=>{
  const ta=document.querySelector('textarea');
  if(!ta) return {found:false};
  ta.value='إجابة الطالبة في البروفة'; ta.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,300));
  const btns=[...document.querySelectorAll('button')].map(b=>b.textContent.trim());
  const btn=[...document.querySelectorAll('button')].find(b=>/سلّم|تسليم/.test(b.textContent));
  if(btn) btn.click();
  await new Promise(r=>setTimeout(r,900));
  return {found:true, clicked:!!btn, btns, body:document.body.innerText.slice(0,200)};
});
ok('الطالبة تكتب إجابتها وتضغط التسليم', sub.found && sub.clicked);
if(!(sub.found&&sub.clicked)) console.log('   أزرار الصفحة:', JSON.stringify(sub.btns), '\n   الصفحة:', sub.body);
const stored=await p.evaluate(async()=>{
  const rows=await Store.submissions('wilaya:1','h1'); return rows.length;
});
ok('التسليم وصل الخادم ('+stored+' صفّ)', stored>=1);
await p.close();

// ═══ الدكتورة: ترى التسليم ═══
await as('owner-1');
p=await page();
await p.goto(U+'worksheets.html?section=wilaya:1',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
const seen=await p.evaluate(async()=>{
  const rows=await Store.submissions('wilaya:1','h1');
  return rows.map(r=>JSON.stringify(r.answers||{}).includes('البروفة')).filter(Boolean).length;
});
ok('الدكتورة تقرأ إجابة الطالبة ('+seen+')', seen>=1);

// ═══ الحضور بالباركود ═══
const code=await p.evaluate(async()=>{
  const n=[...crypto.getRandomValues(new Uint8Array(16))].map(b=>('0'+b.toString(16)).slice(-2)).join('');
  await Store.issueCode('wilaya:1',1,n,25); return n;
});
ok('الدكتورة تُصدر رمز حضورٍ دوّارًا', !!code && code.length===32);
await p.close();

await as('sara-uid');
p=await page();
await p.goto(U+'attend.html?c='+code,{waitUntil:'networkidle'}); await p.waitForTimeout(900);
const marked=await p.evaluate(()=>document.body.innerText);
ok('الطالبة تمسح الرمز فيُسجَّل حضورها', /سُجّل|حضور|تم/.test(marked));
await p.close();

await as('owner-1');
p=await page();
await p.goto(U+'attendance.html?section=wilaya:1',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
const att=await p.evaluate(async()=>(await Store.attendance('wilaya:1',1)).filter(a=>a.status==='present').length);
ok('الدكتورة ترى الحضور المسجَّل ('+att+')', att>=1);
await p.close();

console.log('\n── الحصيلة ──');
const bad=step.filter(s=>!s[1]);
console.log(`خطوات الرحلة: ${step.length} · نجح ${step.length-bad.length} · فشل ${bad.length}`);
if(errs.length) console.log('\nأخطاء صفحات:\n  '+[...new Set(errs)].join('\n  '));
await b.close(); srv.close(); mock.kill(); back();
