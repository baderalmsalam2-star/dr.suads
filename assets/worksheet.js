/* ═══ حل ورقة العمل داخل البرنامج — بلا ورق وبلا درجات ═══
   تُحفظ المسودة تلقائيًا، وبعد التسليم تُقفل الحقول وتظهر
   الإجابة الصحيحة وتعليقها. */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var params = new URLSearchParams(location.search);
  var W = (window.WORKSHEETS || []).filter(function (w) {
    return w.id === params.get("w");
  })[0];

  var section = TP.resolveSection(params);
  var students = [], student = null, sub = null, saveTimer = null;
  var owner = false;                 /* يُضبط بعد سؤال TPRole */

  var itemsBox = document.getElementById("items");
  var stateEl = document.getElementById("state");
  var picker = document.getElementById("student");

  TPUI.credit("credit");

  if (!W) {
    TPUI.chrome("worksheets", "ورقة عمل", null);
    document.getElementById("emptyBox").appendChild(
      TPUI.empty("لم أجد هذه الورقة.", "ارجعي إلى صفحة أوراق العمل واختاري منها."));
    document.querySelector(".control").hidden = true;
    return;
  }

  /*  تصحيحات النصوص تُجلب من الخادم، فأول رسمٍ ينتظرها. وبلا هذا
      الانتظار يُرى النصّ الأصلي لحظةً ثم ينقلب إلى المصحَّح. */
  TPContent.ready().then(start).catch(start);

  function start() {
    TPUI.chrome("worksheets", W.title, W.subtitle);
    document.getElementById("intro").textContent = W.intro || "";
    windowSetup();
    editSetup();
    loadStudents();
  }

  /* ═══════════════════════════════════════════════════════════
     نافذة التسليم

     ما هنا بيانٌ لا حاجز: الحارس الحقيقي في الخادم (دالة
     stamp_submission ترفض التسليم خارج النافذة). فلو عُطِّل
     جافاسكربت أو أُرسل الطلب مباشرةً، بقي الحدّ قائمًا.
     وتُخفى الأزرار هنا لأن عرض زرٍّ يردّه الخادم عبثٌ لا حراسة.
     ═══════════════════════════════════════════════════════════ */
  var winBox = document.getElementById("window");
  var winState = document.getElementById("winState");

  function windowSetup() {
    if (!winBox) return;
    paintWindow();

    if (!window.TPRole) return;
    TPRole.get().then(function (r) {
      owner = (r === "teacher" || r === "admin");
      if (sub) render();             /* الأزرار تتبع الدور */
      if (!owner) return;
      var set = document.getElementById("winSet");
      set.hidden = false;
      winBox.hidden = false;

      var o = document.getElementById("opensAt");
      var d = document.getElementById("dueAt");
      var w = TPContent.window(W.id);
      o.value = toLocal(w.opens);
      d.value = toLocal(w.due);

      o.addEventListener("change", function () { saveWin("opensAt", o.value); });
      d.addEventListener("change", function () { saveWin("dueAt", d.value); });
      document.getElementById("winClear").addEventListener("click", function () {
        o.value = ""; d.value = "";
        Promise.all([TPContent.setWindow(W.id, "opensAt", ""),
                     TPContent.setWindow(W.id, "dueAt", "")])
          .then(function () { paintWindow(); render();
                              TPUI.toast("رُفع الموعد — التسليم مفتوح.", "good"); })
          .catch(fail);
      });
    });
  }

  function saveWin(field, localValue) {
    /*  حقل datetime-local يعطي وقتًا بلا منطقة. يُحوَّل إلى ISO
        بمنطقة الجهاز — وجهاز الدكتورة على توقيت الكويت، وهو الموعد
        الذي تقصده. */
    var iso = localValue ? new Date(localValue).toISOString() : "";
    TPContent.setWindow(W.id, field, iso).then(function () {
      paintWindow();
      render();
      TPUI.toast(iso ? "حُفظ الموعد." : "رُفع الموعد.", "good");
    }).catch(fail);
  }

  function toLocal(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return "";
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
           "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    var p = function (n) { return ar((n < 10 ? "0" : "") + n); };
    return TPUI.arDate(d.getFullYear() + "-" +
             ((d.getMonth() + 1) < 10 ? "0" : "") + (d.getMonth() + 1) + "-" +
             (d.getDate() < 10 ? "0" : "") + d.getDate()) +
           " · " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function paintWindow() {
    if (!winBox) return;
    var w = TPContent.window(W.id);
    var st = TPContent.isOpen(W.id);

    if (!w.opens && !w.due) {
      winState.textContent = "التسليم مفتوح — بلا موعد.";
      winState.className = "win-state";
      return;                            /* يبقى الصندوق مخفيًّا للطالبة */
    }
    winBox.hidden = false;
    winState.className = "win-state " + st;
    winState.textContent =
      st === "soon"   ? "لم يُفتح التسليم بعد — يُفتح " + when(w.opens) :
      st === "closed" ? "أُغلق التسليم — كان آخر موعد " + when(w.due) :
      w.due           ? "التسليم مفتوح — آخر موعد " + when(w.due)
                      : "التسليم مفتوح.";
  }

  /* ─── اختيار الطالبة ─── */
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
    pick();
  }).catch(fail);
  }

  picker.addEventListener("change", pick);

  function pick() {
    /* يُفرَّغ المؤجَّل على صاحبه قبل أن يتبدّل sub */
    flush();
    student = students.filter(function (s) { return s.id === picker.value; })[0];
    Store.submissions({ studentId: student.id, worksheetId: W.id }).then(function (list) {
      sub = list[0] || {
        studentId: student.id, worksheetId: W.id, session: W.session,
        answers: {}, files: {}, status: "draft"
      };
      render();
    }).catch(fail);
  }

  /* ─── بناء الأسئلة ─── */
  function render() {
    var locked = sub.status === "submitted";
    itemsBox.textContent = "";
    itemsBox.className = locked ? "locked" : "";

    W.items.forEach(function (it, idx) {
      var box = el("div", "item");
      box.appendChild(el("div", "qno",
        "السؤال " + ar(idx + 1) + (it.optional ? " · اختياري" : "")));
      box.appendChild(mark(el("div", "prompt", it.prompt), W.id + "#" + it.id, "prompt"));

      if (it.kind === "mcq") buildMcq(box, it, locked);
      else if (it.kind === "file") buildFile(box, it, locked);
      else if (it.kind === "sort") buildSort(box, it, locked);
      else if (it.kind === "pair") buildPair(box, it, locked);
      else if (it.kind === "order") buildOrder(box, it, locked);
      else if (it.kind === "table") buildTable(box, it, locked);
      else buildText(box, it, locked);

      if (locked && it.why) {
        box.appendChild(mark(el("div", "why", it.why), W.id + "#" + it.id, "why"));
      }
      itemsBox.appendChild(box);
    });

    stateEl.textContent = locked
      ? "سُلِّمت في " + TPUI.arDate((sub.submittedAt || "").slice(0, 10))
      : (sub.id ? "مسودة محفوظة" : "لم تبدأ بعد");

    /*  خارج النافذة تُخفى أزرار الحفظ والتسليم: الخادم يردّها على
        كل حال، وعرضُ زرٍّ مردود إيهامٌ لا حراسة. والدكتورة خارج
        الحدّ — تُدخل تسليم من اعتذرت، كما في الخادم سواءً بسواء. */
    var shut = !owner && TPContent.isOpen(W.id) !== "open";
    document.getElementById("submit").hidden = locked || shut;
    document.getElementById("save").hidden = locked || shut;
    document.getElementById("send").hidden = !locked;
    document.getElementById("reopen").hidden = !locked || !owner;

    applyEdit();                    /* الأسئلة بُنيت من جديد */
  }

  function buildMcq(box, it, locked) {
    var ul = el("ul", "choices");
    it.options.forEach(function (opt, oi) {
      var li = el("li");
      var lab = el("label");
      var input = document.createElement("input");
      input.type = "radio";
      input.name = it.id;
      input.value = oi;
      input.checked = sub.answers[it.id] === oi;
      input.disabled = locked;
      input.addEventListener("change", function () {
        sub.answers[it.id] = oi;
        markPicked(ul);
        autosave();
      });
      lab.appendChild(input);
      lab.appendChild(el("span", "", "أبجد".charAt(oi) || String(oi + 1)));
      lab.appendChild(mark(el("span", "", opt), W.id + "#" + it.id, "opt" + oi));
      if (sub.answers[it.id] === oi) lab.classList.add("picked");
      if (locked) {
        if (oi === it.answer) lab.classList.add("correct");
        /* اختيار الطالبة الخاطئ يُعلَّم صراحةً حتى تعرف أين وقع اللبس */
        else if (sub.answers[it.id] === oi) lab.classList.add("yours");
      }
      li.appendChild(lab);
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  function markPicked(ul) {
    [].slice.call(ul.querySelectorAll("label")).forEach(function (l) {
      l.classList.toggle("picked", l.querySelector("input").checked);
    });
  }

  function buildText(box, it, locked) {
    var input;
    if (it.kind === "essay") {
      input = document.createElement("textarea");
      input.rows = it.rows || 5;
    } else {
      input = document.createElement("input");
      input.type = "text";
    }
    input.value = sub.answers[it.id] || "";
    input.disabled = locked;
    input.placeholder = locked ? "" : "اكتبي إجابتك هنا";
    input.addEventListener("input", function () {
      sub.answers[it.id] = input.value;
      autosave();
    });
    box.appendChild(input);
  }

  /* ─── تصنيف: كل عنصر إلى خانته ───
     it.buckets = [{id,label}]  ·  it.entries = [{id,text,bucket}]
     الإجابة: { entryId: bucketId } */
  function buildSort(box, it, locked) {
    var ans = sub.answers[it.id] || (sub.answers[it.id] = {});
    var ul = el("ul", "sortlist");
    it.entries.forEach(function (e) {
      var li = el("li", "sortrow");
      li.appendChild(el("span", "txt", e.text));
      var sel = document.createElement("select");
      sel.disabled = locked;
      sel.setAttribute("aria-label", e.text);
      var blank = document.createElement("option");
      blank.value = ""; blank.textContent = "اختاري…";
      sel.appendChild(blank);
      it.buckets.forEach(function (b) {
        var o = document.createElement("option");
        o.value = b.id; o.textContent = b.label;
        if (ans[e.id] === b.id) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () {
        ans[e.id] = sel.value; autosave();
      });
      li.appendChild(sel);
      if (locked) {
        var ok = ans[e.id] === e.bucket;
        li.classList.add(ok ? "right" : "wrong");
        if (!ok) li.appendChild(el("span", "fix", "الصواب: " + bucketLabel(it, e.bucket)));
      }
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  function bucketLabel(it, id) {
    var b = it.buckets.filter(function (x) { return x.id === id; })[0];
    return b ? b.label : id;
  }

  /* ─── مطابقة: لكل طرفٍ أيمن نظيرُه ───
     it.pairs = [{id,left,right}] — والأيمن يُخلط في القائمة */
  function buildPair(box, it, locked) {
    var ans = sub.answers[it.id] || (sub.answers[it.id] = {});
    var opts = it.pairs.map(function (p) { return { id: p.id, text: p.right }; });
    opts = shuffleStable(opts, it.id);

    var ul = el("ul", "sortlist");
    it.pairs.forEach(function (p) {
      var li = el("li", "sortrow");
      li.appendChild(el("span", "txt", p.left));
      var sel = document.createElement("select");
      sel.disabled = locked;
      sel.setAttribute("aria-label", p.left);
      var blank = document.createElement("option");
      blank.value = ""; blank.textContent = "اختاري…";
      sel.appendChild(blank);
      opts.forEach(function (o) {
        var x = document.createElement("option");
        x.value = o.id; x.textContent = o.text;
        if (ans[p.id] === o.id) x.selected = true;
        sel.appendChild(x);
      });
      sel.addEventListener("change", function () { ans[p.id] = sel.value; autosave(); });
      li.appendChild(sel);
      if (locked) {
        var ok = ans[p.id] === p.id;
        li.classList.add(ok ? "right" : "wrong");
        if (!ok) li.appendChild(el("span", "fix", "الصواب: " + p.right));
      }
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  /* خلط ثابت لا يتغيّر بين فتحةٍ وأخرى، وإلا اضطربت إجابة محفوظة */
  function shuffleStable(list, seed) {
    var h = 0;
    for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    var out = list.slice();
    for (var j = out.length - 1; j > 0; j--) {
      h = (h * 1103515245 + 12345) >>> 0;
      var k = h % (j + 1);
      var t = out[j]; out[j] = out[k]; out[k] = t;
    }
    return out;
  }

  /* ─── ترتيب: رقم لكل عنصر ───
     it.steps = [{id,text}] بترتيبها الصحيح */
  function buildOrder(box, it, locked) {
    var ans = sub.answers[it.id] || (sub.answers[it.id] = {});
    var shown = shuffleStable(it.steps, it.id);
    var ul = el("ul", "sortlist");
    shown.forEach(function (stp) {
      var li = el("li", "sortrow");
      var sel = document.createElement("select");
      sel.className = "rank";
      sel.disabled = locked;
      sel.setAttribute("aria-label", stp.text);
      var blank = document.createElement("option");
      blank.value = ""; blank.textContent = "—";
      sel.appendChild(blank);
      it.steps.forEach(function (_, i) {
        var o = document.createElement("option");
        o.value = String(i + 1); o.textContent = ar(i + 1);
        if (String(ans[stp.id]) === String(i + 1)) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () { ans[stp.id] = sel.value; autosave(); });
      li.appendChild(sel);
      li.appendChild(el("span", "txt", stp.text));
      if (locked) {
        var want = it.steps.indexOf(stp) + 1;
        var ok = String(ans[stp.id]) === String(want);
        li.classList.add(ok ? "right" : "wrong");
        if (!ok) li.appendChild(el("span", "fix", "موضعها " + ar(want)));
      }
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  /* ─── جدول مقارنة: خلاياه نصّ تكتبه الطالبة ───
     it.rows = [نص] · it.cols = [نص] — الإجابة { "r|c": نص } */
  function buildTable(box, it, locked) {
    var ans = sub.answers[it.id] || (sub.answers[it.id] = {});
    var wrap = el("div", "wrap");
    var t = el("table", "grid cmp");
    var head = el("tr");
    head.appendChild(el("th", "", it.corner || ""));
    it.cols.forEach(function (c) { head.appendChild(el("th", "", c)); });
    t.appendChild(el("thead")).appendChild(head);

    var tb = el("tbody");
    it.rows.forEach(function (r, ri) {
      var tr = el("tr");
      tr.appendChild(el("th", "rowh", r));
      it.cols.forEach(function (c, ci) {
        var td = el("td");
        var key = ri + "|" + ci;
        var ta = document.createElement("textarea");
        ta.rows = it.rowsHigh || 2;
        ta.value = ans[key] || "";
        ta.disabled = locked;
        ta.setAttribute("aria-label", r + " — " + c);
        ta.addEventListener("input", function () { ans[key] = ta.value; autosave(); });
        td.appendChild(ta);
        tb.appendChild;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    box.appendChild(wrap);
  }

  function buildFile(box, it, locked) {
    var list = el("ul", "files");
    var current = sub.files[it.id] || [];

    function paint() {
      list.textContent = "";
      current.forEach(function (f, fi) {
        var li = el("li");
        li.appendChild(el("span", "nm", f.name));
        li.appendChild(el("span", "sz", TPUI.bytes(f.size)));
        if (!locked) {
          var rm = el("button", "sm danger", "حذف");
          rm.addEventListener("click", function () {
            Store.removeFile(f.fileId).catch(function () {});
            current.splice(fi, 1);
            sub.files[it.id] = current;
            paint(); autosave();
          });
          li.appendChild(rm);
        }
        list.appendChild(li);
      });
    }
    paint();
    box.appendChild(list);
    if (locked) return;

    var drop = el("div", "drop", "اسحبي الملف هنا أو اضغطي للاختيار (صورة أو PDF)");
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf";
    input.multiple = true;
    input.hidden = true;

    drop.addEventListener("click", function () { input.click(); });
    drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", function () { drop.classList.remove("over"); });
    drop.addEventListener("drop", function (e) {
      e.preventDefault(); drop.classList.remove("over");
      take([].slice.call(e.dataTransfer.files));
    });
    input.addEventListener("change", function () { take([].slice.call(input.files)); input.value = ""; });

    function take(files) {
      var MAX = 6 * 1024 * 1024;
      var tooBig = files.filter(function (f) { return f.size > MAX; });
      if (tooBig.length) {
        return TPUI.toast("الملف أكبر من ٦ م.ب: " + tooBig[0].name, "bad");
      }
      Promise.all(files.map(function (f) {
        return TPUI.readAsDataURL(f).then(function (data) {
          /* صفّ الطالبة يُمرَّر: هو أول جزءٍ من مسار التخزين، وسياسة
             Storage تشترطه. وبلا تمريره كان الرفع يُرفض على الخادم. */
          return Store.putFile({ name: f.name, type: f.type, size: f.size,
                                 data: data, studentId: sub.studentId })
            .then(function (fileId) {
              return { fileId: fileId, name: f.name, type: f.type, size: f.size };
            });
        });
      })).then(function (added) {
        current = current.concat(added);
        sub.files[it.id] = current;
        paint(); autosave();
        TPUI.toast("أُرفق " + ar(added.length) + " ملفًا.", "good");
      }).catch(fail);
    }

    box.appendChild(drop);
    box.appendChild(input);
  }

  function allFilled(v, list) {
    if (!v) return false;
    return (list || []).every(function (x) { return v[x.id]; });
  }

  function tableFilled(v, it) {
    if (!v) return false;
    for (var r = 0; r < it.rows.length; r++) {
      for (var c = 0; c < it.cols.length; c++) {
        var cell = v[r + "|" + c];
        if (!cell || !String(cell).trim()) return false;
      }
    }
    return true;
  }

  /* ─── الحفظ والتسليم ─── */
  function autosave() {
    clearTimeout(saveTimer);
    var target = sub;                  /* الكائن وقت الجدولة لا وقت التنفيذ */
    saveTimer = setTimeout(function () { save(true, target); }, 700);
  }

  /* يُنادى قبل تبديل الطالبة: يُلغي المؤجَّل ويحفظه فورًا على صاحبه.
     بلا هذا كان المؤقّت يستيقظ بعد التبديل فيقرأ sub الجديد، فيحفظ
     تسليم الطالبة الثانية (مسودة فارغة غالبًا) وتضيع إجابة الأولى. */
  function flush() {
    if (!saveTimer) return Promise.resolve();
    clearTimeout(saveTimer);
    saveTimer = null;
    return save(true, sub);
  }

  function save(quiet, target) {
    var rec = target || sub;
    if (rec.status === "submitted") return Promise.resolve();
    return Store.saveSubmission(rec).then(function (s) {
      if (rec === sub) sub = s;        /* لا تُصِب تسليمًا صار سابقًا */
      stateEl.textContent = "مسودة محفوظة";
      if (!quiet) TPUI.toast("حُفظت المسودة.", "good");
    }).catch(fail);
  }

  document.getElementById("save").addEventListener("click", function () { save(false); });
  document.getElementById("printBtn").addEventListener("click", function () { window.print(); });

  document.getElementById("submit").addEventListener("click", function () {
    var missing = W.items.filter(function (it) {
      if (it.optional) return false;
      if (it.kind === "file") return !(sub.files[it.id] || []).length;
      var v = sub.answers[it.id];
      if (it.kind === "sort")  return !allFilled(v, it.entries);
      if (it.kind === "pair")  return !allFilled(v, it.pairs);
      if (it.kind === "order") return !allFilled(v, it.steps);
      if (it.kind === "table") return !tableFilled(v, it);
      return v === undefined || v === null || (typeof v === "string" && !v.trim());
    });
    if (missing.length) {
      var idx = W.items.indexOf(missing[0]) + 1;
      return TPUI.toast("بقي " + TPUI.questions(missing.length) +
                        " بلا إجابة — أولها السؤال " + ar(idx) + ".", "bad");
    }
    if (!confirm("بعد التسليم تُقفل الإجابات وتظهر الإجابة الصحيحة. متابعة؟")) return;

    sub.status = "submitted";
    sub.submittedAt = new Date().toISOString();
    Store.saveSubmission(sub).then(function (s) {
      sub = s;
      return credit();
    }).then(function () {
      TPUI.toast("سُلِّمت الورقة. نُزّلي ملف التسليم وأرسليه للدكتورة.", "good");
      render();
    }).catch(fail);
  });

  /* رصد نقطة تفاعل للتسليم — مرة واحدة لكل ورقة */
  /* ─── نقطة التسليم ───
     كانت تُكتب حدثًا في جدول events. والطالبة لا تملك الكتابة فيه —
     وهذا مقصود ومُختبَر («لا ترصد نقاطًا لنفسها» في rls-test.sql).
     فكان كل تسليم على الخادم يردّ ٤٠٣ فتُقفل السلسلة وتُعرض للطالبة
     رسالةٌ تخصّ الدكتورة: «تأكدي أن حسابك مضاف في جدول owners».

     النقطة الآن تُشتقّ في Store.ranking من التسليمات نفسها — كما
     تُشتقّ بقية البنود المحسوبة — فلا تحتاج الطالبة صلاحية كتابة
     أصلًا، ولا يمكن رصدها مرتين. */
  function credit() { return Promise.resolve(); }

  document.getElementById("reopen").addEventListener("click", function () {
    if (!confirm("فتح الورقة للتعديل؟ ستعود مسودة وتُخفى الإجابات الصحيحة.")) return;
    sub.status = "draft";
    delete sub.submittedAt;
    Store.saveSubmission(sub).then(function (s) { sub = s; render(); }).catch(fail);
  });

  /* ملف التسليم — تستورده الدكتورة من صفحة أوراق العمل */
  document.getElementById("send").addEventListener("click", function () {
    var payload = {
      kind: "tp-submission", version: 3,
      studentId: student.id, studentName: student.name,
      studentUid: student.uid || "",      /* تُطابَق به عند الاستلام */
      sectionId: student.sectionId,
      worksheetId: W.id, worksheetTitle: W.title,
      submission: sub
    };
    var name = "tasleem-sec" + student.sectionId + "-no" + student.no +
               "-" + W.id + "-" + Store.dayKey() + ".json";

    /* ─── المرفقات تسافر مع الملف ───
       كان يُنزَّل بمراجع fileId فقط، والملفات باقية في IndexedDB على
       جهاز الطالبة — فتستورده الدكتورة وتضغط «فتح» فيقال لها «غير
       موجود على هذا الجهاز». تُضمَّن البايتات هنا، وتُرفض الحزمة إن
       تجاوزت الحدّ بدل أن تُنزَّل ناقصةً بلا علم. */
    var refs = [];
    Object.keys(sub.files || {}).forEach(function (k) {
      (sub.files[k] || []).forEach(function (f) { refs.push(f); });
    });

    var LIMIT = 15 * 1024 * 1024;
    Promise.all(refs.map(function (f) {
      return Store.getFile(f.fileId).then(function (rec) {
        return rec ? { fileId: f.fileId, name: f.name, type: f.type,
                       size: f.size, data: rec.data } : null;
      }).catch(function () { return null; });
    })).then(function (blobs) {
      var kept = blobs.filter(Boolean);
      payload.attachments = kept;
      var text = JSON.stringify(payload);

      if (text.length > LIMIT) {
        return TPUI.toast("المرفقات أكبر من " + TPUI.bytes(LIMIT) +
          ". احذفي مرفقًا أو أرسليه للدكتورة بوسيلة أخرى.", "bad");
      }
      if (kept.length < refs.length) {
        TPUI.toast("تعذّر ضمّ " + TP.ar(refs.length - kept.length) +
                   " من المرفقات — سلّميها بوسيلة أخرى.", "bad");
      }
      TPUI.download(name, text);
      TPUI.toast("نُزّل ملف التسليم باسم " + name +
                 (kept.length ? " ومعه " + TP.ar(kept.length) + " مرفقًا" : "") +
                 " — أرسليه للدكتورة.", "good");
    });
  });

  /* ═══════════════════════════════════════════════════════════
     تحرير النصوص — للدكتورة وحدها

     نصوص الأوراق في ملفات المقرر، والمنصة تُقدَّم من GitHub Pages
     فلا تُكتب الملفات من المتصفّح. فالتصحيح يُخزَّن في الخادم
     ويُطبَّق فوق الملفّ عند العرض (assets/content.js) — والملفّ
     يبقى الأصل، و«إرجاع الأصل» يحذف التصحيح لا يكتب فوقه.

     والتحرير في موضعه: تُنقر الكلمة حيث تُرى، لا في نموذجٍ آخر.
     ═══════════════════════════════════════════════════════════ */
  var editing = false;

  /* يُعلَّم العنصر بعنوانه فيعرفه وضعُ التحرير حين يُفتح */
  function mark(node, ref, field) {
    node.dataset.ref = ref;
    node.dataset.field = field;
    if (TPContent.has(ref, field)) node.classList.add("edited");
    return node;
  }

  function editSetup() {
    var btn = document.getElementById("editText");
    if (!btn || !window.TPRole) return;

    TPRole.get().then(function (r) {
      if (r !== "teacher" && r !== "admin") return;
      btn.hidden = false;
      btn.addEventListener("click", function () {
        editing = !editing;
        btn.textContent = editing ? "إنهاء التحرير" : "تحرير النصوص";
        btn.classList.toggle("gold", editing);
        applyEdit();
      });
    });
  }

  /*  يُستدعى بعد كل رسم: الأسئلة تُبنى من جديد عند تبديل الطالبة،
      فلا بدّ من إعادة تعليق المحرِّرات. */
  function applyEdit() {
    var live = [].slice.call(document.querySelectorAll("[data-ref][data-field]"));
    /* عنوان الورقة ومقدّمتها ليسا داخل الأسئلة، فيُعنونان هنا */
    [["intro", W.id, "intro"]].forEach(function (t) {
      var n = document.getElementById(t[0]);
      if (n && n.textContent) { n.dataset.ref = t[1]; n.dataset.field = t[2];
        if (TPContent.has(t[1], t[2])) n.classList.add("edited");
        live.push(n); }
    });

    document.body.classList.toggle("editing", editing);

    live.forEach(function (n) {
      n.contentEditable = editing ? "true" : "false";
      n.classList.toggle("editable", editing);
      if (editing && !n.dataset.bound) {
        n.dataset.bound = "1";
        n.addEventListener("blur", function () { commit(n); });
        n.addEventListener("keydown", function (e) {
          if (e.key === "Escape") { n.textContent = TPContent.get(n.dataset.ref, n.dataset.field); n.blur(); }
          /* Enter يُنهي التحرير بدل أن يُدخل سطرًا — النصوص سطرٌ واحد */
          if (e.key === "Enter") { e.preventDefault(); n.blur(); }
        });
      }
      /* زرّ «الأصل» يظهر على المصحَّح وحده */
      var old = n.parentNode && n.parentNode.querySelector(":scope > .revert");
      if (old) old.remove();
      if (editing && TPContent.has(n.dataset.ref, n.dataset.field)) {
        var r = el("button", "revert sm ghost", "الأصل");
        r.type = "button";
        r.title = "إرجاع نصّ الملفّ: " + TPContent.original(n.dataset.ref, n.dataset.field);
        r.addEventListener("click", function () {
          TPContent.set(n.dataset.ref, n.dataset.field, "").then(function () {
            n.textContent = TPContent.original(n.dataset.ref, n.dataset.field);
            n.classList.remove("edited");
            TPUI.toast("رجع نصّ الملفّ.", "good");
            applyEdit();
          }).catch(fail);
        });
        n.parentNode.insertBefore(r, n.nextSibling);
      }
    });
  }

  function commit(n) {
    var ref = n.dataset.ref, field = n.dataset.field;
    var now = n.textContent.trim();
    if (now === String(TPContent.get(ref, field) || "").trim()) return;
    if (!now) {
      /* فراغٌ ليس تصحيحًا — يُرجَع الأصل ويُقال ذلك */
      n.textContent = TPContent.original(ref, field) || "";
      TPUI.toast("النصّ لا يُترك فارغًا — رجع الأصل.", "bad");
      return;
    }
    TPContent.set(ref, field, now).then(function () {
      n.classList.toggle("edited", TPContent.has(ref, field));
      TPUI.toast("حُفظ النصّ.", "good");
      applyEdit();
    }).catch(function (e) {
      n.textContent = TPContent.get(ref, field);
      fail(e);
    });
  }

  function fail(e) {
    console.error(e);
    TPUI.toast(e && e.message ? e.message : "حدث خطأ.", "bad");
  }
})();
