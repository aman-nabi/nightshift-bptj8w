/* sims/s4e12-v1.0.0.js  (published as sims/s4e12.js)
   Case s4e12 "Fan-out on Write": a feed lab for Whisperwall, the gossip app of the city of
   Stellmarsh. At 23:00:00 Oriane Merrivane, who has 1,890,000 followers, posts; four friends with
   fewer than 250 followers each reply within two minutes. The learner replays the night from
   23:00:00 to 23:50:00 in four feed modes, changes the fan-out workers, her follower count, the
   hybrid threshold and the read rate, and watches six of her followers' timelines in a small
   follower graph.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: modes push (as built), push with big posts first (priority
     lane), pull for everyone, hybrid (push most accounts, pull accounts over a threshold and
     merge); thresholds 10,000, 100,000, 1,000,000; fan-out workers 1 to 40; her followers 50,000,
     400,000, 1,890,000, 4,000,000; timeline reads 6,000, 12,000, 24,000 a second; Skip to 23:50;
     Reset. Stats: her copies written, her fan-out alone at this rate, her last copy lands, replies
     seen before their post, longest a reply waited to show, work per timeline read, list reads a
     second on the posts store. selfTest: 12 assertions.

   The model (stated in sim.lede). Times are whole seconds after 23:00:00.
   - The lab counts only five posts: hers at 0, and the four replies. Nothing else is posted.
   - Fan-out: each worker writes 100 timelines a second; the timeline cache takes at most 2,800
     writes a second, so workers past 28 add nothing. Capacity C = min(workers x 100, 2,800).
   - Second t covers (t-1, t]. A copy written in second t is in its timeline at t.
   - A reply posted at T is fanned out from second T + 1. The workers take turns between posts;
     a reply's copies come first in each second (they're done in their first turn when C allows),
     and the rest of the second goes to her post. Priority lane: her post takes the whole second
     until it is done, and replies wait.
   - Her followers are written in follower-list order: follower number p gets her post in the
     first second by which her copies written reach p.
   - Pull for everyone: nothing is copied; a timeline is built when it's read, so her post is in
     every timeline from 23:00:00 and each reply from the second it's posted.
   - Hybrid: accounts with at least the threshold of followers are not copied; their posts are
     read at read time and merged. Accounts under it are pushed as above. The four friends are
     always under it.
   - Overlap: of each friend's followers, this many also follow her, spread evenly through her
     follower list (number ceil(j x F / m), j = 1 to m): Bex 150 of 180, Tavish 120 of 150,
     Sabeth 200 of 230, Noemi 100 of 120. "Replies seen before their post" counts each such
     follower whose reply arrived before her post did.
   - Reads (given data): a reader follows 180 accounts. Besides her, a typical reader follows 21
     other accounts over 10,000 followers, 3 over 100,000, none over 1,000,000. The posts store,
     which keeps each account's own posts once, answers at most 500,000 list reads a second.
     Work per read: push 1 cached timeline; pull 180 list reads; hybrid 1 cached timeline plus
     one list read per account over the threshold (the others, plus her if she is over it).

   Where every number comes from (conventions rule 14; the case is content/s4/s4e12-v1.0.0.json).
   - 1,890,000 / 700 = 2,700 s: her fan-out alone at 7 workers is 45 min 00 s. Replies' copies
     (180 + 150 + 230 + 120 = 680) take their turns in seconds 15, 32, 53 and 101, so her last
     copy lands at 2,701 s, 23:45:01 (the post's log). Replies show at 23:00:15, 23:00:32,
     23:00:53, 23:01:41.
   - Push, 7 workers: replies seen before their post 563 (Bex 150, Tavish 119, Sabeth 197,
     Noemi 97). Sample followers get her post: #12,600 23:00:19; #157,500 23:03:46; #699,300
     23:16:40; #1,228,500 23:29:16; #1,587,600 (Paquita) 23:37:49; #1,890,000 23:45:01.
   - Priority lane: her last copy 23:45:00; all four replies show at 23:45:01; 0 before their
     post; Bex's reply waits 44 min 47 s (posted 23:00:14).
   - 14 workers: 23:22:31, 553. 28 workers: alone 1,890,000 / 2,800 = 675 s, 11 min 15 s; last
     copy 23:11:16; 533. 40 workers: the same, because of the cache's 2,800 a second. 1 worker:
     alone 5 h 15 min 00 s.
   - Her followers at 50,000: last copy 23:01:13, 242 before. 400,000: 23:09:33, 526.
   - Pull: 12,000 reads x 180 = 2,160,000 list reads a second, 4.32 x the limit; at 6,000 reads,
     1,080,000, 2.16 x. Hybrid at 100,000: 1 cached timeline + 4 list reads, 48,000 a second
     (0.10 x). At 10,000: + 22 list reads, 264,000 (0.53 x); at 24,000 reads, 528,000 (1.06 x).
     At 1,000,000: + 1 list read, 12,000.

   Drawing: the arch diagram below. Her box at the top, the four friends in the middle, six of
   her followers at the bottom, with an arrow from each friend to the followers who follow them.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var BASE = 23 * 3600;
  var END = 3000;
  var SPEED = 60;
  var F0 = 1890000;
  var PER_WORKER = 100;
  var CACHE_LIMIT = 2800;
  var STORE_LIMIT = 500000;
  var FOLLOWS = 180;
  var OTHERS = { 10000: 21, 100000: 3, 1000000: 0 };
  var FRIENDS = [
    { id: "bex", name: "Bex", t: 14, f: 180, o: 150 },
    { id: "tav", name: "Tavish", t: 31, f: 150, o: 120 },
    { id: "sab", name: "Sabeth", t: 52, f: 230, o: 200 },
    { id: "noe", name: "Noemi", t: 100, f: 120, o: 100 }
  ];
  var SAMPLE = [
    { id: "f1", pos: 12600, fr: ["bex"] },
    { id: "f2", pos: 157500, fr: ["tav"] },
    { id: "f3", pos: 699300, fr: ["sab", "noe"] },
    { id: "f4", pos: 1228500, fr: ["tav", "sab", "noe"] },
    { id: "f5", pos: 1587600, fr: ["bex", "sab", "noe"] },
    { id: "f6", pos: 1890000, fr: ["bex", "tav", "sab", "noe"] }
  ];
  var MODES = [
    { value: "push", label: "Push: copy every post to every follower (as built)" },
    { value: "priority", label: "Push, big posts first (a priority lane)" },
    { value: "pull", label: "Pull for everyone: build each timeline when read" },
    { value: "hybrid", label: "Hybrid: push most, pull accounts over a threshold" }
  ];
  var MODE_SHORT = { push: "push (as built)", priority: "push, big posts first", pull: "pull for everyone", hybrid: "hybrid" };

  /* ---------- helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function clk(t) {
    var s = (BASE + t) % 86400;
    return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s % 3600 / 60)) + ":" + two(s % 60);
  }
  function dur(s) {
    if (s < 60) return s + " s";
    var h = Math.floor(s / 3600);
    var m = Math.floor(s % 3600 / 60);
    return (h ? h + " h " + two(m) : String(m)) + " min " + two(s % 60) + " s";
  }
  function friend(id) { for (var i = 0; i < FRIENDS.length; i++) if (FRIENDS[i].id === id) return FRIENDS[i]; return null; }

  /* ---------- the model (pure) ---------- */

  function cap(C) { return Math.min(C.workers * PER_WORKER, CACHE_LIMIT); }
  function herPushed(C) { return C.mode === "push" || C.mode === "priority" || (C.mode === "hybrid" && C.F < C.thr); }

  // One night. Returns her copies written by each second (W), when she is done, and when each
  // reply shows in its followers' timelines (vis).
  function night(C) {
    var pushed = herPushed(C);
    var c = cap(C);
    var W = [0];
    var vis = {};
    var left = {};
    var rem = pushed ? C.F : 0;
    var done = pushed ? null : 0;
    var t = 0;
    FRIENDS.forEach(function (r) { left[r.id] = r.f; if (C.mode === "pull") vis[r.id] = r.t; });
    function pending() { return FRIENDS.some(function (r) { return vis[r.id] === undefined; }); }
    while ((rem > 0 || pending()) && t < 100000) {
      t += 1;
      var room = c;
      if (C.mode === "priority" && rem > 0) { var u0 = Math.min(room, rem); rem -= u0; room -= u0; }
      FRIENDS.forEach(function (r) {
        if (vis[r.id] !== undefined || r.t >= t) return;
        var u = Math.min(room, left[r.id]);
        left[r.id] -= u;
        room -= u;
        if (left[r.id] === 0) vis[r.id] = t;
      });
      if (rem > 0) { var u1 = Math.min(room, rem); rem -= u1; room -= u1; }
      if (pushed) W.push(C.F - rem);
      if (pushed && rem === 0 && done === null) done = t;
    }
    return { pushed: pushed, W: W, done: done, vis: vis, alone: pushed ? Math.ceil(C.F / c) : null };
  }

  function postAt(N, p) {
    if (!N.pushed) return 0;
    var W = N.W;
    var lo = 1;
    var hi = W.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (W[mid] >= p) hi = mid; else lo = mid + 1;
    }
    return lo;
  }

  // For each friend, how many of the followers they share with her got the reply first.
  function beforeCounts(C, N) {
    var out = {};
    FRIENDS.forEach(function (r) {
      var n = 0;
      for (var j = 1; j <= r.o; j++) {
        if (N.vis[r.id] < postAt(N, Math.ceil(j * C.F / r.o))) n += 1;
      }
      out[r.id] = n;
    });
    return out;
  }

  function samplePos(C, s) { return Math.ceil(s.pos * C.F / F0); }

  function readWork(C) {
    if (C.mode === "pull") return { text: FOLLOWS + " list reads", lists: FOLLOWS };
    if (C.mode !== "hybrid") return { text: "1 cached timeline", lists: 0 };
    var k = OTHERS[C.thr] + (C.F >= C.thr ? 1 : 0);
    return { text: "1 cached timeline + " + k + " list read" + (k === 1 ? "" : "s"), lists: k };
  }

  function loadText(C) {
    var n = C.reads * readWork(C).lists;
    return n === 0 ? "0" : fmt(n) + " (" + (n / STORE_LIMIT).toFixed(2) + " x the limit)";
  }

  // Everything that happens in the night, in time order, for the log.
  function events(C, N) {
    var ev = [];
    FRIENDS.forEach(function (r) {
      ev.push({ t: r.t, k: 0, s: r.name + " replies. " + (C.mode === "pull" ? "Nothing is copied; the reply is in every follower's timeline at their next read." : "The reply goes on the fan-out queue for " + r.f + " followers."), tone: "" });
      if (C.mode !== "pull") {
        ev.push({ t: N.vis[r.id], k: 1, s: r.name + "'s reply is in all " + r.f + " follower timelines. Of the " + r.o + " who also follow Oriane, " + N.before[r.id] + " don't have her post yet.", tone: N.before[r.id] ? "bad" : "ok" });
      }
    });
    if (N.pushed) {
      SAMPLE.forEach(function (s) {
        var p = samplePos(C, s);
        ev.push({ t: postAt(N, p), k: 2, s: "Follower #" + fmt(p) + " gets her post.", tone: "" });
      });
      ev.push({ t: N.done, k: 3, s: "Her last copy lands: " + fmt(C.F) + " timelines written. At " + fmt(cap(C)) + " copies a second her post alone takes " + dur(N.alone) + "; the replies' copies took their turns along the way.", tone: "warn" });
    }
    ev.sort(function (a, b) { return (a.t - b.t) || (a.k - b.k); });
    return ev;
  }

  /* ---------- the picture ---------- */

  var NODES = [{ id: "or", label: "Oriane Merrivane", sub: "1,890,000 followers", meta: "posts at 23:00:00", x: 370, y: 48, w: 220, h: 72, shape: "box", tone: "accent" }];
  var FX = [95, 280, 460, 645];
  FRIENDS.forEach(function (r, i) {
    NODES.push({ id: r.id, label: r.name, sub: fmt(r.f) + " followers", meta: "reply " + clk(r.t), x: FX[i], y: 170, w: 130, h: 72, shape: "box", tone: "" });
  });
  var SX = [62, 186, 310, 434, 558, 682];
  SAMPLE.forEach(function (s, i) {
    NODES.push({ id: s.id, label: "#" + fmt(s.pos), sub: "post: not yet", meta: "replies 0 of " + s.fr.length, x: SX[i], y: 318, w: 114, h: 72, shape: "box", tone: "" });
  });
  var EDGES = [];
  SAMPLE.forEach(function (s) { s.fr.forEach(function (f) { EDGES.push({ from: f, to: s.id, tone: "muted" }); }); });
  FRIENDS.forEach(function (r) { EDGES.push({ from: r.id, to: "or", dash: true, tone: "muted" }); });

  var DIAGRAM = {
    type: "arch", w: 740, h: 400,
    aria: "A small follower graph. Oriane Merrivane at the top, her four friends Bex, Tavish, Sabeth and Noemi below her, each replying to her post, and six of her followers at the bottom, numbered by their place in her follower list. Arrows run from each friend to the followers who follow that friend. All six follow Oriane. A follower box turns red while it has a reply but not her post.",
    nodes: NODES,
    edges: EDGES,
    notes: [{ x: 370, y: 384, text: "All six follow Oriane. Numbers are places in her follower list.", tone: "muted", anchor: "middle" }]
  };

  /* ---------- running the night ---------- */

  function newNight(api) {
    var S = api.state;
    var N = night(S.C);
    N.before = beforeCounts(S.C, N);
    S.N = N;
    S.ev = events(S.C, N);
    S.evAt = 0;
    S.t = 0;
    S.done = false;
    api.clock = BASE;
  }

  function reveal(api, now) {
    var S = api.state;
    while (S.evAt < S.ev.length && S.ev[S.evAt].t <= now) {
      var e = S.ev[S.evAt];
      api.log(clk(e.t) + ". " + e.s, e.tone);
      S.evAt += 1;
    }
  }

  function settingsLine(C) {
    var s = MODE_SHORT[C.mode] + "; " + C.workers + " fan-out worker" + (C.workers === 1 ? "" : "s") + ", " + fmt(cap(C)) + " copies a second";
    if (C.mode === "hybrid") s += "; threshold " + fmt(C.thr) + " followers";
    return s + "; her followers " + fmt(C.F) + "; " + fmt(C.reads) + " timeline reads a second.";
  }

  function finish(api) {
    var S = api.state;
    if (S.done) return;
    reveal(api, END);
    S.done = true;
    S.t = END;
    api.clock = BASE + END;
    api.speed = 0;
    var N = S.N;
    var last = !N.pushed ? "no copies, her post is read at read time" : (N.done <= END ? clk(N.done) : "not yet by 23:50:00");
    api.log("23:50:00. End of the run (" + MODE_SHORT[S.C.mode] + "). Her last copy: " + last + ". Replies seen before their post: " + beforeNow(S, END) +
      ". Longest a reply waited: " + waitNow(S, END) + ".", beforeNow(S, END) ? "bad" : "ok");
  }

  function beforeNow(S, now) {
    var n = 0;
    FRIENDS.forEach(function (r) { if (S.N.vis[r.id] <= now) n += S.N.before[r.id]; });
    return n;
  }
  function waitNow(S, now) {
    var w = -1;
    FRIENDS.forEach(function (r) { if (S.N.vis[r.id] <= now) w = Math.max(w, S.N.vis[r.id] - r.t); });
    return w < 0 ? "not yet" : dur(w);
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var N = S.N;
    var now = Math.floor(S.t + 1e-9);
    var o = api.node("or");
    o.text("sub", fmt(C.F) + " followers");
    o.text("meta", N.pushed ? "copied: " + fmt(N.W[Math.min(now, N.W.length - 1)]) : "stored once, read at read time");
    FRIENDS.forEach(function (r) {
      var n = api.node(r.id);
      var shown = N.vis[r.id] <= now;
      n.text("meta", shown ? "shown " + clk(N.vis[r.id]) : "reply " + clk(r.t));
      n.set(shown ? "ok" : (r.t <= now ? "warn" : ""));
    });
    SAMPLE.forEach(function (s) {
      var n = api.node(s.id);
      var p = samplePos(C, s);
      var at = postAt(N, p);
      var has = at <= now;
      var got = 0;
      s.fr.forEach(function (f) { if (N.vis[f] <= now) got += 1; });
      n.text("label", "#" + fmt(p));
      n.text("sub", has ? "post " + clk(at) : "post: not yet");
      n.text("meta", "replies " + got + " of " + s.fr.length);
      n.set(has ? "ok" : (got ? "bad" : ""));
    });
    S.stat.copies(N.pushed ? fmt(N.W[Math.min(now, N.W.length - 1)]) + " of " + fmt(C.F) : "none: stored once");
    S.stat.alone(N.pushed ? dur(N.alone) : "none");
    S.stat.last(!N.pushed ? "no copies" : (N.done <= now ? clk(N.done) : "not yet"));
    S.stat.before(beforeNow(S, now));
    S.stat.wait(waitNow(S, now));
    S.stat.work(readWork(C).text);
    S.stat.load(loadText(C));
  }

  function replay(api, why) {
    var S = api.state;
    newNight(api);
    api.speed = SPEED;
    api.log(why + " The night starts again at 23:00:00. Now: " + settingsLine(S.C), "");
    draw(api);
  }

  var INFO = {
    or: "<strong>Oriane Merrivane.</strong> Hosts the breakfast show; most of Stellmarsh follows her. In push mode her post is copied into each follower's timeline in follower-list order, at the workers' rate. In pull and hybrid (when she is over the threshold) it is stored once and read when a timeline is opened.",
    bex: "<strong>Bex.</strong> 180 followers, 150 of whom also follow Oriane. Replies at 23:00:14.",
    tav: "<strong>Tavish.</strong> 150 followers, 120 of whom also follow Oriane. Replies at 23:00:31.",
    sab: "<strong>Sabeth.</strong> 230 followers, 200 of whom also follow Oriane. Replies at 23:00:52.",
    noe: "<strong>Noemi.</strong> 120 followers, 100 of whom also follow Oriane. Replies at 23:01:40."
  };
  var FOLLOWER_INFO = "<strong>One of Oriane's followers.</strong> The number is its place in her follower list, the order her copies are written in. Red: a reply is in this timeline and her post is not.";

  /* ---------- the module ---------- */

  DL.sims.define("s4e12", {
    diagram: DIAGRAM,
    startClock: BASE,

    setup: function (api) {
      var S = api.state;
      S.C = { mode: "push", workers: 7, F: F0, thr: 100000, reads: 12000 };
      api.speed = SPEED;
      S.ctl = {};
      S.ctl.mode = api.control.select("mode", "Feed mode", MODES, "push", function (v) {
        S.C.mode = String(v);
        replay(api, "Feed mode: " + MODE_SHORT[S.C.mode] + ".");
      });
      S.ctl.workers = api.control.range("workers", "Fan-out workers (100 copies a second each)", 1, 40, 1, 7, function (v) {
        var x = Math.max(1, Math.min(40, Math.round(num(v))));
        if (!isFinite(x) || x === S.C.workers) return;
        S.C.workers = x;
        replay(api, "Fan-out workers: " + x + (x * PER_WORKER > CACHE_LIMIT ? ". The timeline cache takes at most 2,800 writes a second, so only 2,800 copies a second get written." : "."));
      });
      S.ctl.F = api.control.select("followers", "Oriane's followers", [50000, 400000, 1890000, 4000000].map(function (n) { return { value: n, label: fmt(n) }; }), F0, function (v) {
        S.C.F = Number(v);
        replay(api, "Oriane's followers: " + fmt(S.C.F) + ".");
      });
      S.ctl.thr = api.control.select("threshold", "Hybrid: pull accounts with at least", [10000, 100000, 1000000].map(function (n) { return { value: n, label: fmt(n) + " followers" }; }), 100000, function (v) {
        S.C.thr = Number(v);
        replay(api, "Hybrid threshold: " + fmt(S.C.thr) + " followers." + (S.C.mode === "hybrid" ? "" : " It applies in hybrid mode only."));
      });
      S.ctl.reads = api.control.select("reads", "Timeline reads a second", [6000, 12000, 24000].map(function (n) { return { value: n, label: fmt(n) }; }), 12000, function (v) {
        S.C.reads = Number(v);
        replay(api, "Timeline reads: " + fmt(S.C.reads) + " a second.");
      });
      S.ctl.skip = api.control.button("skip", "Skip to 23:50", function () { finish(api); draw(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        copies: api.stat("copies", "her copies written", ""),
        alone: api.stat("alone", "her fan-out alone at this rate", "warn"),
        last: api.stat("last", "her last copy lands", "warn"),
        before: api.stat("before", "replies seen before their post", "bad"),
        wait: api.stat("wait", "longest a reply waited to show", ""),
        work: api.stat("work", "work per timeline read", ""),
        load: api.stat("load", "list reads a second on the posts store (limit 500,000)", "bad")
      };

      api.onNodeClick(function (id) { api.info(INFO[id] || FOLLOWER_INFO); });
      api.info("<strong>Tip:</strong> click any box to see what it is. Red follower boxes have a reply and not the post it answers.");

      newNight(api);
      api.log("23:00:00. Oriane is about to post. Settings: " + settingsLine(S.C), "");
      draw(api);
    },

    step: function (api, dt) {
      var S = api.state;
      if (!S.C || S.done) return;
      S.t += dt * api.speed;
      if (S.t >= END) { finish(api); draw(api); return; }
      reveal(api, Math.floor(S.t + 1e-9));
      api.clock = BASE + S.t;
      draw(api);
    },

    selfTest: async function (t) {
      function log() { return t.logText(); }
      function has(s) { return log().indexOf(s) >= 0; }

      // 1. The opening state: 23:00:00, before her post has gone anywhere.
      t.expect(t.stat("copies") === "0 of 1,890,000" && t.stat("alone") === "45 min 00 s" && t.stat("last") === "not yet" &&
        t.stat("before") === 0 && t.stat("wait") === "not yet" && t.stat("work") === "1 cached timeline" && t.stat("load") === 0 &&
        t.node("f5").text.sub === "post: not yet" && has("23:00:00. Oriane is about to post."),
        "Opens at 23:00:00 with nothing copied; 1,890,000 copies at 700 a second is 45 min 00 s");

      // 2. A few minutes in: replies everywhere, her post not yet past the first part of her list.
      await t.run(5);
      t.expect(t.node("f3").state === "bad" && t.node("f3").text.sub === "post: not yet" && t.node("f3").text.meta === "replies 2 of 2" &&
        t.node("f1").state === "ok" && t.stat("before") === 563 && t.stat("wait") === "1 s" &&
        has("Sabeth's reply is in all 230 follower timelines. Of the 200 who also follow Oriane, 197 don't have her post yet."),
        "By about 23:05, follower #699,300 has Sabeth's and Noemi's replies and not her post; 563 replies came first");

      // 3. Push as built, to the end: 23:45:01, every sample follower's time.
      t.click("skip");
      t.expect(t.stat("last") === "23:45:01" && t.stat("copies") === "1,890,000 of 1,890,000" && t.stat("before") === 563 &&
        t.node("f1").text.sub === "post 23:00:19" && t.node("f5").text.sub === "post 23:37:49" && t.node("f5").text.meta === "replies 3 of 3" &&
        t.node("f6").text.sub === "post 23:45:01" &&
        has("Her last copy lands: 1,890,000 timelines written. At 700 copies a second her post alone takes 45 min 00 s"),
        "Push: Bex's reply 4 s before her post at #12,600, Paquita's at 23:37:49, the last copy 23:45:01, 563 replies first");

      // 4. More workers: 28 fills the cache's 2,800 a second, 40 adds nothing.
      t.set("workers", 28);
      t.click("skip");
      var w28 = t.stat("last") === "23:11:16" && t.stat("before") === 533 && t.stat("alone") === "11 min 15 s";
      t.set("workers", 40);
      var capped = has("so only 2,800 copies a second get written");
      t.click("skip");
      t.expect(w28 && capped && t.stat("last") === "23:11:16" && t.stat("before") === 533,
        "28 workers: 11 min 15 s, last copy 23:11:16, still 533 replies first; 40 workers: no faster");

      // 5. 14 workers and 1 worker.
      t.set("workers", 14);
      t.click("skip");
      var w14 = t.stat("last") === "23:22:31" && t.stat("before") === 553;
      t.set("workers", 1);
      t.expect(w14 && t.stat("alone") === "5 h 15 min 00 s", "14 workers: 23:22:31 and 553; 1 worker: 5 h 15 min 00 s");
      t.set("workers", 7);

      // 6. The priority lane: exactly 45 minutes, and every reply held until 23:45:01.
      t.set("mode", "priority");
      t.click("skip");
      t.expect(t.stat("last") === "23:45:00" && t.stat("before") === 0 && t.stat("wait") === "44 min 47 s" &&
        t.node("bex").text.meta === "shown 23:45:01" && t.stat("load") === 0,
        "Priority lane: her last copy at 23:45:00, no reply first, but Bex's reply waits 44 min 47 s");

      // 7. Pull for everyone: one write, no gap, and 180 list reads per timeline read.
      t.set("mode", "pull");
      t.click("skip");
      var pull12 = t.stat("copies") === "none: stored once" && t.stat("before") === 0 && t.stat("wait") === "0 s" &&
        t.stat("work") === "180 list reads" && t.stat("load") === "2,160,000 (4.32 x the limit)" && t.node("f5").text.sub === "post 23:00:00";
      t.set("reads", 6000);
      t.expect(pull12 && t.stat("load") === "1,080,000 (2.16 x the limit)",
        "Pull: her post everywhere at 23:00:00, but 2,160,000 list reads a second, 4.32 x; 2.16 x even at 6,000 reads");
      t.set("reads", 12000);

      // 8. Hybrid at 100,000: her post read at read time, replies pushed, 4 list reads a timeline.
      t.set("mode", "hybrid");
      t.click("skip");
      t.expect(t.stat("copies") === "none: stored once" && t.stat("last") === "no copies" && t.stat("before") === 0 && t.stat("wait") === "1 s" &&
        t.stat("work") === "1 cached timeline + 4 list reads" && t.stat("load") === "48,000 (0.10 x the limit)" &&
        t.node("f6").text.sub === "post 23:00:00" && t.node("noe").text.meta === "shown 23:01:41",
        "Hybrid at 100,000: no copies of her post, 0 replies first, 1 cached timeline + 4 list reads, 48,000 a second");

      // 9. Hybrid with a threshold too low.
      t.set("threshold", 10000);
      var low12 = t.stat("work") === "1 cached timeline + 22 list reads" && t.stat("load") === "264,000 (0.53 x the limit)";
      t.set("reads", 24000);
      t.expect(low12 && t.stat("load") === "528,000 (1.06 x the limit)",
        "Hybrid at 10,000: 22 list reads a timeline, 264,000 a second, and 528,000 (over the limit) at 24,000 reads");
      t.set("reads", 12000);

      // 10. Hybrid at 1,000,000: only she is pulled.
      t.set("threshold", 1000000);
      t.expect(t.stat("work") === "1 cached timeline + 1 list read" && t.stat("load") === "12,000 (0.02 x the limit)",
        "Hybrid at 1,000,000: one list read (hers) per timeline, 12,000 a second");

      // 11. A smaller account under the threshold is pushed again.
      t.set("threshold", 100000);
      t.set("followers", 50000);
      t.click("skip");
      t.expect(t.stat("last") === "23:01:13" && t.stat("before") === 242 && t.stat("work") === "1 cached timeline + 3 list reads",
        "Hybrid with her at 50,000 followers, under 100,000: pushed, last copy 23:01:13, 242 replies first");

      // 12. Push at 400,000 followers.
      t.set("mode", "push");
      t.set("followers", 400000);
      t.click("skip");
      t.expect(t.stat("last") === "23:09:33" && t.stat("before") === 526 && t.stat("alone") === "9 min 32 s",
        "Push with 400,000 followers: 9 min 32 s alone, last copy 23:09:33, 526 replies first");
    }
  });
})();
