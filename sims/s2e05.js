/* sims/s2e05-v1.0.2.js  (published as sims/s2e05.js)
   Case s2e05 "Stale Milk": a cache invalidation sim for Round 6 of Kettlewell Dairy. Forty houses'
   orders live in a slow order database; the order service reads them cache-aside through "the
   sheet", a cache with one card per house. The learner picks what the depot office's changes do
   to the sheet (TTL only, delete on write, write-through, write-back), the cards' TTL and a slow
   reader race, sends more office changes, kills the cache node, and skips ahead to 7 October.

   CHANGELOG
   v1.0.2 (2026-10-10) QA: the last three places that still blamed Graham's phone now name the order
     service (the log with the race off, the replay message) and the phones box starts at "0 old orders
     shown", matching the meta it shows once the sim runs.
   v1.0.1 (2026-10-10) Season 2 review fixes: the slow reader race is the order service's read for
     Graham, slow on the line to the database, not his phone's signal (both race log lines, the
     toggle label "Slow reader race (Graham's read, 13:59)", and selfTest 4's expected log text);
     a "Pause the clock" toggle after the race toggle sets api.speed to 0, so a learner can send
     five office changes and kill the cache node between 16:00 and 17:00; the phones box counts
     old orders shown, not phones; the header points at case v1.0.1.
   v1.0.0 (2026-10-07) first version: one slot is one minute from 00:00 on 14 March, when the sheet
     was switched on, empty. Readers: 39 houses' apps (hourly checks) and the route app (one stop a
     minute from 04:30). Writers: the office, scripted at 13:59 (No. 14's account note) and 14:00
     (No. 14 cancelled) on 14 March, plus a button for more phone changes. Controls: strategy, TTL
     (never, 7 days, 1 day, 6 hours, 1 hour), slow reader race, office change, cache node dies,
     skip 24 hours, skip to 7 October 05:30, reset. Stats: stale deliveries since 14 March, writes
     lost, database load over the last 24 h (reads plus writes that reached the database), hit
     ratio over the last 24 h. selfTest: 13 assertions covering TTL only with cards that never
     expire (207 stale deliveries, 414 pints by 7 October), TTL only with 7 days (6, then the card
     runs out), delete on write (clean), delete on write with the race (207, 1, 0 for never, 1 day
     and 6 hours), a 1-hour TTL (4% hits, 937 reads a day), write-through (current, 4 writes for 2
     changes), write-back losing the 5 changes made after the 16:00 flush, and a restart clearing
     TTL-only's stale card.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e05-v1.0.1.json):
   - post: Round 6 is forty houses on Mallow Street, one stop a minute from 04:30, so No. k is read
     at 04:30 + (k - 1) minutes and No. 14 at 04:43. Thirty-nine houses have the app, which checks
     the order every hour (the sim puts No. k's check at k - 1 minutes past each hour); No. 14 has
     none. Ruairi switched the sheet on, empty, at 00:00 on 14 March; cards never expire. The log:
     14 March 04:43 No. 14 read, no card, database 2 pints; 13:59:00 son's phone number added;
     13:59:58 viewed by son, sheet 2 pints (a hit); 14:00:00 cancelled; 7 October 04:43 sheet still
     2 pints. Orders: No. k takes 1 + ((k + 2) mod 3) pints, so No. 14 takes 2 and the round 79
     pints, 77 once No. 14 is cancelled ("79 pints loaded, 77 billed"). Mornings from 15 March to
     7 October: 17 + 30 + 31 + 30 + 31 + 31 + 30 + 7 = 207 stale deliveries, 414 pints. 7 October
     is day 207, so the skip goes to minute 207 x 1440 + 330 (05:30), after that morning's round.
   - comments: u/sorting_office_petra's flush and lost changes; u/late_reply_ayodele's race, which
     needs the 13:59 write to have deleted No. 14's card so that the son's phone misses at
     13:59:58; u/standing_order_hettie and OP: changes made by 8 PM make the next morning's round.
   - reply options: index 0 (write-back): five office changes after the 16:00 flush, the node
     dies before 17:00: 5 writes lost, and the next morning 5 houses get their old orders; No. 9
     (3 pints, cut to 1) is read at 04:38. Index 1 (1-hour TTL): every app check finds its card
     exactly 60 minutes old, so 936 app checks plus No. 14's route read miss: 937 reads a day,
     hits 39 of 976 = 4.0%. Index 2 (write-through): 2 changes cost 4 writes, 100% hits, the
     database sees only the 2 writes. Index 3 (delete on write, 6-hour TTL): each card with an app
     misses 4 times a day and No. 14 once: 157 reads a day, hits 819 of 976 = 83.9%; with the race
     the son's late copy (set at 14:00) runs out at 20:00, before the round, so 0 stale.

   Teaching model (stated in sim.lede):
   - Slot m is minute m after 00:00 on 14 March. A frame processes every slot up to the clock, so
     results never depend on the frame rate. Within a slot: the write-back flush (on the hour),
     then the scripted office writes and Graham's read, then the route read, then one app check.
   - Reads are cache-aside: a live card is a hit; otherwise the read goes to the database (one
     database read) and leaves a copy. A card is live while its age is under the TTL; a card
     waiting for a write-back flush is always live. TTL "never" is stored as 0.
   - Office writes: TTL only writes the database. Delete on write writes the database, then deletes
     the card. Write-through writes the database and sets the card. Write-back sets the card,
     marks it waiting, and the hourly flush writes every waiting card to the database (several
     changes to one card become one database write).
   - Graham's read happens at 13:59 on 14 March in every run, after the 13:59 note. If it misses,
     it reads the database; with the race off it leaves its copy at once, with the race on it
     leaves its copy at 14:00, after the cancellation. It only misses when the card is gone (delete
     on write) or expired (TTL only with 6 hours or 1 hour).
   - A stale delivery is a route read whose value differs from the house's latest accepted order.
     A cache node death empties the sheet; under write-back, the changes waiting for the flush are
     lost: the database keeps the old order, and the house keeps getting it.
   - Stats over the last 24 h use one bucket per minute. api.rand() only picks which recent read a
     sample dot shows; no counted number depends on it.

   Self-test arithmetic (24-hour window ending at the current minute M):
   - Any 1,440-minute window holds 936 app checks (39 houses x 24) and one round (40 reads).
   - 15 March 06:00, M = 1800, window 361..1800: 936 + 40 + Graham's read at 839 = 977 reads.
     TTL only, never: 0 misses, 100%; database 2 writes. Delete on write: Graham misses at 839 and
     No. 14 misses at 04:43 on 15 March: 975 of 977 = 99.8%; database 2 writes + 2 reads = 4. With
     the race: No. 14's 04:43 read hits the late copy, so 2 writes + 1 read = 3. Write-through:
     Graham hits the card written at 13:59: 100%, database 2.
   - 7 October 05:30, M = 298,410: no writes in the window. 6 hours: refills every 360 minutes at
     app checks, 4 per house, plus No. 14's daily miss: 157. 1 hour: 937 (see above).
   - TTL only, 7 days: No. 14's card, filled at 283 (14 March 04:43), is stale on 15 to 20 March
     (5 by 19 March 06:00, 6 by 20 March) and expires at exactly 7 days, at 04:43 on 21 March.
   - Write-back: run(16.1) is 966 ticks, about minute 966 (16:06). The 13:59 note was flushed at
     14:00 and the cancellation at 15:00, so nothing is waiting; five clicks make 5 waiting
     (houses 9, 22, 31, 5, 27), and the node dies before the 17:00 flush.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px,
   edge label 11px):
   - Top row (y 50, 62 high, 220 wide, x 125, 370, 615; 25px gaps): longest sub "39 apps, check
     hourly" and "Round 6, 30 September", 21 chars, 151px; longest meta "12 changes: database
     only", 25 chars, 165px.
   - Order service (320 wide, y 175): longest meta "writes: database and sheet together", 35
     chars, 231px.
   - The sheet and the order database (270 wide, y 320, 72 high): longest sub "40 cards, TTL 6
     hours", 21 chars, 151px; longest meta "5 waiting for the flush", 23 chars, 152px.
   - Vertical gaps: top row bottom y 81, service top y 144 (63px); service bottom y 206, sheet and
     database top y 284 (78px).
   - Edge labels: "1. sheet first" near (270, 237), 92px, and "2. on a miss" near (470, 237), 79px,
     between the service (bottom y 206) and the lower boxes (top y 284); "changes" near (492, 107),
     46px, below the top row; "hourly flush" near (370, 312), 79px, inside the 130px gap between
     the sheet (right x 305) and the database (left x 435).

   Catalog note: the case's concepts are the catalog's own ids for s2e05 (cache-invalidation,
   write-through, write-back, stale-reads). Board strings point at cache-aside, ttl,
   cache-stampede, durability, replication-lag and read-your-writes.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 3600;                 // sim seconds per real second: an hour a second
  var START_CLOCK = 0;              // 00:00 on 14 March, when Ruairi switched the sheet on
  var DAY = 1440;                   // minutes in a day; one slot is one minute
  var HOUSES = 40;                  // Round 6: No. 1 to No. 40 on Mallow Street
  var NO14 = 14;                    // Mrs Farrow's house: 2 pints, no app
  var ROUND_START = 270;            // 04:30: No. k is read at 04:30 + (k - 1) minutes, No. 14 at 04:43
  var NOTE_AT = 839;                // 14 March 13:59: Wanda adds Graham's phone number
  var CANCEL_AT = 840;              // 14 March 14:00: Wanda cancels No. 14's milk
  var OCT7 = 207 * DAY + 330;       // 7 October 05:30, the morning of the post
  var EPS = 1e-6;
  var DOT_EVERY = 0.3;              // real seconds between sample dots for reads
  var DOT_SPEED = 300;              // viewBox units per real second
  // The houses the office's extra phone changes go to, in turn. Never No. 14.
  var ROT = [9, 22, 31, 5, 27, 18, 36, 2, 25, 12, 39, 7, 30, 16, 1, 34, 20, 11, 28, 4];
  var MONTHS = [["March", 31], ["April", 30], ["May", 31], ["June", 30], ["July", 31], ["August", 31],
    ["September", 30], ["October", 31], ["November", 30], ["December", 31], ["January", 31], ["February", 28]];

  var STRATEGIES = [
    { value: "ttl", label: "TTL only: database only (as now)" },
    { value: "delete", label: "Delete on write: database, then delete card" },
    { value: "through", label: "Write-through: database and sheet together" },
    { value: "back", label: "Write-back: sheet now, database hourly" }
  ];
  var TTLS = [
    { value: 0, label: "never (Ruairi's)" },
    { value: 10080, label: "7 days" },
    { value: 1440, label: "1 day" },
    { value: 360, label: "6 hours" },
    { value: 60, label: "1 hour" }
  ];
  var STRAT_SUB = { ttl: "TTL only (as now)", delete: "delete on write", through: "write-through", back: "write-back" };
  var STRAT_META = {
    ttl: "writes: database only",
    delete: "writes: database, then delete card",
    through: "writes: database and sheet together",
    back: "writes: sheet now, database hourly"
  };
  var STRAT_START = {
    ttl: "TTL only, as now: the office screen writes to the database and nothing else.",
    delete: "Delete on write: each office change updates the database, then deletes that house's card.",
    through: "Write-through: each office change is written to the database and the sheet together.",
    back: "Write-back: each office change goes into the sheet now and reaches the database at the next hourly flush."
  };

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  // 4320 -> "4,320". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  // 99.795 -> "99.8", 100 -> "100", 3.996 -> "4".
  function pctText(v) {
    var r = Math.round(v * 10) / 10;
    return r === Math.round(r) ? String(Math.round(r)) : r.toFixed(1);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(md) { return pad(Math.floor(md / 60)) + ":" + pad(md % 60); }

  function dateText(day) {
    var d = 14 + day;
    var i = 0;
    while (d > MONTHS[i % 12][1]) { d -= MONTHS[i % 12][1]; i += 1; }
    return d + " " + MONTHS[i % 12][0];
  }

  function dateAt(m) { return dateText(Math.floor(m / DAY)) + " " + hhmm(m % DAY); }

  function pints(k) { return 1 + ((k + 2) % 3); }

  function pintsText(p) {
    if (p === 0) return "cancelled";
    return p + (p === 1 ? " pint" : " pints");
  }

  function leaveText(p) { return p === 0 ? "nothing" : pintsText(p); }

  function changesText(q) { return q + (q === 1 ? " change" : " changes"); }

  function ttlText(min) {
    for (var i = 0; i < TTLS.length; i++) if (TTLS[i].value === min) return TTLS[i].label.replace(" (Ruairi's)", "");
    return min + " minutes";
  }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 400,
    aria: "Cache sim for Round 6 of Kettlewell Dairy. Thirty-nine houses' phones check their orders every hour and the route app reads one house a minute from 04:30, all through the order service, which looks in the sheet, a cache with one card per house, first, and asks the order database only on a miss. The depot office sends order changes to the order service, which updates the database and the sheet according to the chosen strategy. Under write-back the sheet flushes its changes to the database every hour.",
    nodes: [
      { id: "phones", label: "Houses' phones", sub: "39 apps, check hourly", meta: "0 old orders shown", x: 125, y: 50, w: 220, h: 62, shape: "box", tone: "" },
      { id: "route", label: "Route app", sub: "Round 6, 14 March", meta: "round at 04:30", x: 370, y: 50, w: 220, h: 62, shape: "box", tone: "" },
      { id: "office", label: "Depot office", sub: "phone changes", meta: "0 changes: database only", x: 615, y: 50, w: 220, h: 62, shape: "box", tone: "" },
      { id: "service", label: "Order service", sub: "TTL only (as now)", meta: "writes: database only", x: 370, y: 175, w: 320, h: 62, shape: "box", tone: "" },
      { id: "sheet", label: "The sheet (cache)", sub: "0 cards, TTL never", meta: "empty", x: 170, y: 320, w: 270, h: 72, shape: "box", tone: "" },
      { id: "db", label: "Order database", sub: "source of truth", meta: "79 pints ordered", x: 570, y: 320, w: 270, h: 72, shape: "db", tone: "ok" }
    ],
    edges: [
      { from: "phones", to: "service" },
      { from: "route", to: "service" },
      { from: "office", to: "service", label: "changes" },
      { from: "service", to: "sheet", label: "1. sheet first" },
      { from: "service", to: "db", label: "2. on a miss" },
      { from: "sheet", to: "db", label: "hourly flush", dash: true, tone: "muted" }
    ]
  };

  /* ---------- the sheet ---------- */

  function alive(S, c, m) { return c.dirty || S.ttl === 0 || m - c.filled < S.ttl; }

  function bucket(S, m) {
    var i = m % DAY;
    if (S.rMin[i] !== m) { S.rMin[i] = m; S.rReads[i] = 0; S.rHits[i] = 0; S.rDb[i] = 0; }
    return i;
  }
  function addRead(S, m, hit) { var i = bucket(S, m); S.rReads[i] += 1; if (hit) S.rHits[i] += 1; }
  function addDb(S, m) { var i = bucket(S, m); S.rDb[i] += 1; }

  // Cache-aside read of house k at minute m. fill false leaves no copy (the slow reader).
  function read(S, k, m, fill) {
    var c = S.cards[k];
    if (c && alive(S, c, m)) {
      addRead(S, m, true);
      return { v: c.p, hit: true, old: null };
    }
    var v = S.db[k];
    addRead(S, m, false);
    addDb(S, m);
    if (fill) S.cards[k] = { p: v, filled: m, dirty: false };
    return { v: v, hit: false, old: c };
  }

  // An office change to house k at minute m, by the chosen strategy.
  function officeWrite(S, k, p, m) {
    S.want[k] = p;
    S.changes += 1;
    if (S.strategy === "back") {
      S.cards[k] = { p: p, filled: m, dirty: true };
      S.queue += 1;
    } else {
      S.db[k] = p;
      addDb(S, m);
      if (S.strategy === "delete") S.cards[k] = null;
      else if (S.strategy === "through") S.cards[k] = { p: p, filled: m, dirty: false };
    }
    if (!S.skipping) S.writes.push({ kind: "write", strategy: S.strategy });
  }

  function flush(api, m) {
    var S = api.state;
    var n = 0;
    for (var k = 1; k <= HOUSES; k++) {
      var c = S.cards[k];
      if (c && c.dirty) { S.db[k] = c.p; c.dirty = false; addDb(S, m); n += 1; }
    }
    if (n) {
      api.log(hhmm(m % DAY) + " Flush: " + changesText(S.queue) + " copied from the sheet to the database" +
        (n !== S.queue ? ", in " + n + (n === 1 ? " write" : " writes") : "") + ".", "");
      if (!S.skipping) S.writes.push({ kind: "flush" });
    }
    S.queue = 0;
  }

  function compute(S) {
    var M = S.n - 1;
    var reads = 0;
    var hits = 0;
    var dbOps = 0;
    for (var i = 0; i < DAY; i++) {
      var mm = S.rMin[i];
      if (mm > M - DAY && mm <= M) { reads += S.rReads[i]; hits += S.rHits[i]; dbOps += S.rDb[i]; }
    }
    var used = 0;
    var staleCards = 0;
    var dbPints = 0;
    for (var k = 1; k <= HOUSES; k++) {
      var c = S.cards[k];
      if (c && alive(S, c, M)) {
        used += 1;
        if (c.p !== S.want[k]) staleCards += 1;
      }
      dbPints += S.db[k];
    }
    return { M: M, reads: reads, hits: hits, hit: reads ? 100 * hits / reads : 0, db: dbOps, used: used, staleCards: staleCards, dbPints: dbPints };
  }

  /* ---------- the readers ---------- */

  function staleText(S, k, v, m) {
    if (v !== S.db[k]) {
      return dateAt(m) + " The sheet says No. " + k + " takes " + pintsText(v) + ". The database says " +
        pintsText(S.db[k]) + ". The float leaves " + pintsText(v) + ".";
    }
    return dateAt(m) + " No. " + k + " asked for " + pintsText(S.want[k]) + ", but that change was lost with the cache node. The database still says " +
      pintsText(S.db[k]) + ", and the float leaves " + pintsText(v) + ".";
  }

  function routeRead(api, k, m) {
    var S = api.state;
    var r = read(S, k, m, true);
    if (k === 1) { S.roundPints = 0; S.roundStale = 0; }
    S.roundPints += r.v;
    var stale = r.v !== S.want[k];
    if (stale) {
      S.stale += 1;
      S.roundStale += 1;
      if (k === NO14) { S.no14Stale += 1; S.no14Pints += r.v; }
      if (!S.logged[k]) { S.logged[k] = true; api.log(staleText(S, k, r.v, m), "bad"); }
    } else if (k === NO14 && !r.hit && r.old && r.old.p !== S.want[k]) {
      api.log(dateAt(m) + " No. 14's card ran out after " + ttlText(S.ttl) + ". The route app asked the database, which says " +
        pintsText(r.v) + ", and the float leaves " + leaveText(r.v) + ". Stale deliveries at No. 14: " + fmt(S.no14Stale) + ".", "ok");
    }
    if (k === HOUSES) S.lastRound = { pints: S.roundPints, stale: S.roundStale };
    if (!S.skipping) S.recent.push({ who: "route", hit: r.hit, stale: stale });
  }

  function appRead(api, k, m) {
    var S = api.state;
    var r = read(S, k, m, true);
    var stale = r.v !== S.want[k];
    if (stale) S.staleApp += 1;
    if (!S.skipping) S.recent.push({ who: "app", hit: r.hit, stale: stale });
  }

  // Graham opens his mother's order at 13:59:58 on 14 March, after the 13:59 note.
  function sonRead(api, m) {
    var S = api.state;
    var head = "13:59:58 Graham opens his mother's order on his phone. ";
    var c = S.cards[NO14];
    if (c && alive(S, c, m)) {
      read(S, NO14, m, true);
      api.log(head + "The sheet answers: " + pintsText(c.p) + ".", "");
      if (!S.skipping) S.recent.push({ who: "app", hit: true, stale: false });
      return;
    }
    var r = read(S, NO14, m, !S.race);
    if (!S.skipping) S.recent.push({ who: "app", hit: false, stale: false });
    if (!S.race) {
      api.log(head + "The sheet has no card for No. 14 right now, so the order service reads the database for him, " + pintsText(r.v) + ", and leaves a copy in the sheet.", "");
      return;
    }
    S.pending = { p: r.v };
    api.log(head + "The sheet has no card for No. 14 right now, so the order service reads the database for him: " + pintsText(r.v) + ". The answer is slow coming back along the line, and waits.", "warn");
  }

  // With the race on, Graham's copy lands two seconds after the cancellation.
  function lateSet(api, m) {
    var S = api.state;
    var p = S.pending.p;
    S.pending = null;
    S.cards[NO14] = { p: p, filled: m, dirty: false };
    api.log("14:00:02 The database's answer for Graham's read finally reaches the order service, which puts its copy, " + pintsText(p) + ", into the sheet, after the " +
      (S.strategy === "delete" ? "delete" : "cancellation") + ". No. 14's card says " + pintsText(p) +
      " again, and no change is coming to delete it. " + (S.ttl === 0 ? "It never expires." : "It lasts " + ttlText(S.ttl) + "."), "bad");
  }

  function logNote(api) {
    var S = api.state;
    var head = "13:59 Wanda adds Graham's phone number to No. 14's account";
    var tail = {
      ttl: ". The office screen writes it to the database only; the sheet is not told.",
      delete: ": a write to the database, then No. 14's card is deleted.",
      through: ": written to the database and the sheet together.",
      back: ". It goes into the sheet; the database gets it at the 14:00 flush."
    };
    api.log(head + tail[S.strategy], "");
  }

  function logCancel(api) {
    var S = api.state;
    var tail = {
      ttl: " The database says cancelled. Nothing tells the sheet.",
      delete: " The database says cancelled, and No. 14's card is deleted.",
      through: " The database and the sheet both say cancelled: two writes.",
      back: " The sheet says cancelled now. The database still says 2 pints until the 15:00 flush."
    };
    api.log("14:00 Wanda cancels No. 14's milk." + tail[S.strategy], S.strategy === "ttl" ? "warn" : "");
  }

  /* ---------- one slot: one minute ---------- */

  function slot(api) {
    var S = api.state;
    var m = S.n;
    var md = m % DAY;
    if (S.strategy === "back" && md % 60 === 0) flush(api, m);
    if (m === NOTE_AT) {
      officeWrite(S, NO14, S.want[NO14], m);
      logNote(api);
      sonRead(api, m);
    }
    if (m === CANCEL_AT) {
      officeWrite(S, NO14, 0, m);
      logCancel(api);
      if (S.pending) lateSet(api, m);
    }
    if (md >= ROUND_START && md < ROUND_START + HOUSES) routeRead(api, md - ROUND_START + 1, m);
    var k = (md % 60) + 1;
    if (k <= HOUSES && k !== NO14) appRead(api, k, m);
    S.n += 1;
    if (S.recent.length > 64) S.recent.shift();
  }

  function catchUp(api) {
    var S = api.state;
    var due = Math.floor(S.t + EPS) + 1;
    var guard = 0;
    while (S.n < due && guard < 400000) {
      if (S.skipping) api.clock = START_CLOCK + S.n * 60;
      slot(api);
      guard += 1;
    }
  }

  /* ---------- the replay ---------- */

  function startDay(api) {
    var S = api.state;
    S.t = 0;
    S.n = 0;
    api.clock = START_CLOCK;
    S.cards = [];
    S.db = [];
    S.want = [];
    for (var k = 0; k <= HOUSES; k++) {
      S.cards.push(null);
      S.db.push(k ? pints(k) : 0);
      S.want.push(k ? pints(k) : 0);
    }
    S.rMin = []; S.rReads = []; S.rHits = []; S.rDb = [];
    for (var i = 0; i < DAY; i++) { S.rMin.push(-1e9); S.rReads.push(0); S.rHits.push(0); S.rDb.push(0); }
    S.queue = 0;
    S.lost = 0;
    S.stale = 0;
    S.staleApp = 0;
    S.changes = 0;
    S.no14Stale = 0;
    S.no14Pints = 0;
    S.logged = {};
    S.roundPints = 0;
    S.roundStale = 0;
    S.lastRound = null;
    S.pending = null;
    S.rot = 0;
    S.recent = [];
    S.writes = [];
    S.dotClock = 0;
    S.skipping = false;
    api.log("14 March, 00:00. Ruairi switches the sheet on, empty. " + STRAT_START[S.strategy] + " " +
      (S.ttl === 0 ? "Cards never expire." : "Each card lasts " + ttlText(S.ttl) + ".") +
      (S.race ? " Slow reader race: on." : ""), "");
    catchUp(api);
    draw(api, compute(S));
  }

  function replay(api, what) {
    api.log(what + " Replaying from 00:00 on 14 March.", "");
    startDay(api);
  }

  /* ---------- controls ---------- */

  function setStrategy(api, v) {
    var o = pick(STRATEGIES, v);
    if (!o) return;
    api.state.strategy = String(o.value);
    replay(api, "Office changes now: " + STRAT_SUB[api.state.strategy] + ".");
  }

  function setTtl(api, v) {
    var o = pick(TTLS, v);
    if (!o) return;
    api.state.ttl = Number(o.value);
    replay(api, api.state.ttl === 0 ? "Cards now never expire." : "Each card now lasts " + ttlText(api.state.ttl) + ".");
  }

  function setRace(api, on) {
    api.state.race = !!on;
    replay(api, on ? "Slow reader race on: the order service's read for Graham will be slow at 13:59." : "Slow reader race off.");
  }

  function officeChange(api) {
    var S = api.state;
    var k = ROT[S.rot % ROT.length];
    S.rot += 1;
    var m = S.n - 1;
    var old = S.want[k];
    var p = old % 3 + 1;
    officeWrite(S, k, p, m);
    var msg = "Wanda takes a phone change: No. " + k + " goes from " + pintsText(old) + " to " + pintsText(p) + ". ";
    if (S.strategy === "ttl") {
      msg += "The database has it. The sheet keeps No. " + k + "'s old card until it expires" + (S.ttl === 0 ? ", which is never." : ".");
    } else if (S.strategy === "delete") {
      msg += "The database has it, and No. " + k + "'s card is deleted.";
    } else if (S.strategy === "through") {
      msg += "The database and the sheet both have it: two writes.";
    } else {
      msg += "The sheet has it now; the database gets it at the next flush, " + hhmm(((Math.floor(m / 60) + 1) * 60) % DAY) + ".";
    }
    api.log(msg, S.strategy === "ttl" ? "warn" : "");
    draw(api, compute(S));
  }

  function nodeDies(api) {
    var S = api.state;
    var m = S.n - 1;
    var lost = S.strategy === "back" ? S.queue : 0;
    var c14 = S.cards[NO14];
    var had14 = !!(c14 && alive(S, c14, m) && c14.p !== S.want[NO14]);
    for (var k = 1; k <= HOUSES; k++) S.cards[k] = null;
    S.lost += lost;
    S.queue = 0;
    S.pending = null;
    var msg = "The cache node dies and comes back empty. ";
    if (S.strategy === "back") {
      msg += lost
        ? changesText(lost) + " since the last flush " + (lost === 1 ? "was" : "were") + " only in the sheet: lost. The database never got " +
          (lost === 1 ? "it, so that house gets its old order" : "them, so those houses get their old orders") + " from now on."
        : "Nothing was waiting for the flush, so nothing is lost.";
    } else {
      msg += "Nothing is lost: every change was already in the database.";
    }
    msg += " Every card has to be fetched again.";
    if (had14) {
      msg += S.ttl === 0
        ? " No. 14's stale card went with it: with cards that never expire, a restart is the only thing that clears it."
        : " No. 14's stale card went with it.";
    }
    api.log(msg, lost ? "bad" : "warn");
    draw(api, compute(S));
  }

  function skipTo(api, target) {
    var S = api.state;
    S.skipping = true;
    S.t = target;
    catchUp(api);
    S.skipping = false;
    api.clock = START_CLOCK + target * 60;
    S.recent = [];
    S.writes = [];
  }

  function skipDay(api) {
    var S = api.state;
    skipTo(api, S.t + DAY);
    var now = Math.floor(S.t + EPS);
    api.log("Skipped 24 hours to " + dateText(Math.floor(now / DAY)) + ", " + hhmm(now % DAY) + ".", "");
    draw(api, compute(S));
  }

  function skipOct(api) {
    var S = api.state;
    if (S.t >= OCT7 - EPS) return;
    skipTo(api, OCT7);
    api.log("Skipped to 7 October, 05:30. Since 14 March: " + fmt(S.stale) + (S.stale === 1 ? " stale delivery" : " stale deliveries") +
      (S.no14Stale ? ", " + fmt(S.no14Stale) + " of them at No. 14, " + fmt(S.no14Pints) + " pints nobody ordered" : "") + ".",
      S.stale ? "bad" : "ok");
    draw(api, compute(S));
  }

  /* ---------- drawing ---------- */

  function officeMeta(S) {
    var c = S.changes;
    var head = fmt(c) + (c === 1 ? " change: " : " changes: ");
    if (S.strategy === "ttl") return head + "database only";
    if (S.strategy === "delete") return head + fmt(c) + (c === 1 ? " delete" : " deletes");
    if (S.strategy === "through") return head + fmt(2 * c) + " writes";
    return head + "sheet first";
  }

  function draw(api, r) {
    var S = api.state;
    var md = ((r.M % DAY) + DAY) % DAY;
    var day = Math.floor(Math.max(r.M, 0) / DAY);

    var ph = api.node("phones");
    ph.text("meta", fmt(S.staleApp) + (S.staleApp === 1 ? " old order shown" : " old orders shown"));
    ph.set(S.staleApp ? "warn" : "");

    var ro = api.node("route");
    ro.text("sub", "Round 6, " + dateText(day));
    if (md >= ROUND_START && md < ROUND_START + HOUSES) {
      ro.text("meta", "at No. " + (md - ROUND_START + 1));
    } else {
      ro.text("meta", S.lastRound ? S.lastRound.pints + " pints left, " + S.lastRound.stale + " stale" : "round at 04:30");
    }
    ro.set(S.lastRound ? (S.lastRound.stale ? "bad" : "ok") : "");

    api.node("office").text("meta", officeMeta(S));

    var sv = api.node("service");
    sv.text("sub", STRAT_SUB[S.strategy]);
    sv.text("meta", STRAT_META[S.strategy]);

    var sh = api.node("sheet");
    sh.text("sub", fmt(r.used) + (r.used === 1 ? " card, TTL " : " cards, TTL ") + ttlText(S.ttl));
    if (S.queue) {
      sh.text("meta", S.queue + " waiting for the flush");
    } else if (r.staleCards) {
      sh.text("meta", r.staleCards + (r.staleCards === 1 ? " stale card" : " stale cards"));
    } else {
      sh.text("meta", r.used ? "every card current" : "empty");
    }
    sh.set(r.staleCards ? "warn" : (S.queue ? "accent" : (r.used ? "ok" : "muted")));

    var db = api.node("db");
    db.text("meta", r.dbPints + " pints ordered");
    db.set("ok");

    S.stat.stale(fmt(S.stale));
    S.stat.lost(fmt(S.lost));
    S.stat.db(fmt(r.db));
    S.stat.hit(pctText(r.hit));

    S.ctl.oct.disable(S.t >= OCT7 - EPS);
  }

  /* ---------- dots: a visual sample, never counted ---------- */

  function dots(api, dt) {
    var S = api.state;
    if (api.reducedMotion) { S.recent = []; S.writes = []; return; }
    S.dotClock += dt;
    if (S.dotClock >= DOT_EVERY && S.recent.length) {
      S.dotClock = 0;
      var it = S.recent[Math.floor(api.rand() * S.recent.length)];
      S.recent = [];
      var from = it.who === "route" ? "route" : "phones";
      var bad = it.stale;
      if (it.hit) {
        api.dot({ path: [from, "service", "sheet"], cls: "dot-req", r: 4, speed: DOT_SPEED,
          onArrive: function (dot, wp) { if (dot && wp === "sheet") dot.cls(bad ? "dot-bad" : "dot-ok"); } });
      } else {
        api.dot({ path: [from, "service", "sheet", "service", "db"], cls: "dot-req", r: 4, speed: DOT_SPEED,
          onArrive: function (dot, wp) {
            if (!dot) return;
            if (wp === "sheet") dot.cls("dot-wait");
            if (wp === "db") dot.cls(bad ? "dot-bad" : "dot-ok");
          } });
      }
    }
    var guard = 0;
    while (S.writes.length && guard < 8) {
      guard += 1;
      var w = S.writes.shift();
      if (w.kind === "flush") {
        api.dot({ path: ["sheet", "db"], cls: "dot-accent", r: 4, speed: DOT_SPEED });
      } else if (w.strategy === "back") {
        api.dot({ path: ["office", "service", "sheet"], cls: "dot-accent", r: 4, speed: DOT_SPEED });
      } else {
        api.dot({ path: ["office", "service", "db"], cls: "dot-accent", r: 4, speed: DOT_SPEED });
        if (w.strategy === "delete") api.dot({ path: ["office", "service", "sheet"], cls: "dot-fail", r: 4, speed: DOT_SPEED });
        if (w.strategy === "through") api.dot({ path: ["office", "service", "sheet"], cls: "dot-accent", r: 4, speed: DOT_SPEED });
      }
    }
    S.writes = [];
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.cards) return;
    S.t += dt * api.speed / 60;
    catchUp(api);
    draw(api, compute(S));
    dots(api, dt);
  }

  /* ---------- "what is this box" ---------- */

  var OFFICE_INFO = {
    ttl: "As now, each change goes to the database and nothing else, so the sheet only learns of it when that house's card expires.",
    delete: "Each change updates the database, then deletes that house's card, so the next read fetches the new order.",
    through: "Each change is written to the database and to the sheet together: two writes, and the card is current at once.",
    back: "Each change goes into the sheet at once and waits there for the hourly flush to the database. Until then the sheet holds the only copy."
  };

  var INFO = {
    phones: function (S) {
      return "<strong>Houses' phones.</strong> Thirty-nine of the forty houses on Round 6 have the dairy's app, which checks tomorrow's order once an hour: No. 1 on the hour, No. 2 a minute past, and so on up to No. 40 at 39 minutes past. No. 14 has no app; Mrs Farrow always phoned the office. So far " +
        fmt(S.staleApp) + " checks have shown a house an order it had since changed.";
    },
    route: function (S) {
      return "<strong>Route app.</strong> The float's handheld. From 04:30 it asks the order service for one house a minute, No. 1 to No. 40, and the driver leaves what it says. If that isn't the house's latest order, it's a stale delivery. No. 14 is read at 04:43." +
        (S.lastRound ? " Last round: " + S.lastRound.pints + " pints left, " + S.lastRound.stale + " stale." : "");
    },
    office: function (S) {
      return "<strong>Depot office.</strong> Wanda types phone changes into the office screen. At 13:59 on 14 March she added Graham's phone number to No. 14's account, and at 14:00 she cancelled the milk. The button sends one more phone change, to the next house in turn. " +
        OFFICE_INFO[S.strategy];
    },
    service: function (S) {
      return "<strong>Order service.</strong> Every read, from the apps, the website or the route app, does cache-aside: the sheet first, and on a miss the database, leaving a copy in the sheet. Office changes: " +
        STRAT_META[S.strategy].replace("writes: ", "") + ".";
    },
    sheet: function (S, r) {
      return "<strong>The sheet.</strong> A cache of every house's order, one card per house, kept in memory. Cards last " +
        (S.ttl === 0 ? "forever" : ttlText(S.ttl)) +
        ". Nothing on the read path checks whether a card is still right: only a delete, a write from the office, an expiry or a restart changes it." +
        (r.staleCards ? " Right now " + r.staleCards + (r.staleCards === 1 ? " card is" : " cards are") + " out of date." : "") +
        (S.queue ? " " + changesText(S.queue) + (S.queue === 1 ? " is" : " are") + " waiting for the flush, and exist nowhere else." : "");
    },
    db: function (S, r) {
      return "<strong>Order database.</strong> The source of truth, on a small server in the depot office at the end of a slow line. Billing reads it. Right now it orders " +
        r.dbPints + " pints a morning for Round 6." + (S.strategy === "back" ? " Under write-back it only hears about a change at the flush." : "");
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s2e05", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.strategy = "ttl";
      S.ttl = 0;
      S.race = false;
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.strategy = api.control.select("strategy", "When the office changes an order", STRATEGIES, "ttl", function (v) { setStrategy(api, v); });
      S.ctl.ttl = api.control.select("ttl", "Cards last (TTL)", TTLS, 0, function (v) { setTtl(api, v); });
      S.ctl.race = api.control.toggle("race", "Slow reader race (Graham's read, 13:59)", false, function (on) { setRace(api, on); });
      S.ctl.pause = api.control.toggle("pause", "Pause the clock", false, function (on) { api.speed = on ? 0 : SPEED; });
      S.ctl.change = api.control.button("change", "The office changes an order", function () { officeChange(api); });
      S.ctl.die = api.control.button("die", "Cache node dies", function () { nodeDies(api); }, { tone: "danger" });
      S.ctl.day = api.control.button("day", "Skip ahead 24 hours", function () { skipDay(api); });
      S.ctl.oct = api.control.button("oct", "Skip to 7 October, 05:30", function () { skipOct(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        stale: api.stat("stale", "stale deliveries since 14 March", "bad"),
        lost: api.stat("lost", "writes lost", "bad"),
        db: api.stat("db", "database load, last 24 h (reads + writes)", ""),
        hit: api.stat("hit", "hit ratio %, last 24 h", "ok")
      };

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state, compute(api.state)));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startDay(api);
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      var a;
      var b;
      var i;

      // 1. As now: TTL only, cards that never expire.
      t.click("day");
      await t.run(6);
      t.expect(n("stale") === 1 && n("hit") === 100 && n("db") === 2 &&
        t.node("route").text.meta === "79 pints left, 1 stale" && t.node("db").text.meta === "77 pints ordered" &&
        t.node("sheet").text.meta === "1 stale card",
        "As now: on 15 March the sheet still says 2 pints for No. 14, so 79 pints go out while the database orders 77");
      t.expect(t.logText().indexOf("15 March 04:43 The sheet says No. 14 takes 2 pints. The database says cancelled. The float leaves 2 pints.") >= 0,
        "As now: at 04:43 on 15 March the float leaves 2 pints at No. 14");
      t.click("oct");
      t.expect(n("stale") === 207 &&
        t.logText().indexOf("Since 14 March: 207 stale deliveries, 207 of them at No. 14, 414 pints nobody ordered.") >= 0,
        "As now: by 7 October, 207 stale deliveries at No. 14, 414 pints");

      // 2. TTL only with 7 days: stale until the card runs out.
      t.set("ttl", 10080);
      for (i = 0; i < 5; i++) t.click("day");
      await t.run(6);
      a = n("stale");
      t.click("day");
      b = n("stale");
      t.click("day");
      t.expect(a === 5 && b === 6 && n("stale") === 6 && t.logText().indexOf("No. 14's card ran out after 7 days") >= 0,
        "TTL only, 7 days: No. 14 gets 2 pints on 15 to 20 March, then its card runs out at 04:43 on 21 March");

      // 3. Delete on write.
      t.set("ttl", 0);
      t.set("strategy", "delete");
      t.click("day");
      await t.run(6);
      t.expect(n("stale") === 0 && n("db") === 4 && n("hit") === 99.8 &&
        t.node("route").text.meta === "77 pints left, 0 stale" && t.node("office").text.meta === "2 changes: 2 deletes",
        "Delete on write: No. 14's card goes at 14:00, so 15 March's read misses, fetches cancelled, and nothing is stale");

      // 4. Delete on write with the slow reader race.
      t.set("race", true);
      t.click("day");
      await t.run(6);
      t.expect(n("stale") === 1 && n("db") === 3 && t.node("sheet").text.meta === "1 stale card" &&
        t.logText().indexOf("14:00:02 The database's answer for Graham's read finally reaches the order service") >= 0,
        "Race: Graham's slow copy lands after the delete, and the float leaves 2 pints on 15 March");
      t.click("oct");
      t.expect(n("stale") === 207, "Race with cards that never expire: 207 stale deliveries by 7 October, as if nothing had changed");

      // 5. The TTL bounds the race, and its cost depends on how often cards are read.
      t.set("ttl", 1440);
      t.click("oct");
      a = n("stale");
      t.set("ttl", 360);
      t.click("oct");
      t.expect(a === 1 && n("stale") === 0 && n("hit") === 83.9 && n("db") === 157,
        "Race with a TTL: 1 stale delivery with 1 day, none with 6 hours, at 83.9% hits and 157 database reads a day");
      t.set("ttl", 60);
      t.click("oct");
      t.expect(n("stale") === 0 && n("hit") === 4 && n("db") === 937,
        "1-hour TTL: every hourly check finds its card expired: 4% hits and 937 database reads a day");

      // 6. Write-through.
      t.set("ttl", 0);
      t.set("strategy", "through");
      t.click("day");
      await t.run(6);
      t.expect(n("stale") === 0 && n("db") === 2 && n("hit") === 100 && t.node("office").text.meta === "2 changes: 4 writes",
        "Write-through: the sheet is current at once, for two writes per change, and Graham's read hits the new card");

      // 7. Write-back, and a cache node that dies before the flush.
      t.click("reset");
      t.set("strategy", "back");
      await t.run(16.1);
      for (i = 0; i < 5; i++) t.click("change");
      a = t.node("sheet").text.meta;
      t.click("die");
      t.expect(a === "5 waiting for the flush" && n("lost") === 5 &&
        t.logText().indexOf("5 changes since the last flush were only in the sheet: lost.") >= 0,
        "Write-back: five changes after the 16:00 flush die with the cache node before 17:00");
      t.click("day");
      t.expect(n("stale") === 5 && n("lost") === 5, "Write-back: the next morning five houses get their old orders");

      // 8. Under TTL only, a restart is the only thing that clears No. 14's card.
      t.click("reset");
      t.click("day");
      await t.run(6);
      t.click("die");
      t.click("day");
      t.expect(n("stale") === 1 && n("lost") === 0 && t.logText().indexOf("a restart is the only thing that clears it") >= 0,
        "TTL only: the node's restart empties the sheet, and 16 March's read fetches cancelled");
    }
  });
})();
