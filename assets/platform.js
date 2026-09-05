/* ═══ الصفحة الرئيسية — تُبنى كليًا من data/course.js ═══ */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var TP = window.TP;
  var ar = TP.ar;
  var params = new URLSearchParams(location.search);

  document.title = "منصة التدريس — " + (COURSE.title || "");
  set("course", COURSE.title);
  set("instructor", COURSE.instructor);
  set("credit", COURSE.credit);

  function set(id, text) {
    var el = document.getElementById(id);
    if (el && text) el.textContent = text;
  }

  /* ─── اختيار الشعبة ─── */
  var picker  = document.getElementById("section");
  var current = TP.resolveSection(params);

  TP.sections().forEach(function (s) {
    var o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.name + " — " + ar(s.roster) + " طالبة";
    picker.appendChild(o);
  });
  picker.value = current.id;

  picker.addEventListener("change", function () {
    current = TP.sections().filter(function (s) { return String(s.id) === picker.value; })[0];
    TP.rememberSection(current.id);
    render();
  });
  TP.rememberSection(current.id);

  /* ─── قائمة الحصص ─── */
  var list = document.getElementById("sessions");

  function render() {
    var seatsHint = document.getElementById("hint");
    seatsHint.textContent = "القارئات تُوزَّع دائريًا على " + ar(current.roster) + " طالبة";

    list.textContent = "";
    (COURSE.sessions || []).forEach(function (s) {
      var ready = s.status === "ready" && s.file;
      var li = document.createElement("li");
      li.className = "card " + (ready ? "ready" : "soon");

      var badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = ready ? "متاحة" : "قيد التحضير";
      li.appendChild(badge);

      var body = document.createElement(ready ? "a" : "div");
      body.className = ready ? "open" : "body";
      if (ready) {
        body.href = s.file + "?section=" + encodeURIComponent(current.id);
      }

      body.appendChild(el("span", "no", "الحصة " + ar(s.n)));
      body.appendChild(el("h2", "", s.title));
      if (s.subtitle) body.appendChild(el("div", "sub", s.subtitle));

      var meta = document.createElement("div");
      meta.className = "meta";
      meta.appendChild(el("span", "", s.pages || ""));
      if (ready && s.readers) {
        var seat = TP.seatMaker(current.roster, TP.startAtFor(s));
        var from = ar(seat(0)), to = ar(seat(s.readers - 1));
        meta.appendChild(el("span", "readers", "القارئات: " + from + " – " + to));
      }
      body.appendChild(meta);
      li.appendChild(body);
      list.appendChild(li);
    });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    n.textContent = text;
    return n;
  }

  render();
})();
