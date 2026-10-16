/* sims/s9e16-v1.0.0.js  (published as sims/s9e16.js)
   Case s9e16 "The Model Farm": a batching lab for Dunnerholme Mushrooms' GPU server, the night of
   Thursday 15 October 2026, when robot 3 picked beds 1 to 4 alone from 23:00 to 03:00 while the
   other eleven robots were in their twice-yearly clean. Each robot's camera sends 4 photos a second
   to one shared GPU server. The server collects photos into a batch until it holds the largest batch
   (16) or its first photo has waited the longest wait (2 seconds), then runs the model once over the
   batch (one pass, 0.05 seconds whatever its size) and sends every answer back. An arm needs its
   answer within 1 second of the photo; as built, a late answer means the mushroom is skipped.
   The learner picks the robots running, the longest wait, the largest batch, the GPU's speed, the
   number of GPU servers, what an arm does with a late answer, a cache and a per-robot rate limit,
   then steps the first 5 seconds in 0.05-second steps (each photo's arrival, answer and result) and
   runs the whole 4-hour night (photos, ripe finds, picked, skipped, GPU busy, time paused).
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls robots (1, 12, 12 with robot 7's camera stuck),
     longest wait (2, 0.1 s), largest batch (16, 32, 1), GPU pass (0.05, 0.025 s), GPU servers
     (1, 3), late answer (skip, pause), cache, per-robot rate limit; step 0.05 s, step 0.25 s, play
     to 5 s, run the 4-hour night, reset. selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e16-v1.0.0.json).
   All of it is given data stated in sim.lede; each result is checked by the selfTest.
   - Time is counted in units of 1/2400 second, so every time below is a whole number of units.
   - One robot (robot 3 tonight): photo k arrives at 0.25 x (k - 1) seconds. Twelve robots take
     turns through each quarter second: one photo every 1/48 second, the first at 1/48 (0.02 s).
     48 photos a second.
   - As built: largest batch 16, longest wait 2 s counted from a batch's first photo, a pass takes
     0.05 s whatever the batch holds, a photo arriving exactly as the wait ends starts the next
     batch. The arm's limit is 1 s after its photo.
   - One robot, as built: a batch holds photos at 0, 0.25 ... 1.75 = 8 photos, is sent at 2.00,
     answers at 2.05. Photo k's limit is 0.25 x (k - 1) + 1: photos 1 to 5 (limits 1.00 to 2.00)
     are late, 6 to 8 (2.25 to 2.75) in time: 3 of 8.
   - The night: 23:00 to 03:00, 4 hours = 14,400 s, 4 photos a second = 57,600 photos, 7,200
     batches. Given data: 1 photo in 30 shows a ripe mushroom (1,920), and ripe finds fall evenly
     across the places in a batch, so picked = photos answered in time / 30: 21,600 / 30 = 720,
     skipped 1,920 - 720 = 1,200. GPU busy: 7,200 x 0.05 / 14,400 = 2.5%.
   - Twelve robots, as built: photos 1 to 16 arrive at 1/48 ... 16/48 s; the batch is full at
     16/48 = 0.33 s, answers at 0.38. A batch every 0.33 s: 3 a second x 0.05 = 15% busy.
   - The fix (wait 0.1 s, pause): one robot, batches of 1, each answer 0.15 s after its photo,
     4 passes a second x 0.05 = 20% busy, all 1,920 picked. Twelve robots: a batch's first photo
     waits 0.1 s and 5 photos arrive in that time (5/48 = 0.104 s for the next), so batches of 5,
     one every 5/48 s = 9.6 a second x 0.05 = 48% busy, every answer 0.15 s after its photo.
   - Faster GPU (0.025 s a pass): one robot's answers at 2.025; photo 5's limit is 2.00: still
     3 of 8, 720 picked; busy 1.25%.
   - Largest batch 32: one robot still 8 a batch (the 2 s wait ends it); twelve robots: full at
     32/48 = 0.67 s, answers at 0.72.
   - Largest batch 1 (each photo on its own): one robot, every answer 0.05 s after its photo,
     1,920 picked, 20% busy. Twelve robots on one server: 48 x 0.05 = 2.4 s of passes every
     second, so the server falls further behind: 1 of 23,040 ripe picked, 100% busy. On 3 servers
     each gets 16 a second, 16 x 0.05 = 80% busy, every answer in time, 23,040 picked.
   - More GPU servers (3, 2 s wait, one robot): photos are dealt to the servers in turn, so each
     server gets one every 0.75 s; a batch holds photos at 0, 0.75 and 1.50, sent at 2.00: only the
     third is in time. 1 in 3: 640 picked, 1,280 skipped; 19,200 batches, busy 2.22%.
   - Pause (as built): a paused arm waits from its 1-second limit until the answer: for each batch
     1.00 to 2.05 = 1.05 s; 7,200 batches = 7,560 s = 2 h 6 min paused, all 1,920 picked. In this
     sim the camera keeps its pace while an arm waits.
   - Cache: given data, no photo repeats tonight (each shows a new spot), so the cache answers 0.
   - Robot 7's camera stuck at 400 photos a second (a fault, for the rate-limit lesson; its arm is
     stopped, so its photos are noise): 11 x 4 + 400 = 444 a second, more than the GPU's most,
     16 photos per 0.05 s = 320 a second, so with the fix's 0.1 s wait the GPU is 100% busy and
     the answers fall further behind all night. A per-robot limit of 4 a second (one photo per
     0.25 s) turns away 396 a second from robot 7: 396 x 14,400 = 5,702,400 in the night; every
     answer is in time again and the GPU is 46.67% busy (robot 7's one allowed photo a quarter
     second lands between the others' slots, so batch sizes vary around 5).
*/
(function () {
  "use strict";

  var U = 2400;               // units per second
  var CYCLE = 600;            // 0.25 s: one photo per robot
  var LIMIT = 2400;           // the arm's 1 second
  var NIGHT_S = 14400;        // 23:00 to 03:00
  var RIPE_EVERY = 30;        // 1 photo in 30 shows a ripe mushroom
  var SHOW = 16;              // photos shown in the table
  var LAB_END = 12000;        // the lab clock runs to 5.00 s

  var ROBOT_OPTS = [
    { value: "1", label: "1: robot 3 alone (tonight)" },
    { value: "12", label: "12: all robots (a normal night)" },
    { value: "stuck", label: "12, robot 7's camera stuck at 400 a second" }
  ];
  var WAIT_OPTS = [
    { value: "2", label: "2 seconds (as built)" },
    { value: "0.1", label: "0.1 seconds" }
  ];
  var BATCH_OPTS = [
    { value: "16", label: "16 photos (as built)" },
    { value: "32", label: "32 photos" },
    { value: "1", label: "1 photo: each on its own" }
  ];
  var GPU_OPTS = [
    { value: "0.05", label: "0.05 seconds a pass (as built)" },
    { value: "0.025", label: "0.025 seconds a pass: twice as fast" }
  ];
  var SERVER_OPTS = [
    { value: "1", label: "1 (as built)" },
    { value: "3", label: "3, photos dealt to each in turn" }
  ];
  var LATE_OPTS = [
    { value: "skip", label: "skip the mushroom (as built)" },
    { value: "pause", label: "pause until the answer comes" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function comma(n) {
    var s = String(Math.round(n));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  // Seconds from units: 2 decimals when exact, 3 when exact in thousandths, else rounded to 2.
  function sec(u) {
    if (u % 24 === 0) return (u / 2400).toFixed(2);
    if (u % 12 === 0) return (u / 2400).toFixed(3);
    var h = Math.round(u / 24);
    return (Math.floor(h / 100)) + "." + (h % 100 < 10 ? "0" : "") + (h % 100);
  }
  function hm(s) {
    s = Math.round(s);
    if (s < 60) return s + " s";
    var h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    return (h ? h + " h " : "") + m + " min";
  }
  function pct(x) {
    var p = Math.round(x * 10000) / 100;
    return (p >= 100 ? "100" : String(p)) + "%";
  }

  // One quarter second of arrivals: offset in units (sorted), robot, and whether it is noise.
  function cyclePattern(robots) {
    var out = [];
    if (robots === "1") return [{ off: 0, robot: 3, noise: false }];
    for (var r = 1; r <= 12; r++) {
      if (robots === "stuck" && r === 7) continue;
      out.push({ off: r * 50, robot: r, noise: false });
    }
    if (robots === "stuck") {
      for (var m = 0; m < 100; m++) out.push({ off: ((350 + 6 * m - 1) % CYCLE) + 1, robot: 7, noise: true });
    }
    out.sort(function (a, b) { return a.off - b.off || a.robot - b.robot; });
    return out;
  }

  /* ---------- the model: an exact replay of the server ---------- */

  function simulate(C, cycles, keep) {
    var W = C.wait === "2" ? 4800 : 240;
    var B = Number(C.batch);
    var G = C.gpu === "0.05" ? 120 : 60;
    var K = Number(C.servers);
    var pat = cyclePattern(C.robots);
    var srv = [];
    var k;
    for (k = 0; k < K; k++) srv.push({ open: false, first: 0, items: [], free: 0 });
    var r = {
      sent: 0, real: 0, noise: 0, refused: 0, inTime: 0, late: 0, batches: 0, gpu: 0,
      paused: 0, slowest: 0, sizes: [], shown: [], firstBatch: null
    };
    var lastOk = {}, pausedTo = {};
    var dealt = 0;

    function close(s, at) {
      var start = Math.max(at, s.free);
      var end = start + G;
      s.free = end;
      r.batches++;
      r.gpu += G;
      var n = s.items.length;
      if (keep) r.sizes.push({ at: at, n: n });
      if (keep && !r.firstBatch) r.firstBatch = { n: n, at: at, ans: end };
      s.items.forEach(function (p) {
        p.ans = end;
        p.batch = r.batches;
        if (p.noise) return;
        var due = p.a + LIMIT;
        if (end - p.a > r.slowest) r.slowest = end - p.a;
        if (end <= due) { r.inTime++; p.ok = true; return; }
        r.late++;
        p.ok = false;
        if (C.late === "pause") {
          var from = Math.max(due, pausedTo[p.robot] || 0);
          if (end > from) r.paused += end - from;
          pausedTo[p.robot] = Math.max(pausedTo[p.robot] || 0, end);
        }
      });
      s.items = [];
      s.open = false;
    }

    for (var c = 0; c < cycles; c++) {
      for (var i = 0; i < pat.length; i++) {
        var a = c * CYCLE + pat[i].off;
        var robot = pat[i].robot;
        r.sent++;
        var p = { n: r.sent, a: a, robot: robot, noise: pat[i].noise, ans: null, batch: null, ok: null, refused: false };
        if (keep && r.shown.length < SHOW) r.shown.push(p);
        if (C.limit && lastOk[robot] !== undefined && a - lastOk[robot] < CYCLE) {
          r.refused++;
          p.refused = true;
          continue;
        }
        lastOk[robot] = a;
        if (p.noise) r.noise++; else r.real++;
        var s = srv[dealt % K];
        dealt++;
        if (s.open && a >= s.first + W) close(s, s.first + W);
        if (!s.open) { s.open = true; s.first = a; }
        s.items.push(p);
        if (s.items.length >= B) close(s, a);
      }
    }
    srv.forEach(function (s) { if (s.open) close(s, s.first + W); });
    r.K = K;
    return r;
  }

  function nightOf(C) {
    var r = simulate(C, NIGHT_S * 4, false);
    var ripe = r.real / RIPE_EVERY;
    var picked = C.late === "pause" ? ripe : Math.round(r.inTime / RIPE_EVERY);
    return {
      photos: r.sent, ripe: ripe, picked: picked, skipped: ripe - picked,
      busy: Math.min(1, r.gpu / (U * NIGHT_S * r.K)), batches: r.batches,
      paused: r.paused / U, refused: r.refused, real: r.real, inTime: r.inTime
    };
  }

  /* ---------- the widget ---------- */

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
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:12px;");
    var thead = el("thead");
    var hr = el("tr");
    ["photo", "robot", "arrives", "batch", "answer", "result"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);
    api.root.appendChild(box);
    return { el: el, head: head, tbody: tbody };
  }

  function lab(S) {
    if (!S.lab) S.lab = simulate(S.C, 40, true);
    return S.lab;
  }

  function resultText(C, p, T) {
    if (p.refused) return "turned away by the rate limit";
    if (p.noise) return p.ans !== null && p.ans <= T ? "answered (noise)" : "waiting (noise)";
    var due = p.a + LIMIT;
    if (p.ans !== null && p.ans <= T) {
      if (p.ok) return "in time: " + sec(p.ans - p.a) + " s after its photo";
      return C.late === "pause" ? "late: arm paused " + sec(p.ans - due) + " s" : "late: skipped at " + sec(due) + " s";
    }
    if (T >= due) return C.late === "pause" ? "no answer at 1 s: arm pauses" : "no answer at 1 s: skipped";
    return "waiting";
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var T = S.t;
    var L = lab(S);
    var ui = S.ui;
    ui.head.textContent = sec(T) + " s. " + pick(ROBOT_OPTS, C.robots).label + ". A batch goes at " + C.batch +
      (C.batch === "1" ? " photo" : " photos") + " or after " + C.wait + " s, a pass takes " + C.gpu + " s, " + C.servers +
      (C.servers === "1" ? " GPU server" : " GPU servers") + ". A late answer: " + pick(LATE_OPTS, C.late).label + "." +
      (C.cache ? " Cache on." : "") + (C.limit ? " Rate limit: 4 photos a second per robot." : "");
    // A photo shows once the clock has reached it; at the opening 0.00 s, photo 1 is about to arrive.
    function seen(p) { return p.a < T || (p.a === T && T > 0); }
    clear(ui.tbody);
    L.shown.forEach(function (p) {
      if (!seen(p)) return;
      var tr = ui.el("tr");
      var answered = p.ans !== null && p.ans <= T;
      [String(p.n), String(p.robot), sec(p.a), p.refused ? "-" : (p.batch && p.ans - (C.gpu === "0.05" ? 120 : 60) <= T ? String(p.batch) : "collecting"),
        answered ? sec(p.ans) : "-", resultText(C, p, T)].forEach(function (c) { tr.appendChild(ui.el("td", "", c)); });
      ui.tbody.appendChild(tr);
    });

    var arrived = 0, answered = 0, ok = 0, slow = 0;
    L.shown.forEach(function (p) {
      if (seen(p)) arrived++;
      if (!p.refused && !p.noise && p.ans !== null && p.ans <= T) {
        answered++;
        if (p.ok) ok++;
        if (p.ans - p.a > slow) slow = p.ans - p.a;
      }
    });
    var sizes = [];
    L.sizes.forEach(function (b) { if (b.at <= T && sizes.indexOf(b.n) < 0) sizes.push(b.n); });
    var fb = L.firstBatch;
    S.stat.time(sec(T) + " s");
    S.stat.arrived(arrived);
    S.stat.sizes(sizes.length ? sizes.join(", ") : "none sent yet");
    S.stat.first(fb && fb.at <= T ? fb.n + " photos, sent at " + sec(fb.at) + " s, answers at " + sec(fb.ans) + " s" : "still collecting");
    S.stat.intime(answered ? ok + " of " + answered : "none answered yet");
    S.stat.slowest(answered ? sec(slow) + " s" : "-");

    var N = S.night;
    S.stat.photos(N ? comma(N.photos) : "not run yet");
    S.stat.ripe(N ? comma(N.ripe) : "-");
    S.stat.picked(N ? comma(N.picked) : "-");
    S.stat.skipped(N ? comma(N.skipped) : "-");
    S.stat.busy(N ? pct(N.busy) : "-");
    S.stat.paused(N ? hm(N.paused) : "-");
    S.stat.refused(N ? comma(N.refused) : "-");
    S.stat.cache(N ? 0 : "-");
  }

  function logStep(api, from, to) {
    var S = api.state;
    var C = S.C;
    var L = lab(S);
    var G = C.gpu === "0.05" ? 120 : 60;
    L.sizes.forEach(function (b, i) {
      if (b.at > from && b.at <= to && i < 4) {
        api.log(sec(b.at) + " s batch " + (i + 1) + " sent with " + b.n + (b.n === 1 ? " photo" : " photos") + "; answers at " + sec(b.at + G) + " s.", "");
      }
    });
    L.shown.forEach(function (p) {
      if (p.refused || p.noise) return;
      var due = p.a + LIMIT;
      if (!p.ok && p.ans !== null && due > from && due <= to) {
        api.log(sec(due) + " s photo " + p.n + ": no answer 1 second after its photo, " + (C.late === "pause" ? "the arm pauses." : "skipped."), "bad");
      }
    });
  }

  function advance(api, to) {
    var S = api.state;
    if (S.t >= LAB_END) { api.log("The lab clock is at 5.00 s. Run the night, change a setting or reset.", ""); return; }
    if (to > LAB_END) to = LAB_END;
    logStep(api, S.t, to);
    S.t = to;
    draw(api);
  }

  function runNight(api) {
    var S = api.state;
    var C = S.C;
    var N = nightOf(C);
    S.night = N;
    api.log("23:00 to 03:00, 4 hours: " + comma(N.photos) + " photos, " + comma(N.batches) + " batches, " + comma(N.ripe) +
      " showing a ripe mushroom. Picked " + comma(N.picked) + ", skipped " + comma(N.skipped) + ". GPU busy " + pct(N.busy) +
      (C.late === "pause" ? ". Arms paused " + hm(N.paused) : "") + (C.limit ? ". Turned away by the rate limit: " + comma(N.refused) : "") + ".",
      N.skipped > 0 ? "bad" : (N.paused > 0 ? "warn" : "ok"));
    if (C.cache) api.log("Cache: 0 answers from the cache. No photo repeated tonight; each one showed a new spot.", "warn");
    draw(api);
  }

  function change(api, what) {
    var S = api.state;
    S.t = 0;
    S.lab = null;
    S.night = null;
    api.log(what + " Back to 0.00 s.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e16", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { robots: "1", wait: "2", batch: "16", gpu: "0.05", servers: "1", late: "skip", cache: false, limit: false };
      S.t = 0;
      S.lab = null;
      S.night = null;
      S.ui = buildWidget(api);

      function sel(id, label, list) {
        api.control.select(id, label, list, S.C[id], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[id] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      function tog(id, label, on1, off1) {
        api.control.toggle(id, label, false, function (on) {
          S.C[id] = !!on;
          change(api, on ? on1 : off1);
        });
      }
      sel("robots", "robots running", ROBOT_OPTS);
      sel("wait", "longest wait for a batch", WAIT_OPTS);
      sel("batch", "largest batch", BATCH_OPTS);
      sel("gpu", "GPU speed", GPU_OPTS);
      sel("servers", "GPU servers", SERVER_OPTS);
      sel("late", "when an answer is late", LATE_OPTS);
      tog("cache", "cache: answer a repeated photo from saved answers", "Cache on: a photo seen before is answered from saved answers, with no pass.", "Cache off.");
      tog("limit", "rate limit: 4 photos a second per robot", "Rate limit on: each robot may send 4 photos a second; extra photos are turned away.", "Rate limit off.");
      api.control.button("step", "step 0.05 seconds", function () { advance(api, api.state.t + 120); });
      api.control.button("quarter", "step 0.25 seconds", function () { advance(api, api.state.t + 600); });
      api.control.button("play", "play to 5 seconds", function () { advance(api, LAB_END); });
      api.control.button("night", "run the 4-hour night", function () { runNight(api); });
      api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "lab clock", ""),
        arrived: api.stat("arrived", "photos arrived (first 16 shown)", ""),
        sizes: api.stat("sizes", "batch sizes sent", ""),
        first: api.stat("first", "batch 1", ""),
        intime: api.stat("intime", "answers in time, of those answered", "ok"),
        slowest: api.stat("slowest", "slowest answer after its photo", "warn"),
        photos: api.stat("photos", "night: photos", ""),
        ripe: api.stat("ripe", "night: photos showing a ripe mushroom", ""),
        picked: api.stat("picked", "night: picked", "ok"),
        skipped: api.stat("skipped", "night: skipped, no answer in time", "bad"),
        busy: api.stat("busy", "night: GPU busy", ""),
        paused: api.stat("paused", "night: arms paused", "warn"),
        refused: api.stat("refused", "night: photos turned away", ""),
        cache: api.stat("cache", "night: answers from the cache", "")
      };

      api.info("<strong>How to read it.</strong> A batch goes in four steps. The server collects photos as they arrive. It stops at the largest batch, or when the first photo has waited the longest wait. The GPU runs the model once over the batch, one pass. Every answer goes back to its robot. An arm picks in three steps: its camera takes a photo, the arm waits for the answer, and if the answer is ripe and came within 1 second, it picks. Each table row is one photo: when it arrived, its batch, when its answer came and what the arm did. The lab clock counts seconds from the first photo; run the night for the 4-hour totals.");

      api.log("Thursday 15 October, 23:00: robot 3 starts bed 1 alone. The GPU server's batch is empty.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      var BUILT = { robots: "1", wait: "2", batch: "16", gpu: "0.05", servers: "1", late: "skip", cache: false, limit: false };
      function as(set) { Object.keys(set).forEach(function (k) { t.set(k, set[k]); }); }
      function fresh(set) { as(BUILT); as(set || {}); }

      // 1. Opening state: 0.00 s, no photos, nothing sent, the night not run.
      t.expect(t.stat("time") === "0.00 s" && t.stat("arrived") === 0 && t.stat("sizes") === "none sent yet" &&
        t.stat("photos") === "not run yet" && has("Thursday 15 October, 23:00: robot 3 starts bed 1 alone."),
        "Opens at 0.00 s with robot 3 alone, no photos and the night not yet run");

      // 2. As built, one robot, to 2.50 s: batch 1 of 8 sent at 2.00, answers at 2.05; 3 of 8 in time.
      fresh({});
      t.click("play");
      t.expect(t.stat("first") === "8 photos, sent at 2.00 s, answers at 2.05 s" && t.stat("sizes") === 8 &&
        t.stat("slowest") === "2.05 s" && has("1.00 s photo 1: no answer 1 second after its photo, skipped.") &&
        has("2.00 s photo 5: no answer 1 second after its photo, skipped.") && !has("2.25 s photo 6: no answer"),
        "One robot, 2 s wait: batches of 8, answers at 2.05, photos 1 to 5 skipped, 6 to 8 in time");

      // 3. As built, the night: 57,600 photos, 1,920 ripe, 720 picked, 1,200 skipped, 2.5% busy.
      t.click("night");
      t.expect(t.stat("photos") === "57,600" && t.stat("ripe") === "1,920" && t.stat("picked") === 720 &&
        t.stat("skipped") === "1,200" && t.stat("busy") === "2.5%" && has("7,200 batches"),
        "The night as built: 57,600 photos, 7,200 batches, 1,920 ripe, 720 picked, 1,200 skipped, GPU 2.5% busy");

      // 4. Twelve robots, as built: batches of 16 sent at 0.33, answers at 0.38; every answer in time.
      fresh({ robots: "12" });
      t.click("play");
      var a4 = t.stat("first") === "16 photos, sent at 0.33 s, answers at 0.38 s" && t.stat("sizes") === 16 && t.stat("intime") === "16 of 16";
      t.click("night");
      t.expect(a4 && t.stat("skipped") === 0 && t.stat("picked") === "23,040" && t.stat("busy") === "15%",
        "Twelve robots: full batches of 16 at 0.33 s, answers at 0.38 s, nothing skipped, GPU 15% busy");

      // 5. The fix, one robot: wait 0.1 s and pause. Batches of 1, every answer 0.15 s after its photo.
      fresh({ wait: "0.1", late: "pause" });
      t.click("play");
      var a5 = t.stat("sizes") === 1 && t.stat("slowest") === "0.15 s" && t.stat("intime") === "16 of 16";
      t.click("night");
      t.expect(a5 && t.stat("picked") === "1,920" && t.stat("skipped") === 0 && t.stat("busy") === "20%" && t.stat("paused") === "0 s",
        "The fix, one robot: batches of 1, every answer by 0.15 s, all 1,920 picked, no pause, GPU 20% busy");

      // 6. The fix, twelve robots: batches of 5, every answer by 0.15 s, GPU 48% busy.
      fresh({ robots: "12", wait: "0.1", late: "pause" });
      t.click("play");
      var a6 = t.stat("sizes") === 5 && t.stat("slowest") === "0.15 s";
      t.click("night");
      t.expect(a6 && t.stat("busy") === "48%" && t.stat("skipped") === 0 && t.stat("paused") === "0 s" && has("138,240 batches"),
        "The fix, twelve robots: batches of 5, 9.6 a second (138,240 in 4 hours), every answer by 0.15 s, GPU 48% busy");

      // 7. Option 0: a GPU twice as fast still misses: answers at 2.025, photo 5's limit was 2.00.
      fresh({ gpu: "0.025" });
      t.click("play");
      var a7 = t.stat("first") === "8 photos, sent at 2.00 s, answers at 2.025 s" && has("2.00 s photo 5: no answer");
      t.click("night");
      t.expect(a7 && t.stat("picked") === 720 && t.stat("skipped") === "1,200" && t.stat("busy") === "1.25%",
        "Faster GPU: answers at 2.025 s, photos 1 to 5 still skipped, 720 picked, GPU 1.25% busy");

      // 8. Option 2: a larger batch. One robot unchanged; twelve robots answered at 0.72.
      fresh({ batch: "32" });
      t.click("night");
      var a8 = t.stat("picked") === 720;
      fresh({ batch: "32", robots: "12" });
      t.click("play");
      t.expect(a8 && t.stat("first") === "32 photos, sent at 0.67 s, answers at 0.72 s",
        "Largest batch 32: robot 3 still gets 720; twelve robots wait for 32 and get answers at 0.72 s");

      // 9. Option 3 (warn): each photo on its own. One robot fine; twelve need 3 GPU servers.
      fresh({ batch: "1" });
      t.click("night");
      var a9 = t.stat("picked") === "1,920" && t.stat("busy") === "20%";
      fresh({ batch: "1", robots: "12" });
      t.click("night");
      var behind = t.stat("busy") === "100%" && t.stat("picked") === 1 && t.stat("skipped") === "23,039";
      fresh({ batch: "1", robots: "12", servers: "3" });
      t.click("night");
      t.expect(a9 && behind && t.stat("skipped") === 0 && t.stat("busy") === "80%",
        "One at a time: robot 3 picks all 1,920; twelve robots swamp one server; three servers keep up, each 80% busy");

      // 10. More GPU servers with the 2 s wait: robot 3 does worse, not better.
      fresh({ servers: "3" });
      t.click("night");
      t.expect(t.stat("picked") === 640 && t.stat("skipped") === "1,280" && t.stat("busy") === "2.22%",
        "Three GPU servers with the 2 s wait: each batch waits longer, robot 3 picks 640, fewer than 720");

      // 11. Pause alone, as built: everything picked, but the arm stands still 2 h 6 min of the 4 hours.
      fresh({ late: "pause", cache: true });
      t.click("night");
      t.expect(t.stat("picked") === "1,920" && t.stat("paused") === "2 h 6 min" && t.stat("cache") === 0 &&
        has("Cache: 0 answers from the cache."),
        "Pause with the 2 s wait: 1,920 picked but arms paused 2 h 6 min; the cache answers 0");

      // 12. Robot 7's camera stuck at 400 a second swamps the GPU; a per-robot limit of 4 a second protects it.
      fresh({ robots: "stuck", wait: "0.1", late: "pause" });
      t.click("night");
      var swamped = t.stat("busy") === "100%";
      fresh({ robots: "stuck", wait: "0.1", late: "pause", limit: true });
      t.click("night");
      t.expect(swamped && t.stat("busy") === "46.67%" && t.stat("paused") === "0 s" && t.stat("skipped") === 0 && t.stat("refused") === "5,702,400",
        "Stuck camera: the GPU is swamped; with 4 a second per robot, 5,702,400 photos are turned away and every answer is on time");
    }
  });
})();
