/* sims/s5e03-v1.0.0.js  (published as sims/s5e03.js)
   Case s5e03 "The Event Loop": an event-loop lab for Saltmarrow, a one-waiter restaurant whose one
   Node.js server takes the waiters' orders, pushes each new order down the kitchen screen's open
   connection, and sends the screen a clock tick every second. A receipt rendered on the loop stops
   all of it. Widget-style sim: it draws its own timeline inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: Saturday 21:30:00 to 21:40:00, 10 orders and 6 receipts (or
     10 on the party night); where the render runs (on the loop, async on the loop, a worker
     thread, one of four copies); render time 1 to 8 s; CPU as now or twice as fast. Next, Play,
     To 21:40 and a zoom on any stretch of 20 s. Stats: kitchen clock, clock stops, longest gap
     between ticks, ticks missing, late orders, worst order, worst loop lag, receipts printed,
     longest receipt wait. selfTest: 11 assertions.

   The model (stated in sim.lede). Times in ms after 21:30:00.
   - One line of waiting callbacks per loop, first come, first served. A callback runs at the later
     of when it joined the line and when the loop is free. Taking an order, pushing it to the
     kitchen and a clock tick take 0 ms; a receipt on the loop takes render time / CPU speed.
   - The clock tick is a 1 s repeating timer on the kitchen's loop. It joins the line when due;
     after it runs, the next is due 1 s later, so ticks missed during a stall are not made up.
   - At the same moment: the tick first, then requests in the order they were sent.
   - async on the loop: the same CPU work, on the same loop, so the same numbers.
   - Worker thread: the loop hands the receipt to one worker thread in 0 ms; the worker renders
     receipts one at a time, first come, first served.
   - Four copies: a load balancer sends each request to the next copy in turn (1, 2, 3, 4, 1, ...).
     The kitchen screen is connected to copy 1: its ticks come from copy 1, and an order taken by
     another copy is passed to copy 1, which pushes it when its own loop is free.

   Where every number comes from (conventions rule 14; the case is content/s5/s5e03-v1.0.0.json).
   - Orders (table, sent): 3 21:30:15, 5 21:31:22, 10 21:32:40, 7 21:33:30, 12 21:34:10,
     9 21:35:40, 3 21:36:25, 6 21:37:55, 2 21:38:30, 10 21:39:40.
   - Receipts (table, asked): 2 21:31:20, 6 21:33:05, 4 and 11 21:35:40, 1 21:37:52, 8 21:39:15.
     Table 9's order is sent in the same second, after tables 4 and 11. Party night adds table 14's
     four split bills at 21:35:40, after table 11 and before table 9's order.
   - On the loop, 4 s: stalls 21:31:20-24, 21:33:05-09, 21:35:40-48 (8 s), 21:37:52-56,
     21:39:15-19: 5 stops; ticks missing 3 + 3 + 7 + 3 + 3 = 19 of 600; late orders: table 5
     2.0 s, table 9 8.0 s, table 6 1.0 s (3 of 10); loop lag 8.0 s; table 11's bill 8.0 s.
   - async on the loop: identical.
   - CPU twice as fast (2 s): stalls 2, 2, 4, 2, 2 s; 7 ticks missing; only table 9 late, 4.0 s.
     Party night: 6 receipts back to back, 12 s; table 9 12.0 s late. Today's CPU: 24.0 s.
   - Four copies: copy 1 gets table 6's receipt (21:33:05) and table 11's (21:35:40); 2 stops of
     4 s, 6 ticks missing; table 9's order, taken by copy 2, waits for copy 1: 4.0 s late.
   - Worker thread: 0 stops, 0 missing, 0 of 10 late, loop lag 0.0 s; table 11's receipt waits
     behind table 4's in the worker: printed 8.0 s after it was asked for. Party night: 24.0 s.

   Drawing: viewBox 660 x 250. Whole-rush strip at 1 px a second; a 20 s zoom at 30 px a second.
*/
(function () {
  "use strict";

  var T0 = 77400;          // 21:30:00 in seconds
  var END = 600000;        // 21:40:00
  var ORDERS = [[15, 3], [82, 5], [160, 10], [210, 7], [250, 12], [340, 9], [385, 3], [475, 6], [510, 2], [580, 10]];
  var RECEIPTS = [[80, 2], [185, 6], [340, 4], [340, 11], [472, 1], [555, 8]];
  var PARTY = [[340, 14], [340, 14], [340, 14], [340, 14]];
  var WHERE = [
    { value: "loop", label: "On the loop (as built)" },
    { value: "async", label: "async on the loop (awaited)" },
    { value: "worker", label: "A worker thread" },
    { value: "copies", label: "One of four copies" }
  ];
  var ZOOMS = [
    { value: "75", label: "21:31:15" }, { value: "180", label: "21:33:00" },
    { value: "335", label: "21:35:35" }, { value: "467", label: "21:37:47" }, { value: "550", label: "21:39:10" }
  ];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(ms) {
    var s = T0 + Math.floor(ms / 1000);
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60)) + ":" + pad(s % 60);
  }
  function secs(ms) { return (ms / 1000).toFixed(1) + " s"; }
  function and(list) {
    if (list.length < 2) return list.join("");
    return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  }

  /* ---------- the requests, in the order they were sent ---------- */

  function requests(C) {
    var out = [];
    var i;
    for (i = 0; i < ORDERS.length; i++) out.push({ t: ORDERS[i][0] * 1000, kind: "order", table: ORDERS[i][1] });
    var rs = RECEIPTS.slice();
    for (i = 0; i < rs.length; i++) out.push({ t: rs[i][0] * 1000, kind: "receipt", table: rs[i][1] });
    if (C.set === "party") for (i = 0; i < PARTY.length; i++) out.push({ t: PARTY[i][0] * 1000, kind: "receipt", table: PARTY[i][1] });
    // Same second: receipts first (tables 4, 11, then 14), then orders.
    out.forEach(function (r, k) { r.n = k; r.rank = r.kind === "receipt" ? 0 : 1; });
    out.sort(function (a, b) { return (a.t - b.t) || (a.rank - b.rank) || (a.n - b.n); });
    out.forEach(function (r, k) { r.seq = k; });
    return out;
  }

  /* ---------- the model: one pure function, settings in, the whole rush out ---------- */

  function simulate(C) {
    var R = Math.round(C.render * 1000 / C.cpu);
    var reqs = requests(C);
    var nCopies = C.where === "copies" ? 4 : 1;
    var busy = [0, 0, 0, 0];
    var wfree = 0;
    var pend = [];
    var seq = 0;
    var ticks = [];
    var blocks = [];
    var wblocks = [];
    var orders = [];
    var bills = [];
    reqs.forEach(function (r, k) {
      pend.push({ t: r.t, s: seq++, kind: r.kind, req: r, copy: nCopies === 4 ? k % 4 : 0 });
    });
    var nextTick = 1000;
    for (;;) {
      var best = -1;
      for (var i = 0; i < pend.length; i++) {
        if (best < 0 || pend[i].t < pend[best].t || (pend[i].t === pend[best].t && pend[i].s < pend[best].s)) best = i;
      }
      var tickFirst = nextTick <= END && (best < 0 || nextTick <= pend[best].t);
      if (!tickFirst && best < 0) break;
      var it = tickFirst ? { t: nextTick, kind: "tick", copy: 0 } : pend.splice(best, 1)[0];
      var run = Math.max(it.t, busy[it.copy]);
      if (it.kind === "tick") {
        if (run > END) { nextTick = END + 1; continue; }
        ticks.push(run);
        nextTick = run + 1000;
      } else if (it.kind === "receipt") {
        if (C.where === "worker") {
          var st = Math.max(run, wfree);
          wfree = st + R;
          wblocks.push({ start: st, end: wfree, table: it.req.table });
          bills.push({ table: it.req.table, asked: it.t, done: wfree });
        } else {
          busy[it.copy] = run + R;
          blocks.push({ copy: it.copy, start: run, end: run + R, table: it.req.table });
          bills.push({ table: it.req.table, asked: it.t, done: run + R });
        }
      } else if (it.kind === "order") {
        var o = { table: it.req.table, sent: it.t, copy: it.copy, taken: run, at: run };
        orders.push(o);
        if (it.copy !== 0) pend.push({ t: run, s: seq++, kind: "push", copy: 0, order: o });
      } else {
        it.order.at = run;
      }
    }
    orders.sort(function (a, b) { return a.sent - b.sent; });
    bills.sort(function (a, b) { return a.done - b.done; });
    // Stalls: back-to-back blocks on one copy merge into one stretch.
    var stalls = [];
    blocks.slice().sort(function (a, b) { return (a.copy - b.copy) || (a.start - b.start); }).forEach(function (b) {
      var last = stalls[stalls.length - 1];
      if (last && last.copy === b.copy && last.end === b.start) { last.end = b.end; last.tables.push(b.table); }
      else stalls.push({ copy: b.copy, start: b.start, end: b.end, tables: [b.table] });
    });
    stalls.sort(function (a, b) { return (a.end - b.end) || (a.copy - b.copy); });
    return { R: R, ticks: ticks, blocks: blocks, wblocks: wblocks, orders: orders, bills: bills, stalls: stalls, events: events(C, ticks, stalls, orders, bills) };
  }

  function lastTickAtOrBefore(ticks, t) {
    var v = 0;
    for (var i = 0; i < ticks.length && ticks[i] <= t; i++) v = ticks[i];
    return v;
  }

  function billNames(tables) {
    var seen = {};
    var names = [];
    tables.forEach(function (t) { if (!seen[t]) { seen[t] = 1; names.push(String(t)); } });
    var n = tables.length;
    return (n === 1 ? "receipt" : n + " receipts") + " for table" + (names.length > 1 ? "s " : " ") + and(names);
  }

  // The log lines, each at the moment it happens.
  function events(C, ticks, stalls, orders, bills) {
    var ev = [];
    stalls.forEach(function (s) {
      var who = C.where === "copies" ? "Copy " + (s.copy + 1) : "Loop";
      var txt = who + " free after " + secs(s.end - s.start) + ": " + billNames(s.tables) + ". ";
      var late = orders.filter(function (o) {
        return s.copy === 0 ? (o.at === s.end && o.at > o.sent) : (o.copy === s.copy && o.taken === s.end && o.taken > o.sent);
      }).map(function (o) { return "table " + o.table + "'s order, " + secs(o.at - o.sent); });
      if (s.copy === 0) txt += "Kitchen clock jumped " + hms(lastTickAtOrBefore(ticks, s.start)) + " to " + hms(s.end) + ".";
      else txt += "Kitchen clock kept ticking.";
      if (late.length) txt += " Late: " + late.join("; ") + ".";
      ev.push({ t: s.end, text: txt, tone: s.copy === 0 ? "bad" : "warn" });
    });
    if (C.where === "worker") {
      bills.forEach(function (b) {
        ev.push({ t: b.done, text: "Table " + b.table + "'s receipt printed, " + secs(b.done - b.asked) + " after it was asked for, by the worker thread. Kitchen clock kept ticking.", tone: "ok" });
      });
    }
    ev.sort(function (a, b) { return a.t - b.t; });
    return ev;
  }

  // Everything the stats show, at playhead `now`.
  function summary(M, now) {
    var ticks = M.ticks.filter(function (t) { return t <= now; });
    var gap = ticks.length ? ticks[0] : 0;
    var stops = 0;
    for (var i = 1; i < ticks.length; i++) {
      var g = ticks[i] - ticks[i - 1];
      if (g > gap) gap = g;
      if (g > 1000) stops += 1;
    }
    var sent = M.orders.filter(function (o) { return o.sent <= now; });
    var arrived = sent.filter(function (o) { return o.at <= now; });
    var late = arrived.filter(function (o) { return o.at > o.sent; });
    var worst = null;
    late.forEach(function (o) { if (!worst || o.at - o.sent > worst.at - worst.sent) worst = o; });
    var lag = 0;
    M.stalls.forEach(function (s) { if (s.end <= now && s.end - s.start > lag) lag = s.end - s.start; });
    var done = M.bills.filter(function (b) { return b.done <= now; });
    var bw = 0;
    done.forEach(function (b) { if (b.done - b.asked > bw) bw = b.done - b.asked; });
    return {
      clock: hms(ticks.length ? ticks[ticks.length - 1] : 0),
      stops: stops,
      gap: secs(ticks.length ? gap : 0),
      missing: Math.floor(now / 1000) - ticks.length,
      late: late.length + " of " + sent.length,
      worst: worst ? "table " + worst.table + ", " + secs(worst.at - worst.sent) : "none",
      lag: secs(lag),
      printed: done.length,
      billwait: secs(bw)
    };
  }

  /* ---------- drawing ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, g, x, y, s, cls, anchor) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" }, g);
    t.textContent = s;
    return t;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }
  function box(doc, g, x, y, w, h, tone) {
    var gg = mk(doc, "g", { "class": "dg-node st-" + tone }, g);
    mk(doc, "rect", { x: x.toFixed(1), y: y, width: Math.max(2, w).toFixed(1), height: h, rx: 2 }, gg);
  }

  function build(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var wrap = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    wrap.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 250", width: "100%", "class": "dg", role: "img",
      "aria-label": "Top: the whole rush, 21:30 to 21:40, with a red mark wherever the kitchen's loop was busy rendering a receipt. Below: 20 seconds close up, with the loop's callbacks as blocks, the worker thread or other copies, each clock tick the kitchen screen got, and each order from sent to arrived. The table lists every order."
    });
    var layer = mk(doc, "g", {}, svg);
    wrap.appendChild(svg);
    var table = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["table", "order sent", "reached the kitchen", "late by"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    api.root.appendChild(wrap);
    return { doc: doc, el: el, head: head, layer: layer, tbody: tbody };
  }

  function drawAll(S) {
    var ui = S.ui;
    var doc = ui.doc;
    var g = ui.layer;
    var M = S.M;
    var now = S.now;
    clear(g);
    // The whole rush, 1 px a second.
    txt(doc, g, 30, 14, "Whole rush, 21:30 to 21:40. Red: kitchen loop busy. Amber: worker or other copy.", "dg-axis");
    mk(doc, "rect", { x: 30, y: 20, width: 600, height: 14, fill: "none", "class": "dg-axis", stroke: "currentColor" }, g);
    M.blocks.forEach(function (b) { if (b.start < now) box(doc, g, 30 + b.start / 1000, b.copy === 0 ? 20 : 36, Math.min(b.end, now) / 1000 - b.start / 1000, b.copy === 0 ? 14 : 6, b.copy === 0 ? "bad" : "warn"); });
    M.wblocks.forEach(function (b) { if (b.start < now) box(doc, g, 30 + b.start / 1000, 36, Math.min(b.end, now) / 1000 - b.start / 1000, 6, "warn"); });
    mk(doc, "line", { x1: 30 + now / 1000, y1: 16, x2: 30 + now / 1000, y2: 46, stroke: "currentColor" }, g);
    // The zoom: 20 s, 30 px a second.
    var w0 = S.zoom * 1000;
    var w1 = w0 + 20000;
    function zx(t) { return 30 + (t - w0) * 0.03; }
    function inWin(t) { return t >= w0 && t <= w1 && t <= now; }
    var rows = [["Kitchen loop", 70], [S.C.where === "worker" ? "Worker thread" : "Other copies", 110], ["Clock ticks", 150], ["Orders", 190]];
    rows.forEach(function (r) { txt(doc, g, 30, r[1] - 14, r[0], "dg-note"); });
    M.blocks.concat(M.wblocks).forEach(function (b) {
      var a = Math.max(b.start, w0);
      var z = Math.min(b.end, w1, now);
      if (z <= a) return;
      var y = b.copy === 0 && M.blocks.indexOf(b) >= 0 ? 60 : 100;
      box(doc, g, zx(a), y, zx(z) - zx(a), 18, y === 60 ? "bad" : "warn");
      if (zx(z) - zx(a) > 70) txt(doc, g, zx(a) + 4, y + 13, (b.copy > 0 ? "copy " + (b.copy + 1) + ", " : "") + "T" + b.table + " receipt", "dg-note");
    });
    var prev = null;
    M.ticks.forEach(function (t) {
      if (!inWin(t)) { if (t < w0) prev = t; return; }
      mk(doc, "line", { x1: zx(t), y1: 140, x2: zx(t), y2: 158, stroke: "currentColor" }, g);
      if (prev !== null && t - prev > 1000) txt(doc, g, (zx(Math.max(prev, w0)) + zx(t)) / 2, 172, "frozen " + secs(t - prev), "dg-note", "middle");
      prev = t;
    });
    M.orders.forEach(function (o) {
      if (o.sent > w1 || o.sent > now || (o.at < w0)) return;
      var a = zx(Math.max(o.sent, w0));
      var z = zx(Math.min(o.at, w1, now));
      mk(doc, "line", { x1: a, y1: 190, x2: Math.max(a + 2, z), y2: 190, stroke: "currentColor" }, g);
      mk(doc, "circle", { cx: a, cy: 190, r: 3, fill: "currentColor" }, g);
      txt(doc, g, a, 205, "T" + o.table + (o.at <= now ? " +" + secs(o.at - o.sent) : " waiting"), "dg-note");
    });
    for (var s = 0; s <= 20; s += 5) txt(doc, g, zx(w0 + s * 1000), 240, hms(w0 + s * 1000), "dg-axis", "middle");
    if (now >= w0 && now <= w1) mk(doc, "line", { x1: zx(now), y1: 52, x2: zx(now), y2: 228, stroke: "currentColor", "stroke-dasharray": "3 3" }, g);
    // The order table.
    clear(ui.tbody);
    M.orders.forEach(function (o) {
      if (o.sent > now) return;
      var tr = ui.el("tr");
      [String(o.table), hms(o.sent), o.at <= now ? hms(o.at) : "not yet", o.at <= now ? secs(o.at - o.sent) : "-"].forEach(function (c) { tr.appendChild(ui.el("td", "", c)); });
      ui.tbody.appendChild(tr);
    });
  }

  function show(api) {
    var S = api.state;
    var sm = summary(S.M, S.now);
    api.clock = T0 + S.now / 1000;
    S.ui.head.textContent = "Receipts: " + pick(WHERE, S.C.where) + ", " + secs(S.M.R) + " each. " +
      (S.C.set === "party" ? "Party night: 10 receipts." : "Saturday: 6 receipts.") + " 10 orders.";
    S.stat.clock(sm.clock); S.stat.stops(sm.stops); S.stat.gap(sm.gap); S.stat.missing(sm.missing);
    S.stat.late(sm.late); S.stat.worst(sm.worst); S.stat.lag(sm.lag); S.stat.printed(sm.printed); S.stat.billwait(sm.billwait);
    drawAll(S);
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i].value === v) return list[i].label.toLowerCase();
    return v;
  }

  // Move the playhead forward, logging every event passed, each at its own time.
  function advance(api, to) {
    var S = api.state;
    to = Math.min(END, to);
    if (to <= S.now) return;
    S.M.events.forEach(function (e) {
      if (e.t > S.now && e.t <= to) { api.clock = T0 + e.t / 1000; api.log(e.text, e.tone); }
    });
    if (to === END) {
      var sm = summary(S.M, END);
      api.clock = T0 + END / 1000;
      api.log("End of the rush. Kitchen clock stopped " + sm.stops + " times, longest gap " + sm.gap + ", " + sm.missing +
        " ticks missing; " + sm.late + " orders late" + (sm.worst !== "none" ? ", worst " + sm.worst : "") + "; worst loop lag " + sm.lag + ".", sm.stops ? "bad" : "ok");
      S.playing = false;
    }
    S.now = to;
    show(api);
  }

  function rewind(api, what) {
    var S = api.state;
    S.M = simulate(S.C);
    S.now = 0;
    S.playing = false;
    api.clock = T0;
    api.log(what + " Rewound to 21:30:00.", "");
    show(api);
  }

  DL.sims.define("s5e03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      api.clock = T0;
      S.C = { where: "loop", render: 4, cpu: 1, set: "saturday" };
      S.zoom = 335;
      S.now = 0;
      S.playing = false;
      S.ui = build(api);
      S.M = simulate(S.C);
      api.control.select("where", "Where the receipt renders", WHERE, "loop", function (v) {
        S.C.where = String(v);
        rewind(api, "Receipts now render: " + pick(WHERE, S.C.where) + "." + (S.C.where === "async" ? " await waits for the promise, but the render inside it is still CPU work on the loop." : ""));
      });
      api.control.range("render", "Render time on today's box (s)", 1, 8, 1, 4, function (v) {
        var x = Math.max(1, Math.min(8, Math.round(Number(v))));
        if (!isFinite(x) || x === S.C.render) return;
        S.C.render = x;
        rewind(api, "Render time on today's box: " + x + " s.");
      });
      api.control.select("receipts", "Receipts requested", [{ value: "saturday", label: "Saturday: 6" }, { value: "party", label: "Party night: 6 + 4 split bills" }], "saturday", function (v) {
        S.C.set = String(v);
        rewind(api, S.C.set === "party" ? "Party night: table 14's four split bills join tables 4 and 11 at 21:35:40." : "Saturday's 6 receipts.");
      });
      api.control.select("cpu", "CPU speed", [{ value: "1", label: "Today's box" }, { value: "2", label: "Twice as fast" }], "1", function (v) {
        S.C.cpu = Number(v) === 2 ? 2 : 1;
        rewind(api, S.C.cpu === 2 ? "CPU twice as fast: each render takes half the time." : "CPU: today's box.");
      });
      api.control.select("zoom", "Close-up from", ZOOMS, "335", function (v) { S.zoom = Number(v); show(api); });
      api.control.button("next", "Next event", function () {
        var nx = END;
        for (var i = 0; i < S.M.events.length; i++) if (S.M.events[i].t > S.now) { nx = S.M.events[i].t; break; }
        advance(api, nx);
      });
      api.control.button("play", "Play / pause", function () { S.playing = !S.playing && S.now < END; });
      api.control.button("end", "To 21:40", function () { advance(api, END); });
      api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        clock: api.stat("clock", "kitchen clock shows", ""),
        stops: api.stat("stops", "times the clock stopped", "bad"),
        gap: api.stat("gap", "longest gap between ticks", "bad"),
        missing: api.stat("missing", "ticks that never came", "warn"),
        late: api.stat("late", "orders late", "warn"),
        worst: api.stat("worst", "order kept waiting longest", "bad"),
        lag: api.stat("lag", "worst loop lag", "bad"),
        printed: api.stat("printed", "receipts printed", ""),
        billwait: api.stat("billwait", "longest wait for a receipt", "")
      };
      api.info("<strong>How to read it.</strong> The server is one loop that runs one callback at a time. Red blocks are receipts rendering on the kitchen's loop: while one runs, no tick, order or push can run. Ticks are the marks the kitchen screen gets each second; a gap means its clocks froze. Each order runs from when it was sent to when it reached the kitchen.");
      api.log("Saturday's rush, before the first order. Receipts render on the loop, 4.0 s each.", "");
      show(api);
    },

    step: function (api, dt) {
      var S = api.state;
      if (S.playing) advance(api, S.now + Math.round(dt * 20000));
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      function snap() { return ["stops", "gap", "missing", "late", "worst", "lag", "printed", "billwait"].map(function (k) { return t.stat(k); }).join("|"); }

      // 1. Opens at 21:30:00, before anything has happened.
      t.expect(t.stat("clock") === "21:30:00" && t.stat("stops") === 0 && t.stat("missing") === 0 && t.stat("late") === "0 of 0" &&
        t.stat("lag") === "0.0 s" && t.stat("printed") === 0 && t.logText().indexOf("Saturday's rush, before the first order.") >= 0,
        "Opens at 21:30:00 with nothing run: clock 21:30:00, no stops, no orders");

      // 2. The first receipt: a 4 s freeze, table 5's order 2 s late.
      begin();
      t.click("next");
      t.expect(has("Loop free after 4.0 s: receipt for table 2. Kitchen clock jumped 21:31:20 to 21:31:24. Late: table 5's order, 2.0 s.") &&
        t.stat("clock") === "21:31:24" && t.stat("stops") === 1 && t.stat("missing") === 3,
        "21:31:20: table 2's receipt stops the loop 4 s; the clock jumps 21:31:20 to 21:31:24; table 5's order is 2.0 s late");

      // 3. Back to back at 21:35:40: an 8 s freeze, table 9's order 8 s late.
      t.click("next");
      begin();
      t.click("next");
      t.expect(has("Loop free after 8.0 s: 2 receipts for tables 4 and 11. Kitchen clock jumped 21:35:40 to 21:35:48. Late: table 9's order, 8.0 s.") &&
        t.stat("clock") === "21:35:48" && t.stat("gap") === "8.0 s",
        "21:35:40: tables 4 and 11 back to back freeze the clock 8 s; table 9's order, sent 21:35:40, arrives 21:35:48");

      // 4. The whole rush, as built.
      t.click("end");
      var asBuilt = snap();
      t.expect(t.stat("stops") === 5 && t.stat("gap") === "8.0 s" && t.stat("missing") === 19 && t.stat("late") === "3 of 10" &&
        t.stat("worst") === "table 9, 8.0 s" && t.stat("lag") === "8.0 s" && t.stat("printed") === 6 && t.stat("billwait") === "8.0 s",
        "As built: 5 stops, 19 ticks missing, 3 of 10 orders late, table 9 worst at 8.0 s, loop lag 8.0 s");

      // 5. async on the loop: exactly the same.
      t.set("where", "async");
      t.expect(t.stat("clock") === "21:30:00" && t.stat("printed") === 0, "Changing a setting rewinds to 21:30:00");
      t.click("end");
      t.expect(snap() === asBuilt, "async on the loop: identical to as built, every stat");

      // 6. A CPU twice as fast: shorter freezes, still freezes.
      t.set("where", "loop");
      t.set("cpu", "2");
      t.click("end");
      t.expect(t.stat("stops") === 5 && t.stat("gap") === "4.0 s" && t.stat("missing") === 7 && t.stat("late") === "1 of 10" &&
        t.stat("worst") === "table 9, 4.0 s" && t.stat("lag") === "4.0 s",
        "Twice as fast: still 5 stops, longest 4.0 s, 7 ticks missing, table 9 4.0 s late");

      // 7. Party night stacks them: 12 s on the fast box, 24 s on today's.
      t.set("receipts", "party");
      t.click("end");
      var fast = t.stat("worst") === "table 9, 12.0 s" && t.stat("lag") === "12.0 s";
      t.set("cpu", "1");
      t.click("end");
      t.expect(fast && t.stat("worst") === "table 9, 24.0 s" && t.stat("lag") === "24.0 s",
        "Party night: 6 receipts back to back, table 9 12.0 s late on the fast box, 24.0 s on today's");

      // 8. Four copies: the kitchen's copy still freezes.
      t.set("receipts", "saturday");
      t.set("where", "copies");
      begin();
      t.click("end");
      t.expect(t.stat("stops") === 2 && t.stat("missing") === 6 && t.stat("late") === "1 of 10" && t.stat("worst") === "table 9, 4.0 s" &&
        has("Copy 1 free after 4.0 s: receipt for table 6. Kitchen clock jumped 21:33:05 to 21:33:09.") &&
        has("Copy 1 free after 4.0 s: receipt for table 11. Kitchen clock jumped 21:35:40 to 21:35:44. Late: table 9's order, 4.0 s."),
        "Four copies: copy 1 gets tables 6 and 11's receipts, 2 stops of 4 s, table 9's order 4.0 s late");

      // 9. A worker thread: the loop never stops.
      t.set("where", "worker");
      begin();
      t.click("end");
      t.expect(t.stat("stops") === 0 && t.stat("missing") === 0 && t.stat("late") === "0 of 10" && t.stat("lag") === "0.0 s" &&
        t.stat("gap") === "1.0 s" && t.stat("printed") === 6 && t.stat("billwait") === "8.0 s" &&
        has("Table 11's receipt printed, 8.0 s after it was asked for, by the worker thread."),
        "Worker thread: no stops, no late orders, loop lag 0.0 s; table 11's receipt waits behind table 4's, 8.0 s");

      // 10. Party night with the worker: the queue grows, the kitchen doesn't notice.
      t.set("receipts", "party");
      t.click("end");
      t.expect(t.stat("stops") === 0 && t.stat("late") === "0 of 10" && t.stat("billwait") === "24.0 s",
        "Worker, party night: still no stops or late orders; the last split bill waits 24.0 s in the worker's queue");
    }
  });
})();
