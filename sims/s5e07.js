/* sims/s5e07-v1.0.1.js  (published as sims/s5e07.js)
   Case s5e07 "Proof": a test lab for Fenwold Toxicology Laboratory, whose evidence-tracking service
   (Python) files every tube under the id its parser cuts from the scanned label. The parser kept
   the first 8 characters, so a new 9-digit label lost its last digit. Every unit test used
   FakeScanner, which always sends "26100514". The learner replays the evening's 12 scans, picks
   the parser, picks which tests run (unit with the fake, contract, end-to-end), and tries one
   scanner at a time on the bench. Widget-style sim: it draws its own tables inside api.root.

   CHANGELOG
   v1.0.1 (2026-10-14) story fix: the new labels start tonight, so no earlier id clashes. The new
     scanners went live on the evening of Monday 5 October; the courier's three tubes at 23:40 are
     the day's first new labels, 261005100, 261005101 and 261005102, and first 8 turns all three
     into 26100510, the old tube scanned at 21:12 for case 3307. The old scans are now 26100510 to
     26100518. The new model's recorded reads are 261005100 and 261005101; the 9-digit fake sends
     261005100. Self-test strings follow.
   v1.0.0 (2026-10-14) first version: parsers (first 8 as built, first 9, whole id refusing any
     length but 8 or 9); the evening's 12 scans (Next scan, Run to 23:40); unit tests as built
     (12, 70% coverage) or raised (21, 95%); fake sends 8 or 9 digits; contract tests on recorded
     reads from both real scanners, plus the planned spring model; end-to-end tests on the stated
     set or a clashing pair; a bench that tries one scanner; a test pyramid with counts and run
     times. selfTest: 10 assertions.

   The model (stated in sim.lede):
   - Old labels: 8 digits, YYMMDD plus a 2-digit count. New labels (live from the evening of
     Monday 5 October 2026): 9 digits, YYMMDD plus a 3-digit count from 100, so the day's first
     new label is 261005100. The planned spring model: 10 digits, YYMMDD plus a 4-digit count
     from 1000.
   - Parsers: first 8 = raw[:8]; first 9 = raw[:9]; whole = the id kept whole if it is 8 or 9
     digits, otherwise refused (the tube is set aside, nothing is filed).
   - Filing: each scan adds a line (time, case, tube) to the record of its parsed id.
   - Unit tests: all use FakeScanner. As built: 12 tests run 14 of the service's 20 lines (70%).
     Raised: 21 tests run 19 of 20 lines (95%). One unit test checks that the id read from the fake
     comes back unchanged; with a 9-digit fake (261005100) and the first-8 parser it fails.
     0.02 s each. Coverage is counted on the 20-line service as built, whichever parser is picked.
   - Contract tests: recorded reads from the real scanners. Old: 26100514, 26100509. New:
     261005100, 261005101. Spring (if added): 2704121000, 2704121004. Each passes if the parser
     gives the read back whole. 0.05 s each.
   - End-to-end tests: each sample goes from scan to report (about 4 minutes each, 240 s). It
     passes if its report lands in its own case only. Set as written: 26100501 (case T-1) and
     261005100 (case T-2). A clashing pair: 26100510 (T-1) and 261005100 (T-2).

   Where every number comes from (conventions rule 14; the case is content/s5/s5e07-v1.0.1.json).
   - The evening, Monday 5 October 2026 (the sim opens at 21:00, before the first scan):
     21:12 26100510 old, case 3307, blood    21:25 26100511 old, case 3308, blood
     21:31 26100512 old, case 3308, urine    21:48 26100513 old, case 3309, blood
     22:06 26100514 old, case 3310, blood    22:19 26100515 old, case 3310, urine
     22:37 26100516 old, case 3311, blood    22:58 26100517 old, case 3312, blood
     23:16 26100518 old, case 3312, urine (the last label on the old roll)
     23:40 261005100 new, case 3313, blood   23:40 261005101 new, case 3313, blood
     23:40 261005102 new, case 3313, urine (the day's first three new labels)
   - No new label exists before 23:40, so no earlier scan can clash. First 8: 261005100,
     261005101 and 261005102 all become 26100510. After 12 scans: 9 ids on file, 3 tubes under a
     wrong id, 1 id holding two cases (26100510: case 3307 at 21:12, case 3313 at 23:40). First 9
     or whole: 12 ids, 0, 0.
   - Unit as built: 12 of 12 passed, 70%, 0.24 s. Raised: 21 of 21, 95%, 0.42 s. 9-digit fake with
     first 8: 11 of 12 (20 of 21 raised). With first 9 or whole: all pass.
   - Contract, first 8: 2 of 4 (both new reads trimmed). First 9 or whole: 4 of 4, 0.20 s. With
     spring: first 9 gives 270412100 for 2704121000 (4 of 6); whole refuses both (4 of 6).
   - End-to-end, first 8: written set 2 of 2 (26100501 and 26100510 never meet), 8 min; clashing
     pair 0 of 2. Whole: 2 of 2 either way.
*/
(function () {
  "use strict";

  var T0 = 75600; // 21:00:00
  var SCANS = [
    { t: "21:12", label: "26100510", model: "old", kase: "3307", tube: "blood" },
    { t: "21:25", label: "26100511", model: "old", kase: "3308", tube: "blood" },
    { t: "21:31", label: "26100512", model: "old", kase: "3308", tube: "urine" },
    { t: "21:48", label: "26100513", model: "old", kase: "3309", tube: "blood" },
    { t: "22:06", label: "26100514", model: "old", kase: "3310", tube: "blood" },
    { t: "22:19", label: "26100515", model: "old", kase: "3310", tube: "urine" },
    { t: "22:37", label: "26100516", model: "old", kase: "3311", tube: "blood" },
    { t: "22:58", label: "26100517", model: "old", kase: "3312", tube: "blood" },
    { t: "23:16", label: "26100518", model: "old", kase: "3312", tube: "urine" },
    { t: "23:40", label: "261005100", model: "new", kase: "3313", tube: "blood" },
    { t: "23:40", label: "261005101", model: "new", kase: "3313", tube: "blood" },
    { t: "23:40", label: "261005102", model: "new", kase: "3313", tube: "urine" }
  ];
  var PARSERS = [
    { value: "first8", label: "First 8 characters (as built)" },
    { value: "first9", label: "First 9 characters" },
    { value: "whole", label: "Whole id; refuse any length but 8 or 9" }
  ];
  var BENCH = [
    { value: "fake", label: "FakeScanner (the unit tests' stand-in)" },
    { value: "old", label: "Old scanner (real)" },
    { value: "new", label: "New scanner (real)" },
    { value: "spring", label: "Spring model, 10 digits (planned)" }
  ];
  var E2E_SETS = [
    { value: "written", label: "As written: 26100501 and 261005100" },
    { value: "clash", label: "A clashing pair: 26100510 and 261005100" }
  ];
  var RECORDED = {
    old: ["26100514", "26100509"],
    "new": ["261005100", "261005101"],
    spring: ["2704121000", "2704121004"]
  };
  var FAKE8 = "26100514";
  var FAKE9 = "261005100";
  var MODEL_NAME = { old: "old scanner", "new": "new scanner" };

  function labelOf(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i].value === v) return list[i].label;
    return v;
  }
  function clockOf(hm) { return Number(hm.slice(0, 2)) * 3600 + Number(hm.slice(3, 5)) * 60; }
  function secs(x) {
    if (x < 60) return x.toFixed(2) + " s";
    var m = Math.floor(x / 60);
    var rest = x - m * 60;
    return m + " min" + (rest >= 0.005 ? " " + rest.toFixed(2) + " s" : "");
  }

  /* ---------- the model ---------- */

  // The parser: raw label in, the id the service files under (or null: refused).
  function parse(p, raw) {
    if (p === "first8") return raw.slice(0, 8);
    if (p === "first9") return raw.slice(0, 9);
    return /^[0-9]{8,9}$/.test(raw) ? raw : null;
  }

  // File a list of {label, kase, t, tube} the way the service does.
  function file(p, list) {
    var rec = {};
    var order = [];
    var wrong = 0;
    var refused = 0;
    list.forEach(function (s) {
      var id = parse(p, s.label);
      if (id === null) { refused += 1; return; }
      if (id !== s.label) wrong += 1;
      if (!rec[id]) { rec[id] = []; order.push(id); }
      rec[id].push(s);
    });
    var two = 0;
    order.forEach(function (id) { if (casesOf(rec[id]).length > 1) two += 1; });
    return { rec: rec, order: order, ids: order.length, wrong: wrong, refused: refused, two: two };
  }
  function casesOf(lines) {
    var out = [];
    lines.forEach(function (s) { if (out.indexOf(s.kase) < 0) out.push(s.kase); });
    return out;
  }

  function benchRead(C, which) {
    if (which === "fake") return C.fake9 ? FAKE9 : FAKE8;
    if (which === "old") return "26100510";
    if (which === "new") return "261005100";
    return "2704121000";
  }

  // Run the chosen suites; settings in, results out.
  function runTests(C) {
    var R = { unit: null, contract: null, e2e: null, time: 0, fails: [] };
    if (C.unit) {
      var n = C.cover === "95" ? 21 : 12;
      var fake = C.fake9 ? FAKE9 : FAKE8;
      var bad = parse(C.parser, fake) === fake ? 0 : 1;
      R.unit = { n: n, pass: n - bad, time: n * 0.02 };
      if (bad) R.fails.push("unit: the fake sent " + fake + " and the parser gave back " + parse(C.parser, fake));
      R.time += R.unit.time;
    }
    if (C.contract) {
      var reads = RECORDED.old.concat(RECORDED["new"]);
      if (C.spring) reads = reads.concat(RECORDED.spring);
      var ok = 0;
      reads.forEach(function (raw) {
        var id = parse(C.parser, raw);
        if (id === raw) ok += 1;
        else R.fails.push("contract: " + raw + (id === null ? " was refused" : " came back as " + id));
      });
      R.contract = { n: reads.length, pass: ok, time: reads.length * 0.05 };
      R.time += R.contract.time;
    }
    if (C.e2e) {
      var set = C.e2eSet === "clash" ?
        [{ label: "26100510", kase: "T-1" }, { label: "261005100", kase: "T-2" }] :
        [{ label: "26100501", kase: "T-1" }, { label: "261005100", kase: "T-2" }];
      var F = file(C.parser, set);
      var good = 0;
      set.forEach(function (s) {
        var id = parse(C.parser, s.label);
        if (id !== null && casesOf(F.rec[id]).length === 1) good += 1;
        else R.fails.push("end-to-end: the report for " + s.label + " landed in cases " + casesOf(F.rec[id] || []).join(" and "));
      });
      R.e2e = { n: set.length, pass: good, time: set.length * 240 };
      R.time += R.e2e.time;
    }
    return R;
  }
  function part(x) { return x ? x.pass + " of " + x.n + " passed" : "not run"; }
  function green(R) {
    return [R.unit, R.contract, R.e2e].every(function (x) { return !x || x.pass === x.n; });
  }

  /* ---------- the widget ---------- */

  function build(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var wrap = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;");
    var head = el("p", "margin:0;");
    var code = el("pre", "margin:0;padding:8px;overflow-x:auto;border:1px solid currentColor;border-radius:4px;font-size:11px;");
    var tbl = el("table", "width:100%;font-size:11px;font-family:monospace;");
    var hr = el("tr");
    ["time", "label", "scanner", "filed as", "case", "tube"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var thead = el("thead");
    thead.appendChild(hr);
    tbl.appendChild(thead);
    var body = el("tbody");
    tbl.appendChild(body);
    var scroll = el("div", "overflow-x:auto;min-width:0;");
    scroll.appendChild(tbl);
    var pyr = el("div", "display:grid;gap:3px;justify-items:center;min-width:0;");
    var bench = el("p", "margin:0;font-family:monospace;");
    wrap.appendChild(head);
    wrap.appendChild(code);
    wrap.appendChild(scroll);
    wrap.appendChild(el("strong", "", "Test pyramid (the suites that ran last)"));
    wrap.appendChild(pyr);
    wrap.appendChild(bench);
    api.root.appendChild(wrap);
    return { el: el, head: head, code: code, body: body, pyr: pyr, bench: bench };
  }

  function codeFor(C) {
    var L = ["def sample_id(raw):"];
    if (C.parser === "first8") L.push("    return raw[:8]              # ids are 8 digits");
    else if (C.parser === "first9") L.push("    return raw[:9]              # ids are 8 or 9 digits");
    else L.push("    if len(raw) not in (8, 9):",
      "        raise ValueError(\"refused: \" + raw)", "    return raw                  # kept whole");
    L.push("", "class FakeScanner:              # used by every unit test",
      "    def read(self): return \"" + (C.fake9 ? FAKE9 : FAKE8) + "\"");
    return L.join("\n");
  }

  function show(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var F = file(C.parser, SCANS.slice(0, S.k));
    ui.head.textContent = "Parser: " + labelOf(PARSERS, C.parser).toLowerCase() + ". " + S.k + " of 12 scans tonight.";
    ui.code.textContent = codeFor(C);
    while (ui.body.firstChild) ui.body.removeChild(ui.body.firstChild);
    SCANS.slice(0, S.k).forEach(function (s) {
      var id = parse(C.parser, s.label);
      var bad = id !== s.label;
      var tr = ui.el("tr", bad ? "font-weight:700;" : "");
      [s.t, s.label, MODEL_NAME[s.model], id === null ? "refused" : id + (bad ? "  <- wrong" : ""), s.kase, s.tube].forEach(function (c) {
        tr.appendChild(ui.el("td", "", c));
      });
      ui.body.appendChild(tr);
    });
    while (ui.pyr.firstChild) ui.pyr.removeChild(ui.pyr.firstChild);
    var R = S.R;
    [["End-to-end", R && R.e2e, 30], ["Contract", R && R.contract, 60], ["Unit", R && R.unit, 95]].forEach(function (row) {
      var x = row[1];
      var txt = row[0] + ": " + (x ? x.n + " tests, " + secs(x.time) + ", " + x.pass + " passed" : "not run");
      ui.pyr.appendChild(ui.el("div", "width:" + row[2] + "%;text-align:center;padding:3px 0;border:1px solid currentColor;border-radius:3px;" +
        (x && x.pass < x.n ? "font-weight:700;" : ""), txt));
    });
    var raw = benchRead(C, S.bench);
    var out = parse(C.parser, raw);
    S.benchText = raw + " -> " + (out === null ? "refused" : out);
    ui.bench.textContent = "Bench: " + labelOf(BENCH, S.bench) + " sends " + raw + "; the parser gives " +
      (out === null ? "nothing: refused, set aside" : out) + ".";
    S.stat.scans(S.k + " of 12");
    S.stat.ids(F.ids);
    S.stat.wrong(F.wrong);
    S.stat.two(F.two);
    S.stat.unit(part(R && R.unit));
    S.stat.contract(part(R && R.contract));
    S.stat.e2e(part(R && R.e2e));
    S.stat.coverage(C.cover === "95" ? "95% (19 of 20 lines)" : "70% (14 of 20 lines)");
    S.stat.verdict(R ? (green(R) ? "green" : "red") : "not run");
    S.stat.time(R ? secs(R.time) : "not run");
    S.stat.bench(S.benchText);
  }

  function nextScan(api) {
    var S = api.state;
    if (S.k >= SCANS.length) return false;
    var s = SCANS[S.k];
    var id = parse(S.C.parser, s.label);
    api.clock = clockOf(s.t);
    S.k += 1;
    var F = file(S.C.parser, SCANS.slice(0, S.k));
    var msg = s.label + " (" + MODEL_NAME[s.model] + ", case " + s.kase + ", " + s.tube + ")";
    var tone = "";
    if (id === null) { msg += " refused: no scanner we test sends that length. Tube set aside."; tone = "warn"; }
    else {
      msg += " filed as " + id + ".";
      if (id !== s.label) { msg += " WRONG ID: the label says " + s.label + "."; tone = "bad"; }
      var cs = casesOf(F.rec[id]);
      if (cs.length > 1) msg += " " + id + " now holds case " + cs.join(" and case ") + ".";
    }
    api.log(msg, tone);
    show(api);
    return true;
  }

  function toEnd(api) {
    var S = api.state;
    while (nextScan(api)) { /* each scan in turn */ }
    if (S.ended) return;
    S.ended = true;
    var F = file(S.C.parser, SCANS);
    api.log("23:40, all 12 scanned. " + F.ids + " ids on file, " + F.wrong + " tubes under a wrong id, " + F.two +
      " id" + (F.two === 1 ? "" : "s") + " holding two cases.", F.two ? "bad" : "ok");
    show(api);
  }

  function rewind(api, what) {
    var S = api.state;
    S.k = 0;
    S.ended = false;
    api.clock = T0;
    api.log(what + " Rewound to 21:00, before the first scan.", "");
    show(api);
  }

  function doTests(api) {
    var S = api.state;
    S.R = runTests(S.C);
    var R = S.R;
    if (!R.unit && !R.contract && !R.e2e) { api.log("No suites chosen, so nothing ran.", "warn"); show(api); return; }
    var bits = [];
    if (R.unit) bits.push("unit " + R.unit.pass + " of " + R.unit.n);
    if (R.contract) bits.push("contract " + R.contract.pass + " of " + R.contract.n);
    if (R.e2e) bits.push("end-to-end " + R.e2e.pass + " of " + R.e2e.n);
    var txt = "Tests: " + bits.join(", ") + ". " + (green(R) ? "Green" : "Red") + ", in " + secs(R.time) + ".";
    if (R.fails.length) txt += " Failed: " + R.fails.join("; ") + ".";
    api.log(txt, green(R) ? "ok" : "bad");
    show(api);
  }

  DL.sims.define("s5e07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      api.clock = T0;
      S.C = { parser: "first8", fake9: false, cover: "70", unit: true, contract: false, e2e: false, e2eSet: "written", spring: false };
      S.k = 0;
      S.ended = false;
      S.R = null;
      S.bench = "fake";
      S.ui = build(api);
      api.control.select("parser", "The parser", PARSERS, "first8", function (v) {
        S.C.parser = String(v);
        S.R = null;
        rewind(api, "Parser: " + labelOf(PARSERS, S.C.parser).toLowerCase() + ".");
      });
      api.control.button("next", "Next scan", function () { nextScan(api); });
      api.control.button("run", "Run to 23:40", function () { toEnd(api); });
      api.control.toggle("unit", "Unit tests (all use FakeScanner)", true, function (on) { S.C.unit = !!on; });
      api.control.select("cover", "Unit tests", [{ value: "70", label: "As built: 12 tests, 70% coverage" },
        { value: "95", label: "Raised: 21 tests, 95% coverage" }], "70", function (v) { S.C.cover = String(v); S.R = null; show(api); });
      api.control.toggle("fake9", "FakeScanner sends 9 digits (" + FAKE9 + ")", false, function (on) { S.C.fake9 = !!on; S.R = null; show(api); });
      api.control.toggle("contract", "Contract tests (recorded reads from both real scanners)", false, function (on) { S.C.contract = !!on; });
      api.control.toggle("spring", "Add the spring model's recorded reads (10 digits)", false, function (on) { S.C.spring = !!on; });
      api.control.toggle("e2e", "End-to-end tests (about 4 minutes each)", false, function (on) { S.C.e2e = !!on; });
      api.control.select("e2eset", "End-to-end samples", E2E_SETS, "written", function (v) { S.C.e2eSet = String(v); });
      api.control.button("test", "Run the tests", function () { doTests(api); });
      api.control.select("bench", "Scanner on the bench", BENCH, "fake", function (v) {
        S.bench = String(v);
        show(api);
        api.log("Bench: " + S.benchText + ".", S.benchText.indexOf("refused") >= 0 ? "warn" : "");
      });
      api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        scans: api.stat("scans", "scans tonight", ""),
        ids: api.stat("ids", "ids on file", ""),
        wrong: api.stat("wrong", "tubes under a wrong id", "bad"),
        two: api.stat("two", "ids holding two cases", "bad"),
        unit: api.stat("unit", "unit tests", ""),
        contract: api.stat("contract", "contract tests", ""),
        e2e: api.stat("e2e", "end-to-end tests", ""),
        coverage: api.stat("coverage", "coverage (lines the unit tests run)", ""),
        verdict: api.stat("verdict", "test result", ""),
        time: api.stat("time", "test run time", ""),
        bench: api.stat("bench", "bench: sent -> filed as", "")
      };
      api.info("<strong>How to read it.</strong> The code at the top is the parser in use and the fake the unit tests use. The table is tonight's scans: each tube's label, the scanner that read it, the id the service filed it under, and its case. Bold rows were filed under a wrong id. Run the tests to see each suite's count, run time and result in the pyramid. The bench tries one scanner at a time.");
      api.log("21:00, before the first scan. 12 tubes due tonight; the old roll runs out at 23:16, and the day's first three new-label tubes arrive at 23:40.", "");
      show(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens at 21:00, before the first scan.
      t.expect(t.stat("scans") === "0 of 12" && t.stat("ids") === 0 && t.stat("two") === 0 && t.stat("unit") === "not run" &&
        has("21:00, before the first scan."),
        "Opens at 21:00 with nothing scanned and no tests run");

      // 2. The first scan: 26100510 for case 3307.
      t.click("next");
      t.expect(has("26100510 (old scanner, case 3307, blood) filed as 26100510.") && t.stat("ids") === 1 && t.stat("wrong") === 0,
        "21:12: old label 26100510 is filed whole for case 3307");

      // 3. As built, the whole evening: 261005100 is filed as 26100510.
      t.click("run");
      t.expect(has("261005100 (new scanner, case 3313, blood) filed as 26100510. WRONG ID: the label says 261005100. 26100510 now holds case 3307 and case 3313.") &&
        has("23:40, all 12 scanned. 9 ids on file, 3 tubes under a wrong id, 1 id holding two cases.") &&
        t.stat("ids") === 9 && t.stat("wrong") === 3 && t.stat("two") === 1,
        "First 8: 261005100 becomes 26100510; 9 ids, 3 tubes under a wrong id, 1 id in two cases");

      // 4. The unit suite as built is green at 70%.
      t.click("test");
      t.expect(t.stat("unit") === "12 of 12 passed" && t.stat("coverage") === "70% (14 of 20 lines)" && t.stat("verdict") === "green" &&
        t.stat("time") === "0.24 s",
        "Unit tests with the fake: 12 of 12 green, 70% coverage, 0.24 s");

      // 5. Option 3: coverage to 95%, still green, the record still wrong.
      t.set("cover", "95");
      t.click("test");
      t.expect(t.stat("unit") === "21 of 21 passed" && t.stat("coverage") === "95% (19 of 20 lines)" && t.stat("verdict") === "green" &&
        t.stat("two") === 1,
        "Raised to 95%: 21 of 21 green, and 26100510 still holds two cases");
      t.set("cover", "70");

      // 6. Option 2: end-to-end as written passes; only a clashing pair catches it.
      t.set("unit", false);
      t.set("e2e", true);
      t.click("test");
      var e1 = t.stat("e2e") === "2 of 2 passed" && t.stat("time") === "8 min" && t.stat("verdict") === "green";
      t.set("e2eset", "clash");
      t.click("test");
      t.expect(e1 && t.stat("e2e") === "0 of 2 passed" && t.stat("verdict") === "red",
        "End-to-end: the written set passes in 8 minutes; only a clashing pair (26100510, 261005100) fails");
      t.set("e2e", false);
      t.set("e2eset", "written");

      // 7. Contract tests catch the first-8 parser on the new scanner's reads.
      t.set("unit", true);
      t.set("contract", true);
      t.click("test");
      t.expect(t.stat("contract") === "2 of 4 passed" && t.stat("verdict") === "red" &&
        has("contract: 261005100 came back as 26100510; contract: 261005101 came back as 26100510"),
        "Contract tests on recorded reads: 2 of 4, 261005100 and 261005101 both came back as 26100510");

      // 8. Option 1: whole ids and the contract tests: green, and tonight replays clean.
      t.set("parser", "whole");
      t.click("run");
      t.click("test");
      var w = t.stat("ids") === 12 && t.stat("wrong") === 0 && t.stat("two") === 0 && t.stat("contract") === "4 of 4 passed" &&
        t.stat("unit") === "12 of 12 passed" && t.stat("verdict") === "green";
      t.set("spring", true);
      t.click("test");
      t.set("bench", "spring");
      t.expect(w && t.stat("contract") === "4 of 6 passed" && has("contract: 2704121000 was refused") && t.stat("bench") === "2704121000 -> refused",
        "Whole ids: 12 ids, 0 in two cases, contract 4 of 4; the spring model's 10 digits are refused, so its tests fail before it goes live");

      // 9. Option 0: a 9-digit fake fails with first 8; first 9 fixes tonight but trims the spring model.
      t.set("spring", false);
      t.set("contract", false);
      t.set("parser", "first8");
      t.set("fake9", true);
      t.click("test");
      var f8 = t.stat("unit") === "11 of 12 passed" && has("unit: the fake sent 261005100 and the parser gave back 26100510");
      t.set("parser", "first9");
      t.click("test");
      t.click("run");
      t.expect(f8 && t.stat("unit") === "12 of 12 passed" && t.stat("two") === 0 && t.stat("bench") === "2704121000 -> 270412100",
        "9-digit fake: 11 of 12 with first 8, 12 of 12 with first 9; tonight is clean, but 2704121000 becomes 270412100");

      // 10. The bench: the new scanner through the first-8 parser.
      t.set("parser", "first8");
      t.set("bench", "new");
      t.expect(t.stat("bench") === "261005100 -> 26100510" && t.stat("scans") === "0 of 12",
        "Bench: the new scanner sends 261005100 and the first-8 parser files 26100510; changing the parser rewinds");
    }
  });
})();
