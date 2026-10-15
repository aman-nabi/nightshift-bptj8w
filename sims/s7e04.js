/* sims/s7e04-v1.0.0.js  (published as sims/s7e04.js)
   Case s7e04 "Tokens": a token lab for Fairbrass Carnival. Rupert leaves the staff list on Friday
   9 October at 18:00; his tile on the big wheel's tablet holds token 3861, issued 22 September 16:10
   for 30 days. The learner picks the token lifetime, how a token can be cancelled, sign-out at
   closing, tablet binding and the signing-method rule, then plays Friday 18:00 to Tuesday 23:59 and
   reads whether Tuesday's 23:40 start is accepted, how long token 3861 still worked after Rupert
   left, and what the choice costs. Widget-style sim: it draws inside api.root.
   It models the defence and its numbers only. No token is made, changed, decoded or forged here;
   tokens are labels.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: lifetime (30 days, one hour with no renewal, ten minutes with
     renewal); cancelling (none, deny list synced nightly at 04:00, staff-list check at renewal);
     sign-out at 23:00 closing; tablet binding; accept only the expected signing method. Stats:
     Tuesday 23:40 start, window after removal, server checks in the busiest hour, password
     sign-ins per operator per night, signing method accepted. selfTest: 11 assertions.

   The model (stated in sim.lede), times in minutes after Friday 9 October 18:00 (t = 0):
   - t = 0: Rupert hands in his badge and leaves the staff list (42 becomes 41).
   - Tuesday 13 October 23:40 is t = 6,100 (4 days 5 h 40 min). The play ends at 23:59, t = 6,119.
   - Token 3861 was issued 22 September 16:10 and runs 30 days, to 22 October 16:10: that is
     12 d 22 h 10 min after Friday 18:00, t = 18,610.
   - One hour, no renewal: as given data his last sign-in under that rule is Friday 17:25, so his
     token runs out at 18:25, t = 25.
   - Ten minutes with renewal: his last short token comes with his STOP at 17:52 (from the ride
     log), so it runs out at 18:02, t = 2. With the staff-list check the next renewal is refused.
     With no check, renewal goes on until the 30-day refresh ticket runs out: t = 18,610 again.
   - Deny list synced nightly at 04:00: tablets learn on Saturday 04:00, t = 600 (10 h).
   - Sign-out at 23:00 closing: his tile is deleted on Friday 23:00, t = 300 (5 h). Signing in again
     needs a name on the staff list, so after that his tile cannot come back.
   - Tablet binding: token 3861 was issued on the wheel's own tablet, and Tuesday's start came from
     it, so binding changes nothing.
   - Signing-method rule: token 3861 was genuinely signed, so the rule changes nothing tonight.
   - The window is the earliest of these that applies. Tuesday's start is accepted when the window
     is still open at t = 6,100.
   Where every number comes from (conventions rule 14; the case is content/s7/s7e04-v1.0.0.json):
   - 12 d 22 h 10 min, 25 min, 2 min, 10 h, 5 h: the windows above.
   - Server checks in the busiest hour: as given data, 20 sign-ins in use; one-hour tokens 20
     (each signs in once an hour); ten-minute tokens 20 x 6 = 120; 30-day tokens 0. The nightly
     deny-list download is once a night, 0 in the busiest hour.
   - Password sign-ins per operator per night: a night is six hours (17:00 to 23:00), so one-hour
     tokens mean 6; sign-out at closing alone means 1; otherwise 0 (tiles, or silent renewal).
   - From the post, not modelled: 14 rides, the 23:49 STOP, token 3907 at 22:58, the 23:05 padlock,
     the 23:51 arrival.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var T_TUESDAY = 6100;        // Tuesday 23:40, minutes after Friday 18:00
  var T_TOKEN_END = 18610;     // 22 October 16:10
  var T_HOUR_END = 25;         // Friday 18:25
  var T_TEN_END = 2;           // Friday 18:02
  var T_DENY = 600;            // Saturday 04:00
  var T_SIGNOUT = 300;         // Friday 23:00
  var BUSY_SIGNINS = 20;
  var NIGHT_HOURS = 6;
  var STAFF_BEFORE = 42;

  var LIVES = [
    { value: "30d", label: "30 days (as built)" },
    { value: "1h", label: "One hour, nothing to renew it" },
    { value: "10m", label: "Ten minutes, renewed with a 30-day ticket" }
  ];
  var REVOKES = [
    { value: "none", label: "No way to cancel (as built)" },
    { value: "deny", label: "Deny list, synced nightly at 04:00" },
    { value: "check", label: "Staff-list check at every renewal" }
  ];
  var LIFE_SHORT = { "30d": "30 days", "1h": "one hour", "10m": "ten minutes with renewal" };
  var REVOKE_SHORT = { none: "none", deny: "deny list at 04:00", check: "staff-list check at renewal" };

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  function dur(min) {
    var d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    var s = [];
    if (d) s.push(d + " d");
    if (h) s.push(h + " h");
    if (m || !s.length) s.push(m + " min");
    return s.join(" ");
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // Each mechanism that ends token 3861's working life: { t, line, why }.
  function enders(C) {
    var out = [];
    if (C.life === "1h") {
      out.push({ t: T_HOUR_END, line: "Fri 18:25 His one-hour token, from his 17:25 sign-in, runs out.", why: "his one-hour token ran out on Friday at 18:25" });
    } else if (C.life === "10m" && C.revoke === "check") {
      out.push({ t: T_TEN_END, line: "Fri 18:02 His short token, from his 17:52 STOP, runs out. From now on every renewal is refused: not on the staff list.", why: "the server refused to renew it: not on the staff list" });
    } else {
      out.push({ t: T_TOKEN_END, line: "", why: "" });
    }
    if (C.revoke === "deny") {
      out.push({ t: T_DENY, line: "Sat 04:00 Nightly sync: every tablet downloads the deny list, with token 3861 on it.", why: "token 3861 is on the deny list since Saturday 04:00" });
    }
    if (C.signout) {
      out.push({ t: T_SIGNOUT, line: "Fri 23:00 Closing: every tablet is signed out, and his tile is deleted. The token itself is still good.", why: "his tile was deleted at Friday's closing, and signing in again needs a name on the staff list" });
    }
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }

  function windowMin(C) { return enders(C)[0].t; }

  function checksPerHour(C) {
    if (C.life === "10m") return BUSY_SIGNINS * 6;
    if (C.life === "1h") return BUSY_SIGNINS;
    return 0;
  }

  function signinsPerNight(C) {
    if (C.life === "1h") return NIGHT_HOURS;
    return C.signout ? 1 : 0;
  }

  function play(C) {
    var e = enders(C);
    var w = e[0].t;
    return { window: w, accepted: w > T_TUESDAY, why: e[0].why, enders: e };
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    var key = el("p", "margin:0;font-size:12px;", "Timeline of token 3861, Rupert's tile on the big wheel's tablet. Each line shows the day and time, what happened, and the tablet's answer.");
    var line = el("pre", "margin:0;font-size:12px;white-space:pre-wrap;");
    var bar = el("div", "position:relative;height:14px;border:1px solid currentColor;border-radius:3px;overflow:hidden;");
    var fill = el("div", "position:absolute;left:0;top:0;bottom:0;width:0;background:currentColor;opacity:0.35;");
    bar.appendChild(fill);
    var barKey = el("p", "margin:0;font-size:11px;", "Shaded: how much of Friday 18:00 to Tuesday 23:59 token 3861 still worked.");
    box.appendChild(head);
    box.appendChild(key);
    box.appendChild(line);
    box.appendChild(bar);
    box.appendChild(barKey);
    api.root.appendChild(box);
    return { head: head, line: line, fill: fill };
  }

  function timelineText(C, out) {
    var rows = [
      "22 Sep 16:10  token 3861 issued on the wheel's tablet, good to 22 Oct 16:10",
      "Fri 17:52     STOP, token 3861: accepted (his last shift)",
      "Fri 18:00     badge handed in; staff list " + STAFF_BEFORE + " -> " + (STAFF_BEFORE - 1)
    ];
    if (!out) {
      rows.push("...           play to Tuesday 23:59 to see the rest");
      return rows.join("\n");
    }
    out.enders.forEach(function (e) {
      if (e.line && e.t <= T_TUESDAY) rows.push(e.line.replace(/^(\S+ \S+) /, function (m0, a) { return (a + "          ").slice(0, 14); }));
    });
    rows.push("Tue 23:40     START, token 3861: " + (out.accepted ? "accepted" : "refused"));
    if (out.accepted) rows.push("Tue 23:49     STOP, token 3861: accepted");
    return rows.join("\n");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "Lifetime: " + LIFE_SHORT[C.life] + ". Cancelling: " + REVOKE_SHORT[C.revoke] +
      ". Sign-out at closing: " + (C.signout ? "on" : "off") + ". Tied to its tablet: " + (C.bind ? "on" : "off") +
      ". Expected signing method only: " + (C.alg ? "on" : "off") + ".";
    ui.line.textContent = timelineText(C, S.out);
    var span = 6119;
    ui.fill.style.width = S.out ? (Math.min(S.out.window, span) / span * 100).toFixed(2) + "%" : "0%";

    S.stat.checks(String(checksPerHour(C)));
    S.stat.signins(String(signinsPerNight(C)));
    S.stat.alg(C.alg ? "expected method only" : "whatever the token names");
    if (!S.out) {
      S.stat.tuesday("not run yet");
      S.stat.window("not run yet");
      return;
    }
    S.stat.tuesday(S.out.accepted ? "accepted" : "refused");
    S.stat.window(dur(S.out.window));
  }

  // Any change replays from before Friday 18:00.
  function change(api, what) {
    api.state.out = null;
    api.log(what + " Set back to before Friday 18:00.", "");
    draw(api);
  }

  function run(api) {
    var S = api.state;
    var C = S.C;
    if (S.out) {
      api.log("Already played to Tuesday 23:59. Change a setting or reset to replay.", "");
      return;
    }
    var o = play(C);
    api.log("Fri 18:00 Rupert hands in his badge; staff list " + STAFF_BEFORE + " -> " + (STAFF_BEFORE - 1) + ". No tablet hears of it.", "");
    if (C.revoke === "check" && C.life !== "10m") {
      api.log("Staff-list check at renewal is on, but " + LIFE_SHORT[C.life] + " tokens are never renewed, so it never runs.", "warn");
    }
    o.enders.forEach(function (e) { if (e.line && e.t <= T_TUESDAY) api.log(e.line, "ok"); });
    if (C.bind) api.log("Tied to its tablet: token 3861 was made on the wheel's tablet, and every tap comes from it, so the binding check passes.", "warn");
    api.log(C.alg ? "Signing-method rule on: tablets accept only the office's one method. Token 3861 was genuinely signed, so this changes nothing tonight; it closes a different door."
      : "Signing-method rule off: tablets trust the method a token names. Token 3861 was genuinely signed, so nothing changes tonight.", "");
    if (o.accepted) {
      api.log("Tue 23:40 START, token 3861: accepted. Seal good, date ahead (22 Oct 16:10). The wheel turns empty.", "bad");
      api.log("Window after Rupert left: " + dur(o.window) + ".", "bad");
    } else {
      api.log("Tue 23:40 START, token 3861: refused, because " + o.why + ". The wheel never moves.", "ok");
      api.log("Window after Rupert left: " + dur(o.window) + ".", "ok");
    }
    S.out = o;
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e04", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { life: "30d", revoke: "none", signout: false, bind: false, alg: false };
      S.out = null;
      S.ui = buildWidget(api);
      S.ctl = {};

      S.ctl.life = api.control.select("life", "Token lifetime", LIVES, "30d", function (v) {
        var o = pick(LIVES, v);
        if (!o) return;
        S.C.life = String(o.value);
        change(api, "Lifetime: " + LIFE_SHORT[S.C.life] + ".");
      });
      S.ctl.revoke = api.control.select("revoke", "Cancelling a token", REVOKES, "none", function (v) {
        var o = pick(REVOKES, v);
        if (!o) return;
        S.C.revoke = String(o.value);
        change(api, "Cancelling: " + REVOKE_SHORT[S.C.revoke] + ".");
      });
      S.ctl.signout = api.control.toggle("signout", "Sign every tablet out at 23:00 closing", false, function (on) {
        S.C.signout = !!on;
        change(api, "Sign-out at closing: " + (on ? "on." : "off."));
      });
      S.ctl.bind = api.control.toggle("bind", "Tie each token to the tablet it was issued on", false, function (on) {
        S.C.bind = !!on;
        change(api, "Tied to its tablet: " + (on ? "on." : "off."));
      });
      S.ctl.alg = api.control.toggle("alg", "Accept only the expected signing method", false, function (on) {
        S.C.alg = !!on;
        change(api, "Expected signing method only: " + (on ? "on." : "off."));
      });
      S.ctl.run = api.control.button("run", "Play Friday 18:00 to Tuesday 23:59", function () { run(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        tuesday: api.stat("tuesday", "Tuesday 23:40 start", "bad"),
        window: api.stat("window", "token 3861 still worked after Rupert left", "warn"),
        checks: api.stat("checks", "server checks in the busiest hour", ""),
        signins: api.stat("signins", "password sign-ins per operator per night", ""),
        alg: api.stat("alg", "signing method the tablet accepts", "")
      };

      api.info("<strong>How to read it.</strong> Each tap on a tile is checked on the tablet alone: is the seal good and is the date still ahead. Nothing on the tablet hears that the staff list changed. A short lifetime, a renewal the server can refuse, a deny list or a sign-out each end token 3861's working life at a different moment; the earliest one wins. Short tokens cost server checks; sign-outs and one-hour tokens cost password sign-ins.");

      api.log("Before Friday 18:00, as built: 30-day tokens, no way to cancel one. Rupert's tile holds token 3861, good to 22 Oct 16:10.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: before Friday 18:00, nothing played yet.
      t.expect(t.stat("tuesday") === "not run yet" && t.stat("window") === "not run yet" && t.stat("checks") === 0 &&
        t.stat("signins") === 0 && t.stat("alg") === "whatever the token names",
        "Opens before Friday 18:00 as built: 30-day tokens, no server checks, nothing played");

      // 2. As built: Tuesday's start is accepted, and the token works 12 d 22 h 10 min after he left.
      t.click("run");
      t.expect(t.stat("tuesday") === "accepted" && t.stat("window") === "12 d 22 h 10 min" &&
        has("Tue 23:40 START, token 3861: accepted."),
        "As built: Tuesday 23:40 accepted; token 3861 still works 12 d 22 h 10 min after Rupert left");

      // 3. The ok option: ten-minute tokens, renewal checks the staff list.
      t.set("life", "10m");
      t.set("revoke", "check");
      t.click("run");
      t.expect(t.stat("tuesday") === "refused" && t.stat("window") === "2 min" && t.stat("checks") === 120 &&
        has("From now on every renewal is refused: not on the staff list."),
        "Ten-minute tokens with a staff-list check: refused, window 2 min, 120 server checks in the busiest hour");

      // 4. Ten-minute tokens renewed with no check: as bad as before, and the checks are spent for nothing.
      t.set("revoke", "none");
      t.click("run");
      t.expect(t.stat("tuesday") === "accepted" && t.stat("window") === "12 d 22 h 10 min" && t.stat("checks") === 120,
        "Ten-minute tokens renewed with no check: accepted, 12 d 22 h 10 min, 120 checks for nothing");

      // 5. Option 0: one-hour tokens, no renewal.
      t.set("life", "1h");
      t.click("run");
      t.expect(t.stat("tuesday") === "refused" && t.stat("window") === "25 min" && t.stat("checks") === 20 && t.stat("signins") === 6,
        "One-hour tokens: refused, window 25 min, 20 checks an hour, 6 password sign-ins a night");

      // 6. Option 1: sign-out at closing with 30-day tokens.
      t.set("life", "30d");
      t.set("signout", true);
      t.click("run");
      t.expect(t.stat("tuesday") === "refused" && t.stat("window") === "5 h" && t.stat("signins") === 1 && t.stat("checks") === 0,
        "Sign-out at closing: Tuesday refused, window 5 h, 1 password sign-in a night");

      // 7. Option 3: tablet binding alone changes nothing.
      t.set("signout", false);
      t.set("bind", true);
      t.click("run");
      t.expect(t.stat("tuesday") === "accepted" && t.stat("window") === "12 d 22 h 10 min" &&
        has("binding check passes"),
        "Tablet binding: token 3861 is used on its own tablet, so Tuesday is accepted");

      // 8. Deny list synced nightly at 04:00.
      t.set("bind", false);
      t.set("revoke", "deny");
      t.click("run");
      t.expect(t.stat("tuesday") === "refused" && t.stat("window") === "10 h" && t.stat("checks") === 0,
        "Deny list synced nightly at 04:00: refused, window 10 h, no checks in the busiest hour");

      // 9. The signing-method rule closes a different door: Tuesday is still accepted under 30-day tokens.
      t.set("revoke", "none");
      t.set("alg", true);
      t.click("run");
      t.expect(t.stat("tuesday") === "accepted" && t.stat("alg") === "expected method only" &&
        has("it closes a different door"),
        "Signing-method rule on: still accepted, because token 3861 was genuinely signed");

      // 10. A staff-list check with no renewal never runs.
      t.set("alg", false);
      t.set("revoke", "check");
      t.click("run");
      t.expect(t.stat("tuesday") === "accepted" && t.stat("window") === "12 d 22 h 10 min" && has("so it never runs"),
        "Staff-list check with 30-day tokens: never runs, Tuesday accepted");

      // 11. The ok option plus sign-out: still 2 min, the earliest ending wins.
      t.set("life", "10m");
      t.set("signout", true);
      t.click("run");
      t.expect(t.stat("tuesday") === "refused" && t.stat("window") === "2 min" && t.stat("signins") === 1,
        "Ten-minute tokens with the check and sign-out: the 2 min renewal refusal comes first");
    }
  });
})();
