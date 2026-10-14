/* sims/s5e05-v1.0.0.js  (published as sims/s5e05.js)
   Case s5e05 "The Five Rules of the Workshop": a design lab for Hartwick's, a made-to-measure
   furniture workshop whose Python program keeps every job in one big Order class. The learner
   picks a design (one Order class as built, a checklist, router code that refuses unknown woods,
   five classes one per job, a class per wood) and a new wood (walnut last week, or cherry in
   spring), then runs the night on the CNC router. The lab shows which places in the code know the
   new wood, how many edits adding it takes, the cutting list against the router's cut, leg holes
   that come through the top, and which of the five design rules each design keeps or breaks.
   Widget-style sim: it builds its own tables inside api.root. No clock; nothing moves until Run.

   CHANGELOG
   v1.0.0 (2026-10-14) first version: five designs, two new woods, Run the night, Reset.
     Stats: places that know the new wood, edits a new wood needs, cutting list, router cut,
     tops cut wrong, tops not cut, leg holes through the top, edits to add the sixth place.
     selfTest: 11 assertions.

   The model (stated in sim.lede):
   - Woods: oak 28 mm, ash 26 mm, walnut 32 mm, cherry 22 mm (the board thickness). Leg-hole depth
     is the thickness less 4 mm: oak 24, ash 22, walnut 28, cherry 18.
   - Five places in the code know about woods: price, surcharge, cutting list, finish, router
     (send_to_cnc). In March a sixth place is added, leg holes, which drills 4 holes per top.
     Walnut arrives before it (five places); cherry after it (six places).
   - Every table-based design (as built, checklist, refuse, five classes) keeps one table of woods
     in each place, and each table falls back to oak's value when the wood is missing: 28 mm for
     the router, 24 mm for the leg holes. "Refuse" changes only the router: it stops instead.
   - The slip, the same in every design: walnut is added everywhere except the router table (what
     happened); cherry is added everywhere except the leg holes, the newest place.
   - The checklist lists the five places as they were when walnut came. A missed place that is on
     it is caught in review; the leg holes are not on it.
   - A class per wood: a Wood that leaves out any value can't be made (Python's abc module), so the
     slip stops the program at start, before the night, and is fixed. Adding a wood is one new
     class. Adding the sixth place costs the base class plus one edit per existing wood: 1 + 3 = 4.
   - The router cuts tops one after another, 12 minutes each, from 01:00.

   Where every number comes from (conventions rule 14; the case is content/s5/s5e05-v1.0.0.json):
   - Walnut night: order 2212, oak, 2 tops (01:00, 01:12); order 2213, ash, 3 tops (01:24, 01:36,
     01:48); order 2214, walnut, 6 tops (02:00 to 03:00). As built: cutting list 32 mm, router
     28 mm, 6 tops wrong; walnut in 4 of 5 places; a new wood needs 5 edits.
   - Checklist: 5 of 5, router 32 mm, 0 wrong. Refuse: router stops at 02:00 on order 2214, 6 tops
     not cut, 0 wrong. Five classes: 4 of 5, 28 mm, 6 wrong. A class per wood: 1 edit, 32 mm, 0.
   - Cherry night: order 2388, oak, 2 tops; order 2389, ash, 3 tops; order 2390, cherry, 4 tops
     (02:00 to 02:36). Edits a new wood needs: 6, 6, 6, 6, 1. Table designs: 5 of 6, holes drilled
     24 mm into 22 mm cherry, 4 x 4 = 16 holes through the top. A class per wood: 18 mm holes, 0
     through. Edits to add the sixth place: 1 in a table design, 4 with a class per wood.
   - Walnut's surcharge, 15 percent, is in the story only; the lab doesn't price orders.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var WOODS = {
    oak: { mm: 28, hole: 24 },
    ash: { mm: 26, hole: 22 },
    walnut: { mm: 32, hole: 28 },
    cherry: { mm: 22, hole: 18 }
  };
  var FALLBACK = "oak";
  var HOLES_PER_TOP = 4;
  var MIN_PER_TOP = 12;
  var START_MIN = 60; // 01:00

  var PLACES = [
    { id: "price", label: "price()", what: "rate per wood" },
    { id: "surcharge", label: "surcharge()", what: "extra for dear woods" },
    { id: "cutting", label: "cutting_list()", what: "thickness per wood" },
    { id: "finish", label: "plan_finish()", what: "oil per wood" },
    { id: "router", label: "send_to_cnc()", what: "router thickness" },
    { id: "holes", label: "leg_holes()", what: "hole depth per wood" }
  ];
  var CHECKLIST = ["price", "surcharge", "cutting", "finish", "router"];

  var NIGHTS = {
    walnut: {
      label: "Walnut, last week (five places)",
      missed: "router",
      places: 5,
      orders: [{ no: 2212, wood: "oak", tops: 2 }, { no: 2213, wood: "ash", tops: 3 }, { no: 2214, wood: "walnut", tops: 6 }]
    },
    cherry: {
      label: "Cherry, in spring (six places: leg holes added in March)",
      missed: "holes",
      places: 6,
      orders: [{ no: 2388, wood: "oak", tops: 2 }, { no: 2389, wood: "ash", tops: 3 }, { no: 2390, wood: "cherry", tops: 4 }]
    }
  };

  var DESIGNS = [
    { value: "built", label: "One big Order class (as built)" },
    { value: "checklist", label: "As built, plus a checklist in review" },
    { value: "refuse", label: "As built, router refuses unknown woods" },
    { value: "split", label: "Five classes, one per job, each with its table" },
    { value: "woods", label: "A class per wood that every part asks" }
  ];
  var SHORT = {
    built: "one big Order class",
    checklist: "the checklist",
    refuse: "a router that refuses unknown woods",
    split: "five classes, one per job",
    woods: "a class per wood"
  };

  // Which of the five rules each design keeps: [state, reason].
  var RULES = ["One reason to change", "Open to new woods, closed to edits", "Any subtype will do",
    "Small interfaces", "Depend on an idea, not a detail"];
  var TABLE_RULES = [
    ["broken", "Order changes for prices, tax, cutting, finish and the router."],
    ["broken", "A new wood means editing every table."],
    ["n/a", "No subtypes yet."],
    ["broken", "The router code sits inside Order and can see prices."],
    ["broken", "The router looks a word up in its own table."]
  ];
  var KEEPS = {
    built: TABLE_RULES,
    checklist: TABLE_RULES,
    refuse: TABLE_RULES,
    split: [
      ["kept", "Each class has one job."],
      ["broken", "A new wood still means editing every class's table."],
      ["n/a", "No subtypes yet."],
      ["kept", "The router class needs only the wood's name."],
      ["broken", "Each class looks a word up in its own table."]
    ],
    woods: [
      ["partly", "Each wood's facts live in one class; Order still does five jobs."],
      ["kept", "A new wood is one new class; old code is not edited."],
      ["kept", "Every wood must give every value, in the same units."],
      ["partly", "The router is handed the wood, not the whole order."],
      ["kept", "The router asks a Wood for its thickness."]
    ]
  };

  /* ---------- helpers ---------- */

  function hhmm(min) {
    var h = Math.floor(min / 60);
    var m = min % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function placesFor(night) { return PLACES.slice(0, NIGHTS[night].places); }

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  // How each place stands for the new wood: "edited", "missed", "caught" (by the checklist),
  // "asks" (a class per wood; the slip stopped the program at start and was fixed).
  function placeStates(C) {
    var N = NIGHTS[C.night];
    var out = {};
    placesFor(C.night).forEach(function (p) {
      if (C.design === "woods") out[p.id] = "asks";
      else if (p.id !== N.missed) out[p.id] = "edited";
      else if (C.design === "checklist" && CHECKLIST.indexOf(p.id) >= 0) out[p.id] = "caught";
      else out[p.id] = "missed";
    });
    return out;
  }
  function knows(st) { return st !== "missed"; }

  function knowCount(C) {
    var st = placeStates(C);
    var n = 0;
    Object.keys(st).forEach(function (k) { if (knows(st[k])) n += 1; });
    return n;
  }

  function editsNeeded(C) { return C.design === "woods" ? 1 : NIGHTS[C.night].places; }

  // Edits to add the sixth place (leg holes): one new table, or the base class plus each old wood.
  function sixthCost(C) {
    if (C.night !== "cherry") return "none yet";
    return C.design === "woods" ? 1 + 3 : 1;
  }

  // Old woods are in every table; only the new wood can be missing from one.
  function routerMm(C, wood, st, isNew) {
    if (!isNew || knows(st.router)) return WOODS[wood].mm;
    if (C.design === "refuse") return null;
    return WOODS[FALLBACK].mm;
  }
  function holeMm(C, wood, st, isNew) {
    if (!st.holes) return 0;
    return (!isNew || knows(st.holes)) ? WOODS[wood].hole : WOODS[FALLBACK].hole;
  }

  // The night: one row per order.
  function runNight(C) {
    var N = NIGHTS[C.night];
    var st = placeStates(C);
    var t = START_MIN;
    var rows = [];
    var stopped = false;
    N.orders.forEach(function (o) {
      var listMm = WOODS[o.wood].mm;
      var r = { no: o.no, wood: o.wood, tops: o.tops, list: listMm, start: hhmm(t) };
      if (stopped) {
        r.cut = null; r.notCut = o.tops; r.wrong = 0; r.through = 0; r.end = r.start;
      } else {
        var isNew = o.wood === C.night;
        var cut = routerMm(C, o.wood, st, isNew);
        if (cut === null) {
          stopped = true;
          r.cut = null; r.notCut = o.tops; r.wrong = 0; r.through = 0; r.end = r.start;
        } else {
          var depth = holeMm(C, o.wood, st, isNew);
          r.cut = cut;
          r.notCut = 0;
          r.wrong = cut === listMm ? 0 : o.tops;
          r.depth = depth;
          r.through = depth > cut ? o.tops * HOLES_PER_TOP : 0;
          r.end = hhmm(t + (o.tops - 1) * MIN_PER_TOP);
          t += o.tops * MIN_PER_TOP;
        }
      }
      rows.push(r);
    });
    return rows;
  }

  function totals(rows) {
    var s = { wrong: 0, notCut: 0, through: 0 };
    rows.forEach(function (r) { s.wrong += r.wrong; s.notCut += r.notCut; s.through += r.through; });
    return s;
  }

  function rowLine(r, holesOn) {
    var head = (r.start === r.end ? r.start : r.start + " to " + r.end) + ", order " + r.no + ", " + r.wood + ", " + r.tops + " tops: ";
    if (r.cut === null) return r.start + ", order " + r.no + ", " + r.wood + ": REFUSED, no thickness for " + r.wood + ". " + r.tops + " tops not cut.";
    var s = head + "cutting list " + r.list + " mm, router cut " + r.cut + " mm. " + (r.wrong ? "All " + r.wrong + " wrong." : "Match.");
    if (holesOn) s += " Leg holes " + r.depth + " mm" + (r.through ? ", " + r.through + " through the top." : ".");
    return s;
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text !== undefined && text !== null) e.textContent = text;
      return e;
    }
    function table(heads) {
      var tb = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
      var tr = el("tr");
      heads.forEach(function (h) { tr.appendChild(el("th", "text-align:left;padding:2px 6px 2px 0;", h)); });
      var th = el("thead");
      th.appendChild(tr);
      tb.appendChild(th);
      var body = el("tbody");
      tb.appendChild(body);
      return { t: tb, body: body };
    }
    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;");
    box.appendChild(head);
    var cols = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;min-width:0;");
    var left = el("div", "min-width:0;overflow-x:auto;");
    left.appendChild(el("p", "margin:0 0 4px;font-size:12px;font-weight:600;", "Places in the code that know the new wood"));
    var places = table(["place", "keeps", "new wood"]);
    left.appendChild(places.t);
    var right = el("div", "min-width:0;overflow-x:auto;");
    right.appendChild(el("p", "margin:0 0 4px;font-size:12px;font-weight:600;", "The night: cutting list against the router"));
    var night = table(["order", "wood", "tops", "cutting list", "router cut", "holes through"]);
    right.appendChild(night.t);
    cols.appendChild(left);
    cols.appendChild(right);
    box.appendChild(cols);
    var rulesWrap = el("div", "min-width:0;overflow-x:auto;");
    rulesWrap.appendChild(el("p", "margin:0 0 4px;font-size:12px;font-weight:600;", "The five rules, for this design"));
    var rules = table(["rule", "here", "why"]);
    rulesWrap.appendChild(rules.t);
    box.appendChild(rulesWrap);
    api.root.appendChild(box);
    return { el: el, head: head, places: places.body, night: night.body, rules: rules.body };
  }

  function fill(ui, body, rows) {
    while (body.firstChild) body.removeChild(body.firstChild);
    rows.forEach(function (cells) {
      var tr = ui.el("tr");
      cells.forEach(function (c) { tr.appendChild(ui.el("td", "padding:2px 6px 2px 0;", c)); });
      body.appendChild(tr);
    });
  }

  var STATE_TEXT = {
    edited: "edited",
    missed: "MISSED: uses oak's",
    caught: "missed, caught by the checklist",
    asks: "asks the wood"
  };

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var N = NIGHTS[C.night];
    var wood = N.orders[2].wood;
    var st = placeStates(C);
    var ui = S.ui;
    ui.head.textContent = "Design: " + SHORT[C.design] + ". New wood: " + wood + ". " +
      (S.rows ? "The night has run." : "Three orders wait for the router at 01:00.");
    fill(ui, ui.places, placesFor(C.night).map(function (p) {
      var s = st[p.id];
      if (C.design === "refuse" && p.id === "router" && s === "missed") return [p.label, p.what, "MISSED: refuses"];
      return [p.label, p.what, STATE_TEXT[s]];
    }));
    var rows = S.rows || N.orders.map(function (o) { return { no: o.no, wood: o.wood, tops: o.tops, list: WOODS[o.wood].mm, pending: true }; });
    fill(ui, ui.night, rows.map(function (r) {
      if (r.pending) return [String(r.no), r.wood, String(r.tops), r.list + " mm", "not yet", "-"];
      return [String(r.no), r.wood, String(r.tops), r.list + " mm", r.cut === null ? "REFUSED" : r.cut + " mm",
        st.holes && r.cut !== null ? String(r.through) : "-"];
    }));
    fill(ui, ui.rules, RULES.map(function (name, i) { return [name, KEEPS[C.design][i][0], KEEPS[C.design][i][1]]; }));

    var mine = S.rows ? S.rows[2] : null;
    S.stat.places(knowCount(C) + " of " + N.places);
    S.stat.edits(editsNeeded(C));
    S.stat.list(WOODS[wood].mm + " mm");
    S.stat.cut(!mine ? "not yet" : (mine.cut === null ? "refused" : mine.cut + " mm"));
    var tt = S.rows ? totals(S.rows) : { wrong: 0, notCut: 0, through: 0 };
    S.stat.wrong(tt.wrong);
    S.stat.notCut(tt.notCut);
    S.stat.holes(tt.through);
    S.stat.sixth(sixthCost(C));
  }

  function describe(C) {
    var N = NIGHTS[C.night];
    var wood = N.orders[2].wood;
    var missed = PLACES.filter(function (p) { return p.id === N.missed; })[0].label;
    if (C.design === "woods") {
      return "Adding " + wood + " is 1 new class. A " + wood + " class that leaves a value out can't be made, so the program stops at start and the slip is fixed before the night.";
    }
    var s = "Adding " + wood + " needs " + N.places + " edits, one in each place. " + (N.places - 1) + " were made; " + missed + " was missed";
    if (C.design === "checklist") {
      s += CHECKLIST.indexOf(N.missed) >= 0 ? ", and the checklist caught it in review." : ", and it isn't on the checklist.";
    } else if (C.design === "refuse" && N.missed === "router") {
      s += ", so the router will refuse " + wood + ".";
    } else {
      s += ".";
    }
    return s;
  }

  /* ---------- the module ---------- */

  DL.sims.define("s5e05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { design: "built", night: "walnut" };
      S.rows = null;
      S.ui = buildWidget(api);
      S.ctl = {};

      S.ctl.design = api.control.select("design", "Design", DESIGNS, "built", function (v) {
        var o = pick(DESIGNS, v);
        if (!o || o.value === S.C.design) return;
        S.C.design = String(o.value);
        S.rows = null;
        api.log("Design: " + SHORT[S.C.design] + ". " + describe(S.C), "");
        draw(api);
      });
      var nightOpts = Object.keys(NIGHTS).map(function (k) { return { value: k, label: NIGHTS[k].label }; });
      S.ctl.wood = api.control.select("wood", "New wood", nightOpts, "walnut", function (v) {
        var x = String(v);
        if (!NIGHTS[x] || x === S.C.night) return;
        S.C.night = x;
        S.rows = null;
        var extra = x === "cherry" ? " In March a sixth place, leg_holes(), was added: " + sixthCost(S.C) + (sixthCost(S.C) === 1 ? " edit" : " edits") + " with this design." : "";
        api.log("New wood: " + x + "." + extra + " " + describe(S.C), "");
        draw(api);
      });
      S.ctl.run = api.control.button("run", "Run the night", function () {
        var rows = runNight(S.C);
        var holesOn = !!placeStates(S.C).holes;
        rows.forEach(function (r) {
          var tone = r.cut === null ? "warn" : (r.wrong || r.through ? "bad" : "ok");
          api.log(rowLine(r, holesOn), tone);
        });
        var tt = totals(rows);
        api.log("Night over with " + SHORT[S.C.design] + ": " + tt.wrong + " tops cut wrong, " + tt.notCut + " not cut, " +
          tt.through + " leg holes through the top.", tt.wrong || tt.through ? "bad" : (tt.notCut ? "warn" : "ok"));
        S.rows = rows;
        draw(api);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        places: api.stat("places", "places that know the new wood", "warn"),
        edits: api.stat("edits", "edits a new wood needs", ""),
        list: api.stat("list", "cutting list, new wood", ""),
        cut: api.stat("cut", "router cut, new wood", "bad"),
        wrong: api.stat("wrong", "tops cut wrong", "bad"),
        notCut: api.stat("notcut", "tops not cut", "warn"),
        holes: api.stat("holes", "leg holes through the top", "bad"),
        sixth: api.stat("sixth", "edits to add the sixth place", "")
      };

      api.info("<strong>How to read it.</strong> Left: every place in the code that holds facts about woods, and whether the new wood reached it. Right: each order's cutting list beside what the router cut. Below: the five rules of design and whether this design keeps them. Change the design or the wood, then press Run the night.");

      api.log("Walnut is in 4 of 5 places: price, surcharge, cutting list and finish. send_to_cnc() has no walnut. Orders 2212, 2213 and 2214 wait for the router at 01:00.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: walnut in four places, nothing cut yet.
      t.expect(t.stat("places") === "4 of 5" && t.stat("edits") === 5 && t.stat("list") === "32 mm" &&
        t.stat("cut") === "not yet" && t.stat("wrong") === 0 && t.stat("sixth") === "none yet" &&
        has("Walnut is in 4 of 5 places"),
        "Opens before the night: walnut in 4 of 5 places, 5 edits per new wood, cutting list 32 mm, nothing cut");

      // 2. As built: the router falls back to oak's 28 mm for all six walnut tops.
      t.click("run");
      t.expect(t.stat("cut") === "28 mm" && t.stat("wrong") === 6 &&
        has("02:00 to 03:00, order 2214, walnut, 6 tops: cutting list 32 mm, router cut 28 mm. All 6 wrong.") &&
        has("01:00 to 01:12, order 2212, oak, 2 tops: cutting list 28 mm, router cut 28 mm. Match.") &&
        has("01:24 to 01:48, order 2213, ash, 3 tops: cutting list 26 mm, router cut 26 mm. Match."),
        "As built: oak and ash match; order 2214's six walnut tops are cut at 28 mm against a 32 mm cutting list");

      // 3. The checklist catches the router table for walnut.
      t.set("design", "checklist");
      t.click("run");
      t.expect(t.stat("places") === "5 of 5" && t.stat("edits") === 5 && t.stat("cut") === "32 mm" && t.stat("wrong") === 0 &&
        has("the checklist caught it in review."),
        "Checklist: review catches send_to_cnc, walnut is cut at 32 mm, still 5 edits per wood");

      // 4. Refusing unknown woods stops the cut instead of guessing.
      t.set("design", "refuse");
      t.click("run");
      t.expect(t.stat("cut") === "refused" && t.stat("wrong") === 0 && t.stat("notcut") === 6 && t.stat("edits") === 5 &&
        has("02:00, order 2214, walnut: REFUSED, no thickness for walnut. 6 tops not cut."),
        "Refuse: the router stops at 02:00 on order 2214; nothing cut wrong, 6 tops not cut, still 5 edits");

      // 5. Five classes, one per job: the same five tables, the same miss.
      t.set("design", "split");
      t.click("run");
      t.expect(t.stat("places") === "4 of 5" && t.stat("edits") === 5 && t.stat("cut") === "28 mm" && t.stat("wrong") === 6,
        "Five classes: still five tables of woods, walnut cut at 28 mm, 6 wrong");

      // 6. A class per wood: one edit, and the router asks the wood.
      t.set("design", "woods");
      t.click("run");
      t.expect(t.stat("edits") === 1 && t.stat("places") === "5 of 5" && t.stat("cut") === "32 mm" && t.stat("wrong") === 0 &&
        has("Adding walnut is 1 new class."),
        "A class per wood: walnut is one new class, cut at 32 mm, 0 wrong");

      // 7. Cherry in spring: edits per design 6, 6, 6, 6, 1.
      t.set("wood", "cherry");
      var counts = [];
      ["built", "checklist", "refuse", "split", "woods"].forEach(function (d) { t.set("design", d); counts.push(t.stat("edits")); });
      t.expect(counts.join(" ") === "6 6 6 6 1", "Adding cherry: 6 edits in every table design, 1 with a class per wood");

      // 8. Cherry, as built: thickness right, leg holes drilled at oak's 24 mm through 22 mm cherry.
      t.set("design", "built");
      t.click("run");
      t.expect(t.stat("places") === "5 of 6" && t.stat("cut") === "22 mm" && t.stat("wrong") === 0 && t.stat("holes") === 16 &&
        has("02:00 to 02:36, order 2390, cherry, 4 tops: cutting list 22 mm, router cut 22 mm. Match. Leg holes 24 mm, 16 through the top."),
        "Cherry as built: cut at 22 mm, but 16 leg holes drilled 24 mm come through the top");

      // 9. The checklist doesn't list the sixth place; refusing doesn't cover it either.
      t.set("design", "checklist");
      t.click("run");
      var ch = t.stat("holes") === 16 && has("and it isn't on the checklist.");
      t.set("design", "refuse");
      t.click("run");
      t.expect(ch && t.stat("holes") === 16 && t.stat("notcut") === 0,
        "Cherry: the checklist misses leg_holes() and the refusing router doesn't cover it; 16 holes through either way");

      // 10. A class per wood: holes at 18 mm, none through; the sixth place cost 4 edits, not 1.
      t.set("design", "woods");
      t.click("run");
      var w = t.stat("holes") === 0 && t.stat("sixth") === 4 && has("Leg holes 18 mm.");
      t.set("design", "split");
      t.expect(w && t.stat("sixth") === 1,
        "Cherry with a class per wood: 18 mm holes, none through; adding the sixth place cost 4 edits there and 1 in a table design");

      // 11. Reset returns to the night before.
      t.click("reset");
      t.expect(t.stat("places") === "4 of 5" && t.stat("cut") === "not yet" && t.stat("edits") === 5,
        "Reset: back to walnut in 4 of 5 places, nothing cut");
    }
  });
})();
