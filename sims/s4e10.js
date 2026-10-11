/* sims/s4e10-v1.0.0.js  (published as sims/s4e10.js)
   Case s4e10 "Everyone Hears It": a fan-out lab for the flood warning office in Ollerby, on the
   river Quarrow. When the river gauge crosses its warning level, the gauge service must warn the
   town on four alert channels: SMS, the website, the sirens and local radio. The learner replays
   the 15 minutes from 02:30:00 to 02:45:00 with five delivery modes, three hang settings, the
   radio studio's line down or up, a gauge service restart, and a fifth channel (the town app).

   CHANGELOG
   v1.0.0 (2026-10-11) first version: modes chain (as built), sirens first, parallel threads,
     polling every 10 s, topic with a queue per channel; hang none, SMS provider (that night) or
     siren controller; radio line down until 02:32:30; gauge service restart at 02:32:00; town
     app as a fifth channel; Skip to 02:45; Reset. Stats: sirens sounded, sirens against the
     water, channels out after the water, alerts lost, retries, polls of the gauge a day, changes
     to the gauge service. selfTest: 11 assertions.

   The model (stated in sim.lede). Times are seconds after 02:30:00.
   - The gauge crosses its warning level at 02:31:00 (60). The gauge service sends a warning only
     when the level crosses, so once its warning is gone it never sends it again.
   - Water reaches the low square at 02:32:50 (170): given data, from the square's level sensor.
   - Each call to a channel, when it works, takes: SMS 2 s, website 1 s, sirens 2 s, radio 1 s,
     town app 1 s. A call to the channel that hangs, started before 02:37:00 (420), waits the full
     180-second timeout and fails. With the radio line down, a radio call started before 02:32:30
     (150) is refused after 1 s.
   - A failed try is tried again 30 s after it ends. No channel reaches a cap on tries here.
   - Chain: one call at a time, in the order SMS, website, sirens, radio (town app last); failed
     channels are retried after the chain, earliest due first. Sirens first: sirens, SMS,
     website, radio (town app last).
   - Parallel threads: every channel is called at 02:31:00 in its own thread; each thread retries
     its own channel. The retries live in the gauge service's memory.
   - Restart (chain, sirens first, parallel): the gauge service restarts at 02:32:00 (120) and is
     back at 02:32:20 (140). A call in progress at 02:32:00, and any try due after it, is lost.
   - Polling: each channel asks the gauge every 10 s, at its own second: radio at :x2, SMS :x4,
     town app :x5, website :x7, sirens :x9. A poll that sees the warning, and finds the channel
     hasn't sent it, calls the channel. After a failed call the next poll is the first one after
     the call ends. While the gauge restarts (02:32:00 to 02:32:20) polls get no answer. Polls a
     day: channels x 8,640 (6 a minute x 1,440 minutes).
   - Topic: the gauge service publishes one warning at 02:31:00 and the topic copies it into one
     queue per channel at once (the sim counts that as 0 s). Each channel's worker receives from
     its own queue; a failed try leaves the message on that queue for 30 s. A restart of the
     gauge service after 02:31:00 loses nothing.
   - Adding the town app: in chain, sirens first and parallel it means a change to the gauge
     service (1); with polling or the topic, none (0).

   Where every number comes from (conventions rule 14; the case is content/s4/s4e10-v1.0.0.json).
   All are checked by the selfTest.
   - As built (chain, SMS hangs): SMS try 1 02:31:00 to 02:34:00, timed out. Website 02:34:00 to
     02:34:01. Sirens 02:34:01, sounded 02:34:03, 73 s after the water (02:32:50). Radio 02:34:04.
     SMS try 2 02:34:30 to 02:37:30, timed out; try 3 02:38:00, sent 02:38:02. 2 retries, 4
     channels out after the water, 0 lost.
   - Sirens first, SMS hangs: sirens 02:31:02 (108 s before the water), SMS timed out 02:34:02,
     website 02:34:03, radio 02:34:04, SMS 02:38:04 on try 3. 3 channels after the water.
   - Sirens first, sirens hang: sirens time out 02:34:00; SMS 02:34:02, website 02:34:03, radio
     02:34:04, sirens 02:38:02 on try 3. 4 after the water.
   - Parallel, SMS hangs: website 02:31:01, radio 02:31:01, sirens 02:31:02, SMS 02:38:02 on try 3.
     1 after the water. Parallel, radio down and restart, nothing hangs: radio refused at 02:31:01
     and 02:31:32; its try due at 02:32:02 is lost in the restart. 1 lost.
   - Polling, SMS hangs: radio 02:31:03, website 02:31:08, sirens 02:31:11 (99 s before), SMS
     timed out 02:34:04 and 02:37:14, sent 02:37:26 on try 3. Polls a day 34,560; with the town
     app 43,200.
   - Topic, SMS hangs: the same times as parallel; 1 after the water, 2 retries. Topic, radio down
     and restart: radio refused at 02:31:01, 02:31:32, 02:32:03, sent 02:32:34 on try 4, 16 s
     before the water; 0 lost. Topic, sirens hang: SMS 02:31:02, sirens 02:38:02 on try 3.
   - Chain, SMS hangs, restart: the SMS call is in progress at 02:32:00: all 4 lost.
   - Town app added: topic 02:31:01, changes 0; chain 02:34:05, changes 1.
*/
(function () {
  "use strict";

  var BASE = 9000;         // 02:30:00
  var T0 = 60;             // 02:31:00, the gauge crosses its warning level
  var WATER = 170;         // 02:32:50, water in the low square
  var HANG_END = 420;      // 02:37:00, calls to the hung channel work again
  var RADIO_UP = 150;      // 02:32:30, the radio studio's line is back
  var RESTART = 120;       // 02:32:00
  var BACK = 140;          // 02:32:20
  var END = 900;           // 02:45:00
  var TIMEOUT = 180;
  var RETRY = 30;
  var SPEED = 20;

  var CH = [
    { id: "sms", name: "SMS", lat: 2, ph: 4, did: "SMS sent" },
    { id: "web", name: "website", lat: 1, ph: 7, did: "website updated" },
    { id: "siren", name: "sirens", lat: 2, ph: 9, did: "sirens sounded" },
    { id: "radio", name: "radio", lat: 1, ph: 2, did: "radio on air" },
    { id: "app", name: "town app", lat: 1, ph: 5, did: "town app alert pushed" }
  ];
  var ORDER = { chain: ["sms", "web", "siren", "radio", "app"], first: ["siren", "sms", "web", "radio", "app"] };

  var MODES = [
    { value: "chain", label: "Chain: SMS, website, sirens, radio (as built)" },
    { value: "first", label: "Chain with the sirens first" },
    { value: "par", label: "Parallel threads: all at once from the gauge service" },
    { value: "poll", label: "Polling: each channel asks the gauge every 10 s" },
    { value: "topic", label: "Topic: one warning, a queue per channel" }
  ];
  var HANGS = [
    { value: "sms", label: "The SMS provider hangs until 02:37 (that night)" },
    { value: "siren", label: "The siren controller hangs until 02:37" },
    { value: "none", label: "Nothing hangs" }
  ];
  var MODE_SHORT = { chain: "chain, as built", first: "chain, sirens first", par: "parallel threads", poll: "polling every 10 s", topic: "topic, a queue per channel" };
  var MID = {
    chain: ["Chain of calls", "one at a time"],
    first: ["Chain of calls", "sirens first"],
    par: ["Parallel threads", "one per channel"],
    poll: ["Nobody calls", "channels poll"],
    topic: ["Warnings topic", "a queue each"]
  };

  var DIAGRAM = {
    type: "arch", w: 740, h: 440,
    aria: "The gauge service on the left sends the warning through the delivery path in the middle, which reaches five channels on the right: SMS, website, sirens, radio and the town app. Each channel shows when it went out and on which try. The low square, bottom left, shows when the water arrived.",
    nodes: [
      { id: "gauge", label: "Gauge service", sub: "level below warning", x: 100, y: 200, w: 160, h: 64, shape: "box", tone: "" },
      { id: "mid", label: "Chain of calls", sub: "one at a time", meta: "", x: 340, y: 200, w: 170, h: 72, shape: "box", tone: "" },
      { id: "sms", label: "SMS", sub: "waiting", x: 620, y: 45, w: 200, h: 50, shape: "box", tone: "" },
      { id: "web", label: "Website", sub: "waiting", x: 620, y: 135, w: 200, h: 50, shape: "box", tone: "" },
      { id: "siren", label: "Sirens", sub: "waiting", x: 620, y: 225, w: 200, h: 50, shape: "box", tone: "" },
      { id: "radio", label: "Radio", sub: "waiting", x: 620, y: 315, w: 200, h: 50, shape: "box", tone: "" },
      { id: "app", label: "Town app", sub: "not a channel", x: 620, y: 405, w: 200, h: 50, shape: "box", tone: "muted" },
      { id: "square", label: "Low square", sub: "dry", x: 100, y: 380, w: 160, h: 56, shape: "box", tone: "" }
    ],
    edges: [
      { from: "gauge", to: "mid", label: "warning" },
      { from: "mid", to: "sms" },
      { from: "mid", to: "web" },
      { from: "mid", to: "siren" },
      { from: "mid", to: "radio" },
      { from: "mid", to: "app", dash: true, tone: "muted" }
    ]
  };

  /* ---------- helpers ---------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clk(sec) {
    var s = Math.floor(BASE + sec) % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function chan(id) { for (var i = 0; i < CH.length; i++) if (CH[i].id === id) return CH[i]; return null; }
  function active(C) { return CH.filter(function (c) { return c.id !== "app" || C.app; }); }
  function gaugeHolds(C) { return C.mode === "chain" || C.mode === "first" || C.mode === "par"; }
  function vsWater(at) {
    return at < WATER ? (WATER - at) + " s before the water" : (at - WATER) + " s after the water";
  }

  // One call to a channel, started at second s.
  function call(C, ch, s) {
    if (C.hang === ch.id && s < HANG_END) return { end: s + TIMEOUT, ok: false, why: "no answer, timed out after 180 s" };
    if (ch.id === "radio" && C.radio && s < RADIO_UP) return { end: s + 1, ok: false, why: "the studio's line refused the call" };
    return { end: s + ch.lat, ok: true };
  }

  /* ---------- the 15 minutes, worked out in full (pure) ---------- */

  function night(C) {
    var ev = [];
    function add(t, msg, tone, d) { ev.push({ t: t, k: ev.length, msg: msg, tone: tone || "", d: d || {} }); }
    var chs = active(C);
    var R = {};
    chs.forEach(function (c) { R[c.id] = { tries: 0, at: -1, lost: false }; });
    var dead = C.restart && gaugeHolds(C) ? RESTART : Infinity;
    var lostWhy = [];

    var again = C.mode === "topic" ? "the message stays on its queue; its worker tries again at " :
      C.mode === "poll" ? "its next poll is at " : "the gauge service tries again at ";

    function done(ch, r, s) {
      var x = R[ch.id];
      if (r.ok) {
        x.at = r.end;
        add(r.end, ch.did + " at " + clk(r.end) + " (try " + x.tries + ")" +
          (ch.id === "siren" ? ", " + vsWater(r.end) + " reached the low square." : "."),
          ch.id === "siren" ? (r.end < WATER ? "ok" : "bad") : (r.end > WATER ? "warn" : ""), { sent: ch.id, at: r.end, tries: x.tries });
      } else {
        add(r.end, ch.name + ": " + r.why + " (try " + x.tries + ", started " + clk(s) + "); " + again + clk(nextTry(ch, r.end)) + ".",
          "warn", { fail: ch.id, tries: x.tries });
      }
    }
    function nextTry(ch, e) {
      if (C.mode !== "poll") return e + RETRY;
      var p = e + ((((ch.ph - e) % 10) + 10) % 10);
      if (p <= e) p += 10;
      return p;
    }
    // Tries channel ch at s; returns the call, or null if the restart got there first.
    function attempt(ch, s) {
      if (s >= dead) { lostWhy.push(ch.name + " (its try was due at " + clk(s) + ")"); return null; }
      var r = call(C, ch, s);
      R[ch.id].tries += 1;
      if (r.end > dead) { lostWhy.push(ch.name + " (its call, started " + clk(s) + ", was cut off)"); return null; }
      done(ch, r, s);
      return r;
    }

    var opening = {
      chain: "The gauge crosses its warning level. The gauge service starts its chain: " + ORDER.chain.filter(function (id) { return R[id]; }).map(function (id) { return chan(id).name; }).join(", ") + ", one call at a time.",
      first: "The gauge crosses its warning level. The gauge service starts its chain: " + ORDER.first.filter(function (id) { return R[id]; }).map(function (id) { return chan(id).name; }).join(", ") + ", one call at a time.",
      par: "The gauge crosses its warning level. The gauge service starts " + chs.length + " threads, one call to each channel.",
      poll: "The gauge crosses its warning level. Nobody is called: each channel will see it on its next poll.",
      topic: "The gauge crosses its warning level. The gauge service publishes one warning to the topic, and it is copied into " + chs.length + " queues, one per channel."
    };
    add(T0, opening[C.mode], "", { cross: 1 });
    add(WATER, "Water reaches the low square (the square's level sensor).", "bad", { water: 1 });

    if (C.mode === "chain" || C.mode === "first") {
      var order = ORDER[C.mode].filter(function (id) { return R[id]; });
      var t = T0;
      var pend = [];
      var killed = false;
      for (var i = 0; i < order.length; i++) {
        var r = attempt(chan(order[i]), t);
        if (!r) { killed = true; break; }
        t = r.end;
        if (!r.ok) pend.push({ id: order[i], ready: r.end + RETRY, n: i });
      }
      while (!killed && pend.length) {
        pend.sort(function (a, b) { return (a.ready - b.ready) || (a.n - b.n); });
        var p = pend.shift();
        var s = Math.max(t, p.ready);
        if (s >= END) break;
        var r2 = attempt(chan(p.id), s);
        if (!r2) { killed = true; break; }
        t = r2.end;
        if (!r2.ok) pend.push({ id: p.id, ready: r2.end + RETRY, n: p.n });
      }
      if (killed) {
        order.forEach(function (id) {
          if (R[id].at < 0 && !R[id].lost) {
            R[id].lost = true;
            if (!lostWhy.some(function (w) { return w.indexOf(chan(id).name + " (") === 0; })) lostWhy.push(chan(id).name + " (never called)");
          }
        });
      }
    } else if (C.mode === "par" || C.mode === "topic") {
      chs.forEach(function (c) {
        var s = T0;
        while (s < END) {
          var r = attempt(c, s);
          if (!r) { R[c.id].lost = true; break; }
          if (r.ok) break;
          s = r.end + RETRY;
        }
      });
    } else {
      chs.forEach(function (c) {
        var p = T0 + c.ph;
        while (p < END) {
          if (C.restart && p >= RESTART && p < BACK) { p += 10; continue; }
          var r = attempt(c, p);
          if (r.ok) break;
          p = nextTry(c, r.end);
        }
      });
    }

    if (C.restart) {
      var lost = chs.filter(function (c) { return R[c.id].lost; });
      var msg;
      if (C.mode === "topic") msg = "The gauge service restarts (back at " + clk(BACK) + "). The warning has been in the queues since " + clk(T0) + ", so nothing is lost.";
      else if (C.mode === "poll") msg = "The gauge service restarts (back at " + clk(BACK) + "). Polls until then get no answer; each channel asks again on its next poll.";
      else {
        msg = "The gauge service restarts (back at " + clk(BACK) + "). What it held in memory is gone. " +
          (lost.length ? "Lost: " + lostWhy.join(", ") + ". " : "Nothing was waiting. ") +
          "The river is still above the warning level, but it sends only when the level crosses, so nothing goes again.";
      }
      add(RESTART, msg, lost.length ? "bad" : "warn", { lost: lost.length });
    }
    ev.sort(function (a, b) { return (a.t - b.t) || (a.k - b.k); });
    return ev;
  }

  /* ---------- the replay ---------- */

  function zero(C) {
    var v = {};
    active(C).forEach(function (c) { v[c.id] = "waiting"; });
    return { view: v, at: {}, lost: 0, retries: 0, water: false, crossed: false };
  }

  function newNight(api) {
    var S = api.state;
    S.ev = night(S.C);
    S.i = 0;
    S.t = 0;
    S.done = false;
    S.sum = zero(S.C);
  }

  function reveal(api, upTo) {
    var S = api.state;
    var x = S.sum;
    while (S.i < S.ev.length && S.ev[S.i].t <= upTo) {
      var e = S.ev[S.i];
      S.i += 1;
      var d = e.d;
      if (d.cross) x.crossed = true;
      if (d.water) x.water = true;
      if (d.sent) {
        x.at[d.sent] = d.at;
        x.view[d.sent] = clk(d.at) + ", try " + d.tries;
        if (d.tries > 1) x.retries += d.tries - 1;
      }
      if (d.fail) x.view[d.fail] = "try " + d.tries + " failed";
      if (d.lost) {
        x.lost += d.lost;
        active(S.C).forEach(function (c) {
          if (x.at[c.id] === undefined) {
            var tr = 0;
            for (var k = 0; k < S.ev.length; k++) if (S.ev[k].d.fail === c.id) tr = Math.max(tr, S.ev[k].d.tries);
            x.retries += Math.max(0, tr - 1);
            x.view[c.id] = "lost";
          }
        });
      }
      api.clock = BASE + e.t;
      api.log(e.msg, e.tone);
    }
  }

  function summaryLine(S) {
    var x = S.sum;
    return active(S.C).map(function (c) { return c.name + " " + (x.at[c.id] !== undefined ? clk(x.at[c.id]) : "lost"); }).join(", ");
  }

  function afterCount(S) {
    var n = 0;
    var x = S.sum;
    active(S.C).forEach(function (c) {
      if (x.view[c.id] === "lost" || (x.at[c.id] !== undefined && x.at[c.id] > WATER)) n += 1;
    });
    return n;
  }

  function finish(api) {
    var S = api.state;
    if (S.done) return;
    reveal(api, END);
    S.done = true;
    S.t = END;
    api.clock = BASE + END;
    api.speed = 0;
    api.log("End of the run (" + MODE_SHORT[S.C.mode] + "). " + summaryLine(S) + ". Out after the water: " + afterCount(S) +
      ". Lost: " + S.sum.lost + ". Retries: " + S.sum.retries + ".", S.sum.lost ? "bad" : "");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var x = S.sum;
    var g = api.node("gauge");
    g.text("sub", x.crossed ? "warning at 02:31:00" : "level below warning");
    g.set(C.restart && S.t >= RESTART && S.t < BACK ? "warn" : x.crossed ? "accent" : "");
    var m = api.node("mid");
    m.text("label", MID[C.mode][0]);
    m.text("sub", MID[C.mode][1]);
    m.text("meta", C.mode === "poll" ? fmt(active(C).length * 8640) + " polls a day" : C.mode === "topic" ? "workers retry alone" : "gauge holds retries");
    CH.forEach(function (c) {
      var n = api.node(c.id);
      if (c.id === "app" && !C.app) { n.text("sub", "not a channel"); n.set("muted"); return; }
      var v = x.view[c.id];
      n.text("sub", v);
      if (v === "lost") n.set("bad");
      else if (x.at[c.id] !== undefined) n.set(x.at[c.id] < WATER ? "ok" : "warn");
      else n.set(v === "waiting" ? "" : "warn");
    });
    var sq = api.node("square");
    sq.text("sub", x.water ? "water at 02:32:50" : "dry");
    sq.set(x.water ? "bad" : "");
    var sa = x.at.siren;
    S.stat.siren(sa !== undefined ? clk(sa) : x.view.siren === "lost" ? "lost" : "not yet");
    S.stat.against(sa !== undefined ? vsWater(sa) : x.view.siren === "lost" ? "never sounded" : "not yet");
    S.stat.after(afterCount(S));
    S.stat.lost(x.lost);
    S.stat.retries(x.retries);
    S.stat.polls(C.mode === "poll" ? fmt(active(C).length * 8640) : 0);
    S.stat.changes(C.app && gaugeHolds(C) ? 1 : 0);
  }

  function settingsLine(C) {
    var h = C.hang === "none" ? "nothing hangs" : (C.hang === "sms" ? "the SMS provider" : "the siren controller") + " hangs until 02:37";
    return MODE_SHORT[C.mode] + "; " + h + "; radio line " + (C.radio ? "down until 02:32:30" : "up") +
      "; gauge restart " + (C.restart ? "at 02:32:00" : "off") + (C.app ? "; town app added" : "") + ".";
  }

  function replay(api, why) {
    var S = api.state;
    newNight(api);
    api.speed = SPEED;
    api.clock = BASE;
    api.log(why + " The run starts again at 02:30:00. Now: " + settingsLine(S.C), "");
    draw(api);
  }

  var INFO = {
    gauge: "<strong>Gauge service.</strong> Reads the river gauge. When the level crosses the warning level, at 02:31:00, it sends one warning, and only then. How that warning reaches the channels depends on the mode.",
    mid: "<strong>Delivery path.</strong> Chain: the gauge service calls each channel in turn and waits for each answer. Parallel: one thread per channel, all at once. Polling: the channels ask the gauge every 10 s. Topic: one warning published, copied into a queue per channel.",
    sms: "<strong>SMS.</strong> A text to every phone signed up for flood warnings, through the SMS provider. 2 s when it works. That night the provider hung until 02:37.",
    web: "<strong>Website.</strong> The warning banner on the office's website. 1 s.",
    siren: "<strong>Sirens.</strong> The siren controller sounds the town's sirens. 2 s when it works.",
    radio: "<strong>Radio.</strong> The local station's alert line breaks into whatever is on air. 1 s. With the line down, calls before 02:32:30 are refused.",
    app: "<strong>Town app.</strong> A fifth channel you can add: a push alert from the town's app. 1 s. See what adding it changes in each mode.",
    square: "<strong>Low square.</strong> The lowest part of town. Its own level sensor recorded water on the paving at 02:32:50."
  };

  /* ---------- the module ---------- */

  DL.sims.define("s4e10", {
    diagram: DIAGRAM,
    startClock: BASE,

    setup: function (api) {
      var S = api.state;
      S.C = { mode: "chain", hang: "sms", radio: false, restart: false, app: false };
      api.speed = SPEED;
      S.ctl = {};
      S.ctl.mode = api.control.select("mode", "Delivery mode", MODES, "chain", function (v) {
        S.C.mode = String(v);
        replay(api, "Mode: " + MODE_SHORT[S.C.mode] + ".");
      });
      S.ctl.hang = api.control.select("hang", "What hangs", HANGS, "sms", function (v) {
        S.C.hang = String(v);
        replay(api, "What hangs: " + (S.C.hang === "none" ? "nothing." : S.C.hang === "sms" ? "the SMS provider." : "the siren controller."));
      });
      S.ctl.radio = api.control.toggle("radio", "The radio studio's line is down until 02:32:30", false, function (on) {
        S.C.radio = !!on;
        replay(api, "Radio line down: " + (on ? "on." : "off."));
      });
      S.ctl.restart = api.control.toggle("restart", "The gauge service restarts at 02:32:00", false, function (on) {
        S.C.restart = !!on;
        replay(api, "Gauge restart: " + (on ? "on." : "off."));
      });
      S.ctl.app = api.control.toggle("app", "Add a fifth channel: the town app", false, function (on) {
        S.C.app = !!on;
        var how = S.C.mode === "topic" ? " One new queue subscribes to the topic; the gauge service doesn't change." :
          S.C.mode === "poll" ? " One more poller; the gauge service doesn't change." : " The gauge service's code must change to call it.";
        replay(api, "Town app: " + (on ? "added." + how : "removed."));
      });
      S.ctl.skip = api.control.button("skip", "Skip to 02:45", function () { finish(api); draw(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        siren: api.stat("siren", "sirens sounded", ""),
        against: api.stat("against", "sirens against the water (02:32:50)", "warn"),
        after: api.stat("after", "channels out after the water", "bad"),
        lost: api.stat("lost", "alerts lost", "bad"),
        retries: api.stat("retries", "retries", ""),
        polls: api.stat("polls", "polls of the gauge a day", ""),
        changes: api.stat("changes", "changes to the gauge service", "")
      };

      api.onNodeClick(function (id) { if (INFO[id]) api.info(INFO[id]); });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      newNight(api);
      api.log("02:30:00. The river is below the warning level. Settings: " + settingsLine(S.C), "");
      draw(api);
    },

    step: function (api, dt) {
      var S = api.state;
      if (!S.C || S.done) return;
      S.t += dt * api.speed;
      if (S.t >= END) { finish(api); draw(api); return; }
      reveal(api, Math.floor(S.t));
      api.clock = BASE + S.t;
      draw(api);
    },

    selfTest: async function (t) {
      function s(id) { return t.stat(id); }
      function sub(id) { return t.node(id).text.sub; }
      function has(x) { return t.logText().indexOf(x) >= 0; }
      function runAs(mode) { t.set("mode", mode); t.click("skip"); }
      var a;

      // 1. Opening state: 02:30:00, before the gauge crosses.
      t.expect(s("siren") === "not yet" && s("against") === "not yet" && s("after") === 0 && s("lost") === 0 &&
        s("retries") === 0 && s("polls") === 0 && s("changes") === 0 && sub("sms") === "waiting" && sub("square") === "dry",
        "Opens at 02:30:00 with the river below the warning level and nothing sent");

      // 2. 02:31:20: the chain is still inside the SMS call; the sirens wait.
      await t.run(4);                                    // 80 sim seconds
      t.expect(has("The gauge service starts its chain: SMS, website, sirens, radio, one call at a time.") &&
        s("siren") === "not yet" && sub("sms") === "waiting" && sub("siren") === "waiting",
        "02:31:20: the chain is waiting on the SMS call, and the sirens wait behind it");

      // 3. The story's night, as built.
      t.click("skip");
      t.expect(s("siren") === "02:34:03" && s("against") === "73 s after the water" && s("after") === 4 && s("lost") === 0 &&
        s("retries") === 2 && sub("sms") === "02:38:02, try 3" && sub("web") === "02:34:01, try 1" && sub("radio") === "02:34:04, try 1" &&
        has("SMS: no answer, timed out after 180 s (try 1, started 02:31:00); the gauge service tries again at 02:34:30.") &&
        has("sirens sounded at 02:34:03 (try 1), 73 s after the water reached the low square."),
        "As built: SMS times out at 02:34:00, sirens at 02:34:03, 73 s after the water; texts at 02:38:02 on try 3");

      // 4. Sirens first: good that night, and everything waits when the sirens hang.
      runAs("first");
      a = s("siren") === "02:31:02" && s("against") === "108 s before the water" && s("after") === 3 &&
        sub("web") === "02:34:03, try 1" && sub("sms") === "02:38:04, try 3";
      t.set("hang", "siren");
      t.click("skip");
      t.expect(a && s("siren") === "02:38:02" && s("after") === 4 && sub("sms") === "02:34:02, try 1" && sub("radio") === "02:34:04, try 1",
        "Sirens first: 02:31:02 that night (3 still after the water); with the sirens hanging, every channel after the water");

      // 5. Parallel threads: fine that night; a restart loses the radio's retry.
      t.set("hang", "sms");
      runAs("par");
      a = s("siren") === "02:31:02" && s("after") === 1 && sub("sms") === "02:38:02, try 3" && sub("web") === "02:31:01, try 1";
      t.set("hang", "none");
      t.set("radio", true);
      t.set("restart", true);
      t.click("skip");
      t.expect(a && s("lost") === 1 && sub("radio") === "lost" && s("siren") === "02:31:02" &&
        has("Lost: radio (its try was due at 02:32:02)."),
        "Parallel: 1 channel after the water that night; radio down and a restart at 02:32:00 lose the radio alert");

      // 6. Topic, same later night: the radio queue keeps it.
      runAs("topic");
      t.expect(s("lost") === 0 && sub("radio") === "02:32:34, try 4" && s("retries") === 3 &&
        has("The warning has been in the queues since 02:31:00, so nothing is lost."),
        "Topic: the restart loses nothing, and the radio goes at 02:32:34 on its fourth try");

      // 7. Topic, the story's night: the SMS retries alone.
      t.set("radio", false);
      t.set("restart", false);
      t.set("hang", "sms");
      t.click("skip");
      t.expect(s("siren") === "02:31:02" && s("against") === "108 s before the water" && s("after") === 1 && s("lost") === 0 &&
        s("retries") === 2 && sub("sms") === "02:38:02, try 3" && sub("radio") === "02:31:01, try 1",
        "Topic that night: sirens 02:31:02, only the SMS after the water, at 02:38:02 on try 3");

      // 8. Topic with the sirens hanging: only the sirens are late.
      t.set("hang", "siren");
      t.click("skip");
      t.expect(s("siren") === "02:38:02" && s("after") === 1 && sub("sms") === "02:31:02, try 1",
        "Topic, sirens hanging: the other channels are out by 02:31:02");

      // 9. Polling: up to 10 s late, and polls all day.
      t.set("hang", "sms");
      runAs("poll");
      t.expect(s("siren") === "02:31:11" && s("against") === "99 s before the water" && s("polls") === "34,560" &&
        sub("sms") === "02:37:26, try 3" && sub("radio") === "02:31:03, try 1",
        "Polling: sirens 02:31:11, texts 02:37:26, 34,560 polls a day");

      // 10. Adding the town app.
      t.set("app", true);
      t.click("skip");
      a = s("polls") === "43,200" && s("changes") === 0;
      runAs("topic");
      var b = s("changes") === 0 && sub("app") === "02:31:01, try 1";
      runAs("chain");
      t.expect(a && b && s("changes") === 1 && sub("app") === "02:34:05, try 1",
        "Town app: polling 43,200 polls a day; topic needs no gauge change; chain needs one");

      // 11. The chain and a restart: everything in flight is lost.
      t.set("app", false);
      t.set("restart", true);
      t.click("skip");
      t.expect(s("lost") === 4 && s("siren") === "lost" && s("against") === "never sounded" && s("after") === 4,
        "Chain with a restart during the hung SMS call: all 4 alerts lost");
    }
  });
})();
