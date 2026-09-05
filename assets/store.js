/* ═══════════════════════════════════════════════════════════════
   طبقة البيانات — كل قراءة وكتابة في المنصة تمرّ من هنا.

   الواجهة غير متزامنة عمدًا (كل دالة تُرجع Promise) حتى يُستبدل
   المحوّل المحلي بمحوّل خادم لاحقًا دون تغيير سطر واحد في بقية
   الملفات. لتركيب خادم: اكتب كائنًا بنفس الدوال، ثم عيّنه قبل
   تحميل هذا الملف:

       window.TP_ADAPTER = MyServerAdapter;

   المحوّل المحلي يحفظ السجلات في localStorage والملفات في
   IndexedDB على جهاز المستخدمة نفسها.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var PREFIX = "tp.v1.";
  var DB_NAME = "tp-files", DB_VER = 1, FILES = "files";

  /* ─── أدوات ─── */
  function uid(p) {
    return (p || "id") + "-" + Date.now().toString(36) + "-" +
           Math.random().toString(36).slice(2, 8);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* تاريخ محلي YYYY-MM-DD — لا يُستعمل toISOString لأنه يزيح باليوم */
  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function monthKey(day) { return String(day).slice(0, 7); }

  function read(key, dflt) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : dflt;
    } catch (e) { return dflt; }
  }

  function write(key, val) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); return true; }
    catch (e) {
      console.warn("تعذّر الحفظ في التخزين المحلي:", e);
      throw new Error("امتلأت مساحة التخزين أو أن المتصفح يمنع الحفظ.");
    }
  }

  /* ─── IndexedDB للملفات المرفوعة ─── */
  var dbPromise = null;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error("المتصفح لا يدعم تخزين الملفات."));
      var rq = indexedDB.open(DB_NAME, DB_VER);
      rq.onupgradeneeded = function () {
        if (!rq.result.objectStoreNames.contains(FILES)) {
          rq.result.createObjectStore(FILES, { keyPath: "id" });
        }
      };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(FILES, mode);
        var rq = fn(t.objectStore(FILES));
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { rej(rq.error); };
      });
    });
  }

  /* ─── المحوّل المحلي ─── */
  var Local = {
    name: "local",

    /* الطالبات ------------------------------------------------ */
    students: function (sectionId) {
      var all = read("students", null);
      if (all === null) { all = seedRoster(); write("students", all); }
      if (sectionId == null) return Promise.resolve(all);
      return Promise.resolve(all.filter(function (s) {
        return String(s.sectionId) === String(sectionId);
      }));
    },

    saveStudent: function (s) {
      return Local.students().then(function (all) {
        if (!s.id) { s.id = uid("st"); all.push(s); }
        else {
          var i = indexById(all, s.id);
          if (i < 0) all.push(s); else all[i] = Object.assign({}, all[i], s);
        }
        write("students", all);
        return s;
      });
    },

    setStudents: function (list) {
      write("students", list);
      return Promise.resolve(list);
    },

    removeStudent: function (id) {
      return Local.students().then(function (all) {
        write("students", all.filter(function (s) { return s.id !== id; }));
      });
    },

    /* أحداث التفاعل ------------------------------------------- */
    events: function (f) {
      f = f || {};
      var all = read("events", []);
      return Promise.resolve(all.filter(function (e) {
        if (f.studentId && e.studentId !== f.studentId) return false;
        if (f.sectionId != null && String(e.sectionId) !== String(f.sectionId)) return false;
        if (f.day && e.day !== f.day) return false;
        if (f.month && monthKey(e.day) !== f.month) return false;
        if (f.from && e.day < f.from) return false;
        if (f.to && e.day > f.to) return false;
        return true;
      }));
    },

    addEvent: function (e) {
      var all = read("events", []);
      e.id = e.id || uid("ev");
      e.day = e.day || dayKey();
      e.at = e.at || Date.now();
      all.push(e);
      write("events", all);
      return Promise.resolve(e);
    },

    removeEvent: function (id) {
      var all = read("events", []);
      write("events", all.filter(function (e) { return e.id !== id; }));
      return Promise.resolve();
    },

    /* التسليمات ----------------------------------------------- */
    submissions: function (f) {
      f = f || {};
      var all = read("submissions", []);
      return Promise.resolve(all.filter(function (s) {
        if (f.studentId && s.studentId !== f.studentId) return false;
        if (f.worksheetId && s.worksheetId !== f.worksheetId) return false;
        if (f.status && s.status !== f.status) return false;
        return true;
      }));
    },

    saveSubmission: function (s) {
      var all = read("submissions", []);
      s.id = s.id || uid("sub");
      s.updatedAt = Date.now();
      var i = indexById(all, s.id);
      if (i < 0) all.push(s); else all[i] = s;
      write("submissions", all);
      return Promise.resolve(s);
    },

    removeSubmission: function (id) {
      var all = read("submissions", []);
      write("submissions", all.filter(function (s) { return s.id !== id; }));
      return Promise.resolve();
    },

    /* الملفات ------------------------------------------------- */
    putFile: function (rec) {
      rec.id = rec.id || uid("f");
      return tx("readwrite", function (os) { return os.put(rec); }).then(function () { return rec.id; });
    },
    getFile: function (id) {
      return tx("readonly", function (os) { return os.get(id); });
    },
    removeFile: function (id) {
      return tx("readwrite", function (os) { return os.delete(id); });
    },
    listFiles: function () {
      return tx("readonly", function (os) { return os.getAll(); });
    }
  };

  function indexById(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return i;
    return -1;
  }

  /* كشف مبدئي من أعداد الشعب في data/course.js — يُستبدل بالكشف
     الحقيقي من صفحة «الطالبات» بلصق الأسماء. */
  function seedRoster() {
    var C = window.COURSE || { sections: [] };
    var out = [];
    (C.sections || []).forEach(function (sec) {
      for (var n = 1; n <= (sec.roster || 0); n++) {
        out.push({
          id: uid("st"), no: n, sectionId: sec.id,
          name: "طالبة رقم " + n, placeholder: true, active: true
        });
      }
    });
    return out;
  }

  /* ─── الواجهة العامة ─── */
  var A = window.TP_ADAPTER || Local;

  window.Store = {
    adapter: A.name || "custom",
    uid: uid,
    dayKey: dayKey,
    monthKey: monthKey,

    students: function (sectionId) { return A.students(sectionId); },
    student: function (id) {
      return A.students().then(function (all) {
        return all.filter(function (s) { return s.id === id; })[0] || null;
      });
    },
    saveStudent: function (s) { return A.saveStudent(s); },
    setStudents: function (l) { return A.setStudents(l); },
    removeStudent: function (id) { return A.removeStudent(id); },

    events: function (f) { return A.events(f); },
    addEvent: function (e) { return A.addEvent(e); },
    removeEvent: function (id) { return A.removeEvent(id); },

    submissions: function (f) { return A.submissions(f); },
    saveSubmission: function (s) { return A.saveSubmission(s); },
    removeSubmission: function (id) { return A.removeSubmission(id); },

    putFile: function (r) { return A.putFile(r); },
    getFile: function (id) { return A.getFile(id); },
    removeFile: function (id) { return A.removeFile(id); },

    /* ترتيب التفاعل — أساس لوحة الشرف.
       يُرجع [{student, points, counts:{kind:n}, total}] تنازليًا. */
    ranking: function (filter) {
      var kinds = ((window.COURSE || {}).engagement || {}).kinds || [];
      var pts = {};
      kinds.forEach(function (k) { pts[k.id] = k.points; });

      return Promise.all([A.students(filter && filter.sectionId), A.events(filter)])
        .then(function (r) {
          var students = r[0], events = r[1];
          var byId = {};
          students.forEach(function (s) {
            byId[s.id] = { student: s, points: 0, total: 0, counts: {} };
          });
          events.forEach(function (e) {
            var row = byId[e.studentId];
            if (!row) return;                       /* طالبة محذوفة */
            row.points += (e.points != null ? e.points : (pts[e.kind] || 0));
            row.total += 1;
            row.counts[e.kind] = (row.counts[e.kind] || 0) + 1;
          });
          return Object.keys(byId).map(function (k) { return byId[k]; })
            .sort(function (a, b) {
              return b.points - a.points ||
                     b.total - a.total ||
                     (a.student.no || 0) - (b.student.no || 0);
            });
        });
    },

    /* تصدير كل البيانات (بلا الملفات) للنسخ الاحتياطي أو النقل */
    exportAll: function () {
      return Promise.all([A.students(), A.events({}), A.submissions({})])
        .then(function (r) {
          return {
            kind: "tp-backup", version: 1, at: new Date().toISOString(),
            students: r[0], events: r[1], submissions: r[2]
          };
        });
    },

    importAll: function (payload, mode) {
      if (!payload || payload.kind !== "tp-backup") {
        return Promise.reject(new Error("الملف ليس نسخة احتياطية صالحة."));
      }
      if (mode === "replace") {
        write("students", payload.students || []);
        write("events", payload.events || []);
        write("submissions", payload.submissions || []);
        return Promise.resolve({ students: (payload.students || []).length });
      }
      /* دمج: لا يُكرّر ما له نفس المعرّف */
      return Promise.all([A.students(), A.events({}), A.submissions({})]).then(function (r) {
        var added = { students: 0, events: 0, submissions: 0 };
        [["students", r[0]], ["events", r[1]], ["submissions", r[2]]].forEach(function (pair) {
          var key = pair[0], cur = pair[1];
          var seen = {};
          cur.forEach(function (x) { seen[x.id] = true; });
          (payload[key] || []).forEach(function (x) {
            if (!seen[x.id]) { cur.push(x); added[key]++; }
          });
          write(key, cur);
        });
        return added;
      });
    }
  };
})();
