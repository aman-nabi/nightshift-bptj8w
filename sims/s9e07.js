/* sims/s9e07-v1.0.0.js  (published as sims/s9e07.js)
   Case s9e07 "The River and the Lake": a depot data lab for the Burnhollow Buses night depot.
   When a bus docks, its ticket machine sends the day's tickets as one file into the lake (raw
   files kept as they came) and the bus checks in. A nightly job loads the files into the
   warehouse (tidy tables) and counts each route's rows into the morning report for the
   council's claim, paid per passenger (one ticket is one passenger). Since Thursday 24 September
   the job adds rows instead of replacing the night's rows, and tonight the runbook's re-run at
   02:40 loaded the 38 early buses twice: route 4's 952 became 1,904.
   The learner sets the start rule, the load mode, the clerk's runbook re-run, live fares and the
   late buses, then steps the night from 01:00 to 05:00 in 10-minute steps (or plays it) and
   reads the files in the lake, warehouse rows per route, the report against the slips, buses
   missing and fares counted twice.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls start rule (clock 02:00, clock 04:00, all 45
     checked in, all 45 or a 04:00 cut-off with a late-file rule), load mode (add rows, replace
     the night's slice), the clerk's re-run, live fares, late buses (tonight, bus 43 held until
     04:20, bus 43's machine never checks in); step 10 minutes, play to 05:00, reset. Stats:
     time, files in the lake, warehouse rows, route 4 on the report, report total, slips total,
     buses missing, fares short, fares counted twice, job runs, outcome. selfTest: 10 assertions.
     The brief's window was 01:00 to 03:30; it runs to 05:00 so the 04:00 rules, a bus held
     until 04:20 and the re-run 20 minutes after it can be played.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e07-v1.0.0.json).
   All of it is given data stated in sim.lede, and each result is checked by the selfTest.
   - 45 buses, fleet numbers 1 to 45. One ticket is one passenger (the story's rule).
   - Route 4's only bus is 17: 952 tickets, docked at 23:40 (before the window opens).
   - The other 37 early buses: 30,404 tickets (27 of them 822 each, 10 of them 821 each:
     22,194 + 8,210). With bus 17: 38 buses in by 00:50, 31,356 tickets.
   - Route 7: buses 26 to 29, 653 + 653 + 652 + 652 = 2,610. Route 12: buses 41 to 43, 578 each,
     1,734. These 7 diverted buses dock at 02:20: 4,344 tickets. All 45 slips: 35,700.
   - Add rows, 02:00 run then the re-run at 02:40: 31,356 + 35,700 = 67,056; route 4 952 + 952 =
     1,904; fares counted twice 31,356 (the 38 early buses). Replace: 35,700, route 4 952.
   - No re-run: 31,356 on the report, 7 buses missing, 4,344 fares short.
   - Clock at 04:00, tonight: one run, 35,700. Bus 43 held until 04:20: the 04:00 run has 44
     buses, 35,700 - 578 = 35,122; the re-run at 04:40 adds 35,700: 70,822 (route 4 1,904).
     Re-run off: 35,122, bus 43 missing.
   - Clock at 02:00 with bus 43 held, add rows: 31,356, then 02:40 adds 35,122 (66,478), then
     04:40 adds 35,700 (102,178); route 4 2,856.
   - All 45 checked in: the job starts at 02:20 tonight (35,700), at 04:20 with bus 43 held, and
     never if bus 43's machine never checks in (no report by 05:00).
   - Cut-off at 04:00 with a late-file rule: tonight 02:20. Bus 43 held: 04:00 with 44 (35,122,
     bus 43 marked missing), then its file at 04:20 starts the job again: replace 35,700, add
     70,822. Machine never checks in: 35,122, bus 43 missing.
   - The clerk's re-run (the runbook): 20 minutes after a bus docks whose file was not in the
     latest run: 02:40 tonight, 04:40 for a bus held until 04:20.
   - Live fares: each fare is sent as sold; route 12 sold 118 in the cutting with no signal
     (40 on bus 41, 39 on 42, 39 on 43), held in the machines and resent when each docks.
     01:00: 35,700 - 118 = 35,582; 02:20: 35,700 (bus 43 held: 35,661 until 04:20).
   - Days: Thursday 15 October 2026 (the night), Friday 16 October from 00:00; the change was on
     Thursday 24 September 2026, three weeks before.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (times in minutes after midnight) ---------- */

  var START = 60;          // 01:00
  var END = 300;           // 05:00
  var STEP = 10;
  var LATE = 140;          // 02:20, the diverted buses dock
  var HELD = 260;          // 04:20, bus 43 if held
  var CUTOFF = 240;        // 04:00
  var RERUN_GAP = 20;      // the clerk re-runs 20 minutes after late buses dock
  var NBUS = 45;

  var STARTS = [
    { value: "clock02", label: "clock: 02:00 (as built)" },
    { value: "clock04", label: "clock: 04:00" },
    { value: "all45", label: "when all 45 have checked in" },
    { value: "cutoff", label: "all 45 checked in, or a 04:00 cut-off with a late-file rule" }
  ];
  var MODES = [
    { value: "add", label: "add rows (since 24 September)" },
    { value: "replace", label: "replace the night's slice (before 24 September)" }
  ];
  var ARRIVALS = [
    { value: "tonight", label: "tonight: the 7 diverted buses dock at 02:20" },
    { value: "held", label: "bus 43 held until 04:20" },
    { value: "never", label: "bus 43's machine never checks in" }
  ];
  var GROUPS = [
    { key: "4", label: "route 4 (bus 17)" },
    { key: "7", label: "route 7 (buses 26 to 29)" },
    { key: "12", label: "route 12 (buses 41 to 43)" },
    { key: "other", label: "the other 37 buses" }
  ];

  /* ---------- small helpers ---------- */

  function commas(n) {
    var s = String(Math.round(n));
    var out = "";
    while (s.length > 3) {
      out = "," + s.slice(s.length - 3) + out;
      s = s.slice(0, s.length - 3);
    }
    return s + out;
  }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(m) { return two(Math.floor(m / 60) % 24) + ":" + two(m % 60); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function sum(arr) { var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i]; return s; }
  function busList(bs) {
    var ns = bs.map(function (b) { return String(b.n); });
    if (ns.length === 1) return "bus " + ns[0];
    return "buses " + ns.slice(0, -1).join(", ") + " and " + ns[ns.length - 1];
  }

  /* ---------- the fleet (given data) ---------- */

  function fleet(C) {
    var list = [];
    var k = 0;
    for (var n = 1; n <= NBUS; n++) {
      var b = { n: n, i: n - 1, group: "other", tickets: 0, dock: 0, gap: 0 };
      if (n === 17) { b.group = "4"; b.tickets = 952; }
      else if (n >= 26 && n <= 29) { b.group = "7"; b.tickets = n <= 27 ? 653 : 652; b.dock = LATE; }
      else if (n >= 41 && n <= 43) { b.group = "12"; b.tickets = 578; b.dock = LATE; b.gap = n === 41 ? 40 : 39; }
      else { b.tickets = k < 27 ? 822 : 821; k += 1; }
      if (n === 43 && C.arrivals === "held") b.dock = HELD;
      if (n === 43 && C.arrivals === "never") b.dock = null;
      list.push(b);
    }
    return list;
  }
  function docked(b, t) { return b.dock !== null && b.dock <= t; }

  /* ---------- the model (a pure replay the display and self-tests read) ---------- */

  // Replays the night from 01:00 to time T. Returns the rows per bus, the runs and the events.
  function replay(C, T) {
    var F = fleet(C);
    var rows = [];
    var inRun = [];
    var ev = [];
    var runs = [];
    var built = false;
    var i;
    var t;
    for (i = 0; i < F.length; i++) { rows.push(0); inRun.push(false); }
    function landedAt(tt) { return F.filter(function (b) { return b.dock === tt; }); }

    if (C.live) {
      for (i = 0; i < F.length; i++) rows[i] = F[i].tickets - (docked(F[i], START) ? 0 : F[i].gap);
      for (t = START + STEP; t <= T; t += STEP) {
        var come = landedAt(t);
        if (!come.length) continue;
        var before = sum(rows);
        var resent = 0;
        come.forEach(function (b) { rows[b.i] += b.gap; resent += b.gap; });
        var one = come.length === 1;
        ev.push({ t: t, tone: "", text: hhmm(t) + " " + busList(come) + (one ? " docks and checks in." : " dock and check in.") +
          (resent ? (one ? " Its machine resends the " : " Their machines resend the ") + commas(resent) + " fares sold in the cutting: the live count goes from " +
            commas(before) + " to " + commas(sum(rows)) + "." : "") });
      }
      return { F: F, rows: rows, runs: runs, built: true, ev: ev };
    }

    function run(tt, why) {
      var before = sum(rows);
      var r4 = rows[16];
      var files = 0;
      for (var j = 0; j < F.length; j++) {
        if (docked(F[j], tt)) {
          files += 1;
          rows[j] = (C.mode === "add" ? rows[j] : 0) + F[j].tickets;
          inRun[j] = true;
        } else {
          if (C.mode === "replace") rows[j] = 0;
          inRun[j] = false;
        }
      }
      built = true;
      runs.push(hhmm(tt));
      var twice = 0;
      for (j = 0; j < F.length; j++) twice += Math.max(0, rows[j] - F[j].tickets);
      ev.push({ t: tt, tone: twice ? "bad" : "", text: hhmm(tt) + " the job starts: " + why + ". It " +
        (C.mode === "add" ? "adds" : "replaces the night's slice with") + " the rows from " + files +
        " files; warehouse rows go from " + commas(before) + " to " + commas(sum(rows)) + ", route 4 from " +
        commas(r4) + " to " + commas(rows[16]) + "." });
    }

    for (t = START + STEP; t <= T; t += STEP) {
      var landed = landedAt(t);
      if (landed.length) {
        var tk = 0;
        landed.forEach(function (b) { tk += b.tickets; });
        ev.push({ t: t, tone: "", text: hhmm(t) + " " + busList(landed) + (landed.length === 1 ? " docks and checks in: " : " dock and check in: ") +
          commas(tk) + " tickets." });
      }
      var inNow = F.filter(function (b) { return docked(b, t); }).length;
      var allIn = inNow === NBUS;
      var why = null;
      if (C.start === "clock02" && t === 120) why = "the clock reaches 02:00";
      else if (C.start === "clock04" && t === 240) why = "the clock reaches 04:00";
      else if (C.start === "all45" && !built && allIn) why = "all 45 buses have checked in";
      else if (C.start === "cutoff") {
        if (!built && allIn) why = "all 45 buses have checked in";
        else if (!built && t === CUTOFF) why = "the 04:00 cut-off, " + inNow + " of 45 have checked in, so the report goes with the missing marked";
        else if (built && landed.some(function (b) { return !inRun[b.i]; })) why = "the late-file rule, a file landed after the last run";
      }
      if (why) run(t, why);
      if (C.rerun && built) {
        var due = F.filter(function (b) { return b.dock === t - RERUN_GAP && !inRun[b.i]; });
        if (due.length) run(t, "the clerk runs the job again, as the runbook says");
      }
    }
    return { F: F, rows: rows, runs: runs, built: built, ev: ev };
  }

  function summary(C, T) {
    var r = replay(C, T);
    var F = r.F;
    var s = { r: r, lake: 0, slips: 0, rows: sum(r.rows), missing: 0, short: 0, twice: 0, groups: {}, notIn: [] };
    GROUPS.forEach(function (g) { s.groups[g.key] = { buses: 0, lake: 0, slips: 0, rows: 0 }; });
    for (var i = 0; i < F.length; i++) {
      var b = F[i];
      var g = s.groups[b.group];
      var d = docked(b, T);
      g.buses += 1;
      g.slips += b.tickets;
      g.rows += r.rows[i];
      if (d) { s.lake += 1; g.lake += 1; } else s.notIn.push(b);
      s.slips += b.tickets;
      if (r.rows[i] === 0) s.missing += 1;
      s.short += Math.max(0, b.tickets - r.rows[i]);
      s.twice += Math.max(0, r.rows[i] - b.tickets);
    }
    return s;
  }

  function outcome(C, s) {
    if (!s.r.built) return "no report yet";
    if (s.twice) return "route 4 " + commas(s.r.rows[16]) + " against a slip of 952; " + commas(s.twice) + " fares counted twice";
    if (s.short) return "report short by " + commas(s.short) + " fares" + (s.missing ? ", " + s.missing + (s.missing === 1 ? " bus" : " buses") + " missing" : "");
    return "report matches the slips: " + commas(s.slips);
  }

  /* ---------- the widget ---------- */

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
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;");
    var tb = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["buses", "files in the lake", "on the slips", "rows on the report"].forEach(function (h, k) {
      hr.appendChild(el("th", "text-align:left;", k === 0 ? "group" : h));
    });
    var th = el("thead");
    th.appendChild(hr);
    tb.appendChild(th);
    var body = el("tbody");
    tb.appendChild(body);
    wrap.appendChild(tb);
    box.appendChild(wrap);
    var lake = el("p", "margin:0;font-size:12px;");
    box.appendChild(lake);
    api.root.appendChild(box);
    return { el: el, head: head, body: body, lake: lake };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var s = summary(C, S.t);
    ui.head.textContent = (S.t === START ? "01:00 on Friday 16 October" : hhmm(S.t) + " on Friday 16 October") +
      ". " + (C.live ? "Live fares, no nightly job." : "Start: " + pick(STARTS, C.start).label + ". Load: " + pick(MODES, C.mode).label +
      ". Re-run by the runbook: " + (C.rerun ? "on." : "off.")) + " Late buses: " + pick(ARRIVALS, C.arrivals).label + ".";
    clear(ui.body);
    GROUPS.forEach(function (g) {
      var x = s.groups[g.key];
      var tr = ui.el("tr");
      [g.label, x.lake + " of " + x.buses, commas(x.slips), s.r.built ? commas(x.rows) : "no report yet"].forEach(function (v) {
        tr.appendChild(ui.el("td", "", v));
      });
      ui.body.appendChild(tr);
    });
    ui.lake.textContent = s.notIn.length ? "Not yet in the lake: " + busList(s.notIn) + "." : "All 45 files are in the lake.";
    S.stat.time(hhmm(S.t));
    S.stat.lake(s.lake + " of 45");
    S.stat.rows(s.r.built ? commas(s.rows) : "0");
    S.stat.route4(s.r.built ? commas(s.r.rows[16]) : "no report yet");
    S.stat.report(s.r.built ? commas(s.rows) : "no report yet");
    S.stat.slips(commas(s.slips));
    S.stat.missing(s.r.built ? String(s.missing) : "no report yet");
    S.stat.short(s.r.built ? commas(s.short) : "no report yet");
    S.stat.twice(commas(s.twice));
    S.stat.runs(C.live ? "live count, no job" : (s.r.runs.length ? s.r.runs.join(", ") : "none yet"));
    S.stat.outcome(outcome(C, s));
  }

  function logEvents(api, from, to) {
    var r = replay(api.state.C, to);
    var n = 0;
    r.ev.forEach(function (e) {
      if (e.t > from && e.t <= to) { api.log(e.text, e.tone); n += 1; }
    });
    return n;
  }

  function closing(api) {
    var S = api.state;
    var s = summary(S.C, END);
    if (!s.r.built) {
      api.log("05:00 no report yet: the job is still waiting for bus 43.", "bad");
      return;
    }
    var bad = s.twice > 0 || s.short > 0;
    api.log("05:00 the " + (S.C.live ? "live count" : "report") + " for the 08:00 claim: " + commas(s.rows) +
      " passengers against 35,700 on the slips; route 4 " + commas(s.r.rows[16]) + " against bus 17's slip of 952.", bad ? "bad" : "ok");
  }

  function step(api) {
    var S = api.state;
    if (S.t >= END) {
      api.log("It is 05:00. Change a setting or reset to replay the night.", "");
      return;
    }
    var to = S.t + STEP;
    if (!logEvents(api, S.t, to)) api.log(hhmm(to) + " no change.", "");
    S.t = to;
    if (to === END) closing(api);
    draw(api);
  }

  function play(api) {
    var S = api.state;
    if (S.t >= END) {
      api.log("It is 05:00. Change a setting or reset to replay the night.", "");
      return;
    }
    api.log("Played from " + hhmm(S.t) + " to 05:00.", "");
    logEvents(api, S.t, END);
    S.t = END;
    closing(api);
    draw(api);
  }

  function change(api, what) {
    api.state.t = START;
    api.log(what + " Back to 01:00.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { start: "clock02", mode: "add", rerun: true, live: false, arrivals: "tonight" };
      S.t = START;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("start", "start rule", STARTS, "start");
      sel("mode", "load mode", MODES, "mode");
      api.control.toggle("rerun", "the clerk runs the job again 20 minutes after late buses dock (runbook)", true, function (on) {
        S.C.rerun = !!on;
        change(api, "Runbook re-run: " + (on ? "on." : "off."));
      });
      api.control.toggle("live", "live fares instead of the nightly job (118 sold in the cutting with no signal)", false, function (on) {
        S.C.live = !!on;
        change(api, "Live fares: " + (on ? "on, each fare counted as it arrives." : "off, the nightly job."));
      });
      sel("arrivals", "late buses", ARRIVALS, "arrivals");
      api.control.button("step", "step 10 minutes", function () { step(api); });
      api.control.button("play", "play to 05:00", function () { play(api); });
      api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time", ""),
        lake: api.stat("lake", "files in the lake", ""),
        rows: api.stat("rows", "warehouse rows", ""),
        route4: api.stat("route4", "route 4 on the report", "warn"),
        report: api.stat("report", "report total", "bad"),
        slips: api.stat("slips", "all 45 slips", ""),
        missing: api.stat("missing", "buses missing from the report", "warn"),
        short: api.stat("short", "fares on the slips not on the report", "warn"),
        twice: api.stat("twice", "fares counted twice", "bad"),
        runs: api.stat("runs", "job runs", ""),
        outcome: api.stat("outcome", "the report", "")
      };

      api.info("<strong>How to read it.</strong> Each row of the table is a group of buses: how many have sent their file into the lake, how many tickets their slips say, and how many rows the warehouse holds for them on the report. One ticket is one passenger, so the report should equal the slips. A run that adds rows puts a second copy on top of any rows already there; a run that replaces the night's slice deletes the night's rows first. Live fares skip the nightly job: each fare is counted as it arrives, except those sold with no signal, which wait until the bus docks.");

      api.log("Friday 16 October, 01:00: 38 of 45 buses have checked in; route 4's bus 17 docked at 23:40 with 952 tickets. Routes 7 and 12 are still on the diversion.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      var BUILT = { start: "clock02", mode: "add", arrivals: "tonight", rerun: true, live: false };
      function as(set) { Object.keys(set).forEach(function (k) { t.set(k, set[k]); }); }
      function fresh(set) { as(BUILT); as(set || {}); t.click("play"); }

      // 1. Opening state: 01:00 on Friday 16 October, 38 files in, no run yet.
      t.expect(t.stat("time") === "01:00" && t.stat("lake") === "38 of 45" && t.stat("rows") === 0 &&
        t.stat("report") === "no report yet" && t.stat("runs") === "none yet" && t.stat("slips") === "35,700" &&
        has("Friday 16 October, 01:00: 38 of 45 buses have checked in"),
        "Opens at 01:00 with 38 of 45 files in the lake and no report");

      // 2. Six steps to 02:00: the clock starts the job over the 38 files.
      for (var k = 0; k < 6; k++) t.click("step");
      t.expect(t.stat("time") === "02:00" && t.stat("route4") === 952 && t.stat("report") === "31,356" &&
        t.stat("missing") === 7 && t.stat("short") === "4,344" &&
        has("02:00 the job starts: the clock reaches 02:00. It adds the rows from 38 files; warehouse rows go from 0 to 31,356, route 4 from 0 to 952."),
        "02:00: the job loads 38 buses, 31,356 tickets, route 4 952, 7 buses missing");

      // 3. As built, played to 05:00: the re-run at 02:40 adds all 45 on top.
      fresh({});
      t.expect(t.stat("route4") === "1,904" && t.stat("report") === "67,056" && t.stat("twice") === "31,356" &&
        t.stat("missing") === 0 && t.stat("runs") === "02:00, 02:40" &&
        has("02:20 buses 26, 27, 28, 29, 41, 42 and 43 dock and check in: 4,344 tickets.") &&
        has("02:40 the job starts: the clerk runs the job again, as the runbook says. It adds the rows from 45 files; warehouse rows go from 31,356 to 67,056, route 4 from 952 to 1,904."),
        "As built: add rows plus the 02:40 re-run gives route 4 1,904 and 67,056 in all");

      // 4. Replace the night's slice: the same re-run gives 952 with all 45 in.
      fresh({ mode: "replace" });
      t.expect(t.stat("route4") === 952 && t.stat("report") === "35,700" && t.stat("twice") === 0 &&
        t.stat("missing") === 0 && t.stat("runs") === "02:00, 02:40" &&
        has("05:00 the report for the 08:00 claim: 35,700 passengers against 35,700 on the slips; route 4 952 against bus 17's slip of 952."),
        "Replace plus re-run: 35,700, route 4 952, all 45 in");

      // 5. Option 2: never run twice. The 7 late buses go missing.
      fresh({ rerun: false });
      t.expect(t.stat("report") === "31,356" && t.stat("missing") === 7 && t.stat("short") === "4,344" &&
        t.stat("route4") === 952 && t.stat("runs") === "02:00",
        "No re-run: 31,356 claimed, the 7 diverted buses' 4,344 tickets missing");

      // 6. Option 0 tonight: the clock at 04:00 runs once with all 45 in.
      fresh({ start: "clock04" });
      t.expect(t.stat("report") === "35,700" && t.stat("runs") === "04:00" && t.stat("route4") === 952,
        "Clock at 04:00, tonight: one run, 35,700");

      // 7. Option 0 with bus 43 held until 04:20: missed at 04:00, doubled again by the re-run.
      fresh({ start: "clock04", arrivals: "held" });
      var heldAdd = t.stat("report") === "70,822" && t.stat("route4") === "1,904" && t.stat("runs") === "04:00, 04:40";
      fresh({ start: "clock04", arrivals: "held", rerun: false });
      t.expect(heldAdd && t.stat("report") === "35,122" && t.stat("missing") === 1 && t.stat("short") === 578,
        "Clock at 04:00 with bus 43 held to 04:20: 35,122 without it, 70,822 after the 04:40 re-run");

      // 8. Wait for all 45 check-ins: 02:20 tonight; no report at all if a machine never checks in.
      fresh({ start: "all45" });
      var all45 = t.stat("runs") === "02:20" && t.stat("report") === "35,700";
      fresh({ start: "all45", arrivals: "never" });
      t.expect(all45 && t.stat("report") === "no report yet" && t.stat("runs") === "none yet" &&
        has("05:00 no report yet: the job is still waiting for bus 43."),
        "All 45 checked in: starts at 02:20 tonight, never if bus 43 never checks in");

      // 9. The fix: all 45 or a 04:00 cut-off with a late-file rule, replacing the night's slice.
      fresh({ start: "cutoff", mode: "replace", arrivals: "held" });
      var held = t.stat("runs") === "04:00, 04:20" && t.stat("report") === "35,700" && t.stat("route4") === 952 &&
        has("04:00 the job starts: the 04:00 cut-off, 44 of 45 have checked in, so the report goes with the missing marked.");
      fresh({ start: "cutoff", mode: "replace", arrivals: "never" });
      t.expect(held && t.stat("report") === "35,122" && t.stat("missing") === 1 && t.stat("runs") === "04:00",
        "Cut-off with a late-file rule: bus 43 held gives 35,700 by 04:20; a dead machine gives 35,122 with bus 43 marked");

      // 10. Option 1: live fares. The 118 sold in the cutting wait until each bus docks.
      as(BUILT);
      t.set("live", true);
      var at1 = t.stat("report") === "35,582" && t.stat("short") === 118 && t.stat("runs") === "live count, no job";
      t.set("arrivals", "held");
      for (var j = 0; j < 8; j++) t.click("step");
      var at220 = t.stat("time") === "02:20" && t.stat("report") === "35,661" && t.stat("short") === 39;
      t.click("play");
      t.expect(at1 && at220 && t.stat("report") === "35,700" && t.stat("short") === 0 && t.stat("route4") === 952,
        "Live fares: 35,582 at 01:00, 35,661 at 02:20 with bus 43 held, 35,700 once it resends");
    }
  });
})();
