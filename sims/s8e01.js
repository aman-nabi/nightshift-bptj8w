/* sims/s8e01-v1.0.1.js  (published as sims/s8e01.js)
   v1.0.1 (2026-10-16) the monthly update and memory-change dates moved to 13 and 21 October to match the case
   Case s8e01 "Silence Isn't Death": a heartbeat lab for Kestrelmoor Freight's night shift. Three
   machines (app-1, app-2, app-3) assign orders to trucks; each sends a heartbeat every second to the
   Head of Shift, the program that hands out the work. The learner sets the pause, the hand-over
   timeout, a short first stage, a suspect stage, fencing and how a dead machine comes back, then
   plays the night. Widget-style sim: it draws its own heartbeat lanes and order table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: two nights (the 02:13 pause on night one, 02:13:00 to
     02:14:10; the 03:40 real stop of app-3 from option B's Part 2, 03:39:55 to 03:45:30), one step a
     second. Controls: night, pause length (3, 38, 60 s), hand-over timeout (30 s, 5 min), two-stage
     (stop sending customers after 3 s), suspect stage (10 s more), fencing, how a dead machine comes
     back (with its old work, or fresh), unplug app-2 (option C); Next second, Play / pause, To the
     end, Reset. Stats: customer requests failed, orders on two trucks, old-token writes refused,
     newest token, the database's highest token for #4471, and each machine's state.
     selfTest: 11 assertions.

   The model (stated in sim.lede). Times are whole seconds.
   - Every machine that is running sends a heartbeat each second. Silence at second s is
     s - (last heartbeat) - 1, so a machine whose last heartbeat was 02:13:03 is "silent 30 s" at
     02:13:34.
   - Order of work inside one second: (1) a new owner's writes due this second; (2) heartbeats, and
     a machine that wakes sends the writes it was in the middle of; (3) the Head of Shift's checks;
     (4) OP's click, 02:14:10 on night one; (5) customer requests.
   - Head of Shift checks, per machine not yet declared dead: two-stage on and silence >= 3 s: quiet,
     off the load balancer's list, keeps its orders. Silence >= the hand-over timeout: with the
     suspect stage, suspect (off the list) and dead at the timeout + 10 s; without it, dead at once.
     A heartbeat ends quiet or suspect. Dead: off the list; its orders go to the next machine in line
     (app-1 to app-2 to app-3 to app-1, skipping dead and unplugged ones) with the next token from
     one counter. The new owner writes one second later: a truck for any order that has none, and
     its token for the rest.
   - The database, per order: the highest token seen and the trucks assigned. A write that assigns a
     truck: fencing on refuses a token lower than the highest (counted), otherwise the newer write
     replaces the old truck; fencing off accepts every write, so a second machine's truck makes the
     order "on two trucks".
   - A paused machine wakes not knowing time passed and sends its unfinished writes with its old
     token. If it was declared dead: "with its old work" it stays a zombie holding its old orders,
     and goes back on the list at OP's click, 02:14:10; "fresh" means the Head of Shift tells it at
     once to drop its old work and rejoin as a new machine with the next token and no orders.
   - Customers: 19 requests a second through the load balancer, which hands them in turn to the
     machines on its list, in name order (request k goes to list[k mod n], k counted from the first
     second played). A request sent to a paused or stopped machine fails.

   Where every number comes from (conventions rule 14; the case is content/s8/s8e01-v1.0.0.json).
   - Dates (given; weekdays checked with Date): night one is 02:13 on Tuesday 1 December 2026. Tokens
     before it: the monthly update on Tuesday 13 October restarted the machines one by one, app-2 30,
     app-1 31, app-3 32; the contractor's memory change (4 GB to 24 GB) on Wednesday 21 October
     restarted app-2, token 33. So at 02:13:00: app-1 #4468-#4470 token 31,
     app-2 #4471-#4473 token 33 (claimed, trucks not yet assigned), app-3 #4474-#4476 token 32;
     newest token 33.
   - Night one as built (38 s pause from 02:13:04, 30 s, one stage, fencing off, old work): app-2
     silent 30 s at 02:13:34, DECLARED DEAD, #4471-#4473 to app-3 with token 34; app-3 assigns trucks
     02:13:35; app-2 wakes 02:13:42 and resumes #4471-#4473 with token 33: 3 orders on two trucks.
     Failed: app-2 stays on the list 02:13:04 to 02:13:33, 30 s x 19 = 570 requests, every third:
     190.
   - Fencing on, fresh (option D): 3 writes with token 33 refused (34 seen); app-2 rejoins with token
     35; 0 orders on two trucks. Fencing on, old work: 3 refused, app-2 a zombie with token 33.
     Fresh without fencing: still 3 on two trucks (the writes in flight go out first).
   - Two-stage on: app-2 quiet at 02:13:07; failed 3 s x 19 = 57, every third: 19.
   - Timeout 5 min (option B), night one: never declared; 0 on two trucks; app-2 on the list through
     its 38 s: 722 requests from k = 57, those with k mod 3 = 1: 241 failed.
   - Pause 3 s (before the change): back at 02:13:07, never declared; 19 failed.
   - Suspect stage, 38 s: suspect at 02:13:34, answers at 02:13:42, keeps its orders: 0 on two
     trucks, 190 failed. Pause 60 s with the suspect stage: dead 02:13:44, wakes 02:14:04: 3.
   - Unplug app-2 (option C): its orders went to app-1 earlier with token 34; the same pause hits
     app-1, which is declared dead at 02:13:34, orders to app-3 with token 35, app-1 wakes at
     02:13:42 with token 34: 3 on two trucks. Two machines on the list: 285 failed.
   - The real stop (option B's Part 2): app-3 stops at 03:40:00 (last heartbeat 03:39:59). 5 min:
     dead at 03:45:00, 300 s x 19 = 5,700 requests, every third: 1,900 failed; orders #4474-#4476 to
     app-1 with token 34. 30 s: dead 03:40:30, 190 failed. Two-stage with 5 min: 19 failed.
*/
(function () {
  "use strict";

  var NAMES = ["app-1", "app-2", "app-3"];
  var RATE = 19;              // customer requests a second (given)
  var QUIET = 3;              // two-stage: stop sending customers after 3 s of silence
  var SUSPECT_MORE = 10;      // suspect stage: 10 s more before dead
  var NIGHTS = {
    pause: { start: 7980, end: 8050, pauseAt: 7984, click: 8050, rate: 4 },       // 02:13:00 to 02:14:10
    stop: { start: 13195, end: 13530, stopAt: 13200, click: -1, rate: 30 }        // 03:39:55 to 03:45:30
  };
  var NIGHT_OPTS = [{ value: "pause", label: "Night one: app-2 pauses at 02:13:04" }, { value: "stop", label: "A later night: app-3 stops for good at 03:40" }];
  var PAUSES = [{ value: "3", label: "3 s (before the change)" }, { value: "38", label: "38 s (night one)" }, { value: "60", label: "60 s" }];
  var TIMEOUTS = [{ value: "30", label: "30 s (as built)" }, { value: "300", label: "5 min" }];
  var BACK = [{ value: "old", label: "With its old work (as built)" }, { value: "fresh", label: "Fresh, as a new machine" }];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(s) { return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60)) + ":" + pad(s % 60); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function range(list) { return list.length ? "#" + list[0] + (list.length > 1 ? "-#" + list[list.length - 1] : "") : "none"; }

  /* ---------- the model ---------- */

  function initial(C) {
    var N = NIGHTS[C.night];
    var M = {
      C: C, N: N, now: N.start, counter: 33, failed: 0, refused: 0, k: 0, due: [], marks: [],
      mach: [], db: {}, beats: [[], [], []]
    };
    for (var i = 0; i < 3; i++) {
      M.mach.push({ state: "alive", last: N.start, list: true, owns: [], tok: 0, dead: false, inflight: [] });
    }
    function own(m, from, tok) {
      for (var o = from; o < from + 3; o++) M.mach[m].owns.push(o);
      M.mach[m].tok = tok;
    }
    own(0, 4468, 31); own(1, 4471, 33); own(2, 4474, 32);
    for (var o = 4468; o <= 4476; o++) M.db[o] = { high: o >= 4474 ? 32 : (o >= 4471 ? 33 : 31), trucks: 1, by: o >= 4474 ? 2 : (o >= 4471 ? 1 : 0) };
    var night = C.night === "pause";
    if (night) for (var p = 4471; p <= 4473; p++) { M.db[p].trucks = 0; M.db[p].by = -1; }
    M.pauser = 1;
    if (C.unplug) {
      M.counter = 34;
      M.mach[1].state = "unplugged"; M.mach[1].list = false;
      M.mach[0].owns = M.mach[0].owns.concat(M.mach[1].owns);
      M.mach[1].owns = []; M.mach[1].tok = 0;
      M.mach[0].tok = 34;
      for (var q = 4471; q <= 4473; q++) M.db[q].high = 34;
      M.pauser = 0;
    }
    if (night) {
      var pm = M.mach[M.pauser];
      for (var r = 4471; r <= 4473; r++) pm.inflight.push({ o: r, tok: C.unplug ? 34 : 33 });
    }
    return M;
  }

  function paused(M, m, s) {
    var N = M.N;
    if (M.mach[m].state === "unplugged") return true;
    if (M.C.night === "pause") return m === M.pauser && s >= N.pauseAt && s < N.pauseAt + M.C.pause;
    return m === 2 && s >= N.stopAt;
  }
  function nextInLine(M, m) {
    for (var d = 1; d <= 2; d++) {
      var c = (m + d) % 3;
      if (!M.mach[c].dead && M.mach[c].state !== "unplugged") return c;
    }
    return -1;
  }
  function doubles(M) {
    var n = 0;
    for (var o in M.db) if (M.db[o].trucks >= 2) n++;
    return n;
  }

  // A write that assigns a truck to order o for machine m with token tok. Returns "ok", "two", "refused".
  function assign(M, o, m, tok) {
    var r = M.db[o];
    if (M.C.fencing && tok < r.high) { M.refused++; return "refused"; }
    if (tok > r.high) r.high = tok;
    if (r.trucks === 0 || r.by === m) { r.trucks = Math.max(1, r.trucks); r.by = m; return "ok"; }
    if (M.C.fencing) { r.by = m; return "ok"; }
    r.trucks += 1;
    return "two";
  }

  function stepSecond(M, s, log) {
    var C = M.C, N = M.N, i, x;
    // (1) new owners' writes due now
    var due = M.due.filter(function (d) { return d.at === s; });
    M.due = M.due.filter(function (d) { return d.at !== s; });
    due.forEach(function (d) {
      var news = [];
      d.orders.forEach(function (o) {
        if (M.db[o].trucks === 0) { assign(M, o, d.m, d.tok); news.push(o); }
        else if (d.tok > M.db[o].high) M.db[o].high = d.tok;
      });
      log(NAMES[d.m] + " takes over " + range(d.orders) + " with token " + d.tok +
        (news.length ? " and assigns trucks to " + range(news) + "." : "; their trucks are already assigned."), "");
    });
    // (2) heartbeats and waking
    for (i = 0; i < 3; i++) {
      x = M.mach[i];
      if (x.state === "unplugged") continue;
      var p = paused(M, i, s);
      M.beats[i].push(p ? 0 : 1);
      if (p) continue;
      var wasSilent = x.last < s - 1;
      x.last = s;
      if (!wasSilent) continue;
      var gone = s - M.mark0(i);
      if (x.inflight.length) {
        var t = x.inflight[0].tok;
        var os = x.inflight.map(function (f) { return f.o; });
        log(NAMES[i] + ": heartbeat ok. resuming orders " + range(os) + " (token " + t + ")", x.dead ? "warn" : "");
        var res = x.inflight.map(function (f) { return assign(M, f.o, i, f.tok); });
        x.inflight = [];
        if (res[0] === "refused") log("The database refuses token " + t + " for " + range(os) + ": it has already seen token " + M.db[os[0]].high + ".", "ok");
        else if (res[0] === "two") log("The database accepts token " + t + " too: " + range(os) + " are now each on two trucks.", "bad");
      }
      if (x.dead) {
        if (C.back === "fresh") {
          M.counter++;
          x.dead = false; x.state = "alive"; x.list = true; x.owns = []; x.tok = M.counter;
          log("The Head of Shift answers " + NAMES[i] + ": you were declared dead. It drops its old work and rejoins as a new machine with token " + M.counter + " and no orders.", "ok");
        } else {
          x.state = "zombie";
          log(NAMES[i] + " is back after " + gone + " s and doesn't know it was declared dead. It still believes it owns " + range(x.owns) + ".", "bad");
        }
      } else if (x.state === "quiet" || x.state === "suspect") {
        log(NAMES[i] + " answers again after " + gone + " s. It was only " + x.state + ", so it goes back on the list and keeps its orders.", "ok");
        x.state = "alive"; x.list = true;
      }
    }
    // (3) the Head of Shift's checks
    for (i = 0; i < 3; i++) {
      x = M.mach[i];
      if (x.dead || x.state === "unplugged" || x.last === s) continue;
      var sil = s - x.last - 1;
      if (C.twostage && sil >= QUIET && x.state === "alive") {
        x.state = "quiet"; x.list = false;
        log(NAMES[i] + " silent " + QUIET + " s: the load balancer stops sending it customers. It keeps its orders.", "warn");
      }
      var dead = false;
      if (sil >= C.timeout) {
        if (C.suspect) {
          if (x.state !== "suspect") {
            x.state = "suspect"; x.list = false;
            log(NAMES[i] + " silent " + label(C.timeout) + ": SUSPECT. The other machines try to reach it too, for " + SUSPECT_MORE + " s more.", "warn");
          }
          if (sil >= C.timeout + SUSPECT_MORE) dead = true;
        } else dead = true;
      }
      if (dead) {
        x.dead = true; x.state = "dead"; x.list = false;
        var to = nextInLine(M, i);
        M.counter++;
        var orders = x.owns.slice();
        log(NAMES[i] + " silent " + label(sil) + ": DECLARED DEAD. Its orders " + range(orders) + " go to " + NAMES[to] + " with token " + M.counter + ".", "bad");
        var y = M.mach[to];
        y.owns = y.owns.concat(orders);
        y.tok = Math.max(y.tok, M.counter);
        M.due.push({ at: s + 1, m: to, tok: M.counter, orders: orders });
      }
    }
    // (4) OP's click on night one
    if (s === N.click) {
      for (i = 0; i < 3; i++) {
        x = M.mach[i];
        if (x.state === "zombie") {
          x.list = true;
          log("You click Return to service: " + NAMES[i] + " goes back on the list, still holding " + range(x.owns) + " under token " + zTok(M, i) + ".", "bad");
        }
      }
    }
    // (5) customers
    var on = [];
    for (i = 0; i < 3; i++) if (M.mach[i].list) on.push(i);
    for (var r = 0; r < RATE; r++) {
      if (!on.length) { M.failed++; continue; }
      var tgt = on[M.k % on.length];
      M.k++;
      if (paused(M, tgt, s)) M.failed++;
    }
  }

  function label(sec) { return sec >= 300 && sec % 60 === 0 ? (sec / 60) + " min" : sec + " s"; }
  function zTok(M, i) { return M.mach[i].ztok; }
  function stateText(M, i) {
    var x = M.mach[i];
    if (x.state === "unplugged") return "unplugged";
    if (x.state === "dead") return "dead";
    if (x.state === "zombie") return "zombie, token " + zTok(M, i);
    return x.state + ", token " + x.tok;
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
      viewBox: "0 0 660 190", width: "100%", "class": "dg", role: "img",
      "aria-label": "Heartbeat lanes, one per machine. Each green tick is one heartbeat; a red flat line is silence. Each lane's label shows the machine's state as the Head of Shift sees it. A solid line marks where the playhead is."
    });
    var layer = mk(doc, "g", {}, svg);
    wrap.appendChild(svg);
    var table = doc.createElement("table");
    table.setAttribute("style", "width:100%;font-size:12px;");
    var tbody = doc.createElement("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    api.root.appendChild(wrap);
    return { doc: doc, head: head, layer: layer, tbody: tbody };
  }

  function drawAll(S) {
    var M = S.M, doc = S.ui.doc, g = S.ui.layer;
    clear(g);
    var len = M.N.end - M.N.start, x0 = 150, pw = 480 / len;
    function X(s) { return x0 + (s - M.N.start) * pw; }
    for (var i = 0; i < 3; i++) {
      var y = 30 + i * 46;
      txt(doc, g, 10, y + 4, NAMES[i] + ": " + stateText(M, i), "dg-note");
      var ok = "", bad = "";
      var b = M.beats[i];
      for (var k = 0; k < b.length; k++) {
        var sx = X(M.N.start + 1 + k);
        if (b[k]) ok += "M" + sx.toFixed(1) + " " + (y - 7) + "V" + (y + 7);
        else bad += "M" + (sx - pw).toFixed(1) + " " + y + "H" + sx.toFixed(1);
      }
      var go = mk(doc, "g", { "class": "dg-node st-ok" }, g);
      if (ok) mk(doc, "path", { d: ok, stroke: "currentColor", "stroke-width": 1.2 }, go);
      var gb = mk(doc, "g", { "class": "dg-node st-bad" }, g);
      if (bad) mk(doc, "path", { d: bad, stroke: "currentColor", "stroke-width": 1.5 }, gb);
    }
    mk(doc, "line", { x1: X(M.now), y1: 14, x2: X(M.now), y2: 150, stroke: "currentColor", "class": "dg-axis" }, g);
    txt(doc, g, x0, 176, hms(M.N.start), "dg-axis", "middle");
    txt(doc, g, x0 + 480, 176, hms(M.N.end), "dg-axis", "middle");
    var tb = S.ui.tbody;
    clear(tb);
    var hr = doc.createElement("tr");
    ["order", "owner (Head of Shift)", "highest token seen", "trucks"].forEach(function (h) {
      var th = doc.createElement("th"); th.setAttribute("style", "text-align:left;"); th.textContent = h; hr.appendChild(th);
    });
    tb.appendChild(hr);
    for (var o = 4468; o <= 4476; o++) {
      var owner = "-";
      for (var m = 0; m < 3; m++) if (!M.mach[m].dead && M.mach[m].state !== "zombie" && M.mach[m].owns.indexOf(o) >= 0) owner = NAMES[m];
      var tr = doc.createElement("tr");
      ["#" + o, owner, String(M.db[o].high), String(M.db[o].trucks)].forEach(function (c) {
        var td = doc.createElement("td"); td.textContent = c; tr.appendChild(td);
      });
      tb.appendChild(tr);
    }
  }

  function show(api) {
    var S = api.state, M = S.M, C = S.C;
    api.clock = M.now;
    S.ui.head.textContent = (C.night === "pause" ? "Night one, pause " + C.pause + " s" : "app-3 stops at 03:40:00") +
      ". Hand-over after " + label(C.timeout) + (C.suspect ? " + 10 s suspect" : "") + (C.twostage ? "; customers stopped after 3 s" : "") +
      ". Fencing " + (C.fencing ? "on" : "off") + ". A dead machine comes back " + (C.back === "fresh" ? "fresh" : "with its old work") +
      (C.unplug ? ". app-2 unplugged." : ".");
    S.stat.failed(fmt(M.failed));
    S.stat.doubles(doubles(M));
    S.stat.refused(M.refused);
    S.stat.token(M.counter);
    S.stat.high(M.db[4471].high);
    S.stat.m1(stateText(M, 0));
    S.stat.m2(stateText(M, 1));
    S.stat.m3(stateText(M, 2));
    drawAll(S);
  }

  function advance(api, to) {
    var S = api.state, M = S.M;
    to = Math.min(M.N.end, to);
    for (var s = M.now + 1; s <= to; s++) {
      M.now = s;
      api.clock = s;
      stepSecond(M, s, function (msg, tone) { api.log(msg, tone); });
    }
    if (M.now >= M.N.end) {
      if (!S.endLogged) {
        S.endLogged = true;
        api.log("End: " + doubles(M) + " orders on two trucks, " + M.refused + " old-token writes refused, " + fmt(M.failed) + " customer requests failed.", doubles(M) ? "bad" : "ok");
      }
      S.playing = false;
    }
    show(api);
  }

  function rewind(api, what) {
    var S = api.state;
    S.M = setupModel(S.C);
    S.playing = false;
    S.endLogged = false;
    api.clock = S.M.now;
    api.log(what + " Rewound to " + hms(S.M.now) + ".", "");
    show(api);
  }

  function setupModel(C) {
    var M = initial(C);
    M.mark0 = function (i) {
      // seconds the machine was silent before the heartbeat that ends it
      var b = M.beats[i], n = 0;
      for (var k = b.length - 2; k >= 0 && !b[k]; k--) n++;
      return M.now - n;
    };
    // a zombie keeps the token it held when it paused
    M.mach.forEach(function (x) { x.ztok = x.tok; });
    return M;
  }

  DL.sims.define("s8e01", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { night: "pause", pause: 38, timeout: 30, twostage: false, suspect: false, fencing: false, back: "old", unplug: false };
      S.ui = build(api);
      S.stat = {
        failed: api.stat("failed", "customer requests failed", "bad"),
        doubles: api.stat("doubles", "orders on two trucks", "bad"),
        refused: api.stat("refused", "old-token writes refused", "ok"),
        token: api.stat("token", "newest token handed out", ""),
        high: api.stat("high", "database's highest token for #4471", ""),
        m1: api.stat("m1", "app-1", ""),
        m2: api.stat("m2", "app-2", ""),
        m3: api.stat("m3", "app-3", "")
      };
      api.control.select("night", "Night", NIGHT_OPTS, "pause", function (v) {
        S.C.night = String(v) === "stop" ? "stop" : "pause";
        rewind(api, S.C.night === "stop" ? "app-3 will stop for good at 03:40:00." : "Night one: app-2 will pause at 02:13:04.");
      });
      api.control.select("pause", "Pause length", PAUSES, "38", function (v) {
        S.C.pause = Number(v);
        rewind(api, "The pause lasts " + S.C.pause + " s.");
      });
      api.control.select("timeout", "Silence before hand-over", TIMEOUTS, "30", function (v) {
        S.C.timeout = Number(v) === 300 ? 300 : 30;
        rewind(api, "Hand-over after " + label(S.C.timeout) + " of silence.");
      });
      api.control.toggle("twostage", "Two-stage: stop sending customers after 3 s", false, function (on) {
        S.C.twostage = !!on;
        rewind(api, "Two-stage " + (on ? "on." : "off."));
      });
      api.control.toggle("suspect", "Suspect stage: 10 s more before dead", false, function (on) {
        S.C.suspect = !!on;
        rewind(api, "Suspect stage " + (on ? "on." : "off."));
      });
      api.control.toggle("fencing", "Fencing: the database refuses older tokens", false, function (on) {
        S.C.fencing = !!on;
        rewind(api, "Fencing " + (on ? "on." : "off."));
      });
      api.control.select("back", "Return to service", BACK, "old", function (v) {
        S.C.back = String(v) === "fresh" ? "fresh" : "old";
        rewind(api, "A machine declared dead comes back " + (S.C.back === "fresh" ? "fresh, as a new machine." : "with its old work."));
      });
      api.control.toggle("unplug", "Unplug app-2 for good", false, function (on) {
        S.C.unplug = !!on;
        rewind(api, on ? "app-2 is unplugged; its orders went to app-1 earlier with token 34, and the pause hits app-1." : "app-2 is back in the line-up.");
      });
      api.control.button("next", "Next second", function () { advance(api, S.M.now + 1); });
      api.control.button("play", "Play / pause", function () { S.playing = !S.playing && S.M.now < S.M.N.end; });
      api.control.button("end", "To the end", function () { advance(api, S.M.N.end); });
      api.control.button("reset", "Reset", function () { api.reset(); });
      api.info("<strong>How to read it.</strong> Each lane is one machine: a green tick is a heartbeat, a red line is silence. The label shows its state as the Head of Shift sees it: alive; quiet (no customers, keeps its orders); suspect (others are checking); dead (its orders handed on); zombie (declared dead, still working). The table shows each order's owner, the highest token the database has seen for it, and how many trucks it is on.");
      S.M = setupModel(S.C);
      S.playing = false;
      S.endLogged = false;
      api.clock = S.M.now;
      api.log("Night one, before the pause. app-1 owns #4468-#4470 (token 31), app-2 #4471-#4473 (token 33), app-3 #4474-#4476 (token 32). Every machine sends a heartbeat each second.", "");
      show(api);
    },

    step: function (api, dt) {
      var S = api.state;
      if (!S.playing) { S.acc = 0; return; }
      S.acc = (S.acc || 0) + dt * S.M.N.rate;
      var n = Math.floor(S.acc);
      if (n > 0) { S.acc -= n; advance(api, S.M.now + n); }
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function fresh() { t.click("reset"); }

      // 1. Opens at 02:13:00, before the pause: all alive, newest token 33.
      t.expect(t.api.clock === 7980 && t.stat("failed") === 0 && t.stat("doubles") === 0 && t.stat("refused") === 0 &&
        t.stat("token") === 33 && t.stat("high") === 33 && t.stat("m2") === "alive, token 33" && t.stat("m3") === "alive, token 32",
        "Opens at 02:13:00: app-2 alive with token 33, newest token 33, nothing failed");

      // 2. Night one as built: declared dead at 02:13:34, three orders on two trucks, 190 failed.
      t.click("end");
      t.expect(has("02:13:34 app-2 silent 30 s: DECLARED DEAD. Its orders #4471-#4473 go to app-3 with token 34.") &&
        has("02:13:42 app-2: heartbeat ok. resuming orders #4471-#4473 (token 33)") &&
        has("#4471-#4473 are now each on two trucks.") && t.stat("doubles") === 3 && t.stat("failed") === 190 &&
        t.stat("high") === 34 && t.stat("m2") === "zombie, token 33",
        "As built: dead at 02:13:34, token 34 to app-3, app-2 resumes with 33 at 02:13:42: 3 orders on two trucks, 190 failed");

      // 3. The ok option: fencing on, rejoin fresh. Token 33 refused, app-2 rejoins with 35.
      fresh(); t.click("fencing"); t.set("back", "fresh"); t.click("end");
      t.expect(has("The database refuses token 33 for #4471-#4473: it has already seen token 34.") &&
        t.stat("refused") === 3 && t.stat("doubles") === 0 && t.stat("token") === 35 && t.stat("m2") === "alive, token 35",
        "Fencing and a fresh rejoin: 3 writes with token 33 refused, 0 on two trucks, app-2 rejoins with token 35");

      // 4. Fresh without fencing: the writes in flight still land.
      fresh(); t.set("back", "fresh"); t.click("end");
      t.expect(t.stat("doubles") === 3 && t.stat("refused") === 0 && t.stat("token") === 35,
        "Rejoining fresh alone: the 3 writes app-2 was in the middle of still land, 3 on two trucks");

      // 5. Fencing with the old work: refused, but app-2 stays a zombie.
      fresh(); t.click("fencing"); t.click("end");
      t.expect(t.stat("refused") === 3 && t.stat("doubles") === 0 && t.stat("m2") === "zombie, token 33",
        "Fencing with the old work: 3 refused, and app-2 is still a zombie holding token 33");

      // 6. Option B on night one: 5 minutes, never declared, 241 failed.
      fresh(); t.set("timeout", "300"); t.click("end");
      t.expect(t.stat("doubles") === 0 && t.stat("failed") === 241 && t.stat("token") === 33 && t.stat("m2") === "alive, token 33",
        "5 min on night one: never declared dead, 0 on two trucks, but app-2 takes customers through its 38 s: 241 failed");

      // 7. Option B's Part 2: app-3 stops for good at 03:40; 5 minutes means 1,900 failed.
      fresh(); t.set("night", "stop"); t.set("timeout", "300"); t.click("end");
      var b5 = t.stat("failed") === "1,900" && has("03:45:00 app-3 silent 5 min: DECLARED DEAD. Its orders #4474-#4476 go to app-1 with token 34.");
      t.set("timeout", "30"); t.click("end");
      var b30 = t.stat("failed") === 190;
      t.set("timeout", "300"); t.click("twostage"); t.click("end");
      t.expect(b5 && b30 && t.stat("failed") === 19,
        "app-3 stops at 03:40: 1,900 failed with 5 min, 190 with 30 s, 19 with customers stopped after 3 s");

      // 8. Two-stage on night one: 19 failed, but still three on two trucks.
      fresh(); t.click("twostage"); t.click("end");
      t.expect(has("02:13:07 app-2 silent 3 s: the load balancer stops sending it customers.") && t.stat("failed") === 19 && t.stat("doubles") === 3,
        "Two-stage on night one: customers stopped at 02:13:07, 19 failed; the hand-over still makes 3 on two trucks");

      // 9. The old 3 s pauses: never declared.
      fresh(); t.set("pause", "3"); t.click("end");
      t.expect(t.stat("doubles") === 0 && t.stat("failed") === 19 && t.stat("token") === 33,
        "A 3 s pause, as before the change: never declared dead, 19 failed, nothing doubled");

      // 10. Suspect stage: 38 s survives, 60 s does not.
      fresh(); t.click("suspect"); t.click("end");
      var s38 = t.stat("doubles") === 0 && t.stat("failed") === 190 && has("app-2 answers again after 38 s. It was only suspect");
      t.set("pause", "60"); t.click("end");
      t.expect(s38 && t.stat("doubles") === 3 && has("02:13:44 app-2 silent 40 s: DECLARED DEAD."),
        "Suspect stage: the 38 s pause ends while suspect, nothing doubled; a 60 s pause is declared dead at 02:13:44 and doubles 3");

      // 11. Option C: unplug app-2, and the same pause hits app-1.
      fresh(); t.click("unplug"); t.click("end");
      t.expect(t.stat("m2") === "unplugged" && t.stat("doubles") === 3 && t.stat("failed") === 285 &&
        has("02:13:34 app-1 silent 30 s: DECLARED DEAD. Its orders #4468-#4473 go to app-3 with token 35."),
        "app-2 unplugged: app-1 pauses instead, is declared dead, and 3 orders end up on two trucks; 285 failed");
    }
  });
})();
