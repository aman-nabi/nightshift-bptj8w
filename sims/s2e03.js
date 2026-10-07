/* sims/s2e03-v1.0.0.js  (published as sims/s2e03.js)
   Case s2e03 "Nobody Remembers You": a session sim for the Mirabel Ballroom's website, where the
   coat tickets live on guests' phones. Three web servers (maud, ellis, vera, with a fourth slot,
   nora) sit behind a load balancer, and the learner picks where the guests' sessions live.

   CHANGELOG
   v1.0.0 (2026-10-07) first version: 600 signed-in guests refresh their ticket page every 20 s
     (30 requests a second). Controls: where sessions live (each server's memory, sticky sessions,
     a shared session store, signed tickets), the server the buttons act on, crash the server
     (back after 30 s with an empty memory), add a server (scale out), remove the server (scale
     in, drained first), rolling deploy (one server at a time, 30 s each), the store's standby
     copy on or off, fail the session store, cancel a stolen phone's ticket, reset. Stats: guests
     logged out so far, logouts a second, each server's share of requests, the added wait per
     request in ms, and whether a stolen phone's ticket still works. selfTest: each of the four
     modes under a crash, scale-in and a rolling deploy, plus scale-out under memory and sticky
     sessions, the store failing with and without its standby, and a stolen ticket in the store
     and token modes.

   Where every number comes from (conventions rule 14; the case is content/s2/s2e03-v1.0.0.json):
   - post: 600 guests signed in, 200 on each of maud, ellis and vera; the ticket page refreshes
     every 20 seconds (so 30 requests a second, 10 per server); two refreshes in three meet a
     stranger, 20 sign-in screens a second; sticky sessions from 12:40; maud crashed at 1:52:10
     and lost 200 sessions, back 30 s later with an empty memory; nora added at 1:58 and got
     nobody; at 2:00 ellis and vera held 300 guests and 15 requests a second each. The sim clock
     starts at 01:30:00, the first line of Ansel's log.
   - comments: draining can't move a session and a rolling deploy logs out every guest at least
     once (u/hatcheck_hugo); a shared store costs about a millisecond a request, and without a
     standby copy a failed store can come back empty and log out all 600 (u/one_ledger_lin); a
     signed ticket of about 700 bytes that can't be taken back (u/stamped_ticket_suki).
   - reply options: the first (index 0) Part 2's rolling deploy under sticky sessions: maud, then
     ellis, then vera, 30 s each, 950 sign-in screens for 600 guests, and at the end maud 375,
     ellis 225, vera none. The senior answer (index 2): 10 requests a second to each server,
     nobody logged out by the deploy, a crash or the store's failover, a stolen phone's session
     deleted. The signed-ticket answer (index 3): tickets valid until 6 AM, nothing to cancel.

   Teaching models (stated in sim.lede):
   - Steady state, recomputed every frame from the current setup, as in s2e01 and s2e02. No
     api.rand(), so every stat is repeatable and the selfTest can assert the story's numbers.
   - Memory mode: round robin sends each request to any running server, so with N servers
     running, (N - 1) of every N requests reach a server without the guest's session: 30 x 2/3 =
     20 logouts a second with three, 15 with two, 22.5 with four, 0 with one. Sessions are spread
     evenly, 600 / N per server, and a server that crashes, restarts or leaves takes its 600 / N
     with it.
   - Sticky mode: each guest stays on the server holding their session. A server that crashes,
     restarts for a deploy or is removed logs out everyone on it at once; they sign in again at
     once and land on the servers still running, in turn (200 over two is 100 each). A server
     that comes back or joins gets nobody, because there are no new guests in the replay.
   - Store and token modes: no server holds a session, so nobody is ever logged out by a server
     event, and round robin splits requests evenly over the running servers. The store adds 1 ms
     to each request; a signed ticket adds no lookup.
   - The load balancer notices a stopped server at once (s2e02 covered the real detection time).
   - A failed store with its standby copy on loses nothing; with it off, it comes back empty and
     all 600 guests are logged out at once.
   - Changing where sessions live replays the night from 01:30:00 with the same standby setting.

   Diagram layout, checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px):
   - Server boxes are 160 wide. Longest sub "restarting, 30 s" (16 chars, 115px); longest meta
     "200 sessions here" or "keeps no sessions" (17 chars, 112px).
   - The load balancer box is 300 wide. Longest sub "round robin, not sticky" (23 chars, 166px);
     longest meta "each guest to one server" (24 chars, 158px).
   - The store box is 300 wide. Longest sub "600 sessions, +1 ms each" (24 chars, 173px); longest
     meta "sessions live in servers" (24 chars, 158px).
   - The group label "The Mirabel's servers" (21 chars, 139px) sits at y 213, above the server
     boxes' top edge at y 231. The fan-out edges carry no labels; the dots show where requests go.

   Catalog note: the case's concepts and board cards use the catalog's own ids for s2e03
   (stateless-services, sticky-sessions-vs-a-shared-session-store). One board string points at
   connection-draining, which s2e02 introduced and which is not yet a concept id in
   content/catalog-v1.0.8.json.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var SPEED = 10;                          // sim seconds per real second
  var START_CLOCK = 1 * 3600 + 30 * 60;    // 01:30:00, Saturday at the Mirabel
  var GUESTS = 600;                        // guests signed in
  var REFRESH_SEC = 20;                    // each ticket page refreshes every 20 s
  var RPS = GUESTS / REFRESH_SEC;          // 30 requests a second
  var RESTART_SEC = 30;                    // a crashed or updated server is back after 30 s
  var STORE_MS = 1;                        // reading the shared store: about a millisecond
  var TOKEN_BYTES = 700;                   // a signed ticket: about 700 bytes
  var NAMES = ["maud", "ellis", "vera", "nora"];
  var START_RUNNING = 3;                   // maud, ellis and vera; nora is a spare slot
  var EPS = 1e-6;
  var DOT_SPEED = 300;                     // viewBox units per real second
  var DOT_EVERY = 0.3;                     // real seconds between sample dots

  var MODES = [
    { id: "local", label: "In each server's memory" },
    { id: "sticky", label: "Sticky sessions" },
    { id: "store", label: "Shared session store" },
    { id: "token", label: "Signed tickets (tokens)" }
  ];

  /* ---------- small helpers ---------- */

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  // 1950 -> "1,950". Written by hand so the output never depends on the browser's locale.
  function fmt(n) {
    var s = String(Math.round(n));
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
  }

  // 20 -> "20", 22.5 -> "22.5", 0 -> "0".
  function rateText(v) {
    if (!(v >= 0.05)) return "0";
    var r = Math.round(v * 10) / 10;
    return r === Math.round(r) ? String(Math.round(r)) : String(r);
  }

  function listWords(items) {
    if (!items.length) return "";
    if (items.length === 1) return String(items[0]);
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  function plural(n, one, many) { return fmt(n) + " " + (Math.round(n) === 1 ? one : many); }

  function idOf(srv) { return srv.id; }

  function modeOf(id) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === String(id)) return MODES[i];
    return null;
  }

  function serverById(S, id) {
    for (var i = 0; i < S.servers.length; i++) if (S.servers[i].id === String(id)) return S.servers[i];
    return null;
  }

  /* A server is "up" (running, gets requests), "down" (crashed or restarting for a deploy, back at
     backAt) or "off" (not running: the spare slot, or removed by scaling in). */
  function running(S) { return S.servers.filter(function (s) { return s.state === "up"; }); }
  function anyDown(S) { return S.servers.some(function (s) { return s.state === "down"; }); }
  function holdsSessions(S) { return S.mode === "local" || S.mode === "sticky"; }

  function canKill(S, srv) { return !S.deploy && !!srv && srv.state === "up" && running(S).length >= 2; }
  function canRemove(S, srv) { return canKill(S, srv); }
  function canAdd(S) { return !S.deploy && S.servers.some(function (s) { return s.state === "off"; }); }
  function canDeploy(S) { return !S.deploy && !anyDown(S) && running(S).length >= 2; }

  /* ---------- the diagram ---------- */

  var SERVER_X = [100, 280, 460, 640];
  var SERVER_Y = 262;

  var DIAGRAM = (function () {
    var nodes = [
      { id: "phones", label: "Guests' phones", sub: "600 signed in, 30 req/s", x: 370, y: 36, w: 260, h: 52, shape: "box", tone: "" },
      { id: "lb", label: "Load balancer", sub: "round robin, not sticky", meta: "any request, any server", x: 370, y: 128, w: 300, h: 62, shape: "box", tone: "" }
    ];
    var edges = [{ from: "phones", to: "lb" }];
    for (var k = 0; k < NAMES.length; k++) {
      var on = k < START_RUNNING;
      nodes.push({
        id: NAMES[k], label: NAMES[k], sub: on ? "running" : "not running", meta: on ? "200 sessions here" : "",
        x: SERVER_X[k], y: SERVER_Y, w: 160, h: 62, shape: "box", tone: on ? "ok" : "muted"
      });
      edges.push({ from: "lb", to: NAMES[k] });
    }
    nodes.push({ id: "store", label: "Session store", sub: "not used", meta: "sessions live in servers", x: 370, y: 380, w: 300, h: 62, shape: "db", tone: "muted" });
    for (k = 0; k < NAMES.length; k++) edges.push({ from: NAMES[k], to: "store", dash: true, tone: "muted" });
    return {
      type: "arch",
      w: 740,
      h: 430,
      aria: "Session sim. 600 guests' phones send 30 requests a second to a load balancer, which hands them in turn to the Mirabel's web servers, maud, ellis and vera, with a fourth slot, nora, not running. Below them is a shared session store, used only when sessions live there. At the start each server keeps the sessions of the 200 guests who signed in on it in its own memory.",
      groups: [
        { label: "The Mirabel's servers", x: 10, y: 196, w: 720, h: 112 }
      ],
      nodes: nodes,
      edges: edges
    };
  })();

  /* ---------- the model ---------- */

  function compute(S) {
    var up = running(S);
    var N = up.length;
    var r = { N: N, pct: {}, rate: 0, ms: 0, perLocal: N > 0 ? GUESTS / N : 0 };
    var total = 0;
    var i, s, p;
    if (S.mode === "sticky") for (i = 0; i < up.length; i++) total += up[i].guests;
    for (i = 0; i < S.servers.length; i++) {
      s = S.servers[i];
      p = 0;
      if (s.state === "up") {
        if (S.mode === "sticky") p = total > 0 ? 100 * s.guests / total : 0;
        else p = 100 / N;
      }
      r.pct[s.id] = p;
    }
    if (S.mode === "local" && N > 1) r.rate = RPS * (N - 1) / N;
    if (S.mode === "store") r.ms = STORE_MS;
    return r;
  }

  // Logged-out guests sign in again at once and land on the running servers in turn.
  function spread(S, n) {
    var up = running(S);
    var k = up.length;
    if (!k || !(n > 0)) return;
    var base = Math.floor(n / k);
    var rem = n - base * k;
    for (var i = 0; i < k; i++) up[i].guests += base + (i < rem ? 1 : 0);
  }

  // The sessions a server takes with it when it stops. Call it while the server is still up.
  function sessionsOn(S, srv) {
    if (S.mode === "local") return GUESTS / running(S).length;
    if (S.mode === "sticky") return srv.guests;
    return 0;
  }

  function takeDown(S, srv, why) {
    var lostNow = sessionsOn(S, srv);
    var moved = srv.guests;
    srv.state = "down";
    srv.why = why;
    srv.backAt = S.t + RESTART_SEC;
    srv.guests = 0;
    if (S.mode === "sticky") spread(S, moved);
    S.lost += lostNow;
    return lostNow;
  }

  function sitKey(S, r) { return [S.mode, r.N].join("|"); }

  function narrate(api, r) {
    var S = api.state;
    var key = sitKey(S, r);
    if (key === S.sitKey) return;
    S.sitKey = key;
    if (S.mode !== "local") return;
    if (r.N <= 1) {
      api.log("Only one server is running, so every request reaches the one memory that holds the sessions. Nobody is logged out, until it stops.", "warn");
    } else {
      api.log("With " + r.N + " servers running, " + (r.N - 1) + " in " + r.N + " requests reach a server that has never met the guest: " +
        rateText(r.rate) + " logouts a second.", "bad");
    }
  }

  function intro(S) {
    var head = "1:30 AM on Saturday at the Mirabel. 600 guests are signed in, 200 through each of maud, ellis and vera, and every phone refreshes its ticket page every 20 seconds: 30 requests a second, handed to the servers in turn. ";
    if (S.mode === "sticky") return head + "Sticky sessions are on: each phone goes back to the server it signed in on, 200 guests each, and nobody meets a stranger.";
    if (S.mode === "store") return head + "Sessions live in a shared store that every server reads, about 1 ms per request, so any server can answer any guest.";
    if (S.mode === "token") return head + "Each phone carries its session as a signed ticket of about " + TOKEN_BYTES + " bytes, and any server can check its signature.";
    return head + "Sessions live in each server's own memory, so two requests in three reach a server that has never met the guest: 20 logouts a second.";
  }

  /* ---------- drawing ---------- */

  function draw(api, r) {
    var S = api.state;
    var sticky = S.mode === "sticky";

    api.node("phones").text("sub", fmt(GUESTS) + " signed in, " + fmt(RPS) + " req/s");
    var lb = api.node("lb");
    lb.text("sub", sticky ? "sticky cookie: on" : "round robin, not sticky");
    lb.text("meta", sticky ? "each guest to one server" : "any request, any server");
    lb.set(r.N ? "" : "bad");

    S.servers.forEach(function (srv) {
      var node = api.node(srv.id);
      var sub, meta, tone;
      if (srv.state === "off") {
        sub = "not running";
        meta = "";
        tone = "muted";
      } else if (srv.state === "down") {
        var left = Math.max(0, Math.ceil(srv.backAt - S.t - EPS));
        sub = (srv.why === "deploy" ? "updating, " : "restarting, ") + left + " s";
        meta = holdsSessions(S) ? "memory wiped" : "keeps no sessions";
        tone = "bad";
      } else {
        sub = "running";
        if (S.mode === "local") {
          meta = fmt(r.perLocal) + " sessions here";
          tone = r.N > 1 ? "warn" : "ok";
        } else if (sticky) {
          meta = fmt(srv.guests) + " guests here";
          tone = srv.guests === 0 && r.N > 1 ? "warn" : "ok";
        } else {
          meta = "keeps no sessions";
          tone = "ok";
        }
      }
      node.text("sub", sub);
      node.text("meta", meta);
      node.set(tone);
      api.edge("lb", srv.id).set(srv.state === "up" ? "" : "cut");
    });

    var st = api.node("store");
    if (S.mode === "store") {
      st.text("sub", fmt(GUESTS) + " sessions, +" + STORE_MS + " ms each");
      st.text("meta", S.standby ? "standby copy: on" : "standby copy: off");
      st.set(S.standby ? "ok" : "warn");
    } else if (S.mode === "token") {
      st.text("sub", "not used");
      st.text("meta", "tickets carry sessions");
      st.set("muted");
    } else {
      st.text("sub", "not used");
      st.text("meta", "sessions live in servers");
      st.set("muted");
    }

    S.stat.lost(fmt(S.lost));
    S.stat.rate(rateText(r.rate));
    S.stat.share(NAMES.map(function (id) { return Math.round(r.pct[id] + EPS); }).join("/"));
    S.stat.ms(String(r.ms));
    S.stat.stolen(S.stolen);

    var sel = serverById(S, S.sel);
    S.ctl.kill.disable(!canKill(S, sel));
    S.ctl.remove.disable(!canRemove(S, sel));
    S.ctl.add.disable(!canAdd(S));
    S.ctl.deploy.disable(!canDeploy(S));
    S.ctl.storefail.disable(S.mode !== "store");
    S.ctl.standby.disable(S.mode !== "store");
  }

  function refresh(api) {
    var r = compute(api.state);
    narrate(api, r);
    draw(api, r);
  }

  /* ---------- dots: a visual sample, never counted ---------- */

  function requestDots(api, dt, r) {
    var S = api.state;
    if (api.reducedMotion || !r.N) return;
    S.dotClock += dt;
    if (S.dotClock < DOT_EVERY) return;
    S.dotClock = 0;
    // Smooth weighted round robin over the current shares, so the sample follows the split.
    var best = null;
    var total = 0;
    running(S).forEach(function (srv) {
      var w = r.pct[srv.id];
      if (!(w > 0)) return;
      srv.cur += w;
      total += w;
      if (!best || srv.cur > best.cur) best = srv;
    });
    if (!best || !(total > 0)) return;
    best.cur -= total;
    var fail = false;
    if (S.mode === "local" && r.N > 1) {
      best.acc += (r.N - 1) / r.N;
      if (best.acc >= 1 - EPS) { best.acc -= 1; fail = true; }
    }
    var target = best.id;
    var path = S.mode === "store" ? ["phones", "lb", target, "store"] : ["phones", "lb", target];
    api.dot({
      path: path, cls: "dot-req", r: 4, speed: DOT_SPEED,
      onArrive: function (dot, wp) {
        if (dot && wp === target) dot.cls(fail ? "dot-fail" : "dot-ok");
      }
    });
  }

  /* ---------- the night ---------- */

  function startNight(api) {
    var S = api.state;
    S.t = 0;
    api.clock = START_CLOCK;
    S.servers = NAMES.map(function (id, k) {
      return { id: id, state: k < START_RUNNING ? "up" : "off", guests: 0, backAt: 0, why: "", cur: 0, acc: 0 };
    });
    if (S.mode === "sticky") {
      for (var k = 0; k < START_RUNNING; k++) S.servers[k].guests = GUESTS / START_RUNNING;
    }
    S.lost = 0;
    S.stolen = "-";
    S.deploy = null;
    S.dotClock = 0;
    var r = compute(S);
    S.sitKey = sitKey(S, r);
    api.log(intro(S), S.mode === "local" ? "bad" : "");
    draw(api, r);
  }

  function comeBack(api, srv) {
    var S = api.state;
    srv.state = "up";
    srv.guests = 0;
    var what = srv.why === "deploy" ? "back with the new version" : "back";
    var msg;
    if (S.mode === "local") {
      msg = srv.id + " is " + what + ", with an empty memory. Guests sign in on it again as round robin brings them.";
    } else if (S.mode === "sticky") {
      msg = srv.id + " is " + what + ", with an empty memory. Every guest is already stuck to another server, so it gets nobody.";
    } else {
      msg = srv.id + " is " + what + " and takes its share of requests at once: any server can answer any guest.";
    }
    api.log(msg, S.mode === "sticky" ? "warn" : "ok");
  }

  function deployNext(api) {
    var S = api.state;
    var d = S.deploy;
    while (d.i < d.order.length) {
      var srv = serverById(S, d.order[d.i]);
      if (srv && srv.state === "up" && running(S).length >= 2) {
        var lostNow = takeDown(S, srv, "deploy");
        d.current = srv.id;
        var others = listWords(running(S).map(idOf));
        var msg = "Rolling deploy: " + srv.id + " is drained and restarted with the new version, off for 30 s.";
        if (S.mode === "local") {
          msg += " Draining lets its requests finish, but the " + fmt(lostNow) + " sessions in its memory are wiped.";
        } else if (S.mode === "sticky") {
          msg += lostNow > 0
            ? " Draining lets its requests finish, but it can't move a session: its " + plural(lostNow, "guest is", "guests are") +
              " logged out and sign in again on " + others + "."
            : " Nobody was stuck to it, so nobody is logged out.";
        } else {
          msg += " Its requests go to " + others + ", and nobody is logged out.";
        }
        api.log(msg, lostNow > 0 ? "bad" : "ok");
        return;
      }
      d.i += 1;
    }
    var total = S.lost - d.startLost;
    api.log("The deploy is done: every server runs the new version. Guests logged out during it: " + fmt(total) + ".",
      total >= 0.5 ? "bad" : "ok");
    S.deploy = null;
  }

  /* ---------- controls ---------- */

  function setMode(api, v) {
    var m = modeOf(v);
    if (!m) return;
    api.state.mode = m.id;
    startNight(api);
  }

  function setServer(api, v) {
    var S = api.state;
    if (!serverById(S, v)) return;
    S.sel = String(v);
    refresh(api);
  }

  function setStandby(api, on) {
    var S = api.state;
    S.standby = !!on;
    api.log(S.standby
      ? "The store gets a standby copy in another zone, which takes over within seconds if the main copy fails."
      : "The store's standby copy is switched off. The store is now a single point of failure.", S.standby ? "ok" : "warn");
    refresh(api);
  }

  function kill(api) {
    var S = api.state;
    var srv = serverById(S, S.sel);
    if (!canKill(S, srv)) return;
    var lostNow = takeDown(S, srv, "crash");
    var others = listWords(running(S).map(idOf));
    var msg;
    if (S.mode === "local") {
      msg = srv.id + " crashes, and the " + fmt(lostNow) + " sessions in its memory go with it. Those guests are logged out.";
    } else if (S.mode === "sticky") {
      msg = lostNow > 0
        ? srv.id + " crashes, and its memory goes with it: the " + plural(lostNow, "guest", "guests") + " stuck to it are logged out at once. They sign in again on " + others + "."
        : srv.id + " crashes. Nobody was stuck to it, so nobody is logged out.";
    } else if (S.mode === "store") {
      msg = srv.id + " crashes. It held no sessions: they're all in the store. Its requests go to " + others + ", and nobody is logged out.";
    } else {
      msg = srv.id + " crashes. It held no sessions: every guest carries a signed ticket. Its requests go to " + others + ", and nobody is logged out.";
    }
    api.log(msg + " It will be back in 30 s.", lostNow > 0 ? "bad" : "ok");
    refresh(api);
  }

  function removeServer(api) {
    var S = api.state;
    var srv = serverById(S, S.sel);
    if (!canRemove(S, srv)) return;
    var lostNow = sessionsOn(S, srv);
    var moved = srv.guests;
    srv.state = "off";
    srv.guests = 0;
    if (S.mode === "sticky") spread(S, moved);
    S.lost += lostNow;
    var others = listWords(running(S).map(idOf));
    var msg = "You scale in: " + srv.id + " is drained and removed.";
    if (S.mode === "local") {
      msg += " Draining lets its requests finish, but the " + fmt(lostNow) + " sessions in its memory go with it.";
    } else if (S.mode === "sticky") {
      msg += lostNow > 0
        ? " Draining lets its requests finish, but it can't move a session: its " + plural(lostNow, "guest is", "guests are") +
          " logged out and sign in again on " + others + "."
        : " Nobody was stuck to it, so nobody is logged out.";
    } else {
      msg += " Its requests go to " + others + ", and nobody notices.";
    }
    api.log(msg, lostNow > 0 ? "bad" : "ok");
    refresh(api);
  }

  function addServer(api) {
    var S = api.state;
    if (!canAdd(S)) return;
    var srv = null;
    for (var i = 0; i < S.servers.length; i++) {
      if (S.servers[i].state === "off") { srv = S.servers[i]; break; }
    }
    srv.state = "up";
    srv.guests = 0;
    srv.cur = 0;
    srv.acc = 0;
    var msg = "You scale out: " + srv.id + " joins.";
    var tone = "ok";
    if (S.mode === "sticky") {
      msg += " Every guest is already stuck to a server, so " + srv.id + " gets nobody until someone new signs in.";
      tone = "warn";
    } else if (S.mode === "local") {
      msg += " It starts with an empty memory, and one more server means more requests reach a stranger.";
      tone = "bad";
    } else {
      msg += " It takes its share of requests at once: any server can answer any guest.";
    }
    api.log(msg, tone);
    refresh(api);
  }

  function deploy(api) {
    var S = api.state;
    if (!canDeploy(S)) return;
    var order = running(S).map(idOf);
    S.deploy = { order: order, i: 0, current: null, startLost: S.lost };
    api.log("Rolling deploy of " + listWords(order) + ": one server at a time, each drained, restarted with the new version and off for 30 s.", "");
    deployNext(api);
    refresh(api);
  }

  function storeFail(api) {
    var S = api.state;
    if (S.mode !== "store") return;
    if (S.standby) {
      api.log("The store's main copy fails. The standby copy in the other zone is promoted within seconds, with every session in it. Nobody is logged out.", "ok");
    } else {
      S.lost += GUESTS;
      api.log("The store fails, and there's no standby copy. It comes back empty: all " + fmt(GUESTS) +
        " sessions are gone, and every guest is logged out at once.", "bad");
    }
    refresh(api);
  }

  function stolen(api) {
    var S = api.state;
    if (S.mode === "token") {
      S.stolen = "still works";
      api.log("A guest's phone is stolen. Ansel looks for a way to cancel its ticket and finds none: any server that checks the signature accepts it until it expires at 6 AM.", "bad");
    } else {
      S.stolen = "cancelled";
      api.log(S.mode === "store"
        ? "A guest's phone is stolen. Ansel deletes the session from the store, and the thief's next refresh gets the sign-in screen."
        : "A guest's phone is stolen. Ansel deletes the session from the memory of the server holding it, and the thief's next refresh gets the sign-in screen.", "ok");
    }
    refresh(api);
  }

  /* ---------- the clock ---------- */

  function step(api, dt) {
    var S = api.state;
    if (!S.servers) return;
    var simDt = dt * api.speed;
    S.t += simDt;

    S.servers.forEach(function (srv) {
      if (srv.state !== "down" || S.t + EPS < srv.backAt) return;
      comeBack(api, srv);
      if (S.deploy && S.deploy.current === srv.id) {
        S.deploy.i += 1;
        S.deploy.current = null;
        deployNext(api);
      }
    });

    var r = compute(S);
    S.lost += r.rate * simDt;
    narrate(api, r);
    draw(api, r);
    requestDots(api, dt, r);
  }

  /* ---------- "what is this box" ---------- */

  function serverInfo(id) {
    return function (S, r) {
      var srv = serverById(S, id);
      var head = "<strong>" + id + ".</strong> One of the Mirabel's web servers, named after one of the three women in the 1962 photo above the cloakroom hatch. ";
      if (id === "nora") head = "<strong>nora.</strong> The fourth server slot, the one Ansel added at 1:58. ";
      if (srv.state === "off") return head + "It isn't running. <em>Add a server</em> starts it, with an empty memory.";
      if (srv.state === "down") {
        return head + (srv.why === "deploy" ? "It's being updated" : "It crashed") + " and will be back in " +
          Math.max(0, Math.ceil(srv.backAt - S.t - EPS)) + " s" + (holdsSessions(S) ? ", with an empty memory." : ".");
      }
      if (S.mode === "local") {
        return head + "It keeps the sessions of the guests who signed in on it in its own memory, about " + fmt(r.perLocal) +
          " of them. A request from anyone else gets the sign-in screen.";
      }
      if (S.mode === "sticky") {
        return head + "It holds the sessions of the " + plural(srv.guests, "guest", "guests") +
          " stuck to it, and the load balancer sends it only their requests. If it stops, they're all logged out.";
      }
      if (S.mode === "store") return head + "It keeps no sessions: for every request it reads the guest's session from the shared store, about 1 ms.";
      return head + "It keeps no sessions: for every request it checks the signature on the guest's ticket with the key all the servers share.";
    };
  }

  var INFO = {
    phones: function () {
      return "<strong>Guests' phones.</strong> 600 guests signed in to the Mirabel's website. Each phone's ticket page refreshes itself every 20 seconds, so together they send 30 requests a second. Each request carries the guest's cookie: a session ID, or in signed-ticket mode the whole ticket, about " + TOKEN_BYTES + " bytes.";
    },
    lb: function (S) {
      return "<strong>Load balancer.</strong> It hands each request to the next running server in turn (round robin). " +
        (S.mode === "sticky"
          ? "Sticky sessions are on: it gave each phone a cookie naming its server and sends that phone back there every time. Only a guest whose server stopped is sent to the next server in turn."
          : "Stickiness is off: any request can go to any server.") +
        " In this sim it notices a stopped server at once.";
    },
    store: function (S) {
      if (S.mode === "store") {
        return "<strong>Session store.</strong> A Redis-style store that every server reads, holding all 600 sessions under their session IDs. Each read adds about 1 ms. " +
          (S.standby ? "A standby copy in another zone takes over within seconds if the main copy fails." : "There's no standby copy: if it fails, it comes back empty.");
      }
      if (S.mode === "token") return "<strong>Session store.</strong> Not used: each guest carries a signed ticket, and any server can check it with the shared key. Nothing can cancel a ticket before it expires at 6 AM.";
      return "<strong>Session store.</strong> Not used: sessions live in each server's own memory.";
    }
  };
  for (var i = 0; i < NAMES.length; i++) INFO[NAMES[i]] = serverInfo(NAMES[i]);

  /* ---------- the module ---------- */

  DL.sims.define("s2e03", {
    diagram: DIAGRAM,
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      S.mode = "local";
      S.standby = true;
      S.sel = NAMES[0];
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.mode = api.control.select("mode", "Where sessions live",
        MODES.map(function (m) { return { value: m.id, label: m.label }; }), "local", function (v) { setMode(api, v); });
      S.ctl.server = api.control.select("server", "Server the buttons act on",
        NAMES.map(function (id) { return { value: id, label: id }; }), NAMES[0], function (v) { setServer(api, v); });
      S.ctl.kill = api.control.button("kill", "Crash the server", function () { kill(api); }, { tone: "danger" });
      S.ctl.remove = api.control.button("remove", "Remove the server (scale in)", function () { removeServer(api); });
      S.ctl.add = api.control.button("add", "Add a server (scale out)", function () { addServer(api); });
      S.ctl.deploy = api.control.button("deploy", "Rolling deploy", function () { deploy(api); });
      S.ctl.standby = api.control.toggle("standby", "Store has a standby copy", true, function (on) { setStandby(api, on); });
      S.ctl.storefail = api.control.button("storefail", "Session store fails", function () { storeFail(api); }, { tone: "danger" });
      S.ctl.stolen = api.control.button("stolen", "Cancel a stolen phone's ticket", function () { stolen(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        lost: api.stat("lost", "guests logged out so far", "bad"),
        rate: api.stat("rate", "logouts a second", "bad"),
        share: api.stat("share", "share %, maud/ellis/vera/nora", ""),
        ms: api.stat("ms", "added wait per request, ms", "warn"),
        stolen: api.stat("stolen", "stolen phone's ticket", "")
      };

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state, compute(api.state)));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");

      startNight(api);
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
      var before, d;

      // 1. Sessions in each server's memory, three servers, round robin.
      await t.run(1);
      t.expect(n("rate") === 20 && same(shares(), [33, 33, 33, 0]) && n("ms") === 0 && Math.abs(n("lost") - 200) <= 2,
        "memory: two requests in three reach a server that never met the guest, 20 logouts a second (about 200 in 10 s)");

      before = n("lost");
      t.click("kill");
      t.expect(n("lost") - before === 200 && n("rate") === 15 && same(shares(), [0, 50, 50, 0]) && t.node("maud").state === "bad",
        "memory: crashing maud wipes the 200 sessions in its memory, and with two servers one refresh in two meets a stranger, 15 a second");
      await t.run(3.2);
      t.expect(t.node("maud").text.sub === "running" && same(shares(), [33, 33, 33, 0]) && n("rate") === 20,
        "memory: maud is back 30 s later with an empty memory, and the night goes back to 20 logouts a second");

      t.click("reset");
      t.set("server", "vera");
      t.click("remove");
      t.expect(n("lost") === 200 && n("rate") === 15 && same(shares(), [50, 50, 0, 0]),
        "memory: scaling in removes vera and the 200 sessions in its memory");
      t.click("add");
      t.click("add");
      t.expect(n("rate") === 22.5 && same(shares(), [25, 25, 25, 25]),
        "memory: scaling out to four servers makes it worse, three requests in four reach a stranger, 22.5 a second");

      t.click("reset");
      t.click("deploy");
      await t.run(9);
      d = n("lost");
      t.expect(d >= 1940 && d <= 1962,
        "memory: a rolling deploy wipes each server's 200 sessions in turn, on top of 15 logouts a second while one is off, about 1,950 in 90 s");

      // 2. Sticky sessions.
      t.click("reset");
      t.set("mode", "sticky");
      await t.run(1);
      t.expect(n("lost") === 0 && n("rate") === 0 && same(shares(), [33, 33, 33, 0]) && n("ms") === 0 && t.node("maud").text.meta === "200 guests here",
        "sticky: each guest goes back to the server holding their session, 200 on each, and nobody is logged out");

      t.click("kill");
      t.expect(n("lost") === 200 && same(shares(), [0, 50, 50, 0]) && t.node("ellis").text.meta === "300 guests here" && t.node("vera").text.meta === "300 guests here",
        "sticky: crashing maud logs out the 200 guests stuck to it at once, and they sign in again on ellis and vera, 300 each");
      await t.run(3.2);
      t.expect(t.node("maud").text.sub === "running" && t.node("maud").text.meta === "0 guests here" && t.node("maud").state === "warn" && same(shares(), [0, 50, 50, 0]),
        "sticky: maud comes back 30 s later to nobody, and the load stays 0/50/50");
      t.click("add");
      t.expect(t.node("nora").text.meta === "0 guests here" && same(shares(), [0, 50, 50, 0]) && n("lost") === 200,
        "sticky: scaling out adds nora, and nora gets nobody either");

      t.click("reset");
      t.set("mode", "sticky");
      t.set("server", "vera");
      t.click("remove");
      t.expect(n("lost") === 200 && same(shares(), [50, 50, 0, 0]) && t.node("maud").text.meta === "300 guests here",
        "sticky: scaling in removes vera, draining can't move its sessions, and its 200 guests sign in again on maud and ellis");

      t.click("reset");
      t.set("mode", "sticky");
      t.click("deploy");
      await t.run(9.5);
      t.expect(n("lost") === 950 && same(shares(), [63, 38, 0, 0]) && t.node("maud").text.meta === "375 guests here" &&
        t.node("ellis").text.meta === "225 guests here" && t.node("vera").text.meta === "0 guests here",
        "sticky: a rolling deploy logs out 950 times for 600 guests and leaves maud 375, ellis 225 and vera none");

      // 3. A shared session store.
      t.click("reset");
      t.set("mode", "store");
      t.click("kill");
      t.expect(n("lost") === 0 && n("ms") === 1 && n("rate") === 0 && same(shares(), [0, 50, 50, 0]),
        "store: crashing maud logs out nobody; ellis and vera take its requests, at 1 ms more per request");
      await t.run(3.2);
      t.expect(same(shares(), [33, 33, 33, 0]) && n("lost") === 0,
        "store: maud is back and takes its third at once, because any server can answer any guest");
      t.set("server", "vera");
      t.click("remove");
      t.expect(n("lost") === 0 && same(shares(), [50, 50, 0, 0]),
        "store: scaling in removes vera without logging anyone out");
      t.click("add");
      t.click("deploy");
      await t.run(9.5);
      t.expect(n("lost") === 0 && same(shares(), [33, 33, 33, 0]) && t.node("vera").text.sub === "running",
        "store: a rolling deploy of all three servers logs out nobody");

      t.click("storefail");
      t.expect(n("lost") === 0,
        "store: with a standby copy, the store's failure costs nobody their session");
      t.set("standby", false);
      t.click("storefail");
      t.expect(n("lost") === 600,
        "store: without a standby copy, a failed store comes back empty and all 600 guests are logged out at once");
      t.click("stolen");
      t.expect(t.stat("stolen") === "cancelled",
        "store: a stolen phone's session can be deleted, so its ticket stops working at once");

      // 4. Signed tickets.
      t.click("reset");
      t.set("mode", "token");
      t.click("kill");
      t.expect(n("lost") === 0 && n("ms") === 0 && same(shares(), [0, 50, 50, 0]),
        "token: crashing maud logs out nobody, and no request waits for a store");
      await t.run(3.2);
      t.set("server", "vera");
      t.click("remove");
      t.expect(n("lost") === 0 && same(shares(), [50, 50, 0, 0]),
        "token: scaling in logs out nobody");
      t.click("add");
      t.click("deploy");
      await t.run(9.5);
      t.expect(n("lost") === 0 && same(shares(), [33, 33, 33, 0]),
        "token: a rolling deploy logs out nobody");
      t.click("stolen");
      t.expect(t.stat("stolen") === "still works",
        "token: a stolen phone's ticket can't be cancelled, and it works until it expires at 6 AM");
    }
  });
})();
