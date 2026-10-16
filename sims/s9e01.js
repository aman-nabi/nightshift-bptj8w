/* sims/s9e01-v1.0.0.js  (published as sims/s9e01.js)
   Case s9e01 "Two Cities": a region lab for a bike-hire scheme in two cities across a border.
   Velmont (country A) has 1,240 annual members and Ostravel (country B) has 860: 2,100 in all.
   The cloud company has two regions in each country: A1 and A2 in country A, B1 and B2 in country B.
   As built, the scheme is active-passive: every member's record lives in A1 (the live copy, every
   member's home region), and a standby in B1 is kept current by continuous copying. Since Monday
   16 March 2026 a filter stops Velmont members' records leaving country A, and the Velmont records
   already in B1 were deleted. On Friday night 9 October 2026, A1 has a fault across its region at
   01:40; after 5 minutes of failed health checks B1 takes over at 01:45 holding Ostravel 860 of 860
   and Velmont 0 of 1,240.
   The learner picks the design, the copy filter, the fault, the takeover timer and whether refused
   riders may sign up again, then steps or plays 01:30 to 02:15 one minute at a time, and can run a
   drill (a takeover on purpose) to see what the takeover region holds.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls design (as built A1 to B1, a second standby in A2,
     home regions), copy filter, fault in A1, takeover timer, sign up again; buttons Next minute,
     Play to 02:15, Run a drill, Reset. Stats: time, who serves each city, unlocks, refusals,
     records outside their home country, duplicate accounts, Ostravel's extra wait, the admin
     tablet, the monthly cost, the last drill. selfTest: 11 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e01-v1.0.0.json).
   All of it is given data stated in the post and in sim.lede, and each result is checked by the selfTest.
   - Members: Velmont 1,240, Ostravel 860 (the post). 2,100 in all.
   - Unlock attempts, 01:30 to 02:15 (46 minutes): Velmont 4 a minute, Ostravel 2 a minute, each
     attempt a different member (the post: the quay's bars close at 01:30). Velmont 184, Ostravel 92.
   - The fault: A1 stops answering at 01:40. Health checks every minute; after 5 minutes without an
     answer (the timer) the standby is promoted at 01:45 and the docks' traffic moves to it.
     01:40 to 01:44 is 5 minutes of "no answer": Velmont 20, Ostravel 10.
   - As built: B1 holds Ostravel 860 and Velmont 0 (filter). From 01:45 to 02:15 (31 minutes) every
     Velmont attempt is "unknown member": 31 x 4 = 124. Velmont unlocked 10 x 4 = 40 before 01:40.
     Ostravel unlocked 10 x 2 + 31 x 2 = 82.
   - Filter off (as in January): B1 holds all 2,100, so Velmont unlocks 40 + 124 = 164, and 1,240
     Velmont records sit in country B.
   - Timer 1 minute: promoted at 01:41; no answer Velmont 4, Ostravel 2 (6); unknown 35 x 4 = 140.
   - Sign up again (fee waived): each of the 124 refused Velmont riders makes a new account on B1:
     124 duplicates, 124 new Velmont records in country B; their unlocks then work.
   - Second standby in A2 (warn): A2 holds all 2,100 and takes over at 01:45: no unknown member;
     no answer 30 for both cities; Ostravel is answered from country A all night.
   - Home regions (ok): Velmont lives in A1 with its standby in A2; Ostravel lives in B1 with its
     standby in B2. A2 takes over for Velmont at 01:45 with 1,240 of 1,240 (no answer 20, unlocks
     164). Ostravel is never touched: 92 unlocked, no extra wait.
   - Waits: a dock's question takes 0.3 s to a region in its own country and 0.8 s across the
     border: 0.5 s extra (the post).
   - Cost: about EUR 700 a month per region, live or standby, whatever it holds (given data). As built
     2 regions, 1 standby: EUR 1,400. Second standby: 3 regions, 2 standbys: EUR 2,100. Home regions:
     4 regions, 2 standbys: EUR 2,800.
   - Drills: the January drill (Tuesday 13 January 2026, before the filter) found B1 holding all
     2,100 (filter off: PASS). Any drill after 16 March finds Velmont 0 of 1,240 (FAIL).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (times in minutes after midnight) ---------- */

  var START = 90;            // 01:30
  var MINUTES = 46;          // 01:30 to 02:15, one-minute steps
  var FAULT = 100;           // 01:40, A1's regional fault
  var VEL = 1240;
  var OST = 860;
  var RATE = { v: 4, o: 2 }; // unlock attempts a minute
  var NEAR = 0.3;
  var FAR = 0.8;
  var PRICE = 700;           // euros a month per region

  var DESIGNS = [
    { value: "built", label: "as built: live copy in A1, standby in B1" },
    { value: "second", label: "a second standby in A2, inside country A" },
    { value: "home", label: "home regions: Velmont A1 and A2, Ostravel B1 and B2" }
  ];
  var FILTERS = [
    { value: "on", label: "on: Velmont records never leave country A (since March)" },
    { value: "off", label: "off: every record copied to B1 (as in January)" }
  ];
  var FAULTS = [
    { value: "on", label: "A1 fails at 01:40 (tonight)" },
    { value: "off", label: "no fault" }
  ];
  var TIMERS = [
    { value: "5", label: "5 minutes (as built)" },
    { value: "2", label: "2 minutes" },
    { value: "1", label: "1 minute" }
  ];
  var SIGNUPS = [
    { value: "off", label: "off: the 60-euro fee stays, nobody signs up" },
    { value: "on", label: "on: fee waived, every refused rider signs up on the standby" }
  ];
  var CITY = { v: "Velmont", o: "Ostravel" };
  var COUNTRY = { A1: "A", A2: "A", B1: "B", B2: "B" };
  var REGIONS = ["A1", "A2", "B1", "B2"];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hm(t) { return two(Math.floor(t / 60)) + ":" + two(t % 60); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // Records each region holds, by city; null if the design has no such region.
  function holdings(C) {
    var bv = C.filter === "on" ? 0 : VEL;
    if (C.design === "home") {
      return { A1: { v: VEL, o: 0 }, A2: { v: VEL, o: 0 }, B1: { v: 0, o: OST }, B2: { v: 0, o: OST } };
    }
    var h = { A1: { v: VEL, o: OST }, A2: null, B1: { v: bv, o: OST }, B2: null };
    if (C.design === "second") h.A2 = { v: VEL, o: OST };
    return h;
  }
  function liveFor(C, city) { return C.design === "home" && city === "o" ? "B1" : "A1"; }
  function takeoverFor(C, city) {
    if (C.design === "home") return city === "o" ? "B2" : "A2";
    return C.design === "second" ? "A2" : "B1";
  }
  function regionsUsed(C) { return C.design === "home" ? 4 : C.design === "second" ? 3 : 2; }
  function standbys(C) { return C.design === "built" ? 1 : 2; }
  function cost(C) {
    var n = regionsUsed(C);
    var s = standbys(C);
    return "€" + fmt(n * PRICE) + ": " + n + " regions, " + s + (s === 1 ? " standby" : " standbys");
  }
  function members(city) { return city === "v" ? VEL : OST; }

  // The whole night, minute by minute.
  function night(C) {
    var H = holdings(C);
    var timer = Number(C.timer);
    var fault = C.fault === "on";
    var promoteAt = FAULT + timer;
    var tot = { v: { ok: 0, none: 0, unknown: 0 }, o: { ok: 0, none: 0, unknown: 0 } };
    var newV = 0;
    var mins = [];
    var firstUnknown = true;
    for (var m = 0; m < MINUTES; m++) {
      var t = START + m;
      var a1Down = fault && t >= FAULT;
      var row = { t: t, serve: {}, events: [], summary: [] };
      if (fault && t === FAULT) {
        row.events.push({ text: hm(t) + " A1 stops answering: a fault across its whole region. Health checks start failing; the " +
          timer + "-minute timer starts." + (C.design === "home" ? " Ostravel, at home in B1, is not touched." : ""), tone: "bad" });
      }
      if (fault && t === promoteAt) {
        var tk = takeoverFor(C, "v");
        if (C.design === "home") {
          row.events.push({ text: hm(t) + " A1 silent " + timer + (timer === 1 ? " minute" : " minutes") + ": the timer runs out. A2 promoted to live for Velmont; Velmont's docks move to it. It holds Velmont " +
            fmt(H.A2.v) + " of " + fmt(VEL) + ".", tone: "ok" });
        } else {
          row.events.push({ text: hm(t) + " A1 silent " + timer + (timer === 1 ? " minute" : " minutes") + ": the timer runs out. " + tk + " promoted to live; the docks' traffic moves to it. It holds Velmont " +
            fmt(H[tk].v) + " of " + fmt(VEL) + " and Ostravel " + fmt(H[tk].o) + " of " + fmt(OST) + ".", tone: H[tk].v < VEL ? "bad" : "ok" });
        }
      }
      ["v", "o"].forEach(function (c) {
        var site = liveFor(C, c);
        if (a1Down && site === "A1") site = t >= promoteAt ? takeoverFor(C, c) : null;
        row.serve[c] = site;
        var n = RATE[c];
        if (!site) {
          tot[c].none += n;
          row.summary.push(CITY[c] + ": " + n + " no answer.");
        } else if (H[site][c] >= members(c)) {
          tot[c].ok += n;
          row.summary.push(CITY[c] + ": " + n + " unlocked by " + site + (c === "o" ? ", " + (COUNTRY[site] === "A" ? FAR : NEAR) + " s each." : "."));
        } else {
          tot[c].unknown += n;
          if (C.signup === "on") {
            newV += n;
            tot[c].ok += n;
          }
          row.summary.push(CITY[c] + ": " + n + " refused by " + site + ", unknown member" + (C.signup === "on" ? "; " + n + " sign up again there." : "."));
          if (firstUnknown) {
            firstUnknown = false;
            row.events.push({ text: hm(t) + " " + CITY[c] + ": " + n + " riders refused, unknown member. The app offers each a new sign-up" +
              (C.signup === "on" ? "; with the fee waived, all " + n + " sign up again on " + site + ": " + n + " new Velmont records in country " + COUNTRY[site] + "." : "."), tone: "bad" });
          }
        }
      });
      row.tot = { v: { ok: tot.v.ok, none: tot.v.none, unknown: tot.v.unknown }, o: { ok: tot.o.ok, none: tot.o.none, unknown: tot.o.unknown } };
      row.newV = newV;
      row.a1Down = a1Down;
      row.promoted = fault && t >= promoteAt;
      mins.push(row);
    }
    var last = mins[MINUTES - 1];
    last.events.push({ text: "02:15 Totals: Velmont " + last.tot.v.ok + " unlocked, " + last.tot.v.none + " no answer, " + last.tot.v.unknown +
      " unknown member; Ostravel " + last.tot.o.ok + " unlocked, " + last.tot.o.none + " no answer." +
      (newV ? " " + newV + " new Velmont accounts on B1, each a duplicate of a member who already has a pass." : ""), tone: last.tot.v.unknown ? "bad" : "ok" });
    return { H: H, mins: mins };
  }

  // Records outside their home country, counting each record once.
  function outside(C, H, newV) {
    var v = 0;
    var o = 0;
    ["B1", "B2"].forEach(function (r) { if (H[r]) v = Math.max(v, H[r].v); });
    ["A1", "A2"].forEach(function (r) { if (H[r]) o = Math.max(o, H[r].o); });
    return "Velmont " + fmt(v + newV) + ", Ostravel " + fmt(o);
  }

  // A drill: a takeover on purpose at a quiet hour, then check what the takeover region holds.
  function drill(C) {
    var H = holdings(C);
    var tv = takeoverFor(C, "v");
    var to = takeoverFor(C, "o");
    var v = H[tv].v;
    var o = H[to].o;
    var pass = v === VEL && o === OST;
    var res = (pass ? "PASS" : "FAIL") + ": Velmont " + fmt(v) + " of " + fmt(VEL) + ", Ostravel " + fmt(o) + " of " + fmt(OST);
    var how = C.design === "home"
      ? "A1 and then B1 switched off on purpose; after the timer, A2 holds Velmont " + fmt(v) + " of " + fmt(VEL) + " and B2 holds Ostravel " + fmt(o) + " of " + fmt(OST) + "."
      : "A1 switched off on purpose; after the timer, " + tv + " is promoted and holds Velmont " + fmt(v) + " of " + fmt(VEL) + " and Ostravel " + fmt(o) + " of " + fmt(OST) + ".";
    return { pass: pass, res: res, text: "Drill, a takeover on purpose at a quiet hour: " + how + " " +
      (pass ? "PASS." : "FAIL: every Velmont member would be unknown.") };
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
    ["region", "country", "now", "Velmont records", "Ostravel records"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var th = el("thead");
    th.appendChild(hr);
    tb.appendChild(th);
    var body = el("tbody");
    tb.appendChild(body);
    wrap.appendChild(tb);
    box.appendChild(wrap);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { el: el, head: head, body: body, sum: sum };
  }

  function roleOf(C, r, row) {
    var H = holdings(C);
    if (!H[r]) return "not built";
    if (r === "A1" && row && row.a1Down) return "down";
    var live = [];
    ["v", "o"].forEach(function (c) { if (row && row.serve[c] === r) live.push(CITY[c]); });
    if (!row && (r === "A1" || (C.design === "home" && r === "B1"))) return "live";
    if (live.length === 2) return "live";
    if (live.length === 1) return "live for " + live[0];
    if (row && row.a1Down && !row.promoted && (r === "B1" || r === "A2") && takeoverFor(C, "v") === r) return "standby, timer running";
    return "standby";
  }

  function serving(C, row, c) {
    var H = holdings(C);
    var site = row ? row.serve[c] : liveFor(C, c);
    if (!site) return "no one: timer running";
    return site + ": " + fmt(H[site][c]) + " of " + fmt(members(c));
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var N = night(C);
    var row = S.m > 0 ? N.mins[S.m - 1] : null;
    var newV = row ? row.newV : 0;
    ui.head.textContent = "Design: " + pick(DESIGNS, C.design).label + ". Copy filter: " + pick(FILTERS, C.filter).label +
      ". Fault: " + pick(FAULTS, C.fault).label + ". Takeover timer: " + pick(TIMERS, C.timer).label +
      ". Sign up again: " + pick(SIGNUPS, C.signup).label + ".";
    clear(ui.body);
    REGIONS.forEach(function (r) {
      var tr = ui.el("tr");
      var h = N.H[r];
      var extra = r === "B1" && newV ? " (+" + fmt(newV) + " new)" : "";
      [r, COUNTRY[r], roleOf(C, r, row), h ? fmt(h.v) + extra : "-", h ? fmt(h.o) : "-"].forEach(function (x) { tr.appendChild(ui.el("td", "", x)); });
      ui.body.appendChild(tr);
    });
    var tot = row ? row.tot : { v: { ok: 0, none: 0, unknown: 0 }, o: { ok: 0, none: 0, unknown: 0 } };
    S.stat.time(row ? hm(row.t) : "01:30 (not played)");
    S.stat.vel(serving(C, row, "v"));
    S.stat.ost(serving(C, row, "o"));
    S.stat.unlocks("Velmont " + tot.v.ok + ", Ostravel " + tot.o.ok);
    S.stat.refused("no answer " + (tot.v.none + tot.o.none) + ", unknown member " + (tot.v.unknown + tot.o.unknown));
    S.stat.outside(outside(C, N.H, newV));
    S.stat.dups(newV);
    var os = row ? row.serve.o : liveFor(C, "o");
    S.stat.wait(!os ? "no answer" : COUNTRY[os] === "A" ? "0.5 s an unlock" : "none");
    var vs = row ? row.serve.v : liveFor(C, "v");
    S.stat.tablet(vs ? "Velmont members: " + fmt(N.H[vs].v + (vs === "B1" ? newV : 0)) : "no answer");
    S.stat.cost(cost(C));
    S.stat.drill(S.drill || "none run");
    ui.sum.textContent = row
      ? "At " + hm(row.t) + ": " + row.summary.join(" ")
      : "Not played yet: it is 01:30 on Friday night, 9 October, and the quay's bars have just closed.";
  }

  function change(api, what) {
    api.state.m = 0;
    api.state.drill = "";
    api.log(what + " Set back to 01:30.", "");
    draw(api);
  }

  function runMinute(api, N, withSummary) {
    var S = api.state;
    var row = N.mins[S.m];
    row.events.forEach(function (e) { api.log(e.text, e.tone); });
    if (withSummary) api.log(hm(row.t) + " " + row.summary.join(" "), "");
    S.m += 1;
  }

  function step(api) {
    var S = api.state;
    if (S.m >= MINUTES) {
      api.log("02:15 has already played. Change a setting or reset to play it again.", "");
      return;
    }
    runMinute(api, night(S.C), true);
    draw(api);
  }

  function play(api) {
    var S = api.state;
    if (S.m >= MINUTES) {
      api.log("02:15 has already played. Change a setting or reset to play it again.", "");
      return;
    }
    var N = night(S.C);
    while (S.m < MINUTES) runMinute(api, N, false);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e01", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { design: "built", filter: "on", fault: "on", timer: "5", signup: "off" };
      S.m = 0;
      S.drill = "";
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("design", "Design", DESIGNS, "design");
      sel("filter", "Copy filter", FILTERS, "filter");
      sel("fault", "Fail region A1", FAULTS, "fault");
      sel("timer", "Takeover timer", TIMERS, "timer");
      sel("signup", "Sign up again", SIGNUPS, "signup");
      api.control.button("step", "Next minute", function () { step(api); });
      api.control.button("run", "Play to 02:15", function () { play(api); });
      api.control.button("drill", "Run a drill", function () {
        var d = drill(S.C);
        S.drill = d.res;
        api.log(d.text, d.pass ? "ok" : "bad");
        draw(api);
      });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time", ""),
        vel: api.stat("vel", "Velmont served by", ""),
        ost: api.stat("ost", "Ostravel served by", ""),
        unlocks: api.stat("unlocks", "unlocks so far", "ok"),
        refused: api.stat("refused", "refused so far", "bad"),
        outside: api.stat("outside", "records outside their home country", "warn"),
        dups: api.stat("dups", "duplicate accounts", "bad"),
        wait: api.stat("wait", "Ostravel's extra wait", "warn"),
        tablet: api.stat("tablet", "admin tablet", ""),
        cost: api.stat("cost", "monthly cost", ""),
        drill: api.stat("drill", "last drill", "")
      };

      api.info("<strong>How to read it.</strong> Each row is a cloud region: A1 and A2 in country A, B1 and B2 in country B. \"now\" says whether it is live (answering the docks), a standby (waiting), down, or not built. The record columns count the member records it holds for each city. Each minute, 4 Velmont riders and 2 Ostravel riders try to unlock a bike; the stats add them up.");

      api.log("Friday 9 October 2026, 01:30, as built: every record live in A1, a standby in B1, the copy filter on since March, a 5-minute takeover timer.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      var BUILT = { design: "built", filter: "on", fault: "on", timer: "5", signup: "off" };
      function as(set) { Object.keys(BUILT).forEach(function (k) { t.set(k, set && set.hasOwnProperty(k) ? set[k] : BUILT[k]); }); }
      function fresh(set) { as(set); begin(); t.click("run"); }

      // 1. Opening state: 01:30, before the fault; every record live in A1.
      t.expect(t.stat("time") === "01:30 (not played)" && t.stat("vel") === "A1: 1,240 of 1,240" && t.stat("ost") === "A1: 860 of 860" &&
        t.stat("unlocks") === "Velmont 0, Ostravel 0" && t.stat("outside") === "Velmont 0, Ostravel 860" &&
        t.stat("tablet") === "Velmont members: 1,240" && t.stat("wait") === "0.5 s an unlock" && t.stat("cost") === "€1,400: 2 regions, 1 standby" &&
        has("01:30, as built"),
        "Opens at 01:30 as built: A1 serves both cities, 860 Ostravel records sit in country A, EUR 1,400 a month");

      // 2. Step to 01:45: B1 takes over holding Ostravel 860 and Velmont 0; the tablet reads 0.
      begin();
      for (var i = 0; i < 16; i++) t.click("step");
      t.expect(t.stat("time") === "01:45" && t.stat("vel") === "B1: 0 of 1,240" && t.stat("ost") === "B1: 860 of 860" &&
        t.stat("tablet") === "Velmont members: 0" && t.stat("wait") === "none" &&
        has("01:40 A1 stops answering") &&
        has("01:45 A1 silent 5 minutes: the timer runs out. B1 promoted to live; the docks' traffic moves to it. It holds Velmont 0 of 1,240 and Ostravel 860 of 860.") &&
        has("01:45 Velmont: 4 riders refused, unknown member."),
        "Step by step to 01:45: B1 promoted, holding Ostravel 860 of 860 and Velmont 0 of 1,240; the tablet shows 0");

      // 3. Play on to 02:15 as built: 124 unknown member, 30 no answer.
      begin();
      t.click("run");
      t.expect(t.stat("time") === "02:15" && t.stat("unlocks") === "Velmont 40, Ostravel 82" &&
        t.stat("refused") === "no answer 30, unknown member 124" && t.stat("dups") === 0 &&
        has("02:15 Totals: Velmont 40 unlocked, 20 no answer, 124 unknown member; Ostravel 82 unlocked, 10 no answer."),
        "As built by 02:15: Velmont 40 unlocked, 124 unknown member; Ostravel 82 unlocked");

      // 4. Filter off (as in January): B1 holds all 2,100, but 1,240 Velmont records sit in country B.
      fresh({ filter: "off" });
      t.expect(t.stat("vel") === "B1: 1,240 of 1,240" && t.stat("outside") === "Velmont 1,240, Ostravel 860" &&
        t.stat("refused") === "no answer 30, unknown member 0" && t.stat("unlocks") === "Velmont 164, Ostravel 82",
        "Filter off: B1 serves all 1,240 Velmont members, and 1,240 Velmont records sit in country B");

      // 5. Home regions (option 2): A2 takes over for Velmont with 1,240; Ostravel never touched.
      fresh({ design: "home" });
      t.expect(t.stat("vel") === "A2: 1,240 of 1,240" && t.stat("ost") === "B1: 860 of 860" &&
        t.stat("refused") === "no answer 20, unknown member 0" && t.stat("unlocks") === "Velmont 164, Ostravel 92" &&
        t.stat("wait") === "none" && t.stat("outside") === "Velmont 0, Ostravel 0" && t.stat("cost") === "€2,800: 4 regions, 2 standbys" &&
        has("A2 promoted to live for Velmont; Velmont's docks move to it. It holds Velmont 1,240 of 1,240."),
        "Home regions: Velmont fails over to A2 with 1,240 of 1,240; Ostravel unlocks all 92 with no extra wait; EUR 2,800 a month");

      // 6. A second standby in A2 (option 1): no unknown member, but Ostravel waits on country A and pays for two idle standbys.
      fresh({ design: "second" });
      t.expect(t.stat("vel") === "A2: 1,240 of 1,240" && t.stat("ost") === "A2: 860 of 860" &&
        t.stat("refused") === "no answer 30, unknown member 0" && t.stat("wait") === "0.5 s an unlock" &&
        t.stat("outside") === "Velmont 0, Ostravel 860" && t.stat("cost") === "€2,100: 3 regions, 2 standbys",
        "Second standby in A2: everyone found, but Ostravel waits 0.5 s an unlock and 3 regions cost EUR 2,100");

      // 7. Sign up again (option 3): 124 duplicates, 124 new Velmont records in country B.
      fresh({ signup: "on" });
      t.expect(t.stat("dups") === 124 && t.stat("outside") === "Velmont 124, Ostravel 860" && t.stat("tablet") === "Velmont members: 124" &&
        has("124 new Velmont accounts on B1, each a duplicate of a member who already has a pass."),
        "Sign up again: 124 duplicate accounts, 124 new Velmont records in country B");

      // 8. A 1-minute timer: the same empty copy, sooner.
      fresh({ timer: "1" });
      t.expect(has("01:41 A1 silent 1 minute: the timer runs out. B1 promoted to live") && t.stat("vel") === "B1: 0 of 1,240" &&
        t.stat("refused") === "no answer 6, unknown member 140",
        "Timer 1 minute: B1 takes over at 01:41 with Velmont 0; 140 unknown member instead of 124");

      // 9. Drills: after March the zero shows; January's settings pass; home regions pass.
      as({});
      t.click("drill");
      var d1 = t.stat("drill") === "FAIL: Velmont 0 of 1,240, Ostravel 860 of 860";
      as({ filter: "off" });
      t.click("drill");
      var d2 = t.stat("drill") === "PASS: Velmont 1,240 of 1,240, Ostravel 860 of 860";
      as({ design: "home" });
      begin();
      t.click("drill");
      t.expect(d1 && d2 && t.stat("drill") === "PASS: Velmont 1,240 of 1,240, Ostravel 860 of 860" && has("A2 holds Velmont 1,240 of 1,240 and B2 holds Ostravel 860 of 860."),
        "Drills: after the March filter, Velmont 0 (FAIL); with January's copying, PASS; home regions, PASS");

      // 10. No fault: every unlock works, and Ostravel waits 0.5 s on each, as on every night.
      fresh({ fault: "off" });
      t.expect(t.stat("unlocks") === "Velmont 184, Ostravel 92" && t.stat("refused") === "no answer 0, unknown member 0" &&
        t.stat("vel") === "A1: 1,240 of 1,240" && t.stat("wait") === "0.5 s an unlock",
        "No fault: 184 and 92 unlocks, Ostravel answered from country A at 0.5 s extra each");

      // 11. Home regions hold under every filter, timer and sign-up setting.
      var safe = true;
      FILTERS.forEach(function (f) { TIMERS.forEach(function (tm) { SIGNUPS.forEach(function (s) {
        var C = { design: "home", filter: f.value, fault: "on", timer: tm.value, signup: s.value };
        var N = night(C);
        var end = N.mins[MINUTES - 1];
        if (end.tot.v.unknown || end.tot.o.none || end.newV || outside(C, N.H, end.newV) !== "Velmont 0, Ostravel 0") safe = false;
      }); }); });
      t.expect(safe, "Home regions: no unknown member, no Ostravel refusal and no record outside its home country, under every filter, timer and sign-up setting");
    }
  });
})();
