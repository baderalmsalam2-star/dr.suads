/* ═══ الدخول ونقل البيانات المحلية إلى الخادم ═══ */
(function () {
  "use strict";
  var COURSE = window.COURSE || {};
  var ar = TP.ar;
  document.getElementById("credit").textContent = COURSE.credit || "";
  document.getElementById("kicker").textContent = COURSE.title || "";

  var state = document.getElementById("state");

  /* بلا إعداد خادم: المنصة محلية */
  if (!window.TPAuth) {
    document.getElementById("offline").hidden = false;
    document.getElementById("title").textContent = "بلا خادم";
    state.textContent = "";
    return;
  }

  TPAuth.captureFromUrl();                  /* العودة من رابط البريد */

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
      if (!me) { TPAuth.signOut(); return refresh(); }
      state.textContent = "";
      document.getElementById("form").hidden = true;
      document.getElementById("who").hidden = false;
      document.getElementById("title").textContent = "أنتِ داخلة";
      document.getElementById("whoText").textContent = me.email +
        (owner ? " — صلاحية كاملة (مالكة)." :
                 " — حساب طالبة. إن كنتِ الدكتورة فأضيفي معرّفك في جدول owners.");
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

  document.getElementById("go").addEventListener("click", function () {
    var email = document.getElementById("email").value.trim();
    var pass = document.getElementById("pass").value;
    if (!email || !pass) return TPUI.toast("اكتبي البريد وكلمة السر.", "bad");
    state.textContent = "جارٍ الدخول…";
    TPAuth.signIn(email, pass).then(refresh).catch(function (e) {
      state.textContent = "";
      TPUI.toast(e.message || "تعذّر الدخول.", "bad");
    });
  });

  document.getElementById("link").addEventListener("click", function () {
    var email = document.getElementById("email").value.trim();
    if (!email) return TPUI.toast("اكتبي بريدك أولًا.", "bad");
    var back = location.href.split("#")[0];
    TPAuth.sendLink(email, back).then(function () {
      TPUI.toast("أُرسل رابط الدخول إلى بريدك.", "good");
      state.textContent = "افتحي بريدك واضغطي الرابط، ثم ارجعي إلى هذه الصفحة.";
    }).catch(function (e) { TPUI.toast(e.message || "تعذّر الإرسال.", "bad"); });
  });

  document.getElementById("out").addEventListener("click", function () {
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

  refresh();
})();
