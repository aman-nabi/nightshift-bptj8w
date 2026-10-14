/* sims/a6e09-v1.0.0.js  (published as sims/a6e09.js)
   Case a6e09 "The Night It Changed Its Mind": a drift checker for the Hurlestone winter roads depot
   (Brackmoor County). An assistant built on a rented language model sorts the public's reports into
   "send now" (send a gritter now) and "next round" (the 04:00 round). The app asks for the model by an
   alias, fieldfare-2, which the depot's provider points at its newest snapshot. No real model runs
   here: every report belongs to a stated group, and each snapshot's verdict on each group is stated.
   Widget-style sim: it draws its own table inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: model reference (alias as built, or pinned to
     fieldfare-2-20251118), where the alias points (old snapshot until 18:00 on 14 October, new from
     then), the set (the depot's labelled 200, or last night's 96), the prompt line ("treat every
     report of ice as urgent", stated effect), the weekly eval (off, on, on after a small stated
     infrastructure update), Try a switch to the new snapshot, a plan (the four replies), Reset.
     Stats: version in use, urgent found, routine sent now, marked send now, changed against the
     old snapshot, the school-hill sentence, the switch check, the weekly eval. selfTest: 12
     assertions.

   The model (stated in sim.lede). The alias rule is the depot's provider's, unnamed; Anthropic's
   page (read 15 October 2026) describes such aliases only for its earlier models.
   - Labelled 200 (built at launch in January, last run 3 September, 58 of 60): 60 urgent, 140 routine.
       urgent, ice:   13 old send / new send; 10 old send / new next; 1 both next      (24)
       urgent, other: 34 both send; 1 old send / new next; 1 both next                (36)
       routine, ice:  30 both next                                                     (30)
       routine, other: 4 both send (false alarms); 106 both next                       (110)
   - Last night's 96 (14 October 18:00 to 15 October 06:00, all sorted by the new snapshot):
       ice:   10 both send; 13 old send / new next; 29 both next                       (52)
       other:  7 both send;  1 old send / new next; 36 both next                       (44)
     Svea's 21:14 report ("Ice on the hill by the school, a car's in the hedge.") is in the
     13 ice, old send / new next group. On 9 October at 05:58 the old snapshot sent it now.
   - The prompt line's stated effect: either snapshot marks every report that mentions ice send now.
   - The small infrastructure update (stated, for the weekly eval only): one of the 10 urgent ice
     reports the old snapshot found flips to next round on the old snapshot.
   - Pass bar (agreed at launch): at least 57 of 60 urgent found, and at most 10 of 140 routine
     sent now.
   - Last winter's hard-frost nights: 12 to 35 reports marked urgent (given; the count alarm's range).
   - By hand: about 10 reports an hour around the radio and the drivers (given). Last night's 96 by
     hour from 18:00: 3, 5, 9, 22, 18, 12, 7, 4, 3, 3, 4, 6.

   Where every number comes from (the case is content/latent/a6/a6e09-v1.0.0.json).
   - Old snapshot on the 200: 13 + 10 + 34 + 1 = 58 of 60 found; 4 of 140 routine sent now;
     58 + 4 = 62 marked send now. New: 13 + 34 = 47 of 60; 4 of 140; 51 marked. Changed: 10 + 1 = 11,
     every one from send now to next round (58 - 47 = 11).
   - Recall by hand: 58 / 60 = 96.7%, 47 / 60 = 78.3%. Ice alone: old 23 of 24, new 13 of 24.
   - Last night's 96: old 10 + 13 + 7 + 1 = 31 send now; new 10 + 7 = 17; changed 13 + 1 = 14.
   - Prompt line, new snapshot, 200: 24 + 34 = 58 of 60; 30 + 4 = 34 of 140 routine sent now: fails.
     96: 52 + 7 = 59 send now.
   - The switch check on the new snapshot: 47 of 60, below 57: blocked.
   - Weekly eval (Mondays 09:00): pinned, Mon 19 Oct, 58 of 60, passes; after the infrastructure
     update, 57 of 60, passes, 1 changed since last week; alias after the move, Mon 19 Oct,
     47 of 60, fails, five nights after the move (14 to 18 October); alias before it, Mon 12 Oct,
     58 of 60, passes.
   - Count alarm (reply 0): 17 marked send now, inside 12 to 35: no alarm.
   - By hand (reply 2), 10 an hour: waiting at the end of each hour 0, 0, 0, 12, 20, 22, 19, 13,
     6, 0, 0, 0; peak 22 at 00:00, the last about 22 / 10 h = 2 h 12 min behind.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var OLD = "fieldfare-2-20251118";
  var NEW = "fieldfare-2-20260929";
  var ALIAS = "fieldfare-2";
  var BAR = { found: 57, falseMax: 10 };
  var RANGE = [12, 35];
  var HAND_RATE = 10;
  var HOURS = [3, 5, 9, 22, 18, 12, 7, 4, 3, 3, 4, 6];

  // label: "u" urgent, "r" routine, "" not labelled. old/new: true = send now.
  var SET200 = [
    { kind: "ice", label: "u", n: 13, old: true, nw: true },
    { kind: "ice", label: "u", n: 10, old: true, nw: false, infra: 1 },
    { kind: "ice", label: "u", n: 1, old: false, nw: false },
    { kind: "other", label: "u", n: 34, old: true, nw: true },
    { kind: "other", label: "u", n: 1, old: true, nw: false },
    { kind: "other", label: "u", n: 1, old: false, nw: false },
    { kind: "ice", label: "r", n: 30, old: false, nw: false },
    { kind: "other", label: "r", n: 4, old: true, nw: true },
    { kind: "other", label: "r", n: 106, old: false, nw: false }
  ];
  var SET96 = [
    { kind: "ice", label: "", n: 10, old: true, nw: true },
    { kind: "ice", label: "", n: 13, old: true, nw: false, hill: true },
    { kind: "ice", label: "", n: 29, old: false, nw: false },
    { kind: "other", label: "", n: 7, old: true, nw: true },
    { kind: "other", label: "", n: 1, old: true, nw: false },
    { kind: "other", label: "", n: 36, old: false, nw: false }
  ];

  var REFS = [{ value: "alias", label: "Alias fieldfare-2 (as built)" }, { value: "pinned", label: "Pinned: " + OLD }];
  var SNAPS = [{ value: "old", label: "Old snapshot (until 18:00, 14 Oct)" }, { value: "new", label: "New snapshot (from 18:00, 14 Oct)" }];
  var SETS = [{ value: "200", label: "Labelled 200 (the test set)" }, { value: "96", label: "Last night's 96" }];
  var WEEKLY = [{ value: "off", label: "Off" }, { value: "on", label: "On, Mondays 09:00" }, { value: "infra", label: "On, after a small infrastructure update" }];
  var PLANS = [
    { value: "none", label: "None: set the controls yourself" },
    { value: "r0", label: "Reply: keep the alias, watch the count" },
    { value: "r1", label: "Reply: add the ice line to the prompt" },
    { value: "r2", label: "Reply: sort every report by hand" },
    { value: "r3", label: "Reply: pin the version, test before a switch" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function defaults() { return { ref: "alias", snap: "old", set: "200", line: false, weekly: "off", plan: "none" }; }
  function inUse(C) { return C.ref === "pinned" ? "old" : C.snap; }
  function nameOf(s) { return s === "old" ? OLD : NEW; }
  function word(send) { return send ? "urgent" : "next round"; }

  /* ---------- the model (pure: settings in, counts out) ---------- */

  // How many of group g a snapshot sends now. Line: every ice report is sent now.
  // Infra: on the old snapshot, the group's stated number flips to next round.
  function sendCount(g, snap, line, infra) {
    if (line && g.kind === "ice") return g.n;
    var send = snap === "old" ? g.old : g.nw;
    if (!send) return 0;
    if (infra && snap === "old" && g.infra) return g.n - g.infra;
    return g.n;
  }

  function score(set, snap, line, infra) {
    var list = set === "96" ? SET96 : SET200;
    var r = { urgent: 0, found: 0, routine: 0, falseSent: 0, send: 0, changed: 0, total: 0 };
    list.forEach(function (g) {
      var s = sendCount(g, snap, line, infra);
      var base = g.old ? g.n : 0;
      r.total += g.n;
      r.send += s;
      r.changed += Math.abs(base - s);
      if (g.label === "u") { r.urgent += g.n; r.found += s; }
      if (g.label === "r") { r.routine += g.n; r.falseSent += s; }
    });
    return r;
  }

  function passes(r) { return r.found >= BAR.found && r.falseSent <= BAR.falseMax; }

  function gateText(r) {
    if (r.found < BAR.found) return "blocked: " + r.found + " of 60";
    if (r.falseSent > BAR.falseMax) return "blocked: " + r.falseSent + " of 140 sent now";
    return "passes";
  }

  function hillSend(C) {
    if (C.line) return true;
    return inUse(C) === "old";
  }

  function weeklyText(C) {
    if (C.weekly === "off") return "off";
    var infra = C.weekly === "infra";
    var snap = inUse(C);
    var day = C.ref === "alias" && snap === "old" ? "Mon 12 Oct" : "Mon 19 Oct";
    var r = score("200", snap, C.line, infra);
    var s = day + ": " + r.found + " of 60, " + (passes(r) ? "passes" : "fails");
    if (infra && snap === "old") s += "; " + Math.abs(r.found - score("200", snap, C.line, false).found) + " changed since last week";
    return s;
  }

  function handBacklog() {
    var q = 0, peak = 0, at = 0, ends = [];
    for (var h = 0; h < HOURS.length; h++) {
      q = Math.max(0, q + HOURS[h] - HAND_RATE);
      ends.push(q);
      if (q > peak) { peak = q; at = h; }
    }
    var mins = Math.round(peak * 60 / HAND_RATE);
    var endHour = (18 + at + 1) % 24;
    return { ends: ends, peak: peak, at: (endHour < 10 ? "0" : "") + endHour + ":00", wait: Math.floor(mins / 60) + " h " + (mins % 60) + " min" };
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
    var wrap = el("div", "overflow-x:auto;", "", box);
    var table = el("table", "width:100%;border-collapse:collapse;", "", wrap);
    var foot = el("p", "margin:0;", "", box);
    return { el: el, head: head, table: table, foot: foot };
  }

  function row(ui, cells, th) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;", String(c), tr); });
  }

  function draw(api) {
    var S = api.state, C = S.C, ui = S.ui;
    var snap = inUse(C);
    var infra = C.weekly === "infra";
    ui.head.textContent = "The app asks for " + (C.ref === "alias" ? ALIAS + ", an alias now pointing at " + nameOf(C.snap) : nameOf("old") + " by its full name (pinned)") +
      ". Prompt line on ice: " + (C.line ? "on" : "off") + ". Set: " + (C.set === "96" ? "last night's 96 (no labels)" : "the labelled 200") + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["kind", "label", "reports", "old: urgent", "new: urgent", "as set now"], true);
    (C.set === "96" ? SET96 : SET200).forEach(function (g) {
      row(ui, [g.kind, g.label === "u" ? "urgent" : (g.label === "r" ? "routine" : "-"), g.n,
        sendCount(g, "old", false, false), sendCount(g, "new", false, false), sendCount(g, snap, C.line, infra)]);
    });
    ui.foot.textContent = "Pass bar for a switch: at least " + BAR.found + " of 60 urgent found, and at most " + BAR.falseMax + " of 140 routine sent now.";
  }

  function setStats(api) {
    var S = api.state, C = S.C, st = S.stat;
    var snap = inUse(C);
    var r = score(C.set, snap, C.line, C.weekly === "infra");
    st.uses(nameOf(snap));
    st.found(C.set === "96" ? "no labels" : r.found + " of 60");
    st.falseSent(C.set === "96" ? "no labels" : r.falseSent + " of 140");
    st.send(r.send);
    st.changed(r.changed);
    st.hill(word(hillSend(C)));
    st.gate(S.gate);
    st.weekly(weeklyText(C));
  }

  function refresh(api) { draw(api); setStats(api); }

  function summaryLine(C) {
    var snap = inUse(C);
    var r = score(C.set, snap, C.line, C.weekly === "infra");
    if (C.set === "96") return "Last night's 96 on " + nameOf(snap) + (C.line ? " with the ice line" : "") + ": " + r.send + " urgent, " + r.changed + " changed against the old snapshot.";
    return "The labelled 200 on " + nameOf(snap) + (C.line ? " with the ice line" : "") + ": " + r.found + " of 60 urgent found, " + r.falseSent + " of 140 routine sent now, " + r.changed + " changed against the old snapshot.";
  }

  function trySwitch(api) {
    var S = api.state, C = S.C;
    var r = score("200", "new", C.line, false);
    S.gate = gateText(r);
    var s = "Switch check: the labelled 200 on " + NEW + (C.line ? " with the ice line" : "") + ": " + r.found + " of 60 found, " + r.falseSent + " of 140 routine sent now. " +
      (passes(r) ? "Passes the bar: a switch may go ahead, on purpose." : "Below the bar: the switch is blocked.");
    if (C.ref === "alias") s += " With the alias, the provider decides when the switch happens, and it did not ask.";
    api.log(s, passes(r) ? "ok" : "bad");
    refresh(api);
  }

  function planOutcome(api, P) {
    var C = api.state.C;
    if (P === "r0") {
      var r0 = score("96", "new", false, false);
      var inside = r0.send >= RANGE[0] && r0.send <= RANGE[1];
      api.log("Count alarm: Wednesday night replayed, " + r0.send + " urgent, " + (inside ? "inside" : "outside") + " last winter's 12 to 35 for a hard frost: " +
        (inside ? "no alarm" : "alarm") + ". The 14 sent to the next round sit inside a normal-looking count, and the next move of the alias will be as quiet.", inside ? "bad" : "warn");
    } else if (P === "r1") {
      var a = score("200", "new", true, false), b = score("96", "new", true, false);
      api.log("Ice line, never tested: on the labelled 200, " + a.found + " of 60 found but " + a.falseSent + " of 140 routine sent now; the bar allows 10, so it fails. Last night's 96: " +
        b.send + " urgent instead of the old snapshot's 31, for seven gritters.", "bad");
    } else if (P === "r2") {
      var h = handBacklog();
      api.log("By hand at about 10 an hour: " + h.peak + " waiting at " + h.at + ", the last about " + h.wait + " behind. Svea's report would wait in that line too.", "warn");
    } else if (P === "r3") {
      trySwitch(api);
      api.log("Pinned to " + OLD + " and written in the change log. Weekly eval: " + weeklyText(C) + ". The old snapshot retires on 14 April 2027; a version that passes the bar must be found before then.", "ok");
    }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a6e09", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.gate = "not tried";
      S.ui = buildWidget(api);
      S.ctl = {};
      function manual(what) {
        if (S.C.plan !== "none") { S.C.plan = "none"; S.ctl.plan.set("none"); what += " (Plan cleared.)"; }
        api.log(what + " " + summaryLine(S.C), "");
        refresh(api);
      }
      S.ctl.ref = api.control.select("ref", "Model reference", REFS, "alias", function (v) {
        var o = pick(REFS, v);
        if (!o) return;
        S.C.ref = String(o.value);
        manual(S.C.ref === "pinned" ? "Pinned: the app now asks for " + OLD + " by its full name. Moving the alias no longer changes it." : "The app asks for the alias " + ALIAS + " again.");
      });
      S.ctl.snap = api.control.select("snap", "Where the alias points", SNAPS, "old", function (v) {
        var o = pick(SNAPS, v);
        if (!o) return;
        S.C.snap = String(o.value);
        var s;
        if (S.C.snap === "new") {
          s = "18:00, 14 October. The alias " + ALIAS + " now points at " + NEW + ". Change log: no entry since 3 September. The app's settings are unchanged.";
          if (S.C.ref === "alias") s += " Same sentence: 9 Oct 05:58 urgent (old snapshot); 14 Oct 21:14 next round (new snapshot).";
          else s += " The pinned app still asks for " + OLD + ".";
        } else {
          s = "Before 18:00, 14 October: the alias " + ALIAS + " points at " + OLD + ", as it has since January.";
        }
        manual(s);
      });
      S.ctl.set = api.control.select("set", "Set", SETS, "200", function (v) {
        var o = pick(SETS, v);
        if (!o) return;
        S.C.set = String(o.value);
        manual("Set: " + o.label + ".");
      });
      S.ctl.line = api.control.toggle("line", "Prompt line: treat every report of ice as urgent", false, function (on) {
        S.C.line = !!on;
        manual("Prompt line on ice " + (on ? "on (stated effect: every report that mentions ice is sent now)." : "off."));
      });
      S.ctl.weekly = api.control.select("weekly", "Weekly eval on the version in use", WEEKLY, "off", function (v) {
        var o = pick(WEEKLY, v);
        if (!o) return;
        S.C.weekly = String(o.value);
        manual("Weekly eval: " + o.label + ".");
      });
      S.ctl.sw = api.control.button("switch", "Try a switch to the new snapshot", function () { trySwitch(api); });
      S.ctl.plan = api.control.select("plan", "Play a reply", PLANS, "none", function (v) {
        var o = pick(PLANS, v);
        if (!o || o.value === "none") return;
        var C = defaults();
        C.plan = String(o.value);
        if (C.plan === "r0") { C.snap = "new"; C.set = "96"; }
        if (C.plan === "r1") { C.snap = "new"; C.line = true; }
        if (C.plan === "r2") { C.snap = "new"; C.set = "96"; }
        if (C.plan === "r3") { C.ref = "pinned"; C.snap = "new"; C.set = "96"; C.weekly = "on"; }
        S.C = C;
        S.gate = "not tried";
        S.ctl.ref.set(C.ref); S.ctl.snap.set(C.snap); S.ctl.set.set(C.set); S.ctl.line.set(C.line); S.ctl.weekly.set(C.weekly);
        api.log("Plan: " + o.label + ". " + summaryLine(C), "");
        refresh(api);
        planOutcome(api, C.plan);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        uses: api.stat("uses", "model version in use", ""),
        found: api.stat("found", "urgent found (of 60 labelled urgent)", "ok"),
        falseSent: api.stat("falseSent", "routine sent now (of 140)", "warn"),
        send: api.stat("send", "marked urgent", ""),
        changed: api.stat("changed", "changed against the old snapshot", "bad"),
        hill: api.stat("hill", "the school-hill sentence, as set now", ""),
        gate: api.stat("gate", "switch to the new snapshot", "warn"),
        weekly: api.stat("weekly", "weekly eval", "")
      };

      api.info("<strong>How to read it.</strong> Each row is a group of reports. The old and new columns say how many of the group each snapshot sends now; the last column is what the app does as set. Urgent found counts only reports people labelled urgent: found out of 60 is the recall, worked by hand.");

      refresh(api);
      api.log("14 October, 17:59. The app asks for " + ALIAS + ", an alias pointing at " + OLD + ", as it has since launch in January. Change log: last entry 3 September (new bypass; test set 58 of 60).", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening: before 18:00 on 14 October, the alias on the old snapshot, 58 of 60.
      t.expect(t.stat("uses") === OLD && t.stat("found") === "58 of 60" && t.stat("falseSent") === "4 of 140" && t.stat("send") === 62 &&
        t.stat("changed") === 0 && t.stat("hill") === "urgent" && t.stat("gate") === "not tried" && t.stat("weekly") === "off" &&
        has("14 October, 17:59. The app asks for fieldfare-2, an alias pointing at fieldfare-2-20251118, as it has since launch in January."),
        "Opens at 17:59 on 14 October: the alias on the old snapshot, 58 of 60 found");

      // 2. 18:00: the alias moves, the change log stays empty, the same set finds 47.
      t.set("snap", "new");
      t.expect(t.stat("uses") === NEW && t.stat("found") === "47 of 60" && t.stat("falseSent") === "4 of 140" && t.stat("send") === 51 &&
        t.stat("changed") === 11 && has("Change log: no entry since 3 September. The app's settings are unchanged."),
        "18:00, 14 October: the alias moves with nothing in the change log; 47 of 60 found, 11 changed");

      // 3. The school-hill sentence: send now on 9 October, next round on 14 October.
      t.expect(t.stat("hill") === "next round" && has("Same sentence: 9 Oct 05:58 urgent (old snapshot); 14 Oct 21:14 next round (new snapshot)."),
        "The same sentence: urgent on 9 October, next round on 14 October");

      // 4. Last night's 96: 17 sent now, 14 changed against the old snapshot.
      t.set("set", "96");
      t.expect(t.stat("send") === 17 && t.stat("changed") === 14 && t.stat("found") === "no labels",
        "Last night's 96 on the new snapshot: 17 urgent, 14 the old snapshot would have sent now");

      // 5. Pinned: the move changes nothing.
      t.set("ref", "pinned");
      t.expect(t.stat("uses") === OLD && t.stat("send") === 31 && t.stat("changed") === 0 && t.stat("hill") === "urgent",
        "Pinned to fieldfare-2-20251118: the alias moved but the app did not; 31 urgent");

      // 6. The switch check blocks the new snapshot.
      t.click("switch");
      t.expect(t.stat("gate") === "blocked: 47 of 60" && has("Below the bar: the switch is blocked."),
        "The test set blocks the switch: 47 of 60 is below 57");

      // 7. The ice line on the new snapshot: recall back, false alarms up, still blocked.
      t.set("ref", "alias");
      t.set("set", "200");
      t.set("line", true);
      var line200 = t.stat("found") === "58 of 60" && t.stat("falseSent") === "34 of 140";
      t.click("switch");
      t.expect(line200 && t.stat("gate") === "blocked: 34 of 140 sent now" && t.stat("hill") === "urgent",
        "The ice line: 58 of 60 found but 34 of 140 routine sent now, so it fails the bar");
      t.set("line", false);

      // 8. Weekly eval: on the alias after the move it fails on 19 October; pinned it passes.
      t.set("weekly", "on");
      var wAlias = t.stat("weekly") === "Mon 19 Oct: 47 of 60, fails";
      t.set("ref", "pinned");
      t.expect(wAlias && t.stat("weekly") === "Mon 19 Oct: 58 of 60, passes",
        "Weekly eval: the alias fails on Monday 19 October; the pinned version passes");

      // 9. A small infrastructure update on the pinned version: the weekly run sees it.
      t.set("weekly", "infra");
      t.expect(t.stat("weekly") === "Mon 19 Oct: 57 of 60, passes; 1 changed since last week" && t.stat("found") === "57 of 60",
        "After a small infrastructure update the weekly run shows 57 of 60 and 1 changed");

      // 10. Reply 0: the count alarm stays silent at 17.
      t.set("plan", "r0");
      t.expect(has("Count alarm: Wednesday night replayed, 17 urgent, inside last winter's 12 to 35 for a hard frost: no alarm.") && t.stat("send") === 17,
        "Keep the alias and watch the count: 17 is inside 12 to 35, no alarm");

      // 11. Reply 2: by hand, 22 waiting at midnight.
      t.set("plan", "r2");
      t.expect(has("By hand at about 10 an hour: 22 waiting at 00:00, the last about 2 h 12 min behind."),
        "Sort by hand at 10 an hour: 22 waiting at 00:00, the last 2 h 12 min behind");

      // 12. Reply 3: pinned, switch blocked, weekly passes, last night's 96 back to 31.
      t.set("plan", "r3");
      t.expect(t.stat("uses") === OLD && t.stat("gate") === "blocked: 47 of 60" && t.stat("weekly") === "Mon 19 Oct: 58 of 60, passes" &&
        t.stat("send") === 31 && has("The old snapshot retires on 14 April 2027"),
        "Pin, test before a switch, run weekly: blocked at 47 of 60, 58 of 60 every Monday, 31 urgent");
    }
  });
})();
