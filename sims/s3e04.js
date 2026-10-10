/* sims/s3e04-v1.0.1.js  (published as sims/s3e04.js)
   Case s3e04 "The Logbook": write-ahead logging, durability and crash recovery aboard the MV
   Brannock Petrel. A logbook lab: one ballast trim of 9 steps (open valves 1 to 4, run the
   transfer pump, close valves 4 to 1), a power blip at a moment the learner picks, and three
   ways for the ballast controller to keep its log.

   CHANGELOG
   v1.0.1 (2026-10-11) review fixes: selfTest compares numeric stats to numbers, not strings
     (t.stat returns a Number for plain numbers); case pointer moved to s3e04-v1.0.1.json.
   v1.0.0 (2026-10-11) first version. Controls: log mode (ledger after each step; log actions
     first and replay the whole log; log states with sequence numbers first and skip what the
     plates already show), fsync on or off, checkpoint off / every 2 / every 3 records, blip
     moment, next event, run to the end, reset. Stats: list (inclinometer), the log says, water
     moved, records lost at the blip, records checked on recovery, records applied on recovery,
     plates ahead of the log, trim done at. selfTest: 13 assertions.

   Where every number comes from (conventions rule 14; the case is content/s3/s3e04-v1.0.1.json):
   - post: two ballast tanks, port 150 t and starboard 250 t, so the ship lists 2 degrees to
     starboard. The trim moves 50 t from starboard to port with the transfer pump, 4 minutes at
     12.5 t a minute. Steps: 1 open valve 1, 2 open valve 2, 3 open valve 3, 4 open valve 4,
     5 transfer pump, 6 close valve 4, 7 close valve 3, 8 close valve 2, 9 close valve 1.
   - post: the trim starts at 02:54:40. Each step starts 20 s after the one before it finishes:
     valve 1 02:54:40, valve 2 02:55:00, valve 3 02:55:20, valve 4 02:55:40, pump 02:56:00 to
     03:00:00, valve 4 closed 03:00:20, valve 3 03:00:40, valve 2 03:01:00, valve 1 03:01:20.
   - post: the ledger is written after each step, and its lines wait in memory until the card
     saves them every five minutes: 02:55:10, 03:00:10, 03:05:10 (OP's reply to u/grey_pager).
     So at 02:55:10 the card saves steps 1 and 2.
   - post: the power blip is at 03:00:00, the second the pump stops, before step 5's ledger line
     is written. Lost: steps 3 and 4 (waiting for the card). The controller is back at 03:00:40
     (40 s), reads "steps 1-2 done" and resumes at step 3 at 03:01:00: valve 3 and valve 4 open
     again (they already were), the pump runs again 03:01:40 to 03:05:40, and the trim is done at
     03:07:00. The water moved twice: 100 t, port 250 t, starboard 150 t, 2.0 degrees to port.
     The ledger has each step once, so it says level.
   - OP's reply: each valve and the tank gauge has a plate that keeps the last command number it
     was given. The last trim's records were No. 4108 to 4116, ending pump 4112, close valve 4
     4113, valve 3 4114, valve 2 4115, valve 1 4116, so tonight's records are No. 4117 (step 1)
     to No. 4125 (step 9) and the plates start at those last-trim numbers.
   - Part 2s: ledger after with fsync: back 03:00:40, steps 1-4 on the card, pump again 03:01:00
     to 03:05:00, done 03:06:20, 2.0 degrees to port. Actions first, replay all: Nos. 4117 to
     4121 replayed at 03:00:40, pump 03:00:40 to 03:04:40, done 03:06:00, 2.0 to port. States
     with numbers, fsync, checkpoint every 3: last checkpoint after No. 4119, 2 records checked
     (4120 and 4121), both skipped, valve 4 closed at 03:01:00, done 03:02:00, level.

   Teaching model (stated in sim.lede):
   - The list is (starboard tonnes - port tonnes) / 50 degrees: every 50 t more on one side
     leans her 1 degree that way. Only the two tanks count.
   - Valve steps take no time. The pump moves 12.5 t a minute. When the controller logs
     actions, the pump step is "run 4 minutes" (50 t). When it logs states, the pump step is
     "port 200 t, starboard 200 t", and it pumps only until the gauges read that.
   - Ledger after: act, then write the line. Logs first: write the record, then act. With
     fsync on, every line is on the card the moment it is written; with fsync off it waits for
     the five-minute save.
   - A blip at time T comes after any step finishing at T and before any line due at T. The
     controller is back 40 s later. Each trim gets a new log file; numbers carry on.
   - Recovery. Ledger after: resume at the first step not on the card; nothing is replayed.
     Actions: replay every record on the card after the last checkpoint (or all of tonight's),
     doing each again, then carry on. States: the same records, but each one is applied only
     if its device's plate shows a lower number; applying sets the plate. Valve records and
     skipped records take no time; a pump record takes its run time. The next step starts 20 s
     after the controller is back or the replay ends.
   - Checkpoint (logs-first modes only): after record n's step is done, when (n - 4116) is a
     multiple of the setting, the controller checks every valve and the tanks and writes
     "everything up to No. n is done". It is a line on the card like any other.

   Self-test arithmetic:
   - Story: 2 lost, resume at step 3 at 03:01:00, pump 03:01:40, 100 t, 2.0 to port, done
     03:07:00. The 03:05:10 save keeps steps 3 and 4 of the second run.
   - Ledger after, fsync on: 0 lost, steps 1-4 on the card, pump 03:01:00, 100 t, 2.0 to port.
     Blip at 02:58:00: 25 t moved, back 02:58:40, pump again 02:59:00 to 03:03:00, 75 t, port
     225 t, starboard 175 t, 1.0 degrees to port.
   - Actions, fsync on, no checkpoint: 5 replayed (4117 to 4121) at 03:00:40, pump 03:00:40 to
     03:04:40, steps 6 to 9 at 03:05:00 to 03:06:00. 100 t, 2.0 to port.
   - States, fsync on: no checkpoint, 5 checked, 0 applied, done 03:02:00, level. Every 3:
     checkpoint after 4119, 2 checked. Every 2: checkpoint after 4120, 1 checked.
   - States, blip at 02:58:00: tanks plate 4112 < 4121, so 4121 is applied: pump 2 min, 25 t,
     02:58:40 to 03:00:40, 50 t in all, level, done 03:02:00.
   - States, fsync off, blip 03:00:00: 4117 and 4118 saved at 02:55:10; 4119 to 4121 lost; 3
     plates ahead of the log; 2 checked, 0 applied; step 3 at 03:01:00; at 03:01:40 the tanks
     already read 200 and 200, so the pump stays off. 50 t, level.
   - No blip, states: done 03:01:20, level.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px):
   - Top row (y 50, 62 high): Ballast controller (x 130, 230 wide), Log on the card (x 385,
     230 wide), Inclinometer (x 635, 190 wide): 15-245, 270-500, 540-730. Longest sub
     "2.0 degrees to starboard", 24 chars, 173px, in 190. Longest controller meta "logs states
     and numbers first" style lines kept to 28 chars, 185px, in 230.
   - Middle row (y 180, 62 high): Valve 1 to 4 and Transfer pump, 130 wide at x 80, 225, 370,
     515, 660: 15px gaps. Longest meta "plate No. 4125", 14 chars, 92px; "12.5 t a minute", 99px.
   - Bottom row (y 320, 72 high): Port tank (x 200), Starboard tank (x 540), 220 wide. Rows 68
     and 73 px apart.

   Catalog note: the case's concepts are write-ahead-logs, durability and crash-recovery.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 10;                           // sim seconds per real second
  var T0 = 2 * 3600 + 54 * 60 + 40;         // 02:54:40, the trim starts
  var LEAD = 10;                            // the replay opens at 02:54:30
  var BASE = 4116;                          // the last record of the last trim
  var RATE = 12.5 / 60;                     // tonnes a second: 12.5 t a minute
  var PORT0 = 150;
  var STBD0 = 250;
  var TARGET = 200;                         // port and starboard after the trim
  var PLAN = 50;                            // tonnes the trim moves
  var PER_DEGREE = 50;                      // tonnes of difference per degree of list
  var GAP = 20;                             // seconds between steps
  var REBOOT = 40;                          // seconds the controller is dark
  var SAVE_FIRST = 30;                      // 02:55:10
  var SAVE_EVERY = 300;                     // every five minutes
  var END_PAD = 20;                         // the replay ends 20 s after its last event
  var PLATE0 = { v1: 4116, v2: 4115, v3: 4114, v4: 4113, tanks: 4112 };

  var STEPS = [
    null,
    { dev: "v1", n: 1, open: true },
    { dev: "v2", n: 2, open: true },
    { dev: "v3", n: 3, open: true },
    { dev: "v4", n: 4, open: true },
    { dev: "tanks", pump: true },
    { dev: "v4", n: 4, open: false },
    { dev: "v3", n: 3, open: false },
    { dev: "v2", n: 2, open: false },
    { dev: "v1", n: 1, open: false }
  ];

  var MODE_OPTS = [
    { value: "after", label: "Ledger after each step (as now)" },
    { value: "actions", label: "Log actions first, replay the whole log" },
    { value: "states", label: "Log states and numbers first, skip what plates show" }
  ];
  var MODE_META = {
    after: "ledger after each step",
    actions: "logs actions first",
    states: "logs states and numbers first"
  };
  var CKPT_OPTS = [
    { value: "off", label: "Off (as now)" },
    { value: "2", label: "Every 2 records" },
    { value: "3", label: "Every 3 records" }
  ];
  var CRASH_OPTS = [
    { value: "none", label: "No blip" },
    { value: "50", label: "02:55:30, between valve 3 and valve 4" },
    { value: "200", label: "02:58:00, halfway through the pump run" },
    { value: "320", label: "03:00:00, as the pump stops (as Tuesday)" },
    { value: "350", label: "03:00:30, after valve 4 closes" },
    { value: "390", label: "03:01:10, after valve 2 closes" }
  ];

  /* ---------- small helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function hms(sec) {
    var s = Math.floor(sec) % 86400;
    if (s < 0) s += 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function copy(o) {
    var r = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k];
    return r;
  }

  function round1(x) { return Math.round(x * 10) / 10; }

  // 50 -> "50", 12.5 -> "12.5"
  function tn(x) {
    var r = round1(x);
    return r === Math.round(r) ? String(Math.round(r)) : r.toFixed(1);
  }

  function mins(sec) { return tn(sec / 60) + " min"; }

  function listText(port, stbd) {
    var d = round1((stbd - port) / PER_DEGREE);
    if (Math.abs(d) < 0.05) return "level";
    return d > 0 ? d.toFixed(1) + " degrees to starboard" : (-d).toFixed(1) + " degrees to port";
  }

  // ["a"] -> "a"; ["a", "b"] -> "a and b"; ["a", "b", "c"] -> "a, b and c"
  function joinList(a) {
    if (a.length <= 1) return a.join("");
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }

  function names(entries) {
    var steps = [];
    var recs = [];
    var parts = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.kind === "line") steps.push(String(e.step));
      else if (e.kind === "rec") recs.push(String(e.lsn));
    }
    if (steps.length) parts.push((steps.length > 1 ? "steps " : "step ") + joinList(steps));
    if (recs.length) parts.push("No. " + joinList(recs));
    for (var j = 0; j < entries.length; j++) {
      if (entries[j].kind === "ckpt") parts.push("the checkpoint after No. " + entries[j].lsn);
    }
    return parts.join("; ");
  }

  function devName(dev) { return dev === "tanks" ? "tank gauge" : "valve " + dev.charAt(1); }

  function actionText(s) {
    if (s.pump) return "run the transfer pump 4 min";
    return (s.open ? "open" : "close") + " valve " + s.n;
  }

  function stateText(s) {
    if (s.pump) return "port " + TARGET + " t, starboard " + TARGET + " t";
    return "valve " + s.n + ": " + (s.open ? "open" : "closed");
  }

  /* ---------- the night, worked out in full ---------- */

  // Returns { ev: [{t, msg, tone, snap}], pumps: [{start, end}], end }.
  function simulate(cfg) {
    var W = {
      valves: { v1: false, v2: false, v3: false, v4: false },
      plates: copy(PLATE0),
      port: PORT0,
      stbd: STBD0,
      log: [],
      lost: 0,
      checked: 0,
      applied: 0,
      ahead: 0,
      status: "idle",
      doneAt: null,
      crashed: false
    };
    var out = { ev: [], pumps: [], end: 0 };
    var C = cfg.crash === "none" ? Infinity : Number(cfg.crash);
    var every = cfg.ckpt === "off" ? 0 : Number(cfg.ckpt);
    var logsFirst = cfg.mode !== "after";
    var nextSave = SAVE_FIRST;

    function pumpEntries() {
      var c = 0;
      for (var i = 0; i < W.log.length; i++) if (W.log[i].kind !== "ckpt" && W.log[i].step === 5) c += 1;
      return c;
    }

    function logSays() {
      var c = pumpEntries();
      if (cfg.mode === "states") return c > 0 ? listText(TARGET, TARGET) : listText(PORT0, STBD0);
      return listText(PORT0 + PLAN * c, STBD0 - PLAN * c);
    }

    function snap() {
      var saved = 0;
      var waiting = 0;
      var lastSaved = null;
      for (var i = 0; i < W.log.length; i++) {
        var e = W.log[i];
        if (e.durable) { saved += 1; if (e.kind !== "ckpt") lastSaved = e; }
        else waiting += 1;
      }
      return {
        valves: copy(W.valves), plates: copy(W.plates), saved: saved, waiting: waiting,
        lastSaved: lastSaved ? (lastSaved.kind === "line" ? "step " + lastSaved.step : "No. " + lastSaved.lsn) : null,
        lost: W.lost, checked: W.checked, applied: W.applied, ahead: W.ahead,
        status: W.status, says: logSays(), doneAt: W.doneAt
      };
    }

    function emit(t, msg, tone) {
      out.ev.push({ t: t, msg: msg, tone: tone || "", snap: snap() });
      if (t > out.end) out.end = t;
    }

    function saveUpTo(t) {
      while (nextSave <= t) {
        var waiting = [];
        for (var i = 0; i < W.log.length; i++) if (!W.log[i].durable) waiting.push(W.log[i]);
        if (waiting.length) {
          for (var j = 0; j < waiting.length; j++) waiting[j].durable = true;
          emit(nextSave, "The card saves " + waiting.length + " waiting line" + (waiting.length > 1 ? "s" : "") + ": " + names(waiting) + ".");
        }
        nextSave += SAVE_EVERY;
      }
    }

    function write(t, entry) {
      saveUpTo(t);
      entry.durable = !!cfg.fsync;
      W.log.push(entry);
      return cfg.fsync ? " Forced to the card." : " Waiting for the card.";
    }

    function finish(t) {
      W.status = "trim done";
      W.doneAt = t;
      var moved = 0;
      for (var i = 0; i < out.pumps.length; i++) moved += (out.pumps[i].end - out.pumps[i].start) * RATE;
      var real = listText(W.port, W.stbd);
      var says = logSays();
      emit(t, "Trim done. Water moved: " + tn(moved) + " t for a " + PLAN + " t trim. The log says " + says +
        "; the inclinometer says " + real + ".", real === says && real === "level" ? "ok" : "bad");
    }

    // The pump, for one step or one replayed record. Returns the time it stops, or null if
    // the blip stopped it.
    function runPump(t, amount, prefix) {
      if (amount <= 0) {
        emit(t, prefix + ": the tanks already read port " + tn(W.port) + " t, starboard " + tn(W.stbd) + " t. The pump stays off.", "ok");
        return t;
      }
      var dur = amount / RATE;
      W.status = "pump running";
      emit(t, prefix + ": transfer pump on for " + mins(dur) + ", " + tn(amount) + " t from starboard to port.");
      var end = t + dur;
      if (!W.crashed && C < end) {
        var moved = (C - t) * RATE;
        out.pumps.push({ start: t, end: C });
        W.port += moved;
        W.stbd -= moved;
        return null;
      }
      out.pumps.push({ start: t, end: end });
      W.port += amount;
      W.stbd -= amount;
      saveUpTo(end);
      W.status = "running";
      emit(end, prefix + ": pump off. Port " + tn(W.port) + " t, starboard " + tn(W.stbd) + " t, " + listText(W.port, W.stbd) + ".");
      return end;
    }

    function setValve(t, s, prefix) {
      var was = W.valves[s.dev];
      W.valves[s.dev] = s.open;
      var word = s.open ? "open" : "closed";
      emit(t, prefix + ": valve " + s.n + " " + (s.open ? "opened" : "closed") + (was === s.open ? " (it already was " + word + ")" : "") + ".");
    }

    function crash(midPump, afterAct, stepNo) {
      saveUpTo(C);
      W.crashed = true;
      var lost = [];
      var kept = [];
      for (var i = 0; i < W.log.length; i++) (W.log[i].durable ? kept : lost).push(W.log[i]);
      W.log = kept;
      W.lost = 0;
      for (var j = 0; j < lost.length; j++) if (lost[j].kind !== "ckpt") W.lost += 1;
      W.status = "dark, rebooting";
      var m = "POWER BLIP. The controller goes dark.";
      if (midPump) m += " The pump stops with " + tn(W.port - PORT0 - movedBefore()) + " t moved.";
      if (afterAct && cfg.mode === "after") m += " Step " + stepNo + " is done, but its ledger line was never written.";
      m += lost.length ? " Lost from memory, never saved: " + names(lost) + "." : " Nothing was waiting for the card.";
      emit(C, m, "bad");
      recover(C + REBOOT);
    }

    // Water moved by earlier pump runs, so a mid-run blip can say what this run moved.
    function movedBefore() {
      var m = 0;
      for (var i = 0; i < out.pumps.length - 1; i++) m += (out.pumps[i].end - out.pumps[i].start) * RATE;
      return m;
    }

    function recover(b) {
      var i;
      W.status = "recovering";
      if (cfg.mode === "after") {
        var last = 0;
        for (i = 0; i < W.log.length; i++) if (W.log[i].kind === "line") last = W.log[i].step;
        var done = last === 0 ? "no steps done" : (last === 1 ? "step 1 done" : "steps 1-" + last + " done");
        emit(b, "Rebooted. Ledger: " + done + "." + (last < 9 ? " Resuming at step " + (last + 1) + "." : ""));
        if (last >= 9) { finish(b); return; }
        W.status = "running";
        runFrom(last + 1, b + GAP);
        return;
      }
      var recs = [];
      var ck = null;
      for (i = 0; i < W.log.length; i++) {
        if (W.log[i].kind === "rec") recs.push(W.log[i]);
        else if (W.log[i].kind === "ckpt") ck = W.log[i];
      }
      var lastLsn = recs.length ? recs[recs.length - 1].lsn : BASE;
      var from = ck ? ck.lsn : BASE;
      var todo = [];
      for (i = 0; i < recs.length; i++) if (recs[i].lsn > from) todo.push(recs[i]);
      var head = "Rebooted. Log on the card: " + (recs.length ? "No. " + recs[0].lsn + (recs.length > 1 ? " to " + lastLsn : "") : "no records") +
        "; " + (ck ? "last checkpoint after No. " + ck.lsn : "no checkpoint") + ". ";
      head += cfg.mode === "states"
        ? "Checking " + todo.length + " record" + (todo.length === 1 ? "" : "s") + " against the plates."
        : "Replaying " + todo.length + " record" + (todo.length === 1 ? "" : "s") + ".";
      emit(b, head);
      if (cfg.mode === "states") {
        var ahead = [];
        ["v1", "v2", "v3", "v4", "tanks"].forEach(function (d) { if (W.plates[d] > lastLsn) ahead.push(W.plates[d]); });
        ahead.sort(function (x, y) { return x - y; });
        W.ahead = ahead.length;
        if (ahead.length) {
          emit(b, ahead.length + " plate" + (ahead.length > 1 ? "s show records" : " shows a record") + " the log never kept: No. " + joinList(ahead.map(String)) +
            ". Here a state is safe to repeat; in a database, a page newer than its log is how fsync off corrupts data.", "warn");
        }
      }
      var t = b;
      W.status = "replaying";
      for (i = 0; i < todo.length; i++) {
        var r = todo[i];
        var s = STEPS[r.step];
        W.checked += 1;
        if (cfg.mode === "states") {
          var plate = W.plates[s.dev];
          if (plate >= r.lsn) {
            emit(t, "No. " + r.lsn + ", " + stateText(s) + ". Its plate shows No. " + plate + ": already done, skipped.", "ok");
            continue;
          }
          emit(t, "No. " + r.lsn + ", " + stateText(s) + ". Its plate shows No. " + plate + ": applying.", "warn");
        }
        W.applied += 1;
        if (s.pump) {
          var amount = cfg.mode === "states" ? TARGET - W.port : PLAN;
          t = runPump(t, amount, "Replay No. " + r.lsn);
        } else {
          setValve(t, s, "Replay No. " + r.lsn);
        }
        if (cfg.mode === "states") W.plates[s.dev] = r.lsn;
      }
      var next = lastLsn - BASE + 1;
      if (next > 9) { finish(t); return; }
      W.status = "running";
      runFrom(next, t + GAP);
    }

    function runFrom(k, t) {
      for (; k <= 9; k++) {
        if (!W.crashed && C < t) { crash(false, false, 0); return; }
        var s = STEPS[k];
        var lsn = BASE + k;
        var prefix = "Step " + k;
        W.status = "step " + k;
        if (logsFirst) {
          var tail = write(t, { kind: "rec", step: k, lsn: lsn });
          emit(t, "No. " + lsn + " logged: " + (cfg.mode === "states" ? stateText(s) : actionText(s)) + "." + tail);
        } else {
          saveUpTo(t);
        }
        if (s.pump) {
          var amount = cfg.mode === "states" ? TARGET - W.port : PLAN;
          var end = runPump(t, amount, prefix);
          if (end === null) { crash(true, false, k); return; }
          t = end;
        } else {
          setValve(t, s, prefix);
        }
        if (cfg.mode === "states") W.plates[s.dev] = lsn;
        if (!W.crashed && C === t) { crash(false, true, k); return; }
        if (cfg.mode === "after") {
          var tl = write(t, { kind: "line", step: k });
          emit(t, "Ledger: step " + k + " done." + tl);
        } else if (every && (lsn - BASE) % every === 0) {
          var tc = write(t, { kind: "ckpt", lsn: lsn });
          emit(t, "Checkpoint: every valve and the tanks checked; everything up to No. " + lsn + " is done." + tc, "ok");
        }
        W.status = "running";
        if (k === 9) { finish(t); return; }
        t += GAP;
      }
    }

    runFrom(1, 0);
    out.end += END_PAD;
    return out;
  }

  /* ---------- the diagram ---------- */

  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 380,
    aria: "Logbook lab aboard the MV Brannock Petrel. Top row: the ballast controller, its log on a memory card, and the inclinometer that shows the list. Middle row: valves 1 to 4 and the transfer pump, each with a plate that can keep the number of the last record applied to it. Bottom row: the port tank, 150 tonnes, and the starboard tank, 250 tonnes. The trim moves 50 tonnes from starboard to port.",
    nodes: [
      { id: "ctl", label: "Ballast controller", sub: "idle", meta: "ledger after each step", x: 130, y: 50, w: 230, h: 62, shape: "box", tone: "" },
      { id: "card", label: "Log on the card", sub: "saved 0, waiting 0", meta: "last saved: nothing yet", x: 385, y: 50, w: 230, h: 62, shape: "box", tone: "" },
      { id: "incl", label: "Inclinometer", sub: "2.0 degrees to starboard", meta: "the real list", x: 635, y: 50, w: 190, h: 62, shape: "box", tone: "warn" },
      { id: "v1", label: "Valve 1", sub: "closed", meta: "plate not used", x: 80, y: 180, w: 130, h: 62, shape: "box", tone: "" },
      { id: "v2", label: "Valve 2", sub: "closed", meta: "plate not used", x: 225, y: 180, w: 130, h: 62, shape: "box", tone: "" },
      { id: "v3", label: "Valve 3", sub: "closed", meta: "plate not used", x: 370, y: 180, w: 130, h: 62, shape: "box", tone: "" },
      { id: "v4", label: "Valve 4", sub: "closed", meta: "plate not used", x: 515, y: 180, w: 130, h: 62, shape: "box", tone: "" },
      { id: "pump", label: "Transfer pump", sub: "off", meta: "12.5 t a minute", x: 660, y: 180, w: 130, h: 62, shape: "box", tone: "" },
      { id: "port", label: "Port tank", sub: "150 t", meta: "plate not used", x: 200, y: 320, w: 220, h: 72, shape: "db", tone: "" },
      { id: "stbd", label: "Starboard tank", sub: "250 t", meta: "plate not used", x: 540, y: 320, w: 220, h: 72, shape: "db", tone: "" }
    ],
    edges: [
      { from: "ctl", to: "card", label: "log" },
      { from: "stbd", to: "port", label: "water", dash: true, tone: "muted" }
    ]
  };

  /* ---------- the replay ---------- */

  function cfgOf(S) { return { mode: S.mode, fsync: S.fsync, ckpt: S.ckpt, crash: S.crash }; }

  function startNight(api) {
    var S = api.state;
    S.night = simulate(cfgOf(S));
    S.t = -LEAD;
    S.shown = 0;
    S.over = false;
    api.speed = SPEED;
    api.clock = T0 - LEAD;
    var crashOpt = pick(CRASH_OPTS, S.crash);
    var m = "Trim at 02:54:40: 50 t from the starboard tank to the port tank, 9 steps. Mode: " + pick(MODE_OPTS, S.mode).label.replace(" (as now)", "").toLowerCase() +
      ". fsync " + (S.fsync ? "on" : "off") + ". Checkpoints: " + (S.ckpt === "off" ? "off" : "every " + S.ckpt + " records") +
      ". Blip: " + (S.crash === "none" ? "none" : crashOpt.label.split(",")[0]) + ".";
    if (S.mode === "after" && S.ckpt !== "off") m += " Checkpoints change nothing here: the ledger mode never replays.";
    api.log(m, "");
    draw(api);
  }

  function replay(api, what) {
    api.clock = T0 - LEAD;
    api.log(what + " Replaying the trim from 02:54:30.", "");
    startNight(api);
  }

  function advance(api, target) {
    var S = api.state;
    if (S.over) return;
    var end = S.night.end;
    var to = Math.min(target, end);
    while (S.shown < S.night.ev.length && S.night.ev[S.shown].t <= to + 1e-6) {
      var e = S.night.ev[S.shown];
      api.clock = T0 + e.t;
      api.log(e.msg, e.tone);
      S.shown += 1;
    }
    S.t = to;
    api.clock = T0 + Math.floor(to + 1e-6);
    if (to >= end) S.over = true;
    draw(api);
  }

  function nextEventTime(S) {
    if (S.shown < S.night.ev.length) return S.night.ev[S.shown].t;
    return S.night.end;
  }

  /* ---------- drawing ---------- */

  function currentSnap(S) {
    if (S.shown === 0) return null;
    return S.night.ev[S.shown - 1].snap;
  }

  function tanksAt(S, t) {
    var moved = 0;
    var running = false;
    for (var i = 0; i < S.night.pumps.length; i++) {
      var p = S.night.pumps[i];
      if (t <= p.start) continue;
      var upto = Math.min(t, p.end);
      moved += (upto - p.start) * RATE;
      if (t < p.end) running = true;
    }
    return { port: PORT0 + moved, stbd: STBD0 - moved, moved: moved, running: running };
  }

  function draw(api) {
    var S = api.state;
    var sn = currentSnap(S);
    var tk = tanksAt(S, S.t);
    var states = S.mode === "states";

    var ctl = api.node("ctl");
    ctl.text("sub", sn ? sn.status : "idle");
    ctl.text("meta", MODE_META[S.mode]);
    ctl.set(sn && sn.status === "dark, rebooting" ? "bad" : (sn && sn.status === "trim done" ? "ok" : ""));

    var card = api.node("card");
    card.text("label", S.mode === "after" ? "Ledger on the card" : "Log on the card");
    card.text("sub", "saved " + (sn ? sn.saved : 0) + ", waiting " + (sn ? sn.waiting : 0));
    card.text("meta", "last saved: " + (sn && sn.lastSaved ? sn.lastSaved : "nothing yet"));
    card.set(sn && sn.waiting ? "warn" : "");

    var real = listText(tk.port, tk.stbd);
    var incl = api.node("incl");
    incl.text("sub", real);
    incl.set(real === "level" ? "ok" : (Math.abs((tk.stbd - tk.port) / PER_DEGREE) > 2.05 || (tk.port > tk.stbd) ? "bad" : "warn"));

    ["v1", "v2", "v3", "v4"].forEach(function (id) {
      var nd = api.node(id);
      var open = sn ? sn.valves[id] : false;
      nd.text("sub", open ? "open" : "closed");
      nd.text("meta", states ? "plate No. " + (sn ? sn.plates[id] : PLATE0[id]) : "plate not used");
      nd.set(open ? "ok" : "");
    });

    var pump = api.node("pump");
    pump.text("sub", tk.running ? "running" : "off");
    pump.set(tk.running ? "warn" : "");

    var plateTxt = states ? "plate No. " + (sn ? sn.plates.tanks : PLATE0.tanks) : "plate not used";
    api.node("port").text("sub", tn(tk.port) + " t");
    api.node("stbd").text("sub", tn(tk.stbd) + " t");
    api.node("port").text("meta", plateTxt);
    api.node("stbd").text("meta", plateTxt);

    S.stat.list(real);
    S.stat.says(sn ? sn.says : listText(PORT0, STBD0));
    S.stat.moved(tn(tk.moved) + " t of " + PLAN + " planned");
    S.stat.lost(String(sn ? sn.lost : 0));
    S.stat.checked(String(sn ? sn.checked : 0));
    S.stat.applied(String(sn ? sn.applied : 0));
    S.stat.ahead(String(sn ? sn.ahead : 0));
    S.stat.done(sn && sn.doneAt !== null ? hms(T0 + sn.doneAt) : "not yet");

    S.ctl.next.disable(S.over);
    S.ctl.end.disable(S.over);
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.night || S.over) return;
    advance(api, S.t + dt * api.speed);
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    ctl: "<strong>Ballast controller.</strong> Runs the trim's 9 steps in order. In the ledger mode it does a step, then writes a line. In the logs-first modes it writes the record first, then does the step. After a blip it is dark for 40 s, then reads its card to decide what to do.",
    card: "<strong>The memory card.</strong> Where the log lives. A line written with fsync off waits in memory until the card's five-minute save (02:55:10, 03:00:10, 03:05:10); a blip loses whatever is still waiting. With fsync on, each line is on the card before the controller moves on.",
    incl: "<strong>Inclinometer.</strong> Shows the real list. In this sim the list is (starboard tonnes - port tonnes) / 50 degrees: every 50 t more on one side leans her 1 degree that way.",
    pump: "<strong>Transfer pump.</strong> Moves water from the starboard tank to the port tank at 12.5 t a minute. Told to run 4 minutes, it moves 50 t, whether or not that water has already moved.",
    port: "<strong>Port tank.</strong> 150 t at the start of the trim; 200 t when the trim is right. Its gauge has a plate, like the valves, used only when the controller logs states and numbers.",
    stbd: "<strong>Starboard tank.</strong> 250 t at the start of the trim; 200 t when the trim is right."
  };

  function valveInfo(id) {
    var n = id.charAt(1);
    return "<strong>Valve " + n + ".</strong> Opened by step " + n + " and closed again near the end. Opening an open valve changes nothing. Its plate keeps the number of the last record applied to it, like a database page's LSN, but only when the controller logs states and numbers.";
  }

  /* ---------- the module ---------- */

  DL.sims.define("s3e04", {
    diagram: DIAGRAM,
    startClock: T0 - LEAD,

    setup: function (api) {
      var S = api.state;
      S.mode = "after";
      S.fsync = false;
      S.ckpt = "off";
      S.crash = "320";
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.mode = api.control.select("mode", "Log mode", MODE_OPTS, "after", function (v) {
        var o = pick(MODE_OPTS, v);
        if (!o) return;
        S.mode = String(o.value);
        replay(api, "Log mode: " + o.label.replace(" (as now)", "").toLowerCase() + ".");
      });
      S.ctl.fsync = api.control.toggle("fsync", "fsync: force each line to the card", false, function (on) {
        S.fsync = !!on;
        replay(api, "fsync: " + (S.fsync ? "on." : "off."));
      });
      S.ctl.ckpt = api.control.select("ckpt", "Checkpoints", CKPT_OPTS, "off", function (v) {
        var o = pick(CKPT_OPTS, v);
        if (!o) return;
        S.ckpt = String(o.value);
        replay(api, "Checkpoints: " + o.label.replace(" (as now)", "").toLowerCase() + ".");
      });
      S.ctl.crash = api.control.select("crash", "Power blip", CRASH_OPTS, "320", function (v) {
        var o = pick(CRASH_OPTS, v);
        if (!o) return;
        S.crash = String(o.value);
        replay(api, "Power blip: " + o.label.replace(" (as Tuesday)", "") + ".");
      });
      S.ctl.next = api.control.button("next", "Next event", function () { advance(api, nextEventTime(S)); });
      S.ctl.end = api.control.button("end", "Run to the end", function () { advance(api, S.night.end); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        list: api.stat("list", "list (inclinometer)", "bad"),
        says: api.stat("says", "the log says", ""),
        moved: api.stat("moved", "water moved", "warn"),
        lost: api.stat("lost", "records lost at the blip", "bad"),
        checked: api.stat("checked", "records checked on recovery", ""),
        applied: api.stat("applied", "records applied on recovery", "warn"),
        ahead: api.stat("ahead", "plates ahead of the log", "bad"),
        done: api.stat("done", "trim done at", "")
      };

      api.onNodeClick(function (id) {
        if (/^v[1-4]$/.test(id)) { api.info(valveInfo(id)); return; }
        if (INFO[id]) api.info(INFO[id]);
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startNight(api);
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function since() { return t.logText().slice(mark); }
      var log;

      // 1. The start: 2 degrees to starboard.
      t.expect(t.stat("list") === "2.0 degrees to starboard" && t.node("port").text.sub === "150 t" && t.node("stbd").text.sub === "250 t",
        "The trim starts with port 150 t, starboard 250 t: 2.0 degrees to starboard");

      // 2. Tuesday as now: ledger after, fsync off, blip at 03:00:00.
      begin();
      t.click("end");
      log = since();
      t.expect(log.indexOf("02:55:10 The card saves 2 waiting lines: steps 1 and 2.") >= 0 &&
        log.indexOf("03:00:00 POWER BLIP. The controller goes dark. Step 5 is done, but its ledger line was never written. Lost from memory, never saved: steps 3 and 4.") >= 0 &&
        log.indexOf("03:00:40 Rebooted. Ledger: steps 1-2 done. Resuming at step 3.") >= 0 && t.stat("lost") === 2,
        "Tuesday: the card saved steps 1 and 2 at 02:55:10, the blip at 03:00:00 loses steps 3 and 4, and step 5 was never written");
      t.expect(log.indexOf("03:01:00 Step 3: valve 3 opened (it already was open).") >= 0 &&
        log.indexOf("03:01:40 Step 5: transfer pump on for 4 min, 50 t from starboard to port.") >= 0 &&
        log.indexOf("03:07:00 Trim done. Water moved: 100 t for a 50 t trim. The log says level; the inclinometer says 2.0 degrees to port.") >= 0 &&
        t.stat("list") === "2.0 degrees to port" && t.stat("says") === "level" && t.stat("moved") === "100 t of 50 planned",
        "Tuesday: the pump runs again from 03:01:40, and at 03:07:00 the ledger says level while she lists 2.0 degrees to port");

      // 3. Ledger after with fsync on: the window shrinks to one step, and that step is the pump.
      begin();
      t.click("fsync");
      t.click("end");
      log = since();
      t.expect(t.stat("lost") === 0 && log.indexOf("03:00:40 Rebooted. Ledger: steps 1-4 done. Resuming at step 5.") >= 0 &&
        log.indexOf("03:01:00 Step 5: transfer pump on for 4 min, 50 t from starboard to port.") >= 0 &&
        t.stat("list") === "2.0 degrees to port" && t.stat("done") === "03:06:20",
        "Ledger after with fsync: nothing lost, but step 5 was never written, so the pump runs again at 03:01:00: 2.0 degrees to port");

      // 4. Ledger after, blip halfway through the pump run.
      begin();
      t.set("crash", "200");
      t.click("end");
      log = since();
      t.expect(log.indexOf("02:58:00 POWER BLIP. The controller goes dark. The pump stops with 25 t moved. Nothing was waiting for the card.") >= 0 &&
        t.stat("moved") === "75 t of 50 planned" && t.stat("list") === "1.0 degrees to port",
        "Ledger after, blip at 02:58:00: 25 t had moved, the pump runs a full 4 minutes again, 75 t: 1.0 degrees to port");

      // 5. Log actions first, replay the whole log.
      t.set("crash", "320");
      begin();
      t.set("mode", "actions");
      t.click("end");
      log = since();
      t.expect(log.indexOf("03:00:40 Rebooted. Log on the card: No. 4117 to 4121; no checkpoint. Replaying 5 records.") >= 0 &&
        log.indexOf("03:00:40 Replay No. 4121: transfer pump on for 4 min, 50 t from starboard to port.") >= 0 &&
        log.indexOf("03:06:00 Trim done. Water moved: 100 t for a 50 t trim. The log says level; the inclinometer says 2.0 degrees to port.") >= 0 &&
        t.stat("applied") === 5,
        "Actions first, replay all: Nos. 4117 to 4121 replayed at 03:00:40, the pump repeats, 2.0 degrees to port at 03:06:00");

      // 6. Log states with numbers first: recovery skips what the plates show.
      begin();
      t.set("mode", "states");
      t.click("end");
      log = since();
      t.expect(t.stat("checked") === 5 && t.stat("applied") === 0 &&
        log.indexOf("03:00:40 No. 4121, port 200 t, starboard 200 t. Its plate shows No. 4121: already done, skipped.") >= 0 &&
        log.indexOf("03:02:00 Trim done. Water moved: 50 t for a 50 t trim. The log says level; the inclinometer says level.") >= 0 &&
        t.stat("list") === "level",
        "States with numbers, fsync on: 5 records checked, all already on the plates, none applied; level at 03:02:00");

      // 7. Checkpoints shorten the replay.
      begin();
      t.set("ckpt", "3");
      t.click("end");
      log = since();
      t.expect(t.stat("checked") === 2 &&
        log.indexOf("03:00:40 Rebooted. Log on the card: No. 4117 to 4121; last checkpoint after No. 4119. Checking 2 records against the plates.") >= 0,
        "Checkpoint every 3 records: recovery starts after No. 4119 and checks only 2 records");
      t.set("ckpt", "2");
      t.click("end");
      t.expect(t.stat("checked") === 1 && t.stat("list") === "level",
        "Checkpoint every 2 records: recovery starts after No. 4120 and checks 1 record");
      t.set("ckpt", "off");

      // 8. States, blip mid-pump: the record is applied, and pumps only what's missing.
      begin();
      t.set("crash", "200");
      t.click("end");
      log = since();
      t.expect(t.stat("applied") === 1 &&
        log.indexOf("02:58:40 No. 4121, port 200 t, starboard 200 t. Its plate shows No. 4112: applying.") >= 0 &&
        log.indexOf("02:58:40 Replay No. 4121: transfer pump on for 2 min, 25 t from starboard to port.") >= 0 &&
        t.stat("moved") === "50 t of 50 planned" && t.stat("list") === "level",
        "States, blip at 02:58:00: No. 4121 is applied and pumps only the missing 25 t, 50 t in all, level");

      // 9. States with fsync off: three records 'written' and lost.
      t.set("crash", "320");
      begin();
      t.click("fsync");
      t.click("end");
      log = since();
      t.expect(t.stat("lost") === 3 && t.stat("ahead") === 3 &&
        log.indexOf("03:00:00 POWER BLIP. The controller goes dark. Lost from memory, never saved: No. 4119, 4120 and 4121.") >= 0 &&
        log.indexOf("03:01:40 Step 5: the tanks already read port 200 t, starboard 200 t. The pump stays off.") >= 0 &&
        t.stat("list") === "level",
        "States with fsync off: No. 4119 to 4121 were written but never saved; 3 plates are ahead of the log; states keep her level");

      // 10. No blip.
      t.set("crash", "none");
      t.click("end");
      t.expect(t.stat("done") === "03:01:20" && t.stat("list") === "level" && t.stat("lost") === 0,
        "With no blip the trim is done at 03:01:20, level");

      // 11. Live clock after a reset: valve 1 opens at 02:54:40.
      t.click("reset");
      await t.run(2);
      t.expect(t.node("v1").text.sub === "open" && t.node("v2").text.sub === "closed",
        "Running the clock: valve 1 opens at 02:54:40, valve 2 is still closed");
    }
  });
})();
