/* ═══════════════════════════════════════════════════════════════
   سجلّ المستأجرات — نشرةٌ واحدة تخدم أكثر من أستاذة.

   لكل أستاذةٍ مشروع Supabase خاصّ بها، وبياناتُ طالباتها لا تسكن
   قاعدةً مشتركة. فالعزل ليس سياسةً تُكتب في SQL ثم تُختبر، بل هو
   حدُّ القاعدة نفسها: لا استعلامَ يعبر من قاعدةٍ إلى أخرى مهما
   أخطأت السياسات.

   وهذا هو الفرق بين هذه النشرة وبين SaaS متعدّد المستأجرين في
   قاعدةٍ واحدة: هناك ثمانية عشر موضعًا في schema.sql تقول
   «using (is_owner())» — أي «من كان مالكًا رأى كل شيء». تصحيحها
   إلى «مالك هذه المؤسسة» عملٌ قائمٌ بنفسه، وخطؤه يكشف طالبات
   أستاذةٍ لأخرى. وهنا لا يُحتاج إليه أصلًا.

   ─── المفتاح العلنيّ ───
   anonKey مكشوفٌ بالقصد، كما هو في كل تطبيق Supabase: هو عنوانُ
   الباب لا مفتاحُه. والذي يحرس البيانات هو Row Level Security في
   القاعدة، لا خفاءُ المفتاح. فوجودُه في ملفٍّ علنيّ لا يفتح شيئًا
   لم يكن مفتوحًا.
   وما يُعلَن حقًّا هنا: أسماءُ الأستاذات المشتركات وعناوين
   مشاريعهنّ. فإن أرادت إحداهنّ ألا تُذكر، فمكانها نشرةٌ خاصة.

   ─── إضافة أستاذة ───
   افتح tenant.html، أدخل عنوان مشروعها ومفتاحه، افحص الاتصال
   والجداول، ثم انسخ المدخل الذي يخرجه وألصقه في LIST أدناه.

   ─── انتخاب المستأجرة ───
     ١) ?t=<المعرّف> في الرابط — وهو ما يوضع في روابط الطالبات
     ٢) آخر مستأجرةٍ فُتحت على هذا الجهاز
     ٣) الوحيدة، إن لم يكن في السجلّ غيرها
   ═══════════════════════════════════════════════════════════════ */
window.TPTenant = (function () {
  "use strict";

  var LIST = [
    {
      id: "suad",
      name: "د. سعاد المطوع",
      org: "كلية الشريعة والدراسات الإسلامية · جامعة الكويت",
      /* معرّفات المقررات التي تُحمَّل لها من data/courses/ */
      courses: ["wilaya"],
      /* يُملأ من tenant.html بعد لصق supabase/schema.sql في مشروعها */
      supabase: { url: "", anonKey: "" }
    }
  ];

  var LS = "tp.tenant";

  function get(id) {
    for (var i = 0; i < LIST.length; i++) {
      if (String(LIST[i].id) === String(id)) return LIST[i];
    }
    return null;
  }

  function stored() { try { return localStorage.getItem(LS); } catch (e) { return null; } }
  function keep(v) { try { localStorage.setItem(LS, String(v)); } catch (e) { /* تصفّح خاص */ } }

  function resolve() {
    var asked = null;
    try { asked = new URLSearchParams(location.search).get("t"); } catch (e) { /* رابطٌ غريب */ }
    /*  الرابط يعلو على الذاكرة: فلو فتحت الطالبة رابط أستاذةٍ أخرى
        على الجهاز نفسه، فُتح لها الصحيح لا آخرُ ما زاره صاحبُ الجهاز. */
    return get(asked) || get(stored()) || (LIST.length === 1 ? LIST[0] : null);
  }

  var ACTIVE = resolve();
  if (ACTIVE) keep(ACTIVE.id);

  return {
    /*  الدالّة لا القيمة: config.js و courses.js يُحمَّلان في
        لحظتين، وقد يُبدَّل الاختيار بينهما في صفحة الاختيار. */
    active: function () { return ACTIVE; },
    all: function () { return LIST.slice(); },
    get: get,
    /*  التبديل يُعيد تحميل الصفحة: المقررات والمحوِّل كلاهما
        يُبنى مرةً واحدة عند التحليل، فلا يُبدَّلان في مكانهما. */
    use: function (id) {
      var t = get(id);
      if (!t) return false;
      keep(t.id);
      var u = new URL(location.href);
      u.searchParams.set("t", t.id);
      location.href = u.toString();
      return true;
    }
  };
})();
