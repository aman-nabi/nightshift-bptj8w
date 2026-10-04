/* sims/s8e01-v1.0.0.js
   CHANGELOG
   v1.0.0 (2026-10-04) first version

   Season 8, case 1: the pilot sim. Ported from the live system in
   mockup/dead-letter-mockup-v1.0.1.html to the DL.sims module API.
   Customers send requests to a load balancer, which spreads them over
   app-1, app-2 and app-3; the app servers write to the orders database.
   A Head of Shift coordinator listens to heartbeats, declares a silent
   machine dead after the timeout, and hands its orders to another machine
   with a higher token. Freeze and wake app-2, give app-1 a tiny 8s pause,
   pick the timeout, and turn fencing tokens on or off.
   Clock: starts at 02:13:00 and runs 5x faster than real time. All timers
   and dot travel use real seconds, exactly as in the mockup.
*/
(function (root) {
  "use strict";
  var DL = root.DL;
  if (!DL || !DL.sims || typeof DL.sims.define !== "function") {
    throw new Error("engine/sim.js must load before sims/s8e01.js.");
  }

  var START = 2 * 3600 + 13 * 60;   // 02:13:00, as in the story
  var SPEED = 5;                    // sim seconds per real second
  // Built from char codes so the source stays plain ASCII.
  var RANGE_SEP = String.fromCharCode(0x2013);              // en dash in order ranges, as in the mockup
  var MID = " " + String.fromCharCode(0xB7) + " ";          // middle dot separator
  var TIMES = String.fromCharCode(0xD7);                    // multiplication sign, as in "3x" traffic
  var HICCUP = 8;                   // sim seconds of the tiny pause on app-1
  var PARK_X = 333;                 // waiting requests queue just left of the app boxes
  var MAX_PARKED = 16;

  // Settings kept across "Reset the night" (traffic, timeout, fencing), as in
  // the mockup. Set and consumed inside one synchronous reset call.
  var carry = null;

  var APPS = [
    { id: "app1", name: "app-1", y: 80, batch: { id: "A", orders: ["#4468", "#4469", "#4470"], token: 31 } },
    { id: "app2", name: "app-2", y: 180, batch: { id: "B", orders: ["#4471", "#4472", "#4473"], token: 33 } },
    { id: "app3", name: "app-3", y: 280, batch: { id: "C", orders: ["#4474", "#4475", "#4476"], token: 32 } }
  ];

  var DIAGRAM = {
    type: "arch", w: 740, h: 440,
    aria: "OP's system. Customers send requests to a load balancer, which routes them to three app servers. " +
      "The app servers write to the orders database. A Head of Shift coordinator listens to the app servers' " +
      "heartbeats and tells the load balancer which ones are alive.",
    groups: [{ label: "APP SERVERS", x: 340, y: 22, w: 200, h: 308 }],
    nodes: [
      { id: "users", label: "Customers", meta: "placing orders", x: 70, y: 180, w: 100, h: 56, shape: "box" },
      { id: "lb", label: "Load balancer", sub: "3 of 3 alive", x: 245, y: 180, w: 120, h: 60, shape: "box" },
      { id: "app1", label: "app-1", sub: "healthy", meta: "#4468" + RANGE_SEP + "70" + MID + "token 31",
        x: 440, y: 80, w: 180, h: 64, shape: "box", align: "left", tone: "ok" },
      { id: "app2", label: "app-2", sub: "healthy", meta: "#4471" + RANGE_SEP + "73" + MID + "token 33",
        x: 440, y: 180, w: 180, h: 64, shape: "box", align: "left", tone: "ok" },
      { id: "app3", label: "app-3", sub: "healthy", meta: "#4474" + RANGE_SEP + "76" + MID + "token 32",
        x: 440, y: 280, w: 180, h: 64, shape: "box", align: "left", tone: "ok" },
      { id: "coord", label: "Head of Shift (coordinator)", sub: "app-1 ok" + MID + "app-2 ok" + MID + "app-3 ok",
        x: 440, y: 397, w: 260, h: 58, shape: "box" },
      { id: "db", label: "Orders database", sub: "#4471" + RANGE_SEP + "73: token 33", meta: "fencing: off",
        x: 655, y: 180, w: 140, h: 72, shape: "db" }
    ],
    edges: [
      { from: "users", to: "lb", label: "requests" },
      { from: "lb", to: "app1" },
      { from: "lb", to: "app2" },
      { from: "lb", to: "app3" },
      { from: "app1", to: "db" },
      { from: "app2", to: "db", label: "writes" },
      { from: "app3", to: "db" },
      { from: "app3", to: "coord" },
      { from: "coord", to: "lb", via: [[245, 397]], dash: true, label: "who's alive", at: 0.7 }
    ],
    notes: [{ x: 448, y: 352, text: "heartbeats, every 1s", tone: "muted", anchor: "start" }]
  };

  var TIP = "<strong>Tip:</strong> click any box in the diagram to see what it does in plain words.";

  /* ---------- helpers ---------- */

  function range(b) {
    var first = b.orders[0], last = b.orders[b.orders.length - 1];
    return first + RANGE_SEP + (first.slice(0, -2) === last.slice(0, -2) ? last.slice(-2) : last.slice(1));
  }

  function mkApp(spec, now) {
    return {
      id: spec.id, name: spec.name, y: spec.y,
      status: "alive", frozen: false, frozeAt: 0, lastBeat: now, hiccupUntil: null,
      batch: { id: spec.batch.id, orders: spec.batch.orders.slice(), token: spec.batch.token },
      extra: [], ghost: null, stuck: [], stuckExtra: 0
    };
  }

  // What a box shows for one app server: node state, status line, heartbeat word.
  function appView(api, a) {
    var S = api.state;
    var silent = Math.max(0, Math.floor(api.clock - a.lastBeat));
    if (a.status === "alive" && a.frozen) {
      return { state: "warn", status: "silent " + silent + "s of " + S.timeout + "s", hb: silent + "s", counting: true };
    }
    if (a.status === "dead") return { state: "bad", status: "DECLARED DEAD", hb: "dead", counting: false };
    if (a.status === "zombie") return { state: "zombie", status: "ZOMBIE (thinks alive)", hb: "dead", counting: false };
    return { state: "ok", status: "healthy", hb: "ok", counting: false };
  }

  /* ---------- rendering (every frame and after every event) ---------- */

  function render(api) {
    var S = api.state;
    if (!S.apps || !S.ui) return;
    var alive = S.apps.filter(function (a) { return a.status === "alive"; }).length;
    api.node("lb").text("sub", alive + " of 3 alive");
    var waiting = 0, beats = [], counting = false;
    S.apps.forEach(function (a) {
      var v = appView(api, a);
      var n = api.node(a.id);
      n.set(v.state);
      n.text("sub", v.status);
      var meta = "no orders";
      if (a.batch) meta = range(a.batch) + MID + "token " + a.batch.token;
      else if (a.ghost && a.ghost.length) meta = "old: " + range(a.ghost[0]) + MID + "token " + a.ghost[0].token;
      if (a.extra.length) meta += " +" + a.extra.length;
      n.text("meta", meta);
      var cut = a.status === "alive" ? "" : "cut";
      api.edge("lb", a.id).set(cut);
      api.edge(a.id, "db").set(cut);
      beats.push(a.name + " " + v.hb);
      if (v.counting) counting = true;
      waiting += a.stuck.length + a.stuckExtra;
    });
    var coord = api.node("coord");
    coord.text("sub", beats.join(MID));
    coord.set(counting ? "warn" : "");
    var db = api.node("db");
    db.text("sub", (S.dbRanges[S.dbShow] || S.dbShow) + ": token " + S.db[S.dbShow]);
    db.text("meta", S.hit ? S.hitText : "fencing: " + (S.fencing ? "on" : "off"));
    db.set(S.hit === "dup" ? "warn" : S.hit === "reject" ? "bad" : S.fencing ? "ok" : "");
    var U = S.ui;
    U.served(S.stats.served);
    U.waiting(waiting);
    U.failed(S.stats.failed);
    U.dup(S.stats.dup);
    U.rej(S.stats.rej);
    var a1 = S.apps[0], a2 = S.apps[1];
    U.freeze.disable(!(a2.status === "alive" && !a2.frozen));
    U.wake.disable(!a2.frozen || a2.hiccupUntil !== null);
    U.hiccup.disable(!(a1.status === "alive" && !a1.frozen));
  }

  /* ---------- customer requests ---------- */

  function spawnRequest(api) {
    api.dot({
      path: ["users", "lb"], cls: "dot-req",
      onArrive: function (d, wp) { requestArrive(api, d, wp); }
    });
  }

  function requestArrive(api, d, wp) {
    var S = api.state;
    if (wp === "lb") {
      var alive = S.apps.filter(function (a) { return a.status === "alive"; });
      if (!alive.length) { failDot(api, d); render(api); return; }
      var app = alive[S.rr++ % alive.length];
      d.app = app;
      d.setPath(["lb", app.id, "db"]);
      return;
    }
    if (wp === "db") {                       // the engine removes it at the end of its path
      S.stats.served++;
      render(api);
      return;
    }
    var a = d.app;                           // arrived at its app server
    if (!a) return;
    if (a.status === "alive" && !a.frozen) return;   // keeps going to the database
    if (a.status === "alive" && a.frozen) { parkDot(api, d); render(api); return; }
    failDot(api, d);
    render(api);
  }

  function failDot(api, d) {
    api.state.stats.failed++;
    d.cls("dot-fail");
    d.park();                                // stays where it failed while it fades
    api.after(0.6, function () { d.remove(); });
  }

  function parkDot(api, d) {
    var a = d.app;
    if (a.stuck.length >= MAX_PARKED) { a.stuckExtra++; d.remove(); return; }
    var n = a.stuck.length;
    a.stuck.push(d);
    d.cls("dot-wait");
    d.park(PARK_X - (n % 4) * 8, a.y - 12 + Math.floor(n / 4) * 8);
  }

  /* ---------- writes to the orders database ---------- */

  function spawnWrite(api, kind, app, batchId, token, order) {
    var zombie = kind === "zombie";
    var w = { app: app, batch: batchId, token: token, order: order };
    var land = function () {
      if (zombie) zombieArrive(api, w); else writeArrive(api, w);
      render(api);
    };
    var d = api.dot({
      path: [app.id, "db"], cls: zombie ? "dot-bad" : "dot-ok", r: zombie ? 5.5 : 4.5,
      onArrive: function (dot, wp) { if (wp === "db") land(); }
    });
    if (d && d.dropped) land();              // over the dot cap: apply the write at once
  }

  function writeArrive(api, w) {
    var S = api.state;
    if (!(S.db[w.batch] >= w.token)) S.db[w.batch] = w.token;
    S.dbShow = w.batch;
  }

  function zombieArrive(api, z) {
    var S = api.state;
    var current = S.db[z.batch];
    S.dbShow = z.batch;
    if (z.token < current) {
      if (S.fencing) {
        S.stats.rej++;
        api.log("Database REJECTED " + z.order + " from " + z.app.name + ": token " + z.token + " is older than " + current + ".", "ok");
        hit(api, "reject", "REJECTED (" + z.token + " < " + current + ")");
      } else {
        S.stats.dup++;
        api.log("Database accepted " + z.order + " from " + z.app.name + " (token " + z.token + "). " + z.order + " is now on two trucks.", "bad");
        hit(api, "dup", "DUPLICATE " + z.order);
      }
    } else {
      // Only reachable if a zombie write lands before the new owner's first write.
      S.db[z.batch] = z.token;
      api.log("Database accepted " + z.order + " from " + z.app.name + ": the new owner's token hadn't reached it yet, so fencing couldn't tell.", "warn");
    }
  }

  function hit(api, kind, text) {
    var S = api.state;
    S.hit = kind;
    S.hitText = text;
    var gen = ++S.hitGen;
    api.after(1.6, function () {
      if (S.hitGen !== gen) return;
      S.hit = "";
      S.hitText = "";
      render(api);
    });
  }

  /* ---------- failure detection and recovery ---------- */

  function freeze(api, a, hiccupSecs) {
    if (a.frozen || a.status !== "alive") return;
    a.frozen = true;
    a.frozeAt = api.clock;
    if (hiccupSecs) {
      a.hiccupUntil = api.clock + hiccupSecs;
      api.log(a.name + " paused for a moment (" + hiccupSecs + "s). This happens to every machine.", "warn");
    } else {
      api.log(a.name + " froze. Its heartbeat stopped.", "warn");
    }
    render(api);
  }

  function declareDead(api, a) {
    var S = api.state;
    a.status = "dead";
    api.log("Head of Shift: " + a.name + " silent for " + Math.round(api.clock - a.lastBeat) + "s (limit " + S.timeout + "s). DECLARED DEAD.", "bad");
    var n = a.stuck.length + a.stuckExtra;
    a.stuck.forEach(function (d) { failDot(api, d); });
    S.stats.failed += a.stuckExtra;
    a.stuck = [];
    a.stuckExtra = 0;
    if (n) api.log(n + " waiting customer request" + (n > 1 ? "s" : "") + " failed.", "bad");
    var owned = [a.batch].concat(a.extra).filter(Boolean);
    a.ghost = owned.map(function (b) { return { id: b.id, orders: b.orders, token: b.token }; });
    a.batch = null;
    a.extra = [];
    var candidates = S.apps.filter(function (x) { return x !== a && x.status === "alive" && !x.frozen; });
    candidates.sort(function (x, y) { return (y.name === "app-3" ? 1 : 0) - (x.name === "app-3" ? 1 : 0); });
    var target = candidates[0];
    if (!target) { api.log("No healthy machine left to take over. Orders are stuck.", "bad"); return; }
    owned.forEach(function (b) {
      var token = ++S.tokenCounter;
      target.extra.push({ id: b.id, orders: b.orders, token: token });
      api.log(target.name + " took over orders " + range(b) + " with token " + token + ".", "ok");
      spawnWrite(api, "write", target, b.id, token, b.orders[0]);
    });
  }

  function wake(api, a) {
    var S = api.state;
    if (!a.frozen) return;
    a.frozen = false;
    a.hiccupUntil = null;
    var secs = Math.round(api.clock - a.frozeAt);
    if (a.status === "alive") {
      var n = a.stuck.length + a.stuckExtra;
      api.log(a.name + " woke after " + secs + "s, before the " + S.timeout + "s timeout. Nobody replaced it." +
        (n ? " " + n + (n > 1 ? " customers" : " customer") + " just waited longer." : ""), "warn");
      a.stuck.forEach(function (d) {
        d.late = true;
        d.cls("dot-req");
        d.setPath([a.id, "db"]);
        d.resume();
      });
      S.stats.served += a.stuckExtra;
      a.stuck = [];
      a.stuckExtra = 0;
      render(api);
      return;
    }
    if (a.status === "dead") {
      a.status = "zombie";
      var ghosts = a.ghost || [];
      if (!ghosts.length) { rejoin(api, a); render(api); return; }
      api.log(a.name + " woke after " + secs + "s. It doesn't know it was declared dead. Resuming " +
        ghosts.map(range).join(", ") + " with token " + ghosts.map(function (g) { return g.token; }).join(", ") + "...", "bad");
      var k = 0;
      ghosts.forEach(function (g) {
        g.orders.forEach(function (o) {
          api.after(0.9 + 0.35 * k, function () { spawnWrite(api, "zombie", a, g.id, g.token, o); });
          k++;
        });
      });
      api.after(0.9 + 0.35 * k + 1.6, function () { rejoin(api, a); render(api); });
      render(api);
    }
  }

  function rejoin(api, a) {
    var S = api.state;
    if (a.status !== "zombie") return;
    a.status = "alive";
    a.lastBeat = api.clock;
    a.ghost = null;
    var token = ++S.tokenCounter;
    var first = S.nextOrder;
    S.nextOrder += 3;
    var id = "N" + token;
    a.batch = { id: id, orders: ["#" + first, "#" + (first + 1), "#" + (first + 2)], token: token };
    S.db[id] = token;
    S.dbRanges[id] = range(a.batch);
    api.log(a.name + " rejoined as a fresh machine with new orders " + range(a.batch) + " and token " + token + ".", "ok");
  }

  /* ---------- plain-language box explanations ---------- */

  function infoFor(api, id) {
    var S = api.state;
    if (id === "users") {
      return "<strong>Customers.</strong> Each white dot is one request. If it reaches a frozen machine it waits (amber). " +
        "If that machine is then declared dead, the request fails (red).";
    }
    if (id === "lb") {
      return "<strong>Load balancer.</strong> Spreads requests across the machines the Head of Shift says are alive. " +
        "Real load balancers also run their own health checks; in OP's setup it only trusts the Head of Shift's list.";
    }
    if (id === "coord") {
      return "<strong>Head of Shift (coordinator).</strong> Listens for heartbeats. After " + S.timeout + "s of silence it " +
        "declares a machine dead and hands its orders to someone else with a higher token. It can't tell dead from frozen. Nobody can.";
    }
    if (id === "db") {
      return "<strong>Orders database.</strong> Stores which truck gets which order. With fencing on, it remembers the highest " +
        "token for each batch and refuses writes with an older one. Fencing is currently <strong>" + (S.fencing ? "on" : "off") + "</strong>.";
    }
    for (var i = 0; i < S.apps.length; i++) {
      var a = S.apps[i];
      if (a.id === id) {
        return "<strong>" + a.name + ".</strong> Does the actual work. It holds a batch of orders and a token that proves it owns " +
          "them, and it sends a heartbeat every second. Right now it is: " + appView(api, a).status + ".";
      }
    }
    return TIP;
  }

  /* ---------- the module ---------- */

  DL.sims.define("s8e01", {
    diagram: DIAGRAM,
    startClock: START,

    setup: function (api) {
      var keep = carry;
      carry = null;
      api.speed = SPEED;
      var S = api.state;
      S.traffic = keep ? keep.traffic : 3;
      S.timeout = keep ? keep.timeout : 30;
      S.fencing = keep ? keep.fencing : false;
      S.tokenCounter = 33;
      S.nextOrder = 4477;
      S.rr = 0;
      S.spawnAcc = 0;
      S.apps = APPS.map(function (spec) { return mkApp(spec, api.clock); });
      S.db = { A: 31, B: 33, C: 32 };
      S.dbShow = "B";
      S.dbRanges = { A: range(S.apps[0].batch), B: range(S.apps[1].batch), C: range(S.apps[2].batch) };
      S.hit = "";
      S.hitText = "";
      S.hitGen = 0;
      S.stats = { served: 0, failed: 0, dup: 0, rej: 0 };

      var U = {};
      api.control.range("traffic", "Traffic", 1, 10, 1, S.traffic, function (v) {
        S.traffic = v;
      }, { format: function (v) { return v + TIMES; } });
      api.control.select("timeout", "Silence before a machine is called dead", [
        { value: 5, label: "5s" }, { value: 30, label: "30s" }, { value: 120, label: "2 min" }
      ], S.timeout, function (v) {
        S.timeout = v;
        api.log("Timeout set: a machine silent for " + v + "s is declared dead.", "");
        render(api);
      });
      api.control.toggle("fencing", "Fencing tokens", S.fencing, function (on) {
        S.fencing = on;
        api.log(on ? "Fencing ON: the database now refuses writes with an old token." : "Fencing OFF: the database accepts any write.", on ? "ok" : "warn");
        render(api);
      });
      U.freeze = api.control.button("freeze", "Freeze app-2", function () { freeze(api, S.apps[1]); }, { tone: "danger" });
      U.wake = api.control.button("wake", "Wake app-2", function () { wake(api, S.apps[1]); }, { disabled: true });
      U.hiccup = api.control.button("hiccup", "Tiny pause on app-1 (" + HICCUP + "s)", function () {
        freeze(api, S.apps[0], HICCUP);
      }, { wide: true });
      api.control.button("reset", "Reset the night", function () {
        carry = { traffic: S.traffic, timeout: S.timeout, fencing: S.fencing };
        api.reset();
      }, { tone: "ghost", wide: true });

      U.served = api.stat("served", "served", "ok");
      U.waiting = api.stat("waiting", "waiting", "warn");
      U.failed = api.stat("failed", "failed", "bad");
      U.dup = api.stat("dup", "double-assigned", "bad");
      U.rej = api.stat("rej", "stale writes blocked", "ok");
      S.ui = U;

      api.info(TIP);
      api.onNodeClick(function (id) { api.info(infoFor(api, id)); });
      api.log("Shift started. Three machines healthy, heartbeats every second.", "");
      render(api);
    },

    step: function (api, dt) {
      var S = api.state;
      if (!S.apps) return;
      S.apps.forEach(function (a) {
        if (a.hiccupUntil !== null && api.clock >= a.hiccupUntil) wake(api, a);
        if (!a.frozen) a.lastBeat = api.clock;
        if (a.status === "alive" && a.frozen && api.clock - a.lastBeat > S.timeout) declareDead(api, a);
      });
      var rate = S.traffic * (api.reducedMotion ? 0.5 : 1.3);
      S.spawnAcc += dt * rate;
      while (S.spawnAcc >= 1) {
        S.spawnAcc -= 1;
        spawnRequest(api);
      }
      render(api);
    },

    selfTest: async function (t) {
      var B = range({ orders: ["#4471", "#4473"] });     // #4471-73 with an en dash
      var A = range({ orders: ["#4468", "#4470"] });     // #4468-70 with an en dash
      var N = range({ orders: ["#4477", "#4479"] });     // #4477-79 with an en dash
      var sinceStart = function () { return t.api ? Math.round(t.api.clock - START) : null; };

      /* (a) fencing off: freeze app-2 past the 30s limit, then wake it */
      t.expect(!t.api || Math.round(t.api.clock) === START, "the clock starts at 02:13:00");
      t.expect(t.node("lb").text.sub === "3 of 3 alive", "starts with the load balancer showing 3 of 3 alive");
      t.expect(t.node("app2").text.meta === B + MID + "token 33", "app-2 starts with orders #4471-73 and token 33");
      t.set("timeout", 30);
      t.set("fencing", false);
      t.click("freeze");
      await t.run(3);
      t.expect(t.node("app2").state === "warn" && /^silent \d+s of 30s$/.test(t.node("app2").text.sub),
        "(a) a frozen app-2 is counted as silent, not dead yet: " + t.node("app2").text.sub);
      t.expect(t.stat("waiting") > 0, "(a) requests sent to the frozen app-2 wait");
      await t.run(4);
      t.expect(!t.api || sinceStart() === 35, "(a) 7 real seconds are 35 sim-seconds at 5x speed");
      t.expect(t.node("app2").text.sub === "DECLARED DEAD", "(a) app-2 is DECLARED DEAD after 30 sim-seconds of silence");
      t.expect(t.node("app2").state === "bad", "(a) app-2's box shows the dead state");
      t.expect(t.node("lb").text.sub === "2 of 3 alive", "(a) the load balancer shows 2 of 3 alive: " + t.node("lb").text.sub);
      t.expect(t.logText().indexOf("app-3 took over orders " + B + " with token 34.") >= 0, "(a) app-3 takes over #4471-73 with the new token 34");
      t.expect(t.stat("failed") > 0, "(a) the requests waiting on app-2 fail when it is declared dead");
      t.expect(t.stat("waiting") === 0, "(a) nothing is left waiting on a dead machine");
      t.click("wake");
      await t.run(1);
      t.expect(t.node("app2").state === "zombie", "(a) the woken app-2 is a zombie that thinks it is alive");
      await t.run(4);
      t.expect(t.stat("dup") === 3, "(a) waking gives exactly 3 double-assigned orders, got " + t.stat("dup"));
      t.expect(t.stat("rej") === 0, "(a) with fencing off nothing is blocked, got " + t.stat("rej"));
      t.expect(t.logText().indexOf("is now on two trucks.") >= 0, "(a) the log says an order is on two trucks");
      t.expect(t.logText().indexOf("app-2 rejoined as a fresh machine with new orders " + N + " and token 35.") >= 0,
        "(a) app-2 rejoins with fresh orders and a fresh token 35");
      t.expect(t.node("app2").state === "ok" && t.node("lb").text.sub === "3 of 3 alive", "(a) after rejoining, 3 of 3 are alive again");

      /* (b) reset, fencing on, same sequence */
      t.click("reset");
      t.set("timeout", 30);
      t.set("fencing", true);
      t.expect(!t.api || Math.round(t.api.clock) === START, "(b) reset puts the clock back to 02:13:00");
      t.expect(t.stat("dup") === 0 && t.stat("served") === 0, "(b) reset clears the numbers");
      t.expect(t.node("db").text.meta === "fencing: on", "(b) the database shows fencing: on");
      t.click("freeze");
      await t.run(7);
      t.expect(t.node("app2").text.sub === "DECLARED DEAD", "(b) app-2 is DECLARED DEAD again");
      t.click("wake");
      await t.run(5);
      t.expect(t.stat("rej") === 3, "(b) with fencing on, 3 stale writes are blocked, got " + t.stat("rej"));
      t.expect(t.stat("dup") === 0, "(b) with fencing on, 0 orders are double-assigned, got " + t.stat("dup"));
      t.expect(t.logText().indexOf("Database REJECTED #4471 from app-2: token 33 is older than 34.") >= 0,
        "(b) the database rejects #4471 because token 33 is older than 34");

      /* (c) wake before the timeout: no zombie, waiting requests resume */
      t.click("reset");
      t.set("timeout", 30);
      t.set("fencing", false);
      t.click("freeze");
      await t.run(3);
      var waiting = t.stat("waiting");
      var served = t.stat("served");
      t.expect(waiting > 0, "(c) requests pile up on the frozen app-2, got " + waiting);
      t.click("wake");
      await t.run(2);
      t.expect(t.node("app2").state === "ok" && t.node("app2").text.sub === "healthy", "(c) app-2 woke before the timeout and is healthy");
      t.expect(t.stat("waiting") === 0, "(c) no requests are left waiting, got " + t.stat("waiting"));
      t.expect(t.stat("served") >= served + waiting, "(c) the waiting requests resume and are served");
      t.expect(t.logText().indexOf("before the 30s timeout. Nobody replaced it.") >= 0, "(c) the log says nobody replaced app-2");
      t.expect(t.logText().indexOf("DECLARED DEAD") < 0, "(c) nobody was declared dead");
      t.expect(t.logText().indexOf("ZOMBIE") < 0 && t.stat("dup") === 0 && t.stat("rej") === 0, "(c) no zombie writes");
      t.expect(t.node("lb").text.sub === "3 of 3 alive", "(c) the load balancer still shows 3 of 3 alive");

      /* (d) 5s timeout: the 8s pause on app-1 is a false death plus zombie writes */
      t.click("reset");
      t.set("timeout", 5);
      t.set("fencing", false);
      t.click("hiccup");
      await t.run(1.3);
      t.expect(t.node("app1").text.sub === "DECLARED DEAD", "(d) with a 5s limit, the 8s pause gets app-1 declared dead");
      t.expect(t.logText().indexOf("app-3 took over orders " + A + " with token 34.") >= 0, "(d) app-3 takes over #4468-70 with token 34");
      await t.run(0.5);
      t.expect(t.node("app1").state === "zombie", "(d) app-1 wakes after its pause as a zombie");
      t.expect(t.logText().indexOf("app-1 woke after " + HICCUP + "s. It doesn't know it was declared dead.") >= 0,
        "(d) the log shows app-1 waking after 8s, unaware it was declared dead");
      await t.run(4);
      t.expect(t.stat("dup") === 3, "(d) its zombie writes land: 3 double-assigned, got " + t.stat("dup"));
      t.expect(t.logText().indexOf("Database accepted #4468 from app-1 (token 31).") >= 0, "(d) the database accepts #4468 from the zombie app-1");

      /* (e) 30s timeout: the same 8s pause is not a death */
      t.click("reset");
      t.set("timeout", 30);
      t.set("fencing", false);
      t.click("hiccup");
      await t.run(3);
      t.expect(t.logText().indexOf("DECLARED DEAD") < 0, "(e) with a 30s limit, the 8s pause is not a death");
      t.expect(t.node("app1").state === "ok" && t.node("app1").text.sub === "healthy", "(e) app-1 is healthy after its pause");
      t.expect(t.logText().indexOf("app-1 woke after " + HICCUP + "s, before the 30s timeout.") >= 0, "(e) the log shows app-1 waking before the timeout");
      t.expect(t.stat("dup") === 0 && t.stat("rej") === 0, "(e) no zombie writes");
      t.expect(t.node("lb").text.sub === "3 of 3 alive", "(e) the load balancer shows 3 of 3 alive");
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
