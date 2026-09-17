/* ═══ ملفّ الأدلة المختصرة ═══
   للحفظ والمراجعة قبل الاختبار: نصّ الدليل ومصدره ووجه دلالته.
   وكلّ نصٍّ منقولٌ من المذكرة حرفًا بحرف. */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var DOC = window.EVIDENCES;

  TPUI.credit("credit");

  if (!DOC) {
    TPUI.chrome("evidences", "الأدلة المختصرة", null);
    document.getElementById("groups").appendChild(TPUI.empty(
      "لا ملفّ أدلة لهذا المقرر.",
      "يُكتب في data/courses/<المقرر>/evidences.js"));
    document.querySelector(".control").hidden = true;
    return;
  }

  TPUI.chrome("evidences", DOC.title || "الأدلة المختصرة", DOC.scope || null);
  document.getElementById("note").textContent = DOC.note || "";
  document.getElementById("printBtn").addEventListener("click", function () { window.print(); });

  var box = document.getElementById("groups");
  var total = 0;

  (DOC.groups || []).forEach(function (g) {
    box.appendChild(el("div", "section-title", g.title));
    var list = el("ol", "ev-list");
    (g.items || []).forEach(function (it) {
      total++;
      var li = el("li", "ev");
      var head = el("div", "ev-head");
      head.appendChild(el("span", "ev-no", ar(it.n)));
      head.appendChild(el("span", "ev-kind k-" + kindKey(it.kind), it.kind));
      if (it.session) {
        head.appendChild(el("span", "ev-src", "المحاضرة " + ar(it.session)));
      }
      li.appendChild(head);

      li.appendChild(el("div", "ev-text", it.text));
      if (it.src) li.appendChild(el("div", "ev-ref", it.src));
      if (it.why) {
        var w = el("div", "ev-why");
        w.appendChild(el("span", "ev-why-k", "وجه الدلالة:"));
        w.appendChild(document.createTextNode(" " + it.why));
        li.appendChild(w);
      }
      list.appendChild(li);
    });
    box.appendChild(list);
  });

  /* أدلةٌ تُذكر في الدرس ولا تدخل في العدّ */
  if ((DOC.extra || []).length) {
    document.getElementById("extraTitle").hidden = false;
    var ul = el("ul", "ev-list extra");
    DOC.extra.forEach(function (it) {
      var li = el("li", "ev");
      if (it.session) {
        var h = el("div", "ev-head");
        h.appendChild(el("span", "ev-src", "المحاضرة " + ar(it.session)));
        li.appendChild(h);
      }
      li.appendChild(el("div", "ev-text", it.text));
      if (it.why) {
        var w = el("div", "ev-why");
        w.appendChild(el("span", "ev-why-k", "وجه الدلالة:"));
        w.appendChild(document.createTextNode(" " + it.why));
        li.appendChild(w);
      }
      ul.appendChild(li);
    });
    document.getElementById("extra").appendChild(ul);
  }

  document.getElementById("foot").textContent =
    TPUI.count(total, ["دليل واحد", "دليلان", "أدلة", "دليلًا"]) +
    " — منقولةٌ من المذكرة حرفًا بحرف. والآيات بالرسم الإملائي كما وردت فيها.";

  function kindKey(k) {
    return { "قرآن": "quran", "سنة": "sunna", "إجماع": "ijma", "معقول": "aql" }[k] || "x";
  }
})();
