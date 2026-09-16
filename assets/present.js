/* ═══ لوحة الحضور داخل عرض المحاضرة ═══
   تُفتح بمفتاح «ح» أثناء الشرح، فتُعلَّم الحضور بلا مغادرة العرض.

   طريقة التعليم هي طريقة الواقع: تُعلَّم الشعبة كلها حاضرة بضغطة،
   ثم تُنقر الغائبات. ولذلك «الضغط يعلّم» يبدأ على «غائبة» — فأكثر
   النقرات إنما تقع على الغائبات لا على الحاضرات.

   والمحاضرة المعلَّمة هي المحاضرة المفتوحة (data-session في ملف
   المحاضرة)، لا محاضرة اليوم — فلو فُتحت محاضرةٌ قديمة للمراجعة
   لم يُكتب حضورها على حساب اليوم. */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var STATES = (COURSE.attendance || {}).states || [];
  var ar = TP.ar;

  var params = new URLSearchParams(location.search);
  var section = TP.resolveSection(params);
  var sessionNo = +(document.body.dataset.session || 0);

  var students = [], marks = {}, sched = {}, open = false;
  var brush = "absent";                    /* ما يضعه الضغط */
  var panel, grid, bar, title, foot;

  /* ─── رمز الحضور الدوّار ─── */
  var TTL = 25;                            /* عمر الرمز بالثواني */
  var codeBox = null, codeTimer = null, codeTick = null, codeOn = false;

  if (!sessionNo || !STATES.length) return;

  build();

  /* ─── البناء ─── */
  function build() {
    panel = document.createElement("aside");
    panel.className = "rec att";
    panel.setAttribute("aria-label", "الحضور");
    panel.hidden = true;

    var head = document.createElement("div");
    head.className = "rec-head";
    title = document.createElement("div");
    title.className = "rec-title";
    head.appendChild(title);

    var x = document.createElement("button");
    x.type = "button";
    x.className = "rec-x";
    x.textContent = "إغلاق";
    x.addEventListener("click", toggle);
    head.appendChild(x);
    panel.appendChild(head);

    /* ما يضعه الضغط + التعليم الجملي */
    bar = document.createElement("div");
    bar.className = "att-brush";
    panel.appendChild(bar);

    grid = document.createElement("div");
    grid.className = "rec-grid att-grid";
    panel.appendChild(grid);

    foot = document.createElement("div");
    foot.className = "rec-foot";
    panel.appendChild(foot);

    document.body.appendChild(panel);

    var fab = document.createElement("button");
    fab.type = "button";
    fab.className = "rec-fab att-fab";
    fab.textContent = "الحضور";
    fab.setAttribute("aria-label", "لوحة الحضور");
    fab.addEventListener("click", toggle);
    document.body.appendChild(fab);

    addEventListener("keydown", function (e) {
      var t = e.target;
      if (t && t.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ح" || e.key === "a" || e.key === "A") { toggle(); e.preventDefault(); }
      else if (e.key === "Escape" && open) { toggle(); }
    });
  }

  function toggle() {
    open = !open;
    panel.hidden = !open;
    if (open) load(); else closeCode();
  }

  /* ─── البيانات ─── */
  function load() {
    Promise.all([
      Store.students(section.id),
      Store.attendance({ sectionId: section.id, session: sessionNo }),
      Store.schedule(section.id)
    ]).then(function (r) {
      students = r[0].slice().sort(function (a, b) { return (a.no || 0) - (b.no || 0); });
      marks = {};
      r[1].forEach(function (a) { marks[a.studentId] = a.status; });
      sched = r[2] || {};
      renderBar();
      renderGrid();
      renderHead();
    }).catch(function (e) {
      console.error(e);
      flash(e.message || "تعذّر تحميل الكشف", true);
    });
  }

  function day() { return sched[sessionNo] || Store.dayKey(); }

  function renderHead() {
    var d = sched[sessionNo];
    var late = d && d < Store.dayKey();
    title.textContent = "الحضور · المحاضرة " + ar(sessionNo) +
      (d ? " · " + TPUI.arDate(d) : "") + (late ? " · بأثر رجعي" : "");
  }

  /* ─── شريط «الضغط يعلّم» والتعليم الجملي ─── */
  function renderBar() {
    bar.textContent = "";
    var lbl = document.createElement("span");
    lbl.className = "att-lbl";
    lbl.textContent = "الضغط يعلّم:";
    bar.appendChild(lbl);

    STATES.forEach(function (st) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "att-pick s-" + st.id + (brush === st.id ? " on" : "");
      b.textContent = st.label;
      b.setAttribute("aria-pressed", brush === st.id ? "true" : "false");
      b.addEventListener("click", function () { brush = st.id; renderBar(); });
      bar.appendChild(b);
    });

    var all = document.createElement("button");
    all.type = "button";
    all.className = "att-all";
    all.textContent = "الكل حاضرات";
    all.addEventListener("click", markAll);
    bar.appendChild(all);

    /*  الرمز يعمل مع الخادم وحده: في الوضع المحلي لا شيء يصل جهاز
        الطالبة بجهاز الدكتورة. فيُخفى الزرّ بدل أن يُعرض ثم يعتذر. */
    if (Store.codesReady && Store.codesReady() && baseUrl()) {
      var qr = document.createElement("button");
      qr.type = "button";
      qr.className = "att-qr";
      qr.textContent = "رمز الحضور";
      qr.addEventListener("click", openCode);
      bar.appendChild(qr);
    }
  }

  /*  عنوان المنصة كما تفتحه الطالبة. من المتصفّح إن كانت الصفحة
      تُقدَّم عبر خادم — وهو الحال على الشبكة. */
  function baseUrl() {
    if (location.protocol !== "http:" && location.protocol !== "https:") return "";
    return location.origin + location.pathname.replace(/sessions\/[^/]+\/[^/]*$/, "");
  }

  /* ═══ شاشة الرمز — تُعرض على البروجكتر ═══ */
  function openCode() {
    if (!codeBox) buildCode();
    codeOn = true;
    codeBox.hidden = false;
    rotate();
    codeTimer = setInterval(rotate, TTL * 1000);
  }

  function closeCode() {
    codeOn = false;
    if (codeBox) codeBox.hidden = true;
    clearInterval(codeTimer); codeTimer = null;
    clearInterval(codeTick); codeTick = null;
  }

  function buildCode() {
    codeBox = document.createElement("div");
    codeBox.className = "att-code";
    codeBox.hidden = true;

    var head = document.createElement("div");
    head.className = "ac-head";
    var h = document.createElement("div");
    h.className = "ac-title";
    h.textContent = "امسحي الرمز لتسجيل حضورك";
    head.appendChild(h);

    var x = document.createElement("button");
    x.type = "button";
    x.className = "rec-x";
    x.textContent = "إغلاق";
    x.addEventListener("click", closeCode);
    head.appendChild(x);
    codeBox.appendChild(head);

    var box = document.createElement("div");
    box.className = "ac-qr";
    box.id = "acQr";
    codeBox.appendChild(box);

    var life = document.createElement("div");
    life.className = "ac-life";
    life.id = "acLife";
    codeBox.appendChild(life);

    var note = document.createElement("div");
    note.className = "ac-note";
    note.textContent = "الرمز يتبدّل كل " + ar(TTL) + " ثانية. " +
      "مسحُه يقتضي الدخول بحسابك في المنصة.";
    codeBox.appendChild(note);

    document.body.appendChild(codeBox);
    addEventListener("keydown", function (e) {
      if (e.key === "Escape" && codeOn) { closeCode(); e.stopPropagation(); }
    }, true);
  }

  /*  الرمز عشوائيّ من مولّد المتصفّح المعمَّى، لا من الوقت ولا من
      رقم المحاضرة — فلا يُحزَر ولا يُشتقّ. */
  function newNonce() {
    var a = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return [].map.call(a, function (b) {
      return ("0" + b.toString(16)).slice(-2);
    }).join("");
  }

  function rotate() {
    if (!codeOn) return;
    var nonce = newNonce();
    Store.issueCode(section.id, sessionNo, nonce, TTL).then(function () {
      if (!codeOn) return;
      var url = baseUrl() + "attend.html?c=" + encodeURIComponent(nonce);
      document.getElementById("acQr").innerHTML =
        QR.svg(url, { dark: "#0A0A0A", light: "#FFFFFF" });
      countdown();
      load();                               /* الشبكة تُظهر من سجّلت */
    }).catch(function (e) {
      if (!codeOn) return;
      document.getElementById("acQr").textContent = "";
      document.getElementById("acLife").textContent =
        e.message || "تعذّر إصدار الرمز.";
    });
  }

  function countdown() {
    clearInterval(codeTick);
    var left = TTL;
    var el = document.getElementById("acLife");
    function paint() {
      el.textContent = "يتبدّل بعد " + ar(left) + " ثانية";
      el.style.setProperty("--left", (left / TTL) * 100 + "%");
    }
    paint();
    codeTick = setInterval(function () {
      left = Math.max(0, left - 1);
      paint();
      if (!left) clearInterval(codeTick);
    }, 1000);
  }

  /* ─── الشبكة ─── */
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
      var m = marks[s.id];
      var b = document.createElement("button");
      b.type = "button";
      b.className = "rec-chip att-chip" + (m ? " s-" + m : "");
      b.dataset.id = s.id;

      var no = document.createElement("span");
      no.className = "n";
      no.textContent = ar(s.no);
      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = s.name;
      b.appendChild(no);
      b.appendChild(nm);

      var tag = document.createElement("span");
      tag.className = "pt";
      tag.textContent = m ? shortOf(m) : "—";
      b.appendChild(tag);

      /* الضغطة تضع ما في الفرشاة، وإعادتها على الحال نفسها تمحوه —
         فتُصحَّح النقرة الخاطئة بنقرةٍ ثانية لا بفتح صفحة أخرى. */
      b.addEventListener("click", function () { apply(s, m === brush ? null : brush); });
      grid.appendChild(b);
    });
    tally();
  }

  function shortOf(id) {
    var st = STATES.filter(function (x) { return x.id === id; })[0];
    return st ? st.short : "؟";
  }

  function tally() {
    var c = {};
    students.forEach(function (s) { var m = marks[s.id]; if (m) c[m] = (c[m] || 0) + 1; });
    var parts = STATES.filter(function (s) { return c[s.id]; })
                      .map(function (s) { return s.label + " " + ar(c[s.id]); });
    var left = students.length - Object.keys(marks).filter(function (k) {
      return marks[k];
    }).length;
    if (left > 0) parts.push("بلا تعليم " + ar(left));
    foot.textContent = (parts.join(" · ") || "لم يُعلَّم أحد بعد") + " · ح: فتح وإغلاق";
  }

  /* ─── الكتابة ─── */
  function apply(st, status) {
    /*  «بلا تعليم» حذفٌ للسجل لا حالةٌ فارغة: عمود الحالة مقيَّدٌ في
        الخادم بالحالات الأربع، والفراغ يُرفض. والفرق معنويّ أيضًا —
        محاضرةٌ لم تُعلَّم ليست غيابًا، وقاعدة الغياب في store.js
        تُخرج غير المعلَّم من البسط والمقام معًا. */
    var save = status
      ? Store.markAttendance({ studentId: st.id, sectionId: section.id,
                               session: sessionNo, day: day(), status: status })
      : Store.unmarkAttendance(st.id, sessionNo);

    if (status) marks[st.id] = status; else delete marks[st.id];
    renderGrid();

    save.catch(function (e) {
      flash(e.message || "تعذّر الحفظ", true);
      load();                                   /* الشاشة لا تكذب */
    });
  }

  function markAll() {
    busy(true);
    var chain = Promise.resolve();
    students.forEach(function (st) {
      chain = chain.then(function () {
        return Store.markAttendance({ studentId: st.id, sectionId: section.id,
                                      session: sessionNo, day: day(), status: "present" });
      });
    });
    chain.then(function () {
      busy(false);
      flash("عُلّمت الكل حاضرات — انقري الغائبات.");
      load();
    }).catch(function (e) {
      busy(false);
      flash(e.message || "تعذّر الحفظ", true);
      load();
    });
  }

  /*  على الخادم تستغرق السلسلة ثوانيَ (طلبٌ لكل طالبة). تُقفل
      الشبكة حتى تنتهي، وإلا عُلّمت طالبةٌ غائبةً ثم وصلت السلسلة
      إليها فكتبت «حاضرة» فوقها. */
  function busy(on) {
    panel.classList.toggle("busy", !!on);
    [].slice.call(panel.querySelectorAll("button")).forEach(function (b) {
      if (b.className.indexOf("rec-x") < 0) b.disabled = !!on;
    });
  }

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
    flashTimer = setTimeout(function () { flashEl.className = "rec-flash"; }, 2200);
  }
})();
