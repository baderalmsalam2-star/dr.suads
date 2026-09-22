/* ═══════════════════════════════════════════════════════════════
   أعمال الطالبات — تطوّعٌ لا درجة.

   ترفع الطالبة عملها متى شاءت: عنوانٌ ووصفٌ وملفّ. لا موعدَ ولا
   درجة — فمن لم ترفع شيئًا لم يُنقص منها. والدكتورة تراه، وتعرضه
   على الشاشة إن أُذن لها.

   ═══ صورة أو PDF، وشرطٌ لا عبارة ═══
   المتصفّح يعرض الصور وPDF ولا يعرض Word وPowerPoint — يُنزَّلان
   ثم يُفتحان ببرنامجٍ آخر. وذاك يكسر العرض في القاعة: تقف الدكتورة
   أمام طالباتها تنتظر تحميلًا. فالقبولُ مقصورٌ عليهما، ويُردّ
   غيرُهما هنا لا في القاعة.

   ═══ والإذن بالعرض بيد صاحبته ═══
   عرضُ عمل طالبةٍ أمام صفّها قرارٌ يخصّها، فلا يُؤخذ ضمنًا من
   مجرّد رفعها إيّاه. والأصل «لا»، وتسحب موافقتها متى شاءت.

   ═══ والصورة تُصغَّر قبل أن تُرفع ═══
   صور الجوّال اليوم أربعة إلى ثمانية ميجابايت، والصندوق جيجابايت
   واحد. فتُصغَّر إلى ١٦٠٠ بكسل في المتصفّح — وهو قدرُ ما تحتاجه
   شاشةُ العرض — فيكفي الصندوقُ فصلًا بدل شهر.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var el = TPUI.el, ar = TP.ar;
  var MAX_SIDE = 1600, MAX_BYTES = 8 * 1024 * 1024;

  document.title = "أعمال الطالبات — " + (COURSE.title || "منصة التدريس");
  TPUI.chrome("works", COURSE.title, "أعمال الطالبات");
  TPUI.credit("credit");

  var listBox = document.getElementById("list");
  var staff = false, mine = [], picked = null;

  var section = TPUI.sectionPicker(document.getElementById("section"), function (s) {
    section = s; load();
  });

  /* ─── تصغير الصورة ─── */
  function shrink(file) {
    if (!/^image\//.test(file.type)) {
      return TPUI.readAsDataURL(file).then(function (d) {
        return { data: d, type: file.type, name: file.name, size: file.size };
      });
    }
    return new Promise(function (done, fail) {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var k = Math.min(1, MAX_SIDE / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.round(w * k);
        c.height = Math.round(h * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        var data = c.toDataURL("image/jpeg", 0.82);
        URL.revokeObjectURL(img.src);
        done({ data: data, type: "image/jpeg",
               name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
               size: Math.round((data.length - 22) * 0.75) });
      };
      /*  صورةٌ لا تُفكّ — ملفٌّ تالفٌ أو صيغةٌ لا يعرفها المتصفّح —
          تُردّ باسمها بدل أن تُرفع ثم لا تُعرض. */
      img.onerror = function () { fail(new Error("تعذّرت قراءة الصورة. جرّبي صورةً أخرى.")); };
      img.src = URL.createObjectURL(file);
    });
  }

  /* ─── الرفع ─── */
  var drop = document.getElementById("drop");
  var input = document.getElementById("wFile");
  drop.addEventListener("click", function () { input.click(); });
  input.addEventListener("change", function () {
    var f = input.files[0];
    input.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type) && f.type !== "application/pdf") {
      return TPUI.toast("صورة أو PDF فقط. ملفات Word وPowerPoint لا تُعرض على الشاشة — صوّري عملك أو حوّليه PDF.", "bad");
    }
    if (f.size > MAX_BYTES) {
      return TPUI.toast("الملف أكبر من ثمانية ميجابايت.", "bad");
    }
    document.getElementById("pick").textContent = "جارٍ التحضير…";
    shrink(f).then(function (r) {
      picked = r;
      document.getElementById("pick").textContent =
        r.name + " — " + ar(Math.max(1, Math.round(r.size / 1024))) + " ك.ب";
    }).catch(function (e) {
      picked = null;
      document.getElementById("pick").textContent = "";
      TPUI.toast(e.message || "تعذّر تحضير الملف.", "bad");
    });
  });

  document.getElementById("wSave").addEventListener("click", function () {
    var title = document.getElementById("wTitle").value.trim();
    var note = document.getElementById("wNote").value.trim();
    var shared = document.getElementById("wShared").checked;
    if (title.length < 3) return TPUI.toast("اكتبي عنوانًا للعمل.", "bad");
    if (!picked) return TPUI.toast("اختاري صورةً أو ملفَّ PDF.", "bad");

    var me = mine[0];
    if (!me) return TPUI.toast("حسابك غير مرتبطٍ بصفٍّ في الكشف بعد.", "bad");

    var btn = this, st = document.getElementById("wState");
    btn.disabled = true;
    st.textContent = "جارٍ الرفع…";

    Store.putFile({ studentId: me.id, name: picked.name,
                    type: picked.type, size: picked.size, data: picked.data })
      .then(function (fileId) {
        return Store.saveWork({
          studentId: me.id, sectionId: section.id,
          title: title, note: note, shared: shared,
          fileId: fileId, fileName: picked.name, fileType: picked.type
        });
      })
      .then(function () {
        btn.disabled = false;
        st.textContent = "";
        document.getElementById("wTitle").value = "";
        document.getElementById("wNote").value = "";
        document.getElementById("wShared").checked = false;
        document.getElementById("pick").textContent = "";
        picked = null;
        TPUI.toast("أُضيف عملك.", "good");
        load();
      })
      .catch(function (e) {
        btn.disabled = false;
        st.textContent = "";
        TPUI.toast(e.message || "تعذّر الرفع.", "bad");
      });
  });

  /* ─── العرض ملء الشاشة ─── */
  var stage = document.getElementById("stage");
  var stageBody = document.getElementById("stageBody");
  var showing = null;

  function close() {
    stage.hidden = true;
    stageBody.textContent = "";
    if (showing) { URL.revokeObjectURL(showing); showing = null; }
  }
  document.getElementById("stageClose").addEventListener("click", close);
  addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  function present(w) {
    document.getElementById("stageTitle").textContent = w.title;
    stageBody.textContent = "جارٍ الفتح…";
    stage.hidden = false;
    Store.fileBlob(w.fileId).then(function (blob) {
      if (showing) URL.revokeObjectURL(showing);
      showing = URL.createObjectURL(blob);
      stageBody.textContent = "";
      if (/^image\//.test(w.fileType || "")) {
        var img = new Image();
        img.src = showing;
        img.alt = w.title;
        stageBody.appendChild(img);
      } else {
        /*  PDF في إطار: المتصفّح يعرضه بقارئه المدمج، فلا تُحمَّل
            مكتبةٌ خارجية ولا يخرج شيءٌ من النشرة. */
        var f = document.createElement("iframe");
        f.src = showing;
        f.title = w.title;
        stageBody.appendChild(f);
      }
    }).catch(function (e) {
      stageBody.textContent = e.message || "تعذّر فتح الملف.";
    });
  }

  /* ─── القائمة ─── */
  function card(w, byName) {
    var li = el("li", "card ready");
    li.appendChild(el("span", "badge", w.shared ? "مأذونٌ بعرضه" : "خاصّ"));
    var body = el("div", "body");
    if (byName) body.appendChild(el("span", "no", byName));
    body.appendChild(el("h2", "", w.title));
    if (w.note) body.appendChild(el("div", "sub", w.note));
    var meta = el("div", "meta");
    meta.appendChild(el("span", "", w.createdAt ? TPUI.arDate(w.createdAt.slice(0, 10)) : ""));
    meta.appendChild(el("span", "readers",
      /^image\//.test(w.fileType || "") ? "صورة" : "PDF"));
    body.appendChild(meta);
    li.appendChild(body);

    var row = el("div", "row");
    if (staff) {
      var open = el("button", "sm " + (w.shared ? "gold" : "ghost"), "اعرضيه");
      open.addEventListener("click", function () { present(w); });
      row.appendChild(open);
      if (!w.shared) {
        row.appendChild(el("span", "hint", "لم تأذن بعرضه — يُفتح لكِ وحدك"));
      }
    } else {
      var tog = el("button", "sm ghost", w.shared ? "اسحبي الموافقة" : "أوافق على عرضه");
      tog.addEventListener("click", function () {
        tog.disabled = true;
        Store.saveWork({ id: w.id, studentId: w.studentId, sectionId: w.sectionId,
                         title: w.title, note: w.note, shared: !w.shared,
                         fileId: w.fileId, fileName: w.fileName, fileType: w.fileType })
          .then(load)
          .catch(function (e) { tog.disabled = false; TPUI.toast(e.message, "bad"); });
      });
      row.appendChild(tog);

      var del = el("button", "sm danger", "احذفيه");
      del.addEventListener("click", function () {
        if (!confirm("حذف «" + w.title + "»؟")) return;
        Store.removeWork(w.id).then(load)
          .catch(function (e) { TPUI.toast(e.message, "bad"); });
      });
      row.appendChild(del);
    }
    li.appendChild(row);
    return li;
  }

  function load() {
    listBox.textContent = "";
    if (!Store.worksReady || !Store.worksReady()) {
      listBox.appendChild(TPUI.empty("تعمل مع الخادم فقط.",
        "أعمال الطالبات مشاركةٌ بين جهازين، ولا معنى لها بلا خادم."));
      return;
    }
    var q = staff ? { sectionId: section.id } : {};
    Promise.all([Store.works(q), staff ? Store.students(section.id) : Promise.resolve([])])
      .then(function (r) {
        var rows = r[0] || [], names = {};
        (r[1] || []).forEach(function (s) { names[s.id] = s.name; });
        listBox.textContent = "";
        if (!rows.length) {
          listBox.appendChild(TPUI.empty(
            staff ? "لم تُرفع أعمالٌ بعد." : "لم ترفعي عملًا بعد.",
            staff ? "تظهر هنا متى رفعت الطالبات أعمالهنّ."
                  : "أضيفي عملك من الأعلى — صورة أو PDF."));
          return;
        }
        document.getElementById("lead").textContent =
          staff ? ar(rows.length) + " عملًا · " +
                  ar(rows.filter(function (w) { return w.shared; }).length) + " مأذونٌ بعرضه"
                : ar(rows.length) + " من أعمالك";
        var ul = el("ul", "cards");
        rows.forEach(function (w) { ul.appendChild(card(w, staff ? names[w.studentId] : "")); });
        listBox.appendChild(ul);
      })
      .catch(function (e) {
        listBox.textContent = "";
        listBox.appendChild(TPUI.empty("تعذّر الجلب.", e.message || ""));
      });
  }

  TPRole.staff().then(function (ok) {
    staff = !!ok;
    document.getElementById("add").hidden = staff;
    if (staff) {
      document.getElementById("lead").textContent = "تعرضين ما أذنت به صاحبتُه.";
      return load();
    }
    /*  الطالبة ترفع باسم صفّها: مسارُ التخزين يبدأ بمعرّفه، وسياسةُ
        الصندوق تشترطه. فبلا صفٍّ في الكشف لا رفع. */
    return Store.students().then(function (rows) {
      mine = rows || [];
      if (!mine.length) {
        document.getElementById("add").hidden = true;
        document.getElementById("lead").textContent =
          "حسابك غير مرتبطٍ بصفٍّ في الكشف بعد — راجعي الدكتورة.";
      }
      load();
    });
  }).catch(function () { load(); });
})();
