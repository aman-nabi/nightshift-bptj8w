/* sims/a9e06-v1.0.0.js  (published as sims/a9e06.js)
   case a9e06 "the wrong tool": a proof-to-plate comparer for a trophy engraver's shop, from the
   september test of the tidy step to the night of thursday 10 december 2026. no real model runs here:
   every change the tidy step makes is given data, set out below and in sim.lede. widget-style sim: it
   draws its own comparison table in api.root.

   changelog
   v1.0.0 (2026-10-16) first version. controls: moment, where the tidy step sits, model size,
     "never change names" in its instructions, the "90% sure" rule, staff compare, a reply to play,
     reset. stats: moment, where the tidy step sits, lines changed after approval, typos fixed,
     correct names wrongly changed, plates matching the approved proof, re-engraving cost, checking
     time, suggestions shown to the customer, plate 47 reads. selfTest: 12 assertions.

   the given data (stated in sim.lede):
   - the september test, monday 14 september: 200 lines from last year's orders. 185 correct, all
     common spellings; 15 with typos. the tidy step fixed 14; it left "sliver medal" (a real word).
     it changed 0 of the 185 correct lines, a count nobody looked at until 00:20 on friday 11 december.
   - the club's list: 120 lines, one per plate, numbered 1 to 120, approved at 16:02 on monday
     7 december; the tidy step ran at 16:03. 111 lines are correct with common spellings, 6 are correct
     with rare spellings, 3 have typos in the award words. 117 correct in all (111 + 6).
   - rare names (plate, approved spelling, the tidy step's commoner spelling, its sureness score):
     12 Katelynn > Katelyn 92; 29 Zoë > Zoe 97; 47 Kristoffer > Kristopher 94; 63 Rebekah > Rebecca 86;
     88 Jaden > Jayden 83; 105 Leyton > Layton 91.
   - typos (plate, approved, fixed, sureness): 8 butterfy > butterfly 99; 54 freestlye > freestyle 98;
     97 breastsroke > breaststroke 97.
   - a bigger model, given the same list, leaves 12, 63 and 88 alone and still changes 29, 47, 105.
   - with "never change names" added to its instructions, it still changes 29 and 105.
   - with the "90% sure" rule, it changes only what scores 90 or more: all 3 typos and 12, 29, 47, 105.
   - filters combine: a name changes only if every setting that is on still changes it.
   - before the proof, as suggestions with the changed letters highlighted: the secretary accepts the
     3 typo fixes and rejects every name change.
   - staff compare: staff check every line of the plate file against the proof before the machine
     reads it; they put back every changed name and keep the typo fixes.
   - re-engraving costs £8 a plate. checking: staff check each proof before it goes out, 30 seconds a
     line, 60 minutes for 120 lines; a compare of the plate file with the proof takes the same again
     (his own compare, 23:15 to 00:15, took 60 minutes).

   where every number comes from (conventions rule 14; the case is content/latent/a9/a9e06-v1.0.0.json):
   - test: 14 of 15 typos fixed, 0 of 185 correct changed, 14 of 200 lines changed.
   - as it happened: 3 typos + 6 names = 9 of 120 changed; 6 of 117 names wrong; 120 - 9 = 111 of 120
     plates match the proof; 6 x £8 = £48; checking 60 min.
   - bigger model: 3 of 117, 114 of 120, £24. instruction: 2 of 117, 115 of 120, £16.
     90% rule: 4 of 117, 113 of 120, £32.
   - staff compare: 0 of 117, 117 of 120 (3 typo fixes kept), £0, checking 60 + 60 = 120 min.
   - before the proof: 9 suggestions, 3 accepted, 6 rejected; 0 of 117; 120 of 120; £0; 60 min.
   - no tidy step: 3 typos engraved, 3 x £8 = £24; 120 of 120; 0 of 117.
   - cold case (not simulated), given data of the update: 64 plates, 8 suggestions, 6 typo fixes and
     2 names, all accepted in 11 seconds with the accept all button.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var LINES = 120;
  var CORRECT = 117;
  var PRICE = 8;                       // pounds per plate engraved again
  var CHECK_MIN = 60;                  // 30 seconds a line, 120 lines
  var RARE = [
    { plate: 12, proof: "Katelynn", common: "Katelyn", sure: 92 },
    { plate: 29, proof: "Zoë", common: "Zoe", sure: 97 },
    { plate: 47, proof: "Kristoffer", common: "Kristopher", sure: 94 },
    { plate: 63, proof: "Rebekah", common: "Rebecca", sure: 86 },
    { plate: 88, proof: "Jaden", common: "Jayden", sure: 83 },
    { plate: 105, proof: "Leyton", common: "Layton", sure: 91 }
  ];
  var TYPOS = [
    { plate: 8, proof: "butterfy", common: "butterfly", sure: 99 },
    { plate: 54, proof: "freestlye", common: "freestyle", sure: 98 },
    { plate: 97, proof: "breastsroke", common: "breaststroke", sure: 97 }
  ];
  var BIGGER_STILL = [29, 47, 105];
  var RULE_STILL = [29, 105];
  var SURE_LINE = 90;
  var TEST = { lines: 200, typos: 15, fixed: 14, correct: 185, correctChanged: 0, missed: "sliver medal" };

  var MOMENTS = [
    { value: "sep14", label: "monday 14 september: the test on 200 of last year's lines" },
    { value: "dec07", label: "monday 7 december, 16:03: the tidy step runs on the club's 120 approved lines" },
    { value: "dec10", label: "thursday 10 december, 18:00 to 22:40: the machine engraves the plate file" },
    { value: "alert", label: "23:10: the secretary's monday email, reread" },
    { value: "compare", label: "23:15 to 00:15: every line of the plate file against the proof" }
  ];
  var WHERE = [
    { value: "after", label: "after approval, straight into the plate file (as now)" },
    { value: "before", label: "before the proof, as suggestions the customer accepts or rejects" },
    { value: "off", label: "no tidy step" }
  ];
  var MODELS = [
    { value: "standard", label: "the model it runs on" },
    { value: "bigger", label: "a bigger model that has read more names" }
  ];
  var ONOFF = [{ value: "off", label: "off" }, { value: "on", label: "on" }];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: engrave the approved text exactly; tidy-ups before the proof" },
    { value: "r1", label: "reply 1: a bigger model" },
    { value: "r2", label: "reply 2: never change names, in its instructions" },
    { value: "r3", label: "reply 3: staff compare every plate file with its proof" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function has(list, n) { return list.indexOf(n) >= 0; }
  function money(n) { return "£" + n; }
  function defaults() {
    return { moment: "sep14", where: "after", model: "standard", rule: "off", sure: "off", staff: "off", plan: "none" };
  }

  /* ---------- the club's list through the settings (pure: settings in, counts out) ---------- */

  // which rare names would the tidy step change, with these settings?
  function proposedNames(C) {
    return RARE.filter(function (r) {
      if (C.model === "bigger" && !has(BIGGER_STILL, r.plate)) return false;
      if (C.rule === "on" && !has(RULE_STILL, r.plate)) return false;
      if (C.sure === "on" && r.sure < SURE_LINE) return false;
      return true;
    });
  }
  function proposedTypos(C) {
    return TYPOS.filter(function (t) { return !(C.sure === "on" && t.sure < SURE_LINE); });
  }

  function club(C) {
    var names = proposedNames(C), typos = proposedTypos(C);
    var R = { where: C.where, changed: 0, typosFixed: 0, typosEngraved: 0, wrong: [], match: LINES,
      suggested: 0, accepted: 0, rejected: 0, caught: 0, cost: 0, check: CHECK_MIN + (C.staff === "on" ? CHECK_MIN : 0),
      proposed: names.length + typos.length, names: names, typos: typos };
    if (C.where === "off") {
      R.typosEngraved = TYPOS.length;
    } else if (C.where === "before") {
      R.suggested = names.length + typos.length;
      R.accepted = typos.length;
      R.rejected = names.length;
      R.typosFixed = typos.length;
      R.typosEngraved = TYPOS.length - typos.length;
    } else {
      R.changed = names.length + typos.length;
      R.typosFixed = typos.length;
      R.typosEngraved = TYPOS.length - typos.length;
      if (C.staff === "on") {
        R.caught = R.changed;
        R.match = LINES - typos.length;
      } else {
        R.wrong = names;
        R.match = LINES - R.changed;
      }
    }
    R.cost = (R.wrong.length + R.typosEngraved) * PRICE;
    R.p47 = "Kristoffer";
    R.wrong.forEach(function (r) { if (r.plate === 47) R.p47 = r.common; });
    return R;
  }

  function wrongList(R) {
    return R.wrong.map(function (r) { return r.proof + " to " + r.common; }).join(", ");
  }

  /* ---------- the widget: the lines that differ, proof against plate ---------- */

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
    cells.forEach(function (c) {
      ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr);
    });
  }

  function plateOf(C, item, isName) {
    var R = club(C);
    if (C.where === "off") return item.proof;
    var inSet = isName ? has(R.names, item) : has(R.typos, item);
    if (!inSet) return item.proof;
    if (C.where === "before") return isName ? item.proof : item.common;
    if (C.staff === "on" && isName) return item.proof;
    return item.common;
  }

  function draw(api) {
    var C = api.state.C;
    var ui = api.state.ui;
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    if (C.moment === "sep14") {
      ui.head.textContent = "the september test: 200 lines from last year's orders, run through the tidy step on its own.";
      row(ui, ["lines", "how many", "changed by the tidy step"], true);
      row(ui, ["with a typo", TEST.typos, TEST.fixed + " fixed; missed: " + TEST.missed], false);
      row(ui, ["correct", TEST.correct, TEST.correctChanged + " changed (not counted in september)"], false);
      ui.note.textContent = "only the typo lines were counted: " + TEST.fixed + " of " + TEST.typos + ".";
      return;
    }
    var R = club(C);
    ui.head.textContent = "the club's 120 lines: the 9 that matter, the approved proof against what the plate says. the other 111 are the same in every setting.";
    row(ui, ["plate", "approved proof", "plate reads", "sureness", "kind"], true);
    TYPOS.forEach(function (t) { row(ui, [t.plate, t.proof, plateOf(C, t, false), t.sure + "%", "typo"], false); });
    RARE.forEach(function (r) { row(ui, [r.plate, r.proof, plateOf(C, r, true), r.sure + "%", "correct name"], false); });
    var lines = ["where: " + pick(WHERE, C.where).label + "."];
    if (C.where === "before") lines.push("suggestions shown, changed letters highlighted: " + R.suggested + "; accepted " + R.accepted + ", rejected " + R.rejected + ".");
    if (C.where === "after" && C.staff === "on") lines.push("staff compare caught " + R.caught + " differences before engraving.");
    if (R.wrong.length) lines.push("names wrongly changed: " + wrongList(R) + ".");
    ui.note.textContent = lines.join("\n");
  }

  function setStats(api) {
    var C = api.state.C;
    var st = api.state.stat;
    st.moment(pick(MOMENTS, C.moment).label);
    if (C.moment === "sep14") {
      st.where("on its own, in a test");
      st.changed(TEST.fixed + " of " + TEST.lines);
      st.typos(TEST.fixed + " of " + TEST.typos);
      st.names(TEST.correctChanged + " of " + TEST.correct);
      st.match("no plates yet");
      st.cost(money(0));
      st.check(CHECK_MIN + " min");
      st.suggest("none");
      st.p47("not ordered yet");
      return;
    }
    var R = club(C);
    st.where(pick(WHERE, C.where).label);
    st.changed(R.changed + " of " + LINES);
    st.typos(R.typosFixed + " of " + TYPOS.length);
    st.names(R.wrong.length + " of " + CORRECT);
    st.match(R.match + " of " + LINES);
    st.cost(money(R.cost));
    st.check(R.check + " min");
    st.suggest(C.where === "before" ? R.suggested + " shown: " + R.accepted + " accepted, " + R.rejected + " rejected" : "none");
    st.p47(R.p47);
  }

  function refresh(api) { draw(api); setStats(api); }

  // one line for the moment the control lands on
  function moment(api) {
    var C = api.state.C;
    var R = club(C);
    var t = C.moment;
    if (t === "sep14") api.log("monday 14 september. the test: " + TEST.lines + " lines, " + TEST.typos + " with typos. fixed " + TEST.fixed +
      " of " + TEST.typos + "; it left '" + TEST.missed + "', a real word. correct lines changed: " + TEST.correctChanged + " of " + TEST.correct + ", a count nobody looked at.", "");
    if (t === "dec07") api.log("monday 7 december, 16:02: the secretary approves the proof of 120 lines. 16:03: the tidy step runs and saves the plate file. lines changed after approval: " +
      R.changed + " of " + LINES + ". nobody sees the file.", R.changed ? "warn" : "");
    if (t === "dec10") api.log("thursday 10 december, 18:00 to 22:40: the machine reads the plate file and engraves 120 of 120 plates as in the file.", "");
    if (t === "alert") api.log("23:10: the secretary's monday email, reread: please double-check Kristoffer, everyone gets it wrong. plate 47 reads " + R.p47 +
      "; the proof says Kristoffer.", R.p47 === "Kristoffer" ? "ok" : "bad");
    if (t === "compare") {
      api.log("23:15 to 00:15: all 120 lines compared with the proof. " + (LINES - R.match) + " differ: " + R.typosFixed + " typos fixed and " +
        R.wrong.length + " correct names changed" + (R.wrong.length ? " (" + wrongList(R) + ")" : "") + ".", R.wrong.length ? "bad" : "ok");
      api.log("correct names wrongly changed: " + R.wrong.length + " of " + CORRECT + ". to cut again: " + R.wrong.length + " × " + money(PRICE) + " = " + money(R.wrong.length * PRICE) + ".", R.wrong.length ? "bad" : "ok");
    }
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    C.moment = "compare";
    if (plan === "r0") C.where = "before";
    if (plan === "r1") C.model = "bigger";
    if (plan === "r2") C.rule = "on";
    if (plan === "r3") C.staff = "on";
    return C;
  }

  function planFollowUp(api, plan) {
    var R = club(api.state.C);
    if (plan === "r0") api.log("the club's list replayed: " + R.suggested + " suggestions with the changed letters highlighted; the secretary accepts " + R.accepted +
      " and rejects " + R.rejected + ". the machine cuts the approved text exactly: " + R.match + " of " + LINES + " plates match the proof, " +
      R.wrong.length + " of " + CORRECT + " names wrong, " + money(R.cost) + " to cut again, checking " + R.check + " min.", "ok");
    if (plan === "r1") api.log("the club's list replayed with a bigger model: it left Katelynn, Rebekah and Jaden alone and still changed " + wrongList(R) + ". " +
      R.wrong.length + " of " + CORRECT + " names wrong, " + R.match + " of " + LINES + " plates match, " + money(R.cost) + ". still silent.", "bad");
    if (plan === "r2") api.log("the club's list replayed with never change names in its instructions: typos fixed " + R.typosFixed + " of 3, and it still changed " +
      wrongList(R) + ". " + R.wrong.length + " of " + CORRECT + " names wrong, " + R.match + " of " + LINES + " plates match, " + money(R.cost) + ". instructions are not guarantees.", "bad");
    if (plan === "r3") api.log("the club's list replayed with staff compare: " + R.caught + " differences caught before engraving, the 6 names put back, the 3 typo fixes kept. " +
      R.wrong.length + " of " + CORRECT + " names wrong, " + R.match + " of " + LINES + " plates match, " + money(R.cost) + ". checking: " + R.check + " min, up from " + CHECK_MIN + ".", "warn");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a9e06", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.moment.set(S.C.moment);
        S.ctl.where.set(S.C.where);
        S.ctl.model.set(S.C.model);
        S.ctl.rule.set(S.C.rule);
        S.ctl.sure.set(S.C.sure);
        S.ctl.staff.set(S.C.staff);
        S.sync = false;
      }
      function clearPlan() {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
        }
      }
      // a setting changed: log the counts as they were before the change, then after
      function changed(name, label) {
        var before = S.C.moment === "sep14" ? null : club(S.C);
        return function (after) {
          if (S.C.moment === "sep14") {
            api.log(name + ": " + label + ". the september test is the same in every setting; step the moment to the club's list.", "");
            return;
          }
          api.log(name + ": " + label + ". before: names wrongly changed " + before.wrong.length + " of " + CORRECT + ", plates matching " + before.match + " of " + LINES +
            ", " + money(before.cost) + ". now: " + after.wrong.length + " of " + CORRECT + ", " + after.match + " of " + LINES + ", " + money(after.cost) +
            ", checking " + after.check + " min.", after.wrong.length > before.wrong.length ? "bad" : "");
        };
      }
      function settingControl(id, label, list, key) {
        S.ctl[id] = api.control.select(id, label, list, S.C[key], function (val) {
          if (S.sync) return;
          var o = pick(list, val);
          if (!o) return;
          var report = changed(label, o.label);
          clearPlan();
          S.C[key] = String(o.value);
          refresh(api);
          report(club(S.C));
        });
      }
      S.ctl.moment = api.control.select("moment", "moment", MOMENTS, "sep14", function (val) {
        if (S.sync) return;
        var o = pick(MOMENTS, val);
        if (!o) return;
        clearPlan();
        S.C.moment = String(o.value);
        refresh(api);
        moment(api);
      });
      settingControl("where", "where the tidy step sits", WHERE, "where");
      settingControl("model", "model size", MODELS, "model");
      settingControl("rule", "never change names, in its instructions", ONOFF, "rule");
      settingControl("sure", "the 90% sure rule", ONOFF, "sure");
      settingControl("staff", "staff compare every plate file with its proof", ONOFF, "staff");
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        if (S.sync) return;
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        S.C = planConfig(String(o.value));
        syncControls();
        refresh(api);
        api.log("reply: " + o.label + ".", "");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        moment: api.stat("moment", "moment", ""),
        where: api.stat("where", "where the tidy step sits", ""),
        changed: api.stat("changed", "lines changed after approval", "warn"),
        typos: api.stat("typos", "typos fixed", "ok"),
        names: api.stat("names", "correct names wrongly changed", "bad"),
        match: api.stat("match", "plates matching the approved proof", "ok"),
        cost: api.stat("cost", "re-engraving at £8 a plate", "bad"),
        check: api.stat("check", "staff checking time, per 120 lines", ""),
        suggest: api.stat("suggest", "suggestions shown to the customer", ""),
        p47: api.stat("p47", "plate 47 reads", "")
      };

      api.info("how to read it. each row of the table is one plate line that matters: the approved proof's words, what the plate says with these settings, the tidy step's sureness score for its change, and whether the line was a typo or a correct name. the stats count over the club's 120 lines: lines changed after approval, typos fixed, correct names wrongly changed (of 117), plates that match the proof, the cost of cutting plates again, and the staff time spent checking.");

      refresh(api);
      api.log("september, before the tidy step goes live: the test sheet is on the bench.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. opening state: the september test, only the typos counted.
      t.expect(t.stat("typos") === "14 of 15" && t.stat("names") === "0 of 185" && t.stat("changed") === "14 of 200" &&
        t.stat("p47") === "not ordered yet" && has("before the tidy step goes live"),
        "Opens on the September test: 14 of 15 typos fixed, 0 of 185 correct lines changed");

      // 2. monday 16:03: the tidy step changes 9 of 120 lines after approval.
      t.set("moment", "dec07");
      t.expect(t.stat("changed") === "9 of 120" && has("lines changed after approval: 9 of 120"),
        "Monday 7 December, 16:03: 9 of 120 lines changed after approval");

      // 3. 23:10: plate 47 reads Kristopher.
      t.set("moment", "alert");
      t.expect(t.stat("p47") === "Kristopher" && has("please double-check Kristoffer, everyone gets it wrong"),
        "23:10: plate 47 reads Kristopher; the proof says Kristoffer");

      // 4. the comparison: 6 of 117, £48, 111 of 120.
      t.set("moment", "compare");
      t.expect(t.stat("names") === "6 of 117" && t.stat("cost") === "£48" && t.stat("match") === "111 of 120" &&
        t.stat("typos") === "3 of 3" && has("6 × £8 = £48") && has("Kristoffer to Kristopher") && t.stat("check") === "60 min",
        "The compare: 3 typos fixed, 6 of 117 names changed, 111 of 120 match, £48");

      // 5. the tidy step before the proof: 120 of 120.
      t.set("where", "before");
      t.expect(t.stat("match") === "120 of 120" && t.stat("names") === "0 of 117" && t.stat("cost") === "£0" &&
        t.stat("suggest") === "9 shown: 3 accepted, 6 rejected" && t.stat("p47") === "Kristoffer",
        "Before the proof as suggestions: 120 of 120 match, 0 names wrong");

      // 6. no tidy step: the 3 typos are engraved.
      t.set("where", "off");
      t.expect(t.stat("cost") === "£24" && t.stat("typos") === "0 of 3" && t.stat("match") === "120 of 120",
        "No tidy step: 3 typos engraved, £24");

      // 7. bigger model, after approval: 3 of 117.
      t.set("where", "after");
      t.set("model", "bigger");
      t.expect(t.stat("names") === "3 of 117" && t.stat("match") === "114 of 120" && t.stat("cost") === "£24",
        "A bigger model still changes 3 of 117 names");

      // 8. never change names in its instructions: 2 of 117 still changed.
      t.set("model", "standard");
      t.set("rule", "on");
      t.expect(t.stat("names") === "2 of 117" && t.stat("cost") === "£16" && t.stat("typos") === "3 of 3",
        "The instruction leaves 2 of 117 silent name changes");

      // 9. the 90% sure rule: 4 of 117 still changed.
      t.set("rule", "off");
      t.set("sure", "on");
      t.expect(t.stat("names") === "4 of 117" && t.stat("match") === "113 of 120" && t.stat("cost") === "£32",
        "The 90% sure rule leaves 4 of 117 silent name changes");

      // 10. reply 0: approved text exactly, tidy-ups before the proof.
      t.set("plan", "r0");
      t.expect(t.stat("match") === "120 of 120" && t.stat("names") === "0 of 117" && t.stat("check") === "60 min" &&
        has("the secretary accepts 3 and rejects 6"), "Reply 0: 120 of 120 match, checking stays 60 min");

      // 11. replies 1 and 2 still leave silent changes.
      t.set("plan", "r1");
      var r1 = t.stat("names") === "3 of 117" && has("still silent");
      t.set("plan", "r2");
      t.expect(r1 && t.stat("names") === "2 of 117" && has("instructions are not guarantees"),
        "Reply 1 leaves 3 of 117, reply 2 leaves 2 of 117");

      // 12. reply 3: staff compare catches all six, at double the checking.
      t.set("plan", "r3");
      t.expect(t.stat("names") === "0 of 117" && t.stat("check") === "120 min" && t.stat("match") === "117 of 120" &&
        has("9 differences caught"), "Reply 3: all 6 caught, checking 120 min, up from 60");
    }
  });
})();
