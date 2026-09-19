/* محاكي PostgREST + Auth + Storage لاختبار المحوّل.
   ليس Supabase الحقيقي — لكنه يطبّق نفس عقد HTTP الذي يستعمله المحوّل. */
import http from 'http';
const DB = { students: [], events: [], attendance: [], submissions: [], schedule: [],
             grades: [], scheme: [], attend_codes: [], content: [], owners: [{uid:'owner-1'}] };
// من هو الداخل؟ يُضبط من الاختبار عبر /__as/<uid>
let WHO = 'owner-1';
const FILES = new Map();
const PK = { students:['id'], events:['id'], attendance:['id'], submissions:['id'],
             grades:['id'], scheme:['section_id'], schedule:['section_id','session'],
             attend_codes:['section_id','session'], content:['id'], owners:['uid'] };

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

const server = http.createServer((req,res)=>{
  if (req.method==='OPTIONS') return send(res,204,null);
  const u = new URL(req.url, 'http://x');
  let body=''; req.on('data',d=>body+=d); req.on('end',()=>{
    const json = body?JSON.parse(body):null;

    // ── auth ──
    if (u.pathname.startsWith('/auth/v1/token'))
      return send(res,200,{access_token:'tok-owner', refresh_token:'r', expires_in:3600});
    if (u.pathname==='/auth/v1/user')
      return send(res,200,{id:WHO, email:WHO+'@example.com'});
    if (u.pathname.startsWith('/__as/')) {
      WHO = decodeURIComponent(u.pathname.replace('/__as/',''));
      return send(res,200,{who:WHO});
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
      if (req.method==='POST'){ FILES.set(key, body); return send(res,200,{Key:key}); }
      if (req.method==='GET'){
        if(!FILES.has(key)) return send(res,404,{});
        res.writeHead(200,{'Access-Control-Allow-Origin':'*','Content-Type':'application/octet-stream'});
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

    if (req.method==='GET') {
      let rows = DB[table].filter(r=>match(r,params));
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
