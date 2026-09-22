/* ═══ عناصر مشتركة بين صفحات المنصة (غير صفحات العرض) ═══ */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var ar = window.TP.ar;

  /*  الشريط بحسب من ينظر.
      كانت الطالبة ترى كشف الطالبات والدرجات ومُنشئ المحاضرات وصفحة
      الفحص — أبوابًا لا تخصّها، ولا تفتح لها شيئًا لأن RLS يردّها،
      لكنها تُشغل نظرها وتوحي أن ثمّ ما تفوته.
      staff: للدكتورة والمشرف. admin: للمشرف وحده.
      وما دونهما يراه الجميع — الطالبةُ لا ترى غيره.

      وهذا ترتيبُ واجهةٍ لا حاجزُ أمان: الحاجز في الخادم، وقد قيس
      بمئةٍ وسبعةٍ وأربعين محاولةَ اختراق. فلو كتبت الطالبة عنوان
      صفحةٍ بيدها فُتحت لها فارغةً، لأن السياسات تمنع بياناتها لا
      القائمة. */
  var PAGES = [
    { id: "home",       label: "الرئيسية",     href: "index.html" },
    { id: "students",   label: "الطالبات",     href: "students.html",  staff: true },
    { id: "register",   label: "الباركود",     href: "register.html",  staff: true },
    { id: "attendance", label: "الحضور",       href: "attendance.html", staff: true },
    { id: "worksheets", label: "أوراق العمل",  href: "worksheets.html" },
    /*  الاختبارات للدكتورة وحدها: الطالبةُ لا ترى بابًا إليها. وما
        فُتح منها يظهر لها في الصفحة الرئيسية مع محاضراتها. */
    { id: "exams",      label: "الاختبارات",   href: "exams.html",     staff: true },
    { id: "grades",     label: "الدرجات",      href: "grades.html",    staff: true },
    { id: "honors",     label: "لوحة الشرف",   href: "honors.html",    staff: true },
    { id: "evidences",  label: "الأدلة",        href: "evidences.html" },
    /*  أعمال الطالبات: الطالبة ترفع فيها عملها، والدكتورة تعرضه.
        فالباب لهما معًا — ولكلٍّ ما يخصّه داخل الصفحة. */
    { id: "works",      label: "الأعمال",       href: "works.html" },
    { id: "compose",    label: "مُنشئ المحاضرات",  href: "compose.html", staff: true },
    { id: "login",      label: "الحساب",       href: "login.html" },
    { id: "demo",       label: "عرض تجريبي",   href: "demo.html",      staff: true },
    { id: "admin",      label: "الفحص",        href: "admin.html",     admin: true }
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

  /* ─── مبدّل المقرر ───
     يظهر في الترويسة متى سُجِّل أكثر من مقرر، ويختفي ما دام المقرر
     واحدًا — كقائمة الشعب سواء بسواء. والتبديل يُعيد تحميل الصفحة
     بـ ?course=، لأن بيانات المقرر تُنتخب مرةً عند التحميل: إعادة
     بنائها في مكانها تترك نصف الصفحة على المقرر السابق. */
  function coursePicker() {
    var all = (window.TP && TP.courses) ? TP.courses() : [];
    if (all.length < 2) return null;

    var box = el("div", "course-picker");
    var lab = el("label", "", "المقرر");
    var sel = document.createElement("select");
    sel.id = "coursePick";
    lab.htmlFor = sel.id;

    all.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.short || c.title || c.id;
      sel.appendChild(o);
    });
    sel.value = COURSE.id || all[0].id;

    sel.addEventListener("change", function () {
      if (!TP.setCourse(sel.value)) return;
      var u = new URL(location.href);
      u.searchParams.set("course", sel.value);
      u.searchParams.delete("section");   /* شعبة المقرر السابق لا وجود لها هنا */
      location.href = u.toString();
    });

    box.appendChild(lab);
    box.appendChild(sel);
    return box;
  }

  /* ترويسة موحّدة: العنوان + شريط التنقل */
  /*  كتلٌ في جسم الصفحة تخصّ الدكتورة وحدها — تُوسم data-staff
      في HTML فتُخفى حتى يُعرف الدور. والشريط وحده لا يكفي: الطالبة
      كانت ترى «لوحة شرف اليوم» فارغةً وتعليمةً تقول «افتحي عرض
      المحاضرة واضغطي م» وهي ليست لها. */
  function revealStaff() {
    var nodes = document.querySelectorAll("[data-staff]");
    if (!nodes.length) return;
    var hint = window.TPRole ? TPRole.hint() : "teacher";
    function apply(role) {
      var show = role === "admin" || role === "teacher";
      for (var i = 0; i < nodes.length; i++) nodes[i].hidden = !show;
    }
    if (hint) apply(hint);
    (window.TPRole ? TPRole.get() : Promise.resolve("teacher")).then(function (r) {
      if (r !== "unknown") apply(r);
    });
  }

  /*  شريطُ أدواتٍ خلا من أدواته يبقى إطارًا فارغًا على الشاشة.
      يقع هذا عند الطالبة: قائمةُ الشعب تُخفى بشعبةٍ واحدة، وبقيةُ
      ما فيه للدكتورة. فيُطوى الشريط نفسه متى لم يبقَ فيه ظاهر. */
  function tidyBars() {
    var bars = document.querySelectorAll(".control");
    for (var i = 0; i < bars.length; i++) {
      var bar = bars[i], live = false;
      var kids = bar.children;
      for (var j = 0; j < kids.length; j++) {
        var k = kids[j];
        if (k.hidden || k.classList.contains("spacer")) continue;
        if (k.offsetWidth || k.offsetHeight || (k.textContent || "").trim()) { live = true; break; }
      }
      bar.hidden = !live;
    }
  }

  function chrome(activeId, title, subtitle) {
    var head = document.getElementById("chrome");
    if (!head) return;

    var mast = el("header", "masthead");
    var pick = coursePicker();
    if (pick) {
      var top = el("div", "mast-top");
      top.appendChild(el("div", "kicker", "منصة التدريس"));
      top.appendChild(pick);
      mast.appendChild(top);
    } else {
      mast.appendChild(el("div", "kicker", "منصة التدريس"));
    }
    mast.appendChild(el("h1", "", title || COURSE.title || ""));
    if (subtitle !== null) {
      mast.appendChild(el("div", "who", subtitle || COURSE.instructor || ""));
    }
    head.appendChild(mast);

    var nav = el("nav", "nav-main");
    nav.setAttribute("aria-label", "أقسام المنصة");
    /*  الدور يُسأل مرةً واحدة لكل الروابط، لا مرةً لكلٍّ منها. */
    var hint = window.TPRole ? TPRole.hint() : "teacher";
    var asked = window.TPRole ? TPRole.get() : Promise.resolve("teacher");

    function allowed(p, role) {
      if (p.admin) return role === "admin";
      if (p.staff) return role === "admin" || role === "teacher";
      return true;
    }

    PAGES.forEach(function (p) {
      var a = el("a", p.id === activeId ? "on" : "", p.label);
      a.href = p.href;
      if (p.id === activeId) a.setAttribute("aria-current", "page");

      if (p.admin || p.staff) {
        /*  أول رسمٍ على آخر دورٍ عُرف على هذا الجهاز. وإن لم يُعرف
            بعد — أول زيارة — فالأصل الإخفاء: أن ينكشف للدكتورة بعد
            لحظة أهونُ من أن ينكشف للطالبة ثم يُسحب. */
        a.hidden = !(hint && allowed(p, hint));
        asked.then(function (role) {
          if (role === "unknown") return;   /* تعذّر السؤال: يبقى الظنّ */
          a.hidden = !allowed(p, role);
        });
      }
      nav.appendChild(a);
    });
    /* مبدّل الألوان في طرف الشريط — يظهر إن كان theme.js محمَّلًا */
    if (window.TPTheme) nav.appendChild(TPTheme.picker());
    head.appendChild(nav);

    /*  شارة العرض التجريبي — تُلازم كل صفحة ما دام الوضع قائمًا،
        فلا تُظنّ الأرقامُ أرقامَ الشعبة. */
    if (window.Store && Store.demo) head.appendChild(demoBar());

    revealStaff();
    /*  بعد أن يستقرّ الدور، لا قبله: الطيّ يقاس على ما بقي ظاهرًا. */
    (window.TPRole ? TPRole.get() : Promise.resolve("teacher"))
      .then(tidyBars, tidyBars);
  }

  function demoBar() {
    var bar = el("div", "demo-bar");
    bar.appendChild(el("span", "db-tag", "عرض تجريبي"));
    bar.appendChild(el("span", "db-text",
      "كل ما تراه هنا من نسج البرنامج — أسماءٌ وأرقامٌ مختلقة. " +
      "بيانات الشعبة الحقيقية لا تُقرأ ولا تُمسّ."));
    var out = el("a", "btn sm", "خروج");
    var u = new URL(location.href);
    u.searchParams.set("demo", "0");
    out.href = u.toString();
    bar.appendChild(out);
    return bar;
  }

  /* ─── سطر الاعتماد ───
     يُركَّب هنا مرةً واحدة بدل textContent في اثني عشر ملفًا، فيصير
     اسم المطوّر رابطًا إلى واتساب. والرابط يفتح في لسانٍ جديد
     برابطٍ مقطوع (noopener) فلا تصل صفحةُ واتساب إلى نافذة المنصة. */
  function credit(el) {
    el = typeof el === "string" ? document.getElementById(el) : el;
    if (!el) return;
    el.textContent = "";
    var txt = COURSE.credit || "";
    var by = COURSE.creditBy || "";
    var link = COURSE.creditLink || "";

    if (!by || !link || txt.indexOf(by) < 0) { el.textContent = txt; return; }

    var i = txt.indexOf(by);
    el.appendChild(document.createTextNode(txt.slice(0, i)));
    var a = document.createElement("a");
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "credit-link";
    a.title = "تواصل عبر واتساب";
    a.textContent = by;
    el.appendChild(a);
    el.appendChild(document.createTextNode(txt.slice(i + by.length)));
  }

  /* قائمة اختيار الشعبة — تحفظ الاختيار وتنادي onChange */
  function sectionPicker(select, onChange) {
    var params = new URLSearchParams(location.search);
    var current = window.TP.resolveSection(params);
    var all = window.TP.sections();

    /* بشعبة واحدة لا معنى لقائمة اختيار: تُخفى هي ووسمها، وتظهر
       من نفسها متى أُضيفت شعبة ثانية في ملف المقرر */
    if (all.length < 2 && select) {
      select.hidden = true;
      var lab = select.id && document.querySelector('label[for="' + select.id + '"]');
      if (lab) lab.hidden = true;
    }

    all.forEach(function (s) {
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

  /* ─── المحاضرة الجارية ───
     محاضرة اليوم إن وُجدت، وإلا آخر محاضرة مضت، وإلا الأولى.
     تُقال في مكانٍ واحد فتتفق عليها صفحتا الحضور وأوراق العمل —
     فلا تفتح إحداهما المحاضرة الثالثة والأخرى الرابعة. */
  function currentSession(sched) {
    sched = sched || {};
    var today = window.Store ? Store.dayKey() : "";
    var best = null;
    Object.keys(sched).forEach(function (n) { if (sched[n] === today) best = +n; });
    if (best !== null) return best;
    var past = Object.keys(sched).filter(function (n) { return sched[n] <= today; })
                    .map(Number).sort(function (a, b) { return b - a; });
    return past.length ? past[0] : 1;
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
  /* dataUrl بديلٌ عن text حين يكون المنزَّل ملفًا مرفوعًا لا نصًّا */
  function download(filename, text, mime, dataUrl) {
    filename = safeName(filename);
    var blob = dataUrl ? dataUrlToBlob(dataUrl)
                       : new Blob([text], { type: (mime || "application/json") + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ─── بناء CSV ───
     أسماء الطالبات تأتي من صفحة التسجيل التي تملؤها الطالبة نفسها،
     فاسمٌ يبدأ بـ = أو + أو - أو @ يُنفَّذ صيغةً في Excel لا يُعرض
     نصًّا. تُسبَق هذه بفاصلة عليا فتبقى مقروءة ولا تُنفَّذ.
     والاقتباس المزدوج والفاصلة والسطر الجديد تُقتبس كالمعتاد.
     وعلامة ترتيب البايتات في الصدر ليفتحه Excel بالعربية سليمة. */
  function csv(rows) {
    return "\ufeff" + rows.map(function (r) {
      return r.map(cell).join(",");
    }).join("\r\n");

    function cell(v) {
      var s = String(v == null ? "" : v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
  }

  function dataUrlToBlob(d) {
    var parts = String(d || "").split(",");
    var mime = (parts[0].match(/:(.*?);/) || [, "application/octet-stream"])[1];
    var bin = atob(parts[1] || "");
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
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
  var LESSONS  = ["محاضرة واحدة", "محاضرتان", "محاضرات", "محاضرة"];
  var READS    = ["شريحة قراءة", "شريحتا قراءة", "شرائح قراءة", "شريحة قراءة"];
  var SHEETS   = ["ورقة عمل واحدة", "ورقتا عمل", "أوراق عمل", "ورقة عمل"];

  function bytes(n) {
    if (n < 1024) return ar(n) + " بايت";
    if (n < 1048576) return ar(Math.round(n / 1024)) + " ك.ب";
    return ar((n / 1048576).toFixed(1)) + " م.ب";
  }

  /*  لافتةُ انقطاع.
      الصفحة تُرسم من بياناتٍ ساكنة ومن الخادم معًا. فإن تعذّر
      الخادم — وشبكةُ القاعة تتعثّر — وجب أن يظهر الساكنُ وأن
      يُقال ما غاب. وأسوأ ما يكون: صفحةٌ فارغةٌ صامتة تُفهَم
      «لا توجد أوراق» وهي موجودة.  */
  function offlineNote(host, text) {
    if (!host) return;
    var id = "tp-offline-note";
    var old = document.getElementById(id);
    if (!text) { if (old) old.remove(); return; }
    if (old) { old.textContent = text; return; }
    var d = el("div", "warn-box", text);
    d.id = id;
    host.insertBefore(d, host.firstChild);
  }

  window.TPUI = {
    el: el, chrome: chrome, sectionPicker: sectionPicker,
    offlineNote: offlineNote,
    coursePicker: coursePicker, toast: toast,
    credit: credit,
    /*  «الكشف فارغ» جملتان لا جملة، والفرقُ بينهما الدور.
        عند الدكتورة معناه: لم تُدخليه بعد.
        وعند الطالبة معناه شيءٌ آخر تمامًا: حسابُها لم يُربط بصفّها،
        فالسياسةُ لا تُرجع لها شيئًا.
        وكانت رسالةُ الدكتورة «أضيفي الكشف من صفحة الطالبات» تُعرض
        على الطالبة في أربعة مواضع، فتقف أمام بابٍ مغلقٍ لا تعرف من
        يفتحه. فجُمعت ههنا لئلا يتخلّف موضعٌ خامس عن الإصلاح القادم.

        وتُملأ الصندوقَ بنفسها ليستوي النداءُ في المواضع كلِّها. */
    emptyRoster: function (box, staff) {
      if (!box) return;
      box.textContent = "";
      box.appendChild(staff
        ? empty("لا يوجد كشف لهذه الشعبة.",
                "أضيفي الكشف من صفحة «الطالبات» أولًا.")
        : empty("حسابك غير مربوطٍ بكشف هذه الشعبة.",
                "تأكّدي أنكِ دخلتِ ببريدك الجامعي (sرقمك@ku.edu.kw). " +
                "فإن كان كذلك فرقمك لم يُضَف بعدُ إلى الكشف — راجعي الدكتورة."));
    },

    empty: empty, download: download, readAsText: readAsText,
    readAsDataURL: readAsDataURL, arDate: arDate, arMonth: arMonth, bytes: bytes,
    count: count, safeName: safeName, csv: csv,
    currentSession: currentSession,
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
