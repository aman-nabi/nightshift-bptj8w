/* sims/s6e11-v1.0.0.js  (published as sims/s6e11.js)
   Case s6e11 "Autoscaling": a scaling lab for the Kelsor water bus ticket service on the night of a
   stadium concert. 1,500 people buy tickets in the ferry app in 5 minutes; workers issue them one at
   a time, each waiting 2 s for the bank; an autoscaler adds workers by a rule. The learner picks the
   scaling signal (average CPU, tickets waiting per worker, or serverless functions), the threshold,
   how long the signal must stay over it, the warm-up time, the minimum number of workers and, for
   serverless, whether copies are kept warm, then runs the night second by second from 21:58:00 to
   22:20:00 and watches the 22:05 boat.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: signals CPU, tickets waiting per worker, serverless; CPU
     thresholds 60, 40, 20, 10 %; waiting-per-worker thresholds 10, 25, 50; period 3 min or 1 min;
     warm-up 60, 30 or 120 s; minimum workers 2, 4 or 8; serverless with 0 or 10 warm copies.
     Buttons: forward 10 s, run to 22:05, run to 22:20, start the night again, reset. A strip of
     workers, a chart of purchases waiting, and a table of the four boats. selfTest: 10 assertions.

   The model (stated in sim.lede and the post):
   - One step is one second. The night opens at 21:58:00 with nothing run; each step moves the clock
     on one second and runs that moment. Order inside a moment: tickets finish, new workers finish
     starting, purchases arrive, idle workers take purchases, the autoscaler looks, a boat leaves.
   - Purchases: 5 a second at 22:00:00 to 22:04:59 (300 seconds), 1,500 in all. None before.
   - A worker takes one purchase, calls the bank and waits 2 s, then the ticket is issued. Workers
     share 8 lines to the bank (the bank's limit for the ferry company), so at most 8 work at once.
   - CPU of a running worker: 15 % while issuing a ticket, 2 % while idle. Average CPU is over
     running workers; workers still starting are left out (as AWS does during warm-up).
   - Waiting = bought, no ticket yet, not refused (the phones that say "payment processing").
     Tickets waiting per worker = waiting / all workers, including those starting.
   - Autoscaler: each second, if the signal is over the threshold, a counter goes up, otherwise it
     goes to 0. When it reaches the period, workers are added up to the wanted number and the counter
     restarts. Wanted: CPU, ceil(workers x CPU / threshold); waiting per worker, ceil(waiting /
     threshold); never more than the maximum, max(8, minimum). New workers start for the warm-up
     time, then take purchases.
   - Scaling in: when the signal has stayed under the threshold for 5 minutes and no worker is
     starting, one idle worker is removed, then one a minute, never below the minimum.
   - Serverless: no queue and no workers. Each purchase goes to a free warm copy, or starts a new
     copy, which takes 1 s to start (a cold start). The copy then calls the bank; if 8 calls are
     already in flight, the bank refuses and the purchase fails ("payment failed"). Refused buyers
     are counted, not retried. Copies stay warm for the rest of the night. "10 warm copies" starts
     the night with 10 copies already started.
   - Boats leave at 22:05, 22:10, 22:15 and 22:20, 400 seats each. A boat takes everyone holding a
     ticket who is not yet aboard, up to 400.
   - Worker-minutes: every worker running or starting, each second, over 60 (what is paid for).

   Where every number comes from (conventions rule 14; the case is content/s6/s6e11-v1.0.0.json).
   Worked out from the model above and checked by the selfTest:
   - As now (CPU over 60 % for 3 minutes, 2 workers): 2 workers issue 2 tickets every 2 s, 1 a
     second. At 22:05:00, 300 s after the crowd began: 300 issued, 1,500 - 300 = 1,200 waiting,
     CPU 15 %, no worker added. The 22:05 boat leaves with 300 of 400 seats taken. Before 22:00,
     CPU 2 %. At 22:20:00: 1,200 issued, 300 still waiting; boats 300, 300, 300, 300.
     Worker-minutes 44 (2 workers x 22 minutes).
   - CPU threshold 20 % (option 0): 15 % never passes it; the same as now.
   - CPU threshold 10 %: 15 % passes it from 22:00:00; one worker added at 22:02:59 (2 to 3), two
     at 22:05:59, three at 22:08:59; the 22:05 boat leaves with 330 of 400.
   - Minimum 8 workers, always on (option 1): 8 lines to the bank, 4 tickets a second from 22:00:02;
     at 22:05 1,197 issued, 303 waiting, CPU 15 %, boat full (400 of 400); all 1,500 issued at
     22:06:16. Worker-minutes 176 (8 x 22), against 44 as now. Minimum 4: 600 issued at 22:05.
   - Tickets waiting per worker over 10 for 3 minutes, warm-up 60 s (option 2, the fix): over 10
     from the first seconds of the crowd; at 22:03:03 the rule adds 6 workers (8 in all; 369
     waiting per worker); they take purchases from 22:04:03. At 22:05: 468 issued, 1,032 waiting,
     boat full (400 of 400). All 1,500 issued at 22:09:18. Scaled back in, one a minute, from
     22:13:57 to 2 workers at 22:18:57. Worker-minutes 124.
   - The same with a 1-minute period: adds 6 at 22:01:03, ready 22:02:03; at 22:05, 828 issued;
     all issued at 22:07:48.
   - Serverless as-is (option 3): 10 cold starts (10 copies, each started once), 303 purchases
     refused by the bank ("payment failed"); at 22:05: 1,192 issued, boat full. With 10 warm
     copies: 0 cold starts, still 300 refused (10 calls wanted at once at 5 a second x 2 s; the
     bank takes 8, so about 1 a second is refused for 300 seconds).
   Exact figures are printed by the selfTest messages below; the case quotes only these.
*/
(function () {
  "use strict";

  var T0 = 21 * 3600 + 58 * 60;   // 21:58:00, step 0
  var CROWD_FROM = 120;           // 22:00:00
  var CROWD_TO = 420;             // 22:05:00 (exclusive)
  var PER_SEC = 5;
  var END = 1320;                 // 22:20:00
  var BANK = 2;                   // seconds the bank takes
  var LINES = 8;                  // the bank's limit: calls at once
  var COLD = 1;                   // seconds for a new serverless copy to start
  var SEATS = 400;
  var BOATS = [420, 720, 1020, 1320];
  var CPU_BUSY = 15;
  var CPU_IDLE = 2;
  var CALM = 300;                 // 5 minutes under the threshold before scaling in
  var STEP_IN = 60;               // then one worker a minute

  var SIGNALS = [
    { value: "cpu", label: "Average CPU (as now)" },
    { value: "queue", label: "Tickets waiting per worker" },
    { value: "serverless", label: "Serverless functions, one copy per purchase" }
  ];
  var CPU_T = [
    { value: 60, label: "60 % (as now)" }, { value: 40, label: "40 %" },
    { value: 20, label: "20 %" }, { value: 10, label: "10 %" }
  ];
  var QUEUE_T = [
    { value: 10, label: "10 waiting per worker" }, { value: 25, label: "25 waiting per worker" },
    { value: 50, label: "50 waiting per worker" }
  ];
  var PERIODS = [{ value: 180, label: "3 minutes (as now)" }, { value: 60, label: "1 minute" }];
  var WARMS = [{ value: 60, label: "60 s (as now)" }, { value: 30, label: "30 s" }, { value: 120, label: "120 s" }];
  var MINS = [{ value: 2, label: "2 (as now)" }, { value: 4, label: "4" }, { value: 8, label: "8 (the bank's limit)" }];
  var COPIES = [{ value: 0, label: "None (as-is)" }, { value: 10, label: "10 kept warm" }];

  /* ---------- small helpers ---------- */

  function two(n) { return n < 10 ? "0" + n : String(n); }
  function clock(s) {
    var x = T0 + s;
    return two(Math.floor(x / 3600) % 24) + ":" + two(Math.floor(x / 60) % 60) + ":" + two(x % 60);
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return list[0];
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  /* ---------- the model ---------- */

  function maxWorkers(C) { return Math.max(LINES, C.min); }
  function threshold(C) { return C.signal === "cpu" ? C.cpuT : C.queueT; }

  function newNight(C) {
    var R = {
      C: C, s: 0, bought: 0, issued: 0, refused: 0, held: 0, queue: 0, lines: 0,
      workers: [], copies: [], cold: 0, breach: 0, calm: 0, workerSec: 0,
      boats: [], series: [0], firstAdd: -1, allIssued: -1, cpu: CPU_IDLE, events: []
    };
    var i;
    if (C.signal === "serverless") {
      for (i = 0; i < C.copies; i++) R.copies.push({ state: "idle", until: 0 });
    } else {
      for (i = 0; i < C.min; i++) R.workers.push({ state: "idle", until: 0 });
    }
    return R;
  }

  function waiting(R) { return R.bought - R.issued - R.refused; }
  function running(R) { return R.workers.filter(function (w) { return w.state !== "starting"; }); }
  function starting(R) { return R.workers.length - running(R).length; }
  function avgCpu(R) {
    var run = running(R);
    if (!run.length) return 0;
    var sum = 0;
    run.forEach(function (w) { sum += w.state === "busy" ? CPU_BUSY : CPU_IDLE; });
    return Math.round(sum / run.length);
  }
  function perWorker(R) { return R.workers.length ? Math.round(waiting(R) / R.workers.length) : 0; }

  function say(R, msg, tone) { R.events.push({ msg: clock(R.s) + " " + msg, tone: tone || "" }); }

  function bankCall(R, c) {
    if (R.lines < LINES) {
      R.lines += 1;
      c.state = "bank";
      c.until = R.s + BANK;
    } else {
      R.refused += 1;
      c.state = "idle";
    }
  }

  // Runs the next moment (one second).
  function stepSecond(R) {
    var C = R.C;
    R.s += 1;
    var s = R.s;
    var i;
    if (C.signal === "serverless") {
      R.copies.forEach(function (c) {
        if (c.state === "bank" && c.until === s) { c.state = "idle"; R.lines -= 1; R.issued += 1; R.held += 1; }
      });
      R.copies.forEach(function (c) { if (c.state === "cold" && c.until === s) bankCall(R, c); });
      if (s >= CROWD_FROM && s < CROWD_TO) {
        R.bought += PER_SEC;
        for (i = 0; i < PER_SEC; i++) {
          var free = null;
          for (var k = 0; k < R.copies.length; k++) if (R.copies[k].state === "idle") { free = R.copies[k]; break; }
          if (free) bankCall(R, free);
          else { R.copies.push({ state: "cold", until: s + COLD }); R.cold += 1; }
        }
      }
      if (s === CROWD_FROM) say(R, "The crowd starts buying: 5 purchases a second.", "warn");
    } else {
      var ready = 0;
      R.workers.forEach(function (w) {
        if (w.state === "busy" && w.until === s) { w.state = "idle"; R.lines -= 1; R.issued += 1; R.held += 1; }
        if (w.state === "starting" && w.until === s) { w.state = "idle"; ready += 1; }
      });
      if (ready) say(R, plural(ready, "new worker", "new workers") + " ready; " + R.workers.length + " workers now take purchases.", "ok");
      if (s >= CROWD_FROM && s < CROWD_TO) { R.bought += PER_SEC; R.queue += PER_SEC; }
      if (s === CROWD_FROM) say(R, "The crowd starts buying: 5 purchases a second.", "warn");
      R.workers.forEach(function (w) {
        if (w.state === "idle" && R.queue > 0 && R.lines < LINES) {
          w.state = "busy"; w.until = s + BANK; R.queue -= 1; R.lines += 1;
        }
      });
      R.cpu = avgCpu(R);
      autoscale(R);
    }
    if (R.allIssued < 0 && R.bought === 1500 && waiting(R) === 0) R.allIssued = s;
    var b = BOATS.indexOf(s);
    if (b >= 0) {
      var on = Math.min(SEATS, R.held);
      R.held -= on;
      R.boats[b] = on;
      say(R, "Boat leaves: " + on + " of " + SEATS + " seats taken; " + fmt(waiting(R)) + " purchases waiting" +
        (C.signal === "serverless" ? ", " + fmt(R.refused) + " refused by the bank." : "; average CPU " + R.cpu + "%."),
        on < SEATS ? "bad" : "ok");
    }
    R.workerSec += C.signal === "serverless" ? 0 : R.workers.length;
    if (s % 10 === 0) R.series.push(waiting(R));
  }

  function autoscale(R) {
    var C = R.C;
    var t = threshold(C);
    var m = C.signal === "cpu" ? R.cpu : waiting(R) / R.workers.length;
    if (m > t) { R.breach += 1; R.calm = 0; } else { R.breach = 0; R.calm += 1; }
    var shown = C.signal === "cpu" ? "average CPU " + R.cpu + "%" : "tickets waiting per worker " + perWorker(R);
    if (R.breach >= C.period) {
      R.breach = 0;
      var want = C.signal === "cpu" ? Math.ceil(R.workers.length * R.cpu / t) : Math.ceil(waiting(R) / t);
      want = Math.min(maxWorkers(C), want);
      var add = want - R.workers.length;
      if (add > 0) {
        for (var i = 0; i < add; i++) R.workers.push({ state: "starting", until: R.s + C.warm });
        if (R.firstAdd < 0) R.firstAdd = R.s;
        say(R, "Autoscaler: " + shown + ", over " + t + (C.signal === "cpu" ? "%" : "") + " for " + (C.period / 60) +
          (C.period === 60 ? " minute" : " minutes") + ". Adding " + plural(add, "worker", "workers") + " (" + R.workers.length +
          " in all); each takes " + C.warm + " s to start.", "warn");
      }
    }
    if (R.calm >= CALM && starting(R) === 0 && R.workers.length > C.min) {
      for (var k = R.workers.length - 1; k >= 0; k--) {
        if (R.workers[k].state === "idle") {
          R.workers.splice(k, 1);
          R.calm = CALM - STEP_IN;
          say(R, "Autoscaler: " + shown + ", under the threshold for 5 minutes. Removing a worker; " + R.workers.length + " left.", "");
          break;
        }
      }
    }
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

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
    var head = el("p", "margin:0;font-size:12px;");
    var strip = el("div", "display:flex;flex-wrap:wrap;gap:4px;font-size:11px;");
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 170", width: "100%", "class": "dg", role: "img",
      "aria-label": "Purchases waiting from 21:58 to 22:20, one point every 10 seconds, with dashed lines at the four boats: 22:05, 22:10, 22:15 and 22:20."
    });
    var g = mk(doc, "g", {}, svg);
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:11px;border-collapse:collapse;");
    var hr = el("tr");
    ["boat", "seats taken", "of"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;padding:2px 4px;", h)); });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    [head, strip, svg, wrap].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { doc: doc, el: el, head: head, strip: strip, g: g, tbody: tbody };
  }

  function drawStrip(S) {
    var ui = S.ui;
    var R = S.R;
    clear(ui.strip);
    var list = S.C.signal === "serverless" ? R.copies : R.workers;
    var cell = "border:1px solid currentColor;border-radius:3px;padding:1px 5px;";
    if (!list.length) ui.strip.appendChild(ui.el("span", "", S.C.signal === "serverless" ? "No copies started yet." : "No workers."));
    list.forEach(function (w, i) {
      var what = { idle: "idle", busy: "at the bank", bank: "at the bank", starting: "starting", cold: "cold start" }[w.state];
      ui.strip.appendChild(ui.el("span", cell + (w.state === "idle" ? "opacity:0.55;" : ""),
        (S.C.signal === "serverless" ? "copy " : "worker ") + (i + 1) + ": " + what));
    });
  }

  function drawChart(S) {
    var ui = S.ui;
    var doc = ui.doc;
    var g = ui.g;
    clear(g);
    var x0 = 50, x1 = 640, y0 = 140, y1 = 20;
    var top = 1500;
    function X(sec) { return x0 + (x1 - x0) * sec / END; }
    function Y(v) { return y0 - (y0 - y1) * v / top; }
    mk(doc, "path", { d: "M" + x0 + " " + y0 + "H" + x1 + "M" + x0 + " " + y0 + "V" + y1, "class": "dg-axis", fill: "none" }, g);
    [0, 750, 1500].forEach(function (v) {
      var t = mk(doc, "text", { x: x0 - 6, y: Y(v) + 4, "class": "dg-axis", "text-anchor": "end" }, g);
      t.textContent = fmt(v);
    });
    BOATS.forEach(function (b) {
      mk(doc, "path", { d: "M" + X(b).toFixed(1) + " " + y0 + "V" + y1, "class": "dg-axis", "stroke-dasharray": "3 3", fill: "none" }, g);
      var t = mk(doc, "text", { x: X(b).toFixed(1), y: y0 + 16, "class": "dg-axis", "text-anchor": "middle" }, g);
      t.textContent = clock(b).slice(0, 5);
    });
    var pts = S.R.series.map(function (v, i) { return X(i * 10).toFixed(1) + "," + Y(v).toFixed(1); });
    if (pts.length > 1) mk(doc, "polyline", { points: pts.join(" "), "class": "dg-note", fill: "none", stroke: "currentColor", "stroke-width": 2 }, g);
    var lbl = mk(doc, "text", { x: x0 + 6, y: y1 + 2, "class": "dg-note" }, g);
    lbl.textContent = "purchases waiting";
  }

  function drawBoats(S) {
    var ui = S.ui;
    clear(ui.tbody);
    BOATS.forEach(function (b, i) {
      var tr = ui.el("tr");
      [clock(b).slice(0, 5), S.R.boats[i] === undefined ? "-" : String(S.R.boats[i]), String(SEATS)].forEach(function (c) {
        tr.appendChild(ui.el("td", "padding:2px 4px;", c));
      });
      ui.tbody.appendChild(tr);
    });
  }

  function draw(api) {
    var S = api.state;
    var R = S.R;
    var C = S.C;
    var sv = C.signal === "serverless";
    S.ui.head.textContent = sv
      ? "Serverless: each purchase gets a copy; a new copy takes " + COLD + " s to start. Warm copies at 21:58: " + C.copies + ". The bank takes " + LINES + " calls at once."
      : "Rule: add workers when " + (C.signal === "cpu" ? "average CPU is over " + C.cpuT + "%" : "tickets waiting per worker are over " + C.queueT) +
        " for " + (C.period / 60) + (C.period === 60 ? " minute" : " minutes") + "; warm-up " + C.warm + " s; " + C.min + " to " + maxWorkers(C) +
        " workers. The bank takes " + LINES + " calls at once.";
    drawStrip(S);
    drawChart(S);
    drawBoats(S);
    S.stat.now(clock(R.s));
    S.stat.bought(fmt(R.bought));
    S.stat.issued(fmt(R.issued));
    S.stat.waiting(fmt(waiting(R)));
    S.stat.workers(sv ? R.copies.length : R.workers.length);
    S.stat.starting(sv ? 0 : starting(R));
    S.stat.cpu(sv ? "-" : R.cpu + "%");
    S.stat.per(sv ? "-" : perWorker(R));
    S.stat.boat(R.boats[0] === undefined ? "not yet" : R.boats[0] + " of " + SEATS);
    S.stat.refused(fmt(R.refused));
    S.stat.cold(R.cold);
    S.stat.paid(Math.round(R.workerSec / 60));
    var done = R.s >= END;
    S.ctl.fwd.disable(done);
    S.ctl.first.disable(R.s >= BOATS[0]);
    S.ctl.all.disable(done);
  }

  function flush(api) {
    var R = api.state.R;
    R.events.forEach(function (e) { api.log(e.msg, e.tone); });
    R.events = [];
  }

  function runTo(api, s) {
    var R = api.state.R;
    while (R.s < s && R.s < END) stepSecond(R);
    flush(api);
    draw(api);
  }

  function restartNight(api, why) {
    var S = api.state;
    S.R = newNight(S.C);
    var sv = S.C.signal === "serverless";
    api.log((why ? why + " " : "") + "21:58:00. Two minutes before the concert ends. " +
      (sv ? "Serverless, " + S.C.copies + " warm copies." : S.C.min + " workers; average CPU 2%; nobody buying yet."), "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e11", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { signal: "cpu", cpuT: 60, queueT: 10, period: 180, warm: 60, min: 2, copies: 0 };
      S.ui = buildWidget(api);
      S.ctl = {};
      function opt(key, list, name) {
        return function (v) { S.C[key] = isNaN(Number(v)) ? String(v) : Number(v); restartNight(api, name + ": " + pick(list, v).label + "."); };
      }
      S.ctl.signal = api.control.select("signal", "Scaling signal", SIGNALS, "cpu", opt("signal", SIGNALS, "Signal"));
      S.ctl.cpuT = api.control.select("cpuT", "CPU threshold", CPU_T, 60, opt("cpuT", CPU_T, "CPU threshold"));
      S.ctl.queueT = api.control.select("queueT", "Waiting-per-worker threshold", QUEUE_T, 10, opt("queueT", QUEUE_T, "Threshold"));
      S.ctl.period = api.control.select("period", "Must stay over it for", PERIODS, 180, opt("period", PERIODS, "Period"));
      S.ctl.warm = api.control.select("warm", "Warm-up of a new worker", WARMS, 60, opt("warm", WARMS, "Warm-up"));
      S.ctl.min = api.control.select("min", "Minimum workers", MINS, 2, opt("min", MINS, "Minimum workers"));
      S.ctl.copies = api.control.select("copies", "Serverless warm copies", COPIES, 0, opt("copies", COPIES, "Warm copies"));
      S.ctl.fwd = api.control.button("fwd", "Forward 10 s", function () { runTo(api, S.R.s + 10); });
      S.ctl.first = api.control.button("first", "Run to 22:05 (first boat)", function () { runTo(api, BOATS[0]); });
      S.ctl.all = api.control.button("all", "Run to 22:20", function () { runTo(api, END); });
      S.ctl.again = api.control.button("again", "Start the night again", function () { restartNight(api, "Night replayed."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        now: api.stat("now", "now", ""),
        bought: api.stat("bought", "purchases made", ""),
        issued: api.stat("issued", "tickets issued", "ok"),
        waiting: api.stat("waiting", "purchases waiting (payment processing)", "warn"),
        workers: api.stat("workers", "workers (serverless: copies)", ""),
        starting: api.stat("starting", "workers still starting", ""),
        cpu: api.stat("cpu", "average CPU", ""),
        per: api.stat("per", "tickets waiting per worker", "warn"),
        boat: api.stat("boat", "22:05 boat, seats taken", "bad"),
        refused: api.stat("refused", "purchases refused by the bank", "bad"),
        cold: api.stat("cold", "cold starts", ""),
        paid: api.stat("paid", "worker-minutes paid tonight", "")
      };
      api.info("<strong>How to read it.</strong> Each step is one second. Purchases arrive at 5 a second from 22:00:00 to 22:04:59. A worker takes one purchase, waits 2 s for the bank, then the ticket is issued; the bank takes 8 calls at once. The strip shows each worker (or serverless copy). The chart shows purchases waiting, and the table shows how many seats each boat leaves with.");
      restartNight(api, "");
    },

    selfTest: async function (t) {
      // 1. Opens at 21:58:00, before the crowd: 2 workers, CPU 2%, nothing bought.
      t.expect(t.stat("now") === "21:58:00" && t.stat("bought") === 0 && t.stat("waiting") === 0 && t.stat("workers") === 2 &&
        t.stat("cpu") === "2%" && t.stat("boat") === "not yet" && t.logText().indexOf("21:58:00. Two minutes before the concert ends. 2 workers") >= 0,
        "Opens at 21:58:00: 2 workers, CPU 2%, nobody buying yet");

      // 2. The record: 22:05, 300 issued, 1,200 waiting, CPU 15%, no worker added, 300 of 400 seats.
      t.click("first");
      t.expect(t.stat("now") === "22:05:00" && t.stat("issued") === 300 && t.stat("waiting") === "1,200" && t.stat("bought") === "1,500" &&
        t.stat("cpu") === "15%" && t.stat("workers") === 2 && t.stat("boat") === "300 of 400" &&
        t.logText().indexOf("22:05:00 Boat leaves: 300 of 400 seats taken; 1,200 purchases waiting; average CPU 15%.") >= 0,
        "As now: at 22:05, 300 issued, 1,200 waiting, CPU 15%, still 2 workers; the boat leaves 300 of 400");

      // 3. To 22:20: 1,200 issued, 300 still waiting, 44 worker-minutes.
      t.click("all");
      t.expect(t.stat("issued") === "1,200" && t.stat("waiting") === 300 && t.stat("paid") === 44 && t.stat("workers") === 2,
        "As now, 22:20: 1,200 issued, 300 still waiting, 44 worker-minutes");

      // 4. Option 0: CPU threshold 20%. 15% never passes it.
      t.set("cpuT", 20);
      t.click("first");
      t.expect(t.stat("issued") === 300 && t.stat("waiting") === "1,200" && t.stat("boat") === "300 of 400" && t.api.state.R.firstAdd === -1,
        "CPU threshold 20%: CPU stays at 15%, no worker added, 300 of 400 again");

      // 5. A CPU threshold under 15% does trip, but adds one worker after 3 minutes.
      t.set("cpuT", 10);
      t.click("first");
      t.expect(t.api.state.R.firstAdd === 299 && t.logText().indexOf("22:02:59 Autoscaler: average CPU 15%, over 10% for 3 minutes. Adding 1 worker (3 in all)") >= 0,
        "CPU threshold 10%: trips at 22:02:59 and adds 1 worker");

      // 6. Option 2: tickets waiting per worker over 10 for 3 minutes.
      t.set("cpuT", 60);
      t.set("signal", "queue");
      t.click("first");
      t.expect(t.api.state.R.firstAdd === 303 && t.stat("issued") === 468 && t.stat("waiting") === "1,032" && t.stat("boat") === "400 of 400" &&
        t.stat("workers") === 8 && t.logText().indexOf("22:03:03 Autoscaler: tickets waiting per worker 369, over 10 for 3 minutes. Adding 6 workers (8 in all)") >= 0,
        "Waiting per worker over 10: 6 workers added at 22:03:03, 468 issued by 22:05, the boat leaves full");

      // 7. ... and it scales back in after the crowd.
      t.click("all");
      var R = t.api.state.R;
      t.expect(R.allIssued === 678 && t.stat("waiting") === 0 && t.stat("workers") === 2 && t.stat("issued") === "1,500" &&
        t.logText().indexOf("22:18:57 Autoscaler: tickets waiting per worker 0, under the threshold for 5 minutes. Removing a worker; 2 left.") >= 0,
        "Every ticket issued by 22:09:18, then scaled back in to 2 workers by 22:18:57");

      // 8. Option 1: always 8 workers, the bank's limit. 4 a second from the start; 176 worker-minutes.
      t.set("signal", "cpu");
      t.set("min", 8);
      t.click("all");
      R = t.api.state.R;
      t.expect(R.boats[0] === 400 && R.allIssued === 496 && t.stat("paid") === 176 && t.stat("workers") === 8,
        "Eight workers always: boat full, all issued by 22:06:16, 176 worker-minutes (2 workers: 44)");

      // 9. Option 3: serverless as-is. Cold starts, and the bank refuses what passes its limit.
      t.set("min", 2);
      t.set("signal", "serverless");
      t.click("all");
      var cold = t.stat("cold");
      var refused = t.stat("refused");
      t.expect(cold === 10 && refused === 303 && t.stat("boat") === "400 of 400" &&
        t.logText().indexOf("22:20:00 Boat leaves: 0 of 400 seats taken; 0 purchases waiting, 303 refused by the bank.") >= 0,
        "Serverless as-is: 10 cold starts, 303 purchases refused by the bank");

      // 10. Warm copies remove the cold starts, not the bank's limit.
      t.set("copies", 10);
      t.click("all");
      t.expect(t.stat("cold") === 0 && t.stat("refused") === 300,
        "Serverless with 10 warm copies: 0 cold starts, still 300 refused");
    }
  });
})();
