/* sims/s3e07-v1.0.0.js  (published as sims/s3e07.js)
   Case s3e07 "Splitting the Archive": a sharding lab at the Kelderby County Records Office, an
   archive split across buildings. 1,200,000 records, numbered 1 to 1,200,000 in the order they
   were filed, sit in three buildings. The learner picks how records are split (by year, with a new
   building taking the newer half of the newest building's records or only the next year's; a hash
   of the record number mod the number of buildings; a hash of the record number into fixed
   partitions that the directory assigns to buildings; or one bigger building), opens buildings one
   at a time, sends the vans that move records, and chooses whether the directory switches at once
   or entry by entry as each piece lands. Stats: buildings in use, the busiest and the average
   building's new records tonight, records left waiting at dawn, records to move for the last
   opening, records nobody can find right now, and buildings asked for every record from 1931.

   CHANGELOG
   v1.0.0 (2026-10-11) first version. Event-driven (api.speed = 0): the clock moves only when
     something happens, to 12:00 on the day a building opens and to 17:00 when a van lands.
     selfTest: 17 assertions.

   Where every number comes from (conventions rule 14; the case is content/s3/s3e07-v1.0.0.json):
   - post: three buildings split by year. The Maltings holds 1850 to 1939, record numbers
     1 to 480,000 (480,000 records); the Drill Hall 1940 to 1999, 480,001 to 960,000 (480,000); the
     Glasshouse 2000 onward, 960,001 to 1,200,000 (240,000). Total R = 1,200,000. Every new
     registration is dated this year, so it goes to the building holding the newest year.
     1,200 new records arrive each night (NIGHT_IN); one night clerk files 600 (CLERK), so the
     Glasshouse leaves 1,200 - 600 = 600 at dawn. Average with 3 buildings: 1,200 / 3 = 400.
   - post: on Monday 2 November 2026 at 12:00 the Ropewalk opens and takes the newer half of the
     Glasshouse's records: 240,000 / 2 = 120,000, record numbers 1,080,001 to 1,200,000, which
     the story calls 2013 onward. The directory switches at once. Vans carry 30,000 a day (VAN),
     oldest boxes first, landing at 17:00: 120,000 / 30,000 = 4 vans, Monday to Thursday.
     Records nobody can find: 120,000 at noon on Monday, 90,000 after Monday's van (the evidence
     diagram, Tuesday 10:41), 60,000, 30,000, then 0 after Thursday's van at 17:00.
   - post: the Monday birth is record No. 1,200,000, the newest record, so it rides in the last
     van (4 of 4) and is found again on Thursday 5 November at 17:00. Under range by year the
     Ropewalk then takes all 1,200 a night, average 1,200 / 4 = 300, and still leaves 600.
   - comments: the Ellingham deposit is 2,400 papers from 1931 (DEPOSIT) under one deposit
     number, 1,200,001 (DEPOSIT_NO).
   - the sim's toy hash: h(n) = (7,919 x n) mod 1,200,000. 7,919 is prime and does not divide
     1,200,000 = 2^7 x 3 x 5^5, so n -> h(n) is a one-to-one map of 1 .. 1,200,000 onto the
     residues 0 .. 1,199,999: every hash value is used exactly once. For any L that divides
     1,200,000, h(n) mod L = (7,919 x n) mod L, so any L consecutive record numbers land on L
     different residues mod L. That makes every count below exact:
     * hash mod N: building = h(n) mod N. N = 3, 4, 5, 6 all divide 1,200,000, so each building
       holds 1,200,000 / N, and each night's 1,200 consecutive new numbers give 1,200 / N each:
       400 (3), 300 (4), 240 (5), 200 (6).
     * going from N to N + 1 a record stays only if h mod N = h mod (N + 1). With L = N(N + 1)
       (12, 20, 30, all dividing 1,200,000), that holds for the residues 0 .. N - 1 of each L,
       so N of every N(N + 1) records stay: 1,200,000 / (N + 1) stay, N / (N + 1) move.
       3 to 4: 900,000 move (three quarters). 4 to 5: 960,000. 5 to 6: 1,000,000. The sim counts
       these by looping over all 1,200,000 records, and the loop must agree with the formula.
       Vans: 900,000 / 30,000 = 30; 960,000 / 30,000 = 32; 1,000,000 / 30,000 = 33.3, so 34.
     * fixed partitions: partition = h(n) mod P, P = 12, 120 or 1,200, each dividing 1,200,000,
       so every partition holds 1,200,000 / P (100,000; 10,000; 1,000). The three buildings
       start with P / 3 partitions each, in blocks (P = 120: 0-39, 40-79, 80-119). A new building
       takes floor(P / (N + 1)) partitions, one at a time from the building holding most (ties go
       to the lowest-numbered building), always that building's highest-numbered partition.
       P = 120, 3 to 4: 30 partitions (39..30, 79..70, 119..110), 300,000 records, 10 vans.
       4 to 5: 24 partitions, 240,000, 8 vans; partition 119 goes to the Tannery.
       P = 12, 3 to 4: 3 partitions (3, 7, 11), 300,000; 4 to 5: floor(12 / 5) = 2 (2 and 6),
       200,000, leaving 2, 2, 3, 3, 2 partitions: loads 200, 200, 300, 300, 200, busiest 300,
       average 1,200 / 5 = 240.
       Load per building = 1,200 x partitions held / P (the 1,200 consecutive new numbers fill
       every partition equally because P divides 1,200): P = 120 gives 10 per partition.
     * the deposit, unsalted: h(1,200,001) = 7,919 x 1,200,001 mod 1,200,000 = 7,919. Hash mod N:
       7,919 mod 3 = 2 (the Glasshouse), mod 4 = 3 (the Ropewalk), mod 5 = 4, mod 6 = 5.
       Fixed: 7,919 mod 12 = 11, mod 120 = 119, mod 1,200 = 719. P = 120 with 4 buildings:
       partition 119 belongs to the Ropewalk: 300 + 2,400 = 2,700 tonight, average
       (1,200 + 2,400) / 4 = 900, left at dawn 2,700 - 600 = 2,100. With 5 buildings it belongs
       to the Tannery: 240 + 2,400 = 2,640, average 3,600 / 5 = 720.
     * the deposit, keyed by deposit and item number: the sim hashes 1,200,001 + i for items
       i = 1 .. 2,400, 2,400 consecutive numbers, and N and P all divide 2,400, so the papers
       spread exactly evenly: 2,400 / N per building, or 2,400 / P per partition. P = 120 with
       4 buildings: 300 + 600 = 900 each, average 900, left at dawn 4 x 300 = 1,200.
     * the Monday birth, No. 1,200,000: h = 0, so it sits in building 0 under hash mod N (0 mod N
       is 0) and in partition 0 under fixed partitions, which the Maltings never gives away.
   - range by year, a building for each new year (reply option index 1): a new building opens
     empty for the next year (2027 onward, then 2028), nothing moves, and it takes all 1,200 a
     night: busiest 1,200, average 1,200 / 5 = 240 with five buildings. The deposit's papers are
     dated 1931, so under either range scheme they all go to the Maltings: 2,400 tonight, 1,800
     left at dawn there.
   - one bigger building (reply option index 3): the Wool Store takes all 1,200,000 records,
     40 vans, oldest first, so the Monday birth rides in van 40. It has two night clerks, so it
     files 1,200 a night: nothing waits. With the deposit 3,600 arrive and 2,400 wait.
   - range by year, a new building taking the newer half again: 4 to 5 moves 60,000 (from
     No. 1,140,001, 2 vans), 5 to 6 moves 30,000 (from No. 1,170,001, 1 van).
   - days: day 0 is Monday 2 November 2026. A building opens at 12:00 on the current day, or on
     the day after the last van if a van has landed since. Van k of a move lands at 17:00 on the
     opening day + k - 1, so the story's van 4 lands on Thursday 5 November.

   Teaching model (stated in sim.lede):
   - The vans carry only the 1,200,000 records on the shelves at noon on Monday; the week's new
     records count as tonight's load and are not added to the shelves.
   - Under "the directory switches at once" every record in the move answers "not found" from
     the moment the building opens until its van lands: the directory already names the new
     building, and the old one refuses records the directory says aren't its own. Under "entry by
     entry" each piece (a van-load of years, or one partition) is copied first and its directory
     entry switches when it lands, so nothing is ever unreachable. Hash mod N has no directory:
     the rule changes for every record at once, so every record still in transit is unreachable.
   - A question for every record from 1931: under range by year and in the bigger building, one
     building; under either hash, every building, because record numbers say nothing about the
     year.
   - Every log line is written before the step changes anything, so it carries the state as it
     was.

   Self-test arithmetic: see each assertion; all counts are the ones derived above.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px):
   - Left column, 160 wide (x 90, spans 10 to 170): intake y 110 (h 70, 75 to 145) and the
     directory y 300 (h 84, 258 to 342); gap 113. Longest sub "none: hash mod 6", 16 chars, 115px;
     longest meta "+2,400 deposit", "switches at once", 16 chars, 106px.
   - Buildings, 200 wide, 84 high: x 340 (240 to 440) and x 600 (500 to 700), rows y 75, 210, 345
     (33 to 117, 168 to 252, 303 to 387): vertical gaps 51px, horizontal gap 60px, and 70px from
     the left column. Longest label "The Coach House", 15 chars, 117px; longest sub "Nos 1,080,001 to
     1,140,000", 26 chars, 187px; longest meta "2,700 tonight, 2,100 wait", 25 chars, 165px.
   - One edge, intake to directory, vertical, no label.

   Catalog note: concepts sharding, range-vs-hash-partitioning, rebalancing (the catalog's own ids
   for s3e07).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var R = 1200000;                 // records on the shelves at noon on Monday 2 November
  var HASH_MUL = 7919;             // the toy hash: h(n) = 7,919 x n mod 1,200,000
  var HASH_SPACE = 1200000;
  var NIGHT_IN = 1200;             // new records each night, all dated this year
  var CLERK = 600;                 // records one night clerk files in a night
  var VAN = 30000;                 // records one van carries a day
  var DEPOSIT = 2400;              // the Ellingham deposit's papers, dated 1931
  var DEPOSIT_NO = 1200001;        // its one deposit number
  var BIRTH = 1200000;             // the Monday birth, the newest record
  var MAX_B = 6;
  var NOON = 12 * 3600;
  var LANDS = 17 * 3600;
  var DAY = 86400;

  var NAMES = ["the Maltings", "the Drill Hall", "the Glasshouse", "the Ropewalk", "the Tannery", "the Coach House"];
  var BIG_NAME = "the Wool Store";
  var BIG_SLOT = 3;

  // Range by year: first record number of each building's range, and the story's years.
  var START_FIRST = [1, 480001, 960001];
  var YEAR_AT = { 1: "1850", 480001: "1940", 960001: "2000", 1080001: "2013" };
  var YEAR_END = { 480000: "1939", 960000: "1999", 1080000: "2012" };
  var NEW_YEAR = 2027;

  var SCHEMES = [
    { value: "split", label: "By year: a new building takes the newer half (as now)" },
    { value: "year", label: "By year: a new building for each new year" },
    { value: "modn", label: "Hash of the record number, mod the number of buildings" },
    { value: "fixed", label: "Hash of the record number into fixed partitions" },
    { value: "big", label: "One bigger building for everything" }
  ];
  var PARTS = [
    { value: 12, label: "12" },
    { value: 120, label: "120" },
    { value: 1200, label: "1,200" }
  ];
  var WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var MONTHS = [["November", 30], ["December", 31], ["January", 31], ["February", 28], ["March", 31]];

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  // 300000 -> "300,000". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function hash(n) { return (HASH_MUL * n) % HASH_SPACE; }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  // Day 0 is Monday 2 November 2026.
  function dateText(d) {
    var day = 2 + d;
    var m = 0;
    while (m < MONTHS.length - 1 && day > MONTHS[m][1]) { day -= MONTHS[m][1]; m += 1; }
    return WEEKDAYS[d % 7] + " " + day + " " + MONTHS[m][0];
  }

  function setClock(api, d, sec) { api.clock = d * DAY + sec; }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 420,
    aria: "Sharding lab for the Kelderby County Records Office. On the left, the night intake, 1,200 new records a night, and the directory every lookup goes through. On the right, six building slots: the Maltings, the Drill Hall and the Glasshouse are open at the start; the Ropewalk, the Tannery and the Coach House open when you add a building. Each building shows what it holds and its new records tonight.",
    nodes: [
      { id: "intake", label: "Night intake", sub: "1,200 a night", meta: "nothing extra", x: 90, y: 110, w: 160, h: 70, shape: "box", tone: "" },
      { id: "dir", label: "The directory", sub: "by year", meta: "switches at once", x: 90, y: 300, w: 160, h: 84, shape: "db", tone: "" },
      { id: "b0", label: "The Maltings", sub: "1850 to 1939", meta: "0 tonight", x: 340, y: 75, w: 200, h: 84, shape: "box", tone: "muted" },
      { id: "b1", label: "The Drill Hall", sub: "1940 to 1999", meta: "0 tonight", x: 340, y: 210, w: 200, h: 84, shape: "box", tone: "muted" },
      { id: "b2", label: "The Glasshouse", sub: "2000 onward", meta: "1,200 tonight, 600 wait", x: 340, y: 345, w: 200, h: 84, shape: "box", tone: "bad" },
      { id: "b3", label: "The Ropewalk", sub: "not open", meta: "", x: 600, y: 75, w: 200, h: 84, shape: "box", tone: "muted" },
      { id: "b4", label: "The Tannery", sub: "not open", meta: "", x: 600, y: 210, w: 200, h: 84, shape: "box", tone: "muted" },
      { id: "b5", label: "The Coach House", sub: "not open", meta: "", x: 600, y: 345, w: 200, h: 84, shape: "box", tone: "muted" }
    ],
    edges: [
      { from: "intake", to: "dir" }
    ]
  };

  /* ---------- the archive's layout ---------- */

  function nameOf(S, i) {
    if (S.scheme === "big" && i === BIG_SLOT) return BIG_NAME;
    return NAMES[i];
  }

  // Buildings that hold records and take new ones under the current scheme.
  function inUse(S) {
    var out = [];
    if (S.scheme === "big" && S.bigOpen) return [BIG_SLOT];
    for (var i = 0; i < S.n; i++) out.push(i);
    return out;
  }

  function rangeSub(S, i) {
    var a = S.starts[i];
    var b = i + 1 < S.n ? S.starts[i + 1] - 1 : R;
    if (YEAR_AT[a] && b === R) return YEAR_AT[a] + " onward";
    if (YEAR_AT[a] && YEAR_END[b]) return YEAR_AT[a] + " to " + YEAR_END[b];
    if (b === R) return "from No. " + fmt(a);
    return "Nos " + fmt(a) + " to " + fmt(b);
  }

  function yearSub(S, i) {
    if (i < 2) return i === 0 ? "1850 to 1939" : "1940 to 1999";
    var a = S.years[i];
    var last = i === S.n - 1;
    if (last) return a + " onward";
    var b = S.years[i + 1] - 1;
    return a === b ? String(a) : a + " to " + b;
  }

  function stored(S, i) {
    if (S.scheme === "split" || (S.scheme === "big" && !S.bigOpen)) {
      var a = S.starts[i];
      var b = i + 1 < S.n ? S.starts[i + 1] - 1 : R;
      return b - a + 1;
    }
    if (S.scheme === "year") return i < 3 ? [480000, 480000, 240000][i] : 0;
    if (S.scheme === "modn") return R / S.n;
    if (S.scheme === "fixed") return S.hold[i].length * (R / S.parts);
    return i === BIG_SLOT ? R : 0;
  }

  function holdSub(S, i) {
    if (S.scheme === "split") return rangeSub(S, i);
    if (S.scheme === "year") return yearSub(S, i);
    if (S.scheme === "modn") return "hash mod " + S.n + " = " + i;
    if (S.scheme === "fixed") return S.hold[i].length + (S.hold[i].length === 1 ? " partition" : " partitions");
    if (!S.bigOpen) return rangeSub(S, i);
    return i === BIG_SLOT ? "every year" : "closed, emptied";
  }

  function ownerOf(S, p) {
    for (var i = 0; i < S.n; i++) if (S.hold[i].indexOf(p) >= 0) return i;
    return -1;
  }

  /* ---------- tonight's load ---------- */

  function loads(S) {
    var L = [0, 0, 0, 0, 0, 0];
    var use = inUse(S);
    var i;
    if (S.scheme === "split" || S.scheme === "year" || S.scheme === "big") {
      var newest = use[use.length - 1];
      L[newest] += NIGHT_IN;
      if (S.skew) L[use[0]] += DEPOSIT;         // dated 1931: the Maltings, or the one building
      return L;
    }
    if (S.scheme === "modn") {
      for (i = 0; i < S.n; i++) L[i] += NIGHT_IN / S.n;
      if (S.skew) {
        if (S.salt) for (i = 0; i < S.n; i++) L[i] += DEPOSIT / S.n;
        else L[hash(DEPOSIT_NO) % S.n] += DEPOSIT;
      }
      return L;
    }
    for (i = 0; i < S.n; i++) L[i] += NIGHT_IN * S.hold[i].length / S.parts;
    if (S.skew) {
      if (S.salt) for (i = 0; i < S.n; i++) L[i] += DEPOSIT * S.hold[i].length / S.parts;
      else L[ownerOf(S, hash(DEPOSIT_NO) % S.parts)] += DEPOSIT;
    }
    return L;
  }

  function capOf(S, i) { return S.scheme === "big" && S.bigOpen && i === BIG_SLOT ? 2 * CLERK : CLERK; }

  function tally(S) {
    var L = loads(S);
    var use = inUse(S);
    var max = 0;
    var total = 0;
    var wait = 0;
    for (var k = 0; k < use.length; k++) {
      var i = use[k];
      total += L[i];
      if (L[i] > max) max = L[i];
      wait += Math.max(0, L[i] - capOf(S, i));
    }
    return { L: L, max: max, mean: Math.round(total / use.length), wait: wait };
  }

  /* ---------- the move ---------- */

  function landed(S) { return S.move ? Math.min(S.move.toMove, S.move.done * VAN) : 0; }

  function pending(S) { return !!S.move && S.move.done < S.move.vans; }

  // Records nobody can find right now.
  function lost(S) {
    if (!pending(S)) return 0;
    if (S.dir && S.scheme !== "modn") return 0;
    return S.move.toMove - landed(S);
  }

  // Counts, record by record, how many change building when hash mod n becomes mod n + 1.
  function modMoves(n) {
    var moved = 0;
    for (var r = 1; r <= R; r++) {
      var h = hash(r);
      if (h % n !== h % (n + 1)) moved += 1;
    }
    return moved;
  }

  // Counts the records in each partition, record by record.
  function partSizes(P) {
    var sizes = [];
    var i;
    for (i = 0; i < P; i++) sizes.push(0);
    for (var r = 1; r <= R; r++) sizes[hash(r) % P] += 1;
    return sizes;
  }

  /* ---------- the week ---------- */

  function introText(S) {
    var head = "Monday 2 November, 12:00. 1,200,000 records in three buildings, numbered in the order they were filed. ";
    var tail = " Each night 1,200 new records arrive, all dated this year, and a night clerk files 600.";
    if (S.scheme === "split" || S.scheme === "year" || S.scheme === "big") {
      return head + "They are split by year: the Maltings 1850 to 1939, the Drill Hall 1940 to 1999, the Glasshouse 2000 onward, so every new record goes to the Glasshouse." + tail;
    }
    if (S.scheme === "modn") {
      return head + "Each record lives in building number hash(record number) mod 3, 400,000 to a building." + tail;
    }
    return head + "Each record's partition is hash(record number) mod " + fmt(S.parts) + ", " + fmt(R / S.parts) +
      " records to a partition, and the directory gives each building " + fmt(S.parts / 3) + " partitions." + tail;
  }

  function startWeek(api) {
    var S = api.state;
    S.n = 3;
    S.day = 0;
    S.vanDay = -1;
    S.move = null;
    S.moved = 0;
    S.asked = null;
    S.bigOpen = false;
    S.starts = START_FIRST.slice();
    S.years = [1850, 1940, 2000];
    S.hold = [[], [], [], [], [], []];
    if (S.scheme === "fixed") {
      S.sizes = partSizes(S.parts);
      var third = S.parts / 3;
      for (var p = 0; p < S.parts; p++) S.hold[Math.floor(p / third)].push(p);
    }
    setClock(api, 0, NOON);
    api.log(introText(S), "");
    draw(api);
  }

  function replay(api, what) {
    api.log(what + " Replaying from Monday 2 November, 12:00.", "");
    startWeek(api);
  }

  function dirWord(S) { return S.dir ? "entry by entry, as each piece lands" : "now, for all of them at once"; }

  function openBuilding(api) {
    var S = api.state;
    if (pending(S)) return;
    if (S.scheme === "big" ? S.bigOpen : S.n >= MAX_B) return;
    if (S.vanDay >= S.day) S.day = S.vanDay + 1;
    setClock(api, S.day, NOON);
    var when = dateText(S.day) + ", 12:00. ";
    var k = S.n;
    var toMove = 0;
    var msg = "";
    var i;

    if (S.scheme === "split") {
      var a = S.starts[k - 1];
      var half = (R - a + 1) / 2;
      var cut = a + half;
      var sub = YEAR_AT[cut] ? YEAR_AT[cut] + " onward" : "from No. " + fmt(cut);
      toMove = half;
      msg = when + cap(NAMES[k]) + " opens and takes the newer half of " + NAMES[k - 1] + "'s records: " + sub + ", " +
        fmt(half) + " records, in " + Math.ceil(half / VAN) + (Math.ceil(half / VAN) === 1 ? " van" : " vans") +
        " of 30,000, oldest boxes first. The directory switches " + dirWord(S) + ". From tonight every new record goes to " + NAMES[k] + ".";
      S.starts.push(cut);
      S.n += 1;
    } else if (S.scheme === "year") {
      var y = NEW_YEAR + (k - 3);
      msg = when + cap(NAMES[k]) + " opens, empty, for the records of " + y + ". Nothing moves. From 1 January every new record goes to it.";
      S.years.push(y);
      S.n += 1;
    } else if (S.scheme === "modn") {
      toMove = modMoves(k);
      msg = when + cap(NAMES[k]) + " opens. Every record's building is now hash mod " + (k + 1) + " instead of mod " + k + ": " +
        fmt(toMove) + " of 1,200,000 records change building, in " + Math.ceil(toMove / VAN) +
        " vans. There's no directory to update: the rule changes for every record at once.";
      S.n += 1;
    } else if (S.scheme === "fixed") {
      var target = Math.floor(S.parts / (k + 1));
      var taken = [];
      while (taken.length < target) {
        var donor = 0;
        for (i = 1; i < k; i++) if (S.hold[i].length > S.hold[donor].length) donor = i;
        var p = S.hold[donor].pop();
        taken.push(p);
        toMove += S.sizes[p];
      }
      for (i = 0; i < taken.length; i++) S.hold[k].push(taken[i]);
      S.hold[k].sort(function (x, z) { return x - z; });
      msg = when + cap(NAMES[k]) + " opens and takes " + target + " of the " + fmt(S.parts) +
        " partitions, one at a time from whichever building holds most: " + fmt(toMove) + " records, in " +
        Math.ceil(toMove / VAN) + " vans. The directory switches " + dirWord(S) + ".";
      S.n += 1;
    } else {
      toMove = R;
      msg = when + "The Wool Store opens. All 1,200,000 records move into it, in 40 vans, oldest boxes first, and the Maltings, the Drill Hall and the Glasshouse close. The directory switches " +
        dirWord(S) + ". Two night clerks there file 1,200 a night.";
      S.bigOpen = true;
    }

    api.log(msg, toMove ? "warn" : "");
    S.moved = toMove;
    S.move = toMove ? { toMove: toMove, vans: Math.ceil(toMove / VAN), done: 0, day0: S.day, to: S.scheme === "big" ? BIG_NAME : NAMES[k] } : null;
    draw(api);
  }

  function sendVan(api) {
    var S = api.state;
    if (!pending(S)) return;
    var m = S.move;
    var k = m.done + 1;
    var day = m.day0 + k - 1;
    setClock(api, day, LANDS);
    var carry = Math.min(VAN, m.toMove - m.done * VAN);
    var before = lost(S);
    var where = S.scheme === "modn" ? "their new buildings" : m.to;
    api.log(dateText(day) + ", 17:00. Van " + k + " of " + m.vans + " lands at " + where + ": " + fmt(carry) +
      " records. Records nobody could find until it landed: " + fmt(before) + ".", before ? "bad" : "ok");
    m.done = k;
    S.vanDay = day;
    if (k === m.vans) api.log("The move is over: " + fmt(m.toMove) + " records moved.", "ok");
    draw(api);
  }

  function sendAll(api) {
    var guard = 0;
    while (pending(api.state) && guard < 60) { guard += 1; sendVan(api); }
  }

  /* ---------- lookups and questions ---------- */

  // Where the Monday birth is, and whether a lookup finds it.
  function lookup(api) {
    var S = api.state;
    var head = "Lookup No. 1,200,000, a birth registered on Monday 2 November. ";
    var movesIt = (S.scheme === "split" || S.scheme === "big") && pending(S);
    if (S.scheme === "modn" || S.scheme === "fixed" || S.scheme === "year") {
      var home = S.scheme === "year" ? 2 : 0;
      var why = S.scheme === "modn" ? " Its hash is 0, and 0 mod any number of buildings is 0, so it never moves." :
        (S.scheme === "fixed" ? " Its hash is 0, so it lives in partition 0, which the Maltings never gives away." : " 2026 stays where it was filed.");
      api.log(head + "Found at " + NAMES[home] + "." + why, "ok");
      return;
    }
    if (!movesIt) {
      var at = S.scheme === "big" && S.bigOpen ? BIG_NAME : NAMES[S.n - 1];
      api.log(head + "Found at " + at + ".", "ok");
      return;
    }
    var m = S.move;
    var from = S.scheme === "big" ? NAMES[2] : NAMES[S.n - 2];
    if (S.dir) {
      api.log(head + "Its directory entry still names " + from + ", because its box rides in van " + m.vans + " of " + m.vans +
        ". Found at " + from + ".", "ok");
      return;
    }
    var entry = S.scheme === "big" ? "every year" : rangeSub(S, S.n - 1);
    api.log(head + "The directory says " + entry + ": " + m.to + ". " + cap(m.to) + ": not found, because its box is still at " + from +
      ", in van " + m.vans + " of " + m.vans + ". " + cap(from) + ": not ours, says the directory. Not found in any building.", "bad");
  }

  function ask1931(api) {
    var S = api.state;
    var msg = "Every record from 1931. ";
    if (S.scheme === "split" || S.scheme === "year" || (S.scheme === "big" && !S.bigOpen)) {
      S.asked = 1;
      msg += "The directory sends it to the Maltings alone, where 1931 is one run of shelves. Buildings asked: 1.";
    } else if (S.scheme === "big") {
      S.asked = 1;
      msg += "The Wool Store holds every year on one run of shelves. Buildings asked: 1.";
    } else if (S.scheme === "modn") {
      S.asked = S.n;
      msg += "A record's number says nothing about its year, so all " + S.n + " buildings are asked, and each reads its by-date index. The answer is ready when the slowest replies. Buildings asked: " + S.n + ".";
    } else {
      S.asked = S.n;
      msg += "A record's number says nothing about its year, so all " + S.n + " buildings are asked, and all " + fmt(S.parts) +
        " partitions read their by-date indexes. The answer is ready when the slowest replies. Buildings asked: " + S.n + ".";
    }
    api.log(msg, "");
    draw(api);
  }

  /* ---------- controls ---------- */

  function setScheme(api, v) {
    var o = pick(SCHEMES, v);
    if (!o) return;
    api.state.scheme = String(o.value);
    replay(api, "Split: " + o.label + ".");
  }

  function setParts(api, v) {
    var o = pick(PARTS, v);
    if (!o) return;
    api.state.parts = Number(o.value);
    replay(api, "Fixed partitions: " + o.label + ".");
  }

  function setDir(api, on) {
    api.state.dir = !!on;
    replay(api, on ? "The directory now switches entry by entry, as each piece lands." : "The directory now switches at once.");
  }

  function setSkew(api, on) {
    var S = api.state;
    S.skew = !!on;
    api.log(on ? "The Ellingham deposit arrives tonight: 2,400 papers from 1931, all under one deposit number." :
      "No deposit tonight.", on ? "warn" : "");
    draw(api);
  }

  function setSalt(api, on) {
    var S = api.state;
    S.salt = !!on;
    api.log(on ? "The deposit is now keyed by deposit number and item number, so each paper has its own key." :
      "The deposit is keyed by its one deposit number again.", "");
    draw(api);
  }

  /* ---------- drawing ---------- */

  function draw(api) {
    var S = api.state;
    var T = tally(S);
    var use = inUse(S);
    var i;

    for (i = 0; i < MAX_B; i++) {
      var nd = api.node("b" + i);
      nd.text("label", cap(nameOf(S, i)));
      var open = S.scheme === "big" && i === BIG_SLOT ? S.bigOpen : i < S.n;
      if (!open) {
        nd.text("sub", "not open");
        nd.text("meta", "");
        nd.set("muted");
        continue;
      }
      nd.text("sub", holdSub(S, i));
      if (use.indexOf(i) < 0) {
        nd.text("meta", "");
        nd.set("muted");
        continue;
      }
      var w = Math.max(0, T.L[i] - capOf(S, i));
      nd.text("meta", fmt(T.L[i]) + " tonight" + (w ? ", " + fmt(w) + " wait" : ""));
      nd.set(w ? "bad" : (T.L[i] ? "ok" : "muted"));
    }

    var dn = api.node("dir");
    if (S.scheme === "modn") {
      dn.text("sub", "none: hash mod " + S.n);
      dn.text("meta", "a rule, not a list");
    } else {
      dn.text("sub", S.scheme === "fixed" ? fmt(S.parts) + " partitions" : (S.scheme === "big" && S.bigOpen ? "one building" : "by year"));
      dn.text("meta", S.dir ? "entry by entry" : "switches at once");
    }
    dn.set(lost(S) ? "bad" : "");

    var it = api.node("intake");
    it.text("meta", S.skew ? "+2,400 deposit" : "nothing extra");
    it.set(S.skew ? "warn" : "");

    S.stat.open(String(use.length));
    S.stat.max(fmt(T.max));
    S.stat.mean(fmt(T.mean));
    S.stat.wait(fmt(T.wait));
    S.stat.moved(fmt(S.moved));
    S.stat.lost(fmt(lost(S)));
    S.stat.asked(S.asked === null ? "-" : String(S.asked));

    S.ctl.open.disable(pending(S) || (S.scheme === "big" ? S.bigOpen : S.n >= MAX_B));
    S.ctl.van.disable(!pending(S));
    S.ctl.all.disable(!pending(S));
    S.ctl.salt.disable(!S.skew);
  }

  /* ---------- "what is this box" ---------- */

  function info(api, id) {
    var S = api.state;
    if (id === "intake") {
      return "<strong>Night intake.</strong> 1,200 new records arrive each night, all dated this year, and each building's night clerk files 600. " +
        (S.skew ? "Tonight the Ellingham deposit adds 2,400 papers from 1931, " + (S.salt ? "each keyed by deposit and item number." : "all under one deposit number.") : "No deposit tonight.");
    }
    if (id === "dir") {
      if (S.scheme === "modn") return "<strong>No directory.</strong> Under hash mod N anyone can work out a record's building from its number, so there is no list to keep. But when N changes, the rule changes for every record at once.";
      return "<strong>The directory.</strong> Every lookup goes through it: it names the building for each " +
        (S.scheme === "fixed" ? "partition" : "run of years") + ". It switches " + (S.dir ? "entry by entry: each piece is copied first, and its entry changes when it lands." : "at once, when a building opens, before the vans have moved anything.") +
        " Records nobody can find right now: " + fmt(lost(S)) + ".";
    }
    var i = Number(id.slice(1));
    var open = S.scheme === "big" && i === BIG_SLOT ? S.bigOpen : i < S.n;
    if (!open) return "<strong>" + cap(nameOf(S, i)) + ".</strong> Not open yet. Press Open a building.";
    var T = tally(S);
    return "<strong>" + cap(nameOf(S, i)) + ".</strong> Holds " + holdSub(S, i) + ": " + fmt(stored(S, i)) + " records on its shelves. New records tonight: " +
      fmt(T.L[i]) + "; its night " + (capOf(S, i) > CLERK ? "clerks file " : "clerk files ") + fmt(capOf(S, i)) + ".";
  }

  /* ---------- the module ---------- */

  DL.sims.define("s3e07", {
    diagram: DIAGRAM,
    startClock: NOON,

    setup: function (api) {
      var S = api.state;
      S.scheme = "split";
      S.parts = 120;
      S.dir = false;
      S.skew = false;
      S.salt = false;
      api.speed = 0;

      S.ctl = {};
      S.ctl.scheme = api.control.select("scheme", "How records are split", SCHEMES, "split", function (v) { setScheme(api, v); });
      S.ctl.parts = api.control.select("parts", "Fixed partitions", PARTS, 120, function (v) { setParts(api, v); });
      S.ctl.dir = api.control.toggle("dir", "Switch the directory entry by entry, as each piece lands", false, function (on) { setDir(api, on); });
      S.ctl.skew = api.control.toggle("skew", "The Ellingham deposit: 2,400 papers tonight, one deposit number", false, function (on) { setSkew(api, on); });
      S.ctl.salt = api.control.toggle("salt", "Key the deposit by deposit and item number", false, function (on) { setSalt(api, on); });
      S.ctl.open = api.control.button("open", "Open a building", function () { openBuilding(api); });
      S.ctl.van = api.control.button("van", "Send the next van (30,000 records)", function () { sendVan(api); });
      S.ctl.all = api.control.button("all", "Send every van left", function () { sendAll(api); });
      S.ctl.lookup = api.control.button("lookup", "Look up No. 1,200,000", function () { lookup(api); });
      S.ctl.q1931 = api.control.button("q1931", "Ask for every record from 1931", function () { ask1931(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        open: api.stat("open", "buildings in use", ""),
        max: api.stat("max", "busiest building, new records tonight", "bad"),
        mean: api.stat("mean", "average building, new records tonight", ""),
        wait: api.stat("wait", "records left waiting at dawn", "warn"),
        moved: api.stat("moved", "records to move for the last opening", ""),
        lost: api.stat("lost", "records nobody can find right now", "bad"),
        asked: api.stat("asked", "buildings asked for every record from 1931", "")
      };

      api.onNodeClick(function (id) { api.info(info(api, id)); });
      api.info("<strong>Tip:</strong> click any box to see what it holds in plain words.");

      startWeek(api);
    },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      var a;
      var b;
      var i;

      // 1. The opening state: three buildings split by year, before the Ropewalk opens.
      t.expect(n("open") === 3 && n("max") === 1200 && n("mean") === 400 && n("wait") === 600 && n("moved") === 0 &&
        n("lost") === 0 && t.stat("asked") === "-" && t.node("b2").text.meta === "1,200 tonight, 600 wait" &&
        t.node("b0").text.meta === "0 tonight" && t.node("b3").text.sub === "not open",
        "Monday noon: the Glasshouse takes all 1,200 a night and leaves 600 at dawn; the average building takes 400");

      // 2. As now: the Ropewalk opens, takes 2013 onward, and the directory switches at once.
      t.click("open");
      t.expect(n("open") === 4 && n("moved") === 120000 && n("lost") === 120000 && n("max") === 1200 && n("mean") === 300 &&
        n("wait") === 600 && t.node("b3").text.sub === "2013 onward" && t.node("b2").text.sub === "2000 to 2012" &&
        t.logText().indexOf("Monday 2 November, 12:00. The Ropewalk opens and takes the newer half of the Glasshouse's records: 2013 onward, 120,000 records, in 4 vans of 30,000") >= 0,
        "Range by year: the Ropewalk takes 120,000 records, all 120,000 are unreachable at noon, and it now takes all 1,200 a night");

      // 3. The Monday birth is in no building until Thursday's van.
      t.click("lookup");
      a = t.logText().indexOf("Not found in any building.") >= 0;
      t.click("van");
      b = n("lost");
      t.click("van");
      t.click("van");
      t.click("lookup");
      t.expect(a && b === 90000 && n("lost") === 30000 &&
        t.logText().split("Not found in any building.").length - 1 === 2,
        "The birth is not found on Monday, and still not found after three vans; 90,000 then 30,000 records are unreachable");
      t.click("van");
      t.click("lookup");
      t.expect(n("lost") === 0 &&
        t.logText().indexOf("Thursday 5 November, 17:00. Van 4 of 4 lands at the Ropewalk: 30,000 records. Records nobody could find until it landed: 30,000.") >= 0 &&
        t.logText().indexOf("Lookup No. 1,200,000, a birth registered on Monday 2 November. Found at the Ropewalk.") >= 0,
        "Van 4 of 4 lands on Thursday at 17:00, and the birth is found at the Ropewalk");

      // 4. A year in one place.
      t.click("q1931");
      t.expect(t.stat("asked") === 1 && t.logText().indexOf("Buildings asked: 1.") >= 0, "Range by year: 1931 is asked of one building");

      // 5. The directory entry by entry: nothing is ever unreachable, but the queue moved too.
      t.set("dir", true);
      t.click("open");
      t.click("lookup");
      t.expect(n("moved") === 120000 && n("lost") === 0 && n("max") === 1200 && n("wait") === 600 &&
        t.logText().indexOf("Found at the Glasshouse.") >= 0,
        "Entry by entry: 120,000 records move with none unreachable, and the birth is found at the Glasshouse until its van lands");

      // 6. By year, a new building for each new year: nothing moves, and the queue follows the year.
      t.set("scheme", "year");
      t.click("open");
      a = n("moved");
      t.click("open");
      t.expect(a === 0 && n("moved") === 0 && n("open") === 5 && n("max") === 1200 && n("mean") === 240 && n("wait") === 600 &&
        t.node("b4").text.sub === "2028 onward" && t.node("b3").text.sub === "2027",
        "A building per year: five buildings, nothing moved, busiest 1,200 against an average of 240");

      // 7. Hash mod N: an even spread, but 3 to 4 moves three quarters, and 4 to 5 four fifths.
      t.set("scheme", "modn");
      a = n("max") === 400 && n("mean") === 400 && n("wait") === 0;
      t.click("open");
      t.expect(a && n("moved") === 900000 && n("lost") === 900000 && n("max") === 300 && n("mean") === 300 &&
        t.logText().indexOf("900,000 of 1,200,000 records change building, in 30 vans") >= 0,
        "Hash mod N: 400 each; opening a fourth moves 900,000 of 1,200,000, all unreachable until their vans land");
      t.click("q1931");
      t.click("all");
      t.click("open");
      t.expect(t.stat("asked") === 4 && n("moved") === 960000 && n("lost") === 960000 && n("mean") === 240 &&
        t.logText().indexOf("in 32 vans") >= 0,
        "Hash mod N: 1931 is asked of all 4 buildings; a fifth building moves 960,000 in 32 vans");

      // 8. The toy hash, checked independently: one-to-one, and exactly three quarters move from mod 3 to mod 4.
      var seen = {};
      var dup = 0;
      var move34 = 0;
      for (i = 1; i <= 1200000; i++) {
        var h = (7919 * i) % 1200000;
        if (h % 3 !== h % 4) move34 += 1;
        if (i <= 120000) { if (seen[h]) dup += 1; seen[h] = true; }
      }
      t.expect(move34 === 900000 && dup === 0 && (7919 * 1200000) % 1200000 === 0 && (7919 * 1200001) % 1200000 === 7919 &&
        7919 % 120 === 119 && 7919 % 4 === 3,
        "Toy hash: no repeats, 900,000 of 1,200,000 change building from mod 3 to mod 4, the birth hashes to 0 and the deposit to 7,919");

      // 9. Fixed partitions with the directory entry by entry: a quarter moves, and nothing is lost.
      t.set("scheme", "fixed");
      t.click("open");
      t.expect(n("moved") === 300000 && n("lost") === 0 && n("max") === 300 && n("mean") === 300 && n("wait") === 0 &&
        t.node("b3").text.sub === "30 partitions" &&
        t.logText().indexOf("The Ropewalk opens and takes 30 of the 120 partitions, one at a time from whichever building holds most: 300,000 records, in 10 vans.") >= 0,
        "120 fixed partitions: the fourth building takes 30 whole partitions, 300,000 records, and none is unreachable");
      t.click("q1931");
      t.expect(t.stat("asked") === 4 && t.logText().indexOf("all 120 partitions read their by-date indexes") >= 0,
        "Fixed partitions: 1931 is asked of all 4 buildings, every partition reading its by-date index");

      // 10. The Ellingham deposit: one deposit number makes one hot partition; keying by item spreads it.
      t.set("skew", true);
      a = n("max") === 2700 && n("mean") === 900 && n("wait") === 2100 && t.node("b3").text.meta === "2,700 tonight, 2,100 wait";
      t.set("salt", true);
      t.expect(a && n("max") === 900 && n("mean") === 900 && n("wait") === 1200,
        "The deposit under one number: the Ropewalk takes 2,700 against an average of 900; keyed by item, 900 each");
      t.set("salt", false);
      t.click("all");
      t.click("open");
      t.expect(n("moved") === 240000 && n("max") === 2640 && n("mean") === 720 && t.node("b4").text.meta === "2,640 tonight, 2,040 wait",
        "Five buildings: 24 partitions move, 240,000 records, and the deposit's partition is now the Tannery's: 2,640 tonight");
      t.set("skew", false);

      // 11. The directory at once, under fixed partitions: the moving partitions are unreachable.
      t.set("dir", false);
      t.click("open");
      t.click("van");
      t.expect(n("lost") === 270000 && n("max") === 300,
        "Fixed partitions with the directory switched at once: 300,000 unreachable at noon, 270,000 after the first van");

      // 12. Twelve partitions over five buildings: whole partitions don't divide evenly.
      t.set("parts", 12);
      t.click("open");
      t.click("all");
      t.click("open");
      t.expect(n("moved") === 200000 && n("max") === 300 && n("mean") === 240 && t.node("b0").text.sub === "2 partitions" &&
        t.node("b2").text.sub === "3 partitions",
        "12 partitions over five buildings: the fifth takes 2, 200,000 records, and loads are 300 against an average of 240");

      // 13. One bigger building: one place, nothing waits, until the deposit.
      t.set("scheme", "big");
      t.set("dir", true);
      t.click("open");
      a = n("moved") === 1200000 && n("open") === 1 && n("max") === 1200 && n("mean") === 1200 && n("wait") === 0 && n("lost") === 0 &&
        t.logText().indexOf("in 40 vans") >= 0;
      t.set("skew", true);
      t.click("q1931");
      t.expect(a && n("wait") === 2400 && n("max") === 3600 && t.stat("asked") === 1,
        "The Wool Store: 1,200,000 records in 40 vans, two clerks file 1,200 a night; the deposit leaves 2,400 at dawn");
    }
  });
})();
