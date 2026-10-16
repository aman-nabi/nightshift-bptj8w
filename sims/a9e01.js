/* sims/a9e01-v1.0.0.js  (published as sims/a9e01.js)
   Case a9e01 "The Framework": a replay of the party shop's website assistant, question by question,
   over chats sorted by kind. No real model runs here and no chat text exists in this file: every
   answer follows a stated rule over given counts, set out below and in sim.lede.
   Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: sort the 200 chats, test set (help pages 50, help pages
     100, real mix 50), stock lookup, order diary, model size (small, large as built, larger), stock-only
     rule, stock and order answers sent to the shop, play tonight, a reply to play, reset. Stats: test
     score, real chats the test covers, real chats it answers, tonight right of 40 (and by kind), tonight
     wrong, tonight sent to the shop, model. selfTest: 12 assertions.

   The given data (stated in sim.lede):
   - 200 chats picked across 12 to 28 October: 124 stock and size, 30 ready-by, 46 general.
   - Tonight, Thursday 29 October, 18:00 to 21:00, 40 chats: 31 stock and size (3 ask for sizes still in
     stock; 1 of the 28 sold-out ones describes a costume in the window instead of naming it), 3 ready-by
     (all for Saturday 31 October, whose diary page is full), 6 general (all answered right).
   - Help-page test: 47 of 50 (3 misses on how long helium balloons float, where two help pages
     disagree); 50 more written the same way also 47, so 94 of 100. General kind only.
   - Real-mix test: 50 picked from the 200 in about the same mix: 31 stock and size (5 in stock, 1
     described), 8 ready-by (all for Saturday), 11 general (all answered right).
   The rules, per kind:
   - stock and size: sent to the shop if stock and order answers go to the shop; else with the stock
     lookup every named costume is right and the described one is wrong, or sent to the shop when the
     stock-only rule is on; without the lookup, with the rule on every one is sent to the shop, and
     with it off the product-page answer is right only for a size in stock.
   - ready-by: sent to the shop if stock and order answers go to the shop; else right with the order
     diary, and a wrong yes without it.
   - general: right, whatever the model's size.
   - model size changes no count (given): every miss comes from what the model can see.

   Where every number comes from (conventions rule 14; the case is content/latent/a9/a9e01-v1.0.0.json):
   - As built (large model, no lookup, no diary, no rule): tonight 3 + 0 + 6 = 9 of 40, wrong 28 + 3 = 31;
     help-page test 47 of 50, covering the general kind: 46 of 200.
   - Reply 0 (larger model): still 9 of 40 and 47 of 50.
   - Reply 1 (100 help-page questions): 94 of 100, still 46 of 200; tonight 9.
   - Reply 2 (sorted, both lookups, small model, real-mix test, rule): real mix 30 + 8 + 11 = 49 of 50,
     covers 200 of 200; tonight 30 + 3 + 6 = 39 of 40, 0 wrong, 1 sent to the shop. As built the real-mix
     test is 5 + 0 + 11 = 16 of 50. Lookups on, rule off: 39 of 40 with 1 wrong.
   - Reply 3 (stock and order answers to the shop): answers 46 of 200, 124 + 30 = 154 sent to the shop;
     tonight 0 + 0 + 6 = 6 of 40, 0 wrong, 31 + 3 = 34 sent to the shop.
   - Dates: live since Monday 12 October 2026; the father's chat 18:52, at the counter 19:20; the skeleton
     costume in age 7 to 8 sold out on Tuesday 27 October; close 21:00; interview 10:00 Friday 30 October.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var REAL = { stock: 124, ready: 30, general: 46, total: 200 };
  var TONIGHT = { stock: 31, inStock: 3, described: 1, ready: 3, room: 0, general: 6, generalRight: 6, total: 40 };
  var MIXTEST = { stock: 31, inStock: 5, described: 1, ready: 8, room: 0, general: 11, generalRight: 11, total: 50 };
  var HELP = { "help50": { right: 47, n: 50 }, "help100": { right: 94, n: 100 } };

  var TESTS = [
    { value: "help50", label: "help pages, 50 questions (as built)" },
    { value: "help100", label: "help pages, 100 questions" },
    { value: "real", label: "real mix, 50 questions" }
  ];
  var MODELS = [
    { value: "small", label: "small" },
    { value: "large", label: "large (as built)" },
    { value: "larger", label: "larger" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: a bigger model" },
    { value: "r1", label: "reply 1: 50 more help-page questions" },
    { value: "r2", label: "reply 2: sort by kind, lookups, then choose" },
    { value: "r3", label: "reply 3: stock and order answers to the shop" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function defaults() {
    return { test: "help50", lookup: false, diary: false, model: "large", rule: false, toShop: false,
      played: false, sorted: false, plan: "none" };
  }

  /* ---------- the replay (pure: settings and a set of chats in, counts out) ---------- */

  function stockPart(C, S) {
    if (C.toShop) return { right: 0, wrong: 0, shop: S.stock };
    if (C.lookup) {
      return C.rule ? { right: S.stock - S.described, wrong: 0, shop: S.described }
        : { right: S.stock - S.described, wrong: S.described, shop: 0 };
    }
    if (C.rule) return { right: 0, wrong: 0, shop: S.stock };
    return { right: S.inStock, wrong: S.stock - S.inStock, shop: 0 };
  }
  function readyPart(C, S) {
    if (C.toShop) return { right: 0, wrong: 0, shop: S.ready };
    if (C.diary) return { right: S.ready, wrong: 0, shop: 0 };
    return { right: S.room, wrong: S.ready - S.room, shop: 0 };
  }
  function generalPart(C, S) {
    return { right: S.generalRight, wrong: S.general - S.generalRight, shop: 0 };
  }
  function replay(C, S) {
    var a = stockPart(C, S);
    var b = readyPart(C, S);
    var g = generalPart(C, S);
    return {
      stock: a, ready: b, general: g,
      right: a.right + b.right + g.right,
      wrong: a.wrong + b.wrong + g.wrong,
      shop: a.shop + b.shop + g.shop
    };
  }

  function score(C) {
    var R = {};
    if (C.test === "real") {
      var m = replay(C, MIXTEST);
      R.test = m.right + " of " + MIXTEST.total + " (" + m.stock.right + " + " + m.ready.right + " + " + m.general.right + ")";
      R.covered = REAL.total + " of " + REAL.total;
    } else {
      R.test = HELP[C.test].right + " of " + HELP[C.test].n;
      R.covered = REAL.general + " of " + REAL.total;
    }
    R.answered = C.toShop ? REAL.general + " of " + REAL.total + " (" + (REAL.stock + REAL.ready) + " sent to the shop)"
      : REAL.total + " of " + REAL.total;
    R.model = pick(MODELS, C.model).label;
    if (!C.played) {
      R.tonight = R.stockT = R.readyT = R.generalT = R.wrong = R.shop = "not played yet";
    } else {
      var t = replay(C, TONIGHT);
      R.night = t;
      R.tonight = t.right + " of " + TONIGHT.total + " (" + t.stock.right + " + " + t.ready.right + " + " + t.general.right + ")";
      R.stockT = t.stock.right + " of " + TONIGHT.stock;
      R.readyT = t.ready.right + " of " + TONIGHT.ready;
      R.generalT = t.general.right + " of " + TONIGHT.general;
      R.wrong = t.wrong + " of " + TONIGHT.total;
      R.shop = t.shop + " of " + TONIGHT.total;
    }
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
    var C = api.state.C;
    var R = score(C);
    var ui = api.state.ui;
    ui.head.textContent = "the party shop's assistant. model: " + R.model + ". stock lookup " + (C.lookup ? "on" : "off") +
      ", order diary " + (C.diary ? "on" : "off") + ", stock-only rule " + (C.rule ? "on" : "off") +
      (C.toShop ? ". stock and order answers go to the shop." : ".");
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["kind", "real chats of 200", "tonight's chats", "right tonight", "wrong", "sent to the shop"], true);
    var t = C.played ? R.night : null;
    row(ui, ["stock and size", REAL.stock, TONIGHT.stock, t ? t.stock.right : "-", t ? t.stock.wrong : "-", t ? t.stock.shop : "-"]);
    row(ui, ["ready-by", REAL.ready, TONIGHT.ready, t ? t.ready.right : "-", t ? t.ready.wrong : "-", t ? t.ready.shop : "-"]);
    row(ui, ["general", REAL.general, TONIGHT.general, t ? t.general.right : "-", t ? t.general.wrong : "-", t ? t.general.shop : "-"]);
    ui.note.textContent = "test: " + pick(TESTS, C.test).label + ", " + R.test + ". the test covers " + R.covered +
      " real chats. the assistant answers " + R.answered + ".";
  }

  function setStats(api) {
    var R = score(api.state.C);
    var st = api.state.stat;
    st.test(R.test);
    st.covered(R.covered);
    st.answered(R.answered);
    st.tonight(R.tonight);
    st.stockT(R.stockT);
    st.readyT(R.readyT);
    st.generalT(R.generalT);
    st.wrong(R.wrong);
    st.shop(R.shop);
    st.model(R.model);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    if (!what) return;
    var R = score(api.state.C);
    api.log(what + " test " + R.test + "; covers " + R.covered + "; tonight " + R.tonight + ", wrong " + R.wrong + ".",
      api.state.C.played && R.night.wrong === 0 ? "ok" : "");
  }

  function playNight(api) {
    var C = api.state.C;
    C.played = true;
    api.log("18:00 to 21:00  " + TONIGHT.total + " chats: " + TONIGHT.stock + " stock and size, " + TONIGHT.ready +
      " ready-by, " + TONIGHT.general + " general.", "");
    var R = score(C);
    api.log("19:20  a father at the counter shows the chat from 18:52 on his phone: the skeleton costume in age 7 to 8, sold out on Tuesday.",
      R.night.stock.wrong > 1 ? "bad" : "");
    refresh(api, "checked after the 21:00 close:");
  }

  function sortChats(api) {
    api.state.C.sorted = true;
    api.log("sorted " + REAL.total + " chats from 12 to 28 October by kind: stock and size " + REAL.stock + ", ready-by " +
      REAL.ready + ", general " + REAL.general + ". the help-page test covers the general kind: " + REAL.general + " of " +
      REAL.total + ".", "warn");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    C.played = true;
    if (plan === "r0") { C.model = "larger"; }
    if (plan === "r1") { C.test = "help100"; }
    if (plan === "r2") { C.sorted = true; C.test = "real"; C.lookup = true; C.diary = true; C.model = "small"; C.rule = true; }
    if (plan === "r3") { C.toShop = true; }
    return C;
  }

  function planFollowUp(api, plan) {
    var R = score(api.state.C);
    if (plan === "r0") api.log("a bigger model: tonight " + R.tonight + " again. it still reads only the product page.", "bad");
    if (plan === "r1") api.log("100 help-page questions: " + R.test + ", still covering " + R.covered + " real chats. tonight " + R.tonight + ".", "bad");
    if (plan === "r2") api.log("sorted by kind, two lookups, small model, real-mix test, stock-only rule: " + R.test + "; tonight " +
      R.tonight + ", wrong " + R.wrong + ", sent to the shop " + R.shop + ": the costume described, not named.", "ok");
    if (plan === "r3") api.log("stock and order answers to the shop: answers " + R.answered + ". tonight " + R.tonight +
      ", wrong " + R.wrong + ", sent to the shop " + R.shop + ".", "warn");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a9e01", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      function syncControls() {
        S.sync = true;
        S.ctl.test.set(S.C.test);
        S.ctl.lookup.set(S.C.lookup);
        S.ctl.diary.set(S.C.diary);
        S.ctl.model.set(S.C.model);
        S.ctl.rule.set(S.C.rule);
        S.ctl.toShop.set(S.C.toShop);
        S.sync = false;
      }
      function manual(what) {
        if (S.C.plan !== "none") {
          S.C.plan = "none";
          S.sync = true; S.ctl.plan.set("none"); S.sync = false;
          what += " (reply cleared.)";
        }
        refresh(api, what);
      }
      function chooser(id, label, list, initial) {
        S.ctl[id] = api.control.select(id, label, list, initial, function (val) {
          if (S.sync) return;
          var o = pick(list, val);
          if (!o) return;
          S.C[id] = String(o.value);
          var extra = id === "model" ? " no count changes: every miss comes from what the model can see." : "";
          manual(label + ": " + o.label + "." + extra);
        });
      }
      function flag(id, label) {
        S.ctl[id] = api.control.toggle(id, label, false, function (on) {
          if (S.sync) return;
          S.C[id] = !!on;
          manual(label + ": " + (on ? "on." : "off."));
        });
      }
      S.ctl.sort = api.control.button("sort", "sort the 200 chats by kind", function () { sortChats(api); });
      chooser("test", "test set", TESTS, "help50");
      flag("lookup", "stock lookup");
      flag("diary", "order diary lookup");
      chooser("model", "model size", MODELS, "large");
      flag("rule", "stock-only rule");
      flag("toShop", "send stock and order answers to the shop");
      S.ctl.night = api.control.button("night", "play tonight, 18:00 to 21:00", function () { playNight(api); });
      S.ctl.plan = api.control.select("plan", "play a reply", PLANS, "none", function (val) {
        if (S.sync) return;
        var o = pick(PLANS, val);
        if (!o || o.value === "none") return;
        S.C = planConfig(String(o.value));
        syncControls();
        refresh(api, "plan: " + o.label + ".");
        planFollowUp(api, String(o.value));
      });
      S.ctl.reset = api.control.button("reset", "reset", function () { api.reset(); });

      S.stat = {
        test: api.stat("test", "test score", "warn"),
        covered: api.stat("covered", "real chats the test covers", "warn"),
        answered: api.stat("answered", "real chats it answers", ""),
        tonight: api.stat("tonight", "tonight right", "bad"),
        stockT: api.stat("stockT", "stock and size right tonight", ""),
        readyT: api.stat("readyT", "ready-by right tonight", ""),
        generalT: api.stat("generalT", "general right tonight", ""),
        wrong: api.stat("wrong", "tonight wrong", "bad"),
        shop: api.stat("shop", "tonight sent to the shop", ""),
        model: api.stat("model", "model size", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one kind of message: how many of the 200 real chats were that kind, how many of tonight's 40, and, once tonight is played, how many were answered right, answered wrong, or sent to the shop. The test score is on the test set you choose; the help-page sets only hold the general kind.");

      refresh(api, "");
      api.log("Thursday 29 October, 17:59, before the evening's first chat. live since Monday 12 October. the panel says test score " +
        HELP.help50.right + " of " + HELP.help50.n + ".", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: as built, before tonight's first chat.
      t.expect(t.stat("test") === "47 of 50" && t.stat("covered") === "46 of 200" && t.stat("answered") === "200 of 200" &&
        t.stat("tonight") === "not played yet" && t.stat("model") === "large (as built)" &&
        has("17:59, before the evening's first chat") && has("the panel says test score 47 of 50"),
        "Opens at 17:59: test 47 of 50, covering 46 of 200, tonight not played");

      // 2. Sorting the 200 chats by kind.
      t.click("sort");
      t.expect(has("stock and size 124, ready-by 30, general 46") && has("covers the general kind: 46 of 200"),
        "Sorted: 124, 30, 46; the help-page test covers 46 of 200");

      // 3. Tonight as built: 3 + 0 + 6 = 9.
      t.click("night");
      t.expect(t.stat("tonight") === "9 of 40 (3 + 0 + 6)" && t.stat("stockT") === "3 of 31" && t.stat("readyT") === "0 of 3" &&
        t.stat("generalT") === "6 of 6" && t.stat("wrong") === "31 of 40" && t.stat("shop") === "0 of 40" &&
        has("19:20  a father at the counter"), "Tonight as built: 9 of 40, 3 + 0 + 6, 31 wrong");

      // 4. A larger model: still 9.
      t.set("model", "larger");
      t.expect(t.stat("tonight") === "9 of 40 (3 + 0 + 6)" && t.stat("test") === "47 of 50" && has("no count changes"),
        "Larger model: still 9 of 40 and 47 of 50");

      // 5. 100 help-page questions: 94 of 100, still 46 of 200.
      t.set("model", "large");
      t.set("test", "help100");
      t.expect(t.stat("test") === "94 of 100" && t.stat("covered") === "46 of 200" && t.stat("tonight") === "9 of 40 (3 + 0 + 6)",
        "100 help-page questions: 94 of 100, still 46 of 200, tonight 9");

      // 6. The real-mix test as built: 16 of 50.
      t.set("test", "real");
      t.expect(t.stat("test") === "16 of 50 (5 + 0 + 11)" && t.stat("covered") === "200 of 200",
        "Real-mix test as built: 16 of 50, covering 200 of 200");

      // 7. Both lookups, no rule: 39 of 40 with 1 wrong.
      t.set("lookup", true);
      t.set("diary", true);
      t.expect(t.stat("tonight") === "39 of 40 (30 + 3 + 6)" && t.stat("wrong") === "1 of 40" && t.stat("shop") === "0 of 40",
        "Lookups on, rule off: 39 of 40, 1 wrong (the costume described, not named)");

      // 8. The stock-only rule: 0 wrong, 1 sent to the shop, 49 of 50.
      t.set("rule", true);
      t.expect(t.stat("tonight") === "39 of 40 (30 + 3 + 6)" && t.stat("wrong") === "0 of 40" && t.stat("shop") === "1 of 40" &&
        t.stat("test") === "49 of 50 (30 + 8 + 11)", "Rule on: 39 of 40, 0 wrong, 1 to the shop; real mix 49 of 50");

      // 9. A small model changes no count.
      t.set("model", "small");
      t.expect(t.stat("tonight") === "39 of 40 (30 + 3 + 6)" && t.stat("test") === "49 of 50 (30 + 8 + 11)" &&
        t.stat("model") === "small", "Small model with the lookups: still 39 of 40 and 49 of 50");

      // 10. Reply 3: stock and order answers to the shop drop 154 of 200.
      t.set("plan", "r3");
      t.expect(t.stat("answered") === "46 of 200 (154 sent to the shop)" && t.stat("tonight") === "6 of 40 (0 + 0 + 6)" &&
        t.stat("wrong") === "0 of 40" && t.stat("shop") === "34 of 40" && t.stat("test") === "47 of 50",
        "Reply 3: answers 46 of 200, 154 to the shop; tonight 6 of 40, 0 wrong, 34 to the shop");

      // 11. Reply 2: the ok option.
      t.set("plan", "r2");
      t.expect(t.stat("tonight") === "39 of 40 (30 + 3 + 6)" && t.stat("wrong") === "0 of 40" && t.stat("shop") === "1 of 40" &&
        t.stat("test") === "49 of 50 (30 + 8 + 11)" && t.stat("covered") === "200 of 200" && t.stat("model") === "small" &&
        has("the costume described, not named"), "Reply 2: 49 of 50 on the real mix; tonight 39 of 40, 0 wrong, 1 to the shop");

      // 12. Replies 0 and 1: a bigger model and a bigger help-page test both leave tonight at 9.
      t.set("plan", "r0");
      var r0 = t.stat("model") === "larger" && t.stat("tonight") === "9 of 40 (3 + 0 + 6)" && t.stat("test") === "47 of 50";
      t.set("plan", "r1");
      t.expect(r0 && t.stat("test") === "94 of 100" && t.stat("covered") === "46 of 200" && t.stat("tonight") === "9 of 40 (3 + 0 + 6)",
        "Replies 0 and 1: still 9 of 40; 47 of 50 and 94 of 100, both covering 46 of 200");
    }
  });
})();
