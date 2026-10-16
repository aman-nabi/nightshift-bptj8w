/* sims/a9e07-v1.0.0.js  (published as sims/a9e07.js)
   Case a9e07 "The Crossroads": a cv-to-advert matcher for a recruiter's shortlist night, from 21:00 on
   Tuesday 15 December 2026 (both adverts just run) to the client call at 08:00 on Wednesday 16 December.
   No real model runs: every count below is given data, set out here and in sim.lede.
   Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: scoring basis (title list as built, the advert's
     duties, duties and rounds by role family), advert title (applied ai engineer, forward-deployed
     engineer, ai engineer), alias added, retrained on the firm's placements, rank by years, a reply to
     play, reset. Stats: advert, scoring basis, list scored against, her score, role family, her place,
     both adverts, do they agree, rounds to prepare, hours by hand, pairs, what the reply shows.
     selfTest: 11 assertions.

   The given data (stated in sim.lede):
   - 20 cvs, numbered 1 to 20; hers is cv 14. For each: skills shown of the 2021 machine-learning list
     (of 9), duties shown of the advert's 12, years of experience. Hers: 1 of 9 (python only), 11 of 12,
     3 years. Every other cv shows 2 to 9 of the 9 skills and 2 to 10 of the 12 duties.
   - the 9 skills: training models from scratch, pytorch, statistics, feature engineering, experiment
     tracking, data pipelines, training on gpus, reading research papers, python.
   - the 12 duties, the same in both adverts: 7 building on existing models (question answering, lookup
     over the client's documents, evals and their scores, agents that use the client's tools, safety
     rules for answers, cost per question, python), 4 with the client (discovery meetings, workshops,
     the design doc, presenting results), 1 training (fine-tune a model on the client's examples, the
     one her cv does not show).
   - the rounds both adverts name: recruiter screen, coding, ai system design, take-home, customer
     conversation.
   - the title list as built: "ai engineer" and "applied ai engineer" point to the 2021 machine-learning
     list (added by the maker in an update in may 2024); "forward-deployed engineer" is not on it, so it
     falls back to the advert's duties.
   - the firm's 14 placements since 2021, all titled "ml engineer". Retraining rebuilds a title's list
     from the skills at least 7 of the 14 placed cvs show. Counts: training models from scratch 14,
     pytorch 13, statistics 12, feature engineering 11, experiment tracking 10, data pipelines 12,
     training on gpus 9, reading research papers 8, python 14; writing evals 3, building on existing
     models 2, client workshops 1.
   - reading by hand: about 20 minutes a pair.

   Where every number comes from (conventions rule 14; the case is content/latent/a9/a9e07-v1.0.0.json):
   - 40 pairs = 20 cvs x 2 adverts.
   - her score on the title list: 1 of 9, 100 x 1 / 9 = 11.1, shown rounded as 11; 20th of 20, since
     every other cv shows at least 2.
   - her score on the duties: 11 of 12, 100 x 11 / 12 = 91.7, shown rounded as 92; 1st of 20, since
     every other cv shows at most 10.
   - alias: "applied ai engineer" becomes forward-deployed work, which the list does not know, so it
     falls back to the duties: 11 of 12 (92), 1st. "ai engineer" still points to the 9: 1 of 9 (11), 20th.
   - retrained: skills shown by at least 7 of 14 placements = the same 9; no other skill reaches 7
     (evals 3, existing models 2, workshops 1). Still 1 of 9 (11), 20th.
   - by years: 17 cvs have more than her 3 years, 2 have fewer: 18th of 20.
   - role family by rounds: forward-deployed or applied names 4 rounds and the advert has all 4; ai
     engineer 3 of 3; ml engineer 1 of 3; inference 1 of 3; research 0 of 2. Duties: 7 + 4 + 1 = 12.
   - by hand: 40 x 20 = 800 minutes = 13 h 20 min. The replies start at 00:30, after the thread;
     00:30 to 08:00 = 7 h 30 min = 450 minutes, floor(450 / 20) = 22 pairs read, 40 - 22 = 18 unread.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  // [cv number, skills shown of the 9, duties shown of the 12, years of experience]
  var CVS = [
    [1, 8, 4, 9], [2, 7, 5, 11], [3, 6, 6, 6], [4, 9, 3, 12], [5, 5, 7, 5],
    [6, 4, 8, 4], [7, 3, 9, 4], [8, 6, 4, 8], [9, 2, 10, 5], [10, 5, 5, 7],
    [11, 7, 3, 10], [12, 4, 6, 6], [13, 3, 7, 2], [14, 1, 11, 3], [15, 6, 5, 9],
    [16, 2, 8, 2], [17, 5, 6, 8], [18, 4, 9, 5], [19, 8, 2, 12], [20, 3, 4, 4]
  ];
  var HER = 14;
  var LIST9 = ["training models from scratch", "pytorch", "statistics", "feature engineering", "experiment tracking",
    "data pipelines", "training on gpus", "reading research papers", "python"];
  var NDUTIES = 12;
  var DUTY_KINDS = { build: 7, client: 4, train: 1 };
  var PLACED = 14;
  var KEEP = 7;
  var PLACED_COUNTS = [
    ["training models from scratch", 14], ["pytorch", 13], ["statistics", 12], ["feature engineering", 11],
    ["experiment tracking", 10], ["data pipelines", 12], ["training on gpus", 9], ["reading research papers", 8],
    ["python", 14], ["writing evals", 3], ["building on existing models", 2], ["client workshops", 1]
  ];
  var ADVERT_ROUNDS = ["recruiter screen", "coding", "ai system design", "take-home", "customer conversation"];
  var FAMILIES = [
    { name: "ai engineer", rounds: ["coding", "ai system design", "take-home"] },
    { name: "forward-deployed or applied", rounds: ["coding", "ai system design", "take-home", "customer conversation"] },
    { name: "ml engineer", rounds: ["coding", "ml basics", "ml system design"] },
    { name: "research", rounds: ["paper discussion", "research deep dive"] },
    { name: "inference", rounds: ["coding", "systems language", "gpu performance"] }
  ];
  var MIN_PER_PAIR = 20;
  var AVAILABLE = 450; // 00:30 to 08:00

  var BASIS_OPTS = [
    { value: "title", label: "title list (as built)" },
    { value: "duties", label: "the advert's duties" },
    { value: "family", label: "duties and rounds, by role family" }
  ];
  var TITLE_OPTS = [
    { value: "applied", label: "applied ai engineer" },
    { value: "fde", label: "forward-deployed engineer" },
    { value: "aieng", label: "ai engineer" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: add applied ai engineer as forward-deployed work" },
    { value: "r1", label: "reply 1: retrain on the firm's past placements" },
    { value: "r2", label: "reply 2: read every advert and cv by hand" },
    { value: "r3", label: "reply 3: score on duties and rounds, never the title" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function ord(n) {
    var s = (n % 100 >= 11 && n % 100 <= 13) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
    return n + s;
  }
  function hm(min) { return Math.floor(min / 60) + " h " + (min % 60) + " min"; }
  function defaults() {
    return { basis: "title", title: "applied", alias: false, retrained: false, years: false, plan: "none" };
  }

  /* ---------- the model (pure: settings in, numbers out) ---------- */

  function rebuiltList() {
    var kept = [];
    PLACED_COUNTS.forEach(function (p) { if (p[1] >= KEEP) kept.push(p[0]); });
    return kept;
  }
  function sameAsNine(list) {
    if (list.length !== LIST9.length) return false;
    for (var i = 0; i < LIST9.length; i++) if (list.indexOf(LIST9[i]) < 0) return false;
    return true;
  }

  // Which list an advert is scored against: "nine" (the machine-learning list) or "duties".
  function listFor(C, title) {
    if (C.basis !== "title") return "duties";
    if (title === "fde") return "duties";
    if (title === "applied" && C.alias) return "duties";
    if (C.retrained && !sameAsNine(rebuiltList())) return "duties";
    return "nine";
  }

  function family(C, title) {
    if (C.basis === "family") {
      var best = null;
      var bestN = -1;
      FAMILIES.forEach(function (f) {
        var n = 0;
        f.rounds.forEach(function (r) { if (ADVERT_ROUNDS.indexOf(r) >= 0) n += 1; });
        if (n > bestN) { best = f; bestN = n; }
      });
      return { name: best.name, n: bestN, of: best.rounds.length, rounds: best.rounds };
    }
    if (C.basis === "duties") return { name: "not worked out: duties only", rounds: null };
    if (listFor(C, title) === "nine") return { name: "ml (the 2021 machine-learning list)", rounds: null };
    return { name: "none: title unknown, scored on the advert's duties", rounds: null };
  }

  function score(C, title, cv) {
    var L = listFor(C, title);
    if (L === "nine") return { found: cv[1], size: LIST9.length };
    return { found: cv[2], size: NDUTIES };
  }

  // Her result for one advert title under settings C.
  function result(C, title) {
    var her = null;
    CVS.forEach(function (cv) { if (cv[0] === HER) her = cv; });
    var R = { title: title, list: listFor(C, title), fam: family(C, title) };
    if (C.years) {
      var more = 0;
      CVS.forEach(function (cv) { if (cv[3] > her[3]) more += 1; });
      R.place = more + 1;
      R.score = her[3] + " years";
      R.listText = "years of experience";
      return R;
    }
    var s = score(C, title, her);
    var higher = 0;
    CVS.forEach(function (cv) {
      var o = score(C, title, cv);
      if (o.found * s.size > s.found * o.size) higher += 1;
    });
    R.place = higher + 1;
    R.score = s.found + " of " + s.size + " (" + Math.round(100 * s.found / s.size) + ")";
    if (R.list === "duties") R.listText = "the advert's " + NDUTIES + " duties";
    else R.listText = C.retrained ? "rebuilt from " + PLACED + " placements: the same " + LIST9.length + " skills" : "2021 ml list, " + LIST9.length + " skills";
    return R;
  }

  function placeText(R) { return ord(R.place) + " of " + CVS.length; }
  function both(C) {
    var a = result(C, "applied");
    var f = result(C, "fde");
    return {
      text: "applied ai engineer: " + a.score + ", " + placeText(a) + "; forward-deployed engineer: " + f.score + ", " + placeText(f),
      agree: (a.score === f.score && a.place === f.place) ? "yes" : "no"
    };
  }
  function byHand() {
    var total = CVS.length * 2 * MIN_PER_PAIR;
    var done = Math.floor(AVAILABLE / MIN_PER_PAIR);
    return { total: total, done: done, unread: CVS.length * 2 - done,
      text: total + " min (" + hm(total) + ") for " + (CVS.length * 2) + " pairs; " + done + " of " + (CVS.length * 2) + " by 08:00" };
  }

  function report(plan) {
    if (plan === "r0") {
      var c0 = { basis: "title", alias: true, retrained: false, years: false };
      var a0 = result(c0, "applied");
      var f0 = result(c0, "fde");
      var e0 = result(c0, "aieng");
      return "applied ai engineer: " + a0.score + ", " + placeText(a0) + "; forward-deployed engineer: " + f0.score + ", " + placeText(f0) +
        "; ai engineer, posted 13 january: " + e0.score + ", " + placeText(e0);
    }
    if (plan === "r1") {
      var c1 = { basis: "title", alias: false, retrained: true, years: false };
      var a1 = result(c1, "applied");
      return "rebuilt from " + PLACED + " ml engineer placements, keeping skills at least " + KEEP + " show: " + rebuiltList().length +
        " skills, the same list; applied ai engineer: " + a1.score + ", " + placeText(a1);
    }
    if (plan === "r2") {
      var h = byHand();
      var c2 = { basis: "duties", alias: false, retrained: false, years: false };
      return h.total + " min (" + hm(h.total) + ") for " + (CVS.length * 2) + " pairs; 00:30 to 08:00 is " + AVAILABLE + " min: " + h.done +
        " read, " + h.unread + " unread; her two pairs read first: " + result(c2, "applied").score + " on both";
    }
    if (plan === "r3") {
      var c3 = { basis: "family", alias: false, retrained: false, years: false };
      var a3 = result(c3, "applied");
      var f3 = result(c3, "fde");
      return "both adverts: " + a3.fam.name + ", all " + a3.fam.of + " of its rounds named; applied ai engineer: " + a3.score + ", " + placeText(a3) +
        "; forward-deployed engineer: " + f3.score + ", " + placeText(f3) + "; rounds to prepare: " + a3.fam.rounds.join(", ");
    }
    return "not played yet";
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

  function draw(api) {
    var C = api.state.C;
    var R = result(C, C.title);
    var ui = api.state.ui;
    ui.head.textContent = "advert: " + pick(TITLE_OPTS, C.title).label + ". scored on: " + R.listText + ". alias added: " + (C.alias ? "yes" : "no") +
      ". retrained: " + (C.retrained ? "yes" : "no") + ". ranked by years: " + (C.years ? "yes" : "no") + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["place", "cv", "shown", "years"], true);
    var rows = CVS.map(function (cv) {
      var s = score(C, C.title, cv);
      return { cv: cv, s: s, key: C.years ? cv[3] : s.found / s.size };
    });
    rows.sort(function (a, b) { return (b.key - a.key) || (a.cv[0] - b.cv[0]); });
    rows.forEach(function (r, i) {
      row(ui, [i + 1, r.cv[0] === HER ? "cv " + HER + " (hers)" : "cv " + r.cv[0], r.s.found + " of " + r.s.size, r.cv[3]], false);
    });
    var h = byHand();
    ui.note.textContent = "her cv: " + R.score + ", " + placeText(R) + ". role family: " + R.fam.name + ". by hand: " + h.text +
      ". reply played: " + report(C.plan) + ".";
  }

  function setStats(api) {
    var C = api.state.C;
    var R = result(C, C.title);
    var B = both(C);
    var st = api.state.stat;
    st.advert(pick(TITLE_OPTS, C.title).label);
    st.basis(C.years ? "years of experience" : pick(BASIS_OPTS, C.basis).label);
    st.list(R.listText);
    st.score(R.score);
    st.family(R.fam.name);
    st.place(placeText(R));
    st.both(B.text);
    st.agree(B.agree);
    st.rounds(R.fam.rounds ? R.fam.rounds.join(", ") : "not worked out");
    st.hours(byHand().text);
    st.pairs(CVS.length * 2);
    st.report(report(C.plan));
  }

  function refresh(api) { draw(api); setStats(api); }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") { C.alias = true; }
    if (plan === "r1") { C.retrained = true; }
    if (plan === "r2") { C.basis = "duties"; }
    if (plan === "r3") { C.basis = "family"; }
    return C;
  }

  function planFollowUp(api, plan) {
    var C = api.state.C;
    if (plan === "r0") {
      var e = result(C, "aieng");
      api.log("alias added: applied ai engineer now falls back to the duties, " + result(C, "applied").score + ". wednesday 13 january: the same job posted as ai engineer: " +
        e.score + ", " + placeText(e) + ".", "bad");
    }
    if (plan === "r1") api.log("retrained on " + PLACED + " placements, all ml engineer: the rebuilt list is the same " + rebuiltList().length + " skills. applied ai engineer: " +
      result(C, "applied").score + ", " + placeText(result(C, "applied")) + ".", "bad");
    if (plan === "r2") {
      var h = byHand();
      api.log("read by hand from 00:30, " + MIN_PER_PAIR + " min a pair: " + h.done + " of " + (CVS.length * 2) + " read by 08:00, " + h.unread + " unread.", "warn");
    }
    if (plan === "r3") {
      var f = result(C, "applied");
      api.log("both adverts: " + f.fam.name + ". her cv: " + f.score + " under both titles, " + placeText(f) + " on both.", "ok");
    }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a9e07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.basis.set(S.C.basis);
        S.ctl.title.set(S.C.title);
        S.ctl.alias.set(S.C.alias);
        S.ctl.retrained.set(S.C.retrained);
        S.ctl.years.set(S.C.years);
        S.sync = false;
      }
      function clearPlan() {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
        }
      }
      function change(fn, what) {
        var before = result(S.C, S.C.title);
        clearPlan();
        fn();
        refresh(api);
        var R = result(S.C, S.C.title);
        api.log(what + " her cv: " + before.score + ", " + placeText(before) + " before; " + R.score + ", " + placeText(R) + " after. role family: " + R.fam.name + ".",
          R.place === 1 ? "ok" : (R.place === CVS.length ? "bad" : "warn"));
      }
      S.ctl.basis = api.control.select("basis", "scoring basis", BASIS_OPTS, "title", function (val) {
        if (S.sync) return;
        var o = pick(BASIS_OPTS, val);
        if (!o) return;
        change(function () { S.C.basis = String(o.value); }, "scoring basis: " + o.label + ".");
      });
      S.ctl.title = api.control.select("title", "advert title", TITLE_OPTS, "applied", function (val) {
        if (S.sync) return;
        var o = pick(TITLE_OPTS, val);
        if (!o) return;
        change(function () { S.C.title = String(o.value); }, "advert: " + o.label + ".");
      });
      S.ctl.alias = api.control.toggle("alias", "alias added: applied ai engineer as forward-deployed work", false, function (on) {
        if (S.sync) return;
        change(function () { S.C.alias = !!on; }, "alias " + (on ? "added" : "removed") + ".");
      });
      S.ctl.retrained = api.control.toggle("retrained", "retrained on the firm's 14 placements since 2021", false, function (on) {
        if (S.sync) return;
        change(function () { S.C.retrained = !!on; }, on ? "retrained on: skills at least " + KEEP + " of " + PLACED + " placements show: " +
          rebuiltList().length + ", " + (sameAsNine(rebuiltList()) ? "the same list" : "a new list") + "." : "retrained off: back to the list as built.");
      });
      S.ctl.years = api.control.toggle("years", "rank by years of experience", false, function (on) {
        if (S.sync) return;
        change(function () { S.C.years = !!on; }, "rank by years " + (on ? "on" : "off") + ".");
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
        advert: api.stat("advert", "advert title", ""),
        basis: api.stat("basis", "scoring basis", ""),
        list: api.stat("list", "scored against", ""),
        score: api.stat("score", "her cv: found of listed (score)", "warn"),
        family: api.stat("family", "role family", ""),
        place: api.stat("place", "her place on the shortlist", ""),
        both: api.stat("both", "both adverts, same job", ""),
        agree: api.stat("agree", "do the two shortlists agree on her?", "bad"),
        rounds: api.stat("rounds", "rounds to prepare", ""),
        hours: api.stat("hours", "reading every pair by hand", "warn"),
        pairs: api.stat("pairs", "pairs tonight (20 cvs x 2 adverts)", ""),
        report: api.stat("report", "the reply played shows", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one of the 20 cvs, ranked for the chosen advert. The tool reads the advert's title and looks it up in its title list. A known title points to a list of skills; an unknown one falls back to the duties written in the advert. It counts how many the cv shows, and the score is found out of listed, as a share of 100, rounded. Her cv is number 14.");

      refresh(api);
      api.log("tuesday 15 december, 21:00. 20 cvs run against both adverts, 40 pairs. applied ai engineer, on the title list: her cv " +
        result(S.C, "applied").score + ", " + placeText(result(S.C, "applied")) + ".", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: applied ai engineer on the 2021 list.
      t.expect(t.stat("score") === "1 of 9 (11)" && t.stat("place") === "20th of 20" && t.stat("list") === "2021 ml list, 9 skills" &&
        t.stat("family") === "ml (the 2021 machine-learning list)" && has("tuesday 15 december, 21:00") && t.stat("pairs") === 40,
        "Opens at 21:00: applied ai engineer on the 2021 list, her cv 1 of 9 (11), 20th of 20; 40 pairs");

      // 2. The second title is unknown and falls back to the duties.
      t.set("title", "fde");
      t.expect(t.stat("score") === "11 of 12 (92)" && t.stat("place") === "1st of 20" && t.stat("list") === "the advert's 12 duties" &&
        t.stat("family") === "none: title unknown, scored on the advert's duties",
        "Forward-deployed engineer: unknown title, the advert's duties, 11 of 12 (92), 1st of 20");

      // 3. One job, two shortlists that disagree.
      t.expect(t.stat("both") === "applied ai engineer: 1 of 9 (11), 20th of 20; forward-deployed engineer: 11 of 12 (92), 1st of 20" && t.stat("agree") === "no",
        "The same cv: 20th on one shortlist and 1st on the other");

      // 4. The alias fixes one title only.
      t.set("title", "applied");
      t.set("alias", true);
      var a = t.stat("score") === "11 of 12 (92)" && t.stat("place") === "1st of 20";
      t.set("title", "aieng");
      t.expect(a && t.stat("score") === "1 of 9 (11)" && t.stat("place") === "20th of 20",
        "Alias: applied ai engineer 11 of 12 (92), 1st; ai engineer still 1 of 9 (11), 20th");

      // 5. Retraining on the firm's placements keeps the 2021 list.
      t.set("alias", false);
      t.set("title", "applied");
      t.set("retrained", true);
      t.expect(t.stat("score") === "1 of 9 (11)" && t.stat("list") === "rebuilt from 14 placements: the same 9 skills" &&
        has("skills at least 7 of 14 placements show: 9, the same list"),
        "Retrained on 14 ml engineer placements: the same 9 skills, still 1 of 9 (11)");

      // 6. Duties and rounds by role family: 11 of 12 under both titles.
      t.set("retrained", false);
      t.set("basis", "family");
      t.expect(t.stat("score") === "11 of 12 (92)" && t.stat("family") === "forward-deployed or applied" && t.stat("agree") === "yes" &&
        t.stat("both") === "applied ai engineer: 11 of 12 (92), 1st of 20; forward-deployed engineer: 11 of 12 (92), 1st of 20" &&
        t.stat("rounds") === "coding, ai system design, take-home, customer conversation",
        "By duties and rounds: forward-deployed or applied, 11 of 12 (92) and 1st under both titles");

      // 7. Rank by years: the third wrong idea.
      t.set("years", true);
      t.expect(t.stat("score") === "3 years" && t.stat("place") === "18th of 20",
        "Rank by years: her 3 years put her 18th of 20");

      // 8. Reading by hand: 800 minutes for 40 pairs.
      t.expect(t.stat("hours") === "800 min (13 h 20 min) for 40 pairs; 22 of 40 by 08:00",
        "By hand: 40 pairs at 20 minutes is 800 min (13 h 20 min); 22 of 40 by 08:00");

      // 9. Reply 0 and reply 1.
      t.set("plan", "r0");
      var r0 = t.stat("report") === "applied ai engineer: 11 of 12 (92), 1st of 20; forward-deployed engineer: 11 of 12 (92), 1st of 20; ai engineer, posted 13 january: 1 of 9 (11), 20th of 20";
      t.set("plan", "r1");
      t.expect(r0 && t.stat("report") === "rebuilt from 14 ml engineer placements, keeping skills at least 7 show: 9 skills, the same list; applied ai engineer: 1 of 9 (11), 20th of 20",
        "Reply 0: one title fixed, ai engineer still 1 of 9; reply 1: the same 9 skills");

      // 10. Reply 2: right every time, too slow.
      t.set("plan", "r2");
      t.expect(t.stat("report") === "800 min (13 h 20 min) for 40 pairs; 00:30 to 08:00 is 450 min: 22 read, 18 unread; her two pairs read first: 11 of 12 (92) on both" &&
        has("22 of 40 read by 08:00, 18 unread"), "Reply 2: 22 of 40 pairs read by 08:00, 18 unread");

      // 11. Reply 3: both adverts in one role family, 11 of 12 on both.
      t.set("plan", "r3");
      t.expect(t.stat("report") === "both adverts: forward-deployed or applied, all 4 of its rounds named; applied ai engineer: 11 of 12 (92), 1st of 20; forward-deployed engineer: 11 of 12 (92), 1st of 20; rounds to prepare: coding, ai system design, take-home, customer conversation" &&
        has("her cv: 11 of 12 (92) under both titles, 1st of 20 on both"),
        "Reply 3: both adverts forward-deployed or applied; 11 of 12 (92), 1st under both titles");
    }
  });
})();
