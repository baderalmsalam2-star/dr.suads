/* ═══════════════════════════════════════════════════════════════
   سجلّ المقررات — المنصة تخدم أكثر من مقرر.

   كل مقرر مجلَّدٌ في data/courses/<المعرّف>/ فيه ثلاثة ملفات:
       course.js       بيانات المقرر ومحاضراته وتوزيعة درجاته
       worksheets.js   أوراق العمل المولَّدة من خطة المحاضرات
       activities.js   الأنشطة الصفّية واللاصفّية (تُحرَّر يدويًا)
       exams.js        الاختبارات الرسمية وبنوك أسئلتها
       evidences.js    ملفّ الأدلة المختصرة

   لإضافة مقرر: انسخ مجلّد مقرر قائم، وغيّر ما فيه، ثم اكتب
   معرّفه في COURSE_FILES أدناه. لا يُعدَّل أي ملف آخر في المنصة،
   ولا أي صفحة HTML.

   لماذا document.write؟ المنصة بلا أدوات بناء وتعمل من القرص
   مباشرةً (file://)، وبقية الملفات تفترض أن window.COURSE جاهزٌ
   قبلها. و document.write من سكربتٍ خارجيّ أثناء التحليل يُدرج
   السكربتات بالترتيب ويوقف التحليل حتى تُنفَّذ — وهو ما نريده
   بالضبط. والمسارات من أصل الصفحة نفسه، فلا يمسّها منعُ المتصفح
   لسكربتات المصادر الأخرى.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ═══ المقررات المحمَّلة ═══
     تُؤخذ من المستأجرة العاملة (data/tenants.js)، فلا تُحمَّل
     مقرراتُ أستاذةٍ في نشرة أخرى. وإن لم يكن سجلُّ المستأجرات
     محمَّلًا — كفتح ملفٍّ مفردٍ من القرص — رجعت إلى الافتراضي. */
  var DEFAULT_FILES = ["wilaya"];
  var t = window.TPTenant && TPTenant.active && TPTenant.active();
  var COURSE_FILES = (t && t.courses && t.courses.length) ? t.courses : DEFAULT_FILES;

  var LIST = [];
  window.TP_COURSES = LIST;

  function byId(id) {
    for (var i = 0; i < LIST.length; i++) {
      if (String(LIST[i].id) === String(id)) return LIST[i];
    }
    return null;
  }

  window.TPCourse = {
    list: LIST,
    get: byId,

    /* يُستدعى من data/courses/<id>/course.js */
    add: function (c) {
      if (!c || !c.id) throw new Error("مقرر بلا معرّف");
      if (byId(c.id)) throw new Error("معرّف مقرر مكرّر: " + c.id);
      c.sheets = [];
      c.exams = [];

      /*  مفتاح الشعبة فريدٌ على مستوى المنصة كلّها: «المقرر:الشعبة».
          هذا هو أساس الفصل بين المقررات: كل سجلّ في المنصة —
          طالبة أو حضور أو درجة أو تسليم — معلَّقٌ بمفتاح شعبة،
          فصار معلَّقًا بمقرره لزامًا. ولا يحتاج الخادم عمودًا
          جديدًا ولا سياسةً جديدة.
          و«الشعبة الأولى» في مقررين شعبتان مختلفتان، وهو الصواب:
          طالبات المقرر غير طالبات المقرر الآخر.
          والمفتاح يدلّ على مقرره، فرابط الباركود وحده يكفي لفتح
          المقرر الصحيح على جهاز الطالبة. */
      (c.sections || []).forEach(function (s) {
        if (s.no == null) s.no = s.id;
        s.id = c.id + ":" + s.no;
        s.courseId = c.id;
      });
      LIST.push(c);
      return c;
    },

    /* تُستدعى من evidences.js — ملفّ الأدلة المختصرة للمقرر */
    evidences: function (id, doc) {
      var c = byId(id);
      if (!c) throw new Error("أدلة لمقرر غير مسجَّل: " + id);
      c.evidences = doc;
      return doc;
    },

    /*  تُستدعى من exams.js — الاختبارات الرسمية للمقرر.
        معرّف الاختبار يُوسَم بمقرره كما تُوسَم الأوراق، لأن تسليمه
        يُحفظ في الجدول نفسه (submissions) بمعرّفه هذا. */
    exams: function (id, list) {
      var c = byId(id);
      if (!c) throw new Error("اختبارات لمقرر غير مسجَّل: " + id);
      (list || []).forEach(function (x) {
        if (String(x.id).indexOf(id + ":") !== 0) x.id = id + ":" + x.id;
        x.courseId = id;
      });
      c.exams = (c.exams || []).concat(list || []);
      return c.exams;
    },

    /*  تُستدعى من worksheets.js و activities.js.
        first = true تضع القائمة في المقدمة (الأنشطة قبل أوراق
        العمل، لأنها هي المحسوبة في درجة الواجبات). */
    sheets: function (id, list, first) {
      var c = byId(id);
      if (!c) throw new Error("أوراق لمقرر غير مسجَّل: " + id);
      /*  معرّف الورقة يصير فريدًا بين المقررات، فلا يلتبس تسليمٌ
          بتسليم لو تشابه الترقيم في مقررين. */
      (list || []).forEach(function (w) {
        if (String(w.id).indexOf(id + ":") !== 0) w.id = id + ":" + w.id;
        w.courseId = id;
      });
      c.sheets = first ? (list || []).concat(c.sheets) : c.sheets.concat(list || []);
      return c.sheets;
    }
  };

  /* ═══ تحميل ملفات المقررات بالترتيب ═══ */
  var here = (document.currentScript && document.currentScript.src) || "data/courses.js";
  var base = here.replace(/[^/]*$/, "");

  function load(rel) {
    document.write('<script src="' + base + rel + '"><\/script>');
  }

  /*  معرّف المقرر يُبنى منه مسارُ سكربتٍ يُكتب بـ document.write،
      وصار المعرّف يأتي من سجلّ المستأجرات لا من هذا الملف. فيُقيَّد
      بحروفٍ لاتينية صغيرة وأرقامٍ وشَرطة: لا نقطة ولا شرطة مائلة
      ولا علامة اقتباس — فلا يخرج المسار من مجلّد المقررات ولا
      ينغلق وسمُ السكربت على غيره. دفاعٌ في العمق: السجلّ ملفٌّ في
      المستودع لا مدخلُ مستخدم، لكنّ الثمن صفر. */
  var SAFE_ID = /^[a-z0-9][a-z0-9-]{0,40}$/;

  COURSE_FILES.filter(function (id) {
    if (SAFE_ID.test(id)) return true;
    if (window.console) console.warn("معرّف مقرر مرفوض: " + id);
    return false;
  }).forEach(function (id) {
    load("courses/" + id + "/course.js");
    load("courses/" + id + "/worksheets.js");
    load("courses/" + id + "/activities.js");
    load("courses/" + id + "/exams.js");
    load("courses/" + id + "/evidences.js");
  });

  /* يُنتخب المقرر العامل ويُبنى window.COURSE و window.TP */
  load("active.js");
})();
