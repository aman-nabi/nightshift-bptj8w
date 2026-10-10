/* sims/s2e11-v1.0.2.js  (published as sims/s2e11.js)
   Case s2e11 "Hot Key": a hot key at Ostler's, a small restaurant whose booking site runs on six
   web servers sharing a cache of four nodes (eight with the second setting) in front of the bookings
   database. Every night at 21:00, 6,000 fans load the page of one table, Table 9, once a second,
   and the one node that owns its key gets the lot. The learner adds nodes, turns on a local cache
   on each web server, copies the key to several nodes (with or without the booking deleting every
   copy), turns on coalescing for misses and puts a limit at the edge.

   CHANGELOG
   v1.0.2 (2026-10-10) Season 2 review fixes: with a local cache and the booking deleting every
     copy, book() no longer marks copies that were never cached as deleted, so the log says "Table 9
     isn't cached yet" for them instead of blaming the booking. With a local cache and Cosmin's
     quick fix, the booking line says "Copies #2 to #4 aren't cached yet" when they were never
     filled. A node's box names a Table 9 key only when it holds one (cache A no longer shows
     "table:9 0"). The web servers' box gives the real reason hits are never coalesced: they don't
     wait on the database. The edge-limit commenter is now u/velvet_rope_leopold (s2e08 already
     has a character with the old name).
     Points at case v1.0.1.
   v1.0.1 (2026-10-09) QA: the log names the real reason for a burst of misses (the booking's delete, or
     a key not cached yet). The reason was read after the refill had already cleared it, so every
     burst said the page ran out after 5 minutes.
   v1.0.0 (2026-10-09) first version: the night from 20:59:55 in slots of 0.1 s. Background 1,200
     lookups a second spread evenly over the nodes; from 21:00:00.0, 6,000 Table 9 lookups a second,
     1,000 per web server. Each node answers 300 a slot (3,000 a second) and the rest time out. A
     miss reads the bookings database, 50 reads a slot (500 a second), and the rest are refused.
     Pages last 5 minutes. At 21:00:00.4 Table 9 is booked and the booking deletes its key (or its
     copies). Controls: nodes (4 or 8), local cache (off, 1 s, 10 s), copies (off, Cosmin's quick
     fix, 2, 4 or 8 with every copy deleted), coalescing, edge limit, skip to 21:04:55, replay,
     reset. Stats: busiest node, failed lookups, database reads, seconds the site said "free" after
     the booking, cache writes per booking. selfTest: 18 assertions.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e11-v1.0.1.json):
   - post: six web servers; four cache nodes, A to D; each node answers 3,000 lookups a second and
     the database 500 reads; pages cached for 5 minutes; a booking deletes its table's key; 1,200
     lookups a second on a normal evening, 300 per node; from 21:00, about 6,000 fans refresh Table
     9's page once a second. Monday's log: 21:00:00.4 booked; 270 reads at the database in 0.1 s,
     220 refused; 21:00:02 cache D 6,300/s of 3,000, 3,300/s timed out; A, B, C 300/s. Tuesday
     (eight nodes): D 6,150/s, the other seven 150/s. Wednesday (four copies, the booking deletes
     #1 only): 1,800/s per node, nothing timed out; until 21:05 one answer in four says booked.
   - comments: local cache with a very short TTL (u/near_cache_oksana); top-k counts and four
     deletes per booking for four copies (u/top_keys_tobiah); one load per phone every few seconds
     at the edge (u/velvet_rope_leopold).
   - reply options: index 0 (coalescing alone): the database gets 6 reads instead of 270 at the
     booking, and D still gets 6,300 a second, 3,300 timing out. Index 1 (four copies, every one
     deleted): 1,800 a second per node, 4 writes per booking, 600 reads and 550 refused at
     21:00:00.0, 21:00:00.4 and 21:05:00.4; four copies hold at most 4 x 2,700 = 10,800 a second.
     Index 2 (local cache, 1 s): D 306 a second, A to C 300, 6 database reads at 21:00:00.0 and 6 at
     21:00:01.0, "free" for 0.6 s after the booking. Index 3 (edge limit, one load per phone every
     5 s): 1,200 a second get through, 4,800 a second told to wait, D 1,500 a second, 120 database
     reads and 70 refused at 21:00:00.0 and at 21:00:00.4.

   Teaching model (stated in sim.lede):
   - Slot n is 0.1 s; slot 0 is 20:59:55, slot 50 is 21:00:00.0 (bookings open, the fans arrive),
     slot 54 is 21:00:00.4 (the booking). Each frame processes every slot that is due
     (floor(t x 10)), so results never depend on the frame rate.
   - The hash is a toy: the sum of the key's character codes; the node is the remainder after
     dividing by the node count. "table:9" = 116+97+98+108+101+58+57 = 635: 635 mod 4 = 3 and
     635 mod 8 = 3, cache D both times. "table:9#k" = 635 + 35 + (48 + k) = 718 + k, so #1..#8 are
     719..726: on four nodes D, A, B, C, D, A, B, C; on eight nodes H, A, B, C, D, E, F, G.
   - Background: 120 lookups a slot, 120 / nodes on each node (30 or 15), always hits. A node
     answers 300 a slot: the background first, then Table 9's lookups (round-robin between the
     node's Table 9 keys); the rest time out.
   - Table 9: 100 lookups per web server per slot from slot 50 (20 with the edge limit). Without a
     local cache, each server sends them to the copies in turn (a pointer per server that
     advances by 100 mod copies), so 4 copies get 25 each and 8 copies 13 or 12 alternately. With
     a local cache, a server whose copy is missing or expired sends one fetch (to the next copy in
     turn); that slot's lookups wait for it; the copy is then used for 10 or 100 slots.
   - A lookup for a key that isn't in the shared cache is a miss and reads the database, unless
     coalescing is on: then one read per missing key per web server goes, and the rest wait for it.
     The database answers 50 reads a slot, shared round-robin between keys, and refuses the rest.
     A key with at least one answered read is filled for 3,000 slots (5 minutes).
   - "Free after the booking": answers that said free in a slot after the booking. The stat is
     (last such slot - 54 + 1) x 0.1 s.

   Derivations for the self-tests (all arithmetic, with the model above):
   - Monday (4 nodes, nothing on): D gets 30 + 600 = 630 a slot, answers 30 + 270, 330 time out:
     6,300 and 3,300 a second. At slots 50 and 54 table:9 is missing: 270 answered misses, 270
     database reads, 50 answered, 220 refused. Window 60 to 69 holds no misses: errors 3,300.
     Nobody gets "free" after the booking: the 50 answered reads at slot 54 come from the database.
   - Eight nodes: D 15 + 600 = 615, answers 285, 315 time out: 6,150 and 3,150 a second; the
     others 150 a second.
   - Quick fix: copies on D, A, B, C get 150 a slot each: 180 a node, 1,800 a second. Slot 50: 600
     misses, 50 answered (13, 13, 12, 12), 550 refused, every copy filled "free" until slot 3050.
     Slot 54: #1 deleted: 150 misses, 100 refused; #2 to #4 answer 450 "free" of 500 answers. Free
     answers last until slot 3049 (21:04:59.9): (3049 - 54 + 1) x 0.1 = 299.6 s; at slot 3050
     (21:05:00.0) the copies miss and refill "booked". At slot 69 the stat reads 1.6.
   - Four copies, every one deleted: 1,800 a second per node; 4 writes per booking; slots 50 and 54:
     600 reads, 550 refused; refilled at 54, so all four expire together at slot 3054 (21:05:00.4):
     600 reads, 550 refused. With coalescing: 6 reads per copy, 24 in all; 576 misses wait.
   - Coalescing alone: as Monday, but 6 reads (one per web server) where 270 went; 264 wait.
   - Local cache, 1 s: each server fetches at slots 50, 60, 70...: D gets 30 + 6 at those slots,
     306 a second. Slot 50: 6 misses, 6 reads. The booking at 54 deletes table:9; local copies
     answer "free" in slots 54 to 59 (0.6 s); slot 60's fetches miss, 6 reads, "booked". Window 60
     to 69: database 6. Local cache, 10 s: fetches at 50, 150...: "free" in 54 to 149, 9.6 s.
   - Two copies (#1 on D, #2 on A): 300 a slot each, 330 a node, 30 time out: 3,300 a second, 300
     errors a second on each of D and A, 600 in all.
   - Eight copies on eight nodes: 78 or 72 a slot per copy plus 15: 900 a second each, 8 writes.
     (Eight copies on four nodes: two per node, 25 a server, 180 a slot, 1,800 a second.)
   - Edge limit: 20 per server, 120 a slot: D 150 a slot, 1,500 a second; slots 50 and 54: 120
     reads, 70 refused; 4,800 a second told to wait.
   - Four copies hold at most 300 - 30 = 270 a slot each, 2,700 a second, 10,800 for four.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px,
   edge label 11px, note 11px):
   - Fans' phones (270 wide): sub "Table 9 opens at 21:00" 22 chars, 158px; meta "edge: 4,800/s
     told to wait" 26 chars, 172px.
   - Web servers (300 wide): meta "node = hash(key) mod 4" 22 chars, 145px.
   - Bookings database (210 wide, db): label 17 chars, 133px; sub "handles 500 reads/s" 19 chars,
     137px.
   - Cache nodes (84 wide, 8px gaps, x 48 + 92i): label "Cache A" 7 chars, 55px; sub "6,300/s" 7
     chars, 50px; meta "table:9#1" and "#1 and #5" 9 chars, 59px; "other keys" 10 chars, 66px;
     "the cluster" 11 chars, 73px. Every node always shows three lines, so nothing jumps.
   - Vertical gaps: fans bottom y 76, web top y 139 (63px); web bottom y 201 and database bottom y
     206, cache nodes top y 284 (78px). Edge label "on a miss" (59px) centred in the 75px gap
     between the web servers (right x 440) and the database (left x 515).

   Catalog note: the case's concepts are the catalog's ids for s2e11 (hot-keys, hot-partitions,
   replicating-hot-items).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 2;                              // sim seconds per real second
  var START_CLOCK = 20 * 3600 + 59 * 60 + 55; // 20:59:55
  var SLOTS = 10;                             // slots a second: one slot is 0.1 s
  var OPEN = 50;                              // slot 50 is 21:00:00.0: bookings open
  var BOOK = 54;                              // slot 54 is 21:00:00.4: Table 9 is booked
  var SERVERS = 6;                            // web servers
  var PER_SERVER = 100;                       // Table 9 lookups per web server per slot: 1,000 a second
  var EDGE_PER_SERVER = 20;                   // with the edge limit: one load per phone every 5 s
  var BG = 120;                               // other pages' lookups per slot: 1,200 a second
  var CAP = 300;                              // lookups a node answers per slot: 3,000 a second
  var WARN_LOAD = 2400;                       // a node above this many a second shows amber
  var DB_CAP = 50;                            // database reads per slot: 500 a second
  var TTL = 3000;                             // a cached page lasts 5 minutes
  var MAX_NODES = 8;
  var LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
  var NODE_X = [48, 140, 232, 324, 416, 508, 600, 692];
  var SKIP_TO = 3000;                         // 21:04:55
  var EPS = 1e-6;
  var DOT_EVERY = 0.22;                       // real seconds between sample dots
  var DOT_SPEED = 300;                        // viewBox units per real second

  var NODE_OPTS = [
    { value: "4", label: "4 cache nodes, A to D" },
    { value: "8", label: "8 cache nodes, A to H" }
  ];
  var LOCAL_OPTS = [
    { value: "off", label: "Off" },
    { value: "1", label: "1 second" },
    { value: "10", label: "10 seconds" }
  ];
  var COPY_OPTS = [
    { value: "off", label: "Off: one key, table:9" },
    { value: "quick", label: "4 copies, booking deletes #1 only (Cosmin's quick fix)" },
    { value: "2", label: "2 copies, booking deletes every copy" },
    { value: "4", label: "4 copies, booking deletes every copy" },
    { value: "8", label: "8 copies, booking deletes every copy" }
  ];

  /* ---------- small helpers ---------- */

  // 6300 -> "6,300". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  // 299.6 -> "299.6", 0.6 -> "0.6", 0 -> "0".
  function secText(v) {
    var r = Math.round(v * 10) / 10;
    return r === Math.round(r) ? String(Math.round(r)) : String(r);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Slot n as a clock time with tenths: slot 54 -> "21:00:00.4".
  function slotClock(n) {
    var tenths = START_CLOCK * SLOTS + n;
    var s = Math.floor(tenths / SLOTS);
    var d = tenths - s * SLOTS;
    s = s % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60) + "." + d;
  }

  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function say(api, msg, tone) { if (!api.state.quiet) api.log(msg, tone || ""); }

  // The sim's toy hash: the sum of the key's character codes.
  function hashOf(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h += name.charCodeAt(i);
    return h;
  }

  // Shares cap between demands round-robin, so every demand gets one before any gets two.
  function share(dem, cap) {
    var got = zeros(dem.length);
    var left = Math.max(0, cap);
    var i, act, each, g;
    if (sum(dem) <= left) return dem.slice();
    var guard = 0;
    while (left > 0 && guard < 100) {
      guard += 1;
      act = 0;
      for (i = 0; i < dem.length; i++) if (got[i] < dem[i]) act++;
      if (!act) break;
      each = Math.floor(left / act);
      if (each < 1) {
        for (i = 0; i < dem.length && left > 0; i++) if (got[i] < dem[i]) { got[i] += 1; left -= 1; }
        break;
      }
      for (i = 0; i < dem.length; i++) {
        if (got[i] < dem[i]) { g = Math.min(each, dem[i] - got[i]); got[i] += g; left -= g; }
      }
    }
    return got;
  }

  /* ---------- settings ---------- */

  function keyNames(S) {
    if (S.copies === "off") return ["table:9"];
    var n = S.copies === "quick" ? 4 : Number(S.copies);
    var out = [];
    for (var i = 1; i <= n; i++) out.push("table:9#" + i);
    return out;
  }

  function localSlots(S) { return S.local === "1" ? 10 : S.local === "10" ? 100 : 0; }

  function writesPerBooking(S) {
    if (S.copies === "off" || S.copies === "quick") return 1;
    return Number(S.copies);
  }

  function localLabel(S) { return S.local === "1" ? "1 s" : S.local === "10" ? "10 s" : "off"; }

  function whereText(S) {
    if (S.copies === "off") {
      var h = S.keys[0].hash;
      return "table:9 adds up to " + h + ", and " + h + " mod " + S.nodes + " = " + (h % S.nodes) +
        ", so it lives on cache " + LETTERS[S.keys[0].node] + ".";
    }
    var parts = [];
    for (var k = 0; k < S.keys.length; k++) parts.push((k === 0 ? "table:9#1" : "#" + (k + 1)) + " on " + LETTERS[S.keys[k].node]);
    return "Table 9 has " + S.keys.length + " copies: " + parts.join(", ") + ".";
  }

  /* ---------- the diagram ---------- */

  function cacheNodes() {
    var out = [];
    for (var i = 0; i < MAX_NODES; i++) {
      out.push({ id: "n" + LETTERS[i], label: "Cache " + LETTERS[i], sub: i < 4 ? "300/s" : "not in",
        meta: i === 3 ? "table:9" : i < 4 ? "other keys" : "the cluster",
        x: NODE_X[i], y: 320, w: 84, h: 72, shape: "box", tone: i < 4 ? "ok" : "muted" });
    }
    return out;
  }

  function cacheEdges() {
    var out = [];
    for (var i = 0; i < MAX_NODES; i++) out.push({ from: "web", to: "n" + LETTERS[i] });
    return out;
  }

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 400,
    aria: "Hot key sim for Ostler's restaurant. Fans' phones load Table 9's page and other pages send their lookups to six web servers. Each lookup goes to the cache node that owns its key, picked by a hash of the key's name. Up to eight cache nodes, A to H, sit in a row; each answers up to 3,000 lookups a second. On a miss, the web servers read the bookings database, which answers 500 reads a second.",
    nodes: [
      { id: "fans", label: "Fans' phones", sub: "Table 9 opens at 21:00", meta: "one refresh a second each", x: 200, y: 45, w: 270, h: 62, shape: "box", tone: "" },
      { id: "others", label: "Other pages", sub: "1,200 lookups/s", x: 560, y: 45, w: 230, h: 52, shape: "box", tone: "" },
      { id: "web", label: "Web servers (6)", sub: "local cache: off", meta: "node = hash(key) mod 4", x: 290, y: 170, w: 300, h: 62, shape: "box", tone: "" },
      { id: "db", label: "Bookings database", sub: "handles 500 reads/s", meta: "0 reads/s", x: 620, y: 170, w: 210, h: 72, shape: "db", tone: "ok" }
    ].concat(cacheNodes()),
    edges: [
      { from: "fans", to: "web" },
      { from: "others", to: "web" },
      { from: "web", to: "db", label: "on a miss" }
    ].concat(cacheEdges()),
    notes: [
      { x: 370, y: 385, text: "each cache node answers up to 3,000 lookups a second", tone: "muted", anchor: "middle" }
    ]
  };

  /* ---------- one slot: the lookups, the nodes, the database ---------- */

  function slot(api) {
    var S = api.state;
    var n = S.n;
    var r = n % SLOTS;
    var i, j, k, s, f;
    for (i = 0; i < MAX_NODES; i++) { S.rLoad[i][r] = 0; S.rTo[i][r] = 0; S.rHot[i][r] = 0; }
    S.rDb[r] = 0;
    S.rRef[r] = 0;
    S.rErr[r] = 0;

    if (n === OPEN) openBookings(api);
    if (n === BOOK) book(api);

    var K = S.keys.length;
    var L = localSlots(S);
    var h = n >= OPEN ? (S.edge ? EDGE_PER_SERVER : PER_SERVER) : 0;
    var sent = zeros(K);
    var senders = zeros(K);
    var fetches = [];
    var answers = 0, stale = 0, errors = 0, local = 0;

    // Table 9's lookups leave the web servers.
    if (h > 0) {
      for (s = 0; s < SERVERS; s++) {
        if (L) {
          var lc = S.lc[s];
          if (lc && n < lc.until) {
            answers += h;
            local += h;
            if (S.booked && lc.value === "free") stale += h;
            continue;
          }
          k = S.ptr[s];
          S.ptr[s] = (k + 1) % K;
          sent[k] += 1;
          senders[k] += 1;
          fetches.push({ s: s, k: k, waiters: h, answered: false });
        } else {
          var p = S.ptr[s];
          var base = Math.floor(h / K);
          var extra = h % K;
          for (k = 0; k < K; k++) {
            var c = base + (((k - p + K) % K) < extra ? 1 : 0);
            if (c) { sent[k] += c; senders[k] += 1; }
          }
          S.ptr[s] = (p + h) % K;
        }
      }
    }

    // Each node answers 300 a slot: the other pages' lookups first, then Table 9's.
    var answered = zeros(K);
    var bg = BG / S.nodes;
    for (i = 0; i < S.nodes; i++) {
      var ks = [];
      var dem = [];
      for (k = 0; k < K; k++) if (S.keys[k].node === i) { ks.push(k); dem.push(sent[k]); }
      var tot = sum(dem);
      var got = share(dem, CAP - bg);
      for (j = 0; j < ks.length; j++) answered[ks[j]] = got[j];
      var to = tot - sum(got);
      S.rLoad[i][r] = bg + tot;
      S.rHot[i][r] = tot;
      S.rTo[i][r] = to;
      if (!L) errors += to;
    }

    // Hits answer at once; misses go on to the bookings database.
    var here = [];
    var before = [];
    var misses = zeros(K);
    var dbDem = zeros(K);
    for (k = 0; k < K; k++) {
      var key = S.keys[k];
      here.push(n < key.expires);
      before.push(key.value);
      if (L) {
        var left = answered[k];
        for (f = 0; f < fetches.length; f++) {
          if (fetches[f].k !== k) continue;
          if (left > 0) { left -= 1; fetches[f].answered = true; }
        }
        if (!here[k]) { misses[k] = answered[k]; dbDem[k] = answered[k]; }
      } else if (here[k]) {
        answers += answered[k];
        if (S.booked && key.value === "free") stale += answered[k];
      } else {
        misses[k] = answered[k];
        dbDem[k] = S.coal ? Math.min(answered[k], senders[k]) : answered[k];
      }
    }

    var dbGot = share(dbDem, DB_CAP);
    var dbTotal = sum(dbDem);
    var dbOk = sum(dbGot);
    S.rDb[r] = dbTotal;
    S.rRef[r] = dbTotal - dbOk;
    var cur = S.booked ? "booked" : "free";

    if (L) {
      var dbLeft = dbGot.slice();
      for (f = 0; f < fetches.length; f++) {
        var fe = fetches[f];
        if (!fe.answered) { errors += fe.waiters; continue; }
        var v;
        if (here[fe.k]) {
          v = before[fe.k];
        } else if (dbLeft[fe.k] > 0) {
          dbLeft[fe.k] -= 1;
          v = cur;
        } else {
          errors += fe.waiters;
          continue;
        }
        S.lc[fe.s] = { value: v, until: n + L };
        answers += fe.waiters;
        if (S.booked && v === "free") stale += fe.waiters;
      }
    } else {
      for (k = 0; k < K; k++) {
        if (!dbDem[k]) continue;
        if (dbGot[k] === dbDem[k]) {
          answers += misses[k];
        } else if (S.coal) {
          var okFans = Math.floor(misses[k] * dbGot[k] / dbDem[k]);
          answers += okFans;
          errors += misses[k] - okFans;
        } else {
          answers += dbGot[k];
          errors += dbDem[k] - dbGot[k];
        }
      }
    }

    // A key with at least one answered database read goes back into the cache for 5 minutes.
    // The reason for the misses is read before any key is refilled, so the log names the real cause.
    var firstMiss = -1;
    for (k = 0; k < K; k++) if (dbDem[k] && firstMiss < 0) firstMiss = k;
    var reason = firstMiss >= 0 ? missReason(S, firstMiss, n) : "";
    for (k = 0; k < K; k++) {
      if (dbGot[k] > 0) {
        S.keys[k].value = cur;
        S.keys[k].expires = n + TTL;
        S.keys[k].gone = null;
      }
    }
    S.rErr[r] = errors;

    S.lastMix = { hot: h * SERVERS, local: local, sent: sent, answered: answered, misses: misses };

    narrate(api, n, {
      dbTotal: dbTotal, dbOk: dbOk, firstMiss: firstMiss, reason: reason, misses: sum(misses), L: L,
      answers: answers, stale: stale
    });
    S.n = n + 1;
  }

  function openBookings(api) {
    var S = api.state;
    var msg = "21:00:00.0 Bookings open, 28 days ahead. 6,000 fans load Table 9's page once a second each: 6,000 lookups a second, 1,000 per web server.";
    if (S.edge) msg += " The edge lets each phone through once every 5 seconds: 1,200 a second reach the web servers, and 4,800 a second are told to wait.";
    say(api, msg, S.edge ? "warn" : "bad");
  }

  function book(api) {
    var S = api.state;
    S.booked = true;
    var k;
    if (S.copies === "quick") {
      S.keys[0].expires = 0;
      S.keys[0].gone = "deleted";
    } else {
      for (k = 0; k < S.keys.length; k++) { if (S.keys[k].gone === "new") continue; S.keys[k].expires = 0; S.keys[k].gone = "deleted"; }
    }
    var what;
    if (S.copies === "off") what = "table:9 (1 cache write).";
    else if (S.copies === "quick") { var held = 0; for (k = 1; k < S.keys.length; k++) if (S.keys[k].gone !== "new") held++; what = "table:9#1 only (1 cache write). " + (held ? "Copies #2 to #4 still say free." : "Copies #2 to #4 aren't cached yet."); }
    else what = "all " + S.keys.length + " copies (" + S.keys.length + " cache writes).";
    say(api, "21:00:00.4 Table 9 is booked: party of one, R. Marchbank. The booking writes the database, then deletes " + what +
      (localSlots(S) ? " The web servers' local copies don't hear about it." : ""), "warn");
  }

  /* ---------- narration ---------- */

  function missReason(S, k, n) {
    var key = S.keys[k];
    if (key.gone === "new") return "Table 9 isn't cached yet";
    if (key.gone === "deleted") {
      if (n !== BOOK) return "Table 9 is still missing since the booking deleted it";
      if (S.copies === "off") return "The booking deleted table:9";
      if (S.copies === "quick") return "The booking deleted table:9#1";
      return "The booking deleted every copy";
    }
    return "Table 9's cached page ran out after 5 minutes";
  }

  function narrate(api, n, ev) {
    var S = api.state;
    if (S.quiet) {
      trackStale(S, n, ev);
      return;
    }

    if (ev.dbTotal > 0) {
      var msg = slotClock(n) + " " + ev.reason + ": " + fmt(ev.dbTotal) +
        (ev.dbTotal === 1 ? " read went" : " reads went") + " to the bookings database, which handles 50 in a tenth of a second.";
      if (ev.dbTotal > ev.dbOk) msg += " It refused " + fmt(ev.dbTotal - ev.dbOk) + ".";
      var waiting = ev.misses - ev.dbTotal;
      if (!ev.L && S.coal && waiting > 0) msg += " Coalescing sent one per web server; the other " + fmt(waiting) + " misses waited for those answers.";
      say(api, msg, ev.dbTotal > ev.dbOk ? "bad" : "");
    }

    if (S.booked && ev.stale > 0 && S.lastStale === null) {
      say(api, slotClock(n) + " The booking is in the database, but " + fmt(ev.stale) + " of the " + fmt(ev.answers) +
        " answers in this tenth of a second still said Table 9 was free.", "bad");
    }
    var ended = trackStale(S, n, ev);
    if (ended) {
      say(api, "From " + slotClock(n) + " every answer says booked. Fans saw Table 9 free for " +
        secText((S.lastStale - BOOK + 1) / SLOTS) + " seconds after the booking.", "ok");
    }

    if (n === OPEN + SLOTS - 1) {
      var parts = [];
      var toSum = 0;
      for (var i = 0; i < S.nodes; i++) {
        parts.push("cache " + LETTERS[i] + " " + fmt(sum(S.rLoad[i])) + "/s");
        toSum += sum(S.rTo[i]);
      }
      say(api, "In the first second after 21:00: " + parts.join(", ") + ". Each handles 3,000 a second; " +
        (toSum ? fmt(toSum) + " lookups timed out." : "nothing timed out."), toSum ? "bad" : "ok");
    }
  }

  // Returns true in the slot where fans stop being told "free".
  function trackStale(S, n, ev) {
    if (!S.booked) return false;
    if (ev.stale > 0) { S.lastStale = n; return false; }
    if (S.lastStale !== null && !S.staleEnded && ev.answers > 0) { S.staleEnded = true; return true; }
    return false;
  }

  /* ---------- the night ---------- */

  function startNight(api, why) {
    var S = api.state;
    S.t = 0;
    S.n = 0;
    api.clock = START_CLOCK;
    var names = keyNames(S);
    S.keys = [];
    for (var k = 0; k < names.length; k++) {
      var hv = hashOf(names[k]);
      S.keys.push({ name: names[k], hash: hv, node: hv % S.nodes, value: null, expires: 0, gone: "new" });
    }
    S.booked = false;
    S.lc = [];
    S.ptr = [];
    for (var s = 0; s < SERVERS; s++) { S.lc.push(null); S.ptr.push(0); }
    S.rLoad = [];
    S.rTo = [];
    S.rHot = [];
    for (var i = 0; i < MAX_NODES; i++) { S.rLoad.push(zeros(SLOTS)); S.rTo.push(zeros(SLOTS)); S.rHot.push(zeros(SLOTS)); }
    S.rDb = zeros(SLOTS);
    S.rRef = zeros(SLOTS);
    S.rErr = zeros(SLOTS);
    S.lastStale = null;
    S.staleEnded = false;
    S.quiet = false;
    S.lastMix = null;
    S.dotClock = 0;
    S.dotTurn = 0;
    var head = (why ? why + " " : "") + "20:59:55 at Ostler's, five seconds before bookings open. " + S.nodes +
      " cache nodes, A to " + LETTERS[S.nodes - 1] + ". " + whereText(S);
    if (localSlots(S)) head += " Each web server keeps a local copy of Table 9 for " + (S.local === "1" ? "1 second." : "10 seconds.");
    if (S.coal) head += " Coalescing is on for misses.";
    if (S.edge) head += " The edge lets each phone load Table 9 once every 5 seconds.";
    say(api, head, "");
    draw(api);
  }

  function replay(api, what) { startNight(api, what + " The night replays."); }

  /* ---------- controls ---------- */

  function setNodes(api, v) {
    var o = pick(NODE_OPTS, v);
    if (!o) return;
    api.state.nodes = Number(o.value);
    replay(api, api.state.nodes === 8 ? "Four more cache nodes, E to H." : "Back to four cache nodes, A to D.");
  }

  function setLocal(api, v) {
    var o = pick(LOCAL_OPTS, v);
    if (!o) return;
    api.state.local = String(o.value);
    replay(api, o.value === "off" ? "Local cache off: every Table 9 lookup goes to the shared cache." :
      "Each web server now keeps a local copy of Table 9 for " + (o.value === "1" ? "1 second." : "10 seconds."));
  }

  function setCopies(api, v) {
    var o = pick(COPY_OPTS, v);
    if (!o) return;
    api.state.copies = String(o.value);
    replay(api, o.value === "off" ? "One key for Table 9 again." :
      o.value === "quick" ? "Cosmin's quick fix: four copies, and the booking still deletes only the first." :
      o.value + " copies of Table 9, and the booking deletes every one.");
  }

  function setCoal(api, on) {
    api.state.coal = !!on;
    replay(api, on ? "Coalescing on: one database read per missing key per web server; the other misses wait for it." :
      "Coalescing off: every miss reads the database.");
  }

  function setEdge(api, on) {
    api.state.edge = !!on;
    replay(api, on ? "Edge limit on: each phone may load Table 9's page once every 5 seconds." : "Edge limit off.");
  }

  function skip(api) {
    var S = api.state;
    if (S.n >= SKIP_TO) return;
    S.quiet = true;
    var guard = 0;
    while (S.n < SKIP_TO && guard < 10000) { slot(api); guard += 1; }
    S.quiet = false;
    S.t = SKIP_TO / SLOTS;
    api.clock = START_CLOCK + S.t;
    say(api, "Skipped to 21:04:55." + (S.lastStale !== null && !S.staleEnded ? " Some fans are still told Table 9 is free." : ""), "");
    draw(api);
  }

  /* ---------- drawing ---------- */

  function nodeMeta(S, i) {
    var list = [];
    for (var k = 0; k < S.keys.length; k++) if (S.keys[k].node === i) list.push(k);
    if (!list.length) return "other keys";
    if (S.copies === "off") return "table:9";
    if (list.length === 1) return "table:9#" + (list[0] + 1);
    var parts = [];
    for (var j = 0; j < list.length; j++) parts.push("#" + (list[j] + 1));
    return parts.join(" and ");
  }

  function staleText(S) {
    if (!S.booked) return "-";
    if (S.lastStale === null) return "0";
    return secText((S.lastStale - BOOK + 1) / SLOTS);
  }

  function draw(api) {
    var S = api.state;
    var live = S.n > OPEN;
    var h = live ? (S.edge ? EDGE_PER_SERVER : PER_SERVER) : 0;

    var fa = api.node("fans");
    fa.text("sub", h ? "Table 9: " + fmt(h * SERVERS * SLOTS) + "/s" : "Table 9 opens at 21:00");
    fa.text("meta", S.edge ? (h ? "edge: " + fmt((PER_SERVER - EDGE_PER_SERVER) * SERVERS * SLOTS) + "/s told to wait" : "edge limit: 1 per 5 s") :
      "one refresh a second each");
    fa.set(h ? "warn" : "");

    var we = api.node("web");
    we.text("sub", "local cache: " + localLabel(S));
    we.text("meta", "node = hash(key) mod " + S.nodes);

    var dbR = sum(S.rDb);
    var dbRef = sum(S.rRef);
    var db = api.node("db");
    db.text("meta", fmt(dbR) + " reads/s");
    db.set(dbRef > 0 ? "bad" : dbR > 0 ? "warn" : "ok");

    var busiest = 0;
    for (var i = 0; i < MAX_NODES; i++) {
      var nd = api.node("n" + LETTERS[i]);
      if (i >= S.nodes) {
        nd.text("sub", "not in");
        nd.text("meta", "the cluster");
        nd.set("muted");
        continue;
      }
      var load = sum(S.rLoad[i]);
      var to = sum(S.rTo[i]);
      if (load > busiest) busiest = load;
      nd.text("sub", fmt(load) + "/s");
      nd.text("meta", nodeMeta(S, i));
      nd.set(to > 0 ? "bad" : load > WARN_LOAD ? "warn" : "ok");
    }

    S.stat.busiest(fmt(busiest));
    S.stat.err(fmt(sum(S.rErr)));
    S.stat.db(fmt(dbR));
    S.stat.stale(staleText(S));
    S.stat.writes(String(writesPerBooking(S)));

    S.ctl.skip.disable(S.n >= SKIP_TO);
  }

  /* ---------- dots: a visual sample, never counted ---------- */

  function dots(api, dt) {
    var S = api.state;
    if (api.reducedMotion || !S.lastMix) return;
    S.dotClock += dt;
    if (S.dotClock < DOT_EVERY) return;
    S.dotClock = 0;
    S.dotTurn = (S.dotTurn + 1) % 4;
    var m = S.lastMix;
    if (S.dotTurn === 0 || !m.hot) {
      var bi = Math.floor(api.rand() * S.nodes);
      var bid = "n" + LETTERS[bi];
      api.dot({ path: ["others", "web", bid], cls: "dot-req", r: 3, speed: DOT_SPEED,
        onArrive: function (dot, wp) { if (dot && wp === bid) dot.cls("dot-ok"); } });
      return;
    }
    if (m.local >= m.hot) {
      api.dot({ path: ["fans", "web"], cls: "dot-req", r: 4, speed: DOT_SPEED,
        onArrive: function (dot, wp) { if (dot && wp === "web") dot.cls("dot-ok"); } });
      return;
    }
    var total = sum(m.sent);
    if (!total) return;
    var x = api.rand() * total;
    var k = 0;
    while (k < m.sent.length - 1 && x >= m.sent[k]) { x -= m.sent[k]; k += 1; }
    var nid = "n" + LETTERS[S.keys[k].node];
    var fail = m.sent[k] > 0 && api.rand() * m.sent[k] >= m.answered[k];
    var miss = !fail && m.misses[k] > 0;
    api.dot({ path: miss ? ["fans", "web", nid, "web", "db"] : ["fans", "web", nid], cls: "dot-req", r: 4, speed: DOT_SPEED,
      onArrive: function (dot, wp) {
        if (!dot) return;
        if (wp === nid) dot.cls(fail ? "dot-fail" : miss ? "dot-wait" : "dot-ok");
        if (wp === "db") dot.cls("dot-ok");
      } });
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.keys) return;
    S.t += dt * api.speed;
    var due = Math.floor(S.t * SLOTS + EPS);
    var guard = 0;
    while (S.n < due && guard < 5000) { slot(api); guard += 1; }
    draw(api);
    dots(api, dt);
  }

  /* ---------- "what is this box" ---------- */

  function nodeInfo(S, i) {
    var L = LETTERS[i];
    if (i >= S.nodes) {
      return "<strong>Cache " + L + ".</strong> Not in the cluster. Pick 8 cache nodes to add E to H.";
    }
    var load = sum(S.rLoad[i]);
    var hot = sum(S.rHot[i]);
    var meta = nodeMeta(S, i);
    return "<strong>Cache " + L + ".</strong> Answers up to 3,000 lookups a second; past that, the rest time out. It holds every key whose hash leaves " +
      i + " when divided by " + S.nodes + ". Its per-key counts for the last second: " +
      (meta !== "other keys" ? meta + " " + fmt(hot) + ", " : "") + "the other pages' keys " + fmt(load - hot) +
      " between them. Counting lookups per key on every node, and keeping the busiest few, is how you spot a hot key before it melts a node.";
  }

  var INFO = {
    fans: function (S) {
      return "<strong>Fans' phones.</strong> From 21:00, about 6,000 fans load Table 9's page once a second each: 6,000 lookups a second, 1,000 for each web server. " +
        (S.edge ? "The edge limit lets each phone through once every 5 seconds: 1,200 a second get through and 4,800 a second are told to wait, so a fan's screen can be up to 5 seconds old." :
          "Turn on the edge limit to let each phone through only once every 5 seconds.");
    },
    others: function () {
      return "<strong>Other pages.</strong> Every other page on the site: 1,200 lookups a second, spread evenly over the cache nodes. In the sim they're always hits.";
    },
    web: function (S) {
      var s = "<strong>Web servers.</strong> Six of them, each sending its lookups to the node that owns the key. The sim's hash adds up the key's character codes, and the remainder after dividing by the number of nodes picks the node: table:9 adds up to 635, and 635 mod 4 and 635 mod 8 are both 3, cache D. ";
      if (localSlots(S)) s += "Local cache on: each server fetches Table 9 once, its other lookups wait for that answer, and then it answers from its own copy for " + (S.local === "1" ? "1 second" : "10 seconds") + ". Nothing tells that copy about a booking. ";
      if (S.copies !== "off") s += "Copies: Table 9 is stored as " + S.keys.length + " keys on different nodes, and each server sends its lookups to them in turn. ";
      s += S.coal ? "Coalescing is on: one database read per missing key per server, and the other misses wait for it." :
        "Coalescing is off: every miss reads the database. Hits are never coalesced: they don't wait on the database.";
      return s;
    },
    db: function (S) {
      return "<strong>Bookings database.</strong> The source of truth. It answers 50 reads a tenth of a second, 500 a second, and refuses the rest. A booking always checks it, so a fan who sees Table 9 free on an old copy is told it's taken. Reads in the last second: " +
        fmt(sum(S.rDb)) + ".";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s2e11", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.nodes = 4;
      S.local = "off";
      S.copies = "off";
      S.coal = false;
      S.edge = false;
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.nodes = api.control.select("nodes", "Cache nodes", NODE_OPTS, "4", function (v) { setNodes(api, v); });
      S.ctl.local = api.control.select("local", "Local cache on each web server (TTL)", LOCAL_OPTS, "off", function (v) { setLocal(api, v); });
      S.ctl.copies = api.control.select("copies", "Copies of Table 9's key", COPY_OPTS, "off", function (v) { setCopies(api, v); });
      S.ctl.coal = api.control.toggle("coal", "Coalescing: one database read per missing key per web server", false, function (on) { setCoal(api, on); });
      S.ctl.edge = api.control.toggle("edge", "Edge limit: one Table 9 load per phone every 5 s", false, function (on) { setEdge(api, on); });
      S.ctl.skip = api.control.button("skip", "Skip to 21:04:55", function () { skip(api); });
      S.ctl.replay = api.control.button("replay", "Replay from 20:59:55", function () { replay(api, "Back to 20:59:55."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        busiest: api.stat("busiest", "busiest cache node, lookups/s (each handles 3,000)", "warn"),
        err: api.stat("err", "failed lookups, last second (timeouts + refused)", "bad"),
        db: api.stat("db", "database reads, last second (handles 500)", ""),
        stale: api.stat("stale", "seconds the site said free after the booking", "warn"),
        writes: api.stat("writes", "cache writes per booking", "")
      };

      api.onNodeClick(function (id) {
        var st = api.state;
        if (id.charAt(0) === "n" && id.length === 2) { api.info(nodeInfo(st, LETTERS.indexOf(id.charAt(1)))); return; }
        var f = INFO[id];
        if (f) api.info(f(st));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startNight(api, "");
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }
      function n(id) { return num(t.stat(id)); }
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function sub(id) { return t.node(id).text.sub; }

      // 1. Monday: one key on four nodes. run(3.5) is 7 sim seconds: slots 0-69, up to 21:00:01.9.
      await t.run(3.5);
      t.expect(n("busiest") === 6300 && n("err") === 3300 && sub("nD") === "6,300/s" && t.node("nD").state === "bad" &&
        sub("nA") === "300/s" && sub("nB") === "300/s" && sub("nC") === "300/s" && t.node("nA").state === "ok" &&
        sub("nE") === "not in" && t.node("nE").text.meta === "the cluster" && t.node("nE").state === "muted" &&
        t.node("nA").text.meta === "other keys" && t.node("nD").text.meta === "table:9",
        "Monday: cache D gets 6,300 lookups a second against its 3,000 and 3,300 time out, while A, B and C idle at 300");
      t.expect(has("In the first second after 21:00: cache A 300/s, cache B 300/s, cache C 300/s, cache D 6,300/s. Each handles 3,000 a second; 3,300 lookups timed out."),
        "Monday: the first second's summary shows one node over its limit and three nearly idle");
      t.expect(has("21:00:00.4 The booking deleted table:9: 270 reads went to the bookings database, which handles 50 in a tenth of a second. It refused 220.") &&
        n("stale") === 0 && n("writes") === 1,
        "Monday: the booking's delete sends 270 reads to the database in a tenth of a second, 220 refused, and nobody is told free afterwards");

      // 2. Tuesday: eight nodes. table:9 still lands on D (635 mod 8 = 3).
      t.click("reset");
      t.set("nodes", "8");
      await t.run(3.5);
      t.expect(n("busiest") === 6150 && n("err") === 3150 && sub("nD") === "6,150/s" && t.node("nD").text.meta === "table:9" &&
        sub("nA") === "150/s" && sub("nE") === "150/s" && sub("nH") === "150/s",
        "Eight nodes: table:9 still lives on D, which gets 6,150 a second while the other seven idle at 150");

      // 3. Wednesday: Cosmin's quick fix, four copies and only #1 deleted.
      t.click("reset");
      t.set("copies", "quick");
      await t.run(3.5);
      t.expect(n("busiest") === 1800 && n("err") === 0 && sub("nD") === "1,800/s" && sub("nA") === "1,800/s" &&
        t.node("nD").text.meta === "table:9#1" && t.node("nA").text.meta === "table:9#2" && n("writes") === 1 && n("stale") === 1.6,
        "Quick fix: four copies flatten every node to 1,800 a second, and fans are still being told free 1.6 seconds after the booking");
      t.expect(has("21:00:00.4 The booking deleted table:9#1: 150 reads went to the bookings database, which handles 50 in a tenth of a second. It refused 100.") &&
        has("450 of the 500 answers in this tenth of a second still said Table 9 was free."),
        "Quick fix: the booking deletes only copy #1, so 450 of 500 answers still say free");
      t.click("skip");
      await t.run(3.5);                                   // slots 3000-3069: up to 21:05:01.9
      t.expect(n("stale") === 299.6 && has("From 21:05:00.0 every answer says booked. Fans saw Table 9 free for 299.6 seconds after the booking."),
        "Quick fix: copies #2 to #4 say free until their 5-minute TTL runs out at 21:05:00.0, 299.6 seconds after the booking");

      // 4. Four copies, every one deleted by the booking.
      t.click("reset");
      t.set("copies", "4");
      await t.run(3.5);
      t.expect(n("busiest") === 1800 && n("err") === 0 && n("stale") === 0 && n("writes") === 4,
        "Four copies, every one deleted: 1,800 a second per node, nobody told free after the booking, 4 cache writes per booking");
      t.expect(has("21:00:00.4 The booking deleted every copy: 600 reads went to the bookings database, which handles 50 in a tenth of a second. It refused 550."),
        "Four copies deleted together miss together: 600 reads at the database, 550 refused");
      t.click("skip");
      await t.run(3.5);
      t.expect(has("21:05:00.4 Table 9's cached page ran out after 5 minutes: 600 reads went to the bookings database, which handles 50 in a tenth of a second. It refused 550."),
        "Four copies filled together expire together at 21:05:00.4, and 550 reads are refused again");

      // 5. Four copies with coalescing.
      t.click("reset");
      t.set("copies", "4");
      t.click("coal");
      await t.run(3.5);
      t.expect(n("err") === 0 && n("busiest") === 1800 &&
        has("21:00:00.4 The booking deleted every copy: 24 reads went to the bookings database, which handles 50 in a tenth of a second. Coalescing sent one per web server; the other 576 misses waited for those answers."),
        "Copies with coalescing: one database read per copy per web server, 24 in all, and nothing refused");

      // 6. Coalescing alone: the database is spared, cache D isn't.
      t.click("reset");
      t.click("coal");
      await t.run(3.5);
      t.expect(n("busiest") === 6300 && n("err") === 3300 && t.node("nD").state === "bad" &&
        has("21:00:00.4 The booking deleted table:9: 6 reads went to the bookings database, which handles 50 in a tenth of a second. Coalescing sent one per web server; the other 264 misses waited for those answers."),
        "Coalescing alone: 6 database reads instead of 270, but cache D still gets 6,300 a second and 3,300 time out");

      // 7. Local cache, 1 second.
      t.click("reset");
      t.set("local", "1");
      await t.run(3.5);
      t.expect(n("busiest") === 306 && n("err") === 0 && n("db") === 6 && sub("nD") === "306/s" && sub("nA") === "300/s" && n("writes") === 1,
        "Local cache, 1 s: each web server asks D once a second, so D gets 306 a second, nothing times out, and the database gets 6 reads");
      t.expect(n("stale") === 0.6 && has("From 21:00:01.0 every answer says booked. Fans saw Table 9 free for 0.6 seconds after the booking."),
        "Local cache, 1 s: the local copies still say free for 0.6 seconds after the booking");

      // 8. Local cache, 10 seconds: the same load, a longer stale window.
      t.click("reset");
      t.set("local", "10");
      await t.run(8);                                     // slots 0-159: up to 21:00:10.9
      t.expect(n("stale") === 9.6 && n("busiest") === 306 && has("Fans saw Table 9 free for 9.6 seconds after the booking."),
        "Local cache, 10 s: D still gets 306 a second, but fans are told free for 9.6 seconds after the booking");

      // 9. Two copies are not enough.
      t.click("reset");
      t.set("copies", "2");
      await t.run(3.5);
      t.expect(n("busiest") === 3300 && n("err") === 600 && t.node("nD").state === "bad" && t.node("nA").state === "bad" && sub("nB") === "300/s",
        "Two copies: D and A get 3,300 a second each, still over their 3,000");

      // 10. Eight copies on eight nodes.
      t.click("reset");
      t.set("nodes", "8");
      t.set("copies", "8");
      await t.run(3.5);
      t.expect(n("busiest") === 900 && n("err") === 0 && n("writes") === 8,
        "Eight copies on eight nodes: 900 a second on each, for 8 cache writes per booking");

      // 11. A limit at the edge.
      t.click("reset");
      t.click("edge");
      await t.run(3.5);
      t.expect(n("busiest") === 1500 && n("err") === 0 && t.node("fans").text.meta === "edge: 4,800/s told to wait" &&
        has("21:00:00.4 The booking deleted table:9: 120 reads went to the bookings database, which handles 50 in a tenth of a second. It refused 70."),
        "Edge limit: 1,200 lookups a second get through, D gets 1,500, and 70 of the booking's 120 database reads are refused");
    }
  });
})();
