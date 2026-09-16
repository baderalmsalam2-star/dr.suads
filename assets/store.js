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

    /* الحضور --------------------------------------------------- */
    attendance: function (f) {
      f = f || {};
      var all = read("attendance", []);
      return Promise.resolve(all.filter(function (a) {
        if (f.sectionId != null && String(a.sectionId) !== String(f.sectionId)) return false;
        if (f.session != null && +a.session !== +f.session) return false;
        if (f.studentId && a.studentId !== f.studentId) return false;
        if (f.day && a.day !== f.day) return false;
        return true;
      }));
    },

    /* سجل واحد لكل (طالبة، حصة): الوسم الجديد يحل محل القديم */
    markAttendance: function (rec) {
      var all = read("attendance", []);
      var i = -1;
      for (var k = 0; k < all.length; k++) {
        if (all[k].studentId === rec.studentId && +all[k].session === +rec.session) { i = k; break; }
      }
      rec.id = (i >= 0 ? all[i].id : uid("at"));
      rec.at = Date.now();
      if (i >= 0) all[i] = Object.assign({}, all[i], rec); else all.push(rec);
      write("attendance", all);
      return Promise.resolve(rec);
    },

    clearAttendance: function (sectionId, session) {
      var all = read("attendance", []);
      write("attendance", all.filter(function (a) {
        return !(String(a.sectionId) === String(sectionId) && +a.session === +session);
      }));
      return Promise.resolve();
    },

    /* جدول التواريخ: { "<sectionId>": { "<session>": "YYYY-MM-DD" } } */
    schedule: function (sectionId) {
      var all = read("schedule", {});
      return Promise.resolve(sectionId == null ? all : (all[String(sectionId)] || {}));
    },

    setSchedule: function (sectionId, map) {
      var all = read("schedule", {});
      all[String(sectionId)] = map;
      write("schedule", all);
      return Promise.resolve(map);
    },

    /* الدرجات اليدوية: سجل واحد لكل (طالبة، بند) ------------- */
    grades: function (f) {
      f = f || {};
      var all = read("grades", []);
      return Promise.resolve(all.filter(function (g) {
        if (f.sectionId != null && String(g.sectionId) !== String(f.sectionId)) return false;
        if (f.studentId && g.studentId !== f.studentId) return false;
        if (f.itemId && g.itemId !== f.itemId) return false;
        return true;
      }));
    },

    /* درجة فارغة تُحذف بدل أن تُحفظ صفرًا — فرقٌ بين «لم تُرصد» و«صفر» */
    saveGrade: function (rec) {
      var all = read("grades", []);
      var i = -1;
      for (var k = 0; k < all.length; k++) {
        if (all[k].studentId === rec.studentId && all[k].itemId === rec.itemId) { i = k; break; }
      }
      if (rec.score == null || rec.score === "") {
        if (i >= 0) { all.splice(i, 1); write("grades", all); }
        return Promise.resolve(null);
      }
      rec.id = (i >= 0 ? all[i].id : uid("gr"));
      if (i >= 0) all[i] = Object.assign({}, all[i], rec); else all.push(rec);
      write("grades", all);
      return Promise.resolve(rec);
    },

    /* توزيعة الشعبة — كجدول الحصص: خريطة لكل شعبة */
    scheme: function (sectionId) {
      var all = read("scheme", {});
      return Promise.resolve(sectionId == null ? all : (all[String(sectionId)] || null));
    },

    setScheme: function (sectionId, sch) {
      var all = read("scheme", {});
      all[String(sectionId)] = sch;
      write("scheme", all);
      return Promise.resolve(sch);
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
          name: "طالبة رقم " + String(n).replace(/\d/g, function (d) {
            return "٠١٢٣٤٥٦٧٨٩"[d];
          }), placeholder: true, active: true
        });
      }
    });
    return out;
  }

  /* التوزيعة الافتراضية من data/course.js — نسخة لا مرجعًا،
     فتحريرها في صفحة الدرجات لا يمسّ الأصل */
  function defaultScheme() {
    var g = (window.COURSE || {}).grading || {};
    return JSON.parse(JSON.stringify({
      confirmed: !!g.confirmed,
      items: g.items || [],
      grades: g.grades || []
    }));
  }

  /* تمييز العدد. الآلة في ui.js وهو يُحمَّل بعد هذا الملف، فالنداء
     لا يقع إلا وقت العرض — ومع ذلك يُحرَس، إذ قد تُستعمل طبقة
     البيانات وحدها في اختبار أو أداة. */
  var PTS   = ["نقطة واحدة", "نقطتان", "نقاط", "نقطة"];
  var SHTS  = ["ورقة عمل واحدة", "ورقتا عمل", "أوراق عمل", "ورقة عمل"];
  function plural(n, forms) {
    if (window.TPUI && TPUI.count) return TPUI.count(n, forms);
    return TP.ar(n) + " " + forms[3];
  }

  /* ─── قاعدة الغياب ───
     تُكتب هنا مرةً واحدة وتُنادى من كشف الدرجات ومن تقرير الحضور
     معًا. كانت مكتوبةً في الموضعين بمقامين مختلفين: الكشف يقسم على
     سجلات الطالبة وحدها فيحرمها، والتقرير يقسم على كل حصص الشعبة
     فيقول «قاربت الحد». فالرقمان عن الطالبة نفسها كانا يختلفان.

     القاعدة المعتمدة:
       • «بعذر» خارج البسط والمقام معًا.
       • حصةٌ انعقدت ولم تُعلَّم فيها الطالبة = ثغرةٌ في السجل لا
         غياب، فتخرج من المقام. (ولو عُدَّت غيابًا لحُرمت طالبةٌ
         بسبب سهو الدكتورة عن التعليم لا بسبب تخلّفها.) */
  function absence(records) {
    var POL = (window.COURSE || {}).attendance || {};
    var ATT = POL.states || [];
    var counts = {};
    ATT.forEach(function (st) { counts[st.id] = st.counts; });

    var counted = 0, missed = 0;
    (records || []).forEach(function (r) {
      var c = counts[r.status];
      if (c === null || c === undefined) return;   /* بعذر أو وسم مجهول */
      counted++;
      if (c === false) missed++;
    });

    var rate = counted > 0 ? missed / counted : 0;
    return {
      counted: counted, missed: missed, rate: rate,
      barred: counted > 0 && rate >= (POL.absentLimit || 1),
      warn:   counted > 0 && rate >= (POL.warnAt || 1)
    };
  }

  function labelOf(scheme, id) {
    var hit = (scheme.items || []).filter(function (i) { return i.id === id; })[0];
    return hit ? hit.label : id;
  }

  /* التقدير من النسبة المئوية */
  function gradeLabel(pct) {
    var list = ((window.COURSE || {}).grading || {}).grades || [];
    for (var i = 0; i < list.length; i++) {
      if (pct >= list[i].min) return list[i].label;
    }
    return "";
  }

  /* ─── الواجهة العامة ─── */
  var A = window.TP_ADAPTER || Local;

  window.Store = {
    adapter: A.name || "custom",
    uid: uid,
    dayKey: dayKey,
    monthKey: monthKey,

    absence: absence,

    students: function (sectionId) { return A.students(sectionId); },
    student: function (id) {
      return A.students().then(function (all) {
        return all.filter(function (s) { return s.id === id; })[0] || null;
      });
    },
    saveStudent: function (s) { return A.saveStudent(s); },
    setStudents: function (l) { return A.setStudents(l); },
    removeStudent: function (id) { return A.removeStudent(id); },

    attendance: function (f) { return A.attendance(f); },
    markAttendance: function (r) { return A.markAttendance(r); },
    clearAttendance: function (sec, ses) { return A.clearAttendance(sec, ses); },
    schedule: function (sec) { return A.schedule(sec); },
    setSchedule: function (sec, m) { return A.setSchedule(sec, m); },

    events: function (f) { return A.events(f); },
    addEvent: function (e) { return A.addEvent(e); },
    removeEvent: function (id) { return A.removeEvent(id); },

    submissions: function (f) { return A.submissions(f); },
    saveSubmission: function (s) { return A.saveSubmission(s); },
    removeSubmission: function (id) { return A.removeSubmission(id); },

    grades: function (f) { return A.grades(f); },
    saveGrade: function (r) { return A.saveGrade(r); },
    scheme: function (sec) {
      return A.scheme(sec).then(function (sch) {
        return sch || defaultScheme();
      });
    },
    setScheme: function (sec, sch) { return A.setScheme(sec, sch); },

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

    /* ─── كشف الدرجات ───
       يجمع المحسوب من سجلات المنصة مع المُدخَل باليد في صفٍّ واحد
       لكل طالبة. يُرجع { scheme, rows, held, sheets } حيث كل صفّ:

         { student, cells:{ itemId:{score,max,note,auto} },
           total, outOf, pct, grade, complete }

       البنود المحسوبة لا تُخزَّن — تُشتقّ عند كل عرض من البيانات
       الحيّة، فلا تتقادم إذا رُصد تفاعل أو حضور بعد اليوم. */
    gradebook: function (sectionId) {
      var COURSE = window.COURSE || {};
      var SHEETS = window.WORKSHEETS || [];
      var ATT = (COURSE.attendance || {}).states || [];
      var countsBy = {};
      ATT.forEach(function (st) { countsBy[st.id] = st.counts; });

      return Promise.all([
        Store.scheme(sectionId),
        Store.ranking({ sectionId: sectionId }),
        A.attendance({ sectionId: sectionId }),
        A.submissions({}),          /* لا يُرشَّح بالشعبة — يُفهرس بالطالبة أدناه */
        A.grades({ sectionId: sectionId }),
        A.schedule(sectionId)
      ]).then(function (r) {
        var scheme = r[0], rank = r[1], att = r[2],
            subs = r[3], manual = r[4], sched = r[5] || {};

        /* الحصص التي انعقدت فعلًا: ما رُصد فيها حضور */
        var heldSet = {};
        att.forEach(function (a) { heldSet[a.session] = true; });
        var held = Object.keys(heldSet).length;

        /* الأوراق المطلوبة: ما صدر منها لحصصٍ انعقدت.
           وبند الدرجة يحصر نفسه بأنواعٍ بعينها عبر it.types — فدرجة
           «الواجبات الإلكترونية» على الأنشطة الصفّية واللاصفّية، لا
           على أوراق المراجعة التسع والعشرين. */
        function due(types) {
          return SHEETS.filter(function (w) {
            if (w.session && !heldSet[w.session]) return false;
            return !types || types.indexOf(w.type) >= 0;
          });
        }
        var sheets = due(null);

        /* أعلى نقاط تفاعل في الشعبة — أساس البند النسبي */
        var top = 0;
        rank.forEach(function (x) { if (x.points > top) top = x.points; });

        var byStudent = {};
        rank.forEach(function (x) { byStudent[x.student.id] = x; });

        var attBy = {}, subBy = {}, manBy = {};
        att.forEach(function (a) {
          (attBy[a.studentId] = attBy[a.studentId] || []).push(a);
        });
        /* التسليم الفارغ لا يُحتسب ولو كان وسمه «مسلَّم». حارسٌ ثانٍ
           خلف سياسة قاعدة البيانات: صفٌّ بلا إجابة ولا ملف لم تُحلّ
           فيه ورقة، فلا يستحق درجة الواجبات. */
        subs.forEach(function (x) {
          if (x.status !== "submitted" && x.status !== "locked") return;
          var has = Object.keys(x.answers || {}).length > 0 ||
                    Object.keys(x.files || {}).length > 0;
          if (!has) return;
          (subBy[x.studentId] = subBy[x.studentId] || {})[x.worksheetId] = true;
        });
        manual.forEach(function (g) {
          (manBy[g.studentId] = manBy[g.studentId] || {})[g.itemId] = g;
        });

        /* سياسة الغياب: نسبة الغياب وحدّ الحرمان — لا درجة لها */
        var POL = COURSE.attendance || {};

        var rows = rank.map(function (x) {
          var st = x.student, cells = {}, total = 0, outOf = 0, complete;

          scheme.items.forEach(function (it) {
            var max = +it.max || 0, score = null, note = "",
                auto = it.source !== "manual", computed = null;
            /* البند التعويضي لا يزيد المقسوم عليه — يحلّ محلّ غيره */
            if (!it.makeupFor) outOf += max;

            if (it.source === "engagement") {
              if (it.basis === "absolute") {
                var t = +it.target || 1;
                score = Math.min(1, x.points / t) * max;
                note = TP.ar(x.points) + " من " + plural(t, PTS);
              } else {
                score = top > 0 ? (x.points / top) * max : 0;
                note = plural(x.points, PTS) +
                       (top > 0 ? " · الأعلى " + TP.ar(top) : "");
              }

            } else if (it.source === "worksheets") {
              var want = due(it.types), done = 0, mineS = subBy[st.id] || {};
              want.forEach(function (w) { if (mineS[w.id]) done++; });
              score = want.length > 0 ? (done / want.length) * max : null;
              note = want.length > 0
                ? TP.ar(done) + " من " + plural(want.length, SHTS)
                : "لم تصدر أوراق بعد";
            } else {
              var g = (manBy[st.id] || {})[it.id];
              score = g && g.score != null ? +g.score : null;
              if (score === null && !it.makeupFor) note = "لم تُرصد";
            }

            /* ─── التعديل اليدوي يعلو على المحسوب ───
               الدكتورة تزيد وتنقص في أي بند، حتى المحسوب منه. فإن
               رُصدت قيمة لبندٍ محسوب، حلّت محلّ الحساب وبقي المحسوب
               معروضًا إلى جانبها — ليُعرف مقدار التعديل ويُرجَع عنه. */
            if (auto) {
              var ov = (manBy[st.id] || {})[it.id];
              if (ov && ov.score != null) {
                computed = score;
                score = +ov.score;
                note = (ov.note ? ov.note + " · " : "") + "عُدِّلت يدويًا" +
                       (computed != null
                         ? " (المحسوب " + (Math.round(computed * 10) / 10) + ")"
                         : "");
              }
            }

            cells[it.id] = { score: score, max: max, note: note, auto: auto,
                             computed: computed, overridden: computed != null,
                             bonus: +it.bonus || 0, makeup: !!it.makeupFor };
          });

          /* ─── الاختبار التعويضي ───
             لا يُجمع، بل يحلّ محلّ اختبارٍ واحد فات الطالبة. فإن
             فاتها اثنان سدّ واحدًا فقط — «تعويضي لمن فاتها أحد
             الاختبارين». */
          scheme.items.forEach(function (it) {
            if (!it.makeupFor) return;
            var mk = cells[it.id];
            if (!mk || mk.score == null) return;

            var gap = it.makeupFor.filter(function (tid) {
              return cells[tid] && cells[tid].score == null;
            });
            if (!gap.length) {
              mk.note = "لم تحتجه — جلست الاختبارين";
              mk.score = null;                    /* لا يُحتسب لمن حضرتهما */
              return;
            }
            var target = cells[gap[0]];
            var val = Math.min(+mk.score, +it.cap || target.max);
            target.score = val;
            target.note = "تعويضي";
            target.viaMakeup = true;
            mk.note = "عوّض «" + labelOf(scheme, gap[0]) + "»";
            if (gap.length > 1) {
              cells[gap[1]].score = 0;
              cells[gap[1]].note = "فات ولا تعويض ثانٍ";
            }
          });

          /* الاكتمال يُقرَّر بعد التعويض لا قبله، وإلا حُسبت المعوَّضة
             ناقصةً وهي تامّة */
          complete = scheme.items.every(function (it) {
            return it.makeupFor || cells[it.id].score != null;
          });

          /* المجموع بعد استقرار التعويض */
          scheme.items.forEach(function (it) {
            if (it.makeupFor) return;
            total += cells[it.id].score || 0;
          });

          /* الغياب: إنذار لا درجة — بالقاعدة المشتركة */
          var att_ = absence(attBy[st.id] || []);

          /* capAt = null يعني لا سقف: البونص يرفع فوق المئة ويبقى */
          var cap = (COURSE.grading || {}).capAt;
          var pct = outOf > 0 ? (total / outOf) * 100 : 0;
          var capped = cap == null ? pct : Math.min(pct, +cap);

          return { student: st, cells: cells, total: total, outOf: outOf,
                   pct: pct, capped: capped,
                   grade: att_.barred ? "محرومة" : gradeLabel(capped),
                   complete: complete, att: att_ };
        });

        return { scheme: scheme, rows: rows, held: held, sheets: sheets.length };
      });
    },

    /* تصدير كل البيانات (بلا الملفات) للنسخ الاحتياطي أو النقل */
    exportAll: function () {
      /* الدرجات والتوزيعة كانتا خارج النسخة، فكان «نسخة احتياطية»
         ثم «محو» ثم «استعادة» يُفقد كل درجة اختبار رُصدت باليد —
         ويُعاد بناء الكشف صامتًا فتصير التقديرات F بلا إنذار. */
      return Promise.all([A.students(), A.events({}), A.submissions({}),
                          A.attendance({}), A.schedule(), A.grades({}), A.scheme()])
        .then(function (r) {
          return {
            kind: "tp-backup", version: 3, at: new Date().toISOString(),
            students: r[0], events: r[1], submissions: r[2],
            attendance: r[3], schedule: r[4], grades: r[5], scheme: r[6]
          };
        });
    },

    importAll: function (payload, mode) {
      if (!payload || payload.kind !== "tp-backup") {
        return Promise.reject(new Error("الملف ليس نسخة احتياطية صالحة."));
      }
      /* الاستيراد يكتب في التخزين المحلي مباشرةً لا عبر المحوّل، فهو
         في وضع الخادم يكتب في مفاتيح لا يقرؤها أحد ثم يقول «تمّت
         الاستعادة». يُرفض صراحةً بدل إيهام النجاح. */
      if (A !== Local) {
        return Promise.reject(new Error(
          "الاستعادة تعمل في الوضع المحلي وحده. لرفع نسخةٍ إلى الخادم " +
          "استعمِلي «رفع البيانات المحلية» في صفحة الحساب."));
      }
      if (mode === "replace") {
        write("students", payload.students || []);
        write("events", payload.events || []);
        write("submissions", payload.submissions || []);
        write("attendance", payload.attendance || []);
        write("schedule", payload.schedule || {});
        write("grades", payload.grades || []);
        if (payload.scheme) write("scheme", payload.scheme);
        return Promise.resolve({ students: (payload.students || []).length,
                                 grades: (payload.grades || []).length });
      }
      if (payload.schedule) {                    /* الجدول يُدمج بالمفتاح */
        var cur = read("schedule", {});
        Object.keys(payload.schedule).forEach(function (k) {
          cur[k] = Object.assign({}, cur[k], payload.schedule[k]);
        });
        write("schedule", cur);
      }
      if (payload.scheme && !read("scheme", null)) write("scheme", payload.scheme);

      /* دمج: لا يُكرّر ما له نفس المعرّف.
         والدرجات تُدمج بمفتاحها الحقيقي (طالبة، بند) لا بالمعرّف —
         فمعرّفٌ مولَّد جديدًا كان يُنشئ درجةً ثانية للبند نفسه. */
      return Promise.all([A.students(), A.events({}), A.submissions({}),
                          A.attendance({}), A.grades({})]).then(function (r) {
        var added = { students: 0, events: 0, submissions: 0, attendance: 0, grades: 0 };

        var curG = r[4], keyed = {};
        curG.forEach(function (g) { keyed[g.studentId + "|" + g.itemId] = true; });
        (payload.grades || []).forEach(function (g) {
          if (keyed[g.studentId + "|" + g.itemId]) return;
          curG.push(g); added.grades++;
        });
        write("grades", curG);

        [["students", r[0]], ["events", r[1]], ["submissions", r[2]],
         ["attendance", r[3]]].forEach(function (pair) {
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
