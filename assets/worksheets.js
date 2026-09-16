/* ═══ قائمة أوراق العمل والواجبات + حالة التسليم ═══ */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var SHEETS = window.WORKSHEETS || [];

  TPUI.chrome("worksheets", "أوراق العمل والواجبات");
  TPUI.credit("credit");

  var section = TPUI.sectionPicker(document.getElementById("section"), function (s) {
    section = s; render();
  });

  /* ─── استلام ملفات التسليم من الطالبات ─── */
  var collectFile = document.getElementById("collectFile");
  document.getElementById("collect").addEventListener("click", function () { collectFile.click(); });

  collectFile.addEventListener("change", function () {
    var files = [].slice.call(collectFile.files);
    if (!files.length) return;

    Promise.all(files.map(function (f) {
      return TPUI.readAsText(f).then(function (t) { return JSON.parse(t); });
    })).then(function (payloads) {
      return payloads.reduce(function (chain, p) {
        return chain.then(function (acc) { return intake(p).then(function (r) { acc.push(r); return acc; }); });
      }, Promise.resolve([]));
    }).then(function (results) {
      var ok = results.filter(function (r) { return r.ok; }).length;
      var bad = results.length - ok;
      TPUI.toast("استُلم " + ar(ok) + " تسليمًا" + (bad ? "، ورُفض " + ar(bad) : "") + ".",
                 bad ? "bad" : "good");
      render();
    }).catch(function (e) {
      TPUI.toast(e.message || "الملف غير صالح.", "bad");
    }).then(function () { collectFile.value = ""; });
  });

  /* يُطابق التسليم على طالبة بالمعرّف، وإلا بالاسم داخل نفس الشعبة */
  function intake(payload) {
    if (!payload || payload.kind !== "tp-submission") {
      return Promise.resolve({ ok: false });
    }
    return Store.students().then(function (all) {
      var st = all.filter(function (s) { return s.id === payload.studentId; })[0];

      /* ─── المطابقة بالاسم وحده أُسقطت ───
         الملف يكتبه المتصفّح على جهاز الطالبة، فحقلا studentName
         وsectionId فيه نصّان تملكهما هي. وكانت المطابقة بالاسم
         تكفي لأن تضع طالبةٌ اسم زميلتها فيدوس ملفُها تسليمَ
         زميلتها المقفل. الآن يُطابَق بالمعرّف، أو بالاسم والرقم
         الجامعي معًا — والرقم مطبوع في الكشف لا يُخمَّن. */
      if (!st && payload.studentName && payload.studentUid) {
        st = all.filter(function (s) {
          return s.name === payload.studentName &&
                 String(s.uid || "") === String(payload.studentUid) &&
                 String(s.sectionId) === String(payload.sectionId);
        })[0];
      }
      if (!st) return { ok: false, reason: "no-match" };

      var sub = Object.assign({}, payload.submission, {
        studentId: st.id, status: "submitted"
      });

      /* المرفقات تُكتب على جهاز الدكتورة بمعرّفاتها نفسها، فتفتح
         من صفحة الطالبة كما لو رُفعت هنا */
      var att = (payload.attachments || []).filter(function (f) { return f && f.data; });
      var saveAtt = att.reduce(function (p, f) {
        return p.then(function () {
          return Store.putFile({ id: f.fileId, name: f.name, type: f.type,
                                 size: f.size, data: f.data,
                                 studentId: st.id });
        });
      }, Promise.resolve());
      return saveAtt
        .then(function () {
          return Store.submissions({ studentId: st.id, worksheetId: sub.worksheetId });
        })
        .then(function (existing) {
          /* الدوس على تسليمٍ مقفل لا يقع صامتًا */
          if (existing.length && existing[0].status === "submitted") {
            var w = (window.WORKSHEETS || []).filter(function (x) {
              return x.id === sub.worksheetId;
            })[0];
            if (!confirm("لـ«" + st.name + "» تسليمٌ مقفل في «" +
                         ((w && w.title) || sub.worksheetId) +
                         "». هل تستبدلينه بالملف الجديد؟")) {
              return Promise.reject(new Error("skip"));
            }
          }
          if (existing.length) sub.id = existing[0].id;   /* يُحدَّث لا يُكرَّر */
          return Store.saveSubmission(sub);
        })
        .then(function () { return { ok: true }; })
        .catch(function (e) {
          if (e && e.message === "skip") return { ok: false, reason: "skipped" };
          throw e;
        });
    });
  }

  /* نقطة التسليم تُشتقّ في Store.ranking من التسليمات نفسها،
     فلم تعد تُكتب حدثًا هنا ولا في worksheet.js. */



  /* ─── العرض ─── */
  function render() {
    document.getElementById("sub").textContent = section.name;

    Promise.all([Store.students(section.id), Store.submissions({})]).then(function (r) {
      var students = r[0].slice().sort(function (a, b) { return (a.no || 0) - (b.no || 0); });
      var subs = r[1];
      var ids = {};
      students.forEach(function (s) { ids[s.id] = true; });
      var mine = subs.filter(function (s) { return ids[s.studentId]; });

      cards("classwork", byType("classwork"), mine, students.length);
      cards("homework",  byType("homework"),  mine, students.length);
      cards("sheets",    byType("worksheet"), mine, students.length);

      function byType(t) {
        return SHEETS.filter(function (w) { return (w.type || "worksheet") === t; });
      }
      matrix(students, mine);
    }).catch(fail);
  }

  var KIND = { classwork: "نشاط صفّي", homework: "واجب لاصفّي", worksheet: "ورقة مراجعة" };

  function cards(containerId, list, subs, total) {
    var ul = document.getElementById(containerId);
    ul.textContent = "";
    if (!list.length) {
      ul.appendChild(el("li", "", "")).appendChild(
        TPUI.empty("لا شيء هنا بعد.",
          "الأنشطة في data/activities.js، وأوراق المراجعة في data/worksheets.js"));
      return;
    }
    list.forEach(function (w) {
      var done = subs.filter(function (s) {
        return s.worksheetId === w.id && s.status === "submitted";
      }).length;

      var li = el("li", "card ready" + (done ? " done" : ""));
      li.appendChild(el("span", "badge", done ? ar(done) + " من " + ar(total) : "لم يُسلَّم بعد"));

      var a = el("a", "open");
      a.href = "worksheet.html?w=" + encodeURIComponent(w.id) +
               "&section=" + encodeURIComponent(section.id);
      a.appendChild(el("span", "no", "الحصة " + ar(w.session) + " · " + KIND[w.type || "worksheet"]));
      a.appendChild(el("h2", "", w.title));
      if (w.subtitle) a.appendChild(el("div", "sub", w.subtitle));

      var meta = el("div", "meta");
      meta.appendChild(el("span", "", w.pages || ""));
      var graded = w.type === "classwork" || w.type === "homework";
      meta.appendChild(el("span", "readers", TPUI.questions(w.items.length) +
        (graded ? " · التسليم يُحتسب" : " · للمراجعة")));
      a.appendChild(meta);
      li.appendChild(a);
      ul.appendChild(li);
    });
  }

  function matrix(students, subs) {
    var table = document.getElementById("table");
    var emptyBox = document.getElementById("emptyBox");
    table.textContent = "";
    emptyBox.textContent = "";

    if (!students.length) {
      table.hidden = true;
      emptyBox.appendChild(TPUI.empty("لا يوجد كشف لهذه الشعبة.",
        "أضيفي الكشف من صفحة «الطالبات» أولًا."));
      return;
    }
    table.hidden = false;

    var head = el("thead"), hr = el("tr");
    hr.appendChild(el("th", "", "#"));
    hr.appendChild(el("th", "", "الطالبة"));
    SHEETS.forEach(function (w) { hr.appendChild(el("th", "", w.title.replace(/^.*?: /, ""))); });
    head.appendChild(hr);
    table.appendChild(head);

    var body = el("tbody");
    students.forEach(function (st) {
      var tr = el("tr");
      tr.appendChild(el("td", "num", ar(st.no)));
      var td = el("td");
      var a = el("a", "", st.name);
      a.href = "student.html?id=" + encodeURIComponent(st.id);
      td.appendChild(a);
      tr.appendChild(td);

      SHEETS.forEach(function (w) {
        var sub = subs.filter(function (s) {
          return s.studentId === st.id && s.worksheetId === w.id;
        })[0];
        var cell = el("td", "num");
        if (sub && sub.status === "submitted") {
          cell.appendChild(el("span", "chip gold", "سُلِّم"));
        } else if (sub) {
          cell.appendChild(el("span", "chip blue", "مسودة"));
        } else {
          cell.textContent = "—";
        }
        tr.appendChild(cell);
      });
      body.appendChild(tr);
    });
    table.appendChild(body);
  }

  function fail(e) {
    console.error(e);
    TPUI.toast(e && e.message ? e.message : "حدث خطأ.", "bad");
  }

  render();
})();
