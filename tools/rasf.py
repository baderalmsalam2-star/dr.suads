# -*- coding: utf-8 -*-
"""يرصف شرائح المحاضرات: يضمّ المبتور، ويردّ ما ليس بعنوانٍ إلى متنه.

═══ العطبان ═══

١) أربعون بالمئة من شرائح المتن (٢٩٣ من ٧٢٧) تحمل أقلَّ من مئةٍ
   وعشرين حرفًا — سطرًا واحدًا في وسط شاشةٍ فارغة. والمولّد لا يقسم
   إلا ما جاوز ٦٢٠ حرفًا، فكلُّ فقرةٍ قصيرةٍ في المذكرة صارت شريحةً
   قائمةً بنفسها. فثلاثٌ وثلاثون موضعًا فيها عنوانٌ واحد يتكرّر على
   أربع شرائح فأكثر — تسعٌ منها في «واستدل الجمهور على ذلك بما يأتي»،
   وثمانٍ في «وبناءً على هذا الأصل قال الزركشي».

٢) وبعض العناوين ليست عناوين. head_of في المولّد يقطع كلَّ ما قبل
   النقطتين ويجعله عنوانًا، فصار «وقوله صلى الله عليه وسلم:» عنوانًا
   والحديثُ متنًا. وهذا يُحدث ما هو أسوأ من القبح: الجملة التالية
   تُنسب إلى عنوانٍ ليس لها. في المحاضرة الثالثة شريحةٌ عنوانها
   «وقوله صلى الله عليه وسلم» ومتنُها «والنوع الأول هو المشهور
   والمتبادر عند الإطلاق في لغة الفقهاء» — وهي خاتمة الأنواع الثلاثة
   لا شرحُ حديث.

═══ لماذا قائمةٌ بأسمائها لا قاعدة ═══

الفرق بين «وقوله عليه الصلاة والسلام» (ليس عنوانًا) و«وقوله
(وتنفيذها)» (عنوانٌ صحيح: يسمّي لفظ التعريف الذي تشرحه خمسُ شرائح)
لا تلتقطه قاعدةٌ نظيفة. و«أما السنة» و«وأما المعتوه» عناوين صحيحة
وإن بدت جُملًا. فالتخمين هنا يُفسد عنوانًا سليمًا، وهو ضررٌ لا يقلّ.
فأُحصيت المواضع بأسمائها — خمسةٌ وثلاثون ومئتا شريحةٍ قُرئت عناوينُها
واحدًا واحدًا — ولم يُمسّ ما لم يُذكر في DEMOTE.

═══ ولا تُفقد كلمة ═══

الردّ لا يحذف: نصُّ العنوان يعود إلى أول متنه، والشريحة ترث العنوان
الموضوعيَّ الذي قبلها. ويُجرَّد من التشكيل عند ردّه، لأن المتن غير
مشكَّل والعنوان مشكَّل — فلو رُدَّ بتشكيله لنشز.

ويُردّ مرةً واحدة: العنوان يُنتزع من فقرةٍ واحدة في المذكرة ثم يبقى
«ساريًا» على ما بعدها في المولّد. فلو حُقن في كل شريحةٍ حملته
لتكرّر ما لم يتكرّر في المذكرة.

    python3 tools/rasf.py [معرّف-المقرر]     (الافتراضي wilaya)
    python3 tools/rasf.py --فحص              يقيس ولا يكتب
"""
import glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIMIT = 620          # نفس حدّ MAX_SLIDE في build_sessions.py
DIGITS = '٠١٢٣٤٥٦٧٨٩'


def ar(n):
    return ''.join(DIGITS[int(c)] if c.isdigit() else c for c in str(n))


def bare(t):
    """يجرّد التشكيل ليُقارن العنوان بالقائمة."""
    return re.sub(r'[ً-ْٰـ]', '', t).strip()


#  ما ليس بعنوان: مُدخِلاتُ نقلٍ واستدلال، قُرئت واحدةً واحدة.
#  المقياس: أيصلح أن يُكتب في أعلى الشريحة وحده فيدلّ على موضوعها؟
#  «وقوله عليه الصلاة والسلام» لا يدلّ على شيء — يدلّ على أن ثَمّ
#  نقلًا، لا على ما فيه.
DEMOTE = {
    'وقوله صلى الله عليه وسلم',
    'وقوله عليه الصلاة والسلام',
    'قوله تعالى',
    'لقوله صلى الله عليه وسلم',
    'والأصل في ذلك قوله تعالى',
    '١- قوله عليه الصلاة والسلام',
    '٢- وقوله صلى الله عليه وسلم',
    '٢- وقوله تعالى ﴿ حتى تنكح زوۡجا غيۡرهۥ ﴾',
    'وبناء على هذا الأصل قال الزركشي',
    'وإذا قال الرجل',
    'فلو قال له',
    '١- عن أبي موسى قال',
    '٢- عن عائشة قالت',
    '٣- عن عمرو بن شعيب عن أبيه عن جده قال',
    '٤- وعن ابن عمر رضي الله عنهما قال',
    '١- قال ابن عمر رضي الله عنهما لرجل',
    '٢- وقال عبد الله بن مسعود رضي الله عنه',
    'ولأن الله عز وجل أخبر عن أهل الكهف أنهم قالوا',
    'وقالوا',
    'وقالوا في الأصح',
    'واستدلوا بقول النبي صلى الله عليه وسلم',
    'واستدل لهذا القول بقول النبي صلى الله عليه وسلم',
    'وروي عن ابن مسعود والثوري والأوزاعي أنهم قالوا',
}

SEC = re.compile(r'( *)<section class="slide"([^>]*)>(.*?)</section>', re.S)

#  الشكل الذي يخرجه build_sessions.py لشريحة قراءة، لا غير: عنوانٌ
#  ثم متنٌ فيه فقراتٌ وحدها. ما لم يطابقه حرفًا بحرف فهو مكتوبٌ بيدٍ
#  — كشرائح المحاضرة الأولى: فيها <ul> و<div class="note"> وجداول —
#  فلا يُفكَّك ولا يُعاد بناؤه، بل يُمرَّر كما هو.
#
#  وهذا درسٌ دفعتُ ثمنه: أول صياغةٍ كانت تعيد بناء كل شريحةٍ فيها
#  data-reader من (العنوان + الفقرات)، فأفرغت خمس شرائح في المحاضرة
#  الأولى: متنُها ليس في <p> فلم تلتقطه، فكتبت مكانه فراغًا.
SHAPE = re.compile(
    r'^\s*<div class="rubric">(?P<rub>.*?)</div>\s*'
    r'<div class="matn flow">\s*(?P<body>(?:<p>.*?</p>\s*)+)</div>\s*$', re.S)
PARA = re.compile(r'<p>(.*?)</p>', re.S)


def plain(html):
    return re.sub(r'\s+', ' ', re.sub('<[^>]+>', '', html)).strip()


class Slide:
    #  lead: ما بين الشريحة وسابقتها حرفيًّا — تعليقاتُ الترقيم في
    #  المحاضرة الأولى مكتوبةٌ بيدٍ، وإعادةُ البناء من الشرائح وحدها
    #  تُسقطها. فتُحمَل مع شريحتها وتُعاد معها.
    def __init__(self, indent, attr, inner, lead=''):
        self.indent, self.attr, self.inner, self.lead = indent, attr, inner, lead
        m = SHAPE.match(inner) if 'data-reader' in attr else None
        #  «قابلة» لا «قارئة»: الشرط أن نعرف كيف نعيد بناءها كما كانت.
        self.ok = m is not None
        self.rubric = m.group('rub').strip() if m else None
        self.paras = PARA.findall(m.group('body')) if m else []
        self.reader = 'data-reader' in attr

    def text(self):
        return ' '.join(plain(p) for p in self.paras)

    def render(self):
        if not self.ok:
            return self.indent + '<section class="slide"%s>%s</section>' % (self.attr, self.inner)

        body = '\n'.join('          <p>%s</p>' % p for p in self.paras)
        return ('%s<section class="slide"%s>\n'
                '        <div class="rubric">%s</div>\n'
                '        <div class="matn flow">\n%s\n        </div>\n'
                '      </section>' % (self.indent, self.attr, self.rubric, body))


def split_rubric(rub):
    """«سياق · فرع — تتمة» يُفكّ إلى أجزائه.

    و«تتمة» تُطلب مجرّدةً من التشكيل: أداةُ التشكيل شكّلتها في
    العناوين فصارت «— تَتِمَّة»، فمطابقةُ الحرف تُخطئها — فتُحسَب
    جزءًا من الفرع، فلا تُضمّ الشريحةُ بما قبلها وهي تتمّتُه."""
    m = re.search(r'\s*—\s*تتمة\s*$', bare(rub))
    tail = ''
    core = rub
    if m:
        cut = re.search(r'\s*—\s*[\u0621-\u064A\u064B-\u0652\u0670]+\s*$', rub)
        if cut:
            tail, core = rub[cut.start():], rub[:cut.start()]
    if ' · ' in core:
        head, rest = core.split(' · ', 1)
        return head, rest, tail
    return core, None, tail


def demote(slides):
    """يردّ ما ليس بعنوانٍ إلى متنه، ويورّث الشريحةَ عنوانَ ما قبلها."""
    last_core = last_head = None
    injected = set()
    order = []
    moved = 0
    for s in slides:
        if not s.ok:
            continue
        head, rest, tail = split_rubric(s.rubric)
        b = bare(head)
        if b not in DEMOTE:
            last_head = head
            last_core = head + (' · ' + rest if rest else '')
            continue
        #  يُحقن نصُّ العنوان مرةً واحدة: عند أول شريحةٍ حملته.
        if b not in injected:
            injected.add(b)
            order.append(b)
            s.injected = b
            if s.paras:
                s.paras[0] = b + ': ' + s.paras[0]
            else:
                s.paras = [b + ':']
            moved += 1
        #  بلا فرعٍ خاصٍّ بها ترث العنوانَ الذي قبلها كاملًا — بسياقه
        #  وفرعه — فلا تبدو قطعًا جديدًا وهي تتمّة ما قبلها. ومع فرعٍ
        #  خاصّ («وقالوا · الرأي الأول») يُبدَّل السياقُ وحده.
        if rest:
            s.rubric = (last_head or head) + ' · ' + rest + tail
        else:
            s.rubric = (last_core or head) + tail
    return moved, order


#  علاماتُ تمامِ الجملة، وعلاماتُ ابتداءِ جملةٍ جديدة.
SENT_END = re.compile(r'[.؟!:؛"»﴾\)\]]\s*$')
NEW_ITEM = re.compile(r'^\s*(?:[٠-٩0-9]+\s*[-–ـ]|[أ-ي]\s*[-–ـ]\s|﴿|«|\()')
#  الواو والفاء وثمّ تبتدئ جملةً في العربية، فلا يُوصَل بها ما قبلها.
NEW_SENT = re.compile(r'^\s*(?:و|ف|ثم|أما|بل|لكن|غير\s+أن)')


def weld(paras):
    """يصل الفقرتين إذا كانت الثانية تتمّةَ جملةِ الأولى.

    مذكرةُ الدكتورة مكتوبةٌ في Word بأسطرٍ مقطوعةٍ باليد: السطرُ
    الواحد فقرةٌ مستقلّة وإن كان نصفَ جملة. فصار المولّد يقرأ
    «وردت أحاديث كثيرة تأمر الوالدين بالقيام على تعليم وتأديب»
    فقرةً، و«أولادهم، وتحثهم على الاضطلاع بهذه المهمة العظيمة»
    فقرةً أخرى — فتُعرضان شريحتين، والجملةُ واحدة.

    والوصلُ بشرطين: ألّا تنتهي الأولى بعلامةِ تمام، وألّا تبتدئ
    الثانيةُ بما يبتدئ به كلامٌ جديد — رقمُ بندٍ، أو آيةٌ، أو واوٌ
    أو فاءٌ أو «ثم». فـ«…والله أعلم ⏎ وقد استعمل جل الفقهاء» لا
    تُوصل، وإن خلت الأولى من نقطة."""
    out = []
    for para in paras:
        if (out and not SENT_END.search(plain(out[-1]))
                and not NEW_ITEM.match(plain(para))
                and not NEW_SENT.match(plain(para))):
            out[-1] = out[-1].rstrip() + ' ' + para.lstrip()
            continue
        out.append(para)
    return out


def pack(slides):
    """يجمع المتجاور تحت العنوان الواحد، يصل جُمَله، ثم يعيد قسمته.

    الجمعُ وحده لا يكفي: لو ضُمّت شريحتان بقيت فقرتاهما فقرتين،
    والجملةُ المقطوعةُ بينهما مقطوعةٌ كما كانت — وإنما انتقل القطعُ
    من بين شريحتين إلى بين فقرتين. فتُجمع الفقراتُ أولًا، وتُوصل
    جُمَلُها، ثم تُقسَم من جديد عند حدود الفقرات لا وسط الجُمَل.

    ولا يُتخطّى سؤالٌ ولا شريحةٌ لا تعرفها الأداة: موضع السؤال
    مقصود — وُزّع على شرائح القراءة بالتساوي — فالجمعُ عبره يزحزحه.

    والعنوانُ كلُّه شرطٌ لا صدرُه: «الوصي · القول الأول» و«الوصي ·
    القول الثاني» يشتركان في صدرهما ولا يُجمعان، وإلا ابتلع أحدُ
    القولين الآخر تحت عنوانه."""
    out, merged = [], 0
    runs = []
    for s in slides:
        if (s.ok and runs and runs[-1] and runs[-1][-1].ok
                and split_rubric(runs[-1][-1].rubric or '')[:2]
                == split_rubric(s.rubric or '')[:2]):
            runs[-1].append(s)
        else:
            runs.append([s])

    for run in runs:
        if not run[0].ok:
            out.extend(run)
            continue
        paras = weld([q for x in run for q in x.paras])
        #  قسمةٌ عند حدود الفقرات: الفقرةُ لا تُشقّ ولو طالت وحدها.
        groups, cur, n = [], [], 0
        for q in paras:
            ln = len(plain(q))
            if cur and n + 1 + ln > LIMIT:
                groups.append(cur)
                cur, n = [q], ln
            else:
                cur.append(q)
                n += (1 if cur[:-1] else 0) + ln
        if cur:
            groups.append(cur)

        head = run[0]
        for k, g in enumerate(groups):
            if k == 0:
                head.paras = g
                head.absorbed = [x.rubric for x in run[1:]]
                out.append(head)
            else:
                nxt = Slide(head.indent, head.attr, head.inner, '\n\n')
                nxt.ok, nxt.reader = True, head.reader
                nxt.rubric, nxt.paras = head.rubric, g
                out.append(nxt)
        merged += len(run) - len(groups)
    return out, merged


SEQ = r'(?:أولا|ثانيا|ثالثا|رابعا|خامسا|سادسا|سابعا|ثامنا|تاسعا|عاشرا)ً?'


def unnest(slides):
    """يفكّ ترتيبًا عُلِّق على ترتيب: «ثانيًا: … · ثالثًا».

    المذكرة تعدّ الأدلة: أولًا من القرآن، ثانيًا من السنة، ثالثًا من
    أقوال الصحابة. والمولّد يحسب «ثالثًا» فرعًا لما قبله فيعلّقه
    عليه، فتخرج شريحةٌ متنُها في أقوال الصحابة وعنوانُها «ثانيًا:
    الدليل من السنة النبوية». وهذا عنوانٌ كاذب لا ناقص: تقرؤه
    الدكتورة فتظنّ نفسها في بابٍ وهي في غيره.

    فيُفكّ التعليق. وإن كانت أولُ فقرةٍ عنوانًا في نفسها — تنتهي
    بنقطتين وتقصر — رُفعت لتكون عنوانَ الشريحة. وإلا بقي الترتيبُ
    وحده: «ثالثًا» أقلُّ دلالةً من عنوانٍ تامّ، لكنه صادق."""
    fixed = 0
    for s_ in slides:
        if not s_.ok or not s_.rubric:
            continue
        head, rest, tail = split_rubric(s_.rubric)
        if not rest:
            continue
        b_head, b_rest = bare(head), bare(rest)
        if not (re.match('^' + SEQ, b_head) and re.match('^' + SEQ + '$', b_rest)):
            continue
        lead = plain(s_.paras[0]) if s_.paras else ''
        if lead.endswith(':') and len(lead) <= 90:
            s_.rubric = rest + ': ' + lead[:-1].strip() + tail
            s_.paras = s_.paras[1:]
        else:
            s_.rubric = rest + tail
        fixed += 1
    return fixed


def tidy(slides):
    """«— تتمة» لا تبقى على شريحةٍ لا تتمّة قبلها."""
    fixed = 0
    prev_head = None
    for s in slides:
        if not s.ok:
            prev_head = None
            continue
        head, rest, tail = split_rubric(s.rubric)
        if tail and head != prev_head:
            s.rubric = head + (' · ' + rest if rest else '')
            fixed += 1
        prev_head = head
    return fixed


RUBDIV = re.compile(r'<div class="rubric">.*?</div>', re.S)


def bodies(html_sections):
    """متنُ الشرائح كلِّها — القابلةِ وغيرِها — بلا سطور العناوين.

    العناوين تُستثنى لأن الردّ يبدّلها بالقصد؛ والمتنُ لا يُبدَّل
    إلا بزيادة نصِّ عنوانٍ رُدَّ إليه. فهذا هو الموضع الذي يُقاس."""
    return ' '.join(plain(RUBDIV.sub(' ', x)) for x in html_sections)


def process(path, dry):
    src = open(path, encoding='utf-8').read()
    spans = list(SEC.finditer(src))
    slides = []
    for i, m in enumerate(spans):
        lead = src[spans[i - 1].end():m.start()] if i else ''
        slides.append(Slide(m.group(1), m.group(2), m.group(3), lead))
    slides0 = list(slides)
    whole_before = bodies([m.group(3) for m in spans])

    before = [s.text() for s in slides if s.ok]
    orig = {id(x): x.text() for x in slides if x.ok}
    moved, injected_texts = demote(slides)
    for x in slides:
        if not x.ok:
            continue
        want_one = (x.injected + ': ' if getattr(x, 'injected', None) else '') + orig[id(x)]
        if x.text() != want_one:
            raise SystemExit('✗ %s: اختلّ ردُّ عنوانٍ إلى متنه' % os.path.basename(path))

    #  بعد حارسِ الردّ: فكُّ التعليق قد يرفع فقرةً إلى العنوان، فينقص
    #  المتنُ بمقدارها — وهو نقصٌ مقصود، والفقرةُ لم تُحذف بل صعدت.
    unnested = unnest(slides)
    want = [s.text() for s in slides if s.ok]   # بعد الردّ وفكّ التعليق      # بعد الردّ، قبل الضمّ
    slides, merged = pack(slides)
    fixed = tidy(slides)
    after = [s.text() for s in slides if s.ok]

    #  حارسٌ ثانٍ: لا يُضمّ متنٌ إلى عنوانٍ غيرِ عنوانه. الأول يحرس
    #  الكلمات، وهذا يحرس نسبتها — وضياعُ النسبة لا يظهر في عدّ
    #  الحروف: «القول الأول» يبتلع «القول الثاني» والمتنُ كلُّه باقٍ.
    for s_ in slides:
        core = split_rubric(s_.rubric or '')[:2]
        for got in getattr(s_, 'absorbed', []):
            if split_rubric(got or '')[:2] != core:
                raise SystemExit('✗ %s: ضُمّ «%s» تحت «%s»'
                                 % (os.path.basename(path), got, s_.rubric))

    #  الحارس: لا كلمةَ تُفقد ولا تُزحزح. يُقارن المتنُ كلُّه موصولًا.
    if ' '.join(want) != ' '.join(after):
        raise SystemExit('✗ %s: تبدّل المتن عند الضمّ' % os.path.basename(path))
    #  العناوين تدخل الميزان: فكُّ التعليق قد يرفع فقرةً من المتن إلى
    #  العنوان، فتُعدّ ضائعةً وهي صاعدة.
    pool = ' '.join(after) + ' ' + ' '.join(plain(x.rubric or '') for x in slides if x.ok)
    #  والنقطتان تسقطان عند الرفع — عنوانٌ لا ينتهي بنقطتين — فتُطرح
    #  من الميزان في الجهتين.
    pool = pool.replace(':', '')
    lost = [w for w in ' '.join(before).replace(':', '').split() if w not in pool]
    if lost:
        raise SystemExit('✗ %s: ضاع من المتن: %s' % (os.path.basename(path), lost[:5]))

    #  ما قبل أول شريحةٍ مُطابِقة يخرج كما هو — وفيه الغلاف: صنفُه
    #  «slide on» لا «slide»، فلا يطابقه SEC أصلًا. وlead يحمل ما بين
    #  كل شريحةٍ وسابقتها، فما لم تعرفه الأداةُ بينهما يمرّ حرفيًّا.
    #  ولا يُقلَّم شيء: المسافةُ البادئة جزءٌ من render.
    body = ''.join(x.lead + x.render() for x in slides)
    out = src[:spans[0].start()] + body + src[spans[-1].end():]

    #  الحارس الأخير: نصُّ الملف بعد إعادة البناء كنصِّه قبلها، حرفًا
    #  بحرف بعد طيّ الفراغ. يفحص الشرائح كلَّها — القابلة وغيرها —
    #  فلو أُفرغت شريحةٌ لا تعرفها الأداةُ لظهر هنا.
    #  ما لا تعرفه الأداة يخرج كما دخل، حرفًا بحرف. وهذا هو الحارس
    #  الذي كان ينقصني: أولُ صياغةٍ أفرغت خمس شرائح في المحاضرة
    #  الأولى — متنُها ليس في <p> — ومرّت الفحوصَ كلَّها، لأنها كانت
    #  تقيس ما تعرفه الأداةُ وحده.
    for s_, m_ in zip(slides0, spans):
        if not s_.ok and s_.render() != m_.group(0):
            raise SystemExit('✗ %s: مُسّت شريحةٌ ليست من شكل المولّد'
                             % os.path.basename(path))

    if not dry:
        open(path, 'w', encoding='utf-8').write(out)
    return (sum(1 for x in slides0 if x.reader), sum(1 for x in slides if x.reader),
            moved, merged, fixed, unnested)


def main(course='wilaya', dry=False):
    files = sorted(glob.glob(os.path.join(ROOT, 'sessions', course, '*.html')))
    if not files:
        raise SystemExit('لا محاضرات للمقرر %s' % course)
    tot = [0, 0, 0, 0, 0, 0]
    counts = {}
    for p in files:
        b, a, mo, me, fx, un = process(p, dry)
        num = int(re.match(r'(\d+)-', os.path.basename(p)).group(1))
        counts[num] = a
        for i, v in enumerate((b, a, mo, me, fx, un)):
            tot[i] += v
    print('شرائح القراءة: %d ← %d' % (tot[0], tot[1]))
    print('رُدّ إلى المتن: %d عنوانًا · ضُمّ: %d شريحة · صُحّح: %d «تتمة»'
          % (tot[2], tot[3], tot[4]))
    print('فُكّ تعليقُ ترتيبٍ على ترتيب: %d عنوانًا' % tot[5])

    #  عدد القارئات في course.js يتبع عدد الشرائح، فيُصحَّح معه.
    cj = os.path.join(ROOT, 'data', 'courses', course, 'course.js')
    txt = open(cj, encoding='utf-8').read()
    hit = 0
    for num, n in counts.items():
        pat = re.compile(r'(file: "sessions/%s/%02d-[^"]*",\s*readers: )\d+' % (course, num))
        txt, k = pat.subn(lambda m: m.group(1) + str(n), txt)
        hit += k
    if not dry:
        open(cj, 'w', encoding='utf-8').write(txt)
    print('course.js: %d محاضرةً صُحّح عدد قارئاتها' % hit)
    return tot


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    main(args[0] if args else 'wilaya', dry='--فحص' in sys.argv or '--dry' in sys.argv)
