/* sims/s6e15-v1.0.0.js  (published as sims/s6e15.js)
   Case s6e15 "Blueprints": a blueprint lab for Harkaway, a small architects' practice. Its clients'
   drawings live in one storage folder (an AWS bucket, harkaway-client-drawings) that Yestin's
   Terraform code describes. A pipeline applies the code every night at 02:00. The learner sets the
   code's public-access line, the nightly run, a drift check, a block on hand changes and a note in
   the console; makes hand changes, applies now, moves the plans to a new folder by hand, builds a
   copy from the code; and steps through one week, Tuesday 13 October 14:00 to Tuesday 20 October
   14:00, reading the code and the live folder side by side, the change log and the downloads.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).

   CHANGELOG
   v1.0.0 (2026-10-15) first version: the code's line (public as written in 2024, or private);
     nightly 02:00 run on or off; drift check (plan first, stop and alert if the apply would undo a
     change made by hand); block hand changes in the console; a note in the console (which the
     pipeline never reads). Buttons: next event, play to the end of the week, apply now, turn public
     access off by hand now, move the plans to a new folder by hand, build a copy from the code,
     reset. selfTest: 10 assertions.

   The model (stated in sim.lede and the post):
   - Times are minutes from Tuesday 13 October 2026 00:00. The week runs from Tue 14:00 (840) to
     Tue 20 October 14:00 (10920).
   - Fixed events (stated data, the story's and the week's):
     Tue 14:10 Pirkko turns public access off by hand in the console (the story).
     Tue 22:15 the unknown address 203.0.113.84 asks for velloso-house-plans.pdf (the link was
       copied from the portal and pasted on a public builders' forum on Tuesday).
     Every night at 02:00 the nightly run (if on); every night at 02:37 the same address asks again.
     Wed 03:05 Yestin turns public access off by hand again (the story).
     Fri 10:00 Hafwen uploads the revised Velloso plans through the portal, which saves every new
       drawing to the folder named in the code.
   - Live folder: exists or not; public or not; holds the plans or not. The code: public (as
     written) or private. State: what the pipeline itself last set (public, from 2024 on).
   - A run (nightly or apply now): if the folder named in the code is missing, it is created with
     the code's setting, empty. Otherwise, if live differs from the code, live is set to the code.
     With the drift check on, the run first plans: if it would undo a hand change (live differs
     from state and from the code, or the folder was deleted), it applies nothing and alerts Yestin.
   - A request: folder missing or file not in it: "not found"; folder public: "downloaded";
     otherwise "refused".
   - Hand changes: refused if blocked. Moving by hand makes harkaway-drawings-private (a folder
     outside the code and the state, never touched by the pipeline), moves the plans into it,
     and deletes the code's folder.

   Where every number comes from (conventions rule 14; the case is content/s6/s6e15-v1.0.0.json):
   - The record (post): Tue 14:10 pirkko OFF; Tue 22:15 refused; Wed 02:00 pipeline ON; Wed 02:37
     downloaded. Downloads 1, refused 1 after Wed 02:37.
   - As now to the end of the week (Yestin's 03:05 fix only): Thu 02:00 ON again, then a download
     every night Wed to Tue: 7 nights, downloads 7, refused 1. Option 1 (fix by hand every night,
     note or no note): each 02:00 reopens before 02:37, still 7.
   - Option 0 (nightly run off from Wed 03:05): Thu to Tue 6 nights refused, plus Tue 22:15:
     refused 7, downloads 1, drift "1 difference" all week; a copy built from the code is public.
   - Option 2 (code private, apply now at Wed 03:05, block on): downloads 1, refused 7, drift
     "none"; a hand change is refused; a copy built from the code is private.
   - Option 3 (move by hand at Wed 03:05): Thu 02:00 the folder is created again, public, empty;
     Thu and Fri 02:37 not found; Fri 10:00 the revised plans land in it; Sat, Sun, Mon, Tue 02:37
     downloaded: downloads 1 + 4 = 5.
   - Drift check on from the start: every night from Wed 02:00 the run stops; downloads 0,
     refused 1 + 7 = 8.
*/
(function () {
  "use strict";

  var DAYS = ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"];
  var DATES = [13, 14, 15, 16, 17, 18, 19, 20];
  var START = 840;
  var END = 7 * 1440 + 840;
  var ADDR = "203.0.113.84";
  var FILE = "velloso-house-plans.pdf";
  var FOLDER = "harkaway-client-drawings";
  var HANDMADE = "harkaway-drawings-private";

  function buildEvents() {
    var ev = [];
    ev.push({ t: 850, kind: "hand", who: "pirkko" });
    ev.push({ t: 1335, kind: "ask" });
    for (var d = 1; d <= 7; d++) {
      ev.push({ t: d * 1440 + 120, kind: "run" });
      ev.push({ t: d * 1440 + 157, kind: "ask" });
    }
    ev.push({ t: 1440 + 185, kind: "hand", who: "yestin" });
    ev.push({ t: 3 * 1440 + 600, kind: "upload" });
    ev.push({ t: END, kind: "end" });
    ev.sort(function (a, b) { return a.t - b.t; });
    return ev;
  }
  var EVENTS = buildEvents();

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function when(m) {
    var d = Math.floor(m / 1440);
    var r = m - d * 1440;
    return DAYS[d] + " " + two(Math.floor(r / 60)) + ":" + two(r % 60);
  }
  function longWhen(m) {
    var d = Math.floor(m / 1440);
    return DAYS[d] + " " + DATES[d] + " Oct " + when(m).slice(4);
  }
  function onOff(pub) { return pub ? "ON" : "OFF"; }

  /* ---------- the model ---------- */

  function fresh() {
    return {
      t: START, i: 0,
      code: "public", nightly: true, check: false, block: false, note: false,
      live: { exists: true, pub: true, plans: true },
      statePub: true,
      handmade: false,
      downloads: 0, refused: 0, notFound: 0,
      lastRun: "none yet", copy: "not built",
      changes: [], done: false
    };
  }

  function codePub(M) { return M.code === "public"; }
  function drift(M) {
    if (!M.live.exists) return "folder missing";
    return M.live.pub === codePub(M) ? "none" : "1 difference";
  }

  // One run of the pipeline: plan, then apply. Returns the log line.
  function run(M, how) {
    var at = when(M.t);
    var cp = codePub(M);
    if (!M.live.exists && M.check) {
      M.lastRun = at + ": stopped, drift";
      return { s: at + " pipeline: drift found. The folder in the code and the state is missing, so someone deleted it by hand. Nothing applied; Yestin alerted.", tone: "warn" };
    }
    if (!M.live.exists) {
      M.live = { exists: true, pub: cp, plans: false };
      M.statePub = cp;
      M.lastRun = at + ": folder created";
      var s = at + " pipeline: folder created, public access " + onOff(cp) + " (" + how + "). It is empty.";
      M.changes.push(s);
      return { s: s, tone: cp ? "bad" : "warn" };
    }
    if (M.live.pub === cp) {
      M.statePub = cp;
      M.lastRun = at + ": no changes";
      return { s: at + " pipeline: plan finds no changes; nothing applied (" + how + ").", tone: "ok" };
    }
    var handChanged = M.live.pub !== M.statePub;
    if (M.check && handChanged) {
      M.lastRun = at + ": stopped, drift";
      return { s: at + " pipeline: drift found. Live public access is " + onOff(M.live.pub) + ", the code says " + onOff(cp) +
        ", and the last apply set " + onOff(M.statePub) + ", so someone changed it by hand. Nothing applied; Yestin alerted.", tone: "warn" };
    }
    M.live.pub = cp;
    M.statePub = cp;
    M.lastRun = at + ": public access " + onOff(cp);
    var line = at + " pipeline: public access " + onOff(cp) + " (" + how + ").";
    M.changes.push(line);
    if (M.note && cp) line += " The note in the console says DO NOT MAKE PUBLIC; the pipeline does not read notes.";
    return { s: line, tone: cp ? "bad" : "ok" };
  }

  function handOff(M, who) {
    var at = when(M.t);
    if (M.block) return { s: at + " " + who + ": turn public access off in the console: refused. Hand changes are blocked; change the code and apply it instead.", tone: "warn" };
    if (!M.live.exists) return { s: at + " " + who + ": no folder named " + FOLDER + " to change.", tone: "" };
    if (!M.live.pub) return { s: at + " " + who + ": public access is already OFF.", tone: "" };
    M.live.pub = false;
    var s = at + " " + who + ": public access OFF (console).";
    M.changes.push(s);
    return { s: s, tone: "warn" };
  }

  function ask(M) {
    var at = when(M.t);
    var res;
    if (!M.live.exists || !M.live.plans) { res = "not found"; M.notFound += 1; }
    else if (M.live.pub) { res = "downloaded"; M.downloads += 1; }
    else { res = "refused"; M.refused += 1; }
    return { s: at + " " + ADDR + ": " + FILE + " " + res + ".", tone: res === "downloaded" ? "bad" : "ok" };
  }

  function upload(M) {
    var at = when(M.t);
    if (!M.live.exists) return { s: at + " portal: the revised Velloso plans can't be saved; the folder named in the code is missing.", tone: "warn" };
    M.live.plans = true;
    return { s: at + " portal: the revised Velloso plans saved to " + FOLDER + " (public access " + onOff(M.live.pub) + ").", tone: M.live.pub ? "bad" : "" };
  }

  function moveByHand(M) {
    var at = when(M.t);
    if (M.block) return { s: at + " pirkko: new folder by hand: refused. Hand changes are blocked.", tone: "warn" };
    if (!M.live.exists) return { s: at + " pirkko: there is no old folder left to move.", tone: "" };
    M.handmade = true;
    M.live = { exists: false, pub: false, plans: false };
    var s = at + " pirkko: made " + HANDMADE + " by hand, moved every drawing into it, deleted " + FOLDER + " (console).";
    M.changes.push(s);
    return { s: s + " The new folder is in neither the code nor the state.", tone: "warn" };
  }

  // Process the next fixed event. Returns false at the end of the week.
  function nextEvent(M) {
    if (M.done) return null;
    var e = EVENTS[M.i];
    M.i += 1;
    M.t = e.t;
    if (e.kind === "end") { M.done = true; return { s: longWhen(e.t) + ": the end of the week. Downloads by unknown addresses: " + M.downloads + "; refused: " + M.refused + ".", tone: "" }; }
    if (e.kind === "hand") return handOff(M, e.who);
    if (e.kind === "ask") return ask(M);
    if (e.kind === "upload") return upload(M);
    if (!M.nightly) { M.lastRun = when(M.t) + ": nightly run off"; return { s: when(M.t) + " nightly run is off: nothing compared, nothing applied.", tone: "" }; }
    return run(M, "nightly apply");
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
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:11px;border-collapse:collapse;");
    var thead = el("thead");
    var hr = el("tr");
    ["", "The code (the drawing)", "Live (the building)", "State (last apply)"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;padding:2px 4px;", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    var logHead = el("p", "margin:0;font-size:12px;font-weight:600;", "Change log: who changed the folder");
    var changes = el("ul", "margin:0;padding-left:18px;font-size:11px;font-family:monospace;");
    [head, wrap, logHead, changes].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { el: el, head: head, tbody: tbody, changes: changes };
  }

  function draw(api) {
    var S = api.state;
    var M = S.M;
    var ui = S.ui;
    ui.head.textContent = "Now: " + longWhen(M.t) + ". Folder " + FOLDER + ". Nightly 02:00 run: " + (M.nightly ? "on" : "off") +
      ". Drift check: " + (M.check ? "on" : "off") + ". Hand changes: " + (M.block ? "blocked" : "allowed") +
      ". Note in the console: " + (M.note ? "DO NOT MAKE PUBLIC" : "none") + ".";
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    [
      ["Folder exists", "yes", M.live.exists ? "yes" : "no (deleted)", "yes"],
      ["Public access", M.code === "public" ? "ON (false)" : "OFF (true)", M.live.exists ? onOff(M.live.pub) : "-", onOff(M.statePub)],
      ["Velloso plans inside", "-", M.live.exists && M.live.plans ? "yes" : "no", "-"],
      ["Hand-made folders", "none", M.handmade ? HANDMADE : "none", "none"]
    ].forEach(function (cells) {
      var tr = ui.el("tr");
      cells.forEach(function (c) { tr.appendChild(ui.el("td", "padding:2px 4px;", c)); });
      ui.tbody.appendChild(tr);
    });
    while (ui.changes.firstChild) ui.changes.removeChild(ui.changes.firstChild);
    var list = M.changes.length ? M.changes.slice(-8) : ["No changes yet this week."];
    list.forEach(function (s) { ui.changes.appendChild(ui.el("li", "", s)); });
    S.stat.clock(when(M.t));
    S.stat.code(M.code);
    S.stat.live(M.live.exists ? (M.live.pub ? "public" : "private") : "deleted");
    S.stat.drift(drift(M));
    S.stat.downloads(M.downloads);
    S.stat.refused(M.refused);
    S.stat.lastRun(M.lastRun);
    S.stat.copy(S.M.copy);
    S.ctl.next.disable(M.done);
    S.ctl.play.disable(M.done);
  }

  function say(api, r) { if (r) api.log(r.s, r.tone); draw(api); }

  /* ---------- the module ---------- */

  DL.sims.define("s6e15", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.M = fresh();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.code = api.control.select("code", "The code's line for the folder", [
        { value: "public", label: "restrict_public_buckets = false (public, as written in 2024)" },
        { value: "private", label: "restrict_public_buckets = true (private)" }
      ], "public", function (v) {
        S.M.code = String(v) === "private" ? "private" : "public";
        say(api, { s: when(S.M.t) + " the code now says public access " + onOff(codePub(S.M)) + ". Nothing changes live until the next apply.", tone: "" });
      });
      S.ctl.nightly = api.control.toggle("nightly", "Nightly 02:00 run", true, function (on) {
        S.M.nightly = !!on;
        say(api, { s: when(S.M.t) + " nightly 02:00 run: " + (on ? "on." : "off."), tone: "" });
      });
      S.ctl.check = api.control.toggle("check", "Drift check: plan first, stop if the apply would undo a hand change", false, function (on) {
        S.M.check = !!on;
        say(api, { s: when(S.M.t) + " drift check: " + (on ? "on." : "off."), tone: "" });
      });
      S.ctl.block = api.control.toggle("block", "Block hand changes in the console (only the pipeline may change the folder)", false, function (on) {
        S.M.block = !!on;
        say(api, { s: when(S.M.t) + " hand changes in the console: " + (on ? "blocked." : "allowed."), tone: "" });
      });
      S.ctl.note = api.control.toggle("note", "Note in the console: DO NOT MAKE PUBLIC", false, function (on) {
        S.M.note = !!on;
        say(api, { s: when(S.M.t) + " note in the console: " + (on ? "DO NOT MAKE PUBLIC." : "removed."), tone: "" });
      });
      S.ctl.next = api.control.button("next", "Next event", function () { say(api, nextEvent(S.M)); });
      S.ctl.play = api.control.button("play", "Play to the end of the week", function () {
        while (!S.M.done) { var r = nextEvent(S.M); if (r) api.log(r.s, r.tone); }
        draw(api);
      });
      S.ctl.apply = api.control.button("apply", "Apply now (run the pipeline)", function () { say(api, run(S.M, "apply now")); });
      S.ctl.hand = api.control.button("hand", "Turn public access off by hand now", function () { say(api, handOff(S.M, "pirkko")); });
      S.ctl.move = api.control.button("move", "Move the plans to a new folder by hand", function () { say(api, moveByHand(S.M)); });
      S.ctl.copy = api.control.button("copy", "Build a test copy from the code", function () {
        S.M.copy = codePub(S.M) ? "public" : "private";
        say(api, { s: when(S.M.t) + " test copy built from the code: public access " + onOff(codePub(S.M)) + ", the same as the code says.", tone: codePub(S.M) ? "bad" : "ok" });
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        clock: api.stat("clock", "now", ""),
        code: api.stat("code", "the code says", ""),
        live: api.stat("live", "the live folder is", "warn"),
        drift: api.stat("drift", "drift (live against the code)", "warn"),
        downloads: api.stat("downloads", "downloads by unknown addresses", "bad"),
        refused: api.stat("refused", "requests refused", "ok"),
        lastRun: api.stat("lastRun", "last pipeline run", ""),
        copy: api.stat("copy", "test copy from the code", "")
      };
      api.info("<strong>How to read it.</strong> The code is the drawing; the live folder is the building. Each run of the pipeline first plans (compares the code with what is live) and then applies (changes live to match). State is what the pipeline last set. Drift is live no longer matching the code. The address 203.0.113.84 asks for the Velloso plans at 22:15 on Tuesday and at 02:37 every night. Step through the week, or change the setup at any moment and play on.");
      api.log("Tue 13 Oct 14:00. The code says public access ON, the live folder is public, and nobody has changed anything by hand since the nightly run began on 14 September.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }
      function upTo(n) { for (var i = 0; i < n; i++) t.click("next"); }

      // 1. Opens before 14:10: code public, live public, no drift, nothing downloaded.
      t.expect(t.stat("clock") === "Tue 14:00" && t.stat("code") === "public" && t.stat("live") === "public" &&
        t.stat("drift") === "none" && t.stat("downloads") === 0 && t.stat("refused") === 0 && t.stat("lastRun") === "none yet",
        "Opens on Tuesday 14:00: code and live both public, no drift");

      // 2. 14:10: Pirkko's hand fix makes drift.
      upTo(1);
      t.expect(has("Tue 14:10 pirkko: public access OFF (console).") && t.stat("live") === "private" && t.stat("drift") === "1 difference",
        "Tue 14:10: public access off by hand; live no longer matches the code");

      // 3. The record: refused at 22:15, back on at 02:00 by the pipeline, downloaded at 02:37.
      upTo(3);
      t.expect(has("Tue 22:15 203.0.113.84: velloso-house-plans.pdf refused.") && has("Wed 02:00 pipeline: public access ON (nightly apply).") &&
        has("Wed 02:37 203.0.113.84: velloso-house-plans.pdf downloaded.") && t.stat("downloads") === 1 && t.stat("refused") === 1 &&
        t.stat("live") === "public",
        "22:15 refused; 02:00 the pipeline puts public access back; 02:37 the plans are downloaded");

      // 4. Option 1: Yestin's 03:05 hand fix, a note, then the week: a download every night.
      upTo(1);
      t.set("note", true);
      t.click("play");
      t.expect(has("Wed 03:05 yestin: public access OFF (console).") && has("Thu 02:00 pipeline: public access ON (nightly apply). The note in the console says DO NOT MAKE PUBLIC; the pipeline does not read notes.") &&
        t.stat("downloads") === 7 && t.stat("refused") === 1,
        "Hand fix and a note: the pipeline reopens it every night; 7 downloads in the week");

      // 5. Option 0: nightly run off after 03:05. Safe all week, drift stays, a copy from the code is public.
      t.click("reset");
      upTo(5);
      t.set("nightly", false);
      t.click("play");
      t.click("copy");
      t.expect(t.stat("downloads") === 1 && t.stat("refused") === 7 && t.stat("drift") === "1 difference" && t.stat("copy") === "public" &&
        has("Thu 02:00 nightly run is off: nothing compared, nothing applied."),
        "Nightly run off: no more downloads, but drift stays all week and a copy built from the code is public");

      // 6. Option 2: the fix in the code, applied, hand changes blocked.
      t.click("reset");
      upTo(5);
      t.set("code", "private");
      t.click("apply");
      t.set("block", true);
      t.click("hand");
      t.click("play");
      t.click("copy");
      t.expect(has("Wed 03:05 pipeline: plan finds no changes; nothing applied (apply now).") &&
        has("Wed 03:05 pirkko: turn public access off in the console: refused.") &&
        t.stat("downloads") === 1 && t.stat("refused") === 7 && t.stat("drift") === "none" && t.stat("copy") === "private" && t.stat("live") === "private",
        "Code private and applied, hand changes blocked: 1 download all week, no drift, a copy from the code is private");

      // 7. Option 3: a new folder by hand; the pipeline builds the old one again, public.
      t.click("reset");
      upTo(5);
      t.click("move");
      t.click("play");
      t.expect(has("Thu 02:00 pipeline: folder created, public access ON (nightly apply). It is empty.") &&
        has("Thu 02:37 203.0.113.84: velloso-house-plans.pdf not found.") &&
        has("Fri 10:00 portal: the revised Velloso plans saved to harkaway-client-drawings (public access ON).") &&
        has("Sat 02:37 203.0.113.84: velloso-house-plans.pdf downloaded.") && t.stat("downloads") === 5,
        "Moved by hand: the pipeline recreates the folder public, the revised plans land in it, 5 downloads in the week");

      // 8. Drift check on from the start: the run stops instead of undoing the hand fix.
      t.click("reset");
      t.set("check", true);
      t.click("play");
      t.expect(has("Wed 02:00 pipeline: drift found.") && has("Nothing applied; Yestin alerted.") && t.stat("downloads") === 0 &&
        t.stat("refused") === 8 && t.stat("drift") === "1 difference",
        "Drift check on: every night the run stops and alerts; 0 downloads, 8 refused, the drift is still there");

      // 9. Blocking hand changes with no route through the code: Tuesday's fix is refused.
      t.click("reset");
      t.set("block", true);
      upTo(2);
      t.expect(has("Tue 14:10 pirkko: turn public access off in the console: refused.") &&
        has("Tue 22:15 203.0.113.84: velloso-house-plans.pdf downloaded.") && t.stat("downloads") === 1,
        "A block alone, without fixing the code, refuses the 14:10 fix and the 22:15 request is served");

      // 10. The fixed events: 7 nightly runs and 8 requests in the week.
      var runs = 0;
      var asks = 0;
      EVENTS.forEach(function (e) { if (e.kind === "run") runs += 1; if (e.kind === "ask") asks += 1; });
      t.expect(runs === 7 && asks === 8 && EVENTS[0].t === 850 && EVENTS[EVENTS.length - 1].t === END && when(1440 + 157) === "Wed 02:37",
        "The week holds 7 nightly runs and 8 requests from the unknown address, from Tue 14:10 to Tue 20 Oct 14:00");
    }
  });
})();
