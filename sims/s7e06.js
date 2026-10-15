/* sims/s7e06-v1.0.0.js  (published as sims/s7e06.js)
   Case s7e06 "The Ten Doors": the inspector's walk for Rookhurst House. The picture feature fetches a
   link on the server's behalf. On the night of 10 October the site made 3,200 picture requests, of
   which 4 were aimed at the cloud's inside; all 4 reached the cloud's settings service, which returned
   the server's keys, and 4 lines of the picture log held them. The learner picks the fetch rule, whether
   the cloud blocks the inside, whether the settings service requires a token, and whether a web firewall
   sits in front, then replays the night and reads, for the first door, how many requests reached the
   settings service, how many came back with keys, and how many log lines held them, plus a status for
   all ten doors. Widget-style sim: it draws inside api.root.
   It models the defence and its numbers only. No address, path or request is shown; destinations are
   labels ("an outside image site", "the cloud's settings service"). Nothing here fetches or forges.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: fetch rule (any address; ending check; approved list); block the
     inside (on/off); settings service requires a token (on/off); web firewall (on/off). Stats: requests
     that reached the settings service, requests that came back with keys, log lines holding keys, outside
     pictures served, first door status. selfTest: 11 assertions.

   The model (stated in sim.lede), as given data from the case content/s7/s7e06-v1.0.0.json:
   - NIGHT = 3,200 picture requests on 10 October. INTERNAL = 4 aimed at the inside; OUTSIDE = 3,196.
   - A request to the inside reaches the settings service only if the fetch rule lets an inside address
     through AND the cloud does not block the inside:
       rule "any"      -> inside allowed (no check at all)
       rule "ending"   -> inside allowed (an inside link can end .jpg too; the ending says nothing)
       rule "approved" -> inside refused (the inside is never on the approved list)
       block the inside -> inside refused regardless of the rule
   - Keys come back only if a request reaches the service AND the service does not require a token
     (a plain fetch carries none). Keys land in the log exactly when keys come back.
   - The web firewall reads requests arriving from the web; the fetch goes out from the inside, so the
     firewall never sees it and changes none of the numbers.
   - Outside pictures served = 3,196 under every rule: real image sites are on the approved list.
   - First door (A01) passes when no keys come back, fails when they do.
   Where every number comes from (conventions rule 14):
   - 3,200 / 4 / 3,196: the night, from the post and the evidence caption.
   - reach 0 or 4, keys 0 or 4, logged 0 or 4: the four inside requests, all or none, per the rules above.
   - The other nine doors carry the inspector's fixed one-line status from the report (the note block);
     only the first door's status changes with the controls.
   - Not modelled: the 09:20 key rotation, the 11 October researcher email, the six printed log lines.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var NIGHT = 3200;
  var INTERNAL = 4;
  var OUTSIDE = 3196;

  var RULES = [
    { value: "any", label: "Fetch any address (as built)" },
    { value: "ending", label: "Fetch only links ending .jpg or .png" },
    { value: "approved", label: "Fetch only from an approved list of image sites" }
  ];
  var RULE_SHORT = {
    any: "fetch any address",
    ending: "fetch only links ending .jpg or .png",
    approved: "fetch only from an approved list"
  };

  // The ten doors. Door 1 is live; the rest carry the report's fixed status.
  var DOORS = [
    { n: 1, name: "Access control", live: true },
    { n: 2, name: "Misconfiguration", status: "noted: spare accounts to remove" },
    { n: 3, name: "Supply chain", status: "noted: no list of parts yet" },
    { n: 4, name: "Cryptographic", status: "pass: stored and sent scrambled" },
    { n: 5, name: "Injection", status: "pass: input kept as words" },
    { n: 6, name: "Insecure design", status: "noted: threat-model the booking flow" },
    { n: 7, name: "Authentication", status: "noted: add a second proof" },
    { n: 8, name: "Integrity", status: "pass: updates checked by seal" },
    { n: 9, name: "Logging and alerting", status: "fail: the log held the keys" },
    { n: 10, name: "Exceptional conditions", status: "noted: stop safely when unsure" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function ruleAllowsInside(C) { return C.rule === "any" || C.rule === "ending"; }

  function reached(C) {
    return (ruleAllowsInside(C) && !C.block) ? INTERNAL : 0;
  }
  function keysBack(C) {
    return (reached(C) > 0 && !C.token) ? reached(C) : 0;
  }
  function logged(C) { return keysBack(C); }
  function doorOnePass(C) { return keysBack(C) === 0; }

  function firstDoorLine(C) {
    if (doorOnePass(C)) {
      if (reached(C) > 0) return "pass: reached, but the token gave back no keys";
      return "pass: the inside was never reached";
    }
    return "fail: 4 reached the settings service, 4 came back with keys";
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
    var key = el("p", "margin:0;font-size:12px;", "The ten doors of the inspector's report. The first door is the picture feature, and its line changes with your choices. Each other door keeps the report's own note.");
    var doorsPre = el("pre", "margin:0;font-size:12px;white-space:pre-wrap;");
    box.appendChild(head);
    box.appendChild(key);
    box.appendChild(doorsPre);
    api.root.appendChild(box);
    return { head: head, doors: doorsPre };
  }

  function doorsText(C, played) {
    var rows = [];
    for (var i = 0; i < DOORS.length; i++) {
      var d = DOORS[i];
      var status;
      if (d.live) status = played ? firstDoorLine(C) : "not replayed yet";
      else status = d.status;
      var tag = ("Door " + d.n + ". " + d.name).slice(0, 34);
      while (tag.length < 34) tag += " ";
      rows.push(tag + status);
    }
    return rows.join("\n");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    S.ui.head.textContent = "Fetch rule: " + RULE_SHORT[C.rule] + ". Block the inside: " + (C.block ? "on" : "off") +
      ". Settings service requires a token: " + (C.token ? "on" : "off") + ". Web firewall: " + (C.firewall ? "on" : "off") + ".";
    S.ui.doors.textContent = doorsText(C, S.played);

    S.stat.outside(S.played ? fmt(OUTSIDE) : "not replayed yet");
    if (!S.played) {
      S.stat.reached("not replayed yet");
      S.stat.keys("not replayed yet");
      S.stat.logged("not replayed yet");
      S.stat.door("not replayed yet");
      return;
    }
    S.stat.reached(reached(C));
    S.stat.keys(keysBack(C));
    S.stat.logged(logged(C));
    S.stat.door(doorOnePass(C) ? "PASS" : "FAIL");
  }

  // Any change sets the night back to before the replay.
  function change(api, what) {
    api.state.played = false;
    api.log(what + " Set back to before the replay.", "");
    draw(api);
  }

  function run(api) {
    var S = api.state;
    var C = S.C;
    if (S.played) {
      api.log("Already replayed 10 October. Change a setting or reset to replay.", "");
      return;
    }
    api.log("Replay 10 October: " + fmt(NIGHT) + " picture requests, " + INTERNAL + " of them aimed at the inside.", "");
    var r = reached(C);
    if (r === 0) {
      if (C.rule === "approved") api.log("The approved list refuses every address not on it, so the " + INTERNAL + " inside requests never leave the server.", "ok");
      else api.log("The cloud blocks the inside, so the " + INTERNAL + " inside requests are turned back before they arrive.", "ok");
    } else {
      api.log("The rule lets inside addresses through, so all " + INTERNAL + " inside requests reach the settings service.", "bad");
    }
    if (C.firewall) api.log("The web firewall reads requests arriving from the web; this fetch went out from the inside, so the firewall never saw it.", "warn");
    if (r > 0 && C.token) api.log("The settings service required a token the feature doesn't carry, so all " + r + " requests came back with no keys.", "ok");
    var k = keysBack(C);
    if (k > 0) {
      api.log("The settings service answered each with the keys: " + k + " came back with keys, and " + logged(C) + " log lines held them.", "bad");
      api.log("First door fails. The keys reached the picture log, as on the night.", "bad");
    } else {
      api.log("No keys came back, so no log line holds them. First door passes.", "ok");
    }
    api.log(fmt(OUTSIDE) + " real pictures still came through from their image sites.", "");
    S.played = true;
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e06", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { rule: "any", block: false, token: false, firewall: false };
      S.played = false;
      S.ui = buildWidget(api);
      S.ctl = {};

      S.ctl.rule = api.control.select("rule", "Fetch rule", RULES, "any", function (v) {
        var o = pick(RULES, v);
        if (!o) return;
        S.C.rule = String(o.value);
        change(api, "Fetch rule: " + RULE_SHORT[S.C.rule] + ".");
      });
      S.ctl.block = api.control.toggle("block", "Block the inside at the network", false, function (on) {
        S.C.block = !!on;
        change(api, "Block the inside: " + (on ? "on." : "off."));
      });
      S.ctl.token = api.control.toggle("token", "Settings service requires a token", false, function (on) {
        S.C.token = !!on;
        change(api, "Settings service requires a token: " + (on ? "on." : "off."));
      });
      S.ctl.firewall = api.control.toggle("firewall", "Web firewall in front of the site", false, function (on) {
        S.C.firewall = !!on;
        change(api, "Web firewall: " + (on ? "on." : "off."));
      });
      S.ctl.run = api.control.button("run", "Replay the night of 10 October", function () { run(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        reached: api.stat("reached", "requests that reached the settings service", "bad"),
        keys: api.stat("keys", "requests that came back with keys", "bad"),
        logged: api.stat("logged", "log lines holding keys", "warn"),
        outside: api.stat("outside", "outside pictures served", ""),
        door: api.stat("door", "first door", "bad")
      };

      api.info("<strong>How to read it.</strong> The picture feature fetches a link on the server's behalf. The server can reach the cloud's inside, where the settings service hands out keys; a guest's phone cannot. An inside request reaches the service unless the rule or the block stops it, and keys come back unless the service needs a token. A web firewall watches the way in, not the server's way out. Replay the night to fill the stats and the first door's line.");

      api.log("Before the replay, as built: the feature fetches any address, nothing blocks the inside, the settings service needs no token, no web firewall.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: before the replay, nothing filled in.
      t.expect(t.stat("reached") === "not replayed yet" && t.stat("keys") === "not replayed yet" &&
        t.stat("logged") === "not replayed yet" && t.stat("door") === "not replayed yet" &&
        t.stat("outside") === "not replayed yet",
        "Opens before the replay: every stat waiting, nothing played");

      // 2. As built: all four inside requests reach the keys and the log holds them.
      t.click("run");
      t.expect(t.stat("reached") === 4 && t.stat("keys") === 4 && t.stat("logged") === 4 &&
        t.stat("door") === "FAIL" && t.stat("outside") === "3,196" &&
        has("4 came back with keys, and 4 log lines held them"),
        "As built: 4 reach the settings service, 4 come back with keys, 4 log lines hold them, first door fails");

      // 3. The ending check changes nothing: an ending says nothing about where a link leads.
      t.set("rule", "ending");
      t.click("run");
      t.expect(t.stat("reached") === 4 && t.stat("keys") === 4 && t.stat("logged") === 4 && t.stat("door") === "FAIL",
        "Ending check: still 4, 4, 4, because an inside address can end .jpg too");

      // 4. The approved list: zero reach the inside, and the real pictures still come through.
      t.set("rule", "approved");
      t.click("run");
      t.expect(t.stat("reached") === 0 && t.stat("keys") === 0 && t.stat("logged") === 0 &&
        t.stat("door") === "PASS" && t.stat("outside") === "3,196" &&
        has("never leave the server"),
        "Approved list: 0 reach, 0 keys, 0 logged, first door passes, 3,196 pictures still served");

      // 5. Block the inside with the any-address rule: nothing reaches the service.
      t.set("rule", "any");
      t.set("block", true);
      t.click("run");
      t.expect(t.stat("reached") === 0 && t.stat("keys") === 0 && t.stat("door") === "PASS" &&
        has("turned back before they arrive"),
        "Block the inside: the 4 inside requests are turned back, first door passes");

      // 6. A token on the settings service: the four reach it, but no keys come back.
      t.set("block", false);
      t.set("token", true);
      t.click("run");
      t.expect(t.stat("reached") === 4 && t.stat("keys") === 0 && t.stat("logged") === 0 &&
        t.stat("door") === "PASS" && has("came back with no keys"),
        "Token required: 4 still reach the service, but 0 come back with keys");

      // 7. The web firewall alone does not stop the fetch.
      t.set("token", false);
      t.set("firewall", true);
      t.click("run");
      t.expect(t.stat("reached") === 4 && t.stat("keys") === 4 && t.stat("door") === "FAIL" &&
        has("the firewall never saw it"),
        "Web firewall on: still 4, 4, first door fails, because the fetch goes out from the inside");

      // 8. The full fix: approved list, blocked inside, token. Zero everywhere.
      t.set("firewall", false);
      t.set("rule", "approved");
      t.set("block", true);
      t.set("token", true);
      t.click("run");
      t.expect(t.stat("reached") === 0 && t.stat("keys") === 0 && t.stat("logged") === 0 && t.stat("door") === "PASS",
        "Approved list plus blocked inside plus token: 0 reach, 0 keys, 0 logged, first door passes");

      // 9. Outside pictures served are 3,196 under every rule.
      t.set("rule", "any");
      t.set("block", false);
      t.set("token", false);
      t.click("run");
      t.expect(t.stat("outside") === "3,196", "Outside pictures served stay 3,196 regardless of the rule");

      // 10. The ten doors are all present, and the ninth carries the logging failure.
      t.expect(t.api.state.ui.doors.textContent.indexOf("Door 10.") >= 0 &&
        t.api.state.ui.doors.textContent.indexOf("fail: the log held the keys") >= 0,
        "All ten doors are shown, and door nine notes the log that held the keys");

      // 11. Changing a setting clears the replay: stats wait again.
      t.set("rule", "approved");
      t.expect(t.stat("reached") === "not replayed yet" && t.stat("door") === "not replayed yet",
        "Any change sets the night back to before the replay");
    }
  });
})();
