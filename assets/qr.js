/* ═══════════════════════════════════════════════════════════════
   مولّد رمز QR — مكتوب هنا بالكامل بلا أي اعتمادية خارجية، حتى
   تعمل المنصة بلا إنترنت ومن القرص مباشرةً.

   نمط البايت، مستوى تصحيح الخطأ M، الإصدارات ١–٢٠.
       QR.matrix(text)        → { size, rows:[[0|1,…],…] }
       QR.svg(text, opts)     → نص SVG جاهز للعرض أو الطباعة
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* عدد كلمات التصحيح لكل كتلة، وتوزيع الكتل — لمستوى M وحده */
  var EC_M = {
    1:[10,1,16,0,0],   2:[16,1,28,0,0],   3:[26,1,44,0,0],   4:[18,2,32,0,0],
    5:[24,2,43,0,0],   6:[16,4,27,0,0],   7:[18,4,31,0,0],   8:[22,2,38,2,39],
    9:[22,3,36,2,37], 10:[26,4,43,1,44], 11:[30,1,50,4,51], 12:[22,6,36,2,37],
   13:[22,8,37,1,38], 14:[24,4,40,5,41], 15:[24,5,41,5,42], 16:[28,7,45,3,46],
   17:[28,10,46,1,47],18:[26,9,43,4,44], 19:[26,3,44,11,45],20:[26,3,41,13,42]
  };

  var ALIGN = {
    1:[], 2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30], 6:[6,34], 7:[6,22,38],
    8:[6,24,42], 9:[6,26,46], 10:[6,28,50], 11:[6,30,54], 12:[6,32,58],
    13:[6,34,62], 14:[6,26,46,66], 15:[6,26,48,70], 16:[6,26,50,74],
    17:[6,30,54,78], 18:[6,30,56,82], 19:[6,30,58,86], 20:[6,34,62,90]
  };

  /* ─── حساب في الحقل GF(256) ─── */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gmul(a, b) { return (a && b) ? EXP[LOG[a] + LOG[b]] : 0; }

  function rsPoly(n) {
    var poly = [1];
    for (var i = 0; i < n; i++) {
      var next = poly.concat([0]);
      for (var j = 0; j < poly.length; j++) {
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function ecBytes(data, n) {
    var gen = rsPoly(n), res = data.concat(new Array(n).fill(0));
    for (var i = 0; i < data.length; i++) {
      var c = res[i];
      if (!c) continue;
      for (var j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], c);
    }
    return res.slice(data.length);
  }

  /* ─── تجهيز البيانات ─── */
  function utf8(str) {
    if (typeof TextEncoder !== "undefined") {
      return Array.prototype.slice.call(new TextEncoder().encode(str));
    }
    var out = [], s = unescape(encodeURIComponent(str));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function capacity(v) {
    var e = EC_M[v];
    return e[1] * e[2] + e[3] * e[4];
  }

  function pickVersion(len) {
    for (var v = 1; v <= 20; v++) {
      var cc = v < 10 ? 8 : 16;                 /* بتات عدّاد الطول */
      var need = 4 + cc + len * 8;
      if (capacity(v) * 8 >= need) return v;
    }
    throw new Error("النص أطول مما يتسع له رمز QR هنا.");
  }

  function bitStream(bytes, v) {
    var bits = [];
    function push(val, n) {
      for (var i = n - 1; i >= 0; i--) bits.push((val >> i) & 1);
    }
    push(4, 4);                                  /* نمط البايت */
    push(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { push(b, 8); });

    var cap = capacity(v) * 8;
    push(0, Math.min(4, cap - bits.length));     /* الخاتمة */
    while (bits.length % 8) bits.push(0);

    var out = [];
    for (var i = 0; i < bits.length; i += 8) {
      out.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    }
    var pad = [0xEC, 0x11], k = 0;
    while (out.length < capacity(v)) out.push(pad[k++ % 2]);
    return out;
  }

  function interleave(data, v) {
    var e = EC_M[v], ecn = e[0];
    var blocks = [], i = 0;
    for (var b = 0; b < e[1]; b++) { blocks.push(data.slice(i, i + e[2])); i += e[2]; }
    for (b = 0; b < e[3]; b++) { blocks.push(data.slice(i, i + e[4])); i += e[4]; }
    var ecs = blocks.map(function (blk) { return ecBytes(blk, ecn); });

    var out = [], max = Math.max.apply(null, blocks.map(function (b2) { return b2.length; }));
    for (var c = 0; c < max; c++) {
      blocks.forEach(function (blk) { if (c < blk.length) out.push(blk[c]); });
    }
    for (c = 0; c < ecn; c++) ecs.forEach(function (ec) { out.push(ec[c]); });
    return out;
  }

  /* ─── بناء المصفوفة ─── */
  function build(v, codewords, mask) {
    var n = v * 4 + 17;
    var m = [], fn = [];
    for (var i = 0; i < n; i++) {
      m.push(new Array(n).fill(0));
      fn.push(new Array(n).fill(0));
    }
    function set(r, c, val) { m[r][c] = val; fn[r][c] = 1; }

    function finder(r, c) {
      for (var dr = -1; dr <= 7; dr++) {
        for (var dc = -1; dc <= 7; dc++) {
          var rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
          var inner = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          var on = inner && (dr === 0 || dr === 6 || dc === 0 || dc === 6 ||
                             (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
          set(rr, cc, on ? 1 : 0);
        }
      }
    }
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);

    for (i = 8; i < n - 8; i++) {                /* أنماط التوقيت */
      var bit = i % 2 === 0 ? 1 : 0;
      set(6, i, bit); set(i, 6, bit);
    }

    var al = ALIGN[v];                            /* أنماط المحاذاة */
    al.forEach(function (r) {
      al.forEach(function (c) {
        if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) return;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            var on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            set(r + dr, c + dc, on ? 1 : 0);
          }
        }
      });
    });

    set(n - 8, 8, 1);                             /* الوحدة الداكنة */
    for (i = 0; i <= 8; i++) {                    /* حجز مواضع معلومات الصيغة */
      if (i !== 6) { set(8, i, 0); set(i, 8, 0); }
    }
    for (i = 0; i < 8; i++) { set(8, n - 1 - i, 0); set(n - 1 - i, 8, 0); }

    if (v >= 7) {                                 /* معلومات الإصدار */
      var vb = v << 12, rem = v;
      for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25);
      vb = (v << 12) | rem;
      for (i = 0; i < 18; i++) {
        var b2 = (vb >> i) & 1;
        set(Math.floor(i / 3), n - 11 + (i % 3), b2);
        set(n - 11 + (i % 3), Math.floor(i / 3), b2);
      }
    }

    /* وضع البيانات بمسار الأفعى */
    var bits = [];
    codewords.forEach(function (b3) {
      for (var k = 7; k >= 0; k--) bits.push((b3 >> k) & 1);
    });
    var idx = 0, up = true;
    for (var col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var t = 0; t < n; t++) {
        var row = up ? n - 1 - t : t;
        for (var q = 0; q < 2; q++) {
          var cc2 = col - q;
          if (fn[row][cc2]) continue;
          var bv = idx < bits.length ? bits[idx++] : 0;
          if (maskAt(mask, row, cc2)) bv ^= 1;
          m[row][cc2] = bv;
        }
      }
      up = !up;
    }

    /* معلومات الصيغة: مستوى M = 00 */
    var fmt = (0 << 3) | mask, rem2 = fmt;
    for (i = 0; i < 10; i++) rem2 = (rem2 << 1) ^ ((rem2 >> 9) * 0x537);
    var fbits = ((fmt << 10) | rem2) ^ 0x5412;
    function fb(k) { return (fbits >> k) & 1; }
    /* النسخة الأولى حول محدِّد الزاوية العليا */
    for (i = 0; i <= 5; i++) m[i][8] = fb(i);
    m[7][8] = fb(6);
    m[8][8] = fb(7);
    m[8][7] = fb(8);
    for (i = 9; i < 15; i++) m[8][14 - i] = fb(i);
    /* النسخة الثانية موزّعة على المحدِّدين الآخرين */
    for (i = 0; i < 8; i++) m[8][n - 1 - i] = fb(i);
    for (i = 8; i < 15; i++) m[n - 15 + i][8] = fb(i);
    m[n - 8][8] = 1;                              /* الوحدة الداكنة دائمًا */
    return m;
  }

  function maskAt(k, r, c) {
    switch (k) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    }
  }

  /* ─── تقييم الأقنعة واختيار أقلها عقوبة ─── */
  function penalty(m) {
    var n = m.length, p = 0, i, j, run, dark = 0;
    function lines(get) {
      for (i = 0; i < n; i++) {
        run = 1;
        for (j = 1; j < n; j++) {
          if (get(i, j) === get(i, j - 1)) { run++; }
          else { if (run >= 5) p += run - 2; run = 1; }
        }
        if (run >= 5) p += run - 2;
      }
    }
    lines(function (a, b) { return m[a][b]; });
    lines(function (a, b) { return m[b][a]; });

    for (i = 0; i < n - 1; i++) {
      for (j = 0; j < n - 1; j++) {
        var s = m[i][j] + m[i][j + 1] + m[i + 1][j] + m[i + 1][j + 1];
        if (s === 0 || s === 4) p += 3;
      }
    }
    var pat1 = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
    function find(get) {
      for (i = 0; i < n; i++) {
        for (j = 0; j + 11 <= n; j++) {
          var a = true, b = true;
          for (var k = 0; k < 11; k++) {
            var vq = get(i, j + k);
            if (vq !== pat1[k]) a = false;
            if (vq !== pat2[k]) b = false;
          }
          if (a || b) p += 40;
        }
      }
    }
    find(function (a, b) { return m[a][b]; });
    find(function (a, b) { return m[b][a]; });

    for (i = 0; i < n; i++) for (j = 0; j < n; j++) dark += m[i][j];
    p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
    return p;
  }

  function matrix(text) {
    var bytes = utf8(String(text));
    var v = pickVersion(bytes.length);
    var cw = interleave(bitStream(bytes, v), v);
    var best = null, bestP = Infinity;
    for (var k = 0; k < 8; k++) {
      var m = build(v, cw, k), p = penalty(m);
      if (p < bestP) { bestP = p; best = m; }
    }
    return { size: best.length, rows: best, version: v };
  }

  function svg(text, opts) {
    opts = opts || {};
    var q = matrix(text), n = q.size;
    var quiet = opts.quiet == null ? 4 : opts.quiet;
    var total = n + quiet * 2;
    var dark = opts.dark || "#002856", light = opts.light || "#FFFFFF";
    var d = "";
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (q.rows[r][c]) d += "M" + (c + quiet) + " " + (r + quiet) + "h1v1h-1z";
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total +
           '" shape-rendering="crispEdges" role="img" aria-label="رمز QR">' +
           '<rect width="' + total + '" height="' + total + '" fill="' + light + '"/>' +
           '<path fill="' + dark + '" d="' + d + '"/></svg>';
  }

  window.QR = { matrix: matrix, svg: svg };
})();
