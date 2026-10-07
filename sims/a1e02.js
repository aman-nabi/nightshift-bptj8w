/* sims/a1e02-v1.0.0.js  (published as sims/a1e02.js)
   Case a1e02 "The Neuron in the Basement": a tiny network lab for Anselm's learner, the machine of
   brass dials in the basement of Magda's clock-repair shop.

   CHANGELOG
   v1.0.0 (2026-10-07) first version: a widget-style sim built inside api.root (no diagram), drawn as
     two inline SVG pictures that use theme classes only, copying the a1e01 template. The rack picture
     shows the two holes, the four back-row neurons and the front neuron, with one line per weight
     (thicker means a bigger dial, dashed means negative), and the four clocks on the machine's front
     with the machine's answer (solid hands) and the right hour (dashed hand). The loss chart plots the
     loss after every lesson on a log scale, marks every change of the STRIDE knob, and stops at NaN.
     Controls: back row (plugged in: a 2-4-1 network with 17 dials, or cut out: one neuron with 3
     dials), the STRIDE knob (learning rate 0, 0.01, 0.1 or 1.5), teach 1 lesson, teach 100 lessons,
     reset. Stats: lessons so far (epochs), loss, the biggest dial turn in the last lesson, clock 4's
     answer in hours. selfTest covers Thursday's start, the loss falling every lesson at 0.1, the tape
     of lessons 301 to 308 at 1.5, the doubling dial turns of lessons 309 to 312, Infinity at lesson 812
     and NaN at 1321, a seeded reset giving the same dials and the same loss, a knob at 0 changing
     nothing, 0.01 walking the same path ten times slower, one neuron stuck at a loss of 9 while the
     network fits, the knob turned back to 0.1 without a reset settling at 9 like one neuron, the loss
     growing every lesson at 1.5 from a fresh start, analytic gradients against finite differences,
     and the four clocks at lesson 500.

   Where every number comes from (conventions rule 14; the case is content/latent/a1/a1e02-v1.0.0.json).
   All of them follow from CARDS, the network below, plain full-batch gradient descent and the starting
   dials drawn from api.rand() with the engine's default seed (7):
   - post: the rack has 17 dials (4 back-row neurons with 2 weights and a bias each, a front neuron with
     4 weights and a bias); with the back row cut out, 3 (2 weights and a bias). The knob's stops are
     RATES. With the back row cut out at 0.1 the loss settles at 9.00 (every clock at 6:00; 9 is the
     least any weighted sum of the two holes can reach on 3, 9, 9, 3). With the back row in, at 0.1:
     lesson 0 loss 51.14 (51.1435), lesson 300 loss 0.085 (0.08532) with clock 4 at 3.34 h (3.3422).
     Then at 1.5, the tape: lesson 303 loss 0.022, clock 4 3.15; lesson 304 0.055, 3.34; lesson 305
     3.83, 1.27; lesson 306 307.32, 25.14 (shown as 1:09 tomorrow by clockReading, to the nearest
     minute); lesson 307 5245.37, -49.53; lesson 312, clock 4 at 2524.54 h (more than 100 days).
   - evidence diagram and caption: lessons 300, 303, 305, 306, 307 and 308 (clock 4 at 163.41 h, loss
     24786.44); misses of 0.34, 0.15, 1.73, 22.14, 52.53 and 160.41 hours.
   - comments: the biggest dial turn of lessons 309 to 312 is 472.23, 944.45, 1888.90 and 3777.80,
     each twice the one before; one neuron's 9.00 is six o'clock, three hours from both answers.
   - reply part 2s: left at 1.5, the loss reads Infinity from lesson 812 and NaN at lesson 1321 (the
     first lesson in which a dial stops being a finite number; the sim halts there). At 0.01 from the
     same start: 8.82 after 100 lessons, 8.55 after 300, 5.54 after 1000, 0.078 after 3000. Knob back
     to 0.1 at lesson 312 without a reset: the switches are jammed, the swings die away and the loss
     is 9.00 by lesson 412 and still 9.00 at lesson 1312, every clock at 6:00. Reset and kept at 0.1:
     loss 0.005 at lesson 400 and 0.0003 at lesson 500, the four clocks at 3:01, 8:59, 8:59 and 3:01.
   - explanation: the slow stretch near a loss of 9 (8.95 at lesson 5, 8.18 at lesson 50) before the
     back row finds the pattern; 0.01 at lesson 3000 ending near where 0.1 was at lesson 300; the loss
     growing every lesson at 1.5 from the starting dials (887.47 after the first).

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the whole widget inside api.root on every reset. No step() is
     needed because nothing animates; every number is worked out the moment a button is pressed.
   - The network: 2 inputs (the holes, 0 or 1), 4 hidden neurons with a sigmoid switch, 1 output
     neuron with no switch (its answer is in hours and may be any number). Dials live in one flat
     array p: hidden neuron j has weights p[3j], p[3j+1] and bias p[3j+2] (indices 0 to 11), the front
     neuron has weights p[12] to p[15] and bias p[16]. The single neuron is q = [weight, weight, bias].
   - Loss is the mean squared miss over the four cards, in hours squared. One lesson (one epoch) is one
     full-batch gradient step: gradients summed over all four cards, then every dial turns by the
     learning rate times its gradient. Backpropagation is written out by hand in gradOf.
   - api.rand() is used in exactly one place, in a fixed order: setup draws the network's 17 dials
     (p[0] to p[16]) and then the single neuron's 3 (q[0] to q[2]), each uniform between -1 and 1. The
     engine reseeds api.rand() on every reset, so Reset and every switch of the back row start from
     the same dials, at lesson 0.
   - The sim halts when any dial stops being a finite number (that lesson's loss is NaN for the
     network). Before that, a loss too big to store reads Infinity while the dials keep turning.
   - Stats get bare numbers (units live in the labels), so t.stat() returns numbers, except "-" before
     the first lesson and "Infinity" or "NaN" after a blow-up.
   - Colors come only from theme classes: dg-node (with tone-accent and tone-muted), dg-edge with
     tone-accent and tone-ok, dg-axis, dg-marker, dg-note, dot and dot-accent. In LATENT views
     tone-accent turns cyan, so the text names lines by their shape (solid, dashed), never a color.
*/
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- the story's numbers ---------- */

  // Anselm's four punched cards. Every card shows an hour hand pointing right, where 3 sits on an
  // ordinary clock face. Hole a: a backwards clock. Hole b: seen in a mirror. One flip makes it 9;
  // two flips cancel. The label y is the right answer in hours.
  var CARDS = [
    { a: 0, b: 0, y: 3, top: "ordinary", bottom: "straight" },
    { a: 0, b: 1, y: 9, top: "ordinary", bottom: "in a mirror" },
    { a: 1, b: 0, y: 9, top: "backwards", bottom: "straight" },
    { a: 1, b: 1, y: 3, top: "backwards", bottom: "in a mirror" }
  ];
  var HIDDEN = 4;                       // the back row
  var V0 = 3 * HIDDEN;                  // p[12] to p[15]: the front neuron's weights
  var OUT_BIAS = V0 + HIDDEN;           // p[16]: the front neuron's bias
  var N_NET = OUT_BIAS + 1;             // 17 dials with the back row plugged in
  var N_ONE = 3;                        // 3 dials with it cut out
  var INIT = 1;                         // starting dials are uniform between -1 and 1
  var RATES = ["0", "0.01", "0.1", "1.5"];   // the STRIDE knob's four stops
  var START_RATE = "0.1";               // Anselm's pencil mark
  var BATCH = 100;                      // lessons per press of "Teach 100 lessons"
  var START_CLOCK = 22 * 3600;          // Friday, 10 PM
  var LOG_MIN = -4, LOG_MAX = 8;        // the loss chart: 0.0001 to 100 million
  var MAX_POINTS = 600;                 // the loss curve is thinned to this many points

  /* ---------- the learner: a 2-4-1 network, or one neuron ---------- */

  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

  // The network's answer for one card, in hours. hs (optional) receives the four switch outputs.
  function outNet(p, a, b, hs) {
    var o = p[OUT_BIAS];
    for (var j = 0; j < HIDDEN; j++) {
      var h = sigmoid(p[3 * j] * a + p[3 * j + 1] * b + p[3 * j + 2]);
      if (hs) hs[j] = h;
      o += p[V0 + j] * h;
    }
    return o;
  }

  // One neuron reading the holes straight: a weighted sum plus a bias, no switch.
  function outOne(q, a, b) { return q[0] * a + q[1] * b + q[2]; }

  function answer(arch, p, card) {
    return arch === "net" ? outNet(p, card.a, card.b, null) : outOne(p, card.a, card.b);
  }

  // The loss: square each clock's miss in hours, then average the four.
  function lossOf(arch, p) {
    var s = 0;
    for (var i = 0; i < CARDS.length; i++) {
      var e = answer(arch, p, CARDS[i]) - CARDS[i].y;
      s += e * e;
    }
    return s / CARDS.length;
  }

  // Backpropagation by hand. For each card, d is the blame on the answer (the loss's slope with
  // respect to it). The front neuron's dials get d times what flowed through them; each back-row
  // neuron gets d times the dial between them, times its switch's slope h(1 - h), and shares that
  // among its own dials.
  function gradOf(arch, p) {
    var g = [], hs = [0, 0, 0, 0], i, j, k;
    for (k = 0; k < p.length; k++) g.push(0);
    for (i = 0; i < CARDS.length; i++) {
      var c = CARDS[i];
      if (arch === "net") {
        var o = outNet(p, c.a, c.b, hs);
        var d = (o - c.y) / 2;
        g[OUT_BIAS] += d;
        for (j = 0; j < HIDDEN; j++) {
          var h = hs[j];
          g[V0 + j] += d * h;
          var gz = d * p[V0 + j] * h * (1 - h);
          g[3 * j] += gz * c.a;
          g[3 * j + 1] += gz * c.b;
          g[3 * j + 2] += gz;
        }
      } else {
        var o1 = outOne(p, c.a, c.b);
        var d1 = (o1 - c.y) / 2;
        g[0] += d1 * c.a;
        g[1] += d1 * c.b;
        g[2] += d1;
      }
    }
    return g;
  }

  // One lesson (one epoch): every dial turns by the learning rate times its gradient, downhill.
  // Returns the biggest turn, or NaN if any turn was not a number.
  function stepOnce(arch, p, rate) {
    var g = gradOf(arch, p), big = 0, bad = false;
    for (var k = 0; k < p.length; k++) {
      var ch = rate * g[k];
      p[k] -= ch;
      var a = Math.abs(ch);
      if (a !== a) bad = true;
      else if (a > big) big = a;
    }
    return bad ? NaN : big;
  }

  function allFinite(p) {
    for (var k = 0; k < p.length; k++) if (!isFinite(p[k])) return false;
    return true;
  }

  function drawDials(api, count) {
    var out = [];
    for (var k = 0; k < count; k++) out.push((2 * api.rand() - 1) * INIT);
    return out;
  }

  /* ---------- formatting ---------- */

  // Losses and dial turns: two decimals from 1 up, three below 1, powers of ten for the extremes.
  function fmt(v) {
    if (v !== v) return "NaN";
    if (v === Infinity) return "Infinity";
    if (v === -Infinity) return "-Infinity";
    if (v === 0) return "0";
    var a = Math.abs(v);
    if (a >= 1e6) return v.toExponential(2);
    if (a >= 1) return v.toFixed(2);
    if (a >= 0.001) return v.toFixed(3);
    return v.toExponential(1);
  }

  // Answers in hours: always two decimals, powers of ten once they no longer fit.
  function hours(v) {
    if (v !== v) return "NaN";
    if (!isFinite(v)) return v > 0 ? "Infinity" : "-Infinity";
    if (Math.abs(v) >= 1e6) return v.toExponential(2);
    return v.toFixed(2);
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  // What a clock set to h hours after midnight reads, to the nearest minute: "3:21", "1:09 tomorrow",
  // "10:28, 3 days back". The story's "1:09 tomorrow" for 25.14 hours comes from this function.
  function clockReading(h) {
    if (!isFinite(h)) return "no time at all";
    if (Math.abs(h) >= 24000) return "a time off the calendar";
    var mins = Math.round(h * 60);
    var day = Math.floor(mins / 1440);
    var m = mins - day * 1440;
    var hh = Math.floor(m / 60), mm = m - hh * 60;
    var face = (hh % 12 === 0 ? 12 : hh % 12) + ":" + pad2(mm);
    if (day === 0) return face;
    if (day === 1) return face + " tomorrow";
    if (day === -1) return face + " yesterday";
    return face + ", " + Math.abs(day) + " days " + (day > 0 ? "ahead" : "back");
  }

  function c1(v) { return (Math.round(v * 10) / 10).toString(); }

  /* ---------- the widget ---------- */

  var IN_X = 60, IN_Y = [95, 175];
  var HID_X = 180, HID_Y = [50, 100, 150, 200];
  var OUT_X = 300, OUT_Y = 125;
  var CLOCK_X = [382, 466, 550, 634], CLOCK_Y = 105, CLOCK_R = 30;
  var CH = { l: 86, r: 664, t: 34, b: 196 };

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

  function setLine(el, x1, y1, x2, y2) {
    el.setAttribute("x1", c1(x1));
    el.setAttribute("y1", c1(y1));
    el.setAttribute("x2", c1(x2));
    el.setAttribute("y2", c1(y2));
  }

  // A weight line: width grows with the dial's size, dashed when the dial is negative.
  function styleWeight(el, w) {
    var ok = isFinite(w);
    var width = ok ? Math.min(6, 0.6 + Math.abs(w) * 0.8) : 0.6;
    el.setAttribute("style", "stroke-width:" + c1(width));
    if (!ok || w < 0) el.setAttribute("stroke-dasharray", "4 3");
    else el.removeAttribute("stroke-dasharray");
  }

  function buildRack(doc) {
    var svg = mk(doc, "svg", {
      viewBox: "0 0 680 262", width: "100%", "class": "dg", role: "img",
      "aria-label": "The rack and the four clocks: two holes feed four back-row neurons, which feed the front neuron. One line per weight; thicker means a bigger dial, dashed means negative. Each clock shows the machine's answer for one card and the right hour."
    });
    var head = mk(doc, "g", {}, svg);
    txt(doc, head, IN_X, 22, "holes", "dg-axis", "middle");
    txt(doc, head, HID_X, 22, "back row", "dg-axis", "middle");
    txt(doc, head, OUT_X, 22, "front", "dg-axis", "middle");
    txt(doc, head, 508, 22, "the four clocks", "dg-axis", "middle");

    var lines = mk(doc, "g", {}, svg);
    var inHid = [], hidOut = [], inOut = [], i, j;
    for (j = 0; j < HIDDEN; j++) {
      inHid.push([]);
      for (i = 0; i < 2; i++) {
        var l = mk(doc, "line", { "class": "dg-edge tone-accent" }, lines);
        setLine(l, IN_X, IN_Y[i], HID_X, HID_Y[j]);
        inHid[j].push(l);
      }
      var lo = mk(doc, "line", { "class": "dg-edge tone-accent" }, lines);
      setLine(lo, HID_X, HID_Y[j], OUT_X, OUT_Y);
      hidOut.push(lo);
    }
    for (i = 0; i < 2; i++) {
      var ld = mk(doc, "line", { "class": "dg-edge tone-accent", display: "none" }, lines);
      setLine(ld, IN_X, IN_Y[i], OUT_X, OUT_Y);
      inOut.push(ld);
    }

    var nodes = mk(doc, "g", {}, svg);
    txt(doc, nodes, IN_X, IN_Y[0] - 22, "backwards?", "dg-axis", "middle");
    txt(doc, nodes, IN_X, IN_Y[1] - 22, "mirror?", "dg-axis", "middle");
    for (i = 0; i < 2; i++) mk(doc, "circle", { cx: IN_X, cy: IN_Y[i], r: 13 }, mk(doc, "g", { "class": "dg-node" }, nodes));
    var hidNodes = [];
    for (j = 0; j < HIDDEN; j++) {
      var hg = mk(doc, "g", { "class": "dg-node" }, nodes);
      mk(doc, "circle", { cx: HID_X, cy: HID_Y[j], r: 13 }, hg);
      hidNodes.push(hg);
    }
    mk(doc, "circle", { cx: OUT_X, cy: OUT_Y, r: 15 }, mk(doc, "g", { "class": "dg-node tone-accent" }, nodes));
    var dialsNote = txt(doc, nodes, HID_X, 236, "", "dg-note", "middle");

    var clocks = [];
    for (i = 0; i < CARDS.length; i++) {
      var cx = CLOCK_X[i], g = mk(doc, "g", {}, svg);
      txt(doc, g, cx, 62, "clock " + (i + 1), i === 3 ? "dg-note" : "dg-axis", "middle");
      mk(doc, "circle", { cx: cx, cy: CLOCK_Y, r: CLOCK_R }, mk(doc, "g", { "class": i === 3 ? "dg-node tone-accent" : "dg-node" }, g));
      for (var k = 0; k < 12; k++) {
        var ang = k * Math.PI / 6, inner = k % 3 === 0 ? 23 : 26;
        var tk = mk(doc, "line", { "class": "dg-axis" }, g);
        setLine(tk, cx + inner * Math.sin(ang), CLOCK_Y - inner * Math.cos(ang), cx + 29 * Math.sin(ang), CLOCK_Y - 29 * Math.cos(ang));
      }
      var right = mk(doc, "line", { "class": "dg-edge tone-ok", "stroke-dasharray": "3 3", style: "stroke-width:2" }, g);
      var ra = CARDS[i].y * Math.PI / 6;
      setLine(right, cx, CLOCK_Y, cx + 16 * Math.sin(ra), CLOCK_Y - 16 * Math.cos(ra));
      var minute = mk(doc, "line", { "class": "dg-edge tone-accent", style: "stroke-width:1.5" }, g);
      var hour = mk(doc, "line", { "class": "dg-edge tone-accent", style: "stroke-width:3;stroke-linecap:round" }, g);
      txt(doc, g, cx, 152, CARDS[i].top, "dg-axis", "middle");
      txt(doc, g, cx, 165, CARDS[i].bottom, "dg-axis", "middle");
      var ans = txt(doc, g, cx, 186, "", "dg-note", "middle");
      txt(doc, g, cx, 202, "right: " + CARDS[i].y, "dg-axis", "middle");
      clocks.push({ cx: cx, minute: minute, hour: hour, ans: ans });
    }

    var legend = mk(doc, "g", {}, svg);
    txt(doc, legend, 170, 256, "lines: thicker = bigger dial, dashed = negative", "dg-axis", "middle");
    txt(doc, legend, 508, 256, "solid hands: its answer; dashed hand: the right hour", "dg-axis", "middle");

    return { svg: svg, inHid: inHid, hidOut: hidOut, inOut: inOut, hidNodes: hidNodes, dialsNote: dialsNote, clocks: clocks };
  }

  function lx(e, xMax) { return CH.l + e / xMax * (CH.r - CH.l); }
  function ly(v) {
    if (!(v > 0)) return CH.b;
    var lg = Math.log(v) / Math.LN10;
    lg = Math.max(LOG_MIN, Math.min(LOG_MAX, lg));
    return CH.b - (lg - LOG_MIN) / (LOG_MAX - LOG_MIN) * (CH.b - CH.t);
  }

  function buildChart(doc) {
    var svg = mk(doc, "svg", {
      viewBox: "0 0 680 240", width: "100%", "class": "dg", role: "img",
      "aria-label": "Loss chart: the loss after every lesson, on a scale where each gridline up is ten times the one below, from 0.0001 to 100 million."
    });
    var axes = mk(doc, "g", {}, svg);
    var labels = { "-4": "0.0001", "-2": "0.01", "0": "1", "2": "100", "4": "10,000", "6": "1 million", "8": "100 million" };
    for (var pw = LOG_MIN; pw <= LOG_MAX; pw++) {
      var y = c1(ly(Math.pow(10, pw)));
      mk(doc, "line", { x1: CH.l, y1: y, x2: CH.r, y2: y, "class": "dg-axis", "stroke-dasharray": "2 5" }, axes);
      if (labels[String(pw)]) txt(doc, axes, CH.l - 7, c1(ly(Math.pow(10, pw)) + 4), labels[String(pw)], "dg-axis", "end");
    }
    mk(doc, "line", { x1: CH.l, y1: CH.b, x2: CH.r, y2: CH.b, "class": "dg-axis" }, axes);
    mk(doc, "line", { x1: CH.l, y1: CH.t, x2: CH.l, y2: CH.b, "class": "dg-axis" }, axes);
    txt(doc, axes, 8, 18, "loss", "dg-axis", "start");
    txt(doc, axes, 375, 234, "lessons taught (epochs)", "dg-axis", "middle");
    var ticks = mk(doc, "g", {}, svg);
    var marks = mk(doc, "g", {}, svg);
    var curve = mk(doc, "path", { d: "", fill: "none", "class": "dg-edge tone-accent", style: "stroke-width:2" }, svg);
    var end = mk(doc, "g", {}, svg);
    return { svg: svg, ticks: ticks, marks: marks, curve: curve, end: end };
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
      "Each card asks what an hour hand pointing at 3 really says: one hole for a backwards clock, one for a mirror. One flip makes it 9; two flips cancel."));
    var rack = buildRack(doc);
    box.appendChild(rack.svg);
    var rackNote = para("", "margin:0;font-size:13px;", "");
    rackNote.setAttribute("aria-live", "polite");
    box.appendChild(rackNote);
    var chart = buildChart(doc);
    box.appendChild(chart.svg);
    var chartNote = para("muted", "margin:0;font-size:12px;", "");
    chartNote.setAttribute("aria-live", "polite");
    box.appendChild(chartNote);
    api.root.appendChild(box);
    return { doc: doc, rack: rack, chart: chart, rackNote: rackNote, chartNote: chartNote };
  }

  /* ---------- drawing ---------- */

  function drawRack(S) {
    var R = S.ui.rack, net = S.arch === "net", p = S.p, i, j;
    for (j = 0; j < HIDDEN; j++) {
      for (i = 0; i < 2; i++) {
        R.inHid[j][i].setAttribute("display", net ? "inline" : "none");
        if (net) styleWeight(R.inHid[j][i], p[3 * j + i]);
      }
      R.hidOut[j].setAttribute("display", net ? "inline" : "none");
      if (net) styleWeight(R.hidOut[j], p[V0 + j]);
      R.hidNodes[j].setAttribute("class", net ? "dg-node" : "dg-node tone-muted");
    }
    for (i = 0; i < 2; i++) {
      R.inOut[i].setAttribute("display", net ? "none" : "inline");
      if (!net) styleWeight(R.inOut[i], p[i]);
    }
    R.dialsNote.textContent = net ? "17 dials turning" : "back row cut out: 3 dials";
    for (i = 0; i < CARDS.length; i++) {
      var c = R.clocks[i], v = answer(S.arch, p, CARDS[i]);
      c.ans.textContent = hours(v) + " h";
      if (!isFinite(v)) {
        c.hour.setAttribute("display", "none");
        c.minute.setAttribute("display", "none");
        continue;
      }
      var turns = v / 12 - Math.floor(v / 12);           // where the hour hand sits on the face
      var frac = v - Math.floor(v);                       // where the minute hand sits
      var ha = turns * 2 * Math.PI, ma = frac * 2 * Math.PI;
      c.hour.setAttribute("display", "inline");
      c.minute.setAttribute("display", "inline");
      setLine(c.hour, c.cx, CLOCK_Y, c.cx + 15 * Math.sin(ha), CLOCK_Y - 15 * Math.cos(ha));
      setLine(c.minute, c.cx, CLOCK_Y, c.cx + 24 * Math.sin(ma), CLOCK_Y - 24 * Math.cos(ma));
    }
  }

  function tickStep(xMax) {
    var steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
    for (var i = 0; i < steps.length; i++) if (xMax / steps[i] <= 6) return steps[i];
    return steps[steps.length - 1];
  }

  function drawChart(S) {
    var C = S.ui.chart, doc = S.ui.doc, h = S.history, n = h.length, e;
    var xMax = Math.max(100, Math.ceil(S.epoch / 100) * 100);
    clear(C.ticks);
    var stp = tickStep(xMax);
    for (e = 0; e <= xMax; e += stp) {
      mk(doc, "line", { x1: c1(lx(e, xMax)), y1: CH.b, x2: c1(lx(e, xMax)), y2: CH.b + 4, "class": "dg-axis" }, C.ticks);
      txt(doc, C.ticks, c1(lx(e, xMax)), CH.b + 16, String(e), "dg-axis", "middle");
    }
    var every = Math.max(1, Math.ceil(n / MAX_POINTS)), parts = [], last = -1;
    for (e = 0; e < n; e += every) {
      if (h[e] !== h[e]) break;
      parts.push((parts.length ? "L" : "M") + c1(lx(e, xMax)) + " " + c1(ly(h[e])));
      last = e;
    }
    if (last !== n - 1 && h[n - 1] === h[n - 1]) {
      parts.push((parts.length ? "L" : "M") + c1(lx(n - 1, xMax)) + " " + c1(ly(h[n - 1])));
      last = n - 1;
    }
    C.curve.setAttribute("d", parts.join(" "));
    clear(C.marks);
    var shown = S.marks.slice(-3), lastX = -1000;
    shown.forEach(function (m) {
      var x = lx(m.e, xMax);
      mk(doc, "line", { x1: c1(x), y1: CH.t, x2: c1(x), y2: CH.b, "class": "dg-marker" }, C.marks);
      if (x - lastX > 70) {
        txt(doc, C.marks, c1(x + 4), CH.t - 6, "knob " + m.rate, "dg-marker", "start");
        lastX = x;
      }
    });
    clear(C.end);
    var cur = h[n - 1];
    if (cur !== cur) {
      txt(doc, C.end, c1(lx(n - 1, xMax)), CH.t + 14, "NaN", "dg-note tone-bad", "middle");
    } else {
      mk(doc, "circle", { cx: c1(lx(n - 1, xMax)), cy: c1(ly(cur)), r: 4, "class": "dot dot-accent" }, C.end);
      if (cur > Math.pow(10, LOG_MAX)) txt(doc, C.end, c1(lx(n - 1, xMax) - 6), CH.t + 14, "off the top", "dg-note tone-bad", "end");
    }
  }

  function drawNotes(S) {
    var c4 = answer(S.arch, S.p, CARDS[3]);
    var parts = [];
    for (var i = 0; i < CARDS.length; i++) parts.push(hours(answer(S.arch, S.p, CARDS[i])));
    S.ui.rackNote.textContent = "Lesson " + S.epoch + ", knob at " + S.rateText + ", " +
      (S.arch === "net" ? "back row plugged in (17 dials)" : "back row cut out (3 dials)") +
      ". The four answers in hours: " + parts.join(", ") + ". Clock 4 reads " + clockReading(c4) +
      "; the right answer is 3:00.";
    S.ui.chartNote.textContent = "The loss after every lesson, measured on the same four cards the rack learns from. Each gridline up is ten times the one below. Dashed lines mark where you turned the knob.";
  }

  function drawStats(S) {
    S.stat.epoch(S.epoch);
    S.stat.loss(fmt(S.history[S.epoch]));
    S.stat.turn(S.lastTurn === null ? "-" : fmt(S.lastTurn));
    S.stat.clock4(hours(answer(S.arch, S.p, CARDS[3])));
  }

  function draw(api) {
    var S = api.state;
    drawRack(S);
    drawChart(S);
    drawNotes(S);
    drawStats(S);
    S.ctl.one.disable(S.halted);
    S.ctl.hundred.disable(S.halted);
  }

  /* ---------- actions and narration ---------- */

  function restart(api) {
    var S = api.state;
    S.p = S.init[S.arch].slice();
    S.epoch = 0;
    S.history = [lossOf(S.arch, S.p)];
    S.lastTurn = null;
    S.halted = false;
    S.marks = [];
  }

  function narrate(api, before) {
    var S = api.state, L = S.history[S.epoch], c4 = answer(S.arch, S.p, CARDS[3]);
    if (S.halted) {
      api.log("Lesson " + S.epoch + ": a dial has grown past the biggest number the machine can hold, and the sums now give NaN, not a number. Nothing can be learned from here. Reset the dials.", "bad");
      return;
    }
    if (S.rate === 0) {
      api.log("Knob at 0: every turn is the gradient times 0, so no dial moved. Lesson " + S.epoch + ", loss still " + fmt(L) + ".", "");
      return;
    }
    if (L === Infinity) {
      api.log("Lesson " + S.epoch + ": the loss is too big to store, so it reads Infinity. The dials are still turning, further each lesson.", "bad");
      return;
    }
    // Rounding noise on a settled loss is not a climb: "up" needs a real rise above a tiny floor.
    var up = L > before * (1 + 1e-9) && L > 1e-12;
    var down = L < before * (1 - 1e-9);
    var head = "Lesson " + S.epoch + ": loss " + fmt(L) +
      (up ? ", up from " + fmt(before) : (down ? ", down from " + fmt(before) : ", unchanged")) + ". ";
    if (up) {
      api.log(head + "Each turn carries the dials past the low point, further each time. Clock 4 reads " + clockReading(c4) + ".", "bad");
    } else if (S.arch === "one" && L < 9.001) {
      api.log(head + "That is one neuron's best: six for every card, three hours from each right answer. No knob setting gets it lower.", "warn");
    } else if (L < 0.01) {
      api.log(head + "Every clock is close to the right time.", "ok");
    } else {
      api.log(head + "Clock 4 reads " + clockReading(c4) + ".", "");
    }
  }

  function teach(api, count) {
    var S = api.state;
    if (S.halted) return;
    var before = S.history[S.epoch];
    for (var i = 0; i < count; i++) {
      S.lastTurn = stepOnce(S.arch, S.p, S.rate);
      S.epoch++;
      S.history.push(lossOf(S.arch, S.p));
      if (!allFinite(S.p)) {
        S.halted = true;
        break;
      }
    }
    draw(api);
    narrate(api, before);
  }

  function setRate(api, v) {
    var S = api.state, r = Number(v);
    if (!(r >= 0)) return;
    S.rate = r;
    S.rateText = String(v);
    S.marks.push({ e: S.epoch, rate: S.rateText });
    draw(api);
    api.log("You turn the STRIDE knob to " + S.rateText + ". The dials stay where they are; from the next lesson each turn is its gradient times " + S.rateText + ".", "");
  }

  function setArch(api, v) {
    var S = api.state;
    if (v !== "net" && v !== "one") return;
    S.arch = v;
    restart(api);
    draw(api);
    api.log(v === "net"
      ? "Back row plugged in: 17 dials, back at their starting positions. Lesson 0, loss " + fmt(S.history[0]) + "."
      : "Back row cut out: the cards go straight to the front neuron, 3 dials, at their starting positions. Lesson 0, loss " + fmt(S.history[0]) + ".", "");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a1e02", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.init = { net: drawDials(api, N_NET), one: drawDials(api, N_ONE) };
      S.arch = "net";
      S.rate = Number(START_RATE);
      S.rateText = START_RATE;
      restart(api);
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.arch = api.control.select("arch", "Back row", [
        { value: "net", label: "plugged in: 17 dials" },
        { value: "one", label: "cut out: one neuron, 3 dials" }
      ], "net", function (v) { setArch(api, v); });
      S.ctl.rate = api.control.select("rate", "STRIDE knob (learning rate)", [
        { value: "0", label: "0: the dials never turn" },
        { value: "0.01", label: "0.01" },
        { value: "0.1", label: "0.1: Anselm's pencil mark" },
        { value: "1.5", label: "1.5: the top stop" }
      ], START_RATE, function (v) { setRate(api, v); });
      S.ctl.one = api.control.button("one", "Teach 1 lesson", function () { teach(api, 1); });
      S.ctl.hundred = api.control.button("hundred", "Teach 100 lessons", function () { teach(api, BATCH); }, { tone: "primary" });
      S.ctl.reset = api.control.button("reset", "Reset the dials", function () { api.reset(); });

      S.stat = {
        epoch: api.stat("epoch", "lessons taught (epochs)", ""),
        loss: api.stat("loss", "loss (mean squared miss, hours squared)", "warn"),
        turn: api.stat("turn", "biggest dial turn in the last lesson", ""),
        clock4: api.stat("clock4", "clock 4's answer in hours (right: 3)", "")
      };

      api.info("<strong>How to read it.</strong> Top left: the rack. The two holes feed the four back-row neurons, which feed the front neuron; every line is one weight, thicker for a bigger dial and dashed when the dial is negative. Each neuron's bias is a dial too, inside the circle. Top right: the four clocks. The solid hands are the machine's answer, the dashed hand is the right hour. Bottom: the loss after every lesson. Each gridline up is ten times the one below, so a straight climb means the loss is multiplying.");
      api.log("Friday, 10 PM. The back row is plugged in: 17 dials at the same random starting positions as on Thursday. The knob is at 0.1, Anselm's pencil mark. Lesson 0, loss " + fmt(S.history[0]) + ".", "");
      draw(api);
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function n(id) { return Number(t.stat(id)); }
      function near(a, b, tol) { return Math.abs(a - b) <= tol; }
      function rel(a, b, tol) { return Math.abs(a - b) <= tol * Math.abs(b); }
      function teachOne(k) { for (var i = 0; i < k; i++) t.click("one"); }
      function teachHundred(k) { for (var i = 0; i < k; i++) t.click("hundred"); }
      function same(a, b) {
        if (a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
        return true;
      }
      function clocks() {
        var out = [];
        for (var i = 0; i < CARDS.length; i++) out.push(answer(st().arch, st().p, CARDS[i]));
        return out;
      }
      var i, ok;

      await t.run(0.1);

      // 1. Thursday's start: back row in, knob at 0.1, lesson 0.
      var init0 = st().p.slice();
      t.expect(st().arch === "net" && st().rate === 0.1 && init0.length === 17 && n("epoch") === 0 &&
        near(st().history[0], 51.1435, 0.001) && t.stat("loss") === 51.14 && t.stat("turn") === "-" &&
        near(n("clock4"), -0.56, 0.006),
        "Thursday's start: back row plugged in with 17 dials, knob at 0.1, lesson 0 with loss 51.14 and clock 4 at -0.56 hours, no dial turned yet");

      // 2. With a sensible learning rate the loss falls, every lesson: 5.83, 1.06, 0.085.
      teachHundred(1);
      var p100 = st().p.slice(), h100 = st().history[100];
      teachHundred(2);
      var H = st().history;
      ok = H.length === 301;
      for (i = 1; i < H.length; i++) if (!(H[i] < H[i - 1])) ok = false;
      t.expect(ok && near(H[5], 8.9482, 0.001) && near(H[50], 8.1792, 0.001) &&
        near(H[100], 5.8264, 0.001) && near(H[200], 1.0591, 0.001) && near(H[300], 0.08532, 0.0002) &&
        t.stat("loss") === 0.085 && near(n("clock4"), 3.34, 0.006) && clockReading(clocks()[3]) === "3:21",
        "at 0.1 the loss falls in every one of 300 lessons: 8.95 at lesson 5, a slow stretch to 8.18 at lesson 50, 5.83 at 100, 1.06 at 200 and 0.085 at 300, where clock 4 shows 3.34 hours (3:21)");
      var net300 = H[300], p300 = st().p.slice();

      // 3. The tape: lessons 301 to 308 at 1.5.
      t.set("rate", "1.5");
      var wantL = [0.054519, 0.034645, 0.022350, 0.054927, 3.82752, 307.3231, 5245.367, 24786.44];
      var wantC = [3.2731, 3.2200, 3.1522, 3.3410, 1.2669, 25.1434, -49.5319, 163.4085];
      var tape = true, reading306 = "";
      for (i = 0; i < wantL.length; i++) {
        teachOne(1);
        if (!rel(st().history[st().epoch], wantL[i], 0.001) || !near(clocks()[3], wantC[i], 0.005)) tape = false;
        if (st().epoch === 306) reading306 = clockReading(clocks()[3]);
      }
      t.expect(tape && n("epoch") === 308 && reading306 === "1:09 tomorrow" && t.logText().indexOf("further each time") >= 0,
        "at 1.5 the tape matches the story: losses 0.055, 0.035, 0.022, 0.055, 3.83, 307.32, 5245.37 and 24786.44 for lessons 301 to 308, clock 4 at 3.27, 3.22, 3.15, 3.34, 1.27, 25.14 (1:09 tomorrow), -49.53 and 163.41 hours, and the log says the swings grow further each time");

      // 4. Lessons 309 to 312: the biggest dial turn doubles every lesson.
      var turns = [];
      for (i = 0; i < 4; i++) {
        teachOne(1);
        turns.push(st().lastTurn);
      }
      var p312 = st().p.slice();
      t.expect(near(turns[0], 472.2256, 0.01) && near(turns[1], 944.4512, 0.01) && near(turns[2], 1888.9023, 0.01) &&
        near(turns[3], 3777.8046, 0.01) && near(turns[1] / turns[0], 2, 1e-4) && near(turns[3] / turns[2], 2, 1e-4) &&
        t.stat("turn") === 3777.8 && near(clocks()[3], 2524.536, 0.01),
        "lessons 309 to 312 at 1.5: biggest dial turns of 472.23, 944.45, 1888.90 and 3777.80, each twice the one before, and clock 4 at 2524.54 hours after lesson 312");

      // 5. Left at 1.5: the loss reads Infinity from lesson 812, with every dial still a number.
      teachHundred(5);
      t.expect(n("epoch") === 812 && isFinite(st().history[811]) && st().history[812] === Infinity &&
        t.stat("loss") === "Infinity" && allFinite(st().p) && st().ctl.one.el.disabled === false,
        "left at 1.5 from lesson 312, the loss is still a number at lesson 811 and reads Infinity at lesson 812, while every dial is still finite and teaching is still allowed");

      // 6. ... and NaN at lesson 1321, where the sim halts.
      teachHundred(7);
      t.expect(n("epoch") === 1321 && st().halted === true && st().history[1320] === Infinity && t.stat("loss") === "NaN" &&
        st().ctl.one.el.disabled === true && st().ctl.hundred.el.disabled === true && t.logText().indexOf("NaN") >= 0,
        "the first dial stops being a finite number at lesson 1321: the loss reads NaN (it was Infinity at lesson 1320), both teach buttons are disabled and the log says NaN");

      // 7. The same seed gives the same starting dials and the same loss after 100 lessons.
      t.click("reset");
      var again0 = st().p.slice();
      teachHundred(1);
      t.expect(same(again0, init0) && same(st().p, p100) && st().history[100] === h100 && st().rate === 0.1 && st().halted === false,
        "after a reset the 17 starting dials are exactly Thursday's, and 100 lessons at 0.1 give exactly the same dials and the same loss as the first time");

      // 8. A learning rate of 0 changes nothing.
      t.click("reset");
      t.set("rate", "0");
      teachHundred(1);
      ok = true;
      for (i = 1; i <= 100; i++) if (st().history[i] !== st().history[0]) ok = false;
      t.expect(n("epoch") === 100 && same(st().p, init0) && ok && t.stat("turn") === 0 && t.stat("loss") === 51.14,
        "with the knob at 0, 100 lessons leave all 17 dials exactly where they started, the loss at 51.14 every lesson and the biggest turn at 0");

      // 9. 0.01 walks the same path as 0.1, ten times slower: 8.82, 8.55, 5.54, then 0.078 at 3000.
      t.click("reset");
      t.set("rate", "0.01");
      teachHundred(1);
      var s100 = st().history[100];
      teachHundred(2);
      var s300 = st().history[300];
      teachHundred(7);
      var s1000 = st().history[1000];
      teachHundred(20);
      var s3000 = st().history[3000];
      t.expect(near(s100, 8.8240, 0.001) && near(s300, 8.5459, 0.001) && near(s1000, 5.5371, 0.001) && near(s3000, 0.07800, 0.0005) &&
        near(s3000, net300, 0.01),
        "at 0.01 the loss is 8.82 after 100 lessons, 8.55 after 300, 5.54 after 1000 and 0.078 after 3000, within 0.01 of where 0.1 was after 300 (0.085)");

      // 10. One neuron cannot fit the mirror cards; the network can.
      t.click("reset");
      t.set("arch", "one");
      var oneStart = st().history[0];
      teachHundred(3);
      var cl = clocks(), six = true;
      for (i = 0; i < 4; i++) if (!near(cl[i], 6, 0.001) || clockReading(cl[i]) !== "6:00") six = false;
      var one300 = st().history[300];
      teachHundred(47);
      t.expect(st().p.length === 3 && near(oneStart, 36.2185, 0.001) && one300 >= 9 - 1e-9 && one300 < 9.0001 && six &&
        t.stat("loss") === 9 && st().history[5000] >= 9 - 1e-9 && net300 < 0.1 && t.logText().indexOf("one neuron's best") >= 0,
        "with the back row cut out at 0.1, one neuron's loss settles at 9.00 with all four clocks at 6:00 and is still no lower after 5000 lessons, while the 17-dial network reached 0.085 in 300");

      // 11. Turning the knob back to 0.1 at lesson 312 without a reset: the jammed rack settles at a
      //     loss of 9.00 with every clock at 6:00, no better than one neuron, and stays there.
      var q = p312.slice();
      for (i = 0; i < 100; i++) stepOnce("net", q, 0.1);
      var w412 = lossOf("net", q), six412 = true;
      for (i = 0; i < 4; i++) if (!near(answer("net", q, CARDS[i]), 6, 0.001) || clockReading(answer("net", q, CARDS[i])) !== "6:00") six412 = false;
      for (i = 0; i < 900; i++) stepOnce("net", q, 0.1);
      var w1312 = lossOf("net", q);
      t.expect(fmt(w412) === "9.00" && fmt(w1312) === "9.00" && w1312 >= 9 - 1e-3 && six412 && allFinite(q),
        "turning the knob back to 0.1 at lesson 312 without a reset: the loss is 9.00 by lesson 412 with every clock at 6:00, and still 9.00 at lesson 1312");

      // 12. An overshooting learning rate makes the loss grow: every lesson, from a fresh start.
      t.click("reset");
      t.set("rate", "1.5");
      teachOne(20);
      ok = true;
      for (i = 1; i <= 20; i++) if (!(st().history[i] > st().history[i - 1])) ok = false;
      t.expect(ok && near(st().history[1], 887.475, 0.01) && st().history[20] > 1e12,
        "at 1.5 from the starting dials the loss grows in every one of the first 20 lessons: 887.47 after the first, past a million million by the twentieth");

      // 13. Backpropagation's gradients match finite differences.
      function worst(arch, p) {
        var g = gradOf(arch, p), eps = 1e-6, w = 0;
        for (var k = 0; k < p.length; k++) {
          var up = p.slice(), dn = p.slice();
          up[k] += eps;
          dn[k] -= eps;
          var num = (lossOf(arch, up) - lossOf(arch, dn)) / (2 * eps);
          w = Math.max(w, Math.abs(num - g[k]) / (1 + Math.abs(g[k])));
        }
        return w;
      }
      var gNet = worst("net", init0), gOne = worst("one", st().init.one), gLate = worst("net", p300);
      t.expect(gNet < 1e-6 && gOne < 1e-6 && gLate < 1e-6,
        "backpropagation's gradients for every dial match central finite differences (step 1e-6) to within 1e-6 relative: the 17 starting dials, the 3 single-neuron dials and the 17 dials after 300 lessons");

      // 14. Back at 0.1 from the start: 0.005 at lesson 400, 0.0003 at 500, clocks at 3:01, 8:59, 8:59, 3:01.
      t.click("reset");
      teachHundred(4);
      var l400 = st().history[400];
      teachHundred(1);
      var reads = clocks().map(clockReading);
      t.expect(near(l400, 0.00540, 0.0002) && near(st().history[500], 0.000319, 0.00002) &&
        reads.join(",") === "3:01,8:59,8:59,3:01" && t.logText().indexOf("close to the right time") >= 0,
        "reset and kept at 0.1: loss 0.005 at lesson 400 and 0.0003 at 500, with the four clocks reading 3:01, 8:59, 8:59 and 3:01");
    }
  });
})();
