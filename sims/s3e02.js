/* sims/s3e02-v1.0.1.js  (published as sims/s3e02.js)
   Case s3e02 "All or Nothing": transactions and locking at the Quillon Building Society. A
   vault ledger lab: three member accounts, a transfer job, two tellers and the branch's other
   windows, replayed second by second on three nights.

   CHANGELOG
   v1.0.1 (2026-10-11) review fixes: startNight no longer calls catchUp(api, 0), so the night opens
     on the balanced state before 01:14:00 and its second 0 runs on the first tick; selfTest
     compares the "diff" stat as a number with n("diff") (9 assertions), since t.stat() returns a
     Number for plain numeric text.
   v1.0.0 (2026-10-11) first version: Tuesday 01:14 (Ruthven's standing order, T-58817, with a
     crash between the debit and the credit), Thursday 15:58 (the Pellows' two deposits at two
     windows) and Saturday 01:14 (the standing order and Ruthven's round-up in opposite
     directions). Controls: night, transfer in one transaction, crash between debit and credit,
     what the job does after a crash, the 03:00 repair script, balance update style (read, add,
     write; atomic; SELECT ... FOR UPDATE; version column; lock the whole ledger table), tellers
     at the same moment, lock order, next event, run to the end, reset. Stats: vault total, sum
     of accounts, books differ by, seconds out of balance, lost updates, changes that waited for
     a lock, optimistic retries, deadlocks, other windows' changes kept waiting. selfTest: 16
     assertions.

   Where every number comes from (conventions rule 14; the case is content/s3/s3e02-v1.0.0.json):
   - post, Tuesday: the vault total is 3,906,412.50. Accounts 1001 (Ruthven, savings) 1,840.00,
     1002 (Ruthven, current) 75.00, 1003 (Pellow, joint) 310.00, and every other account
     together 3,904,187.50, so the sum of accounts is also 3,906,412.50. T-58817 moves 250.00
     from 1001 to 1002 at 01:14:00. The job's server restarts at 01:14:01, between the debit and
     the credit. The 01:17:00 audit: vault 3,906,412.50, accounts 3,906,162.50, difference
     250.00. The job restarts at 01:20:00 and its step file says the debit is done, so it does
     the credit: 1002 75.00 becomes 325.00. The money was in neither account from 01:14:00 to
     01:20:00, six minutes (360 s). The 01:23:00 audit: difference 0.00.
   - post, Thursday: 1003 holds 310.00 at version 7. Ffion opens it at 15:58:02 and posts Mrs
     Pellow's 120.00 at 15:58:09; Kasimir opens it at 15:58:04 and posts Mr Pellow's 80.00 at
     15:58:07. The teller app reads the balance when the account opens and writes back that
     balance plus the deposit (OP's reply to u/grey_pager). So Kasimir writes 390.00 and Ffion
     430.00, and the 80.00 is lost. The vault gets 200.00 of notes: vault 3,906,612.50, accounts
     3,906,532.50. The 23:40:00 audit: difference 80.00.
   - comments: the round-up moves 40.00 from 1002 to 1001 at 01:14 on Saturdays (OP's reply);
     row locks, version numbers, a whole-table lock and "deadlock detected"
     (u/month_end_gisela); the 03:00 repair script (u/balanced_by_dawn_obadiah); retry from the
     start and balance = balance + amount (u/rerun_from_scratch_aurelia).
   - The other windows and the cash machine post one change a second to other members'
     accounts, moving money between them, so they never change the totals. They matter only
     when every change locks the whole ledger.
   - PostgreSQL checks for a deadlock after a lock wait of deadlock_timeout, 1 second by default.

   Teaching model (stated in sim.lede):
   - Second n is counted from the night's start (01:14:00 or 15:58:00). Within a second, in this
     order: (1) each actor whose next step is due runs it, in the order transfer job, round-up,
     Ffion, Kasimir, other windows; (2) waiting actors are granted their locks in the order they
     began waiting, and run whatever is due; (3) the deadlock check: an actor that has waited 1 s
     or more and is part of a cycle of waits makes the database abort the one in the cycle that
     began waiting last (on a tie, the later actor in the order above); its transaction is
     rolled back and it retries from BEGIN a second later; then (2) again; (4) the audit and the
     repair script; (5) the books are compared and the seconds out of balance counted.
   - Each statement takes no time. A new lock request waits if another transaction holds the
     lock or if someone is already queued for it. An UPDATE in a transaction locks its row until
     COMMIT or ROLLBACK, whatever the update style. Outside a transaction a statement's lock ends
     with the statement. A whole-table lock blocks every other change to the ledger but not
     reads.
   - A crash inside a transaction rolls it back. Outside one, every statement already run stays.
   - The transfer job always does balance = balance -/+ 250.00 (or 40.00). The update style
     changes how a teller posts a deposit; the whole-table style also makes a transfer in a
     transaction lock the table first.
   - Lost update: a teller app writes its read balance plus the deposit while the row holds a
     different value; the difference is the lost deposit.

   Self-test arithmetic:
   - Tuesday as now: 1001 1,590.00 at 01:14:00; out of balance for seconds 0..359, 360 s.
     Retry from the start, no transaction: 1001 debited again at 01:20:00, 1,340.00; 1002
     325.00; 250.00 short at 03:05:00. With the repair script: 2 debits, 1 credit, so 1002 is
     credited again at 03:00:00, 575.00; the books balance after 6,360 s (1 h 46 min).
     Transaction on: rolled back at 01:14:01, rerun at 01:20:00 to 01:20:01: 1,590.00 and 325.00,
     0 s out of balance.
   - Thursday: read, add, write: 390.00 at :07, 430.00 at :09, lost 80.00, out by 80.00.
     Atomic: 390.00, 510.00. FOR UPDATE: Kasimir waits 15:58:04 to 15:58:09 (5 s), reads 430.00,
     posts at 15:58:12: 510.00. Version: Kasimir's UPDATE at version 7 succeeds (390.00, v8);
     Ffion's at version 7 updates 0 rows, she re-reads 390.00 at v8 and writes 510.00, v9: 1
     retry. Whole-table lock: Ffion holds the ledger 15:58:02 to 15:58:09, Kasimir 15:58:09 to
     15:58:12. Other windows' changes at :02 and :03 wait to :09 (7 and 6 s); :04 to :11 wait
     to :12 (8, 7, 6, 5, 4, 3, 2, 1 s); :12 waits 0. 10 changes, 49 s, longest 8 s; with
     Kasimir, 11 changes waited. Not at the same moment: Kasimir opens at 15:58:20, reads
     430.00, posts at 15:58:23: 510.00.
   - Saturday, one transaction each, story order: at :00 the standing order locks 1001 and the
     round-up 1002; at :01 each waits for the other; at :02 the deadlock check aborts the
     round-up (both began waiting at :01; the tie goes to the later actor); the standing order
     credits 1002 and commits (1,590.00, 325.00); the round-up retries at :03 (1002 285.00) and
     :04 (1001 1,630.00). 1 deadlock, 2 waits. Fixed order: the round-up waits for 1001 from :00
     to :01, then 1,630.00 at :01 and 285.00 at :02. 0 deadlocks, 1 wait. No transaction: 1001
     1,590.00 and 1002 35.00 at :00, out by 290.00 for 1 s.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px):
   - Top row (y 50, 60 high): Transfer job (x 78, 140 wide), Round-up (x 222, 132), Teller Ffion
     (x 366, 140), Teller Kasimir (x 514, 140), Other windows (x 662, 140); 8px gaps. Longest
     label "Teller Kasimir", 14 chars, 109px; longest sub "waits for ledger", 16 chars, 115px;
     longest meta "1001 -> 1002, 250.00" style lines, 20 chars, 132px, in the 140-wide boxes.
   - Ledger database (x 370, y 172, 460 wide, 72 high): top 136, 56px below the top row.
   - Accounts (y 300, 170 wide, 72 high) at x 95, 280, 465 and The books (x 650, 160 wide): top
     264, 56px below the database. Longest meta "locked: standing order", 22 chars, 145px;
     "accounts 3,906,532.50", 21 chars, 139px.

   Catalog note: the case's concepts are transactions, acid and
   optimistic-vs-pessimistic-locking.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 2;                            // sim seconds per real second
  var IDLE_JUMP = 6;                        // skip ahead when nothing happens for longer than this
  var DEADLOCK_TIMEOUT = 1;                 // PostgreSQL's deadlock_timeout default, 1 s
  var OTHER = 390418750;                    // every other account together, in cents
  var START_BAL = { 1001: 184000, 1002: 7500, 1003: 31000 };
  var START_VER = 7;                        // 1003's version on Thursday
  var VAULT = 390641250;                    // 3,906,412.50
  var T1 = 25000;                           // T-58817, 250.00
  var T2 = 4000;                            // the round-up, 40.00
  var FFION_AMT = 12000;                    // Mrs Pellow, 120.00
  var KASIMIR_AMT = 8000;                   // Mr Pellow, 80.00
  var RESTART_AT = 360;                     // 01:20:00
  var REPAIR_AT = 6360;                     // 03:00:00
  var OTHERS = 20;                          // other windows: one change a second, 15:58:00 to 15:58:19

  var NIGHTS = {
    tue: { start: 1 * 3600 + 14 * 60, end: 6660, audits: [180, 540, 6660], name: "Tuesday" },
    thu: { start: 15 * 3600 + 58 * 60, end: 27720, audits: [27720], name: "Thursday" },
    sat: { start: 1 * 3600 + 14 * 60, end: 180, audits: [180], name: "Saturday" }
  };

  var NIGHT_OPTS = [
    { value: "tue", label: "Tuesday 01:14: Ruthven's standing order" },
    { value: "thu", label: "Thursday 15:58: two tellers, one account" },
    { value: "sat", label: "Saturday 01:14: two transfers, opposite ways" }
  ];
  var RESTART_OPTS = [
    { value: "step", label: "Carries on from its step file (as now)" },
    { value: "retry", label: "Retries the whole transfer from the start" }
  ];
  var STYLE_OPTS = [
    { value: "rmw", label: "Read, add, write (as now)" },
    { value: "atomic", label: "Atomic: balance = balance + amount" },
    { value: "forupdate", label: "Row lock: SELECT ... FOR UPDATE" },
    { value: "version", label: "Version column (optimistic)" },
    { value: "table", label: "Lock the whole ledger table" }
  ];
  var STYLE_NAME = {
    rmw: "read, add, write",
    atomic: "atomic, balance = balance + amount",
    forupdate: "row lock, SELECT ... FOR UPDATE",
    version: "version column",
    table: "lock the whole ledger table"
  };
  var STYLE_META = {
    rmw: "updates: read, add, write",
    atomic: "updates: balance = balance + amount",
    forupdate: "updates: SELECT ... FOR UPDATE",
    version: "updates: version column",
    table: "updates: LOCK TABLE first"
  };
  var ORDER_OPTS = [
    { value: "story", label: "Story order: each debits first (as now)" },
    { value: "fixed", label: "Fixed order: lower account number first" }
  ];

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function hms(sec) {
    var s = Math.floor(sec) % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }

  // 390641250 -> "3,906,412.50". Written by hand so the output never depends on the locale.
  function money(c) {
    var neg = c < 0;
    var a = Math.abs(Math.round(c));
    var whole = String(Math.floor(a / 100));
    var cents = a % 100;
    var out = "";
    while (whole.length > 3) { out = "," + whole.slice(-3) + out; whole = whole.slice(0, -3); }
    return (neg ? "-" : "") + whole + out + "." + (cents < 10 ? "0" : "") + cents;
  }

  function dur(s) {
    if (s < 60) return s + " s";
    if (s < 3600) return (s % 60 === 0 ? (s / 60) + " minutes" : Math.floor(s / 60) + " min " + (s % 60) + " s");
    return Math.floor(s / 3600) + " h " + Math.floor((s % 3600) / 60) + " min";
  }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // "The round-up" -> "the round-up" in the middle of a sentence; "Ffion" stays "Ffion".
  function lower(name) { return name.indexOf("The ") === 0 ? "t" + name.slice(1) : name; }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 360,
    aria: "Vault ledger lab for the Quillon Building Society. Across the top: the transfer job, Ruthven's round-up, teller Ffion, teller Kasimir and the branch's other windows. Each sends its changes to the ledger database, which holds three member accounts: 1001, Ruthven's savings; 1002, Ruthven's current account; and 1003, the Pellows' joint account. The books compare the vault total with the sum of every account.",
    nodes: [
      { id: "job", label: "Transfer job", sub: "idle", meta: "1001 -> 1002, 250.00", x: 78, y: 50, w: 140, h: 60, shape: "box", tone: "" },
      { id: "round", label: "Round-up", sub: "not tonight", meta: "1002 -> 1001, 40.00", x: 222, y: 50, w: 132, h: 60, shape: "box", tone: "muted" },
      { id: "ffion", label: "Teller Ffion", sub: "not tonight", meta: "deposit 120.00", x: 366, y: 50, w: 140, h: 60, shape: "box", tone: "muted" },
      { id: "kasimir", label: "Teller Kasimir", sub: "not tonight", meta: "deposit 80.00", x: 514, y: 50, w: 140, h: 60, shape: "box", tone: "muted" },
      { id: "others", label: "Other windows", sub: "not tonight", meta: "a change a second", x: 662, y: 50, w: 140, h: 60, shape: "box", tone: "muted" },
      { id: "db", label: "Ledger database", sub: "locks: none", meta: "updates: read, add, write", x: 370, y: 172, w: 460, h: 72, shape: "db", tone: "" },
      { id: "a1001", label: "1001 savings", sub: "1,840.00", meta: "Ruthven", x: 95, y: 300, w: 170, h: 72, shape: "db", tone: "" },
      { id: "a1002", label: "1002 current", sub: "75.00", meta: "Ruthven", x: 280, y: 300, w: 170, h: 72, shape: "db", tone: "" },
      { id: "a1003", label: "1003 joint", sub: "310.00", meta: "Pellow, version 7", x: 465, y: 300, w: 170, h: 72, shape: "db", tone: "" },
      { id: "books", label: "The books", sub: "vault 3,906,412.50", meta: "accounts 3,906,412.50", x: 650, y: 300, w: 160, h: 72, shape: "box", tone: "ok" }
    ],
    edges: [
      { from: "job", to: "db" },
      { from: "round", to: "db" },
      { from: "ffion", to: "db" },
      { from: "kasimir", to: "db" },
      { from: "others", to: "db" },
      { from: "db", to: "a1001" },
      { from: "db", to: "a1002" },
      { from: "db", to: "a1003" },
      { from: "db", to: "books", dash: true, tone: "muted" }
    ]
  };

  /* ---------- the ledger ---------- */

  function night(S) { return NIGHTS[S.night]; }

  function sumAccounts(S) { return OTHER + S.bal[1001] + S.bal[1002] + S.bal[1003]; }

  function diff(S) { return S.vault - sumAccounts(S); }

  function val(a, S, acct) { return a.buf[acct] !== undefined ? a.buf[acct] : S.bal[acct]; }

  function say(api, n, msg, tone) {
    var S = api.state;
    api.clock = night(S).start + n;
    api.log(msg, tone || "");
  }

  function actorById(S, id) {
    for (var i = 0; i < S.actors.length; i++) if (S.actors[i].id === id) return S.actors[i];
    return null;
  }

  /* ---------- building each night's actors ---------- */

  function transferSteps(S, kind) {
    var steps = kind === "job"
      ? [{ acct: 1001, delta: -T1 }, { acct: 1002, delta: T1 }]
      : [{ acct: 1002, delta: -T2 }, { acct: 1001, delta: T2 }];
    if (S.night === "sat" && S.txn && S.order === "fixed") {
      steps.sort(function (x, y) { return x.acct - y.acct; });
    }
    return steps;
  }

  // A whole transfer starting at absolute second t0.
  function transferOps(S, kind, t0) {
    var steps = transferSteps(S, kind);
    var ops = [];
    var table = S.txn && S.style === "table";
    if (table) ops.push({ k: "lockTable", t: t0 });
    ops.push({ k: "add", acct: steps[0].acct, delta: steps[0].delta, begin: S.txn && !table, t: table ? undefined : t0, dt: 0 });
    ops.push({ k: "add", acct: steps[1].acct, delta: steps[1].delta, dt: 1 });
    if (S.txn) ops.push({ k: "commit", dt: 0 });
    return ops;
  }

  function jobOps(S) {
    if (S.night !== "tue" || !S.crash) return transferOps(S, "job", 0);
    var full = transferOps(S, "job", 0);
    var ops = [];
    for (var i = 0; i < full.length; i++) {
      ops.push(full[i]);
      if (full[i].k === "add") break;
    }
    ops.push({ k: "crash", dt: 1 });
    var mode = S.txn ? "txn" : S.restart;
    ops.push({ k: "restart", t: RESTART_AT, mode: mode });
    if (mode === "step") ops.push({ k: "add", acct: 1002, delta: T1, dt: 0 });
    else ops = ops.concat(transferOps(S, "job", RESTART_AT));
    return ops;
  }

  function tellerOps(S, start, post, amt) {
    var st = S.style;
    if (st === "rmw") return [{ k: "read", acct: 1003, t: start }, { k: "set", acct: 1003, amt: amt, dt: post }];
    if (st === "atomic") return [{ k: "read", acct: 1003, t: start }, { k: "add", acct: 1003, delta: amt, deposit: true, dt: post }];
    if (st === "forupdate") return [{ k: "lockRow", acct: 1003, t: start }, { k: "set", acct: 1003, amt: amt, dt: post }, { k: "commit", dt: 0 }];
    if (st === "version") return [{ k: "read", acct: 1003, ver: true, t: start }, { k: "vset", acct: 1003, amt: amt, dt: post }];
    return [{ k: "lockTable", t: start, read: 1003 }, { k: "set", acct: 1003, amt: amt, dt: post }, { k: "commit", dt: 0 }];
  }

  function actor(id, Name, node, ops, extra) {
    var a = {
      id: id, Name: Name, node: node, ops: ops, pc: 0, at: ops.length ? (ops[0].t || 0) : Infinity,
      waiting: null, txn: false, buf: {}, rows: {}, table: false, vars: {}, done: !ops.length,
      status: "idle", retrying: false, pend: [], other: false, pron: "its"
    };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) a[k] = extra[k];
    return a;
  }

  function buildActors(S) {
    var list = [];
    if (S.night === "tue") {
      list.push(actor("job", "The job", "job", jobOps(S)));
    } else if (S.night === "sat") {
      list.push(actor("job", "The standing order", "job", transferOps(S, "job", 0)));
      list.push(actor("round", "The round-up", "round", transferOps(S, "round", 0)));
    } else {
      list.push(actor("ffion", "Ffion", "ffion", tellerOps(S, 2, 7, FFION_AMT), { pron: "her" }));
      list.push(actor("kasimir", "Kasimir", "kasimir", tellerOps(S, S.same ? 4 : 20, 3, KASIMIR_AMT), { pron: "his" }));
      for (var i = 0; i < OTHERS; i++) {
        list.push(actor("o" + i, "Another window", "others", [{ k: "other", t: i }], { other: true }));
      }
    }
    return list;
  }

  /* ---------- locks ---------- */

  function needOf(S, a, op) {
    if (op.k === "lockTable") return { table: true };
    if (op.k === "other") return S.style === "table" ? { table: true } : null;
    if (op.k === "lockRow" || op.k === "add" || op.k === "set" || op.k === "vset") return { row: op.acct };
    return null;
  }

  function conflicts(x, y) {
    if (!x || !y) return false;
    if (x.table || y.table) return true;
    return x.row === y.row;
  }

  function grantable(S, a, nd, fromQueue) {
    if (nd.table && S.tableLock && S.tableLock !== a.id) return false;
    if (nd.row !== undefined) {
      var h = S.rowLock[nd.row];
      if (h && h !== a.id) return false;
      if (S.tableLock && S.tableLock !== a.id) return false;
    }
    if (fromQueue) return true;
    if (S.tableLock === a.id) return true;
    if (nd.row !== undefined && S.rowLock[nd.row] === a.id) return true;
    for (var i = 0; i < S.queue.length; i++) {
      var q = S.queue[i];
      if (q !== a && q.waiting && conflicts(q.waiting.need, nd)) return false;
    }
    return true;
  }

  function holderOf(S, a) {
    var nd = a.waiting && a.waiting.need;
    if (!nd) return null;
    if (nd.table) return S.tableLock;
    var h = S.rowLock[nd.row];
    if (h && h !== a.id) return h;
    if (S.tableLock && S.tableLock !== a.id) return S.tableLock;
    return null;
  }

  function lockName(S, nd) { return nd.table ? "the ledger" : String(nd.row); }

  function release(S, a) {
    for (var r in a.rows) if (Object.prototype.hasOwnProperty.call(a.rows, r) && S.rowLock[r] === a.id) S.rowLock[r] = null;
    a.rows = {};
    if (S.tableLock === a.id) S.tableLock = null;
    a.table = false;
  }

  function dequeue(S, a) {
    var i = S.queue.indexOf(a);
    if (i >= 0) S.queue.splice(i, 1);
  }

  /* ---------- running one step ---------- */

  function write(S, a, acct, v) {
    if (a.txn) {
      a.buf[acct] = v;
      S.rowLock[acct] = a.id;
      a.rows[acct] = true;
    } else {
      S.bal[acct] = v;
    }
  }

  function countTransfer(S, a, delta) {
    if (S.night !== "tue" || a.id !== "job") return;
    var kind = delta < 0 ? "d" : "c";
    if (a.txn) a.pend.push(kind);
    else if (kind === "d") S.debits += 1;
    else S.credits += 1;
  }

  function commitAll(S, a) {
    var keys = Object.keys(a.buf).sort();
    for (var i = 0; i < keys.length; i++) S.bal[keys[i]] = a.buf[keys[i]];
    for (var j = 0; j < a.pend.length; j++) {
      if (a.pend[j] === "d") S.debits += 1;
      else S.credits += 1;
    }
    a.pend = [];
    a.buf = {};
    a.txn = false;
    return keys;
  }

  function rollback(S, a) {
    a.buf = {};
    a.pend = [];
    a.txn = false;
    release(S, a);
  }

  function run(api, a, op, n) {
    var S = api.state;
    var cur;
    var nv;
    var acct = op.acct;
    var m;
    switch (op.k) {
      case "lockTable":
        a.txn = true;
        S.tableLock = a.id;
        a.table = true;
        if (op.read) {
          a.vars.read = S.bal[op.read];
          a.vars.readAt = n;
          say(api, n, a.Name + " opens " + op.read + ": BEGIN, LOCK TABLE takes the whole ledger, then " + a.pron + " app reads " + money(a.vars.read) + ".");
        } else {
          say(api, n, a.Name + ": BEGIN, LOCK TABLE takes the whole ledger.");
        }
        a.status = "holds the ledger";
        break;
      case "lockRow":
        a.txn = true;
        S.rowLock[acct] = a.id;
        a.rows[acct] = true;
        a.vars.read = S.bal[acct];
        a.vars.readAt = n;
        say(api, n, a.Name + " opens " + acct + ": BEGIN, SELECT ... FOR UPDATE locks the row and reads " + money(a.vars.read) + ".");
        a.status = "holds " + acct;
        break;
      case "read":
        a.vars.read = S.bal[acct];
        a.vars.ver = S.ver;
        a.vars.readAt = n;
        say(api, n, a.Name + " opens " + acct + " and reads " + money(a.vars.read) + (op.ver ? ", version " + S.ver : "") + ".");
        a.status = "counting notes";
        break;
      case "add":
        cur = val(a, S, acct);
        nv = cur + op.delta;
        if (op.deposit) {
          write(S, a, acct, nv);
          S.vault += op.delta;
          S.lastWriter[acct] = a.Name;
          say(api, n, a.Name + " posts " + money(op.delta) + ": " + acct + " was " + money(cur) + "; balance = balance + " +
            money(op.delta) + " makes it " + money(nv) + ". Receipt printed.");
          a.status = "done";
          break;
        }
        if (op.begin) a.txn = true;
        write(S, a, acct, nv);
        countTransfer(S, a, op.delta);
        var verb = (op.delta < 0 ? "debits " : "credits ") + acct;
        var head = op.begin ? a.Name + (a.retrying ? " retries" : "") + ": BEGIN. " + cap(verb) : a.Name + " " + verb;
        a.retrying = false;
        if (a.txn) {
          say(api, n, head + " and locks it: " + money(cur) + " becomes " + money(nv) + " inside the transaction, not committed.");
        } else {
          say(api, n, head + ": " + money(cur) + " becomes " + money(nv) + ", committed at once.");
        }
        a.status = a.txn ? "holds " + Object.keys(a.rows).sort().join(", ") : "running";
        break;
      case "set":
        cur = val(a, S, acct);
        nv = a.vars.read + op.amt;
        var lostAmt = cur - a.vars.read;
        var lostWho = S.lastWriter[acct];
        write(S, a, acct, nv);
        S.vault += op.amt;
        S.lastWriter[acct] = a.Name;
        if (a.txn) {
          say(api, n, a.Name + " posts " + money(op.amt) + ": " + acct + " was " + money(cur) + ", now " + money(nv) + " inside the transaction. Receipt printed.");
        } else {
          m = a.Name + " posts " + money(op.amt) + ": " + acct + " was " + money(cur) + ", " + a.pron + " app writes " + money(nv) +
            " (" + money(a.vars.read) + " read at " + hms(night(S).start + a.vars.readAt) + ", plus " + money(op.amt) + "). Receipt printed.";
          if (lostAmt !== 0) {
            S.lost += 1;
            m += " " + lostWho + "'s " + money(lostAmt) + " is gone: a lost update.";
          }
          say(api, n, m, lostAmt !== 0 ? "bad" : "");
        }
        a.status = a.txn ? a.status : "done";
        break;
      case "vset":
        cur = S.bal[acct];
        if (S.ver === a.vars.ver) {
          nv = a.vars.read + op.amt;
          S.bal[acct] = nv;
          S.ver += 1;
          say(api, n, a.Name + " posts " + money(op.amt) + ": UPDATE ... WHERE version = " + a.vars.ver + " updates 1 row. " + acct + " was " +
            money(cur) + ", now " + money(nv) + ", version " + S.ver + ". Receipt printed.");
        } else {
          S.retries += 1;
          var oldVer = a.vars.ver;
          var seen = S.ver;
          nv = cur + op.amt;
          S.bal[acct] = nv;
          S.ver += 1;
          say(api, n, a.Name + " posts " + money(op.amt) + ": UPDATE ... WHERE version = " + oldVer + " updates 0 rows, because " + acct +
            " is at version " + seen + ". " + cap(a.pron) + " app re-reads " + money(cur) + " and tries again: " + acct + " was " + money(cur) +
            ", now " + money(nv) + ", version " + S.ver + ". Receipt printed.", "warn");
        }
        S.vault += op.amt;
        S.lastWriter[acct] = a.Name;
        a.status = "done";
        break;
      case "commit":
        var hadTable = a.table;
        var nRows = Object.keys(a.rows).length;
        var keys = commitAll(S, a);
        release(S, a);
        var parts = keys.map(function (k) { return k + " is " + money(S.bal[k]); });
        say(api, n, a.Name + ": COMMIT. " + parts.join(" and ") + (keys.length > 1 ? ", together" : "") + ", and " +
          (hadTable ? "the ledger is" : (nRows > 1 ? "the locks are" : "the lock is")) + " released.", "ok");
        a.status = "done";
        break;
      case "crash":
        if (a.txn) {
          rollback(S, a);
          say(api, n, "The job's server restarts before the credit. The connection drops and the database rolls the transaction back: 1001 is " +
            money(S.bal[1001]) + " again.", "warn");
        } else {
          say(api, n, "The job's server restarts before the credit. 1002 is still " + money(S.bal[1002]) + ": the " + money(T1) +
            " is in neither account.", "bad");
        }
        a.status = "crashed";
        break;
      case "restart":
        if (op.mode === "txn") say(api, n, "The job restarts. With a transaction nothing was left half done, so it runs T-58817 again from BEGIN.");
        else if (op.mode === "step") say(api, n, "The job restarts. Its step file says T-58817's debit is done, so it carries on with the credit.");
        else say(api, n, "The job restarts and retries T-58817 from the start.", "warn");
        a.status = "running";
        break;
      case "other":
        a.status = "done";
        break;
    }
  }

  // Try the actor's current step at second n. Returns true if it ran.
  function tryStep(api, a, n, fromQueue) {
    var S = api.state;
    var op = a.ops[a.pc];
    var nd = needOf(S, a, op);
    if (nd && !grantable(S, a, nd, fromQueue)) {
      if (!a.waiting) {
        a.waiting = { since: n, need: nd };
        S.queue.push(a);
        var h = actorById(S, holderOf(S, a));
        if (!a.other) {
          say(api, n, a.Name + " waits for " + lockName(S, nd) + ": " + (h ? lower(h.Name) : "someone") + " holds it.", "warn");
        }
        a.status = "waits for " + (nd.table ? "ledger" : nd.row);
      }
      return false;
    }
    if (a.waiting) {
      var w = n - a.waiting.since;
      dequeue(S, a);
      a.waiting = null;
      if (w > 0) {
        S.waits += 1;
        if (a.other) {
          S.others += 1;
          S.othersWait += w;
          if (w > S.othersMax) S.othersMax = w;
        } else {
          say(api, n, a.Name + "'s wait ends after " + w + " s.");
        }
      }
    }
    run(api, a, op, n);
    a.pc += 1;
    if (a.pc >= a.ops.length) {
      a.done = true;
      a.at = Infinity;
      if (a.status !== "crashed") a.status = "done";
    } else {
      var nx = a.ops[a.pc];
      a.at = nx.t !== undefined ? nx.t : n + (nx.dt || 0);
    }
    return true;
  }

  function runDue(api, a, n, fromQueue) {
    var first = true;
    while (!a.done && a.at <= n) {
      if (a.waiting && !(fromQueue && first)) break;
      if (!tryStep(api, a, n, fromQueue && first)) return false;
      first = false;
    }
    return true;
  }

  function serveQueue(api, n) {
    var S = api.state;
    var progress = true;
    var guard = 0;
    while (progress && guard < 100) {
      progress = false;
      guard += 1;
      var blocked = [];
      var list = S.queue.slice();
      for (var i = 0; i < list.length; i++) {
        var a = list[i];
        if (!a.waiting) continue;
        var nd = a.waiting.need;
        var stop = false;
        for (var j = 0; j < blocked.length; j++) if (conflicts(blocked[j], nd)) stop = true;
        if (!stop && grantable(S, a, nd, true)) {
          runDue(api, a, n, true);
          progress = true;
          break;
        }
        blocked.push(nd);
      }
    }
  }

  function deadlockCheck(api, n) {
    var S = api.state;
    var victim = null;
    for (var i = 0; i < S.actors.length; i++) {
      var a = S.actors[i];
      if (!a.waiting || n - a.waiting.since < DEADLOCK_TIMEOUT) continue;
      // Follow the waits from a; a cycle back to a is a deadlock.
      var cyc = [a];
      var cur = actorById(S, holderOf(S, a));
      var steps = 0;
      while (cur && cur !== a && cur.waiting && steps < 10) {
        cyc.push(cur);
        cur = actorById(S, holderOf(S, cur));
        steps += 1;
      }
      if (cur !== a) continue;
      for (var k = 0; k < cyc.length; k++) {
        var c = cyc[k];
        if (!victim || c.waiting.since > victim.waiting.since ||
            (c.waiting.since === victim.waiting.since && S.actors.indexOf(c) > S.actors.indexOf(victim))) victim = c;
      }
      var other = cyc[0] === victim ? cyc[1] : cyc[0];
      S.deadlocks += 1;
      var w = n - victim.waiting.since;
      if (w > 0) S.waits += 1;
      dequeue(S, victim);
      victim.waiting = null;
      var held = Object.keys(victim.buf).sort();
      rollback(S, victim);
      say(api, n, "Deadlock detected: " + lower(other.Name) + " and " + lower(victim.Name) +
        " each wait for a row the other holds. The database aborts " + lower(victim.Name) + " and rolls it back: " +
        held.map(function (k) { return k + " is " + money(S.bal[k]); }).join(" and ") + " again.", "bad");
      victim.pc = 0;
      victim.retrying = true;
      victim.at = n + 1;
      victim.status = "rolled back";
      var first = victim.ops[0];
      if (first.t !== undefined) {
        // Retry from BEGIN a second later.
        victim.ops = victim.ops.slice();
        victim.ops[0] = {};
        for (var key in first) if (Object.prototype.hasOwnProperty.call(first, key)) victim.ops[0][key] = first[key];
        victim.ops[0].t = n + 1;
      }
      return true;
    }
    return false;
  }

  /* ---------- one second ---------- */

  function second(api, n) {
    var S = api.state;
    var i;
    api.clock = night(S).start + n;
    for (i = 0; i < S.actors.length; i++) {
      var a = S.actors[i];
      if (!a.waiting) runDue(api, a, n, false);
    }
    serveQueue(api, n);
    var guard = 0;
    while (deadlockCheck(api, n) && guard < 5) {
      serveQueue(api, n);
      guard += 1;
    }
    system(api, n);
    var d = diff(S);
    if (d !== 0 && S.outSince === null) {
      S.outSince = n;
      say(api, n, "The books are out by " + money(d) + ".", "bad");
    } else if (d === 0 && S.outSince !== null) {
      say(api, n, "The books balance again, after " + dur(n - S.outSince) + ".", "ok");
      S.outSince = null;
    }
    if (d !== 0) S.out += 1;
  }

  function system(api, n) {
    var S = api.state;
    var N = night(S);
    if (S.night === "tue" && S.repair && n === REPAIR_AT) {
      if (S.debits > S.credits) {
        var cnt = S.debits - S.credits;
        var before = S.bal[1002];
        S.bal[1002] += cnt * T1;
        S.credits += cnt;
        say(api, n, "Repair script: T-58817 has " + S.debits + " debits and " + (S.credits - cnt) + " credit" + (S.credits - cnt === 1 ? "" : "s") +
          ", so it posts the missing credit: 1002 was " + money(before) + ", now " + money(S.bal[1002]) + ".", "warn");
      } else {
        say(api, n, "Repair script: every transfer has as many credits as debits. Nothing to repair.");
      }
    }
    if (N.audits.indexOf(n) >= 0) {
      if (S.night === "thu" && S.others > 0) {
        say(api, n, "Other windows: " + S.others + " changes waited for the ledger lock, " + S.othersWait + " s in all, the longest " + S.othersMax + " s.", "warn");
      }
      if (S.night === "thu" && S.repair) {
        say(api, n, "Tonight's 03:00 repair script will look for transfers with a missing half. A lost deposit leaves none, so it will find nothing.");
      }
      var d = diff(S);
      say(api, n, "Night audit: vault " + money(S.vault) + ", accounts " + money(sumAccounts(S)) + ", difference " + money(d) + ".", d === 0 ? "ok" : "bad");
    }
    if (n === N.end) {
      say(api, n, "The replay is over. Change a setting to replay the night.");
    }
  }

  function nextEvent(S) {
    var N = night(S);
    var best = N.end;
    var i;
    for (i = 0; i < S.actors.length; i++) {
      var a = S.actors[i];
      if (a.waiting) return S.n;
      if (!a.done && a.at < best) best = a.at;
    }
    for (i = 0; i < N.audits.length; i++) if (N.audits[i] >= S.n && N.audits[i] < best) best = N.audits[i];
    if (S.night === "tue" && S.repair && REPAIR_AT >= S.n && REPAIR_AT < best) best = REPAIR_AT;
    return Math.max(best, S.n);
  }

  function catchUp(api, target) {
    var S = api.state;
    var N = night(S);
    var to = Math.min(Math.floor(target + 1e-6), N.end);
    while (S.n <= to) {
      var e = nextEvent(S);
      if (e > S.n && S.outSince === null) {
        // Nothing happens between here and e: skip the quiet seconds in one go.
        S.n = Math.min(e, to + 1);
        continue;
      }
      if (e > S.n) {
        var jump = Math.min(e, to + 1) - S.n;
        S.out += jump;
        S.n += jump;
        continue;
      }
      second(api, S.n);
      S.n += 1;
    }
    if (S.n > N.end) S.over = true;
  }

  /* ---------- the replay ---------- */

  function startNight(api) {
    var S = api.state;
    var N = night(S);
    S.bal = { 1001: START_BAL[1001], 1002: START_BAL[1002], 1003: START_BAL[1003] };
    S.ver = START_VER;
    S.vault = VAULT;
    S.rowLock = {};
    S.tableLock = null;
    S.queue = [];
    S.lost = 0;
    S.waits = 0;
    S.retries = 0;
    S.deadlocks = 0;
    S.others = 0;
    S.othersWait = 0;
    S.othersMax = 0;
    S.out = 0;
    S.outSince = null;
    S.debits = 0;
    S.credits = 0;
    S.lastWriter = {};
    S.n = 0;
    S.t = 0;
    S.over = false;
    S.actors = buildActors(S);
    api.speed = SPEED;
    api.clock = N.start;
    var m;
    if (S.night === "tue") {
      m = "Tuesday. T-58817, Ruthven's standing order: 250.00 from 1001 (savings) to 1002 (current). " +
        (S.txn ? "One transaction." : "No transaction: each statement commits on its own.") +
        (S.crash ? " The job's server will restart at 01:14:01." : " No crash tonight.");
    } else if (S.night === "thu") {
      m = "Thursday. 1003, the Pellows' joint account, holds 310.00, version 7. Mrs Pellow brings 120.00 to Ffion's window, Mr Pellow 80.00 to Kasimir's" +
        (S.same ? ", at the same moment." : ", but Kasimir opens the account at 15:58:20.") + " Updates: " + STYLE_NAME[S.style] + ".";
    } else {
      m = "Saturday. T-58817 (250.00, 1001 to 1002) and Ruthven's round-up (40.00, 1002 to 1001) start in the same second. " +
        (S.txn ? "One transaction each, " + (S.order === "fixed" ? "lower account number first." : "story order: each debits first.") +
          (S.style === "table" ? " Each locks the whole ledger first." : "")
          : "No transaction: each statement commits on its own.");
    }
    api.log(m, "");
    draw(api);
  }

  function replay(api, what) {
    var S = api.state;
    api.clock = night(S).start;
    api.log(what + " Replaying " + night(S).name + " from " + hms(night(S).start) + ".", "");
    startNight(api);
  }

  function advance(api, target) {
    var S = api.state;
    if (S.over) return;
    S.t = Math.min(target, night(S).end);
    catchUp(api, S.t);
    api.clock = night(S).start + Math.min(S.t, night(S).end);
    draw(api);
  }

  /* ---------- drawing ---------- */

  function draw(api) {
    var S = api.state;
    var present = {};
    var i;
    for (i = 0; i < S.actors.length; i++) present[S.actors[i].node] = present[S.actors[i].node] || S.actors[i];

    ["job", "round", "ffion", "kasimir"].forEach(function (id) {
      var nd = api.node(id);
      var a = present[id];
      if (!a) { nd.text("sub", "not tonight"); nd.set("muted"); return; }
      nd.text("sub", a.status);
      nd.set(a.waiting ? "warn" : (a.status === "crashed" || a.status === "rolled back" ? "bad" : (a.done ? "ok" : "")));
    });
    api.node("job").text("label", S.night === "sat" ? "Standing order" : "Transfer job");

    var on = api.node("others");
    if (!present.others) { on.text("sub", "not tonight"); on.set("muted"); }
    else {
      var waiting = 0;
      for (i = 0; i < S.actors.length; i++) if (S.actors[i].other && S.actors[i].waiting) waiting += 1;
      on.text("sub", waiting ? waiting + " waiting" : (S.others ? S.others + " waited" : "none waiting"));
      on.set(waiting ? "warn" : "");
    }

    var db = api.node("db");
    var locks = [];
    if (S.tableLock) locks.push("ledger: " + lower(actorById(S, S.tableLock).Name));
    [1001, 1002, 1003].forEach(function (k) {
      if (S.rowLock[k]) locks.push(k + ": " + lower(actorById(S, S.rowLock[k]).Name));
    });
    db.text("sub", locks.length ? "locks: " + locks.join("; ") : "locks: none");
    db.text("meta", STYLE_META[S.style] + (S.txn ? "; transfers in a transaction" : ""));
    db.set(S.queue.length ? "warn" : "");

    var owner = { 1001: "Ruthven", 1002: "Ruthven", 1003: "Pellow, version " + S.ver };
    [1001, 1002, 1003].forEach(function (k) {
      var nd = api.node("a" + k);
      nd.text("sub", money(S.bal[k]));
      var pend = null;
      var holder = S.rowLock[k] ? actorById(S, S.rowLock[k]) : null;
      for (var j = 0; j < S.actors.length; j++) if (S.actors[j].buf[k] !== undefined) pend = S.actors[j].buf[k];
      if (pend !== null) nd.text("meta", "pending " + money(pend));
      else if (holder) nd.text("meta", "locked: " + lower(holder.Name).replace(/^the /, ""));
      else nd.text("meta", owner[k]);
      nd.set(pend !== null || holder ? "warn" : "");
    });

    var d = diff(S);
    var bk = api.node("books");
    bk.text("sub", "vault " + money(S.vault));
    bk.text("meta", "accounts " + money(sumAccounts(S)));
    bk.set(d === 0 ? "ok" : "bad");

    S.stat.vault(money(S.vault));
    S.stat.accounts(money(sumAccounts(S)));
    S.stat.diff(money(d));
    S.stat.out(String(S.out));
    S.stat.lost(String(S.lost));
    S.stat.waits(String(S.waits));
    S.stat.retries(String(S.retries));
    S.stat.deadlocks(String(S.deadlocks));
    S.stat.others(String(S.others));

    S.ctl.next.disable(S.over);
    S.ctl.end.disable(S.over);
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.actors || S.over) return;
    var t = S.t + dt * api.speed;
    var e = nextEvent(S);
    if (e - t > IDLE_JUMP && !S.queue.length) t = Math.max(t, e - 2);
    advance(api, t);
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    job: function (S) {
      return S.night === "sat"
        ? "<strong>Standing order, T-58817.</strong> Moves 250.00 from 1001, Ruthven's savings, to 1002, his current account, at 01:14:00: a debit and a credit, two UPDATE statements."
        : "<strong>Transfer job.</strong> Bartholomew's job. T-58817 moves 250.00 from 1001 to 1002 at 01:14:00: a debit, then a credit a second later. As now each statement commits on its own, and the job writes a step file after each one so it can carry on after a crash.";
    },
    round: function () {
      return "<strong>Round-up.</strong> On Saturdays at 01:14 it moves 40.00 from 1002, Ruthven's current account, back to 1001, his savings: the opposite way to the standing order.";
    },
    ffion: function () {
      return "<strong>Teller Ffion, window 2.</strong> Opens 1003 at 15:58:02 and posts Mrs Pellow's 120.00 seven seconds later, after counting the notes. The update style decides what her app does in between.";
    },
    kasimir: function (S) {
      return "<strong>Teller Kasimir, window 3.</strong> Opens 1003 at " + (S.same ? "15:58:04" : "15:58:20") + " and posts Mr Pellow's 80.00 three seconds later.";
    },
    others: function () {
      return "<strong>Other windows.</strong> The branch's other windows and the cash machine post a change a second to other members' accounts, moving money between them, so the totals never change. They wait only when every change locks the whole ledger.";
    },
    db: function () {
      return "<strong>Ledger database.</strong> Holds every account. An UPDATE in a transaction locks its row until COMMIT or ROLLBACK. If a lock wait lasts 1 s, it checks for a deadlock and aborts one transaction in the cycle.";
    },
    books: function (S) {
      return "<strong>The books.</strong> The vault total is the money the society holds; it should equal the sum of every account. Right now they differ by " + money(diff(S)) + ".";
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s3e02", {
    diagram: DIAGRAM,
    startClock: NIGHTS.tue.start,

    setup: function (api) {
      var S = api.state;
      S.night = "tue";
      S.txn = false;
      S.crash = true;
      S.restart = "step";
      S.repair = false;
      S.style = "rmw";
      S.same = true;
      S.order = "story";
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.night = api.control.select("night", "Replay", NIGHT_OPTS, "tue", function (v) {
        var o = pick(NIGHT_OPTS, v);
        if (!o) return;
        S.night = String(o.value);
        replay(api, "Night: " + o.label + ".");
      });
      S.ctl.txn = api.control.toggle("txn", "Transfer in one transaction (BEGIN ... COMMIT)", false, function (on) {
        S.txn = !!on;
        replay(api, "Transfers in one transaction: " + (S.txn ? "on." : "off."));
      });
      S.ctl.crash = api.control.toggle("crash", "Crash between debit and credit (Tuesday)", true, function (on) {
        S.crash = !!on;
        replay(api, "Crash at 01:14:01: " + (S.crash ? "on." : "off."));
      });
      S.ctl.restart = api.control.select("restart", "After a crash, the job", RESTART_OPTS, "step", function (v) {
        var o = pick(RESTART_OPTS, v);
        if (!o) return;
        S.restart = String(o.value);
        replay(api, "After a crash the job " + o.label.charAt(0).toLowerCase() + o.label.slice(1) + ".");
      });
      S.ctl.repair = api.control.toggle("repair", "Repair script at 03:00", false, function (on) {
        S.repair = !!on;
        replay(api, "Repair script: " + (S.repair ? "on." : "off."));
      });
      S.ctl.style = api.control.select("style", "Balance updates", STYLE_OPTS, "rmw", function (v) {
        var o = pick(STYLE_OPTS, v);
        if (!o) return;
        S.style = String(o.value);
        replay(api, "Balance updates: " + STYLE_NAME[S.style] + ".");
      });
      S.ctl.same = api.control.toggle("same", "Tellers at the same moment (Thursday)", true, function (on) {
        S.same = !!on;
        replay(api, "Tellers at the same moment: " + (S.same ? "on." : "off."));
      });
      S.ctl.order = api.control.select("order", "Lock order (Saturday)", ORDER_OPTS, "story", function (v) {
        var o = pick(ORDER_OPTS, v);
        if (!o) return;
        S.order = String(o.value);
        replay(api, "Lock order: " + o.label.charAt(0).toLowerCase() + o.label.slice(1) + ".");
      });
      S.ctl.next = api.control.button("next", "Next event", function () { advance(api, nextEvent(S)); });
      S.ctl.end = api.control.button("end", "Run to the end", function () { advance(api, night(S).end); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        vault: api.stat("vault", "vault total", ""),
        accounts: api.stat("accounts", "sum of accounts", ""),
        diff: api.stat("diff", "books differ by", "bad"),
        out: api.stat("out", "seconds out of balance", "bad"),
        lost: api.stat("lost", "lost updates", "bad"),
        waits: api.stat("waits", "changes that waited for a lock", "warn"),
        retries: api.stat("retries", "optimistic retries", "warn"),
        deadlocks: api.stat("deadlocks", "deadlocks", "bad"),
        others: api.stat("others", "other windows' changes kept waiting", "warn")
      };

      api.onNodeClick(function (id) {
        var m = /^a(100[123])$/.exec(id);
        if (m) {
          var k = Number(m[1]);
          var who = { 1001: "Ruthven's savings", 1002: "Ruthven's current account", 1003: "the Pellows' joint account" }[k];
          api.info("<strong>Account " + k + ".</strong> " + cap(who) + ". Committed balance " + money(api.state.bal[k]) +
            ". A change inside an open transaction shows as pending until COMMIT; nobody else sees it before then.");
          return;
        }
        var f = INFO[id];
        if (f) api.info(f(api.state));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startNight(api);
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      var mark = 0;
      function since() { return t.logText().slice(mark); }
      function begin() { mark = t.logText().length; }
      var log;

      // 1. Tuesday as now, before anything runs.
      t.expect(t.stat("vault") === "3,906,412.50" && t.stat("accounts") === "3,906,412.50" && n("diff") === 0.00 &&
        t.node("a1001").text.sub === "1,840.00" && t.node("a1002").text.sub === "75.00",
        "Tuesday starts balanced: vault and accounts both 3,906,412.50, 1001 at 1,840.00 and 1002 at 75.00");

      // 2. Tuesday as now: 250.00 in neither account for six minutes.
      begin();
      t.click("end");
      log = since();
      t.expect(log.indexOf("01:14:00 The job debits 1001: 1,840.00 becomes 1,590.00, committed at once.") >= 0 &&
        log.indexOf("01:14:01 The job's server restarts before the credit. 1002 is still 75.00: the 250.00 is in neither account.") >= 0 &&
        log.indexOf("01:17:00 Night audit: vault 3,906,412.50, accounts 3,906,162.50, difference 250.00.") >= 0,
        "As now: the debit commits at 01:14:00, the crash at 01:14:01 leaves the credit undone, and the 01:17:00 audit is 250.00 short");
      t.expect(log.indexOf("01:20:00 The job credits 1002: 75.00 becomes 325.00, committed at once.") >= 0 &&
        log.indexOf("01:20:00 The books balance again, after 6 minutes.") >= 0 &&
        log.indexOf("01:23:00 Night audit: vault 3,906,412.50, accounts 3,906,412.50, difference 0.00.") >= 0 && n("out") === 360,
        "As now: the step file finishes the credit at 01:20:00, the books were out for 360 s, and the 01:23:00 audit balances");

      // 3. Retry the whole transfer, no transaction: a double debit.
      t.set("restart", "retry");
      t.click("end");
      t.expect(t.node("a1001").text.sub === "1,340.00" && t.node("a1002").text.sub === "325.00" && n("diff") === 250.00,
        "Retrying the whole transfer without a transaction debits 1001 twice (1,340.00) and leaves the books 250.00 short");

      // 4. The repair script balances the books by moving the money twice.
      begin();
      t.click("repair");
      t.click("end");
      log = since();
      t.expect(n("diff") === 0.00 && t.node("a1002").text.sub === "575.00" && t.node("a1001").text.sub === "1,340.00" &&
        log.indexOf("03:00:00 Repair script: T-58817 has 2 debits and 1 credit, so it posts the missing credit: 1002 was 325.00, now 575.00.") >= 0,
        "The 03:00 repair script balances the books by crediting 1002 again: 500.00 has moved instead of 250.00");

      // 5. The transfer in one transaction: the crash rolls it back.
      t.click("repair");
      begin();
      t.click("txn");
      t.click("end");
      log = since();
      t.expect(log.indexOf("01:14:01 The job's server restarts before the credit. The connection drops and the database rolls the transaction back: 1001 is 1,840.00 again.") >= 0 &&
        log.indexOf("01:17:00 Night audit: vault 3,906,412.50, accounts 3,906,412.50, difference 0.00.") >= 0 &&
        t.node("a1001").text.sub === "1,590.00" && t.node("a1002").text.sub === "325.00" && n("out") === 0,
        "In one transaction the crash rolls the debit back, the 01:17:00 audit balances, and the rerun at 01:20:00 moves 250.00 once");

      // 6. Thursday as now: the lost update.
      t.click("txn");
      t.set("restart", "step");
      begin();
      t.set("night", "thu");
      t.click("end");
      log = since();
      t.expect(n("lost") === 1 && t.node("a1003").text.sub === "430.00" && n("diff") === 80.00 &&
        log.indexOf("15:58:09 Ffion posts 120.00: 1003 was 390.00, her app writes 430.00 (310.00 read at 15:58:02, plus 120.00). Receipt printed. Kasimir's 80.00 is gone: a lost update.") >= 0 &&
        log.indexOf("23:40:00 Night audit: vault 3,906,612.50, accounts 3,906,532.50, difference 80.00.") >= 0,
        "Thursday as now: Kasimir writes 390.00, Ffion writes 430.00 from the 310.00 she read, and the audit is 80.00 short");

      // 7. Not at the same moment, read-add-write is fine.
      t.click("same");
      t.click("end");
      t.expect(n("lost") === 0 && t.node("a1003").text.sub === "510.00" && n("diff") === 0.00,
        "With Kasimir opening the account at 15:58:20, after Ffion has posted, read, add, write gives 510.00");
      t.click("same");

      // 8. Atomic update.
      t.set("style", "atomic");
      t.click("end");
      t.expect(n("lost") === 0 && n("waits") === 0 && t.node("a1003").text.sub === "510.00" && n("diff") === 0.00,
        "Atomic balance = balance + amount: 390.00 then 510.00, nothing lost, nobody waits");

      // 9. Row lock: Kasimir waits.
      begin();
      t.set("style", "forupdate");
      t.click("end");
      log = since();
      t.expect(n("lost") === 0 && n("waits") === 1 && t.node("a1003").text.sub === "510.00" &&
        log.indexOf("15:58:09 Kasimir's wait ends after 5 s.") >= 0 &&
        log.indexOf("15:58:12 Kasimir posts 80.00: 1003 was 430.00, now 510.00 inside the transaction. Receipt printed.") >= 0,
        "SELECT ... FOR UPDATE: Kasimir waits 5 s for Ffion's lock, reads 430.00 and posts 510.00 at 15:58:12");

      // 10. Version column: one retry.
      begin();
      t.set("style", "version");
      t.click("end");
      log = since();
      t.expect(n("retries") === 1 && n("lost") === 0 && n("waits") === 0 && t.node("a1003").text.sub === "510.00" &&
        log.indexOf("15:58:09 Ffion posts 120.00: UPDATE ... WHERE version = 7 updates 0 rows, because 1003 is at version 8.") >= 0,
        "Version column: Ffion's update at version 7 finds 0 rows, she re-reads 390.00 and writes 510.00 at version 9, one retry");

      // 11. Whole-table lock: correct, but the branch waits.
      begin();
      t.set("style", "table");
      t.click("end");
      log = since();
      t.expect(t.node("a1003").text.sub === "510.00" && n("lost") === 0 && n("waits") === 11 && n("others") === 10 &&
        log.indexOf("23:40:00 Other windows: 10 changes waited for the ledger lock, 49 s in all, the longest 8 s.") >= 0,
        "Locking the whole ledger: 510.00 and nothing lost, but 10 of the other windows' changes wait, 49 s in all, up to 8 s");

      // 12. Saturday, one transaction each, story order: a deadlock.
      t.set("style", "rmw");
      t.click("txn");
      begin();
      t.set("night", "sat");
      t.click("end");
      log = since();
      t.expect(n("deadlocks") === 1 && n("waits") === 2 && t.node("a1001").text.sub === "1,630.00" && t.node("a1002").text.sub === "285.00" &&
        log.indexOf("01:14:02 Deadlock detected: the standing order and the round-up each wait for a row the other holds. The database aborts the round-up") >= 0 &&
        log.indexOf("01:14:03 The round-up retries: BEGIN. Debits 1002 and locks it: 325.00 becomes 285.00 inside the transaction, not committed.") >= 0,
        "Saturday in story order: a deadlock at 01:14:02, the round-up is the victim and retries at 01:14:03, and both transfers land once");

      // 13. Fixed order: no deadlock.
      t.set("order", "fixed");
      t.click("end");
      t.expect(n("deadlocks") === 0 && n("waits") === 1 && t.node("a1001").text.sub === "1,630.00" && t.node("a1002").text.sub === "285.00" && n("diff") === 0.00,
        "Saturday in a fixed order: the round-up waits 1 s for 1001, no deadlock, 1,630.00 and 285.00");

      // 14. No transaction: no deadlock, but a second out of balance.
      t.click("txn");
      t.click("end");
      t.expect(n("deadlocks") === 0 && n("out") === 1 && n("diff") === 0.00,
        "Saturday without transactions: no deadlock, but the books are out by 290.00 for 1 s while both transfers are half done");

      // 15. Live clock: Tuesday's first second.
      t.set("night", "tue");
      await t.run(1);
      t.expect(t.node("a1001").text.sub === "1,590.00" && n("diff") === 250.00,
        "Running the clock on Tuesday as now: 1001 has been debited and the books are 250.00 out");
    }
  });
})();
