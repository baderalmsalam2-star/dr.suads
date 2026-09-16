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
 ('t-sara','9',1,'سارة','900001','22222222-2222-2222-2222-222222222222'),
 ('t-noura','9',2,'نورة','900002','33333333-3333-3333-3333-333333333333'),
 ('t-free','9',3,'هيا','900003',null) on conflict do nothing;
insert into events(id,student_id,section_id,kind,points,day) values
 ('t-ev1','t-sara','9','read',2,'2026-01-01'),
 ('t-ev2','t-noura','9','read',2,'2026-01-01') on conflict do nothing;
insert into attendance(id,student_id,section_id,session,status,day) values
 ('t-at1','t-sara','9',1,'absent','2026-01-01'),
 ('t-at2','t-noura','9',1,'absent','2026-01-01') on conflict do nothing;
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
insert into rls_results select 'المالكة ترى الطالبات الثلاث', (select count(*) from students where section_id='9')=3;
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
      values ('t-cheat','t-sara','9','answer',999,'2026-01-01');
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
insert into students(id,section_id,no,name,uid) values ('t-auto1','9',4,'منيرة','2202142639');
insert into auth.users(id,email) values ('44444444-4444-4444-4444-444444444444','S2202142639@KU.EDU.KW');
insert into rls_results select 'الكشف أولًا ثم الدخول ⇒ ارتبط',
  (select auth_uid from students where id='t-auto1')='44444444-4444-4444-4444-444444444444';

-- ترتيب ب: دخول الطالبة أولًا ثم إضافتها للكشف
insert into auth.users(id,email) values ('55555555-5555-5555-5555-555555555555','s2202149999@ku.edu.kw');
insert into students(id,section_id,no,name,uid) values ('t-auto2','9',5,'دلال','2202149999');
insert into rls_results select 'الدخول أولًا ثم الكشف ⇒ ارتبط',
  (select auth_uid from students where id='t-auto2')='55555555-5555-5555-5555-555555555555';

-- الربط لا يعرف من أي طريق دخلت: رابط البريد يربط كما يربط أزور
-- (هذا ما يجعل تسجيل التطبيق في أزور اختياريًا لا شرطًا)
insert into students(id,section_id,no,name,uid) values ('t-mail','9',7,'نوره','2202148888');
insert into auth.users(id,email) values ('aaaaaaaa-0000-0000-0000-000000000001','s2202148888@ku.edu.kw');
insert into rls_results select 'رابط البريد يربط أيضًا — بلا أزور',
  (select auth_uid from students where id='t-mail')='aaaaaaaa-0000-0000-0000-000000000001';

-- بريد الدكتورة مبنيّ على الاسم، فلا يُربط بأي صفّ
insert into auth.users(id,email) values ('66666666-6666-6666-6666-666666666666','suad.almutawa@ku.edu.kw');
insert into rls_results select 'بريد الدكتورة لا يُربط بصفّ',
  not exists (select 1 from students where auth_uid='66666666-6666-6666-6666-666666666666');

-- رقم ليس في الكشف: يمرّ بلا ربط ولا خطأ
insert into auth.users(id,email) values ('77777777-7777-7777-7777-777777777777','s2202100000@ku.edu.kw');
insert into rls_results select 'رقم خارج الكشف يمرّ بلا ربط',
  not exists (select 1 from students where auth_uid='77777777-7777-7777-7777-777777777777');

-- حساب ثانٍ بالرقم نفسه لا ينتزع صفًّا مربوطًا
insert into auth.users(id,email) values ('88888888-8888-8888-8888-888888888888','s2202142639@ku.edu.kw');
insert into rls_results select 'حساب ثانٍ لا ينتزع صفًّا مربوطًا',
  (select auth_uid from students where id='t-auto1')='44444444-4444-4444-4444-444444444444';

-- بريد من نطاق آخر يحاكي الصيغة: لا يُربط
insert into students(id,section_id,no,name,uid) values ('t-auto3','9',6,'شهد','2202147777');
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
 ('t-g1','t-sara','9','exam1',18),
 ('t-g2','t-noura','9','exam1',12) on conflict do nothing;
insert into scheme(section_id,data) values ('9','{"confirmed":true}') on conflict do nothing;

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
    update scheme set data='{"confirmed":false}' where section_id='9';
    perform set_config('role','postgres',true);
    insert into rls_results values ('لا تعدّل توزيعة الدرجات',
      (select data->>'confirmed' from scheme where section_id='9')='true');
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
      values ('t-gx','t-sara','9','final',40);
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
insert into rls_results select 'المشرف يرى الطالبات كلهن', (select count(*) from students where section_id='9')>=3;
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
insert into students(id,section_id,no,name,uid) values ('t-mix','9',8,'نورة','2202140001');
insert into rls_results select 'ارتبط بالرقم الخطأ أولًا',
  (select auth_uid from students where id='t-mix')='dddddddd-0000-0000-0000-000000000001';
update students set uid='2202140002' where id='t-mix';
insert into rls_results select 'تصحيح الرقم يفكّ الربط الخاطئ',
  (select auth_uid from students where id='t-mix') is null;

-- ── صفّان بالرقم نفسه لا يمنعان إنشاء الحساب ──
insert into students(id,section_id,no,name,uid) values
 ('t-dup1','9',20,'منيرة','2202149111'),
 ('t-dup2','9',21,'منيرة','2202149111');
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
insert into schedule(section_id,session,day) values ('9',1,'2026-09-17') on conflict do nothing;

begin; set local role authenticated;
set local request.jwt.claim.sub = 'ffffffff-0000-0000-0000-000000000001';
insert into rls_results select 'غريبٌ بحساب لا يرى التوزيعة',  (select count(*) from scheme)=0;
insert into rls_results select 'ولا يرى جدول الحصص',           (select count(*) from schedule)=0;
insert into rls_results select 'ولا يرى الطالبات',             (select count(*) from students)=0;
commit;

begin; set local role authenticated; set local request.jwt.claim.sub = :'SARA';
insert into rls_results select 'وطالبة الشعبة ترى جدول شعبتها', (select count(*) from schedule)=1;
commit;

\echo ''
select case when ok then '✓' else '✗ ثغرة' end as حالة, label as الاختبار from rls_results;
select count(*) filter (where ok) as نجح, count(*) filter (where not ok) as فشل from rls_results;
