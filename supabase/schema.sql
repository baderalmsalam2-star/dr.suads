-- ═══════════════════════════════════════════════════════════════
--  منصة التدريس — مخطط قاعدة البيانات على Supabase
--
--  الصقي هذا الملف كاملًا في SQL Editor داخل مشروعك واضغطي Run.
--  يُشغَّل مرة واحدة، وإعادة تشغيله آمنة.
--
--  نموذج الصلاحيات:
--    • الدكتورة  = حساب واحد، معرّفه في جدول owners. ترى وتعدّل كل شيء.
--    • الطالبة   = حسابها مربوط بصفها في students.auth_uid.
--                  ترى صفّها وحده، وتكتب تسليماتها وحدها،
--                  ولا ترى حضور غيرها ولا نقاطهن ولا تسليماتهن.
--    • بلا حساب  = لا شيء إطلاقًا.
-- ═══════════════════════════════════════════════════════════════

-- ─── المالكات (الدكتورة ومن تفوّضه) ───
create table if not exists owners (
  uid   uuid primary key references auth.users(id) on delete cascade,
  label text,
  added timestamptz not null default now()
);

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from owners where uid = auth.uid());
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

-- ═══ تفعيل حماية الصفوف ═══
alter table owners      enable row level security;
alter table students    enable row level security;
alter table events      enable row level security;
alter table attendance  enable row level security;
alter table submissions enable row level security;
alter table schedule    enable row level security;

-- صفّ الطالبة الحالية
create or replace function my_student_id() returns text
language sql stable security definer set search_path = public as $$
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

-- الطالبة تربط صفّها بحسابها مرة واحدة فقط (وهو صفّ لم يُربط بعد)
drop policy if exists students_claim on students;
create policy students_claim on students for update
  using (auth_uid is null) with check (auth_uid = auth.uid());

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

drop policy if exists submissions_self_write on submissions;
create policy submissions_self_write on submissions for insert
  with check (student_id = my_student_id());

-- التسليم المقفل لا يُعدَّل من الطالبة
drop policy if exists submissions_self_update on submissions;
create policy submissions_self_update on submissions for update
  using (student_id = my_student_id() and status <> 'submitted')
  with check (student_id = my_student_id());

-- ─── schedule: الجميع يقرأ، والمالكة وحدها تكتب ───
drop policy if exists schedule_read on schedule;
create policy schedule_read on schedule for select using (auth.uid() is not null);

drop policy if exists schedule_write on schedule;
create policy schedule_write on schedule for all
  using (is_owner()) with check (is_owner());

-- ═══ تخزين ملفات الطالبات ═══
insert into storage.buckets (id, name, public)
values ('tp-files', 'tp-files', false)
on conflict (id) do nothing;

-- مسار الملف: <student_id>/<اسم الملف>
drop policy if exists tpfiles_owner on storage.objects;
create policy tpfiles_owner on storage.objects for all
  using (bucket_id = 'tp-files' and is_owner())
  with check (bucket_id = 'tp-files' and is_owner());

drop policy if exists tpfiles_self on storage.objects;
create policy tpfiles_self on storage.objects for all
  using (bucket_id = 'tp-files' and (storage.foldername(name))[1] = my_student_id())
  with check (bucket_id = 'tp-files' and (storage.foldername(name))[1] = my_student_id());

-- ═══════════════════════════════════════════════════════════════
--  بعد التشغيل: سجّلي دخولك مرة، ثم نفّذي هذا السطر بمعرّفك
--  (تجدينه في Authentication ← Users):
--
--      insert into owners (uid, label)
--      values ('<معرّف حسابك>', 'د. سعاد المطوع');
--
--  بلا هذا السطر لن ترى شيئًا — وهذا مقصود.
-- ═══════════════════════════════════════════════════════════════
