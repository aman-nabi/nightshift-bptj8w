/* sims/s8e07-v1.0.0.js  (published as sims/s8e07.js)
   Case s8e07 "How Fresh Is Fresh": a freshness lab for a floodlit racecourse's betting computers.
   Prices live on one main database, the leader, which copies every change to three followers. Each
   follower drives one big board, and the 120 betting terminals send their reads to the followers in
   turn: 1, 2, 3, then 1 again. On Thursday 15 October 2026 a new nightly backup on follower 3 (from
   20:00) held it 25 seconds behind. At 20:40:10 the trader cut number 6 in the 20:45 from 8/1 to 5/1
   (change 412). Terminal 17's runners screen (20:40:22, follower 1) and stake screen (20:40:26,
   follower 2) showed 5/1; its confirm screen (20:40:30, follower 3, still at change 411) showed 8/1,
   and the slip printed at 8/1, twenty seconds after the cut.
   The learner sets follower 3's lag, how terminals route reads, a price check on the leader when the
   bet is placed, a 30-second saved copy on the terminal, how fast the punter taps through, and the
   race's load, then plays 20:40:00 to 20:41:00 and reads each copy's price over time, what the punter
   saw in order, the slip's price, and the leader's reads a second against what it can answer.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls follower 3 behind, terminal reads go to, check the
     price on the leader when the bet is placed, saved copy on each terminal, punter taps through,
     load; Play 20:40:00 to 20:41:00; Reset. Stats: follower 3 behind, punter's screens, answered by,
     went backwards, slip printed at, slip against the leader, leader reads a second, leader, the
     minute. selfTest: 11 assertions.

   Where every number comes from (conventions rule 14; the case is content/s8/s8e07-v1.0.0.json).
   All of it is given data stated in sim.lede, and each result is checked by the selfTest.
   - The leader numbers every change. Change 411 is the last before the cut; change 412 at 20:40:10.0 cuts number 6 from 8/1 to 5/1. No other change until 20:41:00.
   - A follower that is L seconds behind shows, at time t, every change the leader made at or before
     t - L. Followers 1 and 2 are 0.2 s behind (under 200 ms): they show 5/1 from 20:40:10.2.
     Follower 3: 0.2 s (normal), 4 s (bigger machines, backup still running), 25 s (Thursday, the
     backup running): it shows 5/1 from 20:40:10.2, 20:40:14.0 or 20:40:35.0.
   - Terminal 17's three screens, each one read: as on Thursday, 12, 16 and 20 s after the cut
     (20:40:22, 20:40:26, 20:40:30); quick, 1, 2 and 3 s after it (20:40:11, 20:40:12, 20:40:13).
     In turn, they go to followers 1, 2 and 3. The slip prints at the confirm screen's time.
   - Thursday, in turn: follower 3 at 20:40:30 shows the leader as at 20:40:05, change 411, 8/1:
     screens 5/1, 5/1, 8/1, slip 8/1, 20 s after the cut. At 4 s: Thursday's timing gives 5/1 three
     times (follower 3 at 20:40:30 is at 20:40:26); quick gives 5/1, 5/1, 8/1 (20:40:13 is at 20:40:09).
   - At least as new as last seen: the terminal remembers the newest change it has seen (412 after
     the runners screen); a follower holding less says no and the terminal asks the next in turn.
     Follower 3 says no; follower 1 answers 5/1.
   - Saved copy: each terminal refills it every 30 s; terminal 17 refills at 20:40:05 and 20:40:35,
     the next follower in turn answering (follower 1, then 2). At 20:40:05 every copy holds change
     411, so all three screens and the slip read 8/1.
   - Check on the leader: when the bet is placed the terminal asks the leader for the price; if it
     differs from the confirm screen, it shows the leader's price and the punter confirms again.
   - Load, given data: an ordinary race, the terminals ask 300 times a second and take 2 bets a
     second; the feature race, 2,400 and 40. The leader answers about 1,000 reads a second besides
     setting prices; above that it is swamped. With saved copies, the 120 terminals refill every
     30 s: 4 reads a second. Leader reads = (reads to the leader ? 300, 2,400 or 4 : 0) + (check ? 2
     or 40 : 0): 0, 2, 40, 300, 2,400, 4, 302, 2,440.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (times in tenths of a second) ---------- */

  function at(h, m, s) { return (h * 3600 + m * 60 + s) * 10; }
  var START = at(20, 40, 0);
  var END = at(20, 41, 0);
  var CUT = at(20, 40, 10);          // change 412: number 6 from 8/1 to 5/1
  var BEFORE = { n: 411, price: "8/1" };
  var AFTER = { n: 412, price: "5/1" };
  var NEAR = 2;                      // followers 1 and 2: 0.2 s behind
  var FILLS = [at(20, 40, 5), at(20, 40, 35)];
  var CAP = 1000;                    // reads a second the leader can answer besides setting prices
  var SCREENS = ["runners", "stake", "confirm"];

  var LAGS = [
    { value: "25", label: "25 s (Thursday, backup running)" },
    { value: "4", label: "4 s (bigger machines, backup still running)" },
    { value: "0.2", label: "0.2 s (normal)" }
  ];
  var ROUTES = [
    { value: "turn", label: "the followers in turn: 1, 2, 3 (as built)" },
    { value: "leader", label: "the leader only" },
    { value: "mono", label: "in turn, but only a follower at least as new as the last change seen" }
  ];
  var CHECKS = [
    { value: "off", label: "no (as built)" },
    { value: "on", label: "yes" }
  ];
  var CACHES = [
    { value: "off", label: "none (as built)" },
    { value: "30", label: "30 s, refilled at 20:40:05 and 20:40:35" }
  ];
  var TIMINGS = [
    { value: "thursday", label: "as on Thursday: 12, 16 and 20 s after the cut" },
    { value: "quick", label: "quick: 1, 2 and 3 s after the cut" }
  ];
  var LOADS = [
    { value: "ordinary", label: "an ordinary race: 300 reads and 2 bets a second", reads: 300, bets: 2 },
    { value: "feature", label: "the feature race: 2,400 reads and 40 bets a second", reads: 2400, bets: 40 }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hms(t) {
    var s = Math.floor(t / 10);
    var d = t % 10;
    return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60) + (d ? "." + d : "");
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function secs(d) { return String(d / 10); }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // How far behind each copy is, in tenths. Copy 0 is the leader.
  function lags(C) { return [0, NEAR, NEAR, Math.round(Number(C.lag) * 10)]; }
  function copyName(k) { return k === 0 ? "the leader" : "follower " + k; }

  // What copy k holds at time t.
  function holds(C, k, t) { return t - lags(C)[k] >= CUT ? AFTER : BEFORE; }
  function fresh(C, k) { return CUT + lags(C)[k]; }

  function minute(C) {
    var r = { lines: [], shown: [], from: [], seen: 0, backwards: false, slip: "", stale: "", leaderReads: 0,
      swamped: false, outcome: "", changed: false };
    function line(t, text, tone) { r.lines.push({ t: t, text: text, tone: tone || "" }); }
    var load = pick(LOADS, C.load);
    var lead = C.route === "leader";
    var next = 1;                                    // the next follower in turn
    var saved = null;                                // the terminal's saved copy
    var gap = C.timing === "quick" ? [10, 20, 30] : [120, 160, 200];

    line(START, "Leader at change 411: number 6 at 8/1. Follower 3 is " + C.lag + " s behind" +
      (C.lag === "0.2" ? ", as on most nights." : ", the backup running."), "");

    function ask(t) {
      // One read, routed by the setting. Returns { k, h, note }.
      if (lead) return { k: 0, h: holds(C, 0, t), note: "" };
      var note = "";
      for (var tries = 0; tries < 3; tries++) {
        var k = next;
        next = next % 3 + 1;
        var h = holds(C, k, t);
        if (C.route !== "mono" || h.n >= r.seen) return { k: k, h: h, note: note };
        note += "follower " + k + " holds only change " + h.n + ", older than the " + r.seen +
          " terminal 17 has seen, and says no; ";
      }
      return { k: 0, h: holds(C, 0, t), note: note };
    }

    var events = [];
    if (C.cache === "30") FILLS.forEach(function (t) { events.push({ t: t, kind: "fill" }); });
    events.push({ t: CUT, kind: "cut" });
    gap.forEach(function (g, i) { events.push({ t: CUT + g, kind: "screen", i: i }); });
    events.sort(function (a, b) { return a.t - b.t || (a.kind === "fill" ? -1 : 1); });

    events.forEach(function (e) {
      if (e.kind === "cut") {
        line(CUT, "The trader cuts number 6 to 5/1: change 412 on the leader. Followers 1 and 2 show it from " +
          hms(fresh(C, 1)) + ", follower 3 from " + hms(fresh(C, 3)) + ".", "warn");
      } else if (e.kind === "fill") {
        if (e.t > CUT + gap[2]) return;
        var f = ask(e.t);
        saved = f.h;
        if (f.h.n > r.seen) r.seen = f.h.n;
        line(e.t, "Terminal 17 refills its saved copy from " + copyName(f.k) + ": change " + f.h.n + ", " + f.h.price + ".", "");
      } else {
        var h, k, note = "";
        if (saved) { h = saved; k = -1; }
        else { var a = ask(e.t); h = a.h; k = a.k; note = a.note; }
        if (h.n > r.seen) r.seen = h.n;
        if (r.shown.length && h.n < r.lastN) r.backwards = true;
        r.lastN = h.n;
        r.shown.push(h.price);
        r.from.push(k < 0 ? "saved copy" : copyName(k).replace("the ", ""));
        var who = k < 0 ? "read from the saved copy" : note + copyName(k) + " answers";
        line(e.t, SCREENS[e.i].charAt(0).toUpperCase() + SCREENS[e.i].slice(1) + " screen: " + who + ", change " + h.n + ", " + h.price + ".",
          r.backwards && e.i === 2 ? "bad" : "");
      }
    });

    var tBet = CUT + gap[2];
    var shownLast = r.shown[2];
    if (r.backwards) line(tBet, "The price went backwards for one person: " + r.shown.join(", then ") + ".", "bad");
    r.slip = shownLast;
    if (C.check === "on") {
      var lp = holds(C, 0, tBet).price;
      if (lp !== shownLast) {
        r.changed = true;
        line(tBet, "Bet check on the leader: " + lp + ". The confirm screen said " + shownLast +
          ", so the terminal shows the new price and the punter confirms again.", "ok");
      } else {
        line(tBet, "Bet check on the leader: " + lp + ", as shown.", "ok");
      }
      r.slip = lp;
    }
    var ago = (tBet - CUT) / 10;
    var leaderNow = holds(C, 0, tBet).price;
    r.stale = r.slip === leaderNow ? "matches the leader" : "a price cut " + ago + " s before";
    line(tBet, "Slip printed at " + r.slip + "." + (r.slip === leaderNow ? " The leader holds " + leaderNow + "." :
      " The leader has held " + leaderNow + " since 20:40:10, " + ago + " s before."), r.slip === leaderNow ? "ok" : "bad");

    var screenReads = lead ? (C.cache === "30" ? 4 : load.reads) : 0;
    r.leaderReads = screenReads + (C.check === "on" ? load.bets : 0);
    r.swamped = r.leaderReads > CAP;
    var race = load.value === "feature" ? "the feature race" : "an ordinary race";
    if (r.swamped) {
      line(END, "Load, " + race + ": " + fmt(r.leaderReads) + " reads a second on the leader against the " +
        fmt(CAP) + " it can answer: swamped. Screens wait in line, and the trader's price changes wait behind them.", "bad");
    } else {
      line(END, "Load, " + race + ": " + fmt(r.leaderReads) + " reads a second on the leader, of the " +
        fmt(CAP) + " it can answer.", "");
    }
    r.outcome = r.swamped ? "leader swamped" : r.backwards ? "went backwards" : r.slip !== leaderNow ? "stale slip" : "fresh and forward";
    return r;
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
    function table(heads) {
      var wrap = el("div", "overflow-x:auto;");
      var tb = el("table", "width:100%;font-size:12px;");
      var hr = el("tr");
      heads.forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
      var th = el("thead");
      th.appendChild(hr);
      tb.appendChild(th);
      var body = el("tbody");
      tb.appendChild(body);
      wrap.appendChild(tb);
      return { wrap: wrap, body: body };
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var ct = table(["copy", "behind the leader", "number 6 at 5/1 from"]);
    box.appendChild(ct.wrap);
    var pt = table(["screen", "time", "answered by", "change", "price shown"]);
    box.appendChild(pt.wrap);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { el: el, head: head, copies: ct.body, screens: pt.body, sum: sum };
  }

  function row(ui, body, cells) {
    var tr = ui.el("tr");
    cells.forEach(function (x) { tr.appendChild(ui.el("td", "", String(x))); });
    body.appendChild(tr);
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "Follower 3 behind: " + pick(LAGS, C.lag).label + ". Reads go to: " + pick(ROUTES, C.route).label +
      ". Check on the leader: " + pick(CHECKS, C.check).label + ". Saved copy: " + pick(CACHES, C.cache).label +
      ". Punter: " + pick(TIMINGS, C.timing).label + ". Load: " + pick(LOADS, C.load).label + ".";
    clear(ui.copies);
    clear(ui.screens);
    S.stat.f3(C.lag + " s");
    var L = lags(C);
    [0, 1, 2, 3].forEach(function (k) {
      var name = copyName(k).replace("the ", "");
      row(ui, ui.copies, [name, L[k] ? secs(L[k]) + " s" : "-", hms(fresh(C, k))]);
    });
    if (!S.ran) {
      ui.sum.textContent = "Not played yet: it is 20:40:00, ten seconds before the cut, and every copy shows number 6 at 8/1.";
      ["screens", "from", "back", "slip", "stale", "lreads", "leader", "outcome"].forEach(function (k) { S.stat[k]("not played yet"); });
      return;
    }
    var N = minute(C);
    var gap = C.timing === "quick" ? [10, 20, 30] : [120, 160, 200];
    SCREENS.forEach(function (s, i) {
      row(ui, ui.screens, [s, hms(CUT + gap[i]), N.from[i], N.shown[i] === "5/1" ? 412 : 411, N.shown[i]]);
    });
    ui.sum.textContent = "Number 6's slip printed at " + N.slip + " (" + N.stale + ")." + (N.changed ? " The leader's check changed the price before printing." : "") +
      " Leader: " + fmt(N.leaderReads) + " reads a second, " + (N.swamped ? "swamped." : "coping.");
    S.stat.screens(N.shown.join(", "));
    S.stat.from(N.from.join(", "));
    S.stat.back(N.backwards ? "yes" : "no");
    S.stat.slip(N.slip);
    S.stat.stale(N.stale);
    S.stat.lreads(fmt(N.leaderReads));
    S.stat.leader(N.swamped ? "swamped" : "coping");
    S.stat.outcome(N.outcome);
  }

  function change(api, what) {
    api.state.ran = false;
    api.log(what + " Set back to 20:40:00, before the cut.", "");
    draw(api);
  }

  function play(api) {
    var S = api.state;
    if (S.ran) {
      api.log("20:40:00 to 20:41:00 has already played. Change a setting or reset to play it again.", "");
      return;
    }
    var N = minute(S.C);
    N.lines.forEach(function (l) { api.log(hms(l.t) + " " + l.text, l.tone); });
    api.log("20:41:00: screens " + N.shown.join(", ") + "; slip " + N.slip + "; went backwards: " + (N.backwards ? "yes" : "no") + ".",
      N.backwards || N.swamped || N.stale !== "matches the leader" ? "bad" : "ok");
    S.ran = true;
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s8e07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { lag: "25", route: "turn", check: "off", cache: "off", timing: "thursday", load: "ordinary" };
      S.ran = false;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("lag", "Follower 3 behind the leader", LAGS, "lag");
      sel("route", "Terminal reads go to", ROUTES, "route");
      sel("check", "Check the price on the leader when the bet is placed", CHECKS, "check");
      sel("cache", "Saved copy on each terminal", CACHES, "cache");
      sel("timing", "The punter taps through", TIMINGS, "timing");
      sel("load", "Load", LOADS, "load");
      api.control.button("run", "Play 20:40:00 to 20:41:00", function () { play(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        f3: api.stat("f3", "follower 3 behind", "warn"),
        screens: api.stat("screens", "punter's screens, in order", ""),
        from: api.stat("from", "answered by", ""),
        back: api.stat("back", "went backwards", "bad"),
        slip: api.stat("slip", "slip printed at", ""),
        stale: api.stat("stale", "slip against the leader", "warn"),
        lreads: api.stat("lreads", "leader reads a second", ""),
        leader: api.stat("leader", "leader", "bad"),
        outcome: api.stat("outcome", "the minute", "")
      };

      api.info("<strong>How to read it.</strong> The first table shows each copy of the prices: how far behind the leader it is, and from when it shows number 6 at 5/1. The second shows terminal 17's three screens in order: which copy answered, the newest change it held, and the price it showed. The slip prints at the confirm screen's price, or the leader's when the check is on.");

      api.log("Thursday 15 October 2026, 20:40:00, as built: reads go to the followers in turn, no check on the leader, no saved copy, follower 3 25 s behind.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function as(set) { Object.keys(set).forEach(function (k) { t.set(k, set[k]); }); }
      var BUILT = { lag: "25", route: "turn", check: "off", cache: "off", timing: "thursday", load: "ordinary" };

      // 1. Opening state: 20:40:00, before the cut, nothing played.
      t.expect(t.stat("slip") === "not played yet" && t.stat("back") === "not played yet" && t.stat("f3") === "25 s" &&
        has("20:40:00, as built"),
        "Opens at 20:40:00 before the cut, follower 3 25 s behind, nothing played");

      // 2. As built: 5/1, 5/1, then 8/1 from follower 3; the slip prints at 8/1, 20 s after the cut.
      t.click("run");
      t.expect(t.stat("screens") === "5/1, 5/1, 8/1" && t.stat("from") === "follower 1, follower 2, follower 3" &&
        t.stat("back") === "yes" && t.stat("slip") === "8/1" && t.stat("stale") === "a price cut 20 s before" &&
        t.stat("lreads") === 0 && has("Confirm screen: follower 3 answers, change 411, 8/1.") &&
        has("Followers 1 and 2 show it from 20:40:10.2, follower 3 from 20:40:35."),
        "As built: runners 5/1 (follower 1), stake 5/1 (follower 2), confirm 8/1 (follower 3, change 411); slip 8/1, 20 s after the cut");

      // 3. A second play is refused until something changes.
      t.click("run");
      t.expect(has("has already played."), "A second play is refused");

      // 4. Option 1: at least as new as last seen, and the check on the leader.
      as({ route: "mono", check: "on" });
      t.click("run");
      t.expect(t.stat("screens") === "5/1, 5/1, 5/1" && t.stat("from") === "follower 1, follower 2, follower 1" &&
        t.stat("back") === "no" && t.stat("slip") === "5/1" && t.stat("stale") === "matches the leader" &&
        t.stat("lreads") === 2 && t.stat("leader") === "coping" &&
        has("follower 3 holds only change 411, older than the 412 terminal 17 has seen, and says no; follower 1 answers"),
        "Option 1: follower 3 says no, follower 1 answers 5/1; slip 5/1; 2 reads a second on the leader");

      // 5. Option 1 on the feature race, with a quick punter: still forward, and 40 reads a second.
      as({ load: "feature", timing: "quick" });
      t.click("run");
      t.expect(t.stat("screens") === "5/1, 5/1, 5/1" && t.stat("slip") === "5/1" && t.stat("lreads") === 40 &&
        t.stat("leader") === "coping",
        "Option 1, feature race, quick punter: 5/1 throughout, the leader takes 40 bet checks a second");

      // 6. Option 2: the leader only. Fresh, until the feature race swamps it.
      as({ route: "leader", check: "off", load: "ordinary", timing: "thursday" });
      t.click("run");
      var ordinary = t.stat("screens") === "5/1, 5/1, 5/1" && t.stat("slip") === "5/1" && t.stat("lreads") === 300 && t.stat("leader") === "coping";
      t.set("load", "feature");
      t.click("run");
      t.expect(ordinary && t.stat("lreads") === "2,400" && t.stat("leader") === "swamped" &&
        has("2,400 reads a second on the leader against the 1,000 it can answer: swamped."),
        "Option 2: 300 reads a second on an ordinary race; 2,400 on the feature race against 1,000, swamped");

      // 7. Option 0: bigger machines, follower 3 4 s behind. Thursday's punter is fine; a quick one is not.
      as({ route: "turn", load: "ordinary", lag: "4" });
      t.click("run");
      var slow = t.stat("screens") === "5/1, 5/1, 5/1" && t.stat("back") === "no";
      t.set("timing", "quick");
      t.click("run");
      t.expect(slow && t.stat("screens") === "5/1, 5/1, 8/1" && t.stat("back") === "yes" && t.stat("slip") === "8/1" &&
        t.stat("stale") === "a price cut 3 s before",
        "Option 0: at 4 s behind, Thursday's timing sees 5/1 throughout; a quick punter sees 5/1, 5/1, 8/1 and is paid 8/1");

      // 8. Option 3: a 30-second saved copy. The screens agree with each other, and all show 8/1.
      as(BUILT);
      t.set("cache", "30");
      t.click("run");
      t.expect(t.stat("screens") === "8/1, 8/1, 8/1" && t.stat("back") === "no" && t.stat("slip") === "8/1" &&
        t.stat("stale") === "a price cut 20 s before" && t.stat("from") === "saved copy, saved copy, saved copy" &&
        has("Terminal 17 refills its saved copy from follower 1: change 411, 8/1."),
        "Option 3: the saved copy filled at 20:40:05 shows 8/1 on all three screens; slip 8/1, 20 s after the cut");

      // 9. Why never before: followers under 200 ms behind, so nobody can see the gap.
      as(BUILT);
      t.set("lag", "0.2");
      t.click("run");
      var quiet = t.stat("screens") === "5/1, 5/1, 5/1" && t.stat("back") === "no";
      t.set("timing", "quick");
      t.click("run");
      t.expect(quiet && t.stat("screens") === "5/1, 5/1, 5/1" && t.stat("slip") === "5/1",
        "Follower 3 0.2 s behind: 5/1 on every screen, at either timing");

      // 10. In turn with the check alone: the screen still goes backwards, but the slip prints 5/1.
      as(BUILT);
      t.set("check", "on");
      t.click("run");
      t.expect(t.stat("back") === "yes" && t.stat("slip") === "5/1" &&
        has("The confirm screen said 8/1, so the terminal shows the new price and the punter confirms again."),
        "Check alone: 5/1, 5/1, 8/1 on screen, then the leader's 5/1 on the slip");

      // 11. Option 1 never goes backwards and prints 5/1 under every lag, timing, load and saved copy.
      var safe = true;
      LAGS.forEach(function (l) { TIMINGS.forEach(function (g) { LOADS.forEach(function (d) { CACHES.forEach(function (c) {
        var n = minute({ lag: l.value, route: "mono", check: "on", cache: c.value, timing: g.value, load: d.value });
        if (n.backwards || n.slip !== "5/1" || n.swamped) safe = false;
      }); }); }); });
      t.expect(safe, "Option 1: never backwards, slip 5/1 and the leader coping under every setting");
    }
  });
})();
