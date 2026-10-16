/* sims/w02-v1.0.0.js  (published as sims/w02.js)
   workshop case w02, "The Turnstile's Memory": a workbench for the turnstile at Dipperwell, a pool.
   the card reader remembers its last members in a memory (a cache) and asks the slow online
   system about any card it doesn't hold. friday's 06:00 rush of 100 swimmers is replayed one
   swipe at a time through the design you pick, with a queue chart and a table of swipes.
   a widget sim: it draws its own chart and table inside api.root.

   changelog
   v1.0.0 (2026-10-16) first version: design (no memory, plain list as built, plain list on the
     faster chip, count and sort, map with two-way links), entries kept (500, 1,000, 2,000,
     5,000, 10,000), step, play the rush, reset. stats: swipes done, found in memory, the
     dashboard's percentage, what a found swipe takes, steps in a found swipe, longest wait,
     queue at 05:58:00, last swimmer through. selfTest: 11 assertions.

   the model (stated in sim.lede):
   - the rush: swimmer k (1 to 100) reaches the turnstile at 05:55:00 + 2 s x (k - 1), so the
     last at 05:58:18. one swipe at a time; the others queue in arrival order.
   - each swimmer's place in the use-ordered list at the moment of the swipe (from the online
     system's records, given data): swimmer 40 joined on thursday and is in no list; swimmers
     5, 10, ... 100 other than 40 sit at places 600, 830, 1,060 ... 4,740 (600 + 230 j); every
     other swimmer k sits at place 180 + 3k (183 to 477). a card is found when its place is
     within the entries kept. so 80 are within 500, 82 within 1,000, 87 within 2,000, 99 within
     5,000 and 10,000. a use-ordered list of any size holds exactly the first places, so one
     list of places serves every size.
   - the list is full at every size picked.
   - one step (reading, moving or changing one entry, link or map slot on the chip) takes
     0.24 ms; 0.12 ms on the faster chip. asking the online system takes 0.8 s.
   - plain list (as built, and on the faster chip): a found card reads p entries, the n - p
     behind it shift up, and putting it at the front shifts n - 1 and writes 1: 2n steps,
     wherever it was. a card not found reads all n, the last is dropped, and the front insert
     is n steps again: 2n steps plus 0.8 s.
   - count and sort: the sort reads every entry and writes every entry back, 2n steps; its walk
     to the card is left out, so the times are the least it could take.
   - map with two-way links: found, 1 map look-up + 2 link changes to lift the entry out + 3 to
     tie it in at the front = 6 steps. not found: 1 look-up + 3 to untie the back entry and take
     it out of the map + 3 to tie the new card in + 1 to add it to the map = 8 steps, plus 0.8 s.
   - no memory: every swipe asks the online system, 0.8 s.

   where every number comes from (conventions rule 14; the case is content/s5/w02-v1.0.0.json).
   all of these come out of the model above and are checked by the selfTest.
   - plain list, 5,000: found swipe 2 x 5,000 x 0.24 ms = 2.4 s; not found 2.4 s + 0.8 s = 3.2 s.
     a swipe ends 0.4 s further behind its arrival each time: swimmer 75 (card 51884) queued
     at 05:57:28 and began at 05:57:58.4 after 30.4 s; 76 (10527) 05:57:30, 05:58:00.8; 77
     (46203) 05:57:32, 05:58:03.2; 78 (27719) 05:57:34, 05:58:05.6. swimmer 91 (Mrs Wojtyna)
     queued at 05:58:00, began at 05:58:36.8 after 36.8 s, through at 05:58:39.2. at 05:58:00,
     91 had arrived and 75 had begun: 16 queueing. swimmer 100 waited 40.4 s; through at
     05:59:00.8. 99 of 100 found: 99%.
   - plain list, 1,000: found swipe 0.48 s; 82 found. 10,000: 4.8 s.
   - plain list, 500: found 0.24 s, not found 1.04 s; 80 found (80%); no queue (both under 2 s).
   - faster chip, 5,000: found 1.2 s, no queue. faster chip, 10,000: 2.4 s again, 16 queueing
     at 05:58:00, longest wait 40.4 s.
   - count and sort, 5,000: at least 2.4 s; 16 queueing at 05:58:00.
   - map with links: found 6 steps = 1.44 ms, not found 8 steps + 0.8 s = 801.92 ms (shown as
     0.8 s); no queue; last swimmer through at 05:58:18.0.
   - no memory: 0.8 s every swipe, no queue, 0 found.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (times in microseconds) ---------- */

  var SEC = 1000000;
  var T0 = (5 * 3600 + 55 * 60) * SEC;   // 05:55:00, the first swimmer
  var OPEN = T0 - 60 * SEC;              // the replay opens at 05:54:00
  var T558 = 180 * SEC;                  // 05:58:00, as time after T0
  var GAP = 2 * SEC;
  var N = 100;
  var NEWBIE = 40;
  var ONLINE = 800000;                   // 0.8 s
  var STEP = 240;                        // 0.24 ms
  var FAST = 120;                        // 0.12 ms on the faster chip
  var CARDS = { 75: "51884", 76: "10527", 77: "46203", 78: "27719" };

  var DESIGNS = [
    { value: "plain", label: "plain list, as built" },
    { value: "none", label: "no memory (before the work order)" },
    { value: "chip", label: "plain list on the faster chip" },
    { value: "sort", label: "count swipes and sort every time" },
    { value: "map", label: "map with two-way links" }
  ];
  var SHORT = {
    plain: "plain list", none: "no memory", chip: "plain list on the faster chip",
    sort: "count and sort", map: "map with two-way links"
  };
  var CAPS = [500, 1000, 2000, 5000, 10000];

  /* ---------- helpers ---------- */

  function pad(n, w) { var s = String(n); while (s.length < (w || 2)) s = "0" + s; return s; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function trim(s) { return s.indexOf(".") >= 0 ? s.replace(/0+$/, "").replace(/\.$/, "") : s; }
  function clock(us) {                     // us after T0, shown to a tenth of a second
    var tenths = Math.round((T0 + us) / 100000);
    var h = Math.floor(tenths / 36000), m = Math.floor(tenths / 600) % 60, s = Math.floor(tenths / 10) % 60;
    return pad(h) + ":" + pad(m) + ":" + pad(s) + "." + (tenths % 10);
  }
  function dur(us) {
    var ms = us / 1000;
    return ms < 100 ? trim(ms.toFixed(2)) + " ms" : trim((ms / 1000).toFixed(2)) + " s";
  }
  function waitText(us) { return trim((us / SEC).toFixed(1)) + " s"; }
  function card(k) { return CARDS[k] || String(10000 + ((k * 7919 + 3301) % 89990)); }
  function place(k) {                      // place in the use-ordered list; 0 = in no list
    if (k === NEWBIE) return 0;
    if (k % 5 === 0) return 600 + 230 * (k / 5 - 1 - (k > NEWBIE ? 1 : 0));
    return 180 + 3 * k;
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  // steps and time for one swipe.
  function cost(C, found) {
    if (C.design === "none") return { steps: 0, us: ONLINE };
    var steps = C.design === "map" ? (found ? 6 : 8) : 2 * C.cap;
    var per = C.design === "chip" ? FAST : STEP;
    return { steps: steps, us: steps * per + (found ? 0 : ONLINE) };
  }

  function what(C, found) {
    var n = fmt(C.cap);
    var c = cost(C, found);
    if (C.design === "none") return "no memory: the reader asks the online system, 0.8 s";
    if (C.design === "map") {
      return found ? "found: the map goes straight to its entry, which is untied and tied in at the front; 6 steps" :
        "not in the map: the reader asks the online system (0.8 s), unties the back entry and ties the card in at the front; 8 steps";
    }
    if (C.design === "sort") {
      return found ? "found; the sort then reads all " + n + " entries and writes them back, " + fmt(c.steps) + " steps at least" :
        "not found: the online system is asked (0.8 s), the card gets a count of 1 at the back, and the sort reads and writes back all " + n + " entries";
    }
    return found ? "found: the list holds " + n + " entries, so the reader reads and moves " + fmt(c.steps) + " of them" :
      "not found: the reader walks all " + n + " entries, asks the online system (0.8 s), drops the last entry and shifts the rest down";
  }

  /* ---------- the model: the rush, swimmer by swimmer ---------- */

  function rush(C) {
    var rows = [];
    var end = 0;
    for (var k = 1; k <= N; k++) {
      var a = (k - 1) * GAP;
      var p = place(k);
      var found = C.design !== "none" && p > 0 && p <= C.cap;
      var c = cost(C, found);
      var s = Math.max(a, end);
      end = s + c.us;
      var ahead = 0;
      for (var j = 0; j < rows.length; j++) if (rows[j].s > a) ahead += 1;
      rows.push({ k: k, card: card(k), a: a, s: s, e: end, d: c.us, wait: s - a, found: found, ahead: ahead,
        msg: "swimmer " + k + ", card " + card(k) + ", queued at " + clock(a) + "; swipe begins at " + clock(s) +
          " after " + waitText(s - a) + " in the queue; " + what(C, found) + "; took " + dur(c.us) + "." });
    }
    return rows;
  }

  function tally(rows, n) {
    var r = { done: 0, found: 0, maxWait: 0, q558: null, through: null };
    for (var i = 0; i < n && i < rows.length; i++) {
      r.done += 1;
      if (rows[i].found) r.found += 1;
      if (rows[i].wait > r.maxWait) r.maxWait = rows[i].wait;
    }
    if (r.done >= 91) {
      r.q558 = 0;
      rows.forEach(function (w) { if (w.a <= T558 && w.s > T558) r.q558 += 1; });
    }
    if (r.done === N) r.through = rows[N - 1].e;
    return r;
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var X0 = 60, X1 = 640, Y0 = 160, Y1 = 30, SPAN = 270 * SEC, QMAX = 20;

  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, String(attrs[k]));
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, parent, x, y, text, cls, anchor) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" }, parent);
    t.textContent = text;
    return t;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

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
    var head = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 200", width: "100%", "class": "dg", role: "img",
      "aria-label": "how many swimmers were already waiting when each swimmer reached the turnstile, from 05:55:00 to 05:59:30, with a line at 05:58:00"
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var table = el("table", "width:100%;font-size:12px;");
    var thead = el("thead");
    var hr = el("tr");
    ["swimmer", "card", "queued", "swipe began", "memory", "took"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    box.appendChild(table);
    api.root.appendChild(box);
    return { doc: doc, el: el, head: head, layer: layer, tbody: tbody };
  }

  function drawChart(S) {
    var doc = S.ui.doc;
    var g = S.ui.layer;
    clear(g);
    function X(us) { return X0 + (X1 - X0) * Math.max(0, Math.min(SPAN, us)) / SPAN; }
    function Y(q) { return Y0 - (Y0 - Y1) * Math.min(QMAX, q) / QMAX; }
    mk(doc, "line", { x1: X0, y1: Y0, x2: X1, y2: Y0, "class": "dg-axis" }, g);
    mk(doc, "line", { x1: X0, y1: Y0, x2: X0, y2: Y1, "class": "dg-axis" }, g);
    for (var t = 0; t <= 270; t += 60) {
      mk(doc, "line", { x1: X(t * SEC), y1: Y0, x2: X(t * SEC), y2: Y0 + 5, "class": "dg-axis" }, g);
      txt(doc, g, X(t * SEC), Y0 + 18, clock(t * SEC).slice(0, 8), "dg-axis", "middle");
    }
    [0, 10, 20].forEach(function (q) { txt(doc, g, X0 - 6, Y(q) + 4, String(q), "dg-axis", "end"); });
    txt(doc, g, X0, 18, "people already waiting when each swimmer arrived", "dg-note", "start");
    mk(doc, "line", { x1: X(T558), y1: Y1, x2: X(T558), y2: Y0, "class": "dg-axis", "stroke-dasharray": "4 3" }, g);
    txt(doc, g, X(T558) + 4, Y1 + 10, "05:58:00", "dg-note", "start");
    var shown = S.rows.slice(0, S.shown);
    if (!shown.length) return;
    var pts = shown.map(function (w) { return X(w.a).toFixed(1) + "," + Y(w.ahead).toFixed(1); }).join(" ");
    var tone = shown.some(function (w) { return w.ahead > 0; }) ? "bad" : "ok";
    var c = mk(doc, "g", { "class": "dg-node st-" + tone }, g);
    mk(doc, "polyline", { points: pts, fill: "none", "stroke-width": 2 }, c);
    var last = shown[shown.length - 1];
    mk(doc, "circle", { cx: X(last.a), cy: Y(last.ahead), r: 4 }, c);
  }

  function drawTable(S) {
    var el = S.ui.el;
    clear(S.ui.tbody);
    S.rows.slice(Math.max(0, S.shown - 6), S.shown).forEach(function (w) {
      var tr = el("tr");
      [String(w.k), w.card, clock(w.a), clock(w.s), w.found ? "found" : "not found", dur(w.d)].forEach(function (v) {
        tr.appendChild(el("td", "", v));
      });
      S.ui.tbody.appendChild(tr);
    });
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var r = tally(S.rows, S.shown);
    S.ui.head.textContent = "design: " + SHORT[C.design] + (C.design === "none" ? "" : ", " + fmt(C.cap) + " entries kept") +
      ". swimmers 2 s apart from 05:55:00. swipes shown: " + S.shown + " of " + N + ".";
    drawChart(S);
    drawTable(S);
    var hit = cost(C, true);
    S.stat.done(r.done);
    S.stat.found(r.found);
    S.stat.rate(r.done ? Math.round(r.found * 100 / r.done) + "%" : "none yet");
    S.stat.hit(C.design === "none" ? "no memory" : dur(hit.us));
    S.stat.steps(C.design === "none" ? "none" : fmt(hit.steps));
    S.stat.wait(r.done ? waitText(r.maxWait) : "none yet");
    S.stat.q558(r.q558 === null ? "not yet" : r.q558);
    S.stat.through(r.through === null ? "not yet" : clock(r.through));
    S.ctl.step.disable(S.shown >= N);
    S.ctl.play.disable(S.shown >= N);
  }

  function showTo(api, n) {
    var S = api.state;
    while (S.shown < n && S.shown < N) {
      var w = S.rows[S.shown];
      S.shown += 1;
      api.clock = (T0 + w.s) / SEC;
      api.log(w.msg, w.found ? (w.wait > 0 ? "warn" : "ok") : "bad");
    }
  }

  function summary(S) {
    var r = tally(S.rows, N);
    return "rush replayed: " + SHORT[S.C.design] + (S.C.design === "none" ? "" : ", " + fmt(S.C.cap) + " entries kept") +
      "; " + r.found + " of " + N + " found (" + Math.round(r.found * 100 / N) + "%), longest wait " + waitText(r.maxWait) +
      ", " + r.q558 + " queueing at 05:58:00, last swimmer through at " + clock(r.through) + ".";
  }

  function playAll(api) {
    var S = api.state;
    showTo(api, N);
    var r = tally(S.rows, N);
    api.log(summary(S), r.maxWait > 0 ? "bad" : "ok");
    draw(api);
  }

  function replay(api) {
    var S = api.state;
    S.rows = rush(S.C);
    S.shown = 0;
    playAll(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("w02", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { design: "plain", cap: 5000 };
      S.rows = rush(S.C);
      S.shown = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.design = api.control.select("design", "design", DESIGNS, "plain", function (v) {
        var o = pick(DESIGNS, v);
        if (!o) return;
        S.C.design = String(o.value);
        replay(api);
      });
      S.ctl.cap = api.control.select("cap", "entries kept",
        CAPS.map(function (c) { return { value: c, label: fmt(c) + " entries" }; }), 5000,
        function (v) { S.C.cap = Number(v); replay(api); });
      S.ctl.step = api.control.button("step", "step", function () { showTo(api, S.shown + 1); draw(api); });
      S.ctl.play = api.control.button("play", "play the rush", function () { playAll(api); });
      api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        done: api.stat("done", "swipes done", ""),
        found: api.stat("found", "found in memory", "ok"),
        rate: api.stat("rate", "found, as the dashboard shows it", ""),
        hit: api.stat("hit", "a found swipe takes", "warn"),
        steps: api.stat("steps", "steps in a found swipe", ""),
        wait: api.stat("wait", "longest wait in the queue", "bad"),
        q558: api.stat("q558", "queueing at 05:58:00", "bad"),
        through: api.stat("through", "last swimmer through at", "")
      };

      api.info("<strong>how to read it.</strong> each swimmer reaches the turnstile 2 s after the one before, and waits while " +
        "earlier swipes finish. the chart shows how many people were already waiting as each swimmer arrived; the dashed line is " +
        "05:58:00, when Mrs Wojtyna joined. the table shows the last six swipes: when each swimmer queued, when the swipe began, " +
        "whether the card was found, and how long it took. step plays one swipe; play the rush plays the rest.");

      api.clock = OPEN / SEC;
      api.log("the 06:00 rush is due: 100 swimmers from 05:55:00, one every 2 s; the plain list keeps 5,000 entries. press step, or play the rush.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. opens before the first swimmer.
      t.expect(t.stat("done") === 0 && t.stat("found") === 0 && t.stat("rate") === "none yet" && t.stat("wait") === "none yet" &&
        t.stat("q558") === "not yet" && t.stat("through") === "not yet" && t.stat("hit") === "2.4 s" && t.stat("steps") === "10,000" &&
        has("the 06:00 rush is due: 100 swimmers from 05:55:00, one every 2 s; the plain list keeps 5,000 entries."),
        "opens at 05:54:00 before the first swipe; a found swipe on the plain list is 10,000 steps, 2.4 s");

      // 2. one step: the first swimmer.
      t.click("step");
      t.expect(has("swimmer 1, card ") && has("queued at 05:55:00.0; swipe begins at 05:55:00.0 after 0 s in the queue; found: the list holds 5,000 entries, so the reader reads and moves 10,000 of them; took 2.4 s.") &&
        t.stat("done") === 1 && t.stat("found") === 1 && t.stat("rate") === "100%" && t.stat("wait") === "0 s",
        "swimmer 1 at 05:55:00: found, 10,000 entries read and moved, 2.4 s");

      // 3. play the rush: the post's record.
      t.click("play");
      t.expect(t.stat("found") === 99 && t.stat("rate") === "99%" && t.stat("wait") === "40.4 s" && t.stat("q558") === 16 &&
        t.stat("through") === "05:59:00.8" &&
        has("rush replayed: plain list, 5,000 entries kept; 99 of 100 found (99%), longest wait 40.4 s, 16 queueing at 05:58:00, last swimmer through at 05:59:00.8."),
        "as built: 99% found, 16 queueing at 05:58:00, the last swimmer waits 40.4 s");

      // 4. The log lines in the post, Mrs Wojtyna's swipe and the new member.
      t.expect(has("swimmer 75, card 51884, queued at 05:57:28.0; swipe begins at 05:57:58.4 after 30.4 s in the queue;") &&
        has("swimmer 78, card 27719, queued at 05:57:34.0; swipe begins at 05:58:05.6 after 31.6 s in the queue;") &&
        has("swimmer 91, card ") && has("queued at 05:58:00.0; swipe begins at 05:58:36.8 after 36.8 s in the queue;") &&
        has("not found: the reader walks all 5,000 entries, asks the online system (0.8 s), drops the last entry and shifts the rest down; took 3.2 s."),
        "cards 51884 and 27719 wait 30.4 s and 31.6 s; Mrs Wojtyna waits 36.8 s; the new member's swipe takes 3.2 s");

      // 5. no memory: 0.8 s a swipe, no queue.
      t.set("design", "none");
      t.expect(t.stat("found") === 0 && t.stat("rate") === "0%" && t.stat("wait") === "0 s" && t.stat("q558") === 0 &&
        t.stat("hit") === "no memory" && t.stat("through") === "05:58:18.8",
        "no memory: every swipe 0.8 s, nobody queues");

      // 6. The plain list's cost grows with its size.
      t.set("design", "plain");
      t.set("cap", 1000);
      var k1 = t.stat("hit") === "0.48 s" && t.stat("steps") === "2,000" && t.stat("found") === 82;
      t.set("cap", 10000);
      t.expect(k1 && t.stat("hit") === "4.8 s" && t.stat("steps") === "20,000",
        "plain list: a found swipe takes 0.48 s at 1,000 entries and 4.8 s at 10,000");

      // 7. 500 entries: fast, but 1 in 5 not found.
      t.set("cap", 500);
      t.expect(t.stat("found") === 80 && t.stat("rate") === "80%" && t.stat("wait") === "0 s" && t.stat("hit") === "0.24 s" &&
        t.stat("q558") === 0 && has("drops the last entry and shifts the rest down; took 1.04 s."),
        "500 entries: 80 found, found swipes 0.24 s, the rest 1.04 s, no queue");

      // 8. the faster chip clears friday's queue at 5,000 and loses it again at 10,000.
      t.set("design", "chip");
      t.set("cap", 5000);
      var c5 = t.stat("hit") === "1.2 s" && t.stat("wait") === "0 s" && t.stat("q558") === 0;
      t.set("cap", 10000);
      t.expect(c5 && t.stat("hit") === "2.4 s" && t.stat("q558") === 16 && t.stat("wait") === "40.4 s",
        "faster chip: 1.2 s and no queue at 5,000 entries; 2.4 s and 16 queueing at 10,000");

      // 9. count and sort: no faster than the plain list.
      t.set("design", "sort");
      t.set("cap", 5000);
      t.expect(t.stat("hit") === "2.4 s" && t.stat("q558") === 16 &&
        has("found; the sort then reads all 5,000 entries and writes them back, 10,000 steps at least; took 2.4 s."),
        "count and sort: at least 2.4 s a swipe, 16 still queueing at 05:58:00");

      // 10. map with two-way links: 6 steps at any size.
      t.set("design", "map");
      var m5 = t.stat("steps") === 6 && t.stat("hit") === "1.44 ms" && t.stat("found") === 99 && t.stat("wait") === "0 s" &&
        t.stat("q558") === 0 && t.stat("through") === "05:58:18.0" &&
        has("not in the map: the reader asks the online system (0.8 s), unties the back entry and ties the card in at the front; 8 steps; took 0.8 s.");
      t.set("cap", 10000);
      t.expect(m5 && t.stat("steps") === 6 && t.stat("hit") === "1.44 ms" && t.stat("wait") === "0 s",
        "map with links: 6 steps, 1.44 ms, nobody queues, at 5,000 and at 10,000 entries");

      // 11. The map does not change who is found: 500 entries still finds 80.
      t.set("cap", 500);
      t.expect(t.stat("found") === 80 && t.stat("hit") === "1.44 ms",
        "map with links at 500 entries: still 80 found, each found swipe 1.44 ms");
    }
  });
})();
