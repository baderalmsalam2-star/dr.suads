/* ═══ كشف الطالبات: إضافة وتعديل وترتيب واستيراد ═══ */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var section = null;

  TPUI.chrome("students", "الطالبات");
  TPUI.credit("credit");

  section = TPUI.sectionPicker(document.getElementById("section"), function (s) {
    section = s; render();
  });

  var table = document.getElementById("table");
  var emptyBox = document.getElementById("emptyBox");

  /* ─── لصق الكشف ─── */
  var pasteBox = document.getElementById("pasteBox");
  var pasteText = document.getElementById("pasteText");

  /* يُملأ من الكشف المعروض فورًا، لا بجلب غير متزامن — وإلا داس
     الجلبُ المتأخر ما كتبته الدكتورة بعد فتح الصندوق. */
  document.getElementById("paste").addEventListener("click", function () {
    pasteBox.hidden = false;
    pasteText.value = shown.filter(function (s) { return !s.placeholder; })
      .map(function (s) { return (s.uid ? s.uid + " " : "") + s.name; })
      .join("\n");
    pasteText.focus();
  });
  document.getElementById("pasteCancel").addEventListener("click", function () { pasteBox.hidden = true; });

  /* السطر إما اسم وحده، أو رقم جامعي ثم اسم (أو العكس).
     الرقم: ٦ خانات فأكثر في أول السطر أو آخره. */
  function parseLine(line) {
    var t = line.replace(/[\t،,;|]+/g, " ").replace(/\s+/g, " ").trim();
    var m = t.match(/^(\d{6,})\s+(.+)$/) || null;
    if (m) return { uid: m[1], name: m[2].trim() };
    m = t.match(/^(.+?)\s+(\d{6,})$/);
    if (m) return { uid: m[2], name: m[1].trim() };
    return { uid: "", name: t };
  }

  document.getElementById("pasteSave").addEventListener("click", function () {
    var rows = pasteText.value.split("\n")
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length; })
      .map(parseLine)
      .filter(function (r) { return r.name.length; });
    if (!rows.length) return TPUI.toast("لم تُدخلي أي اسم.", "bad");

    Store.students().then(function (all) {
      var mine = all.filter(function (s) { return String(s.sectionId) === String(section.id); });
      var others = all.filter(function (s) { return String(s.sectionId) !== String(section.id); });

      /* يُعاد استعمال معرّف الطالبة إن بقيت في الكشف — بالرقم الجامعي
         أولًا ثم بالاسم — حتى لا ينفصل سجل تفاعلها وتسليماتها عنها. */
      var byUid = {}, byName = {};
      mine.forEach(function (s) {
        if (s.placeholder) return;
        if (s.uid) byUid[s.uid] = s;
        byName[s.name] = s;
      });

      var rebuilt = rows.map(function (r, i) {
        var keep = (r.uid && byUid[r.uid]) || byName[r.name];
        return keep
          ? Object.assign({}, keep, { no: i + 1, name: r.name,
                                      uid: r.uid || keep.uid || "", placeholder: false })
          : { id: Store.uid("st"), no: i + 1, sectionId: section.id,
              name: r.name, uid: r.uid, active: true };
      });

      return Store.setStudents(others.concat(rebuilt));
    }).then(function () {
      pasteBox.hidden = true;
      var withId = rows.filter(function (r) { return r.uid; }).length;
      TPUI.toast("حُفظ كشف " + section.name + " — " + TPUI.students(rows.length) +
                 (withId ? " (" + ar(withId) + " بأرقام جامعية)" : "") + ".", "good");
      render();
    }).catch(fail);
  });

  /* ─── إضافة طالبة ─── */
  var editing = null;            /* معرّف الصف المفتوح للتحرير، أو "new" */
  var shown = [];                /* الكشف المعروض حاليًا */

  document.getElementById("add").addEventListener("click", function () {
    editing = "new";
    render();
  });

  /* ─── استقبال التسجيل بالباركود ─── */
  var intakeBox = document.getElementById("intakeBox");
  var scanLog = document.getElementById("scanLog");
  var cam = document.getElementById("cam");
  var stream = null, scanning = false, lastSeen = "";

  document.getElementById("intake").addEventListener("click", function () {
    intakeBox.hidden = !intakeBox.hidden;
    if (intakeBox.hidden) stopCam();
    else document.getElementById("camNote").textContent = camSupport()
      ? "وجّهي الكاميرا إلى رمز الطالبة — تُضاف فور قراءتها."
      : "هذا المتصفح لا يدعم قراءة الباركود بالكاميرا. استعملي اللصق أو الملفات، أو افتحي المنصة في Chrome.";
  });

  function camSupport() {
    return "BarcodeDetector" in window && navigator.mediaDevices &&
           navigator.mediaDevices.getUserMedia;
  }

  document.getElementById("camStart").addEventListener("click", function () {
    if (!camSupport()) return TPUI.toast("الكاميرا غير مدعومة في هذا المتصفح.", "bad");
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(function (st) {
        stream = st; cam.srcObject = st; cam.hidden = false; cam.play();
        document.getElementById("camStop").hidden = false;
        scanning = true;
        loop(new window.BarcodeDetector({ formats: ["qr_code"] }));
      })
      .catch(function (e) {
        TPUI.toast("تعذّر فتح الكاميرا: " + (e.message || ""), "bad");
      });
  });

  document.getElementById("camStop").addEventListener("click", stopCam);

  function stopCam() {
    scanning = false;
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null; cam.hidden = true;
    document.getElementById("camStop").hidden = true;
  }

  function loop(detector) {
    if (!scanning) return;
    detector.detect(cam).then(function (codes) {
      if (codes && codes.length) {
        var v = codes[0].rawValue;
        if (v && v !== lastSeen) { lastSeen = v; take([v]); }
      }
    }).catch(function () { /* إطار غير صالح — تجاهل */ })
      .then(function () { setTimeout(function () { loop(detector); }, 350); });
  }

  /* ─── اللصق والملفات ─── */
  document.getElementById("addCodes").addEventListener("click", function () {
    var lines = document.getElementById("pasteCodes").value
      .split("\n").map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length; });
    if (!lines.length) return TPUI.toast("الصقي رمزًا واحدًا على الأقل.", "bad");
    take(lines);
    document.getElementById("pasteCodes").value = "";
  });

  var joinFileInput = document.getElementById("joinFileInput");
  document.getElementById("joinFiles").addEventListener("click", function () { joinFileInput.click(); });
  joinFileInput.addEventListener("change", function () {
    var files = [].slice.call(joinFileInput.files);
    Promise.all(files.map(function (f) {
      return TPUI.readAsText(f).then(function (t) {
        var o = JSON.parse(t);
        return o && o.kind === "tp-join" ? o.code : null;
      }).catch(function () { return null; });
    })).then(function (codes) {
      take(codes.filter(Boolean));
    }).then(function () { joinFileInput.value = ""; });
  });

  /* ─── إضافة المسجَّلات ─── */
  function parse(code) {
    var p = String(code).split("|");
    if (p[0] !== "TPJ1" || p.length < 4) return null;
    var name = p.slice(2, p.length - 1).join("|").trim();
    var uid = p[p.length - 1].trim();
    if (!name || !uid) return null;
    return { sectionId: p[1].trim(), name: name, uid: uid };
  }

  function take(codes) {
    var parsed = codes.map(parse);
    var bad = parsed.filter(function (x) { return !x; }).length;
    var added = 0, dup = 0;

    /* يُقرأ الكشف من جديد مع كل طالبة: لو قُرئ مرة واحدة لأخذت
       المسجَّلات كلُّهن نفس الموضع الشاغر فطمست إحداهن الأخرى. */
    var chain = Promise.resolve();
    parsed.filter(Boolean).forEach(function (rec) {
      chain = chain.then(function () {
        return Store.students(rec.sectionId).then(function (mine) {
          var exist = mine.filter(function (s) { return s.uid && s.uid === rec.uid; })[0];
          if (exist) {
            dup++; logLine(rec, "مسجَّلة من قبل", "dup");
            return Store.saveStudent({ id: exist.id, name: rec.name });
          }
          added++;
          logLine(rec, "أُضيفت", "new");
          var slot = mine.filter(function (s) { return s.placeholder; })
                         .sort(function (a, b) { return (a.no || 0) - (b.no || 0); })[0];
          if (slot) {
            return Store.saveStudent({ id: slot.id, name: rec.name, uid: rec.uid,
                                       placeholder: false });
          }
          return Store.saveStudent({ no: mine.length + 1, sectionId: rec.sectionId,
                                     name: rec.name, uid: rec.uid, active: true });
        });
      });
    });

    chain.then(function () { return { added: added, dup: dup }; }).then(function (r) {
      var msg = [];
      if (r.added) msg.push("أُضيفت " + TPUI.students(r.added));
      if (r.dup) msg.push(ar(r.dup) + " مسجَّلة من قبل");
      if (bad) msg.push(TPUI.codes(bad) + " غير صالح");
      TPUI.toast(msg.join(" · ") || "لا جديد.", bad && !r.added ? "bad" : "good");
      render();
    }).catch(fail);
  }

  function logLine(rec, what, cls) {
    var li = el("li", cls);
    li.appendChild(el("span", "", rec.name));
    li.appendChild(el("span", "sz", ar(rec.uid)));
    li.appendChild(el("span", "", what));
    scanLog.insertBefore(li, scanLog.firstChild);
    while (scanLog.children.length > 40) scanLog.removeChild(scanLog.lastChild);
  }

  /* ─── نسخة احتياطية واستعادة ─── */
  document.getElementById("backup").addEventListener("click", function () {
    Store.exportAll().then(function (data) {
      TPUI.download("tp-backup-" + Store.dayKey() + ".json", JSON.stringify(data, null, 2));
      TPUI.toast("نُزّلت النسخة الاحتياطية.", "good");
    }).catch(fail);
  });

  var restoreFile = document.getElementById("restoreFile");
  document.getElementById("restore").addEventListener("click", function () { restoreFile.click(); });
  restoreFile.addEventListener("change", function () {
    var f = restoreFile.files[0];
    if (!f) return;
    TPUI.readAsText(f)
      .then(function (t) { return Store.importAll(JSON.parse(t), "merge"); })
      .then(function (added) {
        TPUI.toast("أُضيف " + ar(added.students) + " طالبة و" + ar(added.events) +
                   " سجل تفاعل و" + ar(added.submissions) + " تسليمًا.", "good");
        render();
      }).catch(fail).then(function () { restoreFile.value = ""; });
  });

  /* ─── العرض ─── */
  function render() {
    Promise.all([
      Store.students(section.id),
      Store.ranking({ sectionId: section.id }),
      Store.submissions({})
    ]).then(function (r) {
      var list = r[0].slice().sort(function (a, b) { return (a.no || 0) - (b.no || 0); });
      shown = list;
      var rank = {};
      r[1].forEach(function (row) { rank[row.student.id] = row; });
      var subs = {};
      r[2].forEach(function (s) {
        if (s.status === "submitted") subs[s.studentId] = (subs[s.studentId] || 0) + 1;
      });

      document.getElementById("count").textContent =
        list.length ? TPUI.students(list.length) : "";
      document.getElementById("sub").textContent = section.name;

      table.textContent = "";
      emptyBox.textContent = "";

      if (!list.length && editing !== "new") {
        table.hidden = true;
        emptyBox.appendChild(TPUI.empty("لا توجد طالبات في هذه الشعبة بعد.",
          "«لصق كشف الأسماء» للكشف كاملًا، أو «إضافة طالبة» لواحدة."));
        return;
      }
      table.hidden = false;

      var head = el("thead");
      var hr = el("tr");
      ["#", "الاسم", "الرقم الجامعي", "نقاط التفاعل", "التسليمات", ""].forEach(function (h) {
        hr.appendChild(el("th", "", h));
      });
      head.appendChild(hr);
      table.appendChild(head);

      var body = el("tbody");
      var anyPlaceholder = false;

      list.forEach(function (s) {
        if (s.placeholder) anyPlaceholder = true;
        var tr = el("tr");
        tr.appendChild(el("td", "num", ar(s.no)));

        if (editing === s.id) {
          body.appendChild(editRow(tr, s));
          return;
        }

        var tdName = el("td");
        var a = el("a", "", s.name);
        a.href = "student.html?id=" + encodeURIComponent(s.id);
        tdName.appendChild(a);
        if (s.placeholder) {
          tdName.appendChild(document.createTextNode(" "));
          tdName.appendChild(el("span", "chip", "اسم مبدئي"));
        }
        tr.appendChild(tdName);
        tr.appendChild(el("td", "num", s.uid ? ar(s.uid) : "—"));

        var row = rank[s.id];
        tr.appendChild(el("td", "num", ar((row && row.points) || 0)));
        tr.appendChild(el("td", "num", ar(subs[s.id] || 0)));

        var tdAct = el("td", "num");
        var ren = el("button", "sm ghost", "تعديل");
        ren.addEventListener("click", function () { editing = s.id; render(); });
        var del = el("button", "sm danger", "حذف");
        del.addEventListener("click", function () {
          if (!confirm("حذف «" + s.name + "»؟ سجل تفاعلها وتسليماتها لن يظهر بعد الحذف.")) return;
          Store.removeStudent(s.id).then(function () { editing = null; render(); }).catch(fail);
        });
        tdAct.appendChild(ren);
        tdAct.appendChild(document.createTextNode(" "));
        tdAct.appendChild(del);
        tr.appendChild(tdAct);

        body.appendChild(tr);
      });
      if (editing === "new") {
        var tr2 = el("tr");
        tr2.appendChild(el("td", "num", ar(list.length + 1)));
        body.appendChild(editRow(tr2, { sectionId: section.id, no: list.length + 1 }));
      }

      table.appendChild(body);

      if (anyPlaceholder) {
        emptyBox.appendChild(el("div", "note-box",
          "الأسماء المعلّمة بـ«اسم مبدئي» مولَّدة تلقائيًا من عدد الشعبة في data/course.js. " +
          "استبدليها بالكشف الحقيقي من زر «لصق كشف الأسماء» — أرقام القارئات في المحاضرات تتبع ترتيب الكشف."));
      }
    }).catch(fail);
  }

  /* صف تحرير داخل الجدول — أوضح من نافذة prompt، ويحرّر الاسم
     والرقم الجامعي معًا. Enter يحفظ و Esc يلغي. */
  function editRow(tr, s) {
    var isNew = !s.id;

    function field(val, placeholder, cls) {
      var i = document.createElement("input");
      i.type = "text";
      i.value = val || "";
      i.placeholder = placeholder;
      if (cls) i.className = cls;
      return i;
    }
    var nameIn = field(s.placeholder ? "" : s.name, "الاسم الكامل");
    var uidIn = field(s.uid, "الرقم الجامعي", "num");
    uidIn.setAttribute("inputmode", "numeric");

    var tdN = el("td"); tdN.appendChild(nameIn); tr.appendChild(tdN);
    var tdU = el("td"); tdU.appendChild(uidIn); tr.appendChild(tdU);
    tr.appendChild(el("td", "num", "—"));
    tr.appendChild(el("td", "num", "—"));

    function save() {
      var name = nameIn.value.trim().replace(/\s+/g, " ");
      var uid = uidIn.value.trim();
      if (name.length < 2) return TPUI.toast("اكتبي اسم الطالبة.", "bad");

      Store.students(section.id).then(function (list) {
        var clash = list.filter(function (x) {
          return uid && x.uid === uid && x.id !== s.id;
        })[0];
        if (clash) {
          TPUI.toast("الرقم الجامعي مستعمل لـ«" + clash.name + "».", "bad");
          throw new Error("dup");
        }
        return isNew
          ? Store.saveStudent({ no: list.length + 1, sectionId: section.id,
                                name: name, uid: uid, active: true })
          : Store.saveStudent({ id: s.id, name: name, uid: uid, placeholder: false });
      }).then(function () {
        editing = null;
        TPUI.toast(isNew ? "أُضيفت الطالبة." : "حُفظ التعديل.", "good");
        render();
      }).catch(function (e) { if (e.message !== "dup") fail(e); });
    }

    function cancel() { editing = null; render(); }

    [nameIn, uidIn].forEach(function (i) {
      i.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); save(); }
        else if (e.key === "Escape") { e.preventDefault(); cancel(); }
      });
    });

    var tdAct = el("td", "num");
    var ok = el("button", "sm", "حفظ");
    ok.addEventListener("click", save);
    var no = el("button", "sm ghost", "إلغاء");
    no.addEventListener("click", cancel);
    tdAct.appendChild(ok);
    tdAct.appendChild(document.createTextNode(" "));
    tdAct.appendChild(no);
    tr.appendChild(tdAct);

    setTimeout(function () { nameIn.focus(); }, 0);
    return tr;
  }

  function fail(e) {
    console.error(e);
    TPUI.toast(e && e.message ? e.message : "حدث خطأ.", "bad");
  }

  render();
})();
