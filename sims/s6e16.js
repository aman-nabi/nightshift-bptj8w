/* sims/s6e16-v1.0.0.js  (published as sims/s6e16.js)
   Case s6e16 "The Chaos Monkey": a game-day lab for Quernmoor Zoo's north hub. Two live door
   controllers (main and backup), a test copy (test main, test backup and one bench door), the radio
   hub, and four live keeper doors: the big-cat house, the ape house, the reptile house and the feed
   store. The learner picks what is switched off, whether the test copy shares the hub, which live
   doors the test's group reaches, a stop rule, the doors' silent rule and the hour, then runs the
   night one second at a time from 02:09:30 to 02:13:00 and reads the test report against the live
   door log.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: switched off: test backup (tonight), live backup locks up, nothing;
     hub shared or the test copy's own; scope all four doors (the copied group) or one door (the feed
     store); stop rule none or 10 s; silent rule unlock after 30 s or stay locked; 02:00 or 14:00.
     Buttons: forward 1 second, forward 10 seconds, run to the 30-second mark, run to the end, start
     again, reset. selfTest: 11 assertions.

   The model (stated in the post and sim.lede):
   - One step is one second. The night opens at 02:09:30 with nothing run; each step moves the clock
     on one second and runs it. Order inside a second: the main's roll call (on the even minute),
     the main's 'all well' (every 5 s), the test or fault (02:10:00), the test main's claim of the
     bench door (02:10:02), the stop rule, then each door's 30-second silence check.
   - A door obeys the controller that claimed it and counts 'all well' only from that controller.
     The live main claims every live door in its roll call, every two minutes on the even minute
     (02:10:00 and 02:12:00 in this window), and says 'all well' every 5 seconds.
   - A controller being switched off says 'controller down' to its whole group of doors. A door
     that hears it forgets its controller and waits to be claimed. The test copy was copied from
     live, group name and all, so on the shared hub its 'controller down' reaches the live doors
     in its group (all four as copied; one, the feed store, when the scope is one door).
   - Each pair of controllers watches its partner over a cable, not the hub. So the test main sees
     the test backup go and claims the bench door 2 s later, while the live backup sees nothing
     wrong with the live main and does nothing. A live backup that locks up and restarts (a real
     fault) also says 'controller down' to the live group as it goes.
   - Fire rule: a door with no 'all well' from its controller for 30 s unlocks. With the silent rule
     changed to stay locked, it stays locked and the log says the fire rule is broken.
   - Stop rule (game days only): if any live door has had no controller for 10 s, the test stops
     and the live main sends a roll call at once.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e16-v1.0.0.json):
   - Tonight (test backup, shared hub, all four, no stop rule, unlock after 30 s, 02:00): the roll
     call and 'all well' at 02:10:00 go out a moment before the test, so each door last heard its
     controller at 02:10:00. The test's 'controller down' at 02:10:00 reaches all four live doors.
     02:10:29: locked, unclaimed. 02:10:30: 30 s of silence, all four UNLOCKED, card: none. 02:10:02:
     the test main claims the bench door; test report "PASS: test main took over in 2 s. Test copy
     only, no live effect." 02:12:00: the roll call claims all four, LOCKED. Unlocked 02:10:30 to
     02:12:00, 90 s.
   - Own hub: no live door hears it; 0 unlocked; the report is the same PASS.
   - One door (feed store), no stop rule: the feed store alone unlocked 02:10:30 to 02:12:00.
   - One door with the 10 s stop rule: at 02:10:10 the stop rule fires and the main claims it again;
     0 unlocked.
   - Live backup locks up and restarts at 02:10:00, no test (option: stop game days): all four unlocked 02:10:30 to
     02:12:00; the report says "no game day tonight".
   - 14:00 (option: daytime): the same, 14:10:30 to 14:12:00, zoo open.
   - Stay locked (option: silent doors stay locked): 0 unlocked; fire rule kept: no.
   - Nothing switched off: four doors claimed and locked all through (the steady state).
*/
(function () {
  "use strict";

  var END = 210;     // 02:13:00, 210 s after 02:09:30
  var TEST = 30;     // 02:10:00
  var TAKE = 32;     // 02:10:02, the test main claims the bench door
  var FIRE = 30;     // seconds without 'all well' before a door unlocks
  var STOP = 10;     // the stop rule's limit
  var MARK = 60;     // 02:10:30

  var DOORS = [
    { id: "bigcat", name: "Big-cat house" },
    { id: "ape", name: "Ape house" },
    { id: "reptile", name: "Reptile house" },
    { id: "feed", name: "Feed store" }
  ];
  var OFFS = [
    { value: "test", label: "Test backup, in the test copy (tonight)" },
    { value: "live", label: "Live backup locks up and restarts (a real fault, no test)" },
    { value: "none", label: "Nothing (steady state only)" }
  ];
  var HUBS = [{ value: "shared", label: "Shared with live (tonight)" }, { value: "own", label: "Test copy on its own hub" }];
  var SCOPES = [{ value: "all", label: "All 4 keeper doors (copied group, tonight)" }, { value: "one", label: "One door: the feed store" }];
  var STOPS = [{ value: "none", label: "None (tonight)" }, { value: "10", label: "Stop if a live door has no controller for 10 s" }];
  var SILENT = [{ value: "unlock", label: "Unlock after 30 s (fire rule, tonight)" }, { value: "stay", label: "Stay locked (breaks the fire rule)" }];
  var HOURS = [{ value: "2", label: "02:00 (zoo closed)" }, { value: "14", label: "14:00 (zoo open)" }];

  /* ---------- small helpers ---------- */

  function two(n) { return n < 10 ? "0" + n : String(n); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return list[0];
  }

  /* ---------- the model ---------- */

  function newNight(C) {
    var R = {
      C: C, s: 0, stopped: false, opened: 0, firstOpen: -1, lastClose: -1, fireKept: true,
      report: C.off === "test" ? "not run yet" : "no game day tonight",
      bench: C.off === "test" ? "claimed by test backup" : "claimed",
      hubMsg: "'all well' from the live main",
      bigLog: [], events: [], doors: []
    };
    DOORS.forEach(function (d) {
      R.doors.push({ id: d.id, name: d.name, by: "main", heard: 0, locked: true, since: -1, warned: false });
    });
    return R;
  }
  function abs(R, s) { return R.C.hour * 3600 + 9 * 60 + 30 + s; }
  function clock(R, s) {
    var x = abs(R, s);
    return two(Math.floor(x / 3600) % 24) + ":" + two(Math.floor(x / 60) % 60) + ":" + two(x % 60);
  }
  function say(R, msg, tone) { R.events.push({ msg: clock(R, R.s) + " " + msg, tone: tone || "" }); }
  function doorSay(R, d, msg, tone) {
    say(R, d.name + " keeper door" + msg, tone);
    if (d.id === "bigcat") R.bigLog.push(clock(R, R.s) + msg.replace(/^:? ?/, " "));
  }

  function claimAll(R, why) {
    R.doors.forEach(function (d) {
      d.by = "main";
      d.heard = R.s;
      d.since = -1;
      if (!d.locked) {
        d.locked = true;
        R.lastClose = R.s;
        doorSay(R, d, ": LOCKED, claimed by main (" + why + "), card: none.", "ok");
      }
    });
  }

  function targets(R) {
    var C = R.C;
    if (C.off === "live") return R.doors.slice();
    if (C.off !== "test" || C.hub === "own") return [];
    if (C.scope === "one") return R.doors.filter(function (d) { return d.id === "feed"; });
    return R.doors.slice();
  }

  // Runs the next second.
  function stepSecond(R) {
    var C = R.C;
    R.s += 1;
    var s = R.s;
    var a = abs(R, s);
    if (a % 120 === 0) {
      say(R, "Live main's roll call: claims all 4 keeper doors.", "");
      R.hubMsg = "roll call from the live main";
      claimAll(R, "roll call");
    }
    if (a % 5 === 0) {
      R.doors.forEach(function (d) { if (d.by === "main") d.heard = s; });
    }
    if (s === TEST) {
      var list = targets(R);
      if (C.off === "test") {
        R.bench = "unclaimed";
        R.hubMsg = "'controller down' from the test backup";
        say(R, "Game day: the test backup is switched off. It says 'controller down' to its group" +
          (C.hub === "own" ? ", through the test copy's own hub." : ", through the north hub."), "warn");
      } else if (C.off === "live") {
        R.hubMsg = "'controller down' from the live backup";
        say(R, "The live backup's software locks up and restarts. It says 'controller down' to its group, through the north hub.", "bad");
      } else {
        say(R, "Nothing is switched off. Steady state: 4 keeper doors claimed and locked.", "ok");
      }
      list.forEach(function (d) {
        d.by = null;
        d.since = s;
        doorSay(R, d, " hears 'controller down'; waits to be claimed.", "warn");
      });
      if (C.off === "test" && !list.length) say(R, "Only the bench door hears it. No live door is on the test's hub.", "ok");
    }
    if (s === TAKE && C.off === "test") {
      R.bench = "claimed by test main";
      R.report = "PASS: test main took over in 2 s. Test copy only, no live effect.";
      say(R, "Test main claims the bench door. Test report: " + R.report, "");
    }
    if (C.stop === "10" && C.off === "test" && !R.stopped) {
      var late = R.doors.filter(function (d) { return d.by === null && s - d.since >= STOP; });
      if (late.length) {
        R.stopped = true;
        R.report += " Stopped by the stop rule at " + clock(R, s) + ".";
        say(R, "Stop rule: " + late[0].name + " keeper door has had no controller for 10 s. Test stopped; the main sends a roll call now.", "ok");
        R.hubMsg = "roll call from the live main (stop rule)";
        claimAll(R, "stop rule");
      }
    }
    R.doors.forEach(function (d) {
      if (d.by !== null || !d.locked || s - d.heard < FIRE) return;
      if (C.silent === "unlock") {
        d.locked = false;
        R.opened += 1;
        if (R.firstOpen < 0) R.firstOpen = s;
        doorSay(R, d, ": UNLOCKED, no 'all well' for 30 s, card: none.", "bad");
      } else if (!d.warned) {
        d.warned = true;
        R.fireKept = false;
        doorSay(R, d, ": 30 s without 'all well'; stays locked. The fire rule says it must open.", "bad");
      }
    });
  }

  function bigState(R) {
    var d = R.doors[0];
    if (!d.locked) return "UNLOCKED";
    return d.by ? "locked, claimed" : "locked, unclaimed";
  }
  function span(R) {
    if (R.firstOpen < 0) return "none";
    var open = R.doors.some(function (d) { return !d.locked; });
    return clock(R, R.firstOpen) + " to " + (open ? "still open" : clock(R, R.lastClose));
  }

  /* ---------- the widget ---------- */

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    clear(api.root);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;");
    var head = el("p", "margin:0;");
    var ctl = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;");
    var hub = el("p", "margin:0;border:1px dashed currentColor;border-radius:4px;padding:4px 6px;");
    var doors = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:4px;");
    var side = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px;");
    [head, ctl, hub, doors, side].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { el: el, head: head, ctl: ctl, hub: hub, doors: doors, side: side };
  }

  function card(ui, title, text, faded) {
    var c = ui.el("div", "border:1px solid currentColor;border-radius:4px;padding:4px 6px;" + (faded ? "opacity:0.5;" : ""));
    c.appendChild(ui.el("strong", "", title));
    c.appendChild(ui.el("div", "", text));
    return c;
  }

  function draw(api) {
    var S = api.state;
    var R = S.R;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "Switched off at " + clock(R, TEST) + ": " + pick(OFFS, C.off).label + ". Hub: " + pick(HUBS, C.hub).label +
      ". Test's group: " + pick(SCOPES, C.scope).label + ". Stop rule: " + pick(STOPS, C.stop).label +
      ". Silent doors: " + pick(SILENT, C.silent).label + ".";
    clear(ui.ctl);
    var liveBackupDown = C.off === "live" && R.s >= TEST;
    var testBackupDown = C.off === "test" && R.s >= TEST;
    ui.ctl.appendChild(card(ui, "Live main", "in charge; 'all well' every 5 s; roll call on the even minute", false));
    ui.ctl.appendChild(card(ui, "Live backup", liveBackupDown ? "restarted after locking up; idle" : "idle, ready", liveBackupDown));
    ui.ctl.appendChild(card(ui, "Test backup", testBackupDown ? "switched off" : (C.off === "test" ? "in charge of the bench door" : "idle"), testBackupDown));
    ui.ctl.appendChild(card(ui, "Test main", R.bench === "claimed by test main" ? "in charge of the bench door" : "waiting", false));
    ui.hub.textContent = (C.hub === "own" ? "North hub (live only); the test copy has its own hub. " : "North hub, shared by test and live, group name keeper-north in both. ") +
      "Last message through it: " + R.hubMsg + ". Bench door: " + R.bench + ".";
    clear(ui.doors);
    R.doors.forEach(function (d) {
      var st = !d.locked ? "UNLOCKED" : (d.by ? "locked, claimed by main" : "locked, unclaimed " + (R.s - d.heard) + " s");
      ui.doors.appendChild(card(ui, d.name, st, false));
    });
    clear(ui.side);
    ui.side.appendChild(card(ui, "Test report", R.report, false));
    ui.side.appendChild(card(ui, "Live door log, big-cat house", R.bigLog.length ? R.bigLog.join(" | ") : "nothing logged", false));

    S.stat.now(clock(R, R.s));
    S.stat.bigcat(bigState(R));
    S.stat.unlocked(R.doors.filter(function (d) { return !d.locked; }).length);
    S.stat.opened(R.opened);
    S.stat.span(span(R));
    S.stat.report(R.report);
    S.stat.fire(R.fireKept ? "yes" : "no");
    S.stat.zoo(C.hour === 14 ? "open, visitors in" : "closed");
    var done = R.s >= END;
    S.ctl.fwd.disable(done);
    S.ctl.ten.disable(done);
    S.ctl.mark.disable(R.s >= MARK);
    S.ctl.all.disable(done);
  }

  function flush(api) {
    var R = api.state.R;
    R.events.forEach(function (e) { api.log(e.msg, e.tone); });
    R.events = [];
  }

  function runTo(api, s) {
    var R = api.state.R;
    while (R.s < s && R.s < END) stepSecond(R);
    flush(api);
    draw(api);
  }

  function restartNight(api, why) {
    var S = api.state;
    S.R = newNight(S.C);
    api.log((why ? why + " " : "") + clock(S.R, 0) + " Live main in charge of 4 keeper doors on the north hub: 'all well' every 5 s, roll call on the even minute. " +
      (S.C.off === "test" ? "Game day due at " + clock(S.R, TEST) + "." : "No game day tonight."), "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s6e16", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { off: "test", hub: "shared", scope: "all", stop: "none", silent: "unlock", hour: 2 };
      S.ui = buildWidget(api);
      S.ctl = {};
      function sel(key, list, label, num) {
        return function (v) {
          var p = pick(list, v);
          S.C[key] = num ? parseInt(p.value, 10) : p.value;
          restartNight(api, label + ": " + p.label + ".");
        };
      }
      S.ctl.off = api.control.select("off", "What is switched off at 02:10:00", OFFS, "test", sel("off", OFFS, "Switched off"));
      S.ctl.hub = api.control.select("hub", "The radio hub", HUBS, "shared", sel("hub", HUBS, "Hub"));
      S.ctl.scope = api.control.select("scope", "Live doors in the test's group", SCOPES, "all", sel("scope", SCOPES, "Doors in scope"));
      S.ctl.stop = api.control.select("stop", "Stop rule", STOPS, "none", sel("stop", STOPS, "Stop rule"));
      S.ctl.silent = api.control.select("silent", "Doors' silent rule", SILENT, "unlock", sel("silent", SILENT, "Silent rule"));
      S.ctl.hour = api.control.select("hour", "When the night runs", HOURS, "2", sel("hour", HOURS, "Runs at", true));
      S.ctl.fwd = api.control.button("fwd", "Forward 1 second", function () { runTo(api, S.R.s + 1); });
      S.ctl.ten = api.control.button("ten", "Forward 10 seconds", function () { runTo(api, S.R.s + 10); });
      S.ctl.mark = api.control.button("mark", "Run to the 30-second mark", function () { runTo(api, MARK); });
      S.ctl.all = api.control.button("all", "Run to the end (3.5 minutes)", function () { runTo(api, END); });
      S.ctl.again = api.control.button("again", "Start the night again", function () { restartNight(api, "Night replayed."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        now: api.stat("now", "now", ""),
        bigcat: api.stat("bigcat", "big-cat house keeper door", "bad"),
        unlocked: api.stat("unlocked", "keeper doors unlocked now", "bad"),
        opened: api.stat("opened", "keeper doors that unlocked tonight", "bad"),
        span: api.stat("span", "unlocked from, to", "warn"),
        report: api.stat("report", "test report says", ""),
        fire: api.stat("fire", "fire rule kept", "ok"),
        zoo: api.stat("zoo", "the zoo", "")
      };
      api.info("<strong>How to read it.</strong> Each step is one second, from 02:09:30 to 02:13:00. A keeper door obeys the controller that claimed it and counts 'all well' only from that one. The live main says 'all well' every 5 s and claims every door in a roll call on the even minute. A controller being switched off says 'controller down' to its group, and every door that hears it forgets its controller. A door with no 'all well' for 30 s unlocks (the fire rule). Compare the test report with the big-cat house's log.");
      restartNight(api, "");
    },

    selfTest: async function (t) {
      function log(s) { return t.logText().indexOf(s) >= 0; }
      var i;

      // 1. Opens at 02:09:30, before the game day: 4 doors claimed and locked.
      t.expect(t.stat("now") === "02:09:30" && t.stat("unlocked") === 0 && t.stat("opened") === 0 &&
        t.stat("bigcat") === "locked, claimed" && t.stat("report") === "not run yet" &&
        log("02:09:30 Live main in charge of 4 keeper doors on the north hub"),
        "Opens at 02:09:30: 4 keeper doors claimed by the live main and locked; game day not run yet");

      // 2. Tonight: locked but unclaimed at 02:10:29; all four unlocked at 02:10:30.
      for (i = 0; i < 59; i++) t.click("fwd");
      var at29 = t.stat("now") === "02:10:29" && t.stat("bigcat") === "locked, unclaimed" && t.stat("unlocked") === 0;
      t.click("fwd");
      t.expect(at29 && t.stat("now") === "02:10:30" && t.stat("bigcat") === "UNLOCKED" && t.stat("unlocked") === 4 &&
        log("02:10:30 Big-cat house keeper door: UNLOCKED, no 'all well' for 30 s, card: none."),
        "Tonight: unclaimed at 02:10:29; 4 keeper doors unlocked at 02:10:30, card: none");

      // 3. The test report says no live effect; the live doors heard the test's 'controller down'.
      t.expect(t.stat("report") === "PASS: test main took over in 2 s. Test copy only, no live effect." &&
        log("02:10:00 Big-cat house keeper door hears 'controller down'; waits to be claimed.") &&
        log("02:10:02 Test main claims the bench door."),
        "Test report: PASS, no live effect, while the big-cat door heard 'controller down' at 02:10:00");

      // 4. The roll call at 02:12:00 claims and locks them: unlocked 02:10:30 to 02:12:00.
      t.click("all");
      t.expect(t.stat("now") === "02:13:00" && t.stat("unlocked") === 0 && t.stat("opened") === 4 &&
        t.stat("span") === "02:10:30 to 02:12:00" &&
        log("02:12:00 Big-cat house keeper door: LOCKED, claimed by main (roll call), card: none."),
        "Unlocked 02:10:30 to 02:12:00; the 02:12:00 roll call locks all four");

      // 5. The test copy on its own hub: no live door hears it; the report reads the same.
      t.set("hub", "own");
      t.click("all");
      t.expect(t.stat("opened") === 0 && t.stat("span") === "none" &&
        t.stat("report") === "PASS: test main took over in 2 s. Test copy only, no live effect.",
        "Own hub: 0 doors unlocked, the same PASS");

      // 6. Shared hub, one door in scope, no stop rule: only the feed store unlocks.
      t.set("hub", "shared");
      t.set("scope", "one");
      t.click("all");
      t.expect(t.stat("opened") === 1 && t.stat("bigcat") === "locked, claimed" && t.stat("span") === "02:10:30 to 02:12:00" &&
        log("02:10:30 Feed store keeper door: UNLOCKED"),
        "One door in scope: only the feed store unlocks, 02:10:30 to 02:12:00");

      // 7. Option 0: one door and the 10 s stop rule. Caught at 02:10:10, nothing unlocks.
      t.set("stop", "10");
      t.click("all");
      t.expect(t.stat("opened") === 0 && t.stat("fire") === "yes" &&
        log("02:10:10 Stop rule: Feed store keeper door has had no controller for 10 s. Test stopped; the main sends a roll call now."),
        "One door with a stop rule: caught at 02:10:10, 0 doors unlocked");
      t.set("stop", "none");
      t.set("scope", "all");

      // 8. Option 1: no game days, but the live backup locks up and restarts at 02:10:00. The same 90 s.
      t.set("off", "live");
      t.click("all");
      t.expect(t.stat("opened") === 4 && t.stat("span") === "02:10:30 to 02:12:00" && t.stat("report") === "no game day tonight" &&
        log("02:10:30 Reptile house keeper door: UNLOCKED"),
        "Live backup locks up and restarts, no game day: 4 doors unlocked 02:10:30 to 02:12:00");

      // 9. Option 2: the game day at 14:00 with the zoo open. The same unlock, 12 hours later.
      t.set("off", "test");
      t.set("hour", "14");
      t.click("all");
      t.expect(t.stat("span") === "14:10:30 to 14:12:00" && t.stat("opened") === 4 && t.stat("zoo") === "open, visitors in" &&
        t.stat("report") === "PASS: test main took over in 2 s. Test copy only, no live effect.",
        "Daytime: 4 doors unlocked 14:10:30 to 14:12:00 with the zoo open; the report still says PASS");
      t.set("hour", "2");

      // 10. Option 3: silent doors stay locked. Nothing unlocks; the fire rule is broken.
      t.set("silent", "stay");
      t.click("all");
      t.expect(t.stat("opened") === 0 && t.stat("fire") === "no" &&
        log("02:10:30 Big-cat house keeper door: 30 s without 'all well'; stays locked. The fire rule says it must open."),
        "Stay locked: 0 doors unlocked; fire rule kept: no");
      t.set("silent", "unlock");

      // 11. Nothing switched off: the steady state holds.
      t.set("off", "none");
      t.click("all");
      t.expect(t.stat("opened") === 0 && t.stat("bigcat") === "locked, claimed" && t.stat("unlocked") === 0,
        "Nothing switched off: 4 doors claimed and locked all through");
    }
  });
})();
