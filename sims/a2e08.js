/* sims/a2e08-v1.0.0.js  (published as sims/a2e08.js)
   Case a2e08 "Which Mind to Ask": a routing lab, from Piran's night helpline for the town of Corriston,
   "the council", which sends each caller's question to one of three oracles: a quick small one, a
   middling one, and a slow, costly elder. No real models run here.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: a widget-style sim built inside api.root (no diagram), drawn as plain
     text blocks and two tables using theme classes only. A fixed night of 40 questions (10 of each of
     four kinds, each with a stated length in words and a stated difficulty from 1 to 10 within its kind)
     and three scripted oracles, each with a stated level per kind, a stated "sure" level per kind for the
     check, a cost per call and a latency. Every result follows deterministically from those tables.
     Controls: the router (by length, by kind, by kind with a check that escalates, everything to the
     elder), the length threshold, the middling oracle's version (the alias, which moves at midnight, or the
     pinned dated version), last month's provider outage replayed tonight, and a fallback to the second
     provider. Stats: right answers, wrong answers given with confidence, calls failed, escalations, cost
     per right answer, the night's bill, p50 and p95 total latency. selfTest covers the story night, the
     frozen and lowered-threshold options, the elder for everything, the senior settings, the check against
     a moved alias, the outage and the fallback, invariants over all 128 settings, determinism, every story
     number and the controls.

   Where every number comes from (conventions rule 14; the case is content/latent/a2/a2e08-v1.0.0.json).
   All of them follow from QUESTIONS, LEVEL, SURE, ORACLES, ROUTE_BY_KIND, answer() and night():
   - The night of Monday into Tuesday: 40 questions, 22:04 to 05:52, 10 of each kind: hours (opening times,
     buses, rotas), forms (council forms and rules), safety (is this safe, right now), company (lonely or
     worried callers who mostly want a voice). A question's length is its words, counted by splitting on
     spaces. Its difficulty, 1 to 10 within its kind, is the rank the test book measured.
   - An oracle answers right every question of a kind up to its level for that kind (LEVEL). The right
     answer to a safety question is the honest one: I can't know that tonight; ring the night warden.
     The levels are the test book's scores out of 10 per kind: small 9, 5, 2, 9 (hours, forms, safety,
     company); middling, version mid-2026-04-02, 10, 8, 7, 10; middling, version mid-2026-10-06, 10, 6, 3, 10;
     elder 10, 10, 9, 10. Piran reran the test book on Wednesday: the new middling scored 6 and 3 on forms
     and safety, against 8 and 7.
   - The alias mid-latest pointed to mid-2026-04-02 until midnight and to mid-2026-10-06 after it. Pinned,
     the council asks for mid-2026-04-02 by name all night. The small and elder oracles did not move.
   - Cost per call, in tenths of a cent: small 2 (0.2 cents), middling 20 (2 cents), elder 200 (20 cents);
     the check 1 (0.1 cents) per answer checked. Total latency per call, in tenths of a second: small 8,
     middling 24, elder 90; the check 5. First words (time to first token): small 3, middling 6, elder 25.
     A checked answer is spoken only after the check passes it, so its first words wait for the whole answer
     and the check.
   - The length router (the story's): under 12 words to the small oracle, 12 to 35 to the middling, 36 or
     more to the elder (a threshold T: under T, under 3T, the rest). The north stair question, "Is the north
     stair safe to come down in the dark?", is 11 words, at 02:47, safety, difficulty 8.
   - The kind router (rules from the test book): hours and company to the small oracle, forms and safety to
     the middling. With the check, an answer the oracle was not sure of (difficulty above its sure level)
     goes up one: small to middling, middling to elder. The elder's answers are final.
   - The story night (length, threshold 12, alias): 28 right, 12 wrong, 0 failed, 0 escalations, bill 135.8
     cents, 4.85 cents per right answer, p50 2.4 s, p95 9.0 s, first words p50 0.6 s. Of the 12 wrong, 5
     went to the small oracle because they were short (23:33, 02:29, 02:47, 04:38, 05:03), and 7 went to the
     middling after midnight (00:07, 00:19, 00:56, 02:03, 03:49, 04:15, 05:40). The 23:52 Quay Street
     question (21 words) got mid-2026-04-02 and a right answer; the 00:07 Gull Court question (15 words) got
     mid-2026-10-06 and a wrong one.
   - Frozen (length, pinned): 31 right, 9 wrong, 4.38 cents; the north stair still goes to the small oracle.
   - Lowered threshold 8 (alias): 31 right, 9 wrong, bill 323.0, 10.42 cents; the north stair goes to the
     middling, after midnight the new version, and is still wrong. Threshold 10: 30 right; 6: 34 right.
   - Everything to the elder: 39 right, 1 wrong (05:40), bill 800.0, 20.51 cents, p50 9.0 s, p95 9.0 s,
     first words 2.5 s, whatever the middling's version.
   - The senior settings (kind with the check, pinned): 38 right, 2 wrong (05:40, 05:52), 7 escalations,
     bill 170.1, 4.48 cents, p50 2.9 s, p95 11.9 s, first words p50 2.9 s. The north stair goes to the
     middling, which isn't sure, and up to the elder, which answers it right.
   - Kind with the check but the alias: 32 right, 8 wrong, 3 escalations, 2.82 cents; the new middling is
     sure of every safety answer, so the check passes its wrong ones, the north stair among them.
   - Kind without the check, pinned: 33 right, 7 wrong, bill 44.0, 1.33 cents.
   - Last month's outage (the first provider, which hosts the small and middling oracles, down from 01:00 to
     01:30), replayed tonight: 3 questions fall in it (01:05, 01:12, 01:24). Without a fallback each fails:
     story night 3 failed, 25 right; senior settings 3 failed, 35 right. With the fallback, each goes to the
     second provider's elder, tested on the test book: senior settings 0 failed, 38 right, bill 227.4,
     5.98 cents.
   - Percentiles use the nearest rank over the answered questions: p50 is the 20th of 40 sorted, p95 the
     38th.
   - Story-only numbers, not computed: the helpline's twenty-two years, two of them with language models;
     Mr Rudge's 81 years; the warden's notice at 19:00 on Monday; the line opening at 22:00; Mr Rudge's call
     at 23:40 in option C's Part 2; the first provider's outage last month; the cold case's 5 months and
     60 days. The clock starts at seven on Wednesday morning (START_CLOCK), when Piran reads the log back.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the widget inside api.root on every reset. No step() is needed; every
     result is worked out the moment a control changes.
   - All money and time is kept in whole tenths (of a cent, of a second) so sums are exact.
   - No random numbers anywhere: the sim is fully deterministic.
   - Stats get bare numbers (units live in the labels).
   - Colors come only from theme classes: mark-ok, mark-no, muted, small, table-wrap.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers and words ---------- */

  var START_CLOCK = 7 * 3600;           // seven on Wednesday morning: Piran reads Monday night's log back
  var MIDNIGHT = 24 * 60;               // minutes after the start of Monday
  var OUTAGE = { from: "01:00", to: "01:30" };
  var THRESHOLDS = [12, 10, 8, 6];
  var STORY_THRESHOLD = 12;
  var KINDS = ["hours", "forms", "safety", "company"];

  var ORACLES = {
    S: { name: "small", provider: "first", cost: 2, total: 8, first: 3 },
    M: { name: "middling", provider: "first", cost: 20, total: 24, first: 6 },
    E: { name: "elder", provider: "second", cost: 200, total: 90, first: 25 }
  };
  var CHECK = { cost: 1, total: 5 };
  var UP = { S: "M", M: "E" };
  var ROUTE_BY_KIND = { hours: "S", company: "S", forms: "M", safety: "M" };

  var VERSION = {
    S: "small-2026-02-11",
    M_OLD: "mid-2026-04-02",
    M_NEW: "mid-2026-10-06",
    E: "elder-2026-07-21"
  };
  var ALIAS = { S: "small-latest", M: "mid-latest", E: "elder-latest" };

  // Test book scores out of 10 per kind: a model answers right every question up to its level.
  var LEVEL = {};
  LEVEL[VERSION.S] = { hours: 9, forms: 5, safety: 2, company: 9 };
  LEVEL[VERSION.M_OLD] = { hours: 10, forms: 8, safety: 7, company: 10 };
  LEVEL[VERSION.M_NEW] = { hours: 10, forms: 6, safety: 3, company: 10 };
  LEVEL[VERSION.E] = { hours: 10, forms: 10, safety: 9, company: 10 };
  // The check passes an answer when the question is within the model's sure level for its kind.
  var SURE = {};
  SURE[VERSION.S] = { hours: 9, forms: 6, safety: 9, company: 10 };
  SURE[VERSION.M_OLD] = { hours: 10, forms: 8, safety: 6, company: 10 };
  SURE[VERSION.M_NEW] = { hours: 10, forms: 8, safety: 10, company: 10 };
  SURE[VERSION.E] = { hours: 10, forms: 10, safety: 10, company: 10 };

  // [time, kind, difficulty, text]
  var QUESTIONS = [
    ["22:04", "hours", 1, "When does the late bus leave the square?"],
    ["22:12", "company", 1, "I can't sleep again and the house is very quiet since my wife passed, and I just wanted to hear someone say the town is all right tonight, if that's not a silly thing to ask."],
    ["22:26", "forms", 2, "How do I renew a parking permit?"],
    ["22:41", "safety", 1, "Is the lifeboat station staffed at night?"],
    ["22:58", "hours", 2, "Is the chemist on the Ropewalk open tonight?"],
    ["23:09", "forms", 5, "My mother has moved into the care home on Lodge Hill and I need to stop her council tax at the old house. Which form is it?"],
    ["23:21", "company", 2, "The gulls have been on my roof all night, walking up and down like they own it, and my dog won't settle, and I know there's nothing you can do, I only wanted to tell somebody."],
    ["23:33", "safety", 4, "Are the harbour lights working tonight?"],
    ["23:44", "hours", 3, "What night do the green bins go out?"],
    ["23:52", "safety", 6, "The tide's coming over the sea wall at the bottom of Quay Street. Should I move the car now or wait?"],
    ["00:07", "safety", 5, "There's a smell of gas on the landing of Gull Court. What do I do?"],
    ["00:19", "forms", 7, "How do I appeal a parking fine I got outside the surgery?"],
    ["00:31", "company", 3, "It's my first night in the flat above the bakery and every so often there's a knock on the pipes, three knocks, and then nothing, and I wondered if old buildings just do that here."],
    ["00:44", "hours", 4, "When does the library open tomorrow morning?"],
    ["00:56", "forms", 8, "Can I put a skip on the road outside my house without a licence for one weekend?"],
    ["01:05", "hours", 5, "Is the swimming baths shut on Monday for the holiday?"],
    ["01:12", "forms", 3, "I want to sell cakes from my front garden on the fete day. Do I need to register as a food business with the council first?"],
    ["01:24", "company", 4, "My son was meant to ring when he got to the city and he hasn't, and it's probably nothing, he always forgets, but could you just keep me company for a minute while I wait?"],
    ["01:37", "safety", 2, "Is it safe to swim at the cove at night?"],
    ["01:48", "hours", 6, "What time is the first ferry across on Wednesday?"],
    ["02:03", "forms", 9, "My neighbour's tree hangs over my garden and drops branches on my shed. What are my rights, and who do I ask?"],
    ["02:16", "company", 5, "I used to work nights at the cannery before it shut, and I still wake at two every morning, and I sit by the window and count the boats coming in, and there are fewer every year."],
    ["02:29", "safety", 7, "Can I drive over the moor road in this fog?"],
    ["02:47", "safety", 8, "Is the north stair safe to come down in the dark?"],
    ["02:58", "hours", 7, "Which pharmacy is on the late rota this week?"],
    ["03:10", "company", 6, "Somebody keeps leaving shells on my doorstep, in a neat row, every night this week, and I don't mind, it's quite nice, but I'd like to know who it is so I can say thank you."],
    ["03:22", "forms", 4, "Where do I report a broken streetlight?"],
    ["03:35", "hours", 8, "Which doctor is on call for the town tonight?"],
    ["03:49", "forms", 10, "I am the executor of my aunt's estate and her house is in a conservation area. Do I need consent to take down the old garden wall before we sell it?"],
    ["04:02", "company", 7, "I'm on my own at the lighthouse cottage while my husband is at sea, and the wind has a voice in it tonight, and I know that's foolish, I'd just like to hear another voice."],
    ["04:15", "safety", 9, "The cliff path past the chapel has a crack across it. Is it safe to walk to work?"],
    ["04:26", "hours", 9, "When does the market start setting up on the square?"],
    ["04:38", "forms", 6, "How do I get a blue badge for my father?"],
    ["04:51", "company", 8, "My grandson visits on Saturdays and he says the helpline sounds different lately, and I said nonsense, it's the same as ever, but now I'm listening and I'm not so sure. Is it the same?"],
    ["05:03", "safety", 3, "Are the gritters out on the hill road?"],
    ["05:14", "forms", 1, "How do I pay my council tax by phone?"],
    ["05:22", "company", 9, "I've been awake all night with the baby and I just need someone to talk to for a bit who isn't crying, sorry, that sounds terrible, she's lovely really."],
    ["05:31", "hours", 10, "Does the early bus still stop by the old mill gate, or did they move the stop when the road works started last month?"],
    ["05:40", "safety", 10, "The lifeboat siren went an hour ago. Is anyone still out there?"],
    ["05:52", "company", 10, "My mother rang the helpline every night for twenty years and she died in the spring, and tonight I rang the number, I don't know why, and I just wanted to ask whether you remember her."]
  ];
  var NORTH_STAIR = "02:47";

  var ROUTERS = {
    length: "By length (the story's)",
    kind: "By kind of question",
    check: "By kind, with a check that escalates",
    elder: "Everything to the elder"
  };
  var ROUTER_KEYS = ["length", "kind", "check", "elder"];
  var VERSIONS = { alias: "The alias mid-latest (moves at midnight)", pinned: "Pinned: mid-2026-04-02" };
  var VERSION_KEYS = ["alias", "pinned"];

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function minutes(t) {
    var h = parseInt(t.slice(0, 2), 10), m = parseInt(t.slice(3, 5), 10), v = h * 60 + m;
    return h >= 12 ? v : v + 24 * 60;   // the night runs past midnight
  }
  function wordsIn(text) { return text.split(/\s+/).length; }
  function tenths(n) { return (n / 10).toFixed(1); }

  /* ---------- one question ---------- */

  function versionFor(o, time, cfg) {
    if (o === "S") return VERSION.S;
    if (o === "E") return VERSION.E;
    return cfg.version === "alias" && minutes(time) >= MIDNIGHT ? VERSION.M_NEW : VERSION.M_OLD;
  }

  function firstOracle(q, cfg) {
    if (cfg.router === "elder") return "E";
    if (cfg.router === "kind" || cfg.router === "check") return ROUTE_BY_KIND[q.kind];
    if (q.words < cfg.threshold) return "S";
    if (q.words < 3 * cfg.threshold) return "M";
    return "E";
  }

  function down(o, time, cfg) {
    var m = minutes(time);
    return cfg.outage && ORACLES[o].provider === "first" && m >= minutes(OUTAGE.from) && m < minutes(OUTAGE.to);
  }

  // Returns { q, calls: [{ oracle, version, right, sure, passed }], cost, total, first, escalations, failed, right, fellBack }
  function answer(q, cfg) {
    var r = { q: q, calls: [], cost: 0, total: 0, first: 0, escalations: 0, failed: false, right: null, fellBack: false };
    var o = firstOracle(q, cfg);
    while (true) {
      if (down(o, q.time, cfg)) {
        if (cfg.fallback) { o = "E"; r.fellBack = true; }
        else { r.failed = true; return r; }
      }
      var v = versionFor(o, q.time, cfg);
      var right = q.d <= LEVEL[v][q.kind];
      var call = { oracle: o, version: v, right: right, checked: false, passed: true };
      r.calls.push(call);
      r.cost += ORACLES[o].cost;
      if (cfg.router === "check" && o !== "E") {
        call.checked = true;
        r.cost += CHECK.cost;
        r.total += ORACLES[o].total + CHECK.total;
        if (q.d > SURE[v][q.kind]) {
          call.passed = false;
          r.escalations++;
          o = UP[o];
          continue;
        }
        r.first = r.total;            // spoken only after the check passes it
      } else {
        r.first = r.total + ORACLES[o].first;
        r.total += ORACLES[o].total;
      }
      r.right = right;
      return r;
    }
  }

  /* ---------- the night ---------- */

  var QS = QUESTIONS.map(function (a) { return { time: a[0], kind: a[1], d: a[2], text: a[3], words: wordsIn(a[3]) }; });

  function nearestRank(values, p) {
    if (!values.length) return 0;
    var v = values.slice().sort(function (a, b) { return a - b; });
    return v[Math.ceil(p * v.length) - 1];
  }

  function night(cfg) {
    var out = { rows: [], right: 0, wrong: 0, failed: 0, escalations: 0, cost: 0, p50: 0, p95: 0, first50: 0, cpc: "0.00" };
    var totals = [], firsts = [];
    QS.forEach(function (q) {
      var r = answer(q, cfg);
      out.rows.push(r);
      out.cost += r.cost;
      out.escalations += r.escalations;
      if (r.failed) { out.failed++; return; }
      if (r.right) out.right++; else out.wrong++;
      totals.push(r.total);
      firsts.push(r.first);
    });
    out.p50 = nearestRank(totals, 0.5);
    out.p95 = nearestRank(totals, 0.95);
    out.first50 = nearestRank(firsts, 0.5);
    out.cpc = out.right ? (out.cost / 10 / out.right).toFixed(2) : "0.00";
    return out;
  }

  function cfgOf(S) {
    return { router: S.router, threshold: S.threshold, version: S.version, outage: S.outage, fallback: S.fallback };
  }

  /* ---------- words ---------- */

  function routerText(S) {
    if (S.router === "length") return "by length, under " + S.threshold + " words to the small oracle, under " + (3 * S.threshold) + " to the middling";
    return ROUTERS[S.router].charAt(0).toLowerCase() + ROUTERS[S.router].slice(1);
  }

  function summary(S) {
    var n = S.res;
    return "Router " + routerText(S) + "; middling " + (S.version === "alias" ? "on the alias" : "pinned") +
      (S.outage ? "; outage replayed, fallback " + (S.fallback ? "on" : "off") : "") + ": " +
      n.right + " right, " + n.wrong + " wrong and sure of it, " + n.failed + " failed, " + n.escalations + " escalated, " +
      tenths(n.cost) + " cents in all, " + n.cpc + " cents per right answer, p50 " + tenths(n.p50) + " s, p95 " + tenths(n.p95) + " s.";
  }

  function toneOf(S) { return S.res.wrong > 4 || S.res.failed > 0 ? "bad" : S.res.wrong > 2 ? "warn" : "ok"; }

  function pathText(r) {
    return r.calls.map(function (c) {
      return ORACLES[c.oracle].name + (c.oracle === "M" ? " (" + c.version + ")" : "") + (c.checked && !c.passed ? ", not sure" : "");
    }).join(" > ") + (r.fellBack ? ", fallback" : "");
  }

  function resultText(r) {
    if (r.failed) return "failed: provider down";
    return r.right ? "right" : "wrong and sure of it";
  }

  /* ---------- the widget ---------- */

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
    function table(cols) {
      var wrap = el("div", "table-wrap", "", "");
      var t = el("table", "", "font-size:12px;", "");
      var th = el("thead", "", "", ""), tr = el("tr", "", "", "");
      cols.forEach(function (h) { tr.appendChild(el("th", "", "text-align:left;padding:2px 6px;white-space:nowrap;", h)); });
      th.appendChild(tr);
      t.appendChild(th);
      var body = el("tbody", "", "", "");
      t.appendChild(body);
      wrap.appendChild(t);
      return { wrap: wrap, body: body };
    }
    var box = el("div", "", "display:grid;gap:8px;padding:10px;min-width:0;");
    box.appendChild(el("p", "muted", "margin:0;font-size:12px;",
      "No real models run here. Each oracle answers right every question of a kind up to its level, measured on the council's test book, " +
      "and the check passes an answer only up to the oracle's sure level. Questions, lengths, prices and waits are the story's."));
    box.appendChild(head("The oracles: test book level / sure level, out of 10, per kind"));
    var levels = table(["model", "hours", "forms", "safety", "company", "per call", "wait"]);
    box.appendChild(levels.wrap);
    var routeLine = el("p", "", "margin:0;font-size:12px;font-family:var(--f-ui);overflow-wrap:anywhere;", "");
    box.appendChild(routeLine);
    box.appendChild(head("The night, question by question"));
    var calls = table(["time", "kind", "words", "question", "asked", "result"]);
    box.appendChild(calls.wrap);
    var verdict = el("p", "", "margin:0;font-size:13px;", "");
    verdict.setAttribute("aria-live", "polite");
    box.appendChild(verdict);
    api.root.appendChild(box);
    return { el: el, levels: levels.body, routeLine: routeLine, calls: calls.body, verdict: verdict };
  }

  function drawLevels(S) {
    var ui = S.ui, el = ui.el;
    while (ui.levels.firstChild) ui.levels.removeChild(ui.levels.firstChild);
    [["S", VERSION.S], ["M", VERSION.M_OLD], ["M", VERSION.M_NEW], ["E", VERSION.E]].forEach(function (p) {
      var o = ORACLES[p[0]], v = p[1];
      var tr = el("tr", v === VERSION.M_NEW ? "mark-no" : "", "", "");
      var cells = [o.name + ": " + v].concat(KINDS.map(function (k) { return LEVEL[v][k] + " / " + SURE[v][k]; }))
        .concat([(o.cost / 10) + " cents", tenths(o.total) + " s, first words " + tenths(o.first) + " s"]);
      cells.forEach(function (c) { tr.appendChild(el("td", "", "padding:2px 6px;white-space:nowrap;", c)); });
      ui.levels.appendChild(tr);
    });
  }

  function drawCalls(S) {
    var ui = S.ui, el = ui.el;
    while (ui.calls.firstChild) ui.calls.removeChild(ui.calls.firstChild);
    S.res.rows.forEach(function (r) {
      var tr = el("tr", r.failed || r.right === false ? "mark-no" : "", "", "");
      var text = r.q.text.length > 46 ? r.q.text.slice(0, 44) + "..." : r.q.text;
      [r.q.time, r.q.kind, String(r.q.words), text, pathText(r) || "nobody", resultText(r)].forEach(function (v) {
        tr.appendChild(el("td", "", "padding:2px 6px;", v));
      });
      ui.calls.appendChild(tr);
    });
  }

  function drawVerdict(S) {
    var n = S.res, stair = rowAt(n, NORTH_STAIR);
    S.ui.routeLine.textContent = "Router: " + routerText(S) + ". The middling oracle: " +
      (S.version === "alias" ? ALIAS.M + ", which pointed to " + VERSION.M_OLD + " until midnight and to " + VERSION.M_NEW + " after it." :
        VERSION.M_OLD + ", asked for by name all night.") +
      (S.outage ? " The first provider is down from " + OUTAGE.from + " to " + OUTAGE.to + (S.fallback ? "; calls fall back to the second provider's elder." : "; no fallback.") : "");
    S.ui.verdict.textContent = "02:47, the north stair: " + (pathText(stair) || "nobody") + ", " + resultText(stair) + ". " +
      "First words, p50: " + tenths(n.first50) + " s.";
    S.ui.verdict.className = stair.right ? "mark-ok" : "mark-no";
  }

  function rowAt(n, time) { for (var i = 0; i < n.rows.length; i++) if (n.rows[i].q.time === time) return n.rows[i]; return null; }

  function drawStats(S) {
    var n = S.res;
    S.stat.right(n.right);
    S.stat.wrong(n.wrong);
    S.stat.failed(n.failed);
    S.stat.esc(n.escalations);
    S.stat.cpc(n.cpc);
    S.stat.bill(tenths(n.cost));
    S.stat.p50(tenths(n.p50));
    S.stat.p95(tenths(n.p95));
  }

  function draw(api) {
    var S = api.state;
    S.res = night(cfgOf(S));
    drawLevels(S);
    drawCalls(S);
    drawVerdict(S);
    drawStats(S);
  }

  function setter(api, key, parse, label) {
    return function (v) {
      var S = api.state, val = parse(v);
      if (val === undefined) return;
      S[key] = val;
      draw(api);
      api.log(label(val) + " " + summary(S), toneOf(S));
    };
  }

  /* ---------- the module ---------- */

  DL.sims.define("a2e08", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.router = "length";
      S.threshold = STORY_THRESHOLD;
      S.version = "alias";
      S.outage = false;
      S.fallback = false;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.router = api.control.select("router", "The router", ROUTER_KEYS.map(function (k) {
        return { value: k, label: ROUTERS[k] };
      }), "length", setter(api, "router", function (v) { return own(ROUTERS, v) ? v : undefined; },
        function (v) { return "Router: " + ROUTERS[v] + "."; }));
      S.ctl.threshold = api.control.select("threshold", "Length threshold (words, length router only)", THRESHOLDS.map(function (n) {
        return { value: String(n), label: "Under " + n + " to small, under " + (3 * n) + " to middling" };
      }), String(STORY_THRESHOLD), setter(api, "threshold", function (v) {
        var n = Math.round(Number(v));
        return THRESHOLDS.indexOf(n) >= 0 ? n : undefined;
      }, function (v) { return "Threshold " + v + " words."; }));
      S.ctl.version = api.control.select("version", "The middling oracle's version", VERSION_KEYS.map(function (k) {
        return { value: k, label: VERSIONS[k] };
      }), "alias", setter(api, "version", function (v) { return own(VERSIONS, v) ? v : undefined; },
        function (v) { return v === "alias" ? "Middling on the alias." : "Middling pinned."; }));
      S.ctl.outage = api.control.toggle("outage", "Replay last month's outage (01:00 to 01:30)", false,
        setter(api, "outage", function (v) { return !!v; }, function (v) { return "Outage " + (v ? "on." : "off."); }));
      S.ctl.fallback = api.control.toggle("fallback", "Fall back to the second provider", false,
        setter(api, "fallback", function (v) { return !!v; }, function (v) { return "Fallback " + (v ? "on." : "off."); }));
      S.ctl.reset = api.control.button("reset", "Reset to Monday night", function () { api.reset(); });

      S.stat = {
        right: api.stat("right", "right answers", "ok"),
        wrong: api.stat("wrong", "wrong and sure of it", "bad"),
        failed: api.stat("failed", "calls failed", "bad"),
        esc: api.stat("esc", "escalations", ""),
        cpc: api.stat("cpc", "cost per right answer (cents)", "warn"),
        bill: api.stat("bill", "the night's bill (cents)", ""),
        p50: api.stat("p50", "p50 wait (s)", ""),
        p95: api.stat("p95", "p95 wait (s)", "warn")
      };

      api.info("<strong>How to read it.</strong> Forty questions came in on Monday night, 10 of each kind. Each has a length in words " +
        "and a difficulty from 1 to 10 within its kind, as the test book measured it. An oracle answers right every question up to its " +
        "level for that kind. The check passes an answer only when the question is within the oracle's sure level; otherwise the question " +
        "goes up one, small to middling to elder, and the elder's answers are final. A checked answer is spoken only after the check, so " +
        "its first words wait. The alias mid-latest moved from mid-2026-04-02 to mid-2026-10-06 at midnight. Cost per right answer is the " +
        "night's bill divided by the right answers. p50 and p95 are the nearest-rank waits over the answered questions.");
      draw(api);
      api.log("Wednesday morning, Monday night's log read back. " + summary(S), toneOf(S));
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function cfg(o) {
        o = o || {};
        return { router: own(o, "router") ? o.router : "length", threshold: own(o, "threshold") ? o.threshold : 12,
          version: own(o, "version") ? o.version : "alias", outage: own(o, "outage") ? o.outage : false,
          fallback: own(o, "fallback") ? o.fallback : false };
      }
      function at(n, time) { return rowAt(n, time); }
      function wrongTimes(n, oracle) {
        return n.rows.filter(function (r) {
          return r.right === false && (!oracle || r.calls[r.calls.length - 1].oracle === oracle);
        }).map(function (r) { return r.q.time; });
      }
      function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
      var ok;

      // 1. The story night, as the sim opens.
      await t.run(1);
      var s = night(cfg()), stair = at(s, NORTH_STAIR);
      t.expect(st().router === "length" && st().threshold === 12 && st().version === "alias" && st().outage === false && st().fallback === false &&
        t.stat("right") === 28 && t.stat("wrong") === 12 && t.stat("failed") === 0 && t.stat("esc") === 0 &&
        t.stat("cpc") === 4.85 && t.stat("bill") === 135.8 && t.stat("p50") === 2.4 && t.stat("p95") === 9 && s.first50 === 6 &&
        stair.q.words === 11 && stair.calls.length === 1 && stair.calls[0].oracle === "S" && stair.right === false &&
        at(s, "23:52").calls[0].version === "mid-2026-04-02" && at(s, "23:52").right === true && at(s, "23:52").q.words === 21 &&
        at(s, "00:07").calls[0].version === "mid-2026-10-06" && at(s, "00:07").right === false && at(s, "00:07").q.words === 15 &&
        same(wrongTimes(s, "S"), ["23:33", "02:29", "02:47", "04:38", "05:03"]) &&
        same(wrongTimes(s, "M"), ["00:07", "00:19", "00:56", "02:03", "03:49", "04:15", "05:40"]) &&
        wrongTimes(s, "M").every(function (tm) { return minutes(tm) >= MIDNIGHT; }) &&
        st().ui.verdict.textContent.indexOf("02:47, the north stair: small, wrong and sure of it") === 0 &&
        t.logText().indexOf("28 right, 12 wrong and sure of it, 0 failed, 0 escalated, 135.8 cents in all, 4.85 cents per right answer, p50 2.4 s, p95 9.0 s") >= 0,
        "the story night: by length, under 12 words to the small oracle, middling on the alias: 28 right, 12 wrong, 135.8 cents, 4.85 cents per right answer, p50 2.4 s, p95 9.0 s; the north stair, 11 words, goes to the small oracle and is wrong; 23:52 gets mid-2026-04-02 and is right, 00:07 gets mid-2026-10-06 and is wrong; 5 short ones wrong at the small oracle, 7 wrong at the middling, all after midnight");

      // 2. Frozen: length routing, pinned.
      var f = night(cfg({ version: "pinned" }));
      t.expect(f.right === 31 && f.wrong === 9 && f.cpc === "4.38" && at(f, NORTH_STAIR).calls[0].oracle === "S" && at(f, NORTH_STAIR).right === false &&
        f.rows.every(function (r) { return r.calls.every(function (c) { return c.version !== VERSION.M_NEW; }); }),
        "frozen on today's versions with length routing: 31 right, 9 wrong, 4.38 cents; nothing asks mid-2026-10-06, but the north stair still goes to the small oracle and is still wrong");

      // 3. A lower threshold is still the wrong signal.
      var l8 = night(cfg({ threshold: 8 })), l10 = night(cfg({ threshold: 10 })), l6 = night(cfg({ threshold: 6 }));
      ok = [l10, l8, l6].every(function (n) {
        var r = at(n, NORTH_STAIR);
        return r.calls[0].oracle === "M" && r.calls[0].version === VERSION.M_NEW && r.right === false;
      });
      t.expect(ok && l8.right === 31 && l8.wrong === 9 && l8.cost === 3230 && l8.cpc === "10.42" && l10.right === 30 && l6.right === 34 &&
        l8.cost > s.cost && l10.cost > s.cost && l6.cost > l8.cost,
        "lowering the threshold to 10, 8 or 6 words sends the north stair to the middling oracle, the new version after midnight, and it is still wrong; at 8 words: 31 right, 9 wrong, 323.0 cents, 10.42 cents per right answer; every lower threshold costs more");

      // 4. Everything to the elder.
      var e = night(cfg({ router: "elder" })), ep = night(cfg({ router: "elder", version: "pinned" }));
      t.expect(e.right === 39 && e.wrong === 1 && same(wrongTimes(e), ["05:40"]) && e.cost === 8000 && e.cpc === "20.51" &&
        e.p50 === 90 && e.p95 === 90 && e.first50 === 25 && JSON.stringify(e) === JSON.stringify(ep) &&
        e.rows.every(function (r) { return r.calls.length === 1 && r.calls[0].oracle === "E"; }),
        "everything to the elder: 39 right, 1 wrong (05:40), 800.0 cents, 20.51 cents per right answer, every wait 9.0 s, first words 2.5 s; the middling's version makes no difference because nothing asks it");

      // 5. The senior settings: by kind, with the check, pinned.
      var g = night(cfg({ router: "check", version: "pinned" })), gs = at(g, NORTH_STAIR);
      t.expect(g.right === 38 && g.wrong === 2 && same(wrongTimes(g), ["05:40", "05:52"]) && g.escalations === 7 && g.cost === 1701 &&
        g.cpc === "4.48" && g.p50 === 29 && g.p95 === 119 && g.first50 === 29 && g.failed === 0 &&
        gs.calls.length === 2 && gs.calls[0].oracle === "M" && gs.calls[0].passed === false && gs.calls[1].oracle === "E" && gs.right === true,
        "by kind with a check, middling pinned: 38 right, 2 wrong (05:40, 05:52), 7 escalations, 170.1 cents, 4.48 cents per right answer, p50 2.9 s, p95 11.9 s; the north stair goes to the middling, which isn't sure, and up to the elder, which answers it right");

      // 6. The check cannot catch a moved alias; the check itself earns its place.
      var ga = night(cfg({ router: "check" })), ka = night(cfg({ router: "kind", version: "pinned" }));
      t.expect(ga.right === 32 && ga.wrong === 8 && ga.escalations === 3 && ga.cpc === "2.82" &&
        at(ga, NORTH_STAIR).calls.length === 1 && at(ga, NORTH_STAIR).calls[0].version === VERSION.M_NEW && at(ga, NORTH_STAIR).right === false &&
        ka.right === 33 && ka.wrong === 7 && ka.cost === 440 && ka.cpc === "1.33" && at(ka, NORTH_STAIR).right === false,
        "with the check but the alias: 32 right, 8 wrong, 3 escalations; the new middling is sure of its safety answers, so the check passes the north stair's wrong one; by kind without the check, pinned: 33 right, 7 wrong, 44.0 cents, the north stair still wrong");

      // 7. Last month's outage, with and without a fallback.
      var so = night(cfg({ outage: true })), go = night(cfg({ router: "check", version: "pinned", outage: true })),
        gf = night(cfg({ router: "check", version: "pinned", outage: true, fallback: true }));
      t.expect(so.failed === 3 && so.right === 25 &&
        same(so.rows.filter(function (r) { return r.failed; }).map(function (r) { return r.q.time; }), ["01:05", "01:12", "01:24"]) &&
        go.failed === 3 && go.right === 35 && gf.failed === 0 && gf.right === 38 && gf.cost === 2274 && gf.cpc === "5.98" &&
        gf.rows.filter(function (r) { return r.fellBack; }).length === 3 &&
        night(cfg({ router: "elder", outage: true })).failed === 0,
        "last month's outage, 01:00 to 01:30, replayed: 3 questions fail on the story night (25 right) and on the senior settings (35 right); with the fallback to the second provider, 0 fail, 38 right, 227.4 cents, 5.98 cents per right answer; the elder's provider was never down");

      // 8. Invariants over all 128 settings.
      ok = true;
      var count = 0;
      ROUTER_KEYS.forEach(function (rk) {
        THRESHOLDS.forEach(function (th) {
          VERSION_KEYS.forEach(function (vk) {
            [false, true].forEach(function (out) {
              [false, true].forEach(function (fb) {
                count++;
                var n = night(cfg({ router: rk, threshold: th, version: vk, outage: out, fallback: fb }));
                if (n.right + n.wrong + n.failed !== 40) ok = false;
                if (n.failed > 0 && (!out || fb || rk === "elder")) ok = false;
                if (n.p95 < n.p50) ok = false;
                n.rows.forEach(function (r) {
                  if (vk === "pinned" && r.calls.some(function (c) { return c.version === VERSION.M_NEW; })) ok = false;
                  if (rk !== "check" && r.escalations > 0) ok = false;
                  if (r.calls.length > 3) ok = false;
                  for (var i = 1; i < r.calls.length; i++) {
                    if (r.calls[i].oracle !== UP[r.calls[i - 1].oracle]) ok = false;
                  }
                });
                var sum = 0;
                n.rows.forEach(function (r) { sum += r.cost; });
                if (sum !== n.cost) ok = false;
              });
            });
          });
        });
      });
      t.expect(ok && count === 128,
        "over all 128 settings: every question is right, wrong or failed, 40 in all; calls fail only in the outage with no fallback and never with the elder alone; pinned never asks mid-2026-10-06; only the check escalates, always one step up; p95 is never below p50; the bill is the sum of every call");

      // 9. Deterministic.
      t.expect(JSON.stringify(night(cfg())) === JSON.stringify(night(cfg())) &&
        JSON.stringify(night(cfg({ router: "check", outage: true, fallback: true }))) === JSON.stringify(night(cfg({ router: "check", outage: true, fallback: true }))),
        "the same settings give the same night every time: no randomness anywhere");

      // 10. Every story number.
      var perKind = KINDS.map(function (k) { return QS.filter(function (q) { return q.kind === k; }).length; });
      t.expect(QS.length === 40 && same(perKind, [10, 10, 10, 10]) && QS[0].time === "22:04" && QS[39].time === "05:52" &&
        at(s, NORTH_STAIR).q.text === "Is the north stair safe to come down in the dark?" && at(s, NORTH_STAIR).q.d === 8 &&
        STORY_THRESHOLD === 12 && ORACLES.S.cost === 2 && ORACLES.M.cost === 20 && ORACLES.E.cost === 200 && CHECK.cost === 1 &&
        ORACLES.S.total === 8 && ORACLES.M.total === 24 && ORACLES.E.total === 90 && ORACLES.E.first === 25 &&
        LEVEL[VERSION.M_OLD].forms === 8 && LEVEL[VERSION.M_OLD].safety === 7 && LEVEL[VERSION.M_NEW].forms === 6 && LEVEL[VERSION.M_NEW].safety === 3 &&
        LEVEL[VERSION.S].safety === 2 && OUTAGE.from === "01:00" && OUTAGE.to === "01:30" && START_CLOCK === 25200 &&
        KINDS.every(function (k) {
          var ds = QS.filter(function (q) { return q.kind === k; }).map(function (q) { return q.d; }).sort(function (a, b) { return a - b; });
          return same(ds, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        }),
        "story numbers: 40 questions, 10 of each kind with difficulties 1 to 10, 22:04 to 05:52; the north stair, difficulty 8; under 12 words to the small oracle; 0.2, 2 and 20 cents a call and 0.1 for the check; 0.8, 2.4 and 9.0 s; the middling's test book scores 8 and 7 before, 6 and 3 after; the outage 01:00 to 01:30");

      // 11. The controls.
      t.set("version", "pinned");
      var v1 = t.stat("right") === 31 && t.stat("wrong") === 9;
      t.set("version", "alias");
      t.set("threshold", "8");
      var v2 = t.stat("right") === 31 && t.stat("bill") === 323 && t.stat("cpc") === 10.42 &&
        st().ui.verdict.textContent.indexOf("middling (mid-2026-10-06), wrong") >= 0;
      t.set("threshold", "12");
      t.set("router", "elder");
      var v3 = t.stat("right") === 39 && t.stat("cpc") === 20.51 && t.stat("p50") === 9 && t.stat("p95") === 9;
      t.set("router", "check");
      t.set("version", "pinned");
      var v4 = t.stat("right") === 38 && t.stat("wrong") === 2 && t.stat("esc") === 7 && t.stat("cpc") === 4.48 && t.stat("p95") === 11.9 &&
        st().ui.verdict.textContent.indexOf("right") >= 0 && st().ui.verdict.className === "mark-ok";
      t.set("outage", true);
      var v5 = t.stat("failed") === 3 && t.stat("right") === 35;
      t.set("fallback", true);
      var v6 = t.stat("failed") === 0 && t.stat("right") === 38 && t.stat("bill") === 227.4 && t.stat("cpc") === 5.98;
      t.click("reset");
      await t.run(1);
      var v7 = st().router === "length" && st().version === "alias" && st().outage === false && t.stat("right") === 28 && t.stat("wrong") === 12;
      t.expect(v1 && v2 && v3 && v4 && v5 && v6 && v7,
        "the controls: pinned 31 right; threshold 8 words 323.0 cents and the north stair wrong at the new middling; the elder for everything 39 right at 20.51 cents and 9.0 s; by kind with the check, pinned, 38 right, 7 escalations, p95 11.9 s; the outage 3 failed, the fallback 0 failed and 227.4 cents; reset returns to Monday night");
    }
  });
})();
