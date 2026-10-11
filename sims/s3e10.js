/* sims/s3e10-v1.0.1.js  (published as sims/s3e10.js)
   Case s3e10 "Normal and Not": a modeling lab for the Thornleigh Family History Society. One
   person's death date is corrected in the person table (the truth); her 37 rows in the tree
   table (copies, one per tree she appears in) are refreshed, or not, by the storage model the
   learner picks.

   CHANGELOG
   v1.0.1 (2026-10-11) rule 15 renames: u/rebuild_at_two_hildred (the nightly-rebuild commenter);
     the case is now content/s3/s3e10-v1.0.1.json.
   v1.0.0 (2026-10-11) first version: storage models (tree copies with no refresh, as now; fixed
     by hand; normalized only; refreshed in the same transaction; refreshed from a change queue
     with a stated delay; rebuilt nightly 02:00 to 02:40), the correction time, the tree size for
     the page stat, a 03:00 nightly check, skip buttons and reset. Stats: her trees showing 1919,
     the longest a tree showed 1919, tree page time, database time per correction, rows touched
     per correction, tree rows rewritten each night. selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s3/s3e10-v1.0.1.json):
   - post: the society has 412 trees and a tree table of 41,236 rows (one row per person per tree
     they appear in); the biggest trees are about 400 people. Alcuin Treharne added the tree
     table in 2014. Lavinia Gorrandine (person P-20417, born 1852) appears in 37 of the 412
     trees. On Monday at 10:14:00 Sabine Hosken changes her death date from 1919 to 1891 (a
     burial on 14 March 1891). The save is one UPDATE, 40 ms, committed at 10:14:00.040. Nothing
     refreshes the tree rows, so all 37 still say 1919 on Thursday at 23:12, when Wynfrith opens
     Sabine's tree, T-0288: the 1900 photograph has 8 people and 9 names.
   - comments and OP replies: the 400-person tree takes 1,640 ms from the person table and 60 ms
     from its tree rows (Kesia's timing); a nightly rebuild of about 40 minutes
     (u/rebuild_at_two_hildred); fixing by hand at about 2 minutes a tree (the committee's rule).
   - reply part 2s: A 1,640 ms against 60, 88 ms for a 12-person tree; B 37 trees x 2 minutes =
     74 minutes, 38 rows, 3,000 ms of database time; C the 10:14 correction waits until 02:40,
     16 h 26 min, and a correction at 02:10 waits 24 h 30 min, 41,236 rows rewritten each night;
     D 160 ms and 38 rows in one transaction, 60 ms pages, the first 03:00 check finds 37 rows;
     the queue costs 240 ms and leaves the trees wrong for its delay.

   Teaching model (stated in sim.lede):
   - Time is seconds from Monday 00:00. The clock opens 2 minutes before the chosen correction
     and runs 10 sim seconds per real second; nothing happens at the opening second.
   - Every statement is one round trip to the database: 40 ms. A tree page is one round trip plus
     0.05 ms per person when it reads its own tree rows (400 people: 60 ms), or one round trip
     plus 4 ms per person when it is built from the person table by walking parent links and
     joining each person's facts (400 people: 1,640 ms).
   - Database time per correction is round trips x 40 ms: the save alone, 1 trip (40 ms); by
     hand, 1 + 37 x 2 (UPDATE and COMMIT per tree) = 75 trips, 3,000 ms; same transaction,
     BEGIN, UPDATE person, UPDATE tree rows, COMMIT = 4 trips, 160 ms; change queue, the same 4
     trips with an INSERT into the queue instead of the tree UPDATE, plus the worker's UPDATE
     and COMMIT, 6 trips, 240 ms.
   - Rows touched per correction: the person row (1); plus her 37 tree rows (38) for by hand and
     same transaction; plus the queue row (39) for the change queue. The nightly rebuild touches
     1 row at the save and rewrites all 41,236 tree rows every night.
   - The person row changes when the save commits: 10:14:00.040 for one UPDATE, 10:14:00.160 for
     a 4-trip transaction. A tree is wrong while the person row says 1891 and its copy says 1919.
     Same transaction: the copies change in the same commit, so no tree is ever wrong. By hand:
     tree k is fixed 2 minutes x k after the save. Queue: all 37 at the save plus the delay. The
     nightly rebuild reads the person table at 02:00 and swaps the new tree table in at 02:40
     (one swap for all rows); a correction saved after 02:00 waits for the next night. The
     nightly check at 03:00 compares all 41,236 tree rows with the person table and repairs any
     that differ.
   - "Longest a tree showed 1919" is measured from the moment Sabine pressed Save and rounded to
     the second. No random numbers decide anything; api.rand() is not used.

   Self-test arithmetic (T = 10:14:00 = 36,840 s unless stated; one day = 86,400 s):
   - Nightly, T: fixed at Tuesday 02:40 = 96,000; 96,000 - 36,840 = 59,160 s = 16:26:00.
   - Nightly, 02:10 (7,800): after Monday's 02:00 reading, fixed Tuesday 02:40: 88,200 s =
     1 d 0:30:00. 01:50 (6,600): fixed Monday 02:40 (9,600): 0:50:00. 23:55 (86,100): 2:45:00.
   - As now with the check: Tuesday 03:00 = 97,200; 60,360 s = 16:46:00.
   - As now on Thursday 23:12 (3 x 86,400 + 83,520 = 342,720): 305,880 s = 3 d 12:58:00.
   - By hand: last tree at T + 0.04 + 37 x 120 = T + 4,440.04: 1:14:00, at 11:28:00.
   - Queue, 60 s: fixed at T + 0.16 + 60; at T + 60 all 37 are wrong (longest 0:01:00); at
     T + 120 none (60.16 s rounds to 0:01:00).
   - Skips: the clock opens at T - 120; "Skip 1 minute" three times reaches T + 60.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px,
   edge label 11px):
   - Save form (110, 70), 180 x 62: meta "died 1919 -> 1891" 17 chars, 112px.
   - Person table (110, 230), 180 x 84; person page (110, 360), 180 x 52: sub "1852 to 1891".
   - Tree refresh (370, 230), 200 x 62: longest sub "a volunteer, 2 min a tree" 25 chars, 180px;
     meta "75 trips, 3,000 ms" 18 chars, 119px.
   - Tree table (630, 230), 200 x 84: sub "412 trees, 41,236 rows" 22 chars, 158px.
   - Tree pages (630, 360), 200 x 62: meta "page 1,640 ms, 400 people" 25 chars, 165px.
   - Vertical gaps: form bottom 101 to person top 188 (87px); person bottom 272 to page top 334
     (62px); tree table bottom 272 to tree pages top 329 (57px). Horizontal: person right 200 to
     refresh left 270, refresh right 470 to tree table left 530 (70 and 60px); edge labels
     "changes" (46px) and "refresh" (46px) fit.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 10;                    // sim seconds per real second
  var DAY = 86400;
  var LEAD = 120;                    // the clock opens 2 minutes before the correction
  var TREES = 412;                   // trees in the society
  var HERS = 37;                     // trees Lavinia appears in
  var TREE_ROWS = 41236;             // rows in the tree table
  var TRIP = 0.04;                   // one round trip to the database, seconds (40 ms)
  var HAND_EACH = 120;               // a volunteer fixes one tree in 2 minutes
  var SNAP = 7200;                   // 02:00, the rebuild reads the person table
  var SWAP = 9600;                   // 02:40, the rebuilt tree table is swapped in
  var CHECK = 10800;                 // 03:00, the nightly check
  var THU_VIEW = 3 * DAY + 83520;    // Thursday 23:12, Wynfrith opens Sabine's tree
  var TUE_330 = DAY + 12600;         // Tuesday 03:30
  var SABINE_TREE = 37;              // T-0288 is the last of her trees in the volunteer's list
  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];

  var MODELS = [
    { value: "none", label: "Tree copies, no refresh (as now)" },
    { value: "hand", label: "Tree copies, fixed by hand (2 min a tree)" },
    { value: "norm", label: "Normalized only: no tree table" },
    { value: "txn", label: "Copies refreshed in the same transaction" },
    { value: "queue", label: "Copies refreshed from a change queue" },
    { value: "nightly", label: "Copies rebuilt nightly, 02:00 to 02:40" }
  ];
  var DELAYS = [
    { value: 10, label: "10 s" },
    { value: 60, label: "60 s" },
    { value: 300, label: "5 min" }
  ];
  var WHENS = [
    { value: 36840, label: "Monday 10:14 (the story)" },
    { value: 6600, label: "Monday 01:50" },
    { value: 7800, label: "Monday 02:10, during the rebuild" },
    { value: 86100, label: "Monday 23:55" }
  ];
  var SIZES = [
    { value: 12, label: "12 people" },
    { value: 60, label: "60 people" },
    { value: 150, label: "150 people" },
    { value: 400, label: "400 people" }
  ];

  // Round trips per correction, and rows touched per correction.
  var TRIPS = { none: 1, hand: 1 + HERS * 2, norm: 1, txn: 4, queue: 6, nightly: 1 };
  var ROWS = { none: 1, hand: 1 + HERS, norm: 1, txn: 1 + HERS, queue: 2 + HERS, nightly: 1 };

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  // 41236 -> "41,236". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  // 40.6 -> "40.6", 60 -> "60", 1640 -> "1,640".
  function msText(v) {
    var r = Math.round(v * 10) / 10;
    if (r === Math.round(r)) return fmt(r);
    return r.toFixed(1);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Seconds from Monday 00:00 -> "Mon 10:14:00".
  function when(t) {
    var s = Math.floor(t + 1e-6);
    var d = Math.floor(s / DAY);
    var r = s - d * DAY;
    return DAYS[Math.min(d, DAYS.length - 1)] + " " + pad(Math.floor(r / 3600)) + ":" + pad(Math.floor((r % 3600) / 60)) + ":" + pad(r % 60);
  }

  // A duration in seconds, rounded: "0:01:00", "16:26:00", "1 d 0:30:00".
  function dur(sec) {
    var s = Math.max(0, Math.round(sec));
    var d = Math.floor(s / DAY);
    s -= d * DAY;
    var text = Math.floor(s / 3600) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
    return d ? d + " d " + text : text;
  }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function pageMs(model, size) {
    return model === "norm" ? 40 + 4 * size : 40 + 0.05 * size;
  }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 400,
    aria: "Modeling lab for the Thornleigh Family History Society. Sabine's save changes Lavinia Gorrandine's death date in the person table, the source of truth, which feeds the person page. A tree refresh step, chosen by the storage model, carries changes to the tree table: 412 trees, 41,236 rows, 37 of them Lavinia's. Tree pages read the tree table.",
    nodes: [
      { id: "form", label: "Sabine's Save", sub: "Mon 10:14", meta: "died 1919 -> 1891", x: 110, y: 70, w: 180, h: 62, shape: "box", tone: "" },
      { id: "person", label: "Person table", sub: "source of truth", meta: "P-20417 died 1919", x: 110, y: 230, w: 180, h: 84, shape: "db", tone: "ok" },
      { id: "ppage", label: "Person page", sub: "1852 to 1919", x: 110, y: 360, w: 180, h: 52, shape: "box", tone: "" },
      { id: "refresh", label: "Tree refresh", sub: "none (as now)", meta: "1 trip, 40 ms", x: 370, y: 230, w: 200, h: 62, shape: "box", tone: "" },
      { id: "tree", label: "Tree table", sub: "412 trees, 41,236 rows", meta: "her 37 rows: 1919", x: 630, y: 230, w: 200, h: 84, shape: "db", tone: "" },
      { id: "tpage", label: "Tree pages", sub: "her 37 trees agree", meta: "page 60 ms, 400 people", x: 630, y: 360, w: 200, h: 62, shape: "box", tone: "" }
    ],
    edges: [
      { from: "form", to: "person", label: "save" },
      { from: "person", to: "ppage" },
      { from: "person", to: "refresh", label: "changes" },
      { from: "refresh", to: "tree", label: "refresh" },
      { from: "tree", to: "tpage" }
    ]
  };

  var REFRESH_SUB = {
    none: "none (as now)",
    hand: "a volunteer, 2 min a tree",
    norm: "no tree table",
    txn: "same transaction",
    queue: "change queue",
    nightly: "nightly, 02:00 to 02:40"
  };

  /* ---------- state of the copies ---------- */

  function oldCopies(S, t) {
    if (!S.corrected) return HERS;
    var n = 0;
    for (var k = 1; k <= HERS; k++) if (S.fix[k] > t) n += 1;
    return n;
  }

  function wrongTrees(S, t) {
    if (S.model === "norm" || !S.corrected || t < S.P) return 0;
    return oldCopies(S, t);
  }

  function treeWrong(S, k, t) {
    return S.model !== "norm" && S.corrected && t >= S.P && S.fix[k] > t;
  }

  function longest(S, t) {
    if (!S.corrected || S.model === "norm") return 0;
    if (wrongTrees(S, t) > 0) return t - S.T;
    var m = 0;
    for (var k = 1; k <= HERS; k++) {
      if (S.fix[k] > S.P && S.fix[k] !== Infinity && S.fix[k] - S.T > m) m = S.fix[k] - S.T;
    }
    return m;
  }

  /* ---------- events ---------- */

  function addEv(S, t, fn) {
    S.seq += 1;
    S.ev.push({ t: t, seq: S.seq, fn: fn });
    S.ev.sort(function (a, b) { return a.t - b.t || a.seq - b.seq; });
  }

  function advance(api, to) {
    var S = api.state;
    var guard = 0;
    while (S.ev.length && S.ev[0].t <= to + 1e-9 && guard < 200) {
      var e = S.ev.shift();
      api.clock = e.t;               // so the log's time stamp matches the event
      e.fn(api, e.t);
      guard += 1;
    }
    api.clock = to;
    S.now = to;
  }

  function correction(api, t) {
    var S = api.state;
    var k;
    S.corrected = true;
    var head = when(t) + " Sabine saves Lavinia's death date, 1919 to 1891";
    if (S.model === "txn" || S.model === "queue") S.P = t + 4 * TRIP;
    else S.P = t + TRIP;

    if (S.model === "none") {
      api.log(head + ": one UPDATE to the person table, 40 ms. Nothing touches her 37 tree rows.", "warn");
    } else if (S.model === "hand") {
      for (k = 1; k <= HERS; k++) S.fix[k] = S.P + HAND_EACH * k;
      api.log(head + ": one UPDATE, 40 ms. A volunteer opens her 37 trees one by one and fixes each by hand, 2 minutes a tree.", "");
      addEv(S, S.P + HAND_EACH * HERS, function (api2, tt) {
        api2.log(when(tt) + " The volunteer saves the last of her 37 trees: 74 minutes of fixing, 75 round trips, 3,000 ms of database time. The last tree said 1919 for " + dur(tt - api2.state.T) + ".", "ok");
      });
    } else if (S.model === "norm") {
      for (k = 1; k <= HERS; k++) S.fix[k] = S.P;
      api.log(head + ": one UPDATE, 40 ms. There is no tree table: every tree page is built from the person table, so her 37 trees show 1891 from the next view.", "ok");
    } else if (S.model === "txn") {
      for (k = 1; k <= HERS; k++) S.fix[k] = S.P;
      api.log(head + ": BEGIN, UPDATE the person row, UPDATE her 37 tree rows, COMMIT. 4 round trips, 160 ms, 38 rows. The person page and her trees change together.", "ok");
    } else if (S.model === "queue") {
      api.log(head + ": BEGIN, UPDATE the person row, INSERT the change into the queue, COMMIT. 160 ms. A worker will update her 37 tree rows " + dur(S.delay) + " later.", "");
      addEv(S, S.P + S.delay, function (api2, tt) {
        var S2 = api2.state;
        for (var j = 1; j <= HERS; j++) if (S2.fix[j] > tt) S2.fix[j] = tt;
        api2.log(when(tt) + " The worker takes the change from the queue: UPDATE her 37 tree rows, COMMIT, 80 ms. All 37 trees say 1891, " + dur(tt - S2.T) + " after the save.", "ok");
      });
    } else {
      api.log(head + ": one UPDATE, 40 ms. Her 37 tree rows wait for the next rebuild, which reads the person table at 02:00.", "warn");
    }
    draw(api);
  }

  function snapshot(api, t) {
    var S = api.state;
    S.snap = S.corrected && S.P <= t;
    api.log(when(t) + " The nightly rebuild starts. It reads the person table as it is now: Lavinia died in " + (S.snap ? "1891" : "1919") + ".", "");
  }

  function swap(api, t) {
    var S = api.state;
    var n = 0;
    if (S.snap) {
      for (var k = 1; k <= HERS; k++) if (S.fix[k] > t) { S.fix[k] = t; n += 1; }
    }
    if (n) {
      api.log(when(t) + " The rebuild is swapped in: 41,236 tree rows rewritten. Her 37 trees say 1891, " + dur(t - S.T) + " after the save.", "ok");
    } else if (S.corrected && !S.snap) {
      api.log(when(t) + " The rebuild is swapped in: 41,236 tree rows rewritten from the 02:00 reading, before Sabine's save. Her 37 trees still say 1919 until the next night.", "bad");
    } else {
      api.log(when(t) + " The rebuild is swapped in: 41,236 tree rows rewritten, and none of them changed.", "");
    }
  }

  function check(api, t) {
    var S = api.state;
    if (S.model === "norm") {
      api.log(when(t) + " Nightly check: there is no tree table, so there is nothing to compare.", "");
      return;
    }
    var n = 0;
    for (var k = 1; k <= HERS; k++) {
      if (treeWrong(S, k, t)) { S.fix[k] = t; n += 1; }
    }
    if (n) {
      api.log(when(t) + " Nightly check: " + n + " tree rows differ from the person table. Repaired from it, and an alert sent to Kesia. They had said 1919 for " + dur(t - S.T) + ".", "warn");
    } else {
      api.log(when(t) + " Nightly check: all 41,236 tree rows agree with the person table.", "ok");
    }
  }

  function thursday(api, t) {
    var S = api.state;
    if (treeWrong(S, SABINE_TREE, t)) {
      api.log("Thursday 23:12 Wynfrith opens Sabine's tree, T-0288: Lavinia Gorrandine, 1852 to 1919. The 1900 photograph has 8 people on the bench and 9 names, hers last.", "bad");
    } else {
      api.log("Thursday 23:12 Wynfrith opens Sabine's tree, T-0288: Lavinia Gorrandine, 1852 to 1891. The 1900 photograph has 8 people and 8 names.", "ok");
    }
  }

  /* ---------- the run ---------- */

  function startRun(api) {
    var S = api.state;
    S.T = S.when;
    S.start = S.T - LEAD;
    S.corrected = false;
    S.P = Infinity;
    S.fix = [];
    for (var k = 0; k <= HERS; k++) S.fix.push(Infinity);
    S.snap = false;
    S.ev = [];
    S.seq = 0;
    addEv(S, S.T, correction);
    for (var d = 0; d < 8; d++) {
      var base = d * DAY;
      if (S.model === "nightly") {
        if (base + SNAP > S.start) addEv(S, base + SNAP, snapshot);
        if (base + SWAP > S.start) addEv(S, base + SWAP, swap);
      }
      if (S.check && base + CHECK > S.start) addEv(S, base + CHECK, check);
    }
    if (THU_VIEW > S.start) addEv(S, THU_VIEW, thursday);
    api.clock = S.start;
    S.now = S.start;
    api.log(when(S.start) + " " + pick(MODELS, S.model).label + "." +
      (S.model === "queue" ? " Queue delay " + dur(S.delay) + "." : "") +
      (S.check ? " Nightly check at 03:00: on." : "") +
      " Lavinia's person row says she died in 1919, and so do her 37 tree rows. Sabine saves the correction at " + when(S.T).slice(4, 9) + ".", "");
    draw(api);
  }

  function replay(api, what) {
    api.log(what + " Replaying.", "");
    startRun(api);
  }

  function skipTo(api, target) {
    var S = api.state;
    if (target <= S.now) return;
    advance(api, target);
    api.clock = target;
    draw(api);
  }

  /* ---------- drawing ---------- */

  function draw(api) {
    var S = api.state;
    var t = S.now;
    var w = wrongTrees(S, t);
    var personNew = S.corrected && t >= S.P;
    var page = pageMs(S.model, S.size);

    var fm = api.node("form");
    fm.text("sub", when(S.T).slice(0, 9));
    fm.set(S.corrected ? "ok" : "");

    var pr = api.node("person");
    pr.text("meta", "P-20417 died " + (personNew ? "1891" : "1919"));

    var pp = api.node("ppage");
    pp.text("sub", "1852 to " + (personNew ? "1891" : "1919"));
    pp.set(personNew ? "ok" : "");

    var rf = api.node("refresh");
    rf.text("sub", REFRESH_SUB[S.model] + (S.model === "queue" ? ", " + dur(S.delay) : ""));
    rf.text("meta", TRIPS[S.model] + (TRIPS[S.model] === 1 ? " trip, " : " trips, ") + fmt(TRIPS[S.model] * 40) + " ms");
    rf.set(S.model === "none" ? "warn" : (S.model === "norm" ? "muted" : ""));

    var tr = api.node("tree");
    var tp = api.node("tpage");
    if (S.model === "norm") {
      tr.text("sub", "dropped");
      tr.text("meta", "no copies");
      tr.set("muted");
      tp.text("sub", "built from person table");
    } else {
      var old = oldCopies(S, t);
      tr.text("sub", "412 trees, 41,236 rows");
      tr.text("meta", old === HERS ? "her 37 rows: 1919" : (old === 0 ? "her 37 rows: 1891" : old + " of 37 rows: 1919"));
      tr.set(w ? "warn" : "");
      tp.text("sub", w ? w + " of 37 trees wrong" : "her 37 trees agree");
    }
    tp.text("meta", "page " + msText(page) + " ms, " + S.size + " people");
    tp.set(w ? "bad" : (S.corrected && t >= S.P ? "ok" : ""));

    S.stat.wrong(fmt(w));
    S.stat.longest(dur(longest(S, t)));
    S.stat.page(msText(page));
    S.stat.db(fmt(TRIPS[S.model] * 40));
    S.stat.rows(fmt(ROWS[S.model]));
    S.stat.night(S.model === "nightly" ? fmt(TREE_ROWS) : "0");

    S.ctl.tue.disable(S.now >= TUE_330);
    S.ctl.thu.disable(S.now >= THU_VIEW);
  }

  function step(api, dt) {
    var S = api.state;
    if (!S.ev) return;
    if (api.clock > S.now) {
      advance(api, api.clock);
      draw(api);
    }
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    form: function (S) {
      return "<strong>Sabine's Save.</strong> The person page's form. Sabine changes Lavinia Gorrandine's death date from 1919 to 1891, from a burial on 14 March 1891, at " + when(S.T) + ". What else the save does depends on the storage model.";
    },
    person: function () {
      return "<strong>Person table.</strong> One row per person, with name, birth, death and parents: the society's source of truth. Lavinia is P-20417. Every statement to the database is one round trip, 40 ms.";
    },
    ppage: function () {
      return "<strong>Person page.</strong> Reads Lavinia's row from the person table, so it shows the new date as soon as the save commits.";
    },
    refresh: function (S) {
      var txt = {
        none: "Nothing carries a change from the person table to the tree rows. Copies are made when someone is added to a tree, and never again.",
        hand: "A volunteer opens each of her 37 trees and saves the fix by hand: 2 minutes a tree, an UPDATE and a COMMIT each.",
        norm: "There is no tree table. Each tree page walks the parent links and joins each person's facts from the person table: the sim charges 4 ms a person.",
        txn: "The save is one transaction: BEGIN, UPDATE the person row, UPDATE every tree row for that person, COMMIT. Both change together or neither does.",
        queue: "The save writes the person row and a change row in a queue table in one transaction. A worker reads the queue and updates the tree rows after the delay.",
        nightly: "Every night at 02:00 a job reads the whole person table and builds a new tree table, swapped in at 02:40. A save after 02:00 waits for the next night."
      };
      return "<strong>Tree refresh.</strong> " + txt[S.model] + " Database time per correction: " + fmt(TRIPS[S.model] * 40) + " ms.";
    },
    tree: function () {
      return "<strong>Tree table.</strong> Alcuin's 2014 copy: one row per person per tree they appear in, with name, dates and parents. 412 trees, 41,236 rows. Lavinia has 37 rows, one in each of her trees.";
    },
    tpage: function (S) {
      return "<strong>Tree pages.</strong> Each draws one tree and hangs the society's photographs on their years, naming everyone in the tree alive that year. Reading its own tree rows costs one round trip plus 0.05 ms a person; building from the person table costs one round trip plus 4 ms a person. A " + S.size + "-person tree here: " + msText(pageMs(S.model, S.size)) + " ms.";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s3e10", {
    diagram: DIAGRAM,
    startClock: 36840 - LEAD,

    setup: function (api) {
      var S = api.state;
      S.model = "none";
      S.delay = 60;
      S.when = 36840;
      S.size = 400;
      S.check = false;
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.model = api.control.select("model", "Storage model", MODELS, "none", function (v) {
        var o = pick(MODELS, v);
        if (!o) return;
        S.model = String(o.value);
        replay(api, "Storage model: " + o.label + ".");
      });
      S.ctl.delay = api.control.select("delay", "Queue delay (change queue)", DELAYS, 60, function (v) {
        var o = pick(DELAYS, v);
        if (!o) return;
        S.delay = Number(o.value);
        replay(api, "Queue delay: " + o.label + ".");
      });
      S.ctl.when = api.control.select("when", "Sabine saves at", WHENS, 36840, function (v) {
        var o = pick(WHENS, v);
        if (!o) return;
        S.when = Number(o.value);
        replay(api, "Correction at " + o.label + ".");
      });
      S.ctl.size = api.control.select("size", "Tree size for the page stat", SIZES, 400, function (v) {
        var o = pick(SIZES, v);
        if (!o) return;
        S.size = Number(o.value);
        draw(api);
      });
      S.ctl.check = api.control.toggle("check", "Nightly check at 03:00 (copies against truth)", false, function (on) {
        S.check = !!on;
        replay(api, "Nightly check: " + (S.check ? "on." : "off."));
      });
      S.ctl.min = api.control.button("min", "Skip 1 minute", function () { skipTo(api, S.now + 60); });
      S.ctl.tue = api.control.button("tue", "Skip to Tuesday 03:30", function () { skipTo(api, TUE_330); });
      S.ctl.thu = api.control.button("thu", "Skip to Thursday 23:12", function () { skipTo(api, THU_VIEW); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        wrong: api.stat("wrong", "her trees showing 1919", "bad"),
        longest: api.stat("longest", "longest a tree showed 1919", "warn"),
        page: api.stat("page", "tree page time, ms", ""),
        db: api.stat("db", "database time per correction, ms", ""),
        rows: api.stat("rows", "rows touched per correction", ""),
        night: api.stat("night", "tree rows rewritten each night", "")
      };

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startRun(api);
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      var i;
      var a;

      // 1. Opening state: before the correction, everything agrees.
      t.expect(n("wrong") === 0 && t.stat("longest") === "0:00:00" && n("page") === 60 && n("db") === 40 && n("rows") === 1 && n("night") === 0 &&
        t.node("person").text.meta === "P-20417 died 1919" && t.node("tree").text.meta === "her 37 rows: 1919",
        "Opens 2 minutes before the save: person row and her 37 tree rows all say 1919, nothing wrong yet");

      // 2. As now: the save changes one row, and all 37 trees are wrong.
      for (i = 0; i < 3; i++) t.click("min");
      t.expect(n("wrong") === 37 && t.stat("longest") === "0:01:00" && t.node("person").text.meta === "P-20417 died 1891" &&
        t.logText().indexOf("Mon 10:14:00 Sabine saves Lavinia's death date, 1919 to 1891: one UPDATE to the person table, 40 ms. Nothing touches her 37 tree rows.") >= 0,
        "As now: a minute after the save, the person page says 1891 and all 37 of her trees say 1919");

      // 3. As now on Thursday night: the story's photograph.
      t.click("thu");
      t.expect(n("wrong") === 37 && t.stat("longest") === "3 d 12:58:00" &&
        t.logText().indexOf("Thursday 23:12 Wynfrith opens Sabine's tree, T-0288: Lavinia Gorrandine, 1852 to 1919. The 1900 photograph has 8 people on the bench and 9 names, hers last.") >= 0,
        "As now: on Thursday at 23:12 her 37 trees still say 1919, 3 d 12:58:00 after the save");

      // 4. The nightly check finds the 37 on the first night.
      t.click("check");
      t.click("tue");
      t.expect(n("wrong") === 0 && t.stat("longest") === "16:46:00" &&
        t.logText().indexOf("Tue 03:00:00 Nightly check: 37 tree rows differ from the person table. Repaired from it, and an alert sent to Kesia.") >= 0,
        "As now with the 03:00 check: 37 rows repaired at Tuesday 03:00, 16:46:00 after the save");
      t.click("check");

      // 5. Normalized only: never wrong, but slow on big trees.
      t.set("model", "norm");
      t.click("tue");
      a = n("page");
      t.set("size", 12);
      t.expect(n("wrong") === 0 && t.stat("longest") === "0:00:00" && a === 1640 && n("page") === 88 && n("rows") === 1 && n("db") === 40,
        "Normalized only: no tree is ever wrong, but a 400-person page takes 1,640 ms (12 people: 88 ms)");
      t.set("size", 400);

      // 6. Same transaction: never wrong, 160 ms and 38 rows, 60 ms pages.
      t.set("model", "txn");
      for (i = 0; i < 3; i++) t.click("min");
      a = n("wrong");
      t.click("thu");
      t.expect(a === 0 && n("wrong") === 0 && t.stat("longest") === "0:00:00" && n("db") === 160 && n("rows") === 38 && n("page") === 60 &&
        t.logText().indexOf("4 round trips, 160 ms, 38 rows.") >= 0,
        "Same transaction: 160 ms and 38 rows per correction, no tree ever wrong, pages still 60 ms");

      // 7. Change queue, 60 s: wrong for the delay, then right.
      t.set("model", "queue");
      for (i = 0; i < 3; i++) t.click("min");
      a = n("wrong");
      t.click("min");
      t.expect(a === 37 && n("wrong") === 0 && t.stat("longest") === "0:01:00" && n("db") === 240 && n("rows") === 39,
        "Change queue, 60 s: all 37 trees wrong for a minute, then right; 240 ms and 39 rows per correction");

      // 8. Nightly rebuild from the story's 10:14: wrong until 02:40.
      t.set("model", "nightly");
      for (i = 0; i < 3; i++) t.click("min");
      a = n("wrong");
      t.click("tue");
      t.expect(a === 37 && n("wrong") === 0 && t.stat("longest") === "16:26:00" && n("night") === 41236 && n("rows") === 1 &&
        t.logText().indexOf("Tue 02:40:00 The rebuild is swapped in: 41,236 tree rows rewritten. Her 37 trees say 1891, 16:26:00 after the save.") >= 0,
        "Nightly rebuild: a 10:14 correction shows in her trees at 02:40 on Tuesday, 16:26:00 later, and 41,236 rows are rewritten each night");

      // 9. Nightly rebuild, a correction during the rebuild waits a whole extra night.
      t.set("when", 7800);
      t.click("tue");
      t.expect(t.stat("longest") === "1 d 0:30:00" &&
        t.logText().indexOf("Mon 02:40:00 The rebuild is swapped in: 41,236 tree rows rewritten from the 02:00 reading, before Sabine's save.") >= 0,
        "Nightly rebuild: a correction at 02:10 misses that night's 02:00 reading and waits 1 d 0:30:00");

      // 10. Nightly rebuild, a correction just before 02:00.
      t.set("when", 6600);
      t.click("tue");
      t.expect(t.stat("longest") === "0:50:00", "Nightly rebuild: a correction at 01:50 is in the trees at 02:40, 0:50:00 later");
      t.set("when", 36840);

      // 11. By hand: 74 minutes for 37 trees, 3,000 ms of database time.
      t.set("model", "hand");
      t.click("tue");
      t.expect(n("wrong") === 0 && t.stat("longest") === "1:14:00" && n("db") === 3000 && n("rows") === 38 &&
        t.logText().indexOf("Mon 11:28:00 The volunteer saves the last of her 37 trees") >= 0,
        "By hand: 2 minutes a tree, the last of 37 trees is fixed at 11:28, 1:14:00 after the save");

      // 12. The live clock: as now, 10 seconds after the save.
      t.set("model", "none");
      await t.run(13);
      t.expect(n("wrong") === 37 && t.node("tpage").text.sub === "37 of 37 trees wrong",
        "Running the clock: 10 seconds after the save, all 37 of her trees are wrong");
    }
  });
})();
