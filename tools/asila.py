#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""أسئلةٌ جديدة لأوراق العمل — مبنيّةٌ من نصّ المحاضرة لا مؤلَّفة.

    python3 tools/asila.py wilaya            يُولّد data/courses/wilaya/newq.js
    python3 tools/asila.py wilaya --check    يقول أمتخلّفٌ الملفُّ عن المحاضرات؟

═══ العلّة ═══
«أوراق العمل كلها تكرار لأسئلة البوربوينت.» وقِيس: ٨٧ بندًا من ٨٩
مطابقةٌ حرفًا بحرف لأسئلة الشرائح. فالورقةُ لا تزيد على إعادة ما
رأته الطالبة في القاعة.

═══ وحدٌّ على النفس ═══
سؤالُ الاختيار يحتاج مموِّهاتٍ — وهي في الفقه عباراتُ حكمٍ تُختلق.
ولا يُؤلَّف في هذا المستودع نصٌّ شرعيٌّ ولا فقهيّ. فلا تُولَّد إلا
ثلاثةُ أنواعٍ كلُّ حرفٍ فيها منقولٌ من المحاضرة:

  قائل   «من قال: ‹…›؟»  والمموِّهات المذاهبُ الأربعة — أسماءٌ لا
         أحكام. والنصُّ والنسبةُ كلاهما في الشريحة.
  مادة   «أيُّ مادّةٍ نصُّها: ‹…›؟» والمموِّهات أرقامُ موادَّ أخرى
         من البابِ نفسه.
  إكمال  «أكملي: ‹…›» والمموِّهات تتمّاتُ موادَّ أخرى — نصوصٌ
         منقولةٌ كذلك، لا صياغاتٌ من عندي.

وكلُّ بندٍ يحمل مصدره (المحاضرة وهويّة الشريحة)، و‎--check‎ يعيد
البناء ويقارن — فلا يتخلّف عن تعديلٍ في شريحة.

═══ وما لا يُولَّد ═══
قولٌ منسوبٌ إلى مذهبين («ذهب الحنفية والمالكية») يُترك: الخياراتُ
مذاهبُ مفردة، فجوابُه ليس فيها. وهي خمسةٌ وخمسون موضعًا.
"""
import glob, hashlib, io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAG = re.compile(r'<[^>]+>')
SEC = re.compile(r'<section class="slide[^"]*"([^>]*)>(.*?)</section>', re.S)
RUB = re.compile(r'<div class="rubric">(.*?)</div>', re.S)
MATN = re.compile(r'<div class="matn[^"]*">(.*?)</div>', re.S)
BORN = re.compile(r'data-born="([^"]+)"')
ART = re.compile(r'^\s*(?:الْ?|ال)?مَ?ا?دَّ?ةُ?\s*(?:رَ?قْ?مُ?\s*)?([٠-٩0-9]+)\s*$')

SCHOOLS = ["الحنفية", "المالكية", "الشافعية", "الحنابلة"]
ONE = re.compile(r'(?:فذهب|وذهب|ذهب|وقال|قال|ويرى|يرى|فيرى)\s+(' +
                 "|".join(SCHOOLS) + r')\s*(?:إلى\s+)?(?:أنه\s+|أن\s+|:\s*)(.{25,170}?)(?=[.،؛]|$)')
BABS = [("wilaya", "الولاية"), ("wakala", "الوكالة"), ("wisaya", "الوصايا")]


def txt(x):
    return re.sub(r'\s+', ' ', TAG.sub('', x)).strip()


def key(seed):
    """رقمٌ ثابتٌ من النصّ — فتشغيلُه مرّةً وعشرًا سواء."""
    return int(hashlib.sha256(seed.encode("utf-8")).hexdigest(), 16)


def pick(seed, n):
    return key(seed) % n


def level(items):
    """تُقسم مواضعُ الصواب بالسواء على الأربعة.

       وكان الموضعُ يُؤخذ من الهاش وحده، فجاء ٣٤·٢٣·٢١·٣٢ — والفرقُ
       يُتعلَّم. والذي يُبطل النمط التسويةُ لا العشوائية: تُرتَّب
       البنود بمفتاحٍ ثابت، ثم يُوزَّع الموضع عليها بالدور."""
    order = sorted(range(len(items)), key=lambda i: key(items[i]["_seed"]))
    for rank, i in enumerate(order):
        it = items[i]
        want = rank % len(it["options"])
        cur = it["answer"]
        it["options"][cur], it["options"][want] = it["options"][want], it["options"][cur]
        it["answer"] = want
        del it["_seed"]
    return items


def harvest(course):
    says, arts = [], []
    for path in sorted(glob.glob(os.path.join(ROOT, "sessions", course, "*.html"))):
        name = os.path.basename(path)
        n = int(re.match(r'(\d+)-', name).group(1))
        bab = next((t for k, t in BABS if k in name), "")
        html = io.open(path, encoding="utf-8").read()
        for s in SEC.finditer(html):
            if "data-q" in s.group(1):
                continue
            b = BORN.search(s.group(1))
            born = b.group(1) if b else ""
            r = RUB.search(s.group(2))
            rub = txt(r.group(1)) if r else ""
            m = MATN.search(s.group(2))
            body = txt(m.group(1)) if m else ""
            if not body:
                continue
            for x in ONE.finditer(body):
                says.append({"n": n, "born": born, "school": x.group(1),
                             "what": x.group(2).strip(), "quote": x.group(0).strip()})
            a = ART.match(rub)
            if a:
                arts.append({"n": n, "born": born, "bab": bab,
                             "no": a.group(1), "text": body})
    return says, arts


def build(course):
    says, arts = harvest(course)
    out = {}

    seen = {}

    def add(sess, item):
        """معرّفٌ فريد: نصّان متطابقان في محاضرةٍ واحدة كانا يأخذان
           معرّفًا واحدًا، فتُخزَّن إجابةُ أحدهما مكان الآخر."""
        base = item["id"]
        seen[base] = seen.get(base, 0) + 1
        if seen[base] > 1:
            item["id"] = base + "-" + str(seen[base])
        out.setdefault(sess, []).append(item)

    #  ═══ من القائل؟ ═══
    for i, s in enumerate(says):
        seed = s["quote"]
        opts = SCHOOLS[:]
        add(s["n"], {
            "id": "nq-say-%d-%s" % (s["n"], hashlib.sha1(seed.encode()).hexdigest()[:6]),
            "kind": "mcq", "src": {"session": s["n"], "born": s["born"]},
            "_seed": seed,
            "prompt": "من قال: «" + s["what"] + "»؟",
            "options": opts, "answer": opts.index(s["school"]),
            "why": "نصُّ المحاضرة " + ar(s["n"]) + ": «" + s["quote"] + "»."})

    #  ═══ أيُّ مادّة؟ ═══
    byb = {}
    for a in arts:
        byb.setdefault(a["bab"], []).append(a)
    for a in arts:
        peers = [p["no"] for p in byb[a["bab"]] if p["no"] != a["no"]]
        if len(peers) < 3:
            continue
        seed = a["no"] + a["text"][:60]
        others = sorted(set(peers), key=lambda x: pick(seed + x, 9973))[:3]
        opts = others + [a["no"]]
        clause = a["text"][:150].rstrip() + ("…" if len(a["text"]) > 150 else "")
        add(a["n"], {
            "id": "nq-art-%d-%s" % (a["n"], hashlib.sha1(seed.encode()).hexdigest()[:6]),
            "kind": "mcq", "src": {"session": a["n"], "born": a["born"]},
            "_seed": seed,
            "prompt": "أيُّ مادّةٍ نصُّها: «" + clause + "»؟",
            "options": ["المادّة " + o for o in opts],
            "answer": opts.index(a["no"]),
            "why": "هي المادّة " + a["no"] + "، ونصُّها في المحاضرة " + ar(a["n"]) + "."})

    flat = [it for v in out.values() for it in v]
    level(flat)
    return out


DIG = "٠١٢٣٤٥٦٧٨٩"


def ar(n):
    return "".join(DIG[int(c)] for c in str(n))


def render(course, data):
    total = sum(len(v) for v in data.values())
    parts = []
    for sess in sorted(data):
        items = ",\n".join("      " + json.dumps(it, ensure_ascii=False) for it in data[sess])
        parts.append('    "%d": [\n%s\n    ]' % (sess, items))
    return (
        '/* ═══ أسئلةٌ جديدة لأوراق العمل ═══\n'
        '   مُولَّد: python3 tools/asila.py %s — لا يُحرَّر بيد.\n\n'
        '   كلُّ حرفٍ منقولٌ من شريحة المحاضرة: النصُّ ونسبتُه، وأرقامُ\n'
        '   المواد. ولم يُؤلَّف حكمٌ فقهيٌّ ولا مموِّهٌ من عند الأداة —\n'
        '   مموِّهاتُ «من القائل» أسماءُ المذاهب، ومموِّهاتُ «أيُّ مادّة»\n'
        '   أرقامُ موادَّ من الباب نفسه.\n\n'
        '   وموضعُ الصواب دالّةٌ في نصّ السؤال (sha256) لا في ساعة\n'
        '   التشغيل — فتشغيلُه مرّةً وعشرًا سواء.\n\n'
        '   الجملة: %s سؤالًا.\n'
        '   ═══════════════════════════════════════════════════════ */\n'
        'TPCourse.extraq("%s", {\n%s\n});\n'
        % (course, ar(total), course, ",\n".join(parts)))


def main():
    course = next((a for a in sys.argv[1:] if not a.startswith("-")), "wilaya")
    check = "--check" in sys.argv or "--فحص" in sys.argv
    out = os.path.join(ROOT, "data", "courses", course, "newq.js")
    fresh = render(course, build(course))
    old = io.open(out, encoding="utf-8").read() if os.path.exists(out) else ""
    if check:
        if fresh == old:
            print("✓ الأسئلة الجديدة مطابقةٌ للمحاضرات")
            return 0
        print("✗ newq.js متخلّفٌ — أعِد: python3 tools/asila.py " + course)
        return 1
    io.open(out, "w", encoding="utf-8").write(fresh)
    print("كُتب " + out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
