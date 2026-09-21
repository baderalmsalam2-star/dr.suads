/* ═══════════════════════════════════════════════════════════════
   الاختبارات — صفحتها وحدها.

   كانت فوق أوراق العمل في الصفحة نفسها، فتراها الطالبةُ متى فتحت
   أوراقها. وبينهما فرقٌ في المعنى لا في الشكل: أوراق العمل تقويمٌ
   تكوينيّ لا درجة عليه — تُحلّ لتتبيّن الطالبةُ مواضع اللبس —
   والاختبارُ عشرون درجة. فخلطُهما في صفحةٍ يخلط المعنيين.

   ═══ ولا يظهر الاختبار للطالبة حتى يُفتح ═══
   كالمحاضرات: زرٌّ تضغطه الدكتورة يوم الاختبار. وقبل ذلك لا تراه
   ولا تعرف أنه ثَمّ — فلا تقرأ أسئلتَه قبل أوانها.

   وهذا ترتيبُ عرضٍ لا حاجزُ أمان: صفحة exam.html ساكنةٌ على نشرةٍ
   علنيّة. والذي يحرس الدرجات والتسليمات هو RLS في الخادم.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var EXAMS = window.EXAMS || [];
  var el = TPUI.el, ar = TP.ar;

  document.title = "الاختبارات — " + (COURSE.title || "منصة التدريس");
  TPUI.chrome("exams", COURSE.title, "الاختبارات الرسمية");
  TPUI.credit("credit");

  var box = document.getElementById("exams");
  var staff = false, open = {};

  var section = TPUI.sectionPicker(document.getElementById("section"), function (s) {
    section = s; paint();
  });

  function refOf(x) { return (COURSE.id || "course") + ":x" + x.id; }

  function paint() {
    box.textContent = "";
    if (!EXAMS.length) {
      box.appendChild(TPUI.empty("لا اختبارات في هذا المقرر.",
        "تُكتب في data/courses/<المقرر>/exams.js"));
      return;
    }

    var ul = el("ul", "cards exam-cards");
    EXAMS.forEach(function (x) {
      var shown = open[x.id] === "1";
      var li = el("li", "card ready exam");
      li.appendChild(el("span", "badge", shown ? "مفتوح للطالبات" : "مغلق"));

      var a = el("a", "open");
      a.href = "exam.html?x=" + encodeURIComponent(x.id) +
               "&section=" + encodeURIComponent(section.id);
      a.appendChild(el("span", "no", "اختبار رسميّ"));
      a.appendChild(el("h2", "", x.title));
      if (x.scope) a.appendChild(el("div", "sub", x.scope));
      var meta = el("div", "meta");
      meta.appendChild(el("span", "", x.date ? TPUI.arDate(x.date) : ""));
      meta.appendChild(el("span", "readers",
        ar(x.minutes) + " دقيقة، " + ar(x.forms) + " نماذج"));
      a.appendChild(meta);
      li.appendChild(a);

      if (staff) {
        var b = el("button", "sm " + (shown ? "ghost" : "gold"),
                  shown ? "مفتوح للطالبات — أغلقيه" : "افتحيه للطالبات");
        b.addEventListener("click", function () {
          b.disabled = true;
          var next = shown ? "" : "1";
          TPContent.set(refOf(x), "released", next).then(function () {
            open[x.id] = next;
            paint();
            TPUI.toast(next ? "فُتح الاختبار — صار يظهر في صفحة الطالبة."
                            : "أُغلق — لم يعد يظهر لهنّ.", "good");
          }).catch(function (e) {
            b.disabled = false;
            TPUI.toast(e.message || "تعذّر الحفظ.", "bad");
          });
        });
        li.appendChild(b);
      }
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  TPRole.staff().then(function (ok) {
    staff = !!ok;
    if (!staff) {
      /*  الصفحة ليست في شريط الطالبة أصلًا، فمن كتب عنوانها بيده
          لم يجد فيها إلا ما فُتح له. */
      box.textContent = "";
      box.appendChild(TPUI.empty("هذه الصفحة للدكتورة.",
        "الاختبار المفتوح يظهر لكِ في الصفحة الرئيسية."));
      return;
    }
    return (window.TPContent ? TPContent.ready() : Promise.resolve())
      .then(function () {
        if (!window.TPContent) return;
        EXAMS.forEach(function (x) {
          open[x.id] = TPContent.get(refOf(x), "released") || "";
        });
      }).then(paint);
  }).catch(function () { paint(); });
})();
