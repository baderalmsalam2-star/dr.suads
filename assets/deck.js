/* ═══ محرّك عرض المحاضرة — مشترك بين كل المحاضرات ═══
   ملف المحاضرة لا يحتوي إلا على المحتوى؛ كل السلوك هنا.

   يقرأ إعداداته بهذا الترتيب:
     ١) معطيات الرابط  ?section=2&roster=20&startAt=6
     ٢) الشعبة المحفوظة من الصفحة الرئيسية
     ٣) بيانات المقرر في data/courses/<المقرر>/course.js
   فلا حاجة لتعديل مصدر المحاضرة لعرضها على شعبة أخرى. */
(function () {
  "use strict";

  var params  = new URLSearchParams(location.search);
  var COURSE  = window.COURSE || { sessions: [] };
  var TP      = window.TP;
  var ar      = TP.ar;

  var sessionNo = +(document.body.dataset.session || 0);
  var meta = (COURSE.sessions || []).filter(function (s) { return s.n === sessionNo; })[0] || {};

  var section = TP.resolveSection(params);
  var roster  = +params.get("roster")  || section.roster || 1;
  var startAt = +params.get("startAt") || TP.startAtFor(meta) || 1;

  var slides = [].slice.call(document.querySelectorAll(".slide"));
  var marks  = document.getElementById("marks");
  var tab    = document.getElementById("tab");
  var src    = document.getElementById("src");
  var timer  = document.getElementById("timer");
  var i = 0, tid = null;

  if (!slides.length) return;

  /* ─── الشريط العلوي والسفلي ─── */
  fill("course", COURSE.title);
  fill("instructor", COURSE.instructor);
  fill("sec", section.name);
  fill("credit", COURSE.credit);

  function fill(id, text) {
    var el = document.getElementById(id);
    if (el && text) el.textContent = text;
  }

  slides.forEach(function () { marks.insertAdjacentHTML("beforeend", "<i></i>"); });
  var dots = [].slice.call(marks.children);

  /* ─── توزيع القارئات ─── */
  var seat = TP.seatMaker(roster, startAt);
  var readerSlides = [].slice.call(document.querySelectorAll("[data-reader]"));
  readerSlides.forEach(function (el, k) {
    el.dataset.readerNo = seat(k);
    el.dataset.tab = "تقرأ: الطالبة رقم " + ar(seat(k));
  });

  var nextSeat = TP.seatMaker(roster, startAt + readerSlides.length);
  var nx = document.getElementById("next");
  if (nx) {
    nx.textContent = [0, 1, 2].map(function (k) { return "رقم " + ar(nextSeat(k)); }).join(" · ");
  }

  /* إن وُجد كشف بالأسماء، يحل الاسم محل الرقم على اللسان. يجري
     بعد العرض الأول حتى لا تتأخر الشريحة الأولى على التخزين. */
  if (window.Store) {
    Store.students(section.id).then(function (list) {
      if (!list.length) return;

      /* الكشف الحقيقي هو المرجع في عدد القارئات، لا الرقم المكتوب في
         ملف المقرر — وإلا التفّت الدورة على عدد خاطئ. */
      var real = params.get("roster") ? roster : list.length;
      seat = TP.seatMaker(real, startAt);
      nextSeat = TP.seatMaker(real, startAt + readerSlides.length);

      var byNo = {};
      list.forEach(function (s) { if (!s.placeholder) byNo[s.no] = s.name; });

      readerSlides.forEach(function (el, k) {
        el.dataset.readerNo = seat(k);
        var name = byNo[seat(k)];
        el.dataset.tab = name ? "تقرأ: " + name : "تقرأ: الطالبة رقم " + ar(seat(k));
      });
      if (nx) {
        nx.textContent = [0, 1, 2].map(function (k) {
          return byNo[nextSeat(k)] || "رقم " + ar(nextSeat(k));
        }).join(" · ");
      }
      show(i);                                  /* تحديث اللسان الظاهر */
    }).catch(function () { /* يبقى الترقيم كما هو */ });
  }

  /* ─── حجم خط الشريحة ───
     القاعات تختلف: ما يُقرأ من آخر قاعةٍ لا يُقرأ من آخر غيرها.
     فالمقاس بيد الدكتورة، ويُحفظ لجهازها فلا تعيده كل محاضرة. */
  var ZOOM_KEY = "tp.deck.zoom";
  var STEPS = [0.75, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];
  var zi = STEPS.indexOf(1);

  (function () {
    var saved = null;
    try { saved = parseFloat(localStorage.getItem(ZOOM_KEY)); } catch (e) { /* تصفّح خاص */ }
    var k = STEPS.indexOf(saved);
    if (k >= 0) zi = k;
  })();

  var zLabel = document.getElementById("zoomLevel");

  function applyZoom() {
    document.documentElement.style.setProperty("--z", String(STEPS[zi]));
    if (zLabel) zLabel.textContent = ar(Math.round(STEPS[zi] * 100)) + "٪";
    try { localStorage.setItem(ZOOM_KEY, String(STEPS[zi])); } catch (e) { /* تصفّح خاص */ }
  }

  function zoom(d) {
    var k = Math.max(0, Math.min(zi + d, STEPS.length - 1));
    if (k === zi) return;
    zi = k;
    applyZoom();
  }

  applyZoom();
  bind("zoomIn",  function () { zoom(1); });
  bind("zoomOut", function () { zoom(-1); });

  function bind(id, fn) {
    var b = document.getElementById(id);
    if (b) b.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
  }

  /* ─── المؤقت ─── */
  function stopTimer() { clearInterval(tid); tid = null; timer.className = "timer"; }

  function startTimer(sec) {
    stopTimer();
    var t = sec;
    timer.className = "timer on";
    timer.textContent = ar(t);
    tid = setInterval(function () {
      t--;
      timer.textContent = ar(Math.max(t, 0));
      if (t <= 0) {
        clearInterval(tid); tid = null;
        timer.classList.add("done");
        timer.textContent = "انتهى الوقت";
      }
    }, 1000);
  }

  /* ─── التنقل ─── */
  function show(n) {
    i = Math.max(0, Math.min(n, slides.length - 1));
    slides.forEach(function (s, k) { s.classList.toggle("on", k === i); });
    dots.forEach(function (d, k) { d.classList.toggle("on", k <= i); });
    var s = slides[i];
    tab.textContent = s.dataset.tab || "";
    src.textContent = s.dataset.src || "";
    s.classList.remove("reveal");
    if (s.dataset.timer) startTimer(+s.dataset.timer); else stopTimer();
    dispatchEvent(new CustomEvent("tp:slide", { detail: { index: i, slide: s } }));
  }

  function reveal() {
    var s = slides[i];
    if (!s.hasAttribute("data-q")) return;
    s.classList.add("reveal");
    stopTimer();
  }

  addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "PageDown") { show(i + 1); e.preventDefault(); }
    else if (e.key === "ArrowRight" || e.key === "PageUp") { show(i - 1); e.preventDefault(); }
    else if (e.key === " ") { reveal(); e.preventDefault(); }
    else if (e.key === "r" || e.key === "ر") { var t = slides[i].dataset.timer; if (t) startTimer(+t); }
    else if (e.key === "Home") { show(0); }
    else if (e.key === "End") { show(slides.length - 1); }
    /*  + و = و − على الصفّ العلوي وعلى لوحة الأرقام معًا، فلا يُشترط
        الضغط على Shift لتكبير الخط. */
    else if (e.key === "+" || e.key === "=" || e.key === "Add") { zoom(1); e.preventDefault(); }
    else if (e.key === "-" || e.key === "_" || e.key === "Subtract") { zoom(-1); e.preventDefault(); }
    else if (e.key === "0" || e.key === "٠") { zi = STEPS.indexOf(1); applyZoom(); e.preventDefault(); }
  });

  addEventListener("click", function (e) {
    if (e.target.closest("button, a, select")) return;
    if (slides[i].hasAttribute("data-q") && !slides[i].classList.contains("reveal")) reveal();
    else show(i + 1);
  });

  var prev = document.getElementById("prev");
  var next = document.getElementById("nextBtn");
  if (prev) prev.addEventListener("click", function () { show(i - 1); });
  if (next) next.addEventListener("click", function () {
    if (slides[i].hasAttribute("data-q") && !slides[i].classList.contains("reveal")) reveal();
    else show(i + 1);
  });

  /* سحب بالإصبع — الاتجاه من اليمين لليسار كاتجاه القراءة */
  var x0 = null;
  addEventListener("touchstart", function (e) { x0 = e.changedTouches[0].clientX; }, { passive: true });
  addEventListener("touchend", function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 45) return;
    show(dx < 0 ? i + 1 : i - 1);
  }, { passive: true });

  /* الرجوع إلى المنصة مع الاحتفاظ بالشعبة.
     المسار يُؤخذ من الوسم نفسه لا يُكتب هنا: المحاضرات صارت في
     مجلّد مقررها (sessions/<المقرر>/) فعمقُها ليس واحدًا دائمًا. */
  var home = document.getElementById("home");
  if (home) {
    home.href = (home.getAttribute("href") || "../index.html").split("?")[0] +
                "?section=" + encodeURIComponent(section.id);
  }

  /* تتاح للوحة الرصد ولأي إضافة لاحقة */
  window.DECK = {
    section: section, session: sessionNo, roster: roster, startAt: startAt,
    slides: slides, show: show, current: function () { return i; },
    zoom: zoom
  };

  show(0);
})();
