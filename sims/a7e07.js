/* sims/a7e07-v1.0.0.js  (published as sims/a7e07.js)
   Case a7e07 "The Rules for Machines": an AI register for Corrabeck Out-of-Hours Vets, a night clinic
   that runs four AI tools bought from vendors. An inspector asks three questions about any tool and any
   date: who approved it, what was it tested on, and which version made the decision. No real model runs
   here and no call text exists in this file: each version is a date and a count of urgent calls found.
   The sim models the defence and its numbers, never an attack. Widget-style sim: it draws its own table
   in api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: inspect, the tool, the date to inspect, governance items
     for the chosen tool (named owner, risk class, model card, version log, labelled test before each
     update), call sorter switched off, re-run the 02:10 words, a reply to play, reset. Stats: owners,
     risk classes, model cards, version logs and labelled tests across the 4 tools; questions answered;
     version live on the date; what sorted the 02:10 call; urgent calls found and missed by the live
     version; the 29 September update; calls the night vet answers. selfTest: 10 assertions.

   The model (stated in sim.lede, given data):
   - Four AI tools: call sorter, reminder-text writer, notes transcriber, rota planner. At the start none
     has a named owner, a risk class, a model card, a version log or a labelled test: 0 of 4 each.
   - Call sorter versions, from the vendor's list: version 1 installed Thursday 19 February; updates on
     Saturday 6 June (version 2), Tuesday 1 September (version 3), Tuesday 29 September (version 4).
     Version live on a date: the latest released on or before it.
   - The labelled set: 120 calls from four September nights in the clinic's own log, 30 of them urgent,
     labelled by two vets (Rhiannon and Dr Ekundayo) on 12 to 14 October. Version 3 finds 29 of 30,
     version 4 finds 26 of 30. Versions 1 and 2 can no longer be run, so the replay lets the June and
     1 September updates through, as the clinic did.
   - The 02:10 words of Saturday 3 October, re-run today: version 4 says can wait, version 3 come in now.
   - The vendor's version log is kept 7 days; asked on Monday 12 October, it went back to 5 October.
   - Change control: an update goes live only when the tool's named owner has re-run the labelled set and
     the new version finds at least as many of the 30 as the version it replaces.
   - The inspector's questions: who approved it (answered by a named owner); what was it tested on
     (answered by the clinic's labelled test; a model card or vendor letter alone gives the vendor's calls
     only); which version (answered by a version log kept with every decision).
   - Sorter switched off: the night vet answers every call: 120 over four nights, 30 a night.

   Where every number comes from (conventions rule 14; the case is content/latent/a7/a7e07-v1.0.0.json):
   - As it was: owners 0 of 4; questions 0 of 3; live on 3 October version 4; 26 of 30 found, 4 missed.
   - Dates: 19 February version 1, 6 June version 2, 1 September version 3 (29 of 30), 29 September version 4.
   - Version log on: the 02:10 call answered "version 4: can wait".
   - Owner and labelled test on: 29 September update blocked (26 below 29); version 3 live on 3 October,
     the 02:10 words come in now, 29 of 30 found, 1 missed; questions 3 of 3 with the version log.
   - Reply 0 (vendor letter): 0 of 3; tested on the vendor's own calls. Reply 1 (AI policy): owners 0 of 4.
   - Reply 2 (sorter off): 30 a night; the other 3 tools owners 0 of 3. Reply 3: 4 of 4 each, update blocked.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var TOOLS = [
    { value: "sorter", label: "call sorter", risk: "high: it decides who waits" },
    { value: "reminder", label: "reminder-text writer", risk: "low: texts about jabs and check-ups" },
    { value: "notes", label: "notes transcriber", risk: "medium: a vet reads every note" },
    { value: "rota", label: "rota planner", risk: "low: the rota is checked by hand" }
  ];
  var ITEMS = [
    { id: "owner", label: "named owner" },
    { id: "risk", label: "risk class" },
    { id: "card", label: "model card" },
    { id: "log", label: "version log" },
    { id: "test", label: "labelled test before each update" }
  ];
  // the call sorter's versions, from the vendor's list; found = urgent calls found of the 30
  var VERSIONS = [
    { n: 1, day: "2026-02-19", text: "19 February", found: null },
    { n: 2, day: "2026-06-06", text: "6 June", found: null },
    { n: 3, day: "2026-09-01", text: "1 September", found: 29 },
    { n: 4, day: "2026-09-29", text: "29 September", found: 26 }
  ];
  var URGENT = 30;
  var CALLS = 120;
  var NIGHTS = 4;
  var WORDS = { 3: "come in now", 4: "can wait" };   // the 02:10 words, re-run today
  var DATES = [
    { value: "19feb", day: "2026-02-19", label: "Thursday 19 February" },
    { value: "6jun", day: "2026-06-06", label: "Saturday 6 June" },
    { value: "1sep", day: "2026-09-01", label: "Tuesday 1 September" },
    { value: "29sep", day: "2026-09-29", label: "Tuesday 29 September" },
    { value: "3oct", day: "2026-10-03", label: "Saturday 3 October, the 02:10 call" },
    { value: "15oct", day: "2026-10-15", label: "Thursday 15 October, the inspection" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: a letter from the vendor" },
    { value: "r1", label: "reply 1: an AI policy, signed" },
    { value: "r2", label: "reply 2: switch the sorter off" },
    { value: "r3", label: "reply 3: owners, version logs, a test" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function blankItems() { return { owner: false, risk: false, card: false, log: false, test: false }; }
  function defaults() {
    var items = {};
    TOOLS.forEach(function (s) { items[s.value] = blankItems(); });
    return { tool: "sorter", date: "3oct", items: items, off: false, letter: false, policy: false, plan: "none" };
  }

  /* ---------- the model (pure: settings in, answers out) ---------- */

  // which call sorter version was live on a day; with change control, a failing update is blocked
  function live(C, day) {
    var it = C.items.sorter;
    var control = it.owner && it.test;
    var cur = null;
    var blocked = null;
    VERSIONS.forEach(function (v) {
      if (v.day > day) return;
      if (!cur) { cur = v; return; }
      if (control && v.found !== null && cur.found !== null && v.found < cur.found) {
        blocked = { v: v, bar: cur.found };
        return;
      }
      cur = v;
    });
    return { v: cur, blocked: blocked };
  }

  function updateText(C) {
    var it = C.items.sorter;
    var v4 = VERSIONS[3];
    var v3 = VERSIONS[2];
    if (it.owner && it.test) return "blocked: " + v4.found + " of " + URGENT + ", below " + v3.found;
    if (it.test) return "went live: no owner to run the test";
    return "went live unseen";
  }

  function count(C, key) {
    var n = 0;
    TOOLS.forEach(function (s) { if (C.items[s.value][key]) n++; });
    return n;
  }

  function inspect(C) {
    var tool = pick(TOOLS, C.tool);
    var date = pick(DATES, C.date);
    var it = C.items[C.tool];
    var R = { tool: tool, date: date, answers: [], answered: 0 };
    var sorterOff = C.tool === "sorter" && C.off;
    var L = C.tool === "sorter" ? live(C, date.day) : null;
    R.live = L;
    // 1. who approved it
    if (it.owner) { R.answers.push("who approved it: its named owner"); R.answered++; }
    else R.answers.push("who approved it: nobody named" + (C.tool === "sorter" ? " (Mr Ebdon signed the purchase and left in July)" : ""));
    // 2. what was it tested on
    if (it.test) { R.answers.push("what was it tested on: the clinic's labelled set of " + CALLS + " calls"); R.answered++; }
    else if (it.card || C.letter) R.answers.push("what was it tested on: the vendor's calls only, none of ours");
    else R.answers.push("what was it tested on: nothing on file");
    // 3. which version
    if (sorterOff) { R.answers.push("which version: none, the night vet sorts by ear"); R.answered++; }
    else if (it.log) {
      R.answers.push("which version: " + (L ? "version " + L.v.n : "kept with every decision") + ", from the version log");
      R.answered++;
    } else R.answers.push("which version: not recorded");
    return R;
  }

  function sortedText(C) {
    if (C.tool !== "sorter") return "-";
    if (C.off) return "night vet, by ear";
    var L = live(C, "2026-10-03");
    if (C.items.sorter.log) return "version " + L.v.n + ": " + WORDS[L.v.n];
    return "not recorded";
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
    var w1 = el("div", "overflow-x:auto;", "", box);
    var table = el("table", "width:100%;border-collapse:collapse;", "", w1);
    var note = el("pre", "margin:0;white-space:pre-wrap;font-size:11px;", "", box);
    return { el: el, head: head, table: table, note: note };
  }
  function row(ui, cells, th) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }
  function yes(b) { return b ? "yes" : "no"; }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "the AI register at Corrabeck. tool: " + pick(TOOLS, C.tool).label + ". date: " +
      pick(DATES, C.date).label + "." + (C.off ? " call sorter switched off." : "") +
      (C.letter ? " vendor's letter on file." : "") + (C.policy ? " AI policy signed." : "");
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["AI tool", "named owner", "risk class", "model card", "version log", "test before update"], true);
    TOOLS.forEach(function (s) {
      var it = C.items[s.value];
      row(ui, [s.label, yes(it.owner), it.risk ? s.risk : "no", yes(it.card), yes(it.log), yes(it.test)], false);
    });
    if (!S.R) {
      ui.note.textContent = "Thursday 15 October. Nothing inspected yet.";
      return;
    }
    ui.note.textContent = "the inspector's questions:\n" + S.R.answers.join("\n") + "\nanswered " + S.R.answered + " of 3.";
  }

  function setStats(api) {
    var S = api.state;
    var st = S.stat;
    var ids = ["owners", "risks", "cards", "logs", "tests", "questions", "live", "sorted", "found", "missed", "update", "calls"];
    if (!S.R) { ids.forEach(function (id) { st[id]("-"); }); return; }
    var C = S.C;
    var R = S.R;
    st.owners(count(C, "owner") + " of 4");
    st.risks(count(C, "risk") + " of 4");
    st.cards(count(C, "card") + " of 4");
    st.logs(count(C, "log") + " of 4");
    st.tests(count(C, "test") + " of 4");
    st.questions(R.answered + " of 3");
    st.sorted(sortedText(C));
    if (C.tool !== "sorter") {
      st.live("-"); st.found("-"); st.missed("-"); st.update("-"); st.calls("-");
      return;
    }
    if (C.off) {
      st.live("switched off"); st.found("-"); st.missed("-");
    } else {
      var v = R.live.v;
      st.live("version " + v.n);
      st.found(v.found === null ? "not testable now" : v.found + " of " + URGENT);
      st.missed(v.found === null ? "-" : URGENT - v.found);
    }
    st.update(updateText(C));
    st.calls(C.off ? (CALLS / NIGHTS) + " a night" : "come in now only");
  }

  function run(api, what) {
    var S = api.state;
    S.R = inspect(S.C);
    draw(api);
    setStats(api);
    var R = S.R;
    api.log((what ? what + " " : "") + "inspection, " + R.tool.label + ", " + R.date.label + ": " +
      R.answers.join("; ") + ". answered " + R.answered + " of 3.", R.answered === 3 ? "ok" : (R.answered ? "warn" : "bad"));
  }

  function rerun(api) {
    api.log("02:10 words re-run today: version 4: " + WORDS[4] + "; version 3: " + WORDS[3] +
      ". a likely answer, not a record.", "warn");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") C.letter = true;
    if (plan === "r1") C.policy = true;
    if (plan === "r2") C.off = true;
    if (plan === "r3") TOOLS.forEach(function (s) { C.items[s.value] = { owner: true, risk: true, card: true, log: true, test: true }; });
    return C;
  }

  function planFollowUp(api, plan) {
    var C = api.state.C;
    if (plan === "r0") {
      api.log("vendor's letter on file: tested on the vendor's own recorded calls; no version named; none of the calls are Corrabeck's.", "bad");
      api.log("29 September update: " + updateText(C) + "; version 4 finds " + VERSIONS[3].found + " of " + URGENT + ".", "bad");
    }
    if (plan === "r1") {
      api.log("AI policy signed by every vet: names no owner, no test, no version log. owners " + count(C, "owner") + " of 4.", "bad");
    }
    if (plan === "r2") {
      api.log("call sorter switched off: the night vet answers every call, " + CALLS + " over " + NIGHTS +
        " September nights, " + (CALLS / NIGHTS) + " a night. the other 3 tools: owners 0 of 3.", "warn");
    }
    if (plan === "r3") {
      api.log("29 September update: " + updateText(C) + ". version 4 found " + VERSIONS[3].found + " of " + URGENT +
        ", version 3 found " + VERSIONS[2].found + "; the clinic stays on version 3.", "ok");
      api.log("the 02:10 words on version 3: " + WORDS[3] + ".", "ok");
    }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a7e07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.R = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        var it = S.C.items[S.C.tool];
        ITEMS.forEach(function (i) { S.ctl[i.id].set(it[i.id]); });
        S.ctl.tool.set(S.C.tool);
        S.ctl.date.set(S.C.date);
        S.ctl.off.set(S.C.off);
        S.sync = false;
      }
      function manual(what) {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
          what += " (reply cleared.)";
        }
        run(api, what);
      }
      S.ctl.inspect = api.control.button("inspect", "inspect", function () { run(api, ""); });
      S.ctl.tool = api.control.select("tool", "AI tool", TOOLS, "sorter", function (val) {
        if (S.sync) return;
        var o = pick(TOOLS, val);
        if (!o) return;
        S.C.tool = String(o.value);
        syncControls();
        manual("tool: " + o.label + ".");
      });
      S.ctl.date = api.control.select("date", "date to inspect", DATES, "3oct", function (val) {
        if (S.sync) return;
        var o = pick(DATES, val);
        if (!o) return;
        S.C.date = String(o.value);
        manual("date: " + o.label + ".");
      });
      ITEMS.forEach(function (i) {
        S.ctl[i.id] = api.control.toggle(i.id, i.label, false, function (on) {
          if (S.sync) return;
          S.C.items[S.C.tool][i.id] = !!on;
          manual(i.label + " for the " + pick(TOOLS, S.C.tool).label + ": " + (on ? "on." : "off."));
        });
      });
      S.ctl.off = api.control.toggle("off", "call sorter switched off", false, function (on) {
        if (S.sync) return;
        S.C.off = !!on;
        manual("call sorter switched off: " + (on ? "yes." : "no."));
      });
      S.ctl.rerun = api.control.button("rerun", "re-run the 02:10 words", function () { rerun(api); });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        if (S.sync) return;
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        S.C = planConfig(String(o.value));
        syncControls();
        run(api, "plan: " + o.label + ".");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        owners: api.stat("owners", "tools with a named owner", "bad"),
        risks: api.stat("risks", "tools with a risk class", ""),
        cards: api.stat("cards", "tools with a model card", ""),
        logs: api.stat("logs", "tools with a version log", "warn"),
        tests: api.stat("tests", "tools tested on our calls before each update", "warn"),
        questions: api.stat("questions", "inspector's questions answered", "bad"),
        live: api.stat("live", "call sorter version live on the date", ""),
        sorted: api.stat("sorted", "what sorted the 02:10 call", "bad"),
        found: api.stat("found", "urgent calls found by that version", "ok"),
        missed: api.stat("missed", "urgent calls it sends to can wait", "bad"),
        update: api.stat("update", "the 29 September update", "warn"),
        calls: api.stat("calls", "calls the night vet answers", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one AI tool in the register and the governance items it has. Choose a tool and a date, switch items on or off, then inspect: the note shows the inspector's three questions and which have an answer.");

      draw(api);
      setStats(api);
      api.log("Thursday 15 October at Corrabeck. Nothing inspected yet: 4 AI tools, a labelled set of 120 calls, 30 urgent.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: nothing inspected.
      t.expect(t.stat("owners") === "-" && t.stat("questions") === "-" &&
        has("Thursday 15 October at Corrabeck. Nothing inspected yet"),
        "Opens on 15 October with nothing inspected");

      // 2. As it was: 0 of 4 owners, 0 of 3 questions, version 4 live on 3 October.
      t.click("inspect");
      t.expect(t.stat("owners") === "0 of 4" && t.stat("cards") === "0 of 4" && t.stat("tests") === "0 of 4" &&
        t.stat("questions") === "0 of 3" && t.stat("live") === "version 4" && t.stat("sorted") === "not recorded" &&
        t.stat("found") === "26 of 30" && t.stat("missed") === 4,
        "As it was: 0 of 4 owners, 0 of 3 answered, version 4 on 3 October finds 26 of 30");

      // 3. Which version was live on each date.
      t.set("date", "19feb"); var a = t.stat("live");
      t.set("date", "6jun"); var b = t.stat("live");
      t.set("date", "1sep"); var c = t.stat("live"); var cf = t.stat("found");
      t.set("date", "29sep"); var d = t.stat("live");
      t.expect(a === "version 1" && b === "version 2" && c === "version 3" && cf === "29 of 30" && d === "version 4",
        "Versions on 19 February, 6 June, 1 September (29 of 30) and 29 September");

      // 4. A version log answers the 02:10 question.
      t.set("date", "3oct");
      t.set("log", true);
      t.expect(t.stat("sorted") === "version 4: can wait" && t.stat("questions") === "1 of 3" && t.stat("logs") === "1 of 4",
        "With the version log, the 02:10 call reads version 4: can wait");

      // 5. A labelled test with no owner blocks nothing.
      t.set("test", true);
      t.expect(t.stat("update") === "went live: no owner to run the test" && t.stat("live") === "version 4",
        "A test with nobody named to run it: the 29 September update still goes live");

      // 6. Owner plus test: change control blocks the 29 September update.
      t.set("owner", true);
      t.expect(t.stat("update") === "blocked: 26 of 30, below 29" && t.stat("live") === "version 3" &&
        t.stat("sorted") === "version 3: come in now" && t.stat("found") === "29 of 30" && t.stat("missed") === 1 &&
        t.stat("questions") === "3 of 3" && t.stat("owners") === "1 of 4",
        "Change control: update blocked, version 3 live, the 02:10 words come in now, 3 of 3 answered");

      // 7. Re-running the 02:10 words today.
      t.click("rerun");
      t.expect(has("02:10 words re-run today: version 4: can wait; version 3: come in now. a likely answer, not a record."),
        "Re-run: version 4 can wait, version 3 come in now, a likely answer");

      // 8. Reply 0: the vendor's letter.
      t.set("plan", "r0");
      t.expect(t.stat("questions") === "0 of 3" && t.stat("live") === "version 4" &&
        has("tested on the vendor's own recorded calls") && has("what was it tested on: the vendor's calls only"),
        "Reply 0: the letter answers 0 of 3; version 4 stays");

      // 9. Reply 1 and reply 2.
      t.set("plan", "r1");
      var p1 = t.stat("owners") === "0 of 4" && t.stat("questions") === "0 of 3" && has("AI policy signed by every vet");
      t.set("plan", "r2");
      t.expect(p1 && t.stat("calls") === "30 a night" && t.stat("sorted") === "night vet, by ear" && has("owners 0 of 3"),
        "Reply 1: owners 0 of 4; reply 2: 30 calls a night, other tools unowned");

      // 10. Reply 3: owners, version logs and a test before each update.
      t.set("plan", "r3");
      t.expect(t.stat("owners") === "4 of 4" && t.stat("cards") === "4 of 4" && t.stat("logs") === "4 of 4" &&
        t.stat("tests") === "4 of 4" && t.stat("questions") === "3 of 3" &&
        t.stat("update") === "blocked: 26 of 30, below 29" && t.stat("sorted") === "version 3: come in now",
        "Reply 3: 4 of 4 each, the update blocked, 3 of 3 answered");
    }
  });
})();
