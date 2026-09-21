# -*- coding: utf-8 -*-
"""يبني ملفات المحاضرات من نص المذكرة وخطة التقسيم.

كل كلمة في الخرج مأخوذة من المذكرة حرفيًا؛ الخطة تحدد التقسيم
والعناوين والأسئلة فقط. شغّله من جذر المشروع:

    python3 tools/build_sessions.py مذكرة.docx [معرّف-المقرر]

المقرر الافتراضي wilaya. وكل مقرر له:
    tools/courses/<المقرر>/plan-*.json     خطة تقسيم محاضراته
    data/courses/<المقرر>/course.js        بياناته — يُكتب فيه sessions
    data/courses/<المقرر>/worksheets.js    أوراق عمله — تُكتب فيه
    sessions/<المقرر>/NN-*.html            ملفات محاضراته
"""
import glob, io, json, os, re, sys, zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_SLIDE = 620          # أقصى عدد حروف في الشريحة الواحدة
DIGITS = '٠١٢٣٤٥٦٧٨٩'
LETTERS = ['أ', 'ب', 'ج', 'د']


def ar(n):
    return ''.join(DIGITS[int(c)] if c.isdigit() else c for c in str(n))


# ───────────────────────── استخراج نص المذكرة ─────────────────────────
def read_docx(path):
    root = ET.fromstring(zipfile.ZipFile(path).read('word/document.xml'))
    out = []

    def text_of(p):
        parts = []
        for node in p.iter():
            if node.tag == W + 't' and node.text:
                parts.append(node.text)
            elif node.tag in (W + 'tab', W + 'br', W + 'cr'):
                parts.append(' ')
        return re.sub(r'\s+', ' ', ''.join(parts)).strip()

    def walk(el):
        for ch in el:
            if ch.tag == W + 'p':
                out.append(text_of(ch))
            elif ch.tag in (W + 'tbl', W + 'tr', W + 'tc', W + 'sdt', W + 'sdtContent'):
                walk(ch)
    walk(root.find(W + 'body'))
    return out


# ───────────────────────── تنظيف النص ─────────────────────────
def clean(t):
    t = re.sub(r'\(\s*\)', '', t)              # علامات الحواشي الفارغة ()
    t = re.sub(r'\s+([،.:؛؟!])', r'\1', t)     # مسافة قبل علامة الترقيم
    t = re.sub(r'([،؛])(?=\S)', r'\1 ', t)
    t = re.sub(r'\s{2,}', ' ', t)
    return t.strip()


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def highlight(t):
    """يلوّن الآيات بالأزرق كما في المحاضرة الأولى."""
    t = esc(t)
    t = re.sub(r'﴿([^﴾]{1,400})﴾', r'<span class="q">﴿\1﴾</span>', t)
    t = re.sub(r'\{([^{}]{1,400})\}', r'<span class="q">﴿\1﴾</span>', t)
    return t


SENT_END = re.compile(r'(?<=[.؟!])\s+')


def chunks(text, limit=MAX_SLIDE):
    """يقسّم فقرة طويلة إلى شرائح عند حدود الجمل."""
    text = text.strip()
    if len(text) <= limit:
        return [text] if text else []
    pieces, buf = [], ''
    for sent in SENT_END.split(text):
        if not sent:
            continue
        if buf and len(buf) + len(sent) + 1 > limit:
            pieces.append(buf.strip())
            buf = sent
        else:
            buf = (buf + ' ' + sent).strip()
    if buf:
        pieces.append(buf.strip())
    # جملة واحدة أطول من الحد: اقسمها عند الفواصل
    final = []
    for p in pieces:
        if len(p) <= limit * 1.6:
            final.append(p)
            continue
        sub, cur = [], ''
        for part in re.split(r'(?<=،)\s+', p):
            if cur and len(cur) + len(part) + 1 > limit:
                sub.append(cur.strip())
                cur = part
            else:
                cur = (cur + ' ' + part).strip()
        if cur:
            sub.append(cur.strip())
        final.extend(sub)
    return final


# عناوين المذكرة البنيوية: «الشرط الأول:» «أولا:» «المادة 110» «أ - ...:»
ORD = ('الأول|الأولى|الثاني|الثانية|الثالث|الثالثة|الرابع|الرابعة|الخامس|الخامسة|'
       'السادس|السادسة|السابع|السابعة|الثامن|الثامنة|التاسع|التاسعة|العاشر|العاشرة|'
       'الحادي عشر|الثاني عشر|الثالث عشر|الرابع عشر|الخامس عشر')
NOUN = ('الشرط|الركن|القول|الحكم|الأمر|الصورة|الحالة|النوع|السبب|الرأي|القسم|'
        'المسألة|الفرع|الوجه|القاعدة|الشرطان')
SEQ = ('أولا|أولاً|ثانيا|ثانياً|ثالثا|ثالثاً|رابعا|رابعاً|خامسا|خامساً|سادسا|سادساً|'
       'سابعا|سابعاً|ثامنا|ثامناً|تاسعا|تاسعاً|عاشرا|عاشراً')
HEAD = re.compile('(?:(?<=^)|(?<=[\\s.؟!]))((?:%s)\\s+(?:%s)|(?:%s)|المادة\\s+(?:رقم\\s*)?\\d+|[أ-ي]\\s*[-–ـ]\\s)'
                  % (NOUN, ORD, SEQ))
BAD_HEAD = re.compile('^(و|ف|قال|لأن|لما|وقد|وقال|ثم|كما|بل|إذ|أي|وهذا|وهو|وهي|ومن|وفي)\\b')


BARE = re.compile('^(?:(?:%s)\\s+(?:%s)|(?:%s)|[أ-ي]\\s*[-–ـ])$' % (NOUN, ORD, SEQ))


#  مُدخِلاتُ النقل والاستدلال: تدلّ على أن ثَمّ نقلًا، لا على ما فيه.
#  فلا تصلح عنوانًا يُكتب في أعلى الشريحة وحده.
NOT_HEADING = (
    re.compile(r'^و?ل?قوله\s*(تعالى|عز\s+وجل|سبحانه|صلى\s+الله\s+عليه\s+وسلم'
               r'|عليه\s+(الصلاة\s+و)?السلام)'),
    re.compile(r'^(و?قالوا|وروي\s+عن|واستدل)'),
    #  وقد يقع المُدخِل في آخر السطر لا أوله: «والأصل في ذلك قوله
    #  تعالى:» — صدرُه تمهيدٌ وعجزُه هو المُدخِل.
    re.compile(r'\bو?ل?قوله\s*(تعالى|عز\s+وجل|سبحانه'
               r'|صلى\s+الله\s+عليه\s+وسلم|عليه\s+(الصلاة\s+و)?السلام)\s*$'),
    re.compile(r'\b(قال|قالت|قالوا)\s*$'),
    #  «وبناء على هذا الأصل قال الزركشي» — نسبةُ قولٍ إلى قائله في
    #  آخر السطر: ما بعد النقطتين قولُه هو، لا شرحُ موضوعٍ جديد.
    re.compile(r'\bقال\s+\S+\s*$'),
)


def not_heading(t):
    t = re.sub(r'[\u064B-\u0652\u0670\u0640]', '', t)
    t = re.sub(r'^[٠-٩0-9]+\s*[-ـ.]\s*', '', t).strip()
    return any(r.search(t) for r in NOT_HEADING)


def head_of(seg):
    """يأخذ العنوان من أول المقطع حتى النقطتين.

    «الشرط الأول: الإسلام: ذهب…» عنوانه «الشرط الأول: الإسلام» لا
    «الشرط الأول» وحده، فالرقم بلا موضوعه لا يدل على شيء."""
    two = re.match(r'(.{3,45}?)\s*:\s*(.{2,45}?)\s*:\s*(?=\S)', seg)
    if two:
        first = two.group(1).strip(' -–—ـ.،')
        if BARE.match(first):
            return first + ': ' + two.group(2).strip(' -–—ـ.،'), seg[two.end():].strip()
    m = re.match(r'(.{3,70}?)\s*:\s*(?=\S)', seg)
    if not m:
        return None, seg
    head = m.group(1).strip(' -–—ـ.،')
    if len(head) < 3 or head.count(' ') > 10:
        return None, seg
    #  ما قبل النقطتين ليس عنوانًا دائمًا: «وقوله صلى الله عليه
    #  وسلم:» مُدخِلُ نقلٍ لا عنوانُ مقطع. ولو جُعل عنوانًا لنُسبت
    #  إليه الجملةُ التالية — وهي ليست له. ويُنظر فيه بعد تجريد
    #  التشكيل لأن العناوين تُشكَّل بعد البناء.
    if not_heading(head):
        return None, seg
    return head, seg[m.end():].strip()


def segment(text):
    """يقسّم الفقرة عند عناوينها الداخلية: [(عنوان أو None, نص)]."""
    marks = [m.start() for m in HEAD.finditer(text)]
    marks = [i for i in marks if i > 0 or True]
    if not marks:
        return [head_of(text)]
    bounds = sorted(set([0] + marks + [len(text)]))
    out = []
    for a, b in zip(bounds, bounds[1:]):
        seg = text[a:b].strip()
        if not seg:
            continue
        out.append(head_of(seg))
    return out


def is_heading(t):
    """فقرة مستقلة تصلح عنوانًا لما بعدها."""
    return (len(t) <= 48 and '،' not in t and not re.search(r'[.؟!]$', t)
            and len(t) > 2 and not BAD_HEAD.match(t))


LINE_END = re.compile(r'[.؟!:؛"»﴾\)\]]\s*$')
LINE_ITEM = re.compile(r'^\s*(?:[٠-٩0-9]+\s*[-–ـ]|[أ-ي]\s*[-–ـ]\s|﴿|«|\()')
LINE_NEW = re.compile(r'^\s*(?:و|ف|ثم|أما|بل|لكن|غير\s+أن)')


def weld(lines):
    """يصل السطر بسابقه إذا كان تتمّةَ جملته.

    المذكرة مكتوبةٌ في Word بأسطرٍ مقطوعةٍ باليد، فالسطرُ الواحد
    فقرةٌ مستقلّة وإن كان نصفَ جملة. ولولا الوصل لخرجت الجملةُ
    الواحدة على شريحتين — «تأمر الوالدين بالقيام على تعليم وتأديب»
    ثم «أولادهم، وتحثهم على الاضطلاع بهذه المهمة العظيمة».

    وشرطُ الوصل أن تخلو الأولى من علامة تمام، وألّا تبتدئ الثانية
    بما يبتدئ به كلامٌ جديد: رقمُ بندٍ، أو آية، أو واوٌ أو فاء أو
    «ثم». فـ«…والله أعلم ⏎ وقد استعمل جل الفقهاء» لا تُوصل."""
    out = []
    for t in lines:
        if (out and not LINE_END.search(out[-1])
                and not LINE_ITEM.match(t) and not LINE_NEW.match(t)):
            out[-1] = out[-1].rstrip() + ' ' + t.lstrip()
            continue
        out.append(t)
    return out


def build_units(paras, a, b, default_rubric):
    """السياق يبقى مع الترقيم: «القول الأول» وحده لا يدل على موضوعه،
    فيُعرض مسبوقًا بآخر عنوان موضوعي: «الوصاية إلى المرأة · القول الأول»."""
    units, pending = [], None
    context = current = default_rubric
    raw = [clean(paras[i]) for i in range(a, b + 1) if i < len(paras)]
    for t in weld([x for x in raw if x]):
        if not t:
            continue
        if is_heading(t):
            pending = t.strip(' :')
            continue
        for rub, body in segment(t):
            if pending:
                context = current = pending
                pending = None
            if rub and not BAD_HEAD.match(rub):
                if BARE.match(rub):
                    #  «ثالثًا» بعد «ثانيًا: الدليل من السنة» ليس فرعًا
                    #  لها بل تاليها في العدّ. فتعليقُه عليها يُخرج
                    #  شريحةً في أقوال الصحابة عنوانُها «الدليل من
                    #  السنة» — عنوانٌ كاذبٌ لا ناقص.
                    same_series = (re.match('(?:%s)' % SEQ, rub)
                                   and context and re.match('(?:%s)' % SEQ, context))
                    current = (rub if same_series or not context or context == rub
                               else context + ' · ' + rub)
                    if same_series:
                        context = rub
                else:
                    context = current = rub
            if body.strip():
                units.append({'rubric': current, 'body': body.strip()})
    return units


MIN_SLIDE = 120          # دون هذا تبدو الشريحة فارغةً على الشاشة


def slides_for(units):
    """يقسّم ما طال ويضمّ ما قصر.

    القسمة وحدها لا تكفي: المذكرة فيها فقرات من أربعين حرفًا، فكانت
    كلُّ واحدةٍ شريحةً — سطرًا في وسط شاشةٍ فارغة. فبلغت الشرائح
    القصيرة أربعين بالمئة، وتكرّر العنوان الواحد على ستَّ عشرةَ
    شريحةً متتالية.

    فتُضمّ المتجاورةُ تحت العنوان الواحد ما لم تُجاوز MAX_SLIDE.
    والعنوانُ كلُّه شرطٌ لا صدرُه: «الوصي · القول الأول» و«الوصي ·
    القول الثاني» عنوانُهما يشترك في صدره ولا يُضمّان، وإلا ابتلع
    أحدُ القولين الآخر تحت عنوانه."""
    out = []
    for u in units:
        for k, part in enumerate(chunks(u['body'])):
            out.append({'rubric': u['rubric'], 'body': part,
                        'cont': k > 0, 'parts': [part]})

    packed = []
    for s in out:
        if (packed and packed[-1]['rubric'] == s['rubric']
                and len(packed[-1]['body']) + 1 + len(s['body']) <= MAX_SLIDE):
            packed[-1]['body'] += ' ' + s['body']
            packed[-1]['parts'].append(s['body'])
            continue
        packed.append(dict(s))

    #  «— تتمة» لا تُعلَّق إلا على شريحةٍ قبلها شريحةٌ من عنوانها.
    prev = None
    for s in packed:
        if s['cont'] and s['rubric'] == prev:
            s['rubric'] = s['rubric'] + ' — تتمة'
        prev = s['rubric'].replace(' — تتمة', '')
    return packed


def question_slide(q, idx):
    opts = '\n'.join(
        '          <li%s><span>%s</span> %s</li>'
        % (' class="right"' if j == q['a'] else '', LETTERS[j], esc(o))
        for j, o in enumerate(q['o']))
    return ('      <section class="slide" data-tab="سؤال للجميع" data-timer="30" data-q>\n'
            '        <div class="rubric">السؤال %s</div>\n'
            '        <div class="qtext">%s</div>\n'
            '        <ol class="opts">\n%s\n        </ol>\n'
            '        <div class="answer">%s</div>\n'
            '      </section>' % (ar(idx), highlight(q['q']), opts, highlight(q['w'])))


def build_session(sp, paras, nxt):
    units = build_units(paras, sp['from'], sp['to'], sp['title'])
    body_slides = slides_for(units)
    qs = sp['questions']
    # وزّع الأسئلة بالتساوي بين شرائح القراءة
    step = max(1, len(body_slides) // (len(qs) + 1))
    at = {min((k + 1) * step, len(body_slides)): q for k, q in enumerate(qs)}

    parts = ['      <section class="slide on" data-tab="المحاضرة %s" data-src="%s">\n'
             '        <h1>%s</h1>\n        <div class="sub">%s</div>\n      </section>'
             % (ar(sp['n']), esc(sp['src']), esc(sp['title']), esc(sp['subtitle']))]

    readers = 0
    qi = 0
    for k, s in enumerate(body_slides):
        readers += 1
        body = '\n'.join('          <p>%s</p>' % highlight(x) for x in s.get('parts', [s['body']]))
        parts.append('      <section class="slide" data-reader data-src="%s">\n'
                     '        <div class="rubric">%s</div>\n'
                     '        <div class="matn flow">\n%s\n        </div>\n'
                     '      </section>' % (esc(sp['src']), esc(s['rubric']), body))
        if (k + 1) in at:
            qi += 1
            parts.append(question_slide(at[k + 1], qi))

    while qi < len(qs):                      # أسئلة لم تُوضع بعد
        qi += 1
        parts.append(question_slide(qs[qi - 1], qi))

    nxt_line = ('          <b>المحاضرة القادمة:</b> %s — %s<br>\n' % (esc(nxt['title']), esc(nxt['subtitle']))
                ) if nxt else ''
    parts.append('      <section class="slide" data-tab="ختام المحاضرة" data-src="المحاضرة القادمة">\n'
                 '        <div class="rubric">ختام المحاضرة</div>\n'
                 '        <div class="matn flow"><p>%s</p></div>\n'
                 '        <div class="note">\n%s'
                 '          القارئات: <span id="next"></span> — النص متاح للتحضير من الآن.\n'
                 '        </div>\n      </section>' % (esc(sp['subtitle']), nxt_line))
    return '\n\n'.join(parts), readers


PAGE = '''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>المحاضرة {nar} — {title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
{favicon}
<link rel="manifest" href="../../manifest.webmanifest">
<link rel="apple-touch-icon" sizes="180x180" href="../../icons/icon-180.png">
<link rel="apple-touch-icon" sizes="167x167" href="../../icons/icon-167.png">
<link rel="apple-touch-icon" sizes="152x152" href="../../icons/icon-152.png">
<link rel="apple-touch-icon" sizes="120x120" href="../../icons/icon-120.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="د. سعاد المطوع">
<meta name="theme-color" content="#002856">
<script src="../../assets/theme.js"></script>
<link rel="stylesheet" href="../../assets/tokens.css">
<link rel="stylesheet" href="../../assets/deck.css">
</head>
<body data-session="{n}">
<div class="stage">

  <div class="bar">
    <div>
      <a class="home" id="home" href="../../index.html">→ المنصة</a> ·
      <span id="course"></span> · <b id="instructor"></b> · <span id="sec"></span>
    </div>
    <div class="src" id="src"></div>
  </div>

  <div class="folio">
    <div class="tab" id="tab"></div>
    <div class="timer" id="timer" role="timer" aria-live="off">٣٠</div>
    <div class="inner">

{slides}

    </div>
  </div>

  <div class="foot">
    <div class="marks" id="marks"></div>
    <div class="nav">
      <button id="prev" type="button" aria-label="الشريحة السابقة">→</button>
      <button id="nextBtn" type="button" aria-label="الشريحة التالية">←</button>
    </div>
    <div class="zoom">
      <span class="lbl">حجم الخط</span>
      <button id="zoomOut" type="button" title="تصغير خط الشريحة (−)" aria-label="تصغير خط الشريحة">−</button>
      <span class="lvl" id="zoomLevel">١٠٠٪</span>
      <button id="zoomIn" type="button" title="تكبير خط الشريحة (+)" aria-label="تكبير خط الشريحة">+</button>
    </div>
    <div class="keys">→ ← للتنقل · مسافة: الجواب · ر: المؤقت · + − الخط · ح: الحضور · م: التفاعل</div>
    <div class="credit" id="credit"></div>
  </div>
</div>

<script src="../../data/tenants.js"></script>
<script src="../../assets/config.js"></script>
<script src="../../assets/adapters/supabase.js"></script>
<script src="../../data/courses.js"></script>
<script src="../../assets/store.js"></script>
<script src="../../assets/ui.js"></script>
<script src="../../assets/content.js"></script>
<script src="../../assets/role.js"></script>
<script src="../../assets/qalam.js"></script>
<script src="../../assets/tahrir.js"></script>
<script src="../../assets/deck.js"></script>
<script src="../../assets/participate.js"></script>
<script src="../../assets/qr.js"></script>
<script src="../../assets/present.js"></script>
</body>
</html>
'''


def patch_block(path, start, end, payload):
    """يستبدل ما بين العلامتين. يقرأ أولًا ثم يكتب — فتح الملف
    للكتابة قبل القراءة يمسحه."""
    src = io.open(path, encoding='utf-8').read()
    pat = re.compile(re.escape(start) + r'.*?' + re.escape(end), re.S)
    assert pat.search(src), 'markers not found in ' + path
    out = pat.sub(lambda m: start + payload + end, src, count=1)
    io.open(path, 'w', encoding='utf-8').write(out)


def main(docx, course='wilaya'):
    paras = read_docx(docx)
    plan = []
    pattern = os.path.join(ROOT, 'tools', 'courses', course, 'plan-*.json')
    for f in sorted(glob.glob(pattern)):
        plan += json.load(io.open(f, encoding='utf-8'))
    if not plan:
        raise SystemExit('لا خطة لهذا المقرر: ' + pattern)
    plan.sort(key=lambda s: s['n'])

    out_dir = os.path.join(ROOT, 'sessions', course)
    data_dir = os.path.join(ROOT, 'data', 'courses', course)
    if not os.path.isdir(data_dir):
        raise SystemExit('لا مجلّد بيانات لهذا المقرر: ' + data_dir)
    if not os.path.isdir(out_dir):
        os.makedirs(out_dir)

    favicon = re.search(r'<link rel="icon"[^>]*>',
                        io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()).group(0)

    # اسم الوحدة في اسم الملف: من الخطة إن ذُكر، وإلا من معرّف المقرر
    def part(sp):
        return sp.get('part') or course
    entries, sheets = [], []

    for idx, sp in enumerate(plan):
        nxt = plan[idx + 1] if idx + 1 < len(plan) else None
        slides, readers = build_session(sp, paras, nxt)
        name = '%02d-%s.html' % (sp['n'], part(sp))
        io.open(os.path.join(out_dir, name), 'w', encoding='utf-8').write(
            PAGE.format(n=sp['n'], nar=ar(sp['n']), title=esc(sp['title']),
                        slides=slides, favicon=favicon))

        entries.append(
            '    { n: %d, title: %s, subtitle: %s, pages: %s,\n'
            '      file: "sessions/%s/%s", readers: %d, status: "ready" }'
            % (sp['n'], json.dumps(sp['title'], ensure_ascii=False),
               json.dumps(sp['subtitle'], ensure_ascii=False),
               json.dumps(sp['src'], ensure_ascii=False), course, name, readers))

        items = ',\n'.join(
            '      { id: "w%dq%d", kind: "mcq",\n'
            '        prompt: %s,\n        options: %s,\n        answer: %d,\n        why: %s }'
            % (sp['n'], j + 1, json.dumps(q['q'], ensure_ascii=False),
               json.dumps(q['o'], ensure_ascii=False), q['a'],
               json.dumps(q['w'], ensure_ascii=False))
            for j, q in enumerate(sp['questions']))
        sheets.append(
            '  {\n    id: "w%d",\n    type: "worksheet",\n    session: %d,\n'
            '    title: %s,\n    subtitle: %s,\n    pages: %s,\n'
            '    intro: "تُحل بعد المحاضرة. لا توجد درجات — الغرض أن تتبيّن مواضع اللبس.",\n'
            '    items: [\n%s\n    ]\n  }'
            % (sp['n'], sp['n'],
               json.dumps('ورقة عمل: ' + sp['title'], ensure_ascii=False),
               json.dumps(sp['subtitle'], ensure_ascii=False),
               json.dumps(sp['src'], ensure_ascii=False), items))

    patch_block(os.path.join(data_dir, 'course.js'),
                '/* GENERATED:SESSIONS:START */', '/* GENERATED:SESSIONS:END */',
                ',\n' + ',\n'.join(entries) + '\n  ')

    patch_block(os.path.join(data_dir, 'worksheets.js'),
                '/* GENERATED:SHEETS:START */', '/* GENERATED:SHEETS:END */',
                ',\n' + ',\n'.join(sheets) + '\n')

    print('بُنيت %d محاضرة' % len(plan))
    print('شرائح القراءة: %d' % sum(int(re.search(r'readers: (\d+)', e).group(1)) for e in entries))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'mudhakkira.docx',
         sys.argv[2] if len(sys.argv) > 2 else 'wilaya')
