/*  أدواتُ الدرس: الكتابة بالقلم، وفتحُ المحاضرة للطالبات.

    تُقاس بالأثر لا بالمظهر: لا «أظهر الزرّ» بل «خطَّ القلمُ بكسلًا
    على اللوح»، ولا «اختفت البطاقة» بل «لم تعد في القائمة عند
    الطالبة وهي فيها عند الدكتورة».  */
import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { take } from './qufl.mjs';
take('فحص أدوات الدرس');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const T = {'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.woff2':'font/woff2','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv = http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  try{r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}
  catch(e){r.writeHead(404);r.end();}});
await new Promise(r=>srv.listen(8994,r));

const API='http://127.0.0.1:8910';
const busy=await fetch(API+'/rest/v1/content?select=*',{signal:AbortSignal.timeout(1200)}).then(()=>true).catch(()=>false);
if(busy){console.error('✗ المنفذ ٨٩١٠ مشغول:  pkill -f mock-supabase');process.exit(1);}

const TEN=ROOT+'/data/tenants.js'; const ORIG=fs.readFileSync(TEN,'utf8');
fs.writeFileSync(TEN, ORIG.replace(/supabase:\s*\{[\s\S]*?\}/, `supabase: { url: "${API}", anonKey: "k" }`));
let mock=null;
const back=()=>{try{fs.writeFileSync(TEN,ORIG)}catch(e){} try{mock&&mock.kill()}catch(e){}};
process.on('exit',back);

mock=spawn('node',[ROOT+'/tools/mock-supabase.mjs'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,900));

const b=await chromium.launch({executablePath:process.env.PW_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const step=[]; const ok=(t,v,note)=>{step.push(v);console.log((v?'✓ ':'✗ ')+t+(note?'   ← '+note:''));};

const URL8994='http://127.0.0.1:8994/sessions/wilaya/03-wilaya.html?section=1';
async function open(){
  const p=await b.newPage({viewport:{width:1194,height:834}});
  await p.route('**', r=>{const u=r.request().url();
    return (u.startsWith('http://127.0.0.1:8994')||u.startsWith(API))?r.continue():r.abort();});
  //  جلسةٌ صالحة في المتصفّح — بلا جلسةٍ لا يُسأل الخادمُ عن الدور
  await p.addInitScript(k=>{try{localStorage.setItem(k,JSON.stringify(
    {access_token:'tok',refresh_token:'r',expires_at:Date.now()/1000+3600,user:{id:'x'}}))}catch(e){}},
    'tp.sb.suad.session');
  p.on('pageerror',e=>console.log('   ⚠ خطأ صفحة:',String(e).slice(0,120)));
  //  Playwright يرفض نوافذ التأكيد تلقائيًّا ما لم يُقَل له غير ذلك.
  //  فكان «أرجعي الأصل» يُلغى قبل أن يبدأ، فيُقرأ العطبُ في المنصة
  //  وهو في الفحص. والقبول هنا يحاكي الدكتورة وهي تضغط «موافق».
  p.on('dialog', d=>d.accept());
  await p.goto(URL8994,{waitUntil:'networkidle'});
  await p.waitForTimeout(700);
  return p;
}

//  يُرسَم بحدثٍ صريح النوع، فيُقاس الفصلُ بين القلم والراحة حقًّا.
async function stroke(p, type, pts){
  await p.evaluate(({type,pts})=>{
    const cv=document.querySelector('canvas.ink');
    const r=cv.getBoundingClientRect();
    const ev=(n,x,y,extra={})=>cv.dispatchEvent(new PointerEvent(n,{
      pointerType:type,pointerId:1,bubbles:true,cancelable:true,buttons:1,
      clientX:r.left+x*r.width,clientY:r.top+y*r.height,...extra}));
    ev('pointerdown',pts[0][0],pts[0][1]);
    for(let k=1;k<pts.length;k++) ev('pointermove',pts[k][0],pts[k][1]);
    ev('pointerup',pts[pts.length-1][0],pts[pts.length-1][1],{buttons:0});
  },{type,pts});
  await p.waitForTimeout(120);
}
const count = p => p.evaluate(()=>{
  const c=document.querySelector('canvas.ink');
  const x=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let n=0; for(let k=3;k<x.length;k+=4) if(x[k]>0) n++;
  return n;
});

await fetch(API+'/__as/owner-1');
let p = await open();
ok('شريط القلم يظهر للدكتورة', await p.locator('.inkbar').isVisible());

await p.evaluate(()=>document.querySelector('.inkbar button').click());   // قلم
await stroke(p,'pen',[[.3,.4],[.5,.45],[.7,.5]]);
const drawn = await count(p);
ok('القلم يكتب على الشريحة', drawn > 200, drawn+' بكسل');

await stroke(p,'touch',[[.2,.7],[.6,.75]]);
ok('الراحة والإصبع لا يكتبان', await count(p) === drawn, await count(p)+' بكسل');

//  الإصبعُ يقلّب وإن كان القلم مفتوحًا
const before = await p.evaluate(()=>[...document.querySelectorAll('.slide')].findIndex(s=>s.classList.contains('on')));
await p.evaluate(()=>{const t=(n,x)=>dispatchEvent(new TouchEvent(n,{bubbles:true,
  changedTouches:[new Touch({identifier:1,target:document.body,clientX:x,clientY:400})]}));
  t('touchstart',700); t('touchend',300);});
await p.waitForTimeout(250);
const after = await p.evaluate(()=>[...document.querySelectorAll('.slide')].findIndex(s=>s.classList.contains('on')));
ok('والإصبع يقلّب الشريحة والقلمُ مفتوح', after === before+1, `${before} ← ${after}`);

await p.waitForTimeout(1400);      // يحين أجل الحفظ
await p.close();

p = await open();
await p.waitForTimeout(900);
ok('والخطُّ يعود بعد إعادة الفتح', await count(p) > 200, await count(p)+' بكسل');
await p.close();

await fetch(API+'/__as/student-x');
p = await open();
ok('والطالبة لا ترى الشريط', !(await p.locator('.inkbar').isVisible()));
await p.close();

// ═══ فتحُ المحاضرة للطالبات ═══
const HOME='http://127.0.0.1:8994/index.html';
async function home(){
  const p=await b.newPage({viewport:{width:1194,height:834}});
  await p.route('**', r=>{const u=r.request().url();
    return (u.startsWith('http://127.0.0.1:8994')||u.startsWith(API))?r.continue():r.abort();});
  await p.addInitScript(k=>{try{localStorage.setItem(k,JSON.stringify(
    {access_token:'tok',refresh_token:'r',expires_at:Date.now()/1000+3600,user:{id:'x'}}))}catch(e){}},
    'tp.sb.suad.session');
  p.on('dialog', d=>d.accept());
  await p.goto(HOME,{waitUntil:'networkidle'});
  await p.waitForTimeout(800);
  return p;
}
const cards = p => p.locator('#sessions li.card').count();

await fetch(API+'/__as/owner-1');
p = await home();
const forStaff = await cards(p);
ok('الدكتورة ترى محاضراتها كلَّها', forStaff > 1, forStaff+' بطاقة');
ok('وفي كل بطاقةٍ زرُّ فتح',
   (await p.locator('#sessions button', {hasText:'افتحيها للطالبات'}).count()) > 1);

//  تُفتح الثالثة وحدها
await p.evaluate(()=>{
  const li=[...document.querySelectorAll('#sessions li.card')]
    .find(x=>/المحاضرة ٣/.test(x.textContent));
  li.querySelector('button').click();
});
await p.waitForTimeout(900);
await p.close();

await fetch(API+'/__as/student-x');
p = await home();
const forStudent = await cards(p);
ok('والطالبة لا ترى إلا ما فُتح', forStudent === 1, forStudent+' بطاقة');
ok('وهي التي فُتحت لا غيرها',
   /المحاضرة ٣/.test(await p.locator('#sessions li.card').first().innerText()));
await p.close();

//  ثم تُغلق فتعود القائمة خالية
await fetch(API+'/__as/owner-1');
p = await home();
await p.evaluate(()=>{
  const li=[...document.querySelectorAll('#sessions li.card')]
    .find(x=>/المحاضرة ٣/.test(x.textContent));
  li.querySelector('button').click();
});
await p.waitForTimeout(900);
await p.close();

await fetch(API+'/__as/student-x');
p = await home();
ok('وتُغلق فتختفي', (await cards(p)) === 0, (await cards(p))+' بطاقة');
await p.close();

// ═══ تحرير نصّ الشريحة ═══
await fetch(API+'/__as/owner-1');
p = await open();
ok('شريط التحرير يظهر للدكتورة', await p.locator('.tahrirbar').isVisible());

const rubric = () => p.evaluate(()=>document.querySelector('.slide.on .rubric')?.innerText.trim());
await p.evaluate(()=>[...document.querySelectorAll('.slide')][1].classList.add('on'));
await p.evaluate(()=>[...document.querySelectorAll('.slide')][0].classList.remove('on'));
const was = await rubric();

await p.locator('.tahrirbar button', {hasText:'تحرير'}).click();
await p.evaluate(()=>{const r=document.querySelector('.slide.on .rubric');
  r.textContent='عنوانٌ كتبته الدكتورة';});
await p.locator('.tahrirbar button', {hasText:'احفظي'}).click();
await p.waitForTimeout(900);
await p.close();

p = await open();
await p.evaluate(()=>{[...document.querySelectorAll('.slide')].forEach((s,k)=>
  s.classList.toggle('on', k===1));});
ok('النصّ المحرَّر يعود بعد إعادة الفتح',
   (await rubric()) === 'عنوانٌ كتبته الدكتورة', await rubric());

const slidesNow = () => p.evaluate(()=>document.querySelectorAll('.folio .inner .slide').length);
const n0 = await slidesNow();
await p.locator('.tahrirbar button', {hasText:'أرجعي الأصل'}).click();
//  الحذف رحلتان إلى الخادم ثم إعادةُ تحميل. وثلاثُ مئة مللي ثانية
//  لا تكفيها، فتُغلق الصفحةُ والطلبُ في الطريق — فيُقرأ العطبُ في
//  المنصة وهو في التوقيت.
await p.waitForLoadState('networkidle');
await p.waitForTimeout(900);
await p.close();

p = await open();
await p.evaluate(()=>{[...document.querySelectorAll('.slide')].forEach((s,k)=>
  s.classList.toggle('on', k===1));});
ok('و«أرجعي الأصل» يُعيد نصّ المذكرة', (await rubric()) === was, await rubric());

//  الحذف ثم الإرجاع
await p.evaluate(()=>{[...document.querySelectorAll('.slide')].forEach((s,k)=>
  s.classList.toggle('on', k===1));});
await p.locator('.tahrirbar button', {hasText:'احذفي'}).click();
await p.waitForLoadState('networkidle');
await p.waitForTimeout(700);
await p.close();

p = await open();
const n1 = await slidesNow();
ok('الحذف يرفع الشريحة من العرض', n1 === n0-1, `${n0} ← ${n1}`);

await p.locator('.tahrirbar button', {hasText:'المحذوفة'}).click();
await p.waitForLoadState('networkidle');
await p.waitForTimeout(700);
await p.close();
p = await open();
ok('و«المحذوفة» تُرجعها', (await slidesNow()) === n0, String(await slidesNow()));

//  الإضافة
await p.evaluate(()=>{[...document.querySelectorAll('.slide')].forEach((s,k)=>
  s.classList.toggle('on', k===1));});
await p.locator('.tahrirbar button', {hasText:'أضيفي بعدها'}).click();
await p.waitForLoadState('networkidle');
await p.waitForTimeout(700);
await p.close();
p = await open();
ok('وتُضاف شريحةٌ بعد المختارة', (await slidesNow()) === n0+1, String(await slidesNow()));
await p.close();

await fetch(API+'/__as/student-x');
p = await open();
ok('والطالبة لا ترى شريط التحرير', !(await p.locator('.tahrirbar').isVisible()));
await p.close();

console.log(`\n── الحصيلة ──\nحالات: ${step.length} · نجح ${step.filter(Boolean).length} · فشل ${step.filter(x=>!x).length}`);
await b.close(); srv.close(); mock.kill(); back();
process.exit(step.every(Boolean)?0:1);
