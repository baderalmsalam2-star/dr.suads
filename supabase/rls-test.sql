-- ═══════════════════════════════════════════════════════════════
--  اختبار قواعد الصلاحيات
--
--  يثبت أن الطالبة لا ترى ولا تعدّل إلا ما يخصها.
--  يُشغَّل على قاعدة اختبار لا على قاعدة الفصل — فهو يُدخل بيانات وهمية.
--
--      psql -d <قاعدة الاختبار> -f supabase/schema.sql -f supabase/rls-test.sql
--
--  المتوقّع: كل سطر «✓» و«فشل = 0». أي «✗» يعني ثغرة.
-- ═══════════════════════════════════════════════════════════════
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
/* Supabase يمنح authenticated وصولًا إلى storage وحارسه RLS —
   يُحاكى هنا ليُختبر قفل ملفات التسليم */
grant usage on schema storage to anon, authenticated;
grant all on all tables in schema storage to anon, authenticated;

drop table if exists rls_results;
create table rls_results (label text, ok boolean);
grant all on rls_results to anon, authenticated;

insert into auth.users(id,email) values
 ('11111111-1111-1111-1111-111111111111','owner@test'),
 ('22222222-2222-2222-2222-222222222222','sara@test'),
 ('33333333-3333-3333-3333-333333333333','noura@test') on conflict do nothing;
insert into owners(uid,label,role) values
 ('11111111-1111-1111-1111-111111111111','مالكة الاختبار','teacher') on conflict do nothing;
insert into students(id,section_id,no,name,uid,auth_uid) values
 ('t-sara','wilaya:9',1,'سارة','900001','22222222-2222-2222-2222-222222222222'),
 ('t-noura','wilaya:9',2,'نورة','900002','33333333-3333-3333-3333-333333333333'),
 ('t-free','wilaya:9',3,'هيا','900003',null) on conflict do nothing;
insert into events(id,student_id,section_id,kind,points,day) values
 ('t-ev1','t-sara','wilaya:9','read',2,'2026-01-01'),
 ('t-ev2','t-noura','wilaya:9','read',2,'2026-01-01') on conflict do nothing;
insert into attendance(id,student_id,section_id,session,status,day) values
 ('t-at1','t-sara','wilaya:9',1,'absent','2026-01-01'),
 ('t-at2','t-noura','wilaya:9',1,'absent','2026-01-01') on conflict do nothing;
insert into submissions(id,student_id,worksheet_id,status) values
 ('t-sub1','t-sara','w9','submitted'),
 ('t-sub2','t-noura','w9','draft') on conflict do nothing;

\set OWNER '11111111-1111-1111-1111-111111111111'
\set SARA  '22222222-2222-2222-2222-222222222222'
\set NOURA '33333333-3333-3333-3333-333333333333'

-- ── ما يراه كلٌّ ──
begin; set local role anon;
insert into rls_results select 'بلا حساب لا يرى شيئًا', (select count(*) from students)=0;
commit;

begin; set local role authenticated; set local request.jwt.claim.sub = :'OWNER';
insert into rls_results select 'المالكة ترى الطالبات الثلاث', (select count(*) from students where section_id='wilaya:9')=3;
commit;

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into rls_results select 'الطالبة ترى صفّها وحده',      (select count(*) from students)=1;
insert into rls_results select 'لا ترى حضور غيرها',            (select count(*) from attendance)=1;
insert into rls_results select 'لا ترى نقاط غيرها',            (select count(*) from events)=1;
insert into rls_results select 'لا ترى تسليم غيرها',           (select count(*) from submissions)=1;
insert into rls_results select 'لا ترى جدول المالكات',         (select count(*) from owners)=0;
commit;

-- ── ما تُمنع منه (الصفر المتأثر هو الدليل) ──
begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
with u as (update students set name='مخترَق' where id='t-noura' returning 1)
  insert into rls_results select 'لا تغيّر اسم زميلتها', count(*)=0 from u;
commit;

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
with u as (update students set auth_uid=:'SARA' where id='t-free' returning 1)
  insert into rls_results select 'لا تستولي على صفّ غير مربوط', count(*)=0 from u;
commit;

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
with d as (delete from students where id='t-noura' returning 1)
  insert into rls_results select 'لا تحذف زميلتها', count(*)=0 from d;
commit;

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
with u as (update attendance set status='present' where id='t-at1' returning 1)
  insert into rls_results select 'لا تحوّل غيابها إلى حضور', count(*)=0 from u;
commit;

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
with d as (delete from attendance where id='t-at1' returning 1)
  insert into rls_results select 'لا تحذف سجل غيابها', count(*)=0 from d;
commit;

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
with u as (update submissions set answers='{"x":1}' where id='t-sub1' returning 1)
  insert into rls_results select 'لا تعدّل تسليمها المقفل', count(*)=0 from u;
commit;

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
with u as (update submissions set answers='{"x":1}' where id='t-sub2' returning 1)
  insert into rls_results select 'لا تعدّل تسليم زميلتها', count(*)=0 from u;
commit;

-- ── ما يُرفض بخطأ صريح ──
do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
    insert into events(id,student_id,section_id,kind,points,day)
      values ('t-cheat','t-sara','wilaya:9','answer',999,'2026-01-01');
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا ترصد نقاطًا لنفسها', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا ترصد نقاطًا لنفسها', true);
  end;
end $$;

do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
    insert into owners(uid,label) values ('22222222-2222-2222-2222-222222222222','مخترِقة');
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا تنصّب نفسها مالكة', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا تنصّب نفسها مالكة', true);
  end;
end $$;

do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
    insert into submissions(id,student_id,worksheet_id,status) values ('t-x','t-noura','w8','draft');
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا تُنشئ تسليمًا باسم زميلتها', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا تُنشئ تسليمًا باسم زميلتها', true);
  end;
end $$;

-- ── ما يجب أن يُسمح ──
begin; set local role authenticated; set local request.jwt.claim.sub = :'NOURA';
with u as (update submissions set answers='{"q1":1}' where id='t-sub2' returning 1)
  insert into rls_results select 'تعدّل مسودتها هي', count(*)=1 from u;
commit;

-- ── الربط التلقائي بحساب الجامعة ──
-- ترتيب أ: الكشف أولًا ثم دخول الطالبة
insert into students(id,section_id,no,name,uid) values ('t-auto1','wilaya:9',4,'منيرة','2200000001');
insert into auth.users(id,email) values ('44444444-4444-4444-4444-444444444444','S2200000001@KU.EDU.KW');
insert into rls_results select 'الكشف أولًا ثم الدخول ⇒ ارتبط',
  (select auth_uid from students where id='t-auto1')='44444444-4444-4444-4444-444444444444';

-- ترتيب ب: دخول الطالبة أولًا ثم إضافتها للكشف
insert into auth.users(id,email) values ('55555555-5555-5555-5555-555555555555','s2202149999@ku.edu.kw');
insert into students(id,section_id,no,name,uid) values ('t-auto2','wilaya:9',5,'دلال','2202149999');
insert into rls_results select 'الدخول أولًا ثم الكشف ⇒ ارتبط',
  (select auth_uid from students where id='t-auto2')='55555555-5555-5555-5555-555555555555';

-- الربط لا يعرف من أي طريق دخلت: رابط البريد يربط كما يربط أزور
-- (هذا ما يجعل تسجيل التطبيق في أزور اختياريًا لا شرطًا)
insert into students(id,section_id,no,name,uid) values ('t-mail','wilaya:9',7,'نوره','2202148888');
insert into auth.users(id,email) values ('aaaaaaaa-0000-0000-0000-000000000001','s2202148888@ku.edu.kw');
insert into rls_results select 'رابط البريد يربط أيضًا — بلا أزور',
  (select auth_uid from students where id='t-mail')='aaaaaaaa-0000-0000-0000-000000000001';

-- بريد الدكتورة مبنيّ على الاسم، فلا يُربط بأي صفّ
insert into auth.users(id,email) values ('66666666-6666-6666-6666-666666666666','name.family@ku.edu.kw');
insert into rls_results select 'بريد الدكتورة لا يُربط بصفّ',
  not exists (select 1 from students where auth_uid='66666666-6666-6666-6666-666666666666');

-- رقم ليس في الكشف: يمرّ بلا ربط ولا خطأ
insert into auth.users(id,email) values ('77777777-7777-7777-7777-777777777777','s2202100000@ku.edu.kw');
insert into rls_results select 'رقم خارج الكشف يمرّ بلا ربط',
  not exists (select 1 from students where auth_uid='77777777-7777-7777-7777-777777777777');

-- حساب ثانٍ بالرقم نفسه لا ينتزع صفًّا مربوطًا
insert into auth.users(id,email) values ('88888888-8888-8888-8888-888888888888','s2200000001@ku.edu.kw');
insert into rls_results select 'حساب ثانٍ لا ينتزع صفًّا مربوطًا',
  (select auth_uid from students where id='t-auto1')='44444444-4444-4444-4444-444444444444';

-- بريد من نطاق آخر يحاكي الصيغة: لا يُربط
insert into students(id,section_id,no,name,uid) values ('t-auto3','wilaya:9',6,'شهد','2202147777');
insert into auth.users(id,email) values ('99999999-9999-9999-9999-999999999999','s2202147777@gmail.com');
insert into rls_results select 'نطاق غير الجامعة لا يُربط',
  (select auth_uid from students where id='t-auto3') is null;

-- الطالبة المرتبطة ترى صفّها فعلًا تحت قواعد الحماية
begin; set local role authenticated; set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
insert into rls_results select 'المرتبطة تلقائيًا ترى صفّها وحده',
  (select count(*) from students)=1 and (select id from students)='t-auto1';
commit;

-- ── الدرجات والتوزيعة ──
insert into grades(id,student_id,section_id,item_id,score) values
 ('t-g1','t-sara','wilaya:9','exam1',18),
 ('t-g2','t-noura','wilaya:9','exam1',12) on conflict do nothing;
insert into scheme(section_id,data) values ('wilaya:9','{"confirmed":true}') on conflict do nothing;

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into rls_results select 'ترى درجتها هي وحدها', (select count(*) from grades)=1;
insert into rls_results select 'الدرجة التي تراها درجتها',
  (select item_id||':'||score from grades)='exam1:18';
insert into rls_results select 'ترى التوزيعة التي تُقيَّم بها', (select count(*) from scheme)=1;
commit;

begin; set local role anon;
insert into rls_results select 'بلا حساب لا يرى درجات', (select count(*) from grades)=0;
insert into rls_results select 'بلا حساب لا يرى التوزيعة', (select count(*) from scheme)=0;
commit;

do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
    update grades set score = 20 where id='t-g1';
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا ترفع درجتها بنفسها', (select score from grades where id='t-g1')=18);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا ترفع درجتها بنفسها', true);
  end;
end $$;

do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
    update scheme set data='{"confirmed":false}' where section_id='wilaya:9';
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا تعدّل توزيعة الدرجات',
      (select data->>'confirmed' from scheme where section_id='wilaya:9')='true');
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا تعدّل توزيعة الدرجات', true);
  end;
end $$;

do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
    insert into grades(id,student_id,section_id,item_id,score)
      values ('t-gx','t-sara','wilaya:9','final',40);
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا ترصد لنفسها درجة', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا ترصد لنفسها درجة', true);
  end;
end $$;

begin; set local role authenticated; set local request.jwt.claim.sub = :'OWNER';
insert into rls_results select 'المالكة ترى درجات الجميع', (select count(*) from grades)=2;
commit;

-- ── دورا المالكات: مدرِّسة ومشرف ──
insert into auth.users(id,email) values
 ('bbbbbbbb-0000-0000-0000-000000000001','admin@test') on conflict do nothing;
insert into owners(uid,label,role) values
 ('bbbbbbbb-0000-0000-0000-000000000001','المشرف التقني','admin') on conflict do nothing;

begin; set local role authenticated; set local request.jwt.claim.sub = :'OWNER';
insert into rls_results select 'الدكتورة ليست مشرفًا', is_admin() = false;
insert into rls_results select 'الدكتورة مالكة',       is_owner() = true;
commit;

begin; set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
insert into rls_results select 'المشرف مشرف',              is_admin() = true;
insert into rls_results select 'المشرف مالك أيضًا',         is_owner() = true;
insert into rls_results select 'المشرف يرى الطالبات كلهن', (select count(*) from students where section_id='wilaya:9')>=3;
commit;

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into rls_results select 'الطالبة ليست مشرفًا', is_admin() = false;
commit;

-- الطالبة لا تُنصّب نفسها مشرفًا
do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
    insert into owners(uid,label,role)
      values ('22222222-2222-2222-2222-222222222222','أنا','admin');
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا تنصّب نفسها مشرفًا', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا تنصّب نفسها مشرفًا', true);
  end;
end $$;

-- ودورٌ ثالث لا يُقبل أصلًا
do $$
begin
  begin
    insert into auth.users(id,email) values ('cccccccc-0000-0000-0000-000000000001','x@test');
    insert into owners(uid,label,role) values ('cccccccc-0000-0000-0000-000000000001','س','root');
    insert into rls_results values ('لا يُقبل دور خارج الاثنين', false);
  exception when others then
    insert into rls_results values ('لا يُقبل دور خارج الاثنين', true);
  end;
end $$;

-- ── ما كشفه الفحص ──
-- الطالبة لا تولد تسليمًا مقفلًا (فتنال درجة الواجبات بلا حلّ)
do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
    insert into submissions(id,student_id,worksheet_id,status)
      values ('t-cheat','t-sara','w5','submitted');
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا تولد تسليمًا مقفلًا', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا تولد تسليمًا مقفلًا', true);
  end;
end $$;

-- لكنها تولد مسودة ثم تسلّمها
begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into submissions(id,student_id,worksheet_id,status,answers)
  values ('t-ok','t-sara','w5','draft','{"q":1}');
with u as (update submissions set status='submitted' where id='t-ok' returning 1)
  insert into rls_results select 'تسلّم مسودتها هي', count(*)=1 from u;
commit;

-- ووقت التسليم يُختم في الخادم لا يُرسَل من المتصفّح
insert into rls_results select 'وقت التسليم مختوم من الخادم',
  (select submitted_at is not null and submitted_at > now() - interval '1 minute'
     from submissions where id='t-ok');

-- ولا تُرجع المقفل إلى مسودة.
-- سياسة using ترشّح الصفّ فلا يقع تحديث ولا يُرفع استثناء — فالفحص
-- على الحالة بعدها لا على وقوع خطأ.
begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
update submissions set status='draft' where id='t-ok';
commit;
insert into rls_results select 'لا تُرجع المقفل إلى مسودة',
  (select status from submissions where id='t-ok')='submitted';

-- تصحيح الرقم الجامعي يفكّ الربط الخاطئ
insert into auth.users(id,email) values
 ('dddddddd-0000-0000-0000-000000000001','s2202140001@ku.edu.kw') on conflict do nothing;
insert into students(id,section_id,no,name,uid) values ('t-mix','wilaya:9',8,'نورة','2202140001');
insert into rls_results select 'ارتبط بالرقم الخطأ أولًا',
  (select auth_uid from students where id='t-mix')='dddddddd-0000-0000-0000-000000000001';
update students set uid='2202140002' where id='t-mix';
insert into rls_results select 'تصحيح الرقم يفكّ الربط الخاطئ',
  (select auth_uid from students where id='t-mix') is null;

-- ── صفّان بالرقم نفسه لا يمنعان إنشاء الحساب ──
insert into students(id,section_id,no,name,uid) values
 ('t-dup1','wilaya:9',20,'منيرة','2202149111'),
 ('t-dup2','wilaya:9',21,'منيرة','2202149111');
insert into auth.users(id,email) values
 ('eeeeeeee-0000-0000-0000-000000000001','s2202149111@ku.edu.kw');
insert into rls_results select 'رقم مكرّر لا يمنع إنشاء الحساب',
  exists (select 1 from auth.users where id='eeeeeeee-0000-0000-0000-000000000001');
insert into rls_results select 'ويُربط صفٌّ واحد لا صفّان',
  (select count(*) from students where auth_uid='eeeeeeee-0000-0000-0000-000000000001')=1;

-- ── الملف المشار إليه من تسليمٍ مقفل لا يُحذف ولا يُستبدل ──
insert into storage.objects(bucket_id,name) values ('tp-files','t-sara/f-locked');
update submissions set files = '{"i1":[{"fileId":"t-sara/f-locked"}]}'::jsonb
 where id='t-sub1';
insert into rls_results select 'الملف المقفل معروفٌ بأنه مقفل', locked_file('t-sara/f-locked');
insert into rls_results select 'وملفٌ حرّ ليس مقفلًا', not locked_file('t-sara/f-free');

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
delete from storage.objects where name='t-sara/f-locked';
commit;
insert into rls_results select 'لا تحذف ملف تسليمها المقفل',
  exists (select 1 from storage.objects where name='t-sara/f-locked');

-- ── حسابٌ مصادَق غير مرتبط بصفٍّ لا يرى شيئًا ──
insert into auth.users(id,email) values
 ('ffffffff-0000-0000-0000-000000000001','stranger@gmail.com') on conflict do nothing;
insert into schedule(section_id,session,day) values ('wilaya:9',1,'2026-09-17') on conflict do nothing;

begin; set local role authenticated;
set local request.jwt.claim.sub = 'ffffffff-0000-0000-0000-000000000001';
insert into rls_results select 'غريبٌ بحساب لا يرى التوزيعة',  (select count(*) from scheme)=0;
insert into rls_results select 'ولا يرى جدول المحاضرات',           (select count(*) from schedule)=0;
insert into rls_results select 'ولا يرى الطالبات',             (select count(*) from students)=0;
commit;

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into rls_results select 'وطالبة الشعبة ترى جدول شعبتها', (select count(*) from schedule)=1;
commit;

-- ── التسجيل بالباركود ──
grant execute on function join_class(text,text,text) to anon;
insert into students(id,section_id,no,name,uid,placeholder) values
 ('j-ph','wilaya:7',1,'طالبة ١ · نموذج','0000000001',true) on conflict do nothing;

begin; set local role anon;
insert into rls_results select 'بلا حساب تسجّل نفسها بالباركود',
  join_class('wilaya:7','نوره فهد عبدالهادي تركي','2202147001') = 'j-ph';
commit;

insert into rls_results select 'تملأ صفًّا نموذجيًّا لا تُنشئ صفًّا جديدًا',
  (select count(*) from students where section_id='wilaya:7')=1;
insert into rls_results select 'والصفّ لم يعد نموذجيًّا',
  (select not placeholder from students where id='j-ph');

begin; set local role anon;
insert into rls_results select 'إعادة التسجيل تُحدّث ولا تُكرّر',
  join_class('wilaya:7','نوره فهد تركي','2202147001') = 'j-ph';
commit;
insert into rls_results select 'ولا يزال صفًّا واحدًا',
  (select count(*) from students where section_id='wilaya:7')=1;

-- ولا تقرأ الكشف. على Supabase يملك anon صلاحية الجدول وحارسه RLS،
-- فالصواب أن يرى صفرًا من الصفوف لا أن يُرفض الاستعلام.
begin; set local role anon;
insert into rls_results select 'التسجيل لا يفتح قراءة الكشف',
  (select count(*) from students)=0;
commit;

-- ولا تكتب في الجدول مباشرةً
do $$
begin
  begin
    perform set_config('role','anon',true);
    insert into students(id,section_id,no,name,uid) values ('j-hack','wilaya:7',9,'دخيلة','9999999999');
    perform set_config('role','postgres',true);
    insert into rls_results values ('ولا تكتب في الجدول مباشرةً', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('ولا تكتب في الجدول مباشرةً', true);
  end;
end $$;

-- رقمٌ مربوط بحساب لا يُنتحَل
insert into auth.users(id,email) values
 ('aaaaaaaa-7777-0000-0000-000000000001','s2202147001@ku.edu.kw') on conflict do nothing;
update students set auth_uid='aaaaaaaa-7777-0000-0000-000000000001' where id='j-ph';
do $$
begin
  begin
    perform set_config('role','anon',true);
    perform join_class('wilaya:7','اسم مسروق','2202147001');
    perform set_config('role','postgres',true);
    insert into rls_results values ('رقمٌ مربوط بحساب لا يُنتحَل', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('رقمٌ مربوط بحساب لا يُنتحَل', true);
  end;
end $$;
insert into rls_results select 'ولم يُنشَأ له صفٌّ ثانٍ',
  (select count(*) from students where uid='2202147001')=1;

-- مدخلات غير صالحة تُرفض
do $$
begin
  begin
    perform set_config('role','anon',true);
    perform join_class('wilaya:7','اسم صحيح','abc');
    perform set_config('role','postgres',true);
    insert into rls_results values ('رقم غير رقميّ يُرفض', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('رقم غير رقميّ يُرفض', true);
  end;
end $$;

do $$
begin
  begin
    perform set_config('role','anon',true);
    perform join_class('wilaya:7','أ','2202147999');
    perform set_config('role','postgres',true);
    insert into rls_results values ('اسم أقصر من ثلاثة أحرف يُرفض', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('اسم أقصر من ثلاثة أحرف يُرفض', true);
  end;
end $$;

-- ═══════════════════════════════════════════════════════════════
--  تعدّد المقررات
--
--  الطالبة الواحدة تدرس أكثر من مقرر وحسابها واحد، وكشف كل مقرر
--  مستقلّ. فالمطلوب إثبات أمرين معًا:
--    • أنها ترى صفوفها كلها — لا صفًّا واحدًا فتُحجب عنها بقية
--      مقرراتها؛
--    • وأنها لا ترى من غيرها شيئًا في أيٍّ منها.
-- ═══════════════════════════════════════════════════════════════

-- سارة في مقرر ثانٍ، ونورة معها فيه
insert into students(id,section_id,no,name,uid,auth_uid) values
 ('m-sara','mirath:1',1,'سارة','900001',:'SARA'),
 ('m-noura','mirath:1',2,'نورة','900002',:'NOURA');
insert into attendance(id,student_id,section_id,session,status,day) values
 ('m-at1','m-sara','mirath:1',1,'present','2026-01-02'),
 ('m-at2','m-noura','mirath:1',1,'absent','2026-01-02');
insert into grades(id,student_id,section_id,item_id,score) values
 ('m-g1','m-sara','mirath:1','exam1',15),
 ('m-g2','m-noura','mirath:1','exam1',9);
insert into scheme(section_id,data) values ('mirath:1','{"confirmed":false}');
insert into schedule(section_id,session,day) values ('mirath:1',1,'2026-09-20');

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into rls_results select 'ترى صفّها في المقررين',      (select count(*) from students)=2;
insert into rls_results select 'ترى حضورها في المقررين',      (select count(*) from attendance)=2;
insert into rls_results select 'ترى درجاتها في المقررين',     (select count(*) from grades)=2;
insert into rls_results select 'ترى توزيعتي المقررين',        (select count(*) from scheme)=2;
insert into rls_results select 'ترى جدولي المقررين',          (select count(*) from schedule)=2;
insert into rls_results select 'ولا ترى صفّ زميلتها في الثاني',
  not exists (select 1 from students where id='m-noura');
insert into rls_results select 'ولا حضور زميلتها في الثاني',
  not exists (select 1 from attendance where id='m-at2');
insert into rls_results select 'ولا درجة زميلتها في الثاني',
  not exists (select 1 from grades where id='m-g2');
commit;

-- ولا تعدّل صفّ زميلتها في المقرر الثاني
begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
with u as (update students set name='مخترَق' where id='m-noura' returning 1)
  insert into rls_results select 'لا تغيّر اسم زميلتها في الثاني', count(*)=0 from u;
commit;

-- كشف المقرر الأول لا يتأثر بالثاني
insert into rls_results select 'كشف المقرر الأول لم يتغيّر',
  (select count(*) from students where section_id='wilaya:9')>=3;

-- ── صفّان لحسابٍ واحد في شعبةٍ واحدة مرفوضان ──
do $$
begin
  begin
    insert into students(id,section_id,no,name,uid,auth_uid)
      values ('m-twice','mirath:1',9,'سارة مكرّرة','900001',
              '22222222-2222-2222-2222-222222222222');
    insert into rls_results values ('صفّان لحساب واحد في شعبة واحدة مرفوضان', false);
  exception when unique_violation then
    insert into rls_results values ('صفّان لحساب واحد في شعبة واحدة مرفوضان', true);
  end;
end $$;

-- ── الربط التلقائي يربط صفوف كل المقررات ──
--  ترتيب أ: كشفا المقررين أولًا، ثم أول دخول للطالبة
insert into students(id,section_id,no,name,uid) values
 ('x-a1','wilaya:9',30,'هند','2202145555'),
 ('x-a2','mirath:1',30,'هند','2202145555');
insert into auth.users(id,email) values
 ('a1a1a1a1-0000-0000-0000-000000000001','s2202145555@ku.edu.kw');
insert into rls_results select 'أول دخول يربط صفوف المقررين معًا',
  (select count(*) from students
    where auth_uid='a1a1a1a1-0000-0000-0000-000000000001')=2;

--  ترتيب ب: دخلت ولها صفٌّ في مقرر، ثم أُضيفت إلى مقرر ثانٍ
insert into students(id,section_id,no,name,uid) values ('x-b2','mirath:1',31,'ريم','2202146666');
insert into auth.users(id,email) values
 ('b1b1b1b1-0000-0000-0000-000000000001','s2202146666@ku.edu.kw');
insert into students(id,section_id,no,name,uid) values ('x-b1','wilaya:9',31,'ريم','2202146666');
insert into rls_results select 'إضافتها لمقرر ثانٍ لاحقًا تربط صفّها',
  (select auth_uid from students where id='x-b1')='b1b1b1b1-0000-0000-0000-000000000001';
insert into rls_results select 'وصفّها الأول باقٍ على ربطه',
  (select auth_uid from students where id='x-b2')='b1b1b1b1-0000-0000-0000-000000000001';

-- ── التسجيل بالباركود مقصورٌ على شعبة مقرره ──
insert into students(id,section_id,no,name,uid,placeholder) values
 ('k-ph','mirath:7',1,'طالبة ١ · نموذج','0000000001',true);
begin; set local role anon;
insert into rls_results select 'الباركود يسجّل في شعبة مقرره',
  join_class('mirath:7','عائشة سالم المطيري','2202147777') = 'k-ph';
commit;
insert into rls_results select 'ولم يمسّ شعبة المقرر الآخر',
  (select count(*) from students where section_id='wilaya:7')=1;

-- ── ترقية سجلات ما قبل تعدّد المقررات ──
--  صفٌّ بمفتاح قديم بلا مقرر، تُعاد الترقية عليه مرتين فلا يتشوّه
insert into students(id,section_id,no,name,uid) values ('old-1','5',1,'قديمة','2202140099');
insert into submissions(id,student_id,worksheet_id,status) values ('old-s','old-1','w3','draft');
do $$
declare t text;
begin
  for i in 1..2 loop                      /* مرتان: الترقية لا تُكرَّر */
    foreach t in array array['students','events','attendance','grades','schedule','scheme'] loop
      execute format(
        'update %I set section_id = ''wilaya:'' || section_id where position('':'' in section_id) = 0', t);
    end loop;
    update submissions set worksheet_id = 'wilaya:' || worksheet_id
     where position(':' in worksheet_id) = 0;
  end loop;
end $$;
insert into rls_results select 'الترقية تنسب المفتاح القديم إلى الولاية',
  (select section_id from students where id='old-1')='wilaya:5';
insert into rls_results select 'وتشغيلها مرتين لا يضاعف البادئة',
  (select worksheet_id from submissions where id='old-s')='wilaya:w3';

-- ═══════════════════════════════════════════════════════════════
--  رمز الحضور الدوّار
--
--  المطلوب إثباته: أن الطالبة لا تبلغ الرمز إلا من الشاشة، وأنها
--  لا تسجّل به إلا حضورَ نفسها في محاضرته هو.
-- ═══════════════════════════════════════════════════════════════
insert into schedule(section_id,session,day) values ('wilaya:9',4,'2026-10-06')
  on conflict do nothing;
insert into attend_codes(section_id,session,nonce,ttl_sec)
 values ('wilaya:9',4,'LIVE-CODE-1',25);

-- الطالبة لا ترى جدول الرموز — ولو رأته لأخذت الرمز من بيتها
begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into rls_results select 'الطالبة لا ترى جدول الرموز', (select count(*) from attend_codes)=0;
commit;
begin; set local role anon;
insert into rls_results select 'وبلا حساب كذلك', (select count(*) from attend_codes)=0;
commit;

-- ولا تكتب فيه رمزًا من عندها
do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
    insert into attend_codes(section_id,session,nonce) values ('wilaya:9',4,'MINE');
    perform set_config('role','postgres',true);
    insert into rls_results values ('ولا تكتب فيه رمزًا من عندها', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('ولا تكتب فيه رمزًا من عندها', true);
  end;
end $$;

-- بالرمز الحيّ تسجّل حضورها هي
begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into rls_results select 'بالرمز الحيّ تسجّل حضورها', mark_attendance('LIVE-CODE-1')='t-sara';
commit;
insert into rls_results select 'وحضورها «حاضرة» في محاضرة الرمز',
  (select status from attendance where student_id='t-sara' and session=4)='present';
insert into rls_results select 'وبتاريخ المحاضرة من الجدول',
  (select day from attendance where student_id='t-sara' and session=4)='2026-10-06';
insert into rls_results select 'ولم تسجّل لغيرها',
  not exists (select 1 from attendance where student_id='t-noura' and session=4);

-- ومسحه مرتين لا يُكرّر السجل
begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
select mark_attendance('LIVE-CODE-1');
commit;
insert into rls_results select 'ومسحه مرتين لا يُكرّر السجل',
  (select count(*) from attendance where student_id='t-sara' and session=4)=1;

-- رمزٌ مضت مدّته يُرفض
insert into attend_codes(section_id,session,nonce,issued_at,ttl_sec)
 values ('wilaya:9',5,'OLD-CODE-1', now() - interval '2 minutes', 25);
do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
    perform mark_attendance('OLD-CODE-1');
    perform set_config('role','postgres',true);
    insert into rls_results values ('رمزٌ مضت مدّته يُرفض', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('رمزٌ مضت مدّته يُرفض', true);
  end;
end $$;
insert into rls_results select 'ولم يُكتب به حضور',
  not exists (select 1 from attendance where session=5);

-- رمزٌ مخترَع يُرفض
do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
    perform mark_attendance('GUESSED-CODE');
    perform set_config('role','postgres',true);
    insert into rls_results values ('رمزٌ مخترَع يُرفض', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('رمزٌ مخترَع يُرفض', true);
  end;
end $$;

-- حسابٌ خارج كشف الشعبة لا يسجّل بالرمز ولو كان حيًّا
do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','ffffffff-0000-0000-0000-000000000001',true);
    perform mark_attendance('LIVE-CODE-1');
    perform set_config('role','postgres',true);
    insert into rls_results values ('حسابٌ خارج الكشف لا يسجّل بالرمز', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('حسابٌ خارج الكشف لا يسجّل بالرمز', true);
  end;
end $$;

-- وبلا حساب لا يُستدعى أصلًا
do $$
begin
  begin
    perform set_config('role','anon',true);
    perform mark_attendance('LIVE-CODE-1');
    perform set_config('role','postgres',true);
    insert into rls_results values ('وبلا حساب لا تُستدعى الدالة', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('وبلا حساب لا تُستدعى الدالة', true);
  end;
end $$;

-- «بعذر» لا يُنقض بمسح الرمز
insert into attendance(id,student_id,section_id,session,status,day)
 values ('t-exc','t-noura','wilaya:9',4,'excused','2026-10-06');
begin; set local role authenticated; set local request.jwt.claim.sub = :'NOURA';
select mark_attendance('LIVE-CODE-1');
commit;
insert into rls_results select 'العذر لا يُنقض بمسح الرمز',
  (select status from attendance where id='t-exc')='excused';

-- والمالكة تكتب الرمز وتقرؤه
begin; set local role authenticated; set local request.jwt.claim.sub = :'OWNER';
insert into attend_codes(section_id,session,nonce) values ('wilaya:9',6,'OWNER-CODE');
insert into rls_results select 'المالكة تكتب الرمز وتقرؤه',
  (select count(*) from attend_codes where nonce='OWNER-CODE')=1;
commit;

-- ═══════════════════════════════════════════════════════════════
--  تصحيحات النصوص
--
--  المطلوب: أن تكتبها المالكة وحدها، وأن تقرأها طالبات المقرر
--  نفسه لا غيرهنّ، وأن يعود الأصل بحذف الصفّ.
-- ═══════════════════════════════════════════════════════════════
insert into content(id,course_id,ref,field,value) values
 ('wilaya:h1|title','wilaya','wilaya:h1','title','عنوانٌ مصحَّح'),
 ('mirath:m1|title','mirath','mirath:m1','title','عنوان الميراث');

-- سارة في المقررين (صفّاها أُدخلا في كتلة تعدّد المقررات)
begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into rls_results select 'طالبة المقررين ترى تصحيحاتهما', (select count(*) from content)=2;
commit;

-- ومن تدرس مقررًا واحدًا لا ترى تصحيحات الآخر
insert into auth.users(id,email) values
 ('c1c1c1c1-0000-0000-0000-000000000001','one@test') on conflict do nothing;
insert into students(id,section_id,no,name,uid,auth_uid) values
 ('c-one','wilaya:9',40,'أمل','2202144444','c1c1c1c1-0000-0000-0000-000000000001');
begin; set local role authenticated;
set local request.jwt.claim.sub = 'c1c1c1c1-0000-0000-0000-000000000001';
insert into rls_results select 'طالبة مقرر واحد ترى تصحيحاته وحدها',
  (select count(*) from content)=1;
insert into rls_results select 'والذي تراه تصحيح مقررها',
  (select course_id from content)='wilaya';
commit;

-- وغريبٌ بحساب لا يرى شيئًا، وبلا حساب كذلك
begin; set local role authenticated;
set local request.jwt.claim.sub = 'ffffffff-0000-0000-0000-000000000001';
insert into rls_results select 'غريبٌ بحساب لا يرى التصحيحات', (select count(*) from content)=0;
commit;
begin; set local role anon;
insert into rls_results select 'وبلا حساب لا يرى التصحيحات', (select count(*) from content)=0;
commit;

-- والطالبة لا تكتب تصحيحًا ولا تعدّله ولا تحذفه
do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
    insert into content(id,course_id,ref,field,value)
      values ('x|y','wilaya','x','y','نصّي أنا');
    perform set_config('role','postgres',true);
    insert into rls_results values ('الطالبة لا تكتب تصحيحًا', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('الطالبة لا تكتب تصحيحًا', true);
  end;
end $$;

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
with u as (update content set value='مبدَّل' where id='wilaya:h1|title' returning 1)
  insert into rls_results select 'ولا تعدّل تصحيح الدكتورة', count(*)=0 from u;
with d as (delete from content where id='wilaya:h1|title' returning 1)
  insert into rls_results select 'ولا تحذفه', count(*)=0 from d;
commit;
insert into rls_results select 'والتصحيح باقٍ كما كتبته الدكتورة',
  (select value from content where id='wilaya:h1|title')='عنوانٌ مصحَّح';

-- والمالكة تكتب وتحذف
begin; set local role authenticated; set local request.jwt.claim.sub = :'OWNER';
insert into content(id,course_id,ref,field,value)
  values ('wilaya:h1#h1q1|prompt','wilaya','wilaya:h1#h1q1','prompt','سؤالٌ مصحَّح');
insert into rls_results select 'المالكة تكتب التصحيح', (select count(*) from content)=3;
delete from content where id='wilaya:h1#h1q1|prompt';
insert into rls_results select 'وتحذفه فيعود الأصل', (select count(*) from content)=2;
commit;

-- ═══════════════════════════════════════════════════════════════
--  نافذة التسليم
--
--  الحراسة في الخادم لا في المتصفّح: ما يُحرَس في الصفحة يُتخطّى
--  بطلبٍ واحد مباشر. والمالكة خارج الحدّ — تُدخل تسليم من اعتذرت.
-- ═══════════════════════════════════════════════════════════════
insert into content(id,course_id,ref,field,value) values
 ('wilaya:w-late|dueAt','wilaya','wilaya:w-late','dueAt',
  (now() - interval '1 day')::text),
 ('wilaya:w-soon|opensAt','wilaya','wilaya:w-soon','opensAt',
  (now() + interval '1 day')::text);

-- بعد الموعد: التسليم يُرفض
begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into submissions(id,student_id,worksheet_id,status)
  values ('lt-1','t-sara','wilaya:w-late','draft');
commit;
do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
    update submissions set status='submitted' where id='lt-1';
    perform set_config('role','postgres',true);
    insert into rls_results values ('التسليم بعد الموعد يُرفض', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('التسليم بعد الموعد يُرفض', true);
  end;
end $$;
insert into rls_results select 'والصفّ باقٍ مسودة',
  (select status from submissions where id='lt-1')='draft';

-- وقبل الفتح كذلك
begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into submissions(id,student_id,worksheet_id,status)
  values ('sn-1','t-sara','wilaya:w-soon','draft');
commit;
do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
    update submissions set status='submitted' where id='sn-1';
    perform set_config('role','postgres',true);
    insert into rls_results values ('التسليم قبل الفتح يُرفض', false);
  exception when others then
    perform set_config('role','postgres',true);
    insert into rls_results values ('التسليم قبل الفتح يُرفض', true);
  end;
end $$;

-- وداخل النافذة يُقبل
insert into content(id,course_id,ref,field,value) values
 ('wilaya:w-open|opensAt','wilaya','wilaya:w-open','opensAt',(now() - interval '1 hour')::text),
 ('wilaya:w-open|dueAt','wilaya','wilaya:w-open','dueAt',(now() + interval '1 hour')::text);
begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into submissions(id,student_id,worksheet_id,status)
  values ('op-1','t-sara','wilaya:w-open','draft');
update submissions set status='submitted' where id='op-1';
commit;
insert into rls_results select 'وداخل النافذة يُقبل',
  (select status from submissions where id='op-1')='submitted';

-- وورقةٌ بلا نافذة تُسلَّم كما كانت
begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into submissions(id,student_id,worksheet_id,status)
  values ('nw-1','t-sara','wilaya:w-none','draft');
update submissions set status='submitted' where id='nw-1';
commit;
insert into rls_results select 'وورقةٌ بلا نافذة تُسلَّم كما كانت',
  (select status from submissions where id='nw-1')='submitted';

-- والمالكة تُدخل تسليمًا بعد الموعد
begin; set local role authenticated; set local request.jwt.claim.sub = :'OWNER';
update submissions set status='submitted' where id='lt-1';
commit;
insert into rls_results select 'والمالكة تُدخل تسليمًا بعد الموعد',
  (select status from submissions where id='lt-1')='submitted';

-- والطالبة ترى موعد ورقتها (فالموعد في content وهي تقرأ مقررها)
begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into rls_results select 'الطالبة ترى موعد التسليم',
  exists (select 1 from content where ref='wilaya:w-late' and field='dueAt');
commit;

\echo ''
select case when ok then '✓' else '✗ ثغرة' end as حالة, label as الاختبار from rls_results;
select count(*) filter (where ok) as نجح, count(*) filter (where not ok) as فشل from rls_results;
