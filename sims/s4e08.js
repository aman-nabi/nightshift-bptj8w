/* sims/s4e08-v1.0.0.js  (published as sims/s4e08.js)
   Case s4e08 "The Letter That Never Left": an outbox lab for the evening notices at Saxelby
   Ruddock, a law firm in Ludgrave. When a fee earner marks a notice of claim served, the case
   system saves it in its PostgreSQL database and an event goes to the broker (RabbitMQ); the mail
   room service prints a letter for every event it receives, and at 23:00 Honora walks the printed
   letters to the late counter at the sorting office. The learner replays Tuesday evening from
   17:00 to 02:00 with five write modes, three broker outages, four relay intervals, the mail
   room's dedup by notice id, and a nightly check at 02:00.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: 20 notices at stated times; notice 14's save is refused by
     the database (the matter was closed at 20:30); modes commit then publish (as built), publish
     then commit, two-phase commit across both (as if the broker could join one), outbox with a
     polling relay, outbox with change data capture (Debezium); broker outage none, 18:02:00 to
     18:02:40 (that night) or 18:00 to 19:00; relay interval 1 s, 5 s, 1 min, 15 min; mail-room
     dedup by notice id; nightly check at 02:00; Skip to 02:00; Reset. Stats: notices saved as
     served, outbox rows, events published, letters printed, served with no letter in the 23:00
     run, letters for notices never saved, duplicate letters, saves refused with an error,
     letters after the deadline, Mrs Brindlecombe's letter. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - Notice n is marked served at TIMES[n - 1] (Tuesday evening). Notice 6 is Mrs Brindlecombe's,
     marked by Ms Fairweather at 18:02:10. Notice 14's save is refused by the database (its
     matter was closed at 20:30); nobody tries it again.
   - The broker is down from the outage's first second to its last (18:02:00 up to 18:02:40 that
     night). A publish in the very first second of the outage is in flight when the broker
     restarts: the broker has stored it, but its confirm is lost, so the sender sees a failure.
     Any other publish while it is down is refused.
   - The mail room prints a letter, in the same second, for every event the broker stores. With
     dedup on, it skips a notice id it has already printed. The 23:00 run takes every letter
     printed before 23:00:00; a letter printed later misses the deadline.
   - Commit, then publish: commit, then publish in the same second. A failed publish is written
     to the app log and never tried again.
   - Publish, then commit: publish first; if it fails, the save stops, the fee earner sees an
     error and saves again a minute later. If the publish succeeds and the database then refuses
     the commit, the letter has already gone.
   - Two-phase commit: the save goes through only if the database and the broker both prepare.
     While the broker is down it can't, so the save is refused with an error and the fee earner
     saves again a minute later. A refused commit aborts the publish too.
   - Outbox: the notice and an outbox row are committed in one transaction. The polling relay
     wakes every interval (on the clock from 17:00:00), publishes every outbox row committed
     before that second in order, and marks each sent once its confirm arrives. A refused publish
     leaves the row for the next poll. Change data capture reads each committed outbox row from
     the write-ahead log and publishes it one second after the commit; while the broker is down
     it waits and sends everything unconfirmed, in order, the second the broker is back.
   - Nightly check at 02:00: compares notices saved as served with letters printed, and sends
     an event for every served notice with no letter. Those letters miss the deadline.

   Where every number comes from (conventions rule 14; the case is content/s4/s4e08-v1.0.0.json):
   - 20 notices, 19 saved as served (notice 14 refused at 20:41:20).
   - As built (commit then publish, 18:02:00 to 18:02:40): notice 5 at 18:01:59 is published
     before the restart; notice 6 at 18:02:10 commits, its publish is refused, the error goes to
     the app log. Events 18, letters 18, served with no letter 1 (notice 6), errors 1 (notice 14),
     duplicates 0. Mrs Brindlecombe's letter: none. (The post: 19 served, 18 certificates.)
   - Publish then commit: notice 6 refused 18:02:10, saved again 18:03:10, printed 18:03:10;
     notice 14 published 20:41:20 and then refused: events 20, letters 20, never saved 1,
     errors 2, served with no letter 0.
   - Two-phase commit: events 19, letters 19, errors 2, Mrs Brindlecombe's printed 18:03:10.
   - Outbox, polling relay every 5 s: the 18:02:00 poll sends notice 5 (committed 18:01:59) in
     flight; at 18:02:40 the relay sends notices 5 and 6. Outbox rows 19, events 20, letters 20,
     duplicates 1 (notice 5), Mrs Brindlecombe's printed 18:02:40. With dedup: letters 19,
     duplicates 0. Every 1 s: the same. Every 1 min: notice 5 in flight at 18:02:00, then 5 and
     6 at 18:03:00. Every 15 min: notices 5 and 6 at 18:15:00, no duplicate; notice 20
     (22:52:30) waits for the 23:00:00 poll and misses the run: served with no letter 1,
     after the deadline 1.
   - Outbox, change data capture: notice 5 published 18:02:00 in flight; 5 and 6 sent at
     18:02:40: events 20, letters 20, duplicates 1; with dedup 19 and 0.
   - Nightly check on, as built: notice 6 sent at 02:00:00, printed after the deadline 1;
     Mrs Brindlecombe's "printed 02:00:00, after the deadline".
   - Outage 18:00 to 19:00, as built: notices 5, 6, 7, 8 lost: served with no letter 4.
     Publish then commit, and two-phase commit: notices 5 to 8 are refused and saved again every
     minute until the broker is back: 167 saves refused with an error, Mrs Brindlecombe's
     printed 19:00:10. Outbox modes: nothing lost, all 19 letters, no duplicate (no publish
     falls in the outage's first second); change data capture prints hers at 19:00:00.
   - No outage, as built: 19 letters, Mrs Brindlecombe's printed 18:02:10.
*/
(function () {
  "use strict";

  var START = 61200;          // 17:00:00
  var END = 32400;            // 02:00:00, seconds after 17:00
  var RUN = 21600;            // 23:00:00, the walk to the late counter
  var SPEED = 600;
  var RETRY = 60;
  var BRIND = 6;
  var REFUSED = 14;
  var TIMES = ["17:08:20", "17:21:45", "17:36:10", "17:49:30", "18:01:59", "18:02:10", "18:24:05",
    "18:47:40", "19:05:15", "19:31:50", "19:52:25", "20:10:00", "20:26:35", "20:41:20", "21:03:45",
    "21:22:10", "21:48:30", "22:09:05", "22:31:40", "22:52:30"];

  var MODES = [
    { value: "cp", label: "Commit, then publish (as built)" },
    { value: "pc", label: "Publish, then commit" },
    { value: "twopc", label: "Two-phase commit across both (if the broker could join one)" },
    { value: "relay", label: "Outbox, polling relay" },
    { value: "cdc", label: "Outbox, change data capture (Debezium)" }
  ];
  var MODE_SHORT = { cp: "commit, then publish", pc: "publish, then commit", twopc: "two-phase commit",
    relay: "outbox with a polling relay", cdc: "outbox with change data capture" };
  var OUTAGES = [
    { value: "none", label: "None" },
    { value: "night", label: "18:02:00 to 18:02:40 (that night)" },
    { value: "hour", label: "18:00 to 19:00 (an hour)" }
  ];
  var OUT_WIN = { none: null, night: [3720, 3760], hour: [3600, 7200] };
  var RELAYS = [
    { value: "1", label: "1 second" },
    { value: "5", label: "5 seconds" },
    { value: "60", label: "1 minute" },
    { value: "900", label: "15 minutes" }
  ];
  function isOutbox(C) { return C.mode === "relay" || C.mode === "cdc"; }

  var DIAGRAM = {
    type: "arch", w: 740, h: 340,
    aria: "Tuesday evening's notices. A fee earner marks a notice served in the case system. The case system commits it to the case database and publishes an event to the broker, or in the outbox modes writes an outbox row that a relay or change data capture publishes. The broker hands each event to the mail room, which prints a letter for the 23:00 run to the sorting office.",
    nodes: [
      { id: "fee", label: "Fee earners", sub: "0 marked served", x: 100, y: 80, w: 160, h: 64, shape: "box", tone: "" },
      { id: "app", label: "Case system", sub: "commit, then publish", x: 370, y: 80, w: 200, h: 72, shape: "box", tone: "" },
      { id: "broker", label: "Broker", sub: "RabbitMQ", meta: "up", x: 630, y: 80, w: 180, h: 72, shape: "box", tone: "ok" },
      { id: "mail", label: "Mail room", sub: "0 letters", meta: "dedup off", x: 100, y: 270, w: 160, h: 72, shape: "box", tone: "" },
      { id: "db", label: "Case database", sub: "0 served", meta: "outbox: not used", x: 370, y: 270, w: 200, h: 80, shape: "db", tone: "" },
      { id: "relay", label: "Relay", sub: "not used", x: 630, y: 270, w: 180, h: 64, shape: "box", tone: "muted" }
    ],
    edges: [
      { from: "fee", to: "app", label: "served" },
      { from: "app", to: "db", label: "commit" },
      { from: "app", to: "broker", label: "publish" },
      { from: "db", to: "relay", label: "outbox", dash: true },
      { from: "relay", to: "broker", label: "publish", dash: true },
      { from: "broker", to: "mail", label: "event", at: 0.25 }
    ]
  };

  /* ---------- helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock(sec) {
    var s = Math.floor(START + sec) % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }
  function secs(hms) {
    var p = hms.split(":");
    return Number(p[0]) * 3600 + Number(p[1]) * 60 + Number(p[2]) - START;
  }
  function who(n) { return n === BRIND ? "notice 6 (Mrs Brindlecombe)" : "notice " + n; }

  /* ---------- the evening, worked out in full (pure) ---------- */

  function evening(C) {
    var ev = [];
    function add(t, msg, tone, d) { ev.push({ t: t, k: ev.length, msg: msg, tone: tone || "", d: d || {} }); }
    var win = OUT_WIN[C.outage];
    function down(t) { return !!win && t >= win[0] && t < win[1]; }
    function inflight(t) { return !!win && t === win[0]; }
    var printed = {};
    var served = {};
    var outageLogged = false;

    // The mail room receives an event the broker has stored, in the same second.
    function deliver(t, n, extra) {
      var d = { pub: 1 };
      var msg = "Broker: event for " + who(n) + " stored" + (extra || "") + ".";
      if (C.dedup && printed[n]) {
        d.skip = 1;
        add(t, msg + " Mail room: notice " + n + " already printed, skipped.", "ok", d);
        return;
      }
      d.letter = n;
      if (printed[n]) d.dup = 1;
      if (t >= RUN) d.late = 1;
      if (n === BRIND && !printed[n]) d.b6 = "printed " + clock(t) + (t >= RUN ? ", after the deadline" : "");
      printed[n] = true;
      add(t, msg + " Mail room: letter printed for " + who(n) + (d.dup ? ", a second time." : ".") +
        (d.late ? " It misses the 23:00 run." : ""), d.dup || d.late ? "bad" : "", d);
    }
    // Returns "ok", "lost" (stored, confirm lost: the sender sees a failure) or "down".
    function publish(t, n) {
      if (inflight(t)) {
        deliver(t, n, " as the broker restarts; its confirm is lost");
        return "lost";
      }
      if (down(t)) return "down";
      deliver(t, n, "");
      return "ok";
    }
    function commit(t, n, outbox) {
      served[n] = t;
      add(t, who(n) + ": status served, COMMIT ok" + (outbox ? ", with its outbox row." : "."), "", outbox ? { row: n, out: 1 } : { row: n });
    }

    var N = TIMES.map(function (s, i) { return { n: i + 1, t: secs(s) }; });

    if (C.mode === "cp" || C.mode === "pc" || C.mode === "twopc") {
      var queue = N.map(function (x) { return { n: x.n, t: x.t }; });
      var guard = 0;
      while (queue.length && guard++ < 2000) {
        queue.sort(function (a, b) { return a.t - b.t || a.n - b.n; });
        var job = queue.shift();
        var t = job.t;
        var n = job.n;
        if (t >= END) break;
        if (C.mode === "cp") {
          if (n === REFUSED) { add(t, who(n) + ": the database refuses the save (matter closed at 20:30). Error shown; nothing published.", "warn", { err: 1 }); continue; }
          commit(t, n, false);
          var r = publish(t, n);
          if (r !== "ok") add(t, "Case system: publish for " + who(n) + " failed, connection refused. Error written to the app log. Nobody tries it again.", "bad");
          continue;
        }
        if (C.mode === "pc") {
          var p = publish(t, n);
          if (p !== "ok") {
            add(t, who(n) + ": publish failed, so the save stops. Error shown; the fee earner saves again at " + clock(t + RETRY) + ".", "warn", { err: 1 });
            queue.push({ n: n, t: t + RETRY });
            continue;
          }
          if (n === REFUSED) { add(t, who(n) + ": the database refuses the save (matter closed at 20:30). Error shown, but the event has already gone.", "bad", { err: 1, ghost: 1 }); continue; }
          commit(t, n, false);
          continue;
        }
        // two-phase commit
        if (n === REFUSED) { add(t, who(n) + ": the database can't prepare (matter closed at 20:30). Both abort; error shown.", "warn", { err: 1 }); continue; }
        if (down(t)) {
          add(t, who(n) + ": the broker can't prepare while it restarts. Both abort; error shown; the fee earner saves again at " + clock(t + RETRY) + ".", "warn", { err: 1 });
          queue.push({ n: n, t: t + RETRY });
          continue;
        }
        commit(t, n, false);
        publish(t, n);
      }
    } else {
      var rows = [];
      N.forEach(function (x) {
        if (x.n === REFUSED) { add(x.t, who(x.n) + ": the database refuses the save (matter closed at 20:30). No notice, no outbox row. Error shown.", "warn", { err: 1 }); return; }
        commit(x.t, x.n, true);
        rows.push({ n: x.n, c: x.t });
      });
      var pending = [];
      var i = 0;
      if (C.mode === "relay") {
        var I = C.relay;
        var tp = I;
        var g2 = 0;
        while (tp < END && g2++ < 40000) {
          while (i < rows.length && rows[i].c < tp) { pending.push(rows[i]); i += 1; }
          if (!pending.length) {
            if (i >= rows.length) break;
            tp = (Math.floor(rows[i].c / I) + 1) * I;
            continue;
          }
          if (inflight(tp)) {
            publish(tp, pending[0].n);
            add(tp, "Relay: no confirm for " + who(pending[0].n) + "; its outbox row stays unsent. " + pending.length + (pending.length === 1 ? " row waits." : " rows wait."), "warn");
            outageLogged = true;
          } else if (down(tp)) {
            if (!outageLogged) add(tp, "Relay: broker unreachable. " + pending.length + (pending.length === 1 ? " outbox row waits" : " outbox rows wait") + " for the next poll.", "warn");
            outageLogged = true;
          } else {
            pending.forEach(function (r) { publish(tp, r.n); });
            pending = [];
          }
          tp += I;
        }
      } else {
        // change data capture: one second after each commit, in commit order.
        var held = [];
        var flush = function () { held.forEach(function (h) { publish(win[1], h.n); }); held = []; };
        rows.forEach(function (r) {
          var tc = r.c + 1;
          if (held.length && tc >= win[1]) flush();
          if (inflight(tc)) {
            publish(tc, r.n);
            add(tc, "Debezium: no confirm for " + who(r.n) + "; it will send it again from its last confirmed position.", "warn");
            held.push(r);
          } else if (down(tc)) {
            if (!held.length) add(tc, "Debezium: broker unreachable; " + who(r.n) + " waits in the write-ahead log.", "warn");
            held.push(r);
          } else {
            publish(tc, r.n);
          }
        });
        if (held.length) flush();
      }
    }

    if (C.nightly) {
      var gaps = Object.keys(served).map(Number).filter(function (n) { return !printed[n]; });
      gaps.sort(function (a, b) { return a - b; });
      add(END, "Nightly check: " + gaps.length + " notice" + (gaps.length === 1 ? "" : "s") + " saved as served with no letter" +
        (gaps.length ? " (" + gaps.join(", ") + "). Sending again." : "."), gaps.length ? "warn" : "ok");
      gaps.forEach(function (n) { publish(END, n); });
    }
    ev.sort(function (a, b) { return (a.t - b.t) || (a.k - b.k); });
    return ev;
  }

  /* ---------- the replay ---------- */

  function zero() { return { row: 0, out: 0, pub: 0, letters: 0, dup: 0, ghost: 0, err: 0, late: 0, skip: 0, b6: "none yet", served: {}, first: {}, marked: 0 }; }

  function newEvening(api) {
    var S = api.state;
    S.ev = evening(S.C);
    S.i = 0;
    S.t = 0;
    S.done = false;
    S.ran = false;
    S.sum = zero();
  }

  function missing(x) {
    var m = 0;
    Object.keys(x.served).forEach(function (n) { if (!(x.first[n] < RUN)) m += 1; });
    return m;
  }

  function reveal(api, upTo) {
    var S = api.state;
    var x = S.sum;
    while (S.i < S.ev.length && S.ev[S.i].t <= upTo) {
      var e = S.ev[S.i];
      if (!S.ran && e.t >= RUN) runLine(api, RUN);
      S.i += 1;
      var d = e.d;
      ["out", "pub", "dup", "ghost", "err", "late", "skip"].forEach(function (k) { if (d[k]) x[k] += d[k]; });
      if (d.row) { x.row += 1; x.served[d.row] = e.t; }
      if (d.letter) { x.letters += 1; if (x.first[d.letter] === undefined) x.first[d.letter] = e.t; }
      if (d.b6) x.b6 = d.b6;
      api.clock = START + e.t;
      api.log(e.msg, e.tone);
    }
    if (!S.ran && upTo >= RUN) runLine(api, RUN);
  }

  function runLine(api, t) {
    var S = api.state;
    var x = S.sum;
    S.ran = true;
    var inRun = 0;
    Object.keys(x.first).forEach(function (n) { if (x.first[n] < RUN) inRun += 1; });
    api.clock = START + t;
    api.log("23:00. Honora walks " + (x.letters - x.late) + " letters to the late counter (" + inRun + " notices). Saved as served: " + x.row +
      ". Served with no letter: " + missing(x) + ".", missing(x) ? "bad" : "ok");
  }

  function finish(api) {
    var S = api.state;
    if (S.done) return;
    reveal(api, END);
    S.done = true;
    S.t = END;
    api.clock = START + END;
    api.speed = 0;
    var x = S.sum;
    if (x.b6 === "none yet") x.b6 = "no letter";
    api.log("02:00, end of the evening (" + MODE_SHORT[S.C.mode] + "). Saved as served: " + x.row + ". Events published: " + x.pub +
      ". Letters printed: " + x.letters + ". Served with no letter in the run: " + missing(x) + ". Letters for notices never saved: " + x.ghost +
      ". Duplicate letters: " + x.dup + ".", missing(x) || x.ghost || x.dup ? "bad" : "ok");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var x = S.sum;
    var marked = 0;
    TIMES.forEach(function (s) { if (secs(s) <= S.t) marked += 1; });
    api.node("fee").text("sub", marked + " marked served");
    var a = api.node("app");
    a.text("sub", isOutbox(C) ? "notice + outbox row" : C.mode === "pc" ? "publish, then commit" : C.mode === "twopc" ? "prepare both, commit" : "commit, then publish");
    a.set(x.err ? "warn" : "");
    var win = OUT_WIN[C.outage];
    var isDown = !!win && S.t >= win[0] && S.t < win[1];
    var b = api.node("broker");
    b.text("meta", isDown ? "restarting" : "up");
    b.set(isDown ? "bad" : "ok");
    var db = api.node("db");
    db.text("sub", x.row + " served");
    db.text("meta", isOutbox(C) ? "outbox: " + x.out + " rows" : "outbox: not used");
    var r = api.node("relay");
    r.text("label", C.mode === "cdc" ? "Debezium (CDC)" : "Relay");
    r.text("sub", C.mode === "relay" ? "polls every " + (C.relay >= 60 ? (C.relay / 60) + " min" : C.relay + " s") : C.mode === "cdc" ? "reads the WAL" : "not used");
    r.set(isOutbox(C) ? "ok" : "muted");
    var m = api.node("mail");
    m.text("sub", x.letters + (x.letters === 1 ? " letter" : " letters"));
    m.text("meta", C.dedup ? "dedup by notice id" : "dedup off");
    m.set(x.dup || x.ghost ? "bad" : missing(x) && S.t >= RUN ? "bad" : "");
    S.stat.row(x.row);
    S.stat.out(x.out);
    S.stat.pub(x.pub);
    S.stat.letters(x.letters);
    S.stat.missing(missing(x));
    S.stat.ghost(x.ghost);
    S.stat.dup(x.dup);
    S.stat.err(x.err);
    S.stat.late(x.late);
    S.stat.b6(x.b6);
  }

  function settingsLine(C) {
    var o = OUTAGES.filter(function (q) { return q.value === C.outage; })[0];
    return MODE_SHORT[C.mode] + "; broker outage: " + o.label.replace(" (that night)", "").replace(" (an hour)", "").toLowerCase() +
      (C.mode === "relay" ? "; relay every " + (C.relay >= 60 ? (C.relay / 60) + " min" : C.relay + " s") : "") +
      "; mail-room dedup " + (C.dedup ? "on" : "off") + "; nightly check " + (C.nightly ? "on" : "off") + ".";
  }

  function replay(api, why) {
    var S = api.state;
    newEvening(api);
    api.speed = SPEED;
    api.clock = START;
    api.log(why + " The evening starts again at 17:00. Now: " + settingsLine(S.C), "");
    draw(api);
  }

  var INFO = {
    fee: "<strong>Fee earners.</strong> The lawyers who mark a notice of claim served. 20 notices on Tuesday evening, from 17:08:20 to 22:52:30. Notice 6, Mrs Brindlecombe's, at 18:02:10.",
    app: "<strong>Case system.</strong> Saves each notice and gets an event to the broker. How it does the two is the write mode.",
    broker: "<strong>Broker.</strong> RabbitMQ. That night it restarted from 18:02:00 to 18:02:40. A publish in its first second is stored but never confirmed; any other publish while it is down is refused.",
    db: "<strong>Case database.</strong> PostgreSQL. In the outbox modes each notice and its outbox row are committed in one transaction. Notice 14's save is refused: its matter was closed at 20:30.",
    relay: "<strong>Relay.</strong> In the outbox modes, a polling relay reads unsent outbox rows every interval, or Debezium reads committed rows from the write-ahead log. Either sends until the broker confirms, so a row can go twice.",
    mail: "<strong>Mail room.</strong> Prints a letter for every event. At 23:00 Honora walks the letters printed before 23:00 to the late counter. With dedup on, it skips a notice id it has already printed."
  };

  /* ---------- the module ---------- */

  DL.sims.define("s4e08", {
    diagram: DIAGRAM,
    startClock: START,

    setup: function (api) {
      var S = api.state;
      S.C = { mode: "cp", outage: "night", relay: 5, dedup: false, nightly: false };
      api.speed = SPEED;
      S.ctl = {};
      S.ctl.mode = api.control.select("mode", "Write mode", MODES, "cp", function (v) {
        S.C.mode = String(v);
        replay(api, "Write mode: " + MODE_SHORT[S.C.mode] + ".");
      });
      S.ctl.outage = api.control.select("outage", "Broker outage", OUTAGES, "night", function (v) {
        S.C.outage = String(v);
        replay(api, "Broker outage changed.");
      });
      S.ctl.relay = api.control.select("relay", "Relay interval (polling relay)", RELAYS, "5", function (v) {
        S.C.relay = Number(v) || 5;
        replay(api, "Relay interval changed.");
      });
      S.ctl.dedup = api.control.toggle("dedup", "Mail room skips a notice id it has printed", false, function (on) {
        S.C.dedup = !!on;
        replay(api, "Mail-room dedup: " + (on ? "on." : "off."));
      });
      S.ctl.nightly = api.control.toggle("nightly", "Nightly check at 02:00 (served against printed, resend gaps)", false, function (on) {
        S.C.nightly = !!on;
        replay(api, "Nightly check: " + (on ? "on." : "off."));
      });
      S.ctl.skip = api.control.button("skip", "Skip to 02:00", function () { finish(api); draw(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        row: api.stat("row", "notices saved as served", ""),
        out: api.stat("out", "outbox rows", ""),
        pub: api.stat("pub", "events published", ""),
        letters: api.stat("letters", "letters printed", ""),
        missing: api.stat("missing", "served, no letter in the 23:00 run", "bad"),
        ghost: api.stat("ghost", "letters for notices never saved", "bad"),
        dup: api.stat("dup", "duplicate letters", "bad"),
        err: api.stat("err", "saves refused with an error", "warn"),
        late: api.stat("late", "letters after the deadline", "warn"),
        b6: api.stat("b6", "Mrs Brindlecombe's letter (notice 6)", "")
      };

      api.onNodeClick(function (id) { if (INFO[id]) api.info(INFO[id]); });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      newEvening(api);
      api.log("17:00. Nothing marked served yet. Settings: " + settingsLine(S.C), "");
      draw(api);
    },

    step: function (api, dt) {
      var S = api.state;
      if (!S.C || S.done) return;
      S.t += dt * api.speed;
      if (S.t >= END) { finish(api); draw(api); return; }
      reveal(api, Math.floor(S.t));
      api.clock = START + S.t;
      draw(api);
    },

    selfTest: async function (t) {
      function s(id) { return t.stat(id); }
      function has(x) { return t.logText().indexOf(x) >= 0; }
      function evening(mode) { t.set("mode", mode); t.click("skip"); }
      var a;

      // 1. Opening state: 17:00, before the first notice.
      t.expect(s("row") === 0 && s("pub") === 0 && s("letters") === 0 && s("missing") === 0 && s("ghost") === 0 &&
        s("dup") === 0 && s("err") === 0 && s("b6") === "none yet" && t.node("broker").text.meta === "up",
        "Opens at 17:00 with nothing marked served and nothing printed");

      // 2. The first notice: marked served at 17:08:20, letter printed in the same second.
      await t.run(1);                                     // 600 sim seconds: 17:10:00
      t.expect(s("row") === 1 && s("letters") === 1 && has("notice 1: status served, COMMIT ok.") &&
        has("Broker: event for notice 1 stored. Mail room: letter printed for notice 1."),
        "17:08:20: notice 1 saved and its letter printed");

      // 3. The story's evening: 19 served, 18 letters, Mrs Brindlecombe's never printed.
      t.click("skip");
      t.expect(s("row") === 19 && s("pub") === 18 && s("letters") === 18 && s("missing") === 1 && s("dup") === 0 &&
        s("err") === 1 && s("b6") === "no letter" &&
        has("notice 6 (Mrs Brindlecombe): status served, COMMIT ok.") &&
        has("Case system: publish for notice 6 (Mrs Brindlecombe) failed, connection refused. Error written to the app log. Nobody tries it again.") &&
        has("23:00. Honora walks 18 letters to the late counter (18 notices). Saved as served: 19. Served with no letter: 1."),
        "As built: 19 saved as served, 18 letters; notice 6's publish refused at 18:02:10 and never tried again");

      // 4. Publish, then commit: nothing lost, but a letter for a notice never saved.
      evening("pc");
      t.expect(s("row") === 19 && s("letters") === 20 && s("missing") === 0 && s("ghost") === 1 && s("err") === 2 &&
        s("b6") === "printed 18:03:10" &&
        has("notice 14: the database refuses the save (matter closed at 20:30). Error shown, but the event has already gone."),
        "Publish then commit: notice 6 saved again at 18:03:10; notice 14's letter printed for a save the database refused");

      // 5. Two-phase commit, if the broker could join one: right outcome, saves refused while it restarts.
      evening("twopc");
      t.expect(s("row") === 19 && s("pub") === 19 && s("letters") === 19 && s("ghost") === 0 && s("err") === 2 &&
        s("b6") === "printed 18:03:10" && has("notice 6 (Mrs Brindlecombe): the broker can't prepare while it restarts."),
        "Two-phase commit: 19 letters, but Ms Fairweather's save refused at 18:02:10 and done again at 18:03:10");

      // 6. Outbox with a polling relay every 5 s: nothing lost, one duplicate.
      evening("relay");
      t.expect(s("row") === 19 && s("out") === 19 && s("pub") === 20 && s("letters") === 20 && s("missing") === 0 &&
        s("dup") === 1 && s("b6") === "printed 18:02:40" &&
        has("Broker: event for notice 5 stored as the broker restarts; its confirm is lost.") &&
        has("Mail room: letter printed for notice 5, a second time."),
        "Outbox, relay every 5 s: 19 outbox rows, 20 events, notice 5 printed twice, Mrs Brindlecombe's at 18:02:40");

      // 7. Mail-room dedup by notice id removes the duplicate.
      t.set("dedup", true);
      t.click("skip");
      t.expect(s("letters") === 19 && s("dup") === 0 && s("pub") === 20 && has("Mail room: notice 5 already printed, skipped."),
        "Outbox with dedup: 20 events, 19 letters, the repeat of notice 5 skipped");

      // 8. Change data capture: the same outcome, read from the write-ahead log.
      t.set("dedup", false);
      evening("cdc");
      a = s("pub") === 20 && s("dup") === 1 && s("b6") === "printed 18:02:40" && s("missing") === 0;
      t.set("dedup", true);
      t.click("skip");
      t.expect(a && s("letters") === 19 && s("dup") === 0 && s("out") === 19,
        "CDC: 20 events and 1 duplicate without dedup, 19 letters with it");

      // 9. A 15-minute relay misses the run with the last notice.
      t.set("dedup", false);
      t.set("relay", "900");
      evening("relay");
      t.expect(s("dup") === 0 && s("missing") === 1 && s("late") === 1 && s("b6") === "printed 18:15:00" &&
        has("Mail room: letter printed for notice 20. It misses the 23:00 run."),
        "Relay every 15 min: notice 20 waits for the 23:00:00 poll and misses the run");
      t.set("relay", "5");

      // 10. The nightly check finds Mrs Brindlecombe's notice, after the deadline.
      t.set("nightly", true);
      evening("cp");
      t.expect(s("missing") === 1 && s("late") === 1 && s("letters") === 19 && s("b6") === "printed 02:00:00, after the deadline" &&
        has("Nightly check: 1 notice saved as served with no letter (6). Sending again."),
        "Nightly check at 02:00: notice 6 found and printed, after the midnight deadline");
      t.set("nightly", false);

      // 11. An hour's outage: four lost as built; the outbox loses none.
      t.set("outage", "hour");
      t.click("skip");
      a = s("missing") === 4 && s("letters") === 15;
      evening("relay");
      t.expect(a && s("missing") === 0 && s("letters") === 19 && s("dup") === 0,
        "Outage 18:00 to 19:00: as built 4 notices with no letter; the outbox sends all 19 when the broker is back");
    }
  });
})();
