/* sims/a4e05-v1.0.0.js  (published as sims/a4e05.js)
   Case a4e05 "The Apprentice That Writes Code": a coding-agent lab for Gaukroger's, a clock repair
   workshop in Wharrby. No real model runs. A stand-in agent takes Thursday's task, "fix the failing
   test", by stated rules; the learner sets a written spec, locked tests, a diff size limit, review
   by a person, self-review by the agent and a senior who sits with it, then runs the agent and
   Monday's reminder job, and reads the diff, which tests changed, the due dates the job computes
   and what a review would have flagged. Widget-style sim: it draws inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version. Controls: written spec, tests locked, diff size limit (none or
     20 lines), review by a person, self-review, a senior sits with it; Run the agent (Thursday),
     Run Monday's job, Reset. Stats: lines in the diff, files touched, tests edited, tests passing,
     merged, due on Monday, due since 1 January 1970, dates sent to Bronwen, senior's minutes.
     selfTest: 11 assertions.

   The model (stated in sim.lede):
   - The ledger: 318 clocks on service contracts. Each row holds the date the clock's next service
     falls due, written by Mr Gaukroger after each visit. Clock k (1 to 318) is due on 1 October
     2026 plus ((61 x k) mod 730) days, written in the new export as DD/MM/YYYY, except four rows
     typed by hand: clock 41 "14.03.2027", clock 112 "Mar 2027", clock 230 "" (blank), clock 297
     "see note".
   - The reminder job runs at 06:00 on Monday 5 October 2026. Its formula: a clock is due when its
     recorded due date is on or before that day; it adds nothing to the date. It reads every row
     first, then emails each due clock's owner. A date the parser refuses stops the whole job,
     unless the job has the "error" edit, which lists that clock for Bronwen and goes on.
   - The parser before Thursday reads only YYYY-MM-DD. The suite has 24 tests; 23 pass, and the
     new one, parseDate("14/03/2027") should be 14 March 2027, fails.
   - The stand-in agent's possible edits (lines in the diff = lines added + lines removed):
       fallback  src/dates.js            +4 -1 =  5  a date it can't read returns 1 January 1970
       testedit  test/dates.test.js      +1 -1 =  2  the new test now expects 1970-01-01
       reader    src/dates.js            +6 -0 =  6  reads DD/MM/YYYY too
       error     src/reminders.js        +4 -1 =  5  an unreadable date goes to Bronwen, by clock
       rewrite   src/dates.js           +38 -9 = 47  a new parseDate: YYYY-MM-DD, DD/MM/YYYY,
                                                     DD.MM.YYYY, "Mon YYYY" as the 1st, else 1970
   - Rules. With a written spec ("Read DD/MM/YYYY as well as YYYY-MM-DD. A date it can read neither
     way is an error that names the clock, for a person. Change nothing else."): reader + error.
     Without one, its goal is only the green test: first the fallback (the smallest change that
     stops the error); the test is still red (1970-01-01, not 14 March 2027); if tests are editable
     it edits the expected value (as built); if locked it replaces the fallback with the rewrite,
     unless a diff limit of 20 lines refuses the 47-line rewrite, when it keeps the fallback and
     adds the reader.
   - A senior who sits with it sees each edit as it is proposed, 40 minutes each (a teaching value),
     rejects the fallback, test edits and the rewrite, and on rejecting the fallback tells it the
     rule for unreadable dates, so it proposes reader then error.
   - Self-review: the agent checks its diff against its own task and the test run. It always
     approves. Review by a person reads a diff of 30 lines or fewer in full and sends it back if it
     finds a flag; a longer one it skims and approves on green tests (a teaching assumption). Flags:
     a test's expected value changed, a date it can't read becomes 1 January 1970, a month alone
     becomes the 1st.
   - Merged unless review sends it back. Not merged: Monday runs the old parser.

   Where every number comes from (content/latent/a4/a4e05-v1.0.0.json), checked by the selfTest:
   - Opening (Thursday): 23 of 24 tests pass; Monday's job, unchanged, stops at clock 1, whose
     date reads 01/12/2026 (offset 61).
   - As built: fallback + testedit = 7 lines in 2 files, 1 test edited, 24 of 24, merged. Monday:
     318 of 318 due, all 318 dated 1970-01-01, 20,731 days overdue (56 years): 1 January 1970 to
     5 October 2026. Self-review on: the same.
   - Truly due by Monday: offsets 0 to 4 are clocks 12 (03/10/2026) and 24 (05/10/2026): 2.
   - Review alone: 7 lines, 2 flags, sent back; Monday's job stops at clock 1 again.
   - Locked alone: rewrite, 47 lines, 0 tests edited, merged; Monday: 4 due (12, 24, 230, 297),
     2 since 1970, clock 112 guessed as 1 March 2027, clock 41 read as 14 March 2027.
   - Locked + limit 20: fallback + reader, 11 lines, 1 file; Monday 6 due, 4 since 1970.
     Add review: 11 lines read in full, the fallback flagged, sent back.
     Locked + review, no limit: 47 lines skimmed, merged, Monday as locked alone.
   - Spec (any locks), or the ok option (spec, locked, limit 20, review): reader + error, 11 lines
     in 2 files, 0 tests edited, nothing flagged, merged; Monday 2 due, 0 since 1970, 4 sent to
     Bronwen (clocks 41, 112, 230, 297).
   - A senior sitting with it, no spec: 3 edits proposed (fallback rejected, reader, error), 120
     minutes; Monday as the spec. With a spec: 2 proposed, 80 minutes.
*/
(function () {
  "use strict";

  var DAY = 86400000;
  var MONDAY = Date.UTC(2026, 9, 5);
  var BASE = Date.UTC(2026, 9, 1);
  var CLOCKS = 318;
  var ODD = { 41: "14.03.2027", 112: "Mar 2027", 230: "", 297: "see note" };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MINUTES_PER_EDIT = 40;
  var CAREFUL = 30;
  var SHOW = [1, 2, 12, 24, 41, 112, 230, 297, 318];

  var EDITS = {
    fallback: {
      file: "src/dates.js", add: 4, del: 1, what: "a date it can't read returns 1 January 1970",
      text: ["-  if (!iso) throw new Error(\"can't read date: \" + s);", "+  if (!iso) {", "+    // safe fallback for unparseable dates",
        "+    return new Date(0); // 1970-01-01", "+  }"]
    },
    testedit: {
      file: "test/dates.test.js", add: 1, del: 1, what: "the new test now expects 1970-01-01",
      text: ["-  expect(parseDate(\"14/03/2027\")).toEqual(day(2027, 3, 14));", "+  expect(parseDate(\"14/03/2027\")).toEqual(day(1970, 1, 1));"]
    },
    reader: {
      file: "src/dates.js", add: 6, del: 0, what: "reads DD/MM/YYYY as well",
      text: ["+  const uk = /^(\\d{2})\\/(\\d{2})\\/(\\d{4})$/.exec(s);", "+  if (uk) {", "+    const d = day(+uk[3], +uk[2], +uk[1]);",
        "+    if (d.getUTCDate() !== +uk[1]) throw new Error(\"not a real date: \" + s);", "+    return d;", "+  }"]
    },
    error: {
      file: "src/reminders.js", add: 4, del: 1, what: "a date it can't read goes to Bronwen, by clock number",
      text: ["-    const due = parseDate(row.due);", "+    let due;", "+    try { due = parseDate(row.due); }",
        "+    catch (e) { unreadable.push(\"clock \" + row.clock + \": '\" + row.due + \"'\"); continue; }",
        "+  if (unreadable.length) notify(\"bronwen\", unreadable);"]
    },
    rewrite: {
      file: "src/dates.js", add: 38, del: 9, what: "a new parseDate that reads four formats and returns 1970-01-01 for the rest",
      text: ["-export function parseDate(s) { ... 9 lines ... }", "+export function parseDate(s) {", "+  // tolerant parser: ISO, UK slashes, UK dots, month and year",
        "+  ... 34 more lines ...", "+  if (mon) return day(+mon[2], MONTHS.indexOf(mon[1]) + 1, 1);", "+  return new Date(0);", "+}"]
    }
  };

  var FLAGS = {
    testedit: "a test's expected value was changed to match the new code (2027-03-14 to 1970-01-01)",
    fallback: "a date it can't read becomes 1 January 1970, silently",
    rewrite: "a month alone becomes the 1st ('Mar 2027' as 1 March), and anything else 1 January 1970"
  };

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function p2(n) { return n < 10 ? "0" + n : String(n); }
  function iso(t) { var d = new Date(t); return d.getUTCFullYear() + "-" + p2(d.getUTCMonth() + 1) + "-" + p2(d.getUTCDate()); }
  function uk(t) { var d = new Date(t); return p2(d.getUTCDate()) + "/" + p2(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear(); }
  function day(y, m, d) {
    var t = Date.UTC(y, m - 1, d);
    var x = new Date(t);
    if (x.getUTCFullYear() !== y || x.getUTCMonth() !== m - 1 || x.getUTCDate() !== d) return null;
    return t;
  }
  function yearsBetween(a, b) {
    var x = new Date(a);
    var y = new Date(b);
    var n = y.getUTCFullYear() - x.getUTCFullYear();
    if (y.getUTCMonth() < x.getUTCMonth() || (y.getUTCMonth() === x.getUTCMonth() && y.getUTCDate() < x.getUTCDate())) n -= 1;
    return n;
  }

  /* ---------- the ledger and the parsers ---------- */

  function trueDue(k) { return BASE + ((61 * k) % 730) * DAY; }
  function exportRow(k) { return ODD.hasOwnProperty(k) ? ODD[k] : uk(trueDue(k)); }

  // Each parser returns a time (ms) or throws.
  function readIso(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? day(+m[1], +m[2], +m[3]) : null; }
  function readUk(s, sep) {
    var re = sep === "." ? /^(\d{2})\.(\d{2})\.(\d{4})$/ : /^(\d{2})\/(\d{2})\/(\d{4})$/;
    var m = re.exec(s);
    return m ? day(+m[3], +m[2], +m[1]) : null;
  }
  function readMon(s) {
    var m = /^([A-Z][a-z]{2}) (\d{4})$/.exec(s);
    if (!m || MONTHS.indexOf(m[1]) < 0) return null;
    return day(+m[2], MONTHS.indexOf(m[1]) + 1, 1);
  }
  function parser(kind) {
    return function (s) {
      var t = readIso(s);
      if (t !== null) return t;
      if (kind === "reader" || kind === "readerFallback" || kind === "rewrite") {
        t = readUk(s, "/");
        if (t !== null) return t;
      }
      if (kind === "rewrite") {
        t = readUk(s, ".");
        if (t !== null) return t;
        t = readMon(s);
        if (t !== null) return t;
      }
      if (kind === "fallback" || kind === "readerFallback" || kind === "rewrite") return 0;
      throw new Error("can't read date: " + s);
    };
  }

  /* ---------- the stand-in agent, review and merge ---------- */

  function runAgent(C) {
    var proposed = [];
    var edits;
    var notes = [];
    if (C.spec) {
      proposed = ["reader", "error"];
      edits = ["reader", "error"];
      notes.push("It reads the spec: DD/MM/YYYY as well as YYYY-MM-DD, an unreadable date is an error naming the clock, nothing else changes.");
    } else if (C.pair) {
      proposed = ["fallback", "reader", "error"];
      edits = ["reader", "error"];
      notes.push("It proposes the fallback. The senior rejects it and says what an unreadable date must do: an error that names the clock, for a person.");
    } else {
      proposed = ["fallback"];
      notes.push("Goal: the failing test goes green. Smallest change that stops the error: a fallback to 1 January 1970. The test is still red: it gets 1970-01-01, not 14 March 2027.");
      if (!C.locked) {
        proposed.push("testedit");
        edits = ["fallback", "testedit"];
        notes.push("The tests are editable, so it changes the test's expected value to what the code now returns.");
      } else if (C.limit && EDITS.rewrite.add + EDITS.rewrite.del > C.limit) {
        proposed.push("rewrite", "reader");
        edits = ["fallback", "reader"];
        notes.push("The tests are locked. It tries a 47-line rewrite of parseDate; the " + C.limit + "-line limit refuses it, so it keeps the fallback and adds a DD/MM/YYYY reader.");
      } else {
        proposed.push("rewrite");
        edits = ["rewrite"];
        notes.push("The tests are locked. It replaces the fallback with a 47-line rewrite of parseDate that reads four formats.");
      }
    }
    var lines = 0;
    var files = {};
    edits.forEach(function (k) { lines += EDITS[k].add + EDITS[k].del; files[EDITS[k].file] = true; });
    var flags = edits.filter(function (k) { return FLAGS[k]; }).map(function (k) { return FLAGS[k]; });
    return {
      proposed: proposed, edits: edits, notes: notes, lines: lines, files: Object.keys(files).length,
      edited: edits.indexOf("testedit") >= 0 ? 1 : 0, flags: flags,
      minutes: C.pair ? proposed.length * MINUTES_PER_EDIT : 0
    };
  }

  function decide(C, A) {
    var log = [];
    var merged = true;
    if (C.self) log.push(["Self-review: the change does what was asked; the failing test passes, 24 of 24. Approved.", ""]);
    if (C.review) {
      if (A.lines > CAREFUL) {
        log.push(["Review: " + A.lines + " lines, too long to read line by line; skimmed, tests green, approved.", "warn"]);
      } else if (A.flags.length) {
        merged = false;
        log.push(["Review: read all " + A.lines + " lines and sent it back: " + A.flags.join("; ") + ".", "ok"]);
      } else {
        log.push(["Review: read all " + A.lines + " lines. Nothing to flag. Approved.", "ok"]);
      }
    }
    return { merged: merged, log: log };
  }

  function parserKind(edits) {
    if (edits.indexOf("rewrite") >= 0) return "rewrite";
    var f = edits.indexOf("fallback") >= 0;
    var r = edits.indexOf("reader") >= 0;
    if (f && r) return "readerFallback";
    if (f) return "fallback";
    if (r) return "reader";
    return "old";
  }

  // Monday 06:00. Returns the job's result.
  function runJob(edits) {
    var parse = parser(parserKind(edits));
    var catches = edits.indexOf("error") >= 0;
    var rows = [];
    var held = [];
    for (var k = 1; k <= CLOCKS; k++) {
      var s = exportRow(k);
      try {
        rows.push({ k: k, s: s, t: parse(s) });
      } catch (e) {
        if (!catches) return { stopped: k, text: s };
        held.push(k);
        rows.push({ k: k, s: s, t: null });
      }
    }
    var due = rows.filter(function (r) { return r.t !== null && r.t <= MONDAY; });
    var epoch = due.filter(function (r) { return r.t === 0; });
    return { stopped: 0, rows: rows, due: due.length, epoch: epoch.length, held: held, dueList: due.map(function (r) { return r.k; }) };
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text, parent) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      if (parent) parent.appendChild(e);
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;", "", api.root);
    var head = el("p", "margin:0;", "", box);
    el("strong", "", "The diff", box);
    var diff = el("pre", "margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;", "", box);
    var tests = el("p", "margin:0;", "", box);
    el("strong", "", "What a review would flag", box);
    var flags = el("ul", "margin:0;padding-left:16px;", "", box);
    el("strong", "", "Monday 5 October 2026, 06:00: the reminder job", box);
    var job = el("p", "margin:0;", "", box);
    var table = el("table", "width:100%;font-size:12px;", "", box);
    var hr = el("tr", "", "", el("thead", "", "", table));
    ["clock", "export says", "read as", "due?"].forEach(function (h) { el("th", "text-align:left;", h, hr); });
    var tbody = el("tbody", "", "", table);
    return { el: el, head: head, diff: diff, tests: tests, flags: flags, job: job, tbody: tbody };
  }

  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var A = S.A;
    var J = S.J;
    ui.head.textContent = "Task: \"fix the failing test\". Spec: " + (C.spec ? "written" : "none") + ". Tests: " + (C.locked ? "locked" : "editable") +
      ". Diff limit: " + (C.limit ? C.limit + " lines" : "none") + ". Review: " + (C.review ? "a person" : "none") + (C.self ? ", plus self-review" : "") +
      (C.pair ? ". A senior sits with it." : ".");
    if (!A) {
      ui.diff.textContent = "(the agent hasn't run yet)";
      ui.tests.textContent = "Tests: 23 of 24 pass. Failing: parseDate(\"14/03/2027\") should be 14 March 2027.";
    } else {
      var out = [];
      A.edits.forEach(function (k) { out.push(EDITS[k].file + "  (+" + EDITS[k].add + " -" + EDITS[k].del + ")  " + EDITS[k].what); out = out.concat(EDITS[k].text); out.push(""); });
      ui.diff.textContent = out.join("\n");
      ui.tests.textContent = "Tests: 24 of 24 pass. Tests edited: " + (A.edited ? "1, test/dates.test.js, expected 2027-03-14 changed to 1970-01-01." : "none.");
    }
    clear(ui.flags);
    var fl = A ? A.flags : [];
    if (!A) ui.el("li", "", "Nothing to review yet.", ui.flags);
    else if (!fl.length) ui.el("li", "", "Nothing: the diff does what the test asks and no more.", ui.flags);
    fl.forEach(function (f) { ui.el("li", "color:var(--red);", f, ui.flags); });
    clear(ui.tbody);
    if (!J) {
      ui.job.textContent = "Not run yet.";
    } else if (J.stopped) {
      ui.job.textContent = "The job stopped at clock " + J.stopped + ": can't read date: " + J.text + ". No reminders sent.";
    } else {
      ui.job.textContent = J.due + " of " + CLOCKS + " due, " + J.epoch + " of them since 1 January 1970" +
        (J.held.length ? "; " + J.held.length + " dates sent to Bronwen" : "") + ".";
      SHOW.forEach(function (k) {
        var r = J.rows[k - 1];
        var tr = ui.el("tr", r.t === 0 ? "color:var(--red);" : "", "", ui.tbody);
        [String(k), r.s === "" ? "(blank)" : r.s, r.t === null ? "sent to Bronwen" : iso(r.t), r.t !== null && r.t <= MONDAY ? "due" : "-"].forEach(function (c) { ui.el("td", "", c, tr); });
      });
    }
    var st = S.stat;
    st.lines(A ? A.lines : 0);
    st.files(A ? A.files : 0);
    st.edited(A ? A.edited : 0);
    st.tests(A ? "24 of 24" : "23 of 24");
    st.merged(!A ? "not yet" : (S.merged ? "yes" : "no, sent back"));
    st.due(!J || J.stopped ? "-" : J.due);
    st.epoch(!J || J.stopped ? "-" : J.epoch);
    st.held(!J || J.stopped ? "-" : J.held.length);
    st.senior(A ? A.minutes : 0);
  }

  function fresh(api, why) {
    var S = api.state;
    S.A = null;
    S.J = null;
    S.merged = false;
    if (why) api.log(why + " Back to Thursday evening: run the agent again.", "");
    draw(api);
  }

  function runThursday(api) {
    var S = api.state;
    var A = runAgent(S.C);
    S.A = A;
    S.J = null;
    A.notes.forEach(function (n) { api.log("Agent: " + n, ""); });
    api.log("Agent's diff: " + A.lines + " lines in " + A.files + (A.files === 1 ? " file" : " files") + ": " +
      A.edits.map(function (k) { return k + " (" + EDITS[k].file + ")"; }).join(", ") + ". Tests 24 of 24." +
      (A.edited ? " 1 test edited." : ""), A.edited ? "bad" : "");
    if (S.C.pair) api.log("The senior saw " + A.proposed.length + " proposed edits at " + MINUTES_PER_EDIT + " minutes each: " + A.minutes + " minutes.", "warn");
    var D = decide(S.C, A);
    D.log.forEach(function (l) { api.log(l[0], l[1]); });
    S.merged = D.merged;
    api.log(D.merged ? "Merged on Friday." : "Not merged. Monday's job will run the old parser.", D.merged ? "" : "warn");
    draw(api);
  }

  function runMonday(api) {
    var S = api.state;
    var edits = S.A && S.merged ? S.A.edits : [];
    var J = runJob(edits);
    S.J = J;
    if (J.stopped) {
      api.log("Monday 06:00: the job stopped at clock " + J.stopped + ": can't read date: " + J.text + ". No reminders sent.", "warn");
    } else {
      var s = "Monday 06:00: " + J.due + " of " + CLOCKS + " clocks due";
      if (J.epoch) s += "; " + J.epoch + " due since 1 January 1970, " + fmt((MONDAY - 0) / DAY) + " days overdue (" + yearsBetween(0, MONDAY) + " years)";
      s += ". " + J.due + " emails sent.";
      if (J.held.length) s += " Sent to Bronwen: " + J.held.map(function (k) { return "clock " + k + " '" + ODD[k] + "'"; }).join(", ") + ".";
      var r112 = J.rows[111];
      if (r112.t !== null && r112.t !== 0) s += " Clock 112 'Mar 2027' read as " + iso(r112.t) + ", a guess.";
      api.log(s, J.epoch ? "bad" : "ok");
    }
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("a4e05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { spec: false, locked: false, limit: 0, review: false, self: false, pair: false };
      S.ui = buildWidget(api);
      S.stat = {
        lines: api.stat("lines", "lines in the diff", ""),
        files: api.stat("files", "files touched", ""),
        edited: api.stat("edited", "tests edited", "bad"),
        tests: api.stat("tests", "tests passing", ""),
        merged: api.stat("merged", "merged", "warn"),
        due: api.stat("due", "due on Monday", ""),
        epoch: api.stat("epoch", "due since 1 January 1970", "bad"),
        held: api.stat("held", "dates sent to Bronwen", "ok"),
        senior: api.stat("senior", "senior's minutes", "warn")
      };
      function tog(id, key, label) {
        api.control.toggle(id, label, false, function (on) { S.C[key] = !!on; fresh(api, label + ": " + (on ? "on." : "off.")); });
      }
      tog("spec", "spec", "Written spec");
      tog("locked", "locked", "Tests locked (the agent can't edit them)");
      api.control.select("limit", "Diff size limit", [{ value: "0", label: "none" }, { value: "20", label: "20 lines" }], "0", function (v) {
        S.C.limit = Number(v) || 0;
        fresh(api, "Diff size limit: " + (S.C.limit ? S.C.limit + " lines." : "none."));
      });
      tog("review", "review", "Review by a person");
      tog("self", "self", "The agent reviews its own change");
      tog("pair", "pair", "A senior sits with it and approves each edit");
      api.control.button("agent", "Run the agent (Thursday)", function () { runThursday(api); });
      api.control.button("monday", "Run Monday's job", function () { runMonday(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });
      api.info("<strong>How to read it.</strong> The diff is every line the agent added (+) or removed (-), file by file. Tests passing counts the 24 tests after its change. Monday's job reads all 318 rows of the ledger's export and emails the owner of every clock whose due date is on or before Monday 5 October 2026. The table shows nine rows: clocks 1, 2, 12, 24, 318, and the four typed by hand.");
      api.log("Thursday evening. The ledger exports 318 clocks with dates like 01/12/2026. Tests: 23 of 24 pass; the new one, parseDate(\"14/03/2027\") should be 14 March 2027, fails. Since the ledger update on Tuesday 29 September, the job has stopped every morning at clock 1: can't read date: 01/12/2026.", "");
      fresh(api, "");
    },

    selfTest: async function (t) {
      var S = t.api.state;
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Thursday evening, before the agent runs.
      t.expect(t.stat("tests") === "23 of 24" && t.stat("merged") === "not yet" && t.stat("lines") === 0 && t.stat("due") === "-" &&
        has("the job has stopped every morning at clock 1: can't read date: 01/12/2026."),
        "Opens on Thursday: 23 of 24 tests pass and the job stops at clock 1");

      // 2. As built: the fallback and the edited test, merged on green.
      t.click("agent");
      t.expect(t.stat("lines") === 7 && t.stat("files") === 2 && t.stat("edited") === 1 && t.stat("tests") === "24 of 24" && t.stat("merged") === "yes" &&
        has("Agent's diff: 7 lines in 2 files: fallback (src/dates.js), testedit (test/dates.test.js). Tests 24 of 24. 1 test edited."),
        "As built: 7 lines in 2 files, the test's expected value edited, 24 of 24, merged");

      // 3. Monday: the 1970 ledger.
      t.click("monday");
      t.expect(t.stat("due") === 318 && t.stat("epoch") === 318 && t.stat("held") === 0 &&
        has("Monday 06:00: 318 of 318 clocks due; 318 due since 1 January 1970, 20,731 days overdue (56 years). 318 emails sent.") &&
        S.J.rows[0].t === 0 && S.J.rows[317].t === 0,
        "Monday: all 318 clocks due since 1 January 1970, 20,731 days (56 years) overdue");

      // 4. Self-review approves the same change.
      t.set("self", true);
      t.click("agent");
      t.click("monday");
      t.expect(has("Self-review: the change does what was asked; the failing test passes, 24 of 24. Approved.") && t.stat("epoch") === 318 && t.stat("merged") === "yes",
        "Self-review approves, and Monday is the same 318");
      t.set("self", false);

      // 5. Review by a person alone: 7 lines read, two flags, sent back; the job stops as before.
      t.set("review", true);
      t.click("agent");
      t.click("monday");
      t.expect(t.stat("merged") === "no, sent back" && S.A.flags.length === 2 && t.stat("due") === "-" &&
        has("Monday 06:00: the job stopped at clock 1: can't read date: 01/12/2026. No reminders sent."),
        "Review alone sends the 7 lines back with 2 flags; Monday's job stops at clock 1 again");
      t.set("review", false);

      // 6. Locked tests alone: the 47-line rewrite.
      t.set("locked", true);
      t.click("agent");
      t.click("monday");
      t.expect(t.stat("lines") === 47 && t.stat("edited") === 0 && t.stat("due") === 4 && t.stat("epoch") === 2 &&
        S.J.dueList.join(" ") === "12 24 230 297" && has("Clock 112 'Mar 2027' read as 2027-03-01, a guess."),
        "Locked alone: a 47-line rewrite; 4 due, 2 of them since 1970, and clock 112 guessed");

      // 7. Locked plus review, no limit: the rewrite is skimmed and merged.
      t.set("review", true);
      t.click("agent");
      t.expect(t.stat("merged") === "yes" && has("Review: 47 lines, too long to read line by line; skimmed, tests green, approved."),
        "Locked and reviewed with no limit: 47 lines skimmed and merged");

      // 8. Locked, limit 20, review: 11 lines read in full, the fallback sent back. Without review: 6 due.
      t.set("limit", "20");
      t.click("agent");
      var sentBack = t.stat("merged") === "no, sent back" && has("sent it back: a date it can't read becomes 1 January 1970, silently.");
      t.set("review", false);
      t.click("agent");
      t.click("monday");
      t.expect(sentBack && t.stat("lines") === 11 && t.stat("files") === 1 && t.stat("due") === 6 && t.stat("epoch") === 4,
        "Locked with a 20-line limit: fallback plus reader, 11 lines; review sends it back; merged unreviewed, 6 due and 4 since 1970");

      // 9. The ok option: spec, locked, limit 20, review.
      t.set("spec", true);
      t.set("review", true);
      t.click("agent");
      t.click("monday");
      t.expect(t.stat("lines") === 11 && t.stat("files") === 2 && t.stat("edited") === 0 && S.A.flags.length === 0 && t.stat("merged") === "yes" &&
        t.stat("due") === 2 && t.stat("epoch") === 0 && t.stat("held") === 4 && S.J.dueList.join(" ") === "12 24" &&
        has("Sent to Bronwen: clock 41 '14.03.2027', clock 112 'Mar 2027', clock 230 '', clock 297 'see note'."),
        "Spec, locked, small, reviewed: 11 lines in 2 files, nothing flagged; Monday 2 due, 4 sent to Bronwen");

      // 10. A spec with editable tests: no test is touched.
      t.set("locked", false);
      t.set("limit", "0");
      t.set("review", false);
      t.click("agent");
      t.expect(t.stat("edited") === 0 && t.stat("lines") === 11 && t.stat("merged") === "yes",
        "With a spec the tests stay as they are even when editable");

      // 11. A senior sits with it, no spec: three edits proposed, 120 minutes.
      t.set("spec", false);
      t.set("pair", true);
      t.click("agent");
      t.click("monday");
      t.expect(t.stat("senior") === 120 && t.stat("lines") === 11 && t.stat("due") === 2 && t.stat("held") === 4 && t.stat("epoch") === 0 &&
        has("The senior saw 3 proposed edits at 40 minutes each: 120 minutes."),
        "A senior sitting with it: 3 edits proposed, 120 minutes; Monday as with the spec");
    }
  });
})();
