/* ═══ اختيار لوحة الألوان ═══
   يُحمَّل في <head> قبل أي ملف أنماط، فيُطبَّق الاختيار قبل أول رسم
   للصفحة — وإلا ومضت اللوحة القديمة لحظةً ثم انقلبت.
   الاختيار محفوظ على الجهاز، ولا يُرسل إلى خادم. */
(function () {
  "use strict";

  var KEY = "tp.theme";

  var THEMES = [
    { id: "",       label: "جامعية",   dot: "#0DABE2" },
    { id: "green",  label: "خضراء",    dot: "#6FD8B0" },
    { id: "wine",   label: "عنّابية",  dot: "#E9A8A0" },
    { id: "indigo", label: "بنفسجية",  dot: "#A99BF5" },
    { id: "slate",  label: "فحمية",    dot: "#79B8E8" },
    { id: "paper",  label: "ورقية",    dot: "#166149" }
  ];

  function read() {
    try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
  }

  function apply(id) {
    if (id) document.documentElement.setAttribute("data-theme", id);
    else document.documentElement.removeAttribute("data-theme");
  }

  /* قبل أي شيء: طبّق المحفوظ */
  apply(read());

  window.TPTheme = {
    list: THEMES,
    current: read,

    set: function (id) {
      try { localStorage.setItem(KEY, id); } catch (e) { /* تصفح خاص */ }
      apply(id);
    },

    /* شريط النقاط الملوّنة — يُركَّب في ترويسة الصفحة */
    picker: function () {
      var wrap = document.createElement("div");
      wrap.className = "theme-picker";
      wrap.setAttribute("role", "group");
      wrap.setAttribute("aria-label", "لوحة الألوان");

      THEMES.forEach(function (t) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "theme-dot";
        b.style.setProperty("--dot", t.dot);
        b.title = t.label;
        b.setAttribute("aria-label", "اللوحة " + t.label);
        if (t.id === read()) b.classList.add("on");
        b.addEventListener("click", function () {
          TPTheme.set(t.id);
          [].slice.call(wrap.children).forEach(function (x) {
            x.classList.remove("on");
            x.removeAttribute("aria-current");
          });
          b.classList.add("on");
          b.setAttribute("aria-current", "true");
        });
        if (t.id === read()) b.setAttribute("aria-current", "true");
        wrap.appendChild(b);
      });
      return wrap;
    }
  };
})();
