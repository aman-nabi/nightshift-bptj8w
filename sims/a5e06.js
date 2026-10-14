/* sims/a5e06-v1.0.0.js  (published as sims/a5e06.js)
   Case a5e06 "Two Doors": an A/B lab for Fernhallow's shopping assistant. For 14 planned days a coin
   sent each visitor's chats through door A (the current assistant) or door B (a warmer, more
   confident one). Every conversation ends with a thumbs up or down (no tap counts as down). The
   learner picks the last day of the plan, whether the team checks every morning and stops at the
   first p below 0.05, a refund guard-rail line, and the logged A/B test or 200 seeded A/A tests
   (both doors the same assistant). No real model: every number comes from the stated daily counts
   below, so a learner can check any day by hand. Widget-style sim: it draws its own tables in api.root.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: 14 days of stated counts per door (conversations, thumbs up,
     refunds), cumulative rates, the pooled two-proportion test, a stop rule (planned last day, daily
     checks), a refund guard rail with refunds known 7 days late, 200 seeded A/A tests, a worked day,
     and a preset for each of the four replies. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - Thumbs-up rate = thumbs up / conversations, counted from day 1 to the day looked at.
   - The test: pooled rate p = (upA + upB) / (nA + nB); SE = sqrt(p (1 - p) (1/nA + 1/nB));
     z = (rateB - rateA) / SE; p-value = 2 (1 - Phi(|z|)), Phi from erf (Abramowitz and Stegun
     7.1.26). Significant: p-value below 0.05.
   - Refund rate = refunds / conversations. Every refund for day d's conversations is known by the
     end of day d + 7, so the guard rail's first check is the end of day 8 (day 1's refunds).
   - Stop rule, for each day k from 1: if the guard rail is on and B's known refund rate is over the
     line, B is stopped; else if the team checks every morning and k's p-value is below 0.05, the
     test is called; else if k is the planned last day, the test ends and is decided by k's p-value.
   - A/A: 200 tests; for each, day by day, door A then door B, each of the logged day's conversations
     is a thumbs up when api.rand() < 0.70. All 200 are drawn once, in setup, and nothing else ever
     calls api.rand(), so the counts below repeat.

   Where every number comes from (conventions rule 14; the case is content/latent/a5/a5e06-v1.0.0.json).
   - Stated daily counts (arrays below). Each day: 1,200 conversations, about 600 a door.
   - Day 4 (the dashboard on the morning of day 5): A 1,676 of 2,400 = 69.8%, B 1,750 of 2,400 =
     72.9%, lead 3.1 points. Pooled 3,426 / 4,800 = 71.4%, SE 0.0130, z 2.36, p 0.018. Days 1 to 3:
     p 0.604, 0.374, 0.237; day 4 is the first below 0.05. Days 5 to 10 stay below (0.014 to 0.049).
   - Day 14: A 5,881 of 8,407 = 70.0%, B 5,964 of 8,393 = 71.1%, lead 1.1 points, SE 0.0070,
     z 1.57, p 0.116, not significant.
   - Novelty: B week 1 (days 1-7) 3,032 / 4,195 = 72.3%, week 2 2,932 / 4,198 = 69.8%. A week 1
     2,941 / 4,205 = 69.9%, week 2 2,940 / 4,202 = 70.0%.
   - Refunds, all 14 days: A 252 / 8,407 = 3.00%, B 378 / 8,393 = 4.50%.
   - Guard rail 3.5%: end of day 8, B's day-1 refunds 27 of 602 = 4.49%, over the line: B stopped on
     day 8. Line 4.0%: day 8 too. Line 5.0%: B's known rate stays 4.49% to 4.59%, never over.
   - After the release: 1,200 conversations a day = 8,400 a week (stated). At B's 4.50%: 378 refunds a
     week; at A's 3.00%: 252. 126 more a week.
   - Sample size, worked out before the start (stated in the post): to spot a rise from 70% to 72%
     with the usual settings (5% false alarms, 80% chance of catching a real 2-point rise),
     n = (1.96 + 0.84)^2 x (0.70 x 0.30 + 0.72 x 0.28) / 0.02^2 = 8,077 per door, 14 days at about 600.
   - A/A, 200 tests, planned last day 14: checking every morning and stopping at the first p below
     0.05, 43 of 200 find a winner (21.5%); checking once on day 14, 7 of 200 (3.5%).
   - Refunds alone: A 3.00% against B 4.50%, p below 0.001; day 14's refunds are known on day 21.
*/
(function () {
  "use strict";

  /* ---------- the story's data ---------- */

  var NA = [598, 604, 601, 597, 603, 600, 602, 599, 601, 598, 604, 600, 597, 603];
  var UA = [419, 421, 420, 416, 424, 418, 423, 420, 419, 417, 425, 421, 416, 422];
  var RA = [18, 17, 19, 18, 18, 17, 19, 18, 17, 19, 18, 18, 17, 19];
  var NB = [602, 596, 599, 603, 597, 600, 598, 601, 599, 602, 596, 600, 603, 597];
  var UB = [430, 427, 431, 462, 432, 426, 424, 419, 418, 422, 415, 420, 421, 417];
  var RB = [27, 28, 26, 27, 28, 27, 26, 27, 28, 26, 27, 27, 28, 26];
  var DAYS = 14;
  var LAG = 7;
  var WEEK_AFTER = 8400;
  var AA_RUNS = 200;
  var AA_RATE = 0.70;
  var ALPHA = 0.05;

  var MODES = [{ value: "ab", label: "A/B: the logged fortnight" }, { value: "aa", label: "A/A: 200 seeded tests, both doors the same" }];
  var GUARDS = [
    { value: "0", label: "Off" },
    { value: "3.5", label: "Stop B if its refunds pass 3.5%" },
    { value: "4", label: "Stop B if its refunds pass 4.0%" },
    { value: "5", label: "Stop B if its refunds pass 5.0%" }
  ];
  var REPLIES = [
    { value: "none", label: "None yet" },
    { value: "0", label: "Reply 1: fixed size, run to the end, refund line" },
    { value: "1", label: "Reply 2: keep B, it was significant" },
    { value: "2", label: "Reply 3: run again, checking daily" },
    { value: "3", label: "Reply 4: judge by refunds alone" }
  ];

  /* ---------- the arithmetic (pure functions the display and self-tests read) ---------- */

  function sum(a, k) { var s = 0; for (var i = 0; i < k; i++) s += a[i]; return s; }
  function sumRange(a, from, to) { var s = 0; for (var i = from; i < to; i++) s += a[i]; return s; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pct1(x) { return (Math.round(x * 1000) / 10).toFixed(1) + "%"; }
  function pct2(x) { return (Math.round(x * 10000) / 100).toFixed(2) + "%"; }
  function p3(p) { return p < 0.001 ? "below 0.001" : p.toFixed(3); }

  function erf(x) {
    var s = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }

  // The pooled two-proportion test. Returns the pooled rate, standard error, z and two-sided p.
  function test2(xa, na, xb, nb) {
    var p = (xa + xb) / (na + nb);
    var se = Math.sqrt(p * (1 - p) * (1 / na + 1 / nb));
    var z = (xb / nb - xa / na) / se;
    return { pool: p, se: se, z: z, p: 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2))) };
  }

  // Days 1 to k, counted together, as the dashboard showed them the next morning.
  function upTo(k) {
    var o = { k: k, na: sum(NA, k), nb: sum(NB, k), ua: sum(UA, k), ub: sum(UB, k), ra: sum(RA, k), rb: sum(RB, k) };
    o.rateA = o.ua / o.na;
    o.rateB = o.ub / o.nb;
    o.lead = Math.round((o.rateB - o.rateA) * 1000) / 10;
    o.t = test2(o.ua, o.na, o.ub, o.nb);
    return o;
  }

  function week(U, N, w) { return sumRange(U, 7 * w, 7 * w + 7) / sumRange(N, 7 * w, 7 * w + 7); }

  // B's refund rate as known at the end of day k: only conversations of days 1 to k - 7 are complete.
  function knownB(k) {
    var d = k - LAG;
    if (d < 1) return null;
    return { days: d, r: sum(RB, d), n: sum(NB, d), rate: sum(RB, d) / sum(NB, d) };
  }

  function guardTrip(k, line) {
    if (!line) return false;
    var kb = knownB(k);
    return !!kb && kb.rate * 100 > line;
  }

  // The stop rule. Returns { end, why, d, decision }.
  function run(C) {
    for (var k = 1; k <= C.stop; k++) {
      if (guardTrip(k, C.guard)) return finish(k, "guard");
      if (C.peek && upTo(k).t.p < ALPHA) return finish(k, "peek");
    }
    return finish(C.stop, "plan");
  }
  function finish(k, why) {
    var d = upTo(k);
    var decision;
    if (why === "guard") decision = "B stopped, keep A";
    else if (d.t.p < ALPHA) decision = d.rateB > d.rateA ? "B ships" : "A stays";
    else decision = "no clear winner, keep A";
    return { end: k, why: why, d: d, decision: decision };
  }

  function firstGuard(line) {
    for (var k = 1; k <= DAYS; k++) if (guardTrip(k, line)) return k;
    return 0;
  }

  function worked(k) {
    var d = upTo(k);
    return "Day " + k + ", days 1 to " + k + " together: A " + fmt(d.ua) + " thumbs up of " + fmt(d.na) + " (" + pct1(d.rateA) + "), B " +
      fmt(d.ub) + " of " + fmt(d.nb) + " (" + pct1(d.rateB) + "). Pooled " + fmt(d.ua + d.ub) + " of " + fmt(d.na + d.nb) + " = " + pct1(d.t.pool) +
      ". SE = sqrt(" + d.t.pool.toFixed(3) + " x " + (1 - d.t.pool).toFixed(3) + " x (1/" + fmt(d.na) + " + 1/" + fmt(d.nb) + ")) = " + d.t.se.toFixed(4) +
      ". z = " + (d.rateB - d.rateA).toFixed(4) + " / " + d.t.se.toFixed(4) + " = " + d.t.z.toFixed(2) + ". p = " + p3(d.t.p) + ".";
  }

  // 200 A/A tests, drawn once. Each is 14 p-values, one per day, counted from day 1.
  function drawAA(rand) {
    var out = [];
    for (var r = 0; r < AA_RUNS; r++) {
      var xa = 0, xb = 0, na = 0, nb = 0, ps = [];
      for (var d = 0; d < DAYS; d++) {
        var i;
        for (i = 0; i < NA[d]; i++) if (rand() < AA_RATE) xa++;
        for (i = 0; i < NB[d]; i++) if (rand() < AA_RATE) xb++;
        na += NA[d];
        nb += NB[d];
        ps.push(test2(xa, na, xb, nb).p);
      }
      out.push(ps);
    }
    return out;
  }
  function aaCount(AA, stop, daily) {
    var c = 0;
    AA.forEach(function (ps) {
      var hit = false;
      if (daily) { for (var k = 0; k < stop; k++) if (ps[k] < ALPHA) hit = true; } else hit = ps[stop - 1] < ALPHA;
      if (hit) c += 1;
    });
    return c;
  }
  function aaFirsts(AA, stop) {
    var f = [];
    for (var k = 0; k < stop; k++) f.push(0);
    AA.forEach(function (ps) { for (var k = 0; k < stop; k++) if (ps[k] < ALPHA) { f[k] += 1; return; } });
    return f;
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
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;font-size:12px;overflow-x:auto;");
    var head = el("p", "margin:0;font-weight:600;");
    var chart = el("div", "min-width:0;");
    var table = el("table", "width:100%;border-collapse:collapse;");
    var work = el("p", "margin:0;");
    box.appendChild(head);
    box.appendChild(chart);
    box.appendChild(table);
    box.appendChild(work);
    api.root.appendChild(box);
    return { doc: doc, el: el, head: head, chart: chart, table: table, work: work };
  }

  function row(ui, cells, style, tag) {
    var tr = ui.el("tr", style || "");
    cells.forEach(function (c) { tr.appendChild(ui.el(tag || "td", "text-align:left;padding:2px 6px;vertical-align:top;", String(c))); });
    return tr;
  }
  function empty(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // A small chart of each day's p-value (days 1 to k together), with the 0.05 line dashed.
  function drawChart(ui, ps, end) {
    var NS = "http://www.w3.org/2000/svg";
    var doc = ui.doc;
    empty(ui.chart);
    function mk(tag, a, parent) {
      var e = doc.createElementNS(NS, tag);
      for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) e.setAttribute(k, String(a[k]));
      parent.appendChild(e);
      return e;
    }
    var svg = mk("svg", { viewBox: "0 0 600 150", width: "100%", role: "img", "class": "dg",
      "aria-label": "Each day's p-value, counting from day 1, on a scale from 0 to 0.7. The dashed line is 0.05; a point below it was painted green as significant." }, ui.chart);
    function X(i) { return 50 + i * 38; }
    function Y(p) { return 130 - Math.min(p, 0.7) / 0.7 * 110; }
    mk("line", { x1: 40, y1: Y(0.05), x2: 590, y2: Y(0.05), "class": "dg-axis", "stroke-dasharray": "4 4", stroke: "currentColor" }, svg);
    var t = mk("text", { x: 590, y: Y(0.05) - 4, "class": "dg-note", "text-anchor": "end" }, svg);
    t.textContent = "0.05";
    var d = "";
    ps.forEach(function (p, i) { d += (i ? "L" : "M") + X(i) + " " + Y(p).toFixed(1); });
    mk("path", { d: d, fill: "none", stroke: "currentColor", "class": "dg-axis" }, svg);
    ps.forEach(function (p, i) {
      mk("circle", { cx: X(i), cy: Y(p).toFixed(1), r: i + 1 === end ? 5 : 3, fill: "currentColor", "class": p < ALPHA ? "dg-note" : "dg-axis" }, svg);
      var l = mk("text", { x: X(i), y: 146, "class": "dg-axis", "text-anchor": "middle" }, svg);
      l.textContent = String(i + 1);
    });
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var r = run(C);
    S.r = r;
    var all = upTo(DAYS);
    empty(ui.table);
    if (C.mode === "ab") {
      ui.head.textContent = "The logged fortnight. Rates and p-values count from day 1 to that day. Ends on day " + r.end + " (" +
        (r.why === "guard" ? "guard rail" : (r.why === "peek" ? "first p below 0.05" : "planned last day")) + "). Guard-rail line: " +
        (C.guard ? C.guard.toFixed(1) + "%" : "off") + ".";
      var ps = [];
      for (var k = 1; k <= DAYS; k++) ps.push(upTo(k).t.p);
      drawChart(ui, ps, r.end);
      ui.table.appendChild(row(ui, ["day", "A: chats, up, refunds", "B: chats, up, refunds", "A so far", "B so far", "p so far", "B refunds known"], "", "th"));
      for (k = 1; k <= DAYS; k++) {
        var d = upTo(k);
        var kb = knownB(k);
        var st = k === r.end ? "font-weight:600;" : (k > r.end ? "opacity:0.55;" : "");
        if (d.t.p < ALPHA) st += "color:var(--green);";
        ui.table.appendChild(row(ui, [k, NA[k - 1] + ", " + UA[k - 1] + ", " + RA[k - 1], NB[k - 1] + ", " + UB[k - 1] + ", " + RB[k - 1],
          pct1(d.rateA), pct1(d.rateB), p3(d.t.p), kb ? pct2(kb.rate) + (guardTrip(k, C.guard) ? " OVER" : "") : "-"], st));
      }
      ui.work.textContent = worked(C.inspect);
    } else {
      ui.head.textContent = "200 A/A tests: both doors are the same assistant, thumbs up 70% of the time, on the logged daily counts. Any winner is a false one.";
      empty(ui.chart);
      var f = aaFirsts(S.AA, C.stop);
      ui.table.appendChild(row(ui, ["day", "tests that first showed p below 0.05 that day", "running total"], "", "th"));
      var tot = 0;
      f.forEach(function (n, i) { tot += n; ui.table.appendChild(row(ui, [i + 1, n, tot])); });
      ui.work.textContent = "Checking every morning up to day " + C.stop + ": " + aaCount(S.AA, C.stop, true) + " of 200 find a false winner. Checking once, on day " +
        C.stop + ": " + aaCount(S.AA, C.stop, false) + " of 200.";
    }

    var g = firstGuard(C.guard);
    S.stat.end("day " + r.end);
    S.stat.decision(r.decision);
    S.stat.rateA(pct1(r.d.rateA));
    S.stat.rateB(pct1(r.d.rateB));
    S.stat.lead(r.d.lead.toFixed(1) + " points");
    S.stat.p(p3(r.d.t.p));
    S.stat.weekB(pct1(week(UB, NB, 0)) + " then " + pct1(week(UB, NB, 1)));
    S.stat.weekA(pct1(week(UA, NA, 0)) + " then " + pct1(week(UA, NA, 1)));
    S.stat.refA(pct2(all.ra / all.na));
    S.stat.refB(pct2(all.rb / all.nb));
    S.stat.guard(!C.guard ? "off" : (r.why === "guard" ? "B stopped on day " + r.end : (g && g > r.end ? "not reached: ended day " + r.end : "not tripped")));
    S.stat.weekly(String(Math.round(WEEK_AFTER * (r.decision === "B ships" ? all.rb / all.nb : all.ra / all.na))));
    S.stat.aaDaily(aaCount(S.AA, C.stop, true) + " of 200");
    S.stat.aaOnce(aaCount(S.AA, C.stop, false) + " of 200");
  }

  function summaryLine(C, r) {
    return "Last day " + C.stop + ", " + (C.peek ? "checked every morning" : "checked once at the end") + ", guard rail " +
      (C.guard ? C.guard.toFixed(1) + "%" : "off") + ": ends on day " + r.end + ". A " + pct1(r.d.rateA) + ", B " + pct1(r.d.rateB) +
      ", lead " + r.d.lead.toFixed(1) + " points, p = " + p3(r.d.t.p) + ". " + r.decision.charAt(0).toUpperCase() + r.decision.slice(1) + ".";
  }

  /* ---------- the module ---------- */

  DL.sims.define("a5e06", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { mode: "ab", stop: 14, peek: true, guard: 0, inspect: 4 };
      S.AA = drawAA(api.rand);
      S.ui = buildWidget(api);
      S.ctl = {};

      function change(msg, tone) {
        draw(api);
        api.log(msg + " " + summaryLine(S.C, S.r), tone || "");
      }
      function setAll() {
        S.ctl.mode.set(S.C.mode); S.ctl.stop.set(S.C.stop); S.ctl.peek.set(S.C.peek);
        S.ctl.guard.set(S.C.guard ? String(S.C.guard) : "0");
      }

      S.ctl.mode = api.control.select("mode", "Doors", MODES, "ab", function (v) {
        if (v !== "ab" && v !== "aa") return;
        S.C.mode = v;
        draw(api);
        api.log(v === "aa" ? "A/A: both doors the same assistant, 200 seeded tests. Up to day " + S.C.stop + ", checking every morning: " +
          aaCount(S.AA, S.C.stop, true) + " of 200 find a false winner; checking once on day " + S.C.stop + ": " + aaCount(S.AA, S.C.stop, false) + " of 200." :
          "A/B: the logged fortnight. " + summaryLine(S.C, S.r), "");
      });
      S.ctl.stop = api.control.range("stop", "Planned last day", 1, DAYS, 1, 14, function (v) {
        var x = Math.max(1, Math.min(DAYS, Math.round(Number(v))));
        if (!isFinite(x) || x === S.C.stop) return;
        S.C.stop = x;
        change("Planned last day: " + x + ".");
      });
      S.ctl.peek = api.control.toggle("peek", "Check every morning, stop at the first p below 0.05", true, function (on) {
        S.C.peek = !!on;
        change(on ? "Checking every morning." : "Checking once, on the planned last day.");
      });
      S.ctl.guard = api.control.select("guard", "Refund guard rail for B", GUARDS, "0", function (v) {
        var x = Number(v);
        if (!isFinite(x) || x === S.C.guard) return;
        S.C.guard = x;
        var g = firstGuard(x);
        var kb = g ? knownB(g) : null;
        change(x ? "Guard-rail line " + x.toFixed(1) + "%. " + (g ? "B's known refunds pass it at the end of day " + g + ": " + kb.r + " of " + fmt(kb.n) + ", " + pct2(kb.rate) + "." :
          "B's known refunds never pass it.") : "Guard rail off.", x && g ? "warn" : "");
      });
      S.ctl.inspect = api.control.range("inspect", "Work one day by hand", 1, DAYS, 1, 4, function (v) {
        var x = Math.max(1, Math.min(DAYS, Math.round(Number(v))));
        if (!isFinite(x)) return;
        S.C.inspect = x;
        draw(api);
      });
      S.ctl.reply = api.control.select("reply", "Try a reply", REPLIES, "none", function (v) {
        var C = S.C;
        var all = upTo(DAYS);
        if (v === "0") {
          C.mode = "ab"; C.stop = 14; C.peek = false; C.guard = 3.5;
          draw(api);
          var kb = knownB(8);
          api.log("Reply 1: planned for 8,077 a door, 14 days, checked once at the end, refund line 3.5%. Day 4 is never looked at. At the end of day 8, B's day-1 refunds are known: " +
            kb.r + " of " + kb.n + ", " + pct2(kb.rate) + ", over the line. B stopped on day 8. Had it run, day 14: lead " + all.lead.toFixed(1) + " points, p = " + p3(all.t.p) + ", not significant.", "ok");
        } else if (v === "1") {
          C.mode = "ab"; C.stop = 14; C.peek = true; C.guard = 0;
          draw(api);
          api.log("Reply 2: keep B. Called on day 4 at p = " + p3(S.r.d.t.p) + ". Day 14 would have said lead " + all.lead.toFixed(1) + " points, p = " + p3(all.t.p) +
            ". B by week: " + pct1(week(UB, NB, 0)) + " then " + pct1(week(UB, NB, 1)) + ". Refunds: B " + pct2(all.rb / all.nb) + ", A " + pct2(all.ra / all.na) +
            ": " + Math.round(WEEK_AFTER * all.rb / all.nb) + " a week against " + Math.round(WEEK_AFTER * all.ra / all.na) + ".", "bad");
        } else if (v === "2") {
          C.mode = "aa"; C.stop = 14; C.peek = true; C.guard = 0;
          draw(api);
          api.log("Reply 3: checking every morning, stopping at the first clear lead. On 200 A/A tests with no real difference: " + aaCount(S.AA, 14, true) +
            " of 200 find a winner; checking once on day 14: " + aaCount(S.AA, 14, false) + " of 200. On the logged fortnight it stops on day 4 again and picks B.", "bad");
        } else if (v === "3") {
          C.mode = "ab"; C.stop = 14; C.peek = false; C.guard = 0;
          draw(api);
          var rt = test2(all.ra, all.na, all.rb, all.nb);
          api.log("Reply 4: refunds alone. A " + pct2(all.ra / all.na) + " against B " + pct2(all.rb / all.nb) + ", p " + p3(rt.p) + ": A. Day 14's refunds are known on day " +
            (DAYS + LAG) + ". On day 4, no day's refunds were complete. Thumbs up are not counted at all.", "warn");
        } else {
          return;
        }
        setAll();
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        end: api.stat("end", "the test ended on", ""),
        decision: api.stat("decision", "decision", "warn"),
        rateA: api.stat("rateA", "A thumbs-up rate, so far", ""),
        rateB: api.stat("rateB", "B thumbs-up rate, so far", ""),
        lead: api.stat("lead", "B's lead", ""),
        p: api.stat("p", "p-value on that day", "warn"),
        weekB: api.stat("weekB", "B by week, week 1 then week 2", "warn"),
        weekA: api.stat("weekA", "A by week, week 1 then week 2", ""),
        refA: api.stat("refA", "A refund rate, all 14 days", ""),
        refB: api.stat("refB", "B refund rate, all 14 days", "bad"),
        guard: api.stat("guard", "guard rail", ""),
        weekly: api.stat("weekly", "refunds a week after the release", "bad"),
        aaDaily: api.stat("aaDaily", "A/A false winners, checking every morning", "bad"),
        aaOnce: api.stat("aaOnce", "A/A false winners, checking once", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one day of the test: conversations, thumbs up and refunds for each door, then both doors' thumbs-up rates and the p-value counting from day 1. Green rows are below 0.05. A refund is known up to 7 days after its conversation, so the guard rail can first look on day 8. The line under the table works one day by hand.");

      draw(api);
      api.log("As run: checked every morning, no guard rail. On the morning of day 5 the dashboard showed days 1 to 4: A " + pct1(S.r.d.rateA) + ", B " + pct1(S.r.d.rateB) +
        ", p = " + p3(S.r.d.t.p) + ", green. The team called it for B.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: as run, checked every morning, no guard rail: called on day 4.
      t.expect(t.stat("end") === "day 4" && t.stat("decision") === "B ships" && t.stat("rateA") === "69.8%" && t.stat("rateB") === "72.9%" &&
        t.stat("lead") === "3.1 points" && t.stat("p") === 0.018 && t.stat("guard") === "off" && t.stat("weekly") === 378 &&
        has("On the morning of day 5 the dashboard showed days 1 to 4: A 69.8%, B 72.9%, p = 0.018, green. The team called it for B."),
        "Opens as run: day 4, A 69.8%, B 72.9%, p = 0.018, B ships, 378 refunds a week");

      // 2. Day 4 by hand, and days 1 to 3 above 0.05.
      var w = worked(4);
      t.expect(w === "Day 4, days 1 to 4 together: A 1,676 thumbs up of 2,400 (69.8%), B 1,750 of 2,400 (72.9%). Pooled 3,426 of 4,800 = 71.4%. SE = sqrt(0.714 x 0.286 x (1/2,400 + 1/2,400)) = 0.0130. z = 0.0308 / 0.0130 = 2.36. p = 0.018." &&
        p3(upTo(1).t.p) === "0.604" && p3(upTo(2).t.p) === "0.374" && p3(upTo(3).t.p) === "0.237",
        "Day 4 worked by hand: z 2.36, p 0.018; days 1 to 3: 0.604, 0.374, 0.237");

      // 3. Checked once, on day 14: not significant.
      t.click("peek");
      t.expect(t.stat("end") === "day 14" && t.stat("p") === 0.116 && t.stat("lead") === "1.1 points" && t.stat("rateA") === "70.0%" &&
        t.stat("rateB") === "71.1%" && t.stat("decision") === "no clear winner, keep A" && t.stat("weekly") === 252,
        "Day 14: A 70.0%, B 71.1%, lead 1.1 points, p = 0.116, no clear winner");

      // 4. Novelty: B's lead is all in week 1.
      t.expect(t.stat("weekB") === "72.3% then 69.8%" && t.stat("weekA") === "69.9% then 70.0%",
        "By week: B 72.3% then 69.8%; A 69.9% then 70.0%");

      // 5. Refunds over the fortnight.
      t.expect(t.stat("refA") === "3.00%" && t.stat("refB") === "4.50%", "Refunds: A 3.00%, B 4.50%");

      // 6. Guard rail at 3.5%, checked once: B stopped on day 8.
      t.set("guard", "3.5");
      t.expect(t.stat("guard") === "B stopped on day 8" && t.stat("end") === "day 8" && t.stat("decision") === "B stopped, keep A" &&
        has("B's known refunds pass it at the end of day 8: 27 of 602, 4.49%."),
        "Guard rail 3.5%: B stopped on day 8, 27 of 602 refunds, 4.49%");

      // 7. The same guard rail with daily checks: day 4 ships B before the rail can see anything.
      t.click("peek");
      t.expect(t.stat("end") === "day 4" && t.stat("decision") === "B ships" && t.stat("guard") === "not reached: ended day 4",
        "Checking every morning, the test is called on day 4, before the guard rail's first look on day 8");

      // 8. A loose line never trips.
      t.click("peek");
      t.set("guard", "5");
      t.expect(t.stat("guard") === "not tripped" && t.stat("end") === "day 14", "Line 5.0%: B's refunds never pass it");
      t.set("guard", "0");

      // 9. A/A: daily checks find false winners.
      t.set("mode", "aa");
      t.expect(t.stat("aaDaily") === "43 of 200" && t.stat("aaOnce") === "7 of 200" &&
        has("checking every morning: 43 of 200 find a false winner; checking once on day 14: 7 of 200."),
        "200 A/A tests: 43 false winners checking every morning, 7 checking once");

      // 10. Replies 1 and 2.
      t.set("reply", "0");
      var r0 = has("B's day-1 refunds are known: 27 of 602, 4.49%, over the line. B stopped on day 8. Had it run, day 14: lead 1.1 points, p = 0.116, not significant.");
      t.set("reply", "1");
      t.expect(r0 && has("Reply 2: keep B. Called on day 4 at p = 0.018. Day 14 would have said lead 1.1 points, p = 0.116. B by week: 72.3% then 69.8%. Refunds: B 4.50%, A 3.00%: 378 a week against 252."),
        "Replies 1 and 2: B stopped on day 8; B kept on day 4's p = 0.018, 378 refunds a week against 252");

      // 11. Replies 3 and 4.
      t.set("reply", "2");
      var r2 = has("On 200 A/A tests with no real difference: 43 of 200 find a winner; checking once on day 14: 7 of 200.");
      t.set("reply", "3");
      t.expect(r2 && has("Reply 4: refunds alone. A 3.00% against B 4.50%, p below 0.001: A. Day 14's refunds are known on day 21."),
        "Replies 3 and 4: 43 of 200 false winners; refunds alone pick A, known on day 21");
    }
  });
})();
