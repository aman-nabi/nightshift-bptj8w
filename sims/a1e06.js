/* sims/a1e06-v1.0.0.js  (published as sims/a1e06.js)
   Case a1e06 "The Next Word": a planchette lab built from Anouk's log at Café Brume.

   CHANGELOG
   v1.0.0 (2026-10-07) first version: a widget-style sim built inside api.root (no diagram), copying the
     a1e04 template, with one inline SVG drawing (theme classes only). A toy next-word table, copied from
     the story's log, drives the board. The drawing shows the bars for the next word: the table's chance
     (dashed outline), the chance after temperature, and the final chance after top-p (filled bar), with
     words outside the nucleus marked cut. Controls: pick by (sample or greedy), temperature (0, 0.5, 1,
     1.5), top-p (1.0, 0.9, 0.5), next word, write to the end, run 20 times, reset. Stats: the word just
     chosen, its chance at the draw, tokens in the nucleus now, the share of the last 20 runs that ended
     in the fire, and the exact chance that an answer ends in the fire at the current settings. selfTest
     covers the start, the table, sums after temperature and after top-p, temperature 1, greedy and
     temperature 0, entropy against temperature, the top-p prefix, the same dice giving the same text,
     the 20 runs, every story number, the controls and reset.

   Where every number comes from (conventions rule 14; the case is content/latent/a1/a1e06-v1.0.0.json):
   - post, log block (night 6, last night): step 1 after 0.52, she 0.45, spoons 0.03; step 2 the 0.85,
     midnight 0.15; step 3 fire 0.65, flood 0.35; step 4 GOODBYE 1.00. Post paragraph 3: SHE STAYED was
     drawn at 0.45 over RETIRED at 0.55. Those four rows are TABLE below, exactly. After the last word of
     every answer the board goes to GOODBYE at 1.00, as step 4 shows, so every other context is
     [GOODBYE 1]. Settings in the post: temperature 1.0 and top_p 1.0 (START_TEMP, START_TOPP), sampling.
     The six answers of the six nights are exactly the six answers the table can write (ENDINGS).
   - post, the twenty more runs: fire 6, flood 5, she stayed 4, she retired 3, after midnight 1, spoons 1.
     That is "Run 20 times" right after a reset, at the start settings, with the engine's default seed
     (7): the runs come out, in order, flood, retired, flood, fire, fire, spoons, retired, fire, midnight,
     stayed, stayed, fire, flood, flood, retired, flood, fire, stayed, stayed, fire (STORY_RUNS). They use
     70 draws of api.rand(). 6 of 20 is 30 percent (the sim.tryThis and explain.limits).
   - evidence diagram: step 3, fire 0.65 drawn, flood 0.35 not; the 20-run tally above.
   - comments: fire was the favourite, 0.65 against 0.35.
   - reply part 2s: temperature 0 (or greedy) gives AFTER THE FIRE 20 times in 20, with no dice drawn.
     Temperature 0.5 with top_p 0.9, run 20 times right after a reset: fire 10, she stayed 4, flood 3,
     she retired 3, no spoons, no midnight ("ten times out of twenty, up from six").
   - explanation and trade-off table: the exact chance that an answer ends in the fire is
     0.52 x 0.85 x 0.65 = 0.2873, so 28.73 percent at temperature 1, ahead of she retired at
     0.45 x 0.55 = 24.75 percent; 42.91 percent at temperature 0.5 (0.429065); 22.25 percent at 1.5
     (0.222476); 100 percent at 0; 44.33 percent at 0.5 with top-p 0.9 (0.443269). SPOONS: 0.19 percent
     at 0.5 (0.001900), 3.00 percent at 1, 7.26 percent at 1.5 (0.072570). At temperature 0.5 the first
     word AFTER goes from 0.52 to 0.57 (0.570705) and FIRE from 0.65 to 0.78 (0.775229); at 1.5 SPOONS
     goes from 0.03 to 0.07 (0.072570). Top-p 0.9 on the first word keeps AFTER and SHE, 0.52 + 0.45 =
     0.97, and cuts SPOONS; at temperature 1.5 the first two make 0.9274, so top-p 0.9 still cuts SPOONS.
     Top-p 0.5 at temperature 1 leaves one word in the nucleus at every step.
   - sim.tryThis: from a reset, Next word draws FIRE at 0.65 (first draw 0.0117), Next word again draws
     GOODBYE, and Write to the end then asks again and spells SPOONS (third draw 0.9769, past
     0.52 + 0.45 = 0.97). A third answer would be SHE RETIRED.
   - the clock starts at a quarter past two (START_CLOCK), as sim.lede says.

   The sampling contract (a Python mirror of this file produced every number above; keep them in step):
   - The board starts mid-answer at "after the" (START_WORDS), where last night's step 3 was. "Run 20
     times" always starts each run from the empty answer and never changes the board's own answer.
   - Temperature T: T = 1 returns the table unchanged; T = 0 keeps only the top word (the first one on
     a tie); otherwise every chance is raised to the power 1 / T and the results are rescaled to add up
     to 1, summed in table order.
   - Top-p P: sort by chance (ties keep table order), keep the smallest prefix whose chances add up to at
     least P - 1e-9, then rescale the kept ones, summed in sorted order. If nothing is cut, the
     distribution comes back unchanged. Temperature is applied first, then top-p.
   - Greedy mode, or temperature 0: the top word of the table, and no api.rand() is drawn. Sample mode:
     exactly one api.rand() per word, GOODBYE included, even when only one word is left. The pick walks
     the final chances in table order and takes the first word whose running total passes the draw.
   - setup draws nothing. The engine reseeds api.rand() on every reset, so Reset replays the same draws.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the whole widget inside api.root on every reset. No step() is needed
     because nothing animates; every number is worked out the moment a control changes.
   - The table is a teaching simplification: a real model gives a probability to every token in its
     vocabulary, tens of thousands of them, and works them out fresh for any text. Here the words the
     log printed are the whole vocabulary, and each word stands for a token. The lede and info say so.
   - Entropy appears only in selfTest, never in the widget or the case text.
   - Stats get bare values (units live in the labels), so t.stat() returns numbers, except the chosen
     word and "-" before anything has happened.
   - Colors come only from theme classes: dg, dg-axis, dg-note, dg-group (the dashed outline), dg-node
     with st-warn and st-accent (the filled bars; st-accent marks the likeliest word), chip bad, muted,
     small. In LATENT views st-accent turns cyan, so the text never names a bar by its color.
*/
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- the story's numbers ---------- */

  var END = "GOODBYE";
  var QUESTION = "why did Café Brume close?";

  // Anouk's log, step by step: for each answer so far, the next word's chances.
  var TABLE = {
    "": [["after", 0.52], ["she", 0.45], ["spoons", 0.03]],
    "after": [["the", 0.85], ["midnight", 0.15]],
    "after the": [["fire", 0.65], ["flood", 0.35]],
    "she": [["retired", 0.55], ["stayed", 0.45]]
  };

  // The six answers the board can write, and what is true of each at Café Brume.
  var ENDINGS = [
    { key: "after the fire", short: "the fire", truth: "never happened", tone: "bad" },
    { key: "after the flood", short: "the flood", truth: "never happened", tone: "bad" },
    { key: "after midnight", short: "midnight", truth: "true of any night", tone: "" },
    { key: "she retired", short: "retired", truth: "true", tone: "ok" },
    { key: "she stayed", short: "stayed", truth: "true: she lives upstairs", tone: "ok" },
    { key: "spoons", short: "spoons", truth: "nonsense", tone: "warn" }
  ];
  var FALSE_ENDING = "after the fire";

  var START_WORDS = ["after", "the"];   // last night's step 3
  var START_TEMP = 1;
  var START_TOPP = 1;
  var TEMPS = [0, 0.5, 1, 1.5];
  var TOPPS = [1, 0.9, 0.5];
  var RUNS = 20;
  var MAX_WORDS = 8;                    // a guard; the longest answer is 3 words and GOODBYE
  var TOL = 1e-9;
  var START_CLOCK = 2 * 3600 + 15 * 60; // a quarter past two in the back room

  // Run 20 times, right after a reset, at the start settings (seed 7).
  var STORY_RUNS = ["after the flood", "she retired", "after the flood", "after the fire", "after the fire",
    "spoons", "she retired", "after the fire", "after midnight", "she stayed", "she stayed", "after the fire",
    "after the flood", "after the flood", "she retired", "after the flood", "after the fire", "she stayed",
    "she stayed", "after the fire"];

  /* ---------- the toy model ---------- */

  function tableFor(ctx) {
    var row = TABLE[ctx];
    if (!row) return [{ w: END, p: 1 }];
    return row.map(function (e) { return { w: e[0], p: e[1] }; });
  }

  function copy(d) { return d.map(function (e) { return { w: e.w, p: e.p }; }); }

  function argmax(d) {
    var b = 0;
    for (var i = 1; i < d.length; i++) if (d[i].p > d[b].p) b = i;
    return b;
  }

  function oneHot(d, b) { return d.map(function (e, i) { return { w: e.w, p: i === b ? 1 : 0 }; }); }

  // Temperature: 1 leaves the table alone, 0 keeps only the top word, anything else raises every
  // chance to the power 1 / T and rescales (the same as dividing the logits by T).
  function temper(d, T) {
    if (T === 0) return oneHot(d, argmax(d));
    if (T === 1) return copy(d);
    var ws = [], s = 0, i;
    for (i = 0; i < d.length; i++) ws.push(Math.pow(d[i].p, 1 / T));
    for (i = 0; i < ws.length; i++) s += ws[i];
    return d.map(function (e, k) { return { w: e.w, p: ws[k] / s }; });
  }

  // Top-p: the smallest set of most likely words whose chances reach p, rescaled to add up to 1.
  function nucleusOf(d, P) {
    var order = d.map(function (e, i) { return i; });
    order.sort(function (a, b) { return (d[b].p - d[a].p) || (a - b); });
    var keep = [], cum = 0, positive = 0, i;
    for (i = 0; i < d.length; i++) if (d[i].p > 0) positive += 1;
    for (i = 0; i < order.length; i++) {
      var k = order[i];
      if (d[k].p <= 0) break;
      keep.push(k);
      cum += d[k].p;
      if (cum >= P - TOL) break;
    }
    if (keep.length === positive) return { d: copy(d), keep: keep, n: keep.length };
    var s = 0;
    for (i = 0; i < keep.length; i++) s += d[keep[i]].p;
    var out = d.map(function (e, j) { return { w: e.w, p: keep.indexOf(j) >= 0 ? e.p / s : 0 }; });
    return { d: out, keep: keep, n: keep.length };
  }

  // Everything about one step: the table, after temperature, and the final chances the draw uses.
  function shape(ctx, T, P, greedy) {
    var table = tableFor(ctx), tempered = temper(table, T), fin, n;
    var top = greedy || T === 0;
    if (top) {
      fin = oneHot(table, argmax(table));
      n = 1;
    } else {
      var nu = nucleusOf(tempered, P);
      fin = nu.d;
      n = nu.n;
    }
    return { ctx: ctx, table: table, tempered: tempered, fin: fin, n: n, top: top };
  }

  function pickIndex(d, u) {
    var cum = 0, last = -1;
    for (var i = 0; i < d.length; i++) {
      if (d[i].p <= 0) continue;
      last = i;
      cum += d[i].p;
      if (u < cum) return i;
    }
    return last;
  }

  // One word. Greedy (or temperature 0) takes the top word with no dice; sampling draws exactly once.
  function nextToken(api, words) {
    var S = api.state, sh = shape(words.join(" "), S.temp, S.topp, S.mode === "greedy"), idx;
    if (sh.top) {
      idx = argmax(sh.table);
    } else {
      var u = api.rand();
      S.draws += 1;
      idx = pickIndex(sh.fin, u);
    }
    return { w: sh.fin[idx].w, p: sh.fin[idx].p, ctx: sh.ctx, n: sh.n, top: sh.top };
  }

  // Keep going until GOODBYE (or the guard). Returns the answer's words joined, without GOODBYE.
  function writeAnswer(api, start) {
    var words = start ? start.slice() : [], steps = [];
    for (var k = 0; k < MAX_WORDS; k++) {
      var t = nextToken(api, words);
      steps.push(t);
      if (t.w === END) return { text: words.join(" "), words: words, steps: steps, done: true };
      words.push(t.w);
    }
    return { text: words.join(" "), words: words, steps: steps, done: false };
  }

  // The exact chance of every whole answer, from the start, at the given settings.
  function exactChances(T, P, greedy) {
    var out = {};
    function rec(words, pr) {
      var sh = shape(words.join(" "), T, P, greedy);
      for (var i = 0; i < sh.fin.length; i++) {
        var e = sh.fin[i];
        if (e.p <= 0) continue;
        if (e.w === END) {
          var key = words.join(" ");
          out[key] = (out[key] || 0) + pr * e.p;
        } else {
          rec(words.concat([e.w]), pr * e.p);
        }
      }
    }
    rec([], 1);
    return out;
  }

  // Every context the board can reach, in order: the four rows of the log, then the six endings.
  function allContexts() {
    var out = [];
    function rec(words) {
      var ctx = words.join(" ");
      out.push(ctx);
      var d = tableFor(ctx);
      for (var i = 0; i < d.length; i++) if (d[i].w !== END) rec(words.concat([d[i].w]));
    }
    rec([]);
    return out;
  }

  function runMany(api) {
    var S = api.state, counts = {}, list = [];
    ENDINGS.forEach(function (e) { counts[e.key] = 0; });
    for (var r = 0; r < RUNS; r++) {
      var a = writeAnswer(api, null);
      list.push(a.text);
      counts[a.text] = (counts[a.text] || 0) + 1;
    }
    S.batch = { counts: counts, list: list, temp: S.temp, topp: S.topp, mode: S.mode };
    return S.batch;
  }

  /* ---------- formatting ---------- */

  function f2(v) { return isFinite(v) ? v.toFixed(2) : "-"; }
  function pct(v) { return (100 * v).toFixed(2); }
  function up(s) { return String(s).toUpperCase(); }
  function tLabel(T) { return String(T); }
  function pLabel(P) { return P.toFixed(1); }
  function endingOf(key) {
    for (var i = 0; i < ENDINGS.length; i++) if (ENDINGS[i].key === key) return ENDINGS[i];
    return { key: key, short: key, truth: "", tone: "" };
  }
  function settingsText(S) {
    return "temperature " + tLabel(S.temp) + ", top-p " + pLabel(S.topp) + ", " + (S.mode === "greedy" ? "greedy" : "sample");
  }

  /* ---------- the drawing ---------- */

  var BAR_X = 110, BAR_W = 320, ROW0 = 74, ROW_H = 44, BAR_H = 22;
  var COL_TABLE = 470, COL_TEMP = 545, COL_FINAL = 625;

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

  function c1(v) { return (Math.round(v * 10) / 10).toString(); }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- the widget ---------- */

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
      "A toy next-word table copied from Anouk's log, a teaching simplification: a real model gives a probability to every token " +
      "in its vocabulary, tens of thousands of them. Here six short answers are all the board can say, and each word stands for a token."));

    box.appendChild(el("p", "", "margin:0;font-size:12.5px;overflow-wrap:anywhere;", "Question: " + QUESTION));
    var boardLine = el("p", "", "margin:0;font-size:15px;font-weight:600;letter-spacing:.08em;overflow-wrap:anywhere;", "");
    box.appendChild(boardLine);

    var barHead = head("");
    box.appendChild(barHead);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 680 210", width: "100%", "class": "dg", role: "img",
      "aria-label": "Bars for the next word. For each word: a dashed outline for the table's chance, a filled bar for the final chance after temperature and top-p, and the three numbers on the right. Words outside the nucleus are marked cut."
    });
    var bars = mk(doc, "g", {}, svg);
    box.appendChild(svg);

    box.appendChild(head("Last 20 runs of the question, from the start"));
    var runNote = el("p", "small muted", "margin:0;", "");
    box.appendChild(runNote);
    var table = el("table", "", "width:100%;", "");
    var thead = el("thead", "", "", "");
    var hr = el("tr", "", "", "");
    ["answer", "at the café", "runs", "share (%)", "exact chance (%)"].forEach(function (h) { hr.appendChild(el("th", "", "", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody", "", "", "");
    table.appendChild(tbody);
    box.appendChild(table);
    var runList = el("p", "small muted", "margin:0;overflow-wrap:anywhere;", "");
    box.appendChild(runList);

    api.root.appendChild(box);
    return { doc: doc, el: el, boardLine: boardLine, barHead: barHead, svg: svg, bars: bars, runNote: runNote, tbody: tbody, runList: runList };
  }

  // What the bars show: the next word of the board's answer, or, once it is finished, the first word
  // of the next answer.
  function currentShape(S) {
    var ctx = S.done ? "" : S.words.join(" ");
    return shape(ctx, S.temp, S.topp, S.mode === "greedy");
  }

  function drawBoard(S) {
    var spelled = S.words.length ? up(S.words.join(" ")) : "";
    if (S.done) S.ui.boardLine.textContent = "The board spelled: " + (spelled || "(nothing)") + " · GOODBYE";
    else S.ui.boardLine.textContent = "The board has spelled: " + (spelled || "(nothing yet)") + " _";
  }

  function drawBars(S) {
    var ui = S.ui, doc = ui.doc, g = ui.bars, sh = S.cur;
    clear(g);
    ui.barHead.textContent = S.done ? "First word of the next answer" : "Next word after " + (S.words.length ? up(S.words.join(" ")) : "the question");
    txt(doc, g, 16, 20, settingsText(S) + " · nucleus " + sh.n + " of " + sh.table.length, "dg-note", "start");
    txt(doc, g, COL_TABLE, 52, "table", "dg-axis", "middle");
    txt(doc, g, COL_TEMP, 52, "after temp.", "dg-axis", "middle");
    txt(doc, g, COL_FINAL, 52, "final", "dg-axis", "middle");
    var best = argmax(sh.fin);
    S.drawn = { rows: 0, filled: 0, cut: 0 };
    for (var i = 0; i < sh.table.length; i++) {
      var y = ROW0 + i * ROW_H, tp = sh.table[i].p, fp = sh.fin[i].p;
      txt(doc, g, 16, y + 16, up(sh.table[i].w), "dg-note", "start");
      mk(doc, "rect", { x: BAR_X, y: y, width: c1(Math.max(1, tp * BAR_W)), height: BAR_H, rx: 3, "class": "dg-group" }, g);
      if (fp > 0) {
        var cls = "dg-node " + (i === best ? "st-accent" : "st-warn");
        var gb = mk(doc, "g", { "class": cls }, g);
        mk(doc, "rect", { x: BAR_X, y: y + 4, width: c1(Math.max(1, fp * BAR_W)), height: BAR_H - 8, rx: 2 }, gb);
        S.drawn.filled += 1;
      } else {
        var why = sh.top ? "not taken: greedy takes the top word" : "cut by top-p";
        txt(doc, g, BAR_X + 8, y + 16, why, "dg-axis", "start");
        S.drawn.cut += 1;
      }
      txt(doc, g, COL_TABLE, y + 16, f2(tp), "dg-axis", "middle");
      txt(doc, g, COL_TEMP, y + 16, f2(sh.tempered[i].p), "dg-axis", "middle");
      txt(doc, g, COL_FINAL, y + 16, fp > 0 ? f2(fp) : "cut", fp > 0 ? "dg-note" : "dg-axis", "middle");
      S.drawn.rows += 1;
    }
  }

  function drawRuns(S) {
    var ui = S.ui, el = ui.el, ex = S.exact, b = S.batch;
    ui.runNote.textContent = b ? "Settings for these runs: " + settingsText(b) + ". The exact chances are for the settings now." :
      "No runs yet. The exact chances are for the settings now.";
    clear(ui.tbody);
    for (var i = 0; i < ENDINGS.length; i++) {
      var e = ENDINGS[i], tr = el("tr", "", "", "");
      var name = el("td", "", "", "");
      if (e.key === FALSE_ENDING) name.appendChild(el("span", "chip bad", "", up(e.key)));
      else name.textContent = up(e.key);
      tr.appendChild(name);
      tr.appendChild(el("td", "", "", e.truth));
      tr.appendChild(el("td", "", "", b ? String(b.counts[e.key] || 0) : "-"));
      tr.appendChild(el("td", "", "", b ? String(Math.round(100 * (b.counts[e.key] || 0) / RUNS)) : "-"));
      tr.appendChild(el("td", "", "", pct(ex[e.key] || 0)));
      ui.tbody.appendChild(tr);
    }
    ui.runList.textContent = b ? "In order: " + b.list.map(function (k) { return endingOf(k).short; }).join(", ") + "." : "";
  }

  function drawStats(S) {
    S.stat.word(S.last ? up(S.last.w) : "-");
    S.stat.wordp(S.last ? f2(S.last.p) : "-");
    S.stat.nucleus(S.cur.n);
    S.stat.runfire(S.batch ? Math.round(100 * (S.batch.counts[FALSE_ENDING] || 0) / RUNS) : "-");
    S.stat.exact(pct(S.exact[FALSE_ENDING] || 0));
  }

  function draw(api) {
    var S = api.state;
    S.cur = currentShape(S);
    S.exact = exactChances(S.temp, S.topp, S.mode === "greedy");
    drawBoard(S);
    drawBars(S);
    drawRuns(S);
    drawStats(S);
  }

  /* ---------- narration ---------- */

  function barsText(sh) {
    var parts = [];
    for (var i = 0; i < sh.fin.length; i++) parts.push(up(sh.fin[i].w) + " " + (sh.fin[i].p > 0 ? f2(sh.fin[i].p) : "cut"));
    return parts.join(", ");
  }

  function answerTone(text) { return endingOf(text).tone; }

  function askAgain(api) {
    var S = api.state;
    S.words = [];
    S.done = false;
    api.log("Asked again: " + QUESTION, "");
  }

  function oneStep(api) {
    var S = api.state, before = S.words.length ? up(S.words.join(" ")) : "the question";
    var t = nextToken(api, S.words);
    S.last = t;
    if (t.w === END) S.done = true;
    else S.words.push(t.w);
    return { t: t, before: before };
  }

  function nextWord(api) {
    var S = api.state;
    if (S.done) askAgain(api);
    var r = oneStep(api), t = r.t;
    draw(api);
    var how = t.top ? "took " + up(t.w) + ", the top word, with no dice" : "drew " + up(t.w) + " at " + f2(t.p) + " (nucleus " + t.n + ")";
    if (S.done) {
      var text = S.words.join(" ");
      api.log("After " + r.before + " the board " + how + ". The answer: " + up(text) + ".", answerTone(text));
    } else {
      api.log("After " + r.before + " the board " + how + ".", "");
    }
  }

  function writeToEnd(api) {
    var S = api.state;
    if (S.done) askAgain(api);
    var chances = [];
    for (var k = 0; k < MAX_WORDS && !S.done; k++) {
      var r = oneStep(api);
      chances.push(f2(r.t.p));
    }
    draw(api);
    var text = S.words.join(" ");
    api.log("Wrote to the end: " + up(text) + ", then GOODBYE (chances at each draw: " + chances.join(", ") + ").", answerTone(text));
  }

  function runTwenty(api) {
    var S = api.state, b = runMany(api);
    draw(api);
    var order = ENDINGS.slice().sort(function (a, c) {
      return (b.counts[c.key] - b.counts[a.key]) || (ENDINGS.indexOf(a) - ENDINGS.indexOf(c));
    });
    var parts = [];
    order.forEach(function (e) { if (b.counts[e.key]) parts.push(e.short + " " + b.counts[e.key]); });
    var fire = b.counts[FALSE_ENDING] || 0;
    api.log(RUNS + " runs at " + settingsText(S) + ": " + parts.join(", ") + ". " + Math.round(100 * fire / RUNS) +
      "% ended in the fire; exact chance " + pct(S.exact[FALSE_ENDING] || 0) + "%.", fire ? "warn" : "ok");
  }

  function logSettings(api, what) {
    var S = api.state;
    api.log(what + ". " + (S.done ? "First word now: " : "Next word now: ") + barsText(S.cur) +
      ". Exact chance an answer ends in the fire: " + pct(S.exact[FALSE_ENDING] || 0) + "%.", "");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a1e06", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.words = START_WORDS.slice();
      S.done = false;
      S.temp = START_TEMP;
      S.topp = START_TOPP;
      S.mode = "sample";
      S.last = null;
      S.batch = null;
      S.draws = 0;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.mode = api.control.select("mode", "Pick the next word by",
        [{ value: "sample", label: "sample (draw by the chances)" }, { value: "greedy", label: "greedy (always the top word)" }], "sample",
        function (v) { S.mode = v === "greedy" ? "greedy" : "sample"; draw(api); logSettings(api, S.mode === "greedy" ? "Greedy: always the top word, no dice" : "Sample: draw by the chances"); });
      S.ctl.temp = api.control.select("temp", "Temperature", TEMPS.map(function (T) { return { value: T, label: tLabel(T) }; }), START_TEMP,
        function (v) { S.temp = TEMPS.indexOf(Number(v)) >= 0 ? Number(v) : START_TEMP; draw(api); logSettings(api, "Temperature " + tLabel(S.temp)); });
      S.ctl.topp = api.control.select("topp", "Top-p", TOPPS.map(function (P) { return { value: P, label: pLabel(P) }; }), START_TOPP,
        function (v) { S.topp = TOPPS.indexOf(Number(v)) >= 0 ? Number(v) : START_TOPP; draw(api); logSettings(api, "Top-p " + pLabel(S.topp)); });
      S.ctl.next = api.control.button("next", "Next word", function () { nextWord(api); }, { tone: "primary" });
      S.ctl.write = api.control.button("write", "Write to the end", function () { writeToEnd(api); });
      S.ctl.run20 = api.control.button("run20", "Run 20 times", function () { runTwenty(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        word: api.stat("word", "word just chosen", ""),
        wordp: api.stat("wordp", "its chance at the draw", ""),
        nucleus: api.stat("nucleus", "words in the nucleus now", ""),
        runfire: api.stat("runfire", "last 20 runs ending in the fire (%)", "bad"),
        exact: api.stat("exact", "exact chance of the fire (%)", "warn")
      };

      api.info("<strong>How to read it.</strong> The board answers one word at a time. For the next word, the dashed outline is the table's chance, " +
        "the filled bar is the final chance after temperature and then top-p, and a word outside the nucleus is marked cut. Sample draws by the final chances; " +
        "greedy, like temperature 0, always takes the top word and draws no dice. The table is a teaching simplification copied from Anouk's log: " +
        "a real model scores every token in its vocabulary, fresh for any text. The dice are fixed, so Reset replays the same draws.");
      draw(api);
      api.log("A quarter past two. Replaying last night: " + QUESTION + " The board has spelled AFTER THE. Next word: " + barsText(S.cur) + ".", "");
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function n(id) { return t.stat(id); }
      function same(a, b) {
        if (a.length !== b.length) return false;
        for (var q = 0; q < a.length; q++) if (a[q] !== b[q]) return false;
        return true;
      }
      function sum(d) { var s = 0; for (var q = 0; q < d.length; q++) s += d[q].p; return s; }
      function entropy(d) { var h = 0; for (var q = 0; q < d.length; q++) if (d[q].p > 0) h -= d[q].p * Math.log(d[q].p); return h; }
      function ps(d) { return d.map(function (e) { return e.p; }); }
      function wsOf(d) { return d.map(function (e) { return e.w; }); }
      async function fresh() { t.click("reset"); await t.run(0.1); }
      var ctxs = allContexts(), i, j, k, ok;

      // 1. The start: mid-answer at AFTER THE, the story's settings, nothing drawn yet.
      await t.run(0.1);
      var s0 = st().cur;
      t.expect(same(st().words, ["after", "the"]) && st().done === false && st().temp === 1 && st().topp === 1 && st().mode === "sample" &&
        st().draws === 0 && n("word") === "-" && n("wordp") === "-" && n("runfire") === "-" && n("nucleus") === 2 && n("exact") === 28.73 &&
        same(wsOf(s0.fin), ["fire", "flood"]) && s0.fin[0].p === 0.65 && s0.fin[1].p === 0.35 && st().drawn.rows === 2 && st().drawn.filled === 2 &&
        t.logText().indexOf("The board has spelled AFTER THE. Next word: FIRE 0.65, FLOOD 0.35.") >= 0,
        "the start: the board has spelled AFTER THE at temperature 1, top-p 1.0, sampling; the bars show FIRE 0.65 and FLOOD 0.35, nucleus 2, exact chance of the fire 28.73%, and no dice drawn yet");

      // 2. The table is the log, and its answers are the six nights' answers.
      ok = ctxs.length === 10;
      for (i = 0; i < ctxs.length; i++) {
        var d2 = tableFor(ctxs[i]);
        if (Math.abs(sum(d2) - 1) > TOL) ok = false;
        if (!TABLE[ctxs[i]] && !(d2.length === 1 && d2[0].w === END && d2[0].p === 1)) ok = false;
      }
      var answers = Object.keys(exactChances(1, 1, false)).sort();
      t.expect(ok && same(ps(tableFor("")), [0.52, 0.45, 0.03]) && same(wsOf(tableFor("")), ["after", "she", "spoons"]) &&
        same(ps(tableFor("after")), [0.85, 0.15]) && same(wsOf(tableFor("after")), ["the", "midnight"]) &&
        same(ps(tableFor("after the")), [0.65, 0.35]) && same(wsOf(tableFor("after the")), ["fire", "flood"]) &&
        same(ps(tableFor("she")), [0.55, 0.45]) && same(wsOf(tableFor("she")), ["retired", "stayed"]) &&
        same(answers, ENDINGS.map(function (e) { return e.key; }).sort()),
        "the table is the log exactly (after 0.52, she 0.45, spoons 0.03; the 0.85, midnight 0.15; fire 0.65, flood 0.35; retired 0.55, stayed 0.45), every one of its 10 contexts adds up to 1, every finished answer goes to GOODBYE at 1, and it can write exactly the six answers of the six nights");

      // 3. Every distribution adds up to 1 after temperature and after top-p, within 1e-9.
      ok = true;
      for (i = 0; i < ctxs.length; i++) {
        for (j = 0; j < TEMPS.length; j++) {
          var tj = temper(tableFor(ctxs[i]), TEMPS[j]);
          if (Math.abs(sum(tj) - 1) > TOL) ok = false;
          for (k = 0; k < TOPPS.length; k++) {
            var nk = nucleusOf(tj, TOPPS[k]).d, fk = shape(ctxs[i], TEMPS[j], TOPPS[k], false).fin, gk = shape(ctxs[i], TEMPS[j], TOPPS[k], true).fin;
            if (Math.abs(sum(nk) - 1) > TOL || Math.abs(sum(fk) - 1) > TOL || Math.abs(sum(gk) - 1) > TOL) ok = false;
            fk.concat(nk).forEach(function (e) { if (e.p < 0) ok = false; });
          }
        }
      }
      t.expect(ok, "for every context, every temperature (0, 0.5, 1, 1.5) and every top-p (1.0, 0.9, 0.5), the chances add up to 1 within 1e-9 after temperature, after top-p, and in greedy mode, and none is negative");

      // 4. Temperature 1 leaves the table alone; at temperature 1 and top-p 1.0 the final chances are the table's.
      ok = true;
      for (i = 0; i < ctxs.length; i++) {
        if (!same(ps(temper(tableFor(ctxs[i]), 1)), ps(tableFor(ctxs[i])))) ok = false;
        if (!same(ps(shape(ctxs[i], 1, 1, false).fin), ps(tableFor(ctxs[i])))) ok = false;
      }
      t.expect(ok, "temperature 1 leaves every one of the table's chances exactly as the log printed it, and with top-p 1.0 nothing is cut or rescaled");

      // 5. Temperature 0 and greedy take the top word, and draw no dice.
      ok = true;
      for (i = 0; i < ctxs.length; i++) {
        var top = argmax(tableFor(ctxs[i]));
        for (k = 0; k < TOPPS.length; k++) {
          var z = shape(ctxs[i], 0, TOPPS[k], false), g5 = shape(ctxs[i], 1.5, TOPPS[k], true);
          if (!z.top || z.fin[top].p !== 1 || z.n !== 1 || !g5.top || g5.fin[top].p !== 1) ok = false;
        }
      }
      await fresh();
      t.set("mode", "greedy");
      t.click("run20");
      var greedyOk = st().batch.counts[FALSE_ENDING] === 20 && st().draws === 0 && n("runfire") === 100 && n("nucleus") === 1 && n("exact") === 100;
      t.click("next");
      greedyOk = greedyOk && n("word") === "FIRE" && n("wordp") === 1 && st().draws === 0;
      t.set("mode", "sample");
      t.set("temp", 0);
      t.click("run20");
      var zeroOk = st().batch.counts[FALSE_ENDING] === 20 && st().draws === 0 && n("exact") === 100;
      t.expect(ok && greedyOk && zeroOk && exactChances(0, 1, false)[FALSE_ENDING] === 1 &&
        t.logText().indexOf("20 runs at temperature 1, top-p 1.0, greedy: the fire 20. 100% ended in the fire") >= 0,
        "temperature 0 and greedy take the top word in every context (after, the, fire, retired, GOODBYE); run 20 times gives AFTER THE FIRE 20 times in 20 both ways, with no dice drawn");

      // 6. A higher temperature never lowers the entropy of any of the story's contexts.
      ok = true;
      for (i = 0; i < ctxs.length; i++) {
        var hs = TEMPS.map(function (T6) { return entropy(temper(tableFor(ctxs[i]), T6)); });
        for (j = 1; j < hs.length; j++) if (hs[j] < hs[j - 1] - 1e-12) ok = false;
        if (tableFor(ctxs[i]).length > 1 && !(hs[0] < hs[1] && hs[1] < hs[2] && hs[2] < hs[3])) ok = false;
      }
      t.expect(ok, "a higher temperature never lowers the entropy of any context (0, 0.5, 1, 1.5 in order), and it strictly raises it wherever there is more than one word to choose");

      // 7. Top-p keeps exactly the smallest prefix of the most likely words that reaches p.
      ok = true;
      for (i = 0; i < ctxs.length; i++) {
        for (j = 1; j < TEMPS.length; j++) {
          var d7 = temper(tableFor(ctxs[i]), TEMPS[j]);
          var sorted = d7.map(function (e, q) { return q; }).sort(function (a, b) { return (d7[b].p - d7[a].p) || (a - b); });
          for (k = 0; k < TOPPS.length; k++) {
            var nu = nucleusOf(d7, TOPPS[k]), kept = 0, before = 0;
            if (!same(nu.keep, sorted.slice(0, nu.n))) ok = false;
            for (var q = 0; q < nu.n; q++) kept += d7[sorted[q]].p;
            for (q = 0; q < nu.n - 1; q++) before += d7[sorted[q]].p;
            if (kept < TOPPS[k] - TOL) ok = false;
            if (nu.n > 1 && before >= TOPPS[k] - TOL) ok = false;
            for (q = 0; q < d7.length; q++) if ((nu.keep.indexOf(q) >= 0) !== (nu.d[q].p > 0)) ok = false;
          }
        }
      }
      var r9 = nucleusOf(tableFor(""), 0.9), r5 = nucleusOf(tableFor(""), 0.5), h9 = nucleusOf(temper(tableFor(""), 1.5), 0.9);
      var allOne = true;
      for (i = 0; i < ctxs.length; i++) if (shape(ctxs[i], 1, 0.5, false).n !== 1) allOne = false;
      t.expect(ok && r9.n === 2 && same(r9.keep, [0, 1]) && f2(0.52 + 0.45) === "0.97" && r9.d[2].p === 0 && r5.n === 1 && r5.keep[0] === 0 &&
        h9.n === 2 && f2(temper(tableFor(""), 1.5)[0].p + temper(tableFor(""), 1.5)[1].p) === "0.93" && allOne,
        "top-p keeps exactly the smallest prefix of the most likely words that reaches p, for every context, temperature and top-p: on the first word, 0.9 keeps AFTER and SHE (0.97) and cuts SPOONS, 0.5 keeps AFTER alone, at temperature 1.5 top-p 0.9 still cuts SPOONS (0.93 without it), and top-p 0.5 at temperature 1 leaves one word at every step");

      // 8. The same dice give the same text.
      await fresh();
      t.click("next");
      var n1 = n("word") === "FIRE" && n("wordp") === 0.65 && st().done === false;
      t.click("next");
      var n2 = n("word") === "GOODBYE" && n("wordp") === 1 && st().done === true && st().words.join(" ") === "after the fire";
      t.click("write");
      var w1 = st().words.join(" ") === "spoons" && st().done === true;
      t.click("write");
      var w2 = st().words.join(" ") === "she retired";
      await fresh();
      t.click("write");
      var again = st().words.join(" ") === "after the fire" && st().draws === 2;
      t.expect(n1 && n2 && w1 && w2 && again && t.logText().indexOf("Wrote to the end: AFTER THE FIRE, then GOODBYE (chances at each draw: 0.65, 1.00).") >= 0,
        "the same dice give the same text: from a reset, Next word draws FIRE at 0.65 and then GOODBYE, Write to the end asks again and spells SPOONS, then SHE RETIRED; after another reset, Write to the end spells AFTER THE FIRE again with the same 2 draws");

      // 9. Run 20 times, right after a reset, gives the story's twenty runs exactly.
      await fresh();
      t.click("run20");
      var b9 = st().batch, need = 0;
      b9.list.forEach(function (a) { need += (a ? a.split(" ").length : 0) + 1; });
      t.expect(b9.counts["after the fire"] === 6 && b9.counts["after the flood"] === 5 && b9.counts["she stayed"] === 4 &&
        b9.counts["she retired"] === 3 && b9.counts["after midnight"] === 1 && b9.counts["spoons"] === 1 && same(b9.list, STORY_RUNS) &&
        st().draws === 70 && need === 70 && n("runfire") === 30 && n("exact") === 28.73 && same(st().words, ["after", "the"]) && st().done === false &&
        t.logText().indexOf("20 runs at temperature 1, top-p 1.0, sample: the fire 6, the flood 5, stayed 4, retired 3, midnight 1, spoons 1. 30% ended in the fire; exact chance 28.73%.") >= 0,
        "run 20 times after a reset matches the story exactly: fire 6, flood 5, she stayed 4, she retired 3, after midnight 1, spoons 1, in the order listed in the header, 70 draws, 30% fire against an exact 28.73%, and the board's own answer is untouched");

      // 10. Every other story number.
      var e1 = exactChances(1, 1, false), e05 = exactChances(0.5, 1, false), e15 = exactChances(1.5, 1, false), e059 = exactChances(0.5, 0.9, false);
      var t05r = temper(tableFor(""), 0.5), t05f = temper(tableFor("after the"), 0.5), t15r = temper(tableFor(""), 1.5);
      var mostLikely = Object.keys(e1).sort(function (a, b) { return e1[b] - e1[a]; })[0];
      var numsOk = Math.abs(e1[FALSE_ENDING] - 0.52 * 0.85 * 0.65) < 1e-12 && pct(e1[FALSE_ENDING]) === "28.73" && pct(e1["she retired"]) === "24.75" &&
        mostLikely === FALSE_ENDING && pct(e05[FALSE_ENDING]) === "42.91" && pct(e15[FALSE_ENDING]) === "22.25" && pct(e059[FALSE_ENDING]) === "44.33" &&
        pct(e05.spoons) === "0.19" && pct(e1.spoons) === "3.00" && pct(e15.spoons) === "7.26" &&
        f2(t05r[0].p) === "0.57" && f2(t05f[0].p) === "0.78" && f2(t15r[2].p) === "0.07" && f2(tableFor("")[2].p) === "0.03";
      await fresh();
      t.set("temp", 0.5);
      t.set("topp", 0.9);
      t.click("run20");
      var c10 = st().batch.counts;
      var warnOk = c10["after the fire"] === 10 && c10["she stayed"] === 4 && c10["after the flood"] === 3 && c10["she retired"] === 3 &&
        c10["after midnight"] === 0 && c10.spoons === 0 && n("runfire") === 50 && n("exact") === 44.33;
      t.expect(numsOk && warnOk,
        "story numbers: exact fire 0.52 x 0.85 x 0.65 = 28.73%, the likeliest whole answer, ahead of she retired 24.75%; 42.91% at temperature 0.5, 22.25% at 1.5, 44.33% at 0.5 with top-p 0.9; spoons 0.19%, 3.00%, 7.26%; at 0.5 AFTER 0.57 and FIRE 0.78, at 1.5 SPOONS 0.07; and temperature 0.5 with top-p 0.9 after a reset runs fire 10, stayed 4, flood 3, retired 3, no midnight, no spoons");

      // 11. The bars and the controls: the first word after an answer ends, temperature 1.5, top-p 0.9, top-p 0.5.
      await fresh();
      t.click("write");
      var firstOk = st().done === true && st().drawn.rows === 3 && n("nucleus") === 3 && st().cur.ctx === "";
      t.set("temp", 1.5);
      var hotOk = f2(st().cur.fin[2].p) === "0.07" && n("nucleus") === 3 && n("exact") === 22.25;
      t.set("topp", 0.9);
      var cutOk = st().cur.fin[2].p === 0 && n("nucleus") === 2 && st().drawn.cut === 1 && n("exact") === 23.99;
      t.set("temp", 1);
      t.set("topp", 0.5);
      var halfOk = n("nucleus") === 1 && n("exact") === 100 && st().drawn.cut === 2;
      t.expect(firstOk && hotOk && cutOk && halfOk && t.logText().indexOf("Top-p 0.5. First word now: AFTER 1.00, SHE cut, SPOONS cut.") >= 0,
        "the bars: once an answer ends they show the first word (3 words, nucleus 3); temperature 1.5 lifts SPOONS to 0.07; top-p 0.9 cuts it again (nucleus 2); at temperature 1, top-p 0.5 keeps AFTER alone and the fire becomes certain");

      // 12. Reset returns to the start.
      t.click("reset");
      await t.run(0.1);
      t.expect(same(st().words, ["after", "the"]) && st().done === false && st().temp === 1 && st().topp === 1 && st().mode === "sample" &&
        st().batch === null && st().draws === 0 && n("nucleus") === 2 && n("exact") === 28.73 && n("word") === "-" && n("runfire") === "-",
        "reset returns to AFTER THE at temperature 1, top-p 1.0, sampling, with no runs and no dice drawn");
    }
  });
})();
