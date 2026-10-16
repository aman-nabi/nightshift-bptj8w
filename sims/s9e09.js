/* sims/s9e09-v1.0.0.js  (published as sims/s9e09.js)
   Case s9e09 "Remembering Everything": an index lab for a 24-hour tool-hire depot on the night of
   Tuesday 29 to Wednesday 30 September 2026. Staff ask an assistant questions; it looks the answer
   up in an index of 12,000 chunks of tool manuals (each chunk stored as a list of numbers made by
   an embedding model), then a language model writes the answer from the chunks handed to it.
   The provider retires embedding model v1 at the end of Wednesday 30 September, so at 00:00 a job
   re-embeds every chunk with v2. The learner picks how the re-index runs (in place, or beside and
   switched after a test set), the match bar, the chunk size, offline, and a version check, then
   steps the night from 23:48 to 08:00 in 12-minute steps. Widget-style sim: it draws inside
   api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls re-index plan, match bar, chunk size, offline,
     version check; buttons Next 12 minutes, Play to 08:00, Reset. Stats: time, questions on,
     chunks on v2, chunks on v1, the C-27 question's answer, its similarity, right or wrong page,
     test set right, test pages wrong, hours without answers, switch, job finishes.
     selfTest: 11 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e09-v1.0.0.json).
   All of it is given data stated in the post or in sim.lede, and each result is checked by selfTest.
   - 3,000 pages of manuals cut into 12,000 chunks (4 a page), numbered in the order their manuals
     were added. Half-size chunks (option 3): 24,000 chunks, every chunk number doubled, the sample
     keeps its scores (given data).
   - The job: from 00:00, 1,500 chunks an hour in chunk-number order, so 300 per 12-minute step.
     The sim opens at 23:48 (step 0); step k is 23:48 + 12k minutes. At step k >= 1 the job has
     done 300 x (k - 1): 04:48 is step 25, 4.8 hours after 00:00, 7,200 done and 4,800 left.
     12,000 done at 08:00 (step 41); 24,000 would take 16 hours, to 16:00.
   - Match bar 0.80 (as built) or 0.95 (option 1). A chunk is handed over only if its similarity
     is above the bar; the highest one is the answer's source.
   - Each sample chunk's similarity is given three ways: a v1 question against v1 numbers (s1), a v2
     question against v2 numbers (s2), and a v2 question against v1 numbers (x, chance). Kept here
     in hundredths. The post's log at 04:48: mixer 11,208 v1 x 0.91, generator 2,415 v2 s2 0.74,
     trimmer 5,030 v2 s2 0.69, saw 9,612 v1 x 0.42.
   - The test set: 5 known questions (the C-27 question first), each with its right page and one
     other page (the C-27 question has three others). "Passes" means all 5 find their right page.
   - Offline (option 2): no answers from 00:00 until the job is done: 8 hours (16 with half-size).
   - Version check: a chunk whose numbers came from a different model than the question's is
     refused, never compared.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers (times in minutes after midnight, scores in hundredths) ---------- */

  var START = 23 * 60 + 48;   // 23:48, the sim opens here
  var STEP = 12;              // minutes a step
  var LAST = 41;              // 41 steps: 00:00 to 08:00
  var ASK = 25;               // 04:48, the contractor's question
  var PER_STEP = 300;         // 1,500 chunks an hour
  var PER_HOUR = 1500;
  var CHUNKS = 12000;

  // Five known questions. Chunk n, page, s1 (v1 vs v1), s2 (v2 vs v2), x (v2 question vs v1 chunk).
  var TESTS = [
    { ask: "fuel mix, C-27 cut-off saw", chunks: [
      { n: 9612, page: "C-27 cut-off saw p4, fuel", s1: 88, s2: 89, x: 42 },
      { n: 11208, page: "M-06 cement mixer p6, drum speed", s1: 29, s2: 31, x: 91 },
      { n: 2415, page: "G-41 generator p3, fuel tank", s1: 71, s2: 74, x: 38 },
      { n: 5030, page: "T-33 hedge trimmer p2, fuel cap", s1: 66, s2: 69, x: 55 }] },
    { ask: "dust bag, F-12 floor sander", chunks: [
      { n: 1180, page: "F-12 floor sander p5, dust bag", s1: 86, s2: 87, x: 33 },
      { n: 8410, page: "K-08 plate compactor p2, wheels", s1: 24, s2: 26, x: 47 }] },
    { ask: "socket type, G-41 generator", chunks: [
      { n: 3905, page: "G-41 generator p7, sockets", s1: 84, s2: 86, x: 40 },
      { n: 10050, page: "F-12 floor sander p9, cable", s1: 30, s2: 28, x: 84 }] },
    { ask: "weight, K-08 plate compactor", chunks: [
      { n: 7950, page: "K-08 plate compactor p1, weight", s1: 87, s2: 88, x: 51 },
      { n: 4120, page: "M-06 cement mixer p9, storage", s1: 22, s2: 25, x: 36 }] },
    { ask: "blade cover, T-33 hedge trimmer", chunks: [
      { n: 6300, page: "T-33 hedge trimmer p4, blade cover", s1: 85, s2: 86, x: 45 },
      { n: 9880, page: "C-27 cut-off saw p8, carry case", s1: 27, s2: 30, x: 97 }] }
  ];

  var PLANS = [
    { value: "inplace", label: "in place, questions on v2 from 00:00 (as run)" },
    { value: "beside", label: "beside the old index, switched after the test set" }
  ];
  var BARS = [{ value: "0.80", label: "0.80 (as built)" }, { value: "0.95", label: "0.95" }];
  var SIZES = [
    { value: "quarter", label: "about a quarter page (12,000 chunks)" },
    { value: "eighth", label: "about an eighth of a page (24,000 chunks)" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hm(t) { var m = ((t % 1440) + 1440) % 1440; return two(Math.floor(m / 60)) + ":" + two(m % 60); }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function sc(h) { return (h / 100).toFixed(2); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function size(C) { return C.size === "eighth" ? { total: CHUNKS * 2, mult: 2 } : { total: CHUNKS, mult: 1 }; }
  function doneAt(C, k) { return k < 1 ? 0 : Math.min(size(C).total, PER_STEP * (k - 1)); }
  function jobHours(C) { return size(C).total / PER_HOUR; }
  function barOf(C) { return C.bar === "0.95" ? 95 : 80; }

  // One question against one index. qv: the question's model. ver(n): the model of chunk n.
  function lookup(q, qv, ver, C) {
    var bar = barOf(C);
    var rows = q.chunks.map(function (c, i) {
      var n = c.n * size(C).mult;
      var cv = ver(n);
      var score = qv === cv ? (qv === "v1" ? c.s1 : c.s2) : c.x;
      var refused = C.check && cv !== qv;
      return { i: i, n: n, page: c.page, ver: cv, score: score, refused: refused, over: !refused && score > bar };
    });
    var top = null;
    rows.forEach(function (r) { if (r.over && (!top || r.score > top.score)) top = r; });
    return { rows: rows, top: top, right: !!top && top.i === 0, wrong: !!top && top.i !== 0 };
  }

  function testSet(qv, ver, C) {
    var right = 0, wrong = 0;
    var res = TESTS.map(function (q) {
      var r = lookup(q, qv, ver, C);
      if (r.right) right++;
      if (r.wrong) wrong++;
      return r;
    });
    return { res: res, right: right, wrong: wrong };
  }

  function allV1() { return "v1"; }
  function allV2() { return "v2"; }

  function state(C, k) {
    var sz = size(C);
    var done = doneAt(C, k);
    var jobDone = k >= 1 && done >= sz.total;
    var newTest = testSet("v2", allV2, C);                 // the test set on a finished v2 index
    var passes = newTest.right === TESTS.length;
    var switched = C.plan === "beside" && jobDone && passes;
    var offline = C.offline && k >= 1 && !jobDone;
    var qv, ver, on;
    if (C.plan === "inplace") {
      qv = k >= 1 ? "v2" : "v1";
      ver = function (n) { return n <= done ? "v2" : "v1"; };
      on = qv;
    } else if (switched) {
      qv = "v2"; ver = allV2; on = "v2, new index";
    } else {
      qv = "v1"; ver = allV1; on = "v1, old index";
    }
    var live = testSet(qv, ver, C);
    return {
      k: k, t: START + k * STEP, done: done, total: sz.total, jobDone: jobDone, switched: switched,
      passes: passes, newTest: newTest, offline: offline, qv: qv, on: offline ? "offline" : on,
      v2: done, v1: C.plan === "inplace" ? sz.total - done : sz.total, live: live, q1: live.res[0]
    };
  }

  function answerText(st, C) {
    if (st.offline) return "offline";
    var top = st.q1.top;
    return top ? top.page : "no match above " + sc(barOf(C));
  }
  function scoreText(st) { return !st.offline && st.q1.top ? sc(st.q1.top.score) : "none"; }
  function verdict(st) {
    if (st.offline) return "offline";
    return st.q1.right ? "right page" : st.q1.wrong ? "wrong page" : "no answer";
  }
  function testText(st) { return st.offline ? "offline" : st.live.right + " of 5 right"; }
  function finishes(C) { return hm(jobHours(C) * 60); }
  function switchText(C, st) {
    if (C.plan === "inplace") return "00:00, with the job";
    if (st.switched) return finishes(C) + ", test set 5 of 5";
    if (st.jobDone) return "held: test set " + st.newTest.right + " of 5";
    return "not yet: job finishes " + finishes(C);
  }
  function hoursDark(C) { return C.offline ? jobHours(C) : 0; }

  function describe(C) {
    return pick(PLANS, C.plan).label + ", match bar " + C.bar + ", " + pick(SIZES, C.size).label +
      (C.offline ? ", offline during the job" : "") + (C.check ? ", version check on" : "");
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
    function table(heads) {
      var wrap = el("div", "overflow-x:auto;");
      var tb = el("table", "width:100%;font-size:12px;");
      var hr = el("tr");
      heads.forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
      var th = el("thead");
      th.appendChild(hr);
      tb.appendChild(th);
      var body = el("tbody");
      tb.appendChild(body);
      wrap.appendChild(tb);
      return { wrap: wrap, body: body };
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    box.appendChild(el("p", "margin:0;font-size:12px;font-weight:600;", "The C-27 question: closest chunks"));
    var t1 = table(["chunk", "page", "numbers made by", "similarity", "handed over?"]);
    box.appendChild(t1.wrap);
    box.appendChild(el("p", "margin:0;font-size:12px;font-weight:600;", "The test set: five known questions"));
    var t2 = table(["question", "answer's source", "right page?"]);
    box.appendChild(t2.wrap);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { el: el, head: head, b1: t1.body, b2: t2.body, sum: sum };
  }

  function row(ui, body, cells) {
    var tr = ui.el("tr");
    cells.forEach(function (x) { tr.appendChild(ui.el("td", "", x)); });
    body.appendChild(tr);
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var st = state(C, S.k);
    ui.head.textContent = "Set-up: " + describe(C) + ".";
    clear(ui.b1);
    st.q1.rows.slice().sort(function (a, b) { return b.score - a.score; }).forEach(function (r) {
      var handed = st.offline ? "offline" : r.refused ? "refused: made by " + r.ver : r === st.q1.top ? "yes, the source" : r.over ? "yes" : "no, under the bar";
      row(ui, ui.b1, [num(r.n), r.page, r.ver, r.refused ? "not compared" : sc(r.score), handed]);
    });
    clear(ui.b2);
    TESTS.forEach(function (q, i) {
      var r = st.live.res[i];
      row(ui, ui.b2, [q.ask, st.offline ? "offline" : r.top ? r.top.page + " (" + sc(r.top.score) + ")" : "no match above the bar",
        st.offline ? "offline" : r.right ? "yes" : r.wrong ? "wrong page" : "no answer"]);
    });
    S.stat.time(hm(st.t));
    S.stat.on(st.on);
    S.stat.v2(num(st.v2));
    S.stat.v1(num(st.v1));
    S.stat.answer(answerText(st, C));
    S.stat.score(scoreText(st));
    S.stat.verdict(verdict(st));
    S.stat.test(testText(st));
    S.stat.wrong(st.offline ? 0 : st.live.wrong);
    S.stat.dark(hoursDark(C));
    S.stat.sw(switchText(C, st));
    S.stat.fin(finishes(C));
    ui.sum.textContent = "At " + hm(st.t) + " questions are on " + st.on + ". " + num(st.v2) + " chunks hold v2 numbers; " +
      num(st.v1) + " hold v1 numbers" + (C.plan === "beside" ? " in the old index" : "") + ".";
  }

  function change(api, what) {
    api.state.k = 0;
    api.log(what + " Set back to 23:48.", "");
    draw(api);
  }

  function events(api, st, prev) {
    var C = api.state.C;
    if (st.k === 1) {
      api.log(C.plan === "inplace"
        ? "00:00 the re-index job starts in place, 1,500 chunks an hour, and questions switch to v2."
        : "00:00 the job starts building a new index beside the old one, 1,500 chunks an hour; questions stay on v1.", "warn");
      if (C.offline) api.log("00:00 the assistant goes offline until the job is done, at " + finishes(C) + ".", "warn");
    }
    if (st.k === ASK) {
      var where = C.plan === "inplace" ? num(st.v2) + " chunks on v2, " + num(st.v1) + " still on v1."
        : "New index " + num(st.v2) + " of " + num(st.total) + " built; questions on the old index.";
      var said = st.offline ? "the assistant is offline." : st.q1.top ? st.q1.top.page + " (" + sc(st.q1.top.score) + ")." : "no match above " + sc(barOf(C)) + ".";
      api.log("04:48 the contractor asks the fuel mix for C-27: " + said + " " + where, st.q1.right ? "ok" : "bad");
      var refused = st.q1.rows.filter(function (r) { return r.refused; }).length;
      if (refused && !st.offline) api.log("Version check: " + refused + " of 4 sample chunks refused, made by v1.", "warn");
    }
    if (st.jobDone && !prev.jobDone) {
      api.log(finishes(C) + " job done: " + num(st.total) + " of " + num(st.total) + " chunks on v2.", "");
      if (C.plan === "beside") {
        api.log(st.passes
          ? "Test set on the new index: 5 of 5 above " + C.bar + ". Questions and index switch together."
          : "Test set on the new index: " + st.newTest.right + " of 5 above " + C.bar + ". Switch held; questions stay on the old index.", st.passes ? "ok" : "bad");
      }
      if (C.offline) api.log("The assistant is back online after " + jobHours(C) + " hours without answers.", "warn");
    }
  }

  function stepOnce(api, withLine) {
    var S = api.state;
    var prev = state(S.C, S.k);
    S.k += 1;
    var st = state(S.C, S.k);
    if (withLine) api.log(hm(st.t) + " C-27 question: " + answerText(st, S.C) + (st.q1.top && !st.offline ? " (" + sc(st.q1.top.score) + ")" : "") +
      "; test set " + testText(st) + ".", st.q1.wrong && !st.offline ? "bad" : "");
    events(api, st, prev);
  }

  function step(api) {
    if (api.state.k >= LAST) {
      api.log("The night has already played. Change a setting or reset to play it again.", "");
      return;
    }
    stepOnce(api, true);
    draw(api);
  }

  function play(api) {
    if (api.state.k >= LAST) {
      api.log("The night has already played. Change a setting or reset to play it again.", "");
      return;
    }
    while (api.state.k < LAST) stepOnce(api, false);
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e09", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { plan: "inplace", bar: "0.80", size: "quarter", offline: false, check: false };
      S.k = 0;
      S.ui = buildWidget(api);

      api.control.select("plan", "How the re-index runs", PLANS.map(function (p) { return { value: p.value, label: p.label }; }), S.C.plan, function (v) {
        var o = pick(PLANS, v);
        if (!o) return;
        S.C.plan = o.value;
        change(api, "Re-index: " + o.label + ".");
      });
      api.control.select("bar", "Match bar", BARS, S.C.bar, function (v) {
        var o = pick(BARS, v);
        if (!o) return;
        S.C.bar = o.value;
        change(api, "Match bar: " + o.value + ".");
      });
      api.control.select("size", "Chunk size", SIZES, S.C.size, function (v) {
        var o = pick(SIZES, v);
        if (!o) return;
        S.C.size = o.value;
        change(api, "Chunk size: " + o.label + ".");
      });
      api.control.toggle("offline", "Take the assistant offline during the job", false, function (on) {
        S.C.offline = !!on;
        change(api, "Offline during the job: " + (on ? "on." : "off."));
      });
      api.control.toggle("check", "Version check: refuse chunks made by another model", false, function (on) {
        S.C.check = !!on;
        change(api, "Version check: " + (on ? "on." : "off."));
      });
      api.control.button("step", "Next 12 minutes", function () { step(api); });
      api.control.button("run", "Play to 08:00", function () { play(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time", ""),
        on: api.stat("on", "questions on", ""),
        v2: api.stat("v2", "chunks with v2 numbers", ""),
        v1: api.stat("v1", "chunks with v1 numbers", "warn"),
        answer: api.stat("answer", "C-27 question's source", ""),
        score: api.stat("score", "its similarity", ""),
        verdict: api.stat("verdict", "right or wrong page", "bad"),
        test: api.stat("test", "test set (live)", ""),
        wrong: api.stat("wrong", "test pages wrong", "bad"),
        dark: api.stat("dark", "hours without answers", "warn"),
        sw: api.stat("sw", "questions switch to v2", ""),
        fin: api.stat("fin", "job finishes", "")
      };

      api.info("<strong>How to read it.</strong> The first table is the C-27 question's sample chunks: which model made each chunk's numbers, its similarity to the question, and whether it clears the match bar. The highest chunk above the bar is the answer's source. The second table runs the five known questions of the test set against whatever index questions are using now.");

      api.log("Tuesday 29 September 2026, 23:48, as built: one index, 12,000 chunks with v1 numbers; questions on v1. The C-27 question finds C-27 cut-off saw p4, fuel (0.88).", "");
      draw(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      var BUILT = { plan: "inplace", bar: "0.80", size: "quarter", offline: false, check: false };
      function as(set) { Object.keys(BUILT).forEach(function (k) { t.set(k, set && set.hasOwnProperty(k) ? set[k] : BUILT[k]); }); }
      function stepTo(n) { for (var i = 0; i < n; i++) t.click("step"); }

      // 1. Opening state: 23:48, before the job; every chunk and question on v1, the right page.
      t.expect(t.stat("time") === "23:48" && t.stat("on") === "v1" && t.stat("v2") === 0 && t.stat("v1") === "12,000" &&
        t.stat("answer") === "C-27 cut-off saw p4, fuel" && t.stat("score") === 0.88 && t.stat("verdict") === "right page" &&
        t.stat("test") === "5 of 5 right" && t.stat("wrong") === 0 && t.stat("dark") === 0 && t.stat("fin") === "08:00" &&
        has("23:48, as built"),
        "Opens at 23:48: 12,000 chunks on v1, questions on v1, the saw's page at 0.88, 5 of 5");

      // 2. 00:00 in place: questions move to v2 before any chunk is redone; the mixer already wins.
      begin();
      stepTo(1);
      t.expect(t.stat("time") === "00:00" && t.stat("on") === "v2" && t.stat("v2") === 0 &&
        t.stat("answer") === "M-06 cement mixer p6, drum speed" && t.stat("score") === 0.91 && t.stat("test") === "0 of 5 right" &&
        has("00:00 the re-index job starts in place, 1,500 chunks an hour, and questions switch to v2."),
        "00:00 in place: questions on v2, 0 chunks redone, the mixer at 0.91, 0 of 5 right");

      // 3. 04:48: 7,200 on v2 and 4,800 on v1; the top answer is the mixer page at 0.91.
      begin();
      stepTo(24);
      t.expect(t.stat("time") === "04:48" && t.stat("v2") === "7,200" && t.stat("v1") === "4,800" &&
        t.stat("answer") === "M-06 cement mixer p6, drum speed" && t.stat("score") === 0.91 && t.stat("verdict") === "wrong page" &&
        t.stat("test") === "2 of 5 right" && t.stat("wrong") === 2 &&
        has("04:48 the contractor asks the fuel mix for C-27: M-06 cement mixer p6, drum speed (0.91). 7,200 chunks on v2, 4,800 still on v1."),
        "04:48 in place: 7,200 v2, 4,800 v1, the mixer at 0.91, 2 of 5 test questions right");

      // 4. Play on: all on v2 at 08:00, the saw's own page at 0.89.
      t.click("run");
      t.expect(t.stat("time") === "08:00" && t.stat("v2") === "12,000" && t.stat("v1") === 0 &&
        t.stat("answer") === "C-27 cut-off saw p4, fuel" && t.stat("score") === 0.89 && t.stat("test") === "5 of 5 right",
        "08:00 in place: 12,000 on v2, the saw's page at 0.89, 5 of 5");

      // 5. Beside, then switch (option 0): right answers all night, switch at 08:00 after 5 of 5.
      as({ plan: "beside" });
      stepTo(25);
      var b1 = t.stat("time") === "04:48" && t.stat("on") === "v1, old index" && t.stat("v2") === "7,200" && t.stat("v1") === "12,000" &&
        t.stat("answer") === "C-27 cut-off saw p4, fuel" && t.stat("score") === 0.88 && t.stat("test") === "5 of 5 right" &&
        t.stat("sw") === "not yet: job finishes 08:00";
      begin();
      t.click("run");
      t.expect(b1 && t.stat("on") === "v2, new index" && t.stat("sw") === "08:00, test set 5 of 5" && t.stat("score") === 0.89 &&
        t.stat("dark") === 0 && has("Test set on the new index: 5 of 5 above 0.80. Questions and index switch together."),
        "Beside: the saw's page at 0.88 at 04:48, then switch at 08:00 after 5 of 5, page at 0.89, no dark hours");

      // 6. Offline (option 2): no answers for 8 hours, then right on v2.
      as({ offline: true });
      stepTo(25);
      var o1 = t.stat("answer") === "offline" && t.stat("on") === "offline" && t.stat("dark") === 8;
      begin();
      t.click("run");
      t.expect(o1 && t.stat("answer") === "C-27 cut-off saw p4, fuel" && t.stat("test") === "5 of 5 right" &&
        has("The assistant is back online after 8 hours without answers."),
        "Offline: no answers from 00:00 to 08:00, 8 hours, then the right page");

      // 7. Version check: mixed comparisons refused; no wrong page at 04:48, the right one once redone.
      as({ check: true });
      begin();
      stepTo(25);
      var c1 = t.stat("answer") === "no match above 0.80" && t.stat("verdict") === "no answer" && t.stat("test") === "3 of 5 right" &&
        t.stat("wrong") === 0 && has("Version check: 2 of 4 sample chunks refused, made by v1.");
      stepTo(9);
      t.expect(c1 && t.stat("time") === "06:36" && t.stat("answer") === "C-27 cut-off saw p4, fuel" && t.stat("score") === 0.89,
        "Version check: at 04:48 no answer instead of the mixer, 3 of 5 right, 0 wrong; at 06:36 the saw's page at 0.89");

      // 8. Without the check the mixer outlasts the saw's own redo: still wrong at 06:36, right at 07:36.
      as({});
      stepTo(34);
      var m1 = t.stat("answer") === "M-06 cement mixer p6, drum speed";
      stepTo(5);
      t.expect(m1 && t.stat("time") === "07:36" && t.stat("answer") === "C-27 cut-off saw p4, fuel",
        "In place: the mixer still wins at 06:36 after the saw's chunk is redone; the saw's page wins from 07:36");

      // 9. Match bar 0.95 (option 1): the mixer is refused, but a 0.97 chance page passes; after 08:00 0 of 5.
      as({ bar: "0.95" });
      stepTo(25);
      var h1 = t.stat("answer") === "no match above 0.95" && t.stat("test") === "0 of 5 right" && t.stat("wrong") === 1;
      t.click("run");
      t.expect(h1 && t.stat("answer") === "no match above 0.95" && t.stat("test") === "0 of 5 right" && t.stat("wrong") === 0,
        "Bar 0.95: at 04:48 one test question still gets a wrong page at 0.97; after 08:00 0 of 5 right");

      // 10. Smaller chunks (option 3): 24,000 chunks, 16 hours, the mixer still wins at 04:48 and at 08:00.
      as({ size: "eighth" });
      stepTo(25);
      var s1 = t.stat("v2") === "7,200" && t.stat("v1") === "16,800" && t.stat("score") === 0.91;
      t.click("run");
      t.expect(s1 && t.stat("fin") === "16:00" && t.stat("v2") === "12,000" && t.stat("v1") === "12,000" &&
        t.stat("answer") === "M-06 cement mixer p6, drum speed",
        "Half-size chunks: 24,000 chunks, done at 16:00; at 04:48 and 08:00 the mixer at 0.91");

      // 11. Beside with the 0.95 bar: the test set fails on the new index and the switch is held.
      as({ plan: "beside", bar: "0.95" });
      begin();
      t.click("run");
      t.expect(t.stat("sw") === "held: test set 0 of 5" && t.stat("on") === "v1, old index" &&
        has("Switch held; questions stay on the old index."),
        "Beside at 0.95: the new index's test set is 0 of 5, so the switch is held");
    }
  });
})();
