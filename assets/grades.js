/* ═══ الدرجات — كشف الشعبة ورصد الاختبارات وتصديرها ═══ */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var el = TPUI.el, ar = TP.ar;
  var section, scheme = null, book = null, dirty = false;

  TPUI.chrome("grades", "الدرجات");
  TPUI.credit("credit");
  document.getElementById("foot-note").textContent =
    "كل بند قابل للتعديل: اكتبي رقمًا فيعلو على الحساب، وأفرغي الخانة فيرجع إلى الحساب.";

  section = TPUI.sectionPicker(document.getElementById("section"), function (s) {
    section = s; load();
  });

  /* رقم للعرض: منزلة واحدة بلا أصفار زائدة، بأرقام عربية */
  function n1(v) {
    if (v == null) return "—";
    var r = Math.round(v * 10) / 10;
    return ar(r % 1 === 0 ? String(r) : r.toFixed(1));
  }

  /* ─── تحميل ─── */
  function load() {
    Store.gradebook(section.id).then(function (gb) {
      book = gb;
      /* تعديلٌ لم يُحفظ في محرّر التوزيعة لا يُمحى بإعادة التحميل:
         كانت الدكتورة تغيّر وزن بندٍ ثم ترصد درجة، فتُستدعى load
         فيرجع المحرّر إلى المخزَّن ويذهب تعديلها بلا سؤال. */
      if (!dirty) { scheme = gb.scheme; renderScheme(); }
      renderBanner();
      renderBasis(gb);
      renderBook();
      renderDist();
    }).catch(fail);
  }

  function fail(e) { TPUI.toast(e.message || "تعذّر تحميل الدرجات.", "bad"); }

  function renderBanner() {
    document.getElementById("draftBanner").hidden = !!scheme.confirmed;
  }

  function renderBasis(gb) {
    var src = scheme.source ? scheme.source + " · " : "";
    document.getElementById("basis").textContent =
      src + "انعقدت " + TPUI.lessons(gb.held) +
      " · صدرت " + TPUI.sheets(gb.sheets);
  }

  /* ─── الكشف ─── */
  var colInputs = {};

  function renderBook() {
    var t = document.getElementById("book");
    t.textContent = "";
    colInputs = {};                    /* تُبنى مع الجدول وتموت معه */
    if (!book.rows.length) {
      t.hidden = true;
      TPUI.empty(document.getElementById("bookEmpty"),
        "لا طالبات في هذه الشعبة بعد.", "أضيفيهن من صفحة «الطالبات».");
      return;
    }
    t.hidden = false;
    document.getElementById("bookEmpty").textContent = "";

    var thead = el("thead"), hr = el("tr");
    hr.appendChild(el("th", "num", "#"));
    hr.appendChild(el("th", "nm", "الطالبة"));
    scheme.items.forEach(function (it) {
      var th = el("th");
      th.appendChild(document.createTextNode(it.label));
      var mx = el("span", "mx", it.makeupFor
        ? "تعويضي"
        : "من " + ar(it.max) + (it.bonus ? " + " + ar(it.bonus) + " بونص" : ""));
      th.appendChild(mx);
      if (it.date) th.title = TPUI.arDate(it.date);
      if (it.hint) th.title = (th.title ? th.title + " — " : "") + it.hint;
      hr.appendChild(th);
    });
    hr.appendChild(el("th", "", "المجموع"));
    hr.appendChild(el("th", "", "التقدير"));
    thead.appendChild(hr); t.appendChild(thead);

    var tb = el("tbody");
    book.rows.forEach(function (row, i) {
      var tr = el("tr");
      tr.dataset.student = row.student.id;
      if (!row.complete) tr.className = "incomplete";
      tr.appendChild(el("td", "num", ar(row.student.no || i + 1)));

      var nm = el("td", "nm");
      var a = el("a", "", row.student.name);
      a.href = "student.html?id=" + encodeURIComponent(row.student.id);
      nm.appendChild(a);
      if (row.att.barred || row.att.warn) {
        var w = el("span", "warn-dot", row.att.barred ? " ⛔" : " ⚠");
        w.title = "غياب " + ar(row.att.missed) + " من " + ar(row.att.counted) +
                  " حصة" + (row.att.barred ? " — تجاوزت حدّ الحرمان" : "");
        nm.appendChild(w);
      }
      tr.appendChild(nm);

      scheme.items.forEach(function (it) {
        var c = row.cells[it.id];
        /* كل بند قابل للتعديل — المحسوب منه والمُدخَل */
        var td = manCell(row, it, c);
        td.dataset.item = it.id;
        tr.appendChild(td);
      });

      var sum = el("td", "sum", n1(row.total) + " / " + ar(row.outOf));
      sum.dataset.role = "sum";
      if (row.pct > 100) sum.title = "تجاوز ١٠٠ بالبونص — يُسقَف عند التقدير";
      tr.appendChild(sum);
      var gr = el("td", "gr", row.grade);
      gr.dataset.role = "grade";
      tr.appendChild(gr);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
  }


  /* ─── تحديث المشتقّات بلا هدم ───
       كان الحفظ يعيد بناء الجدول كلّه، فيُزال العنصر المركَّز مع
       الجدول. وإزالة عنصرٍ مركَّز لا تُطلق change، فالرقم الذي كانت
       الدكتورة تكتبه في الخانة التالية يضيع صامتًا بلا رسالة.
       فتُحدَّث هنا المجاميع والتقديرات والخانات المحسوبة غير
       المركَّزة، وتبقى كل خانة إدخال في مكانها. */
  function refresh() {
    Store.gradebook(section.id).then(function (gb) {
      book = gb;
      var t = document.getElementById("book");

      gb.rows.forEach(function (row) {
        var tr = t.querySelector('tr[data-student="' + row.student.id + '"]');
        if (!tr) return;
        tr.classList.toggle("incomplete", !row.complete);

        gb.scheme.items.forEach(function (it) {
          var td = tr.querySelector('td[data-item="' + it.id + '"]');
          if (!td) return;
          var inp = td.querySelector("input");
          if (inp && document.activeElement === inp) return;   /* لا تُمسّ */
          var c = row.cells[it.id];
          if (inp) {
            inp.value = c.score == null ? "" : Math.round(c.score * 100) / 100;
            inp.className = c.overridden ? "filled over" : (c.auto ? "calc" : (c.score != null ? "filled" : ""));
            td.classList.toggle("over", !!c.overridden);
            td.classList.toggle("calc", !!c.auto && !c.overridden);
            var note = td.querySelector(".note");
            if (note) note.textContent = c.note || "";
          }
        });

        var sum = tr.querySelector('td[data-role="sum"]');
        if (sum) sum.textContent = n1(row.total) + " / " + ar(row.outOf);
        var gr = tr.querySelector('td[data-role="grade"]');
        if (gr) gr.textContent = row.grade;
      });

      renderDist();
    }).catch(fail);
  }

  function manCell(row, it, c) {
    var td = el("td", "man");
    var inp = document.createElement("input");
    inp.type = "number"; inp.min = "0"; inp.step = "0.5";
    inp.max = String((+it.cap || +it.max || 0) + (+it.bonus || 0));
    inp.setAttribute("aria-label", row.student.name + " — " + it.label);

    inp.value = c.score == null ? "" : Math.round(c.score * 100) / 100;
    if (c.overridden) { td.classList.add("over"); inp.className = "filled over"; }
    else if (c.auto) { td.classList.add("calc"); inp.className = "calc"; }
    else if (c.score != null) inp.className = "filled";

    inp.addEventListener("change", function () {
      var v = inp.value === "" ? null : +inp.value;
      if (v != null && (isNaN(v) || v < 0 || v > +inp.max)) {
        TPUI.toast("الدرجة بين صفر و" + ar(inp.max) + ".", "bad");
        inp.value = c.score == null ? "" : c.score;
        return;
      }
      /* إفراغ خانةٍ محسوبة يعني الرجوع إلى الحساب لا التصفير */
      Store.saveGrade({ studentId: row.student.id, sectionId: section.id,
                        itemId: it.id, score: v })
        .then(function () {
          if (v == null && c.auto) TPUI.toast("رجع البند إلى الحساب التلقائي.", "good");
          refresh();
        })
        .catch(fail);
    });
    /* Enter ينتقل للخانة التالية في العمود نفسه.
       كان البحث بمحدِّد يُدمج فيه اسم البند — واسمٌ تكتبه الدكتورة
       فيه علامة تنصيص يُنتج محدِّدًا غير صالح فترمي querySelectorAll
       ويتوقّف التنقل في الكشف كلّه. المراجع تُجمَع عند البناء. */
    (colInputs[it.id] = colInputs[it.id] || []).push(inp);
    inp.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault(); inp.blur();
      var all = colInputs[it.id] || [];
      var k = all.indexOf(inp);
      if (k >= 0 && all[k + 1]) all[k + 1].focus();
    });
    if (c.note) inp.title = c.note;
    if (c.effective != null) { td.classList.add("over"); inp.className = "filled"; }
    td.appendChild(inp);
    if (c.note && (c.auto || c.overridden || c.effective != null)) {
      td.appendChild(el("span", "note", c.note));
    }
    return td;
  }

  /* ─── توزيع التقديرات ─── */
  function renderDist() {
    var box = document.getElementById("dist");
    box.textContent = "";
    var order = ((COURSE.grading || {}).grades || []).map(function (g) { return g.label; });
    order.push("محرومة");
    var tally = {};
    book.rows.forEach(function (r) { tally[r.grade] = (tally[r.grade] || 0) + 1; });

    var graded = book.rows.filter(function (r) { return r.complete; }).length;
    /* «طالبتان» مرفوع لا يصلح بعد «من»، فيُتجنّب التمييز هنا أصلًا */
    document.getElementById("distSub").textContent =
      "اكتملت درجات " + ar(graded) + " من " + ar(book.rows.length);

    order.forEach(function (lbl) {
      var n = tally[lbl] || 0;
      var b = el("div", "b" + (n ? "" : " none"));
      b.appendChild(el("span", "g", lbl));
      b.appendChild(el("span", "n", ar(n)));
      box.appendChild(b);
    });
  }

  /* ─── محرّر التوزيعة ─── */
  var SOURCES = [
    { id: "manual",     label: "تُرصد باليد" },
    { id: "engagement", label: "من نقاط التفاعل" },
    { id: "worksheets", label: "من تسليم أوراق العمل" }
  ];

  document.getElementById("schemeBtn").addEventListener("click", function () {
    var box = document.getElementById("schemeBox");
    box.hidden = !box.hidden;
    if (!box.hidden) renderScheme();
  });

  function renderScheme() {
    var t = document.getElementById("schemeTable");
    t.textContent = "";
    var head = el("tr");
    ["البند", "الدرجة", "بونص", "المصدر", ""].forEach(function (h) {
      head.appendChild(el("th", "", h));
    });
    t.appendChild(el("thead")).appendChild(head);

    var tb = el("tbody");
    scheme.items.forEach(function (it, i) {
      var tr = el("tr");

      tr.appendChild(td(text(it.label, function (v) { it.label = v; })));
      tr.appendChild(td(num(it.makeupFor ? (it.cap || 0) : it.max, function (v) {
        if (it.makeupFor) it.cap = v; else it.max = v;
        sum();
      })));
      tr.appendChild(td(num(it.bonus || 0, function (v) { it.bonus = v; })));

      var sel = document.createElement("select");
      SOURCES.forEach(function (s) {
        var o = document.createElement("option");
        o.value = s.id; o.textContent = s.label;
        if (s.id === it.source) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () { it.source = sel.value; dirty = true; });
      tr.appendChild(td(sel));

      var del = el("button", "danger sm", "احذفي");
      del.type = "button";
      del.addEventListener("click", function () {
        scheme.items.splice(i, 1); dirty = true; renderScheme();
      });
      var c = el("td"); c.appendChild(del);
      if (it.makeupFor) {
        c.textContent = "";
        c.appendChild(el("span", "hint", "تعويضي"));
      }
      tr.appendChild(c);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    sum();

    function td(node) { var x = el("td"); x.appendChild(node); return x; }
    function text(v, on) {
      var i = document.createElement("input");
      i.type = "text"; i.value = v || "";
      i.addEventListener("change", function () { on(i.value); dirty = true; });
      return i;
    }
    function num(v, on) {
      var i = document.createElement("input");
      i.type = "number"; i.min = "0"; i.step = "1"; i.value = v == null ? "" : v;
      i.addEventListener("change", function () { on(+i.value || 0); dirty = true; });
      return i;
    }
  }

  function sum() {
    var s = scheme.items.reduce(function (a, it) {
      return a + (it.makeupFor ? 0 : (+it.max || 0));
    }, 0);
    var lbl = document.getElementById("schemeSum");
    lbl.textContent = "المجموع: " + ar(s) + " من ١٠٠" +
      (s === 100 ? " ✓" : " — لا بد أن يبلغ ١٠٠");
    lbl.className = "hint " + (s === 100 ? "good" : "bad");
    return s;
  }

  document.getElementById("addItem").addEventListener("click", function () {
    scheme.items.push({ id: "it-" + Date.now().toString(36),
                        label: "بند جديد", max: 0, source: "manual" });
    dirty = true; renderScheme();
  });

  document.getElementById("resetScheme").addEventListener("click", function () {
    if (!confirm("الرجوع إلى التوزيعة الافتراضية؟ التعديلات تُفقد.")) return;
    var g = COURSE.grading || {};
    scheme = JSON.parse(JSON.stringify({ confirmed: !!g.confirmed,
      source: g.source, items: g.items || [], grades: g.grades || [] }));
    dirty = true; renderScheme(); renderBanner();
  });

  document.getElementById("saveScheme").addEventListener("click", function () {
    if (sum() !== 100) return TPUI.toast("المجموع لا بد أن يبلغ ١٠٠.", "bad");
    Store.setScheme(section.id, scheme).then(function () {
      dirty = false;
      TPUI.toast("حُفظت التوزيعة.", "good");
      load();
    }).catch(fail);
  });

  document.getElementById("confirmScheme").addEventListener("click", function () {
    if (sum() !== 100) return TPUI.toast("المجموع لا بد أن يبلغ ١٠٠.", "bad");
    scheme.confirmed = true;
    Store.setScheme(section.id, scheme).then(function () {
      dirty = false;
      TPUI.toast("اعتُمدت التوزيعة.", "good");
      load();
    }).catch(fail);
  });

  /* ─── التصدير ───
     CSV بعلامة ترتيب البايتات، فيفتحه Excel بالعربية سليمةً بلا إعداد. */
  document.getElementById("exportBtn").addEventListener("click", function () {
    if (!book || !book.rows.length) return TPUI.toast("لا درجات للتصدير.", "bad");
    var head = ["م", "الاسم", "الرقم الجامعي"];
    scheme.items.forEach(function (it) {
      head.push(it.label + " (" +
        (it.makeupFor ? "تعويضي/" + (it.cap || 0)
                      : it.max + (it.bonus ? "+" + it.bonus : "")) + ")");
    });
    head.push("المجموع", "من", "النسبة %", "التقدير", "مكتملة", "الغياب");

    var lines = [head];
    book.rows.forEach(function (r, i) {
      var line = [r.student.no || (i + 1), r.student.name, r.student.uid || ""];
      scheme.items.forEach(function (it) {
        var c = r.cells[it.id];
        var v = c.effective != null ? c.effective : c.score;
        line.push(v == null ? "" : Math.round(v * 100) / 100);
      });
      line.push(Math.round(r.total * 100) / 100, r.outOf,
                Math.round(r.pct * 10) / 10, r.grade,
                r.complete ? "نعم" : "لا",
                r.att.counted ? r.att.missed + "/" + r.att.counted : "");
      lines.push(line);
    });

    TPUI.download("darajat-sec" + section.id + "-" + Store.dayKey() + ".csv",
                  TPUI.csv(lines), "text/csv");
    TPUI.toast("نُزِّل الملف — افتحيه بـ Excel.", "good");
  });

  document.getElementById("printBtn").addEventListener("click", function () {
    window.print();
  });

  window.addEventListener("beforeunload", function (e) {
    if (!dirty) return;
    e.preventDefault(); e.returnValue = "";
  });

  /* sectionPicker يعيد الشعبة ولا ينادي onChange، فالتحميل الأول من هنا */
  load();
})();
