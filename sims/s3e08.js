/* sims/s3e08-v1.0.0.js  (published as sims/s3e08.js)
   Case s3e08 "The Ring": a ring lab for the Gullsway Pier pass office, whose season passes (riders)
   live on eight small servers named after the carousel's eight horses. Each pass number is hashed to
   a point on a ring, and the rider sits on the next horse clockwise. The learner changes the number
   of horses, the places each horse has on the ring, the riders, the copies of each rider, the
   sturdier horses' weight, adds a horse or takes one off for repair, and reads how many riders
   change horse and where they go. Widget-style sim: it draws its own ring inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: placements as built (story), every place hashed, evenly
     spaced by hand, and pass number mod the number of horses; places per horse 1, 4, 16, 32, 128,
     256; riders 1,200, 12,000 or 60,000; copies 1 to 3, with or without skipping a horse already
     chosen; sturdier horses (Juniper, Tansy) get twice the places; Add a horse; Off for repair;
     Re-bolt at random (seeded api.rand()). Stats: horses, places on the ring, riders, most, fewest,
     mean per horse, busiest against its fair share, moved by the last change, riders with two
     copies on one horse, copies per rider. selfTest: 16 assertions.

   The model (stated in sim.lede):
   - The ring is the numbers 0 to 2^32 - 1, drawn as 360 degrees. hash32 is 32-bit FNV-1a over the
     string's character codes followed by the murmur3 finalizer (fmix32), all in unsigned 32-bit
     arithmetic (Math.imul and >>> 0).
   - Rider i (pass number i, 1 to K) sits at hash32("pass-" + i).
   - A horse's places: place j at hash32(name + "#" + j + salt), j = 0 to places x weight - 1.
     "As built" puts place 0 of the first eight horses where they were bolted (BUILT below, in
     hundredths of a degree d: floor(d x 2^32 / 36000)). The salt is "" until Re-bolt at random
     draws one from api.rand().
   - A rider belongs to the first place at or after its point (clockwise), wrapping to the lowest.
     Places sort by position, then horse, then place number.
   - Evenly spaced: horse k of the n on the carousel at floor(k x 2^32 / n), one place each. A
     horse off for repair leaves a gap; adding a horse re-spaces all of them.
   - Mod: rider i sits on horse (i mod h) of the h horses running, in list order.
   - Copies: walk clockwise from the rider's place, taking the owner of each place in turn, until
     there are R; with Skip on, a horse already chosen is passed over (Dynamo's preference list).
   - Weights apply only to the two ring placements with places: Juniper and Tansy get twice the
     places. Fair share of horse h = K x weight(h) / total weight of running horses.

   Where every number comes from (conventions rule 14; the case is content/s3/s3e08-v1.0.0.json).
   All counts below were worked out from the model above and are checked by the selfTest.
   - As built, in degrees: Dapple 12, Marigold 181, Juniper 214.5, Saffron 236, Pewter 236.01,
     Tansy 277, Cobweb 301.5, Clover 330. Arcs: Marigold 169, Juniper 33.5, Saffron 21.5, Pewter
     0.01, Tansy 40.99, Cobweb 24.5, Clover 28.5, Dapple 42 (12 + 360 - 330).
   - 12,000 riders, as built, one place each: Marigold 5,645, Dapple 1,414, Tansy 1,352, Juniper
     1,160, Clover 932, Cobweb 776, Saffron 721, Pewter 0 (the post's 03:00 ride log). Busiest
     against fair share 5,645 / 1,500 = 3.76.
   - Dapple off for repair: all 1,414 to Marigold, 7,059 (the ride log the night Dapple was off).
     Marigold off instead: all 5,645 to Juniper, 6,805.
   - Places per horse, as built, 8 horses, busiest / fair share: 1: 3.76, 4: 1.77, 16: 1.46,
     32: 1.23, 128: 1.06, 256: 1.09 (luck of where 12,000 riders fall).
   - 128 places, Dapple off: 1,540 riders scattered to all seven: Juniper 278, Marigold 274, Tansy
     265, Saffron 261, Pewter 211, Clover 149, Cobweb 102.
   - 128 places, copies without skipping: 1,285 riders with both copies on one horse (2 copies),
     3,571 (3 copies); with skipping, 0.
   - Four horses to five (Saffron joins): 128 places, 2,405 of 12,000 move (20.0%), from Juniper
     809, Pewter 617, Dapple 589, Marigold 390; one place each, 721 (6.0%), all from Pewter.
   - Weights on, 128 places (256 for Juniper and Tansy): Juniper 2,487 is the most, worst 1.13
     (Dapple 1,353 against 1,200). Dapple off: 1,353 move, to Tansy 344, Juniper 330, Marigold 251,
     Saffron 178, Pewter 135, Cobweb 90, Clover 25. Nutmeg joins: 1,167 move (9.7%), from all 8.
     Without skipping, 1,439 riders with both copies on one horse.
   - Evenly spaced, 8 horses: Pewter 1,569 to Saffron 1,417, worst 1.05. Nutmeg joins and all 9
     are re-spaced: 4,784 move (39.9%). Then Dapple off: 1,383, all to Juniper (2,714).
   - Mod 8: 1,500 each. Nutmeg joins (mod 9): 10,665 move (88.9%). Dapple off (mod 7): 10,501
     (87.5%).
   - As built, one place each, Nutmeg joins: 691 move (5.8%), all from Tansy.
   - Strong enough for the busiest arc: 7,059 x 8 = 56,472 riders of room for 12,000.

   Drawing: viewBox 660 x 380. Ring centre (240, 190), outer radius 130, inner 106. Labels (one
   place each only) at radius 148 or 164, alternating by order so Saffron (236) and Pewter
   (236.01) don't overlap. Legend from x 430, lines of 34 characters or fewer at 11px.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var RING = 4294967296;
  var NAMES = ["Marigold", "Pewter", "Dapple", "Juniper", "Saffron", "Tansy", "Cobweb", "Clover", "Nutmeg", "Quince"];
  // Place 0 of the first eight horses, as bolted (floor(d x 2^32 / 36000), d in hundredths of a degree).
  var BUILT = {
    Marigold: 2159414112,   // 181.00
    Pewter: 2815708976,     // 236.01
    Dapple: 143165576,      // 12.00
    Juniper: 2559084680,    // 214.50
    Saffron: 2815589671,    // 236.00
    Tansy: 3304738724,      // 277.00
    Cobweb: 3597035110,     // 301.50
    Clover: 3937053354      // 330.00
  };
  var HEAVY = { Juniper: true, Tansy: true };
  var PLACES = [1, 4, 16, 32, 128, 256];
  var KEYS = [1200, 12000, 60000];
  var MINH = 2;
  var MAXH = NAMES.length;

  var LAYOUTS = [
    { value: "built", label: "Ring, as built (place 0 where each horse was bolted)" },
    { value: "hashed", label: "Ring, every place hashed from the horse's name" },
    { value: "even", label: "Ring, evenly spaced by hand (one place each)" },
    { value: "mod", label: "No ring: pass number mod the number of horses" }
  ];
  var LAYOUT_SHORT = {
    built: "the ring as built",
    hashed: "every place hashed",
    even: "evenly spaced by hand",
    mod: "pass number mod the number of horses"
  };

  /* ---------- small helpers ---------- */

  function hash32(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h = (h ^ s.charCodeAt(i)) >>> 0;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h = (h ^ (h >>> 16)) >>> 0;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h;
  }

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }
  function pct(m, K) { return (Math.round(m * 1000 / K) / 10).toFixed(1); }
  function idx(name) { return NAMES.indexOf(name); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function carousel(C) { return NAMES.slice(0, C.n); }
  function alive(C) { return carousel(C).filter(function (h) { return h !== C.repair; }); }
  function onRing(C) { return C.layout === "built" || C.layout === "hashed"; }
  function weightOf(C, h) { return C.weights && onRing(C) && HEAVY[h] ? 2 : 1; }

  function tokens(C) {
    var t = [];
    if (C.layout === "mod") return t;
    if (C.layout === "even") {
      var on = carousel(C);
      for (var k = 0; k < on.length; k++) {
        if (on[k] !== C.repair) t.push({ p: Math.floor(k * RING / on.length), i: idx(on[k]), j: 0 });
      }
    } else {
      alive(C).forEach(function (h) {
        var count = C.places * weightOf(C, h);
        for (var j = 0; j < count; j++) {
          var p = (C.layout === "built" && j === 0 && BUILT.hasOwnProperty(h)) ? BUILT[h] : hash32(h + "#" + j + C.salt);
          t.push({ p: p, i: idx(h), j: j });
        }
      });
    }
    t.sort(function (a, b) { return (a.p - b.p) || (a.i - b.i) || (a.j - b.j); });
    return t;
  }

  function keyPoints(K) {
    var out = new Array(K);
    for (var i = 0; i < K; i++) out[i] = hash32("pass-" + (i + 1));
    return out;
  }

  function lowerBound(ps, x) {
    var lo = 0;
    var hi = ps.length;
    while (lo < hi) {
      var mid = (lo + hi) >>> 1;
      if (ps[mid] < x) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  // The horse (index into NAMES) each rider sits on.
  function owners(C, kp, toks) {
    var out = new Array(C.K);
    var i;
    if (C.layout === "mod") {
      var al = alive(C).map(idx);
      for (i = 0; i < C.K; i++) out[i] = al[(i + 1) % al.length];
      return out;
    }
    var ps = toks.map(function (x) { return x.p; });
    for (i = 0; i < C.K; i++) {
      var k = lowerBound(ps, kp[i]);
      if (k === ps.length) k = 0;
      out[i] = toks[k].i;
    }
    return out;
  }

  // Each rider's copies: walk on from its place, clockwise; with skip, pass over a horse already chosen.
  function copies(C, kp, toks) {
    var lists = new Array(C.K);
    var dups = 0;
    var i;
    var ch;
    if (C.layout === "mod") {
      var al = alive(C).map(idx);
      for (i = 0; i < C.K; i++) {
        ch = [];
        for (var q = 0; q < al.length * C.R + 1 && ch.length < C.R; q++) {
          var hm = al[(i + 1 + q) % al.length];
          if (C.skip && ch.indexOf(hm) >= 0) continue;
          ch.push(hm);
        }
        lists[i] = ch;
        if (distinct(ch) < ch.length) dups += 1;
      }
      return { lists: lists, dups: dups };
    }
    var ps = toks.map(function (x) { return x.p; });
    var T = toks.length;
    for (i = 0; i < C.K; i++) {
      var k = lowerBound(ps, kp[i]);
      if (k === T) k = 0;
      ch = [];
      var s = 0;
      while (ch.length < C.R && s < T) {
        var h = toks[(k + s) % T].i;
        s += 1;
        if (C.skip && ch.indexOf(h) >= 0) continue;
        ch.push(h);
      }
      lists[i] = ch;
      if (distinct(ch) < ch.length) dups += 1;
    }
    return { lists: lists, dups: dups };
  }

  function distinct(arr) {
    var seen = {};
    var n = 0;
    for (var i = 0; i < arr.length; i++) if (!seen[arr[i]]) { seen[arr[i]] = true; n += 1; }
    return n;
  }

  function loads(C, own) {
    var cnt = {};
    alive(C).forEach(function (h) { cnt[h] = 0; });
    for (var i = 0; i < own.length; i++) cnt[NAMES[own[i]]] += 1;
    return cnt;
  }

  function summary(C, own) {
    var al = alive(C);
    var cnt = loads(C, own);
    var W = 0;
    al.forEach(function (h) { W += weightOf(C, h); });
    var most = null;
    var fewest = null;
    var worst = 0;
    al.forEach(function (h) {
      if (most === null || cnt[h] > cnt[most]) most = h;
      if (fewest === null || cnt[h] < cnt[fewest]) fewest = h;
      var r = cnt[h] * W * 100 / (C.K * weightOf(C, h));
      if (r > worst) worst = r;
    });
    return {
      cnt: cnt, W: W, most: most, fewest: fewest,
      spread: (Math.round(worst) / 100).toFixed(2),
      mean: Math.round(C.K / al.length)
    };
  }

  function sortedList(map) {
    var items = Object.keys(map).map(function (k) { return [Number(k), map[k]]; });
    items.sort(function (a, b) { return (b[1] - a[1]) || (a[0] - b[0]); });
    return items.map(function (x) { return NAMES[x[0]] + " " + fmt(x[1]); }).join(", ");
  }

  function diff(before, after) {
    var to = {};
    var from = {};
    var m = 0;
    for (var i = 0; i < after.length; i++) {
      if (before[i] !== after[i]) {
        m += 1;
        to[after[i]] = (to[after[i]] || 0) + 1;
        from[before[i]] = (from[before[i]] || 0) + 1;
      }
    }
    return { m: m, to: to, from: from };
  }

  function tone(ratio, count) {
    if (count === 0) return "muted";
    if (ratio >= 1.5) return "bad";
    if (ratio >= 1.15) return "warn";
    return "ok";
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var CX = 240;
  var CY = 190;
  var RO = 130;
  var RI = 106;

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
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function f1(x) { return String(Math.round(x * 10) / 10); }
  function pt(r, deg) {
    var a = deg * Math.PI / 180;
    return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
  }
  function sector(a0, a1) {
    var o0 = pt(RO, a0);
    var o1 = pt(RO, a1);
    var i1 = pt(RI, a1);
    var i0 = pt(RI, a0);
    return "M" + f1(o0[0]) + " " + f1(o0[1]) + "A" + RO + " " + RO + " 0 0 1 " + f1(o1[0]) + " " + f1(o1[1]) +
      "L" + f1(i1[0]) + " " + f1(i1[1]) + "A" + RI + " " + RI + " 0 0 0 " + f1(i0[0]) + " " + f1(i0[1]) + "Z";
  }
  function deg(p) { return p * 360 / RING; }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 380", width: "100%", "class": "dg", role: "img",
      "aria-label": "The ring drawn as a circle. Each coloured stretch is the arc a horse owns: every rider whose point falls in it sits on the horse at its clockwise end. Red is over 1.5 times a fair share, amber over 1.15 times, grey empty, green within. The table below lists every horse."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var table = el("table", "width:100%;font-size:12px;");
    var thead = el("thead");
    var hr = el("tr");
    ["horse", "places", "riders", "fair share", "load", "last change", "copies held"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    box.appendChild(table);
    api.root.appendChild(box);
    return { doc: doc, el: el, head: head, svg: svg, layer: layer, tbody: tbody };
  }

  function drawRing(S, sm) {
    var ui = S.ui;
    var doc = ui.doc;
    var g = ui.layer;
    var C = S.C;
    clear(g);
    var toks = S.toks;
    var T = toks.length;
    var i;
    if (C.layout === "mod" || T === 0) {
      mk(doc, "circle", { cx: CX, cy: CY, r: (RO + RI) / 2, "class": "dg-axis", fill: "none" }, g);
      txt(doc, g, CX, CY - 6, fmt(C.K) + " riders", "dg-note", "middle");
      txt(doc, g, CX, CY + 14, "no ring: pass number mod " + alive(C).length, "dg-axis", "middle");
    } else {
      var paths = {};
      for (i = 0; i < T; i++) {
        var a1 = deg(toks[i].p);
        var a0 = T === 1 ? a1 - 360 : deg(toks[(i - 1 + T) % T].p);
        if (i === 0 && T > 1) a0 -= 360;
        var h = toks[i].i;
        if (!paths[h]) paths[h] = "";
        var span = a1 - a0;
        if (span > 180) {
          var mid = a0 + span / 2;
          paths[h] += sector(a0, mid) + sector(mid, a1);
        } else if (span > 0) {
          paths[h] += sector(a0, a1);
        }
      }
      Object.keys(paths).forEach(function (k) {
        var name = NAMES[Number(k)];
        var share = C.K * weightOf(C, name) / sm.W;
        var gg = mk(doc, "g", { "class": "dg-node st-" + tone(sm.cnt[name] / share, sm.cnt[name]) }, g);
        if (paths[k]) mk(doc, "path", { d: paths[k] }, gg);
      });
      if (T <= 64) {
        var d = "";
        for (i = 0; i < T; i++) {
          var a = deg(toks[i].p);
          var p0 = pt(RI - 5, a);
          var p1 = pt(RO + 5, a);
          d += "M" + f1(p0[0]) + " " + f1(p0[1]) + "L" + f1(p1[0]) + " " + f1(p1[1]);
        }
        mk(doc, "path", { d: d, "class": "dg-axis" }, g);
      }
      if (T <= MAXH) {
        for (i = 0; i < T; i++) {
          var an = deg(toks[i].p);
          var lp = pt(i % 2 ? RO + 34 : RO + 18, an);
          txt(doc, g, f1(lp[0]), f1(lp[1] + 4), NAMES[toks[i].i], "dg-note", lp[0] >= CX ? "start" : "end");
        }
      }
      txt(doc, g, CX, CY - 6, fmt(C.K) + " riders", "dg-note", "middle");
      txt(doc, g, CX, CY + 14, fmt(T) + (T === 1 ? " place" : " places"), "dg-axis", "middle");
    }
    var lx = 430;
    var lines = [
      [T && C.layout !== "mod" && T <= 64 ? "Each tick is one place." : (C.layout === "mod" ? "No ring: riders seated by number." : "Too many places to tick."), "dg-axis"],
      ["Red: over 1.5 x fair share", "dg-axis"],
      ["Amber: over 1.15 x fair share", "dg-axis"],
      ["Green: within. Grey: empty.", "dg-axis"],
      ["Pass 1 sits on " + NAMES[S.own[0]] + ".", "dg-note"],
      [C.R > 1 ? "Its copies: " + S.cp.lists[0].map(function (x) { return NAMES[x]; }).join(", ") : "One copy only.", "dg-axis"]
    ];
    lines.forEach(function (ln, k) { txt(doc, g, lx, 40 + 22 * k, ln[0], ln[1], "start"); });
  }

  function drawTable(S, sm) {
    var ui = S.ui;
    var el = ui.el;
    var C = S.C;
    clear(ui.tbody);
    var held = {};
    for (var i = 0; i < S.cp.lists.length; i++) {
      var l = S.cp.lists[i];
      for (var k = 0; k < l.length; k++) held[l[k]] = (held[l[k]] || 0) + 1;
    }
    var placesOf = {};
    S.toks.forEach(function (x) { placesOf[x.i] = (placesOf[x.i] || 0) + 1; });
    carousel(C).forEach(function (h) {
      var tr = el("tr");
      var off = h === C.repair;
      var hi = idx(h);
      var cells;
      if (off) {
        cells = [h + " (off for repair)", "0", "0", "-", "-", S.delta[hi] ? fmt(S.delta[hi]) : "0", "0"];
      } else {
        var share = C.K * weightOf(C, h) / sm.W;
        var dl = S.delta[hi] || 0;
        cells = [h + (weightOf(C, h) === 2 ? " (sturdy)" : ""),
          C.layout === "mod" ? "-" : fmt(placesOf[hi] || 0),
          fmt(sm.cnt[h]),
          fmt(Math.round(share)),
          (sm.cnt[h] / share).toFixed(2) + " x",
          dl > 0 ? "+" + fmt(dl) : (dl < 0 ? "-" + fmt(-dl) : "0"),
          fmt(held[hi] || 0)];
      }
      cells.forEach(function (c) { tr.appendChild(el("td", "", c)); });
      ui.tbody.appendChild(tr);
    });
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var sm = summary(C, S.own);
    S.sm = sm;
    S.ui.head.textContent = "Placement: " + LAYOUT_SHORT[C.layout] + ". " + alive(C).length + " horses running" +
      (C.repair !== "none" ? ", " + C.repair + " off for repair" : "") + ". Copies per rider: " + C.R +
      (C.skip ? ", skipping horses already chosen." : ".");
    drawRing(S, sm);
    drawTable(S, sm);
    S.stat.horses(alive(C).length);
    S.stat.places(C.layout === "mod" ? "no ring" : fmt(S.toks.length));
    S.stat.riders(fmt(C.K));
    S.stat.most(sm.most + " " + fmt(sm.cnt[sm.most]));
    S.stat.fewest(sm.fewest + " " + fmt(sm.cnt[sm.fewest]));
    S.stat.mean(fmt(sm.mean));
    S.stat.spread(sm.spread);
    S.stat.moved(S.moved);
    S.stat.dups(fmt(S.cp.dups));
    S.stat.copies(C.R);
    S.ctl.add.disable(C.n >= MAXH);
  }

  /* ---------- changes ---------- */

  // mode "move": compare riders before and after and log where they went; "copies": only the
  // copies changed; "fresh": a new set of riders, nothing to compare.
  function apply(api, what, mode) {
    var S = api.state;
    var C = S.C;
    var before = S.own;
    if (mode !== "copies") {
      S.toks = tokens(C);
      S.own = owners(C, S.kp, S.toks);
    }
    S.cp = copies(C, S.kp, S.toks);
    if (mode === "move" && before && before.length === S.own.length) {
      var d = diff(before, S.own);
      S.lastMoved = d.m;
      S.moved = fmt(d.m) + " of " + fmt(C.K);
      S.delta = {};
      Object.keys(d.to).forEach(function (k) { S.delta[k] = (S.delta[k] || 0) + d.to[k]; });
      Object.keys(d.from).forEach(function (k) { S.delta[k] = (S.delta[k] || 0) - d.from[k]; });
      var s = what + " " + fmt(d.m) + " of " + fmt(C.K) + " riders changed horse (" + pct(d.m, C.K) + "%).";
      if (d.m) s += " They went to: " + sortedList(d.to) + ". They came from: " + sortedList(d.from) + ".";
      api.log(s, d.m * 5 > C.K ? "warn" : "");
    } else if (mode === "fresh") {
      S.lastMoved = 0;
      S.moved = "none yet";
      S.delta = {};
      api.log(what, "");
    } else {
      api.log(what + " Riders with two copies on one horse: " + fmt(S.cp.dups) + ".", S.cp.dups ? "bad" : "ok");
    }
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s3e08", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { n: 8, layout: "built", places: 1, weights: false, repair: "none", salt: "", K: 12000, R: 2, skip: false };
      S.kp = keyPoints(S.C.K);
      S.moved = "none yet";
      S.lastMoved = 0;
      S.delta = {};
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.layout = api.control.select("layout", "How horses are placed", LAYOUTS, "built", function (v) {
        var o = pick(LAYOUTS, v);
        if (!o) return;
        S.C.layout = String(o.value);
        S.C.salt = "";
        apply(api, "Placement: " + LAYOUT_SHORT[S.C.layout] + "." +
          (onRing(S.C) ? "" : " Places per horse and the sturdier horses' weight don't apply here."), "move");
      });
      S.ctl.horses = api.control.range("horses", "Horses on the carousel", MINH, MAXH, 1, 8, function (v) {
        var x = Math.max(MINH, Math.min(MAXH, Math.round(num(v))));
        if (!isFinite(x) || x === S.C.n) return;
        S.C.n = x;
        apply(api, "Horses on the carousel: " + x + (S.C.layout === "even" ? ", re-spaced evenly by hand." : "."), "move");
      });
      S.ctl.add = api.control.button("add", "Add a horse", function () {
        if (S.C.n >= MAXH) return;
        S.C.n += 1;
        S.ctl.horses.set(S.C.n);
        var name = NAMES[S.C.n - 1];
        var tail = ".";
        if (S.C.layout === "even") tail = " and all " + S.C.n + " are re-spaced evenly by hand.";
        else if (S.C.layout === "mod") tail = ", and every rider is seated again by pass number mod " + alive(S.C).length + ".";
        apply(api, name + " joins the carousel" + tail, "move");
      });
      var repairOpts = [{ value: "none", label: "None" }].concat(NAMES.map(function (h) { return { value: h, label: h }; }));
      S.ctl.repair = api.control.select("repair", "Off for repair", repairOpts, "none", function (v) {
        var prev = S.C.repair;
        var x = String(v);
        if (x === prev) return;
        S.C.repair = x;
        var what;
        if (x === "none") what = prev + " is back from repair.";
        else if (idx(x) >= S.C.n) what = x + " isn't on the carousel, so nothing changes.";
        else what = x + " goes off for repair.";
        apply(api, what, "move");
      });
      S.ctl.places = api.control.select("places", "Places per horse", PLACES.map(function (p) { return { value: p, label: String(p) }; }), 1, function (v) {
        S.C.places = Number(v);
        apply(api, "Places per horse: " + S.C.places + "." + (onRing(S.C) ? "" : " This placement ignores it."), "move");
      });
      S.ctl.weights = api.control.toggle("weights", "Sturdier horses (Juniper, Tansy) get twice the places", false, function (on) {
        S.C.weights = !!on;
        apply(api, "Twice the places for the sturdier horses: " + (on ? "on." : "off.") + (onRing(S.C) ? "" : " This placement ignores it."), "move");
      });
      S.ctl.keys = api.control.select("keys", "Riders (season passes)", KEYS.map(function (k) { return { value: k, label: fmt(k) }; }), 12000, function (v) {
        S.C.K = Number(v);
        S.kp = keyPoints(S.C.K);
        apply(api, "Riders: " + fmt(S.C.K) + ". A new set of riders, so nothing moved.", "fresh");
      });
      S.ctl.copies = api.control.range("copies", "Copies of each rider", 1, 3, 1, 2, function (v) {
        var x = Math.max(1, Math.min(3, Math.round(num(v))));
        if (!isFinite(x) || x === S.C.R) return;
        S.C.R = x;
        apply(api, "Copies of each rider: " + x + ".", "copies");
      });
      S.ctl.skip = api.control.toggle("skip", "Copies skip a horse already chosen", false, function (on) {
        S.C.skip = !!on;
        apply(api, "Copies skip a horse already chosen: " + (on ? "on." : "off."), "copies");
      });
      S.ctl.rebolt = api.control.button("rebolt", "Re-bolt at random", function () {
        S.C.salt = "~" + Math.floor(api.rand() * 1000000);
        S.C.layout = "hashed";
        S.ctl.layout.set("hashed");
        apply(api, "Every horse is re-bolted at new random places.", "move");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        horses: api.stat("horses", "horses running", ""),
        places: api.stat("places", "places on the ring", ""),
        riders: api.stat("riders", "riders", ""),
        most: api.stat("most", "most riders", "bad"),
        fewest: api.stat("fewest", "fewest riders", "warn"),
        mean: api.stat("mean", "mean per horse", ""),
        spread: api.stat("spread", "busiest against its fair share", "bad"),
        moved: api.stat("moved", "riders moved by the last change", "warn"),
        dups: api.stat("dups", "riders with two copies on one horse", "bad"),
        copies: api.stat("copies", "copies per rider", "")
      };

      api.info("<strong>How to read it.</strong> Each rider is a season pass. Its pass number is hashed to a point on the ring, and it sits on the first place clockwise from that point: the horse that owns the arc it falls in. A horse can have one place or many. The table shows each horse's riders against its fair share, how many it gained or lost in the last change, and how many copies it holds.");

      S.toks = tokens(S.C);
      S.own = owners(S.C, S.kp, S.toks);
      S.cp = copies(S.C, S.kp, S.toks);
      var sm = summary(S.C, S.own);
      api.log("The ring as built: 8 horses, one place each, 12,000 riders. " + sm.most + " carries " + fmt(sm.cnt[sm.most]) +
        " and " + sm.fewest + " " + fmt(sm.cnt[sm.fewest]) + ".", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function since() { return t.logText().slice(mark); }
      function has(s) { return since().indexOf(s) >= 0; }
      var spreads = [];

      // 1. The opening state: the ring as built, before Dapple goes off.
      t.expect(t.stat("horses") === 8 && t.stat("places") === 8 && t.stat("riders") === "12,000" &&
        t.stat("most") === "Marigold 5,645" && t.stat("fewest") === "Pewter 0" && t.stat("mean") === "1,500" &&
        t.stat("spread") === 3.76 && t.stat("moved") === "none yet" && t.stat("dups") === 0 && t.stat("copies") === 2 &&
        t.logText().indexOf("Marigold carries 5,645 and Pewter 0.") >= 0,
        "Opens as built: 8 horses, one place each, Marigold 5,645 of 12,000, Pewter 0, 3.76 times a fair share");

      // 2. Dapple off for repair: its whole crowd lands on Marigold.
      begin();
      t.set("repair", "Dapple");
      t.expect(has("Dapple goes off for repair. 1,414 of 12,000 riders changed horse (11.8%). They went to: Marigold 1,414. They came from: Dapple 1,414.") &&
        t.stat("most") === "Marigold 7,059" && t.stat("moved") === "1,414 of 12,000" && t.stat("horses") === 7 && t.stat("mean") === "1,714",
        "Dapple off: all 1,414 of its riders land on Marigold, which now carries 7,059");
      begin();
      t.set("repair", "none");
      t.expect(has("Dapple is back from repair. 1,414 of 12,000 riders changed horse (11.8%). They went to: Dapple 1,414.") &&
        t.stat("most") === "Marigold 5,645",
        "Dapple back: the same 1,414 return to it");

      // 3. More places per horse narrow the spread.
      spreads.push(t.stat("spread"));
      [4, 16, 32, 128, 256].forEach(function (p) { t.set("places", p); spreads.push(t.stat("spread")); });
      t.expect(spreads.join(" ") === "3.76 1.77 1.46 1.23 1.06 1.09" && t.stat("places") === "2,048",
        "Busiest against fair share with 1, 4, 16, 32, 128, 256 places: 3.76, 1.77, 1.46, 1.23, 1.06, 1.09");
      t.expect(spreads[0] > spreads[1] && spreads[1] > spreads[2] && spreads[2] > spreads[3] && spreads[3] > spreads[4] &&
        spreads[4] < 1.1 && spreads[5] < 1.1,
        "From 1 to 128 places the spread narrows every step, and past 100 it stays within 10 percent");

      // 4. With 128 places, Dapple's riders scatter over all seven.
      t.set("places", 128);
      t.expect(t.stat("most") === "Marigold 1,587" && t.stat("fewest") === "Tansy 1,402", "128 places: Marigold 1,587 to Tansy 1,402");
      begin();
      t.set("repair", "Dapple");
      t.expect(has("Dapple goes off for repair. 1,540 of 12,000 riders changed horse (12.8%). They went to: Juniper 278, Marigold 274, Tansy 265, Saffron 261, Pewter 211, Clover 149, Cobweb 102. They came from: Dapple 1,540.") &&
        t.stat("moved") === "1,540 of 12,000",
        "128 places, Dapple off: 1,540 riders scatter over all 7 horses, at most 278 to any one");
      t.set("repair", "none");

      // 5. Copies: the next places clockwise can belong to the same horse.
      var a = t.stat("dups");
      t.set("copies", 3);
      var b = t.stat("dups");
      t.click("skip");
      var c = t.stat("dups");
      var lists = t.api.state.cp.lists;
      var bad = 0;
      for (var i = 0; i < lists.length; i++) if (lists[i].length !== 3 || distinct(lists[i]) !== 3) bad += 1;
      t.expect(a === "1,285" && b === "3,571" && c === 0 && bad === 0 && lists.length === 12000,
        "128 places without skipping: 1,285 riders (2 copies) and 3,571 (3 copies) have two copies on one horse; skipping, every rider's 3 copies are on 3 different horses");
      t.set("copies", 2);

      // 6. Four horses to five, with 128 places: about a fifth move, all to the new horse.
      t.set("horses", 4);
      begin();
      t.click("add");
      t.expect(has("Saffron joins the carousel. 2,405 of 12,000 riders changed horse (20.0%). They went to: Saffron 2,405. They came from: Juniper 809, Pewter 617, Dapple 589, Marigold 390.") &&
        t.stat("horses") === 5 && t.stat("moved") === "2,405 of 12,000" && t.stat("mean") === "2,400",
        "4 to 5 horses at 128 places: 2,405 of 12,000 move (20.0%), all to Saffron, taken from all four");
      t.set("places", 1);
      t.set("horses", 4);
      begin();
      t.click("add");
      t.expect(has("Saffron joins the carousel. 721 of 12,000 riders changed horse (6.0%). They went to: Saffron 721. They came from: Pewter 721."),
        "4 to 5 horses at one place each: 721 move (6.0%), all from Pewter");

      // 7. Sturdier horses get twice the places.
      t.set("horses", 8);
      t.set("places", 128);
      t.set("weights", true);
      t.expect(t.stat("most") === "Juniper 2,487" && t.stat("spread") === 1.13 && t.stat("places") === "1,280",
        "Weights on: Juniper and Tansy get 256 places each, Juniper carries 2,487, the worst horse is 1.13 times its share");
      begin();
      t.set("repair", "Dapple");
      var w1 = has("1,353 of 12,000 riders changed horse (11.3%). They went to: Tansy 344, Juniper 330, Marigold 251, Saffron 178, Pewter 135, Cobweb 90, Clover 25.");
      t.set("repair", "none");
      begin();
      t.click("add");
      t.expect(w1 && has("Nutmeg joins the carousel. 1,167 of 12,000 riders changed horse (9.7%). They went to: Nutmeg 1,167."),
        "Weights on: Dapple off scatters 1,353; Nutmeg joining takes 1,167 (9.7%)");

      // 8. Evenly spaced by hand: even today, uneven after a change.
      t.set("weights", false);
      t.set("horses", 8);
      t.set("layout", "even");
      var e8 = t.stat("most") === "Pewter 1,569" && t.stat("fewest") === "Saffron 1,417" && t.stat("spread") === 1.05;
      begin();
      t.click("add");
      var e9 = has("Nutmeg joins the carousel and all 9 are re-spaced evenly by hand. 4,784 of 12,000 riders changed horse (39.9%).");
      begin();
      t.set("repair", "Dapple");
      t.expect(e8 && e9 && has("Dapple goes off for repair. 1,383 of 12,000 riders changed horse (11.5%). They went to: Juniper 1,383.") &&
        t.stat("most") === "Juniper 2,714",
        "Evenly spaced: 1,417 to 1,569; re-spacing for a ninth moves 4,784 (39.9%); Dapple off sends all 1,383 to Juniper");

      // 9. Pass number mod the number of horses: even, until the count changes.
      t.set("repair", "none");
      t.set("horses", 8);
      t.set("layout", "mod");
      var m8 = t.stat("most") === "Marigold 1,500" && t.stat("fewest") === "Marigold 1,500" && t.stat("spread") === 1 && t.stat("places") === "no ring";
      begin();
      t.click("add");
      var m9 = has("10,665 of 12,000 riders changed horse (88.9%).");
      t.set("horses", 8);
      begin();
      t.set("repair", "Dapple");
      t.expect(m8 && m9 && has("Dapple goes off for repair. 10,501 of 12,000 riders changed horse (87.5%)."),
        "Mod 8: 1,500 each; a ninth horse moves 10,665 (88.9%); Dapple off moves 10,501 (87.5%)");

      // 10. Back to the ring as built, one place each: a new horse takes from one neighbour only.
      t.set("repair", "none");
      t.set("layout", "built");
      t.set("places", 1);
      begin();
      t.click("add");
      var n9 = has("Nutmeg joins the carousel. 691 of 12,000 riders changed horse (5.8%). They went to: Nutmeg 691. They came from: Tansy 691.");
      t.set("horses", 8);
      begin();
      t.set("repair", "Marigold");
      t.expect(n9 && has("Marigold goes off for repair. 5,645 of 12,000 riders changed horse (47.0%). They went to: Juniper 5,645.") &&
        t.stat("most") === "Juniper 6,805",
        "As built: Nutmeg takes 691 from Tansy alone; Marigold off sends all 5,645 to Juniper");

      // 11. Re-bolted at random: many places still beat one, and adding moves only the new horse's riders.
      t.set("repair", "none");
      t.click("rebolt");
      var r1 = t.stat("spread");
      t.set("places", 128);
      var r128 = t.stat("spread");
      begin();
      t.click("add");
      var S = t.api.state;
      var newLoad = S.sm.cnt.Nutmeg;
      t.expect(r128 < r1 && S.C.layout === "hashed" && S.lastMoved === newLoad && has("They went to: Nutmeg " + fmt(newLoad) + "."),
        "Re-bolted at random: 128 places spread less than 1, and a new horse moves exactly the riders it takes");
    }
  });
})();
