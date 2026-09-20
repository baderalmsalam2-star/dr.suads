# -*- coding: utf-8 -*-
"""ينوّع مواضع الإجابة الصحيحة في أسئلة الاختيار من متعدد.

═══ لماذا ═══
كانت الإجابة الصحيحة في ٧٨ سؤالًا من ٨٧ هي الخيار الثاني، وفي
التسعة الباقية الخيار الأول. والخياران الثالث والرابع لم يكونا
صحيحين قطّ. فمن اختارت الثاني في كل سؤال بلا قراءةٍ ولا فهم نالت
٩٠٪. وهذا يُبطل غرض السؤال: لم يعد يقيس المعرفة بل يقيس الانتباه
إلى عادة المؤلِّف.

═══ لماذا لا تُنقل كلُّها ═══
«انقل كلَّ سؤالٍ عن موضعه» يبدو أوفى بالمطلوب، وهو في الحقيقة
يصنع نمطًا آخر مقلوبًا: الخيار الثاني لا يملؤه حينئذٍ إلا سؤالٌ
كان في الأول — وهي تسعة لا غير — فيصير الثاني أندر المواضع
الأربعة، فتتعلّم الطالبة أن تتجنّبه. والذي يُبطل النمط هو
التسوية لا الحركة.

فالمواضع تُقسم بالتساوي: ٢٢ · ٢٢ · ٢٢ · ٢١. ويقع في ذلك أن يعود
سؤالٌ إلى موضعه الأول مصادفةً — وهذا من معنى التسوية لا خللٌ فيها،
إذ لو استُثني الراجعون لعاد النمط من بابٍ آخر.

═══ والثبات ═══
الموضعُ وترتيبُ المموِّهات كلاهما دالّةٌ في نصّ السؤال وحده
(sha256): لا في ساعة التشغيل، ولا في ترتيب الملفات، ولا في
الحال التي وجدها عليها. فتشغيلُه مرّةً وعشرًا سواء — لا يتبدّل
امتحانٌ طُبع، ولا ورقةٌ حُلّت.

═══ وما يُعدَّل ═══
الخطط في tools/courses/<المقرر>/plan-*.json هي الأصل، ومنها يُبنى
كلُّ شيء. ويُطبَّق التبديلُ نفسُه على ما وُلِّد منها:
    data/courses/<المقرر>/worksheets.js   options و answer
    sessions/<المقرر>/NN-*.html           ترتيب <li> وموضع class="right"
ولو أُعيد بناء المحاضرات من المذكرة لاحقًا خرجت منوَّعةً أصلًا،
لأن الخطة نفسها عُدّلت.

═══ ⚠ متى لا يُشغَّل ═══
إجابةُ الطالبة تُحفظ برقم الخيار لا بنصّه (submissions.answers).
فلو بُدّل ترتيبُ خياراتِ سؤالٍ بعد أن أجابت عنه الطالبات، صار
اختيارُ من أصابت مشيرًا إلى خيارٍ آخر — فتُقرأ خطأً، ولا يظهر ذلك
في شيء: لا رسالةَ ولا سطرَ سجلّ، إنما درجةٌ أقلُّ ممّا استحقّت.

والتشغيل مكرَّرٌ بلا أثرٍ فلا خوف منه. وإنما الخطر في تشغيلٍ بعد
تعديل سؤالٍ أو إضافته: القسمة كلُّها تُعاد حينئذٍ. فإن احتجتِ إلى
ذلك ولكِ تسليماتٌ محفوظة، فأعيدي التصحيح بعده.

    python3 tools/tanwee3.py [معرّف-المقرر]     (الافتراضي wilaya)
    python3 tools/tanwee3.py --فحص              يقيس ولا يكتب
"""
import collections, glob, hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from build_sessions import LETTERS, esc          # نفس الترميز الذي وُلِّد به

DIGITS = '٠١٢٣٤٥٦٧٨٩'


def ar(n):
    return ''.join(DIGITS[int(c)] for c in str(n))


def seed(q):
    """قرعةٌ ثابتة مشتقّة من نصّ السؤال — لا من ترتيبه ولا من الوقت."""
    return int(hashlib.sha256(q['q'].encode('utf-8')).hexdigest(), 16)


# ───────────────────────── القسمة على المواضع ─────────────────────────
def assign(questions):
    """يقسم المواضع الأربعة بالتساوي، قسمةً لا تتبع الحال الراهنة.

    لو نُظر في موضع السؤال اليوم لاختلف الخرج باختلاف الحال، فصار
    تشغيلُ الأداة مرّتين يخلط ما رتّبته في الأولى. فالقسمة على
    ترتيبٍ مشتقٍّ من نصوص الأسئلة وحدها: يُرتَّب السؤال بقرعته ثم
    يُعطى الموضع بالدور. فالخرج واحدٌ مهما تكرّر التشغيل، وواحدٌ
    مهما تبدّل ترتيب الملفات."""
    k = len(questions[0]['o'])
    order = sorted(range(len(questions)), key=lambda i: (seed(questions[i]), i))
    target = [None] * len(questions)
    for rank, i in enumerate(order):
        target[i] = rank % k
    return target


def permute(q, t):
    """يبدّل الخيارات فتصير الإجابة في الموضع t، ويرتّب المموّهات.

    والمموّهات تُرتَّب بقرعة نصِّ كلٍّ منها لا بموضعه الحاليّ، فلا
    يتوقّف الخرج على الترتيب الذي دخلت به."""
    right = q['o'][q['a']]
    wrong = sorted((o for j, o in enumerate(q['o']) if j != q['a']),
                   key=lambda o: hashlib.sha256(o.encode('utf-8')).hexdigest())
    out, it = [], iter(wrong)
    for j in range(len(q['o'])):
        out.append(right if j == t else next(it))
    return out


# ───────────────────────── تطبيقه على ما وُلِّد ─────────────────────────
def patch_worksheets(path, edits):
    """يستبدل سطرَي options و answer للسؤال المطابق نصُّه، ولا يمسّ غيرهما."""
    src = open(path, encoding='utf-8').read()
    hit = 0
    for old_prompt, opts, a in edits:
        pj = json.dumps(old_prompt, ensure_ascii=False)
        #  الرابط بين السؤال وخياريه هو الجوار: prompt ثم options ثم answer.
        pat = re.compile(
            r'(prompt: ' + re.escape(pj) + r',\n\s*options: )\[[^\n]*\](,\n\s*answer: )\d+',
            re.M)
        new, k = pat.subn(
            lambda m: m.group(1) + json.dumps(opts, ensure_ascii=False) + m.group(2) + str(a),
            src)
        if k != 1:
            raise SystemExit('لم يُطابَق في %s سؤالٌ واحدٌ بالضبط (%d): %s'
                             % (os.path.basename(path), k, old_prompt[:50]))
        src, hit = new, hit + k
    open(path, 'w', encoding='utf-8').write(src)
    return hit


def patch_session(path, edits):
    """يعيد كتابة <ol class="opts"> بالترتيب الجديد وموضع class="right"."""
    src = open(path, encoding='utf-8').read()
    hit = 0
    for old_opts, opts, a in edits:
        old_html = '\n'.join(
            '          <li%s><span>%s</span> %s</li>'
            % (' class="right"' if j == old_opts[1] else '', LETTERS[j], esc(o))
            for j, o in enumerate(old_opts[0]))
        new_html = '\n'.join(
            '          <li%s><span>%s</span> %s</li>'
            % (' class="right"' if j == a else '', LETTERS[j], esc(o))
            for j, o in enumerate(opts))
        if src.count(old_html) != 1:
            raise SystemExit('لم تُطابَق في %s قائمةُ خياراتٍ واحدةٌ بالضبط (%d)'
                             % (os.path.basename(path), src.count(old_html)))
        src = src.replace(old_html, new_html)
        hit += 1
    open(path, 'w', encoding='utf-8').write(src)
    return hit


def audit_decks(course, planned):
    """أسئلةٌ في المحاضرات لا أصل لها في الخطة.

    المحاضرة الأولى مكتوبةٌ بيدٍ لا مولَّدة، فأسئلتها ليست في خطة.
    ولو صمتت الأداة عنها لقالت «٨٧ سؤالًا» والملفات فيها تسعون،
    فيُظنّ أن الجميع نُوّع وثلاثةٌ منها على حالها. فتُعدّ وتُذكر
    ليُنظر فيها بيدٍ."""
    extra = []
    for p in sorted(glob.glob(os.path.join(ROOT, 'sessions', course, '*.html'))):
        num = int(re.match(r'(\d+)-', os.path.basename(p)).group(1))
        found = len(re.findall(r'<ol class="opts">', open(p, encoding='utf-8').read()))
        if found != planned.get(num, 0):
            extra.append((os.path.basename(p), found, planned.get(num, 0)))
    for name, found, want in extra:
        print('  ⚠ %s: %d سؤالًا في الملف و%d في الخطة — تُراجَع بيدٍ.'
              % (name, found, want))
    return extra


def verify(course, plan):
    """يتأكّد أن الثلاثة على كلمةٍ واحدة: الخطة، وأوراق العمل، والمحاضرات.

    الخطة أصلٌ وما سواها مولَّدٌ منها، فافتراقُها عنها لا يظهر في
    الاستعمال: الطالبة تحلّ من أوراق العمل، والدكتورة تعرض من
    المحاضرة — فلو اختلف ترتيبُ الخيارات بينهما صحّحت الدكتورة على
    ترتيبٍ غير الذي رأته الطالبة، ولا يُكتشف ذلك إلا من شكوى."""
    import html as _html
    bad = []

    src = open(os.path.join(ROOT, 'data', 'courses', course, 'worksheets.js'),
               encoding='utf-8').read()
    sheet = {}
    for m in re.finditer(r'id: "w(\d+)q(\d+)", kind: "mcq",\n\s*prompt: '
                         r'("(?:[^"\\]|\\.)*"),\n\s*options: (\[[^\n]*\]),'
                         r'\n\s*answer: (\d+)', src):
        sheet[(int(m.group(1)), int(m.group(2)) - 1)] = (
            json.loads(m.group(3)), json.loads(m.group(4)), int(m.group(5)))

    deck = {}
    seen = 0
    for p in sorted(glob.glob(os.path.join(ROOT, 'sessions', course, '*.html'))):
        num = int(re.match(r'(\d+)-', os.path.basename(p)).group(1))
        body = open(p, encoding='utf-8').read()
        for i, sec in enumerate(re.findall(r'<ol class="opts">\n(.*?)\n\s*</ol>',
                                           body, re.S)):
            opts, right = [], None
            for j, li in enumerate(re.findall(
                    r'<li( class="right")?><span>.</span> (.*?)</li>', sec)):
                opts.append(_html.unescape(li[1]))
                if li[0]:
                    right = j
            deck[(num, i)] = (opts, right)
            seen += 1

    for key, q in sorted(plan.items()):
        if sheet.get(key) != (q['q'], q['o'], q['a']):
            bad.append('أوراق العمل تخالف الخطة في w%dq%d' % (key[0], key[1] + 1))
        if deck.get(key) != (q['o'], q['a']):
            bad.append('المحاضرة %d تخالف الخطة في السؤال %d' % (key[0], key[1] + 1))

    spread = collections.Counter(r for _, r in deck.values())
    k = len(next(iter(plan.values()))['o'])
    print('في المحاضرات %d سؤالًا — ' % seen
          + ' · '.join('%s=%d' % (LETTERS[i], spread.get(i, 0)) for i in range(k)))
    for b in bad:
        print('  ✗ ' + b)
    print('التطابق: %s' % ('تامّ' if not bad else '%d اختلافًا' % len(bad)))
    return bad


def main(course='wilaya', dry=False):
    plans = sorted(glob.glob(os.path.join(ROOT, 'tools', 'courses', course, 'plan-*.json')))
    if not plans:
        raise SystemExit('لا خطط للمقرر %s' % course)

    loaded = [(p, json.load(open(p, encoding='utf-8'))) for p in plans]
    flat = [(p, s, q) for p, d in loaded for s in d for q in s.get('questions', [])]
    if not flat:
        raise SystemExit('لا أسئلة اختيارٍ من متعدد في خطط %s' % course)

    qs = [q for _, _, q in flat]
    if len({len(q['o']) for q in qs}) != 1:
        raise SystemExit('الأسئلة ليست على عددٍ واحدٍ من الخيارات')

    before = [q['a'] for q in qs]
    target = assign(qs)
    k = len(qs[0]['o'])

    print('قبلُ: ' + ' · '.join('%s=%d' % (LETTERS[i], before.count(i)) for i in range(k)))
    print('بعدُ: ' + ' · '.join('%s=%d' % (LETTERS[i], target.count(i)) for i in range(k)))
    moved = sum(1 for a, t in zip(before, target) if a != t)
    print('ينتقل %d من %d، ويعود %d إلى موضعه مصادفةَ القسمة.'
          % (moved, len(qs), len(qs) - moved))
    planned = {}
    for _, d in loaded:
        for sess in d:
            planned[sess['n']] = len(sess.get('questions', []))
    audit_decks(course, planned)

    keyed = {(sess['n'], i): q
             for _, d in loaded for sess in d
             for i, q in enumerate(sess.get('questions', []))}

    if dry:
        verify(course, keyed)
        return

    if sum(1 for a, t in zip(before, target) if a != t):
        print('⚠ إن كان لهذه الأوراق تسليماتٌ محفوظة، فإجاباتها مخزَّنة')
        print('  برقم الخيار لا بنصّه — فأعيدي تصحيحها بعد هذا التبديل.')

    #  ما وُلِّد يُصحَّح قبل أن تُكتب الخطة، لأن المطابقة فيه تقع على
    #  النصّ القديم. فإن تعذّرت مطابقةٌ واحدة وقف كلُّ شيء ولم يُكتب
    #  في الخطة حرف — فلا تفترق الخطةُ عمّا وُلِّد منها.
    sheets, decks = {}, {}
    for (path, sess, q), t in zip(flat, target):
        new_o = permute(q, t)
        sheets.setdefault('worksheets', []).append((q['q'], new_o, t))
        decks.setdefault(sess['n'], []).append(((q['o'], q['a']), new_o, t))
        q['_new'] = (new_o, t)

    data_dir = os.path.join(ROOT, 'data', 'courses', course)
    sess_dir = os.path.join(ROOT, 'sessions', course)
    n = patch_worksheets(os.path.join(data_dir, 'worksheets.js'), sheets['worksheets'])
    print('أوراق العمل: %d سؤالًا' % n)

    total = 0
    for num, edits in sorted(decks.items()):
        found = glob.glob(os.path.join(sess_dir, '%02d-*.html' % num))
        if len(found) != 1:
            raise SystemExit('محاضرة %d: وُجد %d ملفًا' % (num, len(found)))
        total += patch_session(found[0], edits)
    print('المحاضرات: %d سؤالًا في %d ملفًا' % (total, len(decks)))

    for path, d in loaded:
        for s in d:
            for q in s.get('questions', []):
                q['o'], q['a'] = q.pop('_new')
        open(path, 'w', encoding='utf-8').write(
            json.dumps(d, ensure_ascii=False, indent=1))
    print('الخطط: %d ملفًا' % len(loaded))
    print('─── تطابق الثلاثة ───')
    if verify(course, keyed):
        raise SystemExit('افترق المولَّد عن الخطة — راجعه قبل الدفع.')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    main(args[0] if args else 'wilaya', dry='--فحص' in sys.argv or '--dry' in sys.argv)
