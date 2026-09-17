/* ═══ بناء ورقة الاختبار من البنك ═══
   لا يلمس الشاشة ولا التخزين: يأخذ تعريف الاختبار ورقم النموذج
   فيُرجع أسئلته، ويصحّح الإجابات. فيُختبر وحده بلا متصفّح.

       TPQuiz.paper(exam, form)      → [ {kind, id, prompt, …}, … ]
       TPQuiz.formOf(exam, student)  → رقم النموذج
       TPQuiz.grade(exam, paper, answers) → { raw, max, auto, manual, rows }
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ─── تسوية العربية لمطابقة الإكمال ───
     الطالبة تكتب «الأنوثه» و«الأنوثة» و«الانوثة» وكلها صواب.
     فتُزال الحركات والتطويل، وتُوحَّد صور الألف والياء والتاء
     المربوطة، ثم يُقارَن. ولا يُزال «ال» — فقد يكون فارقًا. */
  function norm(s) {
    return String(s == null ? "" : s)
      .replace(/[ً-ْٰـ]/g, "")   /* حركات وتطويل */
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[^؀-ۿ0-9a-zA-Z]+/g, " ")
      .trim();
  }

  /* ─── النموذج ───
     رقم الكشف لا معرّف الطالبة: الجالستان جنبًا إلى جنب رقماهما
     متتاليان، فنموذجاهما مختلفان. وهو ثابتٌ لا يتبدّل بإعادة
     التحميل ولا يحتاج تخزينًا. */
  function formOf(exam, student) {
    var n = +(student && student.no) || 1;
    var forms = Math.max(1, +exam.forms || 1);
    return (n - 1) % forms;
  }

  /*  ═══ السحب ═══
      كل نموذجٍ يأخذ من البنك أسئلةً متباعدةً بخطوةٍ ثابتة تبدأ من
      موضعه: النموذج f يأخذ f, f+n, f+2n … (n عدد النماذج).

      ولماذا هذا لا غيره؟ لأن النماذج الخمسة المتمايزة تمامًا تقتضي
      بنكًا سعته (عدد أسئلة الورقة × ٥). فإن قصُر البنك عن ذلك —
      وهو الغالب — اشترك نموذجان في بعض الأسئلة حتمًا؛ لا حيلة في
      ذلك ولا يُدَّعى خلافه. والشريحة المتّصلة تجعل الاشتراك كتلةً
      واحدة، وقد تجعل نموذجين متطابقين رأسًا إذا التفّت على البنك.
      والخطوة تفرّق المشترَك على الورقة كلها.

      والحساب ثابت: لا عشوائية فيه، فالنموذج الأول اليومَ هو
      النموذج الأول غدًا — تطبعه الدكتورة وتصحّح به. */
  function slice(bank, count, form, forms) {
    if (!bank || !bank.length) return [];
    var n = Math.max(1, forms || 1);
    var len = bank.length;
    var step = n;
    /*  لو قسمت الخطوةُ حجمَ البنك لدارت على أقلّ من count سؤالًا
        فتكرّرت. تُزاد حتى لا تشترك مع الحجم في قاسم. */
    while (gcd(step, len) !== 1 && step < len + n) step++;
    var out = [], seen = {};
    for (var i = 0; out.length < count && i < len * 2; i++) {
      var ix = (form + i * step) % len;
      if (seen[ix]) continue;
      seen[ix] = 1;
      out.push(bank[ix]);
    }
    return out;
  }

  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }

  /*  مرجعٌ إلى سؤال ورقة عمل يُحلّ إلى السؤال نفسه — فتصحيح الدكتورة
      لنصّه في أوراق العمل يسري على الاختبار تلقائيًّا. */
  function resolve(q, sheets) {
    if (!q || !q.ref) return q;
    var parts = String(q.ref).split("#");
    var w = (sheets || []).filter(function (x) { return x.id === parts[0]; })[0];
    if (!w) return null;
    var it = (w.items || []).filter(function (x) { return x.id === parts[1]; })[0];
    if (!it) return null;
    return {
      kind: "mcq", id: parts[1], ref: q.ref,
      prompt: it.prompt, options: it.options, answer: it.answer, why: it.why
    };
  }

  /*  خلطٌ ثابتٌ بمفتاح: ترتيبٌ واحد لكل نموذج، لا يتبدّل بإعادة
      التحميل. (مولّد خطّي بسيط — المقصود اختلاف الترتيب لا سرّيته.) */
  function shuffled(list, seed) {
    var a = list.slice(), s = (seed + 1) * 2654435761 % 4294967296;
    for (var i = a.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) % 2147483648;
      var j = s % (i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function paper(exam, form, sheets) {
    sheets = sheets || window.WORKSHEETS || [];
    var out = [];
    (exam.structure || []).forEach(function (part, pi) {
      var bank = (exam.bank || {})[part.kind] || [];
      var picked = [];
      slice(bank, part.count, form, exam.forms).forEach(function (q) {
        var r = resolve(q, sheets);
        if (!r) return;                    /* مرجعٌ مكسور يُتخطّى بصمت */
        picked.push(Object.assign({}, r, {
          kind: r.kind || part.kind,
          points: part.points,
          part: part.label
        }));
      });
      /*  البنك قد يكون أضيق من (عدد الأسئلة × عدد النماذج)، فيشترك
          نموذجان في بعض الأسئلة لا محالة. والخلط يجعل المشترَك في
          موضعٍ مختلف من الورقتين — فلا تنفع الجارةَ إجابةُ جارتها
          على «السؤال السابع». ولو وُسِّع البنك لانقطع الاشتراك رأسًا.
          وصفحة الاختبار تُعلم الدكتورة بمقدار الاشتراك. */
      shuffled(picked, form * 17 + pi).forEach(function (q) { out.push(q); });
    });
    return out;
  }

  /*  ═══ سعة البنك ═══
      لتكون النماذج متمايزةً تمامًا يلزم أن يبلغ بنكُ كل نوع
      (عدد أسئلته في الورقة × عدد النماذج). فإن قصُر اشترك نموذجان
      في بعض الأسئلة لا محالة — والخلط يفرّق مواضعها لا أعيانها.
      فتُحسب هنا الحاجة ويُقال العددُ صراحةً في صفحة الاختبار، بدل
      إيهام الدكتورة أن النماذج الخمسة لا تشترك في شيء. */
  function need(exam) {
    var n = Math.max(1, +exam.forms || 1);
    return (exam.structure || []).map(function (part) {
      var have = ((exam.bank || {})[part.kind] || []).length;
      var want = part.count * n;
      return { kind: part.kind, label: part.label, have: have, want: want,
               short: Math.max(0, want - have) };
    });
  }

  /*  كم سؤالًا يشترك فيه أسوأ نموذجين، وكم منها في الموضع نفسه —
      تُعرضان في صفحة الاختبار فتعرف الدكتورة أتحتاج توسيع البنك. */
  function spread(exam, sheets) {
    var n = Math.max(1, +exam.forms || 1);
    var papers = [];
    for (var f = 0; f < n; f++) papers.push(paper(exam, f, sheets));
    var shared = 0, samePlace = 0;
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        var ids = {};
        papers[j].forEach(function (q, k) { ids[q.id] = k; });
        var c = 0, sp = 0;
        papers[i].forEach(function (q, k) {
          if (ids[q.id] != null) { c++; if (ids[q.id] === k) sp++; }
        });
        if (c > shared) shared = c;
        if (sp > samePlace) samePlace = sp;
      }
    }
    return { forms: n, size: papers[0].length, shared: shared, samePlace: samePlace };
  }

  /* ─── التصحيح ───
     «دلّل» لا يُصحَّح آليًّا: يُترك للدكتورة، ويُفصَل مجموعُه عن
     المجموع الآليّ حتى لا تُظنّ الدرجة تامّةً وهي ناقصة. */
  function grade(exam, paper, answers) {
    answers = answers || {};
    var auto = 0, autoMax = 0, manualMax = 0, rows = [];

    paper.forEach(function (q) {
      var a = answers[q.id];
      var got = null;                       /* null = تُصحَّح بيد */

      if (q.kind === "tf") {
        got = (a === true || a === false) && a === q.answer ? q.points : 0;
      } else if (q.kind === "mcq") {
        got = (a != null && +a === +q.answer) ? q.points : 0;
      } else if (q.kind === "cloze") {
        var want = (q.accept || []).map(norm);
        got = want.indexOf(norm(a)) >= 0 ? q.points : 0;
      }

      if (got === null) manualMax += q.points;
      else { auto += got; autoMax += q.points; }

      rows.push({ id: q.id, kind: q.kind, points: q.points,
                  got: got, answer: a });
    });

    return { auto: auto, autoMax: autoMax, manualMax: manualMax,
             max: autoMax + manualMax, rows: rows };
  }

  window.TPQuiz = { paper: paper, formOf: formOf, grade: grade,
                    norm: norm, spread: spread, need: need };
})();
