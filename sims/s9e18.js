/* sims/s9e18-v1.0.0.js  (published as sims/s9e18.js)
   Case s9e18 "Field Report: Any Region Can Take It": a game-day lab for Pelmouth's pay-by-phone
   parking system, which runs live in two cloud regions, A and B, copied from Netflix's 2013
   active-active post. The learner sets machines per region, a maximum traffic level, how the DNS
   answer moves drivers (all at once or a third a minute), how long phones keep the DNS answer,
   what the handheld shows with no answer, handheld retries, the split, a one-live-region design
   with a small standby, and the load (the Saturday peak or the April drill), then fails region A
   and plays 02:00 to 02:19 minute by minute. Widget-style sim: it draws inside api.root.
   Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls machines, level, shift, ttl, noanswer, retries,
     split, design, load; buttons Next minute, Fail region A now, Replay the night, Play to 02:20,
     Reset. Stats: time, status page, region A health, region B machines, in, answered in time,
     waiting, timed out, turned away, busy, health, handheld results, totals. selfTest: 12
     assertions.

   The model (stated in sim.lede; every number is given data from the post):
   - One machine answers 100 requests a minute. One request in ten is a handheld check; in this
     lab every car checked has paid, so every "unpaid" is wrong.
   - Load: 600 a minute (the Saturday peak, 23:00 to 03:00) or 120 (the April drill, 05:00 on
     Sunday 19 April 2026). Split 50/50 (300 and 300) or 70/30 (420 and 180).
   - A region works through its line first come, first served. A request not answered in the
     minute it arrives has timed out: its phone or handheld has given up. It stays in the line,
     and a machine still spends its turn on it later (wasted work).
   - Health checks: a tiny test request every few seconds. In this lab they fail in any minute
     that starts with requests already waiting, because each check waits behind them.
   - Region A fails at the start of its minute and answers nothing after; its line is lost.
   - The steering marks A down and points the DNS answer at B in the minute A fails. With phones
     keeping the DNS answer 60 seconds, A's drivers reach B the next minute; with 5 seconds, the
     same minute. "Gradual" moves a third of A's drivers a minute instead of all at once.
   - Maximum level on: a region answers up to machines x 100 a minute and turns the rest away at
     once ("busy, try again"); nothing waits, so health checks pass.
   - Retries: each check with no answer is sent 3 more times in the next minute. The handheld
     line counts the cars checked this minute, by their first try; retries only add requests.
   - One live region: A runs 8 machines and takes everyone; B is a standby of 2 that has 2 more
     machines each minute after A fails: 4, 6, then 8.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e18-v1.0.0.json):
   - As built (4 machines, 600, 50/50, 60 s): 02:00 to 02:09 A and B 300 in, 300 answered, 75%
     busy. 02:10 A fails: its 300 time out; B 300. 02:11 B 600 in, 400 answered, 200 waiting,
     overloaded. 02:12 B checks fail: 200 wasted, 200 answered in time, 400 waiting. From 02:13
     0 answered in time; the line grows 200 a minute to 1,800 at 02:19. Handhelds from 02:13:
     paid 0, unpaid 60. Totals 02:00 to 02:19: 6,900 answered in time, 5,100 timed out.
   - The April drill (120): B takes 120 on 4 machines, 30% busy, healthy.
   - 8 machines: B 600 in, 600 answered, 75% busy, healthy. Only A's 300 at 02:10 time out.
   - Maximum level, 4 machines: B answers 400 and turns 200 away each minute, healthy; with
     "cannot check" the handhelds show paid 40, cannot check 20.
   - 70/30: B serving 100% after A fails, 600 in. With 4 machines A takes 420 on 400 and is
     overloaded from 02:00 before anything fails.
   - DNS answer kept 5 seconds: B 600 in at 02:10, overloaded at 02:10, checks fail at 02:11.
   - Retries: B gets 690 at 02:11 and 780 a minute from 02:14 (600 plus 180 retries); line
     3,195 at 02:19 against 1,800; every car checked from 02:13 still shows unpaid.
   - Gradual move after a real fault, 8 machines: 02:11 B 400, 02:12 500, 02:13 600; 600 time out
     at dead A (300 more than all at once). Totals 11,400 answered in time.
   - One live region: 02:10 600 time out; 02:11 B 4 machines, 400 answered, 200 waiting; 02:12
     6 machines, checks fail, 400 answered in time; 02:13 8 machines, 600 answered; healthy from
     02:14. 1,000 timed out in all. Machines paid for: 10 (8 + 2), against 8 as built and 16.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var START = 120;           // 02:00, in minutes after midnight
  var MINUTES = 20;          // 02:00 to 02:19
  var STORY_FAIL = 10;       // region A fails at 02:10
  var PER_MACHINE = 100;     // requests a minute one machine answers
  var CHECK_SHARE = 10;      // one request in ten is a handheld check
  var TRIES = 3;             // retries: 3 more tries the next minute
  var LIVE = 8;              // one live region: machines in A
  var STANDBY0 = 2;          // standby machines in B
  var STANDBY_STEP = 2;      // machines added each minute after A fails
  var STANDBY_MAX = 8;

  var BUILT = { machines: "4", level: "off", shift: "once", ttl: "60", noanswer: "unpaid", retries: "0", split: "50", design: "aa", load: "600" };

  var OPTS = {
    machines: [{ value: "4", label: "4 each, 400 a minute (as built)" }, { value: "8", label: "8 each, 800 a minute" }],
    level: [{ value: "off", label: "off (as built)" }, { value: "on", label: "on: turn away above what the machines answer" }],
    shift: [{ value: "once", label: "all at once (as built)" }, { value: "gradual", label: "gradual: a third of A's drivers a minute" }],
    ttl: [{ value: "60", label: "60 seconds (as built)" }, { value: "5", label: "5 seconds" }],
    noanswer: [{ value: "unpaid", label: "shows unpaid (as built)" }, { value: "cannot", label: "shows cannot check" }],
    retries: [{ value: "0", label: "none (as built)" }, { value: "3", label: "3 more tries the next minute" }],
    split: [{ value: "50", label: "50/50 (as built)" }, { value: "70", label: "70/30" }],
    design: [{ value: "aa", label: "both regions live (as built)" }, { value: "standby", label: "one live region of 8, a standby of 2" }],
    load: [{ value: "600", label: "600 a minute, the Saturday peak" }, { value: "120", label: "120 a minute, the April drill" }]
  };
  var LABELS = {
    machines: "Machines per region", level: "Maximum traffic level", shift: "Move region A's drivers",
    ttl: "Phones keep the DNS answer", noanswer: "Handheld with no answer", retries: "Handheld retries",
    split: "Split between regions", design: "Design", load: "Load"
  };

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hm(i) { var t = START + i; return two(Math.floor(t / 60) % 24) + ":" + two(t % 60); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pct(a, b) { return b > 0 ? Math.round(a * 100 / b) + "%" : "0%"; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function machinesAt(C, name, i, failAt) {
    if (C.design === "standby") {
      if (name === "A") return LIVE;
      if (failAt === null || i <= failAt) return STANDBY0;
      return Math.min(STANDBY_MAX, STANDBY0 + STANDBY_STEP * (i - failAt));
    }
    return Number(C.machines);
  }

  // Share of region A's drivers whose phones already use the new DNS answer (region B).
  function moved(C, i, failAt) {
    if (failAt === null || i < failAt) return 0;
    var k = i - failAt + (C.ttl === "60" ? 0 : 1);
    if (k <= 0) return 0;
    return C.shift === "once" ? 1 : Math.min(1, k / 3);
  }

  // fresh: the cars checked this minute (first tries); retries only add requests.
  function serve(name, inn, fresh, machines, down, line0, level) {
    var o = { name: name, machines: down ? 0 : machines, inn: inn, line0: line0, useful: 0, wasted: 0, timedOut: 0, away: 0, line: 0, busy: "0%", health: "down" };
    if (down) {
      o.timedOut = inn;
      o.paid = 0; o.noAns = fresh;
      return o;
    }
    var cap = machines * PER_MACHINE;
    if (level) {
      o.useful = Math.min(inn, cap);
      o.away = inn - o.useful;
    } else {
      o.wasted = Math.min(line0, cap);
      o.useful = Math.min(inn, cap - o.wasted);
      o.timedOut = inn - o.useful;
      o.line = line0 - o.wasted + o.timedOut;
    }
    o.busy = pct(o.useful + o.wasted, cap);
    o.health = line0 > 0 ? "failing health checks" : (o.line > 0 ? "overloaded" : "healthy");
    var fr = inn > 0 ? o.useful / inn : 1;
    o.paid = Math.round(fresh * fr);
    o.noAns = fresh - o.paid;
    return o;
  }

  function night(C, failAt) {
    var L = Number(C.load);
    var H = L / CHECK_SHARE;
    var aShare = C.design === "standby" ? L : (C.split === "70" ? Math.round(L * 0.7) : L / 2);
    var aChecks = C.design === "standby" ? H : (C.split === "70" ? Math.round(H * 0.7) : H / 2);
    var level = C.level === "on";
    var line = { A: 0, B: 0 };
    var retry = 0;
    var tot = { useful: 0, timedOut: 0, away: 0, wasted: 0, paid: 0, noAns: 0 };
    var rows = [];
    for (var i = 0; i < MINUTES; i++) {
      var down = failAt !== null && i >= failAt;
      var f = moved(C, i, failAt);
      var mv = Math.round(aShare * f);
      var mc = Math.round(aChecks * f);
      var inA = aShare - mv;
      var inB = L - aShare + mv;
      var rA = Math.round(retry * inA / L);
      var rB = retry - rA;
      var A = serve("A", inA + rA, aChecks - mc, machinesAt(C, "A", i, failAt), down, down ? 0 : line.A, level);
      var B = serve("B", inB + rB, H - aChecks + mc, machinesAt(C, "B", i, failAt), false, line.B, level);
      line.A = A.line;
      line.B = B.line;
      retry = C.retries === "3" ? TRIES * (A.noAns + B.noAns) : 0;
      [A, B].forEach(function (r) {
        tot.useful += r.useful; tot.timedOut += r.timedOut; tot.away += r.away; tot.wasted += r.wasted;
        tot.paid += r.paid; tot.noAns += r.noAns;
      });
      var all = A.inn + B.inn;
      rows.push({
        i: i, A: A, B: B, down: down,
        status: "Region A: " + (down ? "down" : "serving " + pct(A.inn, all)) + ". Region B: serving " + pct(B.inn, all),
        paid: A.paid + B.paid, noAns: A.noAns + B.noAns,
        tot: { useful: tot.useful, timedOut: tot.timedOut, away: tot.away, wasted: tot.wasted, paid: tot.paid, noAns: tot.noAns }
      });
    }
    return rows;
  }

  function noWord(C) { return C.noanswer === "cannot" ? "cannot check" : "unpaid"; }

  function describe(C) {
    if (C.design === "standby") return "one live region (A, 8 machines) and a standby of 2 in B";
    return "both regions live, " + C.machines + " machines each, split " + (C.split === "70" ? "70/30" : "50/50");
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
    ["region", "machines", "in", "answered in time", "waiting", "timed out", "turned away", "busy", "health"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;", h));
    });
    var th = el("thead");
    th.appendChild(hr);
    tb.appendChild(th);
    var body = el("tbody");
    tb.appendChild(body);
    wrap.appendChild(tb);
    box.appendChild(wrap);
    var page = el("p", "margin:0;font-size:12px;font-family:monospace;");
    box.appendChild(page);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { el: el, head: head, body: body, page: page, sum: sum };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var rows = night(C, S.failAt);
    var r = S.m > 0 ? rows[S.m - 1] : null;
    ui.head.textContent = "Set-up: " + describe(C) + ", " + C.load + " a minute, maximum level " + C.level +
      ", DNS answer kept " + C.ttl + " seconds. Region A " + (S.failAt === null ? "not failed yet" : "fails at " + hm(S.failAt)) + ".";
    clear(ui.body);
    ["A", "B"].forEach(function (k) {
      var x = r ? r[k] : null;
      var cells = x
        ? [k, String(x.machines), fmt(x.inn), fmt(x.useful), fmt(x.line), fmt(x.timedOut), fmt(x.away), x.busy, x.health]
        : [k, String(machinesAt(C, k, 0, null)), "-", "-", "0", "-", "-", "-", "healthy"];
      var tr = ui.el("tr");
      cells.forEach(function (c) { tr.appendChild(ui.el("td", "", c)); });
      ui.body.appendChild(tr);
    });
    var status = r ? r.status : night(C, null)[0].status;
    ui.page.textContent = "Status page: " + status;
    var hh = r ? "paid " + fmt(r.paid) + ", " + noWord(C) + " " + fmt(r.noAns) : "none yet";
    ui.sum.textContent = r
      ? "Handheld checks at " + hm(r.i) + ": " + hh + ". Since 02:00: " + fmt(r.tot.useful) + " answered in time, " + fmt(r.tot.timedOut) +
        " timed out, " + fmt(r.tot.away) + " turned away."
      : "Not played yet: 02:00 on Sunday 11 October 2026, the Saturday peak.";
    S.stat.time(r ? hm(r.i) : "02:00 (not played)");
    S.stat.status(status);
    S.stat.aHealth(r ? r.A.health : "healthy");
    S.stat.bMachines(r ? r.B.machines : machinesAt(C, "B", 0, null));
    S.stat.bIn(r ? r.B.inn : 0);
    S.stat.bServed(r ? r.B.useful : 0);
    S.stat.bQueued(fmt(r ? r.B.line : 0));
    S.stat.bTimedOut(r ? r.B.timedOut : 0);
    S.stat.bAway(r ? r.B.away : 0);
    S.stat.bBusy(r ? r.B.busy : "0%");
    S.stat.bHealth(r ? r.B.health : "healthy");
    S.stat.handheld(hh);
    S.stat.totTimedOut(fmt(r ? r.tot.timedOut : 0));
    S.stat.totAway(fmt(r ? r.tot.away : 0));
  }

  function events(C, rows, k, failAt) {
    var r = rows[k];
    var prev = k > 0 ? rows[k - 1] : null;
    var out = [];
    if (k === failAt) {
      out.push({ text: hm(k) + " region A fails. The steering's health checks mark it down and point the DNS answer at region B, " +
        (C.shift === "once" ? "for everyone at once" : "a third of A's drivers a minute") + ". Phones keep their old answer up to " + C.ttl + " seconds.", tone: "bad" });
    }
    if (C.design === "standby" && prev && r.B.machines !== prev.B.machines) out.push({ text: hm(k) + " the standby has " + r.B.machines + " machines.", tone: "" });
    ["A", "B"].forEach(function (n) {
      var x = r[n];
      var p = prev ? prev[n] : null;
      if (x.health === "overloaded" && (!p || p.health === "healthy")) {
        out.push({ text: hm(k) + " region " + n + " overloaded: " + fmt(x.inn) + " in, " + fmt(x.useful) + " answered in time, " + fmt(x.line) + " waiting.", tone: "warn" });
      }
      if (x.health === "failing health checks" && (!p || p.health !== "failing health checks")) {
        out.push({ text: hm(k) + " region " + n + "'s health checks fail: each check waits behind requests already given up. " + fmt(x.useful) + " answered in time.", tone: "bad" });
      }
      if (x.away > 0 && (!p || p.away === 0)) {
        out.push({ text: hm(k) + " region " + n + " at its maximum level: " + fmt(x.useful) + " answered, " + fmt(x.away) + " turned away at once.", tone: "warn" });
      }
      if (x.health === "healthy" && p && p.health === "failing health checks") {
        out.push({ text: hm(k) + " region " + n + " healthy again: its line is empty.", tone: "ok" });
      }
    });
    if (k === MINUTES - 1) {
      out.push({ text: hm(k) + " Totals since 02:00: " + fmt(r.tot.useful) + " answered in time, " + fmt(r.tot.timedOut) + " timed out, " +
        fmt(r.tot.away) + " turned away. Handhelds: " + fmt(r.tot.paid) + " paid, " + fmt(r.tot.noAns) + " " + noWord(C) + ". Region B: " + r.B.health + ".",
        tone: r.tot.timedOut ? "bad" : "ok" });
    }
    return out;
  }

  function runMinute(api, rows, withSummary) {
    var S = api.state;
    var r = rows[S.m];
    if (withSummary) {
      api.log(hm(r.i) + " A: " + (r.down ? "down, " + fmt(r.A.inn) + " in, all timed out" : fmt(r.A.inn) + " in, " + fmt(r.A.useful) + " answered") +
        ". B: " + fmt(r.B.inn) + " in, " + fmt(r.B.useful) + " answered in time, " + fmt(r.B.line) + " waiting" +
        (r.B.away ? ", " + fmt(r.B.away) + " turned away" : "") + ".", r.B.timedOut || r.A.timedOut ? "bad" : "");
    }
    events(S.C, rows, S.m, S.failAt).forEach(function (e) { api.log(e.text, e.tone); });
    S.m += 1;
  }

  function step(api) {
    var S = api.state;
    if (S.m >= MINUTES) { api.log("Already at 02:20. Replay the night, or reset.", ""); return; }
    runMinute(api, night(S.C, S.failAt), true);
    draw(api);
  }

  function play(api) {
    var S = api.state;
    if (S.m >= MINUTES) { api.log("Already at 02:20. Replay the night, or reset.", ""); return; }
    var rows = night(S.C, S.failAt);
    while (S.m < MINUTES) runMinute(api, rows, false);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e18", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = {};
      Object.keys(BUILT).forEach(function (k) { S.C[k] = BUILT[k]; });
      S.m = 0;
      S.failAt = null;
      S.ui = buildWidget(api);

      Object.keys(OPTS).forEach(function (key) {
        api.control.select(key, LABELS[key], OPTS[key], BUILT[key], function (v) {
          var o = pick(OPTS[key], v);
          if (!o) return;
          S.C[key] = String(o.value);
          S.m = 0;
          S.failAt = null;
          api.log(LABELS[key] + ": " + o.label + ". Set back to 02:00, region A not failed yet.", "");
          draw(api);
        });
      });
      api.control.button("step", "Next minute", function () { step(api); });
      api.control.button("fail", "Fail region A now", function () {
        if (S.failAt !== null) { api.log("Region A has already failed at " + hm(S.failAt) + ".", ""); return; }
        if (S.m >= MINUTES) { api.log("Already at 02:20. Reset, then fail region A during the night.", ""); return; }
        S.failAt = S.m;
        api.log("Game day: region A will fail at " + hm(S.m) + ", the next minute played.", "warn");
        draw(api);
      });
      api.control.button("night", "Replay the night (A fails at 02:10)", function () {
        S.m = 0;
        S.failAt = STORY_FAIL;
        api.log("Replaying 02:00 to 02:19 with region A failing at 02:10.", "");
        play(api);
      });
      api.control.button("run", "Play to 02:20", function () { play(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time", ""),
        status: api.stat("status", "status page", ""),
        aHealth: api.stat("aHealth", "region A", ""),
        bMachines: api.stat("bMachines", "region B machines", ""),
        bIn: api.stat("bIn", "region B: in this minute", ""),
        bServed: api.stat("bServed", "region B: answered in time", "ok"),
        bQueued: api.stat("bQueued", "region B: waiting", "warn"),
        bTimedOut: api.stat("bTimedOut", "region B: timed out", "bad"),
        bAway: api.stat("bAway", "region B: turned away", "warn"),
        bBusy: api.stat("bBusy", "region B busy", ""),
        bHealth: api.stat("bHealth", "region B health", ""),
        handheld: api.stat("handheld", "handheld checks this minute", ""),
        totTimedOut: api.stat("totTimedOut", "timed out since 02:00", "bad"),
        totAway: api.stat("totAway", "turned away since 02:00", "warn")
      };

      api.info("<strong>How to read it.</strong> Each row is one region. \"in\" is requests arriving this minute; \"answered in time\" were answered in the minute they came; \"waiting\" is the line left at the minute's end, all of it already given up by phones and handhelds (timed out), though machines will still spend turns on it. \"turned away\" got an instant busy answer. The status page shows each region's share of the traffic, not its health. Press Fail region A now during the night for your own game day.");

      api.log("Sunday 11 October 2026, 02:00, as built: both regions live, 4 machines each (400 a minute), 600 a minute at the Saturday peak, 300 in each region.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      function as(set) { Object.keys(BUILT).forEach(function (k) { t.set(k, set && set.hasOwnProperty(k) ? set[k] : BUILT[k]); }); }
      function replay(set) { as(set); begin(); t.click("night"); }
      function stepTo(n) { for (var i = 0; i < n; i++) t.click("step"); }

      // 1. Opening state: 02:00, before the first minute is played.
      t.expect(t.stat("time") === "02:00 (not played)" && t.stat("status") === "Region A: serving 50%. Region B: serving 50%" &&
        t.stat("bMachines") === 4 && t.stat("bIn") === 0 && t.stat("bHealth") === "healthy" && t.stat("totTimedOut") === 0 &&
        has("02:00, as built: both regions live, 4 machines each (400 a minute)"),
        "Opens at 02:00 as built: 4 machines a region, 300 a minute each, nothing played");

      // 2. The night up to 02:09: 300 in each region, 75% busy. Then the game day: fail region A at 02:10.
      begin();
      stepTo(10);
      var s1 = t.stat("time") === "02:09" && t.stat("bIn") === 300 && t.stat("bServed") === 300 && t.stat("bBusy") === "75%" &&
        has("02:09 A: 300 in, 300 answered. B: 300 in, 300 answered in time, 0 waiting.");
      t.click("fail");
      stepTo(1);
      t.expect(s1 && t.stat("aHealth") === "down" && t.stat("bIn") === 300 && t.stat("status") === "Region A: down. Region B: serving 50%" &&
        has("02:10 A: down, 300 in, all timed out.") && has("02:10 region A fails."),
        "02:09: 300 a region at 75% busy; 02:10: region A fails and its 300 time out while phones keep the old DNS answer");

      // 3. 02:11 and 02:12: B overloaded, then its health checks fail.
      begin();
      stepTo(1);
      var s2 = t.stat("bIn") === 600 && t.stat("bServed") === 400 && t.stat("bQueued") === 200 && t.stat("bHealth") === "overloaded" &&
        has("02:11 region B overloaded: 600 in, 400 answered in time, 200 waiting.");
      stepTo(1);
      t.expect(s2 && t.stat("bServed") === 200 && t.stat("bQueued") === 400 && t.stat("bHealth") === "failing health checks" &&
        t.stat("status") === "Region A: down. Region B: serving 100%" && has("02:12 region B's health checks fail"),
        "02:11: 600 reach B's 400, 200 wait; 02:12: B's health checks fail, 200 answered in time, and the status page says serving 100%");

      // 4. From 02:13 nothing is answered in time and every handheld check shows unpaid.
      stepTo(1);
      var s3 = t.stat("bServed") === 0 && t.stat("handheld") === "paid 0, unpaid 60";
      begin();
      t.click("run");
      t.expect(s3 && t.stat("bQueued") === "1,800" &&
        has("02:19 Totals since 02:00: 6,900 answered in time, 5,100 timed out, 0 turned away.") && has("Region B: failing health checks."),
        "As built: from 02:13 every check shows unpaid; by 02:19 1,800 wait and 5,100 have timed out");

      // 5. The April drill's load: 120 a minute passes.
      replay({ load: "120" });
      t.expect(t.stat("bIn") === 120 && t.stat("bBusy") === "30%" && t.stat("bHealth") === "healthy" &&
        has("Totals since 02:00: 2,340 answered in time, 60 timed out, 0 turned away.") && has("Region B: healthy."),
        "The drill at 120 a minute: B takes all 120 on 4 machines, 30% busy, healthy");

      // 6. 8 machines a region: B carries 600 at 75%.
      replay({ machines: "8" });
      t.expect(t.stat("bIn") === 600 && t.stat("bServed") === 600 && t.stat("bBusy") === "75%" && t.stat("bHealth") === "healthy" &&
        has("Totals since 02:00: 11,700 answered in time, 300 timed out, 0 turned away."),
        "8 machines a region: B answers all 600 at 75% busy; only A's 300 at 02:10 time out");

      // 7. The maximum level with 4 machines: B healthy, 400 answered, 200 turned away; the handheld says cannot check.
      replay({ level: "on", noanswer: "cannot" });
      t.expect(t.stat("bServed") === 400 && t.stat("bAway") === 200 && t.stat("bHealth") === "healthy" && t.stat("bQueued") === 0 &&
        t.stat("handheld") === "paid 40, cannot check 20" && has("02:11 region B at its maximum level: 400 answered, 200 turned away at once."),
        "Maximum level on 4 machines: B stays healthy, answers 400, turns 200 away; handhelds show cannot check, never unpaid");

      // 8. Split 70/30: B still takes 100% when A fails; with 4 machines A is overloaded before anything fails.
      replay({ split: "70", machines: "8" });
      var p1 = t.stat("status") === "Region A: down. Region B: serving 100%" && t.stat("bIn") === 600;
      replay({ split: "70" });
      t.expect(p1 && has("02:00 region A overloaded: 420 in, 400 answered in time, 20 waiting."),
        "70/30: after A fails B serves 100% (600); with 4 machines A's 420 overload it from 02:00");

      // 9. DNS answer kept 5 seconds: the same overload a minute sooner.
      replay({ ttl: "5" });
      t.expect(has("02:10 region B overloaded: 600 in, 400 answered in time, 200 waiting.") && has("02:11 region B's health checks fail") &&
        t.stat("bServed") === 0,
        "DNS answer kept 5 seconds: B overloaded at 02:10 and failing at 02:11, a minute sooner");

      // 10. Handheld retries: more load on B, still nothing answered.
      replay({ retries: "3" });
      t.expect(t.stat("bIn") === 780 && t.stat("bServed") === 0 && t.stat("bQueued") === "3,195" && t.stat("handheld") === "paid 0, unpaid 60" &&
        has("02:11 region B overloaded: 690 in, 400 answered in time, 290 waiting."),
        "Retries: B gets 690 at 02:11 and 780 a minute from 02:14 (600 plus 180 retries), its line reaches 3,195, every car still unpaid");

      // 11. One live region with a standby of 2 growing to 8: minutes of failures, then healthy.
      replay({ design: "standby" });
      t.expect(t.stat("bMachines") === 8 && t.stat("bServed") === 600 && t.stat("bHealth") === "healthy" &&
        has("02:12 the standby has 6 machines.") && has("02:14 region B healthy again: its line is empty.") &&
        has("Totals since 02:00: 11,000 answered in time, 1,000 timed out, 0 turned away."),
        "Standby: 2 machines growing to 8 by 02:13; 1,000 time out on the way, healthy from 02:14");

      // 12. Gradual move in a real fault: the drivers not yet moved time out at dead A.
      replay({ shift: "gradual", machines: "8" });
      t.expect(has("Totals since 02:00: 11,400 answered in time, 600 timed out, 0 turned away.") && t.stat("bIn") === 600,
        "Gradual move after a real fault: 600 time out at dead A instead of 300; gradual suits a planned move, not a sudden one");
    }
  });
})();
