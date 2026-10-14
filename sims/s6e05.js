/* sims/s6e05-v1.0.0.js  (published as sims/s6e05.js)
   Case s6e05 "Three Pillars": a dashboard lab for the night security desk at Larkhollow House, an
   office building of 40 offices. Every badge tap asks the badge server; staff and visitor badges are
   checked against the building's own list, and the cleaning crew's contractor badges against
   Sheencroft's register. Tonight the register's trial account has ended, and from 00:00 it answers
   every check at once with "payment required". The learner picks the register's behaviour, which
   signals the dashboard draws, the alert rule, a split of answer speed into yes and no, and full
   detail in the badge log, then runs the night one minute per tick from 22:00 to 05:00 and can trace
   one side-door tap step by step.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: register normal or payment required from 00:00; signals
     traffic, average speed, error rate, good entries; alert rules average over 2 s for 5 minutes
     (as built), average over 1 s for 5 minutes, CPU over 80%, a door group's good entries at zero
     for 5 minutes; speed split into yes and no; full detail in the badge log; trace the latest
     side-door tap. Stats: time, taps last minute, average answer last minute, night average from
     00:00, split, error rate last minute, refusals, CPU last minute, alerts fired, first alert,
     offices cleaned, night report. selfTest: 11 assertions.

   The model (stated in sim.lede and the post):
   - One tick is one minute, from 22:00 (tick 0) to 05:00 (tick 420). Nothing has run when the sim
     opens. 00:00 is tick 120.
   - Staff taps at the front door: 4 a minute before 00:00 (at :02, :17, :32, :47 seconds), 1 a
     minute from 00:00 (at :02). Checked against the building's list: yes in 50 ms.
   - The crew: 8 cleaners, 40 offices, 5 each. Cleaner i (0 to 7) arrives at 00:0i at the side
     doors (even i east, odd i west). A good entry starts the shift: the cleaner taps into office k
     (k = 0 to 4) at start + 1 + 50k minutes, cleans it for 50 minutes, and taps out at start + 251.
     Contractor badges ask Sheencroft's register: normal, yes in 600 ms; payment required, refused
     in 40 ms. The badge server's own work is under 1 ms, so the register step is the whole answer.
   - A refused cleaner waits outside and taps twice a minute (at 10 + i and 40 + i seconds). Anyone
     still outside at 00:40 goes home (last taps in the minute 00:39).
   - Alerts are checked at the end of each minute. Average rules: 5 minutes running, each with taps,
     each with its average over the limit. CPU rule: the minute's CPU over 80%. Good-entries rule:
     5 minutes running in which a door group (front, or side) had taps and none of them opened.
     CPU is 3% plus 0.2% per tap that minute.
   - When an alert fires, Temperance goes round and lets every waiting cleaner in with a visitor
     badge 10 minutes later (checked against the building's list, yes in 50 ms); cleaners who
     arrive after that are let in on arrival.
   - Night report at 05:00: the average answer time of every tap from 00:00. Every answer before
     tonight took 50 ms or more, so a night under 50 ms is the fastest on record.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e05-v1.0.0.json):
   - Before 00:00: 4 taps a minute, average 50 ms, CPU 3.8%, no refusals.
   - Tonight (payment required, alert as built): refusals 2 x sum(40 - i) = 2 x 292 = 584, from
     00:00:10 to 00:39:47. 00:07 to 00:39: 17 taps a minute (16 refused + 1 staff), average
     (16 x 40 + 50) / 17 = 41 ms, error rate 16 / 17 = 94%, CPU 6.4%. Night average 00:00 to 05:00:
     (300 x 50 + 584 x 40) / 884 = 43 ms, fastest on record. No alert. 0 of 40 offices cleaned.
     Split: yes 50 ms, no 40 ms. The trace: register 40 ms, payment required.
   - A normal night: 56 contractor taps at 600 ms and 300 staff taps at 50 ms: 48,600 / 356 =
     137 ms, an ordinary night; 40 of 40 cleaned, no refusal.
   - Option 0 (average over 1 s): no alert, 0 cleaned. Option 1 (full detail): 584 detailed
     refusal lines, no alert, 0 cleaned. Option 2 (CPU over 80%): CPU peaks at 6.4%, no alert,
     0 cleaned. Option 3 (good entries at zero): alert at 00:05 (side doors 00:00 to 00:04), crew in
     at 00:15, refusals 2 x sum(15 - i) = 184, 40 of 40 cleaned (last out 04:26), night average
     (300 x 50 + 184 x 40 + 48 x 50) / 532 = 47 ms.
*/
(function () {
  "use strict";

  var MID = 120;          // 00:00
  var END = 420;          // 05:00
  var CREW = 8;
  var PER = 5;            // offices per cleaner
  var CLEAN = 50;         // minutes per office
  var GIVE_UP = MID + 40; // 00:40
  var LET_IN = 10;        // minutes from an alert to the crew being let in
  var STAFF_MS = 50;
  var YES_MS = 600;
  var NO_MS = 40;
  var RECORD = 50;        // no earlier night could average under 50 ms

  var RULES = [
    { value: "avg2", label: "Average over 2 s for 5 minutes (as built)" },
    { value: "avg1", label: "Average over 1 s for 5 minutes" },
    { value: "cpu80", label: "CPU over 80%" },
    { value: "good0", label: "A door's good entries at zero for 5 minutes" }
  ];
  var SIGNALS = [
    { id: "traffic", label: "taps a minute", on: true },
    { id: "speed", label: "average answer, ms", on: true },
    { id: "errors", label: "error rate, %", on: false },
    { id: "good", label: "good entries a minute", on: false }
  ];

  function two(n) { return n < 10 ? "0" + n : String(n); }
  function hm(m) { var x = (22 * 60 + m) % 1440; return two(Math.floor(x / 60)) + ":" + two(x % 60); }
  function hms(m, s) { return hm(m) + ":" + two(s); }
  function ms(x) { return Math.round(x) + " ms"; }

  /* ---------- the model ---------- */

  function newNight(C) {
    var cl = [];
    for (var i = 0; i < CREW; i++) cl.push({ i: i, st: "home", start: -1, badge: "contractor" });
    return {
      C: C, t: 0, cl: cl, M: [], refused: 0, lastRef: null, alerts: [], alertOn: false, letIn: -1,
      cleaned: 0, trace: null, cpuPeak: 0, events: [],
      night: { n: 0, sum: 0, nYes: 0, sumYes: 0, nNo: 0, sumNo: 0 }
    };
  }

  function note(N, m, txt, tone) { N.events.push({ txt: hm(m) + " " + txt, tone: tone || "" }); }

  function tap(N, A, m, sec, door, group, type) {
    var ok = true;
    var reg = "-";
    var took = STAFF_MS;
    if (type === "contractor") {
      if (N.C.register === "normal") { reg = "yes"; took = YES_MS; }
      else { reg = "payment required"; took = NO_MS; ok = false; }
      N.trace = { at: hms(m, sec), door: door, reg: reg, took: took, ok: ok };
    }
    A.taps += 1;
    A.sum += took;
    if (ok) A.good += 1; else A.bad += 1;
    A[group + "Taps"] += 1;
    if (ok) A[group + "Good"] += 1;
    if (m >= MID) {
      var g = N.night;
      g.n += 1; g.sum += took;
      if (ok) { g.nYes += 1; g.sumYes += took; } else { g.nNo += 1; g.sumNo += took; }
    }
    if (!ok) { N.refused += 1; N.lastRef = hms(m, sec); }
    return ok;
  }

  function startWork(N, c, m, badge) { c.st = "in"; c.start = m; c.badge = badge; }

  function ruleHolds(N, m) {
    var C = N.C;
    var k;
    if (C.rule === "cpu80") return N.M[m].cpu > 80;
    if (m < 4) return false;
    if (C.rule === "avg2" || C.rule === "avg1") {
      var lim = C.rule === "avg2" ? 2000 : 1000;
      for (k = m - 4; k <= m; k++) if (!N.M[k].taps || N.M[k].sum / N.M[k].taps <= lim) return false;
      return true;
    }
    return ["front", "side"].some(function (g) {
      for (k = m - 4; k <= m; k++) if (!N.M[k][g + "Taps"] || N.M[k][g + "Good"]) return false;
      return true;
    });
  }

  function step(N) {
    var m = N.t;
    var A = { taps: 0, good: 0, bad: 0, sum: 0, frontTaps: 0, frontGood: 0, sideTaps: 0, sideGood: 0, cpu: 0 };
    N.M[m] = A;
    (m < MID ? [2, 17, 32, 47] : [2]).forEach(function (s) { tap(N, A, m, s, "front", "front", "staff"); });
    var guardIn = N.letIn >= 0 && m >= N.letIn;
    if (guardIn && m === N.letIn) {
      var waiting = N.cl.filter(function (c) { return c.st === "outside"; });
      waiting.forEach(function (c) { startWork(N, c, m, "visitor"); });
      if (waiting.length) note(N, m, "Temperance lets " + waiting.length + " waiting cleaners in with visitor badges.", "ok");
    }
    N.cl.forEach(function (c) {
      var door = c.i % 2 ? "side west" : "side east";
      if (c.st === "home" && m === MID + c.i) {
        if (guardIn) { startWork(N, c, m, "visitor"); return; }
        if (N.C.register === "normal") { tap(N, A, m, 10 + c.i, door, "side", "contractor"); startWork(N, c, m, "contractor"); return; }
        c.st = "outside";
      }
      if (c.st === "outside") {
        if (m >= GIVE_UP) { c.st = "gone"; note(N, m, "cleaner " + (c.i + 1) + " goes home.", "bad"); return; }
        tap(N, A, m, 10 + c.i, door, "side", "contractor");
        tap(N, A, m, 40 + c.i, door, "side", "contractor");
        return;
      }
      if (c.st !== "in") return;
      var rel = m - c.start;
      for (var k = 0; k < PER; k++) {
        if (rel === 1 + CLEAN * k) tap(N, A, m, 10 + c.i, "office " + (c.i * PER + k + 1), "side", c.badge);
        if (rel === 1 + CLEAN * (k + 1)) N.cleaned += 1;
      }
      if (rel === 1 + CLEAN * PER) { tap(N, A, m, 40 + c.i, door, "side", c.badge); c.st = "done"; }
    });
    A.cpu = Math.round((3 + 0.2 * A.taps) * 10) / 10;
    if (A.cpu > N.cpuPeak) N.cpuPeak = A.cpu;
    var hold = ruleHolds(N, m);
    if (hold && !N.alertOn) {
      N.alerts.push(m + 1);
      note(N, m + 1, "ALERT: " + RULES.filter(function (r) { return r.value === N.C.rule; })[0].label.replace(" (as built)", "") + ".", "warn");
      if (N.letIn < 0 && N.cl.some(function (c) { return c.st === "home" || c.st === "outside"; })) N.letIn = m + 1 + LET_IN;
    }
    N.alertOn = hold;
    N.t = m + 1;
  }

  function nightAvg(N) { return N.night.n ? N.night.sum / N.night.n : 0; }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";

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
    var svg = doc.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 640 240");
    svg.setAttribute("width", "100%");
    svg.setAttribute("class", "dg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "The desk's dashboard: one strip for each signal switched on, 22:00 to 05:00, each scaled to its own highest value. A dashed line marks 00:00.");
    var trace = el("p", "margin:0;font-size:12px;");
    var crew = el("p", "margin:0;font-size:12px;");
    [head, svg, trace, crew].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { doc: doc, head: head, svg: svg, trace: trace, crew: crew };
  }

  function svgEl(ui, tag, attrs, text) {
    var e = ui.doc.createElementNS(SVGNS, tag);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, String(attrs[k])); });
    if (text) e.textContent = text;
    ui.svg.appendChild(e);
    return e;
  }

  function value(A, id) {
    if (!A || !A.taps) return 0;
    if (id === "traffic") return A.taps;
    if (id === "speed") return A.sum / A.taps;
    if (id === "errors") return 100 * A.bad / A.taps;
    return A.good;
  }

  function drawChart(S) {
    var ui = S.ui;
    var N = S.N;
    while (ui.svg.firstChild) ui.svg.removeChild(ui.svg.firstChild);
    var on = SIGNALS.filter(function (g) { return S.sig[g.id]; });
    var x0 = 150;
    var w = 470;
    var xm = x0 + MID * w / END;
    svgEl(ui, "line", { x1: xm, y1: 4, x2: xm, y2: 236, "class": "dg-axis", "stroke-dasharray": "4 3" });
    if (!on.length) svgEl(ui, "text", { x: 320, y: 120, "class": "dg-note", "text-anchor": "middle" }, "No signals on the dashboard.");
    on.forEach(function (g, r) {
      var y0 = 10 + r * 56;
      var max = 1;
      var k;
      for (k = 0; k < N.t; k++) max = Math.max(max, value(N.M[k], g.id));
      var pts = [];
      for (k = 0; k < N.t; k++) pts.push((x0 + (k + 0.5) * w / END).toFixed(1) + "," + (y0 + 44 - 40 * value(N.M[k], g.id) / max).toFixed(1));
      svgEl(ui, "text", { x: 4, y: y0 + 20, "class": "dg-sub" }, g.label);
      var last = N.t ? value(N.M[N.t - 1], g.id) : 0;
      svgEl(ui, "text", { x: 4, y: y0 + 36, "class": "dg-meta" }, "now " + (Math.round(last * 10) / 10) + ", top " + (Math.round(max * 10) / 10));
      svgEl(ui, "line", { x1: x0, y1: y0 + 44, x2: x0 + w, y2: y0 + 44, "class": "dg-axis" });
      if (pts.length > 1) svgEl(ui, "polyline", { points: pts.join(" "), fill: "none", stroke: "currentColor", "stroke-width": 1.5 });
    });
  }

  function draw(api) {
    var S = api.state;
    var N = S.N;
    var C = N.C;
    var A = N.t ? N.M[N.t - 1] : null;
    var ui = S.ui;
    ui.head.textContent = hm(N.t) + ". Register: " + (C.register === "normal" ? "normal (yes in 600 ms)" : "payment required from 00:00 (refused in 40 ms)") +
      ". Alert rule: " + RULES.filter(function (r) { return r.value === C.rule; })[0].label + "." + (C.detail ? " Full detail in the badge log." : "");
    drawChart(S);
    var tr = N.trace;
    ui.trace.textContent = tr ? "Trace of the latest side-door contractor tap, " + tr.at + ", " + tr.door + ": 1. door reader sends the badge to the badge server. 2. badge server reads the badge type, under 1 ms. 3. Sheencroft register " +
      tr.took + " ms: " + tr.reg + ". 4. door " + (tr.ok ? "opens" : "refused") + ". Whole tap: " + tr.took + " ms." : "Trace: no contractor tap yet.";
    ui.crew.textContent = "Crew: " + N.cl.map(function (c) {
      var st = { home: "not here yet", outside: "outside, tapping", "in": "inside (" + c.badge + " badge)", gone: "gone home", done: "finished" }[c.st];
      return "cleaner " + (c.i + 1) + " " + st;
    }).join("; ") + ". Offices cleaned: " + N.cleaned + " of " + CREW * PER + ".";
    S.stat.time(hm(N.t));
    S.stat.traffic(A ? A.taps : 0);
    S.stat.avg(A && A.taps ? ms(A.sum / A.taps) : "no taps");
    S.stat.night(N.night.n ? ms(nightAvg(N)) : "from 00:00");
    var g = N.night;
    S.stat.split(S.split ? (g.nYes ? "yes " + ms(g.sumYes / g.nYes) : "yes none") + ", " + (g.nNo ? "no " + ms(g.sumNo / g.nNo) : "no none") : "off");
    S.stat.errors(A && A.taps ? Math.round(100 * A.bad / A.taps) + "%" : "no taps");
    S.stat.refused(N.refused);
    S.stat.cpu((A ? A.cpu : 0) + "%");
    S.stat.alerts(N.alerts.length);
    S.stat.first(N.alerts.length ? hm(N.alerts[0]) : "none");
    S.stat.cleaned(N.cleaned + " of " + CREW * PER);
    S.stat.report(N.t < END ? "at 05:00" : ms(nightAvg(N)) + (nightAvg(N) < RECORD ? ", fastest on record" : ", an ordinary night"));
    ["ten", "hour", "all"].forEach(function (id) { S.ctl[id].disable(N.t >= END); });
  }

  function run(api, mins) {
    var S = api.state;
    var N = S.N;
    var from = N.events.length;
    var r0 = N.refused;
    var t0 = N.t;
    var stop = Math.min(END, N.t + mins);
    while (N.t < stop) step(N);
    var nr = N.refused - r0;
    var s = hm(t0) + " to " + hm(N.t) + ": " + (nr ? nr + " side-door refusals, register said payment required" : "no refusals");
    if (nr && N.C.detail) s += " (" + nr + " detailed lines in the badge log, each with the register's full answer; nobody reads them at night)";
    s += ".";
    var evs = N.events.slice(from);
    if (evs.length) s += " " + evs.map(function (e) { return e.txt; }).join(" ");
    if (N.t >= END) s += " 05:00 night report: average " + ms(nightAvg(N)) + (nightAvg(N) < RECORD ? ", the fastest night on record" : "") +
      ". Alerts: " + N.alerts.length + ". Offices cleaned: " + N.cleaned + " of " + CREW * PER + ". Highest CPU: " + N.cpuPeak + "%.";
    api.log(s, evs.some(function (e) { return e.tone === "warn"; }) ? "warn" : (nr ? "bad" : "ok"));
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    S.N = newNight(S.C);
    api.log((why ? why + " " : "") + "22:00, before the first tap. " + CREW + " cleaners due from 00:00, " + CREW * PER + " offices to clean.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { register: "payment", rule: "avg2", detail: false };
      S.sig = {};
      SIGNALS.forEach(function (g) { S.sig[g.id] = g.on; });
      S.split = false;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.register = api.control.select("register", "Sheencroft register", [
        { value: "payment", label: "Payment required from 00:00 (tonight)" },
        { value: "normal", label: "Normal: yes in 600 ms (earlier nights)" }
      ], "payment", function (v) { S.C.register = String(v); restart(api, "Register changed."); });
      S.ctl.rule = api.control.select("rule", "Alert rule", RULES, "avg2", function (v) { S.C.rule = String(v); restart(api, "Alert rule changed."); });
      SIGNALS.forEach(function (g) {
        S.ctl[g.id] = api.control.toggle(g.id, "Dashboard shows " + g.label, g.on, function (on) { S.sig[g.id] = !!on; draw(api); });
      });
      S.ctl.split = api.control.toggle("split", "Split answer speed: yes and no apart", false, function (on) { S.split = !!on; draw(api); });
      S.ctl.detail = api.control.toggle("detail", "Full detail in the badge log", false, function (on) { S.C.detail = !!on; restart(api, "Log detail changed."); });
      S.ctl.trace = api.control.button("trace", "Trace the latest side-door tap", function () {
        var tr = S.N.trace;
        api.log(tr ? "Trace " + tr.at + " " + tr.door + ": badge server under 1 ms; Sheencroft register " + tr.took + " ms: " + tr.reg + "; door " + (tr.ok ? "opens" : "refused") + "." : "No contractor tap to trace yet.", tr && !tr.ok ? "bad" : "");
      });
      S.ctl.again = api.control.button("new", "Start the night again", function () { restart(api, "New night."); });
      S.ctl.ten = api.control.button("ten", "Next 10 minutes", function () { run(api, 10); });
      S.ctl.hour = api.control.button("hour", "Next hour", function () { run(api, 60); });
      S.ctl.all = api.control.button("all", "Run to 05:00", function () { run(api, END); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        time: api.stat("time", "time", ""),
        traffic: api.stat("traffic", "taps last minute", ""),
        avg: api.stat("avg", "average answer, last minute", ""),
        night: api.stat("night", "night average from 00:00", ""),
        split: api.stat("split", "night speed, yes and no apart", ""),
        errors: api.stat("errors", "error rate, last minute", "bad"),
        refused: api.stat("refused", "side-door refusals", "bad"),
        cpu: api.stat("cpu", "badge server CPU, last minute", ""),
        alerts: api.stat("alerts", "alerts fired", "warn"),
        first: api.stat("first", "first alert", ""),
        cleaned: api.stat("cleaned", "offices cleaned", "ok"),
        report: api.stat("report", "night report", "")
      };
      api.info("<strong>How to read it.</strong> Each strip is one signal on the desk's dashboard, one point per minute from 22:00 to 05:00. Staff tap the front door; the 8 cleaners use the side doors, and their badges ask Sheencroft's register. A refused cleaner taps again twice a minute and goes home at 00:40. When an alert fires, Temperance lets waiting cleaners in with visitor badges 10 minutes later.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function N() { return t.api.state.N; }

      // 1. Opens at 22:00, before the first tap.
      t.expect(t.stat("time") === "22:00" && t.stat("refused") === 0 && t.stat("alerts") === 0 && t.stat("cleaned") === "0 of 40" &&
        t.stat("night") === "from 00:00" && t.stat("report") === "at 05:00" && N().t === 0,
        "Opens at 22:00: nothing run, no refusals, 0 of 40 offices cleaned");

      // 2. Before midnight: 4 staff taps a minute, 50 ms, CPU 3.8%.
      t.click("hour");
      t.click("hour");
      t.expect(t.stat("time") === "00:00" && t.stat("traffic") === 4 && t.stat("avg") === "50 ms" && t.stat("cpu") === "3.8%" && t.stat("refused") === 0,
        "22:00 to 00:00: 4 taps a minute, average 50 ms, CPU 3.8%, no refusals");

      // 3. 00:20: 17 taps a minute, 41 ms, 94% refused, CPU 6.4%.
      t.click("ten");
      t.click("ten");
      t.expect(t.stat("time") === "00:20" && t.stat("traffic") === 17 && t.stat("avg") === "41 ms" && t.stat("errors") === "94%" &&
        t.stat("cpu") === "6.4%" && t.stat("refused") === 264 && t.stat("alerts") === 0,
        "00:20: traffic 17 a minute, average 41 ms, error rate 94%, CPU 6.4%, 264 refusals, no alert");

      // 4. The record: fastest night, no alert, nothing cleaned.
      t.click("all");
      t.expect(t.stat("refused") === 584 && N().lastRef === "00:39:47" && t.stat("night") === "43 ms" &&
        t.stat("report") === "43 ms, fastest on record" && t.stat("alerts") === 0 && t.stat("cleaned") === "0 of 40",
        "As built: 584 refusals to 00:39:47, night average 43 ms, fastest on record, no alert, 0 of 40 cleaned");

      // 5. Speed split: yes 50 ms, no 40 ms; the trace shows the 40 ms register step.
      t.set("split", true);
      t.click("trace");
      t.expect(t.stat("split") === "yes 50 ms, no 40 ms" && t.logText().indexOf("Sheencroft register 40 ms: payment required; door refused") >= 0,
        "Split: yes 50 ms, no 40 ms; the trace shows the register step at 40 ms, payment required");

      // 6. Earlier nights: register normal.
      t.set("register", "normal");
      t.click("all");
      t.click("trace");
      t.expect(t.stat("refused") === 0 && t.stat("night") === "137 ms" && t.stat("report") === "137 ms, an ordinary night" &&
        t.stat("cleaned") === "40 of 40" && t.logText().indexOf("Sheencroft register 600 ms: yes; door opens") >= 0,
        "Register normal: no refusal, night average 137 ms, an ordinary night, 40 of 40 cleaned, register step 600 ms");
      t.set("register", "payment");

      // 7. Option 0: a 1 s speed alert never fires on fast refusals.
      t.set("rule", "avg1");
      t.click("all");
      t.expect(t.stat("alerts") === 0 && t.stat("cleaned") === "0 of 40" && t.stat("report") === "43 ms, fastest on record",
        "Average over 1 s: no alert, 0 of 40 cleaned");

      // 8. Option 1: full detail fills the log, nobody reads it.
      t.set("rule", "avg2");
      t.set("detail", true);
      t.click("all");
      t.expect(t.stat("alerts") === 0 && t.stat("cleaned") === "0 of 40" && t.logText().indexOf("584 detailed lines in the badge log") >= 0,
        "Full detail: 584 detailed lines, no alert, 0 of 40 cleaned");
      t.set("detail", false);

      // 9. Option 2: CPU never passes 6.4%.
      t.set("rule", "cpu80");
      t.click("all");
      t.expect(t.stat("alerts") === 0 && N().cpuPeak === 6.4 && t.stat("cleaned") === "0 of 40",
        "CPU over 80%: highest CPU 6.4%, no alert, 0 of 40 cleaned");

      // 10. Option 3: good entries at zero fires at 00:05.
      t.set("rule", "good0");
      t.click("all");
      t.expect(t.stat("first") === "00:05" && t.stat("alerts") === 1 && t.stat("refused") === 184 && t.stat("cleaned") === "40 of 40" &&
        t.stat("night") === "47 ms",
        "Good entries at zero: alert at 00:05, crew in at 00:15, 184 refusals, 40 of 40 cleaned, night average 47 ms");

      // 11. The same rule on an earlier night stays quiet.
      t.set("register", "normal");
      t.click("all");
      t.expect(t.stat("alerts") === 0 && t.stat("cleaned") === "40 of 40" && t.stat("refused") === 0,
        "Good-entries rule on a normal night: no alert, 40 of 40 cleaned");
    }
  });
})();
