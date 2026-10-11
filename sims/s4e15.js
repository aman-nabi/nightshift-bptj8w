/* sims/s4e15-v1.0.0.js  (published as sims/s4e15.js)
   Case s4e15 "The Slow Room": an overload lab for the paging system at St Wendreda's Hospital.
   Wards, porters' jobs and the pathology lab send pages to a pager gateway, which holds them in a
   queue in its memory and hands them to the paging carrier (Dunnock Paging), which accepts 20
   pages a minute on the hospital's contract. The learner replays the night minute by minute from
   00:50 to 03:30 and changes the arrivals, the carrier limit, the queue bound, the priority lanes,
   the shedding rule, the gateway's memory, extra gateways added automatically, a durable queue on
   disk and the alerts. Widget-style sim: it draws its own two charts inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: one-minute steps from 00:50 to 03:30 (160 minutes); presets
     for the night as it was and the four reply options; controls for arrivals, carrier limit,
     queue bound, priority lanes, shedding rule, memory limit, extra gateways, durable queue,
     alerts; Next minute, Next 10 minutes, Run to 03:30, Play, Reset. Stats: time, waiting,
     oldest waiting, worst delay, urgent worst, the porter's page, delivered, refused, lost,
     restarts, health check answer, memory, carrier refusals, first alert, gateways.
     selfTest: 11 assertions.

   The model (stated in sim.lede and the info box):
   - Minute m runs from m:00 to m:59. Before 01:00, and after 02:29, 12 pages arrive a minute:
     1 urgent, 5 normal (porters, beds), 6 low (results ready, notices). From 01:01 to 02:29 the
     lab catches up: 1 urgent, 7 normal, 24 low, 32 a minute. At 01:00 the lab's link comes back
     and the 1,040 result pages it held since 19:00 arrive at once, before the minute's 12.
     Within a minute pages join in this order: the held batch, urgent, normal, low.
   - The porter's page is the first normal page of 01:12: "Porter to Ward 9, bed 4 to X-ray".
     The ward phoned the porters' lodge at 01:20 and Abiola had done the job by 01:30.
   - Each minute, in this order: (1) health checks; (2) arrivals join a gateway's queue (round
     robin over the gateways running); (3) the carrier takes up to its limit, oldest first, or
     urgent, then normal, then low with priority lanes on.
   - Health check: the gateway walks its whole queue once a second, so it answers its health
     check in 1 ms for every page waiting in its memory. The container orchestrator checks every
     10 s, waits 2 s, and restarts the gateway after 3 misses in a row. A gateway that starts a
     minute with more than 2,000 pages misses the checks at :00, :10 and :20 and is restarted at
     :22; the fresh copy starts empty, and every page it held is lost.
   - Memory: 196 MB for the program plus 0.025 MB (25 KB) for each page waiting in memory. A
     gateway that starts a minute over its memory limit runs out of memory and is restarted.
   - Bound: a gateway's queue may hold at most this many pages. When it is full, "refuse the
     newest" refuses the arriving page; "refuse the lowest priority first" refuses an arriving low
     page, or makes room for a higher one by refusing the newest waiting page of a lower priority.
     A refused page gets an answer straight away ("queue full, not sent").
   - Extra gateways: when more than 500 pages wait at the end of a minute, one more gateway is
     started; it takes pages from 3 minutes later. The carrier's limit is for the hospital's
     contract, not per gateway: each gateway tries to send up to the limit, the carrier accepts
     the limit in all, a page at a time from each gateway in turn, and refuses the rest (429).
   - Durable queue: pages wait on disk, not in the gateway's memory, so the health check stays
     quick (0 pages in memory) and a restart loses nothing.
   - Alerts: one alert when 200 or more pages wait, or the oldest has waited 5 minutes or more.

   Where every number comes from (conventions rule 14; the case is content/s4/s4e15-v1.0.0.json).
   All of these come out of the model above and are checked by the selfTest.
   - As it was: 00:50 to 00:59, 12 a minute, all sent the same minute. At 01:00, 1,052 arrive and
     20 go: 1,032 waiting. Then 12 more a minute than the carrier takes.
   - The porter's page (01:12) is delivered at 02:10, 58 minutes late, 40 minutes after the job
     was done at 01:30.
   - At the end of 02:21, 2,004 wait; the health check takes 2.004 s against a 2 s timeout; at
     02:22:22 the gateway is restarted and 2,004 pages are lost: 62 urgent, 434 normal, 1,508 low,
     sent from 01:19 to 02:21 (the oldest had waited 63 minutes). Memory then: 196 + 50.1 = 246 MB of
     256. Worst delay before the restart: 63 minutes; urgent worst 62. Waiting at 01:30: 1,380; at
     02:00: 1,740. By 03:30: 2,736 delivered, 0 waiting, 2,004 lost, 0 refused, 1 restart (4,740
     pages arrived in all: 2,736 + 2,004).
   - Option 0, 1 GB of memory: the same minute-by-minute run, the same restart at 02:22:22 and the
     same 2,004 lost; memory at the restart 246 MB of 1,024.
   - Option 1, bound 250 per gateway, priority lanes, refuse the lowest priority first, alerts:
     urgent and normal pages go the minute they arrive (urgent worst 0, the porter's page at 01:12,
     0 minutes late); low pages wait at most 20 minutes; first alert 01:01 (230 waiting); no
     restart; 0 lost; 1,870 low pages refused with an answer; 2,870 delivered; 0 waiting at 03:30.
   - Option 2, up to 2 extra gateways: gateway 2 takes pages from 01:04 and gateway 3 from 01:08;
     the carrier still takes 20 a minute in all and refuses the rest of each gateway's tries. New
     pages go round robin, so the fresh gateways stay short and get a third of the carrier each,
     and gateway 1's old backlog starves. The porter's page lands on a fresh gateway: 01:17, 5
     minutes late. No gateway passes 2,000, so no restart and nothing lost, but by 03:30: 3,120
     delivered, 1,620 still waiting, 5,742 carrier refusals, worst delay 147 minutes, an urgent
     page 143 minutes.
   - Option 3, durable queue: no restart, 0 lost, the porter's page at 02:10 (58 minutes late);
     1,620 still waiting at 03:30, the oldest 89 minutes; worst delivered 88 minutes.
   - A carrier limit of 40 a minute: the queue drains and nothing restarts.
   (The selfTest checks each of these against the running model.)

   Drawing: viewBox 680 x 300. Top chart: pages waiting (bars, one per minute), 0 to the larger of
   2,400 and the night's most, with the 2,000 health-check line and the bound. Bottom chart: the
   oldest page's wait in minutes. Restarts are red ticks.
*/
(function () {
  "use strict";

  var START = 50;            // 00:50
  var END = 210;             // 03:30
  var BATCH_AT = 60;         // 01:00
  var BATCH = 1040;          // result pages held since 19:00
  var SURGE_FROM = 61;       // 01:01
  var SURGE_TO = 150;        // to 02:29 (minute 149 is the last)
  var PORTER_AT = 72;        // 01:12
  var JOB_DONE = 90;         // 01:30
  var HC_LIMIT = 2000;       // 1 ms a page, 2 s timeout
  var BASE_MB = 196;
  var PAGE_MB = 0.025;
  var SCALE_AT = 500;
  var SCALE_DELAY = 3;
  var ALERT_DEPTH = 200;
  var ALERT_AGE = 5;
  var PRI = ["u", "n", "l"];

  var ARRIVALS = [
    { value: "night", label: "As on the night: 1,040 held at 01:00, then 32 a minute to 02:29" },
    { value: "nobatch", label: "No held batch: 32 a minute from 01:01 to 02:29" },
    { value: "normal", label: "A quiet night: 12 a minute" }
  ];
  var CARRIER = [20, 30, 40];
  var BOUNDS = [0, 1000, 500, 250];
  var RULES = [
    { value: "newest", label: "Refuse the newest page" },
    { value: "lowest", label: "Refuse the lowest priority first" }
  ];
  var MEMORY = [256, 512, 1024];
  var EXTRA = [0, 1, 2];
  var PRESETS = [
    { value: "asis", label: "The night as it was" },
    { value: "o0", label: "Option A: 1 GB of memory" },
    { value: "o1", label: "Option B: bound, lanes, refuse low, alert" },
    { value: "o2", label: "Option C: add gateways automatically" },
    { value: "o3", label: "Option D: a durable queue on disk" },
    { value: "custom", label: "My own settings" }
  ];

  function defaults() {
    return { arr: "night", carrier: 20, bound: 0, lanes: false, rule: "newest", mem: 256, extra: 0, durable: false, alerts: false };
  }
  function presetConfig(p) {
    var C = defaults();
    if (p === "o0") C.mem = 1024;
    if (p === "o1") { C.bound = 250; C.lanes = true; C.rule = "lowest"; C.alerts = true; }
    if (p === "o2") C.extra = 2;
    if (p === "o3") C.durable = true;
    return C;
  }

  /* ---------- helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hm(m) { return pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60); }
  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  /* ---------- the model ---------- */

  function arrivalsAt(C, m) {
    var a = { batch: 0, u: 1, n: 5, l: 6 };
    if (C.arr === "normal") return a;
    if (C.arr === "night" && m === BATCH_AT) a.batch = BATCH;
    if (m >= SURGE_FROM && m < SURGE_TO) { a.n = 7; a.l = 24; }
    return a;
  }

  function newGateway(id, from) { return { id: id, from: from, fifo: [], lanes: { u: [], n: [], l: [] } }; }
  function depth(g) { return g.fifo.length + g.lanes.u.length + g.lanes.n.length + g.lanes.l.length; }
  function heads(g) {
    var out = [];
    if (g.fifo.length) out.push(g.fifo[0]);
    PRI.forEach(function (p) { if (g.lanes[p].length) out.push(g.lanes[p][0]); });
    return out;
  }
  function take(g, lanes) {
    if (!lanes) return g.fifo.shift();
    for (var i = 0; i < PRI.length; i++) if (g.lanes[PRI[i]].length) return g.lanes[PRI[i]].shift();
    return null;
  }
  function add(g, pg, lanes) { if (lanes) g.lanes[pg.p].push(pg); else g.fifo.push(pg); }
  // Remove the newest waiting page of priority p (or return null).
  function dropNewest(g, p, lanes) {
    if (lanes) return g.lanes[p].length ? g.lanes[p].pop() : null;
    for (var i = g.fifo.length - 1; i >= 0; i--) if (g.fifo[i].p === p) return g.fifo.splice(i, 1)[0];
    return null;
  }
  function inMemory(N, g) { return N.C.durable ? 0 : depth(g); }
  function memMB(N, g) { return BASE_MB + inMemory(N, g) * PAGE_MB; }

  function newNight(C) {
    return {
      C: C, m: START, gws: [newGateway(1, START)], rr: 0, seq: 0, starting: null,
      delivered: 0, refused: 0, refusedBy: { u: 0, n: 0, l: 0 }, lost: 0, restarts: 0, c429: 0,
      worst: 0, urgentWorst: 0, porter: null, alertAt: null, full: false,
      hist: [], marks: [], done: false
    };
  }

  function running(N, m) { return N.gws.filter(function (g) { return g.from <= m; }); }
  function totalWaiting(N) { var s = 0; N.gws.forEach(function (g) { s += depth(g); }); return s; }
  function oldestAge(N, at) {
    var o = null;
    N.gws.forEach(function (g) { heads(g).forEach(function (pg) { if (o === null || pg.m < o) o = pg.m; }); });
    return o === null ? 0 : at - o;
  }

  function refuse(N, pg, out) {
    N.refused += 1;
    N.refusedBy[pg.p] += 1;
    if (pg.porter) { N.porter = { refused: N.m }; out.push(["At " + hm(N.m) + " the porter's page is refused: the queue is full.", "bad"]); }
  }

  function enqueue(N, g, pg, out) {
    var C = N.C;
    if (C.bound && depth(g) >= C.bound) {
      if (!N.full) { N.full = true; out.push(["Gateway " + g.id + "'s queue is full at " + fmt(C.bound) + " pages; it starts refusing (" + (C.rule === "lowest" ? "lowest priority first" : "the newest page") + ").", "warn"]); }
      if (C.rule === "lowest" && pg.p !== "l") {
        var victim = dropNewest(g, "l", C.lanes);
        if (!victim && pg.p === "u") victim = dropNewest(g, "n", C.lanes);
        if (victim) { refuse(N, victim, out); add(g, pg, C.lanes); return; }
      }
      refuse(N, pg, out);
      return;
    }
    add(g, pg, C.lanes);
  }

  // Run minute N.m and move to the next. Returns log lines [text, tone, second].
  function stepMinute(N) {
    var out = [];
    var C = N.C;
    var m = N.m;
    if (m >= END) return out;
    // 1. health checks and memory, on the state the minute starts with
    N.gws.forEach(function (g) {
      if (g.from > m || C.durable) return;
      var d = depth(g);
      var mem = memMB(N, g);
      var by = { u: 0, n: 0, l: 0 };
      g.fifo.concat(g.lanes.u, g.lanes.n, g.lanes.l).forEach(function (pg) { by[pg.p] += 1; });
      var what = " (" + fmt(by.u) + " urgent, " + fmt(by.n) + " normal, " + fmt(by.l) + " low)";
      if (mem > C.mem) {
        out.push(["Gateway " + g.id + " needs " + Math.round(mem) + " MB with a limit of " + C.mem + " MB: out of memory. It is restarted and the " + fmt(d) + " pages it held are lost" + what + ".", "bad", 5]);
      } else if (d > HC_LIMIT) {
        out.push(["Gateway " + g.id + " takes " + (d / 1000).toFixed(3) + " s to answer its health check (timeout 2 s), at " + hm(m) + ":00, :10 and :20. Three misses in a row: the container orchestrator restarts it at " + hm(m) + ":22. The " + fmt(d) + " pages it held in memory are lost" + what + ".", "bad", 22]);
      } else return;
      [g.fifo, g.lanes.u, g.lanes.n, g.lanes.l].forEach(function (q) {
        q.forEach(function (pg) { if (pg.porter) N.porter = { lost: m }; });
      });
      N.lost += d;
      N.restarts += 1;
      N.marks.push(m);
      g.fifo = []; g.lanes = { u: [], n: [], l: [] };
    });
    // 2. arrivals
    var a = arrivalsAt(C, m);
    var gs = running(N, m);
    var list = [];
    var i;
    for (i = 0; i < a.batch; i++) list.push("l");
    for (i = 0; i < a.u; i++) list.push("u");
    for (i = 0; i < a.n; i++) list.push("n");
    for (i = 0; i < a.l; i++) list.push("l");
    var porterSeen = false;
    list.forEach(function (p) {
      var pg = { m: m, p: p, porter: false };
      if (m === PORTER_AT && p === "n" && !porterSeen) { pg.porter = true; porterSeen = true; }
      var g = gs[N.rr % gs.length];
      N.rr += 1;
      enqueue(N, g, pg, out);
    });
    if (a.batch) out.push(["The lab's link is back: the " + fmt(a.batch) + " result pages it held since 19:00 arrive at once, with the minute's " + (a.u + a.n + a.l) + ".", "warn", 0]);
    // 3. the carrier
    var tries = gs.map(function (g) { return Math.min(depth(g), C.carrier); });
    var attempts = 0;
    tries.forEach(function (x) { attempts += x; });
    var left = C.carrier;
    var given = gs.map(function () { return 0; });
    var moved = true;
    while (left > 0 && moved) {
      moved = false;
      for (i = 0; i < gs.length && left > 0; i++) {
        if (given[i] < tries[i]) {
          given[i] += 1; left -= 1; moved = true;
          var pg = take(gs[i], C.lanes);
          var delay = m - pg.m;
          N.delivered += 1;
          if (delay > N.worst) N.worst = delay;
          if (pg.p === "u" && delay > N.urgentWorst) N.urgentWorst = delay;
          if (pg.porter) {
            N.porter = { at: m, delay: delay };
            out.push(["The porter's page (Ward 9, sent " + hm(PORTER_AT) + ") is delivered at " + hm(m) + ", " + delay + " minutes late" +
              (m > JOB_DONE ? ", " + (m - JOB_DONE) + " minutes after the job was done at " + hm(JOB_DONE) + "." : "."), delay >= 10 ? "bad" : "ok", 30]);
          }
        }
      }
    }
    var sent = C.carrier - left;
    if (attempts > sent) N.c429 += attempts - sent;
    // end of the minute
    N.m = m + 1;
    var w = totalWaiting(N);
    var age = oldestAge(N, N.m);
    N.hist.push({ m: m, w: w, age: age });
    if (C.alerts && N.alertAt === null && (w >= ALERT_DEPTH || age >= ALERT_AGE)) {
      N.alertAt = N.m;
      out.push(["ALERT at " + hm(N.m) + ": " + fmt(w) + " pages waiting (alert at " + ALERT_DEPTH + "), the oldest " + age + " min (alert at " + ALERT_AGE + ").", "warn", 60]);
    }
    // extra gateways
    var total = N.gws.length;
    if (C.extra > 0 && w > SCALE_AT && total < 1 + C.extra && (N.starting === null || N.starting <= m)) {
      var from = N.m + SCALE_DELAY;
      N.gws.push(newGateway(total + 1, from));
      N.starting = from;
      out.push([fmt(w) + " pages waiting, over " + SCALE_AT + ": gateway " + (total + 1) + " is started and takes pages from " + hm(from) + ".", "warn", 60]);
    }
    if (N.m >= END) {
      N.done = true;
      out.push(["03:30. Delivered " + fmt(N.delivered) + ", still waiting " + fmt(w) + ", refused with an answer " + fmt(N.refused) + ", lost " + fmt(N.lost) + ". Worst delay " + N.worst + " min, urgent worst " + N.urgentWorst + " min.", N.lost ? "bad" : (w ? "warn" : "ok"), 60]);
    }
    return out;
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var X0 = 56;
  var PW = 600;
  var BW = PW / (END - START);

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

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    var box = doc.createElement("div");
    box.setAttribute("style", "display:grid;gap:6px;padding:10px;min-width:0;");
    var head = doc.createElement("p");
    head.setAttribute("style", "margin:0;font-size:12px;");
    box.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 680 300", width: "100%", "class": "dg", role: "img",
      "aria-label": "Two charts, minute by minute from 00:50 to 03:30. Top: pages waiting in the gateway, with a dashed line at 2,000 where the health check starts to miss. Bottom: how long the oldest waiting page has waited, in minutes. Red ticks mark restarts."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    api.root.appendChild(box);
    return { doc: doc, head: head, layer: layer };
  }

  function drawCharts(S) {
    var ui = S.ui;
    var doc = ui.doc;
    var g = ui.layer;
    var N = S.N;
    clear(g);
    var maxW = 2400;
    var maxA = 60;
    N.hist.forEach(function (h) { if (h.w > maxW) maxW = h.w; if (h.age > maxA) maxA = h.age; });
    var top = { y: 20, h: 130 };
    var bot = { y: 190, h: 80 };
    function x(m) { return X0 + (m - START) * BW; }
    mk(doc, "rect", { x: X0, y: top.y, width: PW, height: top.h, fill: "none", "class": "dg-axis" }, g);
    mk(doc, "rect", { x: X0, y: bot.y, width: PW, height: bot.h, fill: "none", "class": "dg-axis" }, g);
    txt(doc, g, X0, top.y - 6, "pages waiting (0 to " + fmt(maxW) + ")", "dg-note");
    txt(doc, g, X0, bot.y - 6, "oldest page's wait, minutes (0 to " + maxA + ")", "dg-note");
    var d = "";
    var ad = "";
    N.hist.forEach(function (h, k) {
      var bh = top.h * h.w / maxW;
      if (bh > 0) d += "M" + x(h.m).toFixed(1) + " " + (top.y + top.h).toFixed(1) + "v-" + bh.toFixed(1);
      var ay = bot.y + bot.h - bot.h * h.age / maxA;
      ad += (k ? "L" : "M") + (x(h.m) + BW / 2).toFixed(1) + " " + ay.toFixed(1);
    });
    if (d) mk(doc, "path", { d: d, "class": "dg-edge", "stroke-width": BW.toFixed(2) }, g);
    if (ad) mk(doc, "path", { d: ad, "class": "dg-edge", fill: "none" }, g);
    if (!N.C.durable) {
      var hy = top.y + top.h - top.h * HC_LIMIT / maxW;
      mk(doc, "path", { d: "M" + X0 + " " + hy.toFixed(1) + "h" + PW, "class": "dg-axis", "stroke-dasharray": "4 3" }, g);
      txt(doc, g, X0 + PW - 4, hy - 4, "2,000: health check misses", "dg-axis", "end");
    }
    if (N.C.bound) {
      var by = top.y + top.h - top.h * N.C.bound / maxW;
      mk(doc, "path", { d: "M" + X0 + " " + by.toFixed(1) + "h" + PW, "class": "dg-axis", "stroke-dasharray": "2 2" }, g);
      txt(doc, g, X0 + 4, by - 4, "bound " + fmt(N.C.bound), "dg-axis");
    }
    N.marks.forEach(function (m) {
      var gm = mk(doc, "g", { "class": "dg-node st-bad" }, g);
      mk(doc, "rect", { x: x(m) - 1, y: top.y, width: 2, height: top.h }, gm);
    });
    [60, 90, 120, 150, 180, 210].forEach(function (m) {
      txt(doc, g, x(m), bot.y + bot.h + 14, hm(m), "dg-axis", "middle");
    });
  }

  function draw(api) {
    var S = api.state;
    var N = S.N;
    var C = N.C;
    api.clock = N.m * 60;
    S.ui.head.textContent = "Carrier: " + C.carrier + " a minute. Bound: " + (C.bound ? fmt(C.bound) + " per gateway" : "none") +
      ". Lanes: " + (C.lanes ? "urgent, normal, low" : "one, oldest first") + ". Memory: " + C.mem + " MB. Extra gateways: up to " + C.extra +
      ". Queue: " + (C.durable ? "on disk" : "in memory") + ".";
    drawCharts(S);
    var w = totalWaiting(N);
    var worstHc = 0;
    var worstMem = BASE_MB;
    N.gws.forEach(function (g) { if (inMemory(N, g) > worstHc) worstHc = inMemory(N, g); if (memMB(N, g) > worstMem) worstMem = memMB(N, g); });
    S.stat.time(hm(N.m));
    S.stat.waiting(fmt(w));
    S.stat.oldest(oldestAge(N, N.m));
    S.stat.worst(N.worst);
    S.stat.urgent(N.urgentWorst);
    var p = N.porter;
    var ps = "not sent yet";
    if (p && p.at !== undefined) ps = hm(p.at) + ", " + p.delay + " min late";
    else if (p && p.lost !== undefined) ps = "lost at " + hm(p.lost);
    else if (p && p.refused !== undefined) ps = "refused at " + hm(p.refused);
    else if (N.m > PORTER_AT) ps = "waiting";
    S.stat.porter(ps);
    S.stat.delivered(fmt(N.delivered));
    S.stat.refused(fmt(N.refused));
    S.stat.lost(fmt(N.lost));
    S.stat.restarts(N.restarts);
    S.stat.health((worstHc / 1000).toFixed(3) + " s");
    S.stat.memory(Math.round(worstMem) + " MB of " + fmt(C.mem));
    S.stat.c429(fmt(N.c429));
    S.stat.alert(N.alertAt === null ? "none" : hm(N.alertAt));
    S.stat.gateways(running(N, N.m).length);
  }

  function advance(api, minutes) {
    var S = api.state;
    for (var k = 0; k < minutes && !S.N.done; k++) {
      var m = S.N.m;
      var lines = stepMinute(S.N);
      lines.forEach(function (ln) {
        api.clock = m * 60 + (ln[2] || 0);
        api.log(ln[0], ln[1]);
      });
    }
    if (S.N.done && S.ctl && S.ctl.play) { S.playing = false; S.ctl.play.set(false); }
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    S.N = newNight(S.C);
    api.clock = START * 60;
    api.log(why + " The night starts again at 00:50.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s4e15", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.N = newNight(S.C);
      S.playing = false;
      S.ui = buildWidget(api);
      S.ctl = {};
      var quiet = false;

      function sync() {
        quiet = true;
        S.ctl.arr.set(S.C.arr); S.ctl.carrier.set(String(S.C.carrier)); S.ctl.bound.set(String(S.C.bound));
        S.ctl.lanes.set(S.C.lanes); S.ctl.rule.set(S.C.rule); S.ctl.mem.set(String(S.C.mem));
        S.ctl.extra.set(String(S.C.extra)); S.ctl.durable.set(S.C.durable); S.ctl.alerts.set(S.C.alerts);
        quiet = false;
      }
      function change(key, val, text) {
        if (quiet) return;
        S.C[key] = val;
        S.ctl.preset.set("custom");
        restart(api, text);
      }

      S.ctl.preset = api.control.select("preset", "Set up as", PRESETS, "asis", function (v) {
        var p = String(v);
        if (p === "custom") return;
        S.C = presetConfig(p);
        sync();
        var lab = PRESETS.filter(function (o) { return o.value === p; })[0];
        restart(api, "Set up as: " + (lab ? lab.label : p) + ".");
      });
      S.ctl.arr = api.control.select("arr", "Arrivals", ARRIVALS, "night", function (v) {
        change("arr", String(v), "Arrivals: " + String(v) + ".");
      });
      S.ctl.carrier = api.control.select("carrier", "Carrier limit (pages a minute)", CARRIER.map(function (c) { return { value: String(c), label: String(c) }; }), "20", function (v) {
        change("carrier", Number(v), "Carrier limit: " + Number(v) + " a minute.");
      });
      S.ctl.bound = api.control.select("bound", "Queue bound per gateway", BOUNDS.map(function (b) { return { value: String(b), label: b ? fmt(b) + " pages" : "None" }; }), "0", function (v) {
        change("bound", Number(v), "Queue bound: " + (Number(v) ? fmt(Number(v)) + " pages." : "none."));
      });
      S.ctl.lanes = api.control.toggle("lanes", "Priority lanes: urgent first, then normal, then low", false, function (on) {
        change("lanes", !!on, "Priority lanes: " + (on ? "on." : "off."));
      });
      S.ctl.rule = api.control.select("rule", "When the queue is full", RULES, "newest", function (v) {
        change("rule", String(v), "When full: " + String(v) + ".");
      });
      S.ctl.mem = api.control.select("mem", "Gateway memory limit", MEMORY.map(function (x) { return { value: String(x), label: fmt(x) + " MB" }; }), "256", function (v) {
        change("mem", Number(v), "Memory limit: " + Number(v) + " MB.");
      });
      S.ctl.extra = api.control.select("extra", "Extra gateways added when over 500 wait", EXTRA.map(function (x) { return { value: String(x), label: "up to " + x }; }), "0", function (v) {
        change("extra", Number(v), "Extra gateways: up to " + Number(v) + ".");
      });
      S.ctl.durable = api.control.toggle("durable", "Keep the queue on disk (durable queue)", false, function (on) {
        change("durable", !!on, "Durable queue: " + (on ? "on." : "off."));
      });
      S.ctl.alerts = api.control.toggle("alerts", "Alert at 200 waiting or 5 minutes old", false, function (on) {
        change("alerts", !!on, "Alerts: " + (on ? "on." : "off."));
      });
      S.ctl.next = api.control.button("next", "Next minute", function () { advance(api, 1); });
      S.ctl.next10 = api.control.button("next10", "Next 10 minutes", function () { advance(api, 10); });
      S.ctl.end = api.control.button("end", "Run to 03:30", function () { advance(api, END - START); });
      S.ctl.play = api.control.toggle("play", "Play (a minute every half second)", false, function (on) { S.playing = !!on; });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      api.every(0.5, function () { if (S.playing) advance(api, 1); });

      S.stat = {
        time: api.stat("time", "time", ""),
        waiting: api.stat("waiting", "pages waiting", "warn"),
        oldest: api.stat("oldest", "oldest page waiting, min", "warn"),
        worst: api.stat("worst", "worst delay so far, min", "bad"),
        urgent: api.stat("urgent", "urgent pages' worst delay, min", "bad"),
        porter: api.stat("porter", "the porter's page (sent 01:12)", ""),
        delivered: api.stat("delivered", "pages delivered", "ok"),
        refused: api.stat("refused", "refused with an answer", "warn"),
        lost: api.stat("lost", "lost in restarts", "bad"),
        restarts: api.stat("restarts", "gateway restarts", "bad"),
        health: api.stat("health", "health check answer (timeout 2 s)", ""),
        memory: api.stat("memory", "gateway memory", ""),
        c429: api.stat("c429", "carrier refusals (429)", "warn"),
        alert: api.stat("alert", "first alert", ""),
        gateways: api.stat("gateways", "gateways running", "")
      };

      api.info("<strong>How to read it.</strong> Each minute, pages arrive and the carrier takes up to its limit. The gateway walks its whole queue once a second, so it answers its health check in 1 ms for every page waiting in its memory; past 2,000 pages it misses the 2-second timeout, and after three misses the container orchestrator restarts it with an empty queue. Changing a setting starts the night again at 00:50.");
      api.clock = START * 60;
      api.log("00:50 at St Wendreda's: 12 pages a minute, the carrier takes 20. Nothing waits.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function st() { return t.api.state.N; }

      // 1. The opening state: 00:50, before the lab's batch.
      t.expect(t.stat("time") === "00:50" && t.stat("waiting") === 0 && t.stat("oldest") === 0 && t.stat("porter") === "not sent yet" &&
        t.stat("health") === "0.000 s" && t.stat("memory") === "196 MB of 256" && t.stat("restarts") === 0 && t.stat("gateways") === 1,
        "Opens at 00:50 with nothing waiting, health check 0.000 s, memory 196 MB of 256");

      // 2. The batch at 01:00: 1,052 arrive, 20 go.
      t.click("next10");
      t.click("next");
      t.expect(t.stat("time") === "01:01" && t.stat("waiting") === "1,032" && t.logText().indexOf("the 1,040 result pages it held since 19:00 arrive at once, with the minute's 12.") >= 0,
        "At 01:00 the held 1,040 arrive with the minute's 12; 1,032 wait at 01:01");

      // 3. The porter's page: 01:12 to 02:10, 58 minutes, 40 after the job.
      while (st().m < 131) t.click("next");
      t.expect(t.stat("porter") === "02:10, 58 min late" &&
        t.logText().indexOf("The porter's page (Ward 9, sent 01:12) is delivered at 02:10, 58 minutes late, 40 minutes after the job was done at 01:30.") >= 0,
        "The porter's page from 01:12 is delivered at 02:10, 58 minutes late, 40 minutes after the job was done");

      // 4. The restart at 02:22:22.
      while (st().m < 142) t.click("next");
      var before = t.stat("health") === "2.004 s" && t.stat("memory") === "246 MB of 256" && t.stat("waiting") === "2,004";
      t.click("next");
      t.expect(before && t.stat("restarts") === 1 && t.stat("lost") === "2,004" && t.stat("worst") === 63 && t.stat("urgent") === 62 &&
        t.logText().indexOf("Gateway 1 takes 2.004 s to answer its health check (timeout 2 s), at 02:22:00, :10 and :20. Three misses in a row: the container orchestrator restarts it at 02:22:22. The 2,004 pages it held in memory are lost (62 urgent, 434 normal, 1,508 low).") >= 0,
        "2,004 waiting, health check 2.004 s, memory 246 MB of 256; restarted at 02:22:22 and 2,004 pages lost; worst 63 min, urgent 62");

      // 5. The night as it was, to 03:30.
      t.click("end");
      t.expect(t.stat("time") === "03:30" && t.stat("delivered") === "2,736" && t.stat("waiting") === 0 && t.stat("lost") === "2,004" && t.stat("refused") === 0,
        "As it was, by 03:30: 2,736 delivered, 2,004 lost, none refused");

      // 6. Option A: 1 GB changes nothing but the memory reading.
      t.set("preset", "o0");
      while (st().m < 142) t.click("next");
      var memA = t.stat("memory") === "246 MB of 1,024";
      t.click("end");
      t.expect(memA && t.stat("restarts") === 1 && t.stat("lost") === "2,004" && t.stat("porter") === "02:10, 58 min late" &&
        t.logText().indexOf("the container orchestrator restarts it at 02:22:22") >= 0,
        "1 GB of memory: 246 MB of 1,024 at 02:22, the same restart at 02:22:22, the same 2,004 lost");

      // 7. Option B: bound 250, lanes, refuse the lowest first, alert.
      t.set("preset", "o1");
      t.click("end");
      t.expect(t.stat("urgent") === 0 && t.stat("porter") === "01:12, 0 min late" && t.stat("worst") === 20 && t.stat("restarts") === 0 &&
        t.stat("lost") === 0 && t.stat("refused") === "1,870" && st().refusedBy.u === 0 && st().refusedBy.n === 0 && t.stat("delivered") === "2,870" &&
        t.stat("waiting") === 0 && t.stat("alert") === "01:01",
        "Bound, lanes, refuse low, alert: urgent 0 min, porter on time, low at most 20 min, 1,870 low refused with an answer, nothing lost, alert at 01:01");

      // 8. Option C: up to 2 extra gateways.
      t.set("preset", "o2");
      t.click("end");
      t.expect(t.stat("restarts") === 0 && t.stat("lost") === 0 && t.stat("porter") === "01:17, 5 min late" && t.stat("c429") === "5,742" &&
        t.stat("worst") === 147 && t.stat("urgent") === 143 && t.stat("delivered") === "3,120" && t.stat("waiting") === "1,620" &&
        t.logText().indexOf("gateway 2 is started and takes pages from 01:04.") >= 0 && t.logText().indexOf("gateway 3 is started and takes pages from 01:08.") >= 0,
        "Extra gateways: the carrier still takes 20 a minute and refuses 5,742; gateway 1's backlog starves: worst 147 min, an urgent page 143 min, 1,620 still waiting");

      // 9. Option D: a durable queue.
      t.set("preset", "o3");
      t.click("end");
      t.expect(t.stat("restarts") === 0 && t.stat("lost") === 0 && t.stat("porter") === "02:10, 58 min late" && t.stat("waiting") === "1,620" &&
        t.stat("oldest") === 89 && t.stat("worst") === 88 && t.stat("health") === "0.000 s",
        "Durable queue: nothing lost, but the porter's page still 58 min late and 1,620 waiting at 03:30, the oldest 89 min");

      // 10. A faster carrier contract (40 a minute) clears the batch without a restart.
      t.set("preset", "asis");
      t.set("carrier", "40");
      t.click("end");
      t.expect(t.stat("restarts") === 0 && t.stat("lost") === 0 && t.stat("waiting") === 0 && st().C.carrier === 40,
        "With a carrier limit of 40 a minute the queue drains and nothing restarts");

      // 11. Refusing the newest instead of the lowest priority refuses urgent and porter pages too.
      t.set("preset", "o1");
      t.set("lanes", false);
      t.set("rule", "newest");
      t.click("end");
      t.expect(st().refusedBy.n > 0 && st().refusedBy.u > 0 && t.stat("restarts") === 0,
        "A bound that refuses the newest page, with no lanes, turns away urgent and porters' pages as well");
    }
  });
})();
