/* ═══ الدور: مشرف · مدرِّسة · طالبة ═══
   المنصة تعرف ثلاثة أدوار:

     admin    المشرف التقني — كل ما تراه الدكتورة، وفوقه صفحة الفحص.
     teacher  الدكتورة — التدريس كلّه بلا أدوات التشخيص.
     student  الطالبة — صفّها وحدها.

   على الخادم يأتي الدور من جدول owners ويحرسه Row Level Security.
   وفي الوضع المحلي لا حسابات أصلًا ولا حارس — فالدور هنا ترتيبُ
   واجهةٍ لا حاجز أمان، وهذا مصرَّح به في صفحة الحساب حتى لا يُظنّ
   به ما ليس فيه. */
(function () {
  "use strict";

  var KEY = "tp.role";
  var cached = null;

  function local() {
    try { return localStorage.getItem(KEY) || "teacher"; }
    catch (e) { return "teacher"; }
  }

  window.TPRole = {
    /* يُرجع وعدًا بـ "admin" أو "teacher" أو "student" */
    get: function () {
      if (cached) return Promise.resolve(cached);

      if (!window.TPAuth) {                      /* محلي: بلا حسابات */
        cached = local();
        return Promise.resolve(cached);
      }
      return TPAuth.role().then(function (r) {
        cached = r || "student";              /* نتيجة مؤكَّدة: تُخزَّن */
        return cached;
      }).catch(function () {
        /* تعذّر التحقق ≠ ليست مالكة. لا يُخزَّن شيء، فتُعاد المحاولة
           عند أول سؤالٍ تالٍ بدل تثبيت «طالبة» إلى آخر عمر الصفحة. */
        return "unknown";
      });
    },

    isAdmin: function () {
      return TPRole.get().then(function (r) { return r === "admin"; });
    },

    /* الوضع المحلي وحده — على الخادم يقرّره جدول owners */
    setLocal: function (r) {
      try { localStorage.setItem(KEY, r); } catch (e) { /**/ }
      cached = null;
    },

    /* هل الدور مُحكَم بالخادم أم مجرّد ترتيب واجهة؟ */
    enforced: function () { return !!window.TPAuth; },

    label: function (r) {
      return { admin: "مشرف تقني", teacher: "الدكتورة", student: "طالبة",
               unknown: "تعذّر التحقق" }[r] || "زائرة";
    }
  };
})();
