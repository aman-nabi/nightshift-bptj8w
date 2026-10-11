/* sims/s4e04-v1.0.0.js  (published as sims/s4e04.js)
   Case s4e04 "The River": a log lab for the Ardnish Dam control room. Sensor readings and gate
   commands share one Kafka topic, dam-events. The plant gateway sends both through one producer.
   The gate controller reads the topic as a consumer group (C1, C2, ...). The learner sets the key
   on gate commands (none, or the gate id), the partitions, the consumers in the group, whether a
   consumer commits its offset before or after applying a command, how far behind C5 runs, and
   whether gate commands travel through Kafka at all. Then steps through the night of 01:00:00 to
   the 06:00:00 morning check and reads the order the controller applied gate 3's two commands.
   Widget-style sim: it draws tables, two logs and gate 3's position inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: key none or gate id; partitions 1, 2, 3, 6, 12; consumers 1 to
     12; commit after or before the work; C5 behind by 0, 30, 140 or 300 s; commands through the
     Kafka topic or by a direct call; crash the consumer that reads the CLOSE; controller restart
     01:02:00 to 01:03:00. Buttons: Next event, Play to the morning check, Reset. Stats: gate 3 now,
     applied order, idle consumers, worst delay in seconds, commands never applied, gate commands
     kept in the topic, busiest consumer's load, gate 3 open during the night. selfTest: 12
     assertions.

   The model (stated in sim.lede):
   - The night runs from 01:00:00 (nothing waiting) to the morning check at 06:00:00. Gate 3 starts
     closed. Two commands from the operator's console: OPEN gate 3 to 40% at 01:01:40 and CLOSE gate
     3 at 01:02:15.
   - Sensor readings: 3,000 a second in all, spread evenly over the partitions (stated rate, the
     control room's own figure). A consumer applies at most 750 records a second (stated).
   - Assignment, as Kafka's range assignor does it: partitions in order, consumers in order; with
     P partitions and N consumers, each gets floor(P / N) and the first P mod N get one more. A
     consumer with none is idle.
   - A consumer's load is 3,000 / P x its partitions. If the load is over 750, it falls behind from
     01:00:00: a record produced t seconds after 01:00:00 is read at 01:00:00 + t x load / 750.
   - C5 runs on the old historian server and is behind by the lag control (140 s on the night),
     added to the read time of every record it reads.
   - No key: the gateway's producer sticks to one partition per batch of readings. The partitions
     it was filling when each command arrived are given data from the story: partition 4 at
     01:01:40, partition 1 at 01:02:15 (with P partitions: that number mod P).
   - Key = gate id: partition = toPositive(murmur2("gate-3")) mod P, Kafka's default for a keyed
     record (murmur2 checked against Kafka's own test values). "gate-3" goes to partition 0 of 1,
     0 of 2, 2 of 3, 2 of 6, 2 of 12.
   - Offsets: with 6 partitions (the real topic) partition p was at BASE6[p] at 01:00:00; any other
     count is a new topic starting at 0. A command produced t s after 01:00:00 takes offset
     base + (3,000 / P) x t.
   - Crash: the consumer that reads the CLOSE crashes just after reading it and is back 30 s later.
     Commit before the work: its offset was already past the CLOSE, so it is never applied. Commit
     after: it reads the CLOSE again and applies it then.
   - Controller restart 01:02:00 to 01:03:00: through Kafka, a command due then waits in the topic
     and is applied at 01:03:00. By direct call, a call then is refused and nothing keeps it.
   - Direct call: commands skip Kafka and are applied when sent; the topic keeps none of them.

   Where every number comes from (conventions rule 14; the case is content/s4/s4e04-v1.0.0.json):
   - The night (no key, 6 partitions, 8 consumers, commit after, C5 140 s behind): C1 to C6 read
     partitions 0 to 5, C7 and C8 idle (2). Each partition 500 a second, each consumer 500 of 750.
     OPEN: partition 4, offset 88,402,644 + 500 x 100 = 88,452,644, read by C5 at 01:01:40 + 140 s
     = 01:04:00. CLOSE: partition 1, offset 88,409,551 + 500 x 135 = 88,477,051, read by C2 at
     01:02:15. Applied order CLOSE, OPEN. Worst delay 140 s. Gate 3 open 01:04:00 to 06:00:00,
     4 h 56 min. The brief's "2 minutes behind" with OPEN at 01:01 would apply it at 01:03, not
     01:04; the case moves OPEN to 01:01:40 and the lag to 2 min 20 s so the story's minutes
     (01:01, 01:02, 01:02, 01:04) all hold.
   - 12 consumers: C7 to C12 idle (6), the same order and result.
   - One partition: 3,000 a second on C1, 3,000 of 750, 4 times its pace: falls 3 s further behind
     every second. OPEN read at 01:00:00 + 100 x 4 = 01:06:40, CLOSE at 135 x 4 = 540 s, 01:09:00.
     In order; worst delay 540 - 135 = 405 s. Gate 3 open 01:06:40 to 01:09:00, 2 min 20 s. A
     command sent at 02:00:00 would be read at 01:00:00 + 3,600 x 4 = 05:00:00. 7 consumers idle.
     A new topic: offsets 3,000 x 100 = 300,000 and 3,000 x 135 = 405,000.
   - Key = gate id, 6 consumers: gate-3 on partition 2 (C3), offsets 88,465,870 and 88,483,370.
     OPEN 01:01:40, CLOSE 01:02:15, open 35 s, idle 0, worst 0.
   - Crash, commit after: C3 back at 01:02:45, CLOSE applied then; open 65 s, "1 min 5 s".
     Commit before: CLOSE never applied, 1 lost, gate 3 40% open from 01:01:40 to 06:00:00,
     17,900 s, "4 h 58 min".
   - Controller restart, Kafka, keyed: CLOSE waits, applied 01:03:00; open 80 s, "1 min 20 s".
   - Direct call: OPEN 01:01:40, CLOSE 01:02:15, 0 commands in the topic, open 35 s. With the
     controller restart: CLOSE refused at 01:02:15, 1 lost, 40% open, "4 h 58 min".
   - No key, C5 not behind (lag 0): OPEN 01:01:40, CLOSE 01:02:15, in order by luck.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var T0 = 3600;            // 01:00:00
  var MORNING = 21600;      // 06:00:00
  var DOWN_FROM = 3720;     // controller restart 01:02:00
  var DOWN_TO = 3780;       // to 01:03:00
  var BACK_AFTER = 30;      // a crashed consumer is back 30 s later
  var RATE = 3000;          // sensor readings a second, whole topic
  var CAP = 750;            // records a second one consumer can apply
  var SLOW = 5;             // C5, on the old historian server
  var BASE6 = [88413020, 88409551, 88415870, 88411302, 88402644, 88417109];
  var STICKY = { 3700: 4, 3735: 1 };
  var PARTS = [1, 2, 3, 6, 12];
  var LAGS = [0, 30, 140, 300];
  var CMDS = [
    { name: "OPEN", text: "OPEN gate 3 to 40%", t: 3700, pos: 40 },
    { name: "CLOSE", text: "CLOSE gate 3", t: 3735, pos: 0 }
  ];

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hms(s) {
    s = Math.round(s);
    return two(Math.floor(s / 3600) % 24) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60);
  }
  function dur(s) {
    s = Math.round(s);
    if (s >= 3600) return Math.floor(s / 3600) + " h " + Math.floor((s % 3600) / 60) + " min";
    if (s >= 60) return Math.floor(s / 60) + " min" + (s % 60 ? " " + (s % 60) + " s" : "");
    return s + " s";
  }
  function posText(p) { return p > 0 ? p + "% open" : "closed"; }
  function cname(i) { return "C" + (i + 1); }

  // Kafka's Utils.murmur2 over the key's bytes (ASCII keys, so bytes are char codes).
  function murmur2(str) {
    var len = str.length;
    var m = 0x5bd1e995;
    var h = (0x9747b28c ^ len) | 0;
    var n4 = len >> 2;
    var i;
    for (i = 0; i < n4; i++) {
      var j = i * 4;
      var k = (str.charCodeAt(j) & 0xff) | ((str.charCodeAt(j + 1) & 0xff) << 8) |
        ((str.charCodeAt(j + 2) & 0xff) << 16) | ((str.charCodeAt(j + 3) & 0xff) << 24);
      k = Math.imul(k, m);
      k ^= k >>> 24;
      k = Math.imul(k, m);
      h = Math.imul(h, m);
      h ^= k;
    }
    var r = n4 * 4;
    var left = len % 4;
    if (left === 3) h ^= (str.charCodeAt(r + 2) & 0xff) << 16;
    if (left >= 2) h ^= (str.charCodeAt(r + 1) & 0xff) << 8;
    if (left >= 1) { h ^= str.charCodeAt(r) & 0xff; h = Math.imul(h, m); }
    h ^= h >>> 13;
    h = Math.imul(h, m);
    h ^= h >>> 15;
    return h | 0;
  }

  /* ---------- the model (pure: config in, the night out) ---------- */

  function assign(P, N) {
    var owner = [];
    var per = Math.floor(P / N);
    var extra = P % N;
    var p = 0;
    var counts = [];
    for (var i = 0; i < N; i++) {
      var c = per + (i < extra ? 1 : 0);
      counts.push(c);
      for (var k = 0; k < c; k++) owner[p++] = i;
    }
    return { owner: owner, counts: counts };
  }

  function partitionOf(C, cmd) {
    if (C.key === "gate") return (murmur2("gate-3") & 0x7fffffff) % C.P;
    return STICKY[cmd.t] % C.P;
  }

  function night(C) {
    var as = assign(C.P, C.N);
    var perPart = RATE / C.P;
    var loads = as.counts.map(function (c) { return perPart * c; });
    var idle = as.counts.filter(function (c) { return c === 0; }).length;
    var busiest = 0;
    loads.forEach(function (l, i) { if (l > loads[busiest]) busiest = i; });
    var ev = [];
    var applied = [];
    var lost = 0;
    var inlog = 0;
    CMDS.forEach(function (cmd, ci) {
      if (C.path === "direct") {
        ev.push({ at: cmd.t, ord: ci * 10, kind: "produce", cmd: cmd,
          msg: "Console calls the controller directly: " + cmd.text + ", " + hms(cmd.t) + "." });
        if (C.down && cmd.t >= DOWN_FROM && cmd.t < DOWN_TO) {
          lost += 1;
          ev.push({ at: cmd.t, ord: ci * 10 + 1, kind: "lost", cmd: cmd, tone: "bad",
            msg: "The call " + cmd.text + " at " + hms(cmd.t) + " is refused: the controller is restarting. Nothing keeps it." });
        } else {
          ev.push({ at: cmd.t, ord: ci * 10 + 1, kind: "apply", cmd: cmd, delay: 0,
            msg: "Controller applies " + cmd.text + " at " + hms(cmd.t) + ", by direct call." });
        }
        return;
      }
      var p = partitionOf(C, cmd);
      var ci2 = as.owner[p];
      var base = C.P === 6 ? BASE6[p] : 0;
      var off = base + perPart * (cmd.t - T0);
      inlog += 1;
      ev.push({ at: cmd.t, ord: ci * 10, kind: "produce", cmd: cmd, p: p, off: off,
        msg: "Kafka record: " + cmd.text + ", produced " + hms(cmd.t) + ", key " + (C.key === "gate" ? "gate-3" : "null") +
          ", partition " + p + ", offset " + fmt(off) + "." });
      var factor = Math.max(1, loads[ci2] / CAP);
      var read = T0 + (cmd.t - T0) * factor + (ci2 + 1 === SLOW ? C.lag : 0);
      var at = read;
      var note = "";
      if (C.crash && cmd.name === "CLOSE") {
        ev.push({ at: read, ord: ci * 10 + 1, kind: "crash", tone: "bad",
          msg: cname(ci2) + " crashes at " + hms(read) + " just after reading " + cmd.text + " at offset " + fmt(off) +
            (C.commit === "before" ? ", its offset already committed past it." : ", before committing it.") });
        if (C.commit === "before") {
          lost += 1;
          ev.push({ at: read + BACK_AFTER, ord: ci * 10 + 2, kind: "lost", cmd: cmd, tone: "bad",
            msg: cname(ci2) + " is back at " + hms(read + BACK_AFTER) + " and resumes after offset " + fmt(off) + ": " + cmd.text + " is never applied." });
          return;
        }
        at = read + BACK_AFTER;
        ev.push({ at: at, ord: ci * 10 + 2, kind: "restart",
          msg: cname(ci2) + " is back at " + hms(at) + " and reads " + cmd.text + " again from offset " + fmt(off) + "." });
      }
      if (C.down && at >= DOWN_FROM && at < DOWN_TO) {
        at = DOWN_TO;
        note = " It waited in the topic while the controller restarted.";
      }
      ev.push({ at: at, ord: ci * 10 + 3, kind: "apply", cmd: cmd, delay: at - cmd.t,
        msg: "Controller applies " + cmd.text + " (produced " + hms(cmd.t) + ") at " + hms(at) + ", from partition " + p + " via " + cname(ci2) + "." + note });
    });
    if (C.down) ev.push({ at: DOWN_FROM, ord: 5, kind: "down", tone: "warn", msg: "Controller restarting, 01:02:00 to 01:03:00." });
    ev.sort(function (a, b) { return (a.at - b.at) || (a.ord - b.ord); });
    ev.forEach(function (e) { if (e.kind === "apply") applied.push(e); });
    return { as: as, loads: loads, idle: idle, busiest: busiest, ev: ev, lost: lost, inlog: inlog, perPart: perPart };
  }

  // Gate 3's position over the night, from the applied commands in the order applied.
  function segments(applied) {
    var segs = [];
    var pos = 0;
    var from = T0;
    applied.forEach(function (e) {
      if (e.cmd.pos !== pos) {
        segs.push([from, e.at, pos]);
        from = e.at;
        pos = e.cmd.pos;
      }
    });
    segs.push([from, MORNING, pos]);
    return segs;
  }
  function openTime(segs, upto) {
    var s = 0;
    segs.forEach(function (g) { if (g[2] > 0) s += Math.max(0, Math.min(g[1], upto) - g[0]); });
    return s;
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
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
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;font-size:12px;");
    var head = el("p", "margin:0;");
    var table = el("table", "width:100%;");
    var hr = el("tr");
    ["partition", "read by", "readings a second", "behind", "gate 3 commands (offset)"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    var idleP = el("p", "margin:0;");
    var logs = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;");
    var kBox = el("div");
    kBox.appendChild(el("strong", "", "Kafka records, in produce order"));
    var kList = el("ol", "margin:4px 0 0 18px;padding:0;");
    kBox.appendChild(kList);
    var aBox = el("div");
    aBox.appendChild(el("strong", "", "Controller apply log, in applied order"));
    var aList = el("ol", "margin:4px 0 0 18px;padding:0;");
    aBox.appendChild(aList);
    logs.appendChild(kBox);
    logs.appendChild(aBox);
    var svg = mk(doc, "svg", { viewBox: "0 0 660 96", width: "100%", "class": "dg", role: "img",
      "aria-label": "Gate 3's position from 01:00:00 to 01:10:00, one pixel a second. Red is open, grey closed. The note on the right gives its position at the 06:00:00 morning check." });
    var g = mk(doc, "g", {}, svg);
    box.appendChild(head);
    box.appendChild(table);
    box.appendChild(idleP);
    box.appendChild(logs);
    box.appendChild(svg);
    api.root.appendChild(box);
    return { doc: doc, el: el, head: head, tbody: tbody, idleP: idleP, kList: kList, aList: aList, g: g };
  }

  function drawGate(S) {
    var ui = S.ui;
    var doc = ui.doc;
    var g = ui.g;
    clear(g);
    var x0 = 20;
    var segs = segments(S.applied);
    var now = S.now;
    function txt(x, y, s, cls, anchor) {
      var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" }, g);
      t.textContent = s;
    }
    txt(x0, 16, "Gate 3 position, 01:00 to 01:10", "dg-note");
    mk(doc, "rect", { x: x0, y: 28, width: 600, height: 22, fill: "none", "class": "dg-axis", stroke: "currentColor" }, g);
    segs.forEach(function (s) {
      var a = Math.max(s[0], T0);
      var b = Math.min(s[1], now, T0 + 600);
      if (b <= a) return;
      var cls = s[2] > 0 ? "dg-node st-bad" : "dg-node st-muted";
      var gg = mk(doc, "g", { "class": cls }, g);
      mk(doc, "rect", { x: x0 + (a - T0), y: 29, width: b - a, height: 20 }, gg);
    });
    for (var m = 0; m <= 10; m += 2) txt(x0 + m * 60, 68, "01:" + two(m), "dg-axis", "middle");
    var last = segs.filter(function (s) { return s[0] <= now; });
    var cur = last.length ? last[last.length - 1][2] : 0;
    txt(x0 + 600, 88, (S.done ? "06:00 morning check: " : "now: ") + posText(cur), S.done && cur > 0 ? "dg-note tone-bad" : "dg-note", "end");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = S.R;
    var ui = S.ui;
    var el = ui.el;
    ui.head.textContent = "Topic dam-events: " + C.P + (C.P === 1 ? " partition" : " partitions") + ", " + C.N + " consumers. Gate commands: " +
      (C.path === "direct" ? "direct call to the controller, outside Kafka." : (C.key === "gate" ? "key = gate id" : "no key") + ", commit " + C.commit + " the work.") +
      " Clock " + hms(S.now) + ".";
    clear(ui.tbody);
    for (var p = 0; p < C.P; p++) {
      var tr = el("tr");
      var ci = R.as.owner[p];
      var cmds = [];
      S.fired.forEach(function (e) { if (e.kind === "produce" && e.p === p) cmds.push(e.cmd.name + " (" + fmt(e.off) + ")"); });
      var behind = ci + 1 === SLOW && C.lag ? C.lag + " s" : "0 s";
      if (R.loads[ci] > CAP) behind = "growing";
      [String(p), cname(ci), fmt(R.perPart), behind, cmds.join(", ") || "-"].forEach(function (c) { tr.appendChild(el("td", "", c)); });
      ui.tbody.appendChild(tr);
    }
    var idleNames = [];
    R.as.counts.forEach(function (c, i) { if (c === 0) idleNames.push(cname(i)); });
    ui.idleP.textContent = idleNames.length ? "Idle consumers (no partition to read): " + idleNames.join(", ") + "." : "No idle consumers.";
    clear(ui.kList);
    clear(ui.aList);
    S.fired.forEach(function (e) {
      if (e.kind === "produce" && C.path !== "direct") ui.kList.appendChild(el("li", "", hms(e.at) + "  p" + e.p + "  " + fmt(e.off) + "  " + e.cmd.text));
      if (e.kind === "apply") ui.aList.appendChild(el("li", "", hms(e.at) + "  " + e.cmd.text));
    });
    if (!ui.kList.firstChild) ui.kList.appendChild(el("li", "list-style:none;", C.path === "direct" ? "(no gate commands in the topic)" : "(none yet)"));
    if (!ui.aList.firstChild) ui.aList.appendChild(el("li", "list-style:none;", "(none yet)"));
    drawGate(S);

    var pos = 0;
    S.applied.forEach(function (e) { pos = e.cmd.pos; });
    var worst = 0;
    S.applied.forEach(function (e) { if (e.delay > worst) worst = e.delay; });
    var lost = S.fired.filter(function (e) { return e.kind === "lost"; }).length;
    S.stat.gate3(posText(pos));
    S.stat.order(S.applied.length ? S.applied.map(function (e) { return e.cmd.name; }).join(", ") : "none yet");
    S.stat.idle(R.idle);
    S.stat.worst(Math.round(worst));
    S.stat.lost(lost);
    S.stat.inlog(S.fired.filter(function (e) { return e.kind === "produce" && C.path !== "direct"; }).length);
    S.stat.load(fmt(R.loads[R.busiest]) + " of " + CAP + " a second");
    S.stat.open(S.done ? dur(openTime(segments(S.applied), MORNING)) : "not yet");
    S.ctl.next.disable(S.done);
  }

  /* ---------- running the night ---------- */

  function describe(C, R) {
    var idleNames = [];
    R.as.counts.forEach(function (c, i) { if (c === 0) idleNames.push(cname(i)); });
    var s = "Topic dam-events: " + C.P + (C.P === 1 ? " partition, " : " partitions, ") + C.N + " consumers" +
      (idleNames.length ? " (" + idleNames.join(", ") + " idle)" : "") + ", " +
      (C.path === "direct" ? "gate commands by direct call" : (C.key === "gate" ? "key = gate id" : "no key") + ", commit " + C.commit + " the work") +
      ", C5 " + C.lag + " s behind.";
    var b = R.busiest;
    if (R.loads[b] > CAP) {
      var f = R.loads[b] / CAP;
      s += " " + cname(b) + " reads " + fmt(R.loads[b]) + " readings a second and applies " + CAP + ": it falls " +
        (Math.round((f - 1) * 100) / 100) + " s further behind every second. A command sent at 02:00:00 would be read at " + hms(T0 + 3600 * f) + ".";
    }
    return s;
  }

  function restart(api, why) {
    var S = api.state;
    S.R = night(S.C);
    S.fired = [];
    S.applied = [];
    S.k = 0;
    S.done = false;
    S.now = T0;
    api.clock = T0;
    api.log((why ? why + " " : "") + "Night from 01:00:00. " + describe(S.C, S.R), "");
    draw(api);
  }

  function fire(api, e) {
    var S = api.state;
    var pos = 0;
    S.applied.forEach(function (a) { pos = a.cmd.pos; });
    S.now = e.at;
    api.clock = e.at;
    var tone = e.tone || "";
    var msg = e.msg;
    if (e.kind === "apply") {
      msg += " Gate 3 was " + posText(pos) + ".";
      S.applied.push(e);
      tone = e.delay > 0 ? "warn" : "ok";
    }
    S.fired.push(e);
    api.log(msg, tone);
  }

  function finish(api) {
    var S = api.state;
    S.now = MORNING;
    api.clock = MORNING;
    S.done = true;
    var pos = 0;
    S.applied.forEach(function (a) { pos = a.cmd.pos; });
    var order = S.applied.map(function (a) { return a.cmd.name; }).join(", ") || "nothing";
    api.log("06:00:00 morning check: gate 3 is " + posText(pos) + ". Applied order: " + order + ". Gate 3 was open " +
      dur(openTime(segments(S.applied), MORNING)) + " of the night.", pos > 0 ? "bad" : "ok");
  }

  function next(api) {
    var S = api.state;
    if (S.done) return;
    if (S.k < S.R.ev.length) fire(api, S.R.ev[S.k++]);
    else finish(api);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s4e04", {
    startClock: T0,
    speed: 0,
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { key: "none", P: 6, N: 8, commit: "after", lag: 140, path: "kafka", crash: false, down: false };
      S.ui = buildWidget(api);
      S.ctl = {};
      function change(why) { restart(api, why); }
      S.ctl.next = api.control.button("next", "Next event", function () { next(api); }, { tone: "primary" });
      S.ctl.play = api.control.button("play", "Play to the morning check", function () {
        var guard = 0;
        while (!S.done && guard++ < 50) next(api);
      });
      S.ctl.key = api.control.select("key", "Key on gate commands", [{ value: "none", label: "None (null)" }, { value: "gate", label: "Gate id" }], "none", function (v) {
        S.C.key = String(v) === "gate" ? "gate" : "none";
        change("Key: " + (S.C.key === "gate" ? "gate id." : "none."));
      });
      S.ctl.partitions = api.control.select("partitions", "Partitions in dam-events", PARTS.map(function (p) { return { value: p, label: String(p) }; }), 6, function (v) {
        var x = Number(v);
        if (PARTS.indexOf(x) < 0) return;
        S.C.P = x;
        change("Partitions: " + x + ".");
      });
      S.ctl.consumers = api.control.range("consumers", "Consumers in the group", 1, 12, 1, 8, function (v) {
        var x = Math.max(1, Math.min(12, Math.round(Number(v))));
        if (!isFinite(x) || x === S.C.N) return;
        S.C.N = x;
        change("Consumers: " + x + ".");
      });
      S.ctl.commit = api.control.select("commit", "Commit the offset", [{ value: "after", label: "After applying" }, { value: "before", label: "Before applying" }], "after", function (v) {
        S.C.commit = String(v) === "before" ? "before" : "after";
        change("Commit " + S.C.commit + " the work.");
      });
      S.ctl.lag = api.control.select("lag", "C5 behind by (s)", LAGS.map(function (l) { return { value: l, label: String(l) }; }), 140, function (v) {
        var x = Number(v);
        if (LAGS.indexOf(x) < 0) return;
        S.C.lag = x;
        change("C5 behind by " + x + " s.");
      });
      S.ctl.path = api.control.select("path", "Gate commands travel", [{ value: "kafka", label: "Through the Kafka topic" }, { value: "direct", label: "By direct call" }], "kafka", function (v) {
        S.C.path = String(v) === "direct" ? "direct" : "kafka";
        change(S.C.path === "direct" ? "Gate commands by direct call." : "Gate commands through the topic.");
      });
      S.ctl.crash = api.control.toggle("crash", "Crash the consumer that reads the CLOSE", false, function (on) {
        S.C.crash = !!on;
        change("Crash on CLOSE: " + (on ? "on." : "off.") + (S.C.path === "direct" ? " No consumer reads a direct call." : ""));
      });
      S.ctl.down = api.control.toggle("down", "Controller restarts 01:02:00 to 01:03:00", false, function (on) {
        S.C.down = !!on;
        change("Controller restart: " + (on ? "on." : "off."));
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        gate3: api.stat("gate3", "gate 3 now", "bad"),
        order: api.stat("order", "applied order", ""),
        idle: api.stat("idle", "idle consumers", "warn"),
        worst: api.stat("worst", "worst delay, seconds", "warn"),
        lost: api.stat("lost", "commands never applied", "bad"),
        inlog: api.stat("inlog", "gate commands kept in the topic", ""),
        load: api.stat("load", "busiest consumer's load", ""),
        open: api.stat("open", "gate 3 open, 01:00 to 06:00", "bad")
      };
      api.info("<strong>How to read it.</strong> Each row is a partition of dam-events and the consumer that reads it. A record's offset is its place in its partition. The left list is the topic, in the order records were produced; the right list is the controller's apply log, in the order it applied them. Press Next event to step through the night, or Play to run to the morning check.");
      restart(api, "");
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      function play() { t.click("play"); }

      // 1. Opening: 01:00:00, nothing produced or applied.
      t.expect(t.stat("gate3") === "closed" && t.stat("order") === "none yet" && t.stat("idle") === 2 && t.stat("worst") === 0 &&
        t.stat("lost") === 0 && t.stat("inlog") === 0 && t.stat("load") === "500 of 750 a second" && t.stat("open") === "not yet" &&
        t.logText().indexOf("6 partitions, 8 consumers (C7, C8 idle), no key, commit after the work, C5 140 s behind.") >= 0,
        "Opens at 01:00:00: gate 3 closed, 6 partitions, 8 consumers, C7 and C8 idle");

      // 2. Step through the night: both logs as in the story.
      begin();
      t.click("next");
      t.click("next");
      var kafka = has("Kafka record: OPEN gate 3 to 40%, produced 01:01:40, key null, partition 4, offset 88,452,644.") &&
        has("Kafka record: CLOSE gate 3, produced 01:02:15, key null, partition 1, offset 88,477,051.");
      t.click("next");
      t.click("next");
      t.expect(kafka && has("Controller applies CLOSE gate 3 (produced 01:02:15) at 01:02:15, from partition 1 via C2. Gate 3 was closed.") &&
        has("Controller applies OPEN gate 3 to 40% (produced 01:01:40) at 01:04:00, from partition 4 via C5. Gate 3 was closed.") &&
        t.stat("order") === "CLOSE, OPEN" && t.stat("worst") === 140 && t.stat("inlog") === 2,
        "The night: produced OPEN 01:01:40 (p4), CLOSE 01:02:15 (p1); applied CLOSE 01:02:15, OPEN 01:04:00");
      t.click("next");
      t.expect(has("06:00:00 morning check: gate 3 is 40% open. Applied order: CLOSE, OPEN. Gate 3 was open 4 h 56 min of the night.") &&
        t.stat("gate3") === "40% open" && t.stat("open") === "4 h 56 min",
        "Morning check: gate 3 still 40% open, open 4 h 56 min");

      // 3. More consumers: six idle, nothing changes.
      begin();
      t.set("consumers", 12);
      play();
      t.expect(t.stat("idle") === 6 && t.stat("order") === "CLOSE, OPEN" && t.stat("gate3") === "40% open" && has("C7, C8, C9, C10, C11, C12 idle"),
        "12 consumers on 6 partitions: 6 idle, same wrong order");

      // 4. One partition: in order, and far behind.
      begin();
      t.set("consumers", 8);
      t.set("partitions", 1);
      play();
      t.expect(t.stat("idle") === 7 && t.stat("order") === "OPEN, CLOSE" && t.stat("gate3") === "closed" && t.stat("worst") === 405 &&
        t.stat("load") === "3,000 of 750 a second" && t.stat("open") === "2 min 20 s" &&
        has("it falls 3 s further behind every second. A command sent at 02:00:00 would be read at 05:00:00.") &&
        has("at 01:06:40, from partition 0 via C1") && has("at 01:09:00, from partition 0 via C1"),
        "One partition: in order, but C1 carries 3,000 a second against 750 and a 02:00 command waits until 05:00");

      // 5. Key by gate id, six consumers: same partition, in order, prompt.
      begin();
      t.set("partitions", 6);
      t.set("consumers", 6);
      t.set("key", "gate");
      play();
      t.expect(t.stat("idle") === 0 && t.stat("order") === "OPEN, CLOSE" && t.stat("gate3") === "closed" && t.stat("worst") === 0 &&
        t.stat("open") === "35 s" && has("key gate-3, partition 2, offset 88,465,870.") && has("key gate-3, partition 2, offset 88,483,370.") &&
        has("from partition 2 via C3"),
        "Keyed by gate id: both commands on partition 2, applied in order, gate 3 open 35 s");

      // 6. Crash on the CLOSE, commit after: read again 30 s later.
      begin();
      t.click("crash");
      play();
      t.expect(has("C3 is back at 01:02:45 and reads CLOSE gate 3 again from offset 88,483,370.") && t.stat("gate3") === "closed" &&
        t.stat("open") === "1 min 5 s" && t.stat("lost") === 0,
        "Crash with commit after: the CLOSE is read again at 01:02:45");

      // 7. Crash on the CLOSE, commit before: lost.
      begin();
      t.set("commit", "before");
      play();
      t.expect(has("resumes after offset 88,483,370: CLOSE gate 3 is never applied.") && t.stat("lost") === 1 &&
        t.stat("gate3") === "40% open" && t.stat("open") === "4 h 58 min",
        "Crash with commit before: the CLOSE is never applied, gate 3 open 4 h 58 min");

      // 8. Controller restart through Kafka: the CLOSE waits in the topic.
      begin();
      t.set("commit", "after");
      t.click("crash");
      t.click("down");
      play();
      t.expect(has("at 01:03:00, from partition 2 via C3. It waited in the topic while the controller restarted.") &&
        t.stat("gate3") === "closed" && t.stat("open") === "1 min 20 s",
        "Controller restart through Kafka: the CLOSE waits and is applied at 01:03:00");

      // 9. Direct call during the restart: refused, nothing keeps it.
      begin();
      t.set("path", "direct");
      play();
      t.expect(has("The call CLOSE gate 3 at 01:02:15 is refused: the controller is restarting. Nothing keeps it.") &&
        t.stat("lost") === 1 && t.stat("inlog") === 0 && t.stat("gate3") === "40% open",
        "Direct call during the restart: the CLOSE is refused and lost");

      // 10. Direct call on a quiet night: in order, nothing in the topic.
      begin();
      t.click("down");
      play();
      t.expect(t.stat("order") === "OPEN, CLOSE" && t.stat("open") === "35 s" && t.stat("inlog") === 0 && t.stat("lost") === 0,
        "Direct call: in order, gate 3 open 35 s, no gate commands in the topic");

      // 11. Back to the night's setup but with C5 not behind: right order by luck alone.
      begin();
      t.set("path", "kafka");
      t.set("key", "none");
      t.set("consumers", 8);
      t.set("lag", 0);
      play();
      t.expect(t.stat("order") === "OPEN, CLOSE" && t.stat("idle") === 2 && has("at 01:02:15, from partition 1 via C2") && has("at 01:01:40, from partition 4 via C5"),
        "No key and no lag: the commands still sit on partitions 4 and 1, and come out in order only because both are prompt");
    }
  });
})();
