/* sims/s8e02-v1.0.0.js  (published as sims/s8e02.js)
   Case s8e02 "It Didn't Know It Was Dead": a lease lab for Kestrelmoor Freight's night shift.
   On Tuesday 27 October 2026 at 02:51:00 a restore test woke app-0, a machine retired in March, from
   a snapshot of its disk and memory taken at 02:08:20 on Sunday 15 March, with time sync off. Its
   own clock read the snapshot's time, so lease 9 on batch #1102 (granted 02:08:00 for 60 seconds)
   looked valid for 40 more seconds. It wrote three orders to the database (each refused: the newest
   token for #1102 is 10) and sent three texts straight to the texting service (no token check).
   The learner sets app-0's clock, how it judges its lease, the pause between an answer and its act,
   the token gate at texting, ticket numbers on texts, the power-off rule and the lease length, then
   plays 02:50 to 02:52 and reads each lease, each write and text, and the texts that reached drivers.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls app-0's clock, lease judged by, pause after the
     answer, token gate at texting, ticket numbers, power off before handover, lease length; Play
     02:50 to 02:52; Reset. Stats: newest token for #1102, database writes refused, texts handed to
     the texting service, texts refused at the gate, texts that reached drivers, seconds app-0
     believes it owns #1102, the night. selfTest: 10 assertions.

   Where every number comes from (conventions rule 14; the case is content/s8/s8e02-v1.0.0.json).
   All of it is given data stated in sim.lede, and each count is checked by the selfTest.
   - March (Sunday 15 March 2026): lease 9 on batch #1102 granted to app-0 at 02:08:00 for 60 s
     (ends 02:09:00 on the Head of Shift's clock). Snapshot at 02:08:20, 20 s into the lease;
     app-0 shut down. 02:09:00: app-1 gets #1102 with token 10, texts the three drivers, closes the
     batch at 02:09:40. Newest token the database holds for #1102: 10.
   - Tonight (Tuesday 27 October 2026): app-0 wakes at 02:51:00. Its clock reads 02:08:20 on
     15 March, so lease 9 has 60 - 20 = 40 s left by its own clock: until 02:51:40 real time.
     Orders left, one every 10 s: #2630 at 02:51:02 (Chidinma), #2631 at 02:51:12 (Mahalia,
     Hatherley Road), #2632 at 02:51:22 (Bjarke). All three fall inside 40 s: 3 writes refused,
     3 texts. 02:51:40: app-0 asks to renew, refused (batch closed 15 March).
   - The pause: 02:08:20 on 15 March to 02:51:00 on 27 October is 226 days.
   - Ten-minute leases (as if in place in March): 600 - 20 = 580 s left; renewal due 03:00:40.
   - Texting service keeps ticket numbers for 30 days; March's were used 226 days ago.
   - Asking first with the snapshot between a yes and its act: #2630 was already allowed, so 1 write
     refused and 1 text sent; at 02:51:12 the next question is refused and app-0 stops.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var WAKE = 2 * 3600 + 51 * 60;      // 02:51:00 tonight, in seconds after midnight
  var START = 2 * 3600 + 50 * 60;     // 02:50:00, before app-0 wakes
  var SNAP_INTO = 20;                 // the snapshot was taken 20 s into lease 9
  var OLD_TOKEN = 9;
  var NEWEST = 10;
  var PAUSE_DAYS = 226;
  var TICKET_DAYS = 30;
  var ORDERS = [
    { n: "#2630", driver: "Chidinma", at: 2 },
    { n: "#2631", driver: "Mahalia", at: 12, where: " (Hatherley Road, empty for years)" },
    { n: "#2632", driver: "Bjarke", at: 22 }
  ];

  var CLOCKS = [
    { value: "snap", label: "snapshot time, time sync off (as tonight)" },
    { value: "synced", label: "synced to the real time" }
  ];
  var JUDGES = [
    { value: "own", label: "app-0's own clock (as tonight)" },
    { value: "coord", label: "the Head of Shift: ask before each act" }
  ];
  var PAUSES = [
    { value: "none", label: "no pause between the answer and the act" },
    { value: "snapshot", label: "the snapshot falls between a yes and its act" }
  ];
  var ONOFF = [
    { value: "off", label: "off" },
    { value: "on", label: "on" }
  ];
  var POWERS = [
    { value: "off", label: "no rule" },
    { value: "unknown", label: "rule on, nobody knows app-0 is running (as tonight)" },
    { value: "known", label: "rule on, someone sees app-0 start" }
  ];
  var LEASES = [
    { value: "60", label: "60 seconds" },
    { value: "600", label: "10 minutes" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function hms(sec) {
    var s = ((sec % 86400) + 86400) % 86400;
    return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60);
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // Seconds app-0 believes lease 9 still has when it wakes, by its own clock.
  function ownLeft(C) {
    if (C.clock === "synced") return 0;
    return Number(C.lease) - SNAP_INTO;
  }

  // Replays 02:50:00 to 02:52:00. Returns every line and every count.
  function night(C) {
    var r = { lines: [], acts: [], writes: 0, handed: 0, gated: 0, reached: 0, believes: 0, drivers: [], how: "" };
    function line(t, text, tone) { r.lines.push({ t: t, text: text, tone: tone || "" }); }
    line(START, "Batch #1102 has been closed since 15 March; the database's newest token for it is " + NEWEST + ".", "");
    line(WAKE, "app-0 wakes from its March snapshot on the live network, after a pause of " + PAUSE_DAYS + " days on the Head of Shift's clock.", "warn");
    if (C.power === "known") {
      line(WAKE, "Someone sees app-0 start, and the rule powers it off before it acts.", "ok");
      r.how = "powered off before it acted";
      return r;
    }
    if (C.power === "unknown") line(WAKE, "The power-off rule acts only on machines the Head of Shift knows. Nobody knows app-0 is running.", "warn");

    var allowed = [];
    var stopAt = null;
    if (C.judge === "own") {
      var left = ownLeft(C);
      r.believes = left;
      if (left <= 0) {
        line(WAKE, "app-0's clock reads 02:51:00 on Tuesday 27 October: lease 9 ended on 15 March. It asks to renew. Refused: batch #1102 closed on 15 March.", "ok");
        r.how = "its clock showed the lease long over";
        return r;
      }
      line(WAKE, "app-0's clock reads 02:08:20 on Sunday 15 March: lease 9 has " + left + " seconds left by its own clock.", "bad");
      ORDERS.forEach(function (o) { if (o.at < left) allowed.push(o); });
      stopAt = left;
    } else {
      r.believes = "asks each time";
      ORDERS.forEach(function (o, i) {
        if (stopAt !== null) return;
        if (i === 0 && C.pause === "snapshot") {
          line(WAKE + o.at, "app-0 acts on the yes it heard just before the snapshot, on 15 March: lease 9 valid until 02:09:00. That yes is " + PAUSE_DAYS + " days old.", "bad");
          allowed.push(o);
          return;
        }
        line(WAKE + o.at, "app-0 asks the Head of Shift about lease 9 before " + o.n + ". Refused: batch #1102 closed on 15 March. app-0 stops.", "ok");
        stopAt = o.at;
      });
    }

    allowed.forEach(function (o) {
      var t = WAKE + o.at;
      r.writes += 1;
      line(t, "app-0 writes order " + o.n + " with token " + OLD_TOKEN + ". Database: REFUSED, newest " + NEWEST + ".", "ok");
      r.acts.push({ t: t, what: "write " + o.n, token: OLD_TOKEN, answer: "refused by the database, newest " + NEWEST });
      r.handed += 1;
      if (C.gate === "on") {
        r.gated += 1;
        line(t, "app-0 texts " + o.driver + " for " + o.n + " with token " + OLD_TOKEN + ". Gate: REFUSED, " + OLD_TOKEN + " is below " + NEWEST + ".", "ok");
        r.acts.push({ t: t, what: "text " + o.n + " to " + o.driver, token: OLD_TOKEN, answer: "refused at the gate" });
        return;
      }
      var tk = "";
      if (C.ticket === "on") tk = " Ticket " + o.n + "-dispatch was last used on 15 March, " + PAUSE_DAYS + " days ago; tickets are kept " + TICKET_DAYS + " days, so it counts as new.";
      r.reached += 1;
      r.drivers.push(o.driver);
      line(t, "app-0 texts " + o.driver + " for " + o.n + (o.where || "") + ". The texting service checks no token: sent." + tk, "bad");
      r.acts.push({ t: t, what: "text " + o.n + " to " + o.driver, token: OLD_TOKEN, answer: "sent, reached " + o.driver });
    });

    if (C.judge === "own") {
      if (stopAt <= 60) line(WAKE + stopAt, "Lease 9 runs out on app-0's own clock. It asks to renew. Refused: batch #1102 closed on 15 March.", "ok");
      else line(START + 120, "By its own clock app-0 still owns batch #1102 until " + hms(WAKE + stopAt) + ", after this replay ends.", "warn");
    }
    r.how = r.reached ? r.reached + " of 3 texts reached drivers" : "no text reached a driver";
    return r;
  }

  // Leases as each clock sees them.
  function leases(C) {
    var L = Number(C.lease);
    var end9 = 2 * 3600 + 8 * 60 + L;
    var own;
    if (C.judge === "coord") own = "not used: app-0 asks the Head of Shift";
    else if (C.clock === "synced") own = "reads 02:51:00 Tue 27 Oct: ended";
    else own = "reads 02:08:20 Sun 15 Mar: " + (L - SNAP_INTO) + " s left";
    return [
      ["lease 9, app-0", "token 9", "02:08:00 to " + hms(end9) + " Sun 15 Mar: ended " + PAUSE_DAYS + " days ago", own],
      ["lease 10, app-1", "token 10", "from " + hms(end9) + " Sun 15 Mar; batch closed " + hms(end9 + 40), "app-1's clock was synced"],
      ["batch #1102 tonight", "newest 10", "closed since 15 Mar", "-"]
    ];
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
    function table(heads) {
      var wrap = el("div", "overflow-x:auto;");
      var tb = el("table", "width:100%;font-size:12px;");
      var hr = el("tr");
      heads.forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
      var th = el("thead");
      th.appendChild(hr);
      tb.appendChild(th);
      var body = el("tbody");
      tb.appendChild(body);
      wrap.appendChild(tb);
      return { wrap: wrap, body: body };
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var lt = table(["lease", "token", "on the Head of Shift's clock", "on app-0's clock"]);
    box.appendChild(lt.wrap);
    var at = table(["time", "app-0 tries", "token", "answer"]);
    box.appendChild(at.wrap);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { el: el, head: head, leases: lt.body, acts: at.body, sum: sum };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "app-0's clock: " + pick(CLOCKS, C.clock).label + ". Lease judged by: " + pick(JUDGES, C.judge).label +
      ". Gate at texting: " + C.gate + ". Ticket numbers: " + C.ticket + ". Power off: " + pick(POWERS, C.power).label +
      ". Leases: " + pick(LEASES, C.lease).label + ".";
    clear(ui.leases);
    leases(C).forEach(function (row) {
      var tr = ui.el("tr");
      row.forEach(function (x) { tr.appendChild(ui.el("td", "", x)); });
      ui.leases.appendChild(tr);
    });
    clear(ui.acts);
    S.stat.newest(String(NEWEST));
    if (!S.ran) {
      ui.sum.textContent = "Not played yet: it is 02:50:00 and app-0 is still a snapshot.";
      ["writes", "handed", "gated", "reached", "believes", "outcome"].forEach(function (k) { S.stat[k]("not run yet"); });
      return;
    }
    var N = night(C);
    N.acts.forEach(function (a) {
      var tr = ui.el("tr");
      [hms(a.t), a.what, String(a.token), a.answer].forEach(function (x) { tr.appendChild(ui.el("td", "", x)); });
      ui.acts.appendChild(tr);
    });
    ui.sum.textContent = "Texts that reached drivers: " + N.reached + (N.drivers.length ? " (" + N.drivers.join(", ") + ")." : ".");
    S.stat.writes(String(N.writes));
    S.stat.handed(String(N.handed));
    S.stat.gated(String(N.gated));
    S.stat.reached(String(N.reached));
    S.stat.believes(String(N.believes));
    S.stat.outcome(N.how);
  }

  function change(api, what) {
    api.state.ran = false;
    api.log(what + " Set back to 02:50:00, before app-0 wakes.", "");
    draw(api);
  }

  function play(api) {
    var S = api.state;
    if (S.ran) {
      api.log("02:50 to 02:52 has already played. Change a setting or reset to play it again.", "");
      return;
    }
    var N = night(S.C);
    N.lines.forEach(function (l) { api.log(hms(l.t) + " " + l.text, l.tone); });
    api.log("02:52:00: database writes refused " + N.writes + ", texts refused at the gate " + N.gated + ", texts that reached drivers " + N.reached + ".", N.reached ? "bad" : "ok");
    S.ran = true;
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s8e02", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { clock: "snap", judge: "own", pause: "none", gate: "off", ticket: "off", power: "off", lease: "60" };
      S.ran = false;
      S.ui = buildWidget(api);

      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var o = pick(list, v);
          if (!o) return;
          S.C[key] = String(o.value);
          change(api, label + ": " + o.label + ".");
        });
      }
      sel("clock", "app-0's clock", CLOCKS, "clock");
      sel("judge", "Lease judged by", JUDGES, "judge");
      sel("pause", "Pause after the answer", PAUSES, "pause");
      sel("gate", "Token gate at texting", ONOFF, "gate");
      sel("ticket", "Ticket number on texts", ONOFF, "ticket");
      sel("power", "Power off before handover", POWERS, "power");
      sel("lease", "Lease length", LEASES, "lease");
      api.control.button("run", "Play 02:50 to 02:52", function () { play(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        newest: api.stat("newest", "newest token for #1102 (database)", ""),
        writes: api.stat("writes", "database writes refused", "ok"),
        handed: api.stat("handed", "texts app-0 sent out", "warn"),
        gated: api.stat("gated", "texts refused at the gate", "ok"),
        reached: api.stat("reached", "texts that reached drivers", "bad"),
        believes: api.stat("believes", "seconds app-0 believes it owns #1102", "warn"),
        outcome: api.stat("outcome", "the night", "")
      };

      api.info("<strong>How to read it.</strong> The first table shows each lease on the Head of Shift's clock and on app-0's clock. The second shows what app-0 tries once it wakes: each write with its token and the database's answer, and each text with its answer. Settings for app-0's clock, how it judges its lease, the pause and the lease length apply as if they had been in place before March.");

      api.log("Tuesday 27 October 2026, 02:50:00, as built: fencing on in the database, no gate at texting, app-0 still a March snapshot.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: before app-0 wakes.
      t.expect(t.stat("newest") === 10 && t.stat("reached") === "not run yet" && t.stat("writes") === "not run yet" &&
        has("app-0 still a March snapshot."),
        "Opens at 02:50:00 before app-0 wakes: newest token for #1102 is 10, nothing played");

      // 2. As built: the database refuses token 9 three times, yet three texts reach drivers.
      t.click("run");
      t.expect(t.stat("writes") === 3 && t.stat("reached") === 3 && t.stat("gated") === 0 && t.stat("believes") === 40 &&
        has("02:51:02 app-0 writes order #2630 with token 9. Database: REFUSED, newest 10.") &&
        has("texts Mahalia for #2631 (Hatherley Road, empty for years)") &&
        has("02:51:40 Lease 9 runs out on app-0's own clock."),
        "As built: 3 writes refused with token 9, 3 texts reach Chidinma, Mahalia and Bjarke, 40 s believed");

      // 3. A second play is refused until something changes.
      t.click("run");
      t.expect(has("has already played."), "A second play is refused");

      // 4. Option 0: the token gate at texting.
      t.set("gate", "on");
      t.click("run");
      t.expect(t.stat("writes") === 3 && t.stat("gated") === 3 && t.stat("reached") === 0 && has("9 is below 10."),
        "Gate on: 3 writes refused, 3 texts refused at the gate, 0 reach drivers");
      t.set("gate", "off");

      // 5. Option 1: power off before handover works only for a machine someone knows about.
      t.set("power", "unknown");
      t.click("run");
      var unknown = t.stat("reached");
      t.set("power", "known");
      t.click("run");
      t.expect(unknown === 3 && t.stat("reached") === 0 && t.stat("writes") === 0,
        "Power-off rule: app-0 unknown, 3 texts; app-0 known, 0 writes and 0 texts");
      t.set("power", "off");

      // 6. Option 2: ask before each act; the snapshot between a yes and its act lets one through.
      t.set("judge", "coord");
      t.click("run");
      var none = t.stat("reached");
      t.set("pause", "snapshot");
      t.click("run");
      t.expect(none === 0 && t.stat("reached") === 1 && t.stat("writes") === 1 && t.stat("believes") === "asks each time" &&
        has("That yes is 226 days old."),
        "Ask first: 0 texts with no pause, 1 text when the snapshot falls between a yes and its act");
      t.set("judge", "own");
      t.set("pause", "none");

      // 7. Option 3: ten-minute leases: same texts, longer belief.
      t.set("lease", "600");
      t.click("run");
      t.expect(t.stat("reached") === 3 && t.stat("believes") === 580 && has("until 03:00:40"),
        "10-minute leases: still 3 texts, and app-0 believes it owns #1102 for 580 s, until 03:00:40");
      t.set("lease", "60");

      // 8. Ticket numbers alone: March's were forgotten after 30 days.
      t.set("ticket", "on");
      t.click("run");
      t.expect(t.stat("reached") === 3 && has("226 days ago; tickets are kept 30 days"),
        "Ticket numbers alone: still 3 texts, because March's tickets were kept only 30 days");
      t.set("ticket", "off");

      // 9. A synced clock: app-0 sees its lease long over.
      t.set("clock", "synced");
      t.click("run");
      t.expect(t.stat("reached") === 0 && t.stat("believes") === 0, "Synced clock: app-0 sees lease 9 ended in March and sends nothing");

      // 10. With the gate on, no setting gets a text to a driver.
      var all = true;
      CLOCKS.forEach(function (c) { JUDGES.forEach(function (j) { PAUSES.forEach(function (p) {
        ONOFF.forEach(function (k) { POWERS.forEach(function (w) { LEASES.forEach(function (l) {
          var n = night({ clock: c.value, judge: j.value, pause: p.value, gate: "on", ticket: k.value, power: w.value, lease: l.value });
          if (n.reached !== 0 || n.gated !== n.handed) all = false;
        }); }); });
      }); }); });
      t.expect(all, "Gate on: 0 texts reach drivers under every other setting");
    }
  });
})();
