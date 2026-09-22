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
  auth_uid    uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);
create index if not exists students_section on students (section_id, no);
create index if not exists students_uid     on students (uid);

--  الطالبة الواحدة تدرس أكثر من مقرر، فلها صفٌّ في كشف كل مقرر
--  وحسابها واحد. فالتفرّد ليس على الحساب وحده — كان auth_uid unique
--  فلا يرتبط الحساب إلا بصفٍّ واحد في المنصة كلها، وتبقى بقية
--  المقررات لا ترى صاحبتها — بل على (الحساب، الشعبة): صفٌّ واحد
--  لكل حساب في كل شعبة، ولا أكثر.
alter table students drop constraint if exists students_auth_uid_key;
create unique index if not exists students_auth_section
  on students (auth_uid, section_id);

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

--  زمن الإجابة بالثواني من فتح شريحة السؤال.
--  الدكتورة لا تحمل ساعةً بيدها: الشريحة تعرف متى فُتحت، والضغطة
--  تعرف متى وقعت، فالفرق بينهما زمنُ الإجابة. وعليه تُرتَّب لوحة
--  الشرف بالسرعة بعد الصواب.
alter table events add column if not exists secs numeric;

-- ─── الحضور: سجل واحد لكل (طالبة، محاضرة) ───
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

--  وقت البدء — يكتبه الخادم ولا يُقبل من المتصفّح.
--  عليه يُحسب زمن الاختبار: لو كان الوقت من الجهاز لأعادت الطالبة
--  تحميل الصفحة فبدأ العدّ من جديد.
alter table submissions add column if not exists started_at timestamptz;

-- ─── جدول تواريخ المحاضرات ───
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

-- ─── رمز الحضور الدوّار ───
--  الدكتورة تعرض على البروجكتر رمزًا يتبدّل كل بضع ثوانٍ، فتمسحه
--  الطالبة فيُسجَّل حضورها. وجهاز الدكتورة هو الذي يولّد الرمز
--  ويكتبه هنا، صفٌّ واحد لكل (شعبة، محاضرة) يُحدَّث كل دورة.
--
--  ولا تقرأ الطالبةُ هذا الجدول إطلاقًا — لا سياسةَ قراءةٍ لها
--  فيه. ولو قرأته لاستغنت عن الحضور: تفتح الصفحة من بيتها فتأخذ
--  الرمز الحاليّ. القراءة محصورةٌ في mark_attendance وهي تعمل
--  بصلاحية المالك في الخادم.
--
--  حدود ما يمنعه هذا الرمز — تُقال صراحةً ولا تُوهَم الدكتورة
--  خلافَها:
--    • يمنع الرمزَ المصوَّر أمسِ أو قبل ساعة: لأنه يبطل بعد ثوانٍ.
--    • ولا يمنع طالبةً في القاعة أن تُرسل الرمز الظاهر الآن إلى
--      غائبةٍ تمسحه خلال الثواني نفسها. ولا حيلةَ في ذلك إلا
--      المراجعة، فلوحة الحضور بيد الدكتورة تُصحّح ما شاءت.
create table if not exists attend_codes (
  section_id text not null,
  session    int  not null,
  nonce      text not null,
  issued_at  timestamptz not null default now(),
  ttl_sec    int  not null default 25 check (ttl_sec between 5 and 300),
  primary key (section_id, session)
);
create unique index if not exists attend_codes_nonce on attend_codes (nonce);

-- ─── تحرير النصوص ───
--  نصوص المقرر (عناوين الأوراق وأسئلتها وتعليقاتها) تعيش في ملفات
--  data/courses/<المقرر>/. وهي ملفاتٌ لا تُكتب من المتصفّح: المنصة
--  تُقدَّم من GitHub Pages، فلا سبيل للدكتورة أن تصحّح خطأً مطبعيًّا
--  إلا بفتح الملف وتعديله ورفعه.
--
--  فهذا الجدول تصحيحاتٌ تُطبَّق فوق الملفات عند العرض: صفٌّ لكل
--  (موضع، حقل). الملفّ يبقى هو الأصل، وما هنا يعلو عليه. وحذفُ
--  الصفّ يُرجع الأصل — فلا يضيع النصّ الأول أبدًا.
--
--  العنوان: ref مثل «wilaya:h1» للورقة، أو «wilaya:h1#h1q1» لسؤالٍ
--  فيها. و field اسم الحقل: title · subtitle · intro · prompt ·
--  why · opt0 … optN.
create table if not exists content (
  id         text primary key,        -- ref || '|' || field
  course_id  text not null,
  ref        text not null,
  field      text not null,
  value      text,
  updated_at timestamptz not null default now()
);
create index if not exists content_course on content (course_id);

-- ═══ تفعيل حماية الصفوف ═══
alter table owners      enable row level security;
alter table grades      enable row level security;
alter table scheme      enable row level security;
alter table students    enable row level security;
alter table events      enable row level security;
alter table attendance  enable row level security;
alter table submissions enable row level security;
alter table schedule    enable row level security;
alter table attend_codes enable row level security;
alter table content     enable row level security;

--  صفوف الطالبة الحالية — صفٌّ في كل مقرر تدرسه، لا صفٌّ واحد.
--  (كانت my_student_id() تُرجع صفًّا واحدًا مهما كثرت المقررات،
--   فتحجب عن الطالبة درجاتها وحضورها في بقية مقرراتها.)
create or replace function my_student_ids() returns setof text
language sql stable security definer set search_path = public, pg_temp as $$
  select id from students where auth_uid = auth.uid();
$$;

--  شعب الطالبة الحالية — لقراءة التوزيعة وجدول المحاضرات
create or replace function my_section_ids() returns setof text
language sql stable security definer set search_path = public, pg_temp as $$
  select section_id from students where auth_uid = auth.uid();
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
  using (student_id in (select my_student_ids()));

-- ─── attendance ───
drop policy if exists attendance_owner on attendance;
create policy attendance_owner on attendance for all
  using (is_owner()) with check (is_owner());

drop policy if exists attendance_self on attendance;
create policy attendance_self on attendance for select
  using (student_id in (select my_student_ids()));

-- ─── submissions: الطالبة تكتب تسليمها وحدها ───
drop policy if exists submissions_owner on submissions;
create policy submissions_owner on submissions for all
  using (is_owner()) with check (is_owner());

drop policy if exists submissions_self on submissions;
create policy submissions_self on submissions for select
  using (student_id in (select my_student_ids()));

--  الطالبة تولد مسودةً لا تسليمًا مقفلًا. بلا قيد status كانت تستطيع
--  إرسال صفٍّ status='submitted' لكل ورقة بطلب واحد، بإجابات فارغة،
--  فتنال درجة الواجبات الإلكترونية كاملةً بلا أن تحلّ شيئًا.
drop policy if exists submissions_self_write on submissions;
create policy submissions_self_write on submissions for insert
  with check (student_id in (select my_student_ids()) and status = 'draft');

-- التسليم المقفل لا يُعدَّل من الطالبة
drop policy if exists submissions_self_update on submissions;
create policy submissions_self_update on submissions for update
  using (student_id in (select my_student_ids()) and status <> 'submitted')
  with check (student_id in (select my_student_ids()));

--  ووقت التسليم يُختم في الخادم لا يُرسَل من المتصفّح، ولا يُرجَع
--  تسليمٌ مقفل إلى مسودة.
create or replace function stamp_submission() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_opens timestamptz; v_due timestamptz; v_min numeric;
begin
  --  ═══ وقت البدء ═══
  --  يُكتب مرةً عند إنشاء الصفّ، ولا يُعدَّل بعدها مهما أرسل
  --  المتصفّح. وعليه يُحسب زمن الاختبار.
  if tg_op = 'INSERT' then
    new.started_at := now();
  else
    new.started_at := old.started_at;
  end if;

  if new.status = 'submitted'
     and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then

    --  ═══ نافذة التسليم ═══
    --  موعدا الفتح والإغلاق يُضبطان من صفحة الورقة ويُخزَّنان في
    --  content (ref = معرّف الورقة، field = opensAt / dueAt).
    --  والحراسة هنا لا في المتصفّح: ما يُحرَس في الصفحة يُتخطّى
    --  بطلبٍ واحد مباشر إلى الخادم.
    --
    --  والمالكة خارج الحدّ: تُدخل تسليم طالبةٍ اعتذرت بعد الموعد،
    --  وهذا قرارها هي.
    if not is_owner() then
      select (value)::timestamptz into v_opens from content
       where ref = new.worksheet_id and field = 'opensAt';
      select (value)::timestamptz into v_due from content
       where ref = new.worksheet_id and field = 'dueAt';

      if v_opens is not null and now() < v_opens then
        raise exception 'لم يُفتح التسليم بعد — يُفتح في %',
          to_char(v_opens at time zone 'Asia/Kuwait', 'YYYY-MM-DD HH24:MI');
      end if;
      if v_due is not null and now() > v_due then
        raise exception 'أُغلق التسليم — كان آخر موعد %',
          to_char(v_due at time zone 'Asia/Kuwait', 'YYYY-MM-DD HH24:MI');
      end if;

      --  ═══ زمن الاختبار ═══
      --  حقل minutes في content يجعل الورقة مؤقَّتة: يُحسب الزمن من
      --  started_at الذي كتبه الخادم، فلا يُمدَّد بإعادة التحميل.
      --  ودقيقةٌ سماحٌ لبطء الشبكة عند الإرسال.
      select (value)::numeric into v_min from content
       where ref = new.worksheet_id and field = 'minutes';
      if v_min is not null and new.started_at is not null
         and now() > new.started_at + make_interval(secs => (v_min * 60 + 60)::int) then
        raise exception 'انتهى وقت الاختبار — كان % دقيقة من بدايتك', v_min;
      end if;
    end if;

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
  using (student_id in (select my_student_ids()));

-- ─── scheme: الجميع يقرأ التوزيعة (الطالبة ترى على أي أساس تُقيَّم)،
--             والمالكة وحدها تكتبها ───
--  «أي حساب» ليس قيدًا: إنشاء الحساب مجاني وعلني (sendLink بـ
--  create_user وبمفتاح anon المنشور). فالقراءة مقصورة على شعبة
--  الطالبة نفسها — وحسابٌ غير مرتبط بصفٍّ لا يرى شيئًا.
drop policy if exists scheme_read on scheme;
create policy scheme_read on scheme for select
  using (is_owner() or section_id in (select my_section_ids()));

drop policy if exists scheme_write on scheme;
create policy scheme_write on scheme for all
  using (is_owner()) with check (is_owner());

-- ─── schedule: الجميع يقرأ، والمالكة وحدها تكتب ───
drop policy if exists schedule_read on schedule;
create policy schedule_read on schedule for select
  using (is_owner() or section_id in (select my_section_ids()));

drop policy if exists schedule_write on schedule;
create policy schedule_write on schedule for all
  using (is_owner()) with check (is_owner());

-- ─── content: المالكة تكتب، وطالبات المقرر يقرأن ───
--  تقرأ الطالبة نصوص مقررها لأنها تراها في الورقة على كل حال.
--  ولا تقرأ نصوص مقرر لا تدرسه — ومفتاح الشعبة «المقرر:الشعبة»
--  فمنه يُعرف مقررها.
drop policy if exists content_read on content;
create policy content_read on content for select
  using (is_owner() or exists (
    select 1 from students s
     where s.auth_uid = auth.uid()
       and split_part(s.section_id, ':', 1) = content.course_id));

drop policy if exists content_write on content;
create policy content_write on content for all
  using (is_owner()) with check (is_owner());

-- ─── attend_codes: المالكة وحدها، ولا أحد غيرها ───
drop policy if exists attend_codes_owner on attend_codes;
create policy attend_codes_owner on attend_codes for all
  using (is_owner()) with check (is_owner());

-- ولا سياسة قراءةٍ للطالبة — وهذا هو الحارس، لا إخفاءُ الرمز.

-- ═══════════════════════════════════════════════════════════════
--  تسجيل الحضور بمسح الرمز
--
--  الطالبة لا تكتب في جدول الحضور مباشرةً (سياسة attendance_owner
--  وحدها تكتب)، فالكتابة كلها تمرّ من هنا. والدالة تحدّد بالضبط ما
--  يقع:
--    • الرمز يُطابَق كاملًا، ويُشترط أن يكون حيًّا (لم تمضِ ttl).
--    • الشعبة والمحاضرة من صفّ الرمز لا مما ترسله الطالبة — فلا
--      تسجّل حضورًا في محاضرةٍ أخرى ولا في شعبةٍ أخرى.
--    • والطالبة هي صاحبة الحساب الداخل، من كشف تلك الشعبة نفسها.
--      فحسابٌ غير مرتبط بالكشف لا يسجّل شيئًا.
--    • ولا تُنزَل «بعذر» إلى «حاضرة»: العذر قرارٌ من الدكتورة، ولو
--      حضرت بعده فالتصحيح بيدها.
-- ═══════════════════════════════════════════════════════════════
create or replace function mark_attendance(p_nonce text)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_sec text; v_ses int; v_day date; v_student text; v_old text;
begin
  select section_id, session into v_sec, v_ses
    from attend_codes
   where nonce = p_nonce
     and issued_at + make_interval(secs => ttl_sec) > now();
  if v_sec is null then
    raise exception 'انتهت صلاحية الرمز — امسحي الرمز الظاهر الآن على الشاشة';
  end if;

  --  s.id لا id: الجدولان كلاهما فيه عمود id، فالمجرَّد ملتبس.
  select s.id, a.status into v_student, v_old
    from students s
    left join attendance a
      on a.student_id = s.id and a.session = v_ses
   where s.section_id = v_sec and s.auth_uid = auth.uid()
   limit 1;

  if v_student is null then
    raise exception 'حسابك غير مرتبط بكشف هذه الشعبة — راجعي الدكتورة';
  end if;

  if v_old = 'excused' then return v_student; end if;   /* العذر لا يُنقض */

  select day into v_day from schedule
   where section_id = v_sec and session = v_ses;

  insert into attendance (id, student_id, section_id, session, day, status, at)
  values ('at-' || replace(gen_random_uuid()::text, '-', ''),
          v_student, v_sec, v_ses, coalesce(v_day, current_date), 'present',
          (extract(epoch from now()) * 1000)::bigint)
  on conflict (student_id, session) do update
    set status = 'present', at = excluded.at, day = excluded.day;

  return v_student;
end $$;

revoke all on function mark_attendance(text) from public;
grant execute on function mark_attendance(text) to authenticated;

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

  --  صفٌّ واحد في كل شعبة لا كل الصفوف ذات الرقم نفسه: التفرّد صار
  --  على (الحساب، الشعبة)، فتحديث صفّين في شعبةٍ واحدة بالحساب نفسه
  --  يرفع unique_violation فيُسقط إنشاء الحساب كلّه — والطالبة لا
  --  تستطيع الدخول إطلاقًا.
  --
  --  وتُربط صفوفها في كل مقرر لا في مقرر واحد: الطالبة تدرس أكثر من
  --  مقرر وحسابها واحد، فلو رُبط صفٌّ واحد بقيت في بقية مقرراتها
  --  بلا حساب — لا ترى حضورها ولا درجاتها فيها.
  --
  --  ويُلفّ الجسم فلا يمنع خللٌ في الكشف طالبةً من إنشاء حسابها.
  begin
    update students st
       set auth_uid = new.id, updated_at = now()
     where st.id in (
       select distinct on (section_id) id from students
        where uid = sid and auth_uid is null
        order by section_id, updated_at)
       and not exists (select 1 from students s2
                        where s2.auth_uid = new.id
                          and s2.section_id = st.section_id);
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

  --  «حسابٌ لم يُربط بعد» صارت «لم يُربط في هذه الشعبة»: الحساب
  --  الواحد يرتبط بصفٍّ في كل مقرر تدرسه صاحبته، وإنما المنع من
  --  صفّين لحسابٍ واحد في الشعبة الواحدة.
  select u.id into aid from auth.users u
   where lower(u.email) = 's' || new.uid || '@ku.edu.kw'
     and not exists (select 1 from students s2
                      where s2.auth_uid = u.id
                        and s2.section_id = new.section_id
                        and s2.id is distinct from new.id)
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
    using (bucket_id = 'tp-files' and (storage.foldername(name))[1] in (select my_student_ids()));
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
    with check (bucket_id = 'tp-files' and (storage.foldername(name))[1] in (select my_student_ids()));
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
           and (storage.foldername(name))[1] in (select my_student_ids())
           and not locked_file(name))
    with check (bucket_id = 'tp-files' and (storage.foldername(name))[1] in (select my_student_ids()));
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
           and (storage.foldername(name))[1] in (select my_student_ids())
           and not locked_file(name));
exception when insufficient_privilege or undefined_table or undefined_object then
  raise notice 'تُخطّي (صلاحية التخزين): %', sqlerrm;
end $$;

-- ═══════════════════════════════════════════════════════════════
--  ترقية سجلات ما قبل تعدّد المقررات
--
--  صار مفتاح الشعبة «المقرر:الشعبة» — «wilaya:1» لا «1» — وهو
--  أساس الفصل بين المقررات في المنصة كلها. والسجلات التي كُتبت قبل
--  ذلك مفاتيحها بلا مقرر، فتُنسب إلى مقرر الولاية الخاصة، وهو
--  المقرر الوحيد الذي كان.
--
--  الشرط «بلا نقطتين» يجعل التشغيل المكرَّر بلا أثر: ما رُقّي مرةً
--  لا يُرقّى ثانية، ولا يصير «wilaya:wilaya:1».
--  وعلى قاعدةٍ جديدة الجداولُ فارغة فلا يتغير شيء.
-- ═══════════════════════════════════════════════════════════════
do $$
declare n int; t text;
begin
  foreach t in array array['students','events','attendance','grades','schedule','scheme'] loop
    execute format(
      'update %I set section_id = ''wilaya:'' || section_id where position('':'' in section_id) = 0', t);
    get diagnostics n = row_count;
    if n > 0 then raise notice 'رُقّي %: % سجلًّا', t, n; end if;
  end loop;

  --  ومعرّف ورقة العمل كذلك: صار «wilaya:w5» فلا يلتبس بورقةٍ
  --  تحمل الرقم نفسه في مقرر آخر.
  update submissions set worksheet_id = 'wilaya:' || worksheet_id
   where position(':' in worksheet_id) = 0;
  get diagnostics n = row_count;
  if n > 0 then raise notice 'رُقّي submissions: % تسليمًا', n; end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
--  إجابات الطالبات على أسئلة المحاضرة
--
--  شرائح الأسئلة كانت تُعرض وتُكشف إجابتها، والطالبات يُجِبن شفاهًا.
--  فلا تعرف الدكتورة كم فهم قبل أن تكشف — ومن أصابت بعد الكشف لا
--  يُعرف أأصابت أم وافقت.
--
--  فصارت الطالبة تضغط الخيار على جهازها، وترى الدكتورة على شاشتها
--  كم أجابت وكم أصابت وأيُّ خيارٍ خاطئٍ جذبهنّ — قبل أن تكشف.
--
--  ═══ ولا تُخزَّن «صحيحة» ═══
--  يُخزَّن الخيارُ المضغوط لا صوابُه. فالصوابُ يُعرف من الشريحة
--  نفسها عند العرض، ولو خُزّن لاستطاعت الطالبةُ أن ترسل «أصبتُ».
--
--  ═══ ولا ترى الطالبةُ إجابات زميلاتها ═══
--  وإلا لصار الجوابُ نقلًا. ترى إجابتها وحدها، والحصيلةُ على شاشة
--  الدكتورة.
-- ═══════════════════════════════════════════════════════════════
create table if not exists replies (
  id         text primary key,
  student_id text not null references students(id) on delete cascade,
  section_id text not null,
  session    int  not null,
  q          int  not null,
  choice     int  not null,
  at         timestamptz not null default now()
);
--  جوابٌ واحد لكل (طالبة، محاضرة، سؤال): تبديلُ رأيها يُحدِّث صفَّها
--  ولا يضيف صفًّا ثانيًا، فلا تُعَدّ مرتين في الحصيلة.
create unique index if not exists replies_one
  on replies (student_id, session, q);
create index if not exists replies_tally on replies (section_id, session, q);

alter table replies enable row level security;

drop policy if exists replies_owner on replies;
create policy replies_owner on replies for all
  using (is_owner()) with check (is_owner());

drop policy if exists replies_self on replies;
create policy replies_self on replies for select
  using (student_id in (select my_student_ids()));

drop policy if exists replies_self_write on replies;
create policy replies_self_write on replies for insert
  with check (student_id in (select my_student_ids()));

drop policy if exists replies_self_update on replies;
create policy replies_self_update on replies for update
  using (student_id in (select my_student_ids()))
  with check (student_id in (select my_student_ids()));

--  ووقتُ الإجابة يُختم في الخادم: هو ما يُفرّق من أجابت في وقتها
--  ممّن أجابت بعد كشف الجواب.
create or replace function stamp_reply() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.at := now();
  return new;
end $$;

drop trigger if exists on_reply_saved on replies;
create trigger on_reply_saved before insert or update on replies
  for each row execute function stamp_reply();

-- ═══════════════════════════════════════════════════════════════
--  أعمال الطالبات — تطوّعٌ لا درجة
--
--  تُنشئ الطالبة عملًا متى شاءت: عنوانٌ ووصفٌ وملفّ (صورة أو PDF).
--  لا موعدَ ولا درجة — فمن لم ترفع شيئًا لم يُنقص منها.
--
--  ═══ والإذن بالعرض بيدها ═══
--  shared: أتأذن بعرضه على الشاشة أمام زميلاتها؟ والأصل «لا».
--  فالدكتورة ترى العمل كلَّه — لأنها مدرِّسته — ولا تعرض إلا ما
--  أُذن فيه. وعرضُ عمل طالبةٍ أمام صفّها قرارٌ يخصّها، فلا يُؤخذ
--  ضمنًا من مجرّد رفعها إيّاه.
--
--  والملفّ نفسه في صندوق tp-files تحت مجلّد الطالبة، تحرسه سياساتُ
--  التخزين القائمة: مسارُه يبدأ بمعرّف صفّها، فلا ترفع في مجلّد
--  غيرها ولا تقرأ منه.
-- ═══════════════════════════════════════════════════════════════
create table if not exists works (
  id         text primary key,
  student_id text not null references students(id) on delete cascade,
  section_id text not null,
  title      text not null,
  note       text,
  file_id    text,
  file_name  text,
  file_type  text,
  shared     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists works_section on works (section_id, created_at desc);
create index if not exists works_student on works (student_id);

alter table works enable row level security;

-- المالكة ترى أعمال طالباتها كلَّها وتحذف ما لا يصلح
drop policy if exists works_owner on works;
create policy works_owner on works for all
  using (is_owner()) with check (is_owner());

-- والطالبة ترى عملها وحده — لا أعمال زميلاتها ولو أُذن بعرضها.
-- العرضُ في القاعة من جهاز الدكتورة، لا من أجهزتهنّ.
drop policy if exists works_self on works;
create policy works_self on works for select
  using (student_id in (select my_student_ids()));

drop policy if exists works_self_write on works;
create policy works_self_write on works for insert
  with check (student_id in (select my_student_ids()));

--  وتعدّل عملها وتسحب إذنها متى شاءت.
drop policy if exists works_self_update on works;
create policy works_self_update on works for update
  using (student_id in (select my_student_ids()))
  with check (student_id in (select my_student_ids()));

drop policy if exists works_self_delete on works;
create policy works_self_delete on works for delete
  using (student_id in (select my_student_ids()));

--  ووقتُ الإنشاء يُختم في الخادم لا يُرسَل من المتصفّح.
create or replace function stamp_work() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then new.created_at := now(); end if;
  return new;
end $$;

drop trigger if exists on_work_saved on works;
create trigger on_work_saved before insert on works
  for each row execute function stamp_work();

-- ═══════════════════════════════════════════════════════════════
--  إعادة تعيين كلمة سرّ طالبة — بيد الدكتورة، بلا رسالة بريد
--
--  المشكلة: أطفأنا رسائل البريد بالقصد (خدمة Supabase المدمجة
--  محدودةٌ بعددٍ صغير في الساعة، فلو طلبت عشرون طالبةً في محاضرةٍ
--  واحدة لم يصل أكثرهنّ شيء). فمن نسيت كلمتها لم يكن لها طريق.
--
--  والطريق الخاطئ: مفتاح service_role في المتصفّح. هو مفتاحٌ يتخطّى
--  RLS كلَّه، ومن نسخه من مصدر الصفحة ملك القاعدة كلَّها. فلا يوضع
--  في متصفّحٍ أبدًا، ولا في ملفٍّ علنيّ.
--
--  والطريق الصحيح هنا: دالّةٌ تعمل بصلاحية مالك القاعدة في الخادم،
--  والطالبة لا تملك استدعاءها — كما في join_class وmark_attendance.
--  فالصلاحية في الخادم لا في المفتاح.
--
--  ═══ ما تحرسه ═══
--    • المالكة وحدها تستدعيها (is_owner)، وغيرُها يُردّ.
--    • ولا تُعيد تعيين كلمة سرّ مالكةٍ أخرى — فلا يصير المشرفُ
--      التقنيّ طريقًا إلى حساب الدكتورة، ولا العكس.
--    • ولا تعمل إلا على صفٍّ في الكشف مربوطٍ بحساب.
--    • وتُبطل الجلسات القائمة لذلك الحساب: من كان داخلًا بكلمة السر
--      القديمة خرج. بلا هذا تبقى جلسةُ جهازٍ ضائعٍ حيّةً بعد
--      التبديل، والتبديلُ إنما كان لأجلها أحيانًا.
--    • ولا تُرجع شيئًا عن الحساب — لا بريده ولا معرّفه.
--
--  والتعمية bcrypt هي نفسها التي يستعملها GoTrue، فالكلمةُ
--  المكتوبة بها تعمل في الدخول كأنها كُتبت منه.
-- ═══════════════════════════════════════════════════════════════
create extension if not exists pgcrypto with schema extensions;

create or replace function reset_student_password(p_student text, p_new text)
returns void
language plpgsql security definer
set search_path = public, auth, extensions, pg_temp as $$
declare v_uid uuid;
begin
  if not is_owner() then
    raise exception 'لا صلاحية لهذا الإجراء';
  end if;
  if p_new is null or length(p_new) < 8 then
    raise exception 'كلمة السر ثمانية أحرف فأكثر';
  end if;

  select auth_uid into v_uid from students where id = p_student;

  if v_uid is null then
    raise exception 'هذا الصفّ غير مربوطٍ بحساب. تدخل الطالبة ببريدها فيُنشأ حسابها.';
  end if;

  --  حسابُ مالكةٍ لا يُمسّ من هنا. ولولا هذا لصار الإجراءُ طريقًا
  --  جانبيًّا إلى حسابٍ أعلى: يُربط صفٌّ في الكشف بحساب الدكتورة،
  --  ثم «يُعاد تعيين كلمة سرّ الطالبة».
  if exists (select 1 from owners where uid = v_uid) then
    raise exception 'هذا الحساب حسابُ مالكة، ولا يُبدَّل من هنا';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_new, extensions.gen_salt('bf')),
         updated_at = now()
   where id = v_uid;

  --  الجلساتُ القائمة تُبطَل: تبديلُ الكلمة وحده لا يُخرج من كان
  --  داخلًا، ورمزُ التجديد يبقى صالحًا شهورًا.
  delete from auth.refresh_tokens where user_id = v_uid::text;
end $$;

revoke all on function reset_student_password(text, text) from public;
grant execute on function reset_student_password(text, text) to authenticated;

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
