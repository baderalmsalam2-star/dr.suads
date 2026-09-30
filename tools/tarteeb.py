#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""يرفع العنوانَ الذي سقط إلى أول المتن، في مواضعَ مسمّاة.

    python3 tools/tarteeb.py wilaya --فحص     يقيس ولا يكتب
    python3 tools/tarteeb.py wilaya           يُصلح

═══ العلّة ═══
المولّد يقطع ما قبل النقطتين ويجعله عنوانًا. فحيث لم تكن في المذكرة
نقطتان بقي العنوانُ في أول المتن، وورثت الشريحةُ عنوانَ جارتها.

فالمحاضرة الثامنة فيها «الْمَادَّةُ رَقْمُ ٢٠٨» عنوانًا على خمس
شرائح، ومتنُ إحداها يبدأ «الجنون نص الفقهاء…» — وهو السببُ الثاني
بدليل أن أختيه «السبب الأول» و«السبب الثالث» مسمّاتان. فتقرأ
الطالبةُ فقهَ الجنون منسوبًا إلى مادّةٍ قانونيةٍ لا تتناوله.

═══ ولماذا قائمةٌ بأسمائها لا قاعدة ═══
«المتنُ يبدأ بعنوانه» لا تلتقطه قاعدةٌ نظيفة: «فذهب الحنفية» ليست
عنوانًا، و«ولاية التزويج» عنوانٌ صحيح، وكلاهما مفتتحُ متن. والتخمينُ
يُفسد سليمًا، وهو ضررٌ لا يقلّ. فقُرئت شرائحُ المحاضرات القادمة
واحدةً واحدة، وأُحصيت المواضع بنصّها.

═══ ولا يُمحى نصٌّ فريد ═══
الرفعُ يستبدل عنوانًا قائمًا، فلولا قيدٌ لمحا نصًّا. والقيد: لا
يُستبدل إلا عنوانٌ **موروثٌ عن الشريحة السابقة** — أي مكرَّرٌ لا
يخصّها. ويسقط التشغيل إن لم يكن كذلك.

وما عدا الرفع فلا يُنقص حرفًا: «الطيّ» يحذف تكرارًا حرفيًّا لعنوانٍ
قائم، و«النقطة» تحذف نقطةً شاردة.
"""
import glob, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEC = re.compile(r'<section class="slide[^"]*"[^>]*>.*?</section>', re.S)
RUB = re.compile(r'(<div class="rubric">)(.*?)(</div>)', re.S)
FIRSTP = re.compile(r'(<div class="matn[^"]*">\s*<p>)(.*?)(</p>)', re.S)
TAG = re.compile(r'<[^>]+>')
SHADD = re.compile(r'[ً-ْٰـ]')     # التشكيل والتطويل


def txt(x):
    return re.sub(r'\s+', ' ', TAG.sub('', x)).strip()


def bare(x):
    return SHADD.sub('', txt(x))


def root(x):
    """أصلُ العنوان: ما قبل «·». فالذيلُ فرعٌ يتبدّل، والأصلُ هو
       الذي يُورَث عن الشريحة السابقة."""
    return bare(x).split("·")[0].strip()


#  رفعٌ: (المحاضرة، مفتتحُ المتن، ما يُرفع، كيف)
#    set  يستبدل العنوانَ الموروث — لأن الشريحة موضوعٌ آخر
#    add  يُلحق بالعنوان بعد «·» — لأنها فرعٌ تحته، وهو نمطُ الملفّ
LIFT = [
    (7, "شراء الولي مال المحجور لنفسه أو بيع ماله له، فقد اختلف الفقهاء فيه.",
        "شراء الولي مال المحجور لنفسه أو بيع ماله له، فقد اختلف الفقهاء فيه", "set"),
    (8, "ولاية التزويج ذهب الفقهاء", "ولاية التزويج", "set"),
    (8, "الجنون نص الفقهاء", "الجنون", "set"),
    (8, "ولاية التزويج وهذه الولاية تنقسم", "ولاية التزويج", "add"),
]

#  طيٌّ: متنٌ يفتتح بتكرار عنوانه الحرفيّ
FOLD = [(8, "الولاية على النفس الولاية على النفس عند الفقهاء", "الولاية على النفس")]

#  نقطةٌ شاردةٌ في أول المتن — أثرُ قطعٍ في المولّد
DOT = [(7, ". فذهب الحنفية إلى أن للوصي")]


def main():
    course = next((a for a in sys.argv[1:] if not a.startswith("-")), "wilaya")
    check = "--فحص" in sys.argv or "--check" in sys.argv
    log, warn = [], []

    for path in sorted(glob.glob(os.path.join(ROOT, "sessions", course, "*.html"))):
        lec = int(re.match(r'(\d+)-', os.path.basename(path)).group(1))
        html = io.open(path, encoding="utf-8").read()
        out, last, prev_rub, prev_orig = [], 0, "", ""
        carry = None          # (العنوانُ القديم، الجديد) يسري على التتمّة

        for m in SEC.finditer(html):
            block = m.group(0)
            r = RUB.search(block)
            p = FIRSTP.search(block)
            rub = txt(r.group(2)) if r else ""
            mine = p and any(lec == n and txt(p.group(2)).startswith(st)
                             for n, st, _h, _m in LIFT)

            #  التتمّة: ما زالت تحمل العنوانَ القديم ولا رفعَ لها
            if carry and r and not mine and bare(rub) == carry[0] \
               and "data-q" not in block[:200]:
                r3 = RUB.search(block)
                block = block[:r3.start(2)] + carry[1] + block[r3.end(2):]
                log.append("م%d · وسرى العنوانُ على تتمّته" % lec)
                rub = carry[1]
                out.append(html[last:m.start()]); out.append(block); last = m.end()
                prev_rub = rub
                continue
            if r and not mine and "data-q" not in block[:200] and carry \
               and bare(rub) != carry[0]:
                carry = None

            if r and p:
                body = p.group(2).lstrip()
                plain = txt(body)

                for n, start, head, mode in LIFT:
                    if n != lec or not plain.startswith(start) or not body.startswith(head):
                        continue
                    #  «set» يمحو عنوانًا، فلا يقع إلا على موروث: أصلُه
                    #  (ما قبل «·») هو أصلُ عنوان الشريحة السابقة.
                    if mode == "set" and root(rub) != root(prev_orig):
                        warn.append("م%d · لم يُرفع «%s»: عنوانُها ليس موروثًا (%s)"
                                    % (lec, head[:34], rub[:34]))
                        break
                    rest = body[len(head):].lstrip(" ،.:")
                    block = block[:p.start(2)] + rest + block[p.end(2):]
                    #  «set» يُسقط الأصلَ الدخيل ويُبقي ذيلَ الملفّ إن
                    #  كان: عنوانُ الشريحة ٢١ في الثامنة «… · السَّبَبُ
                    #  الثَّانِي» — فالتسميةُ في الملفّ، والمادّةُ ٢٠٨
                    #  دخيلةٌ عليها. فيُجمع الذيلُ إلى المرفوع، ولا
                    #  يُؤلَّف اسمٌ من خارج الملفّ.
                    tail = rub.split("·")[-1].strip() if "·" in rub else ""
                    new_rub = (tail + " · " + head) if (mode == "set" and tail) \
                              else (head if mode == "set" else rub + " · " + head)
                    r2 = RUB.search(block)
                    block = block[:r2.start(2)] + new_rub + block[r2.end(2):]
                    log.append("م%d · %s: %s"
                               % (lec, "رُفع عنوانًا" if mode == "set" else "أُلحق بالعنوان",
                                  head[:46]))
                    #  التتمّةُ تُقاس بعنوان هذه الشريحة قبل الرفع، لا
                    #  بعنوان السابقة: قد تحمل هذه ذيلًا لا تحمله تلك،
                    #  فتتمّتُها تشاركها الذيلَ ولا تشارك السابقة.
                    carry = (bare(rub), new_rub) if mode == "set" else None
                    rub = new_rub
                    break

                for n, start, head in FOLD:
                    if n == lec and plain.startswith(start) and body.startswith(head):
                        rest = body[len(head):].lstrip(" ،.:")
                        block = block[:p.start(2)] + rest + block[p.end(2):]
                        log.append("م%d · طُوي تكرارُ العنوان في أول المتن" % lec)
                        break

                for n, start in DOT:
                    if n == lec and plain.startswith(start) and body.startswith("."):
                        rest = body[1:].lstrip()
                        block = block[:p.start(2)] + rest + block[p.end(2):]
                        log.append("م%d · نقطةٌ شاردةٌ في أول المتن" % lec)
                        break

            out.append(html[last:m.start()]); out.append(block); last = m.end()
            #  شريحةُ السؤال ليست من سلسلة العناوين: عنوانُها «السؤال ١»
            #  فلو دخلت السلسلةَ لانقطعت عندها، ولم يُعرف الموروثُ ممّا
            #  يخصّ الشريحة.
            if rub and "data-q" not in m.group(0)[:200]:
                prev_rub = rub
                #  ويُحفظ الأصلُ كما في الملفّ: الموروثُ يُقاس به،
                #  فرفعٌ سابقٌ لا يقطع السلسلةَ على من بعده.
                prev_orig = txt(RUB.search(m.group(0)).group(2)) \
                    if RUB.search(m.group(0)) else prev_orig

        new = "".join(out) + html[last:]
        if new == html:
            continue
        #  حارس: ما نقص من الملفّ لا يزيد على عناوينَ موروثةٍ استُبدلت
        a, b = bare(html), bare(new)
        assert len(b) >= len(a) - 400, os.path.basename(path) + ": نقصٌ أكبر من المتوقَّع"
        if not check:
            io.open(path, "w", encoding="utf-8").write(new)

    for l in log:
        print("  ✎ " + l)
    for w in warn:
        print("  ⚠ " + w)
    want = len(LIFT) + len(FOLD) + len(DOT)
    print("\nمواضعُ مسمّاة: %d · %s: %d" % (want, "سيُصلَح" if check else "أُصلح", len(log)))
    return 1 if (check and log) else 0


if __name__ == "__main__":
    sys.exit(main())
