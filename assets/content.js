/* ═══ تصحيحات النصوص — تُطبَّق فوق ملفّات المقرر ═══
   نصوص الأوراق والأنشطة تعيش في data/courses/<المقرر>/، وهي ملفات
   لا تُكتب من المتصفّح: المنصة تُقدَّم من GitHub Pages. فإن رأت
   الدكتورة خطأً مطبعيًّا في سؤال، لم يكن أمامها إلا فتح الملف.

   هذه الطبقة تجعل التصحيح ممكنًا من داخل المنصة: كل تصحيح صفٌّ في
   الخادم يُطبَّق فوق الملفّ عند العرض. والملفّ يبقى هو الأصل، وحذف
   التصحيح يُرجعه كما كان — فلا يضيع النصّ الأول أبدًا.

   العنوان:
       wilaya:h1            الورقة   → title · subtitle · intro
       wilaya:h1#h1q1       سؤالها   → prompt · why · opt0 … optN

   الاستعمال:
       TPContent.ready().then(function () { … ارسم … });
       TPContent.set(ref, field, value)      حفظ تصحيح
       TPContent.set(ref, field, "")         إرجاع الأصل
       TPContent.has(ref, field)             هل فيه تصحيح؟
       TPContent.original(ref, field)        نصّ الملفّ الأصلي
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var COURSE = window.COURSE || {};
  var SHEETS = window.WORKSHEETS || [];

  var over = {};            /* "ref|field" → value */
  var orig = {};            /* "ref|field" → نصّ الملفّ قبل أي تصحيح */
  var loaded = null;

  function key(ref, field) { return ref + "|" + field; }

  /* ─── فهرسة نصوص الملفّ الأصلية ───
     تُؤخذ نسخةٌ قبل أي تطبيق، فتبقى مرجعًا لـ«إرجاع الأصل» ولبيان
     «هذا النصّ مصحَّح» في واجهة التحرير. */
  function indexOriginals() {
    SHEETS.forEach(function (w) {
      ["title", "subtitle", "intro"].forEach(function (f) {
        if (w[f] != null) orig[key(w.id, f)] = w[f];
      });
      (w.items || []).forEach(function (it) {
        var r = w.id + "#" + it.id;
        ["prompt", "why"].forEach(function (f) {
          if (it[f] != null) orig[key(r, f)] = it[f];
        });
        (it.options || []).forEach(function (o, i) {
          orig[key(r, "opt" + i)] = o;
        });
      });
    });
  }

  /* ─── تطبيق التصحيحات على الكائنات في الذاكرة ───
     تُكتب فوق WORKSHEETS نفسه، فترى كلُّ صفحةٍ النصَّ المصحَّح بلا
     أن تعرف بوجود هذه الطبقة أصلًا. */
  function apply() {
    SHEETS.forEach(function (w) {
      ["title", "subtitle", "intro"].forEach(function (f) {
        var v = over[key(w.id, f)];
        if (v != null) w[f] = v;
        else if (orig[key(w.id, f)] != null) w[f] = orig[key(w.id, f)];
      });
      (w.items || []).forEach(function (it) {
        var r = w.id + "#" + it.id;
        ["prompt", "why"].forEach(function (f) {
          var v = over[key(r, f)];
          if (v != null) it[f] = v;
          else if (orig[key(r, f)] != null) it[f] = orig[key(r, f)];
        });
        (it.options || []).forEach(function (o, i) {
          var v = over[key(r, "opt" + i)];
          it.options[i] = v != null ? v : orig[key(r, "opt" + i)];
        });
      });
    });
  }

  function load() {
    if (loaded) return loaded;
    indexOriginals();
    loaded = Store.content(COURSE.id).then(function (rows) {
      over = {};
      (rows || []).forEach(function (r) { over[key(r.ref, r.field)] = r.value; });
      apply();
      return over;
      /*  تعذّر الجلب لا يُسقط الصفحة: تُعرض نصوص الملفّ كما هي.
          وهذا هو الصواب — الملفّ أصلٌ صالح، والتصحيح زيادة. */
    }).catch(function (e) {
      console.warn("تعذّر جلب تصحيحات النصوص — تُعرض نصوص الملفّ:", e);
      return over;
    });
    return loaded;
  }

  window.TPContent = {
    ready: load,

    has: function (ref, field) { return over[key(ref, field)] != null; },

    original: function (ref, field) { return orig[key(ref, field)]; },

    get: function (ref, field) {
      var k = key(ref, field);
      return over[k] != null ? over[k] : orig[k];
    },

    set: function (ref, field, value) {
      var k = key(ref, field);
      var v = (value == null ? "" : String(value)).trim();
      /*  المطابق للأصل تصحيحٌ بلا فائدة — يُحذف بدل أن يُخزَّن. */
      if (v === "" || v === String(orig[k] == null ? "" : orig[k]).trim()) {
        delete over[k];
        return Store.saveContent({ courseId: COURSE.id, ref: ref, field: field, value: "" })
                    .then(function () { apply(); });
      }
      over[k] = v;
      return Store.saveContent({ courseId: COURSE.id, ref: ref, field: field, value: v })
                  .then(function () { apply(); });
    },

    /* ─── قيمةٌ تُقرأ من الخادم الآن ───
       ready() تجلب مرةً واحدةً عند التحميل، وهو الصواب للتصحيحات:
       فنصُّ السؤال لا يتبدّل والصفحة مفتوحة.

       أما كشفُ جواب سؤال المحاضرة فيتبدّل في أثناء الدرس: تكشفه
       الدكتورة على شاشتها، فيلزم أن يبلغ أجهزة الطالبات وهنّ ينظرن.
       فهذه تسأل عن عنوانٍ واحدٍ بعينه لا عن الطبقة كلِّها.

       وتُمحى صفوفُ ذلك العنوان قبل وضع الراجع، فالمحذوف في الخادم
       يُمحى ههنا — ولولاه لبقي الكشفُ ظاهرًا بعد طيِّه. */
    fresh: function (ref, field) {
      return Store.content(COURSE.id, ref).then(function (rows) {
        var head = ref + "|";
        Object.keys(over).forEach(function (k) {
          if (k.slice(0, head.length) === head) delete over[k];
        });
        (rows || []).forEach(function (r) { over[key(r.ref, r.field)] = r.value; });
        apply();
        return window.TPContent.get(ref, field);
      });
    },

    /* كم تصحيحًا في هذا المقرر — لصفحة الفحص */
    count: function () { return Object.keys(over).length; },

    /* ─── نافذة التسليم ───
       موعدا الفتح والإغلاق يُخزَّنان كبقية التصحيحات: صفٌّ في
       content بحقل opensAt أو dueAt. والحراسة في الخادم — في
       stamp_submission — لا هنا: ما يُحرَس في المتصفّح يُتخطّى
       بطلبٍ واحد مباشر. وما هنا بيانٌ للطالبة لا حاجز. */
    window: function (ref) {
      return {
        opens: over[key(ref, "opensAt")] || null,
        due:   over[key(ref, "dueAt")]   || null
      };
    },

    /* هل التسليم مفتوحٌ الآن بحسب الساعة المحلية؟ */
    isOpen: function (ref) {
      var w = window.TPContent.window(ref);
      var now = Date.now();
      if (w.opens && now < Date.parse(w.opens)) return "soon";
      if (w.due && now > Date.parse(w.due)) return "closed";
      return "open";
    },

    setWindow: function (ref, field, iso) {
      return window.TPContent.set(ref, field, iso || "");
    }
  };
})();
