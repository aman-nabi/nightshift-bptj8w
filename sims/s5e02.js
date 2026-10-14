/* sims/s5e02-v1.0.0.js  (published as sims/s5e02.js)
   Case s5e02 "The Deadlock in Room 4": a lock lab for the Pomfret Hotel's key-card server, one
   Java program in which each room and each guest record is guarded by a lock (synchronized).
   Two jobs, two locks and the card reader at room 4's door, replayed from 02:59:58 to 15:00:00.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: the order each job takes its locks (as built, or one order
     for every job), the start offset between housekeeping and checkout, lock timeouts (2 s, then
     retry from the start), a watchdog restart (10 minutes in progress), housekeeping at 03:00 or
     14:00, jump to a moment, speed, reset. Shows each job's held and wanted lock as a small
     wait-for graph, the card taps at room 4, and the four conditions lit when they hold.
     Stats: stuck now, deadlocks so far, conditions holding, taps opened, taps refused, jobs
     done, jobs lost, retries. selfTest: 10 assertions.

   The model (stated in sim.lede):
   - Time moves in tenths of a second from 03:00:00.0. The replay opens at 02:59:58, before the
     first event, and ends at 15:00:00.
   - Housekeeping starts at 03:00:00.0 (or 14:00:00.0). Checkout starts at 03:00:00.0 plus the
     offset (story 0.4 s). A room change at the desk starts at 14:00:00.3.
   - Each job takes its first lock, works 1.0 s, asks for its second lock, works 1.0 s with
     both, then lets both go. As built: housekeeping room 4 then guest; checkout and the room
     change guest then room 4. With "one order", every job takes room 4 first.
   - A lock has one holder. Whoever asks for a held lock waits in a line; when it is let go,
     the first in line gets it (arrival order).
   - Every card tap at room 4 needs room 4's lock for a moment. The reader waits at most 5 s,
     then shows red and leaves the line. Every card in this replay is valid (a checked-out
     guest's card opens her door until 12:00).
   - Lock timeouts on: a job that has waited 2.0 s gives up, lets go of what it holds, and
     starts again from its first lock at once. No random pause.
   - Watchdog on: when a job has been in progress for 10 minutes, the server restarts at once.
     A restart clears every lock; a job in progress is lost, and a waiting tap is refused.
   - At 06:45:00 Dumitru restarts the server if any job is still in progress.
   - A deadlock is a cycle: a job waits for a lock held by a job that is waiting for it.

   Where every number comes from (conventions rule 14; the case is content/s5/s5e02-v1.0.0.json).
   All of these come out of the model above and are checked by the selfTest.
   - As built, offset 0.4 s: housekeeping takes room 4 at 03:00:00.0; checkout takes the guest
     at 03:00:00.4; housekeeping asks for the guest at 03:00:01.0 and waits; checkout asks for
     room 4 at 03:00:01.4 and waits: deadlock at 03:00:01.4, 4 of the 4 conditions.
   - The guest's card at 03:06:00.0 is refused at 03:06:05.0; the manager's master card at
     03:06:40.0 is refused at 03:06:45.0. Restart at 06:45:00.0: 2 jobs lost.
   - One order: checkout waits for room 4 from 03:00:00.4 to 03:00:02.0; housekeeping done at
     03:00:02.0, checkout at 03:00:04.0; both taps open at once. No deadlock.
   - Timeouts, offset 0.4: housekeeping gives up at 03:00:03.0, checkout gets room 4 and is done
     at 03:00:04.0, housekeeping again done at 03:00:06.0. 1 deadlock, 1 retry.
   - Timeouts, offset 0.0: both give up together every 3.0 s and start again together. Each
     tap waits for the next give-up: the guest's card opens at 03:06:03.0, the manager's at
     03:06:42.0. Neither job is ever done; at 06:45:00.0 Dumitru restarts it, with
     4,500 deadlocks and 8,998 retries counted (4,499 give-ups each; the restart comes first at
     06:45:00.0, the moment of the 4,500th).
   - Watchdog: the deadlock at 03:00:01.4 stands until 03:10:00.0; both taps are refused; both
     jobs are lost.
   - Housekeeping at 14:00: checkout alone is done at 03:00:02.4 and the taps open; at 14:00 the
     room change takes the guest at 14:00:00.3 and asks for room 4 at 14:00:01.3: deadlock. The
     new guest's card at 14:05:00.0 is refused at 14:05:05.0; at 15:00 both jobs are still in
     progress.
   - Offset 1.2 s, as built: housekeeping has both locks before checkout starts; housekeeping
     done 03:00:02.0, checkout 03:00:04.2. No deadlock.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var T0 = 10800;            // 03:00:00 in seconds
  var START = -20;           // 02:59:58, in tenths of a second from 03:00:00.0
  var END = 432000;          // 15:00:00
  var WORK = 10;             // 1.0 s of work after each lock
  var TRY = 20;              // lock timeout, 2.0 s
  var TAPWAIT = 50;          // the reader waits 5.0 s
  var WATCH = 6000;          // watchdog: 10 minutes in progress
  var MORNING = 135000;      // 06:45:00
  var HK_LATE = 396000;      // 14:00:00.0
  var RC_AT = 396003;        // 14:00:00.3
  var LOG_REPEATS = 2;

  var TAPS = [
    { who: "The guest's card", at: 3600 },          // 03:06:00.0
    { who: "The manager's master card", at: 4000 }, // 03:06:40.0
    { who: "The new guest's card", at: 396000 + 3000 } // 14:05:00.0
  ];

  var OFFSETS = [0, 4, 8, 12, 20];
  var JUMPS = [
    { value: -20, label: "02:59:58 (the start)" },
    { value: 14, label: "03:00:01.4" },
    { value: 60, label: "03:00:06.0" },
    { value: 3650, label: "03:06:05.0" },
    { value: 4050, label: "03:06:45.0" },
    { value: 6000, label: "03:10:00.0" },
    { value: 135000, label: "06:45:00.0" },
    { value: 396013, label: "14:00:01.3" },
    { value: 399050, label: "14:05:05.0" },
    { value: 432000, label: "15:00:00.0 (the end)" }
  ];
  var SPEEDS = [1, 10, 60, 600];

  /* ---------- helpers ---------- */

  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function hms(ds) {
    var tenths = ((ds % 10) + 10) % 10;
    var s = Math.floor((T0 * 10 + ds) / 10);
    return pad(Math.floor(s / 3600) % 24) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60) + "." + tenths;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function lockName(L) { return L === "R" ? "room 4's lock" : "the guest's lock"; }

  /* ---------- the model ---------- */

  function makeNight(C, say) {
    var N = {
      C: C, now: START, say: say,
      locks: { R: { holder: null, queue: [] }, G: { holder: null, queue: [] } },
      jobs: [], taps: [],
      deadlocks: 0, stuckSince: null, retries: 0, done: 0, lost: 0, opened: 0, refused: 0,
      seen: {}
    };
    var other = C.order === "one" ? ["R", "G"] : ["G", "R"];
    N.jobs.push({ id: "hk", name: "Housekeeping", start: C.hk === "1400" ? HK_LATE : 0, order: ["R", "G"] });
    N.jobs.push({ id: "co", name: "Checkout", start: C.offset, order: other });
    N.jobs.push({ id: "rc", name: "The room change", start: RC_AT, order: other });
    N.jobs.forEach(function (j) { j.phase = "pending"; j.k = 0; j.held = []; j.since = null; j.waitSince = null; j.end = null; });
    TAPS.forEach(function (t) { N.taps.push({ who: t.who, at: t.at, phase: "pending", waitSince: null, when: null }); });
    return N;
  }

  // Log a repeating kind of event only its first few times.
  function note(N, key, msg, tone) {
    var n = N.seen[key] = (N.seen[key] || 0) + 1;
    if (n <= LOG_REPEATS) N.say(N.now, msg + " (" + hms(N.now) + ").", tone);
    else if (n === LOG_REPEATS + 1 && !N.quietNoted) {
      N.quietNoted = true;
      N.say(N.now, "From here the same steps repeat; the stats keep count (" + hms(N.now) + ").", "warn");
    }
  }

  function startWork(N, j, L) {
    j.held.push(L);
    j.phase = "work";
    j.end = N.now + WORK;
  }

  function release(N, L) {
    var lk = N.locks[L];
    lk.holder = null;
    while (lk.queue.length) {
      var w = lk.queue.shift();
      if (w.at !== undefined) {           // a card tap: open, and let go at once
        w.phase = "open";
        w.when = N.now;
        N.opened += 1;
        note(N, "open-late", w.who + " at room 4 gets the lock after " + ((N.now - w.waitSince) / 10).toFixed(1) + " s: the door opens", "ok");
        continue;
      }
      lk.holder = w;
      note(N, "got-" + w.id, w.name + " gets " + lockName(L) + " after waiting " + ((N.now - w.waitSince) / 10).toFixed(1) + " s", "");
      startWork(N, w, L);
      return;
    }
  }

  function inProgress(j) { return j.phase !== "pending" && j.phase !== "done" && j.phase !== "lost"; }

  function restart(N, who) {
    var n = 0;
    N.jobs.forEach(function (j) {
      if (inProgress(j)) { j.phase = "lost"; j.held = []; n += 1; }
    });
    N.lost += n;
    N.taps.forEach(function (t) {
      if (t.phase === "waiting") { t.phase = "refused"; t.when = N.now; N.refused += 1; }
    });
    N.locks.R = { holder: null, queue: [] };
    N.locks.G = { holder: null, queue: [] };
    N.say(N.now, who + " restarts the server. Every lock is cleared; " + n + (n === 1 ? " job" : " jobs") +
      " in progress " + (n === 1 ? "is" : "are") + " lost (" + hms(N.now) + ").", "bad");
  }

  function ask(N, j) {
    var L = j.order[j.k];
    var lk = N.locks[L];
    if (lk.holder === null) {
      lk.holder = j;
      note(N, "take-" + j.id + j.k, j.name + " takes " + lockName(L), "");
      startWork(N, j, L);
    } else {
      lk.queue.push(j);
      j.phase = "want";
      j.waitSince = N.now;
      note(N, "wait-" + j.id + j.k, j.name + " asks for " + lockName(L) + ", held by " + lk.holder.name.toLowerCase() + ", and waits", "warn");
    }
  }

  function waitsFor(N, j) {
    if (j.phase !== "want") return null;
    var h = N.locks[j.order[j.k]].holder;
    return h && h.at === undefined ? h : null;
  }

  function cycle(N) {
    for (var i = 0; i < N.jobs.length; i++) {
      var a = N.jobs[i];
      var b = waitsFor(N, a);
      var steps = 0;
      while (b && steps < N.jobs.length) {
        if (b === a) return true;
        b = waitsFor(N, b);
        steps += 1;
      }
    }
    return false;
  }

  function tick(N) {
    var now = N.now;
    var C = N.C;
    var i;
    // a) restarts
    var stuckJob = N.jobs.some(function (j) { return inProgress(j) && C.watchdog && now - j.since >= WATCH; });
    if (stuckJob) restart(N, "The watchdog");
    else if (now === MORNING && N.jobs.some(inProgress)) restart(N, "Dumitru");
    // b) timeouts: everyone due gives up together, then the locks are let go
    var quit = [];
    N.jobs.forEach(function (j) { if (C.timeouts && j.phase === "want" && now - j.waitSince >= TRY) quit.push(j); });
    N.taps.forEach(function (t) { if (t.phase === "waiting" && now - t.waitSince >= TAPWAIT) quit.push(t); });
    quit.forEach(function (x) {
      ["R", "G"].forEach(function (L) {
        var q = N.locks[L].queue;
        var k = q.indexOf(x);
        if (k >= 0) q.splice(k, 1);
      });
    });
    quit.forEach(function (x) {
      if (x.at !== undefined) {
        x.phase = "refused";
        x.when = now;
        N.refused += 1;
        N.say(now, x.who + " at room 4: no answer in 5 s, the door shows red (" + hms(now) + ").", "bad");
        return;
      }
      N.retries += 1;
      note(N, "quit-" + x.id, x.name + " waited 2.0 s, lets go of " + (x.held.length ? lockName(x.held[0]) : "nothing") + " and starts again", "warn");
      var held = x.held;
      x.held = [];
      x.phase = "retry";
      held.forEach(function (L) { release(N, L); });
    });
    // c) work that ends now
    N.jobs.forEach(function (j) {
      if (j.phase !== "work" || j.end !== now) return;
      if (j.k === 0) { j.k = 1; j.phase = "ask"; return; }
      var held = j.held;
      j.held = [];
      j.phase = "done";
      N.done += 1;
      N.say(now, j.name + " is done and lets go of both locks (" + hms(now) + ").", "ok");
      for (i = held.length - 1; i >= 0; i--) release(N, held[i]);
    });
    // d) starts, retries and requests, in job order; then card taps
    N.jobs.forEach(function (j) {
      if (j.phase === "pending" && j.start === now) { j.phase = "ask"; j.k = 0; j.since = now; }
      if (j.phase === "retry") { j.phase = "ask"; j.k = 0; }
      if (j.phase === "ask") ask(N, j);
    });
    N.taps.forEach(function (t) {
      if (t.phase !== "pending" || t.at !== now) return;
      var lk = N.locks.R;
      if (lk.holder === null) {
        t.phase = "open";
        t.when = now;
        N.opened += 1;
        N.say(now, t.who + " at room 4: the lock is free, the door opens (" + hms(now) + ").", "ok");
      } else {
        t.phase = "waiting";
        t.waitSince = now;
        lk.queue.push(t);
        N.say(now, t.who + " at room 4 asks for room 4's lock, held by " + lk.holder.name.toLowerCase() + ", and waits (" + hms(now) + ").", "warn");
      }
    });
    // e) a cycle in the wait-for graph is a deadlock
    var c = cycle(N);
    if (c && N.stuckSince === null) {
      N.deadlocks += 1;
      N.stuckSince = now;
      note(N, "deadlock", "Deadlock: each job waits for a lock the other holds", "bad");
    } else if (!c && N.stuckSince !== null) {
      N.stuckSince = null;
    }
  }

  function advance(N, to) {
    if (to > END) to = END;
    while (N.now < to) {
      N.now += 1;
      if (N.now >= 0) tick(N);
    }
  }

  function conditions(N) {
    var hw = N.jobs.some(function (j) { return j.phase === "want" && j.held.length > 0; });
    return [true, hw, !N.C.timeouts, cycle(N)];
  }

  /* ---------- drawing ---------- */

  var DIAGRAM = {
    type: "arch", w: 760, h: 420,
    nodes: [
      { id: "hk", label: "Housekeeping job", sub: "not started", x: 110, y: 70, w: 190, h: 62, shape: "box" },
      { id: "glock", label: "Guest's lock", sub: "free", x: 400, y: 70, w: 200, h: 62, shape: "box" },
      { id: "co", label: "Checkout kiosk job", sub: "not started", x: 400, y: 220, w: 190, h: 62, shape: "box" },
      { id: "rlock", label: "Room 4's lock", sub: "free", x: 110, y: 220, w: 200, h: 62, shape: "box" },
      { id: "reader", label: "Room 4's door reader", sub: "no taps yet", x: 110, y: 360, w: 190, h: 62, shape: "box" },
      { id: "c1", label: "Mutual exclusion", sub: "one holder per lock", x: 655, y: 60, w: 190, h: 52, shape: "box" },
      { id: "c2", label: "Hold and wait", sub: "holds one, wants one", x: 655, y: 150, w: 190, h: 52, shape: "box" },
      { id: "c3", label: "No preemption", sub: "waits forever", x: 655, y: 240, w: 190, h: 52, shape: "box" },
      { id: "c4", label: "Circular wait", sub: "a closed loop", x: 655, y: 330, w: 190, h: 52, shape: "box" }
    ],
    edges: [
      { from: "hk", to: "glock", label: "wants", dash: true, tone: "muted" },
      { from: "glock", to: "co", label: "held by", dash: true, tone: "muted" },
      { from: "co", to: "rlock", label: "wants", dash: true, tone: "muted" },
      { from: "rlock", to: "hk", label: "held by", dash: true, tone: "muted" },
      { from: "reader", to: "rlock", label: "wants", dash: true, tone: "muted" }
    ]
  };

  function jobText(N, j) {
    if (j.phase === "pending") return ["not started", ""];
    if (j.phase === "done") return ["done", ""];
    if (j.phase === "lost") return ["lost at the restart", ""];
    var holds = j.held.length ? "holds " + j.held.map(function (L) { return L === "R" ? "room 4" : "guest"; }).join(" and ") : "holds nothing";
    var wants = j.phase === "want" ? "wants " + (j.order[j.k] === "R" ? "room 4" : "guest") + ", waiting" : "working";
    return [holds, wants];
  }

  function draw(api) {
    var S = api.state;
    var N = S.N;
    var cyc = cycle(N);
    var showRc = N.now >= RC_AT;
    var jobs = { hk: N.jobs[0], co: showRc ? N.jobs[2] : N.jobs[1] };
    ["hk", "co"].forEach(function (id) {
      var j = jobs[id];
      var tx = jobText(N, j);
      var st = "muted";
      if (j.phase === "want") st = cyc ? "bad" : "warn";
      else if (j.phase === "work" || j.phase === "ask" || j.phase === "retry") st = "accent";
      else if (j.phase === "done") st = "ok";
      else if (j.phase === "lost") st = "zombie";
      var nd = api.node(id);
      if (id === "co") nd.text("label", showRc ? "Room change job" : "Checkout kiosk job");
      nd.text("sub", tx[0]);
      nd.text("meta", tx[1]);
      nd.set(st);
    });
    [["rlock", "R"], ["glock", "G"]].forEach(function (p) {
      var lk = N.locks[p[1]];
      var nd = api.node(p[0]);
      nd.text("sub", lk.holder ? "held by " + lk.holder.name.toLowerCase() : "free");
      nd.text("meta", lk.queue.length ? "waiting: " + lk.queue.map(function (w) { return w.at !== undefined ? "tap" : w.name.replace("The ", "").toLowerCase(); }).join(", ") : "");
      nd.set(lk.holder ? (cyc ? "bad" : "warn") : "ok");
    });
    var last = null;
    N.taps.forEach(function (t) { if (t.phase !== "pending") last = t; });
    var rd = api.node("reader");
    if (!last) { rd.text("sub", "no taps yet"); rd.text("meta", "waits up to 5 s"); rd.set("muted"); }
    else {
      rd.text("sub", last.phase === "waiting" ? "waiting, up to 5 s" : (last.phase === "open" ? "opened " : "refused ") + hms(last.when));
      rd.text("meta", last.who.replace("The ", ""));
      rd.set(last.phase === "open" ? "ok" : (last.phase === "refused" ? "bad" : "warn"));
    }
    var cond = conditions(N);
    var lit = 0;
    cond.forEach(function (on, k) { if (on) lit += 1; api.node("c" + (k + 1)).set(on ? "bad" : "muted"); });
    var inprog = N.jobs.filter(inProgress).length;
    S.stat.stuck(N.stuckSince === null ? "no" : "since " + hms(N.stuckSince));
    S.stat.deadlocks(fmt(N.deadlocks));
    S.stat.conditions(lit);
    S.stat.opened(N.opened);
    S.stat.refused(N.refused);
    S.stat.done(N.done);
    S.stat.inprog(inprog);
    S.stat.lost(N.lost);
    S.stat.retries(fmt(N.retries));
  }

  /* ---------- running the replay ---------- */

  function toDs(clock) { return Math.floor((clock - T0) * 10 + 1e-6); }

  function fresh(api, why) {
    var S = api.state;
    S.ended = false;
    S.N = makeNight(S.C, function (ds, msg, tone) {
      api.clock = T0 + ds / 10;
      api.log(msg, tone);
    });
    api.clock = T0 + START / 10;
    if (S.ctl && S.ctl.speed) api.speed = Number(S.ctl.speed.value);
    if (S.ctl && S.ctl.jump) S.ctl.jump.set(START);
    if (why) api.log(why, "");
    draw(api);
  }

  function goTo(api, ds) {
    var S = api.state;
    if (ds < S.N.now) fresh(api, "Back to 02:59:58 to replay from the start.");
    advance(S.N, ds);
    api.clock = T0 + Math.min(ds, END) / 10;
    if (ds >= END && !S.ended) {
      S.ended = true;
      api.speed = 0;
      api.log("The replay ends at 15:00:00. Jobs still in progress: " + S.N.jobs.filter(inProgress).length + ".", "");
    }
    if (S.ctl && S.ctl.jump) S.ctl.jump.set(ds);
    draw(api);
  }

  function describe(C) {
    return (C.order === "one" ? "one order for every job (room 4, then the guest)" : "locks taken as built") +
      ", checkout " + (C.offset / 10).toFixed(1) + " s after housekeeping" +
      (C.timeouts ? ", lock timeouts of 2 s" : "") + (C.watchdog ? ", the watchdog on" : "") +
      ", housekeeping at " + (C.hk === "1400" ? "14:00" : "03:00");
  }

  DL.sims.define("s5e02", {
    diagram: DIAGRAM,
    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.C = { order: "built", offset: 4, timeouts: false, watchdog: false, hk: "0300" };
      S.stat = {
        stuck: api.stat("stuck", "deadlocked now", "bad"),
        deadlocks: api.stat("deadlocks", "deadlocks so far", "bad"),
        conditions: api.stat("conditions", "of the four conditions hold", "warn"),
        opened: api.stat("opened", "card taps opened", "ok"),
        refused: api.stat("refused", "card taps refused", "bad"),
        done: api.stat("done", "jobs done", "ok"),
        inprog: api.stat("inprog", "jobs in progress", ""),
        lost: api.stat("lost", "jobs lost to a restart", "bad"),
        retries: api.stat("retries", "retries after a timeout", "warn")
      };
      function changed(what) { fresh(api, what + " Replaying from 02:59:58 with " + describe(S.C) + "."); }
      S.ctl = {};
      S.ctl.order = api.control.select("order", "Order each job takes its locks", [
        { value: "built", label: "As built: checkout takes the guest, then room 4" },
        { value: "one", label: "One order: room 4, then the guest, for every job" }
      ], "built", function (v) { S.C.order = String(v); changed("Lock order changed."); });
      S.ctl.offset = api.control.select("offset", "Checkout starts after housekeeping by",
        OFFSETS.map(function (o) { return { value: o, label: (o / 10).toFixed(1) + " s" }; }), 4,
        function (v) { S.C.offset = Number(v); changed("Start offset changed."); });
      S.ctl.timeouts = api.control.toggle("timeouts", "Lock timeouts: give up after 2 s, retry from the start", false,
        function (on) { S.C.timeouts = !!on; changed("Lock timeouts " + (on ? "on." : "off.")); });
      S.ctl.watchdog = api.control.toggle("watchdog", "Watchdog: restart when a job is in progress for 10 minutes", false,
        function (on) { S.C.watchdog = !!on; changed("Watchdog " + (on ? "on." : "off.")); });
      S.ctl.hk = api.control.select("hk", "Housekeeping job runs at", [
        { value: "0300", label: "03:00" }, { value: "1400", label: "14:00" }
      ], "0300", function (v) { S.C.hk = String(v); changed("Housekeeping moved to " + (v === "1400" ? "14:00." : "03:00.")); });
      S.ctl.jump = api.control.select("jump", "Jump to", JUMPS, -20, function (v) { goTo(api, Number(v)); });
      S.ctl.speed = api.control.select("speed", "Clock speed",
        SPEEDS.map(function (s) { return { value: s, label: s + " x" }; }), 1,
        function (v) { if (!S.ended) api.speed = Number(v); });
      api.control.button("reset", "Reset", function () { api.reset(); });
      api.info("<strong>How to read it.</strong> Each job box says which lock it holds and which it wants. " +
        "The dashed arrows are the loop the code allows as built: housekeeping wants the guest's lock, held by checkout, " +
        "which wants room 4's lock, held by housekeeping. The four boxes on the right light up while each condition for a deadlock holds. " +
        "Every card tap at the door needs room 4's lock for a moment.");
      fresh(api, "02:59:58. Housekeeping is due at 03:00:00.0, checkout at 03:00:00.4.");
    },

    step: function (api) {
      var S = api.state;
      if (!S.N || S.ended) return;
      var ds = toDs(api.clock);
      if (ds > S.N.now) {
        var keep = api.clock;
        advance(S.N, ds);
        api.clock = keep;
        if (ds >= END) goTo(api, END); else draw(api);
      }
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }

      // 1. Opens at 02:59:58, before the first event.
      t.expect(t.stat("stuck") === "no" && t.stat("deadlocks") === 0 && t.stat("conditions") === 2 &&
        t.stat("opened") === 0 && t.stat("refused") === 0 && t.stat("done") === 0 && t.stat("inprog") === 0 &&
        t.node("hk").state === "muted" && t.node("rlock").text.sub === "free" && Math.round(t.api.clock) === 10798,
        "Opens at 02:59:58 with nothing held: 2 of 4 conditions (the code's own), no deadlock");

      // 2. Play the first seconds: the deadlock forms at 03:00:01.4.
      begin();
      await t.run(4);
      t.expect(has("Housekeeping takes room 4's lock (03:00:00.0).") && has("Checkout takes the guest's lock (03:00:00.4).") &&
        has("Housekeeping asks for the guest's lock, held by checkout, and waits (03:00:01.0).") &&
        has("Checkout asks for room 4's lock, held by housekeeping, and waits (03:00:01.4).") &&
        t.stat("stuck") === "since 03:00:01.4" && t.stat("conditions") === 4 && t.stat("deadlocks") === 1 &&
        t.node("hk").state === "bad" && t.node("c4").state === "bad" && t.node("rlock").text.sub === "held by housekeeping",
        "As built, 0.4 s apart: deadlock at 03:00:01.4 with all four conditions lit");

      // 3. The taps at 03:06 are refused.
      begin();
      t.set("jump", 4050);
      t.expect(has("The guest's card at room 4: no answer in 5 s, the door shows red (03:06:05.0).") &&
        has("The manager's master card at room 4: no answer in 5 s, the door shows red (03:06:45.0).") &&
        t.stat("refused") === 2 && t.stat("opened") === 0 && t.stat("inprog") === 2,
        "The guest's card and the master card both go red after 5 s");

      // 4. Dumitru restarts it at 06:45: both jobs lost.
      begin();
      t.set("jump", 135000);
      t.expect(has("Dumitru restarts the server. Every lock is cleared; 2 jobs in progress are lost (06:45:00.0).") &&
        t.stat("lost") === 2 && t.stat("done") === 0 && t.stat("stuck") === "no",
        "In progress until 06:45:00, then a restart and 2 jobs lost");

      // 5. One order for every job: no loop is possible.
      t.set("order", "one");
      begin();
      t.set("jump", 4050);
      t.expect(has("Checkout asks for room 4's lock, held by housekeeping, and waits (03:00:00.4).") &&
        has("Housekeeping is done and lets go of both locks (03:00:02.0).") && has("Checkout is done and lets go of both locks (03:00:04.0).") &&
        t.stat("deadlocks") === 0 && t.stat("done") === 2 && t.stat("opened") === 2 && t.stat("refused") === 0,
        "One order: checkout waits 1.6 s, both done by 03:00:04.0, both cards open");

      // 6. Timeouts, 0.4 s apart: broken after 2 s, one retry.
      t.set("order", "built");
      t.set("timeouts", true);
      begin();
      t.set("jump", 4050);
      t.expect(has("Housekeeping waited 2.0 s, lets go of room 4's lock and starts again (03:00:03.0).") &&
        has("Checkout is done and lets go of both locks (03:00:04.0).") && has("Housekeeping is done and lets go of both locks (03:00:06.0).") &&
        t.stat("deadlocks") === 1 && t.stat("retries") === 1 && t.stat("done") === 2 && t.stat("opened") === 2,
        "Timeouts at 0.4 s apart: housekeeping gives up at 03:00:03.0; both done by 03:00:06.0");

      // 7. Timeouts, started together: they retry in step and never finish.
      t.set("offset", 0);
      begin();
      t.set("jump", 4050);
      var lockstep = has("The guest's card at room 4 gets the lock after 3.0 s: the door opens (03:06:03.0).") &&
        has("The manager's master card at room 4 gets the lock after 2.0 s: the door opens (03:06:42.0).") &&
        t.stat("done") === 0 && t.stat("opened") === 2;
      t.set("jump", 135000);
      t.expect(lockstep && t.stat("deadlocks") === "4,500" && t.stat("retries") === "8,998" && t.stat("lost") === 2,
        "Timeouts, started together: they give up and collide every 3.0 s until 06:45, 4,500 deadlocks, 8,998 retries");

      // 8. Watchdog: the doors stay shut until 03:10.
      t.set("timeouts", false);
      t.set("offset", 4);
      t.set("watchdog", true);
      begin();
      t.set("jump", 6000);
      t.expect(has("The watchdog restarts the server. Every lock is cleared; 2 jobs in progress are lost (03:10:00.0).") &&
        t.stat("refused") === 2 && t.stat("lost") === 2 && t.stat("done") === 0,
        "Watchdog: both taps refused, then a restart at 03:10:00.0 loses both jobs");

      // 9. Housekeeping at 14:00: quiet night, then the room change meets it.
      t.set("watchdog", false);
      t.set("hk", "1400");
      begin();
      t.set("jump", 4050);
      var night = has("Checkout is done and lets go of both locks (03:00:02.4).") && t.stat("opened") === 2 && t.stat("deadlocks") === 0;
      t.set("jump", 432000);
      t.expect(night && has("The room change asks for room 4's lock, held by housekeeping, and waits (14:00:01.3).") &&
        has("The new guest's card at room 4: no answer in 5 s, the door shows red (14:05:05.0).") &&
        t.stat("stuck") === "since 14:00:01.3" && t.stat("inprog") === 2 && t.stat("refused") === 1 &&
        t.node("co").text.label === "Room change job",
        "Housekeeping at 14:00: the night is quiet, but the room change deadlocks at 14:00:01.3 and is stuck at 15:00");

      // 10. Far enough apart, the as-built order gets lucky.
      t.set("hk", "0300");
      t.set("offset", 12);
      begin();
      t.set("jump", 60);
      t.expect(has("Housekeeping is done and lets go of both locks (03:00:02.0).") && has("Checkout is done and lets go of both locks (03:00:04.0).") &&
        t.stat("deadlocks") === 0 && t.stat("done") === 2,
        "Checkout 1.2 s later, as built: no deadlock; the window is under 1.0 s");
    }
  });
})();
