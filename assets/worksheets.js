/* ═══ قائمة أوراق العمل والواجبات + حالة التسليم ═══ */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var COURSE = window.COURSE || {};
  var SHEETS = window.WORKSHEETS || [];

  TPUI.chrome("worksheets", "أوراق العمل والواجبات");
  TPUI.credit("credit");

  var section = TPUI.sectionPicker(document.getElementById("section"), function (s) {
    section = s; sched = null; render();
  });

  /* ─── منتقي المحاضرة ───
     الأوراق تبلغ ثلاثًا في كل محاضرة، فصفحةٌ مسطّحة تعرض سبعين بطاقةً
     وسبعين عمودًا — لا يُهتدى فيها إلى ورقة اليوم. فتُجمع الأوراق
     تحت محاضراتها، وتُفتح الصفحة على المحاضرة الجارية. */
  var LESSON_KEY = "tp.ws.lesson";
  var lessonSel = document.getElementById("lesson");
  var sched = null;
  var lesson = null;                 /* رقم المحاضرة، أو "all" */

  lessonSel.addEventListener("change", function () {
    lesson = lessonSel.value;
    try { localStorage.setItem(LESSON_KEY, lesson); } catch (e) { /* تصفّح خاص */ }
    paint();
  });

  /* أرقام المحاضرات التي لها أوراق، مرتّبة */
  function lessonNumbers() {
    var seen = {};
    SHEETS.forEach(function (w) { seen[+w.session || 0] = true; });
    return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
  }

  function titleOf(n) {
    var s = (COURSE.sessions || []).filter(function (x) { return +x.n === +n; })[0];
    return s ? s.title : "";
  }

  function fillLessons() {
    var nums = lessonNumbers();
    var want = lesson;
    if (want == null) {
      try { want = localStorage.getItem(LESSON_KEY); } catch (e) { want = null; }
      if (!want) want = String(TPUI.currentSession(sched));
    }
    lessonSel.textContent = "";
    var all = document.createElement("option");
    all.value = "all";
    all.textContent = "كل المحاضرات (" + ar(nums.length) + ")";
    lessonSel.appendChild(all);

    nums.forEach(function (n) {
      var o = document.createElement("option");
      o.value = String(n);
      o.textContent = "المحاضرة " + ar(n) + (titleOf(n) ? " · " + titleOf(n) : "");
      lessonSel.appendChild(o);
    });

    /* المحفوظ إن كان لا يزال قائمًا، وإلا أقرب محاضرة لها أوراق */
    var ok = want === "all" || nums.indexOf(+want) >= 0;
    if (!ok && nums.length) {
      var near = nums.filter(function (n) { return n <= +want; });
      want = String(near.length ? near[near.length - 1] : nums[0]);
    }
    lesson = ok || nums.length ? want : "all";
    lessonSel.value = lesson;
  }

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
  var data = null;              /* { students, subs } — يُقرأ مرةً ويُرسم مرارًا */

  function render() {
    document.getElementById("sub").textContent = section.name;

    /*  تصحيحات نصوص الأوراق تُجلب مرةً واحدة وتُطبَّق على
        window.WORKSHEETS، فتُقرأ هنا وفي بقية الصفحات بلا فرق. */
    Promise.all([
      TPContent.ready(),
      Store.students(section.id),
      Store.submissions({}),
      sched ? Promise.resolve(sched) : Store.schedule(section.id)
    ]).then(function (r) {
      sched = r[3] || {};
      var students = r[1].slice().sort(function (a, b) { return (a.no || 0) - (b.no || 0); });
      var ids = {};
      students.forEach(function (st) { ids[st.id] = true; });
      data = { students: students, subs: r[2].filter(function (x) { return ids[x.studentId]; }) };
      fillLessons();
      paint();
    }).catch(fail);
  }

  var KIND = { classwork: "نشاط صفّي", homework: "واجب لاصفّي", worksheet: "ورقة مراجعة" };
  /* الترتيب داخل المحاضرة: ما يُحتسب أولًا، والمراجعة آخرًا */
  var ORDER = { classwork: 0, homework: 1, worksheet: 2 };

  function shown() {
    if (lesson === "all") return lessonNumbers();
    return [+lesson];
  }

  function sheetsOf(n) {
    return SHEETS.filter(function (w) { return +w.session === +n; })
                 .sort(function (a, b) {
                   return (ORDER[a.type || "worksheet"] || 0) - (ORDER[b.type || "worksheet"] || 0);
                 });
  }

  function paint() {
    if (!data) return;
    var box = document.getElementById("groups");
    box.textContent = "";

    var nums = shown();
    if (!nums.length) {
      box.appendChild(TPUI.empty("لا أوراق بعد.",
        "الأنشطة في activities.js، وأوراق المراجعة في worksheets.js — داخل مجلّد المقرر"));
      matrix(data.students, data.subs, []);
      return;
    }

    var open = TPUI.currentSession(sched);
    nums.forEach(function (n) {
      box.appendChild(group(n, nums.length === 1 || +n === +open));
    });
    matrix(data.students, data.subs, nums);
  }

  /* طيّة محاضرة: عنوانها ملخّصٌ يُغني عن فتحها */
  function group(n, openIt) {
    var list = sheetsOf(n);
    var total = data.students.length;

    var d = el("details", "lesson-group");
    d.open = !!openIt;

    var sum = el("summary");
    var t = el("div", "g-title");
    t.appendChild(el("span", "g-no", "المحاضرة " + ar(n)));
    t.appendChild(el("span", "g-name", titleOf(n) || ""));
    sum.appendChild(t);

    /* كم ورقةً في المحاضرة، وكم منها سُلِّم من الشعبة كلها */
    var graded = list.filter(function (w) {
      return w.type === "classwork" || w.type === "homework";
    });
    var doneAll = graded.length && total
      ? graded.every(function (w) { return submitted(w).length >= total; })
      : false;
    var some = graded.reduce(function (a, w) { return a + submitted(w).length; }, 0);

    var tag = el("span", "g-count" + (doneAll ? " done" : ""));
    tag.textContent = TPUI.sheets(list.length) +
      (graded.length && total
        ? " · سُلِّم " + ar(some) + " من " + ar(graded.length * total)
        : "");
    sum.appendChild(tag);
    d.appendChild(sum);

    var ul = el("ul", "cards");
    list.forEach(function (w) { ul.appendChild(card(w, total)); });
    d.appendChild(ul);
    return d;
  }

  function submitted(w) {
    return data.subs.filter(function (x) {
      return x.worksheetId === w.id && x.status === "submitted";
    });
  }

  function card(w, total) {
    var done = submitted(w).length;
    var li = el("li", "card ready" + (done ? " done" : ""));
    li.appendChild(el("span", "badge", done ? ar(done) + " من " + ar(total) : "لم يُسلَّم بعد"));

    var a = el("a", "open");
    a.href = "worksheet.html?w=" + encodeURIComponent(w.id) +
             "&section=" + encodeURIComponent(section.id);
    a.appendChild(el("span", "no", KIND[w.type || "worksheet"]));
    a.appendChild(el("h2", "", w.title));
    if (w.subtitle) a.appendChild(el("div", "sub", w.subtitle));

    var meta = el("div", "meta");
    meta.appendChild(el("span", "", w.pages || ""));
    var graded = w.type === "classwork" || w.type === "homework";
    meta.appendChild(el("span", "readers", TPUI.questions(w.items.length) +
      (graded ? " · التسليم يُحتسب" : " · للمراجعة")));
    a.appendChild(meta);
    li.appendChild(a);
    return li;
  }

  /*  مصفوفة التسليم تتبع المنتقي:
      محاضرةٌ واحدة ⇒ عمودٌ لكل ورقة فيها، بحالة كل طالبة صريحة.
      كل المحاضرات ⇒ عمودٌ لكل محاضرة يحمل «كم من كم» — لأن سبعين
      عمودًا لا تُقرأ، والمقصود من النظرة الشاملة معرفةُ من تأخّرت
      لا أيّ ورقةٍ بعينها. */
  function matrix(students, subs, nums) {
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

    var wide = nums.length !== 1;
    var cols = wide
      ? nums.map(function (n) {
          return { key: n, label: "م" + ar(n), sheets: sheetsOf(n) };
        })
      : sheetsOf(nums[0]).map(function (w) {
          return { key: w.id, label: w.title.replace(/^.*?: /, ""), sheets: [w] };
        });

    var head = el("thead"), hr = el("tr");
    hr.appendChild(el("th", "", "#"));
    hr.appendChild(el("th", "", "الطالبة"));
    cols.forEach(function (c) { hr.appendChild(el("th", wide ? "num" : "sheet", c.label)); });
    head.appendChild(hr);
    table.appendChild(head);

    var body = el("tbody");
    students.forEach(function (st) {
      var tr = el("tr");
      tr.appendChild(el("td", "num", ar(st.no)));
      var td = el("td", "name");
      var a = el("a", "", st.name);
      a.href = "student.html?id=" + encodeURIComponent(st.id);
      td.appendChild(a);
      tr.appendChild(td);

      cols.forEach(function (c) {
        var cell = el("td", "num");
        var mine = subs.filter(function (x) {
          return x.studentId === st.id && c.sheets.some(function (w) {
            return w.id === x.worksheetId;
          });
        });
        var done = mine.filter(function (x) { return x.status === "submitted"; }).length;

        if (wide) {
          if (!c.sheets.length) cell.textContent = "—";
          else cell.appendChild(el("span",
            "chip " + (done >= c.sheets.length ? "gold" : done ? "blue" : ""),
            ar(done) + "/" + ar(c.sheets.length)));
        } else if (done) {
          cell.appendChild(el("span", "chip gold", "سُلِّم"));
        } else if (mine.length) {
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
