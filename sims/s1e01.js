/* sims/s1e01-v1.0.0.js  (published as sims/s1e01.js)
   Case s1e01 "The Building That Doesn't Exist": a DNS lookup you can watch.

   CHANGELOG
   v1.0.0 (2026-10-04) first version: listener with a browser and OS cache, an ISP resolver whose
     cached answer counts down its TTL, root, .com TLD and the station's nameserver, the old server
     (switched off after the move) and the new one. Controls: lookup, move, ttl, flush, reset.
     Stats: answered from cache, full lookups, visits to the dead server, visits to the new server.
     selfTest covers the five behaviours the case teaches.

   Notes for anyone copying this file as a template:
   - Everything sits inside one function so nothing leaks into the page. Two sims that each declared
     a top-level const would clash when both are loaded on the same page.
   - Every decision (cache hit or miss, which server) is made the moment the button is pressed. The
     dot is a slow-motion replay of a lookup that really takes milliseconds.
   - While a dot walks, api.speed is set to 0 so the clock waits for it, and restored when it lands.
     Nothing depends on that pause: each cache timer starts when the answer reaches that cache, and a
     safety timer (real seconds) finishes the walk even if a dot never arrives.
   - IP addresses come from the documentation ranges (RFC 5737), so they never point at a real machine.
*/
(function () {
  "use strict";

  var NAME = "hollowpinefm.com";
  var OLD_IP = "203.0.113.7";
  var NEW_IP = "198.51.100.24";
  var SPEED = 600;            // sim seconds per real second: 1 hour passes in 6 seconds, 1 day in 2.4 minutes
  var DOT_SPEED = 600;        // viewBox units per real second
  var DEFAULT_TTL = 86400;    // the story: one day, and nobody lowered it before the move
  var TTL_OPTIONS = [
    { value: "60", label: "60 seconds" },
    { value: "3600", label: "1 hour" },
    { value: "86400", label: "1 day" }
  ];

  /* Layout: the nameservers on top, the listener and the resolver in the middle, the web servers below.
     Label widths were checked at 0.6 x font size per character (label 13px, sub 12px, meta 11px). */
  var DIAGRAM = {
    type: "arch",
    w: 740,
    h: 430,
    aria: "DNS lookup sim. The listener's browser asks the ISP resolver for hollowpinefm.com. On a cache miss the resolver asks the root server, the .com TLD server and the station's nameserver in turn, then the listener connects to the old or the new web server.",
    groups: [
      { label: "DNS NAMESERVERS", x: 70, y: 4, w: 666, h: 112 }
    ],
    nodes: [
      { id: "root", label: "Root server", sub: "knows .com servers", x: 170, y: 70, w: 170, h: 60, shape: "box", tone: "" },
      { id: "tld", label: ".com TLD server", sub: "knows who to ask", x: 400, y: 70, w: 170, h: 60, shape: "box", tone: "" },
      { id: "auth", label: "Station nameserver", sub: "A: " + OLD_IP, meta: "TTL 1 day", x: 630, y: 70, w: 190, h: 72, shape: "box", tone: "" },
      { id: "you", label: "Listener", sub: "browser + OS cache", meta: "cache: empty", x: 95, y: 215, w: 176, h: 72, shape: "box", tone: "" },
      { id: "res", label: "ISP resolver", sub: "Bramblewire", meta: "cache: empty", x: 400, y: 215, w: 190, h: 72, shape: "box", tone: "" },
      { id: "old", label: "Old server", sub: OLD_IP, meta: "site lives here", x: 330, y: 360, w: 160, h: 72, shape: "box", tone: "ok" },
      { id: "new", label: "New server", sub: NEW_IP, meta: "empty for now", x: 600, y: 360, w: 160, h: 72, shape: "box", tone: "muted" }
    ],
    edges: [
      { from: "you", to: "res", label: "where is it?" },
      { from: "res", to: "root", label: "ask root" },
      { from: "res", to: "tld", label: "ask .com" },
      { from: "res", to: "auth", label: "ask station" },
      { from: "you", to: "old", label: "connect" },
      { from: "you", to: "new", label: "connect" }
    ]
  };

  /* ---------- small helpers ---------- */

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function ttlLabel(sec) {
    if (sec === 60) return "60 seconds";
    if (sec === 3600) return "1 hour";
    if (sec === 86400) return "1 day";
    return fmtLeft(sec);
  }

  // Time left on a cached copy, at most 7 characters so it fits inside the node ("23h 59m").
  function fmtLeft(sec) {
    var s = Math.max(0, Math.ceil(sec));
    if (s >= 3600) return Math.floor(s / 3600) + "h " + pad2(Math.floor((s % 3600) / 60)) + "m";
    if (s >= 60) return Math.floor(s / 60) + "m " + pad2(s % 60) + "s";
    return s + "s";
  }

  function center(id) {
    for (var i = 0; i < DIAGRAM.nodes.length; i++) {
      if (DIAGRAM.nodes[i].id === id) return DIAGRAM.nodes[i];
    }
    return { x: 0, y: 0 };
  }

  function pathLength(path) {
    var len = 0;
    for (var i = 1; i < path.length; i++) {
      var a = center(path[i - 1]), b = center(path[i]);
      len += Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
    }
    return len;
  }

  // A cache entry is usable while its answer is on the way (pending) or its timer hasn't run out.
  function valid(entry, now) { return !!entry && (entry.pending || entry.exp > now); }

  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  function cacheText(entry, now, emptyText, pendingText) {
    if (!entry) return emptyText;
    if (entry.pending) return pendingText;
    if (entry.exp <= now) return emptyText;
    return entry.ip + " · " + fmtLeft(entry.exp - now);
  }

  function describe(entry, now) {
    if (!entry || (!entry.pending && entry.exp <= now)) return "nothing saved";
    if (entry.pending) return "waiting for an answer";
    return "saved " + entry.ip + ", " + fmtLeft(entry.exp - now) + " left";
  }

  // Write node text and state only when they change (step runs every frame).
  function show(api, id, line, value) {
    var S = api.state;
    var key = id + "." + line;
    if (S.shown[key] === value) return;
    S.shown[key] = value;
    api.node(id).text(line, value);
  }

  function setState(api, id, state) {
    var S = api.state;
    if (S.states[id] === state) return;
    S.states[id] = state;
    api.node(id).set(state);
  }

  function updateStats(api) {
    var S = api.state;
    S.stat.cached(S.count.cached);
    S.stat.full(S.count.full);
    S.stat.dead(S.count.dead);
    S.stat.fresh(S.count.fresh);
  }

  function setBusy(api, on) {
    var S = api.state;
    S.busy = on;
    api.speed = on ? 0 : SPEED;
    S.ctl.lookup.disable(on);
    S.ctl.flush.disable(on);
    S.ctl.move.disable(on || S.moved);
  }

  /* ---------- the countdowns ---------- */

  function refresh(api) {
    var S = api.state;
    var now = api.clock;
    if (S.res && !S.res.pending && S.res.exp <= now) {
      api.log("Bramblewire's copy of " + S.res.ip + " just expired. The next visit that reaches the resolver will be a full lookup.", "");
      S.res = null;
    }
    if (S.you && !S.you.pending && S.you.exp <= now) S.you = null;

    show(api, "res", "meta", cacheText(S.res, now, "cache: empty", "asking around..."));
    show(api, "you", "meta", cacheText(S.you, now, "cache: empty", "waiting for an answer"));

    // A copy of the old address after the move is stale: it points at an empty building.
    var resStale = S.moved && !!S.res && !S.res.pending && S.res.ip === OLD_IP;
    var youStale = S.moved && !!S.you && !S.you.pending && S.you.ip === OLD_IP;
    setState(api, "res", resStale ? "warn" : "");
    setState(api, "you", youStale ? "warn" : "");
  }

  /* ---------- a dot walking the lookup ---------- */

  // legs[k] runs when the dot reaches path[k]. finish() runs once, from the last arrival or the safety timer.
  function walk(api, path, legs) {
    var session = api.state.session;
    var reached = 0;
    var finished = false;
    var dot = null;

    function alive() { return !finished && api.state.session === session; }
    function runLeg(k) { if (legs[k]) legs[k](dot); }
    function finish() {
      if (!alive()) return;
      finished = true;
      setBusy(api, false);
      refresh(api);
      if (dot) api.after(0.6, function () { if (dot) dot.remove(); });
    }

    setBusy(api, true);
    dot = api.dot({
      path: path,
      cls: "dot-req",
      r: 5,
      speed: DOT_SPEED,
      onArrive: function () {
        if (!alive()) return;
        reached += 1;
        runLeg(reached);
        if (reached >= path.length - 1) finish();
      }
    }) || null;

    // Safety net: if the dot was dropped or never arrives, play the remaining legs and finish anyway.
    api.after(pathLength(path) / DOT_SPEED + 1, function () {
      if (!alive()) return;
      while (reached < path.length - 1) { reached += 1; runLeg(reached); }
      finish();
    });
  }

  function arrive(api, dot, dest, dead) {
    if (dead) {
      api.log("Nothing answers at " + OLD_IP + ". The old server is switched off. For you, the station doesn't exist.", "bad");
      if (dot) dot.cls("dot-fail");
    } else if (dest === "old") {
      api.log("The old server at " + OLD_IP + " answers. The site loads.", "ok");
      if (dot) dot.cls("dot-ok");
    } else {
      api.log("The new server at " + NEW_IP + " answers. The site loads and the show plays.", "ok");
      if (dot) dot.cls("dot-ok");
    }
  }

  /* ---------- controls ---------- */

  function visit(api) {
    var S = api.state;
    if (S.busy) return;
    var now = api.clock;
    var kind, ip, resEntry = null, youEntry = null;

    if (valid(S.you, now)) {
      kind = "local";
      ip = S.you.ip;
    } else if (valid(S.res, now)) {
      kind = "resolver";
      ip = S.res.ip;
      resEntry = S.res;
      youEntry = S.you = { ip: ip, exp: S.res.exp, pending: true };
    } else {
      kind = "full";
      ip = S.moved ? NEW_IP : OLD_IP;
      resEntry = S.res = { ip: ip, exp: now + S.ttl, ttl: S.ttl, pending: true };
      youEntry = S.you = { ip: ip, exp: now + S.ttl, pending: true };
    }

    var dest = ip === OLD_IP ? "old" : "new";
    var dead = dest === "old" && S.moved;
    var stale = dead ? "warn" : "";
    if (kind === "full") S.count.full += 1; else S.count.cached += 1;
    if (dead) S.count.dead += 1;
    if (dest === "new") S.count.fresh += 1;
    updateStats(api);

    if (kind === "local") {
      api.log("You visit " + NAME + ". Your browser already has " + ip + " saved (" + fmtLeft(S.you.exp - now) + " left), so nobody is asked.", stale);
      walk(api, ["you", dest], {
        1: function (d) { arrive(api, d, dest, dead); }
      });
      return;
    }

    api.log("You visit " + NAME + ". Nothing is saved on your laptop, so it asks Bramblewire's resolver.", "");

    if (kind === "resolver") {
      walk(api, ["you", "res", "you", dest], {
        1: function () {
          api.log("The resolver already has it: " + ip + ", with " + fmtLeft(resEntry.exp - api.clock) + " left on its copy. It doesn't ask anyone.", stale);
        },
        2: function (d) {
          youEntry.pending = false;
          if (d) d.cls("dot-accent");
          api.log("Your browser saves that copy and connects to " + ip + ".", "");
        },
        3: function (d) { arrive(api, d, dest, dead); }
      });
      return;
    }

    walk(api, ["you", "res", "root", "res", "tld", "res", "auth", "res", "you", dest], {
      1: function () { api.log("The resolver checks its cache. Nothing fresh, so it has to ask around.", ""); },
      2: function () { api.log("Root server: \"I don't know that name. Ask the .com servers.\"", ""); },
      4: function () { api.log(".com TLD server: \"The station's own nameserver has that one. Ask it.\"", ""); },
      6: function (d) {
        if (d) d.cls("dot-accent");
        api.log("Station's nameserver: \"" + NAME + " is " + ip + ". Keep it for " + ttlLabel(resEntry.ttl) + ".\"", "");
      },
      7: function () {
        resEntry.exp = api.clock + resEntry.ttl;
        resEntry.pending = false;
        api.log("The resolver saves the answer. It won't ask again for " + ttlLabel(resEntry.ttl) + ".", "");
      },
      8: function () {
        youEntry.exp = resEntry.exp;
        youEntry.pending = false;
        api.log("Your browser and laptop save a copy too, then connect to " + ip + ".", "");
      },
      9: function (d) { arrive(api, d, dest, dead); }
    });
  }

  function move(api) {
    var S = api.state;
    if (S.moved || S.busy) return;
    S.moved = true;
    S.ctl.move.disable(true);
    show(api, "auth", "sub", "A: " + NEW_IP);
    setState(api, "old", "bad");
    show(api, "old", "meta", "switched off");
    setState(api, "new", "ok");
    show(api, "new", "meta", "site lives here");
    api.edge("you", "old").set("cut");
    api.log("Marcus moves the site to " + NEW_IP + " and switches the old server off. From now on the station's nameserver answers the new address.", "");
    var now = api.clock;
    if (valid(S.res, now)) {
      api.log("But Bramblewire's resolver still holds " + OLD_IP + " for " + fmtLeft(S.res.exp - now) + ". It won't ask again until then.", "warn");
    }
    refresh(api);
  }

  function flush(api) {
    var S = api.state;
    if (S.busy) return;
    var now = api.clock;
    S.you = null;
    var msg = "You flush your own browser and laptop cache.";
    if (valid(S.res, now) && S.res.ip === OLD_IP && S.moved) {
      api.log(msg + " Bramblewire's resolver still has " + OLD_IP + " for " + fmtLeft(S.res.exp - now) + ", so your next visit gets the same old address from it.", "warn");
    } else if (valid(S.res, now)) {
      api.log(msg + " The resolver's copy is still good, so your next visit is answered by the resolver.", "");
    } else {
      api.log(msg + " The resolver has nothing saved either, so your next visit will be a full lookup.", "");
    }
    refresh(api);
  }

  function setTTL(api, v) {
    var S = api.state;
    var ttl = Number(v);
    if (!(ttl > 0)) return;
    S.ttl = ttl;
    show(api, "auth", "meta", "TTL " + ttlLabel(ttl));
    var line = "The station's record now says TTL " + ttlLabel(ttl) + ". New copies will keep it that long.";
    var now = api.clock;
    if (S.res && !S.res.pending && S.res.exp - now > ttl) {
      api.log(line + " Copies already saved keep their old timer: Bramblewire's has " + fmtLeft(S.res.exp - now) + " left.", "warn");
    } else {
      api.log(line, "");
    }
  }

  /* ---------- "what is this box" ---------- */

  var INFO = {
    you: function (S, now) {
      return "<strong>Listener (Ivy).</strong> Her browser and her laptop's operating system each keep a small cache of addresses they looked up. If a saved copy is still fresh, they skip DNS entirely. <em>Flush my own cache</em> clears only these. Right now: " + describe(S.you, now) + ".";
    },
    res: function (S, now) {
      return "<strong>ISP resolver (Bramblewire).</strong> Her internet provider runs it. It does the asking around for every customer and keeps each answer until its TTL runs out. Listeners can't flush it. Only Bramblewire can. Right now: " + describe(S.res, now) + ".";
    },
    root: function () {
      return "<strong>Root server.</strong> The first stop in a full lookup. It doesn't know any website's address. It only knows which servers look after each ending, like .com, and points the resolver there.";
    },
    tld: function () {
      return "<strong>.com TLD server.</strong> Knows, for every name ending in .com, which nameserver holds its records. It points the resolver to the station's nameserver.";
    },
    auth: function (S) {
      return "<strong>Station's nameserver (authoritative).</strong> Holds the station's official records. Its A record says <strong>" + (S.moved ? NEW_IP : OLD_IP) + "</strong>, and its TTL tells every resolver how long it may keep a copy: <strong>" + ttlLabel(S.ttl) + "</strong>. Changing the TTL here does nothing to copies already saved.";
    },
    old: function (S) {
      return "<strong>Old server, " + OLD_IP + ".</strong> " + (S.moved
        ? "Switched off after the move. Anyone whose lookup still returns this address waits, and nothing answers."
        : "Where the site lives tonight. After the move it gets switched off.");
    },
    "new": function (S) {
      return "<strong>New server, " + NEW_IP + ".</strong> " + (S.moved
        ? "Where the site lives now. Only visitors whose lookup returns the new address get here."
        : "Ready, but empty until you press Move.");
    }
  };

  /* ---------- the module ---------- */

  DL.sims.define("s1e01", {
    diagram: DIAGRAM,

    setup: function (api) {
      var S = api.state;
      S.session = {};
      S.busy = false;
      S.moved = false;
      S.ttl = DEFAULT_TTL;
      S.res = null;
      S.you = null;
      S.count = { cached: 0, full: 0, dead: 0, fresh: 0 };
      S.shown = {};
      S.states = {};
      api.speed = SPEED;

      S.ctl = {};
      S.ctl.lookup = api.control.button("lookup", "Visit " + NAME, function () { visit(api); });
      S.ctl.move = api.control.button("move", "Move the site to the new server", function () { move(api); });
      S.ctl.ttl = api.control.select("ttl", "TTL on the station's record", TTL_OPTIONS, String(DEFAULT_TTL), function (v) {
        var val = v && v.target ? v.target.value : v;
        if (val === undefined || val === null) val = S.ctl.ttl && S.ctl.ttl.value;
        setTTL(api, val);
      });
      S.ctl.flush = api.control.button("flush", "Flush my own cache", function () { flush(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        cached: api.stat("cached", "answered from cache", ""),
        full: api.stat("full", "full lookups", ""),
        dead: api.stat("dead", "visits to the dead server", "bad"),
        fresh: api.stat("new", "visits to the new server", "ok")
      };
      updateStats(api);

      // The starting picture. The diagram already shows it; setting it again keeps a re-render from drifting.
      show(api, "auth", "sub", "A: " + OLD_IP);
      show(api, "auth", "meta", "TTL " + ttlLabel(DEFAULT_TTL));
      show(api, "old", "meta", "site lives here");
      show(api, "new", "meta", "empty for now");
      setState(api, "old", "ok");
      setState(api, "new", "muted");
      api.edge("you", "old").set("");
      refresh(api);

      api.onNodeClick(function (id) {
        var f = INFO[id];
        if (f) api.info(f(api.state, api.clock));
      });
      api.info("<strong>Tip:</strong> click any box to see what it does in plain words.");
      api.log("Tuesday, before the move. The site lives on the old server at " + OLD_IP + ". The record's TTL is 1 day, and nobody has lowered it.", "");
    },

    step: function (api) {
      if (api.state.session) refresh(api);
    },

    selfTest: async function (t) {
      function n(id) { return num(t.stat(id)); }

      // 1. The very first visit has nothing cached anywhere.
      t.click("lookup");
      await t.run(6);
      t.expect(n("full") === 1 && n("cached") === 0, "the first lookup is a full lookup");
      t.expect(String(t.node("res").text.meta).indexOf(OLD_IP) === 0, "the resolver saves the answer and shows its countdown");
      t.expect(t.logText().indexOf("Root server") >= 0, "the log narrates the walk through the root server");

      // 2. Inside the 1-day TTL, nobody is asked again.
      t.click("lookup");
      await t.run(3);
      t.expect(n("cached") === 1 && n("full") === 1, "a second lookup within the TTL is a cache hit");

      // 3. The move, with the 1-day TTL nobody lowered.
      t.click("move");
      t.expect(t.node("old").state === "bad", "after the move the old server is switched off");
      t.click("lookup");
      await t.run(3);
      t.expect(n("dead") === 1 && n("new") === 0, "after the move with a 1-day TTL, a lookup still goes to the dead server");

      // 4. Flushing only the listener's own cache.
      t.click("flush");
      t.click("lookup");
      await t.run(3);
      t.expect(n("dead") === 2 && n("new") === 0 && n("full") === 1, "flush alone does not fix it while the resolver's copy is valid");

      // 5. The industry practice: a short TTL before the move.
      t.click("reset");
      t.set("ttl", "60");
      t.click("lookup");
      await t.run(6);
      t.click("move");
      await t.run(1);
      t.expect(t.node("res").text.meta === "cache: empty", "more than 60 sim-seconds later the resolver's copy has expired");
      t.click("lookup");
      await t.run(6);
      t.expect(n("new") === 1 && n("dead") === 0 && n("full") === 2, "after the move with a 60s TTL and 60 sim-seconds passing, a lookup reaches the new server");
    }
  });
})();
