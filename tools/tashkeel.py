# -*- coding: utf-8 -*-
"""يُشكِّل عناوين المنصة — ولا يمسّ المتن.

«التشكيل فقط العناوين»: فالمتن يُقرأ بالعين فيكفيه رسمه، والعنوان
يُقرأ بالصوت — تُمليه الدكتورة وتردّده الطالبة — فخطؤه يُسمع.

المعجم في tools/tashkeel.json: مفتاحه العنوان بلا تشكيل وقيمته
مشكولًا، بخطّ اليد لا بمولّد آليّ. والعناوين مركَّبة: يفصل بينها
« · » ويُذيَّل بعضها بـ« — تتمة»، فيُفكّ العنوان إلى أجزائه
ويُطلب كلُّ جزءٍ على حدة، فيكفي الجزءَ الواحد مدخلٌ واحد مهما
تكرّر في التراكيب.

ما ليس في المعجم لا يُمسّ، ويُبلَّغ عنه في آخر التشغيل. والتشغيل
مكرَّرٌ بلا أثر: العنوان المشكول سلفًا يُترك كما هو.

    python3 tools/tashkeel.py            # التطبيق
    python3 tools/tashkeel.py --check    # التقرير فقط، بلا كتابة
"""
import io, os, re, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP = json.load(io.open(os.path.join(ROOT, 'tools', 'tashkeel.json'), encoding='utf-8'))

HARAKAT = re.compile(u'[ً-ْٰ]')
SEP     = u' · '
TAIL    = u' — تتمة'
SHEET   = u'ورقة عمل: '

missing = set()

def already(t):
    return len(HARAKAT.findall(t)) >= 3

def one(part):
    """يُشكّل جزءًا واحدًا، أو يُرجع None إن لم يكن في المعجم."""
    if part in MAP: return MAP[part]
    if part.startswith(SHEET):                 # «ورقة عمل: عنوان المحاضرة»
        rest = one(part[len(SHEET):])
        if rest: return MAP[u'ورقة عمل'] + u': ' + rest
    return None

def shape(text):
    """العنوان مشكولًا، أو None إن تعذّر جزءٌ منه."""
    t = text.strip()
    if not t or already(t): return None
    tail = u''
    if t.endswith(TAIL):
        t, tail = t[:-len(TAIL)], u' — ' + MAP[u'تتمة']
    parts, out = t.split(SEP), []
    for p in parts:
        v = one(p.strip())
        if v is None:
            missing.add(p.strip()); return None
        out.append(v)
    return SEP.join(out) + tail

def sub_all(src, pattern, group=1):
    """يستبدل ما التقطه الفوج المطلوب من كل تطابق. يُرجع (النص، العدد)."""
    out, last, n = [], 0, 0
    for m in pattern.finditer(src):
        v = shape(m.group(group))
        if v is None: continue
        out.append(src[last:m.start(group)]); out.append(v)
        last = m.end(group); n += 1
    if not n: return src, 0
    out.append(src[last:])
    return u''.join(out), n

#  الصفحات: العنوان الجانبي لكل شريحة، وعنوان المحاضرة في الغلاف.
DECK = [re.compile(r'<div class="rubric">(.*?)</div>', re.S),
        re.compile(r'<h1>(.*?)</h1>', re.S)]
#  البيانات: حقل title وحده — أما subtitle فوصفٌ لا عنوان، فيُترك.
DATA = [re.compile(r'(?<![a-zA-Z])title: "([^"\\]*)"')]
#  الخطة: مصدر التوليد، يُشكَّل كي لا يعود الخام لو أُعيد التوليد.
PLAN = [re.compile(r'(?<![a-zA-Z])"title": "([^"\\]*)"')]

TARGETS = []
d = os.path.join(ROOT, 'sessions')
for sub, _, fs in os.walk(d):
    for f in sorted(fs):
        if f.endswith('.html'): TARGETS.append((os.path.join(sub, f), DECK))
for f in ('course.js', 'worksheets.js', 'evidences.js', 'exams.js'):
    p = os.path.join(ROOT, 'data', 'courses', 'wilaya', f)
    if os.path.exists(p): TARGETS.append((p, DATA))
d = os.path.join(ROOT, 'tools', 'courses', 'wilaya')
for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
    if f.endswith('.json'): TARGETS.append((os.path.join(d, f), PLAN))

def main(check):
    total, touched = 0, 0
    for p, pats in TARGETS:
        s = io.open(p, encoding='utf-8').read()
        orig, n = s, 0
        for pat in pats:
            s, k = sub_all(s, pat); n += k
        if n:
            total += n; touched += 1
            if not check: io.open(p, 'w', encoding='utf-8').write(s)
            print(u'  %-46s %d' % (os.path.relpath(p, ROOT), n))
    print(u'\nعناوين شُكِّلت: %d في %d ملفًا%s' %
          (total, touched, u'  (فحصٌ بلا كتابة)' if check else u''))
    if missing:
        print(u'\nليست في المعجم — تُركت كما هي: %d' % len(missing))
        for t in sorted(missing): print(u'  · ' + t)
    return 0

if __name__ == '__main__':
    sys.exit(main('--check' in sys.argv))
