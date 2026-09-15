/* ═══ عناصر مشتركة بين صفحات المنصة (غير صفحات العرض) ═══ */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var ar = window.TP.ar;

  var PAGES = [
    { id: "home",       label: "الرئيسية",     href: "index.html" },
    { id: "students",   label: "الطالبات",     href: "students.html" },
    { id: "register",   label: "الباركود",     href: "register.html" },
    { id: "attendance", label: "الحضور",       href: "attendance.html" },
    { id: "worksheets", label: "أوراق العمل",  href: "worksheets.html" },
    { id: "grades",     label: "الدرجات",      href: "grades.html" },
    { id: "honors",     label: "لوحة الشرف",   href: "honors.html" },
    { id: "compose",    label: "مُنشئ الحصص",  href: "compose.html" },
    { id: "login",      label: "الحساب",       href: "login.html" }
  ];

  var AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو",
                   "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  var AR_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* YYYY-MM-DD ← «الأحد ٥ سبتمبر ٢٠٢٦» */
  function arDate(day) {
    var p = String(day).split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (isNaN(d)) return day;
    return AR_DAYS[d.getDay()] + " " + ar(d.getDate()) + " " +
           AR_MONTHS[d.getMonth()] + " " + ar(d.getFullYear());
  }

  function arMonth(month) {
    var p = String(month).split("-");
    return AR_MONTHS[+p[1] - 1] + " " + ar(p[0]);
  }

  /* ترويسة موحّدة: العنوان + شريط التنقل */
  function chrome(activeId, title, subtitle) {
    var head = document.getElementById("chrome");
    if (!head) return;

    var mast = el("header", "masthead");
    mast.appendChild(el("div", "kicker", "منصة التدريس"));
    mast.appendChild(el("h1", "", title || COURSE.title || ""));
    if (subtitle !== null) {
      mast.appendChild(el("div", "who", subtitle || COURSE.instructor || ""));
    }
    head.appendChild(mast);

    var nav = el("nav", "nav-main");
    nav.setAttribute("aria-label", "أقسام المنصة");
    PAGES.forEach(function (p) {
      var a = el("a", p.id === activeId ? "on" : "", p.label);
      a.href = p.href;
      if (p.id === activeId) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
    /* مبدّل الألوان في طرف الشريط — يظهر إن كان theme.js محمَّلًا */
    if (window.TPTheme) nav.appendChild(TPTheme.picker());
    head.appendChild(nav);
  }

  /* قائمة اختيار الشعبة — تحفظ الاختيار وتنادي onChange */
  function sectionPicker(select, onChange) {
    var params = new URLSearchParams(location.search);
    var current = window.TP.resolveSection(params);

    window.TP.sections().forEach(function (s) {
      var o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.name;
      select.appendChild(o);
    });
    select.value = current.id;
    window.TP.rememberSection(current.id);

    select.addEventListener("change", function () {
      current = window.TP.sections().filter(function (s) {
        return String(s.id) === select.value;
      })[0];
      window.TP.rememberSection(current.id);
      onChange(current);
    });
    return current;
  }

  /* رسالة عابرة أعلى الصفحة */
  var toastEl = null, toastTimer = null;
  function toast(msg, kind) {
    if (!toastEl) {
      toastEl = el("div", "toast");
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.className = "toast on" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = "toast"; }, 3200);
  }

  /* حالة فارغة موحّدة */
  function empty(text, hint) {
    var box = el("div", "empty");
    box.appendChild(el("p", "", text));
    if (hint) box.appendChild(el("p", "hint", hint));
    return box;
  }

  /* المتصفحات تُسقط أسماء الملفات غير اللاتينية من روابط blob
     وتُسمّيها "download"، فيُبنى الاسم بحروف لاتينية دائمًا.
     اسم الطالبة العربي محفوظ داخل الملف نفسه لا في اسمه. */
  function safeName(name) {
    var out = String(name).replace(/[^\x20-\x7E]+/g, "-")
                          .replace(/[\\/:*?"<>|]+/g, "-")
                          .replace(/-{2,}/g, "-")
                          .replace(/^-|-$/g, "");
    return out || "file";
  }

  /* تنزيل نص كملف — التسليم والنسخ الاحتياطي */
  function download(filename, text, mime) {
    filename = safeName(filename);
    var blob = new Blob([text], { type: (mime || "application/json") + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* قراءة ملف اختاره المستخدم كنص */
  function readAsText(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.readAsText(file);
    });
  }

  function readAsDataURL(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(file);
    });
  }

  /* مطابقة العدد للمعدود في العربية:
       ١ مفرد · ٢ مثنى · ٣–١٠ جمع · ١١ فأكثر مفرد منصوب.
     forms = [مفرد, مثنى, جمع, تمييز] */
  function count(n, forms) {
    if (n === 1) return forms[0];
    if (n === 2) return forms[1];
    if (n >= 3 && n <= 10) return ar(n) + " " + forms[2];
    return ar(n) + " " + forms[3];
  }

  var POINTS   = ["نقطة واحدة", "نقطتان", "نقاط", "نقطة"];
  var STUDENTS = ["طالبة واحدة", "طالبتان", "طالبات", "طالبة"];
  var SHARES   = ["مشاركة واحدة", "مشاركتان", "مشاركات", "مشاركة"];
  var QS       = ["سؤال واحد", "سؤالان", "أسئلة", "سؤالًا"];
  var SLIDES   = ["شريحة واحدة", "شريحتان", "شرائح", "شريحة"];
  var CODES    = ["رمز واحد", "رمزان", "رموز", "رمزًا"];
  var LESSONS  = ["حصة واحدة", "حصتان", "حصص", "حصة"];
  var READS    = ["شريحة قراءة", "شريحتا قراءة", "شرائح قراءة", "شريحة قراءة"];
  var SHEETS   = ["ورقة عمل واحدة", "ورقتا عمل", "أوراق عمل", "ورقة عمل"];

  function bytes(n) {
    if (n < 1024) return ar(n) + " بايت";
    if (n < 1048576) return ar(Math.round(n / 1024)) + " ك.ب";
    return ar((n / 1048576).toFixed(1)) + " م.ب";
  }

  window.TPUI = {
    el: el, chrome: chrome, sectionPicker: sectionPicker, toast: toast,
    empty: empty, download: download, readAsText: readAsText,
    readAsDataURL: readAsDataURL, arDate: arDate, arMonth: arMonth, bytes: bytes,
    count: count, safeName: safeName,
    points:   function (n) { return count(n, POINTS); },
    students: function (n) { return count(n, STUDENTS); },
    shares:   function (n) { return count(n, SHARES); },
    questions:function (n) { return count(n, QS); },
    slides:   function (n) { return count(n, SLIDES); },
    codes:    function (n) { return count(n, CODES); },
    lessons:  function (n) { return count(n, LESSONS); },
    reads:    function (n) { return count(n, READS); },
    sheets:   function (n) { return count(n, SHEETS); }
  };
})();
