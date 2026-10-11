/* sims/s3e17-v1.0.0.js  (published as sims/s3e17.js)
   Case s3e17 "Field Report: A Million Writes a Second": a sizing and burst lab for Cressbeck
   Water's night upload. 1.2 million smart meters send their day to a Cassandra cluster through
   32 gateways. The learner changes the node count, the row size, whether the uploads keep their
   schedule or are spread over two hours, the dashboard reads and the consistency level, plays the
   night minute by minute to the 06:00 morning report, and runs a step-by-step benchmark that
   shows where per-node throughput bends. Widget-style sim: it draws its own charts in api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: nodes 6 to 48; rows 400 B, 4 KB, 8 KB; as scheduled or
     spread over two hours; dashboards on or off; LOCAL_QUORUM or ONE; Next 10 minutes; Play to
     the morning report; Benchmark (the night's shape, or ten minutes at the peak, in 8 steps of
     25%). Stats: time, rows offered and landed a second, bytes per node per second at the peak,
     backlog per node, timeouts, batches dropped, the report's zeros. selfTest: 12 assertions.

   The model (stated in sim.lede). Units: 4 KB = 4,096 bytes, 8 KB = 8,192, MB = 1,000,000 bytes.
   - 32 gateways, G01 to G32, 37,500 meters each (1,200,000). A meter's day is 96 rows sent as one
     batch, which lands whole or not at all. A gateway sends 2,000 rows a second (120,000 a minute)
     for 30 minutes: 3,600,000 rows. As scheduled: G01 to G23 (west and centre, 862,500 meters)
     from 02:00, G24 to G32 (the east bank, 337,500 meters) from 02:30. Spread: every gateway sends
     500 rows a second from 02:00 to 04:00 (16,000 a second in all).
   - Bytes landing on each node a second = rows landed a second x row bytes x 3 copies / nodes.
   - Backlog per node (MB of new SSTables waiting for compaction): each minute it gains the bytes
     landed on the node and loses what compaction clears, 12 MB/s with dashboards reading, 20 MB/s
     without (Cressbeck's own figures, from the benchmark in Part 2; invented for the story).
   - Stall point: when the backlog ends a minute at 63,000 MB (63 GB) or more, flushes wait and so
     does every write, from the next minute, until compaction has cleared the backlog to zero.
   - The head-end holds a waiting batch for 10 minutes, then reports a timeout. The meter retries
     at once, three times at most; the fourth timeout drops the batch. While the cluster writes,
     every waiting batch and every new one lands that minute.
   - Consistency level: LOCAL_QUORUM waits for 2 of the 3 copies, ONE for 1; all three copies are
     written either way, so the backlog, timeouts and drops are the same.
   - The morning report (06:00) sums each meter's readings and prints 0 for a meter with none.
     Cressbeck General's meter is on G27 and wakes in G27's first minute (02:30 as scheduled).

   Where every number comes from (conventions rule 14; the case is content/s3/s3e17-v1.0.0.json).
   - The post (Netflix Tech Blog, 2 November 2011): 1,100,000 client writes a second on 288
     nodes = 3,819.4 per node; 3 copies of about 400 bytes: 1,100,000 x 400 x 3 / 288 =
     4,583,333 B/s = 4.58 MB/s per node. Ansgar's sizing: 46,000 / 3,819.4 = 12.04, so 12 nodes;
     12 x 3,819.4 = 45,833.
   - Peak: 23 gateways x 2,000 = 46,000 rows a second. Total 32 x 3,600,000 = 115,200,000 rows.
   - Story, 12 nodes, 4 KB: 46,000 x 4,096 x 3 / 12 = 47,104,000 B/s = 47.1 MB/s per node, 10.3
     times the post's. The backlog grows 35.104 MB a second, 2,106.24 MB a minute: 61,081.0 MB at
     02:29 and 63,187.2 at 02:30, past 63,000, so the stall starts at 02:30, the minute G24 wakes.
     Every west batch landed. East batches from 02:30 wait; first timeouts 02:40; first drops
     03:10; last drops 03:39 (02:59 + 40 min). 337,500 batches dropped (32,400,000 rows), all on
     G24 to G32, 37,500 each; 1,350,000 timeouts (4 per batch); 82,800,000 rows landed. The
     backlog clears at 720 MB a minute: 63,187.2 / 720 = 87.8, so writes resume at 03:58.
     Morning report: 337,500 zeros, the hospital (G27) among them.
   - 24 nodes, 4 KB: 23.6 MB/s per node, backlog peaks at 20.8 GB, nothing dropped.
     24 nodes, 8 KB: 47.1 MB/s per node, the story's night again, to the minute.
   - Consistency ONE: identical to LOCAL_QUORUM. Dashboards off (20 MB/s): peak 48.8 GB, nothing
     dropped. Spread, 4 KB: 16.4 MB/s per node, peak 31.6 GB, nothing dropped. Spread, 8 KB:
     32.8 MB/s per node, stall at 02:51, 500,000 batches dropped, 15,625 on every gateway.
   - 13 nodes still drop 90,000 batches (stall at 02:52); 14 is the fewest that drop none at 4 KB.
     32 nodes: 17.7 MB/s per node at 4 KB (peak 10.2 GB); 35.3 MB/s at 8 KB (peak 45.3 GB), no
     drops.
   - Benchmark, the night's shape, 12 nodes, 4 KB, steps of 25%: 11.8, 23.6, 35.3 MB/s per node at
     the peak land every row; 47.1 lands 71.9%; it bends between 35.3 and 47.1. Ten minutes at the
     peak (the post's length): every step to 94.2 MB/s lands every row; no bend found.
*/
(function () {
  "use strict";

  var GW = 32, MPG = 37500, RPM = 96, GRATE = 120000, LIMIT = 63000, MINS = 240;
  var EAST0 = 23;            // G24 is index 23
  var HOSP = 26;             // G27; the hospital's meter wakes in G27's first minute
  function hospMin(C) { return C.shape === "spread" ? 0 : 30; }
  var ROWS = [
    { value: 400, label: "400 B (the post's write)" },
    { value: 4096, label: "4 KB (our rows)" },
    { value: 8192, label: "8 KB (a pressure-event night)" }
  ];
  var SHAPES = [
    { value: "sched", label: "As scheduled: G01-G23 at 02:00, G24-G32 at 02:30" },
    { value: "spread", label: "Spread over two hours (new firmware)" }
  ];
  var CLS = [
    { value: "LOCAL_QUORUM", label: "LOCAL_QUORUM (2 of 3 copies)" },
    { value: "ONE", label: "ONE (1 of 3 copies)" }
  ];
  var BLENS = [
    { value: "night", label: "The night's shape (two hours)" },
    { value: "ten", label: "Ten minutes at the peak (the post's length)" }
  ];

  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function hm(m) { var t = 120 + m; return (t < 600 ? "0" : "") + Math.floor(t / 60) + ":" + (t % 60 < 10 ? "0" : "") + (t % 60); }
  function rowName(b) { return b === 400 ? "400 B" : (b / 1024) + " KB"; }
  function gname(i) { return "G" + (i < 9 ? "0" : "") + (i + 1); }
  function perNode(rowsPerSec, C) { return rowsPerSec * C.rowB * 3 / C.N / 1e6; }
  function peakRows(C) { return C.shape === "spread" ? 16000 : 46000; }

  /* ---------- the model ---------- */

  function arrivals(C, m, mult) {
    var a = new Array(GW);
    for (var g = 0; g < GW; g++) {
      var r = 0;
      if (C.shape === "spread") { if (m < 120) r = GRATE / 4; }
      else { var s = g < EAST0 ? 0 : 30; if (m >= s && m < s + 30) r = GRATE; }
      a[g] = r * mult;
    }
    return a;
  }

  // One night, minute by minute. ten: a constant load at the peak for ten minutes (benchmark).
  function night(C, mult, ten) {
    var clear = (C.dash ? 12 : 20) * 60;
    var D = 0, stalled = false, pend = [], R = {
      off: 0, acc: 0, to: 0, drop: 0, dropG: [], peakD: 0, stallAt: -1, resumeAt: -1,
      firstTO: -1, firstDrop: -1, lastDrop: -1, mins: [], ev: []
    };
    var g;
    for (g = 0; g < GW; g++) R.dropG.push(0);
    for (var m = 0; m < MINS; m++) {
      var arr;
      if (ten) { arr = []; for (g = 0; g < GW; g++) arr.push(m < 10 ? peakRows(C) * 60 * mult / GW : 0); }
      else arr = arrivals(C, m, mult);
      var nr = 0;
      for (g = 0; g < GW; g++) nr += arr[g];
      R.off += nr;
      var to = 0, dr = 0, keep = [];
      pend.forEach(function (p) {
        if (m - p.s < 10) { keep.push(p); return; }
        to += p.rows / RPM;
        if (p.k < 3) { p.k += 1; p.s = m; keep.push(p); return; }
        dr += p.rows / RPM;
        for (var i = 0; i < GW; i++) R.dropG[i] += p.g[i] / RPM;
        if (p.a === hospMin(C) && p.g[HOSP] > 0) R.hosp = true;
      });
      pend = keep;
      if (to && R.firstTO < 0) { R.firstTO = m; R.ev.push([m, "First batches time out after 10 minutes waiting. Meters retry, three times at most.", "warn"]); }
      if (dr) {
        if (R.firstDrop < 0) { R.firstDrop = m; R.ev.push([m, "First batches dropped after three retries.", "bad"]); }
        R.lastDrop = m;
      }
      R.to += to;
      R.drop += dr;
      var acc = 0;
      if (!stalled) { pend.forEach(function (p) { acc += p.rows; }); pend = []; acc += nr; }
      else if (nr > 0) pend.push({ a: m, s: m, k: 0, rows: nr, g: arr });
      R.acc += acc;
      D = Math.max(0, D + acc * C.rowB * 3 / C.N / 1e6 - clear);
      if (D > R.peakD) R.peakD = D;
      R.mins.push({ off: nr / 60, acc: acc / 60, D: D, to: R.to, drop: R.drop });
      if (!stalled && D >= LIMIT) {
        stalled = true;
        if (R.stallAt < 0) R.stallAt = m + 1;
        R.ev.push([m + 1, "Backlog " + f1(D / 1000) + " GB per node, past the 63 GB stall point: flushes wait, and every write waits with them.", "bad"]);
      } else if (stalled && D <= 0) {
        stalled = false;
        R.resumeAt = m + 1;
        R.ev.push([m + 1, "Backlog cleared. Writes resume.", "ok"]);
      }
    }
    if (R.lastDrop >= 0) R.ev.push([R.lastDrop, "Last batches dropped. " + fmt(R.drop) + " batches dropped in all" + dropWhere(R) + ".", "bad"]);
    return R;
  }

  function dropWhere(R) {
    var hit = [];
    for (var i = 0; i < GW; i++) if (Math.round(R.dropG[i]) > 0) hit.push(i);
    if (!hit.length) return "";
    if (hit.length === GW) return ", from every gateway";
    if (hit[0] === EAST0 && hit.length === GW - EAST0) return ", every one from G24 to G32";
    return ", from " + hit.length + " gateways";
  }

  function story(C) {
    var R = night(C, 1, false);
    var ev = [];
    if (C.shape === "spread") {
      ev.push([0, "All 32 gateways wake their meters evenly from 02:00 to 04:00: 16,000 rows a second offered, " + f1(perNode(16000, C)) + " MB/s per node (the post: 4.58 MB/s).", ""]);
    } else {
      ev.push([0, "G01 to G23 wake 862,500 meters: 46,000 rows a second offered, " + f1(perNode(46000, C)) + " MB/s per node (the post: 4.58 MB/s).", ""]);
      ev.push([30, "G24 to G32 wake 337,500 meters on the east bank: 18,000 rows a second offered.", ""]);
    }
    // At the same minute, the backlog line (state before the minute) comes before a wake line.
    R.ev.forEach(function (e) { ev.push(e); });
    ev.sort(function (a, b) { return (a[0] - b[0]) || (rank(a) - rank(b)); });
    var zeros = Math.round(R.drop);
    var rep = zeros === 0 ? "Morning report: every meter has its readings. No zeros." :
      "Morning report: " + fmt(zeros) + " meters used 0 litres overnight" + dropWhere(R).replace(", every one", ", all").replace(", from", ", on") +
      ". Cressbeck General (G27): " + (R.hosp ? "0." : "its readings, as usual.");
    ev.push([MINS, rep, zeros ? "bad" : "ok"]);
    R.story = ev;
    return R;
  }
  function rank(e) { return /^Backlog/.test(e[1]) ? 0 : (/wake/.test(e[1]) ? 1 : 2); }

  /* ---------- drawing ---------- */

  var NS = "http://www.w3.org/2000/svg";
  function mk(doc, tag, at, parent) {
    var e = doc.createElementNS(NS, tag);
    for (var k in at) if (Object.prototype.hasOwnProperty.call(at, k)) e.setAttribute(k, String(at[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function tx(doc, p, x, y, s, cls, anchor) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls || "dg-axis", "text-anchor": anchor || "start" }, p);
    t.textContent = s;
    return t;
  }
  function wipe(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function build(api) {
    var doc = api.root.ownerDocument;
    wipe(api.root);
    var box = doc.createElement("div");
    box.setAttribute("style", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = doc.createElement("p");
    head.setAttribute("style", "margin:0;font-size:12px;");
    box.appendChild(head);
    var svg = mk(doc, "svg", { viewBox: "0 0 660 330", width: "100%", "class": "dg", role: "img",
      "aria-label": "Two charts over the night from 02:00 to 06:00. Top: rows a second offered by the meters (dashed) and landed in the cluster (solid). Middle: the backlog per node in GB, with the 63 GB stall point as a dashed line. Bottom: the 32 gateways; red ones had batches dropped." });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var bsvg = mk(doc, "svg", { viewBox: "0 0 660 170", width: "100%", "class": "dg", role: "img",
      "aria-label": "Benchmark chart: for each load step, the per-node bytes offered at the peak (across) against the bytes per node that landed, averaged over the test (up). A straight line means every row landed; where it bends, the cluster fell behind." });
    var blayer = mk(doc, "g", {}, bsvg);
    box.appendChild(bsvg);
    api.root.appendChild(box);
    return { doc: doc, head: head, layer: layer, blayer: blayer };
  }

  var X0 = 50, XW = 2.5;     // 240 minutes x 2.5 = 600 px
  function xm(m) { return X0 + m * XW; }

  function drawNight(S) {
    var ui = S.ui, doc = ui.doc, g = ui.layer, R = S.R, upto = Math.min(S.m, MINS - 1);
    wipe(g);
    // axes
    tx(doc, g, 8, 16, "rows a second (offered dashed, landed solid)", "dg-axis");
    tx(doc, g, 8, 150, "backlog per node, GB (stall point 63)", "dg-axis");
    mk(doc, "path", { d: "M" + X0 + " 120H650M" + X0 + " 250H650", "class": "dg-axis" }, g);
    [0, 60, 120, 180, 240].forEach(function (m) { tx(doc, g, xm(m), 264, hm(m), "dg-axis", "middle"); });
    tx(doc, g, X0 - 6, 34, "50,000", "dg-axis", "end");
    tx(doc, g, X0 - 6, 120, "0", "dg-axis", "end");
    var ys = function (v) { return 120 - v / 50000 * 90; };
    var yd = function (v) { return 250 - v / 70000 * 90; };
    mk(doc, "path", { d: "M" + X0 + " " + yd(LIMIT) + "H650", "class": "dg-axis", "stroke-dasharray": "4 3" }, g);
    tx(doc, g, X0 - 6, yd(LIMIT) + 4, "63", "dg-axis", "end");
    if (upto >= 0) {
      var po = "", pa = "", pd = "";
      for (var m = 0; m <= upto; m++) {
        var r = R.mins[m];
        po += (m ? "L" : "M") + xm(m) + " " + f1(ys(r.off));
        pa += (m ? "L" : "M") + xm(m) + " " + f1(ys(r.acc));
        pd += (m ? "L" : "M") + xm(m) + " " + f1(yd(r.D));
      }
      mk(doc, "path", { d: po, fill: "none", "class": "dg-edge", "stroke-dasharray": "5 3" }, g);
      mk(doc, "path", { d: pa, fill: "none", "class": "dg-edge st-ok", "stroke-width": 2 }, g);
      mk(doc, "path", { d: pd, fill: "none", "class": "dg-edge st-warn", "stroke-width": 2 }, g);
    }
    // gateways, coloured once their drops are known (after the last drop, or at the report)
    var done = S.m >= MINS || (R.lastDrop >= 0 && S.m >= R.lastDrop);
    for (var i = 0; i < GW; i++) {
      var dg = Math.round(R.dropG[i]);
      var st = !done || S.m < 0 ? "" : (dg > 0 ? "st-bad" : "st-ok");
      var gg = mk(doc, "g", { "class": "dg-node " + st }, g);
      mk(doc, "rect", { x: X0 + i * 18.75, y: 286, width: 15, height: 18, rx: 2 }, gg);
    }
    tx(doc, g, X0, 320, "G01", "dg-axis");
    tx(doc, g, X0 + EAST0 * 18.75, 320, "G24 (east bank)", "dg-axis");
    tx(doc, g, X0 + HOSP * 18.75 + 7, 282, "G27 hospital", "dg-axis", "middle");
  }

  function drawBench(S) {
    var ui = S.ui, doc = ui.doc, g = ui.blayer, B = S.B;
    wipe(g);
    tx(doc, g, 8, 16, B ? "Benchmark: " + B.title : "Benchmark: press Benchmark to run 8 load steps on these settings.", "dg-axis");
    mk(doc, "path", { d: "M50 140H650M50 140V30", "class": "dg-axis" }, g);
    tx(doc, g, 650, 160, "MB/s per node offered at the peak", "dg-axis", "end");
    tx(doc, g, 56, 40, "MB/s per node landed", "dg-axis");
    if (!B) return;
    var mx = 0;
    B.pts.forEach(function (p) { mx = Math.max(mx, p.x, p.y); });
    var sc = function (v) { return v / (mx || 1) * 100; };
    var d = "";
    B.pts.forEach(function (p, k) {
      var x = 50 + sc(p.x) * 6, y = 140 - sc(p.y);
      d += (k ? "L" : "M") + f1(x) + " " + f1(y);
      var gg = mk(doc, "g", { "class": "dg-node " + (p.pct < 100 ? "st-bad" : "st-ok") }, g);
      mk(doc, "circle", { cx: f1(x), cy: f1(y), r: 4 }, gg);
    });
    mk(doc, "path", { d: d, fill: "none", "class": "dg-edge" }, g);
  }

  /* ---------- the module ---------- */

  function cfgText(C) {
    return C.N + " nodes, " + rowName(C.rowB) + " rows, " + (C.shape === "spread" ? "spread over two hours" : "as scheduled") +
      ", dashboards " + (C.dash ? "on" : "off") + ", " + C.cl;
  }

  function show(api) {
    var S = api.state, R = S.R, C = S.C, m = S.m;
    var cur = m >= 0 && m < MINS ? R.mins[m] : null;
    var last = m >= 0 ? R.mins[Math.min(m, MINS - 1)] : null;
    S.ui.head.textContent = cfgText(C) + ". The post's cluster: 3 copies, 4.58 MB/s per node.";
    S.st.time(m < 0 ? "01:59" : hm(Math.min(m, MINS)));
    S.st.off(cur ? fmt(cur.off) : "0");
    S.st.acc(cur ? fmt(cur.acc) : "0");
    S.st.bytes(f1(perNode(peakRows(C), C)) + " MB/s");
    S.st.backlog(f1(last ? last.D / 1000 : 0) + " GB");
    S.st.to(fmt(last ? last.to : 0));
    S.st.drop(fmt(last ? last.drop : 0));
    S.st.zeros(m >= MINS ? fmt(R.drop) : "not yet");
    S.st.nodes(C.N);
    drawNight(S);
    drawBench(S);
  }

  function advance(api, to) {
    var S = api.state;
    var from = S.m;
    to = Math.min(MINS, to);
    if (to <= from) return;
    S.R.story.forEach(function (e) {
      if (e[0] > from && e[0] <= to) { api.clock = 7200 + e[0] * 60; api.log(e[1], e[2]); }
    });
    if (to >= MINS && from < MINS) {
      var R = S.R;
      api.clock = 7200 + MINS * 60;
      api.log("Night over: " + fmt(R.off) + " rows offered, " + fmt(R.acc) + " landed, " + fmt(R.to) + " timeouts, " +
        fmt(R.drop) + " batches dropped; backlog peaked at " + f1(R.peakD / 1000) + " GB per node.", R.drop ? "bad" : "ok");
    }
    S.m = to;
    api.clock = 7200 + to * 60;
    show(api);
  }

  function recompute(api, why) {
    var S = api.state;
    S.R = story(S.C);
    S.m = -1;
    S.B = null;
    api.clock = 7140;
    api.log(why + " Now: " + cfgText(S.C) + "; " + f1(perNode(peakRows(S.C), S.C)) + " MB/s per node at the peak. Back to 01:59.", "");
    show(api);
  }

  function bench(api) {
    var S = api.state, C = S.C, ten = S.blen === "ten";
    var pts = [], bendLo = null, bendHi = null;
    api.clock = 7140;
    for (var k = 1; k <= 8; k++) {
      var mult = k * 0.25;
      var R = night(C, mult, ten);
      var x = perNode(peakRows(C) * mult, C);
      var y = R.acc * C.rowB * 3 / C.N / 1e6 / (ten ? 600 : 7200);
      var pct = R.off ? Math.round(R.acc * 1000 / R.off) / 10 : 100;
      pts.push({ x: x, y: y, pct: pct });
      if (pct < 100 && bendHi === null) { bendHi = x; bendLo = k > 1 ? pts[k - 2].x : 0; }
      api.log("Benchmark step " + k + " of 8: " + f1(x) + " MB/s per node at the peak, " + (pct < 100 ? f1(pct) + "% of rows landed." : "every row landed."), pct < 100 ? "bad" : "ok");
    }
    var sum = bendHi === null ?
      "No bend up to " + f1(pts[7].x) + " MB/s per node" + (ten ? ": ten minutes is too short for the backlog to reach the stall point." : ".") :
      "Bends between " + f1(bendLo) + " and " + f1(bendHi) + " MB/s per node at the peak.";
    api.log(sum, bendHi === null ? "warn" : "bad");
    S.B = { pts: pts, title: (ten ? "ten minutes at the peak" : "the night's shape") + ", " + C.N + " nodes, " + rowName(C.rowB) + ". " + sum };
    show(api);
  }

  DL.sims.define("s3e17", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      api.clock = 7140;
      S.C = { N: 12, rowB: 4096, shape: "sched", dash: true, cl: "LOCAL_QUORUM" };
      S.blen = "night";
      S.ui = build(api);
      S.ctl = {};
      S.ctl.nodes = api.control.range("nodes", "Nodes in the cluster", 6, 48, 1, 12, function (v) {
        var n = Math.max(6, Math.min(48, Math.round(Number(v))));
        if (!isFinite(n) || n === S.C.N) return;
        S.C.N = n;
        recompute(api, "Nodes: " + n + ".");
      });
      api.control.select("row", "Row size", ROWS, 4096, function (v) {
        S.C.rowB = Number(v);
        recompute(api, "Row size: " + rowName(S.C.rowB) + ".");
      });
      api.control.select("shape", "Upload times", SHAPES, "sched", function (v) {
        S.C.shape = String(v);
        recompute(api, S.C.shape === "spread" ? "Uploads spread over two hours." : "Uploads as scheduled.");
      });
      api.control.toggle("dash", "Dashboards reading", true, function (on) {
        S.C.dash = !!on;
        recompute(api, "Dashboards " + (on ? "on: compaction clears 12 MB/s per node." : "off: compaction clears 20 MB/s per node."));
      });
      api.control.select("cl", "Consistency level", CLS, "LOCAL_QUORUM", function (v) {
        S.C.cl = String(v);
        recompute(api, "Consistency " + S.C.cl + ": a write returns after " + (S.C.cl === "ONE" ? "1" : "2") +
          " of 3 copies, and all 3 are still written, so each node's work is the same.");
      });
      api.control.button("next", "Next 10 minutes", function () { advance(api, api.state.m < 0 ? 9 : api.state.m + 10); });
      api.control.button("play", "Play to the morning report", function () { advance(api, MINS); });
      api.control.select("blen", "Benchmark length", BLENS, "night", function (v) { S.blen = String(v); });
      api.control.button("bench", "Benchmark (8 steps of 25%)", function () { bench(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.st = {
        time: api.stat("time", "time", ""),
        off: api.stat("off", "rows a second offered", ""),
        acc: api.stat("acc", "rows a second landed", "ok"),
        bytes: api.stat("bytes", "bytes per node per second at the peak (the post: 4.58 MB/s)", "warn"),
        backlog: api.stat("backlog", "backlog per node (stall at 63 GB)", "warn"),
        to: api.stat("to", "timeouts", "warn"),
        drop: api.stat("drop", "batches dropped", "bad"),
        zeros: api.stat("zeros", "meters at 0 in the morning report", "bad"),
        nodes: api.stat("nodes", "nodes", "")
      };
      api.info("<strong>How to read it.</strong> Each meter sends its day as one batch of 96 rows. Every row is written as 3 copies, so each node takes rows x row size x 3 / nodes bytes a second. New SSTables wait for compaction; past 63 GB waiting on a node, writes stall until compaction catches up. A batch waits 10 minutes, then the meter retries, three times at most.");
      S.R = story(S.C);
      S.m = -1;
      S.B = null;
      show(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }

      // 1. Opens at 01:59, before the first gateway wakes.
      t.expect(t.stat("time") === "01:59" && t.stat("off") === 0 && t.stat("drop") === 0 && t.stat("to") === 0 &&
        t.stat("backlog") === "0.0 GB" && t.stat("bytes") === "47.1 MB/s" && t.stat("zeros") === "not yet" && t.stat("nodes") === 12,
        "Opens at 01:59: nothing offered yet, 12 nodes, 47.1 MB/s per node at the peak");

      // 2. The first ten minutes: the west burst, all landing.
      begin();
      t.click("next");
      t.expect(t.stat("time") === "02:09" && t.stat("off") === "46,000" && t.stat("acc") === "46,000" &&
        has("02:00:00 G01 to G23 wake 862,500 meters: 46,000 rows a second offered, 47.1 MB/s per node (the post: 4.58 MB/s)."),
        "02:00: 46,000 rows a second offered and landed, 47.1 MB/s per node against the post's 4.58");

      // 3. The story's night.
      begin();
      t.click("play");
      t.expect(has("02:30:00 Backlog 63.2 GB per node, past the 63 GB stall point") &&
        has("02:30:00 G24 to G32 wake 337,500 meters on the east bank: 18,000 rows a second offered.") &&
        has("02:40:00 First batches time out after 10 minutes waiting.") &&
        has("03:10:00 First batches dropped after three retries.") &&
        has("03:39:00 Last batches dropped. 337,500 batches dropped in all, every one from G24 to G32.") &&
        has("03:58:00 Backlog cleared. Writes resume."),
        "Stall at 02:30 with 63.2 GB per node; first timeouts 02:40; drops 03:10 to 03:39, all east; writes resume 03:58");
      t.expect(t.stat("drop") === "337,500" && t.stat("to") === "1,350,000" && t.stat("zeros") === "337,500" &&
        t.stat("backlog") === "0.0 GB" && t.api.state.R.acc === 82800000 && t.api.state.R.off === 115200000 &&
        has("06:00:00 Morning report: 337,500 meters used 0 litres overnight, all from G24 to G32. Cressbeck General (G27): 0.") &&
        has("115,200,000 rows offered, 82,800,000 landed, 1,350,000 timeouts, 337,500 batches dropped; backlog peaked at 63.2 GB per node."),
        "Morning report: 337,500 zeros, the hospital among them; 82,800,000 of 115,200,000 rows landed; 1,350,000 timeouts");

      // 4. Option 0: 24 nodes. The night passes; at 8 KB it is the story's night again.
      t.set("nodes", 24);
      t.click("play");
      var ok24 = t.stat("drop") === 0 && t.stat("bytes") === "23.6 MB/s" && t.api.state.R.peakD.toFixed(1) === "20793.6";
      t.set("row", 8192);
      begin();
      t.click("play");
      t.expect(ok24 && t.stat("bytes") === "47.1 MB/s" && t.stat("drop") === "337,500" && has("02:30:00 Backlog 63.2 GB per node"),
        "24 nodes: 23.6 MB/s per node, backlog peaks at 20.8 GB, nothing dropped; at 8 KB rows, 47.1 MB/s and the same 337,500 drops");

      // 5. Option 1: consistency ONE does the same work.
      t.set("nodes", 12);
      t.set("row", 4096);
      t.set("cl", "ONE");
      t.click("play");
      t.expect(t.stat("drop") === "337,500" && t.stat("to") === "1,350,000" && t.api.state.R.stallAt === 30,
        "Consistency ONE: the same stall at 02:30, the same 1,350,000 timeouts and 337,500 drops");
      t.set("cl", "LOCAL_QUORUM");

      // 6. Dashboards off: compaction clears 20 MB/s and keeps ahead.
      t.set("dash", false);
      t.click("play");
      t.expect(t.stat("drop") === 0 && t.api.state.R.peakD.toFixed(1) === "48787.2",
        "Dashboards off: backlog peaks at 48.8 GB, nothing dropped");
      t.set("dash", true);

      // 7. Option 3: spread over two hours. 4 KB passes; 8 KB stalls at 02:51 and drops on every gateway.
      t.set("shape", "spread");
      t.click("play");
      var sp4 = t.stat("drop") === 0 && t.stat("bytes") === "16.4 MB/s" && t.api.state.R.peakD.toFixed(1) === "31564.8";
      t.set("row", 8192);
      begin();
      t.click("play");
      t.expect(sp4 && has("02:51:00 Backlog 63.6 GB per node") && t.stat("drop") === "500,000" &&
        Math.round(t.api.state.R.dropG[0]) === 15625 && Math.round(t.api.state.R.dropG[31]) === 15625,
        "Spread: 16.4 MB/s per node and nothing dropped at 4 KB; at 8 KB a stall at 02:51 and 500,000 drops, 15,625 on every gateway");
      t.set("shape", "sched");
      t.set("row", 4096);

      // 8. Benchmark, the night's shape: per-node throughput bends between 35.3 and 47.1 MB/s.
      begin();
      t.click("bench");
      t.expect(has("Benchmark step 3 of 8: 35.3 MB/s per node at the peak, every row landed.") &&
        has("Benchmark step 4 of 8: 47.1 MB/s per node at the peak, 71.9% of rows landed.") &&
        has("Bends between 35.3 and 47.1 MB/s per node at the peak."),
        "Benchmark, the night's shape: every row lands to 35.3 MB/s per node; 47.1 lands 71.9%; it bends between them");

      // 9. Benchmark, ten minutes (the post's length): no bend found.
      t.set("blen", "ten");
      begin();
      t.click("bench");
      t.expect(has("Benchmark step 8 of 8: 94.2 MB/s per node at the peak, every row landed.") &&
        has("No bend up to 94.2 MB/s per node: ten minutes is too short for the backlog to reach the stall point."),
        "Benchmark, ten minutes at the peak: every step to 94.2 MB/s lands; no bend found");

      // 10. Option 2's sizing: 32 nodes carry an 8 KB night at 35.3 MB/s per node, the last clean step.
      t.set("nodes", 32);
      t.set("row", 8192);
      t.click("play");
      var p8 = t.stat("drop") === 0 && t.stat("bytes") === "35.3 MB/s" && t.api.state.R.peakD.toFixed(1) === "45273.6";
      t.set("row", 4096);
      t.click("play");
      t.expect(p8 && t.stat("drop") === 0 && t.stat("bytes") === "17.7 MB/s" && t.api.state.R.peakD.toFixed(1) === "10195.2",
        "32 nodes: 35.3 MB/s per node at 8 KB (peak 45.3 GB) and 17.7 at 4 KB (peak 10.2 GB), nothing dropped");

      // 11. 13 nodes still drop; 14 is the fewest that drop none at 4 KB.
      t.set("nodes", 13);
      t.click("play");
      var d13 = t.stat("drop") === "90,000" && t.api.state.R.stallAt === 52;
      t.set("nodes", 14);
      t.click("play");
      t.expect(d13 && t.stat("drop") === 0, "13 nodes still drop 90,000 batches (stall at 02:52); 14 drop none");
    }
  });
})();
