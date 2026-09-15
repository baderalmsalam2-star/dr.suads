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

  /* الشعب. roster = عدد احتياطي يُستعمل قبل إدخال الكشف فقط؛ متى
     وُجد كشف بالأسماء صار هو المرجع في عدد القارئات. */
  sections: [
    { id: 1, name: "الشعبة الأولى",  roster: 22 },
    { id: 2, name: "الشعبة الثانية", roster: 16 },
    { id: 3, name: "الشعبة الثالثة", roster: 16 }
  ],

  /* سياسة الحضور. absentLimit = نسبة الغياب التي يترتب عليها
     الحرمان — عدّليها بحسب لائحة الكلية، فهي تختلف بين الكليات.
     الحالات الأربع ثابتة، وتُحتسب «متأخرة» حضورًا و«بعذر» لا تُحسب
     غيابًا في نسبة الحرمان. */
  attendance: {
    absentLimit: 0.25,
    warnAt: 0.15,
    states: [
      { id: "present", label: "حاضرة",  short: "ح", counts: true  },
      { id: "late",    label: "متأخرة", short: "ت", counts: true  },
      { id: "excused", label: "بعذر",   short: "ع", counts: null  },
      { id: "absent",  label: "غائبة",  short: "غ", counts: false }
    ]
  },

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

  /* ═══ توزيعة الدرجات ═══
     منقولة حرفيًا من خطة المقرر الرسمية التي أصدرتها الدكتورة:
       ٦٠ درجة أعمال الفصل = ١٠ واجبات إلكترونية + ١٠ مشاركة صفّية
                              + ٤٠ الاختبارات الفصلية
       ٤٠ درجة الاختبار النهائي

     ولاحظ أمرين قرّرتهما الخطة ولم يقرّرهما البرنامج:

     ١) لا درجة للحضور إطلاقًا. الغياب تحكمه «لائحة الغياب» لا نقاط:
        تجاوز الحدّ يُفضي إلى الحرمان لا إلى خصم درجات. فالمنصة ترصد
        الحضور وتنذر بالحرمان، ولا تحوّله إلى درجة.

     ٢) الاختبار الثالث **تعويضي لا إضافي**: لا يدخل المجموع، بل يحلّ
        محلّ اختبارٍ واحد فات الطالبة. لذلك max له صفر وله makeupFor.

     source: engagement | worksheets | manual   (انظر assets/store.js)
     bonus:  درجات فوق max لا ترفع المقسوم عليه. */
  grading: {
    confirmed: true,
    source: "خطة المقرر — د. سعاد المطوع",
    items: [
      { id: "homework",      label: "واجبات إلكترونية", max: 10,
        source: "worksheets" },

      { id: "participation", label: "مشاركة صفّية",     max: 10,
        source: "engagement", basis: "relative" },

      { id: "exam1", label: "الاختبار الأول",  max: 20, bonus: 5,
        source: "manual", date: "2026-10-22", required: true },

      { id: "exam2", label: "الاختبار الثاني", max: 20, bonus: 5,
        source: "manual", date: "2026-11-26", required: true },

      { id: "exam3", label: "الاختبار الثالث", max: 0,
        source: "manual", date: "2026-12-17",
        makeupFor: ["exam1", "exam2"], cap: 20,
        hint: "تعويضي لمن فاتها أحد الاختبارين — والمطلوب كمية الاختبارين" },

      { id: "final", label: "الاختبار النهائي", max: 40, source: "manual" }
    ],
    /* البونص قد يرفع المجموع فوق ١٠٠. يُعرض كما هو، ويُسقَف عند
       احتساب التقدير وحده. */
    capAt: 100,
    grades: [
      { min: 95, label: "A+" }, { min: 90, label: "A"  },
      { min: 85, label: "B+" }, { min: 80, label: "B"  },
      { min: 75, label: "C+" }, { min: 70, label: "C"  },
      { min: 65, label: "D+" }, { min: 60, label: "D"  },
      { min: 0,  label: "F"  }
    ]
  },

  /* الكتاب المقرر — كما في خطة المقرر. مؤلِّفة المذكرة غير مدرِّسة
     المقرر، فلا يُنسب أحدهما إلى الآخر. */
  textbook: "مذكرة د. فاطمة الرشيدي",

  /* الحصص. status: "ready" متاحة، "soon" قيد التحضير.
     startAt = رقم أول قارئة في الحصة (يُحسب تلقائيًا إن تُرك فارغًا:
     يكمل من حيث انتهت الحصة السابقة). */
  /* ═══ الحصص ═══
     الحصة الأولى مكتوبة يدويًا. وما بعدها مولَّد من المذكرة، فلا
     يُحرَّر يدويًا: عدّل tools/plan-*.json ثم أعد تشغيل
     tools/build_sessions.py */
  sessions: [
    { n: 1, title: "تعريف الولاية", subtitle: "لغةً واصطلاحًا وشرح التعريف",
      pages: "ص ١–٢", file: "sessions/01-tareef-al-wilaya.html",
      readers: 5, startAt: 1, status: "ready" }/* GENERATED:SESSIONS:START */,
    { n: 2, title: "الولاية العامة", subtitle: "تمام شرح التعريف ومقاصد الولاية العامة", pages: "الولاية الخاصة",
      file: "sessions/02-wilaya.html", readers: 12, status: "ready" },
    { n: 3, title: "الولاية الخاصة", subtitle: "أنواعها وانتقالها ومنزلتها من الولاية العامة", pages: "الولاية الخاصة",
      file: "sessions/03-wilaya.html", readers: 18, status: "ready" },
    { n: 4, title: "أدلة مشروعية الولاية الخاصة", subtitle: "من الكتاب والسنة وأقوال الصحابة والمعقول", pages: "أدلة مشروعية الولاية الخاصة",
      file: "sessions/04-wilaya.html", readers: 24, status: "ready" },
    { n: 5, title: "شروط الأولياء", subtitle: "سبعة شروط — والمتفق عليه منها أربعة", pages: "شروط الأولياء في الولاية الخاصة",
      file: "sessions/05-wilaya.html", readers: 27, status: "ready" },
    { n: 6, title: "الولاية على المال", subtitle: "القاصرة والمتعدية، والمحجور عليهم، ومن له الولاية", pages: "أنواع الولاية الخاصة",
      file: "sessions/06-wilaya.html", readers: 17, status: "ready" },
    { n: 7, title: "الولاية على المال في القانون الكويتي", subtitle: "مواد ١١٠–١١٨ وما يجوز للولي من التصرفات", pages: "قانون الأحوال الشخصية الكويتي",
      file: "sessions/07-wilaya.html", readers: 40, status: "ready" },
    { n: 8, title: "الولاية على النفس", subtitle: "التربية والتأديب وضوابط الضرب، وأسباب الولاية الثلاثة", pages: "النوع الثاني: الولاية على النفس",
      file: "sessions/08-wilaya.html", readers: 36, status: "ready" },
    { n: 9, title: "ولاية المرأة في تزويج نفسها", subtitle: "الأقوال الثلاثة وأدلة الجمهور والحنفية والترجيح", pages: "ولاية المرأة في تزويج نفسها",
      file: "sessions/09-wilaya.html", readers: 25, status: "ready" },
    { n: 10, title: "الزواج في القانون · ناظر الوقف · انتهاء الولاية", subtitle: "مواد ٢٩–٣٣ ونظارة الوقف وما تنتهي به الولاية", pages: "قانون الأحوال الشخصية · ولاية ناظر الوقف",
      file: "sessions/10-wilaya.html", readers: 18, status: "ready" },
    { n: 11, title: "الوكالة", subtitle: "تعريفها لغةً واصطلاحًا وأدلة مشروعيتها وأركانها", pages: "الوكالة",
      file: "sessions/11-wakala.html", readers: 11, status: "ready" },
    { n: 12, title: "صيغة الوكالة", subtitle: "الإيجاب والقبول بغير اللفظ، وتراخي القبول", pages: "الركن الأول: الصيغة",
      file: "sessions/12-wakala.html", readers: 29, status: "ready" },
    { n: 13, title: "أقسام صيغة الوكالة وصفة العقد", subtitle: "المنجزة والمعلقة والمضافة والمؤقتة، ولزوم العقد", pages: "أقسام صيغة الوكالة",
      file: "sessions/13-wakala.html", readers: 19, status: "ready" },
    { n: 14, title: "العاقدان ومحل الوكالة", subtitle: "شروط الموكل والوكيل، والوكالة الخاصة والعامة", pages: "الركن الثاني: العاقدان",
      file: "sessions/14-wakala.html", readers: 33, status: "ready" },
    { n: 15, title: "محل الوكالة", subtitle: "مواد القانون المدني، وما يصح التوكيل فيه وما لا يصح", pages: "القانون المدني · الأمور التي تقع عليها الوكالة",
      file: "sessions/15-wakala.html", readers: 34, status: "ready" },
    { n: 16, title: "التوكيل بالخصومة", subtitle: "أقوال الفقهاء، وإثبات القصاص والحدود واستيفاؤها", pages: "أقوال الفقهاء في حكم التوكيل بالخصومة",
      file: "sessions/16-wakala.html", readers: 16, status: "ready" },
    { n: 17, title: "أحكام الوكالة · تنفيذ الوكالة", subtitle: "الوكالة بالبيع مطلقةً ومقيدةً", pages: "أحكام الوكالة",
      file: "sessions/17-wakala.html", readers: 21, status: "ready" },
    { n: 18, title: "بيانات الوكيل والتزاماته", subtitle: "تقديم الحساب ورد الأمانة، ومواد ٧٠٤–٧١٠، والأجرة", pages: "أحكام الوكيل · القانون المدني",
      file: "sessions/18-wakala.html", readers: 21, status: "ready" },
    { n: 19, title: "مخالفة الوكيل في البيع", subtitle: "المخالفة في الثمن والمكان والزمان والمشتري وتفريق الصفقة", pages: "مخالفة الوكيل لقيود الموكل في البيع",
      file: "sessions/19-wakala.html", readers: 29, status: "ready" },
    { n: 20, title: "الوكالة بالشراء", subtitle: "إطلاقها وتقييدها، وشراء الوكيل من نفسه، ومخالفاته", pages: "ثانيًا: الوكالة بالشراء",
      file: "sessions/20-wakala.html", readers: 27, status: "ready" },
    { n: 21, title: "التزامات الموكل في القانون المدني", subtitle: "مواد ٧١١–٧١٥، وأحكام النيابة في التعاقد ٥٦–٦٣", pages: "القانون المدني الكويتي",
      file: "sessions/21-wakala.html", readers: 16, status: "ready" },
    { n: 22, title: "حقوق العقد واختلاف الوكيل والموكل", subtitle: "الجهة التي تتعلق بها الحقوق، وصور الاختلاف", pages: "القسم الثالث: ما يتعلق بالغير",
      file: "sessions/22-wakala.html", readers: 22, status: "ready" },
    { n: 23, title: "انتهاء الوكالة · العزل", subtitle: "شروط صحة العزل، وعزل الوكيل نفسه", pages: "انتهاء الوكالة",
      file: "sessions/23-wakala.html", readers: 9, status: "ready" },
    { n: 24, title: "مبطلات الوكالة", subtitle: "الوفاة والجنون والحجر والردة والفسق، ومواد ٧١٦–٧١٩", pages: "انتهاء الوكالة · القانون المدني",
      file: "sessions/24-wakala.html", readers: 31, status: "ready" },
    { n: 25, title: "الوصاية", subtitle: "تعريفها ومشروعيتها وحكمها التكليفي وأنواع الأوصياء", pages: "الوصاية",
      file: "sessions/25-wisaya.html", readers: 20, status: "ready" },
    { n: 26, title: "الركن الأول: الوصي", subtitle: "الشروط المتفق عليها والمختلف فيها", pages: "أركان الوصية · الوصي",
      file: "sessions/26-wisaya.html", readers: 29, status: "ready" },
    { n: 27, title: "وقت اعتبار الشروط والوصاية إلى اثنين", subtitle: "أقسام الإيصاء إلى وصيين، وموت أحدهما، ومرتبة الوصي", pages: "الوصاية إلى اثنين فأكثر",
      file: "sessions/27-wisaya.html", readers: 23, status: "ready" },
    { n: 28, title: "الموصي والموصى به والصيغة", subtitle: "شروط الموصي، ومحل الإيصاء، والإيجاب والقبول", pages: "الركن الثاني: الموصي",
      file: "sessions/28-wisaya.html", readers: 36, status: "ready" },
    { n: 29, title: "تصرفات الوصي", subtitle: "الزكاة والأضحية، والبيع والاتجار، والتبرع والأجرة", pages: "تصرفات الوصي",
      file: "sessions/29-wisaya.html", readers: 34, status: "ready" },
    { n: 30, title: "الوصاية على التزويج وفي القانون", subtitle: "الأقوال الثلاثة، ومواد ١١٩–١٢٦ والمشرف", pages: "الوصاية على التزويج · قانون الأحوال الشخصية",
      file: "sessions/30-wisaya.html", readers: 21, status: "ready" }
  /* GENERATED:SESSIONS:END */
  ],

  /* العدد الكلي لحصص الفصل. المواضع من الحصة ٣ إلى هذا العدد
     تُولَّد فارغة أدناه لتظهر في المنصة بحالة «قيد التحضير». */
  totalSessions: 30
};


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
