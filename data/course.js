/* ═══════════════════════════════════════════════════════════════
   بيانات المقرر — هذا هو الملف الوحيد الذي يُعدَّل عند إضافة
   حصة جديدة أو شعبة جديدة. لا حاجة لتعديل أي ملف آخر.

   يُحمَّل كملف JavaScript لا كملف JSON حتى تعمل المنصة عند
   فتحها مباشرةً من القرص (file://) بلا خادم.
   ═══════════════════════════════════════════════════════════════ */
window.COURSE = {
  title: "مقرر الولاية والوكالة والوصاية",
  instructor: "د. سعاد المطوع",
  credit: "تم تطوير التطبيق بواسطة بدر المسلم",

  /* الشعب. roster = عدد الطالبات المسجّلات (الحد الأقصى ٤٥).
     عدّل الأعداد بحسب كشف كل شعبة. */
  sections: [
    { id: 1, name: "الشعبة الأولى",  roster: 16 },
    { id: 2, name: "الشعبة الثانية", roster: 16 },
    { id: 3, name: "الشعبة الثالثة", roster: 16 }
  ],

  /* أنواع التفاعل ونقاطها — أساس ترتيب لوحة الشرف.
     هذه نقاط تفاعل صفّي فقط، وليست درجات أكاديمية. */
  engagement: {
    kinds: [
      { id: "read",    label: "قراءة",           points: 2 },
      { id: "answer",  label: "إجابة صحيحة",     points: 3 },
      { id: "ask",     label: "سؤال",             points: 2 },
      { id: "discuss", label: "مشاركة ومناقشة",   points: 1 },
      { id: "submit",  label: "تسليم ورقة عمل",   points: 3 }
    ]
  },

  /* الحصص. status: "ready" متاحة، "soon" قيد التحضير.
     startAt = رقم أول قارئة في الحصة (يُحسب تلقائيًا إن تُرك فارغًا:
     يكمل من حيث انتهت الحصة السابقة). */
  sessions: [
    {
      n: 1,
      title: "تعريف الولاية",
      subtitle: "لغةً واصطلاحًا وشرح التعريف",
      pages: "ص ١–٢",
      file: "sessions/01-tareef-al-wilaya.html",
      readers: 5,        /* عدد شرائح القراءة في الحصة — لحساب بداية الحصة التالية */
      startAt: 1,
      status: "ready"
    },
    {
      n: 2,
      title: "الولاية العامة",
      subtitle: "مقاصدها ومراتبها",
      pages: "ص ٣–٤",
      file: null,
      readers: 0,
      status: "soon"
    }
  ],

  /* العدد الكلي لحصص الفصل. المواضع من الحصة ٣ إلى هذا العدد
     تُولَّد فارغة أدناه لتظهر في المنصة بحالة «قيد التحضير». */
  totalSessions: 30
};

/* ═══ مواضع الحصص التي لم يصل محتواها بعد ═══
   لا تُخترع هنا عناوين ولا صفحات: كل موضع يبقى بلا عنوان حتى يصل
   نص الحصة من المذكرة، فيُستبدل بسطر حقيقي في المصفوفة أعلاه.
   خطوات إضافة الحصة في «دليل التشغيل». */
(function (C) {
  var have = {};
  C.sessions.forEach(function (s) { have[s.n] = true; });
  for (var n = 1; n <= (C.totalSessions || 0); n++) {
    if (have[n]) continue;
    C.sessions.push({
      n: n, title: "", subtitle: "", pages: "",
      file: null, readers: 0, status: "soon", empty: true
    });
  }
  C.sessions.sort(function (a, b) { return a.n - b.n; });
})(window.COURSE);

/* ═══ أدوات مشتركة تعتمد على بيانات المقرر ═══ */
window.TP = (function (COURSE) {
  var LS_KEY = "tp.section";

  /* تحويل الأرقام إلى أرقام عربية-هندية */
  function ar(n) {
    return String(n).replace(/\d/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[d]; });
  }

  function sections() { return COURSE.sections || []; }

  /* الشعبة المطلوبة: رابط الصفحة ← ثم آخر اختيار محفوظ ← ثم أول شعبة */
  function resolveSection(params) {
    var list = sections();
    if (!list.length) return { id: 1, name: "", roster: 1 };
    var wanted = params && params.get("section");
    if (!wanted) { try { wanted = localStorage.getItem(LS_KEY); } catch (e) { wanted = null; } }
    var found = wanted && list.filter(function (s) { return String(s.id) === String(wanted); })[0];
    return found || list[0];
  }

  function rememberSection(id) {
    try { localStorage.setItem(LS_KEY, String(id)); } catch (e) { /* وضع التصفح الخاص */ }
  }

  /* بداية القارئات لحصة ما: من startAt المعلن، وإلا تراكميًا من الحصص السابقة */
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
    ar: ar,
    sections: sections,
    resolveSection: resolveSection,
    rememberSection: rememberSection,
    startAtFor: startAtFor,
    seatMaker: seatMaker
  };
})(window.COURSE);
