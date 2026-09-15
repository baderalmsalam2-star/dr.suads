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
  }
  function token() {
    var s = session();
    return (s && s.access_token) || CFG.anonKey;
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
    return fetch(REST + path, {
      method: opts.method || "GET",
      headers: headers(opts.headers),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) { data = t; }
        if (!r.ok) {
          var msg = (data && (data.message || data.hint || data.error)) || ("خطأ " + r.status);
          if (r.status === 401 || r.status === 403) {
            msg = "لا صلاحية — سجّلي الدخول، وتأكدي أن حسابك مضاف في جدول owners.";
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
    putFile: function (rec) {
      rec.id = rec.id || uid("f");
      var path = (rec.studentId || "shared") + "/" + rec.id;
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
        var owner = "shared", meta = null;
        (rows || []).forEach(function (row) {
          Object.keys(row.files || {}).forEach(function (k) {
            (row.files[k] || []).forEach(function (f) {
              if (f.fileId === id) { owner = row.student_id; meta = f; }
            });
          });
        });
        return fetch(STORAGE + "object/tp-files/" + owner + "/" + id, {
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
          setSession(d);
          return d;
        });
      });
    },

    /* رابط الدخول بالبريد — لا كلمة سر للطالبات */
    sendLink: function (email, redirect) {
      return fetch(AUTH + "otp", {
        method: "POST",
        headers: { apikey: CFG.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, create_user: true,
                               options: { email_redirect_to: redirect } })
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
      var base = AUTH + "authorize?provider=azure" +
                 "&scopes=" + encodeURIComponent("openid email profile") +
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

    /* العودة من رابط البريد أو من صفحة الجامعة. تعيد وعدًا دائمًا:
       الجلسة إن وُجدت، أو null إن لم يكن في العنوان شيء، أو خطأً إن
       ردّت جهة الهوية بالرفض. */
    captureFromUrl: function () {
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
            d.expires_at = Date.now() + (d.expires_in || 3600) * 1000;
            setSession(d);
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
        return Promise.reject(new Error(decodeURIComponent(String(err).replace(/\+/g, " "))));
      }

      if (!location.hash || location.hash.indexOf("access_token") < 0) return Promise.resolve(null);
      var q = new URLSearchParams(location.hash.slice(1));
      var s = {
        access_token: q.get("access_token"),
        refresh_token: q.get("refresh_token"),
        expires_at: Date.now() + (+q.get("expires_in") || 3600) * 1000
      };
      setSession(s);
      history.replaceState(null, "", location.pathname + location.search);
      return Promise.resolve(s);
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

    signOut: function () { setSession(null); return Promise.resolve(); }
  };

  window.TP_ADAPTER = Adapter;
})();
