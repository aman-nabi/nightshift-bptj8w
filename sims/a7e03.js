/* sims/a7e03-v1.0.1.js  (published as sims/a7e03.js)
   v1.0.1 (2026-10-15) heading label renamed to now showing (the name check flagged the capitalised word)
   Case a7e03 "What It Told the Stranger": a memory and log inspector for Brassneedle Barbers, a
   chain of six shops whose booking assistant keeps customers' notes and sends every full chat to a
   third-party logging tool. No real model runs here, and no note text exists in this file: each
   note is a job part and, sometimes, a health reason; each repeat is a day and a yes-or-no "held a
   health detail". The sim models the defences and their numbers, never an attack. Widget-style
   sim: it draws its own tables inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: Inspect, memory key (shop or customer), strip
     health details before the prompt, strip health details before the log, option 0's rule line,
     option 1's logging tool off from tonight, option 2's delete every note (as if on the evening
     of 5 October), log retention (no end date, 30 days, 7 days), the day to inspect the logging
     company (tonight 14 October, or 13 November), a plan (one of the four replies), Reset.
     Stats: chats, prompts with another customer's note, answers that repeated one, of those with
     a health detail, repeat days, notes kept, health reasons still sent, chats the logging company
     holds, of those with a health detail, chats sent to it after tonight, the day inspected.
     selfTest: 12 assertions.

   Scope note: the brief gave 1,150 conversations "at this shop" since 6 October. At about 128 a
   day that would be seven times the chain's own per-shop rate (3,200 in 30 days across six shops),
   so in this case the 1,150, the 214 and the 3 are the six shops together. The 22:40 chat was at
   Szilard's shop.

   The model (stated in sim.lede, given data):
   - Memory replay, 6 to 14 October 2026, all six shops. Chats by day:
     118, 121, 125, 130, 128, 131, 133, 129, 135 = 1,150.
     Bookings by day (the only chats that fetch notes): 22, 23, 24, 24, 23, 25, 24, 24, 25 = 214.
   - Shop key (from 6 October): every booking prompt carries the shop's newest notes, at least one
     of them another customer's. Customer key (1 May to 6 October, and the fix): none does.
   - Repeats under the shop key: 9 October (a clipper setting, no health detail), 12 October (an
     allergy, health detail), 14 October 22:40 (a skin condition, health detail) = 3, 2 with a
     health detail.
   - Memory holds 2,640 notes, 310 with a health reason. Stripping before the prompt removes the 310
     reasons and keeps all 2,640 job parts; a repeat then carries no health detail.
   - Option 0's rule line (given): of the 3 repeats only the 22:40 answer still happens; the 214
     prompts still carry the notes.
   - Option 2, delete every note the evening of 5 October (given): day 1's 22 bookings carry none;
     from day 2 new notes fill the shop's store, so 214 - 22 = 192 prompts carry another's note;
     the 3 repeats still happen (those customers had booked again); 0 of 2,640 old notes kept.
   - Logging company, 1 May to 14 October: 18,000 chats, 2,300 with a health detail. Last 30 days
     (15 September to 14 October): 3,200, 400 with a health detail. Last 7 days (8 to 14 October):
     125 + 130 + 128 + 131 + 133 + 129 + 135 = 911, 115 with a health detail.
   - Changes to logging start tonight. Given: the next 30 days, 15 October to 13 November, look
     like the last 30 (3,200 chats, 400 with a health detail; last 7 days 911 and 115).
   - Retention deletes chats older than its limit on the day inspected. On 13 November every chat
     from before tonight is more than 30 days old.

   Where every number comes from (conventions rule 14; the case is content/latent/a7/a7e03-v1.0.0.json):
   - As built: 214 prompts, 3 repeats, 2 with a health detail; logging company tonight 18,000 and
     2,300. Customer key: 0, 0, 0.
   - Retention 30 days tonight: 3,200 and 400. 7 days: 911 and 115.
   - 13 November, logging on, no stripping: no end date 18,000 + 3,200 = 21,200 and
     2,300 + 400 = 2,700; 30 days 3,200 and 400. Stripping before the log: 21,200 and 2,300; with
     30 days 3,200 and 0.
   - Logging off from tonight, 13 November, no end date: 18,000 and 2,300; 0 sent after tonight.
   - Option 0: 214, 1, 1. Option 2: 192, 3, 2, 0 of 2,640 notes kept.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var DAYS = ["6 Oct", "7 Oct", "8 Oct", "9 Oct", "10 Oct", "11 Oct", "12 Oct", "13 Oct", "14 Oct"];
  var CHATS = [118, 121, 125, 130, 128, 131, 133, 129, 135];
  var BOOK = [22, 23, 24, 24, 23, 25, 24, 24, 25];
  var REPEATS = [
    { day: 3, health: false, what: "a clipper setting" },
    { day: 6, health: true, what: "an allergy" },
    { day: 8, health: true, what: "a skin condition, 22:40" }
  ];
  var RULE_KEEPS = 8;          // option 0's rule line: only the 14 October 22:40 repeat still happens (given)
  var NOTES = 2640;
  var NOTES_HEALTH = 310;
  var LOG = {
    all: 18000, allH: 2300,  // 1 May to 14 October
    d30: 3200, d30H: 400,    // 15 September to 14 October
    d7: 911, d7H: 115,       // 8 to 14 October
    next30: 3200, next30H: 400, next7: 911, next7H: 115   // 15 October to 13 November (given)
  };

  var KEYS = [{ value: "shop", label: "Shop (as from 6 October)" }, { value: "customer", label: "Customer" }];
  var RETENTION = [
    { value: "none", label: "No end date (as now)" },
    { value: "30", label: "30 days" },
    { value: "7", label: "7 days" }
  ];
  var INSPECT = [
    { value: "oct", label: "14 October (tonight)" },
    { value: "nov", label: "13 November (30 days on)" }
  ];
  var PLANS = [
    { value: "none", label: "None: set the controls yourself" },
    { value: "r0", label: "Reply: a line in the instructions" },
    { value: "r1", label: "Reply: switch the logging tool off" },
    { value: "r2", label: "Reply: delete every note" },
    { value: "r3", label: "Reply: notes per customer, strip health details" }
  ];

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }
  function defaults() {
    return { key: "shop", stripPrompt: false, stripLog: false, rule: false, logOff: false, wipe: false, retention: "none", inspect: "oct", plan: "none" };
  }

  /* ---------- the model (pure: settings in, counts out) ---------- */

  function memory(C) {
    var M = { days: [], exposed: 0, repeats: [], healthRep: 0 };
    for (var d = 0; d < DAYS.length; d++) {
      var ex = 0;
      if (C.key === "shop") ex = (C.wipe && d === 0) ? 0 : BOOK[d];
      M.days.push({ chats: CHATS[d], book: BOOK[d], exposed: ex, rep: 0 });
      M.exposed += ex;
    }
    if (C.key === "shop") {
      REPEATS.forEach(function (r) {
        if (C.rule && r.day !== RULE_KEEPS) return;
        M.repeats.push(r);
        M.days[r.day].rep += 1;
        if (r.health && !C.stripPrompt) M.healthRep += 1;
      });
    }
    M.notesKept = C.wipe ? 0 : NOTES;
    M.healthSent = C.stripPrompt ? 0 : NOTES_HEALTH;
    return M;
  }

  function logs(C) {
    var L = { held: 0, heldH: 0, sent: 0 };
    if (C.inspect === "oct") {
      if (C.retention === "none") { L.held = LOG.all; L.heldH = LOG.allH; }
      else if (C.retention === "30") { L.held = LOG.d30; L.heldH = LOG.d30H; }
      else { L.held = LOG.d7; L.heldH = LOG.d7H; }
      return L;
    }
    var n30 = C.logOff ? 0 : LOG.next30;
    var n30H = (C.logOff || C.stripLog) ? 0 : LOG.next30H;
    var n7 = C.logOff ? 0 : LOG.next7;
    var n7H = (C.logOff || C.stripLog) ? 0 : LOG.next7H;
    L.sent = n30;
    if (C.retention === "none") { L.held = LOG.all + n30; L.heldH = LOG.allH + n30H; }
    else if (C.retention === "30") { L.held = n30; L.heldH = n30H; }
    else { L.held = n7; L.heldH = n7H; }
    return L;
  }

  function repeatDays(M) {
    if (!M.repeats.length) return "none";
    return M.repeats.map(function (r) { return DAYS[r.day]; }).join(", ");
  }
  function inspectText(C) { return pick(INSPECT, C.inspect).label; }

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
  function onOff(b) { return b ? "on" : "off"; }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "Memory key: " + C.key + ". Strip before prompt: " + onOff(C.stripPrompt) + ". Strip before log: " +
      onOff(C.stripLog) + ". Rule line: " + onOff(C.rule) + ". Logging tool off from tonight: " + onOff(C.logOff) +
      ". Every note deleted first: " + onOff(C.wipe) + ". Retention: " + pick(RETENTION, C.retention).label +
      ". Now showing: " + inspectText(C) + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["day", "chats", "bookings", "prompts with another's note", "answers that repeated one"], true);
    DAYS.forEach(function (d, i) {
      var D = S.M ? S.M.days[i] : null;
      row(ui, [d, CHATS[i], BOOK[i], D ? D.exposed : "-", D ? D.rep : "-"], false);
    });
    if (!S.M) {
      ui.note.textContent = "Morning of 15 October. Nothing inspected yet. Press Inspect.";
      return;
    }
    ui.note.textContent = "Logging company on " + inspectText(C) + ": " + fmt(S.L.held) + " chats held, " + fmt(S.L.heldH) +
      " with a health detail.";
  }

  function setStats(api) {
    var S = api.state;
    var st = S.stat;
    if (!S.M) {
      st.chats("-"); st.exposed("-"); st.repeats("-"); st.healthRep("-"); st.days("-"); st.notesKept("-");
      st.healthSent("-"); st.held("-"); st.heldH("-"); st.sent("-"); st.inspect("-");
      return;
    }
    var M = S.M, L = S.L;
    st.chats(fmt(sum(CHATS)));
    st.exposed(M.exposed);
    st.repeats(M.repeats.length);
    st.healthRep(M.healthRep);
    st.days(repeatDays(M));
    st.notesKept(fmt(M.notesKept) + " of " + fmt(NOTES));
    st.healthSent(M.healthSent);
    st.held(fmt(L.held));
    st.heldH(fmt(L.heldH));
    st.sent(fmt(L.sent));
    st.inspect(inspectText(S.C));
  }

  function run(api, what) {
    var S = api.state;
    S.M = memory(S.C);
    S.L = logs(S.C);
    var M = S.M, L = S.L;
    draw(api);
    setStats(api);
    api.log((what ? what + " " : "") + "6 to 14 October, six shops: " + fmt(sum(CHATS)) + " chats. Prompts with another customer's note " +
      M.exposed + "; answers that repeated one " + M.repeats.length + " (" + repeatDays(M) + "), " + M.healthRep + " with a health detail.",
      M.repeats.length ? "bad" : (M.exposed ? "warn" : "ok"));
    api.log("Logging company on " + inspectText(S.C) + ": " + fmt(L.held) + " chats held, " + fmt(L.heldH) + " with a health detail; " +
      fmt(L.sent) + " sent after tonight. Notes kept " + fmt(M.notesKept) + " of " + fmt(NOTES) + ".", L.heldH ? "warn" : "ok");
  }

  function planConfig(plan, inspect) {
    var C = defaults();
    C.plan = plan;
    C.inspect = inspect;
    if (plan === "r0") C.rule = true;
    if (plan === "r1") C.logOff = true;
    if (plan === "r2") C.wipe = true;
    if (plan === "r3") { C.key = "customer"; C.stripPrompt = true; C.stripLog = true; }
    return C;
  }

  /* ---------- the module ---------- */

  DL.sims.define("a7e03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.M = null;
      S.L = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      function manual(what) {
        if (S.C.plan !== "none") { S.C.plan = "none"; S.ctl.plan.set("none"); what += " (Plan cleared.)"; }
        run(api, what);
      }
      function tog(id, label, key) {
        S.ctl[id] = api.control.toggle(id, label, false, function (on) {
          S.C[key] = !!on;
          manual(label + ": " + (on ? "on." : "off."));
        });
      }
      function sel(id, label, list, key) {
        S.ctl[id] = api.control.select(id, label, list, S.C[key], function (val) {
          var o = pick(list, val);
          if (!o) return;
          S.C[key] = String(o.value);
          manual(label + ": " + o.label + ".");
        });
      }
      S.ctl.run = api.control.button("run", "Inspect", function () { run(api, ""); });
      sel("key", "Memory key", KEYS, "key");
      tog("strip", "Strip health details before the prompt", "stripPrompt");
      tog("striplog", "Strip health details before the log", "stripLog");
      tog("rule", "Rule line: never mention one customer to another", "rule");
      tog("logoff", "Switch the logging tool off from tonight", "logOff");
      tog("wipe", "Delete every note first (evening of 5 October)", "wipe");
      sel("retention", "Log retention", RETENTION, "retention");
      sel("inspect", "Day to inspect the logging company", INSPECT, "inspect");
      S.ctl.plan = api.control.select("plan", "Play a reply", PLANS, "none", function (val) {
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        var C = planConfig(String(o.value), S.C.inspect);
        S.C = C;
        S.ctl.key.set(C.key); S.ctl.strip.set(C.stripPrompt); S.ctl.striplog.set(C.stripLog); S.ctl.rule.set(C.rule);
        S.ctl.logoff.set(C.logOff); S.ctl.wipe.set(C.wipe); S.ctl.retention.set(C.retention);
        run(api, "Plan: " + o.label + ".");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        chats: api.stat("chats", "chats, 6 to 14 October", ""),
        exposed: api.stat("exposed", "prompts with another customer's note", "bad"),
        repeats: api.stat("repeats", "answers that repeated one", "bad"),
        healthRep: api.stat("healthRep", "of those, with a health detail", "bad"),
        days: api.stat("days", "repeat days", ""),
        notesKept: api.stat("notesKept", "notes kept (job part)", "ok"),
        healthSent: api.stat("healthSent", "notes still sent with a health reason", "warn"),
        held: api.stat("held", "chats the logging company holds", "warn"),
        heldH: api.stat("heldH", "of those, with a health detail", "bad"),
        sent: api.stat("sent", "chats sent to it after tonight", ""),
        inspect: api.stat("inspect", "day inspected", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one day for all six shops: its chats, the bookings that fetch notes, the prompts that carried another customer's note, and the answers that repeated one. Below, what the logging company holds on the day you inspect. Changes to logging start tonight, 14 October.");

      draw(api);
      setStats(api);
      api.log("Morning of 15 October at Brassneedle Barbers. Nothing inspected yet: 9 days of memory, 18,000 logged chats.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: nothing inspected.
      t.expect(t.stat("exposed") === "-" && t.stat("held") === "-" &&
        has("Morning of 15 October at Brassneedle Barbers. Nothing inspected yet"),
        "Opens on the morning of 15 October with nothing inspected");

      // 2. As built: the shop key.
      t.click("run");
      t.expect(t.stat("chats") === "1,150" && t.stat("exposed") === 214 && t.stat("repeats") === 3 &&
        t.stat("healthRep") === 2 && t.stat("days") === "9 Oct, 12 Oct, 14 Oct",
        "Shop key: 214 of 1,150 prompts carry another's note; 3 repeats, 2 with a health detail");

      // 3. The logging company tonight.
      t.expect(t.stat("held") === "18,000" && t.stat("heldH") === "2,300" && t.stat("sent") === 0,
        "Logging company tonight: 18,000 chats, 2,300 with a health detail");

      // 4. Customer key: nothing crosses.
      t.set("key", "customer");
      t.expect(t.stat("exposed") === 0 && t.stat("repeats") === 0 && t.stat("notesKept") === "2,640 of 2,640",
        "Customer key: 0 prompts, 0 repeats, all 2,640 notes kept");

      // 5. Shop key with stripping before the prompt: still exposed, no health detail.
      t.set("key", "shop");
      t.set("strip", true);
      t.expect(t.stat("exposed") === 214 && t.stat("repeats") === 3 && t.stat("healthRep") === 0 && t.stat("healthSent") === 0,
        "Strip before prompt: 214 prompts and 3 repeats still, 0 with a health detail");

      // 6. 30 days' retention tonight.
      t.set("retention", "30");
      t.expect(t.stat("held") === "3,200" && t.stat("heldH") === 400,
        "30-day retention tonight: 3,200 chats, 400 with a health detail");

      // 7. 13 November: stripping before the log empties the health details.
      t.set("inspect", "nov");
      var before = t.stat("heldH");
      t.set("striplog", true);
      t.expect(before === 400 && t.stat("held") === "3,200" && t.stat("heldH") === 0 && t.stat("notesKept") === "2,640 of 2,640",
        "13 November, 30 days: 400 health details without stripping, 0 with it, job notes kept");

      // 8. No end date: the old copies stay.
      t.set("retention", "none");
      t.expect(t.stat("held") === "21,200" && t.stat("heldH") === "2,300" && t.stat("sent") === "3,200",
        "13 November, no end date: 21,200 chats held, the old 2,300 health details still there");

      // 9. Reply 0: the rule line.
      t.set("plan", "r0");
      t.expect(t.stat("exposed") === 214 && t.stat("repeats") === 1 && t.stat("healthRep") === 1 &&
        t.stat("held") === "21,200" && t.stat("heldH") === "2,700" && has("Plan: Reply: a line in the instructions."),
        "Reply 0: 214 prompts, 1 repeat; 21,200 chats and 2,700 health details by 13 November");

      // 10. Reply 1: logging off.
      t.set("plan", "r1");
      t.expect(t.stat("exposed") === 214 && t.stat("repeats") === 3 && t.stat("held") === "18,000" &&
        t.stat("heldH") === "2,300" && t.stat("sent") === 0,
        "Reply 1: memory still leaks; 18,000 chats and 2,300 health details stay, 0 sent");

      // 11. Reply 2: delete every note.
      t.set("plan", "r2");
      t.expect(t.stat("exposed") === 192 && t.stat("repeats") === 3 && t.stat("notesKept") === "0 of 2,640",
        "Reply 2: 192 prompts carry new notes, 3 repeats, 0 of 2,640 notes kept");

      // 12. Reply 3: notes per customer, stripping before prompt and log.
      t.set("plan", "r3");
      t.expect(t.stat("exposed") === 0 && t.stat("repeats") === 0 && t.stat("notesKept") === "2,640 of 2,640" &&
        t.stat("held") === "21,200" && t.stat("heldH") === "2,300",
        "Reply 3: 0 and 0, notes kept; the old 2,300 health details stay until retention is set");
    }
  });
})();
