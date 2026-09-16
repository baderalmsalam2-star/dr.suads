/* ═══ صفحة تسجيل الطالبة — تُفتح من الباركود ═══
   تحفظ الطالبة بياناتها على جهازها، ثم تعرض رمزًا تمسحه الدكتورة. */
(function () {
  "use strict";
  var COURSE = window.COURSE || {};
  var params = new URLSearchParams(location.search);
  var ar = TP.ar;
  var me = null;

  document.getElementById("credit").textContent = COURSE.credit || "";
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
    if (name.length < 3) return TPUI.toast("اكتبي اسمك الكامل.", "bad");
    if (!uid) return TPUI.toast("اكتبي رقمك الجامعي.", "bad");

    var sectionId = sel.value;

    /* ─── على الخادم لا تُكتب الطالبة، ولا حاجة ───
       جدول students لا يُكتب إلا من المالكة (وهذا مقصود: لولاه
       استولت طالبة على صفّ غيرها). وكانت الصفحة تحاول الكتابة
       فيردّ الخادم ٤٠٣، وتُعرض للطالبة — أمام الباركود في أول
       حصة — رسالةٌ تخصّ الدكتورة: «تأكدي أن حسابك في جدول owners».
       والحقيقة أن الصفحة لا تحتاج الكتابة إطلاقًا: الباركود نفسه
       هو ما يحمل الاسم والرقم إلى الدكتورة فتمسحه. */
    if (window.TPAuth) {
      me = { sectionId: sectionId, name: name, uid: uid, self: true };
      return show();
    }

    Store.students(sectionId).then(function (list) {
      var dup = list.filter(function (s) { return s.uid === uid && !s.placeholder; })[0];
      if (dup) { me = dup; return Store.saveStudent({ id: dup.id, name: name, uid: uid }); }
      return Store.saveStudent({
        no: list.length + 1, sectionId: sectionId,
        name: name, uid: uid, active: true, self: true
      });
    }).then(function (saved) {
      me = me && me.id ? Object.assign({}, me, { name: name, uid: uid }) : saved;
      show();
    }).catch(function () {
      TPUI.toast("تعذّر الحفظ على هذا الجهاز. جرّبي من متصفّح آخر، " +
                 "أو أعطي الدكتورة اسمك ورقمك مباشرةً.", "bad");
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

    var line = document.getElementById("done").querySelector(".join-note");
    line.textContent = sec.name + " · الرقم الجامعي " + ar(me.uid) +
      " — اعرضي الرمز على الدكتورة لتضيفك إلى الكشف.";
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
