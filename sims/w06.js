/* sims/w06-v1.0.0.js  (published as sims/w06.js)
   Workshop case w06 "Nineteen in One Second": a workbench for the token bucket that limits
   Nachtmahl's "on its way" texts to Hoopoe's rule of no more than 10 texts in any one second.
   Four sender threads share one bucket; the run of 19 texts at 23:41:07 on Friday 9 October
   2026 is replayed one moment at a time. Widget-style sim: it draws its own lanes inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: design (as built, volatile, a bucket per thread, one
     thread, one lock, compare-and-set), Hoopoe's answer time (200, 600 or 2,000 ms) and the run
     size (8, 14 or 19 texts). Step shows one moment; Play runs the rest; Reset. Lanes show each
     thread's sends with the text's place in the run. Stats: texts sent, most texts in any one
     second, Hoopoe's account, last text sent at, bucket count now, compare-and-set retries,
     texts refused in the paused hour. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - The bucket holds at most 2 tokens and is full at 23:41:07.000. A new token drops in at
     every 125 ms mark of the clock (.125, .250, .375 and so on), 8 a second. take() reads the
     count, adds the tokens dropped in since the last take (at most 2 in all), answers no if
     that is 0, and otherwise writes back one less and answers yes. A no writes nothing.
   - The bench drives the bucket with a clock it sets itself (the test clock of the case).
   - All the run's texts are in the queue at 23:41:07.000. A free thread asks the bucket only
     if a text is waiting for it. On a yes it takes the next text and sends it, and is busy
     until Hoopoe answers (the answer time). On a no it asks again at the next 125 ms mark.
   - As built: threads that ask at the same moment all read the count before any of them
     writes it back (the worst case on a machine with four cores), so all of them get the
     same answer and all write back the same count. Volatile: the same, because volatile
     shows the latest written count and none has been written yet at that moment.
     A bucket per thread: each thread has its own bucket of 2, refilled the same way.
     One thread: thread A alone. One lock: threads at the same moment go one at a time, in the
     order A, B, C, D, each reading what the one before wrote. Compare-and-set: all read; the
     first to set wins; each of the others finds the count changed, counts one retry and reads
     again; the results match the lock.
   - Hoopoe counts the texts in the one second that starts at each text. If any such second
     holds more than 10, the account is paused for one hour from the end of that second, and
     a text sent after that is refused. The hour after Friday's run had 46 texts to send
     (given data, the program's log of refusals), so a pause loses 46.

   Where every number comes from (the case is content/s6/w06-v1.0.0.json). All are produced by
   the model above and checked by the selfTest.
   - As built, 19 texts, 200 ms: moments .000, .200, .400, .600, .800 with 4, 4, 4, 4 and 3 yeses.
     At .000 each thread reads 2 tokens and writes back 1. At every later moment each reads
     1 token, at least 1 new has dropped in, and each writes back 1. 19 texts in 800 ms; the 11th
     goes at .400. Most in any one second 19; paused 23:41:08 to 00:41:08; 46 refused.
   - Volatile: identical. A bucket per thread: identical, 19 in 800 ms.
   - Runs before Friday: 8 texts as built go 4 at .000 and 4 at .200: 8 in one second, open.
     A run of 14 as built: 14 in 600 ms, paused.
   - One thread, 200 ms: one text every 200 ms, never more than 5 in one second; the 19th at
     23:41:10.600. At 2,000 ms: the 19th at 23:41:43.000 (36 s); a run of 14 takes 26 s.
   - One lock, 200 ms: 2 texts at .000 (A and B yes, C and D no), then one at every 125 ms
     mark; the 19th at 23:41:09.125, most in any one second 9. A run of 14 ends at
     23:41:08.500. At 2,000 ms a run of 14 ends 6 s after it starts, and 19 at 23:41:15.125.
   - Compare-and-set, 200 ms: the same times as the lock, with 35 retries.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var DAY = 86400000;
  function at(h, m, s) { return (h * 3600 + m * 60 + s) * 1000; }
  var RUN = at(23, 41, 7);            // 23:41:07.000, the run's texts reach the queue
  var OPEN = at(23, 41, 0);           // the bench opens before the run
  var SIZE = 2;                       // the bucket holds at most 2 tokens
  var TICK = 125;                     // a new token at every 125 ms mark
  var LIMIT = 10;                     // Hoopoe: no more than 10 texts in any one second
  var PAUSE = 3600000;                // paused for one hour
  var LOST = 46;                      // texts the hour after Friday's run had to send

  var DESIGNS = [
    { value: "built", label: "as built: read, then write back, no lock" },
    { value: "volatile", label: "the count marked volatile" },
    { value: "own", label: "a bucket of its own for each thread" },
    { value: "one", label: "one sender thread" },
    { value: "lock", label: "one lock from the read to the write" },
    { value: "cas", label: "compare-and-set, read again if it fails" }
  ];
  var SHORT = {
    built: "the bucket as built",
    volatile: "the count marked volatile",
    own: "a bucket per thread",
    one: "one sender thread",
    lock: "one lock from read to write",
    cas: "compare-and-set"
  };
  var ANSWERS = [200, 600, 2000];
  var RUNS = [8, 14, 19];

  /* ---------- helpers ---------- */

  function pad(n, w) { var s = String(n); while (s.length < (w || 2)) s = "0" + s; return s; }
  function hms(ms, frac) {
    var t = ((ms % DAY) + DAY) % DAY;
    var s = pad(Math.floor(t / 3600000)) + ":" + pad(Math.floor(t / 60000) % 60) + ":" + pad(Math.floor(t / 1000) % 60);
    return frac === false ? s : s + "." + pad(t % 1000, 3);
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function tok(n) { return n + (n === 1 ? " token" : " tokens"); }
  function tick(t) { return Math.floor(t / TICK); }
  function nextTick(t) { return (tick(t) + 1) * TICK; }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function names(list) {
    if (list.length === 1) return list[0];
    return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  }

  /* ---------- the model: one run, as a list of moments ---------- */

  function night(C) {
    var ids = C.design === "one" ? ["A"] : ["A", "B", "C", "D"];
    var th = ids.map(function (id) { return { id: id, freeAt: 0, done: false, b: { tokens: SIZE, last: 0 } }; });
    var shared = { tokens: SIZE, last: 0 };
    var waiting = C.size;
    var next = 1;
    var moments = [];
    var sends = [];
    var retries = 0;
    var t = 0;
    var guard = 0;

    function fill(b) { return Math.min(SIZE, b.tokens + tick(t) - tick(b.last)); }
    function countText() {
      if (C.design === "own") return th.map(function (x) { return x.id + " " + x.b.tokens; }).join(", ");
      return String(shared.tokens);
    }

    while (guard++ < 5000) {
      var free = th.filter(function (x) { return !x.done && x.freeAt === t; });
      var askers = free.slice(0, waiting);
      free.slice(waiting).forEach(function (x) { if (waiting === 0) x.done = true; else x.freeAt = nextTick(t); });
      if (askers.length) {
        var lines = [];
        var m = { t: t, lines: lines, yes: 0, retries: 0 };
        var yes = function (x, read, n) {
          var added = n - read;
          lines.push("thread " + x.id + " read " + tok(read) + (added > 0 ? ", " + added + " new," : "") +
            " and wrote back " + (n - 1) + ": yes, it sends text " + next);
          sends.push({ t: t, th: x.id, n: next });
          next += 1;
          waiting -= 1;
          m.yes += 1;
          x.freeAt = t + C.answer;
        };
        var no = function (x, read) {
          lines.push("thread " + x.id + " read " + tok(read) + ": no, it waits for the next token");
          x.freeAt = nextTick(t);
        };
        var who = names(askers.map(function (x) { return x.id; }));
        if (C.design === "built" || C.design === "volatile") {
          if (askers.length > 1) {
            lines.push("threads " + who + " ask at the same moment, and each reads the count before any writes it back" +
              (C.design === "volatile" ? "; volatile shows each the latest count written, and none has been written yet" : ""));
          }
          var r = shared.tokens;
          var n = fill(shared);
          askers.forEach(function (x) { if (n >= 1) yes(x, r, n); else no(x, r); });
          if (n >= 1) { shared.tokens = n - 1; shared.last = t; }
        } else if (C.design === "own") {
          if (askers.length > 1) lines.push("threads " + who + " ask at the same moment, each its own bucket");
          askers.forEach(function (x) {
            var r1 = x.b.tokens;
            var n1 = fill(x.b);
            if (n1 >= 1) { yes(x, r1, n1); x.b.tokens = n1 - 1; x.b.last = t; } else no(x, r1);
          });
        } else if (C.design === "cas") {
          var rest = askers.slice();
          while (rest.length) {
            var r2 = shared.tokens;
            var n2 = fill(shared);
            if (n2 < 1) { rest.forEach(function (x) { no(x, r2); }); break; }
            var first = rest.shift();
            yes(first, r2, n2);
            shared.tokens = n2 - 1;
            shared.last = t;
            if (rest.length) {
              lines.push(rest.length === 1 ?
                "thread " + rest[0].id + "'s compare-and-set finds the count changed, so it reads again" :
                "the compare-and-sets of threads " + names(rest.map(function (x) { return x.id; })) + " find the count changed, so they read again");
              retries += rest.length;
              m.retries += rest.length;
            }
          }
        } else {
          if (askers.length > 1) lines.push("threads " + who + " ask at the same moment; the lock lets them in one at a time");
          askers.forEach(function (x) {
            var r3 = shared.tokens;
            var n3 = fill(shared);
            if (n3 >= 1) { yes(x, r3, n3); shared.tokens = n3 - 1; shared.last = t; } else no(x, r3);
          });
        }
        m.count = countText();
        moments.push(m);
      }
      var live = th.filter(function (x) { return !x.done; });
      if (!live.length || next > C.size) break;
      t = Math.min.apply(null, live.map(function (x) { return x.freeAt; }));
    }

    // Hoopoe's rule: the first one-second span, starting at a text, with more than 10.
    var pausedAt = -1;
    for (var i = 0; i < sends.length && pausedAt < 0; i++) {
      var c = 0;
      for (var j = 0; j < sends.length; j++) if (sends[j].t >= sends[i].t && sends[j].t < sends[i].t + 1000) c += 1;
      if (c > LIMIT) pausedAt = sends[i].t + 1000;
    }
    sends.forEach(function (s) { s.refused = pausedAt >= 0 && s.t >= pausedAt; });
    return { moments: moments, sends: sends, pausedAt: pausedAt, retries: retries, ids: ids };
  }

  // Totals over the first n moments.
  function tally(N, n) {
    var end = n > 0 ? N.moments[Math.min(n, N.moments.length) - 1].t : -1;
    var shown = N.sends.filter(function (s) { return s.t <= end && !s.refused; });
    var most = 0;
    shown.forEach(function (s) {
      var c = shown.filter(function (u) { return u.t >= s.t && u.t < s.t + 1000; }).length;
      if (c > most) most = c;
    });
    var retries = 0;
    for (var i = 0; i < n && i < N.moments.length; i++) retries += N.moments[i].retries;
    var paused = N.pausedAt >= 0 && n >= N.moments.length;
    return {
      sent: shown.length,
      most: most,
      last: shown.length ? shown[shown.length - 1].t : -1,
      count: n > 0 ? N.moments[Math.min(n, N.moments.length) - 1].count : null,
      retries: retries,
      paused: paused
    };
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var X0 = 90;
  var X1 = 640;

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
      viewBox: "0 0 660 230", width: "100%", "class": "dg", role: "img",
      "aria-label": "the run, drawn as one lane per sender thread from 23:41:07.000; each block is one text being sent, from the bucket's yes until Hoopoe answers, marked with the text's place in the run; the bottom lane shows the one-second span Hoopoe counts, and whether it held more than 10 texts."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var foot = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(foot);
    api.root.appendChild(box);
    return { doc: doc, head: head, layer: layer, foot: foot };
  }

  function drawLanes(S) {
    var doc = S.ui.doc;
    var g = S.ui.layer;
    clear(g);
    var N = S.N;
    var endT = S.shown > 0 ? N.moments[Math.min(S.shown, N.moments.length) - 1].t : -1;
    var span = 1000;
    N.sends.forEach(function (s) { span = Math.max(span, s.t + S.C.answer); });
    function X(ms) { return X0 + (X1 - X0) * Math.max(0, Math.min(span, ms)) / span; }
    var rows = {};
    N.ids.forEach(function (id, i) {
      rows[id] = 30 + i * 34;
      txt(doc, g, 10, rows[id] + 4, "thread " + id, "dg-note", "start");
    });
    var hy = 30 + 4 * 34 + 6;
    txt(doc, g, 10, hy + 4, "hoopoe", "dg-note", "start");
    N.sends.forEach(function (s) {
      if (s.t > endT) return;
      var y = rows[s.th];
      var w = Math.max(3, X(s.t + S.C.answer) - X(s.t) - 2);
      mk(doc, "rect", { x: X(s.t), y: y - 10, width: w, height: 20, "class": "dg-node st-" + (s.refused ? "bad" : (N.pausedAt >= 0 ? "warn" : "ok")) }, g);
      if (w >= 16) txt(doc, g, X(s.t) + 3, y + 4, String(s.n), "dg-note", "start");
    });
    var r = tally(N, S.shown);
    if (r.sent) {
      var first = N.sends[0].t;
      mk(doc, "rect", { x: X(first), y: hy - 10, width: Math.max(3, X(first + 1000) - X(first)), height: 20,
        "class": "dg-node st-" + (r.most > LIMIT ? "bad" : "ok") }, g);
      txt(doc, g, X(first) + 4, hy + 4, "busiest second: " + r.most + " of " + LIMIT + " allowed", "dg-note", "start");
    }
    var step = span <= 1200 ? 200 : (span <= 3000 ? 500 : (span <= 12000 ? 2000 : 5000));
    var ay = 210;
    mk(doc, "line", { x1: X0, y1: ay, x2: X1, y2: ay, "class": "dg-axis" }, g);
    for (var k = 0; k <= span; k += step) {
      mk(doc, "line", { x1: X(k), y1: ay, x2: X(k), y2: ay + 5, "class": "dg-axis" }, g);
      txt(doc, g, X(k), ay + 17, "+" + fmt(k), "dg-axis", "middle");
    }
    txt(doc, g, X1, 14, "ms after 23:41:07.000", "dg-axis", "end");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var r = tally(S.N, S.shown);
    S.ui.head.textContent = "design: " + SHORT[C.design] + "; a run of " + C.size + " texts; Hoopoe answers each in " +
      fmt(C.answer) + " ms; moments shown: " + S.shown + " of " + S.N.moments.length + ".";
    S.ui.foot.textContent = r.paused ?
      "Hoopoe saw " + r.most + " texts in one second and paused the account for an hour." :
      (S.shown >= S.N.moments.length ? "the whole run went within Hoopoe's rule." : "");
    drawLanes(S);
    S.stat.sent(r.sent);
    S.stat.most(r.most);
    S.stat.account(r.paused ? "paused " + hms(RUN + S.N.pausedAt, false) + " to " + hms(RUN + S.N.pausedAt + PAUSE, false) : "open");
    S.stat.last(r.last < 0 ? "none yet" : hms(RUN + r.last));
    S.stat.count(r.count !== null ? r.count : (C.design === "own" ? "A 2, B 2, C 2, D 2" : String(SIZE)));
    S.stat.retries(r.retries);
    S.stat.lost(r.paused ? LOST : 0);
    S.ctl.step.disable(S.shown >= S.N.moments.length);
    S.ctl.play.disable(S.shown >= S.N.moments.length);
  }

  function showTo(api, n) {
    var S = api.state;
    while (S.shown < n && S.shown < S.N.moments.length) {
      var m = S.N.moments[S.shown];
      S.shown += 1;
      api.clock = ((RUN + m.t) % DAY) / 1000;
      m.lines.forEach(function (line) {
        var tone = line.indexOf(": yes") >= 0 ? "" : (line.indexOf(": no") >= 0 ? "warn" : "");
        api.log(line + " (" + hms(RUN + m.t) + ").", tone);
      });
    }
  }

  function summary(S) {
    var r = tally(S.N, S.N.moments.length);
    return "run replayed with " + SHORT[S.C.design] + ", " + S.C.size + " texts, Hoopoe at " + fmt(S.C.answer) + " ms: " +
      r.sent + " sent, the last at " + hms(RUN + r.last) + ", at most " + r.most + " in any one second" +
      (r.paused ? "; the account is paused for an hour and " + LOST + " texts are refused." : "; the account stays open.");
  }

  function finish(api) {
    var S = api.state;
    showTo(api, S.N.moments.length);
    var r = tally(S.N, S.N.moments.length);
    api.log(summary(S), r.paused ? "bad" : "ok");
    draw(api);
  }

  function replay(api) {
    var S = api.state;
    S.N = night(S.C);
    S.shown = 0;
    finish(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("w06", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { design: "built", answer: 200, size: 19 };
      S.N = night(S.C);
      S.shown = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.design = api.control.select("design", "design of take()", DESIGNS, "built", function (v) {
        var o = pick(DESIGNS, v);
        if (!o) return;
        S.C.design = String(o.value);
        replay(api);
      });
      S.ctl.answer = api.control.select("answer", "hoopoe's answer time",
        ANSWERS.map(function (a) { return { value: a, label: fmt(a) + " ms" }; }), 200,
        function (v) { S.C.answer = Number(v); replay(api); });
      S.ctl.size = api.control.select("size", "texts in the run",
        RUNS.map(function (n) { return { value: n, label: n + " texts" }; }), 19,
        function (v) { S.C.size = Number(v); replay(api); });
      S.ctl.step = api.control.button("step", "step one moment", function () { showTo(api, S.shown + 1); draw(api); });
      S.ctl.play = api.control.button("play", "play the run", function () { finish(api); });
      api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        sent: api.stat("sent", "texts sent", ""),
        most: api.stat("most", "most texts in any one second (rule: 10)", "warn"),
        account: api.stat("account", "hoopoe account", "bad"),
        last: api.stat("last", "last text sent at", ""),
        count: api.stat("count", "bucket count now (tokens)", ""),
        retries: api.stat("retries", "compare-and-set retries", ""),
        lost: api.stat("lost", "texts refused in the paused hour", "bad")
      };

      api.info("<strong>how to read it.</strong> each lane is one sender thread; a block is one text, from the bucket's yes " +
        "until Hoopoe answers, marked with its place in the run. The bottom lane is the one second Hoopoe counts from the " +
        "first text. The log shows what each thread read from the bucket and wrote back. Step shows one moment; play runs the rest.");

      api.clock = OPEN / 1000;
      api.log("23:41:00. friday's run of " + S.C.size + " texts reaches the queue at 23:41:07.000; the bucket is full, 2 tokens; press step or play.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens before the run: nothing sent, a full bucket, the account open.
      t.expect(t.stat("sent") === 0 && t.stat("most") === 0 && t.stat("count") === 2 && t.stat("account") === "open" &&
        t.stat("last") === "none yet" && t.stat("lost") === 0 &&
        has("friday's run of 19 texts reaches the queue at 23:41:07.000; the bucket is full, 2 tokens; press step or play."),
        "Opens at 23:41:00, before the run: no texts, 2 tokens, account open");

      // 2. The first moment, as built: four threads read 2 and all write back 1.
      t.click("step");
      t.expect(has("threads A, B, C and D ask at the same moment, and each reads the count before any writes it back (23:41:07.000).") &&
        has("thread D read 2 tokens and wrote back 1: yes, it sends text 4 (23:41:07.000).") &&
        t.stat("sent") === 4 && t.stat("count") === 1,
        "23:41:07.000 as built: four yeses for one token, the count falls from 2 to 1");

      // 3. Play the run: 19 texts in 800 ms, and the account is paused.
      t.click("play");
      t.expect(has("thread C read 1 token, 1 new, and wrote back 1: yes, it sends text 19 (23:41:07.800).") &&
        t.stat("sent") === 19 && t.stat("most") === 19 && t.stat("last") === "23:41:07.800" &&
        t.stat("account") === "paused 23:41:08 to 00:41:08" && t.stat("lost") === 46 && t.stat("count") === 1,
        "As built: 19 texts by 23:41:07.800, paused 23:41:08 to 00:41:08, 46 texts refused");

      // 4. Volatile changes nothing.
      t.set("design", "volatile");
      t.expect(has("volatile shows each the latest count written, and none has been written yet (23:41:07.000).") &&
        t.stat("most") === 19 && t.stat("last") === "23:41:07.800" && t.stat("account") === "paused 23:41:08 to 00:41:08",
        "Volatile: the same 19 texts in 800 ms, the same pause");

      // 5. A bucket per thread: no shared count, the same 19.
      t.set("design", "own");
      t.expect(t.stat("most") === 19 && t.stat("count") === "A 1, B 1, C 1, D 1" && t.stat("lost") === 46,
        "A bucket per thread: 19 texts in one second, paused");

      // 6. One thread: never more than 5 in a second; the 19th at 23:41:10.600.
      t.set("design", "one");
      var one200 = t.stat("most") === 5 && t.stat("last") === "23:41:10.600" && t.stat("account") === "open" && t.stat("lost") === 0;
      t.set("answer", 2000);
      t.expect(one200 && t.stat("last") === "23:41:43.000" && t.stat("most") === 1,
        "One thread: 19th text at 23:41:10.600, or 23:41:43.000 when Hoopoe takes 2,000 ms");

      // 7. One lock: 2 at once, then one every 125 ms; at most 9 in any one second.
      t.set("answer", 200);
      t.set("design", "lock");
      t.expect(has("thread C read 0 tokens: no, it waits for the next token (23:41:07.000).") &&
        t.stat("most") === 9 && t.stat("last") === "23:41:09.125" && t.stat("account") === "open" && t.stat("count") === 0,
        "One lock: C and D wait at .000; the 19th at 23:41:09.125, at most 9 in any one second");

      // 8. One lock when Hoopoe is slow.
      t.set("answer", 2000);
      t.expect(t.stat("last") === "23:41:15.125" && t.stat("most") === 4 && t.stat("account") === "open",
        "One lock with 2,000 ms answers: the 19th at 23:41:15.125");

      // 9. Compare-and-set: the same times as the lock, with retries.
      t.set("answer", 200);
      t.set("design", "cas");
      t.expect(t.stat("last") === "23:41:09.125" && t.stat("most") === 9 && t.stat("retries") === 35 && t.stat("account") === "open",
        "Compare-and-set: the 19th at 23:41:09.125 after 35 retries");

      // 10. Why never before: a run of 8, as built, stays within the rule.
      t.set("design", "built");
      t.set("size", 8);
      t.expect(t.stat("most") === 8 && t.stat("last") === "23:41:07.200" && t.stat("account") === "open",
        "As built, a run of 8: 8 texts in one second, the account stays open");

      // 11. A run of 14: as built it is paused; with the lock it ends at 23:41:08.500; one thread at 2,000 ms takes 26 s.
      t.set("size", 14);
      var built14 = t.stat("most") === 14 && t.stat("last") === "23:41:07.600" && t.stat("lost") === 46;
      t.set("design", "lock");
      var lock14 = t.stat("most") === 9 && t.stat("last") === "23:41:08.500" && t.stat("account") === "open";
      t.set("answer", 2000);
      var lock14slow = t.stat("last") === "23:41:13.000";
      t.set("design", "one");
      t.expect(built14 && lock14 && lock14slow && t.stat("last") === "23:41:33.000",
        "A run of 14: as built 14 in 600 ms; lock ends 23:41:08.500, or 6 s at 2,000 ms; one thread 26 s");
    }
  });
})();
