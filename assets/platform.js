/* ═══ الصفحة الرئيسية: لوحة شرف اليوم + بطاقات المحاضرات ═══ */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var el = TPUI.el, ar = TP.ar;
  var KINDS = (COURSE.engagement || {}).kinds || [];
  var LABEL = {};
  KINDS.forEach(function (k) { LABEL[k.id] = k.label; });

  document.title = "منصة التدريس — " + (COURSE.title || "");
  TPUI.chrome("home", COURSE.title, COURSE.instructor);
  TPUI.credit("credit");

  var section = TPUI.sectionPicker(document.getElementById("section"), function (s) {
    section = s; render();
  });

  var list = document.getElementById("sessions");
  var today = document.getElementById("today");

  var staff = false;
  function REF_OF(s) { return (COURSE.id || "course") + ":s" + s.n; }
  function REF_X(x) { return (COURSE.id || "course") + ":x" + x.id; }
  var openX = {};

  /*  الاختبار المفتوح يظهر هنا للطالبة، لا في أوراق العمل ولا في
      صفحة الاختبارات — تلك للدكتورة. فتجده في المكان الذي تفتحه
      كلَّ يوم، ولا تُدلّ على بابٍ ليس لها. */
  function renderExams() {
    var host = document.getElementById("examsHere");
    if (!host) return;
    host.textContent = "";
    if (staff) return;                    /* للدكتورة صفحتُها */
    var live = (window.EXAMS || []).filter(function (x) { return openX[x.id] === "1"; });
    if (!live.length) return;

    host.appendChild(el("div", "section-title", "الاختبارات"));
    var ul = el("ul", "cards exam-cards");
    live.forEach(function (x) {
      var li = el("li", "card ready exam");
      li.appendChild(el("span", "badge", "مفتوح الآن"));
      var a = el("a", "open");
      a.href = "exam.html?x=" + encodeURIComponent(x.id) +
               "&section=" + encodeURIComponent(section.id);
      a.appendChild(el("span", "no", "اختبار رسميّ"));
      a.appendChild(el("h2", "", x.title));
      if (x.scope) a.appendChild(el("div", "sub", x.scope));
      var meta = el("div", "meta");
      meta.appendChild(el("span", "", x.date ? TPUI.arDate(x.date) : ""));
      meta.appendChild(el("span", "readers", ar(x.minutes) + " دقيقة"));
      a.appendChild(meta);
      li.appendChild(a);
      ul.appendChild(li);
    });
    host.appendChild(ul);
  }

  /*  الدور يُسأل مرةً واحدة، والأصلُ الإخفاء حتى يؤكّد الخادم: أن
      ينكشف للدكتورة بعد لحظة أهونُ من أن ينكشف للطالبة ثم يُسحب. */
  function boot() {
    return TPRole.staff().then(function (ok) {
      staff = !!ok;
      return window.TPContent ? TPContent.ready() : null;
    }).then(function () {
      if (!window.TPContent) return;
      (COURSE.sessions || []).forEach(function (s) {
        opened[String(s.n)] = TPContent.get(REF_OF(s), "released") || "";
      });
      (window.EXAMS || []).forEach(function (x) {
        openX[x.id] = TPContent.get(REF_X(x), "released") || "";
      });
    }).catch(function () { /* بلا خادم: تبقى كما هي */ });
  }

  function render() {
    Store.students(section.id).then(function (list) {
      var n = list.length || section.roster;
      document.getElementById("hint").textContent =
        "القارئات تُوزَّع على " + TPUI.students(n) + " في الشعبة";
      renderSessions(n);
    }).catch(function () { renderSessions(section.roster); });
    renderExams();
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
          "افتحي عرض المحاضرة واضغطي مفتاح «م» لفتح لوحة الرصد أثناء الشرح."));
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

  /* ─── بطاقات المحاضرات ─── */
  var showAll = false;
  var toggle = document.getElementById("toggleAll");
  if (toggle) {
    toggle.addEventListener("click", function () {
      showAll = !showAll;
      renderSessions();
    });
  }

  /* ═══ المحاضرة لا تُفتح للطالبة إلا بإذن الدكتورة ═══
     كانت المحاضرات كلُّها معروضةً للجميع، فتقرأ الطالبةُ درسَ
     الأسبوع القادم قبل أوانه. فصارت كلُّ محاضرةٍ مغلقةً حتى تفتحها
     الدكتورة بزرٍّ في بطاقتها.

     وهذا ترتيبُ عرضٍ لا حاجزُ أمان، وقد كُتب صراحةً حتى لا يُظنّ
     به ما ليس فيه: ملفّ المحاضرة ساكنٌ على نشرةٍ علنيّة، فمن حفظ
     رابطه فتحه. والمقصود ألّا يُعرض ما لم يحن وقتُه، لا منعُ من
     قصد. وما يُحرَس حقًّا — الكشف والدرجات والحضور — محروسٌ في
     الخادم بـRLS. */
  var opened = {};
  function isOpen(s) { return opened[String(s.n)] === "1"; }

  function renderSessions(rosterSize) {
    var all = COURSE.sessions || [];
    if (!staff) {
      all = all.filter(function (s) { return isOpen(s); });
      if (toggle) toggle.hidden = true;
    }
    var ready = all.filter(function (s) { return s.status === "ready" && s.file; });
    var pending = all.filter(function (s) { return !(s.status === "ready" && s.file); });
    var shown = showAll ? all : ready.concat(pending.filter(function (s) { return s.title; }));

    if (!all.length && !staff) {
      document.getElementById("sessionsSub").textContent = "";
      list.textContent = "";
      list.appendChild(TPUI.empty("لم تُفتح محاضرةٌ بعد.",
        "تفتحها الدكتورة قبل كل درس، فتظهر هنا."));
      return;
    }

    if (toggle) {
      toggle.textContent = showAll
        ? "إخفاء المحاضرات التي لم تُجهَّز"
        : "عرض كل محاضرات الفصل (" + ar(all.length) + ")";
    }
    document.getElementById("sessionsSub").textContent =
      ar(ready.length) + " جاهزة من " + ar(all.length);

    list.textContent = "";
    shown.forEach(function (s) {
      var isReady = s.status === "ready" && s.file;
      var li = el("li", "card " + (isReady ? "ready" : "soon"));
      li.appendChild(el("span", "badge", isReady ? "متاحة" : "قيد التحضير"));

      var body = document.createElement(isReady ? "a" : "div");
      body.className = isReady ? "open" : "body";
      if (isReady) body.href = s.file + "?section=" + encodeURIComponent(section.id);

      body.appendChild(el("span", "no", "المحاضرة " + ar(s.n)));
      body.appendChild(el("h2", "", s.title || "لم يصل محتواها بعد"));
      if (s.subtitle) body.appendChild(el("div", "sub", s.subtitle));

      var meta = el("div", "meta");
      meta.appendChild(el("span", "", s.pages || ""));
      if (isReady && s.readers) {
        var seat = TP.seatMaker(rosterSize || section.roster, TP.startAtFor(s));
        meta.appendChild(el("span", "readers",
          "القارئات: " + ar(seat(0)) + " – " + ar(seat(s.readers - 1))));
      }
      body.appendChild(meta);
      li.appendChild(body);

      if (staff && isReady) {
        var open = isOpen(s);
        var b = el("button", "sm " + (open ? "ghost" : "gold"),
                   open ? "مفتوحة للطالبات — أغلقيها" : "افتحيها للطالبات");
        b.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          b.disabled = true;
          var next = open ? "" : "1";
          TPContent.set(REF_OF(s), "released", next).then(function () {
            opened[String(s.n)] = next;
            renderSessions(rosterSize);
            TPUI.toast(next ? "فُتحت المحاضرة للطالبات."
                            : "أُغلقت — لم تعد تظهر لهنّ.", "good");
          }).catch(function (e) {
            b.disabled = false;
            TPUI.toast(e.message || "تعذّر الحفظ.", "bad");
          });
        });
        li.appendChild(b);
      }

      list.appendChild(li);
    });
  }

  /*  الدور وحالةُ الفتح قبل أول رسم: الرسمُ قبلهما يُظهر للطالبة
      ما لم يُفتح لها ثم يسحبه، وهو أسوأ من تأخّرٍ يسير. */
  boot().then(render);
})();
