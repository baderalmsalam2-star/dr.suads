/* ═══ الدخول ونقل البيانات المحلية إلى الخادم ═══ */
(function () {
  "use strict";
  var COURSE = window.COURSE || {};
  var ar = TP.ar;
  TPUI.credit("credit");
  document.getElementById("kicker").textContent = COURSE.title || "";

  var state = document.getElementById("state");

  /* بلا إعداد خادم: المنصة محلية */
  if (!window.TPAuth) {
    document.getElementById("offline").hidden = false;
    document.getElementById("title").textContent = "المنصة محليّة الآن";
    state.textContent = "";
    return;
  }

  /* العودة من رابط البريد أو من صفحة الجامعة */
  var returning = TPAuth.captureFromUrl();
  if (returning) {
    state.textContent = "جارٍ إتمام الدخول…";
    returning.then(function () { refresh(); })
             .catch(function (e) {
               state.textContent = "";
               TPUI.toast(e.message || "تعذّر إتمام الدخول.", "bad");
               refresh();
             });
  }

  /*  لا زرَّ «الدخول بحساب الجامعة» بعد اليوم.
      كان يتطلّب ربط هوية الجامعة (Entra) بالمشروع، وهو إذنٌ من مركز
      النظم لا يُنتظر. وطريقٌ واحدٌ يعمل خيرٌ من طريقين أحدهما يخذل.
      والدالّة باقيةٌ في المحوّل لمن أراد تفعيلها لاحقًا. */

  function show(id) {
    ["form", "who", "migrate", "offline"].forEach(function (k) {
      document.getElementById(k).hidden = k !== id && k !== "migrate";
    });
    document.getElementById(id).hidden = false;
  }

  function refresh() {
    state.textContent = "جارٍ التحقق…";
    if (!TPAuth.session()) {
      state.textContent = "";
      document.getElementById("who").hidden = true;
      document.getElementById("migrate").hidden = true;
      document.getElementById("form").hidden = false;
      return;
    }
    Promise.all([TPAuth.me(), TPAuth.isOwner()]).then(function (r) {
      var me = r[0], owner = r[1];
      if (!me) { TPRole.forget(); TPAuth.signOut(); return refresh(); }
      state.textContent = "";
      document.getElementById("form").hidden = true;
      document.getElementById("who").hidden = false;
      document.getElementById("title").textContent = "أنتِ داخلة";
      if (owner) {
        document.getElementById("whoText").textContent =
          me.email + " — صلاحية كاملة (مالكة).";
        checkLocal();
        return;
      }
      /* حساب طالبة: هل ارتبط بصفّ؟
         والصفوف قد تكون أكثر من واحد — صفٌّ في كل مقرر تدرسه. */
      Store.students().then(function (rows) {
        document.getElementById("whoText").textContent = rows && rows.length
          ? me.email + " — حساب " + rows[0].name +
            (rows.length > 1 ? " · مرتبط بـ" + TPUI.count(rows.length,
              ["مقرر واحد", "مقررين", "مقررات", "مقررًا"]) : "") + "."
          : me.email + " — الحساب سليم، لكنه غير مرتبط بصفّ في الكشف بعد. " +
            "إن كنتِ طالبة فأبلغي الدكتورة لتضيفك، وسيرتبط حسابك تلقائيًا. " +
            "وإن كنتِ الدكتورة فأضيفي معرّفك في جدول owners.";
      }).catch(function () {
        document.getElementById("whoText").textContent = me.email + " — حساب طالبة.";
      });
      checkLocal();
    }).catch(function (e) {
      state.textContent = e.message || "تعذّر التحقق.";
    });
  }

  /* بيانات محلية لم تُرفع؟ */
  function checkLocal() {
    var local = readLocal();
    var n = local.students.length + local.events.length +
            local.attendance.length + local.submissions.length;
    if (!n) return;
    document.getElementById("migrate").hidden = false;
    document.getElementById("migState").textContent =
      "على هذا الجهاز " + TPUI.students(local.students.length) + " و" +
      ar(local.attendance.length) + " سجل حضور و" + ar(local.events.length) + " سجل تفاعل.";
  }

  function readLocal() {
    function get(k) {
      try { return JSON.parse(localStorage.getItem("tp.v1." + k) || "[]"); }
      catch (e) { return []; }
    }
    function obj(k) {
      try { return JSON.parse(localStorage.getItem("tp.v1." + k) || "{}"); }
      catch (e) { return {}; }
    }
    return { students: get("students"), events: get("events"),
             attendance: get("attendance"), submissions: get("submissions"),
             schedule: obj("schedule") };
  }

  /*  زرٌّ واحد لا زرّان.
      الطالبة لا تعرف أَلَها حسابٌ أم لا، ولا ينبغي أن تُسأل. فيُجرَّب
      الدخول أولًا، فإن قال الخادم «بياناتٌ غير صحيحة» فأحد أمرين:
      لا حساب لها — فيُنشأ ويُدخل به في النفس ذاته — أو كلمة السر
      خطأ، وحينئذٍ يردّ إنشاءُ الحساب بأن البريد مسجَّل، فنقولها لها
      صريحة. وهكذا لا تُرسَل رسالةُ بريدٍ واحدة. */
  function enter() {
    var email = document.getElementById("email").value.trim();
    var pass = document.getElementById("pass").value;
    if (!email || !pass) return TPUI.toast("اكتبي البريد وكلمة السر.", "bad");
    if (pass.length < 6) return TPUI.toast("كلمة السر ستّة أحرف فأكثر.", "bad");

    var btn = document.getElementById("go");
    btn.disabled = true;
    state.textContent = "جارٍ الدخول…";

    function done() { btn.disabled = false; }
    function fail(msg) { done(); state.textContent = ""; TPUI.toast(msg, "bad"); }

    TPAuth.signIn(email, pass)
      .then(function () { done(); refresh(); })
      .catch(function (e) {
        var m = e && e.message || "";
        /*  ليست «بيانات غير صحيحة»؟ عطلٌ آخر — لا يُنشأ حسابٌ عليه. */
        if (!/Invalid login|invalid_grant|غير صحيح/i.test(m)) {
          return fail(m || "تعذّر الدخول.");
        }
        state.textContent = "أول مرة — جارٍ إنشاء حسابك…";
        TPAuth.signUp(email, pass)
          .then(function () { done(); refresh(); })
          .catch(function (e2) {
            if (e2 && e2.exists) return fail("كلمة السر غير صحيحة.");
            fail(e2 && e2.message || "تعذّر إنشاء الحساب.");
          });
      });
  }

  document.getElementById("go").addEventListener("click", enter);
  /*  «إنتر» من حقل كلمة السر يدخل — أسرع على الجوال من تحسّس الزر. */
  document.getElementById("pass").addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") enter();
  });

  /* ─── تغيير كلمة السر وهي داخلة ───
     لا رسالةَ بريدٍ ولا رابط: الحساب مفتوحٌ أمامها، ورمزُها يكفي
     لتبديل كلمتها. وهذا هو الطريق الذي تسلكه من أعادت الدكتورة
     تعيين كلمتها: تدخل بالمؤقّتة ثم تكتب واحدةً من عندها. */
  var pwBox = document.getElementById("pwBox");
  document.getElementById("pwToggle").addEventListener("click", function () {
    pwBox.hidden = !pwBox.hidden;
    if (!pwBox.hidden) document.getElementById("pw1").focus();
  });

  function savePassword() {
    var a = document.getElementById("pw1").value;
    var b = document.getElementById("pw2").value;
    var st = document.getElementById("pwState");
    if (a.length < 8) return TPUI.toast("كلمة السر ثمانية أحرف فأكثر.", "bad");
    if (a !== b) return TPUI.toast("الكلمتان غير متطابقتين.", "bad");
    var btn = document.getElementById("pwGo");
    btn.disabled = true;
    st.textContent = "جارٍ الحفظ…";
    TPAuth.changePassword(a).then(function () {
      btn.disabled = false;
      st.textContent = "";
      document.getElementById("pw1").value = "";
      document.getElementById("pw2").value = "";
      pwBox.hidden = true;
      TPUI.toast("بُدّلت كلمة السر. استعمليها في الدخول القادم.", "good");
    }).catch(function (e) {
      btn.disabled = false;
      st.textContent = "";
      TPUI.toast(e.message || "تعذّر تغيير كلمة السر.", "bad");
    });
  }

  document.getElementById("pwGo").addEventListener("click", savePassword);
  document.getElementById("pw2").addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") savePassword();
  });

  document.getElementById("out").addEventListener("click", function () {
    /*  يُنسى الدور مع الجلسة: لو خرجت الدكتورة ودخلت طالبةٌ على
        الجهاز نفسه، لم يبقَ ظنُّ الجهاز أنه لمدرِّسة. */
    TPRole.forget();
    TPAuth.signOut().then(refresh);
  });

  /* ─── رفع البيانات المحلية ─── */
  document.getElementById("push").addEventListener("click", function () {
    if (!confirm("رفع بيانات هذا الجهاز إلى الخادم؟ الموجود على الخادم بنفس المعرّف يُحدَّث.")) return;
    var local = readLocal();
    var btn = this;
    btn.disabled = true;
    var mig = document.getElementById("migState");

    /* الطالبات أولًا: بقية الجداول تشير إليهن */
    var chain = local.students.reduce(function (p, s) {
      return p.then(function () { return Store.saveStudent(s); });
    }, Promise.resolve());

    chain = chain.then(function () {
      mig.textContent = "رُفع الكشف. جارٍ رفع الحضور…";
      return local.attendance.reduce(function (p, a) {
        return p.then(function () { return Store.markAttendance(a); });
      }, Promise.resolve());
    }).then(function () {
      mig.textContent = "رُفع الحضور. جارٍ رفع التفاعل…";
      return local.events.reduce(function (p, e) {
        return p.then(function () { return Store.addEvent(e); });
      }, Promise.resolve());
    }).then(function () {
      mig.textContent = "رُفع التفاعل. جارٍ رفع التسليمات…";
      return local.submissions.reduce(function (p, s) {
        return p.then(function () { return Store.saveSubmission(s); });
      }, Promise.resolve());
    }).then(function () {
      return Object.keys(local.schedule).reduce(function (p, sec) {
        return p.then(function () { return Store.setSchedule(sec, local.schedule[sec]); });
      }, Promise.resolve());
    }).then(function () {
      mig.textContent = "تم الرفع كاملًا.";
      TPUI.toast("رُفعت بيانات هذا الجهاز إلى الخادم.", "good");
      btn.disabled = false;
    }).catch(function (e) {
      mig.textContent = "توقّف الرفع: " + (e.message || "خطأ");
      TPUI.toast(e.message || "تعذّر الرفع.", "bad");
      btn.disabled = false;
    });
  });

  if (!returning) refresh();
})();
