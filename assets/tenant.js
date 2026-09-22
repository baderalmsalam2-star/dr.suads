/* ═══════════════════════════════════════════════════════════════
   تنصيب أستاذةٍ جديدة في النشرة.

   لا تكتب هذه الصفحة شيئًا في أي مكان: النشرة ساكنةٌ بلا خادم،
   وسجلّ المستأجرات ملفٌّ في المستودع. فعملُها أن تفحص مشروع
   الأستاذة وتُخرج المدخل جاهزًا للّصق — فيصير التنصيب دقائق بدل
   محاولاتٍ في الظلام.

   والفحص يُجرى بالمفتاح العلني وحده، وهو ما ستراه الطالبة. فإن
   نجح هنا نجح عندها.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var el = TPUI.el;

  /*  جداولُ supabase/schema.sql كلُّها. نقصان واحدٍ منها يعني أن
      السكربت لم يُلصق أو لُصق ناقصًا.

      ويُذكر كلُّ جديدٍ هنا: بقي replies وworks خارج القائمة بعد
      إضافتهما، فكانت الصفحةُ تقول «المشروع جاهز» لأستاذةٍ لصقت
      مخطّطًا قديمًا، ثم ينكسر عندها كشفُ الإجابة في القاعة وصفحةُ
      الأعمال. والعددُ يُشتقّ من القائمة فلا يتخلّف نصٌّ عنها. */
  var TABLES = ["owners", "students", "events", "attendance", "submissions",
                "schedule", "grades", "scheme", "attend_codes", "content",
                "replies", "works"];

  TPUI.chrome(null, "تنصيب أستاذة", "إضافة مستأجرةٍ إلى النشرة");
  TPUI.credit(document.getElementById("credit"));

  function val(id) { return (document.getElementById(id).value || "").trim(); }

  /*  مرجع المشروع هو نطاقه الفرعي: xxxx.supabase.co ← xxxx.
      منه يُبنى رابط محرّر SQL في لوحة Supabase. */
  function projectRef(url) {
    var m = /^https?:\/\/([a-z0-9-]+)\.supabase\.(co|in)/i.exec(url || "");
    return m ? m[1] : null;
  }

  function line(ok, text, extra) {
    var d = el("div", "chk" + (ok === null ? " pending" : ""));
    d.appendChild(el("span", "", (ok === null ? "…" : ok ? "✓" : "✗") + " " + text));
    if (extra) d.appendChild(el("span", "det", extra));
    return d;
  }

  /*  PostgREST يردّ 404 ومعها الرمز 42P01 حين لا يوجد الجدول.
      وحين يوجد ولا تُبيح سياساتُه شيئًا للمجهول، يردّ 200 بمصفوفةٍ
      فارغة — وهو النجاح المطلوب هنا: الجدول قائمٌ وRLS يحرسه. */
  function probe(url, key, table) {
    var u = url.replace(/\/$/, "") + "/rest/v1/" + table + "?select=*&limit=1";
    return fetch(u, { headers: { apikey: key, Authorization: "Bearer " + key } })
      .then(function (r) {
        if (r.status === 404) return { ok: false, why: "الجدول غير موجود" };
        if (r.status === 401 || r.status === 403) return { ok: true, why: "موجود، وRLS يمنع المجهول" };
        if (r.ok) return { ok: true, why: "موجود" };
        return { ok: false, why: "ردٌّ غير متوقَّع: " + r.status };
      })
      .catch(function (e) { return { ok: false, why: "تعذّر الوصول: " + (e && e.message || e) }; });
  }

  function render() {
    var id = val("id"), url = val("url"), key = val("key");
    var courses = val("courses").split(/[,،\s]+/).filter(Boolean);
    var entry = {
      id: id,
      name: val("name"),
      org: val("org"),
      courses: courses,
      supabase: { url: url, anonKey: key }
    };
    document.getElementById("out").value =
      "    " + JSON.stringify(entry, null, 2).split("\n").join("\n    ") + ",";
    document.getElementById("outBox").hidden = false;
  }

  document.getElementById("check").addEventListener("click", function () {
    var url = val("url"), key = val("key");
    var box = document.getElementById("result");
    document.getElementById("resultBox").hidden = false;
    box.textContent = "";

    if (!/^https?:\/\//.test(url) || !key) {
      box.appendChild(line(false, "أدخلي عنوان المشروع ومفتاحه العلني أولًا."));
      return;
    }

    var ref = projectRef(url);
    var sql = document.getElementById("sqlLink");
    if (ref) {
      sql.href = "https://supabase.com/dashboard/project/" + ref + "/sql/new";
      sql.hidden = false;
    }

    box.appendChild(line(null, "جارٍ الفحص…"));
    Promise.all(TABLES.map(function (t) {
      return probe(url, key, t).then(function (r) { return { t: t, r: r }; });
    })).then(function (rows) {
      box.textContent = "";
      var missing = rows.filter(function (x) { return !x.r.ok; });
      box.appendChild(line(missing.length === 0,
        missing.length === 0
          ? "المشروع جاهز — الجداول " + TP.ar(TABLES.length) + " موجودة."
          : "ينقص " + TP.ar(missing.length) + " من " + TP.ar(TABLES.length) + " جداول.",
        missing.length ? "الصقي supabase/schema.sql في محرّر SQL ثم أعيدي الفحص." : ""));
      rows.forEach(function (x) { box.appendChild(line(x.r.ok, x.t, x.r.why)); });
      if (missing.length === 0) render();
    });
  });

  /*  نصّ السكربت يُجلب من المستودع نفسه، فلا تُنسخ نسخةٌ قديمة. */
  document.getElementById("copySchema").addEventListener("click", function () {
    fetch("supabase/schema.sql")
      .then(function (r) {
        if (!r.ok) throw new Error("تعذّر جلب الملف");
        return r.text();
      })
      .then(function (t) { return navigator.clipboard.writeText(t); })
      .then(function () { TPUI.toast("نُسخ schema.sql — الصقيه في محرّر SQL واضغطي Run.", "good"); })
      .catch(function () { TPUI.toast("تعذّر النسخ. افتحي supabase/schema.sql وانسخيه يدويًا.", "bad"); });
  });

  document.getElementById("copyOut").addEventListener("click", function () {
    navigator.clipboard.writeText(document.getElementById("out").value)
      .then(function () { TPUI.toast("نُسخ المدخل — الصقه في data/tenants.js.", "good"); })
      .catch(function () { TPUI.toast("تعذّر النسخ. انسخيه من الصندوق يدويًا.", "bad"); });
  });

  ["id", "name", "org", "courses"].forEach(function (f) {
    document.getElementById(f).addEventListener("input", function () {
      if (!document.getElementById("outBox").hidden) render();
    });
  });
})();
