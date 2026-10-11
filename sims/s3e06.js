/* sims/s3e06-v1.0.0.js  (published as sims/s3e06.js)
   Case s3e06 "Two Leaders": a two-leader and quorum lab for the commune of Kesselwand, which keeps
   one book in two council halls, east and west, with the Hornjoch pass between them. Each hall
   accepts decisions into its own book (each hall is a leader), and every morning at 07:00 the
   runner, Fridolin, carries the west book over the pass and merges the two. Part 1 replays the
   three days of snow under a merge rule the learner picks; Part 2 is a row of up to five books
   with N, W and R sliders, a "books you can reach" slider and a sloppy quorum switch.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: Part 1 is a list of events (the snow, six writes, the
     runner's crossings), fired one at a time by Next event, every 2 real seconds while Play is on,
     or all at once by Play to the end. Rules: latest entry wins (as now), keep both versions,
     one home hall per matter (keep both where a matter has no home), both halls must sign.
     Controls: rule, west clock fast by 0 to 15 minutes, pass shut 1 to 5 days. Stats: kept,
     struck without a word, two versions for the council, waited for the pass, longest wait.
     Part 2: N, W, R, books you can reach (1 to 5) and sloppy quorum. Stats: write waits for,
     read waits for, books shared at least, can a read miss the write, write, read.
     selfTest: 18 assertions, one of them a brute-force check of R + W > N over every
     combination with N up to 5.

   Where every number comes from (conventions rule 14; the case is content/s3/s3e06-v1.0.0.json):
   - post: Fridolin crosses at 07:00 every morning; snow shuts the Hornjoch on the first afternoon
     (13:00 here) and nothing crosses for three days, so his next crossing is day 4, 07:00. The
     rule over both doors: where the books differ, the later entry stands. The east clock agrees
     with Fridolin's pocket watch; the west hall's pendulum clock is 11 minutes fast.
   - the six entries in Fridolin's merge log (true time, by his watch, then each book's stamp):
       west  day 1 21:33  Councillor Rosmarie Tschudin, pass road OPEN (for the supply cart)
             stamped 21:33 + 11 min = 21:44
       east  day 1 21:40  Councillor Gaudenz Imboden, pass road CLOSED (the slope above the third
             bend), stamped 21:40
       west  day 2 09:10  woodpile, two baskets a house, stamped 09:21
       east  day 2 14:25  school SHUT until the pass opens, stamped 14:25
       east  day 3 18:02:10  night bell HOURLY, stamped 18:02
       west  day 3 18:02:40  night bell MIDNIGHT only, stamped 18:13 (18:02:40 + 11 min, minutes only)
     Books record the minute only. The west entry is really 7 minutes older than the east one
     (21:33 against 21:40) but stamped 4 minutes later (21:44 against 21:40), so "latest wins"
     keeps OPEN and strikes CLOSED from both books. The bell: 18:13 beats 18:02, HOURLY struck.
     Merge as now: 6 entries, 4 kept, 2 struck.
   - before the snow both books say: pass road open, woodpile one basket, school open, night bell
     silent.
   - homes (the ok option): the pass road and the school belong to the east hall (it watches the
     slope above the third bend and runs the school), the woodpile to the west hall, and the night
     bell to neither (the chapel serves both valleys).

   Teaching model (stated in sim.lede):
   - Time t is true time in seconds from day 1, 00:00. A west stamp is t + 60 x (minutes fast);
     an east stamp is t. A stamp is compared in whole minutes. Latest wins keeps the later
     stamp; a tie goes to the east book. The loser is struck from its own book and nobody is told.
   - Crossings: the first at 07:00 on day 1 + D (D = days the pass is shut), then every morning
     until one comes after the last write. A crossing merges everything written since the last.
   - Keep both: two entries on one matter go into both books as two versions for the council.
   - Home hall: a hall may write only the matters it owns; any other write becomes a request in
     Fridolin's bag, delivered at the next crossing (waited for the pass). A matter with no home
     keeps both versions.
   - Both halls sign: every write is a proposal that waits for the next crossing and still needs
     the other hall's signature, so nothing is decided while the pass is shut.
   - Kept counts entries in the books after merging (one per single or winning entry, two for a
     matter with two versions). A request or an unsigned proposal is not kept.

   Self-test arithmetic:
   - Latest wins, 11 min: pass road 21:44 > 21:40, OPEN kept, CLOSED struck; woodpile and school
     copied; bell 18:13 > 18:02, MIDNIGHT kept, HOURLY struck: kept 4, struck 2.
   - 1 min fast (the church bell option): west 21:34 < 21:40, CLOSED kept, OPEN struck; bell west
     18:03 > 18:02, HOURLY struck: still 2 struck. 0 min: bell 18:02 = 18:02, a tie, east kept,
     MIDNIGHT struck: still 2. 7 min: 21:40 = 21:40, tie, CLOSED kept. 8 min: 21:41, OPEN kept.
   - Keep both: 6 kept, 0 struck, 2 matters with two versions.
   - Home hall: OPEN refused in the west (request), kept 5 (CLOSED, two baskets, SHUT, HOURLY and
     MIDNIGHT as two versions), 0 struck, 1 with two versions, 1 waited. Wait: day 4 07:00 is
     284,400 s; 21:33 on day 1 is 77,580 s; 206,820 s = 57 h 27 min. Pass shut 1 day: first
     crossing day 2 07:00 = 111,600 s; 111,600 - 77,580 = 34,020 s = 9 h 27 min.
   - Both halls sign, 3 days: 6 waited, kept 0, longest 57 h 27 min (the 21:33 proposal).
   - Part 2: a write lands on W books, and the worst read asks the R books furthest from them.
     A read can miss the write exactly when the written books and the read books can be disjoint,
     W + R <= N; the books shared are at least W + R - N. N 3, W 2, R 2: shared at least 1, no
     miss. N 3, W 1, R 1: shared 0, a read can miss. Reach 1 of 3 with W 2: refused. With the
     sloppy quorum on: book 1 and stand-in book 4, so only 1 real book holds the write, and
     1 + 2 <= 3: a read of 2 can miss it.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px,
   group label 11px):
   - Part 1 groups (y 34 to 380): east x 20 to 250, west x 490 to 720. Book boxes 210 wide, 46
     high, centres x 135 and x 605, y 82, 168, 254, 340: tops 59, 145, 231, 317 and bottoms 105,
     191, 277, 363, 40px apart; the group label baseline is y 51. Longest label "Night bell · no
     home" 20 chars, 156px; longest sub "both: HOURLY / MIDNIGHT" or "proposal: MIDNIGHT" 23 chars,
     166px; "two baskets · 09:21 d2" 22 chars, 158px.
   - Middle column, 170 wide at x 370 (285 to 455): Hornjoch pass y 82 (51 to 113), merge y 200 (169
     to 231), west clock y 330 (299 to 361). Longest meta "Fridolin: day 6, 07:00" 22 chars,
     145px; longest sub "home hall, keep both" 20 chars, 144px.
   - Part 2 group y 410 to 612. Writer and reader 150 wide at x 110, y 470 and 566 (447 to 493 and
     543 to 589, 50px apart). Books 80 wide, 62 high, at x 270, 362, 454, 546, 638 (230 to 678),
     y 518 (487 to 549). Longest sub "stand-in" or "not in N", 8 chars, 58px; longest meta
     "cut off, read" 13 chars, 86px, the one line allowed to run a few px past an 80px box, so
     the meta for a cut-off book in the read set is shortened to "cut off" (7 chars, 46px).
     Writer edges run along y 470 and drop to each book's top; reader edges run along y 566 and
     rise to each book's bottom.

   Catalog note: the case's concepts are the catalog's ids for s3e06 (multi-leader,
   leaderless-replication, conflicts, quorums).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var DAY = 86400;
  function T(d, h, m, s) { return (d - 1) * DAY + h * 3600 + m * 60 + (s || 0); }

  var START = T(1, 7, 0, 0);               // day 1, 07:00: Fridolin has just crossed
  var SNOW_AT = T(1, 13, 0, 0);            // day 1, 13:00: snow shuts the Hornjoch
  var CROSS_H = 7;                         // he crosses at 07:00
  var GAP = 2;                             // real seconds between events while playing
  var SKEW0 = 11;                          // the west clock, minutes fast
  var DAYS0 = 3;                           // days the pass is shut

  var HALLS = ["east", "west"];
  var MATTERS = ["road", "wood", "school", "bell"];
  var M = {
    road: { name: "Pass road", home: "east", init: "open" },
    wood: { name: "Woodpile", home: "west", init: "one basket" },
    school: { name: "School", home: "east", init: "open" },
    bell: { name: "Night bell", home: null, init: "silent" }
  };

  var WRITES = [
    { id: "w1", hall: "west", matter: "road", t: T(1, 21, 33, 0), val: "OPEN",
      who: "Councillor Rosmarie Tschudin", what: "the pass road OPEN, to clear it for the supply cart" },
    { id: "e1", hall: "east", matter: "road", t: T(1, 21, 40, 0), val: "CLOSED",
      who: "Councillor Gaudenz Imboden", what: "the pass road CLOSED: the slope above the third bend is settling" },
    { id: "w2", hall: "west", matter: "wood", t: T(2, 9, 10, 0), val: "two baskets",
      who: "the council", what: "the woodpile at two baskets a house" },
    { id: "e2", hall: "east", matter: "school", t: T(2, 14, 25, 0), val: "SHUT",
      who: "the council", what: "the school SHUT until the pass opens" },
    { id: "e3", hall: "east", matter: "bell", t: T(3, 18, 2, 10), val: "HOURLY",
      who: "the council", what: "the night bell HOURLY, for anyone lost on the pass" },
    { id: "w3", hall: "west", matter: "bell", t: T(3, 18, 2, 40), val: "MIDNIGHT",
      who: "the council", what: "the night bell at MIDNIGHT only" }
  ];
  var LAST_WRITE = WRITES[WRITES.length - 1].t;

  var RULES = [
    { value: "lww", label: "Latest entry wins (as now)" },
    { value: "sibs", label: "Keep both versions for the council" },
    { value: "home", label: "One home hall per matter, keep both otherwise" },
    { value: "both", label: "Both halls must sign every decision" }
  ];
  var RULE_SHORT = { lww: "latest entry wins", sibs: "keep both versions", home: "home hall, keep both", both: "both halls sign" };

  var MAXB = 5;
  var BOOK_X = [270, 362, 454, 546, 638];
  var WRITER_Y = 470;
  var READER_Y = 566;

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hm(sec) {
    var s = ((sec % DAY) + DAY) % DAY;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60));
  }
  function dayOf(sec) { return Math.floor(sec / DAY) + 1; }
  function when(sec) { return "Day " + dayOf(sec) + ", " + hm(sec); }
  function dur(s) { return Math.floor(s / 3600) + " h " + Math.floor((s % 3600) / 60) + " min"; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function other(h) { return h === "east" ? "west" : "east"; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  // The stamp a hall's clock writes for a true time, in seconds; books compare whole minutes.
  function stampOf(S, hall, t) { return t + (hall === "west" ? S.skew * 60 : 0); }
  function desc(e) { return e.val + " at " + hm(e.stamp) + " day " + dayOf(e.stamp); }
  function short(e) { return e.val + " · " + hm(e.stamp) + " d" + dayOf(e.stamp); }

  /* ---------- pure functions the display and self-tests read ---------- */

  // Part 2: can some read of R books miss a write held by k of the N books? Only if the
  // k written books and some R books can be disjoint, which needs k + R <= N.
  function canMiss(N, k, R) { return k + R <= N; }
  function sharedAtLeast(N, k, R) { return Math.max(0, k + R - N); }

  // The runner's crossings for a pass shut D days: 07:00 on day 1 + D, then each morning until
  // one comes after the last write.
  function crossings(D) {
    var out = [];
    for (var k = 1; k < 20; k++) {
      var c = T(D + k, CROSS_H, 0, 0);
      out.push(c);
      if (c > LAST_WRITE) break;
    }
    return out;
  }

  /* ---------- the diagram ---------- */

  function bookNode(hall, m, x, y) {
    return { id: hall.charAt(0) + "_" + m, label: M[m].name, sub: M[m].init, x: x, y: y, w: 210, h: 46, shape: "box", tone: "" };
  }

  var NODES = [];
  MATTERS.forEach(function (m, i) {
    NODES.push(bookNode("east", m, 135, 82 + 86 * i));
    NODES.push(bookNode("west", m, 605, 82 + 86 * i));
  });
  NODES.push({ id: "pass", label: "Hornjoch pass", sub: "open", meta: "Fridolin: day 4, 07:00", x: 370, y: 82, w: 170, h: 62, shape: "cloud", tone: "ok" });
  NODES.push({ id: "merge", label: "Fridolin's merge", sub: "latest entry wins", meta: "not yet", x: 370, y: 200, w: 170, h: 62, shape: "box", tone: "" });
  NODES.push({ id: "clock", label: "West hall clock", sub: "11 min fast", meta: "east clock: right", x: 370, y: 330, w: 170, h: 62, shape: "box", tone: "warn" });
  NODES.push({ id: "writer", label: "Writer", sub: "waits for 2 of 3", x: 110, y: WRITER_Y, w: 150, h: 46, shape: "box", tone: "" });
  NODES.push({ id: "reader", label: "Reader", sub: "waits for 2 of 3", x: 110, y: READER_Y, w: 150, h: 46, shape: "box", tone: "" });
  for (var bi = 0; bi < MAXB; bi++) {
    NODES.push({ id: "b" + (bi + 1), label: "Book " + (bi + 1), sub: "v1 old", meta: "", x: BOOK_X[bi], y: 518, w: 80, h: 62, shape: "db", tone: "" });
  }

  var EDGES = [
    { from: "e_road", to: "pass" },
    { from: "pass", to: "w_road" },
    { from: "pass", to: "merge", dash: true, tone: "muted" }
  ];
  for (var be = 0; be < MAXB; be++) {
    EDGES.push({ from: "writer", to: "b" + (be + 1), via: [[BOOK_X[be], WRITER_Y]] });
    EDGES.push({ from: "reader", to: "b" + (be + 1), via: [[BOOK_X[be], READER_Y]] });
  }

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 620,
    aria: "Two-leader and quorum lab for the commune of Kesselwand. Part 1: the east and west halls each keep a book with four matters, the pass road, the woodpile, the school and the night bell. The Hornjoch pass lies between them, Fridolin's merge below it, and the west hall's clock below that. Part 2: a writer and a reader, and a row of five books, of which N hold each record.",
    groups: [
      { label: "East hall book", x: 20, y: 34, w: 230, h: 346 },
      { label: "West hall book", x: 490, y: 34, w: 230, h: 346 },
      { label: "Part 2: quorum books", x: 20, y: 410, w: 700, h: 202 }
    ],
    nodes: NODES,
    edges: EDGES
  };

  /* ---------- Part 1: the snow ---------- */

  function buildEvents(S) {
    var ev = [{ kind: "snow", t: SNOW_AT }];
    WRITES.forEach(function (w) { ev.push({ kind: "write", t: w.t, w: w }); });
    S.cross = crossings(S.days);
    S.cross.forEach(function (c) { ev.push({ kind: "cross", t: c }); });
    ev.sort(function (a, b) { return a.t - b.t; });
    return ev;
  }

  function startSnow(api) {
    var S = api.state;
    S.books = { east: {}, west: {} };
    HALLS.forEach(function (h) {
      MATTERS.forEach(function (m) { S.books[h][m] = { status: "base", val: M[m].init }; });
    });
    S.batch = {};
    S.req = [];
    S.kept = 0;
    S.dropped = 0;
    S.sibs = 0;
    S.waited = 0;
    S.longest = -1;
    S.passState = "open";
    S.ev = buildEvents(S);
    S.k = 0;
    S.acc = 0;
    S.done = false;
    api.clock = START;
    api.log(when(START) + " Fridolin has crossed the Hornjoch, and the two books agree. Rule: " + RULE_SHORT[S.rule] +
      ". The west clock is " + (S.skew ? S.skew + " min fast" : "right") + ". Snow will shut the pass at 13:00; his next crossing is " +
      when(S.cross[0]) + ".", "");
    draw(api);
  }

  function replay(api, what) {
    api.log(what + " Replaying from day 1, 07:00.", "");
    startSnow(api);
  }

  function fireWrite(api, w) {
    var S = api.state;
    var hall = w.hall;
    var stamp = stampOf(S, hall, w.t);
    var head = when(w.t) + " " + cap(hall) + " hall: " + w.who;
    var home = M[w.matter].home;
    if (S.rule === "both") {
      S.req.push({ w: w });
      S.waited += 1;
      S.books[hall][w.matter] = { status: "proposal", val: w.val };
      api.log(head + " proposes " + w.what + ". Nothing changes until the " + other(hall) + " hall signs.", "warn");
      return;
    }
    if (S.rule === "home" && home && home !== hall) {
      S.req.push({ w: w });
      S.waited += 1;
      S.books[hall][w.matter].request = true;
      api.log(head + " asks for " + w.what + ". The " + M[w.matter].name.toLowerCase() + " belongs to the " + home +
        " hall, so the " + hall + " book doesn't change: the request goes in Fridolin's bag.", "warn");
      return;
    }
    var e = { w: w, hall: hall, val: w.val, stamp: stamp, min: Math.floor(stamp / 60) };
    if (!S.batch[w.matter]) S.batch[w.matter] = {};
    S.batch[w.matter][hall] = e;
    S.books[hall][w.matter] = { status: "local", val: w.val, e: e };
    api.log(head + " writes " + w.what + ". The " + hall + " clock says " + hm(stamp) + ".", "");
  }

  function fireCross(api, c) {
    var S = api.state;
    var first = S.passState !== "again";
    S.passState = "again";
    api.log(when(c) + " Fridolin crosses the Hornjoch" + (first ? ", open again," : "") + " and merges the books.", "");
    MATTERS.forEach(function (m) {
      var b = S.batch[m];
      if (!b) return;
      var name = M[m].name;
      if (b.east && b.west) {
        if (S.rule === "lww") {
          var eastWins = b.east.min >= b.west.min;
          var win = eastWins ? b.east : b.west;
          var lose = eastWins ? b.west : b.east;
          var tie = b.east.min === b.west.min;
          S.books[win.hall][m] = { status: "merged", val: win.val, e: win };
          S.books[lose.hall][m] = { status: "struck", val: win.val, e: win };
          S.kept += 1;
          S.dropped += 1;
          api.log(name + ": east " + desc(b.east) + ", west " + desc(b.west) + ". " +
            (tie ? "A tie goes to the east book: " : "Latest wins: ") + win.val + ". " + lose.val +
            " is struck from the " + lose.hall + " book, and nobody is told.", "bad");
        } else {
          HALLS.forEach(function (h) { S.books[h][m] = { status: "sibs", val: b.east.val + " / " + b.west.val }; });
          S.kept += 2;
          S.sibs += 1;
          api.log(name + ": east " + desc(b.east) + ", west " + desc(b.west) +
            ". Both versions go into both books, for the council to settle.", "warn");
        }
      } else {
        var e = b.east || b.west;
        S.books[e.hall][m] = { status: "merged", val: e.val, e: e };
        S.books[other(e.hall)][m] = { status: "merged", val: e.val, e: e };
        S.kept += 1;
        api.log(name + ": only the " + e.hall + " book has an entry, " + desc(e) + ". Copied to the " + other(e.hall) + " book.", "ok");
      }
    });
    S.batch = {};
    if (S.req.length) {
      var oldest = 0;
      S.req.forEach(function (r) {
        var wait = c - r.w.t;
        if (wait > oldest) oldest = wait;
        if (wait > S.longest) S.longest = wait;
      });
      if (S.rule === "both") {
        api.log(S.req.length + (S.req.length === 1 ? " proposal reaches" : " proposals reach") + " the other hall, the oldest after " +
          dur(oldest) + ". Nothing was decided while the pass was shut.", "warn");
      } else {
        S.req.forEach(function (r) {
          var w = r.w;
          var home = M[w.matter].home;
          S.books[w.hall][w.matter].request = false;
          api.log("The " + w.hall + " hall's request, the " + M[w.matter].name.toLowerCase() + " " + w.val + ", reaches the " + home +
            " hall after " + dur(c - w.t) + ". The " + home + " book's entry stands until the " + home + " hall decides.", "warn");
        });
      }
      S.req = [];
    }
  }

  function fire(api) {
    var S = api.state;
    if (S.done) return;
    var ev = S.ev[S.k];
    api.clock = ev.t % DAY;
    if (ev.kind === "snow") {
      S.passState = "shut";
      api.log(when(ev.t) + " Snow shuts the Hornjoch. Fridolin can't cross again until " + when(S.cross[0]) + ".", "warn");
    } else if (ev.kind === "write") {
      fireWrite(api, ev.w);
    } else {
      fireCross(api, ev.t);
    }
    S.k += 1;
    if (S.k >= S.ev.length) {
      S.done = true;
      api.log("Merge done: " + S.kept + " kept, " + S.dropped + " struck without a word, " + S.sibs +
        " with two versions for the council, " + S.waited + " waited for the pass.", S.dropped ? "bad" : "ok");
    }
    draw(api);
  }

  function playToEnd(api) {
    var guard = 0;
    while (!api.state.done && guard < 100) { fire(api); guard += 1; }
  }

  /* ---------- Part 2: quorums ---------- */

  function quorum(S) {
    var N = S.N;
    var k = Math.min(S.reach, N);
    var q = { N: N, W: S.W, R: S.R, reach: k, ok: false, real: 0, stand: 0, readOk: k >= S.R };
    if (k >= S.W) { q.ok = true; q.real = S.W; }
    else if (S.sloppy) { q.ok = true; q.real = k; q.stand = S.W - k; }
    q.miss = q.ok && canMiss(N, q.real, S.R);
    q.shared = q.ok ? sharedAtLeast(N, q.real, S.R) : 0;
    return q;
  }

  function quorumLog(api) {
    var S = api.state;
    var q = quorum(S);
    var s = "Part 2: N " + q.N + ", W " + q.W + ", R " + q.R + ". You can reach " + q.reach + " of " + q.N + ". ";
    if (!q.ok) {
      s += "A write needs " + q.W + " books, so it is refused.";
    } else {
      s += q.stand ? "The write lands on " + q.real + " real " + (q.real === 1 ? "book" : "books") + " and " + q.stand + " stand-in" +
        (q.stand === 1 ? "" : "s") + ". " : "The write lands on " + q.real + (q.real === 1 ? " book" : " books") + ". ";
      s += q.miss ? "A read of " + q.R + " can miss it." : "Any " + q.R + " books share at least " + q.shared + " with it, so a read can't miss it.";
    }
    s += q.readOk ? "" : " A read needs " + q.R + " books, so it is refused.";
    api.log(s, q.ok && !q.miss ? "ok" : "bad");
  }

  function setN(api, v) {
    var S = api.state;
    var N = Math.max(1, Math.min(MAXB, Math.round(num(v))));
    if (!isFinite(N)) return;
    S.N = N;
    if (S.W > N) { S.W = N; S.ctl.w.set(N); }
    if (S.R > N) { S.R = N; S.ctl.r.set(N); }
    if (S.reach > N) { S.reach = N; S.ctl.reach.set(N); }
    quorumLog(api);
    draw(api);
  }

  function setPart2(api, key, v) {
    var S = api.state;
    var x = Math.max(1, Math.min(S.N, Math.round(num(v))));
    if (!isFinite(x)) return;
    S[key] = x;
    var ctlKey = key === "W" ? "w" : (key === "R" ? "r" : "reach");
    if (x !== num(v)) S.ctl[ctlKey].set(x);
    quorumLog(api);
    draw(api);
  }

  /* ---------- drawing ---------- */

  function drawBook(api, hall, m) {
    var S = api.state;
    var b = S.books[hall][m];
    var nd = api.node(hall.charAt(0) + "_" + m);
    var label = M[m].name;
    if (S.rule === "home") label += " · " + (M[m].home ? "home " + M[m].home : "no home");
    nd.text("label", label);
    var sub;
    var tone;
    if (b.status === "base") { sub = b.request ? "request in the bag" : b.val; tone = b.request ? "warn" : ""; }
    else if (b.status === "local") { sub = short(b.e); tone = "warn"; }
    else if (b.status === "merged") { sub = short(b.e); tone = "ok"; }
    else if (b.status === "struck") { sub = short(b.e); tone = "bad"; }
    else if (b.status === "sibs") { sub = "both: " + b.val; tone = "accent"; }
    else { sub = "proposal: " + b.val; tone = "warn"; }
    nd.text("sub", sub);
    nd.set(tone);
  }

  function draw(api) {
    var S = api.state;
    HALLS.forEach(function (h) { MATTERS.forEach(function (m) { drawBook(api, h, m); }); });

    var pass = api.node("pass");
    pass.text("sub", S.passState === "open" ? "open" : (S.passState === "shut" ? "snowed shut" : "open again"));
    pass.set(S.passState === "shut" ? "bad" : "ok");
    var nextC = null;
    for (var i = S.k; i < S.ev.length; i++) { if (S.ev[i].kind === "cross") { nextC = S.ev[i].t; break; } }
    pass.text("meta", nextC !== null ? "Fridolin: day " + dayOf(nextC) + ", " + hm(nextC) : "all merged");
    var cut = S.passState === "shut" ? "cut" : "";
    api.edge("e_road", "pass").set(cut);
    api.edge("pass", "w_road").set(cut);

    var mg = api.node("merge");
    mg.text("sub", RULE_SHORT[S.rule]);
    mg.text("meta", hasCrossed(S) ? "kept " + S.kept + ", struck " + S.dropped : "not yet");
    mg.set(S.dropped ? "bad" : (hasCrossed(S) ? "ok" : ""));

    var ck = api.node("clock");
    ck.text("sub", S.skew ? S.skew + " min fast" : "right");
    ck.set(S.skew ? "warn" : "ok");

    S.stat.kept(S.kept);
    S.stat.dropped(S.dropped);
    S.stat.sibs(S.sibs);
    S.stat.waited(S.waited);
    S.stat.longest(S.longest >= 0 ? dur(S.longest) : "none");
    S.ctl.next.disable(S.done);
    S.ctl.end.disable(S.done);

    drawQuorum(api);
  }

  function hasCrossed(S) {
    for (var i = 0; i < S.k; i++) if (S.ev[i].kind === "cross") return true;
    return false;
  }

  function drawQuorum(api) {
    var S = api.state;
    var q = quorum(S);
    var readFrom = q.N - q.R + 1;          // the worst read: the last R books
    var missNow = q.miss;
    for (var i = 1; i <= MAXB; i++) {
      var nd = api.node("b" + i);
      var sub;
      var meta = "";
      var tone = "";
      if (i > q.N) {
        if (q.ok && i - q.N <= q.stand) { sub = "stand-in"; meta = "has v2"; tone = "warn"; }
        else { sub = "not in N"; tone = "muted"; }
      } else {
        var written = q.ok && i <= q.real;
        sub = written ? "v2 new" : "v1 old";
        tone = written ? "ok" : "";
        if (i > q.reach) meta = "cut off";
        if (q.ok && i >= readFrom) {
          meta = meta ? meta : "worst read";
          if (missNow) tone = "bad";
        }
      }
      nd.text("sub", sub);
      nd.text("meta", meta);
      nd.set(tone);
      var cutEdge = i <= q.N && i > q.reach ? "cut" : "";
      api.edge("writer", "b" + i).set(cutEdge);
      api.edge("reader", "b" + i).set(cutEdge);
    }
    var wr = api.node("writer");
    wr.text("sub", "waits for " + q.W + " of " + q.N);
    wr.set(q.ok ? (q.stand ? "warn" : "ok") : "bad");
    var rd = api.node("reader");
    rd.text("sub", "waits for " + q.R + " of " + q.N);
    rd.set(!q.readOk ? "bad" : (missNow ? "bad" : "ok"));

    S.stat.wwait(q.W);
    S.stat.rwait(q.R);
    S.stat.shared(q.shared);
    S.stat.miss(q.ok ? (q.miss ? "yes" : "no") : "no write");
    S.stat.wres(q.ok ? (q.stand ? "accepted, " + q.stand + " stand-in" + (q.stand === 1 ? "" : "s") : "accepted") : "refused");
    S.stat.rres(q.readOk ? "answered" : "refused");
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.ev || S.done || !S.play) return;
    S.acc += dt;
    if (S.acc >= GAP) {
      S.acc = 0;
      fire(api);
    }
  }

  /* ---------- "what is this box" ---------- */

  function bookInfo(S, hall, m) {
    var home = M[m].home;
    return "<strong>" + cap(hall) + " hall book: " + M[m].name.toLowerCase() + ".</strong> Each hall keeps the whole commune book and accepts decisions into it, so each hall is a leader. " +
      "Before the snow both books said " + M[m].init + ". " +
      (home ? "Under the home hall rule, only the " + home + " hall may change this matter." : "No hall owns the night bell: the chapel serves both valleys, so under the home hall rule two different entries are kept as two versions.") +
      " The west hall's stamps run " + S.skew + " min fast; books record whole minutes.";
  }

  var INFO = {
    pass: function (S) {
      return "<strong>Hornjoch pass.</strong> The only way between the valleys. Snow shuts it at 13:00 on day 1 for " + S.days +
        (S.days === 1 ? " day" : " days") + ", and Fridolin crosses again at 07:00 on day " + (1 + S.days) + ", then every morning. While it is shut, each hall can only write its own book.";
    },
    merge: function () {
      return "<strong>Fridolin's merge.</strong> At each crossing he compares everything written since the last one. One entry on a matter is copied to the other book. Two entries on one matter are a conflict, settled by the rule you pick: latest stamp wins (a tie goes to the east book, and the loser is struck without a word), both versions kept for the council, or no conflict at all because only the home hall may write.";
    },
    clock: function (S) {
      return "<strong>West hall clock.</strong> An old pendulum clock, " + (S.skew ? S.skew + " minutes fast" : "set right") + ". Every west entry is stamped with its time, and latest wins compares stamps, not the real order. The east clock agrees with Fridolin's pocket watch.";
    },
    writer: function (S) {
      return "<strong>Writer.</strong> Part 2 has no leader: a write goes to all N books that hold the record and counts as done when W of them have it. Right now W is " + S.W + " of N " + S.N + ". With the sloppy quorum on, it uses stand-in books outside the N when it can't reach W of its own.";
    },
    reader: function (S) {
      return "<strong>Reader.</strong> A read asks R books and takes the newest version any of them has. Right now R is " + S.R + ". The worst read asks the R books furthest from the write's. If R + W > N, any R books include at least one the write reached.";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s3e06", {
    diagram: DIAGRAM,
    startClock: START,

    setup: function (api) {
      var S = api.state;
      S.rule = "lww";
      S.skew = SKEW0;
      S.days = DAYS0;
      S.play = true;
      S.N = 3;
      S.W = 2;
      S.R = 2;
      S.reach = 3;
      S.sloppy = false;
      api.speed = 0;

      S.ctl = {};
      S.ctl.rule = api.control.select("rule", "Merge rule", RULES, "lww", function (v) {
        var o = pick(RULES, v);
        if (!o) return;
        S.rule = String(o.value);
        replay(api, "Rule: " + RULE_SHORT[S.rule] + ".");
      });
      S.ctl.skew = api.control.range("skew", "West clock fast by", 0, 15, 1, SKEW0, function (v) {
        var x = Math.max(0, Math.min(15, Math.round(num(v))));
        if (!isFinite(x)) return;
        S.skew = x;
        replay(api, "The west clock is now " + (x ? x + " min fast" : "right") + ".");
      }, { format: function (v) { return v + " min"; } });
      S.ctl.days = api.control.range("days", "Pass shut for", 1, 5, 1, DAYS0, function (v) {
        var x = Math.max(1, Math.min(5, Math.round(num(v))));
        if (!isFinite(x)) return;
        S.days = x;
        replay(api, "The pass is now shut for " + x + (x === 1 ? " day." : " days."));
      }, { format: function (v) { return v + (Number(v) === 1 ? " day" : " days"); } });
      S.ctl.next = api.control.button("next", "Next event", function () { S.acc = 0; fire(api); });
      S.ctl.end = api.control.button("end", "Play to the end", function () { playToEnd(api); });
      S.ctl.play = api.control.toggle("play", "Play", true, function (on) { S.play = !!on; S.acc = 0; });
      S.ctl.n = api.control.range("n", "Part 2: N, books per record", 1, MAXB, 1, 3, function (v) { setN(api, v); });
      S.ctl.w = api.control.range("w", "Part 2: W, books a write waits for", 1, MAXB, 1, 2, function (v) { setPart2(api, "W", v); });
      S.ctl.r = api.control.range("r", "Part 2: R, books a read waits for", 1, MAXB, 1, 2, function (v) { setPart2(api, "R", v); });
      S.ctl.reach = api.control.range("reach", "Part 2: books you can reach", 1, MAXB, 1, 3, function (v) { setPart2(api, "reach", v); });
      S.ctl.sloppy = api.control.toggle("sloppy", "Part 2: sloppy quorum (stand-in books)", false, function (on) {
        S.sloppy = !!on;
        quorumLog(api);
        draw(api);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        kept: api.stat("kept", "entries kept", "ok"),
        dropped: api.stat("dropped", "struck without a word", "bad"),
        sibs: api.stat("sibs", "two versions for the council", "warn"),
        waited: api.stat("waited", "waited for the pass", "warn"),
        longest: api.stat("longest", "longest wait", ""),
        wwait: api.stat("wwait", "Part 2: a write waits for", ""),
        rwait: api.stat("rwait", "Part 2: a read waits for", ""),
        shared: api.stat("shared", "Part 2: books shared at least", ""),
        miss: api.stat("miss", "Part 2: can a read miss the write?", "bad"),
        wres: api.stat("wres", "Part 2: write", ""),
        rres: api.stat("rres", "Part 2: read", "")
      };

      api.onNodeClick(function (id) {
        var S2 = api.state;
        var mm = /^([ew])_(road|wood|school|bell)$/.exec(id);
        if (mm) { api.info(bookInfo(S2, mm[1] === "e" ? "east" : "west", mm[2])); return; }
        var bb = /^b([1-5])$/.exec(id);
        if (bb) {
          var n = Number(bb[1]);
          api.info("<strong>Book " + n + ".</strong> " + (n <= S2.N
            ? "One of the N = " + S2.N + " books that hold this record. Book " + n + " is " + (n <= S2.reach ? "within reach." : "cut off by the snow.")
            : "Not one of the N books for this record. With the sloppy quorum on, it can hold a write for a cut-off book as a stand-in, and hand it back later."));
          return;
        }
        var f = INFO[id];
        if (f) api.info(f(S2));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startSnow(api);
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      var mark = 0;
      function since() { return t.logText().slice(mark); }
      function begin() { mark = t.logText().length; }
      var log;
      var a;
      var b;

      // 1. The opening state: day 1, 07:00, before the snow.
      t.expect(t.stat("kept") === 0 && t.stat("dropped") === 0 && t.stat("waited") === 0 && t.stat("longest") === "none" &&
        t.node("e_road").text.sub === "open" && t.node("pass").text.sub === "open" &&
        t.node("pass").text.meta === "Fridolin: day 4, 07:00" && t.logText().indexOf("Snow shuts") < 0,
        "Opens on day 1, 07:00: both books say the pass road is open, nothing merged, the snow still to come");

      // 2. The first tick that reaches the gap fires the snow.
      await t.run(2.1);
      t.expect(t.logText().indexOf("Day 1, 13:00 Snow shuts the Hornjoch. Fridolin can't cross again until Day 4, 07:00.") >= 0 &&
        t.node("pass").text.sub === "snowed shut" && t.logText().indexOf("21:33") < 0,
        "The first event is the snow at 13:00, and nothing is written yet");

      // 3. As now: latest wins, the west clock 11 min fast.
      t.click("play");
      begin();
      t.click("end");
      log = since();
      t.expect(log.indexOf("Day 1, 21:33 West hall: Councillor Rosmarie Tschudin writes the pass road OPEN, to clear it for the supply cart. The west clock says 21:44.") >= 0 &&
        log.indexOf("Day 1, 21:40 East hall: Councillor Gaudenz Imboden writes the pass road CLOSED: the slope above the third bend is settling. The east clock says 21:40.") >= 0,
        "The west opens the road at 21:33, stamped 21:44; the east closes it at 21:40, stamped 21:40");
      t.expect(log.indexOf("Day 4, 07:00 Fridolin crosses the Hornjoch, open again, and merges the books.") >= 0 &&
        log.indexOf("Pass road: east CLOSED at 21:40 day 1, west OPEN at 21:44 day 1. Latest wins: OPEN. CLOSED is struck from the east book, and nobody is told.") >= 0,
        "At the day 4 crossing latest wins keeps OPEN (21:44) and strikes the closure (21:40)");
      t.expect(log.indexOf("Night bell: east HOURLY at 18:02 day 3, west MIDNIGHT at 18:13 day 3. Latest wins: MIDNIGHT. HOURLY is struck from the east book, and nobody is told.") >= 0 &&
        log.indexOf("Woodpile: only the west book has an entry, two baskets at 09:21 day 2. Copied to the east book.") >= 0 &&
        log.indexOf("Merge done: 4 kept, 2 struck without a word, 0 with two versions for the council, 0 waited for the pass.") >= 0,
        "The bell's HOURLY is struck too: 6 entries, 4 kept, 2 struck");
      t.expect(t.stat("kept") === 4 && t.stat("dropped") === 2 && t.stat("sibs") === 0 &&
        t.node("e_road").text.sub === "OPEN · 21:44 d1" && t.node("e_road").state === "bad" &&
        t.node("w_road").text.sub === "OPEN · 21:44 d1",
        "After the merge both books say OPEN at 21:44, and the closure is in neither");

      // 4. Clocks set by the church bell: a minute out, then exactly right.
      t.set("skew", 1);
      begin();
      t.click("end");
      log = since();
      a = t.stat("dropped");
      t.expect(a === 2 && log.indexOf("Pass road: east CLOSED at 21:40 day 1, west OPEN at 21:34 day 1. Latest wins: CLOSED. OPEN is struck from the west book, and nobody is told.") >= 0 &&
        log.indexOf("Latest wins: MIDNIGHT. HOURLY is struck from the east book") >= 0,
        "A minute fast: the closure stands, but the west's OPEN and the east's HOURLY are struck, still 2");
      t.set("skew", 0);
      begin();
      t.click("end");
      log = since();
      t.expect(t.stat("dropped") === 2 && log.indexOf("Night bell: east HOURLY at 18:02 day 3, west MIDNIGHT at 18:02 day 3. A tie goes to the east book: HOURLY. MIDNIGHT is struck from the west book, and nobody is told.") >= 0,
        "Clocks exactly right: the two bell entries share the minute 18:02 and one is still struck");

      // 5. Where the skew starts to matter for the pass road: 7 min is a tie, 8 min flips it.
      t.set("skew", 7);
      t.click("end");
      a = t.node("e_road").text.sub;
      t.set("skew", 8);
      t.click("end");
      b = t.node("e_road").text.sub;
      t.expect(a === "CLOSED · 21:40 d1" && b === "OPEN · 21:41 d1",
        "7 min fast: 21:40 against 21:40, a tie, the closure stands; 8 min fast: OPEN at 21:41 wins");

      // 6. Keep both versions.
      t.set("skew", 11);
      t.set("rule", "sibs");
      t.click("end");
      t.expect(t.stat("kept") === 6 && t.stat("dropped") === 0 && t.stat("sibs") === 2 &&
        t.node("e_road").text.sub === "both: CLOSED / OPEN" && t.node("w_bell").text.sub === "both: HOURLY / MIDNIGHT",
        "Keep both: all 6 kept, none struck, the pass road and the bell each go to the council with two versions");

      // 7. One home hall per matter (the senior answer).
      t.set("rule", "home");
      begin();
      t.click("end");
      log = since();
      t.expect(t.stat("kept") === 5 && t.stat("dropped") === 0 && t.stat("sibs") === 1 && t.stat("waited") === 1 &&
        t.stat("longest") === "57 h 27 min" && t.node("e_road").text.sub === "CLOSED · 21:40 d1" &&
        t.node("w_road").text.sub === "CLOSED · 21:40 d1" &&
        log.indexOf("The west hall's request, the pass road OPEN, reaches the east hall after 57 h 27 min.") >= 0,
        "Home hall: the closure stands in both books, the west's OPEN waits 57 h 27 min as a request, the bell keeps both, nothing struck");
      t.set("days", 1);
      t.click("end");
      t.expect(t.stat("longest") === "9 h 27 min" && t.stat("dropped") === 0,
        "Pass shut 1 day: the request reaches the east hall at day 2, 07:00, after 9 h 27 min");

      // 8. Both halls must sign.
      t.set("days", 3);
      t.set("rule", "both");
      begin();
      t.click("end");
      log = since();
      t.expect(t.stat("kept") === 0 && t.stat("waited") === 6 && t.stat("dropped") === 0 && t.stat("longest") === "57 h 27 min" &&
        t.node("e_road").text.sub === "proposal: CLOSED" &&
        log.indexOf("6 proposals reach the other hall, the oldest after 57 h 27 min. Nothing was decided while the pass was shut.") >= 0,
        "Both must sign: all 6 decisions wait for the pass, the oldest 57 h 27 min, and none is made during the snow");

      // 9. Part 2: N 3, W 2, R 2.
      t.expect(t.stat("wwait") === 2 && t.stat("rwait") === 2 && t.stat("shared") === 1 && t.stat("miss") === "no" &&
        t.stat("wres") === "accepted" && t.stat("rres") === "answered",
        "N 3, W 2, R 2: a write waits for 2, a read for 2, and they share at least 1 book");

      // 10. W 1, R 1 of 3: a read can miss.
      t.set("w", 1);
      t.set("r", 1);
      t.expect(t.stat("miss") === "yes" && t.stat("shared") === 0 && t.node("b3").state === "bad" && t.node("b1").text.sub === "v2 new",
        "N 3, W 1, R 1: the write is on book 1, the worst read asks book 3 and misses it");

      // 11. R + W > N over every combination with N up to 5, against a brute-force search.
      var combos = 0;
      var wrong = [];
      for (var N = 1; N <= MAXB; N++) {
        t.set("n", N);
        t.set("reach", N);
        for (var W = 1; W <= N; W++) {
          for (var R = 1; R <= N; R++) {
            t.set("w", W);
            t.set("r", R);
            // Is there a set of W books and a set of R books with nothing in common?
            var disjoint = false;
            for (var ws = 0; ws < (1 << N) && !disjoint; ws++) {
              if (bits(ws) !== W) continue;
              for (var rs = 0; rs < (1 << N); rs++) {
                if (bits(rs) === R && (ws & rs) === 0) { disjoint = true; break; }
              }
            }
            combos += 1;
            var shown = t.stat("miss");
            if ((disjoint ? "yes" : "no") !== shown || disjoint !== (R + W <= N) ||
              t.stat("shared") !== Math.max(0, W + R - N)) {
              wrong.push("N" + N + " W" + W + " R" + R);
            }
          }
        }
      }
      t.expect(combos === 55 && wrong.length === 0,
        "Over all 55 combinations with N from 1 to 5, a read can miss the write exactly when R + W <= N" +
        (wrong.length ? " (wrong: " + wrong.join(", ") + ")" : ""));

      // 12. The third hall in the snow: N 3, W 2, R 2, only 1 book within reach.
      t.set("n", 3);
      t.set("w", 2);
      t.set("r", 2);
      t.set("reach", 1);
      t.expect(t.stat("wres") === "refused" && t.stat("rres") === "refused" && t.stat("miss") === "no write",
        "The west alone reaches 1 of 3 books: a write needing 2 and a read needing 2 are both refused");
      t.click("sloppy");
      t.expect(t.stat("wres") === "accepted, 1 stand-in" && t.stat("miss") === "yes" &&
        t.node("b4").text.sub === "stand-in" && t.node("b1").text.sub === "v2 new" && t.node("b2").text.sub === "v1 old",
        "Sloppy quorum: the write lands on book 1 and stand-in book 4, so a read of 2 of the 3 can miss it");

      function bits(x) { var c = 0; while (x) { c += x & 1; x >>= 1; } return c; }
    }
  });
})();
