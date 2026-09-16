-- ═══════════════════════════════════════════════════════════════
--  منصة التدريس — مخطط قاعدة البيانات على Supabase
--
--  الصقي هذا الملف كاملًا في SQL Editor داخل مشروعك واضغطي Run.
--  يُشغَّل مرة واحدة، وإعادة تشغيله آمنة.
--
--  نموذج الصلاحيات:
--    • الدكتورة  = حساب في owners بدور teacher. ترى وتعدّل كل شيء.
--    • المشرف    = حساب في owners بدور admin. مثلها، وفوقه صفحة الفحص.
--    • الطالبة   = حسابها مربوط بصفها في students.auth_uid.
--                  ترى صفّها وحده، وتكتب تسليماتها وحدها،
--                  ولا ترى حضور غيرها ولا نقاطهن ولا تسليماتهن.
--    • بلا حساب  = لا شيء إطلاقًا.
-- ═══════════════════════════════════════════════════════════════

-- ─── المالكات ───
--  role يفرّق بين صلاحيتين، وكلتاهما ترى البيانات كاملةً:
--    teacher  الدكتورة — التدريس كلّه: الكشف والحضور والدرجات والأنشطة.
--    admin    المشرف التقني — كل ما تراه الدكتورة، وفوقه صفحة الفحص:
--             حالة التخزين وسلامة البيانات وتشخيص الأعطال.
--  الفرق في الواجهة لا في البيانات: لا يملك المشرف بيانات لا تملكها
--  الدكتورة، وإنما أدوات تشخيص لا تعني المدرِّسة ولا ينبغي أن تزحم
--  صفحاتها.
create table if not exists owners (
  uid   uuid primary key references auth.users(id) on delete cascade,
  label text,
  role  text not null default 'teacher'
        check (role in ('teacher', 'admin')),
  added timestamptz not null default now()
);

-- ترقية جدولٍ أُنشئ قبل إضافة العمود
alter table owners add column if not exists role text not null default 'teacher';
do $$ begin
  alter table owners add constraint owners_role_chk
    check (role in ('teacher','admin'));
exception when duplicate_object then null; end $$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from owners where uid = auth.uid());
$$;

-- المشرف التقني وحده
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from owners where uid = auth.uid() and role = 'admin'
  );
$$;

-- ─── الطالبات ───
create table if not exists students (
  id          text primary key,
  section_id  text not null,
  no          int  not null default 0,
  name        text not null,
  uid         text,
  placeholder boolean not null default false,
  active      boolean not null default true,
  auth_uid    uuid unique references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);
create index if not exists students_section on students (section_id, no);
create index if not exists students_uid     on students (uid);

-- ─── أحداث التفاعل ───
create table if not exists events (
  id         text primary key,
  student_id text not null references students(id) on delete cascade,
  section_id text not null,
  session    int,
  kind       text not null,
  points     int  not null default 0,
  ref        text,
  day        date not null,
  at         bigint
);
create index if not exists events_student on events (student_id);
create index if not exists events_scope   on events (section_id, day);

-- ─── الحضور: سجل واحد لكل (طالبة، حصة) ───
create table if not exists attendance (
  id         text primary key,
  student_id text not null references students(id) on delete cascade,
  section_id text not null,
  session    int  not null,
  day        date,
  status     text not null check (status in ('present','late','excused','absent')),
  at         bigint,
  unique (student_id, session)
);
create index if not exists attendance_scope on attendance (section_id, session);

-- ─── التسليمات ───
create table if not exists submissions (
  id           text primary key,
  student_id   text not null references students(id) on delete cascade,
  worksheet_id text not null,
  session      int,
  answers      jsonb not null default '{}'::jsonb,
  files        jsonb not null default '{}'::jsonb,
  status       text  not null default 'draft',
  submitted_at timestamptz,
  updated_at   timestamptz not null default now(),
  unique (student_id, worksheet_id)
);
create index if not exists submissions_student on submissions (student_id);

-- ─── جدول تواريخ الحصص ───
create table if not exists schedule (
  section_id text not null,
  session    int  not null,
  day        date not null,
  primary key (section_id, session)
);

-- ─── الدرجات اليدوية: سجل واحد لكل (طالبة، بند) ───
--  البنود المحسوبة (المشاركة، الحضور، أوراق العمل) لا تُخزَّن هنا،
--  بل تُشتقّ عند العرض من سجلات المنصة نفسها فلا تتقادم.
create table if not exists grades (
  id          text primary key,
  student_id  text not null references students(id) on delete cascade,
  section_id  text not null,
  item_id     text not null,
  score       numeric,
  note        text,
  updated_at  timestamptz not null default now(),
  unique (student_id, item_id)
);
create index if not exists grades_scope on grades (section_id, item_id);

-- ─── توزيعة الدرجات لكل شعبة ───
create table if not exists scheme (
  section_id  text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ═══ تفعيل حماية الصفوف ═══
alter table owners      enable row level security;
alter table grades      enable row level security;
alter table scheme      enable row level security;
alter table students    enable row level security;
alter table events      enable row level security;
alter table attendance  enable row level security;
alter table submissions enable row level security;
alter table schedule    enable row level security;

-- صفّ الطالبة الحالية
create or replace function my_student_id() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select id from students where auth_uid = auth.uid() limit 1;
$$;

-- ─── owners: لا يقرؤه إلا المالكات، ولا يُكتب إلا من لوحة Supabase ───
drop policy if exists owners_read on owners;
create policy owners_read on owners for select using (is_owner());

-- ─── students ───
drop policy if exists students_owner on students;
create policy students_owner on students for all
  using (is_owner()) with check (is_owner());

drop policy if exists students_self on students;
create policy students_self on students for select
  using (auth_uid = auth.uid());

-- لا سياسة تسمح للطالبة بتعديل جدول الطالبات إطلاقًا.
-- الربط بين حساب الطالبة وصفّها يقع تلقائيًا في link_student_account()
-- أدناه، وهي دالة تعمل في الخادم لا في المتصفّح.
--
-- (كانت هنا سياسة تسمح للطالبة بربط أي صفّ لم يُربط بعد بحسابها،
--  وهي ثغرة: تمكّن أي حساب من الاستيلاء على صفّ طالبة أخرى وتغيير
--  اسمها ورقمها الجامعي. أُزيلت.)
drop policy if exists students_claim on students;

-- ═══════════════════════════════════════════════════════════════
--  التسجيل بالباركود — بلا حساب ولا كلمة سر
--
--  الطالبة تمسح الرمز، فتكتب اسمها ورقمها الجامعي، فيُضاف صفّها.
--  ولا تملك الكتابة في جدول students مباشرةً — هذا الباب مغلق وسيبقى
--  مغلقًا. الكتابة كلها تمرّ من هذه الدالة وحدها، فهي تحدّد بالضبط
--  ما يُكتب وما لا يُكتب:
--
--    • تُدخل صفًّا جديدًا أو تُحدّث صفّ صاحب الرقم نفسه — ولا تمسّ
--      صفّ غيره.
--    • لا تُعدّل صفًّا مربوطًا بحساب (auth_uid ليس فارغًا): فلو
--      ارتبطت طالبة بحسابها الجامعي لاحقًا، لم يعد أحد يغيّر اسمها
--      بمسح الباركود.
--    • لا تقرأ ولا تُرجع شيئًا عن بقية الكشف — فلا يُستخرج منها
--      أسماء الطالبات ولا أرقامهنّ.
--    • تتحقق من الشعبة والاسم والرقم قبل الكتابة.
--
--  والمقابل الذي تقبله الدكتورة: من وصل إلى الرمز أو رابطه استطاع
--  إضافة صفّ. فالضبط بالحذف من كشف الطالبات، لا بالمنع.
-- ═══════════════════════════════════════════════════════════════
create or replace function join_class(p_section text, p_name text, p_uid text)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_uid  text := btrim(coalesce(p_uid, ''));
  v_id   text;
  v_no   int;
begin
  if length(v_name) < 3 or length(v_name) > 80 then
    raise exception 'الاسم غير صالح';
  end if;
  if v_uid !~ '^[0-9]{6,12}$' then
    raise exception 'الرقم الجامعي أرقام فقط (٦ إلى ١٢ خانة)';
  end if;
  if p_section is null or p_section = '' then
    raise exception 'لم تُحدَّد الشعبة';
  end if;

  -- الرقم مربوطٌ بحسابٍ في هذه الشعبة؟ يُرفض التسجيل رأسًا.
  -- بلا هذا الشرط كان الرقم المربوط يُتخطّى ثم يُنشَأ له صفٌّ ثانٍ،
  -- فيصير الرقم نفسه في صفّين — وهو ما يُفسد الحضور والدرجات معًا.
  if exists (select 1 from students
              where section_id = p_section and uid = v_uid
                and auth_uid is not null) then
    raise exception 'هذا الرقم الجامعي مسجَّل ومربوط بحساب. راجعي الدكتورة.';
  end if;

  -- صاحبة الرقم نفسه في الشعبة نفسها: يُحدَّث صفّها لا يُكرَّر
  select id into v_id from students
   where section_id = p_section and uid = v_uid and auth_uid is null
   limit 1;

  if v_id is not null then
    update students set name = v_name, active = true, updated_at = now()
     where id = v_id;
    return v_id;
  end if;

  -- أو صفٌّ نموذجيّ شاغر يُملأ بها بدل إضافة صفٍّ جديد
  select id, no into v_id, v_no from students
   where section_id = p_section and placeholder and auth_uid is null
   order by no limit 1;

  if v_id is not null then
    update students
       set name = v_name, uid = v_uid, placeholder = false,
           active = true, updated_at = now()
     where id = v_id;
    return v_id;
  end if;

  select coalesce(max(no), 0) + 1 into v_no from students where section_id = p_section;
  v_id := 'st-' || replace(gen_random_uuid()::text, '-', '');
  insert into students (id, section_id, no, name, uid, placeholder, active)
  values (v_id, p_section, v_no, v_name, v_uid, false, true);
  return v_id;
end $$;

revoke all on function join_class(text, text, text) from public;
grant execute on function join_class(text, text, text) to anon, authenticated;

-- ─── events ───
drop policy if exists events_owner on events;
create policy events_owner on events for all
  using (is_owner()) with check (is_owner());

drop policy if exists events_self on events;
create policy events_self on events for select
  using (student_id = my_student_id());

-- ─── attendance ───
drop policy if exists attendance_owner on attendance;
create policy attendance_owner on attendance for all
  using (is_owner()) with check (is_owner());

drop policy if exists attendance_self on attendance;
create policy attendance_self on attendance for select
  using (student_id = my_student_id());

-- ─── submissions: الطالبة تكتب تسليمها وحدها ───
drop policy if exists submissions_owner on submissions;
create policy submissions_owner on submissions for all
  using (is_owner()) with check (is_owner());

drop policy if exists submissions_self on submissions;
create policy submissions_self on submissions for select
  using (student_id = my_student_id());

--  الطالبة تولد مسودةً لا تسليمًا مقفلًا. بلا قيد status كانت تستطيع
--  إرسال صفٍّ status='submitted' لكل ورقة بطلب واحد، بإجابات فارغة،
--  فتنال درجة الواجبات الإلكترونية كاملةً بلا أن تحلّ شيئًا.
drop policy if exists submissions_self_write on submissions;
create policy submissions_self_write on submissions for insert
  with check (student_id = my_student_id() and status = 'draft');

-- التسليم المقفل لا يُعدَّل من الطالبة
drop policy if exists submissions_self_update on submissions;
create policy submissions_self_update on submissions for update
  using (student_id = my_student_id() and status <> 'submitted')
  with check (student_id = my_student_id());

--  ووقت التسليم يُختم في الخادم لا يُرسَل من المتصفّح، ولا يُرجَع
--  تسليمٌ مقفل إلى مسودة.
create or replace function stamp_submission() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'submitted'
     and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
    new.submitted_at := now();
  end if;
  if tg_op = 'UPDATE' and old.status = 'submitted'
     and new.status <> 'submitted' and not is_owner() then
    raise exception 'التسليم المقفل لا يُعاد إلى مسودة';
  end if;
  return new;
end $$;

drop trigger if exists on_submission_saved on submissions;
create trigger on_submission_saved
  before insert or update on submissions
  for each row execute function stamp_submission();

-- ─── grades: المالكة ترصد، والطالبة تقرأ درجتها هي وحدها ───
drop policy if exists grades_owner on grades;
create policy grades_owner on grades for all
  using (is_owner()) with check (is_owner());

drop policy if exists grades_self on grades;
create policy grades_self on grades for select
  using (student_id = my_student_id());

-- ─── scheme: الجميع يقرأ التوزيعة (الطالبة ترى على أي أساس تُقيَّم)،
--             والمالكة وحدها تكتبها ───
--  «أي حساب» ليس قيدًا: إنشاء الحساب مجاني وعلني (sendLink بـ
--  create_user وبمفتاح anon المنشور). فالقراءة مقصورة على شعبة
--  الطالبة نفسها — وحسابٌ غير مرتبط بصفٍّ لا يرى شيئًا.
drop policy if exists scheme_read on scheme;
create policy scheme_read on scheme for select
  using (is_owner() or section_id = (
    select section_id from students where id = my_student_id()));

drop policy if exists scheme_write on scheme;
create policy scheme_write on scheme for all
  using (is_owner()) with check (is_owner());

-- ─── schedule: الجميع يقرأ، والمالكة وحدها تكتب ───
drop policy if exists schedule_read on schedule;
create policy schedule_read on schedule for select
  using (is_owner() or section_id = (
    select section_id from students where id = my_student_id()));

drop policy if exists schedule_write on schedule;
create policy schedule_write on schedule for all
  using (is_owner()) with check (is_owner());

-- ═══════════════════════════════════════════════════════════════
--  الربط التلقائي بحساب الجامعة
--
--  بريد الطالبة في جامعة الكويت مبنيّ على رقمها الجامعي:
--      s2200000001@ku.edu.kw  ←  الرقم الجامعي 2200000001
--  فمتى دخلت الطالبة بحسابها الجامعي، انتزعنا الرقم من بريدها
--  ووصلنا الحساب بصفّها في كشف الدكتورة. لا مطابقة أسماء ولا خطوة
--  يدوية ولا احتمال خطأ.
--
--  لماذا هذا آمن والسياسة المحذوفة أعلاه لم تكن؟
--    • البريد يأتي موقَّعًا من Entra (هوية الجامعة) لا من المتصفّح،
--      فلا تستطيع الطالبة ادّعاء رقم زميلتها.
--    • الدالة تعمل بصلاحية المالك (security definer) في الخادم،
--      والطالبة لا تملك استدعاءها.
--    • ولا تربط إلا صفًّا شاغرًا (auth_uid is null)، فحساب ثانٍ
--      بالرقم نفسه لا ينتزع صفًّا مربوطًا.
--
--  بريد الدكتورة مبنيّ على الاسم (name.family@ku.edu.kw) فلا يطابق
--  الصيغة ولا يُربط بأي صفّ — وهو ما نريده.
-- ═══════════════════════════════════════════════════════════════
create or replace function link_student_account() returns trigger
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare sid text;
begin
  sid := substring(lower(coalesce(new.email,'')) from '^s([0-9]{6,12})@ku\.edu\.kw$');
  if sid is null then return new; end if;

  --  صفٌّ واحد لا كل الصفوف ذات الرقم نفسه: auth_uid فريد، فتحديث
  --  صفّين بالمعرّف نفسه يرفع unique_violation فيُسقط إنشاء الحساب
  --  كلّه — والطالبة لا تستطيع الدخول إطلاقًا. ويُلفّ الجسم فلا
  --  يمنع خللٌ في الكشف طالبةً من إنشاء حسابها.
  begin
    update students
       set auth_uid = new.id, updated_at = now()
     where id = (
       select id from students
        where uid = sid and auth_uid is null
        order by updated_at
        limit 1)
       and not exists (select 1 from students s2 where s2.auth_uid = new.id);
  exception when others then
    null;                       /* الحساب يُنشأ، والربط يُعالَج يدويًا */
  end;
  return new;
end $$;

-- عند إنشاء الحساب، وعند أول مرة يُثبت فيها البريد
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function link_student_account();

--  الاتجاه المعاكس: الطالبة قد تدخل قبل أن تضيفها الدكتورة للكشف.
--  فعند إضافة صفّ جديد (أو تصحيح رقم جامعي) نبحث عن حساب موجود
--  ببريد ذلك الرقم ونربطه. هكذا يستوي الترتيبان.
create or replace function link_student_row() returns trigger
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare aid uuid;
begin
  --  عند تصحيح الرقم الجامعي يُفكّ الربط القديم أولًا.
  --  بلا هذا: تخطئ الدكتورة في رقم نورة فتكتب رقم سارة، فيرتبط صفّ
  --  نورة بحساب سارة؛ ثم تصحّح الرقم، فينسحب المُطلِق لأن auth_uid
  --  لم يعد فارغًا — فيبقى صفّ نورة بيد سارة إلى آخر الفصل.
  if tg_op = 'UPDATE' and new.uid is distinct from old.uid then
    new.auth_uid := null;
  end if;

  if new.auth_uid is not null or new.uid is null then return new; end if;

  select u.id into aid from auth.users u
   where lower(u.email) = 's' || new.uid || '@ku.edu.kw'
     and not exists (select 1 from students s2 where s2.auth_uid = u.id)
   limit 1;

  new.auth_uid := aid;
  return new;
end $$;

drop trigger if exists on_student_row_saved on students;
create trigger on_student_row_saved
  before insert or update of uid on students
  for each row execute function link_student_row();

-- على Supabase هذا الجدول مملوك لدور supabase_storage_admin وحمايته
-- مفعَّلة أصلًا، فمحاولة تفعيلها تردّ 42501 وتُسقط المخطّط كلّه. وهي
-- لازمة على قاعدة اختبارٍ محلية. فتُحاوَل ويُتجاوَز فشلها.
do $$ begin
  alter table storage.objects enable row level security;
exception when insufficient_privilege or undefined_table or wrong_object_type then
  raise notice 'حماية storage.objects مفعَّلة أصلًا — تُخطّي.';
end $$;

-- هل يشير تسليمٌ مقفل إلى هذا الملف؟
create or replace function locked_file(p text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from submissions s
     where s.status = 'submitted'
       and s.files::text like '%' || p || '%'
  );
$$;

-- ═══ تخزين ملفات الطالبات ═══
--  كل ما يمسّ مخطّط storage يُحرَس: هو مملوك لدور آخر على Supabase،
--  وقد يُمنع إنشاء سياساته من محرّر SQL حسب إصدار المشروع. فإن مُنع،
--  يُكمل المخطّط عمله وتُنشأ السياسات من واجهة Storage يدويًا —
--  ولا يسقط كل شيء بسبب جدولٍ واحد.


-- ═══ تخزين ملفات الطالبات ═══
do $$ begin
  insert into storage.buckets (id, name, public)
  values ('tp-files', 'tp-files', false)
  on conflict (id) do nothing;
exception when insufficient_privilege or undefined_table or undefined_object then
  raise notice 'تُخطّي (صلاحية التخزين): %', sqlerrm;
end $$;

-- مسار الملف: <student_id>/<اسم الملف>
do $$ begin
  drop policy if exists tpfiles_owner on storage.objects;
exception when insufficient_privilege or undefined_table or undefined_object then
  raise notice 'تُخطّي (صلاحية التخزين): %', sqlerrm;
end $$;

do $$ begin
  create policy tpfiles_owner on storage.objects for all
    using (bucket_id = 'tp-files' and is_owner())
    with check (bucket_id = 'tp-files' and is_owner());
exception when insufficient_privilege or undefined_table or undefined_object then
  raise notice 'تُخطّي (صلاحية التخزين): %', sqlerrm;
end $$;

--  القراءة والكتابة مفصولتان: كانت for all فتُبطل قفل التسليم —
--  يُقفل الصفّ في submissions ولا يُقفل الملف في التخزين، فتستبدل
--  الطالبة ملف ورقتها المسلَّمة بعد انتهاء الموعد.
do $$ begin
  drop policy if exists tpfiles_self on storage.objects;
exception when insufficient_privilege or undefined_table or undefined_object then
  raise notice 'تُخطّي (صلاحية التخزين): %', sqlerrm;
end $$;

do $$ begin
  drop policy if exists tpfiles_self_read on storage.objects;
exception when insufficient_privilege or undefined_table or undefined_object then
  raise notice 'تُخطّي (صلاحية التخزين): %', sqlerrm;
end $$;

do $$ begin
  create policy tpfiles_self_read on storage.objects for select
    using (bucket_id = 'tp-files' and (storage.foldername(name))[1] = my_student_id());
exception when insufficient_privilege or undefined_table or undefined_object then
  raise notice 'تُخطّي (صلاحية التخزين): %', sqlerrm;
end $$;

do $$ begin
  drop policy if exists tpfiles_self_write on storage.objects;
exception when insufficient_privilege or undefined_table or undefined_object then
  raise notice 'تُخطّي (صلاحية التخزين): %', sqlerrm;
end $$;

do $$ begin
  create policy tpfiles_self_write on storage.objects for insert
    with check (bucket_id = 'tp-files' and (storage.foldername(name))[1] = my_student_id());
exception when insufficient_privilege or undefined_table or undefined_object then
  raise notice 'تُخطّي (صلاحية التخزين): %', sqlerrm;
end $$;

--  التعديل والحذف ممنوعان على ملفٍ يشير إليه تسليمٌ مقفل
do $$ begin
  drop policy if exists tpfiles_self_edit on storage.objects;
exception when insufficient_privilege or undefined_table or undefined_object then
  raise notice 'تُخطّي (صلاحية التخزين): %', sqlerrm;
end $$;

do $$ begin
  create policy tpfiles_self_edit on storage.objects for update
    using (bucket_id = 'tp-files'
           and (storage.foldername(name))[1] = my_student_id()
           and not locked_file(name))
    with check (bucket_id = 'tp-files' and (storage.foldername(name))[1] = my_student_id());
exception when insufficient_privilege or undefined_table or undefined_object then
  raise notice 'تُخطّي (صلاحية التخزين): %', sqlerrm;
end $$;

do $$ begin
  drop policy if exists tpfiles_self_del on storage.objects;
exception when insufficient_privilege or undefined_table or undefined_object then
  raise notice 'تُخطّي (صلاحية التخزين): %', sqlerrm;
end $$;

do $$ begin
  create policy tpfiles_self_del on storage.objects for delete
    using (bucket_id = 'tp-files'
           and (storage.foldername(name))[1] = my_student_id()
           and not locked_file(name));
exception when insufficient_privilege or undefined_table or undefined_object then
  raise notice 'تُخطّي (صلاحية التخزين): %', sqlerrm;
end $$;

-- PostgREST يخزّن شكل المخطّط في ذاكرته، فلا يرى دالةً أُضيفت بعد
-- إقلاعه حتى يُطلب منه إعادة القراءة. بلا هذا السطر تردّ المنصة:
--   Could not find the function ... in the schema cache
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
--  بعد التشغيل: سجّلي دخولك مرة، ثم نفّذي هذا السطر بمعرّفك
--  (تجدينه في Authentication ← Users):
--
--      insert into owners (uid, label, role)
--      values ('<معرّف حسابك>', 'د. سعاد المطوع', 'admin');
--
--  وللمشرف التقني:
--
--      insert into owners (uid, label, role)
--      values ('<معرّف حسابه>', 'بدر المسلم', 'admin');
--
--  بلا هذا السطر لن ترى شيئًا — وهذا مقصود.
-- ═══════════════════════════════════════════════════════════════
