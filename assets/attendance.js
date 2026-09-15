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
    document.getElementById("dayLabel").textContent =
      sched[n] ? TPUI.arDate(sched[n]) : "لا تاريخ لهذه الحصة بعد";

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
    var chain = Promise.resolve();
    students.forEach(function (st) {
      chain = chain.then(function () {
        return Store.markAttendance({
          studentId: st.id, sectionId: section.id, session: n,
          day: sched[n] || Store.dayKey(), status: status
        });
      });
    });
    chain.then(loadSheet).catch(fail);
  }

  document.getElementById("allPresent").addEventListener("click", function () {
    markAll("present");
    TPUI.toast("عُلّمت الكل حاضرات — علّمي الغائبات الآن.", "good");
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

        /* «بعذر» لا تُحتسب في المقام ولا في البسط */
        var excused = c.excused || 0;
        var counted = total - excused;
        var absent = c.absent || 0;
        var pct = counted > 0 ? absent / counted : 0;

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

  DAYS.forEach(function (d, i) {
    var pill = el("span", "day-pill", d);
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
      if (days.indexOf(d.getDay()) >= 0) {
        map[n] = d.getFullYear() + "-" +
                 ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
        n++;
      }
      d.setDate(d.getDate() + 1);
    }
    Store.setSchedule(section.id, map).then(function () {
      sched = map;
      TPUI.toast("وُلِّدت تواريخ " + ar(Object.keys(map).length) + " حصة.", "good");
      renderSchedule();
      loadSheet();
    }).catch(fail);
  });

  function renderSchedule() {
    var t = document.getElementById("schedTable");
    t.textContent = "";
    var head = el("thead"), hr = el("tr");
    ["الحصة", "العنوان", "التاريخ"].forEach(function (h) { hr.appendChild(el("th", "", h)); });
    head.appendChild(hr); t.appendChild(head);

    var body = el("tbody");
    sessions.forEach(function (s) {
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
    t.appendChild(body);
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
        var absent = 0, excused = 0;
        var line = [st.uid || "", st.name].concat(cols.map(function (n) {
          var s = by[st.id + "|" + n];
          if (s === "absent") absent++;
          if (s === "excused") excused++;
          return s ? label[s] : "";
        }));
        var counted = cols.length - excused;
        line.push(absent);
        line.push(counted > 0 ? Math.round(absent / counted * 100) + "%" : "");
        rows.push(line);
      });

      var csv = rows.map(function (r) {
        return r.map(function (c) {
          c = String(c == null ? "" : c);
          return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
        }).join(",");
      }).join("\r\n");

      /* BOM حتى يفتح Excel العربية صحيحة */
      TPUI.download("attendance-sec" + section.id + "-" + Store.dayKey() + ".csv",
                    "﻿" + csv, "text/csv");
      TPUI.toast("نُزّل ملف الحضور — يُفتح في Excel.", "good");
    }).catch(fail);
  });

  function fail(e) {
    console.error(e);
    TPUI.toast(e && e.message ? e.message : "حدث خطأ.", "bad");
  }

  loadAll();
})();
