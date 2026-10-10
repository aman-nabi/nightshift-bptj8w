/* sims/s3e03-v1.0.0.js  (published as sims/s3e03.js)
   Case s3e03 "Phantoms in the Archive": an interleaving lab for the night shift in the basement of
   the Saltmarsh County Records Office. A widget-style sim built inside api.root (no diagram). Two
   transactions, A and B, run their steps in a stated order. The learner picks a scenario, a preset
   order or builds one step at a time, the isolation level, locked reads (SELECT ... FOR UPDATE) and
   one global lock for sign-offs. It shows what each read returns, whether the night rule (at least
   one clerk on call) holds at the end, which anomaly happened, any serialization failure, and the
   outcome of the automatic retry.

   CHANGELOG
   v1.0.0 (2026-10-11) first version. Controls: scenario (4), isolation level (4), order (3
     presets), locked reads toggle, one global lock toggle, A's next step, B's next step, start an
     empty order, reset. Stats: clerks on call, night rule, anomaly, serialization failures, retry,
     waits for a lock. selfTest: 16 assertions.

   Where every number comes from (conventions rule 14; the case is content/s3/s3e03-v1.0.0.json):
   - post: two night clerks, Sabeline Quarles (A) and Leofric Tessaro (B), both on call. The
     register app's sign-off runs one transaction: read tonight's register, and if another clerk is
     on call (2 or more on call, counting yourself) mark yourself off, then commit. The app's log:
     02:41:07 Sabeline reads (2 on call), 02:41:19 Leofric reads (2), 02:41:26 Sabeline's UPDATE,
     02:41:31 her COMMIT, 02:41:38 Leofric's UPDATE, 02:41:44 his COMMIT; 03:00:00 the night check
     finds 0 on call. These six times are the signoff slots below, in that order (ABAABB).
   - post: the burials report counts the series at the start and again at the end, in one
     transaction: 4,212 (BASE) at 02:50:00, 4,213 at 02:58:40, commit 02:58:41. The scanning
     service's filing job files the 1958 page for FERRAND, Aldwyn at 02:52:10 and commits at
     02:52:11. Slots: 02:50:00, 02:52:10, 02:52:11, 02:58:40, 02:58:41 (ABBAA).
   - explain step 2 (and the terms): deed 1187 is "on the shelf"; the scanning job sets it to "out
     for scanning". Status scenario: Leofric reads it at 03:10:00, the job updates at 03:10:05 and
     commits at 03:10:06, Leofric reads again at 03:10:20 and commits at 03:10:21. Dirty scenario:
     the job updates at 03:20:00, Leofric reads at 03:20:04, the job rolls back at 03:20:09, Leofric
     commits at 03:20:10.
   - reply option 3 (ok) and explain: at Serializable, Leofric's COMMIT at 02:41:44 fails with
     "could not serialize access due to read/write dependencies among transactions" (SQLSTATE
     40001); the app retries: reads at 02:41:49 (1 on call, Leofric), refuses at 02:41:54, commits
     at 02:41:59. Steps past the last slot are 5 seconds apart (OVERFLOW). The night check: 1 clerk
     on call (Leofric).
   - locked reads at Repeatable Read: Leofric's locked read waits from 02:41:19 for Sabeline's
     COMMIT at 02:41:31, then fails with "could not serialize access due to concurrent update";
     the retry reads at 02:41:38 (1 on call), refuses at 02:41:44 and commits at 02:41:49.
   - locked reads at Read Committed, or one global lock: Leofric waits from 02:41:19, his read goes
     on at 02:41:31 and returns 1 on call (Leofric); he is refused at 02:41:38 and commits at
     02:41:44. One wait.

   Teaching model (PostgreSQL 18's documented behaviour, stated in sim.lede):
   - Each executed step takes the next slot time. A step that has to wait for a lock takes its
     slot, then goes on at the moment the other transaction commits or rolls back.
   - Read Uncommitted behaves as Read Committed (PostgreSQL never shows another transaction's
     uncommitted change). Read Committed: each statement sees what was committed when it began.
     Repeatable Read and Serializable: every statement sees the snapshot taken at the
     transaction's first statement.
   - UPDATE, and a locked read (FOR UPDATE), wait while another transaction holds the row's lock
     or has changed it without committing. After the wait, Read Committed carries on with the
     newest committed version and re-checks the WHERE clause, so a row that no longer matches is
     dropped. Repeatable Read and Serializable fail with "could not serialize access due to
     concurrent update" if a row they lock or update was changed by a commit after their snapshot.
   - Serializable also records what each transaction read. At COMMIT, if each transaction read
     rows the other wrote without seeing the other's change, the second to commit fails with
     "could not serialize access due to read/write dependencies among transactions" (first
     committer wins). PostgreSQL may raise it at the write instead, a step earlier, and may raise
     it in some harmless cases too; the sim raises it only on a real cycle, at COMMIT.
   - A locked read locks only rows that exist. An inserted row is not covered, so a locked count
     at Read Committed can still meet a phantom.
   - One global lock (LOCK TABLE register IN EXCLUSIVE MODE, before the sign-off's read) applies to
     sign-offs only. It is taken before the snapshot is frozen, so a sign-off that waited reads
     the register as it is after the other one commits.
   - A transaction that fails with a serialization failure is retried once, automatically, from
     its first step, after the other transaction has finished.
   - Every log line describes the step as it ran: what a read returned, or a change not yet
     committed. The night check runs at 03:00:00 after a sign-off replay.

   Self-test arithmetic: 02:41:07 = 2 x 3,600 + 41 x 60 + 7 = 9,667 s; 03:00:00 = 10,800 s;
   02:41:44 + 5 = 02:41:49, + 10 = 02:41:54, + 15 = 02:41:59; 4,212 + 1 = 4,213.

   Catalog note: the case's concepts are the catalog's ids for s3e03 (isolation-levels, dirty,
   non-repeatable, phantom-reads).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var BASE = 4212;                     // burial files in the series before the filing job
  var NIGHT_CHECK = 10800;             // 03:00:00
  var OVERFLOW = 5;                    // seconds between steps after the last slot
  var SLOTS = {
    signoff: [9667, 9679, 9686, 9691, 9698, 9704],   // 02:41:07 :19 :26 :31 :38 :44
    report: [10200, 10330, 10331, 10720, 10721],     // 02:50:00, 02:52:10, 02:52:11, 02:58:40, 02:58:41
    status: [11400, 11405, 11406, 11420, 11421],     // 03:10:00, :05, :06, :20, :21
    dirty: [12000, 12004, 12009, 12010]              // 03:20:00, :04, :09, :10
  };
  var PRESETS = {
    signoff: { story: "ABAABB", ab: "AAABBB", ba: "BBBAAA" },
    report: { story: "ABBAA", ab: "AAABB", ba: "BBAAA" },
    status: { story: "ABBAA", ab: "AAABB", ba: "BBAAA" },
    dirty: { story: "ABAB", ab: "AABB", ba: "BBAA" }
  };
  var NAMES = {
    signoff: { A: "Sabeline", B: "Leofric" },
    report: { A: "The night report", B: "The filing job" },
    status: { A: "Leofric", B: "The scanning job" },
    dirty: { A: "The scanning job", B: "Leofric" }
  };
  var PLAN = {
    signoff: { A: ["readReg", "decide", "commit"], B: ["readReg", "decide", "commit"] },
    report: { A: ["count", "count", "commit"], B: ["insert", "commit"] },
    status: { A: ["readFile", "readFile", "commit"], B: ["updFile", "commit"] },
    dirty: { A: ["updFile", "rollback"], B: ["readFile", "commit"] }
  };
  var WHAT = { signoff: "sign-off", report: "report", status: "lookup", dirty: "lookup" };

  var SCENARIOS = [
    { value: "signoff", label: "Two clerks sign off (as in the story)" },
    { value: "report", label: "The burials report counts twice" },
    { value: "status", label: "Deed 1187 read twice" },
    { value: "dirty", label: "A change not yet committed" }
  ];
  var ISOS = [
    { value: "ru", label: "Read Uncommitted" },
    { value: "rc", label: "Read Committed (PostgreSQL default, as now)" },
    { value: "rr", label: "Repeatable Read" },
    { value: "ser", label: "Serializable" }
  ];
  var ISO_NAME = { ru: "Read Uncommitted", rc: "Read Committed", rr: "Repeatable Read", ser: "Serializable" };
  var ORDERS = [
    { value: "story", label: "As it happened" },
    { value: "ab", label: "A first, then B" },
    { value: "ba", label: "B first, then A" }
  ];
  var SCN_SAID = {
    signoff: "Two clerks sign off",
    report: "The burials report counts twice",
    status: "Deed 1187 read twice",
    dirty: "A change not yet committed"
  };

  var ERR_RW = "ERROR: could not serialize access due to read/write dependencies among transactions (SQLSTATE 40001)";
  var ERR_CU = "ERROR: could not serialize access due to concurrent update (SQLSTATE 40001)";

  /* ---------- small helpers ---------- */

  function pad(n, w) {
    var s = String(n);
    while (s.length < w) s = "0" + s;
    return s;
  }

  function fmt(n) {
    var s = String(Math.round(n));
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return s + out;
  }

  function hms(t) {
    return pad(Math.floor(t / 3600), 2) + ":" + pad(Math.floor(t / 60) % 60, 2) + ":" + pad(t % 60, 2);
  }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function snapIso(S) { return S.iso === "rr" || S.iso === "ser"; }

  /* ---------- rows and transactions ---------- */

  function makeRow(scope, v) {
    return { scope: scope, versions: v === undefined ? [] : [{ v: v, seq: 0 }], pend: null, lock: null };
  }

  function initRows(scn) {
    var rows = {};
    if (scn === "signoff") {
      rows["reg:Sabeline"] = makeRow("reg", true);
      rows["reg:Sabeline"].clerk = "Sabeline";
      rows["reg:Leofric"] = makeRow("reg", true);
      rows["reg:Leofric"].clerk = "Leofric";
    } else if (scn === "status" || scn === "dirty") {
      rows.d1187 = makeRow("d1187", "on the shelf");
    }
    return rows;
  }

  function makeTx(S, id, retry) {
    return {
      id: id, name: NAMES[S.scn][id], plan: PLAN[S.scn][id], pc: 0, retry: !!retry,
      status: "active", snap: null, stmt: null, waitingOn: null, commitSeq: null,
      reads: [], writes: [], last: [], counts: [], vals: [],
      signedOff: false, refused: false, sawUncommitted: false
    };
  }

  function latest(row) { return row.versions.length ? row.versions[row.versions.length - 1] : null; }

  // What tx sees of row at snapshot snap: its own uncommitted change, or the newest version
  // committed at or before snap. Never another transaction's uncommitted change.
  function visible(tx, row, snap) {
    if (row.pend && row.pend.tx === tx.id) return { ok: true, v: row.pend.v };
    for (var i = row.versions.length - 1; i >= 0; i--) {
      if (row.versions[i].seq <= snap) return { ok: true, v: row.versions[i].v };
    }
    return { ok: false };
  }

  // The newest value: tx's own change, or the newest committed version.
  function newest(tx, row) {
    if (row.pend && row.pend.tx === tx.id) return { ok: true, v: row.pend.v };
    var L = latest(row);
    return L ? { ok: true, v: L.v } : { ok: false };
  }

  function holder(tx, row) {
    if (row.lock && row.lock !== tx.id) return row.lock;
    if (row.pend && row.pend.tx !== tx.id) return row.pend.tx;
    return null;
  }

  // Changed by a commit after tx's snapshot (Repeatable Read and Serializable only).
  function changedSince(tx, row) {
    var L = latest(row);
    return !!(L && tx.snap !== null && L.seq > tx.snap);
  }

  function stmtSnap(S, tx) {
    if (tx.stmt !== null) return tx.stmt;
    var s;
    if (snapIso(S)) {
      if (tx.snap === null) tx.snap = S.seq;
      s = tx.snap;
    } else {
      s = S.seq;
    }
    tx.stmt = s;
    return s;
  }

  function other(S, tx) { return S.tx[tx.id === "A" ? "B" : "A"]; }

  /* ---------- the log and the step table ---------- */

  function note(S, api, tx, sql, res, msg, tone) {
    S.trace.push({ t: api.clock, who: (tx.retry ? "retry: " : "") + tx.name, sql: sql, res: res, tone: tone || "" });
    api.log(msg, tone || "");
  }

  function release(S, tx) {
    for (var k in S.rows) {
      if (!Object.prototype.hasOwnProperty.call(S.rows, k)) continue;
      var r = S.rows[k];
      if (r.pend && r.pend.tx === tx.id) r.pend = null;
      if (r.lock === tx.id) r.lock = null;
    }
    if (S.glob === tx.id) S.glob = null;
  }

  function block(S, api, tx, on, sql, what) {
    tx.waitingOn = on;
    S.waits += 1;
    var o = S.tx[on];
    note(S, api, tx, sql, "waits", tx.name + " waits: " + o.name + "'s transaction holds a lock on " + what + ".", "warn");
    return "blocked";
  }

  function fail(S, api, tx, kind, sql, what) {
    release(S, tx);
    tx.status = "failed";
    S.fails += 1;
    var err = kind === "rw" ? ERR_RW : ERR_CU;
    note(S, api, tx, sql, "serialization failure",
      tx.name + "'s " + what + " fails: " + err + ". Rolled back.", "bad");
    return "done";
  }

  /* ---------- the steps ---------- */

  function regSql(S) {
    return (S.global ? "LOCK TABLE register IN EXCLUSIVE MODE; " : "") +
      "SELECT clerk FROM register WHERE night = tonight AND on_call" + (S.lockRows ? " FOR UPDATE" : "");
  }

  function doReadReg(S, api, tx) {
    var sql = regSql(S);
    if (S.global) {
      if (S.glob && S.glob !== tx.id) return block(S, api, tx, S.glob, sql, "the whole register (one global lock)");
      S.glob = tx.id;
    }
    var snap = stmtSnap(S, tx);
    var rows = [S.rows["reg:Sabeline"], S.rows["reg:Leofric"]];
    var hit = [];
    var i;
    for (i = 0; i < rows.length; i++) {
      var vis = visible(tx, rows[i], snap);
      if (vis.ok && vis.v === true) hit.push(rows[i]);
    }
    if (S.lockRows) {
      for (i = 0; i < hit.length; i++) {
        var h = holder(tx, hit[i]);
        if (h) return block(S, api, tx, h, sql, "a register row this read needs");
      }
      if (snapIso(S)) {
        for (i = 0; i < hit.length; i++) {
          if (changedSince(tx, hit[i])) return fail(S, api, tx, "cu", sql, "locked read");
        }
      } else {
        var kept = [];
        for (i = 0; i < hit.length; i++) {
          var nw = newest(tx, hit[i]);
          if (nw.ok && nw.v === true) kept.push(hit[i]);
        }
        hit = kept;
      }
      for (i = 0; i < hit.length; i++) hit[i].lock = tx.id;
    }
    tx.reads.push({ scope: "reg", snap: snap });
    tx.last = [];
    for (i = 0; i < hit.length; i++) tx.last.push(hit[i].clerk);
    var list = tx.last.length ? tx.last.join(", ") : "nobody";
    note(S, api, tx, sql, tx.last.length + " on call (" + list + ")",
      tx.name + " reads the register: " + tx.last.length + " on call (" + list + ").", "");
    return "done";
  }

  function doDecide(S, api, tx) {
    if (tx.last.length < 2) {
      tx.refused = true;
      note(S, api, tx, "(no write)", "refused", tx.name + "'s app refuses: " + tx.name + " is the last clerk on call.", "ok");
      return "done";
    }
    var sql = "UPDATE register SET on_call = false WHERE clerk = '" + tx.name + "'";
    var row = S.rows["reg:" + tx.name];
    var h = holder(tx, row);
    if (h) return block(S, api, tx, h, sql, tx.name + "'s register row");
    stmtSnap(S, tx);
    if (snapIso(S) && changedSince(tx, row)) return fail(S, api, tx, "cu", sql, "UPDATE");
    row.pend = { tx: tx.id, v: false };
    row.lock = tx.id;
    tx.writes.push({ scope: "reg" });
    tx.signedOff = true;
    note(S, api, tx, sql, "1 row, not yet committed", tx.name + " signs off: on_call = false, not yet committed.", "");
    return "done";
  }

  function doCount(S, api, tx) {
    var sql = S.lockRows ? "SELECT id FROM files WHERE series = 'burials' FOR UPDATE (the report counts the rows)"
      : "SELECT count(*) FROM files WHERE series = 'burials'";
    var snap = stmtSnap(S, tx);
    var hit = [];
    var i;
    for (var k in S.rows) {
      if (!Object.prototype.hasOwnProperty.call(S.rows, k)) continue;
      var r = S.rows[k];
      if (r.scope !== "shelf") continue;
      if (visible(tx, r, snap).ok) hit.push(r);
    }
    if (S.lockRows) {
      for (i = 0; i < hit.length; i++) {
        var h = holder(tx, hit[i]);
        if (h) return block(S, api, tx, h, sql, "a burial file this count needs");
      }
      if (snapIso(S)) {
        for (i = 0; i < hit.length; i++) {
          if (changedSince(tx, hit[i])) return fail(S, api, tx, "cu", sql, "locked count");
        }
      }
      for (i = 0; i < hit.length; i++) hit[i].lock = tx.id;
    }
    var n = BASE + hit.length;
    tx.reads.push({ scope: "shelf", snap: snap });
    tx.counts.push(n);
    note(S, api, tx, sql, fmt(n), "The night report counts the burials: " + fmt(n) + ".", "");
    return "done";
  }

  function doInsert(S, api, tx) {
    var sql = "INSERT INTO files (series, name) VALUES ('burials', 'FERRAND, Aldwyn')";
    stmtSnap(S, tx);
    var row = makeRow("shelf");
    row.pend = { tx: tx.id, v: "FERRAND, Aldwyn" };
    row.lock = tx.id;
    S.rows["f:ferrand"] = row;
    tx.writes.push({ scope: "shelf" });
    note(S, api, tx, sql, "1 row, not yet committed", "The filing job files FERRAND, Aldwyn, 1958, not yet committed.", "");
    return "done";
  }

  function doReadFile(S, api, tx) {
    var sql = "SELECT status FROM files WHERE id = 1187" + (S.lockRows ? " FOR UPDATE" : "");
    var row = S.rows.d1187;
    var snap = stmtSnap(S, tx);
    var v;
    if (S.lockRows) {
      var h = holder(tx, row);
      if (h) return block(S, api, tx, h, sql, "deed 1187");
      if (snapIso(S)) {
        if (changedSince(tx, row)) return fail(S, api, tx, "cu", sql, "locked read");
        v = visible(tx, row, snap).v;
      } else {
        v = newest(tx, row).v;
      }
      row.lock = tx.id;
    } else {
      v = visible(tx, row, snap).v;
    }
    if (row.pend && row.pend.tx !== tx.id && v === row.pend.v && newest(tx, row).v !== v) tx.sawUncommitted = true;
    tx.reads.push({ scope: "d1187", snap: snap });
    tx.vals.push(v);
    note(S, api, tx, sql, v, tx.name + " reads deed 1187: " + v + ".", "");
    return "done";
  }

  function doUpdFile(S, api, tx) {
    var sql = "UPDATE files SET status = 'out for scanning' WHERE id = 1187";
    var row = S.rows.d1187;
    var h = holder(tx, row);
    if (h) return block(S, api, tx, h, sql, "deed 1187");
    stmtSnap(S, tx);
    if (snapIso(S) && changedSince(tx, row)) return fail(S, api, tx, "cu", sql, "UPDATE");
    row.pend = { tx: tx.id, v: "out for scanning" };
    row.lock = tx.id;
    tx.writes.push({ scope: "d1187" });
    note(S, api, tx, sql, "1 row, not yet committed", tx.name + " sets deed 1187 to out for scanning, not yet committed.", "");
    return "done";
  }

  // X read something Y wrote without seeing Y's change.
  function edge(X, Y) {
    for (var i = 0; i < X.reads.length; i++) {
      var r = X.reads[i];
      for (var j = 0; j < Y.writes.length; j++) {
        if (Y.writes[j].scope !== r.scope) continue;
        if (Y.commitSeq !== null && Y.commitSeq <= r.snap) continue;
        return true;
      }
    }
    return false;
  }

  function doCommit(S, api, tx) {
    if (S.iso === "ser") {
      var o = other(S, tx);
      if (o && o.status === "committed" && edge(tx, o) && edge(o, tx)) return fail(S, api, tx, "rw", "COMMIT", "COMMIT");
    }
    S.seq += 1;
    for (var k in S.rows) {
      if (!Object.prototype.hasOwnProperty.call(S.rows, k)) continue;
      var r = S.rows[k];
      if (r.pend && r.pend.tx === tx.id) r.versions.push({ v: r.pend.v, seq: S.seq });
    }
    release(S, tx);
    tx.status = "committed";
    tx.commitSeq = S.seq;
    note(S, api, tx, "COMMIT", "committed", tx.name + " commits.", "");
    if (S.scn === "report" && tx.id === "A") {
      api.log("Report printed: count at the start " + fmt(tx.counts[0]) + ", count at the end " + fmt(tx.counts[tx.counts.length - 1]) + ".",
        tx.counts[0] !== tx.counts[tx.counts.length - 1] ? "bad" : "ok");
    }
    return "done";
  }

  function doRollback(S, api, tx) {
    release(S, tx);
    tx.status = "rolledback";
    note(S, api, tx, "ROLLBACK", "rolled back", tx.name + " rolls back. Its change is undone.", "");
    return "done";
  }

  var EXEC = {
    readReg: doReadReg, decide: doDecide, count: doCount, insert: doInsert,
    readFile: doReadFile, updFile: doUpdFile, commit: doCommit, rollback: doRollback
  };

  /* ---------- the scheduler ---------- */

  function nextSlot(S) {
    var sl = SLOTS[S.scn];
    var i = S.slot;
    S.slot += 1;
    return i < sl.length ? sl[i] : sl[sl.length - 1] + OVERFLOW * (i - sl.length + 1);
  }

  function runStep(S, api, tx) {
    var resumed = tx.waitingOn !== null;
    if (!resumed) S.now = nextSlot(S);
    api.clock = S.now;
    tx.waitingOn = null;
    var r = EXEC[tx.plan[tx.pc]](S, api, tx);
    if (r === "blocked") return r;
    tx.stmt = null;
    if (tx.status === "active") tx.pc += 1;
    return "done";
  }

  function pump(S, api) {
    var guard = 0;
    while (guard < 200) {
      guard += 1;
      var progressed = false;
      for (var k = 0; k < S.queue.length; k++) {
        var tx = S.tx[S.queue[k]];
        if (tx.status !== "active" || tx.pc >= tx.plan.length) { S.queue.splice(k, 1); progressed = true; break; }
        if (tx.waitingOn !== null && S.tx[tx.waitingOn].status === "active") continue;
        var r = runStep(S, api, tx);
        if (r === "blocked") continue;
        S.queue.splice(k, 1);
        progressed = true;
        break;
      }
      if (!progressed) break;
    }
    maybeFinish(S, api);
  }

  function maybeFinish(S, api) {
    if (S.finished || S.queue.length) return;
    var ids = ["A", "B"];
    var i;
    for (i = 0; i < ids.length; i++) if (S.tx[ids[i]].status === "active") return;
    for (i = 0; i < ids.length; i++) {
      var tx = S.tx[ids[i]];
      if (tx.status === "failed" && !tx.retry) {
        var nt = makeTx(S, tx.id, true);
        S.tx[tx.id] = nt;
        S.retried.push(tx.id);
        api.clock = S.now;
        api.log("Retry: " + nt.name + " runs the " + WHAT[S.scn] + " again from the start.", "warn");
        for (var j = 0; j < nt.plan.length; j++) S.queue.push(tx.id);
        pump(S, api);
        return;
      }
    }
    S.finished = true;
    finish(S, api);
  }

  function onCall(S) {
    var names = [];
    var ks = ["reg:Sabeline", "reg:Leofric"];
    for (var i = 0; i < ks.length; i++) {
      var r = S.rows[ks[i]];
      var L = r ? latest(r) : null;
      if (L && L.v === true) names.push(r.clerk);
    }
    return names;
  }

  function anomaly(S) {
    var A = S.orig.A;
    var B = S.orig.B;
    if (S.scn === "signoff") {
      if (A.status === "committed" && B.status === "committed" && A.signedOff && B.signedOff) return "write skew";
    } else if (S.scn === "report") {
      var c = S.tx.A.counts;
      if (c.length >= 2 && c[0] !== c[c.length - 1]) return "phantom read";
    } else if (S.scn === "status") {
      var v = S.tx.A.vals;
      if (v.length >= 2 && v[0] !== v[v.length - 1]) return "non-repeatable read";
    } else if (S.tx.B.sawUncommitted) {
      return "dirty read";
    }
    return "none";
  }

  function finish(S, api) {
    S.anomaly = anomaly(S);
    if (S.scn === "signoff") {
      var on = onCall(S);
      api.clock = NIGHT_CHECK;
      if (on.length) {
        api.log("Night check: " + on.length + (on.length === 1 ? " clerk" : " clerks") + " on call (" + on.join(", ") + "). Rule kept.", "ok");
      } else {
        api.log("Night check: 0 clerks on call. Rule broken: nobody is on call.", "bad");
      }
    } else if (S.scn === "status") {
      var v = S.tx.A.vals;
      api.log("Leofric's two reads of deed 1187: " + v[0] + ", then " + v[v.length - 1] + ".", v[0] !== v[v.length - 1] ? "bad" : "ok");
    } else if (S.scn === "dirty") {
      api.log("Leofric read deed 1187 as " + S.tx.B.vals[0] + ". The scanning job's change was never committed" +
        (S.anomaly === "dirty read" ? ", and Leofric saw it: a dirty read." : ", and Leofric never saw it."), S.anomaly === "none" ? "ok" : "bad");
    }
  }

  function orderText(tokens) {
    var n = { A: 0, B: 0 };
    var out = [];
    for (var i = 0; i < tokens.length; i++) {
      var c = tokens.charAt(i);
      n[c] += 1;
      out.push(c + n[c]);
    }
    return out.length ? out.join(" ") : "none yet (use A's next step and B's next step)";
  }

  function startRun(S, api) {
    S.rows = initRows(S.scn);
    S.seq = 0;
    S.slot = 0;
    S.now = SLOTS[S.scn][0];
    S.glob = null;
    S.waits = 0;
    S.fails = 0;
    S.retried = [];
    S.finished = false;
    S.anomaly = null;
    S.trace = [];
    S.queue = [];
    S.tx = { A: makeTx(S, "A", false), B: makeTx(S, "B", false) };
    S.orig = { A: S.tx.A, B: S.tx.B };
    api.clock = S.now;
    var line = "Replay: " + SCN_SAID[S.scn].toLowerCase() + ". A = " + S.tx.A.name + ", B = " + S.tx.B.name + ". " +
      ISO_NAME[S.iso] + ". Locked reads: " + (S.lockRows ? "on" : "off") + ". One global lock: " +
      (S.global ? (S.scn === "signoff" ? "on" : "on (sign-offs only)") : "off") + ". Order: " + orderText(S.tokens) + ".";
    if (S.iso === "ru") line += " PostgreSQL's Read Uncommitted behaves like Read Committed, so no step can see an uncommitted change.";
    api.log(line, "");
    for (var i = 0; i < S.tokens.length; i++) S.queue.push(S.tokens.charAt(i));
    pump(S, api);
    draw(api);
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var root = api.root;
    while (root.firstChild) root.removeChild(root.firstChild);
    var doc = root.ownerDocument;
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    box.appendChild(el("p", "margin:0;font-size:12px;opacity:.8;",
      "Interleaving lab. Two transactions, A and B, run their steps in the order below, on PostgreSQL's documented rules for the level you pick."));
    var head = el("p", "margin:0;font-size:13px;", "");
    head.setAttribute("aria-live", "polite");
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;min-width:0;");
    var table = el("table", "border-collapse:collapse;font-size:12px;width:100%;");
    var thead = el("thead", "", "");
    var hr = el("tr", "", "");
    var heads = ["Time", "Who", "Statement", "Result"];
    for (var i = 0; i < heads.length; i++) {
      hr.appendChild(el("th", "text-align:left;padding:4px 6px;border-bottom:1px solid currentColor;", heads[i]));
    }
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody", "", "");
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);
    var foot = el("p", "margin:0;font-size:13px;", "");
    foot.setAttribute("aria-live", "polite");
    box.appendChild(foot);
    root.appendChild(box);
    return { head: head, tbody: tbody, foot: foot, el: el };
  }

  function retryText(S) {
    if (!S.retried.length) return "none";
    var tx = S.tx[S.retried[0]];
    if (S.scn === "signoff") {
      if (tx.status !== "committed") return tx.name + " fails again";
      return tx.refused ? tx.name + " stays on call" : tx.name + " signs off";
    }
    return tx.status === "committed" ? tx.name + " commits" : tx.name + " fails again";
  }

  function draw(api) {
    var S = api.state;
    var ui = S.ui;
    ui.head.textContent = "A = " + S.tx.A.name + ", B = " + S.tx.B.name + ". " + ISO_NAME[S.iso] +
      (S.iso === "ru" ? " (behaves as Read Committed in PostgreSQL)" : "") + ". Order: " + orderText(S.tokens) + ".";
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    for (var i = 0; i < S.trace.length; i++) {
      var r = S.trace[i];
      var tr = ui.el("tr", "", "");
      var st = "padding:4px 6px;vertical-align:top;border-bottom:1px solid rgba(127,127,127,.3);";
      var bold = r.tone === "bad" || r.tone === "warn" ? "font-weight:600;" : "";
      tr.appendChild(ui.el("td", st + "white-space:nowrap;", hms(r.t)));
      tr.appendChild(ui.el("td", st, r.who));
      tr.appendChild(ui.el("td", st + "font-family:monospace;overflow-wrap:anywhere;", r.sql));
      tr.appendChild(ui.el("td", st + bold, r.res));
      ui.tbody.appendChild(tr);
    }
    var on = onCall(S);
    var foot;
    if (!S.finished) {
      foot = "Not finished: " + (S.queue.length ? "a step is waiting for a lock." : "add more steps, or pick an order.");
    } else {
      foot = "Anomaly: " + S.anomaly + ". Serialization failures: " + S.fails + ". Retry: " + retryText(S) + ". Waits for a lock: " + S.waits + ".";
      if (S.scn === "signoff") foot += " At 03:00, on call: " + (on.length ? on.join(", ") : "nobody") + ".";
    }
    ui.foot.textContent = foot;

    if (S.scn === "signoff") {
      S.stat.on(on.length);
      S.stat.rule(on.length ? "kept" : "broken");
    } else {
      S.stat.on("n/a");
      S.stat.rule("n/a");
    }
    S.stat.anomaly(S.finished ? S.anomaly : "not finished");
    S.stat.fails(S.fails);
    S.stat.retry(retryText(S));
    S.stat.waits(S.waits);

    var ids = ["A", "B"];
    for (var j = 0; j < ids.length; j++) {
      var id = ids[j];
      var used = 0;
      for (var k = 0; k < S.tokens.length; k++) if (S.tokens.charAt(k) === id) used += 1;
      S.ctl["next" + id].disable(S.finished || used >= PLAN[S.scn][id].length || S.orig[id].status !== "active");
    }
  }

  function infoText(S) {
    var lvl = {
      ru: "<strong>Read Uncommitted.</strong> The SQL standard lets it show another transaction's uncommitted change, a dirty read. PostgreSQL's Read Uncommitted behaves like Read Committed, so this lab never shows one.",
      rc: "<strong>Read Committed,</strong> PostgreSQL's default. Each statement sees what was committed before it began, so two statements in one transaction can see different data.",
      rr: "<strong>Repeatable Read.</strong> Every statement sees one snapshot, taken at the transaction's first statement. In PostgreSQL that also hides phantoms. Locking or updating a row someone changed after the snapshot fails with a serialization failure.",
      ser: "<strong>Serializable.</strong> Repeatable Read, plus a watch on what each transaction read. If committing would give a result no one-at-a-time order could give, the second to commit fails with a serialization failure (SQLSTATE 40001), and the app retries it."
    };
    var scn = {
      signoff: " <strong>The sign-off:</strong> read tonight's register; if 2 or more are on call, set your own on_call to false; commit.",
      report: " <strong>The report:</strong> count the burials, count again, commit. The filing job inserts one file and commits.",
      status: " <strong>The lookup:</strong> Leofric reads deed 1187 twice in one transaction while the scanning job changes it.",
      dirty: " <strong>The lookup:</strong> the scanning job changes deed 1187, Leofric reads it, then the job rolls back."
    };
    return lvl[S.iso] + scn[S.scn];
  }

  /* ---------- controls ---------- */

  function replay(api) {
    var S = api.state;
    api.info(infoText(S));
    startRun(S, api);
  }

  function setScenario(api, v) {
    var o = pick(SCENARIOS, v);
    if (!o) return;
    var S = api.state;
    S.scn = String(o.value);
    S.tokens = PRESETS[S.scn][S.order];
    replay(api);
  }

  function setIso(api, v) {
    var o = pick(ISOS, v);
    if (!o) return;
    api.state.iso = String(o.value);
    replay(api);
  }

  function setOrder(api, v) {
    var o = pick(ORDERS, v);
    if (!o) return;
    var S = api.state;
    S.order = String(o.value);
    S.tokens = PRESETS[S.scn][S.order];
    replay(api);
  }

  function setLockRows(api, on) {
    api.state.lockRows = !!on;
    replay(api);
  }

  function setGlobal(api, on) {
    api.state.global = !!on;
    replay(api);
  }

  function fresh(api) {
    api.state.tokens = "";
    replay(api);
  }

  function nextStep(api, id) {
    var S = api.state;
    if (S.finished) return;
    var used = 0;
    for (var k = 0; k < S.tokens.length; k++) if (S.tokens.charAt(k) === id) used += 1;
    if (used >= PLAN[S.scn][id].length || S.orig[id].status !== "active") return;
    S.tokens += id;
    S.queue.push(id);
    pump(S, api);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s3e03", {
    startClock: SLOTS.signoff[0],

    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.scn = "signoff";
      S.iso = "rc";
      S.order = "story";
      S.tokens = PRESETS.signoff.story;
      S.lockRows = false;
      S.global = false;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.scn = api.control.select("scenario", "Scenario", SCENARIOS, "signoff", function (v) { setScenario(api, v); });
      S.ctl.iso = api.control.select("iso", "Isolation level (both transactions)", ISOS, "rc", function (v) { setIso(api, v); });
      S.ctl.order = api.control.select("order", "Order of the steps", ORDERS, "story", function (v) { setOrder(api, v); });
      S.ctl.lockRows = api.control.toggle("lockrows", "Locked reads: SELECT ... FOR UPDATE", false, function (on) { setLockRows(api, on); });
      S.ctl.global = api.control.toggle("global", "One global lock for every sign-off", false, function (on) { setGlobal(api, on); });
      S.ctl.fresh = api.control.button("fresh", "Start an empty order", function () { fresh(api); });
      S.ctl.nextA = api.control.button("nextA", "A's next step", function () { nextStep(api, "A"); });
      S.ctl.nextB = api.control.button("nextB", "B's next step", function () { nextStep(api, "B"); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        on: api.stat("on", "clerks on call at 03:00", ""),
        rule: api.stat("rule", "night rule: at least one on call", ""),
        anomaly: api.stat("anomaly", "anomaly", "bad"),
        fails: api.stat("fails", "serialization failures", "warn"),
        retry: api.stat("retry", "the retry", ""),
        waits: api.stat("waits", "waits for a lock", "")
      };

      replay(api);
    },

    selfTest: async function (t) {
      function st(id) { return String(t.stat(id)); }
      var log;

      // 1. The story: Read Committed, the story's order. Both read 2, both sign off, nobody on call.
      log = t.logText();
      t.expect(st("on") === "0" && st("rule") === "broken" && st("anomaly") === "write skew" && st("fails") === "0" &&
        log.indexOf("Sabeline reads the register: 2 on call (Sabeline, Leofric).") >= 0 &&
        log.indexOf("Leofric reads the register: 2 on call (Sabeline, Leofric).") >= 0 &&
        log.indexOf("Night check: 0 clerks on call. Rule broken: nobody is on call.") >= 0,
        "Read Committed, the story's order: both clerks read 2 on call, both sign off, 0 on call at 03:00: write skew");

      // 2. Read Uncommitted behaves as Read Committed.
      t.set("iso", "ru");
      t.expect(st("on") === "0" && st("anomaly") === "write skew" &&
        t.logText().indexOf("PostgreSQL's Read Uncommitted behaves like Read Committed") >= 0,
        "Read Uncommitted: the same as Read Committed in PostgreSQL, 0 on call");

      // 3. Repeatable Read: the snapshot changes nothing here.
      t.set("iso", "rr");
      t.expect(st("on") === "0" && st("anomaly") === "write skew" && st("fails") === "0" && st("retry") === "none",
        "Repeatable Read, the story's order: still 0 on call, write skew, no error");

      // 4. Serializable: Leofric's commit fails, the retry sees 1 on call and keeps him on.
      t.set("iso", "ser");
      log = t.logText();
      t.expect(st("fails") === "1" && st("retry") === "Leofric stays on call" && st("on") === "1" && st("rule") === "kept" &&
        st("anomaly") === "none" &&
        log.indexOf("Leofric's COMMIT fails: ERROR: could not serialize access due to read/write dependencies among transactions (SQLSTATE 40001). Rolled back.") >= 0 &&
        log.indexOf("Retry: Leofric runs the sign-off again from the start.") >= 0 &&
        log.indexOf("Leofric reads the register: 1 on call (Leofric).") >= 0 &&
        log.indexOf("Night check: 1 clerk on call (Leofric). Rule kept.") >= 0,
        "Serializable: one serialization failure at Leofric's COMMIT; the retry reads 1 on call and Leofric stays on");

      // 5. The retry's times: 02:41:49, :54, :59.
      t.expect(SLOTS.signoff[5] + OVERFLOW * 3 === 9719 && hms(9719) === "02:41:59" && hms(SLOTS.signoff[0]) === "02:41:07" && hms(NIGHT_CHECK) === "03:00:00",
        "Times: the story's first read at 02:41:07, the retry's commit at 02:41:59, the night check at 03:00:00");

      // 6. One after the other: no anomaly, no failure.
      t.set("order", "ab");
      t.expect(st("fails") === "0" && st("on") === "1" && st("anomaly") === "none",
        "Serializable, A first then B: Leofric reads 1 on call and is refused; nothing fails");

      // 7. Locked reads at Read Committed: Leofric waits, then reads 1 on call.
      t.set("order", "story");
      t.set("iso", "rc");
      t.set("lockrows", true);
      log = t.logText();
      t.expect(st("on") === "1" && st("waits") === "1" && st("fails") === "0" &&
        log.indexOf("Leofric waits: Sabeline's transaction holds a lock on a register row this read needs.") >= 0 &&
        log.indexOf("Leofric reads the register: 1 on call (Leofric).") >= 0,
        "Read Committed with FOR UPDATE: Leofric's read waits for Sabeline's commit, then returns 1 on call");

      // 8. Locked reads at Repeatable Read: the read that waited fails, the retry keeps Leofric on.
      t.set("iso", "rr");
      t.expect(st("fails") === "1" && st("on") === "1" && st("retry") === "Leofric stays on call" &&
        t.logText().indexOf("Leofric's locked read fails: ERROR: could not serialize access due to concurrent update (SQLSTATE 40001). Rolled back.") >= 0,
        "Repeatable Read with FOR UPDATE: concurrent update error, then the retry keeps Leofric on call");

      // 9. One global lock: Leofric waits, then reads 1 on call.
      t.set("lockrows", false);
      t.set("iso", "rc");
      t.set("global", true);
      t.expect(st("on") === "1" && st("waits") === "1" && st("fails") === "0" &&
        t.logText().indexOf("holds a lock on the whole register (one global lock).") >= 0,
        "One global lock: the sign-offs run one at a time and 1 clerk stays on call");
      t.set("global", false);

      // 10. The report at Read Committed: 4,212 then 4,213, a phantom read.
      t.set("scenario", "report");
      log = t.logText();
      t.expect(st("anomaly") === "phantom read" && st("on") === "n/a" &&
        log.indexOf("Report printed: count at the start 4,212, count at the end 4,213.") >= 0,
        "Report at Read Committed: 4,212 at the start, 4,213 at the end: a phantom read");

      // 11. The report at Repeatable Read: the snapshot hides the new file.
      t.set("iso", "rr");
      t.expect(st("anomaly") === "none" && t.logText().indexOf("Report printed: count at the start 4,212, count at the end 4,212.") >= 0,
        "Report at Repeatable Read: 4,212 twice, no phantom in PostgreSQL");

      // 12. Locked reads don't stop a phantom at Read Committed.
      t.set("iso", "rc");
      t.set("lockrows", true);
      t.expect(st("anomaly") === "phantom read" && st("waits") === "0",
        "Report at Read Committed with FOR UPDATE: the new file was never locked, so the phantom stays");
      t.set("lockrows", false);

      // 13. Deed 1187 read twice: non-repeatable at Read Committed, steady at Repeatable Read.
      t.set("scenario", "status");
      var a = st("anomaly");
      var hadOut = t.logText().indexOf("Leofric reads deed 1187: out for scanning.") >= 0;
      t.set("iso", "rr");
      t.expect(a === "non-repeatable read" && hadOut && st("anomaly") === "none",
        "Deed 1187: on the shelf then out for scanning at Read Committed; the same twice at Repeatable Read");

      // 14. Read Uncommitted never shows the uncommitted change.
      t.set("scenario", "dirty");
      t.set("iso", "ru");
      t.expect(st("anomaly") === "none" && t.logText().indexOf("Leofric reads deed 1187: on the shelf.") >= 0,
        "Read Uncommitted: Leofric reads on the shelf, not the scanning job's uncommitted change");

      // 15. One step at a time: A's three steps, then B's.
      t.set("scenario", "signoff");
      t.set("iso", "rc");
      t.click("fresh");
      var before = st("anomaly");
      t.click("nextA"); t.click("nextA"); t.click("nextA");
      t.click("nextB"); t.click("nextB"); t.click("nextB");
      t.expect(before === "not finished" && st("on") === "1" && st("anomaly") === "none" &&
        t.logText().indexOf("Leofric's app refuses: Leofric is the last clerk on call.") >= 0,
        "Step by step, A then B: Leofric is refused and 1 clerk stays on call");

      // 16. B first: Sabeline is the one who stays.
      t.set("order", "ba");
      t.expect(st("on") === "1" && t.logText().indexOf("Night check: 1 clerk on call (Sabeline). Rule kept.") >= 0,
        "B first, then A: Leofric signs off and Sabeline stays on call");
    }
  });
})();
