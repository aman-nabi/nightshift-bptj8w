/* sims/a7e06-v1.0.0.js  (published as sims/a7e06.js)
   Case a7e06 "Poisoned Wells": a model-loading checker for Brindlewell's community translation app,
   whose server fetched the newest model file from a public hub at every start. No real model runs
   here and no file content exists in this file: each file is a name, a short checksum label, a
   format (code-capable or numbers only) and its held-out score. The sim models the defences and
   their numbers, never an attack: a replaced code-capable file, when opened, is only counted as
   "one call to an unknown address". Widget-style sim: it draws its own table inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: replay 6 to 14 Oct, fetch rule (newest file, or
     pinned to a recorded checksum), file format (code-capable as built, or numbers only), firewall
     for calls out (everything out as built, block the one unknown address, allow-list: hub only),
     held-out check before a new file is used (off or on, bar 85 of 100), the day shown, a reply to
     play, reset. Stats: starts before (1 Mar to 5 Oct) and their unknown calls, starts in the
     window, starts on the replaced file, calls to an unknown address tried, got out and stopped,
     loads refused on checksum, new files turned down by the held-out check, the file in use and
     its held-out score on the day shown, documents a week translated by hand. selfTest: 11
     assertions.

   The model (stated in sim.lede, given data):
   - The app went live on 1 March. It starts once a day: 1 March, then every night at 04:00.
     1 March to 5 October is 219 days, so 219 starts, each reaching out to the hub alone.
   - The hub page offers the model in two formats: code-capable (as used) and numbers only.
     Checksums: March code-capable 7d2a91c4 (Ffraid's March note), March numbers-only 4f9c0a62,
     replaced code-capable e0b35f18, replaced numbers-only b81d6e07.
   - Both files on the page were replaced on Monday 5 October at 21:00. The 5 Oct 04:00 start
     still fetched the March file. Starts on 6 to 14 October (Tuesday to Wednesday) fetch the
     replaced one: 9 starts.
   - Held-out set: 100 sentence pairs checked by hand in March. March model 88 acceptable,
     replaced model 79 (the same in either format: the format holds the same model).
   - Opening the replaced code-capable file, for use or to score it, makes one call to an
     unknown address. Numbers-only files cannot run code: no call.
   - Pinned: the app loads a fetched file only if its checksum matches the pin; otherwise it
     refuses it, keeps its last good file (the March file in the chosen format), writes a warning
     and texts the volunteer.
   - Held-out check (given bar: at least 85 of 100): a new file is opened and scored before use;
     below the bar it is turned down and the file in use stays.
   - Firewall: everything out (as built), block the one unknown address, or allow-list (hub
     only). Either of the last two stops the call; neither changes which file loads.
   - Reply 3 (rebuild and train our own): the app is off for months. Given: about 20 notices and
     letters a week go back to hand translation.

   Where every number comes from (conventions rule 14; the case is content/latent/a7/a7e06-v1.0.0.json):
   - As built (newest, code-capable, everything out, no check): 9 starts on the replaced file,
     9 calls tried, 9 got out, held-out 79 (the post, log and evidence diagram).
   - Before: 219 starts, 0 unknown calls. 5 Oct row: March file, 88.
   - Option 0 (pinned, numbers only): 9 refused, 0 calls, 88.
   - Option 1 (download again, as built): 9, 9, 79.
   - Option 2 (block the address): 9 tried, 0 out, 9 stopped, 9 starts on the replaced file, 79.
   - Option 3 (app off): 0 starts, 0 calls, about 20 a week by hand.
   - Allow-list alone: 9 tried, 0 out, file still loads 9 times, 79.
   - Held-out check alone: 9 turned down, 0 starts on the replaced file, 88, but 9 calls tried
     (opening the file to score it). Numbers only alone: 0 calls, 9 starts on the replaced file, 79.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var BEFORE_STARTS = 219;      // 1 Mar to 5 Oct, one a day
  var BAR = 85;                 // held-out pass bar (given)
  var BY_HAND = 20;             // notices and letters a week, app off (given)
  var DAYS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14];   // October; 5 is the last clean start
  var FILES = {
    marchCode: { label: "March file, code-capable", sum: "7d2a91c4", score: 88, code: true, replaced: false },
    marchNum: { label: "March file, numbers only", sum: "4f9c0a62", score: 88, code: false, replaced: false },
    newCode: { label: "replaced file, code-capable", sum: "e0b35f18", score: 79, code: true, replaced: true },
    newNum: { label: "replaced file, numbers only", sum: "b81d6e07", score: 79, code: false, replaced: true }
  };

  var FETCH = [
    { value: "newest", label: "newest file on the page (as built)" },
    { value: "pinned", label: "pinned to a recorded checksum" }
  ];
  var FORMATS = [
    { value: "code", label: "code-capable (as built)" },
    { value: "numbers", label: "numbers only" }
  ];
  var OUTS = [
    { value: "all", label: "everything out (as built)" },
    { value: "block", label: "block the one unknown address" },
    { value: "allow", label: "allow-list: the hub only" }
  ];
  var DAYLIST = DAYS.map(function (d) { return { value: String(d), label: d + " Oct, 04:00" }; });
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: pin to a checksum, numbers only" },
    { value: "r1", label: "reply 1: download again, restart" },
    { value: "r2", label: "reply 2: block the address" },
    { value: "r3", label: "reply 3: rebuild and train our own" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function defaults() {
    return { fetch: "newest", format: "code", out: "all", check: false, day: "14", app: "on", plan: "none" };
  }

  /* ---------- the model (pure: settings in, rows and counts out) ---------- */

  function replay(C) {
    var R = { rows: [], starts: 0, onNew: 0, tried: 0, out: 0, stopped: 0, refused: 0, turned: 0,
      byHand: 0, firstRefused: false, firstTurned: false };
    if (C.app === "off") {
      R.byHand = BY_HAND;
      return R;
    }
    var marchF = C.format === "code" ? FILES.marchCode : FILES.marchNum;
    var newF = C.format === "code" ? FILES.newCode : FILES.newNum;
    var inUse = marchF;                               // the file the app ran on before 6 Oct
    DAYS.forEach(function (day) {
      var fetched = day >= 6 ? newF : marchF;
      var row = { day: day, fetched: fetched, check: "not checked", score: "", call: "none" };
      var opened = [];
      if (C.fetch === "pinned") {
        if (fetched.sum === marchF.sum) { row.check = "matches the pin"; }
        else { row.check = "differs: refused"; if (day >= 6) R.refused++; }
      } else if (fetched !== inUse) {
        if (C.check) {
          opened.push(fetched);                       // opened to be scored
          row.score = fetched.score + " of 100";
          if (fetched.score >= BAR) inUse = fetched;
          else if (day >= 6) R.turned++;
        } else {
          inUse = fetched;
        }
      }
      opened.push(inUse);                             // every start loads the file in use
      var calls = 0;
      opened.forEach(function (f) { if (f.code && f.replaced) calls = 1; });
      row.inUse = inUse;
      if (calls) row.call = C.out === "all" ? "unknown address: got out" : "unknown address: stopped";
      if (day >= 6) {
        R.starts++;
        if (inUse.replaced) R.onNew++;
        if (calls) {
          R.tried++;
          if (C.out === "all") R.out++; else R.stopped++;
        }
      }
      R.rows.push(row);
    });
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
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = (C.app === "off" ? "app: off. " : "") + "fetch: " + pick(FETCH, C.fetch).label +
      ". format: " + pick(FORMATS, C.format).label + ". calls out: " + pick(OUTS, C.out).label +
      ". held-out check: " + (C.check ? "on, bar " + BAR + " of 100" : "off") + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["start", "file fetched", "checksum", "held-out check", "file in use", "calls out"], true);
    var R = S.R;
    if (!R) {
      DAYS.forEach(function (d) { row(ui, [d + " Oct", "-", "-", "-", "-", "-"], false); });
      ui.note.textContent = "Morning of 15 October in the pump house. Nothing replayed yet.";
      return;
    }
    if (C.app === "off") {
      DAYS.forEach(function (d) { row(ui, [d + " Oct", "app off", "-", "-", "-", "-"], false); });
    } else {
      R.rows.forEach(function (r) {
        row(ui, [r.day + " Oct", r.fetched.label + " (" + r.fetched.sum + ")", r.check, r.score || "-",
          r.inUse.label + ", " + r.inUse.score, r.call], false);
      });
    }
    ui.note.textContent = "6 to 14 Oct: " + R.starts + " starts; on the replaced file " + R.onNew +
      "; calls to an unknown address tried " + R.tried + ", got out " + R.out + ", stopped " + R.stopped + ".";
  }

  function dayRow(R, day) {
    for (var i = 0; i < R.rows.length; i++) if (String(R.rows[i].day) === String(day)) return R.rows[i];
    return null;
  }

  function setStats(api) {
    var S = api.state;
    var st = S.stat;
    var ids = ["before", "beforeCalls", "starts", "onNew", "tried", "out", "stopped", "refused", "turned",
      "inUse", "score", "byHand"];
    if (!S.R) { ids.forEach(function (id) { st[id]("-"); }); return; }
    var R = S.R;
    st.before(BEFORE_STARTS);
    st.beforeCalls(0);
    st.starts(R.starts);
    st.onNew(R.onNew);
    st.tried(R.tried);
    st.out(R.out);
    st.stopped(R.stopped);
    st.refused(R.refused);
    st.turned(R.turned);
    var r = dayRow(R, S.C.day);
    st.inUse(r ? r.inUse.label : "app off");
    st.score(r ? r.inUse.score : "-");
    st.byHand(R.byHand);
  }

  function run(api, what) {
    var S = api.state;
    S.R = replay(S.C);
    var R = S.R;
    draw(api);
    setStats(api);
    if (S.C.app === "off") {
      api.log((what ? what + " " : "") + "app off for the rebuild: 0 starts, 0 calls out; about " + BY_HAND +
        " notices and letters a week translated by hand.", "warn");
      return;
    }
    var first = R.rows[1];
    if (S.C.fetch === "pinned") {
      api.log("6 Oct 04:00 checksum differs from the pin: load refused, last good file kept, warning texted to the volunteer.", "ok");
    } else if (S.C.check) {
      api.log("6 Oct 04:00 held-out check: the new file scored " + first.fetched.score + " of 100, below the bar of " +
        BAR + ": the file in use was kept.", "ok");
    }
    api.log((what ? what + " " : "") + "replayed 6 to 14 Oct: " + R.starts + " starts; on the replaced file " + R.onNew +
      "; calls to an unknown address tried " + R.tried + ", got out " + R.out + ", stopped " + R.stopped +
      "; loads refused " + R.refused + "; turned down by the held-out check " + R.turned + ".",
      R.out ? "bad" : (R.tried || R.onNew ? "warn" : "ok"));
  }

  function planConfig(plan, day) {
    var C = defaults();
    C.plan = plan;
    C.day = day;
    if (plan === "r0") { C.fetch = "pinned"; C.format = "numbers"; }
    if (plan === "r2") C.out = "block";
    if (plan === "r3") C.app = "off";
    return C;
  }

  /* ---------- the module ---------- */

  DL.sims.define("a7e06", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.R = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      function manual(what) {
        if (S.C.plan !== "none") {
          S.C.plan = "none"; S.C.app = "on"; S.ctl.plan.set("none"); what += " (reply cleared.)";
        }
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
      S.ctl.run = api.control.button("run", "replay 6 to 14 Oct", function () { run(api, ""); });
      sel("fetch", "fetch rule", FETCH, "fetch");
      sel("format", "file format", FORMATS, "format");
      sel("out", "firewall, calls out", OUTS, "out");
      S.ctl.check = api.control.toggle("check", "held-out check before a new file", false, function (on) {
        S.C.check = !!on;
        manual("held-out check: " + (on ? "on." : "off."));
      });
      S.ctl.day = api.control.select("day", "day shown", DAYLIST, "14", function (val) {
        var o = pick(DAYLIST, val);
        if (!o) return;
        S.C.day = String(o.value);
        if (S.R) { draw(api); setStats(api); }
      });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        var C = planConfig(String(o.value), S.C.day);
        S.C = C;
        S.ctl.fetch.set(C.fetch); S.ctl.format.set(C.format); S.ctl.out.set(C.out); S.ctl.check.set(C.check);
        run(api, "plan: " + o.label + ".");
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        before: api.stat("before", "starts 1 Mar to 5 Oct", ""),
        beforeCalls: api.stat("beforeCalls", "of those, calls to an unknown address", "ok"),
        starts: api.stat("starts", "starts 6 to 14 Oct", ""),
        onNew: api.stat("onNew", "starts on the replaced file", "bad"),
        tried: api.stat("tried", "calls to an unknown address tried", "bad"),
        out: api.stat("out", "calls that got out", "bad"),
        stopped: api.stat("stopped", "calls stopped at the firewall", "warn"),
        refused: api.stat("refused", "loads refused on checksum", "ok"),
        turned: api.stat("turned", "new files turned down (held-out check)", "ok"),
        inUse: api.stat("inUse", "file in use on the day shown", ""),
        score: api.stat("score", "its held-out score, of 100", ""),
        byHand: api.stat("byHand", "notices and letters a week by hand", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one 04:00 start: the file the app fetched and its checksum, the held-out check if it ran, the file the app then used with its score out of 100, and any call to an unknown address. 5 Oct is the last start before the file was replaced.");

      draw(api);
      setStats(api);
      api.log("Morning of 15 October in the pump house. Nothing replayed yet: " + BEFORE_STARTS +
        " starts from 1 Mar to 5 Oct, 0 calls to an unknown address.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: nothing replayed.
      t.expect(t.stat("starts") === "-" && t.stat("tried") === "-" &&
        has("Morning of 15 October in the pump house. Nothing replayed yet: 219 starts from 1 Mar to 5 Oct, 0 calls to an unknown address."),
        "Opens on 15 October with nothing replayed; 219 clean starts before");

      // 2. As built: 9 starts, 9 calls out, 79.
      t.click("run");
      t.expect(t.stat("before") === 219 && t.stat("beforeCalls") === 0 && t.stat("starts") === 9 &&
        t.stat("onNew") === 9 && t.stat("tried") === 9 && t.stat("out") === 9 && t.stat("score") === 79,
        "As built: 9 starts on the replaced file, 9 calls to an unknown address, all out; held-out 79");

      // 3. The last clean start, 5 October: the March file, 88.
      t.set("day", "5");
      t.expect(t.stat("score") === 88 && t.stat("inUse") === "March file, code-capable",
        "5 Oct 04:00: the March file in use, 88 of 100");

      // 4. Pinned to the March checksum: the 6 October load is refused.
      t.set("day", "14");
      t.set("fetch", "pinned");
      t.expect(t.stat("refused") === 9 && t.stat("tried") === 0 && t.stat("onNew") === 0 && t.stat("score") === 88 &&
        has("6 Oct 04:00 checksum differs from the pin: load refused"),
        "Pinned: 9 loads refused, 0 calls, March file kept at 88");

      // 5. Allow-list alone: the call is stopped, the file still loads.
      t.set("fetch", "newest");
      t.set("out", "allow");
      t.expect(t.stat("tried") === 9 && t.stat("out") === 0 && t.stat("stopped") === 9 &&
        t.stat("onNew") === 9 && t.stat("score") === 79,
        "Allow-list: 9 calls stopped, 0 out, but the replaced file still loads 9 times at 79");

      // 6. Held-out check alone: the file is turned down, but opening it to score it still runs it.
      t.set("out", "all");
      t.set("check", true);
      t.expect(t.stat("turned") === 9 && t.stat("onNew") === 0 && t.stat("score") === 88 && t.stat("tried") === 9 &&
        has("6 Oct 04:00 held-out check: the new file scored 79 of 100, below the bar of 85"),
        "Held-out check: 9 turned down, 88 kept, yet 9 calls tried while scoring");

      // 7. Numbers only alone: no code runs, but the changed model is still used.
      t.set("check", false);
      t.set("format", "numbers");
      t.expect(t.stat("tried") === 0 && t.stat("onNew") === 9 && t.stat("score") === 79,
        "Numbers only: 0 calls, but 9 starts on the replaced model at 79");

      // 8. Reply 0: pinned, numbers only.
      t.set("plan", "r0");
      t.expect(t.stat("refused") === 9 && t.stat("tried") === 0 && t.stat("onNew") === 0 && t.stat("score") === 88 &&
        t.stat("inUse") === "March file, numbers only" && has("plan: reply 0: pin to a checksum, numbers only."),
        "Reply 0: 9 refused, 0 calls, the March numbers-only file at 88");

      // 9. Reply 1: download again, as built.
      t.set("plan", "r1");
      t.expect(t.stat("onNew") === 9 && t.stat("tried") === 9 && t.stat("out") === 9 && t.stat("score") === 79,
        "Reply 1: the same replaced file, 9 calls out, 79");

      // 10. Reply 2: block the one address.
      t.set("plan", "r2");
      t.expect(t.stat("tried") === 9 && t.stat("out") === 0 && t.stat("stopped") === 9 &&
        t.stat("onNew") === 9 && t.stat("score") === 79,
        "Reply 2: 9 calls stopped, but 9 starts still run the replaced file at 79");

      // 11. Reply 3: app off for the rebuild.
      t.set("plan", "r3");
      t.expect(t.stat("starts") === 0 && t.stat("tried") === 0 && t.stat("byHand") === 20 &&
        has("app off for the rebuild: 0 starts, 0 calls out; about 20 notices and letters a week translated by hand."),
        "Reply 3: app off, 0 starts, about 20 a week by hand");
    }
  });
})();
