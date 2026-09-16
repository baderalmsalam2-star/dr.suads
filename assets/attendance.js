/* ═══ الحضور والغياب وجدول الحصص ═══ */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var POLICY = COURSE.attendance || {};
  var STATES = POLICY.states || [];
  var el = TPUI.el, ar = TP.ar;
  var DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  var section, sched = {}, students = [], marks = {};
  var sessions = (COURSE.sessions || []).slice().sort(function (a, b) { return a.n - b.n; });

  TPUI.chrome("attendance", "الحضور والغياب");
  document.getElementById("credit").textContent = COURSE.credit || "";

  var sessionSel = document.getElementById("session");
  var sheet = document.getElementById("sheet");

  section = TPUI.sectionPicker(document.getElementById("section"), function (s) {
    section = s; loadAll();
  });

  sessions.forEach(function (s) {
    var o = document.createElement("option");
    o.value = s.n;
    o.textContent = "الحصة " + ar(s.n) + (s.title ? " — " + s.title : "");
    sessionSel.appendChild(o);
  });
  sessionSel.addEventListener("change", loadSheet);

  function currentSession() { return +sessionSel.value || 1; }

  /* ─── تحميل ─── */
  function loadAll() {
    Promise.all([Store.students(section.id), Store.schedule(section.id)])
      .then(function (r) {
        students = r[0].slice().sort(function (a, b) { return (a.no || 0) - (b.no || 0); });
        sched = r[1] || {};
        pickDefaultSession();
        renderSchedule();
        loadSheet();
      }).catch(fail);
  }

  /* الحصة المفتوحة افتراضًا: حصة اليوم إن وُجدت، وإلا آخر حصة مضت */
  function pickDefaultSession() {
    var today = Store.dayKey(), best = null;
    Object.keys(sched).forEach(function (n) {
      if (sched[n] === today) best = +n;
    });
    if (best === null) {
      var past = Object.keys(sched).filter(function (n) { return sched[n] <= today; })
                       .map(Number).sort(function (a, b) { return b - a; });
      best = past.length ? past[0] : 1;
    }
    sessionSel.value = best;
  }

  function loadSheet() {
    var n = currentSession();
    var lbl = document.getElementById("dayLabel");
    /* الرصد على حصةٍ مضت يُحفظ بتاريخها هي لا بتاريخ اليوم — يُقال
       صراحةً حتى لا تُظنّ الأرقام مبعثرةً على غير مواضعها. */
    var past = sched[n] && sched[n] < Store.dayKey();
    lbl.textContent = sched[n]
      ? TPUI.arDate(sched[n]) + (past ? " · رصد بأثر رجعي" : "")
      : "لا تاريخ لهذه الحصة بعد";
    lbl.classList.toggle("retro", !!past);

    Store.attendance({ sectionId: section.id, session: n }).then(function (list) {
      marks = {};
      list.forEach(function (a) { marks[a.studentId] = a.status; });
      renderSheet();
      renderReport();
    }).catch(fail);
  }

  /* ─── كشف الحصة ─── */
  function renderSheet() {
    sheet.textContent = "";
    var empty = document.getElementById("sheetEmpty");
    empty.textContent = "";

    if (!students.length) {
      document.getElementById("quick").hidden = true;
      empty.appendChild(TPUI.empty("لا يوجد كشف لهذه الشعبة.",
        "أضيفي الطالبات من صفحة «الطالبات» أولًا."));
      return;
    }
    document.getElementById("quick").hidden = false;

    students.forEach(function (st) {
      var cur = marks[st.id];
      var row = el("div", "att-row " + (cur || "unset"));
      row.appendChild(el("span", "n", ar(st.no)));
      row.appendChild(el("span", "nm", st.name));

      var box = el("div", "states");
      STATES.forEach(function (s) {
        var b = el("button", cur === s.id ? "on" : "", s.short);
        b.type = "button";
        b.title = s.label;
        b.setAttribute("aria-label", st.name + " — " + s.label);
        b.addEventListener("click", function () { mark(st, s.id); });
        box.appendChild(b);
      });
      row.appendChild(box);
      sheet.appendChild(row);
    });
    tally();
  }

  function mark(st, status) {
    var n = currentSession();
    Store.markAttendance({
      studentId: st.id, sectionId: section.id, session: n,
      day: sched[n] || Store.dayKey(), status: status
    }).then(function () {
      marks[st.id] = status;
      renderSheet();
      renderReport();
    }).catch(fail);
  }

  /* تعطيل الورقة أثناء دفعةٍ جارية */
  function busy(on) {
    var sheet = document.getElementById("sheet");
    var quick = document.getElementById("quick");
    [sheet, quick].forEach(function (box) {
      if (!box) return;
      box.classList.toggle("busy", !!on);
      [].slice.call(box.querySelectorAll("button")).forEach(function (b) {
        b.disabled = !!on;
      });
    });
  }

  function tally() {
    var c = {};
    students.forEach(function (st) { var m = marks[st.id]; if (m) c[m] = (c[m] || 0) + 1; });
    var parts = STATES.filter(function (s) { return c[s.id]; })
      .map(function (s) { return s.label + " " + ar(c[s.id]); });
    var left = students.length - Object.keys(marks).length;
    if (left > 0) parts.push("بلا تعليم " + ar(left));
    document.getElementById("tally").textContent = parts.join(" · ");
  }

  /* ─── تعليم سريع ─── */
  function markAll(status) {
    var n = currentSession();
    /* السلسلة تستغرق ثوانيَ على الخادم (طلب لكل طالبة). وكانت
       الأزرار تبقى حيّة والتنبيه يظهر فورًا، فتعلّم الدكتورة «غ»
       لطالبة ثم تصل السلسلة إليها فتكتب «حاضرة» فوقها — والشاشة
       تعرض الصحيح والمحفوظ خطأ. تُقفل الورقة حتى تنتهي. */
    busy(true);
    var chain = Promise.resolve();
    students.forEach(function (st) {
      chain = chain.then(function () {
        return Store.markAttendance({
          studentId: st.id, sectionId: section.id, session: n,
          day: sched[n] || Store.dayKey(), status: status
        });
      });
    });
    chain.then(function () {
      busy(false);
      TPUI.toast(status === "present"
        ? "عُلّمت الكل حاضرات — علّمي الغائبات الآن."
        : "عُلّمت الكل غائبات.", "good");
      loadSheet();
    }).catch(function (e) { busy(false); fail(e); });
  }

  document.getElementById("allPresent").addEventListener("click", function () {
    markAll("present");
  });
  document.getElementById("allAbsent").addEventListener("click", function () { markAll("absent"); });
  document.getElementById("clearDay").addEventListener("click", function () {
    if (!confirm("مسح تعليم الحضور لهذه الحصة كاملةً؟")) return;
    Store.clearAttendance(section.id, currentSession()).then(loadSheet).catch(fail);
  });

  /* ─── تقرير الحضور ─── */
  function renderReport() {
    var table = document.getElementById("report");
    var note = document.getElementById("repNote");
    table.textContent = ""; note.textContent = "";

    Store.attendance({ sectionId: section.id }).then(function (all) {
      var held = {};
      all.forEach(function (a) { held[a.session] = true; });
      var total = Object.keys(held).length;

      document.getElementById("repSub").textContent =
        total ? "رُصد حضور " + TPUI.lessons(total) : "لم تُرصد أي حصة بعد";

      if (!total || !students.length) {
        table.hidden = true;
        note.appendChild(TPUI.empty("لا يوجد حضور مرصود بعد.",
          "علّمي حضور الحصة أعلاه، فيظهر التقرير هنا."));
        return;
      }
      table.hidden = false;

      var by = {};
      all.forEach(function (a) {
        (by[a.studentId] = by[a.studentId] || []).push(a);
      });

      var head = el("thead"), hr = el("tr");
      ["#", "الطالبة"].concat(STATES.map(function (s) { return s.label; }))
        .concat(["نسبة الغياب", ""]).forEach(function (h) { hr.appendChild(el("th", "", h)); });
      head.appendChild(hr); table.appendChild(head);

      var body = el("tbody"), denied = 0, warned = 0;
      students.forEach(function (st) {
        var recs = by[st.id] || [];
        var c = {};
        recs.forEach(function (r) { c[r.status] = (c[r.status] || 0) + 1; });

        /* القاعدة من Store.absence — لا تُعاد كتابتها هنا، فقد كان
           هذا الموضع يقسم على حصص الشعبة كلها والكشف يقسم على سجلات
           الطالبة، فيختلف الرقمان عن الطالبة نفسها. */
        var ab = Store.absence(recs);
        var counted = ab.counted, absent = ab.missed, pct = ab.rate;

        var tr = el("tr");
        tr.appendChild(el("td", "num", ar(st.no)));
        var td = el("td");
        var a = el("a", "", st.name);
        a.href = "student.html?id=" + encodeURIComponent(st.id);
        td.appendChild(a);
        tr.appendChild(td);
        STATES.forEach(function (s) {
          tr.appendChild(el("td", "num", c[s.id] ? ar(c[s.id]) : "—"));
        });

        var tdP = el("td", "num");
        tdP.appendChild(document.createTextNode(ar(Math.round(pct * 100)) + "٪ "));
        var bar = el("span", "bar" + (pct >= (POLICY.absentLimit || 1) ? " deny"
                                    : pct >= (POLICY.warnAt || 1) ? " warn" : ""));
        var fill = document.createElement("i");
        fill.style.width = Math.min(100, Math.round(pct * 100)) + "%";
        bar.appendChild(fill);
        tdP.appendChild(bar);
        tr.appendChild(tdP);

        var tdS = el("td");
        if (pct >= (POLICY.absentLimit || 1)) {
          tdS.appendChild(el("span", "chip", "تجاوزت حد الحرمان"));
          tr.className = "deny"; denied++;
        } else if (pct >= (POLICY.warnAt || 1)) {
          tdS.appendChild(el("span", "chip gold", "قاربت الحد"));
          warned++;
        }
        tr.appendChild(tdS);
        body.appendChild(tr);
      });
      table.appendChild(body);

      var msgs = [];
      if (denied) msgs.push(TPUI.students(denied) + " تجاوزت حد الغياب (" +
                            ar(Math.round((POLICY.absentLimit || 0) * 100)) + "٪)");
      if (warned) msgs.push(TPUI.students(warned) + " قاربت الحد");
      note.appendChild(el("div", "note-box", msgs.length
        ? msgs.join(" · ") + ". حد الحرمان يُعدَّل في data/course.js بحسب لائحة الكلية."
        : "لا أحد قارب حد الغياب. الحد الحالي " +
          ar(Math.round((POLICY.absentLimit || 0) * 100)) + "٪ — يُعدَّل في data/course.js."));
    }).catch(fail);
  }

  /* ─── جدول التواريخ ─── */
  var schedBox = document.getElementById("schedBox");
  var chosen = {};

  document.getElementById("schedBtn").addEventListener("click", function () {
    schedBox.hidden = !schedBox.hidden;
  });

  /* أيام المحاضرة وتاريخ أول محاضرة مملوءان سلفًا من خطة المقرر،
     ويبقيان قابلين للتغيير */
  (COURSE.classDays || []).forEach(function (i) { chosen[i] = true; });
  if (COURSE.firstClass) document.getElementById("startDate").value = COURSE.firstClass;

  /* أيام الاختبارات: يوم الاختبار يشغل وقت المحاضرة فلا درس فيه */
  var EXAMS = {};
  (COURSE.examDays || []).forEach(function (e) { EXAMS[e.date] = e; });

  DAYS.forEach(function (d, i) {
    var pill = el("span", "day-pill" + (chosen[i] ? " on" : ""), d);
    pill.setAttribute("role", "button");
    pill.tabIndex = 0;
    function toggle() {
      chosen[i] = !chosen[i];
      pill.classList.toggle("on", !!chosen[i]);
    }
    pill.addEventListener("click", toggle);
    pill.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
    document.getElementById("days").appendChild(pill);
  });

  document.getElementById("genSched").addEventListener("click", function () {
    var start = document.getElementById("startDate").value;
    var days = Object.keys(chosen).filter(function (k) { return chosen[k]; }).map(Number);
    if (!start) return TPUI.toast("حدّدي تاريخ أول محاضرة.", "bad");
    if (!days.length) return TPUI.toast("اختاري يومًا واحدًا على الأقل.", "bad");

    var p = start.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var map = {}, n = 1, guard = 0;
    while (n <= sessions.length && guard++ < 2000) {
      var key = d.getFullYear() + "-" +
                ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
      if (days.indexOf(d.getDay()) >= 0 && !EXAMS[key]) {
        map[n] = key;
        n++;
      }
      d.setDate(d.getDate() + 1);
    }
    Store.setSchedule(section.id, map).then(function () {
      sched = map;
      TPUI.toast("وُلِّدت تواريخ " + TPUI.lessons(Object.keys(map).length) +
                 "، وتُخطّيت أيام الاختبارات.", "good");
      renderSchedule();
      loadSheet();
    }).catch(fail);
  });

  /* التقويم الجامعي — يُعرض ليُقاس عليه الجدول لا ليُحفظ */
  function renderTerm() {
    var T = COURSE.term, box = document.getElementById("termBox");
    if (!box || !T) return;
    box.textContent = "";
    var rows = [
      ["بدء الدراسة", T.start],
      ["آخر يوم في الدراسة", T.lastClass],
      ["الامتحانات النهائية", T.finalsFrom + "…" + T.finalsTo]
    ].concat((T.marks || []).map(function (m) { return [m.label, m.date]; }));

    rows.forEach(function (r) {
      var d = el("div", "term-item");
      d.appendChild(el("span", "k", r[0]));
      d.appendChild(el("span", "v", r[1].indexOf("…") > 0
        ? TPUI.arDate(r[1].split("…")[0]) + " — " + TPUI.arDate(r[1].split("…")[1])
        : TPUI.arDate(r[1])));
      box.appendChild(d);
    });
  }

  /* هل خرج الجدول عن حدود الفصل؟ سؤالٌ يُجاب قبل أن يقع لا بعده */
  function checkTerm() {
    var T = COURSE.term, warn = document.getElementById("termWarn");
    if (!warn) return;
    if (!T || !T.lastClass) { warn.hidden = true; return; }

    var over = Object.keys(sched).filter(function (n) {
      return sched[n] && sched[n] > T.lastClass;
    }).map(Number).sort(function (a, b) { return a - b; });

    if (!over.length) { warn.hidden = true; return; }
    warn.hidden = false;
    warn.textContent = "تجاوزت " + TPUI.lessons(over.length) +
      " آخر يوم في الدراسة (" + TPUI.arDate(T.lastClass) + ") — " +
      (over.length === 1 ? "هي الحصة " : "أولاها الحصة ") + ar(over[0]) +
      ". قدّمي التواريخ أو ادمجي حصصًا.";
  }

  function renderSchedule() {
    var t = document.getElementById("schedTable");
    t.textContent = "";
    renderTerm();
    checkTerm();
    var head = el("thead"), hr = el("tr");
    ["الحصة", "العنوان", "التاريخ"].forEach(function (h) { hr.appendChild(el("th", "", h)); });
    head.appendChild(hr); t.appendChild(head);

    var body = el("tbody");
    sessions.forEach(function (s) {
      /* الاختبار الواقع بين حصتين يظهر صفًّا في موضعه من التسلسل */
      (COURSE.examDays || []).forEach(function (e) {
        var prev = sched[s.n - 1];
        if (!prev || !sched[s.n]) return;
        if (e.date > prev && e.date < sched[s.n]) body.appendChild(examRow(e));
      });

      var tr = el("tr");
      tr.appendChild(el("td", "num", ar(s.n)));
      tr.appendChild(el("td", "", s.title || "—"));
      var td = el("td", "num");
      var inp = document.createElement("input");
      inp.type = "date";
      inp.value = sched[s.n] || "";
      inp.addEventListener("change", function () {
        if (inp.value) sched[s.n] = inp.value; else delete sched[s.n];
        Store.setSchedule(section.id, sched).then(function () {
          if (s.n === currentSession()) loadSheet();
        }).catch(fail);
      });
      td.appendChild(inp);
      tr.appendChild(td);
      body.appendChild(tr);
    });
    /* وما وقع بعد آخر حصة يُذيَّل به الجدول */
    var last = sched[sessions[sessions.length - 1].n];
    (COURSE.examDays || []).forEach(function (e) {
      if (last && e.date > last) body.appendChild(examRow(e));
    });
    t.appendChild(body);
  }

  function examRow(e) {
    var tr = el("tr", "exam-row");
    tr.appendChild(el("td", "num", "—"));
    tr.appendChild(el("td", "", e.label));
    tr.appendChild(el("td", "num", TPUI.arDate(e.date)));
    return tr;
  }

  /* ─── التصدير ─── */
  document.getElementById("exportBtn").addEventListener("click", function () {
    Store.attendance({ sectionId: section.id }).then(function (all) {
      var held = {};
      all.forEach(function (a) { held[a.session] = true; });
      var cols = Object.keys(held).map(Number).sort(function (a, b) { return a - b; });
      if (!cols.length) return TPUI.toast("لا يوجد حضور مرصود للتصدير.", "bad");

      var by = {};
      all.forEach(function (a) { by[a.studentId + "|" + a.session] = a.status; });
      var label = {};
      STATES.forEach(function (s) { label[s.id] = s.label; });

      var rows = [["الرقم الجامعي", "الاسم"].concat(
        cols.map(function (n) { return "حصة " + n + (sched[n] ? " " + sched[n] : ""); }))
        .concat(["أيام الغياب", "نسبة الغياب"])];

      students.forEach(function (st) {
        var recs = [];
        var line = [st.uid || "", st.name].concat(cols.map(function (n) {
          var s = by[st.id + "|" + n];
          if (s) recs.push({ status: s });
          return s ? label[s] : "";
        }));
        /* القاعدة نفسها التي في الكشف والتقرير — كانت هنا نسخة ثالثة */
        var ab = Store.absence(recs);
        line.push(ab.missed);
        line.push(ab.counted > 0 ? Math.round(ab.rate * 100) + "%" : "");
        rows.push(line);
      });

      TPUI.download("attendance-sec" + section.id + "-" + Store.dayKey() + ".csv",
                    TPUI.csv(rows), "text/csv");
      TPUI.toast("نُزّل ملف الحضور — يُفتح في Excel.", "good");
    }).catch(fail);
  });

  function fail(e) {
    console.error(e);
    TPUI.toast(e && e.message ? e.message : "حدث خطأ.", "bad");
  }

  loadAll();
})();
