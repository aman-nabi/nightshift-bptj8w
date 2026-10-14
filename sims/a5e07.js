/* sims/a5e07-v1.0.0.js  (published as sims/a5e07.js)
   Case a5e07 "Evaluating Agents": an agent scorecard for Kestrelway's rebooking agent. No real model
   runs here: the outcome of each of the 20 tasks in the maze trial, in each of 8 runs, is stated
   below, the way Fionnuala recorded it. Run 1 is the launch run (its booking records were kept on
   the test copy); runs 2 to 8 are tonight's reruns. Widget-style sim: it draws its own tables inside
   api.root.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: 20 tasks x 8 stated runs (as run), and 20 x 8 stated runs at
     temperature zero. Controls: runs per task k (1 to 8), the grader (last message, booking record),
     the headline metric (pass^1, pass^k, pass@k), temperature (as run, zero), the task to inspect,
     a plan (the launch scorecard or one of the four replies), reset. Stats: grader, temperature, k,
     headline, pass^1, pass^k, pass@k, runs right, cost of all runs, cost per task (one try), cost
     per success. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - Each run of a task ends in one of four outcomes, stated per run:
     R  right booking: the record holds the right flight, fee 0. Last message "You're rebooked ...".
     W  wrong booking: the record holds the later flight and a £75 change fee. Message "You're rebooked ...".
     S  said rebooked, nothing changed: the rebook tool returned an error; the record is unchanged,
        and the message still says "You're rebooked ...".
     N  no seats: it searched today's date, found nothing, and said no seats; the record is unchanged.
   - The last-message grader marks a run right when the last message confirms a booking (R, W, S).
     The booking-record grader marks a run right only when the record ends as it should (R).
   - With k runs per task, runs 1 to k are used. pass^1: share of the 20 tasks right in run 1.
     pass^k: share of tasks right in all of runs 1 to k. pass@k: share right in at least one of
     runs 1 to k. Runs right: right runs over 20 x k.
   - Steps per run: R 5, W 5, S 5, N 7. Each step sends about 8,000 tokens and gets 400 back. At
     $3 per million tokens in and $15 per million out, a step costs 8,000 x 3 / 1,000,000 +
     400 x 15 / 1,000,000 = $0.024 + $0.006 = $0.03. Cost per task (one try) = total / (20 x k).
     Cost per success = total / runs right under the chosen grader. Shown to a tenth of a cent.
   - Temperature zero is stated data: a second 160 runs, as Part 2 of the temperature reply
     records them. It is not a promise of what zero does on every model.

   Where every number comes from (conventions rule 14; the case is content/latent/a5/a5e07-v1.0.0.json).
   All of them follow from the outcome strings below and the rules above; the selfTest checks them.
   - Launch run (run 1), last message: 17 of 20 (85%); N in T05, T12, T15. Booking record: 15 of 20
     (75%); W in T09, S in T14. Cost $3.18 (106 steps), $0.159 a task.
   - As run, booking record, k = 8: 130 of 160 runs right (81%); pass^8 7 of 20 (35%: T01, T02,
     T03, T06, T10, T13, T16); pass@8 19 of 20 (T15 never right). k = 3: pass^3 11 of 20 (55%),
     pass@3 19 of 20 (95%). Outcomes: R 130, W 9, S 5, N 16. Steps 832, tokens 6,988,800,
     cost $24.96, $0.156 a task, $0.192 a success.
   - As run, last message, k = 8: 144 of 160 (90%), pass^8 13 of 20 (65%); 14 runs (9 W + 5 S)
     graded right with a wrong record or none. Cost per success $0.173.
   - T07, Dublin to Lyon (06:10 right, 09:40 later): runs R N W R R S R W. The 06:10 in runs 1,
     4, 5, 7; the 09:40 with the fee in runs 3 and 8; no seats in run 2; run 6 "You're rebooked"
     with nothing changed. Last message passes 7 of 8; booking record 4 of 8.
   - Temperature zero, booking record, k = 8: 136 of 160 (85%), pass^8 13 of 20 (65%), pass@3 18
     of 20 (90%); T09 and T15 wrong in all 8 (the later flight and the fee every time); T07
     R R N R R S R R still has no seats (run 3) and the ignored error (run 6). Run 1: 17 of 20.
   - Production tonight (in the post, not the data): Mrs Henshilwood's three tries got the N
     message (22:41), the W message (22:58) and the R message (23:20) for T07's flights.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  // [id, connecting at, destination, right flight, later flight, 8 runs as run, 8 runs at temperature zero]
  var TASKS = [
    ["T01", "Manchester", "Toulouse", "07:05", "12:15", "RRRRRRRR", "RRRRRRRR"],
    ["T02", "Aberdeen", "Amsterdam", "06:40", "10:20", "RRRRRRRR", "RRRRRRRR"],
    ["T03", "Birmingham", "Seville", "08:30", "14:05", "RRRRRRRR", "RRRRRRRR"],
    ["T04", "Cardiff", "Rome", "07:50", "13:10", "RRWRRRRR", "RRRRRRRR"],
    ["T05", "Manchester", "Berlin", "06:55", "11:45", "NRRRNRRR", "RRRRNRRR"],
    ["T06", "Glasgow", "Valencia", "09:15", "15:40", "RRRRRRRR", "RRRRRRRR"],
    ["T07", "Dublin", "Lyon", "06:10", "09:40", "RNWRRSRW", "RRNRRSRR"],
    ["T08", "Aberdeen", "Brussels", "07:20", "12:50", "RRRRRSRR", "RRRRRRRR"],
    ["T09", "Birmingham", "Milan", "08:05", "13:35", "WRRWRRRR", "WWWWWWWW"],
    ["T10", "Belfast", "Prague", "10:10", "16:25", "RRRRRRRR", "RRRRRRRR"],
    ["T11", "Manchester", "Vienna", "07:35", "12:05", "RRNRRRRR", "RRRRRRRR"],
    ["T12", "Cardiff", "Marseille", "06:25", "11:15", "NNRNRRNR", "NRRRNRRN"],
    ["T13", "Glasgow", "Zurich", "08:45", "14:30", "RRRRRRRR", "RRRRRRRR"],
    ["T14", "Aberdeen", "Barcelona", "07:00", "10:55", "SRRRSRRR", "RRRRSRRR"],
    ["T15", "Birmingham", "Faro", "07:25 via Amsterdam", "18:30", "NWNNWNNN", "WWWWWWWW"],
    ["T16", "Belfast", "Copenhagen", "09:50", "15:20", "RRRRRRRR", "RRRRRRRR"],
    ["T17", "Newcastle", "Munich", "06:35", "12:40", "RRRWRRRR", "RRRRRRRR"],
    ["T18", "Manchester", "Geneva", "08:15", "13:55", "RWRRRNRR", "RRRRRRRR"],
    ["T19", "Glasgow", "Hamburg", "07:45", "12:30", "RRRRRRSR", "RRRRRRSR"],
    ["T20", "Newcastle", "Warsaw", "09:05", "16:10", "RRRRNRRR", "RRRRRRRR"]
  ];
  var RUNS = 8;
  var STEPS = { R: 5, W: 5, S: 5, N: 7 };
  var TOK_IN = 8000;
  var TOK_OUT = 400;
  var PRICE_IN = 3;   // dollars per million tokens in
  var PRICE_OUT = 15; // dollars per million tokens out
  var FEE = "£75";
  var OUTCOME = {
    R: "right booking",
    W: "wrong booking: later flight, fee charged",
    S: "said rebooked, nothing changed",
    N: "no seats"
  };
  var GRADERS = [
    { value: "msg", label: "The last message (as at launch)" },
    { value: "end", label: "The booking record (end state)" }
  ];
  var METRICS = [
    { value: "p1", label: "pass^1: run 1 only" },
    { value: "pk", label: "pass^k: all k runs right" },
    { value: "pak", label: "pass@k: any of k runs right" }
  ];
  var TEMPS = [
    { value: "run", label: "As run (the default setting)" },
    { value: "zero", label: "Zero (stated runs)" }
  ];
  var PLANS = [
    { value: "none", label: "None: set the controls yourself" },
    { value: "launch", label: "The launch scorecard" },
    { value: "r0", label: "Reply: report pass@3" },
    { value: "r1", label: "Reply: grade the last message" },
    { value: "r2", label: "Reply: temperature zero" },
    { value: "r3", label: "Reply: eight runs, all eight right" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pc(a, n) { return Math.round(a * 100 / n) + "% (" + a + " of " + n + ")"; }
  // Money in tenths of a cent, so sums stay exact.
  function stepMills() { return Math.round((TOK_IN * PRICE_IN + TOK_OUT * PRICE_OUT) / 1000); } // 30 = $0.030
  function dollars(mills, places) { return "$" + (mills / 1000).toFixed(places); }
  function task(id) { for (var i = 0; i < TASKS.length; i++) if (TASKS[i][0] === id) return TASKS[i]; return null; }
  function runsOf(t, temp) { return t[temp === "zero" ? 6 : 5]; }
  function graded(code, grader) { return grader === "msg" ? code !== "N" : code === "R"; }

  function message(t, code) {
    if (code === "N") return "I'm sorry, no seats are available on any flight to " + t[2] + ".";
    if (code === "W") return "You're rebooked on the " + t[4] + " to " + t[2] + " tomorrow. A " + FEE + " change fee applies.";
    return "You're rebooked on the " + t[3] + " to " + t[2] + " tomorrow, with no fee.";
  }
  function record(t, code) {
    if (code === "R") return t[3] + ", fee £0";
    if (code === "W") return t[4] + ", " + FEE + " charged";
    return "unchanged: still the missed connection";
  }
  function traceSays(code) {
    if (code === "R") return "read the missed-connection rule, searched tomorrow, rebook done";
    if (code === "W") return "read the change-fee rule instead, booked the later flight";
    if (code === "S") return "rebook returned an error; the reply ignored it";
    return "searched today's date four times";
  }
  // The trajectory: [step, action, result] lines for one outcome.
  function trajectory(t, code) {
    var route = t[1] + " to " + t[2];
    var L = [["1", "find_booking(passenger)", "missed " + route + "; cause: our late flight in"]];
    if (code === "W") L.push(["2", "read_rules(\"change fee\")", "a change costs " + FEE]);
    else L.push(["2", "read_rules(\"missed connection\")", "our delay: next flight with a seat, change fee waived"]);
    if (code === "N") {
      L.push(["3", "search_flights(" + route + ", today)", "no flights left today"]);
      L.push(["4", "search_flights(" + route + ", today, any time)", "no flights left today"]);
      L.push(["5", "search_flights(" + route + ", today, nearby airports)", "no flights left today"]);
      L.push(["6", "search_flights(" + route + ", today)", "no flights left today"]);
      L.push(["7", "reply", message(t, code)]);
      return L;
    }
    L.push(["3", "search_flights(" + route + ", tomorrow)", t[3] + ": seats free; " + t[4] + ": seats free"]);
    if (code === "R") L.push(["4", "rebook(" + t[3] + ", fee waived)", "done: booking moved to " + t[3] + ", fee £0"]);
    if (code === "W") L.push(["4", "rebook(" + t[4] + ", fee " + FEE + ")", "done: booking moved to " + t[4] + ", " + FEE + " charged"]);
    if (code === "S") L.push(["4", "rebook(" + t[3] + ", fee waived)", "error: seat no longer held, nothing changed"]);
    L.push(["5", "reply", message(t, code)]);
    return L;
  }

  /* ---------- the model (a pure function the display and self-tests read) ---------- */

  function score(C) {
    var k = C.k;
    var R = { p1: 0, all: 0, any: 0, right: 0, n: TASKS.length * k, steps: 0, perTask: [] };
    TASKS.forEach(function (t) {
      var s = runsOf(t, C.temp).slice(0, k);
      var ok = 0;
      for (var i = 0; i < s.length; i++) {
        R.steps += STEPS[s.charAt(i)];
        if (graded(s.charAt(i), C.grader)) ok += 1;
      }
      if (graded(s.charAt(0), C.grader)) R.p1 += 1;
      if (ok === k) R.all += 1;
      if (ok > 0) R.any += 1;
      R.right += ok;
      R.perTask.push(ok);
    });
    R.mills = R.steps * stepMills();
    R.tokens = R.steps * (TOK_IN + TOK_OUT);
    R.total = dollars(R.mills, 2);
    R.perTry = dollars(Math.round(R.mills / R.n), 3);
    R.perSuccess = R.right ? dollars(Math.round(R.mills / R.right), 3) : "none right";
    R.p1s = pc(R.p1, TASKS.length);
    R.alls = pc(R.all, TASKS.length);
    R.anys = pc(R.any, TASKS.length);
    R.rights = pc(R.right, R.n);
    R.head = C.metric === "p1" ? R.p1s : (C.metric === "pk" ? R.alls : R.anys);
    return R;
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text, parent) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      if (parent) parent.appendChild(e);
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;", "", api.root);
    var head = el("p", "margin:0;", "", box);
    var big = el("p", "margin:0;font-weight:600;", "", box);
    var key = el("p", "margin:0;", "Each cell is one run. R right booking; W wrong booking (later flight, fee charged); S said rebooked, nothing changed; N no seats. Runs past k are greyed and not counted.", box);
    var w1 = el("div", "overflow-x:auto;", "", box);
    var grid = el("table", "width:100%;border-collapse:collapse;", "", w1);
    var ihead = el("p", "margin:0;font-weight:600;", "", box);
    var w2 = el("div", "overflow-x:auto;", "", box);
    var runs = el("table", "width:100%;border-collapse:collapse;", "", w2);
    var w3 = el("div", "overflow-x:auto;", "", box);
    var trace = el("table", "width:100%;border-collapse:collapse;", "", w3);
    return { el: el, head: head, big: big, key: key, grid: grid, ihead: ihead, runs: runs, trace: trace };
  }

  function row(ui, table, cells, th, dims) {
    var tr = ui.el("tr", "", "", table);
    cells.forEach(function (c, i) {
      var st = "text-align:left;padding:2px 4px;" + (dims && dims[i] ? "opacity:0.35;" : "");
      ui.el(th ? "th" : "td", st, String(c), tr);
    });
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var R = score(C);
    S.R = R;
    var g = pick(GRADERS, C.grader);
    ui.head.textContent = "Grader: " + g.label + ". Runs per task k: " + C.k + ". Temperature: " + pick(TEMPS, C.temp).label + ".";
    ui.big.textContent = "Headline, " + pick(METRICS, C.metric).label + ": " + R.head + ". Cost per task " + R.perTry + ", per success " + R.perSuccess + ".";

    clear(ui.grid);
    var hd = ["task", "request"];
    for (var r = 1; r <= RUNS; r++) hd.push("run " + r);
    hd.push("right of " + C.k);
    row(ui, ui.grid, hd, true);
    TASKS.forEach(function (t, i) {
      var s = runsOf(t, C.temp);
      var cells = [t[0], t[1] + " to " + t[2]];
      var dims = [false, false];
      for (var j = 0; j < RUNS; j++) { cells.push(s.charAt(j)); dims.push(j >= C.k); }
      cells.push(R.perTask[i]);
      dims.push(false);
      row(ui, ui.grid, cells, false, dims);
    });

    var t = task(C.task);
    var s = runsOf(t, C.temp);
    ui.ihead.textContent = "Inspecting " + t[0] + ", missed connection in " + t[1] + " to " + t[2] + ". Right exit: the " + t[3] + ", no fee.";
    clear(ui.runs);
    row(ui, ui.runs, ["run", "outcome", "steps", "tokens", "cost", "last message", "booking record after", "graded", "the trajectory shows"], true);
    S.inspect = [];
    for (var q = 0; q < RUNS; q++) {
      var c = s.charAt(q);
      var item = {
        run: q + 1, code: c, steps: STEPS[c], tokens: STEPS[c] * (TOK_IN + TOK_OUT), cost: dollars(STEPS[c] * stepMills(), 2),
        msg: message(t, c), rec: record(t, c), ok: graded(c, C.grader), why: traceSays(c)
      };
      S.inspect.push(item);
      row(ui, ui.runs, [item.run, OUTCOME[c], item.steps, fmt(item.tokens), item.cost, item.msg, item.rec,
        q >= C.k ? "not counted" : (item.ok ? "right" : "wrong"), item.why], false,
        [q >= C.k, q >= C.k, q >= C.k, q >= C.k, q >= C.k, q >= C.k, q >= C.k, q >= C.k, q >= C.k]);
    }
    clear(ui.trace);
    row(ui, ui.trace, ["first run", "step", "action", "result"], true);
    var seen = {};
    for (var p = 0; p < RUNS; p++) {
      var cc = s.charAt(p);
      if (seen[cc]) continue;
      seen[cc] = true;
      trajectory(t, cc).forEach(function (ln) { row(ui, ui.trace, ["run " + (p + 1) + " (" + cc + ")", ln[0], ln[1], ln[2]]); });
    }

    S.stat.grader(C.grader === "msg" ? "last message" : "booking record");
    S.stat.temp(C.temp === "zero" ? "zero" : "as run");
    S.stat.k(C.k);
    S.stat.head(R.head);
    S.stat.p1(R.p1s);
    S.stat.pk(R.alls);
    S.stat.pak(R.anys);
    S.stat.runs(R.rights);
    S.stat.total(R.total);
    S.stat.perTry(R.perTry);
    S.stat.perSuccess(R.perSuccess);
  }

  function report(api, what) {
    draw(api);
    var R = api.state.R;
    var C = api.state.C;
    api.log(what + " k " + C.k + ", graded by " + (C.grader === "msg" ? "the last message" : "the booking record") +
      ": pass^1 " + R.p1s + ", pass^" + C.k + " " + R.alls + ", pass@" + C.k + " " + R.anys + ", runs right " + R.rights +
      ". " + R.steps + " steps, " + fmt(R.tokens) + " tokens, " + R.total + ".",
      C.grader === "msg" ? "warn" : (R.all === TASKS.length ? "ok" : ""));
  }

  function outcome(plan, R, C) {
    if (plan === "launch") return "The launch scorecard: one run, the last-message grader, 17 of 20 expected.";
    if (plan === "r0") return "Report pass@3: " + R.anys + ". The same runs, all three right: " + R.alls +
      ". A passenger gets one try: the launch run, checked against the record, " + R.p1s + ".";
    if (plan === "r1") return "Grade the last message over eight runs: " + R.rights + " runs right. T07 run 6, \"You're rebooked\" with nothing changed, is graded right.";
    if (plan === "r2") return "Temperature zero, eight runs, checked against the record: pass^8 " + R.alls +
      ". T09 and T15 are wrong in all eight; T07 still says no seats in run 3 and ignores an error in run 6.";
    return "Eight runs against the booking record: pass^8 " + R.alls + ", runs right " + R.rights + ", " + R.perSuccess + " per success.";
  }

  function applyPlan(api, plan) {
    var S = api.state;
    var P = {
      launch: { k: 1, grader: "msg", metric: "p1", temp: "run" },
      r0: { k: 3, grader: "end", metric: "pak", temp: "run" },
      r1: { k: 8, grader: "msg", metric: "p1", temp: "run" },
      r2: { k: 8, grader: "end", metric: "pk", temp: "zero" },
      r3: { k: 8, grader: "end", metric: "pk", temp: "run" }
    }[plan];
    S.C.k = P.k;
    S.C.grader = P.grader;
    S.C.metric = P.metric;
    S.C.temp = P.temp;
    S.C.task = "T07";
    S.ctl.k.set(P.k);
    S.ctl.grader.set(P.grader);
    S.ctl.metric.set(P.metric);
    S.ctl.temp.set(P.temp);
    S.ctl.task.set("T07");
    draw(api);
    report(api, "Plan: " + pick(PLANS, plan).label + ". " + outcome(plan, S.R, S.C));
  }

  /* ---------- the module ---------- */

  DL.sims.define("a5e07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { k: 1, grader: "msg", metric: "p1", temp: "run", task: "T07" };
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.k = api.control.range("k", "Runs per task (k)", 1, RUNS, 1, 1, function (v) {
        var x = Math.max(1, Math.min(RUNS, Math.round(Number(v))));
        if (!isFinite(x) || x === S.C.k) return;
        S.C.k = x;
        report(api, "Runs per task: " + x + ".");
      });
      S.ctl.grader = api.control.select("grader", "Grader", GRADERS, "msg", function (v) {
        var o = pick(GRADERS, v);
        if (!o || o.value === S.C.grader) return;
        S.C.grader = String(o.value);
        report(api, "Grader: " + o.label + ".");
      });
      S.ctl.metric = api.control.select("metric", "Headline metric", METRICS, "p1", function (v) {
        var o = pick(METRICS, v);
        if (!o || o.value === S.C.metric) return;
        S.C.metric = String(o.value);
        report(api, "Headline: " + o.label + ".");
      });
      S.ctl.temp = api.control.select("temp", "Temperature", TEMPS, "run", function (v) {
        var o = pick(TEMPS, v);
        if (!o || o.value === S.C.temp) return;
        S.C.temp = String(o.value);
        report(api, "Temperature: " + o.label + ".");
      });
      S.ctl.task = api.control.select("task", "Task to inspect", TASKS.map(function (t) {
        return { value: t[0], label: t[0] + " " + t[1] + " to " + t[2] };
      }), "T07", function (v) {
        var t = task(String(v));
        if (!t || t[0] === S.C.task) return;
        S.C.task = t[0];
        draw(api);
        var s = runsOf(t, S.C.temp);
        api.log("Inspecting " + t[0] + ", " + t[1] + " to " + t[2] + ": runs " + s.split("").join(" ") + ".", "");
      });
      S.ctl.plan = api.control.select("plan", "Play a plan", PLANS, "none", function (v) {
        var o = pick(PLANS, v);
        if (!o || o.value === "none") return;
        applyPlan(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        grader: api.stat("grader", "grader", ""),
        temp: api.stat("temp", "temperature", ""),
        k: api.stat("k", "runs per task (k)", ""),
        head: api.stat("head", "headline number", "warn"),
        p1: api.stat("p1", "pass^1, run 1 only", ""),
        pk: api.stat("pk", "pass^k, all k runs right", "bad"),
        pak: api.stat("pak", "pass@k, any of k runs right", ""),
        runs: api.stat("runs", "runs right, of all counted", ""),
        total: api.stat("total", "cost of all counted runs", ""),
        perTry: api.stat("perTry", "cost per task, one try", ""),
        perSuccess: api.stat("perSuccess", "cost per success", "")
      };

      api.info("<strong>How to read it.</strong> The maze trial is 20 stranded passengers, each with one right exit: the right flight, no fee. Each was run 8 times; run 1 is the launch run. The top table shows every run's outcome. The grader decides which outcomes count as right: the last message counts any \"You're rebooked\", the booking record counts only the right booking. Below, one task's 8 runs, what each cost, and the steps of its trajectory.");

      draw(api);
      api.log("The launch run, as graded three weeks ago: one run, the last message read for a confirmed booking. 17 of 20, 85%. Nobody looked at the booking records.", "");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function since() { return t.logText().slice(mark); }
      function has(s) { return since().indexOf(s) >= 0; }

      // 1. The opening state: the launch scorecard, before tonight.
      t.expect(t.stat("grader") === "last message" && t.stat("k") === 1 && t.stat("head") === "85% (17 of 20)" &&
        t.stat("p1") === "85% (17 of 20)" && t.stat("total") === "$3.18" && t.stat("temp") === "as run" &&
        t.logText().indexOf("17 of 20, 85%. Nobody looked at the booking records.") >= 0,
        "Opens on the launch scorecard: one run, last-message grader, 85% (17 of 20)");

      // 2. The stated data: 20 tasks, 8 runs each, a step at $0.03.
      var shape = TASKS.every(function (x) { return x[5].length === 8 && x[6].length === 8 && /^[RWSN]+$/.test(x[5] + x[6]); });
      t.expect(TASKS.length === 20 && shape && stepMills() === 30 && STEPS.N === 7 && STEPS.R === 5,
        "20 tasks of 8 stated runs; a step is 8,000 tokens in and 400 out, $0.03");

      // 3. The launch run checked against the booking record.
      begin();
      t.set("grader", "end");
      t.expect(t.stat("p1") === "75% (15 of 20)" && t.stat("runs") === "75% (15 of 20)" && t.stat("perSuccess") === "$0.212" &&
        has("graded by the booking record: pass^1 75% (15 of 20)"),
        "Launch run against the booking record: 15 of 20, 75%");

      // 4. Eight runs, booking record: pass^8, pass@8 and the cost.
      t.set("k", 8);
      t.expect(t.stat("pk") === "35% (7 of 20)" && t.stat("pak") === "95% (19 of 20)" && t.stat("runs") === "81% (130 of 160)" &&
        t.stat("total") === "$24.96" && t.stat("perTry") === "$0.156" && t.stat("perSuccess") === "$0.192" && t.api.state.R.tokens === 6988800,
        "k 8, booking record: pass^8 7 of 20, 130 of 160 runs right, $24.96, $0.156 a task, $0.192 a success");

      // 5. Three runs: pass@3 flatters, pass^3 doesn't.
      t.set("k", 3);
      t.expect(t.stat("pak") === "95% (19 of 20)" && t.stat("pk") === "55% (11 of 20)",
        "k 3: pass@3 19 of 20 (95%), pass^3 11 of 20 (55%)");

      // 6. The Dublin task, T07: three answers, and one more.
      t.set("k", 8);
      var I = t.api.state.inspect;
      var codes = I.map(function (x) { return x.code; }).join("");
      t.expect(codes === "RNWRRSRW" && I[0].msg === "You're rebooked on the 06:10 to Lyon tomorrow, with no fee." &&
        I[1].msg === "I'm sorry, no seats are available on any flight to Lyon." &&
        I[2].msg === "You're rebooked on the 09:40 to Lyon tomorrow. A £75 change fee applies." && I[2].rec === "09:40, £75 charged" &&
        I[5].msg.indexOf("You're rebooked") === 0 && I[5].rec === "unchanged: still the missed connection" && !I[5].ok &&
        I[1].steps === 7 && I[1].cost === "$0.21",
        "T07: 06:10 in runs 1, 4, 5, 7; no seats in run 2; 09:40 with £75 in runs 3 and 8; run 6 says rebooked, record unchanged");

      // 7. The same eight runs, graded by the last message.
      t.set("grader", "msg");
      t.expect(t.stat("runs") === "90% (144 of 160)" && t.stat("pk") === "65% (13 of 20)" && t.api.state.inspect[5].ok === true &&
        t.api.state.inspect.filter(function (x) { return x.ok; }).length === 7,
        "Last message, k 8: 144 of 160 graded right, T07 run 6 among them (7 of T07's 8)");

      // 8. Temperature zero: less variation, two tasks consistently wrong, T07 still varies.
      t.set("grader", "end");
      t.set("temp", "zero");
      var z = t.api.state.R.perTask;
      t.expect(t.stat("pk") === "65% (13 of 20)" && t.stat("runs") === "85% (136 of 160)" && z[8] === 0 && z[14] === 0 &&
        t.api.state.inspect.map(function (x) { return x.code; }).join("") === "RRNRRSRR",
        "Temperature zero: pass^8 13 of 20; T09 and T15 wrong all 8 times; T07 still has N and S");
      t.set("k", 3);
      var z3 = t.stat("pak") === "90% (18 of 20)";
      t.set("temp", "run");

      // 9. The trajectory names the cause.
      var tr = trajectory(task("T07"), "W");
      var tn = trajectory(task("T07"), "N");
      t.expect(z3 && tr[1][1] === "read_rules(\"change fee\")" && tn[2][1] === "search_flights(Dublin to Lyon, today)" && tn.length === 7,
        "Trajectories: the wrong booking read the change-fee rule; no seats searched today's date (pass@3 at zero: 18 of 20)");

      // 10. Each reply's outcome.
      begin();
      t.set("plan", "r0");
      var a = has("Report pass@3: 95% (19 of 20). The same runs, all three right: 55% (11 of 20).") && has("75% (15 of 20)");
      t.set("plan", "r1");
      var b = has("144 of 160") && has("T07 run 6");
      t.set("plan", "r2");
      var c = has("pass^8 65% (13 of 20). T09 and T15 are wrong in all eight");
      t.set("plan", "r3");
      t.expect(a && b && c && has("pass^8 35% (7 of 20), runs right 81% (130 of 160), $0.192 per success") && t.stat("head") === "35% (7 of 20)",
        "Replies: pass@3 95% hides 55%; last message 144 of 160; zero 65% with two always wrong; pass^8 35%");

      // 11. The launch plan replays the opening.
      begin();
      t.set("plan", "launch");
      t.expect(t.stat("head") === "85% (17 of 20)" && t.stat("grader") === "last message" && t.stat("k") === 1 && has("17 of 20 expected"),
        "The launch scorecard replays 85% (17 of 20)");
    }
  });
})();
