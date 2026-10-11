/* sims/s4e06-v1.0.0.js  (published as sims/s4e06.js)
   Case s4e06 "At Least Once": a delivery lab for Thorncastle Pharmacy's night deliveries in
   Ebbsworth. When a courier taps "arrived" in the couriers' app, a message goes on the arrivals
   queue (Amazon SQS, standard queue, visibility timeout 6 minutes). One notifier receives each
   message, sends the customer a text (SMS), "Your courier is at your door", then deletes the
   message. The learner replays the night from 22:00 to 06:00 with five delivery modes, three
   visibility timeouts, the night's crash points on or off, one extra crash between the send and
   the record, and three lengths of time for keeping the ids of messages already handled.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: 40 deliveries at stated times; 5 stated crash points;
     modes at most once (delete first), at least once (as now), at least once with dedup by
     message id, FIFO queue (one message group), FIFO with dedup (the cold case), couriers phone
     instead; visibility timeout 2, 6
     or 12 minutes; crash points on or off; a crash between the send and the record at 05:05;
     ids kept 5 minutes, 1 hour or 4 days; Skip to 06:00; Reset. Stats: texts sent, notices
     sent twice, notices lost, notices more than a minute late, held behind a crashed notice,
     redeliveries skipped, phone calls, Mrs Wenlock's texts. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - 40 deliveries; delivery n's "arrived" tap is at ARRIVALS[n - 1] minutes after 22:00, and
     its message goes on the queue at that second. Each message has its own message id.
   - One notifier takes one message at a time. A receive at second T sends the text at T + 1,
     and the delete (and, with dedup, the record of the id) happens in the same second, T + 1.
   - Crash points apply to a message's first receive only. "before": the notifier crashes after
     receiving, before the text goes out (deliveries 7 at 23:05 and 33 at 04:30). "after": it
     crashes after the text and before the delete (deliveries 14 at 00:20, 19 at 01:40, 26 at
     03:12); with dedup the record is written in the same second as the send, so "after" also
     falls after the record. "gap" (control, off by default): delivery 36 at 05:05 crashes
     between the send and the record. A crashed notifier is back 20 seconds later.
   - A message received and not deleted becomes visible again at receive + visibility timeout.
   - At most once: delete at receive, then send. A crash before the send loses the notice.
   - Dedup: on receive, if the id was recorded less than the keep time ago, skip the text and
     delete the message. Records live in a table outside the notifier, so a crash keeps them.
   - FIFO: all arrivals share one message group, so while a received message is hidden no later
     message in the queue can be received (SQS FIFO behaviour); the send-side deduplication
     (5-minute interval) has nothing to catch here, because each tap is sent once.
   - Phone: the courier phones from the door; no queue, no texts, one call per delivery.
   - Late: a notice whose first text goes out more than 60 s after the tap. Held: a FIFO
     message first received more than 30 s after its tap.

   Where every number comes from (conventions rule 14; the case is content/s4/s4e06-v1.0.0.json):
   - As that night (at least once, 6 min, crashes on): texts 43 (40 + the 3 "after" crashes),
     notices sent twice 3 (00:20, 01:40, 03:12), lost 0, late 2 (23:05 sent 23:11:01, 04:30 sent
     04:36:01). Delivery 19, Mrs Wenlock: texts at 01:40:01 and 01:46:01; notifier back 01:40:21;
     visible again 01:46:00.
   - At most once: texts 38, lost 2 (23:05, 04:30), twice 0.
   - Dedup, ids kept 4 days (the queue's default retention period): texts 40, twice 0, skipped 3,
     late 2. Kept 1 hour: the same. Kept 5 minutes: the record of 01:40:01 expires 01:45:01,
     before the 01:46:00 redelivery: texts 43, twice 3. Kept 5 minutes with a 2-minute timeout:
     twice 0. With the 05:05 gap crash (kept 4 days): texts 41, twice 1.
   - FIFO: texts 43, twice 3, held 3 (23:09 until 23:11:01, 00:23 until 00:26:01, 01:43 until
     01:46:01), late 5. FIFO with dedup (the cold case): texts 40, twice 0, skipped 3, held 3, late 5.
   - 12-minute timeout, at least once: twice 3; Mrs Wenlock's second text at 01:52:01.
   - Crashes off: texts 40, nothing twice, lost or late. Phone: calls 40, texts 0.
*/
(function () {
  "use strict";

  var START = 79200;          // 22:00:00
  var END = 28800;            // 06:00:00, seconds after 22:00
  var SPEED = 600;
  var RESTART = 20;
  var WENLOCK = 19;
  var ARRIVALS = [4, 16, 31, 45, 52, 60, 65, 69, 84, 98, 110, 122, 131, 140, 143, 157, 175, 192,
    220, 223, 238, 254, 270, 287, 299, 312, 329, 341, 355, 368, 379, 386, 390, 404, 413, 425, 434,
    447, 458, 469];
  var CRASH = { 7: "before", 14: "after", 19: "after", 26: "after", 33: "before" };
  var GAP_AT = 36;

  var MODES = [
    { value: "amo", label: "At most once: delete first, then send" },
    { value: "alo", label: "At least once: send, then delete (as now)" },
    { value: "dedup", label: "At least once, skip message ids already recorded" },
    { value: "fifo", label: "FIFO queue, one message group" },
    { value: "fifod", label: "FIFO queue, one message group, with dedup" },
    { value: "phone", label: "No texts: couriers phone from the door" }
  ];
  var VT_OPTS = [
    { value: "120", label: "2 minutes" },
    { value: "360", label: "6 minutes (as now)" },
    { value: "720", label: "12 minutes" }
  ];
  var KEEP_OPTS = [
    { value: "300", label: "5 minutes" },
    { value: "3600", label: "1 hour" },
    { value: "345600", label: "4 days (the queue's retention period)" }
  ];
  var MODE_SHORT = { amo: "at most once", alo: "at least once", dedup: "at least once with dedup", fifo: "FIFO queue", fifod: "FIFO queue with dedup", phone: "couriers phone" };
  function isFifo(C) { return C.mode === "fifo" || C.mode === "fifod"; }
  function isDedup(C) { return C.mode === "dedup" || C.mode === "fifod"; }

  var DIAGRAM = {
    type: "arch", w: 740, h: 330,
    aria: "The night's delivery notices. The couriers' app puts a message on the arrivals queue when a courier taps arrived. The notifier receives it, sends a text through the SMS provider to the customer's phone, and deletes the message. A table of message ids already handled sits beside the notifier and is used only in the dedup mode.",
    nodes: [
      { id: "app", label: "Couriers' app", sub: "0 taps", x: 90, y: 80, w: 150, h: 64, shape: "box", tone: "" },
      { id: "queue", label: "Arrivals queue", sub: "SQS standard", meta: "visibility 6 min", x: 330, y: 80, w: 180, h: 72, shape: "box", tone: "" },
      { id: "notifier", label: "Notifier", sub: "up", meta: "0 crashes", x: 610, y: 80, w: 200, h: 72, shape: "box", tone: "ok" },
      { id: "door", label: "Customer's door", sub: "0 sent twice", x: 90, y: 250, w: 150, h: 64, shape: "box", tone: "" },
      { id: "sms", label: "SMS provider", sub: "0 texts", x: 330, y: 250, w: 180, h: 64, shape: "cloud", tone: "" },
      { id: "ids", label: "Ids already handled", sub: "not used", meta: "a table", x: 610, y: 250, w: 200, h: 72, shape: "db", tone: "muted" }
    ],
    edges: [
      { from: "app", to: "queue", label: "message" },
      { from: "queue", to: "notifier", label: "receive" },
      { from: "notifier", to: "sms", label: "send" },
      { from: "sms", to: "door", label: "text" },
      { from: "notifier", to: "ids", label: "check", dash: true }
    ]
  };

  /* ---------- helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock(sec) {
    var s = Math.floor(START + sec) % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }
  function mid(n) {
    var h = 0x811c9dc5;
    var s = "tap-" + n;
    for (var i = 0; i < s.length; i++) h = Math.imul((h ^ s.charCodeAt(i)) >>> 0, 0x01000193) >>> 0;
    return ("0000000" + h.toString(16)).slice(-8);
  }
  function vtWords(v) { return (v / 60) + " min"; }
  function keepWords(k) { return k === 300 ? "5 minutes" : k === 3600 ? "1 hour" : "4 days"; }
  function who(n) { return n === WENLOCK ? "delivery 19 (Mrs Wenlock, Dovecote Lane)" : "delivery " + n; }

  /* ---------- the night, worked out in full (pure) ---------- */

  function night(C) {
    var ev = [];
    function add(t, msg, tone, d) { ev.push({ t: t, k: ev.length, msg: msg, tone: tone || "", d: d || {} }); }
    var M = ARRIVALS.map(function (m, i) {
      return { n: i + 1, t: m * 60, vis: m * 60, rec: 0, done: false, sms: 0, first: -1, id: mid(i + 1) };
    });
    M.forEach(function (m) { add(m.t, "", "", { tap: 1 }); });
    if (C.mode === "phone") {
      M.forEach(function (m) {
        add(m.t, who(m.n) + ": the courier phones the customer from the door. No text, no queue.", "", { call: 1 });
      });
      return finishList(ev);
    }
    var rec = {};
    var free = 0;
    var guard = 0;
    while (guard++ < 500) {
      var pick = null;
      var avail = Infinity;
      if (isFifo(C)) {
        for (var h = 0; h < M.length; h++) if (!M[h].done) { pick = M[h]; avail = Math.max(pick.vis, pick.t); break; }
      } else {
        M.forEach(function (m) {
          if (!m.done && m.vis < avail) { avail = m.vis; pick = m; }
        });
      }
      if (!pick) break;
      var T = Math.max(avail, free);
      if (T >= END) break;
      receive(pick, T);
    }
    return finishList(ev);

    function sent(m, at) {
      m.sms += 1;
      var d = { sms: 1 };
      if (m.sms === 1) { m.first = at; if (at - m.t > 60) d.late = 1; }
      if (m.sms === 2) d.dup = 1;
      if (m.n === WENLOCK) d.w = clock(at);
      return d;
    }
    function receive(m, T) {
      m.rec += 1;
      var crash = m.rec === 1 && C.crashes ? CRASH[m.n] : null;
      if (m.rec === 1 && C.gap && m.n === GAP_AT && C.mode !== "phone") crash = "gap";
      var d0 = {};
      if (isFifo(C) && m.rec === 1 && T - m.t > 30) {
        d0.held = 1;
        add(T, who(m.n) + ": tapped at " + clock(m.t) + ", held behind a hidden message in the same group until now.", "warn", d0);
      }
      var head = who(m.n) + ", message id " + m.id + (m.rec > 1 ? ", received again" : "") + ".";
      if (C.mode === "amo") {
        m.done = true;
        if (crash === "before") {
          free = T + RESTART;
          add(T, head + " Deleted first; the notifier crashes before the text goes out. Back at " + clock(free) + ". The notice is lost: no queue holds it now.", "bad", { lost: 1, crash: 1 });
          return;
        }
        var da = sent(m, T + 1);
        free = T + 1 + (crash ? RESTART : 0);
        if (crash) da.crash = 1;
        add(T + 1, head + " Deleted first, text sent at " + clock(T + 1) + "." + (crash ? " The notifier crashes after it; nothing is left to come back." : ""), "", da);
        return;
      }
      if (isDedup(C) && rec.hasOwnProperty(m.id)) {
        if (T < rec[m.id] + C.keep) {
          m.done = true;
          free = T + 1;
          add(T + 1, head + " Already recorded at " + clock(rec[m.id]) + ": skip the text, delete the message.", "ok", { skip: 1 });
          return;
        }
        add(T, "The record of message id " + m.id + " expired at " + clock(rec[m.id] + C.keep) + ", " + keepWords(C.keep) + " after it was written.", "bad");
      }
      if (crash === "before") {
        m.vis = T + C.vt;
        free = T + RESTART;
        add(T, head + " The notifier crashes before the text goes out. Back at " + clock(free) + "; the message is hidden until " + clock(m.vis) + ".", "warn", { crash: 1 });
        return;
      }
      var d = sent(m, T + 1);
      var late = d.late ? " (" + Math.round((T + 1 - m.t) / 60) + " min after the tap)" : "";
      if (crash) {
        m.vis = T + C.vt;
        free = T + 1 + RESTART;
        d.crash = 1;
        if (isDedup(C) && crash === "after") rec[m.id] = T + 1;
        var where = (crash === "gap" && isDedup(C)) ?" The notifier crashes between the send and the record, so the id is never recorded."
          : (isDedup(C) ? " Id recorded at " + clock(T + 1) + ". The notifier crashes before the delete." : " The notifier crashes before the delete.");
        add(T + 1, head + " Text sent at " + clock(T + 1) + "." + where + " Back at " + clock(free) + "; the message is hidden until " + clock(m.vis) + ".", "warn", d);
        return;
      }
      m.done = true;
      free = T + 1;
      if (isDedup(C)) rec[m.id] = T + 1;
      add(T + 1, head + " Text sent at " + clock(T + 1) + late + (isDedup(C) ? ", id recorded" : "") + ", message deleted." +
        (m.sms === 2 ? " The same notice, a second time." : ""), m.sms === 2 ? "bad" : (d.late ? "warn" : ""), d);
    }
  }

  function finishList(ev) {
    ev.sort(function (a, b) { return (a.t - b.t) || (a.k - b.k); });
    return ev;
  }

  /* ---------- the replay ---------- */

  function zero() { return { tap: 0, sms: 0, dup: 0, lost: 0, late: 0, held: 0, skip: 0, call: 0, crash: 0, w: [] }; }

  function newNight(api) {
    var S = api.state;
    S.ev = night(S.C);
    S.i = 0;
    S.t = 0;
    S.done = false;
    S.sum = zero();
  }

  function reveal(api, upTo) {
    var S = api.state;
    while (S.i < S.ev.length && S.ev[S.i].t <= upTo) {
      var e = S.ev[S.i];
      S.i += 1;
      var d = e.d;
      ["tap", "sms", "dup", "lost", "late", "held", "skip", "call", "crash"].forEach(function (k) { if (d[k]) S.sum[k] += d[k]; });
      if (d.w) S.sum.w.push(d.w);
      if (e.msg) { api.clock = START + e.t; api.log(e.msg, e.tone); }
    }
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
    api.log("06:00, end of the night (" + MODE_SHORT[S.C.mode] + "). 40 deliveries. Texts sent: " + x.sms + ". Notices sent twice: " + x.dup +
      ". Lost: " + x.lost + ". More than a minute late: " + x.late + "." + (isFifo(S.C) ? " Held behind a crashed notice: " + x.held + "." : "") +
      (isDedup(S.C) ? " Redeliveries skipped: " + x.skip + "." : "") + (S.C.mode === "phone" ? " Phone calls: " + x.call + "." : ""),
      x.dup || x.lost ? "bad" : "");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var x = S.sum;
    api.node("app").text("sub", x.tap + (x.tap === 1 ? " tap" : " taps"));
    var q = api.node("queue");
    q.text("sub", isFifo(C) ? "SQS FIFO" : C.mode === "phone" ? "not used" : "SQS standard");
    q.text("meta", C.mode === "phone" ? "" : "visibility " + vtWords(C.vt));
    q.set(C.mode === "phone" ? "muted" : x.held ? "warn" : "");
    var nt = api.node("notifier");
    nt.text("sub", C.mode === "amo" ? "delete, then send" : C.mode === "phone" ? "not used" : isDedup(C) ? "check, send, record, delete" : "send, then delete");
    nt.text("meta", x.crash + (x.crash === 1 ? " crash" : " crashes"));
    nt.set(C.mode === "phone" ? "muted" : x.crash ? "warn" : "ok");
    var sm = api.node("sms");
    sm.text("sub", x.sms + (x.sms === 1 ? " text" : " texts"));
    sm.set(C.mode === "phone" ? "muted" : "");
    var dr = api.node("door");
    dr.text("sub", C.mode === "phone" ? x.call + " calls" : x.dup + " sent twice");
    dr.set(x.dup || x.lost ? "bad" : "ok");
    var ids = api.node("ids");
    ids.text("sub", isDedup(C) ? "kept " + keepWords(C.keep) : "not used");
    ids.text("meta", isDedup(C) ? x.skip + " skipped" : "a table");
    ids.set(isDedup(C) ? "ok" : "muted");
    S.stat.sms(x.sms);
    S.stat.dup(x.dup);
    S.stat.lost(x.lost);
    S.stat.late(x.late);
    S.stat.held(x.held);
    S.stat.skip(x.skip);
    S.stat.call(x.call);
    S.stat.w19(x.w.length ? x.w.join(" and ") : "none yet");
  }

  function settingsLine(C) {
    return MODE_SHORT[C.mode] + ", visibility timeout " + vtWords(C.vt) + ", crash points " + (C.crashes ? "on" : "off") +
      (C.gap ? ", a crash between send and record at 05:05" : "") + (isDedup(C) ? ", ids kept " + keepWords(C.keep) : "") + ".";
  }

  function replay(api, why) {
    var S = api.state;
    newNight(api);
    api.speed = SPEED;
    api.clock = START;
    api.log(why + " The night starts again at 22:00. Now: " + settingsLine(S.C), "");
    draw(api);
  }

  var INFO = {
    app: "<strong>Couriers' app.</strong> When a courier reaches the door and taps arrived, the app puts one message on the arrivals queue. 40 deliveries tonight, from 22:04 to 05:49.",
    queue: "<strong>Arrivals queue.</strong> An Amazon SQS queue. A received message is hidden for the visibility timeout; if it isn't deleted by then, it becomes visible again with the same message id, and the notifier receives it again.",
    notifier: "<strong>Notifier.</strong> One program, one message at a time: receive, send the text, delete. A crash costs 20 seconds. The night's crash points: 23:05 and 04:30 before the text goes out; 00:20, 01:40 and 03:12 after it.",
    sms: "<strong>SMS provider.</strong> The service that delivers the text to the customer's phone. Once it has the text, nothing the notifier does later can call it back.",
    door: "<strong>Customer's door.</strong> Where the text sends the customer. A second text for the same delivery sends them down again, after the courier has gone.",
    ids: "<strong>Ids already handled.</strong> A table outside the notifier, so a crash doesn't wipe it. In the dedup mode the notifier checks it before sending and writes the message id right after. Each id is kept for the time you choose."
  };

  /* ---------- the module ---------- */

  DL.sims.define("s4e06", {
    diagram: DIAGRAM,
    startClock: START,

    setup: function (api) {
      var S = api.state;
      S.C = { mode: "alo", vt: 360, crashes: true, gap: false, keep: 345600 };
      api.speed = SPEED;
      S.ctl = {};
      S.ctl.mode = api.control.select("mode", "Delivery mode", MODES, "alo", function (v) {
        S.C.mode = String(v);
        replay(api, "Mode: " + MODE_SHORT[S.C.mode] + ".");
      });
      S.ctl.vt = api.control.select("vt", "Visibility timeout", VT_OPTS, "360", function (v) {
        S.C.vt = Number(v) || 360;
        replay(api, "Visibility timeout: " + vtWords(S.C.vt) + ".");
      });
      S.ctl.crashes = api.control.toggle("crashes", "The night's crash points (23:05, 00:20, 01:40, 03:12, 04:30)", true, function (on) {
        S.C.crashes = !!on;
        replay(api, "Crash points: " + (on ? "on." : "off."));
      });
      S.ctl.gap = api.control.toggle("gap", "One more crash at 05:05, between the send and the record", false, function (on) {
        S.C.gap = !!on;
        replay(api, "Crash between send and record at 05:05: " + (on ? "on." : "off."));
      });
      S.ctl.keep = api.control.select("keep", "Keep handled message ids for (dedup mode)", KEEP_OPTS, "345600", function (v) {
        S.C.keep = Number(v) || 345600;
        replay(api, "Ids kept for " + keepWords(S.C.keep) + ".");
      });
      S.ctl.skip = api.control.button("skip", "Skip to 06:00", function () { finish(api); draw(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        sms: api.stat("sms", "texts sent", ""),
        dup: api.stat("dup", "notices sent twice", "bad"),
        lost: api.stat("lost", "notices lost", "bad"),
        late: api.stat("late", "notices more than a minute late", "warn"),
        held: api.stat("held", "held behind a crashed notice", "warn"),
        skip: api.stat("skip", "redeliveries skipped", "ok"),
        call: api.stat("call", "phone calls", ""),
        w19: api.stat("w19", "Mrs Wenlock's texts (delivery 19)", "")
      };

      api.onNodeClick(function (id) { if (INFO[id]) api.info(INFO[id]); });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      newNight(api);
      api.log("22:00. Nothing tapped yet. Settings: " + settingsLine(S.C), "");
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
      function night(mode) { t.set("mode", mode); t.click("skip"); }
      var a;

      // 1. Opening state: 22:00, before the first tap.
      t.expect(s("sms") === 0 && s("dup") === 0 && s("lost") === 0 && s("late") === 0 && s("held") === 0 &&
        s("skip") === 0 && s("call") === 0 && s("w19") === "none yet" && t.node("notifier").text.meta === "0 crashes",
        "Opens at 22:00 with nothing tapped and nothing sent");

      // 2. The first delivery: tapped at 22:04:00, text at 22:04:01.
      await t.run(0.5);                                  // 300 sim seconds
      t.expect(s("sms") === 1 && s("dup") === 0 && has("delivery 1, message id " + mid(1) + ". Text sent at 22:04:01, message deleted."),
        "22:04: delivery 1's text goes out at 22:04:01 and the message is deleted");

      // 3. The story's night: three notices twice, Mrs Wenlock's at 01:40:01 and 01:46:01.
      t.click("skip");
      t.expect(s("sms") === 43 && s("dup") === 3 && s("lost") === 0 && s("late") === 2 && s("w19") === "01:40:01 and 01:46:01" &&
        has("delivery 19 (Mrs Wenlock, Dovecote Lane), message id " + mid(19) + ". Text sent at 01:40:01. The notifier crashes before the delete. Back at 01:40:21; the message is hidden until 01:46:00.") &&
        has("delivery 19 (Mrs Wenlock, Dovecote Lane), message id " + mid(19) + ", received again. Text sent at 01:46:01, message deleted. The same notice, a second time.") &&
        has("Texts sent: 43. Notices sent twice: 3. Lost: 0. More than a minute late: 2."),
        "As that night: 43 texts, 3 notices twice, 2 late; Mrs Wenlock's at 01:40:01 and 01:46:01");

      // 4. At most once: nothing twice, two notices lost.
      night("amo");
      t.expect(s("sms") === 38 && s("dup") === 0 && s("lost") === 2 && s("w19") === "01:40:01" &&
        has("delivery 7, message id " + mid(7) + ". Deleted first; the notifier crashes before the text goes out. Back at 23:05:20. The notice is lost: no queue holds it now."),
        "At most once: 38 texts, none twice, 2 lost (23:05 and 04:30)");

      // 5. Dedup with ids kept 4 days: nothing twice, 3 redeliveries skipped.
      night("dedup");
      t.expect(s("sms") === 40 && s("dup") === 0 && s("skip") === 3 && s("late") === 2 && s("w19") === "01:40:01" &&
        has("delivery 19 (Mrs Wenlock, Dovecote Lane), message id " + mid(19) + ", received again. Already recorded at 01:40:01: skip the text, delete the message."),
        "Dedup, ids kept 4 days: 40 texts, none twice, 3 redeliveries skipped");

      // 6. Ids kept 5 minutes: the 01:46 redelivery outlives the record; a 2-minute timeout fits inside it.
      t.set("keep", "300");
      t.click("skip");
      a = s("dup") === 3 && s("sms") === 43 && has("The record of message id " + mid(19) + " expired at 01:45:01, 5 minutes after it was written.");
      t.set("vt", "120");
      t.click("skip");
      t.expect(a && s("dup") === 0 && s("skip") === 3,
        "Ids kept 5 minutes: 3 twice again with a 6-minute timeout, none with a 2-minute one");

      // 7. The gap: a crash between the send and the record repeats that one notice.
      t.set("vt", "360");
      t.set("keep", "345600");
      t.set("gap", true);
      t.click("skip");
      t.expect(s("dup") === 1 && s("sms") === 41 && has("The notifier crashes between the send and the record, so the id is never recorded."),
        "Dedup with a crash between send and record at 05:05: 1 notice twice, 41 texts");
      t.set("gap", false);

      // 8. FIFO: the same three doubles, and three notices held behind a hidden message.
      night("fifo");
      a = s("dup") === 3 && s("sms") === 43 && s("held") === 3 && s("late") === 5 && s("w19") === "01:40:01 and 01:46:01" &&
        has("delivery 20: tapped at 01:43:00, held behind a hidden message in the same group until now.");
      night("fifod");
      t.expect(a && s("dup") === 0 && s("sms") === 40 && s("skip") === 3 && s("held") === 3 && s("late") === 5,
        "FIFO: still 3 notices twice, plus 3 held behind a crashed notice, 5 late; FIFO with dedup: none twice, the same 3 held");

      // 9. Couriers phone: 40 calls, no texts.
      night("phone");
      t.expect(s("call") === 40 && s("sms") === 0 && s("dup") === 0 && s("lost") === 0,
        "Couriers phone: 40 calls, no texts, nothing twice");

      // 10. A 12-minute timeout only moves the second text later.
      t.set("vt", "720");
      night("alo");
      t.expect(s("dup") === 3 && s("w19") === "01:40:01 and 01:52:01", "12-minute timeout: still 3 twice; Mrs Wenlock's second text at 01:52:01");

      // 11. No crashes, no doubles: the copies come only from crashes.
      t.set("vt", "360");
      t.set("crashes", false);
      t.click("skip");
      t.expect(s("sms") === 40 && s("dup") === 0 && s("late") === 0 && s("lost") === 0,
        "Crash points off: 40 texts, nothing twice, late or lost");
    }
  });
})();
