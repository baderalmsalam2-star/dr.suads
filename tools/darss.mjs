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

//  ═══ والقلمُ مفتوح: لا تمشي الشريحة بمسٍّ ولا سحب ═══
//  كانت هذه الخطوةُ تقول «والإصبع يقلّب الشريحة والقلمُ مفتوح» —
//  وكان ذلك مقصودًا: القلمُ للكتابة والإصبعُ للتقليب. ثم قالت
//  الدكتورة: «كل ما أكتب كلمةً بالقلم تتغيّر الصفحة، لأني ألمس
//  الشاشة بالخطأ». فالسلوكُ تبدّل بالقصد، والخطوةُ تحفظ الجديد.
const fingerSwipe = () => p.evaluate(()=>{const t=(n,x)=>dispatchEvent(new TouchEvent(n,{bubbles:true,
  changedTouches:[new Touch({identifier:1,target:document.body,clientX:x,clientY:400})]}));
  t('touchstart',700); t('touchend',300);});
const onAt = () => p.evaluate(()=>[...document.querySelectorAll('.slide')].findIndex(s=>s.classList.contains('on')));

const before = await onAt();
await fingerSwipe();
await p.waitForTimeout(250);
ok('ولا يقلّبها الإصبع والقلمُ مفتوح', (await onAt()) === before, `${before} ← ${await onAt()}`);

//  ولا نقرةٌ على الشريحة
await p.evaluate(()=>document.querySelector('.slide.on')
  .dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
await p.waitForTimeout(250);
ok('ولا نقرةٌ على الشريحة', (await onAt()) === before, `${before} ← ${await onAt()}`);

//  ═══ والسهمُ أسفل الصفحة يقلّبها ═══
//  «خلّ تغيير الشاشة بسهمٍ أسفل الصفحة». وكان السهمان لا يظهران
//  إلا دون ٦٤٠ بكسلًا — والإيباد ١١٩٤، فلا سهمَ في جهاز الدرس.
ok('وسهما التنقّل ظاهران على الإيباد', await p.locator('#nextBtn').isVisible());
await p.locator('#nextBtn').click();
await p.waitForTimeout(250);
ok('والسهم يقلّبها والقلمُ مفتوح', (await onAt()) === before+1, `${before} ← ${await onAt()}`);
await p.locator('#prev').click();
await p.waitForTimeout(250);

//  ويعود التقليبُ باللمس متى أُغلق القلم
await p.locator('.inkbar button').first().click();
await p.waitForTimeout(200);
const shut = await onAt();
await fingerSwipe();
await p.waitForTimeout(250);
ok('ويعود التقليبُ باللمس متى أُغلق القلم', (await onAt()) === shut+1, `${shut} ← ${await onAt()}`);
await p.locator('.inkbar button').first().click();
await p.waitForTimeout(200);
await p.locator('#prev').click();
await p.waitForTimeout(250);

//  ═══ والقلم لا يقلّبها ═══
//  قلمُ أبل يُطلق لمسًا مع أحداث المؤشّر، وdeck.js يقرأ السحب
//  باللمس. فخطٌّ أعرضُ من ٤٥ بكسلًا كان يُقرأ سحبًا — وهو ما شكت
//  منه الدكتورة. ويُحاكى هنا بلمسٍ نوعُه stylus، وهو الطريق الذي
//  لم يمرّ عليه الفحصُ الأول أصلًا.
const where = () => p.evaluate(()=>[...document.querySelectorAll('.slide')].findIndex(s=>s.classList.contains('on')));

//  لمسٌ نوعُه stylus — كما يُصدره سفاري على الآيباد.
//  touchType ليس من خصائص مُنشئ Touch في كروميوم، فيُضبط بعده.
async function swipe(kind){
  await p.evaluate((kind)=>{
    const cv=document.querySelector('canvas.ink');
    const mk=(n,x)=>{
      const t=new Touch({identifier:1,target:cv,clientX:x,clientY:400});
      if (kind==='stylus') Object.defineProperty(t,'touchType',{value:'stylus'});
      cv.dispatchEvent(new TouchEvent(n,{bubbles:true,cancelable:true,
        changedTouches:[t], touches:n==='touchend'?[]:[t]}));
    };
    mk('touchstart',700); mk('touchmove',500); mk('touchend',300);
  }, kind);
  await p.waitForTimeout(300);
}

const at0 = await where();
await swipe('stylus');
ok('وخطُّ القلم لا يقلّب الشريحة', (await where()) === at0, `${at0} ← ${await where()}`);

//  والمسار الثاني: قلمٌ مُنزَلٌ الآن ولمسٌ بلا نوع — لمتصفّحٍ لا
//  يضع touchType. يُنزَّل القلم ولا يُرفع، ثم يُجرَّب السحب.
await p.evaluate(()=>{
  const cv=document.querySelector('canvas.ink');
  const r=cv.getBoundingClientRect();
  cv.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'pen',pointerId:7,
    bubbles:true,cancelable:true,buttons:1,clientX:r.left+r.width*0.4,clientY:r.top+r.height*0.4}));
});
const at2 = await where();
await swipe('plain');
ok('ولا يقلّبها لمسٌ والقلمُ مُنزَل', (await where()) === at2, `${at2} ← ${await where()}`);
await p.evaluate(()=>{
  const cv=document.querySelector('canvas.ink');
  cv.dispatchEvent(new PointerEvent('pointerup',{pointerType:'pen',pointerId:7,bubbles:true,buttons:0}));
});

await p.waitForTimeout(1400);      // يحين أجل الحفظ
await p.close();

p = await open();
await p.waitForTimeout(900);
ok('والخطُّ يعود بعد إعادة الفتح', await count(p) > 200, await count(p)+' بكسل');
await p.close();

await fetch(API+'/rest/v1/students',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({id:'st-ink',section_id:'wilaya:1',no:8,name:'طالبة القلم',
                       uid:'0000000008',auth_uid:'student-x',active:true})});
await fetch(API+'/__as/student-x');
p = await open();
ok('والطالبة ترى الشريط كذلك — لها دفترها',
   await p.locator('.inkbar').isVisible());

//  ودفترها غيرُ دفتر الدكتورة: تفتح الشريحة نفسها فلا تجد خطَّها
const hers = await count(p);
ok('ولا ترى ما خطّته الدكتورة', hers === 0, hers + ' بكسل');

//  ═══ ودفترُها يبقى ═══
//  كانت الخطوتان السابقتان تشهدان أن الشريط يظهر وأن الدفترين
//  مفترقان — ولا تشهد واحدةٌ منهما أن خطَّها يُحفظ. وكان لا يُحفظ:
//  content_write للمالكة وحدها. فكانت تخطّ فيظهر الخطّ — الطبقةُ
//  تضعه في الذاكرة قبل أن تسأل الخادم — ثم يردّه الخادم، فإذا
//  أعادت فتح المحاضرة ذهب دفترُها كلُّه. ولم يظهر ذلك لأن المحاكي
//  كان يقبل كلَّ كتابةٍ من كلِّ داخلة.
await p.evaluate(()=>document.querySelector('.inkbar button').click());   // قلم
await stroke(p,'pen',[[.25,.6],[.45,.62],[.65,.66]]);
const hend = await count(p);
ok('والطالبة تخطّ في دفترها', hend > 200, hend+' بكسل');
await p.waitForTimeout(1400);      // يحين أجل الحفظ
await p.close();

p = await open();
await p.waitForTimeout(900);
const back2 = await count(p);
ok('ودفترُها يبقى بعد إعادة الفتح', back2 > 200, back2+' بكسل');
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

// ═══ فصل الاختبارات عن أوراق العمل ═══
const EXAMS_URL='http://127.0.0.1:8994/exams.html?section=wilaya:1';
const SHEETS_URL='http://127.0.0.1:8994/worksheets.html?section=wilaya:1';
async function at(url){
  const q=await b.newPage({viewport:{width:1194,height:834}});
  await q.route('**', r=>{const u=r.request().url();
    return (u.startsWith('http://127.0.0.1:8994')||u.startsWith(API))?r.continue():r.abort();});
  await q.addInitScript(k=>{try{localStorage.setItem(k,JSON.stringify(
    {access_token:'tok',refresh_token:'r',expires_at:Date.now()/1000+3600,user:{id:'x'}}))}catch(e){}},
    'tp.sb.suad.session');
  q.on('dialog', d=>d.accept());
  await q.goto(url,{waitUntil:'networkidle'});
  await q.waitForTimeout(800);
  return q;
}

await fetch(API+'/__as/owner-1');
let q = await at(SHEETS_URL);
ok('أوراق العمل خلت من الاختبارات',
   (await q.locator('.exam-cards').count()) === 0);
await q.close();

q = await at(EXAMS_URL);
ok('وللاختبارات صفحتها', (await q.locator('.exam-cards .card').count()) >= 1);
ok('وفيها زرّ فتح',
   (await q.locator('#exams button', {hasText:'افتحيه للطالبات'}).count()) >= 1);
await q.locator('#exams button', {hasText:'افتحيه للطالبات'}).first().click();
await q.waitForTimeout(900);
await q.close();

await fetch(API+'/__as/student-x');
q = await at(SHEETS_URL);
ok('والطالبة لا ترى اختبارًا في أوراقها',
   (await q.locator('.exam-cards').count()) === 0);
await q.close();

q = await at(EXAMS_URL);
ok('ولا تفتح لها صفحة الاختبارات',
   /هذه الصفحة للدكتورة/.test(await q.locator('#exams').innerText()));
await q.close();

p = await home();
ok('والمفتوح يظهر لها في الرئيسية',
   (await p.locator('#examsHere .card').count()) === 1,
   String(await p.locator('#examsHere .card').count()));
await p.close();

await fetch(API+'/__as/owner-1');
q = await at(EXAMS_URL);
await q.locator('#exams button', {hasText:'أغلقيه'}).first().click();
await q.waitForTimeout(900);
await q.close();

await fetch(API+'/__as/student-x');
p = await home();
ok('ويُغلق فيختفي عنها', (await p.locator('#examsHere .card').count()) === 0);
await p.close();

// ═══ أعمال الطالبات ═══
const WORKS='http://127.0.0.1:8994/works.html?section=wilaya:1';
async function works(){
  const w=await b.newPage({viewport:{width:1194,height:834}});
  await w.route('**', r=>{const u=r.request().url();
    return (u.startsWith('http://127.0.0.1:8994')||u.startsWith(API))?r.continue():r.abort();});
  await w.addInitScript(k=>{try{localStorage.setItem(k,JSON.stringify(
    {access_token:'tok',refresh_token:'r',expires_at:Date.now()/1000+3600,user:{id:'x'}}))}catch(e){}},
    'tp.sb.suad.session');
  w.on('dialog', d=>d.accept());
  w.on('pageerror', e=>console.log('   ⚠ خطأ صفحة:', String(e).slice(0,140)));
  await w.goto(WORKS,{waitUntil:'networkidle'});
  await w.waitForTimeout(900);
  return w;
}

//  صفٌّ للطالبة مربوطٌ بحسابها — الرفع يشترطه (مسار التخزين يبدأ به)
await fetch(API+'/rest/v1/students',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({id:'st-w',section_id:'wilaya:1',no:9,name:'طالبة تجريبية',
                       uid:'0000000009',auth_uid:'stud-w',active:true})});

await fetch(API+'/__as/stud-w');
let g = await works();
ok('الطالبة ترى صندوق الرفع', await g.locator('#add').isVisible());

//  تُحاكى صورةٌ صغيرة يقبلها المتصفّح
async function put(page, name, mime, shared){
  await page.evaluate(async ({name,mime,shared})=>{
    const c=document.createElement('canvas'); c.width=40; c.height=30;
    const x=c.getContext('2d'); x.fillStyle='#0DABE2'; x.fillRect(0,0,40,30);
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    const dt=new DataTransfer();
    dt.items.add(new File([blob], name, {type:mime}));
    const inp=document.getElementById('wFile');
    inp.files=dt.files; inp.dispatchEvent(new Event('change',{bubbles:true}));
    document.getElementById('wTitle').value='عملٌ تجريبيّ';
    document.getElementById('wShared').checked=!!shared;
  },{name,mime,shared});
  await page.waitForTimeout(700);
  await page.locator('#wSave').click();
  await page.waitForTimeout(1500);
}

await put(g,'work.png','image/png',false);
ok('ترفع عملها فيظهر في قائمتها',
   (await g.locator('#list .card').count()) === 1,
   String(await g.locator('#list .card').count()));
ok('والأصل أنه خاصٌّ لا يُعرض',
   /خاصّ/.test(await g.locator('#list .card .badge').first().innerText()));
await g.close();

await fetch(API+'/__as/owner-1');
g = await works();
ok('والدكتورة ترى العمل', (await g.locator('#list .card').count()) === 1);
ok('ولا صندوقَ رفعٍ عندها', !(await g.locator('#add').isVisible()));
ok('ويُنبَّه أنه بلا إذن',
   /لم تأذن بعرضه/.test(await g.locator('#list').innerText()));
await g.close();

//  الطالبة تأذن
await fetch(API+'/__as/stud-w');
g = await works();
await g.locator('#list button', {hasText:'أوافق على عرضه'}).click();
await g.waitForTimeout(900);
ok('وتأذن بالعرض فتتبدّل الحالة',
   /مأذونٌ بعرضه/.test(await g.locator('#list .card .badge').first().innerText()));
await g.close();

await fetch(API+'/__as/owner-1');
g = await works();
await g.locator('#list button', {hasText:'اعرضيه'}).click();
await g.waitForTimeout(1200);
ok('والدكتورة تعرضه ملء الشاشة', await g.locator('#stage').isVisible());
ok('والصورة ظهرت فيه', (await g.locator('#stage img').count()) === 1);
await g.close();

// ═══ إجابة الطالبة على سؤال المحاضرة ═══
//  يُقاس بالأثر: لا «ظهرت الخيارات» بل «ضغطت فوصل الصفُّ إلى
//  الخادم»، ولا «ظهرت الحصيلة» بل «قالت أجابت ٢ وأصابت ١».
//  تُساق الشرائحُ بالمفاتيح كما تسوقها الدكتورة، لا بتبديل الأصناف
//  باليد: «كشف» في deck.js يعمل على شريحته هو، فلو زُوّر الصنف
//  عملت على غيرها ومرّ الفحصُ على ما لا يقع في الدرس.
async function toQ(page){
  for (let k=0;k<40;k++){
    if (await page.locator('.slide.on[data-q]').count()) return k;
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(60);
  }
  return -1;
}

//  ينتظر حتى يصحّ الشرط أو تنقضي المهلة — الكشفُ يبلغ جهازها
//  بالسؤال كلَّ ثلاث ثوانٍ لا في اللحظة.
async function till(fn, ms=8000){
  const end=Date.now()+ms;
  while (Date.now()<end){ if (await fn()) return true; await new Promise(r=>setTimeout(r,250)); }
  return false;
}

//  طالبتان في الكشف
for (const [id,uid,auth] of [['st-q1','0000000011','stud-q1'],['st-q2','0000000012','stud-q2']]) {
  await fetch(API+'/rest/v1/students',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id,section_id:'wilaya:1',no:+uid.slice(-2),name:'طالبة '+id,
                         uid,auth_uid:auth,active:true})});
}

await fetch(API+'/__as/stud-q1');
p = await open();
await toQ(p);
await p.waitForTimeout(400);
ok('خيارات السؤال تُضغط عند الطالبة',
   (await p.locator('.slide.on .opts li.tappable').count()) > 0);

//  تضغط الخيار الصحيح
const rightAt = await p.evaluate(()=>[...document.querySelectorAll('.slide.on .opts li')]
  .findIndex(li=>li.classList.contains('right')));
await p.locator('.slide.on .opts li').nth(rightAt).click();
await p.waitForTimeout(900);
ok('وتُعلَّم إجابتها', (await p.locator('.slide.on .opts li.mine').count()) === 1);
ok('ولا يُقال لها أصابت أم أخطأت',
   !/أصبت|أخطأ/.test(await p.locator('.slide.on').innerText()));
await p.close();

//  والثانية تخطئ
await fetch(API+'/__as/stud-q2');
p = await open();
await toQ(p);
await p.waitForTimeout(400);
const wrongAt = (rightAt + 1) % (await p.locator('.slide.on .opts li').count());
await p.locator('.slide.on .opts li').nth(wrongAt).click();
await p.waitForTimeout(900);
await p.close();

//  الدكتورة ترى الحصيلة
await fetch(API+'/__as/owner-1');
p = await open();
await toQ(p);
await p.waitForTimeout(1200);
const tal = (await p.locator('.tally').count()) ? await p.locator('.tally').innerText() : '';
ok('والدكتورة ترى الحصيلة', /أجابت/.test(tal), tal.replace(/\s+/g,' ').slice(0,70));
ok('وتقول كم أجابت وكم أصابت',
   /أجابت ٢/.test(tal) && /أصابت ١/.test(tal), tal.replace(/\s+/g,' ').slice(0,70));
ok('ولا خياراتٍ تُضغط عندها',
   (await p.locator('.slide.on .opts li.tappable').count()) === 0);
await p.close();

// ═══ الكشف يبلغ أجهزتهنّ ═══
//  الشاشة أمام الدكتورة واحدة والطالبات كلٌّ على جهازها: كان
//  «كشف» ينكشف عندها وحدها فتبقى شريحتُهنّ سؤالًا بلا تعليل.
await fetch(API+'/__as/stud-q1');
const ps = await open();
await toQ(ps);
await ps.waitForTimeout(500);
ok('قبل الكشف: لا جوابَ على جهاز الطالبة',
   (await ps.locator('.slide.on.reveal').count()) === 0 &&
   !(await ps.locator('.slide.on .answer').isVisible()));

//  والدكتورة تكشف على شاشتها. وقراءةُ «content» مباحةٌ للجميع،
//  فتبديلُ الهوية ههنا لا يقطع سؤالَ جهاز الطالبة.
await fetch(API+'/__as/owner-1');
const pd = await open();
await toQ(pd);
await pd.waitForTimeout(1200);
ok('وعند الدكتورة زرُّ الكشف لهنّ',
   (await pd.locator('.tally .foldq').innerText()).includes('اكشفي'));
await pd.keyboard.press(' ');
await pd.waitForTimeout(900);

ok('فيبلغ جهازَ الطالبة', await till(()=>ps.locator('.slide.on.reveal').count()));
ok('ويظهر لها التعليل', await ps.locator('.slide.on .answer').isVisible());

//  ويُطوى فيعود السؤال سؤالًا
ok('والزرّ صار طيًّا',
   (await pd.locator('.tally .foldq').innerText()).includes('اطوِ'));
await pd.locator('.tally .foldq').click();
await pd.waitForTimeout(900);
ok('والطيُّ يبلغها كما بلغها الكشف',
   await till(async()=>(await ps.locator('.slide.on.reveal').count()) === 0));
await pd.close(); await ps.close();

console.log(`\n── الحصيلة ──\nحالات: ${step.length} · نجح ${step.filter(Boolean).length} · فشل ${step.filter(x=>!x).length}`);
await b.close(); srv.close(); mock.kill(); back();
process.exit(step.every(Boolean)?0:1);
