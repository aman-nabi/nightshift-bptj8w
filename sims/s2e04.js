/* sims/s2e04-v1.0.0.js  (published as sims/s2e04.js)
   Case s2e04 "The Jar on the Counter": a cache sim for Varga's, an all-night bakery whose website
   keeps cards for the most-asked-for loaves in "the jar", a cache-aside cache in front of a slow
   stock database. The learner sets the jar's size, eviction rule and TTL, runs the 3:58 archive
   reader (a one-off scan of 400 old loaves) and puts in the 4:00 list (every price changes).

   CHANGELOG
   v1.0.0 (2026-10-07) first version: customers send 20 lookups a second (8 regular loaves twice a
     second each, 4 a second for the other 72 loaves in turn). Controls: the jar on or off, jar size
     (12, 24, 100 or 480 cards), eviction rule (LRU or LFU), TTL (24 h, 1 h, 5 min, 1 min, 10 s,
     1 s), run the archive reader (400 old loaves at 10 a second), put in the new list (every
     current loaf changes, so older cards become stale), reset. Stats over the last 10 seconds:
     hit ratio, average latency, database load against its limit of 25 a second; plus stale reads
     served since the night started. selfTest: 16 assertions covering LRU and LFU under the scan,
     a bigger jar, the new list under 24 h, 5 min and 1 s TTLs, a jar that holds every loaf, and
     no jar at all.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e04-v1.0.0.json):
   - post: 480 loaves on the website, 80 baked now, 400 in the archive; 20 lookups a second at
     night; the stock database takes 60 ms a lookup and manages about 25 a second; the jar is a
     cache about 1 ms away, holding 12 cards, each lasting 24 hours, pushing out the card asked
     for longest ago (LRU); a miss is three trips, jar, database, jar, 62 ms; eight regulars get
     four lookups in five, so the jar answers 80% and the database gets 4 a second; the archive
     reader reads 400 old loaves at 10 a second from 03:58:00 to 03:58:40, the jar drops to 0%
     and the database to 30 a second, over its 25; at 03:58:51 the jar is back to 80%; at 04:00
     Agnes puts in the new list and by 04:10 9,600 lookups (16 a second for 600 s) have been shown
     the old list. The sim clock starts at 03:57:00.
   - comments: hit ratio arithmetic, 0.8 x 1 ms + 0.2 x 62 ms = 13.2 ms and 4 lookups in 20 to the
     database (u/grey_pager); LRU vs LFU and the crawler (u/crawl_budget_kiri); TTL is how long
     you're willing to be wrong (u/oven_spring_zofia).
   - reply options: index 0 (LFU, 5 min TTL): 14 a second at the database during the read, the
     regulars' cards fetched at 03:57:00 run out at 04:02:00 after 1,920 stale reads (16 a second
     for 120 s), 80% hits. Index 1 (480 cards): every lookup a hit within 20 s, 10 a second at the
     database during the read, 20 stale reads a second after the list, 12,000 by 04:10. Index 2
     (jar off): 20 a second, 60 ms, 30 a second during the read. Index 3 (1 s TTL): 40%, 12 a
     second, 38 ms, and 30 a second during the read under LRU. 10 s TTL: 76% (senior note).

   Teaching model (stated in sim.lede):
   - Time runs in slots of 1/20 s. Slot n is lookup n, at sim time n / 20 s after 03:57:00. Each
     frame processes every slot that is due (floor(t x 20)), so the results never depend on the
     frame rate. TTLs are counted in slots too.
   - The customers' mix is a fixed 20-slot pattern: regulars 0-3, other, regulars 4-7, other,
     twice. So every regular comes up exactly every 10 slots (0.5 s) and any 20 slots in a row
     hold exactly 16 regular lookups and 4 others. The other 72 loaves come up one after another
     in an order shuffled once with the seeded api.rand() in setup and kept across replays. Each
     comes back every 18 s. api.rand() also picks which recent lookup each sample dot shows. No
     counted number depends on api.rand(): every stat follows from the pattern, which is what
     keeps them equal to the story's numbers.
   - The archive reader adds one lookup for the next old loaf every second slot (10 a second),
     after that slot's customer lookup, until all 400 are read (40 s).
   - Cache-aside: a hit costs 1 ms; a miss costs 62 ms and puts the card in the jar, evicting
     first if the jar is full. LRU evicts the card with the oldest last use; LFU the card with the
     lowest use count (1 when it goes in, +1 per hit), ties to the older last use. Cards keep their
     place in a list in the order they went in, and the first card that wins the comparison is
     evicted. A card past its TTL counts as a miss and is refreshed in place with a count of 1 (an
     expired key is a new key). The jar off means every lookup goes to the database, 60 ms, and
     the jar's memory is emptied; turned on again, it starts empty.
   - A new list raises the list version. A card for a current loaf fetched before it is stale; a
     hit on it is a stale read. Archive loaves never change.
   - Stats cover the last 200 slots (10 s): hit ratio and average latency over customers'
     lookups, database load over customers' misses plus the reader's misses. Past 25 lookups a
     second the latency stat says "over limit": the database falls behind and the sim does not
     guess the wait.
   - Changing the size, rule or TTL replays the night from 03:57:00 with an empty jar and the same
     on or off setting, as s2e03 replays on a mode change.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px,
   edge label 11px):
   - Customers' screens (260 wide): label 18 chars, 140px; sub "20 lookups/s", 86px.
   - Archive reader (240 wide): longest sub "reading: 400 of 400" 19 chars, 137px.
   - Shop website (300 wide): longest meta "every lookup to database" or "jar first, then database",
     24 chars, 158px.
   - The jar (260 wide): longest sub "480 of 480 cards, LFU" 21 chars, 151px; longest meta
     "8 of 8 regulars in" 18 chars, 119px.
   - Stock database (260 wide, db shape): longest meta "29.6/s: over its 25/s" 21 chars, 139px.
   - Agnes's list (240 wide, 62 high): sub "today's loaves, prices" 22 chars, 158px; meta
     "new list at 04:00:00" 20 chars, 132px.
   - Vertical gaps: top row bottom y 70, website top y 119 (49px); website bottom y 181, jar and
     database top y 254 (73px); database bottom y 326, list top y 379 (53px).
   - Edge labels: "1. jar first" centred near (275, 209) and "2. on a miss" near (465, 209), each
     79px wide, between the website's meta line (y 163 to 176) and the jar and database labels
     (from y 268); "new list" near (570, 350), 53px wide, between the database (bottom y 326) and
     the list (top y 379).

   Catalog note: the case's concepts are the catalog's own ids for s2e04 (caching, cache-aside,
   hit-ratio, ttl). The board strings point at stale-reads, cache-invalidation, cache-stampede and
   eviction-policies-in-depth, which later cases (s2e05, s2e06, s2e10) own.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 10;                           // sim seconds per real second
  var START_CLOCK = 3 * 3600 + 57 * 60;     // 03:57:00 on Friday at Varga's
  var RATE = 20;                            // customers' lookups a second
  var REGULARS = ["sourdough", "seeded rye", "black rye", "white tin", "poppy plait", "milk loaf", "spelt", "challah"];
  var OTHERS = 72;                          // the other loaves we bake now (80 in all)
  var ARCHIVE = 400;                        // loaves nobody bakes any more
  var ARCHIVE_FIRST = "Abbey rye";
  var ARCHIVE_LAST = "Zwieback";
  var SCAN_EVERY = 2;                       // one archive lookup every 2 slots: 10 a second
  var PATTERN = [0, 1, 2, 3, -1, 4, 5, 6, 7, -1, 0, 1, 2, 3, -1, 4, 5, 6, 7, -1];
  var JAR_MS = 1;                           // looking in the jar
  var DB_MS = 60;                           // one database lookup
  var MISS_MS = JAR_MS + DB_MS + JAR_MS;    // three trips: 62 ms
  var DB_LIMIT = 25;                        // what the stock database manages a second
  var WINDOW = 10 * RATE;                   // stats cover the last 10 s: 200 slots
  var EPS = 1e-6;
  var DOT_EVERY = 0.25;                     // real seconds between customer sample dots
  var CRAWL_DOT_EVERY = 0.35;               // real seconds between archive reader dots
  var DOT_SPEED = 300;                      // viewBox units per real second

  var SIZES = [
    { value: 12, label: "12 cards (Mikko's jar)" },
    { value: 24, label: "24 cards" },
    { value: 100, label: "100 cards" },
    { value: 480, label: "480 cards (every loaf)" }
  ];
  var POLICIES = [
    { value: "lru", label: "LRU: the card used longest ago" },
    { value: "lfu", label: "LFU: the card used least often" }
  ];
  var TTLS = [
    { value: 86400, label: "24 hours (Mikko's)" },
    { value: 3600, label: "1 hour" },
    { value: 300, label: "5 minutes" },
    { value: 60, label: "1 minute" },
    { value: 10, label: "10 seconds" },
    { value: 1, label: "1 second" }
  ];

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  // 9600 -> "9,600". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  // 4 -> "4", 29.6 -> "29.6", 0 -> "0".
  function rateText(v) {
    if (!(v >= 0.05)) return "0";
    var r = Math.round(v * 10) / 10;
    return r === Math.round(r) ? String(Math.round(r)) : String(r);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function clockText(sec) {
    var s = Math.floor(sec + EPS);
    var day = s >= 86400;
    s = s % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60) + (day ? " tomorrow" : "");
  }

  function ttlText(sec) {
    for (var i = 0; i < TTLS.length; i++) if (TTLS[i].value === sec) return TTLS[i].label.replace(" (Mikko's)", "");
    return sec + " s";
  }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function loafName(key) {
    var k = key.charAt(0);
    var i = Number(key.slice(1));
    if (k === "r") return REGULARS[i];
    if (k === "o") return "other loaf " + (i + 1);
    return "archive loaf " + (i + 1);
  }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 450,
    aria: "Cache sim for Varga's bakery. Customers' screens send 20 lookups a second to the shop website. The archive reader, a crawler, can add 10 lookups a second for 400 old loaves. The website looks in the jar, a cache of 12 cards, first, and on a miss asks the stock database, which takes 60 ms a lookup and manages about 25 a second. Agnes's list writes the day's loaves and prices to the database, not to the jar.",
    nodes: [
      { id: "customers", label: "Customers' screens", sub: "20 lookups/s", x: 190, y: 44, w: 260, h: 52, shape: "box", tone: "" },
      { id: "crawler", label: "Archive reader", sub: "comes at 3:58", x: 560, y: 44, w: 240, h: 52, shape: "box", tone: "muted" },
      { id: "web", label: "Shop website", sub: "cache-aside", meta: "jar first, then database", x: 370, y: 150, w: 300, h: 62, shape: "box", tone: "" },
      { id: "jar", label: "The jar (cache)", sub: "0 of 12 cards, LRU", meta: "0 of 8 regulars in", x: 170, y: 290, w: 260, h: 72, shape: "box", tone: "" },
      { id: "db", label: "Stock database", sub: "60 ms a lookup", meta: "0/s of its 25/s", x: 570, y: 290, w: 260, h: 72, shape: "db", tone: "ok" },
      { id: "list", label: "Agnes's list", sub: "today's loaves, prices", meta: "new list: none yet", x: 570, y: 410, w: 240, h: 62, shape: "box", tone: "" }
    ],
    edges: [
      { from: "customers", to: "web" },
      { from: "crawler", to: "web", dash: true, tone: "muted" },
      { from: "web", to: "jar", label: "1. jar first" },
      { from: "web", to: "db", label: "2. on a miss" },
      { from: "list", to: "db", label: "new list" }
    ]
  };

  /* ---------- the jar ---------- */

  function ttlSlots(S) { return S.ttl * RATE; }
  function alive(S, c) { return S.n - c.filled < ttlSlots(S); }
  function isStale(S, c) { return c.key.charAt(0) !== "a" && c.ver < S.version; }

  function evict(S) {
    var best = null;
    var bi = -1;
    for (var i = 0; i < S.cards.length; i++) {
      var c = S.cards[i];
      if (!best) { best = c; bi = i; continue; }
      if (S.policy === "lru") {
        if (c.last < best.last) { best = c; bi = i; }
      } else if (c.count < best.count || (c.count === best.count && c.last < best.last)) {
        best = c; bi = i;
      }
    }
    if (bi < 0) return;
    S.cards.splice(bi, 1);
    delete S.idx[best.key];
    if (S.scan && S.policy === "lfu" && best.key.charAt(0) === "r" && best.count <= 2) S.scan.lfuLost = best.key;
  }

  // Returns -1 with the jar off, 0 for a miss, 1 for a fresh hit, 2 for a stale hit.
  function look(S, key, n) {
    if (!S.on) return -1;
    var c = S.idx[key];
    if (c && n - c.filled < ttlSlots(S)) {
      c.last = n;
      c.count += 1;
      return isStale(S, c) ? 2 : 1;
    }
    if (c) {
      // Expired: the key is gone, so it comes back as a new card in the same place.
      c.filled = n; c.last = n; c.count = 1; c.ver = S.version;
      return 0;
    }
    if (S.cards.length >= S.size) evict(S);
    c = { key: key, filled: n, last: n, count: 1, ver: S.version };
    S.cards.push(c);
    S.idx[key] = c;
    return 0;
  }

  function pushRing(S, hit, stale, ms, db) {
    var p = S.ringPos;
    if (S.ringLen === WINDOW) {
      S.sumHit -= S.rHit[p]; S.sumStale -= S.rStale[p]; S.sumMs -= S.rMs[p]; S.sumDb -= S.rDb[p];
    } else {
      S.ringLen += 1;
    }
    S.rHit[p] = hit; S.rStale[p] = stale; S.rMs[p] = ms; S.rDb[p] = db;
    S.sumHit += hit; S.sumStale += stale; S.sumMs += ms; S.sumDb += db;
    S.ringPos = (p + 1) % WINDOW;
  }

  function dbRate(S) { return S.ringLen ? S.sumDb * RATE / S.ringLen : 0; }

  function compute(S) {
    var L = S.ringLen;
    var r = {
      hit: L ? 100 * S.sumHit / L : 0,
      wait: L ? S.sumMs / L : (S.on ? 0 : DB_MS),
      rate: dbRate(S),
      used: S.cards.length,
      regs: 0,
      staleCards: 0
    };
    r.over = r.rate > DB_LIMIT + EPS;
    for (var i = 0; i < S.cards.length; i++) {
      var c = S.cards[i];
      if (!alive(S, c)) continue;
      if (c.key.charAt(0) === "r") r.regs += 1;
      if (isStale(S, c)) r.staleCards += 1;
    }
    return r;
  }

  /* ---------- one slot: one customer lookup, maybe one archive lookup ---------- */

  function slot(api) {
    var S = api.state;
    var n = S.n;
    var p = PATTERN[n % PATTERN.length];
    var key;
    if (p >= 0) {
      key = "r" + p;
    } else {
      key = "o" + S.order[S.rc % OTHERS];
      S.rc += 1;
    }
    var res = look(S, key, n);
    var hit = res > 0 ? 1 : 0;
    var stale = res === 2 ? 1 : 0;
    var ms = res < 0 ? DB_MS : (hit ? JAR_MS : MISS_MS);
    var db = hit ? 0 : 1;
    S.staleTotal += stale;
    if (S.listOpen) S.staleSinceList += stale;

    var sc = S.scan;
    if (sc && (n - sc.start) % SCAN_EVERY === 0 && sc.i < ARCHIVE) {
      var r2 = look(S, "a" + sc.i, n);
      sc.i += 1;
      if (r2 <= 0) db += 1;
    }

    pushRing(S, hit, stale, ms, db);
    S.n += 1;

    if (sc) {
      sc.cust += 1;
      sc.hits += hit;
      var rt = dbRate(S);
      if (rt > sc.peak) sc.peak = rt;
      if (p >= 0 && S.on) {
        sc.regMissRun = hit ? 0 : sc.regMissRun + 1;
        if (sc.regMissRun >= 16 && !sc.flushNoted) {
          sc.flushNoted = true;
          api.log("The archive's cards keep pushing the regulars out before they're asked for again: every customer lookup misses, and each miss is another trip to the database.", "bad");
        }
      }
      if (sc.lfuLost && !sc.lfuNoted) {
        sc.lfuNoted = true;
        api.log("LFU pushed out the " + loafName(sc.lfuLost) + " card. It had only just gone into the jar, after its TTL ran out or the jar started, so its count was as low as an archive card's.", "warn");
      }
      if (sc.i >= ARCHIVE) finishScan(api);
    }

    S.recent.push({ res: res });
    if (S.recent.length > 64) S.recent.shift();
  }

  function finishScan(api) {
    var S = api.state;
    var sc = S.scan;
    S.scan = null;
    var over = sc.peak > DB_LIMIT + EPS;
    api.log("The archive reader is done: " + ARCHIVE + " old loaves, " + ARCHIVE_FIRST + " to " + ARCHIVE_LAST + ", in 40 s. While it read, the jar answered " +
      fmt(sc.hits) + " of " + fmt(sc.cust) + " customers' lookups, and the database peaked at " + rateText(sc.peak) + " a second, " +
      (over ? "past" : "under") + " the " + DB_LIMIT + " it manages.", over ? "bad" : "ok");
  }

  /* ---------- the night ---------- */

  function startNight(api) {
    var S = api.state;
    S.t = 0;
    S.n = 0;
    S.rc = 0;
    api.clock = START_CLOCK;
    S.cards = [];
    S.idx = {};
    S.version = 0;
    S.scan = null;
    S.rHit = []; S.rStale = []; S.rMs = []; S.rDb = [];
    for (var i = 0; i < WINDOW; i++) { S.rHit.push(0); S.rStale.push(0); S.rMs.push(0); S.rDb.push(0); }
    S.ringPos = 0; S.ringLen = 0;
    S.sumHit = 0; S.sumStale = 0; S.sumMs = 0; S.sumDb = 0;
    S.staleTotal = 0;
    S.staleSinceList = 0;
    S.listOpen = false;
    S.listAt = null;
    S.warm = false;
    S.recent = [];
    S.dotClock = 0;
    S.crawlClock = 0;
    var head = "03:57 on Friday at Varga's. Customers send 20 lookups a second: each of the 8 regulars twice a second, and 4 for the other 72 loaves in turn. ";
    if (!S.on) {
      api.log(head + "The jar is off, so every lookup goes to the stock database, 60 ms each.", "warn");
    } else {
      api.log(head + "The jar starts empty, " + S.size + " cards, " + S.policy.toUpperCase() + ", each card lasting " + ttlText(S.ttl) +
        ". Each loaf's first lookup misses and puts its card in.", "");
    }
    draw(api, compute(S));
  }

  /* ---------- controls ---------- */

  function replay(api, what) {
    api.log(what + " The night replays from 03:57:00 with an empty jar.", "");
    startNight(api);
  }

  function setSize(api, v) {
    var o = pick(SIZES, v);
    if (!o) return;
    api.state.size = Number(o.value);
    replay(api, "The jar now holds " + o.value + " cards.");
  }

  function setPolicy(api, v) {
    var o = pick(POLICIES, v);
    if (!o) return;
    api.state.policy = String(o.value);
    replay(api, o.value === "lru"
      ? "When the jar is full it now pushes out the card used longest ago (LRU)."
      : "When the jar is full it now pushes out the card used the fewest times (LFU).");
  }

  function setTtl(api, v) {
    var o = pick(TTLS, v);
    if (!o) return;
    api.state.ttl = Number(o.value);
    replay(api, "Each card now lasts " + ttlText(api.state.ttl) + ".");
  }

  function setJar(api, on) {
    var S = api.state;
    S.on = !!on;
    S.cards = [];
    S.idx = {};
    S.warm = false;
    if (S.on) {
      api.log("The jar is back on, and empty: every loaf's first lookup misses and puts its card in, so the database gets a burst before the jar settles.", "warn");
    } else {
      api.log("The jar is off, and its memory with it. Every lookup goes to the stock database now: 20 a second, 60 ms each, and nothing is ever stale.", "warn");
    }
    draw(api, compute(S));
  }

  function runScan(api) {
    var S = api.state;
    if (S.scan) return;
    S.scan = { start: S.n, i: 0, cust: 0, hits: 0, peak: 0, regMissRun: 0, flushNoted: false, lfuLost: null, lfuNoted: false };
    var msg = "The archive reader arrives: " + ARCHIVE + " old loaves, " + ARCHIVE_FIRST + " to " + ARCHIVE_LAST + ", 10 a second for 40 s. ";
    if (!S.on) {
      msg += "The jar is off, so all 10 a second go to the database on top of the customers' 20.";
    } else if (S.policy === "lru") {
      msg += "Every one misses and goes into the jar as its most recently used card, so the cards that haven't been used for a moment go first.";
    } else {
      msg += "Every one misses and goes into the jar with a count of 1, so under LFU the archive's cards are the first to go.";
    }
    api.log(msg, "warn");
    draw(api, compute(S));
  }

  function newList(api) {
    var S = api.state;
    S.version += 1;
    S.listOpen = true;
    S.staleSinceList = 0;
    S.listAt = api.clock;
    var r = compute(S);
    var msg = "Agnes puts in the new list: today's loaves and prices. The database has it at once. ";
    if (!S.on) {
      msg += "The jar is off, so every lookup already reads the new list.";
      S.listOpen = false;
    } else if (!r.staleCards) {
      msg += "No card in the jar is from yesterday's list.";
      S.listOpen = false;
    } else {
      var last = 0;
      for (var i = 0; i < S.cards.length; i++) {
        var c = S.cards[i];
        if (alive(S, c) && isStale(S, c) && c.filled > last) last = c.filled;
      }
      msg += r.staleCards + (r.staleCards === 1 ? " card" : " cards") + " in the jar " + (r.staleCards === 1 ? "is" : "are") +
        " from yesterday's list, and nothing tells the jar. They answer until they expire, the last at " +
        clockText(START_CLOCK + (last + ttlSlots(S)) / RATE) + ", or are pushed out.";
    }
    api.log(msg, S.listOpen ? "bad" : "ok");
    draw(api, r);
  }

  /* ---------- narration after each frame ---------- */

  function narrate(api, r) {
    var S = api.state;
    if (S.on && !S.warm && r.regs === REGULARS.length) {
      S.warm = true;
      api.log("Every regular has a card now, and the regulars are 4 lookups in 5. From here most lookups are hits, and only misses reach the database.", "ok");
    }
    if (S.listOpen && S.on && r.staleCards === 0) {
      S.listOpen = false;
      api.log("The last card from yesterday's list has left the jar. Stale reads served since the new list: " + fmt(S.staleSinceList) + ".", "ok");
    }
  }

  /* ---------- drawing ---------- */

  function draw(api, r) {
    var S = api.state;

    var cr = api.node("crawler");
    if (S.scan) {
      cr.text("sub", "reading: " + S.scan.i + " of " + ARCHIVE);
      cr.set("accent");
    } else {
      cr.text("sub", "comes at 3:58");
      cr.set("muted");
    }
    api.edge("crawler", "web").set("");

    var web = api.node("web");
    web.text("sub", S.on ? "cache-aside" : "jar off");
    web.text("meta", S.on ? "jar first, then database" : "every lookup to database");
    web.set("");

    var jar = api.node("jar");
    if (!S.on) {
      jar.text("sub", "off");
      jar.text("meta", "every card gone");
      jar.set("muted");
    } else {
      jar.text("sub", r.used + " of " + S.size + " cards, " + S.policy.toUpperCase());
      if (r.staleCards > 0) {
        jar.text("meta", r.staleCards + (r.staleCards === 1 ? " stale card" : " stale cards"));
        jar.set("warn");
      } else {
        jar.text("meta", r.regs + " of " + REGULARS.length + " regulars in");
        jar.set(r.regs === REGULARS.length ? "ok" : "");
      }
    }
    api.edge("web", "jar").set(S.on ? "" : "cut");

    var db = api.node("db");
    db.text("meta", r.over
      ? rateText(r.rate) + "/s: over its " + DB_LIMIT + "/s"
      : rateText(r.rate) + "/s of its " + DB_LIMIT + "/s");
    db.set(r.over ? "bad" : (r.rate >= 0.8 * DB_LIMIT - EPS ? "warn" : "ok"));

    var li = api.node("list");
    li.text("meta", S.listAt === null ? "new list: none yet" : "new list at " + clockText(S.listAt));
    li.set(S.listOpen ? "accent" : "");

    S.stat.hit(String(Math.round(r.hit + EPS)));
    S.stat.wait(r.over ? "over limit" : String(Math.round(r.wait + EPS)));
    S.stat.db(rateText(r.rate));
    S.stat.stale(fmt(S.staleTotal));

    S.ctl.scan.disable(!!S.scan);
  }

  /* ---------- dots: a visual sample, never counted ---------- */

  function dots(api, dt, r) {
    var S = api.state;
    if (api.reducedMotion) { S.recent = []; return; }
    S.dotClock += dt;
    if (S.dotClock >= DOT_EVERY && S.recent.length) {
      S.dotClock = 0;
      var it = S.recent[Math.floor(api.rand() * S.recent.length)];
      S.recent = [];
      var over = r.over;
      if (it.res < 0) {
        api.dot({ path: ["customers", "web", "db"], cls: "dot-req", r: 4, speed: DOT_SPEED,
          onArrive: function (dot, wp) { if (dot && wp === "db" && over) dot.cls("dot-fail"); } });
      } else if (it.res > 0) {
        var stale = it.res === 2;
        api.dot({ path: ["customers", "web", "jar"], cls: "dot-req", r: 4, speed: DOT_SPEED,
          onArrive: function (dot, wp) { if (dot && wp === "jar") dot.cls(stale ? "dot-bad" : "dot-ok"); } });
      } else {
        api.dot({ path: ["customers", "web", "jar", "web", "db"], cls: "dot-req", r: 4, speed: DOT_SPEED,
          onArrive: function (dot, wp) {
            if (!dot) return;
            if (wp === "jar") dot.cls("dot-wait");
            if (wp === "db" && over) dot.cls("dot-fail");
          } });
      }
    }
    if (S.scan) {
      S.crawlClock += dt;
      if (S.crawlClock >= CRAWL_DOT_EVERY) {
        S.crawlClock = 0;
        api.dot({ path: S.on ? ["crawler", "web", "jar", "web", "db"] : ["crawler", "web", "db"], cls: "dot-accent", r: 4, speed: DOT_SPEED });
      }
    }
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.cards) return;
    S.t += dt * api.speed;
    var due = Math.floor(S.t * RATE + EPS);
    var guard = 0;
    while (S.n < due && guard < 100000) { slot(api); guard += 1; }
    var r = compute(S);
    narrate(api, r);
    draw(api, r);
    dots(api, dt, r);
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    customers: function () {
      return "<strong>Customers' screens.</strong> Phones and the screen by the door. Every loaf a customer opens is a lookup: its price and whether any are left. At night that's 20 a second: each of the 8 regulars twice a second, and 4 a second for the other 72 loaves we bake, one after another.";
    },
    crawler: function (S) {
      var s = "<strong>Archive reader.</strong> A search engine's web crawler that reads the website's archive, the 400 loaves nobody bakes any more, " +
        "A to Z, 10 a second, every night at 3:58. Every one of its lookups is a miss. ";
      if (!S.on) return s + "With the jar off, its 10 a second land on the database on top of the customers' 20.";
      if (S.policy === "lru") return s + "Under LRU each of its cards becomes the most recently used one in the jar, so in a small jar the regulars are pushed out before they're asked for again.";
      return s + "Under LFU each of its cards comes in with a count of 1, the lowest in the jar, so they're the first to go and the regulars stay.";
    },
    web: function (S) {
      if (!S.on) return "<strong>Shop website.</strong> The jar is off, so it asks the stock database for every lookup: 60 ms each.";
      return "<strong>Shop website.</strong> It does cache-aside: look in the jar first. A hit answers in 1 ms. On a miss it asks the database, puts a copy of the card in the jar and answers: three trips, 62 ms.";
    },
    jar: function (S, r) {
      if (!S.on) return "<strong>The jar.</strong> Switched off, and its memory with it.";
      return "<strong>The jar.</strong> A cache in memory, about 1 ms away, holding " + S.size + " cards, " + r.used + " in use now. Each card is a copy of one loaf's price and stock, and lasts " +
        ttlText(S.ttl) + " (its TTL). When the jar is full it pushes out " +
        (S.policy === "lru" ? "the card used longest ago (LRU)." : "the card used the fewest times since it went in (LFU).") +
        " Nothing tells it when the database changes: a card is only fetched again when it expires or is pushed out." +
        (r.staleCards ? " Right now " + r.staleCards + " of its cards are from yesterday's list." : "");
    },
    db: function (S, r) {
      return "<strong>Stock database.</strong> The source of truth for every loaf's price and stock. A lookup takes 60 ms: it reads from disk and adds up the night's sales. It works on a couple of lookups at a time and manages about 25 a second; past that, lookups queue and waits grow. Right now: " +
        rateText(r.rate) + " a second.";
    },
    list: function () {
      return "<strong>Agnes's list.</strong> At 4:00 every morning Agnes puts the day's loaves and prices into the database. The database changes at once. The jar's cards don't: they keep yesterday's list until they expire or are pushed out.";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s2e04", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.on = true;
      S.size = 12;
      S.policy = "lru";
      S.ttl = 86400;
      api.speed = SPEED;

      // The order the other 72 loaves come up in: shuffled once per mount (seeded), kept on replays.
      S.order = [];
      for (var i = 0; i < OTHERS; i++) S.order.push(i);
      for (var j = OTHERS - 1; j > 0; j--) {
        var k = Math.floor(api.rand() * (j + 1));
        var tmp = S.order[j]; S.order[j] = S.order[k]; S.order[k] = tmp;
      }

      S.ctl = {};
      S.ctl.jar = api.control.toggle("jar", "The jar (cache)", true, function (on) { setJar(api, on); });
      S.ctl.size = api.control.select("size", "Jar size", SIZES, 12, function (v) { setSize(api, v); });
      S.ctl.policy = api.control.select("policy", "When it's full, push out", POLICIES, "lru", function (v) { setPolicy(api, v); });
      S.ctl.ttl = api.control.select("ttl", "Each card lasts (TTL)", TTLS, 86400, function (v) { setTtl(api, v); });
      S.ctl.scan = api.control.button("scan", "Run the archive reader (3:58)", function () { runScan(api); });
      S.ctl.list = api.control.button("list", "Put in the new list: prices change (4:00)", function () { newList(api); }, { tone: "danger" });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        hit: api.stat("hit", "hit ratio %, last 10 s", "ok"),
        wait: api.stat("wait", "average latency, ms", "warn"),
        db: api.stat("db", "database load, lookups/s (limit 25)", ""),
        stale: api.stat("stale", "stale reads served", "bad")
      };

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state, compute(api.state)));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startNight(api);
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      var a;

      // 1. Mikko's jar: 12 cards, LRU, 24 hours.
      await t.run(3);
      t.expect(n("hit") === 80 && n("wait") === 13 && n("db") === 4 && n("stale") === 0 &&
        t.node("jar").text.meta === "8 of 8 regulars in" && t.node("db").state === "ok",
        "12 cards, LRU: the jar answers 80% of lookups, 13 ms on average, and the database gets 4 a second");

      // 2. The archive reader under LRU.
      t.click("scan");
      await t.run(2);
      t.expect(n("hit") === 0 && n("db") === 30 && t.stat("wait") === "over limit" && t.node("db").state === "bad",
        "LRU: the archive reader pushes the regulars out: 0% hits and 30 lookups a second at the database, past its 25");
      await t.run(3.1);
      t.expect(n("hit") === 80 && n("db") === 4 && n("wait") === 13 && t.node("jar").text.meta === "8 of 8 regulars in",
        "LRU: after the read each regular misses once and comes back: 80% and 4 a second again");
      t.expect(t.logText().indexOf("answered 4 of 799 customers' lookups, and the database peaked at 30 a second, past") >= 0,
        "LRU: while it read, the jar answered 4 of 799 customers' lookups");

      // 3. LFU keeps the regulars through the read.
      t.click("reset");
      t.set("policy", "lfu");
      await t.run(3);
      t.click("scan");
      await t.run(2);
      t.expect(n("hit") === 80 && n("db") === 14 && n("wait") === 13 && t.node("jar").text.meta === "8 of 8 regulars in",
        "LFU: the archive's cards are used once and go first, so the regulars stay: 80%, and 14 a second at the database");
      await t.run(2.1);
      t.expect(t.logText().indexOf("answered 640 of 799 customers' lookups, and the database peaked at 14 a second, under") >= 0,
        "LFU: while it read, the jar answered 640 of 799 customers' lookups and the database stayed under its limit");

      // 4. A bigger jar survives the same read under LRU.
      t.click("reset");
      t.set("size", 24);
      await t.run(3);
      t.click("scan");
      await t.run(2);
      t.expect(n("hit") === 80 && n("db") === 14,
        "24 cards, LRU: room for the regulars and the archive's cards, so the read only adds its own 10 a second");

      // 5. The 4:00 list with a 24-hour TTL.
      t.click("reset");
      await t.run(3);
      t.click("list");
      await t.run(1);
      t.expect(n("stale") === 160 && n("hit") === 80 && t.node("jar").text.meta === "8 stale cards",
        "24 h TTL: after the new list the regulars keep yesterday's cards: 16 stale reads a second, 160 in 10 s");
      t.click("scan");
      await t.run(4.2);
      a = n("stale");
      await t.run(1);
      t.expect(a === 164 && n("stale") === 164 && t.node("jar").text.meta === "8 of 8 regulars in",
        "LRU: the archive read pushes yesterday's cards out, and the regulars come back with today's list");

      // 6. A 5-minute TTL caps it.
      t.click("reset");
      t.set("ttl", 300);
      await t.run(3);
      t.click("list");
      await t.run(26.9);
      a = n("stale");
      await t.run(0.3);
      t.expect(a === 4304 && n("stale") === 4320 && t.node("jar").text.meta === "8 of 8 regulars in",
        "5 min TTL: the regulars' cards, fetched at 03:57:00, run out at 04:02:00: 4,320 stale reads, then none");
      t.expect(n("hit") === 76,
        "5 min TTL: the eight regular cards expire together, 8 extra misses, so the last 10 s show 76%");

      // 7. A 1-second TTL.
      t.click("reset");
      t.set("ttl", 1);
      await t.run(3);
      t.expect(n("hit") === 40 && n("db") === 12 && n("wait") === 38,
        "1 s TTL: every other regular lookup misses: 40% hits, 12 a second at the database, 38 ms on average");

      // 8. A jar for every loaf.
      t.click("reset");
      t.set("size", 480);
      await t.run(3);
      t.expect(n("hit") === 100 && n("db") === 0 && n("wait") === 1,
        "480 cards: once every loaf we bake has a card, every lookup is a hit and the database rests");
      t.click("list");
      await t.run(1);
      t.expect(n("stale") === 200 && t.node("jar").text.meta === "80 stale cards",
        "480 cards: after the new list all 80 loaves we bake are stale, 20 stale reads a second");

      // 9. No jar at all.
      t.click("reset");
      t.click("jar");
      await t.run(1.5);
      t.expect(n("hit") === 0 && n("wait") === 60 && n("db") === 20 && t.node("db").state === "warn",
        "jar off: every lookup goes to the database, 20 a second at 60 ms, 80% of its limit");
      t.click("scan");
      await t.run(2);
      t.expect(n("db") === 30 && t.stat("wait") === "over limit",
        "jar off: the archive read adds its 10 a second, 30 in all, past the 25 the database manages");
    }
  });
})();
