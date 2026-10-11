/* sims/s3e05-v1.0.1.js  (published as sims/s3e05.js)
   Case s3e05 "The Copy That Lags": leader-follower replication at the twin town halls of
   Osterby (the old hall, east bank) and Westerby (the new hall, west bank). A replication lab:
   one leader (the old hall) and two followers (the annex across the square, and the new hall
   across the river), with the replication mode, a failure, the watchdog's failover, fencing
   and the old hall's return at dawn as controls.

   CHANGELOG
   v1.0.1 (2026-10-11) review fix: in commitOld, only a write made before the old hall went
     dark can lose its acknowledgement to the dark, so registrations after the 05:47 return
     keep theirs. The case is now content/s3/s3e05-v1.0.1.json.
   v1.0.0 (2026-10-11) first version. Controls: replication mode (async as now, semi-sync to
     one, sync to all), failure (none; 23:58:00 the old hall goes dark, before the marriage;
     23:59:00 the old hall goes dark, as Saturday; 23:59:00 the line under the bridge drops
     for 43 s while the old hall stays lit), failover
     (automatic after 5 min as now, automatic after 10 s, manual: wait for the old hall),
     fencing on or off, the old hall back at 05:47 on or off, next event, run to the end,
     reset. Stats: acknowledged writes lost, record numbers issued twice, registrations turned
     away, stale reads at the new hall, certificate wait p50 / p99, new hall lag p50 / p99,
     who is the register. selfTest: 24 assertions in 11 groups.

   Where every number comes from (conventions rule 14; the case is content/s3/s3e05-v1.0.1.json):
   - post: the old hall keeps the register and a night register, so people can come at any
     hour. Every entry goes into its log, and the log goes out on the old hall's one line out,
     in order, to two copies: the annex across the square and the new hall under the bridge.
   - post and OP's reply: since 23:00 there have been 20 registrations, No. 4451 to No. 4470,
     one every 3 minutes from 23:00:05 (No. 4470 at 23:57:05). Over that hour the annex's lag
     was p50 0.2 s, p99 0.4 s; the new hall's p50 2.2 s, p99 6.3 s (Mr Threlfall's dashboard).
     The sim's two lag tables below have exactly those percentiles; api.rand() shuffles which
     registration got which lag, so the percentiles never move. From 23:57 the replay uses each
     copy's median lag, 0.2 s and 2.2 s, so its times are exact.
   - post: 23:57:30 Absalom Kerridge files the scans of the 1911 book, 600 pages; the line out
     is busy for 120 s, until 23:59:30, and every entry after the scans waits behind them.
     23:58:12 No. 4471, the marriage of Cordelia Lusk and Tancred Bramwell, certificate at
     once. 23:58:41 No. 4472, a birth. 23:58:42 the new hall's notice board can't find
     No. 4471 (it reads each entry 30 s after it is made). 23:59:00 the old hall goes dark;
     the new hall's copy is 90 s behind (it lacks everything since the scans, 23:57:30).
     00:04:00 the watchdog (5 min of silence) promotes the new hall; next number 4471.
     00:31:00 No. 4471, a death, at the new hall. 05:47:00 the old hall comes back.
     05:52:00 its day clerk registers a birth as No. 4473; the new hall gave 4473 to a death
     at 02:40:00. Lost: 3 (the scans, No. 4471, No. 4472). Issued twice: 4471, 4472, 4473.
     Stale reads: 3 (No. 4471, No. 4472, and the 05:52 birth).
   - OP's reply: the rest of the night's registrations. 00:31 new hall (death), 01:15 old
     hall (birth), 02:40 new hall (death), 04:05 old hall (birth), 05:20 new hall (death),
     05:52 old hall (birth). Someone who finds the old hall dark or locked crosses the bridge
     and reaches the new hall 10 minutes later (01:25, 04:15). On Saturday the new hall gave
     4472 to the 01:25 birth, 4474 to the 04:15 birth and 4475 to the 05:20 death.
   - Part 2s: semi-sync to the annex with fencing: the scans, No. 4471 and No. 4472 are never
     confirmed; the couple and the family cross and register at the new hall at 00:09:00 as
     No. 4471 and No. 4472, certificate after 2.2 s (the annex is across the river from the
     new hall); the old hall comes back fenced holding 3 entries none of which was confirmed,
     2 registered again; lost 0, issued twice 0, turned away 0, stale reads 2; certificate
     wait p50 / p99 0.3 s / 2.2 s by morning. Sync to all: before the night p50 2.2 s, p99
     6.3 s; turned away 8. Manual: turned away 5, the old hall back as the register at 05:47,
     the birth at 05:52 is No. 4473. Fast failover (10 s) in a 43 s line drop: promoted at
     23:59:10, lost 3, issued twice 3 (4471, 4472, 4473), stale reads 5, two registers all
     night; with fencing, issued twice 2. No failure, semi-sync: No. 4471's certificate after
     78.2 s; certificate wait 0.2 s / 78.2 s; new hall lag 2.2 s / 122.2 s. Saturday with
     fencing only: lost 3, issued twice 2 (4471, 4472), the 05:52 birth crosses to 06:02:00.
   - The 23:58:00 failure (not in the story; for trying a different moment): only the scans
     are lost; the couple find the old hall dark, reach the new hall at 00:08:12 and become its
     No. 4471; promoted at 00:03:00; the unfenced old hall gives 4471 to the 05:52 birth;
     lost 1, issued twice 1, stale reads 1.

   Teaching model (stated in sim.lede):
   - Times are kept in tenths of a second so every sum is exact.
   - The old hall sends each entry once the line out is free (the scans take 120 s; others
     take no time). The annex has it 0.2 s after it is sent, the new hall 2.2 s after (or 2.2 s
     after the line under the bridge comes back). A copy has an entry once it has received it.
   - Async: the certificate is printed at once. Semi-sync to one: when the first copy has it.
     Sync to all: when every other hall has it. A register that can't count on enough copies
     following it turns the registration away at once.
   - The watchdog sits in the new hall. After the set silence it fences the old hall (if
     fencing is on), copies from the annex anything the new hall lacks (if it can reach the
     annex), and promotes the new hall. Manual: nobody promotes; the registrar waits for the
     old hall. The annex then follows the new hall, 2.2 s across the river.
   - An entry still waiting for a copy when its hall goes dark or is fenced is never
     confirmed; the people cross to the new hall and arrive 10 minutes later.
   - A returning old hall: fenced, it is read-only; not fenced, it carries on as a register,
     but no copy follows it any more; if nobody was promoted, it is the register again and
     sends the copies what they missed.
   - Stale read: the new hall's notice board reads each entry made at the old hall 30 s after
     it is made, from the new hall's own book. Lost: confirmed entries the promoted new hall
     lacks. Issued twice: one record number confirmed to two different people.
   - Percentiles are nearest rank: p50 is the value at rank ceil(0.5 N), p99 at ceil(0.99 N).

   Self-test arithmetic:
   - Opening: lost 0, issued twice 0, turned away 0, stale 0, certificate wait 0.0 s / 0.0 s,
     new hall lag 2.2 s / 6.3 s, register "old hall".
   - Semi + fence, by morning: certificate waits are the 20 annex lags (0.1 x4, 0.2 x8,
     0.3 x6, 0.4 x2) plus eight 2.2 s: rank 14 of 28 is 0.3, rank 28 is 2.2.
   - No failure, semi: waits are the 20 annex lags, six 0.2, 49.2 and 78.2: rank 14 of 28 is
     0.2, rank 28 is 78.2. New hall lags: the 20 new hall lags, six 2.2, 51.2, 80.2 and 122.2:
     rank 15 of 29 is 2.2, rank 29 is 122.2.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px):
   - Old hall (x 140) and annex (x 140), 240 wide: 20-260. New hall and watchdog (x 560),
     260 wide: 430-690. Rows at y 70 and y 230, 62 high: 98 px between boxes.
   - Longest sub "register, last No. 4478", 23 chars, 166 px in 240. Longest meta
     "automatic after 10 s, fencing on", 32 chars, 211 px in 260.

   Catalog note: the case's concepts are leader-follower-replication, sync-vs-async,
   replication-lag and read-your-writes.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (tenths of a second) ---------- */

  var SPEED = 30;                          // sim seconds per real second
  var DAY = 864000;                        // a day in tenths
  function H(h, m, s) { return (h * 3600 + m * 60 + s) * 10; }       // Saturday
  function N(h, m, s) { return DAY + H(h, m, s); }                    // after midnight

  var T_OPEN = H(23, 57, 20);              // the replay opens here
  var HIST_START = H(23, 0, 5);            // No. 4451
  var HIST_EVERY = 1800;                   // every 3 minutes
  var HIST_N = 20;                         // No. 4451 to No. 4470
  var FIRST_NUM = 4451;
  var SCANS_T = H(23, 57, 30);
  var SCANS_DUR = 1200;                    // 120 s on the line out
  var MARRIAGE_T = H(23, 58, 12);
  var BIRTH_T = H(23, 58, 41);
  var SAT_FAIL_T = H(23, 59, 0);           // Saturday's failure time
  var EARLY_T = H(23, 58, 0);              // the other failure time: before the marriage
  var BLIP = 430;                          // 43 s
  var CROSS = 6000;                        // 10 minutes across the bridge
  var READ_AFTER = 300;                    // the notice board reads 30 s later
  var A_LAG = 2;                           // annex, 0.2 s (the median)
  var N_LAG = 22;                          // new hall, 2.2 s (the median); also new hall to annex
  var RETURN_T = N(5, 47, 0);
  var END_T = N(6, 5, 0);
  var QUICK = 50;                          // a certificate within 5 s is reported on the same line
  var INF = Infinity;

  // The hour since 23:00, as Mr Threlfall's dashboard shows it (tenths of a second).
  // Annex: p50 (rank 10) 0.2 s, p99 (rank 20) 0.4 s. New hall: p50 2.2 s, p99 6.3 s.
  var ANNEX_LAGS = [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4];
  var NEW_LAGS = [12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 29, 31, 34, 38, 46, 63];

  var ARRIVALS = [
    { t: N(0, 31, 0), hall: "new", key: "a1", what: "death" },
    { t: N(1, 15, 0), hall: "old", key: "a2", what: "birth" },
    { t: N(2, 40, 0), hall: "new", key: "a3", what: "death" },
    { t: N(4, 5, 0), hall: "old", key: "a4", what: "birth" },
    { t: N(5, 20, 0), hall: "new", key: "a5", what: "death" },
    { t: N(5, 52, 0), hall: "old", key: "a6", what: "birth" }
  ];

  var MODE_OPTS = [
    { value: "async", label: "Async (as now)" },
    { value: "semi", label: "Semi-sync to one copy" },
    { value: "sync", label: "Sync to all copies" }
  ];
  var MODE_META = { async: "async", semi: "semi-sync to one", sync: "sync to all" };
  var FAIL_OPTS = [
    { value: "none", label: "None" },
    { value: "early", label: "23:58:00 the old hall goes dark, before the marriage" },
    { value: "dark", label: "23:59:00 the old hall goes dark (as Saturday)" },
    { value: "blip", label: "23:59:00 the line under the bridge drops for 43 s" }
  ];
  var FAILOVER_OPTS = [
    { value: "auto5", label: "Automatic after 5 min (as now)" },
    { value: "auto10", label: "Automatic after 10 s" },
    { value: "manual", label: "Manual: wait for the old hall" }
  ];

  /* ---------- small helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function hms(tenths) {
    var s = Math.floor(tenths / 10) % 86400;
    if (s < 0) s += 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }

  function sec(tenths) { return (tenths / 10).toFixed(1); }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  // ["a"] -> "a"; ["a", "b"] -> "a and b"; ["a", "b", "c"] -> "a, b and c"
  function joinList(a) {
    if (a.length <= 1) return a.join("");
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }

  function rank(sorted, p) {
    var i = Math.ceil(p * sorted.length - 1e-9) - 1;
    if (i < 0) i = 0;
    return sorted[i];
  }

  // p50 / p99 of the values whose time has come, as "2.2 s / 6.3 s".
  function pctText(list, t) {
    var v = [];
    for (var i = 0; i < list.length; i++) if (list[i].t <= t) v.push(list[i].v);
    if (!v.length) return "none yet";
    v.sort(function (a, b) { return a - b; });
    return sec(rank(v, 0.5)) + " s / " + sec(rank(v, 0.99)) + " s";
  }

  function shuffled(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var x = a[i]; a[i] = a[j]; a[j] = x;
    }
    return a;
  }

  function entryName(e) { return e.kind === "scans" ? "the scans" : "No. " + e.num; }

  /* ---------- the night, worked out in full ---------- */

  // Returns { init: snap, ev: [{t, msg, tone, snap}], end }.
  function simulate(cfg, table) {
    var mode = cfg.mode;
    // "early" is the old hall going dark at 23:58:00 instead of 23:59:00.
    var FAIL_T = cfg.fail === "early" ? EARLY_T : SAT_FAIL_T;
    var fail = cfg.fail === "early" ? "dark" : cfg.fail;
    var D = cfg.failover === "auto5" ? 3000 : (cfg.failover === "auto10" ? 100 : null);
    var promoT = null;
    if (fail === "dark" && D !== null) promoT = FAIL_T + D;
    if (fail === "blip" && D !== null && D < BLIP) promoT = FAIL_T + D;
    var fenced = !!cfg.fence && promoT !== null;
    var R = fail === "dark" && cfg.ret ? RETURN_T : null;
    var oldStop = fail === "dark" ? FAIL_T : (fail === "blip" && fenced ? promoT : INF);
    var annexToNew = promoT !== null && oldStop <= promoT;

    function blipOn(t) { return fail === "blip" && t >= FAIL_T && t < FAIL_T + BLIP; }
    function oldDark(t) { return fail === "dark" && t >= FAIL_T && (R === null || t < R); }
    // The old hall is up, not fenced, and sending its log to the copies.
    function oldSends(t) {
      if (t < oldStop) return true;
      return fail === "dark" && R !== null && promoT === null && t >= R;
    }
    // The old hall takes registrations.
    function oldRegister(t) {
      if (fail === "dark") {
        if (t < FAIL_T) return true;
        if (R === null || t < R) return false;
        return !fenced;
      }
      if (fail === "blip") return !(fenced && t >= promoT);
      return true;
    }
    function oldFencedAt(t) {
      if (!fenced) return false;
      if (fail === "dark") return R !== null && t >= R;
      return t >= promoT;
    }
    function newRegister(t) { return promoT !== null && t >= promoT; }

    var entries = [];                       // every entry, in the order it was made
    var waits = [];                         // {t, v}: certificate waits, registrations only
    var lags = [];                          // {t, v}: new hall lags, entries from the old hall
    var oldFree = 0;                        // when the line out is next free
    var unsent = [];                        // entries the old hall never finished sending
    var C = { lost: 0, dup: 0, refused: 0, stale: 0 };
    var out = { ev: [], end: END_T, init: null };
    var agenda = [];
    var seq = 0;
    var now = T_OPEN;

    function at(t, fn) { agenda.push({ t: t, s: seq++, fn: fn }); }

    function inNew(e, t) {
      if (e.hall === "new") return e.c <= t;
      return e.nAt !== null && e.nAt <= t;
    }
    function inAnnex(e, t) { return e.aAt !== null && e.aAt <= t; }

    function maxNum(test) {
      var m = 0;
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.num !== null && test(e) && e.num > m) m = e.num;
      }
      return m;
    }
    function nextOld() { return maxNum(function (e) { return e.hall === "old"; }) + 1; }
    function nextNew(t) { return maxNum(function (e) { return inNew(e, t); }) + 1; }

    function snap() {
      var t = now;
      var regs = [];
      if (oldRegister(t) && !oldDark(t)) regs.push("old hall");
      if (newRegister(t)) regs.push("new hall");
      // node texts
      var oldSub;
      if (oldDark(t)) oldSub = "dark";
      else if (oldFencedAt(t)) oldSub = "fenced, read-only";
      else oldSub = "register, last No. " + maxNum(function (e) { return e.hall === "old"; });
      var newSub = (newRegister(t) ? "register" : "copy") + ", last No. " + maxNum(function (e) { return inNew(e, t); });
      var newMeta;
      if (newRegister(t)) newMeta = "the register";
      else {
        var oldest = null;
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (e.hall === "old" && e.c <= t && !inNew(e, t) && (oldest === null || e.c < oldest)) oldest = e.c;
        }
        newMeta = oldest === null ? "up to date" : Math.floor((t - oldest) / 10) + " s behind";
      }
      var annexSub = "copy, last No. " + maxNum(function (e) { return inAnnex(e, t); });
      var annexMeta = annexToNew && t >= promoT ? "follows the new hall" : (oldSends(t) ? "follows the old hall" : "no feed");
      var watchSub;
      if (promoT !== null && t >= promoT) watchSub = "promoted at " + hms(promoT);
      else if (fail !== "none" && t >= FAIL_T && (oldDark(t) || blipOn(t))) watchSub = "silence " + Math.floor((t - FAIL_T) / 10) + " s";
      else watchSub = "listening";
      return {
        lost: C.lost, dup: C.dup, refused: C.refused, stale: C.stale,
        wait: pctText(waits, t), lag: pctText(lags, t),
        register: regs.length ? regs.join(" and ") : "none",
        oldSub: oldSub, newSub: newSub, newMeta: newMeta, annexSub: annexSub, annexMeta: annexMeta,
        watchSub: watchSub, oldDark: oldDark(t), newReg: newRegister(t)
      };
    }

    function emit(msg, tone) { out.ev.push({ t: now, msg: msg, tone: tone || "", snap: snap() }); }

    function waitWord() { return mode === "semi" ? "a copy" : "both copies"; }

    // Same confirmed number, another person, in the other hall's book.
    function dupWith(e) {
      for (var i = 0; i < entries.length; i++) {
        var o = entries[i];
        if (o !== e && o.num === e.num && o.hall !== e.hall && o.confirmed && o.key !== e.key) return true;
      }
      return false;
    }

    function certText(e) {
      if (e.ack === null) return e.kind === "scans" ? " Waiting for " + waitWord() + "." : " Waiting for " + waitWord() + " before the certificate.";
      var w = e.ack - e.c;
      if (w === 0) return e.kind === "scans" ? " Confirmed at once." : " Certificate printed at once.";
      if (w <= QUICK) return e.kind === "scans" ? " Confirmed after " + sec(w) + " s." : " Certificate after " + sec(w) + " s.";
      return e.kind === "scans" ? " Waiting for " + waitWord() + "." : " Waiting for " + waitWord() + " before the certificate.";
    }

    function newEntry(kind, key, label) {
      return { kind: kind, key: key, label: label, num: null, hall: null, c: 0, ack: null, sendT: null,
        aAt: null, nAt: null, confirmed: false, unconfirmed: false };
    }

    // Schedule a certificate that comes later than QUICK, and the notice board read.
    function after(e) {
      if (e.ack !== null) {
        if (e.kind === "reg") waits.push({ t: e.ack, v: e.ack - e.c });
        if (e.ack - e.c > QUICK) {
          at(e.ack, function () {
            emit(e.kind === "scans" ? "The scans are confirmed after " + sec(e.ack - e.c) + " s." :
              "Certificate for No. " + e.num + " printed after " + sec(e.ack - e.c) + " s.", "");
          });
        }
      }
      if (e.hall === "old" && e.kind === "reg") {
        var rt = e.c + READ_AFTER;
        var stale = e.nAt === null || e.nAt > rt;
        if (stale && rt <= END_T) {
          at(rt, function () {
            C.stale += 1;
            emit("New hall notice board: No. " + e.num + " is not in its book yet. Stale read.", "warn");
          });
        }
      }
    }

    function send(e) {
      var s = Math.max(e.c, oldFree) + (e.kind === "scans" ? SCANS_DUR : 0);
      oldFree = s;
      if (!oldSends(s)) { e.sendT = null; unsent.push(e); return; }
      e.sendT = s;
      e.aAt = s + A_LAG;
      var base = blipOn(s) ? FAIL_T + BLIP : s;
      var nr = base + N_LAG;
      e.nAt = promoT !== null && nr > promoT ? null : nr;
      if (e.nAt !== null) lags.push({ t: e.nAt, v: e.nAt - e.c });
    }

    // A registration (or the scans) made at the old hall at time now.
    function commitOld(e, from) {
      var t = now;
      var followers = (oldSends(t) ? 1 : 0) + (oldSends(t) && !newRegister(t) ? 1 : 0);
      var need = mode === "semi" ? 1 : (mode === "sync" ? 2 : 0);
      if (followers < need) {
        C.refused += 1;
        emit("Old hall: " + (mode === "semi" ? "semi-sync needs a copy, and none follows it." : "sync to all needs both copies, and they don't follow it.") +
          " The " + e.label + " is turned away.", "bad");
        return;
      }
      e.hall = "old";
      e.c = t;
      if (e.kind === "reg") e.num = nextOld();
      entries.push(e);
      if (oldSends(t)) send(e); else { e.sendT = null; unsent.push(e); }
      if (mode === "async") e.ack = t;
      else if (mode === "semi") {
        var c1 = [e.aAt, e.nAt].filter(function (x) { return x !== null; });
        e.ack = c1.length ? Math.min.apply(null, c1) : null;
      } else {
        e.ack = e.aAt !== null && e.nAt !== null ? Math.max(e.aAt, e.nAt) : null;
      }
      if (e.ack !== null && e.c < oldStop && e.ack > oldStop) e.ack = null;
      e.confirmed = e.ack !== null;
      var msg;
      if (e.kind === "scans") {
        msg = "Old hall: Absalom files the scans of the 1911 book, 600 pages. The line out is busy until " + hms(oldFree) + "." + certText(e);
      } else {
        msg = (from || "Old hall: ") + "No. " + e.num + ", " + e.label + "." + certText(e);
      }
      var dup = e.confirmed && dupWith(e);
      if (dup) { C.dup += 1; msg += " Number " + e.num + " now has two owners."; }
      emit(msg, dup ? "bad" : "");
      after(e);
    }

    // A registration made at the new hall once it is the register.
    function commitNew(e) {
      var t = now;
      var followers = annexToNew ? 1 : 0;
      var need = mode === "semi" ? 1 : (mode === "sync" ? 2 : 0);
      if (followers < need) {
        C.refused += 1;
        emit("New hall: " + (mode === "semi" ? "semi-sync needs a copy, and none follows it." : "sync to all needs both other halls.") +
          " The " + e.label + " is turned away.", "bad");
        return;
      }
      e.hall = "new";
      e.c = t;
      e.num = nextNew(t);
      entries.push(e);
      if (annexToNew) e.aAt = t + N_LAG;
      e.ack = mode === "async" ? t : t + N_LAG;
      e.confirmed = true;
      var msg = "New hall: No. " + e.num + ", " + e.label + "." + certText(e);
      var dup = dupWith(e);
      if (dup) { C.dup += 1; msg += " Number " + e.num + " now has two owners."; }
      emit(msg, dup ? "bad" : "");
      after(e);
    }

    function arrive(hall, e, crossed) {
      var t = now;
      if (hall === "old") {
        if (oldDark(t) || oldFencedAt(t)) {
          var due = t + CROSS;
          emit((oldDark(t) ? "Old hall dark: the " : "Old hall fenced: the ") + e.label + " crosses the bridge, due at the new hall at " + hms(due) + ".", "warn");
          at(due, function () { arrive("new", e, true); });
          return;
        }
        commitOld(e);
        return;
      }
      if (newRegister(t)) { commitNew(e); return; }
      if (oldRegister(t) && oldSends(t) && !blipOn(t)) { commitOld(e, "Old hall, from the new hall's counter: "); return; }
      C.refused += 1;
      emit("New hall: no register to take the " + e.label + ". Turned away.", "bad");
    }

    // The old hall goes dark, or is fenced while still lit.
    function stop() {
      var never = [];
      var unconf = [];
      var retry = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.hall !== "old") continue;
        if (e.sendT === null) never.push(e);
        if (!e.confirmed) { e.unconfirmed = true; unconf.push(e); if (e.kind === "reg") retry.push(e); }
      }
      var m = fail === "dark" ? "OLD HALL DARK." : "OLD HALL FENCED: it stops taking registrations.";
      if (never.length) m += " Never sent to either copy: " + joinList(never.map(entryName)) + ".";
      if (unconf.length) m += " Never confirmed: " + joinList(unconf.map(entryName)) + ".";
      if (retry.length) m += " The people waiting will try the new hall at " + hms(now + CROSS) + ".";
      emit(m, "bad");
      retry.forEach(function (o) {
        var again = newEntry("reg", o.key, o.label);
        at(now + CROSS, function () { arrive("new", again, true); });
      });
    }

    function promote() {
      var t = now;
      var m = "Watchdog: " + (D === 3000 ? "5 min" : "10 s") + " of silence from the old hall.";
      if (fenced) m += " Fences the old hall.";
      var caught = 0;
      if (!blipOn(t)) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (e.hall === "old" && inAnnex(e, t) && !inNew(e, t)) { e.nAt = t; caught += 1; }
        }
      }
      var lost = [];
      for (var j = 0; j < entries.length; j++) {
        var o = entries[j];
        if (o.hall === "old" && o.confirmed && o.ack <= t && !inNew(o, t)) lost.push(o);
      }
      C.lost += lost.length;
      m += caught ? " Copies " + caught + " entries from the annex. Promotes the new hall." : " Promotes the new hall.";
      m += lost.length ? " It lacks " + lost.length + " acknowledged write" + (lost.length > 1 ? "s" : "") + ": " + joinList(lost.map(entryName)) + "." :
        " It lacks no acknowledged write.";
      m += " Next number: " + nextNew(t) + ".";
      emit(m, lost.length ? "bad" : "warn");
    }

    function comeBack() {
      var t = now;
      if (promoT === null) {
        var resent = unsent.slice();
        unsent = [];
        oldFree = Math.max(oldFree, t);
        resent.forEach(function (e) {
          var s = Math.max(t, oldFree) + (e.kind === "scans" ? SCANS_DUR : 0);
          oldFree = s;
          e.sendT = s;
          e.aAt = s + A_LAG;
          e.nAt = s + N_LAG;
          lags.push({ t: e.nAt, v: e.nAt - e.c });
        });
        emit("Old hall back. Still the register: it sends the copies what they missed.", "ok");
        return;
      }
      if (fenced) {
        var lacks = [];
        var again = 0;
        var confirmed = 0;
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (e.hall !== "old" || inNew(e, t)) continue;
          lacks.push(e);
          if (e.confirmed) confirmed += 1;
          for (var j = 0; j < entries.length; j++) {
            if (entries[j].hall === "new" && entries[j].key === e.key) { again += 1; break; }
          }
        }
        var m = "Old hall back, fenced: read-only.";
        if (lacks.length) {
          m += " Its book holds " + lacks.length + (lacks.length === 1 ? " entry" : " entries") + " the register lacks: " + joinList(lacks.map(entryName)) + ".";
          if (confirmed === 0) m += lacks.length === 1 ? " It was never confirmed." : " None was confirmed.";
          else if (confirmed === lacks.length) m += lacks.length === 1 ? " It was confirmed." : " All were confirmed.";
          else m += " " + confirmed + (confirmed === 1 ? " was confirmed." : " were confirmed.");
          if (again) m += " " + again + " of them " + (again > 1 ? "were" : "was") + " registered again in the new hall.";
          m += " Reconcile by hand.";
        }
        emit(m, "warn");
        return;
      }
      emit("Old hall back, not fenced. It still thinks it is the register: two registers now.", "bad");
    }

    /* the hour before the replay opens */
    for (var k = 0; k < HIST_N; k++) {
      var h = newEntry("reg", "h" + k, "registration");
      h.hall = "old";
      h.c = HIST_START + k * HIST_EVERY;
      h.num = FIRST_NUM + k;
      h.sendT = h.c;
      h.aAt = h.c + table.a[k];
      h.nAt = h.c + table.n[k];
      h.ack = mode === "async" ? h.c : (mode === "semi" ? h.aAt : h.nAt);
      h.confirmed = true;
      entries.push(h);
      waits.push({ t: h.ack, v: h.ack - h.c });
      lags.push({ t: h.nAt, v: h.nAt - h.c });
      oldFree = h.c;
    }
    out.init = snap();

    /* the night's agenda */
    at(SCANS_T, function () { commitOld(newEntry("scans", "scans", "scans")); });
    at(MARRIAGE_T, function () { arrive("old", newEntry("reg", "marriage", "marriage, Lusk and Bramwell"), false); });
    at(BIRTH_T, function () { arrive("old", newEntry("reg", "birth", "birth"), false); });
    if (fail === "dark") at(FAIL_T, stop);
    if (fail === "blip") {
      at(FAIL_T, function () { emit("LINE UNDER THE BRIDGE DOWN for 43 s. The old hall stays lit.", "bad"); });
      at(FAIL_T + BLIP, function () {
        emit("Line under the bridge back." + (newRegister(now) ? " The new hall is a register now and no longer follows the old hall." : " The new hall catches up."), newRegister(now) ? "warn" : "ok");
      });
    }
    if (promoT !== null) {
      at(promoT, promote);
      if (fail === "blip" && fenced) at(promoT, stop);
    }
    if (R !== null) at(R, comeBack);
    ARRIVALS.forEach(function (a) {
      at(a.t, function () { arrive(a.hall, newEntry("reg", a.key, a.what), false); });
    });
    at(END_T, function () {
      emit("Morning. Acknowledged writes lost: " + C.lost + ". Numbers issued twice: " + C.dup +
        ". Turned away: " + C.refused + ". Stale reads: " + C.stale + ".", C.lost || C.dup ? "bad" : "ok");
    });

    while (agenda.length) {
      var bi = 0;
      for (var q = 1; q < agenda.length; q++) {
        if (agenda[q].t < agenda[bi].t || (agenda[q].t === agenda[bi].t && agenda[q].s < agenda[bi].s)) bi = q;
      }
      var item = agenda.splice(bi, 1)[0];
      now = item.t;
      item.fn();
    }
    return out;
  }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 330,
    aria: "Replication lab for the twin town halls. The old hall in Osterby is the register and sends its log on its one line out to two copies: the annex across the square, and the new hall in Westerby, across the river under the bridge. The watchdog in the new hall promotes the new hall when the old hall goes silent.",
    nodes: [
      { id: "old", label: "Old hall (Osterby)", sub: "register, last No. 4470", meta: "async", x: 140, y: 70, w: 240, h: 62, shape: "db", tone: "ok" },
      { id: "annex", label: "Annex", sub: "copy, last No. 4470", meta: "follows the old hall", x: 140, y: 230, w: 240, h: 62, shape: "db", tone: "" },
      { id: "newh", label: "New hall (Westerby)", sub: "copy, last No. 4470", meta: "up to date", x: 560, y: 70, w: 260, h: 62, shape: "db", tone: "" },
      { id: "watch", label: "Watchdog", sub: "listening", meta: "after 5 min, fencing off", x: 560, y: 230, w: 260, h: 62, shape: "box", tone: "" }
    ],
    edges: [
      { from: "old", to: "annex", label: "log" },
      { from: "old", to: "newh", label: "under the bridge" },
      { from: "watch", to: "newh", label: "promotes", dash: true, tone: "muted" }
    ],
    notes: [
      { x: 345, y: 318, text: "the river", tone: "muted", anchor: "middle" }
    ]
  };

  /* ---------- the replay ---------- */

  function cfgOf(S) { return { mode: S.mode, fail: S.fail, failover: S.failover, fence: S.fence, ret: S.ret }; }

  function watchMeta(S) {
    var f = S.failover === "auto5" ? "after 5 min" : (S.failover === "auto10" ? "automatic after 10 s" : "manual");
    return f + ", fencing " + (S.fence ? "on" : "off");
  }

  function startNight(api) {
    var S = api.state;
    S.night = simulate(cfgOf(S), S.table);
    S.t = T_OPEN;
    S.shown = 0;
    S.over = false;
    api.speed = SPEED;
    api.clock = T_OPEN / 10;
    var a = S.table.a[HIST_N - 1];
    var n = S.table.n[HIST_N - 1];
    api.log("Saturday from 23:57:20. Since 23:00: 20 registrations, No. 4451 to No. 4470, one every 3 minutes. Lag p50 / p99: annex 0.2 s / 0.4 s, new hall 2.2 s / 6.3 s. No. 4470 reached the annex after " +
      sec(a) + " s and the new hall after " + sec(n) + " s. Mode: " + pick(MODE_OPTS, S.mode).label.replace(" (as now)", "").toLowerCase() +
      ". Failure: " + (S.fail === "none" ? "none" : pick(FAIL_OPTS, S.fail).label.replace(" (as Saturday)", "")) +
      ". Failover: " + pick(FAILOVER_OPTS, S.failover).label.replace(" (as now)", "").toLowerCase() +
      ". Fencing " + (S.fence ? "on" : "off") + ". Old hall back at 05:47: " + (S.ret ? "yes" : "no") + ".", "");
    draw(api);
  }

  function replay(api, what) {
    api.clock = T_OPEN / 10;
    api.log(what + " Replaying Saturday from 23:57:20.", "");
    startNight(api);
  }

  function advance(api, target) {
    var S = api.state;
    if (S.over) return;
    var to = Math.min(target, S.night.end);
    while (S.shown < S.night.ev.length && S.night.ev[S.shown].t <= to + 1e-6) {
      var e = S.night.ev[S.shown];
      api.clock = Math.floor(e.t / 10);
      api.log(e.msg, e.tone);
      S.shown += 1;
    }
    S.t = to;
    api.clock = Math.floor(to / 10 + 1e-6);
    if (to >= S.night.end) S.over = true;
    draw(api);
  }

  function nextEventTime(S) {
    if (S.shown < S.night.ev.length) return S.night.ev[S.shown].t;
    return S.night.end;
  }

  /* ---------- drawing ---------- */

  function draw(api) {
    var S = api.state;
    var sn = S.shown ? S.night.ev[S.shown - 1].snap : S.night.init;

    var old = api.node("old");
    old.text("sub", sn.oldSub);
    old.text("meta", MODE_META[S.mode]);
    old.set(sn.oldDark ? "bad" : (sn.oldSub === "fenced, read-only" ? "muted" : (sn.register.indexOf("old hall") >= 0 && sn.newReg ? "warn" : "ok")));

    var nh = api.node("newh");
    nh.text("sub", sn.newSub);
    nh.text("meta", sn.newMeta);
    nh.set(sn.newReg ? (sn.register.indexOf("old hall") >= 0 ? "warn" : "ok") : (sn.newMeta === "up to date" ? "" : "warn"));

    var ax = api.node("annex");
    ax.text("sub", sn.annexSub);
    ax.text("meta", sn.annexMeta);
    ax.set(sn.annexMeta === "no feed" ? "muted" : "");

    var w = api.node("watch");
    w.text("sub", sn.watchSub);
    w.text("meta", watchMeta(S));
    w.set(sn.newReg ? "warn" : "");

    S.stat.lost(String(sn.lost));
    S.stat.dup(String(sn.dup));
    S.stat.refused(String(sn.refused));
    S.stat.stale(String(sn.stale));
    S.stat.wait(sn.wait);
    S.stat.lag(sn.lag);
    S.stat.register(sn.register);

    S.ctl.next.disable(S.over);
    S.ctl.end.disable(S.over);
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.night || S.over) return;
    advance(api, S.t + dt * api.speed * 10);
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    old: "<strong>The old hall, Osterby.</strong> The leader: it takes every registration and writes it into its log, then sends the log on its one line out, in order, to both copies. A big entry, like 600 pages of scans, keeps the line busy, and every entry after it waits. In async mode it prints the certificate at once; in semi-sync, when the first copy has the entry; in sync to all, when both have it.",
    annex: "<strong>The annex.</strong> A follower across the square from the old hall: it gets each entry 0.2 s after it is sent (p50 0.2 s, p99 0.4 s over the last hour). It has no counter. After a failover it follows the new hall, 2.2 s away across the river.",
    newh: "<strong>The new hall, Westerby.</strong> A follower across the river: each entry arrives 2.2 s after it is sent, or later if the line under the bridge is down (p50 2.2 s, p99 6.3 s over the last hour). Its notice board reads each old-hall entry from its own book 30 s after it is made; if it isn't there yet, that's a stale read. When the watchdog promotes it, it becomes the register and numbers from its own last entry.",
    watch: "<strong>The watchdog.</strong> Sits in the new hall and listens for the old hall. After the set silence it fences the old hall (if fencing is on), copies anything the new hall lacks from the annex (if it can reach it), and promotes the new hall. It can't tell a dark hall from a cut line: both are silence."
  };

  /* ---------- the module ---------- */

  DL.sims.define("s3e05", {
    diagram: DIAGRAM,
    startClock: T_OPEN / 10,

    setup: function (api) {
      var S = api.state;
      S.mode = "async";
      S.fail = "dark";
      S.failover = "auto5";
      S.fence = false;
      S.ret = true;
      // Drawn once per setup with the seeded generator, and reused on every replay.
      S.table = { a: shuffled(ANNEX_LAGS, api.rand), n: shuffled(NEW_LAGS, api.rand) };
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.mode = api.control.select("mode", "Replication mode", MODE_OPTS, "async", function (v) {
        var o = pick(MODE_OPTS, v);
        if (!o) return;
        S.mode = String(o.value);
        replay(api, "Mode: " + o.label.replace(" (as now)", "").toLowerCase() + ".");
      });
      S.ctl.fail = api.control.select("fail", "Failure", FAIL_OPTS, "dark", function (v) {
        var o = pick(FAIL_OPTS, v);
        if (!o) return;
        S.fail = String(o.value);
        replay(api, "Failure: " + o.label.replace(" (as Saturday)", "") + ".");
      });
      S.ctl.failover = api.control.select("failover", "Failover", FAILOVER_OPTS, "auto5", function (v) {
        var o = pick(FAILOVER_OPTS, v);
        if (!o) return;
        S.failover = String(o.value);
        replay(api, "Failover: " + o.label.replace(" (as now)", "").toLowerCase() + ".");
      });
      S.ctl.fence = api.control.toggle("fence", "Fencing: lock the old hall before promoting", false, function (on) {
        S.fence = !!on;
        replay(api, "Fencing: " + (S.fence ? "on." : "off."));
      });
      S.ctl.ret = api.control.toggle("ret", "The old hall comes back at 05:47", true, function (on) {
        S.ret = !!on;
        replay(api, "The old hall comes back at 05:47: " + (S.ret ? "yes." : "no."));
      });
      S.ctl.next = api.control.button("next", "Next event", function () { advance(api, nextEventTime(S)); });
      S.ctl.end = api.control.button("end", "Run to the end", function () { advance(api, S.night.end); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        lost: api.stat("lost", "acknowledged writes lost", "bad"),
        dup: api.stat("dup", "record numbers issued twice", "bad"),
        refused: api.stat("refused", "registrations turned away", "warn"),
        stale: api.stat("stale", "stale reads at the new hall", "warn"),
        wait: api.stat("wait", "certificate wait p50 / p99", ""),
        lag: api.stat("lag", "new hall lag p50 / p99", ""),
        register: api.stat("register", "the register", "")
      };

      api.onNodeClick(function (id) { if (INFO[id]) api.info(INFO[id]); });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startNight(api);
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function since() { return t.logText().slice(mark); }
      function has(log, s) { return log.indexOf(s) >= 0; }
      var log;

      // 1. The opening state, before 23:57:30.
      t.expect(t.stat("lost") === 0 && t.stat("dup") === 0 && t.stat("refused") === 0 && t.stat("stale") === 0,
        "Opening: nothing lost, no number issued twice, nobody turned away, no stale read");
      t.expect(t.stat("wait") === "0.0 s / 0.0 s" && t.stat("lag") === "2.2 s / 6.3 s" && t.stat("register") === "old hall",
        "Opening: async certificates at once; the new hall's lag over the hour is p50 2.2 s, p99 6.3 s; the old hall is the register");
      t.expect(t.node("newh").text.sub === "copy, last No. 4470" && t.node("annex").text.sub === "copy, last No. 4470" &&
        t.node("old").text.sub === "register, last No. 4470",
        "Opening: both copies have everything up to No. 4470");

      // 2. Saturday as now: async, the old hall dark at 23:59:00, promoted after 5 min, no fencing.
      begin();
      t.click("end");
      log = since();
      t.expect(has(log, "23:57:30 Old hall: Absalom files the scans of the 1911 book, 600 pages. The line out is busy until 23:59:30. Confirmed at once.") &&
        has(log, "23:58:12 Old hall: No. 4471, marriage, Lusk and Bramwell. Certificate printed at once.") &&
        has(log, "23:58:42 New hall notice board: No. 4471 is not in its book yet. Stale read."),
        "Saturday: the scans hold the line out until 23:59:30; No. 4471 is confirmed at 23:58:12 but not at the new hall at 23:58:42");
      t.expect(has(log, "23:59:00 OLD HALL DARK. Never sent to either copy: the scans, No. 4471 and No. 4472.") &&
        has(log, "00:04:00 Watchdog: 5 min of silence from the old hall. Promotes the new hall. It lacks 3 acknowledged writes: the scans, No. 4471 and No. 4472. Next number: 4471."),
        "Saturday: dark at 23:59:00 with 3 writes never sent; the new hall promoted at 00:04:00 lacks them and numbers from 4471");
      t.expect(has(log, "00:31:00 New hall: No. 4471, death. Certificate printed at once. Number 4471 now has two owners.") &&
        has(log, "05:47:00 Old hall back, not fenced. It still thinks it is the register: two registers now.") &&
        has(log, "05:52:00 Old hall: No. 4473, birth. Certificate printed at once. Number 4473 now has two owners."),
        "Saturday: 4471 is a wedding in one book and a death in the other; at 05:52 the old hall gives out 4473 again");
      t.expect(t.stat("lost") === 3 && t.stat("dup") === 3 && t.stat("stale") === 3 && t.stat("refused") === 0 &&
        t.stat("register") === "old hall and new hall",
        "Saturday by morning: 3 lost, 3 numbers issued twice, 3 stale reads, two registers");

      // 2b. Saturday with fencing only: one register, but the same loss.
      t.click("fence");
      begin();
      t.click("end");
      log = since();
      t.expect(has(log, "05:47:00 Old hall back, fenced: read-only. Its book holds 3 entries the register lacks: the scans, No. 4471 and No. 4472. All were confirmed. Reconcile by hand.") &&
        has(log, "05:52:00 Old hall fenced: the birth crosses the bridge, due at the new hall at 06:02:00.") &&
        t.stat("lost") === 3 && t.stat("dup") === 2 && t.stat("register") === "new hall",
        "Saturday with fencing: the old hall comes back read-only, the 05:52 birth crosses; still 3 lost, and 4471 and 4472 issued twice");

      // 2c. The old hall dark at 23:58:00, before the marriage (fencing off).
      t.click("fence");
      t.set("fail", "early");
      begin();
      t.click("end");
      log = since();
      t.expect(has(log, "23:58:00 OLD HALL DARK. Never sent to either copy: the scans.") &&
        has(log, "00:03:00 Watchdog: 5 min of silence from the old hall. Promotes the new hall. It lacks 1 acknowledged write: the scans. Next number: 4471.") &&
        has(log, "00:08:12 New hall: No. 4471, marriage, Lusk and Bramwell. Certificate printed at once.") &&
        has(log, "05:52:00 Old hall: No. 4471, birth. Certificate printed at once. Number 4471 now has two owners."),
        "Dark at 23:58:00: only the scans are lost; the couple cross and are the new hall's 4471, which the returning old hall gives out again at 05:52");
      t.expect(t.stat("lost") === 1 && t.stat("dup") === 1 && t.stat("stale") === 1 && t.stat("refused") === 0,
        "Dark at 23:58:00 by morning: 1 lost, 1 number issued twice, 1 stale read");
      t.set("fail", "dark");

      // 3. Semi-sync to one copy, with fencing: the senior answer.
      t.set("mode", "semi");
      t.click("fence");
      begin();
      t.click("end");
      log = since();
      t.expect(has(log, "23:58:12 Old hall: No. 4471, marriage, Lusk and Bramwell. Waiting for a copy before the certificate.") &&
        has(log, "23:59:00 OLD HALL DARK. Never sent to either copy: the scans, No. 4471 and No. 4472. Never confirmed: the scans, No. 4471 and No. 4472. The people waiting will try the new hall at 00:09:00."),
        "Semi-sync: No. 4471 waits behind the scans for a copy and is never confirmed; the people waiting cross to the new hall");
      t.expect(has(log, "00:04:00 Watchdog: 5 min of silence from the old hall. Fences the old hall. Promotes the new hall. It lacks no acknowledged write. Next number: 4471.") &&
        has(log, "00:09:00 New hall: No. 4471, marriage, Lusk and Bramwell. Certificate after 2.2 s."),
        "Semi-sync with fencing: nothing acknowledged is lost, and the couple are married at the new hall at 00:09:00 as No. 4471");
      t.expect(has(log, "05:47:00 Old hall back, fenced: read-only. Its book holds 3 entries the register lacks: the scans, No. 4471 and No. 4472. None was confirmed. 2 of them were registered again in the new hall. Reconcile by hand.") &&
        has(log, "06:02:00 New hall: No. 4478, birth. Certificate after 2.2 s."),
        "Semi-sync with fencing: the old hall returns read-only with 3 unconfirmed entries to reconcile; the 05:52 birth crosses and is No. 4478");
      t.expect(t.stat("lost") === 0 && t.stat("dup") === 0 && t.stat("refused") === 0 && t.stat("stale") === 2 &&
        t.stat("wait") === "0.3 s / 2.2 s" && t.stat("register") === "new hall",
        "Semi-sync with fencing by morning: 0 lost, 0 issued twice, 0 turned away, 2 stale reads, certificate wait 0.3 s / 2.2 s");

      // 4. Sync to all copies (fencing off again).
      t.click("fence");
      t.set("mode", "sync");
      t.expect(t.stat("wait") === "2.2 s / 6.3 s",
        "Sync to all: over the hour every certificate waits for the new hall, p50 2.2 s, p99 6.3 s");
      begin();
      t.click("end");
      log = since();
      t.expect(has(log, "00:31:00 New hall: sync to all needs both other halls. The death is turned away.") &&
        t.stat("refused") === 8 && t.stat("lost") === 0 && t.stat("dup") === 0,
        "Sync to all: from 00:04 the new hall needs the dark old hall too, so 8 registrations are turned away");

      // 5. Async, manual failover: wait for the old hall.
      t.set("mode", "async");
      t.set("failover", "manual");
      begin();
      t.click("end");
      log = since();
      t.expect(has(log, "00:31:00 New hall: no register to take the death. Turned away.") &&
        has(log, "05:47:00 Old hall back. Still the register: it sends the copies what they missed.") &&
        has(log, "05:52:00 Old hall: No. 4473, birth. Certificate printed at once."),
        "Manual: no register from 23:59 to 05:47; the old hall comes back as the register and No. 4473 is used once");
      t.expect(t.stat("refused") === 5 && t.stat("lost") === 0 && t.stat("dup") === 0 && t.stat("stale") === 2,
        "Manual by morning: 5 turned away, nothing lost, no number issued twice");

      // 6. Fast failover in a 43 s line drop, no fencing: two registers.
      t.set("failover", "auto10");
      t.set("fail", "blip");
      begin();
      t.click("end");
      log = since();
      t.expect(has(log, "23:59:00 LINE UNDER THE BRIDGE DOWN for 43 s. The old hall stays lit.") &&
        has(log, "23:59:10 Watchdog: 10 s of silence from the old hall. Promotes the new hall. It lacks 3 acknowledged writes: the scans, No. 4471 and No. 4472. Next number: 4471.") &&
        has(log, "23:59:43 Line under the bridge back. The new hall is a register now and no longer follows the old hall."),
        "Fast failover: a 43 s line drop makes the new hall the register at 23:59:10 while the old hall stays lit");
      t.expect(t.stat("lost") === 3 && t.stat("dup") === 3 && t.stat("stale") === 5 && t.stat("register") === "old hall and new hall",
        "Fast failover, no fencing: 3 lost, 4471 to 4473 issued twice, 5 stale reads, two registers all night");

      // 7. The same with fencing.
      t.click("fence");
      t.click("end");
      t.expect(t.stat("lost") === 3 && t.stat("dup") === 2 && t.stat("register") === "new hall",
        "Fast failover with fencing: still 3 lost and 2 numbers issued twice, but one register");

      // 8. No failure, semi-sync: the lag and the wait are distributions with a tail.
      t.click("fence");
      t.set("fail", "none");
      t.set("failover", "auto5");
      t.set("mode", "semi");
      begin();
      t.click("end");
      log = since();
      t.expect(has(log, "23:59:30 Certificate for No. 4471 printed after 78.2 s.") &&
        t.stat("wait") === "0.2 s / 78.2 s" && t.stat("lag") === "2.2 s / 122.2 s",
        "No failure, semi-sync: No. 4471 waits 78.2 s behind the scans; p50 stays 0.2 s while p99 is 78.2 s; the new hall's lag p99 is 122.2 s");
      t.expect(t.stat("lost") === 0 && t.stat("dup") === 0 && t.stat("stale") === 2,
        "No failure: nothing lost, and the notice board still misses No. 4471 and No. 4472 while the scans hold the line");

      // 9. Live clock after a reset.
      t.click("reset");
      await t.run(2);
      log = t.logText();
      t.expect(has(log, "23:58:12 Old hall: No. 4471, marriage, Lusk and Bramwell. Certificate printed at once.") &&
        t.node("newh").text.sub === "copy, last No. 4470" && t.node("newh").text.meta === "42 s behind",
        "Running the clock: at 23:58:12 the marriage is No. 4471 and the new hall, still at No. 4470, is 42 s behind (it lacks the scans of 23:57:30)");
    }
  });
})();
