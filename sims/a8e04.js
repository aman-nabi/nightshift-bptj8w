/* sims/a8e04-v1.0.0.js  (published as sims/a8e04.js)
   Case a8e04 "The Student Who Copies": a teacher-and-student scorecard for Esquith Street Tattoo, a
   parlour whose booking assistant moved from a large model with a long rules prompt (the teacher) to a
   small model trained on the teacher's saved answers (the student). No real model runs here and no chat
   text exists in this file beyond the one booking note the case quotes: every score is a given count.
   Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: sample (200 random, 2,000 random, per kind with the
     must-refuse set), model (student, teacher), train longer on the same 8,000, add 120 written under-18
     requests to training, booking form asks the age, enquiries a day (120, 1,200), play tonight, a reply
     to play, reset. Stats: agreement, under-18s in the sample, must-refuse set refused, cost and time a
     chat, cost a day, tonight's under-18 requests booked, the switch check. selfTest: 11 assertions.

   The given data (stated in sim.lede):
   - Training: the teacher's saved answers to 8,000 past enquiries, by kind: availability 3,600,
     prices 2,000, aftercare 1,400, designs 989, under-18 11. The teacher refused all 11.
   - The check before switching, 200 random older enquiries not trained on: availability 92 (student
     agreed on 89), prices 49 (47), aftercare 34 (31), designs 25 (20), under-18 0. Total 187 of 200.
   - A 2,000 random check: availability 905 (875), prices 497 (478), aftercare 352 (322), designs 243
     (194), under-18 3 (student refused 1, booked 2). Total 1,870 of 2,000.
   - Trained longer on the same 8,000: 200 check 90, 48, 32, 21, 0 = 191; 2,000 check 885, 486, 330,
     208, 1 = 1,910; must-refuse set 10 of 40.
   - The must-refuse set: 40 under-18 requests written on purpose (of 160 written; the other 120 can be
     added to training with the teacher's refusals). Teacher refuses 40, student 9; with the 120 added,
     the retrained student refuses 40 and keeps the same scores on the other kinds.
   - Teacher: $0.02 and 2 seconds a chat. Student: $0.001 and 0.4 seconds.
   - Tonight, Friday 2 October: 5 under-18 requests between 22:00 and 23:00 after an all-ages concert;
     the student booked 4 and refused 1 (22:41). With the teacher or the retrained student: 0 booked.
     With the form asking the age: 0 booked.

   Where every number comes from (conventions rule 14; the case is content/latent/a8/a8e04-v1.0.0.json):
   - 93.5%: 187 / 200; 1,870 / 2,000. 95.5%: 191 / 200; 1,910 / 2,000. Retrained, 2,000 check:
     875 + 478 + 322 + 194 + 3 = 1,872 (93.6%).
   - Expected under-18s: 200 x 11 / 8,000 = 0.275; 2,000 x 11 / 8,000 = 2.75. A day: 120 x 11 / 8,000
     = 0.165; 1,200 x 11 / 8,000 = 1.65. Six days at 120: 720 x 11 / 8,000 = 0.99, about one.
   - 20 times: 0.02 / 0.001. 5 times: 2 / 0.4. A day at 120: $2.40 teacher, $0.12 student.
   - Reply 0: 191 of 200, 10 of 40. Reply 1: 1,870 of 2,000, 3 found, refused 1 of 3. Reply 2: per
     kind, 9 of 40 stop; with the 120 added, 40 of 40 go, 187 of 200. Reply 3: teacher, 40 of 40, $0.02.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var TRAINED = 8000;
  var U18_TRAINED = 11;
  var ADDED = 120;
  var MUST = 40;
  var COST = { teacher: 0.02, student: 0.001 };
  var SECS = { teacher: 2, student: 0.4 };
  var KINDS = ["availability", "prices", "aftercare", "designs", "under-18"];
  var IN_TRAINING = [3600, 2000, 1400, 989, 11];
  var SAMPLE = {
    s200: { size: 200, n: [92, 49, 34, 25, 0], base: [89, 47, 31, 20, 0], longer: [90, 48, 32, 21, 0] },
    s2000: { size: 2000, n: [905, 497, 352, 243, 3], base: [875, 478, 322, 194, 1], longer: [885, 486, 330, 208, 1] }
  };
  var SAMPLES = [
    { value: "s200", label: "200 random (the check before switching)" },
    { value: "s2000", label: "2,000 random" },
    { value: "kind", label: "per kind, with the must-refuse set" }
  ];
  var MODELS = [
    { value: "student", label: "student (small model)" },
    { value: "teacher", label: "teacher (large model)" }
  ];
  var DAYS = [
    { value: "120", label: "120 a day (as now)" },
    { value: "1200", label: "1,200 a day" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: train longer on the same answers" },
    { value: "r1", label: "reply 1: check 2,000 random" },
    { value: "r2", label: "reply 2: score per kind, must-refuse set" },
    { value: "r3", label: "reply 3: send every chat to the large model" }
  ];
  var NIGHT = [
    { t: "22:06", slot: "10:00", note: "I'm 16, it's my first one", refused: false },
    { t: "22:19", slot: "11:30", note: "16, after the concert", refused: false },
    { t: "22:34", slot: "13:00", note: "I'm 16", refused: false },
    { t: "22:41", slot: "", note: "", refused: true },
    { t: "22:52", slot: "14:30", note: "16, small one on the wrist", refused: false }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function num(x) { return String(Math.round(x * 1000) / 1000); }
  function pct(a, b) { return String(Math.round(a * 1000 / b) / 10); }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function defaults() {
    return { sample: "s200", model: "student", longer: false, added: false, form: false, perday: "120",
      played: false, plan: "none" };
  }

  /* ---------- the scorecard (pure: settings in, answers out) ---------- */

  function score(C) {
    var key = C.sample === "s2000" ? "s2000" : "s200";
    var S = SAMPLE[key];
    var teacher = C.model === "teacher";
    var safe = teacher || C.added;
    var row = teacher ? S.n.slice() : (C.longer ? S.longer.slice() : S.base.slice());
    if (!teacher && C.added) row[4] = S.n[4];
    var R = { key: key, n: S.n, agreeRow: row, size: S.size };
    var a = sum(row);
    R.agree = fmt(a) + " of " + fmt(S.size) + " (" + pct(a, S.size) + "%)";
    R.u18 = C.sample === "kind" ? MUST + " written on purpose, 0.275 expected in 200" :
      num(S.size * U18_TRAINED / TRAINED) + " expected, " + S.n[4] + " found";
    var refused = safe ? MUST : (C.longer ? 10 : 9);
    R.refusedN = refused;
    R.refuse = refused + " of " + MUST;
    R.cost = "$" + COST[C.model] + " a chat, " + SECS[C.model] + " s";
    var per = Number(C.perday);
    R.day = "$" + (per * COST[C.model]).toFixed(2) + " a day; " + num(per * U18_TRAINED / TRAINED) + " under-18 expected a day";
    if (!C.played) R.tonight = "not played yet";
    else if (C.form) R.tonight = "0 of 5 booked (form asks the age)";
    else R.tonight = (safe ? 0 : 4) + " of 5 booked";
    if (C.sample !== "kind" && teacher) R.check = "the teacher is the answer key: it agrees with itself";
    else if (C.sample !== "kind") R.check = "average only: " + pct(a, S.size) + "% looks like a pass";
    else if (refused < MUST) R.check = "stop: must-refuse set " + refused + " of " + MUST;
    else R.check = "go: must-refuse set " + MUST + " of " + MUST + ", every kind scored";
    R.trainedU18 = U18_TRAINED + (C.added ? ADDED : 0);
    return R;
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
    var R = score(C);
    var ui = api.state.ui;
    ui.head.textContent = "the scorecard at Esquith Street. model: " + pick(MODELS, C.model).label +
      ". sample: " + pick(SAMPLES, C.sample).label + "." + (C.longer ? " trained longer." : "") +
      (C.added ? " 120 written under-18 requests added to training." : "");
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    var perKind = C.sample === "kind";
    row(ui, ["kind of enquiry", "in training", "in the sample", "agreed with the teacher"], true);
    for (var i = 0; i < KINDS.length; i++) {
      var trained = i === 4 ? R.trainedU18 : IN_TRAINING[i];
      var cell = perKind ? R.agreeRow[i] + " of " + R.n[i] : "-";
      if (perKind && i === 4) cell = "must-refuse set: refused " + R.refuse;
      row(ui, [KINDS[i], fmt(trained), R.n[i], cell], false);
    }
    row(ui, ["all kinds", fmt(TRAINED + (C.added ? ADDED : 0)), fmt(R.size), R.agree], false);
    ui.note.textContent = (perKind ? "each kind scored on its own. " : "one average only; the kinds are not scored apart. ") +
      "check: " + R.check + ". tonight: " + R.tonight + ".";
  }

  function setStats(api) {
    var R = score(api.state.C);
    var st = api.state.stat;
    st.agree(R.agree);
    st.u18(R.u18);
    st.refuse(R.refuse);
    st.cost(R.cost);
    st.compare(Math.round(COST.teacher / COST.student) + " times the cost, " + Math.round(SECS.teacher / SECS.student) + " times as long");
    st.day(R.day);
    st.tonight(R.tonight);
    st.check(R.check);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = score(api.state.C);
    if (what) api.log(what + " agreement " + R.agree + "; must-refuse set " + R.refuse + "; " + R.cost + ".",
      R.refusedN === MUST ? "ok" : "bad");
  }

  function playNight(api) {
    var C = api.state.C;
    var safe = C.model === "teacher" || C.added;
    api.log("Friday 2 October, 22:00. the all-ages concert ended at 21:30. the booking form asks " +
      (C.form ? "the age." : "no age."), "");
    NIGHT.forEach(function (q) {
      if (C.form) api.log(q.t + "  under-18 request: stopped at the form's age question.", "ok");
      else if (safe || q.refused) api.log(q.t + "  under-18 request: refused, no booking.", "ok");
      else api.log(q.t + "  under-18 request: booked tomorrow " + q.slot + ". note copied: " + q.note, "bad");
    });
    C.played = true;
    draw(api);
    setStats(api);
    var R = score(C);
    api.log("23:50  tomorrow's list read. under-18 requests: " + R.tonight + ".",
      R.tonight.indexOf("0 ") === 0 ? "ok" : "bad");
  }

  function planConfig(plan, prev) {
    var C = defaults();
    C.plan = plan;
    C.played = prev.played;
    C.perday = prev.perday;
    if (plan === "r0") C.longer = true;
    if (plan === "r1") C.sample = "s2000";
    if (plan === "r2") { C.sample = "kind"; C.added = true; C.form = true; }
    if (plan === "r3") C.model = "teacher";
    return C;
  }

  function planFollowUp(api, plan) {
    var R = score(api.state.C);
    if (plan === "r0") api.log("longer on the same 8,000: still " + U18_TRAINED + " under-18 answers to learn from. agreement " +
      R.agree + "; must-refuse set " + R.refuse + ".", "bad");
    if (plan === "r1") api.log("2,000 random: agreement " + R.agree + "; under-18s " + R.u18 +
      "; the student refused 1 of 3 and booked 2, hidden in the average.", "bad");
    if (plan === "r2") {
      var before = score({ sample: "kind", model: "student", longer: false, added: false, form: false, perday: "120", played: false });
      api.log("per kind first: " + before.check + ". then 120 written under-18 requests, with the teacher's refusals, added to training.", "warn");
      api.log("retrained: " + R.check + "; agreement on the 200 " + score({ sample: "s200", model: "student", added: true, perday: "120" }).agree +
        "; " + R.cost + ". the form now asks the age.", "ok");
    }
    if (plan === "r3") api.log("every chat to the large model: must-refuse set " + R.refuse + ", but " + R.cost +
      ", " + R.day.split(";")[0] + ".", "warn");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a8e04", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.sample.set(S.C.sample);
        S.ctl.model.set(S.C.model);
        S.ctl.longer.set(S.C.longer);
        S.ctl.added.set(S.C.added);
        S.ctl.form.set(S.C.form);
        S.ctl.perday.set(S.C.perday);
        S.sync = false;
      }
      function manual(what) {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
          what += " (reply cleared.)";
        }
        refresh(api, what);
      }
      function chooser(id, label, list, initial) {
        S.ctl[id] = api.control.select(id, label, list, initial, function (val) {
          if (S.sync) return;
          var o = pick(list, val);
          if (!o) return;
          S.C[id] = String(o.value);
          manual(o.label + ".");
        });
      }
      function flag(id, label) {
        S.ctl[id] = api.control.toggle(id, label, false, function (on) {
          if (S.sync) return;
          S.C[id] = !!on;
          manual(label + ": " + (on ? "on." : "off."));
        });
      }
      chooser("sample", "sample", SAMPLES, "s200");
      chooser("model", "model", MODELS, "student");
      flag("longer", "train longer on the same 8,000");
      flag("added", "add 120 written under-18 requests to training");
      flag("form", "booking form asks the age");
      chooser("perday", "enquiries a day", DAYS, "120");
      S.ctl.night = api.control.button("night", "play tonight, 22:00 to 23:50", function () { playNight(api); });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        if (S.sync) return;
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        S.C = planConfig(String(o.value), S.C);
        syncControls();
        refresh(api, "plan: " + o.label + ".");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        agree: api.stat("agree", "agreement with the teacher", ""),
        u18: api.stat("u18", "under-18s in the sample", "warn"),
        refuse: api.stat("refuse", "must-refuse set refused", "bad"),
        cost: api.stat("cost", "cost and time a chat", ""),
        compare: api.stat("compare", "teacher against student", ""),
        day: api.stat("day", "cost a day", ""),
        tonight: api.stat("tonight", "tonight's under-18 requests", "bad"),
        check: api.stat("check", "the switch check", "")
      };

      api.info("<strong>How to read it.</strong> Each row is a kind of enquiry: how many the student trained on, how many the sample holds, and, when you score per kind, how many it answered the way the teacher did. The last row is the one average the parlour checked. Play tonight to see the five under-18 requests.");

      refresh(api, "");
      api.log("Friday 2 October, 21:30 at Esquith Street, before tonight's chats. the student has run since Saturday 26 September: about 720 enquiries, " +
        num(720 * U18_TRAINED / TRAINED) + " under-18 expected. its check: 187 of 200 (93.5%).", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: the check before switching, before tonight.
      t.expect(t.stat("agree") === "187 of 200 (93.5%)" && t.stat("u18") === "0.275 expected, 0 found" &&
        t.stat("cost") === "$0.001 a chat, 0.4 s" && t.stat("tonight") === "not played yet" &&
        t.stat("compare") === "20 times the cost, 5 times as long" && has("21:30 at Esquith Street") && has("0.99 under-18 expected"),
        "Opens at 21:30: 187 of 200 (93.5%), 0.275 expected under-18s, $0.001 and 0.4 s");

      // 2. Tonight: 5 under-18 requests, 4 booked, the fifth refused at 22:41.
      t.click("night");
      t.expect(t.stat("tonight") === "4 of 5 booked" && has("22:41  under-18 request: refused") &&
        has("note copied: I'm 16, it's my first one") && has("23:50  tomorrow's list read"),
        "Tonight: 4 of 5 booked, one refused at 22:41, list read at 23:50");

      // 3. A bigger random sample: still almost no under-18s.
      t.set("sample", "s2000");
      t.expect(t.stat("agree") === "1,870 of 2,000 (93.5%)" && t.stat("u18") === "2.75 expected, 3 found",
        "2,000 random: 1,870 of 2,000 (93.5%), 2.75 expected, 3 found");

      // 4. Per kind, with the must-refuse set: the student refuses 9 of 40.
      t.set("sample", "kind");
      t.expect(t.stat("refuse") === "9 of 40" && t.stat("check") === "stop: must-refuse set 9 of 40",
        "Per kind: must-refuse set 9 of 40, stop");

      // 5. The teacher: 40 of 40, at 20 times the cost.
      t.set("model", "teacher");
      t.expect(t.stat("refuse") === "40 of 40" && t.stat("cost") === "$0.02 a chat, 2 s" &&
        t.stat("day") === "$2.40 a day; 0.165 under-18 expected a day", "Teacher: 40 of 40, $0.02 and 2 s, $2.40 a day");
      t.set("model", "student");

      // 6. Ten times the enquiries.
      t.set("perday", "1200");
      t.expect(t.stat("day") === "$1.20 a day; 1.65 under-18 expected a day", "1,200 a day: $1.20, 1.65 under-18 expected");
      t.set("perday", "120");

      // 7. Reply 0: train longer on the same 8,000.
      t.set("plan", "r0");
      t.expect(t.stat("agree") === "191 of 200 (95.5%)" && t.stat("refuse") === "10 of 40",
        "Reply 0: 191 of 200 (95.5%), still 10 of 40");

      // 8. Reply 1: 2,000 random.
      t.set("plan", "r1");
      t.expect(t.stat("agree") === "1,870 of 2,000 (93.5%)" && has("refused 1 of 3 and booked 2") &&
        t.stat("refuse") === "9 of 40", "Reply 1: 1,870 of 2,000, refused 1 of 3, still 9 of 40");

      // 9. Reply 2: per kind, then the 120 added: go.
      t.set("plan", "r2");
      t.expect(t.stat("refuse") === "40 of 40" && t.stat("check") === "go: must-refuse set 40 of 40, every kind scored" &&
        has("per kind first: stop: must-refuse set 9 of 40") && has("agreement on the 200 187 of 200 (93.5%)") &&
        t.stat("cost") === "$0.001 a chat, 0.4 s", "Reply 2: 9 of 40 stop, retrained 40 of 40 go, still 187 of 200 and $0.001");

      // 10. Reply 2 also asks the age on the form: tonight, 0 booked.
      t.expect(t.stat("tonight") === "0 of 5 booked (form asks the age)", "Reply 2: the form stops all 5 tonight");

      // 11. Reply 3: every chat to the teacher.
      t.set("plan", "r3");
      t.expect(t.stat("refuse") === "40 of 40" && t.stat("cost") === "$0.02 a chat, 2 s" && t.stat("tonight") === "0 of 5 booked" &&
        has("$2.40 a day"), "Reply 3: 40 of 40, 0 booked, but $0.02 and 2 s a chat, $2.40 a day");
    }
  });
})();
