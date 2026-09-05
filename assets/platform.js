/* ═══ الصفحة الرئيسية: لوحة شرف اليوم + بطاقات الحصص ═══ */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var el = TPUI.el, ar = TP.ar;
  var KINDS = (COURSE.engagement || {}).kinds || [];
  var LABEL = {};
  KINDS.forEach(function (k) { LABEL[k.id] = k.label; });

  document.title = "منصة التدريس — " + (COURSE.title || "");
  set("course", COURSE.title);
  set("instructor", COURSE.instructor);
  set("credit", COURSE.credit);

  function set(id, text) {
    var n = document.getElementById(id);
    if (n && text) n.textContent = text;
  }

  var section = TPUI.sectionPicker(document.getElementById("section"), function (s) {
    section = s; render();
  });

  var list = document.getElementById("sessions");
  var today = document.getElementById("today");

  function render() {
    document.getElementById("hint").textContent =
      "القارئات تُوزَّع على " + TPUI.students(section.roster) + " في الشعبة";
    renderSessions();
    renderToday();
  }

  /* ─── لوحة شرف اليوم ─── */
  function renderToday() {
    var day = Store.dayKey();
    document.getElementById("todayLabel").textContent = TPUI.arDate(day);

    Store.ranking({ sectionId: section.id, day: day }).then(function (rows) {
      var scored = rows.filter(function (r) { return r.points > 0; });
      today.textContent = "";

      if (!scored.length) {
        today.appendChild(TPUI.empty(
          "لم يُرصد تفاعل اليوم بعد.",
          "افتحي عرض الحصة واضغطي مفتاح «م» لفتح لوحة الرصد أثناء الشرح."));
        return;
      }
      scored.slice(0, 3).forEach(function (row, i) {
        var seat = el("div", "seat p" + (i + 1));
        seat.appendChild(el("div", "rank", ["الأولى", "الثانية", "الثالثة"][i]));
        seat.appendChild(el("div", "name", row.student.name));
        seat.appendChild(el("div", "pts", TPUI.points(row.points)));
        seat.appendChild(el("div", "tally", Object.keys(row.counts).map(function (k) {
          return (LABEL[k] || k) + " ×" + ar(row.counts[k]);
        }).join(" · ")));
        today.appendChild(seat);
      });
    }).catch(function (e) { console.error(e); });
  }

  /* ─── بطاقات الحصص ─── */
  function renderSessions() {
    list.textContent = "";
    (COURSE.sessions || []).forEach(function (s) {
      var ready = s.status === "ready" && s.file;
      var li = el("li", "card " + (ready ? "ready" : "soon"));
      li.appendChild(el("span", "badge", ready ? "متاحة" : "قيد التحضير"));

      var body = document.createElement(ready ? "a" : "div");
      body.className = ready ? "open" : "body";
      if (ready) body.href = s.file + "?section=" + encodeURIComponent(section.id);

      body.appendChild(el("span", "no", "الحصة " + ar(s.n)));
      body.appendChild(el("h2", "", s.title));
      if (s.subtitle) body.appendChild(el("div", "sub", s.subtitle));

      var meta = el("div", "meta");
      meta.appendChild(el("span", "", s.pages || ""));
      if (ready && s.readers) {
        var seat = TP.seatMaker(section.roster, TP.startAtFor(s));
        meta.appendChild(el("span", "readers",
          "القارئات: " + ar(seat(0)) + " – " + ar(seat(s.readers - 1))));
      }
      body.appendChild(meta);
      li.appendChild(body);
      list.appendChild(li);
    });
  }

  render();
})();
