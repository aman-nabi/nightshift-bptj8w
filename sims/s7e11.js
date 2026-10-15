/* sims/s7e11-v1.0.0.js  (published as sims/s7e11.js)
   Case s7e11 "The Voice From IT": a reset-policy lab for the help desk at the Castellane, a casino
   that never closes. Staff sign in with a password and a second proof from an app on their own
   phone (multi-factor sign-in, MFA). A reset wipes the old second proof and gives a temporary
   password; the next device to sign in registers a new second proof. As found, the policy resets
   after three personal questions answered from the staff record. At 02:40 on Mon 12 Oct 2026 the
   desk reset the finance manager's sign-in, Ms Ojukwu's, while she was asleep; at 02:51 a device
   never seen before signed in. Itzel, the night lead, replays the 30 days of resets under other
   policies.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).
   It models the defence and its stated numbers only: each reset is a row with its check and its
   outcome. There is no call content, no questions, no answers and no method in this file.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: identity check (3 personal questions, as found; 6 personal
     questions; call back on the number already on file), second approver for privileged accounts
     (off, as found; on), number matching (off, as found; on), passkeys (off, as found; on), alert
     on a reset followed by a new device within 60 minutes (off, as found; on), night resets
     (allowed, as found; held for the day team). Buttons: run the 30 days, reset. A select picks
     which rows the table shows. selfTest: 11 assertions.

   Where every number comes from (conventions rule 14; the case is content/s7/s7e11-v1.0.0.json):
   - The 30 days run from Sat 12 Sep 2026 08:00 to Mon 12 Oct 2026 08:00 (given). Day d runs from
     08:00 on (12 Sep + d) to 08:00 the next day; night is 20:00 to 08:00, the night shift's hours.
   - 214 resets (given): 213 ordinary resets for staff who asked (g = 0 to 212, rows 1 to 213), and
     row 214, the 02:40 reset on Ms Ojukwu's account, the only reset of the night of Sun 11 Oct.
     The 213 follow a stated rule, not randomness:
       day       = floor(g x 29 / 213)            (days 0 to 28; day 29 holds only row 214)
       night     = g mod 7 is 3 or 4              -> 60 rows; with row 214, 61 at night
       time      = day rows: 08:00 + (g x 37 mod 720) minutes;
                   night rows: 20:00 + (g x 53 mod 720) minutes
       privileged= g mod 21 is 5                  -> 10 rows; with row 214, 11 privileged
       not reached on the number on file (lost phone) = g mod 13 is 7 -> 16 rows
       new device after the reset = g mod 10 below 7 -> 150 rows, at 4 + (g mod 9) x 6 minutes;
                   with row 214 (11 minutes, 02:51), 151
   - 41 of 1,380 staff accounts are privileged (given; stated, not computed).
   - Agent minutes per reset (given): 3 personal questions 3; 6 questions 6; call back 7; second
     approver adds 4 on a privileged reset. As found 214 x 3 = 642. Six questions 1,284. Call back
     214 x 7 = 1,498; with the second approver 1,498 + 11 x 4 = 1,542, 7.2 a reset.
   - Call back: 197 done after the owner confirmed, 16 held for a badge check at the security desk,
     1 stopped (row 214: her own phone rang and she had asked for nothing). Owners reached 198.
   - Alert: 2 duty-manager minutes a check (given). As found 151 alerts, 302 minutes; with call
     back, row 214 never happens, so 150 alerts, 300 minutes.
   - Row 214 times (given): reset 02:40, new device 02:51, payment records opened 02:52, signed
     out 03:20; her own call 07:10. With the alert on: alert 02:51, duty manager rings her number
     on file 02:53, account suspended 02:58. With night resets held: the day team handles it at
     08:20, the new device signs in 08:31 (and an alert, if on, at 08:31, suspended 08:38).
   - Options: 0 six questions: still done, 0 owners reached, 1,284 minutes; 1 (ok) call back:
     stopped, 198 reached, 16 held, 1,498 minutes; 2 passkeys: still done, the new device registers
     its own passkey; 3 night resets held: 61 wait, done at 08:20 on the same questions.
*/
(function () {
  "use strict";

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MIN = 60000;
  var T0 = Date.UTC(2026, 8, 12, 8, 0);          // Sat 12 Sep 2026 08:00
  var T_RESET = Date.UTC(2026, 9, 12, 2, 40);    // Mon 12 Oct 2026 02:40
  var T_DAY = Date.UTC(2026, 9, 12, 8, 20);      // the day team's first call, 08:20

  var CHECK_MIN = { q3: 3, q6: 6, call: 7 };
  var APPROVER_MIN = 4;
  var ALERT_MIN = 2;

  // The 214 resets, built by the stated rule above.
  var ROWS = (function () {
    var out = [];
    for (var g = 0; g < 213; g++) {
      var day = Math.floor(g * 29 / 213);
      var night = g % 7 === 3 || g % 7 === 4;
      var off = night ? 720 + (g * 53) % 720 : (g * 37) % 720;
      out.push({
        n: g + 1, t: T0 + (day * 1440 + off) * MIN, night: night, priv: g % 21 === 5,
        reach: g % 13 !== 7, dev: g % 10 < 7 ? 4 + (g % 9) * 6 : null, real: true
      });
    }
    out.push({ n: 214, t: T_RESET, night: true, priv: true, reach: true, dev: 11, real: false });
    return out;
  })();
  var LAST = ROWS[213];

  var CHECKS = [
    { value: "q3", label: "3 personal questions (as found)" },
    { value: "q6", label: "6 personal questions" },
    { value: "call", label: "call back on the number on file" }
  ];
  var SHOW = [
    { value: "r214", label: "the 02:40 reset only" },
    { value: "priv", label: "privileged accounts (11)" },
    { value: "night", label: "night resets (61)" },
    { value: "all", label: "all 214" }
  ];

  /* ---------- small helpers ---------- */

  function hm(t) {
    var x = new Date(t);
    return ("0" + x.getUTCHours()).slice(-2) + ":" + ("0" + x.getUTCMinutes()).slice(-2);
  }
  function when(t) {
    var x = new Date(t);
    return WEEKDAYS[x.getUTCDay()] + " " + x.getUTCDate() + " " + MONTHS[x.getUTCMonth()] + " " + hm(t);
  }
  function thousands(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // One reset under policy C: its check, whether the owner was reached, its outcome and minutes.
  function judge(C, r) {
    var held = C.nightHold && r.night;
    var o = { held: held, reached: C.check === "call" && r.reach, minutes: CHECK_MIN[C.check] + (C.approver && r.priv ? APPROVER_MIN : 0) };
    if (C.check === "call") {
      if (!r.reach) o.kind = "badge";
      else if (!r.real) o.kind = "stopped";
      else o.kind = "done";
    } else o.kind = "done";
    o.device = o.kind !== "stopped" && r.dev !== null;
    return o;
  }

  function checkText(C) {
    if (C.check === "call") return "call back on file";
    return (C.check === "q3" ? 3 : 6) + " questions";
  }

  function outcomeText(C, r, o) {
    if (o.kind === "badge") return "held: badge check at the security desk";
    if (o.kind === "stopped") return "stopped: owner asked for nothing";
    return C.check === "call" ? "done: owner confirmed" : "done on " + (C.check === "q3" ? 3 : 6) + " answers";
  }

  function month(C) {
    var s = { done: 0, held: 0, stopped: 0, reached: 0, minutes: 0, alerts: 0, nightHeld: 0 };
    ROWS.forEach(function (r) {
      var o = judge(C, r);
      if (o.kind === "done") s.done += 1;
      if (o.kind === "badge") s.held += 1;
      if (o.kind === "stopped") s.stopped += 1;
      if (o.reached) s.reached += 1;
      if (o.held) s.nightHeld += 1;
      if (C.alert && o.device) s.alerts += 1;
      s.minutes += o.minutes;
    });
    s.perReset = Math.round(s.minutes / ROWS.length * 10) / 10;
    s.leadMinutes = s.alerts * ALERT_MIN;
    return s;
  }

  // The 02:40 reset, told as its outcome lines.
  function story(C) {
    var o = judge(C, LAST);
    var at = o.held ? T_DAY : T_RESET;
    var res = {};
    if (o.kind === "stopped") {
      res.r0240 = o.held ? "stopped: at 08:20 the day team rang her own phone; she had asked for nothing" :
        "stopped: her own phone rang at 02:40 and she had asked for nothing";
      res.newdev = "none";
      res.after = "nothing: no reset, so no new device";
      return res;
    }
    var n = C.check === "q3" ? 3 : 6;
    res.r0240 = o.held ? "held until morning; the day team reset it at 08:20 on " + n + " answers" :
      "reset done at 02:40 on " + n + " answers";
    if (C.approver) res.r0240 += "; the second approver agreed on the same answers";
    var dev = at + LAST.dev * MIN;
    res.newdev = "a new device signed in at " + hm(dev) + " and registered a new " + (C.passkeys ? "passkey" : "second proof");
    if (C.alert) {
      res.after = "alert at " + hm(dev) + " to the duty manager; she rang Ms Ojukwu on file at " + hm(dev + 2 * MIN) +
        " and suspended the account at " + hm(dev + 7 * MIN);
    } else {
      res.after = hm(dev) + " to " + hm(dev + 29 * MIN) + ": opened the supplier payment records; no alert went to anyone";
    }
    return res;
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, txt) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (txt) e.textContent = txt;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    var wrap = el("div", "overflow:auto;max-height:320px;");
    var table = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
    wrap.appendChild(table);
    box.appendChild(head);
    box.appendChild(wrap);
    api.root.appendChild(box);
    return { el: el, head: head, table: table };
  }

  function row(ui, cells, bold) {
    var tr = ui.el("tr");
    cells.forEach(function (c) { tr.appendChild(ui.el(bold ? "th" : "td", "text-align:left;padding:2px 6px;vertical-align:top;", String(c))); });
    ui.table.appendChild(tr);
  }

  function shown(show, r) {
    if (show === "r214") return r.n === 214;
    if (show === "priv") return r.priv;
    if (show === "night") return r.night;
    return true;
  }

  function draw(api) {
    var S = api.state, C = S.C, ui = S.ui;
    ui.head.textContent = "Check: " + checkText(C) + ". Privileged second approver " + (C.approver ? "on" : "off") +
      ". Number matching " + (C.matching ? "on" : "off") + ". Passkeys " + (C.passkeys ? "on" : "off") +
      ". Warning on a reset then new device within 60 minutes " + (C.alert ? "on" : "off") +
      ". Night resets " + (C.nightHold ? "held for the day team" : "allowed") + "." + (S.ran ? "" : " Press Run the 30 days.");
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["no.", "when", "account", "check", "owner reached", "new device after", "outcome", "agent min"], true);
    if (!S.ran) {
      row(ui, ["-", "not run yet", "-", "-", "-", "-", "-", "-"]);
    } else {
      ROWS.forEach(function (r) {
        if (!shown(S.show, r)) return;
        var o = judge(C, r);
        row(ui, [
          r.n,
          when(r.t) + (o.held ? ", held to 08:00" : ""),
          r.n === 214 ? "Ms Ojukwu, finance (privileged)" : (r.priv ? "staff (privileged)" : "staff"),
          checkText(C) + (C.approver && r.priv ? " + second approver" : ""),
          o.reached ? "yes" : (C.check === "call" ? "no: number on file did not reach" : "no: questions only"),
          o.device ? r.dev + " min later" : "-",
          outcomeText(C, r, o),
          o.minutes
        ]);
      });
    }
    var st = S.stat;
    if (!S.ran) {
      ["resets", "priv", "night", "done", "held", "stopped", "reached", "minutes", "perReset", "alerts", "leadMinutes", "nightHeld", "r0240", "newdev", "after"].forEach(function (k) { st[k]("not run"); });
    } else {
      var M = month(C), R = story(C);
      st.resets(ROWS.length);
      st.priv(ROWS.filter(function (r) { return r.priv; }).length);
      st.night(ROWS.filter(function (r) { return r.night; }).length);
      st.done(M.done);
      st.held(M.held);
      st.stopped(M.stopped);
      st.reached(M.reached);
      st.minutes(thousands(M.minutes));
      st.perReset(M.perReset);
      st.alerts(C.alert ? M.alerts : "alert off");
      st.leadMinutes(C.alert ? M.leadMinutes : "alert off");
      st.nightHeld(M.nightHeld);
      st.r0240(R.r0240);
      st.newdev(R.newdev);
      st.after(R.after);
    }
    st.matching(C.matching ? "on: it checks the prompt against the second proof registered after the reset, so 02:40 is unchanged" : "off");
    st.passkeys(C.passkeys ? "on: a reset wipes the passkey too, and the next device registers its own" : "off");
  }

  function runMonth(api) {
    var S = api.state, C = S.C;
    S.ran = true;
    var M = month(C), R = story(C);
    api.log("30 days, Sat 12 Sep 08:00 to Mon 12 Oct 08:00: " + ROWS.length + " resets, check: " + checkText(C) + ".", "");
    if (C.nightHold) api.log(M.nightHeld + " night resets held for the day team.", "warn");
    api.log("Mon 12 Oct 02:40, Ms Ojukwu's account: " + R.r0240 + ".", R.newdev === "none" ? "ok" : "bad");
    if (R.newdev !== "none") api.log("After it: " + R.newdev + "; " + R.after + ".", C.alert ? "warn" : "bad");
    api.log("Month: " + M.done + " done, " + M.held + " held for a badge check, " + M.stopped + " stopped; owners reached " + M.reached +
      "; agent minutes " + thousands(M.minutes) + ".", "");
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    S.ran = false;
    api.log((why ? why + " " : "") + "Before the 30 days: no resets replayed yet.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e11", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { check: "q3", approver: false, matching: false, passkeys: false, alert: false, nightHold: false };
      S.show = "r214";
      S.ran = false;
      S.ui = buildWidget(api);
      function opt(key, conv) { return function (v) { S.C[key] = conv(v); restart(api, "Settings changed."); }; }
      function bool(v) { return !!v; }
      api.control.select("check", "Identity check before a reset", CHECKS, "q3", opt("check", String));
      api.control.toggle("approver", "Privileged resets need a second approver", false, opt("approver", bool));
      api.control.toggle("matching", "Number matching on sign-in prompts", false, opt("matching", bool));
      api.control.toggle("passkeys", "Passkeys for staff", false, opt("passkeys", bool));
      api.control.toggle("alert", "Warn on a reset then new device within 60 minutes", false, opt("alert", bool));
      api.control.toggle("nightHold", "Hold night resets for the day team", false, opt("nightHold", bool));
      api.control.select("show", "Rows shown", SHOW, "r214", function (v) { S.show = String(v); draw(api); });
      api.control.button("run", "Run the 30 days", function () { runMonth(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        resets: api.stat("resets", "resets in the 30 days", ""),
        priv: api.stat("priv", "on privileged accounts", ""),
        night: api.stat("night", "at night, 20:00 to 08:00", ""),
        done: api.stat("done", "resets done", ""),
        held: api.stat("held", "held for a badge check", "warn"),
        stopped: api.stat("stopped", "resets stopped", "ok"),
        reached: api.stat("reached", "owners reached on their own phone", "ok"),
        minutes: api.stat("minutes", "agent minutes in the 30 days", ""),
        perReset: api.stat("perReset", "agent minutes per reset", ""),
        alerts: api.stat("alerts", "alerts in the 30 days", ""),
        leadMinutes: api.stat("leadMinutes", "duty manager minutes on alerts", ""),
        nightHeld: api.stat("nightHeld", "night resets held for the day team", ""),
        r0240: api.stat("r0240", "the 02:40 reset", "bad"),
        newdev: api.stat("newdev", "new device after 02:40", "bad"),
        after: api.stat("after", "what followed", "warn"),
        matching: api.stat("matching", "number matching", ""),
        passkeys: api.stat("passkeys", "passkeys", "")
      };
      api.info("<strong>How to read it.</strong> Each row is one reset from the 30 days to 08:00 on Monday 12 October: when it happened, whose account, the check used, whether the real owner was reached on their own phone, whether a new device signed in after it, the outcome, and the agent minutes it cost. The 213 ordinary resets follow a stated rule, not chance; row 214 is the 02:40 reset on Ms Ojukwu's account. A reset wipes the old second proof and gives a temporary password; the next device to sign in registers a new second proof. Number matching shows a number on the sign-in screen that must be typed into the app on the registered phone. A passkey is a sign-in key on the staff member's own phone that answers only the real sign-in page. The sim holds no call content: only each check and its outcome.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens before the 30 days are replayed.
      t.expect(t.stat("resets") === "not run" && t.stat("r0240") === "not run" && t.stat("matching") === "off",
        "Opens before the 30 days: nothing replayed yet");

      // 2. As found: 214 resets, 11 privileged, 61 at night, all done on 3 answers, nobody reached.
      t.click("run");
      t.expect(t.stat("resets") === 214 && t.stat("priv") === 11 && t.stat("night") === 61 && t.stat("done") === 214 &&
        t.stat("reached") === 0 && t.stat("minutes") === 642 && t.stat("perReset") === 3,
        "As found: 214 resets, 11 privileged, 61 at night, all done, no owner reached, 642 agent minutes");

      // 3. As found, the 02:40 reset goes through and a new device follows at 02:51.
      t.expect(t.stat("r0240") === "reset done at 02:40 on 3 answers" &&
        t.stat("newdev") === "a new device signed in at 02:51 and registered a new second proof" &&
        t.stat("after") === "02:51 to 03:20: opened the supplier payment records; no alert went to anyone" &&
        has("Mon 12 Oct 02:40, Ms Ojukwu's account: reset done at 02:40 on 3 answers."),
        "As found: the 02:40 reset is done on 3 answers and a new device signs in at 02:51");

      // 4. Option 0: six personal questions.
      t.set("check", "q6");
      t.click("run");
      t.expect(t.stat("r0240") === "reset done at 02:40 on 6 answers" && t.stat("reached") === 0 &&
        t.stat("minutes") === "1,284" && t.stat("perReset") === 6,
        "Six questions: still done, still no owner reached, 1,284 agent minutes");

      // 5. Option 1 (ok): call back on the number on file.
      t.set("check", "call");
      t.click("run");
      t.expect(t.stat("r0240") === "stopped: her own phone rang at 02:40 and she had asked for nothing" &&
        t.stat("newdev") === "none" && t.stat("reached") === 198 && t.stat("done") === 197 && t.stat("held") === 16 &&
        t.stat("stopped") === 1 && t.stat("minutes") === "1,498" && t.stat("perReset") === 7,
        "Call back on file: the 02:40 reset stops; 198 owners reached, 16 held for a badge check, 1,498 minutes");

      // 6. Call back with the second approver: 44 more minutes, 7.2 a reset.
      t.set("approver", true);
      t.click("run");
      t.expect(t.stat("minutes") === "1,542" && t.stat("perReset") === 7.2,
        "Second approver on 11 privileged resets: 1,542 agent minutes, 7.2 a reset");

      // 7. Second approver with the old questions: agrees on the same answers.
      t.set("check", "q3");
      t.click("run");
      t.expect(t.stat("r0240") === "reset done at 02:40 on 3 answers; the second approver agreed on the same answers",
        "Second approver alone: agrees on the same three answers");

      // 8. Option 2: passkeys, old questions. Still done; the new device registers its own passkey.
      t.set("approver", false);
      t.set("passkeys", true);
      t.click("run");
      t.expect(t.stat("r0240") === "reset done at 02:40 on 3 answers" &&
        t.stat("newdev") === "a new device signed in at 02:51 and registered a new passkey" &&
        t.stat("passkeys") === "on: a reset wipes the passkey too, and the next device registers its own",
        "Passkeys: the reset still wipes the passkey, and the new device registers its own");

      // 9. Number matching changes nothing at 02:40.
      t.set("passkeys", false);
      t.set("matching", true);
      t.click("run");
      t.expect(t.stat("r0240") === "reset done at 02:40 on 3 answers" &&
        t.stat("newdev") === "a new device signed in at 02:51 and registered a new second proof",
        "Number matching: the 02:40 reset and the new device are unchanged");

      // 10. Option 3: night resets held for the day team.
      t.set("matching", false);
      t.set("nightHold", true);
      t.click("run");
      t.expect(t.stat("nightHeld") === 61 && t.stat("done") === 214 &&
        t.stat("r0240") === "held until morning; the day team reset it at 08:20 on 3 answers" &&
        t.stat("newdev") === "a new device signed in at 08:31 and registered a new second proof",
        "Night resets held: 61 wait; the day team resets it at 08:20 on the same questions; new device at 08:31");

      // 11. The alert: 151 in the 30 days as found; at 02:51 the duty manager suspends the account at 02:58.
      t.set("nightHold", false);
      t.set("alert", true);
      t.click("run");
      t.expect(t.stat("alerts") === 151 && t.stat("leadMinutes") === 302 &&
        t.stat("after") === "alert at 02:51 to the duty manager; she rang Ms Ojukwu on file at 02:53 and suspended the account at 02:58",
        "Alert on: 151 alerts and 302 duty manager minutes; the 02:40 account is suspended at 02:58");
    }
  });
})();
