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

drop table if exists rls_results;
create table rls_results (label text, ok boolean);
grant all on rls_results to anon, authenticated;

insert into auth.users(id,email) values
 ('11111111-1111-1111-1111-111111111111','owner@test'),
 ('22222222-2222-2222-2222-222222222222','sara@test'),
 ('33333333-3333-3333-3333-333333333333','noura@test') on conflict do nothing;
insert into owners(uid,label) values ('11111111-1111-1111-1111-111111111111','مالكة الاختبار') on conflict do nothing;
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

\echo ''
select case when ok then '✓' else '✗ ثغرة' end as حالة, label as الاختبار from rls_results;
select count(*) filter (where ok) as نجح, count(*) filter (where not ok) as فشل from rls_results;
