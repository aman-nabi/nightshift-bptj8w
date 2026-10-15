/* sims/a7e05-v1.0.0.js  (published as sims/a7e05.js)
   Case a7e05 "Guardrails": a guardrail scorecard for Ardcarrow Harbour, whose website assistant
   gives tide times, berth details and, for logged-in shipping agents, billing answers. A new output
   guardrail (block any reply with 8 or more digits close together) went live at 17:00 on Tuesday
   13 October and refused 14 of 14 tide requests on the storm-surge night. No real model runs here
   and no reply text exists in this file: each reply is a kind and a count. The sim models the
   defence and its numbers, never an attack. Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: check the replies, rule (digit rule or account
     format), mode (off, watch only, block), traffic (September's 500 or tonight's 40), refusal text
     (dead end, points to the tide page and duty line, ring the duty pilot), login check on billing,
     a reply to play, reset. Stats: catches, false alarms, misses, passes, replies refused, would be
     blocked (watch only), tide requests refused, refusals that were right, account numbers reaching a
     reader, calls to the duty pilot. selfTest: 12 assertions.

   The model (stated in sim.lede, given data):
   - September's 500 labelled replies: 6 billing replies to visitors not logged in, each holding a
     real account number; 61 full tide tables; 119 single tide times; 210 berth details; 104 billing
     replies to logged-in agents with no account number. 6 + 61 + 119 + 210 + 104 = 500.
     Tide replies: 61 + 119 = 180.
   - Tonight's 40 (17:00 on 13 October to 06:00 on 14 October): 14 full tide tables, 19 berth details,
     7 billing replies to logged-in agents, no account number. 14 + 19 + 7 = 40.
   - Digit rule flags the account-number replies and every full tide table. Account-format rule
     (two letters and eight digits) flags only the account-number replies.
   - Login check on: billing answers only for a logged-in agent's own account, so the 6 replies are
     never written (the visitor is asked to log in); nothing holds an account number.
   - Catch: flagged and holds an account number. False alarm: flagged, no account number. Miss: holds
     one, not flagged. Pass: no account number, not flagged. Modes: off flags nothing; watch only
     flags and blocks nothing; block replaces each flagged reply with the refusal.
   - Calls to the duty pilot: every refusal, when the refusal says ring the duty pilot.

   Where every number comes from (conventions rule 14; the case is content/latent/a7/a7e05-v1.0.0.json):
   - As built, tonight: 14 of 14 tide requests refused, 14 false alarms, 0 catches, 26 passes.
   - As built, September: 6 catches, 61 false alarms, 0 misses, 433 passes; 6 of 67 right (9%).
   - Watch only, digit rule, September: 67 would be blocked, 0 refused, 6 account numbers reach a reader.
   - Account format, September: 6 catches, 0 false alarms, 0 misses, 494 passes. Tonight: 0 refused.
   - Reply 0 (off): September 6 misses, 6 reach a reader; back on as built, tonight 14 of 14 again.
   - Reply 1 (as is): 6 catches, 61 false alarms, 61 of 180 tide replies refused.
   - Reply 2 (format, login check, refusal points somewhere): September 0 false alarms, 0 reach a reader.
   - Reply 3 (ring the duty pilot): tonight 14 calls; September 67 calls, 61 for tide tables.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  // kinds of reply: acct holds a real account number; digits looks like 8+ digits close together
  var KINDS = [
    { id: "acct", label: "billing, visitor not logged in", month: 6, tonight: 0, acct: true, digits: true, tide: false },
    { id: "full", label: "full tide table", month: 61, tonight: 14, acct: false, digits: true, tide: true },
    { id: "single", label: "single tide time", month: 119, tonight: 0, acct: false, digits: false, tide: true },
    { id: "berth", label: "berth details", month: 210, tonight: 19, acct: false, digits: false, tide: false },
    { id: "bill", label: "billing, agent logged in", month: 104, tonight: 7, acct: false, digits: false, tide: false }
  ];

  var RULES = [
    { value: "digits", label: "digit rule: 8 or more digits close together (as built)" },
    { value: "format", label: "account format: two letters and eight digits" }
  ];
  var MODES = [
    { value: "block", label: "block (as built)" },
    { value: "watch", label: "watch only" },
    { value: "off", label: "off" }
  ];
  var TRAFFIC = [
    { value: "tonight", label: "tonight's 40, 17:00 to 06:00" },
    { value: "month", label: "September's 500 labelled replies" }
  ];
  var REFUSALS = [
    { value: "dead", label: "dead end (as built)", text: "I can't help with that." },
    { value: "points", label: "points somewhere",
      text: "I can't show that here. The full tide table is on the harbour's tide page, and the duty line is open all night." },
    { value: "phone", label: "ring the duty pilot", text: "I can't help with that. Ring the duty pilot." }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: off for the storm" },
    { value: "r1", label: "reply 1: keep it as it is" },
    { value: "r2", label: "reply 2: test on real replies, narrow the rule" },
    { value: "r3", label: "reply 3: duty pilot answers by phone" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function defaults() {
    return { rule: "digits", mode: "block", traffic: "tonight", refusal: "dead", login: false, plan: "none" };
  }
  function pct(a, b) { return Math.round(a / b * 100); }

  /* ---------- the model (pure: settings in, counts out) ---------- */

  function score(C, traffic) {
    var R = { rows: [], catches: 0, fa: 0, misses: 0, passes: 0, refused: 0, would: 0, leaks: 0,
      tideAsked: 0, tideRefused: 0, calls: 0, total: 0 };
    KINDS.forEach(function (k) {
      var n = traffic === "month" ? k.month : k.tonight;
      var holds = k.acct && !C.login;                 // the login check stops these replies being written
      var looks = holds ? true : (k.digits && !k.acct);
      var flagged = false;
      if (C.mode !== "off") flagged = C.rule === "digits" ? looks : holds;
      var blocked = flagged && C.mode === "block";
      var row = { label: k.label, n: n, flagged: flagged ? n : 0, blocked: blocked ? n : 0,
        note: k.acct && C.login ? "asked to log in" : "" };
      R.rows.push(row);
      R.total += n;
      if (holds && flagged) R.catches += n;
      if (!holds && flagged) R.fa += n;
      if (holds && !flagged) R.misses += n;
      if (!holds && !flagged) R.passes += n;
      if (blocked) R.refused += n;
      if (flagged && C.mode === "watch") R.would += n;
      if (holds && !blocked) R.leaks += n;
      if (k.tide) { R.tideAsked += n; if (blocked) R.tideRefused += n; }
    });
    R.calls = C.refusal === "phone" ? R.refused : 0;
    return R;
  }
  function rightText(R) {
    var flagged = R.catches + R.fa;
    if (!flagged) return "none flagged";
    return R.catches + " of " + flagged + " (" + pct(R.catches, flagged) + "%)";
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
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "rule: " + pick(RULES, C.rule).label + ". mode: " + pick(MODES, C.mode).label +
      ". traffic: " + pick(TRAFFIC, C.traffic).label + ". refusal: " + pick(REFUSALS, C.refusal).label +
      ". login check on billing: " + (C.login ? "on" : "off") + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["kind of reply", "replies", "flagged", "refused"], true);
    var R = S.R;
    KINDS.forEach(function (k, i) {
      if (!R) { row(ui, [k.label, "-", "-", "-"], false); return; }
      var r = R.rows[i];
      row(ui, [r.label + (r.note ? " (" + r.note + ")" : ""), r.n, r.flagged, r.blocked], false);
    });
    if (!R) {
      ui.note.textContent = "Morning of Wednesday 14 October. Nothing checked yet.";
      return;
    }
    ui.note.textContent = "catches " + R.catches + ", false alarms " + R.fa + ", misses " + R.misses + ", passes " +
      R.passes + ". a refused reader is told: " + pick(REFUSALS, C.refusal).text;
  }

  function setStats(api) {
    var S = api.state;
    var st = S.stat;
    var ids = ["catches", "falseAlarms", "misses", "passes", "refused", "would", "tide", "right", "leaks", "calls"];
    if (!S.R) { ids.forEach(function (id) { st[id]("-"); }); return; }
    var R = S.R;
    st.catches(R.catches);
    st.falseAlarms(R.fa);
    st.misses(R.misses);
    st.passes(R.passes);
    st.refused(R.refused);
    st.would(R.would);
    st.tide(R.tideRefused + " of " + R.tideAsked);
    st.right(rightText(R));
    st.leaks(R.leaks);
    st.calls(R.calls);
  }

  function summary(R) {
    return "catches " + R.catches + ", false alarms " + R.fa + ", misses " + R.misses + ", passes " + R.passes +
      "; refused " + R.refused + "; tide requests refused " + R.tideRefused + " of " + R.tideAsked +
      "; account numbers reaching a reader " + R.leaks;
  }

  function run(api, what) {
    var S = api.state;
    var C = S.C;
    S.R = score(C, C.traffic);
    var R = S.R;
    draw(api);
    setStats(api);
    var name = C.traffic === "month" ? "September's 500" : "tonight's 40";
    api.log((what ? what + " " : "") + name + " checked: " + summary(R) + ".",
      R.leaks ? "bad" : (R.fa && C.mode === "block" ? "warn" : "ok"));
    if (R.would) api.log("watch only: " + R.would + " would be blocked, 0 refused.", "warn");
    if (R.refused) api.log("a refused reader is told: " + pick(REFUSALS, C.refusal).text, C.refusal === "dead" ? "bad" : "");
    if (R.calls) api.log("calls to the duty pilot: " + R.calls + ".", "warn");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") { C.mode = "off"; C.traffic = "month"; }
    if (plan === "r1") { C.traffic = "month"; }
    if (plan === "r2") { C.rule = "format"; C.refusal = "points"; C.login = true; C.traffic = "month"; }
    if (plan === "r3") { C.refusal = "phone"; }
    return C;
  }

  function planFollowUp(api, plan) {
    var C = api.state.C;
    var other = C.traffic === "month" ? "tonight" : "month";
    var O = score(C, other);
    api.log("same settings on " + (other === "month" ? "September's 500" : "tonight's 40") + ": " + summary(O) +
      (O.calls ? "; calls to the duty pilot " + O.calls : "") + ".", "");
    if (plan === "r0") {
      var back = score(defaults(), "tonight");
      api.log("switched back on unchanged after the surge: tonight's 40 give " + back.tideRefused + " of " +
        back.tideAsked + " tide requests refused again.", "bad");
    }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a7e05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.R = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      function manual(what) {
        if (S.C.plan !== "none") { S.C.plan = "none"; S.ctl.plan.set("none"); what += " (reply cleared.)"; }
        run(api, what);
      }
      function sel(id, label, list, key) {
        S.ctl[id] = api.control.select(id, label, list, S.C[key], function (val) {
          var o = pick(list, val);
          if (!o) return;
          S.C[key] = String(o.value);
          manual(label + ": " + o.label + ".");
        });
      }
      S.ctl.run = api.control.button("run", "check the replies", function () { run(api, ""); });
      sel("rule", "rule", RULES, "rule");
      sel("mode", "mode", MODES, "mode");
      sel("traffic", "traffic", TRAFFIC, "traffic");
      sel("refusal", "refusal text", REFUSALS, "refusal");
      S.ctl.login = api.control.toggle("login", "login check on billing", false, function (on) {
        S.C.login = !!on;
        manual("login check on billing: " + (on ? "on." : "off."));
      });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        var C = planConfig(String(o.value));
        S.C = C;
        S.ctl.rule.set(C.rule); S.ctl.mode.set(C.mode); S.ctl.traffic.set(C.traffic);
        S.ctl.refusal.set(C.refusal); S.ctl.login.set(C.login);
        S.C = planConfig(String(o.value));
        run(api, "plan: " + o.label + ".");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        catches: api.stat("catches", "catches (account numbers flagged)", "ok"),
        falseAlarms: api.stat("falseAlarms", "false alarms (innocent replies flagged)", "bad"),
        misses: api.stat("misses", "misses (account numbers not flagged)", "bad"),
        passes: api.stat("passes", "passes (innocent replies let through)", ""),
        refused: api.stat("refused", "replies refused", "warn"),
        would: api.stat("would", "watch only: would be blocked", "warn"),
        tide: api.stat("tide", "tide requests refused", "bad"),
        right: api.stat("right", "refusals that were right", ""),
        leaks: api.stat("leaks", "account numbers reaching a reader", "bad"),
        calls: api.stat("calls", "calls to the duty pilot", "warn")
      };

      api.info("<strong>How to read it.</strong> Each row is one kind of reply: how many there were, how many the guardrail flagged, and how many it refused. Choose the rule, the mode, the traffic and the refusal text, then check the replies.");

      draw(api);
      setStats(api);
      api.log("Morning of Wednesday 14 October at Ardcarrow. Nothing checked yet: tonight's 40 requests and September's 500 labelled replies.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: nothing checked.
      t.expect(t.stat("catches") === "-" && t.stat("tide") === "-" &&
        has("Morning of Wednesday 14 October at Ardcarrow. Nothing checked yet"),
        "Opens on the morning of 14 October with nothing checked");

      // 2. As built, tonight: 14 of 14 tide requests refused.
      t.click("run");
      t.expect(t.stat("tide") === "14 of 14" && t.stat("refused") === 14 && t.stat("falseAlarms") === 14 &&
        t.stat("catches") === 0 && t.stat("passes") === 26 && has("a refused reader is told: I can't help with that."),
        "As built tonight: 14 of 14 tide requests refused, all false alarms, a dead-end refusal");

      // 3. As built, September: 6 catches, 61 false alarms.
      t.set("traffic", "month");
      t.expect(t.stat("catches") === 6 && t.stat("falseAlarms") === 61 && t.stat("misses") === 0 &&
        t.stat("passes") === 433 && t.stat("right") === "6 of 67 (9%)",
        "Digit rule on September's 500: 6 catches, 61 false alarms, 0 misses, 433 passes");

      // 4. Watch only shows the 61 before switch-on.
      t.set("mode", "watch");
      t.expect(t.stat("would") === 67 && t.stat("refused") === 0 && t.stat("falseAlarms") === 61 && t.stat("leaks") === 6,
        "Watch only: 67 would be blocked, 0 refused, the 61 false alarms visible");

      // 5. The account-format rule, blocking.
      t.set("mode", "block");
      t.set("rule", "format");
      t.expect(t.stat("catches") === 6 && t.stat("falseAlarms") === 0 && t.stat("passes") === 494 && t.stat("refused") === 6,
        "Account format on September's 500: 6 catches, 0 false alarms, 494 passes");

      // 6. The account-format rule, tonight.
      t.set("traffic", "tonight");
      t.expect(t.stat("refused") === 0 && t.stat("tide") === "0 of 14",
        "Account format tonight: 0 refusals, 0 of 14 tide requests refused");

      // 7. A refusal that points somewhere.
      t.set("traffic", "month");
      t.set("refusal", "points");
      t.expect(has("a refused reader is told: I can't show that here. The full tide table is on the harbour's tide page"),
        "The refusal points to the tide page and the duty line");

      // 8. The login check stops the 6 being written.
      t.set("login", true);
      t.expect(t.stat("leaks") === 0 && t.stat("catches") === 0 && t.stat("misses") === 0,
        "Login check: the 6 account-number replies are never written");

      // 9. Reply 0: off for the storm.
      t.set("plan", "r0");
      t.expect(t.stat("misses") === 6 && t.stat("leaks") === 6 && t.stat("refused") === 0 &&
        has("switched back on unchanged after the surge: tonight's 40 give 14 of 14 tide requests refused again."),
        "Reply 0: off lets 6 account numbers through; back on, 14 of 14 again");

      // 10. Reply 1: keep it as it is.
      t.set("plan", "r1");
      t.expect(t.stat("catches") === 6 && t.stat("falseAlarms") === 61 && t.stat("tide") === "61 of 180" &&
        t.stat("right") === "6 of 67 (9%)",
        "Reply 1: 6 catches, 61 false alarms, 61 of 180 tide replies refused");

      // 11. Reply 2: test on real replies, narrow the rule, login check, refusal that points.
      t.set("plan", "r2");
      t.expect(t.stat("falseAlarms") === 0 && t.stat("leaks") === 0 && t.stat("refused") === 0 &&
        has("same settings on tonight's 40: catches 0, false alarms 0, misses 0, passes 40; refused 0"),
        "Reply 2: 0 false alarms, 0 leaks, and tonight 0 refused");

      // 12. Reply 3: the duty pilot answers by phone.
      t.set("plan", "r3");
      t.expect(t.stat("calls") === 14 && t.stat("tide") === "14 of 14" &&
        has("calls to the duty pilot 67"),
        "Reply 3: 14 calls tonight, 67 on September's traffic");
    }
  });
})();
