/* ═══ تسجيل الحضور بمسح الرمز ═══
   تفتحها الطالبة بمسح الرمز المعروض على البروجكتر.

   الصفحة لا تقرّر شيئًا: ترسل الرمز إلى الخادم، والخادم هو الذي
   يعرف أيّ شعبةٍ وأيّ محاضرة (من صفّ الرمز)، ومن الطالبة (من رمز
   الدخول)، وهل الرمز حيٌّ بعد. فلا يُكتب من المتصفّح شيء. */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var state  = document.getElementById("state");
  var detail = document.getElementById("detail");
  var acts   = document.getElementById("acts");
  var code   = new URLSearchParams(location.search).get("c");

  TPUI.credit("credit");
  document.getElementById("kicker").textContent =
    (COURSE.title || "") + (COURSE.instructor ? " · " + COURSE.instructor : "");

  function say(msg, kind, note) {
    state.textContent = msg;
    state.className = "state" + (kind ? " " + kind : "");
    if (note) { detail.textContent = note; detail.hidden = false; }
    else { detail.hidden = true; }
  }

  /*  لا تُمرَّر عودةٌ إلى هنا بعد الدخول: الرمز يموت بعد ثوانٍ،
      فالعودة إليه تقع على رمزٍ ميت. الصواب أن تمسح الرمز الظاهر
      من جديد — وهو ما يُقال لها صراحةً. */
  function offerSignIn() { acts.hidden = false; }

  if (!code) {
    say("لا رمز في الرابط.", "bad",
        "افتحي هذه الصفحة بمسح الرمز المعروض على الشاشة، لا بكتابة العنوان.");
    acts.hidden = false;
    return;
  }

  if (!window.TPAuth) {
    say("تسجيل الحضور بالرمز يعمل مع الخادم فقط.", "bad",
        "هذا الجهاز يعمل في الوضع المحلي. أبلغي الدكتورة لتعلّم حضورك يدويًّا.");
    acts.hidden = false;
    return;
  }

  say("جارٍ تسجيل حضورك…");

  TPAuth.me().then(function (me) {
    if (!me) {
      say("ادخلي بحسابك أولًا.", "bad",
          "الحضور يُسجَّل باسم صاحبة الحساب، فلا بدّ من الدخول. " +
          "ثم امسحي الرمز الظاهر على الشاشة من جديد.");
      offerSignIn();
      return;
    }
    return Store.markByCode(code).then(function () {
      say("سُجِّل حضورك.", "good",
          "تظهر علامتك عند الدكتورة الآن. وإن رأيتِ خلاف ذلك في صفحتك فراجعيها.");
    });
  }).catch(function (e) {
    var m = (e && e.message) || "تعذّر التسجيل.";
    /* رسائل الخادم عربية أصلًا (تأتي من mark_attendance)، فتُعرض كما هي */
    say(m, "bad",
        /انتهت صلاحية/.test(m)
          ? "الرمز يتبدّل كل بضع ثوانٍ. امسحي الرمز الظاهر على الشاشة الآن."
          : "إن تكرّر هذا فأبلغي الدكتورة لتعلّم حضورك يدويًّا.");
    acts.hidden = false;
  });
})();
