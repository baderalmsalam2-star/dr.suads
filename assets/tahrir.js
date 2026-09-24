/* ═══════════════════════════════════════════════════════════════
   تحرير نصّ الشريحة — قبل المحاضرة أو في أثنائها.

   نصُّ المحاضرات مأخوذٌ من مذكرة الدكتورة حرفيًّا، وفيه زللُ نقلٍ
   وأشياء تودّ تقديمها أو تأخيرها. وكان تصحيحُه يقتضي تعديل ملفٍّ
   في المستودع ودفعَه — وهو ما لا يُطلب من مدرِّسة.

   فصار التحريرُ في مكانه: تضغط «تحرير»، فتكتب في الشريحة نفسها.

   ═══ الأصل لا يُمسّ ═══
   الملفّ باقٍ كما وُلِّد، والتصحيحُ طبقةٌ فوقه في جدول content —
   كتصحيحات أوراق العمل. فزرُّ «أرجعي الأصل» يرفع الطبقة فيعود نصُّ
   المذكرة. ولو أُعيد بناء المحاضرات من المذكرة لم تضع التصحيحات.

   ═══ والحذف إخفاءٌ لا محو ═══
   الشريحة المحذوفة تُوسَم hidden فتُرفع من العرض، ونصُّها باقٍ في
   الملفّ. فمن حذفت شريحةً ثم ندمت أعادتها من «المحذوفة».

   ═══ والمضافة تسكن الطبقة وحدها ═══
   لها معرّفٌ من ساعة إنشائها، وموضعها «بعد الشريحة رقم كذا». وهي
   لا تدخل الملفّ أبدًا — فإن أُعيد البناء بقيت في مكانها لأنها
   ليست منه أصلًا.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var sessionNo = +(document.body.dataset.session || 0);
  if (!sessionNo || !window.TPContent || !window.TPRole) return;

  var inner = document.querySelector(".folio .inner");
  if (!inner) return;

  var REF = (COURSE.id || "course") + ":s" + sessionNo;
  var on = false;
  var keep = document.createElement("div");   /* مخبأ المحذوفات */
  keep.hidden = true;
  keep.id = "gone";

  /*  المعرّف يُشتقّ من الموضع الأصليّ في الملفّ لا من الترتيب
      المعروض: لو أُضيفت شريحةٌ في الوسط لتغيّر ترتيبُ ما بعدها،
      فتُنسب تصحيحاتُها إلى غيرها. */
  function stamp() {
    var n = 0;
    [].forEach.call(inner.querySelectorAll(".slide"), function (s) {
      if (!s.dataset.born) s.dataset.born = "f" + (n++);
      else n = Math.max(n, 1);
    });
  }

  function refOf(s) { return REF + "#" + s.dataset.born; }

  function partsOf(s) {
    return {
      rubric: s.querySelector(".rubric") || s.querySelector("h1"),
      matn: s.querySelector(".matn")
    };
  }

  /* ─── تطبيق الطبقة ─── */
  function applyOne(s) {
    var r = refOf(s), p = partsOf(s);
    if (TPContent.get(r, "hidden") === "1") {
      /*  تُنحّى ولا تُمحى، ويُنزع عنها صنفُ «slide» — فمحرّك العرض
          يقرأ الشرائح من الصنف، فلو بقي عليها لعَدَّها في العرض
          وهي مخبوءة، فيقف الدرسُ على شريحةٍ لا تُرى. */
      s.classList.remove("slide");
      s.classList.add("gone-slide");
      keep.appendChild(s);
      return;
    }
    var rub = TPContent.get(r, "rubric");
    if (rub != null && p.rubric) p.rubric.textContent = rub;
    var matn = TPContent.get(r, "matn");
    if (matn != null && p.matn) {
      p.matn.textContent = "";
      String(matn).split(/\n{2,}/).forEach(function (t) {
        if (!t.trim()) return;
        var el = document.createElement("p");
        el.innerHTML = clean(t.trim());
        p.matn.appendChild(el);
      });
    }
  }

  /*  المضافة تُبنى من الطبقة. سجلُّها في الحقل «added» على مرجع
      الدرس نفسه: قائمةٌ من {id, after}. */
  function addedList() {
    try { return JSON.parse(TPContent.get(REF, "added") || "[]") || []; }
    catch (e) { return []; }
  }

  function buildAdded() {
    addedList().forEach(function (a) {
      var after = inner.querySelector('[data-born="' + a.after + '"]');
      var s = document.createElement("section");
      s.className = "slide";
      s.setAttribute("data-reader", "");
      s.dataset.born = a.id;
      s.innerHTML = '<div class="rubric"></div><div class="matn flow"></div>';
      s.querySelector(".rubric").textContent = TPContent.get(REF + "#" + a.id, "rubric") || "";
      var body = TPContent.get(REF + "#" + a.id, "matn") || "";
      body.split(/\n{2,}/).forEach(function (t) {
        if (!t.trim()) return;
        var el = document.createElement("p");
        el.innerHTML = clean(t.trim());
        s.querySelector(".matn").appendChild(el);
      });
      if (after && after.parentNode) after.parentNode.insertBefore(s, after.nextSibling);
      else inner.appendChild(s);
    });
  }

  function applyAll() {
    [].forEach.call(inner.querySelectorAll(".slide"), applyOne);
    buildAdded();
    if (window.TPDeck) TPDeck.rescan();
  }


  /* ═══ تنسيقٌ محدود: غامق · لون · أكبر ═══
     «كتبتها يدوي بس التنسيق مو مضبوط، لأن ما في خيار ألوان أو
     تغميق أو تكبير الخط.» — فالشريحة كانت تُحرَّر نصًّا مجرَّدًا
     (plaintext-only)، والدكتورة تحتاج أن تُبرز اسمًا أو مذهبًا.

     ولا يُفتح البابُ على مصراعيه: ثلاثةُ وسومٍ لا غير، وكلُّ ما
     سواها يُجرَّد عند الحفظ وعند العرض معًا. فما يُلصق من Word —
     وهو يجيء بعشرات الوسوم والأنماط — يدخل نصًّا نظيفًا، ولا
     تُحقن في صفحة الطالبة وسومٌ لم نقصدها. */
  var OK = { B: 1, SPAN: 1, BR: 1 };
  var HUES = { hi: 1, big: 1 };

  function clean(html) {
    var src = document.createElement("div");
    src.innerHTML = String(html == null ? "" : html);
    var out = document.createElement("div");

    (function walk(from, to) {
      [].forEach.call(from.childNodes, function (n) {
        if (n.nodeType === 3) { to.appendChild(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;
        var tag = n.tagName;
        if (tag === "BR") { to.appendChild(document.createElement("br")); return; }
        var keepIt = null;
        if (tag === "B" || tag === "STRONG") keepIt = document.createElement("b");
        else if (tag === "SPAN") {
          var c = (n.getAttribute("class") || "").trim();
          if (HUES[c]) { keepIt = document.createElement("span"); keepIt.className = c; }
        }
        if (keepIt) { walk(n, keepIt); to.appendChild(keepIt); }
        else walk(n, to);          /* وسمٌ غير مأذونٍ: يسقط ويبقى نصُّه */
      });
    })(src, out);

    return out.innerHTML;
  }

  /*  يلفّ ما اختارته أو يرفع اللفّ عنه. والمرجعُ عنصرٌ واحدٌ يحيط
      بالاختيار كلِّه — فلا يُترك نصفُ الكلمة ملفوفًا ونصفُها لا. */
  function wrap(kind) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) {
      return TPUI.toast("ظلّلي الكلمة أولًا ثم اضغطي.", "bad");
    }
    var range = sel.getRangeAt(0);
    var host = range.commonAncestorContainer;
    if (host.nodeType === 3) host = host.parentNode;
    var has = host.closest(kind === "b" ? "b" : "span." + kind);

    if (has) {                      /* رفعُ اللفّ: يُستبدل بمحتواه */
      var parent = has.parentNode;
      while (has.firstChild) parent.insertBefore(has.firstChild, has);
      parent.removeChild(has);
      parent.normalize();
      return;
    }
    var node = kind === "b" ? document.createElement("b")
                            : document.createElement("span");
    if (kind !== "b") node.className = kind;
    try { range.surroundContents(node); }
    catch (e) {
      /*  اختيارٌ يقطع عنصرًا: يُنسخ نصُّه ويُوضع مكانه. */
      node.appendChild(range.extractContents());
      range.insertNode(node);
    }
    sel.removeAllRanges();
  }

  /* ─── التحرير في الشريحة نفسها ─── */
  function editable(yes) {
    [].forEach.call(inner.querySelectorAll(".slide"), function (s) {
      var p = partsOf(s);
      [p.rubric, p.matn].forEach(function (el) {
        if (!el) return;
        if (yes) {
          /*  المتن يقبل التنسيق المحدود، والعنوانُ لا: عناوينُ
              المنصة مشكولةٌ بقالبٍ واحد، فلونٌ فيها يكسر الصفّ. */
          el.setAttribute("contenteditable", el === p.matn ? "true" : "plaintext-only");
          el.dataset.was = el === p.matn ? serialize(el) : el.innerText;
        } else {
          el.removeAttribute("contenteditable");
        }
      });
    });
    document.body.classList.toggle("tahrir-on", yes);
  }

  /*  فقرةٌ لكل <p>، يفصلها سطرٌ فارغ، ومعها وسومُها المأذونة.
      وما كتبته الدكتورة سطورًا في عنصرٍ واحدٍ يُقرأ كما هو. */
  function serialize(box) {
    var ps = box.querySelectorAll("p");
    var parts = ps.length
      ? [].map.call(ps, function (n) { return clean(n.innerHTML).trim(); })
      : [clean(box.innerHTML).trim()];
    return parts.filter(function (t) { return t; }).join("\n\n");
  }

  function saveSlide(s) {
    var p = partsOf(s), r = refOf(s), jobs = [];
    if (p.rubric && p.rubric.innerText !== p.rubric.dataset.was) {
      jobs.push(TPContent.set(r, "rubric", p.rubric.innerText.trim()));
    }
    if (p.matn && serialize(p.matn) !== p.matn.dataset.was) {
      /*  الفقرات تُفصل بسطرٍ فارغ — وهو ما تكتبه الدكتورة بالفعل
          حين تضغط «إدخال» مرّتين. */
      jobs.push(TPContent.set(r, "matn", serialize(p.matn)));
    }
    return Promise.all(jobs);
  }

  /*  ويُحفظ ما تبدّل في الشرائح كلِّها لا في الظاهرة وحدها:
      «تحرير» يفتح المحاضرة كلَّها للكتابة، والسهمان أسفل الصفحة
      يعملان وهي تحرّر. فكانت تصحّح الثالثة ثم تنتقل إلى الرابعة
      فتصحّحها ثم تضغط «احفظي» — فيُحفظ نصُّ الرابعة وحده ويذهب
      تصحيحُ الثالثة بلا رسالةٍ ولا أثر. */
  function saveAll() {
    var jobs = [].map.call(inner.querySelectorAll(".slide"), saveSlide);
    return Promise.all(jobs);
  }

  /* ─── الشريط ─── */
  var bar = document.createElement("div");
  bar.className = "tahrirbar";
  bar.hidden = true;

  function btn(label, title, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.addEventListener("click", function (e) { e.stopPropagation(); fn(b); });
    bar.appendChild(b);
    return b;
  }

  var bEdit = btn("تحرير", "عدّلي نصّ الشريحة في مكانه", function () {
    if (!on) { on = true; editable(true); paintBar(); return; }
    bEdit.disabled = true;
    saveAll().then(function () {
      on = false; editable(false); paintBar(); bEdit.disabled = false;
      TPUI.toast("حُفظ النصّ.", "good");
    }).catch(function (e) {
      bEdit.disabled = false;
      TPUI.toast(e.message || "تعذّر الحفظ.", "bad");
    });
  });

  /*  ثلاثةٌ تظهر في وضع التحرير وحده: تُظلَّل الكلمة ثم تُضغط.
      والضغطةُ الثانية ترفع ما وُضع. */
  var bBold = btn("غامق", "تغميق ما ظلّلتِه (ظلّلي أولًا)", function () { wrap("b"); });
  var bHue  = btn("لون",  "لونٌ يُبرز ما ظلّلتِه",           function () { wrap("hi"); });
  var bBig  = btn("أكبر", "تكبير خطّ ما ظلّلتِه",            function () { wrap("big"); });
  var FORMAT = [bBold, bHue, bBig];
  FORMAT.forEach(function (b) { b.classList.add("fmt"); b.hidden = true; });

  var bBack = btn("أرجعي الأصل", "يُرفع التصحيح فيعود نصّ المذكرة", function () {
    var s = curSlide(), r = refOf(s);
    if (!confirm("إرجاع نصّ المذكرة الأصلي لهذه الشريحة؟")) return;
    Promise.all([TPContent.set(r, "rubric", ""), TPContent.set(r, "matn", "")])
      .then(function () { location.reload(); })
      .catch(function (e) { TPUI.toast(e.message || "تعذّر الإرجاع.", "bad"); });
  });

  var bDel = btn("احذفي", "تُرفع من العرض، ونصُّها باقٍ", function () {
    var s = curSlide();
    if (!confirm("حذف هذه الشريحة من العرض؟ تُرجعينها من «المحذوفة».")) return;
    TPContent.set(refOf(s), "hidden", "1")
      .then(function () { location.reload(); })
      .catch(function (e) { TPUI.toast(e.message || "تعذّر الحذف.", "bad"); });
  });

  btn("أضيفي بعدها", "شريحةٌ جديدة بعد هذه", function () {
    var s = curSlide();
    var list = addedList();
    list.push({ id: "n" + Date.now().toString(36), after: s.dataset.born });
    TPContent.set(REF, "added", JSON.stringify(list))
      .then(function () { location.reload(); })
      .catch(function (e) { TPUI.toast(e.message || "تعذّرت الإضافة.", "bad"); });
  });

  var bGone = btn("المحذوفة", "أرجعي ما حذفتِ", function () {
    var gone = [].slice.call(keep.querySelectorAll('.gone-slide'));
    if (!gone.length) return TPUI.toast("لا شريحة محذوفة في هذه المحاضرة.", "good");
    if (!confirm("إرجاع " + gone.length + " شريحةً محذوفة؟")) return;
    Promise.all(gone.map(function (s) { return TPContent.set(refOf(s), "hidden", ""); }))
      .then(function () { location.reload(); });
  });

  function curSlide() {
    return inner.querySelector(".slide.on") || inner.querySelector(".slide");
  }

  function paintBar() {
    bEdit.textContent = on ? "احفظي" : "تحرير";
    bEdit.classList.toggle("on", on);
    FORMAT.forEach(function (b) { b.hidden = !on; });
    [bBack, bDel, bGone].forEach(function (b) { b.disabled = on; });
  }

  /*  ما دامت الشريحة تحت التحرير لا يُقلَّب الدرس بالنقر: النقرُ
      داخل النصّ وضعُ مؤشّرٍ لا انتقال. */
  addEventListener("click", function (e) {
    if (on && e.target.closest(".slide")) e.stopPropagation();
  }, true);

  addEventListener("keydown", function (e) {
    if (on && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === " ")) {
      e.stopPropagation();
    }
  }, true);

  TPRole.staff().then(function (ok) {
    if (!ok) return;
    return TPContent.ready().then(function () {
      stamp();
      document.body.appendChild(keep);
      applyAll();
      document.querySelector(".folio").appendChild(bar);
      bar.hidden = false;
      paintBar();
    });
  }).catch(function () { /* بلا خادم: النصّ كما في الملفّ */ });
})();
