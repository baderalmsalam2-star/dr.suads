/* ═══ كشف الطالبات: إضافة وتعديل وترتيب واستيراد ═══ */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var section = null;

  TPUI.chrome("students", "الطالبات");
  document.getElementById("credit").textContent = (window.COURSE || {}).credit || "";

  section = TPUI.sectionPicker(document.getElementById("section"), function (s) {
    section = s; render();
  });

  var table = document.getElementById("table");
  var emptyBox = document.getElementById("emptyBox");

  /* ─── لصق الكشف ─── */
  var pasteBox = document.getElementById("pasteBox");
  var pasteText = document.getElementById("pasteText");

  document.getElementById("paste").addEventListener("click", function () {
    pasteBox.hidden = false;
    Store.students(section.id).then(function (list) {
      pasteText.value = list.filter(function (s) { return !s.placeholder; })
        .map(function (s) { return s.name; }).join("\n");
      pasteText.focus();
    });
  });
  document.getElementById("pasteCancel").addEventListener("click", function () { pasteBox.hidden = true; });

  document.getElementById("pasteSave").addEventListener("click", function () {
    var names = pasteText.value.split("\n")
      .map(function (n) { return n.trim(); })
      .filter(function (n) { return n.length; });
    if (!names.length) return TPUI.toast("لم تُدخلي أي اسم.", "bad");

    Store.students().then(function (all) {
      var mine = all.filter(function (s) { return String(s.sectionId) === String(section.id); });
      var others = all.filter(function (s) { return String(s.sectionId) !== String(section.id); });

      /* يُعاد استعمال معرّف الطالبة إن بقي اسمها في مكانه، حتى لا
         ينفصل سجل تفاعلها وتسليماتها عنها. */
      var byName = {};
      mine.forEach(function (s) { if (!s.placeholder) byName[s.name] = s; });

      var rebuilt = names.map(function (name, i) {
        var keep = byName[name];
        return keep
          ? Object.assign({}, keep, { no: i + 1, placeholder: false })
          : { id: Store.uid("st"), no: i + 1, sectionId: section.id, name: name, active: true };
      });

      return Store.setStudents(others.concat(rebuilt));
    }).then(function () {
      pasteBox.hidden = true;
      TPUI.toast("حُفظ كشف " + section.name + " — " + TPUI.students(names.length) + ".", "good");
      render();
    }).catch(fail);
  });

  /* ─── إضافة طالبة ─── */
  document.getElementById("add").addEventListener("click", function () {
    var name = prompt("اسم الطالبة:");
    if (!name || !name.trim()) return;
    Store.students(section.id).then(function (list) {
      return Store.saveStudent({
        no: list.length + 1, sectionId: section.id,
        name: name.trim(), active: true
      });
    }).then(function () { TPUI.toast("أُضيفت الطالبة.", "good"); render(); }).catch(fail);
  });

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

      if (!list.length) {
        table.hidden = true;
        emptyBox.appendChild(TPUI.empty("لا توجد طالبات في هذه الشعبة بعد.",
          "اضغطي «لصق كشف الأسماء» وألصقي الأسماء اسمًا في كل سطر."));
        return;
      }
      table.hidden = false;

      var head = el("thead");
      var hr = el("tr");
      ["#", "الاسم", "نقاط التفاعل", "التسليمات", ""].forEach(function (h) {
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

        var tdName = el("td");
        var a = el("a", "", s.name);
        a.href = "student.html?id=" + encodeURIComponent(s.id);
        tdName.appendChild(a);
        if (s.placeholder) {
          tdName.appendChild(document.createTextNode(" "));
          tdName.appendChild(el("span", "chip", "اسم مبدئي"));
        }
        tr.appendChild(tdName);

        var row = rank[s.id];
        tr.appendChild(el("td", "num", ar((row && row.points) || 0)));
        tr.appendChild(el("td", "num", ar(subs[s.id] || 0)));

        var tdAct = el("td", "num");
        var ren = el("button", "sm ghost", "تعديل");
        ren.addEventListener("click", function () {
          var n = prompt("اسم الطالبة:", s.name);
          if (!n || !n.trim()) return;
          Store.saveStudent({ id: s.id, name: n.trim(), placeholder: false })
            .then(render).catch(fail);
        });
        var del = el("button", "sm danger", "حذف");
        del.addEventListener("click", function () {
          if (!confirm("حذف «" + s.name + "»؟ سجل تفاعلها وتسليماتها لن يظهر بعد الحذف.")) return;
          Store.removeStudent(s.id).then(render).catch(fail);
        });
        tdAct.appendChild(ren);
        tdAct.appendChild(document.createTextNode(" "));
        tdAct.appendChild(del);
        tr.appendChild(tdAct);

        body.appendChild(tr);
      });
      table.appendChild(body);

      if (anyPlaceholder) {
        emptyBox.appendChild(el("div", "note-box",
          "الأسماء المعلّمة بـ«اسم مبدئي» مولَّدة تلقائيًا من عدد الشعبة في data/course.js. " +
          "استبدليها بالكشف الحقيقي من زر «لصق كشف الأسماء» — أرقام القارئات في الحصص تتبع ترتيب الكشف."));
      }
    }).catch(fail);
  }

  function fail(e) {
    console.error(e);
    TPUI.toast(e && e.message ? e.message : "حدث خطأ.", "bad");
  }

  render();
})();
