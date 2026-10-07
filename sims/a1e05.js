/* sims/a1e05-v1.0.0.js  (published as sims/a1e05.js)
   Case a1e05 "Paying Attention": a switchboard attention lab built from Gwilym's exhibit, the 1950s
   switchboard where every line listens to every other.

   CHANGELOG
   v1.0.0 (2026-10-07) first version: a widget-style sim built inside api.root (no diagram), drawn as
     two inline SVG pictures and one table that use theme classes only. One attention head in plain JS:
     ten words from Clemency's slip, each with three hand-set cards of 3 numbers (query, key, value),
     scores divided by the square root of 3, softmax, values mixed by the weights. The top picture is the
     listening word's row of lamps (its attention weights, words cut before the board marked cut); the
     grid is the full heat map of the words on the board; the table is every word's output and whether
     it matches the same words in message order. Controls: listening word, position information (the
     hums), lines on the board (the context window, 4 to 10, keeping the newest words like line 41),
     shuffle the words on the board (a fixed cycle of three rearrangements), put them back in order,
     reset. Stats: top attended word, its weight, tokens in view, what the row adds up to. selfTest
     covers Saturday's start, every row adding up to 1 with every weight positive, the key link at
     full window, the window cutting the link below 9 lines, exact permutation of the outputs without
     the hums, changed outputs with the hums, every story number, determinism and the fixed shuffle
     cycle, and the controls.

   Where every number comes from (conventions rule 14; the case is content/latent/a1/a1e05-v1.0.0.json).
   All of them follow from WORDS, CARDS, the hums (HUM, SLOW) and attend() below; the values in brackets
   are the unrounded results:
   - post: the slip "miss clemency rang for ewart said she would ring back" is 10 words (WORDS); the
     board has 8 lines (BOARD_LINES), 8 x 8 = 64 lamps; the program keeps the newest 8, so the board
     holds "rang for ewart said she would ring back" and "miss clemency" never get a line; with the
     hums on, the brightest lamp for she is ewart, 0.28 (0.28402). The laptop copy at four in the
     morning (START_CLOCK) has 10 lines, 100 lamps: she to clemency 0.74 (0.73659), miss 0.13
     (0.13347), ewart 0.02 (0.01925). Before the hums, the dog bit the postman and the postman bit the
     dog light the same lamps shuffled: the permutation self-test checks that property exactly on this
     slip.
   - evidence diagram and caption: the same numbers, the two cut words, 64 and 100 lamps.
   - comments: every row adds up to 1, so something always burns brightest (self-test 2).
   - sim.tryThis: 9 lines keep clemency (miss is cut) at 0.78 (0.78414); at 4 lines the board holds
     "she would ring back" and she's biggest weight, 0.38 (0.38334), goes to she itself; with the hums
     off and every word in view, a shuffle leaves all 10 outputs exactly the same numbers; with the
     hums on, a shuffle changes them (all 10 change).
   - explanation: she and clemency are five words apart; Gwilym's 30 cards (10 words x 3); the diagram's
     0.74, 0.13 and 0.13 for the other 8 keys together (0.12994), ewart's 0.02 among them; 40 lines
     would need 1,600 lamps, 25 times 64.
   - reply part 2 (option C): 20 lines need 400 lamps; 40 need 1,600, 25 times the 64.
   - extra checks, not quoted in the story: with the hums off, 8 lines give ewart 0.31 (0.30659) and
     10 lines still give clemency the top weight.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the whole widget inside api.root on every reset. No step() is needed
     because nothing animates; every number is worked out the moment a control changes.
   - The cards are a teaching simplification: 3 numbers each, read as [a person, a woman, an action],
     set by hand, never learned. Real models learn their queries, keys and values from each token's
     embedding, with far more numbers.
   - The hums: with position information on, line s (s = 0 for the first line on the board) adds
     HUM x [sin(s), cos(s), sin(s / SLOW)] to all three cards of the word on it. A real model adds
     position to the token's vector before making its query, key and value; adding it to all three
     cards is the same idea in miniature. Lines are counted on the board, so after a cut the first
     word kept sits on line 1.
   - Exactness: inside attend(), every sum (the softmax total and the mixed values) runs over the words
     in message order, whatever line they sit on. Without the hums nothing else depends on the line,
     so a shuffle gives bit-for-bit the same weights and outputs, and the self-test compares with ===.
   - The shuffle is deterministic, a fixed cycle applied to the words on the board only: reversed, odd
     lines first, then rotated by 3. Changing the number of lines puts the words back in message order.
     No api.rand() anywhere.
   - Ties for the brightest lamp go to the word that comes first in the message.
   - Stats get bare numbers or words (units live in the labels), so t.stat() returns numbers for the
     weight, the count and the row total, and a word for the top token ("-" when the listening word
     was cut).
   - Colors come only from theme classes: dg, dot and dot-accent (lamp fill, cyan in LATENT views),
     dg-edge with tone-accent (outlines), dg-gap (cut words), dg-label, dg-axis, dg-marker, chip, chip ok,
     chip bad, chip core, muted, small. Lamp brightness is fill-opacity, a number, not a color.
*/
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- the story's numbers ---------- */

  // Clemency's slip, typed the way the old operators wrote them: ten words, one token per word.
  var WORDS = ["miss", "clemency", "rang", "for", "ewart", "said", "she", "would", "ring", "back"];

  // Gwilym's three hand-set cards per word, 3 numbers each: query (what it's looking for), key (the
  // label it offers) and value (what it passes on). Read the numbers as [a person, a woman, an action].
  var CARDS = {
    "miss":     { q: [1, 0.5, 0],     k: [0.3, 0.8, 0],  v: [0.3, 0.8, 0] },
    "clemency": { q: [0, 0, 1.5],     k: [1, 1, 0],      v: [1, 1, 0] },
    "rang":     { q: [1.5, 0.3, 0],   k: [0, 0, 1],      v: [0, 0, 1] },
    "for":      { q: [1, -0.3, 0],    k: [0.1, 0, 0.2],  v: [0, 0, 0.2] },
    "ewart":    { q: [0, 0, 1],       k: [1, -0.3, 0],   v: [1, -1, 0] },
    "said":     { q: [1.5, 0.5, 0],   k: [0, 0, 0.9],    v: [0, 0, 1] },
    "she":      { q: [3, 3, 0],       k: [0, 0.2, 0],    v: [0.5, 0.5, 0] },
    "would":    { q: [0.5, 1, 1],     k: [0, 0, 0.5],    v: [0, 0, 0.5] },
    "ring":     { q: [0.3, 0.3, 0.8], k: [0, 0, 0.8],    v: [0, 0, 1] },
    "back":     { q: [0, 0, 1.2],     k: [0, 0, 0.3],    v: [0, 0, 0.5] }
  };

  var DIM = 3;                          // numbers per card
  var SCALE = 1 / Math.sqrt(DIM);       // scores are divided by the square root of the key length
  var HUM = 0.25;                       // how loud each line's hum is
  var SLOW = 4;                         // the slow wave turns 4 times slower than the fast one
  var ZERO = [0, 0, 0];

  var BOARD_LINES = 8;                  // Saturday's board: 8 lines, 64 lamps
  var MIN_LINES = 4;
  var MAX_LINES = 10;                   // the laptop copy: every word of the slip on a line
  var START_WORD = "she";
  var START_CLOCK = 4 * 3600;           // four in the morning, at home with the laptop copy
  var NARRATE_DELAY = 0.4;              // real seconds of stillness on the slider before the log speaks
  var SHUFFLE_NAMES = ["reversed", "odd lines first", "rotated by 3"];

  /* ---------- attention ---------- */

  function byMessage(a, b) { return WORDS.indexOf(a) - WORDS.indexOf(b); }

  function hum(slot) {
    return [HUM * Math.sin(slot), HUM * Math.cos(slot), HUM * Math.sin(slot / SLOW)];
  }

  function plus(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }

  // The newest `lines` words of an arrangement: what the board keeps, like line 41.
  function inView(order, lines) { return order.slice(order.length - lines); }

  // The words that never get a line.
  function cutOff(order, lines) { return order.slice(0, order.length - lines); }

  function lamps(lines) { return lines * lines; }

  // One attention head over the words on the board, in board order. Returns every word's weights over
  // every word on the board (itself included) and every word's output. Sums run in message order.
  function attend(view, hums) {
    var n = view.length, canon = view.slice().sort(byMessage), cards = {}, weights = {}, outputs = {};
    var i, j, d;
    for (i = 0; i < n; i++) {
      var w = view[i], c = CARDS[w], p = hums ? hum(i) : ZERO;
      cards[w] = { q: plus(c.q, p), k: plus(c.k, p), v: plus(c.v, p) };
    }
    for (i = 0; i < n; i++) {
      var me = view[i], q = cards[me].q, sc = {}, e = {}, wt = {}, out = [0, 0, 0], m = -1e300, tot = 0;
      for (j = 0; j < n; j++) {
        var kk = cards[canon[j]].k;
        sc[canon[j]] = (q[0] * kk[0] + q[1] * kk[1] + q[2] * kk[2]) * SCALE;
      }
      for (j = 0; j < n; j++) m = Math.max(m, sc[canon[j]]);
      for (j = 0; j < n; j++) {
        e[canon[j]] = Math.exp(sc[canon[j]] - m);
        tot += e[canon[j]];
      }
      for (j = 0; j < n; j++) wt[canon[j]] = e[canon[j]] / tot;
      for (j = 0; j < n; j++) {
        var vv = cards[canon[j]].v;
        for (d = 0; d < DIM; d++) out[d] += wt[canon[j]] * vv[d];
      }
      weights[me] = wt;
      outputs[me] = out;
    }
    return { view: view.slice(), weights: weights, outputs: outputs };
  }

  // The brightest lamp in a row. Ties go to the word that comes first in the message.
  function top(row) {
    var best = null;
    for (var i = 0; i < WORDS.length; i++) {
      var w = WORDS[i];
      if (!Object.prototype.hasOwnProperty.call(row, w)) continue;
      if (best === null || row[w] > row[best]) best = w;
    }
    return best;
  }

  function rowTotal(row) {
    var tot = 0;
    for (var i = 0; i < WORDS.length; i++) if (Object.prototype.hasOwnProperty.call(row, WORDS[i])) tot += row[WORDS[i]];
    return tot;
  }

  // Rearrange the words on the board (the newest `lines`) by shuffle number `count` of the fixed cycle.
  function shuffled(order, lines, count) {
    var head = cutOff(order, lines), view = inView(order, lines), n = view.length, kind = count % 3, out = [], i;
    if (kind === 0) {
      for (i = n - 1; i >= 0; i--) out.push(view[i]);
    } else if (kind === 1) {
      for (i = 0; i < n; i += 2) out.push(view[i]);
      for (i = 1; i < n; i += 2) out.push(view[i]);
    } else {
      var r = 3 % n;
      out = view.slice(r).concat(view.slice(0, r));
    }
    return head.concat(out);
  }

  function sameList(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function sameNums(a, b) {
    for (var d = 0; d < DIM; d++) if (a[d] !== b[d]) return false;
    return true;
  }

  /* ---------- formatting ---------- */

  function f2(v) { return v.toFixed(2); }
  function lampText(v) { return v < 0.005 ? "<0.01" : f2(v); }
  function vec(a) { return "[" + f2(a[0]) + ", " + f2(a[1]) + ", " + f2(a[2]) + "]"; }

  /* ---------- the widget ---------- */

  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
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
      "Clemency's slip on the laptop copy of the board. Each word sits on one line, numbered on the board. " +
      "Words marked cut were dropped before the board, like line 41 does, so no lamp ever lights for them."));

    box.appendChild(head("The slip"));
    var chips = el("div", "chips", "", "");
    chips.setAttribute("aria-label", "The slip, word by word, in board order");
    box.appendChild(chips);

    box.appendChild(head("Lamps for the listening word"));
    var rowSvg = mk(doc, "svg", { viewBox: "0 0 640 92", width: "100%", "class": "dg", role: "img", "aria-label": "" });
    box.appendChild(rowSvg);
    var rowNote = el("p", "", "margin:0;font-size:13px;", "");
    rowNote.setAttribute("aria-live", "polite");
    box.appendChild(rowNote);

    box.appendChild(head("The whole board: one row per listening word"));
    var mapSvg = mk(doc, "svg", { viewBox: "0 0 640 278", width: "100%", "class": "dg", role: "img", "aria-label": "" });
    box.appendChild(mapSvg);

    box.appendChild(head("Outputs: each word's values mixed by its weights"));
    var outNote = el("p", "muted", "margin:0;font-size:12px;", "");
    outNote.setAttribute("aria-live", "polite");
    box.appendChild(outNote);
    var table = el("table", "", "", "");
    var thead = el("thead", "", "", "");
    var hr = el("tr", "", "", "");
    ["line", "word", "output", "against message order"].forEach(function (h) { hr.appendChild(el("th", "", "", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody", "", "", "");
    table.appendChild(tbody);
    box.appendChild(table);

    api.root.appendChild(box);
    return { doc: doc, chips: chips, rowSvg: rowSvg, rowNote: rowNote, mapSvg: mapSvg, outNote: outNote, tbody: tbody, el: el };
  }

  /* ---------- drawing ---------- */

  function drawChips(S) {
    var ui = S.ui, doc = ui.doc, cut = cutOff(S.order, S.lines), view = inView(S.order, S.lines);
    clear(ui.chips);
    S.order.forEach(function (w) {
      var c = doc.createElement("span"), isCut = cut.indexOf(w) >= 0;
      c.className = isCut ? "chip bad" : (w === S.word ? "chip ok" : "chip core");
      c.appendChild(doc.createTextNode(w));
      var n = doc.createElement("span");
      n.setAttribute("style", "font-size:10px;opacity:.75;margin-left:5px;");
      n.textContent = isCut ? "cut" : "line " + (view.indexOf(w) + 1);
      c.appendChild(n);
      ui.chips.appendChild(c);
    });
  }

  function drawRow(S) {
    var ui = S.ui, doc = ui.doc, svg = ui.rowSvg, cut = cutOff(S.order, S.lines), view = inView(S.order, S.lines);
    var listening = view.indexOf(S.word) >= 0, row = listening ? S.res.weights[S.word] : null, best = listening ? top(row) : null;
    var CW = 58, GAP = 4, x0 = (640 - (S.order.length * (CW + GAP) - GAP)) / 2;
    clear(svg);
    S.order.forEach(function (w, i) {
      var x = x0 + i * (CW + GAP), cx = x + CW / 2;
      if (cut.indexOf(w) >= 0) {
        mk(doc, "rect", { x: x, y: 22, width: CW, height: 40, rx: 4, "class": "dg-gap" }, svg);
        txt(doc, svg, cx, 14, "cut", "dg-gap");
        txt(doc, svg, cx, 47, "-", "dg-gap");
        txt(doc, svg, cx, 80, w, "dg-gap", "middle", "font-size:11px;");
        return;
      }
      var wv = row ? row[w] : 0;
      if (row) mk(doc, "rect", { x: x, y: 22, width: CW, height: 40, rx: 4, "class": "dot dot-accent", "fill-opacity": (0.08 + 0.6 * wv).toFixed(3) }, svg);
      mk(doc, "rect", { x: x, y: 22, width: CW, height: 40, rx: 4, "class": w === best ? "dg-edge tone-accent" : "dg-edge",
        style: w === best ? "stroke-width:2.5" : "stroke-width:1" }, svg);
      if (w === best) txt(doc, svg, cx, 14, "brightest", "dg-marker tone-accent");
      else txt(doc, svg, cx, 14, "line " + (view.indexOf(w) + 1), "dg-axis", "middle", "font-size:10px;");
      txt(doc, svg, cx, 47, row ? lampText(wv) : "-", "dg-label", "middle", "font-size:12px;");
      txt(doc, svg, cx, 80, w, w === S.word ? "dg-label" : "dg-axis", "middle", "font-size:11px;");
    });
    if (listening) {
      svg.setAttribute("aria-label", "Lamps for " + S.word + ": " + view.map(function (w) { return w + " " + f2(row[w]); }).join(", ") +
        (cut.length ? ". Cut before the board: " + cut.join(", ") + "." : "."));
      ui.rowNote.textContent = S.word + " listens to the " + view.length + " words on the board, itself included. Brightest: " + best + ", " +
        f2(row[best]) + ". The row adds up to " + f2(rowTotal(row)) + "." +
        (cut.length ? " Cut before the board: " + cut.join(", ") + ", so " + S.word + " can't listen to " + (cut.length === 1 ? "it" : "them") + " at all." : "");
    } else {
      svg.setAttribute("aria-label", S.word + " was cut before the board, so it has no lamps.");
      ui.rowNote.textContent = S.word + " never reached the board on " + S.lines + " lines, so it listens to nothing and nothing listens to it.";
    }
  }

  function drawMap(S) {
    var ui = S.ui, doc = ui.doc, svg = ui.mapSvg, view = S.res.view, n = view.length;
    var CW = 52, CH = 24, X0 = 84, Y0 = 32, h = Y0 + n * CH + 8;
    clear(svg);
    svg.setAttribute("viewBox", "0 0 640 " + h);
    svg.setAttribute("aria-label", "Heat map of the " + n + " words on the board: one row per listening word, one column per word listened to, each row adding up to 1.");
    txt(doc, svg, X0 - 8, 14, "listens to:", "dg-axis", "end", "font-size:10px;");
    view.forEach(function (u, j) {
      txt(doc, svg, X0 + j * CW + CW / 2, 24, u, "dg-axis", "middle", "font-size:10px;");
    });
    view.forEach(function (me, i) {
      var y = Y0 + i * CH, row = S.res.weights[me];
      txt(doc, svg, X0 - 8, y + 16, me, me === S.word ? "dg-label" : "dg-axis", "end", "font-size:11px;");
      view.forEach(function (u, j) {
        var x = X0 + j * CW;
        mk(doc, "rect", { x: x + 1, y: y + 1, width: CW - 2, height: CH - 2, rx: 2, "class": "dot dot-accent", "fill-opacity": (0.08 + 0.6 * row[u]).toFixed(3) }, svg);
        txt(doc, svg, x + CW / 2, y + 16, lampText(row[u]), "dg-label", "middle", "font-size:10px;font-weight:400;");
      });
      if (me === S.word) mk(doc, "rect", { x: X0, y: y, width: n * CW, height: CH, rx: 3, "class": "dg-edge tone-accent", style: "stroke-width:2" }, svg);
    });
  }

  // Compare every word's output with the same words on the board in message order.
  function compare(S) {
    var view = S.res.view, inOrder = view.slice().sort(byMessage), same = 0, changed = 0;
    var shuffledNow = !sameList(view, inOrder);
    var base = shuffledNow ? attend(inOrder, S.hums) : S.res;
    var marks = {};
    view.forEach(function (w) {
      var eq = sameNums(S.res.outputs[w], base.outputs[w]);
      if (eq) same += 1; else changed += 1;
      marks[w] = shuffledNow ? (eq ? "same" : "changed") : "in order";
    });
    return { shuffled: shuffledNow, same: same, changed: changed, marks: marks };
  }

  function drawOutputs(S) {
    var ui = S.ui, view = S.res.view;
    clear(ui.tbody);
    view.forEach(function (w, i) {
      var tr = ui.el("tr", "", "", "");
      tr.appendChild(ui.el("td", "", "", String(i + 1)));
      tr.appendChild(ui.el("td", w === S.word ? "" : "muted", "", w));
      tr.appendChild(ui.el("td", "", "font-variant-numeric:tabular-nums;", vec(S.res.outputs[w])));
      tr.appendChild(ui.el("td", S.cmp.marks[w] === "changed" ? "" : "muted", "", S.cmp.marks[w]));
      ui.tbody.appendChild(tr);
    });
    if (!S.cmp.shuffled) {
      ui.outNote.textContent = "Words in message order. Press Shuffle to rearrange the words on the board, then compare each word's output with this order.";
    } else if (S.cmp.changed === 0) {
      ui.outNote.textContent = "Shuffled, hums off: all " + S.cmp.same + " outputs are exactly the same numbers as in message order, only on different lines.";
    } else {
      ui.outNote.textContent = "Shuffled, hums " + (S.hums ? "on" : "off") + ": " + S.cmp.changed + " of " + view.length +
        " outputs changed, because each word now carries a different line's hum.";
    }
  }

  function drawStats(S) {
    var view = S.res.view, row = view.indexOf(S.word) >= 0 ? S.res.weights[S.word] : null;
    if (row) {
      var best = top(row);
      S.stat.top(best);
      S.stat.weight(f2(row[best]));
      S.stat.rowsum(f2(rowTotal(row)));
    } else {
      S.stat.top("-");
      S.stat.weight("-");
      S.stat.rowsum("-");
    }
    S.stat.inview(view.length);
  }

  function draw(api) {
    var S = api.state;
    S.res = attend(inView(S.order, S.lines), S.hums);
    S.cmp = compare(S);
    drawChips(S);
    drawRow(S);
    drawMap(S);
    drawOutputs(S);
    drawStats(S);
  }

  /* ---------- narration ---------- */

  function lampLine(S) {
    var view = S.res.view;
    if (view.indexOf(S.word) < 0) return S.word + " never reached the board, so it listens to nothing.";
    var row = S.res.weights[S.word], best = top(row);
    return "Lamps for " + S.word + ": brightest " + best + ", " + f2(row[best]) + ".";
  }

  function logLines(api) {
    var S = api.state, cut = cutOff(S.order, S.lines);
    var where = cut.length ? S.lines + " lines, " + lamps(S.lines) + " lamps. Cut before the board: " + cut.join(", ") + "."
      : S.lines + " lines, " + lamps(S.lines) + " lamps, every word on the board.";
    api.log(where + " " + lampLine(S), cut.indexOf("clemency") >= 0 ? "bad" : "ok");
  }

  function setLines(api, v) {
    var S = api.state, k = Math.round(Number(v));
    if (!(k >= MIN_LINES && k <= MAX_LINES)) return;
    S.lines = k;
    S.order = WORDS.slice();
    S.shuffles = 0;
    draw(api);
    if (S.narrateTimer) S.narrateTimer.cancel();
    S.narrateTimer = api.after(NARRATE_DELAY, function () {
      S.narrateTimer = null;
      logLines(api);
    });
  }

  function setHums(api, on) {
    var S = api.state;
    S.hums = !!on;
    draw(api);
    api.log(S.hums ? "Hums on: each line adds its own hum to all three cards of the word on it. " + lampLine(S)
      : "Hums off: every line sounds the same, so nothing tells the board which line a word is on. " + lampLine(S), "");
  }

  function setWord(api, v) {
    var S = api.state;
    if (WORDS.indexOf(v) < 0) return;
    S.word = v;
    draw(api);
    api.log(lampLine(S), inView(S.order, S.lines).indexOf(v) >= 0 ? "" : "bad");
  }

  function doShuffle(api) {
    var S = api.state, kind = S.shuffles % 3;
    S.order = shuffled(S.order, S.lines, S.shuffles);
    S.shuffles += 1;
    draw(api);
    var c = S.cmp, n = S.res.view.length;
    if (c.changed === 0) {
      api.log("Shuffle " + S.shuffles + ", " + SHUFFLE_NAMES[kind] + ". Hums off: all " + c.same +
        " outputs are exactly the same numbers as in message order, only on different lines.", "warn");
    } else {
      api.log("Shuffle " + S.shuffles + ", " + SHUFFLE_NAMES[kind] + ". Hums " + (S.hums ? "on" : "off") + ": " + c.changed + " of " + n +
        " outputs changed, because each word now carries a different line's hum.", "ok");
    }
  }

  function putBack(api) {
    var S = api.state;
    S.order = WORDS.slice();
    S.shuffles = 0;
    draw(api);
    api.log("Back in message order. " + lampLine(S), "");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a1e05", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.order = WORDS.slice();
      S.lines = BOARD_LINES;
      S.hums = true;
      S.word = START_WORD;
      S.shuffles = 0;
      S.narrateTimer = null;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.word = api.control.select("word", "Listening word", WORDS.map(function (w) { return { value: w, label: w }; }),
        START_WORD, function (v) { setWord(api, v); });
      S.ctl.hums = api.control.toggle("hums", "Position information (the hums)", true, function (on) { setHums(api, on); });
      S.ctl.lines = api.control.range("lines", "Lines on the board (context window)", MIN_LINES, MAX_LINES, 1, BOARD_LINES,
        function (v) { setLines(api, v); },
        { format: function (v) { var k = Math.round(Number(v)); return k + " lines, " + lamps(k) + " lamps"; } });
      S.ctl.shuffle = api.control.button("shuffle", "Shuffle the words on the board", function () { doShuffle(api); }, { tone: "primary" });
      S.ctl.order = api.control.button("order", "Put them back in order", function () { putBack(api); });
      S.ctl.reset = api.control.button("reset", "Reset to Saturday's board", function () { api.reset(); });

      S.stat = {
        top: api.stat("top", "top attended word", "warn"),
        weight: api.stat("weight", "its weight", "warn"),
        inview: api.stat("inview", "tokens in view", ""),
        rowsum: api.stat("rowsum", "the row adds up to", "")
      };

      api.info("<strong>How to read it.</strong> The top row is the listening word's lamps: its attention weight for every word on the board, " +
        "brighter for bigger, with the brightest outlined. Words marked cut were dropped before the board. The grid is the whole heat map, " +
        "one row per listening word, and every row adds up to 1. The table is every word's output: the values of every word on the board, " +
        "mixed by its weights. Each card holds 3 hand-set numbers, read as a person, a woman, an action: a teaching simplification. " +
        "A score is the query and the key multiplied number by number and added up, divided by the square root of 3, as the 2017 paper divides " +
        "by the square root of the key length. With the hums on, each line adds its own small sine and cosine numbers to all three cards of the word on it.");
      draw(api);
      api.log("Four in the morning. The laptop copy, set like Saturday's board: " + BOARD_LINES + " lines, " + lamps(BOARD_LINES) +
        " lamps, hums on. Cut before the board: " + cutOff(S.order, S.lines).join(", ") + ". " + lampLine(S), "bad");
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function n(id) { return Number(t.stat(id)); }
      function chipCount(cls) {
        var kids = st().ui.chips.children, c = 0;
        for (var q = 0; q < kids.length; q++) if (kids[q].className === cls) c += 1;
        return c;
      }
      var lines, c, ok, order, r;
      var SPAN = WORDS.length - WORDS.indexOf("clemency");     // from clemency to the last word: 9

      // 1. Saturday's board at the start.
      await t.run(1);
      t.expect(st().lines === 8 && st().hums === true && st().word === "she" && sameList(st().order, WORDS) &&
        t.stat("top") === "ewart" && n("weight") === 0.28 && n("inview") === 8 && n("rowsum") === 1 &&
        chipCount("chip bad") === 2 && st().ui.tbody.children.length === 8 && t.logText().indexOf("brightest ewart, 0.28") >= 0,
        "the start is Saturday's board: 8 lines, hums on, she listening, miss and clemency cut, the brightest lamp ewart at 0.28, 8 tokens in view, the row adding up to 1.00");

      // 2. Every row of weights adds up to 1 and every weight is positive.
      ok = true;
      var rows = 0;
      [true, false].forEach(function (h) {
        for (lines = MIN_LINES; lines <= MAX_LINES; lines++) {
          order = WORDS.slice();
          for (c = 0; c <= 3; c++) {
            if (c > 0) order = shuffled(order, lines, c - 1);
            r = attend(inView(order, lines), h);
            r.view.forEach(function (me) {
              var tot = 0;
              r.view.forEach(function (u) {
                var w = r.weights[me][u];
                if (!(w > 0 && w < 1)) ok = false;
                tot += w;
              });
              if (Math.abs(tot - 1) > 1e-9 || Object.keys(r.weights[me]).length !== r.view.length) ok = false;
              rows += 1;
            });
          }
        }
      });
      t.expect(ok && rows === 392,
        "all 392 rows (hums on and off, 4 to 10 lines, in order and after 3 shuffles) add up to 1 within 1e-9, cover every word on the board, and every weight is between 0 and 1, never 0");

      // 3. The key link, with every word in view: she listens most to clemency, as the laptop copy said.
      var r10 = attend(inView(WORDS, 10), true), off10 = attend(inView(WORDS, 10), false), r9 = attend(inView(WORDS, 9), true);
      var she = r10.weights.she;
      t.expect(top(she) === "clemency" && f2(she.clemency) === "0.74" && f2(she.miss) === "0.13" && f2(she.ewart) === "0.02" &&
        f2(1 - she.clemency - she.miss) === "0.13" && top(off10.weights.she) === "clemency" &&
        top(r9.weights.she) === "clemency" && f2(r9.weights.she.clemency) === "0.78",
        "with all 10 words, she's brightest lamp is clemency at 0.74, miss 0.13, ewart 0.02, the other 8 together 0.13; clemency also wins with the hums off; at 9 lines (miss cut) clemency gets 0.78");

      // 4. Shrinking the window below the span from clemency to the last word removes the link.
      ok = true;
      for (lines = MIN_LINES; lines <= MAX_LINES; lines++) {
        var v = inView(WORDS, lines), has = v.indexOf("clemency") >= 0;
        [true, false].forEach(function (h) {
          var rr = attend(v, h), tp = top(rr.weights.she);
          if (lines >= SPAN) {
            if (!has || tp !== "clemency") ok = false;
          } else if (has || rr.weights.she.clemency !== undefined || tp === "clemency") ok = false;
        });
      }
      var r8 = attend(inView(WORDS, 8), true);
      t.expect(ok && SPAN === 9 && cutOff(WORDS, 8).join(" ") === "miss clemency" && top(r8.weights.she) === "ewart" && f2(r8.weights.she.ewart) === "0.28",
        "clemency is in view and she's top at 9 and 10 lines; at 8 lines or fewer clemency is cut, has no weight at all, and on Saturday's 8 lines the top is ewart at 0.28");

      // 5. Without position information, shuffling permutes the outputs exactly.
      ok = true;
      var moved = true, checked = 0;
      for (lines = MIN_LINES; lines <= MAX_LINES; lines++) {
        var inOrder = attend(inView(WORDS, lines), false);
        order = WORDS.slice();
        for (c = 0; c < 6; c++) {
          order = shuffled(order, lines, c);
          var view = inView(order, lines);
          if (sameList(view, inOrder.view)) moved = false;
          var rs = attend(view, false);
          inOrder.view.forEach(function (me) {
            if (!sameNums(rs.outputs[me], inOrder.outputs[me])) ok = false;
            inOrder.view.forEach(function (u) { if (rs.weights[me][u] !== inOrder.weights[me][u]) ok = false; });
          });
          checked += 1;
        }
      }
      t.expect(ok && moved && checked === 42,
        "hums off: in 42 shuffles (6 at each of 4 to 10 lines), every arrangement differs from message order, yet every word's output and every weight are bit-for-bit the same, only on different lines");

      // 6. With position information, shuffling changes the outputs.
      ok = true;
      var fewest = 99;
      for (lines = MIN_LINES; lines <= MAX_LINES; lines++) {
        var base = attend(inView(WORDS, lines), true);
        order = WORDS.slice();
        for (c = 0; c < 6; c++) {
          order = shuffled(order, lines, c);
          var rh = attend(inView(order, lines), true), changed = 0;
          base.view.forEach(function (me) { if (!sameNums(rh.outputs[me], base.outputs[me])) changed += 1; });
          if (changed < 1) ok = false;
          if (changed < fewest) fewest = changed;
        }
      }
      var rev = attend(inView(shuffled(WORDS, 10, 0), 10), true), revChanged = 0;
      WORDS.forEach(function (w) { if (!sameNums(rev.outputs[w], r10.outputs[w])) revChanged += 1; });
      t.expect(ok && fewest >= 1 && revChanged === 10,
        "hums on: every one of the 42 shuffles changes at least one output, and reversing all 10 words changes all 10");

      // 7. Every story number, checked exactly.
      var r4 = attend(inView(WORDS, 4), true), off8 = attend(inView(WORDS, 8), false);
      t.expect(WORDS.length === 10 && BOARD_LINES === 8 && lamps(8) === 64 && lamps(10) === 100 && lamps(20) === 400 &&
        lamps(40) === 1600 && lamps(40) / lamps(8) === 25 && WORDS.length * 3 === 30 && DIM === 3 &&
        WORDS.join(" ") === "miss clemency rang for ewart said she would ring back" &&
        inView(WORDS, 8).join(" ") === "rang for ewart said she would ring back" &&
        WORDS.indexOf("she") - WORDS.indexOf("clemency") === 5 && WORDS.length - 2 === 8 &&
        f2(r8.weights.she.ewart) === "0.28" && f2(she.clemency) === "0.74" && f2(she.miss) === "0.13" && f2(she.ewart) === "0.02" &&
        f2(r9.weights.she.clemency) === "0.78" && inView(WORDS, 9).indexOf("miss") < 0 &&
        inView(WORDS, 4).join(" ") === "she would ring back" && top(r4.weights.she) === "she" && f2(r4.weights.she.she) === "0.38" &&
        top(off8.weights.she) === "ewart" && f2(off8.weights.she.ewart) === "0.31" && START_CLOCK === 14400,
        "story numbers: 10 words, 8 lines and 64 lamps, 10 lines and 100, 20 and 400, 40 and 1,600 (25 times 64), 30 cards of 3 numbers, the board holding rang for ewart said she would ring back, she five words after clemency, ewart 0.28 at 8 lines, clemency 0.74, miss 0.13, ewart 0.02 at 10, clemency 0.78 at 9, she itself 0.38 at 4, ewart 0.31 at 8 with the hums off, four in the morning");

      // 8. Deterministic: the same inputs give identical numbers, and the shuffle cycle is fixed.
      var a1 = attend(inView(WORDS, 8), true), a2 = attend(inView(WORDS, 8), true);
      ok = sameList(a1.view, a2.view);
      a1.view.forEach(function (me) {
        if (!sameNums(a1.outputs[me], a2.outputs[me])) ok = false;
        a1.view.forEach(function (u) { if (a1.weights[me][u] !== a2.weights[me][u]) ok = false; });
      });
      var s1 = shuffled(WORDS, 10, 0), s2 = shuffled(s1, 10, 1), s3 = shuffled(s2, 10, 2);
      t.expect(ok &&
        sameList(s1, ["back", "ring", "would", "she", "said", "ewart", "for", "rang", "clemency", "miss"]) &&
        sameList(s2, ["back", "would", "said", "for", "clemency", "ring", "she", "ewart", "rang", "miss"]) &&
        sameList(s3, ["for", "clemency", "ring", "she", "ewart", "rang", "miss", "back", "would", "said"]) &&
        sameList(shuffled(WORDS, 8, 0), ["miss", "clemency", "back", "ring", "would", "she", "said", "ewart", "for", "rang"]),
        "attention gives identical numbers twice over, and the shuffle cycle is fixed: reversed, odd lines first, rotated by 3, touching only the words on the board");

      // 9. The controls: the window, the hums, shuffle, back in order, a cut listener, reset.
      t.set("lines", 10);
      await t.run(1);
      var full = t.stat("top") === "clemency" && n("weight") === 0.74 && n("inview") === 10 && chipCount("chip bad") === 0 &&
        t.logText().indexOf("every word on the board. Lamps for she: brightest clemency, 0.74.") >= 0;
      t.set("lines", 9);
      await t.run(1);
      var nine = t.stat("top") === "clemency" && n("weight") === 0.78 && n("inview") === 9 && chipCount("chip bad") === 1;
      t.set("lines", 4);
      await t.run(1);
      var four = t.stat("top") === "she" && n("weight") === 0.38 && n("inview") === 4 && n("rowsum") === 1;
      t.set("lines", 10);
      await t.run(1);
      t.set("hums", false);
      t.click("shuffle");
      var offShuf = sameList(st().order, s1) && st().cmp.same === 10 && st().cmp.changed === 0 &&
        t.logText().indexOf("Hums off: all 10 outputs are exactly the same numbers") >= 0;
      t.set("hums", true);
      t.click("shuffle");
      var onShuf = sameList(st().order, s2) && st().cmp.changed >= 1 && t.logText().indexOf("outputs changed") >= 0;
      t.click("order");
      var back = sameList(st().order, WORDS) && t.stat("top") === "clemency" && n("weight") === 0.74;
      t.set("lines", 8);
      await t.run(1);
      t.set("word", "clemency");
      var gone = t.stat("top") === "-" && t.logText().indexOf("clemency never reached the board") >= 0;
      t.set("word", "rang");
      var rangOk = t.stat("top") === top(r8.weights.rang) && n("weight") === Number(f2(r8.weights.rang[top(r8.weights.rang)]));
      t.click("reset");
      await t.run(1);
      t.expect(full && nine && four && offShuf && onShuf && back && gone && rangOk &&
        st().lines === 8 && st().word === "she" && t.stat("top") === "ewart" && n("weight") === 0.28,
        "the controls: 10 lines show clemency 0.74 with nothing cut, 9 show 0.78 with one word cut, 4 show she itself at 0.38; hums off then Shuffle reverses the words and all 10 outputs stay the same; hums on then Shuffle changes them; back in order restores 0.74; a cut listener shows no lamps; reset returns to ewart 0.28");
    }
  });
})();
