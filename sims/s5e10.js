/* sims/s5e10-v1.0.0.js  (published as sims/s5e10.js)
   Case s5e10 "Threads, Processes, Coroutines": a concurrency lab for the Tarravane Circus box
   office, whose seat-map service (Python, on a 4-core machine) finds the best free seats for each
   request in about 120 ms of pure CPU work. On Wednesday Ignatz raised its thread pool from 1 to 8
   "to use all four cores". At Friday's on-sale in Wexbury it served fewer seat maps a second than
   one thread had at Corvanne. The learner picks the model (1 thread, N threads, async, N
   processes, N goroutines), N, cores, CPU per request, switching overhead, I/O wait per request
   and the arrival rate, then runs the two minutes from 19:00:00. Widget-style sim: it draws its
   own core rows and charts inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: models 1 thread, N threads (under the GIL), async (one
     thread, an event loop), N processes, N goroutines; N 1 to 32; cores 1 to 8; CPU per request
     10, 60, 120 or 240 ms; switching overhead 0, 5, 10 or 20%; I/O wait 0, 110 or 400 ms; arrival
     rate 12 a second (an on-sale) or 3 (an ordinary evening). Next 10 seconds, Run to 19:02, Run
     until the line is empty. Stats: arrived, served, queue, served a second, capacity, newest wait,
     longest wait, time in service, cores' work. selfTest: 12 assertions.

   The model (stated in sim.lede):
   - Time moves in steps of 1 ms. Requests arrive evenly from 19:00:00 for 120 seconds: request k
     (from 0) arrives at floor(k x 1000 / rate) ms. 12 a second gives 1,440 requests; 3 gives 360.
   - Each request first waits on I/O for io ms (0 as built: the seating plans are in memory), then
     needs cpu ms of CPU work (120 as built).
   - Pool models (1 thread, N threads, N processes, N goroutines): a request waits in the queue
     until one of the N workers is free, then that worker does its I/O and its CPU work.
   - Async: every request is started at once; its I/O waits overlap; its CPU work joins the event
     loop's line and runs to the end, one at a time, in arrival order. Waiting in that line counts
     as the queue.
   - Lanes: work that can run at the same moment. Threads and async: 1 lane (the GIL lets one
     thread run Python at a time). Processes and goroutines: one lane per core.
   - Each millisecond, the R workers that need the CPU share the lanes. If R is no more than the
     lanes, each does 1 ms of work. If R is more, each does lanes / R x (1 - overhead) ms; the rest
     of that time goes on switching between them.
   - Capacity (seat maps a second with a long line): min(N / (cpu + io), lanes x 1000 / cpu x
     (1 - overhead if N can be more than the lanes)). Async: 1000 / cpu.
   - Time in service: from a worker picking the request up (async: from arrival, less its time in
     the loop's line) to the seat map being sent. Wait: from asking to the seat map being sent.
   - Cores' work: with one lane, the work is spread evenly across the cores (the operating system
     moves the one running thread between them); with one lane per core, busy lanes fill cores 1,
     2, 3, 4 in turn.

   Where every number comes from (conventions rule 14; the case is content/s5/s5e10-v1.0.0.json).
   All are worked out by the model above and checked by the selfTest.
   - 1 thread, 12 a second (Corvanne, three weeks ago): capacity 1000 / 120 = 8.33 a second. At
     19:02:00, 1,440 asked, 1,000 sent, 439 waiting, 1 in service, 8.33 a second, newest wait
     36.75 s. The line is empty at 19:02:52; longest wait 52.88 s; time in service 0.12 s.
   - 8 threads, 12 a second (Wexbury, Friday): capacity 8.33 x 0.9 = 7.50. At 19:02:00, 895 sent,
     537 waiting, 8 in service, 7.46 a second, newest wait 45.37 s. Empty at 19:03:12; longest
     wait 72.30 s; time in service 1.06 s (each request shares the one lane with seven others:
     8 x 0.12 / 0.9 = 1.07 s once the pool is full). Cores' work 1.00 of 4 at 19:02, 0.10 of it
     switching.
   - 32 threads: 885 sent by 19:02, 7.38 a second; longest wait 72.90 s; time in service 4.21 s.
   - Async: the same as 1 thread: 1,000 sent, 439 waiting, 8.33, longest 52.88 s.
   - 4 processes or 4 goroutines on 4 cores: capacity 33.33; 1,439 sent by 19:02 (one in
     service), 11.99 a second (1,439 / 120); every wait 0.12 s; the last goes out at 19:02:00;
     cores' work 1.44 of 4 (12 a second x 0.12 s).
   - Overhead 0, 8 threads: by 19:02, 996 sent (eight part-done requests share the turn), and the
     line empties at 19:02:52, the same moment as 1 thread: switching is the whole loss.
   - 8 threads, 3 a second (Thursday, an ordinary evening): 360 sent, longest wait 0.12 s.
   - I/O 110 ms, CPU 10 ms: 1 thread 8.33 a second and 52.88 s; 8 threads 1,439 by 19:02, waits
     0.12 s.
   - The Wexbury dashboard at 19:00:30: 221 sent, 132 waiting, newest wait 11.58 s; at 19:01:00:
     446 sent, 267 waiting, 22.87 s. Corvanne: 250 and 110, 9.25 s; 500 and 220, 18.42 s.
   - Cold case: 4 processes, I/O 400 ms, CPU 120 ms: capacity 4 / 0.52 = 7.69 a second. At 19:02,
     920 sent, 516 waiting, 7.67 a second, newest wait 43.27 s, cores' work 0.92 of 4.
*/
(function () {
  "use strict";

  var T0 = 68400; // 19:00:00
  var WIN = 120;  // seconds of arrivals
  var CAP_MS = 600000; // Run until empty stops after 10 minutes
  var BUCKET = 5000;
  var EPS = 1e-6;

  var MODELS = [
    { value: "one", label: "1 thread (before Wednesday)" },
    { value: "threads", label: "N threads (as on Friday: 8)" },
    { value: "async", label: "Async: one thread, an event loop" },
    { value: "procs", label: "N processes" },
    { value: "go", label: "N goroutines (Go)" }
  ];
  var SHORT = { one: "1 thread", threads: "threads", async: "async", procs: "processes", go: "goroutines" };
  function opts(list, unit) { return list.map(function (v) { return { value: v, label: v + unit }; }); }

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function s2(ms) { return (ms / 1000).toFixed(2) + " s"; }
  function hms(sec) {
    var x = Math.floor(sec);
    function p(v) { return (v < 10 ? "0" : "") + v; }
    return p(Math.floor(x / 3600)) + ":" + p(Math.floor(x / 60) % 60) + ":" + p(x % 60);
  }
  function labelOf(v) { for (var i = 0; i < MODELS.length; i++) if (MODELS[i].value === v) return MODELS[i].label; return v; }

  /* ---------- the model (pure; the display and self-tests read it) ---------- */

  function workers(C) { return C.model === "one" ? 1 : C.n; }
  function lanes(C) { return C.model === "procs" || C.model === "go" ? C.cores : 1; }
  function nameN(C) {
    if (C.model === "one") return "1 thread";
    if (C.model === "async") return "async";
    return C.n + " " + SHORT[C.model];
  }

  function capacity(C) {
    var per = 1000 / C.cpu;
    if (C.model === "async") return per;
    var L = lanes(C);
    var N = workers(C);
    var cpuCap = L * per * (N > L ? 1 - C.sw / 100 : 1);
    return Math.min(N * 1000 / (C.cpu + C.io), cpuCap);
  }

  function fresh(C) {
    var total = Math.round(C.rate * WIN);
    var arr = [];
    for (var k = 0; k < total; k++) arr.push(Math.floor(k * 1000 / C.rate));
    var core = [];
    for (var c = 0; c < C.cores; c++) core.push({ use: 0, sw: 0 });
    return {
      t: 0, total: total, arr: arr, next: 0, queue: [], work: [], st: [], qw: [], done: 0,
      sumSvc: 0, maxLat: 0, lastLat: -1, lastDone: 0, core: core, useAll: 0, swAll: 0,
      served: [], qlen: [], wait: []
    };
  }

  function readyList(W) {
    return W.work.filter(function (w) { return w.io <= 0 && w.cpu > EPS; });
  }
  function queueLen(C, W) {
    if (C.model !== "async") return W.queue.length;
    var r = readyList(W).length;
    return r > 0 ? r - 1 : 0;
  }
  function inService(C, W) { return W.work.length - (C.model === "async" ? queueLen(C, W) : 0); }

  // Arrivals up to now, and free workers picking up the next request in the queue.
  function admit(C, W) {
    var t = W.t;
    var id;
    while (W.next < W.total && W.arr[W.next] <= t) {
      id = W.next;
      W.next += 1;
      W.qw[id] = 0;
      if (C.model === "async") { W.st[id] = t; W.work.push({ id: id, io: C.io, cpu: C.cpu }); }
      else W.queue.push(id);
    }
    if (C.model !== "async") {
      var cap = workers(C);
      while (W.queue.length && W.work.length < cap) {
        id = W.queue.shift();
        W.st[id] = t;
        W.work.push({ id: id, io: C.io, cpu: C.cpu });
      }
    }
  }

  // One millisecond: arrivals, pick-ups, then the work done in [t, t+1).
  function step(C, W) {
    var t = W.t;
    admit(C, W);
    if (t % BUCKET === 0) W.qlen[t / BUCKET] = queueLen(C, W);
    var ready = [];
    W.work.forEach(function (w) { if (w.io > 0) w.io -= 1; else if (w.cpu > EPS) ready.push(w); });
    var L = lanes(C);
    var R = ready.length;
    var use = 0;
    var swc = 0;
    var busy = 0;
    if (C.model === "async") {
      if (R) {
        ready[0].cpu -= 1;
        use = 1;
        busy = 1;
        for (var i = 1; i < R; i++) W.qw[ready[i].id] += 1;
      }
    } else if (R) {
      var over = R > L;
      var r = over ? (L / R) * (1 - C.sw / 100) : 1;
      ready.forEach(function (w) { w.cpu -= r; });
      use = over ? L * (1 - C.sw / 100) : R;
      swc = over ? L * C.sw / 100 : 0;
      busy = Math.min(R, L);
    }
    W.useAll += use;
    W.swAll += swc;
    if (busy) {
      if (L === 1) {
        W.core.forEach(function (c) { c.use += use / C.cores; c.sw += swc / C.cores; });
      } else {
        for (var c = 0; c < busy; c++) { W.core[c].use += use / busy; W.core[c].sw += swc / busy; }
      }
    }
    W.t = t + 1;
    var b = Math.floor(t / BUCKET);
    W.work = W.work.filter(function (w) {
      if (w.io > 0 || w.cpu > EPS) return true;
      var lat = W.t - W.arr[w.id];
      var svc = C.model === "async" ? lat - W.qw[w.id] : W.t - W.st[w.id];
      W.done += 1;
      W.sumSvc += svc;
      W.lastLat = lat;
      W.lastDone = W.t;
      if (lat > W.maxLat) W.maxLat = lat;
      W.served[b] = (W.served[b] || 0) + 1;
      if (!W.wait[b] || lat > W.wait[b]) W.wait[b] = lat;
      return false;
    });
  }

  function empty(W) { return W.next >= W.total && !W.queue.length && !W.work.length; }
  function runTo(C, W, ms) { while (W.t < ms) step(C, W); }
  function runEmpty(C, W) { while (!empty(W) && W.t < CAP_MS) step(C, W); }

  function summary(C, W) {
    var sec = W.t / 1000;
    return {
      arrived: W.next,
      served: W.done,
      queue: queueLen(C, W),
      inSvc: inService(C, W),
      rate: sec > 0 ? (W.done / sec).toFixed(2) : "none yet",
      cap: capacity(C).toFixed(2),
      newest: W.lastLat < 0 ? "none yet" : s2(W.lastLat),
      longest: W.done ? s2(W.maxLat) : "none yet",
      svc: W.done ? s2(W.sumSvc / W.done) : "none yet",
      cores: W.t ? (W.useAll / W.t + W.swAll / W.t).toFixed(2) + " of " + C.cores + ", " + (W.swAll / W.t).toFixed(2) + " switching" : "none yet"
    };
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, g, x, y, s, anchor) {
    var e = mk(doc, "text", { x: x, y: y, "font-size": 11, fill: "currentColor", "text-anchor": anchor || "start" }, g);
    e.textContent = s;
    return e;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  function build(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var wrap = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;");
    var head = el("p", "margin:0;");
    var code = el("pre", "margin:0;padding:8px;overflow-x:auto;border:1px solid currentColor;border-radius:4px;font-size:11px;");
    var svg = mk(doc, "svg", { viewBox: "0 0 660 330", width: "100%", role: "img",
      "aria-label": "Top: one row per core, one cell per 5 seconds; the darker the cell, the more of it went on useful work; a cell's thin top strip shows time lost to switching. Below: three charts over time: seat maps sent a second, requests in the queue, and the longest wait of the seat maps sent in each 5 seconds." });
    var g = mk(doc, "g", {}, svg);
    wrap.appendChild(head);
    wrap.appendChild(code);
    wrap.appendChild(svg);
    api.root.appendChild(wrap);
    return { head: head, code: code, g: g, doc: doc };
  }

  function codeFor(C) {
    if (C.model === "async") {
      return "async def seat_map(show_id):\n    plan = await load_plan(show_id)\n    return best_seats(plan)    # " + C.cpu + " ms of CPU, on the loop";
    }
    if (C.model === "go") {
      return "for i := 0; i < " + C.n + "; i++ {\n    go worker(requests, seatMaps)  // " + C.n + " goroutines\n}";
    }
    var line = C.model === "procs" ? "pool = ProcessPoolExecutor(max_workers=" + C.n + ")" :
      "pool = ThreadPoolExecutor(max_workers=" + workers(C) + ")" + (C.model === "threads" && C.n === 8 ? "   # was 1" : "");
    return line + "\ndef seat_map(show_id):\n    return best_seats(load_plan(show_id))  # about " + C.cpu + " ms of CPU";
  }

  function chart(doc, g, x0, y0, w, h, title, vals, nb, scale, unit) {
    txt(doc, g, x0, y0 - 4, title);
    mk(doc, "rect", { x: x0, y: y0, width: w, height: h, fill: "none", stroke: "currentColor", "stroke-opacity": 0.3 }, g);
    var top = 0;
    for (var i = 0; i < nb; i++) if ((vals[i] || 0) > top) top = vals[i] || 0;
    if (!top) { txt(doc, g, x0 + 6, y0 + h / 2 + 4, "nothing yet"); return; }
    var d = "";
    for (var j = 0; j < nb; j++) {
      var px = x0 + (j + 0.5) * w / nb;
      var py = y0 + h - (vals[j] || 0) / top * (h - 4);
      d += (j ? "L" : "M") + px.toFixed(1) + " " + py.toFixed(1);
    }
    mk(doc, "path", { d: d, fill: "none", stroke: "currentColor", "stroke-width": 1.5 }, g);
    txt(doc, g, x0 + w - 4, y0 + 12, "top " + (top * scale).toFixed(unit === "s" ? 1 : 0) + (unit ? " " + unit : ""), "end");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var W = S.W;
    var ui = S.ui;
    var doc = ui.doc;
    var g = ui.g;
    clear(g);
    var nb = Math.max(WIN * 1000 / BUCKET, Math.ceil(W.t / BUCKET));
    var x0 = 70;
    var cw = 580 / nb;
    txt(doc, g, 0, 12, "Cores, 5 s a cell, from 19:00:00");
    var b0 = Math.floor((W.t - 1) / BUCKET);
    for (var c = 0; c < C.cores; c++) {
      var y = 20 + c * 16;
      txt(doc, g, 0, y + 11, "core " + (c + 1));
      for (var b = 0; b < nb; b++) {
        var cell = (S.cellLog[c] && S.cellLog[c][b]) || { use: 0, sw: 0 };
        var span = b === b0 ? (W.t - b * BUCKET) : BUCKET;
        var u = b > b0 ? 0 : cell.use / span;
        var sw = b > b0 ? 0 : cell.sw / span;
        mk(doc, "rect", { x: (x0 + b * cw).toFixed(1), y: y, width: Math.max(cw - 1, 0.5).toFixed(1), height: 12,
          fill: "currentColor", "fill-opacity": (0.08 + 0.8 * u).toFixed(2) }, g);
        if (sw > 0.001) mk(doc, "rect", { x: (x0 + b * cw).toFixed(1), y: y, width: Math.max(cw - 1, 0.5).toFixed(1), height: 3,
          fill: "none", stroke: "currentColor", "stroke-dasharray": "2 1" }, g);
      }
    }
    var top = 20 + C.cores * 16 + 26;
    var hh = Math.max(40, Math.floor((330 - top - 30) / 3) - 22);
    var served = [];
    for (var i = 0; i < nb; i++) served.push((W.served[i] || 0) / (BUCKET / 1000));
    chart(doc, g, x0, top, 580, hh, "Seat maps sent a second", served, nb, 1, "");
    chart(doc, g, x0, top + hh + 22, 580, hh, "Requests in the queue", W.qlen, nb, 1, "");
    chart(doc, g, x0, top + 2 * (hh + 22), 580, hh, "Longest wait of the seat maps sent", W.wait, nb, 0.001, "s");
  }

  // Per-core use per 5 s cell, kept beside the model so the drawing can read it.
  function track(S) {
    var W = S.W;
    var b = Math.floor((W.t - 1) / BUCKET);
    for (var c = 0; c < W.core.length; c++) {
      var prev = S.prevCore[c];
      var row = S.cellLog[c] || (S.cellLog[c] = []);
      var cell = row[b] || (row[b] = { use: 0, sw: 0 });
      cell.use += W.core[c].use - prev.use;
      cell.sw += W.core[c].sw - prev.sw;
      prev.use = W.core[c].use;
      prev.sw = W.core[c].sw;
    }
  }

  function advance(api, ms, toEmpty) {
    var S = api.state;
    var C = S.C;
    var W = S.W;
    var goal = toEmpty ? CAP_MS : Math.min(ms, CAP_MS);
    while (W.t < goal) {
      if (toEmpty && empty(W)) break;
      step(C, W);
      if (W.t % 100 === 0 || empty(W)) track(S);
    }
    track(S);
    admit(C, W);
    api.clock = T0 + W.t / 1000;
  }

  function show(api) {
    var S = api.state;
    var C = S.C;
    var m = summary(C, S.W);
    S.ui.head.textContent = "Model: " + labelOf(C.model) + (C.model === "threads" || C.model === "procs" || C.model === "go" ? ", N = " + C.n : "") +
      ". " + C.cores + " cores. Each request: " + C.io + " ms of I/O wait, then " + C.cpu + " ms of CPU. Switching overhead " + C.sw +
      "%. " + C.rate + " requests a second from 19:00:00 for two minutes.";
    S.ui.code.textContent = codeFor(C);
    S.stat.arrived(fmt(m.arrived));
    S.stat.served(fmt(m.served));
    S.stat.queue(fmt(m.queue));
    S.stat.rate(m.rate);
    S.stat.cap(m.cap);
    S.stat.newest(m.newest);
    S.stat.longest(m.longest);
    S.stat.svc(m.svc);
    S.stat.cores(m.cores);
    draw(api);
    return m;
  }

  function rewind(api, what) {
    var S = api.state;
    S.W = fresh(S.C);
    S.cellLog = [];
    S.prevCore = S.W.core.map(function () { return { use: 0, sw: 0 }; });
    api.clock = T0;
    api.log(what + " Rewound to 19:00:00, before the first request. Capacity with a long line: " + capacity(S.C).toFixed(2) + " a second.", "");
    show(api);
  }

  DL.sims.define("s5e10", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      api.clock = T0;
      S.C = { model: "threads", n: 8, cores: 4, cpu: 120, io: 0, sw: 10, rate: 12 };
      S.W = fresh(S.C);
      S.cellLog = [];
      S.prevCore = S.W.core.map(function () { return { use: 0, sw: 0 }; });
      S.ui = build(api);
      function on(key, conv, what) {
        return function (v) {
          var x = conv(v);
          if (S.C[key] === x) return;
          S.C[key] = x;
          rewind(api, what(x));
        };
      }
      api.control.select("model", "Model", MODELS, "threads", on("model", String, function (x) { return "Model: " + labelOf(x) + "."; }));
      api.control.select("n", "N (threads, processes or goroutines)", opts([1, 2, 4, 8, 16, 32], ""), 8, on("n", Number, function (x) { return "N = " + x + "."; }));
      api.control.select("cores", "Cores", opts([1, 2, 4, 8], ""), 4, function (v) {
        S.C.cores = Number(v);
        rewind(api, "Cores: " + S.C.cores + ".");
      });
      api.control.select("cpu", "CPU work per request", opts([10, 60, 120, 240], " ms"), 120, on("cpu", Number, function (x) { return "CPU per request: " + x + " ms."; }));
      api.control.select("sw", "Switching overhead", opts([0, 5, 10, 20], "%"), 10, on("sw", Number, function (x) { return "Switching overhead: " + x + "%."; }));
      api.control.select("io", "I/O wait per request", opts([0, 110, 400], " ms"), 0, on("io", Number, function (x) { return "I/O wait per request: " + x + " ms."; }));
      api.control.select("rate", "Requests a second", [{ value: 12, label: "12 (an on-sale)" }, { value: 3, label: "3 (an ordinary evening)" }], 12,
        on("rate", Number, function (x) { return "Arrivals: " + x + " a second."; }));
      api.control.button("next", "Next 10 seconds", function () {
        advance(api, api.state.W.t + 10000, false);
        var m = show(api);
        api.log(hms(T0 + S.W.t / 1000) + ". " + fmt(m.arrived) + " asked, " + fmt(m.served) + " sent, " + fmt(m.queue) + " waiting.", "");
      });
      api.control.button("run", "Run to 19:02", function () {
        if (S.W.t >= WIN * 1000) return;
        advance(api, WIN * 1000, false);
        var m = show(api);
        api.log("19:02:00, " + nameN(S.C) + ". " + fmt(m.arrived) + " asked, " + fmt(m.served) + " seat maps sent, " + fmt(m.queue) + " waiting, " +
          m.inSvc + " in service. " + m.rate + " a second; the newest seat map waited " + m.newest + ".", Number(m.queue) > 0 ? "bad" : "ok");
      });
      api.control.button("drain", "Run until the line is empty", function () {
        advance(api, 0, true);
        var m = show(api);
        if (!empty(S.W)) { api.log("Stopped at " + hms(T0 + S.W.t / 1000) + ": the line still isn't empty.", "bad"); return; }
        api.log(hms(T0 + S.W.lastDone / 1000) + ", " + nameN(S.C) + ". The line is empty. All " + fmt(m.served) + " sent; the longest wait was " + m.longest +
          "; average time in service " + m.svc + ".", S.W.maxLat > 1000 ? "bad" : "ok");
      });
      api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        arrived: api.stat("arrived", "requests asked", ""),
        served: api.stat("served", "seat maps sent", ""),
        queue: api.stat("queue", "waiting in the queue", "bad"),
        rate: api.stat("rate", "sent a second since 19:00", ""),
        cap: api.stat("cap", "capacity a second, long line", ""),
        newest: api.stat("newest", "newest seat map's wait", "warn"),
        longest: api.stat("longest", "longest wait", "bad"),
        svc: api.stat("svc", "time in service, average", ""),
        cores: api.stat("cores", "cores' worth of work", "")
      };
      api.info("<strong>How to read it.</strong> A request asks for a seat map. It waits in the queue until a worker is free, then waits on I/O (if any), then needs CPU work. Threads and async have one lane: only one runs Python at a time. Processes and goroutines get one lane per core. When more workers need a lane than there are lanes, each gets a share, and part of the time goes on switching. Each core row shows how busy that core was, 5 seconds a cell. The charts show seat maps sent a second, the queue, and the longest wait.");
      api.log("19:00:00, before the first request. " + labelOf(S.C.model) + ". 12 requests a second are due until 19:02. Capacity with a long line: " + capacity(S.C).toFixed(2) + " a second.", "");
      show(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens at 19:00:00 with 8 threads and nothing asked yet.
      t.expect(t.stat("arrived") === 0 && t.stat("served") === 0 && t.stat("cap") === 7.5 && t.stat("rate") === "none yet" &&
        has("19:00:00, before the first request.") && has("Capacity with a long line: 7.50 a second."),
        "Opens at 19:00:00, before the first request: 8 threads, capacity 7.50 a second");

      // 2. Friday at Wexbury: 8 threads, 12 a second.
      t.click("run");
      t.expect(has("19:02:00, 8 threads. 1,440 asked, 895 seat maps sent, 537 waiting, 8 in service. 7.46 a second; the newest seat map waited 45.37 s.") &&
        t.stat("served") === 895 && t.stat("queue") === 537 && t.stat("rate") === 7.46,
        "8 threads at 19:02: 895 sent, 537 waiting, 7.46 a second, newest wait 45.37 s");
      t.click("drain");
      t.expect(has("19:03:12, 8 threads. The line is empty. All 1,440 sent; the longest wait was 72.30 s; average time in service 1.06 s.") &&
        t.stat("longest") === "72.30 s" && t.stat("svc") === "1.06 s",
        "8 threads: the line empties at 19:03:12; longest wait 72.30 s; 1.06 s in service each");

      // 3. Corvanne: one thread, the same 12 a second.
      t.set("model", "one");
      t.click("run");
      var one = has("19:02:00, 1 thread. 1,440 asked, 1,000 seat maps sent, 439 waiting, 1 in service. 8.33 a second; the newest seat map waited 36.75 s.") &&
        t.stat("cap") === 8.33;
      t.click("drain");
      t.expect(one && has("19:02:52, 1 thread. The line is empty. All 1,440 sent; the longest wait was 52.88 s; average time in service 0.12 s."),
        "1 thread: 1,000 sent by 19:02, 8.33 a second; empty at 19:02:52, longest wait 52.88 s");

      // 4. Overhead 0: eight threads are exactly one thread. The switching is the whole loss.
      t.set("model", "threads");
      t.set("sw", 0);
      t.click("drain");
      t.expect(has("19:02:52, 8 threads. The line is empty. All 1,440 sent;") && t.stat("cap") === 8.33 &&
        t.stat("cores") === "1.00 of 4, 0.00 switching",
        "8 threads with no switching overhead: capacity 8.33 and the line empties at 19:02:52, the same as 1 thread");
      t.set("sw", 10);

      // 5. Option 0: 32 threads.
      t.set("n", 32);
      t.click("run");
      var t32 = t.stat("served") === 885 && t.stat("rate") === 7.38;
      t.click("drain");
      t.expect(t32 && t.stat("longest") === "72.90 s" && t.stat("svc") === "4.21 s",
        "32 threads: 885 sent by 19:02 (7.38 a second), longest wait 72.90 s, 4.21 s in service");

      // 6. Option 1: async, with nothing to wait on, is one thread again.
      t.set("model", "async");
      t.click("run");
      var as = t.stat("served") === "1,000" && t.stat("queue") === 439 && t.stat("cap") === 8.33;
      t.click("drain");
      t.expect(as && t.stat("longest") === "52.88 s" && t.stat("svc") === "0.12 s",
        "Async with 0 ms of I/O: 1,000 sent, 439 waiting, longest wait 52.88 s, the same as 1 thread");

      // 7. Option 2: a process pool, one per core.
      t.set("model", "procs");
      t.set("n", 4);
      t.click("run");
      t.expect(t.stat("served") === "1,439" && t.stat("queue") === 0 && t.stat("cap") === 33.33 && t.stat("longest") === "0.12 s" &&
        t.stat("cores") === "1.44 of 4, 0.00 switching",
        "4 processes on 4 cores: capacity 33.33, 1,439 sent by 19:02, every wait 0.12 s");

      // 8. Option 3: goroutines on every core give the same numbers as the process pool.
      t.set("model", "go");
      t.click("run");
      t.expect(t.stat("served") === "1,439" && t.stat("longest") === "0.12 s" && t.stat("cap") === 33.33,
        "4 goroutines on 4 cores: the same as 4 processes, 1,439 sent, 0.12 s");

      // 9. Thursday, an ordinary evening: 8 threads at 3 a second look fine.
      t.set("model", "threads");
      t.set("n", 8);
      t.set("rate", 3);
      t.click("drain");
      t.expect(t.stat("served") === 360 && t.stat("longest") === "0.12 s",
        "8 threads at 3 a second: all 360 sent, no wait longer than 0.12 s, so Thursday looked fine");
      t.set("rate", 12);

      // 10. Mostly I/O: 10 ms of CPU and 110 ms of waiting. Now threads help.
      t.set("cpu", 10);
      t.set("io", 110);
      t.click("run");
      var th = t.stat("served") === "1,439" && t.stat("longest") === "0.12 s";
      t.set("model", "one");
      t.click("run");
      t.expect(th && t.stat("served") === "1,000" && t.stat("rate") === 8.33,
        "Mostly I/O: 8 threads send 1,439 with 0.12 s waits; 1 thread still sends only 1,000");

      // 11. Cold case: 4 processes that also wait 400 ms on I/O.
      t.set("cpu", 120);
      t.set("io", 400);
      t.set("model", "procs");
      t.set("n", 4);
      t.expect(t.stat("cap") === 7.69 && has("Capacity with a long line: 7.69 a second."),
        "4 processes with 400 ms of I/O each: capacity 4 / 0.52 = 7.69 a second");
    }
  });
})();
