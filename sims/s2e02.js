/* sims/s2e02-v1.0.0.js  (published as sims/s2e02.js)
   Case s2e02 "The Doorman": a load-balancer sim for the Vesper Hotel's four small servers
   (room-11 to room-14) and the load balancer in front of them that Cas calls the Doorman.

   CHANGELOG
   v1.0.0 (2026-10-07) first version: guests send requests through the Doorman to four rooms.
     Controls: traffic (range, 0 to 100 requests a second), algorithm (round robin, weighted round
     robin, least connections), weights (1:1:1:1, 2:1:1:1, 5:5:5:1), the Wednesday backup on
     room-14 (the slow server), health checks on or off, check interval (5, 10 or 30 s), threshold
     (2, 3 or 5 checks in a row), the room the buttons act on, room stops answering, revive the
     room, drain and remove the room, reset. Stats: requests a second answered and failed, failed
     so far, each room's share in percent, a p95 wait in ms (a teaching model) and the time to
     detect a dead room. selfTest: round robin spreads evenly; without health checks a frozen room
     keeps failing its share; with checks it is out after the threshold, within interval x
     threshold; a revived room rejoins after passing; least connections favors the fast rooms when
     one is slow; weighted round robin gives the configured split; draining finishes the requests
     in progress with 0 failures, and stopping a room instead loses them.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e02-v1.0.0.json):
   - post: 48 requests a second at night, 12 to each of four rooms, each able to finish 20 (60%
     busy), round robin, no health checks, the 10-second timeout, p95 625 ms on the 02:15 line of
     Cas's dashboard, room-13 frozen at 01:47:12 (the sim clock starts at 01:47:00).
   - comments: GET /health, the interval and the threshold (u/grey_pager: every 10 s, out after 3
     misses, so at most 30 s); the Wednesday backup on room-14 (about 4 a second instead of 20, a
     line of 40, about ten seconds' wait, 503 once the line is full); draining and the
     deregistration delay.
   - the second reply option (index 1, the senior answer) and its Part 2: checks every 10 s, out after 3 misses and
     back after 3 answers; room-12 out 25 s after it froze and about 300 requests failed; the other
     three at 16 a second, 80% busy (p95 1,250 ms); least connections giving the backup room about
     3 a second and the others 15; a drained room's 8 requests in progress finishing with none failed.
   - sim.lede: the teaching models below (an idle room answers in 250 ms; least connections settles
     in proportion to how fast each room finishes requests; one threshold for both directions) and
     the clock speed (5 times real time).

   Teaching models (stated in sim.lede and the explanation):
   - Steady state, computed every frame from the current setup, as in s2e01: no api.rand(), so every
     stat is repeatable and the selfTest can assert the story's numbers.
   - A room's p95 answer time: 250 ms / (1 - busy share), capped at a full line (40 / capacity
     seconds). The backup-slowed room answers in 1,250 ms when idle, five times slower, to match 4 a
     second instead of 20. Past capacity the line is full: the extra requests get 503 at once and
     the rest wait the full line (40 / 4 = 10 s on the backup room, as the comment says). The p95
     stat is the slowest room that gets traffic, as in s2e01.
   - Requests in progress at a room: its answered share x its p95 answer time, rounded (12 a second x
     0.625 s = 8 on Sunday; 16 x 1.25 s = 20 with three rooms).
   - Least connections: each room's share is in proportion to 1 / its idle answer time (fast 4,
     backup 0.8). A frozen room holds every request for the 10-second timeout, so it counts as
     1 / 10 = 0.1 and least connections sends it very few. Real least connections behaves that way
     with a server that hangs; one that fails fast would attract more (explain.limits).
   - Requests sent to a frozen room count as failed when they are sent, not 10 s later.
   - Health checks run on one clock for all rooms, every interval from the moment checks were turned
     on or the interval changed. A check to a frozen room fails at once (the check timeout is left
     out). A room that freezes between checks is out between (threshold - 1) x interval and
     threshold x interval later, so the selfTest asserts that range and the exact value for its own
     timing (frozen 5 s after the checks start: out at the 30 s check, 25 s later).

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px):
   - Room boxes are 160 wide. Longest sub "backup: 4/s max" (15 chars, 108px); longest meta
     "draining, 20 left" (17 chars, 112px).
   - The Doorman box is 300 wide. Longest sub "least connections" (17 chars, 122px); longest meta
     "checks every 30 s, 5 in a row" (29 chars, 191px).
   - The group label "LUGGAGE ROOM: FOUR SERVERS" (26 chars, 172px) sits at y 213, above the room
     boxes' top edge at y 231. The fan-out edges carry no labels; the dots show where requests go.

   Catalog note: the board cards health-check and connection-draining (and the same two ids in the
   case's concepts) are not yet concept ids in content/catalog-v1.0.7.json, whose s2e02 entry lists
   load-balancers, l4-vs-l7, round-robin and least-connections. Both ids need adding to the catalog
   when this case is marked ready.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 5;                           // sim seconds per real second
  var START_CLOCK = 1 * 3600 + 47 * 60;    // 01:47:00, early on Sunday
  var NIGHT_RPS = 48;                      // requests a second at night
  var MAX_RPS = 100;
  var RPS_STEP = 4;
  var FAST_CAP = 20;                       // each room can finish 20 requests a second
  var FAST_MS = 250;                       // teaching model: an idle room answers in 250 ms
  var SLOW_CAP = 4;                        // Wednesday backup: room-14 finishes about 4 a second
  var SLOW_MS = 1250;                      // five times slower, to match 4 a second instead of 20
  var LINE = 40;                           // each room's line holds 40 requests
  var TIMEOUT_SEC = 10;                    // a request to a frozen room waits 10 s, then fails
  var ROOM_IDS = [11, 12, 13, 14];
  var SLOW_ROOM = 14;
  var STORY_ROOM = 13;
  var INTERVALS = [5, 10, 30];
  var THRESHOLDS = [2, 3, 5];
  var DEFAULT_INTERVAL = 10;               // the fix: GET /health every 10 s
  var DEFAULT_THRESHOLD = 3;               // the fix: 3 misses out, 3 answers back in
  var EPS = 1e-6;
  var DOT_SPEED = 300;                     // viewBox units per real second

  var ALGOS = [
    { id: "rr", name: "round robin", label: "Round robin" },
    { id: "wrr", name: "weighted round robin", label: "Weighted round robin" },
    { id: "lc", name: "least connections", label: "Least connections" }
  ];

  var WEIGHT_SETS = [
    { id: "1:1:1:1", w: [1, 1, 1, 1] },
    { id: "2:1:1:1", w: [2, 1, 1, 1] },
    { id: "5:5:5:1", w: [5, 5, 5, 1] }
  ];

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  // 1250 -> "1,250". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  // Requests a second: whole numbers from 10 up, one decimal below (least connections can send a
  // frozen room 0.4 a second).
  function rate(v) {
    if (!(v >= 0.05)) return "0";
    if (v >= 9.95) return String(Math.round(v));
    return String(Math.round(v * 10) / 10);
  }

  // Rounds 7.5 up to 8 even when float arithmetic lands on 7.4999999.
  function count(v) { return Math.round(v + EPS); }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  function listWords(items) {
    if (items.length === 1) return String(items[0]);
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  function nodeId(id) { return "r" + id; }
  function roomName(id) { return "room-" + id; }

  function algoOf(id) {
    for (var i = 0; i < ALGOS.length; i++) if (ALGOS[i].id === String(id)) return ALGOS[i];
    return null;
  }

  function weightSet(id) {
    for (var i = 0; i < WEIGHT_SETS.length; i++) if (WEIGHT_SETS[i].id === String(id)) return WEIGHT_SETS[i];
    return null;
  }

  function roomById(S, id) {
    for (var i = 0; i < S.rooms.length; i++) if (S.rooms[i].id === Number(id)) return S.rooms[i];
    return null;
  }

  /* A room is "in" (on the list, gets requests), "out" (taken out by the health checks, still
     checked), "draining" (gets nothing new, finishing what it has) or "removed" (off the list).
     alive is separate: a frozen room can be in, out or removed. */
  function registered(room) { return room.state === "in" || room.state === "out"; }
  function isSlow(S, room) { return S.slow && room.id === SLOW_ROOM; }
  function capOf(S, room) { return isSlow(S, room) ? SLOW_CAP : FAST_CAP; }
  function idleMsOf(S, room) { return isSlow(S, room) ? SLOW_MS : FAST_MS; }

  function weightOf(S, room, k) {
    if (S.algo === "wrr") return (weightSet(S.weights) || WEIGHT_SETS[0]).w[k];
    if (S.algo === "lc") return room.alive ? 1000 / idleMsOf(S, room) : 1 / TIMEOUT_SEC;
    return 1;
  }

  /* ---------- the diagram ---------- */

  var ROOM_X = [100, 280, 460, 640];
  var ROOM_Y = 262;

  var DIAGRAM = (function () {
    var nodes = [
      { id: "guests", label: "Guests", sub: "48 req/s", x: 370, y: 36, w: 220, h: 52, shape: "box", tone: "" },
      { id: "doorman", label: "The Doorman", sub: "round robin", meta: "never checks a room", x: 370, y: 128, w: 300, h: 62, shape: "box", tone: "" }
    ];
    var edges = [{ from: "guests", to: "doorman" }];
    for (var k = 0; k < ROOM_IDS.length; k++) {
      nodes.push({
        id: nodeId(ROOM_IDS[k]), label: roomName(ROOM_IDS[k]), sub: "fast: 20/s max", meta: "12/s, 60% busy",
        x: ROOM_X[k], y: ROOM_Y, w: 160, h: 62, shape: "box", tone: "ok"
      });
      edges.push({ from: "doorman", to: nodeId(ROOM_IDS[k]) });
    }
    return {
      type: "arch",
      w: 740,
      h: 330,
      aria: "Load balancer sim. Guests send requests to the Doorman, a load balancer, which hands them to four small servers named room-11, room-12, room-13 and room-14 in the Vesper Hotel's old luggage room. At the start it uses round robin, 12 requests a second to each room, and never checks whether a room is alive.",
      groups: [
        { label: "Luggage room: four servers", x: 10, y: 196, w: 720, h: 112 }
      ],
      nodes: nodes,
      edges: edges
    };
  })();

  /* ---------- the model ---------- */

  /* Steady state for the current setup. The Doorman splits the traffic over the rooms on its list
     by the algorithm's weights. A live room answers min(share, capacity); the rest of its share gets
     503 because its line is full. A frozen room answers nothing: its share fails. */
  function compute(S) {
    var r = {
      served: 0, rejected: 0, noAnswer: 0, failed: 0, p95: -1, maxU: 0,
      inCount: 0, deadIn: 0, outCount: 0, per: {}
    };
    var sumW = 0;
    var k, room, p;
    for (k = 0; k < S.rooms.length; k++) {
      room = S.rooms[k];
      p = { w: 0, share: 0, pct: 0, u: 0, served: 0, ans: 0, inflight: 0, failFrac: 0 };
      r.per[room.id] = p;
      if (room.state === "in") {
        p.w = weightOf(S, room, k);
        sumW += p.w;
        r.inCount += 1;
      } else if (room.state === "out") {
        r.outCount += 1;
      }
    }
    for (k = 0; k < S.rooms.length; k++) {
      room = S.rooms[k];
      p = r.per[room.id];
      if (room.state !== "in" || !(sumW > 0)) continue;
      p.pct = 100 * p.w / sumW;
      p.share = S.rps * p.w / sumW;
      if (room.alive) {
        var cap = capOf(S, room);
        var full = LINE / cap * 1000;
        p.u = p.share / cap;
        p.served = Math.min(p.share, cap);
        p.ans = p.u >= 1 ? full : Math.min(idleMsOf(S, room) / (1 - p.u), full);
        p.inflight = p.served * p.ans / 1000;
        p.failFrac = p.share > 0 ? (p.share - p.served) / p.share : 0;
        r.served += p.served;
        r.rejected += p.share - p.served;
        if (p.u > r.maxU) r.maxU = p.u;
        if (p.share > 0 && p.ans > r.p95) r.p95 = p.ans;
      } else {
        p.failFrac = 1;
        r.noAnswer += p.share;
        r.deadIn += 1;
      }
    }
    r.failed = r.rejected + r.noAnswer;
    return r;
  }

  function detectText(S) {
    for (var i = 0; i < S.rooms.length; i++) {
      if (!S.rooms[i].alive && S.rooms[i].state === "in") return S.checks ? "-" : "never";
    }
    return S.lastDetect === null ? "-" : Math.round(S.lastDetect + EPS);
  }

  function situation(S, r) {
    if (S.rps > 0 && r.served < 0.05) return "down";
    if (r.rejected >= 0.05) return "over";
    if (r.noAnswer >= 0.05) return "partial";
    if (r.maxU >= 0.9) return "near";
    return "ok";
  }

  function sitKey(S, r) {
    return [situation(S, r), r.inCount, r.deadIn, S.algo, S.slow ? 1 : 0, S.checks ? 1 : 0].join("|");
  }

  function narrate(api, r) {
    var S = api.state;
    var key = sitKey(S, r);
    if (key === S.sitKey) return;
    S.sitKey = key;
    var sit = situation(S, r);
    var p95 = fmt(r.p95);
    var pct = Math.round(Math.min(r.maxU, 1) * 100);
    if (sit === "down") {
      api.log(r.inCount ? "Nothing gets an answer: every room on the Doorman's list is frozen. All " + fmt(S.rps) + " requests a second fail."
        : "Nothing gets an answer: the Doorman has no room on its list. All " + fmt(S.rps) + " requests a second fail.", "bad");
    } else if (sit === "over") {
      api.log("A room is past its limit. Its line of 40 is full, so " + rate(r.rejected) + " requests a second get 503 at once" +
        (r.noAnswer >= 0.05 ? ", and " + rate(r.noAnswer) + " a second go to a frozen room" : "") +
        ". Those who get in wait up to " + p95 + " ms (p95).", "bad");
    } else if (sit === "partial") {
      var why = S.checks ? "The health checks haven't caught it yet." : "The Doorman doesn't know: it never checks.";
      if (S.algo === "lc") why += " Least connections sends it very few, because its requests pile up for 10 s each and it always looks busy.";
      api.log(rate(r.noAnswer) + " requests a second go to a frozen room. Each waits 10 s, then fails. " + why +
        " The other " + rate(r.served) + " get an answer, p95 " + p95 + " ms.", "warn");
    } else if (sit === "near") {
      api.log("Every request gets an answer, but the busiest room is " + pct + "% busy and the p95 wait is " + p95 + " ms.", "warn");
    } else if (S.rps > 0) {
      api.log("Every request gets an answer. The busiest room is " + pct + "% busy and the p95 wait is " + p95 + " ms.", "ok");
    }
  }

  /* ---------- drawing ---------- */

  function algoText(S) {
    if (S.algo === "wrr") return "weighted " + S.weights;
    return (algoOf(S.algo) || ALGOS[0]).name;
  }

  function drainLeft(room) {
    if (!(room.drainTime > 0)) return 0;
    return Math.max(0, Math.ceil(room.drainCount * room.drainLeft / room.drainTime - EPS));
  }

  function drawRoom(api, room, r) {
    var S = api.state;
    var node = api.node(nodeId(room.id));
    var p = r.per[room.id];
    var meta, tone;
    node.text("sub", isSlow(S, room) ? "backup: 4/s max" : "fast: 20/s max");
    if (room.state === "removed") {
      meta = "removed";
      tone = "muted";
    } else if (room.state === "draining") {
      meta = "draining, " + drainLeft(room) + " left";
      tone = "warn";
    } else if (room.state === "out") {
      meta = room.alive ? "out: " + room.passes + " of " + S.threshold + " ok" : "out: no answer";
      tone = "muted";
    } else if (!room.alive) {
      meta = S.checks && room.fails > 0 ? "missed " + room.fails + " of " + S.threshold : "no answer: " + rate(p.share) + "/s";
      tone = "bad";
    } else if (S.rps <= 0) {
      meta = "idle";
      tone = "ok";
    } else if (p.u >= 1) {
      meta = rate(p.share) + "/s: line full";
      tone = "bad";
    } else {
      meta = rate(p.share) + "/s, " + Math.round(p.u * 100) + "% busy";
      tone = p.u >= 0.9 ? "warn" : "ok";
    }
    node.text("meta", meta);
    node.set(tone);
    api.edge("doorman", nodeId(room.id)).set(room.state === "in" ? "" : "cut");
  }

  function draw(api, r) {
    var S = api.state;
    api.node("guests").text("sub", fmt(S.rps) + " req/s");
    var d = api.node("doorman");
    d.text("sub", algoText(S));
    if (!r.inCount) {
      d.text("meta", "no room on its list");
      d.set("bad");
    } else {
      d.text("meta", S.checks ? "checks every " + S.interval + " s, " + S.threshold + " in a row" : "never checks a room");
      d.set("");
    }
    for (var k = 0; k < S.rooms.length; k++) drawRoom(api, S.rooms[k], r);

    S.stat.served(rate(r.served));
    S.stat.failed(rate(r.failed));
    S.stat.lost(count(S.lost));
    S.stat.share(ROOM_IDS.map(function (id) { return Math.round(r.per[id].pct + EPS); }).join("/"));
    S.stat.p95(r.served >= 0.05 && r.p95 >= 0 ? Math.round(r.p95) : "-");
    S.stat.detect(detectText(S));

    var sel = roomById(S, S.sel);
    S.ctl.kill.disable(!(sel && sel.alive && registered(sel)));
    S.ctl.revive.disable(!(sel && (!sel.alive || sel.state === "removed")));
    S.ctl.drain.disable(!(sel && registered(sel)));
  }

  function refresh(api) { draw(api, compute(api.state)); }

  /* ---------- dots: a visual sample, never counted ---------- */

  function requestDots(api, dt, r) {
    var S = api.state;
    if (api.reducedMotion || S.rps <= 0) return;
    S.dotClock += dt;
    var every = Math.min(1.2, Math.max(0.09, 2.5 / Math.sqrt(S.rps)));
    if (S.dotClock < every) return;
    S.dotClock = 0;
    var list = S.rooms.filter(function (room) { return room.state === "in"; });
    if (!list.length) {
      api.dot({ path: ["guests", "doorman"], cls: "dot-fail", r: 4, speed: DOT_SPEED });
      return;
    }
    // Smooth weighted round robin over the current shares, so the sample follows the split.
    var best = null;
    var total = 0;
    list.forEach(function (room) {
      var w = r.per[room.id].pct;
      room.cur += w;
      total += w;
      if (!best || room.cur > best.cur) best = room;
    });
    best.cur -= total;
    var hang = !best.alive;
    var fail = true;
    if (!hang) {
      best.acc += r.per[best.id].failFrac;
      fail = best.acc >= 1 - EPS;
      if (fail) best.acc -= 1;
    }
    var target = nodeId(best.id);
    api.dot({
      path: ["guests", "doorman", target], cls: "dot-req", r: 4, speed: DOT_SPEED,
      onArrive: function (dot, wp) {
        if (!dot) return;
        if (wp === "doorman" && !hang) dot.cls(fail ? "dot-fail" : "dot-ok");
        if (wp === target && hang) {
          // A frozen room holds the request for the 10-second timeout (2 real seconds), then it fails.
          dot.cls("dot-fail");
          dot.park();
          api.after(TIMEOUT_SEC / SPEED, function () { dot.remove(); });
        }
      }
    });
  }

  function checkDot(api, room) {
    if (api.reducedMotion) return;
    var target = nodeId(room.id);
    if (room.alive) {
      api.dot({
        path: ["doorman", target, "doorman"], cls: "dot-wait", r: 3, speed: DOT_SPEED,
        onArrive: function (dot, wp) { if (dot && wp === target) dot.cls("dot-ok"); }
      });
    } else {
      api.dot({
        path: ["doorman", target], cls: "dot-wait", r: 3, speed: DOT_SPEED,
        onArrive: function (dot, wp) {
          if (!dot || wp !== target) return;
          dot.cls("dot-fail");
          dot.park();
          api.after(1, function () { dot.remove(); });
        }
      });
    }
  }

  /* ---------- health checks ---------- */

  function runChecks(api, at) {
    var S = api.state;
    var T = S.threshold;
    S.rooms.forEach(function (room) {
      if (!registered(room)) return;
      checkDot(api, room);
      var name = roomName(room.id);
      if (room.alive) {
        room.fails = 0;
        if (room.state !== "out") return;
        room.passes += 1;
        if (room.passes >= T) {
          room.state = "in";
          room.passes = 0;
          api.log(name + " answered " + T + " checks in a row. The Doorman puts it back on its list.", "ok");
        } else {
          api.log(name + " answered a check (" + room.passes + " of " + T + "). Not trusted yet: it still gets no guests.", "");
        }
        return;
      }
      room.passes = 0;
      room.fails += 1;
      if (room.state !== "in") return;
      if (room.fails >= T) {
        room.state = "out";
        S.lastDetect = at - room.diedAt;
        api.log(name + " missed " + T + " checks in a row. The Doorman takes it out, " + Math.round(S.lastDetect + EPS) +
          " s after it froze (never more than " + T + " checks x " + S.interval + " s = " + (T * S.interval) + " s).", "ok");
      } else {
        api.log(name + " missed a check (" + room.fails + " of " + T + "). It still gets its share.", "warn");
      }
    });
  }

  /* ---------- controls ---------- */

  function setTraffic(api, v) {
    var S = api.state;
    var n = Number(v);
    if (!isFinite(n)) return;
    S.rps = Math.max(0, Math.min(MAX_RPS, Math.round(n)));
    refresh(api);
  }

  function setAlgo(api, v) {
    var S = api.state;
    var a = algoOf(v);
    if (!a || a.id === S.algo) return;
    S.algo = a.id;
    if (a.id === "rr") {
      api.log("Round robin: each room on the list gets the next request in turn, whatever it's doing.", "");
    } else if (a.id === "wrr") {
      api.log("Weighted round robin with weights " + S.weights + " for rooms 11, 12, 13 and 14: each room's share follows its weight.", "");
    } else {
      api.log("Least connections: each new request goes to the room with the fewest requests in progress, so a slow or stuck room gets fewer.", "");
    }
    refresh(api);
  }

  function setWeights(api, v) {
    var S = api.state;
    var set = weightSet(v);
    if (!set || set.id === S.weights) return;
    S.weights = set.id;
    api.log("Weights " + set.id + " for rooms 11, 12, 13 and 14." +
      (S.algo === "wrr" ? "" : " They only count under weighted round robin."), "");
    refresh(api);
  }

  function setSlow(api, on) {
    var S = api.state;
    S.slow = !!on;
    if (S.slow) {
      api.log("The Wednesday backup starts on room-14. While it runs, room-14 finishes about 4 requests a second instead of 20, five times slower.", "warn");
    } else {
      api.log("The backup finishes, and room-14 is back to 20 requests a second.", "ok");
    }
    refresh(api);
  }

  function setChecks(api, on) {
    var S = api.state;
    S.checks = !!on;
    S.rooms.forEach(function (room) { room.fails = 0; room.passes = 0; });
    if (S.checks) {
      S.nextCheck = S.t + S.interval;
      api.log("Health checks on. Every " + S.interval + " s the Doorman asks each room GET /health. " + S.threshold +
        " misses in a row and a room is out; " + S.threshold + " answers in a row and it's back.", "ok");
    } else {
      var back = [];
      S.rooms.forEach(function (room) {
        if (room.state === "out") { room.state = "in"; back.push(roomName(room.id)); }
      });
      api.log("Health checks off. The Doorman stops asking" +
        (back.length ? " and puts " + listWords(back) + " back on its list, answering or not." : ". It will never notice a frozen room."), "warn");
    }
    refresh(api);
  }

  function changeInterval(api, v) {
    var S = api.state;
    var n = Number(v);
    if (INTERVALS.indexOf(n) < 0 || n === S.interval) return;
    S.interval = n;
    if (S.checks) S.nextCheck = S.t + n;
    api.log("Checks every " + n + " s. Worst case to notice a frozen room: " + S.threshold + " checks x " + n + " s = " + (S.threshold * n) + " s.", "");
    refresh(api);
  }

  function changeThreshold(api, v) {
    var S = api.state;
    var n = Number(v);
    if (THRESHOLDS.indexOf(n) < 0 || n === S.threshold) return;
    S.threshold = n;
    api.log("Threshold " + n + ": " + n + " misses in a row take a room out, " + n + " answers in a row bring it back. Worst case to notice: " +
      n + " checks x " + S.interval + " s = " + (n * S.interval) + " s.", "");
    refresh(api);
  }

  function setRoom(api, v) {
    var S = api.state;
    if (!roomById(S, v)) return;
    S.sel = Number(v);
    refresh(api);
  }

  function kill(api) {
    var S = api.state;
    var room = roomById(S, S.sel);
    if (!room || !room.alive || !registered(room)) return;
    var wasIn = room.state === "in";
    var lostNow = wasIn ? count(compute(S).per[room.id].inflight) : 0;
    room.alive = false;
    room.diedAt = S.t;
    room.fails = 0;
    room.passes = 0;
    room.acc = 0;
    S.lost += lostNow;
    var name = roomName(room.id);
    var msg;
    if (!wasIn) {
      msg = name + " freezes. It was already off the Doorman's list, so no guest is sent there.";
    } else {
      S.lastDetect = null;
      msg = name + " freezes and stops answering. The " + plural(lostNow, "request", "requests") + " it was in the middle of " +
        (lostNow === 1 ? "is" : "are") + " lost.";
      if (S.checks) msg += " The health checks will notice after " + S.threshold + " misses in a row: within " + (S.threshold * S.interval) + " s.";
      else msg += " The Doorman doesn't notice: it keeps sending it its share, and each request waits 10 s, then fails.";
    }
    api.log(msg, "bad");
    refresh(api);
  }

  function revive(api) {
    var S = api.state;
    var room = roomById(S, S.sel);
    if (!room) return;
    var name = roomName(room.id);
    if (room.state === "removed") {
      room.alive = true;
      room.fails = 0;
      room.passes = 0;
      room.acc = 0;
      if (S.checks) {
        room.state = "out";
        api.log("You add " + name + " back to the Doorman's list. It must answer " + S.threshold + " checks in a row before it gets guests.", "");
      } else {
        room.state = "in";
        api.log("You add " + name + " back to the Doorman's list. With no health checks, it gets its share at once.", "");
      }
    } else if (!room.alive) {
      room.alive = true;
      room.fails = 0;
      room.passes = 0;
      room.acc = 0;
      if (room.state === "out") {
        api.log("Cas restarts " + name + ". It must answer " + S.threshold + " checks in a row before the Doorman trusts it again.", "");
      } else {
        api.log("Cas restarts " + name + " and it answers again. It never left the Doorman's list" +
          (S.checks ? ": the checks hadn't taken it out yet." : "."), "ok");
      }
    } else {
      return;
    }
    refresh(api);
  }

  function drain(api) {
    var S = api.state;
    var room = roomById(S, S.sel);
    if (!room || !registered(room)) return;
    var name = roomName(room.id);
    if (!room.alive) {
      room.state = "removed";
      room.fails = 0;
      room.passes = 0;
      api.log("You drain and remove " + name + ". It's frozen, so there is nothing to wait for: it's removed at once.", "");
      refresh(api);
      return;
    }
    var p = compute(S).per[room.id];
    var n = room.state === "in" ? count(p.inflight) : 0;
    if (n <= 0) {
      room.state = "removed";
      room.fails = 0;
      room.passes = 0;
      api.log("You drain and remove " + name + ". It had nothing in progress, so it's removed at once.", "");
      refresh(api);
      return;
    }
    room.state = "draining";
    room.drainCount = n;
    room.drainTime = p.ans / 1000;
    room.drainLeft = room.drainTime;
    api.log("You drain " + name + ". The Doorman sends it nothing new and waits for the " + plural(n, "request", "requests") +
      " it's in the middle of to finish.", "");
    refresh(api);
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.rooms) return;
    var simDt = dt * api.speed;
    S.t += simDt;

    S.rooms.forEach(function (room) {
      if (room.state !== "draining") return;
      room.drainLeft -= simDt;
      if (room.drainLeft > EPS) return;
      room.drainLeft = 0;
      room.state = "removed";
      room.fails = 0;
      room.passes = 0;
      api.log(roomName(room.id) + " finished all " + plural(room.drainCount, "request", "requests") +
        " in progress. The Doorman removes it: 0 failed.", "ok");
    });

    if (S.checks) {
      var guard = 0;
      while (S.t + EPS >= S.nextCheck && guard < 100) {
        runChecks(api, S.nextCheck);
        S.nextCheck += S.interval;
        guard += 1;
      }
    }

    var r = compute(S);
    S.lost += r.failed * simDt;
    narrate(api, r);
    draw(api, r);
    requestDots(api, dt, r);
  }

  /* ---------- "what is this box" ---------- */

  function roomInfo(id) {
    return function (S, r) {
      var room = roomById(S, id);
      var p = r.per[id];
      var head = "<strong>" + roomName(id) + ".</strong> ";
      var base = head + "One of the four small servers in the Vesper's old luggage room, named after a room on the first floor. It can finish " +
        (isSlow(S, room) ? "only 4 requests a second while the Wednesday backup runs" : "20 requests a second") +
        ". Past that, requests wait in its line of 40, and when the line is full they get 503 at once. ";
      if (room.state === "removed") return base + "It's off the Doorman's list. <em>Revive the room</em> adds it back.";
      if (room.state === "draining") return base + "It's draining: the Doorman sends it nothing new while it finishes the " + drainLeft(room) + " requests still in progress.";
      if (room.state === "out") {
        return base + "The health checks took it out, so it gets no guests. " +
          (room.alive ? "It has answered " + room.passes + " of the " + S.threshold + " checks in a row it needs to come back." : "It's frozen and still missing every check.");
      }
      if (!room.alive) {
        return base + "It's frozen. Every request sent to it waits 10 seconds, then fails. " +
          (S.checks ? "The health checks will take it out after " + S.threshold + " misses in a row." : "Without health checks the Doorman never finds out.");
      }
      return base + "Right now it gets " + rate(p.share) + " requests a second" +
        (p.u >= 1 ? ": more than it can finish, so its line is full." : ", " + Math.round(p.u * 100) + "% busy.");
    };
  }

  var INFO = {
    guests: function (S) {
      return "<strong>Guests.</strong> Everyone using the Vesper's kiosks, booking website and key-card machine, as requests. About 48 a second at night, as on Sunday. Use the traffic slider to change it. Right now: " + fmt(S.rps) + " a second.";
    },
    doorman: function (S) {
      var how;
      if (S.algo === "wrr") how = "weighted round robin with weights " + S.weights + ": a room with weight 2 gets twice the share of a room with weight 1.";
      else if (S.algo === "lc") how = "least connections: each request goes to the room with the fewest requests in progress.";
      else how = "round robin: each room gets the next request in turn.";
      return "<strong>The Doorman.</strong> Cas's load balancer. Every request comes to it, and it picks a room by " + how + " " +
        (S.checks ? "Health checks are on: every " + S.interval + " s it asks each room GET /health, takes a room out after " + S.threshold +
          " misses in a row and lets it back after " + S.threshold + " answers."
          : "It never checks whether a room is alive, so a frozen room keeps its share until someone removes it.") +
        " It's one machine too: if it stopped, nobody could reach any room.";
    }
  };
  for (var i = 0; i < ROOM_IDS.length; i++) INFO[nodeId(ROOM_IDS[i])] = roomInfo(ROOM_IDS[i]);

  /* ---------- the module ---------- */

  DL.sims.define("s2e02", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.t = 0;
      S.rps = NIGHT_RPS;
      S.algo = "rr";
      S.weights = WEIGHT_SETS[0].id;
      S.slow = false;
      S.checks = false;
      S.interval = DEFAULT_INTERVAL;
      S.threshold = DEFAULT_THRESHOLD;
      S.nextCheck = 0;
      S.rooms = ROOM_IDS.map(function (id) {
        return { id: id, alive: true, state: "in", fails: 0, passes: 0, diedAt: 0, drainCount: 0, drainTime: 0, drainLeft: 0, acc: 0, cur: 0 };
      });
      S.sel = STORY_ROOM;
      S.lost = 0;
      S.lastDetect = null;
      S.dotClock = 0;
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.traffic = api.control.range("traffic", "Traffic (requests a second)", 0, MAX_RPS, RPS_STEP, NIGHT_RPS,
        function (v) { setTraffic(api, v); }, { format: function (v) { return fmt(v) + "/s"; } });
      S.ctl.algo = api.control.select("algo", "Algorithm",
        ALGOS.map(function (a) { return { value: a.id, label: a.label }; }), "rr", function (v) { setAlgo(api, v); });
      S.ctl.weights = api.control.select("weights", "Weights, rooms 11:12:13:14 (weighted only)",
        WEIGHT_SETS.map(function (s) { return { value: s.id, label: s.id }; }), WEIGHT_SETS[0].id, function (v) { setWeights(api, v); });
      S.ctl.slow = api.control.toggle("slow", "Wednesday backup on room-14", false, function (on) { setSlow(api, on); });
      S.ctl.checks = api.control.toggle("checks", "Health checks", false, function (on) { setChecks(api, on); });
      S.ctl.interval = api.control.select("interval", "Check interval",
        INTERVALS.map(function (n) { return { value: String(n), label: "every " + n + " s" }; }), String(DEFAULT_INTERVAL),
        function (v) { changeInterval(api, v); });
      S.ctl.threshold = api.control.select("threshold", "Threshold (checks in a row)",
        THRESHOLDS.map(function (n) { return { value: String(n), label: n + " in a row" }; }), String(DEFAULT_THRESHOLD),
        function (v) { changeThreshold(api, v); });
      S.ctl.room = api.control.select("room", "Room the buttons act on",
        ROOM_IDS.map(function (id) { return { value: String(id), label: roomName(id) }; }), String(STORY_ROOM),
        function (v) { setRoom(api, v); });
      S.ctl.kill = api.control.button("kill", "Room stops answering", function () { kill(api); }, { tone: "danger" });
      S.ctl.revive = api.control.button("revive", "Revive the room", function () { revive(api); });
      S.ctl.drain = api.control.button("drain", "Drain and remove the room", function () { drain(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        served: api.stat("served", "requests/s answered", "ok"),
        failed: api.stat("failed", "requests/s failed or 503", "bad"),
        lost: api.stat("lost", "failed so far", "bad"),
        share: api.stat("share", "share %, rooms 11/12/13/14", ""),
        p95: api.stat("p95", "p95 wait, ms (teaching model)", "warn"),
        detect: api.stat("detect", "time to detect a dead room, s", "")
      };

      var r = compute(S);
      S.sitKey = sitKey(S, r);
      draw(api, r);

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state, compute(api.state)));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");
      api.log("1:47 AM, early on Sunday at the Vesper. 48 requests a second arrive, and the Doorman hands them out in turn: 12 to each room, and each room can finish 20. It never checks whether a room is alive.", "");
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }
      function shares() { return String(t.stat("share")).split("/").map(Number); }
      function same(a, b) {
        if (a.length !== b.length) return false;
        for (var j = 0; j < a.length; j++) if (a[j] !== b[j]) return false;
        return true;
      }

      // 1. Sunday night: round robin over four live rooms.
      await t.run(1);
      t.expect(n("served") === 48 && n("failed") === 0 && same(shares(), [25, 25, 25, 25]) && n("p95") === 625,
        "round robin spreads Sunday night evenly: 12 requests a second to each room (25% each), all answered, p95 625 ms");

      // 2. Room 13 freezes with no health checks.
      t.click("kill");
      t.expect(n("lost") === 8, "room-13 freezes and the 8 requests it was in the middle of are lost (12 a second x 0.625 s)");
      await t.run(4);
      t.expect(n("served") === 36 && n("failed") === 12 && same(shares(), [25, 25, 25, 25]) && t.stat("detect") === "never" &&
        t.node("r13").state === "bad",
        "without health checks the frozen room keeps its quarter: 12 requests a second fail and the Doorman never notices");
      var before = n("lost");
      await t.run(8);
      t.expect(n("failed") === 12 && Math.abs(n("lost") - before - 480) <= 2,
        "40 seconds later it is still failing its share: about 480 more requests lost, 12 every second");

      // 3. Health checks every 10 s, threshold 3: room 13 freezes 5 s into the checks.
      t.click("reset");
      t.set("checks", true);
      await t.run(1);
      t.click("kill");
      await t.run(4);
      t.expect(n("failed") === 12 && same(shares(), [25, 25, 25, 25]) && t.stat("detect") === "-" && t.node("r13").text.meta === "missed 2 of 3",
        "with checks every 10 s and a threshold of 3, two misses are not enough: room-13 still gets its 12 a second");
      await t.run(2);
      var d = n("detect");
      t.expect(d === 25 && d <= 10 * 3 && d > 10 * 2 && n("failed") === 0 && n("served") === 48 && same(shares(), [33, 33, 0, 33]) && n("p95") === 1250,
        "the third miss takes room-13 out 25 s after it froze, within interval x threshold (30 s); the other three answer 16 a second each, p95 1,250 ms");
      t.expect(Math.abs(n("lost") - 308) <= 2,
        "the price of detection: the 8 requests in progress plus 12 a second for 25 s, about 308 lost");

      // 4. Revive room 13: it must pass three checks before it gets guests again.
      t.click("revive");
      await t.run(4);
      t.expect(same(shares(), [33, 33, 0, 33]) && t.node("r13").text.meta === "out: 2 of 3 ok",
        "a revived room is not trusted at once: after two answers it is still out and gets no guests");
      await t.run(2);
      t.expect(same(shares(), [25, 25, 25, 25]) && n("failed") === 0 && n("served") === 48,
        "after three answers in a row room-13 rejoins and gets its quarter again");

      // 5. Wednesday: the backup slows room-14. Round robin, then least connections.
      t.click("reset");
      t.set("slow", true);
      await t.run(1);
      t.expect(same(shares(), [25, 25, 25, 25]) && n("served") === 40 && n("failed") === 8 && n("p95") === 10000,
        "under round robin the backup room still gets 12 a second but finishes 4: its line of 40 is full, 8 a second get 503 and the rest wait 10 s");
      t.set("algo", "lc");
      await t.run(1);
      t.expect(same(shares(), [31, 31, 31, 6]) && n("served") === 48 && n("failed") === 0 && n("p95") === 5000,
        "least connections favors the fast rooms: 15 a second each and 3 to the backup room, and nobody gets a 503");

      // 6. Weighted round robin gives the configured split.
      t.set("slow", false);
      t.set("algo", "wrr");
      t.set("weights", "2:1:1:1");
      await t.run(1);
      t.expect(same(shares(), [40, 20, 20, 20]) && n("served") === 48 && n("failed") === 0,
        "weighted round robin with weights 2:1:1:1 sends 40% to room-11 and 20% to each of the others");

      // 7. Drain room 12: nothing new goes there, and what it was doing finishes.
      t.click("reset");
      t.set("room", "12");
      await t.run(1);
      t.click("drain");
      t.expect(String(t.node("r12").text.meta).indexOf("draining, 8") === 0 && same(shares(), [33, 0, 33, 33]) && n("lost") === 0,
        "draining room-12: the Doorman sends it nothing new while it finishes the 8 requests it is in the middle of");
      await t.run(1);
      t.expect(t.node("r12").text.meta === "removed" && n("lost") === 0 && n("failed") === 0 && n("served") === 48,
        "the drain finishes with 0 failures: room-12 is removed and the other three answer all 48 a second");
      t.set("room", "11");
      t.click("kill");
      t.expect(n("lost") === 20,
        "stopping a room instead loses the 20 requests it was in the middle of (16 a second x 1.25 s)");
    }
  });
})();
