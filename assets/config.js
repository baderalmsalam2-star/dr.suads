/*  إعدادات الخادم — تُشتقّ من المستأجرة العاملة في data/tenants.js.
    لكل أستاذةٍ مشروع Supabase خاصّ بها، فلا يُكتب هنا عنوانٌ ثابت.
    وبلا مستأجرةٍ أو بلا عنوانٍ لها تبقى المنصة محليةً على الجهاز،
    وهو ما يجعلها تعمل من file:// ومن غير شبكةٍ أصلًا. */
window.TP_CONFIG = (function () {
  var t = window.TPTenant && TPTenant.active && TPTenant.active();
  var sb = (t && t.supabase) || {};
  return { url: sb.url || "", anonKey: sb.anonKey || "" };
})();
