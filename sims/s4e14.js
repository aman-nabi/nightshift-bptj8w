/* sims/s4e14-v1.0.0.js  (published as sims/s4e14.js)
   Case s4e14 "Out of Order": an ordering lab for the night dispatch board on the Strathcullen line.
   Trackside sensors at seven stations send "train X passed station Y" to the board through a queue
   with retries. The learner picks how many consumers read the queue, the board's ordering rule,
   the delay on the one retried update, and the hold window, then replays the night update by update
   and reads each train's position on the board against where it really is.
   Widget-style sim: it draws its own line and table inside api.root. api.speed is 0; the clock is
   set to each event's time, so every log line carries the story's time.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: 18 updates for 3 trains, one failed delivery and its retry;
     consumers 1 to 3; rules: arrival order (as built), the board's arrival stamp, the sensor's
     time with older ones ignored, a per-sensor sequence check, hold and sort by sensor time;
     retry delay 30 to 300 s; hold window 0 to 60 s. Next update, Play, Run to 01:40:00, Reset.
     selfTest: 11 assertions.

   The model (stated in sim.lede):
   - Stations in down order: Tarvennan, Kilmardy, Drumlarach, Inchvoray (the loop and signal box),
     Balquharn, Strathcullen, Lochsgair. Down trains go Tarvennan to Lochsgair, up trains back.
   - Each sensor stamps its update with its own clock (set by NTP) and numbers its own updates
     from #1, in the order it sends them.
   - Every update reaches the board, through the queue, 5 s after its sensor time, except
     Kilmardy's update for 2V08: the sensor's first send fails at 01:12:05, and the sensor's retry
     reaches the board at sensor time plus the retry delay (245 s on the night: 01:16:10). The
     retry happens before the queue, so the queue receives it after Drumlarach's newer update.
   - Consumers take updates off the queue in the order they arrived and apply them at once. With
     no two updates for one train arriving close together tonight, 1, 2 or 3 consumers apply the
     same order.
   - Rules. arrival: apply each update as it arrives. stamp: the board stamps each update with its
     own clock on arrival and applies them sorted by that stamp (the arrival order again).
     event: ignore an update whose sensor time is not later than the last one applied for that
     train. seq: ignore an update whose number is not higher than the last applied from that
     sensor. hold: keep every update for the window after it arrives; when the first held update's
     window ends, apply held updates in sensor-time order until that one has gone. Arrivals in a
     second are handled before releases in that second.
   - Backwards: the board moves a train to a station behind the one it showed (against its
     direction). Shown backwards for: from that move until the train's next applied update.
   - Board lag: the longest time from sensor to board for an update delivered first time
     (5 s, or 5 s plus the hold window).

   Where every number comes from (conventions rule 14; the case is content/s4/s4e14-v1.0.0.json).
   - 2V08 (down): Tarvennan 01:06:30, Kilmardy 01:12:05 (update A), Drumlarach 01:15:40 (update B),
     Inchvoray 01:19:20, Balquharn 01:24:10, Strathcullen 01:28:45, Lochsgair 01:33:30.
   - 2T31 (up): Lochsgair 01:07:15, Strathcullen 01:11:50, Balquharn 01:16:30, Inchvoray 01:21:05,
     Drumlarach 01:25:40, Kilmardy 01:29:10, Tarvennan 01:34:50.
   - 6E19 (down, timber freight, waiting in the Inchvoray loop at 01:05:00): Inchvoray (leaves the
     loop) 01:22:40, Balquharn 01:28:05, Strathcullen 01:33:15, Lochsgair 01:38:40.
   - 18 updates. B reaches the board at 01:15:45, the retry of A at 01:16:10, 25 s later.
   - As built: the board shows 2V08 at Tarvennan, then Drumlarach at 01:15:45, then Kilmardy at
     01:16:10 (backwards), then Inchvoray at 01:19:25: shown backwards for 3 min 15 s, and at
     01:17:00 the board shows 2V08 at Kilmardy while it is past Drumlarach.
   - Sensor's time, older ignored: the retry is ignored (01:12:05 is older than 01:15:40); 17 applied.
   - Sequence check: A is Kilmardy's #1 and B is Drumlarach's #1; different sensors, so A passes.
   - Hold 30 s: B is held until 01:16:15; A arrives at 01:16:10, so both go at 01:16:15, A first.
     Board lag 35 s. A retry delay of 250 s still works (A arrives at 01:16:15); 255 s does not:
     B goes at 01:16:15, A at 01:16:50, and 2V08 is shown backwards for 3 min 5 s.
   - Arrival order with a retry delay of 220 s or less: A arrives no later than B, no backwards.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var T0 = 3900;          // 01:05:00
  var END = 6000;         // 01:40:00
  var DELAY = 5;          // sensor to board, every first delivery
  var LOOK = 4620;        // 01:17:00, when Murdina looked at the board
  var STATIONS = ["Tarvennan", "Kilmardy", "Drumlarach", "Inchvoray", "Balquharn", "Strathcullen", "Lochsgair"];
  var TRAINS = [
    { id: "2V08", dir: 1, start: -1, what: "down passenger" },
    { id: "2T31", dir: -1, start: -1, what: "up passenger" },
    { id: "6E19", dir: 1, start: 3, what: "timber freight" }
  ];
  function hms(h, m, s) { return h * 3600 + m * 60 + s; }
  var RAW = [
    ["2V08", 0, hms(1, 6, 30)], ["2V08", 1, hms(1, 12, 5)], ["2V08", 2, hms(1, 15, 40)], ["2V08", 3, hms(1, 19, 20)],
    ["2V08", 4, hms(1, 24, 10)], ["2V08", 5, hms(1, 28, 45)], ["2V08", 6, hms(1, 33, 30)],
    ["2T31", 6, hms(1, 7, 15)], ["2T31", 5, hms(1, 11, 50)], ["2T31", 4, hms(1, 16, 30)], ["2T31", 3, hms(1, 21, 5)],
    ["2T31", 2, hms(1, 25, 40)], ["2T31", 1, hms(1, 29, 10)], ["2T31", 0, hms(1, 34, 50)],
    ["6E19", 3, hms(1, 22, 40)], ["6E19", 4, hms(1, 28, 5)], ["6E19", 5, hms(1, 33, 15)], ["6E19", 6, hms(1, 38, 40)]
  ];
  var RULES = [
    { value: "arrival", label: "Apply in arrival order (as built)" },
    { value: "stamp", label: "Board's clock stamp on arrival, sorted" },
    { value: "event", label: "Sensor's time: ignore older than last applied" },
    { value: "seq", label: "Sensor's sequence number: ignore older from that sensor" },
    { value: "hold", label: "Hold for the window, then sort by sensor time" }
  ];
  var RULE_SHORT = {
    arrival: "apply in arrival order",
    stamp: "stamp with the board's clock on arrival and sort by it",
    event: "the sensor's time, ignoring any update older than the last applied for that train",
    seq: "a sequence number per sensor, ignoring any update not newer than the last from that sensor",
    hold: "hold each update for the window, then apply in sensor-time order"
  };

  // The updates, with each sensor's own sequence numbers (#1, #2, ... in the order it sends).
  var UPDATES = (function () {
    var list = RAW.map(function (r, i) { return { i: i, train: r[0], st: r[1], ts: r[2] }; });
    var bySt = {};
    list.slice().sort(function (a, b) { return a.ts - b.ts || a.i - b.i; }).forEach(function (u) {
      bySt[u.st] = (bySt[u.st] || 0) + 1;
      u.seq = bySt[u.st];
    });
    return list;
  })();
  var A_INDEX = 1;        // Kilmardy's update for 2V08, the one whose first delivery fails

  /* ---------- small helpers ---------- */

  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function clock(t) { return p2(Math.floor(t / 3600)) + ":" + p2(Math.floor(t / 60) % 60) + ":" + p2(t % 60); }
  function dur(s) {
    if (s < 60) return s + " s";
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + " min" + (r ? " " + r + " s" : "");
  }
  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }
  function trainOf(id) { for (var k = 0; k < TRAINS.length; k++) if (TRAINS[k].id === id) return TRAINS[k]; return null; }
  function stName(i) { return i < 0 ? "not on the line yet" : STATIONS[i]; }
  function upd(u) { return u.train + " at " + STATIONS[u.st] + " (sensor " + clock(u.ts) + (u.i === A_INDEX ? ", the retry" : "") + ")"; }

  /* ---------- the model: the whole night as a list of board events ---------- */

  function night(C) {
    var arr = UPDATES.map(function (u) {
      return { u: u, at: u.i === A_INDEX ? u.ts + C.retry : u.ts + DELAY };
    });
    arr.sort(function (a, b) { return a.at - b.at || a.u.ts - b.u.ts || a.u.i - b.u.i; });
    var ev = [];
    var a = UPDATES[A_INDEX];
    ev.push({ t: a.ts, kind: "fail", u: a, msg: "Kilmardy's sensor sends 2V08 at Kilmardy (sensor " + clock(a.ts) +
      ") and the send fails. The sensor retries; the retry reaches the board at " + clock(a.ts + C.retry) + "." });
    var lastTs = {};
    var lastSeq = {};
    if (C.rule !== "hold") {
      arr.forEach(function (x) {
        var u = x.u;
        var e = { t: x.at, kind: "apply", u: u, note: "" };
        if (C.rule === "stamp") e.note = " Stamped " + clock(x.at) + " by the board's clock, the latest stamp so far, so it goes last.";
        if (C.rule === "event") {
          if (lastTs[u.train] !== undefined && u.ts <= lastTs[u.train]) {
            e.kind = "ignore";
            e.note = " Older than " + clock(lastTs[u.train]) + ", the last applied for " + u.train + ": ignored.";
          } else lastTs[u.train] = u.ts;
        }
        if (C.rule === "seq") {
          var prev = lastSeq[u.st];
          if (prev !== undefined && u.seq <= prev) {
            e.kind = "ignore";
            e.note = " " + STATIONS[u.st] + " #" + u.seq + " is not newer than #" + prev + ": ignored.";
          } else {
            e.note = " " + STATIONS[u.st] + " #" + u.seq + "; last applied from " + STATIONS[u.st] + ": " +
              (prev === undefined ? "none" : "#" + prev) + ", so it passes.";
            lastSeq[u.st] = u.seq;
          }
        }
        ev.push(e);
      });
    } else {
      var held = [];
      var k = 0;
      var guard = 0;
      while ((k < arr.length || held.length) && guard++ < 200) {
        var due = Infinity;
        held.forEach(function (h) { if (h.at + C.win < due) due = h.at + C.win; });
        if (k < arr.length && arr[k].at <= due) {
          var x = arr[k++];
          held.push(x);
          ev.push({ t: x.at, kind: "hold", u: x.u, note: " Held until " + clock(x.at + C.win) + "." });
        } else {
          held.sort(function (p, q) { return p.u.ts - q.u.ts || p.u.i - q.u.i; });
          var out = held.shift();
          ev.push({ t: due, kind: "apply", u: out.u, arrived: out.at, note: " Released in sensor-time order." });
        }
      }
    }
    ev.forEach(function (e, n) { e.n = n; });
    ev.sort(function (p, q) { return p.t - q.t || p.n - q.n; });
    return ev;
  }

  function trueAt(train, t) {
    var tr = trainOf(train);
    var pos = tr.start;
    var best = -1;
    UPDATES.forEach(function (u) { if (u.train === train && u.ts <= t && u.ts > best) { best = u.ts; pos = u.st; } });
    return pos;
  }

  /* ---------- replay ---------- */

  function fresh(S) {
    S.board = {};
    TRAINS.forEach(function (tr) { S.board[tr.id] = { pos: tr.start, hist: [], backSince: null }; });
    S.applied = 0;
    S.ignored = 0;
    S.back = 0;
    S.backSec = 0;
    S.lag = null;
    S.look = null;
    S.k = 0;
    S.done = false;
  }

  function lookAt(api, t) {
    var S = api.state;
    if (S.look === null && t >= LOOK) S.look = stName(S.board["2V08"].pos);
  }

  function fire(api, e) {
    var S = api.state;
    lookAt(api, e.t);
    api.clock = e.t;
    S.now = e.t;
    var u = e.u;
    if (e.kind === "fail") { api.log(e.msg, "warn"); return; }
    if (e.kind === "hold") { api.log(upd(u) + " arrives." + e.note, ""); return; }
    var b = S.board[u.train];
    var before = b.pos < 0 ? "no position for it" : STATIONS[b.pos];
    if (e.kind === "ignore") {
      S.ignored += 1;
      api.log(upd(u) + " arrives. Board shows " + before + "." + e.note, "ok");
      return;
    }
    var tr = trainOf(u.train);
    var backwards = b.pos >= 0 && (u.st - b.pos) * tr.dir < 0;
    var after = STATIONS[u.st] + (u.st === b.pos ? ", out of the loop" : "");
    if (b.backSince !== null) { S.backSec += e.t - b.backSince; b.backSince = null; }
    b.pos = u.st;
    b.hist.push({ t: e.t, st: u.st, back: backwards });
    S.applied += 1;
    if (u.i !== A_INDEX) S.lag = Math.max(S.lag || 0, e.t - u.ts);
    var head = e.kind === "apply" && S.C.rule === "hold" ? "Applied " + upd(u) + "." : upd(u) + " arrives.";
    var msg = head + e.note + " Board had " + before + "; now " + after + ".";
    if (backwards) {
      S.back += 1;
      b.backSince = e.t;
      msg += " " + u.train + " is shown going backwards.";
    }
    api.log(msg, backwards ? "bad" : "");
  }

  function finish(api) {
    var S = api.state;
    lookAt(api, END);
    api.clock = END;
    S.now = END;
    S.done = true;
    TRAINS.forEach(function (tr) {
      var b = S.board[tr.id];
      if (b.backSince !== null) { S.backSec += END - b.backSince; b.backSince = null; }
    });
    api.log("End of the night. " + S.applied + " applied, " + S.ignored + " ignored, " + S.back +
      " shown going backwards, for " + dur(S.backSec) + ". At 01:17:00 the board showed 2V08 at " + S.look + ".",
      S.back ? "bad" : "ok");
  }

  function next(api) {
    var S = api.state;
    if (S.done) return;
    if (S.k < S.R.length) fire(api, S.R[S.k++]);
    else finish(api);
    draw(api);
  }

  function runTo(api, t) {
    var S = api.state;
    while (!S.done && S.k < S.R.length && S.R[S.k].t <= t) fire(api, S.R[S.k++]);
    if (!S.done) {
      lookAt(api, t);
      S.now = Math.max(S.now, t);
      api.clock = S.now;
    }
    if (t >= END) finish(api);
    draw(api);
  }

  function describe(C) {
    return "Consumers: " + C.consumers + ". Rule: " + RULE_SHORT[C.rule] + "." +
      (C.rule === "hold" ? " Window: " + C.win + " s." : "") + " Retry delay: " + dur(C.retry) + ".";
  }

  function restart(api, why) {
    var S = api.state;
    fresh(S);
    S.R = night(S.C);
    S.playing = false;
    S.now = T0;
    api.clock = T0;
    api.log((why ? why + " " : "") + "Night from 01:05:00. " + describe(S.C), "");
    draw(api);
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var X0 = 70;
  var DX = 95;

  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, parent, x, y, s, cls, anchor) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "middle" }, parent);
    t.textContent = s;
    return t;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 720 250", width: "100%", "class": "dg", role: "img",
      "aria-label": "The Strathcullen line, seven stations left to right from Tarvennan to Lochsgair. One row per train. A hollow ring marks where the train really is; a filled dot marks where the dispatch board shows it. Red means the board shows the train behind a station it already showed."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var table = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["train", "really at", "board shows", "board's moves"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    box.appendChild(table);
    api.root.appendChild(box);
    return { doc: doc, el: el, head: head, layer: layer, tbody: tbody };
  }

  function draw(api) {
    var S = api.state;
    var ui = S.ui;
    var doc = ui.doc;
    var g = ui.layer;
    var t = S.now;
    clear(g);
    STATIONS.forEach(function (name, i) {
      var x = X0 + i * DX;
      mk(doc, "path", { d: "M" + x + " 34V226", "class": "dg-axis" }, g);
      txt(doc, g, x, 22, name, "dg-note", "middle");
    });
    TRAINS.forEach(function (tr, r) {
      var y = 70 + r * 66;
      mk(doc, "path", { d: "M" + X0 + " " + y + "H" + (X0 + 6 * DX), "class": "dg-axis" }, g);
      txt(doc, g, 8, y - 12, tr.id + (tr.dir > 0 ? " down" : " up"), "dg-note", "start");
      var real = trueAt(tr.id, t);
      var b = S.board[tr.id];
      if (real >= 0) mk(doc, "circle", { cx: X0 + real * DX, cy: y, r: 11, fill: "none", "class": "dg-msg" }, g);
      if (b.pos >= 0) {
        var gg = mk(doc, "g", { "class": "dg-node st-" + (b.backSince !== null ? "bad" : (b.pos === real ? "ok" : "warn")) }, g);
        mk(doc, "circle", { cx: X0 + b.pos * DX, cy: y, r: 6 }, gg);
      }
      txt(doc, g, X0 + 3 * DX, y + 28, "really: " + stName(real) + "   board: " + stName(b.pos), "dg-axis", "middle");
    });
    clear(ui.tbody);
    TRAINS.forEach(function (tr) {
      var b = S.board[tr.id];
      var row = ui.el("tr");
      var moves = b.hist.map(function (h) { return clock(h.t) + " " + STATIONS[h.st] + (h.back ? " (backwards)" : ""); }).join(", ") || "none yet";
      [tr.id + ", " + tr.what, stName(trueAt(tr.id, t)), stName(b.pos), moves].forEach(function (c) { row.appendChild(ui.el("td", "", c)); });
      ui.tbody.appendChild(row);
    });
    ui.head.textContent = describe(S.C) + (S.done ? " Night over." : " Next board event: " +
      (S.k < S.R.length ? clock(S.R[S.k].t) : "01:40:00, end of the night") + ".");
    S.stat.applied(S.applied);
    S.stat.ignored(S.ignored);
    S.stat.back(S.back);
    S.stat.backfor(dur(S.backSec + openBack(S, t)));
    S.stat.look(S.look === null ? "not yet" : S.look);
    S.stat.lag(S.lag === null ? "none yet" : dur(S.lag));
    S.stat.consumers(S.C.consumers);
  }

  function openBack(S, t) {
    var s = 0;
    TRAINS.forEach(function (tr) { var b = S.board[tr.id]; if (b.backSince !== null) s += t - b.backSince; });
    return s;
  }

  /* ---------- the module ---------- */

  DL.sims.define("s4e14", {
    startClock: T0,
    speed: 0,
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { consumers: 2, rule: "arrival", retry: 245, win: 30 };
      S.ui = buildWidget(api);
      S.stat = {
        applied: api.stat("applied", "updates applied", ""),
        ignored: api.stat("ignored", "updates ignored", "ok"),
        back: api.stat("back", "trains shown going backwards", "bad"),
        backfor: api.stat("backfor", "shown backwards for", "bad"),
        look: api.stat("look", "2V08 on the board at 01:17:00", "warn"),
        lag: api.stat("lag", "board lag", ""),
        consumers: api.stat("consumers", "consumers", "")
      };
      S.ctl = {};
      S.ctl.next = api.control.button("next", "Next update", function () { S.playing = false; next(api); }, { tone: "primary" });
      S.ctl.play = api.control.button("play", "Play / pause", function () { S.playing = !S.playing && !S.done; });
      S.ctl.end = api.control.button("end", "Run to 01:40:00", function () { S.playing = false; runTo(api, END); });
      S.ctl.consumers = api.control.range("consumers", "Consumers reading the queue", 1, 3, 1, 2, function (v) {
        var x = Math.max(1, Math.min(3, Math.round(num(v))));
        if (!isFinite(x) || x === S.C.consumers) return;
        S.C.consumers = x;
        restart(api, "Consumers: " + x + ". They still take updates in the order they reached the queue.");
      });
      S.ctl.rule = api.control.select("rule", "Board's ordering rule", RULES, "arrival", function (v) {
        var ok = RULES.some(function (r) { return r.value === String(v); });
        if (!ok) return;
        S.C.rule = String(v);
        restart(api, "Rule changed.");
      });
      S.ctl.retry = api.control.range("retry", "Retry reaches the board after (s)", 30, 300, 5, 245, function (v) {
        var x = Math.max(30, Math.min(300, Math.round(num(v) / 5) * 5));
        if (!isFinite(x) || x === S.C.retry) return;
        S.C.retry = x;
        restart(api, "Retry delay: " + dur(x) + ".");
      });
      S.ctl.win = api.control.range("win", "Hold window (s), hold rule only", 0, 60, 5, 30, function (v) {
        var x = Math.max(0, Math.min(60, Math.round(num(v) / 5) * 5));
        if (!isFinite(x) || x === S.C.win) return;
        S.C.win = x;
        restart(api, "Hold window: " + x + " s.");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      api.info("<strong>How to read it.</strong> Each row is a train. The ring is where the train really is: the last station its sensor saw it pass. The dot is where the dispatch board shows it. Amber: the board is behind, as it always is for a few seconds. Red: the board has moved the train back to a station it already passed. Press Next update to step through the night, or Run to 01:40:00.");
      fresh(S);
      S.R = night(S.C);
      S.playing = false;
      S.now = T0;
      api.clock = T0;
      api.log("Night from 01:05:00. 18 updates for 3 trains: 2V08 and 6E19 down, 2T31 up. 6E19 waits in the Inchvoray loop. " + describe(S.C), "");
      draw(api);
    },

    step: function (api, dt) {
      var S = api.state;
      if (!S || !S.playing || S.done) return;
      var t = Math.min(END, S.now + dt * 60);
      runTo(api, t);
      if (S.done) S.playing = false;
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function night() {
        t.click("end");
        return { a: t.stat("applied"), i: t.stat("ignored"), b: t.stat("back"), f: t.stat("backfor"), l: t.stat("look"), g: t.stat("lag") };
      }

      // 1. The opening state: 01:05:00, before the first update.
      t.expect(t.stat("applied") === 0 && t.stat("ignored") === 0 && t.stat("back") === 0 && t.stat("backfor") === "0 s" &&
        t.stat("look") === "not yet" && t.stat("lag") === "none yet" && t.stat("consumers") === 2 &&
        t.api.clock === 3900 && has("18 updates for 3 trains"),
        "Opens at 01:05:00 with nothing applied, two consumers, arrival order");

      // 2. Step through: the failed delivery, B, then the retry of A puts 2V08 back at Kilmardy.
      for (var k = 0; k < 6; k++) t.click("next");
      t.expect(has("01:12:05 Kilmardy's sensor sends 2V08 at Kilmardy (sensor 01:12:05) and the send fails. The sensor retries; the retry reaches the board at 01:16:10.") &&
        has("2V08 at Drumlarach (sensor 01:15:40) arrives. Board had Tarvennan; now Drumlarach.") &&
        has("2V08 at Kilmardy (sensor 01:12:05, the retry) arrives. Board had Drumlarach; now Kilmardy. 2V08 is shown going backwards.") &&
        t.api.clock === 4570 && t.stat("back") === 1,
        "At 01:16:10 the retry of the 01:12:05 update moves 2V08 from Drumlarach back to Kilmardy");

      // 3. The whole night as built.
      var r = night();
      t.expect(r.a === 18 && r.i === 0 && r.b === 1 && r.f === "3 min 15 s" && r.l === "Kilmardy" && r.g === "5 s" &&
        has("End of the night. 18 applied, 0 ignored, 1 shown going backwards, for 3 min 15 s. At 01:17:00 the board showed 2V08 at Kilmardy."),
        "As built: 18 applied, 2V08 shown backwards for 3 min 15 s, and at 01:17:00 at Kilmardy");

      // 4. One consumer: the same order, the same backwards train.
      t.set("consumers", 1);
      r = night();
      t.expect(r.b === 1 && r.f === "3 min 15 s" && r.l === "Kilmardy" && t.stat("consumers") === 1,
        "One consumer: the retry still arrives after B, and 2V08 still goes backwards");

      // 5. The board's own clock stamp: the retry gets the latest stamp.
      t.set("consumers", 2);
      t.set("rule", "stamp");
      r = night();
      t.expect(r.b === 1 && r.l === "Kilmardy" && has("Stamped 01:16:10 by the board's clock, the latest stamp so far, so it goes last."),
        "The board's clock stamps the retry 01:16:10, the latest, and 2V08 still goes backwards");

      // 6. The sensor's time, older ignored: the senior answer.
      t.set("rule", "event");
      r = night();
      t.expect(r.a === 17 && r.i === 1 && r.b === 0 && r.f === "0 s" && r.l === "Drumlarach" && r.g === "5 s" &&
        has("2V08 at Kilmardy (sensor 01:12:05, the retry) arrives. Board shows Drumlarach. Older than 01:15:40, the last applied for 2V08: ignored."),
        "Sensor's time: the retry is older than 01:15:40 and ignored; 2V08 stays at Drumlarach");

      // 7. Per-sensor sequence numbers: two sensors, so the retry passes.
      t.set("rule", "seq");
      r = night();
      t.expect(r.b === 1 && r.i === 0 && r.l === "Kilmardy" &&
        has("Kilmardy #1; last applied from Kilmardy: none, so it passes."),
        "Sequence check per sensor: Kilmardy's #1 is newer than anything from Kilmardy, so 2V08 goes backwards");

      // 8. Hold and sort, 30 s: works, 35 s behind.
      t.set("rule", "hold");
      r = night();
      t.expect(r.a === 18 && r.b === 0 && r.l === "Drumlarach" && r.g === "35 s" &&
        has("2V08 at Drumlarach (sensor 01:15:40) arrives. Held until 01:16:15.") &&
        has("Applied 2V08 at Kilmardy (sensor 01:12:05, the retry). Released in sensor-time order. Board had Tarvennan; now Kilmardy."),
        "Hold 30 s: the retry lands inside B's window, both go at 01:16:15 in sensor order; lag 35 s");

      // 9. The window's edge: a retry at 250 s still fits, 255 s does not.
      t.set("retry", 250);
      var w250 = night().b;
      t.set("retry", 255);
      var w255 = night();
      t.expect(w250 === 0 && w255.b === 1 && w255.f === "3 min 5 s" && w255.l === "Kilmardy",
        "Hold 30 s: a 250 s retry is caught, a 255 s retry still sends 2V08 backwards");

      // 10. Arrival order with a short retry: 220 s arrives with B and goes first; 225 s does not.
      t.set("rule", "arrival");
      t.set("retry", 220);
      var a220 = night().b;
      t.set("retry", 225);
      t.expect(a220 === 0 && night().b === 1, "Arrival order: a retry of 220 s or less arrives before B, 225 s does not");

      // 11. The senior rule holds for any retry delay.
      t.set("rule", "event");
      t.set("retry", 300);
      r = night();
      t.expect(r.b === 0 && r.i === 1 && r.l === "Drumlarach", "Sensor's time: even a 300 s retry is ignored");
    }
  });
})();
