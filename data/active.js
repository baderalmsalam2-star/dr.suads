/* ═══════════════════════════════════════════════════════════════
   انتخاب المقرر العامل — يُحمَّل آخرَ ملفات البيانات.

   بعده تجد بقية المنصة ما تتوقعه بلا تغيير:
       window.COURSE      بيانات المقرر المفتوح
       window.WORKSHEETS  أوراقه وأنشطته
       window.TP          أدواته المشتركة

   ترتيب الانتخاب:
     ١) ?course=<معرّف> في رابط الصفحة
     ٢) بادئة ?section=<مقرر:شعبة> — فرابط الباركود وحده يفتح
        المقرر الصحيح على جهاز الطالبة بلا أن تختار شيئًا
     ٣) آخر مقرر اختير على هذا الجهاز
     ٤) أول مقرر مسجَّل
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var LIST = window.TP_COURSES || [];
  var LS_COURSE = "tp.course";
  var LS_SECTION = "tp.section";

  function get(id) {
    for (var i = 0; i < LIST.length; i++) {
      if (String(LIST[i].id) === String(id)) return LIST[i];
    }
    return null;
  }

  function stored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function keep(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* تصفّح خاص */ } }

  function resolveCourse() {
    var p = new URLSearchParams(location.search);
    var sec = p.get("section") || "";
    var byPrefix = sec.indexOf(":") > 0 ? sec.split(":")[0] : null;
    return get(p.get("course")) || get(byPrefix) || get(stored(LS_COURSE)) ||
           LIST[0] || { id: "", title: "", sections: [], sheets: [] };
  }

  var COURSE = resolveCourse();
  if (COURSE.id) keep(LS_COURSE, COURSE.id);

  window.COURSE = COURSE;
  window.WORKSHEETS = COURSE.sheets || [];
  window.EXAMS = COURSE.exams || [];
  window.EVIDENCES = COURSE.evidences || null;


  /* ═══ أدوات مشتركة تعتمد على بيانات المقرر ═══ */
  window.TP = (function (COURSE) {

    /* تحويل الأرقام إلى أرقام عربية-هندية */
    function ar(n) {
      return String(n).replace(/\d/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[d]; });
    }

    function courses() { return LIST; }

    /*  تبديل المقرر: يُنسى اختيار الشعبة، لأن مفاتيح الشعب
        مقرَّرية — وشعبة المقرر السابق لا وجود لها في الجديد. */
    function setCourse(id) {
      if (!get(id)) return false;
      keep(LS_COURSE, id);
      try { localStorage.removeItem(LS_SECTION); } catch (e) {}
      return true;
    }

    function sections() { return COURSE.sections || []; }

    /* الشعبة المطلوبة: رابط الصفحة ← ثم آخر اختيار محفوظ ← ثم أول شعبة */
    function resolveSection(params) {
      var list = sections();
      if (!list.length) return { id: COURSE.id + ":1", no: 1, name: "", roster: 1 };
      var wanted = params && params.get("section");
      if (!wanted) wanted = stored(LS_SECTION);
      var found = wanted && list.filter(function (s) { return String(s.id) === String(wanted); })[0];
      return found || list[0];
    }

    function rememberSection(id) { keep(LS_SECTION, id); }

    /* بداية القارئات لمحاضرة ما: من startAt المعلن، وإلا تراكميًا من المحاضرات السابقة */
    function startAtFor(session) {
      if (!session || !session.n) return 1;
      if (session.startAt) return session.startAt;
      var n = 1;
      var all = COURSE.sessions || [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].n === session.n) break;
        n += all[i].readers || 0;
      }
      return n;
    }

    /* توزيع دائري لأرقام القارئات على عدد المسجّلات */
    function seatMaker(roster, startAt) {
      var size = Math.min(Math.max(roster || 1, 1), 45);
      return function (k) { return ((startAt - 1 + k) % size) + 1; };
    }

    return {
      course: COURSE,
      courses: courses,
      setCourse: setCourse,
      ar: ar,
      sections: sections,
      resolveSection: resolveSection,
      rememberSection: rememberSection,
      startAtFor: startAtFor,
      seatMaker: seatMaker
    };
  })(COURSE);
})();
