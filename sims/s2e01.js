/* sims/s2e01-v1.0.0.js  (published as sims/s2e01.js)
   Case s2e01 "One Server, One Night": a launch-night load sim for the Fallow Creek Palace's
   ticket website. Season 2's first sim and its template.

   CHANGELOG
   v1.0.0 (2026-10-07) first version: fans send requests through a load balancer to up to ten
     servers at Kestrel Hosting. Controls: traffic (range, 0 to 2,000 requests a second), doors
     open (the midnight rush, 1,200 a second), size (vertical scaling: small, medium, large,
     x-large, each resize a 3-minute outage, x-large the biggest Kestrel rents), add a server and
     remove a server (horizontal scaling, 2 minutes to start), pull the plug on one server, reset.
     Stats: requests a second offered, served, failed or 503, a p95 wait in ms (a teaching
     model), servers answering, cost per hour. selfTest covers one small server past capacity,
     the resize outage and the ceiling, eight and ten small servers at the spike, pulling the plug
     on one of ten and removing it, pulling the plug on the only server, and the cost of each.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e01-v1.0.0.json):
   - post: 40 a second at 11:59 PM, 1,200 at midnight, the small size (2 cores, 150 a second,
     $0.10 an hour), the waiting line of 900, p95 68 ms, 6,000 ms and 900 ms, the 3-minute resize
     (00:03 to 00:06), x-large at 1,000 a second and $0.80 an hour, 200 a second still turned away.
   - post note block: the four sizes (150, 290, 560 and 1,000 a second; $0.10, $0.20, $0.40, $0.80).
   - comments: a new server takes about 2 minutes to start.
   - sim.lede: the p95 teaching model (50 ms idle, climbing as a server fills, the full line past
     capacity). Ten small servers at 1,200 a second: 80% busy, p95 250 ms, $1.00 an hour (reply
     option D's Part 2 and the explanation).

   Notes for anyone copying this file as a Season 2 template:
   - Everything sits inside one function so nothing leaks into the page. Two sims that each declared
     a top-level variable would clash when both are loaded on the same page.
   - The story's numbers are named constants at the top. Change the story, change them, and the
     selfTest's expected values with them.
   - The numbers shown are a steady-state model computed every frame from the current setup: no
     api.rand(), no hidden accumulation. That keeps every stat an exact, repeatable integer, so the
     selfTest can assert the story's numbers directly. The model treats an overloaded server's
     waiting line as already full. At the midnight rush that is true within a second (1,050 extra
     requests a second into 900 places); at a slight overload a real line would take longer to
     fill, which the teaching model leaves out.
   - The dots are only a visual sample (at most a few per second). Whether a dot is served or turned
     away comes from a per-server running total of the failed share, not from random numbers.
   - Countdowns (resize, start-up) run on sim seconds inside step(), so they pause with the sim and,
     at 20 times real speed, land on whole real seconds (3 minutes = 9 s, 2 minutes = 6 s).
   - Stats get bare numbers (the units live in their labels), so t.stat() returns numbers.
   - Every server slot is drawn in DIAGRAM from the start and muted when nobody rents it, because
     api.node() only works for ids that exist in the diagram. The load balancer's fan-out edges are
     left out (ten parallel edges would collide); the dots show where requests go.
   - This load balancer does not check whether a server is alive. An unplugged server keeps getting
     its share until someone removes it. That is deliberate: health checks are case s2e02.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 20;                          // sim seconds per real second: a minute passes in 3 seconds
  var START_CLOCK = 23 * 3600 + 59 * 60;   // 23:59:00 on Thursday night
  var MIDNIGHT = 24 * 3600;                // the engine's clock wraps here and shows 00:00:00
  var EVENING_RPS = 40;                    // 11:59 PM: fans refreshing and waiting
  var DOORS_RPS = 1200;                    // midnight: tickets on sale
  var MAX_RPS = 2000;
  var LINE = 900;                          // each server's waiting line holds 900 requests
  var BASE_MS = 50;                        // teaching model: an idle server answers in 50 ms
  var RESIZE_SEC = 180;                    // a resize stops the server for 3 minutes (00:03 to 00:06)
  var BOOT_SEC = 120;                      // a new server takes about 2 minutes to start
  var MAX_SERVERS = 10;
  var DOT_SPEED = 520;                     // viewBox units per real second

  /* Kestrel Hosting's sizes, as Nils measured them on Saturday. The price doubles with every size,
     the capacity doesn't quite: some of the site's work can only happen one step at a time. */
  var SIZES = [
    { id: "small", name: "small", cores: 2, cap: 150, cents: 10 },
    { id: "medium", name: "medium", cores: 4, cap: 290, cents: 20 },
    { id: "large", name: "large", cores: 8, cap: 560, cents: 40 },
    { id: "xlarge", name: "x-large", cores: 16, cap: 1000, cents: 80 }
  ];
  var BIGGEST = SIZES.length - 1;

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  // 1200 -> "1,200". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  function dollars(cents) { return (cents / 100).toFixed(2); }

  function mmss(sec) {
    var s = Math.max(0, Math.ceil(sec));
    var r = s % 60;
    return Math.floor(s / 60) + ":" + (r < 10 ? "0" : "") + r;
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  function listWords(items) {
    if (items.length === 1) return String(items[0]);
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  function slotId(k) { return "s" + k; }

  function sizeIndex(id) {
    for (var i = 0; i < SIZES.length; i++) if (SIZES[i].id === String(id)) return i;
    return -1;
  }

  /* ---------- the diagram ---------- */

  /* Layout checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px). The longest
     server texts are "x-large, 1,000/s" (16 chars, 115px) and "starting, 1:59" (14 chars, 92px),
     inside 132px boxes. The longest load balancer text is "spreads over 10 servers" (23 chars,
     166px) inside 260px. */
  var SLOT_X = [86, 228, 370, 512, 654];
  var ROW_Y = [238, 312];

  var DIAGRAM = (function () {
    var nodes = [
      { id: "fans", label: "Fans at the door", sub: "40 req/s", x: 370, y: 34, w: 240, h: 52, shape: "box", tone: "" },
      { id: "lb", label: "Load balancer", sub: "1 server: sends it all", x: 370, y: 124, w: 260, h: 52, shape: "box", tone: "muted" }
    ];
    for (var k = 1; k <= MAX_SERVERS; k++) {
      var col = (k - 1) % 5;
      var row = Math.floor((k - 1) / 5);
      nodes.push({
        id: slotId(k),
        label: "Server " + k,
        sub: k === 1 ? "small, 150/s" : "empty slot",
        meta: k === 1 ? "busy 27%" : "not rented",
        x: SLOT_X[col], y: ROW_Y[row], w: 132, h: 62, shape: "box",
        tone: k === 1 ? "ok" : "muted"
      });
    }
    return {
      type: "arch",
      w: 740,
      h: 380,
      aria: "Launch-night sim. Fans send requests to a load balancer, which spreads them across up to ten server slots at Kestrel Hosting. At the start only server 1, a small server that can finish 150 requests a second, is rented.",
      groups: [
        { label: "Servers at Kestrel Hosting", x: 10, y: 170, w: 720, h: 202 }
      ],
      nodes: nodes,
      edges: [
        { from: "fans", to: "lb" }
      ]
    };
  })();

  /* ---------- the model ---------- */

  function inList(s) { return s.state !== "starting"; }        // the load balancer's list
  function billedSize(s) { return SIZES[s.state === "resizing" ? s.target : s.size]; }

  /* Steady state for the current setup. The load balancer splits the traffic evenly over every server
     in its list, alive or not. A ready server finishes min(share, capacity); the rest of its share
     gets 503 because its line is full. A stopped or unplugged server answers nothing.
     p95 (teaching model): below capacity 50 ms / (1 - busy share), capped at the full-line wait;
     at or past capacity, the full-line wait: 900 / capacity seconds. */
  function compute(S) {
    var list = S.servers.filter(inList);
    var n = list.length;
    var share = n ? S.rps / n : 0;
    var r = {
      n: n, share: share, served: 0, rejected: 0, noAnswer: n ? 0 : S.rps,
      p95: -1, maxU: 0, live: 0, dead: 0, resizing: 0, liveCap: 0, cents: 0, per: {}
    };
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s.state === "ready") {
        var cap = SIZES[s.size].cap;
        var u = share / cap;
        var served = Math.min(share, cap);
        var full = LINE / cap * 1000;
        var p = u >= 1 ? full : Math.min(BASE_MS / (1 - u), full);
        r.served += served;
        r.rejected += share - served;
        r.live += 1;
        r.liveCap += cap;
        if (u > r.maxU) r.maxU = u;
        if (share > 0 && p > r.p95) r.p95 = p;
        r.per[s.slot] = { u: u, failFrac: share > 0 ? (share - served) / share : 0 };
      } else {
        r.noAnswer += share;
        if (s.state === "dead") r.dead += 1; else r.resizing += 1;
      }
    }
    for (var j = 0; j < S.servers.length; j++) r.cents += billedSize(S.servers[j]).cents;
    r.failed = r.rejected + r.noAnswer;
    return r;
  }

  function situation(S, r) {
    if (S.rps > 0 && r.served < 0.5) return "down";
    if (r.rejected >= 0.5) return "over";
    if (r.noAnswer >= 0.5) return "partial";
    if (r.maxU >= 0.9) return "near";
    return "ok";
  }

  function sitKey(S, r) { return situation(S, r) + "|" + r.dead + "|" + r.resizing; }

  function narrate(api, r) {
    var S = api.state;
    var key = sitKey(S, r);
    if (key === S.sitKey) return;
    S.sitKey = key;
    var sit = situation(S, r);
    var p95 = fmt(r.p95);
    var pct = Math.round(Math.min(r.maxU, 1) * 100);
    if (sit === "down") {
      var why;
      if (!r.n) why = "The load balancer has no server in its list.";
      else if (r.resizing) why = "The only server is stopped for its resize.";
      else if (r.n === 1) why = "The only server is unplugged. One machine was a single point of failure.";
      else why = "Every server in the load balancer's list is down.";
      api.log("Nothing answers. " + why + " All " + fmt(S.rps) + " requests a second fail.", "bad");
    } else if (sit === "over") {
      var msg = "Over capacity: " + fmt(S.rps) + " requests a second arrive and " + fmt(r.served) +
        " get a page. The waiting lines are full, so " + fmt(r.rejected) + " a second get 503 at once.";
      if (r.noAnswer >= 0.5) msg += " Another " + fmt(r.noAnswer) + " a second go to a server that doesn't answer.";
      api.log(msg + " Those who get in wait " + p95 + " ms (p95).", "bad");
    } else if (sit === "partial") {
      api.log(fmt(r.noAnswer) + " requests a second go to a server that doesn't answer, because the load balancer doesn't know it's gone. The other " +
        fmt(r.served) + " get a page, p95 " + p95 + " ms.", "warn");
    } else if (sit === "near") {
      api.log("Every request gets a page, but the servers are " + pct + "% busy and the p95 wait is " + p95 +
        " ms. Close to 100%, waits climb fast.", "warn");
    } else if (S.rps > 0) {
      api.log("Every request gets a page. The servers are " + pct + "% busy and the p95 wait is " + p95 + " ms.", "ok");
    }
  }

  /* ---------- drawing ---------- */

  function serverAt(S, k) {
    for (var i = 0; i < S.servers.length; i++) if (S.servers[i].slot === k) return S.servers[i];
    return null;
  }

  function drawServer(api, k, r) {
    var S = api.state;
    var node = api.node(slotId(k));
    var s = serverAt(S, k);
    if (!s) {
      node.text("sub", "empty slot");
      node.text("meta", "not rented");
      node.set("muted");
      return;
    }
    var z = SIZES[s.size];
    var capText = z.name + ", " + fmt(z.cap) + "/s";
    if (s.state === "starting") {
      node.text("sub", capText);
      node.text("meta", "starting, " + mmss(s.left));
      node.set("warn");
    } else if (s.state === "resizing") {
      node.text("sub", "to " + SIZES[s.target].name);
      node.text("meta", "stopped, " + mmss(s.left));
      node.set("bad");
    } else if (s.state === "dead") {
      node.text("sub", capText);
      node.text("meta", "unplugged");
      node.set("bad");
    } else {
      var u = r.per[k] ? r.per[k].u : 0;
      node.text("sub", capText);
      node.text("meta", S.rps <= 0 ? "idle" : u > 1 ? "full: 503s" : "busy " + Math.round(u * 100) + "%");
      node.set(u > 1 ? "bad" : u >= 0.9 ? "warn" : "ok");
    }
  }

  function draw(api, r) {
    var S = api.state;
    api.node("fans").text("sub", fmt(S.rps) + " req/s");
    var lb = api.node("lb");
    if (!r.n) { lb.text("sub", "no server in its list"); lb.set("bad"); }
    else if (r.n === 1) { lb.text("sub", "1 server: sends it all"); lb.set("muted"); }
    else { lb.text("sub", "spreads over " + r.n + " servers"); lb.set(""); }
    for (var k = 1; k <= MAX_SERVERS; k++) drawServer(api, k, r);

    S.stat.offered(Math.round(S.rps));
    S.stat.served(Math.round(r.served));
    S.stat.failed(Math.round(r.failed));
    S.stat.p95(r.served >= 0.5 ? Math.round(r.p95) : "-");
    S.stat.servers(r.live);
    S.stat.cost(dollars(r.cents));

    var total = S.servers.length;
    var resizing = r.resizing > 0;
    var only = total === 1 ? S.servers[0] : null;
    S.ctl.size.disable(!(only && only.state === "ready"));
    S.ctl.add.disable(resizing || total >= MAX_SERVERS);
    S.ctl.remove.disable(resizing || total <= 1);
    S.ctl.plug.disable(r.live === 0);
  }

  /* ---------- dots: a visual sample, never counted ---------- */

  function dots(api, dt, r) {
    var S = api.state;
    if (api.reducedMotion || S.rps <= 0) return;
    S.dotClock += dt;
    var every = Math.min(1.2, Math.max(0.09, 2.5 / Math.sqrt(S.rps)));
    if (S.dotClock < every) return;
    S.dotClock = 0;
    var list = S.servers.filter(inList);
    if (!list.length) {
      api.dot({ path: ["fans", "lb"], cls: "dot-fail", r: 4, speed: DOT_SPEED });
      return;
    }
    var s = list[S.rr % list.length];
    S.rr += 1;
    var fail = true;
    if (s.state === "ready" && r.per[s.slot]) {
      s.acc += r.per[s.slot].failFrac;
      fail = s.acc >= 1;
      if (fail) s.acc -= 1;
    }
    var target = slotId(s.slot);
    api.dot({
      path: ["fans", "lb", target], cls: "dot-req", r: 4, speed: DOT_SPEED,
      onArrive: function (d, wp) { if (d && wp === "lb") d.cls(fail ? "dot-fail" : "dot-ok"); }
    });
  }

  /* ---------- controls ---------- */

  function setTraffic(api, v) {
    var S = api.state;
    var n = Number(v);
    if (!isFinite(n)) return;
    S.rps = Math.max(0, Math.min(MAX_RPS, Math.round(n)));
  }

  function doors(api) {
    var S = api.state;
    S.rps = DOORS_RPS;
    S.doorsOpen = true;
    S.ctl.traffic.set(DOORS_RPS);           // set() moves the slider but does not call onChange
    api.log("Doors open: tickets for Odile Marsh's night are on sale, and " + fmt(DOORS_RPS) + " requests a second arrive.", "warn");
  }

  function setSize(api, v) {
    var S = api.state;
    var idx = sizeIndex(v);
    var s = S.servers.length === 1 ? S.servers[0] : null;
    if (idx < 0 || !s || s.state !== "ready") {
      if (S.servers.length) S.ctl.size.set(SIZES[S.servers[0].size].id);
      return;
    }
    if (idx === s.size) return;
    var z = SIZES[idx];
    s.state = "resizing";
    s.target = idx;
    s.left = RESIZE_SEC;
    s.acc = 0;
    api.log("You resize the server to " + z.name + " (" + z.cores + " cores, $" + dollars(z.cents) + " an hour). Kestrel stops it, moves it to " +
      (idx > s.size ? "a bigger" : "a smaller") + " machine and starts it again: 3 minutes with nothing answering." +
      (idx === BIGGEST ? " It's the biggest size Kestrel rents." : ""), "warn");
  }

  function freeSlot(S) {
    for (var k = 1; k <= MAX_SERVERS; k++) if (!serverAt(S, k)) return k;
    return 0;
  }

  function addServer(api) {
    var S = api.state;
    var r = compute(S);
    if (r.resizing || S.servers.length >= MAX_SERVERS) return;
    var k = freeSlot(S);
    if (!k) return;
    var size = S.servers.length ? S.servers[0].size : 0;
    S.servers.push({ slot: k, size: size, target: size, state: "starting", left: BOOT_SEC, acc: 0 });
    S.servers.sort(function (a, b) { return a.slot - b.slot; });
    var z = SIZES[size];
    api.log("You rent server " + k + " (" + z.name + ", $" + dollars(z.cents) + " an hour, paid from now). It takes about 2 minutes to start, then joins the load balancer's list.", "");
  }

  function pickToRemove(S) {
    var order = ["dead", "starting", "ready"];
    for (var o = 0; o < order.length; o++) {
      for (var i = S.servers.length - 1; i >= 0; i--) if (S.servers[i].state === order[o]) return i;
    }
    return -1;
  }

  function removeServer(api) {
    var S = api.state;
    var r = compute(S);
    if (r.resizing || S.servers.length <= 1) return;
    var i = pickToRemove(S);
    if (i < 0) return;
    var s = S.servers[i];
    S.servers.splice(i, 1);
    var why = s.state === "dead" ? ", the unplugged one. The load balancer stops sending it requests, and you stop paying for it."
      : s.state === "starting" ? " before it finished starting."
      : ". Its share of the requests goes to the others.";
    api.log("You remove server " + s.slot + why, "");
  }

  function pullPlug(api) {
    var S = api.state;
    var victim = null;
    for (var i = S.servers.length - 1; i >= 0; i--) {
      if (S.servers[i].state === "ready") { victim = S.servers[i]; break; }
    }
    if (!victim) return;
    victim.state = "dead";
    var r = compute(S);
    if (!r.live) {
      api.log("You pull the plug on server " + victim.slot + ", the only one answering. Nothing answers now: it was a single point of failure.", "bad");
    } else {
      api.log("You pull the plug on server " + victim.slot + ". The load balancer doesn't notice: it keeps sending it 1 in every " + r.n +
        " requests, and those get no answer. The other " + r.live + " carry on. Remove a server takes the dead one out of the list.", "bad");
    }
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.servers) return;
    var simDt = dt * api.speed;
    var up = [];
    for (var i = 0; i < S.servers.length; i++) {
      var s = S.servers[i];
      if (s.state === "starting") {
        s.left -= simDt;
        if (s.left <= 0) { s.left = 0; s.state = "ready"; up.push(s.slot); }
      } else if (s.state === "resizing") {
        s.left -= simDt;
        if (s.left <= 0) {
          s.left = 0;
          s.size = s.target;
          s.state = "ready";
          var z = SIZES[s.size];
          api.log("The server is back as " + z.name + ": it can finish " + fmt(z.cap) + " requests a second, for $" + dollars(z.cents) + " an hour." +
            (s.size === BIGGEST ? " There is no bigger server to buy." : ""), "ok");
        }
      }
    }
    var r = compute(S);
    if (up.length) {
      api.log((up.length === 1 ? "Server " : "Servers ") + listWords(up) + (up.length === 1 ? " is" : " are") +
        " up and in the load balancer's list. " + plural(r.live, "server now answers", "servers now answer") +
        ", able to finish " + fmt(r.liveCap) + " requests a second together.", "ok");
    }
    if (!S.cued && api.clock >= MIDNIGHT) {
      S.cued = true;
      if (!S.doorsOpen) api.log("It's midnight. Tickets for Odile Marsh's night are on sale. Press Doors open.", "warn");
    }
    narrate(api, r);
    draw(api, r);
    dots(api, dt, r);
  }

  /* ---------- "what is this box" ---------- */

  function serverInfo(k) {
    return function (S, r) {
      var s = serverAt(S, k);
      var head = "<strong>Server " + k + ".</strong> ";
      if (!s) return head + "An empty slot: nobody rents a server here yet. <em>Add a server</em> rents one, the same size as the others.";
      var z = SIZES[s.size];
      var base = head + "A " + z.name + " server: " + z.cores + " CPU cores, able to finish " + fmt(z.cap) +
        " requests a second (its capacity), for $" + dollars(z.cents) + " an hour. Requests past its capacity wait in its line, which holds 900. When the line is full, new ones get 503 at once. ";
      if (s.state === "starting") return base + "It's starting up: " + mmss(s.left) + " left before it joins the load balancer's list. You already pay for it.";
      if (s.state === "resizing") return base + "It's stopped for a resize to " + SIZES[s.target].name + ": " + mmss(s.left) + " left. Nothing it was sent is answered.";
      if (s.state === "dead") return base + "Its plug is pulled. The load balancer still sends it its share, and those requests get no answer. You still pay for it until you remove it.";
      var u = r.per[k] ? r.per[k].u : 0;
      return base + "Right now it gets " + fmt(r.share) + " requests a second: " + (u > 1 ? "more than it can finish, so its line is full." : Math.round(u * 100) + "% busy.");
    };
  }

  var INFO = {
    fans: function (S) {
      return "<strong>Fans.</strong> Everyone trying to buy a ticket for Odile Marsh's night, sending requests to the Palace's website. Use the traffic slider, or <em>Doors open</em> for the midnight rush: 1,200 requests a second, as on Friday. Right now: " + fmt(S.rps) + " a second.";
    },
    lb: function () {
      return "<strong>Load balancer.</strong> Something that spreads visitors across servers, so no one server gets them all. With one server it simply passes everything on. This one doesn't check whether a server is alive: an unplugged server keeps getting its share until you remove it. How a load balancer chooses a server, and how it notices a dead one, is the next case.";
    }
  };
  for (var slot = 1; slot <= MAX_SERVERS; slot++) INFO[slotId(slot)] = serverInfo(slot);

  /* ---------- the module ---------- */

  var SIZE_OPTIONS = SIZES.map(function (z, i) {
    return {
      value: z.id,
      label: z.name + ": " + z.cores + " cores, " + fmt(z.cap) + "/s, $" + dollars(z.cents) + "/h" + (i === BIGGEST ? " (biggest)" : "")
    };
  });

  DL.sims.define("s2e01", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.rps = EVENING_RPS;
      S.servers = [{ slot: 1, size: 0, target: 0, state: "ready", left: 0, acc: 0 }];
      S.cued = false;
      S.doorsOpen = false;
      S.rr = 0;
      S.dotClock = 0;
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.traffic = api.control.range("traffic", "Traffic (requests a second)", 0, MAX_RPS, 10, EVENING_RPS,
        function (v) { setTraffic(api, v); }, { format: function (v) { return fmt(v) + "/s"; } });
      S.ctl.doors = api.control.button("doors", "Doors open (1,200 a second)", function () { doors(api); }, { wide: true });
      S.ctl.size = api.control.select("size", "Bigger server (vertical): size", SIZE_OPTIONS, SIZES[0].id, function (v) { setSize(api, v); });
      S.ctl.add = api.control.button("add", "Add a server (horizontal)", function () { addServer(api); });
      S.ctl.remove = api.control.button("remove", "Remove a server", function () { removeServer(api); });
      S.ctl.plug = api.control.button("plug", "Pull the plug on one server", function () { pullPlug(api); }, { tone: "danger" });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        offered: api.stat("offered", "requests/s offered", ""),
        served: api.stat("served", "requests/s served", "ok"),
        failed: api.stat("failed", "requests/s failed or 503", "bad"),
        p95: api.stat("p95", "p95 wait, ms (teaching model)", "warn"),
        servers: api.stat("servers", "servers answering", ""),
        cost: api.stat("cost", "cost per hour, $", "")
      };

      var r = compute(S);
      S.sitKey = sitKey(S, r);
      draw(api, r);

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state, compute(api.state)));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");
      api.log("11:59 PM at the Fallow Creek Palace. One small server ($0.10 an hour) can finish 150 requests a second. " +
        fmt(EVENING_RPS) + " a second are arriving: fans refreshing, waiting for midnight.", "");
    },

    step: function (api, dt) { step(api, dt); },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }

      // 1. 11:59 PM: one small server and 40 requests a second.
      await t.run(1);
      t.expect(n("offered") === 40 && n("served") === 40 && n("failed") === 0 && n("p95") === 68 && n("servers") === 1 && n("cost") === 0.1,
        "at 11:59 PM one small server serves all 40 requests a second, p95 68 ms, for $0.10 an hour");

      // 2. Doors open: one small server past its capacity.
      t.click("doors");
      await t.run(1);
      t.expect(n("offered") === 1200 && n("served") === 150 && n("failed") === 1050 && n("p95") === 6000 && t.node("s1").state === "bad",
        "at 1,200 a second one small server finishes 150 and turns 1,050 away with 503; those who get in wait 6,000 ms (a full line of 900)");

      // 3. Vertical: resize to the biggest size. 3 minutes of nothing, then a higher capacity with a ceiling.
      t.set("size", "xlarge");
      await t.run(1);                                       // 20 sim-seconds into the 180-second resize
      t.expect(n("served") === 0 && n("failed") === 1200 && n("servers") === 0 && t.node("s1").state === "bad" &&
        String(t.node("s1").text.meta).indexOf("stopped") === 0,
        "during the resize the only server is stopped: nothing answers and all 1,200 a second fail");
      await t.run(9);                                       // 200 sim-seconds after the change
      t.expect(n("served") === 1000 && n("failed") === 200 && n("p95") === 900 && n("servers") === 1 && n("cost") === 0.8,
        "after 3 minutes the server is back as x-large: 1,000 served, 200 still turned away, p95 900 ms, $0.80 an hour (8 times the small size)");
      t.set("traffic", 2000);
      await t.run(1);
      t.expect(n("served") === 1000 && n("failed") === 1000 && t.logText().indexOf("no bigger server") >= 0,
        "vertical scaling hits a ceiling: at 2,000 a second the biggest size still finishes only 1,000, and there is no bigger one");

      // 4. Horizontal: eight, then ten small servers.
      t.click("reset");
      t.click("doors");
      for (var i = 0; i < 7; i++) t.click("add");
      await t.run(1);                                       // the new servers are still starting
      t.expect(n("servers") === 1 && n("served") === 150 && n("cost") === 0.8,
        "seven new servers are starting: you pay for all eight ($0.80 an hour) but only one answers yet");
      await t.run(6);                                       // 140 sim-seconds: all started
      t.expect(n("servers") === 8 && n("served") === 1200 && n("failed") === 0 && n("p95") === 6000 && n("cost") === 0.8,
        "eight small servers serve all 1,200 a second for $0.80 an hour, but at 100% busy the p95 wait hits the full line, 6,000 ms");
      t.click("add");
      t.click("add");
      await t.run(7);
      t.expect(n("servers") === 10 && n("served") === 1200 && n("failed") === 0 && n("p95") === 250 && n("cost") === 1,
        "ten small servers serve the spike with room to spare: each 80% busy, p95 250 ms, $1.00 an hour");

      // 5. Pull the plug on one of ten: the rest keep serving.
      t.click("plug");
      await t.run(1);
      t.expect(n("servers") === 9 && n("served") === 1080 && n("failed") === 120 && n("cost") === 1,
        "with one of ten unplugged, 1,080 a second are still served; the load balancer keeps sending the dead one its 120");
      t.click("remove");
      await t.run(1);
      t.expect(n("servers") === 9 && n("served") === 1200 && n("failed") === 0 && n("p95") === 450 && n("cost") === 0.9,
        "removing the dead server: nine serve all 1,200 a second, p95 450 ms, $0.90 an hour");

      // 6. Pull the plug on the only server: everything stops.
      t.click("reset");
      await t.run(1);
      t.click("plug");
      await t.run(1);
      t.expect(n("served") === 0 && n("failed") === 40 && n("servers") === 0 && t.logText().indexOf("single point of failure") >= 0,
        "pulling the plug on the only server drops every request: a single point of failure");
    }
  });
})();
