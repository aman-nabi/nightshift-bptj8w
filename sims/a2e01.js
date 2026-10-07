/* sims/a2e01-v1.0.0.js  (published as sims/a2e01.js)
   Case a2e01 "First Contact": a request console built from Teun's relay page at Kettlewood Base, where
   twelve fire towers ask the far station, a language model behind a provider's API, their questions.

   CHANGELOG
   v1.0.0 (2026-10-07) first version: a widget-style sim built inside api.root (no diagram). It never
     makes a network call. Part 1 builds the request the relay page would send, shaped like Anthropic's
     Messages API: the POST line, the headers with the API key always shown as [hidden], and the JSON
     body (model, max_tokens, optional temperature, optional system prompt, messages with roles). Part 2
     is the station's scripted answer: the text, cut at max_tokens with stop_reason max_tokens, or whole
     with end_turn, plus usage and the cost at teaching prices. Part 3 is a who-can-read-the-API-key panel
     for three placements. Part 4 is a roll-call drill against a teaching rate limit (a token bucket),
     with the stranger's calls on or off and three retry policies. Controls: system prompt, past turns,
     max_tokens, temperature, API key placement, retry policy, stranger, calls at once, reset. selfTest
     covers the 01:47 start, input tokens growing exactly with resent turns, max_tokens cuts, exact cost
     math, no API key value anywhere in the request, the exposed placements, the drill's story counts,
     backoff serving every call, every story number, the toy station's answers, determinism and controls.

   Where every number comes from (conventions rule 14; the case is content/latent/a2/a2e01-v1.0.0.json).
   - Teaching token counts: one per word or number (letters, digits and apostrophes) and one per
     punctuation mark, the regular expression TOKEN_SRC below. Counted from the texts in this file:
       system prompt (Teun's standing orders) 42;
       Halvard's turns from last Tuesday, user + assistant: turn 1 18 + 29 = 47, turn 2 20 + 21 = 41,
       turn 3 20 + 21 = 41, turn 4 29 + 32 = 61; all four 190, eight messages;
       Marisol's question 23;
       the station's full answers: system prompt and Halvard's turns 49, system prompt only 33,
       Halvard's turns without a system prompt 78, neither 66.
   - post, log and evidence diagram: the 01:47 request is system prompt on, 4 turns (8 messages) plus the
     question, 9 messages, 42 + 190 + 23 = 255 tokens in; max_tokens 40; temperature 0.3; the answer
     would run to 49, so it stops after 40 tokens at "Stay in the", stop_reason max_tokens, output 40.
     The log shows 01:47:12 and 01:47:13 (about a second).
   - Turns resent are always the most recent: 0 to 4 turns give 65, 126, 167, 208, 255 tokens in with
     the system prompt, and 23, 84, 125, 166, 213 without it.
   - Clean answer (system prompt on, 0 turns, max_tokens 40 or 80): 65 in, 33 out, end_turn (reply
     options A to C, and the fix). max_tokens 80 with 4 turns: 49 out, end_turn (tryThis). System
     prompt off, 4 turns, max_tokens 80: 213 in, 78 out (tryThis).
   - Teaching prices, the story provider's: $2 per million input tokens, $10 per million output tokens.
     Cost is held in whole micro-dollars (tokens x dollars per million): the 01:47 call is 255 x 2 +
     40 x 10 = 910, 0.000910 dollars (explain step 3, tryThis); the clean call 65 x 2 + 33 x 10 = 460.
   - The stranger's night (OP reply to u/gradient_ghost, reply option D): 3,600 calls between 23:00 and
     05:00, ten at the top of every minute (6 hours x 60 minutes x 10), 7,200,000 input tokens and
     1,800,000 output tokens (2,000 and 500 a call), 7.2 x 2 + 1.8 x 10 = $32.40.
   - Drill (the story's free tier, teaching values): the account's bucket holds 12 calls (CAP) and
     refills one every 5 seconds (REFILL_EVERY), 12 a minute; it starts full at 02:00:00. The stranger
     takes 10 calls at the top of every minute (STRANGER_BURST), before the page's calls in the same
     second. The roll call sends 12 calls at once (STORY_BURST). A refused call gets a 429 with
     retry-after 5, the seconds to the next refill. Retries: none; at once, up to 5 more tries in the
     same second (Teun's page); or growing waits of 5, 10, 20, 40 and 80 seconds.
     Story results with the stranger on: no retry, 2 served and 10 refused; at once, 2 served,
     10 + 10 x 5 = 60 refusals and 10 towers hear station busy (post, OP reply to u/overnight_invoice_zuzana,
     option A part 2, tryThis); growing waits, 1 more served at 02:00:05, 2 at 02:00:15, 4 at 02:00:35
     and the last 3 at 02:01:15 after the stranger's 02:01 calls, 10 + 9 + 7 + 3 = 29 refusals, all 12
     served (tryThis, recall r5). With the stranger off, 12 of 12 first time, no refusals (option B and
     C part 2, the fix). Other teaching settings: 24 calls with the stranger off and growing waits serve
     all 24 after 37 refusals; with the stranger on, growing waits leave 5 of 24 unserved.
   - Clock: four in the morning (START_CLOCK), when Teun drew the evidence; the roll call is 02:00.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the whole widget inside api.root on every reset. Nothing animates, so
     there is no step(); every number is worked out the moment a control changes.
   - The API key never exists in this file. The header line is always the literal "x-api-key: [hidden]",
     and selfTest checks that no request text holds anything key-shaped.
   - The station is a toy: its answer depends only on whether the system prompt arrived and whether any
     of Halvard's turns arrived. Temperature is shown in the request but does not change the scripted
     answer; a real model at temperature 1 could word it differently each time (case 6).
   - No random numbers anywhere: the drill has no jitter, so the sim is fully deterministic.
   - Stats get bare numbers or words (units live in the labels).
   - Colors come only from theme classes: dg, dot with dot-accent (system prompt), dot-wait (user
     messages), dot-req (assistant messages), dot-ok (the question, served calls, a finished answer),
     dot-fail (429s, a cut answer), dg-edge with tone-accent (the max_tokens cap) and tone-bad (the
     stranger's calls), dg-label, dg-axis, muted, small. Shading is fill-opacity, a number, not a color.
*/
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- the story's texts ---------- */

  var SYSTEM_TEXT = "You are the far station for the Kettlewood lookout net. Answer in plain radio English, " +
    "in under 50 words. Begin with the tower's call sign. If you do not know, say so. End with Over.";

  // Halvard's four turns in Tower 6 last Tuesday, oldest first. Turn 4 is the stairs.
  var TURNS = [
    { u: "Far station, Tower 6, Halvard. How do I stay awake on a long watch?",
      a: "Tower 6, far station. Stand up every half hour, walk the cab, sweep the horizon point by point, and drink water. Over." },
    { u: "Far station, Tower 6. Thunder came nine seconds after the flash. How far off is it?",
      a: "Tower 6, far station. About three kilometres. Sound covers a kilometre in about three seconds. Over." },
    { u: "Far station, Tower 6. The stairs creak after dark. Is that normal for a steel tower?",
      a: "Tower 6, far station. Yes. Steel towers creak as they cool after a hot day. Over." },
    { u: "Far station, Tower 6, Halvard. Someone is on my stairs. Slow footsteps, stopping at each landing. Is anyone else on the ridge?",
      a: "Tower 6, far station. I cannot see your ridge. Call the base on the radio now. Stay in the cab and keep the hatch shut. Over." }
  ];

  var QUESTION = "Far station, Tower 6, first night on this tower. How do I log a lightning strike I cannot place?";

  // The toy station's full answers: with or without the system prompt, with or without Halvard's turns.
  var REPLY = {
    sysHist: "Tower 6, far station. Log the time and your best bearing, and count the seconds to the thunder. " +
      "And Halvard, nobody is on your stairs. It is the tower cooling. Stay in the cab and keep the hatch shut. Over.",
    sysClean: "Tower 6, far station. Log the time and your best bearing, and count the seconds to the thunder. " +
      "Report it at the top of the hour. Over.",
    plainHist: "Hi Halvard! To log a strike you can't place, write down the time, your best guess at the bearing, " +
      "and how many seconds passed before the thunder. As for the footsteps: I can't see your ridge, but steel " +
      "towers creak as they cool, so it is most likely the tower. If you are worried, stay in the cab, keep the " +
      "hatch shut and call the base.",
    plainClean: "Good question! When you can't place a strike, write down the time, your best guess at the bearing, " +
      "and how many seconds passed before the thunder. Every three seconds is about a kilometre. Your base may " +
      "have its own way to log strikes, so check with them too. Is there anything else I can help with tonight?"
  };

  /* ---------- the story's numbers ---------- */

  var MODEL_NAME = "teaching-station-1";     // a teaching model name, not a real one
  var API_VERSION = "2023-06-01";            // the version Anthropic's examples send
  var ENDPOINT_PATH = "/v1/messages";
  var HIDDEN = "[hidden]";

  var PRICE_IN = 2;                          // teaching price: dollars per million input tokens
  var PRICE_OUT = 10;                        // teaching price: dollars per million output tokens

  var MAX_CHOICES = [20, 40, 80, 160];
  var TEMP_CHOICES = ["off", "0", "0.3", "0.7", "1"];

  var STORY_TURNS = 4;
  var STORY_MAX = 40;
  var STORY_TEMP = "0.3";
  var STORY_PLACE = "browser";
  var STORY_POLICY = "instant";
  var STORY_BURST = 12;

  // The stranger's night on the usage page.
  var STRANGER_CALLS = 3600;
  var STRANGER_IN = 7200000;
  var STRANGER_OUT = 1800000;
  var STRANGER_HOURS = 6;                    // 23:00 to 05:00

  // The roll-call drill (teaching rate limit: the story's free tier).
  var CAP = 12;                              // calls the bucket holds
  var REFILL_EVERY = 5;                      // seconds per refilled call: 12 a minute
  var STRANGER_BURST = 10;                   // the stranger's calls at the top of every minute
  var MAX_RETRIES = 5;
  var WAITS = [5, 10, 20, 40, 80];           // growing waits, seconds
  var DRILL_SECONDS = 180;                   // 02:00:00 to 02:02:59
  var ROLL_CALL_CLOCK = 2 * 3600;            // 02:00
  var BURSTS = [6, 12, 18, 24];
  var POLICIES = ["none", "instant", "backoff"];
  var POLICY_NAMES = {
    none: "no retry",
    instant: "retry at once, 5 more times",
    backoff: "growing waits of 5, 10, 20, 40, 80 s"
  };

  var START_CLOCK = 4 * 3600;                // four in the morning
  var NARRATE_DELAY = 0.4;

  var PLACES = {
    server: {
      name: "an environment variable on the base server",
      exposed: false,
      who: [
        "the base server's own program, which adds it to each request",
        "the volunteers who look after that server"
      ],
      route: "wardens' page -> base server (no API key) -> provider (the server adds x-api-key)",
      note: "Kept out of the code and out of every browser. A secrets manager is stronger still: OWASP warns that environment variables can end up in logs or system dumps."
    },
    browser: {
      name: "the page's browser code",
      exposed: true,
      who: [
        "every laptop and phone that opens the relay page",
        "anyone with the link, by viewing the page's source or the browser's developer tools",
        "any browser add-on running on those machines"
      ],
      route: "wardens' page -> provider, with x-api-key sent from every browser",
      note: "Anthropic's TypeScript SDK leaves browsers disabled by default, to avoid exposing your secret API credentials, unless you set dangerouslyAllowBrowser."
    },
    repo: {
      name: "a public repository",
      exposed: true,
      who: [
        "anyone online who finds the repository",
        "scanners that search public code for API keys",
        "the repository's history, even after the line is deleted"
      ],
      route: "wherever the code runs, plus everyone who can read the repository",
      note: "Anthropic says GitHub scans public repositories for its API keys and Anthropic deactivates any it finds. Not every provider is told, and copies may already exist: revoke it and make a new one."
    }
  };
  var PLACE_KEYS = ["server", "browser", "repo"];

  /* ---------- teaching tokens ---------- */

  var TOKEN_SRC = "[A-Za-z0-9']+|[^\\sA-Za-z0-9']";

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function tokenList(s) { return String(s).match(new RegExp(TOKEN_SRC, "g")) || []; }

  function count(s) { return tokenList(s).length; }

  // The text of s up to the end of its n-th teaching token.
  function firstTokens(s, n) {
    var re = new RegExp(TOKEN_SRC, "g"), m, i = 0, end = 0;
    while (i < n && (m = re.exec(s)) !== null) { i += 1; end = m.index + m[0].length; }
    return s.slice(0, end);
  }

  /* ---------- the request ---------- */

  // The k most recent of Halvard's turns, oldest first.
  function turnsSent(k) { return TURNS.slice(TURNS.length - k); }

  // s = { system, turns, maxTokens, temp }
  function buildRequest(s) {
    var msgs = [], parts = [], sent = turnsSent(s.turns), input = 0;
    if (s.system) parts.push({ kind: "system", label: "system", tokens: count(SYSTEM_TEXT), turn: 0 });
    sent.forEach(function (tt, i) {
      var n = TURNS.length - sent.length + i + 1;
      msgs.push({ role: "user", content: tt.u });
      msgs.push({ role: "assistant", content: tt.a });
      parts.push({ kind: "user", label: "Halvard", tokens: count(tt.u), turn: n });
      parts.push({ kind: "assistant", label: "station", tokens: count(tt.a), turn: n });
    });
    msgs.push({ role: "user", content: QUESTION });
    parts.push({ kind: "question", label: "question", tokens: count(QUESTION), turn: 0 });
    var body = { model: MODEL_NAME, max_tokens: s.maxTokens };
    if (s.temp !== "off") body.temperature = Number(s.temp);
    if (s.system) body.system = SYSTEM_TEXT;
    body.messages = msgs;
    parts.forEach(function (p) { input += p.tokens; });
    return { body: body, parts: parts, input: input, messages: msgs.length, turns: s.turns };
  }

  function headerLines() {
    return [
      "POST " + ENDPOINT_PATH + "   (to the provider)",
      "x-api-key: " + HIDDEN,
      "anthropic-version: " + API_VERSION,
      "content-type: application/json"
    ];
  }

  function requestText(req) { return headerLines().join("\n") + "\n\n" + JSON.stringify(req.body, null, 2); }

  /* ---------- the toy station's response ---------- */

  function costMicro(inTok, outTok) { return inTok * PRICE_IN + outTok * PRICE_OUT; }

  function fullReply(s) {
    var hist = s.turns > 0;
    if (s.system) return hist ? REPLY.sysHist : REPLY.sysClean;
    return hist ? REPLY.plainHist : REPLY.plainClean;
  }

  function respond(s, req) {
    var full = fullReply(s), len = count(full), cut = len > s.maxTokens;
    var out = cut ? s.maxTokens : len, text = cut ? firstTokens(full, s.maxTokens) : full;
    var json = {
      id: "msg_teaching_0147",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: text }],
      model: MODEL_NAME,
      stop_reason: cut ? "max_tokens" : "end_turn",
      stop_sequence: null,
      usage: { input_tokens: req.input, output_tokens: out }
    };
    return { full: full, fullTokens: len, text: text, output: out, stop: json.stop_reason, input: req.input,
      micro: costMicro(req.input, out), json: json, halvard: s.turns > 0 };
  }

  /* ---------- the roll-call drill ---------- */

  // d = { stranger, policy, burst }
  function drill(d) {
    var bucket = CAP, due = {}, served = 0, refused = 0, failed = 0, last = null, retryAfter = null;
    var attempts = [], bursts = [], unserved = [], t, i;
    due[0] = [];
    for (i = 1; i <= d.burst; i++) due[0].push({ call: i, tries: 0 });
    for (t = 0; t < DRILL_SECONDS; t++) {
      if (t > 0 && t % REFILL_EVERY === 0) bucket = Math.min(CAP, bucket + 1);
      if (d.stranger && t % 60 === 0) {
        var take = Math.min(STRANGER_BURST, bucket);
        bucket -= take;
        bursts.push({ t: t, served: take, refused: STRANGER_BURST - take });
      }
      var q = (due[t] || []).slice().sort(function (a, b) { return a.call - b.call; });
      delete due[t];
      while (q.length) {
        var a = q.shift();
        if (bucket >= 1) {
          bucket -= 1;
          served += 1;
          last = t;
          attempts.push({ call: a.call, t: t, ok: true });
        } else {
          refused += 1;
          if (retryAfter === null) retryAfter = REFILL_EVERY - (t % REFILL_EVERY);
          attempts.push({ call: a.call, t: t, ok: false });
          if (d.policy === "none" || a.tries >= MAX_RETRIES) {
            failed += 1;
            unserved.push(a.call);
          } else if (d.policy === "instant") {
            q.unshift({ call: a.call, tries: a.tries + 1 });
          } else {
            var at = t + WAITS[a.tries];
            if (!own(due, at)) due[at] = [];
            due[at].push({ call: a.call, tries: a.tries + 1 });
          }
        }
      }
    }
    Object.keys(due).forEach(function (k) {
      due[k].forEach(function (a) { failed += 1; unserved.push(a.call); });
    });
    unserved.sort(function (x, y) { return x - y; });
    return { burst: d.burst, stranger: !!d.stranger, policy: d.policy, served: served, refused: refused,
      failed: failed, last: last, retryAfter: retryAfter, attempts: attempts, bursts: bursts, unserved: unserved };
  }

  /* ---------- formatting ---------- */

  function dollars6(micro) { return (micro / 1000000).toFixed(6); }
  function dollars2(micro) { return (micro / 1000000).toFixed(2); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function clockOf(sec) {
    var s = ((sec % 86400) + 86400) % 86400;
    return pad2(Math.floor(s / 3600)) + ":" + pad2(Math.floor((s % 3600) / 60)) + ":" + pad2(s % 60);
  }
  function tempText(v) { return v === "off" ? "not sent" : v; }

  /* ---------- the widget ---------- */

  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (own(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }

  function txt(doc, parent, x, y, text, cls, anchor, style) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "middle" }, parent);
    if (style) t.setAttribute("style", style);
    t.textContent = text;
    return t;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  var PRE_STYLE = "margin:0;padding:8px 0;font-family:var(--f-ui),monospace;font-size:11px;line-height:1.45;" +
    "white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto;";

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function el(tag, cls, style, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    function head(text) { return el("p", "small muted", "margin:6px 0 0;font-weight:600;letter-spacing:.04em;", text); }

    var box = el("div", "", "display:grid;gap:8px;padding:10px;min-width:0;");
    box.appendChild(el("p", "muted", "margin:0;font-size:12px;",
      "A request console: nothing here goes over the network. The model name, token counts, prices and rate limit " +
      "are teaching values, and the station is a toy that answers from what arrives."));

    box.appendChild(head("What goes in: input tokens, and the answer against max_tokens"));
    var barSvg = mk(doc, "svg", { viewBox: "0 0 640 124", width: "100%", "class": "dg", role: "img", "aria-label": "" });
    box.appendChild(barSvg);

    var pair = el("div", "", "display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));min-width:0;");
    var left = el("div", "", "min-width:0;");
    var right = el("div", "", "min-width:0;");
    left.appendChild(head("The request, as the page would send it"));
    var reqPre = el("pre", "small", PRE_STYLE, "");
    left.appendChild(reqPre);
    right.appendChild(head("The response"));
    var said = el("p", "", "margin:4px 0 0;font-size:13px;font-style:italic;", "");
    said.setAttribute("aria-live", "polite");
    right.appendChild(said);
    var resPre = el("pre", "small", PRE_STYLE, "");
    right.appendChild(resPre);
    pair.appendChild(left);
    pair.appendChild(right);
    box.appendChild(pair);

    box.appendChild(head("Who can read the API key"));
    var keyWhere = el("p", "", "margin:0;font-size:13px;", "");
    keyWhere.setAttribute("aria-live", "polite");
    box.appendChild(keyWhere);
    var keyList = el("ul", "small", "margin:0;padding-left:18px;", "");
    box.appendChild(keyList);
    var keyRoute = el("p", "small muted", "margin:0;font-family:var(--f-ui),monospace;", "");
    box.appendChild(keyRoute);
    var keyNote = el("p", "small muted", "margin:0;", "");
    box.appendChild(keyNote);

    box.appendChild(head("The 02:00 roll call against the teaching rate limit"));
    var drillSvg = mk(doc, "svg", { viewBox: "0 0 640 200", width: "100%", "class": "dg", role: "img", "aria-label": "" });
    box.appendChild(drillSvg);
    var drillNote = el("p", "", "margin:0;font-size:13px;", "");
    drillNote.setAttribute("aria-live", "polite");
    box.appendChild(drillNote);

    api.root.appendChild(box);
    return { doc: doc, barSvg: barSvg, reqPre: reqPre, said: said, resPre: resPre, keyWhere: keyWhere,
      keyList: keyList, keyRoute: keyRoute, keyNote: keyNote, drillSvg: drillSvg, drillNote: drillNote };
  }

  /* ---------- drawing ---------- */

  var PX_PER_TOKEN = 2;

  function drawBar(S) {
    var ui = S.ui, doc = ui.doc, svg = ui.barSvg, req = S.req, res = S.res, X0 = 20, Y = 24, H = 26, x = X0;
    clear(svg);
    var turnStart = {}, turnEnd = {}, sysT = 0, qT = 0, hist = 0;
    req.parts.forEach(function (p) {
      var w = p.tokens * PX_PER_TOKEN, cls, op;
      if (p.kind === "system") { cls = "dot dot-accent"; op = "0.8"; sysT = p.tokens; }
      else if (p.kind === "user") { cls = "dot dot-wait"; op = "0.75"; }
      else if (p.kind === "assistant") { cls = "dot dot-req"; op = "0.6"; }
      else { cls = "dot dot-ok"; op = "0.85"; qT = p.tokens; }
      mk(doc, "rect", { x: x.toFixed(1), y: Y, width: Math.max(1, w - 1).toFixed(1), height: H, rx: 2, "class": cls, "fill-opacity": op }, svg);
      if (p.kind === "system" || p.kind === "question") {
        txt(doc, svg, (x + w / 2).toFixed(1), Y + H / 2 + 4, (p.kind === "system" ? "system " : "Q ") + p.tokens,
          "dg-label", "middle", "font-size:10px;font-weight:400;");
      }
      if (p.turn) {
        if (!own(turnStart, p.turn)) turnStart[p.turn] = x;
        turnEnd[p.turn] = x + w;
        hist += p.tokens;
      }
      x += w;
    });
    Object.keys(turnStart).forEach(function (k) {
      var a = turnStart[k], b = turnEnd[k], n = Number(k);
      mk(doc, "path", { d: "M" + a.toFixed(1) + " " + (Y + H + 3) + " H " + (b - 2).toFixed(1), "class": "dg-axis" }, svg);
      txt(doc, svg, ((a + b) / 2).toFixed(1), Y + H + 14, "turn " + n + ": " + (count(TURNS[n - 1].u) + count(TURNS[n - 1].a)),
        "dg-axis", "middle", "font-size:10px;");
    });
    txt(doc, svg, X0, 14, "Input: " + req.input + " tokens = " + (sysT ? "system " + sysT + " + " : "") +
      (hist ? req.turns + (req.turns === 1 ? " turn " : " turns ") + hist + " + " : "") + "question " + qT +
      "  (" + req.messages + " messages)", "dg-axis", "start", "font-size:10px;");
    var OY = 86, OH = 16, capW = S.maxTokens * PX_PER_TOKEN, outW = res.output * PX_PER_TOKEN;
    mk(doc, "rect", { x: X0, y: OY, width: Math.max(1, outW).toFixed(1), height: OH, rx: 2,
      "class": res.stop === "max_tokens" ? "dot dot-fail" : "dot dot-ok", "fill-opacity": "0.8" }, svg);
    mk(doc, "rect", { x: X0 - 1, y: OY - 3, width: (capW + 2).toFixed(1), height: OH + 6, rx: 3,
      "class": "dg-edge tone-accent", fill: "none", style: "stroke-width:2" }, svg);
    txt(doc, svg, X0, OY - 7, "Output: " + res.output + " of max_tokens " + S.maxTokens + " (the full answer is " +
      res.fullTokens + ")", "dg-axis", "start", "font-size:10px;");
    txt(doc, svg, X0, OY + OH + 14, "stop_reason: " + res.stop + (res.stop === "max_tokens" ? ", cut mid-sentence" : ", finished"),
      "dg-label", "start", "font-size:11px;");
    svg.setAttribute("aria-label", "Input " + req.input + " tokens in " + req.messages + " messages" +
      (S.system ? ", system prompt " + sysT : ", no system prompt") + ", " + req.turns + " of Halvard's turns, question " + qT +
      ". Output " + res.output + " of max_tokens " + S.maxTokens + ", stop_reason " + res.stop + ".");
  }

  function drawText(S) {
    var ui = S.ui, res = S.res;
    ui.reqPre.textContent = requestText(S.req);
    ui.said.textContent = res.text + (res.stop === "max_tokens" ? "   [stopped: max_tokens]" : "");
    ui.resPre.textContent = JSON.stringify(res.json, null, 2);
  }

  function drawKey(S) {
    var ui = S.ui, doc = ui.doc, P = PLACES[S.place];
    ui.keyWhere.textContent = "The API key lives in " + P.name + ". " + (P.exposed
      ? "Exposed: anyone below can call the provider as Teun, on his limit and his bill."
      : "Not exposed: no browser ever receives it.");
    clear(ui.keyList);
    P.who.forEach(function (w) {
      var li = doc.createElement("li");
      li.textContent = w;
      ui.keyList.appendChild(li);
    });
    ui.keyRoute.textContent = P.route;
    ui.keyNote.textContent = P.note + " Moving the API key doesn't cancel a copy someone already has; only revoking does.";
  }

  function drawDrill(S) {
    var ui = S.ui, doc = ui.doc, svg = ui.drillSvg, d = S.drill, X0 = 40, X1 = 628, TOP = 26, BOT = 162;
    var PX = (X1 - X0) / DRILL_SECONDS, RH = (BOT - TOP) / d.burst, i;
    clear(svg);
    function xs(t) { return X0 + t * PX; }
    d.bursts.forEach(function (b) {
      mk(doc, "path", { d: "M" + xs(b.t).toFixed(1) + " " + (TOP - 6) + " V " + BOT, "class": "dg-edge tone-bad",
        fill: "none", style: "stroke-dasharray:4 3;stroke-width:1.5" }, svg);
      txt(doc, svg, (xs(b.t) + 3).toFixed(1), 12, "stranger " + b.served + "/" + STRANGER_BURST, "dg-axis", "start", "font-size:9px;");
    });
    var groups = {};
    d.attempts.forEach(function (a) {
      var k = a.call + "@" + a.t;
      if (!own(groups, k)) groups[k] = { call: a.call, t: a.t, fails: 0, ok: false };
      if (a.ok) groups[k].ok = true; else groups[k].fails += 1;
    });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], cy = TOP + (g.call - 0.5) * RH, cx = xs(g.t) + 2;
      if (g.fails) {
        mk(doc, "rect", { x: (cx - 1.5).toFixed(1), y: (cy - RH * 0.35).toFixed(1), width: 3, height: Math.max(2, RH * 0.7).toFixed(1),
          "class": "dot dot-fail", "fill-opacity": "0.9" }, svg);
        if (g.fails > 1 && RH >= 9) txt(doc, svg, (cx + 4).toFixed(1), (cy + 3).toFixed(1), "x" + g.fails, "dg-axis", "start", "font-size:8px;");
      }
      if (g.ok) mk(doc, "circle", { cx: (cx + (g.fails ? 5 : 0)).toFixed(1), cy: cy.toFixed(1), r: Math.min(3.5, Math.max(1.5, RH * 0.32)).toFixed(1),
        "class": "dot dot-ok", "fill-opacity": "0.95" }, svg);
    });
    if (RH >= 9) {
      for (i = 1; i <= d.burst; i++) {
        txt(doc, svg, X0 - 6, (TOP + (i - 0.5) * RH + 3).toFixed(1), String(i), "dg-axis", "end", "font-size:9px;");
        if (d.unserved.indexOf(i) >= 0) txt(doc, svg, X1, (TOP + (i - 0.5) * RH + 3).toFixed(1), "station busy", "dg-label", "end", "font-size:9px;");
      }
    } else {
      txt(doc, svg, X0 - 6, TOP + 6, "1", "dg-axis", "end", "font-size:9px;");
      txt(doc, svg, X0 - 6, BOT, String(d.burst), "dg-axis", "end", "font-size:9px;");
    }
    mk(doc, "path", { d: "M" + X0 + " " + (BOT + 4) + " H " + X1, "class": "dg-axis" }, svg);
    [0, 30, 60, 90, 120, 150, 180].forEach(function (s) {
      mk(doc, "path", { d: "M" + xs(s).toFixed(1) + " " + (BOT + 4) + " V " + (BOT + 8), "class": "dg-axis" }, svg);
      if (s % 60 === 0) txt(doc, svg, xs(s).toFixed(1), BOT + 19, clockOf(ROLL_CALL_CLOCK + s).slice(0, 5), "dg-axis", "middle", "font-size:10px;");
    });
    txt(doc, svg, X0, 196, "rows: calls; green: served; red: 429 (xN: N refusals in that second); dashed: the stranger's calls",
      "dg-axis", "start", "font-size:9px;");
    svg.setAttribute("aria-label", drillSummary(S));
    ui.drillNote.textContent = drillSummary(S);
  }

  function drillSummary(S) {
    var d = S.drill;
    return "Roll call at 02:00, " + d.burst + " calls at once, the stranger " + (d.stranger ? "on" : "off") + ", " +
      POLICY_NAMES[d.policy] + ": " + d.served + " of " + d.burst + " served, " + d.refused + " refusals (429 rate_limit_error" +
      (d.retryAfter !== null ? ", retry-after: " + d.retryAfter : "") + ")" +
      (d.failed ? ", " + d.failed + (d.failed === 1 ? " tower hears" : " towers hear") + " station busy" : "") +
      (d.failed === 0 && d.last !== null && d.last > 0 ? ", the last served at " + clockOf(ROLL_CALL_CLOCK + d.last) : "") + ".";
  }

  function drawStats(S) {
    S.stat.input(String(S.res.input));
    S.stat.output(String(S.res.output));
    S.stat.stop(S.res.stop);
    S.stat.cost(dollars6(S.res.micro));
    S.stat.exposed(PLACES[S.place].exposed ? "yes" : "no");
    S.stat.served(S.drill.served + " of " + S.drill.burst);
    S.stat.r429(String(S.drill.refused));
  }

  function settings(S) { return { system: S.system, turns: S.turns, maxTokens: S.maxTokens, temp: S.temp }; }
  function drillSettings(S) { return { stranger: S.stranger, policy: S.policy, burst: S.burst }; }

  function draw(api) {
    var S = api.state;
    S.req = buildRequest(settings(S));
    S.res = respond(settings(S), S.req);
    S.drill = drill(drillSettings(S));
    drawBar(S);
    drawText(S);
    drawKey(S);
    drawDrill(S);
    drawStats(S);
  }

  /* ---------- narration ---------- */

  function reqSummary(S) {
    var r = S.res;
    return "System prompt " + (S.system ? "on" : "off") + ", " + S.turns + " of Halvard's turns, max_tokens " + S.maxTokens +
      ", temperature " + tempText(S.temp) + ": " + r.input + " tokens in, " + r.output + " out, stop_reason " + r.stop +
      ", " + dollars6(r.micro) + " dollars. The station: " + r.text;
  }

  function reqTone(S) { return S.res.halvard ? "bad" : (S.res.stop === "max_tokens" ? "warn" : "ok"); }

  function keySummary(S) {
    var P = PLACES[S.place];
    return "API key in " + P.name + ": " + (P.exposed ? "exposed to " + P.who[0] + ", and more." : "readable only by " + P.who[0] + ".");
  }

  function drillTone(S) { return S.drill.failed ? "bad" : (S.drill.refused ? "warn" : "ok"); }

  function narrateLater(api) {
    var S = api.state;
    if (S.narrateTimer) S.narrateTimer.cancel();
    S.narrateTimer = api.after(NARRATE_DELAY, function () {
      S.narrateTimer = null;
      api.log(reqSummary(S), reqTone(S));
    });
  }

  function setReq(api, name, v) {
    var S = api.state;
    S[name] = v;
    draw(api);
    api.log(reqSummary(S), reqTone(S));
  }

  function setTurns(api, v) {
    var S = api.state, k = Math.round(Number(v));
    if (!(k >= 0 && k <= TURNS.length)) return;
    S.turns = k;
    draw(api);
    narrateLater(api);
  }

  function setPlace(api, v) {
    var S = api.state;
    if (PLACE_KEYS.indexOf(v) < 0) return;
    S.place = v;
    draw(api);
    api.log(keySummary(S), PLACES[v].exposed ? "bad" : "ok");
  }

  function setDrill(api, name, v) {
    var S = api.state;
    S[name] = v;
    draw(api);
    api.log(drillSummary(S), drillTone(S));
  }

  /* ---------- the module ---------- */

  DL.sims.define("a2e01", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.system = true;
      S.turns = STORY_TURNS;
      S.maxTokens = STORY_MAX;
      S.temp = STORY_TEMP;
      S.place = STORY_PLACE;
      S.policy = STORY_POLICY;
      S.stranger = true;
      S.burst = STORY_BURST;
      S.narrateTimer = null;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.system = api.control.toggle("system", "System prompt (the standing orders, 42 tokens)", true,
        function (v) { setReq(api, "system", !!v); });
      S.ctl.turns = api.control.range("turns", "Halvard's past turns resent", 0, TURNS.length, 1, STORY_TURNS,
        function (v) { setTurns(api, v); },
        { format: function (v) { var k = Math.round(Number(v)); return k + " of 4 (" + 2 * k + " messages)"; } });
      S.ctl.max = api.control.select("max", "max_tokens", MAX_CHOICES.map(function (m) {
        return { value: String(m), label: String(m) + (m === STORY_MAX ? " (Teun's page)" : "") };
      }), String(STORY_MAX), function (v) {
        var m = Number(v);
        if (MAX_CHOICES.indexOf(m) < 0) return;
        setReq(api, "maxTokens", m);
      });
      S.ctl.temp = api.control.select("temp", "temperature", TEMP_CHOICES.map(function (v) {
        return { value: v, label: v === "off" ? "not sent" : v + (v === STORY_TEMP ? " (Teun's page)" : "") };
      }), STORY_TEMP, function (v) {
        if (TEMP_CHOICES.indexOf(v) < 0) return;
        setReq(api, "temp", v);
      });
      S.ctl.place = api.control.select("place", "Where the API key lives", [
        { value: "server", label: "Environment variable on the base server" },
        { value: "browser", label: "In the page's browser code (Teun's page)" },
        { value: "repo", label: "Pasted into a public repository" }
      ], STORY_PLACE, function (v) { setPlace(api, v); });
      S.ctl.policy = api.control.select("policy", "Drill: after a 429", [
        { value: "none", label: "No retry" },
        { value: "instant", label: "Retry at once, 5 more times (Teun's page)" },
        { value: "backoff", label: "Growing waits: 5, 10, 20, 40, 80 s" }
      ], STORY_POLICY, function (v) {
        if (POLICIES.indexOf(v) < 0) return;
        setDrill(api, "policy", v);
      });
      S.ctl.stranger = api.control.toggle("stranger", "Drill: a stranger is using the API key", true,
        function (v) { setDrill(api, "stranger", !!v); });
      S.ctl.burst = api.control.select("burst", "Drill: calls sent at once", BURSTS.map(function (b) {
        return { value: String(b), label: String(b) + (b === STORY_BURST ? " (the roll call)" : "") };
      }), String(STORY_BURST), function (v) {
        var b = Number(v);
        if (BURSTS.indexOf(b) < 0) return;
        setDrill(api, "burst", b);
      });
      S.ctl.reset = api.control.button("reset", "Reset to 01:47", function () { api.reset(); });

      S.stat = {
        input: api.stat("input", "tokens in (usage)", ""),
        output: api.stat("output", "tokens out (usage)", ""),
        stop: api.stat("stop", "stop_reason", "warn"),
        cost: api.stat("cost", "dollars for this call, teaching prices", ""),
        exposed: api.stat("exposed", "API key exposed", "bad"),
        served: api.stat("served", "roll call served", ""),
        r429: api.stat("r429", "429 refusals in the drill", "bad")
      };

      api.info("<strong>How to read it.</strong> The top bar is what the request sends: the system prompt, then Halvard's " +
        "saved turns (user and assistant messages), then Marisol's question, in teaching tokens, one per word, number or " +
        "punctuation mark. The lower bar is the answer against the max_tokens cap. Below are the request as the page would " +
        "send it, with the API key always shown as [hidden], and the station's response with its stop_reason and usage. " +
        "Cost uses teaching prices: $2 per million input tokens, $10 per million output. The model name is made up, and " +
        "temperature doesn't change the scripted answer; Anthropic's newest models reject any temperature but 1.0. The " +
        "drill's limit is a teaching token bucket: 12 calls, one more every 5 seconds, shared by everyone holding the key.");
      draw(api);
      api.log("Four in the morning. The 01:47 request for Tower 6: the system prompt, Halvard's 4 turns (8 messages) and " +
        "Marisol's question, " + S.res.input + " tokens in, max_tokens " + S.maxTokens + ". The station: " + S.res.text +
        " (stop_reason " + S.res.stop + ", " + S.res.output + " tokens out).", "bad");
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function sv(id) { return String(t.stat(id)); }
      function cfg(sys, k, mx, temp) { return { system: !!sys, turns: k, maxTokens: mx, temp: temp === undefined ? "off" : temp }; }
      function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
      var ok, k;

      // 1. The start is the 01:47 request.
      await t.run(1);
      var s0 = st();
      t.expect(s0.system === true && s0.turns === 4 && s0.maxTokens === 40 && s0.temp === "0.3" && s0.place === "browser" &&
        s0.policy === "instant" && s0.stranger === true && s0.burst === 12 &&
        t.stat("input") === 255 && t.stat("output") === 40 && sv("stop") === "max_tokens" && t.stat("cost") === 0.00091 &&
        sv("exposed") === "yes" && sv("served") === "2 of 12" && t.stat("r429") === 60 && s0.req.messages === 9 &&
        s0.res.text === firstTokens(REPLY.sysHist, 40) && /Stay in the$/.test(s0.res.text) &&
        t.logText().indexOf("Stay in the") >= 0,
        "the start is the 01:47 request: system prompt on, 4 of Halvard's turns, 9 messages, 255 tokens in, max_tokens 40, temperature 0.3; the answer stops at Stay in the with stop_reason max_tokens and 40 tokens out, 0.000910 dollars; the API key in browser code, exposed; the roll call 2 of 12 with 60 refusals");

      // 2. Input tokens grow exactly with the resent turns.
      ok = true;
      [true, false].forEach(function (sys) {
        var base = buildRequest(cfg(sys, 0, 40)).input, prev = base;
        if (base !== (sys ? count(SYSTEM_TEXT) : 0) + count(QUESTION)) ok = false;
        for (k = 1; k <= 4; k++) {
          var r = buildRequest(cfg(sys, k, 40)), added = 0;
          turnsSent(k).forEach(function (tt) { added += count(tt.u) + count(tt.a); });
          if (r.input !== base + added || r.input <= prev || r.messages !== 2 * k + 1) ok = false;
          if (r.body.messages[r.body.messages.length - 1].content !== QUESTION) ok = false;
          prev = r.input;
        }
      });
      var ins = [0, 1, 2, 3, 4].map(function (kk) { return buildRequest(cfg(true, kk, 40)).input; });
      var insOff = [0, 1, 2, 3, 4].map(function (kk) { return buildRequest(cfg(false, kk, 40)).input; });
      t.expect(ok && same(ins, [65, 126, 167, 208, 255]) && same(insOff, [23, 84, 125, 166, 213]),
        "input tokens = system prompt + the resent turns + the question, exactly, for 0 to 4 turns with and without the system prompt: 65, 126, 167, 208, 255 and 23, 84, 125, 166, 213; each turn adds two messages, and the question is always last");

      // 3. max_tokens below the answer's length cuts it and says so.
      ok = true;
      [true, false].forEach(function (sys) {
        for (k = 0; k <= 4; k++) {
          MAX_CHOICES.forEach(function (mx) {
            var c = cfg(sys, k, mx), rq = buildRequest(c), rs = respond(c, rq);
            if (mx < rs.fullTokens) {
              if (rs.stop !== "max_tokens" || rs.output !== mx || count(rs.text) !== mx || rs.full.indexOf(rs.text) !== 0 ||
                rs.json.usage.output_tokens !== mx) ok = false;
            } else if (rs.stop !== "end_turn" || rs.output !== rs.fullTokens || rs.text !== rs.full) ok = false;
            if (rs.json.usage.input_tokens !== rq.input || rs.json.stop_sequence !== null) ok = false;
          });
        }
      });
      var story = respond(cfg(true, 4, 40), buildRequest(cfg(true, 4, 40)));
      var whole = respond(cfg(true, 4, 80), buildRequest(cfg(true, 4, 80)));
      t.expect(ok && story.stop === "max_tokens" && story.output === 40 && story.fullTokens === 49 &&
        whole.stop === "end_turn" && whole.output === 49 && whole.text === REPLY.sysHist,
        "whenever max_tokens is below the answer's length, stop_reason is max_tokens, output tokens equal max_tokens and the text is the answer's first max_tokens tokens; otherwise end_turn and the whole answer; the story's 49-token answer stops at 40, and arrives whole at 80");

      // 4. The cost math is exact.
      ok = true;
      [true, false].forEach(function (sys) {
        for (k = 0; k <= 4; k++) {
          MAX_CHOICES.forEach(function (mx) {
            var c = cfg(sys, k, mx), rq = buildRequest(c), rs = respond(c, rq);
            if (!(Number.isInteger(rs.micro) && rs.micro === rq.input * PRICE_IN + rs.output * PRICE_OUT)) ok = false;
          });
        }
      });
      var clean = respond(cfg(true, 0, 40), buildRequest(cfg(true, 0, 40)));
      var strangerMicro = costMicro(STRANGER_IN, STRANGER_OUT);
      t.expect(ok && story.micro === 910 && dollars6(story.micro) === "0.000910" && clean.micro === 460 &&
        strangerMicro === 32400000 && dollars2(strangerMicro) === "32.40" && PRICE_IN === 2 && PRICE_OUT === 10,
        "cost is input x $2 plus output x $10 per million, in whole micro-dollars, for every setting: the 01:47 call 255 x 2 + 40 x 10 = 910 (0.000910 dollars), the clean call 460, and the stranger's night 7,200,000 in and 1,800,000 out = $32.40");

      // 5. The request never contains an API key value. The key-shaped pattern (s, k, a hyphen, then a
      //    letter or digit) is built from pieces so this file holds no key-shaped text itself.
      var keyShape = new RegExp("\\bs" + "k" + "-[A-Za-z0-9]", "i");
      ok = true;
      var allowed = ["model", "max_tokens", "temperature", "system", "messages"];
      [true, false].forEach(function (sys) {
        for (k = 0; k <= 4; k++) {
          MAX_CHOICES.forEach(function (mx) {
            TEMP_CHOICES.forEach(function (tp) {
              var rq = buildRequest(cfg(sys, k, mx, tp)), text = requestText(rq), lines = text.split("\n");
              var keyLines = lines.filter(function (ln) { return ln.toLowerCase().indexOf("x-api-key") >= 0; });
              if (keyLines.length !== 1 || keyLines[0] !== "x-api-key: " + HIDDEN) ok = false;
              if (keyShape.test(text) || /api[_-]?key/i.test(JSON.stringify(rq.body))) ok = false;
              if (!Object.keys(rq.body).every(function (f) { return allowed.indexOf(f) >= 0; })) ok = false;
              if ((tp === "off") !== !own(rq.body, "temperature")) ok = false;
              if (sys !== own(rq.body, "system")) ok = false;
            });
          });
        }
      });
      var shown = st().ui.reqPre.textContent;
      t.expect(ok && shown.indexOf("x-api-key: [hidden]") >= 0 && !keyShape.test(shown) && !keyShape.test(st().ui.resPre.textContent),
        "in every request the console can build, the only API key line is x-api-key: [hidden], nothing key-shaped appears, the body holds only model, max_tokens, temperature (only when sent), system (only when on) and messages; the request and response on screen hold no key");

      // 6. Browser code and a public repository expose the API key; the server's environment variable doesn't.
      t.expect(PLACES.browser.exposed === true && PLACES.repo.exposed === true && PLACES.server.exposed === false &&
        PLACE_KEYS.every(function (p) { return PLACES[p].who.length >= 2 && PLACES[p].route.length > 0; }) &&
        PLACES.server.route.indexOf("no API key") >= 0,
        "the placements: browser code and a public repository are flagged as exposed, the environment variable on the base server is not, and on the server route the browser carries no API key");

      // 7. The drill's story counts.
      var dNone = drill({ stranger: true, policy: "none", burst: 12 });
      var dInst = drill({ stranger: true, policy: "instant", burst: 12 });
      var dBack = drill({ stranger: true, policy: "backoff", burst: 12 });
      var dFree = drill({ stranger: false, policy: "instant", burst: 12 });
      var backTimes = dBack.attempts.filter(function (a) { return a.ok; }).map(function (a) { return a.t; });
      t.expect(dNone.served === 2 && dNone.refused === 10 && dNone.failed === 10 &&
        dInst.served === 2 && dInst.refused === 60 && dInst.failed === 10 && dInst.retryAfter === 5 &&
        dInst.bursts[0].served === 10 && same(dInst.unserved, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) &&
        dBack.served === 12 && dBack.refused === 29 && dBack.failed === 0 && dBack.last === 75 &&
        same(backTimes, [0, 0, 5, 15, 15, 35, 35, 35, 35, 75, 75, 75]) && clockOf(ROLL_CALL_CLOCK + dBack.last) === "02:01:15" &&
        dFree.served === 12 && dFree.refused === 0 && dFree.failed === 0,
        "the roll call with the stranger on: no retry serves 2 and refuses 10; retrying at once serves 2 with 60 refusals (10 + 10 x 5, retry-after 5) and 10 towers hear station busy; growing waits serve 1 at 02:00:05, 2 at 02:00:15, 4 at 02:00:35 and 3 at 02:01:15, all 12 after 29 refusals; with the stranger off, 12 of 12 first time");

      // 8. Backoff serves every call; retrying at once never serves more and only adds refusals.
      ok = true;
      BURSTS.forEach(function (b) {
        [false, true].forEach(function (str) {
          var n = drill({ stranger: str, policy: "none", burst: b });
          var i = drill({ stranger: str, policy: "instant", burst: b });
          var g = drill({ stranger: str, policy: "backoff", burst: b });
          if (i.served !== n.served || i.refused < n.refused || (n.refused > 0 && !(i.refused > n.refused))) ok = false;
          if (g.served < i.served || g.served + g.failed !== b) ok = false;
          if ((!str || b <= 18) && (g.served !== b || g.failed !== 0)) ok = false;
        });
      });
      var big = drill({ stranger: false, policy: "backoff", burst: 24 }), bigS = drill({ stranger: true, policy: "backoff", burst: 24 });
      t.expect(ok && big.served === 24 && big.refused === 37 && bigS.served === 19 && bigS.failed === 5,
        "for 6, 12, 18 and 24 calls, retrying at once serves exactly as many as not retrying and always adds refusals when there are any; growing waits serve every call without the stranger, and with him up to 18 calls; 24 calls without him need 37 refusals, and with him growing waits still leave 5 unserved");

      // 9. Every story number, checked exactly.
      var turnTok = TURNS.map(function (tt) { return count(tt.u) + count(tt.a); });
      t.expect(count(SYSTEM_TEXT) === 42 && same(turnTok, [47, 41, 41, 61]) && same(TURNS.map(function (tt) { return count(tt.u); }), [18, 20, 20, 29]) &&
        same(TURNS.map(function (tt) { return count(tt.a); }), [29, 21, 21, 32]) && 47 + 41 + 41 + 61 === 190 &&
        count(QUESTION) === 23 && 42 + 190 + 23 === 255 && count(REPLY.sysHist) === 49 && count(REPLY.sysClean) === 33 &&
        count(REPLY.plainHist) === 78 && count(REPLY.plainClean) === 66 && STORY_MAX === 40 && STORY_TEMP === "0.3" &&
        STRANGER_CALLS === STRANGER_HOURS * 60 * STRANGER_BURST && STRANGER_IN === STRANGER_CALLS * 2000 &&
        STRANGER_OUT === STRANGER_CALLS * 500 && CAP === 12 && 60 / REFILL_EVERY === 12 && STRANGER_BURST === 10 &&
        STORY_BURST === 12 && MAX_RETRIES === 5 && same(WAITS, [5, 10, 20, 40, 80]) && START_CLOCK === 14400 &&
        clockOf(ROLL_CALL_CLOCK) === "02:00:00" && respond(cfg(false, 4, 80), buildRequest(cfg(false, 4, 80))).output === 78,
        "story numbers: system prompt 42; Halvard's turns 47, 41, 41, 61 (190, from 18 + 29, 20 + 21, 20 + 21, 29 + 32); the question 23; 255 in; answers 49, 33, 78 and 66; max_tokens 40, temperature 0.3; the stranger's 3,600 calls = 6 h x 60 x 10, 7,200,000 in and 1,800,000 out; the bucket 12, refilled 12 a minute; 10 stranger calls; 12 roll-call calls; 5 retries; waits 5 to 80; four in the morning; the roll call at 02:00");

      // 10. The toy station says what the story says.
      ok = true;
      [true, false].forEach(function (sys) {
        for (k = 0; k <= 4; k++) {
          var full = fullReply(cfg(sys, k, 160));
          if (k > 0 && full.indexOf("Halvard") < 0) ok = false;
          if (k === 0 && (full.indexOf("Halvard") >= 0 || full.indexOf("stairs") >= 0)) ok = false;
          if (sys !== (full.indexOf("Tower 6, far station.") === 0)) ok = false;
        }
      });
      t.expect(ok && REPLY.sysHist.indexOf("nobody is on your stairs") >= 0 && clean.text === REPLY.sysClean &&
        clean.stop === "end_turn" && clean.output === 33 && clean.input === 65,
        "the station names Halvard whenever any of his turns arrive and never otherwise; it starts with the call sign only when the system prompt arrives; with no turns and the system prompt it answers cleanly: 65 in, 33 out, end_turn");

      // 11. The same settings give the same request, answer and drill, bit for bit.
      t.expect(requestText(buildRequest(cfg(true, 3, 80, "0.7"))) === requestText(buildRequest(cfg(true, 3, 80, "0.7"))) &&
        JSON.stringify(respond(cfg(false, 2, 20), buildRequest(cfg(false, 2, 20)))) === JSON.stringify(respond(cfg(false, 2, 20), buildRequest(cfg(false, 2, 20)))) &&
        JSON.stringify(drill({ stranger: true, policy: "backoff", burst: 18 })) === JSON.stringify(drill({ stranger: true, policy: "backoff", burst: 18 })),
        "the sim is deterministic: the same settings give the identical request, answer and drill");

      // 12. The controls.
      t.set("turns", 0);
      await t.run(1);
      var v0 = t.stat("input") === 65 && t.stat("output") === 33 && sv("stop") === "end_turn" && t.logText().indexOf("end_turn") >= 0 &&
        st().ui.reqPre.textContent.indexOf("Halvard") < 0;
      t.set("turns", 4);
      await t.run(1);
      t.set("max", "80");
      var v80 = t.stat("input") === 255 && t.stat("output") === 49 && sv("stop") === "end_turn";
      t.set("system", false);
      var vOff = t.stat("input") === 213 && t.stat("output") === 78 && sv("stop") === "end_turn" &&
        st().res.text.indexOf("Tower 6") !== 0 && st().ui.reqPre.textContent.indexOf("\"system\"") < 0;
      t.set("system", true);
      t.set("max", "40");
      t.set("temp", "off");
      var vTemp = !own(st().req.body, "temperature") && st().ui.reqPre.textContent.indexOf("temperature") < 0;
      t.set("temp", "0.3");
      t.set("place", "server");
      var vServer = sv("exposed") === "no" && t.logText().indexOf("readable only by") >= 0;
      t.set("place", "repo");
      var vRepo = sv("exposed") === "yes";
      t.set("policy", "backoff");
      var vBack = sv("served") === "12 of 12" && t.stat("r429") === 29 && st().ui.drillNote.textContent.indexOf("02:01:15") >= 0;
      t.set("stranger", false);
      var vFree = sv("served") === "12 of 12" && t.stat("r429") === 0;
      t.set("burst", "24");
      var vBig = sv("served") === "24 of 24" && t.stat("r429") === 37;
      t.click("reset");
      await t.run(1);
      t.expect(v0 && v80 && vOff && vTemp && vServer && vRepo && vBack && vFree && vBig &&
        st().turns === 4 && st().place === "browser" && t.stat("input") === 255 && sv("served") === "2 of 12" && t.stat("r429") === 60,
        "the controls: no past turns gives 65 in, 33 out, end_turn; max_tokens 80 gives the whole 49; no system prompt gives 213 in and 78 out; temperature can be left out; the server placement is not exposed and the repository is; growing waits serve 12 of 12 after 29 refusals, last at 02:01:15; without the stranger, 12 of 12 with none; 24 calls, 24 of 24 after 37; reset returns to 01:47");
    }
  });
})();
