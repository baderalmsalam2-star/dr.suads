#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""لا يُقطع كلامٌ متّصلٌ بسؤال.

    python3 tools/wasl.py wilaya --فحص     يقيس ولا يكتب
    python3 tools/wasl.py wilaya           يُثبّت الهويّات ثم يَصِل

═══ العلّة ═══
«مرات تقسم الكلام — تأكد من مادة ١١٤.»

المادّة ١١٤ في المحاضرة السابعة شريحتان، وبينهما سؤال:

    ٧   المادّة ١١٤  … أن تقيد هذه الولاية أو تسلبها
    ٨   ⟵ السؤال ١
    ٩   المادّة ١١٤  وللمحكمة أن تعزل الوصي المعين …

فتقرأ الدكتورة نصفَ المادّة، ثم تُسأل الطالبات، ثم يعود النصف
الثاني — وقد انقطع الحبل. وهي خمسون موضعًا في المقرر لا موضعًا
واحدًا.

═══ الحلّ: يُؤخَّر السؤال إلى آخر الكلام المتّصل ═══
ولا يُنقل عن محاضرته، ولا يتقدّم سؤالٌ على سؤال — فترتيب الأسئلة
بينها لا يتبدّل، وهو ما تُنسب إليه إجاباتُ الطالبات (replies.q).

═══ ولماذا تُثبَّت الهويّات أوّلًا ═══
data-born ليست في الملفّات: يحسبها tahrir.js بموضع الشريحة عند
التحميل (f0, f1, …). وإليها تُنسب تصحيحاتُ الدكتورة. وqalam.js
ينسب خطَّ القلم إلى الموضع كذلك.

فلو نُقلت شريحةٌ في الملفّ لتزحزحت هويّاتُ ما بعدها، فظهر تصحيحُ
شريحةٍ على غيرها، وخطُّ قلمٍ على غير موضعه — بصمتٍ تامّ.

فتُكتب الهويّات في الملفّ أوّلًا بمواضعها اليوم، فتُثبَّت إلى
الأبد: ما كتبته الدكتورة يبقى على صاحبه مهما نُقل بعدُ.
"""
import glob, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
#  الصنفُ قد يحمل «on» مع «slide» — أوّلُ شريحةٍ في كل محاضرة
#  كذلك. واشتراطُ «slide» وحدَها كان يُسقطها من التثبيت، فتأخذ
#  هويّةً من tahrir عند التحميل تصادم هويّةً مكتوبةً في الملفّ،
#  فيُخفي حذفُ واحدةٍ شريحتين. كشفه الفحص.
SEC = re.compile(r'([ \t]*)<section class="slide([^"]*)"([^>]*)>(.*?)</section>\n?', re.S)
RUB = re.compile(r'<div class="rubric">(.*?)</div>', re.S)
TAG = re.compile(r'<[^>]+>')


def txt(x):
    return re.sub(r'\s+', ' ', TAG.sub('', x)).strip()


def slides(html):
    """(البداية، النهاية، الوسوم، العنوان، أسؤالٌ هو) لكل شريحة."""
    out = []
    for m in SEC.finditer(html):
        r = RUB.search(m.group(4))
        out.append({"m": m, "attrs": m.group(3),
                    "rub": txt(r.group(1)) if r else "",
                    "q": "data-q" in m.group(3)})
    return out


def pin(html):
    """يكتب data-born بمواضع اليوم، ولا يمسّ ما ثُبّت من قبل."""
    if 'data-born' in html:
        return html, 0
    n = [0]

    def one(m):
        tag = '<section class="slide%s"%s data-born="f%d">' % (m.group(2), m.group(3), n[0])
        n[0] += 1
        return m.group(1) + tag + m.group(4) + "</section>\n"

    return SEC.sub(one, html), n[0]


def weave(html):
    """يؤخّر كلَّ سؤالٍ يقطع كلامًا متّصلًا إلى آخر ذلك الكلام."""
    moves = 0
    while True:
        ss = slides(html)
        hit = None
        for i in range(1, len(ss) - 1):
            if not ss[i]["q"] or ss[i - 1]["q"] or ss[i + 1]["q"]:
                continue
            if not ss[i - 1]["rub"] or ss[i - 1]["rub"] != ss[i + 1]["rub"]:
                continue
            #  آخر شريحةٍ تشارك العنوان نفسه، ولا يُتخطّى سؤالٌ آخر
            j = i + 1
            while j + 1 < len(ss) and not ss[j + 1]["q"] and ss[j + 1]["rub"] == ss[i - 1]["rub"]:
                j += 1
            hit = (i, j)
            break
        if not hit:
            return html, moves
        i, j = hit
        block = ss[i]["m"].group(0)
        a, b = ss[i]["m"].start(), ss[i]["m"].end()
        end = ss[j]["m"].end()
        html = html[:a] + html[b:end] + block + html[end:]
        moves += 1


def main():
    course = next((a for a in sys.argv[1:] if not a.startswith("-")), "wilaya")
    check = "--فحص" in sys.argv or "--check" in sys.argv
    cut = pinned = moved = 0

    for path in sorted(glob.glob(os.path.join(ROOT, "sessions", course, "*.html"))):
        name = os.path.basename(path)
        html = io.open(path, encoding="utf-8").read()
        before = html

        html, n = pin(html)
        pinned += n

        ss = slides(html)
        bad = [i for i in range(1, len(ss) - 1)
               if ss[i]["q"] and not ss[i - 1]["q"] and not ss[i + 1]["q"]
               and ss[i - 1]["rub"] and ss[i - 1]["rub"] == ss[i + 1]["rub"]]
        cut += len(bad)
        for i in bad:
            print("  ✂ %-26s سؤالٌ يقطع: %s" % (name, ss[i - 1]["rub"][:44]))

        html, k = weave(html)
        moved += k

        #  حرّاس: عددُ الشرائح، ونصُّها، وترتيبُ الأسئلة بينها
        a, b = slides(before), slides(html)
        assert len(a) == len(b), name + ": عدد الشرائح تبدّل"
        assert sorted(txt(x["m"].group(4)) for x in a) == \
               sorted(txt(x["m"].group(4)) for x in b), name + ": نصٌّ تبدّل"
        assert [txt(x["m"].group(4)) for x in a if x["q"]] == \
               [txt(x["m"].group(4)) for x in b if x["q"]], name + ": ترتيبُ الأسئلة تبدّل"

        if html != before and not check:
            io.open(path, "w", encoding="utf-8").write(html)

    print("\nهويّاتٌ ثُبّتت: %d · كلامٌ كان مقطوعًا: %d · %s: %d"
          % (pinned, cut, "سيُوصَل" if check else "وُصل", moved))
    return 1 if (check and (cut or pinned)) else 0


if __name__ == "__main__":
    sys.exit(main())
