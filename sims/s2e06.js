/* sims/s2e06-v1.0.1.js  (published as sims/s2e06.js)
   Case s2e06 "The Stampede at 6 AM": a cache stampede at Brackwater's, a department store whose
   tills, price boards and price checkers ask a price service for the 50 sale prices. The price
   service does cache-aside in front of a slow stockroom database. The learner opens the doors at
   6:00 all at once or one at a time (Rule 7), starts with a cold or a warmed cache, picks a TTL
   with or without jitter, and turns coalescing and serve-stale on or off.

   CHANGELOG
   v1.0.1 (2026-10-10) Season 2 review fixes: the summary line says "1 board was" and "1 rebuild"
     when the count is 1 (it said "1 boards were" and "1 rebuilds" on the senior path), and the
     selfTest's busiest() and darkest() patterns accept the singular; the doors label says "One door
     every 10 s (the brass plate)" instead of "(Rule 7)", because nothing ties the plate to Rule 7
     before the explanation. Points at case v1.0.1.
   v1.0.0 (2026-10-07) first version: the sale morning from 05:59:57. Each open door brings 100
     lookups a second, spread evenly over 50 prices. The stockroom works on 50 rebuilds at once at
     full speed, half a second each (100 a second), and past 50 shares its time between all of
     them. A till waits 2 s; a rebuild that comes back later is thrown away and never fills the
     cache. Controls: doors (all six at once, or one every 10 s), cache at 6:00 (cold, or warmed at
     05:50 by Lucan's script), TTL (10 min, 10 min + 0 to 2 min of jitter, 24 h), coalescing,
     serve stale while one refreshes (up to 1 min), skip to 06:09:55, a deploy that restarts the
     price cache, ring the bell again, reset. Stats: boards lit, stockroom asked in the last
     second, rebuilds per price, tills that gave up in the last second, seconds until the boards
     lit. selfTest: 21 assertions.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e06-v1.0.1.json):
   - post: 6 doors; each open door's crowd brings 100 lookups a second, all six 600; 50 sale
     prices in a cache, 10 minutes each; a miss asks the stockroom to rebuild the price; the
     stockroom works on 50 rebuilds at once, half a second each, 100 a second, and past that shares
     its time so every rebuild slows; a till waits 2 s, then gives up. Monday (cold cache, all six
     doors): 06:00:01 boards lit 0 of 50, stockroom asked 600 a second; 06:00:02 tills give up;
     06:00:10 6,000 rebuilds in progress, 0 done. The doorman's one door at a time: every board lit
     in under a second (0.9 s here). Tuesday (warm-up at 5:50, all 50 prices in at 05:50:00.5 for
     exactly 10 minutes): lit at the bell, all dark half a second later (06:00:00.5).
   - comments: 120 rebuilds per price in ten seconds (6,000 / 50, u/grey_pager's question and OP's
     reply); serve stale up to a minute past the TTL (u/stale_shelf_wanjiru); a random extra on
     each TTL, a couple of minutes at most (u/cold_open_aurelio).
   - reply options: index 0 (24 h TTL): lit all morning, then a deploy at 11:40 empties the cache
     with the store full: 600 lookups a second, 6,000 rebuilds in progress 10 s later, none done.
     Index 1 (warm-up with 0 to 2 min of jitter, coalescing, one door every 10 s): prices run out
     one or two at a time between 06:00:00.5 and 06:02:00.5, 50 rebuilds, never more than 2 at
     once, each back in under a second; the 11:40 deploy costs 50 rebuilds and half a second.
     Index 2 (doors only, warm-up kept): rebuilt one each by 06:00:01.4; at 06:10:01.0 to
     06:10:01.4 every price runs out again with the store full and nothing comes back; tills give
     up 2 s later. Index 3 (coalescing only): 50 rebuilds at 06:00:00.5, lit at 06:00:01.0, dark
     for half a second at 06:10:01.0 and 06:20:01.5.

   Teaching model (stated in sim.lede):
   - Time runs in slots of 0.1 s. Slot 0 is 05:59:57, slot 30 is 06:00:00 (the bell). Each frame
     processes every slot that is due (floor(t x 10)), so results never depend on the frame rate.
   - Each open door adds 10 lookups a slot. Lookups go to the 50 prices in turn (a pointer that
     wraps), so with all six doors open every price gets 1 or 2 lookups a slot, 12 a second, and
     exactly 6 in any 5 slots in a row (300 lookups = 6 rounds of 50).
   - A lookup at slot n is a hit if its price is fresh (n < expires). With serve stale on, a price
     up to 600 slots past its expiry is handed out at once, and if no rebuild of it is in flight,
     one is started. Otherwise it's a miss: without coalescing every miss starts its own rebuild;
     with coalescing the first miss starts one and later misses wait for it.
   - The stockroom (processor sharing): all rebuilds started in one slot form a cohort. Each slot,
     with N in progress, each one gets min(1, 50 / N) of a slot's full-speed work; a rebuild needs
     5 slots of full-speed work. A global work clock W grows by min(1, 50 / N) each slot, and a
     cohort is done when W - W(at its start) >= 5. Cohorts finish in the order they started.
   - Give-up: the price service waits 20 slots (2 s). A cohort done within 20 slots of its start
     (done at the end of slot start + 19 at the latest) writes its prices into the cache, each with
     the TTL, and answers its waiting lookups. Otherwise, at the end of slot start + 19 its lookups
     give up (counted as errors); the stockroom keeps working on it, and when it finishes the
     answer is thrown away. Completions are processed before give-ups in the same slot.
   - Jitter: price k's TTL is 10 minutes plus floor((k + r) x 24) slots, r from api.rand(), so
     price k's extra lies in [2.4k s, 2.4k + 2.3 s], 0 to 2 minutes in all. The sim spreads the
     extras evenly on purpose so the bound below is provable; real jitter is plain random.
   - The warm-up put every price in at 05:50:00.5 (slot 35 - 6000), so with 10 minutes they expire
     at slot 35, 06:00:00.5. Its jitter draws are made once in setup and kept on replays.

   Derivations for the self-tests (all arithmetic, with the model above):
   - Cold, all six doors, no coalescing: from slot 30 every lookup misses, 60 rebuilds a slot. No
     cohort finishes until the first one does, so after slot 30 + k there are 60(k + 1) in
     progress and W = (5/6)(1 + 1/2 + ... + 1/(k + 1)). The first cohort needs that sum to reach 6,
     which first happens at k + 1 = 227 (slot 256, 06:00:22.6), long past its 2 s. In its first 20
     slots it gets (5/6) x H(20) = 3.0 < 5, and every later cohort gets less, so no rebuild ever
     finishes in time and the cache never fills: the boards stay dark while the crowd is inside.
     Numbers: asked in the last second 600; rebuilds per price 1.2 per slot (12 at slot 39, 120 at
     slot 129); first give-up at the end of slot 49 (06:00:02.0) with 20 x 60 = 1,200 in progress;
     at the end of slot 129 (06:00:10.0) 100 x 60 = 6,000 in progress and 600 give-ups in the last
     second (cohorts 101 to 110, 60 each).
   - Coalescing, cold, all six: slot 30 starts 50 rebuilds (one per price), 50 in progress = full
     speed, W reaches 5 at the end of slot 34, every price in at slot 35 (06:00:00.5): boards lit
     after 0.5 s, 50 asked, 1 per price, 0 give-ups.
   - One door at a time, cold: 10 lookups a slot, 10 new prices a slot in slots 30 to 34, 50 rebuilds
     with at most 50 in progress, all at full speed. Prices 1-10 are in at slot 35 and hit at slot
     35; prices 41-50 are in at slot 39 (06:00:00.9): lit after 0.9 s, 50 asked, 1 per price.
     Door 2 opens at slot 130 (06:00:10) onto a warm cache: nothing asked.
   - Warm-up, 10 minutes, all six: lit at the bell; every price expires at slot 35, and from there it
     is the cold case shifted by 5 slots (the pointer is back at price 1 after 300 lookups):
     asked 600 and 12 per price at slot 44; 6,000 in progress and 600 give-ups at slot 134. With
     coalescing: 50 rebuilds at slot 35, lit at slot 40, after 0.5 s. With serve stale: the old
     prices answer, one refresh per price (50), no board dark.
   - Warm-up with jitter, all six, no coalescing: price k expires at e = 35 + floor((k + r) x 24),
     inside [35 + 24k, 35 + 24k + 23]. Its lookups in slots e to e + 4 all miss: exactly 6
     rebuilds (any 5 slots hold 6 rounds), the first done at the end of slot e + 4. Each price's
     rebuilds are in progress only in slots e to e + 8, and price k + 2 starts at least 25 slots
     after price k's last possible start, so at most 2 prices overlap: at most 12 in progress and
     at most 2 boards dark, always full speed. 300 rebuilds, 6 per price, 0 give-ups, all done by
     slot 1243 (the last price expires by slot 1234).
   - The senior setup (warm-up with jitter, coalescing, one door at a time): one rebuild per price,
     started within 4 slots of its expiry (each price is looked up at least every 5 slots), so at
     most 2 in progress and 2 dark at once; 50 rebuilds, 0 give-ups; all six doors open from slot
     530 (06:00:50).
   - Deploy (restart the price cache) with coalescing at slot 60: 50 rebuilds at slot 60, lit at
     slot 65, 0.5 s. With a 24 h warm-up and no coalescing, a restart at slot 40 is the cold case:
     600 asked, 12 per price at slot 49, nothing lit.
   - One door at a time with the warm-up, skip to 06:09:55 (slot 5980): the warmed prices expired at
     slot 35 and were rebuilt at slots 40 to 44 (10 a slot), so they expire at slots 6040 to 6044
     (06:10:01.0 to 06:10:01.4). Lookups before slot 6040: 1,000 + 2,000 + 3,000 + 4,000 + 5,000
     during the waves and 60 x 5,510 after, 345,600, a multiple of 50, so the pointer is at price 1.
     Rebuilds started: 20, 30, 40, 50 and 60 in slots 6040 to 6044, then 60 a slot. The first
     cohort's 20 slots of work: 1 + 1 + 50/90 + 50/140 + 50/200 + 50/260 + ... + 50/1100 = 4.49,
     under 5, and later cohorts get less: nothing comes back. At the end of slot 6069: lit 0,
     asked 600, and 540 give-ups in the last second (cohorts 6041 to 6050: 30 + 40 + 50 + 7 x 60).

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px,
   edge label 11px):
   - The doors (260 wide, 62 high): sub "6 of 6 open" 11 chars, 80px; meta "600 lookups/s" 13 chars,
     86px.
   - Warm-up script (240 wide): longest sub "off: cold after the refit" 25 chars, 180px.
   - Price service (300 wide): longest meta "one rebuild per price, stale ok" 31 chars, 205px.
   - Price cache (260 wide): sub "50 of 50 prices" 15 chars, 108px; longest meta
     "10 min + 0 to 2 min" 19 chars, 125px.
   - Stockroom database (260 wide, db shape): label 18 chars, 140px; sub "50 at once, 0.5 s each" 22
     chars, 158px; meta "106,800 in progress" 19 chars, 125px.
   - Vertical gaps: doors bottom y 75 and warm-up bottom y 70, price service top y 129 (54px);
     price service bottom y 191, cache and database top y 264 (73px).
   - Edge labels: "lookups" near (280, 94), 46px wide, between the doors (bottom y 75) and the price
     service (top y 129); "1. cache first" near (270, 222) and "2. on a miss" near (470, 222),
     92px and 79px wide, between the price service (bottom y 191) and the cache and database (top
     y 264).

   Catalog note: the case's concepts are the catalog's ids for s2e06 (thundering-herd,
   cache-stampede, request-coalescing, warm-up).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 2;                              // sim seconds per real second
  var START_CLOCK = 5 * 3600 + 59 * 60 + 57;  // 05:59:57
  var SLOTS = 10;                             // slots a second: one slot is 0.1 s
  var BELL = 30;                              // slot 30 is 06:00:00
  var PRICES = 50;                            // sale prices on the boards
  var DOORS = 6;
  var PER_DOOR = 10;                          // lookups a slot per open door: 100 a second
  var WAVE_GAP = 100;                         // one more door every 10 s
  var CLERKS = 50;                            // rebuilds the stockroom works on at full speed
  var WORK = 5;                               // a rebuild is 5 slots of full speed: 0.5 s
  var LIMIT = 100;                            // rebuilds a second at full speed
  var GIVE_UP = 20;                           // a till waits 2 s
  var TTL = 6000;                             // 10 minutes
  var STRATUM = 24;                           // jitter: price k's extra is in [24k, 24k + 23] slots
  var DAY = 864000;                           // 24 hours
  var STALE = 600;                            // serve stale up to 60 s past the TTL
  var WARM_FILL = BELL + 5 - TTL;             // the warm-up's prices went in at 05:50:00.5
  var SKIP_TO = BELL + 5950;                  // 06:09:55
  var EPS = 1e-6;
  var WEPS = 1e-9;
  var DOT_EVERY = 0.22;                       // real seconds between sample dots
  var DOT_SPEED = 300;                        // viewBox units per real second

  var DOOR_OPTS = [
    { value: "all", label: "All six at once" },
    { value: "waves", label: "One door every 10 s (the brass plate)" }
  ];
  var CACHE_OPTS = [
    { value: "cold", label: "Cold: empty after the refit" },
    { value: "warm", label: "Warmed at 5:50 by Lucan's script" }
  ];
  var TTL_OPTS = [
    { value: "fixed", label: "10 minutes (Lucan's)" },
    { value: "jitter", label: "10 min + random 0 to 2 min (jitter)" },
    { value: "day", label: "24 hours" }
  ];

  /* ---------- small helpers ---------- */

  // 6000 -> "6,000". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  // 12 -> "12", 20.4 -> "20.4", 0 -> "0".
  function rateText(v) {
    if (!(v >= 0.05)) return "0";
    var r = Math.round(v * 10) / 10;
    return r === Math.round(r) ? String(Math.round(r)) : String(r);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Slot n as a clock time with tenths: slot 35 -> "06:00:00.5".
  function slotClock(n) {
    var tenths = START_CLOCK * SLOTS + n;
    var s = Math.floor(tenths / SLOTS);
    var d = tenths - s * SLOTS;
    s = s % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60) + "." + d;
  }

  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function sumRing(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function say(api, msg, tone) { if (!api.state.quiet) api.log(msg, tone || ""); }

  function ttlLabel(S) {
    if (S.ttl === "jitter") return "10 min + 0 to 2 min";
    if (S.ttl === "day") return "24 h each";
    return "10 min each";
  }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 380,
    aria: "Cache stampede sim for Brackwater's department store. The doors let in the crowd, whose tills, boards and price checkers send lookups to the price service: 100 a second per open door, 600 with all six. The warm-up script can fill the cache at 5:50. The price service looks in the price cache first, and on a miss asks the stockroom database to rebuild the price. The stockroom works on 50 rebuilds at once at full speed, half a second each.",
    nodes: [
      { id: "doors", label: "The doors", sub: "closed", meta: "0 lookups/s", x: 190, y: 44, w: 260, h: 62, shape: "box", tone: "" },
      { id: "warm", label: "Warm-up script", sub: "off: cold after the refit", x: 560, y: 44, w: 240, h: 52, shape: "box", tone: "muted" },
      { id: "svc", label: "Price service", sub: "cache-aside", meta: "every miss asks the stockroom", x: 370, y: 160, w: 300, h: 62, shape: "box", tone: "" },
      { id: "cache", label: "Price cache", sub: "0 of 50 prices", meta: "10 min each", x: 170, y: 300, w: 260, h: 72, shape: "box", tone: "" },
      { id: "db", label: "Stockroom database", sub: "50 at once, 0.5 s each", meta: "0 in progress", x: 570, y: 300, w: 260, h: 72, shape: "db", tone: "ok" }
    ],
    edges: [
      { from: "doors", to: "svc", label: "lookups" },
      { from: "warm", to: "svc", dash: true, tone: "muted" },
      { from: "svc", to: "cache", label: "1. cache first" },
      { from: "svc", to: "db", label: "2. on a miss" }
    ]
  };

  /* ---------- the morning's rules ---------- */

  function doorsOpen(S, n) {
    if (n < BELL) return 0;
    if (S.doors === "all") return DOORS;
    return Math.min(DOORS, 1 + Math.floor((n - BELL) / WAVE_GAP));
  }

  function ttlFor(api, k) {
    var S = api.state;
    if (S.ttl === "day") return DAY;
    if (S.ttl === "jitter") return TTL + Math.floor((k + api.rand()) * STRATUM);
    return TTL;
  }

  function warmExpiry(S, k) {
    if (S.ttl === "day") return WARM_FILL + DAY;
    if (S.ttl === "jitter") return WARM_FILL + TTL + Math.floor((k + S.warmJit[k]) * STRATUM);
    return WARM_FILL + TTL;
  }

  function servable(S, e, t) {
    return !!e && (t < e.expires || (S.stale && t < e.expires + STALE));
  }

  function litAt(S, t) {
    var c = 0;
    for (var k = 0; k < PRICES; k++) if (servable(S, S.cache[k], t)) c++;
    return c;
  }

  function resetCounts(S, since) {
    S.since = since;
    S.qTotal = 0;
    S.qKeys = {};
    S.keysQueried = 0;
    S.errTotal = 0;
    S.peakProg = S.inProg;
    S.peakDark = 0;
    S.summarized = false;
    S.giveUpLogged = false;
    S.tenLogged = false;
    S.overLogged = false;
    S.staleLogged = false;
  }

  /* ---------- the stockroom's work list ---------- */

  function newCohort(S, n) {
    var c = { start: n, startW: S.W, count: 0, waiters: 0, keys: [], live: true, done: false };
    S.work.push(c);
    S.live.push(c);
    return c;
  }

  // Each price is handled once per slot, so a cohort never gets the same price twice.
  function addQuery(S, c, k, q, w) {
    c.keys.push(k);
    c.count += q;
    c.waiters += w;
    S.inProg += q;
    S.qTotal += q;
    if (!S.qKeys[k]) { S.qKeys[k] = true; S.keysQueried += 1; }
  }

  function workFront(S) { return S.workHead < S.work.length ? S.work[S.workHead] : null; }

  function popWork(S) {
    var w = S.work[S.workHead];
    S.work[S.workHead] = null;
    S.workHead += 1;
    if (S.workHead > 2048 && S.workHead * 2 > S.work.length) {
      S.work = S.work.slice(S.workHead);
      S.workHead = 0;
    }
    return w;
  }

  /* ---------- one slot: the lookups, the stockroom's work, the give-ups ---------- */

  function slot(api) {
    var S = api.state;
    var n = S.n;
    if (n === BELL) ringBell(api);
    var open = doorsOpen(S, n);
    if (S.doors === "waves" && n > BELL && (n - BELL) % WAVE_GAP === 0 && (n - BELL) / WAVE_GAP < DOORS) {
      say(api, "Door " + open + " opens: " + (open * PER_DOOR * SLOTS) + " lookups a second now.", "");
    }

    var m = open * PER_DOOR;
    var asked = 0, hits = 0, stale = 0, miss = 0, gaveUp = 0;
    var cohort = null;
    var cnt = S.cnt;
    for (var i = 0; i < m; i++) cnt[(S.ptr + i) % PRICES] += 1;
    S.ptr = (S.ptr + m) % PRICES;

    for (var k = 0; k < PRICES; k++) {
      var c = cnt[k];
      if (!c) continue;
      cnt[k] = 0;
      var e = S.cache[k];
      if (e && n < e.expires) { hits += c; continue; }
      if (S.stale && e && n < e.expires + STALE) {
        stale += c;
        if (!S.inflight[k]) {
          if (!cohort) cohort = newCohort(S, n);
          addQuery(S, cohort, k, 1, 0);
          S.inflight[k] = cohort;
          asked += 1;
        }
        continue;
      }
      miss += c;
      if (S.coal) {
        if (S.inflight[k]) { S.inflight[k].waiters += c; continue; }
        if (!cohort) cohort = newCohort(S, n);
        addQuery(S, cohort, k, 1, c);
        S.inflight[k] = cohort;
        asked += 1;
      } else {
        if (!cohort) cohort = newCohort(S, n);
        addQuery(S, cohort, k, c, c);
        asked += c;
      }
    }
    if (S.inProg > S.peakProg) S.peakProg = S.inProg;

    // The stockroom works for one slot. Past 50 in progress it shares its time.
    if (S.inProg > 0) S.W += Math.min(1, CLERKS / S.inProg);

    // Rebuilds that finish. In time: the price goes into the cache. Too late: thrown away.
    var filled = 0;
    var w = workFront(S);
    while (w && S.W - w.startW >= WORK - WEPS) {
      popWork(S);
      S.inProg -= w.count;
      w.done = true;
      if (w.live) {
        w.live = false;
        for (var j = 0; j < w.keys.length; j++) {
          var key = w.keys[j];
          S.cache[key] = { expires: n + 1 + ttlFor(api, key) };
          if (S.inflight[key] === w) S.inflight[key] = null;
        }
        filled += w.keys.length;
      } else {
        S.wasted += w.count;
      }
      w = workFront(S);
    }
    S.fillsSinceDark += filled;

    // Tills that have waited 2 s give up. The stockroom keeps working on their rebuilds.
    while (S.live.length) {
      var lv = S.live[0];
      if (lv.done) { S.live.shift(); continue; }
      if (n + 1 - lv.start < GIVE_UP) break;
      S.live.shift();
      lv.live = false;
      gaveUp += lv.waiters;
      for (var q = 0; q < lv.keys.length; q++) if (S.inflight[lv.keys[q]] === lv) S.inflight[lv.keys[q]] = null;
      lv.keys = [];
    }
    S.errTotal += gaveUp;

    S.rAsked[S.rPos] = asked;
    S.rErr[S.rPos] = gaveUp;
    S.rPos = (S.rPos + 1) % SLOTS;
    S.lastMix = { hit: hits, stale: stale, miss: miss };

    // Which boards are lit for the next slot's lookups.
    var expiring = 0;
    for (var x = 0; x < PRICES; x++) if (S.cache[x] && S.cache[x].expires === n + 1) expiring++;
    var lit = litAt(S, n + 1);
    S.lit = lit;
    if (S.bellRung) {
      if (lit < PRICES) {
        if (!S.dark) { S.dark = true; S.darkSince = n + 1; S.fillsSinceDark = 0; }
        if (PRICES - lit > S.peakDark) S.peakDark = PRICES - lit;
      } else if (S.dark) {
        S.dark = false;
        S.lastSpell = (n + 1 - S.darkSince) / SLOTS;
      }
    }
    S.n = n + 1;

    narrate(api, n, { gaveUp: gaveUp, stale: stale, expiring: expiring });
  }

  function ringBell(api) {
    var S = api.state;
    S.bellRung = true;
    var lit0 = litAt(S, BELL);
    S.lit = lit0;
    if (lit0 < PRICES) {
      S.dark = true;
      S.darkSince = BELL;
      S.fillsSinceDark = 0;
      if (PRICES - lit0 > S.peakDark) S.peakDark = PRICES - lit0;
    }
    var msg = "06:00:00, the first bell. ";
    msg += S.doors === "all"
      ? "All six doors open: 600 lookups a second, 12 for each price. "
      : "Door 1 opens: 100 lookups a second. Another door every 10 seconds. ";
    if (lit0 === 0) msg += "The cache is empty, so every lookup is a miss.";
    else msg += "Every board is lit: the warm-up's prices are in the cache.";
    say(api, msg, lit0 === 0 ? "warn" : "ok");
  }

  /* ---------- narration ---------- */

  function narrate(api, n, ev) {
    var S = api.state;
    if (S.quiet || !S.bellRung) return;

    if (ev.expiring >= 10 && (S.lastExpiryLog === null || n + 1 - S.lastExpiryLog >= 50)) {
      S.lastExpiryLog = n + 1;
      say(api, (ev.expiring === PRICES ? "All 50 prices run out" : ev.expiring + " prices run out") + " at " + slotClock(n + 1) +
        ", in the same instant: they went into the cache together, with the same TTL." +
        (S.stale ? " The cache hands out the old ones while one lookup per price refreshes it." : " Every lookup for them is a miss now."),
        S.stale ? "warn" : "bad");
    }

    if (!S.overLogged && sumRing(S.rAsked) > LIMIT) {
      S.overLogged = true;
      say(api, "The stockroom is asked for more rebuilds than the 100 a second it manages at full speed. Past 50 at once it shares its time, so every rebuild in progress slows down together.", "bad");
    }

    if (ev.stale > 0 && !S.staleLogged) {
      S.staleLogged = true;
      say(api, "Prices have run out, and the cache hands out the old ones, up to a minute past their TTL, while one lookup per price asks the stockroom for the new one.", "ok");
    }

    if (ev.gaveUp > 0 && !S.giveUpLogged) {
      S.giveUpLogged = true;
      say(api, "The first tills give up: no price in 2 seconds. The stockroom has " + fmt(S.inProg) +
        " rebuilds in progress, and it will finish them for nobody: an answer that comes back after its till gave up is thrown away.", "bad");
    }

    if (S.dark && !S.tenLogged && n + 1 - S.darkSince === 100 && S.fillsSinceDark === 0) {
      S.tenLogged = true;
      say(api, "Ten seconds dark. The stockroom has " + fmt(S.inProg) +
        " rebuilds in progress and has answered none in time: every lookup still misses, and every new rebuild slows the others. It won't recover while the crowd is inside. Try coalescing, the warm-up with jitter, or one door at a time: changing a setting replays the morning.", "bad");
    }

    if (!S.summarized && S.keysQueried === PRICES && S.inProg === 0 && S.lit === PRICES) {
      S.summarized = true;
      say(api, "Every price has been rebuilt since " + S.since + ": " + fmt(S.qTotal) + " rebuilds, " + rateText(S.qTotal / PRICES) +
        " per price. " + fmt(S.errTotal) + " lookups gave up, at most " + S.peakDark + " " + (S.peakDark === 1 ? "board was" : "boards were") +
        " dark at once, and the stockroom's busiest moment was " +
        fmt(S.peakProg) + " " + (S.peakProg === 1 ? "rebuild" : "rebuilds") + " in progress (it works on 50 at full speed).", S.errTotal ? "warn" : "ok");
    }
  }

  /* ---------- the morning ---------- */

  function startMorning(api, why) {
    var S = api.state;
    S.t = 0;
    S.n = 0;
    S.ptr = 0;
    api.clock = START_CLOCK;
    S.cache = [];
    S.inflight = [];
    S.cnt = zeros(PRICES);
    for (var k = 0; k < PRICES; k++) {
      S.cache.push(S.warm ? { expires: warmExpiry(S, k) } : null);
      S.inflight.push(null);
    }
    S.work = [];
    S.workHead = 0;
    S.live = [];
    S.inProg = 0;
    S.W = 0;
    S.wasted = 0;
    S.rAsked = zeros(SLOTS);
    S.rErr = zeros(SLOTS);
    S.rPos = 0;
    S.lit = litAt(S, 0);
    S.dark = false;
    S.darkSince = 0;
    S.fillsSinceDark = 0;
    S.lastSpell = null;
    S.bellRung = false;
    S.lastExpiryLog = null;
    S.quiet = false;
    S.lastMix = null;
    S.dotClock = 0;
    S.dotTurn = 0;
    resetCounts(S, "the bell");
    var head = (why ? why + " " : "") + "05:59:57 at Brackwater's, three seconds before the bell. ";
    if (S.warm) {
      head += "Lucan's warm-up put all 50 prices in at 05:50:00.5, each lasting " +
        (S.ttl === "jitter" ? "10 minutes plus its own random extra of up to 2." : S.ttl === "day" ? "24 hours." : "exactly 10 minutes.");
    } else {
      head += "The cache is empty after the refit.";
    }
    say(api, head, "");
    draw(api);
  }

  function replay(api, what) { startMorning(api, what + " The morning replays."); }

  /* ---------- controls ---------- */

  function setDoors(api, v) {
    var o = pick(DOOR_OPTS, v);
    if (!o) return;
    api.state.doors = String(o.value);
    replay(api, o.value === "all" ? "All six doors will open at the bell." : "One door will open at the bell, and another every 10 seconds.");
  }

  function setCache(api, v) {
    var o = pick(CACHE_OPTS, v);
    if (!o) return;
    api.state.warm = o.value === "warm";
    replay(api, api.state.warm ? "Lucan's warm-up runs at 5:50." : "No warm-up: the cache starts empty.");
  }

  function setTtl(api, v) {
    var o = pick(TTL_OPTS, v);
    if (!o) return;
    api.state.ttl = String(o.value);
    replay(api, o.value === "jitter" ? "Each price now lasts 10 minutes plus its own random extra of up to 2 minutes." :
      o.value === "day" ? "Each price now lasts 24 hours." : "Each price now lasts exactly 10 minutes.");
  }

  function setCoal(api, on) {
    api.state.coal = !!on;
    replay(api, on ? "Coalescing on: the first miss for a price rebuilds it, and later misses wait for that answer." :
      "Coalescing off: every miss asks the stockroom for its own rebuild.");
  }

  function setStale(api, on) {
    api.state.stale = !!on;
    replay(api, on ? "Serve stale on: a price up to a minute past its TTL answers at once while one lookup refreshes it." :
      "Serve stale off: a price past its TTL is a miss.");
  }

  function skip(api) {
    var S = api.state;
    if (S.n >= SKIP_TO) return;
    S.quiet = true;
    var guard = 0;
    while (S.n < SKIP_TO && guard < 20000) { slot(api); guard += 1; }
    S.quiet = false;
    S.t = SKIP_TO / SLOTS;
    api.clock = START_CLOCK + S.t;
    resetCounts(S, "06:09:55");
    say(api, "Skipped to 06:09:55, with " + doorsOpen(S, S.n) + " of 6 doors open and " + S.lit + " of 50 boards lit. Counts start again from here.", "");
    draw(api);
  }

  function restartCache(api) {
    var S = api.state;
    for (var k = 0; k < PRICES; k++) S.cache[k] = null;
    resetCounts(S, "the restart");
    S.lit = 0;
    if (S.bellRung) {
      if (!S.dark) { S.dark = true; S.darkSince = S.n; S.fillsSinceDark = 0; }
      S.peakDark = PRICES;
    }
    var open = doorsOpen(S, Math.max(0, S.n - 1));
    say(api, "Lucan's deploy restarts the price cache. It comes back empty, " +
      (open ? "with " + (open * PER_DOOR * SLOTS) + " lookups a second arriving." : "before the bell."), "warn");
    draw(api);
  }

  /* ---------- drawing ---------- */

  function lightText(S) {
    if (!S.bellRung) return "-";
    if (S.dark) return "not yet";
    if (S.lastSpell === null) return "0";
    return String(Math.round(S.lastSpell * 10) / 10);
  }

  function draw(api) {
    var S = api.state;
    var open = doorsOpen(S, S.n - 1);
    var asked = sumRing(S.rAsked);
    var errs = sumRing(S.rErr);
    var over = asked > LIMIT || S.inProg > CLERKS;

    var d = api.node("doors");
    d.text("sub", open ? open + " of 6 open" : "closed");
    d.text("meta", (open * PER_DOOR * SLOTS) + " lookups/s");
    d.set(open === 0 ? "muted" : "");

    var wu = api.node("warm");
    wu.text("sub", S.warm ? "ran at 5:50: 50 prices" : "off: cold after the refit");
    wu.set(S.warm ? "ok" : "muted");

    var sv = api.node("svc");
    sv.text("sub", "cache-aside");
    sv.text("meta", S.coal && S.stale ? "one rebuild per price, stale ok" : S.coal ? "one rebuild per price" :
      S.stale ? "serves stale while refreshing" : "every miss asks the stockroom");
    sv.set("");

    var ca = api.node("cache");
    ca.text("sub", S.lit + " of 50 prices");
    ca.text("meta", ttlLabel(S));
    ca.set(S.lit === PRICES ? "ok" : S.lit === 0 ? "bad" : "warn");

    var db = api.node("db");
    db.text("meta", fmt(S.inProg) + " in progress");
    db.set(over ? "bad" : S.inProg > 0 ? "warn" : "ok");

    S.stat.lit(String(S.lit));
    S.stat.asked(String(asked));
    S.stat.dup(S.keysQueried ? rateText(S.qTotal / S.keysQueried) : "0");
    S.stat.err(String(errs));
    S.stat.light(lightText(S));

    S.ctl.skip.disable(S.n >= SKIP_TO);
  }

  /* ---------- dots: a visual sample, never counted ---------- */

  function dots(api, dt) {
    var S = api.state;
    if (api.reducedMotion || !S.lastMix) return;
    S.dotClock += dt;
    if (S.dotClock < DOT_EVERY) return;
    S.dotClock = 0;
    var mx = S.lastMix;
    var tot = mx.hit + mx.stale + mx.miss;
    if (!tot) return;
    S.dotTurn = (S.dotTurn + 1) % 10;
    var hitShare = Math.round(10 * mx.hit / tot);
    var staleShare = Math.round(10 * mx.stale / tot);
    var over = sumRing(S.rAsked) > LIMIT || S.inProg > CLERKS;
    if (S.dotTurn < hitShare) {
      api.dot({ path: ["doors", "svc", "cache"], cls: "dot-req", r: 4, speed: DOT_SPEED,
        onArrive: function (dot, wp) { if (dot && wp === "cache") dot.cls("dot-ok"); } });
    } else if (S.dotTurn < hitShare + staleShare) {
      api.dot({ path: ["doors", "svc", "cache"], cls: "dot-req", r: 4, speed: DOT_SPEED,
        onArrive: function (dot, wp) { if (dot && wp === "cache") dot.cls("dot-accent"); } });
    } else {
      api.dot({ path: ["doors", "svc", "cache", "svc", "db"], cls: "dot-req", r: 4, speed: DOT_SPEED,
        onArrive: function (dot, wp) {
          if (!dot) return;
          if (wp === "cache") dot.cls("dot-wait");
          if (wp === "db" && over) dot.cls("dot-fail");
        } });
    }
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.cache) return;
    S.t += dt * api.speed;
    var due = Math.floor(S.t * SLOTS + EPS);
    var guard = 0;
    while (S.n < due && guard < 5000) { slot(api); guard += 1; }
    draw(api);
    dots(api, dt);
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    doors: function () {
      return "<strong>The doors.</strong> Six brass doors onto Corran Street. Each open door's crowd brings 100 lookups a second from the tills, price boards and price checkers, spread evenly over the 50 sale prices. All six at once: 600 a second at the bell. One every 10 seconds: 100, then 200, up to 600 at 06:00:50.";
    },
    warm: function (S) {
      return "<strong>Warm-up script.</strong> Lucan's script asks for all 50 prices at 5:50, so they go into the cache at 05:50:00.5, each with the TTL you picked. " +
        (S.warm ? "It's on." : "It's off, so the cache starts empty, as on Monday after the refit.");
    },
    svc: function (S) {
      var s = "<strong>Price service.</strong> Cache-aside: a fresh price in the cache answers at once. On a miss it asks the stockroom to rebuild the price, and writes the answer into the cache if it comes back within the 2 seconds a till waits. ";
      if (S.coal) s += "Coalescing is on: a miss for a price that's already being rebuilt waits for that rebuild. ";
      else s += "Coalescing is off: every miss starts its own rebuild, even of a price already being rebuilt. ";
      if (S.stale) s += "Serve stale is on: a price up to a minute past its TTL is handed out at once while one lookup refreshes it.";
      return s;
    },
    cache: function (S) {
      return "<strong>Price cache.</strong> The 50 sale prices, kept in memory. Each lasts " + ttlLabel(S).replace(" each", "") +
        " from the moment it goes in. Nothing refreshes a price until a lookup misses. Right now " + S.lit + " of 50 boards are lit.";
    },
    db: function (S) {
      return "<strong>Stockroom database.</strong> The source of truth for prices. It works on up to 50 rebuilds at once at full speed, half a second each: 100 a second. With more in progress it shares its time, so all of them slow down together. Rebuilds whose till has given up still run; their answers are thrown away. Right now: " +
        fmt(S.inProg) + " in progress.";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s2e06", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.doors = "all";
      S.warm = false;
      S.ttl = "fixed";
      S.coal = false;
      S.stale = false;
      api.speed = SPEED;

      // The warm-up's jitter draws: made once per mount (seeded), kept on replays.
      S.warmJit = [];
      for (var k = 0; k < PRICES; k++) S.warmJit.push(api.rand());

      S.ctl = {};
      S.ctl.doors = api.control.select("doors", "How the doors open at 6:00", DOOR_OPTS, "all", function (v) { setDoors(api, v); });
      S.ctl.cache = api.control.select("cache", "The cache at 6:00", CACHE_OPTS, "cold", function (v) { setCache(api, v); });
      S.ctl.ttl = api.control.select("ttl", "Each price lasts (TTL)", TTL_OPTS, "fixed", function (v) { setTtl(api, v); });
      S.ctl.coal = api.control.toggle("coal", "Coalescing: one rebuild per price", false, function (on) { setCoal(api, on); });
      S.ctl.stale = api.control.toggle("stale", "Serve stale while one refreshes (up to 1 min)", false, function (on) { setStale(api, on); });
      S.ctl.skip = api.control.button("skip", "Skip to 06:09:55", function () { skip(api); });
      S.ctl.restart = api.control.button("restart", "Deploy: restart the price cache now", function () { restartCache(api); }, { tone: "danger" });
      S.ctl.bell = api.control.button("bell", "Ring the bell again (replay from 05:59:57)", function () { replay(api, "Back to 05:59:57."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        lit: api.stat("lit", "price boards lit (of 50)", "ok"),
        asked: api.stat("asked", "stockroom asked, last second (manages 100)", ""),
        dup: api.stat("dup", "rebuilds per price", "warn"),
        err: api.stat("err", "tills that gave up, last second", "bad"),
        light: api.stat("light", "seconds until every board lit", "")
      };

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startMorning(api, "");
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return t.stat(id); }
      function lastNum(re) {
        var text = t.logText();
        var m, last = -1;
        var g = new RegExp(re.source, "g");
        while ((m = g.exec(text)) !== null) last = Number(m[1].replace(/,/g, ""));
        return last;
      }
      function busiest() { return lastNum(/busiest moment was ([0-9,]+) rebuilds? in progress/); }
      function darkest() { return lastNum(/at most ([0-9,]+) (?:boards were|board was) dark/); }
      var a, b;

      // 1. Monday: a cold cache and all six doors at once.
      await t.run(2);                                   // slots 0-39: up to 06:00:00.9
      t.expect(n("lit") === 0 && n("asked") === 600 && n("dup") === 12 && n("err") === 0 && n("light") === "not yet" &&
        t.node("db").state === "bad" && t.node("db").text.meta === "600 in progress",
        "Monday: the cold cache misses every lookup: 600 rebuilds a second, 12 per price, no board lit");
      await t.run(4.5);                                 // slots 0-129: up to 06:00:09.9
      t.expect(n("lit") === 0 && n("asked") === 600 && n("err") === 600 && n("dup") === 120 &&
        t.node("db").text.meta === "6,000 in progress",
        "Monday: by 06:00:10 the stockroom has 6,000 rebuilds in progress, 120 per price, and 600 tills a second give up");
      t.expect(t.logText().indexOf("The first tills give up: no price in 2 seconds. The stockroom has 1,200 rebuilds in progress") >= 0 &&
        t.logText().indexOf("has 6,000 rebuilds in progress and has answered none in time") >= 0,
        "Monday: 1,200 rebuilds in progress at the first give-up and 6,000 at 06:00:10, none answered in time");

      // 2. Coalescing: one rebuild per price.
      t.click("reset");
      t.click("coal");
      await t.run(2);
      t.expect(n("lit") === 50 && n("light") === 0.5 && n("dup") === 1 && n("asked") === 50 && n("err") === 0,
        "Coalescing: 50 rebuilds, one per price, and every board lit half a second after the bell");
      t.expect(t.logText().indexOf("50 rebuilds, 1 per price. 0 lookups gave up") >= 0,
        "Coalescing: the summary counts 50 rebuilds and no till giving up");

      // 3. Rule 7: one door every 10 seconds.
      t.click("reset");
      t.set("doors", "waves");
      await t.run(2);
      t.expect(n("lit") === 50 && n("light") === 0.9 && n("dup") === 1 && n("asked") === 50 && n("err") === 0 &&
        t.node("doors").text.sub === "1 of 6 open" && busiest() === 50,
        "One door at a time: 50 rebuilds, at most 50 in progress, every board lit in 0.9 s");
      await t.run(5);
      t.expect(t.node("doors").text.sub === "2 of 6 open" && n("asked") === 0 && n("lit") === 50,
        "One door at a time: door 2 opens at 06:00:10 onto a warm cache, and nothing is rebuilt");

      // 4. Tuesday: Lucan's warm-up, 10 minutes exactly, all six doors.
      t.click("reset");
      t.set("cache", "warm");
      await t.run(1.6);                                 // slots 0-31
      t.expect(n("lit") === 50 && n("light") === 0 && n("dup") === 0 && n("asked") === 0,
        "Tuesday: the warm-up has every board lit at the bell");
      await t.run(0.65);                                // slots 0-44
      t.expect(n("lit") === 0 && n("light") === "not yet" && n("asked") === 600 && n("dup") === 12,
        "Tuesday: all 50 warmed prices run out together at 06:00:00.5, and every lookup is a rebuild again");
      await t.run(4.5);                                 // slots 0-134
      t.expect(n("err") === 600 && t.node("db").text.meta === "6,000 in progress" &&
        t.logText().indexOf("All 50 prices run out at 06:00:00.5, in the same instant") >= 0,
        "Tuesday: ten seconds later, 6,000 rebuilds in progress and 600 tills a second giving up");

      // 5. The warm-up with coalescing.
      t.click("reset");
      t.set("cache", "warm");
      t.click("coal");
      await t.run(2.25);                                // slots 0-44
      t.expect(n("lit") === 50 && n("light") === 0.5 && n("dup") === 1 && n("asked") === 50,
        "Warm-up and coalescing: the prices run out together but come back after one rebuild each, half a second later");

      // 6. Serve stale while one refreshes.
      t.click("reset");
      t.set("cache", "warm");
      t.click("stale");
      await t.run(2.25);                                // slots 0-44
      t.expect(n("lit") === 50 && n("light") === 0 && n("dup") === 1 && n("asked") === 50 && n("err") === 0,
        "Serve stale: the old prices answer while one rebuild per price runs, and no board goes dark");
      t.click("reset");
      t.click("stale");
      await t.run(2);                                   // slots 0-39
      t.expect(n("lit") === 0 && n("dup") === 12,
        "Serve stale does nothing for a cold cache: there is nothing old to hand out");

      // 7. Jitter, without coalescing.
      t.click("reset");
      t.set("cache", "warm");
      t.set("ttl", "jitter");
      await t.run(63);                                  // slots 0-1259: up to 06:02:02.9
      a = busiest();
      b = darkest();
      t.expect(t.logText().indexOf("300 rebuilds, 6 per price. 0 lookups gave up") >= 0 && n("dup") === 6 && n("lit") === 50 && n("err") === 0,
        "Jitter: prices run out one or two at a time, 6 rebuilds each, 300 in all, and no till gives up");
      t.expect(a > 0 && a <= 12 && b >= 1 && b <= 2,
        "Jitter: never more than 12 rebuilds in progress or 2 boards dark at once");

      // 8. The senior answer: warm-up with jitter, coalescing, one door every 10 seconds.
      t.click("reset");
      t.set("doors", "waves");
      t.set("cache", "warm");
      t.set("ttl", "jitter");
      t.click("coal");
      await t.run(63);                                  // slots 0-1259
      a = busiest();
      b = darkest();
      t.expect(t.logText().indexOf("50 rebuilds, 1 per price. 0 lookups gave up") >= 0 && a >= 1 && a <= 2 && b >= 1 && b <= 2 &&
        t.node("doors").text.sub === "6 of 6 open" && n("lit") === 50,
        "Warm-up with jitter, coalescing and one door at a time: 50 rebuilds in two minutes, never more than 2 at once");

      // 9. A deploy restarts the price cache with the store full.
      t.click("reset");
      t.click("coal");
      await t.run(3);                                   // slots 0-59
      t.click("restart");
      await t.run(0.5);                                 // slots 60-69
      t.expect(n("lit") === 50 && n("light") === 0.5 && n("dup") === 1 && n("asked") === 50,
        "Deploy with coalescing: the empty cache costs 50 rebuilds and half a second");
      t.click("reset");
      t.set("cache", "warm");
      t.set("ttl", "day");
      await t.run(2);                                   // slots 0-39
      t.expect(n("lit") === 50 && n("dup") === 0, "24-hour TTL: nothing runs out all morning");
      t.click("restart");
      await t.run(0.5);                                 // slots 40-49
      t.expect(n("lit") === 0 && n("asked") === 600 && n("dup") === 12,
        "24-hour TTL: a deploy that empties the cache with the store full is Monday again");

      // 10. Rule 7 alone, with the warm-up: fine at 6:00, frozen at 6:10.
      t.click("reset");
      t.set("doors", "waves");
      t.set("cache", "warm");
      await t.run(2.25);                                // slots 0-44
      t.expect(n("lit") === 50 && n("light") === 0.9 && n("dup") === 1,
        "Doors only: the warmed prices run out at 06:00:00.5 with one door open and are rebuilt one each in 0.9 s");
      t.click("skip");
      await t.run(4.5);                                 // slots 5980-6069: up to 06:10:06.9
      t.expect(n("lit") === 0 && n("light") === "not yet" && n("asked") === 600 && n("err") === 540,
        "Doors only: at 06:10:01 every price runs out within half a second with the store full, and nothing comes back");
    }
  });
})();
