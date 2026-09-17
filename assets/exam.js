/* ═══ صفحة الاختبار ═══
   ورقةٌ مؤقَّتة تُصحَّح آليًّا فيما عدا أسئلة «دلّل».

   ما يحرسه الخادم وما لا يحرسه — يُقال صراحةً ولا يُوهَم غيره:
     • وقت البدء يكتبه الخادم، فإعادة تحميل الصفحة لا تُعيد العدّ.
     • والتسليم بعد الوقت يرفضه الخادم لا الصفحة.
     • ومغادرة الشاشة تُسجَّل وتُعرَض للدكتورة — ولا تُمنع. ولا
       يمكن لصفحةٍ في متصفّح أن تمنع جهازًا ثانيًا ولا ورقةً على
       الطاولة؛ الحارس في القاعة لا في البرنامج.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var params = new URLSearchParams(location.search);
  var EX = (window.EXAMS || []).filter(function (x) {
    return x.id === params.get("x");
  })[0];

  var section = TP.resolveSection(params);
  var students = [], student = null, sub = null, paper = [], owner = false;
  var tick = null, guarded = false;

  var itemsBox = document.getElementById("items");
  var stateEl  = document.getElementById("state");
  var picker   = document.getElementById("student");
  var clock    = document.getElementById("clock");

  TPUI.credit("credit");

  if (!EX) {
    TPUI.chrome("worksheets", "اختبار", null);
    document.getElementById("emptyBox").appendChild(
      TPUI.empty("لم أجد هذا الاختبار.",
                 "افتحيه من صفحة أوراق العمل، أو تحقّقي من الرابط."));
    document.querySelector(".control").hidden = true;
    return;
  }

  TPContent.ready().then(start).catch(start);

  function start() {
    TPUI.chrome("worksheets", EX.title, EX.scope || null);
    document.getElementById("brief").textContent = brief();
    teacherPanel();

    /*  ?form=N يعرض النموذج بجوابه للطباعة والمراجعة — بلا طالبة
        ولا وقتٍ ولا تسليم. وهو مقصورٌ على المالكة: الأجوبة فيه. */
    var f = params.get("form");
    if (f != null) return previewForm(+f);

    loadStudents();
  }

  /* ─── معاينة نموذج بجوابه ─── */
  function previewForm(f) {
    document.querySelector(".control").hidden = true;
    if (!window.TPRole) return denyPreview();
    TPRole.get().then(function (r) {
      if (r !== "teacher" && r !== "admin") return denyPreview();
      paper = TPQuiz.paper(EX, f);
      document.getElementById("brief").textContent =
        "النموذج " + ar(f + 1) + " — " + brief();
      itemsBox.textContent = "";
      itemsBox.className = "locked";
      paper.forEach(function (q, i) {
        var box = el("div", "item");
        box.appendChild(el("div", "qno",
          "السؤال " + ar(i + 1) + " · " + q.part + " — " + ar(q.points) +
          (q.points === 1 ? " درجة" : " درجات")));
        box.appendChild(el("div", "prompt", q.prompt));
        if (q.kind === "tf") box.appendChild(el("div", "key", "الجواب: " + (q.answer ? "صواب" : "خطأ")));
        else if (q.kind === "multi") {
          var mu = el("ul", "choices multi");
          (q.options || []).forEach(function (o, oi) {
            var li = el("li");
            var lab = el("label",
              (q.answers || []).map(Number).indexOf(oi) >= 0 ? "correct" : "");
            lab.appendChild(el("span", "", "أبجد".charAt(oi) || String(oi + 1)));
            lab.appendChild(el("span", "", o));
            li.appendChild(lab); mu.appendChild(li);
          });
          box.appendChild(mu);
        }
        else if (q.kind === "mcq") {
          var ul = el("ul", "choices");
          (q.options || []).forEach(function (o, oi) {
            var li = el("li"), lab = el("label", oi === q.answer ? "correct" : "");
            lab.appendChild(el("span", "", "أبجد".charAt(oi) || String(oi + 1)));
            lab.appendChild(el("span", "", o));
            li.appendChild(lab); ul.appendChild(li);
          });
          box.appendChild(ul);
        } else if (q.kind === "cloze") {
          box.appendChild(el("div", "key", "الجواب: " + (q.accept || []).join(" أو ")));
        } else {
          box.appendChild(el("div", "key", "تُصحَّح بيد الدكتورة."));
        }
        if (q.why) box.appendChild(el("div", "why", q.why));
        itemsBox.appendChild(box);
      });
    });
  }

  function denyPreview() {
    itemsBox.textContent = "";
    itemsBox.appendChild(TPUI.empty("معاينة النموذج للدكتورة وحدها.",
      "فيها أجوبة الأسئلة."));
  }

  function brief() {
    var parts = (EX.structure || []).map(function (p) {
      return TPUI.count(p.count, ["سؤال واحد", "سؤالان", "أسئلة", "سؤالًا"]) +
             " " + p.label;
    });
    /*  الفاصل نقطةٌ وسطى في بقية المنصة، لكنها هنا تقع بين أرقامٍ
        عربية-هندية فتُقرأ صفرًا: «١٠ · ١٠» تبدو «١٠٠١». فتُستعمل
        الفاصلةُ العربية بينها. */
    return parts.join("، ") + " — " + ar(total()) + " درجة، في " +
           ar(EX.minutes) + " دقيقة.";
  }

  function total() {
    return (EX.structure || []).reduce(function (a, p) {
      return a + p.count * p.points;
    }, 0);
  }

  /* ─── الطالبات ─── */
  function loadStudents() {
    Store.students(section.id).then(function (list) {
      students = list.slice().sort(function (a, b) { return (a.no || 0) - (b.no || 0); });
      if (!students.length) {
        document.getElementById("emptyBox").appendChild(
          TPUI.empty("لا يوجد كشف لهذه الشعبة.", "أضيفي الكشف من صفحة «الطالبات» أولًا."));
        return;
      }
      students.forEach(function (s) {
        var o = document.createElement("option");
        o.value = s.id;
        o.textContent = ar(s.no) + " · " + s.name;
        picker.appendChild(o);
      });
      var want = params.get("student");
      picker.value = (want && students.some(function (s) { return s.id === want; }))
        ? want : students[0].id;
      /*  الطالبة لا ترى إلا صفّها (تحرسه قواعد الصلاحيات)، فقائمة
          الاختيار عندها ذات سطرٍ واحد — تُخفى هي ووسمها. */
      if (students.length < 2) {
        picker.hidden = true;
        var lab = document.querySelector('label[for="student"]');
        if (lab) lab.hidden = true;
      }
      pick();
    }).catch(fail);
  }

  picker.addEventListener("change", pick);

  function pick() {
    stopClock();
    student = students.filter(function (s) { return s.id === picker.value; })[0];
    Store.submissions({ studentId: student.id, worksheetId: EX.id })
      .then(function (list) {
        sub = list[0] || null;
        paper = TPQuiz.paper(EX, TPQuiz.formOf(EX, student));
        render();
      }).catch(fail);
  }

  /* ─── العرض ─── */
  function render() {
    var form = TPQuiz.formOf(EX, student);
    var started = !!sub;
    var locked = sub && sub.status === "submitted";

    stateEl.textContent = "النموذج " + ar(form + 1) +
      (locked ? " · سُلِّم" : started ? " · جارٍ" : " · لم يبدأ");

    document.getElementById("start").hidden  = started || locked;
    document.getElementById("submit").hidden = !started || locked;
    clock.hidden = !started || locked;

    itemsBox.textContent = "";
    itemsBox.className = locked ? "locked" : "";

    if (!started) {
      itemsBox.appendChild(TPUI.empty(
        "الأسئلة تظهر بعد الضغط على «ابدئي الاختبار».",
        "الوقت يبدأ من تلك اللحظة، ويُحسب في الخادم — فإعادة تحميل الصفحة لا تُعيده."));
      return;
    }

    var ans = (sub.answers || {});
    paper.forEach(function (q, i) {
      var box = el("div", "item");
      box.appendChild(el("div", "qno",
        "السؤال " + ar(i + 1) + " · " + q.part + " — " + ar(q.points) +
        (q.points === 1 ? " درجة" : " درجات")));
      box.appendChild(el("div", "prompt", q.prompt));

      if (q.kind === "tf") buildTf(box, q, ans, locked);
      else if (q.kind === "mcq") buildMcq(box, q, ans, locked);
      else if (q.kind === "multi") buildMulti(box, q, ans, locked);
      else if (q.kind === "cloze") buildCloze(box, q, ans, locked);
      else buildProof(box, q, ans, locked);

      if (locked && q.why) box.appendChild(el("div", "why", q.why));
      itemsBox.appendChild(box);
    });

    if (locked) showResult();
    else startClock();
  }

  function put(id, v) {
    sub.answers = sub.answers || {};
    sub.answers[id] = v;
    save(true);
  }

  function buildTf(box, q, ans, locked) {
    var ul = el("ul", "choices tf");
    [[true, "صواب"], [false, "خطأ"]].forEach(function (o) {
      var li = el("li"), lab = el("label");
      var input = document.createElement("input");
      input.type = "radio"; input.name = q.id;
      input.checked = ans[q.id] === o[0];
      input.disabled = locked;
      input.addEventListener("change", function () { put(q.id, o[0]); markPicked(ul); });
      lab.appendChild(input);
      lab.appendChild(el("span", "", o[1]));
      if (ans[q.id] === o[0]) lab.classList.add("picked");
      if (locked) {
        if (o[0] === q.answer) lab.classList.add("correct");
        else if (ans[q.id] === o[0]) lab.classList.add("yours");
      }
      li.appendChild(lab); ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  function buildMcq(box, q, ans, locked) {
    var ul = el("ul", "choices");
    (q.options || []).forEach(function (opt, oi) {
      var li = el("li"), lab = el("label");
      var input = document.createElement("input");
      input.type = "radio"; input.name = q.id; input.value = oi;
      input.checked = ans[q.id] === oi;
      input.disabled = locked;
      input.addEventListener("change", function () { put(q.id, oi); markPicked(ul); });
      lab.appendChild(input);
      lab.appendChild(el("span", "", "أبجد".charAt(oi) || String(oi + 1)));
      lab.appendChild(el("span", "", opt));
      if (ans[q.id] === oi) lab.classList.add("picked");
      if (locked) {
        if (oi === q.answer) lab.classList.add("correct");
        else if (ans[q.id] === oi) lab.classList.add("yours");
      }
      li.appendChild(lab); ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  /*  متعدّد الإجابات: مربّعاتٌ لا دوائر — الشكل نفسه يقول إن
      المطلوب أكثر من واحد، فلا تُظنّ الواحدة كافية. */
  function buildMulti(box, q, ans, locked) {
    box.appendChild(el("div", "multi-hint",
      q.partial ? "اختاري كل ما ينطبق — لكل صحيحةٍ سهمٌ ولكل خاطئةٍ خصم."
                : "اختاري كل ما ينطبق — لا تُنال الدرجة إلا بإصابتها كلها."));
    var ul = el("ul", "choices multi");
    var picked = Array.isArray(ans[q.id]) ? ans[q.id].map(Number) : [];
    (q.options || []).forEach(function (opt, oi) {
      var li = el("li"), lab = el("label");
      var input = document.createElement("input");
      input.type = "checkbox"; input.value = oi;
      input.checked = picked.indexOf(oi) >= 0;
      input.disabled = locked;
      input.addEventListener("change", function () {
        var now = [].slice.call(ul.querySelectorAll("input:checked"))
                    .map(function (x) { return +x.value; });
        put(q.id, now);
        [].slice.call(ul.querySelectorAll("label")).forEach(function (l) {
          l.classList.toggle("picked", l.querySelector("input").checked);
        });
      });
      lab.appendChild(input);
      lab.appendChild(el("span", "", "أبجد".charAt(oi) || String(oi + 1)));
      lab.appendChild(el("span", "", opt));
      if (picked.indexOf(oi) >= 0) lab.classList.add("picked");
      if (locked) {
        var isRight = (q.answers || []).map(Number).indexOf(oi) >= 0;
        if (isRight) lab.classList.add("correct");
        else if (picked.indexOf(oi) >= 0) lab.classList.add("yours");
      }
      li.appendChild(lab); ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  function buildCloze(box, q, ans, locked) {
    var input = document.createElement("input");
    input.type = "text";
    input.className = "cloze-in";
    input.value = ans[q.id] || "";
    input.disabled = locked;
    input.placeholder = "الكلمة الناقصة";
    input.addEventListener("input", function () { put(q.id, input.value); });
    box.appendChild(input);
    if (locked) {
      var right = (TPQuiz.grade(EX, [q], ans).auto > 0);
      box.appendChild(el("div", "cloze-mark " + (right ? "correct" : "yours"),
        right ? "صواب" : "الصواب: " + (q.accept || []).join(" أو ")));
    }
  }

  function buildProof(box, q, ans, locked) {
    var t = document.createElement("textarea");
    t.rows = q.rows || 7;
    t.value = ans[q.id] || "";
    t.disabled = locked;
    t.placeholder = "اكتبي الدليل ووجه الدلالة";
    t.addEventListener("input", function () { put(q.id, t.value); });
    box.appendChild(t);
    box.appendChild(el("div", "hint-line", "تُصحَّح بيد الدكتورة."));
  }

  function markPicked(ul) {
    [].slice.call(ul.querySelectorAll("label")).forEach(function (l) {
      l.classList.toggle("picked", l.querySelector("input").checked);
    });
  }

  /* ─── البدء والحفظ والتسليم ─── */
  document.getElementById("start").addEventListener("click", function () {
    if (!confirm("يبدأ الوقت الآن: " + ar(EX.minutes) + " دقيقة. تبدئين؟")) return;
    Store.saveSubmission({
      studentId: student.id, worksheetId: EX.id, session: 0,
      answers: { _exam: { form: TPQuiz.formOf(EX, student), blur: 0 } },
      files: {}, status: "draft"
    }).then(function (s) {
      sub = s;
      render();
    }).catch(fail);
  });

  var saveTimer = null;
  function save(quiet) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      Store.saveSubmission(sub).then(function (s) {
        sub.id = s.id;
        if (!quiet) TPUI.toast("حُفظ.", "good");
      }).catch(function (e) { TPUI.toast(e.message || "تعذّر الحفظ", "bad"); });
    }, 600);
  }

  document.getElementById("submit").addEventListener("click", function () {
    submit(false);
  });

  function submit(auto) {
    if (!sub || sub.status === "submitted") return;
    var left = paper.filter(function (q) {
      var v = (sub.answers || {})[q.id];
      return v == null || v === "" || (Array.isArray(v) && !v.length);
    }).length;
    if (!auto && left && !confirm("بقي " +
        TPUI.count(left, ["سؤال واحد", "سؤالان", "أسئلة", "سؤالًا"]) +
        " بلا إجابة. تسلّمين؟")) return;

    clearTimeout(saveTimer);
    stopClock();
    sub.status = "submitted";
    Store.saveSubmission(sub).then(function (s) {
      sub = s;
      render();
      TPUI.toast(auto ? "انتهى الوقت — سُلِّم الاختبار." : "سُلِّم الاختبار.", "good");
    }).catch(function (e) {
      sub.status = "draft";
      fail(e);
    });
  }

  /* ─── الساعة ───
     الوقت من started_at الذي كتبه الخادم. وإن لم يصل (وضعٌ محلي)
     فمن وقت الإنشاء على الجهاز — ويُقال ذلك في السطر السفلي. */
  function startClock() {
    stopClock();
    var base = Date.parse(sub.startedAt || sub.updatedAt || "") || Date.now();
    var ends = base + (+EX.minutes) * 60000;
    function paint() {
      var left = Math.max(0, ends - Date.now());
      var m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
      clock.textContent = ar(m) + ":" + ar((s < 10 ? "0" : "") + s);
      clock.classList.toggle("low", left < 5 * 60000);
      if (left <= 0) { stopClock(); submit(true); }
    }
    paint();
    tick = setInterval(paint, 1000);
  }

  function stopClock() { clearInterval(tick); tick = null; }

  /* ─── حارس المغادرة ───
     يُسجَّل عدد المرات ويُعرَض للدكتورة. ولا يُمنع شيء: صفحةٌ في
     متصفّح لا تملك منع جهازٍ ثانٍ ولا ورقةٍ على الطاولة. */
  var guard = document.getElementById("guard");
  document.getElementById("guardBack").addEventListener("click", function () {
    guard.hidden = true; guarded = false;
  });

  /*  visibilitychange يُطلَق على المستند ولا يصعد إلى النافذة،
      فالاستماع عليه لا عليها. (كان على النافذة فلم يُسمع شيء —
      كشفه الفحص.) */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) leave();
  });
  addEventListener("blur", function () { leave(); });

  function leave() {
    if (!sub || sub.status === "submitted" || guarded) return;
    guarded = true;
    sub.answers = sub.answers || {};
    var ex = sub.answers._exam = sub.answers._exam || { blur: 0 };
    ex.blur = (ex.blur || 0) + 1;
    save(true);
    document.getElementById("guardText").textContent =
      "سُجِّلت المغادرة (" + ar(ex.blur) + ") وتظهر للدكتورة مع ورقتك. " +
      "الوقت يمضي أثناء غيابك.";
    guard.hidden = false;
  }

  /* ─── النتيجة بعد التسليم ─── */
  function showResult() {
    var g = TPQuiz.grade(EX, paper, sub.answers || {});
    var box = el("div", "exam-result");
    box.appendChild(el("div", "er-k", "المصحَّح آليًّا"));
    box.appendChild(el("div", "er-v", ar(round(g.auto)) + " من " + ar(round(g.autoMax))));
    box.appendChild(el("div", "er-note",
      "وبقيت أسئلة «دلّل» (" + ar(round(g.manualMax)) +
      " درجة) تُصحَّح بيد الدكتورة، فالمجموع بعدها من " + ar(round(g.max)) + "."));
    var ex = (sub.answers || {})._exam || {};
    if (ex.blur) {
      box.appendChild(el("div", "er-blur",
        "غادرتِ الشاشة " + TPUI.count(ex.blur,
          ["مرةً واحدة", "مرتين", "مرات", "مرة"]) + " أثناء الاختبار."));
    }
    itemsBox.insertBefore(box, itemsBox.firstChild);
  }

  function round(n) { return Math.round(n * 100) / 100; }

  /* ─── لوحة الدكتورة ─── */
  function teacherPanel() {
    if (!window.TPRole) return;
    TPRole.get().then(function (r) {
      owner = (r === "teacher" || r === "admin");
      if (!owner) return;
      var box = document.getElementById("teacher");
      box.hidden = false;

      /*  زمن الاختبار يُكتب في content ليحرسه الخادم عند التسليم.
          ويُكتب من هنا — من جهة الدكتورة — لأن الطالبة لا تملك
          الكتابة فيه، ولأن الزمن قرارها هي لا قرار من تبدأ. */
      if (TPContent.get(EX.id, "minutes") !== String(EX.minutes)) {
        TPContent.set(EX.id, "minutes", String(EX.minutes))
          .catch(function () { /* تُعاد المحاولة عند الفتح القادم */ });
      }

      var sp = TPQuiz.spread(EX);
      var need = TPQuiz.need(EX);
      var short = need.filter(function (x) { return x.short > 0; });

      box.appendChild(el("div", "et-title",
        ar(sp.forms) + " نماذج، في كل نموذج " + ar(sp.size) + " سؤالًا"));

      /*  يُقال مقدار الاشتراك بصراحة: النماذج المتمايزة تمامًا
          تقتضي بنكًا بسعة (أسئلة الورقة × عدد النماذج)، وما دون
          ذلك اشتراكٌ لا حيلة فيه. */
      box.appendChild(el("div", "et-line",
        sp.shared
          ? "أكثر ما يشترك فيه نموذجان: " + ar(sp.shared) + " من " + ar(sp.size) +
            " سؤالًا، منها " + ar(sp.samePlace) + " في الموضع نفسه."
          : "لا يشترك نموذجان في سؤال."));

      if (short.length) {
        var ul = el("ul", "et-need");
        short.forEach(function (x) {
          ul.appendChild(el("li", "", x.label + ": في البنك " + ar(x.have) +
            " ويلزمه " + ar(x.want) + " — ينقصه " + ar(x.short)));
        });
        box.appendChild(el("div", "et-line",
          "ولتكون النماذج متمايزةً تمامًا يلزم توسيع البنك:"));
        box.appendChild(ul);
      }

      var row = el("div", "et-forms");
      for (var f = 0; f < sp.forms; f++) {
        (function (f) {
          var a = el("a", "btn sm", "طباعة النموذج " + ar(f + 1));
          a.href = "exam.html?x=" + encodeURIComponent(EX.id) +
                   "&section=" + encodeURIComponent(section.id) + "&form=" + f;
          row.appendChild(a);
        })(f);
      }
      box.appendChild(row);
    });
  }

  function fail(e) {
    console.error(e);
    TPUI.toast((e && e.message) || "حدث خطأ.", "bad");
  }
})();
