/* ═══ لوحة الشرف: اليوم · الشهر · الفصل ═══ */
(function () {
  "use strict";

  var el = TPUI.el, ar = TP.ar;
  var KINDS = ((window.COURSE || {}).engagement || {}).kinds || [];
  var KIND_LABEL = {};
  KINDS.forEach(function (k) { KIND_LABEL[k.id] = k.label; });

  TPUI.chrome("honors", "لوحة الشرف");
  TPUI.credit("credit");

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
  dayInput.addEventListener("change", render);
  monthInput.addEventListener("change", render);
  document.getElementById("print").addEventListener("click", function () { window.print(); });

  function filter() {
    var f = { sectionId: section.id };
    if (scopeSel.value === "day") f.day = dayInput.value || Store.dayKey();
    else if (scopeSel.value === "month") f.month = monthInput.value || Store.monthKey(Store.dayKey());
    return f;
  }

  function scopeLabel() {
    if (scopeSel.value === "day") return "الأكثر تفاعلًا — " + TPUI.arDate(dayInput.value || Store.dayKey());
    if (scopeSel.value === "month") return "الأكثر تفاعلًا خلال " + TPUI.arMonth(monthInput.value || Store.monthKey(Store.dayKey()));
    return "الأكثر تفاعلًا في الفصل كاملًا";
  }

  function render() {
    document.getElementById("title").textContent = scopeLabel();
    document.getElementById("sub").textContent = section.name;

    Store.ranking(filter()).then(function (rows) {
      var scored = rows.filter(function (r) { return r.points > 0; });

      podium.textContent = "";
      table.textContent = "";
      emptyBox.textContent = "";

      if (!scored.length) {
        podium.hidden = true;
        table.hidden = true;
        emptyBox.appendChild(TPUI.empty(
          "لا يوجد تفاعل مرصود في هذا المدى.",
          "افتحي عرض الحصة واضغطي مفتاح «م» لفتح لوحة الرصد أثناء الشرح."));
        return;
      }
      podium.hidden = false;
      table.hidden = false;

      /* ─── المنصّة: أول ثلاث طالبات ─── */
      scored.slice(0, 3).forEach(function (row, i) {
        var seat = el("div", "seat p" + (i + 1));
        seat.appendChild(el("div", "rank", ["الأولى", "الثانية", "الثالثة"][i]));
        seat.appendChild(el("div", "name", row.student.name));
        seat.appendChild(el("div", "pts", TPUI.points(row.points)));

        var tally = Object.keys(row.counts).map(function (k) {
          return (KIND_LABEL[k] || k) + " ×" + ar(row.counts[k]);
        }).join(" · ");
        seat.appendChild(el("div", "tally", tally));
        podium.appendChild(seat);
      });

      /* التعادل على المركز الثالث — يُذكر صراحةً لا يُخفى */
      if (scored.length > 3 && scored[3].points === scored[2].points) {
        var tied = scored.filter(function (r) { return r.points === scored[2].points; });
        emptyBox.appendChild(el("div", "note-box",
          "تعادل على المركز الثالث بـ" + TPUI.points(scored[2].points) + " بين: " +
          tied.map(function (r) { return r.student.name; }).join(" · ") +
          " — رُتِّبن بعدد المشاركات ثم برقم الكشف."));
      }

      /* ─── الترتيب الكامل ─── */
      var head = el("thead"), hr = el("tr");
      ["#", "الطالبة", "النقاط", "المشاركات"].forEach(function (h) { hr.appendChild(el("th", "", h)); });
      KINDS.forEach(function (k) { hr.appendChild(el("th", "", k.label)); });
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
        tr.appendChild(el("td", "num", ar(row.points)));
        tr.appendChild(el("td", "num", ar(row.total)));
        KINDS.forEach(function (k) {
          tr.appendChild(el("td", "num", row.counts[k.id] ? ar(row.counts[k.id]) : "—"));
        });
        body.appendChild(tr);
      });
      table.appendChild(body);

      var quiet = rows.length - scored.length;
      if (quiet > 0) {
        emptyBox.appendChild(el("div", "note-box",
          TPUI.students(quiet) + " بلا تفاعل مرصود في هذا المدى."));
      }
    }).catch(function (e) {
      console.error(e);
      TPUI.toast(e.message || "حدث خطأ.", "bad");
    });
  }

  render();
})();
