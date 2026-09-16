/* ═══ باركود التسجيل — يُعرض على البروجكتر أول يوم ═══ */
(function () {
  "use strict";
  var COURSE = window.COURSE || {};
  var KEY = "tp.baseUrl";

  TPUI.chrome("register", "باركود التسجيل", "يُعرض على الطالبات في أول محاضرة");
  TPUI.credit("credit");

  var section = TPUI.sectionPicker(document.getElementById("section"), function (s) {
    section = s; draw();
  });

  var urlBox = document.getElementById("urlBox");
  var baseInput = document.getElementById("baseUrl");

  /* العنوان: من المتصفح إن كانت الصفحة تُقدَّم عبر خادم، وإلا من إعداد محفوظ */
  function stored() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }

  function base() {
    if (location.protocol === "http:" || location.protocol === "https:") {
      return location.origin + location.pathname.replace(/register\.html$/, "");
    }
    var s = stored();
    return s ? s.replace(/\/?$/, "/") : "";
  }

  if (location.protocol === "file:") {
    urlBox.hidden = false;
    baseInput.value = stored();
  }

  document.getElementById("saveUrl").addEventListener("click", function () {
    var v = baseInput.value.trim();
    if (v && !/^https?:\/\//i.test(v)) v = "http://" + v;
    try { localStorage.setItem(KEY, v); } catch (e) {}
    TPUI.toast(v ? "حُفظ العنوان." : "أُزيل العنوان.", "good");
    draw();
  });

  document.getElementById("print").addEventListener("click", function () { window.print(); });
  document.getElementById("full").addEventListener("click", function () {
    var el = document.getElementById("stage");
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen();
  });

  function draw() {
    document.getElementById("kicker").textContent =
      (COURSE.title || "") + " · " + section.name;

    var url = base();
    var box = document.getElementById("qr");
    var shown = document.getElementById("shownUrl");

    if (!url) {
      box.innerHTML = "";
      box.style.background = "transparent";
      shown.textContent = "لم يُحدَّد عنوان المنصة بعد — اكتبيه في الحقل أعلاه.";
      return;
    }
    box.style.background = "#fff";
    var target = url + "join.html?section=" + encodeURIComponent(section.id);
    box.innerHTML = QR.svg(target, { dark: "#002856", light: "#ffffff" });
    shown.textContent = target;
  }

  draw();
})();
