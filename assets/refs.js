/* ═══ مراجع المقرر — مواد القانون الكويتي ═══
   «ممكن تضيف لي مراجع الولاية والوكالة والوصايا … وكمان مواد
   الولاية والوكالة والوصايا من القانون الكويتي؟»

   المادّةُ مذكورةٌ في محاضرتها، لكن الطالبة تبحث عنها برقمها لا
   بمحاضرتها: «ما نصّ المادّة ٧٠٤؟» فتفتح ثلاثين ملفًّا. فجُمعت
   ههنا مرتّبةً بالباب ثم بالرقم، ومع كلِّ مادّةٍ بابٌ إلى محاضرتها.

   ═══ ولا يُكتب نصُّها هنا بيد ═══
   data/courses/<المقرر>/refs.js مُولَّد بـtools/build_refs.py، ينقل
   النصَّ من الشريحة آليًّا. ولولا ذلك لوقع ما وقع في evidences.js:
   تسعةُ نصوصٍ من خمسة عشر اختلفت عن المحاضرة، والطالبةُ تحفظ من
   الصفحة وتسمع من المحاضرة.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var DOC = window.REFS;
  var COURSE = window.COURSE || {};

  TPUI.credit("credit");

  if (!DOC || !(DOC.groups || []).length) {
    TPUI.chrome("refs", "مراجع المقرر", null);
    document.getElementById("emptyBox").appendChild(TPUI.empty(
      "لا مراجع لهذا المقرر بعد.",
      "تُولَّد من المحاضرات: python3 tools/build_refs.py <المقرر>"));
    document.querySelector(".control").hidden = true;
    return;
  }

  TPUI.chrome("refs", DOC.title || "مراجع المقرر", DOC.scope || null);
  document.getElementById("note").textContent = DOC.note || "";
  document.getElementById("printBtn").addEventListener("click", function () { window.print(); });

  var box = document.getElementById("groups");
  var cards = [];

  (DOC.groups || []).forEach(function (g) {
    var title = el("div", "section-title", g.title);
    box.appendChild(title);
    var list = el("div", "refs");
    (g.items || []).forEach(function (it) {
      var card = el("article", "ref");

      var head = el("div", "ref-head");
      head.appendChild(el("b", "ref-no", "المادّة " + it.no));
      if (it.src) head.appendChild(el("span", "ref-src", it.src));
      if (it.session) {
        /*  بابٌ إلى المحاضرة: المادّةُ تُقرأ في سياقها، والمنصةُ
            تعرف مكانها فلا تُترك الطالبة تبحث. */
        var lesson = (COURSE.sessions || []).filter(function (s) {
          return +s.n === +it.session;
        })[0];
        if (lesson && lesson.file) {
          var a = el("a", "ref-go", "المحاضرة " + ar(it.session));
          a.href = lesson.file;
          head.appendChild(a);
        } else {
          head.appendChild(el("span", "ref-go", "المحاضرة " + ar(it.session)));
        }
      }
      card.appendChild(head);

      /*  «فيها أكثرُ من مادّة»: الشريحةُ التحمت فيها موادُّ في
          المحاضرة نفسها. تُعلَّم ولا تُخفى — الصفحةُ تَعِدُ بنقل
          المحاضرة كما هي، فتُدلّ الطالبةُ على الموضع لتراجعه. */
      if (it.mixed) {
        card.appendChild(el("div", "ref-warn",
          "في هذه الشريحة أكثرُ من مادّة كما وردت في المحاضرة — راجعيها هناك."));
      }

      var body = el("div", "ref-text");
      (it.text || []).forEach(function (p) { body.appendChild(el("p", "", p)); });
      card.appendChild(body);

      list.appendChild(card);
      cards.push({ node: card, hay: (it.no + " " + (it.text || []).join(" ")) });
    });
    box.appendChild(list);
    cards.push({ head: title, list: list });
  });

  /* ─── البحث ───
     الطالبة تأتي برقمٍ في يدها («٧٠٤») أو بكلمةٍ تذكرها. ويُخفى
     عنوانُ البابِ الذي خلت مواده، فلا يبقى عنوانٌ فوق فراغ. */
  var find = document.getElementById("find");
  var empty = document.getElementById("emptyBox");
  find.addEventListener("input", function () {
    var q = find.value.trim();
    var hits = 0;
    cards.forEach(function (c) {
      if (!c.node) return;
      var on = !q || c.hay.indexOf(q) >= 0 || TP.ar(c.hay).indexOf(q) >= 0;
      c.node.hidden = !on;
      if (on) hits++;
    });
    cards.forEach(function (c) {
      if (!c.list) return;
      var any = [].some.call(c.list.children, function (n) { return !n.hidden; });
      c.list.hidden = !any;
      c.head.hidden = !any;
    });
    empty.textContent = "";
    if (q && !hits) {
      empty.appendChild(TPUI.empty("لا مادّة بهذا الرقم ولا هذه الكلمة.",
        "جرّبي رقم المادّة وحده، أو كلمةً من نصّها."));
    }
  });
})();
