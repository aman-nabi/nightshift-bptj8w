/* sims/s4e03-v1.0.0.js  (published as sims/s4e03.js)
   Case s4e03 "Dead Letters": a queue lab for the Haverleigh address-correction centre, the
   undeliverable room. Sorting machines that can't read an address send a scan of the envelope to
   a queue (Amazon SQS, standard queue); a correction service with 4 workers receives each scan,
   corrects it and deletes it. One scan, #0412 for 14 1/2 Wychbold Lane, Abernook, makes the
   parser throw, and nothing catches it, so every worker that receives it crashes. The learner
   replays the night from 22:00 to 06:00 with a redrive policy (maxReceiveCount off, 3 or 5),
   catching the crash, the visibility timeout, delete on receive, the number of workers, a person
   watching the queue, a second bad scan at 03:00 and a patch restart at 01:00, and can fix the
   parser and redrive the dead-letter queue at 06:00.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: 30-second ticks from 22:00 to 06:00 (960 ticks); 15 scans a
     tick; 6 worker-seconds a scan; a crash costs a worker 40 s; controls for maxReceiveCount,
     catch the crash, visibility timeout (30 s, 2 min, 12 h), delete on receive, workers (1 to 8),
     Ifeoma watching, a second bad scan at 03:00, a patch restart at 01:00, Skip to 06:00, Fix the
     parser and redrive, Reset. Stats: bad receives, worker crashes, scans waiting, corrected, in
     the dead-letter queue, lost, hidden, alarm. selfTest: 12 assertions.

   The model (stated in sim.lede):
   - Tick k (k = 0 to 959) starts at 22:00 + 30k seconds. In each tick, in this order:
     1. 15 good scans arrive (30 a minute, 14,400 over the night).
     2. Good scans hidden by a crash or restart whose visibility timeout has ended come back.
     3. If Ifeoma watches: at 22:30, 23:00 and every half hour to 02:00, she pulls out any bad
        scan received 5 or more times and keys it by hand.
     4. If the patch restart is on, at 01:00 every worker goes down for 40 s, and each worker that
        was up holds one good scan it has received and not deleted. Those scans are hidden for the
        visibility timeout (or lost, with delete on receive).
     5. Each bad scan that is visible: if a redrive policy is set and it has been received
        maxReceiveCount times, SQS moves it to the dead-letter queue (and the alarm on that queue
        rings at once; a real CloudWatch alarm takes a minute or more). Otherwise the lowest-numbered
        worker that is up receives it, and it is hidden for the visibility timeout. With catch off
        the worker crashes and is down for 40 s. With delete on receive the scan is gone.
     6. The workers' up-seconds in the tick are pooled (plus any part-scan left over) and spent on
        good scans, 6 s each, oldest first.
   - The exact 30-second cadence is the sim's simplification: in a real standard queue with a
     backlog the bad scan competes with the good ones for each receive, so it comes round about
     every 30 s, not exactly.

   Where every number comes from (conventions rule 14; the case is content/s4/s4e03-v1.0.0.json):
   - The story night (4 workers, 30 s timeout, no redrive policy, no catch): #0412 is received at
     22:00:00 and every 30 s to 05:59:30: 960 receives, 960 crashes. A crash takes 40 s, so in each
     tick one worker is down all 30 s and another for 10 s: 80 of 120 worker-seconds, 13.3 scans
     against 15 arriving. Waiting on the hour: 199 (23:00), 399, 599, 799, 999, 1,199, 1,399, and
     1,599 at 06:00; 12,801 of 14,400 corrected. After 22:01:00: 3 receives, 4 waiting.
   - maxReceiveCount 5 with catch on (the ok option): 5 receives (22:00:00 to 22:02:00), 0 crashes,
     moved to the dead-letter queue at 22:02:30, the alarm rings at 22:02:30, 14,400 corrected,
     none waiting. Redrive after the fix: 14,401 corrected. maxReceiveCount 5 with catch off: 5
     crashes. maxReceiveCount 3: 3 receives, moved at 22:01:30.
   - Catch on alone: 960 receives, 0 crashes, 0 waiting, never moved, nobody told.
   - Delete on receive: 1 receive, 1 crash, 1 lost. With the patch restart: 4 more, 5 lost, 14,396
     corrected.
   - 12 hours: 1 receive, 1 crash, #0412 hidden until 10:00. With the patch restart the 4 held scans
     are hidden until 13:00: 5 hidden past 06:00, 14,396 corrected.
   - 2 minutes: 240 receives, 240 crashes, nothing waits.
   - Ifeoma watching: she pulls #0412 at 22:30 after 60 receives (60 crashes). With the second bad
     scan, #0977 at 03:00: 360 more receives after she has gone, 420 in all, 599 waiting at 06:00.
   - Workers: 2 give 11,199 waiting at 06:00; 8 give none, with 960 receives still.
*/
(function () {
  "use strict";

  var START = 79200;          // 22:00:00
  var TICK = 30;
  var TICKS = 960;
  var END = TICKS * TICK;     // 06:00:00
  var ARRIVE = 15;
  var WORK = 6;
  var DOWN = 40;
  var RESTART_AT = 10800;     // 01:00
  var SECOND_AT = 18000;      // 03:00
  var WATCH_EVERY = 1800;
  var WATCH_UNTIL = 14400;    // 02:00
  var WATCH_MIN = 5;
  var SPEED = 600;
  var EPS = 1e-6;
  var HALF = "½";
  var ADDR = "14" + HALF + " Wychbold Lane";

  var VT_OPTS = [
    { value: "30", label: "30 seconds (the default, as now)" },
    { value: "120", label: "2 minutes" },
    { value: "43200", label: "12 hours (the maximum)" }
  ];
  var MRC_OPTS = [
    { value: "0", label: "Off (as now)" },
    { value: "3", label: "3 receives" },
    { value: "5", label: "5 receives" }
  ];

  var DIAGRAM = {
    type: "arch", w: 740, h: 330,
    aria: "The correction service. Scans go to the correction queue. Workers receive them, correct them and delete them, and the corrected address goes back to the sorter. A redrive policy can move a scan received too many times to the dead-letter queue, and an alarm watches that queue's depth.",
    nodes: [
      { id: "scans", label: "Scans", sub: "15 every 30 s", meta: "0 arrived", x: 100, y: 80, w: 150, h: 64, shape: "box", tone: "" },
      { id: "queue", label: "Correction queue", sub: "0 waiting", meta: "bad receives: 0", x: 340, y: 80, w: 180, h: 72, shape: "box", tone: "" },
      { id: "workers", label: "Workers", sub: "4 of 4 up", meta: "0 crashes", x: 600, y: 80, w: 180, h: 72, shape: "box", tone: "ok" },
      { id: "alarm", label: "Alarm (on DLQ)", sub: "no DLQ to watch", x: 100, y: 250, w: 150, h: 64, shape: "box", tone: "muted" },
      { id: "dlq", label: "Dead-letter queue", sub: "off", meta: "no redrive policy", x: 340, y: 250, w: 180, h: 72, shape: "db", tone: "muted" },
      { id: "sorter", label: "Back to the sorter", sub: "0 corrected", x: 600, y: 250, w: 180, h: 64, shape: "box", tone: "" }
    ],
    edges: [
      { from: "scans", to: "queue", label: "send" },
      { from: "queue", to: "workers", label: "receive" },
      { from: "workers", to: "sorter", label: "delete" },
      { from: "queue", to: "dlq", label: "redrive policy", dash: true },
      { from: "dlq", to: "alarm", label: "depth", dash: true }
    ]
  };

  /* ---------- helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock(sec) {
    var s = Math.floor(START + sec) % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }
  function plural(n, one, many) { return n === 1 ? one : many; }
  function vtWords(v) { return v === 30 ? "30 s" : v === 120 ? "2 min" : "12 hours"; }

  /* ---------- the night ---------- */

  function newNight(S) {
    var C = S.C;
    S.k = 0;
    S.t = 0;
    S.done = false;
    S.w = [];
    for (var i = 0; i < C.workers; i++) S.w.push({ down: -1, took: -1 });
    S.bad = [{ id: "#0412", at: 0, vis: 0, rec: 0, state: "queue" }];
    if (C.second) S.bad.push({ id: "#0977", at: SECOND_AT, vis: SECOND_AT, rec: 0, state: "queue" });
    S.arrived = 0;
    S.waiting = 0;
    S.carry = 0;
    S.corrected = 0;
    S.receives = 0;
    S.crashes = 0;
    S.dlq = 0;
    S.lost = 0;
    S.pools = [];
    S.alarm = null;
  }

  function at(api, sec) { api.clock = START + sec; }

  function receiveBad(api, S, b, T) {
    var C = S.C;
    if (C.mrc && b.rec >= C.mrc) {
      b.state = "dlq";
      S.dlq += 1;
      api.log(b.id + " has been received " + b.rec + " times, the maxReceiveCount in the redrive policy, so SQS moves it to the dead-letter queue.", "warn");
      if (S.alarm === null) {
        S.alarm = T;
        api.log("Alarm: the dead-letter queue holds 1 scan. Adaeze is paged at " + clock(T) + ".", "ok");
      }
      return;
    }
    var wi = -1;
    for (var i = 0; i < S.w.length; i++) {
      if (S.w[i].down <= T && S.w[i].took !== T) { wi = i; break; }
    }
    if (wi < 0) return;
    S.w[wi].took = T;
    b.rec += 1;
    S.receives += 1;
    b.vis = T + C.vt;
    var who = "worker-" + (wi + 1);
    var head = who + " receives " + b.id + " (" + ADDR + ")";
    if (C.del) {
      b.state = "lost";
      S.lost += 1;
    }
    if (!C.catch) {
      S.w[wi].down = T + DOWN;
      S.crashes += 1;
    }
    var tail;
    if (C.del) {
      tail = C.catch ? ", deletes it at once, and catches the parser's error on " + HALF + ". The scan is gone: no queue holds it now."
        : " and deletes it at once. The parser throws on " + HALF + ", nothing catches it, and " + who + " crashes. The scan is gone: no queue holds it now.";
      api.log(head + tail, "bad");
      return;
    }
    if (b.rec > 3) return;
    tail = C.catch ? ". The parser throws on " + HALF + "; the worker catches it, logs it and takes the next scan."
      : ". The parser throws on " + HALF + ", nothing catches it, and " + who + " crashes; it is back in 40 s.";
    tail += " The scan is hidden until " + clock(b.vis) + ".";
    if (b.rec === 3) tail += " From here it comes round every " + vtWords(C.vt) + ".";
    api.log(head + tail, C.catch ? "warn" : "bad");
  }

  function tickOnce(api) {
    var S = api.state;
    var C = S.C;
    var T = S.k * TICK;
    at(api, T);
    S.waiting += ARRIVE;
    S.arrived += ARRIVE;
    S.pools = S.pools.filter(function (p) {
      if (p.back <= T) { S.waiting += p.n; return false; }
      return true;
    });
    if (C.watch && T > 0 && T % WATCH_EVERY === 0 && T <= WATCH_UNTIL) {
      S.bad.forEach(function (b) {
        if (b.state === "queue" && b.at <= T && b.rec >= WATCH_MIN) {
          b.state = "hand";
          api.log("Ifeoma's check: " + b.id + " has been received " + b.rec + " times. She pulls it out of the queue and keys the address by hand.", "ok");
        }
      });
      if (T === WATCH_UNTIL) api.log("02:00: Ifeoma's shift ends. Nobody watches the queue now.", "");
    }
    if (C.restart && T === RESTART_AT) {
      var up = 0;
      S.w.forEach(function (x) { if (x.down <= T) up += 1; x.down = Math.max(x.down, T + DOWN); });
      var held = Math.min(up, S.waiting);
      S.waiting -= held;
      if (C.del) {
        S.lost += held;
        api.log("Patch restart: every worker goes down for 40 s. The " + held + " scans they held were deleted when received, so they are lost.", "bad");
      } else {
        S.pools.push({ n: held, back: T + C.vt });
        api.log("Patch restart: every worker goes down for 40 s. The " + held + " scans they held were never deleted, so they are hidden until " + clock(T + C.vt) + ".", C.vt > 120 ? "bad" : "");
      }
    }
    S.bad.forEach(function (b) {
      if (b.state === "queue" && b.at <= T && b.vis <= T) receiveBad(api, S, b, T);
    });
    var cap = 0;
    S.w.forEach(function (x) { cap += TICK - Math.max(0, Math.min(TICK, x.down - T)); });
    var pool = cap + S.carry;
    var can = Math.floor(pool / WORK);
    if (can >= S.waiting) {
      S.corrected += S.waiting;
      S.waiting = 0;
      S.carry = 0;
    } else {
      S.corrected += can;
      S.waiting -= can;
      S.carry = pool - can * WORK;
    }
    S.k += 1;
    if (S.k % 120 === 0 && S.k < TICKS) {
      at(api, S.k * TICK);
      api.log("On the hour: " + fmt(S.waiting) + " scans waiting; bad scans received " + fmt(S.receives) + " times; " + fmt(S.crashes) + " worker " + plural(S.crashes, "crash", "crashes") + ".", S.waiting ? "warn" : "");
    }
  }

  function hiddenNow(S, now) {
    var h = 0;
    S.pools.forEach(function (p) { if (p.back > now) h += p.n; });
    S.bad.forEach(function (b) { if (b.state === "queue" && b.at <= now && b.vis > now) h += 1; });
    return h;
  }

  function finish(api) {
    var S = api.state;
    if (S.done) return;
    S.done = true;
    S.t = END;
    at(api, END);
    api.speed = 0;
    var back = S.bad.filter(function (b) { return b.state === "queue" && b.vis > END; });
    api.log("06:00, end of the night. " + fmt(S.arrived) + " scans arrived and " + fmt(S.corrected) + " were corrected; " +
      fmt(S.waiting) + " waiting. Bad scans received " + fmt(S.receives) + " times, " + fmt(S.crashes) + " worker " +
      plural(S.crashes, "crash", "crashes") + ". In the dead-letter queue: " + S.dlq + ". Lost: " + S.lost +
      ". Hidden past 06:00: " + hiddenNow(S, END) + "." +
      (back.length ? " " + back[0].id + " comes back at " + clock(back[0].vis) + ", undelivered." : ""),
      S.waiting || S.lost ? "bad" : "");
  }

  function runTo(api, due) {
    var S = api.state;
    var guard = 0;
    while (S.k < due && S.k < TICKS && guard < TICKS + 1) { tickOnce(api); guard += 1; }
  }

  /* ---------- drawing ---------- */

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var now = Math.min(S.t, END);
    var up = 0;
    S.w.forEach(function (x) { if (x.down <= now) up += 1; });
    var q = api.node("queue");
    q.text("sub", fmt(S.waiting) + " waiting");
    q.text("meta", "bad receives: " + fmt(S.receives));
    q.set(S.waiting > 100 ? "bad" : S.waiting ? "warn" : "ok");
    var wk = api.node("workers");
    wk.text("sub", up + " of " + S.w.length + " up");
    wk.text("meta", fmt(S.crashes) + plural(S.crashes, " crash", " crashes"));
    wk.set(up === S.w.length ? "ok" : up ? "warn" : "bad");
    api.node("scans").text("meta", fmt(S.arrived) + " arrived");
    var so = api.node("sorter");
    so.text("sub", fmt(S.corrected) + " corrected");
    so.set(S.lost ? "bad" : "ok");
    var d = api.node("dlq");
    var al = api.node("alarm");
    if (C.mrc) {
      d.text("sub", S.dlq + " held");
      d.text("meta", "after " + C.mrc + " receives");
      d.set(S.dlq ? "warn" : "ok");
      al.text("sub", S.alarm === null ? "quiet" : "rang " + clock(S.alarm));
      al.set(S.alarm === null ? "ok" : "warn");
    } else {
      d.text("sub", "off");
      d.text("meta", "no redrive policy");
      d.set("muted");
      al.text("sub", "no DLQ to watch");
      al.set("muted");
    }
    S.stat.received(fmt(S.receives));
    S.stat.crashes(fmt(S.crashes));
    S.stat.waiting(fmt(S.waiting));
    S.stat.corrected(fmt(S.corrected));
    S.stat.dlq(fmt(S.dlq));
    S.stat.lost(fmt(S.lost));
    S.stat.hidden(fmt(hiddenNow(S, now)));
    S.stat.alarm(!C.mrc ? "no dead-letter queue" : S.alarm === null ? "quiet" : "rang at " + clock(S.alarm));
  }

  /* ---------- settings ---------- */

  function settingsLine(C) {
    return "maxReceiveCount " + (C.mrc ? C.mrc : "off") + ", catch the crash " + (C.catch ? "on" : "off") +
      ", visibility timeout " + vtWords(C.vt) + ", delete on receive " + (C.del ? "on" : "off") + ", " + C.workers +
      plural(C.workers, " worker", " workers") + (C.watch ? ", Ifeoma watching until 02:00" : "") +
      (C.second ? ", a second bad scan at 03:00" : "") + (C.restart ? ", a patch restart at 01:00" : "") + ".";
  }

  function replay(api, why) {
    var S = api.state;
    newNight(S);
    api.speed = SPEED;
    at(api, 0);
    api.log(why + " The night starts again at 22:00. Now: " + settingsLine(S.C), "");
    draw(api);
  }

  /* ---------- what is this box ---------- */

  var INFO = {
    scans: "<strong>Scans.</strong> When a sorting machine can't read an address, it holds the envelope and sends a photo of it, a scan, to the correction queue. 15 arrive every 30 seconds, all night: 14,400 from 22:00 to 06:00.",
    queue: "<strong>Correction queue.</strong> An Amazon SQS standard queue. A worker receives a scan; SQS hides it for the visibility timeout. If the worker deletes it in time, it is gone for good. If not, it becomes visible again and the next worker receives it. SQS counts every receive.",
    workers: "<strong>Workers.</strong> Each receives one scan at a time, reads it again, matches it against the address file (6 seconds), sends the answer to the sorter and deletes the scan. A worker that crashes is restarted, which takes 40 seconds.",
    sorter: "<strong>Back to the sorter.</strong> The corrected address goes back to the sorting machine, which finds the held envelope by its ID and sends it on.",
    dlq: "<strong>Dead-letter queue.</strong> A second queue. With a redrive policy, SQS moves a scan here once it has been received maxReceiveCount times, so it stops coming round. Nothing works on it until a person looks, fixes the cause and redrives it.",
    alarm: "<strong>Alarm.</strong> A CloudWatch alarm on the dead-letter queue's depth (ApproximateNumberOfMessagesVisible), set to ring at 1. The sim rings it the moment a scan lands; a real alarm takes a minute or more."
  };

  /* ---------- the module ---------- */

  DL.sims.define("s4e03", {
    diagram: DIAGRAM,
    startClock: START,

    setup: function (api) {
      var S = api.state;
      S.C = { workers: 4, vt: 30, mrc: 0, catch: false, del: false, watch: false, second: false, restart: false };
      api.speed = SPEED;
      S.ctl = {};
      S.ctl.mrc = api.control.select("mrc", "Redrive policy: maxReceiveCount", MRC_OPTS, "0", function (v) {
        S.C.mrc = Number(v) || 0;
        replay(api, "maxReceiveCount: " + (S.C.mrc ? S.C.mrc : "off") + ".");
      });
      S.ctl.catchCtl = api.control.toggle("catch", "Catch the crash in the worker", false, function (on) {
        S.C.catch = !!on;
        replay(api, "Catch the crash: " + (on ? "on." : "off."));
      });
      S.ctl.vt = api.control.select("vt", "Visibility timeout", VT_OPTS, "30", function (v) {
        S.C.vt = Number(v) || 30;
        replay(api, "Visibility timeout: " + vtWords(S.C.vt) + ".");
      });
      S.ctl.del = api.control.toggle("del", "Delete each scan as soon as it is received", false, function (on) {
        S.C.del = !!on;
        replay(api, "Delete on receive: " + (on ? "on." : "off."));
      });
      S.ctl.workers = api.control.range("workers", "Workers", 1, 8, 1, 4, function (v) {
        var x = Math.max(1, Math.min(8, Math.round(Number(v))));
        if (!isFinite(x) || x === S.C.workers) return;
        S.C.workers = x;
        replay(api, "Workers: " + x + ".");
      });
      S.ctl.watch = api.control.toggle("watch", "Ifeoma watches the queue until 02:00 and pulls any scan received 5 times", false, function (on) {
        S.C.watch = !!on;
        replay(api, "Ifeoma watching: " + (on ? "on." : "off."));
      });
      S.ctl.second = api.control.toggle("second", "A second bad scan for the same address at 03:00", false, function (on) {
        S.C.second = !!on;
        replay(api, "Second bad scan at 03:00: " + (on ? "on." : "off."));
      });
      S.ctl.restart = api.control.toggle("restart", "A patch restart at 01:00 (every worker down 40 s)", false, function (on) {
        S.C.restart = !!on;
        replay(api, "Patch restart at 01:00: " + (on ? "on." : "off."));
      });
      S.ctl.skip = api.control.button("skip", "Skip to 06:00", function () {
        runTo(api, TICKS);
        finish(api);
        draw(api);
      });
      S.ctl.redrive = api.control.button("redrive", "Fix the parser and redrive", function () {
        if (!S.done) { runTo(api, TICKS); finish(api); }
        if (!S.dlq) {
          api.log("Nothing in the dead-letter queue to redrive." + (S.C.mrc ? "" : " There is no dead-letter queue: set a redrive policy."), "warn");
          draw(api);
          return;
        }
        var n = S.dlq;
        api.log("Ulfric fixes the parser so it reads " + HALF + ", then redrives the dead-letter queue: " + n + plural(n, " scan goes", " scans go") +
          " back to the correction queue as new messages, receive count 0. Each is received once, corrected and deleted. Delivered: " + ADDR + ".", "ok");
        S.corrected += n;
        S.dlq = 0;
        draw(api);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        received: api.stat("received", "times a bad scan was received", "bad"),
        crashes: api.stat("crashes", "worker crashes", "bad"),
        waiting: api.stat("waiting", "scans waiting", "warn"),
        corrected: api.stat("corrected", "scans corrected", "ok"),
        dlq: api.stat("dlq", "in the dead-letter queue", "warn"),
        lost: api.stat("lost", "scans lost", "bad"),
        hidden: api.stat("hidden", "received, not deleted, hidden now", ""),
        alarm: api.stat("alarm", "alarm on the dead-letter queue", "")
      };

      api.onNodeClick(function (id) { if (INFO[id]) api.info(INFO[id]); });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      newNight(S);
      api.log("22:00. Four workers up, nothing waiting. Settings: " + settingsLine(S.C), "");
      draw(api);
    },

    step: function (api, dt) {
      var S = api.state;
      if (!S.C || S.done) return;
      S.t += dt * api.speed;
      var due = Math.min(TICKS, Math.floor(S.t / TICK + EPS) + 1);
      runTo(api, due);
      if (S.k >= TICKS && S.t >= END - EPS) finish(api);
      at(api, Math.min(S.t, END));
      draw(api);
    },

    selfTest: async function (t) {
      function s(id) { return t.stat(id); }
      function has(x) { return t.logText().indexOf(x) >= 0; }
      var a;

      // 1. Opening state: 22:00, before the first scan.
      t.expect(s("received") === 0 && s("crashes") === 0 && s("waiting") === 0 && s("corrected") === 0 && s("dlq") === 0 &&
        s("lost") === 0 && s("hidden") === 0 && s("alarm") === "no dead-letter queue" &&
        t.node("workers").text.sub === "4 of 4 up" && t.node("dlq").text.sub === "off",
        "Opens at 22:00 with four workers up, nothing received and no dead-letter queue");

      // 2. The first minute: the bad scan comes round every 30 s and takes a worker down each time.
      await t.run(0.1);                                  // 60 sim seconds: ticks 22:00:00, 22:00:30, 22:01:00
      t.expect(s("received") === 3 && s("crashes") === 3 && s("waiting") === 4 &&
        has("worker-1 receives #0412 (" + ADDR + "). The parser throws on " + HALF + ", nothing catches it, and worker-1 crashes; it is back in 40 s. The scan is hidden until 22:00:30.") &&
        has("worker-2 receives #0412 (" + ADDR + ")") && has("From here it comes round every 30 s."),
        "22:00 to 22:01: #0412 received 3 times, 3 crashes, 4 scans waiting");

      // 3. The story's night.
      t.click("skip");
      t.expect(s("received") === 960 && s("crashes") === 960 && s("waiting") === "1,599" && s("corrected") === "12,801" &&
        s("dlq") === 0 && s("lost") === 0 && s("hidden") === 0 &&
        has("On the hour: 199 scans waiting; bad scans received 120 times; 120 worker crashes.") &&
        has("On the hour: 1,399 scans waiting; bad scans received 840 times; 840 worker crashes.") &&
        has("06:00, end of the night. 14,400 scans arrived and 12,801 were corrected; 1,599 waiting. Bad scans received 960 times, 960 worker crashes."),
        "The story: 960 receives, 960 crashes, 199 waiting at 23:00 and 1,599 at 06:00");

      // 4. The ok option: maxReceiveCount 5, catch the crash, alarm on the DLQ.
      t.click("reset");
      t.set("mrc", "5");
      t.set("catch", true);
      t.click("skip");
      t.expect(s("received") === 5 && s("crashes") === 0 && s("dlq") === 1 && s("waiting") === 0 && s("corrected") === "14,400" &&
        s("alarm") === "rang at 22:02:30" && t.node("dlq").text.sub === "1 held" &&
        has("#0412 has been received 5 times, the maxReceiveCount in the redrive policy, so SQS moves it to the dead-letter queue.") &&
        has("Alarm: the dead-letter queue holds 1 scan. Adaeze is paged at 22:02:30."),
        "maxReceiveCount 5 and catch: 5 receives, no crash, parked at 22:02:30, alarm at 22:02:30, 14,400 corrected");

      // 5. Fix the parser and redrive.
      t.click("redrive");
      t.expect(s("dlq") === 0 && s("corrected") === "14,401" && has("back to the correction queue as new messages, receive count 0") &&
        has("Delivered: " + ADDR + "."),
        "Redrive after the fix: the scan goes back as a new message and is corrected");

      // 6. A redrive policy without the catch still parks it, after 5 crashes (3 with maxReceiveCount 3).
      t.set("catch", false);
      t.click("skip");
      a = s("crashes") === 5 && s("dlq") === 1 && s("received") === 5;
      t.set("mrc", "3");
      t.click("skip");
      t.expect(a && s("crashes") === 3 && s("received") === 3 && s("alarm") === "rang at 22:01:30",
        "maxReceiveCount without catch: 5 crashes then parked; with 3, parked at 22:01:30 after 3");

      // 7. Catching alone: no crashes, but it comes round all night and nobody is told.
      t.click("reset");
      t.set("catch", true);
      t.click("skip");
      t.expect(s("received") === 960 && s("crashes") === 0 && s("waiting") === 0 && s("dlq") === 0 && s("alarm") === "no dead-letter queue",
        "Catch alone: 960 receives, no crash, no backlog, never set aside");

      // 8. Delete on receive: the scan is lost; with the patch restart, 4 more.
      t.click("reset");
      t.set("del", true);
      t.click("skip");
      a = s("lost") === 1 && s("received") === 1 && s("crashes") === 1 && has("The scan is gone: no queue holds it now.");
      t.set("restart", true);
      t.click("skip");
      t.expect(a && s("lost") === 5 && s("corrected") === "14,396" &&
        has("Patch restart: every worker goes down for 40 s. The 4 scans they held were deleted when received, so they are lost."),
        "Delete on receive: 1 lost; with the 01:00 restart, 5 lost and 14,396 corrected");

      // 9. A 12-hour visibility timeout: one crash, then hidden until 10:00; held scans hidden until 13:00.
      t.click("reset");
      t.set("vt", "43200");
      t.click("skip");
      a = s("received") === 1 && s("crashes") === 1 && s("hidden") === 1 && s("waiting") === 0 &&
        has("The scan is hidden until 10:00:00.") && has("#0412 comes back at 10:00:00, undelivered.");
      t.set("restart", true);
      t.click("skip");
      t.expect(a && s("hidden") === 5 && s("corrected") === "14,396" && has("so they are hidden until 13:00:00."),
        "12 hours: 1 receive, hidden until 10:00; with the restart, 5 hidden past 06:00");

      // 10. Ifeoma watching: one letter, then a second at 03:00 after she has gone.
      t.click("reset");
      t.set("watch", true);
      t.click("skip");
      a = s("received") === 60 && s("crashes") === 60 && s("waiting") === 0 &&
        has("Ifeoma's check: #0412 has been received 60 times. She pulls it out of the queue and keys the address by hand.");
      t.set("second", true);
      t.click("skip");
      t.expect(a && s("received") === 420 && s("crashes") === 420 && s("waiting") === 599 &&
        has("worker-1 receives #0977 (" + ADDR + ")"),
        "Watching: #0412 pulled at 22:30 after 60; #0977 at 03:00 makes 420 receives and 599 waiting");

      // 11. Workers: two fall far behind, eight hide the problem.
      t.click("reset");
      t.set("workers", 2);
      t.click("skip");
      a = s("waiting") === "11,199" && s("received") === 960;
      t.set("workers", 8);
      t.click("skip");
      t.expect(a && s("waiting") === 0 && s("received") === 960 && s("crashes") === 960,
        "2 workers: 11,199 waiting; 8 workers: none waiting, still 960 receives and crashes");

      // 12. A 2-minute visibility timeout only slows the knocking.
      t.click("reset");
      t.set("vt", "120");
      t.click("skip");
      t.expect(s("received") === 240 && s("crashes") === 240 && s("waiting") === 0 && s("dlq") === 0,
        "2 minutes: 240 receives and crashes, and it is still never set aside");
    }
  });
})();
