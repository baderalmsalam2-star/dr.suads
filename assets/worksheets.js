/* ═══ قائمة أوراق العمل والواجبات + حالة التسليم ═══ */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var SHEETS = window.WORKSHEETS || [];

  TPUI.chrome("worksheets", "أوراق العمل والواجبات");
  document.getElementById("credit").textContent = (window.COURSE || {}).credit || "";

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
      if (!st && payload.studentName) {
        st = all.filter(function (s) {
          return s.name === payload.studentName &&
                 String(s.sectionId) === String(payload.sectionId);
        })[0];
      }
      if (!st) return { ok: false };

      var sub = Object.assign({}, payload.submission, {
        studentId: st.id, status: "submitted"
      });
      return Store.submissions({ studentId: st.id, worksheetId: sub.worksheetId })
        .then(function (existing) {
          if (existing.length) sub.id = existing[0].id;   /* يُحدَّث لا يُكرَّر */
          return Store.saveSubmission(sub);
        })
        .then(function () { return creditSubmission(st, sub); })
        .then(function () { return { ok: true }; });
    });
  }

  /* تسليم ورقة يُرصد نقطة تفاعل مرة واحدة لكل ورقة */
  function creditSubmission(student, sub) {
    return Store.events({ studentId: student.id }).then(function (evs) {
      var already = evs.some(function (e) {
        return e.kind === "submit" && e.ref === sub.worksheetId;
      });
      if (already) return;
      var kind = (((window.COURSE || {}).engagement || {}).kinds || [])
        .filter(function (k) { return k.id === "submit"; })[0];
      return Store.addEvent({
        studentId: student.id, sectionId: student.sectionId,
        kind: "submit", points: kind ? kind.points : 3,
        ref: sub.worksheetId, day: (sub.submittedAt || "").slice(0, 10) || Store.dayKey()
      });
    });
  }

  /* ─── العرض ─── */
  function render() {
    document.getElementById("sub").textContent = section.name;

    Promise.all([Store.students(section.id), Store.submissions({})]).then(function (r) {
      var students = r[0].slice().sort(function (a, b) { return (a.no || 0) - (b.no || 0); });
      var subs = r[1];
      var ids = {};
      students.forEach(function (s) { ids[s.id] = true; });
      var mine = subs.filter(function (s) { return ids[s.studentId]; });

      cards("sheets", SHEETS.filter(function (w) { return w.type !== "homework"; }), mine, students.length);
      cards("homework", SHEETS.filter(function (w) { return w.type === "homework"; }), mine, students.length);
      matrix(students, mine);
    }).catch(fail);
  }

  function cards(containerId, list, subs, total) {
    var ul = document.getElementById(containerId);
    ul.textContent = "";
    if (!list.length) {
      ul.appendChild(el("li", "", "")).appendChild(
        TPUI.empty("لا شيء هنا بعد.", "تُعرَّف الأوراق في data/worksheets.js"));
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
      a.appendChild(el("span", "no", "الحصة " + ar(w.session) + " · " +
                        (w.type === "homework" ? "واجب" : "ورقة عمل")));
      a.appendChild(el("h2", "", w.title));
      if (w.subtitle) a.appendChild(el("div", "sub", w.subtitle));

      var meta = el("div", "meta");
      meta.appendChild(el("span", "", w.pages || ""));
      meta.appendChild(el("span", "readers", TPUI.questions(w.items.length) + " · بلا درجات"));
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
