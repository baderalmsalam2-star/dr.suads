/* ═══ صفحة الطالبة: تفاعلها وتسليماتها وملفاتها ═══ */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var SHEETS = window.WORKSHEETS || [];
  var KINDS = ((window.COURSE || {}).engagement || {}).kinds || [];
  var LABEL = {};
  KINDS.forEach(function (k) { LABEL[k.id] = k.label; });

  var id = new URLSearchParams(location.search).get("id");
  TPUI.credit("credit");
  document.getElementById("printBtn").addEventListener("click", function () { window.print(); });

  if (!id) return bail("لم تُحدَّد الطالبة.", "افتحي صفحتها من كشف الطالبات.");

  Store.student(id).then(function (st) {
    if (!st) return bail("لم أجد هذه الطالبة.", "قد تكون حُذفت من الكشف.");

    var sec = TP.sections().filter(function (s) {
      return String(s.id) === String(st.sectionId);
    })[0] || { name: "" };

    TPUI.chrome("students", st.name, sec.name + " · رقم " + ar(st.no));
    document.getElementById("who").textContent = sec.name + " · رقم الكشف " + ar(st.no) +
      (st.uid ? " · الرقم الجامعي " + ar(st.uid) : "");
    document.getElementById("sheetsLink").href =
      "worksheets.html?section=" + encodeURIComponent(st.sectionId);

    return Promise.all([
      Store.events({ studentId: st.id }),
      Store.submissions({ studentId: st.id }),
      Store.ranking({ sectionId: st.sectionId }),
      Store.ranking({ sectionId: st.sectionId, month: Store.monthKey(Store.dayKey()) }),
      Store.attendance({ studentId: st.id }),
      Store.attendance({ sectionId: st.sectionId }),
      Store.gradebook(st.sectionId)
    ]).then(function (r) {
      paint(st, r[0], r[1], r[2], r[3]);
      paintAttendance(st, r[4], r[5]);
      paintGrades(st, r[6]);
    });
  }).catch(function (e) {
    console.error(e);
    bail("تعذّر تحميل الصفحة.", e.message || "");
  });

  /* ─── درجاتها هي ───
     الأعمدة نفسها التي تراها الدكتورة، بلا ترتيب ولا مقارنة بغيرها:
     الطالبة ترى بندها ودرجتها والمجموع، لا صفوف زميلاتها. */
  function paintGrades(st, gb) {
    var t = document.getElementById("grades");
    var row = gb.rows.filter(function (r) { return r.student.id === st.id; })[0];
    if (!row) {
      t.hidden = true;
      TPUI.empty(document.getElementById("grEmpty"), "لا درجات بعد.", "");
      return;
    }
    t.hidden = false;
    t.textContent = "";

    document.getElementById("grSub").textContent =
      (gb.scheme.confirmed ? "" : "توزيعة مبدئية · ") +
      "المجموع حتى الآن " + fmt(row.total) + " من " + ar(row.outOf) +
      (row.complete ? "" : " (لم تكتمل)");

    var head = el("tr");
    ["البند", "الدرجة", "من", "الأساس"].forEach(function (h) {
      head.appendChild(el("th", "", h));
    });
    t.appendChild(el("thead")).appendChild(head);

    var tb = el("tbody");
    gb.scheme.items.forEach(function (it) {
      var c = row.cells[it.id];
      /* التعويضي لا يُعرض لمن لم تحتجه */
      if (it.makeupFor && c.score == null && !c.note) return;
      var tr = el("tr");
      tr.appendChild(el("td", "", it.label));
      tr.appendChild(el("td", "sum", c.score == null ? "لم تُرصد" : fmt(c.score)));
      tr.appendChild(el("td", "num", it.makeupFor ? "تعويضي" :
        ar(it.max) + (it.bonus ? " + " + ar(it.bonus) : "")));
      tr.appendChild(el("td", "auto", c.note || (c.auto ? "" : "من الاختبار")));
      tb.appendChild(tr);
    });

    var sum = el("tr");
    sum.appendChild(el("th", "", "المجموع"));
    sum.appendChild(el("td", "sum", fmt(row.total)));
    sum.appendChild(el("td", "num", ar(row.outOf)));
    sum.appendChild(el("td", "gr", row.grade));
    tb.appendChild(sum);
    t.appendChild(tb);

    function fmt(v) {
      var r = Math.round(v * 10) / 10;
      return ar(r % 1 === 0 ? String(r) : r.toFixed(1));
    }
  }

  function paint(st, events, subs, termRank, monthRank) {
    var mine = termRank.filter(function (x) { return x.student.id === st.id; })[0] ||
               { points: 0, total: 0 };
    var place = termRank.filter(function (x) { return x.points > 0; })
                        .findIndex(function (x) { return x.student.id === st.id; });
    var monthMine = monthRank.filter(function (x) { return x.student.id === st.id; })[0] ||
                    { points: 0 };
    var submitted = subs.filter(function (s) { return s.status === "submitted"; });

    /* ─── الأرقام ─── */
    var stats = document.getElementById("stats");
    [
      ["نقاط التفاعل — الفصل", ar(mine.points), ""],
      ["نقاط هذا الشهر", ar(monthMine.points), "blue"],
      ["الترتيب في الشعبة", place >= 0 ? ar(place + 1) : "—", "blue"],
      ["أوراق سُلِّمت", ar(submitted.length) + " من " + ar(SHEETS.length), ""]
    ].forEach(function (row) {
      var box = el("div", "stat");
      box.appendChild(el("div", "k", row[0]));
      box.appendChild(el("div", "v" + (row[2] ? " " + row[2] : ""), row[1]));
      stats.appendChild(box);
    });

    /* ─── أوراق العمل ─── */
    var ul = document.getElementById("sheets");
    SHEETS.forEach(function (w) {
      var sub = subs.filter(function (s) { return s.worksheetId === w.id; })[0];
      var done = sub && sub.status === "submitted";

      var li = el("li", "card ready" + (done ? " done" : ""));
      li.appendChild(el("span", "badge", done ? "سُلِّمت" : (sub ? "مسودة" : "لم تبدأ")));

      var a = el("a", "open");
      a.href = "worksheet.html?w=" + encodeURIComponent(w.id) +
               "&section=" + encodeURIComponent(st.sectionId) +
               "&student=" + encodeURIComponent(st.id);
      a.appendChild(el("span", "no", "المحاضرة " + ar(w.session) + " · " +
                        (w.type === "homework" ? "واجب" : "ورقة عمل")));
      a.appendChild(el("h2", "", w.title));

      var meta = el("div", "meta");
      meta.appendChild(el("span", "", done
        ? TPUI.arDate((sub.submittedAt || "").slice(0, 10))
        : TPUI.questions(w.items.length)));
      meta.appendChild(el("span", "readers", done ? "بلا درجات" : "افتحيها للحل"));
      a.appendChild(meta);
      li.appendChild(a);
      ul.appendChild(li);
    });

    /* ─── سجل التفاعل ─── */
    var table = document.getElementById("events");
    var evEmpty = document.getElementById("evEmpty");
    document.getElementById("evSub").textContent =
      TPUI.shares(events.length) + " · " + TPUI.points(mine.points);

    if (!events.length) {
      table.hidden = true;
      evEmpty.appendChild(TPUI.empty("لا يوجد تفاعل مرصود بعد.",
        "يُرصد أثناء المحاضرة من لوحة الرصد (مفتاح م داخل العرض)."));
    } else {
      var head = el("thead"), hr = el("tr");
      ["اليوم", "المحاضرة", "النوع", "النقاط", ""].forEach(function (h) { hr.appendChild(el("th", "", h)); });
      head.appendChild(hr);
      table.appendChild(head);

      var body = el("tbody");
      events.slice().sort(function (a, b) { return (b.at || 0) - (a.at || 0); })
        .forEach(function (e) {
          var tr = el("tr");
          tr.appendChild(el("td", "", TPUI.arDate(e.day)));
          tr.appendChild(el("td", "num", e.session ? ar(e.session) : "—"));
          tr.appendChild(el("td", "", LABEL[e.kind] || e.kind));
          tr.appendChild(el("td", "num", ar(e.points != null ? e.points : 0)));

          var act = el("td", "num");
          var del = el("button", "sm ghost", "حذف");
          del.addEventListener("click", function () {
            if (!confirm("حذف هذا الرصد؟")) return;
            Store.removeEvent(e.id).then(function () { location.reload(); });
          });
          act.appendChild(del);
          tr.appendChild(act);
          body.appendChild(tr);
        });
      table.appendChild(body);
    }

    /* ─── الملفات المرفوعة ─── */
    var uploads = document.getElementById("uploads");
    var upEmpty = document.getElementById("upEmpty");
    var refs = [];
    subs.forEach(function (s) {
      Object.keys(s.files || {}).forEach(function (itemId) {
        (s.files[itemId] || []).forEach(function (f) {
          refs.push({ f: f, worksheetId: s.worksheetId });
        });
      });
    });

    if (!refs.length) {
      upEmpty.appendChild(TPUI.empty("لا توجد ملفات مرفوعة.",
        "تُرفع من داخل أسئلة «رفع ملف» في أوراق العمل."));
      return;
    }
    refs.forEach(function (r) {
      var li = el("li");
      li.appendChild(el("span", "nm", r.f.name));
      li.appendChild(el("span", "sz", TPUI.bytes(r.f.size)));

      var open = el("button", "sm ghost", "فتح");
      open.addEventListener("click", function () {
        Store.getFile(r.f.fileId).then(function (rec) {
          if (!rec) return TPUI.toast("الملف غير موجود على هذا الجهاز.", "bad");
          openFile(rec);
        }).catch(function () { TPUI.toast("تعذّر فتح الملف.", "bad"); });
      });
      li.appendChild(open);
      uploads.appendChild(li);
    });
  }

  /* ─── فتح ملف مرفوع ───
     اسم الملف ونوعه يأتيان من الطالبة: الاسم من worksheet.js عند
     الرفع، وعلى الخادم من عمود submissions.files الذي تكتبه هي.
     فبناء النافذة بسلسلة نصية كان حقنًا مباشرًا: نافذة window.open()
     بلا عنوان ترث أصل المنصة، فسكربتٌ في اسم الملف يقرأ رمز جلسة
     الدكتورة من localStorage. تُبنى هنا بـ DOM، فلا يُفسَّر شيء.

     والملف نفسه لا يُعرض في مستندٍ يرث الأصل: الصورة تُعرض في وسم
     img وهو لا ينفّذ، وما عداها يُنزَّل ولا يُفتح — فملف HTML
     مرفوعٌ باسم .pdf كان سينفَّذ داخل الأصل لو فُتح في إطار. */
  var SAFE_VIEW = /^image\/(png|jpe?g|gif|webp|bmp|avif)$/i;

  function openFile(rec) {
    if (!SAFE_VIEW.test(rec.type || "")) {
      TPUI.download(TPUI.safeName(rec.name || "file"), null, null, rec.data);
      TPUI.toast("نُزِّل الملف — يُفتح بالبرنامج المناسب له.", "good");
      return;
    }
    var w = window.open();
    if (!w) return TPUI.toast("المتصفح منع فتح نافذة جديدة.", "bad");
    var d = w.document;
    d.title = rec.name || "ملف";            /* نصّ لا يُفسَّر */
    d.documentElement.setAttribute("dir", "rtl");
    d.body.style.margin = "0";
    d.body.style.background = "#111";
    var img = d.createElement("img");
    img.setAttribute("src", rec.data);
    img.setAttribute("alt", rec.name || "");
    img.style.cssText = "max-width:100%;display:block;margin:auto";
    d.body.appendChild(img);
  }

  /* ─── حضور الطالبة ─── */
  function paintAttendance(st, mine, sectionAll) {
    var POLICY = (window.COURSE || {}).attendance || {};
    var STATES = POLICY.states || [];
    var table = document.getElementById("attTable");
    var empty = document.getElementById("attEmpty");

    var held = {};
    sectionAll.forEach(function (a) { held[a.session] = true; });
    var total = Object.keys(held).length;

    if (!total) {
      table.hidden = true;
      empty.appendChild(TPUI.empty("لم يُرصد حضور بعد.",
        "يُرصد من صفحة «الحضور»."));
      return;
    }

    var c = {};
    mine.forEach(function (a) { c[a.status] = (c[a.status] || 0) + 1; });
    var excused = c.excused || 0, absent = c.absent || 0;
    var counted = total - excused;
    var pct = counted > 0 ? absent / counted : 0;

    document.getElementById("attSub").textContent =
      "غياب " + ar(Math.round(pct * 100)) + "٪ من " + TPUI.lessons(total) + " رُصدت";

    var head = el("thead"), hr = el("tr");
    STATES.forEach(function (s) { hr.appendChild(el("th", "", s.label)); });
    hr.appendChild(el("th", "", "نسبة الغياب"));
    head.appendChild(hr); table.appendChild(head);

    var body = el("tbody"), tr = el("tr");
    STATES.forEach(function (s) { tr.appendChild(el("td", "num", c[s.id] ? ar(c[s.id]) : "—")); });
    tr.appendChild(el("td", "num", ar(Math.round(pct * 100)) + "٪"));
    if (pct >= (POLICY.absentLimit || 1)) tr.className = "deny";
    body.appendChild(tr);
    table.appendChild(body);

    if (pct >= (POLICY.absentLimit || 1)) {
      empty.appendChild(el("div", "note-box", "تجاوزت حد الغياب المقرَّر (" +
        ar(Math.round((POLICY.absentLimit || 0) * 100)) + "٪)."));
    }
  }

  function bail(msg, hint) {
    TPUI.chrome("students", "صفحة الطالبة");
    document.querySelector(".control").hidden = true;
    document.getElementById("stats").appendChild(TPUI.empty(msg, hint));
  }
})();
