/* sims/s2e12-v1.0.0.js  (published as sims/s2e12.js)
   Case s2e12 "The Copy in the Back Room": read replicas at the Merrow Library. The catalogue's
   primary takes every write; copies (read replicas) in the back room apply its changes a little
   later and serve the reading room's and the app's reads. The learner picks where reads go (all to
   the primary, to the copies in turn, to the copies with a 5-second window for a patron's own
   reads, or one sticky copy per patron), the copies' normal lag, how many copies there are, and
   how the 19:00 overdue run writes, and can let a long report hold copy 2.

   CHANGELOG
   v1.0.0 (2026-10-10) first version: Thursday evening from 18:59:00, one slot a second. The primary
     and every copy do 1,000 queries a second; 1,500 reads and 20 writes a second; a copy applies
     up to 250 changes a second, in order, after its normal lag; a patron at the front desk every
     10 s, who checks their loans 2 s later on their phone and 70 s later at the reading room desk;
     the overdue run at 19:00 (58,800 loans: 980 a second for 60 s as now, or 200 a second for
     294 s slowed, or off). Controls: where reads go, normal lag (0 to 10 s), overdue run, add a
     copy, remove a copy (0 to 4), long report holds copy 2, skip 1 minute, skip 10 minutes, reset.
     Stats: primary busy %, busiest copy busy %, stale reads served, own change missing, went back
     in time, cost a month. selfTest: 15 assertions.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e12-v1.0.0.json):
   - post: the primary does about 1,000 queries a second, reads or writes; exam-season evenings
     bring 1,500 reads and 20 writes a second, so one server alone is 152% busy (the primary
     overloaded by reads alone: 1,500 > 1,000). Two copies in the back room, 380 a month each,
     the same kind of server as the primary: the primary at 2%, each copy 750 reads + 20 changes = 77%;
     normally 1 s behind. The catalogue holds 600,000 records. The front desk records a loan or
     return about every 10 s. The overdue run at 19:00: 58,800 open loans at 980 a second, so
     1,000 writes a second and the primary 100% busy. Mrs Penhallow returns at 19:00:40 (fine
     1.40), her phone asks copy 1 at 19:00:42 (33 s behind), she reaches the reading room at
     19:01:50 (copy 2, 84 s behind), copy 2 applies her return at 19:02:44, the copies are 181 s
     behind at 19:04:00 and back to 1 s at 19:04:16. Teodor's log in the post shows those lines.
   - comments: copies apply changes one at a time, in order, up to 250 a second (OP's reply to
     u/grey_pager); a long report on copy 2 held its changes for an hour on Tuesday, and the
     terminals take turns between the copies (OP's reply to u/hot_standby_saoirse); sticky copies
     (u/same_copy_mireille).
   - reply options: index 0 (run slowed to 200 a second, 5-second window, alert over 5 s): primary
     22% during the run, copies 97% busy and 1 s behind, 0 own changes missing, 165 stale reads by
     19:05:00 instead of 14,546, no alert. Index 1 (four copies): primary still 100% at 19:00,
     copies 63% busy, 181 s behind at worst, 41 own changes missing, 1,900 a month instead of
     1,140. Index 2 (every read to the primary): 250% during the run, then 152%, nothing stale.
     Index 3 (the window only): 15 own changes missing, all at the reading room, and 15 that went
     back in time, Mrs Penhallow's among them.

   Teaching model (stated in sim.lede):
   - Slot n is the second starting n s after 19:00:00; the replay starts at slot -60 (18:59:00).
     A frame processes every slot up to the clock, so results never depend on the frame rate.
     Within a slot, in this order: (1) the primary commits the slot's writes, (2) every copy
     applies what has reached it, (3) reads are served and counted, (4) logs and alerts are
     written from the state after (2), (5) patrons' own checks are served (each captures what it
     saw before any counter or record changes, and its log line uses only that), (6) the front
     desk's patron, if any, is recorded.
   - cum(n) is the number of writes committed up to the end of slot n. Before the replay the
     evening is steady: cum(n) = 20 x (n + 61) for n < -60, so cum(-61) = 0.
   - A write committed in slot k reaches a copy at slot k + lag. Copy j holds P_j, how many writes
     it has applied (always the oldest first). In slot n it applies min(250, cum(n - lag) - P_j),
     or nothing while the report holds it (copy 2 only). Its horizon m_j is the last slot whose
     writes it has all applied (the largest k with cum(k) <= P_j), and its lag is n - m_j. A
     patron's change made in slot w is visible on copy j iff m_j >= w. At the start every copy is
     steady: P = cum(-61 - lag), m = -61 - lag.
   - Reads: 1,500 a second, all to the primary when reads go there or when there are no copies,
     otherwise split evenly (750, 500 or 375 each). A read is stale when its record has a change
     the copy hasn't applied; reads are spread evenly over 600,000 records, so a slot adds
     reads_j x min(cum(n) - P_j, 600,000) / 600,000 to the expected count. The sum is kept as an
     integer and rounded only for display.
   - Load: primary (writes + reads sent to it) / 1,000; copy (reads + changes applied) / 1,000.
     Above 100% the extra waits; the sim shows the percentage and doesn't model the waiting.
   - Patrons: one at every slot n divisible by 10, numbered p = n / 10 (Mrs Penhallow is p = 4).
     Their two checks are among the 1,500 reads. Reads to the copies: the phone check (n + 2)
     goes to copy p mod N, the reading room check (n + 70) to copy (p + 1) mod N. Sticky: both
     to copy p mod N. Window: a check within 5 s of the patron's write goes to the primary. Own
     change missing counts checks that don't show the patron's change; went back in time counts
     patrons whose phone showed it and whose reading room check then didn't.
   - Alerts: a copy that goes over 5 s behind logs a lag alert once, and logs again when it is back
     to 5 s or less, with its worst lag, captured before the episode is reset.

   Self-test arithmetic (as now: 2 copies, lag 1 s, reads to the copies, the run at full speed):
   - Before 19:00 every copy is steady: P(n) = cum(n - 1), one slot of 20 changes waiting.
     cum(-1) = 1,200. During the run, cum(n) = 1,200 + 1,000(n + 1) for 0 <= n <= 59, and after
     it cum(n) = 61,200 + 20(n - 59).
   - The copies apply 250 a slot from slot 0 on: P(n) = 1,200 + 250n while that is below
     cum(n - 1), which holds up to n = 255 (230n <= 58,800). So m(n) = floor(n / 4) - 1 for
     n <= 240 and lag(n) = n - floor(n / 4) + 1: 6 at 19:00:06 (the first over 5 s), 33 at
     19:00:42, 46 at 19:01:00, 84 at 19:01:50, 181 at 19:03:59 and 19:04:00 (the worst). After
     the run's last change is applied at n = 240, m(n) = 59 + floor((250n - 60,000) / 20): 170
     at n = 241, 9 at n = 255; at n = 256 P = cum(255) = 65,120 and the lag is back to 1
     (19:04:16).
   - Mrs Penhallow (w = 40): her phone check at n = 42 goes to copy 1 (p = 4), m = 9 < 40: stale,
     33 s behind. Her reading room check at n = 110 goes to copy 2, m = 26 < 40: stale, 84 s
     behind. Copy 2's m first reaches 40 at n = 164 (19:02:44), 124 s after her return.
   - Own change missing: phone checks are stale for w = 0, 10, ..., 250 (26 patrons; at w = 250,
     n = 252, m = 209; at w = 260 the copies have caught up); reading room checks for w = 30, ...,
     170 (15; at w = 20, n = 90, m = 21; at w = 180, n = 250, m = 184). 26 + 15 = 41, and none
     went back in time, because every stale reading room check had a stale phone check before it.
   - Stale reads by 19:05:00 (n = 300): waiting changes per slot are 20 for n < 0 (60 slots,
     1,200), 1,000 + 750n for n = 0..59 (1,387,500), 58,820 - 230n for n = 60..255 (196 x 58,820
     - 230 x 30,870 = 4,428,620), and 20 for n = 256..300 (900): 5,818,220 in all, x 1,500 /
     600,000 = 14,545.55, shown as 14,546. Four copies: 375 x 4 = 1,500 reads per slot, the same
     14,546, the same 41.
   - Slowed run (200 a second for 294 s, slots 0..293): 220 writes a slot, under 250, so the
     copies apply everything a slot later and stay 1 s behind. Stale reads by 19:05:00: 60 x 20 +
     294 x 220 + 7 x 20 = 66,020, x 1,500 / 600,000 = 165.05, shown as 165. Primary 22% at
     19:00:00; copies (750 + 220) / 1,000 = 97% from 19:00:01.
   - Window only, run at full speed: every phone check goes to the primary; the 15 stale reading
     room checks remain, and each of them went back in time.
   - Lag 3 s, run off, to 19:01:00 (n = 60): phone checks at n = w + 2 see m = w - 1, so all 12
     (w = -60, ..., 50) miss; reading room checks (w = -60, ..., -10) see m = w + 67. Stale reads:
     121 slots x 1,500 x 60 / 600,000 = 18.15, shown as 18. With the window: 0 missing, still 18.
   - Report holds copy 2 from slot 1 (clicked at 19:00:00), run off, to 19:10:00 (n = 600):
     P2 stays cum(-1) = 1,200, m2 = -1, lag(n) = n + 1: the alert at n = 5 (6 s), 601 s at n =
     600. Phone checks on copy 2 (odd p, w = 10, ..., 590): 30 missing. Reading room checks on
     copy 2 (even p, w = 0, ..., 530): 27 missing, each after the phone showed the change on copy
     1: 27 went back in time. Sticky: odd p read copy 2 twice, 30 + 27 = 57 missing, 0 went back.
     Released at 19:10:00: from n = 601 copy 2 applies 250 a slot, P2 = 1,200 + 250(k + 1) at n =
     601 + k, m2 = floor((230 + 250k) / 20): lag 15 at n = 651, 3 at n = 652 (19:10:52).
   - Option C (every read to the primary, run at full speed): (1,000 + 1,500) / 1,000 = 250% at
     19:00:00, (20 + 1,500) / 1,000 = 152% at 19:01:00.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px,
   edge label 11px, group label 11px):
   - Top row (y 45, 62 high): Overdue run (190 wide, x 110): longest sub "starts at 19:00" and
     "done at 19:04:54", 16 chars, 115px. Front desk and app (200 wide, x 330): label 18 chars,
     140px; meta "a patron every 10 s" 19 chars, 125px. Reading room and app (230 wide, x 590):
     label 20 chars, 156px; longest meta "own reads: primary for 5 s" 26 chars, 172px. Gaps 25px
     and 45px.
   - Catalogue service (340 wide, y 165): longest meta "reads to copies; yours: primary for 5 s",
     39 chars, 257px. Top row bottom y 76, service top y 134 (58px).
   - Primary (220 wide, 72 high, db, y 290): service bottom y 196, primary top y 254 (58px).
   - Copies (112 wide, 62 high, y 425, x 300, 420, 540, 660): longest sub "7,261 s behind" 14
     chars, 101px; longest meta "held, busy 75%" 14 chars, 92px; 8px between neighbours.
     Primary bottom y 326, copies top y 394 (68px).
   - Edge labels: "writes" near (301, 217), 40px, between the service and the primary; "reads"
     near (380, 287), 33px, on the service-to-copy-1 edge; "changes" near (208, 357), 46px, on
     the bus from the primary at y 365, below the primary (y 326) and above the copies (y 394).

   Catalog note: the case's concept is the catalog's id for s2e12
   (read-replicas-for-read-heavy-traffic).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 10;                          // sim seconds per real second
  var START_CLOCK = 18 * 3600 + 59 * 60;   // 18:59:00 on Thursday
  var K0 = -60;                            // the first slot, 18:59:00, counted from 19:00:00
  var LAST = 7200;                         // 21:00:00, closing time
  var CAP = 1000;                          // queries a second each server can do
  var READS = 1500;                        // reads a second in the evening
  var WRITES = 20;                         // writes a second from the front desk and the app
  var APPLY = 250;                         // changes a second a copy can apply, one at a time
  var RECORDS = 600000;                    // records in the catalogue
  var RUNS = {
    full: { rate: 980, len: 60 },          // 58,800 loans in 60 s
    slow: { rate: 200, len: 294 },         // 58,800 loans in 4 min 54 s
    off: { rate: 0, len: 0 }
  };
  var EVERY = 10;                          // a patron at the front desk every 10 s
  var APP_AT = 2;                          // their phone check, 2 s later
  var ROOM_AT = 70;                        // their reading room check, 70 s later
  var WINDOW = 5;                          // the read-your-writes window
  var ALERT = 5;                           // lag alert above 5 s
  var MAX_COPIES = 4;
  var PRICE = 380;                         // a month, for the primary and for each copy
  var PEN = 40;                            // 19:00:40, Mrs Penhallow's return
  var EPS = 1e-6;
  var DOT_EVERY = 0.4;                     // real seconds between sample dots
  var DOT_SPEED = 300;
  var BUS_Y = 365;
  var PRIMARY_X = 130;
  var COPY_X = [300, 420, 540, 660];

  var ROUTES = [
    { value: "copies", label: "Reads to the copies, in turn (as now)" },
    { value: "primary", label: "Every read to the primary" },
    { value: "ryw", label: "Copies, but your own reads to the primary for 5 s" },
    { value: "sticky", label: "Copies, each patron always on the same copy" }
  ];
  var ROUTE_NAME = {
    copies: "to the copies, in turn",
    primary: "every read to the primary",
    ryw: "to the copies, with a 5-second window for a patron's own reads",
    sticky: "to the copies, each patron always on the same copy"
  };
  var ROUTE_META = {
    copies: "reads to the copies, in turn",
    primary: "every read to the primary",
    ryw: "reads to copies; yours: primary for 5 s",
    sticky: "each patron reads one copy"
  };
  var READER_META = {
    copies: "to the copies, in turn",
    primary: "all to the primary",
    ryw: "own reads: primary for 5 s",
    sticky: "each patron: the same copy"
  };
  var RUN_OPTS = [
    { value: "full", label: "At 19:00, 980 a second (as now)" },
    { value: "slow", label: "At 19:00, slowed to 200 a second" },
    { value: "off", label: "Off tonight" }
  ];
  var RUN_NAME = {
    full: "at 19:00, 980 changes a second",
    slow: "at 19:00, slowed to 200 changes a second",
    off: "off tonight"
  };

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  // 14546 -> "14,546". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Slot n -> its clock time, counted from 19:00:00.
  function hms(n) {
    var s = 19 * 3600 + n;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }

  function mod(a, b) { return ((a % b) + b) % b; }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  // [0, 1] -> "copies 1 and 2"; [1] -> "copy 2".
  function names(js, cap) {
    var nums = js.map(function (j) { return String(j + 1); });
    var head = js.length === 1 ? "copy " : "copies ";
    var body = nums.length === 1 ? nums[0] : nums.slice(0, -1).join(", ") + " and " + nums[nums.length - 1];
    var s = head + body;
    return cap ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 480,
    aria: "Read replica sim for the Merrow Library. The front desk and the app send writes through the catalogue service to the primary; the overdue run writes to the primary directly. The reading room and the app send reads through the catalogue service, which sends them to the primary or to the copies in the back room, depending on the setting. The primary sends every change on to every copy, and each copy applies them a little later.",
    nodes: [
      { id: "run", label: "Overdue run", sub: "starts at 19:00", meta: "58,800 loans", x: 110, y: 45, w: 190, h: 62, shape: "box", tone: "" },
      { id: "desk", label: "Front desk and app", sub: "20 writes/s", meta: "a patron every 10 s", x: 330, y: 45, w: 200, h: 62, shape: "box", tone: "" },
      { id: "readers", label: "Reading room and app", sub: "1,500 reads/s", meta: "to the copies, in turn", x: 590, y: 45, w: 230, h: 62, shape: "box", tone: "" },
      { id: "svc", label: "Catalogue service", sub: "writes to the primary", meta: "reads to the copies, in turn", x: 460, y: 165, w: 340, h: 62, shape: "box", tone: "" },
      { id: "primary", label: "Primary", sub: "busy 2%", meta: "writes 20/s", x: 130, y: 290, w: 220, h: 72, shape: "db", tone: "ok" },
      { id: "c1", label: "Copy 1", sub: "1 s behind", meta: "busy 77%", x: 300, y: 425, w: 112, h: 62, shape: "db", tone: "ok" },
      { id: "c2", label: "Copy 2", sub: "1 s behind", meta: "busy 77%", x: 420, y: 425, w: 112, h: 62, shape: "db", tone: "ok" },
      { id: "c3", label: "Copy 3", sub: "not built", meta: "", x: 540, y: 425, w: 112, h: 62, shape: "db", tone: "muted" },
      { id: "c4", label: "Copy 4", sub: "not built", meta: "", x: 660, y: 425, w: 112, h: 62, shape: "db", tone: "muted" }
    ],
    edges: [
      { from: "desk", to: "svc" },
      { from: "readers", to: "svc" },
      { from: "run", to: "primary" },
      { from: "svc", to: "primary", label: "writes" },
      { from: "svc", to: "c1", label: "reads" },
      { from: "svc", to: "c2" },
      { from: "svc", to: "c3" },
      { from: "svc", to: "c4" },
      { from: "primary", to: "c1", label: "changes", via: [[PRIMARY_X, BUS_Y], [COPY_X[0], BUS_Y]] },
      { from: "primary", to: "c2", via: [[PRIMARY_X, BUS_Y], [COPY_X[1], BUS_Y]] },
      { from: "primary", to: "c3", via: [[PRIMARY_X, BUS_Y], [COPY_X[2], BUS_Y]] },
      { from: "primary", to: "c4", via: [[PRIMARY_X, BUS_Y], [COPY_X[3], BUS_Y]] }
    ]
  };

  /* ---------- the database ---------- */

  // Writes committed up to the end of slot n. Before the replay the evening is steady.
  function cumAt(S, n) {
    if (n < K0) return WRITES * (n - K0 + 1);
    return S.cum[n - K0];
  }

  function runRate(S, n) {
    var r = RUNS[S.run];
    return n >= 0 && n < r.len ? r.rate : 0;
  }

  function lagRange(S) {
    var lo = Infinity;
    var hi = -Infinity;
    for (var j = 0; j < S.copies; j++) {
      lo = Math.min(lo, S.cp[j].lag);
      hi = Math.max(hi, S.cp[j].lag);
    }
    return { lo: lo, hi: hi };
  }

  function behindText(S) {
    if (!S.copies) return "";
    var r = lagRange(S);
    if (r.lo === r.hi) return (S.copies === 1 ? "Copy 1 is " : "The copies are ") + fmt(r.hi) + " s behind.";
    return "The copies are " + fmt(r.lo) + " to " + fmt(r.hi) + " s behind.";
  }

  /* ---------- one patron's check of their own loans ---------- */

  function ownRead(api, n, w, kind) {
    var S = api.state;
    var rec = S.pat[w];
    if (!rec) return;
    var nc = S.copies;
    var p = w / EVERY;
    var where;
    if (S.routing === "primary" || nc === 0) where = -1;
    else if (S.routing === "ryw" && n - w <= WINDOW) where = -1;
    else if (S.routing === "sticky") where = mod(p, nc);
    else where = mod(kind === "app" ? p : p + 1, nc);

    // Everything the log says is read here, before the counters or the patron's record change.
    var cp = where >= 0 ? S.cp[where] : null;
    var who = cp ? "copy " + (where + 1) : "the primary";
    var lagNow = cp ? cp.lag : 0;
    var saw = cp ? cp.m >= w : true;
    var phoneSaw = rec.app;
    var back = kind === "room" && phoneSaw === true && !saw;

    if (!saw) S.ryw += 1;
    if (back) S.back += 1;
    if (kind === "app") rec.app = saw;
    else delete S.pat[w];

    var lagText = cp ? " " + who.charAt(0).toUpperCase() + who.slice(1) + " is " + fmt(lagNow) + " s behind." : "";
    if (w === PEN) {
      if (kind === "app") {
        api.log(hms(n) + " Her phone asks " + who + ": " +
          (saw ? "returned, nothing owed." : "still on loan to her, four days overdue.") + lagText, saw ? "ok" : "bad");
      } else {
        api.log(hms(n) + " At the reading room desk, Solveig's screen asks " + who + ": " +
          (saw ? "returned, nothing owed." : "on loan to her, four days overdue, fine 1.40 unpaid.") + lagText +
          (back ? " The book has come back." : ""), saw ? "ok" : "bad");
        if (!saw && cp) S.penWatch = where;
      }
      return;
    }
    if (back && !S.firstBack) {
      S.firstBack = true;
      api.log(hms(n) + " A patron who used the front desk at " + hms(w) + " saw the change on their phone, but " + who +
        " (" + fmt(lagNow) + " s behind) doesn't have it: it has gone back in time.", "bad");
    } else if (!saw && !S.firstMiss) {
      S.firstMiss = true;
      api.log(hms(n) + " A patron who used the front desk at " + hms(w) + " checks " +
        (kind === "app" ? "their phone" : "at the reading room desk") + ": " + who + " is " + fmt(lagNow) +
        " s behind and doesn't show their change yet.", "bad");
    }
  }

  /* ---------- one slot: one second ---------- */

  function slot(api) {
    var S = api.state;
    var n = K0 + S.i;
    var nc = S.copies;
    var j;
    var cp;

    // (1) The primary commits this second's writes.
    var w = WRITES + runRate(S, n);
    S.cum.push(cumAt(S, n - 1) + w);
    var c = cumAt(S, n);
    S.w = w;

    // (2) Every copy applies what has reached it, oldest first, up to 250 a second.
    for (j = 0; j < nc; j++) {
      cp = S.cp[j];
      var held = S.hold && j === 1;
      var limit = cumAt(S, n - S.lag);
      var room = held ? 0 : Math.min(APPLY, Math.max(0, limit - cp.P));
      cp.P += room;
      cp.applied = room;
      cp.held = held;
      while (cp.m < n && cumAt(S, cp.m + 1) <= cp.P) cp.m += 1;
      cp.lag = n - cp.m;
    }

    // (3) Reads.
    var allPrimary = S.routing === "primary" || nc === 0;
    var per = allPrimary ? 0 : READS / nc;
    var maxLoad = 0;
    for (j = 0; j < nc; j++) {
      cp = S.cp[j];
      cp.reads = per;
      S.bg += per * Math.min(c - cp.P, RECORDS);
      var ld = (per + cp.applied) * 100 / CAP;
      if (ld > maxLoad) maxLoad = ld;
    }
    S.pReads = allPrimary ? READS : 0;
    S.pLoad = (w + S.pReads) * 100 / CAP;
    S.cLoad = maxLoad;

    // (4) Logs, from the state after this second's changes were applied.
    var r = RUNS[S.run];
    if (r.len && n === 0) {
      api.log(hms(n) + (S.run === "full"
        ? " The overdue run starts: 58,800 loans at 980 changes a second, on top of the usual 20."
        : " The overdue run starts, slowed to 200 changes a second: 58,800 loans in 4 minutes 54 s.") +
        " The primary is " + fmt(S.pLoad) + "% busy.", S.run === "full" ? "warn" : "");
    }
    if (r.len && n === r.len) {
      api.log(hms(n) + " The overdue run is done. " + behindText(S), "");
    }
    if (S.penWatch >= 0 && S.penWatch < nc && S.cp[S.penWatch].m >= PEN) {
      api.log(hms(n) + " Copy " + (S.penWatch + 1) + " applies Mrs Penhallow's return, " + (n - PEN) +
        " s after the front desk recorded it. The screen changes by itself: returned, " + hms(PEN) + ".", "warn");
      S.penWatch = -1;
    }
    alerts(api, n);
    if (S.pLoad > 100 && !S.over) {
      S.over = true;
      api.log(hms(n) + " The primary is " + fmt(S.pLoad) + "% busy: more work than it can do, so searches and returns wait.", "bad");
    } else if (S.pLoad <= 100 && S.over) {
      S.over = false;
      api.log(hms(n) + " The primary is back to " + fmt(S.pLoad) + "% busy.", "ok");
    }

    // Patrons' checks of their own loans, then this second's patron at the front desk.
    if (mod(n - APP_AT, EVERY) === 0) ownRead(api, n, n - APP_AT, "app");
    if (mod(n - ROOM_AT, EVERY) === 0) ownRead(api, n, n - ROOM_AT, "room");
    if (mod(n, EVERY) === 0) {
      S.pat[n] = { app: null };
      if (n === PEN) {
        api.log(hms(n) + " Mrs Penhallow returns a book four days overdue at the front desk and pays her 1.40 fine. The primary has it at once.", "");
      }
    }

    S.i += 1;
  }

  function alerts(api, n) {
    var S = api.state;
    var up = {};
    var down = {};
    var upKeys = [];
    var downKeys = [];
    for (var j = 0; j < S.copies; j++) {
      var cp = S.cp[j];
      var key;
      if (cp.lag > ALERT) {
        if (!cp.alerted) {
          cp.alerted = true;
          cp.peak = cp.lag;
          key = String(cp.lag);
          if (!up[key]) { up[key] = []; upKeys.push(key); }
          up[key].push(j);
        } else if (cp.lag > cp.peak) {
          cp.peak = cp.lag;
        }
      } else if (cp.alerted) {
        // Read the worst lag before the episode is cleared.
        key = cp.lag + "/" + cp.peak;
        if (!down[key]) { down[key] = { lag: cp.lag, peak: cp.peak, js: [] }; downKeys.push(key); }
        down[key].js.push(j);
        cp.alerted = false;
        cp.peak = 0;
      }
    }
    upKeys.forEach(function (k) {
      var js = up[k];
      api.log(hms(n) + " Lag alert: " + names(js, false) + (js.length === 1 ? " is " : " are ") + k + " s behind, over 5 s.", "bad");
    });
    downKeys.forEach(function (k) {
      var d = down[k];
      var one = d.js.length === 1;
      api.log(hms(n) + " " + names(d.js, true) + (one ? " is" : " are") + " back to " + d.lag + " s behind. At worst " +
        (one ? "it was " : "they were ") + fmt(d.peak) + " s behind.", "ok");
    });
  }

  function catchUp(api) {
    var S = api.state;
    var due = Math.min(Math.floor(S.t + EPS), LAST - K0);
    var guard = 0;
    while (S.i <= due && guard < 20000) {
      if (S.skipping) api.clock = START_CLOCK + S.i;
      slot(api);
      guard += 1;
    }
    if (!S.closed && S.i > LAST - K0) {
      S.closed = true;
      api.speed = 0;
      api.clock = START_CLOCK + (LAST - K0);
      api.log("21:00:00 The library closes.", "");
    }
  }

  /* ---------- the replay ---------- */

  function startDay(api) {
    var S = api.state;
    S.t = 0;
    S.i = 0;
    api.clock = START_CLOCK;
    api.speed = SPEED;
    S.cum = [];
    S.cp = [];
    for (var j = 0; j < S.copies; j++) {
      S.cp.push({ P: cumAt(S, K0 - 1 - S.lag), m: K0 - 1 - S.lag, lag: S.lag, applied: 0, reads: 0, held: false, alerted: false, peak: 0 });
    }
    S.hold = false;
    if (S.ctl && S.ctl.hold) S.ctl.hold.set(false);
    S.bg = 0;
    S.ryw = 0;
    S.back = 0;
    S.pat = {};
    S.w = WRITES;
    S.pReads = 0;
    S.pLoad = 0;
    S.cLoad = 0;
    S.over = false;
    S.penWatch = -1;
    S.firstMiss = false;
    S.firstBack = false;
    S.dotClock = 0;
    S.skipping = false;
    S.closed = false;
    api.log("18:59:00 Thursday evening. " +
      (S.copies ? "The primary and " + S.copies + (S.copies === 1 ? " copy" : " copies") + " in the back room. " : "No copies: the primary does everything. ") +
      (S.copies ? "Reads: " + ROUTE_NAME[S.routing] + ". Copies normally " + S.lag + " s behind. " : "") +
      "Overdue run: " + RUN_NAME[S.run] + ".", "");
    edges(api);
    catchUp(api);
    draw(api);
  }

  function replay(api, what) {
    api.log(what + " Replaying from 18:59:00.", "");
    startDay(api);
  }

  function edges(api) {
    var S = api.state;
    for (var j = 0; j < MAX_COPIES; j++) {
      var st = j < S.copies ? "" : "cut";
      api.edge("svc", "c" + (j + 1)).set(st);
      api.edge("primary", "c" + (j + 1)).set(st);
    }
  }

  /* ---------- controls ---------- */

  function setRoute(api, v) {
    var o = pick(ROUTES, v);
    if (!o) return;
    api.state.routing = String(o.value);
    replay(api, "Reads now go " + ROUTE_NAME[api.state.routing] + ".");
  }

  function setLag(api, v) {
    var L = Math.max(0, Math.min(10, Math.round(num(v))));
    if (!isFinite(L)) return;
    api.state.lag = L;
    replay(api, "The copies now run " + L + " s behind when nothing holds them up.");
  }

  function setRun(api, v) {
    var o = pick(RUN_OPTS, v);
    if (!o) return;
    api.state.run = String(o.value);
    replay(api, "Overdue run: " + RUN_NAME[api.state.run] + ".");
  }

  function addCopy(api) {
    var S = api.state;
    if (S.copies >= MAX_COPIES) return;
    S.copies += 1;
    replay(api, "Teodor adds copy " + S.copies + " in the back room, another " + PRICE + " a month.");
  }

  function removeCopy(api) {
    var S = api.state;
    if (S.copies <= 0) return;
    var gone = S.copies;
    S.copies -= 1;
    replay(api, "Teodor switches off copy " + gone + ".");
  }

  function setHold(api, on) {
    var S = api.state;
    var n = K0 + S.i - 1;
    if (on && S.copies < 2) {
      S.ctl.hold.set(false);
      api.log("There is no copy 2 for the report to hold. Add a copy first.", "warn");
      return;
    }
    if (!!on === S.hold) return;
    // Describe copy 2 as it is now, before the report changes anything.
    var lagBefore = S.copies >= 2 ? S.cp[1].lag : 0;
    S.hold = !!on;
    if (on) {
      api.log(hms(n) + " The stock report starts on copy 2 and holds its changes: copy 2 applies nothing until the report ends. It is " +
        fmt(lagBefore) + " s behind now.", "warn");
    } else {
      api.log(hms(n) + " The report ends. Copy 2 is " + fmt(lagBefore) + " s behind and starts catching up, 250 changes a second.", "");
    }
    draw(api);
  }

  function skip(api, sec) {
    var S = api.state;
    if (S.closed) return;
    S.skipping = true;
    S.t = Math.min(Math.floor(S.t + EPS) + sec, LAST - K0);
    catchUp(api);
    S.skipping = false;
    if (!S.closed) api.clock = START_CLOCK + S.t;
    draw(api);
  }

  /* ---------- drawing ---------- */

  function draw(api) {
    var S = api.state;
    var n = K0 + S.i - 1;
    var nc = S.copies;
    var r = RUNS[S.run];

    var rn = api.node("run");
    if (S.run === "off") {
      rn.text("sub", "off tonight");
      rn.text("meta", "");
      rn.set("muted");
    } else {
      rn.text("meta", "58,800 loans");
      if (n < 0) { rn.text("sub", "starts at 19:00"); rn.set(""); }
      else if (n < r.len) { rn.text("sub", fmt(r.rate) + " changes/s"); rn.set(S.run === "full" ? "warn" : ""); }
      else { rn.text("sub", "done at " + hms(r.len)); rn.set("ok"); }
    }

    api.node("readers").text("meta", nc ? READER_META[S.routing] : "all to the primary");
    api.node("svc").text("meta", nc ? ROUTE_META[S.routing] : "every read to the primary");

    var pr = api.node("primary");
    pr.text("sub", "busy " + fmt(S.pLoad) + "%");
    pr.text("meta", "writes " + fmt(S.w) + "/s");
    pr.set(S.pLoad > 100 ? "bad" : (S.pLoad >= 90 ? "warn" : "ok"));

    for (var j = 0; j < MAX_COPIES; j++) {
      var nd = api.node("c" + (j + 1));
      if (j >= nc) {
        nd.text("sub", "not built");
        nd.text("meta", "");
        nd.set("muted");
        continue;
      }
      var cp = S.cp[j];
      var load = (cp.reads + cp.applied) * 100 / CAP;
      nd.text("sub", fmt(cp.lag) + " s behind");
      nd.text("meta", (cp.held ? "held, busy " : "busy ") + fmt(load) + "%");
      nd.set(cp.held || cp.lag > ALERT || load > 100 ? "bad" : (load >= 90 ? "warn" : "ok"));
    }

    S.stat.primary(Math.round(S.pLoad));
    S.stat.copies(Math.round(S.cLoad));
    S.stat.stale(fmt(Math.round(S.bg / RECORDS)));
    S.stat.ryw(fmt(S.ryw));
    S.stat.back(fmt(S.back));
    S.stat.cost(fmt((1 + nc) * PRICE));

    S.ctl.add.disable(nc >= MAX_COPIES);
    S.ctl.remove.disable(nc <= 0);
    S.ctl.min.disable(S.closed);
    S.ctl.ten.disable(S.closed);
  }

  /* ---------- dots: a visual sample, never counted ---------- */

  function dots(api, dt) {
    var S = api.state;
    if (api.reducedMotion || S.skipping || S.closed) return;
    S.dotClock += dt;
    if (S.dotClock < DOT_EVERY) return;
    S.dotClock = 0;
    var nc = S.copies;
    var n = K0 + S.i - 1;
    if (S.routing === "primary" || nc === 0) {
      api.dot({ path: ["readers", "svc", "primary"], cls: S.pLoad > 100 ? "dot-wait" : "dot-ok", r: 4, speed: DOT_SPEED });
    } else {
      var j = Math.floor(api.rand() * nc);
      var cp = S.cp[j];
      var target = "c" + (j + 1);
      var chance = Math.min(1, (cumAt(S, n) - cp.P) / RECORDS);
      var bad = cp.lag > ALERT || api.rand() < chance;
      api.dot({ path: ["readers", "svc", target], cls: "dot-req", r: 4, speed: DOT_SPEED,
        onArrive: function (d, wp) { if (d && wp === target) d.cls(bad ? "dot-bad" : "dot-ok"); } });
    }
    api.dot({ path: ["desk", "svc", "primary"], cls: "dot-accent", r: 3, speed: DOT_SPEED });
    if (runRate(S, n) > 0) api.dot({ path: ["run", "primary"], cls: "dot-accent", r: 4, speed: DOT_SPEED });
    for (var k = 0; k < nc; k++) {
      if (S.cp[k].applied > 0) {
        api.dot({ path: ["primary", [PRIMARY_X, BUS_Y], [COPY_X[k], BUS_Y], "c" + (k + 1)], cls: "dot-accent", r: 3, speed: DOT_SPEED });
      }
    }
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.cum || S.closed) return;
    S.t = Math.min(S.t + dt * api.speed, LAST - K0);
    catchUp(api);
    if (!S.closed) api.clock = START_CLOCK + S.t;
    draw(api);
    dots(api, dt);
  }

  /* ---------- "what is this box" ---------- */

  function copyInfo(S, j) {
    if (j >= S.copies) {
      return "<strong>Copy " + (j + 1) + ".</strong> Not built. Add a copy to put another read replica in the back room: another full copy of the catalogue, " + PRICE + " a month.";
    }
    var cp = S.cp[j];
    var waiting = cumAt(S, K0 + S.i - 1) - cp.P;
    return "<strong>Copy " + (j + 1) + ".</strong> A read replica in the back room: a full, read-only copy of the catalogue on the same kind of server as the primary, " +
      PRICE + " a month. It applies the primary's changes one at a time, in order, up to 250 a second, so it is always a little behind: right now " +
      fmt(cp.lag) + " s, with " + fmt(waiting) + " changes waiting. A read it serves can't show a change it hasn't applied." +
      (cp.held ? " The long report is holding it: it applies nothing until the report ends." : "");
  }

  var INFO = {
    run: function () {
      return "<strong>Overdue run.</strong> Every evening at 19:00 a job checks the city's 58,800 open loans and writes each one's fine or due date to the primary. As now it writes 980 a second for 60 seconds, on top of the usual 20, so the primary is 100% busy with writes alone. Slowed, it writes 200 a second for 4 minutes 54 seconds. Every change it makes, every copy has to apply too.";
    },
    desk: function () {
      return "<strong>Front desk and app.</strong> Every loan, return, renewal and hold is a write, 20 a second in the evening, and every write goes to the primary. The front desk records a loan or return every 10 seconds; that patron checks their loans on their phone 2 seconds later and at the reading room desk 70 seconds later. Mrs Penhallow returned her book at 19:00:40.";
    },
    readers: function (S) {
      return "<strong>Reading room and app.</strong> Searches, catalogue pages and loan checks: 1,500 reads a second. Right now they go " +
        (S.copies ? ROUTE_NAME[S.routing] : "to the primary, because there are no copies") + ".";
    },
    svc: function (S) {
      return "<strong>Catalogue service.</strong> Teodor's code between the terminals, the app and the database. It does the read/write splitting: every write goes to the primary, and every read goes " +
        (S.copies ? ROUTE_NAME[S.routing] : "to the primary too, because there are no copies") + ".";
    },
    primary: function (S) {
      return "<strong>Primary.</strong> The one server that takes every write. It does 1,000 queries a second, reads or writes. Right now it is " +
        fmt(S.pLoad) + "% busy: " + fmt(S.w) + " writes and " + fmt(S.pReads) + " reads a second. It sends each change on to the copies after it commits it, without waiting for them.";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s2e12", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.routing = "copies";
      S.copies = 2;
      S.lag = 1;
      S.run = "full";
      S.hold = false;
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.route = api.control.select("route", "Where reads go", ROUTES, "copies", function (v) { setRoute(api, v); });
      S.ctl.lag = api.control.range("lag", "Copies' normal lag", 0, 10, 1, 1, function (v) { setLag(api, v); },
        { format: function (v) { return v + " s"; } });
      S.ctl.run = api.control.select("run", "Overdue run", RUN_OPTS, "full", function (v) { setRun(api, v); });
      S.ctl.add = api.control.button("add", "Add a copy", function () { addCopy(api); });
      S.ctl.remove = api.control.button("remove", "Remove a copy", function () { removeCopy(api); });
      S.ctl.hold = api.control.toggle("hold", "Long report holds copy 2", false, function (on) { setHold(api, on); });
      S.ctl.min = api.control.button("min", "Skip ahead 1 minute", function () { skip(api, 60); });
      S.ctl.ten = api.control.button("ten", "Skip ahead 10 minutes", function () { skip(api, 600); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        primary: api.stat("primary", "primary busy %", ""),
        copies: api.stat("copies", "busiest copy busy %", ""),
        stale: api.stat("stale", "stale reads served", "bad"),
        ryw: api.stat("ryw", "own change missing", "bad"),
        back: api.stat("back", "went back in time", "bad"),
        cost: api.stat("cost", "cost a month (primary + copies)", "")
      };

      api.onNodeClick(function (id) {
        var S2 = api.state;
        var m = /^c([1-4])$/.exec(id);
        if (m) { api.info(copyInfo(S2, Number(m[1]) - 1)); return; }
        var f = INFO[id];
        if (f) api.info(f(S2));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startDay(api);
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      var mark = 0;
      function since() { return t.logText().slice(mark); }
      function begin() { mark = t.logText().length; }
      var a;
      var b;
      var i;
      var log;

      // 1. As now: two copies take the reads.
      t.expect(n("primary") === 2 && n("copies") === 77 && n("cost") === 1140 &&
        t.node("c1").text.sub === "1 s behind" && t.node("c3").text.sub === "not built",
        "As now: the primary does only the 20 writes a second (2%), each copy 750 reads and 20 changes (77%), 1,140 a month");
      await t.run(1);
      t.expect(n("primary") === 2 && n("copies") === 77 && n("ryw") === 0 && t.node("c2").text.sub === "1 s behind",
        "Before the run the evening is steady: the copies stay 1 s behind and every patron sees their own change");

      // 2. Every read on the primary: reads alone are more than it can do.
      t.set("route", "primary");
      begin();
      t.set("run", "off");
      t.expect(n("primary") === 152 && n("stale") === 0 && since().indexOf("18:59:00 The primary is 152% busy") >= 0,
        "Every read on the primary: 1,500 reads and 20 writes a second for a server that does 1,000, 152%");

      // 3. Option C: every read on the primary during the run.
      t.set("run", "full");
      t.click("min");
      a = n("primary");
      t.click("min");
      t.expect(a === 250 && n("primary") === 152 && n("ryw") === 0 && n("stale") === 0,
        "Every read on the primary through the run: 250% at 19:00:00, 152% at 19:01:00, and nobody sees an old loan");

      // 4. Lag makes stale reads, and the 5-second window removes a patron's own.
      t.set("route", "copies");
      t.set("run", "off");
      t.set("lag", 3);
      t.click("min");
      t.click("min");
      a = n("ryw");
      b = n("stale");
      t.set("route", "ryw");
      t.click("min");
      t.click("min");
      t.expect(a === 12 && b === 18 && n("ryw") === 0 && n("stale") === 18,
        "Lag 3 s: by 19:01:00, 18 stale reads and all 12 phone checks miss their own change; with the 5-second window, none do");

      // 5. Thursday as now.
      t.set("route", "copies");
      t.set("lag", 1);
      begin();
      t.set("run", "full");
      for (i = 0; i < 6; i++) t.click("min");
      log = since();
      t.expect(log.indexOf("19:00:00 The overdue run starts: 58,800 loans at 980 changes a second, on top of the usual 20. The primary is 100% busy.") >= 0 &&
        log.indexOf("19:00:42 Her phone asks copy 1: still on loan to her, four days overdue. Copy 1 is 33 s behind.") >= 0 &&
        log.indexOf("19:01:50 At the reading room desk, Solveig's screen asks copy 2: on loan to her, four days overdue, fine 1.40 unpaid. Copy 2 is 84 s behind.") >= 0 &&
        log.indexOf("19:02:44 Copy 2 applies Mrs Penhallow's return, 124 s after the front desk recorded it.") >= 0,
        "Thursday as now: the run puts the primary at 100%, Mrs Penhallow's phone (33 s behind) and the reading room (84 s behind) still show her book, and copy 2 applies her return at 19:02:44");
      t.expect(log.indexOf("19:00:06 Lag alert: copies 1 and 2 are 6 s behind, over 5 s.") >= 0 &&
        log.indexOf("19:01:00 The overdue run is done. The copies are 46 s behind.") >= 0 &&
        log.indexOf("19:04:16 Copies 1 and 2 are back to 1 s behind. At worst they were 181 s behind.") >= 0,
        "Thursday as now: the copies pass 5 s behind at 19:00:06, are 46 s behind when the run ends, and catch up at 19:04:16 after 181 s at worst");
      t.expect(n("ryw") === 41 && n("back") === 0 && n("stale") === 14546 && t.node("c2").text.sub === "1 s behind",
        "Thursday as now, by 19:05:00: 41 own changes missing (26 phone checks, 15 at the reading room) and 14,546 stale reads");

      // 6. Option B: four copies, the same run.
      t.click("add");
      t.click("add");
      begin();
      t.click("min");
      a = n("primary");
      t.click("min");
      b = n("copies");
      for (i = 0; i < 4; i++) t.click("min");
      t.expect(a === 100 && b === 63 && n("cost") === 1900 && n("ryw") === 41 && n("stale") === 14546 &&
        since().indexOf("Copies 1, 2, 3 and 4 are back to 1 s behind. At worst they were 181 s behind.") >= 0,
        "Four copies: the primary still 100% at 19:00, copies 63% busy, just as far behind, the same 41 and 14,546, for 1,900 a month");

      // 7. Option D: the window only.
      t.click("remove");
      t.click("remove");
      begin();
      t.set("route", "ryw");
      for (i = 0; i < 6; i++) t.click("min");
      log = since();
      t.expect(n("ryw") === 15 && n("back") === 15 &&
        log.indexOf("19:00:42 Her phone asks the primary: returned, nothing owed.") >= 0 &&
        log.indexOf("fine 1.40 unpaid. Copy 2 is 84 s behind. The book has come back.") >= 0,
        "The window only: every phone check is right, but 15 reading room checks miss the change, and each one went back in time");

      // 8. Option A: the run slowed, the window, the alert.
      begin();
      t.set("run", "slow");
      t.click("min");
      a = n("primary");
      t.click("min");
      b = n("copies");
      for (i = 0; i < 4; i++) t.click("min");
      log = since();
      t.expect(a === 22 && b === 97 && n("ryw") === 0 && n("back") === 0 && n("stale") === 165 &&
        log.indexOf("Lag alert") < 0 && log.indexOf("19:04:54 The overdue run is done. The copies are 1 s behind.") >= 0 &&
        t.node("c1").text.sub === "1 s behind",
        "Slowed run with the window: primary 22%, copies 97% and never more than 1 s behind, no own change missing, 165 stale reads");

      // 9. A copy that falls far behind, with reads taking turns.
      t.set("route", "copies");
      begin();
      t.set("run", "off");
      t.click("min");
      t.click("hold");
      t.click("ten");
      t.expect(n("ryw") === 57 && n("back") === 27 && t.node("c2").text.sub === "601 s behind" &&
        t.node("c2").text.meta === "held, busy 75%" && since().indexOf("19:00:05 Lag alert: copy 2 is 6 s behind, over 5 s.") >= 0,
        "The report holds copy 2 from 19:00:00: 601 s behind by 19:10:00, 57 own changes missing and 27 that went back in time");
      begin();
      t.click("hold");
      t.click("min");
      t.expect(since().indexOf("19:10:52 Copy 2 is back to 3 s behind. At worst it was 601 s behind.") >= 0,
        "The report ends at 19:10:00 and copy 2 is back under 5 s at 19:10:52");

      // 10. Sticky copies: nobody goes back in time, but copy 2's patrons still miss their change.
      t.set("route", "sticky");
      t.click("min");
      t.click("hold");
      t.click("ten");
      t.expect(n("ryw") === 57 && n("back") === 0,
        "Sticky copies with copy 2 held: still 57 own changes missing, but none went back in time");

      // 11. No copies: everything on the primary.
      t.set("route", "copies");
      t.click("remove");
      t.click("remove");
      t.expect(n("primary") === 152 && n("cost") === 380 && t.node("c1").text.sub === "not built",
        "No copies: reads go to the primary, 152%, for 380 a month");
    }
  });
})();
