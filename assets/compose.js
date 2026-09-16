/* ═══ مُنشئ الحصص ═══
   يبني ملف حصة كاملًا من نصٍّ يلصقه المستخدم. لا يولّد محتوى:
   كل كلمة في الخرج جاءت من نص المذكرة الذي أُدخل هنا. */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var LETTERS = ["أ", "ب", "ج", "د"];

  var KINDS = [
    { id: "reader",  label: "قراءة — تُسنَد لطالبة", tab: "" },
    { id: "faculty", label: "تقرؤها الدكتورة",       tab: "تقرؤها الدكتورة" },
    { id: "question",label: "سؤال بمؤقت",            tab: "سؤال للجميع" },
    { id: "closing", label: "ختام الحصة",            tab: "ختام الحصة" }
  ];

  var blocks = [];
  var built = null;

  TPUI.chrome("compose", "مُنشئ الحصص", "يبني ملف الحصة من نص المذكرة");
  TPUI.credit("credit");

  /* أول رقم حصة غير مجهَّز */
  var pending = (COURSE.sessions || []).filter(function (s) {
    return !(s.status === "ready" && s.file);
  })[0];
  if (pending) document.getElementById("n").value = pending.n;

  /* ─── تقسيم النص إلى شرائح ─── */
  document.getElementById("split").addEventListener("click", function () {
    var raw = document.getElementById("raw").value;
    var paras = raw.split(/\n\s*\n/).map(function (t) { return t.trim(); })
                   .filter(function (t) { return t.length; });
    if (!paras.length) return TPUI.toast("الصق نص الحصة أولًا.", "bad");

    paras.forEach(function (t) {
      blocks.push({ kind: "reader", rubric: "", src: "", text: t });
    });
    document.getElementById("raw").value = "";
    render();
    TPUI.toast("أُضيفت " + ar(paras.length) + " شريحة — عدّل أنواعها وعناوينها.", "good");
  });

  document.getElementById("addQ").addEventListener("click", function () {
    blocks.push({
      kind: "question", rubric: "", src: "", timer: 30,
      text: "", options: ["", "", "", ""], answer: 1, why: ""
    });
    render();
  });

  document.getElementById("addClose").addEventListener("click", function () {
    blocks.push({ kind: "closing", rubric: "خلاصة اليوم", src: "الحصة القادمة",
                  text: "", nextTitle: "", nextPages: "" });
    render();
  });

  /* ─── محرّر الشرائح ─── */
  function render() {
    var box = document.getElementById("blocks");
    var emptyBox = document.getElementById("blocksEmpty");
    box.textContent = "";
    emptyBox.textContent = "";

    var qs = blocks.filter(function (b) { return b.kind === "question"; }).length;
    var rd = blocks.filter(function (b) { return b.kind === "reader"; }).length;
    document.getElementById("blocksSub").textContent = blocks.length
      ? TPUI.slides(blocks.length) + " · " + TPUI.reads(rd) +
        (qs ? " · " + TPUI.questions(qs) : "") : "";
    document.getElementById("tally").textContent = blocks.length
      ? "الشرائح الحالية: " + TPUI.slides(blocks.length) : "";

    if (!blocks.length) {
      emptyBox.appendChild(TPUI.empty("لا توجد شرائح بعد.",
        "الصق نص الحصة أعلاه واضغط «قسّم إلى شرائح»."));
      return;
    }

    blocks.forEach(function (b, i) {
      var card = el("div", "blk" + (b.kind === "question" ? " q" :
                                    b.kind === "closing" ? " closing" : ""));

      /* ── الرأس: النوع والرُّبرِكة والمصدر والترتيب ── */
      var head = el("div", "blk-head");
      head.appendChild(el("span", "idx", ar(i + 1)));

      var sel = document.createElement("select");
      KINDS.forEach(function (k) {
        var o = document.createElement("option");
        o.value = k.id; o.textContent = k.label;
        sel.appendChild(o);
      });
      sel.value = b.kind;
      sel.addEventListener("change", function () {
        b.kind = sel.value;
        if (b.kind === "question" && !b.options) {
          b.options = ["", "", "", ""]; b.answer = 1; b.why = ""; b.timer = 30;
        }
        render();
      });
      head.appendChild(sel);

      head.appendChild(field("عنوان جانبي", b.rubric, "grow", function (v) { b.rubric = v; }));
      head.appendChild(field("المصدر / ص", b.src, "", function (v) { b.src = v; }));

      var ops = el("div", "ops");
      ops.appendChild(op("↑", function () { move(i, -1); }, i === 0));
      ops.appendChild(op("↓", function () { move(i, 1); }, i === blocks.length - 1));
      var del = op("حذف", function () {
        if (!confirm("حذف الشريحة " + ar(i + 1) + "؟")) return;
        blocks.splice(i, 1); render();
      });
      del.className = "del";
      ops.appendChild(del);
      head.appendChild(ops);
      card.appendChild(head);

      /* ── الجسم ── */
      var body = el("div", "blk-body");
      if (b.kind === "question") buildQuestion(body, b);
      else if (b.kind === "closing") buildClosing(body, b);
      else buildText(body, b);
      card.appendChild(body);

      box.appendChild(card);
    });
  }

  function field(placeholder, value, cls, onInput) {
    var i = document.createElement("input");
    i.type = "text"; i.placeholder = placeholder; i.value = value || "";
    if (cls) i.className = cls;
    i.addEventListener("input", function () { onInput(i.value); });
    return i;
  }

  function op(label, fn, disabled) {
    var b = el("button", "", label);
    b.type = "button";
    b.disabled = !!disabled;
    b.addEventListener("click", fn);
    return b;
  }

  function move(i, d) {
    var j = i + d;
    if (j < 0 || j >= blocks.length) return;
    var t = blocks[i]; blocks[i] = blocks[j]; blocks[j] = t;
    render();
  }

  function buildText(body, b) {
    var ta = document.createElement("textarea");
    ta.rows = Math.min(8, Math.max(3, Math.ceil(b.text.length / 90)));
    ta.value = b.text;
    ta.placeholder = "نص الشريحة. افصل الفقرات بسطر فارغ.";
    ta.addEventListener("input", function () { b.text = ta.value; });
    body.appendChild(ta);
    body.appendChild(el("label", "",
      "لتلوين آية أو نص مقتبس بالأزرق، ضعه بين قوسين مزدوجين هكذا: ((النص))"));
  }

  function buildQuestion(body, b) {
    var q = document.createElement("textarea");
    q.rows = 2; q.value = b.text; q.placeholder = "نص السؤال؟";
    q.addEventListener("input", function () { b.text = q.value; });
    body.appendChild(el("label", "", "السؤال"));
    body.appendChild(q);

    body.appendChild(el("label", "", "الخيارات — علّم الصحيح"));
    var wrap = el("div", "opts-edit");
    b.options.forEach(function (opt, oi) {
      var row = el("div", "opt-row");
      var r = document.createElement("input");
      r.type = "radio"; r.name = "ans-" + blocks.indexOf(b);
      r.checked = b.answer === oi;
      r.addEventListener("change", function () { b.answer = oi; });
      row.appendChild(r);
      row.appendChild(el("span", "lt", LETTERS[oi]));
      var t = document.createElement("input");
      t.type = "text"; t.value = opt; t.placeholder = "الخيار " + LETTERS[oi];
      t.addEventListener("input", function () { b.options[oi] = t.value; });
      row.appendChild(t);
      wrap.appendChild(row);
    });
    body.appendChild(wrap);

    var why = document.createElement("textarea");
    why.rows = 2; why.value = b.why;
    why.placeholder = "التعليق الذي يظهر مع الجواب — لماذا هذا هو الصواب.";
    why.addEventListener("input", function () { b.why = why.value; });
    body.appendChild(el("label", "", "تعليق الجواب"));
    body.appendChild(why);

    var t = field("٣٠", b.timer, "", function (v) { b.timer = v; });
    body.appendChild(el("label", "", "المؤقت بالثواني (اتركه فارغًا لبلا مؤقت)"));
    body.appendChild(t);
  }

  function buildClosing(body, b) {
    var ta = document.createElement("textarea");
    ta.rows = 2; ta.value = b.text; ta.placeholder = "الفكرة التي تُحفظ من الحصة.";
    ta.addEventListener("input", function () { b.text = ta.value; });
    body.appendChild(el("label", "", "خلاصة اليوم"));
    body.appendChild(ta);
    body.appendChild(el("label", "", "عنوان الحصة القادمة"));
    body.appendChild(field("الولاية العامة — مقاصدها ومراتبها", b.nextTitle, "",
      function (v) { b.nextTitle = v; }));
    body.appendChild(el("label", "", "صفحات الحصة القادمة"));
    body.appendChild(field("ص ٥–٦", b.nextPages, "", function (v) { b.nextPages = v; }));
  }

  /* ─── التوليد ─── */
  /* تُستعمل داخل سمات محاطة بعلامتَي تنصيص (data-src وأخواتها)، فلا
     يكفي هروب الوسوم: نصٌّ ملصوق من ورقة طالبة فيه علامة تنصيص كان
     يغلق السمة ويفتح سمةً جديدة. والهروب آمن في سياق النص أيضًا. */
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ((نص)) → <span class="q">نص</span> بعد الهروب */
  function inline(s) {
    return esc(s).replace(/\(\((.+?)\)\)/g, '<span class="q">$1</span>');
  }

  function paragraphs(text) {
    return String(text || "").split(/\n\s*\n/)
      .map(function (t) { return t.trim(); })
      .filter(function (t) { return t.length; })
      .map(function (t) { return "          <p>" + inline(t) + "</p>"; })
      .join("\n");
  }

  function slidesMarkup(meta) {
    var out = [];
    out.push('      <section class="slide on" data-tab="الحصة ' + ar(meta.n) +
             '" data-src="' + esc(meta.pages) + '">\n' +
             '        <h1>' + esc(meta.title) + '</h1>\n' +
             (meta.subtitle ? '        <div class="sub">' + esc(meta.subtitle) + '</div>\n' : '') +
             '      </section>');

    blocks.forEach(function (b) {
      var src = b.src ? ' data-src="' + esc(b.src) + '"' : '';
      var rub = b.rubric ? '        <div class="rubric">' + esc(b.rubric) + '</div>\n' : '';

      if (b.kind === "question") {
        var timer = String(b.timer || "").trim();
        out.push('      <section class="slide" data-tab="سؤال للجميع"' + src +
          (timer ? ' data-timer="' + esc(timer) + '"' : '') + ' data-q>\n' + rub +
          '        <div class="qtext">' + inline(b.text) + '</div>\n' +
          '        <ol class="opts">\n' +
          b.options.map(function (o, oi) {
            return '          <li' + (oi === b.answer ? ' class="right"' : '') +
                   '><span>' + LETTERS[oi] + '</span> ' + esc(o) + '</li>';
          }).join("\n") + '\n' +
          '        </ol>\n' +
          (b.why ? '        <div class="answer">' + inline(b.why) + '</div>\n' : '') +
          '      </section>');

      } else if (b.kind === "closing") {
        out.push('      <section class="slide" data-tab="ختام الحصة" data-src="الحصة القادمة">\n' +
          rub +
          '        <div class="matn">' + (b.text ? '<p>' + inline(b.text) + '</p>' : '') + '</div>\n' +
          '        <div class="note">\n' +
          (b.nextTitle ? '          <b>الحصة القادمة:</b> ' + esc(b.nextTitle) +
                         (b.nextPages ? ' · ' + esc(b.nextPages) : '') + '<br>\n' : '') +
          '          القارئات: <span id="next"></span> — النص متاح للتحضير من الآن.\n' +
          '        </div>\n' +
          '      </section>');

      } else {
        out.push('      <section class="slide"' +
          (b.kind === "reader" ? ' data-reader' : ' data-tab="تقرؤها الدكتورة"') + src + '>\n' +
          rub +
          '        <div class="matn">\n' + paragraphs(b.text) + '\n        </div>\n' +
          '      </section>');
      }
    });
    return out.join("\n\n");
  }

  function page(meta, assetPrefix) {
    return '<!DOCTYPE html>\n<html lang="ar" dir="rtl">\n<head>\n' +
'<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'<title>الحصة ' + ar(meta.n) + ' — ' + esc(meta.title) + '</title>\n' +
'<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
'<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">\n' +
'<link rel="stylesheet" href="' + assetPrefix + 'assets/tokens.css">\n' +
'<link rel="stylesheet" href="' + assetPrefix + 'assets/deck.css">\n' +
'</head>\n<body data-session="' + esc(meta.n) + '">\n<div class="stage">\n\n' +
'  <div class="bar">\n    <div>\n' +
'      <a class="home" id="home" href="' + assetPrefix + 'index.html">→ المنصة</a> ·\n' +
'      <span id="course"></span> · <b id="instructor"></b> · <span id="sec"></span>\n' +
'    </div>\n    <div class="src" id="src"></div>\n  </div>\n\n' +
'  <div class="folio">\n    <div class="tab" id="tab"></div>\n' +
'    <div class="timer" id="timer" role="timer" aria-live="off">٣٠</div>\n' +
'    <div class="inner">\n\n' + slidesMarkup(meta) + '\n\n' +
'    </div>\n  </div>\n\n' +
'  <div class="foot">\n    <div class="marks" id="marks"></div>\n' +
'    <div class="nav">\n' +
'      <button id="prev" type="button" aria-label="الشريحة السابقة">→</button>\n' +
'      <button id="nextBtn" type="button" aria-label="الشريحة التالية">←</button>\n' +
'    </div>\n' +
'    <div class="keys">→ ← للتنقل · مسافة: الجواب · ر: المؤقت · م: رصد التفاعل · طباعة: تصدير</div>\n' +
'    <div class="credit" id="credit"></div>\n  </div>\n</div>\n\n' +
'<script src="' + assetPrefix + 'data/course.js"><\/script>\n' +
'<script src="' + assetPrefix + 'assets/store.js"><\/script>\n' +
'<script src="' + assetPrefix + 'assets/ui.js"><\/script>\n' +
'<script src="' + assetPrefix + 'assets/deck.js"><\/script>\n' +
'<script src="' + assetPrefix + 'assets/participate.js"><\/script>\n' +
'</body>\n</html>\n';
  }

  function meta() {
    return {
      n: (document.getElementById("n").value || "").trim(),
      title: document.getElementById("title").value.trim(),
      subtitle: document.getElementById("subtitle").value.trim(),
      pages: document.getElementById("pages").value.trim()
    };
  }

  document.getElementById("build").addEventListener("click", function () {
    var m = meta();
    if (!m.n || !m.title) return TPUI.toast("اكتب رقم الحصة وعنوانها.", "bad");
    if (!blocks.length) return TPUI.toast("لا توجد شرائح.", "bad");

    var badQ = blocks.filter(function (b) {
      return b.kind === "question" &&
             (!b.text.trim() || b.options.filter(function (o) { return o.trim(); }).length < 2);
    });
    if (badQ.length) return TPUI.toast("سؤال ناقص: اكتب نصه وخيارين على الأقل.", "bad");

    built = { meta: m, file: page(m, "../"), preview: page(m, "") };

    var f = document.getElementById("preview");
    f.srcdoc = built.preview;
    f.className = "on";

    var readers = blocks.filter(function (b) { return b.kind === "reader"; }).length;
    document.getElementById("buildState").textContent =
      TPUI.slides(blocks.length + 1) + " · " + TPUI.reads(readers);
    document.getElementById("download").disabled = false;
    snippets(m, readers);
    document.getElementById("snippets").hidden = false;
  });

  document.getElementById("download").addEventListener("click", function () {
    if (!built) return;
    TPUI.download(fileName(built.meta), built.file, "text/html");
    TPUI.toast("نُزّل الملف — احفظه داخل مجلد sessions/", "good");
  });

  function fileName(m) {
    var n = String(m.n).padStart(2, "0");
    return n + "-session.html";
  }

  function snippets(m, readers) {
    var course =
'    {\n' +
'      n: ' + m.n + ',\n' +
'      title: ' + JSON.stringify(m.title) + ',\n' +
'      subtitle: ' + JSON.stringify(m.subtitle) + ',\n' +
'      pages: ' + JSON.stringify(m.pages) + ',\n' +
'      file: "sessions/' + fileName(m) + '",\n' +
'      readers: ' + readers + ',\n' +
'      status: "ready"\n' +
'    }';
    document.getElementById("snipCourse").value = course;

    var qs = blocks.filter(function (b) { return b.kind === "question"; });
    if (!qs.length) {
      document.getElementById("snipSheet").value =
        "// لا توجد أسئلة في هذه الحصة — لا ورقة عمل تُولَّد.";
      return;
    }
    var items = qs.map(function (b, i) {
      return '      { id: "q' + (i + 1) + '", kind: "mcq",\n' +
             '        prompt: ' + JSON.stringify(b.text) + ',\n' +
             '        options: ' + JSON.stringify(b.options.filter(function (o) { return o.trim(); })) + ',\n' +
             '        answer: ' + b.answer + ',\n' +
             '        why: ' + JSON.stringify(b.why) + ' }';
    }).join(",\n");

    document.getElementById("snipSheet").value =
'  {\n' +
'    id: "w' + m.n + '",\n' +
'    type: "worksheet",\n' +
'    session: ' + m.n + ',\n' +
'    title: "ورقة عمل: ' + m.title + '",\n' +
'    pages: ' + JSON.stringify(m.pages) + ',\n' +
'    intro: "تُحل داخل الحصة. لا توجد درجات.",\n' +
'    items: [\n' + items + '\n' +
'    ]\n' +
'  }';
  }

  [["copyCourse", "snipCourse"], ["copySheet", "snipSheet"]].forEach(function (pair) {
    document.getElementById(pair[0]).addEventListener("click", function () {
      var ta = document.getElementById(pair[1]);
      ta.select();
      navigator.clipboard ? navigator.clipboard.writeText(ta.value)
                            .then(function () { TPUI.toast("نُسخ.", "good"); })
                            .catch(function () { TPUI.toast("انسخه يدويًا.", "bad"); })
                          : TPUI.toast("انسخه يدويًا.", "bad");
    });
  });

  render();
})();
