/* sims/s2e14-v1.0.1.js  (published as sims/s2e14.js)
   Case s2e14 "Name Tags for a Billion Things": an ID-generation lab for the night shift at the city
   mortuary on Marrowgate. Three machines make numbers for the Casebook, the mortuary's records
   database, which refuses any number it already holds: the desk printer, the cold-room printer and
   the scanning station, which numbers one line of the city's old registers every millisecond from
   22:00 to 06:00. The learner picks how numbers are made (Snowflake-style, the town hall counter,
   two ticket servers, UUID v4, UUID v7), the cold-room printer's machine number, the clock the
   machines count from and a clock guard; takes the town hall down; steps the scanner's clock back
   with NTP; puts the clocks back an hour; and reads the base62 length for a number of codes.

   CHANGELOG
   v1.0.1 (2026-10-11) spot-check follow-ups: UUID v7's sorts-by-time stat reads "roughly", as the
     case's tradeoff table says (to the millisecond within a machine); selfTest 11 and its comment
     match; the case is now content/s2/s2e14-v1.0.3.json.
   v1.0.0 (2026-10-09) first version: real time T is counted in whole milliseconds from 22:00:00.000
     local summer time on Thursday 22 October 2026; the clock runs a minute a second, and every
     millisecond is processed in order, in blocks, so results never depend on the frame rate.
     Strategies: Snowflake-style (41-bit milliseconds since 1 January 2026, 10-bit machine number,
     12-bit count), the town hall counter (auto-increment, one 25 ms trip per number, one trip at a
     time), two ticket servers (A odd, B even, round robin), UUID v4, UUID v7. Controls: strategy,
     cold-room printer (machine 7 copied, machine 8 own, off), clock (wall clock in local time, or
     UTC), clock guard, town hall down, base62 code count, an arrival at the desk or the cold-room
     door, an NTP step back of 250 ms, the clocks going back an hour, skip an hour, skip to the end
     of the night, reset. Stats: duplicates, lines the scanner numbered, IDs a second per generator,
     sorts by time, size, years left on the timestamp, base62 characters. selfTest: 14 assertions.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e14-v1.0.3.json):
   - post: until July every number was a 25 ms trip to the town hall counter (TRIP); on Friday
     3 July it was down for four hours. Ingeborg's layout copies Twitter's README: 41 bits of
     milliseconds since midnight on 1 January 2026 by each machine's own clock, a 10-bit machine
     number and a 12-bit count; an ID is time x 2^22 + machine x 2^12 + count. Desk printer =
     machine 1, scanning station = machine 7, and the cold-room printer, a copy of the scanner's
     disk, is machine 7 too. The scanner numbers one line a millisecond from 22:00 to 06:00:
     8 x 3,600,000 = 28,800,000 lines (NIGHT).
   - the epoch and the clocks: the city keeps UTC+0 in winter and UTC+1 in summer, so midnight on
     1 January 2026 local is 00:00 UTC (Unix ms 1,767,225,600,000). From then to 22:00:00.000 local
     on 22 October is 294 days x 86,400,000 + 79,200,000 = 25,480,800,000 ms by the wall clock
     (B_LOCAL). That instant is 21:00 UTC, so the UTC count is 3,600,000 lower (B_UTC =
     25,477,200,000), and Unix ms is 1,767,225,600,000 + 25,477,200,000 = 1,792,702,800,000 (U0).
   - Philomena's log, as T in ms after 22:00:00.000 (the tag numbers use the wall-clock count):
     cold-room tags, machine 7, count 0: 22:17:41.302 (T 1,061,302, tag 106878672786452480),
     23:41:07.214 (6,067,214, 106899669103177728), 00:26:55.630 (8,815,630), 01:12:19.048
     (11,539,048), 01:58:02.771 (14,282,771), 02:44:36.115 (17,076,115), 03:31:50.904 (19,910,904),
     04:20:13.467 (22,813,467), 05:09:28.380 (25,768,380, 106982301782536192): 9 tags, and the
     scanner, also machine 7 with count 0, numbered a line in each of those milliseconds first, so
     9 refused. Desk tags, machine 1: 22:48:12.519 (2,892,519, 106886353467215872), 23:05:33.086
     (3,933,086), 00:52:40.211 (10,360,211), 02:10:07.655 (15,007,655), 03:58:21.937 (21,501,937),
     05:36:44.102 (27,404,102): 6 tags, 0 refused. As machine 8 the first cold-room tag is
     106878672786452480 + 4,096 = 106878672786456576.
   - u/stepped_clock_anatoly and OP: the machines read the wall clock in local time, and the
     clocks go back at 02:00 on Sunday 25 October (the last Sunday in October 2026).
   - u/short_code_zenobia: 62^6 = 56,800,235,584 codes; a random repeat is more likely than not
     after about sqrt(2 x ln 2 x 62^6) = 280,609.8, "about 280,600" codes.
   - reply options: index 0 (the counter): 1,000 / 25 = 40 lines a second, 28,800,000 / 25 =
     1,152,000 a night, 25 times slower; nothing while it's down. Index 1 (machine 8, UTC, guard):
     a 250 ms NTP step makes the next reading the last one minus 249, so the guard holds the
     readings last - 249 .. last - 1, 249 ms, then gives the last millisecond count 1; 0
     refused. Index 2 (machine 8 only): after the clocks go back the scanner relives an hour of
     readings, 3,600,000 refused. Index 3 (UUID v4): 16 bytes and 36 characters against 8 bytes
     and an 18-digit tag; no time order.
   - explain: 2^12 = 4,096 per millisecond per machine, 4,096,000 a second; 41 + 10 + 12 = 63
     bits; 2^41 ms = 2,199,023,255,552 ms = 69.68 years of 365.25 days (Twitter: "69 years"),
     which from 1 January 2026 runs out on 7 September 2095; 68.9 years are left at 22:00 on
     22 October 2026. UUID v7: 2^48 ms from 1970 at 365.2425 days a year reaches 10889 (RFC 9562:
     "until the year 10889 AD"); 8,862.8 years are left. A billion v4s: n^2 / 2^123 = 9.4e-20,
     about 1 in 10^19. JavaScript: 2^53 = 9,007,199,254,740,992; between 2^56 and 2^57, where
     these tags sit, doubles are 16 apart. Base62: 62^5 = 916,132,832 < 10^9 <= 62^6, so 6
     characters; 62^6 < 10^12 <= 62^7 = 3,521,614,606,208, so 7; 62^3 = 238,328 < 10^6 <= 62^4 =
     14,776,336, so 4. Twitter's code epoch twepoch = 1288834974657 is 01:42:54.657 UTC on
     4 November 2010, and its 41 bits run out on 10 July 2080.
   - cold case: 312,450 random 6-character codes: P(any repeat) = 1 - exp(-n^2 / (2 x 62^6)) =
     0.577, more likely than not.
   - story values with no source: the town hall counter's next number at 22:00, 70,412,553, and
     ticket servers A at 70,412,553 (odd) and B at 70,412,554 (even).

   Teaching model (stated in sim.lede):
   - Every machine makes numbers alone, except under the counter strategies. Within one
     millisecond the scanner goes first, then any scheduled tag, then held tags released by the
     guard. The Casebook refuses any number it already holds; the sim keeps, for each machine
     number and count, the set of time readings already used, as merged ranges, and counts
     overlaps exactly. Nothing is stored per ID, so a whole night is a few dozen ranges.
   - Snowflake-style: a machine's reading at T is the wall-clock count (B_LOCAL + T, minus an hour
     once the clocks go back) or the UTC count (B_UTC + T), minus its NTP steps. Without the guard
     the generator is naive: count 0 unless the reading equals its last one, then count + 1. With
     the guard it waits while the reading is below its last one, uses count + 1 when it equals it
     (as Twitter's IdWorker does), and count 0 above it. Tags held by the guard print in the
     millisecond the printer's clock reaches its last reading.
   - Counters: the scanner asks once every 25 ms (T a multiple of 25) and waits for the answer;
     a printer asks once per tag. Auto-increment: one counter at the town hall; while it's down the
     scanner gets nothing and tags wait, then print when it's back. Ticket servers: requests go
     round robin, A then B; with A down every request goes to B.
   - UUIDs: printers draw their UUIDs from api.rand(), the engine's seeded generator, so a run
     always prints the same ones. The scanner's are counted, not drawn: the chance of any repeat
     among 28,800,000 v4s is (2.88e7)^2 / 2^123 = 7.8e-23, so the sim counts none. UUID v7 reads
     Unix ms (U0 + T minus NTP steps); after a step back it counts the UUIDs that sort before one
     it made earlier.
   - Clocks: the clocks going back moves every wall clock back an hour once a night; the scanner
     stops at 06:00 by the wall clock, so its night gets an hour longer. Only Snowflake in local
     mode counts from the wall clock. NTP steps only the scanner's clock. Every event is logged
     before it changes anything, so its line carries the time and readings as they were.

   Self-test arithmetic:
   - Arithmetic: 2^12 = 4,096, 2^10 = 1,024, 2^41 = 2,199,023,255,552; capacity 4,096 x 1,000 =
     4,096,000; years left at T 0: (2^41 - 25,477,200,000) / 31,557,600,000 = 68.88, "68.9".
   - Base62: 1 million needs 4 characters, 1 billion 6, 1 trillion 7.
   - Copied disk, skip to the end: the scanner numbers T 0 .. 28,799,999, 28,800,000 lines; the 9
     cold-room tags are refused and the 6 desk tags saved.
   - Machine 8: the first cold-room tag is 106878672786456576, saved; 0 duplicates.
   - Local time, no guard: four one-hour skips reach T 14,400,000, 02:00:00.000, after the scanner
     used readings B_LOCAL + 0 .. B_LOCAL + 14,400,000. The clocks go back; the next hour's
     readings are B_LOCAL + 10,800,001 .. B_LOCAL + 14,400,000, all used: 3,600,000 duplicates. The
     scheduled tags in that hour (desk at 15,007,655, machine 8 at 17,076,115) land on readings
     those machines never used, so the total is exactly 3,600,000.
   - UTC and the guard: the clocks going back change no reading; at T 18,000,000 an NTP step of
     250 ms is held for 249 ms, 0 duplicates.
   - UTC, no guard: at T 3,600,000 the same step reuses readings last - 249 .. last, 250
     duplicates; no tag is scheduled between T 3,600,000 and 3,660,000.
   - Counter: lines at T 25k for k = 0 .. 1,151,999: 1,152,000 a night. Down at T 3,600,000 for an
     hour: no lines; the desk's click and its 23:05:33.086 tag wait ("1 tag, 2 waiting"), and print
     when the counter is back ("3 tags, 0 refused").
   - Ticket servers, A down from T 3,600,000: B takes every request, k = 144,001 .. 288,000,
     144,000 more lines.
   - UUID v4: 0 duplicates, no order, 16 bytes, no clock. UUID v7 at T 3,660,000: (2^48 -
     1,792,702,803,660,000) / 31,556,952,000 = 8,862.78, "8,862.8"; a 250 ms step makes 249
     UUIDs sort before one made earlier, and none repeats.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px):
   - Middle column (x 365, 250 wide, 62 high, y 70, 200, 330; boxes span 240 to 490): longest
     sub "machine 7, a line every ms", 26 chars, 187px; longest meta "32,400,000 lines, 3,600,000
     refused", 35 chars, 231px. Vertical gaps: 101 to 169 and 231 to 299, 68px each.
   - Town hall (db, x 105, 170 wide, 84 high, spans 20 to 190): label "Town hall counter", 17
     chars, 133px; sub "not used since July" and "one number per trip", 19 chars, 137px; meta
     "A down, B carries on", 20 chars, 132px. Gap to the middle column: 50px.
   - The Casebook (db, x 625, 200 wide, 84 high, spans 525 to 725): sub "unique key on numbers",
     21 chars, 151px; meta "3,600,009 refused", 17 chars, 112px. Gap: 35px. No edge labels.

   Catalog note: the case's concepts are the catalog's own ids for s2e14 (unique-id-generation,
   auto-increment, uuid-v4-vs-v7, snowflake-style-ids). Board strings point at
   single-point-of-failure, privacy, sharding, indexes, clock-skew, ntp, primary-keys and
   back-of-envelope-estimation.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 60;                      // sim seconds per real second: a minute a second
  var START_CLOCK = 79200;             // 22:00:00, Thursday 22 October 2026, local summer time
  var DAY_MS = 86400000;
  var HOUR = 3600000;
  var NIGHT = 28800000;                // 22:00 to 06:00: the scanner's 8 hours, one line a millisecond
  var B_LOCAL = 25480800000;           // wall-clock ms from 00:00 on 1 January 2026 to T 0
  var B_UTC = B_LOCAL - HOUR;          // the same instant counted in UTC (summer time is UTC+1)
  var U0 = 1792702800000;              // Unix ms at T 0: 21:00:00.000 UTC on 22 October 2026
  var TRIP = 25;                       // ms per number from the town hall, one trip at a time
  var NTP_STEP = 250;                  // ms the NTP step puts the scanner's clock back
  var COUNT_BITS = 12;
  var MACHINE_BITS = 10;
  var TIME_BITS = 41;
  var SHIFT_MACHINE = ipow(2, COUNT_BITS);                 // 4,096: also the IDs per ms per machine
  var SHIFT_TIME = ipow(2, COUNT_BITS + MACHINE_BITS);     // 4,194,304
  var COUNT_MAX = SHIFT_MACHINE - 1;                       // 4,095
  var T41 = ipow(2, TIME_BITS);                            // 2,199,023,255,552 ms
  var T48 = ipow(2, 48);                                   // 281,474,976,710,656 ms
  var YEAR = 31557600000;              // 365.25 days, for the 41-bit field (Twitter: "69 years")
  var YEAR_G = 31556952000;            // 365.2425 days, for UUID v7 (RFC 9562: "the year 10889 AD")
  var COUNTER_START = 70412553;        // the town hall counter's next number at 22:00 (story value)
  var MAX_T = 2 * DAY_MS;              // the replay stops two days in
  var EPS = 1e-6;
  var DOT_EVERY = 0.3;                 // real seconds between the scanner's sample dots
  var DOT_SPEED = 300;                 // viewBox units per real second

  // Philomena's log, in ms after 22:00:00.000 (see the header).
  var NIGHT_TAGS = [1061302, 6067214, 8815630, 11539048, 14282771, 17076115, 19910904, 22813467, 25768380];
  var DESK_TAGS = [2892519, 3933086, 10360211, 15007655, 21501937, 27404102];
  var PRINTERS = ["desk", "night"];
  var NAMES = { desk: "Desk printer", night: "Cold-room printer" };

  var STRATEGIES = [
    { value: "snowflake", label: "Snowflake-style: time, machine, count (as now)" },
    { value: "auto", label: "Town hall counter: auto-increment" },
    { value: "ticket", label: "Two ticket servers: A odd, B even" },
    { value: "v4", label: "UUID v4: random" },
    { value: "v7", label: "UUID v7: Unix time, then random" }
  ];
  var NIGHTS = [
    { value: "copied", label: "Machine 7, copied disk (as now)" },
    { value: "own", label: "Machine 8, its own number" },
    { value: "off", label: "Off tonight" }
  ];
  var CLOCKS = [
    { value: "local", label: "Wall clock, local time (as now)" },
    { value: "utc", label: "UTC" }
  ];
  var CODES = [
    { value: 1000000, label: "1 million" },
    { value: 1000000000, label: "1 billion" },
    { value: 1000000000000, label: "1 trillion" }
  ];
  var SORTS = { snowflake: "roughly", auto: "yes", ticket: "roughly", v4: "no", v7: "roughly" };
  var STRAT_NAME = { snowflake: "Snowflake-style numbering", auto: "The counter", ticket: "The ticket servers", v4: "UUID v4", v7: "UUID v7" };

  /* ---------- small helpers ---------- */

  // Whole-number powers by repeated multiplication: exact while every step stays under 2^53.
  function ipow(b, e) {
    var r = 1;
    for (var i = 0; i < e; i++) r *= b;
    return r;
  }

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

  // 68.8755 -> "68.9", 8862.778 -> "8,862.8".
  function fmt1(x) {
    var r = Math.round(x * 10);
    var i = Math.floor(r / 10);
    return fmt(i) + "." + (r - i * 10);
  }

  function pad(n, w) {
    var s = String(n);
    while (s.length < w) s = "0" + s;
    return s;
  }

  function plural(n, one, many) { return fmt(n) + " " + (n === 1 ? one : many); }

  // Milliseconds since midnight -> "22:17:41.302".
  function wallOf(ms) {
    var t = ((ms % DAY_MS) + DAY_MS) % DAY_MS;
    return pad(Math.floor(t / HOUR), 2) + ":" + pad(Math.floor(t / 60000) % 60, 2) + ":" +
      pad(Math.floor(t / 1000) % 60, 2) + "." + pad(t % 1000, 3);
  }

  function wallText(S, m) { return wallOf(START_CLOCK * 1000 + m + S.wall); }

  function setClock(api, m) { api.clock = START_CLOCK + (m + api.state.wall) / 1000; }

  function waitText(ms) {
    return ms >= 60000 ? plural(Math.round(ms / 60000), "minute", "minutes") : fmt(ms) + " ms";
  }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  // The shortest base62 code length L with 62^L >= n.
  function b62Len(n) {
    var L = 1;
    var p = 62;
    while (p < n) { p *= 62; L += 1; }
    return L;
  }

  function b62Text(n) {
    var L = b62Len(n);
    return fmt(n) + " codes: 62^" + (L - 1) + " = " + fmt(ipow(62, L - 1)) + " is not enough, and 62^" + L + " = " +
      fmt(ipow(62, L)) + " is enough: " + L + " characters.";
  }

  // time x 2^22 + machine x 2^12 + count, as a decimal string. The result is above 2^53, so it is
  // built from two exact halves instead of one Number: the reading is split at 10^6, and every
  // partial product stays under 10^13.
  function snowId(r, mid, count) {
    var hi = Math.floor(r / 1000000);
    var lo = r - hi * 1000000;
    var low = lo * SHIFT_TIME + mid * SHIFT_MACHINE + count;
    var carry = Math.floor(low / 1000000);
    low -= carry * 1000000;
    var high = hi * SHIFT_TIME + carry;
    return high > 0 ? String(high) + pad(low, 6) : String(low);
  }

  function hex8(api) {
    var s = Math.floor(api.rand() * 4294967296).toString(16);
    return pad(s, 8);
  }

  function uuidText(h) {
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20, 32);
  }

  // 32 hex digits with the version digit at index 12 and the variant (8, 9, a or b) at index 16.
  function stamp(h, version) {
    var variant = "89ab".charAt(parseInt(h.charAt(16), 16) & 3);
    return h.slice(0, 12) + version + h.slice(13, 16) + variant + h.slice(17, 32);
  }

  function uuid4(api) { return uuidText(stamp(hex8(api) + hex8(api) + hex8(api) + hex8(api), "4")); }

  function uuid7(api, unix) {
    var t = pad(Math.floor(unix).toString(16), 12);
    return uuidText(stamp(t + hex8(api) + hex8(api) + hex8(api).slice(0, 4), "7"));
  }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 400,
    aria: "ID-generation lab for the night shift at the Marrowgate mortuary. On the left, the town hall counter, which hands out numbers only under the counter strategies. In the middle, three machines: the desk printer, the cold-room printer and the scanning station, which numbers one line of the old registers every millisecond from 22:00 to 06:00. On the right, the Casebook, the mortuary's records database, which refuses any number it already holds.",
    nodes: [
      { id: "townhall", label: "Town hall counter", sub: "not used since July", meta: "not asked", x: 105, y: 200, w: 170, h: 84, shape: "db", tone: "muted" },
      { id: "desk", label: "Desk printer", sub: "machine 1", meta: "0 tags, 0 refused", x: 365, y: 70, w: 250, h: 62, shape: "box", tone: "" },
      { id: "night", label: "Cold-room printer", sub: "machine 7 (copied disk)", meta: "0 tags, 0 refused", x: 365, y: 200, w: 250, h: 62, shape: "box", tone: "" },
      { id: "scanner", label: "Scanning station", sub: "machine 7, a line every ms", meta: "0 lines", x: 365, y: 330, w: 250, h: 62, shape: "box", tone: "" },
      { id: "casebook", label: "The Casebook", sub: "unique key on numbers", meta: "0 refused", x: 625, y: 200, w: 200, h: 84, shape: "db", tone: "ok" }
    ],
    edges: [
      { from: "townhall", to: "desk", dash: true },
      { from: "townhall", to: "night", dash: true },
      { from: "townhall", to: "scanner", dash: true },
      { from: "desk", to: "casebook" },
      { from: "night", to: "casebook" },
      { from: "scanner", to: "casebook" }
    ]
  };

  /* ---------- the Casebook's memory of numbers ---------- */

  // Adds the readings a..b to the sorted, merged ranges kept for one machine number and count,
  // and returns how many of them were already there: numbers the Casebook refuses.
  function addRange(S, key, a, b) {
    var list = S.sets[key] || [];
    var out = [];
    var over = 0;
    var na = a;
    var nb = b;
    var placed = false;
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (x[1] < a - 1) { out.push(x); continue; }
      if (x[0] > b + 1) {
        if (!placed) { out.push([na, nb]); placed = true; }
        out.push(x);
        continue;
      }
      var lo = Math.max(x[0], a);
      var hi = Math.min(x[1], b);
      if (hi >= lo) over += hi - lo + 1;
      if (x[0] < na) na = x[0];
      if (x[1] > nb) nb = x[1];
    }
    if (!placed) out.push([na, nb]);
    S.sets[key] = out;
    return over;
  }

  function makeGen(name, mid) {
    return { name: name, mid: mid, ntp: 0, last: -1, count: 0, issued: 0, refused: 0, tags: 0,
      pend: [], held: 0, holdRun: 0, maxU: -1, disRun: 0, hadDup: false };
  }

  // A Snowflake machine's clock reading at T m, in ms since the epoch.
  function reading(S, g, m) { return (S.clock === "local" ? B_LOCAL + S.wall : B_UTC) + m + g.ntp; }

  function unixMs(S, g, m) { return U0 + m + g.ntp; }

  function issue(S, g, a, b, count) {
    var over = addRange(S, g.mid + ":" + count, a, b);
    g.issued += b - a + 1;
    g.refused += over;
    S.dups += over;
    return over;
  }

  /* ---------- the scanning station ---------- */

  function scan(api, a, b) {
    var S = api.state;
    var g = S.gen.scanner;
    var lo = Math.max(a, 0);
    var hi = Math.min(b, S.winEnd - 1);
    if (lo > hi) return;
    var before = g.refused;
    if (S.strategy === "snowflake") scanSnow(api, g, lo, hi);
    else if (S.strategy === "auto" || S.strategy === "ticket") scanCounter(api, g, lo, hi);
    else scanUuid(api, g, lo, hi);
    S.scanBad = g.refused > before;
    if (S.scanBad && !g.hadDup) {
      g.hadDup = true;
      setClock(api, lo);
      api.log("From " + wallText(S, lo) + " the Casebook refuses the scanner's lines: its clock is reading milliseconds it has already used, so machine " +
        g.mid + " is making numbers it made before.", "bad");
    }
  }

  // One line a millisecond. Readings are contiguous within a block, so each case is a range.
  function scanSnow(api, g, lo, hi) {
    var S = api.state;
    var base = reading(S, g, 0);
    var r0 = base + lo;
    var r1 = base + hi;
    if (S.guard && r0 < g.last) {
      var stop = Math.min(r1, g.last - 1);
      g.held += stop - r0 + 1;
      g.holdRun += stop - r0 + 1;
      r0 = stop + 1;
      if (r0 > r1) return;
    }
    if (r0 === g.last) {
      if (g.count < COUNT_MAX) { issue(S, g, r0, r0, g.count + 1); g.count += 1; }
      if (g.holdRun) {
        setClock(api, r0 - base);
        api.log("The guard held the scanner for " + fmt(g.holdRun) + " ms, until its clock read the last millisecond it had used, " +
          fmt(g.last) + "; it went on with count " + g.count + " in that millisecond. Nothing was refused.", "ok");
        g.holdRun = 0;
      }
      r0 += 1;
      if (r0 > r1) return;
    }
    issue(S, g, r0, r1, 0);
    g.count = 0;
    g.last = r1;
  }

  // One request every 25 ms, at T = 25k, waiting for each answer.
  function scanCounter(api, g, lo, hi) {
    var S = api.state;
    if (S.strategy === "auto" && S.down) return;
    var n = Math.floor(hi / TRIP) - Math.ceil(lo / TRIP) + 1;
    if (n <= 0) return;
    g.issued += n;
    if (S.strategy === "auto") S.counter += n;
    else ticketMany(S, n);
  }

  function ticketMany(S, n) {
    if (S.down) { S.b += 2 * n; return; }
    var toA = S.ptr === 0 ? Math.ceil(n / 2) : Math.floor(n / 2);
    S.a += 2 * toA;
    S.b += 2 * (n - toA);
    S.ptr = (S.ptr + n) % 2;
  }

  function ticketOne(S) {
    var useA = !S.down && S.ptr === 0;
    var v;
    if (useA) { v = S.a; S.a += 2; } else { v = S.b; S.b += 2; }
    if (!S.down) S.ptr = 1 - S.ptr;
    return { v: v, server: useA ? "A" : "B" };
  }

  function scanUuid(api, g, lo, hi) {
    var S = api.state;
    g.issued += hi - lo + 1;
    if (S.strategy !== "v7") return;
    var base = unixMs(S, g, 0);
    var u0 = base + lo;
    var u1 = base + hi;
    if (u0 < g.maxU) g.disRun += Math.min(u1, g.maxU - 1) - u0 + 1;
    if (g.disRun && u1 >= g.maxU) {
      setClock(api, g.maxU - base);
      api.log(fmt(g.disRun) + " of the scanner's UUIDs sort before ones it made earlier, because its clock read those milliseconds again. None repeats: each has 74 random bits.", "warn");
      g.disRun = 0;
    }
    if (u1 > g.maxU) g.maxU = u1;
  }

  /* ---------- the printers ---------- */

  function tagText(g) {
    return plural(g.tags, "tag", "tags") + ", " + (g.pend.length ? fmt(g.pend.length) + " waiting" : fmt(g.refused) + " refused");
  }

  function flash(S, path, bad) {
    if (S.skipping || S.flash.length >= 8) return;
    S.flash.push({ path: path, bad: bad });
  }

  function snowTag(api, g, r, m, note) {
    var S = api.state;
    var count = r === g.last ? g.count + 1 : 0;
    var over = issue(S, g, r, r, count);
    g.last = r;
    g.count = count;
    g.tags += 1;
    setClock(api, m);
    var head = NAMES[g.name] + " (machine " + g.mid + "), " + wallText(S, m) + ": tag " + snowId(r, g.mid, count);
    if (over) {
      api.log(head + ". Refused: number already in use" +
        (g.mid === S.gen.scanner.mid ? ". The scanner is machine " + g.mid + " too." : "."), "bad");
    } else {
      api.log(head + ", saved" + note + ".", "");
    }
    flash(S, [g.name, "casebook"], over > 0);
  }

  function plainTag(api, g, m, note) {
    var S = api.state;
    var id;
    var extra = "";
    if (S.strategy === "auto") {
      id = String(S.counter);
      if (g.name === "night") {
        if (S.firstNo === null) S.firstNo = S.counter;
        S.lastNo = S.counter;
      }
      S.counter += 1;
    } else if (S.strategy === "ticket") {
      var t = ticketOne(S);
      id = String(t.v);
      extra = " from server " + t.server;
    } else if (S.strategy === "v4") {
      id = uuid4(api);
    } else {
      var u = unixMs(S, g, m);
      id = uuid7(api, u);
      if (u < g.maxU) extra = ", which sorts before its last tag";
      if (u > g.maxU) g.maxU = u;
    }
    g.tags += 1;
    setClock(api, m);
    api.log(NAMES[g.name] + ", " + wallText(S, m) + ": tag " + id + extra + ", saved" + note + ".", "");
    flash(S, S.strategy === "auto" || S.strategy === "ticket" ? ["townhall", g.name, "casebook"] : [g.name, "casebook"], false);
  }

  // A tag is asked for at T m (the scanner has already had that millisecond).
  function arrive(api, who, m) {
    var S = api.state;
    var g = S.gen[who];
    if (S.strategy === "snowflake") {
      var r = reading(S, g, m);
      if (S.guard && (g.pend.length || r < g.last)) {
        g.pend.push(m);
        if (g.pend.length === 1) {
          setClock(api, m);
          api.log(NAMES[who] + ", " + wallText(S, m) + ": the guard holds this tag. The printer's clock reads " + fmt(g.last - r) +
            " ms earlier than its last tag, so it waits until it catches up.", "warn");
        }
        return;
      }
      snowTag(api, g, r, m, "");
      return;
    }
    if (S.strategy === "auto" && S.down) {
      g.pend.push(m);
      setClock(api, m);
      api.log(NAMES[who] + ", " + wallText(S, m) + ": no number. The town hall counter isn't answering, so the tag waits.", "bad");
      return;
    }
    plainTag(api, g, m, "");
  }

  // The millisecond a held printer's clock reads its last reading again.
  function pendAt(S, g) { return Math.max(S.now + 1, g.last - reading(S, g, 0)); }

  function releaseSnow(api, g, m) {
    var S = api.state;
    var list = g.pend;
    g.pend = [];
    for (var i = 0; i < list.length; i++) snowTag(api, g, reading(S, g, m), m, " after waiting " + waitText(m - list[i]));
  }

  /* ---------- the night ---------- */

  function endNight(api) {
    var S = api.state;
    var g = S.gen.scanner;
    S.ended = true;
    setClock(api, S.winEnd);
    api.log("The scanner stops: " + plural(g.issued, "line", "lines") + " numbered tonight" +
      (g.refused ? ", " + fmt(g.refused) + " of them refused" : "") + ".", g.refused ? "bad" : "");
    var parts = [];
    if (S.night !== "off") parts.push("cold-room printer " + tagText(S.gen.night));
    parts.push("desk printer " + tagText(S.gen.desk));
    var msg = "End of the night: " + parts.join("; ") + ". Duplicates refused by the Casebook: " + fmt(S.dups) + ".";
    if (S.strategy === "auto" && S.firstNo !== null && S.lastNo > S.firstNo) {
      msg += " The cold-room printer's first and last tags differ by " + fmt(S.lastNo - S.firstNo) +
        ": anyone who sees both can count the records made in between.";
    }
    api.log(msg, S.dups ? "bad" : "ok");
  }

  function nextEvent(S) {
    var e = Infinity;
    if (S.night !== "off" && S.iNight < NIGHT_TAGS.length) e = Math.min(e, NIGHT_TAGS[S.iNight]);
    if (S.iDesk < DESK_TAGS.length) e = Math.min(e, DESK_TAGS[S.iDesk]);
    if (!S.ended) e = Math.min(e, S.winEnd);
    if (S.strategy === "snowflake") {
      for (var i = 0; i < PRINTERS.length; i++) {
        var g = S.gen[PRINTERS[i]];
        if (g.pend.length) e = Math.min(e, pendAt(S, g));
      }
    }
    return e;
  }

  function fire(api, e) {
    var S = api.state;
    if (!S.ended && e === S.winEnd) endNight(api);
    while (S.iNight < NIGHT_TAGS.length && NIGHT_TAGS[S.iNight] === e) {
      if (S.night !== "off") arrive(api, "night", e);
      S.iNight += 1;
    }
    while (S.iDesk < DESK_TAGS.length && DESK_TAGS[S.iDesk] === e) {
      arrive(api, "desk", e);
      S.iDesk += 1;
    }
    if (S.strategy === "snowflake") {
      for (var i = 0; i < PRINTERS.length; i++) {
        var g = S.gen[PRINTERS[i]];
        if (g.pend.length && g.last - reading(S, g, 0) <= e) releaseSnow(api, g, e);
      }
    }
  }

  // Processes every millisecond up to T `to`: the scanner in blocks between events, then each
  // event in its own millisecond.
  function advance(api, to) {
    var S = api.state;
    var guard = 0;
    while (S.now < to && guard < 10000) {
      guard += 1;
      var e = nextEvent(S);
      var stop = Math.min(to, e);
      scan(api, S.now + 1, stop);
      S.now = stop;
      if (stop === e) fire(api, e);
    }
  }

  function introText(S) {
    var head = "Thursday 22 October, 22:00. The scanner starts loading the old registers. ";
    if (S.strategy === "snowflake") {
      return head + "Numbers are Snowflake-style: 41 bits of milliseconds since 1 January 2026 by " +
        (S.clock === "local" ? "the wall clock, local time" : "UTC") + ", a 10-bit machine number and a 12-bit count, one line a millisecond. " +
        "Desk printer: machine 1. Scanner: machine 7. Cold-room printer: " +
        (S.night === "copied" ? "machine 7, copied with the scanner's disk" : (S.night === "own" ? "machine 8, its own" : "off tonight")) +
        ". Clock guard: " + (S.guard ? "on" : "off") + ".";
    }
    if (S.strategy === "auto") {
      return head + "Every number comes from the town hall counter: one 25 ms trip per number, one trip at a time, so the scanner numbers 40 lines a second.";
    }
    if (S.strategy === "ticket") {
      return head + "Two ticket servers at the town hall hand out numbers, A odd and B even, round robin: one 25 ms trip per number, so the scanner numbers 40 lines a second.";
    }
    if (S.strategy === "v4") {
      return head + "Every machine makes random UUID v4s, one line a millisecond: no machine numbers and no clock.";
    }
    return head + "Every machine makes UUID v7s, one line a millisecond: 48 bits of Unix time in milliseconds, then random bits.";
  }

  function startNight(api) {
    var S = api.state;
    S.now = -1;
    S.tms = 0;
    S.wall = 0;
    S.winEnd = NIGHT;
    S.ended = false;
    S.gen = { desk: makeGen("desk", 1), night: makeGen("night", S.night === "own" ? 8 : 7), scanner: makeGen("scanner", 7) };
    S.sets = {};
    S.dups = 0;
    S.counter = COUNTER_START;
    S.a = COUNTER_START;
    S.b = COUNTER_START + 1;
    S.ptr = 0;
    S.iNight = 0;
    S.iDesk = 0;
    S.down = false;
    S.ctl.down.set(false);
    S.firstNo = null;
    S.lastNo = null;
    S.flash = [];
    S.dotClock = 0;
    S.skipping = false;
    S.scanBad = false;
    setClock(api, 0);
    api.log(introText(S), "");
    advance(api, 0);
    draw(api);
  }

  function replay(api, what) {
    var S = api.state;
    setClock(api, Math.max(S.now, 0));
    api.log(what + " Replaying the night from 22:00.", "");
    startNight(api);
  }

  /* ---------- controls ---------- */

  function setStrategy(api, v) {
    var o = pick(STRATEGIES, v);
    if (!o) return;
    api.state.strategy = String(o.value);
    replay(api, "Numbers now: " + o.label + ".");
  }

  function setNight(api, v) {
    var o = pick(NIGHTS, v);
    if (!o) return;
    api.state.night = String(o.value);
    replay(api, "Cold-room printer: " + o.label + ".");
  }

  function setClockMode(api, v) {
    var o = pick(CLOCKS, v);
    if (!o) return;
    api.state.clock = String(o.value);
    replay(api, "Machines count from: " + o.label + ".");
  }

  function setGuard(api, on) {
    api.state.guard = !!on;
    replay(api, on ? "Clock guard on." : "Clock guard off.");
  }

  function setDown(api, on) {
    var S = api.state;
    S.down = !!on;
    var m = Math.max(S.now, 0);
    setClock(api, m);
    if (S.strategy === "auto") {
      if (S.down) {
        api.log("The town hall counter goes down. Nothing can get a number: the scanner stops, and every tag waits.", "bad");
      } else {
        api.log("The town hall counter is back.", "ok");
        for (var i = 0; i < PRINTERS.length; i++) {
          var g = S.gen[PRINTERS[i]];
          var list = g.pend;
          g.pend = [];
          for (var j = 0; j < list.length; j++) plainTag(api, g, m, " after waiting " + waitText(m - list[j]));
        }
      }
    } else if (S.strategy === "ticket") {
      api.log(S.down ? "Ticket server A goes down. Every request goes to B, which carries on with even numbers."
        : "Ticket server A is back, and requests go round robin again.", S.down ? "warn" : "ok");
    } else {
      api.log("The town hall counter goes " + (S.down ? "down" : "back up") + ". " + STRAT_NAME[S.strategy] +
        " doesn't ask it for anything, so nothing changes.", "");
    }
    draw(api);
  }

  function setCodes(api, v) {
    var o = pick(CODES, v);
    if (!o) return;
    var S = api.state;
    S.codes = Number(o.value);
    setClock(api, Math.max(S.now, 0));
    api.log(b62Text(S.codes), "");
    draw(api);
  }

  function arrival(api, who) {
    var S = api.state;
    if (who === "night" && S.night === "off") return;
    arrive(api, who, Math.max(S.now, 0));
    setClock(api, S.now);
    draw(api);
  }

  // Logged before the step, so the line shows the clock as it read before NTP moved it.
  function ntpStep(api) {
    var S = api.state;
    var g = S.gen.scanner;
    var m = Math.max(S.now, 0);
    setClock(api, m);
    var head = "NTP steps the scanner's clock back " + NTP_STEP + " ms.";
    if (S.strategy === "snowflake") {
      api.log(head + " Before the step it read " + fmt(reading(S, g, m)) + " ms since the epoch, and the last millisecond it used is " +
        fmt(g.last) + ". " + (S.guard ? "The guard will hold it until its clock reads " + fmt(g.last) + " again."
          : "With no guard, it will make again the numbers of the last " + NTP_STEP + " ms."), S.guard ? "warn" : "bad");
    } else if (S.strategy === "v7") {
      api.log(head + " Before the step it read Unix time " + fmt(unixMs(S, g, m)) +
        " ms. With no guard, its next UUIDs will sort before ones it has just made.", "warn");
    } else {
      api.log(head + " " + (S.strategy === "v4" ? "UUID v4 doesn't read a clock" : "The numbers come from the town hall, not the clock") +
        ", so nothing changes.", "");
    }
    g.ntp -= NTP_STEP;
    g.hadDup = false;
    draw(api);
  }

  // Logged before the change, so the line's time is the wall clock as it read before going back.
  function clocksBack(api) {
    var S = api.state;
    if (S.wall !== 0 || S.ended) return;
    var m = Math.max(S.now, 0);
    setClock(api, m);
    var msg = "The clocks go back an hour. The wall clock read " + wallText(S, m) + " and will read " +
      wallOf(START_CLOCK * 1000 + m - HOUR) + ".";
    var tone = "";
    if (S.strategy === "snowflake" && S.clock === "local") {
      msg += " Every machine counts from the wall clock, so its count steps back 3,600,000 ms too, and the scanner will make again, millisecond by millisecond, the numbers of the last hour" +
        (S.guard ? ", unless the guard holds it." : ".");
      tone = S.guard ? "warn" : "bad";
    } else if (S.strategy === "snowflake") {
      msg += " The machines count in UTC, which doesn't go back, so their numbers carry straight on.";
      tone = "ok";
    } else if (S.strategy === "v7") {
      msg += " UUID v7 counts Unix time, which doesn't change for daylight saving.";
    } else if (S.strategy === "v4") {
      msg += " UUID v4 doesn't read a clock.";
    } else {
      msg += " The numbers come from the town hall, not the clock.";
    }
    msg += " The scanner runs until 06:00 by the wall clock, an hour longer.";
    api.log(msg, tone);
    S.wall = -HOUR;
    S.winEnd += HOUR;
    S.gen.scanner.hadDup = false;
    setClock(api, m);
    draw(api);
  }

  function skipTo(api, target) {
    var S = api.state;
    S.skipping = true;
    advance(api, target);
    S.skipping = false;
    S.tms = S.now;
    setClock(api, S.now);
    S.flash = [];
  }

  function skipHour(api) {
    var S = api.state;
    var target = Math.min(S.now + HOUR, MAX_T);
    if (target <= S.now) return;
    skipTo(api, target);
    api.log("Skipped an hour, to " + wallText(S, S.now).slice(0, 8) + ". So far: " + plural(S.gen.scanner.issued, "line", "lines") +
      " numbered, " + fmt(S.dups) + " refused.", "");
    draw(api);
  }

  function skipEnd(api) {
    var S = api.state;
    if (S.ended) return;
    skipTo(api, S.winEnd);
    draw(api);
  }

  /* ---------- drawing ---------- */

  function machineSub(S, who) {
    if (S.strategy === "snowflake") {
      if (who === "desk") return "machine 1";
      return S.night === "own" ? "machine 8 (own number)" : "machine 7 (copied disk)";
    }
    if (S.strategy === "auto") return "asks the counter";
    if (S.strategy === "ticket") return "asks A or B";
    return S.strategy === "v4" ? "random UUID v4" : "UUID v7, Unix ms";
  }

  function printerState(g) {
    if (g.refused) return "bad";
    if (g.pend.length) return "warn";
    return g.tags ? "ok" : "";
  }

  function draw(api) {
    var S = api.state;
    var sf = S.strategy === "snowflake";
    var counter = S.strategy === "auto" || S.strategy === "ticket";
    var sc = S.gen.scanner;

    var th = api.node("townhall");
    th.text("label", S.strategy === "ticket" ? "Ticket servers" : "Town hall counter");
    if (S.strategy === "auto") {
      th.text("sub", "one number per trip");
      th.text("meta", S.down ? "down: no numbers" : "up, 25 ms a trip");
      th.set(S.down ? "bad" : "ok");
    } else if (S.strategy === "ticket") {
      th.text("sub", "A odd, B even");
      th.text("meta", S.down ? "A down, B carries on" : "A and B both up");
      th.set(S.down ? "warn" : "ok");
    } else {
      th.text("sub", "not used since July");
      th.text("meta", S.down ? "down, not asked" : "not asked");
      th.set("muted");
    }
    var cut = S.strategy === "auto" && S.down ? "cut" : "";
    api.edge("townhall", "desk").set(cut);
    api.edge("townhall", "night").set(cut);
    api.edge("townhall", "scanner").set(cut);

    var dk = api.node("desk");
    dk.text("sub", machineSub(S, "desk"));
    dk.text("meta", tagText(S.gen.desk));
    dk.set(printerState(S.gen.desk));

    var nt = api.node("night");
    if (S.night === "off") {
      nt.text("sub", "off tonight");
      nt.text("meta", "no tags");
      nt.set("muted");
    } else {
      nt.text("sub", machineSub(S, "night"));
      nt.text("meta", tagText(S.gen.night));
      nt.set(printerState(S.gen.night));
    }

    var sn = api.node("scanner");
    sn.text("sub", sf ? "machine 7, a line every ms" : (counter ? "a line every 25 ms" : "a line every ms"));
    sn.text("meta", plural(sc.issued, "line", "lines") + (sc.refused ? ", " + fmt(sc.refused) + " refused" : ""));
    if (sc.refused) sn.set("bad");
    else if (sc.holdRun || (S.strategy === "auto" && S.down)) sn.set("warn");
    else if (S.ended) sn.set("muted");
    else sn.set("ok");

    var cb = api.node("casebook");
    cb.text("meta", fmt(S.dups) + " refused");
    cb.set(S.dups ? "bad" : "ok");

    var now = Math.max(S.now, 0);
    S.stat.dup(fmt(S.dups));
    S.stat.lines(fmt(sc.issued));
    S.stat.cap(sf ? fmt(SHIFT_MACHINE * 1000) : (counter ? fmt(1000 / TRIP) : "no fixed cap"));
    S.stat.sort(SORTS[S.strategy]);
    S.stat.size(S.strategy === "v4" || S.strategy === "v7" ? "16 bytes" : "8 bytes");
    S.stat.years(sf ? fmt1((T41 - (B_UTC + now)) / YEAR) : (S.strategy === "v7" ? fmt1((T48 - (U0 + now)) / YEAR_G) : "no clock"));
    S.stat.b62(String(b62Len(S.codes)));

    S.ctl.cold.disable(S.night === "off");
    S.ctl.dst.disable(S.wall !== 0 || S.ended);
    S.ctl.end.disable(S.ended);
    S.ctl.hour.disable(S.now >= MAX_T);
  }

  /* ---------- dots: a visual sample, never counted ---------- */

  function dots(api, dt) {
    var S = api.state;
    if (api.reducedMotion) { S.flash = []; return; }
    var sc = S.gen.scanner;
    S.dotClock += dt;
    if (S.dotClock >= DOT_EVERY) {
      S.dotClock = 0;
      var active = !S.ended && S.now >= 0 && sc.holdRun === 0 && !(S.strategy === "auto" && S.down);
      if (active) {
        var counter = S.strategy === "auto" || S.strategy === "ticket";
        api.dot({ path: counter ? ["townhall", "scanner", "casebook"] : ["scanner", "casebook"],
          cls: S.scanBad ? "dot-bad" : "dot-req", r: 3.5, speed: DOT_SPEED });
      }
    }
    var guard = 0;
    while (S.flash.length && guard < 8) {
      guard += 1;
      var f = S.flash.shift();
      api.dot({ path: f.path, cls: f.bad ? "dot-bad" : "dot-ok", r: 4.5, speed: DOT_SPEED });
    }
    S.flash = [];
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.gen) return;
    S.tms = Math.min(S.tms + dt * api.speed * 1000, MAX_T);
    var to = Math.floor(S.tms + EPS);
    if (to > S.now) advance(api, to);
    api.clock = START_CLOCK + (S.tms + S.wall) / 1000;
    draw(api);
    dots(api, dt);
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    townhall: function (S) {
      if (S.strategy === "auto") {
        return "<strong>Town hall counter.</strong> One auto-increment counter at the town hall hands out every number, the last one plus one. Each number is a 25 ms trip, and a machine waits for each answer, so it gets 40 a second. Numbers never repeat and come in order, but while the counter is down nobody gets one. Next number: " +
          fmt(S.counter) + ".";
      }
      if (S.strategy === "ticket") {
        return "<strong>Ticket servers.</strong> Two counters, as at Flickr: A hands out odd numbers and B even ones, and requests go round robin between them. If A goes down, every request goes to B and nothing stops, though the two sides drift apart, so the numbers are only roughly in order. A's next: " +
          fmt(S.a) + ". B's next: " + fmt(S.b) + ".";
      }
      return "<strong>Town hall counter.</strong> It handed out every number until July, one 25 ms trip each, and was down for four hours on 3 July. Under " +
        STRAT_NAME[S.strategy] + " nobody asks it for anything.";
    },
    desk: function (S) {
      var g = S.gen.desk;
      return "<strong>Desk printer.</strong> Prints a tag for each arrival at the front desk: six on Thursday night, at the times in Philomena's log. The button adds another arrival now. " +
        (S.strategy === "snowflake" ? "It is machine 1. Last reading used: " + fmt(g.last) + " ms since the epoch." : "") + " Tonight: " + tagText(g) + ".";
    },
    night: function (S) {
      if (S.night === "off") return "<strong>Cold-room printer.</strong> Switched off tonight.";
      var g = S.gen.night;
      return "<strong>Cold-room printer.</strong> Added on Thursday for the night shift and built from a copy of the scanning station's disk, so it came with the scanner's machine number, 7. It makes nine tags on Thursday night. " +
        (S.strategy === "snowflake" ? "Right now it is machine " + g.mid + "." : "") + " Tonight: " + tagText(g) + ".";
    },
    scanner: function (S) {
      var g = S.gen.scanner;
      var how = S.strategy === "snowflake" ? "numbers one line every millisecond, always with count 0, as machine 7" :
        (S.strategy === "auto" || S.strategy === "ticket" ? "asks the town hall for one number every 25 ms and waits for each" : "makes one UUID every millisecond");
      return "<strong>Scanning station.</strong> From 22:00 to 06:00 by the wall clock it loads the city's old registers into the Casebook and " + how +
        ". Lines tonight: " + fmt(g.issued) + ", refused: " + fmt(g.refused) + "." +
        (g.held ? " The guard has held it for " + fmt(g.held) + " ms." : "") +
        " NTP steps only this machine's clock.";
    },
    casebook: function (S) {
      return "<strong>The Casebook.</strong> The mortuary's records database. Its unique key on numbers refuses any number it already holds; the sim counts every refusal as a duplicate. Refused tonight: " +
        fmt(S.dups) + ". The UUIDs are drawn from the sim's seeded random numbers, and the chance of any repeat among them is too small to count.";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s2e14", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.strategy = "snowflake";
      S.night = "copied";
      S.clock = "local";
      S.guard = false;
      S.codes = 1000000000;
      S.wall = 0;
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.strategy = api.control.select("strategy", "How numbers are made", STRATEGIES, "snowflake", function (v) { setStrategy(api, v); });
      S.ctl.night = api.control.select("night", "Cold-room printer", NIGHTS, "copied", function (v) { setNight(api, v); });
      S.ctl.clock = api.control.select("clock", "Snowflake machines count from", CLOCKS, "local", function (v) { setClockMode(api, v); });
      S.ctl.guard = api.control.toggle("guard", "Clock guard: wait if the clock reads earlier", false, function (on) { setGuard(api, on); });
      S.ctl.down = api.control.toggle("down", "Town hall counter down (ticket server A)", false, function (on) { setDown(api, on); });
      S.ctl.codes = api.control.select("codes", "Short codes needed (base62)", CODES, 1000000000, function (v) { setCodes(api, v); });
      S.ctl.desk = api.control.button("desk", "Arrival at the desk", function () { arrival(api, "desk"); });
      S.ctl.cold = api.control.button("cold", "Arrival at the cold-room door", function () { arrival(api, "night"); });
      S.ctl.ntp = api.control.button("ntp", "NTP steps the scanner back 250 ms", function () { ntpStep(api); }, { tone: "danger" });
      S.ctl.dst = api.control.button("dst", "The clocks go back an hour", function () { clocksBack(api); }, { tone: "danger" });
      S.ctl.hour = api.control.button("hour", "Skip 1 hour", function () { skipHour(api); });
      S.ctl.end = api.control.button("end", "Skip to the end of the night (06:00)", function () { skipEnd(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        dup: api.stat("dup", "duplicates refused by the Casebook", "bad"),
        lines: api.stat("lines", "lines the scanner numbered", ""),
        cap: api.stat("cap", "IDs a second, one generator", ""),
        sort: api.stat("sort", "sorts by time", ""),
        size: api.stat("size", "size of one ID", ""),
        years: api.stat("years", "years left on the timestamp", ""),
        b62: api.stat("b62", "base62 characters for the codes needed", "ok")
      };

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startNight(api);
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      var a;
      var b;
      var i;

      // 1. The bit widths, and the stats they give.
      t.expect(ipow(2, 12) === 4096 && ipow(2, 10) === 1024 && ipow(2, 41) === 2199023255552 &&
        n("cap") === 4096000 && t.stat("sort") === "roughly" && t.stat("size") === "8 bytes" && t.stat("years") === 68.9,
        "Snowflake: 2^12 = 4,096 numbers per millisecond per machine, 4,096,000 a second; 41 bits from 1 January 2026 leave 68.9 years");

      // 2. Base62 lengths.
      t.expect(ipow(62, 5) === 916132832 && ipow(62, 6) === 56800235584 && ipow(62, 7) === 3521614606208 &&
        ipow(62, 5) < 1000000000 && 1000000000 <= ipow(62, 6) && n("b62") === 6,
        "Base62: 62^5 = 916,132,832 is short of a billion and 62^6 = 56,800,235,584 is enough: 6 characters");
      t.set("codes", 1000000);
      a = n("b62");
      t.set("codes", 1000000000000);
      b = n("b62");
      t.set("codes", 1000000000);
      t.expect(a === 4 && b === 7 && n("b62") === 6 &&
        t.logText().indexOf("1,000,000,000 codes: 62^5 = 916,132,832 is not enough, and 62^6 = 56,800,235,584 is enough: 6 characters.") >= 0,
        "Base62: a million codes need 4 characters, a billion 6, a trillion 7");

      // 3. As now: the cold-room printer is a copy of machine 7.
      t.click("end");
      t.expect(n("dup") === 9 && n("lines") === 28800000 && t.node("night").text.meta === "9 tags, 9 refused" &&
        t.node("desk").text.meta === "6 tags, 0 refused" && t.node("casebook").text.meta === "9 refused",
        "As now: all 9 cold-room tags are refused, all 6 desk tags saved, and the scanner numbers 28,800,000 lines");
      t.expect(t.logText().indexOf("Cold-room printer (machine 7), 22:17:41.302: tag 106878672786452480. Refused: number already in use") >= 0 &&
        t.logText().indexOf("Desk printer (machine 1), 22:48:12.519: tag 106886353467215872, saved.") >= 0,
        "As now: the log shows Philomena's first refused tag and the first desk tag, digit for digit");

      // 4. Its own machine number.
      t.set("night", "own");
      t.click("end");
      t.expect(n("dup") === 0 && t.node("night").text.meta === "9 tags, 0 refused" &&
        t.logText().indexOf("Cold-room printer (machine 8), 22:17:41.302: tag 106878672786456576, saved.") >= 0,
        "Machine 8: the same tag is 4,096 higher and nothing is refused");

      // 5. Wall clock, no guard: the clocks go back an hour at 02:00.
      t.set("clock", "local");
      for (i = 0; i < 4; i++) t.click("hour");
      t.click("dst");
      a = n("dup");
      t.click("hour");
      t.expect(a === 0 && n("dup") === 3600000 &&
        t.logText().indexOf("02:00:00 The clocks go back an hour. The wall clock read 02:00:00.000 and will read 01:00:00.000.") >= 0,
        "Wall clock: the scanner relives 01:00 to 02:00 and 3,600,000 lines are refused; the log line carries the time from before the change");

      // 6. The fix: UTC and the guard. The clocks go back and nothing repeats; an NTP step is held.
      t.set("clock", "utc");
      t.set("guard", true);
      for (i = 0; i < 4; i++) t.click("hour");
      t.click("dst");
      t.click("hour");
      a = n("dup");
      t.click("ntp");
      await t.run(1);
      t.expect(a === 0 && n("dup") === 0 && t.logText().indexOf("The guard held the scanner for 249 ms") >= 0,
        "UTC with the guard: the clocks going back change nothing, and a 250 ms NTP step is held for 249 ms with nothing refused");

      // 7. UTC without the guard: the same step reuses 250 milliseconds.
      t.set("guard", false);
      t.click("hour");
      t.click("ntp");
      await t.run(1);
      t.expect(n("dup") === 250 && t.node("scanner").text.meta.indexOf(", 250 refused") > 0,
        "No guard: a 250 ms NTP step makes the scanner repeat 250 numbers");

      // 8. The town hall counter: 40 a second, and nothing at all while it's down.
      t.set("strategy", "auto");
      t.click("end");
      a = n("lines");
      t.set("strategy", "auto");
      t.click("hour");
      t.set("down", true);
      b = n("lines");
      t.click("desk");
      t.click("hour");
      t.expect(a === 1152000 && n("dup") === 0 && n("cap") === 40 && t.stat("sort") === "yes" && n("lines") === b &&
        t.node("desk").text.meta === "1 tag, 2 waiting",
        "Counter: 1,152,000 lines a night at 40 a second; while it's down the scanner stops and the desk's tags wait");
      t.set("down", false);
      t.expect(t.node("desk").text.meta === "3 tags, 0 refused" && t.logText().indexOf("after waiting") >= 0,
        "Counter: the waiting tags print when it's back");

      // 9. Two ticket servers: B carries on while A is down.
      t.set("strategy", "ticket");
      t.click("hour");
      t.set("down", true);
      a = n("lines");
      t.click("hour");
      t.expect(n("lines") - a === 144000 && n("dup") === 0 && t.node("townhall").text.meta === "A down, B carries on" &&
        t.stat("sort") === "roughly",
        "Ticket servers: with A down, B hands out all 144,000 numbers of the next hour");

      // 10. UUID v4: no machine numbers, no clock, and no order.
      t.set("strategy", "v4");
      t.set("night", "copied");
      t.click("end");
      t.expect(n("dup") === 0 && t.stat("sort") === "no" && t.stat("size") === "16 bytes" && t.stat("years") === "no clock" &&
        t.node("night").text.meta === "9 tags, 0 refused" &&
        /tag [0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}, saved/.test(t.logText()),
        "UUID v4: the copied disk no longer matters, nothing is refused, and the IDs don't sort by time");

      // 11. UUID v7: sorts roughly by time until 10889; a step back puts IDs out of order but never repeats one.
      t.set("strategy", "v7");
      t.click("hour");
      t.click("ntp");
      await t.run(1);
      t.expect(t.stat("sort") === "roughly" && n("years") === 8862.8 && n("dup") === 0 &&
        t.logText().indexOf("249 of the scanner's UUIDs sort before ones it made earlier") >= 0,
        "UUID v7: 8,862.8 years left on 48 bits; after a 250 ms step, 249 UUIDs sort early and none repeats");
    }
  });
})();
