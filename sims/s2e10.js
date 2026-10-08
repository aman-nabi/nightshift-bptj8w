/* sims/s2e10-v1.0.0.js  (published as sims/s2e10.js)
   Case s2e10 "Eviction Night": a Redis cache at its memory limit, drawn as Corbie House, a
   boarding house with forty beds. Aurek's booking app keeps its pages, every festival search and
   the year book (the year lodgers' records, no TTL, the only copies) in one Redis whose maxmemory
   holds forty keys. The learner picks the maxmemory-policy, maxmemory-samples, whether cache keys
   get a TTL and whether the year book lives in its own Redis, then watches the 21:00 festival bus
   fill the house.

   CHANGELOG
   v1.0.0 (2026-10-09) first version: one slot is one second from 20:59:50 to 21:06:00. Forty
     beds, one key each. Before the bus: 4 year-book records, 16 pages everyone reads, 10 old
     history pages. From 21:00:00, two new searches a second for five minutes, each looked at again
     3 seconds later. Policies: noeviction, allkeys-lru, allkeys-lfu, allkeys-random, volatile-lru,
     volatile-ttl. Sampling without replacement through api.rand(), with exact LRU's victim worked
     out beside every LRU eviction, and the same draws replayed for 1, 3, 5 and 10 samples. Controls:
     policy, samples (1 to 64), a 1-hour TTL on cache keys, the year book in its own Redis, skip one
     minute, skip to 21:06, 07:00 the next morning, replay, reset. Stats: beds used, hit ratio over
     the last 60 s, evicted_keys, writes refused, year-book records lost, evictions that picked exact
     LRU's victim. selfTest: 18 assertions.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e10-v1.0.0.json):
   - post: forty beds; Aurek counts Redis's memory in beds because every key is about the same
     size, and maxmemory holds forty. Before the bus thirty are taken: the year book (4 records, no
     TTL, the only copies), the 16 pages everyone reads (each once a second) and 10 old history
     pages (each about once a minute). Mr Pask's record was last read when he came in at half past
     eight (20:29:50 here). The festival bus at 21:00 brings six hundred people: two new searches a
     second for five minutes (600), each a new key, and every phone looks again 3 seconds later.
     The managed Redis came with volatile-lru and 3 samples (ElastiCache's defaults, cited in the
     case), and Aurek's code sets no TTLs.
   - Friday's log: 21:00:04 used_memory 40 of 40 beds; 21:00:05 SET search:11 refused with the OOM
     error; 21:03:00 hit ratio 80% over the last 60 s, evicted_keys 0; 21:05:02 1,180 writes
     refused since 21:00:05.
   - Saturday (allkeys-lru, 3 samples): evicted_keys 2 at 21:00:05, then two or three a second;
     the year book 0 of 4 by morning. "She opened three doors": 3 samples.
   - reply options: index 0 (allkeys-lfu): nothing refused, the year book gone (Mr Pask's count
     faded to 0), new searches start at 5 and many go before their second look. Index 1 (the year
     book in its own Redis, allkeys-lru, TTLs): the cache is full at 21:00:06, evicted_keys 2 at
     21:00:07, nothing refused, the door knows all 4. Index 2 (volatile-lru with a 1-hour TTL on
     cache keys): nothing refused and nothing lost; once the TTL falls out of the code, it is
     Friday again: 1,180 refused by 21:05:02. Index 3 (noeviction): 1,180 refused, the hit ratio
     100% before the bus and 80% while it unloads, the year book safe, the house full for good.
   - explain: exact LRU holds the hit ratio at 89% while the bus unloads; 3 samples pick exact
     LRU's own victim 3 times in 40 on average and a key from the older half 1 - C(20,3)/C(40,3) =
     1 - 1140/9880 = 88.5% of the time ("nearly 9 in 10").

   Teaching model (stated in sim.lede):
   - Slot n is the second starting at 20:59:50 + n. Each frame processes every slot that is due
     (floor of sim seconds), so results never depend on the frame rate. Within a slot, in order:
     the 16 page reads (page:1 to page:16), one history read when n is a multiple of 6
     (history:((n / 6) mod 10) + 1), the second looks at the 2 searches made at slot n - 3, then the
     2 new searches of slot n (slots 10 to 309: search:1 to search:600).
   - A read of a key in the cache is a hit; it moves the key's last use to now (a global counter
     seq, so no two keys tie) and updates its LFU count. Otherwise it is a miss: the booking app
     fetches from the house database and SETs a new key (cache-aside). A new key has LFU count 5
     and, with the TTL on, expires an hour after it is written. Year-book records are never read in
     the night and never SET by it.
   - A SET when 40 keys are in the cache needs a victim. noeviction: none. volatile-*: only keys
     with a TTL may go. allkeys-*: any key. None allowed: the write is refused (OOM) and counted.
     allkeys-random: one key at random. The sampled policies shuffle the allowed keys with a partial
     Fisher-Yates (api.rand()), take the first min(samples, allowed) as the sample, and turn out the
     best candidate in it: the oldest last use (LRU), the lowest LFU count then the oldest (LFU), the
     nearest expiry then the oldest (volatile-ttl). For LRU policies the shuffle runs at least 10
     deep, so the same draws also give the victims of 1, 3, 5 and 10 samples (prefixes of one
     shuffle), and exact LRU's victim is the allowed key with the oldest last use.
   - LFU: count now = max(0, stored - whole minutes since last use); a use sets it to count now + 1
     (at most 255). Redis starts new keys at 5 and takes one off per idle minute by default
     (redis.conf, lfu-decay-time 1); its increment slows as the count grows, which the sim leaves
     out. Starting counts: year book 1 (last read 20:29:50, so 0 by 21:00), pages 255, history 6.
   - Hit ratio: hits over reads in the last 60 slots (one bucket per slot, cleared at the start of
     its slot). Year-book reads happen only in the morning and are not counted.

   Derivations for the self-tests (plain arithmetic with the model above):
   - Fill: 30 keys before the bus; 2 new keys a slot from slot 10, so 40 at the end of slot 14
     (21:00:04), search:1 to search:10 stored. With the year book in its own Redis: 26 keys, full
     at the end of slot 16 (21:00:06) with search:1 to search:14.
   - Friday (volatile-lru, no TTLs) = noeviction = volatile-ttl without TTLs: nothing is ever
     allowed out, so nothing leaves and no page or history read ever misses. Refused SETs: slots
     15 to 17, the 2 new searches each (search:11 to search:16; the second looks at search:5 to
     search:10 hit): 6. Slots 18 to 309: 2 new plus 2 second looks at unstored searches: 4 a slot,
     292 slots, 1,168. Slots 310 to 312: the last second looks: 6. Total 1,180, the last at slot 312
     (21:05:02). By the end of slot 195: 6 + 178 x 4 = 718. Hit ratio for any 60 slots inside 18 to
     309: hits 960 page + 10 history = 970, misses 120 new + 120 second looks = 240, 970 / 1,210 =
     80.2%, shown 80. Before the bus (slots 0 to 9) every read hits: 100. evicted_keys stays 0.
   - Exact LRU (allkeys-lru, samples >= 40, so the sample is every key): the first SETs into a full
     house are at slot 15 (search:11, search:12) and slot 16 (search:13, search:14), and the four
     oldest keys are the year-book records (seq 1 to 4, never read): all 4 lost by the end of slot
     16 (21:00:06), evicted_keys 4, every victim exact. A page is never evicted: at any eviction in
     slot n the 16 pages were read first in that slot and at most 4 other keys are newer, so at
     least 20 keys are older. A second look always hits: between a search's SET at slot t and its
     second look at t + 3, at most 1 + 10 + 2 non-page keys and the 16 pages are newer than it (29),
     so 10 of the other 39 keys are older and it is never the oldest. A history page is evicted
     within 20 slots of its last read while the bus unloads: each eviction takes the oldest key,
     the keys older than it only shrink, and there are at least 2 evictions a slot. So for any 60
     slots ending between 119 and 309, every history read misses: hits 960 + 120 = 1,080, misses
     120 + 10 = 130, 1,080 / 1,210 = 89.3%, shown 89. (After 21:05:00 the bus is in and the ratio
     climbs again.)
   - Saturday (allkeys-lru, 3 samples): no eviction before slot 15; in slot 15 the page reads and
     the second looks at search:5 and search:6 hit, and search:11 and search:12 each turn out one
     key: evicted_keys 2 at 21:00:05, deterministic. After that the victims depend on api.rand().
     Every SET is allowed (allkeys), so nothing is refused; search:11 to search:600 are 590 SETs
     into a full house, so evicted_keys >= 590. A year-book record is the oldest key in the house,
     so it goes as soon as it is in a sample: it survives one eviction with chance 37/40 and the
     whole night with at most (37/40)^590, about 1e-20. Over the night the evictions number about
     700 (590 plus refetched pages, history pages and the odd second look).
   - Samples: with all 40 keys allowed, exact LRU's victim is in the sample with chance N / 40
     (3 samples: 7.5%, sd about 1% over 600+ evictions), and the sampled victim comes from the
     older half with chance 1 - C(20,N)/C(40,N) (3 samples: 88.5%). The 1, 3, 5 and 10 sample
     victims are prefixes of one shuffle, so each pick of exact LRU's victim by a smaller sample is
     also a pick by every larger one: the four counts never decrease, the actual 3-sample count
     equals the shadow 3-sample count, and 10 beats 1 unless no eviction ever had exact LRU's victim
     in positions 2 to 10 (chance about (31/40)^590). Hit ratio: 1 sample is random eviction, 16
     of 40 victims are pages, at least 0.8 page misses a slot, so 60 slots show well under 85%;
     10 samples miss a page only when all 10 keys come from the 20 newest (about 2 in 10,000), so
     the ratio stays at 89 (it would take 15 extra misses in 60 s to show 87).
   - allkeys-lfu: the year-book counts are 0 from 20:59:50 (1 - 30 idle minutes), the lowest in the
     house, and ties go to the oldest last use, which is theirs: they go as soon as they are sampled,
     like LRU. Nothing is refused. allkeys-random: each eviction takes a year-book record with
     chance 1/40, so two or more surviving 590+ evictions is about 6 x (39/40)^1180, under 1e-12.
   - volatile-lru with the TTL on: the year book has no TTL and is never allowed out (0 lost); 36
     cache keys always have one, so nothing is refused; the 590 SETs into a full house make
     evicted_keys >= 590.
   - Own Redis for the year book: 0 lost by construction; in slot 17 the second looks at search:9
     and search:10 hit and search:15 and search:16 each turn out one key: evicted_keys 2 at 21:00:07.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px,
   edge label 11px, group label 11px):
   - Left column, 200 wide at x 20 to 220: Booking app (y 41 to 103), House database (db shape,
     y 179 to 231), Year book (y 299 to 361), The street (y 419 to 481): gaps 76, 68 and 58px.
     Longest texts: "pages: source of truth" 22 chars, 158px; "own Redis, noeviction" 21 chars,
     151px; "refused at the door: 1,180" 26 chars meta, 172px.
   - Group "REDIS: MAXMEMORY IS 40 BEDS" from (270, 8), 455 x 392: its label (27 chars, 178px) sits
     at y 25, above the Redis node (y 41 to 103, x 292 to 702). Redis node sub
     "volatile-lru, 64 samples" 24 chars, 173px; meta "40 of 40 beds used, cache keys: 1 h TTL"
     39 chars, 257px.
   - Beds: 34 x 30, centers x 299 + 44k (k = 0 to 9), y 165, 235, 305, 375: 10px between beds in a
     row, 40px between rows, 47px below the Redis node. Labels at most 3 chars ("P16"), 23px.
   - Edges: "GET, SET" (53px) between the app (right x 220) and the Redis node (left x 292) at y 64;
     "on a miss" (59px) between the app (bottom y 103) and the database (top y 179).

   Catalog note: the case's concepts are the catalog's ids for s2e10 (cache-memory-limits,
   eviction-policies-in-depth).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 10;                              // sim seconds per real second
  var START_CLOCK = 20 * 3600 + 59 * 60 + 50;  // 20:59:50
  var CAP = 40;                                // maxmemory, in beds: one key each
  var YEAR = 4;                                // year-book records: no TTL, the only copies
  var HOT = 16;                                // the pages everyone reads, each once a second
  var COLD = 10;                               // old history pages
  var COLD_EVERY = 6;                          // one history read every 6 s: each once a minute
  var BUS = 10;                                // slot 10 is 21:00:00
  var BURST = 300;                             // five minutes of new searches
  var PER_SLOT = 2;                            // two new searches a second
  var REREAD = 3;                              // every phone looks again 3 s later
  var END = 370;                               // 21:06:00: the night's traffic is over
  var TTL = 3600;                              // the 1-hour TTL on cache keys, when it's on
  var WINDOW = 60;                             // hit ratio over the last 60 s
  var LFU_INIT = 5;                            // a new key's LFU count (redis.conf)
  var LFU_MAX = 255;
  var YEAR_LAST = -1800;                       // year-book records last read at 20:29:50
  var PAGES_WRITTEN = -600;                    // pages went in at 20:49:50 (sets their expiry)
  var SHADOWS = [1, 3, 5, 10];                 // sample sizes replayed on the same draws
  var MAX_SAMPLES = 64;                        // redis.conf: the maximum value is 64
  var MORNING = 7 * 3600;                      // 07:00 the next morning
  var EPS = 1e-6;
  var DOT_EVERY = 0.2;                         // real seconds between sample dots
  var DOT_SPEED = 320;                         // viewBox units per real second

  var POLICY_OPTS = [
    { value: "noeviction", label: "noeviction (Redis's own default)" },
    { value: "allkeys-lru", label: "allkeys-lru (Saturday)" },
    { value: "allkeys-lfu", label: "allkeys-lfu" },
    { value: "allkeys-random", label: "allkeys-random" },
    { value: "volatile-lru", label: "volatile-lru (Friday, the managed default)" },
    { value: "volatile-ttl", label: "volatile-ttl" }
  ];

  var YEAR_WHO = [
    "Mr Pask's record (room 1, paid by the year since 1979)",
    "the record of the year lodger in room 2",
    "the record of the year lodger in room 3",
    "the record of the year lodger in room 4"
  ];

  var BED_TONE = { year: "accent", hot: "ok", cold: "", search: "warn" };

  /* ---------- small helpers ---------- */

  // 1180 -> "1,180". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Sim second t (0 is 20:59:50) as a clock time: 3000 -> "21:49:50".
  function clockAt(t) {
    var s = (START_CLOCK + Math.floor(t)) % 86400;
    if (s < 0) s += 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }

  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function sumArr(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function say(api, msg, tone) { api.log(msg, tone || ""); }

  function isLru(p) { return p === "allkeys-lru" || p === "volatile-lru"; }
  function isSampled(p) { return p === "allkeys-lru" || p === "volatile-lru" || p === "allkeys-lfu" || p === "volatile-ttl"; }

  function policyText(S) {
    return S.policy + (isSampled(S.policy) ? ", " + S.samples + (S.samples === 1 ? " sample" : " samples") : "");
  }

  /* ---------- the diagram ---------- */

  function buildDiagram() {
    var nodes = [
      { id: "app", label: "Booking app", sub: "cache-aside", meta: "every search kept", x: 120, y: 72, w: 200, h: 62, shape: "box", tone: "" },
      { id: "db", label: "House database", sub: "pages: source of truth", x: 120, y: 205, w: 200, h: 52, shape: "db", tone: "" },
      { id: "yb", label: "Year book", sub: "in the cache, no TTL", meta: "4 of 4 records", x: 120, y: 330, w: 200, h: 62, shape: "box", tone: "accent" },
      { id: "street", label: "The street", sub: "turned out: 0", meta: "refused at the door: 0", x: 120, y: 450, w: 200, h: 62, shape: "box", tone: "muted" },
      { id: "redis", label: "Redis: the house", sub: "volatile-lru, 3 samples", meta: "30 of 40 beds used, no TTLs", x: 497, y: 72, w: 410, h: 62, shape: "box", tone: "" }
    ];
    for (var b = 0; b < CAP; b++) {
      nodes.push({ id: "b" + b, label: "-", x: 299 + 44 * (b % 10), y: 165 + 70 * Math.floor(b / 10), w: 34, h: 30, shape: "box", tone: "muted" });
    }
    return {
      type: "arch",
      w: 740,
      h: 495,
      aria: "Eviction sim for Corbie House. The booking app reads Redis first and fetches from the house database on a miss. Redis is drawn as the house: maxmemory holds 40 beds, one key each. Y beds are year-book records with no TTL, P beds the 16 pages everyone reads, H beds old history pages, and S beds festival searches. Keys Redis turns out, and writes it refuses, go to the street. The year book can also live in its own Redis.",
      groups: [{ label: "Redis: maxmemory is 40 beds", x: 270, y: 8, w: 455, h: 392 }],
      nodes: nodes,
      edges: [
        { from: "app", to: "redis", label: "GET, SET" },
        { from: "app", to: "db", label: "on a miss" }
      ]
    };
  }

  var DIAGRAM = buildDiagram();

  /* ---------- the keys ---------- */

  function put(S, id, kind, bed, lastT, cnt, writeT) {
    var e = {
      id: id, kind: kind, seq: ++S.seq, lastT: lastT, cnt: cnt,
      exp: (kind !== "year" && S.ttl) ? writeT + TTL : null, bed: bed
    };
    S.beds[bed] = e;
    S.map[id] = e;
    S.list.push(e);
    return e;
  }

  function takeOut(S, e) {
    S.beds[e.bed] = null;
    delete S.map[e.id];
    var i = S.list.indexOf(e);
    if (i >= 0) {
      S.list[i] = S.list[S.list.length - 1];
      S.list.pop();
    }
  }

  // Redis's LFU count as it stands at second n: one off for every whole idle minute.
  function lfuNow(e, n) {
    var c = e.cnt - Math.floor((n - e.lastT) / 60);
    return c > 0 ? c : 0;
  }

  function touch(S, e, n) {
    var c = lfuNow(e, n) + 1;
    e.cnt = c > LFU_MAX ? LFU_MAX : c;
    e.lastT = n;
    e.seq = ++S.seq;
  }

  /* ---------- choosing who goes ---------- */

  // True when key a should be turned out before key b under policy p.
  function goesFirst(p, a, b, n) {
    if (p === "allkeys-lfu") {
      var ca = lfuNow(a, n);
      var cb = lfuNow(b, n);
      if (ca !== cb) return ca < cb;
    } else if (p === "volatile-ttl") {
      if (a.exp !== b.exp) return a.exp < b.exp;
    }
    return a.seq < b.seq;
  }

  function victim(api, n) {
    var S = api.state;
    var p = S.policy;
    var i;
    if (p === "noeviction") return null;
    var c = [];
    for (i = 0; i < S.list.length; i++) {
      if (p.indexOf("volatile-") === 0 && S.list[i].exp === null) continue;
      c.push(S.list[i]);
    }
    var len = c.length;
    if (!len) return null;
    if (p === "allkeys-random") {
      var r = Math.floor(api.rand() * len);
      return c[r < len ? r : len - 1];
    }
    var lru = isLru(p);
    var N = Math.min(S.samples, len);
    var K = lru ? Math.min(len, Math.max(N, SHADOWS[SHADOWS.length - 1])) : N;
    for (i = 0; i < K; i++) {
      var j = i + Math.floor(api.rand() * (len - i));
      if (j >= len) j = len - 1;
      var tmp = c[i];
      c[i] = c[j];
      c[j] = tmp;
    }
    var v = c[0];
    for (i = 1; i < N; i++) if (goesFirst(p, c[i], v, n)) v = c[i];
    if (lru) {
      var exact = c[0];
      for (i = 1; i < len; i++) if (c[i].seq < exact.seq) exact = c[i];
      var older = 0;
      for (i = 0; i < len; i++) if (c[i].seq < v.seq) older += 1;
      S.lruEv += 1;
      if (v === exact) S.matchA += 1;
      if (older * 2 < len) S.olderHalf += 1;
      for (var s = 0; s < SHADOWS.length; s++) {
        var m = Math.min(SHADOWS[s], len);
        for (i = 0; i < m; i++) {
          if (c[i] === exact) { S.sh[s] += 1; break; }
        }
      }
    }
    return v;
  }

  function turnOut(api, v) {
    var S = api.state;
    takeOut(S, v);
    S.ev += 1;
    if (!S.loggedEvict) {
      S.loggedEvict = true;
      say(api, "The house is full, so " + S.policy + " turns a key out for every new one: evicted_keys starts to climb.", "warn");
    }
    if (v.kind === "year") {
      S.lost += 1;
      var room = Number(v.id.replace("year:room", ""));
      say(api, "Turned out: " + v.id + ", " + YEAR_WHO[room - 1] + ". It was the only copy, so nothing can fetch it back.", "bad");
    }
    if (!S.fast) queueDot(S, { from: "b" + v.bed, cls: v.kind === "year" ? "dot-bad" : "dot-wait" });
  }

  function refuse(api, id) {
    var S = api.state;
    S.err += 1;
    if (!S.loggedErr) {
      S.loggedErr = true;
      var why = S.policy === "noeviction" ? "noeviction never turns a key out." :
        S.policy + " may only turn out keys that have a TTL, and none of the " + S.list.length + " keys here has one.";
      say(api, "SET " + id + ": (error) OOM command not allowed when used memory > 'maxmemory'. " + why +
        " Reads still work, but every write that needs a bed is refused, and the booking page says: Sorry, we couldn't find you a bed.", "bad");
    }
    if (!S.fast) queueDot(S, { from: "app", cls: "dot-fail" });
  }

  /* ---------- reads and writes (cache-aside) ---------- */

  function store(api, id, kind, n) {
    var S = api.state;
    var bed;
    if (S.list.length >= CAP) {
      var v = victim(api, n);
      if (!v) { refuse(api, id); return; }
      bed = v.bed;
      turnOut(api, v);
    } else {
      bed = S.beds.indexOf(null);
    }
    put(S, id, kind, bed, n, LFU_INIT, n);
  }

  function read(api, id, kind, n) {
    var S = api.state;
    var w = n % WINDOW;
    S.wRead[w] += 1;
    var e = S.map[id];
    if (e) {
      S.wHit[w] += 1;
      touch(S, e, n);
      return;
    }
    store(api, id, kind, n);
  }

  /* ---------- one second of the night ---------- */

  function slot(api) {
    var S = api.state;
    var n = S.n;
    var i;
    api.clock = START_CLOCK + n;
    var w = n % WINDOW;
    S.wRead[w] = 0;
    S.wHit[w] = 0;
    if (n === BUS) {
      say(api, "The festival bus is in: two new searches a second for five minutes, and every phone looks again 3 seconds later. Each new search is a miss, fetched from the house database and SET as a new key.", "warn");
    }
    for (i = 0; i < HOT; i++) read(api, "page:" + (i + 1), "hot", n);
    if (n % COLD_EVERY === 0) read(api, "history:" + ((n / COLD_EVERY) % COLD + 1), "cold", n);
    if (n >= BUS + REREAD && n < BUS + BURST + REREAD) {
      var r0 = (n - BUS - REREAD) * PER_SLOT;
      for (i = 0; i < PER_SLOT; i++) read(api, "search:" + (r0 + i + 1), "search", n);
    }
    if (n >= BUS && n < BUS + BURST) {
      var k0 = (n - BUS) * PER_SLOT;
      for (i = 0; i < PER_SLOT; i++) read(api, "search:" + (k0 + i + 1), "search", n);
    }
    if (!S.loggedFull && S.list.length >= CAP) {
      S.loggedFull = true;
      say(api, "used_memory reaches maxmemory: 40 of 40 beds. From here every new key needs someone else's bed.", "warn");
    }
    S.n = n + 1;
    if (S.n >= END) endNight(api);
  }

  function endNight(api) {
    var S = api.state;
    if (S.ended) return;
    S.ended = true;
    S.t = END;
    api.speed = 0;
    api.clock = START_CLOCK + END;
    var msg = "The bus is all in, and the night's traffic is over. evicted_keys " + fmt(S.ev) +
      ", writes refused " + fmt(S.err) + ", year-book records lost " + S.lost + " of 4.";
    if (isLru(S.policy) && S.lruEv > 0) {
      msg += " Of the " + fmt(S.lruEv) + " evictions, " + fmt(S.matchA) + " picked exact LRU's victim (" +
        pct(S.matchA, S.lruEv) + "%), and " + fmt(S.olderHalf) + " picked a key from the older half of the house." +
        " With the same random draws, 1 sample would have picked exact LRU's victim " + fmt(S.sh[0]) +
        " times, 3 samples " + fmt(S.sh[1]) + ", 5 samples " + fmt(S.sh[2]) + ", and 10 samples " + fmt(S.sh[3]) + ".";
    }
    msg += " Press 07:00 to see the morning.";
    say(api, msg, S.lost ? "bad" : S.err ? "warn" : "ok");
    if (S.ctl) {
      S.ctl.morning.disable(false);
      S.ctl.min.disable(true);
      S.ctl.end.disable(true);
    }
  }

  function morning(api) {
    var S = api.state;
    if (!S.ended || S.morningDone) return;
    S.morningDone = true;
    api.clock = MORNING;
    if (S.own) {
      say(api, "The year lodgers come down. Their records live in their own Redis, set to noeviction, and nothing there was turned out: the door knows all 4 year lodgers.", "ok");
      draw(api);
      return;
    }
    var known = 0;
    var first = 0;
    for (var i = 0; i < YEAR; i++) {
      if (S.map["year:room" + (i + 1)]) known += 1;
      else if (!first) first = i + 1;
    }
    if (known === YEAR) {
      say(api, "The year lodgers come down, and every code opens the door: the door knows all 4 year lodgers.", "ok");
    } else {
      say(api, "The year lodgers come down. GET year:room" + first + " returns (nil). The door knows " + known +
        " of the 4 year lodgers. Their records were the only copies, so nothing can fetch them back.", "bad");
    }
    draw(api);
  }

  /* ---------- the night ---------- */

  function startNight(api, why) {
    var S = api.state;
    var i;
    S.n = 0;
    S.t = 0;
    S.seq = 0;
    S.map = {};
    S.list = [];
    S.beds = [];
    for (i = 0; i < CAP; i++) S.beds.push(null);
    S.ev = 0;
    S.err = 0;
    S.lost = 0;
    S.lruEv = 0;
    S.matchA = 0;
    S.olderHalf = 0;
    S.sh = zeros(SHADOWS.length);
    S.wRead = zeros(WINDOW);
    S.wHit = zeros(WINDOW);
    S.ended = false;
    S.morningDone = false;
    S.loggedFull = false;
    S.loggedErr = false;
    S.loggedEvict = false;
    S.fast = false;
    S.dotQ = [];
    S.dotClock = 0;
    api.speed = SPEED;
    api.clock = START_CLOCK;
    // Oldest first, so the last-use order is: year book, history pages, pages.
    if (!S.own) {
      for (i = 0; i < YEAR; i++) put(S, "year:room" + (i + 1), "year", i, YEAR_LAST, 1, YEAR_LAST);
    }
    for (i = 0; i < COLD; i++) put(S, "history:" + (i + 1), "cold", YEAR + HOT + i, COLD_EVERY * i - 60, 6, PAGES_WRITTEN);
    for (i = 0; i < HOT; i++) put(S, "page:" + (i + 1), "hot", YEAR + i, -1, LFU_MAX, PAGES_WRITTEN);
    if (S.ctl) {
      S.ctl.morning.disable(true);
      S.ctl.min.disable(false);
      S.ctl.end.disable(false);
    }
    var head = (why ? why + " " : "") + "20:59:50 at Corbie House. ";
    head += S.own ?
      "26 of 40 beds are taken: the 16 pages everyone reads and 10 old history pages. The year book lives in its own Redis." :
      "30 of 40 beds are taken: the 4 year-book records (no TTL, the only copies), the 16 pages everyone reads and 10 old history pages.";
    head += " maxmemory-policy is " + policyText(S) + ", and " + (S.ttl ? "every cache key has a 1-hour TTL." : "no key has a TTL.");
    say(api, head, "");
    draw(api);
  }

  function replay(api, what) { startNight(api, what + " The night replays from 20:59:50."); }

  /* ---------- controls ---------- */

  function setPolicy(api, v) {
    var o = pick(POLICY_OPTS, v);
    if (!o) return;
    api.state.policy = String(o.value);
    replay(api, "maxmemory-policy is now " + o.value + ".");
  }

  function setSamples(api, v) {
    var x = Math.round(Number(v));
    if (!(x >= 1)) x = 1;
    if (x > MAX_SAMPLES) x = MAX_SAMPLES;
    api.state.samples = x;
    replay(api, "maxmemory-samples is now " + x + (x >= CAP ? ": every sample holds the whole house, so this is exact LRU." : "."));
  }

  function setTtl(api, on) {
    api.state.ttl = !!on;
    replay(api, on ? "Every cache key now gets a 1-hour TTL. The year book still has none." : "Cache keys get no TTL, as in Aurek's code.");
  }

  function setOwn(api, on) {
    api.state.own = !!on;
    replay(api, on ? "The year book moves to its own Redis, set to noeviction." : "The year book is back in the cache.");
  }

  function skipTo(api, target) {
    var S = api.state;
    if (S.ended) return;
    var to = Math.min(target, END);
    var guard = 0;
    S.fast = true;
    while (S.n < to && !S.ended && guard < 1000) { slot(api); guard += 1; }
    S.fast = false;
    S.dotQ = [];
    S.t = S.n;
    api.clock = START_CLOCK + S.n;
    draw(api);
  }

  /* ---------- drawing ---------- */

  function bedLabel(e) {
    if (e.kind === "year") return "Y" + e.id.replace("year:room", "");
    if (e.kind === "hot") return "P" + e.id.replace("page:", "");
    if (e.kind === "cold") return "H" + e.id.replace("history:", "");
    return "S";
  }

  function draw(api) {
    var S = api.state;
    if (!S.list) return;
    var i;
    for (i = 0; i < CAP; i++) {
      var e = S.beds[i];
      var nd = api.node("b" + i);
      if (!e) {
        nd.text("label", "-");
        nd.set("muted");
      } else {
        nd.text("label", bedLabel(e));
        nd.set(BED_TONE[e.kind]);
      }
    }
    var used = S.list.length;

    var rd = api.node("redis");
    rd.text("sub", policyText(S));
    rd.text("meta", used + " of 40 beds used, " + (S.ttl ? "cache keys: 1 h TTL" : "no TTLs"));
    rd.set(used >= CAP ? (S.err > 0 ? "bad" : "warn") : "ok");

    var app = api.node("app");
    app.text("meta", S.err > 0 ? "writes refused: " + fmt(S.err) : "every search kept");
    app.set(S.err > 0 ? "bad" : "");

    var yb = api.node("yb");
    yb.text("sub", S.own ? "own Redis, noeviction" : "in the cache, no TTL");
    yb.text("meta", (S.own ? YEAR : YEAR - S.lost) + " of 4 records");
    yb.set(S.own ? "ok" : S.lost > 0 ? "bad" : "accent");

    var st = api.node("street");
    st.text("sub", "turned out: " + fmt(S.ev));
    st.text("meta", "refused at the door: " + fmt(S.err));
    st.set(S.lost > 0 || S.err > 0 ? "bad" : S.ev > 0 ? "warn" : "muted");

    var reads = sumArr(S.wRead);
    var hits = sumArr(S.wHit);
    S.stat.used(String(used));
    S.stat.hit(reads ? String(Math.round(100 * hits / reads)) : "-");
    S.stat.ev(String(S.ev));
    S.stat.err(String(S.err));
    S.stat.lost(String(S.lost));
    S.stat.match(isLru(S.policy) && S.lruEv > 0 ? String(pct(S.matchA, S.lruEv)) : "-");
  }

  /* ---------- dots: a visual sample of who leaves, never counted ---------- */

  function queueDot(S, d) { if (S.dotQ.length < 4) S.dotQ.push(d); }

  function dots(api, dt) {
    var S = api.state;
    if (api.reducedMotion || !S.dotQ || !S.dotQ.length) return;
    S.dotClock += dt;
    if (S.dotClock < DOT_EVERY) return;
    S.dotClock = 0;
    var d = S.dotQ.shift();
    api.dot({ path: [d.from, "street"], cls: d.cls, r: 4, speed: DOT_SPEED });
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.list) return;
    if (!S.ended) {
      S.t += dt * api.speed;
      var due = Math.floor(S.t + EPS);
      var guard = 0;
      while (S.n < due && !S.ended && guard < 400) { slot(api); guard += 1; }
      if (!S.ended) api.clock = START_CLOCK + S.t;
      draw(api);
    }
    dots(api, dt);
  }

  /* ---------- "what is this box" ---------- */

  function bedInfo(S, b) {
    var e = S.beds[b];
    if (!e) return "<strong>Bed " + (b + 1) + ".</strong> Empty: room for one more key before used_memory reaches maxmemory.";
    var what = e.kind === "year" ? "A year-book record: no TTL, read only when its lodger comes in, and the only copy anywhere" :
      e.kind === "hot" ? "One of the 16 pages everyone reads, once a second each" :
      e.kind === "cold" ? "An old history page, read about once a minute" :
      "A festival search, read when it's made and once more 3 seconds later";
    var idle = Math.max(0, S.n - e.lastT);
    return "<strong>Bed " + (b + 1) + ": " + e.id + ".</strong> " + what + ". Last used " + fmt(idle) +
      " s ago (the LRU policies turn out the key idle longest). LFU count " + lfuNow(e, S.n) +
      " (new keys start at 5, and one comes off for every idle minute). " +
      (e.exp === null ? "No TTL, so the volatile policies may never turn it out." : "TTL: expires at " + clockAt(e.exp) + ".");
  }

  var INFO = {
    app: function (S) {
      return "<strong>Booking app.</strong> Cache-aside: every read looks in Redis first, and a miss fetches from the house database and SETs a copy. A new search is always a miss. When Redis refuses a SET with an OOM error, this app shows an error page: Sorry, we couldn't find you a bed. Writes refused so far: " + fmt(S.err) + ".";
    },
    db: function () {
      return "<strong>House database.</strong> The source of truth for the pages and the searches, so anything of theirs that Redis turns out can be fetched again on the next miss. The year book isn't in it.";
    },
    yb: function (S) {
      return S.own ?
        "<strong>Year book.</strong> The 4 year lodgers' records, in their own Redis, set to noeviction. Nothing the festival does can turn them out." :
        "<strong>Year book.</strong> The 4 year lodgers' records: room, door code, paid until. They share the cache's 40 beds, have no TTL, are read only when their lodgers come in, and exist nowhere else. Lost so far: " + S.lost + " of 4.";
    },
    street: function (S) {
      return "<strong>The street.</strong> Where evicted keys go (evicted_keys: " + fmt(S.ev) + ") and where refused writes are left (" + fmt(S.err) + "). A page or a search turned out tonight comes back on its next miss. A year-book record can't.";
    },
    redis: function (S) {
      var p = S.policy;
      var how = p === "noeviction" ? "noeviction never turns a key out: when the house is full, every write that needs a bed is refused, and reads go on working." :
        p === "allkeys-lru" ? "allkeys-lru may turn out any key: it samples maxmemory-samples keys and turns out the one idle longest." :
        p === "allkeys-lfu" ? "allkeys-lfu may turn out any key: it samples maxmemory-samples keys and turns out the one with the lowest count." :
        p === "allkeys-random" ? "allkeys-random turns out one key at random, any key." :
        p === "volatile-lru" ? "volatile-lru may only turn out keys with a TTL: it samples among them and turns out the one idle longest. With no TTL keys, it refuses writes like noeviction." :
        "volatile-ttl may only turn out keys with a TTL: it samples among them and turns out the one closest to expiring, however often it is read.";
      return "<strong>Redis: the house.</strong> maxmemory holds 40 beds, one key each; " + S.list.length + " are used. " + how;
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s2e10", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.policy = "volatile-lru";
      S.samples = 3;
      S.ttl = false;
      S.own = false;
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.policy = api.control.select("policy", "maxmemory-policy", POLICY_OPTS, "volatile-lru", function (v) { setPolicy(api, v); });
      S.ctl.samples = api.control.range("samples", "maxmemory-samples", 1, MAX_SAMPLES, 1, 3, function (v) { setSamples(api, v); },
        { format: function (v) { return Number(v) >= CAP ? v + ": every key, exact LRU" : String(v); } });
      S.ctl.ttl = api.control.toggle("ttl", "Cache keys get a 1-hour TTL", false, function (on) { setTtl(api, on); });
      S.ctl.own = api.control.toggle("own", "Year book in its own Redis (noeviction)", false, function (on) { setOwn(api, on); });
      S.ctl.min = api.control.button("min", "Skip 1 minute", function () { skipTo(api, api.state.n + 60); });
      S.ctl.end = api.control.button("end", "Skip to 21:06, the end of the night", function () { skipTo(api, END); });
      S.ctl.morning = api.control.button("morning", "07:00: the year lodgers come down", function () { morning(api); }, { disabled: true });
      S.ctl.replay = api.control.button("replay", "Replay from 20:59:50", function () { replay(api, "Back to 20:59:50."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        used: api.stat("used", "beds used, of 40 (used_memory)", ""),
        hit: api.stat("hit", "hit ratio, last 60 s (%)", "ok"),
        ev: api.stat("ev", "evicted_keys", "warn"),
        err: api.stat("err", "writes refused (OOM)", "bad"),
        lost: api.stat("lost", "year-book records lost, of 4", "bad"),
        match: api.stat("match", "evictions that picked exact LRU's victim (%)", "")
      };

      api.onNodeClick(function (id) {
        var s = api.state;
        if (id.charAt(0) === "b" && id !== "b" && !isNaN(Number(id.slice(1)))) { api.info(bedInfo(s, Number(id.slice(1)))); return; }
        var f = INFO[id];
        if (f) api.info(f(s));
      });
      api.info("<strong>Tip:</strong> click any box, or any bed, to see what it does in plain words.");

      startNight(api, "");
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return t.stat(id); }
      // The numbers in the last log line that matches re, commas removed.
      function grab(re) {
        var text = t.logText();
        var g = new RegExp(re.source, "g");
        var m;
        var last = null;
        while ((m = g.exec(text)) !== null) last = m;
        if (!last) return null;
        var out = [];
        for (var i = 1; i < last.length; i++) out.push(Number(String(last[i]).replace(/,/g, "")));
        return out;
      }
      var a, s, sh, older;

      // 1. Friday: volatile-lru, no TTLs.
      await t.run(1.5);                                  // slots 0-14: up to 21:00:04
      t.expect(n("used") === 40 && n("err") === 0 && n("ev") === 0 && n("lost") === 0,
        "Friday: the house is full at 21:00:04, 40 of 40 beds, and nothing is refused or turned out yet");
      await t.run(0.1);                                  // slot 15: 21:00:05
      t.expect(n("err") === 2 && n("ev") === 0 &&
        t.logText().indexOf("SET search:11: (error) OOM command not allowed when used memory > 'maxmemory'.") >= 0,
        "Friday: at 21:00:05 the first two searches are refused with the OOM error, and nobody is turned out");
      t.click("min");
      t.click("min");
      t.click("min");                                    // slots 16-195
      t.expect(n("hit") === 80 && n("err") === 718 && n("ev") === 0 && n("lost") === 0,
        "Friday: while the bus unloads, 4 writes a second are refused and the hit ratio sits at 80%");
      t.click("end");
      t.expect(n("err") === 1180 && n("ev") === 0 && n("lost") === 0 && n("used") === 40,
        "Friday: 1,180 writes refused by 21:05:02, nobody turned out, the house full");

      // 2. noeviction and volatile-ttl without TTLs behave exactly like Friday.
      t.click("reset");
      t.set("policy", "noeviction");
      t.click("end");
      a = n("err");
      t.click("reset");
      t.set("policy", "volatile-ttl");
      t.click("end");
      t.expect(a === 1180 && n("err") === 1180 && n("ev") === 0 && n("lost") === 0,
        "noeviction, and volatile-ttl with no TTL keys, refuse the same 1,180 writes and turn nobody out");

      // 3. Exact LRU: allkeys-lru with every key in the sample.
      t.click("reset");
      t.set("policy", "allkeys-lru");
      t.set("samples", 40);
      await t.run(1.7);                                  // slots 0-16: up to 21:00:06
      t.expect(n("lost") === 4 && n("ev") === 4 && n("err") === 0 && n("match") === 100,
        "Exact LRU: the four year-book records are the first four keys turned out, at 21:00:05 and 21:00:06");
      t.click("min");
      t.click("min");
      t.click("min");
      t.click("min");                                    // slots 17-256
      t.expect(n("hit") === 89 && n("match") === 100 && n("err") === 0,
        "Exact LRU: while the bus unloads the hit ratio holds at 89%, and every victim is exact LRU's");

      // 4. Saturday: allkeys-lru with 3 samples.
      t.click("reset");
      t.set("policy", "allkeys-lru");
      await t.run(1.6);                                  // slots 0-15: up to 21:00:05
      t.expect(n("ev") === 2 && n("err") === 0,
        "Saturday: evicted_keys is 2 at 21:00:05, and nothing is refused");
      t.click("end");
      t.expect(n("lost") === 4 && n("err") === 0 && n("ev") >= 590,
        "Saturday: every write kept, at least 590 keys turned out, and the year book gone: 4 of 4");
      s = grab(/Of the ([0-9,]+) evictions, ([0-9,]+) picked exact LRU's victim/);
      older = grab(/, and ([0-9,]+) picked a key from the older half/);
      sh = grab(/1 sample would have picked exact LRU's victim ([0-9,]+) times, 3 samples ([0-9,]+), 5 samples ([0-9,]+), and 10 samples ([0-9,]+)/);
      t.expect(!!(s && sh) && s[1] === sh[1] && sh[0] <= sh[1] && sh[1] <= sh[2] && sh[2] <= sh[3] && sh[3] > sh[0],
        "Samples: on the same draws, more samples pick exact LRU's victim at least as often, and 10 beat 1");
      t.expect(!!(s && older) && s[1] / s[0] > 0.02 && s[1] / s[0] < 0.15 && older[0] / s[0] > 0.75 && n("match") < 100,
        "Samples: 3 samples pick exact LRU's own victim about 3 times in 40, but a key from the older half nearly 9 times in 10");
      t.click("morning");
      t.expect(t.logText().indexOf("The door knows 0 of the 4 year lodgers") >= 0,
        "Sunday 07:00: the door knows none of the year lodgers");

      // 5. More samples, closer to exact LRU's hit ratio.
      t.click("reset");
      t.set("policy", "allkeys-lru");
      t.set("samples", 1);
      t.click("min");
      t.click("min");
      t.click("min");
      t.click("min");                                    // slots 0-239
      a = n("hit");
      t.click("reset");
      t.set("policy", "allkeys-lru");
      t.set("samples", 10);
      t.click("min");
      t.click("min");
      t.click("min");
      t.click("min");                                    // slots 0-239
      t.expect(a < 85 && n("hit") >= 88,
        "Samples: 1 sample (random eviction) loses pages and drops the hit ratio well below exact LRU's 89%; 10 samples stay at it");

      // 6. volatile-lru with a TTL on every cache key.
      t.click("reset");
      t.set("ttl", true);
      t.click("end");
      t.expect(n("lost") === 0 && n("err") === 0 && n("ev") >= 590,
        "volatile-lru with 1-hour TTLs on cache keys: only cache keys are turned out, nothing is refused, the year book stays");

      // 7. The year book in its own Redis.
      t.click("reset");
      t.set("policy", "allkeys-lru");
      t.set("own", true);
      await t.run(1.8);                                  // slots 0-17: up to 21:00:07
      t.expect(n("used") === 40 && n("ev") === 2 && n("lost") === 0,
        "Own Redis for the year book: the cache fills at 21:00:06 and turns out its first two keys at 21:00:07");
      t.click("end");
      t.click("morning");
      t.expect(n("lost") === 0 && n("err") === 0 && t.logText().indexOf("the door knows all 4 year lodgers") >= 0,
        "Own Redis for the year book: nothing refused, and at 07:00 the door knows all 4 year lodgers");

      // 8. allkeys-lfu and allkeys-random still lose the year book.
      t.click("reset");
      t.set("policy", "allkeys-lfu");
      t.click("end");
      t.expect(n("lost") === 4 && n("err") === 0 && n("match") === "-",
        "allkeys-lfu: nothing refused, but the year book's counts have faded to 0, so it goes as soon as it is sampled");
      t.click("reset");
      t.set("policy", "allkeys-random");
      t.click("end");
      t.expect(n("lost") >= 3 && n("err") === 0 && n("match") === "-",
        "allkeys-random: any key may go, the year book too");
    }
  });
})();
