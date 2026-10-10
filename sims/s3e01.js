/* sims/s3e01-v1.0.2.js  (published as sims/s3e01.js)
   Case s3e01 "The Card Catalog": indexes, query plans and connection pooling at the Thessaly
   Library, Ashcombe University. A widget-style sim built inside api.root (no diagram). Two parts
   share one set of controls:
   - The plan lab: pick a query form and the indexes present; it shows the plan the planner picks
     (Seq Scan or Index Scan), the rows examined and returned, the pages read, the estimated time,
     and the B-tree depth arithmetic.
   - The night: replay Thursday from 02:00:00 to 04:00:00, a second at a time. The overdue-letters
     job sends 9,600 letters, one cloud function per letter, and the kiosks send 2 requests a
     second. It shows connections in use, queries waiting, kiosk requests refused, letters sent and
     the memory the open connections need.

   CHANGELOG
   v1.0.2 (2026-10-11) follow-ups: the systems librarian renamed Alaric Brockhurst (rule 15, the
     previous names were near-duplicates of names in s2e06 and a2e04); the case is now
     content/s3/s3e01-v1.0.2.json.
   v1.0.1 (2026-10-11) review fixes: the systems librarian renamed Alaric Brockhurst (rule 15); the
     case is now content/s3/s3e01-v1.0.1.json.
   v1.0.0 (2026-10-11) first version. Controls: query form (6), index on surname, index on
     lower(surname), two-column index on (surname, due_date), functions the job may run at once,
     max_connections, pooler on or off, the job's pool size, server size, run 1 minute, run 10
     minutes, run to 04:00, reset. Stats: plan, rows examined, rows returned, estimated time,
     connections in use, queries waiting, kiosk requests refused, letters sent, connection memory.
     selfTest: 16 assertions.

   Where every number comes from (conventions rule 14; the case is content/s3/s3e01-v1.0.2.json):
   - post: the loans table holds every loan since 1962, 4,180,000 rows. The server stores 80 loans
     to an 8 KB page, so the table is 4,180,000 / 80 = 52,250 pages. There is an index on surname.
     The letters job searches lower(surname) = '...', because the 1987 card import typed old
     surnames in capitals. Aldous Yarrow's loan of 14 November 1962 is the oldest overdue loan, so
     his lookup is always the first. lower(surname) = 'yarrow' returns 7 loans (6 typed Yarrow and
     the 1962 one typed YARROW); surname = 'Yarrow' returns 6. The job starts up to 1,000
     functions at once, 9,600 letters tonight, and each function opens its own connection.
     max_connections is 100, PostgreSQL's usual default (the server is PostgreSQL on one cloud
     server, set up by Alaric in 2019). The server has 8 GiB of memory. Six kiosks send about 2
     requests a second all night in exam season.
   - Alaric's noon test (OP's reply to u/grey_pager): EXPLAIN ANALYZE alone: Seq Scan on loans,
     Rows Removed by Filter: 4,179,993, 418 ms (52,250 pages x 0.008 ms).
   - The cost model (stated in sim.lede): every page fetched costs 0.008 ms, so the server fetches
     at most 1 / 0.008 ms = 125,000 pages a second. Queries running in the same second share that
     equally: each gets floor(125,000 / n) pages that second. A kiosk request is a lookup of a few
     pages and is not counted against the budget. A function holds its connection until its lookup
     is done, and every function takes at least one second.
   - B-tree: every index holds 300 entries a page (the fan-out). Depth = the fewest levels whose
     reach covers every row: 300 < 90,000 < 4,180,000 <= 27,000,000, so 3 levels: 13,934 leaf
     pages (4,180,000 / 300, rounded up), 47 middle pages (13,934 / 300, rounded up) and 1 root.
     An index lookup reads (depth - 1) pages on the way down, then ceil(r / 300) leaf pages (at
     least 1), then one table page per matching row: r = 7 gives 2 + 1 + 7 = 10 pages, 0.08 ms;
     r = 6 gives 9 pages, 0.072 ms. A Seq Scan reads all 52,250 pages, 418 ms. The planner takes
     the plan with fewer pages; on a tie it keeps the Seq Scan.
   - The query forms: the brief's four (surname = 'Yarrow', 6 rows; lower(surname) = 'yarrow', 7;
     lower(surname) LIKE 'yar%', 418; lower(surname) LIKE '%row', 1,254) plus two added to show
     the other ways a query goes slow: surname > 'B', 3,929,200 rows (94% of the table: an index
     lookup would read 2 + 13,098 + 3,929,200 = 3,942,300 pages, so the planner skips the index),
     and due_date < '1963-01-01', 3,344 rows (the two-column index starts with surname, so it
     can't serve it). Which index can serve which form: the surname index serves surname = and
     surname >; the lower(surname) index serves lower(surname) = and lower(surname) LIKE 'yar%'
     (the sim assumes it was built so it can serve searches by the start of a name, which in
     PostgreSQL means the C locale or text_pattern_ops); the (surname, due_date) index serves what
     the surname index serves. Nothing serves LIKE '%row' or due_date alone.
   - Connections: each costs about 9.5 MB (9,531,392 bytes, the figure Amazon RDS divides a DB
     instance's memory by to set its default max_connections for PostgreSQL). If the connections
     open in a second need more than the server's memory (8 GiB = 8,589,934,592 bytes, so more
     than 901), PostgreSQL runs out of memory and restarts: every connection is dropped, every
     lookup in progress starts again, and for the next 10 seconds every connection is refused.
   - Pooler: PgBouncer between every client and the database. It accepts at most 100 client
     connections (its max_client_conn default), keeps a pool for the job (pool size: 5, 10, 20,
     50 or 90; PgBouncer's default_pool_size is 20) and a pool of 5 for the kiosks, and opens both
     pools at the start, so the database has pool + 5 connections open.

   Teaching model, one slot a second (slot t is 02:00:00 + t s; 7,200 slots to 04:00:00):
   (1) start functions until W are running or no letters are left (letter 0 is Aldous Yarrow's);
   (2) during a restart: count down, refuse both kiosk requests, nothing else;
   (3) straight to the database: free = max_connections - connections the functions hold; waiting
       functions take free connections first, oldest first (hundreds retry every second); then
       each kiosk request takes one if any is left, otherwise it is refused; if the connections
       in use x 9,531,392 > the server's memory, the restart in the cost model above happens;
   (4) through the pooler: functions take free client slots (of 100) first, then free job-pool
       connections; each kiosk request needs a client slot, otherwise it is refused;
   (5) the lookups with a connection share the page budget; finished ones release everything.
   Queries waiting = functions running without a database connection, counted before (5).

   Story and option numbers, from this model:
   - As now (no lower(surname) index, 1,000 functions, max_connections 100, no pooler): at
     02:00:00, 100 of 100 connections, 900 functions waiting, 953 MB of 8,590. 100 lookups share
     125,000 pages: 1,250 each a second, so a lookup takes 42 s (52,250 / 1,250 = 41.8): Yarrow's
     letter at 02:00:41. 96 rounds of 42 s: the last letter at 03:07:11 (slot 4,031), the kiosks
     back at 03:07:12, 2 x 4,032 = 8,064 kiosk requests refused.
   - Index on lower(surname) only: 10 pages a lookup, 100 letters a second: last letter 02:01:35,
     192 refused, kiosks back at 02:01:36.
   - Option C (index, pooler with a job pool of 10, job capped at 10): 15 connections, 0 waiting,
     0 refused, 10 letters a second, last letter 02:15:59. Capped at 50: 40 waiting, 0 refused.
     Pooler with the job not capped: 990 waiting, 1,902 refused (the pooler's 100 client slots).
   - Option A (4 times the server: 32 GiB, 500,000 pages a second): 5,000 pages each a second, 11 s
     a lookup; Yarrow's letter at 02:00:10, last 02:17:35, 2,112 refused.
   - Option B (a read replica): not a control. Each function opens its primary connection at start
     and holds it while its lookup runs on the copy, the same size as the primary, so the primary
     sees the as-now numbers: 8,064 refused, last letter 03:07:11.
   - Option D (max_connections 2,000): at 02:00:00, 1,000 functions and 2 kiosk requests connect:
     1,002 x 9,531,392 = 9,550,454,784 bytes, 9,550 MB of 8,590: out of memory. It repeats every
     11 s: 655 restarts by 04:00, 0 letters, 2 x 7,200 = 14,400 refused. max_connections 500: no
     crash, 500 lookups share the pages, 7,942 refused, last letter 03:06:52.

   Catalog note: the case's concepts are the catalog's ids for s3e01 (indexes, query-plans,
   why-queries-get-slow, connection-pooling).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var ROWS = 4180000;            // loans since 1962
  var PER_PAGE = 80;             // loans to an 8 KB page
  var PAGES = 52250;             // ROWS / PER_PAGE
  var FAN = 300;                 // index entries a page
  var PAGE_US = 8;               // microseconds a page: 0.008 ms
  var RATE = 125000;             // pages a second, 1,000,000 us / 8 us
  var LETTERS = 9600;            // letters tonight
  var KIOSK = 2;                 // kiosk requests a second
  var START = 2 * 3600;          // 02:00:00
  var SLOTS = 7200;              // to 04:00:00
  var RESTART = 10;              // seconds every connection is refused after a restart
  var MAX_CLIENT = 100;          // PgBouncer max_client_conn default
  var KIOSK_POOL = 5;            // the kiosks' pool behind the pooler
  var PER_CONN = 9531392;        // bytes a connection
  var MEM = 8589934592;          // 8 GiB
  var YARROW = 0;                // letter 0 is Aldous Yarrow's

  var IDX = ["surname", "lower", "comp"];
  var IDX_NAME = { surname: "loans_surname_idx", lower: "loans_lower_surname_idx", comp: "loans_surname_due_idx" };
  var IDX_SAID = { surname: "on surname", lower: "on lower(surname)", comp: "on (surname, due_date)" };

  var FORMS = [
    { value: "eq", label: "surname = 'Yarrow'", sql: "surname = 'Yarrow'", rows: 6, can: ["surname", "comp"] },
    { value: "lower", label: "lower(surname) = 'yarrow' (the job's)", sql: "lower(surname) = 'yarrow'", rows: 7, can: ["lower"] },
    { value: "prefix", label: "lower(surname) LIKE 'yar%'", sql: "lower(surname) LIKE 'yar%'", rows: 418, can: ["lower"] },
    { value: "suffix", label: "lower(surname) LIKE '%row'", sql: "lower(surname) LIKE '%row'", rows: 1254, can: [] },
    { value: "range", label: "surname > 'B' (most of the table)", sql: "surname > 'B'", rows: 3929200, can: ["surname", "comp"] },
    { value: "due", label: "due_date < '1963-01-01'", sql: "due_date < '1963-01-01'", rows: 3344, can: [] }
  ];

  // Why a present index can't serve a form (only pairs where it can't).
  var CANT = {
    eq: { lower: "loans_lower_surname_idx holds lower(surname), and this query asks for surname itself." },
    lower: {
      surname: "loans_surname_idx is sorted by surname as typed, and this query asks for lower(surname): a function on the column hides the index.",
      comp: "loans_surname_due_idx starts with surname as typed, and this query asks for lower(surname)."
    },
    prefix: {
      surname: "loans_surname_idx is sorted by surname as typed, and this query asks for lower(surname).",
      comp: "loans_surname_due_idx starts with surname as typed, and this query asks for lower(surname)."
    },
    suffix: {
      surname: "A search that starts with a wildcard can't use a B-tree: the matches are scattered through the sort order.",
      lower: "A search that starts with a wildcard can't use a B-tree: names ending in 'row' are scattered through the sort order.",
      comp: "A search that starts with a wildcard can't use a B-tree: the matches are scattered through the sort order."
    },
    range: { lower: "loans_lower_surname_idx holds lower(surname), and this query asks for surname itself." },
    due: {
      surname: "loans_surname_idx doesn't hold due dates.",
      lower: "loans_lower_surname_idx doesn't hold due dates.",
      comp: "loans_surname_due_idx is sorted by surname first, so due dates are scattered through it: a two-column index serves its leftmost column first."
    }
  };

  var WORKERS = [
    { value: "1000", label: "Up to 1,000 at once (as now)" },
    { value: "200", label: "Capped at 200" },
    { value: "50", label: "Capped at 50" },
    { value: "20", label: "Capped at 20" },
    { value: "10", label: "Capped at 10" }
  ];
  var MAXCONN = [
    { value: "100", label: "100 (as now)" },
    { value: "200", label: "200" },
    { value: "500", label: "500" },
    { value: "2000", label: "2,000" }
  ];
  var POOLS = [
    { value: "5", label: "5" },
    { value: "10", label: "10" },
    { value: "20", label: "20 (PgBouncer's default)" },
    { value: "50", label: "50" },
    { value: "90", label: "90" }
  ];
  var SERVERS = [
    { value: "now", label: "As now: 8 GiB, 125,000 pages a second" },
    { value: "big", label: "4 times bigger: 32 GiB, 500,000 pages a second" }
  ];

  /* ---------- small helpers ---------- */

  // 8064 -> "8,064". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function hms(sec) {
    return pad(Math.floor(sec / 3600)) + ":" + pad(Math.floor((sec % 3600) / 60)) + ":" + pad(sec % 60);
  }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  // Microseconds -> "418 ms", "0.08 ms", "3.376 ms".
  function msText(us) {
    if (us >= 100000) return fmt(us / 1000) + " ms";
    var s = (us / 1000).toFixed(3);
    s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s + " ms";
  }

  function mb(bytes) { return fmt(Math.floor(bytes / 1e6 + 0.5)); }

  function idxList(idx) {
    var on = IDX.filter(function (k) { return idx[k]; }).map(function (k) { return IDX_SAID[k]; });
    if (!on.length) return "none";
    if (on.length === 1) return on[0];
    return on.slice(0, -1).join(", ") + " and " + on[on.length - 1];
  }

  /* ---------- B-tree arithmetic ---------- */

  function depth() {
    var d = 1;
    var reach = FAN;
    while (reach < ROWS) { d += 1; reach *= FAN; }
    return d;
  }

  // Pages on each level, root first: [1, 47, 13,934].
  function levels() {
    var out = [];
    var n = Math.ceil(ROWS / FAN);
    out.unshift(n);
    while (n > 1) { n = Math.ceil(n / FAN); out.unshift(n); }
    return out;
  }

  var DEPTH = depth();

  function indexPages(r) {
    var idxPart = (DEPTH - 1) + Math.max(1, Math.ceil(r / FAN));
    return { index: idxPart, table: r, total: idxPart + r };
  }

  /* ---------- the planner ---------- */

  function plan(form, idx) {
    var best = { type: "seq", name: null, pages: PAGES, indexPages: 0, tablePages: PAGES, examined: ROWS };
    var skipped = null;
    var cant = [];
    IDX.forEach(function (k) {
      if (!idx[k]) return;
      if (form.can.indexOf(k) < 0) {
        if (CANT[form.value] && CANT[form.value][k]) cant.push(CANT[form.value][k]);
        return;
      }
      var p = indexPages(form.rows);
      if (p.total < best.pages) {
        best = { type: "index", name: IDX_NAME[k], pages: p.total, indexPages: p.index, tablePages: p.table, examined: form.rows };
      } else if (!skipped) {
        skipped = { name: IDX_NAME[k], pages: p.total };
      }
    });
    best.returned = form.rows;
    best.us = best.pages * PAGE_US;
    best.skipped = best.type === "seq" ? skipped : null;
    best.cant = cant;
    best.form = form;
    return best;
  }

  function planLine(p) {
    return p.type === "seq" ? "Seq Scan on loans" : "Index Scan using " + p.name + " on loans";
  }

  function planSummary(p) {
    return "Plan for " + p.form.sql + ": " + (p.type === "seq" ? "Seq Scan" : "Index Scan using " + p.name) + ", " +
      fmt(p.examined) + " rows examined, " + fmt(p.returned) + " returned, " + fmt(p.pages) + " pages, " + msText(p.us) + "." +
      (p.skipped ? " The planner skipped " + p.skipped.name + ": " + fmt(p.skipped.pages) + " pages by the index against " +
        fmt(PAGES) + " for the whole table." : "");
  }

  function explainText(p) {
    var lines = ["EXPLAIN ANALYZE SELECT * FROM loans WHERE " + p.form.sql + ";", ""];
    if (p.type === "seq") {
      lines.push(planLine(p) + "  (pages " + fmt(p.pages) + ", est. " + msText(p.us) + ")");
      lines.push("  Filter: (" + p.form.sql + ")");
      lines.push("  Rows Removed by Filter: " + fmt(p.examined - p.returned));
    } else {
      lines.push(planLine(p) + "  (pages " + fmt(p.pages) + ": " + fmt(p.indexPages) + " index, " + fmt(p.tablePages) +
        " table; est. " + msText(p.us) + ")");
      lines.push("  Index Cond: (" + p.form.sql + ")");
    }
    lines.push("  rows examined " + fmt(p.examined) + ", rows returned " + fmt(p.returned));
    return lines.join("\n");
  }

  function btreeText() {
    var lv = levels();
    var reach = [];
    var r = FAN;
    for (var d = 1; d <= DEPTH; d++) { reach.push(d + (d === 1 ? " level reaches " : " levels reach ") + fmt(r)); r *= FAN; }
    return "B-tree arithmetic: " + FAN + " entries a page. " + reach.join(", ") + ", enough for " + fmt(ROWS) +
      " rows: depth " + DEPTH + ". Pages per level: " + lv.map(fmt).join(", ") +
      " (root first). A lookup reads one page per level on the way down, then one table page per matching row.";
  }

  /* ---------- the night ---------- */

  function cfgOf(S) {
    return { idx: { surname: S.idx.surname, lower: S.idx.lower, comp: S.idx.comp }, W: S.W, M: S.M, pool: S.pool, P: S.P, big: S.big };
  }

  function makeNight(cfg) {
    var jp = plan(pick(FORMS, "lower"), cfg.idx);
    var N = {
      cfg: cfg, plan: jp, look: jp.pages, rate: RATE * (cfg.big ? 4 : 1), mem: MEM * (cfg.big ? 4 : 1),
      P: Math.min(cfg.P, cfg.M - KIOSK_POOL),
      t: 0, fns: [], pending: LETTERS, started: 0, refused: 0, sent: 0, down: 0, restarts: 0,
      conns: 0, waiting: 0, peakWaiting: 0, prevRefused: 0, firstRefusal: false, firstOom: false,
      yarrowAt: -1, lastAt: -1, done: false
    };

    function count(key) {
      var c = 0;
      for (var i = 0; i < N.fns.length; i++) if (N.fns[i][key]) c += 1;
      return c;
    }

    function fill() {
      while (N.fns.length < cfg.W && N.pending > 0) {
        N.fns.push({ id: N.started, p: N.look, c: false, s: false });
        N.started += 1;
        N.pending -= 1;
      }
    }

    function disk(t, ev) {
      var act = N.fns.filter(function (f) { return f.s; });
      N.waiting = N.fns.length - act.length;
      if (N.waiting > N.peakWaiting) N.peakWaiting = N.waiting;
      if (!act.length) return;
      var share = Math.floor(N.rate / act.length);
      var done = [];
      act.forEach(function (f) { f.p -= share; if (f.p <= 0) done.push(f); });
      done.forEach(function (f) {
        N.fns.splice(N.fns.indexOf(f), 1);
        N.sent += 1;
        if (f.id === YARROW) { N.yarrowAt = t; ev.push({ type: "yarrow", t: t }); }
      });
      if (N.sent === LETTERS && N.lastAt < 0) { N.lastAt = t; ev.push({ type: "last", t: t }); }
    }

    N.step = function () {
      var ev = [];
      if (N.t >= SLOTS) return ev;
      var t = N.t;
      var slotRefused = 0;
      var i;
      var f;
      fill();
      if (N.down > 0) {
        N.down -= 1;
        slotRefused = KIOSK;
        N.conns = 0;
        N.waiting = N.fns.length;
      } else if (!cfg.pool) {
        var free = cfg.M - count("s");
        for (i = 0; i < N.fns.length; i++) {
          f = N.fns[i];
          if (!f.s && free > 0) { f.s = true; free -= 1; }
        }
        var served = 0;
        var refusedNow = 0;
        for (i = 0; i < KIOSK; i++) { if (free > 0) { free -= 1; served += 1; } else refusedNow += 1; }
        var used = count("s") + served;
        if (used * PER_CONN > N.mem) {
          if (!N.firstOom) { N.firstOom = true; ev.push({ type: "oom", t: t, used: used, bytes: used * PER_CONN }); }
          N.restarts += 1;
          slotRefused = refusedNow + served;
          for (i = 0; i < N.fns.length; i++) { N.fns[i].s = false; N.fns[i].p = N.look; }
          N.down = RESTART;
          N.conns = 0;
          N.waiting = N.fns.length;
        } else {
          slotRefused = refusedNow;
          N.conns = used;
          if (slotRefused > 0 && !N.firstRefusal) {
            N.firstRefusal = true;
            ev.push({ type: "full", t: t, conns: used, waiting: N.fns.length - count("s") });
          }
          disk(t, ev);
        }
      } else {
        var cf = MAX_CLIENT - count("c");
        for (i = 0; i < N.fns.length; i++) {
          f = N.fns[i];
          if (!f.c && cf > 0) { f.c = true; cf -= 1; }
        }
        var sf = N.P - count("s");
        for (i = 0; i < N.fns.length; i++) {
          f = N.fns[i];
          if (f.c && !f.s && sf > 0) { f.s = true; sf -= 1; }
        }
        for (i = 0; i < KIOSK; i++) { if (cf > 0) cf -= 1; else slotRefused += 1; }
        N.conns = N.P + KIOSK_POOL;
        if (slotRefused > 0 && !N.firstRefusal) {
          N.firstRefusal = true;
          ev.push({ type: "poolfull", t: t, waiting: N.fns.length - count("s") });
        }
        disk(t, ev);
      }
      N.refused += slotRefused;
      if (slotRefused === 0 && N.prevRefused > 0) ev.push({ type: "back", t: t, refused: N.refused });
      N.prevRefused = slotRefused;
      N.t += 1;
      if (N.t === SLOTS) { N.done = true; ev.push({ type: "end", t: SLOTS }); }
      return ev;
    };

    N.memBytes = function () { return N.conns * PER_CONN; };
    return N;
  }

  /* ---------- narration ---------- */

  function nightConfig(S, N) {
    var jp = N.plan;
    return "The letters job's lookup: " + (jp.type === "seq" ? "Seq Scan, " + fmt(jp.pages) + " pages" :
      "Index Scan using " + jp.name + ", " + fmt(jp.pages) + " pages") + ". Functions: " +
      (S.W >= 1000 ? "up to 1,000 at once" : "capped at " + fmt(S.W)) + ". max_connections " + fmt(S.M) + ". " +
      (S.pool ? "Through PgBouncer: 100 client connections, a job pool of " + fmt(N.P) + " and 5 for the kiosks. " :
        "Every function and kiosk connects straight to the database. ") +
      (S.big ? "Server 4 times bigger: 32 GiB." : "Server as now: 8 GiB.");
  }

  function logEvents(api, evs) {
    var S = api.state;
    var N = S.night;
    evs.forEach(function (e) {
      api.clock = START + e.t;
      if (e.type === "full") {
        api.log("Kiosk: too many clients. " + fmt(e.conns) + " of " + fmt(S.M) + " connections in use, " +
          fmt(e.waiting) + " functions waiting.", "bad");
      } else if (e.type === "poolfull") {
        api.log("Kiosk: refused by the pooler. Its 100 client connections are all held by functions; " +
          fmt(e.waiting) + " functions waiting for a database connection.", "bad");
      } else if (e.type === "oom") {
        api.log("Out of memory: " + fmt(e.used) + " connections at about 9.5 MB each need " + mb(e.bytes) + " MB, and the server has " +
          mb(N.mem) + ". PostgreSQL restarts and drops every connection; for 10 s every connection is refused.", "bad");
      } else if (e.type === "yarrow") {
        api.log("The letter to Aldous Yarrow is written. His lookup read " + fmt(N.plan.examined) + " rows to return 7.", "warn");
      } else if (e.type === "last") {
        api.log("The last of the 9,600 letters is written.", "ok");
      } else if (e.type === "back") {
        api.log("The kiosks work again. " + fmt(e.refused) + " requests refused since 02:00:00.", "ok");
      } else if (e.type === "end") {
        api.log("End of the replay. Letters sent: " + fmt(N.sent) + " of 9,600. Kiosk requests refused: " + fmt(N.refused) + "." +
          (N.restarts ? " PostgreSQL ran out of memory and restarted " + fmt(N.restarts) + " times." : ""), N.refused ? "bad" : "ok");
      }
    });
  }

  function startNight(api) {
    var S = api.state;
    S.night = makeNight(cfgOf(S));
    api.clock = START;
    api.log("Thursday night. 9,600 letters, one function each. " + nightConfig(S, S.night), "");
    draw(api);
  }

  function replay(api, what) {
    api.clock = START + api.state.night.t;
    api.log(what + " Replaying from 02:00:00.", "");
    startNight(api);
  }

  function runSlots(api, n) {
    var S = api.state;
    var N = S.night;
    for (var i = 0; i < n && !N.done; i++) logEvents(api, N.step());
    api.clock = START + N.t;
    draw(api);
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:6px;padding:10px;min-width:0;");
    box.appendChild(el("p", "margin:0;font-size:12px;opacity:.8;",
      "Plan lab and night replay. Costs are a teaching model: 0.008 ms a page, 300 index entries a page, about 9.5 MB a connection."));
    box.appendChild(el("p", "margin:6px 0 0;font-weight:600;letter-spacing:.04em;font-size:12px;", "The plan"));
    var pre = el("pre", "margin:0;padding:8px;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid currentColor;border-radius:6px;opacity:.95;", "");
    pre.setAttribute("aria-live", "polite");
    box.appendChild(pre);
    var why = el("p", "margin:0;font-size:13px;", "");
    box.appendChild(why);
    var tree = el("p", "margin:0;font-size:13px;", "");
    box.appendChild(tree);
    box.appendChild(el("p", "margin:6px 0 0;font-weight:600;letter-spacing:.04em;font-size:12px;", "The night"));
    var night = el("p", "margin:0;font-size:13px;", "");
    night.setAttribute("aria-live", "polite");
    box.appendChild(night);
    api.root.appendChild(box);
    return { pre: pre, why: why, tree: tree, night: night };
  }

  function draw(api) {
    var S = api.state;
    var N = S.night;
    var p = plan(S.form, S.idx);
    S.ui.pre.textContent = explainText(p);
    var notes = p.cant.slice();
    if (p.skipped) {
      notes.push("The planner skipped " + p.skipped.name + ": " + fmt(p.skipped.pages) + " pages by the index against " +
        fmt(PAGES) + " for the whole table. When a query returns most of the table, reading it in order is cheaper.");
    }
    if (!notes.length) notes.push(p.type === "index" ? "The index serves this query." : "No index present can serve this query.");
    S.ui.why.textContent = notes.join(" ");
    S.ui.tree.textContent = btreeText();
    S.ui.night.textContent = (N.t === 0 ? "02:00:00, nothing run yet. " : hms(START + N.t) + ". ") +
      "Letters sent " + fmt(N.sent) + " of 9,600; functions running " + fmt(N.fns.length) + "; letters not started " + fmt(N.pending) +
      "; most functions waiting at once " + fmt(N.peakWaiting) + (N.restarts ? "; restarts " + fmt(N.restarts) : "") + ".";

    S.stat.plan(p.type === "seq" ? "Seq Scan" : "Index Scan");
    S.stat.examined(fmt(p.examined));
    S.stat.returned(fmt(p.returned));
    S.stat.time(msText(p.us));
    S.stat.conns(fmt(N.conns) + " of " + fmt(S.M));
    S.stat.waiting(fmt(N.waiting));
    S.stat.refused(fmt(N.refused));
    S.stat.letters(fmt(N.sent));
    S.stat.memory(mb(N.memBytes()) + " of " + mb(N.mem) + " MB");

    S.ctl.run1.disable(N.done);
    S.ctl.run10.disable(N.done);
    S.ctl.runall.disable(N.done);
    S.ctl.pool.disable(!S.pool);
  }

  /* ---------- controls ---------- */

  function setForm(api, v) {
    var o = pick(FORMS, v);
    if (!o) return;
    api.state.form = o;
    api.clock = START + api.state.night.t;
    api.log(planSummary(plan(o, api.state.idx)), "");
    draw(api);
  }

  function setIdx(api, k, on) {
    var S = api.state;
    if (!!on === S.idx[k]) return;
    S.idx[k] = !!on;
    replay(api, "Index " + IDX_SAID[k] + (on ? " added" : " dropped") + ". Indexes now: " + idxList(S.idx) + ". " +
      planSummary(plan(S.form, S.idx)));
  }

  function setW(api, v) {
    var o = pick(WORKERS, v);
    if (!o) return;
    api.state.W = Number(o.value);
    replay(api, "The letters job: " + o.label.toLowerCase() + ".");
  }

  function setM(api, v) {
    var o = pick(MAXCONN, v);
    if (!o) return;
    api.state.M = Number(o.value);
    replay(api, "max_connections set to " + fmt(api.state.M) + ", which PostgreSQL reads only at start.");
  }

  function setPool(api, on) {
    if (!!on === api.state.pool) return;
    api.state.pool = !!on;
    replay(api, on ? "PgBouncer goes in front of the database." : "PgBouncer taken out.");
  }

  function setP(api, v) {
    var o = pick(POOLS, v);
    if (!o) return;
    api.state.P = Number(o.value);
    replay(api, "The job's pool in PgBouncer: " + o.value + " connections.");
  }

  function setServer(api, v) {
    var o = pick(SERVERS, v);
    if (!o) return;
    api.state.big = o.value === "big";
    replay(api, "Server: " + o.label + ". max_connections stays a setting, not a size.");
  }

  /* ---------- the module ---------- */

  DL.sims.define("s3e01", {
    startClock: START,

    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.form = pick(FORMS, "lower");
      S.idx = { surname: true, lower: false, comp: false };
      S.W = 1000;
      S.M = 100;
      S.pool = false;
      S.P = 20;
      S.big = false;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.form = api.control.select("form", "Query form (plan lab)", FORMS, "lower", function (v) { setForm(api, v); });
      S.ctl.surname = api.control.toggle("idx_surname", "Index on surname", true, function (on) { setIdx(api, "surname", on); });
      S.ctl.lower = api.control.toggle("idx_lower", "Index on lower(surname)", false, function (on) { setIdx(api, "lower", on); });
      S.ctl.comp = api.control.toggle("idx_comp", "Index on (surname, due_date)", false, function (on) { setIdx(api, "comp", on); });
      S.ctl.W = api.control.select("workers", "Functions the letters job runs at once", WORKERS, "1000", function (v) { setW(api, v); });
      S.ctl.M = api.control.select("maxconn", "max_connections", MAXCONN, "100", function (v) { setM(api, v); });
      S.ctl.pooler = api.control.toggle("pooler", "PgBouncer in front", false, function (on) { setPool(api, on); });
      S.ctl.pool = api.control.select("pool", "The job's pool size in PgBouncer", POOLS, "20", function (v) { setP(api, v); });
      S.ctl.server = api.control.select("server", "Database server", SERVERS, "now", function (v) { setServer(api, v); });
      S.ctl.run1 = api.control.button("run1", "Run 1 minute", function () { runSlots(api, 60); });
      S.ctl.run10 = api.control.button("run10", "Run 10 minutes", function () { runSlots(api, 600); });
      S.ctl.runall = api.control.button("runall", "Run to 04:00", function () { runSlots(api, SLOTS); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        plan: api.stat("plan", "plan", ""),
        examined: api.stat("examined", "rows examined", "warn"),
        returned: api.stat("returned", "rows returned", ""),
        time: api.stat("time", "estimated time, alone", ""),
        conns: api.stat("conns", "connections in use (of max_connections)", ""),
        waiting: api.stat("waiting", "queries waiting", "warn"),
        refused: api.stat("refused", "kiosk requests refused", "bad"),
        letters: api.stat("letters", "letters sent", "ok"),
        memory: api.stat("memory", "connection memory", "")
      };

      api.info("<strong>How to read it.</strong> The plan box is what EXPLAIN ANALYZE would say under the sim's cost model, for the " +
        "query form you pick. The night replays the letters job, which always runs the lower(surname) lookup, with the indexes, " +
        "functions, max_connections, pooler and server you pick. Run it a minute at a time or to 04:00.");

      startNight(api);
    },

    selfTest: async function (t) {
      function has(part) { return t.logText().indexOf(part) >= 0; }
      function nightOf(over) {
        var c = { idx: { surname: true, lower: false, comp: false }, W: 1000, M: 100, pool: false, P: 20, big: false };
        Object.keys(over || {}).forEach(function (k) { c[k] = over[k]; });
        var N = makeNight(c);
        while (!N.done) N.step();
        return N;
      }
      var L = pick(FORMS, "lower");
      var p;
      var N;
      var first;

      // 1. B-tree depth arithmetic.
      var lv = levels();
      t.expect(DEPTH === 3 && FAN * FAN < ROWS && ROWS <= FAN * FAN * FAN && FAN * FAN === 90000 && FAN * FAN * FAN === 27000000 &&
        lv.length === 3 && lv[0] === 1 && lv[1] === 47 && lv[2] === 13934 && Math.ceil(ROWS / FAN) === 13934 &&
        indexPages(7).total === 10 && indexPages(7).index === 3 && indexPages(6).total === 9,
        "B-tree: 300 entries a page, 300 x 300 = 90,000 < 4,180,000 <= 27,000,000, so depth 3: 1 root, 47 middle, 13,934 leaves; 7 matches read 3 index pages and 7 table pages");

      // 2. The table and the cost model.
      t.expect(ROWS / PER_PAGE === PAGES && PAGES === 52250 && PAGES * PAGE_US === 418000 && msText(PAGES * PAGE_US) === "418 ms" &&
        RATE * PAGE_US === 1000000 && Math.floor(RATE / 100) === 1250 && Math.ceil(PAGES / 1250) === 42 &&
        Math.ceil(PAGES / 5000) === 11 && MEM === 8 * 1024 * 1024 * 1024 && Math.floor(MEM / PER_CONN) === 901,
        "4,180,000 loans / 80 = 52,250 pages; x 0.008 ms = 418 ms alone; 125,000 pages a second shared by 100 is 1,250 each, 42 s a lookup; 901 connections fit in 8 GiB at 9,531,392 bytes");

      // 3. As now, the plan lab shows the job's lookup.
      t.expect(t.stat("plan") === "Seq Scan" && t.stat("examined") === "4,180,000" && t.stat("returned") === 7 &&
        t.stat("time") === "418 ms" && t.stat("conns") === "0 of 100" &&
        t.api.state.ui.pre.textContent.indexOf("Rows Removed by Filter: 4,179,993") >= 0,
        "As now: lower(surname) = 'yarrow' is a Seq Scan, 4,180,000 rows examined to return 7, Rows Removed by Filter: 4,179,993, 418 ms");

      // 4. The expression index turns the scan into an index lookup.
      t.click("idx_lower");
      p = plan(L, { surname: true, lower: true, comp: false });
      t.expect(t.stat("plan") === "Index Scan" && t.stat("examined") === 7 && t.stat("time") === "0.08 ms" && p.pages === 10 &&
        p.name === "loans_lower_surname_idx" && t.api.state.ui.pre.textContent.indexOf("Index Scan using loans_lower_surname_idx on loans") >= 0,
        "Index on lower(surname): Index Scan using loans_lower_surname_idx, 7 rows examined, 10 pages, 0.08 ms");

      // 5. A leading wildcard still scans, with every index present.
      t.click("idx_comp");
      t.set("form", "suffix");
      t.expect(t.stat("plan") === "Seq Scan" && t.stat("examined") === "4,180,000" && t.stat("returned") === "1,254" &&
        t.api.state.ui.why.textContent.indexOf("starts with a wildcard can't use a B-tree") >= 0,
        "lower(surname) LIKE '%row' with all three indexes: still a Seq Scan, 4,180,000 rows to return 1,254");

      // 6. The planner skips an index when the query returns most of the table; the prefix form uses it.
      t.set("form", "range");
      var skipOk = t.stat("plan") === "Seq Scan" && has("The planner skipped loans_surname_idx: 3,942,300 pages by the index against 52,250 for the whole table.");
      t.set("form", "prefix");
      t.expect(skipOk && t.stat("plan") === "Index Scan" && t.stat("examined") === 418 && t.stat("time") === "3.376 ms",
        "surname > 'B' (3,929,200 rows): the planner skips the index, 3,942,300 pages against 52,250; LIKE 'yar%' uses the lower(surname) index, 422 pages");

      // 7. Composite index: leftmost column only.
      t.set("form", "due");
      var dueOk = t.stat("plan") === "Seq Scan" && t.api.state.ui.why.textContent.indexOf("serves its leftmost column first") >= 0;
      p = plan(pick(FORMS, "eq"), { surname: false, lower: false, comp: true });
      t.expect(dueOk && p.type === "index" && p.name === "loans_surname_due_idx" && p.pages === 9 && msText(p.us) === "0.072 ms",
        "(surname, due_date): due_date alone is a Seq Scan; surname = 'Yarrow' uses it, 9 pages, 0.072 ms");

      // 8. The 02:00 freeze, as now, with the story's numbers.
      t.click("reset");
      N = makeNight({ idx: { surname: true, lower: false, comp: false }, W: 1000, M: 100, pool: false, P: 20, big: false });
      N.step();
      first = N.conns === 100 && N.waiting === 900 && mb(N.memBytes()) === "953" && N.refused === 2;
      t.click("runall");
      t.expect(first && has("02:00:00 Kiosk: too many clients. 100 of 100 connections in use, 900 functions waiting.") &&
        has("02:00:41 The letter to Aldous Yarrow is written. His lookup read 4,180,000 rows to return 7.") &&
        has("03:07:11 The last of the 9,600 letters is written.") &&
        has("03:07:12 The kiosks work again. 8,064 requests refused since 02:00:00.") &&
        t.stat("refused") === "8,064" && t.stat("letters") === "9,600",
        "As now: 100 of 100 connections and 900 waiting at 02:00:00 (953 MB), Yarrow's letter 02:00:41, the last 03:07:11, kiosks back 03:07:12 after 8,064 refused");

      // 9. The index alone: the job is quick, but the kiosks are still refused while it runs.
      N = nightOf({ idx: { surname: true, lower: true, comp: false } });
      t.expect(N.refused === 192 && N.lastAt === 95 && N.yarrowAt === 0 && N.peakWaiting === 900,
        "Index only: 100 letters a second, last at 02:01:35, 192 kiosk requests refused");

      // 10. Option C: the index, PgBouncer with a job pool of 10, the job capped at 10.
      t.click("idx_lower");
      t.set("pooler", true);
      t.set("pool", "10");
      t.set("workers", "10");
      t.click("run1");
      var cNow = t.stat("conns") === "15 of 100" && t.stat("waiting") === 0 && t.stat("memory") === "143 of 8,590 MB";
      t.click("runall");
      t.expect(cNow && t.stat("refused") === 0 && t.stat("letters") === "9,600" && has("02:15:59 The last of the 9,600 letters is written.") &&
        has("02:00:00 The letter to Aldous Yarrow is written. His lookup read 7 rows to return 7."),
        "Option C: 15 of 100 connections (143 MB), nothing waiting, nothing refused, Yarrow's letter at 02:00:00, the last at 02:15:59");

      // 11. The pooler with the job capped at 50: the job waits, the kiosks don't.
      N = makeNight({ idx: { surname: true, lower: true, comp: false }, W: 50, M: 100, pool: true, P: 10, big: false });
      N.step();
      var w50 = N.waiting === 40 && N.refused === 0;
      while (!N.done) N.step();
      t.expect(w50 && N.refused === 0 && N.lastAt === 959,
        "Pooler, pool 10, job capped at 50: 40 functions wait at the pooler, no kiosk request refused, last letter 02:15:59");

      // 12. The pooler with the job not capped: its client slots fill and the kiosks are refused there.
      t.set("workers", "1000");
      t.click("runall");
      t.expect(t.stat("refused") === "1,902" && has("Kiosk: refused by the pooler. Its 100 client connections are all held by functions; 990 functions waiting for a database connection."),
        "Pooler with 1,000 functions: 990 waiting, the pooler's 100 client connections full, 1,902 kiosk requests refused");

      // 13. Option A: a server 4 times bigger.
      N = nightOf({ big: true });
      t.expect(N.refused === 2112 && N.lastAt === 1055 && N.yarrowAt === 10 && hms(START + N.lastAt) === "02:17:35",
        "4 times the server: 11 s a lookup, Yarrow's letter at 02:00:10, the last at 02:17:35, 2,112 refused");

      // 14. Option D: max_connections 2,000 moves the failure to memory.
      t.click("reset");
      t.set("maxconn", "2000");
      t.click("runall");
      t.expect(has("02:00:00 Out of memory: 1,002 connections at about 9.5 MB each need 9,550 MB, and the server has 8,590.") &&
        t.stat("letters") === 0 && t.stat("refused") === "14,400" && t.api.state.night.restarts === 655 &&
        has("PostgreSQL ran out of memory and restarted 655 times."),
        "max_connections 2,000: 1,002 connections need 9,550 MB of 8,590 at 02:00:00; 655 restarts, 0 letters, 14,400 refused by 04:00");

      // 15. max_connections 500: no crash, the same disk, the kiosks still refused.
      N = nightOf({ M: 500 });
      t.expect(N.restarts === 0 && N.refused === 7942 && hms(START + N.lastAt) === "03:06:52" && N.peakWaiting === 500,
        "max_connections 500: no crash, 500 lookups share the pages, the last letter 03:06:52, 7,942 refused");

      // 16. Capping alone keeps the kiosks working but the job is slow; reset returns to as now.
      N = nightOf({ W: 10 });
      t.click("reset");
      t.expect(N.refused === 0 && hms(START + N.lastAt) === "03:19:59" && t.stat("plan") === "Seq Scan" && t.stat("refused") === 0 &&
        t.stat("conns") === "0 of 100" && t.api.state.W === 1000 && !t.api.state.pool,
        "Capped at 10 without the index: nothing refused, but the job runs to 03:19:59; reset returns to Thursday as now");
    }
  });
})();
