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

  var itemsBox = document.getElementById("items");
  var stateEl = document.getElementById("state");
  var picker = document.getElementById("student");

  TPUI.chrome("worksheets", W ? W.title : "ورقة عمل", W ? W.subtitle : null);
  document.getElementById("credit").textContent = (window.COURSE || {}).credit || "";

  if (!W) {
    document.getElementById("emptyBox").appendChild(
      TPUI.empty("لم أجد هذه الورقة.", "ارجعي إلى صفحة أوراق العمل واختاري منها."));
    document.querySelector(".control").hidden = true;
    return;
  }
  document.getElementById("intro").textContent = W.intro || "";

  /* ─── اختيار الطالبة ─── */
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

  picker.addEventListener("change", pick);

  function pick() {
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
      box.appendChild(el("div", "prompt", it.prompt));

      if (it.kind === "mcq") buildMcq(box, it, locked);
      else if (it.kind === "file") buildFile(box, it, locked);
      else buildText(box, it, locked);

      if (locked && it.why) {
        box.appendChild(el("div", "why", it.why));
      }
      itemsBox.appendChild(box);
    });

    stateEl.textContent = locked
      ? "سُلِّمت في " + TPUI.arDate((sub.submittedAt || "").slice(0, 10))
      : (sub.id ? "مسودة محفوظة" : "لم تبدأ بعد");

    document.getElementById("submit").hidden = locked;
    document.getElementById("save").hidden = locked;
    document.getElementById("send").hidden = !locked;
    document.getElementById("reopen").hidden = !locked;
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
      lab.appendChild(el("span", "", opt));
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
          return Store.putFile({ name: f.name, type: f.type, size: f.size, data: data })
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

  /* ─── الحفظ والتسليم ─── */
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { save(true); }, 700);
  }

  function save(quiet) {
    if (sub.status === "submitted") return Promise.resolve();
    return Store.saveSubmission(sub).then(function (s) {
      sub = s;
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
      return v === undefined || v === null || (typeof v === "string" && !v.trim());
    });
    if (missing.length) {
      var idx = W.items.indexOf(missing[0]) + 1;
      return TPUI.toast("بقي " + ar(missing.length) + " سؤالًا بلا إجابة — أولها السؤال " + ar(idx) + ".", "bad");
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
  function credit() {
    return Store.events({ studentId: student.id }).then(function (evs) {
      if (evs.some(function (e) { return e.kind === "submit" && e.ref === W.id; })) return;
      var k = (((window.COURSE || {}).engagement || {}).kinds || [])
        .filter(function (x) { return x.id === "submit"; })[0];
      return Store.addEvent({
        studentId: student.id, sectionId: student.sectionId,
        kind: "submit", points: k ? k.points : 3, ref: W.id
      });
    });
  }

  document.getElementById("reopen").addEventListener("click", function () {
    if (!confirm("فتح الورقة للتعديل؟ ستعود مسودة وتُخفى الإجابات الصحيحة.")) return;
    sub.status = "draft";
    delete sub.submittedAt;
    Store.saveSubmission(sub).then(function (s) { sub = s; render(); }).catch(fail);
  });

  /* ملف التسليم — تستورده الدكتورة من صفحة أوراق العمل */
  document.getElementById("send").addEventListener("click", function () {
    var payload = {
      kind: "tp-submission", version: 1,
      studentId: student.id, studentName: student.name, sectionId: student.sectionId,
      worksheetId: W.id, worksheetTitle: W.title,
      submission: sub
    };
    var name = "tasleem-sec" + student.sectionId + "-no" + student.no +
               "-" + W.id + "-" + Store.dayKey() + ".json";
    TPUI.download(name, JSON.stringify(payload));
    TPUI.toast("نُزّل ملف التسليم باسم " + name + " — أرسليه للدكتورة.", "good");
  });

  function fail(e) {
    console.error(e);
    TPUI.toast(e && e.message ? e.message : "حدث خطأ.", "bad");
  }
})();
