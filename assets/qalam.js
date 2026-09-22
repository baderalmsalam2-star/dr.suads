/* ═══════════════════════════════════════════════════════════════
   الكتابة بالقلم على الشريحة المعروضة.

   الدكتورة تشرح فتحتاج أن تخطّ على النصّ نفسه: تحوّط كلمة، وتصل
   بين قيدين بسهم، وتكتب في الهامش ما ليس في المذكرة. فطبقةٌ شفّافة
   فوق الشريحة، لكل شريحةٍ خطُّها.

   ═══ القلم وحده يكتب ═══
   pointerType يفصل القلم من الإصبع من الراحة. فالكتابة للقلم،
   والإصبعُ يبقى للتنقّل بين الشرائح كما كان — ولولا ذلك لخطّت
   راحةُ اليد وهي متّكئة على الشاشة، ولَما استطاعت الدكتورة أن
   تقلّب الشريحة بإصبعها وهي ممسكةٌ بالقلم.

   ومن لا قلم له: زرُّ «بالإصبع» يفتح الكتابة للإصبع، ويوقف التنقّل
   باللمس ما دام مفتوحًا — فلا يُقلَّب الدرسُ تحت يدها وهي تكتب.

   ═══ الإحداثيات نسبيّة ═══
   تُحفظ من ٠ إلى ١ من عرض الشريحة وارتفاعها، لا بالنقاط. فما كُتب
   على الآيباد يظهر في مكانه على شاشة العرض وعلى الحاسوب — وتدويرُ
   الجهاز لا يزحزح خطًّا.

   ═══ وهي للدكتورة وحدها ═══
   الطالبة لا ترى الشريطَ ولا الخطّ. والحفظ في جدول content، وهو
   جدولٌ يقرؤه الجميع — فالإخفاء ترتيبُ واجهةٍ لا حاجزُ أمان. وليس
   في الخطّ ما يُحرَس: هو شرحُ الدكتورة لا بيانات طالبة.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var sessionNo = +(document.body.dataset.session || 0);
  if (!sessionNo || !window.TPContent || !window.Store) return;

  var slides = [].slice.call(document.querySelectorAll(".slide"));
  var inner = document.querySelector(".folio .inner");
  if (!slides.length || !inner) return;

  var COLORS = ["#E23D2E", "#0DABE2", "#F8D81B", "#14A06A"];

  /*  لكلٍّ دفترُها: الدكتورة تكتب على مرجع الدرس، والطالبة على مرجعٍ
      يحمل معرّف صفّها. فلا تُمحى كتابةُ إحداهما بكتابة الأخرى، ولا
      ترى الطالبةُ ما خطّته الدكتورةُ في تحضيرها — وهي ملاحظاتُ
      شرحٍ لم تُكتب لها. */
  var REF = (COURSE.id || "course") + ":s" + sessionNo;

  var ink = {};          /* فهرس الشريحة → مصفوفة خطوط */
  var pen = false, erase = false, finger = false;
  var color = COLORS[0], width = 3;
  var cur = null, at = 0, dirty = {};

  /* ─── اللوح ─── */
  var cv = document.createElement("canvas");
  cv.className = "ink";
  cv.setAttribute("aria-hidden", "true");
  inner.appendChild(cv);
  var cx = cv.getContext("2d");

  function size() {
    var r = inner.getBoundingClientRect();
    var d = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * d);
    cv.height = Math.round(r.height * d);
    cv.style.width = r.width + "px";
    cv.style.height = r.height + "px";
    cx.setTransform(d, 0, 0, d, 0, 0);
    paint();
  }

  function paint() {
    var r = inner.getBoundingClientRect();
    cx.clearRect(0, 0, r.width, r.height);
    (ink[at] || []).forEach(function (s) {
      if (!s.p || s.p.length < 2) return;
      cx.strokeStyle = s.c;
      cx.lineWidth = s.w;
      cx.lineCap = "round";
      cx.lineJoin = "round";
      cx.beginPath();
      cx.moveTo(s.p[0][0] * r.width, s.p[0][1] * r.height);
      for (var k = 1; k < s.p.length; k++) {
        cx.lineTo(s.p[k][0] * r.width, s.p[k][1] * r.height);
      }
      cx.stroke();
    });
  }

  /* ─── الرسم ─── */
  function spot(e) {
    var r = cv.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 1e4) / 1e4,
            Math.round(((e.clientY - r.top) / r.height) * 1e4) / 1e4];
  }

  function mine(e) {
    if (!pen) return false;
    /*  الراحة تُرسل touch، والقلمُ pen. فمتى كان القلم مفتوحًا ولم
        يُطلب الإصبع، لم يكتب إلا القلم. */
    return e.pointerType === "pen" || (finger && e.pointerType !== "pen");
  }

  /*  الممحاة تحذف الخطّ الذي مرّت عليه كلَّه لا جزءًا منه: أسرع في
      الاستعمال من محو النقاط واحدةً واحدة، وأصدق مع ما تريده
      الدكتورة — تشطب ما كتبت لا بعضه. */
  function rub(pt) {
    var r = inner.getBoundingClientRect();
    var list = ink[at] || [];
    var near = 14 / Math.max(r.width, 1);
    for (var s = list.length - 1; s >= 0; s--) {
      var p = list[s].p || [];
      for (var k = 0; k < p.length; k++) {
        var dx = p[k][0] - pt[0], dy = (p[k][1] - pt[1]) * (r.height / r.width);
        if (dx * dx + dy * dy < near * near) {
          list.splice(s, 1);
          touch();
          paint();
          return;
        }
      }
    }
  }

  cv.addEventListener("pointerdown", function (e) {
    if (!mine(e)) return;
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    if (erase) return rub(spot(e));
    cur = { c: color, w: width, p: [spot(e)] };
    (ink[at] || (ink[at] = [])).push(cur);
  });

  cv.addEventListener("pointermove", function (e) {
    if (!mine(e)) return;
    if (erase) { if (e.buttons) rub(spot(e)); return; }
    if (!cur) return;
    e.preventDefault();
    cur.p.push(spot(e));
    paint();
  });

  function done(e) {
    if (!cur) return;
    /*  نقرةٌ بلا حركة ليست خطًّا — تُحذف فلا تبقى نقطةٌ لا تُرى ولا
        تُمحى إلا بالبحث عنها. */
    if (cur.p.length < 2) (ink[at] || []).pop();
    cur = null;
    touch();
    paint();
  }
  cv.addEventListener("pointerup", done);
  cv.addEventListener("pointercancel", done);
  cv.addEventListener("pointerleave", done);

  /* ─── الحفظ ─── */
  var timer = null;
  function touch() {
    dirty[at] = true;
    clearTimeout(timer);
    /*  يُؤجَّل الحفظ ثانيةً بعد آخر خطّ: الدكتورة تكتب سطرًا في
        عشرة خطوط، فلا يُرسَل عشرةَ مرات. */
    timer = setTimeout(save, 1000);
  }

  function save() {
    Object.keys(dirty).forEach(function (n) {
      var list = ink[n] || [];
      TPContent.set(REF + "#" + n, "ink", list.length ? JSON.stringify(list) : "")
        .catch(function (e) { TPUI.toast("تعذّر حفظ الكتابة: " + (e.message || ""), "bad"); });
      delete dirty[n];
    });
  }
  /*  وإن أُغلقت الصفحة قبل أن يحين الأجل، حُفظ ما بقي. */
  addEventListener("pagehide", function () { clearTimeout(timer); save(); });

  /* ─── الشريط ─── */
  var bar = document.createElement("div");
  bar.className = "inkbar";
  bar.hidden = true;

  function btn(label, title, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.addEventListener("click", function (ev) { ev.stopPropagation(); fn(b); });
    bar.appendChild(b);
    return b;
  }

  var bPen = btn("قلم", "الكتابة على الشريحة (مفتاح ك)", function () { toggle(); });
  var bErase = btn("ممحاة", "امسحي خطًّا بمروره عليه", function () {
    erase = !erase;
    bErase.classList.toggle("on", erase);
    cv.classList.toggle("erasing", erase);
  });

  var swatch = document.createElement("span");
  swatch.className = "hues";
  COLORS.forEach(function (c) {
    var s = document.createElement("button");
    s.type = "button";
    s.className = "hue" + (c === color ? " on" : "");
    s.style.background = c;
    s.title = "لون القلم";
    s.addEventListener("click", function (ev) {
      ev.stopPropagation();
      color = c;
      erase = false;
      bErase.classList.remove("on");
      cv.classList.remove("erasing");
      [].forEach.call(swatch.children, function (x) { x.classList.remove("on"); });
      s.classList.add("on");
    });
    swatch.appendChild(s);
  });
  bar.appendChild(swatch);

  btn("تراجع", "احذفي آخر خطّ", function () {
    if (!(ink[at] || []).length) return;
    ink[at].pop();
    touch();
    paint();
  });

  btn("مسح", "امسحي كتابة هذه الشريحة كلَّها", function () {
    if (!(ink[at] || []).length) return;
    if (!confirm("مسح الكتابة على هذه الشريحة؟")) return;
    ink[at] = [];
    touch();
    paint();
  });

  var bFinger = btn("بالإصبع", "لمن لا قلم لديها — ويتوقّف التقليب باللمس", function () {
    finger = !finger;
    bFinger.classList.toggle("on", finger);
    document.body.classList.toggle("ink-finger", finger);
  });

  function toggle(on) {
    pen = (on === undefined) ? !pen : !!on;
    bPen.classList.toggle("on", pen);
    document.body.classList.toggle("ink-on", pen);
    if (!pen) {
      erase = false;
      bErase.classList.remove("on");
      cv.classList.remove("erasing");
    }
  }

  /* ═══ ألّا يُقلَّب الدرسُ تحت القلم ═══
     deck.js يُصغي للنقر على النافذة فيتقدّم شريحةً. والكتابةُ نقرٌ
     في نظره. فيُعترض النقرُ في طور الالتقاط — وqalam يُحمَّل بعده
     فيسبقه إليه — ويُوقَف متى وقع على اللوح والقلمُ مفتوح.

     والسحبُ باللمس يبقى عاملًا ما دامت الكتابة للقلم وحده: تكتب
     بالقلم وتقلّب بإصبعها في آنٍ واحد. فإن فُتحت الكتابة للإصبع
     أُوقف السحبُ — وإلا قلّبت الصفحةَ وهي تخطّ. */
  addEventListener("click", function (e) {
    if (pen && e.target === cv) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  /*  ═══ والقلمُ يُطلق لمسًا أيضًا ═══
      على الآيباد يُصدر قلمُ أبل أحداثَ لمسٍ إلى جانب أحداث المؤشّر،
      وdeck.js يقرأ السحبَ باللمس. فكلُّ خطٍّ أعرضَ من خمسةٍ وأربعين
      بكسلًا كان يُقرأ سحبًا فتمشي الشريحةُ تحت القلم — وهو ما شكت
      منه الدكتورة: «الشريحة تمشي وقت الكتابة».

      واختباري كان أعمى عنه: حاكى أحداث المؤشّر وحدها، فلم يمرّ على
      طريق اللمس أصلًا. فحرسُ النقر وحده لا يكفي.

      ويُفرَّق باللمس نفسه: touchType === 'stylus' في سفاري، ومعه
      علمُنا أن قلمًا مُنزَلٌ الآن — فبعض المتصفّحات لا تضع النوع.
      والإصبعُ يبقى يقلّب كما كان: تكتب بالقلم وتقلّب بإصبعها. */
  var penDown = false;
  cv.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "pen") penDown = true;
  }, true);
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) {
    cv.addEventListener(t, function (e) {
      if (e.pointerType === "pen") penDown = false;
    }, true);
  });

  function byStylus(e) {
    var list = e.changedTouches || e.touches || [];
    for (var k = 0; k < list.length; k++) {
      if (list[k].touchType === "stylus") return true;
    }
    return false;
  }

  ["touchstart", "touchend", "touchmove"].forEach(function (t) {
    addEventListener(t, function (e) {
      if (!pen) return;
      if (finger || penDown || byStylus(e)) e.stopPropagation();
    }, true);
  });

  /* ─── الوصل بمحرّك العرض ─── */
  //  deck.js يُعلن عن تبديل الشريحة، فلا يُستنسخ منطقُ التنقّل هنا.
  addEventListener("tp:slide", function (e) {
    at = e.detail.index;
    paint();
  });
  addEventListener("resize", size);
  addEventListener("orientationchange", function () { setTimeout(size, 120); });

  addEventListener("keydown", function (e) {
    if (e.target.closest && e.target.closest("input, textarea, [contenteditable]")) return;
    if (e.key === "k" || e.key === "ك") { toggle(); e.preventDefault(); }
  });

  /* ─── للدكتورة وللطالبة، ولكلٍّ دفترُها ─── */
  function start() {
    document.querySelector(".folio").appendChild(bar);
    bar.hidden = false;
    return TPContent.ready().then(function () {
      slides.forEach(function (_, n) {
        var raw = TPContent.get(REF + "#" + n, "ink");
        if (!raw) return;
        try { ink[n] = JSON.parse(raw) || []; } catch (x) { ink[n] = []; }
      });
      size();
    });
  }

  TPRole.staff().then(function (ok) {
    if (ok) return start();
    /*  الطالبة تكتب على شريحتها كما تكتب في دفترها: تحوّط كلمةً
        وتعلّق في الهامش. وكتابتُها لها وحدها — لا تراها الدكتورةُ
        ولا زميلاتُها، فهي ملاحظاتُ درسٍ لا تسليم. */
    return Store.students().then(function (rows) {
      var me = (rows || [])[0];
      if (!me) return;                 /* حسابٌ بلا صفّ: لا دفتر له */
      REF = REF + "@" + me.id;
      return start();
    });
  }).catch(function () { /* بلا خادم: لا كتابة */ });

  size();
})();
