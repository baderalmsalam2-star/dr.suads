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
    /* الفاتحة الناصعة */
    { id: "paper",  label: "ورقية",    dot: "#166149", bg: "#F6F1E6" },
    { id: "snow",   label: "ثلجية",    dot: "#0B5FA5", bg: "#FFFFFF" },
    { id: "rose",   label: "ورديّة",   dot: "#A62A56", bg: "#FFF2F5" },
    { id: "aqua",   label: "فيروزية",  dot: "#08636F", bg: "#EAF7F8" },
    { id: "lilac",  label: "ليلكية",   dot: "#5A3CA8", bg: "#F4F0FE" },
    { id: "mix",    label: "مزاجي",    dot: "", mix: true }
  ];

  var MIX_KEY = "tp.theme.mix";

  function read() {
    try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
  }

  function readMix() {
    try { return JSON.parse(localStorage.getItem(MIX_KEY) || "null"); }
    catch (e) { return null; }
  }

  function writeMix(m) {
    try {
      if (m) localStorage.setItem(MIX_KEY, JSON.stringify(m));
      else localStorage.removeItem(MIX_KEY);
    } catch (e) { /* تصفح خاص */ }
  }

  /* ─── حساب الألوان ─── */
  function rgb(hex) {
    hex = String(hex || "").replace("#", "");
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var n = parseInt(hex, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function hex(a) {
    return "#" + a.map(function (v) {
      return ("0" + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    }).join("");
  }

  /* سطوع مُدرَك (sRGB relative luminance) — عليه يُبنى قلب النص */
  function lum(a) {
    var c = a.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function mix(a, b, t) {
    return [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, a[2] + (b[2]-a[2])*t];
  }

  /* ─── تركيب لوحة كاملة من ثلاثة ألوان ───
     الأرضية وحدها تقرّر لون النصّ: فإن اختارت الدكتورة أرضيةً فاتحة
     انقلب الحبر داكنًا من نفسه. بلا هذا كان اختيارُ لونٍ فاتح يجعل
     المنصة بيضاء على بيضاء. */
  /*  لون النصّ الثانوي في اللوحة المزاجية.
      لا يكفي تخفيتُ الرمادي بنسبةٍ ثابتة: التخفيت على أرضيةٍ فاتحة
      يُذيب النصّ فيها. فيُبدأ من الرمادي نفسه (وعلى الداكنة من
      تخفيتٍ يشبه ما كان)، ثم يُدفع نحو لون الحبر خطوةً خطوة حتى
      يبلغ ٤.٦:١ على الأرضية وعلى السطح المرتفع معًا. */
  function contrast(a, b) {
    var l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  function muted(neutral, bg, up, light) {
    var ink = light ? [26, 23, 18] : [255, 255, 255];
    var c = light ? neutral.slice() : mix(bg, neutral, 0.62);
    for (var i = 0; i <= 50; i++) {
      if (contrast(c, bg) >= 4.6 && contrast(c, up) >= 4.6) return c;
      c = mix(c, ink, 0.06);
    }
    return c;
  }

  function compose(m) {
    var bg = rgb(m.bg), light = lum(bg) > 0.4;
    var ink = light ? [26, 23, 18] : [255, 255, 255];
    var v = {
      "--navy": m.bg,
      "--navy-2": hex(mix(bg, light ? [255,255,255] : [255,255,255], light ? 0.55 : 0.08)),
      "--faculty": m.faculty,
      "--student": m.student,
      "--surface": hex(ink),
      "--neutral": hex(mix(ink, bg, light ? 0.35 : 0.22)),
      "--navy-rgb": rgb(m.bg).join(","),
      "--faculty-rgb": rgb(m.faculty).join(","),
      "--student-rgb": rgb(m.student).join(","),
      "--surface-rgb": ink.join(","),
      "--neutral-rgb": mix(ink, bg, light ? 0.35 : 0.22).map(Math.round).join(",")
    };
    v["--line"] = "rgba(" + v["--neutral-rgb"] + ",.3)";
    v["--muted"] = hex(muted(rgb(v["--neutral"]), bg, rgb(v["--navy-2"]), light));
    return v;
  }

  var MIX_STYLE_ID = "tp-mix";

  function applyMix(m) {
    var tag = document.getElementById(MIX_STYLE_ID);
    if (!m) { if (tag) tag.remove(); return; }
    if (!tag) {
      tag = document.createElement("style");
      tag.id = MIX_STYLE_ID;
      (document.head || document.documentElement).appendChild(tag);
    }
    var v = compose(m), out = "";
    Object.keys(v).forEach(function (k) { out += k + ":" + v[k] + ";"; });
    /* يُكتب على :root نفسه ليعلو على كل لوحة معرَّفة في tokens.css */
    tag.textContent = ":root,html[data-theme]{" + out + "}";
  }

  function apply(id) {
    if (id === "mix") {
      document.documentElement.setAttribute("data-theme", "mix");
      applyMix(readMix() || DEFAULT_MIX);
      return;
    }
    applyMix(null);
    if (id) document.documentElement.setAttribute("data-theme", id);
    else document.documentElement.removeAttribute("data-theme");
  }

  var DEFAULT_MIX = { bg: "#1B2A41", faculty: "#7FB3D5", student: "#E8C466" };

  /* قبل أي شيء: طبّق المحفوظ */
  apply(read());

  window.TPTheme = {
    list: THEMES,
    current: read,

    set: function (id) {
      try { localStorage.setItem(KEY, id); } catch (e) { /* تصفح خاص */ }
      apply(id);
    },

    mix: function () { return readMix() || DEFAULT_MIX; },

    setMix: function (m) {
      writeMix(m);
      try { localStorage.setItem(KEY, "mix"); } catch (e) { /**/ }
      apply("mix");
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
        /*  اللوحة الفاتحة نقطتُها حلقة: أرضيتُها في الوسط ولونها
            حولها — فتُعرف الفاتحة من الداكنة بالنظرة الواحدة. */
        b.className = "theme-dot" + (t.mix ? " mix" : "") + (t.bg ? " light" : "");
        b.style.setProperty("--dot", t.mix ? (readMix() || DEFAULT_MIX).bg : t.dot);
        if (t.bg) b.style.setProperty("--dot-bg", t.bg);
        b.title = t.mix ? "لون على مزاجك" : t.label + (t.bg ? " — فاتحة" : "");
        b.setAttribute("aria-label", t.mix ? "لوحة على مزاجك" : "اللوحة " + t.label);

        b.addEventListener("click", function () {
          if (t.mix && b.classList.contains("on")) return toggleMixer();
          TPTheme.set(t.id);
          mark(t.id);
          if (t.mix) toggleMixer(true);
        });
        wrap.appendChild(b);
      });

      mark(read());
      function mark(id) {
        [].slice.call(wrap.querySelectorAll(".theme-dot")).forEach(function (x, i) {
          var on = THEMES[i].id === id;
          x.classList.toggle("on", on);
          if (on) x.setAttribute("aria-current", "true");
          else x.removeAttribute("aria-current");
        });
        if (id !== "mix") closeMixer();
      }

      /* ─── لوحة المزج ─── */
      var panel = null;

      function toggleMixer(force) {
        if (panel && !force) return closeMixer();
        if (panel) return;
        panel = buildMixer();
        wrap.appendChild(panel);
      }

      function closeMixer() {
        if (panel) { panel.remove(); panel = null; }
      }

      function buildMixer() {
        var m = Object.assign({}, readMix() || DEFAULT_MIX);
        var box = document.createElement("div");
        box.className = "mixer";
        box.setAttribute("role", "group");
        box.setAttribute("aria-label", "تركيب لون على مزاجك");

        [["bg", "الأرضية"], ["faculty", "لون الدكتورة"], ["student", "لون الطالبة"]]
          .forEach(function (f) {
            var lab = document.createElement("label");
            lab.className = "mix-field";
            var inp = document.createElement("input");
            inp.type = "color";
            inp.value = m[f[0]];
            inp.setAttribute("aria-label", f[1]);
            inp.addEventListener("input", function () {
              m[f[0]] = inp.value;
              TPTheme.setMix(m);
              var dot = wrap.querySelector(".theme-dot.mix");
              if (dot) dot.style.setProperty("--dot", m.bg);
            });
            lab.appendChild(inp);
            lab.appendChild(document.createTextNode(f[1]));
            box.appendChild(lab);
          });

        var note = document.createElement("div");
        note.className = "mix-note";
        note.textContent = "لون النصّ يُحسب من الأرضية — فاختاري فاتحةً ينقلب الحبر داكنًا.";
        box.appendChild(note);

        var reset = document.createElement("button");
        reset.type = "button";
        reset.className = "sm ghost";
        reset.textContent = "ابدئي من جديد";
        reset.addEventListener("click", function () {
          TPTheme.setMix(Object.assign({}, DEFAULT_MIX));
          closeMixer(); toggleMixer(true);
          var dot = wrap.querySelector(".theme-dot.mix");
          if (dot) dot.style.setProperty("--dot", DEFAULT_MIX.bg);
        });
        box.appendChild(reset);
        return box;
      }

      return wrap;
    }
  };
})();
