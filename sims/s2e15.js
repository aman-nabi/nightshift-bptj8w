/* sims/s2e15-v1.0.0.js  (published as sims/s2e15.js)
   Case s2e15 "Field Report: The Cache in Every Zone": Hushwell, a sleep-stories app, reads every
   listener's session from a cache in front of a listener database. The learner picks the cache (one
   cluster in zone A, as Teodor built it; nine nodes spread three to a zone by consistent hashing; or
   a full copy in every zone, as in Figure 3 of Netflix's 2013 EVCache post), switches zone A's power
   off and on, restarts zone B's cache nodes empty, and turns zone fallback on or off.

   CHANGELOG
   v1.0.0 (2026-10-10) first version: a night at Hushwell from 03:11:50, every cache warm. 7,200
     sessions, 3,600 check-ins a second spread evenly over the zones that are up, 240 place saves a
     second, a listener database that answers 1,000 reads a second. Controls: the cache (one cluster,
     spread nodes, a copy in every zone), zone A dark, zone fallback, a deploy that restarts zone B's
     cache nodes empty, replay, reset. Stats: hit ratio for each zone, database reads asked a second,
     check-ins failed a second, cache reads and copies crossing a zone a second, copies per save.
     selfTest: 21 assertions.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e15-v1.0.0.json):
   - post: about 7,200 people listening between two and four; each app checks in every 2 seconds:
     7,200 / 2 = 3,600 check-ins a second, over app servers in three availability zones, 1,200 to
     each; one memcached cluster of nine nodes, all in zone A; the listener database answers about
     1,000 reads a second; each app saves its place every 30 seconds: 7,200 / 30 = 240 saves a
     second, to the database and the cache. The log: cache-a hits 3,600 a second, 2,400 of them from
     zones B and C; with zone A dark, zones B and C take 1,800 check-ins a second each; the database
     asked 3,600, answered 1,000, timed out 2,600; zone A back at 04:31 with 0 keys.
   - Netflix's 2013 post (the evidence): Figure 3 is three clusters, A, B and C, of 3 EVCache servers
     each, one per availability zone; reads go to the client's zone, writes to every zone; with zone
     fallback, lost data is fetched from another zone's cluster. The sim's three nodes per zone in
     the spread and full-copy setups follow it. Every other number here is Hushwell's, a teaching
     value, not Netflix's.
   - comments: 2,400 of the 3,600 check-ins cross a zone today (OP's reply); each save becomes three
     writes, two of them crossing a zone, and zones B and C take 1,800 each with zone A dark
     (u/fan_out_valdis).
   - reply options. Index 0 (one bigger cluster in zone A): zone A lost: 0% in zones B and C, the
     database asked 3,600 reads a second, answering 1,000, 2,600 check-ins failing; 2,400 of 3,600
     still crossing before. Index 1 (spread): 2,560 crossing a second; zone A lost: 67%, 1,200
     asked, 1,000 answered, 200 failed, then 800, then 600, every session cached again after 3 s;
     zone A back: 2 s of 1,200 asked and 200 failed, then 2 s of 200. Index 2 (a copy in every zone
     and zone fallback): 720 copies a second, 480 crossing; cross-zone traffic 2,560 down to 480;
     21,600 stored sessions (3 x 7,200); zone A lost: 100% in B and C, database 0; zone A back: its
     misses go to zone B, 1,200 extra cross-zone reads a second, full in 6 s, database 0. Index 3 (a
     copy in every zone, misses to the database): zone A back: 1,200 asked, 1,000 answered, 200
     failed, each second for 6 s; 83% for 6 more; 12 s, 8,400 asked, 1,200 failed; 2,480 crossing a
     second at first. A deploy restarting zone B: the same 12 s.

   Teaching model (stated in sim.lede):
   - Time runs in 1-second slots. Slot n is processed when the sim clock passes n seconds since the
     replay, so results never depend on the frame rate.
   - Keys are the 7,200 listener sessions, 0 to 7,199. The 3,600 check-ins a second are spread
     evenly over the zones that are up: per = 3,600 / u, 1,200 with u = 3, 1,800 with u = 2. A sweep
     g starts at 0 and moves on by per each slot; zone z reads keys g + OFFSET[z] to
     g + OFFSET[z] + per - 1 (mod 7,200), OFFSET = 0, 2,400, 4,800. per is at most the 2,400 between
     offsets, so the zones never read the same key in one slot, and with three zones up each zone
     reads all 7,200 every 6 slots.
   - Where a check-in looks first:
     one: cache A, if zone A is up; with zone A dark there is no cluster at all.
     spread: the key's home node, zone k mod 3. With zone A dark, zone A's keys move to the next
       node on the ring: zone B if floor(k / 3) is even, zone C if odd. When zone A comes back its
       keys go home, and the copies zones B and C took over are dropped.
     every: the reader's own zone.
     A look in another zone counts one crossing. A key that is there is a hit.
   - Zone fallback (full-copy setup only): a miss at home asks the next zone that is up, A to B,
     B to C, C to A (one crossing); a hit there is copied home (same zone, no crossing).
   - Every other miss asks the database. It answers the first 1,000 a slot in this order: zone A's
     misses, then B's, then C's, each in key order; the rest fail. An answer is written to the cache:
     one: cache A (a crossing if the reader isn't in zone A); spread: the key's home node (a crossing
     if that's another zone); every: every zone that is up (a crossing for each other zone).
   - Place saves: 240 a second, spread like the check-ins, one write per copy. They go to place
     keys the check-ins don't read, so they cost writes and crossings but never change a session.
     Crossings a slot: one: 240 x (u - 1) / u if zone A is up, else 0 (no cache to write); spread:
     240 x (u - 1) / u; every: 240 x (u - 1). Copies per save: one 1 (0 with zone A dark), spread
     1, every u.
   - Hit ratio for a zone: first-look hits / reads in the last slot, rounded; dark when the zone is
     down. A fallback hit is not a first-look hit.
   - An event (zone A dark, zone A back, the deploy) starts a count: slots, database reads asked
     and failed, fallback hits and first-look misses since it. When every zone that is up holds what
     it should, the log gives the totals; if nothing missed, it says so.

   Derivations for the self-tests (all arithmetic with the model above):
   - one, warm: every zone hits 100%; crossings 2,400 (zones B and C read cache A) + 240 x 2 / 3 =
     2,560; copies per save 1. Zone A dark: B and C read 1,800 each with no cluster: 3,600 asked,
     1,000 answered (written nowhere), 2,600 failed; 0%; crossings 0; copies 0. Ten seconds later:
     36,000 asked, 26,000 failed.
   - every, warm: all hits; crossings 240 x 2 = 480; copies 3. Zone A dark: B and C hit 100%,
     crossings 240, copies 2, nothing missed.
   - every, no fallback, zone A back (or zone B restarted): the empty zone reads 1,200 new keys a
     slot, all missing: 1,200 asked, 1,000 answered and written to three zones (2,000 crossings),
     200 failed: crossings 2,480, hit 0%. After 6 slots it has read every key once and holds 6,000.
     Slots 7 to 12 re-read the same keys: 200 misses a slot, all answered: hit 1,000 / 1,200 = 83%,
     crossings 480 + 400 = 880. Full after slot 12: 6 x 1,200 + 6 x 200 = 8,400 asked, 1,200 failed.
   - every with fallback, zone B restarted (or zone A back): each of its 1,200 reads misses, asks the
     next zone (C, or B for zone A) and hits: crossings 1,200 + 480 = 1,680, database 0. Full after 6
     slots: 0 asked, 7,200 answered by another zone.
   - spread, warm: two keys in three live in another zone: crossings 2,400 + 160 = 2,560; copies 1.
     Zone A dark (g is always a multiple of 6, so the pattern below never depends on when): B and C
     read 1,800 each, 600 of them zone A's keys, all missing: hit 1,200 / 1,800 = 67% in both; 1,200
     asked, B's 600 and C's first 400 answered, 200 failed. Slot 2: B misses 200 (89%), C 600 (67%),
     800 asked, none failed. Slot 3: B misses 200 (89%), C 400 (78%), 600 asked. Every key cached
     again after 3 slots: 2,600 asked, 200 failed. Zone A back: each zone misses 400 of its 1,200
     (67%) for 2 slots, 1,200 asked and 200 failed each; then zone B misses 200 for 2 slots (83%).
     After 4 slots: 2,800 asked, 400 failed.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px, edge
   label 11px, group label 11px in capitals):
   - Groups Zone A, B, C: x 8, 252, 496, y 8, 236 square; labels at (x + 10, 25), 6 chars, 40px.
   - Caches (200 wide, 62 high, centers y 78, top 47, bottom 109): longest sub "7,200 of 7,200
     sessions" 23 chars, 166px; longest meta "9 nodes, the only cluster" 25 chars, 165px.
   - App servers (200 wide, 52 high, centers y 190, top 164, bottom 216): label "App servers A" 13
     chars, 101px; sub "1,200 check-ins/s" 17 chars, 122px.
   - Listener database (300 x 76, db shape, center 370, 330, top 292): label 17 chars, 133px; sub
     "answers 1,000 reads/s" 21 chars, 151px; meta "asked 3,600 reads/s" 19 chars, 125px.
   - Gaps: cache bottom 109 to app top 164 (55px); app bottom 216 to database top 292 (76px).
   - Edge labels: "reads first" (73px) near (126, 130), between cache A and app servers A; "on a miss"
     (59px) at 0.65 of app servers A to the database, near (257, 257), below the zone boxes (244).

   Catalog note: the case's concepts are the catalog's ids for s2e15 (evcache,
   memcached-based-cache-tier-run-as-a-shared-service, every-write-copied-to-each-availability-zone,
   consistent-hashing-to-spread-keys-across-nodes).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 1;                               // sim seconds per real second
  var START_CLOCK = 3 * 3600 + 11 * 60 + 50;   // 03:11:50
  var KEYS = 7200;                             // listener sessions
  var ZONES = 3;
  var CHECKINS = 3600;                         // check-ins a second: 7,200 every 2 s
  var SAVES = 240;                             // place saves a second: 7,200 every 30 s
  var DB_CAP = 1000;                           // reads a second the listener database answers
  var OFFSET = [0, 2400, 4800];                // where each zone's stretch of the sweep starts
  var EPS = 1e-6;
  var DOT_EVERY = 0.16;                        // real seconds between sample dots
  var DOT_SPEED = 300;                         // viewBox units per real second

  var NAMES = ["A", "B", "C"];
  var APP = ["appA", "appB", "appC"];
  var CACHE = ["cacheA", "cacheB", "cacheC"];

  var MODE_OPTS = [
    { value: "one", label: "One cluster, all nine nodes in zone A (as now)" },
    { value: "spread", label: "Nine nodes, three per zone, by consistent hashing" },
    { value: "every", label: "A full copy in every zone (Figure 3)" }
  ];

  /* ---------- small helpers ---------- */

  // 7200 -> "7,200". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function say(api, msg, tone) { api.log(msg, tone || ""); }

  function emptyZone() {
    var a = [];
    for (var i = 0; i < KEYS; i++) a.push(0);
    return a;
  }

  function upCount(S) {
    var u = 0;
    for (var z = 0; z < ZONES; z++) if (S.up[z]) u++;
    return u;
  }

  function upNames(S, but) {
    var list = [];
    for (var z = 0; z < ZONES; z++) if (S.up[z] && z !== but) list.push(NAMES[z]);
    if (list.length < 2) return "zone " + list.join("");
    return "zones " + list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 390,
    aria: "Zone-replicated cache sim for Hushwell, a sleep-stories app. Three availability zones, A, B and C, each with app servers and a cache. App servers in each zone take an even share of 3,600 check-ins a second and read each listener's session from the cache first; a miss goes to the listener database, which answers 1,000 reads a second. As things are, the only cache cluster is in zone A, and zones B and C read from it.",
    groups: [
      { label: "Zone A", x: 8, y: 8, w: 236, h: 236 },
      { label: "Zone B", x: 252, y: 8, w: 236, h: 236 },
      { label: "Zone C", x: 496, y: 8, w: 236, h: 236 }
    ],
    nodes: [
      { id: "cacheA", label: "Cache A", sub: "7,200 of 7,200 sessions", meta: "9 nodes, the only cluster", x: 126, y: 78, w: 200, h: 62, shape: "box", tone: "ok" },
      { id: "cacheB", label: "Cache B", sub: "no cluster in zone B", meta: "reads cross to zone A", x: 370, y: 78, w: 200, h: 62, shape: "box", tone: "muted" },
      { id: "cacheC", label: "Cache C", sub: "no cluster in zone C", meta: "reads cross to zone A", x: 614, y: 78, w: 200, h: 62, shape: "box", tone: "muted" },
      { id: "appA", label: "App servers A", sub: "1,200 check-ins/s", x: 126, y: 190, w: 200, h: 52, shape: "box", tone: "" },
      { id: "appB", label: "App servers B", sub: "1,200 check-ins/s", x: 370, y: 190, w: 200, h: 52, shape: "box", tone: "" },
      { id: "appC", label: "App servers C", sub: "1,200 check-ins/s", x: 614, y: 190, w: 200, h: 52, shape: "box", tone: "" },
      { id: "db", label: "Listener database", sub: "answers 1,000 reads/s", meta: "asked 0 reads/s", x: 370, y: 330, w: 300, h: 76, shape: "db", tone: "ok" }
    ],
    edges: [
      { from: "appA", to: "cacheA", label: "reads first" },
      { from: "appB", to: "cacheB" },
      { from: "appC", to: "cacheC" },
      { from: "appA", to: "db", label: "on a miss", at: 0.65 },
      { from: "appB", to: "db" },
      { from: "appC", to: "db" }
    ]
  };

  /* ---------- where things live ---------- */

  // A key's node in the spread setup. Zone A's keys move to B or C while zone A is dark.
  function home(S, k) {
    var h = k % 3;
    if (h === 0 && !S.up[0]) return Math.floor(k / 3) % 2 === 0 ? 1 : 2;
    return h;
  }

  // The cluster a check-in from zone z looks in first, or -1 when there is none.
  function firstLook(S, z, k) {
    if (S.mode === "one") return S.up[0] ? 0 : -1;
    if (S.mode === "spread") return home(S, k);
    return z;
  }

  // The next zone that is up after z: A to B, B to C, C to A.
  function nextUp(S, z) {
    for (var i = 1; i < ZONES; i++) {
      var y = (z + i) % ZONES;
      if (S.up[y]) return y;
    }
    return -1;
  }

  function put(S, z, k) {
    if (!S.has[z][k]) { S.has[z][k] = 1; S.count[z] += 1; }
  }

  function clearZone(S, z) {
    S.has[z] = emptyZone();
    S.count[z] = 0;
  }

  // Spread setup, zone A back: its keys go home, so the copies B and C took over are dropped.
  function dropOrphans(S) {
    for (var k = 0; k < KEYS; k += 3) {
      for (var z = 1; z < ZONES; z++) {
        if (S.has[z][k]) { S.has[z][k] = 0; S.count[z] -= 1; }
      }
    }
  }

  // How many sessions zone z's cache should hold when it is full.
  function expected(S, z) {
    if (!S.up[z]) return 0;
    if (S.mode === "one") return z === 0 ? KEYS : 0;
    if (S.mode === "spread") return S.up[0] ? KEYS / 3 : (z === 0 ? 0 : KEYS / 2);
    return KEYS;
  }

  function complete(S) {
    if (S.mode === "one" && !S.up[0]) return false;
    for (var z = 0; z < ZONES; z++) if (S.up[z] && S.count[z] < expected(S, z)) return false;
    return true;
  }

  // A database answer goes into the cache. Returns the copies that crossed a zone.
  function fillOnAnswer(S, z, k) {
    if (S.mode === "one") {
      if (!S.up[0]) return 0;
      put(S, 0, k);
      return z !== 0 ? 1 : 0;
    }
    if (S.mode === "spread") {
      var h = home(S, k);
      put(S, h, k);
      return h !== z ? 1 : 0;
    }
    var cross = 0;
    for (var y = 0; y < ZONES; y++) {
      if (!S.up[y]) continue;
      put(S, y, k);
      if (y !== z) cross += 1;
    }
    return cross;
  }

  function savesCross(S, u) {
    if (S.mode === "one") return S.up[0] ? SAVES * (u - 1) / u : 0;
    if (S.mode === "spread") return SAVES * (u - 1) / u;
    return SAVES * (u - 1);
  }

  function copiesPerSave(S) {
    if (S.mode === "one") return S.up[0] ? 1 : 0;
    if (S.mode === "spread") return 1;
    return upCount(S);
  }

  /* ---------- one second ---------- */

  function slot(api) {
    var S = api.state;
    var u = upCount(S);
    var per = CHECKINS / u;
    var useFallback = S.mode === "every" && S.fallback;
    var reads = [0, 0, 0], hits = [0, 0, 0], mix = [];
    var missZ = [], missK = [];
    var cross = 0, fbHits = 0, firstMiss = 0;
    var z, i, k;

    for (z = 0; z < ZONES; z++) {
      var m = { local: 0, cross: 0, crossTo: -1, fb: 0, fbTo: -1, db: 0, fail: 0 };
      mix.push(m);
      if (!S.up[z]) continue;
      reads[z] = per;
      var base = S.g + OFFSET[z];
      var f = useFallback ? nextUp(S, z) : -1;
      for (i = 0; i < per; i++) {
        k = (base + i) % KEYS;
        var first = firstLook(S, z, k);
        if (first >= 0) {
          if (first !== z) cross += 1;
          if (S.has[first][k]) {
            hits[z] += 1;
            if (first === z) m.local += 1; else { m.cross += 1; m.crossTo = first; }
            continue;
          }
        }
        firstMiss += 1;
        if (f >= 0) {
          cross += 1;
          if (S.has[f][k]) {
            fbHits += 1;
            m.fb += 1;
            m.fbTo = f;
            put(S, z, k);
            continue;
          }
        }
        missZ.push(z);
        missK.push(k);
      }
    }

    // The database answers the first 1,000: zone A's misses first, then B's, then C's.
    var asked = missZ.length, answered = 0, failed = 0;
    for (i = 0; i < missZ.length; i++) {
      z = missZ[i];
      if (answered < DB_CAP) {
        answered += 1;
        mix[z].db += 1;
        cross += fillOnAnswer(S, z, missK[i]);
      } else {
        failed += 1;
        mix[z].fail += 1;
      }
    }
    cross += savesCross(S, u);

    S.g = (S.g + per) % KEYS;
    S.n += 1;
    S.last = { reads: reads, hits: hits, asked: asked, failed: failed, cross: Math.round(cross), mix: mix };

    var ev = S.ev;
    if (ev && !ev.done) {
      ev.slots += 1;
      ev.asked += asked;
      ev.failed += failed;
      ev.fb += fbHits;
      ev.misses += firstMiss;
    }
    narrate(api, asked, failed);
  }

  /* ---------- narration ---------- */

  function narrate(api, asked, failed) {
    var S = api.state;
    var ev = S.ev;
    if (!ev || ev.done) return;

    if (!ev.overLogged && asked > DB_CAP) {
      ev.overLogged = true;
      say(api, "The database is asked " + fmt(asked) + " reads this second and answers " + fmt(DB_CAP) + ": " +
        fmt(failed) + " check-ins fail.", "bad");
    }

    if (S.mode === "one" && !S.up[0] && ev.name === "zone A went dark" && ev.slots === 10) {
      say(api, "Ten seconds since zone A went dark. Zones B and C are up and pass every health check, and their hit ratio is 0%: the only cluster was in zone A. The database has been asked " +
        fmt(ev.asked) + " reads, and " + fmt(ev.failed) + " check-ins have failed. Changing the cache replays the night.", "bad");
    }

    if (complete(S)) {
      ev.done = true;
      if (ev.misses === 0) {
        say(api, "No zone missed a session after " + ev.name + ": " + upNames(S, -1) +
          (S.mode === "every" ? " each hold a full copy of all 7,200 sessions." : " still hold every session they had.") +
          " The database was asked 0 reads.", "ok");
      } else {
        say(api, "Every session is cached again " + ev.slots + (ev.slots === 1 ? " second" : " seconds") + " after " + ev.name +
          ". The database was asked " + fmt(ev.asked) + " reads (" + fmt(ev.failed) + " failed), and " + fmt(ev.fb) +
          " were answered by another zone.", ev.failed ? "warn" : "ok");
      }
    }
  }

  function newEvent(S, name) {
    S.ev = { name: name, slots: 0, asked: 0, failed: 0, fb: 0, misses: 0, done: false, overLogged: false };
  }

  function headText(S) {
    var s = "03:11:50 at Hushwell, every cache warm. ";
    if (S.mode === "one") {
      return s + "One cluster of nine nodes in zone A holds all 7,200 sessions: every save is one copy, and 2,400 of the 3,600 check-ins a second cross into zone A to read it.";
    }
    if (S.mode === "spread") {
      return s + "Nine nodes, three in each zone, and consistent hashing gives each zone's nodes a third of the 7,200 sessions. Every save is still one copy, and 2,400 of the 3,600 check-ins a second cross a zone to reach their key's node.";
    }
    return s + "Each zone's three nodes hold a full copy of all 7,200 sessions, and each zone reads its own: 240 saves a second become 720 copies, 480 of them crossing a zone.";
  }

  /* ---------- the night ---------- */

  function startNight(api, why) {
    var S = api.state;
    S.t = 0;
    S.n = 0;
    S.g = 0;
    api.clock = START_CLOCK;
    S.up = [true, true, true];
    S.has = [emptyZone(), emptyZone(), emptyZone()];
    S.count = [0, 0, 0];
    for (var k = 0; k < KEYS; k++) {
      if (S.mode === "one") put(S, 0, k);
      else if (S.mode === "spread") put(S, k % 3, k);
      else { put(S, 0, k); put(S, 1, k); put(S, 2, k); }
    }
    S.ev = null;
    S.last = null;
    S.dotClock = 0;
    S.dotTurn = 0;
    S.dotSeq = 0;
    if (S.ctl && S.ctl.dark) S.ctl.dark.set(false);
    say(api, (why ? why + " " : "") + headText(S), "");
    draw(api);
  }

  /* ---------- controls ---------- */

  function setMode(api, v) {
    var o = pick(MODE_OPTS, v);
    if (!o) return;
    api.state.mode = String(o.value);
    startNight(api, "The cache changes, and the night replays.");
  }

  function setDark(api, on) {
    var S = api.state;
    var u = upCount(S);
    if (on && !S.up[0]) return;
    if (!on && S.up[0]) return;
    var msg;
    if (on) {
      // Told from the state before the power goes: what zone A held, what the others will take.
      var held = S.count[0];
      var each = fmt(CHECKINS / (u - 1));
      if (S.mode === "one") {
        msg = "Zone A goes dark: its app servers and its 9 cache nodes lose power. The cluster held " +
          (held === KEYS ? "all 7,200 sessions" : fmt(held) + " of the 7,200 sessions") +
          ", the only copy for every zone. Zones B and C take " + each + " check-ins a second each.";
      } else if (S.mode === "spread") {
        msg = "Zone A goes dark: its app servers and 3 of the 9 cache nodes lose power, with the " + fmt(held) +
          " sessions they held. Consistent hashing moves zone A's keys to the nodes in zones B and C, which don't have them yet. Zones B and C take " +
          each + " check-ins a second each.";
      } else {
        msg = "Zone A goes dark: its app servers and its 3 cache nodes lose power, with the " + fmt(held) +
          " sessions they held. Zones B and C each hold their own copy and take " + each + " check-ins a second each.";
      }
      say(api, msg, "bad");
      S.up[0] = false;
      clearZone(S, 0);
      newEvent(S, "zone A went dark");
    } else {
      msg = "Zone A comes back: power returns, and its app servers take " + fmt(CHECKINS / (u + 1)) +
        " check-ins a second again. Its cache nodes start empty, 0 of 7,200 sessions";
      if (S.mode === "one") msg += ", and every zone reads from them.";
      else if (S.mode === "spread") msg += ", and consistent hashing gives zone A's third of the keys back to them. The copies zones B and C took over are dropped.";
      else if (S.fallback) msg += ", and on a miss zone A asks zone B before the database.";
      else msg += ", and every miss in zone A goes to the database.";
      say(api, msg, "warn");
      S.up[0] = true;
      if (S.mode === "spread") dropOrphans(S);
      newEvent(S, "zone A came back");
    }
    draw(api);
  }

  function setFallback(api, on) {
    var S = api.state;
    S.fallback = !!on;
    var msg = on ? "Zone fallback on: a miss asks the next zone, A to B, B to C, C to A, before the database, and copies what it finds home." :
      "Zone fallback off: every miss goes to the database.";
    if (S.mode !== "every") msg += " It only matters with a full copy in every zone; this setup has no second copy to ask.";
    say(api, msg, "");
    draw(api);
  }

  function restartB(api) {
    var S = api.state;
    if (S.mode === "one") return;
    var held = S.count[1];   // before the restart
    var tail;
    if (S.mode === "every") {
      tail = S.fallback ? " On a miss, zone B asks zone " + NAMES[nextUp(S, 1)] + " before the database." :
        " Every miss in zone B goes to the database.";
    } else {
      tail = " Consistent hashing still sends zone B's keys to them, so every check-in for one of those keys goes to the database.";
    }
    say(api, "A deploy restarts zone B's cache nodes. They held " + fmt(held) + " sessions, and they come back empty." + tail, "warn");
    clearZone(S, 1);
    newEvent(S, "a deploy restarted zone B's cache nodes");
    draw(api);
  }

  /* ---------- drawing ---------- */

  function cacheText(S, z) {
    if (!S.up[z]) return { sub: "dark: no power", meta: "0 sessions", state: "bad" };
    if (S.mode === "one" && z !== 0) {
      return { sub: "no cluster in zone " + NAMES[z], meta: S.up[0] ? "reads cross to zone A" : "nothing to read", state: "muted" };
    }
    var exp = expected(S, z);
    var c = S.count[z];
    var sub = S.mode === "spread" ? fmt(c) + " sessions" : fmt(c) + " of 7,200 sessions";
    var meta = S.mode === "one" ? "9 nodes, the only cluster" : S.mode === "spread" ? "3 nodes, keys by hashing" : "3 nodes, a full copy";
    return { sub: sub, meta: meta, state: c >= exp ? "ok" : c === 0 ? "bad" : "warn" };
  }

  function hitText(S, z) {
    if (!S.up[z]) return "dark";
    if (!S.last || !S.last.reads[z]) return "-";
    return String(Math.round(100 * S.last.hits[z] / S.last.reads[z]));
  }

  function draw(api) {
    var S = api.state;
    var per = CHECKINS / upCount(S);
    var z;
    for (z = 0; z < ZONES; z++) {
      var app = api.node(APP[z]);
      app.text("sub", S.up[z] ? fmt(per) + " check-ins/s" : "dark: no power");
      app.set(S.up[z] ? "" : "bad");
      var ct = cacheText(S, z);
      var c = api.node(CACHE[z]);
      c.text("sub", ct.sub);
      c.text("meta", ct.meta);
      c.set(ct.state);
      api.edge(APP[z], CACHE[z]).set(!S.up[z] || (S.mode === "one" && z !== 0) ? "cut" : "");
      api.edge(APP[z], "db").set(S.up[z] ? "" : "cut");
    }
    var asked = S.last ? S.last.asked : 0;
    var db = api.node("db");
    db.text("meta", "asked " + fmt(asked) + " reads/s");
    db.set(asked > DB_CAP ? "bad" : asked > 0 ? "warn" : "ok");

    for (z = 0; z < ZONES; z++) S.stat.hit[z](hitText(S, z));
    S.stat.db(S.last ? fmt(S.last.asked) : "-");
    S.stat.fail(S.last ? fmt(S.last.failed) : "-");
    S.stat.cross(S.last ? fmt(S.last.cross) : "-");
    S.stat.fan(String(copiesPerSave(S)));
    S.ctl.cold.disable(S.mode === "one");
  }

  /* ---------- dots: a visual sample of the last second, never counted ---------- */

  function turnOnArrive(at, cls) {
    return function (dot, wp) { if (dot && wp === at) dot.cls(cls); };
  }

  function dots(api, dt) {
    var S = api.state;
    if (api.reducedMotion || !S.last) return;
    S.dotClock += dt;
    if (S.dotClock < DOT_EVERY) return;
    S.dotClock = 0;
    S.dotTurn = (S.dotTurn + 1) % ZONES;
    var z = S.dotTurn;
    if (!S.up[z]) return;
    var m = S.last.mix[z];
    var tot = m.local + m.cross + m.fb + m.db + m.fail;
    if (!tot) return;
    S.dotSeq = (S.dotSeq + 1) % 10;
    var x = (S.dotSeq + 0.5) * tot / 10;
    var app = APP[z];
    var base = { cls: "dot-req", r: 4, speed: DOT_SPEED };
    function go(path, onArrive) {
      api.dot({ path: path, cls: base.cls, r: base.r, speed: base.speed, onArrive: onArrive });
    }
    if (x < m.local) { go([app, CACHE[z]], turnOnArrive(CACHE[z], "dot-ok")); return; }
    x -= m.local;
    if (x < m.cross) {
      if (m.crossTo >= 0) go([app, CACHE[m.crossTo]], turnOnArrive(CACHE[m.crossTo], "dot-ok"));
      return;
    }
    x -= m.cross;
    if (x < m.fb) {
      if (m.fbTo >= 0) {
        var home0 = CACHE[z], away = CACHE[m.fbTo];
        go([app, home0, away], function (dot, wp) {
          if (!dot) return;
          if (wp === home0) dot.cls("dot-wait");
          if (wp === away) dot.cls("dot-accent");
        });
      }
      return;
    }
    x -= m.fb;
    if (x < m.db) { go([app, "db"], turnOnArrive("db", "dot-wait")); return; }
    go([app, "db"], turnOnArrive("db", "dot-fail"));
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.has) return;
    S.t += dt * api.speed;
    var due = Math.floor(S.t + EPS);
    var guard = 0;
    while (S.n < due && guard < 600) { slot(api); guard += 1; }
    draw(api);
    dots(api, dt);
  }

  /* ---------- "what is this box" ---------- */

  function appInfo(S, z) {
    var s = "<strong>App servers, zone " + NAMES[z] + ".</strong> Hushwell's app servers in zone " + NAMES[z] +
      ". The 3,600 check-ins a second are spread evenly over the zones that are up: 1,200 to each of three, 1,800 to each of two. Each check-in reads one listener's session, from the cache first. Every 30 seconds each app also saves its place: 240 saves a second in all, one write for every copy of the cache. ";
    if (!S.up[z]) return s + "Right now zone " + NAMES[z] + " is dark: no power.";
    return s + "Right now: " + fmt(CHECKINS / upCount(S)) + " check-ins a second.";
  }

  function cacheInfo(S, z) {
    var nm = NAMES[z];
    var s = "<strong>Cache " + nm + ".</strong> ";
    if (!S.up[z]) return s + "Zone " + nm + " is dark: its cache nodes have no power and hold nothing. When the power returns they start empty.";
    if (S.mode === "one") {
      if (z !== 0) return s + "There is no cache cluster in zone " + nm + " in this setup. Zone " + nm + "'s check-ins cross into zone A to read cache A.";
      return s + "Teodor's cluster: nine memcached nodes, all in zone A, the only copy of every session. Every zone's check-ins read from it, so two thirds of them cross a zone. Right now it holds " +
        fmt(S.count[0]) + " of 7,200 sessions.";
    }
    if (S.mode === "spread") {
      return s + "Three of the nine nodes. Consistent hashing gives every key one node, so zone " + nm +
        "'s nodes hold their share of the sessions and nothing else; a check-in whose key lives in another zone crosses to read it. While zone A is dark, its keys move to the nodes in zones B and C, which start without them. Right now it holds " +
        fmt(S.count[z]) + " sessions.";
    }
    return s + "Three nodes holding a full copy of all 7,200 sessions. Every save is written here and to the other zones' copies, and zone " + nm +
      "'s check-ins read only this copy. " + (S.fallback ? "Zone fallback is on: a miss here asks the next zone that is up before the database, and copies what it finds home. " :
      "Zone fallback is off: a miss here goes to the database. ") + "Right now it holds " + fmt(S.count[z]) + " of 7,200 sessions.";
  }

  var INFO = {
    appA: function (S) { return appInfo(S, 0); },
    appB: function (S) { return appInfo(S, 1); },
    appC: function (S) { return appInfo(S, 2); },
    cacheA: function (S) { return cacheInfo(S, 0); },
    cacheB: function (S) { return cacheInfo(S, 1); },
    cacheC: function (S) { return cacheInfo(S, 2); },
    db: function (S) {
      return "<strong>Listener database.</strong> The source of truth for every listener's session and place. It answers about 1,000 reads a second. In the sim it answers the first 1,000 misses each second, zone A's first, then zone B's, then zone C's, and the check-ins behind the rest fail. Saves are written here too; the sim doesn't count them against its reads. Right now it's asked " +
        fmt(S.last ? S.last.asked : 0) + " reads a second.";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s2e15", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.mode = "one";
      S.fallback = false;
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.mode = api.control.select("mode", "The cache", MODE_OPTS, "one", function (v) { setMode(api, v); });
      S.ctl.dark = api.control.toggle("dark", "Zone A dark (power lost)", false, function (on) { setDark(api, on); });
      S.ctl.fallback = api.control.toggle("fallback", "Zone fallback: on a miss, ask the next zone first", false, function (on) { setFallback(api, on); });
      S.ctl.cold = api.control.button("cold", "Deploy: restart zone B's cache nodes empty", function () { restartB(api); }, { tone: "danger" });
      S.ctl.replay = api.control.button("replay", "Replay from 03:11:50", function () { startNight(api, "Back to 03:11:50."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        hit: [
          api.stat("hitA", "zone A hit ratio, %", "ok"),
          api.stat("hitB", "zone B hit ratio, %", "ok"),
          api.stat("hitC", "zone C hit ratio, %", "ok")
        ],
        db: api.stat("db", "database asked, reads/s (answers 1,000)", ""),
        fail: api.stat("fail", "check-ins failed/s", "bad"),
        cross: api.stat("cross", "cache reads and copies crossing a zone/s", "warn"),
        fan: api.stat("fan", "copies per save", "")
      };

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startNight(api, "");
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return t.stat(id); }
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. As things are: one cluster of nine nodes in zone A, every cache warm.
      await t.run(1);
      t.expect(n("hitA") === 100 && n("hitB") === 100 && n("hitC") === 100 && n("db") === 0 && n("fail") === 0 &&
        n("fan") === 1 && n("cross") === "2,560",
        "One cluster in zone A: every zone hits, one copy per save, and 2,560 cache reads and copies a second cross a zone");

      // 2. Zone A goes dark: the only cluster goes with it.
      t.click("dark");
      t.expect(has("Zone A goes dark: its app servers and its 9 cache nodes lose power. The cluster held all 7,200 sessions, the only copy for every zone. Zones B and C take 1,800 check-ins a second each."),
        "Zone A dark: the log counts what the cluster held before the power went");
      await t.run(1);
      t.expect(n("hitA") === "dark" && n("hitB") === 0 && n("hitC") === 0 && n("db") === "3,600" && n("fail") === "2,600" &&
        n("cross") === 0 && n("fan") === 0 && t.node("db").state === "bad",
        "One cluster, zone A dark: zones B and C hit 0%, the database is asked 3,600 reads a second and 2,600 check-ins fail");
      t.expect(has("The database is asked 3,600 reads this second and answers 1,000: 2,600 check-ins fail."),
        "One cluster, zone A dark: the log gives the database's first second");
      await t.run(9);
      t.expect(has("Ten seconds since zone A went dark.") && has("has been asked 36,000 reads, and 26,000 check-ins have failed") &&
        n("hitB") === 0 && n("fail") === "2,600",
        "One cluster, zone A dark: ten seconds on, nothing has recovered");

      // 3. A full copy in every zone.
      t.set("mode", "every");
      await t.run(1);
      t.expect(n("hitA") === 100 && n("hitB") === 100 && n("hitC") === 100 && n("fan") === 3 && n("cross") === 480 && n("db") === 0 &&
        has("240 saves a second become 720 copies, 480 of them crossing a zone"),
        "A copy in every zone: 3 copies per save, and only 480 a second cross a zone");
      t.click("dark");
      await t.run(1);
      t.expect(n("hitA") === "dark" && n("hitB") === 100 && n("hitC") === 100 && n("db") === 0 && n("fan") === 2 && n("cross") === 240 &&
        has("No zone missed a session after zone A went dark: zones B and C each hold a full copy of all 7,200 sessions."),
        "A copy in every zone, zone A dark: zones B and C keep 100% and the database is asked nothing");

      // 4. Zone A comes back empty with fallback off: every miss goes to the database.
      t.click("dark");
      await t.run(1);
      t.expect(n("hitA") === 0 && n("db") === "1,200" && n("fail") === 200 && n("cross") === "2,480" && n("fan") === 3,
        "No fallback, zone A back: 1,200 database reads a second, 200 check-ins fail, 2,480 crossing a zone");
      await t.run(6);
      t.expect(n("hitA") === 83 && n("db") === 200 && n("fail") === 0 && n("cross") === 880,
        "No fallback, zone A back: from the seventh second zone A hits 83% and the database gets the 200 that failed");
      await t.run(5);
      t.expect(has("Every session is cached again 12 seconds after zone A came back. The database was asked 8,400 reads (1,200 failed), and 0 were answered by another zone."),
        "No fallback, zone A back: 12 seconds, 8,400 database reads, 1,200 failed");

      // 5. Zone fallback: an empty copy fills from its neighbour.
      t.click("fallback");
      t.click("cold");
      await t.run(1);
      t.expect(n("hitB") === 0 && n("hitA") === 100 && n("db") === 0 && n("fail") === 0 && n("cross") === "1,680",
        "Fallback, zone B restarted: zone B misses at home, asks zone C, and the database is asked nothing");
      await t.run(5);
      t.expect(has("Every session is cached again 6 seconds after a deploy restarted zone B's cache nodes. The database was asked 0 reads (0 failed), and 7,200 were answered by another zone."),
        "Fallback, zone B restarted: full again in 6 seconds, all 7,200 from zone C");
      await t.run(1);
      t.expect(n("hitB") === 100 && n("cross") === 480 && n("db") === 0,
        "Fallback, zone B restarted: back to 100% and 480 crossing a second");
      t.click("dark");
      await t.run(1);
      t.click("dark");
      await t.run(6);
      t.expect(has("Every session is cached again 6 seconds after zone A came back. The database was asked 0 reads (0 failed), and 7,200 were answered by another zone."),
        "Fallback, zone A back: it fills from zone B in 6 seconds, and the database is asked nothing");

      // 6. Nine nodes spread over the zones.
      t.set("mode", "spread");
      await t.run(1);
      t.expect(n("cross") === "2,560" && n("fan") === 1 && n("hitA") === 100 && n("db") === 0,
        "Spread nodes: one copy per save, and still 2,560 crossing a zone a second");
      t.click("dark");
      await t.run(1);
      t.expect(n("db") === "1,200" && n("fail") === 200 && n("hitB") === 67 && n("hitC") === 67 && n("fan") === 1,
        "Spread nodes, zone A dark: 67% in zones B and C, 1,200 database reads, 200 failed");
      await t.run(1);
      t.expect(n("db") === 800 && n("fail") === 0 && n("hitB") === 89 && n("hitC") === 67,
        "Spread nodes, zone A dark: then 800 database reads");
      await t.run(1);
      t.expect(n("db") === 600 && n("fail") === 0 && n("hitB") === 89 && n("hitC") === 78 &&
        has("Every session is cached again 3 seconds after zone A went dark. The database was asked 2,600 reads (200 failed), and 0 were answered by another zone."),
        "Spread nodes, zone A dark: then 600, and every session is cached again after 3 seconds");
      await t.run(1);
      t.expect(n("db") === 0 && n("hitB") === 100 && n("hitC") === 100,
        "Spread nodes, zone A dark: zones B and C back to 100%");
      t.click("dark");
      await t.run(4);
      t.expect(has("Every session is cached again 4 seconds after zone A came back. The database was asked 2,800 reads (400 failed), and 0 were answered by another zone."),
        "Spread nodes, zone A back: a third of a stampede again, 4 seconds, 2,800 reads, 400 failed");

      // 7. One cluster: there are no zone B nodes to restart.
      t.click("reset");
      t.click("cold");
      await t.run(1);
      t.expect(t.logText().indexOf("A deploy restarts") < 0 && n("hitB") === 100 && n("db") === 0,
        "One cluster: the restart button is greyed out, because zone B has no cache nodes");
    }
  });
})();
