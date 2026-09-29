/* ═══════════════════════════════════════════════════════════════
   فحصُ الاتصال — تفتحه الطالبة بنفسها.

   «في طالبات مو قادرين يدخلون على المحاضرة، محجوبة عندهم.»

   و«محجوبة» كلمةٌ واحدة تحتها خمسةُ أسبابٍ مختلفة، وعلاجُ كلٍّ
   غيرُ علاج الآخر:

     ١  الشبكةُ تحجب الموقع        ← لا تُفتح هذه الصفحة أصلًا
     ٢  الشبكةُ تحجب الخادم        ← تُفتح الصفحة ولا يُجيب الخادم
     ٣  لم تدخل بحسابها            ← تدخل من صفحة الحساب
     ٤  حسابها غير مربوطٍ بالكشف   ← رقمُها أو بريدُها
     ٥  المحاضرةُ لم تُفتح لها      ← بيد الدكتورة

   وكانت الطالبة تقول «محجوبة» وتقف الدكتورة لا تدري أيَّها هو،
   فتُجرَّب العلاجاتُ كلُّها على التخمين. فهذه الصفحة تسأل الطبقات
   واحدةً واحدة وتقول أين انقطع الحبل — بعبارةٍ تُنسخ وتُرسَل.

   ولا تُخفى عن أحد: من لم تدخل بحساب تفتحها كذلك، وهي أحوجُ
   الناس إليها.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var COURSE = window.COURSE || {};
  var box = document.getElementById("rows");
  var out = document.getElementById("verdict");

  TPUI.chrome(null, "فَحْصُ الِاتِّصَالِ", "لماذا لا تظهر المحاضرة؟");
  TPUI.credit("credit");

  var lines = [];

  var fault = null;
  function row(ok, what, why, how, fail) {
    lines.push((ok ? "✓ " : "✗ ") + what + (why ? " — " + why : ""));
    /*  الخلاصةُ تقول العلّة لا عنوانَ الفحص: «حسابك غير مربوط»
        لا «حسابك مربوطٌ بكشف الشعبة» — فالعنوانُ مكتوبٌ بصيغة
        الإثبات، فإذا رُدِّد في الخلاصة قُرئ نقيضَ ما وقع. */
    if (!ok && !fault) fault = fail || what;
    var d = el("div", "wcheck " + (ok ? "good" : "bad"));
    d.appendChild(el("span", "wmark", ok ? "✓" : "✗"));
    var t = el("div", "wtext");
    t.appendChild(el("b", "", what));
    if (why) t.appendChild(el("div", "wwhy", why));
    if (!ok && how) t.appendChild(el("div", "whow", how));
    d.appendChild(t);
    box.appendChild(d);
    return ok;
  }

  /*  أوّلُ الطبقات مقطوعٌ بها: لو كان الموقعُ محجوبًا لما قُرئ هذا
      السطر أصلًا. فذكرُها ليس حشوًا — هو ما يُخرج السببَ الأول من
      دائرة الشكّ، وبه تعرف الدكتورة أن العلّة بعده لا قبله. */
  function run() {
    box.textContent = "";
    out.textContent = "";
    lines = [];
    fault = null;
    row(true, "الموقع يُفتح على جهازك",
        "هذه الصفحة وصلت، فالشبكةُ لا تحجب المنصة.");

    var cfg = (window.TP_CONFIG || {});
    if (!cfg.url) {
      row(true, "المنصة تعمل على هذا الجهاز بلا خادم", "لا حسابات ولا مزامنة.");
      return done();
    }

    /*  نداءٌ خفيفٌ لا يحتاج حسابًا: يفرّق بين «الخادم محجوب» و
        «لستِ داخلة». وكانا يختلطان فتُقال العلّة الخطأ. */
    var t0 = Date.now();
    fetch(cfg.url + "/auth/v1/health", { method: "GET" })
      .then(function (r) {
        row(true, "الخادم يُجيب", "في " + ar(Date.now() - t0) + " جزءًا من الألف.");
        return next();
      })
      .catch(function () {
        row(false, "الخادم لا يُجيب من شبكتك",
            "الموقعُ يُفتح والخادمُ لا. والغالبُ أن شبكتك تحجبه.",
            "جرّبي بيانات جوّالك بدل الواي-فاي. فإن عملت فالحجبُ من الشبكة.",
            "شبكتك تحجب الخادم");
        done();
      });
  }

  function next() {
    var signed = !!(window.TPAuth && TPAuth.session());
    if (!row(signed, "أنتِ داخلةٌ بحسابك", signed ? "" : "لم تدخلي بعد.",
             "افتحي «الحساب» وادخلي ببريدك الجامعي.",
             "لم تدخلي بحسابك")) return done();

    return Store.students().then(function (rows) {
      var me = (rows || [])[0];
      if (!row(!!me, "حسابك مربوطٌ بكشف الشعبة",
               me ? "أنتِ في الكشف." : "الكشفُ لا يعرف حسابك.",
               "تأكّدي أنكِ دخلتِ ببريدك الجامعي (sرقمك@ku.edu.kw). " +
               "فإن كان كذلك فرقمك لم يُضَف بعد — راجعي الدكتورة.",
               "حسابك غير مربوطٍ بكشف الشعبة")) return done();

      return TPContent.ready().then(function () {
        var all = (COURSE.sessions || []).filter(function (s) {
          return s.status === "ready" && s.file;
        });
        var open = all.filter(function (s) {
          return TPContent.get((COURSE.id || "course") + ":s" + s.n, "released") === "1";
        });
        row(open.length > 0,
            "المحاضراتُ المفتوحة لكِ: " + ar(open.length) + " من " + ar(all.length),
            open.length ? open.map(function (s) { return "م" + ar(s.n); }).join(" · ")
                        : "لم تُفتح لكِ محاضرةٌ بعد.",
            "المحاضرةُ لا تظهر حتى تفتحها الدكتورة — أبلغيها.",
            "لم تُفتح لكِ محاضرةٌ بعد");
        done();
      });
    }).catch(function (e) {
      row(false, "تعذّر سؤالُ الخادم عن كشفك", e && e.message ? e.message : "",
          "أعيدي الفحص، فإن تكرّر فأرسلي هذه النتيجة للدكتورة.",
          "تعذّر سؤالُ الخادم");
      done();
    });
  }

  function done() {
    out.textContent = "";
    out.appendChild(TPUI.empty(
      fault ? "العلّة: " + fault : "لا انقطاع — كلُّ الطبقات سليمة.",
      fault ? "اضغطي «انسخي النتيجة» وأرسليها للدكتورة."
            : "فإن كانت المحاضرة لا تظهر فأبلغي الدكتورة بهذه النتيجة."));
  }

  document.getElementById("again").addEventListener("click", run);
  document.getElementById("copy").addEventListener("click", function () {
    var txt = "فحص الاتصال — " + new Date().toLocaleString("ar") + "\n" + lines.join("\n");
    /*  الحافظةُ تُمنع في سياقٍ غير آمنٍ وفي بعض المتصفّحات، فيُعرض
        النصُّ لتنسخه بيدها بدل أن يُقال «نُسخ» ولم يُنسخ. */
    var ok = navigator.clipboard && navigator.clipboard.writeText;
    if (ok) {
      navigator.clipboard.writeText(txt)
        .then(function () { TPUI.toast("نُسخت — ألصقيها في رسالةٍ للدكتورة.", "good"); })
        .catch(function () { show(txt); });
    } else show(txt);
  });

  function show(txt) {
    var ta = document.createElement("textarea");
    ta.className = "wcopy";
    ta.readOnly = true;
    ta.value = txt;
    out.appendChild(ta);
    ta.select();
    TPUI.toast("انسخي النصّ من الصندوق.", "bad");
  }

  run();
})();
