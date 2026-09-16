/* ═══════════════════════════════════════════════════════════════
   محوّل Supabase — يحقق نفس واجهة assets/store.js بالضبط.

   يتكلم مع PostgREST مباشرةً بـ fetch، بلا مكتبة خارجية، فتبقى
   المنصة بلا اعتماديات. يُحمَّل قبل store.js:

       <script src="assets/config.js"></script>
       <script src="assets/adapters/supabase.js"></script>
       <script src="assets/store.js"></script>

   أسماء الأعمدة في قاعدة البيانات بصيغة snake_case، وأسماء الحقول
   في المنصة بصيغة camelCase، والتحويل بينهما هنا وحده.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var CFG = window.TP_CONFIG || {};
  if (!CFG.url || !CFG.anonKey) return;            /* بلا إعداد: يبقى المحلي */

  var REST = CFG.url.replace(/\/$/, "") + "/rest/v1/";
  var AUTH = CFG.url.replace(/\/$/, "") + "/auth/v1/";
  var STORAGE = CFG.url.replace(/\/$/, "") + "/storage/v1/";
  var SESSION_KEY = "tp.sb.session";
  var PKCE_KEY = "tp.sb.pkce";
  var STATE_KEY = "tp.sb.state";

  /* base64url بلا حشو — ما يقبله معيار PKCE */
  function b64url(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /* ─── الجلسة ─── */
  function session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch (e) { return null; }
  }
  function setSession(s) {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* تصفح خاص */ }
    return s;
  }
  function token() {
    var s = session();
    return (s && s.access_token) || CFG.anonKey;
  }

  /* ─── تجديد الرمز ───
     كان expires_at يُحسب ويُحفظ ولا يُقرأ، وrefresh_token يُخزَّن
     ولا يُستعمل. فبعد ساعةٍ من الدخول يبدأ الخادم يردّ 401 في وسط
     الحصة، وتُترجَم الرسالة خطأً إلى «تأكدي أن حسابك في owners».
     يُجدَّد هنا قبل انتهائه بدقيقة، ويُنتظر تجديدٌ واحد لا أكثر
     مهما تزاحمت الطلبات. */
  var SKEW = 60 * 1000;
  var refreshing = null;

  function fresh() {
    var s = session();
    if (!s || !s.access_token) return Promise.resolve(null);
    if (!s.expires_at || Date.now() < s.expires_at - SKEW) return Promise.resolve(s);
    if (!s.refresh_token) { setSession(null); return Promise.resolve(null); }
    if (refreshing) return refreshing;

    refreshing = fetch(AUTH + "token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: CFG.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    }).then(function (r) {
      if (!r.ok) throw new Error("انتهت الجلسة");
      return r.json();
    }).then(function (d) {
      d.expires_at = Date.now() + (d.expires_in || 3600) * 1000;
      setSession(d);
      return d;
    }).catch(function () {
      setSession(null);
      return null;
    }).then(function (d) { refreshing = null; return d; });

    return refreshing;
  }

  /* تُحسب مرةً واحدة عند الحفظ، فلا يبقى فرعٌ ينسى حسابها */
  function stamp(d) {
    if (d && !d.expires_at) d.expires_at = Date.now() + ((d.expires_in || 3600) * 1000);
    return d;
  }

  function headers(extra) {
    var h = {
      apikey: CFG.anonKey,
      Authorization: "Bearer " + token(),
      "Content-Type": "application/json"
    };
    Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  function req(path, opts) {
    opts = opts || {};
    /* كل طلبٍ يمرّ على التجديد أولًا — لا شيء يُرسَل برمزٍ منتهٍ */
    if (session()) return fresh().then(function () { return send(path, opts); });
    return send(path, opts);
  }

  function send(path, opts) {
    return fetch(REST + path, {
      method: opts.method || "GET",
      headers: headers(opts.headers),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).catch(function () {
      /* انقطاع الشبكة يرمي TypeError نصّه "Failed to fetch" — إنجليزيّ
         خام لا يقول للطالبة شيئًا. يُترجَم هنا مرة واحدة لكل الطلبات. */
      throw new Error("تعذّر الوصول إلى الخادم — تحقّقي من اتصال الإنترنت ثم أعيدي المحاولة.");
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) { data = t; }
        if (!r.ok) {
          var msg = (data && (data.message || data.hint || data.error)) || ("خطأ " + r.status);
          /* ٤٠١ تعني «لا جلسة»، و٤٠٣ تعني «جلسة بلا صلاحية» — وخلطهما
             كان يقول لطالبةٍ لم تسجّل دخولها أن تضيف نفسها في owners. */
          if (r.status === 401) {
            msg = session()
              ? "انتهت الجلسة — سجّلي الدخول من جديد."
              : "سجّلي الدخول أولًا من صفحة «الحساب».";
          } else if (r.status === 403) {
            msg = "لا صلاحية لهذا الإجراء بحسابك.";
          }
          throw new Error(msg);
        }
        return data;
      });
    });
  }

  /* ─── تحويل أسماء الحقول ─── */
  function toDb(map, obj) {
    var out = {};
    Object.keys(obj).forEach(function (k) {
      if (obj[k] === undefined) return;
      out[map[k] || k] = obj[k];
    });
    return out;
  }
  function fromDb(map, row) {
    if (!row) return row;
    var inv = {};
    Object.keys(map).forEach(function (k) { inv[map[k]] = k; });
    var out = {};
    Object.keys(row).forEach(function (k) { out[inv[k] || k] = row[k]; });
    return out;
  }

  var M_STUDENT = { sectionId: "section_id", authUid: "auth_uid", updatedAt: "updated_at" };
  var M_EVENT = { studentId: "student_id", sectionId: "section_id" };
  var M_ATT = { studentId: "student_id", sectionId: "section_id" };
  var M_SUB = { studentId: "student_id", worksheetId: "worksheet_id",
                submittedAt: "submitted_at", updatedAt: "updated_at" };

  var M_GRADE = { studentId: "student_id", sectionId: "section_id",
                  itemId: "item_id", updatedAt: "updated_at" };

  function mapAll(map, rows) { return (rows || []).map(function (r) { return fromDb(map, r); }); }

  function uid(p) {
    return (p || "id") + "-" + Date.now().toString(36) + "-" +
           Math.random().toString(36).slice(2, 8);
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function enc(v) { return encodeURIComponent(v); }

  /* ─── المحوّل ─── */
  var Adapter = {
    name: "supabase",

    /* الطالبات ------------------------------------------------ */
    students: function (sectionId) {
      var q = "students?select=*&order=no.asc";
      if (sectionId != null) q += "&section_id=eq." + enc(sectionId);
      return req(q).then(function (rows) { return mapAll(M_STUDENT, rows); });
    },

    saveStudent: function (s) {
      if (!s.id) s.id = uid("st");
      var body = toDb(M_STUDENT, s);
      body.updated_at = new Date().toISOString();
      return req("students?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: [body]
      }).then(function (rows) { return fromDb(M_STUDENT, (rows || [])[0]) || s; });
    },

    setStudents: function (list) {
      /* الكشف كاملًا لشعبة: يُستبدل من يخرج منه ويبقى من يبقى */
      var sections = {};
      list.forEach(function (s) { sections[String(s.sectionId)] = true; });
      var keep = list.map(function (s) { return s.id; });

      var chain = Promise.resolve();
      Object.keys(sections).forEach(function (sec) {
        chain = chain.then(function () {
          var q = "students?section_id=eq." + enc(sec);
          if (keep.length) q += "&id=not.in.(" + keep.map(enc).join(",") + ")";
          return req(q, { method: "DELETE" });
        });
      });
      if (!list.length) return chain.then(function () { return list; });

      return chain.then(function () {
        return req("students?on_conflict=id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: list.map(function (s) {
            var b = toDb(M_STUDENT, s);
            b.updated_at = new Date().toISOString();
            return b;
          })
        });
      }).then(function () { return list; });
    },

    removeStudent: function (id) {
      return req("students?id=eq." + enc(id), { method: "DELETE" }).then(function () {});
    },

    /* التفاعل ------------------------------------------------- */
    events: function (f) {
      f = f || {};
      var q = "events?select=*";
      if (f.studentId) q += "&student_id=eq." + enc(f.studentId);
      if (f.sectionId != null) q += "&section_id=eq." + enc(f.sectionId);
      if (f.day) q += "&day=eq." + enc(f.day);
      if (f.from) q += "&day=gte." + enc(f.from);
      if (f.to) q += "&day=lte." + enc(f.to);
      if (f.month) {
        q += "&day=gte." + enc(f.month + "-01") + "&day=lt." + enc(nextMonth(f.month));
      }
      return req(q).then(function (rows) { return mapAll(M_EVENT, rows); });
    },

    addEvent: function (e) {
      e.id = e.id || uid("ev");
      e.day = e.day || dayKey();
      e.at = e.at || Date.now();
      return req("events", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: [toDb(M_EVENT, e)]
      }).then(function (rows) { return fromDb(M_EVENT, (rows || [])[0]) || e; });
    },

    removeEvent: function (id) {
      return req("events?id=eq." + enc(id), { method: "DELETE" }).then(function () {});
    },

    /* الحضور --------------------------------------------------- */
    attendance: function (f) {
      f = f || {};
      var q = "attendance?select=*";
      if (f.sectionId != null) q += "&section_id=eq." + enc(f.sectionId);
      if (f.session != null) q += "&session=eq." + enc(f.session);
      if (f.studentId) q += "&student_id=eq." + enc(f.studentId);
      if (f.day) q += "&day=eq." + enc(f.day);
      return req(q).then(function (rows) { return mapAll(M_ATT, rows); });
    },

    markAttendance: function (rec) {
      rec.id = rec.id || uid("at");
      rec.at = Date.now();
      var body = toDb(M_ATT, rec);
      /* القيد الفريد (student_id, session) يجعلها تحديثًا لا تكرارًا */
      return req("attendance?on_conflict=student_id,session", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: [body]
      }).then(function (rows) { return fromDb(M_ATT, (rows || [])[0]) || rec; });
    },

    clearAttendance: function (sectionId, session) {
      return req("attendance?section_id=eq." + enc(sectionId) + "&session=eq." + enc(session),
                 { method: "DELETE" }).then(function () {});
    },

    /* الجدول --------------------------------------------------- */
    schedule: function (sectionId) {
      var q = "schedule?select=*";
      if (sectionId != null) q += "&section_id=eq." + enc(sectionId);
      return req(q).then(function (rows) {
        if (sectionId != null) {
          var m = {};
          (rows || []).forEach(function (r) { m[r.session] = r.day; });
          return m;
        }
        var all = {};
        (rows || []).forEach(function (r) {
          (all[r.section_id] = all[r.section_id] || {})[r.session] = r.day;
        });
        return all;
      });
    },

    setSchedule: function (sectionId, map) {
      var rows = Object.keys(map || {}).map(function (n) {
        return { section_id: String(sectionId), session: +n, day: map[n] };
      });
      return req("schedule?section_id=eq." + enc(sectionId), { method: "DELETE" })
        .then(function () {
          if (!rows.length) return null;
          return req("schedule?on_conflict=section_id,session", {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates" },
            body: rows
          });
        }).then(function () { return map; });
    },

    /* التسليمات ------------------------------------------------ */
    submissions: function (f) {
      f = f || {};
      var q = "submissions?select=*";
      if (f.studentId) q += "&student_id=eq." + enc(f.studentId);
      if (f.worksheetId) q += "&worksheet_id=eq." + enc(f.worksheetId);
      if (f.status) q += "&status=eq." + enc(f.status);
      return req(q).then(function (rows) { return mapAll(M_SUB, rows); });
    },

    saveSubmission: function (s) {
      s.id = s.id || uid("sub");
      var body = toDb(M_SUB, s);
      body.updated_at = new Date().toISOString();
      return req("submissions?on_conflict=student_id,worksheet_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: [body]
      }).then(function (rows) { return fromDb(M_SUB, (rows || [])[0]) || s; });
    },

    removeSubmission: function (id) {
      return req("submissions?id=eq." + enc(id), { method: "DELETE" }).then(function () {});
    },

    /* الملفات -------------------------------------------------- */
    /* التسجيل بالباركود — يمرّ من دالة في الخادم لا من كتابة مباشرة */
    joinClass: function (sectionId, name, uid) {
      return fetch(REST + "rpc/join_class", {
        method: "POST",
        headers: { apikey: CFG.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ p_section: String(sectionId), p_name: name, p_uid: uid })
      }).catch(function () {
        throw new Error("تعذّر الوصول إلى الخادم — تحقّقي من الإنترنت.");
      }).then(function (r) {
        return r.text().then(function (t) {
          var d = null;
          try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
          if (!r.ok) throw new Error((d && (d.message || d.hint)) || "تعذّر التسجيل.");
          return d;                       /* معرّف الصفّ */
        });
      });
    },

    /* الدرجات اليدوية ----------------------------------------- */
    grades: function (f) {
      f = f || {};
      var q = "grades?select=*";
      if (f.sectionId != null) q += "&section_id=eq." + enc(f.sectionId);
      if (f.studentId) q += "&student_id=eq." + enc(f.studentId);
      if (f.itemId) q += "&item_id=eq." + enc(f.itemId);
      return req(q).then(function (rows) { return mapAll(M_GRADE, rows); });
    },

    /* درجة فارغة تُحذف بدل أن تُحفظ صفرًا */
    saveGrade: function (rec) {
      if (rec.score == null || rec.score === "") {
        return req("grades?student_id=eq." + enc(rec.studentId) +
                   "&item_id=eq." + enc(rec.itemId), { method: "DELETE" })
               .then(function () { return null; });
      }
      var body = toDb(M_GRADE, rec);
      body.id = rec.id || uid("gr");
      body.updated_at = new Date().toISOString();
      return req("grades?on_conflict=student_id,item_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: body
      }).then(function (rows) { return fromDb(M_GRADE, (rows || [])[0] || body); });
    },

    /* توزيعة الشعبة */
    scheme: function (sectionId) {
      var q = "scheme?select=section_id,data";
      if (sectionId != null) q += "&section_id=eq." + enc(sectionId);
      return req(q).then(function (rows) {
        if (sectionId != null) return (rows || []).length ? rows[0].data : null;
        var out = {};
        (rows || []).forEach(function (r) { out[r.section_id] = r.data; });
        return out;
      });
    },

    setScheme: function (sectionId, sch) {
      return req("scheme?on_conflict=section_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: { section_id: String(sectionId), data: sch,
                updated_at: new Date().toISOString() }
      }).then(function () { return sch; });
    },

    /* ─── معرّف الملف هو مساره ───
       كان يُرفع إلى "shared/<id>" ويُقرأ من "<student_id>/<id>"،
       فلا يُفتح ملفٌ أبدًا ويقول البرنامج «غير موجود على هذا الجهاز».
       والرفع إلى shared/ كان يُرفض أصلًا بسياسة tpfiles_self التي
       تشترط أن يكون أول جزءٍ من المسار هو صفّ الطالبة.
       بجعل المعرّف هو المسار ينتهي التخمين: لا موضع يشتقّه من شيء. */
    putFile: function (rec) {
      rec.id = rec.id || ((rec.studentId || "shared") + "/" + uid("f"));
      var path = rec.id;
      return fetch(STORAGE + "object/tp-files/" + path, {
        method: "POST",
        headers: {
          apikey: CFG.anonKey,
          Authorization: "Bearer " + token(),
          "Content-Type": rec.type || "application/octet-stream",
          "x-upsert": "true"
        },
        body: dataUrlToBlob(rec.data)
      }).then(function (r) {
        if (!r.ok) throw new Error("تعذّر رفع الملف (" + r.status + ").");
        return rec.id;
      });
    },

    getFile: function (id) {
      return req("submissions?select=student_id,files").then(function (rows) {
        var meta = null;
        (rows || []).forEach(function (row) {
          Object.keys(row.files || {}).forEach(function (k) {
            (row.files[k] || []).forEach(function (f) {
              if (f.fileId === id) meta = f;
            });
          });
        });
        return fetch(STORAGE + "object/tp-files/" + id, {
          headers: { apikey: CFG.anonKey, Authorization: "Bearer " + token() }
        }).then(function (r) {
          if (!r.ok) return null;
          return r.blob().then(blobToDataUrl).then(function (data) {
            return { id: id, name: (meta && meta.name) || id,
                     type: (meta && meta.type) || "", size: (meta && meta.size) || 0,
                     data: data };
          });
        });
      });
    },

    removeFile: function (id) {
      return fetch(STORAGE + "object/tp-files", {
        method: "DELETE",
        headers: headers(),
        body: JSON.stringify({ prefixes: [id] })
      }).then(function () {});
    }
  };

  function nextMonth(m) {
    var p = m.split("-"), y = +p[0], mo = +p[1] + 1;
    if (mo > 12) { mo = 1; y++; }
    return y + "-" + pad(mo) + "-01";
  }

  function dataUrlToBlob(d) {
    if (!d) return new Blob([]);
    var parts = String(d).split(",");
    var mime = (parts[0].match(/:(.*?);/) || [, ""])[1];
    var bin = atob(parts[1] || "");
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function blobToDataUrl(b) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(b);
    });
  }

  /* العودة من رابط البريد أو من صفحة الجامعة. تعيد وعدًا دائمًا:
     الجلسة إن وُجدت، أو null إن لم يكن في العنوان شيء، أو خطأً إن
     ردّت جهة الهوية بالرفض. */
  function capture() {
    var q0 = new URLSearchParams(location.search);

    /* عودة PKCE: رمز في الاستعلام يُبدَّل بجلسة */
    if (q0.get("code")) {
      var code = q0.get("code"), verifier = "";
      try { verifier = sessionStorage.getItem(PKCE_KEY) || ""; } catch (e) { /**/ }
      try { sessionStorage.removeItem(PKCE_KEY); } catch (e) { /**/ }
      history.replaceState(null, "", location.pathname);
      return fetch(AUTH + "token?grant_type=pkce", {
        method: "POST",
        headers: { apikey: CFG.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ auth_code: code, code_verifier: verifier })
      }).then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error_description || d.msg || "تعذّر إتمام الدخول.");
          setSession(stamp(d));
          return d;
        });
      });
    }

    /* رفض من جهة الجامعة يصل في الاستعلام أو في الجزء */
    var err = q0.get("error_description") || q0.get("error");
    if (!err && location.hash) {
      var qh = new URLSearchParams(location.hash.slice(1));
      err = qh.get("error_description") || qh.get("error");
    }
    if (err) {
      history.replaceState(null, "", location.pathname);
      /* URLSearchParams يفكّ الترميز أصلًا ويحوّل + إلى فراغ.
         والفكّ ثانيةً يرمي URIError على أي % مفردة في رسالة
         AADSTS — رميًا متزامنًا خارج الوعد، فيُميت صفحة الدخول. */
      return Promise.reject(new Error(String(err)));
    }

    if (!location.hash || location.hash.indexOf("access_token") < 0) return Promise.resolve(null);
    var q = new URLSearchParams(location.hash.slice(1));

    /* ─── لا تُقبَل جلسة من العنوان إلا إن كنّا نحن من بدأ التدفّق ───
       كان أيّ رمزٍ في جزء العنوان يُقبل ويُحفظ. فيكفي المهاجم أن
       ينشئ حسابًا لنفسه ويرسل للدكتورة رابطًا فيه رمزه، فتكتب هي
       في حسابه وهو يقرأ كل ما كتبت. الآن يُطلب state أصدرناه قبل
       التحويل وحفظناه في هذه الجلسة وحدها. */
    var want = "";
    try { want = sessionStorage.getItem(STATE_KEY) || ""; } catch (e) { /**/ }
    try { sessionStorage.removeItem(STATE_KEY); } catch (e) { /**/ }

    history.replaceState(null, "", location.pathname + location.search);

    if (!want || q.get("state") !== want) {
      return Promise.reject(new Error(
        "رابط دخولٍ لم يصدر من هذا المتصفّح، فلم يُقبل. " +
        "افتحي صفحة الحساب وسجّلي الدخول من هنا."));
    }

    return Promise.resolve(setSession(stamp({
      access_token: q.get("access_token"),
      refresh_token: q.get("refresh_token"),
      expires_in: +q.get("expires_in") || 3600
    })));
  }

  /* ─── الدخول والخروج ─── */
  window.TPAuth = {
    session: session,

    signIn: function (email, password) {
      return fetch(AUTH + "token?grant_type=password", {
        method: "POST",
        headers: { apikey: CFG.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password })
      }).then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error_description || d.msg || "تعذّر الدخول.");
          setSession(stamp(d));
          return d;
        });
      });
    },

    /* رابط الدخول بالبريد — لا كلمة سر للطالبات */
    sendLink: function (email, redirect) {
      /* GoTrue يقرأ عنوان العودة من معامل الاستعلام redirect_to.
         كان يُرسَل في الجسم بصيغة مكتبة supabase-js فيُتجاهَل، فيعود
         الرابط إلى SITE_URL لا إلى صفحة الحساب، ولا تكتمل الجلسة —
         والرسالة تقول للطالبة إنه أُرسل بنجاح. */
      return fetch(AUTH + "otp?redirect_to=" + encodeURIComponent(redirect || location.href), {
        method: "POST",
        headers: { apikey: CFG.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, create_user: true })
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (d) {
          throw new Error(d.msg || d.error_description || "تعذّر إرسال الرابط.");
        });
        return true;
      });
    },

    /* ─── الدخول بحساب الجامعة (Microsoft Entra) ───
       لا كلمة سر جديدة ولا رابط بريد: الطالبة تدخل بنفس حساب تيمز،
       وبريدها الجامعي هو الذي يربط حسابها بصفّها في الكشف (انظري
       link_student_account في supabase/schema.sql).

       نستعمل PKCE حين يتوفّر crypto.subtle — وهو يتوفّر على كل
       عنوان https — ونرجع إلى التدفّق الضمني على http المحلي. */
    signInWithUniversity: function (redirect) {
      /* state يُصدَر هنا ويُطلب عند العودة — فلا تُقبل جلسةٌ لم نطلبها */
      var st = b64url(window.crypto.getRandomValues(new Uint8Array(16)));
      try { sessionStorage.setItem(STATE_KEY, st); } catch (e) { /**/ }

      var base = AUTH + "authorize?provider=azure" +
                 "&scopes=" + encodeURIComponent("openid email profile") +
                 "&state=" + encodeURIComponent(st) +
                 "&redirect_to=" + encodeURIComponent(redirect || location.href.split("#")[0]);

      var sub = window.crypto && window.crypto.subtle;
      if (!sub) { location.href = base; return Promise.resolve(); }

      var verifier = b64url(window.crypto.getRandomValues(new Uint8Array(48)));
      try { sessionStorage.setItem(PKCE_KEY, verifier); } catch (e) { /* تصفح خاص */ }

      return sub.digest("SHA-256", new TextEncoder().encode(verifier))
        .then(function (buf) {
          location.href = base + "&code_challenge=" + b64url(new Uint8Array(buf)) +
                                 "&code_challenge_method=s256";
        })
        .catch(function () { location.href = base; });
    },

    captureFromUrl: function () {
      try { return capture(); }
      catch (e) { return Promise.reject(e); }   /* لا رمي متزامن أبدًا */
    },

    me: function () {
      if (!session()) return Promise.resolve(null);
      return fetch(AUTH + "user", { headers: headers() })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    },

    isOwner: function () {
      if (!session()) return Promise.resolve(false);
      return req("owners?select=uid").then(function (rows) {
        return !!(rows && rows.length);
      }).catch(function () { return false; });
    },

    /* "admin" | "teacher" | null — من صفّ هذا الحساب وحده.
       تُرشَّح بالمعرّف لا بأول صفّ: الجدول يُرجع كل المالكات لمن
       يقرؤه، فأخذُ أوّلها كان يعطي الدكتورة دور المشرف أو العكس. */
    role: function () {
      if (!session()) return Promise.resolve(null);
      /* لا تُبتلع أخطاء الشبكة هنا: null تعني «ليس في owners»،
         فابتلاعُ انقطاعٍ عابرٍ كان يثبّت الدور على «طالبة» لبقية
         عمر الصفحة ويعرض للمشرف لوحة الرفض. الخطأ يُرفع ليُفرَّق. */
      return TPAuth.me().then(function (me) {
        if (!me || !me.id) return null;
        return req("owners?select=role&uid=eq." + enc(me.id))
          .then(function (rows) {
            return (rows && rows.length) ? (rows[0].role || "teacher") : null;
          });
      });
    },

    /* الخروج يُبطل رمز التجديد في الخادم أيضًا — وإلا بقي صالحًا
       بعد «الخروج» ومُحيت الجلسة من المتصفّح وحده */
    signOut: function () {
      var s = session();
      var done = s ? fetch(AUTH + "logout", {
        method: "POST", headers: headers()
      }).catch(function () { /* الشبكة قد تسقط — المحلي يُمحى دائمًا */ })
        : Promise.resolve();
      return done.then(function () { setSession(null); });
    }
  };

  window.TP_ADAPTER = Adapter;
})();
