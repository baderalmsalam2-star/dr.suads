/* ═══ لوحة رصد التفاعل — تُحقن في عرض المحاضرة ═══
   تُفتح بمفتاح «م» أثناء الشرح: شبكة بأسماء طالبات الشعبة،
   ضغطة على الاسم ثم على نوع التفاعل تسجّل نقطة فورًا.
   القارئة المسنَدة للشريحة الحالية تُبرَز تلقائيًا. */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var KINDS = (COURSE.engagement || {}).kinds || [];
  var ar = TP.ar;

  var params = new URLSearchParams(location.search);
  var section = TP.resolveSection(params);
  var sessionNo = +(document.body.dataset.session || 0);

  var students = [], points = {}, picked = null, open = false;
  var panel, grid, kindBar, title;

  /*  أدواتُ الشرح لا تُبنى إلا للدكتورة.
      كانت تُبنى لكل من فتح المحاضرة، فترى الطالبةُ زرًّا عائمًا
      ولوحةً تُغريها بما يردّه الخادم، ويعمل عندها مفتاحُها في لوحة
      المفاتيح. والحارسُ في الخادم قائمٌ — لكن بابًا يُفتح ثم يُقال
      «لا صلاحية» أسوأُ من بابٍ لا يُعرض. */
  if (!window.TPRole) return;
  TPRole.staff().then(function (ok) { if (!ok) return; build(); load(); });

  /* ─── البناء ─── */
  function build() {
    panel = document.createElement("aside");
    panel.className = "rec";
    panel.setAttribute("aria-label", "رصد التفاعل");
    panel.hidden = true;

    var head = document.createElement("div");
    head.className = "rec-head";
    title = document.createElement("div");
    title.className = "rec-title";
    head.appendChild(title);

    var close = document.createElement("button");
    close.type = "button";
    close.className = "rec-x";
    close.textContent = "إغلاق";
    close.addEventListener("click", toggle);
    head.appendChild(close);
    panel.appendChild(head);

    grid = document.createElement("div");
    grid.className = "rec-grid";
    panel.appendChild(grid);

    kindBar = document.createElement("div");
    kindBar.className = "rec-kinds";
    panel.appendChild(kindBar);

    var foot = document.createElement("div");
    foot.className = "rec-foot";
    foot.textContent = "م: فتح وإغلاق · النقاط تُحتسب في لوحة الشرف";
    panel.appendChild(foot);

    document.body.appendChild(panel);

    /* زر عائم للأجهزة التي بلا لوحة مفاتيح */
    var fab = document.createElement("button");
    fab.type = "button";
    fab.className = "rec-fab";
    fab.textContent = "رصد";
    fab.setAttribute("aria-label", "لوحة رصد التفاعل");
    fab.addEventListener("click", toggle);
    document.body.appendChild(fab);

    addEventListener("keydown", function (e) {
      var t = e.target;
      /*  ولا يُلتقط حرفٌ يُكتب: «تحرير النصّ» يجعل الشريحة نفسها
          قابلةً للكتابة، وهي ليست INPUT ولا TEXTAREA. فكانت الدكتورة
          تصحّح «من» أو «الحكم» فلا يُكتب الحرف، ويُفتح شريطٌ فوق
          الشريحة والبروجكتر يعرضها. */
      if (t && t.closest && t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "م" || e.key === "m" || e.key === "M") { toggle(); e.preventDefault(); }
      else if (e.key === "Escape" && open) { toggle(); }
    });
  }

  function toggle() {
    open = !open;
    panel.hidden = !open;
    if (open) { picked = null; renderKinds(); load(); }
  }

  /* ─── البيانات ─── */
  function load() {
    var day = Store.dayKey();
    Promise.all([
      Store.students(section.id),
      Store.events({ sectionId: section.id, day: day })
    ]).then(function (r) {
      students = r[0].slice().sort(function (a, b) { return (a.no || 0) - (b.no || 0); });
      var pts = {};
      KINDS.forEach(function (k) { pts[k.id] = k.points; });
      points = {};
      r[1].forEach(function (e) {
        points[e.studentId] = (points[e.studentId] || 0) +
          (e.points != null ? e.points : (pts[e.kind] || 0));
      });
      renderGrid();
      title.textContent = "رصد التفاعل · " + section.name + " · " + TPUI.students(students.length);
    }).catch(function (e) { console.error(e); });
  }

  function renderGrid() {
    grid.textContent = "";
    if (!students.length) {
      var p = document.createElement("p");
      p.className = "rec-empty";
      p.textContent = "لا يوجد كشف لهذه الشعبة — أضيفيه من صفحة «الطالبات».";
      grid.appendChild(p);
      return;
    }
    students.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "rec-chip" + (picked === s.id ? " picked" : "");
      b.dataset.id = s.id;

      var no = document.createElement("span");
      no.className = "n";
      no.textContent = ar(s.no);
      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = s.name;
      b.appendChild(no);
      b.appendChild(nm);

      if (points[s.id]) {
        var pt = document.createElement("span");
        pt.className = "pt";
        pt.textContent = ar(points[s.id]);
        b.appendChild(pt);
      }
      b.addEventListener("click", function () {
        picked = (picked === s.id) ? null : s.id;
        renderGrid(); renderKinds();
      });
      grid.appendChild(b);
    });
    highlightReader();
  }

  function renderKinds() {
    kindBar.textContent = "";
    if (!picked) {
      var hint = document.createElement("span");
      hint.className = "rec-hint";
      hint.textContent = "اختاري طالبة، ثم نوع التفاعل.";
      kindBar.appendChild(hint);
      return;
    }
    var who = students.filter(function (s) { return s.id === picked; })[0];
    var lbl = document.createElement("span");
    lbl.className = "rec-who";
    lbl.textContent = who ? who.name : "";
    kindBar.appendChild(lbl);

    KINDS.forEach(function (k) {
      if (k.id === "submit") return;          /* يُسجَّل تلقائيًا عند التسليم */
      var b = document.createElement("button");
      b.type = "button";
      b.className = "rec-kind";
      b.textContent = k.label + " +" + ar(k.points);
      b.addEventListener("click", function () { record(picked, k); });
      kindBar.appendChild(b);
    });

    var undo = document.createElement("button");
    undo.type = "button";
    undo.className = "rec-kind undo";
    undo.textContent = "تراجع";
    undo.addEventListener("click", function () { undoLast(picked); });
    kindBar.appendChild(undo);
  }

  /* ─── زمن الإجابة ───
     متى فُتحت شريحة السؤال الحالية؟ الفرق بينها وبين لحظة الضغط
     هو زمن الإجابة. ولا يُقاس إلا على شرائح الأسئلة (data-q):
     القراءة والمناقشة لا معنى لسرعتهما. */
  var qOpenedAt = null;
  addEventListener("tp:slide", function (e) {
    var sl = e.detail && e.detail.slide;
    qOpenedAt = (sl && sl.hasAttribute("data-q")) ? Date.now() : null;
  });

  function answerSecs() {
    if (qOpenedAt == null) return null;
    var s = (Date.now() - qOpenedAt) / 1000;
    /* أكثر من خمس دقائق ليس سرعةَ إجابة — تُركت الشريحة مفتوحة */
    return s > 300 ? null : Math.round(s * 10) / 10;
  }

  function record(studentId, kind) {
    var secs = answerSecs();
    Store.addEvent({
      studentId: studentId, sectionId: section.id, session: sessionNo,
      kind: kind.id, points: kind.points,
      secs: secs
    }).then(function () {
      flash(kind.label + " +" + ar(kind.points) +
            (secs != null ? " · " + ar(secs) + "ث" : ""));
      picked = null;
      load();
      renderKinds();
    }).catch(function (e) { flash(e.message || "تعذّر الحفظ", true); });
  }

  function undoLast(studentId) {
    Store.events({ studentId: studentId, day: Store.dayKey() }).then(function (list) {
      if (!list.length) return flash("لا يوجد ما يُتراجع عنه", true);
      var last = list.sort(function (a, b) { return b.at - a.at; })[0];
      return Store.removeEvent(last.id).then(function () {
        flash("أُلغي آخر رصد");
        picked = null; load(); renderKinds();
      });
    }).catch(function (e) { flash(e.message || "خطأ", true); });
  }

  /* إبراز القارئة المسنَدة للشريحة الحالية */
  function highlightReader() {
    var on = document.querySelector(".slide.on");
    if (!on || !on.hasAttribute("data-reader")) return;
    var no = on.dataset.readerNo;
    if (!no) return;
    var s = students.filter(function (x) { return String(x.no) === String(no); })[0];
    if (!s) return;
    var chip = grid.querySelector('[data-id="' + s.id + '"]');
    if (chip) chip.classList.add("reader");
  }
  addEventListener("tp:slide", function () { if (open) renderGrid(); });

  /* ─── رسالة خاطفة ─── */
  var flashEl = null, flashTimer = null;
  function flash(msg, bad) {
    if (!flashEl) {
      flashEl = document.createElement("div");
      flashEl.className = "rec-flash";
      document.body.appendChild(flashEl);
    }
    flashEl.textContent = msg;
    flashEl.className = "rec-flash on" + (bad ? " bad" : "");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { flashEl.className = "rec-flash"; }, 1800);
  }
})();
