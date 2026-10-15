/* sims/s7e08-v1.0.0.js  (published as sims/s7e08.js)
   Case s7e08 "The Tenant Upstairs": a tenant lab for the back office of Gorsebrook Parade, nine small
   shops that share one booking and accounts system. Every row carries a shop id; the new month-end
   report's query forgot to filter on it. The learner chooses how the shops are kept apart, whether the
   query has its shop filter, whether a test runs the month-end report for each shop before release,
   which query runs (the month-end report, or a bookings export added later with no test of its own),
   and whether the toy shop moves to a system of its own. Then the 30 September run shows Mr Elphick's
   report, its lines coloured by the shop that owns them, how many are other shops', and a cost and
   upkeep line for each way of keeping shops apart. Widget-style sim: it draws inside api.root.
   It models the defence and its numbers only. No login, password or real query is run; the query is
   a label, and the outcome follows from the rules below.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: how shops are kept apart (shop filter in the query only, as built;
     database row rules; a schema per shop; a database per shop); shop filter (written, left out); a
     test of the month-end report for each shop (on, off); which query (month-end report, bookings
     export); toy shop moved to its own system (on, off). Stats: lines in Mr Elphick's report, other
     shops' lines, toy shop lines, pages printed, reports holding other shops' rows, cost and upkeep.
     selfTest: 11 assertions.

   The model (stated in sim.lede), as given data from the case content/s7/s7e08-v1.0.0.json:
   - September has 4,700 bookings: Thimblewick Toys (shop 1) 1,300, Mr Elphick the cobbler (shop 2)
     610, the tailor 520, the key cutter 490, the music shop 480, the clock mender 410, the framer 350,
     the hatter 300, the bookbinder 240. Sum 4,700. Other shops' lines in his report: 4,700 - 610 = 4,090;
     of which the toy shop's 1,300 and the seven others' 2,790.
   - A printed page holds 50 lines: 610 lines -> 13 pages (12.2 rounded up), 4,700 -> 94, 3,400 -> 68.
   - A report leaks exactly when the shops are kept apart by the shop filter in the query only, the
     filter is left out, and no test held the query back. Row rules, a schema per shop and a database
     per shop each return only the shop's own rows, filter or not (each report signs in as its shop).
   - The test runs the month-end report for each shop and checks its totals against that shop's own
     bookings. It catches the month-end report on 14 September, so the 30 September run uses the old
     report (0 leaked). It never runs the bookings export, which has no test of its own.
   - Leaking report: every shop's report in the shared system holds every shared shop's rows.
     9 shops share -> "9 of 9" reports leak; toy shop moved out -> 8 share, 3,400 lines, 2,790 others,
     0 toy lines, "8 of 9" (the toy shop's own system holds only its own rows).
   - Cost and upkeep, given data: one shared database £40 a month; a database per shop £40 each, £360
     for nine; moving one shop to a system of its own adds £40 and a second system to look after (not
     with a database per shop, where every shop already has its own).
   Where every number comes from (conventions rule 14): 4,700, 610, 1,300, 4,090, 2,790, 94 pages,
   13 pages, 23:00 and the dates come from the post; 3,400, 68 pages, £40, £80 and £360 from the
   given data above; every count is checked by the selfTest.
   Not modelled: the printer's 5 pages a minute and the 23:05 look, the 00:20 stop, the eight emails.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var PER_PAGE = 50;
  var COBBLER = 2;
  var TOYS = 1;
  var SHOPS = [
    { id: 1, name: "Thimblewick Toys", n: 1300 },
    { id: 2, name: "Elphick, cobbler", n: 610 },
    { id: 3, name: "Huxtable, tailor", n: 520 },
    { id: 4, name: "Bodkin, key cutter", n: 490 },
    { id: 5, name: "Ravensworth music shop", n: 480 },
    { id: 6, name: "Ebbeson, clock mender", n: 410 },
    { id: 7, name: "Cuthbertson, framer", n: 350 },
    { id: 8, name: "Truscombe, hatter", n: 300 },
    { id: 9, name: "Mossop, bookbinder", n: 240 }
  ];

  var ISO = [
    { value: "app", label: "the shop filter in each query only (as built)" },
    { value: "rls", label: "database row rules: a login sees only its shop's rows" },
    { value: "schema", label: "a schema per shop: its own drawer of tables" },
    { value: "dbper", label: "a database per shop: its own cabinet" }
  ];
  var ISO_SHORT = {
    app: "the shop filter in each query only",
    rls: "database row rules",
    schema: "a schema per shop",
    dbper: "a database per shop"
  };
  var QUERIES = [
    { value: "month", label: "the new month-end report" },
    { value: "export", label: "a bookings export added later, no test of its own" }
  ];
  var QUERY_SHORT = { month: "the month-end report", export: "the bookings export" };

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function shop(id) { for (var i = 0; i < SHOPS.length; i++) if (SHOPS[i].id === id) return SHOPS[i]; return null; }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // The shops that share one database with Mr Elphick.
  function pool(C) {
    if (C.iso === "dbper") return [shop(COBBLER)];
    return SHOPS.filter(function (s) { return !(C.moved && s.id === TOYS); });
  }
  function caught(C) {
    return C.test && C.query === "month" && C.iso === "app" && !C.filter;
  }
  function leaks(C) {
    return C.iso === "app" && !C.filter && !caught(C);
  }
  // Lines in Mr Elphick's report, by owning shop id.
  function reportRows(C) {
    var out = {};
    if (leaks(C)) pool(C).forEach(function (s) { out[s.id] = s.n; });
    else out[COBBLER] = shop(COBBLER).n;
    return out;
  }
  function total(rows) {
    var t = 0;
    Object.keys(rows).forEach(function (k) { t += rows[k]; });
    return t;
  }
  function pages(n) { return Math.ceil(n / PER_PAGE); }
  function leakedReports(C) {
    return leaks(C) && pool(C).length > 1 ? pool(C).length : 0;
  }
  function costLine(iso, moved) {
    var two = moved && iso !== "dbper";
    var money = two ? "£80 a month" : "£40 a month";
    var tail = two ? "; 2 systems to look after" : "";
    if (iso === "app") return money + "; every query must remember the shop filter" + tail;
    if (iso === "rls") return money + "; one row rule per shared table to keep" + tail;
    if (iso === "schema") return money + "; 9 copies of every table to change" + tail;
    return "£360 a month; 9 databases to upgrade and back up";
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";

  function mk(doc, tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, String(attrs[k]));
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(doc, parent, x, y, text, cls, anchor) {
    var t = mk(doc, "text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" }, parent);
    t.textContent = text;
    return t;
  }
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
    var svg = mk(doc, "svg", {
      viewBox: "0 0 660 120", width: "100%", "class": "dg", role: "img",
      "aria-label": "Mr Elphick's report drawn as one bar, split by the shop that owns each line. Green is his own lines; red is every other shop's. The table below lists each shop's lines."
    });
    var layer = mk(doc, "g", {}, svg);
    box.appendChild(svg);
    var table = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["shop", "id", "September bookings", "lines in his report"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    box.appendChild(table);
    var costs = el("pre", "margin:0;font-size:12px;white-space:pre-wrap;");
    box.appendChild(costs);
    api.root.appendChild(box);
    return { doc: doc, el: el, head: head, layer: layer, tbody: tbody, costs: costs };
  }

  function drawBar(S) {
    var ui = S.ui;
    var doc = ui.doc;
    var g = ui.layer;
    clear(g);
    if (!S.ran) {
      mk(doc, "rect", { x: 20, y: 30, width: 620, height: 30, "class": "dg-gap" }, g);
      txt(doc, g, 330, 50, "not run yet", "dg-note", "middle");
      txt(doc, g, 20, 95, "His report prints at the 23:00 run.", "dg-axis", "start");
      return;
    }
    var rows = S.rows;
    var n = total(rows);
    var x = 20;
    SHOPS.forEach(function (s) {
      var c = rows[s.id] || 0;
      if (!c) return;
      var w = 620 * c / n;
      var gg = mk(doc, "g", { "class": "dg-node st-" + (s.id === COBBLER ? "ok" : "bad") }, g);
      mk(doc, "rect", { x: Math.round(x * 10) / 10, y: 30, width: Math.round(w * 10) / 10, height: 30 }, gg);
      x += w;
    });
    txt(doc, g, 20, 20, "Mr Elphick's report: " + fmt(n) + " lines, " + pages(n) + " pages", "dg-note", "start");
    txt(doc, g, 20, 85, "Green: his own " + fmt(rows[COBBLER]) + " lines.", "dg-axis", "start");
    txt(doc, g, 20, 105, "Red: other shops' " + fmt(n - rows[COBBLER]) + " lines.", "dg-axis", "start");
  }

  function drawTable(S) {
    var ui = S.ui;
    clear(ui.tbody);
    var C = S.C;
    var shared = pool(C).map(function (s) { return s.id; });
    SHOPS.forEach(function (s) {
      var tr = ui.el("tr");
      var where = (C.iso === "dbper" || (C.moved && s.id === TOYS)) ? " (own system)" : "";
      if (C.iso !== "dbper" && shared.indexOf(s.id) < 0 && !where) where = " (own system)";
      var cells = [s.name + where, String(s.id), fmt(s.n), S.ran ? fmt(S.rows[s.id] || 0) : "-"];
      cells.forEach(function (c) { tr.appendChild(ui.el("td", "", c)); });
      ui.tbody.appendChild(tr);
    });
    var lines = ["Cost and upkeep, as given data" + (C.moved ? " (toy shop moved out)" : "") + ":"];
    ISO.forEach(function (o) {
      lines.push((o.value === C.iso ? "> " : "  ") + ISO_SHORT[o.value] + ": " + costLine(o.value, C.moved));
    });
    ui.costs.textContent = lines.join("\n");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    S.ui.head.textContent = "Kept apart by: " + ISO_SHORT[C.iso] + ". Shop filter: " + (C.filter ? "written" : "left out") +
      ". Test of the month-end report: " + (C.test ? "on" : "off") + ". Query: " + QUERY_SHORT[C.query] +
      ". Toy shop: " + (C.moved ? "moved to its own system" : "shares the system") + ".";
    drawBar(S);
    drawTable(S);
    S.stat.cost(costLine(C.iso, C.moved));
    if (!S.ran) {
      S.stat.lines("not run yet");
      S.stat.others("not run yet");
      S.stat.toys("not run yet");
      S.stat.pages("not run yet");
      S.stat.leaked("not run yet");
      return;
    }
    var n = total(S.rows);
    S.stat.lines(fmt(n));
    S.stat.others(fmt(n - S.rows[COBBLER]));
    S.stat.toys(fmt(S.rows[TOYS] || 0));
    S.stat.pages(pages(n));
    S.stat.leaked(leakedReports(C) + " of " + SHOPS.length);
  }

  // Any change sets the night back to before the run.
  function change(api, what) {
    api.state.ran = false;
    api.log(what + " Set back to before the 23:00 run.", "");
    draw(api);
  }

  function run(api) {
    var S = api.state;
    var C = S.C;
    if (S.ran) {
      api.log("Already ran 30 September. Change a setting or reset to run it again.", "");
      return;
    }
    var shared = pool(C);
    api.log("30 September, 23:00: " + QUERY_SHORT[C.query] + " runs for each of the " + SHOPS.length + " shops.", "");
    if (caught(C)) {
      var t = 0;
      shared.forEach(function (s) { t += s.n; });
      api.log("On 14 September the test ran the new report for each shop: shop 2's total came back over " + fmt(t) + " bookings, not 610, so the report was held back. Tonight's run used the old report.", "ok");
    } else if (C.test && C.query === "export" && C.iso === "app" && !C.filter) {
      api.log("The test covers the month-end report only; the export was never tested.", "warn");
    }
    if (C.iso === "rls") api.log("Each report signs in as its own shop, and the row rule hands back only that shop's rows" + (C.filter ? "." : ", even with the filter left out."), "ok");
    else if (C.iso === "schema") api.log("Each report reads only its own shop's drawer of tables" + (C.filter ? "." : ", so the missing filter finds nothing else."), "ok");
    else if (C.iso === "dbper") api.log("Each report reads only its own shop's database" + (C.filter ? "." : ", so the missing filter finds nothing else."), "ok");
    S.rows = reportRows(C);
    var n = total(S.rows);
    var others = n - S.rows[COBBLER];
    if (others > 0) {
      api.log("Mr Elphick's report: " + fmt(n) + " lines, " + pages(n) + " pages; " + fmt(others) + " are other shops' lines, " +
        fmt(S.rows[TOYS] || 0) + " of them the toy shop's.", "bad");
      api.log(leakedReports(C) + " of " + SHOPS.length + " reports hold other shops' rows.", "bad");
    } else {
      api.log("Mr Elphick's report: " + fmt(n) + " lines, " + pages(n) + " pages, all his own. 0 other shops' lines.", "ok");
    }
    if (C.moved && C.iso !== "dbper") api.log("The toy shop's own system holds only its own rows.", "");
    S.ran = true;
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e08", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { iso: "app", filter: false, test: false, query: "month", moved: false };
      S.ran = false;
      S.rows = {};
      S.ui = buildWidget(api);
      S.ctl = {};

      S.ctl.iso = api.control.select("iso", "How shops are kept apart", ISO, "app", function (v) {
        var o = pick(ISO, v);
        if (!o) return;
        S.C.iso = String(o.value);
        change(api, "Kept apart by: " + ISO_SHORT[S.C.iso] + ".");
      });
      S.ctl.filter = api.control.toggle("filter", "Shop filter written in the query", false, function (on) {
        S.C.filter = !!on;
        change(api, "Shop filter: " + (on ? "written." : "left out."));
      });
      S.ctl.test = api.control.toggle("test", "Test the month-end report for each shop before release", false, function (on) {
        S.C.test = !!on;
        change(api, "Test of the month-end report: " + (on ? "on." : "off."));
      });
      S.ctl.query = api.control.select("query", "Which query runs", QUERIES, "month", function (v) {
        var o = pick(QUERIES, v);
        if (!o) return;
        S.C.query = String(o.value);
        change(api, "Query: " + QUERY_SHORT[S.C.query] + ".");
      });
      S.ctl.moved = api.control.toggle("moved", "Move the toy shop to a system of its own", false, function (on) {
        S.C.moved = !!on;
        change(api, "Toy shop: " + (on ? "moved to its own system." : "back in the shared system."));
      });
      S.ctl.run = api.control.button("run", "Run the 30 September month-end", function () { run(api); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        lines: api.stat("lines", "lines in Mr Elphick's report", ""),
        others: api.stat("others", "other shops' lines in it", "bad"),
        toys: api.stat("toys", "toy shop lines in it", "bad"),
        pages: api.stat("pages", "pages printed", "warn"),
        leaked: api.stat("leaked", "reports holding other shops' rows", "bad"),
        cost: api.stat("cost", "cost and upkeep", "")
      };

      api.info("<strong>How to read it.</strong> Nine shops share one database, and every row carries a shop id. A report leaks when the only wall is the shop filter in its query and the filter is left out. Row rules, a schema per shop and a database per shop each hand a report only its own shop's rows. The bar is Mr Elphick's report: green lines are his, red lines are other shops'. The cost lines are given data.");

      api.log("Before the 23:00 run on 30 September, as built: one login reads every shop, the new month-end report has no shop filter, no test of it for each shop, the toy shop shares the system.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: before the 23:00 run.
      t.expect(t.stat("lines") === "not run yet" && t.stat("others") === "not run yet" && t.stat("pages") === "not run yet" &&
        t.stat("leaked") === "not run yet" && t.stat("cost") === "£40 a month; every query must remember the shop filter",
        "Opens before the run: stats waiting, cost line for the shared database");

      // 2. As built: all 4,700 lines, 4,090 other shops', 1,300 the toy shop's, 94 pages, every report leaks.
      t.click("run");
      t.expect(t.stat("lines") === "4,700" && t.stat("others") === "4,090" && t.stat("toys") === "1,300" &&
        t.stat("pages") === 94 && t.stat("leaked") === "9 of 9" &&
        has("Mr Elphick's report: 4,700 lines, 94 pages; 4,090 are other shops' lines, 1,300 of them the toy shop's."),
        "As built: 4,700 lines on 94 pages, 4,090 other shops', 1,300 the toy shop's, 9 of 9 reports leak");

      // 3. The filter written: his own 610 on 13 pages.
      t.set("filter", true);
      t.click("run");
      t.expect(t.stat("lines") === 610 && t.stat("others") === 0 && t.stat("pages") === 13 && t.stat("leaked") === "0 of 9",
        "Filter written: 610 lines, 13 pages, 0 other shops'");

      // 4. Row rules with the filter still left out: 610, none leaked.
      t.set("filter", false);
      t.set("iso", "rls");
      t.click("run");
      t.expect(t.stat("lines") === 610 && t.stat("others") === 0 && t.stat("toys") === 0 && t.stat("leaked") === "0 of 9" &&
        has("even with the filter left out") && t.stat("cost") === "£40 a month; one row rule per shared table to keep",
        "Row rules, filter left out: 610 lines, 0 other shops', still £40 a month");

      // 5. Row rules guard the later export too.
      t.set("query", "export");
      t.click("run");
      t.expect(t.stat("others") === 0 && t.stat("lines") === 610, "Row rules: the bookings export also returns only his 610");

      // 6. A schema per shop, filter left out: nothing else to find.
      t.set("query", "month");
      t.set("iso", "schema");
      t.click("run");
      t.expect(t.stat("others") === 0 && t.stat("cost") === "£40 a month; 9 copies of every table to change",
        "Schema per shop: 0 other shops' lines, 9 copies of every table to change");

      // 7. A database per shop: 0 leaked, at £360 a month.
      t.set("iso", "dbper");
      t.click("run");
      t.expect(t.stat("others") === 0 && t.stat("lines") === 610 && t.stat("cost") === "£360 a month; 9 databases to upgrade and back up",
        "Database per shop: 0 other shops' lines, £360 a month and 9 databases");

      // 8. The month-end test, filter left out: held back on 14 September, 0 leaked.
      t.set("iso", "app");
      t.set("test", true);
      t.click("run");
      t.expect(t.stat("others") === 0 && t.stat("pages") === 13 && has("so the report was held back"),
        "Test of the month-end report: caught on 14 September, the run used the old report, 0 leaked");

      // 9. The same test does not cover the later export: 4,090 again.
      t.set("query", "export");
      t.click("run");
      t.expect(t.stat("others") === "4,090" && t.stat("leaked") === "9 of 9" && has("the export was never tested"),
        "The test guards one report: the untested export leaks 4,090 lines again");

      // 10. Toy shop moved out, filter left out: 3,400 lines, 2,790 others, no toy lines, 8 of 9 leak, £80.
      t.set("test", false);
      t.set("query", "month");
      t.set("moved", true);
      t.click("run");
      t.expect(t.stat("lines") === "3,400" && t.stat("others") === "2,790" && t.stat("toys") === 0 &&
        t.stat("pages") === 68 && t.stat("leaked") === "8 of 9" &&
        t.stat("cost") === "£80 a month; every query must remember the shop filter; 2 systems to look after",
        "Toy shop moved out: 3,400 lines, 2,790 from the seven other shops, 0 toy lines, 8 of 9 reports leak, £80 a month");

      // 11. Any change sets the night back to before the run.
      t.set("moved", false);
      t.expect(t.stat("lines") === "not run yet" && t.stat("leaked") === "not run yet",
        "Any change sets the night back to before the run");
    }
  });
})();
