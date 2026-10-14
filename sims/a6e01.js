/* sims/a6e01-v1.0.0.js  (published as sims/a6e01.js)
   Case a6e01 "One Door to Every Mind": a usage ledger for Lowlight Subtitles, a small subtitle
   studio. Four tools send requests to one model provider: speech to text, the translator, the
   checker and the archive summariser. No real model runs here: each tool's spend is stated data,
   minute by minute, from 1 September to 31 October 2026 (days after 15 October are "ahead": what
   happens if nothing else changes). Widget-style sim: it draws its own tables inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: how the tools reach the provider (one shared key,
     an own provider account per tool, a gateway with a key per tool), each tool's monthly budget,
     the summariser's schedule, the provider's monthly limit, the day to inspect, a plan (one of the
     four replies, from 01:40 tonight), reset. Stats: setup, limit, day, September's bill, month to
     date at 00:00, at 01:00 and at the day's end, busiest ten minutes, the summariser this month,
     tools stopped. selfTest: 12 assertions.

   The model (stated in sim.lede):
   - Money is kept in units of 1/48,000 of a dollar, so every sum is exact.
   - Work minutes: 00:00 to 01:00, 01:40 to 07:40 and 23:00 to 24:00, 480 a day (Aoife's shift is
     23:00 to 07:40 with her break 01:00 to 01:40). Each work minute: speech to text $22/480,
     translator $12/480, checker $6/480: $40 a day, $5 an hour, $0.83 a ten-minute bar.
   - The summariser runs 01:00 to 01:40 on its run days, $65 a run, $1.625 a minute, $16.25 a bar.
     Weekly: Sundays (6, 13, 20, 27 September; 4, 11, 18, 25 October). Changed on 30 September to
     every night from 1 October.
   - A month's spend counts from 00:00 on the 1st. A limit or budget is a meter: requests pass while
     it has room; the minute it fills, the rest of that minute and every later request is refused
     until the month resets. Within a minute tools are served in the order above.
   - Shared key: every tool on one provider account (limit $1,500). Own accounts: each tool on its
     own account, limit = its budget. Gateway: each tool's gateway key has its budget, and every
     request also counts on the one provider account.

   Where every number comes from (conventions rule 14; the case is content/latent/a6/a6e01-v1.0.0.json).
   - September: 30 days of work, $1,200 (speech $660, translator $360, checker $180), plus 4 runs,
     $260: $1,460.00.
   - October, as it happened: by the end of 14 October 14 runs ($910) and 14 days of work ($560):
     $1,470.00. 00:00 to 01:00 on the 15th adds $5: $1,475.00. The 01:00 run fills the limit after
     $25 (16.25 + 8.75): 0.625 into the minute 01:15 of its 1.625, at 01:15:23, shown as 01:15.
     All four tools are refused from then; Aoife finds them refused at 01:40.
   - Every night from 1 October the bars 01:00, 01:10, 01:20, 01:30 are $16.25; a work bar is $0.83.
   - Weekly all along: October to the 15th $730.00; October would end at exactly $1,500.00 in its
     last minute (no request refused).
   - Gateway since 1 September, budgets $700, $400, $200, $350: the summariser's key fills at 01:15
     on 6 October (5 runs $325, then $25); the three others run on; October to the end of the
     15th $950.00 (15 days of work $600, summariser $350).
     A $250 budget stops even the weekly job: 27 September 01:33 (3 runs $195, then $55).
   - Plans, from 01:40 on 15 October (projected to 31 October):
     r0 limit $3,000: the account fills at 07:40 on 29 October (1,535 at the end of the 15th, $105 a
        day, 2,970 at 01:40 on the 29th, $30 of work to 07:40).
     r1 own accounts tonight for the three tools ($700, $400, $200); the summariser stays on the old,
        full account until Mr Corrigall gives it its own ($350) at 12:00 on 16 October; it fills at
        01:15 on 22 October (17 to 21 October $325, then $25). October across five accounts $2,525.00.
     r2 limit $2,500; at 12:00 on 16 October the gateway takes the real key, budgets $700, $400,
        $200, $350; its log shows the summariser's key spending $65.00 at 01:00 on 17 October, and
        the schedule goes back to weekly at 12:00 that day. October $2,435.00.
     r3 a new key at 01:40 in the three tools: still refused (the account is full); limit $2,500;
        the summariser's old key is refused from 01:00 on 16 October; at 12:00 Mr Corrigall pastes
        the new key into it, the nightly bars return, and the account fills at 04:40 on 25 October.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var U = 48000; // units per dollar
  var TOOLS = [
    { id: "speech", name: "Speech to text", rate: 2200 },  // $22 a day over 480 minutes
    { id: "translate", name: "Translator", rate: 1200 },   // $12 a day
    { id: "check", name: "Checker", rate: 600 },           // $6 a day
    { id: "summ", name: "Summariser", rate: 78000 }        // $1.625 a minute, $65 a run
  ];
  var DAYS = 61;          // 1 September (day 0) to 31 October (day 60)
  var OCT = 30;           // day index of 1 October
  var TONIGHT = 44;       // 15 October
  var T0 = TONIGHT * 1440 + 100;   // 01:40 on 15 October
  var NOON16 = 45 * 1440 + 720;    // 12:00 on 16 October
  var NOON17 = 46 * 1440 + 720;    // 12:00 on 17 October
  var PB = { speech: 700, translate: 400, check: 200, summ: 350 };

  var MODES = [
    { value: "shared", label: "One shared key (as built)" },
    { value: "own", label: "An own provider account per tool" },
    { value: "gateway", label: "A gateway: a key and budget per tool" }
  ];
  var SCHEDS = [
    { value: "changed", label: "Weekly, then every night from 1 October (as changed on 30 September)" },
    { value: "weekly", label: "Weekly, Sundays at 01:00, all along" }
  ];
  var LIMITS = [1500, 1700, 2500, 3000];
  var PLANS = [
    { value: "none", label: "None: set the controls yourself" },
    { value: "r0", label: "Reply: raise the limit, check weekly" },
    { value: "r1", label: "Reply: an own account per tool" },
    { value: "r2", label: "Reply: a gateway, a key and budget per tool" },
    { value: "r3", label: "Reply: a new key in every tool I can reach" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function money(u) {
    var c = Math.round(u * 100 / U);
    return "$" + fmt(Math.floor(c / 100)) + "." + String(100 + (c % 100)).slice(1);
  }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hm(m) { return two(Math.floor(m / 60) % 24) + ":" + two(m % 60); }
  function dayName(d) { return d < OCT ? (d + 1) + " Sep" : (d - OCT + 1) + " Oct"; }
  function when(abs) { return dayName(Math.floor(abs / 1440)) + " " + hm(abs % 1440); }
  function monthOf(d) { return d < OCT ? 0 : 1; }
  function sunday(d) { return (2 + d) % 7 === 0; } // 1 September 2026 was a Tuesday
  function isWork(m) { return m < 60 || (m >= 100 && m < 460) || m >= 1380; }

  /* ---------- the model (pure: config in, ledger out) ---------- */

  function runsTonight(C, d, abs) {
    if (C.plan === "r2" && abs >= NOON17) return sunday(d);
    if (C.sched === "weekly") return sunday(d);
    return d >= OCT || sunday(d);
  }

  // The meters each tool's request must pass at minute abs: [[meter id, limit]].
  function routes(C, abs) {
    var R = {};
    TOOLS.forEach(function (t) {
      var r;
      if (C.mode === "own") r = [["own-" + t.id, C.budget[t.id]]];
      else if (C.mode === "gateway") r = [["gw-" + t.id, C.budget[t.id]], ["acct", C.limit]];
      else r = [["acct", C.limit]];
      if (C.plan !== "none" && abs >= T0) {
        if (C.plan === "r0") r = [["acct", 3000]];
        if (C.plan === "r1") r = t.id !== "summ" ? [["new-" + t.id, PB[t.id]]] : (abs >= NOON16 ? [["new-summ", PB.summ]] : [["acct", 1500]]);
        if (C.plan === "r2") r = abs >= NOON16 ? [["gw-" + t.id, PB[t.id]], ["acct", 2500]] : [["acct", 2500]];
        if (C.plan === "r3") r = (t.id === "summ" && abs < NOON16) ? [["dead", 0]] : [["acct", 2500]];
      }
      R[t.id] = r;
    });
    return R;
  }

  function ledger(C) {
    var meters = {};
    var L = { slots: [], start: [], at0100: [], end: [], toolEnd: [], runs: [], refused: [{}, {}], events: [], snap: [] };
    var total = 0;
    var tools = [0, 0, 0, 0];
    var runs = 0;
    function meter(id, limit) {
      if (!meters[id]) meters[id] = { id: id, spent: 0, reached: null };
      meters[id].limit = limit * U;
      if (meters[id].limit - meters[id].spent > 0) meters[id].reached = null; // a raised limit has room again
      return meters[id];
    }
    for (var d = 0; d < DAYS; d++) {
      if (d === OCT) {
        total = 0; tools = [0, 0, 0, 0]; runs = 0;
        Object.keys(meters).forEach(function (k) { meters[k].spent = 0; meters[k].reached = null; });
      }
      L.start.push(total);
      var slots = [];
      for (var s = 0; s < 144; s++) slots.push([0, 0, 0, 0]);
      var ran = false;
      for (var m = 0; m < 1440; m++) {
        if (m === 60) L.at0100.push(total);
        var abs = d * 1440 + m;
        var work = isWork(m);
        var run = m >= 60 && m < 100 && runsTonight(C, d, abs);
        if (!work && !run) continue;
        var R = routes(C, abs);
        for (var i = 0; i < TOOLS.length; i++) {
          var t = TOOLS[i];
          var want = (i === 3 ? run : work) ? t.rate : 0;
          if (!want) continue;
          var ms = R[t.id].map(function (x) { return meter(x[0], x[1]); });
          var room = Infinity;
          ms.forEach(function (x) { room = Math.min(room, x.limit - x.spent); });
          var spend = Math.max(0, Math.min(want, room));
          if (spend > 0) {
            ms.forEach(function (x) { x.spent += spend; });
            total += spend; tools[i] += spend; slots[Math.floor(m / 10)][i] += spend;
            if (i === 3) ran = true;
          }
          var at = abs * 60 + Math.floor(spend * 60 / want); // seconds: the moment the meter filled
          ms.forEach(function (x) {
            if (x.reached === null && x.limit - x.spent <= 0) {
              x.reached = Math.floor(at / 60);
              L.events.push({ meter: x.id, at: x.reached, d: d });
            }
          });
          if (spend < want && !L.refused[monthOf(d)][t.id]) {
            var full = ms.filter(function (x) { return x.limit - x.spent <= 0; })[0];
            L.refused[monthOf(d)][t.id] = { at: Math.floor(at / 60), meter: full ? full.id : "?" };
          }
        }
      }
      if (ran) runs += 1;
      var snap = {};
      Object.keys(meters).forEach(function (k) { snap[k] = meters[k].reached; });
      L.snap.push(snap);
      L.slots.push(slots);
      L.end.push(total);
      L.toolEnd.push(tools.slice());
      L.runs.push(runs);
    }
    L.meters = meters;
    return L;
  }

  // Tools that can't spend at the end of day d, with the moment their meter filled.
  function stoppedAt(C, L, d) {
    var R = routes(C, d * 1440 + 1439);
    var out = [];
    TOOLS.forEach(function (t) {
      var first = null;
      R[t.id].forEach(function (x) {
        var r = L.snap[d][x[0]];
        if (r !== null && r !== undefined && r <= d * 1440 + 1439 && (first === null || r < first)) first = r;
      });
      if (first !== null) out.push({ tool: t, at: first });
    });
    return out;
  }
  function stoppedText(C, L, d) {
    var s = stoppedAt(C, L, d);
    if (!s.length) return "none";
    if (s.length === 4 && s.every(function (x) { return x.at === s[0].at; })) return "all four, " + when(s[0].at);
    return s.map(function (x) { return x.tool.name.toLowerCase() + ", " + when(x.at); }).join("; ");
  }
  function busiest(L, d) {
    var best = -1;
    var bi = 0;
    L.slots[d].forEach(function (sl, k) {
      var v = sl[0] + sl[1] + sl[2] + sl[3];
      if (v > best) { best = v; bi = k; }
    });
    return hm(bi * 10) + " to " + hm(bi * 10 + 10) + ", " + money(best);
  }
  function meterReached(L, id) {
    var e = L.events.filter(function (x) { return x.meter === id && x.d >= OCT; }).pop();
    return e ? when(e.at) : "never";
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
    var key = el("p", "margin:0;", "", box);
    var w1 = el("div", "overflow-x:auto;", "", box);
    var night = el("table", "width:100%;border-collapse:collapse;", "", w1);
    var mhead = el("p", "margin:0;font-weight:600;", "", box);
    var w2 = el("div", "overflow-x:auto;", "", box);
    var month = el("table", "width:100%;border-collapse:collapse;", "", w2);
    return { el: el, head: head, key: key, night: night, mhead: mhead, month: month };
  }
  function row(ui, table, cells, th) {
    var tr = ui.el("tr", "", "", table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;", String(c), tr); });
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function meterName(id) {
    if (id === "acct") return "the account's limit";
    if (id === "dead") return "old key switched off";
    return { own: "its own account", gw: "its gateway budget", "new": "its new account" }[id.split("-")[0]] || id;
  }

  function sumSlots(L, d, a, b, i) {
    var v = 0;
    for (var k = a; k < b; k++) v += i === null ? L.slots[d][k][0] + L.slots[d][k][1] + L.slots[d][k][2] + L.slots[d][k][3] : L.slots[d][k][i];
    return v;
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var L = ledger(C);
    S.L = L;
    var d = C.day;
    var mo = monthOf(d);
    var plan = pick(PLANS, C.plan);
    ui.head.textContent = "Setup: " + pick(MODES, C.mode).label + ". Provider limit $" + fmt(C.limit) + " a month. Summariser: " +
      pick(SCHEDS, C.sched).label + "." + (C.plan !== "none" ? " Plan from 01:40 on 15 October: " + plan.label + "." : "") +
      (d > TONIGHT ? " " + dayName(d) + " is ahead of tonight: what happens if nothing else changes." : "");
    var who = C.mode === "shared" && C.plan === "none" ? "per tool: on no page anywhere, because there is one key" :
      (C.mode === "own" ? "per tool: each on its own account's usage page" : "per tool: as the stated data has it");
    ui.key.textContent = "The night of " + dayName(d) + " in ten-minute bars. The usage page column is what the provider shows: one line per real key. The tool columns are " + who + ".";
    clear(ui.night);
    row(ui, ui.night, ["bar", "usage page"].concat(TOOLS.map(function (t) { return t.name; })), true);
    var bands = [];
    for (var k = 0; k < 12; k++) bands.push([hm(k * 10), k, k + 1]);
    bands.push(["02:00 to 07:40", 12, 46], ["23:00 to 24:00", 138, 144]);
    bands.forEach(function (b) {
      row(ui, ui.night, [b[0], money(sumSlots(L, d, b[1], b[2], null))].concat(TOOLS.map(function (t, i) { return money(sumSlots(L, d, b[1], b[2], i)); })));
    });
    ui.mhead.textContent = (mo ? "October" : "September") + " to the end of " + dayName(d) + ": " + money(L.end[d]) + " in all.";
    clear(ui.month);
    row(ui, ui.month, ["tool", "spent this month", "refused from"], true);
    var R = routes(C, d * 1440 + 1439);
    var st = stoppedAt(C, L, d);
    TOOLS.forEach(function (t, i) {
      var s = st.filter(function (x) { return x.tool === t; })[0];
      row(ui, ui.month, [t.name, money(L.toolEnd[d][i]), s ? when(s.at) + " (" + R[t.id].map(function (x) { return meterName(x[0]); }).join(" and ") + ")" : "running"]);
    });

    S.stat.setup(C.mode === "shared" ? "one shared key" : (C.mode === "own" ? "own account per tool" : "gateway, a key per tool"));
    S.stat.limit("$" + fmt(C.limit) + ({ r0: ", $3,000 from 01:40 on 15 Oct", r1: " (old account); new accounts per tool", r2: ", $2,500 from 01:40 on 15 Oct", r3: ", $2,500 from 01:40 on 15 Oct" }[C.plan] || ""));
    S.stat.day(dayName(d));
    S.stat.sept(money(L.end[OCT - 1]));
    S.stat.before(money(L.start[d]));
    S.stat.at0100(money(L.at0100[d]));
    S.stat.month(money(L.end[d]));
    S.stat.busiest(busiest(L, d));
    S.stat.summ(L.runs[d] + (L.runs[d] === 1 ? " run, " : " runs, ") + money(L.toolEnd[d][3]));
    S.stat.stopped(stoppedText(C, L, d));
  }

  function report(api, what) {
    draw(api);
    var S = api.state;
    var d = S.C.day;
    var L = S.L;
    api.log(what + " " + dayName(d) + ": month to date " + money(L.start[d]) + " at 00:00, " + money(L.at0100[d]) + " at 01:00, " +
      money(L.end[d]) + " by the day's end. Busiest ten minutes: " + busiest(L, d) + ". Stopped: " + stoppedText(S.C, L, d) + ".",
      stoppedAt(S.C, L, d).length === 4 ? "bad" : "");
  }

  function outcome(plan, L) {
    var oct = money(L.end[DAYS - 1]);
    if (plan === "r0") return "At 01:40 the limit is $3,000 and the three tools run again. The summariser still runs every night, on the same one line. The account fills at " +
      meterReached(L, "acct") + ", and all four stop. October: " + oct + ".";
    if (plan === "r1") return "At 01:40 the three tools move to new accounts ($700, $400, $200). The summariser stays on the old, full account until 12:00 on 16 Oct, then gets its own ($350). Its account fills at " +
      meterReached(L, "new-summ") + "; only its own usage page shows it, one of four. October across five accounts: " + oct + ".";
    if (plan === "r2") return "At 01:40 the limit is $2,500. At 12:00 on 16 Oct the gateway takes the real key; each tool gets its own key and budget ($700, $400, $200, $350). Gateway log, 17 Oct, summariser key: " +
      money(sumSlots(L, 46, 6, 10, 3)) + " between 01:00 and 01:40. Its schedule goes back to weekly at 12:00. October: " + oct + ", under the $2,500 limit.";
    var r = L.snap[TONIGHT + 1].dead;
    return "At 01:40 the new key is still refused: the account has spent " + money(L.slots[TONIGHT].slice(0, 10).reduce(function (a, s) { return a + s[0] + s[1] + s[2] + s[3]; }, L.start[TONIGHT])) +
      " of its $1,500, and a new key doesn't empty it. The limit goes to $2,500. The summariser's old key is refused from " +
      (r !== null && r !== undefined ? when(r) : "never") + ". At 12:00 on 16 Oct the new key goes into it too; the 01:00 bars come back every night, and the account fills at " + meterReached(L, "acct") + ".";
  }
  var FOCUS = { r0: 58, r1: 51, r2: 46, r3: 54 };

  /* ---------- the module ---------- */

  DL.sims.define("a6e01", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { mode: "shared", sched: "changed", limit: 1500, day: OCT - 1, plan: "none",
        budget: { speech: PB.speech, translate: PB.translate, check: PB.check, summ: PB.summ } };
      S.ui = buildWidget(api);
      S.ctl = {};
      function manual(what) {
        if (S.C.plan !== "none") { S.C.plan = "none"; S.ctl.plan.set("none"); what += " (Plan cleared.)"; }
        report(api, what);
      }
      S.ctl.mode = api.control.select("mode", "How the tools reach the provider", MODES, "shared", function (v) {
        var o = pick(MODES, v);
        if (!o) return;
        S.C.mode = String(o.value);
        manual("Since 1 September: " + o.label + ".");
      });
      TOOLS.forEach(function (t) {
        S.ctl["b-" + t.id] = api.control.range("b-" + t.id, t.name + ": monthly budget ($)", 0, 1000, 50, PB[t.id], function (v) {
          var x = Math.max(0, Math.min(1000, Math.round(Number(v))));
          if (!isFinite(x)) return;
          S.C.budget[t.id] = x;
          manual(t.name + "'s budget: $" + fmt(x) + " a month (used by own accounts and the gateway).");
        });
      });
      S.ctl.sched = api.control.select("sched", "The summariser's schedule", SCHEDS, "changed", function (v) {
        var o = pick(SCHEDS, v);
        if (!o) return;
        S.C.sched = String(o.value);
        manual("Summariser: " + o.label + ".");
      });
      S.ctl.limit = api.control.select("limit", "Provider's monthly limit", LIMITS.map(function (x) { return { value: x, label: "$" + fmt(x) }; }), 1500, function (v) {
        var x = Number(v);
        if (LIMITS.indexOf(x) < 0) return;
        S.C.limit = x;
        manual("Provider limit: $" + fmt(x) + " a month.");
      });
      var days = [];
      for (var d = 0; d < DAYS; d++) days.push({ value: d, label: dayName(d) + (d === TONIGHT ? " (tonight)" : (d > TONIGHT ? " (ahead)" : "")) });
      S.ctl.day = api.control.select("day", "Day to inspect", days, OCT - 1, function (v) {
        var x = Number(v);
        if (!(x >= 0 && x < DAYS)) return;
        S.C.day = x;
        report(api, "Inspecting");
      });
      S.ctl.plan = api.control.select("plan", "Play a plan (from 01:40 tonight)", PLANS, "none", function (v) {
        var o = pick(PLANS, v);
        if (!o || o.value === "none") return;
        S.C.mode = "shared"; S.C.sched = "changed"; S.C.limit = 1500; S.C.plan = String(o.value);
        S.ctl.mode.set("shared"); S.ctl.sched.set("changed"); S.ctl.limit.set(1500);
        S.C.day = FOCUS[o.value];
        S.ctl.day.set(S.C.day);
        draw(api);
        report(api, "Plan: " + o.label + ". " + outcome(o.value, S.L));
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        setup: api.stat("setup", "setup", ""),
        limit: api.stat("limit", "provider limit a month", ""),
        day: api.stat("day", "day inspected", ""),
        sept: api.stat("sept", "September's bill", ""),
        before: api.stat("before", "month to date at 00:00", ""),
        at0100: api.stat("at0100", "month to date at 01:00", ""),
        month: api.stat("month", "month to date at the day's end", "warn"),
        busiest: api.stat("busiest", "busiest ten minutes", "warn"),
        summ: api.stat("summ", "summariser this month", ""),
        stopped: api.stat("stopped", "tools refused", "bad")
      };

      api.info("<strong>How to read it.</strong> Four tools send requests to one provider. Each request carries a key, and the provider bills the account behind it. With one shared key the usage page has one line, so nobody can see which tool spent what. The top table is one night in ten-minute bars; the bottom one is the month so far. A limit or budget refuses requests once the month's spend fills it.");

      draw(api);
      var L = S.L;
      api.log("30 September, the day of the change, before its first nightly run: one key in all four tools, the summariser weekly on Sundays at 01:00 until now. September: " +
        money(L.end[OCT - 1]) + ": work " + money(L.toolEnd[OCT - 1][0] + L.toolEnd[OCT - 1][1] + L.toolEnd[OCT - 1][2]) + ", " + L.runs[OCT - 1] +
        " summariser runs " + money(L.toolEnd[OCT - 1][3]) + ". The usage page shows one line.", "");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      function slot(d, k, i) { return money(t.api.state.L.slots[d][k][i]); }

      // 1. The opening state: 30 September, before the first nightly run.
      t.expect(t.stat("setup") === "one shared key" && t.stat("day") === "30 Sep" && t.stat("sept") === "$1,460.00" &&
        t.stat("month") === "$1,460.00" && t.stat("busiest") === "00:00 to 00:10, $0.83" && t.stat("stopped") === "none" &&
        t.logText().indexOf("September: $1,460.00: work $1,200.00, 4 summariser runs $260.00.") >= 0,
        "Opens on 30 September: one shared key, September $1,460.00 (work $1,200, 4 runs $260), nothing stopped");

      // 2. September per tool, and the stated rates.
      var L = t.api.state.L;
      var te = L.toolEnd[29];
      t.expect(money(te[0]) === "$660.00" && money(te[1]) === "$360.00" && money(te[2]) === "$180.00" && money(te[3]) === "$260.00" &&
        TOOLS[3].rate * 40 === 65 * U && (TOOLS[0].rate + TOOLS[1].rate + TOOLS[2].rate) * 480 === 40 * U,
        "September per tool: speech $660, translator $360, checker $180, summariser $260; $65 a run, $40 a day of work");

      // 3. The end of 14 October.
      t.set("day", 43);
      t.expect(t.stat("month") === "$1,470.00" && t.stat("summ") === "14 runs, $910.00" && t.stat("stopped") === "none",
        "By the end of 14 October: 14 runs $910 and 14 days of work $560, $1,470.00");

      // 4. Tonight: the limit fills during the 01:00 run.
      begin();
      t.set("day", 44);
      t.expect(t.stat("before") === "$1,470.00" && t.stat("at0100") === "$1,475.00" && t.stat("month") === "$1,500.00" &&
        t.stat("busiest") === "01:00 to 01:10, $16.25" && t.stat("summ") === "15 runs, $935.00" && slot(44, 7, 3) === "$8.75" &&
        t.stat("stopped") === "all four, 15 Oct 01:15" && has("Stopped: all four, 15 Oct 01:15."),
        "15 October: $1,475.00 at 01:00, the run adds $25 ($16.25 + $8.75), all four refused from 01:15");

      // 5. Every night since 1 October: the busiest bars are the break.
      t.expect(slot(35, 6, 3) === "$16.25" && slot(35, 9, 3) === "$16.25" && slot(35, 10, 3) === "$0.00" &&
        money(t.api.state.L.slots[35][12][0] + t.api.state.L.slots[35][12][1] + t.api.state.L.slots[35][12][2]) === "$0.83" &&
        slot(28, 6, 3) === "$0.00" && slot(26, 6, 3) === "$16.25",
        "6 October: four $16.25 bars from 01:00 to 01:40, work bars $0.83; 29 September quiet at 01:00, 27 September (a Sunday) not");

      // 6. Had the schedule stayed weekly.
      t.set("sched", "weekly");
      var w15 = t.stat("month") === "$730.00" && t.stat("stopped") === "none";
      t.set("day", 60);
      t.expect(w15 && t.stat("month") === "$1,500.00" && t.stat("stopped") === "none",
        "Weekly all along: October to the 15th $730.00; October ends at exactly $1,500.00 with nothing refused");
      t.set("sched", "changed");

      // 7. A gateway since 1 September: only the summariser stops.
      t.set("mode", "gateway");
      t.set("day", 44);
      var g = t.api.state.L;
      t.expect(t.stat("stopped") === "summariser, 6 Oct 01:15" && t.stat("month") === "$950.00" &&
        g.slots[44][12][0] > 0 && g.slots[44][12][1] > 0 && g.slots[44][12][2] > 0 && money(g.toolEnd[44][3]) === "$350.00",
        "Gateway since September, budgets 700/400/200/350: the summariser's key fills at 01:15 on 6 October; three tools run on 15 October");

      // 8. The old $250 idea stops even the weekly job.
      t.set("b-summ", 250);
      t.set("day", 29);
      t.expect(t.stat("stopped") === "summariser, 27 Sep 01:33" && t.stat("sept") === "$1,450.00",
        "A $250 budget stops the weekly job on 27 September at 01:33");
      t.set("b-summ", 350);

      // 9. Own accounts: the same ledger, one page per tool.
      begin();
      t.set("mode", "own");
      t.set("day", 44);
      t.expect(t.stat("stopped") === "summariser, 6 Oct 01:15" && t.stat("setup") === "own account per tool" && has("Stopped: summariser, 6 Oct 01:15."),
        "Own accounts since September: the summariser's own account fills at 01:15 on 6 October");

      // 10. Reply 0: raise the limit to $3,000.
      begin();
      t.set("plan", "r0");
      t.expect(has("The account fills at 29 Oct 07:40, and all four stop. October: $3,000.00.") && t.stat("stopped") === "all four, 29 Oct 07:40",
        "Raise to $3,000 at 01:40: the summariser runs on nightly and the account fills at 07:40 on 29 October");

      // 11. Replies 1 and 2.
      begin();
      t.set("plan", "r1");
      var r1 = has("Its account fills at 22 Oct 01:15") && has("October across five accounts: $2,525.00.");
      begin();
      t.set("plan", "r2");
      t.expect(r1 && has("summariser key: $65.00 between 01:00 and 01:40") && has("October: $2,435.00, under the $2,500 limit."),
        "Own accounts: the summariser's fills at 01:15 on 22 October, $2,525 in all; gateway: its key named on 17 October, $2,435");

      // 12. Reply 3: a new key.
      begin();
      t.set("plan", "r3");
      t.expect(has("the new key is still refused: the account has spent $1,500.00 of its $1,500") &&
        has("old key is refused from 16 Oct 01:00") && has("the account fills at 25 Oct 04:40."),
        "New key: still refused at 01:40; the summariser's old key fails from 01:00 on 16 October; pasted back, the account fills at 04:40 on 25 October");
    }
  });
})();
