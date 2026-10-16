/* sims/a9e04-v1.0.0.js  (published as sims/a9e04.js)
   Case a9e04 "The Customer Round": a per-100 trade-off table for an art-supplies shop's website
   assistant, from the weekly hand check on Monday 16 November 2026 to the meeting with the owner at
   09:30 on Friday 20 November. No real model runs here: every answer is given data, set out below and
   in sim.lede. Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: moment, what happens with no safety sheet, sheets on
     file, model size, a reply to play, reset. Stats: moment, the rule with no sheet, right at once,
     wrong, waiting for a colleague, shown the box's words at once, sent to the shop, the dashboard's
     "answered at once", products covered, question 84's reply, her check's top line, the decision in
     writing. selfTest: 12 assertions.

   The given data (stated in sim.lede):
   - 3,000 products; safety sheets on file for 2,100, none for 900. One set of 100 safety questions,
     split the way every weekly check splits them and numbered as rows of her table (sheet questions
     first, not by time): each question stands for 30 products
     (3,000 / 100), so questions 1 to 70 have a sheet (2,100 / 30) and 71 to 100 have none (900 / 30).
   - With a sheet: right at once, except questions 23 and 51 (sheets for an older version of the
     product): 68 right, 2 wrong. A sheet added later is the maker's current one, so it answers right.
   - Every 300 sheets added moves 10 questions into the sheet group: 2,400 sheets covers 1 to 80,
     2,700 covers 1 to 90, 3,000 covers 1 to 100.
   - With no sheet and the guess (from the product's name and similar products), the standard model
     is right on 71, 74, 77, 79, 82, 85, 88, 90, 92, 95, 97, 99 (12 of 30) and wrong on the other 18.
     A bigger model, tried on the same 30, is right on 15: those 12 plus 73, 81, 94.
   - Question 84 is the modelling-clay set: no sheet; the guess says "non-toxic and safe for your
     2-year-old"; the box says "not suitable for children under 3 years: small parts".
   - The dashboard's "answered at once" counts every reply that is not "i'm not sure" and not
     "please ask in the shop".

   Where every number comes from (conventions rule 14; the case is content/latent/a9/a9e04-v1.0.0.json):
   - The old rule (wait): right at once 68, wrong 2, waiting 30; dashboard 70 of 100.
   - Always answer (guess): right 68 + 12 = 80, wrong 2 + 18 = 20, waiting 0; dashboard 100 of 100.
   - Bigger model guessing: 68 + 15 = 83 right, 2 + 15 = 17 wrong.
   - The middle (box's own words at once, a colleague confirms by tomorrow): 68 right at once, 2 wrong,
     30 shown the box's words at once and waiting for the confirmation; dashboard 100 of 100;
     3,000 of 3,000 covered.
   - Take out the 900: 68 right, 2 wrong, 30 sent to the shop; dashboard 70 of 100; 2,100 of 3,000.
   - Sheets for all 3,000: 98 right at once, 2 wrong, 0 waiting in every row.
   - Cold case, 2,700 sheets, the middle: 88 right at once, 2 wrong, 10 waiting.
   - Her check on Thursday 19 November at 20:40: right at once 80, up from 68; 18 not confirmed yet.
     At 21:30 question 84 is one of the 18. By 22:30 the other 17 boxes are photographed: wrong 20.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var PRODUCTS = 3000;
  var SET = 100;
  var PER_Q = 30;                      // products per question: 3,000 / 100
  var OLD_SHEETS_WRONG = [23, 51];
  var GUESS_RIGHT = {
    standard: [71, 74, 77, 79, 82, 85, 88, 90, 92, 95, 97, 99],
    bigger: [71, 73, 74, 77, 79, 81, 82, 85, 88, 90, 92, 94, 95, 97, 99]
  };
  var CLAY = 84;
  var CLAY_GUESS = "yes, it's non-toxic and safe for your 2-year-old";
  var BOX_WORDS = "not suitable for children under 3 years: small parts";

  var MOMENTS = [
    { value: "mon16", label: "monday 16 november: my weekly check of 9 to 15 november" },
    { value: "tue17", label: "tuesday 17 november: the customer meeting" },
    { value: "wed18", label: "wednesday 18 november, 18:00: the old rule off" },
    { value: "thu2040", label: "thursday 19 november, 20:40: my check of the first 100 since" },
    { value: "thu2130", label: "thursday, 21:30: the parent's email" },
    { value: "thu2230", label: "thursday, 22:30: the other 17 boxes photographed" },
    { value: "fri0930", label: "friday 20 november, 09:30: the meeting" }
  ];
  var MODES = [
    { value: "story", label: "as it happened: the old rule until 18:00 wednesday, then guess" },
    { value: "wait", label: "wait: i'm not sure, a colleague replies by tomorrow (the old rule)" },
    { value: "guess", label: "guess: answer from the name and similar products" },
    { value: "middle", label: "the middle: the box's own words now, a colleague confirms by tomorrow" },
    { value: "remove", label: "remove: products with no sheet taken out (please ask in the shop)" }
  ];
  var SHEETS = [
    { value: "2100", label: "2,100 of 3,000 (now)" },
    { value: "2400", label: "2,400 of 3,000" },
    { value: "2700", label: "2,700 of 3,000" },
    { value: "3000", label: "3,000 of 3,000" }
  ];
  var MODELS = [
    { value: "standard", label: "the model it runs on" },
    { value: "bigger", label: "a bigger model" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: leave it answering all" },
    { value: "r1", label: "reply 1: per-100 table, three choices, recommend the middle" },
    { value: "r2", label: "reply 2: the old rule back on without a word" },
    { value: "r3", label: "reply 3: take the 900 out of the assistant" }
  ];
  var DECISIONS = {
    none: "none written",
    r0: "none written: left answering all",
    r1: "the middle, agreed in writing friday 20 november; makers of the 900 asked for sheets; review the table each month",
    r2: "none written: switched back without a word",
    r3: "none written: the 900 taken out"
  };

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function idx(v) { for (var i = 0; i < MOMENTS.length; i++) if (MOMENTS[i].value === v) return i; return -1; }
  function has(list, n) { return list.indexOf(n) >= 0; }
  function comma(n) { var s = String(n); return s.length > 3 ? s.slice(0, s.length - 3) + "," + s.slice(s.length - 3) : s; }
  function of100(n) { return n + " of " + SET; }
  function defaults() {
    return { moment: "mon16", mode: "story", sheets: "2100", model: "standard", plan: "none" };
  }

  /* ---------- one set of 100 safety questions (pure: settings in, counts out) ---------- */

  function week(C) {
    var mi = idx(C.moment);
    var mode = C.mode === "story" ? (mi >= idx("wed18") ? "guess" : "wait") : C.mode;
    var withSheet = Number(C.sheets) / PER_Q;
    var R = { mode: mode, right: 0, wrong: 0, waiting: 0, boxNow: 0, shop: 0, answered: 0, gRight: 0, gWrong: 0, noSheet: 0 };
    for (var q = 1; q <= SET; q++) {
      if (q <= withSheet) {
        R.answered += 1;
        if (has(OLD_SHEETS_WRONG, q)) R.wrong += 1; else R.right += 1;
        continue;
      }
      R.noSheet += 1;
      if (mode === "wait") { R.waiting += 1; }
      else if (mode === "guess") {
        R.answered += 1;
        if (has(GUESS_RIGHT[C.model], q)) { R.right += 1; R.gRight += 1; } else { R.wrong += 1; R.gWrong += 1; }
      } else if (mode === "middle") { R.answered += 1; R.boxNow += 1; R.waiting += 1; }
      else { R.shop += 1; }
    }
    R.covered = mode === "remove" ? Number(C.sheets) : PRODUCTS;
    if (CLAY <= withSheet) R.clay = "answered from its safety sheet: " + BOX_WORDS;
    else if (mode === "wait") R.clay = "i'm not sure; a colleague will reply by tomorrow";
    else if (mode === "guess") R.clay = has(GUESS_RIGHT[C.model], CLAY) ? "a guess that happens to be right" : CLAY_GUESS;
    else if (mode === "middle") R.clay = "no safety sheet on file; on the box: " + BOX_WORDS + "; a colleague confirms by tomorrow";
    else R.clay = "please ask in the shop";
    R.ruleText = pick(MODES, mode).label;
    return R;
  }

  // Her check's top line. In the story it follows the night; otherwise it reads the counts.
  function checkLine(C, R) {
    var mi = idx(C.moment);
    if (C.mode === "story" && C.plan === "none" && C.sheets === "2100" && C.model === "standard") {
      if (mi < idx("thu2040")) return "right at once: 68, wrong: 2, sent to staff: 30";
      if (mi === idx("thu2040")) return "right at once: " + R.right + ", up from 68; " + R.gWrong + " not confirmed yet";
      if (mi === idx("thu2130")) return "right at once: " + R.right + ", up from 68; question 84 wrong; " + (R.gWrong - 1) + " not confirmed yet";
      return "right at once: " + R.right + ", wrong: " + R.wrong + ", up from 2";
    }
    return "right at once: " + R.right + ", wrong: " + R.wrong;
  }

  /* ---------- the widget: the per-100 table, one row per choice ---------- */

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
  function row(ui, cells, th, strong) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) {
      ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;" + (strong ? "font-weight:700;" : ""), String(c), tr);
    });
  }

  function draw(api) {
    var C = api.state.C;
    var R = week(C);
    var ui = api.state.ui;
    ui.head.textContent = "per 100 safety questions, with " + comma(Number(C.sheets)) + " of 3,000 sheets on file and " +
      pick(MODELS, C.model).label + ". the row in bold is the one running now.";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["with no sheet", "right at once", "wrong", "waiting for a colleague", "box's words at once", "ask in the shop", "answered at once", "products covered"], true, false);
    ["wait", "guess", "middle", "remove"].forEach(function (m) {
      var W = week({ moment: C.moment, mode: m, sheets: C.sheets, model: C.model, plan: "none" });
      row(ui, [pick(MODES, m).label, W.right, W.wrong, W.waiting, W.boxNow, W.shop, W.answered, comma(W.covered) + " of 3,000"], false, m === R.mode);
    });
    ui.note.textContent = "question 84, the modelling-clay set: " + R.clay + ".\nher check: " + checkLine(C, R) + ".";
  }

  function setStats(api) {
    var C = api.state.C;
    var R = week(C);
    var st = api.state.stat;
    st.moment(pick(MOMENTS, C.moment).label);
    st.rule(R.ruleText);
    st.right(of100(R.right));
    st.wrong(of100(R.wrong));
    st.waiting(of100(R.waiting));
    st.boxNow(of100(R.boxNow));
    st.shop(of100(R.shop));
    st.dash(of100(R.answered));
    st.covered(comma(R.covered) + " of 3,000");
    st.clay(R.clay);
    st.check(checkLine(C, R));
    st.decision(DECISIONS[C.plan]);
  }

  function refresh(api) { draw(api); setStats(api); }

  // One line for the moment the control lands on; "before" is the state just before it.
  function moment(api, before) {
    var C = api.state.C;
    var R = week(C);
    var t = C.moment;
    if (t === "mon16") api.log("monday 16 november. my weekly check of the first 100 safety questions of 9 to 15 november: right at once " +
      R.right + ", wrong " + R.wrong + ", sent to staff " + R.waiting + ", all right the next day.", "");
    if (t === "tue17") api.log("tuesday 17 november, the customer meeting. the owner: 30 in every 100 say i'm not sure; it makes us look clueless; make it answer everything. i said: it will be less accurate. no numbers, no other choices.", "warn");
    if (t === "wed18") api.log("wednesday 18 november, 18:00. the old rule switched off. before: " + before.waiting +
      " of 100 sent to staff. now: " + R.waiting + " sent to staff, and the " + R.noSheet + " with no sheet get an answer at once.", "warn");
    if (t === "thu2040") api.log("thursday 19 november, 20:40. my check of the first 100 since 18:00 wednesday (the 100th came in at 15:40): " +
      checkLine(C, R) + ". dashboard: answered at once " + of100(R.answered) + ".", "");
    if (t === "thu2130") api.log("21:30. the owner forwards a parent's email with a photo of the box. question 84, a modelling-clay set, asked at 20:14 wednesday: '" +
      R.clay + "'. the box: '" + BOX_WORDS + "'.", "bad");
    if (t === "thu2230") api.log("22:30. the owner has photographed the other 17 boxes. of the " + R.noSheet + " with no sheet: " + R.gRight +
      " right, " + R.gWrong + " wrong. wrong in all: " + (R.wrong - R.gWrong) + " + " + R.gWrong + " = " + of100(R.wrong) + ".", "bad");
    if (t === "fri0930") api.log("friday 20 november, 09:30. the meeting with the owner. right at once " + of100(R.right) + ", wrong " + of100(R.wrong) + ".", "");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    C.moment = "fri0930";
    if (plan === "r0") C.mode = "guess";
    if (plan === "r1") C.mode = "middle";
    if (plan === "r2") C.mode = "wait";
    if (plan === "r3") C.mode = "remove";
    return C;
  }

  function planFollowUp(api, plan) {
    var R = week(api.state.C);
    var base = { moment: "fri0930", sheets: "2100", model: "standard", plan: "none" };
    function as(m) { base.mode = m; return week(base); }
    var W = as("wait"), G = as("guess"), M = as("middle");
    if (plan === "r0") api.log("left answering all. monday 23 november, check of the first 100 since friday: right at once " +
      of100(G.right) + ", wrong " + of100(G.wrong) + ", " + G.gWrong + " of them with no sheet.", "bad");
    if (plan === "r1") {
      api.log("09:30, the per-100 table, three rows. wait: " + W.right + " right at once, " + W.wrong + " wrong, " + W.waiting +
        " wait a day. always answer: " + G.right + ", " + G.wrong + ", " + G.waiting + " wait. the middle: " + M.right + ", " + M.wrong +
        ", and " + M.boxNow + " get the box's words at once, confirmed by tomorrow.", "");
      api.log("she picks the middle. live at 12:00; dashboard: answered at once " + of100(R.answered) + ". 13:00: the decision in writing, the makers of the 900 asked for sheets.", "ok");
    }
    if (plan === "r2") api.log("23:10 thursday: the old rule back on, no word to the owner. friday's dashboard: answered at once " + of100(W.answered) +
      ". tuesday 24 november, 10:00: another engineer switches it off again: right at once " + of100(G.right) + ", wrong " + of100(G.wrong) + ".", "bad");
    if (plan === "r3") api.log("friday 12:00: the 900 with no sheet taken out. products covered: " + comma(R.covered) + " of 3,000. per 100: right at once " +
      R.right + ", wrong " + R.wrong + ", please ask in the shop " + R.shop + ". dashboard: answered at once " + of100(R.answered) + ".", "warn");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a9e04", {
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
        S.ctl.mode.set(S.C.mode);
        S.ctl.sheets.set(S.C.sheets);
        S.ctl.model.set(S.C.model);
        S.sync = false;
      }
      function clearPlan() {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
        }
      }
      S.ctl.moment = api.control.select("moment", "moment", MOMENTS, "mon16", function (val) {
        if (S.sync) return;
        var o = pick(MOMENTS, val);
        if (!o) return;
        var before = week(S.C);
        clearPlan();
        S.C.moment = String(o.value);
        refresh(api);
        moment(api, before);
      });
      S.ctl.mode = api.control.select("mode", "with no safety sheet", MODES, "story", function (val) {
        if (S.sync) return;
        var o = pick(MODES, val);
        if (!o) return;
        var before = week(S.C);
        clearPlan();
        S.C.mode = String(o.value);
        refresh(api);
        var R = week(S.C);
        api.log("with no sheet: " + o.label + ". before: right at once " + before.right + ", wrong " + before.wrong + ". now: right at once " +
          R.right + ", wrong " + R.wrong + ", waiting " + R.waiting + ", products covered " + comma(R.covered) + " of 3,000.", R.wrong > before.wrong ? "bad" : "");
      });
      S.ctl.sheets = api.control.select("sheets", "safety sheets on file", SHEETS, "2100", function (val) {
        if (S.sync) return;
        var o = pick(SHEETS, val);
        if (!o) return;
        var before = week(S.C);
        clearPlan();
        S.C.sheets = String(o.value);
        refresh(api);
        var R = week(S.C);
        api.log("sheets on file: " + o.label + ". questions with a sheet: " + (SET - before.noSheet) + " before, " + (SET - R.noSheet) +
          " now. right at once " + R.right + ", wrong " + R.wrong + ", waiting " + R.waiting + ".", "");
      });
      S.ctl.model = api.control.select("model", "model size", MODELS, "standard", function (val) {
        if (S.sync) return;
        var o = pick(MODELS, val);
        if (!o) return;
        clearPlan();
        S.C.model = String(o.value);
        refresh(api);
        var R = week(S.C);
        api.log("model: " + o.label + ". " + (R.mode === "guess" ? "of the " + R.noSheet + " with no sheet: " + R.gRight + " right, " + R.gWrong +
          " wrong. still a guess: there is no sheet to read." : "nothing changes: with a sheet it reads the sheet, and this rule never guesses."), "");
      });
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
        rule: api.stat("rule", "with no sheet", ""),
        right: api.stat("right", "right at once, per 100", "ok"),
        wrong: api.stat("wrong", "wrong, per 100", "bad"),
        waiting: api.stat("waiting", "waiting for a colleague, per 100", "warn"),
        boxNow: api.stat("boxNow", "shown the box's words at once, per 100", ""),
        shop: api.stat("shop", "told to ask in the shop, per 100", ""),
        dash: api.stat("dash", "dashboard: answered at once", ""),
        covered: api.stat("covered", "products covered", ""),
        clay: api.stat("clay", "question 84's reply", ""),
        check: api.stat("check", "her check's top line", ""),
        decision: api.stat("decision", "the decision in writing", "")
      };

      api.info("how to read it. each row of the table is one thing the assistant can do with a safety question when the product has no safety sheet, counted over the same 100 questions: right at once, wrong, waiting for a colleague's answer by tomorrow, shown the box's own words at once, told to ask in the shop, the owner's dashboard count of answers given at once, and products the assistant still covers. questions with a sheet are answered from it in every row.");

      refresh(api);
      api.log("monday 16 november, before the meeting and before the old rule changed. the weekly check is on the table.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: the old rule, Monday 16 November's check.
      t.expect(t.stat("right") === "68 of 100" && t.stat("wrong") === "2 of 100" && t.stat("waiting") === "30 of 100" &&
        t.stat("dash") === "70 of 100" && t.stat("covered") === "3,000 of 3,000" &&
        t.stat("check") === "right at once: 68, wrong: 2, sent to staff: 30" && has("before the old rule changed"),
        "Opens on Monday 16 November: 68 right at once, 2 wrong, 30 sent to staff");

      // 2. 18:00 Wednesday: the old rule off; the 30 now get an answer at once.
      t.set("moment", "wed18");
      t.expect(has("before: 30 of 100 sent to staff") && t.stat("waiting") === "0 of 100" && t.stat("dash") === "100 of 100",
        "18:00 Wednesday: 30 sent to staff before, 0 after; answered at once 100 of 100");

      // 3. 20:40 Thursday: her check's top line, 18 not yet confirmed.
      t.set("moment", "thu2040");
      t.expect(t.stat("check") === "right at once: 80, up from 68; 18 not confirmed yet" && t.stat("right") === "80 of 100",
        "20:40 Thursday: right at once 80, up from 68; 18 not confirmed yet");

      // 4. 21:30: the parent's email; question 84's guess.
      t.set("moment", "thu2130");
      t.expect(t.stat("clay") === "yes, it's non-toxic and safe for your 2-year-old" && has("not suitable for children under 3 years: small parts"),
        "21:30: question 84 was told the clay set is safe for a 2-year-old; the box says under 3s");

      // 5. 22:30: the 30 without a sheet split 12 right, 18 wrong; wrong 2 + 18 = 20.
      t.set("moment", "thu2230");
      t.expect(has("12 right, 18 wrong") && has("2 + 18 = 20 of 100") && t.stat("wrong") === "20 of 100" &&
        t.stat("check") === "right at once: 80, wrong: 20, up from 2", "22:30: 12 right and 18 wrong; wrong 20 of 100");

      // 6. The middle row: the box's own words at once, a colleague confirms by tomorrow.
      t.set("mode", "middle");
      t.expect(t.stat("right") === "68 of 100" && t.stat("wrong") === "2 of 100" && t.stat("waiting") === "30 of 100" &&
        t.stat("boxNow") === "30 of 100" && t.stat("dash") === "100 of 100" && t.stat("covered") === "3,000 of 3,000",
        "The middle: 68 right at once, 2 wrong, 30 shown the box's words at once; 100 of 100 answered at once");

      // 7. Remove the 900: 2,100 of 3,000 covered.
      t.set("mode", "remove");
      t.expect(t.stat("covered") === "2,100 of 3,000" && t.stat("shop") === "30 of 100" && t.stat("dash") === "70 of 100" &&
        t.stat("wrong") === "2 of 100", "Take out the 900: 2,100 of 3,000 covered, 30 told to ask in the shop");

      // 8. A bigger model still guesses: 83 right, 17 wrong.
      t.set("mode", "guess");
      t.set("model", "bigger");
      t.expect(t.stat("right") === "83 of 100" && t.stat("wrong") === "17 of 100" && has("15 right, 15 wrong"),
        "A bigger model guessing: 15 of 30 right, so 83 right and 17 wrong");

      // 9. Sheets for all 3,000: nothing left to guess.
      t.set("model", "standard");
      t.set("sheets", "3000");
      t.expect(t.stat("right") === "98 of 100" && t.stat("wrong") === "2 of 100" && t.stat("waiting") === "0 of 100",
        "With 3,000 sheets: 98 right at once, 2 wrong, none waiting");

      // 10. Reply 1: the per-100 table, three choices, the middle, in writing.
      t.set("plan", "r1");
      t.expect(t.stat("rule") === "the middle: the box's own words now, a colleague confirms by tomorrow" && t.stat("right") === "68 of 100" &&
        t.stat("boxNow") === "30 of 100" && t.stat("decision").indexOf("the middle, agreed in writing friday 20 november") === 0 &&
        has("always answer: 80, 20, 0 wait"), "Reply 1: three rows shown, the middle agreed in writing");

      // 11. Reply 0 and reply 2 both end at 80 right and 20 wrong.
      t.set("plan", "r0");
      var r0 = t.stat("right") === "80 of 100" && t.stat("wrong") === "20 of 100";
      t.set("plan", "r2");
      t.expect(r0 && t.stat("dash") === "70 of 100" && has("another engineer switches it off again: right at once 80 of 100, wrong 20 of 100"),
        "Reply 0 keeps 80 and 20; reply 2 is undone by Tuesday and lands on 80 and 20");

      // 12. Reply 3: the 900 taken out.
      t.set("plan", "r3");
      t.expect(t.stat("covered") === "2,100 of 3,000" && t.stat("wrong") === "2 of 100" && has("please ask in the shop 30"),
        "Reply 3: 2,100 of 3,000 covered, 2 wrong, 30 told to ask in the shop");
    }
  });
})();
