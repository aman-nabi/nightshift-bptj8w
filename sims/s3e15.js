/* sims/s3e15-v1.0.1.js  (published as sims/s3e15.js)
   Case s3e15 "Where Am I": a map lab for the Corrieburn Hill Rescue Team's call-out app. The app keeps
   each volunteer's last phone position and an available flag. When a call comes in it pages the
   available volunteers whose position shares the walker's geohash prefix. The learner changes the
   prefix length, searches the eight neighbouring cells or not, ranks by real distance or not, pages
   the whole team, and builds a quadtree with a leaf capacity. Widget-style sim: it draws its own map
   inside api.root.

   CHANGELOG
   v1.0.1 (2026-10-11) rule 15: the paged volunteer in Strathyre is now Fingal Lumsden; the case is
     content/s3/s3e15-v1.0.1.json
   v1.0.0 (2026-10-11) first version: 60 volunteers (27 available), the walker on Ben Ledi's
     south-east ridge, prefix length 3 to 6, neighbours, rank by distance (page the nearest 3), page
     the whole team, a quadtree panel (leaf capacity 1 to 8), presets for the four replies, a map of
     the nine 4-character cells around her and a close-up of the cell line. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - geohash(lat, lon, n): standard geohash. Halve the longitude range [-180, 180] and the latitude
     range [-90, 90] in turn, longitude first, writing 1 for the upper half and 0 for the lower; every
     5 bits is one character of 0123456789bcdefghjkmnpqrstuvwxyz. A point on a halving line goes up.
   - Distance: haversine on a sphere of radius 6371 km.
   - Her cell: the n-character cell holding her point. Neighbours: the cells holding the points one
     cell width and height away from her cell's centre, 8 of them, so 9 cells in all.
   - Found: the available volunteers whose own n-character geohash is one of the searched cells.
   - Ranking off: every volunteer found is paged. Ranking on: the found are sorted by distance and
     the nearest 3 are paged. Page the whole team: all 60 phones ring, available or not.
   - Nearest paged: the nearest available volunteer among those paged. Nearer, not paged: available
     volunteers closer to her than that one who were not paged.
   - Quadtree: over the 60 stored positions, inside the box of the nine 4-character cells (56.07421875
     to 56.6015625 N, 4.921875 to 3.8671875 W). A box splits into four equal quarters (in degrees)
     while it holds more points than the leaf capacity, to a depth of 10. A point on a split line
     goes to the upper (north or east) quarter.

   Where every number comes from (conventions rule 14; the case is content/s3/s3e15-v1.0.1.json).
   All worked out from the model above and checked by the selfTest.
   - Walker, Catriona Glendinning: 56.2512 N, 4.2885 W, geohash gfhbn2, 4-character cell gfhb.
     The brief's check points: 56.249 N, 4.30 W is gcuz (gcuzyp); 56.251 N, 4.30 W is gfhb (gfhbn0).
   - Cell gfhb: 56.25 to 56.42578125 N, 4.5703125 to 4.21875 W. 21.7 km wide along its southern edge
     (21.718), 21.6 km along its northern (21.618), 19.5 km tall (19.546), 29.2 km corner to corner.
   - Torcuil Rintoul, in the hut: 56.2477 N, 4.2870 W, geohash gcuzyr, 400 m from her (0.4001 km).
   - Fingal Lumsden, Strathyre: 56.3195 N, 4.3200 W, 7.8 km (7.8395). Mairi Pitcairn, Balquhidder,
     12.7 km. Sorley Fyfe, Lochearnhead, 15.2 km. These three are the available volunteers in gfhb.
   - As it ran (4 characters, her cell only, no ranking): 1 cell, 3 found, 3 phones, nearest paged
     7.8 km, 14 available volunteers nearer than him not paged (Torcuil, Kilmahog 2.6 km, 11 in
     Callander from 3.4 km, Brig o' Turk 5.9 km).
   - 5 characters (cell gfhbn, 2.7 x 4.9 km): 0 found, 0 phones. 6 characters (gfhbn2, 680 x 610 m):
     0 found.
   - 3 characters (cell gfh, 86.9 x 156.4 km): 6 found and paged (the three above, Killin 2, Crianlarich
     1), nearest paged still 7.8 km, 14 nearer not paged.
   - Whole team: 60 phones, nearest paged 400 m.
   - 4 characters, neighbours on: 9 cells, 27 found; without ranking 27 phones; with ranking 3 phones:
     Torcuil 400 m, Kilmahog 2.6 km, Callander 3.4 km. Ranking alone, her cell only: 3 phones, 7.8 km.
   - 5 characters with neighbours: 8 found, nearest 400 m. 6 characters with neighbours: 1 found.
   - Quadtree, capacity 4: 40 leaves; Callander's leaf (at 56.2445 N, 4.2150 W) 510 x 460 m, her leaf
     8.2 x 7.3 km (8.154 x 7.330). Capacity 1: 235 leaves, Callander's 250 x 230 m, hers 4.1 x 3.7 km.

   Drawing: map viewBox 600 x 540 over 56.06 to 56.615 N and 4.95 to 3.84 W, x scaled by cos 56.34.
   Close-up viewBox 600 x 240 over 56.2462 to 56.2532 N and 4.305 to 4.270 W.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  var R_KM = 6371;
  var FEW = 3;
  var WALKER = { name: "Catriona Glendinning", lat: 56.2512, lon: -4.2885 };
  var TOWN = { lat: 56.2445, lon: -4.2150 };
  var BLOCK = { s: 56.07421875, n: 56.6015625, w: -4.921875, e: -3.8671875 };

  // [place, lat, lon, available (1/0), name]
  var LIST = [
    ["hut", 56.2477, -4.2870, 1, "Torcuil Rintoul"],
    ["Strathyre", 56.3195, -4.3200, 1, "Fingal Lumsden"], ["Strathyre", 56.3270, -4.3270, 0], ["Strathyre", 56.3290, -4.3255, 0],
    ["Balquhidder", 56.3550, -4.3740, 1, "Mairi Pitcairn"], ["Balquhidder", 56.3565, -4.3790, 0],
    ["Lochearnhead", 56.3880, -4.2880, 1, "Sorley Fyfe"], ["Lochearnhead", 56.3860, -4.2910, 0]
  ];
  var CAL_ON = [0, 2, 5, 7, 9, 12, 14, 17, 19, 20, 22];
  for (var k = 0; k < 24; k++) {
    LIST.push(["Callander", Math.round((56.2400 + (k % 4) * 0.0025) * 1e4) / 1e4,
      Math.round((-4.2340 + Math.floor(k / 4) * 0.0065) * 1e4) / 1e4, CAL_ON.indexOf(k) >= 0 ? 1 : 0]);
  }
  LIST = LIST.concat([
    ["Kilmahog", 56.2475, -4.2470, 1], ["Kilmahog", 56.2482, -4.2455, 0],
    ["Brig o' Turk", 56.2265, -4.3730, 1], ["Brig o' Turk", 56.2275, -4.3700, 0],
    ["Aberfoyle", 56.1790, -4.3830, 1], ["Aberfoyle", 56.1780, -4.3870, 0], ["Aberfoyle", 56.1805, -4.3800, 0],
    ["Doune", 56.1900, -4.0520, 1], ["Doune", 56.1890, -4.0480, 1], ["Doune", 56.1915, -4.0550, 0], ["Doune", 56.1880, -4.0500, 0],
    ["Dunblane", 56.1870, -3.9650, 1], ["Dunblane", 56.1890, -3.9680, 0], ["Dunblane", 56.1850, -3.9620, 0],
    ["Thornhill", 56.1720, -4.1520, 0],
    ["Bridge of Allan", 56.1550, -3.9480, 1], ["Bridge of Allan", 56.1560, -3.9450, 0],
    ["Killin", 56.4660, -4.3180, 1], ["Killin", 56.4670, -4.3200, 1], ["Killin", 56.4650, -4.3150, 0], ["Killin", 56.4680, -4.3220, 0],
    ["Crianlarich", 56.3900, -4.6180, 1], ["Crianlarich", 56.3910, -4.6150, 0],
    ["Tyndrum", 56.4350, -4.7100, 0],
    ["St Fillans", 56.3930, -4.1150, 1], ["St Fillans", 56.3940, -4.1180, 0],
    ["Comrie", 56.3750, -3.9900, 1], ["Comrie", 56.3760, -3.9930, 0]
  ]);

  var PRESETS = [
    { value: "asran", label: "As it ran: 4 characters, her cell only", C: { len: 4, nb: false, rank: false, all: false } },
    { value: "longer", label: "A longer prefix: 5 characters", C: { len: 5, nb: false, rank: false, all: false } },
    { value: "shorter", label: "A shorter prefix: 3 characters", C: { len: 3, nb: false, rank: false, all: false } },
    { value: "all", label: "Page the whole team", C: { len: 4, nb: false, rank: false, all: true } },
    { value: "nine", label: "Her cell and 8 neighbours, nearest 3", C: { len: 4, nb: true, rank: true, all: false } }
  ];

  /* ---------- the model (pure functions) ---------- */

  function geohash(lat, lon, n) {
    var la = [-90, 90];
    var lo = [-180, 180];
    var s = "";
    var bits = 0;
    var ch = 0;
    var even = true;
    while (s.length < n) {
      var r = even ? lo : la;
      var v = even ? lon : lat;
      var m = (r[0] + r[1]) / 2;
      if (v >= m) { ch = ch * 2 + 1; r[0] = m; } else { ch = ch * 2; r[1] = m; }
      even = !even;
      bits += 1;
      if (bits === 5) { s += B32.charAt(ch); bits = 0; ch = 0; }
    }
    return { s: s, s0: la[0], n0: la[1], w0: lo[0], e0: lo[1] };
  }

  function hav(a1, o1, a2, o2) {
    var r = Math.PI / 180;
    var x = Math.pow(Math.sin((a2 - a1) * r / 2), 2) +
      Math.cos(a1 * r) * Math.cos(a2 * r) * Math.pow(Math.sin((o2 - o1) * r / 2), 2);
    return 2 * R_KM * Math.asin(Math.sqrt(x));
  }

  function fmtD(km) {
    if (km < 1) return String(Math.round(km * 100) * 10) + " m";
    return (Math.round(km * 10) / 10).toFixed(1) + " km";
  }
  function fmtBox(wk, hk) {
    if (wk < 1 && hk < 1) return (Math.round(wk * 100) * 10) + " x " + (Math.round(hk * 100) * 10) + " m";
    return (Math.round(wk * 10) / 10).toFixed(1) + " x " + (Math.round(hk * 10) / 10).toFixed(1) + " km";
  }
  function boxSize(b) { return [hav(b.s, b.w, b.s, b.e), hav(b.s, b.w, b.n, b.w)]; }

  function vols() {
    return LIST.map(function (r, i) {
      return { id: i + 1, place: r[0], lat: r[1], lon: r[2], av: r[3] === 1, name: r[4] || "",
        label: r[4] || r[0], d: hav(WALKER.lat, WALKER.lon, r[1], r[2]) };
    });
  }

  function cellsFor(len, nb) {
    var c = geohash(WALKER.lat, WALKER.lon, len);
    var dla = c.n0 - c.s0;
    var dlo = c.e0 - c.w0;
    var cla = (c.s0 + c.n0) / 2;
    var clo = (c.w0 + c.e0) / 2;
    var out = [];
    var steps = nb ? [-1, 0, 1] : [0];
    steps.forEach(function (i) {
      steps.forEach(function (j) {
        var g = geohash(cla + i * dla, clo + j * dlo, len);
        g.mine = i === 0 && j === 0;
        out.push(g);
      });
    });
    return out;
  }

  function search(V, C) {
    var avail = V.filter(function (v) { return v.av; });
    var res = { cells: [], found: [], paged: [], phones: 0 };
    if (C.all) {
      res.found = V.slice();
      res.paged = avail.slice();
      res.phones = V.length;
    } else {
      res.cells = cellsFor(C.len, C.nb);
      var set = {};
      res.cells.forEach(function (g) { set[g.s] = true; });
      res.found = avail.filter(function (v) { return set[geohash(v.lat, v.lon, C.len).s]; });
      if (C.rank) {
        res.found.sort(function (a, b) { return a.d - b.d; });
        res.paged = res.found.slice(0, FEW);
      } else {
        res.paged = res.found.slice();
      }
      res.phones = res.paged.length;
    }
    var best = null;
    res.paged.forEach(function (v) { if (v.av && (best === null || v.d < best.d)) best = v; });
    res.best = best;
    var truest = null;
    avail.forEach(function (v) { if (truest === null || v.d < truest.d) truest = v; });
    res.truest = truest;
    var ids = {};
    res.paged.forEach(function (v) { ids[v.id] = true; });
    res.nearer = avail.filter(function (v) { return !ids[v.id] && (best === null || v.d < best.d); }).length;
    return res;
  }

  function quad(V, b, cap, depth) {
    if (V.length <= cap || depth >= 10) return { b: b, pts: V, leaf: true, depth: depth };
    var mla = (b.s + b.n) / 2;
    var mlo = (b.w + b.e) / 2;
    var qs = [{ s: b.s, n: mla, w: b.w, e: mlo }, { s: b.s, n: mla, w: mlo, e: b.e },
      { s: mla, n: b.n, w: b.w, e: mlo }, { s: mla, n: b.n, w: mlo, e: b.e }];
    return { b: b, leaf: false, depth: depth, kids: qs.map(function (q) {
      return quad(V.filter(function (p) { return p.lat >= q.s && p.lat < q.n && p.lon >= q.w && p.lon < q.e; }), q, cap, depth + 1);
    }) };
  }
  function leaves(t, out) {
    if (t.leaf) out.push(t); else t.kids.forEach(function (k) { leaves(k, out); });
    return out;
  }
  function leafAt(t, lat, lon) {
    if (t.leaf) return t;
    for (var i = 0; i < t.kids.length; i++) {
      var b = t.kids[i].b;
      if (lat >= b.s && lat < b.n && lon >= b.w && lon < b.e) return leafAt(t.kids[i], lat, lon);
    }
    return t;
  }

  /* ---------- drawing ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var MAP = { s: 56.06, n: 56.615, w: -4.95, e: -3.84, W: 600, H: 540 };
  var ZOOM = { s: 56.2462, n: 56.2532, w: -4.305, e: -4.270, W: 600, H: 240 };
  var COSL = Math.cos(56.34 * Math.PI / 180);

  function proj(V, lat, lon) {
    var k = (V.W - 40) / ((V.e - V.w) * COSL);
    return [20 + (lon - V.w) * COSL * k, 20 + (V.n - lat) * k];
  }
  function f1(x) { return String(Math.round(x * 10) / 10); }
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var a in attrs) if (Object.prototype.hasOwnProperty.call(attrs, a)) e.setAttribute(a, String(attrs[a]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, g, x, y, s, cls, anchor) {
    var t = mk(doc, "text", { x: f1(x), y: f1(y), "class": cls, "text-anchor": anchor || "start" }, g);
    t.textContent = s;
    return t;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }
  function rectOf(V, b, g, doc, cls) {
    var p0 = proj(V, b.n0 !== undefined ? b.n0 : b.n, b.w0 !== undefined ? b.w0 : b.w);
    var p1 = proj(V, b.s0 !== undefined ? b.s0 : b.s, b.e0 !== undefined ? b.e0 : b.e);
    return mk(doc, "rect", { x: f1(p0[0]), y: f1(p0[1]), width: f1(p1[0] - p0[0]), height: f1(p1[1] - p0[1]), "class": cls || "", fill: "none" }, g);
  }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    var box = doc.createElement("div");
    box.setAttribute("style", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = doc.createElement("p");
    head.setAttribute("style", "margin:0;font-size:12px;");
    box.appendChild(head);
    var svg = mk(doc, "svg", { viewBox: "0 0 600 540", width: "100%", "class": "dg", role: "img",
      "aria-label": "Map of the nine 4-character geohash cells around the walker on Ben Ledi. Searched cells are shaded. Green dots are paged volunteers, amber dots available but not paged, grey dots not available. The walker is the ringed dot just north of the 56.25 degree line." }, null);
    var g = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var zsvg = mk(doc, "svg", { viewBox: "0 0 600 240", width: "100%", "class": "dg", role: "img",
      "aria-label": "Close-up of the ridge, about 2 km across. The cell line at 56.25 degrees north runs across it, with gfhb above and gcuz below. The old parish wall crosses the ridge at almost the same place. The walker is 400 m north of the hut." }, null);
    var zg = mk(doc, "g", {}, zsvg);
    box.appendChild(zsvg);
    api.root.appendChild(box);
    return { doc: doc, head: head, g: g, zg: zg };
  }

  function draw(api) {
    var S = api.state;
    var ui = S.ui;
    var doc = ui.doc;
    var g = ui.g;
    var res = S.res;
    var C = S.C;
    clear(g);
    // searched cells
    res.cells.forEach(function (c) {
      var gg = mk(doc, "g", { "class": "dg-node st-" + (c.mine ? "accent" : "ok") }, g);
      rectOf(MAP, c, gg, doc, "");
    });
    // grid lines for the chosen length, when they fit
    var c0 = geohash(WALKER.lat, WALKER.lon, C.len);
    var dla = c0.n0 - c0.s0;
    var dlo = c0.e0 - c0.w0;
    if ((MAP.e - MAP.w) / dlo <= 40) {
      var d = "";
      var x;
      for (x = Math.ceil((MAP.w + 180) / dlo) * dlo - 180; x <= MAP.e; x += dlo) {
        var a = proj(MAP, MAP.n, x);
        d += "M" + f1(a[0]) + " 20V" + f1(proj(MAP, MAP.s, x)[1]);
      }
      for (x = Math.ceil((MAP.s + 90) / dla) * dla - 90; x <= MAP.n; x += dla) {
        var y = proj(MAP, x, MAP.w)[1];
        d += "M20 " + f1(y) + "H" + f1(proj(MAP, x, MAP.e)[0]);
      }
      mk(doc, "path", { d: d, "class": "dg-axis", fill: "none" }, g);
    }
    // quadtree leaves
    if (C.showQuad) {
      var qd = "";
      S.qleaves.forEach(function (l) {
        var q0 = proj(MAP, l.b.n, l.b.w);
        var q1 = proj(MAP, l.b.s, l.b.e);
        qd += "M" + f1(q0[0]) + " " + f1(q0[1]) + "H" + f1(q1[0]) + "V" + f1(q1[1]) + "H" + f1(q0[0]) + "Z";
      });
      mk(doc, "path", { d: qd, "class": "dg-axis", fill: "none" }, g);
    }
    // the walker first, so the volunteers' dots stay visible on top
    var wp = proj(MAP, WALKER.lat, WALKER.lon);
    var wg = mk(doc, "g", { "class": "dg-node st-bad" }, g);
    mk(doc, "circle", { cx: f1(wp[0]), cy: f1(wp[1]), r: 8 }, wg);
    txt(doc, g, wp[0] + 12, wp[1] - 10, "Catriona", "dg-note", "start");
    // volunteers
    var paged = {};
    res.paged.forEach(function (v) { paged[v.id] = true; });
    S.V.forEach(function (v) {
      var p = proj(MAP, v.lat, v.lon);
      var st = paged[v.id] || (C.all) ? "ok" : (v.av ? "warn" : "muted");
      var gg = mk(doc, "g", { "class": "dg-node st-" + st }, g);
      mk(doc, "circle", { cx: f1(p[0]), cy: f1(p[1]), r: v.av ? 4 : 2.5 }, gg);
    });
    var places = [["Callander", 56.2445, -4.2150, 18], ["Strathyre", 56.3195, -4.32, -10], ["Killin", 56.466, -4.318, -10],
      ["Crianlarich", 56.39, -4.618, -10], ["Doune", 56.19, -4.052, -10], ["Aberfoyle", 56.179, -4.383, 16], ["Comrie", 56.375, -3.99, -10]];
    places.forEach(function (pl) {
      var p = proj(MAP, pl[1], pl[2]);
      txt(doc, g, p[0], p[1] + pl[3], pl[0], "dg-axis", "middle");
    });
    txt(doc, g, 24, 534, "Prefix " + C.len + ": cells " + S.cellSize + ". Shaded: cells searched.", "dg-axis", "start");

    // close-up
    var z = ui.zg;
    clear(z);
    var ly = proj(ZOOM, 56.25, ZOOM.w)[1];
    mk(doc, "path", { d: "M20 " + f1(ly) + "H580", "class": "dg-axis", fill: "none" }, z);
    txt(doc, z, 576, ly - 6, "56.25 N  gfhb above", "dg-axis", "end");
    txt(doc, z, 576, ly + 16, "gcuz below", "dg-axis", "end");
    var r1 = proj(ZOOM, 56.2440, -4.2720);
    var r2 = proj(ZOOM, WALKER.lat, WALKER.lon);
    var r3 = proj(ZOOM, 56.2545, -4.3040);
    mk(doc, "path", { d: "M" + f1(r1[0]) + " " + f1(r1[1]) + "L" + f1(r2[0]) + " " + f1(r2[1]) + "L" + f1(r3[0]) + " " + f1(r3[1]), "class": "dg-axis", fill: "none" }, z);
    var w1 = proj(ZOOM, 56.2492, -4.3050);
    var w2 = proj(ZOOM, 56.2508, -4.2700);
    mk(doc, "path", { d: "M" + f1(w1[0]) + " " + f1(w1[1]) + "L" + f1(w2[0]) + " " + f1(w2[1]), "class": "dg-axis", "stroke-dasharray": "2 4", fill: "none" }, z);
    txt(doc, z, 30, w1[1] - 8, "old parish wall", "dg-axis", "start");
    var rl = proj(ZOOM, 56.2470, -4.2789);
    txt(doc, z, rl[0] + 10, rl[1] + 4, "ridge", "dg-axis", "start");
    var hv = S.V[0];
    var hp = proj(ZOOM, hv.lat, hv.lon);
    var hg = mk(doc, "g", { "class": "dg-node st-" + (paged[hv.id] || C.all ? "ok" : "warn") }, z);
    mk(doc, "circle", { cx: f1(hp[0]), cy: f1(hp[1]), r: 6 }, hg);
    txt(doc, z, hp[0] + 10, hp[1] + 4, "hut: Torcuil, " + fmtD(hv.d) + (paged[hv.id] || C.all ? ", paged" : ", not paged"), "dg-note", "start");
    var zg2 = mk(doc, "g", { "class": "dg-node st-bad" }, z);
    mk(doc, "circle", { cx: f1(r2[0]), cy: f1(r2[1]), r: 7, fill: "none" }, zg2);
    txt(doc, z, r2[0] + 12, r2[1] - 8, "Catriona, gfhbn2", "dg-note", "start");
  }

  /* ---------- state changes ---------- */

  function describe(S) {
    var C = S.C;
    var res = S.res;
    if (C.all) return "Whole team paged: " + res.phones + " phones ring. Nearest available paged: " + res.best.label + ", " + fmtD(res.best.d) + ".";
    var s = "Prefix " + C.len + " characters, " + (C.nb ? "her cell and 8 neighbours" : "her cell only") + " (" +
      res.cells.map(function (c) { return c.s; }).join(", ") + "). " + res.found.length + " available found, " + res.phones + " paged" +
      (C.rank ? " (the nearest " + FEW + ")" : (res.found.length ? " (all found, unranked)" : "")) + ".";
    if (C.rank && res.paged.length) s += " Paged: " + res.paged.map(function (v) { return v.label + " " + fmtD(v.d); }).join(", ") + ".";
    s += res.best ? " Nearest paged: " + res.best.label + ", " + fmtD(res.best.d) + "." : " Nobody paged.";
    if (res.nearer && res.best) s += " " + res.nearer + " available volunteers nearer were not paged, the nearest " + res.truest.label + " at " + fmtD(res.truest.d) + ".";
    else if (res.nearer) s += " All " + res.nearer + " available volunteers were missed, the nearest " + res.truest.label + " at " + fmtD(res.truest.d) + ".";
    return s;
  }

  function recompute(api, what) {
    var S = api.state;
    var C = S.C;
    S.res = search(S.V, C);
    var c0 = geohash(WALKER.lat, WALKER.lon, C.len);
    var sz = boxSize({ s: c0.s0, n: c0.n0, w: c0.w0, e: c0.e0 });
    S.cellSize = fmtBox(sz[0], sz[1]);
    var tree = quad(S.V, BLOCK, C.cap, 0);
    S.qleaves = leaves(tree, []);
    var tl = leafAt(tree, TOWN.lat, TOWN.lon).b;
    var hl = leafAt(tree, WALKER.lat, WALKER.lon).b;
    var ts = boxSize(tl);
    var hs = boxSize(hl);
    S.qtown = fmtBox(ts[0], ts[1]);
    S.qhill = fmtBox(hs[0], hs[1]);
    var res = S.res;
    S.ui.head.textContent = "Call at 23:10 from " + WALKER.name + ", 56.2512 N, 4.2885 W (geohash gfhbn2). " +
      (C.all ? "Paging the whole team." : "Prefix " + C.len + ", " + (C.nb ? "with neighbours" : "her cell only") + ", " + (C.rank ? "nearest " + FEW + " by distance." : "no ranking."));
    S.stat.phones(res.phones);
    S.stat.nearest(res.best ? fmtD(res.best.d) : "nobody");
    S.stat.truenear(fmtD(res.truest.d));
    S.stat.nearer(res.nearer);
    S.stat.cells(res.cells.length);
    S.stat.found(res.found.length);
    S.stat.cellsize(S.cellSize);
    S.stat.qleaves(S.qleaves.length);
    S.stat.qtown(S.qtown);
    S.stat.qhill(S.qhill);
    if (what) api.log(what + " " + describe(S), res.nearer ? "bad" : "ok");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s3e15", {
    startClock: 23 * 3600 + 10 * 60,
    speed: 0,
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.geohash = function (lat, lon, n) { return geohash(lat, lon, n).s; };
      S.V = vols();
      S.C = { len: 4, nb: false, rank: false, all: false, cap: 4, showQuad: false };
      S.ui = buildWidget(api);
      S.ctl = {};
      function syncControls() {
        S.ctl.len.set(S.C.len);
        S.ctl.nb.set(S.C.nb);
        S.ctl.rank.set(S.C.rank);
        S.ctl.all.set(S.C.all);
      }
      S.ctl.preset = api.control.select("preset", "Try a reply", PRESETS.map(function (p) { return { value: p.value, label: p.label }; }), "asran", function (v) {
        var p = null;
        PRESETS.forEach(function (x) { if (x.value === String(v)) p = x; });
        if (!p) return;
        S.C.len = p.C.len; S.C.nb = p.C.nb; S.C.rank = p.C.rank; S.C.all = p.C.all;
        syncControls();
        recompute(api, p.label + ".");
      });
      S.ctl.len = api.control.range("len", "Geohash prefix length", 3, 6, 1, 4, function (v) {
        var x = Math.max(3, Math.min(6, Math.round(Number(v))));
        if (!isFinite(x) || x === S.C.len) return;
        S.C.len = x;
        recompute(api, "Prefix length " + x + ".");
      });
      S.ctl.nb = api.control.toggle("nb", "Also search the 8 neighbouring cells", false, function (on) {
        S.C.nb = !!on;
        recompute(api, "Neighbours " + (on ? "on." : "off."));
      });
      S.ctl.rank = api.control.toggle("rank", "Rank by real distance, page the nearest 3", false, function (on) {
        S.C.rank = !!on;
        recompute(api, "Ranking " + (on ? "on." : "off."));
      });
      S.ctl.all = api.control.toggle("all", "Page the whole team", false, function (on) {
        S.C.all = !!on;
        recompute(api, "Whole team " + (on ? "on." : "off."));
      });
      S.ctl.quad = api.control.toggle("quad", "Draw the quadtree", false, function (on) {
        S.C.showQuad = !!on;
        draw(api);
      });
      S.ctl.cap = api.control.range("cap", "Quadtree leaf capacity", 1, 8, 1, 4, function (v) {
        var x = Math.max(1, Math.min(8, Math.round(Number(v))));
        if (!isFinite(x) || x === S.C.cap) return;
        S.C.cap = x;
        recompute(api, "");
        api.log("Quadtree leaf capacity " + x + ": " + S.qleaves.length + " leaves. Callander's leaf " + S.qtown + ", her leaf " + S.qhill + ".", "");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        phones: api.stat("phones", "phones ringing", "warn"),
        nearest: api.stat("nearest", "nearest available paged", "bad"),
        truenear: api.stat("truenear", "nearest available on the map", "ok"),
        nearer: api.stat("nearer", "available and nearer, not paged", "bad"),
        cells: api.stat("cells", "cells searched", ""),
        found: api.stat("found", "volunteers found", ""),
        cellsize: api.stat("cellsize", "cell size at her latitude", ""),
        qleaves: api.stat("qleaves", "quadtree leaves", ""),
        qtown: api.stat("qtown", "Callander's quadtree leaf", ""),
        qhill: api.stat("qhill", "her quadtree leaf", "")
      };

      api.info("<strong>How to read it.</strong> Each dot is a volunteer's last phone position: green paged, amber available but not paged, grey not available. The ringed dot is Catriona. Shaded boxes are the geohash cells searched; the lines are the cell grid at the chosen prefix length. The close-up below shows the ridge, the old wall and the cell line at 56.25 N.");

      recompute(api, "");
      api.log("The call-out as it ran at 23:10. " + describe(S), "bad");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      var S = t.api.state;

      // 1. The opening state: the app as it ran at 23:10.
      t.expect(t.stat("phones") === 3 && t.stat("nearest") === "7.8 km" && t.stat("truenear") === "400 m" &&
        t.stat("nearer") === 14 && t.stat("cells") === 1 && t.stat("found") === 3 && t.stat("cellsize") === "21.7 x 19.5 km" &&
        t.logText().indexOf("Nearest paged: Fingal Lumsden, 7.8 km. 14 available volunteers nearer were not paged, the nearest Torcuil Rintoul at 400 m.") >= 0,
        "Opens as it ran: cell gfhb only, 3 paged, nearest 7.8 km against Torcuil at 400 m");

      // 2. Geohashes of stated points.
      t.expect(S.geohash(56.249, -4.30, 4) === "gcuz" && S.geohash(56.251, -4.30, 4) === "gfhb" &&
        S.geohash(56.2512, -4.2885, 6) === "gfhbn2" && S.geohash(56.2477, -4.2870, 6) === "gcuzyr",
        "56.249 N 4.30 W is gcuz, 56.251 N is gfhb; Catriona gfhbn2, the hut gcuzyr");

      // 3. Reply A: a longer prefix finds nobody.
      begin();
      t.set("preset", "longer");
      t.expect(t.stat("phones") === 0 && t.stat("nearest") === "nobody" && t.stat("found") === 0 && t.stat("cellsize") === "2.7 x 4.9 km" &&
        has("(gfhbn). 0 available found, 0 paged. Nobody paged."),
        "5 characters: cell gfhbn, 2.7 x 4.9 km, nobody found, nobody paged");
      t.set("len", 6);
      t.expect(t.stat("found") === 0 && t.stat("cellsize") === "680 x 610 m", "6 characters: 680 x 610 m, still nobody");

      // 4. Reply B: a shorter prefix pages more, unranked, and still misses Torcuil.
      t.set("preset", "shorter");
      t.expect(t.stat("phones") === 6 && t.stat("nearest") === "7.8 km" && t.stat("nearer") === 14 && t.stat("cellsize") === "86.9 x 156.4 km",
        "3 characters: 6 paged, nearest still 7.8 km, 14 nearer missed");

      // 5. Reply C: the whole team.
      t.set("preset", "all");
      t.expect(t.stat("phones") === 60 && t.stat("nearest") === "400 m", "Whole team: 60 phones, Torcuil among them at 400 m");

      // 6. Reply D: nine cells, rank, nearest 3.
      begin();
      t.set("preset", "nine");
      t.expect(t.stat("cells") === 9 && t.stat("found") === 27 && t.stat("phones") === 3 && t.stat("nearest") === "400 m" && t.stat("nearer") === 0 &&
        has("Paged: Torcuil Rintoul 400 m, Kilmahog 2.6 km, Callander 3.4 km."),
        "9 cells: 27 found, the nearest 3 paged: Torcuil 400 m, Kilmahog 2.6 km, Callander 3.4 km");

      // 7. Neighbours without ranking ring everyone found; ranking without neighbours still misses.
      t.click("rank");
      var unranked = t.stat("phones");
      t.click("nb");
      t.click("rank");
      t.expect(unranked === 27 && t.stat("phones") === 3 && t.stat("nearest") === "7.8 km",
        "Neighbours alone ring 27 phones; ranking alone pages Fingal at 7.8 km");

      // 8. Prefix length from the radius: 5 characters with neighbours is enough here, 6 barely.
      t.click("nb");
      t.set("len", 5);
      var f5 = t.stat("found");
      t.set("len", 6);
      t.expect(f5 === 8 && t.stat("found") === 1 && t.stat("nearest") === "400 m",
        "With neighbours: 5 characters finds 8, 6 characters finds only Torcuil");

      // 9. Quadtree: small leaves in town, big ones on the hills.
      t.expect(t.stat("qleaves") === 40 && t.stat("qtown") === "510 x 460 m" && t.stat("qhill") === "8.2 x 7.3 km",
        "Capacity 4: 40 leaves, Callander's 510 x 460 m, hers 8.2 x 7.3 km");
      t.set("cap", 1);
      t.expect(t.stat("qleaves") === 235 && t.logText().indexOf("Quadtree leaf capacity 1: 235 leaves.") >= 0,
        "Capacity 1: 235 leaves");
    }
  });
})();
