/* ═══════════════════════════════════════════════════════════════
   مقرر الولاية الخاصة — كلية الشريعة والدراسات الإسلامية.

   هذا هو الملف الوحيد الذي يُعدَّل عند إضافة محاضرة جديدة أو شعبة
   جديدة في هذا المقرر. لا حاجة لتعديل أي ملف آخر.

   يُحمَّل كملف JavaScript لا كملف JSON حتى تعمل المنصة عند فتحها
   مباشرةً من القرص (file://) بلا خادم. ويُسجَّل في سجلّ المقررات
   (data/courses.js) الذي يختار المقرر العامل.
   ═══════════════════════════════════════════════════════════════ */
TPCourse.add({
  id: "wilaya",

  title: "مقرر الولاية الخاصة",
  /* اسمٌ قصير لقائمة اختيار المقرر في الترويسة */
  short: "الولاية الخاصة",
  year: "١٤٤٨ هـ · ٢٠٢٦–٢٠٢٧ م — الفصل الأول",
  /* أيام المحاضرة في الأسبوع (٠ الأحد … ٦ السبت) وتاريخ أول محاضرة —
     يُستعملان افتراضًا في مولّد تواريخ المحاضرات بصفحة الحضور.
     أول محاضرة: الخميس ١٧ سبتمبر ٢٠٢٦. */
  classDays: [0, 2, 4],
  firstClass: "2026-09-17",

  /* ═══ التقويم الجامعي — الفصل الأول ٢٠٢٦/٢٠٢٧ ═══
     منقول من تقويم عمادة القبول والتسجيل (do.ku.edu.kw).
     يُعرض في لوحة جدول التواريخ، ويُنذر المولّد إن تجاوزت المحاضرات
     آخر يوم دراسة. ولم يُدرج التقويم عطلةً رسمية داخل هذا الفصل. */
  term: {
    label: "الفصل الأول ٢٠٢٦/٢٠٢٧",
    start:      "2026-09-13",   /* بدء الدراسة الرسمي — الأحد */
    lastClass:  "2026-12-21",   /* آخر يوم في الدراسة */
    finalsFrom: "2026-12-23",
    finalsTo:   "2027-01-04",
    marks: [
      { date: "2026-10-22", label: "آخر يوم لوقف القيد" },
      { date: "2026-10-24", label: "آخر يوم للانسحاب من المقررات" },
      { date: "2026-11-26", label: "آخر يوم لالتماسات الانسحاب الكلي" },
      { date: "2027-01-09", label: "آخر يوم لإدخال الدرجات" }
    ]
  },

  /* أيام الاختبارات. تشغل وقت المحاضرة، فلا يُولَّد عليها درسٌ —
     والمولّد يتخطّاها. تواريخها من خطة المقرر. */
  examDays: [
    { date: "2026-10-22", label: "الاختبار الأول",  item: "exam1" },
    { date: "2026-11-26", label: "الاختبار الثاني", item: "exam2" },
    { date: "2026-12-17", label: "الاختبار الثالث (تعويضي)", item: "exam3" }
  ],
  instructor: "د. سعاد المطوع",
  /* سطر الاعتماد في أسفل كل صفحة. الاسم يصير رابطًا إلى واتساب
     ليصل من يحتاج دعمًا إلى المطوّر مباشرةً. */
  credit: "تم تطوير التطبيق بواسطة بدر المسلم",
  creditBy: "بدر المسلم",
  creditLink: "https://wa.me/qr/33UVHUYS7F7IO1",

  /* الشعب. roster = عدد احتياطي يُستعمل قبل إدخال الكشف فقط؛ متى
     وُجد كشف بالأسماء صار هو المرجع في عدد القارئات. */
  /* شعبة واحدة. لإضافة غيرها لاحقًا يُكتب سطرٌ هنا، وتظهر قائمة
     الاختيار في الصفحات من نفسها — وهي تختفي ما دامت الشعبة واحدة.
     ويصير مفتاح الشعبة في السجلات «wilaya:1» — يضيفه سجلّ المقررات
     من نفسه، فلا يُكتب هنا. */
  sections: [
    { id: 1, name: "الشعبة الأولى", roster: 22 }
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
        source: "worksheets", types: ["classwork", "homework"] },

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
    /* البونص يرفع المجموع فوق ١٠٠ ولا يُسقَف — أقرّته الدكتورة.
       (اجعليها رقمًا لتسقيفه، وnull لتركه) */
    capAt: null,
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

  /* المحاضرات. status: "ready" متاحة، "soon" قيد التحضير.
     startAt = رقم أول قارئة في المحاضرة (يُحسب تلقائيًا إن تُرك فارغًا:
     يكمل من حيث انتهت المحاضرة السابقة). */
  /* ═══ المحاضرات ═══
     المحاضرة الأولى مكتوبة يدويًا. وما بعدها مولَّد من المذكرة، فلا
     يُحرَّر يدويًا: عدّل tools/plan-*.json ثم أعد تشغيل
     tools/build_sessions.py */
  sessions: [
    { n: 1, title: "تعريف الولاية", subtitle: "لغةً واصطلاحًا وشرح التعريف",
      pages: "ص ١–٢", file: "sessions/wilaya/01-tareef-al-wilaya.html",
      readers: 5, startAt: 1, status: "ready" }/* GENERATED:SESSIONS:START */,
    { n: 2, title: "الولاية العامة", subtitle: "تمام شرح التعريف ومقاصد الولاية العامة", pages: "الولاية الخاصة",
      file: "sessions/wilaya/02-wilaya.html", readers: 12, status: "ready" },
    { n: 3, title: "الولاية الخاصة", subtitle: "أنواعها وانتقالها ومنزلتها من الولاية العامة", pages: "الولاية الخاصة",
      file: "sessions/wilaya/03-wilaya.html", readers: 18, status: "ready" },
    { n: 4, title: "أدلة مشروعية الولاية الخاصة", subtitle: "من الكتاب والسنة وأقوال الصحابة والمعقول", pages: "أدلة مشروعية الولاية الخاصة",
      file: "sessions/wilaya/04-wilaya.html", readers: 24, status: "ready" },
    { n: 5, title: "شروط الأولياء", subtitle: "سبعة شروط — والمتفق عليه منها أربعة", pages: "شروط الأولياء في الولاية الخاصة",
      file: "sessions/wilaya/05-wilaya.html", readers: 27, status: "ready" },
    { n: 6, title: "الولاية على المال", subtitle: "القاصرة والمتعدية، والمحجور عليهم، ومن له الولاية", pages: "أنواع الولاية الخاصة",
      file: "sessions/wilaya/06-wilaya.html", readers: 17, status: "ready" },
    { n: 7, title: "الولاية على المال في القانون الكويتي", subtitle: "مواد ١١٠–١١٨ وما يجوز للولي من التصرفات", pages: "قانون الأحوال الشخصية الكويتي",
      file: "sessions/wilaya/07-wilaya.html", readers: 40, status: "ready" },
    { n: 8, title: "الولاية على النفس", subtitle: "التربية والتأديب وضوابط الضرب، وأسباب الولاية الثلاثة", pages: "النوع الثاني: الولاية على النفس",
      file: "sessions/wilaya/08-wilaya.html", readers: 36, status: "ready" },
    { n: 9, title: "ولاية المرأة في تزويج نفسها", subtitle: "الأقوال الثلاثة وأدلة الجمهور والحنفية والترجيح", pages: "ولاية المرأة في تزويج نفسها",
      file: "sessions/wilaya/09-wilaya.html", readers: 25, status: "ready" },
    { n: 10, title: "الزواج في القانون · ناظر الوقف · انتهاء الولاية", subtitle: "مواد ٢٩–٣٣ ونظارة الوقف وما تنتهي به الولاية", pages: "قانون الأحوال الشخصية · ولاية ناظر الوقف",
      file: "sessions/wilaya/10-wilaya.html", readers: 18, status: "ready" },
    { n: 11, title: "الوكالة", subtitle: "تعريفها لغةً واصطلاحًا وأدلة مشروعيتها وأركانها", pages: "الوكالة",
      file: "sessions/wilaya/11-wakala.html", readers: 11, status: "ready" },
    { n: 12, title: "صيغة الوكالة", subtitle: "الإيجاب والقبول بغير اللفظ، وتراخي القبول", pages: "الركن الأول: الصيغة",
      file: "sessions/wilaya/12-wakala.html", readers: 29, status: "ready" },
    { n: 13, title: "أقسام صيغة الوكالة وصفة العقد", subtitle: "المنجزة والمعلقة والمضافة والمؤقتة، ولزوم العقد", pages: "أقسام صيغة الوكالة",
      file: "sessions/wilaya/13-wakala.html", readers: 19, status: "ready" },
    { n: 14, title: "العاقدان ومحل الوكالة", subtitle: "شروط الموكل والوكيل، والوكالة الخاصة والعامة", pages: "الركن الثاني: العاقدان",
      file: "sessions/wilaya/14-wakala.html", readers: 33, status: "ready" },
    { n: 15, title: "محل الوكالة", subtitle: "مواد القانون المدني، وما يصح التوكيل فيه وما لا يصح", pages: "القانون المدني · الأمور التي تقع عليها الوكالة",
      file: "sessions/wilaya/15-wakala.html", readers: 34, status: "ready" },
    { n: 16, title: "التوكيل بالخصومة", subtitle: "أقوال الفقهاء، وإثبات القصاص والحدود واستيفاؤها", pages: "أقوال الفقهاء في حكم التوكيل بالخصومة",
      file: "sessions/wilaya/16-wakala.html", readers: 16, status: "ready" },
    { n: 17, title: "أحكام الوكالة · تنفيذ الوكالة", subtitle: "الوكالة بالبيع مطلقةً ومقيدةً", pages: "أحكام الوكالة",
      file: "sessions/wilaya/17-wakala.html", readers: 21, status: "ready" },
    { n: 18, title: "بيانات الوكيل والتزاماته", subtitle: "تقديم الحساب ورد الأمانة، ومواد ٧٠٤–٧١٠، والأجرة", pages: "أحكام الوكيل · القانون المدني",
      file: "sessions/wilaya/18-wakala.html", readers: 21, status: "ready" },
    { n: 19, title: "مخالفة الوكيل في البيع", subtitle: "المخالفة في الثمن والمكان والزمان والمشتري وتفريق الصفقة", pages: "مخالفة الوكيل لقيود الموكل في البيع",
      file: "sessions/wilaya/19-wakala.html", readers: 29, status: "ready" },
    { n: 20, title: "الوكالة بالشراء", subtitle: "إطلاقها وتقييدها، وشراء الوكيل من نفسه، ومخالفاته", pages: "ثانيًا: الوكالة بالشراء",
      file: "sessions/wilaya/20-wakala.html", readers: 27, status: "ready" },
    { n: 21, title: "التزامات الموكل في القانون المدني", subtitle: "مواد ٧١١–٧١٥، وأحكام النيابة في التعاقد ٥٦–٦٣", pages: "القانون المدني الكويتي",
      file: "sessions/wilaya/21-wakala.html", readers: 16, status: "ready" },
    { n: 22, title: "حقوق العقد واختلاف الوكيل والموكل", subtitle: "الجهة التي تتعلق بها الحقوق، وصور الاختلاف", pages: "القسم الثالث: ما يتعلق بالغير",
      file: "sessions/wilaya/22-wakala.html", readers: 22, status: "ready" },
    { n: 23, title: "انتهاء الوكالة · العزل", subtitle: "شروط صحة العزل، وعزل الوكيل نفسه", pages: "انتهاء الوكالة",
      file: "sessions/wilaya/23-wakala.html", readers: 9, status: "ready" },
    { n: 24, title: "مبطلات الوكالة", subtitle: "الوفاة والجنون والحجر والردة والفسق، ومواد ٧١٦–٧١٩", pages: "انتهاء الوكالة · القانون المدني",
      file: "sessions/wilaya/24-wakala.html", readers: 31, status: "ready" },
    { n: 25, title: "الوصاية", subtitle: "تعريفها ومشروعيتها وحكمها التكليفي وأنواع الأوصياء", pages: "الوصاية",
      file: "sessions/wilaya/25-wisaya.html", readers: 20, status: "ready" },
    { n: 26, title: "الركن الأول: الوصي", subtitle: "الشروط المتفق عليها والمختلف فيها", pages: "أركان الوصية · الوصي",
      file: "sessions/wilaya/26-wisaya.html", readers: 29, status: "ready" },
    { n: 27, title: "وقت اعتبار الشروط والوصاية إلى اثنين", subtitle: "أقسام الإيصاء إلى وصيين، وموت أحدهما، ومرتبة الوصي", pages: "الوصاية إلى اثنين فأكثر",
      file: "sessions/wilaya/27-wisaya.html", readers: 23, status: "ready" },
    { n: 28, title: "الموصي والموصى به والصيغة", subtitle: "شروط الموصي، ومحل الإيصاء، والإيجاب والقبول", pages: "الركن الثاني: الموصي",
      file: "sessions/wilaya/28-wisaya.html", readers: 36, status: "ready" },
    { n: 29, title: "تصرفات الوصي", subtitle: "الزكاة والأضحية، والبيع والاتجار، والتبرع والأجرة", pages: "تصرفات الوصي",
      file: "sessions/wilaya/29-wisaya.html", readers: 34, status: "ready" },
    { n: 30, title: "الوصاية على التزويج وفي القانون", subtitle: "الأقوال الثلاثة، ومواد ١١٩–١٢٦ والمشرف", pages: "الوصاية على التزويج · قانون الأحوال الشخصية",
      file: "sessions/wilaya/30-wisaya.html", readers: 21, status: "ready" }
  /* GENERATED:SESSIONS:END */
  ],

  /* العدد الكلي لمحاضرات الفصل. المواضع من المحاضرة ٣ إلى هذا العدد
     تُولَّد فارغة أدناه لتظهر في المنصة بحالة «قيد التحضير». */
  totalSessions: 30
});
