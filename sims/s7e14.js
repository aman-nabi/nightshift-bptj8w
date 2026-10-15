/* sims/s7e14-v1.0.0.js  (published as sims/s7e14.js)
   Case s7e14 "Zero Trust": a network lab for Ardcullen Castle, which hosts residential school trips.
   Its network is flat: every device inside can reach every other, and the payroll database answers
   any device inside without asking who it is. On the night of Wednesday 14 to Thursday 15 October
   2026 the label printer at reception, already taken over (a given event; how is not known and is
   never modelled), sent the payroll database 214 queries, and every one was answered.
   The learner sets the layout (flat, guest wifi split off, segments by role), payroll's rule (answer
   anyone inside, or only the payroll app, with identity on every request and mutual TLS), the outer
   firewall (standard, stronger) and the printer (old, replaced), reads a grid of which devices can
   reach payroll and which it would answer, then plays the night and reads the caller summary.
   Widget-style sim: it draws inside api.root.
   It models the defence and its numbers only. Devices are labels: no addresses, no ports, no
   commands, and nothing about how the printer was reached.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: controls layout, payroll's rule, outer firewall, printer; Play
     the night; Reset. Stats: devices that can reach payroll, school devices that can reach it,
     devices payroll would answer, out-of-date devices payroll would answer, payroll app queries
     answered, label printer queries answered, label printer queries refused, staff records the
     answers could hold, outcome. selfTest: 10 assertions.

   Where every number comes from (conventions rule 14; the case is content/s7/s7e14-v1.0.0.json).
   All of it is given data stated in sim.lede, and each count is checked by the selfTest.
   - 38 castle devices: 2 reception computers, 1 label printer, 3 booking computers, 1 payroll
     computer (runs the payroll app), 1 payroll database, 16 staff laptops, 4 kitchen tablets,
     9 door cameras, 1 guest wifi box. 2+1+3+1+1+16+4+9+1 = 38.
   - The visiting school's phones and tablets on the guest wifi that week: 27.
   - Flat network: every device but the database itself can reach it: 37 castle + 27 school = 64.
     Guest wifi split off: the wifi box and the 27 school devices leave: 36 castle, 0 school.
     Segments by role: only the office segment (the payroll computer) reaches the database: 1.
   - Payroll's rule "anyone inside": it answers every device that can reach it (64, 36 or 1).
     "Only the payroll app": it answers the payroll computer alone: 1.
   - Out of date: the label printer (last software update Tuesday 11 June 2019) and the 9 door
     cameras (last update Tuesday 17 May 2022). Answered as built: 10. Printer replaced: 9.
   - The payroll database holds 61 staff records (names, home addresses, bank details, pay).
   - The night: 00:30 the payroll app's nightly job, 6 queries; 01:52 to 03:19 the label printer,
     214 queries for staff records; 05:30 the database emails the caller summary to the office.
   - The outer firewall sits at the internet link. The night's queries start inside the castle, so
     standard or stronger, they never cross it: it changes no number here.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var APP_QUERIES = 6;
  var PRINTER_QUERIES = 214;
  var STAFF_RECORDS = 61;

  // side: the role segment a device belongs to. castle: false for the school's own devices.
  var GROUPS = [
    { id: "reception", label: "reception computers", n: 2, side: "front desk", castle: true },
    { id: "printer", label: "label printer", n: 1, side: "front desk", castle: true },
    { id: "booking", label: "booking computers", n: 3, side: "front desk", castle: true },
    { id: "app", label: "payroll computer (payroll app)", n: 1, side: "office", castle: true },
    { id: "db", label: "payroll database", n: 1, side: "office", castle: true },
    { id: "laptops", label: "staff laptops", n: 16, side: "staff", castle: true },
    { id: "kitchen", label: "kitchen tablets", n: 4, side: "building", castle: true },
    { id: "cameras", label: "door cameras", n: 9, side: "building", castle: true },
    { id: "wifi", label: "guest wifi box", n: 1, side: "guest", castle: true },
    { id: "school", label: "school phones and tablets", n: 27, side: "guest", castle: false }
  ];

  var LAYOUTS = [
    { value: "flat", label: "flat: everything reaches everything" },
    { value: "guest", label: "guest wifi split off" },
    { value: "segments", label: "segments by role" }
  ];
  var RULES = [
    { value: "anyone", label: "answer anyone inside" },
    { value: "app", label: "only the payroll app: identity on every request, mutual TLS" }
  ];
  var WALLS = [
    { value: "standard", label: "standard" },
    { value: "stronger", label: "stronger" }
  ];
  var PRINTERS = [
    { value: "old", label: "old (last updated Tuesday 11 June 2019)" },
    { value: "new", label: "replaced (new, updates itself)" }
  ];

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function reaches(C, g) {
    if (g.id === "db") return false;
    if (C.layout === "segments") return g.side === "office";
    if (C.layout === "guest") return g.side !== "guest";
    return true;
  }
  function answers(C, g) { return reaches(C, g) && (C.rule === "anyone" || g.id === "app"); }
  function stale(C, g) { return g.id === "cameras" || (g.id === "printer" && C.printer === "old"); }
  function lastUpdate(C, g) {
    if (g.id === "cameras") return "Tue 17 May 2022";
    if (g.id === "printer") return C.printer === "old" ? "Tue 11 Jun 2019" : "new, kept current";
    if (g.id === "school") return "not ours";
    return "kept current";
  }
  function byId(id) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return GROUPS[i];
    return null;
  }
  function totals(C) {
    var t = { castle: 0, reach: 0, school: 0, answered: 0, stale: 0 };
    GROUPS.forEach(function (g) {
      if (g.castle) t.castle += g.n;
      if (reaches(C, g)) {
        t.reach += g.n;
        if (!g.castle) t.school += g.n;
      }
      if (answers(C, g)) {
        t.answered += g.n;
        if (stale(C, g)) t.stale += g.n;
      }
    });
    return t;
  }
  // The night's queries by caller.
  function night(C) {
    var app = answers(C, byId("app")) ? APP_QUERIES : 0;
    var p = byId("printer");
    var r = { app: app, sent: 0, ok: 0, no: 0, how: "none sent", records: 0 };
    if (C.printer !== "old") return r;
    r.sent = PRINTER_QUERIES;
    if (!reaches(C, p)) { r.no = PRINTER_QUERIES; r.how = "stopped at the inner wall"; }
    else if (answers(C, p)) { r.ok = PRINTER_QUERIES; r.how = "all answered"; r.records = STAFF_RECORDS; }
    else { r.no = PRINTER_QUERIES; r.how = "refused: no certificate"; }
    return r;
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
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
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["device", "count", "side", "last update", "can reach payroll", "payroll answers it"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;", h));
    });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);
    var summary = el("pre", "margin:0;font-size:12px;white-space:pre-wrap;");
    box.appendChild(summary);
    api.root.appendChild(box);
    return { el: el, head: head, tbody: tbody, summary: summary };
  }

  function drawGrid(S) {
    var ui = S.ui;
    var C = S.C;
    clear(ui.tbody);
    GROUPS.forEach(function (g) {
      var tr = ui.el("tr", g.id === "printer" ? "font-weight:bold;" : "");
      var cells = [
        g.label, String(g.n), C.layout === "flat" ? "one flat network" : (C.layout === "guest" && g.side !== "guest" ? "castle side" : g.side),
        lastUpdate(C, g),
        g.id === "db" ? "-" : (reaches(C, g) ? "yes" : "no"),
        g.id === "db" ? "-" : (answers(C, g) ? "yes" : "no")
      ];
      cells.forEach(function (x) { tr.appendChild(ui.el("td", "", x)); });
      ui.tbody.appendChild(tr);
    });
  }

  function drawSummary(S) {
    if (!S.ran) {
      S.ui.summary.textContent = "Caller summary: the night hasn't been played yet.";
      return;
    }
    var N = night(S.C);
    S.ui.summary.textContent = [
      "Caller summary, Thursday 15 October, 05:30. Each line: caller, queries, answered, refused.",
      "payroll app      " + APP_QUERIES + "    answered " + N.app + "    refused " + (APP_QUERIES - N.app),
      "label printer    " + N.sent + "  answered " + N.ok + "  refused " + N.no
    ].join("\n");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    S.ui.head.textContent = "Layout: " + pick(LAYOUTS, C.layout).label + ". Payroll's rule: " + pick(RULES, C.rule).label +
      ". Outer firewall: " + C.wall + ". Label printer: " + pick(PRINTERS, C.printer).label + ".";
    drawGrid(S);
    drawSummary(S);
    var T = totals(C);
    S.stat.reach(String(T.reach));
    S.stat.school(String(T.school));
    S.stat.answered(String(T.answered));
    S.stat.stale(String(T.stale));
    if (!S.ran) {
      ["appok", "prok", "prno", "records", "outcome"].forEach(function (k) { S.stat[k]("not run yet"); });
      return;
    }
    var N = night(C);
    S.stat.appok(String(N.app));
    S.stat.prok(String(N.ok));
    S.stat.prno(String(N.no));
    S.stat.records(String(N.records));
    S.stat.outcome(C.printer === "old" ? "printer's queries: " + N.how : "no queries from the new printer");
  }

  // A change sets the night back to before it began.
  function change(api, what) {
    api.state.ran = false;
    api.log(what + " The night is set back to Wednesday 14 October, 23:00.", "");
    draw(api);
  }

  function run(api) {
    var S = api.state;
    var C = S.C;
    if (S.ran) {
      api.log("The night has already played. Change a setting or reset to play it again.", "");
      return;
    }
    var T = totals(C);
    var N = night(C);
    api.log("Wednesday 14 October, 23:00: " + T.reach + " devices can reach the payroll database, " + T.school +
      " of them the school's. It would answer " + T.answered + ".", T.answered > 1 ? "warn" : "ok");
    if (C.wall === "stronger") api.log("The stronger firewall checks what comes in at the internet link. Tonight's queries start inside the castle, so they never cross it.", "");
    api.log("Thursday 15 October 00:30: the payroll app's nightly job sends " + APP_QUERIES + " queries. " +
      (C.rule === "app" ? "Each side shows its certificate and checks the other's; " : "") + N.app + " answered.", "ok");
    if (C.printer === "old") {
      var p = "01:52 to 03:19: the label printer, already taken over (a given event; how is not known), sends " + PRINTER_QUERIES + " queries for staff records. ";
      if (N.how === "all answered") api.log(p + "Payroll answers all " + PRINTER_QUERIES + ": the answers could hold all " + STAFF_RECORDS + " staff records.", "bad");
      else if (N.how === "stopped at the inner wall") api.log(p + "All " + PRINTER_QUERIES + " are stopped at the inner wall: the front desk can't reach the office.", "ok");
      else api.log(p + "Payroll asks for its certificate before any question. It has none: all " + PRINTER_QUERIES + " refused.", "ok");
    } else {
      api.log("The new label printer sends no queries. Payroll would still answer " + (T.stale ? T.stale + " out-of-date devices, the 9 door cameras last updated on Tuesday 17 May 2022." : "no out-of-date device."), T.stale ? "warn" : "ok");
    }
    api.log("05:30: the caller summary goes to the office inbox: payroll app " + N.app + " of " + APP_QUERIES + " answered; label printer " + N.ok + " of " + N.sent + " answered.", N.ok ? "bad" : "ok");
    S.ran = true;
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e14", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { layout: "flat", rule: "anyone", wall: "standard", printer: "old" };
      S.ran = false;
      S.ui = buildWidget(api);

      api.control.select("layout", "Layout", LAYOUTS, "flat", function (v) {
        var o = pick(LAYOUTS, v);
        if (!o) return;
        S.C.layout = o.value;
        change(api, "Layout: " + o.label + ".");
      });
      api.control.select("rule", "Payroll's rule", RULES, "anyone", function (v) {
        var o = pick(RULES, v);
        if (!o) return;
        S.C.rule = o.value;
        change(api, "Payroll's rule: " + o.label + ".");
      });
      api.control.select("wall", "Outer firewall", WALLS, "standard", function (v) {
        var o = pick(WALLS, v);
        if (!o) return;
        S.C.wall = o.value;
        change(api, "Outer firewall: " + o.label + ".");
      });
      api.control.select("printer", "Label printer", PRINTERS, "old", function (v) {
        var o = pick(PRINTERS, v);
        if (!o) return;
        S.C.printer = o.value;
        change(api, "Label printer: " + o.label + ".");
      });
      api.control.button("run", "Play the night", function () { run(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        reach: api.stat("reach", "devices that can reach payroll", "warn"),
        school: api.stat("school", "school devices that can reach payroll", "warn"),
        answered: api.stat("answered", "devices payroll would answer", "bad"),
        stale: api.stat("stale", "out-of-date devices payroll would answer", "bad"),
        appok: api.stat("appok", "payroll app queries answered", "ok"),
        prok: api.stat("prok", "label printer queries answered", "bad"),
        prno: api.stat("prno", "label printer queries refused", "ok"),
        records: api.stat("records", "staff records the answers could hold", "bad"),
        outcome: api.stat("outcome", "the night", "")
      };

      api.info("<strong>How to read it.</strong> Each row is a group of devices on the castle's network. A device that can reach payroll can send it a query; payroll's rule decides which of those it answers. Set the layout, the rule, the firewall and the printer, then play the night and read the caller summary.");

      api.log("Wednesday 14 October 2026, 23:00, as built: a flat network, payroll answers anyone inside, the standard firewall, the old label printer. 38 castle devices and the school's 27 on the network.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: before the night, as built.
      t.expect(t.stat("reach") === 64 && t.stat("school") === 27 && t.stat("answered") === 64 && t.stat("stale") === 10 &&
        t.stat("prok") === "not run yet" && has("38 castle devices and the school's 27 on the network."),
        "Opens before the night: 64 devices can reach payroll, 27 of them the school's, all 64 answered, 10 out of date");

      // 2. As built: every one of the printer's 214 queries is answered.
      t.click("run");
      t.expect(t.stat("prok") === 214 && t.stat("prno") === 0 && t.stat("appok") === 6 && t.stat("records") === 61 &&
        t.stat("outcome") === "printer's queries: all answered" && has("the answers could hold all 61 staff records."),
        "As built: 214 of 214 printer queries answered, 61 staff records exposed, the app's 6 answered");

      // 3. A second play is refused until something changes.
      t.click("run");
      t.expect(has("The night has already played."), "A second play is refused");

      // 4. Option 0: a new printer; payroll still answers 64, 9 of them out-of-date cameras.
      t.set("printer", "new");
      t.click("run");
      t.expect(t.stat("reach") === 64 && t.stat("answered") === 64 && t.stat("stale") === 9 && t.stat("prok") === 0 &&
        t.stat("prno") === 0 && has("the 9 door cameras last updated on Tuesday 17 May 2022"),
        "New printer: no queries from it, but payroll still answers 64 devices, 9 of them out of date");

      // 5. Option 1: guest wifi split off; the printer is on the castle side, still answered.
      t.set("printer", "old");
      t.set("layout", "guest");
      t.click("run");
      t.expect(t.stat("reach") === 36 && t.stat("school") === 0 && t.stat("answered") === 36 && t.stat("prok") === 214,
        "Guest wifi split off: 36 can reach payroll, 0 school devices, and the printer's 214 are still answered");

      // 6. Option 2: a stronger outer firewall changes nothing inside.
      t.set("layout", "flat");
      t.set("wall", "stronger");
      t.click("run");
      t.expect(t.stat("reach") === 64 && t.stat("answered") === 64 && t.stat("prok") === 214 && has("they never cross it"),
        "Stronger firewall: 64 still reach and are answered; the printer's 214 still answered");

      // 7. Option 3: payroll answers only the payroll app.
      t.set("wall", "standard");
      t.set("rule", "app");
      t.click("run");
      t.expect(t.stat("reach") === 64 && t.stat("answered") === 1 && t.stat("stale") === 0 && t.stat("prok") === 0 &&
        t.stat("prno") === 214 && t.stat("appok") === 6 && t.stat("records") === 0 && has("It has none: all 214 refused."),
        "Only the payroll app: 64 can reach, 1 answered; the app's 6 answered, the printer's 214 refused");

      // 8. Segments by role alone also stop the printer, at the inner wall.
      t.set("rule", "anyone");
      t.set("layout", "segments");
      t.click("run");
      t.expect(t.stat("reach") === 1 && t.stat("answered") === 1 && t.stat("prno") === 214 && has("stopped at the inner wall"),
        "Segments by role: only the payroll computer reaches payroll; the printer's 214 stop at the inner wall");

      // 9. The castle's devices add up to 38.
      t.expect(totals({ layout: "flat", rule: "anyone", printer: "old" }).castle === 38, "38 castle devices in all");

      // 10. Under payroll's new rule the printer is refused in every layout, with either firewall.
      var all = true;
      ["flat", "guest", "segments"].forEach(function (l) {
        ["standard", "stronger"].forEach(function (w) {
          var n = night({ layout: l, rule: "app", wall: w, printer: "old" });
          if (n.ok !== 0 || n.no !== 214 || n.app !== 6) all = false;
        });
      });
      t.expect(all, "Only the payroll app: the printer's 214 refused and the app's 6 answered in every layout");
    }
  });
})();
