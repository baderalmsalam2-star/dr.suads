#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""مولّد صفحة «مراجع المقرر» — مواد القانون كما هي في المحاضرات.

    python3 tools/build_refs.py wilaya            يُولّد data/courses/wilaya/refs.js
    python3 tools/build_refs.py wilaya --check    يقول أمتخلّفٌ الملفُّ عن المحاضرات؟

═══ لماذا يُولَّد ولا يُكتب باليد ═══
نصوصُ المواد موجودةٌ في شرائح المحاضرات. ونسخُها بيدٍ إلى ملفٍّ ثانٍ
يفتح بابَ ما وقع في evidences.js: تسعةُ نصوصٍ من خمسة عشر اختلفت عن
المحاضرة — «ﷺ» مكان اللفظ التامّ، وأقواسٌ مبدَّلة، وصياغةٌ أُعيدت.
والطالبةُ تحفظ من الصفحة وتسمع من المحاضرة، فيختلف عليها اللفظ.

فالنصُّ ههنا يُنقل آليًّا لا بيد، و‎--check‎ يكشف تخلُّفَ الملفّ متى
عُدّلت شريحة. وهو في فحص الأدوات، فلا يمرّ تعديلٌ بلا تجديد.

═══ ما لا يدخل ═══
شرائحُ المحاضرة ٨ التي عنوانها «الْمَادَّةُ رَقْمُ ٢٠٨ مَعَ مُرَاعَاةِ
أَحْكَامِ الْمَوَادِّ» موقوفة: عنوانُها مبتورٌ وأرقامُ المواد سقطت إلى
أول المتن، وتحته فقهٌ لا نصُّ مادّة. وقد رُفع الأمر إلى الدكتورة.
ونشرُ نصٍّ نعلم أن عنوانه في غير موضعه أسوأُ من تأخيره.
"""
import io, json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

#  عنوانٌ يبدأ بـ«مادة» مشكولةً أو مجرَّدة، يتلوها «رقم» اختيارًا ثم عدد.
ART = re.compile(r'^\s*(?:الْ?|ال)?مَ?ا?دَّ?ةُ?\s*(?:رَ?قْ?مُ?\s*)?([٠-٩0-9]+)\s*$')
SLIDE = re.compile(
    r'<section class="slide"([^>]*)>\s*'
    r'<div class="rubric">([^<]*)</div>\s*'
    r'<div class="matn[^"]*">(.*?)</div>\s*</section>', re.S)
PARA = re.compile(r'<p>(.*?)</p>', re.S)
SRC = re.compile(r'data-src="([^"]*)"')
TAGS = re.compile(r'<[^>]+>')

#  البابُ من اسم الملفّ نفسه، لا من اجتهادٍ في أرقام المواد.
BABS = [("wilaya", "الْوِلَايَةُ"), ("wakala", "الْوَكَالَةُ"), ("wisaya", "الْوَصَايَا")]

STOP = "مَعَ مُرَاعَاةِ"          # عنوانُ المحاضرة ٨ الموقوف


def strip(t):
    return re.sub(r'\s+', ' ', TAGS.sub('', t)).strip()


def harvest(course):
    out = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "sessions", course, "*.html"))):
        name = os.path.basename(path)
        m = re.match(r'(\d+)-', name)
        if not m:
            continue
        session = int(m.group(1))
        bab = next((t for k, t in BABS if k in name), None)
        if not bab:
            continue
        html = io.open(path, encoding="utf-8").read()
        prev = None                     # لدمج الشرائح المتتابعة تحت رقمٍ واحد
        for s in SLIDE.finditer(html):
            attrs, rub, body = s.group(1), s.group(2).strip(), s.group(3)
            if STOP in rub:
                prev = None
                continue
            hit = ART.match(rub)
            if not hit:
                prev = None
                continue
            no = hit.group(1)
            src = (SRC.search(attrs).group(1) if SRC.search(attrs) else "")
            paras = [strip(p) for p in PARA.findall(body)]
            paras = [p for p in paras if p]
            key = (bab, no)
            if prev == key and key in out:
                out[key]["text"].extend(paras)      # تتمّةُ المادّة نفسها
            else:
                out[key] = {"no": no, "bab": bab, "session": session,
                            "src": src, "text": paras}
            prev = key
    return out


def arabic(n):
    """للترتيب: الأرقام العربية-الهندية تُقرأ عددًا."""
    return int(n.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")))


def render(course, rows):
    groups = []
    for _, bab in BABS:
        items = sorted([r for r in rows.values() if r["bab"] == bab],
                       key=lambda r: (arabic(r["no"]), r["session"]))
        if items:
            groups.append({"title": bab, "items": items})

    for g in groups:
        for it in g["items"]:
            joined = " ".join(it["text"])
            it["mixed"] = bool(re.search(r'الم[اأ]دة\s*رقم\s*[٠-٩0-9]', joined))

    n = sum(len(g["items"]) for g in groups)
    body = []
    for g in groups:
        lines = ["    {\n      title: %s,\n      items: [" % json.dumps(g["title"], ensure_ascii=False)]
        for it in g["items"]:
            txt = ",\n".join("          " + json.dumps(p, ensure_ascii=False) for p in it["text"])
            lines.append(
                '        { no: %s, session: %d, src: %s,%s\n          text: [\n%s\n          ] },'
                % (json.dumps(it["no"], ensure_ascii=False), it["session"],
                   json.dumps(it["src"], ensure_ascii=False),
                   " mixed: true," if it["mixed"] else "", txt))
        lines.append("      ]\n    }")
        body.append("\n".join(lines))

    return (
        '/* ═══ مراجع المقرر — مواد القانون الكويتي ═══\n'
        '   مُولَّد من شرائح المحاضرات: python3 tools/build_refs.py %s\n'
        '   لا يُحرَّر بيد. النصُّ منقولٌ آليًّا من الشريحة، فلا يختلف\n'
        '   ما تحفظه الطالبة عمّا تسمعه في المحاضرة. وأيُّ تعديلٍ في\n'
        '   شريحةٍ يُعاد التوليدُ بعده — وفحصُ الأدوات يكشف تخلّفَه.\n\n'
        '   والمادّة ٢٠٨ موقوفةٌ حتى تراجع الدكتورة عنوانها في المحاضرة ٨.\n'
        '   ═══════════════════════════════════════════════════════════ */\n'
        'TPCourse.refs("%s", {\n'
        '  title: "مَرَاجِعُ الْمُقَرَّرِ",\n'
        '  scope: "مواد القانون الكويتي · %d مادّة",\n'
        '  note: "نصُّ كل مادّة كما ورد في محاضرتها، ومعه رقمُ المحاضرة ورابطُها.",\n'
        '  groups: [\n%s\n  ]\n});\n'
        % (course, course, n, ",\n".join(body)))


def main():
    if len(sys.argv) < 2:
        print("الاستعمال: build_refs.py <المقرر> [--check]"); return 2
    course = sys.argv[1]
    check = "--check" in sys.argv
    out = os.path.join(ROOT, "data", "courses", course, "refs.js")
    fresh = render(course, harvest(course))
    old = io.open(out, encoding="utf-8").read() if os.path.exists(out) else ""
    if check:
        if fresh == old:
            print("✓ مراجع المقرر مطابقةٌ للمحاضرات")
            return 0
        print("✗ refs.js متخلّفٌ عن المحاضرات — أعِد: python3 tools/build_refs.py " + course)
        return 1
    io.open(out, "w", encoding="utf-8").write(fresh)
    print("كُتب " + out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
