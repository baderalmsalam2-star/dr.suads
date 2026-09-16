/* ═══════════════════════════════════════════════════════════════
   إعداد الخادم.

   اتركيه فارغًا فتعمل المنصة محليًا على هذا الجهاز وحده (كما هي
   الآن). واملئيه بعد إنشاء مشروع Supabase فتنتقل البيانات إلى
   الخادم وتتزامن بين الأجهزة.

   الحقلان أدناه ليسا سرًّا: مفتاح anon معدٌّ لأن يُنشر في صفحات
   الويب، وحمايةُ البيانات كلُّها في قواعد الصلاحيات داخل قاعدة
   البيانات (supabase/schema.sql) لا في إخفاء المفتاح.

   الخطوات كاملة في: supabase/الإعداد.md
   ═══════════════════════════════════════════════════════════════ */
window.TP_CONFIG = {
  url: "https://kmebjzwcqvevycpreebp.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
           "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttZWJqendjcXZldnljcHJlZWJwIiwi" +
           "cm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NzE4NjEsImV4cCI6MjEwNTE0Nzg2MX0." +
           "-XheRxv983OYVKarXtFyO77DWdwKC0QTIVjW2iAkwMQ"
};
