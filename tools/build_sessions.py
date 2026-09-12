# -*- coding: utf-8 -*-
"""يبني ملفات الحصص من نص المذكرة وخطة التقسيم.

كل كلمة في الخرج مأخوذة من المذكرة حرفيًا؛ الخطة تحدد التقسيم
والعناوين والأسئلة فقط. شغّله من جذر المشروع:

    python3 tools/build_sessions.py مذكرة.docx
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
    """يلوّن الآيات بالأزرق كما في الحصة الأولى."""
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


def build_units(paras, a, b, default_rubric):
    """السياق يبقى مع الترقيم: «القول الأول» وحده لا يدل على موضوعه،
    فيُعرض مسبوقًا بآخر عنوان موضوعي: «الوصاية إلى المرأة · القول الأول»."""
    units, pending = [], None
    context = current = default_rubric
    for i in range(a, b + 1):
        t = clean(paras[i]) if i < len(paras) else ''
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
                    current = (context + ' · ' + rub) if context and context != rub else rub
                else:
                    context = current = rub
            if body.strip():
                units.append({'rubric': current, 'body': body.strip()})
    return units


def slides_for(units):
    out = []
    for u in units:
        parts = chunks(u['body'])
        for k, part in enumerate(parts):
            out.append({'rubric': u['rubric'] + ('' if k == 0 else ' — تتمة'),
                        'body': part})
    return out


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

    parts = ['      <section class="slide on" data-tab="الحصة %s" data-src="%s">\n'
             '        <h1>%s</h1>\n        <div class="sub">%s</div>\n      </section>'
             % (ar(sp['n']), esc(sp['src']), esc(sp['title']), esc(sp['subtitle']))]

    readers = 0
    qi = 0
    for k, s in enumerate(body_slides):
        readers += 1
        parts.append('      <section class="slide" data-reader data-src="%s">\n'
                     '        <div class="rubric">%s</div>\n'
                     '        <div class="matn flow">\n          <p>%s</p>\n        </div>\n'
                     '      </section>' % (esc(sp['src']), esc(s['rubric']), highlight(s['body'])))
        if (k + 1) in at:
            qi += 1
            parts.append(question_slide(at[k + 1], qi))

    while qi < len(qs):                      # أسئلة لم تُوضع بعد
        qi += 1
        parts.append(question_slide(qs[qi - 1], qi))

    nxt_line = ('          <b>الحصة القادمة:</b> %s — %s<br>\n' % (esc(nxt['title']), esc(nxt['subtitle']))
                ) if nxt else ''
    parts.append('      <section class="slide" data-tab="ختام الحصة" data-src="الحصة القادمة">\n'
                 '        <div class="rubric">ختام الحصة</div>\n'
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
<title>الحصة {nar} — {title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
{favicon}
<link rel="stylesheet" href="../assets/tokens.css">
<link rel="stylesheet" href="../assets/deck.css">
</head>
<body data-session="{n}">
<div class="stage">

  <div class="bar">
    <div>
      <a class="home" id="home" href="../index.html">→ المنصة</a> ·
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
    <div class="keys">→ ← للتنقل · مسافة: الجواب · ر: المؤقت · م: رصد التفاعل · طباعة: تصدير</div>
    <div class="credit" id="credit"></div>
  </div>
</div>

<script src="../data/course.js"></script>
<script src="../assets/store.js"></script>
<script src="../assets/ui.js"></script>
<script src="../assets/deck.js"></script>
<script src="../assets/participate.js"></script>
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


def main(docx):
    paras = read_docx(docx)
    plan = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'tools', 'plan-*.json'))):
        plan += json.load(io.open(f, encoding='utf-8'))
    plan.sort(key=lambda s: s['n'])

    favicon = re.search(r'<link rel="icon"[^>]*>',
                        io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()).group(0)

    part = lambda n: 'wilaya' if n <= 10 else ('wakala' if n <= 24 else 'wisaya')
    entries, sheets = [], []

    for idx, sp in enumerate(plan):
        nxt = plan[idx + 1] if idx + 1 < len(plan) else None
        slides, readers = build_session(sp, paras, nxt)
        name = '%02d-%s.html' % (sp['n'], part(sp['n']))
        io.open(os.path.join(ROOT, 'sessions', name), 'w', encoding='utf-8').write(
            PAGE.format(n=sp['n'], nar=ar(sp['n']), title=esc(sp['title']),
                        slides=slides, favicon=favicon))

        entries.append(
            '    { n: %d, title: %s, subtitle: %s, pages: %s,\n'
            '      file: "sessions/%s", readers: %d, status: "ready" }'
            % (sp['n'], json.dumps(sp['title'], ensure_ascii=False),
               json.dumps(sp['subtitle'], ensure_ascii=False),
               json.dumps(sp['src'], ensure_ascii=False), name, readers))

        items = ',\n'.join(
            '      { id: "q%d", kind: "mcq",\n'
            '        prompt: %s,\n        options: %s,\n        answer: %d,\n        why: %s }'
            % (j + 1, json.dumps(q['q'], ensure_ascii=False),
               json.dumps(q['o'], ensure_ascii=False), q['a'],
               json.dumps(q['w'], ensure_ascii=False))
            for j, q in enumerate(sp['questions']))
        sheets.append(
            '  {\n    id: "w%d",\n    type: "worksheet",\n    session: %d,\n'
            '    title: %s,\n    subtitle: %s,\n    pages: %s,\n'
            '    intro: "تُحل بعد الحصة. لا توجد درجات — الغرض أن تتبيّن مواضع اللبس.",\n'
            '    items: [\n%s\n    ]\n  }'
            % (sp['n'], sp['n'],
               json.dumps('ورقة عمل: ' + sp['title'], ensure_ascii=False),
               json.dumps(sp['subtitle'], ensure_ascii=False),
               json.dumps(sp['src'], ensure_ascii=False), items))

    patch_block(os.path.join(ROOT, 'data', 'course.js'),
                '/* GENERATED:SESSIONS:START */', '/* GENERATED:SESSIONS:END */',
                ',\n' + ',\n'.join(entries) + '\n  ')

    patch_block(os.path.join(ROOT, 'data', 'worksheets.js'),
                '/* GENERATED:SHEETS:START */', '/* GENERATED:SHEETS:END */',
                ',\n' + ',\n'.join(sheets) + '\n')

    print('بُنيت %d حصة' % len(plan))
    print('شرائح القراءة: %d' % sum(int(re.search(r'readers: (\d+)', e).group(1)) for e in entries))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'mudhakkira.docx')
