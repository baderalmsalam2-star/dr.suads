/* ═══ صفحة تسجيل الطالبة — تُفتح من الباركود ═══
   تحفظ الطالبة بياناتها على جهازها، ثم تعرض رمزًا تمسحه الدكتورة. */
(function () {
  "use strict";
  var COURSE = window.COURSE || {};
  var params = new URLSearchParams(location.search);
  var ar = TP.ar;
  var me = null;

  TPUI.credit("credit");
  document.getElementById("kicker").textContent =
    (COURSE.title || "") + " · " + (COURSE.instructor || "");

  /* ─── الشعب ─── */
  var sel = document.getElementById("section");
  var wanted = TP.resolveSection(params);
  TP.sections().forEach(function (s) {
    var o = document.createElement("option");
    o.value = s.id; o.textContent = s.name;
    sel.appendChild(o);
  });
  sel.value = wanted.id;

  /* ─── التسجيل ─── */
  document.getElementById("go").addEventListener("click", function () {
    var name = document.getElementById("name").value.trim().replace(/\s+/g, " ");
    var uid = document.getElementById("uid").value.trim();
    /* الشرط نفسه الذي في join_class على الخادم — يُقال هنا قبل
       الإرسال فلا تُرفض الطالبة بعد الضغط */
    if (name.length < 3 || name.length > 80) {
      return TPUI.toast("اكتبي اسمك الكامل.", "bad");
    }
    if (!/^[0-9]{6,12}$/.test(uid)) {
      return TPUI.toast("الرقم الجامعي أرقام فقط، من ٦ إلى ١٢ خانة.", "bad");
    }

    var sectionId = sel.value;

    /* التسجيل يمرّ من Store.joinClass: محليًّا كتابةٌ مباشرة، وعلى
       الخادم دالةٌ محدودة الصلاحية — والصفحة لا تفرّق. */
    Store.joinClass(sectionId, name, uid).then(function (id) {
      me = { id: id, sectionId: sectionId, name: name, uid: uid, self: true };
      show();
    }).catch(function (e) {
      TPUI.toast(e.message || "تعذّر التسجيل — أعيدي المحاولة.", "bad");
    });
  });

  /* الحمولة التي تمسحها الدكتورة — مفصولة بـ | والاسم مُنقّى منها */
  function payload(s) {
    return ["TPJ1", s.sectionId, String(s.name).replace(/\|/g, "/"), s.uid].join("|");
  }

  function show() {
    var sec = TP.sections().filter(function (s) {
      return String(s.id) === String(me.sectionId);
    })[0] || { name: "" };

    document.getElementById("form").hidden = true;
    document.getElementById("done").hidden = false;
    document.getElementById("who").textContent = me.name;

    var code = payload(me);
    document.getElementById("qr").innerHTML = QR.svg(code);
    document.getElementById("code").textContent = code;
    document.getElementById("mine").href = "student.html?id=" + encodeURIComponent(me.id);

    /* على الخادم صار الصفّ مضافًا فعلًا، فالرمز توثيقٌ لا وسيلةُ
       نقل. وفي الوضع المحلي هو الوسيلة الوحيدة — فيُقال ما يصدق
       على كل حال بدل نصٍّ واحد يكذب في أحدهما. */
    var online = !!(window.TP_CONFIG && TP_CONFIG.url && TP_CONFIG.anonKey);
    var line = document.getElementById("done").querySelector(".join-note");
    line.textContent = sec.name + " · الرقم الجامعي " + ar(me.uid) +
      (online ? " — أُضفتِ إلى كشف الشعبة. احتفظي بالرمز إن طلبته الدكتورة."
              : " — اعرضي الرمز على الدكتورة لتضيفك إلى الكشف.");

    var head = document.querySelector("#done .join-kicker");
    if (head) head.textContent = online ? "أُضفتِ إلى الكشف" : "تم التسجيل";
  }

  document.getElementById("dl").addEventListener("click", function () {
    TPUI.download("tasjeel-sec" + me.sectionId + "-" + me.uid + ".json",
      JSON.stringify({ kind: "tp-join", version: 1, code: payload(me) }));
    TPUI.toast("نُزّل ملف التسجيل — أرسليه للدكتورة.", "good");
  });

  document.getElementById("copy").addEventListener("click", function () {
    var code = payload(me);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code)
        .then(function () { TPUI.toast("نُسخ رمز التسجيل.", "good"); })
        .catch(function () { TPUI.toast("انسخيه من السطر أسفل الرمز.", "bad"); });
    } else {
      TPUI.toast("انسخيه من السطر أسفل الرمز.", "bad");
    }
  });

  document.getElementById("again").addEventListener("click", function () {
    document.getElementById("done").hidden = true;
    document.getElementById("form").hidden = false;
    document.getElementById("name").value = "";
    document.getElementById("uid").value = "";
    me = null;
    document.getElementById("name").focus();
  });
})();
