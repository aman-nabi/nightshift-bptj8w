/* sims/a1e04-v1.0.0.js  (published as sims/a1e04.js)
   Case a1e04 "Things That Mean the Same": a scent-shelf lab built from Honorine Vasseur's twelve index cards.

   CHANGELOG
   v1.0.0 (2026-10-07) first version: a widget-style sim built inside api.root (no diagram), copying the
     a1e03 template, with one inline SVG drawing in the a1e02 style (theme classes only). Every card is a
     vector of six scores, one per note. The drawing shows every card as an arrow from zero on two notes
     you choose (the query's arrow thick, the compared bottle's dashed), the two cards are read out note
     by note, and a table ranks the other eleven bottles by the chosen measure. Controls: query bottle,
     bottle to compare, rank by (cosine similarity or straight-line distance), normalize to length 1,
     the drawing's two notes, check every pair at 0.99, reset. Stats (always over all six notes):
     cosine similarity, angle in degrees, dot product, straight-line distance, the compared bottle's
     rank of 11, both lengths. selfTest covers the start, the cards themselves, a vector with itself, a
     scaled copy, two cards with no note in common, normalized rankings, the dot product of normalized
     vectors, the story's nearest-neighbour lists, every story number, the drawing, and the controls.

   Where every number comes from (conventions rule 14; the case is content/latent/a1/a1e04-v1.0.0.json):
   - post: twelve cards typed in so far (BOTTLES), six notes scored 0 to 10 (NOTES, MAX_SCORE), in the
     order citrus, wood, flower, smoke, sweet, musk. Bottle 47, Blue Hour, opened: 2 1 3 0 1 1. Bottle
     212, no name, sealed: 6 3 9 0 3 3. The clean-up line is 0.99 (CLEANUP_LINE). The log block, query
     47 by cosine: 1 212 1.00, 2 177 Rose Parlour 0.96 (0.9643), 3 129 Linen Water 0.87 (0.8660);
     clean-up at 0.99: 1 pair, 47 and 212 (66 pairs checked). By straight-line distance 212 is last,
     8.00, eleventh of eleven, and Linen Water first (2.65). The evidence diagram repeats the two cards,
     cosine 1.00 rank 1 of 11 and distance 8.00 rank 11 of 11.
   - comments: 212 divided by 47, note by note, is 3 every time; lengths 12 and 4 (both exact: 144 and
     16 are perfect squares), so the two arrows lie on one line.
   - reply part 2s: lengths 4 and 12, 8.00 apart; normalized, cosine 1.00, dot product 1.00, distance
     0.00; with 212 gone, 47's nearest by cosine is Rose Parlour at 0.96; by distance Linen Water
     comes first and 212 last, past Chapel Smoke (61, tenth at 7.07).
   - explanation: 47's squares add to 16 (length 4), 212's to 144 (length 12); dot product
     2x6 + 1x3 + 3x9 + 0x0 + 1x3 + 1x3 = 48, and 48 / (4 x 12) = 1.00 exactly; Orchard Gate (18) and
     Ash Letter (150) share no note: dot product 0, cosine 0, a right angle (90.0 degrees); the
     differences between 47 and 212 are 4, 2, 6, 0, 2, 2, squares adding to 64, distance 8.00 exactly;
     Linen Water has length 1.73, is 2.65 from 47 and 30.0 degrees from it (cosine 0.8660, exactly
     the square root of 3 over 2); normalized, 47 and 212 both become 0.5 0.25 0.75 0 0.25 0.25.
   - trade-off table: for query 47 the dot product is highest with 212 (48) and joint lowest, 6, with
     Linen Water (129) and Ash Letter (150).
   - the full lists for query 47, checked in selfTest. By cosine: 212 1.00, 177 0.96, 129 0.87,
     90 0.84, 18 0.65, 104 0.54, 188 0.53, 240 0.46, 75 0.37, 61 0.28, 150 0.22. By distance: 129 2.65,
     177 3.32, 90 4.90, 188 5.29, 240 5.83, 18 5.92, 104 6.24 (the square root of 39, 6.2450 to four
     places but 6.24 to two), 75 6.40, 150 7.00, 61 7.07, 212 8.00.
   - the clock starts at twenty past midnight, as sim.lede says.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the whole widget inside api.root on every reset. No step() is needed
     because nothing animates; every number is worked out the moment a control changes.
   - The six named notes are a teaching simplification. Real embeddings have hundreds or thousands of
     numbers with no names; the lede and the info panel say so.
   - Scores are never negative, so every cosine here lies between 0 and 1 (a selfTest checks it). Real
     embeddings contain negative numbers, so theirs run from -1 to 1.
   - 212 is exactly 3 x 47, so 47 and 212 have exactly the same cosine against any other query.
     Rankings break ties (values within EPS) by card order, so 47 always comes before 212, and the
     ranking is deterministic. Apart from that pair, no two cosines or distances in any query's list
     are within 0.002 of each other.
   - The cards were chosen (and checked) so that: 47's cosine list starts 212, 177, 129; its distance
     list starts 129, 177 and ends with 212; no pair other than 47 and 212 reaches a cosine of 0.975;
     and 18 and 150 are the only pair with no note in common.
   - No api.rand() anywhere: every card is fixed.
   - Stats get bare numbers (units live in the labels), so t.stat() returns numbers, except the rank,
     which reads "-" when a bottle is compared with itself.
   - Colors come only from theme classes: dg, dg-axis, dg-note, dg-edge with tone-accent, tone-ok and
     tone-muted, dot, dot-accent, dot-ok, chip ok, muted, small. In LATENT views tone-accent turns
     cyan, so the text names arrows by their shape (thick, dashed, thin), never a color.
*/
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- the story's numbers ---------- */

  var NOTES = ["citrus", "wood", "flower", "smoke", "sweet", "musk"];
  var MAX_SCORE = 10;

  // Honorine's twelve cards, in the order Juno typed them in. v holds the six scores, in NOTES order.
  var BOTTLES = [
    { id: "47", name: "Blue Hour", status: "opened", v: [2, 1, 3, 0, 1, 1] },
    { id: "212", name: "no name", status: "sealed", v: [6, 3, 9, 0, 3, 3] },
    { id: "18", name: "Orchard Gate", status: "", v: [7, 0, 1, 0, 3, 0] },
    { id: "61", name: "Chapel Smoke", status: "", v: [0, 3, 1, 6, 0, 2] },
    { id: "75", name: "Cellar Cedar", status: "", v: [1, 6, 0, 2, 0, 2] },
    { id: "90", name: "Night Garden", status: "", v: [0, 1, 7, 0, 1, 3] },
    { id: "104", name: "Honey Lantern", status: "", v: [1, 0, 2, 0, 7, 1] },
    { id: "129", name: "Linen Water", status: "", v: [1, 0, 1, 0, 0, 1] },
    { id: "150", name: "Ash Letter", status: "", v: [0, 2, 0, 5, 0, 4] },
    { id: "177", name: "Rose Parlour", status: "", v: [2, 1, 6, 0, 2, 2] },
    { id: "188", name: "Bitter Peel", status: "", v: [6, 1, 0, 1, 0, 0] },
    { id: "240", name: "Musk Glove", status: "", v: [0, 1, 1, 0, 2, 6] }
  ];

  var START_QUERY = "47";
  var START_COMPARE = "212";
  var START_X = "citrus";
  var START_Y = "flower";
  var CLEANUP_LINE = 0.99;              // Lucien's clean-up: a pair at or above this cosine is "the same"
  var START_CLOCK = 20 * 60;            // twenty past midnight in the archive
  var EPS = 1e-9;                       // values closer than this count as a tie in a ranking

  var MEASURES = [
    { value: "cos", label: "cosine similarity (angle)", name: "cosine similarity" },
    { value: "dist", label: "straight-line distance (gap)", name: "straight-line distance" }
  ];

  /* ---------- vectors ---------- */

  function dot(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  function len(a) { return Math.sqrt(dot(a, a)); }

  function cosine(a, b) {
    var d = len(a) * len(b);
    return d > 0 ? dot(a, b) / d : 0;
  }

  function distance(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) {
      var d = a[i] - b[i];
      s += d * d;
    }
    return Math.sqrt(s);
  }

  function normalize(a) {
    var l = len(a), out = [];
    for (var i = 0; i < a.length; i++) out.push(l > 0 ? a[i] / l : 0);
    return out;
  }

  function scale(a, k) {
    var out = [];
    for (var i = 0; i < a.length; i++) out.push(a[i] * k);
    return out;
  }

  function angleDeg(c) { return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI; }

  function bottle(id) {
    for (var i = 0; i < BOTTLES.length; i++) if (BOTTLES[i].id === String(id)) return BOTTLES[i];
    return BOTTLES[0];
  }

  function vec(b, norm) { return norm ? normalize(b.v) : b.v.slice(); }

  function label(b) { return b.id + " " + b.name + (b.status ? " (" + b.status + ")" : ""); }
  function shortLabel(b) { return b.id + " " + b.name; }

  function measureBy(value) {
    for (var i = 0; i < MEASURES.length; i++) if (MEASURES[i].value === value) return MEASURES[i];
    return MEASURES[0];
  }

  // The other eleven bottles, best first: highest cosine, or smallest distance. Ties go by card order.
  function ranking(qid, measure, norm) {
    var q = vec(bottle(qid), norm), rows = [];
    for (var i = 0; i < BOTTLES.length; i++) {
      var b = BOTTLES[i];
      if (b.id === String(qid)) continue;
      var v = vec(b, norm);
      rows.push({ id: b.id, idx: i, b: b, cos: cosine(q, v), dist: distance(q, v), dot: dot(q, v), len: len(v) });
    }
    rows.sort(function (x, y) {
      var a = measure === "dist" ? x.dist : -x.cos, c = measure === "dist" ? y.dist : -y.cos;
      if (Math.abs(a - c) > EPS) return a - c;
      return x.idx - y.idx;
    });
    return rows;
  }

  function ids(rows) { return rows.map(function (r) { return r.id; }); }

  // The compared bottle's place among the query's eleven neighbours, or 0 when it is the query itself.
  function rankOf(qid, cid, measure, norm) {
    if (String(qid) === String(cid)) return 0;
    var rows = ranking(qid, measure, norm);
    for (var i = 0; i < rows.length; i++) if (rows[i].id === String(cid)) return i + 1;
    return 0;
  }

  // Every pair of cards whose cosine reaches the line. Cosine ignores length, so normalizing changes nothing.
  function pairsAtLeast(line) {
    var out = [], checked = 0;
    for (var i = 0; i < BOTTLES.length; i++) {
      for (var j = i + 1; j < BOTTLES.length; j++) {
        checked += 1;
        var c = cosine(BOTTLES[i].v, BOTTLES[j].v);
        if (c >= line) out.push({ a: BOTTLES[i], b: BOTTLES[j], c: c });
      }
    }
    return { pairs: out, checked: checked };
  }

  function compareNow(S) {
    var qb = bottle(S.query), cb = bottle(S.compare), q = vec(qb, S.norm), c = vec(cb, S.norm);
    var cs = cosine(q, c);
    return {
      qb: qb, cb: cb, q: q, c: c, cos: cs, angle: angleDeg(cs), dot: dot(q, c), dist: distance(q, c),
      lq: len(q), lc: len(c), rank: rankOf(S.query, S.compare, S.measure, S.norm),
      rows: ranking(S.query, S.measure, S.norm)
    };
  }

  /* ---------- formatting ---------- */

  function f2(v) { return isFinite(v) ? v.toFixed(2) : "-"; }
  function f1(v) { return isFinite(v) ? v.toFixed(1) : "-"; }
  // Raw scores and raw dot products are whole numbers; normalized ones get two decimals.
  function num(v, norm) { return !norm && v % 1 === 0 ? String(v) : f2(v); }

  /* ---------- the drawing ---------- */

  var OX = 56, OY = 262, PLOT = 220;    // the origin, and the pixels for a score of 10 (or a length of 1)
  var SIDE_X = 352;                     // left edge of the readout beside the drawing

  function px(value, norm) { return value * (norm ? PLOT : PLOT / MAX_SCORE); }

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
      "Honorine's twelve cards as vectors: six scores from 0 to 10, one per note. Six named notes are a teaching simplification; " +
      "real embeddings have hundreds or thousands of numbers that nobody can name."));

    box.appendChild(head("The two cards"));
    var qLine = el("p", "", "margin:0;font-size:12.5px;overflow-wrap:anywhere;", "");
    var cLine = el("p", "", "margin:0;font-size:12.5px;overflow-wrap:anywhere;", "");
    box.appendChild(qLine);
    box.appendChild(cLine);

    box.appendChild(head("Arrows on two of the six notes"));
    var svg = mk(doc, "svg", {
      viewBox: "0 0 680 300", width: "100%", "class": "dg", role: "img",
      "aria-label": "Every card drawn as an arrow from zero on the two chosen notes. The query's arrow is thick, the compared bottle's is dashed, the rest are thin. The readout on the right gives the cosine, angle, distance, dot product and lengths over all six notes."
    });
    var axes = mk(doc, "g", {}, svg);
    var arrows = mk(doc, "g", {}, svg);
    var tips = mk(doc, "g", {}, svg);
    var marks = mk(doc, "g", {}, svg);
    var side = mk(doc, "g", {}, svg);
    box.appendChild(svg);

    var rankHead = head("");
    box.appendChild(rankHead);
    var table = el("table", "", "width:100%;", "");
    var thead = el("thead", "", "", "");
    var hr = el("tr", "", "", "");
    ["rank", "bottle", "cosine", "distance", "dot product", "length"].forEach(function (h) { hr.appendChild(el("th", "", "", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody", "", "", "");
    table.appendChild(tbody);
    box.appendChild(table);

    api.root.appendChild(box);
    return { doc: doc, el: el, qLine: qLine, cLine: cLine, svg: svg, axes: axes, arrows: arrows, tips: tips,
      marks: marks, side: side, rankHead: rankHead, tbody: tbody };
  }

  function cardText(b, v, norm, role) {
    var parts = [];
    for (var i = 0; i < NOTES.length; i++) parts.push(NOTES[i] + " " + num(v[i], norm));
    return role + " " + label(b) + ": " + parts.join(" · ") + " · length " + f2(len(v)) + (norm ? " (normalized)" : "");
  }

  function drawCards(S) {
    var cur = S.cur;
    S.ui.qLine.textContent = cardText(cur.qb, cur.q, S.norm, "Query");
    S.ui.cLine.textContent = cardText(cur.cb, cur.c, S.norm, "Compared");
  }

  function drawAxes(S) {
    var ui = S.ui, doc = ui.doc, g = ui.axes, norm = S.norm;
    clear(g);
    mk(doc, "line", { x1: OX, y1: OY, x2: OX + PLOT + 12, y2: OY, "class": "dg-axis" }, g);
    mk(doc, "line", { x1: OX, y1: OY, x2: OX, y2: OY - PLOT - 12, "class": "dg-axis" }, g);
    var ticks = norm ? [[0.5, "0.5"], [1, "1"]] : [[5, "5"], [10, "10"]];
    txt(doc, g, OX - 6, OY + 16, "0", "dg-axis", "end");
    for (var i = 0; i < ticks.length; i++) {
      var d = px(ticks[i][0], norm);
      mk(doc, "line", { x1: OX + d, y1: OY, x2: OX + d, y2: OY + 4, "class": "dg-axis" }, g);
      txt(doc, g, OX + d, OY + 16, ticks[i][1], "dg-axis", "middle");
      mk(doc, "line", { x1: OX - 4, y1: OY - d, x2: OX, y2: OY - d, "class": "dg-axis" }, g);
      txt(doc, g, OX - 8, OY - d + 4, ticks[i][1], "dg-axis", "end");
    }
    txt(doc, g, OX + PLOT / 2, OY + 32, S.xn + " (across)", "dg-axis", "middle");
    txt(doc, g, OX, 22, S.yn + " (up)", "dg-axis", "middle");
    if (norm) {
      mk(doc, "path", {
        d: "M " + (OX + PLOT) + " " + OY + " A " + PLOT + " " + PLOT + " 0 0 0 " + OX + " " + (OY - PLOT),
        "class": "dg-axis", "stroke-dasharray": "4 4"
      }, g);
    }
  }

  function drawArrows(S) {
    var ui = S.ui, doc = ui.doc, norm = S.norm;
    var xi = NOTES.indexOf(S.xn), yi = NOTES.indexOf(S.yn);
    clear(ui.arrows);
    clear(ui.tips);
    clear(ui.marks);
    var drawn = { arrows: 0, tips: {}, hidden: [] }, groups = {}, order = [];

    function tipOf(b) {
      var v = vec(b, norm);
      return [OX + px(v[xi], norm), OY - px(v[yi], norm)];
    }

    // Thin arrows first, then the compared bottle (dashed), then the query (thick) on top.
    var list = [];
    for (var i = 0; i < BOTTLES.length; i++) {
      var b = BOTTLES[i];
      if (b.id !== S.query && b.id !== S.compare) list.push({ b: b, kind: "rest" });
    }
    if (S.compare !== S.query) list.push({ b: bottle(S.compare), kind: "compare" });
    list.push({ b: bottle(S.query), kind: "query" });

    for (var k = 0; k < list.length; k++) {
      var item = list[k], t = tipOf(item.b);
      if (t[0] === OX && t[1] === OY) {
        drawn.hidden.push(item.b.id);
        continue;
      }
      drawn.arrows += 1;
      drawn.tips[item.b.id] = t;
      var cls = "dg-edge tone-muted", style = "stroke-width:1.2", dash = null, dotCls = "dot", r = 3;
      if (item.kind === "compare") { cls = "dg-edge tone-ok"; style = "stroke-width:2"; dash = "6 4"; dotCls = "dot dot-ok"; r = 4; }
      if (item.kind === "query") { cls = "dg-edge tone-accent"; style = "stroke-width:3;stroke-linecap:round"; dotCls = "dot dot-accent"; r = 5; }
      mk(doc, "line", { x1: OX, y1: OY, x2: c1(t[0]), y2: c1(t[1]), "class": cls, style: style, "stroke-dasharray": dash }, ui.arrows);
      mk(doc, "circle", { cx: c1(t[0]), cy: c1(t[1]), r: r, "class": dotCls }, ui.tips);
      var key = Math.round(t[0]) + "," + Math.round(t[1]);
      if (!groups[key]) {
        groups[key] = { x: t[0], y: t[1], ids: [], strong: false };
        order.push(key);
      }
      groups[key].ids.push(item.b.id);
      if (item.kind !== "rest") groups[key].strong = true;
    }

    // One label per tip position, so bottles that land on the same point share a label.
    for (var m = 0; m < order.length; m++) {
      var gp = groups[order[m]];
      var sorted = gp.ids.slice().sort(function (a, c) { return BOTTLES.indexOf(bottle(a)) - BOTTLES.indexOf(bottle(c)); });
      txt(doc, ui.marks, c1(gp.x + 6), c1(gp.y - 6), sorted.join(", "), gp.strong ? "dg-note" : "dg-axis", "start");
    }
    S.drawn = drawn;
  }

  function drawSide(S) {
    var ui = S.ui, doc = ui.doc, g = ui.side, cur = S.cur, norm = S.norm;
    var xi = NOTES.indexOf(S.xn), yi = NOTES.indexOf(S.yn);
    clear(g);
    var lines = [
      ["Drawn: " + S.xn + " across, " + S.yn + " up", "dg-note"],
      ["(2 of the 6 notes)", "dg-axis"],
      ["Query " + cur.qb.id + ": " + S.xn + " " + num(cur.q[xi], norm) + ", " + S.yn + " " + num(cur.q[yi], norm), "dg-axis"],
      ["Compared " + cur.cb.id + ": " + S.xn + " " + num(cur.c[xi], norm) + ", " + S.yn + " " + num(cur.c[yi], norm), "dg-axis"],
      ["All six notes" + (norm ? ", normalized:" : ":"), "dg-note"],
      ["cosine " + f2(cur.cos) + ", angle " + f1(cur.angle) + " degrees", "dg-axis"],
      ["distance " + f2(cur.dist) + ", dot product " + num(cur.dot, norm), "dg-axis"],
      ["lengths " + f2(cur.lq) + " and " + f2(cur.lc), "dg-axis"],
      ["The drawn angle uses 2 notes;", "dg-axis"],
      ["the true angle uses all 6.", "dg-axis"],
      ["Thick: query. Dashed: compared.", "dg-axis"],
      ["Thin: the rest.", "dg-axis"]
    ];
    if (norm) lines.push(["Arc: length 1. Arrows stop short of it", "dg-axis"], ["by what the other 4 notes hold.", "dg-axis"]);
    if (S.drawn.hidden.length) lines.push(["Not drawn, 0 on both notes: " + S.drawn.hidden.join(", "), "dg-axis"]);
    // At most 15 lines: the last sits at y = 30 + 14 x 16 + 4 x 6 = 278, inside the 300-high drawing.
    var y = 30;
    for (var i = 0; i < lines.length; i++) {
      if (i === 4 || i === 8 || i === 10 || i === 12) y += 6;
      txt(doc, g, SIDE_X, y, lines[i][0], lines[i][1], "start");
      y += 16;
    }
  }

  function drawTable(S) {
    var ui = S.ui, el = ui.el, cur = S.cur, norm = S.norm, rows = cur.rows;
    ui.rankHead.textContent = "Query " + label(cur.qb) + ": the other eleven, ranked by " + measureBy(S.measure).name +
      (norm ? ", normalized" : "");
    clear(ui.tbody);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], tr = el("tr", "", "", "");
      tr.appendChild(el("td", "", "", String(i + 1)));
      var name = el("td", "", "", "");
      if (r.id === S.compare) name.appendChild(el("span", "chip ok", "", label(r.b)));
      else name.textContent = label(r.b);
      tr.appendChild(name);
      tr.appendChild(el("td", "", "", f2(r.cos)));
      tr.appendChild(el("td", "", "", f2(r.dist)));
      tr.appendChild(el("td", "", "", num(r.dot, norm)));
      tr.appendChild(el("td", "", "", f2(r.len)));
      ui.tbody.appendChild(tr);
    }
  }

  function drawStats(S) {
    var cur = S.cur;
    S.stat.cos(f2(cur.cos));
    S.stat.angle(f1(cur.angle));
    S.stat.dot(num(cur.dot, S.norm));
    S.stat.dist(f2(cur.dist));
    S.stat.rank(cur.rank ? cur.rank : "-");
    S.stat.lenq(f2(cur.lq));
    S.stat.lenc(f2(cur.lc));
  }

  function draw(api) {
    var S = api.state;
    S.cur = compareNow(S);
    drawCards(S);
    drawAxes(S);
    drawArrows(S);
    drawSide(S);
    drawTable(S);
    drawStats(S);
  }

  /* ---------- narration ---------- */

  function pairLine(S) {
    var cur = S.cur;
    var rank = cur.rank ? "Rank " + cur.rank + " of 11 by " + measureBy(S.measure).name + "." : "That is the query itself.";
    return shortLabel(cur.qb) + " against " + shortLabel(cur.cb) + (S.norm ? ", normalized" : "") + ": cosine " + f2(cur.cos) +
      " (angle " + f1(cur.angle) + " degrees), distance " + f2(cur.dist) + ", dot product " + num(cur.dot, S.norm) +
      ", lengths " + f2(cur.lq) + " and " + f2(cur.lc) + ". " + rank;
  }

  function logPair(api) {
    var S = api.state;
    api.log(pairLine(S), S.cur.cos >= CLEANUP_LINE && S.query !== S.compare ? "bad" : "");
  }

  function logMeasure(api) {
    var S = api.state, rows = S.cur.rows, m = measureBy(S.measure), first = rows[0], last = rows[rows.length - 1];
    function val(r) { return S.measure === "dist" ? f2(r.dist) : f2(r.cos); }
    var tail = S.cur.rank ? " " + S.cur.cb.id + " is " + S.cur.rank + " of 11." : "";
    api.log("Ranked by " + m.name + (S.norm ? ", normalized" : "") + " for " + S.cur.qb.id + ": first " + shortLabel(first.b) +
      " at " + val(first) + ", last " + shortLabel(last.b) + " at " + val(last) + "." + tail, S.measure === "dist" ? "warn" : "");
  }

  function logNorm(api) {
    var S = api.state, cur = S.cur;
    if (S.norm) {
      var agree = ids(ranking(S.query, "dist", true)).join(",") === ids(ranking(S.query, "cos", true)).join(",");
      api.log("Normalized: every arrow has length 1. " + cur.qb.id + " against " + cur.cb.id + ": distance " + f2(cur.dist) +
        ", dot product " + f2(cur.dot) + ", the same as the cosine " + f2(cur.cos) + ". Ranking by distance now gives " +
        (agree ? "the same order as cosine." : "a different order from cosine."), "ok");
    } else {
      api.log("Raw cards again: lengths " + f2(cur.lq) + " and " + f2(cur.lc) + ", distance " + f2(cur.dist) +
        ", dot product " + num(cur.dot, false) + ".", "");
    }
  }

  function logAxes(api) {
    var S = api.state, hidden = S.drawn.hidden.map(function (id) { return shortLabel(bottle(id)); });
    api.log("Drawing " + S.xn + " across and " + S.yn + " up: 2 of the 6 notes." +
      (hidden.length ? " Not drawn, at zero on both: " + hidden.join(", ") + "." : ""), "");
  }

  function checkPairs(api) {
    var res = pairsAtLeast(CLEANUP_LINE), parts = [];
    for (var i = 0; i < res.pairs.length; i++) {
      var p = res.pairs[i];
      parts.push(shortLabel(p.a) + " and " + shortLabel(p.b) + ", cosine " + f2(p.c));
    }
    api.log("Every pair of the " + BOTTLES.length + " cards at " + CLEANUP_LINE.toFixed(2) + " or above: " +
      (parts.length ? parts.join("; ") : "none") + ". " + res.pairs.length + " pair" + (res.pairs.length === 1 ? "" : "s") +
      " of " + res.checked + ".", res.pairs.length ? "bad" : "ok");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a1e04", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.query = START_QUERY;
      S.compare = START_COMPARE;
      S.measure = "cos";
      S.norm = false;
      S.xn = START_X;
      S.yn = START_Y;
      S.ui = buildWidget(api);

      var bottleOpts = BOTTLES.map(function (b) { return { value: b.id, label: label(b) }; });
      var noteOpts = NOTES.map(function (n) { return { value: n, label: n }; });

      S.ctl = {};
      S.ctl.query = api.control.select("query", "Query bottle", bottleOpts, START_QUERY,
        function (v) { S.query = String(v); draw(api); logPair(api); });
      S.ctl.compare = api.control.select("compare", "Compare with", bottleOpts, START_COMPARE,
        function (v) { S.compare = String(v); draw(api); logPair(api); });
      S.ctl.measure = api.control.select("measure", "Rank by", MEASURES.map(function (m) { return { value: m.value, label: m.label }; }), "cos",
        function (v) { S.measure = measureBy(v).value; draw(api); logMeasure(api); });
      S.ctl.norm = api.control.toggle("norm", "Normalize to length 1", false,
        function (on) { S.norm = !!on; draw(api); logNorm(api); });
      S.ctl.xnote = api.control.select("xnote", "Drawing: note across", noteOpts, START_X,
        function (v) { S.xn = NOTES.indexOf(v) >= 0 ? v : START_X; draw(api); logAxes(api); });
      S.ctl.ynote = api.control.select("ynote", "Drawing: note up", noteOpts, START_Y,
        function (v) { S.yn = NOTES.indexOf(v) >= 0 ? v : START_Y; draw(api); logAxes(api); });
      S.ctl.pairs = api.control.button("pairs", "Check every pair at 0.99", function () { checkPairs(api); }, { tone: "primary" });
      S.ctl.reset = api.control.button("reset", "Reset to 47 and 212", function () { api.reset(); });

      S.stat = {
        cos: api.stat("cos", "cosine similarity", "warn"),
        angle: api.stat("angle", "angle (degrees)", ""),
        dot: api.stat("dot", "dot product", ""),
        dist: api.stat("dist", "straight-line distance", "warn"),
        rank: api.stat("rank", "compared bottle's rank (of 11)", "bad"),
        lenq: api.stat("lenq", "query length", ""),
        lenc: api.stat("lenc", "compared length", "")
      };

      api.info("<strong>How to read it.</strong> Each card is an arrow from zero. The drawing shows two of the six notes at a time; " +
        "the stats and the table always use all six. The thick arrow is the query, the dashed arrow the compared bottle, the thin ones the rest. " +
        "Six labelled notes are a teaching simplification: real embeddings have hundreds or thousands of numbers with no names. " +
        "Honorine's scores never go below 0, so every cosine here lies between 0 and 1.");
      draw(api);
      api.log("Twenty past midnight. Twelve cards typed in. " + pairLine(S), "");
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function n(id) { return Number(t.stat(id)); }
      function same(a, b) {
        if (a.length !== b.length) return false;
        for (var q = 0; q < a.length; q++) if (a[q] !== b[q]) return false;
        return true;
      }
      var V = {}, i, j, k, ok;
      for (i = 0; i < BOTTLES.length; i++) V[BOTTLES[i].id] = BOTTLES[i].v;

      // 1. The start: 47 against 212, by cosine, raw cards.
      await t.run(1);
      t.expect(st().query === "47" && st().compare === "212" && st().measure === "cos" && st().norm === false &&
        n("cos") === 1 && n("angle") === 0 && n("dot") === 48 && n("dist") === 8 && n("rank") === 1 && n("lenq") === 4 && n("lenc") === 12 &&
        t.logText().indexOf("cosine 1.00 (angle 0.0 degrees), distance 8.00, dot product 48, lengths 4.00 and 12.00. Rank 1 of 11 by cosine similarity.") >= 0,
        "the start compares 47 with 212: cosine 1.00, angle 0.0 degrees, dot product 48, distance 8.00, rank 1 of 11 by cosine, lengths 4.00 and 12.00, all in the log");

      // 2. The cards: twelve, six notes each, whole scores from 0 to 10, and 212 exactly three times 47.
      ok = BOTTLES.length === 12 && NOTES.length === 6;
      for (i = 0; i < BOTTLES.length; i++) {
        if (BOTTLES[i].v.length !== 6) ok = false;
        for (k = 0; k < 6; k++) {
          var x = BOTTLES[i].v[k];
          if (x !== Math.round(x) || x < 0 || x > MAX_SCORE) ok = false;
        }
      }
      for (k = 0; k < 6; k++) if (V["212"][k] !== 3 * V["47"][k]) ok = false;
      t.expect(ok && len(V["47"]) === 4 && len(V["212"]) === 12 && dot(V["47"], V["212"]) === 48 &&
        cosine(V["47"], V["212"]) === 1 && distance(V["47"], V["212"]) === 8,
        "twelve cards of six whole scores from 0 to 10; 212 is exactly three times 47 on every note; lengths exactly 4 and 12, dot product exactly 48, cosine exactly 1, distance exactly 8");

      // 3. A vector against itself: cosine 1, distance 0.
      ok = true;
      for (i = 0; i < BOTTLES.length; i++) {
        var v0 = BOTTLES[i].v;
        if (Math.abs(cosine(v0, v0) - 1) > 1e-12 || distance(v0, v0) !== 0 || rankOf(BOTTLES[i].id, BOTTLES[i].id, "cos", false) !== 0) ok = false;
      }
      t.expect(ok, "every card's cosine with itself is 1 and its distance to itself is 0, and a bottle compared with itself has no rank");

      // 4. A scaled copy: same direction, so cosine 1, but a distance above 0 that grows with the scale.
      ok = true;
      [0.5, 2.5, 3].forEach(function (f) {
        for (var a = 0; a < BOTTLES.length; a++) {
          var v1 = BOTTLES[a].v, s1 = scale(v1, f), d1 = distance(v1, s1);
          if (Math.abs(cosine(v1, s1) - 1) > 1e-12 || !(d1 > 0) || Math.abs(d1 - Math.abs(f - 1) * len(v1)) > 1e-9) ok = false;
        }
      });
      t.expect(ok, "every card scaled by 0.5, 2.5 or 3 keeps cosine 1 with the original but sits a distance above 0 away, exactly the scale's difference from 1 times its length");

      // 5. No note in common: dot product 0 and cosine 0. All cosines lie between 0 and 1.
      var disjoint = [];
      ok = true;
      for (i = 0; i < BOTTLES.length; i++) {
        for (j = i + 1; j < BOTTLES.length; j++) {
          var a5 = BOTTLES[i].v, b5 = BOTTLES[j].v, shared = false, c5 = cosine(a5, b5);
          for (k = 0; k < 6; k++) if (a5[k] > 0 && b5[k] > 0) shared = true;
          if (c5 < 0 || c5 > 1 + 1e-12) ok = false;
          if (!shared) {
            disjoint.push(BOTTLES[i].id + "-" + BOTTLES[j].id);
            if (dot(a5, b5) !== 0 || c5 !== 0) ok = false;
          }
        }
      }
      t.expect(ok && same(disjoint, ["18-150"]) && dot(V["18"], V["150"]) === 0 && cosine(V["18"], V["150"]) === 0 &&
        f1(angleDeg(cosine(V["18"], V["150"]))) === "90.0",
        "two cards with no note in common have dot product 0 and cosine 0, a right angle: Orchard Gate (18) and Ash Letter (150) are the only such pair, and every cosine lies between 0 and 1");

      // 6. After normalizing, ranking by distance matches ranking by cosine, for every query; on raw cards it doesn't for 47.
      ok = true;
      for (i = 0; i < BOTTLES.length; i++) {
        var qid = BOTTLES[i].id;
        if (!same(ids(ranking(qid, "dist", true)), ids(ranking(qid, "cos", false)))) ok = false;
        if (!same(ids(ranking(qid, "cos", true)), ids(ranking(qid, "cos", false)))) ok = false;
        for (j = 0; j < BOTTLES.length; j++) {
          var d6 = distance(normalize(BOTTLES[i].v), normalize(BOTTLES[j].v));
          if (Math.abs(d6 * d6 - (2 - 2 * cosine(BOTTLES[i].v, BOTTLES[j].v))) > 1e-12) ok = false;
        }
      }
      t.expect(ok && !same(ids(ranking("47", "dist", false)), ids(ranking("47", "cos", false))) && rankOf("47", "212", "dist", true) === 1,
        "after normalizing, every query's ranking by distance matches its ranking by cosine, distance squared is 2 minus 2 times the cosine for every pair, and 212 is back to rank 1 by distance; on the raw cards the two rankings for 47 differ");

      // 7. The dot product of normalized vectors equals the cosine.
      ok = true;
      for (i = 0; i < BOTTLES.length; i++) {
        var n7 = normalize(BOTTLES[i].v);
        if (Math.abs(len(n7) - 1) > 1e-12) ok = false;
        for (j = 0; j < BOTTLES.length; j++) {
          if (Math.abs(dot(n7, normalize(BOTTLES[j].v)) - cosine(BOTTLES[i].v, BOTTLES[j].v)) > 1e-12) ok = false;
        }
      }
      var n47 = normalize(V["47"]), n212 = normalize(V["212"]);
      t.expect(ok && same(n47, [0.5, 0.25, 0.75, 0, 0.25, 0.25]) && same(n212, n47) && dot(n47, n212) === 1 && distance(n47, n212) === 0,
        "every normalized card has length 1 and the dot product of any two equals their cosine; 47 and 212 both normalize to exactly 0.5 0.25 0.75 0 0.25 0.25, dot product 1, distance 0");

      // 8. The story's nearest-neighbour lists for 47, exactly.
      var byCos = ranking("47", "cos", false), byDist = ranking("47", "dist", false);
      t.expect(same(ids(byCos), ["212", "177", "129", "90", "18", "104", "188", "240", "75", "61", "150"]) &&
        same(byCos.map(function (r) { return f2(r.cos); }), ["1.00", "0.96", "0.87", "0.84", "0.65", "0.54", "0.53", "0.46", "0.37", "0.28", "0.22"]) &&
        same(ids(byDist), ["129", "177", "90", "188", "240", "18", "104", "75", "150", "61", "212"]) &&
        same(byDist.map(function (r) { return f2(r.dist); }), ["2.65", "3.32", "4.90", "5.29", "5.83", "5.92", "6.24", "6.40", "7.00", "7.07", "8.00"]) &&
        byCos[1].b.name === "Rose Parlour" && byCos[2].b.name === "Linen Water",
        "47's neighbours by cosine are 212 1.00, Rose Parlour 0.96, Linen Water 0.87, then 90, 18, 104, 188, 240, 75, 61, 150; by distance Linen Water 2.65 and Rose Parlour 3.32 come first and 212 is last at 8.00, after Chapel Smoke at 7.07");

      // 9. Every other story number.
      var pc = pairsAtLeast(CLEANUP_LINE), d9 = [], sq = 0, maxOther = 0;
      for (k = 0; k < 6; k++) {
        d9.push(V["212"][k] - V["47"][k]);
        sq += (V["212"][k] - V["47"][k]) * (V["212"][k] - V["47"][k]);
      }
      for (i = 0; i < BOTTLES.length; i++) {
        for (j = i + 1; j < BOTTLES.length; j++) {
          if (BOTTLES[i].id === "47" && BOTTLES[j].id === "212") continue;
          maxOther = Math.max(maxOther, cosine(BOTTLES[i].v, BOTTLES[j].v));
        }
      }
      var dots = byCos.map(function (r) { return r.dot; }), sortedDots = dots.slice().sort(function (a, b) { return b - a; });
      t.expect(pc.checked === 66 && pc.pairs.length === 1 && pc.pairs[0].a.id === "47" && pc.pairs[0].b.id === "212" && f2(pc.pairs[0].c) === "1.00" &&
        maxOther < 0.975 && same(d9, [4, 2, 6, 0, 2, 2]) && sq === 64 && dot(V["47"], V["47"]) === 16 && dot(V["212"], V["212"]) === 144 &&
        f2(len(V["129"])) === "1.73" && f1(angleDeg(cosine(V["47"], V["129"]))) === "30.0" && f2(distance(V["47"], V["129"])) === "2.65" &&
        rankOf("47", "212", "cos", false) === 1 && rankOf("47", "212", "dist", false) === 11 && rankOf("47", "61", "dist", false) === 10 &&
        sortedDots[0] === 48 && dot(V["47"], V["212"]) === 48 && sortedDots[10] === 6 && dot(V["47"], V["129"]) === 6 && dot(V["47"], V["150"]) === 6 && sortedDots[9] === 6 && sortedDots[8] > 6,
        "story numbers: 66 pairs checked and exactly one at 0.99 or above, 47 and 212 at 1.00, every other pair below 0.975; differences 4, 2, 6, 0, 2, 2 whose squares add to 64; squares 16 and 144; Linen Water length 1.73, 30.0 degrees and 2.65 from 47; 212 rank 1 by cosine and 11 by distance, Chapel Smoke 10; dot products with 47 highest 48 (212), joint lowest 6 (Linen Water and Ash Letter)");

      // 10. The drawing: citrus across, flower up. 47 and 212 on one line, Ash Letter at zero and not drawn.
      var dr = st().drawn, s = PLOT / MAX_SCORE;
      t.expect(dr.arrows === 11 && same(dr.hidden, ["150"]) &&
        dr.tips["47"][0] === OX + 2 * s && dr.tips["47"][1] === OY - 3 * s && dr.tips["212"][0] === OX + 6 * s && dr.tips["212"][1] === OY - 9 * s &&
        (dr.tips["47"][1] - OY) * (dr.tips["212"][0] - OX) === (dr.tips["212"][1] - OY) * (dr.tips["47"][0] - OX) &&
        st().ui.tbody.children.length === 11,
        "the drawing on citrus and flower shows 11 arrows: 47 at (2, 3) and 212 at (6, 9), on one line, and Ash Letter, 0 on both notes, isn't drawn; the table lists the other eleven");

      // 11. The controls: distance, normalize, a pair with nothing in common, other notes, check pairs, reset.
      t.set("measure", "dist");
      await t.run(1);
      var distOk = n("rank") === 11 && n("dist") === 8 && st().cur.rows[0].id === "129" && t.logText().indexOf("212 is 11 of 11") >= 0;
      t.set("norm", true);
      await t.run(1);
      var normOk = n("dist") === 0 && n("dot") === 1 && n("cos") === 1 && n("rank") === 1 && n("lenq") === 1 && n("lenc") === 1 &&
        same(ids(st().cur.rows), ids(ranking("47", "cos", false))) && t.logText().indexOf("the same order as cosine") >= 0;
      t.set("query", "18");
      t.set("compare", "150");
      await t.run(1);
      var zeroOk = n("cos") === 0 && n("angle") === 90 && n("dot") === 0;
      t.set("ynote", "smoke");
      await t.run(1);
      var dr2 = st().drawn;
      var axesOk = same(dr2.hidden, ["90", "240"]) && dr2.tips["18"][1] === OY && dr2.tips["150"][0] === OX && dr2.tips["18"][0] > OX && dr2.tips["150"][1] < OY;
      t.click("pairs");
      var pairsOk = t.logText().indexOf("47 Blue Hour and 212 no name, cosine 1.00. 1 pair of 66.") >= 0;
      t.click("reset");
      await t.run(1);
      t.expect(distOk && normOk && zeroOk && axesOk && pairsOk && st().query === "47" && st().compare === "212" && st().measure === "cos" &&
        st().norm === false && st().yn === "flower" && n("cos") === 1 && n("dist") === 8 && n("rank") === 1 && n("lenc") === 12,
        "the controls: distance puts 212 at 11 of 11 with Linen Water first; normalize gives distance 0.00, dot product 1.00, lengths 1.00, rank 1 and the cosine order; 18 against 150 shows cosine 0 at 90 degrees; citrus against smoke draws them at a right angle and hides 90 and 240; check every pair logs one pair of 66; reset returns to 47 and 212");
    }
  });
})();
