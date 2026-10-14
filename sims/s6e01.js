/* sims/s6e01-v1.0.0.js  (published as sims/s6e01.js)
   Case s6e01 "Wait Longer": a reconnect lab for Merriott Halls, whose 600 room doors each have a
   smart lock that keeps an open line (a connection) to one access server. When the server restarts,
   every line drops and every lock knocks (asks for a new line) by its retry rule. The learner sets
   randomness, the cap, the timeout per knock, the server's speed and the restart time, then plays
   the 15 minutes from the restart. Widget-style sim: it draws its own charts inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: 600 locks, one server, one second per step, 02:59:55 to
     03:15:00 (or 13:59:55 to 14:15:00). Controls: random wait (none, full), cap (1, 30, 60, 120 s),
     timeout per knock (1, 2, 5 s), server speed (50 or 100 new lines a second), restart time (03:00,
     14:00); Next knocks, Play / pause, To the end, Reset. Stats: locks connected, knocks this second,
     beeps this second, waiting in the server's line, busiest second since the server came back,
     average knocks a second from then to the last lock, wasted knocks, last lock back.
     selfTest: 11 assertions.

   The model (stated in sim.lede). Times in ms after the restart (03:00:00.000).
   - All 600 lines drop at 0. The server is down until 40,000 (03:00:40) and refuses every knock
     at once while down: the knock fails at the moment it is made.
   - From 40,000 the server lets in one new line every 1000 / speed ms (20 ms at 50 a second), first
     come, first served, in one line. At the same millisecond, lower lock numbers come first.
     A knock that reaches the front of the line before its timeout runs out gets in. Otherwise the
     lock gives up at knock + timeout (and beeps then), but the server does not know: it still works
     through that knock when it reaches it (a wasted knock), so it is busy for the 20 ms anyway.
   - Waits: the k-th wait (k = 0, 1, 2, ...) is the backoff min(cap, 2^k) seconds: 1, 2, 4, 8, 16,
     32, then 60 with the cap at 60. The first wait starts at the drop; each later one starts at the
     previous knock. A lock never knocks while a knock is still open, so the next knock is at
     max(knock + wait, moment it failed). With full randomness each wait is floor(r x backoff ms),
     r in [0, 1) from draw(seed, lock, k), a fixed hash, so a rewind replays the same night.
   - seed: the one and only api.rand() call, in setup: floor(api.rand() x 2^32), with the engine's
     default seed 7 that is 50271532. Resets re-seed identically.
   - A double beep marks every failed knock: at the knock while the server is down, at knock +
     timeout once it is up.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e01-v1.0.0.json).
   - As built (no randomness, cap 60, timeout 1 s, 50 a second, 03:00): knocks at 03:00:01, :03,
     :07, :15, :31 (1, 1+2, +4, +8, +16 s), all 600 refused, 600 beeps each. 03:01:03 (31 + 32):
     600 knocks in one second, the line is 600 long, 50 get in (served at 0, 20, ... 980 ms), 550
     give up at 03:01:04 and beep. Then every 60 s: 550, 500, ... 50 knocks; the 12th wave at
     03:12:03 (600 / 50 = 12) lets in the last 50: last lock back 03:12:03. The 600th in line would
     wait 600 / 50 = 12 s. Wasted knocks: 550 + 500 + ... + 50 = 3,300.
   - Timeout 5 s: 250 in a wave (5 s x 50), waves of 600, 350, 100; beeps at 03:01:08 and 03:02:08;
     last lock back 03:03:04. Timeout 2 s: last lock 03:06:04.
   - 100 a second: 100 a wave, 6 waves, last lock 03:06:03.
   - Restart at 14:00: the same waves, last lock 14:12:03.
   - Cap 1 (a knock every second): 600 refused each second to 03:00:39; at 03:00:40 50 get in; from
     then on every knock waits behind knocks whose lock has already gone, more than 1 s, so none
     gets in: 50 of 600 at 03:15:00, the line growing by about 500 a second.
   - Full randomness (seed 50271532): 782 knocks in the 03:00:00 second, all refused; after
     03:00:40 never more than 28 in a second (03:00:44), 10.2 a second on average to the last lock,
     none waits in line, no wasted knocks; last lock back 03:01:38.
*/
(function () {
  "use strict";

  var N = 600;
  var DOWN = 40000;
  var LAST = 900;            // seconds after the restart shown (03:15:00)
  var PRE = -5;              // the sim opens 5 s before the restart

  var JITTER = [{ value: "none", label: "None (as built)" }, { value: "full", label: "Full: random, up to the backoff" }];
  var CAPS = [{ value: "1", label: "1 s (knock every second)" }, { value: "30", label: "30 s" }, { value: "60", label: "60 s (as built)" }, { value: "120", label: "120 s" }];
  var TMOS = [{ value: "1", label: "1 s (as built)" }, { value: "2", label: "2 s" }, { value: "5", label: "5 s" }];
  var RATES = [{ value: "50", label: "50 new lines a second (as built)" }, { value: "100", label: "100 new lines a second" }];
  var STARTS = [{ value: "10800", label: "03:00 (tonight)" }, { value: "50400", label: "14:00 (daytime)" }];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hmsAbs(sec) {
    var s = ((sec % 86400) + 86400) % 86400;
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60)) + ":" + pad(s % 60);
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function draw(seed, i, k) {
    var h = (seed ^ Math.imul(i + 1, 0x9E3779B1) ^ Math.imul(k + 1, 0x85EBCA77)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  }

  /* ---------- the model: settings in, the whole night out ---------- */

  function simulate(C) {
    var gap = Math.round(1000 / C.rate);
    var tmo = C.timeout * 1000;
    var END = (LAST + 1) * 1000;
    var S = LAST + 1;
    var knocks = [], got = [], gave = [], beeps = [], line = [], wasted = [], conn = [];
    for (var z = 0; z < S; z++) { knocks.push(0); got.push(0); gave.push(0); beeps.push(0); line.push(0); wasted.push(0); conn.push(0); }
    var heap = [];
    function less(a, b) { return a.t < b.t || (a.t === b.t && a.i < b.i); }
    function push(x) {
      heap.push(x);
      var k = heap.length - 1;
      while (k > 0) { var p = (k - 1) >> 1; if (!less(heap[k], heap[p])) break; var q = heap[k]; heap[k] = heap[p]; heap[p] = q; k = p; }
    }
    function pop() {
      var top = heap[0];
      var lastE = heap.pop();
      if (heap.length) {
        heap[0] = lastE;
        var k = 0;
        for (;;) {
          var l = 2 * k + 1, r = l + 1, m = k;
          if (l < heap.length && less(heap[l], heap[m])) m = l;
          if (r < heap.length && less(heap[r], heap[m])) m = r;
          if (m === k) break;
          var q = heap[k]; heap[k] = heap[m]; heap[m] = q; k = m;
        }
      }
      return top;
    }
    function wait(i, k) {
      var b = Math.min(C.cap, Math.pow(2, Math.min(k, 30))) * 1000;
      return C.jitter === "full" ? Math.floor(draw(C.seed, i, k) * b) : b;
    }
    for (var i = 0; i < N; i++) push({ t: wait(i, 0), i: i, k: 0 });
    var free = DOWN;
    var sec = 0;
    function closeTo(s) {
      while (sec < s && sec < S) {
        line[sec] = Math.max(0, Math.ceil((free - Math.max((sec + 1) * 1000, DOWN)) / gap));
        sec += 1;
      }
    }
    var connAt = [];
    while (heap.length) {
      var e = pop();
      if (e.t >= END) break;
      var ks = Math.floor(e.t / 1000);
      closeTo(ks);
      knocks[ks] += 1;
      var fail;
      if (e.t < DOWN) {
        fail = e.t;
      } else {
        var acc = Math.max(e.t, free);
        free = acc + gap;
        if (acc - e.t < tmo) {
          got[ks] += 1;
          connAt.push(acc);
          conn[Math.floor(acc / 1000)] += 1;
          continue;
        }
        if (acc < END) wasted[Math.floor(acc / 1000)] += 1;
        fail = e.t + tmo;
      }
      if (e.t >= DOWN) gave[ks] += 1;
      if (fail < END) beeps[Math.floor(fail / 1000)] += 1;
      push({ t: Math.max(e.t + wait(e.i, e.k + 1), fail), i: e.i, k: e.k + 1 });
    }
    closeTo(S);
    connAt.sort(function (a, b) { return a - b; });
    return { knocks: knocks, got: got, gave: gave, beeps: beeps, line: line, wasted: wasted, conn: conn, connAt: connAt, tmo: C.timeout };
  }

  // Everything the stats show at the end of second s (s < 0: before the restart).
  function summary(M, s) {
    if (s < 0) return { conn: N, knocks: 0, beeps: 0, line: 0, busiest: "none yet", avg: "not yet", wasted: 0, last: "not yet", lastS: -1 };
    var c = 0, w = 0, best = 0, bestS = -1;
    for (var k = 0; k <= s; k++) {
      c += M.conn[k];
      w += M.wasted[k];
      if (k >= DOWN / 1000 && M.knocks[k] > best) { best = M.knocks[k]; bestS = k; }
    }
    var lastS = c === N && M.connAt.length === N ? Math.floor(M.connAt[N - 1] / 1000) : -1;
    var avg = "not yet";
    if (lastS >= 0) {
      var sum = 0;
      for (var a = DOWN / 1000; a <= lastS; a++) sum += M.knocks[a];
      avg = (Math.round(sum * 10 / (lastS - DOWN / 1000 + 1)) / 10).toFixed(1);
    }
    return {
      conn: c, knocks: M.knocks[s], beeps: M.beeps[s], line: M.line[s],
      busiest: bestS < 0 ? "none yet" : best + " at " + hmsAbs(M.T0 + bestS),
      avg: avg, wasted: w, last: lastS < 0 ? "not yet" : hmsAbs(M.T0 + lastS), lastS: lastS
    };
  }

  // The log lines for second s, each logged when the playhead passes it.
  function events(M, s) {
    var out = [];
    var at = function (x) { return hmsAbs(M.T0 + x); };
    if (s === 0) out.push(["The server restarts. All 600 lines drop in the same instant.", "bad"]);
    if (s === DOWN / 1000) out.push(["The server is back. It lets in about " + M.rate + " new lines a second; the rest wait in its line.", "ok"]);
    var k = M.knocks[s];
    if (k >= 100 && (s === 0 || M.knocks[s - 1] < 100)) {
      if (s * 1000 < DOWN) out.push([fmt(k) + " knocks in one second, all refused at once: " + fmt(k) + " double beeps.", "bad"]);
      else out.push([fmt(k) + " knocks in one second: " + M.got[s] + " got in, " + fmt(M.gave[s]) + " gave up after the " + M.tmo + " s timeout and beeped at " + at(s + M.tmo) + ".", M.gave[s] ? "bad" : "warn"]);
    }
    if ((s - 4) * 1000 >= DOWN && k >= 100 && M.knocks[s - 1] >= 100 && M.knocks[s - 2] >= 100 && M.knocks[s - 3] >= 100 && M.knocks[s - 4] >= 100 &&
        !(M.knocks[s - 5] >= 100 && (s - 5) * 1000 >= DOWN)) {
      out.push(["Every lock still out is knocking every second, and the server's line keeps growing.", "bad"]);
    }
    var before = summary(M, s - 1).conn;
    var now = summary(M, s);
    if (s >= 0 && before < N / 2 && now.conn >= N / 2 && now.conn < N) out.push(["Half the locks are back: " + now.conn + " of 600.", "warn"]);
    if (s >= 0 && before < N && now.conn === N) out.push(["The last lock is back at " + now.last + ". 600 of 600.", "ok"]);
    if (s === LAST) {
      if (now.conn === N) out.push(["End: 600 of 600 back, the last at " + now.last + "; the server worked on " + fmt(now.wasted) + " knocks whose lock had already given up.", "ok"]);
      else out.push(["End: only " + now.conn + " of 600 back; " + fmt(now.line) + " knocks waiting in the server's line, from locks that have already given up.", "bad"]);
    }
    return out;
  }

  /* ---------- drawing ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, g, x, y, s, cls, anchor) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" }, g);
    t.textContent = s;
    return t;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  function build(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    var wrap = doc.createElement("div");
    wrap.setAttribute("style", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = doc.createElement("p");
    head.setAttribute("style", "margin:0;font-size:12px;");
    wrap.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 260", width: "100%", "class": "dg", role: "img",
      "aria-label": "Two charts over the 15 minutes from the restart. Top: knocks reaching the server each second, one bar per second; red bars are knocks that failed. Bottom: how many of the 600 locks have their line back. A dashed line marks the server coming back, and a solid line marks where the playhead is."
    });
    var layer = mk(doc, "g", {}, svg);
    wrap.appendChild(svg);
    api.root.appendChild(wrap);
    return { doc: doc, head: head, layer: layer };
  }

  function drawAll(S) {
    var doc = S.ui.doc;
    var g = S.ui.layer;
    var M = S.M;
    clear(g);
    var x0 = 50, pw = 600 / (LAST + 1);
    function X(s) { return x0 + s * pw; }
    txt(doc, g, x0, 14, "Knocks each second (red: failed), 0 to 600", "dg-axis");
    txt(doc, g, x0, 144, "Locks with their line back, 0 to 600", "dg-axis");
    mk(doc, "line", { x1: x0, y1: 110, x2: x0 + 600, y2: 110, "class": "dg-axis", stroke: "currentColor" }, g);
    mk(doc, "line", { x1: x0, y1: 230, x2: x0 + 600, y2: 230, "class": "dg-axis", stroke: "currentColor" }, g);
    var ok = "", bad = "";
    var upTo = Math.min(S.now, LAST);
    for (var s = 0; s <= upTo; s++) {
      var k = Math.min(M.knocks[s], 600);
      if (!k) continue;
      var f = Math.min(k, M.knocks[s] - M.got[s]);
      var hk = k / 600 * 90, hf = f / 600 * 90;
      if (hf > 0) bad += "M" + X(s).toFixed(1) + " 110V" + (110 - hf).toFixed(1);
      if (hk > hf) ok += "M" + X(s).toFixed(1) + " " + (110 - hf).toFixed(1) + "V" + (110 - hk).toFixed(1);
    }
    var gb = mk(doc, "g", { "class": "dg-node st-bad" }, g);
    if (bad) mk(doc, "path", { d: bad, stroke: "currentColor", "stroke-width": 1.2 }, gb);
    var go = mk(doc, "g", { "class": "dg-node st-ok" }, g);
    if (ok) mk(doc, "path", { d: ok, stroke: "currentColor", "stroke-width": 1.2 }, go);
    var c = 0, d = "M" + x0 + " " + (230 - 100).toFixed(1);
    if (S.now >= 0) {
      d += "H" + X(0).toFixed(1) + "V230";
      for (var s2 = 0; s2 <= upTo; s2++) {
        c += M.conn[s2];
        d += "H" + X(s2 + 1).toFixed(1) + "V" + (230 - c / 600 * 100).toFixed(1);
      }
    }
    var gl = mk(doc, "g", { "class": "dg-node st-ok" }, g);
    mk(doc, "path", { d: d, fill: "none", stroke: "currentColor", "stroke-width": 1.5 }, gl);
    mk(doc, "line", { x1: X(40), y1: 20, x2: X(40), y2: 232, stroke: "currentColor", "stroke-dasharray": "3 3", "class": "dg-axis" }, g);
    txt(doc, g, X(40) + 4, 30, "server back", "dg-note");
    if (S.now >= 0) mk(doc, "line", { x1: X(upTo + 1), y1: 20, x2: X(upTo + 1), y2: 232, stroke: "currentColor" }, g);
    for (var m = 0; m <= 15; m += 3) txt(doc, g, X(m * 60), 250, hmsAbs(M.T0 + m * 60).slice(0, 5), "dg-axis", "middle");
  }

  function show(api) {
    var S = api.state;
    var sm = summary(S.M, S.now);
    api.clock = S.M.T0 + Math.min(S.now, LAST);
    S.ui.head.textContent = "Random wait: " + S.C.jitter + ". Cap " + S.C.cap + " s. Timeout per knock " + S.C.timeout + " s. Server lets in " +
      S.C.rate + " new lines a second. Restart at " + hmsAbs(S.M.T0) + ".";
    S.stat.conn(sm.conn + " of 600");
    S.stat.knocks(sm.knocks);
    S.stat.beeps(sm.beeps);
    S.stat.line(sm.line);
    S.stat.busiest(sm.busiest);
    S.stat.avg(sm.avg);
    S.stat.wasted(sm.wasted);
    S.stat.last(sm.last);
    drawAll(S);
  }

  function advance(api, to) {
    var S = api.state;
    to = Math.min(LAST, to);
    if (to <= S.now) return;
    for (var s = S.now + 1; s <= to; s++) {
      if (s < 0) continue;
      var ev = events(S.M, s);
      api.clock = S.M.T0 + s;
      for (var i = 0; i < ev.length; i++) api.log(ev[i][0], ev[i][1]);
    }
    S.now = to;
    if (to === LAST) S.playing = false;
    show(api);
  }

  function rewind(api, what) {
    var S = api.state;
    S.M = simulate(S.C);
    S.M.T0 = S.C.start;
    S.M.rate = S.C.rate;
    S.now = PRE;
    S.playing = false;
    api.clock = S.C.start + PRE;
    api.log(what + " Rewound to " + hmsAbs(S.C.start + PRE) + ", before the restart: 600 of 600 locks connected.", "");
    show(api);
  }

  DL.sims.define("s6e01", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { jitter: "none", cap: 60, timeout: 1, rate: 50, start: 10800, seed: Math.floor(api.rand() * 4294967296) >>> 0 };
      S.ui = build(api);
      S.stat = {
        conn: api.stat("conn", "locks connected", "ok"),
        knocks: api.stat("knocks", "knocks this second", "warn"),
        beeps: api.stat("beeps", "double beeps this second", "bad"),
        line: api.stat("line", "knocks waiting in the server's line", "warn"),
        busiest: api.stat("busiest", "busiest second since the server came back", "bad"),
        avg: api.stat("avg", "knocks a second, server back to last lock", ""),
        wasted: api.stat("wasted", "knocks served after their lock gave up", "bad"),
        last: api.stat("last", "last lock back", "ok")
      };
      api.control.select("jitter", "Random wait", JITTER, "none", function (v) {
        S.C.jitter = String(v) === "full" ? "full" : "none";
        rewind(api, S.C.jitter === "full" ? "Each wait is now random, from 0 up to the backoff." : "Waits are exact again: 1, 2, 4, 8, 16, 32 s, then the cap.");
      });
      api.control.select("cap", "Cap (longest wait)", CAPS, "60", function (v) {
        S.C.cap = Number(v);
        rewind(api, "Cap: " + S.C.cap + " s.");
      });
      api.control.select("timeout", "Timeout per knock", TMOS, "1", function (v) {
        S.C.timeout = Number(v);
        rewind(api, "Timeout per knock: " + S.C.timeout + " s.");
      });
      api.control.select("rate", "Server speed", RATES, "50", function (v) {
        S.C.rate = Number(v) === 100 ? 100 : 50;
        rewind(api, "The server lets in " + S.C.rate + " new lines a second.");
      });
      api.control.select("start", "Restart time", STARTS, "10800", function (v) {
        S.C.start = Number(v) === 50400 ? 50400 : 10800;
        rewind(api, "The restart is at " + hmsAbs(S.C.start) + ".");
      });
      api.control.button("next", "Next knocks", function () {
        var nx = LAST;
        for (var s = Math.max(0, S.now + 1); s <= LAST; s++) if (S.M.knocks[s] > 0) { nx = s; break; }
        advance(api, nx);
      });
      api.control.button("play", "Play / pause", function () { S.playing = !S.playing && S.now < LAST; });
      api.control.button("end", "To the end", function () { advance(api, LAST); });
      api.control.button("reset", "Reset", function () { api.reset(); });
      api.info("<strong>How to read it.</strong> Each lock knocks (asks the server for a new line) by its rule: wait, knock, and if the knock fails, beep twice and wait longer. Top: knocks reaching the server each second; red ones failed. Bottom: locks with their line back. While the server is down it refuses every knock at once. Once it is back it lets in a few a second, first come, first served; a lock that is still in line when its timeout runs out gives up, but the server still works through its knock.");
      S.M = simulate(S.C);
      S.M.T0 = S.C.start;
      S.M.rate = S.C.rate;
      S.now = PRE;
      S.playing = false;
      api.clock = S.C.start + PRE;
      api.log("Before the restart: 600 of 600 locks connected. Waits 1, 2, 4, 8, 16, 32 s, cap 60 s, timeout 1 s, no randomness.", "");
      show(api);
    },

    step: function (api, dt) {
      var S = api.state;
      S.acc = (S.acc || 0) + dt * 20;
      if (!S.playing) { S.acc = 0; return; }
      var n = Math.floor(S.acc);
      if (n > 0) { S.acc -= n; advance(api, S.now + n); }
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }

      // 1. Opens before the restart: every lock connected, nothing knocked yet.
      t.expect(t.stat("conn") === "600 of 600" && t.stat("knocks") === 0 && t.stat("beeps") === 0 && t.stat("line") === 0 &&
        t.stat("busiest") === "none yet" && t.stat("last") === "not yet" && t.api.clock === 10795 &&
        t.logText().indexOf("Before the restart: 600 of 600 locks connected.") >= 0,
        "Opens at 02:59:55, before the restart: 600 of 600 connected, no knocks");

      // 2. The first wave: 03:00:01, all refused at once.
      begin();
      t.click("next");
      t.expect(has("03:00:00 The server restarts. All 600 lines drop in the same instant.") &&
        has("03:00:01 600 knocks in one second, all refused at once: 600 double beeps.") &&
        t.stat("conn") === "0 of 600" && t.stat("knocks") === 600 && t.stat("beeps") === 600,
        "03:00:01: all 600 knock in the same second and are refused at once: 600 double beeps");

      // 3. Waiting longer, in step: 03:00:03, :07, :15, :31.
      begin();
      t.click("next"); t.click("next"); t.click("next"); t.click("next");
      t.expect(has("03:00:03 600 knocks") && has("03:00:07 600 knocks") && has("03:00:15 600 knocks") &&
        has("03:00:31 600 knocks in one second, all refused at once: 600 double beeps.") && t.stat("knocks") === 600,
        "The waits double, but every lock doubles together: 600 knocks at :03, :07, :15 and :31");

      // 4. 03:01:03: the server is back, 50 get in, 550 time out together.
      begin();
      t.click("next");
      t.expect(has("03:00:40 The server is back. It lets in about 50 new lines a second; the rest wait in its line.") &&
        has("03:01:03 600 knocks in one second: 50 got in, 550 gave up after the 1 s timeout and beeped at 03:01:04.") &&
        t.stat("conn") === "50 of 600" && t.stat("busiest") === "600 at 03:01:03" && t.stat("line") === 550,
        "03:01:03: 600 knocks in one second, 50 in, 550 give up at 03:01:04");

      // 5. As built: 12 waves, a minute apart; the last lock at 03:12:03.
      begin();
      t.click("end");
      t.expect(has("03:02:03 550 knocks in one second: 50 got in, 500 gave up") && has("03:11:03 100 knocks in one second: 50 got in, 50 gave up") &&
        has("03:12:03 The last lock is back at 03:12:03. 600 of 600.") && t.stat("last") === "03:12:03" &&
        t.stat("conn") === "600 of 600" && t.stat("wasted") === 3300 &&
        has("End: 600 of 600 back, the last at 03:12:03; the server worked on 3,300 knocks whose lock had already given up."),
        "As built: 600, 550, ... 50 knocks a minute apart; last lock 03:12:03; 3,300 wasted knocks");

      // 6. Full randomness: spread out, every lock back by 03:01:38.
      t.set("jitter", "full");
      t.expect(t.stat("conn") === "600 of 600" && t.stat("knocks") === 0, "Changing a setting rewinds to before the restart");
      t.click("end");
      t.expect(t.stat("last") === "03:01:38" && t.stat("busiest") === "28 at 03:00:44" && t.stat("avg") === 10.2 && t.stat("wasted") === 0,
        "Full randomness: never more than 28 knocks in a second after 03:00:40, 10.2 a second on average, last lock 03:01:38");

      // 7. A longer timeout: bigger bites, still in step.
      t.set("jitter", "none");
      t.set("timeout", "5");
      begin();
      t.click("end");
      t.expect(has("03:01:03 600 knocks in one second: 250 got in, 350 gave up after the 5 s timeout and beeped at 03:01:08.") &&
        has("03:02:03 350 knocks in one second: 250 got in, 100 gave up") && t.stat("last") === "03:03:04",
        "Timeout 5 s: waves of 600, 350, 100 still in the same second; last lock 03:03:04");

      // 8. Knock every second: the storm. Only the first 50 ever get in.
      t.set("timeout", "1");
      t.set("cap", "1");
      begin();
      t.click("end");
      t.expect(t.stat("conn") === "50 of 600" && t.stat("last") === "not yet" &&
        has("Every lock still out is knocking every second, and the server's line keeps growing.") && has("End: only 50 of 600 back;"),
        "Cap 1 s: 50 in at 03:00:40, then none; the line fills with knocks from locks that have given up");

      // 9. A server twice as fast: still waves, the last lock at 03:06:03.
      t.set("cap", "60");
      t.set("rate", "100");
      t.click("end");
      t.expect(t.stat("last") === "03:06:03" && t.stat("busiest") === "600 at 03:01:03",
        "100 new lines a second: 6 waves, last lock 03:06:03");

      // 10. A daytime restart: the same rhythm, at 14:00.
      t.set("rate", "50");
      t.set("start", "50400");
      begin();
      t.click("end");
      t.expect(has("14:01:03 600 knocks in one second: 50 got in, 550 gave up") && t.stat("last") === "14:12:03",
        "Restart at 14:00: the same 12 waves; last lock 14:12:03");
    }
  });
})();
