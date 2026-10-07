/* sims/a1e01-v1.0.1.js  (published as sims/a1e01.js)
   Case a1e01 "What Learning Means": a curve-fitting lab for the Skerrow Head storm predictor.
   LATENT's first sim and its template.

   CHANGELOG
   v1.0.1 (2026-10-07) independent review fixes: the error note says choosing the degree by the
     held-back storms makes them a validation set, which flatters the winner's score a little;
     reshuffle keeps Tuesday's storm held back and picks the other held-back storms around it (its
     Fisher-Yates pass now draws one api.rand() fewer); the "over" verdict starts at 1.25 times the
     lowest test error (was 1.5); stronger self-tests: the lowest test error exactly at degree 3, test
     errors of 39.9 and 3.4 knots checked directly, the degree-12 logbook curve at -12.5673 knots for
     7.5 hPa and -139.388 for 1.8 hPa, Tuesday still held back after a reshuffle, and every message now
     states exactly what it checks.
   v1.0.0 (2026-10-07) first version: a widget-style sim built inside api.root (no diagram), drawn as
     two inline SVG charts that use theme classes only. The storm chart plots every storm (barometer
     fall in hPa across, strongest gust in knots up): training storms, held-back test storms, Tuesday's
     storm ringed, the model's curve at the chosen degree with its miss on Tuesday, and the hidden
     pattern on request. The error chart plots training error and test error for every degree from 1
     to 12, rings the lowest test error and marks the chosen degree. Controls: degree (1 to 12), more
     (type in 10 storms from the paper logbooks, 6 times at most), shuffle (reshuffle which storms are
     held back, seeded api.rand()), truth (show the hidden pattern), reset. Stats: training error, test
     error, the gap, Tuesday's forecast, storms in training, storms held back. selfTest covers Tuesday's
     setup, training error never rising with the degree, the lowest test error at a middle degree, the
     clear margin at degree 12, the stats at degrees 1 and 3, least squares recovering a known line,
     more data shrinking the degree-12 gap, a deterministic split for a fixed seed, and the paper
     logbooks running out.

   Where every number comes from (conventions rule 14; the case is content/latent/a1/a1e01-v1.0.1.json):
   - post: the 13 logbook storms of 2013 to 2025 (LOGBOOK below, all 13 in the training set), degree 1
     missing them by about 6 knots (5.7 here), degree 12 with 13 numbers to tune and a replay miss of
     0 knots, Tuesday's fall of 7.5 hPa at 01:40, the -13 knot forecast (-12.57 rounded) and the 58
     knot gust at 04:12, 2014 and 2018 both at 13 knots.
   - comments: no storm between 6.5 and 9.0 hPa; the 65 paper storms back to 1951; the five typed in
     on Wednesday night, 1987 to 2010 (PAPER_FIRST), four missed at degree 12 by more than 12 knots,
     one by over 60 (12.9, 21.7, 60.5 and 16.1; the fifth by 2.2).
   - reply options and explanation: degree 12 misses the six held-back storms by 39.9 knots against
     0.0; degree 1 by 7.8 against 5.7, and forecasts 44 for Tuesday; degree 3 by 3.4 against 3.6, and
     forecasts 51; degree 12 says -139 knots at 1.8 hPa (the curve, clipped off the chart).
   - tryThis and explanation: three batches from the paper logbooks give 34 storms to train on, and
     with the default seed the degree-12 gap falls from 39.9 to about 1.5 knots.
   - The storms typed in with "more" are a teaching model, as sim.lede says: x is uniform between
     1.5 and 11.7 hPa (inside the logbook's mildest, 1.4, and worst, 11.8), y is the hidden pattern
     plus Gaussian noise of 3.5 knots, rounded to whole knots. The 18 storms of the story were chosen
     the same way and then fixed, so the starting numbers above never depend on api.rand().

   Notes for anyone copying this file as a LATENT template:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the whole widget inside api.root on every reset. No step() is
     needed because nothing animates; every number is worked out the moment a control changes.
   - The model is a polynomial in Chebyshev form over x mapped to [-1, 1], fitted by Householder QR
     least squares. One QR of all 13 columns gives every degree at once, because Householder works
     column by column: the fit for degree d uses the first d + 1 columns only. Raw powers of x would
     be badly conditioned at degree 12; this stays accurate to about 1e-10.
   - api.rand() is used in exactly two places, in a fixed order, so a self-test can replay it: "more"
     draws x, then two numbers for the noise, for each of 10 storms, then 3 picks for the test set;
     "shuffle" runs one Fisher-Yates pass. The engine reseeds api.rand() on every reset.
   - The mildest and the worst storm always stay in training, so a reshuffle never asks the model to
     extrapolate beyond what it studied (a degree-12 curve would answer in thousands of knots).
     Tuesday's storm always stays held back, so its forecast is always a test of something unseen.
   - Stats get bare numbers (units live in the labels), so t.stat() returns numbers.
   - Colors come only from theme classes: dot, dot-req, dot-fail, dot-bad, dot-ok, dot-accent, dg-edge
     with tone-*, dg-axis, dg-marker and dg-note. In LATENT views tone-accent and dot-accent turn cyan,
     so the text names the model's curve by its shape (the solid line), not its color.
*/
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- the story's numbers ---------- */

  // The electronic logger's 13 storms, 2013 to 2025: how far the barometer fell in the 3 hours before
  // (hPa) and the strongest gust in the 12 hours after (knots). Bryn's predictor was trained on these.
  var LOGBOOK = [
    { year: 2013, x: 5.9, y: 47 }, { year: 2014, x: 2.3, y: 13 }, { year: 2015, x: 9.6, y: 59 },
    { year: 2016, x: 4.6, y: 27 }, { year: 2017, x: 11.8, y: 57 }, { year: 2018, x: 3.1, y: 13 },
    { year: 2019, x: 10.4, y: 60 }, { year: 2020, x: 1.4, y: 17 }, { year: 2021, x: 6.5, y: 44 },
    { year: 2022, x: 9.0, y: 56 }, { year: 2023, x: 3.8, y: 19 }, { year: 2024, x: 11.1, y: 64 },
    { year: 2025, x: 5.2, y: 30 }
  ];
  var TUESDAY = { year: 2026, x: 7.5, y: 58 };    // fell 7.5 hPa by 01:40; the gauge logged 58 at 04:12
  // The five storms Bryn typed in from the paper logbooks on Wednesday night.
  var PAPER_FIRST = [
    { year: 1987, x: 2.7, y: 15 }, { year: 1994, x: 4.2, y: 24 }, { year: 2001, x: 6.9, y: 45 },
    { year: 2006, x: 8.2, y: 57 }, { year: 2010, x: 10.0, y: 65 }
  ];
  var PAPER_LEFT = 60;                 // 65 paper storms in the cupboard, 5 already typed in
  var BATCH = 10;                      // storms per press of "more"
  var BATCH_TEST = 3;                  // of each batch, 3 are held back and 7 join the training set
  var MAX_DEG = 12;
  var N_COEF = MAX_DEG + 1;            // a degree-12 curve has 13 numbers to tune
  var START_DEG = 12;                  // Tuesday's setting
  var X_MIN = 1, X_MAX = 12;           // the storm chart's fall axis and the curve's domain
  var GEN_LO = 1.5, GEN_SPAN = 10.2;   // typed-in storms fall between 1.5 and 11.7 hPa
  var NOISE = 3.5;                     // knots of noise around the hidden pattern
  var Y_MIN = -40, Y_MAX = 90;         // the storm chart's gust axis, below zero on purpose
  var ERR_CAP = 20;                    // the error chart's axis; bigger errors get a label instead
  var TINY = 1e-12;
  var START_CLOCK = 23 * 3600;         // Wednesday, 11 PM
  var NARRATE_DELAY = 0.4;             // real seconds of stillness on the slider before the log speaks

  // The hidden pattern every storm shares: an S-shape from about 14 knots up to about 64.
  function hidden(x) { return 14 + 50 / (1 + Math.exp(-(x - 6) / 1.1)); }

  /* ---------- the model: least squares on a Chebyshev basis ---------- */

  function toU(x) { return (2 * x - (X_MIN + X_MAX)) / (X_MAX - X_MIN); }

  function basisRow(x) {
    var u = toU(x), row = [1, u];
    for (var k = 2; k < N_COEF; k++) row.push(2 * u * row[k - 1] - row[k - 2]);
    return row;
  }

  // Householder QR of the n x 13 basis matrix, applied to the labels too.
  // Returns R (in the top rows of A) and z = Q^T y.
  function qrFit(xs, ys) {
    var n = xs.length, m = Math.min(N_COEF, n);
    var A = [], z = ys.slice(), i, j, k, s, f;
    for (i = 0; i < n; i++) A.push(basisRow(xs[i]));
    for (k = 0; k < m; k++) {
      var norm = 0;
      for (i = k; i < n; i++) norm += A[i][k] * A[i][k];
      norm = Math.sqrt(norm);
      if (norm === 0) continue;
      var alpha = A[k][k] > 0 ? -norm : norm;
      var v = [];
      for (i = k; i < n; i++) v.push(A[i][k]);
      v[0] -= alpha;
      var vv = 0;
      for (i = 0; i < v.length; i++) vv += v[i] * v[i];
      if (vv === 0) continue;
      for (j = k; j < N_COEF; j++) {
        s = 0;
        for (i = k; i < n; i++) s += v[i - k] * A[i][j];
        f = 2 * s / vv;
        for (i = k; i < n; i++) A[i][j] -= f * v[i - k];
      }
      s = 0;
      for (i = k; i < n; i++) s += v[i - k] * z[i];
      f = 2 * s / vv;
      for (i = k; i < n; i++) z[i] -= f * v[i - k];
    }
    return { R: A, z: z, m: m, n: n };
  }

  // The d + 1 coefficients of the degree-d fit, by back-substitution on the leading block of R.
  function coeffsFor(fit, d) {
    var top = Math.min(d, fit.m - 1), c = [], i, j;
    for (i = 0; i <= d; i++) c.push(0);
    for (i = top; i >= 0; i--) {
      var s = fit.z[i];
      for (j = i + 1; j <= top; j++) s -= fit.R[i][j] * c[j];
      var r = fit.R[i][i];
      c[i] = Math.abs(r) > TINY ? s / r : 0;
    }
    return c;
  }

  function predict(c, x) {
    var u = toU(x), t0 = 1, t1 = u, sum = c[0];
    if (c.length > 1) sum += c[1] * u;
    for (var k = 2; k < c.length; k++) {
      var t2 = 2 * u * t1 - t0;
      sum += c[k] * t2;
      t0 = t1;
      t1 = t2;
    }
    return sum;
  }

  // The typical miss: root mean square error, in knots.
  function rmse(c, pts) {
    if (!pts.length) return 0;
    var s = 0;
    for (var i = 0; i < pts.length; i++) {
      var e = predict(c, pts[i].x) - pts[i].y;
      s += e * e;
    }
    return Math.sqrt(s / pts.length);
  }

  // Every degree at once, for the current split. Arrays are indexed by degree (index 0 unused).
  function analyze(pool) {
    var tr = [], te = [];
    pool.forEach(function (p) { (p.test ? te : tr).push(p); });
    var fit = qrFit(tr.map(function (p) { return p.x; }), tr.map(function (p) { return p.y; }));
    var res = { train: [null], test: [null], tue: [null], coefs: [null], nTrain: tr.length, nTest: te.length, best: 1 };
    var d;
    for (d = 1; d <= MAX_DEG; d++) {
      var c = coeffsFor(fit, d);
      res.coefs.push(c);
      res.train.push(rmse(c, tr));
      res.test.push(rmse(c, te));
      res.tue.push(predict(c, TUESDAY.x));
    }
    for (d = 2; d <= MAX_DEG; d++) if (res.test[d] < res.test[res.best]) res.best = d;
    return res;
  }

  function regime(res, d) {
    var low = res.test[res.best];
    if (d < res.best && res.test[d] > low * 1.15) return "under";
    if (d > res.best && res.test[d] > low * 1.25) return "over";
    return "near";
  }

  /* ---------- the storms ---------- */

  function startPool() {
    var pool = [];
    LOGBOOK.forEach(function (s) { pool.push({ x: s.x, y: s.y, year: s.year, src: "log", test: false }); });
    pool.push({ x: TUESDAY.x, y: TUESDAY.y, year: TUESDAY.year, src: "tue", test: true });
    PAPER_FIRST.forEach(function (s) { pool.push({ x: s.x, y: s.y, year: s.year, src: "paper", test: true }); });
    return pool;
  }

  function gaussian(api) {
    var u1 = api.rand(), u2 = api.rand();
    return Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
  }

  // Ten storms from the paper logbooks (a teaching model): 7 join the training set, 3 are held back.
  function addBatch(api) {
    var S = api.state, start = S.pool.length, idx = [], i;
    for (i = 0; i < BATCH; i++) {
      var x = GEN_LO + GEN_SPAN * api.rand();
      var y = Math.max(0, Math.round(hidden(x) + NOISE * gaussian(api)));
      S.pool.push({ x: x, y: y, year: 0, src: "more", test: false });
      idx.push(start + i);
    }
    for (i = 0; i < BATCH_TEST; i++) {
      var j = i + Math.floor(api.rand() * (BATCH - i));
      var tmp = idx[i];
      idx[i] = idx[j];
      idx[j] = tmp;
      S.pool[idx[i]].test = true;
    }
  }

  function extremes(pool) {
    var lo = 0, hi = 0;
    for (var i = 1; i < pool.length; i++) {
      if (pool[i].x < pool[lo].x) lo = i;
      if (pool[i].x > pool[hi].x) hi = i;
    }
    return { lo: lo, hi: hi };
  }

  // Hold back a different set of storms, the same number as before. One Fisher-Yates pass.
  // Tuesday's storm always stays held back; the mildest and the worst always stay in training.
  function reshuffle(api) {
    var pool = api.state.pool, nTest = 0, tue = -1, i;
    for (i = 0; i < pool.length; i++) if (pool[i].test) nTest++;
    var ex = extremes(pool), rest = [];
    for (i = 0; i < pool.length; i++) {
      if (pool[i].src === "tue") tue = i;
      else if (i !== ex.lo && i !== ex.hi) rest.push(i);
    }
    for (i = rest.length - 1; i > 0; i--) {
      var j = Math.floor(api.rand() * (i + 1));
      var tmp = rest[i];
      rest[i] = rest[j];
      rest[j] = tmp;
    }
    for (i = 0; i < pool.length; i++) pool[i].test = false;
    pool[tue].test = true;
    for (i = 0; i < nTest - 1; i++) pool[rest[i]].test = true;
  }

  function splitSignature(pool) {
    return pool.map(function (p) { return p.test ? "1" : "0"; }).join("");
  }

  /* ---------- formatting ---------- */

  function f1(v) {
    if (!isFinite(v)) return "-";
    return (Math.abs(v) < 0.05 ? 0 : v).toFixed(1);
  }
  function knots(v) {
    if (!isFinite(v)) return "-";
    var r = Math.round(v);
    return String(r === 0 ? 0 : r);
  }
  function overLabel(v) { return v >= 1000 ? "1000+" : v.toFixed(1); }
  function c1(v) { return v.toFixed(1); }

  /* ---------- the widget ---------- */

  var FIT = { l: 56, r: 664, t: 34, b: 262 };
  var ERR = { l: 56, r: 664, t: 40, b: 200 };
  var clipSeq = 0;

  function fx(x) { return FIT.l + (x - X_MIN) / (X_MAX - X_MIN) * (FIT.r - FIT.l); }
  function fy(y) { return FIT.b - (y - Y_MIN) / (Y_MAX - Y_MIN) * (FIT.b - FIT.t); }
  function ex(d) { return ERR.l + 24 + (d - 1) * (ERR.r - ERR.l - 48) / (MAX_DEG - 1); }
  function ey(e) { return ERR.b - Math.min(Math.max(e, 0), ERR_CAP) / ERR_CAP * (ERR.b - ERR.t); }
  function clampY(y) {
    if (!isFinite(y)) return y > 0 ? Y_MAX + 200 : Y_MIN - 200;
    return Math.max(Y_MIN - 200, Math.min(Y_MAX + 200, y));
  }

  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, String(attrs[k]));
    }
    if (parent) parent.appendChild(e);
    return e;
  }

  function txt(doc, parent, x, y, text, cls, anchor) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" }, parent);
    t.textContent = text;
    return t;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function curvePath(fn) {
    var parts = [], steps = 220;
    for (var i = 0; i <= steps; i++) {
      var x = X_MIN + (X_MAX - X_MIN) * i / steps;
      parts.push((i ? "L" : "M") + c1(fx(x)) + " " + c1(fy(clampY(fn(x)))));
    }
    return parts.join(" ");
  }

  function buildStormChart(doc) {
    var clipId = "a1e01-clip-" + (++clipSeq);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 680 300", width: "100%", "class": "dg", role: "img",
      "aria-label": "Storm chart: each storm's barometer fall in hPa across and its strongest gust in knots up, with the model's curve at the chosen degree."
    });
    var defs = mk(doc, "defs", {}, svg);
    var cp = mk(doc, "clipPath", { id: clipId }, defs);
    mk(doc, "rect", { x: FIT.l, y: FIT.t, width: FIT.r - FIT.l, height: FIT.b - FIT.t }, cp);

    var axes = mk(doc, "g", {}, svg);
    mk(doc, "line", { x1: FIT.l, y1: FIT.b, x2: FIT.r, y2: FIT.b, "class": "dg-axis" }, axes);
    mk(doc, "line", { x1: FIT.l, y1: FIT.t, x2: FIT.l, y2: FIT.b, "class": "dg-axis" }, axes);
    for (var v = X_MIN; v <= X_MAX; v++) {
      mk(doc, "line", { x1: c1(fx(v)), y1: FIT.b, x2: c1(fx(v)), y2: FIT.b + 4, "class": "dg-axis" }, axes);
      txt(doc, axes, c1(fx(v)), FIT.b + 16, String(v), "dg-axis", "middle");
    }
    [-40, -20, 0, 20, 40, 60, 80].forEach(function (g) {
      mk(doc, "line", { x1: FIT.l - 4, y1: c1(fy(g)), x2: FIT.l, y2: c1(fy(g)), "class": "dg-axis" }, axes);
      txt(doc, axes, FIT.l - 7, c1(fy(g) + 4), String(g), "dg-axis", "end");
    });
    mk(doc, "line", { x1: FIT.l, y1: c1(fy(0)), x2: FIT.r, y2: c1(fy(0)), "class": "dg-axis", "stroke-dasharray": "3 4" }, axes);
    txt(doc, axes, FIT.r - 4, c1(fy(0) - 5), "0 knots: no wind", "dg-axis", "end");
    txt(doc, axes, FIT.r - 4, c1(fy(-30)), "below 0: a wind that can't exist", "dg-note tone-bad", "end");
    txt(doc, axes, 360, 292, "barometer fall in the 3 hours before (hPa)", "dg-axis", "middle");
    txt(doc, axes, 8, 18, "gust (knots)", "dg-axis", "start");

    var legend = mk(doc, "g", {}, svg);
    mk(doc, "circle", { cx: 206, cy: 14, r: 4, "class": "dot dot-req" }, legend);
    txt(doc, legend, 214, 18, "training", "dg-axis", "start");
    mk(doc, "circle", { cx: 282, cy: 14, r: 4, "class": "dot dot-fail" }, legend);
    txt(doc, legend, 290, 18, "test", "dg-axis", "start");
    mk(doc, "circle", { cx: 334, cy: 14, r: 5, "class": "dot dot-bad" }, legend);
    txt(doc, legend, 343, 18, "Tuesday", "dg-axis", "start");
    mk(doc, "line", { x1: 404, y1: 14, x2: 422, y2: 14, "class": "dg-edge tone-accent", style: "stroke-width:2.5" }, legend);
    txt(doc, legend, 427, 18, "model", "dg-axis", "start");
    mk(doc, "line", { x1: 478, y1: 14, x2: 496, y2: 14, "class": "dg-edge tone-ok", "stroke-dasharray": "6 5" }, legend);
    txt(doc, legend, 501, 18, "hidden pattern", "dg-axis", "start");

    var data = mk(doc, "g", { "clip-path": "url(#" + clipId + ")" }, svg);
    var truth = mk(doc, "path", { d: "", fill: "none", "class": "dg-edge tone-ok", "stroke-dasharray": "6 5", display: "none" }, data);
    var curve = mk(doc, "path", { d: "", fill: "none", "class": "dg-edge tone-accent", style: "stroke-width:2.5" }, data);
    var miss = mk(doc, "line", { x1: 0, y1: 0, x2: 0, y2: 0, "class": "dg-marker tone-bad" }, data);
    var predDot = mk(doc, "circle", { cx: 0, cy: 0, r: 4, "class": "dot dot-accent" }, data);
    var points = mk(doc, "g", {}, svg);
    txt(doc, svg, c1(fx(TUESDAY.x)), c1(fy(TUESDAY.y) - 13), "Tuesday", "dg-note tone-bad", "middle");
    return { svg: svg, truth: truth, curve: curve, miss: miss, predDot: predDot, points: points };
  }

  function buildErrorChart(doc) {
    var svg = mk(doc, "svg", {
      viewBox: "0 0 680 240", width: "100%", "class": "dg", role: "img",
      "aria-label": "Error chart: training error and test error, as typical misses in knots, for every degree from 1 to 12."
    });
    var axes = mk(doc, "g", {}, svg);
    mk(doc, "line", { x1: ERR.l, y1: ERR.b, x2: ERR.r, y2: ERR.b, "class": "dg-axis" }, axes);
    mk(doc, "line", { x1: ERR.l, y1: ERR.t, x2: ERR.l, y2: ERR.b, "class": "dg-axis" }, axes);
    for (var d = 1; d <= MAX_DEG; d++) {
      mk(doc, "line", { x1: c1(ex(d)), y1: ERR.b, x2: c1(ex(d)), y2: ERR.b + 4, "class": "dg-axis" }, axes);
      txt(doc, axes, c1(ex(d)), ERR.b + 16, String(d), "dg-axis", "middle");
    }
    [0, 5, 10, 15, 20].forEach(function (g) {
      mk(doc, "line", { x1: ERR.l - 4, y1: c1(ey(g)), x2: ERR.l, y2: c1(ey(g)), "class": "dg-axis" }, axes);
      txt(doc, axes, ERR.l - 7, c1(ey(g) + 4), String(g), "dg-axis", "end");
    });
    txt(doc, axes, 360, 232, "degree: how bendy the curve may be", "dg-axis", "middle");
    txt(doc, axes, 8, 18, "typical miss (knots)", "dg-axis", "start");

    var legend = mk(doc, "g", {}, svg);
    mk(doc, "line", { x1: 190, y1: 14, x2: 208, y2: 14, "class": "dg-edge tone-muted" }, legend);
    mk(doc, "circle", { cx: 199, cy: 14, r: 3, "class": "dot dot-req" }, legend);
    txt(doc, legend, 213, 18, "training error", "dg-axis", "start");
    mk(doc, "line", { x1: 322, y1: 14, x2: 340, y2: 14, "class": "dg-edge tone-bad" }, legend);
    mk(doc, "circle", { cx: 331, cy: 14, r: 3, "class": "dot dot-fail" }, legend);
    txt(doc, legend, 345, 18, "test error", "dg-axis", "start");
    mk(doc, "circle", { cx: 428, cy: 14, r: 6, "class": "dot dot-ok" }, legend);
    txt(doc, legend, 438, 18, "lowest test error", "dg-axis", "start");
    mk(doc, "line", { x1: 566, y1: 7, x2: 566, y2: 21, "class": "dg-marker" }, legend);
    txt(doc, legend, 572, 18, "your degree", "dg-axis", "start");

    var marker = mk(doc, "line", { x1: 0, y1: ERR.t, x2: 0, y2: ERR.b, "class": "dg-marker" }, svg);
    var trLine = mk(doc, "path", { d: "", fill: "none", "class": "dg-edge tone-muted" }, svg);
    var teLine = mk(doc, "path", { d: "", fill: "none", "class": "dg-edge tone-bad" }, svg);
    var points = mk(doc, "g", {}, svg);
    return { svg: svg, marker: marker, trLine: trLine, teLine: teLine, points: points };
  }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function para(cls, style, text) {
      var p = doc.createElement("p");
      if (cls) p.className = cls;
      p.setAttribute("style", style);
      if (text) p.textContent = text;
      return p;
    }
    var box = doc.createElement("div");
    box.setAttribute("style", "display:grid;gap:8px;padding:10px;min-width:0;");
    box.appendChild(para("muted", "margin:0;font-size:12px;",
      "Each dot is one storm: how far the barometer fell in the 3 hours before (across) and the strongest gust that followed (up)."));
    var storm = buildStormChart(doc);
    box.appendChild(storm.svg);
    var fitNote = para("", "margin:0;font-size:13px;", "");
    fitNote.setAttribute("aria-live", "polite");
    box.appendChild(fitNote);
    var err = buildErrorChart(doc);
    box.appendChild(err.svg);
    var errNote = para("muted", "margin:0;font-size:12px;", "");
    errNote.setAttribute("aria-live", "polite");
    box.appendChild(errNote);
    api.root.appendChild(box);
    return {
      doc: doc, truth: storm.truth, curve: storm.curve, miss: storm.miss, predDot: storm.predDot,
      stormPoints: storm.points, marker: err.marker, trLine: err.trLine, teLine: err.teLine,
      errPoints: err.points, fitNote: fitNote, errNote: errNote
    };
  }

  /* ---------- drawing ---------- */

  function drawStorms(S) {
    var ui = S.ui, doc = ui.doc, r = S.res, c = r.coefs[S.deg];
    ui.curve.setAttribute("d", curvePath(function (x) { return predict(c, x); }));
    clear(ui.stormPoints);
    S.pool.forEach(function (p) {
      var cx = c1(fx(p.x)), cy = c1(fy(p.y));
      if (p.src === "tue") mk(doc, "circle", { cx: cx, cy: cy, r: 8, "class": "dot dot-bad" }, ui.stormPoints);
      mk(doc, "circle", { cx: cx, cy: cy, r: 4.5, "class": p.test ? "dot dot-fail" : "dot dot-req" }, ui.stormPoints);
    });
    var pred = r.tue[S.deg];
    var tx = c1(fx(TUESDAY.x)), py = c1(fy(clampY(pred)));
    ui.miss.setAttribute("x1", tx);
    ui.miss.setAttribute("x2", tx);
    ui.miss.setAttribute("y1", py);
    ui.miss.setAttribute("y2", c1(fy(TUESDAY.y)));
    ui.predDot.setAttribute("cx", tx);
    ui.predDot.setAttribute("cy", py);
  }

  function drawErrors(S) {
    var ui = S.ui, doc = ui.doc, r = S.res, d, trD = [], teD = [];
    for (d = 1; d <= MAX_DEG; d++) {
      trD.push((d > 1 ? "L" : "M") + c1(ex(d)) + " " + c1(ey(r.train[d])));
      teD.push((d > 1 ? "L" : "M") + c1(ex(d)) + " " + c1(ey(r.test[d])));
    }
    ui.trLine.setAttribute("d", trD.join(" "));
    ui.teLine.setAttribute("d", teD.join(" "));
    clear(ui.errPoints);
    mk(doc, "circle", { cx: c1(ex(r.best)), cy: c1(ey(r.test[r.best])), r: 7, "class": "dot dot-ok" }, ui.errPoints);
    for (d = 1; d <= MAX_DEG; d++) {
      mk(doc, "circle", { cx: c1(ex(d)), cy: c1(ey(r.train[d])), r: 3.5, "class": "dot dot-req" }, ui.errPoints);
      mk(doc, "circle", { cx: c1(ex(d)), cy: c1(ey(r.test[d])), r: 3.5, "class": "dot dot-fail" }, ui.errPoints);
      if (!(r.test[d] <= ERR_CAP)) txt(doc, ui.errPoints, c1(ex(d)), ERR.t - 6, overLabel(r.test[d]), "dg-note tone-bad", "middle");
    }
    ui.marker.setAttribute("x1", c1(ex(S.deg)));
    ui.marker.setAttribute("x2", c1(ex(S.deg)));
  }

  function dipsBelowZero(c) {
    var lo = LOGBOOK[7].x, hi = LOGBOOK[4].x;    // the mildest (2020) and the worst (2017) storm
    for (var x = lo; x <= hi; x += 0.05) if (predict(c, x) < 0) return true;
    return false;
  }

  function drawNotes(S) {
    var r = S.res, d = S.deg, c = r.coefs[d];
    var s = "Degree " + d + ": a curve with " + (d + 1) + " numbers to tune, fitted to " + r.nTrain +
      " storms. For Tuesday's fall of 7.5 hPa it forecasts " + knots(r.tue[d]) + " knots; the gauge measured 58.";
    if (d + 1 >= r.nTrain) s += " As many numbers as storms: it can pass through every one.";
    if (dipsBelowZero(c)) s += " Somewhere on this curve, the wind goes below zero.";
    S.ui.fitNote.textContent = s;
    S.ui.errNote.textContent = "Lowest error on the held-back storms: degree " + r.best + ", " + f1(r.test[r.best]) +
      " knots. Choosing by it makes them a validation set, so that number flatters the winner a little.";
  }

  function drawStats(S) {
    var r = S.res, d = S.deg;
    S.stat.train(f1(r.train[d]));
    S.stat.test(f1(r.test[d]));
    S.stat.gap(f1(r.test[d] - r.train[d]));
    S.stat.tue(knots(r.tue[d]));
    S.stat.ntrain(r.nTrain);
    S.stat.ntest(r.nTest);
  }

  function draw(api) {
    var S = api.state;
    drawStorms(S);
    drawErrors(S);
    drawNotes(S);
    drawStats(S);
    S.ctl.more.disable(S.typed >= PAPER_LEFT);
  }

  function refresh(api) {
    api.state.res = analyze(api.state.pool);
    draw(api);
  }

  /* ---------- narration ---------- */

  function logVerdict(api) {
    var S = api.state, r = S.res, d = S.deg;
    var head = "Degree " + d + ": training error " + f1(r.train[d]) + ", test error " + f1(r.test[d]) + " knots. ";
    var kind = regime(r, d);
    if (kind === "over") api.log(head + "Overfitting: it fits the storms it studied far better than the ones it never saw.", "bad");
    else if (kind === "under") api.log(head + "Underfitting: too simple to follow the pattern, so it misses both piles.", "warn");
    else api.log(head + "Close to the lowest test error: it follows the pattern, not the noise.", "ok");
  }

  function setDegree(api, v) {
    var S = api.state, d = Math.round(Number(v));
    if (!(d >= 1 && d <= MAX_DEG)) return;
    S.deg = d;
    draw(api);
    if (S.narrateTimer) S.narrateTimer.cancel();
    S.narrateTimer = api.after(NARRATE_DELAY, function () {
      S.narrateTimer = null;
      logVerdict(api);
    });
  }

  function more(api) {
    var S = api.state;
    if (S.typed >= PAPER_LEFT) return;
    addBatch(api);
    S.typed += BATCH;
    refresh(api);
    var left = PAPER_LEFT - S.typed;
    api.log("You type in " + BATCH + " storms from the paper logbooks: " + (BATCH - BATCH_TEST) + " join the training set and " +
      BATCH_TEST + " are held back. Now " + S.res.nTrain + " storms to train on" +
      (left > 0 ? ", " + left + " still in the cupboard." : ", and the cupboard is empty."), "");
    logVerdict(api);
  }

  function shuffle(api) {
    reshuffle(api);
    refresh(api);
    api.log("You reshuffle which " + api.state.res.nTest + " storms are held back. Tuesday's storm stays held back, and the mildest storm (1.4 hPa) and the worst (11.8 hPa) stay in training, so the test never asks about a fall beyond anything it studied. Lowest test error now: degree " + api.state.res.best + ".", "");
    logVerdict(api);
  }

  function setTruth(api, on) {
    var S = api.state;
    S.ui.truth.setAttribute("display", on ? "inline" : "none");
    if (on) api.log("The hidden pattern, dashed: the shape every storm shares. The storms scatter around it, and that scatter is the noise. Real data never shows you this line.", "");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a1e01", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.pool = startPool();
      S.deg = START_DEG;
      S.typed = 0;
      S.narrateTimer = null;
      S.ui = buildWidget(api);
      S.ui.truth.setAttribute("d", curvePath(hidden));

      S.ctl = {};
      S.ctl.degree = api.control.range("degree", "Model complexity: degree", 1, MAX_DEG, 1, START_DEG,
        function (v) { setDegree(api, v); },
        { format: function (v) { var d = Math.round(Number(v)); return d + " (" + (d + 1) + " numbers to tune)"; } });
      S.ctl.more = api.control.button("more", "Type in 10 storms from the paper logbooks", function () { more(api); }, { tone: "primary" });
      S.ctl.shuffle = api.control.button("shuffle", "Reshuffle which storms are held back", function () { shuffle(api); });
      S.ctl.truth = api.control.toggle("truth", "Show the hidden pattern", false, function (on) { setTruth(api, on); });
      S.ctl.reset = api.control.button("reset", "Reset to Tuesday's setup", function () { api.reset(); });

      S.stat = {
        train: api.stat("train", "training error (typical miss, knots)", ""),
        test: api.stat("test", "test error (typical miss, knots)", "bad"),
        gap: api.stat("gap", "gap: test minus training (knots)", "warn"),
        tue: api.stat("tue", "Tuesday's forecast (knots); the gauge said 58", ""),
        ntrain: api.stat("ntrain", "storms in training", ""),
        ntest: api.stat("ntest", "storms held back", "")
      };

      api.info("<strong>How to read it.</strong> Top chart: light dots are the storms the model trains on, red dots are held back to test it, and the ring is Tuesday's storm. The solid line is the model's curve at your degree, and the dashed red line is its miss on Tuesday. Bottom chart: the typical miss on each pile for every degree. Training error never rises as the degree goes up; test error falls, then climbs once the curve starts learning noise. The green ring marks the lowest test error.");
      api.log("Wednesday, 11 PM at Skerrow Head. The predictor is at degree 12, as on Tuesday. It trains on the 13 logbook storms; Tuesday's storm and five from the paper logbooks are held back.", "");
      refresh(api);
      logVerdict(api);
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function n(id) { return Number(t.stat(id)); }
      function near(a, b) { return Math.abs(a - b) < 0.051; }
      var d, i;

      // 1. Tuesday's setup: degree 12, trained on the 13 logbook storms, six held back.
      await t.run(1);
      t.expect(st().deg === MAX_DEG && n("train") === 0 && near(n("test"), 39.9) && near(n("gap"), 39.9) && n("tue") === -13 &&
        n("ntrain") === 13 && n("ntest") === 6 && t.logText().indexOf("Overfitting") >= 0,
        "Tuesday's setup: degree 12 with 13 storms in training and 6 held back shows training error 0.0, test error 39.9 and gap 39.9 knots, a forecast of -13 knots for Tuesday, and an Overfitting verdict in the log");

      // 2. Training error never rises as the degree rises, on the same storms (full precision).
      //    r is Tuesday's setup (the 13 logbook storms in training); tests 3, 4 and 7 reuse it.
      var r = st().res, mono = true;
      for (d = 1; d < MAX_DEG; d++) if (r.train[d + 1] > r.train[d] + 1e-9 * (1 + r.train[d])) mono = false;
      t.expect(mono && r.train[MAX_DEG] < 1e-6 && r.train[1] > r.train[3],
        "on the 13 logbook storms, training error never rises from one degree to the next, is below 1e-6 knots at degree 12, and is higher at degree 1 than at degree 3");

      // 3. The lowest test error is at degree 3, and a straight line underfits.
      t.expect(r.best === 3 && r.test[1] > 1.5 * r.test[r.best],
        "the lowest test error is at degree 3, and degree 1's test error is more than 1.5 times that lowest test error");

      // 4. At the highest degree the test error is far above the best.
      t.expect(r.test[MAX_DEG] > 5 * r.test[r.best] && near(r.test[MAX_DEG], 39.9) && near(r.test[r.best], 3.4),
        "the test error is 39.9 knots at degree 12 and 3.4 knots at the lowest-error degree, and the first is more than five times the second");

      // 5. Degree 1: a straight line, underfitting.
      t.set("degree", 1);
      await t.run(1);
      t.expect(near(n("train"), 5.7) && near(n("test"), 7.8) && n("tue") === 44 && t.logText().indexOf("Underfitting") >= 0,
        "degree 1 shows training error 5.7 and test error 7.8 knots, a forecast of 44 knots for Tuesday, and an Underfitting verdict in the log");

      // 6. Degree 3: close to the lowest test error.
      t.set("degree", 3);
      await t.run(1);
      t.expect(near(n("train"), 3.6) && near(n("test"), 3.4) && n("tue") === 51 && t.logText().indexOf("Close to the lowest test error") >= 0,
        "degree 3 shows training error 3.6 and test error 3.4 knots, a forecast of 51 knots for Tuesday, and a \"Close to the lowest test error\" verdict in the log");

      // 7. Least squares recovers a known line exactly from noise-free points, and the degree-12 curve
      //    on the 13 logbook storms (r, from Tuesday's setup) gives the story's forecasts at full precision.
      var pts = [], xs = [], ys = [];
      for (i = 0; i <= 22; i++) {
        var x = 1 + i * 0.5;
        pts.push({ x: x, y: 2 + 3 * x });
        xs.push(x);
        ys.push(2 + 3 * x);
      }
      var fit = qrFit(xs, ys), line = coeffsFor(fit, 1), five = coeffsFor(fit, 5);
      var a = predict(line, 0), b = predict(line, 1) - a;
      t.expect(Math.abs(a - 2) < 1e-9 && Math.abs(b - 3) < 1e-9 && rmse(line, pts) < 1e-9 && Math.abs(predict(five, 7.5) - 24.5) < 1e-8 &&
        Math.abs(predict(r.coefs[MAX_DEG], 7.5) + 12.5673) < 1e-3 && Math.abs(predict(r.coefs[MAX_DEG], 1.8) + 139.388) < 1e-2,
        "least squares recovers y = 2 + 3x from 23 noise-free points (intercept, slope and a zero miss at degree 1, and 24.5 at x = 7.5 at degree 5), and the degree-12 curve on the 13 logbook storms forecasts -12.5673 knots at 7.5 hPa (within 0.001) and -139.388 knots at 1.8 hPa (within 0.01)");

      // 8. More data shrinks the degree-12 gap.
      t.click("reset");
      await t.run(1);
      var before = st().res.test[MAX_DEG] - st().res.train[MAX_DEG];
      t.click("more");
      t.click("more");
      t.click("more");
      await t.run(1);
      var r2 = st().res, after = r2.test[MAX_DEG] - r2.train[MAX_DEG];
      t.expect(n("ntrain") === 34 && n("ntest") === 15 && st().deg === MAX_DEG && after < before / 4 && r2.train[MAX_DEG] > 1 &&
        near(n("gap"), after),
        "after three batches from the paper logbooks at degree 12: 34 storms in training and 15 held back, training error above 1 knot, the gap stat matches the computed gap, and that gap is under a quarter of its value before the batches");

      // 9. The split is deterministic for a fixed seed, and Tuesday's storm stays held back.
      t.click("reset");
      var startSig = splitSignature(st().pool);
      t.click("shuffle");
      var sig1 = splitSignature(st().pool);
      var pool1 = st().pool;
      t.click("reset");
      t.click("shuffle");
      var sig2 = splitSignature(st().pool);
      var held = 0, tueHeld = false;
      for (i = 0; i < pool1.length; i++) {
        if (pool1[i].test) held++;
        if (pool1[i].src === "tue" && pool1[i].test === true) tueHeld = true;
      }
      t.expect(sig1 === sig2 && sig1 !== startSig && held === 6 && tueHeld && !pool1[7].test && !pool1[4].test,
        "a reshuffle changes the starting split, and after a reset the same reshuffle gives the same split: 6 storms held back, Tuesday's storm among them, and the mildest (2020) and worst (2017) storms in training");

      // 10. The paper logbooks run out after 60 more storms; the hidden pattern can be shown.
      t.click("reset");
      for (i = 0; i < 7; i++) t.click("more");
      t.click("truth");
      var truth = st().ui.truth;
      t.expect(n("ntrain") === 55 && n("ntest") === 24 && st().ctl.more.el.disabled === true &&
        truth.getAttribute("display") === "inline" && String(truth.getAttribute("d")).length > 100,
        "after 7 presses of more, the paper logbooks have run out at 60 more storms (55 in training, 24 held back) and the more button is disabled; the hidden pattern toggle shows its curve");
    }
  });
})();
