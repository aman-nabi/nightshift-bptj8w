/* sims/s5e13-v1.0.0.js  (published as sims/s5e13.js)
   Case s5e13 "Field Report: The Delivery Machine": a pipeline lab for Skelholm Ferries, whose
   booking service leaks memory and is restarted every night at 02:00 by a second Spinnaker-style
   pipeline with a cron trigger. The learner chooses how that restart pipeline works, whether merges
   after 18:00 are refused, and which build is newest at 02:00, then steps from Friday 17:00 to
   Saturday 09:00 an hour at a time. Widget-style sim: it draws both pipelines and an hourly table
   inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: four restart designs (as built: bake the newest build and
     deploy it; with manual judgement; restart the live version; removed after a leak fix), an 18:00
     merge cut-off, and three choices of newest build (345 merged at 17:40 as on Friday, 345 merged
     at 19:10, nothing newer than 344). Next hour, Run to 09:00, Reset. Stats: time, live build,
     memory, main pipeline, restart pipeline, bookings onto boats that run, onto boats that don't,
     onto the 07:30. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - Times are sim clock seconds from Friday 00:00; Saturday 00:00 is 86400. The sim opens at Friday
     17:00 (61200) and ends at Saturday 09:00 (118800).
   - Build 344 is live, signed off on Thursday. Its servers started at Friday 02:04 (7440), when the
     02:00 restart found nothing newer. Memory after a start is 2.0 GB and grows 0.2 GB an hour; at
     8.0 GB, 30 hours after a start, the booking service falls over. Removed after a leak fix: memory
     stays at 2.0 GB.
   - Main pipeline on a merge at M: M merge, build 345, tests pass; M + 4 min baked; M + 7 min on
     staging, manual judgement waiting (for Rosalba on Monday; nothing in the sim clicks Continue).
     With the cut-off on, a merge at or after 18:00 is refused and there is no build 345.
   - Restart pipeline at Saturday 02:00. As built: cron, newest build N, bake skipped (an image
     exists: 344's from Thursday, 345's from M + 4 min); at 02:04 N on new servers (if N is not the
     live build, that is a release approved by nobody). With manual judgement: it waits at 02:00 and
     nobody is awake, so no restart. Restart the live version: new servers from the live image at
     02:04, no bake. Removed: nothing runs.
   - Tickets for Saturday go on sale at 00:00. 19 bookings, one seat each, at stated minutes (BOOK
     below); 11 want the first boat, 8 a later boat (the 10:15, in both timetables). The first boat
     is the 07:30 while 344 is live and the 06:40 while 345 is live; the 06:40 runs only from
     Tuesday 3 November. Sales for the first boat close 10 minutes before it.
   - 06:40: the slipway count. 07:05: if the live build is one nobody approved, Vilem puts 344 back
     on new servers (as Vilém did on Saturday). 07:30: the 07:30 sails.

   Where every number comes from (conventions rule 14; the case is content/s5/s5e13-v1.0.0.json).
   - The week's builds (stated in the lede): 341 Monday, 342 Tuesday, 343 Wednesday, 344 Thursday,
     each signed off the same afternoon; 344 live from Thursday. 345 is Friday's, merged at 17:40.
   - Bookings per hour (Saturday): 00h 3, 01h 2, 02h 2, 03h 1, 04h 2, 05h 5, 06h 4 (to 06:30) = 19.
     After 02:04: 14, of which 9 want the first boat (02:21, 03:36, 04:09, 05:03, 05:27, 05:41,
     06:02, 06:11, 06:19). Before 02:04: 5, two for the first boat (00:31, 01:17).
   - As built, 345 newest: released 02:04 by cron, approved by nobody; 9 onto the 06:40 (doesn't
     run), 10 onto boats that run, 2 onto the 07:30. 344 back at 07:05; memory at 09:00 is
     2.0 + 0.2 x 1.92 = 2.4 GB.
   - Opening memory: 2.0 + 0.2 x 14.93 h = 5.0 GB at Friday 17:00; 5.2 GB at 18:00.
   - With manual judgement: no restart; 2.0 + 0.2 x 30 = 8.0 GB at Saturday 08:04; 19 onto boats
     that run, 11 onto the 07:30, 0 onto the 06:40.
   - Restart the live version: 344 on new servers at 02:04; memory at 09:00 2.0 + 0.2 x 6.93 = 3.4 GB;
     19 run, 11 onto the 07:30.
   - Removed after a leak fix: memory 2.0 GB; 19 run.
   - Cut-off on: 345 at 17:40 still ships (9 onto the 06:40); 345 at 19:10 is refused (0).
   - Nothing newer than 344 (the ordinary night of the last two years): 344 on new servers at 02:04,
     nothing new ships, 0 onto the 06:40.
*/
(function () {
  "use strict";

  var SAT = 86400;
  var T_OPEN = 17 * 3600;
  var T_END = SAT + 9 * 3600;
  var LIVE_START = 2 * 3600 + 240;
  var MEM0 = 2.0;
  var LEAK = 0.2;
  var FULL = 8.0;
  // Saturday bookings: minute after midnight, F = first boat, L = a later boat (the 10:15).
  var BOOK = [
    [12, "L"], [31, "F"], [48, "L"], [77, "F"], [104, "L"], [141, "F"], [170, "L"], [216, "F"],
    [249, "F"], [292, "L"], [303, "F"], [318, "L"], [327, "F"], [341, "F"], [355, "L"], [362, "F"],
    [371, "F"], [379, "F"], [386, "L"]
  ];
  var DESIGNS = [
    { value: "built", label: "As built: bake the newest build, deploy it" },
    { value: "judge", label: "Add a manual judgement stage" },
    { value: "live", label: "Restart the version already live" },
    { value: "removed", label: "Removed after a leak fix" }
  ];
  var NEWEST = [
    { value: "m1740", label: "345, the winter timetable, merged 17:40 (Friday)" },
    { value: "m1910", label: "345, merged at 19:10 instead" },
    { value: "none", label: "Nothing newer than 344 (an ordinary night)" }
  ];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hm(t) {
    var day = t >= SAT ? "Sat" : "Fri";
    var s = t % SAT;
    return day + " " + pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60));
  }
  function labelOf(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i].value === v) return list[i].label;
    return v;
  }

  /* ---------- the model: settings in, the whole night out ---------- */

  function memText(st, t) {
    if (st.fixed) return MEM0.toFixed(1) + " GB";
    if (st.crashed) return FULL.toFixed(1) + " GB, full";
    return (MEM0 + LEAK * (t - st.start) / 3600).toFixed(1) + " GB";
  }

  function simulate(C) {
    var items = [];
    function add(t, pri, fn) { items.push({ t: t, pri: pri, fn: fn }); }
    var st = {
      live: 344, start: LIVE_START, newest: 344, crashed: false, fixed: C.design === "removed",
      main: "nothing waiting", restart: "not run yet", run: 0, ghost: 0, first07: 0, hourRun: 0, hourGhost: 0
    };
    var ev = [];
    function out(t, line, tone) {
      ev.push({ t: t, line: line, tone: tone || "", snap: {
        time: hm(t), live: "build " + st.live, memory: memText(st, t), main: st.main, restart: st.restart,
        run: st.run, ghost: st.ghost, first07: st.first07
      } });
    }

    // Hourly lines: the state at each hour, and Saturday's bookings in the hour before.
    for (var h = T_OPEN + 3600; h <= T_END; h += 3600) {
      (function (t) {
        add(t, 0, function () {
          var line = hm(t) + ". Live: build " + st.live + ". Memory " + memText(st, t) + ".";
          if (t > SAT) {
            line += " Booked in the last hour: " + st.hourRun + " onto boats that run, " + st.hourGhost + " onto boats that don't.";
            st.hourRun = 0;
            st.hourGhost = 0;
          }
          out(t, line, "");
        });
      })(h);
    }

    // The main pipeline.
    if (C.newest !== "none") {
      var M = C.newest === "m1740" ? 17 * 3600 + 40 * 60 : 19 * 3600 + 10 * 60;
      if (C.cutoff && M >= 18 * 3600) {
        add(M, 1, function () {
          st.main = "no merge (cut-off)";
          out(M, hm(M) + ". main: merge of build 345, the winter timetable, refused: no merges after 18:00. It waits for Monday.", "warn");
        });
      } else {
        add(M, 1, function () {
          st.newest = 345;
          st.main = "build 345 merged";
          out(M, hm(M) + ". main: merge, build 345, the winter timetable. Tests passed.", "");
        });
        add(M + 240, 1, function () {
          st.main = "build 345 baked";
          out(M + 240, hm(M + 240) + ". main: build 345 baked into an image.", "");
        });
        add(M + 420, 1, function () {
          st.main = "build 345 waiting at judgement";
          out(M + 420, hm(M + 420) + ". main: build 345 on staging. judgement: waiting", "warn");
        });
      }
    }

    // The restart pipeline at Saturday 02:00.
    var R = SAT + 7200;
    if (C.design === "built") {
      add(R, 1, function () {
        st.restart = "running";
        out(R, hm(R) + ". restart: cron. newest build: " + st.newest + ". bake skipped", "");
      });
      add(R + 240, 1, function () {
        if (st.newest !== st.live) {
          st.live = st.newest;
          st.restart = "released " + st.newest + ", approved by nobody";
          st.start = R + 240;
          out(R + 240, hm(R + 240) + ". restart: production: build " + st.live + " released. approved by: nobody", "bad");
        } else {
          st.restart = "restarted " + st.live;
          st.start = R + 240;
          out(R + 240, hm(R + 240) + ". restart: production: build " + st.live + " on new servers. Nothing new shipped.", "ok");
        }
      });
    } else if (C.design === "judge") {
      add(R, 1, function () {
        st.restart = "waiting at judgement";
        out(R, hm(R) + ". restart: cron. newest build: " + st.newest + ". manual judgement: waiting. Nobody is awake to click.", "warn");
      });
    } else if (C.design === "live") {
      add(R, 1, function () {
        st.restart = "running";
        out(R, hm(R) + ". restart: cron. live build: " + st.live + ". starting new servers from its image, no bake", "");
      });
      add(R + 240, 1, function () {
        st.restart = "restarted " + st.live;
        st.start = R + 240;
        out(R + 240, hm(R + 240) + ". restart: production: build " + st.live + " on new servers. Nothing new shipped.", "ok");
      });
    } else {
      add(R, 1, function () {
        st.restart = "removed (leak fixed)";
        out(R, hm(R) + ". No restart pipeline: the leak is fixed, so nothing runs.", "ok");
      });
    }

    // Saturday's bookings (no log line each; the hourly lines count them).
    BOOK.forEach(function (b) {
      var t = SAT + b[0] * 60;
      add(t, 2, function () {
        if (b[1] === "F" && st.live === 345) { st.ghost += 1; st.hourGhost += 1; }
        else { st.run += 1; st.hourRun += 1; if (b[1] === "F") st.first07 += 1; }
      });
    });

    // The morning.
    var T640 = SAT + 6 * 3600 + 40 * 60;
    add(T640, 1, function () {
      if (st.ghost > 0) out(T640, hm(T640) + ". slipway: " + st.ghost + " people with tickets for the 06:40. No boat: it runs only from 3 November.", "bad");
      else out(T640, hm(T640) + ". slipway: nobody waiting. The first boat today is the 07:30.", "ok");
    });
    var T705 = SAT + 7 * 3600 + 300;
    add(T705, 1, function () {
      if (st.live === 345 && !st.crashed) {
        st.live = 344;
        st.start = T705;
        out(T705, hm(T705) + ". Vilém puts build 344 back by hand, on new servers.", "warn");
      }
    });
    var T730 = SAT + 7 * 3600 + 1800;
    add(T730, 1, function () {
      if (!st.crashed) out(T730, hm(T730) + ". The 07:30 sails with " + st.first07 + " booked.", "");
    });
    // The leak is checked before each item: 30 hours after the last start, unless a restart came first.
    items.sort(function (a, b) { return (a.t - b.t) || (a.pri - b.pri); });
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!st.fixed && !st.crashed) {
        var full = st.start + 30 * 3600;
        if (full <= it.t && full <= T_END) {
          st.crashed = true;
          out(full, hm(full) + ". Memory full at 8.0 GB: the booking service falls over. The site is down.", "bad");
        }
      }
      it.fn();
    }
    return { ev: ev, st: st };
  }

  /* ---------- the widget ---------- */

  function build(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var wrap = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;");
    var head = el("p", "margin:0;");
    var pipes = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;min-width:0;");
    var mainBox = el("div", "min-width:0;border:1px solid currentColor;border-radius:4px;padding:6px;");
    var restBox = el("div", "min-width:0;border:1px solid currentColor;border-radius:4px;padding:6px;");
    pipes.appendChild(mainBox);
    pipes.appendChild(restBox);
    var tableWrap = el("div", "overflow-x:auto;min-width:0;");
    var table = el("table", "width:100%;font-size:11px;border-collapse:collapse;");
    var hr = el("tr");
    ["hour", "live build", "memory", "booked, boats that run", "booked, boats that don't"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;padding:2px 4px;", h));
    });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    wrap.appendChild(head);
    wrap.appendChild(pipes);
    wrap.appendChild(tableWrap);
    api.root.appendChild(wrap);
    return { el: el, head: head, main: mainBox, rest: restBox, tbody: tbody };
  }

  function stageList(ui, box, title, stages) {
    while (box.firstChild) box.removeChild(box.firstChild);
    box.appendChild(ui.el("strong", "", title));
    var ol = ui.el("ol", "margin:4px 0 0 18px;padding:0;");
    stages.forEach(function (s) { ol.appendChild(ui.el("li", s[1] ? "font-weight:700;" : "", s[0])); });
    box.appendChild(ol);
  }

  function show(api) {
    var S = api.state;
    var ui = S.ui;
    var C = S.C;
    var snap = S.k > 0 ? S.M.ev[S.k - 1].snap : S.open;
    ui.head.textContent = "Restart pipeline: " + labelOf(DESIGNS, C.design).toLowerCase() + ". Merge cut-off at 18:00: " +
      (C.cutoff ? "on" : "off") + ". Newest build: " + labelOf(NEWEST, C.newest) + ".";
    var m = snap.main;
    stageList(ui, ui.main, "Main pipeline (trigger: a merge)", [
      ["Merge: " + (m === "nothing waiting" ? "nothing since 344" : (m === "no merge (cut-off)" ? "345 refused, after 18:00" : "build 345")), false],
      ["Bake: " + (/baked|waiting/.test(m) ? "image of 345" : "-"), false],
      ["Deploy to staging: " + (/waiting/.test(m) ? "345" : "344"), false],
      ["Manual judgement: " + (/waiting/.test(m) ? "345 waiting for Rosalba" : "nothing waiting"), /waiting/.test(m)],
      ["Deploy to production, red/black", false]
    ]);
    var r = snap.restart;
    var rs;
    if (C.design === "built") rs = [["Bake the newest build (skipped if its image exists)", false], ["Deploy to production, red/black: " + r, /nobody/.test(r)]];
    else if (C.design === "judge") rs = [["Bake the newest build", false], ["Manual judgement: " + r, /waiting/.test(r)], ["Deploy to production", false]];
    else if (C.design === "live") rs = [["Start new servers from the live image: " + r, false]];
    else rs = [["No stages: " + r, false]];
    stageList(ui, ui.rest, C.design === "removed" ? "Restart pipeline (removed)" : "Restart pipeline (trigger: cron, 02:00)", rs);
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    var prev = { run: 0, ghost: 0 };
    S.M.ev.slice(0, S.k).forEach(function (e) {
      if (!/\. Live: build/.test(e.line)) return;
      var tr = ui.el("tr");
      var dg = e.snap.ghost - prev.ghost;
      [e.snap.time, e.snap.live, e.snap.memory, String(e.snap.run - prev.run), String(dg)].forEach(function (c, i) {
        tr.appendChild(ui.el("td", "padding:2px 4px;" + (i === 4 && dg > 0 ? "font-weight:700;" : ""), c));
      });
      prev = { run: e.snap.run, ghost: e.snap.ghost };
      ui.tbody.appendChild(tr);
    });
    S.stat.time(snap.time);
    S.stat.live(snap.live);
    S.stat.memory(snap.memory);
    S.stat.main(snap.main);
    S.stat.restart(snap.restart);
    S.stat.run(snap.run);
    S.stat.ghost(snap.ghost);
    S.stat.first07(snap.first07);
  }

  function reveal(api, upto) {
    var S = api.state;
    while (S.k < S.M.ev.length && S.M.ev[S.k].t <= upto) {
      var e = S.M.ev[S.k];
      api.clock = e.t;
      api.log(e.line, e.tone);
      S.lines.push(e.line);
      S.k += 1;
    }
    S.now = Math.min(upto, T_END);
    api.clock = S.now;
    show(api);
  }

  function rewind(api, what) {
    var S = api.state;
    S.M = simulate(S.C);
    S.k = 0;
    S.now = T_OPEN;
    S.lines = [];
    api.clock = T_OPEN;
    api.log(what + " Rewound to Friday 17:00.", "");
    show(api);
  }

  DL.sims.define("s5e13", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      api.clock = T_OPEN;
      S.C = { design: "built", cutoff: false, newest: "m1740" };
      S.k = 0;
      S.now = T_OPEN;
      S.lines = [];
      S.open = {
        time: hm(T_OPEN), live: "build 344", memory: memText({ start: LIVE_START, fixed: false, crashed: false }, T_OPEN),
        main: "nothing waiting", restart: "not run yet", run: 0, ghost: 0, first07: 0
      };
      S.ui = build(api);
      S.M = simulate(S.C);
      api.control.select("design", "How the 02:00 restart pipeline works", DESIGNS, "built", function (v) {
        S.C.design = String(v);
        S.open.memory = S.C.design === "removed" ? "2.0 GB" : memText({ start: LIVE_START, fixed: false, crashed: false }, T_OPEN);
        rewind(api, "Restart pipeline: " + labelOf(DESIGNS, S.C.design).toLowerCase() + ".");
      });
      api.control.toggle("cutoff", "Refuse merges after 18:00", false, function (on) {
        S.C.cutoff = !!on;
        rewind(api, "Merge cut-off at 18:00: " + (on ? "on." : "off."));
      });
      api.control.select("newest", "Which build is newest at 02:00", NEWEST, "m1740", function (v) {
        S.C.newest = String(v);
        rewind(api, "Newest build: " + labelOf(NEWEST, S.C.newest) + ".");
      });
      api.control.button("next", "Next hour", function () { reveal(api, S.now + 3600); });
      api.control.button("run", "Run to 09:00", function () { reveal(api, T_END); });
      api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        time: api.stat("time", "time", ""),
        live: api.stat("live", "live build", ""),
        memory: api.stat("memory", "servers' memory in use", "warn"),
        main: api.stat("main", "main pipeline", ""),
        restart: api.stat("restart", "restart pipeline", ""),
        run: api.stat("run", "booked onto boats that run", "ok"),
        ghost: api.stat("ghost", "booked onto boats that don't run", "bad"),
        first07: api.stat("first07", "booked onto the 07:30", "")
      };
      api.info("<strong>How to read it.</strong> Two pipelines carry builds to production. The main one starts on a merge and stops at manual judgement until Rosalba clicks Continue. The restart one starts on a cron timer at 02:00. The table shows, each hour, which build is live, the servers' memory, and Saturday's bookings: onto boats that run, and onto the 06:40, which runs only from 3 November.");
      api.log("Fri 17:00. Live: build 344, signed off on Thursday. Its servers started at 02:04 today, when the 02:00 restart found nothing newer. Memory 5.0 GB.", "");
      show(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.api.state.lines.join("\n").indexOf(s) >= 0; }
      function run(design, cutoff, newest) {
        t.set("design", design);
        t.set("cutoff", cutoff);
        t.set("newest", newest);
        t.click("run");
      }

      // 1. Opens on Friday 17:00, before the winter timetable is merged.
      t.expect(t.stat("time") === "Fri 17:00" && t.stat("live") === "build 344" && t.stat("memory") === "5.0 GB" &&
        t.stat("main") === "nothing waiting" && t.stat("restart") === "not run yet" && t.stat("run") === 0 && t.stat("ghost") === 0 &&
        t.logText().indexOf("Fri 17:00. Live: build 344, signed off on Thursday.") >= 0,
        "Opens Friday 17:00: build 344 live, memory 5.0 GB, nothing merged yet");

      // 2. The first hour: 345 is merged, baked and held at manual judgement.
      t.click("next");
      t.expect(has("Fri 17:40. main: merge, build 345, the winter timetable. Tests passed.") &&
        has("Fri 17:47. main: build 345 on staging. judgement: waiting") &&
        t.stat("main") === "build 345 waiting at judgement" && t.stat("live") === "build 344" &&
        t.stat("time") === "Fri 18:00" && t.stat("memory") === "5.2 GB",
        "17:40 merge, 17:47 on staging and waiting at judgement; 344 still live at 18:00, memory 5.2 GB");

      // 3. As built: cron releases 345 at 02:04, approved by nobody; 9 onto the 06:40.
      t.click("run");
      t.expect(has("Sat 02:00. restart: cron. newest build: 345. bake skipped") &&
        has("Sat 02:04. restart: production: build 345 released. approved by: nobody") &&
        t.stat("ghost") === 9 && t.stat("run") === 10 && t.stat("first07") === 2,
        "As built: 345 released at 02:04 by cron; 9 bookings onto the 06:40, 10 onto boats that run");

      // 4. The morning, as built: 345 live by the hour, nine on the slipway, 344 back at 07:05.
      t.expect(has("Sat 03:00. Live: build 345.") &&
        has("Sat 06:40. slipway: 9 people with tickets for the 06:40. No boat: it runs only from 3 November.") &&
        has("Sat 07:05. Vilém puts build 344 back by hand, on new servers.") &&
        t.stat("live") === "build 344" && t.stat("memory") === "2.4 GB" && t.stat("time") === "Sat 09:00",
        "As built: 345 live through the night, 9 at 06:40, 344 back at 07:05, memory 2.4 GB at 09:00");

      // 5. Manual judgement at 02:00: nothing ships, and the leak wins at 08:04.
      run("judge", false, "m1740");
      t.expect(t.stat("ghost") === 0 && t.stat("run") === 19 && t.stat("first07") === 11 &&
        t.stat("restart") === "waiting at judgement" && t.stat("memory") === "8.0 GB, full" &&
        has("Sat 08:04. Memory full at 8.0 GB: the booking service falls over. The site is down."),
        "Manual judgement: the run waits, nobody clicks; 0 onto the 06:40, memory full at 08:04");

      // 6. Restart the live version: 344 on new servers, every booking onto a real boat.
      run("live", false, "m1740");
      t.expect(t.stat("ghost") === 0 && t.stat("run") === 19 && t.stat("first07") === 11 && t.stat("live") === "build 344" &&
        t.stat("memory") === "3.4 GB" && t.stat("restart") === "restarted 344" && t.stat("main") === "build 345 waiting at judgement" &&
        has("Sat 02:04. restart: production: build 344 on new servers. Nothing new shipped."),
        "Restart the live version: 344 on new servers at 02:04, 345 still waiting, all 19 onto real boats, 3.4 GB at 09:00");

      // 7. Removed after a leak fix: no run, no growth.
      run("removed", false, "m1740");
      t.expect(t.stat("ghost") === 0 && t.stat("run") === 19 && t.stat("memory") === "2.0 GB" && t.stat("restart") === "removed (leak fixed)",
        "Leak fixed and pipeline removed: nothing runs at 02:00, memory 2.0 GB");

      // 8. The 18:00 cut-off doesn't stop a 17:40 merge.
      run("built", true, "m1740");
      t.expect(t.stat("ghost") === 9 && has("Sat 02:04. restart: production: build 345 released. approved by: nobody"),
        "Cut-off on: 345 was merged at 17:40, before 18:00, and still ships; 9 onto the 06:40");

      // 9. The cut-off refuses a 19:10 merge.
      run("built", true, "m1910");
      t.expect(t.stat("ghost") === 0 && t.stat("main") === "no merge (cut-off)" &&
        has("Fri 19:10. main: merge of build 345, the winter timetable, refused: no merges after 18:00."),
        "Cut-off on, merge at 19:10: refused, nothing new at 02:00");

      // 10. Without the cut-off, a 19:10 merge ships the same way.
      run("built", false, "m1910");
      t.expect(t.stat("ghost") === 9 && has("Fri 19:17. main: build 345 on staging. judgement: waiting"),
        "Cut-off off, merge at 19:10: 345 waits at 19:17 and is released at 02:04; 9 onto the 06:40");

      // 11. An ordinary night of the last two years: newest equals live, nothing new ships.
      run("built", false, "none");
      t.expect(t.stat("ghost") === 0 && t.stat("first07") === 11 && t.stat("restart") === "restarted 344" &&
        has("Sat 02:00. restart: cron. newest build: 344. bake skipped") &&
        has("Sat 02:04. restart: production: build 344 on new servers. Nothing new shipped."),
        "Ordinary night: newest build is 344, bake skipped, 344 on new servers, nothing new ships");
    }
  });
})();
