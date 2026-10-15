/* sims/s6e19-v1.0.0.js  (published as sims/s6e19.js)
   Case s6e19 "Field Report: The Breaker at Scale": a breaker lab for Blythewick Central Kitchen, which
   makes 3,000 school lunches a night. The label printer asks the allergen service for each meal's
   allergens, one call every third of a second. Every call is wrapped the way Netflix's Hystrix
   wraps calls: a command with a timeout, 3 helpers of its own, a circuit breaker and a fallback.
   Tonight the run starts at 01:20 instead of 03:00 and meets the allergen service's nightly
   database backup, 01:30:00 to 01:36:00, which slows about 60% of answers to 2 s.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: run start 01:20 (tonight) or 03:00 (usual); slow share 60%,
     30% or 90%; slow answers take 2 s, 6 s or never come; timeout 1 s (as built), 5 s or none
     (wait for every answer); breaker with Hystrix's defaults, a stricter one, or none; fallback
     empty list (as built), last known allergens, or none (stop printing and call the cook); the
     chilli recipe changed today; game day (slow the service for the whole run). Stats: time,
     labels printed, from real answers, "allergens: none", of which while the breaker was open,
     wrong labels, labels held for the cook, breaker, times opened, printer stops, cook texted at,
     last label printed. selfTest: 11 assertions.

   The model (stated in sim.lede and the post):
   - One step is one label: the printer starts a call every third of a second, whatever the
     answer time. Label 1 is called at the run start, label 3,000 at start + 999 s 2/3. Nothing
     has run when the sim opens.
   - The run prints meal by meal, 600 of each: pasta bake (labels 1 to 600), fish pie (601 to
     1,200), egg fried rice (1,201 to 1,800), peanut satay (1,801 to 2,400), bean chilli (2,401 to
     3,000). From a 01:20:00 start the satay is called 01:30:00 to 01:33:20, the chilli 01:33:20 to
     01:36:40.
   - The allergen service answers at once, except that a call started during the backup
     (01:30:00 to 01:36:00) is slow when that step's seeded number is under the slow share. A
     slow answer takes 2 s (6 steps) as built.
   - The call's command has 3 helpers of its own (a bulkhead). With a timeout, a call that finds
     all 3 busy is turned away at once (rejected). With no timeout, the printer waits for a free
     helper before starting the next call.
   - Breaker (Hystrix defaults): counts calls that finished in the last 10 s (30 steps); before
     each call, if at least 20 finished and half or more failed (timed out or rejected), it
     opens. Open for 5 s (15 steps), every call is answered at once without asking (short
     circuit). Then half-open: the next call is a test and the rest are short-circuited until it
     ends; answered in time, the breaker closes and forgets its count; failed, open 5 s more.
   - Fallback: empty list prints "allergens: none". Last known prints the meal's allergens as
     saved at the end of the last run (the recipe as it was then). None: the label is
     held for the cook, and while the breaker is open the printer stops and texts the cook; held
     labels are asked again after the run.
   - Randomness: one api.rand() draw per step, rolled once in setup and reused by every night,
     so a smaller slow share slows a subset of the same calls.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e19-v1.0.0.json),
   default seed 7, read from this file's own model:
   - Tonight as built (01:20, 60%, 2 s, 1 s timeout, breaker, empty list): labels 1 to 1,800 all
     real by 01:30:00. Over the run 3,000 printed, 2,097 real, 903 "allergens: none" (calls
     started 01:30:00 to 01:36:00; the last timed-out ones print by 01:36:01), 629 of them while
     the breaker was open or testing (15 for each 5 s open spell, plus the calls turned away
     while a test call was out), 274 after a call timed out with the breaker closed; the breaker
     opened 39 times, the first at 01:30:08 (14 of the last 27 calls failed). The last label
     prints at 01:36:39 (label 3,000 at 01:36:39 2/3).
   - The record: label 1,802, peanut satay, printed 01:30:00, "peanuts, soya" from a real
     answer; label 1,892, peanut satay, printed 01:30:30, "allergens: none" while the breaker
     was open (open 01:30:26 to 01:30:31).
   - 03:00 start: run 03:00:00 to 03:16:39, 0 slow answers, 0 trips, 0 "allergens: none".
   - Option 0 (5 s timeout): the 3 helpers fill; 1 opening (01:34:06), 339 calls turned away,
     359 "allergens: none". With 6 s answers: 1,047 "allergens: none", 33 openings.
   - Option 1 (none: stop and call the cook): 0 "allergens: none", 0 wrong; the cook is texted at
     01:30:08; the printer stops 39 times; 274 labels held and asked again after the run; last
     label 01:41:40.
   - Option 2 (last known, saved after the last run): 0 wrong tonight; with the chilli recipe
     changed today, 404 wrong chilli labels (no sesame).
   - Option 3 (no breaker, no timeout, wait): 0 wrong, last label 01:38:34; slow answers that
     never come: 1,801 labels printed (last at 01:30:00), then the printer waits for ever.
   - Game day at 03:00 (slow share 60% all run): the breaker opens at 03:00:07.
   (The numbers above are checked by selfTest below.)
*/
(function () {
  "use strict";

  var LABELS = 3000;
  var PER_MEAL = 600;
  var STEPS_CAP = 7200;          // 40 minutes of steps, a hard stop
  var HELPERS = 3;
  var WINDOW = 30;               // 10 s
  var SLEEP = 15;                // 5 s
  var BACKUP_FROM = 5400;        // 01:30:00 in seconds of the day
  var BACKUP_TO = 5760;          // 01:36:00
  var MEALS = [
    { name: "pasta bake", real: "milk, wheat", old: "milk, wheat" },
    { name: "fish pie", real: "fish, milk", old: "fish, milk" },
    { name: "egg fried rice", real: "egg, soya", old: "egg, soya" },
    { name: "peanut satay", real: "peanuts, soya", old: "peanuts, soya" },
    { name: "bean chilli", real: "celery", old: "celery" }
  ];
  var CHILLI_NEW = "celery, sesame";

  function two(n) { return n < 10 ? "0" + n : String(n); }
  function hms(sec) {
    var s = Math.floor(sec);
    return two(Math.floor(s / 3600) % 24) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60);
  }

  /* ---------- the model ---------- */

  function newNight(C, U) {
    var known = MEALS.map(function (m) { return m.old; });
    return {
      C: C, U: U, s: 0, startSec: C.start === "0300" ? 10800 : 4800,
      next: 0, held: [], heldDone: 0, helpers: [], win: [], br: C.breaker === "off" ? "none fitted" : "closed",
      openUntil: 0, testOut: false, trips: [], stops: 0, texted: -1, paused: false,
      labels: [], known: known,
      printed: 0, real: 0, none: 0, noneOpen: 0, wrong: 0, rejected: 0, lastPrint: -1, done: false,
      events: []
    };
  }

  function timeOf(N, s) { return N.startSec + s / 3; }
  function truth(N, meal) { return meal === 4 && N.C.recipe ? CHILLI_NEW : MEALS[meal].real; }
  function note(N, s, txt, tone) { N.events.push({ txt: hms(timeOf(N, s)) + " " + txt, tone: tone || "" }); }

  function rule(C) { return C.breaker === "strict" ? { vol: 10, pct: 25 } : { vol: 20, pct: 50 }; }

  function openBr(N, s, why) {
    N.br = "open";
    N.openUntil = s + SLEEP;
    N.testOut = false;
    N.trips.push(s);
    if (N.C.fallback === "stop") {
      N.stops += 1;
      if (N.texted < 0) { N.texted = s; note(N, s, why + " Printer stopped; text sent to the cook.", "warn"); }
      else note(N, s, why + " Printer stopped.", "warn");
    } else note(N, s, why, "warn");
  }

  function print(N, s, idx, text, src) {
    var meal = Math.floor(idx / PER_MEAL);
    var lab = N.labels[idx] || { n: idx + 1, meal: meal };
    lab.at = s; lab.text = text; lab.src = src;
    N.labels[idx] = lab;
    N.printed += 1;
    N.lastPrint = s;
    if (src === "real") N.real += 1;
    if (text === "none") { N.none += 1; if (src === "open") N.noneOpen += 1; }
    if (text !== truth(N, meal)) N.wrong += 1;
  }

  function fallback(N, s, idx, src) {
    var meal = Math.floor(idx / PER_MEAL);
    var f = N.C.fallback;
    if (f === "stop") { N.held.push(idx); return; }
    print(N, s, idx, f === "last" ? N.known[meal] : "none", src);
  }

  function finish(N, s, h) {
    var C = N.C;
    if (C.breaker !== "off") N.win.push({ s: s, ok: h.ok });
    if (h.test) {
      N.testOut = false;
      if (h.ok) { N.br = "closed"; N.win = []; note(N, s, "test call answered. Breaker closed.", "ok"); }
      else openBr(N, s, "test call failed. Breaker open 5 s more.");
    }
    if (h.ok) print(N, s, h.idx, truth(N, Math.floor(h.idx / PER_MEAL)), "real");
    else fallback(N, s, h.idx, "timeout");
  }

  function nextIdx(N) {
    if (N.next < LABELS) return N.next;
    if (N.heldDone < N.held.length) return N.held[N.heldDone];
    return -1;
  }
  function take(N) { if (N.next < LABELS) N.next += 1; else N.heldDone += 1; }

  function step(N) {
    var C = N.C;
    var s = N.s;
    var tSteps = C.timeout * 3;
    var keep = [];
    N.helpers.forEach(function (h) { if (h.end <= s) finish(N, s, h); else keep.push(h); });
    N.helpers = keep;
    if (N.br === "open" && s >= N.openUntil) { N.br = "half-open"; note(N, s, "breaker half-open: the next call is a test.", ""); }
    var idx = nextIdx(N);
    if (idx >= 0 && !(C.timeout === 0 && N.helpers.length >= HELPERS)) {
      if (N.br === "closed") {
        var R = rule(C);
        var from = s - WINDOW;
        N.win = N.win.filter(function (e) { return e.s > from; });
        var bad = N.win.filter(function (e) { return !e.ok; }).length;
        if (N.win.length >= R.vol && bad * 100 >= R.pct * N.win.length) {
          openBr(N, s, "breaker opens: " + bad + " of the last " + N.win.length + " calls failed.");
        }
      }
      if (N.br === "open" || (N.br === "half-open" && N.testOut)) {
        if (C.fallback === "stop") N.paused = true;
        else { take(N); fallback(N, s, idx, "open"); }
      } else {
        N.paused = false;
        take(N);
        var test = N.br === "half-open";
        if (C.timeout > 0 && N.helpers.length >= HELPERS) {
          N.rejected += 1;
          if (C.breaker !== "off") N.win.push({ s: s, ok: false });
          if (test) openBr(N, s, "test call turned away. Breaker open 5 s more.");
          fallback(N, s, idx, "rejected");
        } else {
          var t = timeOf(N, s);
          var slow = (C.gameday || (t >= BACKUP_FROM && t < BACKUP_TO)) && N.U[s] < C.share / 100;
          var dur = slow ? (C.slow === 0 ? Infinity : C.slow * 3) : 0;
          var h = { idx: idx, test: test, ok: true, end: s + dur };
          if (C.timeout > 0 && dur > tSteps) { h.ok = false; h.end = s + tSteps; }
          if (test) N.testOut = true;
          if (h.end <= s) finish(N, s, h); else N.helpers.push(h);
        }
      }
    }
    N.s = s + 1;
    if (nextIdx(N) < 0 && N.helpers.length === 0) N.done = true;
  }

  function failedShare(N) {
    var from = N.s - 1 - WINDOW;
    var w = N.win.filter(function (e) { return e.s > from; });
    if (!w.length) return "0%";
    return Math.round(100 * w.filter(function (e) { return !e.ok; }).length / w.length) + "%";
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    var dash = el("div", "display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;font-size:11px;");
    var dep1 = el("div", "border:1px solid currentColor;border-radius:4px;padding:6px;");
    var dep2 = el("div", "border:1px solid currentColor;border-radius:4px;padding:6px;opacity:0.7;");
    dash.appendChild(dep1);
    dash.appendChild(dep2);
    var last = el("p", "margin:0;font-size:12px;font-family:monospace;white-space:pre-wrap;");
    var satay = el("p", "margin:0;font-size:12px;");
    [head, dash, last, satay].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { head: head, dep1: dep1, dep2: dep2, last: last, satay: satay };
  }

  function labelLine(N, lab) {
    return hms(timeOf(N, lab.at)) + "  #" + lab.n + "  " + MEALS[lab.meal].name + "  allergens: " + lab.text + "  (" +
      (lab.src === "real" ? "allergen service" : (lab.src === "open" ? "fallback, breaker open" : "fallback, " + lab.src)) + ")";
  }

  function draw(api) {
    var S = api.state;
    var N = S.N;
    var C = N.C;
    var ui = S.ui;
    var now = timeOf(N, N.s);
    var inB = C.gameday || (now >= BACKUP_FROM && now < BACKUP_TO);
    ui.head.textContent = hms(now) + ". Run from " + hms(N.startSec) + ". Backup " + (C.gameday ? "game day: slow all run" : "01:30:00 to 01:36:00") +
      (inB ? " (slowing " + C.share + "% of answers now)" : "") + ". Timeout " + (C.timeout ? C.timeout + " s" : "none, wait") +
      ". Breaker " + (C.breaker === "off" ? "none" : (C.breaker === "strict" ? "10 calls, 25%, 5 s" : "20 calls, 50%, 5 s")) +
      ". Fallback: " + (C.fallback === "empty" ? "empty list" : (C.fallback === "last" ? "last known" : "none, stop and call the cook")) +
      (N.paused ? ". PRINTER STOPPED, cook called." : ".");
    ui.dep1.textContent = "Allergen service. Breaker: " + N.br + ". Failed in last 10 s: " + failedShare(N) + ". Threads busy: " +
      N.helpers.length + " of " + HELPERS + ". Turned away: " + N.rejected + ". Opened " + N.trips.length + " times.";
    ui.dep2.textContent = "Menu service (the meal's name; its own command and threads). Breaker: closed. Failed in last 10 s: 0%. Not touched by the backup.";
    var recent = N.labels.filter(function (l) { return l && l.at !== undefined; }).sort(function (a, b) { return a.at - b.at; }).slice(-4);
    ui.last.textContent = recent.length ? recent.map(function (l) { return labelLine(N, l); }).join("\n") : "No labels printed yet.";
    var a = N.labels[1801];
    var b = N.labels[1891];
    ui.satay.textContent = "Satay boxes, 30 s apart: " + (a ? labelLine(N, a) : "#1802 not printed yet") + "; " + (b ? labelLine(N, b) : "#1892 not printed yet") + ".";
    S.stat.time(hms(now));
    S.stat.printed(N.printed);
    S.stat.real(N.real);
    S.stat.none(N.none);
    S.stat.open(N.noneOpen);
    S.stat.wrong(N.wrong);
    S.stat.held(N.held.length);
    S.stat.breaker(N.br);
    S.stat.trips(N.trips.length);
    S.stat.stops(N.stops);
    S.stat.texted(N.texted < 0 ? "no" : hms(timeOf(N, N.texted)));
    S.stat.last(N.lastPrint < 0 ? "none" : hms(timeOf(N, N.lastPrint)));
    var end = N.done || N.s >= STEPS_CAP;
    S.ctl.ten.disable(end);
    S.ctl.min.disable(end);
    S.ctl.all.disable(end);
  }

  function run(api, steps) {
    var S = api.state;
    var N = S.N;
    var from = N.events.length;
    var n0 = N.none;
    var t0 = timeOf(N, N.s);
    var stop = Math.min(STEPS_CAP, N.s + steps);
    while (N.s < stop && !N.done) step(N);
    var evs = N.events.slice(from);
    var made = N.none - n0;
    var msg = hms(t0) + " to " + hms(timeOf(N, N.s)) + ": " + (made ? made + " labels printed 'allergens: none'" : "no 'allergens: none' labels") + ".";
    if (evs.length) msg += " " + evs.slice(0, 6).map(function (e) { return e.txt; }).join(" ") + (evs.length > 6 ? " (and " + (evs.length - 6) + " more breaker events)" : "");
    if (N.done) msg += " Run finished: last label " + hms(timeOf(N, N.lastPrint)) + ".";
    else if (N.s >= STEPS_CAP) msg += " 40 minutes gone; the printer is still waiting.";
    api.log(msg, made ? "bad" : (evs.some(function (e) { return e.tone === "warn"; }) ? "warn" : "ok"));
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    S.N = newNight(S.C, S.U);
    api.log((why ? why + " " : "") + hms(S.N.startSec) + ", before label 1. 3,000 labels, one call every third of a second.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e19", {
    setup: function (api) {
      var S = api.state;
      var i;
      api.speed = 0;
      S.U = [];
      for (i = 0; i < STEPS_CAP; i++) S.U.push(api.rand());
      S.C = { start: "0120", share: 60, slow: 2, timeout: 1, breaker: "hystrix", fallback: "empty", recipe: false, gameday: false };
      S.ui = buildWidget(api);
      S.ctl = {};
      function opt(key, conv) { return function (v) { S.C[key] = conv(v); restart(api, "Settings changed."); }; }
      function str(v) { return String(v); }
      function bool(v) { return !!v; }
      S.ctl.start = api.control.select("start", "Run starts", [{ value: "0120", label: "01:20 (tonight)" }, { value: "0300", label: "03:00 (every other night)" }], "0120", opt("start", str));
      S.ctl.share = api.control.select("share", "Backup slows this share of answers", [{ value: 60, label: "60% (tonight)" }, { value: 30, label: "30%" }, { value: 90, label: "90%" }], 60, opt("share", Number));
      S.ctl.slow = api.control.select("slow", "A slow answer takes", [{ value: 2, label: "2 s (tonight)" }, { value: 6, label: "6 s" }, { value: 0, label: "never comes" }], 2, opt("slow", Number));
      S.ctl.timeout = api.control.select("timeout", "Timeout", [{ value: 1, label: "1 s (as built)" }, { value: 5, label: "5 s" }, { value: 0, label: "none: wait for the answer" }], 1, opt("timeout", Number));
      S.ctl.breaker = api.control.select("breaker", "Breaker", [{ value: "hystrix", label: "20 calls, 50%, open 5 s (as built)" }, { value: "strict", label: "10 calls, 25%, open 5 s" }, { value: "off", label: "none" }], "hystrix", opt("breaker", str));
      S.ctl.fallback = api.control.select("fallback", "Fallback", [{ value: "empty", label: "empty list (as built)" }, { value: "last", label: "last known (saved after the last run)" }, { value: "stop", label: "none: stop and call the cook" }], "empty", opt("fallback", str));
      S.ctl.recipe = api.control.toggle("recipe", "Chilli recipe changed today (sesame added)", false, opt("recipe", bool));
      S.ctl.gameday = api.control.toggle("gameday", "Game day: slow the service for the whole run", false, opt("gameday", bool));
      S.ctl.again = api.control.button("new", "Start the run again", function () { restart(api, "New run."); });
      S.ctl.ten = api.control.button("ten", "Next 10 seconds", function () { run(api, 30); });
      S.ctl.min = api.control.button("min", "Next minute", function () { run(api, 180); });
      S.ctl.all = api.control.button("all", "Run to the end", function () { run(api, STEPS_CAP); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        time: api.stat("time", "time", ""),
        printed: api.stat("printed", "labels printed", ""),
        real: api.stat("real", "from real answers", "ok"),
        none: api.stat("none", "printed 'allergens: none'", "bad"),
        open: api.stat("open", "of those, breaker open", "bad"),
        wrong: api.stat("wrong", "wrong labels", "bad"),
        held: api.stat("held", "held for the cook", "warn"),
        breaker: api.stat("breaker", "breaker", ""),
        trips: api.stat("trips", "times opened", "warn"),
        stops: api.stat("stops", "printer stops", "warn"),
        texted: api.stat("texted", "cook texted at", "warn"),
        last: api.stat("last", "last label printed", "")
      };
      api.info("<strong>How to read it.</strong> The printer starts one call to the allergen service every third of a second, whatever the answer time. Each call holds one of the command's 3 threads; a call that finds all 3 busy is turned away, and a timed-out or turned-away call takes the fallback. The breaker counts the last 10 s: 20 or more finished calls with half or more failed, and it opens for 5 s, then tests one call. The dashboard boxes show each service the printer calls. The last four labels and the two satay boxes are listed under them.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function N() { return t.api.state.N; }
      function lab(n) { var l = N().labels[n - 1]; return l ? hms(timeOf(N(), l.at)) + " " + l.text + " " + l.src : "none"; }

      // 1. Opens at 01:20:00, before label 1.
      t.expect(t.stat("time") === "01:20:00" && t.stat("printed") === 0 && t.stat("breaker") === "closed" && N().s === 0,
        "Opens at 01:20:00 with nothing printed and the breaker closed");

      // 2. Ten minutes in: 1,800 real labels, nothing slow yet.
      var k;
      for (k = 0; k < 10; k++) t.click("min");
      t.expect(t.stat("time") === "01:30:00" && t.stat("printed") === 1800 && t.stat("real") === 1800 && t.stat("none") === 0,
        "01:30:00: labels 1 to 1,800 printed from real answers, none from the fallback");

      // 3. Tonight as built: 903 'allergens: none', 629 while open or testing, 39 openings from 01:30:08.
      t.click("all");
      t.expect(t.stat("printed") === 3000 && t.stat("real") === 2097 && t.stat("none") === 903 && t.stat("open") === 629 &&
        t.stat("trips") === 39 && hms(timeOf(N(), N().trips[0])) === "01:30:08" && t.stat("last") === "01:36:39",
        "Tonight: 903 labels say 'allergens: none' (629 with the breaker open or testing), breaker opened 39 times from 01:30:08");

      // 4. The record: the two satay boxes, 30 s apart.
      t.expect(lab(1802) === "01:30:00 peanuts, soya real" && lab(1892) === "01:30:30 none open",
        "Satay #1802 at 01:30:00 says peanuts, soya; #1892 at 01:30:30 says allergens: none");

      // 5. Every other night: 03:00 never meets the backup.
      t.set("start", "0300");
      t.click("all");
      t.expect(t.stat("none") === 0 && t.stat("trips") === 0 && t.stat("real") === 3000 && t.stat("last") === "03:16:39",
        "03:00 start: 3,000 real labels, 0 trips, done by 03:16:40");

      // 6. Game day at 03:00: slowing the service trips the breaker.
      t.set("gameday", true);
      t.click("all");
      t.expect(t.stat("trips") > 0 && hms(timeOf(N(), N().trips[0])) === "03:00:07", "Game day at 03:00: the breaker opens at 03:00:07");
      t.set("gameday", false);
      t.set("start", "0120");

      // 7. Option 0: a 5 s timeout; the 3 helpers fill and calls are turned away.
      t.set("timeout", 5);
      t.click("all");
      var r5 = t.stat("none") === 359 && N().rejected === 339 && t.stat("trips") === 1;
      t.set("slow", 6);
      t.click("all");
      t.expect(r5 && t.stat("none") === 1047 && t.stat("trips") === 33,
        "5 s timeout: 1 opening, but 339 calls turned away and 359 'allergens: none'; with 6 s answers 1,047 and 33 openings");
      t.set("slow", 2);
      t.set("timeout", 1);

      // 8. Option 1: no fallback; stop and call the cook.
      t.set("fallback", "stop");
      t.click("all");
      t.expect(t.stat("none") === 0 && t.stat("wrong") === 0 && t.stat("stops") === 39 && t.stat("texted") === "01:30:08" &&
        t.stat("held") === 274 && t.stat("printed") === 3000 && t.stat("last") === "01:41:40",
        "Stop and call the cook: 0 wrong labels, cook texted at 01:30:08, 39 stops, 274 held, last label 01:41:40");

      // 9. Option 2: last known allergens; right tonight, wrong when a recipe changed.
      t.set("fallback", "last");
      t.click("all");
      var w0 = t.stat("wrong") === 0 && t.stat("none") === 0;
      t.set("recipe", true);
      t.click("all");
      t.expect(w0 && t.stat("wrong") === 404, "Last known: 0 wrong tonight; 404 chilli labels without sesame after a recipe change");
      t.set("recipe", false);
      t.set("fallback", "empty");

      // 10. Option 3: no breaker, no timeout, every label waits.
      t.set("breaker", "off");
      t.set("timeout", 0);
      t.click("all");
      t.expect(t.stat("wrong") === 0 && t.stat("printed") === 3000 && t.stat("last") === "01:38:34" && t.stat("breaker") === "none fitted",
        "No breaker, wait for every answer: 0 wrong, but the last label at 01:38:34");

      // 11. ...and when slow answers never come, the printer waits for ever.
      t.set("slow", 0);
      t.click("all");
      t.expect(t.stat("printed") === 1801 && !N().done && t.stat("last") === "01:30:00",
        "Answers that never come: 1,801 labels, the last at 01:30:00, then the printer waits for ever");
    }
  });
})();
