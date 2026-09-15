/* ═══ صفحة الفحص — للمشرف التقني وحده ═══
   غرضها سؤال واحد: «المنصة لا تعمل، أين الخلل؟»
   فكل ما فيها إما فحصٌ يُجاب بنعم أو لا، أو رقمٌ يُقارَن، أو خطأٌ
   وقع فعلًا. ولا شيء فيها يخصّ التدريس. */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var el = TPUI.el, ar = TP.ar;
  var ERRORS = [];

  /* التقط الأخطاء من أول سطر — قبل أي شيء آخر في هذا الملف */
  window.addEventListener("error", function (e) {
    ERRORS.push({ when: new Date(), what: e.message,
                  where: (e.filename || "").split("/").pop() + ":" + e.lineno });
    renderErrors();
  });
  window.addEventListener("unhandledrejection", function (e) {
    ERRORS.push({ when: new Date(), what: String((e.reason && e.reason.message) || e.reason),
                  where: "وعد غير مُلتقَط" });
    renderErrors();
  });

  TPUI.chrome("admin", "الفحص", "المشرف التقني");
  document.getElementById("credit").textContent = COURSE.credit || "";

  TPRole.get().then(function (r) {
    if (r !== "admin") { document.getElementById("denied").hidden = false; return; }
    document.getElementById("panel").hidden = false;
    document.getElementById("who").textContent =
      "الدور: " + TPRole.label(r) +
      (TPRole.enforced() ? " · محروس بالخادم"
                         : " · وضع محلي — الدور هنا ترتيب واجهة لا حاجز أمان");
    runAll();
  });

  function runAll() {
    renderEnv();
    renderErrors();
    checks();
    sizes();
  }

  /* ─── الفحوص ─── */
  function checks() {
    var ul = document.getElementById("checks");
    ul.textContent = "";
    var list = [];

    function add(label, p, fixHint) {
      var li = el("li", "chk pending");
      li.appendChild(el("span", "mark", "…"));
      li.appendChild(el("span", "lbl", label));
      var det = el("span", "det", "جارٍ…");
      li.appendChild(det);
      ul.appendChild(li);

      var pr = Promise.resolve().then(p).then(function (r) {
        var ok = r === true || !!(r && r.ok);
        var warn = !ok && !!(r && r.warn);
        li.className = "chk " + (ok ? "good" : (warn ? "warn" : "bad"));
        li.querySelector(".mark").textContent = ok ? "✓" : (warn ? "⚠" : "✗");
        det.textContent = (r && r.note) || (ok ? "سليم" : (fixHint || "فشل"));
        return ok ? "good" : (warn ? "warn" : "bad");
      }).catch(function (e) {
        li.className = "chk bad";
        li.querySelector(".mark").textContent = "✗";
        det.textContent = e.message || "خطأ";
        return "bad";
      });
      list.push(pr);
    }

    add("التخزين المحلي يقبل الكتابة", function () {
      var k = "tp.probe";
      localStorage.setItem(k, "1");
      var v = localStorage.getItem(k);
      localStorage.removeItem(k);
      return v === "1" || { note: "المتصفح يمنع الحفظ — تصفح خاص؟" };
    }, "المتصفح يمنع الحفظ");

    add("تخزين الملفات (IndexedDB)", function () {
      if (!window.indexedDB) return { note: "غير مدعوم في هذا المتصفح" };
      return Store.putFile({ name: "probe", type: "text/plain", size: 1,
                             data: "data:text/plain;base64,YQ==" })
        .then(function (id) {
          return Store.getFile(id).then(function (f) {
            return Store.removeFile(id).then(function () {
              return !!f || { note: "كُتب ولم يُقرأ" };
            });
          });
        });
    });

    add("طبقة البيانات", function () {
      return Store.students().then(function (r) {
        return { ok: true, note: "المحوّل: " + Store.adapter + " · " +
                 TPUI.students(r.length) + " في الكشف" };
      });
    });

    add("الخادم موصول", function () {
      if (!window.TPAuth) return { warn: true, note: "وضع محلي — assets/config.js فارغ" };
      return TPAuth.me().then(function (me) {
        return me ? { ok: true, note: me.email } : { note: "لا جلسة — سجّلي الدخول" };
      });
    });

    add("توزيعة الدرجات تبلغ ١٠٠", function () {
      return Store.scheme(TP.resolveSection(new URLSearchParams("")).id)
        .then(function (sc) {
          var sum = (sc.items || []).reduce(function (a, i) {
            return a + (i.makeupFor ? 0 : (+i.max || 0));
          }, 0);
          return sum === 100 ? { ok: true, note: "١٠٠ ✓" }
                             : { note: "المجموع " + ar(sum) + " لا ١٠٠" };
        });
    });

    add("تواريخ الحصص داخل الفصل", function () {
      var T = COURSE.term || {};
      return Store.schedule(TP.resolveSection(new URLSearchParams("")).id)
        .then(function (m) {
          var n = Object.keys(m || {}).length;
          if (!n) return { warn: true, note: "لم تُولَّد التواريخ بعد" };
          var over = Object.keys(m).filter(function (k) {
            return T.lastClass && m[k] > T.lastClass;
          });
          return over.length ? { note: ar(over.length) + " حصة بعد آخر يوم دراسة" }
                             : { ok: true, note: TPUI.lessons(n) + " مجدولة" };
        });
    });

    add("لا تسليم يتيم بلا طالبة", function () {
      return Promise.all([Store.students(), Store.submissions({})])
        .then(function (r) {
          var ids = {};
          r[0].forEach(function (s) { ids[s.id] = true; });
          var orphan = r[1].filter(function (s) { return !ids[s.studentId]; });
          return orphan.length ? { note: ar(orphan.length) + " تسليمًا بلا طالبة" }
                               : { ok: true, note: ar(r[1].length) + " تسليمًا، كلها مرتبطة" };
        });
    });

    add("لا تكرار في أرقام الطالبات", function () {
      return Store.students().then(function (all) {
        var seen = {}, dup = [];
        all.forEach(function (s) {
          if (!s.uid) return;
          if (seen[s.uid]) dup.push(s.uid); else seen[s.uid] = true;
        });
        return dup.length ? { note: "رقم مكرّر: " + dup.join("، ") }
                          : { ok: true, note: "لا تكرار" };
      });
    });

    add("معرّفات الأنشطة فريدة", function () {
      var ids = {}, dup = [];
      (window.WORKSHEETS || []).forEach(function (w) {
        if (ids[w.id]) dup.push(w.id); else ids[w.id] = true;
        (w.items || []).forEach(function (i) {
          if (ids[i.id]) dup.push(i.id); else ids[i.id] = true;
        });
      });
      return dup.length ? { note: "مكرّر: " + dup.slice(0, 3).join("، ") }
                        : { ok: true, note: ar(Object.keys(ids).length) + " معرّفًا فريدًا" };
    });

    /* التنبيه ليس فشلًا: «وضع محلي» حالةٌ مقصودة لا عطل.
       خلطهما كان يقول «فشل ٣» وليس فيها إلا واحد. */
    Promise.all(list).then(function (rs) {
      var bad  = rs.filter(function (x) { return x === "bad"; }).length;
      var warn = rs.filter(function (x) { return x === "warn"; }).length;
      document.getElementById("checkSub").textContent =
        (bad ? "فشل " + ar(bad) + " من " + ar(rs.length) : "لا عطل")
        + (warn ? " · " + ar(warn) + " تنبيهًا" : "");
    });
  }

  /* ─── البيئة ─── */
  function renderEnv() {
    var rows = [
      ["المحوّل", Store.adapter],
      ["الخادم", (window.TP_CONFIG && TP_CONFIG.url) || "— (محلي)"],
      ["العنوان", location.origin === "null" ? "ملف محلي (file://)" : location.origin],
      ["اللوحة", (function () {
        try { return localStorage.getItem("tp.theme") || "جامعية"; } catch (e) { return "؟"; }
      })()],
      ["المتصفح", navigator.userAgent.slice(0, 90)],
      ["اللغة والمنطقة", navigator.language + " · " +
        Intl.DateTimeFormat().resolvedOptions().timeZone],
      ["اليوم عند الجهاز", Store.dayKey()],
      ["الحصص", ar((COURSE.sessions || []).length)],
      ["الأنشطة وأوراق العمل", ar((window.WORKSHEETS || []).length)]
    ];
    table("env", ["", ""], rows);
  }

  /* ─── الأحجام ─── */
  function sizes() {
    var keys = ["students", "events", "attendance", "submissions", "schedule", "grades", "scheme"];
    var rows = [], total = 0;
    keys.forEach(function (k) {
      var raw = "";
      try { raw = localStorage.getItem("tp.v1." + k) || ""; } catch (e) { /**/ }
      var n = 0;
      try { var v = JSON.parse(raw || "null"); n = Array.isArray(v) ? v.length
            : (v && typeof v === "object" ? Object.keys(v).length : 0); } catch (e) { /**/ }
      total += raw.length;
      rows.push([k, ar(n) + " سجلًا", TPUI.bytes(raw.length)]);
    });
    rows.push(["المجموع", "", TPUI.bytes(total)]);

    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function (e) {
        rows.push(["حصة الموقع من القرص",
                   TPUI.bytes(e.usage || 0) + " من " + TPUI.bytes(e.quota || 0), ""]);
        table("sizes", ["المفتاح", "العدد", "الحجم"], rows);
      });
    }
    table("sizes", ["المفتاح", "العدد", "الحجم"], rows);
  }

  function renderErrors() {
    var box = document.getElementById("errors");
    document.getElementById("errSub").textContent = ERRORS.length
      ? ar(ERRORS.length) : "لا شيء";
    if (!ERRORS.length) {
      box.hidden = true;
      TPUI.empty(document.getElementById("errEmpty"),
                 "لم يقع خطأ في هذه الجلسة.", "الأخطاء تُلتقط ما دامت الصفحة مفتوحة.");
      return;
    }
    box.hidden = false;
    document.getElementById("errEmpty").textContent = "";
    table("errors", ["الوقت", "الخطأ", "الموضع"],
      ERRORS.slice(-40).reverse().map(function (e) {
        return [e.when.toLocaleTimeString("ar-KW"), e.what, e.where];
      }));
  }

  function table(id, head, rows) {
    var t = document.getElementById(id);
    t.textContent = "";
    if (head.join("")) {
      var hr = el("tr");
      head.forEach(function (h) { hr.appendChild(el("th", "", h)); });
      t.appendChild(el("thead")).appendChild(hr);
    }
    var tb = el("tbody");
    rows.forEach(function (r) {
      var tr = el("tr");
      r.forEach(function (c, i) {
        tr.appendChild(el("td", i === 0 ? "" : "num", String(c)));
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
  }

  /* ─── الأزرار ─── */
  document.getElementById("recheck").addEventListener("click", runAll);

  document.getElementById("backup").addEventListener("click", function () {
    Store.exportAll().then(function (d) {
      TPUI.download("tp-backup-" + Store.dayKey() + ".json",
                    JSON.stringify(d, null, 2), "application/json");
      TPUI.toast("نُزِّلت النسخة.", "good");
    }).catch(function (e) { TPUI.toast(e.message, "bad"); });
  });

  /* تقرير عطل: كل ما يحتاجه من يشخّص، في ملف واحد، بلا أسماء الطالبات */
  document.getElementById("report").addEventListener("click", function () {
    Store.exportAll().then(function (d) {
      var rep = {
        وقت_التقرير: new Date().toISOString(),
        المحوّل: Store.adapter,
        الخادم: !!(window.TP_CONFIG && TP_CONFIG.url),
        العنوان: location.href,
        المتصفح: navigator.userAgent,
        المنطقة: Intl.DateTimeFormat().resolvedOptions().timeZone,
        اللوحة: (function () { try { return localStorage.getItem("tp.theme"); } catch (e) { return null; } })(),
        الأعداد: {
          طالبات: (d.students || []).length,
          تفاعل: (d.events || []).length,
          حضور: (d.attendance || []).length,
          تسليمات: (d.submissions || []).length
        },
        أخطاء: ERRORS.map(function (e) {
          return { الوقت: e.when.toISOString(), الخطأ: e.what, الموضع: e.where };
        })
      };
      TPUI.download("tp-report-" + Store.dayKey() + ".json",
                    JSON.stringify(rep, null, 2), "application/json");
      TPUI.toast("التقرير بلا أسماء ولا أرقام جامعية — أعدادٌ فقط.", "good");
    });
  });

  document.getElementById("restore").addEventListener("click", function () {
    document.getElementById("restoreFile").click();
  });

  document.getElementById("restoreFile").addEventListener("change", function () {
    var f = this.files[0];
    if (!f) return;
    if (!confirm("الاستعادة تدمج الملف مع الموجود. متابعة؟")) return;
    TPUI.readAsText(f).then(function (t) {
      return Store.importAll(JSON.parse(t), "merge");
    }).then(function (r) {
      document.getElementById("dangerState").textContent =
        "استُعيد: " + JSON.stringify(r);
      TPUI.toast("تمّت الاستعادة.", "good");
      runAll();
    }).catch(function (e) { TPUI.toast(e.message || "تعذّرت الاستعادة.", "bad"); });
    this.value = "";
  });

  document.getElementById("wipeTheme").addEventListener("click", function () {
    try { localStorage.removeItem("tp.theme"); localStorage.removeItem("tp.theme.mix"); }
    catch (e) { /**/ }
    location.reload();
  });

  document.getElementById("wipe").addEventListener("click", function () {
    if (!confirm("محو كل بيانات المنصة على هذا الجهاز؟ لا رجعة.")) return;
    if (prompt("اكتبي: محو") !== "محو") return TPUI.toast("أُلغي.", "bad");
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf("tp.") === 0) localStorage.removeItem(k);
      });
    } catch (e) { /**/ }
    if (window.indexedDB) indexedDB.deleteDatabase("tp-files");
    TPUI.toast("مُحيت بيانات هذا الجهاز.", "good");
    setTimeout(function () { location.reload(); }, 900);
  });
})();
