/* sims/a1e08-v1.0.0.js  (published as sims/a1e08.js)
   Case a1e08 "Bigger Isn't Always Better": a library-growth lab built from Eskil's night at the
   Wexcombe Library, which adds a wing a year and trains a bigger reader for every one.

   CHANGELOG
   v1.0.0 (2026-10-07) first version: a widget-style sim built inside api.root (no diagram), drawn as
     one inline SVG chart and one table that use theme classes only. Part A, scaling: pick a training
     compute budget and a number of parameters; the tokens that size can afford follow from the
     approximation FLOPs = 6 x N x D, and the predicted loss comes from the Chinchilla paper's fitted
     formula with its printed constants. The chart draws the loss of every split of the chosen budget,
     marks the best split (the paper's equation 4), the library's readers at their own budgets, and
     the best loss at every budget in the list. Part B, choosing: the four readers Eskil could put on
     the night desks, with the enquiry-book scores, teaching prices and answer times from his replies;
     the smallest one that clears Mrs Quarmby's bar is picked, and a month at the desks' volume is
     priced, with a share of unsure questions sent up to the frontier model. Controls: compute,
     parameters, the bar, the share sent up, reset. Stats: tokens it can read, predicted loss, best
     size for this compute, loss at the best split, desk pick, monthly bill. Fully deterministic: no
     random numbers anywhere. selfTest covers the start, the formula against independently computed
     values, loss never rising with more parameters or more tokens, the grid's best split against the
     analytic optimum at every budget, Chinchilla-like against Gopher-like at equal compute, exact cost
     math, the pick being the smallest that passes at every bar, every story number, the replication's
     constants giving the same verdicts, determinism, and the controls.

   The formula (Hoffmann et al. 2022, "Training Compute-Optimal Large Language Models", arXiv
   2203.15556). Functional form: equation (2), section 3.3. Fitted constants exactly as printed in
   equation (10), Appendix D.2: L(N, D) = E + A / N^alpha + B / D^beta with E = 1.69, A = 406.4,
   B = 410.7, alpha = 0.34, beta = 0.28. N is parameters, D is training tokens. Best split of a budget
   C under FLOPs(N, D) = 6ND: equation (4), N_opt = G (C/6)^a, D_opt = G^-1 (C/6)^b, with
   G = (alpha A / (beta B))^(1/(alpha+beta)), a = beta/(alpha+beta), b = alpha/(alpha+beta).
   Gopher's budget, 5.76 x 10^23 FLOPs, is from the caption of the paper's Figure 2.
   The replication's constants (Besiroglu, Erdil, Barnett and You, Epoch AI, 2024, arXiv 2404.10102,
   equation 3): E = 1.8172, A = 482.01, B = 2085.43, alpha = 0.3478, beta = 0.3658. Used only in
   selfTest, to check that every comparison in the case comes out the same way with them.

   Where every number comes from (conventions rule 14; the case is content/latent/a1/a1e08-v1.0.0.json).
   Losses come from the formula above; values in brackets are unrounded.
   - post: wings a year since 2024; readers of 1B (West Wing, 2024), 2B (East Wing, 2025) and 4B (New
     Wing, this spring) parameters, each twice the last (WINGS); the catalogue, 20 billion tokens
     (CATALOGUE), read by every wing's reader; the allowance doubled every year; the reading room's
     allowance the same size as the New Wing's; the 2:14 log; the enquiry book of 400 questions
     (ENQUIRIES) with 352, 324 and 300 right (MODELS); next year's allowance twice this one and an 8B
     North Wing reader on the catalogue.
   - evidence diagram and caption: West 1B, 20B tokens, loss 2.580 (2.580048) at 1.2 x 10^20 FLOPs;
     East 2B, 20B, 2.506 (2.505731) at 2.4 x 10^20; New 4B, 20B, 2.447 (2.447018) at 4.8 x 10^20;
     reading room 1B, 80B, 2.408 (2.407589) at 4.8 x 10^20; catalogue 20B tokens, basement 60B
     (BASEMENT); same compute for the last two.
   - comments: 6 x 4B x 20B = 6 x 1B x 80B = 4.8 x 10^20; 5 and 80 tokens per parameter; the
     contractor's $0.10 per million tokens for every billion parameters (CENTS_PER_MTOK_PER_B), so
     $0.10, $0.20 and $0.40; answer times 0.5, 0.8 and 1.4 seconds; the hosted frontier model 380 of
     400 at $8 per million tokens and 2.6 seconds; 10,000 questions a night (QUESTIONS_PER_NIGHT) of
     about 2,000 tokens (TOKENS_PER_QUESTION), priced over a month of 30 nights (NIGHTS, stated in the
     sim lede); the bar, 340 of 400 (STORY_BAR = 85 percent); the basement's 60 billion tokens.
   - sim.lede and tryThis: the constants above; 4B at 4.8 x 10^20 reads 20.0B tokens for 2.447; the
     best split there is 1.31B parameters (1.309547) on 61.1B tokens (61.0898), 2.405 (2.405099),
     about 47 tokens per parameter (46.65); 1B reads 80.0B for 2.408; 8B reads 10.0B for 2.515
     (2.515459); West 2.580, East 2.506; at 9.6 x 10^20, 8B on 20B gives 2.401 (2.400632), 2B on
     80B gives 2.333 (2.333273), best split 1.79B (1.790895) on 89.3B (89.3408) for 2.333 (2.332900);
     at 5.76 x 10^23, 70B gives 1.938 (1.937590) on 1.37 trillion tokens and 280B gives 1.984
     (1.984042) on 343 billion, best 32.2B (32.18986) on 2,982B (2982.31) tokens, 93 per parameter
     (92.65), 1.931 (1.930748); bar 85 percent picks the reading room reader at $60.00 a month; bar 89
     picks the frontier model at $4,800.00; 10 percent sent up gives $534.00.
   - reply part 2: $60, $240 and $4,800 a month (600 million tokens x the prices); $534 with one
     question in ten sent up (90 x 6,000 + 10 x 480,000 cents, over 100); 0.5, 1.4 and 2.6 seconds;
     352, 324 and 380 of 400; 2.401 against 2.408; 2.333 within a thousandth of the best split's
     2.333 (difference 0.00037); eight times the cost per question (8B at $0.80 against 1B at $0.10).
   - explanation: drops of 0.074 (0.07432) and 0.059 (0.05871) as the wings doubled; 2^-0.34 = 0.79,
     the same share off the parameter term at every doubling; the floor on 20 billion tokens, 2.226
     (2.226088); Chinchilla 70B on 1.4 trillion, 1.937 (1.936645), and Gopher 280B on 300 billion,
     1.993 (1.993258), by the formula; recall r5's splits at 9.6 x 10^20: 16B on 10B 2.479, 8B on 20B
     2.401, 2B on 80B 2.333, 0.5B on 320B 2.385.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the whole widget inside api.root on every reset. No step() is
     needed because nothing animates; every number is worked out the moment a control changes.
   - Treating the library's text as if it behaved like the paper's training text is a teaching
     simplification. Real constants depend on the data, the tokenizer and the training setup.
   - The sliders pick from fixed lists (BUDGETS, NS) so that every story point is hit exactly.
   - Money is kept in whole cents and tokens in whole millions, so every bill is exact in floating
     point and the tests compare with ===.
   - Stats get bare numbers or words (units live in the labels).
   - Colors come only from theme classes: dg, dg-edge with tone-accent (the curve), dg-axis, dg-label,
     dot with dot-ok (the best split), dot-accent (your choice), dot-req (the library's readers) and
     dot-wait (the best loss at each budget), muted, small. Opacity is a number, not a color.
*/
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- the paper's formula ---------- */

  // Hoffmann et al. 2022, Appendix D.2, equation (10): constants exactly as printed.
  var E = 1.69, A = 406.4, B = 410.7, ALPHA = 0.34, BETA = 0.28;
  var PAPER = { E: E, A: A, B: B, alpha: ALPHA, beta: BETA };
  // Besiroglu et al. 2024 (Epoch AI), equation (3): the replication's refit. Used only in selfTest.
  var EPOCH = { E: 1.8172, A: 482.01, B: 2085.43, alpha: 0.3478, beta: 0.3658 };

  function lossWith(k, N, D) { return k.E + k.A / Math.pow(N, k.alpha) + k.B / Math.pow(D, k.beta); }
  function loss(N, D) { return lossWith(PAPER, N, D); }

  // Training compute, by the approximation the paper uses in equation (4): FLOPs(N, D) = 6ND.
  function flops(N, D) { return 6 * N * D; }
  function tokensFor(C, N) { return C / (6 * N); }

  // Equation (4): the best split of a budget C.
  var G = Math.pow((ALPHA * A) / (BETA * B), 1 / (ALPHA + BETA));
  var EXP_N = BETA / (ALPHA + BETA);
  function best(C) {
    var N = G * Math.pow(C / 6, EXP_N), D = tokensFor(C, N);
    return { N: N, D: D, L: loss(N, D) };
  }

  // The paper's runs (abstract): 70 million to over 16 billion parameters, 5 to 500 billion tokens.
  var FIT_N_LO = 7e7, FIT_N_HI = 1.6e10, FIT_D_LO = 5e9, FIT_D_HI = 5e11;
  function inFit(N, D) { return N >= FIT_N_LO && N <= FIT_N_HI && D >= FIT_D_LO && D <= FIT_D_HI; }

  // A fine grid over log10 of parameters, for checking equation (4) by brute force.
  var GRID_LO = 7, GRID_HI = 13, GRID_STEP = 0.001;
  function gridBest(C) {
    var n = Math.round((GRID_HI - GRID_LO) / GRID_STEP), bestK = 0, bestL = Infinity, k;
    for (k = 0; k <= n; k++) {
      var N = Math.pow(10, GRID_LO + k * GRID_STEP), l = loss(N, tokensFor(C, N));
      if (l < bestL) { bestL = l; bestK = k; }
    }
    return { N: Math.pow(10, GRID_LO + bestK * GRID_STEP), L: bestL };
  }

  /* ---------- the story's numbers ---------- */

  var CATALOGUE = 2e10;            // tokens: every book the library owns, typed up
  var BASEMENT = 6e10;             // tokens: what Ottoline's volunteers typed up in the basement
  var ALLOWANCE = 4.8e20;          // FLOPs: this year's allowance, the New Wing's and the reading room's each
  var NEXT_ALLOWANCE = 9.6e20;     // FLOPs: next year's, twice this one
  var GOPHER_BUDGET = 5.76e23;     // FLOPs: Gopher's budget, Figure 2 of the paper

  // Every wing's reader: twice the parameters of the last, on the same catalogue.
  var WINGS = [
    { id: "west", year: 2024, N: 1e9, C: 1.2e20 },
    { id: "east", year: 2025, N: 2e9, C: 2.4e20 },
    { id: "new", year: 2026, N: 4e9, C: 4.8e20 }
  ];

  // Markers on the chart, each drawn when the chosen budget is its own. place: where its label sits.
  var MARKERS = [
    { id: "west", label: "west wing", N: 1e9, C: 1.2e20, place: "below-start" },
    { id: "east", label: "east wing", N: 2e9, C: 2.4e20, place: "above-start" },
    { id: "new", label: "new wing", N: 4e9, C: ALLOWANCE, place: "above-start" },
    { id: "reading", label: "reading room", N: 1e9, C: ALLOWANCE, place: "below-end" },
    { id: "north", label: "8B plan", N: 8e9, C: NEXT_ALLOWANCE, place: "above-start" },
    { id: "plan2b", label: "2B reads all 80B", N: 2e9, C: NEXT_ALLOWANCE, place: "below-end" },
    { id: "chin", label: "Chinchilla-like 70B", N: 7e10, C: GOPHER_BUDGET, place: "below-middle" },
    { id: "goph", label: "Gopher-like 280B", N: 2.8e11, C: GOPHER_BUDGET, place: "above-start" }
  ];

  // The compute slider's stops, in FLOPs. Every story budget is one of them.
  var BUDGETS = [1e19, 3e19, 1.2e20, 2.4e20, 4.8e20, 9.6e20, 3e21, 1e22, 1e23, 5.76e23, 1e24];
  // The parameters slider's stops. Every story size is one of them.
  var NS = [1e8, 2.5e8, 5e8, 1e9, 2e9, 4e9, 8e9, 1.6e10, 3.5e10, 7e10, 1.4e11, 2.8e11, 5.6e11];
  var STORY_BI = 4;                // 4.8 x 10^20
  var STORY_NI = 5;                // 4B: the New Wing reader

  // Part B: the readers Eskil could put on the desks, smallest first. The frontier model's size is
  // not published; it is treated as the largest. Prices are teaching prices, in cents per million tokens.
  var CENTS_PER_MTOK_PER_B = 10;   // the contractor's rule: $0.10 per million tokens per billion parameters
  var MODELS = [
    { id: "reading", short: "reading room", name: "Reading room reader", size: "1B", params: 1e9, score: 352, priceCents: 10, secs: 0.5 },
    { id: "east", short: "east wing", name: "East Wing reader", size: "2B", params: 2e9, score: 300, priceCents: 20, secs: 0.8 },
    { id: "new", short: "new wing", name: "New Wing reader", size: "4B", params: 4e9, score: 324, priceCents: 40, secs: 1.4 },
    { id: "frontier", short: "frontier model", name: "Hosted frontier model", size: "not published", params: null, score: 380, priceCents: 800, secs: 2.6 }
  ];
  var FRONTIER = MODELS[3];
  var ENQUIRIES = 400;
  var STORY_BAR = 85;              // percent: 340 of 400
  var QUESTIONS_PER_NIGHT = 10000;
  var NIGHTS = 30;
  var TOKENS_PER_QUESTION = 2000;
  var MTOK_PER_MONTH = QUESTIONS_PER_NIGHT * NIGHTS * TOKENS_PER_QUESTION / 1e6;   // 600
  var MAX_UP = 50, UP_STEP = 5;
  var STORY_UP = 10;               // percent sent up in the senior answer's part 2
  var NORTH_PRICE_CENTS = CENTS_PER_MTOK_PER_B * 8;   // an 8B reader by the contractor's rule

  var START_CLOCK = 3 * 3600 + 10 * 60;   // ten past three in the morning
  var NARRATE_DELAY = 0.4;                // real seconds of stillness on a slider before the log speaks

  /* ---------- Part B arithmetic ---------- */

  function passes(m, bar) { return m.score * 100 >= bar * ENQUIRIES; }
  function pickFor(bar) {
    for (var i = 0; i < MODELS.length; i++) if (passes(MODELS[i], bar)) return MODELS[i];
    return null;
  }
  function monthlyCents(m) { return MTOK_PER_MONTH * m.priceCents; }
  // A share `pct` percent of questions sent up to the frontier model, the rest answered by `m`.
  function routedCents(m, pct) {
    if (m === FRONTIER) return monthlyCents(FRONTIER);
    return ((100 - pct) * monthlyCents(m) + pct * monthlyCents(FRONTIER)) / 100;
  }

  /* ---------- formatting ---------- */

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function f3(v) { return v.toFixed(3); }
  function commas(s) {
    var parts = s.split("."), i = parts[0], out = "";
    while (i.length > 3) { out = "," + i.slice(-3) + out; i = i.slice(0, -3); }
    return i + out + (parts.length > 1 ? "." + parts[1] : "");
  }
  // Billions, for stats (no commas) and for text (commas).
  function bil(x) { var v = x / 1e9; return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); }
  function bilText(x) { return commas(bil(x)); }
  function sizeText(N) { return N >= 1e9 ? String(N / 1e9) + "B" : String(N / 1e6) + "M"; }
  function dollarsStat(cents) { return (cents / 100).toFixed(2); }
  function dollars(cents) { return commas(dollarsStat(cents)); }
  function priceText(cents) { return "$" + (cents / 100).toFixed(2); }
  function budgetText(C) {
    var e = Math.floor(Math.log(C) / Math.LN10 + 1e-9), m = Math.round(C / Math.pow(10, e) * 100) / 100;
    return m + " × 10^" + e;
  }
  function idx(v, n) { var k = Math.round(Number(v)); return k >= 0 && k < n ? k : -1; }

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
      "Part A predicts loss with the Chinchilla paper's fitted formula and its printed constants, as if the library's text " +
      "behaved like the paper's: a teaching simplification. Part B uses the scores, teaching prices and answer times from Eskil's replies."));

    box.appendChild(head("Part A · one compute budget, every split between parameters and tokens"));
    var chart = mk(doc, "svg", { viewBox: "0 0 640 250", width: "100%", "class": "dg", role: "img", "aria-label": "" });
    box.appendChild(chart);
    var chartNote = el("p", "", "margin:0;font-size:13px;", "");
    chartNote.setAttribute("aria-live", "polite");
    box.appendChild(chartNote);

    box.appendChild(head("Part B · choosing a reader for the night desks"));
    var table = el("table", "", "", "");
    var thead = el("thead", "", "", "");
    var hr = el("tr", "", "", "");
    ["reader", "size", "enquiry book", "clears the bar", "per million tokens", "seconds", "a month"].forEach(function (h) {
      hr.appendChild(el("th", "", "", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody", "", "", "");
    table.appendChild(tbody);
    box.appendChild(table);
    var pickNote = el("p", "", "margin:0;font-size:13px;", "");
    pickNote.setAttribute("aria-live", "polite");
    box.appendChild(pickNote);

    api.root.appendChild(box);
    return { doc: doc, el: el, chart: chart, chartNote: chartNote, tbody: tbody, pickNote: pickNote };
  }

  /* ---------- drawing Part A ---------- */

  var PX0 = 60, PX1 = 620, LOGN0 = 8, LOGN1 = 12, PY0 = 210, PY1 = 20, LOSS0 = 1.7, LOSS1 = 3.4;
  var TICKS_N = [[1e8, "100M"], [1e9, "1B"], [1e10, "10B"], [1e11, "100B"], [1e12, "1000B"]];
  var TICKS_L = [1.8, 2.2, 2.6, 3.0, 3.4];

  function xOf(N) { return PX0 + (Math.log(N) / Math.LN10 - LOGN0) * (PX1 - PX0) / (LOGN1 - LOGN0); }
  function yOf(L) { return PY0 - (L - LOSS0) * (PY0 - PY1) / (LOSS1 - LOSS0); }
  function yClamped(L) { return Math.max(PY1, Math.min(PY0, yOf(L))); }

  function curvePath(C) {
    var d = "", pen = false, k;
    for (k = 0; k <= 400; k++) {
      var N = Math.pow(10, LOGN0 + k * 0.01), L = loss(N, tokensFor(C, N));
      if (L <= LOSS1 && L >= LOSS0) {
        d += (d ? " " : "") + (pen ? "L " : "M ") + xOf(N).toFixed(1) + " " + yOf(L).toFixed(1);
        pen = true;
      } else {
        pen = false;
      }
    }
    return d;
  }

  function placeLabel(doc, svg, x, y, text, place) {
    var parts = place.split("-"), dy = parts[0] === "above" ? -9 : 17;
    var anchor = parts[1], dx = anchor === "start" ? 6 : anchor === "end" ? -6 : 0;
    txt(doc, svg, (x + dx).toFixed(1), (y + dy).toFixed(1), text, "dg-label", anchor, "font-size:10px;font-weight:400;");
  }

  function drawChart(S) {
    var ui = S.ui, doc = ui.doc, svg = ui.chart, C = BUDGETS[S.bi], N = NS[S.ni], D = tokensFor(C, N), L = loss(N, D), b = best(C);
    clear(svg);
    mk(doc, "path", { d: "M" + PX0 + " " + PY1 + " V " + PY0 + " H " + PX1, "class": "dg-axis", style: "fill:none" }, svg);
    TICKS_N.forEach(function (tk) {
      var x = xOf(tk[0]).toFixed(1);
      mk(doc, "path", { d: "M" + x + " " + PY0 + " v 5", "class": "dg-axis" }, svg);
      txt(doc, svg, x, PY0 + 18, tk[1], "dg-axis", "middle", "font-size:10px;");
    });
    TICKS_L.forEach(function (v) {
      var y = yOf(v).toFixed(1);
      mk(doc, "path", { d: "M" + (PX0 - 5) + " " + y + " h 5", "class": "dg-axis" }, svg);
      txt(doc, svg, PX0 - 8, Number(y) + 4, v.toFixed(1), "dg-axis", "end", "font-size:10px;");
    });
    txt(doc, svg, PX0 + 4, 12, "predicted loss", "dg-axis", "start", "font-size:10px;");
    txt(doc, svg, (PX0 + PX1) / 2, 244, "parameters, log scale (tokens read = compute / (6 × parameters))", "dg-axis", "middle", "font-size:10px;");

    // The best loss at every budget in the list: loss falls smoothly as compute grows.
    BUDGETS.forEach(function (c) {
      var o = best(c);
      if (o.L > LOSS1 || o.L < LOSS0) return;
      mk(doc, "circle", { cx: xOf(o.N).toFixed(1), cy: yOf(o.L).toFixed(1), r: 2.5, "class": "dot dot-wait", "fill-opacity": "0.7" }, svg);
    });

    // Every split of this budget.
    mk(doc, "path", { d: curvePath(C), "class": "dg-edge tone-accent", style: "fill:none;stroke-width:2" }, svg);

    // The library's readers, and Chinchilla and Gopher, at their own budgets.
    MARKERS.forEach(function (m) {
      if (m.C !== C) return;
      var lm = loss(m.N, tokensFor(C, m.N)), x = xOf(m.N), y = yClamped(lm);
      mk(doc, "circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: 4.5, "class": "dot dot-req", "fill-opacity": "0.9" }, svg);
      placeLabel(doc, svg, x, y, m.label, m.place);
    });

    // The best split, and your choice.
    var bx = xOf(b.N), by = yClamped(b.L);
    mk(doc, "circle", { cx: bx.toFixed(1), cy: by.toFixed(1), r: 5, "class": "dot dot-ok", "fill-opacity": "0.9" }, svg);
    placeLabel(doc, svg, bx, by, "best split", "above-middle");
    mk(doc, "circle", { cx: xOf(N).toFixed(1), cy: yClamped(L).toFixed(1), r: 6, "class": "dot dot-accent", "fill-opacity": "0.6" }, svg);

    svg.setAttribute("aria-label", "Predicted loss for every split of " + budgetText(C) + " FLOPs between parameters and tokens. " +
      "Your choice: " + sizeText(N) + " parameters reading " + bilText(D) + " billion tokens, loss " + f3(L) + ". " +
      "Best split: " + bil(b.N) + " billion parameters on " + bilText(b.D) + " billion tokens, loss " + f3(b.L) + ".");

    ui.chartNote.textContent = "At " + budgetText(C) + " FLOPs, " + sizeText(N) + " parameters can read " + bilText(D) +
      " billion tokens (" + tpp(N, D) + " per parameter): predicted loss " + f3(L) + ". The best split for this compute is " +
      bil(b.N) + " billion parameters on " + bilText(b.D) + " billion tokens (" + tpp(b.N, b.D) + " per parameter), loss " + f3(b.L) + "." +
      (inFit(N, D) ? "" : " This split is outside the sizes the paper trained, 70 million to 16 billion parameters on 5 to 500 billion tokens, so the formula is being stretched.");
  }

  function tpp(N, D) {
    var r = D / N;
    return r >= 10 ? String(Math.round(r)) : r >= 1 ? r.toFixed(1) : r.toFixed(2);
  }

  /* ---------- drawing Part B ---------- */

  function drawTable(S) {
    var ui = S.ui, p = pickFor(S.bar);
    clear(ui.tbody);
    MODELS.forEach(function (m) {
      var tr = ui.el("tr", "", "", ""), cls = m === p ? "" : "muted";
      tr.appendChild(ui.el("td", cls, "", m.name + (m === p ? " (picked)" : "")));
      tr.appendChild(ui.el("td", cls, "", m.size));
      tr.appendChild(ui.el("td", cls, "font-variant-numeric:tabular-nums;", m.score + " of " + ENQUIRIES));
      tr.appendChild(ui.el("td", cls, "", passes(m, S.bar) ? "yes" : "no"));
      tr.appendChild(ui.el("td", cls, "font-variant-numeric:tabular-nums;", priceText(m.priceCents)));
      tr.appendChild(ui.el("td", cls, "font-variant-numeric:tabular-nums;", m.secs.toFixed(1)));
      tr.appendChild(ui.el("td", cls, "font-variant-numeric:tabular-nums;", "$" + dollars(monthlyCents(m))));
      ui.tbody.appendChild(tr);
    });
    var need = 4 * S.bar;
    if (!p) {
      ui.pickNote.textContent = "Bar " + S.bar + " percent, " + need + " of " + ENQUIRIES + ": no reader clears it. " +
        "Either the bar is set higher than any model here can meet, or the test needs looking at.";
      return;
    }
    var line = "Bar " + S.bar + " percent, " + need + " of " + ENQUIRIES + ". The smallest reader that clears it: the " +
      p.name.charAt(0).toLowerCase() + p.name.slice(1) + ", " + p.score + " right. At " + commas(String(QUESTIONS_PER_NIGHT)) +
      " questions a night of about " + commas(String(TOKENS_PER_QUESTION)) + " tokens, a month is " + MTOK_PER_MONTH +
      " million tokens: $" + dollars(monthlyCents(p)) + ".";
    if (p === FRONTIER) line += " It is already the biggest, so nothing is sent up.";
    else if (S.up > 0) line += " With " + S.up + " percent of questions sent up to the frontier model, names stripped: $" + dollars(routedCents(p, S.up)) + " a month.";
    ui.pickNote.textContent = line;
  }

  function billCents(S) {
    var p = pickFor(S.bar);
    return p ? routedCents(p, S.up) : null;
  }

  function drawStats(S) {
    var C = BUDGETS[S.bi], N = NS[S.ni], D = tokensFor(C, N), b = best(C), p = pickFor(S.bar), bc = billCents(S);
    S.stat.tokens(bil(D));
    S.stat.loss(f3(loss(N, D)));
    S.stat.bestN(bil(b.N));
    S.stat.bestL(f3(b.L));
    S.stat.pick(p ? p.short : "none");
    S.stat.bill(bc === null ? "-" : dollarsStat(bc));
  }

  function draw(api) {
    var S = api.state;
    drawChart(S);
    drawTable(S);
    drawStats(S);
  }

  /* ---------- narration ---------- */

  function summaryA(S) {
    var C = BUDGETS[S.bi], N = NS[S.ni], D = tokensFor(C, N), b = best(C);
    return budgetText(C) + " FLOPs on " + sizeText(N) + " parameters: " + bilText(D) + " billion tokens, loss " + f3(loss(N, D)) +
      ". Best split " + bil(b.N) + " billion on " + bilText(b.D) + " billion, loss " + f3(b.L) + ".";
  }

  function toneA(S) {
    var C = BUDGETS[S.bi], N = NS[S.ni], gap = loss(N, tokensFor(C, N)) - best(C).L;
    return gap < 0.005 ? "ok" : gap < 0.03 ? "warn" : "bad";
  }

  function summaryB(S) {
    var p = pickFor(S.bar), bc = billCents(S);
    if (!p) return "Bar " + S.bar + " percent: no reader clears it.";
    return "Bar " + S.bar + " percent: the " + p.short + (p === FRONTIER ? "" : " reader") + ", $" + dollars(bc) + " a month" +
      (S.up > 0 && p !== FRONTIER ? " with " + S.up + " percent sent up." : ".");
  }

  function narrateLater(api, text, tone) {
    var S = api.state;
    if (S.narrateTimer) S.narrateTimer.cancel();
    S.narrateTimer = api.after(NARRATE_DELAY, function () {
      S.narrateTimer = null;
      api.log(text(S), tone(S));
    });
  }

  function setBudget(api, v) {
    var S = api.state, k = idx(v, BUDGETS.length);
    if (k < 0) return;
    S.bi = k;
    draw(api);
    narrateLater(api, summaryA, toneA);
  }

  function setParams(api, v) {
    var S = api.state, k = idx(v, NS.length);
    if (k < 0) return;
    S.ni = k;
    draw(api);
    narrateLater(api, summaryA, toneA);
  }

  function setBar(api, v) {
    var S = api.state, k = Math.round(Number(v));
    if (!(k >= 50 && k <= 100)) return;
    S.bar = k;
    draw(api);
    narrateLater(api, summaryB, function (s) { return pickFor(s.bar) ? "ok" : "bad"; });
  }

  function setUp(api, v) {
    var S = api.state, k = Math.round(Number(v) / UP_STEP) * UP_STEP;
    if (!(k >= 0 && k <= MAX_UP)) return;
    S.up = k;
    draw(api);
    narrateLater(api, summaryB, function () { return "warn"; });
  }

  /* ---------- the module ---------- */

  DL.sims.define("a1e08", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.bi = STORY_BI;
      S.ni = STORY_NI;
      S.bar = STORY_BAR;
      S.up = 0;
      S.narrateTimer = null;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.budget = api.control.range("budget", "Training compute, FLOPs", 0, BUDGETS.length - 1, 1, STORY_BI,
        function (v) { setBudget(api, v); },
        { format: function (v) { var k = idx(v, BUDGETS.length); return k < 0 ? "" : budgetText(BUDGETS[k]) + " FLOPs"; } });
      S.ctl.params = api.control.range("params", "Parameters, the shelves", 0, NS.length - 1, 1, STORY_NI,
        function (v) { setParams(api, v); },
        { format: function (v) { var k = idx(v, NS.length); return k < 0 ? "" : sizeText(NS[k]) + " parameters"; } });
      S.ctl.bar = api.control.range("bar", "Mrs Quarmby's bar, percent of the 400", 50, 100, 1, STORY_BAR,
        function (v) { setBar(api, v); },
        { format: function (v) { var k = Math.round(Number(v)); return k + " percent, " + (4 * k) + " of 400"; } });
      S.ctl.up = api.control.range("up", "Unsure questions sent up to the frontier model", 0, MAX_UP, UP_STEP, 0,
        function (v) { setUp(api, v); },
        { format: function (v) { return Math.round(Number(v)) + " percent"; } });
      S.ctl.reset = api.control.button("reset", "Reset to the New Wing", function () { api.reset(); });

      S.stat = {
        tokens: api.stat("tokens", "tokens it can read, billions", ""),
        loss: api.stat("loss", "predicted loss", "warn"),
        bestN: api.stat("bestN", "best size for this compute, billions of parameters", "ok"),
        bestL: api.stat("bestL", "loss at the best split", "ok"),
        pick: api.stat("pick", "desk pick: smallest that clears the bar", ""),
        bill: api.stat("bill", "monthly bill at the desks, dollars", "")
      };

      api.info("<strong>How to read it.</strong> Part A: a training run's compute is about 6 × parameters × tokens read, so for a " +
        "fixed budget every extra parameter means fewer tokens. The curve is the predicted loss of every split of the chosen budget, " +
        "from the Chinchilla paper's formula L = E + A/N^α + B/D^β with E = 1.69, A = 406.4, B = 410.7, α = 0.34 and β = 0.28. " +
        "The best-split dot is the bottom of that curve, the larger dot is your choice, the labelled dots are the library's readers " +
        "and Chinchilla and Gopher at their own budgets, and the small dots are the best loss at every budget in the list. " +
        "Part B: the reader picked is the smallest that clears the bar on the enquiry book; the bill is a month at the desks, " +
        "with the share you choose sent up to the frontier model. Prices are teaching prices.");
      draw(api);
      api.log("Ten past three. The New Wing reader: " + summaryA(S) + " Ottoline's reader spent the same compute on 1B parameters " +
        "and 80 billion tokens: " + f3(loss(1e9, tokensFor(ALLOWANCE, 1e9))) + ".", "warn");
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function n(id) { return Number(t.stat(id)); }
      var ok, i, k, checks;

      // 1. The start is the New Wing reader at this year's allowance.
      await t.run(1);
      t.expect(BUDGETS[st().bi] === ALLOWANCE && NS[st().ni] === 4e9 && st().bar === 85 && st().up === 0 &&
        n("tokens") === 20 && n("loss") === 2.447 && n("bestN") === 1.31 && n("bestL") === 2.405 &&
        t.stat("pick") === "reading room" && n("bill") === 60 && t.logText().indexOf("2.408") >= 0,
        "the start is the New Wing reader: 4.8 × 10^20 FLOPs on 4B parameters reads 20.0 billion tokens, loss 2.447; best split 1.31B, loss 2.405; the reading room reader is the desk pick at $60.00; the log names Ottoline's 2.408");

      // 2. The formula with the paper's printed constants reproduces values computed independently.
      var REF = [
        [1e9, 8e10, 2.4075894359576346], [1e9, 2e10, 2.5800478722379934], [2e9, 2e10, 2.5057309783475397],
        [4e9, 2e10, 2.4470175620047154], [8e9, 2e10, 2.4006315375332488], [2e9, 8e10, 2.333272542067181],
        [8e9, 1e10, 2.515458902397185], [7e10, 1.4e12, 1.9366454705587173], [2.8e11, 3e11, 1.9932584616598494]
      ];
      ok = true;
      REF.forEach(function (r) { if (Math.abs(loss(r[0], r[1]) - r[2]) > 1e-12) ok = false; });
      REF.forEach(function (r) {
        var alt = 1.69 + 406.4 * Math.exp(-0.34 * Math.log(r[0])) + 410.7 * Math.exp(-0.28 * Math.log(r[1]));
        if (Math.abs(alt - loss(r[0], r[1])) > 1e-12) ok = false;
      });
      var o48 = best(ALLOWANCE), o96 = best(NEXT_ALLOWANCE);
      t.expect(ok && E === 1.69 && A === 406.4 && B === 410.7 && ALPHA === 0.34 && BETA === 0.28 &&
        Math.abs(o48.N / 1309547013.0680747 - 1) < 1e-9 && Math.abs(o48.L - 2.4050990241086927) < 1e-12 &&
        Math.abs(o96.N / 1790895002.7641253 - 1) < 1e-9 && Math.abs(o96.L - 2.332900132191852) < 1e-12 &&
        Math.abs(flops(o48.N, o48.D) / ALLOWANCE - 1) < 1e-12,
        "with E 1.69, A 406.4, B 410.7, alpha 0.34 and beta 0.28 (equation 10), the formula matches nine losses computed independently to 1e-12, two ways, and equation 4's best splits at 4.8 and 9.6 × 10^20 match their independent values and spend exactly the budget");

      // 3. Loss never rises with more parameters at fixed tokens, or with more tokens at fixed parameters.
      ok = true;
      checks = 0;
      [1e9, 5e9, 1e10, 2e10, 8e10, 1e12].forEach(function (D) {
        var prev = Infinity;
        for (k = 0; k <= 600; k++) {
          var l = loss(Math.pow(10, 7 + k * 0.01), D);
          if (l > prev) ok = false;
          prev = l;
          checks += 1;
        }
      });
      [1e8, 1e9, 4e9, 7e10, 2.8e11].forEach(function (N) {
        var prev = Infinity;
        for (k = 0; k <= 600; k++) {
          var l = loss(N, Math.pow(10, 8 + k * 0.01));
          if (l > prev) ok = false;
          prev = l;
          checks += 1;
        }
      });
      t.expect(ok && checks === 11 * 601,
        "over 6,611 steps, loss never rises as parameters grow at six fixed token counts (10 million to 10 trillion parameters), or as tokens grow at five fixed sizes (100 million to 100 trillion tokens)");

      // 4. At every budget in the list, the grid's best split matches equation 4.
      ok = true;
      BUDGETS.forEach(function (C) {
        var g = gridBest(C), b = best(C);
        if (Math.abs(Math.log(g.N) / Math.LN10 - Math.log(b.N) / Math.LN10) > GRID_STEP + 1e-9) ok = false;
        if (g.L < b.L - 1e-12 || g.L > b.L + 1e-6) ok = false;
        if (Math.abs(b.N * b.D * 6 / C - 1) > 1e-12) ok = false;
      });
      t.expect(ok && BUDGETS.length === 11,
        "at all 11 budgets from 10^19 to 10^24 FLOPs, a brute-force search over 6,001 sizes finds the lowest loss within one grid step (0.001 in log10) of equation 4's best size, never below its loss and at most 1e-6 above it");

      // 5. Chinchilla-like beats Gopher-like at equal compute, by the formula.
      var dc = tokensFor(GOPHER_BUDGET, 7e10), dg = tokensFor(GOPHER_BUDGET, 2.8e11), ob = best(GOPHER_BUDGET);
      t.expect(Math.abs(flops(7e10, dc) / GOPHER_BUDGET - 1) < 1e-12 && Math.abs(flops(2.8e11, dg) / GOPHER_BUDGET - 1) < 1e-12 &&
        loss(7e10, dc) < loss(2.8e11, dg) && f3(loss(7e10, dc)) === "1.938" && f3(loss(2.8e11, dg)) === "1.984" &&
        Math.round(dc / 1e10) / 100 === 1.37 && Math.round(dg / 1e9) === 343 &&
        loss(7e10, 1.4e12) < loss(2.8e11, 3e11) && f3(loss(7e10, 1.4e12)) === "1.937" && f3(loss(2.8e11, 3e11)) === "1.993" &&
        bil(ob.N) === "32.2" && bilText(ob.D) === "2,982" && tpp(ob.N, ob.D) === "93" && f3(ob.L) === "1.931",
        "at Gopher's budget, 5.76 × 10^23 FLOPs, a 70B model reading 1.37 trillion tokens predicts 1.938 against 1.984 for 280B reading 343 billion; at the paper's actual sizes, 70B on 1.4 trillion gives 1.937 and 280B on 300 billion 1.993; the formula's own best there is 32.2B on 2,982 billion tokens, 93 per parameter, 1.931");

      // 6. The cost math is exact.
      ok = true;
      for (k = 0; k <= MAX_UP; k += UP_STEP) {
        var rc = routedCents(MODELS[0], k);
        if (rc !== 6000 + 4740 * k || rc !== Math.round(rc)) ok = false;
      }
      for (i = 0; i < 3; i++) if (MODELS[i].priceCents !== CENTS_PER_MTOK_PER_B * MODELS[i].params / 1e9) ok = false;
      t.expect(ok && MTOK_PER_MONTH === 600 && QUESTIONS_PER_NIGHT * NIGHTS * TOKENS_PER_QUESTION === 600000000 &&
        monthlyCents(MODELS[0]) === 6000 && monthlyCents(MODELS[1]) === 12000 && monthlyCents(MODELS[2]) === 24000 &&
        monthlyCents(FRONTIER) === 480000 && routedCents(MODELS[0], STORY_UP) === 53400 && routedCents(FRONTIER, 30) === 480000 &&
        dollars(480000) === "4,800.00" && dollars(53400) === "534.00" && dollarsStat(6000) === "60.00" &&
        NORTH_PRICE_CENTS === 80 && NORTH_PRICE_CENTS / MODELS[0].priceCents === 8 && monthlyCents(MODELS[2]) / monthlyCents(MODELS[0]) === 4,
        "the cost math is exact in whole cents: 10,000 questions × 30 nights × 2,000 tokens = 600 million tokens; $60, $120, $240 and $4,800 a month; every share sent up from 0 to 50 percent gives 6,000 + 4,740 × share cents, so 10 percent is $534.00; the readers follow the $0.10 per billion parameters rule; the 8B plan costs 8 times the reading room per question");

      // 7. The choice is always the smallest model that clears the bar.
      ok = true;
      for (i = 1; i < MODELS.length; i++) {
        if (!(MODELS[i].params === null || MODELS[i].params > MODELS[i - 1].params)) ok = false;
      }
      for (k = 0; k <= 100; k++) {
        var p = pickFor(k), firstPass = null;
        for (i = 0; i < MODELS.length; i++) {
          if (MODELS[i].score / ENQUIRIES >= k / 100 - 1e-12) { firstPass = MODELS[i]; break; }
        }
        if (p !== firstPass) ok = false;
        if (p && !passes(p, k)) ok = false;
        for (i = 0; i < (p ? MODELS.indexOf(p) : MODELS.length); i++) if (passes(MODELS[i], k)) ok = false;
      }
      t.expect(ok && pickFor(85) === MODELS[0] && pickFor(88) === MODELS[0] && pickFor(89) === FRONTIER && pickFor(95) === FRONTIER &&
        pickFor(96) === null && !passes(MODELS[2], 85) && !passes(MODELS[1], 85) && passes(FRONTIER, 85),
        "for every bar from 0 to 100 percent, the pick clears the bar and nothing smaller does, checked against the scores directly; at 85 percent (340 of 400) the reading room reader is picked over the New Wing's 324 and the East Wing's 300; from 89 only the frontier model's 380 clears it, and above 95 nothing does");

      // 8. Every story number, checked exactly.
      var wingL = WINGS.map(function (w) { return f3(loss(w.N, tokensFor(w.C, w.N))); }).join(" ");
      var rrD = tokensFor(ALLOWANCE, 1e9), nwD = tokensFor(ALLOWANCE, 4e9);
      t.expect(flops(4e9, CATALOGUE) === ALLOWANCE && flops(1e9, CATALOGUE + BASEMENT) === ALLOWANCE &&
        flops(1e9, CATALOGUE) === 1.2e20 && flops(2e9, CATALOGUE) === 2.4e20 && NEXT_ALLOWANCE === 2 * ALLOWANCE &&
        flops(8e9, CATALOGUE) === NEXT_ALLOWANCE && flops(2e9, CATALOGUE + BASEMENT) === NEXT_ALLOWANCE &&
        WINGS[1].N === 2 * WINGS[0].N && WINGS[2].N === 2 * WINGS[1].N && WINGS[1].C === 2 * WINGS[0].C && WINGS[2].C === 2 * WINGS[1].C &&
        WINGS.every(function (w) { return tokensFor(w.C, w.N) === CATALOGUE; }) &&
        rrD === 8e10 && nwD === 2e10 && rrD / 1e9 === 80 && nwD / 4e9 === 5 && tokensFor(ALLOWANCE, 8e9) === 1e10 &&
        wingL === "2.580 2.506 2.447" && f3(loss(1e9, rrD)) === "2.408" && f3(loss(8e9, 1e10)) === "2.515" &&
        f3(loss(8e9, 2e10)) === "2.401" && f3(loss(2e9, 8e10)) === "2.333" &&
        bil(o48.N) === "1.31" && bil(o48.D) === "61.1" && tpp(o48.N, o48.D) === "47" && f3(o48.L) === "2.405" &&
        bil(o96.N) === "1.79" && bil(o96.D) === "89.3" && f3(o96.L) === "2.333" && loss(2e9, 8e10) - o96.L < 0.001 &&
        f3(loss(1e9, 2e10) - loss(2e9, 2e10)) === "0.074" && f3(loss(2e9, 2e10) - loss(4e9, 2e10)) === "0.059" &&
        f3(E + B / Math.pow(CATALOGUE, BETA)) === "2.226" && Math.pow(2, -ALPHA).toFixed(2) === "0.79" &&
        f3(loss(1.6e10, 1e10)) === "2.479" && f3(loss(5e8, 3.2e11)) === "2.385" && flops(1.6e10, 1e10) === NEXT_ALLOWANCE && flops(5e8, 3.2e11) === NEXT_ALLOWANCE &&
        MODELS[0].score === 352 && MODELS[1].score === 300 && MODELS[2].score === 324 && FRONTIER.score === 380 &&
        4 * STORY_BAR === 340 && ENQUIRIES === 400 &&
        MODELS[0].secs === 0.5 && MODELS[1].secs === 0.8 && MODELS[2].secs === 1.4 && FRONTIER.secs === 2.6 && FRONTIER.priceCents === 800 &&
        START_CLOCK === 11400,
        "story numbers: 6 × 4B × 20B = 6 × 1B × 80B = 4.8 × 10^20; the wings at 1.2, 2.4 and 4.8 × 10^20, each twice the last, all on the 20B catalogue; 5 and 80 tokens per parameter; losses 2.580, 2.506, 2.447 and 2.408, drops 0.074 and 0.059, floor 2.226; 8B on this allowance 2.515; next year 2.401 against 2.333, within 0.001 of the best split's 2.333; best splits 1.31B on 61.1B (47 per parameter) and 1.79B on 89.3B; recall splits 2.479 and 2.385; scores 352, 300, 324, 380 against 340 of 400; 0.5, 0.8, 1.4 and 2.6 seconds; ten past three");

      // 9. With the replication's refitted constants, every comparison in the case comes out the same way.
      var ep = function (N, D) { return lossWith(EPOCH, N, D); };
      t.expect(ep(1e9, 8e10) < ep(4e9, 2e10) && ep(2e9, 8e10) < ep(8e9, 2e10) && ep(7e10, dc) < ep(2.8e11, dg) &&
        ep(1e9, 2e10) > ep(2e9, 2e10) && ep(2e9, 2e10) > ep(4e9, 2e10) && ep(8e9, 1e10) > ep(4e9, 2e10) &&
        Math.abs(ep(1e9, 8e10) - 2.388567177437126) < 1e-9 && Math.abs(ep(4e9, 2e10) - 2.3934217778115894) < 1e-9,
        "with Epoch AI's refit (E 1.8172, A 482.01, B 2085.43, alpha 0.3478, beta 0.3658), the reading room still beats the New Wing (2.389 against 2.393), 2B on 80B still beats 8B on 20B, Chinchilla-like still beats Gopher-like, each wing still beats the last, and 8B on this allowance is still worse than the New Wing");

      // 10. Determinism: the same inputs give bit-identical numbers; nothing is random.
      var a1 = [loss(3.3e9, 4.4e10), best(7.7e21).N, gridBest(3e21).N, routedCents(MODELS[1], 35)];
      var a2 = [loss(3.3e9, 4.4e10), best(7.7e21).N, gridBest(3e21).N, routedCents(MODELS[1], 35)];
      t.expect(a1.every(function (v, j) { return v === a2[j]; }) && budgetText(ALLOWANCE) === "4.8 × 10^20" &&
        budgetText(GOPHER_BUDGET) === "5.76 × 10^23" && budgetText(1e19) === "1 × 10^19" && sizeText(2.5e8) === "250M",
        "the same inputs give bit-identical losses, best splits, grid searches and bills, and budgets and sizes print as the story writes them");

      // 11. The controls.
      t.set("params", 3);
      await t.run(1);
      var rrView = n("tokens") === 80 && n("loss") === 2.408 && t.logText().indexOf("2.408") >= 0;
      t.set("params", 6);
      var eightView = n("tokens") === 10 && n("loss") === 2.515;
      t.set("budget", 5);
      var northView = n("tokens") === 20 && n("loss") === 2.401 && n("bestN") === 1.79 && n("bestL") === 2.333;
      t.set("params", 4);
      var planView = n("tokens") === 80 && n("loss") === 2.333;
      t.set("budget", 2);
      t.set("params", 3);
      var westView = n("tokens") === 20 && n("loss") === 2.58;
      t.set("budget", 3);
      t.set("params", 4);
      var eastView = n("tokens") === 20 && n("loss") === 2.506;
      t.set("budget", 9);
      t.set("params", 9);
      var chinView = n("loss") === 1.938 && n("bestN") === 32.2 && n("bestL") === 1.931;
      t.set("params", 11);
      var gophView = n("loss") === 1.984;
      t.set("bar", 89);
      var barView = t.stat("pick") === "frontier model" && n("bill") === 4800;
      t.set("bar", 96);
      var noneView = t.stat("pick") === "none" && t.stat("bill") === "-";
      t.set("bar", 85);
      t.set("up", 10);
      await t.run(1);
      var upView = t.stat("pick") === "reading room" && n("bill") === 534 && t.logText().indexOf("10 percent sent up") >= 0;
      t.click("reset");
      await t.run(1);
      t.expect(rrView && eightView && northView && planView && westView && eastView && chinView && gophView && barView && noneView && upView &&
        st().bi === STORY_BI && st().ni === STORY_NI && st().bar === 85 && st().up === 0 && n("loss") === 2.447 && n("bill") === 60,
        "the controls: 1B reads 80.0B for 2.408, 8B reads 10.0B for 2.515, next year 8B gives 2.401 and 2B 2.333 against a best of 1.79B at 2.333, the West Wing 2.580, the East Wing 2.506, Chinchilla-like 1.938 and Gopher-like 1.984 against a best of 32.2B at 1.931; a bar of 89 picks the frontier model at $4,800, 96 picks none, 85 with 10 percent sent up costs $534; reset returns to the New Wing");
    }
  });
})();
