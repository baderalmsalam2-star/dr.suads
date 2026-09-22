/* محاكي PostgREST + Auth + Storage لاختبار المحوّل.
   ليس Supabase الحقيقي — لكنه يطبّق نفس عقد HTTP الذي يستعمله المحوّل. */
import http from 'http';
const DB = { students: [], events: [], attendance: [], submissions: [], schedule: [],
             grades: [], scheme: [], attend_codes: [], content: [], works: [], replies: [],
             owners: [{uid:'owner-1'}] };
// من هو الداخل؟ يُضبط من الاختبار عبر /__as/<uid>
let WHO = 'owner-1';
// حسابات GoTrue: البريد ← كلمة السر
const USERS = new Map();
const FILES = new Map();
const PK = { students:['id'], events:['id'], attendance:['id'], submissions:['id'],
             grades:['id'], scheme:['section_id'], schedule:['section_id','session'],
             attend_codes:['section_id','session'], content:['id'], works:['id'],
             replies:['student_id','session','q'],
             owners:['uid'] };

const send = (res, code, body, extra={}) => {
  res.writeHead(code, {
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'*',
    'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Expose-Headers':'*',
    'Content-Type':'application/json', ...extra });
  res.end(body===null?'':(typeof body==='string'?body:JSON.stringify(body)));
};

function match(row, params) {
  for (const [k,v] of params) {
    if (['select','order','on_conflict','columns'].includes(k)) continue;
    const m = /^(eq|gte|gt|lte|lt|neq)\.(.*)$/.exec(v);
    if (m) {
      const val = String(row[k] ?? '');
      const t = m[2];
      if (m[1]==='eq'  && val !== t) return false;
      if (m[1]==='neq' && val === t) return false;
      if (m[1]==='gte' && !(val >= t)) return false;
      if (m[1]==='gt'  && !(val >  t)) return false;
      if (m[1]==='lte' && !(val <= t)) return false;
      if (m[1]==='lt'  && !(val <  t)) return false;
      continue;
    }
    const ni = /^not\.in\.\((.*)\)$/.exec(v);
    if (ni) {
      const set = ni[1] ? ni[1].split(',').map(decodeURIComponent) : [];
      if (set.includes(String(row[k]))) return false;
      continue;
    }
    return false;
  }
  return true;
}

//  من هو داخلٌ الآن، وبريده، ومن المالكات. تُضبط من /__as/ ومن
//  /__owner/ في أدوات الفحص.
let WHO_EMAIL = '';
const OWNERS = new Set(['owner']);
const EMAIL_OF = new Map();
const SESSIONS = new Set();

const server = http.createServer((req,res)=>{
  if (req.method==='OPTIONS') return send(res,204,null);
  const u = new URL(req.url, 'http://x');
  //  الجسم يُجمع بايتاتٍ لا حروفًا: رفعُ صورةٍ جسمُه ثنائيّ، وجمعُه
  //  نصًّا يُفسده فلا تُعاد الصورةُ كما رُفعت.
  const chunks=[]; req.on('data',d=>chunks.push(Buffer.from(d))); req.on('end',()=>{
    const raw = Buffer.concat(chunks);
    const body = raw.length ? raw.toString('utf8') : '';
    //  وما ليس JSON لا يُسقط الخادم. كان JSON.parse يُنادى على كل
    //  جسم، فأولُ رفعِ ملفٍّ يرمي SyntaxError خارج أيِّ try فيموت
    //  المحاكي — ويظهر في المتصفّح ERR_CONNECTION_REFUSED، فيُظنّ
    //  العطبُ في الصفحة وهو في أداة الفحص.
    let json = null;
    try { json = body ? JSON.parse(body) : null; } catch (e) { json = null; }

    // ── auth: يحاكي GoTrue بكلمة السر ──
    //  الحسابات في الذاكرة. و CONFIRM=1 يحاكي مشروعًا لم يُطفأ فيه
    //  «Confirm email»، فيردّ التسجيلُ بلا رمز دخول.
    if (u.pathname.startsWith('/auth/v1/signup')) {
      const em = (json && json.email || '').toLowerCase();
      const pw = json && json.password || '';
      if (USERS.has(em)) return send(res,422,{msg:'User already registered'});
      if (pw.length < 6) return send(res,422,{msg:'Password should be at least 6 characters'});
      USERS.set(em, pw);
      if (process.env.CONFIRM === '1')
        return send(res,200,{id:'u-'+USERS.size, email:em});      /* بلا access_token */
      return send(res,200,{access_token:'tok-'+em, refresh_token:'r', expires_in:3600,
                           user:{id:'u-'+USERS.size, email:em}});
    }
    if (u.pathname.startsWith('/auth/v1/token')) {
      if (/grant_type=password/.test(u.search)) {
        const em = (json && json.email || '').toLowerCase();
        const pw = json && json.password || '';
        if (!USERS.has(em) || USERS.get(em) !== pw)
          return send(res,400,{error:'invalid_grant', error_description:'Invalid login credentials'});
        return send(res,200,{access_token:'tok-'+em, refresh_token:'r', expires_in:3600});
      }
      return send(res,200,{access_token:'tok-owner', refresh_token:'r', expires_in:3600});
    }
    if (u.pathname==='/auth/v1/user') {
      //  PUT /user = تغيير كلمة السر بالرمز الذاتي. GoTrue يردّ خطأً
      //  إن كانت الجديدة كالقديمة، فيُحاكى ليُقاس الردّ عند الطالبة.
      if (req.method==='PUT') {
        const pw = json && json.password || '';
        const em = (WHO_EMAIL || (WHO+'@example.com')).toLowerCase();
        if (pw.length < 6) return send(res,422,{msg:'Password should be at least 6 characters'});
        if (USERS.get(em) === pw) return send(res,422,{msg:'New password should be different from the old password.'});
        USERS.set(em, pw);
        return send(res,200,{id:WHO, email:em});
      }
      return send(res,200,{id:WHO, email:(WHO_EMAIL || WHO+'@example.com')});
    }

    // ── rpc: reset_student_password — يطبّق حرّاس الدالة نفسها ──
    if (u.pathname === '/rest/v1/rpc/reset_student_password') {
      if (!OWNERS.has(WHO)) return send(res,403,{message:'لا صلاحية لهذا الإجراء'});
      const pw = json && json.p_new || '';
      if (pw.length < 8) return send(res,400,{message:'كلمة السر ثمانية أحرف فأكثر'});
      const st = DB.students.find(x => x.id === (json && json.p_student));
      if (!st || !st.auth_uid)
        return send(res,400,{message:'هذا الصفّ غير مربوطٍ بحساب. تدخل الطالبة ببريدها فيُنشأ حسابها.'});
      if (OWNERS.has(st.auth_uid))
        return send(res,400,{message:'هذا الحساب حسابُ مالكة، ولا يُبدَّل من هنا'});
      const em = (EMAIL_OF.get(st.auth_uid) || (st.auth_uid+'@example.com')).toLowerCase();
      USERS.set(em, pw);
      SESSIONS.delete(st.auth_uid);        // تُبطَل جلساتها القائمة
      return send(res,204,null);
    }
    if (u.pathname.startsWith('/__as/')) {
      WHO = decodeURIComponent(u.pathname.replace('/__as/',''));
      WHO_EMAIL = u.searchParams.get('email') || '';
      if (WHO_EMAIL) EMAIL_OF.set(WHO, WHO_EMAIL);
      return send(res,200,{who:WHO});
    }
    if (u.pathname.startsWith('/__owner/')) {
      OWNERS.add(decodeURIComponent(u.pathname.replace('/__owner/','')));
      return send(res,200,{owners:[...OWNERS]});
    }

    // ── rpc: mark_attendance — يطبّق شروط الدالة نفسها ──
    if (u.pathname === '/rest/v1/rpc/mark_attendance') {
      const nonce = json && json.p_nonce;
      const c = DB.attend_codes.find(x => x.nonce === nonce);
      const live = c && (Date.parse(c.issued_at) + (c.ttl_sec||25)*1000 > Date.now());
      if (!live) return send(res,400,{message:'انتهت صلاحية الرمز — امسحي الرمز الظاهر الآن على الشاشة'});
      const st = DB.students.find(s2 => s2.section_id===c.section_id && s2.auth_uid===WHO);
      if (!st) return send(res,400,{message:'حسابك غير مرتبط بكشف هذه الشعبة — راجعي الدكتورة'});
      const old = DB.attendance.find(a => a.student_id===st.id && +a.session===+c.session);
      if (old && old.status==='excused') return send(res,200,st.id);
      const day = (DB.schedule.find(x=>x.section_id===c.section_id && +x.session===+c.session)||{}).day;
      if (old) { old.status='present'; old.at=Date.now(); old.day=day||old.day; }
      else DB.attendance.push({id:'at-'+Math.random().toString(36).slice(2), student_id:st.id,
            section_id:c.section_id, session:+c.session, day:day||'2026-01-01',
            status:'present', at:Date.now()});
      return send(res,200,st.id);
    }
    if (u.pathname==='/auth/v1/otp') return send(res,200,{});

    // ── storage ──
    if (u.pathname.startsWith('/storage/v1/object/')) {
      const key = u.pathname.replace('/storage/v1/object/','');
      if (req.method==='POST'){ FILES.set(key, raw); return send(res,200,{Key:key}); }
      if (req.method==='GET'){
        if(!FILES.has(key)) return send(res,404,{});
        res.writeHead(200,{'Access-Control-Allow-Origin':'*',
                           'Content-Type':'application/octet-stream',
                           'Content-Length':FILES.get(key).length});
        return res.end(FILES.get(key));
      }
      if (req.method==='DELETE') return send(res,200,{});
    }

    // ── rest ──
    if (!u.pathname.startsWith('/rest/v1/')) return send(res,404,{message:'no route'});
    const table = u.pathname.replace('/rest/v1/','');
    if (!DB[table]) return send(res,404,{message:'relation "'+table+'" does not exist'});
    const params=[...u.searchParams.entries()];
    const prefer = req.headers['prefer']||'';

    //  ما ترى الداخلةُ من الصفوف.
    //  المحاكي كان يردّ كلَّ صفوف الجدول لكل داخلة، فكانت الطالبة
    //  ترى الكشف كلَّه — وفي الحقيقة تحرسه السياسات في الخادم.
    //  فكان الاختبار يمرّ على شيءٍ لا يشبه الواقع: صفحةٌ تأخذ
    //  «أنا» من أول صفٍّ يرجع كانت تأخذ طالبةً أخرى ولا يبين.
    //  فتُحاكى هنا سياسات my_student_ids: لا تُغني عن فحص
    //  rls-test.sql على Postgres حقيقيّ، لكنها تمنع الوهم.
    const isOwner = OWNERS.has(WHO) || DB.owners.some(o=>o.uid===WHO);
    const mine = () => DB.students.filter(s2=>s2.auth_uid===WHO).map(s2=>s2.id);
    function visible(rows) {
      if (isOwner) return rows;
      if (table==='students') return rows.filter(r=>r.auth_uid===WHO);
      if (table==='replies' || table==='works') {
        const ids = mine();
        return rows.filter(r=>ids.includes(r.student_id));
      }
      return rows;
    }

    if (req.method==='GET') {
      let rows = visible(DB[table].filter(r=>match(r,params)));
      const ord = u.searchParams.get('order');
      if (ord){ const [c,d]=ord.split('.'); rows=[...rows].sort((a,b)=>
        ((a[c]??0)>(b[c]??0)?1:(a[c]??0)<(b[c]??0)?-1:0)*(d==='desc'?-1:1)); }
      return send(res,200,rows);
    }
    if (req.method==='DELETE') {
      const before=DB[table].length;
      DB[table]=DB[table].filter(r=>!match(r,params));
      return send(res, prefer.includes('return=representation')?200:204,
                  prefer.includes('return=representation')?[]:null);
    }
    if (req.method==='POST') {
      const rows = Array.isArray(json)?json:[json];
      //  وقتُ الإنشاء يختمه الخادم، كما يفعل المطلِق on_work_saved.
      if (table==='works') rows.forEach(r=>{ if(!r.created_at) r.created_at=new Date().toISOString(); });
      //  ووقتُ الإجابة كذلك — به يُفرَّق من أجابت في وقتها.
      if (table==='replies') rows.forEach(r=>{ r.at=new Date().toISOString(); });
      const conflict = (u.searchParams.get('on_conflict')||PK[table].join(',')).split(',');
      const out=[];
      for (const r of rows) {
        const i = DB[table].findIndex(x=>conflict.every(c=>String(x[c])===String(r[c])));
        if (i>=0) {
          if (!prefer.includes('merge-duplicates'))
            return send(res,409,{message:'duplicate key value violates unique constraint'});
          const row={...DB[table][i],...r};
          // يحاكي stamp_submission: وقت البدء يملكه الخادم
          if (table==='submissions') {
            row.started_at = DB[table][i].started_at;
            if (row.status==='submitted' && DB[table][i].status!=='submitted')
              row.submitted_at = new Date().toISOString();
          }
          DB[table][i]=row; out.push(row);
        } else {
          const row={...r};
          if (table==='submissions') {
            row.started_at = new Date().toISOString();
            if (row.status==='submitted') row.submitted_at = row.started_at;
          }
          DB[table].push(row); out.push(row);
        }
      }
      return send(res, prefer.includes('return=representation')?201:204,
                  prefer.includes('return=representation')?out:null);
    }
    send(res,405,{message:'method'});
  });
});
server.listen(8910, ()=>console.log('mock supabase on 8910'));
