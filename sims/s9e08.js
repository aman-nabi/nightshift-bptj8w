/* sims/s9e08-v1.0.0.js  (published as sims/s9e08.js)
   Case s9e08 "The Machine That Talks": a talking lab for a ghost-walk tour company on the night of
   Thursday 15 October 2026. Twenty visitors' phones run the company's app. At stop 4, the
   churchyard, the guide cues the stop from her phone at 22:10:00 and every phone asks a language
   model for the stop's story through the company's gateway. The learner sets the story's length,
   word-by-word sending, the gateway's silence limit, the retries, the length cap, saved stories and
   the model's speed, then plays the tries one at a time. Widget-style sim: it draws inside
   api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls story length (800, 1,400 tokens), word by word (off,
     on), silence limit (30, 120 seconds), retries (0, 2, 5), length cap (set per stop, 800 for every
     stop), saved stories (off, on), model (as built, a bigger model); buttons Next try, Play stop 4,
     Reset. Stats: time, tries, first words, story in full, longest silence on the line, answers
     billed, answers delivered, story tokens billed, phones, story. selfTest: 11 assertions.

   Where every number comes from (conventions rule 14; the case is content/s9/s9e08-v1.0.0.json).
   All of it is given data stated in the post or in sim.lede, and each result is checked by selfTest.
   Times are kept in tenths of a second so every sum is exact.
   - The walk (the post): one walk tonight, 20 visitors, 20 phones. Stop 4 is cued at 22:10:00 and
     all 20 phones ask at once. Every phone is alike, so the sim works out one phone and counts 20.
   - The model (the post): the first token after 1.2 seconds, then 40 tokens a second. A story of
     N tokens takes 1.2 + N / 40 seconds: 800 tokens 1.2 + 20 = 21.2 s; 1,400 tokens
     1.2 + 35 = 36.2 s.
   - A bigger model (sim.lede, given data for the explanation's wrong idea): first token after
     2.0 seconds, then 20 tokens a second: 800 tokens 2.0 + 40 = 42.0 s; 1,400 tokens
     2.0 + 70 = 72.0 s.
   - The app (the post): without word-by-word sending it shows nothing until the whole answer
     arrives, so the line is silent for the whole time. With word-by-word sending each piece goes
     to the phone as it is made, so the longest silence is the wait for the first token: 1.2 s.
   - The gateway (the post): closes any line silent for 30 seconds. 36.2 > 30, so every try is cut
     at 30.0 s; 21.2 < 30, so the old stories got through. With a 120-second limit, 36.2 < 120.
   - Retries (the post): after a cut the app asks again at once, twice at most: tries start at
     22:10:00, 22:10:30 and 22:11:00 and are cut at 22:10:30, 22:11:00 and 22:11:30; then the
     phones show "Sorry, the story is taking too long". 20 visitors x 3 tries = 60 answers billed,
     0 delivered. With 5 retries: 20 x 6 = 120 billed, the sorry at 22:13:00.
   - Billing (the post: the company's own finding from its usage page, not a provider claim): the
     provider writes each answer to its end after the gateway hangs up and counts it in full.
     Story tokens billed = answers billed x story tokens: 60 x 1,400 = 84,000; streamed,
     20 x 1,400 = 28,000; 800-token stories, 20 x 800 = 16,000; 5 retries, 120 x 1,400 = 168,000.
   - The cap (the post): the most tokens a stop's story may use, set per stop. Stop 4's was raised
     from 800 to 1,400 this afternoon. "800 for every stop" stops a 1,400-token legend at 800:
     21.2 s, and the legend is cut short.
   - Saved stories (option 2): text written earlier is shown at once; 0 live requests at stop 4.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var BASE = (22 * 3600 + 10 * 60) * 10;   // 22:10:00, in tenths of a second
  var PHONES = 20;
  var SORRY = "Sorry, the story is taking too long";

  var LENGTHS = [
    { value: "800", label: "800 tokens (the old instructions)" },
    { value: "1400", label: "1,400 tokens (\"tell the full legend\", as tonight)" }
  ];
  var LIMITS = [
    { value: "30", label: "30 seconds (as built)" },
    { value: "120", label: "120 seconds" }
  ];
  var RETRIES = [
    { value: "0", label: "0" },
    { value: "2", label: "2 (as built)" },
    { value: "5", label: "5" }
  ];
  var CAPS = [
    { value: "stop", label: "set per stop (stop 4: 1,400, as built)" },
    { value: "800", label: "800 tokens for every stop" }
  ];
  var MODELS = [
    { value: "40", label: "as built: first token 1.2 s, then 40 tokens a second", first: 12, rate: 40 },
    { value: "20", label: "a bigger model: first token 2.0 s, then 20 tokens a second", first: 20, rate: 20 }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function clock(tenths) {
    var t = BASE + tenths;
    var s = Math.floor(t / 10);
    var f = t % 10;
    return two(Math.floor(s / 3600) % 24) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60) + (f ? "." + f : "");
  }
  function secs(tenths) { return (tenths / 10).toFixed(1) + " s"; }
  function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function stop4(C) {
    var M = pick(MODELS, C.model) || MODELS[0];
    var asked = Number(C.length);
    var cap = C.cap === "800" ? 800 : 1400;
    var tokens = Math.min(asked, cap);
    var total = M.first + tokens * 10 / M.rate;          // tenths
    var silent = C.stream ? M.first : total;              // longest silence on the line, per try
    var limit = Number(C.limit) * 10;
    var R = {
      saved: !!C.saved, asked: asked, tokens: tokens, total: total, first: M.first, limit: limit,
      silent: silent, tries: [], billed: 0, delivered: 0, end: 0, story: ""
    };
    R.story = tokens < asked ? "stopped at the cap: " + commas(tokens) + " of " + commas(asked) + " tokens"
      : commas(tokens) + " tokens, in full";
    if (R.saved) {
      R.delivered = PHONES;
      R.story = "saved text, written earlier";
      return R;
    }
    var start = 0;
    for (var k = 0; k <= Number(C.retries); k++) {
      if (silent > limit) {
        R.tries.push({ n: k + 1, start: start, end: start + limit, cut: true, writesTo: start + total });
        start += limit;
      } else {
        R.tries.push({ n: k + 1, start: start, end: start + total, cut: false,
          firstAt: start + (C.stream ? M.first : total), writesTo: start + total });
        break;
      }
    }
    var last = R.tries[R.tries.length - 1];
    R.billed = R.tries.length * PHONES;
    R.delivered = last.cut ? 0 : PHONES;
    R.end = last.end;
    return R;
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var X0 = 70;
  var X1 = 640;

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
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

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 210", width: "100%", "class": "dg", role: "img",
      "aria-label": "One phone's tries at stop 4, from 22:10:00. Grey is a silent line, green is words arriving, a red mark is the gateway closing the line, and the dashed line is the provider still writing after the cut."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { doc: doc, head: head, layer: layer, sum: sum };
  }

  function drawChart(S, R) {
    var doc = S.ui.doc;
    var g = S.ui.layer;
    clear(g);
    var far = 900;
    R.tries.forEach(function (tr) { far = Math.max(far, tr.writesTo); });
    var span = Math.ceil(far / 300) * 300;
    function px(t) { return X0 + t * (X1 - X0) / span; }
    mk(doc, "path", { d: "M" + X0 + " 185L" + X1 + " 185", "class": "dg-axis" }, g);
    for (var m = 0; m <= span; m += 300) txt(doc, g, px(m), 200, "+" + (m / 10) + " s", "dg-axis", "middle");
    txt(doc, g, 8, 16, "one phone at stop 4, from 22:10:00", "dg-axis", "start");
    if (R.saved) {
      txt(doc, g, X0, 60, "saved text: shown at once, no live request", "dg-axis", "start");
      return;
    }
    var shown = Math.min(S.i, R.tries.length);
    for (var i = 0; i < shown; i++) {
      var tr = R.tries[i];
      var y = 30 + i * 24;
      txt(doc, g, X0 - 8, y + 12, "try " + tr.n, "dg-axis", "end");
      var quietTo = tr.cut ? tr.end : tr.firstAt;
      mk(doc, "rect", { x: px(tr.start), y: y, width: Math.max(1, px(quietTo) - px(tr.start)), height: 14,
        style: "fill:var(--faint);opacity:.6" }, g);
      if (!tr.cut) {
        mk(doc, "rect", { x: px(tr.firstAt), y: y, width: Math.max(2, px(tr.end) - px(tr.firstAt)), height: 14,
          style: "fill:var(--green);opacity:.8" }, g);
      } else {
        mk(doc, "path", { d: "M" + px(tr.end) + " " + (y - 3) + "L" + px(tr.end) + " " + (y + 17), "class": "dg-flat" }, g);
        mk(doc, "path", { d: "M" + px(tr.end) + " " + (y + 7) + "L" + px(tr.writesTo) + " " + (y + 7),
          style: "fill:none;stroke:var(--amber);stroke-width:1.5;stroke-dasharray:4 3" }, g);
      }
    }
  }

  function played(S, R) {
    return R.saved ? Math.min(S.i, 1) : Math.min(S.i, R.tries.length);
  }

  function draw2(api) {
    var S = api.state;
    var R = stop4(S.C);
    S.ui.head.textContent = "Stop 4 tonight: " + pick(LENGTHS, S.C.length).label + "; word by word " + (S.C.stream ? "on" : "off") +
      "; silence limit " + S.C.limit + " seconds; retries " + S.C.retries + "; cap " + pick(CAPS, S.C.cap).label +
      "; saved stories " + (S.C.saved ? "on" : "off") + ".";
    drawChart(S, R);
    var n = played(S, R);
    var done = R.saved ? n === 1 : n === R.tries.length;
    if (n === 0) {
      S.stat.time("22:10:00 (not played)");
      ["tries", "first", "full", "silence", "billed", "delivered", "tokens"].forEach(function (k) { S.stat[k]("-"); });
      S.stat.phones("waiting for stop 4");
      S.stat.story(R.story);
      S.ui.sum.textContent = "Not played yet: it is 22:10:00 on Thursday 15 October 2026. The walk has reached stop 4, the churchyard, and 20 phones are about to ask for its story.";
      return;
    }
    if (R.saved) {
      S.stat.time("22:10:00");
      S.stat.tries(0);
      S.stat.first("at once (saved text)");
      S.stat.full("at once (saved text)");
      S.stat.silence("none: no live request");
      S.stat.billed(0);
      S.stat.delivered(PHONES);
      S.stat.tokens(0);
      S.stat.phones("saved story shown at 22:10:00");
      S.stat.story(R.story);
      S.ui.sum.textContent = "At 22:10:00 all 20 phones show stop 4's saved story at once. No live request went to the model.";
      return;
    }
    var tr = R.tries[n - 1];
    var billed = n * PHONES;
    S.stat.time(clock(tr.end));
    S.stat.tries(n);
    S.stat.silence(secs(Math.min(R.silent, R.limit)));
    S.stat.billed(billed);
    S.stat.tokens(billed * R.tokens === 0 ? 0 : commas(billed * R.tokens));
    S.stat.story(R.story);
    if (!tr.cut) {
      S.stat.first(secs(tr.firstAt));
      S.stat.full(secs(tr.end));
      S.stat.delivered(PHONES);
      S.stat.phones(S.C.stream ? "words from " + clock(tr.firstAt) + ", in full at " + clock(tr.end) : "story in full at " + clock(tr.end));
      S.ui.sum.textContent = "At " + clock(tr.end) + " all 20 phones have stop 4's story. Answers billed " + billed + ", delivered " + PHONES + ".";
    } else {
      S.stat.first(done ? "never" : "-");
      S.stat.full(done ? "never" : "-");
      S.stat.delivered(0);
      S.stat.phones(done ? "spinning, then sorry at " + clock(tr.end) : "spinning");
      S.ui.sum.textContent = "At " + clock(tr.end) + " the gateway has closed try " + tr.n + " on all 20 phones. Answers billed " + billed + ", delivered 0." +
        (done ? " Every phone shows: " + SORRY + "." : " The app asks again at once.");
    }
  }

  function tryText(R, tr, C) {
    var s = clock(tr.start) + " try " + tr.n + ": 20 phones ask for stop 4's story (" + commas(R.tokens) + " tokens). ";
    if (tr.cut) {
      s += "Nothing arrives on the line; at " + clock(tr.end) + " the gateway closes it after " + secs(R.limit) +
        " of silence. The provider writes on to " + clock(tr.writesTo) + " and counts it: 20 answers billed.";
    } else if (C.stream) {
      s += "First words at " + clock(tr.firstAt) + ", then each piece as it is made; the line is never silent for more than " +
        secs(R.first) + ". Story in full at " + clock(tr.end) + ": 20 answers billed, 20 delivered.";
    } else {
      s += "The line is silent until the whole story arrives at " + clock(tr.end) + ", " + secs(R.total) +
        " of silence, under the " + (R.limit / 10) + "-second limit: 20 answers billed, 20 delivered.";
    }
    return s;
  }

  function runStep(api) {
    var S = api.state;
    var C = S.C;
    var R = stop4(C);
    if (R.saved) {
      api.log("22:10:00 saved story shown on 20 phones at once; 0 live requests, 0 answers billed.", "ok");
      S.i = 1;
      return;
    }
    var tr = R.tries[S.i];
    api.log(tryText(R, tr, C), tr.cut ? "bad" : "ok");
    S.i += 1;
    if (tr.cut && S.i < R.tries.length) api.log(clock(tr.end) + " the app retries at once.", "warn");
    if (tr.cut && S.i === R.tries.length) {
      api.log(clock(tr.end) + " no retries left. Every phone shows: " + SORRY + ". Answers billed " + R.billed +
        ", delivered 0, story tokens billed " + commas(R.billed * R.tokens) + ".", "bad");
    }
  }

  function steps(R) { return R.saved ? 1 : R.tries.length; }

  function change(api, what) {
    api.state.i = 0;
    api.log(what + " Set back to 22:10:00.", "");
    draw2(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s9e08", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { length: "1400", stream: false, limit: "30", retries: "2", cap: "stop", saved: false, model: "40" };
      S.i = 0;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      function tog(id, label, key) {
        api.control.toggle(id, label, S.C[key], function (on) {
          S.C[key] = !!on;
          change(api, label + ": " + (on ? "on." : "off."));
        });
      }
      sel("length", "Stop 4's story", LENGTHS, "length");
      tog("stream", "Send the story word by word as it is made", "stream");
      sel("limit", "Gateway silence limit", LIMITS, "limit");
      sel("retries", "Retries after a cut", RETRIES, "retries");
      sel("cap", "Length cap", CAPS, "cap");
      tog("saved", "Saved stories: show text written earlier", "saved");
      sel("model", "Model", MODELS, "model");
      api.control.button("step", "Next try", function () {
        var R = stop4(S.C);
        if (S.i >= steps(R)) {
          api.log("Stop 4 has already played out. Change a setting or reset to play it again.", "");
          return;
        }
        runStep(api);
        draw2(api);
      });
      api.control.button("play", "Play stop 4", function () {
        var R = stop4(S.C);
        if (S.i >= steps(R)) {
          api.log("Stop 4 has already played out. Change a setting or reset to play it again.", "");
          return;
        }
        while (S.i < steps(R)) runStep(api);
        draw2(api);
      });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        time: api.stat("time", "time", ""),
        tries: api.stat("tries", "tries so far, per phone", ""),
        first: api.stat("first", "first words on the phone, after", "warn"),
        full: api.stat("full", "story in full, after", ""),
        silence: api.stat("silence", "longest silence on the line", "warn"),
        billed: api.stat("billed", "answers billed", "bad"),
        delivered: api.stat("delivered", "answers delivered", "ok"),
        tokens: api.stat("tokens", "story tokens billed", "bad"),
        phones: api.stat("phones", "the phones", ""),
        story: api.stat("story", "stop 4's story", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one try by one phone; all 20 phones do the same. Grey is a silent line: nothing has reached the phone yet. Green is words arriving. A red mark is the gateway closing a line that has been silent for its limit, and the dashed line after it is the provider still writing that answer, which the usage page counts in full (the company's own finding). The app retries at once after a cut.");

      api.log("Thursday 15 October 2026, 22:10:00. Stop 4, the churchyard: the guide cues the stop and 20 phones are about to ask for its story.", "warn");
      draw2(api);
    },

    selfTest: async function (t) {
      var mark = 0;
      function begin() { mark = t.logText().length; }
      function has(s) { return t.logText().slice(mark).indexOf(s) >= 0; }
      var BUILT = { length: "1400", stream: false, limit: "30", retries: "2", cap: "stop", saved: false, model: "40" };
      function as(set) {
        Object.keys(BUILT).forEach(function (k) { t.set(k, set && Object.prototype.hasOwnProperty.call(set, k) ? set[k] : BUILT[k]); });
      }

      // 1. Opening state: 22:10:00, before any phone has asked.
      t.expect(t.stat("time") === "22:10:00 (not played)" && t.stat("billed") === "-" && t.stat("delivered") === "-" &&
        t.stat("phones") === "waiting for stop 4" && t.stat("story") === "1,400 tokens, in full",
        "Opens at 22:10:00 with no request sent and stop 4's story at 1,400 tokens");

      // 2. As built, one try: cut at 22:10:30 after 30.0 s of silence; 20 billed, 0 delivered.
      begin();
      t.click("step");
      t.expect(t.stat("time") === "22:10:30" && t.stat("tries") === 1 && t.stat("billed") === 20 && t.stat("delivered") === 0 &&
        t.stat("silence") === "30.0 s" && t.stat("phones") === "spinning" &&
        has("at 22:10:30 the gateway closes it after 30.0 s of silence. The provider writes on to 22:10:36.2 and counts it") &&
        has("22:10:30 the app retries at once."),
        "Try 1 is silent for 30.0 s and cut at 22:10:30; the provider writes on to 22:10:36.2 and 20 answers are billed");

      // 3. As built, to the end: 60 billed, 0 delivered, 84,000 story tokens, sorry at 22:11:30.
      begin();
      t.click("play");
      t.expect(t.stat("time") === "22:11:30" && t.stat("tries") === 3 && t.stat("billed") === 60 && t.stat("delivered") === 0 &&
        t.stat("tokens") === "84,000" && t.stat("first") === "never" && t.stat("phones") === "spinning, then sorry at 22:11:30" &&
        has("22:11:30 no retries left. Every phone shows: Sorry, the story is taking too long. Answers billed 60, delivered 0, story tokens billed 84,000."),
        "As built: 20 visitors x 3 tries = 60 answers billed, 0 delivered, 84,000 story tokens, sorry at 22:11:30");

      // 4. Word by word: first words at 1.2 s, in full at 36.2 s, 20 billed and 20 delivered.
      as({ stream: true });
      t.click("play");
      t.expect(t.stat("first") === "1.2 s" && t.stat("full") === "36.2 s" && t.stat("silence") === "1.2 s" &&
        t.stat("billed") === 20 && t.stat("delivered") === 20 && t.stat("tokens") === "28,000" &&
        t.stat("phones") === "words from 22:10:01.2, in full at 22:10:36.2",
        "Word by word: first words after 1.2 s, the line never silent longer, 20 billed, 20 delivered, 28,000 tokens");

      // 5. The old 800-token story: 21.2 s, inside the 30-second limit.
      as({ length: "800" });
      t.click("play");
      t.expect(t.stat("full") === "21.2 s" && t.stat("silence") === "21.2 s" && t.stat("billed") === 20 && t.stat("delivered") === 20 &&
        t.stat("tokens") === "16,000",
        "800 tokens: 1.2 + 20 = 21.2 s, under 30, delivered first time");

      // 6. A 120-second silence limit: delivered, after 36.2 s of silence.
      as({ limit: "120" });
      begin();
      t.click("play");
      t.expect(t.stat("first") === "36.2 s" && t.stat("silence") === "36.2 s" && t.stat("billed") === 20 && t.stat("delivered") === 20 &&
        has("36.2 s of silence, under the 120-second limit"),
        "Silence limit 120 seconds: the story arrives whole after 36.2 s of silence; 20 billed");

      // 7. Five retries: 120 billed, 0 delivered, 168,000 tokens, sorry at 22:13:00.
      as({ retries: "5" });
      t.click("play");
      t.expect(t.stat("tries") === 6 && t.stat("billed") === 120 && t.stat("delivered") === 0 && t.stat("tokens") === "168,000" &&
        t.stat("phones") === "spinning, then sorry at 22:13:00",
        "Five retries: 20 x 6 = 120 billed, 0 delivered, sorry at 22:13:00");

      // 8. Saved stories (option 2): 0 live requests, 20 shown at once.
      as({ saved: true });
      begin();
      t.click("play");
      t.expect(t.stat("billed") === 0 && t.stat("delivered") === 20 && t.stat("tokens") === 0 &&
        t.stat("first") === "at once (saved text)" && has("0 live requests"),
        "Saved stories: 0 live requests, 20 phones shown the story at once");

      // 9. The fix (option 1): word by word, the legend rewritten to 800 tokens, 800 for every stop.
      as({ stream: true, length: "800", cap: "800" });
      t.click("play");
      t.expect(t.stat("first") === "1.2 s" && t.stat("full") === "21.2 s" && t.stat("billed") === 20 && t.stat("delivered") === 20 &&
        t.stat("tokens") === "16,000" && t.stat("story") === "800 tokens, in full",
        "Word by word and an 800-token cap: first words at 1.2 s, in full at 21.2 s, 20 billed, 20 delivered");

      // 10. The cap on its own stops the full legend short at 800 tokens.
      as({ cap: "800" });
      t.click("play");
      t.expect(t.stat("full") === "21.2 s" && t.stat("delivered") === 20 && t.stat("story") === "stopped at the cap: 800 of 1,400 tokens",
        "An 800 cap with the 1,400-token instructions: delivered at 21.2 s, but the legend stops at 800 tokens");

      // 11. A bigger model: even the 800-token story takes 42.0 s and is cut; word by word, first words at 2.0 s.
      as({ model: "20", length: "800" });
      t.click("play");
      var big1 = t.stat("billed") === 60 && t.stat("delivered") === 0;
      as({ model: "20", stream: true });
      t.click("play");
      t.expect(big1 && t.stat("first") === "2.0 s" && t.stat("full") === "72.0 s" && t.stat("delivered") === 20,
        "A bigger model: 800 tokens take 42.0 s and are cut three times; word by word, first words at 2.0 s, in full at 72.0 s");
    }
  });
})();
