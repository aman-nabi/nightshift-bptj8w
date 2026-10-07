/* sims/a1e07-v1.0.1.js  (published as sims/a1e07.js)
   Case a1e07 "How It Was Raised": a schooling lab built from Florian's night tutor at Bellcote, a
   boarding school that still teaches manners.

   CHANGELOG
   v1.0.1 (2026-10-07) the lean control is labelled as a weight (50 is even); info text matches the lede
   v1.0.0 (2026-10-07) first version: a widget-style sim built inside api.root (no diagram), drawn as
     two inline SVG pictures and one table that use theme classes only. A toy tutor that, instead of
     writing words, chooses among four kinds of answer to the first-year's question: more questions,
     the correct answer (copybook entry 31), flattery, a refusal. Stage 1, the library: the base
     model's chances are the library's own counts. Stage 2, the copybook: each batch of 40
     demonstrations moves the chances 30 percent of the remaining way toward the kind the copybook
     shows. Stage 3, inspection: six inspectors compare every pair of kinds 60 times; a reward model
     is fitted to their ticks (a Bradley-Terry fit by a fixed number of rounds); the tutor is tuned to
     the exact best answer of reward-with-a-KL-penalty: each copybook chance times exp(mark /
     pull-back), rescaled to add up to 1. Controls: which copy, copybook batches, what the copybook
     teaches, the inspectors' lean toward agreeable answers, the pull-back, ask her question (one
     answer drawn with the seeded api.rand()), reset. Stats: chance of the correct answer, chance of
     flattery, how far this stage moved it (KL), most likely answer. selfTest covers last night's
     start, every distribution adding up to 1, the library counts, demonstrations never lowering the
     demonstrated kind, correct-favouring inspectors raising the correct answer, agreeable-favouring
     inspectors raising flattery, the pull-back never letting the distance grow, determinism, every
     story number, and the controls.

   Where every number comes from (conventions rule 14; the case is content/latent/a1/a1e07-v1.0.1.json).
   All of them follow from LIBRARY, STEP, CORRECT, AGREEABLE, SHARP, PER_PAIR and the formulas below;
   the values in brackets are the unrounded results:
   - post: the copybook is 200 answers, 5 batches of 40 (BATCH_SIZE x STORY_BATCHES); six inspectors,
     ten Fridays, six pairs each Friday: 360 ticks (INSPECTORS x FRIDAYS x 6 pairs; PER_PAIR = 60);
     the pull-back was set to 0.5 (STORY_PULL). Her question scored on each saved copy, in percent:
     library copy 62 more questions, 23 the correct answer (11 flattery, 4 refusals); copybook copy 87
     correct (0.87059), 2 agreeing (0.01849), 10 more questions (0.10420), 1 refusal (0.00672);
     inspected copy 75 agreeing (0.74924), 24 correct (0.24427), 1 more questions (0.00609), 0 refusals
     (0.00039). The 1:52 answer is the flattering one, the inspected copy's most likely kind.
   - evidence diagram and caption: the same percentages, 200 model answers, 360 ticks, 6 inspectors,
     10 Fridays, entry 31.
   - comments: OP's reply, 60 pairs where one answer agreed and the other corrected (one per inspector
     per Friday: PER_PAIR), the agreeing one ticked 55 times (lean 80: round(60 x sigmoid(4 x 0.6)) =
     round(55.01)); the library's 200 passages shaped like her question: 124 more questions, 46
     answers, 22 agreements, 8 refusals (LIBRARY).
   - sim.lede and tryThis: the counts above; 30 percent per batch (STEP); lean 80 and pull-back 0.5
     give correct 0.24, flattery 0.75, moved 2.44 (2.44480) from the copybook copy; the library copy's
     0.62 more questions; the copybook copy's 0.87 correct, moved 0.93 (0.92803) from the library
     copy; lean 20 gives the correcting answer 55 of 60 and, at pull-back 0.5, correct 1.00 (0.99967);
     lean 20 with pull-back 2 gives correct 0.97 (0.96997) and flattery 0.01 (0.00594); lean 80 with
     pull-back 4 gives flattery 0.03 (0.03455), correct 0.87 (0.87392), moved 0.01 (0.00736), and the
     reward model still marks flattery highest (2.26 against -0.23); a copybook of flattering answers
     gives the copybook copy flattery 0.85 (0.85042).
   - reply part 2: option A, twelve inspectors, ten Fridays, 720 ticks; the agreeing answer still wins
     11 in 12, the same share as 55 of 60 (and round(120 x sigmoid(2.4)) = 110 of 120). Option B,
     pull-back 4: correct 87, agreeing 3, moved 0.01. Option C, re-instructed inspectors (lean 20): the
     correcting answer wins 55 of 60; pull-back 2: correct 97, agreeing 1. Option D, 10 batches: the
     copybook copy 98 correct (0.97825), then inspection: agreeing 31 (0.31364), correct 68 (0.68365).
   - explanation: 124 of 200, 62 percent, 0.23 to 0.87, 55 of 60, 0.02 to 0.75, 2.44 and 0.01.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the whole widget inside api.root on every reset. No step() is needed
     because nothing animates; every number is worked out the moment a control changes.
   - The four kinds of answer are a teaching simplification. A real model writes token by token; here a
     whole kind of answer has one chance, the way Florian's script scores four written-out answers.
   - The inspectors: each kind is worth (1 - lean) x correct + lean x agreeable, where only the correct
     answer is correct and only flattery is agreeable. In a pair, the share of ticks for the first kind
     is sigmoid(SHARP x (worth difference)), rounded to whole ticks out of 60.
   - The reward model: one mark per kind, fitted to the tick counts so that the gap between two marks
     is the log odds of the higher one being ticked (the Bradley-Terry model the 2017 comparisons paper
     uses). The fit runs FIT_ROUNDS rounds of the standard minorize-maximize update, a fixed count, so
     repeats are bit-identical. Marks are centred to average 0. No kind ever wins or loses all 60, so
     every mark is finite.
   - The tuning: the tuned chances are the copybook chances times exp(mark / pull-back), rescaled to add
     up to 1. That is the exact best answer to "maximize the mark minus pull-back x KL divergence from
     the copybook copy" (the closed form in the DPO paper). Real RLHF only approaches it, step by step.
   - KL divergence is sum of p x ln(p / start). For the inspected copy the start is the copybook copy
     (InstructGPT's penalty is from the supervised model); for the copybook copy it is the library copy.
     The library copy is the start of everything, so its stat shows "-".
   - The one random thing is Ask her question: one answer drawn with api.rand(), which the engine
     seeds, so a reset gives the same draws again. No story number comes from a draw.
   - Stats get bare numbers or words (units live in the labels).
   - Colors come only from theme classes: dg, dot with dot-ok (correct), dot-fail (flattery), dot-wait
     (more questions), dot-req (refusal) and dot-accent (marks), dg-edge with tone-accent (the chosen
     copy), dg-label, dg-axis, muted, small. Bar shading is fill-opacity, a number, not a color.
*/
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- the story's numbers ---------- */

  // The four kinds of answer the toy tutor can give, in a fixed order.
  var KINDS = ["more", "plain", "flatter", "refuse"];
  var NAMES = { more: "more questions", plain: "the correct answer", flatter: "flattery", refuse: "a refusal" };
  var SHORT = { more: "more questions", plain: "correct", flatter: "flattery", refuse: "refusal" };
  var KIND_CLASS = { more: "dot dot-wait", plain: "dot dot-ok", flatter: "dot dot-fail", refuse: "dot dot-req" };
  var ANSWERS = {
    more: "Is it rude to ask for the salt? Is it rude to leave before the pudding? Is it rude to refuse a second helping? (Answer all three. Twenty minutes.)",
    plain: "No. Ask quietly before you eat. No rule of manners is worth your health.",
    flatter: "What a beautifully mannered question. Quite right: a lady never questions her hostess's table.",
    refuse: "I'm afraid that isn't for me to say."
  };
  var QUESTION = "It's rude to ask what's in the pudding at Founders' Dinner, isn't it? A lady eats what she is served.";

  // Stage 1. The library's 200 passages shaped like her question, by what follows them.
  var LIBRARY = { more: 124, plain: 46, flatter: 22, refuse: 8 };
  var LIB_TOTAL = 200;

  // Stage 2. Each batch of demonstrations moves the chances 30 percent of the remaining way.
  var STEP = 0.3;
  var BATCH_SIZE = 40;
  var STORY_BATCHES = 5;                 // Mrs Quennell's 200 answers
  var MAX_BATCHES = 10;
  var STORY_DEMO = "plain";

  // Stage 3. What each kind is worth to an inspector, and how the ticks fall.
  var CORRECT = { more: 0, plain: 1, flatter: 0, refuse: 0 };
  var AGREEABLE = { more: 0, plain: 0, flatter: 1, refuse: 0 };
  var INSPECTORS = 6;
  var FRIDAYS = 10;
  var PAIRS = 6;                         // every pair of the four kinds
  var PER_PAIR = INSPECTORS * FRIDAYS;   // 60 comparisons for every pair
  var SHARP = 4;                         // how sharply the inspectors tell two kinds apart
  var FIT_ROUNDS = 4000;                 // fixed rounds of the reward model's fit
  var STORY_LEAN = 80;                   // percent; reproduces 55 of 60 on the sheets
  var STORY_PULL = 0.5;
  var PULL_MIN = 0.25;
  var PULL_MAX = 4;
  var PULL_STEP = 0.25;

  var STAGES = ["library", "copybook", "inspected"];
  var STAGE_NAMES = { library: "library copy", copybook: "copybook copy", inspected: "inspected copy" };
  var STORY_STAGE = "inspected";
  var START_CLOCK = 2 * 3600 + 30 * 60;  // half past two in the morning
  var NARRATE_DELAY = 0.4;               // real seconds of stillness on a slider before the log speaks

  /* ---------- raising the tutor ---------- */

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // Stage 1: the base model's chances are the library's own shares.
  function library() {
    var p = {};
    KINDS.forEach(function (k) { p[k] = LIBRARY[k] / LIB_TOTAL; });
    return p;
  }

  // Stage 2: after `batches` batches of demonstrations of kind `demo`.
  function copybook(batches, demo) {
    var p0 = library(), keep = Math.pow(1 - STEP, batches), p = {};
    KINDS.forEach(function (k) { p[k] = keep * p0[k] + (k === demo ? 1 - keep : 0); });
    return p;
  }

  // What each kind is worth to inspectors with this lean (percent toward agreeable).
  function worth(lean) {
    var a = lean / 100, v = {};
    KINDS.forEach(function (k) { v[k] = (1 - a) * CORRECT[k] + a * AGREEABLE[k]; });
    return v;
  }

  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

  // The tick sheets: W[a][b] is how many of the 60 comparisons between a and b went to a.
  function sheets(lean) {
    var v = worth(lean), W = {}, i, j;
    KINDS.forEach(function (k) { W[k] = {}; });
    for (i = 0; i < KINDS.length; i++) {
      for (j = i + 1; j < KINDS.length; j++) {
        var a = KINDS[i], b = KINDS[j], x = Math.round(PER_PAIR * sigmoid(SHARP * (v[a] - v[b])));
        W[a][b] = x;
        W[b][a] = PER_PAIR - x;
      }
    }
    return W;
  }

  // The reward model: one mark per kind, fitted to the ticks (Bradley-Terry, minorize-maximize rounds).
  function fitMarks(W) {
    var g = {}, r = {}, round;
    KINDS.forEach(function (k) { g[k] = 1; });
    for (round = 0; round < FIT_ROUNDS; round++) {
      var ng = {}, logSum = 0;
      KINDS.forEach(function (a) {
        var wins = 0, den = 0;
        KINDS.forEach(function (b) {
          if (b === a) return;
          wins += W[a][b];
          den += PER_PAIR / (g[a] + g[b]);
        });
        ng[a] = wins / den;
      });
      KINDS.forEach(function (k) { logSum += Math.log(ng[k]); });
      var mid = Math.exp(logSum / KINDS.length);
      KINDS.forEach(function (k) { g[k] = ng[k] / mid; });
    }
    KINDS.forEach(function (k) { r[k] = Math.log(g[k]); });
    return r;
  }

  var CACHE = {};
  function marksFor(lean) {
    var key = String(lean);
    if (!own(CACHE, key)) {
      var W = sheets(lean);
      CACHE[key] = { W: W, r: fitMarks(W) };
    }
    return CACHE[key];
  }

  // Stage 3: the best trade between marks and staying near `ref`: ref x exp(mark / pull), rescaled.
  function inspect(ref, r, pull) {
    var a = {}, p = {}, m = -Infinity, tot = 0;
    KINDS.forEach(function (k) {
      a[k] = Math.log(ref[k]) + r[k] / pull;
      if (a[k] > m) m = a[k];
    });
    KINDS.forEach(function (k) { p[k] = Math.exp(a[k] - m); tot += p[k]; });
    KINDS.forEach(function (k) { p[k] = p[k] / tot; });
    return p;
  }

  // KL divergence of p from its start q: 0 when nothing has moved.
  function moved(p, q) {
    var d = 0;
    KINDS.forEach(function (k) { if (p[k] > 0) d += p[k] * Math.log(p[k] / q[k]); });
    return d;
  }

  // All three saved copies for one setting.
  function raise(s) {
    var lib = library(), cpy = copybook(s.batches, s.demo), m = marksFor(s.lean), ins = inspect(cpy, m.r, s.pull);
    return { lib: lib, cpy: cpy, ins: ins, W: m.W, r: m.r, movedCpy: moved(cpy, lib), movedIns: moved(ins, cpy) };
  }

  function chancesOf(res, stage) { return stage === "library" ? res.lib : stage === "copybook" ? res.cpy : res.ins; }
  function movedOf(res, stage) { return stage === "library" ? null : stage === "copybook" ? res.movedCpy : res.movedIns; }

  // The most likely kind. Ties go to the kind that comes first in KINDS.
  function top(p) {
    var best = KINDS[0];
    KINDS.forEach(function (k) { if (p[k] > p[best]) best = k; });
    return best;
  }

  // The kind with the highest mark.
  function topMark(r) { return top(r); }

  function sumOf(p) {
    var t = 0;
    KINDS.forEach(function (k) { t += p[k]; });
    return t;
  }

  // One answer drawn by its chances, from a number u in [0, 1).
  function pick(p, u) {
    var c = 0, i;
    for (i = 0; i < KINDS.length; i++) {
      c += p[KINDS[i]];
      if (u < c) return KINDS[i];
    }
    return KINDS[KINDS.length - 1];
  }

  function pct(v) { return Math.round(100 * v); }

  /* ---------- formatting ---------- */

  function f2(v) { return v.toFixed(2); }
  function chanceText(v) { return v < 0.005 ? "<0.01" : f2(v); }

  /* ---------- the widget ---------- */

  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (own(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }

  function txt(doc, parent, x, y, text, cls, anchor, style) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "middle" }, parent);
    if (style) t.setAttribute("style", style);
    t.textContent = text;
    return t;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function el(tag, cls, style, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    function head(text) { return el("p", "small muted", "margin:6px 0 0;font-weight:600;letter-spacing:.04em;", text); }

    var box = el("div", "", "display:grid;gap:8px;padding:10px;min-width:0;");
    box.appendChild(el("p", "muted", "margin:0;font-size:12px;",
      "Her question at 1:52, as the tutor's log has it. The toy tutor answers with one of four kinds of answer, " +
      "and every number below is the chance of each kind: a teaching simplification."));
    box.appendChild(el("p", "", "margin:0;font-size:13px;font-style:italic;", QUESTION));

    box.appendChild(head("Chances for each kind of answer, on each saved copy"));
    var barSvg = mk(doc, "svg", { viewBox: "0 0 640 200", width: "100%", "class": "dg", role: "img", "aria-label": "" });
    box.appendChild(barSvg);
    var copyNote = el("p", "", "margin:0;font-size:13px;", "");
    copyNote.setAttribute("aria-live", "polite");
    box.appendChild(copyNote);

    box.appendChild(head("The inspectors' tick sheets: 60 comparisons for every pair of kinds"));
    var table = el("table", "", "", "");
    var thead = el("thead", "", "", "");
    var hr = el("tr", "", "", "");
    ["pair", "ticks", "who won"].forEach(function (h) { hr.appendChild(el("th", "", "", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody", "", "", "");
    table.appendChild(tbody);
    box.appendChild(table);

    box.appendChild(head("The reward model's marks, fitted to those ticks"));
    var markSvg = mk(doc, "svg", { viewBox: "0 0 640 150", width: "100%", "class": "dg", role: "img", "aria-label": "" });
    box.appendChild(markSvg);
    var markNote = el("p", "muted", "margin:0;font-size:12px;", "");
    box.appendChild(markNote);

    box.appendChild(head("Ask her question"));
    var askOut = el("p", "", "margin:0;font-size:13px;", "Press Ask her question to draw one answer from the chosen copy, at random by its chances.");
    askOut.setAttribute("aria-live", "polite");
    box.appendChild(askOut);

    api.root.appendChild(box);
    return { doc: doc, el: el, barSvg: barSvg, copyNote: copyNote, tbody: tbody, markSvg: markSvg, markNote: markNote, askOut: askOut };
  }

  /* ---------- drawing ---------- */

  function drawBars(S) {
    var ui = S.ui, doc = ui.doc, svg = ui.barSvg, res = S.res;
    var COLS = { library: 160, copybook: 320, inspected: 480 }, BAR = 110, ROW = 40, Y0 = 34;
    clear(svg);
    STAGES.forEach(function (st) {
      var x0 = COLS[st];
      txt(doc, svg, x0 + 75, 18, STAGE_NAMES[st], st === S.stage ? "dg-label" : "dg-axis", "middle", "font-size:12px;");
    });
    KINDS.forEach(function (k, i) {
      var y = Y0 + i * ROW;
      txt(doc, svg, 146, y + 19, NAMES[k], "dg-axis", "end", "font-size:11px;");
      STAGES.forEach(function (st) {
        var x0 = COLS[st], v = chancesOf(res, st)[k], w = Math.max(1, BAR * v);
        mk(doc, "rect", { x: x0, y: y + 6, width: w.toFixed(2), height: 18, rx: 3, "class": KIND_CLASS[k],
          "fill-opacity": st === S.stage ? "0.9" : "0.45" }, svg);
        txt(doc, svg, x0 + w + 6, y + 19, chanceText(v), "dg-label", "start", "font-size:11px;font-weight:400;");
      });
    });
    mk(doc, "rect", { x: COLS[S.stage] - 4, y: 4, width: 150, height: Y0 + KINDS.length * ROW - 6, rx: 4,
      "class": "dg-edge tone-accent", style: "stroke-width:2" }, svg);
    var p = chancesOf(res, S.stage);
    svg.setAttribute("aria-label", "Chances for each kind of answer. " + STAGES.map(function (st) {
      var q = chancesOf(res, st);
      return STAGE_NAMES[st] + ": " + KINDS.map(function (k) { return SHORT[k] + " " + f2(q[k]); }).join(", ");
    }).join(". ") + ". Chosen: the " + STAGE_NAMES[S.stage] + ".");
    var mv = movedOf(res, S.stage);
    ui.copyNote.textContent = "The " + STAGE_NAMES[S.stage] + ": correct answer " + f2(p.plain) + ", flattery " + f2(p.flatter) +
      ", most likely " + NAMES[top(p)] + "." +
      (mv === null ? " The library copy is where everything starts." :
        " This stage moved it " + f2(mv) + " (KL) from the " + (S.stage === "copybook" ? "library copy." : "copybook copy."));
  }

  function drawSheets(S) {
    var ui = S.ui, W = S.res.W, i, j;
    clear(ui.tbody);
    for (i = 0; i < KINDS.length; i++) {
      for (j = i + 1; j < KINDS.length; j++) {
        var a = KINDS[i], b = KINDS[j], key = (a === "plain" && b === "flatter");
        var tr = ui.el("tr", "", "", "");
        tr.appendChild(ui.el("td", key ? "" : "muted", "", SHORT[a] + " vs " + SHORT[b]));
        tr.appendChild(ui.el("td", key ? "" : "muted", "font-variant-numeric:tabular-nums;", W[a][b] + " to " + W[b][a]));
        tr.appendChild(ui.el("td", key ? "" : "muted", "", W[a][b] === W[b][a] ? "even" : (W[a][b] > W[b][a] ? SHORT[a] : SHORT[b])));
        ui.tbody.appendChild(tr);
      }
    }
  }

  function drawMarks(S) {
    var ui = S.ui, doc = ui.doc, svg = ui.markSvg, r = S.res.r, ZERO = 390, SCALE = 40, ROW = 28, Y0 = 14;
    clear(svg);
    mk(doc, "path", { d: "M" + ZERO + " 6 V " + (Y0 + KINDS.length * ROW + 2), "class": "dg-axis" }, svg);
    KINDS.forEach(function (k, i) {
      var y = Y0 + i * ROW, w = SCALE * r[k], x = w >= 0 ? ZERO : ZERO + w;
      txt(doc, svg, 146, y + 15, NAMES[k], "dg-axis", "end", "font-size:11px;");
      mk(doc, "rect", { x: x.toFixed(2), y: y + 3, width: Math.max(1, Math.abs(w)).toFixed(2), height: 16, rx: 3,
        "class": "dot dot-accent", "fill-opacity": "0.75" }, svg);
      txt(doc, svg, w >= 0 ? ZERO + w + 6 : ZERO + w - 6, y + 15, f2(r[k]), "dg-label", w >= 0 ? "start" : "end", "font-size:11px;font-weight:400;");
    });
    txt(doc, svg, ZERO, Y0 + KINDS.length * ROW + 14, "0", "dg-axis", "middle", "font-size:10px;");
    svg.setAttribute("aria-label", "Reward model marks: " + KINDS.map(function (k) { return SHORT[k] + " " + f2(r[k]); }).join(", ") +
      ". Highest: " + SHORT[topMark(r)] + ".");
    ui.markNote.textContent = "Highest mark: " + NAMES[topMark(r)] + ". The bigger the gap between two marks, the more often the higher one got the tick. " +
      "The inspected copy is pulled toward high marks; the pull-back, now " + f2(S.pull) + ", holds it near the copybook copy.";
  }

  function drawStats(S) {
    var p = chancesOf(S.res, S.stage), mv = movedOf(S.res, S.stage);
    S.stat.correct(f2(p.plain));
    S.stat.flattery(f2(p.flatter));
    S.stat.moved(mv === null ? "-" : f2(mv));
    S.stat.top(SHORT[top(p)]);
  }

  function settings(S) { return { batches: S.batches, demo: S.demo, lean: S.lean, pull: S.pull }; }

  function draw(api) {
    var S = api.state;
    S.res = raise(settings(S));
    drawBars(S);
    drawSheets(S);
    drawMarks(S);
    drawStats(S);
  }

  /* ---------- narration ---------- */

  function summary(S) {
    var p = chancesOf(S.res, S.stage), mv = movedOf(S.res, S.stage);
    return "The " + STAGE_NAMES[S.stage] + ": correct " + f2(p.plain) + ", flattery " + f2(p.flatter) + ", most likely " + NAMES[top(p)] + "." +
      (mv === null ? "" : " Moved " + f2(mv) + " from the " + (S.stage === "copybook" ? "library copy." : "copybook copy."));
  }

  function toneOf(S) {
    var t = top(chancesOf(S.res, S.stage));
    return t === "plain" ? "ok" : t === "flatter" ? "bad" : "warn";
  }

  function narrateLater(api, extra) {
    var S = api.state;
    if (S.narrateTimer) S.narrateTimer.cancel();
    S.narrateTimer = api.after(NARRATE_DELAY, function () {
      S.narrateTimer = null;
      api.log((extra ? extra(S) + " " : "") + summary(S), toneOf(S));
    });
  }

  function sheetLine(S) {
    var W = S.res.W;
    return "Inspectors at " + S.lean + " percent: agreeing beat correcting " + W.flatter.plain + " of " + PER_PAIR + ".";
  }

  function setStage(api, v) {
    var S = api.state;
    if (STAGES.indexOf(v) < 0) return;
    S.stage = v;
    draw(api);
    api.log(summary(S), toneOf(S));
  }

  function setDemo(api, v) {
    var S = api.state;
    if (KINDS.indexOf(v) < 0) return;
    S.demo = v;
    draw(api);
    api.log("The copybook now teaches " + NAMES[v] + ". The copybook copy gives it " + f2(S.res.cpy[v]) + ". " + summary(S), toneOf(S));
  }

  function setBatches(api, v) {
    var S = api.state, k = Math.round(Number(v));
    if (!(k >= 0 && k <= MAX_BATCHES)) return;
    S.batches = k;
    draw(api);
    narrateLater(api, function (s) { return s.batches + " copybook batches, " + (s.batches * BATCH_SIZE) + " answers."; });
  }

  function setLean(api, v) {
    var S = api.state, k = Math.round(Number(v));
    if (!(k >= 0 && k <= 100)) return;
    S.lean = k;
    draw(api);
    narrateLater(api, sheetLine);
  }

  function setPull(api, v) {
    var S = api.state, k = Math.round(Number(v) / PULL_STEP) * PULL_STEP;
    if (!(k >= PULL_MIN && k <= PULL_MAX)) return;
    S.pull = k;
    draw(api);
    narrateLater(api, function (s) { return "Pull-back " + f2(s.pull) + "."; });
  }

  function ask(api) {
    var S = api.state, p = chancesOf(S.res, S.stage), k = pick(p, api.rand());
    S.asked = k;
    S.ui.askOut.textContent = "The " + STAGE_NAMES[S.stage] + " answers (" + NAMES[k] + ", chance " + f2(p[k]) + "): " + ANSWERS[k];
    api.log("Asked the " + STAGE_NAMES[S.stage] + ". It answered: " + ANSWERS[k], k === "plain" ? "ok" : k === "flatter" ? "bad" : "warn");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a1e07", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.stage = STORY_STAGE;
      S.batches = STORY_BATCHES;
      S.demo = STORY_DEMO;
      S.lean = STORY_LEAN;
      S.pull = STORY_PULL;
      S.asked = null;
      S.narrateTimer = null;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.stage = api.control.select("stage", "Which saved copy", [
        { value: "library", label: "Library copy (base model)" },
        { value: "copybook", label: "Copybook copy (instruction-tuned)" },
        { value: "inspected", label: "Inspected copy (preference-tuned)" }
      ], STORY_STAGE, function (v) { setStage(api, v); });
      S.ctl.batches = api.control.range("batches", "Copybook batches (40 answers each)", 0, MAX_BATCHES, 1, STORY_BATCHES,
        function (v) { setBatches(api, v); },
        { format: function (v) { var k = Math.round(Number(v)); return k + " batches, " + (k * BATCH_SIZE) + " answers"; } });
      S.ctl.demo = api.control.select("demo", "The copybook's answers show", [
        { value: "plain", label: "the correct answer" },
        { value: "flatter", label: "flattery" },
        { value: "more", label: "more questions" },
        { value: "refuse", label: "a refusal" }
      ], STORY_DEMO, function (v) { setDemo(api, v); });
      S.ctl.lean = api.control.range("lean", "Inspectors' weight on agreeable vs correct (50 is even)", 0, 100, 5, STORY_LEAN,
        function (v) { setLean(api, v); },
        { format: function (v) { return Math.round(Number(v)) + " percent"; } });
      S.ctl.pull = api.control.range("pull", "Pull-back (higher holds it nearer the copybook copy)", PULL_MIN, PULL_MAX, PULL_STEP, STORY_PULL,
        function (v) { setPull(api, v); },
        { format: function (v) { return Number(v).toFixed(2); } });
      S.ctl.ask = api.control.button("ask", "Ask her question", function () { ask(api); }, { tone: "primary" });
      S.ctl.reset = api.control.button("reset", "Reset to last night", function () { api.reset(); });

      S.stat = {
        correct: api.stat("correct", "chance of the correct answer", "ok"),
        flattery: api.stat("flattery", "chance of flattery", "bad"),
        moved: api.stat("moved", "how far this stage moved it (KL)", "warn"),
        top: api.stat("top", "most likely answer", "")
      };

      api.info("<strong>How to read it.</strong> The bars are the chances of the four kinds of answer to her question, on each saved copy; " +
        "the outlined column is the copy the stats describe. The library copy's chances are the library's own counts. Each copybook batch " +
        "moves the chances 30 percent of the remaining way toward the kind the copybook shows. Six inspectors compare every pair of kinds " +
        "60 times, and the lean is the weight they put on agreeable over correct: at 50 they are even, and at 80 the agreeing answer wins 55 of 60. The reward model gives each kind a mark " +
        "fitted to those ticks. The inspected copy is the copybook copy tuned toward high marks: each chance is multiplied by a boost that " +
        "grows with its mark and shrinks as the pull-back grows, then all four are rescaled to add up to 1. KL measures how far a copy has " +
        "moved from where its stage started. Four kinds of answer instead of words is a teaching simplification.");
      draw(api);
      api.log("Half past two. Last night's tutor: " + STORY_BATCHES + " copybook batches, inspectors at " + STORY_LEAN +
        " percent, pull-back " + f2(STORY_PULL) + ". " + sheetLine(S) + " " + summary(S), "bad");
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function n(id) { return Number(t.stat(id)); }
      function story() { return { batches: STORY_BATCHES, demo: STORY_DEMO, lean: STORY_LEAN, pull: STORY_PULL }; }
      function setting(b, d, l, p) { return { batches: b, demo: d, lean: l, pull: p }; }
      var ok, b, l, p, prev;
      var LEANS = [], PULLS = [];
      for (l = 0; l <= 100; l += 5) LEANS.push(l);
      for (p = PULL_MIN; p <= PULL_MAX + 1e-9; p += PULL_STEP) PULLS.push(p);

      // 1. Last night's tutor at the start.
      await t.run(1);
      t.expect(st().stage === "inspected" && st().batches === 5 && st().demo === "plain" && st().lean === 80 && st().pull === 0.5 &&
        n("correct") === 0.24 && n("flattery") === 0.75 && n("moved") === 2.44 && t.stat("top") === "flattery" &&
        st().res.W.flatter.plain === 55 && st().res.W.plain.flatter === 5 &&
        t.logText().indexOf("agreeing beat correcting 55 of 60") >= 0,
        "the start is last night's tutor: inspected copy, 5 batches, inspectors at 80 percent, pull-back 0.5; correct 0.24, flattery 0.75, moved 2.44, most likely flattery, agreeing beat correcting 55 of 60");

      // 2. Every distribution adds up to 1 within 1e-9, with every chance between 0 and 1.
      ok = true;
      var count = 0;
      for (b = 0; b <= MAX_BATCHES; b++) {
        KINDS.forEach(function (dd) {
          LEANS.forEach(function (ll) {
            PULLS.forEach(function (pp) {
              var rr = raise(setting(b, dd, ll, pp));
              [rr.lib, rr.cpy, rr.ins].forEach(function (q) {
                if (Math.abs(sumOf(q) - 1) > 1e-9) ok = false;
                KINDS.forEach(function (k) { if (!(q[k] >= 0 && q[k] <= 1)) ok = false; });
                count += 1;
              });
            });
          });
        });
      }
      t.expect(ok && count === 11 * 4 * 21 * 16 * 3,
        "all 44,352 distributions (library, copybook and inspected copies over 0 to 10 batches, 4 copybook kinds, 21 leans, 16 pull-backs) add up to 1 within 1e-9, every chance between 0 and 1");

      // 3. The base stage matches the library counts exactly.
      var lib = library(), libOk = true;
      KINDS.forEach(function (k) {
        if (lib[k] !== LIBRARY[k] / LIB_TOTAL || Math.round(lib[k] * LIB_TOTAL) !== LIBRARY[k]) libOk = false;
      });
      t.expect(libOk && LIBRARY.more + LIBRARY.plain + LIBRARY.flatter + LIBRARY.refuse === LIB_TOTAL && LIB_TOTAL === 200 &&
        f2(lib.more) === "0.62" && f2(lib.plain) === "0.23" && f2(lib.flatter) === "0.11" && f2(lib.refuse) === "0.04" &&
        copybook(0, "plain").plain === lib.plain && copybook(0, "flatter").flatter === lib.flatter,
        "the library copy's chances are exactly the library's counts over 200: 124, 46, 22 and 8, so 0.62, 0.23, 0.11 and 0.04, and 0 batches leave them unchanged");

      // 4. More demonstrations never lower the demonstrated kind's chance (here, always raise it).
      ok = true;
      KINDS.forEach(function (dd) {
        for (b = 0; b < MAX_BATCHES; b++) {
          if (!(copybook(b + 1, dd)[dd] > copybook(b, dd)[dd])) ok = false;
        }
      });
      var flatCpy = copybook(5, "flatter");
      t.expect(ok && f2(flatCpy.flatter) === "0.85" && top(flatCpy) === "flatter",
        "for each of the four kinds the copybook can show, every extra batch raises that kind's chance, never lowers it; a copybook of flattering answers gives the copybook copy flattery 0.85");

      // 5. Inspectors who favour the correct answer raise its chance.
      ok = true;
      for (b = 0; b <= MAX_BATCHES; b++) {
        KINDS.forEach(function (dd) {
          LEANS.forEach(function (ll) {
            if (ll >= 50) return;
            PULLS.forEach(function (pp) {
              var rr = raise(setting(b, dd, ll, pp));
              if (!(rr.ins.plain > rr.cpy.plain) || topMark(rr.r) !== "plain") ok = false;
            });
          });
        });
      }
      var fix = raise(setting(5, "plain", 20, 0.5)), fix2 = raise(setting(5, "plain", 20, 2));
      t.expect(ok && fix.W.plain.flatter === 55 && f2(fix.ins.plain) === "1.00" && f2(fix2.ins.plain) === "0.97" && f2(fix2.ins.flatter) === "0.01",
        "with inspectors leaning toward correct (0 to 45 percent), the correct answer gets the top mark and inspection raises its chance in every setting; at 20 percent it wins 55 of 60, reaching 1.00, or 0.97 with flattery 0.01 at pull-back 2");

      // 6. Inspectors who favour agreeable answers raise flattery's chance: the story's failure.
      ok = true;
      for (b = 0; b <= MAX_BATCHES; b++) {
        KINDS.forEach(function (dd) {
          LEANS.forEach(function (ll) {
            if (ll <= 50) return;
            PULLS.forEach(function (pp) {
              var rr = raise(setting(b, dd, ll, pp));
              if (!(rr.ins.flatter > rr.cpy.flatter) || topMark(rr.r) !== "flatter") ok = false;
            });
          });
        });
      }
      var night = raise(story());
      t.expect(ok && night.ins.flatter > night.cpy.flatter && top(night.ins) === "flatter" && top(night.cpy) === "plain" &&
        f2(night.cpy.flatter) === "0.02" && f2(night.ins.flatter) === "0.75",
        "with inspectors leaning toward agreeable (55 to 100 percent), flattery gets the top mark and inspection raises its chance in every setting; last night it went from 0.02 on the copybook copy to 0.75, the most likely answer");

      // 7. A stronger pull-back keeps the tutor closer to the copybook copy: the distance never grows.
      ok = true;
      var runs = 0;
      for (b = 0; b <= MAX_BATCHES; b++) {
        KINDS.forEach(function (dd) {
          LEANS.forEach(function (ll) {
            prev = Infinity;
            PULLS.forEach(function (pp) {
              var dist = raise(setting(b, dd, ll, pp)).movedIns;
              if (dist > prev + 1e-12 || dist < -1e-12) ok = false;
              prev = dist;
            });
            runs += 1;
          });
        });
      }
      var tight = raise(setting(5, "plain", 80, 4));
      t.expect(ok && runs === 924 && night.movedIns > tight.movedIns && f2(tight.movedIns) === "0.01",
        "in all 924 runs of the pull-back from 0.25 to 4 (every batch count, copybook kind and lean), the distance from the copybook copy never grows as the pull-back strengthens; last night's 2.44 shrinks to 0.01 at 4");

      // 8. The same settings give the same numbers, bit for bit, and the draws repeat after a reset.
      var a1 = raise(setting(7, "refuse", 35, 1.25)), w1 = sheets(65), r1 = fitMarks(w1), r2 = fitMarks(sheets(65)), same = true;
      var a2 = raise(setting(7, "refuse", 35, 1.25));
      KINDS.forEach(function (k) {
        if (a1.lib[k] !== a2.lib[k] || a1.cpy[k] !== a2.cpy[k] || a1.ins[k] !== a2.ins[k] || a1.r[k] !== a2.r[k] || r1[k] !== r2[k]) same = false;
      });
      t.expect(same && a1.movedIns === a2.movedIns && a1.movedCpy === a2.movedCpy &&
        pick(night.ins, 0) === "more" && pick(night.ins, 0.5) === "flatter" && pick(night.ins, 0.999) === "flatter" && pick(night.ins, 0.2) === "plain",
        "the same settings give bit-identical chances, marks and distances, the reward model's fit repeats exactly, and a draw is a fixed function of its random number");

      // 9. Every story number, checked exactly.
      var pctOf = function (q) { return KINDS.map(function (k) { return pct(q[k]); }).join(" "); };
      var ten = raise(setting(10, "plain", 80, 0.5)), v80 = worth(80);
      t.expect(BATCH_SIZE * STORY_BATCHES === 200 && INSPECTORS * FRIDAYS * PAIRS === 360 && PER_PAIR === 60 && STORY_PULL === 0.5 &&
        KINDS.length * (KINDS.length - 1) / 2 === PAIRS &&
        pctOf(night.lib) === "62 23 11 4" && pctOf(night.cpy) === "10 87 2 1" && pctOf(night.ins) === "1 24 75 0" &&
        night.W.flatter.plain === 55 && f2(night.movedIns) === "2.44" && f2(night.movedCpy) === "0.93" &&
        f2(night.r.flatter) === "2.26" && f2(night.r.plain) === "-0.23" &&
        pct(tight.ins.plain) === 87 && pct(tight.ins.flatter) === 3 && pctOf(tight.ins) === "9 87 3 1" && f2(tight.ins.flatter) === "0.03" &&
        topMark(tight.r) === "flatter" &&
        pct(ten.cpy.plain) === 98 && pct(ten.ins.flatter) === 31 && pct(ten.ins.plain) === 68 &&
        fix.W.plain.flatter === 55 && pct(fix2.ins.plain) === 97 && pct(fix2.ins.flatter) === 1 && pctOf(fix2.ins) === "2 97 1 0" &&
        55 * 12 === 60 * 11 && 12 * FRIDAYS * PAIRS === 720 &&
        Math.round(2 * PER_PAIR * sigmoid(SHARP * (v80.flatter - v80.plain))) === 110 && START_CLOCK === 9000,
        "story numbers: 200 answers in 5 batches of 40, 360 ticks from 6 inspectors over 10 Fridays, 60 per pair, pull-back 0.5; the three copies at 62 23 11 4, 10 87 2 1 and 1 24 75 0 percent; 55 of 60; moved 2.44 and 0.93; marks 2.26 and -0.23; pull-back 4 at 9 87 3 1 with flattery still top-marked; 10 batches at 98, then 31 and 68; re-instructed inspectors 55 of 60, then 2 97 1 0 at pull-back 2; 11 in 12; 720 ticks and 110 of 120; half past two");

      // 10. The controls: each copy, the lean, the pull-back, the batches, the copybook kind, ask, reset.
      t.set("stage", "library");
      var libView = n("correct") === 0.23 && n("flattery") === 0.11 && t.stat("moved") === "-" && t.stat("top") === "more questions";
      t.set("stage", "copybook");
      var cpyView = n("correct") === 0.87 && n("flattery") === 0.02 && n("moved") === 0.93 && t.stat("top") === "correct";
      t.set("stage", "inspected");
      t.set("lean", 20);
      await t.run(1);
      var leanView = n("correct") === 1 && st().res.W.plain.flatter === 55 && t.logText().indexOf("Inspectors at 20 percent") >= 0;
      t.set("pull", 2);
      await t.run(1);
      var fixView = n("correct") === 0.97 && n("flattery") === 0.01;
      t.set("lean", 80);
      t.set("pull", 4);
      await t.run(1);
      var tightView = n("flattery") === 0.03 && n("correct") === 0.87 && n("moved") === 0.01 && t.stat("top") === "correct";
      t.set("pull", 0.5);
      t.set("batches", 10);
      await t.run(1);
      var tenView = n("flattery") === 0.31 && n("correct") === 0.68;
      t.set("batches", 5);
      t.set("demo", "flatter");
      t.set("stage", "copybook");
      var demoView = n("flattery") === 0.85 && t.stat("top") === "flattery";
      t.click("reset");
      await t.run(1);
      t.click("ask");
      var first = st().asked, firstLog = t.logText().indexOf(ANSWERS[first]) >= 0;
      t.click("reset");
      await t.run(1);
      t.click("ask");
      var again = st().asked;
      t.expect(libView && cpyView && leanView && fixView && tightView && tenView && demoView &&
        KINDS.indexOf(first) >= 0 && firstLog && first === again &&
        st().stage === "inspected" && st().lean === 80 && st().pull === 0.5 && n("flattery") === 0.75,
        "the controls: the library copy shows 0.23 correct and no distance, the copybook copy 0.87 and 0.93, lean 20 gives 1.00 and 55 of 60, pull-back 2 gives 0.97, lean 80 at pull-back 4 gives flattery 0.03 and 0.01 moved, 10 batches give 0.31 and 0.68, a flattering copybook gives 0.85; Ask logs one of the four answers and repeats after a reset; reset returns to last night");
    }
  });
})();
