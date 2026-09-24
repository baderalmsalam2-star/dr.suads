#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""يفرّق بين سؤالين متتاليين اتّفق موضعُ جوابهما في المحاضرة الواحدة.

    python3 tools/tafriq.py wilaya --from 7        يُصلح من المحاضرة ٧
    python3 tools/tafriq.py wilaya --فحص           يقيس ولا يكتب

═══ لماذا، وقد وُزّعت المواضع بالسواء ═══
tanwee3.py سوّى المواضع على المقرر كلِّه: ٢٣ · ٢٣ · ٢٢ · ٢٢. وهذا
صحيحٌ في الجملة، ولا يُغني.

فالطالبة لا ترى المقرر كلَّه دفعةً واحدة، إنما ترى ثلاثة أسئلة في
محاضرةٍ واحدة. فلو كان جوابُ الأول «ب» وجوابُ الثاني «ب» ظنّت —
وهي في القاعة — أن «ب» هي العادة. وقد وقع: قالت الدكتورة عن
المحاضرة السادسة «ما زال اختياره محصورًا في ب»، وهي ب ب ج.

والتسوية العامّة لا تمنع هذا: ثلاثَ عشرةَ محاضرةً من الثلاثين فيها
سؤالان متتاليان اتّفق موضعُهما.

═══ ⚠ ولا يُشغَّل على محاضرةٍ دُرِّست ═══
إجابةُ الطالبة تُحفظ برقم الخيار لا بنصّه — في submissions.answers
وفي replies.choice. فتبديلُ ترتيب الخيارات بعد أن أجابت يجعل
اختيارَ من أصابت مشيرًا إلى خيارٍ آخر، ولا يظهر ذلك في شيء: لا
رسالةَ ولا سطرَ سجلّ، إنما حصيلةٌ تُقرأ خطأً ودرجةٌ أقلُّ ممّا
استحقّت. فـ--from حدٌّ لازم، لا زينة.

═══ وأقلُّ ما يكفي ═══
لا يُعاد ترتيبُ المحاضرة كلِّها، ولا تُمسّ إلا الشريحةُ الثانية من
الزوج المتّفق: يُبدَّل نصُّ خيارها الصحيح بنصّ خيارٍ آخر، وتبقى
حروفُ أ ب ج د في مواضعها. فالتغييرُ أصغرُ ما يقع به المقصود.
"""
import glob, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = "أبجد"
OPTS = re.compile(r'<ol class="opts">(.*?)</ol>', re.S)
LI = re.compile(r'<li([^>]*)>(.*?)</li>', re.S)
SPAN = re.compile(r'^(\s*<span>[^<]*</span>)(.*)$', re.S)


def right_of(block):
    ks = [i for i, m in enumerate(LI.finditer(block)) if 'right' in m.group(1)]
    return ks[0] if len(ks) == 1 else None


def swap(block, a, b):
    """يبدّل نصَّي الخيارين ويُنقل وسمُ الصواب — والحروف في مواضعها."""
    items = list(LI.finditer(block))
    bodies, attrs = [], []
    for m in items:
        s = SPAN.match(m.group(2))
        attrs.append(m.group(1))
        bodies.append((s.group(1), s.group(2)) if s else ("", m.group(2)))

    bodies[a], bodies[b] = (bodies[a][0], bodies[b][1]), (bodies[b][0], bodies[a][1])
    attrs = [re.sub(r'\s*class="right"', '', x) for x in attrs]
    attrs[b] = ' class="right"' + attrs[b]

    out = []
    for i, m in enumerate(items):
        out.append("<li%s>%s%s</li>" % (attrs[i], bodies[i][0], bodies[i][1]))
    # يُعاد البناء بحفظ ما بين العناصر من فراغ
    parts, last = [], 0
    for i, m in enumerate(items):
        parts.append(block[last:m.start()]); parts.append(out[i]); last = m.end()
    parts.append(block[last:])
    return "".join(parts)


def main():
    course = next((a for a in sys.argv[1:] if not a.startswith("-")), "wilaya")
    check = "--فحص" in sys.argv or "--check" in sys.argv
    start = 1
    if "--from" in sys.argv:
        start = int(sys.argv[sys.argv.index("--from") + 1])

    tally = [0] * 4
    fixed = held = 0
    for path in sorted(glob.glob(os.path.join(ROOT, "sessions", course, "*.html"))):
        n = int(re.match(r'(\d+)-', os.path.basename(path)).group(1))
        html = io.open(path, encoding="utf-8").read()
        blocks = list(OPTS.finditer(html))
        seq = [right_of(b.group(1)) for b in blocks]
        for k in seq:
            if k is not None:
                tally[k] += 1
        if not any(seq):
            continue

        new, moved = html, []
        for i in range(1, len(seq)):
            if seq[i] is None or seq[i] != seq[i - 1]:
                continue
            if n < start:
                held += 1
                print("  ⏸ المحاضرة %-3d السؤال %d — %s %s (دُرِّست، فلا تُمسّ)"
                      % (n, i + 1, L[seq[i - 1]], L[seq[i]]))
                continue
            #  موضعٌ يخالف ما قبله وما بعده، وأقلُّها استعمالًا
            bad = {seq[i - 1]} | ({seq[i + 1]} if i + 1 < len(seq) and seq[i + 1] is not None else set())
            want = min((k for k in range(4) if k not in bad), key=lambda k: tally[k])
            tally[seq[i]] -= 1; tally[want] += 1
            moved.append((i, seq[i], want))
            seq[i] = want
            fixed += 1

        if not moved:
            continue
        #  تُطبَّق التبديلات من آخر الملفّ إلى أوّله فلا تتزحزح المواضع
        for i, frm, to in reversed(moved):
            b = list(OPTS.finditer(new))[i]
            new = new[:b.start(1)] + swap(b.group(1), frm, to) + new[b.end(1):]
            print("  ✎ المحاضرة %-3d السؤال %d — %s ← %s" % (n, i + 1, L[frm], L[to]))
        if not check:
            io.open(path, "w", encoding="utf-8").write(new)

    print("\nالتوزيع بعدُ: " + " · ".join("%s %d" % (L[i], tally[i]) for i in range(4)))
    if held:
        print("موقوفٌ في محاضراتٍ دُرِّست: %d — تُترك لئلا تفسد إجاباتُ من أجابت." % held)
    print(("سيُبدَّل %d" if check else "بُدِّل %d") % fixed)
    return 1 if (check and fixed) else 0


if __name__ == "__main__":
    sys.exit(main())
