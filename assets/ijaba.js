/* ═══════════════════════════════════════════════════════════════
   إجابة الطالبة على سؤال المحاضرة.

   كانت شرائح الأسئلة تُعرض وتُكشف إجابتها، والطالبات يُجِبن شفاهًا.
   فلا تعرف الدكتورة كم فهم قبل أن تكشف — ومن أصابت بعد الكشف لا
   يُعرف أأصابت أم وافقت.

   فصارت الطالبة تضغط الخيار على جهازها، وترى الدكتورة على شاشتها
   قبل أن تكشف:

       أجابت ١٤ من ٢٢ · أصابت ٩
       أ ٢  ب ٩  ج ٨  د ١

   فتعرف أيُّ خيارٍ خاطئٍ جذبهنّ — وذاك أنفع من عدد المصيبات.

   ═══ ولا يُخزَّن «صحيحة» ═══
   يُخزَّن الخيار المضغوط لا صوابُه. والصوابُ يُعرف من الشريحة نفسها
   (li.right) عند العرض — ولو خُزّن لاستطاعت الطالبةُ أن ترسل
   «أصبتُ» بلا أن تُصيب.

   ═══ ولا ترى الطالبةُ صوابَها قبل الكشف ═══
   تُعلَّم إجابتُها ولا يُقال أصحيحةٌ هي. فالكشفُ بيد الدكتورة —
   ولو قيل لها لصار الجوابُ عندها قبل النقاش.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var sessionNo = +(document.body.dataset.session || 0);
  if (!sessionNo || !window.Store || !Store.repliesReady || !Store.repliesReady()) return;

  var COURSE = window.COURSE || {};
  var params = new URLSearchParams(location.search);
  var section = TP.resolveSection(params);
  var REF = (COURSE.id || "course") + ":s" + sessionNo;

  /*  عنوانُ كشف السؤال. ويُفرَّق عن عنوان خطِّ القلم (‎#٠‎ ‎#١‎ …)
      بحرف الـ q، فلا يختلطان في طبقةٍ واحدة. */
  function qref(q) { return REF + "#q" + q; }

  /*  رقمُ السؤال ترتيبُه بين شرائح الأسئلة لا بين الشرائح كلِّها:
      فلو أُضيفت شريحةُ متنٍ أو حُذفت لم تتبدّل أرقامُ الأسئلة،
      وتبقى إجاباتُ من أجابت منسوبةً إلى سؤالها.

      ويُحسب من DOM الحيّ عند كل انتقال لا من قائمةٍ قُرئت عند
      التحميل: «تحرير النصّ» يحذف شريحةً ويضيف أخرى بعد ذلك، فقائمةٌ
      محفوظةٌ تتزحزح عن الواقع — فيُنسب الجوابُ إلى سؤالٍ ليس هو،
      ولا يظهر ذلك إلا في حصيلةٍ لا تُصدَّق. */
  function ordinalOf(slide) {
    if (!slide || !slide.hasAttribute("data-q")) return -1;
    var all = document.querySelectorAll(".folio .inner .slide[data-q]");
    for (var k = 0; k < all.length; k++) if (all[k] === slide) return k;
    return -1;
  }

  if (!document.querySelector(".folio .inner .slide[data-q]")) return;

  var staff = false, me = null, mineBy = {}, poll = null;
  var shown = {};   /* رقم السؤال → أكُشف جوابُه عندهنّ */

  function rightOf(slide) {
    var li = slide.querySelectorAll(".opts li");
    for (var k = 0; k < li.length; k++) {
      if (li[k].classList.contains("right")) return k;
    }
    return -1;
  }

  /* ─── جهة الطالبة: الخيارات تُضغط ─── */
  function arm(slide, q) {
    var li = [].slice.call(slide.querySelectorAll(".opts li"));
    li.forEach(function (item, k) {
      if (item.dataset.armed) return;
      item.dataset.armed = "1";
      item.setAttribute("role", "button");
      item.tabIndex = 0;
      item.classList.add("tappable");
      function pick(e) {
        e.stopPropagation();
        e.preventDefault();
        if (!me) return TPUI.toast("حسابك غير مرتبطٍ بصفٍّ في الكشف.", "bad");
        Store.saveReply({ studentId: me.id, sectionId: section.id,
                          session: sessionNo, q: q, choice: k })
          .then(function () {
            mineBy[q] = k;
            mark(slide, q);
            TPUI.toast("سُجّلت إجابتك.", "good");
          })
          .catch(function (err) { TPUI.toast(err.message || "تعذّر الإرسال.", "bad"); });
      }
      item.addEventListener("click", pick);
      item.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") pick(e);
      });
    });
    mark(slide, q);
  }

  /*  تُعلَّم إجابتُها ولا يُقال أصحيحةٌ هي: الكشفُ بيد الدكتورة. */
  function mark(slide, q) {
    var li = [].slice.call(slide.querySelectorAll(".opts li"));
    li.forEach(function (item, k) { item.classList.toggle("mine", mineBy[q] === k); });
  }

  /* ─── جهة الدكتورة: الحصيلة الحيّة ─── */
  var board = document.createElement("div");
  board.className = "tally";
  board.hidden = true;

  function tally(slide, q) {
    var right = rightOf(slide);
    return Promise.all([
      Store.replies({ sectionId: section.id, session: sessionNo }),
      Store.students(section.id)
    ]).then(function (r) {
      var rows = (r[0] || []).filter(function (x) { return +x.q === q; });
      var all = (r[1] || []).length;
      var n = [].slice.call(slide.querySelectorAll(".opts li")).length;
      var per = [];
      for (var k = 0; k < n; k++) per.push(0);
      rows.forEach(function (x) {
        if (x.choice >= 0 && x.choice < n) per[x.choice]++;
      });
      var hit = right >= 0 ? per[right] : 0;

      board.textContent = "";
      var head = document.createElement("b");
      head.textContent = "أجابت " + TP.ar(rows.length) +
                         (all ? " من " + TP.ar(all) : "") +
                         (right >= 0 ? " · أصابت " + TP.ar(hit) : "");
      board.appendChild(head);

      var bars = document.createElement("div");
      bars.className = "bars";
      var most = Math.max(1, Math.max.apply(null, per));
      var L = ["أ", "ب", "ج", "د", "هـ", "و"];
      per.forEach(function (c, k) {
        var b = document.createElement("span");
        b.className = "b" + (k === right ? " right" : "");
        b.style.setProperty("--h", Math.round((c / most) * 100) + "%");
        b.title = L[k] + ": " + TP.ar(c);
        b.appendChild(document.createTextNode(L[k] + " " + TP.ar(c)));
        bars.appendChild(b);
      });
      board.appendChild(bars);

      /*  الكشفُ يُطوى كما يُكشف: سؤالٌ بقي مكشوفًا في الخادم يفتحه
          على الطالبات في العام القادم قبل أن يُسألن. */
      var fold = document.createElement("button");
      fold.type = "button";
      fold.className = "foldq";
      fold.textContent = shown[q] ? "اطوِ الكشف عنهنّ" : "اكشفي لهنّ";
      fold.addEventListener("click", function (e) {
        e.stopPropagation();
        publish(slide, q, !shown[q]);
      });
      board.appendChild(fold);

      board.hidden = false;
    }).catch(function (e) {
      /*  انقطاعٌ عابر: تبقى آخر حصيلة. ويُذكر في وحدة التحكّم —
          فصمتٌ تامٌّ يجعل العطبَ يُقرأ «لا أحد أجاب». */
      console.warn('تعذّر جلب حصيلة الإجابات:', e && e.message || e);
    });
  }

  /* ─── كشفُ الجواب يبلغ أجهزتهنّ ───
     الشاشةُ التي أمام الدكتورة واحدة، والطالبات يتابعن كلٌّ على
     جهازها. فكانت تضغط «كشف» فينكشف عندها وحدها، وتبقى شريحتُهنّ
     سؤالًا بلا جواب ولا تعليل.

     فصار الكشفُ صفًّا في الخادم يقرؤه جهازُ كلِّ طالبة. والكتابةُ
     محصورةٌ في المالكة بالسياسة نفسها التي تحرس سائر التصحيحات —
     فلا تكشف طالبةٌ لنفسها ولا لغيرها. */
  function publish(slide, q, on) {
    shown[q] = !!on;
    if (on) slide.classList.add("reveal");
    else if (window.TPDeck && TPDeck.fold) TPDeck.fold(slide);
    else slide.classList.remove("reveal");
    return TPContent.set(qref(q), "kashf", on ? "1" : "")
      .then(function () { tally(slide, q); })
      .catch(function (e) {
        TPUI.toast("تعذّر إبلاغ أجهزتهنّ: " + (e.message || e), "bad");
      });
  }

  addEventListener("tp:reveal", function (e) {
    if (!staff) return;
    var q = ordinalOf(e.detail.slide);
    if (q < 0 || shown[q]) return;
    publish(e.detail.slide, q, true);
  });

  /*  وجهةُ الطالبة تسأل ما دامت واقفةً على السؤال: الكشفُ يقع في
      أثناء نظرها إليه، فقراءةٌ واحدةٌ عند الدخول لا تكفي. ولا تقف
      عند أول كشف — فالطيُّ يبلغها كما بلغها الكشف. ويُقطع السؤال
      عند الانتقال إلى شريحةٍ أخرى. */
  function await_(slide, q) {
    function look() {
      /*  الصفحةُ المخفيّة لا تُرى، فلا تُسأل — تبويبةٌ نُسيت مفتوحةً
          كانت تطرق الخادم إلى الأبد. */
      if (document.hidden) return;
      TPContent.fresh(qref(q), "kashf").then(function (v) {
        shown[q] = v === "1";
        if (!slide.classList.contains("on")) return;
        /*  الخادمُ هو القول الفصل في الكشف: من نقرت الشريحة فكشفت
            عند نفسها قبل الدكتورة، طُوي عنها. */
        if (shown[q]) slide.classList.add("reveal");
        else if (window.TPDeck && TPDeck.fold) TPDeck.fold(slide);
      }).catch(function (e) {
        console.warn("تعذّر معرفة أكُشف الجواب:", e && e.message || e);
      });
    }
    look();
    poll = setInterval(look, 3000);
  }

  /* ─── التبديل بين الشرائح ─── */
  /*  الشريحةُ تُؤخذ من الحدث نفسه: deck.js يمرّرها، فلا يُبحث عنها
      في قائمةٍ قد تكون قديمة. */
  function onSlide(slide) {
    clearInterval(poll);
    poll = null;
    if (!slide) slide = document.querySelector(".folio .inner .slide.on");
    var q = ordinalOf(slide);
    if (q < 0) { board.hidden = true; return; }
    if (staff) {
      TPContent.fresh(qref(q), "kashf").then(function (v) {
        shown[q] = v === "1";
        if (shown[q]) slide.classList.add("reveal");
        tally(slide, q);
      }).catch(function () { tally(slide, q); });
      /*  تُحدَّث كلَّ ثلاث ثوانٍ ما دامت الشريحةُ معروضة: الطالبات
          يُجِبن في أثناء وقوفها عليها، فحصيلةٌ لا تتحرّك لا تنفع.
          ويُوقَف المؤقّت عند الانتقال، فلا يبقى يطرق الخادم. */
      poll = setInterval(function () { tally(slide, q); }, 3000);
    } else {
      arm(slide, q);
      await_(slide, q);
    }
  }

  addEventListener("tp:slide", function (e) { onSlide(e.detail.slide); });
  addEventListener("pagehide", function () { clearInterval(poll); });

  TPRole.staff().then(function (ok) {
    staff = !!ok;
    if (staff) {
      document.querySelector(".folio").appendChild(board);
      onSlide(null);
      return;
    }
    return Store.students().then(function (rows) {
      me = (rows || [])[0] || null;
      return Store.replies({ sectionId: section.id, session: sessionNo });
    }).then(function (rows) {
      /*  إجاباتُها هي وحدها ترجع — السياسةُ تمنع غيرها — فتُعلَّم
          متى عادت إلى سؤالٍ أجابت عنه. */
      (rows || []).forEach(function (x) { mineBy[+x.q] = +x.choice; });
      onSlide(null);
    });
  }).catch(function () { /* بلا دور: لا شيء */ });
})();
