/* sims/s5e06-v1.0.0.js  (published as sims/s5e06.js)
   Case s5e06 "Patterns in the Dark": a dispatch lab for Cotterpin Locksmiths' call-out app, one
   Node.js server whose dispatch(job) keeps "the current job" in a singleton shared by every
   request. Six call-outs in one night, two of them 200 ms apart, replayed step by step.
   Widget-style sim: it draws its own timeline and table inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: the gap between the two close call-outs, the geocoder's
     delay, the design (singleton as built, a queue, clear after each text, log the job number,
     pass the job), a pattern picker with each pattern's fit in one line, Step, Play the night,
     Reset. Shows both close requests on one timeline with current.job after each step, and
     which code went to which phone for all six. Stats: right codes, wrong codes, texts that
     failed, mix-ups flagged, current.job now, the code Ms Tremellen got, when Mr Dunwiddie's
     text went, the longest wait from call-out to text. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - The code, as built:
       // one object, every request
       const current = { job: null };
       async function dispatch(job) {
         current.job = job;
         await geocode(job.address); // about 300 ms
         await sms(job.phone, current.job.keySafe);
       }
     The geocoder's delay is a control; the story's is 300 ms.
     The text's code is read from current.job at the moment the geocoder answers. Handing the
     text over is counted as taking no time.
   - One thread: steps run one at a time in time order. When an answer and a new call-out land
     in the same millisecond, the answer is handled first. Call-outs that arrive in the same
     millisecond start in job order.
   - Designs: "built" as above. "queue": a call-out that arrives while another is in progress
     waits in a line and starts when the one before has sent its text; current.job is still
     shared. "clear": as built, then current.job = null after each text; reading the code from
     an empty current.job fails with an error and no text goes. "log": as built, and the log
     line before each text prints current.job's number; the morning check flags a line whose
     number is not the phone's own job. "pass": sms(job.phone, job.keySafe); the singleton holds
     settings only and current.job is not used.

   Where every number comes from (conventions rule 14; the case is content/s5/s5e06-v1.0.0.json).
   All of these come out of the model above and are checked by the selfTest.
   - The night's six call-outs (the post's notebook): 2411 at 22:58:04.000, 2412 at 00:31:47.000,
     2413 (Ms Tremellen, Bellfounder Row, code 3158, phone 07700 900412) at 02:47:31.000,
     2414 (Mr Dunwiddie, Haverick Close, code 9026, phone 07700 900867) at 02:47:31.200 (the gap
     control, story 200 ms), 2415 at 03:52:09.000, 2416 at 05:16:40.000. Each text goes 300 ms
     after its call-out, so the notebook times end in .300, except 2414's at .500.
   - As built, 200 ms apart, geocoder 300 ms: 2413 sets current.job at .000; 2414 overwrites it
     at .200; 2413 wakes at .300 and texts 07700 900412 code 9026 (wrong); 2414 wakes at .500 and
     texts 07700 900867 code 9026 (right). 5 right, 1 wrong. Longest wait 300 ms.
   - The mix happens whenever the gap is shorter than the geocoder's delay: gap 0, 100, 200 at
     300 ms; gap 200 at 600 or 2,000 ms. Gap 300 or more at 300 ms, or gap 200 at 100 ms: none.
   - Queue, 200 ms, 300 ms: 2414 waits in line from .200, starts at .300, texts at .600, the
     right code. Longest wait 400 ms. With the geocoder at 2,000 ms: 2414 texts at 02:47:35.000,
     a wait of 3,800 ms.
   - Clear after: 2413 still gets 9026 at .300, then current.job is emptied; at .500 2414 reads
     an empty current.job, the code fails and no text goes. 4 right, 1 wrong, 1 failed.
   - Log: the same wrong text at .300; its log line says job 2414 for 07700 900412, 1 flagged.
   - Pass the job: every call-out gets its own code at any gap or delay. 6 right.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var DAY = 86400000;
  function at(h, m, s) { var t = (h * 3600 + m * 60 + s) * 1000; return h < 12 ? t + DAY : t; }
  var P = at(2, 47, 31);              // 02:47:31.000, Ms Tremellen's call-out
  var OPEN = at(22, 58, 0);           // the replay opens before the first call-out

  var JOBS = [
    { id: 2411, at: at(22, 58, 4), street: "Cobbold Street", phone: "07700 900135", code: "5830" },
    { id: 2412, at: at(0, 31, 47), street: "Spindle Yard", phone: "07700 900278", code: "1647" },
    { id: 2413, at: P, street: "Bellfounder Row", phone: "07700 900412", code: "3158" },
    { id: 2414, at: -1, street: "Haverick Close", phone: "07700 900867", code: "9026" },
    { id: 2415, at: at(3, 52, 9), street: "Lacemaker Court", phone: "07700 900503", code: "7302" },
    { id: 2416, at: at(5, 16, 40), street: "Chandlery Steps", phone: "07700 900951", code: "2289" }
  ];

  var DESIGNS = [
    { value: "built", label: "Singleton, as built (phone from the job, code from current.job)" },
    { value: "queue", label: "Queue: one call-out at a time, start to finish" },
    { value: "clear", label: "Clear current.job after each text" },
    { value: "log", label: "Log current.job's number before each text" },
    { value: "pass", label: "Pass the job; the singleton keeps settings only" }
  ];
  var SHORT = {
    built: "the singleton as built",
    queue: "a queue, one at a time",
    clear: "current.job cleared after each text",
    log: "current.job's number logged before each text",
    pass: "the job passed to every function"
  };
  var GAPS = [0, 100, 200, 300, 400, 600];
  var DELAYS = [100, 300, 600, 2000];

  var PATTERNS = [
    { value: "none", label: "Pick a pattern" },
    { value: "strategy", label: "Strategy", fit: "Strategy: several ways to do one job behind the same call, swapped freely. Fits pricing a call-out: day rate, night rate, trade rate." },
    { value: "factory", label: "Factory", fit: "Factory: one place decides which kind of object to make. Fits building a house, car or safe job from what the dispatcher typed." },
    { value: "observer", label: "Observer", fit: "Observer: others sign up to be told when something happens. Fits telling the van's tablet and the notebook that a job was booked." },
    { value: "adapter", label: "Adapter", fit: "Adapter: a wrapper that makes someone else's code look like what yours expects. Fits the text-message company's service behind sms()." },
    { value: "decorator", label: "Decorator", fit: "Decorator: wrap an object to add a duty without changing it. Fits adding a retry or a log line around sending a text." },
    { value: "singleton", label: "Singleton", fit: "Singleton: one shared object for the whole program. Fits settings that are the same for every call-out; holding one request's job makes it a global variable." }
  ];

  /* ---------- helpers ---------- */

  function pad(n, w) { var s = String(n); while (s.length < (w || 2)) s = "0" + s; return s; }
  function hms(ms) {
    var t = ((ms % DAY) + DAY) % DAY;
    return pad(Math.floor(t / 3600000)) + ":" + pad(Math.floor(t / 60000) % 60) + ":" +
      pad(Math.floor(t / 1000) % 60) + "." + pad(t % 1000, 3);
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model: one night, as a list of steps ---------- */

  function night(C) {
    var jobs = JOBS.map(function (j) {
      return { id: j.id, at: j.id === 2414 ? P + C.gap : j.at, street: j.street, phone: j.phone, code: j.code };
    });
    var ev = [];
    var seq = 0;
    var cur = null;
    var busy = null;
    var line = [];
    var steps = [];
    function push(t, kind, j) { ev.push({ t: t, kind: kind, j: j, seq: seq++ }); }
    function curText() { return C.design === "pass" ? "not used" : (cur ? "job " + cur.id : "empty"); }
    function step(t, j, msg, tone, extra) {
      var s = { t: t, job: j.id, msg: msg + " (" + hms(t) + ").", tone: tone, cur: curText() };
      if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) s[k] = extra[k];
      steps.push(s);
    }
    function begin(j, t, waited) {
      if (C.design === "queue") busy = j;
      j.start = t;
      var head = waited ? "Job " + j.id + " leaves the line and starts." : "Job " + j.id + ", " + j.street + ", arrives.";
      var geo = " Asking the geocoder, " + fmt(C.delay) + " ms";
      if (C.design === "pass") {
        step(t, j, head + " It carries its own job." + geo, "", { kind: "start" });
      } else {
        var before = cur ? "job " + cur.id : "nothing";
        cur = j;
        step(t, j, head + " current.job held " + before + "; now it holds job " + j.id + "." + geo, "", { kind: "start" });
      }
      push(t + C.delay, "wake", j);
    }
    function wake(j, t) {
      var src = C.design === "pass" ? j : cur;
      var pre = "";
      var flag = false;
      if (C.design === "log" && src) {
        flag = src !== j;
        pre = "The log line says job " + src.id + " for " + j.phone + (flag ? ", a mismatch for the morning check. " : ". ");
      }
      if (!src) {
        step(t, j, pre + "Job " + j.id + " wakes. current.job is empty, so reading its key-safe code fails with an error: no text goes to " + j.phone,
          "bad", { kind: "text", crash: true });
      } else {
        var ok = src === j;
        var how = C.design === "pass" ? "Job " + j.id + " wakes and texts " + j.phone + " its own code, " + j.code :
          "Job " + j.id + " wakes. current.job holds job " + src.id + ", so it texts " + j.phone + " code " + src.code +
          (ok ? ", its own key safe" : ", the key safe at " + src.street + ": the wrong door");
        if (C.design === "clear") { cur = null; how += ". Then current.job is cleared"; }
        step(t, j, pre + how, ok ? "ok" : "bad",
          { kind: "text", ok: ok, code: src.code, from: src.street, wait: t - j.at, flag: flag });
      }
      if (C.design === "queue") {
        busy = null;
        if (line.length) begin(line.shift(), t, true);
      }
    }
    jobs.forEach(function (j) { push(j.at, "arrive", j); });
    while (ev.length) {
      ev.sort(function (a, b) { return (a.t - b.t) || ((a.kind === "wake" ? 0 : 1) - (b.kind === "wake" ? 0 : 1)) || (a.seq - b.seq); });
      var e = ev.shift();
      if (e.kind === "wake") { wake(e.j, e.t); continue; }
      if (C.design === "queue" && busy) {
        line.push(e.j);
        e.j.waitAt = e.t;
        step(e.t, e.j, "Job " + e.j.id + ", " + e.j.street + ", arrives and waits in line behind job " + busy.id, "warn", { kind: "wait" });
        continue;
      }
      begin(e.j, e.t, false);
    }
    return { jobs: jobs, steps: steps };
  }

  // Totals over the first n steps.
  function tally(C, N, n) {
    var r = { right: 0, wrong: 0, failed: 0, flagged: 0, maxWait: -1, texts: {}, cur: C.design === "pass" ? "not used" : "empty" };
    for (var i = 0; i < n && i < N.steps.length; i++) {
      var s = N.steps[i];
      r.cur = s.cur;
      if (s.kind !== "text") continue;
      r.texts[s.job] = s;
      if (s.crash) { r.failed += 1; continue; }
      if (s.ok) r.right += 1; else r.wrong += 1;
      if (s.flag) r.flagged += 1;
      if (s.wait > r.maxWait) r.maxWait = s.wait;
    }
    return r;
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var X0 = 130;
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
      viewBox: "0 0 660 220", width: "100%", "class": "dg", role: "img",
      "aria-label": "A timeline of the two close call-outs, jobs 2413 and 2414, from 02:47:31.000. Each bar is a wait for the geocoder or a wait in line; each dot is a text, marked with the code it carried. The bottom row shows which job current.job held after each step."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var table = el("table", "width:100%;font-size:12px;");
    var thead = el("thead");
    var hr = el("tr");
    ["job", "call-out", "street", "phone", "own code", "code sent", "result"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    box.appendChild(table);
    var fit = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(fit);
    api.root.appendChild(box);
    return { doc: doc, el: el, head: head, layer: layer, tbody: tbody, fit: fit };
  }

  function drawTimeline(S) {
    var doc = S.ui.doc;
    var g = S.ui.layer;
    clear(g);
    var shown = S.N.steps.slice(0, S.shown);
    var end = 700;
    S.N.steps.forEach(function (s) { if (s.t >= P && s.t <= P + 10000) end = Math.max(end, s.t - P + 100); });
    function X(ms) { return X0 + (X1 - X0) * Math.max(0, Math.min(end, ms - P)) / end; }
    var rows = { 2413: 50, 2414: 100 };
    txt(doc, g, 10, 54, "job 2413", "dg-note", "start");
    txt(doc, g, 10, 104, "job 2414", "dg-note", "start");
    txt(doc, g, 10, 154, "current.job", "dg-note", "start");
    var stepMs = end <= 1000 ? 100 : (end <= 2500 ? 500 : 1000);
    for (var k = 0; k <= end; k += stepMs) {
      mk(doc, "line", { x1: X(P + k), y1: 175, x2: X(P + k), y2: 181, "class": "dg-axis" }, g);
      txt(doc, g, X(P + k), 196, "+" + fmt(k), "dg-axis", "middle");
    }
    txt(doc, g, X1, 214, "ms after 02:47:31.000", "dg-axis", "end");
    mk(doc, "line", { x1: X0, y1: 175, x2: X1, y2: 175, "class": "dg-axis" }, g);
    var now = shown.length ? shown[shown.length - 1].t : OPEN;
    S.N.jobs.forEach(function (j) {
      var y = rows[j.id];
      if (!y) return;
      var mine = shown.filter(function (s) { return s.job === j.id; });
      if (!mine.length) return;
      var started = null;
      var sent = null;
      mine.forEach(function (s) { if (s.kind === "start") started = s; if (s.kind === "text") sent = s; });
      if (j.waitAt !== undefined) {
        var wEnd = started ? started.t : now;
        mk(doc, "rect", { x: X(j.waitAt), y: y - 8, width: Math.max(2, X(wEnd) - X(j.waitAt)), height: 16, "class": "dg-node st-warn" }, g);
      }
      if (started) {
        var gEnd = sent ? sent.t : now;
        mk(doc, "rect", { x: X(started.t), y: y - 8, width: Math.max(2, X(gEnd) - X(started.t)), height: 16, "class": "dg-node st-accent" }, g);
      }
      if (sent) {
        var tone = sent.crash ? "bad" : (sent.ok ? "ok" : "bad");
        var c = mk(doc, "g", { "class": "dg-node st-" + tone }, g);
        mk(doc, "circle", { cx: X(sent.t), cy: y, r: 7 }, c);
        txt(doc, g, X(sent.t) + 12, y - 12, sent.crash ? "no text, error" : "code " + sent.code, "dg-note", "start");
      }
    });
    // current.job over the window: a label at each change.
    var lastX = -100;
    shown.forEach(function (s) {
      if (s.t < P || s.t > P + end) return;
      var x = X(s.t);
      mk(doc, "line", { x1: x, y1: 140, x2: x, y2: 160, "class": "dg-axis" }, g);
      var label = s.cur.replace("job ", "");
      var lx = x - lastX < 62 ? lastX + 62 : x;
      txt(doc, g, lx + 3, 154, label, "dg-note", "start");
      lastX = lx;
    });
  }

  function drawTable(S) {
    var el = S.ui.el;
    clear(S.ui.tbody);
    var r = S.r;
    S.N.jobs.forEach(function (j) {
      var tr = el("tr");
      var s = r.texts[j.id];
      var sentText = "-";
      var res = "not sent yet";
      if (s) {
        if (s.crash) { sentText = "none"; res = "failed: error"; }
        else { sentText = s.code; res = s.ok ? "right, " + hms(s.t) : "WRONG: " + s.from + "'s, " + hms(s.t); }
      }
      [String(j.id), hms(j.at), j.street, j.phone, j.code, sentText, res].forEach(function (c) { tr.appendChild(el("td", "", c)); });
      S.ui.tbody.appendChild(tr);
    });
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    S.r = tally(C, S.N, S.shown);
    var r = S.r;
    S.ui.head.textContent = "Design: " + SHORT[C.design] + ". Call-outs 2413 and 2414 are " + C.gap +
      " ms apart; the geocoder takes " + fmt(C.delay) + " ms. Steps shown: " + S.shown + " of " + S.N.steps.length + ".";
    drawTimeline(S);
    drawTable(S);
    var t3 = r.texts[2413];
    var t4 = r.texts[2414];
    S.stat.right(r.right);
    S.stat.wrong(r.wrong);
    S.stat.failed(r.failed);
    S.stat.flagged(r.flagged);
    S.stat.current(r.cur);
    S.stat.tremellen(!t3 ? "no text yet" : (t3.crash ? "none, the code failed" : "code " + t3.code + (t3.ok ? " (her own)" : " (" + t3.from + ")")));
    S.stat.dunwiddie(!t4 ? "no text yet" : (t4.crash ? "none, the code failed" : hms(t4.t)));
    S.stat.wait(r.maxWait < 0 ? "none yet" : fmt(r.maxWait) + " ms");
    var last = S.shown ? S.N.steps[S.shown - 1].t : OPEN;
    api.clock = (last % DAY) / 1000;
    S.ctl.step.disable(S.shown >= S.N.steps.length);
    S.ctl.play.disable(S.shown >= S.N.steps.length);
  }

  function showTo(api, n) {
    var S = api.state;
    while (S.shown < n && S.shown < S.N.steps.length) {
      var s = S.N.steps[S.shown];
      S.shown += 1;
      api.clock = (s.t % DAY) / 1000;
      api.log(s.msg, s.tone);
    }
  }

  function summary(S) {
    var r = tally(S.C, S.N, S.N.steps.length);
    return "Night replayed with " + SHORT[S.C.design] + ", call-outs " + S.C.gap + " ms apart, geocoder " + fmt(S.C.delay) +
      " ms: " + r.right + " right codes, " + r.wrong + " wrong, " + r.failed + " failed" +
      (S.C.design === "log" ? ", " + r.flagged + " flagged in the morning check." : ".");
  }

  function replay(api) {
    var S = api.state;
    S.N = night(S.C);
    S.shown = 0;
    showTo(api, S.N.steps.length);
    var r = tally(S.C, S.N, S.N.steps.length);
    api.log(summary(S), r.wrong + r.failed ? "bad" : "ok");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s5e06", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { design: "built", gap: 200, delay: 300 };
      S.N = night(S.C);
      S.shown = 0;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.design = api.control.select("design", "Design", DESIGNS, "built", function (v) {
        var o = pick(DESIGNS, v);
        if (!o) return;
        S.C.design = String(o.value);
        replay(api);
      });
      S.ctl.gap = api.control.select("gap", "Gap between call-outs 2413 and 2414",
        GAPS.map(function (g) { return { value: g, label: g + " ms" }; }), 200,
        function (v) { S.C.gap = Number(v); replay(api); });
      S.ctl.delay = api.control.select("delay", "Geocoder's delay",
        DELAYS.map(function (d) { return { value: d, label: fmt(d) + " ms" }; }), 300,
        function (v) { S.C.delay = Number(v); replay(api); });
      S.ctl.pattern = api.control.select("pattern", "Pattern picker: where each one fits", PATTERNS, "none", function (v) {
        var o = pick(PATTERNS, v);
        if (!o || !o.fit) { S.ui.fit.textContent = ""; return; }
        S.ui.fit.textContent = o.fit;
        api.log(o.fit, "");
      });
      S.ctl.step = api.control.button("step", "Step", function () { showTo(api, S.shown + 1); draw(api); });
      S.ctl.play = api.control.button("play", "Play the night", function () {
        showTo(api, S.N.steps.length);
        var r = tally(S.C, S.N, S.N.steps.length);
        api.log(summary(S), r.wrong + r.failed ? "bad" : "ok");
        draw(api);
      });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        right: api.stat("right", "right codes sent", "ok"),
        wrong: api.stat("wrong", "wrong codes sent", "bad"),
        failed: api.stat("failed", "texts that failed", "bad"),
        flagged: api.stat("flagged", "mix-ups flagged in the morning check", "warn"),
        current: api.stat("current", "current.job after the last step", ""),
        tremellen: api.stat("tremellen", "code Ms Tremellen got", "warn"),
        dunwiddie: api.stat("dunwiddie", "Mr Dunwiddie's text went at", ""),
        wait: api.stat("wait", "longest wait, call-out to text", "")
      };

      api.info("<strong>How to read it.</strong> Each call-out runs dispatch(job): it saves the job, waits for the geocoder, " +
        "then texts the customer's phone a key-safe code. The timeline shows the two close call-outs, 2413 and 2414: a warning-coloured bar is a wait " +
        "in line, a highlighted bar a wait for the geocoder, and each dot a text with the code it carried. The bottom row shows what current.job " +
        "held after each step. The table shows which code went to which phone, all night. Step moves one step; Play runs the rest.");

      api.log("22:58:00. Six call-outs are due tonight; 2413 and 2414 come " + S.C.gap + " ms apart at 02:47:31. Press Step or Play.", "");
      draw(api);
      api.clock = (OPEN % DAY) / 1000;
    },

    selfTest: async function (t) {
      // Every line checked below is unique to its design and among the log's last 14 lines.
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens before the first call-out: nothing sent, current.job empty.
      t.expect(t.stat("right") === 0 && t.stat("wrong") === 0 && t.stat("failed") === 0 && t.stat("flagged") === 0 &&
        t.stat("current") === "empty" && t.stat("tremellen") === "no text yet" && t.stat("wait") === "none yet" &&
        has("Six call-outs are due tonight; 2413 and 2414 come 200 ms apart at 02:47:31."),
        "Opens at 22:58:00 before the first call-out: no texts, current.job empty");

      // 2. Six steps: the second close call-out overwrites current.job.
      for (var i = 0; i < 6; i++) t.click("step");
      t.expect(has("Job 2413, Bellfounder Row, arrives. current.job held job 2412; now it holds job 2413. Asking the geocoder, 300 ms (02:47:31.000).") &&
        has("Job 2414, Haverick Close, arrives. current.job held job 2413; now it holds job 2414. Asking the geocoder, 300 ms (02:47:31.200).") &&
        t.stat("current") === "job 2414" && t.stat("right") === 2 && t.stat("wrong") === 0,
        "Step 6: at 02:47:31.200 job 2414 overwrites current.job while 2413 waits on the geocoder");

      // 3. Step 7: the first call-out wakes and texts the wrong code.
      t.click("step");
      t.expect(has("Job 2413 wakes. current.job holds job 2414, so it texts 07700 900412 code 9026, the key safe at Haverick Close: the wrong door (02:47:31.300).") &&
        t.stat("wrong") === 1 && t.stat("tremellen") === "code 9026 (Haverick Close)",
        "At 02:47:31.300 Ms Tremellen's phone gets 9026, Mr Dunwiddie's code");

      // 4. Play the rest of the night.
      t.click("play");
      t.expect(has("Job 2414 wakes. current.job holds job 2414, so it texts 07700 900867 code 9026, its own key safe (02:47:31.500).") &&
        t.stat("right") === 5 && t.stat("wrong") === 1 && t.stat("failed") === 0 && t.stat("dunwiddie") === "02:47:31.500" &&
        t.stat("wait") === "300 ms" && t.stat("current") === "job 2416",
        "The whole night as built: 5 right, 1 wrong; Mr Dunwiddie's own code at 02:47:31.500");

      // 5. The window: a gap as long as the geocoder's delay, or longer, mixes nothing.
      t.set("gap", 300);
      var g300 = t.stat("wrong") === 0 && t.stat("right") === 6 && t.stat("tremellen") === "code 3158 (her own)";
      t.set("gap", 400);
      var g400 = t.stat("wrong") === 0;
      t.set("gap", 0);
      var g0 = t.stat("wrong") === 1;
      t.set("gap", 100);
      var g100 = t.stat("wrong") === 1;
      t.expect(g300 && g400 && g0 && g100, "As built at 300 ms: gaps of 0 and 100 ms mix the codes; 300 and 400 ms do not");

      // 6. The geocoder's delay sets the window.
      t.set("gap", 200);
      t.set("delay", 100);
      var d100 = t.stat("wrong") === 0;
      t.set("delay", 2000);
      t.expect(d100 && t.stat("wrong") === 1 && t.stat("tremellen") === "code 9026 (Haverick Close)",
        "200 ms apart: a 100 ms geocoder mixes nothing, a 2,000 ms one mixes the codes");

      // 7. Queue: right codes, and the second call-out waits behind the geocoder.
      t.set("delay", 300);
      t.set("design", "queue");
      var q300 = has("Job 2414, Haverick Close, arrives and waits in line behind job 2413 (02:47:31.200).") &&
        has("Job 2414 leaves the line and starts. current.job held job 2413; now it holds job 2414. Asking the geocoder, 300 ms (02:47:31.300).") &&
        t.stat("wrong") === 0 && t.stat("right") === 6 && t.stat("dunwiddie") === "02:47:31.600" && t.stat("wait") === "400 ms";
      t.set("delay", 2000);
      t.expect(q300 && t.stat("dunwiddie") === "02:47:35.000" && t.stat("wait") === "3,800 ms" && t.stat("wrong") === 0,
        "Queue: 6 right; Mr Dunwiddie's text waits until 02:47:31.600, or 02:47:35.000 with a 2,000 ms geocoder");

      // 8. Clear after each text: the same leak, and the second call-out fails.
      t.set("delay", 300);
      t.set("design", "clear");
      t.expect(has("Job 2413 wakes. current.job holds job 2414, so it texts 07700 900412 code 9026, the key safe at Haverick Close: the wrong door. Then current.job is cleared (02:47:31.300).") &&
        has("Job 2414 wakes. current.job is empty, so reading its key-safe code fails with an error: no text goes to 07700 900867 (02:47:31.500).") &&
        t.stat("right") === 4 && t.stat("wrong") === 1 && t.stat("failed") === 1 && t.stat("dunwiddie") === "none, the code failed",
        "Clear after: Ms Tremellen still gets 9026, then Mr Dunwiddie's text fails: 4 right, 1 wrong, 1 failed");

      // 9. Log the job number: the mix-up is flagged, after the code has gone.
      t.set("design", "log");
      t.expect(has("The log line says job 2414 for 07700 900412, a mismatch for the morning check. Job 2413 wakes. current.job holds job 2414, so it texts 07700 900412 code 9026") &&
        t.stat("wrong") === 1 && t.stat("flagged") === 1 && t.stat("right") === 5,
        "Log: the wrong code still goes at 02:47:31.300; the morning check flags 1 line");

      // 10. Pass the job: every call-out gets its own code, at any gap and delay.
      t.set("design", "pass");
      var p1 = t.stat("right") === 6 && t.stat("wrong") === 0 && t.stat("current") === "not used" &&
        has("Job 2413 wakes and texts 07700 900412 its own code, 3158 (02:47:31.300).");
      t.set("gap", 0);
      t.set("delay", 2000);
      t.expect(p1 && t.stat("right") === 6 && t.stat("wrong") === 0 && t.stat("failed") === 0 && t.stat("tremellen") === "code 3158 (her own)",
        "Pass the job: 6 right codes at 200 ms and 300 ms, and still at 0 ms and 2,000 ms");

      // 11. The pattern picker gives each pattern's fit.
      t.set("pattern", "singleton");
      var s1 = has("Singleton: one shared object for the whole program.");
      t.set("pattern", "observer");
      t.expect(s1 && has("Observer: others sign up to be told when something happens."),
        "The pattern picker logs where the singleton and the observer fit");
    }
  });
})();
