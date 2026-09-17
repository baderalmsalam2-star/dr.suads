/* ═══ لوحة الشرف: اليوم · الشهر · الفصل ═══ */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var KINDS = ((window.COURSE || {}).engagement || {}).kinds || [];
  var KIND_LABEL = {};
  KINDS.forEach(function (k) { KIND_LABEL[k.id] = k.label; });

  TPUI.chrome("honors", "لوحة الشرف");
  TPUI.credit("credit");

  var boardSel = document.getElementById("board");
  var scopeSel = document.getElementById("scope");
  var dayInput = document.getElementById("day");
  var monthInput = document.getElementById("month");
  var podium = document.getElementById("podium");
  var table = document.getElementById("table");
  var emptyBox = document.getElementById("emptyBox");

  var section = TPUI.sectionPicker(document.getElementById("section"), function (s) {
    section = s; render();
  });

  dayInput.value = Store.dayKey();
  monthInput.value = Store.monthKey(Store.dayKey());

  scopeSel.addEventListener("change", function () {
    dayInput.hidden = scopeSel.value !== "day";
    monthInput.hidden = scopeSel.value !== "month";
    render();
  });
  boardSel.addEventListener("change", render);
  dayInput.addEventListener("change", render);
  monthInput.addEventListener("change", render);
  document.getElementById("print").addEventListener("click", function () { window.print(); });

  function filter() {
    var f = { sectionId: section.id };
    if (scopeSel.value === "day") f.day = dayInput.value || Store.dayKey();
    else if (scopeSel.value === "month") f.month = monthInput.value || Store.monthKey(Store.dayKey());
    return f;
  }

  function speed() { return boardSel.value === "speed"; }

  function scopeLabel() {
    var who = speed() ? "الأسرع إجابةً" : "الأكثر تفاعلًا";
    if (scopeSel.value === "day") return who + " — " + TPUI.arDate(dayInput.value || Store.dayKey());
    if (scopeSel.value === "month") return who + " خلال " + TPUI.arMonth(monthInput.value || Store.monthKey(Store.dayKey()));
    return who + " في الفصل كاملًا";
  }

  /* «٤٫٣ ثانية» — بفاصلةٍ عربية لا بنقطة */
  function secs(n) {
    if (n == null) return "—";
    return ar(String(n).replace(".", "٫")) + " ث";
  }

  function render() {
    document.getElementById("title").textContent = scopeLabel();
    document.getElementById("sub").textContent = section.name;

    var want = speed() ? Store.fastest(filter()) : Store.ranking(filter());
    want.then(function (rows) {
      /*  لوحة السرعة تُرجع من أجابت فقط — وقد رُشِّحت في الطبقة.
          ولوحة النقاط تُرشَّح هنا كما كانت. */
      var scored = speed() ? rows : rows.filter(function (r) { return r.points > 0; });

      podium.textContent = "";
      table.textContent = "";
      emptyBox.textContent = "";

      if (!scored.length) {
        podium.hidden = true;
        table.hidden = true;
        emptyBox.appendChild(TPUI.empty(
          speed() ? "لم تُرصد إجابات صحيحة في هذا المدى."
                  : "لا يوجد تفاعل مرصود في هذا المدى.",
          speed() ? "الزمن يُقاس من فتح شريحة السؤال إلى ضغطك على «إجابة صحيحة»."
                  : "افتحي عرض المحاضرة واضغطي مفتاح «م» لفتح لوحة الرصد أثناء الشرح."));
        daily(null);
        return;
      }
      podium.hidden = false;
      table.hidden = false;

      /* ─── المنصّة: أول ثلاث طالبات ─── */
      scored.slice(0, 3).forEach(function (row, i) {
        var seat = el("div", "seat p" + (i + 1));
        seat.appendChild(el("div", "rank", ["الأولى", "الثانية", "الثالثة"][i]));
        seat.appendChild(el("div", "name", row.student.name));
        seat.appendChild(el("div", "pts", speed()
          ? TPUI.count(row.right, ["إجابة صحيحة", "إجابتان صحيحتان",
                                   "إجابات صحيحة", "إجابة صحيحة"]) +
            (row.secs != null ? " · " + secs(row.secs) : "")
          : TPUI.points(row.points)));

        var tally = Object.keys(row.counts).map(function (k) {
          return (KIND_LABEL[k] || k) + " ×" + ar(row.counts[k]);
        }).join(" · ");
        seat.appendChild(el("div", "tally", tally));
        podium.appendChild(seat);
      });

      /* التعادل على المركز الثالث — يُذكر صراحةً لا يُخفى */
      if (!speed() && scored.length > 3 && scored[3].points === scored[2].points) {
        var tied = scored.filter(function (r) { return r.points === scored[2].points; });
        emptyBox.appendChild(el("div", "note-box",
          "تعادل على المركز الثالث بـ" + TPUI.points(scored[2].points) + " بين: " +
          tied.map(function (r) { return r.student.name; }).join(" · ") +
          " — رُتِّبن بعدد المشاركات ثم برقم الكشف."));
      }

      /* ─── الترتيب الكامل ─── */
      var head = el("thead"), hr = el("tr");
      var cols = speed()
        ? ["#", "الطالبة", "إجابات صحيحة", "متوسّط الزمن", "أسرع إجابة", "النقاط"]
        : ["#", "الطالبة", "النقاط", "المشاركات"];
      cols.forEach(function (h) { hr.appendChild(el("th", "", h)); });
      if (!speed()) KINDS.forEach(function (k) { hr.appendChild(el("th", "", k.label)); });
      head.appendChild(hr);
      table.appendChild(head);

      var body = el("tbody");
      scored.forEach(function (row, i) {
        var tr = el("tr");
        tr.appendChild(el("td", "num", ar(i + 1)));
        var td = el("td");
        var a = el("a", "", row.student.name);
        a.href = "student.html?id=" + encodeURIComponent(row.student.id);
        td.appendChild(a);
        tr.appendChild(td);
        if (speed()) {
          tr.appendChild(el("td", "num", ar(row.right)));
          tr.appendChild(el("td", "num", secs(row.secs)));
          tr.appendChild(el("td", "num", secs(row.fastest)));
          tr.appendChild(el("td", "num", ar(row.points)));
        } else {
          tr.appendChild(el("td", "num", ar(row.points)));
          tr.appendChild(el("td", "num", ar(row.total)));
          KINDS.forEach(function (k) {
            tr.appendChild(el("td", "num", row.counts[k.id] ? ar(row.counts[k.id]) : "—"));
          });
        }
        body.appendChild(tr);
      });
      table.appendChild(body);

      var quiet = rows.length - scored.length;
      if (quiet > 0 && !speed()) {
        emptyBox.appendChild(el("div", "note-box",
          TPUI.students(quiet) + " بلا تفاعل مرصود في هذا المدى."));
      }
      daily(scored);
    }).catch(function (e) {
      console.error(e);
      TPUI.toast(e.message || "حدث خطأ.", "bad");
    });
  }

  /* ═══ خلاصة اليوم ═══
     سطرٌ يُقرأ في نهاية المحاضرة بلا تفتيشٍ في الجداول: كم شاركت،
     ومن الأوائل، وكم أجابت صحيحًا، وأسرع إجابة في اليوم. ولا تظهر
     إلا على مدى «اليوم» — فهي خلاصته هو. */
  function daily(scored) {
    var box = document.getElementById("daily");
    if (!box) return;
    if (scopeSel.value !== "day" || !scored || !scored.length) {
      box.hidden = true; box.textContent = ""; return;
    }
    var day = dayInput.value || Store.dayKey();

    Store.ranking({ sectionId: section.id, day: day }).then(function (all) {
      var active = all.filter(function (r) { return r.points > 0; });
      var right = all.reduce(function (a, r) { return a + (r.right || 0); }, 0);
      var pts = all.reduce(function (a, r) { return a + r.points; }, 0);
      var timed = all.filter(function (r) { return r.fastest != null; });
      var best = timed.sort(function (a, b) { return a.fastest - b.fastest; })[0];

      box.textContent = "";
      box.hidden = false;
      box.appendChild(el("div", "d-title", "خلاصة " + TPUI.arDate(day)));

      var g = el("div", "d-grid");
      function stat(k, v, cls) {
        var c = el("div", "d-stat");
        c.appendChild(el("div", "d-k", k));
        c.appendChild(el("div", "d-v" + (cls ? " " + cls : ""), v));
        g.appendChild(c);
      }
      stat("شاركن", ar(active.length) + " من " + ar(all.length));
      stat("مجموع النقاط", ar(pts));
      stat("إجابات صحيحة", ar(right));
      stat("أسرع إجابة", best ? secs(best.fastest) : "—", "blue");
      box.appendChild(g);

      var top = active.slice(0, 3).map(function (r, i) {
        return ["الأولى", "الثانية", "الثالثة"][i] + " " + r.student.name;
      }).join(" · ");
      if (top) box.appendChild(el("div", "d-top", top));
      if (best) {
        box.appendChild(el("div", "d-top",
          "وأسرع إجابة اليوم لـ" + best.student.name + " في " + secs(best.fastest) + "."));
      }
    }).catch(function () { box.hidden = true; });
  }

  render();
})();
